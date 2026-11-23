import * as THREE from 'three';
import { ANIMAL_SPECIES, GRID_COLS, GRID_ROWS } from '../data/zooCatalog';
import { BiomeType, FloorType, ParkTile, SeasonalEventId, SpeciesId, TileType } from '../types/zoo';
import {
  getArcticSnowTexture,
  getAsphaltFloorTexture,
  getBarkTexture,
  getBrickFloorTexture,
  getCobbleTexture,
  getEntranceBoardTexture,
  getForestFloorTexture,
  getGravelFloorTexture,
  getMeadowTexture,
  getSavannaGroundTexture,
  getSoftGroundAlphaTexture,
  getWaterRippleTexture,
  getWetlandMudTexture,
  getWoodFloorTexture,
  getWoodTexture,
} from './proceduralTextures';

export { buildAnimalMesh, animateAnimalRig, type AnimalRig } from './animalModels';
export {
  buildVisitorMesh,
  buildKeeperMesh,
  buildCleanerMesh,
  animateHumanRig,
  type HumanRig,
} from './humanModels';

export const TILE_SIZE = 2.8;
export const HABITAT_PROP_SCALE = 1.38;

export function gridToWorld(gx: number, gy: number): [number, number] {
  const wx = (gx - (GRID_COLS - 1) / 2) * TILE_SIZE;
  const wz = (gy - (GRID_ROWS - 1) / 2) * TILE_SIZE;
  return [wx, wz];
}

// Shared material pool to reduce shader compilations & draw calls
const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function getStdMat(
  color: string | number,
  roughness = 0.72,
  metalness = 0.05
): THREE.MeshStandardMaterial {
  const colHex = typeof color === 'number' ? color.toString(16) : color;
  const key = `${colHex}_${roughness.toFixed(2)}_${metalness.toFixed(2)}`;
  let mat = matCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    matCache.set(key, mat);
  }
  return mat;
}

let glassWallMat: THREE.MeshPhysicalMaterial | null = null;
function getGlassBarrierMat(): THREE.MeshPhysicalMaterial {
  if (glassWallMat) return glassWallMat;
  // Avoid `transmission > 0` which triggers an expensive full-scene second render pass every frame
  glassWallMat = new THREE.MeshPhysicalMaterial({
    color: '#DFF2F8',
    roughness: 0.08,
    metalness: 0.14,
    transparent: true,
    opacity: 0.34,
    clearcoat: 0.9,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return glassWallMat;
}

// Organic vertex-displaced rock geometry helper
function makeOrganicRock(radius: number, mat: THREE.Material, seed = 1): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n = 0.84 + 0.3 * Math.abs(Math.sin(vx * 7.1 + vy * 5.3 + vz * 3.7 + seed));
    pos.setXYZ(i, vx * n, vy * n, vz * n);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Shared shimmering water material (updated via texture offset in animation loop)
let waterMaterial: THREE.MeshPhysicalMaterial | null = null;
export function getRealisticWaterMaterial(): THREE.MeshPhysicalMaterial {
  if (waterMaterial) return waterMaterial;
  const ripple = getWaterRippleTexture();
  waterMaterial = new THREE.MeshPhysicalMaterial({
    color: '#0EA5E9',
    roughness: 0.08,
    metalness: 0.06,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
    bumpMap: ripple,
    bumpScale: 0.028,
    transparent: true,
    opacity: 0.88,
  });
  return waterMaterial;
}

/**
 * Continuous seamless grassy meadow park valley (NO square land blocks) + dense forest backdrop behind Ueno-style gate
 */
export function buildSurroundingEnvironment(maxAnisotropy = 4): THREE.Group {
  const env = new THREE.Group();

  const meadowTex = getMeadowTexture(maxAnisotropy).clone();
  meadowTex.needsUpdate = true;
  meadowTex.repeat.set(42, 42);

  // One continuous natural meadow grass surface (y = 0) spanning the entire park and surrounding valley
  const continuousGrass = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({
      map: meadowTex,
      color: '#BBD6AD',
      roughness: 0.94,
      metalness: 0.0,
    })
  );
  continuousGrass.rotation.x = -Math.PI / 2;
  continuousGrass.position.y = 0.0;
  continuousGrass.receiveShadow = true;
  env.add(continuousGrass);

  // Rolling distant botanical hills
  const hillGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const hillMat = getStdMat('#4D7A40', 0.94, 0.0);
  const hillConfigs = [
    [-31, -25, 13, 3.6, 9],
    [27, -27, 14, 4.0, 10],
    [-33, 17, 12, 2.8, 9],
    [31, 19, 13, 3.1, 9],
    [0, -34, 18, 4.5, 9],
  ];
  for (const [hx, hz, sx, sy, sz] of hillConfigs) {
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.set(hx, -0.05, hz);
    hill.scale.set(sx, sy, sz);
    hill.receiveShadow = true;
    env.add(hill);
  }

  // Organic deterministic PRNG so exterior wildflowers & tree groves scatter naturally (never grid-aligned)
  let envSeed = 4242;
  const nextEnvRand = () => {
    envSeed = (envSeed * 1664525 + 1013904223) >>> 0;
    return envSeed / 4294967296;
  };

  const parkHalfW = (GRID_COLS * TILE_SIZE) / 2;
  const parkHalfH = (GRID_ROWS * TILE_SIZE) / 2;
  const isInsideExcludedParkOrRoad = (wx: number, wz: number, margin = 0.65) => {
    if (Math.abs(wx) < parkHalfW + margin && Math.abs(wz) < parkHalfH + margin) {
      return true;
    }
    // Keep front entrance plaza approach open & inviting
    if (wz > parkHalfH - 0.6 && wx > -4.0 && wx < 1.4) {
      return true;
    }
    return false;
  };

  // --- Exterior Wildflower Patches on Meadow Grass ---
  const flowerCount = 360;
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.011, 0.14, 5);
  stemGeo.translate(0, 0.07, 0);
  const stemMat = getStdMat('#3D7A36', 0.85, 0.0);

  // 5-petal blossom crown built from two crossed angled petal discs + sunny center
  const petalPositions: number[] = [];
  for (let p = 0; p < 5; p++) {
    const a0 = (p / 5) * Math.PI * 2;
    const a1 = a0 + 0.52;
    const r = 0.056;
    petalPositions.push(
      0, 0.14, 0,
      Math.cos(a0) * r, 0.155, Math.sin(a0) * r,
      Math.cos(a1) * r, 0.152, Math.sin(a1) * r
    );
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.Float32BufferAttribute(petalPositions, 3));
  petalGeo.computeVertexNormals();
  const petalMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.62,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const flowerStems = new THREE.InstancedMesh(stemGeo, stemMat, flowerCount);
  const flowerPetals = new THREE.InstancedMesh(petalGeo, petalMat, flowerCount);
  flowerStems.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const wildflowerPalette = [
    '#FFFDF2', // Daisy white
    '#FACC15', // Buttercup gold
    '#F472B6', // Wild sakura pink
    '#60A5FA', // Cornflower sky
    '#FB7185', // Meadow poppy coral
    '#C084FC', // Wild lavender
  ];

  // Organic wildflower clusters around the zoo perimeter
  const clusterCenters: Array<[number, number]> = [];
  for (let c = 0; c < 42; c++) {
    for (let tries = 0; tries < 20; tries++) {
      const cx = (nextEnvRand() - 0.5) * 48;
      const cz = (nextEnvRand() - 0.5) * 38;
      if (!isInsideExcludedParkOrRoad(cx, cz, 0.55)) {
        clusterCenters.push([cx, cz]);
        break;
      }
    }
  }

  let placedFlowers = 0;
  let guard = 0;
  while (placedFlowers < flowerCount && guard < 3600) {
    guard++;
    const useCluster = clusterCenters.length > 0 && nextEnvRand() < 0.72;
    let fx = 0;
    let fz = 0;
    if (useCluster) {
      const [cx, cz] = clusterCenters[Math.floor(nextEnvRand() * clusterCenters.length)];
      const ang = nextEnvRand() * Math.PI * 2;
      const rad = nextEnvRand() * 2.4;
      fx = cx + Math.cos(ang) * rad;
      fz = cz + Math.sin(ang) * rad;
    } else {
      fx = (nextEnvRand() - 0.5) * 49;
      fz = (nextEnvRand() - 0.5) * 39;
    }
    if (isInsideExcludedParkOrRoad(fx, fz, 0.35)) continue;

    const sc = 0.85 + nextEnvRand() * 0.78;
    dummy.position.set(fx, 0, fz);
    dummy.rotation.set(
      (nextEnvRand() - 0.5) * 0.22,
      nextEnvRand() * Math.PI * 2,
      (nextEnvRand() - 0.5) * 0.22
    );
    dummy.scale.set(sc, sc * (0.85 + nextEnvRand() * 0.4), sc);
    dummy.updateMatrix();
    flowerStems.setMatrixAt(placedFlowers, dummy.matrix);
    flowerPetals.setMatrixAt(placedFlowers, dummy.matrix);

    color.set(wildflowerPalette[Math.floor(nextEnvRand() * wildflowerPalette.length)]);
    flowerPetals.setColorAt(placedFlowers, color);
    placedFlowers++;
  }
  flowerStems.count = placedFlowers;
  flowerPetals.count = placedFlowers;
  flowerStems.instanceMatrix.needsUpdate = true;
  flowerPetals.instanceMatrix.needsUpdate = true;
  if (flowerPetals.instanceColor) flowerPetals.instanceColor.needsUpdate = true;
  flowerStems.computeBoundingSphere();
  flowerPetals.computeBoundingSphere();
  env.add(flowerStems, flowerPetals);

  // --- 4 Distinct Exterior Tree Varieties Placed Organically (No Grid Alignment!) ---
  type TreeSpecies = 'oak' | 'pine' | 'birch' | 'sakura';
  interface TreeSpot {
    x: number;
    z: number;
    species: TreeSpecies;
    scale: number;
    yaw: number;
    leanX: number;
    leanZ: number;
  }

  const treeSpots: TreeSpot[] = [];
  const speciesPool: TreeSpecies[] = ['oak', 'pine', 'birch', 'sakura'];
  const targetTreeCount = 128;

  // Reject candidates too close to existing trees so spacing looks natural & un-gridded
  for (let attempt = 0; attempt < 3200 && treeSpots.length < targetTreeCount; attempt++) {
    // Bias density slightly toward north backdrop and flanks while keeping south sides scenic
    const tx = (nextEnvRand() - 0.5) * 50;
    const tz = (nextEnvRand() - 0.5) * 41 - 1.5;
    if (isInsideExcludedParkOrRoad(tx, tz, 1.6)) continue;
    // Keep foreground entrance corridor spacious
    if (tz > parkHalfH && Math.abs(tx + 1.4) < 3.9) continue;

    let tooClose = false;
    for (const existing of treeSpots) {
      const dx = existing.x - tx;
      const dz = existing.z - tz;
      if (dx * dx + dz * dz < 2.1 * 2.1) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    // Slight natural grove clustering via spatial angle + randomness
    const groveBias = Math.sin(tx * 0.25 + tz * 0.2) + (nextEnvRand() - 0.5) * 1.4;
    let species: TreeSpecies;
    if (groveBias > 0.65) species = 'pine';
    else if (groveBias < -0.55) species = 'sakura';
    else species = speciesPool[Math.floor(nextEnvRand() * speciesPool.length)];

    treeSpots.push({
      x: tx,
      z: tz,
      species,
      scale: 0.78 + nextEnvRand() * 0.64,
      yaw: nextEnvRand() * Math.PI * 2,
      leanX: (nextEnvRand() - 0.5) * 0.08,
      leanZ: (nextEnvRand() - 0.5) * 0.08,
    });
  }

  const barkMat = new THREE.MeshStandardMaterial({
    map: getBarkTexture(maxAnisotropy),
    roughness: 0.92,
    metalness: 0.02,
  });
  const birchBarkMat = new THREE.MeshStandardMaterial({
    color: '#DEDAD0',
    roughness: 0.88,
    metalness: 0.01,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.85,
    metalness: 0.01,
  });

  const bySpecies: Record<TreeSpecies, TreeSpot[]> = {
    oak: [],
    pine: [],
    birch: [],
    sakura: [],
  };
  for (const t of treeSpots) {
    bySpecies[t.species].push(t);
  }

  // 1. Broadleaf Oak / Camphor (sturdy trunk + dual-lobe organic canopy)
  if (bySpecies.oak.length > 0) {
    const n = bySpecies.oak.length;
    const tGeo = new THREE.CylinderGeometry(0.11, 0.21, 1.25, 8);
    tGeo.translate(0, 0.62, 0);
    const c1Geo = new THREE.DodecahedronGeometry(0.84, 1);
    c1Geo.scale(1.08, 0.88, 1.04);
    c1Geo.translate(0, 1.66, 0);
    const c2Geo = new THREE.DodecahedronGeometry(0.6, 1);
    c2Geo.translate(0.18, 2.26, -0.1);

    const trunks = new THREE.InstancedMesh(tGeo, barkMat, n);
    const crownA = new THREE.InstancedMesh(c1Geo, leafMat, n);
    const crownB = new THREE.InstancedMesh(c2Geo, leafMat, n);
    trunks.castShadow = true;
    crownA.castShadow = true;
    crownA.receiveShadow = true;
    crownB.castShadow = true;

    const oakGreens = ['#2F683A', '#3D7A47', '#275931', '#488751'];
    bySpecies.oak.forEach((t, idx) => {
      dummy.position.set(t.x, -0.02, t.z);
      dummy.rotation.set(t.leanX, t.yaw, t.leanZ);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);
      crownA.setMatrixAt(idx, dummy.matrix);
      crownB.setMatrixAt(idx, dummy.matrix);
      color.set(oakGreens[idx % oakGreens.length]);
      crownA.setColorAt(idx, color);
      color.offsetHSL(0.01, 0.02, 0.04);
      crownB.setColorAt(idx, color);
    });
    trunks.instanceMatrix.needsUpdate = true;
    crownA.instanceMatrix.needsUpdate = true;
    crownB.instanceMatrix.needsUpdate = true;
    if (crownA.instanceColor) crownA.instanceColor.needsUpdate = true;
    if (crownB.instanceColor) crownB.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    crownA.computeBoundingSphere();
    crownB.computeBoundingSphere();
    env.add(trunks, crownA, crownB);
  }

  // 2. Evergreen Pine / Cedar (tall trunk + 3-tiered conical needle boughs)
  if (bySpecies.pine.length > 0) {
    const n = bySpecies.pine.length;
    const tGeo = new THREE.CylinderGeometry(0.07, 0.14, 1.15, 7);
    tGeo.translate(0, 0.57, 0);
    const tier1Geo = new THREE.ConeGeometry(0.76, 1.05, 8);
    tier1Geo.translate(0, 1.25, 0);
    const tier2Geo = new THREE.ConeGeometry(0.58, 0.95, 8);
    tier2Geo.translate(0, 1.85, 0);
    const tier3Geo = new THREE.ConeGeometry(0.38, 0.85, 8);
    tier3Geo.translate(0, 2.42, 0);

    const trunks = new THREE.InstancedMesh(tGeo, barkMat, n);
    const tier1 = new THREE.InstancedMesh(tier1Geo, leafMat, n);
    const tier2 = new THREE.InstancedMesh(tier2Geo, leafMat, n);
    const tier3 = new THREE.InstancedMesh(tier3Geo, leafMat, n);
    trunks.castShadow = true;
    tier1.castShadow = true;
    tier2.castShadow = true;
    tier3.castShadow = true;

    const pineGreens = ['#204B2D', '#285937', '#1C4126', '#306640'];
    bySpecies.pine.forEach((t, idx) => {
      dummy.position.set(t.x, -0.02, t.z);
      dummy.rotation.set(t.leanX * 0.6, t.yaw, t.leanZ * 0.6);
      dummy.scale.set(t.scale * 0.92, t.scale * 1.14, t.scale * 0.92);
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);
      tier1.setMatrixAt(idx, dummy.matrix);
      tier2.setMatrixAt(idx, dummy.matrix);
      tier3.setMatrixAt(idx, dummy.matrix);
      color.set(pineGreens[idx % pineGreens.length]);
      tier1.setColorAt(idx, color);
      color.offsetHSL(0.0, 0.02, 0.03);
      tier2.setColorAt(idx, color);
      color.offsetHSL(0.0, 0.02, 0.03);
      tier3.setColorAt(idx, color);
    });
    trunks.instanceMatrix.needsUpdate = true;
    tier1.instanceMatrix.needsUpdate = true;
    tier2.instanceMatrix.needsUpdate = true;
    tier3.instanceMatrix.needsUpdate = true;
    if (tier1.instanceColor) tier1.instanceColor.needsUpdate = true;
    if (tier2.instanceColor) tier2.instanceColor.needsUpdate = true;
    if (tier3.instanceColor) tier3.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    tier1.computeBoundingSphere();
    tier2.computeBoundingSphere();
    tier3.computeBoundingSphere();
    env.add(trunks, tier1, tier2, tier3);
  }

  // 3. Silver Birch (slender pale white trunk + bright chartreuse oval foliage)
  if (bySpecies.birch.length > 0) {
    const n = bySpecies.birch.length;
    const tGeo = new THREE.CylinderGeometry(0.055, 0.095, 1.55, 7);
    tGeo.translate(0, 0.77, 0);
    const cGeo = new THREE.DodecahedronGeometry(0.62, 1);
    cGeo.scale(0.92, 1.25, 0.92);
    cGeo.translate(0, 2.0, 0);

    const trunks = new THREE.InstancedMesh(tGeo, birchBarkMat, n);
    const crowns = new THREE.InstancedMesh(cGeo, leafMat, n);
    trunks.castShadow = true;
    crowns.castShadow = true;

    const birchGreens = ['#6E9E47', '#7FAD52', '#5F8F3D', '#89B55C'];
    bySpecies.birch.forEach((t, idx) => {
      dummy.position.set(t.x, -0.02, t.z);
      dummy.rotation.set(t.leanX * 1.4, t.yaw, t.leanZ * 1.4);
      dummy.scale.set(t.scale, t.scale * 1.08, t.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);
      crowns.setMatrixAt(idx, dummy.matrix);
      color.set(birchGreens[idx % birchGreens.length]);
      crowns.setColorAt(idx, color);
    });
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    env.add(trunks, crowns);
  }

  // 4. Flowering Sakura / Cherry Tree (sculpted trunk + wide blush blossom clouds)
  if (bySpecies.sakura.length > 0) {
    const n = bySpecies.sakura.length;
    const tGeo = new THREE.CylinderGeometry(0.09, 0.17, 1.15, 8);
    tGeo.translate(0, 0.57, 0);
    const b1Geo = new THREE.DodecahedronGeometry(0.78, 1);
    b1Geo.scale(1.25, 0.66, 1.15);
    b1Geo.translate(0, 1.48, 0);
    const b2Geo = new THREE.DodecahedronGeometry(0.54, 1);
    b2Geo.scale(1.15, 0.65, 1.05);
    b2Geo.translate(-0.22, 1.85, 0.14);

    const trunks = new THREE.InstancedMesh(tGeo, barkMat, n);
    const blossomA = new THREE.InstancedMesh(b1Geo, leafMat, n);
    const blossomB = new THREE.InstancedMesh(b2Geo, leafMat, n);
    trunks.castShadow = true;
    blossomA.castShadow = true;
    blossomB.castShadow = true;

    const sakuraPinks = ['#F2B5C6', '#ECA2B7', '#F7C9D6', '#E89AB0'];
    bySpecies.sakura.forEach((t, idx) => {
      dummy.position.set(t.x, -0.02, t.z);
      dummy.rotation.set(t.leanX * 1.1, t.yaw, t.leanZ * 1.1);
      dummy.scale.setScalar(t.scale * 0.96);
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);
      blossomA.setMatrixAt(idx, dummy.matrix);
      blossomB.setMatrixAt(idx, dummy.matrix);
      color.set(sakuraPinks[idx % sakuraPinks.length]);
      blossomA.setColorAt(idx, color);
      color.offsetHSL(0.0, 0.02, 0.04);
      blossomB.setColorAt(idx, color);
    });
    trunks.instanceMatrix.needsUpdate = true;
    blossomA.instanceMatrix.needsUpdate = true;
    blossomB.instanceMatrix.needsUpdate = true;
    if (blossomA.instanceColor) blossomA.instanceColor.needsUpdate = true;
    if (blossomB.instanceColor) blossomB.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    blossomA.computeBoundingSphere();
    blossomB.computeBoundingSphere();
    env.add(trunks, blossomA, blossomB);
  }

  return env;
}

/**
 * Instanced 3D swaying grass blade tufts (~3,200 tufts) covering meadow & grassy habitats
 */
export interface GrassFieldHandle {
  mesh: THREE.InstancedMesh;
  timeUniform: { value: number };
  syncGridVisibility: (grid: ParkTile[][]) => void;
}

export function build3DGrassField(): GrassFieldHandle {
  // Multi-blade natural grass tuft BufferGeometry (3 crossed curved blades per tuft)
  const positions: number[] = [];
  const colors: number[] = [];
  const bladeCount = 3;

  for (let b = 0; b < bladeCount; b++) {
    const ang = (b / bladeCount) * Math.PI * 2 + 0.35;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const px = -dz;
    const pz = dx;
    const h = 0.085 + (b % 2) * 0.035;
    const w = 0.022;
    const lean = 0.032;

    // Triangle blade: base left, base right, tapered leaning tip
    positions.push(
      dx * 0.01 - px * w,
      0.0,
      dz * 0.01 - pz * w,
      dx * 0.01 + px * w,
      0.0,
      dz * 0.01 + pz * w,
      dx * (0.01 + lean),
      h,
      dz * (0.01 + lean)
    );

    // Darker root -> sun-lit tip gradient
    colors.push(0.24, 0.42, 0.18, 0.24, 0.42, 0.18, 0.56, 0.78, 0.36);
  }

  const tuftGeo = new THREE.BufferGeometry();
  tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  tuftGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  tuftGeo.computeVertexNormals();

  const timeUniform = { value: 0 };
  const grassMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // Gentle wind sway shader hook on grass blade tips
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float tipWeight = clamp(position.y / 0.12, 0.0, 1.0);
        #ifdef USE_INSTANCING
          vec4 instCenter = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = sin(uTime * 1.9 + instCenter.x * 0.9 + instCenter.z * 0.7) * 0.028;
          transformed.x += sway * tipWeight;
          transformed.z += sway * 0.5 * tipWeight;
        #endif`
      );
  };

  // Scatter tufts across playable park area + soft border apron
  const tuftsPerTile = 32;
  const parkTuftsCount = GRID_COLS * GRID_ROWS * tuftsPerTile;
  const borderTuftsCount = 400;
  const totalCount = parkTuftsCount + borderTuftsCount;

  const mesh = new THREE.InstancedMesh(tuftGeo, grassMat, totalCount);
  mesh.receiveShadow = true;

  // Precompute deterministic placements per grid cell so syncGridVisibility is instant
  interface TuftMeta {
    gx: number;
    gy: number;
    wx: number;
    wz: number;
    rotY: number;
    sx: number;
    sy: number;
  }
  const tuftMeta: TuftMeta[] = [];

  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const tintColor = new THREE.Color();
  const dummy = new THREE.Object3D();

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const [cx, cz] = gridToWorld(x, y);
      for (let t = 0; t < tuftsPerTile; t++) {
        const wx = cx + (nextRand() - 0.5) * (TILE_SIZE * 0.94);
        const wz = cz + (nextRand() - 0.5) * (TILE_SIZE * 0.94);
        const rotY = nextRand() * Math.PI * 2;
        const sx = 0.8 + nextRand() * 0.55;
        const sy = 0.75 + nextRand() * 0.7;
        const idx = tuftMeta.length;
        tuftMeta.push({ gx: x, gy: y, wx, wz, rotY, sx, sy });

        dummy.position.set(wx, 0, wz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(sx, sy, sx);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);

        tintColor.setHSL(0.25 + (nextRand() - 0.5) * 0.04, 0.44 + nextRand() * 0.14, 0.5 + (nextRand() - 0.5) * 0.1);
        mesh.setColorAt(idx, tintColor);
      }
    }
  }

  // Natural perimeter tufts outside the playable grid so transition to forest is seamless
  const parkHalfW = (GRID_COLS * TILE_SIZE) / 2;
  const parkHalfH = (GRID_ROWS * TILE_SIZE) / 2;
  for (let b = 0; b < borderTuftsCount; b++) {
    let wx = 0;
    let wz = 0;
    const edge = b % 4;
    if (edge === 0) {
      wx = (nextRand() - 0.5) * (parkHalfW * 2 + 7);
      wz = -parkHalfH - 0.35 - nextRand() * 2.8;
    } else if (edge === 1) {
      wx = (nextRand() - 0.5) * (parkHalfW * 2 + 7);
      wz = parkHalfH + 0.35 + nextRand() * 2.8;
    } else if (edge === 2) {
      wx = -parkHalfW - 0.35 - nextRand() * 3.0;
      wz = (nextRand() - 0.5) * (parkHalfH * 2 + 2.5);
    } else {
      wx = parkHalfW + 0.35 + nextRand() * 3.0;
      wz = (nextRand() - 0.5) * (parkHalfH * 2 + 2.5);
    }
    const idx = parkTuftsCount + b;
    dummy.position.set(wx, 0, wz);
    dummy.rotation.set(0, nextRand() * Math.PI * 2, 0);
    const s = 0.9 + nextRand() * 0.7;
    dummy.scale.set(s, s * 1.15, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(idx, dummy.matrix);
    tintColor.setHSL(0.26 + (nextRand() - 0.5) * 0.04, 0.46, 0.48 + (nextRand() - 0.5) * 0.08);
    mesh.setColorAt(idx, tintColor);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();

  const grassySpecies = new Set<SpeciesId>([
    'lion',
    'tiger',
    'cheetah',
    'giraffe',
    'zebra',
    'elephant',
    'meerkat',
    'kangaroo',
    'panda',
    'red_panda',
    'peacock',
    'capybara',
    'otter',
    'toucan',
  ]);
  const savannaSpecies = new Set<SpeciesId>([
    'lion',
    'cheetah',
    'giraffe',
    'zebra',
    'elephant',
    'meerkat',
    'kangaroo',
  ]);

  const syncGridVisibility = (grid: ParkTile[][]) => {
    let colorDirty = false;
    for (let idx = 0; idx < tuftMeta.length; idx++) {
      const m = tuftMeta[idx];
      const tile = grid[m.gy]?.[m.gx];
      let show = true;
      let isSavanna = false;
      if (tile) {
        if (
          tile.type === 'path' ||
          tile.type === 'gate' ||
          tile.type === 'snack' ||
          tile.type === 'bench' ||
          tile.type === 'garden' ||
          tile.type === 'souvenir' ||
          tile.type === 'fountain' ||
          tile.type === 'restroom' ||
          tile.type === 'pavilion' ||
          tile.type === 'landmark'
        ) {
          show = false;
        } else if (tile.type === 'habitat' && tile.habitat) {
          const sp = tile.habitat.speciesId;
          if (!grassySpecies.has(sp)) {
            show = false;
          } else {
            isSavanna = savannaSpecies.has(sp);
            // Keep tufts clear of pools, tubs & rear rock mounds
            const [cx, cz] = gridToWorld(m.gx, m.gy);
            const lx = (m.wx - cx) / HABITAT_PROP_SCALE;
            const lz = (m.wz - cz) / HABITAT_PROP_SCALE;
            if (sp === 'zebra' && (lx + 0.48) ** 2 + (lz + 0.48) ** 2 < 0.12) show = false;
            else if (sp === 'elephant' && (lx + 0.38) ** 2 + (lz + 0.38) ** 2 < 0.24) show = false;
            else if (sp === 'tiger' && (lx - 0.36) ** 2 + (lz + 0.38) ** 2 < 0.18) show = false;
            else if (sp === 'capybara' && (lx + 0.42) ** 2 + (lz + 0.42) ** 2 < 0.19) show = false;
            else if (sp === 'lion' && lz < -0.25 && lx < 0.2) show = false;
          }
        }
      }

      dummy.position.set(m.wx, 0, m.wz);
      dummy.rotation.set(0, m.rotY, 0);
      if (show) {
        dummy.scale.set(m.sx, m.sy, m.sx);
        if (isSavanna) {
          tintColor.setHSL(0.115 + (idx % 5) * 0.008, 0.46, 0.56 + (idx % 3) * 0.04);
        } else {
          tintColor.setHSL(0.25 + (idx % 5) * 0.008, 0.46, 0.48 + (idx % 3) * 0.03);
        }
        mesh.setColorAt(idx, tintColor);
        colorDirty = true;
      } else {
        dummy.scale.set(0, 0, 0);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  return { mesh, timeUniform, syncGridVisibility };
}

function getFloorMaterial(floorType: FloorType, connected: boolean, maxAnisotropy: number): THREE.MeshStandardMaterial {
  let tex: THREE.CanvasTexture;
  let roughness = 0.85;
  let metalness = 0.04;

  switch (floorType) {
    case 'brick':
      tex = getBrickFloorTexture(maxAnisotropy);
      roughness = 0.88;
      break;
    case 'wood':
      tex = getWoodFloorTexture(maxAnisotropy);
      roughness = 0.78;
      break;
    case 'gravel':
      tex = getGravelFloorTexture(maxAnisotropy);
      roughness = 0.94;
      break;
    case 'asphalt':
      tex = getAsphaltFloorTexture(maxAnisotropy);
      roughness = 0.82;
      break;
    case 'stone':
    default:
      tex = getCobbleTexture(maxAnisotropy);
      roughness = 0.86;
      break;
  }

  return new THREE.MeshStandardMaterial({
    map: tex,
    color: connected ? '#FFFFFF' : '#B8B0A4',
    roughness,
    metalness,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/**
 * Composite 3D models for facilities (Ueno-style Gate, 5 Floor types, Snack, Bench, Garden)
 */
export function buildFacilityMesh(
  type: Exclude<TileType, 'grass' | 'habitat'>,
  connected: boolean,
  maxAnisotropy = 4,
  floorType: FloorType = 'stone'
): THREE.Group {
  const group = new THREE.Group();
  const cobbleTex = getCobbleTexture(maxAnisotropy);
  const woodTex = getWoodTexture(maxAnisotropy);

  if (type === 'path') {
    const mat = getFloorMaterial(floorType, connected, maxAnisotropy);
    // Flush ground-embedded paving (no floating thick blocks!)
    const paving = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_SIZE * 1.005, TILE_SIZE * 1.005),
      mat
    );
    paving.rotation.x = -Math.PI / 2;
    paving.position.y = 0.008;
    paving.receiveShadow = true;
    paving.userData.isRoadSurface = true;
    paving.userData.baseRoughness = mat.roughness;
    paving.userData.baseMetalness = mat.metalness;
    paving.userData.baseColorHex = connected ? '#FFFFFF' : '#B8B0A4';
    group.add(paving);

    // Wood boardwalk adds subtle side timber runner trim
    if (floorType === 'wood') {
      const trimMat = getStdMat('#5C3E24', 0.82, 0.03);
      for (const sx of [-TILE_SIZE * 0.46, TILE_SIZE * 0.46]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, TILE_SIZE * 0.99), trimMat);
        edge.position.set(sx, 0.015, 0);
        edge.receiveShadow = true;
        group.add(edge);
      }
    }
    return group;
  }

  if (type === 'gate') {
    // Wide Ueno Zoo architectural entrance gate & asphalt plaza
    const plazaMat = getFloorMaterial('asphalt', true, maxAnisotropy);
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE * 1.06, TILE_SIZE * 1.04), plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.009;
    plaza.receiveShadow = true;
    plaza.userData.isRoadSurface = true;
    plaza.userData.baseRoughness = plazaMat.roughness;
    plaza.userData.baseMetalness = plazaMat.metalness;
    plaza.userData.baseColorHex = '#FFFFFF';
    group.add(plaza);

    const concreteMat = getStdMat('#D6D9DD', 0.68, 0.08);
    const roofTopMat = getStdMat('#C2C7CE', 0.56, 0.14);
    const steelMat = getStdMat('#64748B', 0.35, 0.65);
    const redLetterMat = getStdMat('#C8372D', 0.45, 0.15);
    const blueEmblemMat = getStdMat('#2563EB', 0.38, 0.12);
    const glassMat = getGlassBarrierMat();

    // Ticket booth wings on left & right
    for (const sx of [-1.25, 1.25]) {
      const booth = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.85, 0.68), concreteMat);
      booth.position.set(sx, 0.43, -0.05);
      booth.castShadow = true;
      booth.receiveShadow = true;

      const windowPane = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.04), glassMat);
      windowPane.position.set(sx, 0.52, 0.3);
      group.add(booth, windowPane);
    }

    // Guide map board on left wing (like Ueno entrance map)
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.24),
      new THREE.MeshStandardMaterial({ map: getEntranceBoardTexture(), roughness: 0.45 })
    );
    board.position.set(-1.25, 0.68, 0.31);
    group.add(board);

    // Structural steel columns supporting the cantilevered roof
    for (const cx of [-1.45, -0.58, 0.58, 1.45]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.26, 8), steelMat);
      col.position.set(cx, 0.63, -0.22);
      col.castShadow = true;
      group.add(col);
    }

    // Stainless turnstile entry barriers
    for (const tx of [-0.36, 0.0, 0.36]) {
      const turnstile = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.44), steelMat);
      turnstile.position.set(tx, 0.19, 0.04);
      turnstile.castShadow = true;
      group.add(turnstile);
    }

    // Wide gently pitched architectural canopy roof (Ueno Zoo style)
    const leftRoof = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.09, 1.05), roofTopMat);
    leftRoof.position.set(-0.92, 1.28, 0.04);
    leftRoof.rotation.z = 0.035;
    leftRoof.castShadow = true;

    const rightRoof = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.09, 1.05), roofTopMat);
    rightRoof.position.set(0.92, 1.28, 0.04);
    rightRoof.rotation.z = -0.035;
    rightRoof.castShadow = true;

    // White fascia beam across front
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.14, 0.08), concreteMat);
    fascia.position.set(0, 1.26, 0.56);

    // Blue circular emblem + Red sculptural lettering blocks on top of fascia
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 14), blueEmblemMat);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(-0.95, 1.38, 0.56);
    group.add(emblem);

    for (let i = 0; i < 6; i++) {
      const letterBlock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.05), redLetterMat);
      letterBlock.position.set(-0.55 + i * 0.24, 1.38, 0.56);
      letterBlock.castShadow = true;
      group.add(letterBlock);
    }

    // Hanging central ZOO PLANET banner under canopy
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.24),
      new THREE.MeshStandardMaterial({ map: getEntranceBoardTexture(), roughness: 0.4 })
    );
    banner.position.set(0, 1.06, 0.52);
    group.add(leftRoof, rightRoof, fascia, banner);
    return group;
  }

  if (type === 'snack') {
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(1.06, 22),
      new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.88, metalness: 0.02 })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.009;
    base.receiveShadow = true;

    const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.74, metalness: 0.04 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.6, 0.72), woodMat);
    counter.position.set(0, 0.3, 0);
    counter.castShadow = true;

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.07, 0.8),
      getStdMat('#F4F1EA', 0.45, 0.06)
    );
    trim.position.set(0, 0.62, 0);

    const poleMat = getStdMat('#573B23', 0.72, 0.1);
    for (const px of [-0.46, 0.46]) {
      for (const pz of [-0.3, 0.3]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.6, 8), poleMat);
        pole.position.set(px, 0.92, pz);
        group.add(pole);
      }
    }

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.86, 0.44, 4),
      getStdMat('#B85332', 0.68, 0.04)
    );
    roof.position.set(0, 1.38, 0);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;

    group.add(base, counter, trim, roof);
    return group;
  }

  if (type === 'bench') {
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(0.88, 22),
      new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.88, metalness: 0.02 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.008;
    pad.receiveShadow = true;

    const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.75, metalness: 0.04 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.06, 0.32), woodMat);
    seat.position.set(0, 0.25, 0.08);
    seat.castShadow = true;

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.26, 0.055), woodMat);
    backrest.position.set(0, 0.42, -0.09);
    backrest.rotation.x = -0.14;
    backrest.castShadow = true;

    const legMat = getStdMat('#334155', 0.35, 0.68);
    for (const lx of [-0.34, 0.34]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.24, 0.28), legMat);
      leg.position.set(lx, 0.12, 0.05);
      group.add(leg);
    }

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.22, 8), legMat);
    pole.position.set(0.36, 0.61, -0.2);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.22, 10),
      getStdMat('#2B6E8C', 0.65, 0.05)
    );
    canopy.position.set(0.36, 1.22, -0.2);
    canopy.castShadow = true;

    group.add(pad, seat, backrest, pole, canopy);
    return group;
  }

  if (type === 'landmark') {
    // Golden Guide Landmark (金色導覽地標): tiered granite plaza, bronze plinth, brushed gold compass obelisk & glowing crown
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 24),
      new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.78, metalness: 0.06 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.01;
    plaza.receiveShadow = true;

    const stoneMat = getStdMat('#D6D3CD', 0.62, 0.1);
    const bronzeMat = getStdMat('#5C4524', 0.42, 0.58);
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#F2C144',
      roughness: 0.22,
      metalness: 0.86,
      emissive: '#B45309',
      emissiveIntensity: 0.16,
    });
    const brightGoldMat = new THREE.MeshStandardMaterial({
      color: '#FDE68A',
      roughness: 0.16,
      metalness: 0.9,
      emissive: '#F59E0B',
      emissiveIntensity: 0.32,
    });

    const step1 = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.74, 0.12, 8), stoneMat);
    step1.position.y = 0.06;
    step1.castShadow = true;
    step1.receiveShadow = true;

    const step2 = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.14, 8), bronzeMat);
    step2.position.y = 0.19;
    step2.castShadow = true;

    const goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.032, 8, 24), goldMat);
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = 0.27;

    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, 1.05, 8), goldMat);
    obelisk.position.y = 0.78;
    obelisk.castShadow = true;

    // 4 directional wayfinding sign arms pointing along park cardinal axes
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const armGroup = new THREE.Group();
      armGroup.position.y = 1.02 - (i % 2) * 0.14;
      armGroup.rotation.y = ang;

      const signBar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.075, 0.05), bronzeMat);
      signBar.position.x = 0.24;
      signBar.castShadow = true;

      const arrowTip = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.11, 4), brightGoldMat);
      arrowTip.rotation.z = -Math.PI / 2;
      arrowTip.position.x = 0.49;

      armGroup.add(signBar, arrowTip);
      group.add(armGroup);
    }

    // Glowing compass globe & spire finial
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.08, 8), bronzeMat);
    collar.position.y = 1.32;

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 14), brightGoldMat);
    orb.position.y = 1.48;
    orb.castShadow = true;

    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 8, 24), goldMat);
    crownRing.position.y = 1.48;
    crownRing.rotation.x = Math.PI / 5;

    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.26, 6), brightGoldMat);
    spire.position.y = 1.72;

    // 4 corner ornamental evergreen planters
    const shrubMat = getStdMat('#2D6E3E', 0.82, 0.02);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.12, 8), stoneMat);
      pot.position.set(Math.cos(a) * 0.66, 0.06, Math.sin(a) * 0.66);
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), shrubMat);
      bush.position.set(Math.cos(a) * 0.66, 0.17, Math.sin(a) * 0.66);
      group.add(pot, bush);
    }

    group.add(plaza, step1, step2, goldRing, obelisk, collar, orb, crownRing, spire);
    return group;
  }

  if (type === 'souvenir') {
    // Souvenir Gift Shop (紀念品商店): cobble terrace, timber & glass boutique, striped awning, plush toy display stand
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(1.12, 24),
      new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.86, metalness: 0.03 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.009;
    plaza.receiveShadow = true;

    const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72, metalness: 0.04 });
    const creamMat = getStdMat('#F7F3E9', 0.65, 0.03);
    const glassMat = getGlassBarrierMat();

    const shopBody = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.76, 0.86), creamMat);
    shopBody.position.set(0, 0.39, -0.08);
    shopBody.castShadow = true;
    shopBody.receiveShadow = true;

    const timberBase = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.24, 0.9), woodMat);
    timberBase.position.set(0, 0.12, -0.08);
    timberBase.castShadow = true;

    const windowFront = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.36, 0.05), glassMat);
    windowFront.position.set(0, 0.48, 0.36);

    // Warm pitched roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 0.42, 4),
      getStdMat('#2E6F5E', 0.68, 0.05)
    );
    roof.position.set(0, 0.98, -0.08);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;

    // Striped front awning slats
    const awningCols = ['#C2410C', '#FEF3C7'];
    for (let i = 0; i < 6; i++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.04, 0.38),
        getStdMat(awningCols[i % 2], 0.6, 0.04)
      );
      slat.position.set(-0.45 + i * 0.18, 0.69, 0.46);
      slat.rotation.x = 0.24;
      slat.castShadow = true;
      group.add(slat);
    }

    // Outdoor plush souvenir display stand with mini panda & lion keepsakes
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.26), woodMat);
    shelf.position.set(0.05, 0.13, 0.56);
    shelf.castShadow = true;

    const giftBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.14),
      getStdMat('#E11D48', 0.45, 0.05)
    );
    giftBox.position.set(-0.14, 0.32, 0.56);
    const plushBear = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 10),
      getStdMat('#F59E0B', 0.85, 0.0)
    );
    plushBear.position.set(0.08, 0.33, 0.56);
    const giftBag = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.15, 0.09),
      getStdMat('#0284C7', 0.55, 0.04)
    );
    giftBag.position.set(0.28, 0.32, 0.56);

    // Hanging shop signboard on roof fascia
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.16, 0.06),
      getStdMat('#D97706', 0.48, 0.14)
    );
    signBoard.position.set(0, 0.86, 0.38);

    group.add(
      plaza,
      shopBody,
      timberBase,
      windowFront,
      roof,
      shelf,
      giftBox,
      plushBear,
      giftBag,
      signBoard
    );
    return group;
  }

  if (type === 'fountain') {
    // Plaza Fountain (噴泉廣場): circular stone plaza, carved basin, shimmering water & tiered water spout
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(1.16, 26),
      new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.84, metalness: 0.04 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.009;
    plaza.receiveShadow = true;

    const stoneMat = getStdMat('#D6D2C9', 0.74, 0.05);
    const darkStoneMat = getStdMat('#8A8479', 0.8, 0.04);
    const waterMat = getRealisticWaterMaterial();

    const basinWall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.84, 0.9, 0.24, 24, 1, true),
      stoneMat
    );
    basinWall.position.y = 0.12;
    basinWall.castShadow = true;
    basinWall.receiveShadow = true;

    const basinRim = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.065, 10, 26), stoneMat);
    basinRim.rotation.x = Math.PI / 2;
    basinRim.position.y = 0.24;
    basinRim.castShadow = true;

    const basinFloor = new THREE.Mesh(new THREE.CircleGeometry(0.83, 24), darkStoneMat);
    basinFloor.rotation.x = -Math.PI / 2;
    basinFloor.position.y = 0.03;

    const waterPool = new THREE.Mesh(new THREE.CircleGeometry(0.81, 24), waterMat);
    waterPool.rotation.x = -Math.PI / 2;
    waterPool.position.y = 0.19;

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.56, 14), stoneMat);
    pedestal.position.y = 0.31;
    pedestal.castShadow = true;

    const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.16, 0.14, 18), stoneMat);
    upperBowl.position.y = 0.62;
    upperBowl.castShadow = true;

    const upperWater = new THREE.Mesh(new THREE.CircleGeometry(0.35, 18), waterMat);
    upperWater.rotation.x = -Math.PI / 2;
    upperWater.position.y = 0.695;

    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.24, 10), stoneMat);
    finial.position.y = 0.8;

    // Translucent water spray plume & 4 arching water streams
    const sprayMat = new THREE.MeshPhysicalMaterial({
      color: '#E0F2FE',
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.62,
    });
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 12), sprayMat);
    plume.position.y = 1.04;
    plume.rotation.x = Math.PI;
    group.add(plume);

    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.034, 0.48, 8), sprayMat);
      jet.position.set(Math.cos(ang) * 0.28, 0.48, Math.sin(ang) * 0.28);
      jet.rotation.z = -Math.cos(ang) * 0.55;
      jet.rotation.x = Math.sin(ang) * 0.55;
      group.add(jet);
    }

    group.add(
      plaza,
      basinWall,
      basinRim,
      basinFloor,
      waterPool,
      pedestal,
      upperBowl,
      upperWater,
      finial
    );
    return group;
  }

  if (type === 'restroom') {
    // Park Restroom (園區洗手間): clean stone apron, cream & cedar dual-entry building, pitched green roof & clear signage
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.06, 22),
      new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.86, metalness: 0.02 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.008;
    pad.receiveShadow = true;

    const wallMat = getStdMat('#F3EFE6', 0.72, 0.02);
    const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.76, metalness: 0.03 });
    const doorMat = getStdMat('#475569', 0.55, 0.12);
    const roofMat = getStdMat('#3A6B52', 0.72, 0.04);

    const mainBox = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.74, 0.76), wallMat);
    mainBox.position.set(0, 0.38, -0.06);
    mainBox.castShadow = true;
    mainBox.receiveShadow = true;

    const timberBand = new THREE.Mesh(new THREE.BoxGeometry(1.19, 0.22, 0.79), woodMat);
    timberBand.position.set(0, 0.12, -0.06);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.12, 0.96), roofMat);
    roof.position.set(0, 0.81, -0.04);
    roof.castShadow = true;

    // Two entrance doors with crisp sky-blue & rose signage plaques
    const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.05), doorMat);
    leftDoor.position.set(-0.27, 0.25, 0.33);
    const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.05), doorMat);
    rightDoor.position.set(0.27, 0.25, 0.33);

    const blueSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.14, 0.04),
      getStdMat('#0284C7', 0.42, 0.08)
    );
    blueSign.position.set(-0.27, 0.58, 0.34);

    const roseSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.14, 0.04),
      getStdMat('#E11D48', 0.42, 0.08)
    );
    roseSign.position.set(0.27, 0.58, 0.34);

    const lampMat = new THREE.MeshStandardMaterial({
      color: '#FEF3C7',
      emissive: '#FBBF24',
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const centerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), lampMat);
    centerLamp.position.set(0, 0.62, 0.35);

    const shrubMat = getStdMat('#2D6E3E', 0.84, 0.02);
    for (const sx of [-0.56, 0.56]) {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), shrubMat);
      bush.position.set(sx, 0.12, 0.34);
      bush.castShadow = true;
      group.add(bush);
    }

    group.add(pad, mainBox, timberBand, roof, leftDoor, rightDoor, blueSign, roseSign, centerLamp);
    return group;
  }

  if (type === 'pavilion') {
    // Scenic Pavilion (觀景涼亭): octagonal timber deck, 4 cedar pillars, hipped dark-green roof, interior benches & warm lantern
    const deckMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.78, metalness: 0.03 });
    const stoneMat = getStdMat('#9E9689', 0.84, 0.03);
    const pillarMat = getStdMat('#5C3D24', 0.74, 0.05);
    const roofMat = getStdMat('#24543B', 0.7, 0.05);

    const stoneBase = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.08, 0.08, 8), stoneMat);
    stoneBase.position.y = 0.04;
    stoneBase.receiveShadow = true;

    const timberDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.96, 0.07, 8), deckMat);
    timberDeck.position.y = 0.11;
    timberDeck.receiveShadow = true;

    // 4 sturdy corner pillars
    const pillarOffsets: Array<[number, number]> = [
      [-0.56, -0.56],
      [0.56, -0.56],
      [-0.56, 0.56],
      [0.56, 0.56],
    ];
    for (const [px, pz] of pillarOffsets) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.96, 8), pillarMat);
      post.position.set(px, 0.62, pz);
      post.castShadow = true;
      group.add(post);
    }

    // Interior resting benches on left & right sides
    for (const bx of [-0.42, 0.42]) {
      const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.74), deckMat);
      benchSeat.position.set(bx, 0.32, 0);
      benchSeat.castShadow = true;
      group.add(benchSeat);
    }

    // Back wooden railing bar
    const backRail = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.05, 0.05), pillarMat);
    backRail.position.set(0, 0.46, -0.56);

    // Hipped pagoda-inspired roof & brass finial
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.12, 0.48, 4), roofMat);
    roof.position.y = 1.3;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;

    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 10),
      getStdMat('#D97706', 0.3, 0.75)
    );
    finial.position.y = 1.56;

    // Warm hanging lantern inside pavilion
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.055, 0.14, 8),
      new THREE.MeshStandardMaterial({
        color: '#FEF3C7',
        emissive: '#F59E0B',
        emissiveIntensity: 0.55,
        roughness: 0.25,
      })
    );
    lantern.position.y = 0.98;

    group.add(stoneBase, timberDeck, backRail, roof, finial, lantern);
    return group;
  }

  // garden (round natural stone flowerbed)
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.74, 0.82, 0.14, 18),
    getStdMat('#8C857B', 0.88, 0.03)
  );
  rim.position.y = 0.07;
  rim.receiveShadow = true;

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 0.16, 18),
    getStdMat('#4D6F28', 0.92, 0.0)
  );
  soil.position.y = 0.08;

  const centerBush = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.3, 1),
    getStdMat('#2D6E3E', 0.84, 0.02)
  );
  centerBush.position.set(0, 0.32, 0);
  centerBush.castShadow = true;

  const flowerCols = ['#D95B6D', '#E8B84B', '#DF7AA1', '#8E6BC9', '#E0864F'];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.09, 0),
      getStdMat(flowerCols[i % flowerCols.length], 0.6, 0.03)
    );
    petal.position.set(Math.cos(ang) * 0.44, 0.22, Math.sin(ang) * 0.44);
    group.add(petal);
  }

  group.add(rim, soil, centerBush);
  return group;
}

export interface HabitatCollider {
  x: number;
  z: number;
  r: number;
}

/**
 * Local-space colliders for solid props & water basins inside each species' expanded habitat
 * so animals steer around rocks, tree trunks, bamboo, tubs, icebergs, and pools.
 */
function getBaseHabitatPropColliders(speciesId: SpeciesId): HabitatCollider[] {
  switch (speciesId) {
    case 'lion':
      return [
        { x: -0.18, z: -0.58, r: 0.36 },
        { x: 0.45, z: -0.56, r: 0.28 },
        { x: -0.46, z: -0.34, r: 0.24 },
        { x: 0.56, z: -0.25, r: 0.16 },
      ];
    case 'panda':
      return [
        { x: -0.22, z: -0.46, r: 0.34 },
        { x: 0.54, z: -0.48, r: 0.26 },
        { x: -0.62, z: -0.52, r: 0.18 },
      ];
    case 'tiger':
      return [
        { x: 0.36, z: -0.38, r: 0.3 },
        { x: -0.46, z: -0.52, r: 0.28 },
        { x: -0.6, z: -0.38, r: 0.16 },
      ];
    case 'giraffe':
      return [
        { x: 0.56, z: -0.56, r: 0.22 },
        { x: -0.54, z: -0.5, r: 0.22 },
      ];
    case 'zebra':
      return [
        { x: -0.48, z: -0.48, r: 0.3 },
        { x: 0.54, z: -0.54, r: 0.2 },
      ];
    case 'elephant':
      return [
        { x: -0.38, z: -0.38, r: 0.32 },
        { x: 0.56, z: -0.56, r: 0.22 },
      ];
    case 'hippo':
      return [
        { x: -0.08, z: -0.18, r: 0.36 },
        { x: 0.54, z: -0.54, r: 0.26 },
      ];
    case 'red_panda':
      return [
        { x: 0.37, z: -0.55, r: 0.26 },
        { x: -0.54, z: -0.48, r: 0.2 },
      ];
    case 'koala':
      return [
        { x: -0.48, z: -0.48, r: 0.24 },
        { x: 0.5, z: -0.5, r: 0.2 },
      ];
    case 'penguin':
      return [
        { x: 0.32, z: -0.32, r: 0.36 },
        { x: -0.46, z: -0.5, r: 0.28 },
      ];
    case 'seal':
      return [
        { x: -0.15, z: -0.25, r: 0.38 },
        { x: 0.5, z: -0.5, r: 0.28 },
      ];
    case 'capybara':
      return [
        { x: -0.42, z: -0.42, r: 0.36 },
        { x: 0.52, z: -0.52, r: 0.18 },
      ];
    case 'toucan':
      return [
        { x: 0.56, z: -0.56, r: 0.22 },
        { x: -0.52, z: -0.48, r: 0.18 },
      ];
    case 'flamingo':
      return [
        { x: 0.05, z: -0.2, r: 0.34 },
        { x: -0.5, z: -0.56, r: 0.2 },
      ];
    case 'cheetah':
      return [
        { x: -0.44, z: -0.48, r: 0.28 },
        { x: 0.5, z: -0.42, r: 0.2 },
      ];
    case 'meerkat':
      return [
        { x: -0.42, z: -0.48, r: 0.26 },
        { x: 0.48, z: -0.5, r: 0.22 },
      ];
    case 'kangaroo':
      return [
        { x: -0.46, z: -0.48, r: 0.3 },
        { x: 0.54, z: -0.52, r: 0.22 },
      ];
    case 'peacock':
      return [
        { x: -0.5, z: -0.5, r: 0.24 },
        { x: 0.52, z: -0.48, r: 0.24 },
      ];
    case 'polar_bear':
      return [
        { x: -0.34, z: -0.36, r: 0.38 },
        { x: 0.42, z: -0.36, r: 0.36 },
      ];
    case 'otter':
      return [
        { x: -0.18, z: -0.28, r: 0.36 },
        { x: 0.52, z: -0.5, r: 0.22 },
      ];
  }
}

export function getHabitatPropColliders(speciesId: SpeciesId): HabitatCollider[] {
  return getBaseHabitatPropColliders(speciesId).map((c) => ({
    x: c.x * HABITAT_PROP_SCALE,
    z: c.z * HABITAT_PROP_SCALE,
    r: c.r * 1.26,
  }));
}

/**
 * Non-blocky organic 3D enclosure per animal species (14 species)
 * Blends softly into continuous grass via biome-authentic ground texture + natural habitat props
 */
export function buildHabitatZoneMesh(
  speciesId: SpeciesId,
  level: 1 | 2 | 3,
  maxAnisotropy = 4,
  automation?: {
    autoFeeder?: boolean;
    autoFeederEnabled?: boolean;
    autoCleaner?: boolean;
    autoCleanerEnabled?: boolean;
  }
): THREE.Group {
  const spec = ANIMAL_SPECIES[speciesId];
  const group = new THREE.Group();
  const woodTex = getWoodTexture(maxAnisotropy);
  const barkMat = new THREE.MeshStandardMaterial({
    map: getBarkTexture(maxAnisotropy),
    roughness: 0.9,
    metalness: 0.02,
  });

  // Biome-authentic ground surface texture feathered into surrounding park meadow
  const softAlpha = getSoftGroundAlphaTexture();
  const isArctic = speciesId === 'penguin' || speciesId === 'seal' || speciesId === 'polar_bear';
  const isSavanna =
    speciesId === 'lion' ||
    speciesId === 'cheetah' ||
    speciesId === 'giraffe' ||
    speciesId === 'zebra' ||
    speciesId === 'elephant' ||
    speciesId === 'meerkat' ||
    speciesId === 'kangaroo';
  const isWetland =
    speciesId === 'hippo' ||
    speciesId === 'capybara' ||
    speciesId === 'otter' ||
    speciesId === 'flamingo';

  const groundTex = isArctic
    ? getArcticSnowTexture(maxAnisotropy)
    : isSavanna
    ? getSavannaGroundTexture(maxAnisotropy)
    : isWetland
    ? getWetlandMudTexture(maxAnisotropy)
    : getForestFloorTexture(maxAnisotropy);

  const groundBlendMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    color: isArctic ? '#FFFFFF' : spec.groundColor,
    alphaMap: softAlpha,
    transparent: true,
    opacity: isArctic ? 0.98 : isSavanna ? 0.88 : 0.86,
    depthWrite: false,
    roughness: isArctic ? 0.45 : isWetland ? 0.78 : 0.92,
    metalness: 0.02,
  });
  const groundBlend = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_SIZE * 1.1, TILE_SIZE * 1.1),
    groundBlendMat
  );
  groundBlend.rotation.x = -Math.PI / 2;
  groundBlend.position.y = 0.005;
  groundBlend.receiveShadow = true;
  group.add(groundBlend);

  // Realistic expanded perimeter boundary (grows slightly larger with habitat upgrades!)
  const fenceMat = new THREE.MeshStandardMaterial({
    color: spec.fenceColor,
    map: woodTex,
    roughness: 0.78,
    metalness: 0.05,
  });
  const steelPostMat = getStdMat('#525860', 0.42, 0.55);
  const glassMat = getGlassBarrierMat();
  const half = TILE_SIZE * (0.465 + (level - 1) * 0.012);
  const span = half * 1.96;
  const corners: Array<[number, number]> = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];

  const postHeight = 0.24 + (level - 1) * 0.04;
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.042, postHeight, 8),
      speciesId === 'lion' ||
      speciesId === 'tiger' ||
      speciesId === 'cheetah' ||
      isArctic
        ? steelPostMat
        : fenceMat
    );
    post.position.set(cx, postHeight / 2, cz);
    post.castShadow = true;
    group.add(post);
  }

  const hasGlassFront =
    speciesId === 'lion' ||
    speciesId === 'tiger' ||
    speciesId === 'cheetah' ||
    speciesId === 'panda' ||
    speciesId === 'penguin' ||
    speciesId === 'seal' ||
    speciesId === 'polar_bear' ||
    speciesId === 'hippo';

  if (hasGlassFront) {
    const glassFront = new THREE.Mesh(new THREE.BoxGeometry(span, 0.24, 0.018), glassMat);
    glassFront.position.set(0, 0.13, half);
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(span + 0.04, 0.045, 0.06),
      getStdMat('#8B857A', 0.88, 0.03)
    );
    curb.position.set(0, 0.022, half);
    group.add(glassFront, curb);

    for (const sx of [-half, half]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, span, 6), steelPostMat);
      cable.rotation.x = Math.PI / 2;
      cable.position.set(sx, 0.2, 0);
      group.add(cable);
    }
    const backCable = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, span, 6), steelPostMat);
    backCable.rotation.z = Math.PI / 2;
    backCable.position.set(0, 0.2, -half);
    group.add(backCable);
  } else {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, span, 6), fenceMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.2, half);
    const backRail = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, span, 6), fenceMat);
    backRail.rotation.z = Math.PI / 2;
    backRail.position.set(0, 0.2, -half);
    group.add(rail, backRail);
    for (const sx of [-half, half]) {
      const sideRail = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, span, 6), fenceMat);
      sideRail.rotation.x = Math.PI / 2;
      sideRail.position.set(sx, 0.2, 0);
      group.add(sideRail);
    }
  }

  const waterMat = getRealisticWaterMaterial();
  const propsGroup = new THREE.Group();
  propsGroup.scale.set(HABITAT_PROP_SCALE, 1.16, HABITAT_PROP_SCALE);
  group.add(propsGroup);

  // Helper for wetland reeds / savanna dry shrubs
  const addReedCluster = (rx: number, rz: number, color: string, stalks = 5) => {
    const mat = getStdMat(color, 0.84, 0.01);
    const tipMat = getStdMat('#6E4726', 0.88, 0.01);
    for (let i = 0; i < stalks; i++) {
      const ang = (i / stalks) * Math.PI * 2;
      const h = 0.24 + (i % 3) * 0.07;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 5), mat);
      const sx = rx + Math.cos(ang) * 0.05;
      const sz = rz + Math.sin(ang) * 0.05;
      stalk.position.set(sx, h / 2, sz);
      stalk.rotation.z = Math.cos(ang) * 0.14;
      stalk.rotation.x = Math.sin(ang) * 0.14;
      propsGroup.add(stalk);
      if (i % 2 === 0) {
        const cattail = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.06, 6), tipMat);
        cattail.position.set(sx, h * 0.84, sz);
        propsGroup.add(cattail);
      }
    }
  };

  if (speciesId === 'lion') {
    // Savanna sandstone kopje outcrop + basking ledge + fallen acacia log + dry savanna tufts
    const sandstone = getStdMat('#B39162', 0.9, 0.02);
    const sandstoneDark = getStdMat('#8C6E48', 0.9, 0.02);
    const rockBack = makeOrganicRock(0.36, sandstone, 3);
    rockBack.scale.set(1.75, 0.85, 0.72);
    rockBack.position.set(-0.18, 0.22, -0.58);
    const rockSide = makeOrganicRock(0.26, sandstoneDark, 7);
    rockSide.scale.set(1.2, 0.9, 0.85);
    rockSide.position.set(0.45, 0.18, -0.56);
    const rockBasking = makeOrganicRock(0.24, sandstone, 11);
    rockBasking.scale.set(1.3, 0.32, 1.0);
    rockBasking.position.set(-0.46, 0.06, -0.34);
    const dryLog = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.06, 0.42, 7), barkMat);
    dryLog.rotation.z = Math.PI / 2;
    dryLog.rotation.y = 0.4;
    dryLog.position.set(0.56, 0.05, -0.25);
    dryLog.castShadow = true;
    propsGroup.add(rockBack, rockSide, rockBasking, dryLog);
    addReedCluster(0.62, -0.55, '#B79C52', 6);
  } else if (speciesId === 'panda') {
    // Bamboo forest floor + crossed climbing timber + lush bamboo groves + mossy stone
    const logMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.86, metalness: 0.02 });
    const postA = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.84, 8), barkMat);
    postA.position.set(-0.36, 0.38, -0.48);
    postA.rotation.z = -0.22;
    postA.castShadow = true;
    const postB = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.84, 8), barkMat);
    postB.position.set(-0.08, 0.38, -0.48);
    postB.rotation.z = 0.24;
    postB.castShadow = true;
    const crossBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.72, 8), logMat);
    crossBeam.rotation.z = Math.PI / 2;
    crossBeam.position.set(-0.22, 0.44, -0.48);
    crossBeam.castShadow = true;
    const topPost = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.65, 8), barkMat);
    topPost.position.set(-0.22, 0.32, -0.28);
    topPost.rotation.x = -0.28;
    propsGroup.add(postA, postB, crossBeam, topPost);

    const bambooMat = getStdMat('#2A7A3B', 0.62, 0.03);
    const leafMat = getStdMat('#3C9A4B', 0.76, 0.02);
    const stalks = [
      [0.48, -0.58, 0.96],
      [0.62, -0.48, 1.12],
      [0.54, -0.34, 0.82],
      [-0.64, -0.52, 0.92],
      [0.38, -0.56, 0.76],
    ];
    for (const [bx, bz, bh] of stalks) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, bh, 8), bambooMat);
      stalk.position.set(bx, bh / 2, bz);
      stalk.castShadow = true;
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), leafMat);
      foliage.scale.set(1.15, 0.72, 1.15);
      foliage.position.set(bx, bh, bz);
      foliage.castShadow = true;
      propsGroup.add(stalk, foliage);
    }
  } else if (speciesId === 'tiger') {
    const mossStone = getStdMat('#5F6B5B', 0.88, 0.03);
    const creek = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), waterMat);
    creek.rotation.x = -Math.PI / 2;
    creek.position.set(0.36, 0.012, -0.38);
    const rock = makeOrganicRock(0.28, mossStone, 21);
    rock.scale.set(1.4, 0.72, 1.0);
    rock.position.set(-0.46, 0.14, -0.52);
    const bambooMat = getStdMat('#2D7A3E', 0.65, 0.03);
    const leafMat = getStdMat('#3A8D4C', 0.75, 0.02);
    for (const [bx, bz, bh] of [
      [-0.62, -0.38, 0.85],
      [-0.56, -0.62, 1.02],
      [-0.66, -0.5, 0.72],
    ]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, bh, 7), bambooMat);
      stalk.position.set(bx, bh / 2, bz);
      stalk.castShadow = true;
      const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 1), leafMat);
      cap.position.set(bx, bh, bz);
      propsGroup.add(stalk, cap);
    }
    addReedCluster(0.62, -0.54, '#3D7A44', 5);
    propsGroup.add(creek, rock);
  } else if (speciesId === 'giraffe') {
    // Tall umbrella acacia tree + termite-style red-ochre savanna mound
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.1, 1.08, 9), barkMat);
    trunk.position.set(0.56, 0.54, -0.56);
    trunk.rotation.z = 0.06;
    trunk.castShadow = true;

    const canopyMat = getStdMat('#4D7C0F', 0.84, 0.02);
    const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 1), canopyMat);
    c1.scale.set(1.32, 0.3, 1.18);
    c1.position.set(0.54, 1.08, -0.56);
    c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), getStdMat('#65A30D', 0.82, 0.02));
    c2.scale.set(1.18, 0.3, 1.0);
    c2.position.set(0.3, 1.0, -0.44);
    c2.castShadow = true;

    const termiteMound = makeOrganicRock(0.18, getStdMat('#9C6644', 0.92, 0.01), 9);
    termiteMound.scale.set(0.9, 1.75, 0.9);
    termiteMound.position.set(-0.54, 0.16, -0.5);
    propsGroup.add(trunk, c1, c2, termiteMound);
    addReedCluster(-0.4, -0.58, '#B89B4E', 5);
  } else if (speciesId === 'zebra') {
    const stoneMat = getStdMat('#78716C', 0.88, 0.04);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const pebble = makeOrganicRock(0.095, stoneMat, i);
      pebble.position.set(-0.48 + Math.cos(ang) * 0.28, 0.04, -0.48 + Math.sin(ang) * 0.28);
      propsGroup.add(pebble);
    }
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(-0.48, 0.012, -0.48);
    const dryRock = makeOrganicRock(0.2, getStdMat('#9E8B6C', 0.9, 0.02), 12);
    dryRock.scale.set(1.2, 0.65, 1.0);
    dryRock.position.set(0.54, 0.08, -0.54);
    addReedCluster(0.58, -0.34, '#C2A353', 6);
    propsGroup.add(water, dryRock);
  } else if (speciesId === 'elephant') {
    const mudPool = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), waterMat);
    mudPool.rotation.x = -Math.PI / 2;
    mudPool.position.set(-0.38, 0.012, -0.38);
    const treeTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, 0.85, 8), barkMat);
    treeTrunk.position.set(0.56, 0.42, -0.56);
    treeTrunk.castShadow = true;
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), getStdMat('#5C7A32', 0.86, 0.02));
    crown.scale.set(1.2, 0.52, 1.1);
    crown.position.set(0.56, 0.9, -0.56);
    crown.castShadow = true;
    const boulder = makeOrganicRock(0.18, getStdMat('#8B7B65', 0.9, 0.02), 15);
    boulder.position.set(0.24, 0.08, -0.58);
    propsGroup.add(mudPool, treeTrunk, crown, boulder);
  } else if (speciesId === 'hippo') {
    const riverPool = new THREE.Mesh(new THREE.CircleGeometry(0.62, 22), waterMat);
    riverPool.rotation.x = -Math.PI / 2;
    riverPool.position.set(-0.08, 0.012, -0.18);
    const stoneMat = getStdMat('#737373', 0.88, 0.03);
    const bankRock = makeOrganicRock(0.26, stoneMat, 33);
    bankRock.scale.set(1.4, 0.55, 0.95);
    bankRock.position.set(0.54, 0.1, -0.54);
    addReedCluster(-0.62, -0.42, '#4A7C3D', 6);
    addReedCluster(0.56, -0.25, '#4A7C3D', 4);
    propsGroup.add(riverPool, bankRock);
  } else if (speciesId === 'red_panda') {
    const logMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.82, metalness: 0.03 });
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.052, 0.56, 8), logMat);
    post1.position.set(0.52, 0.28, -0.55);
    const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.052, 0.56, 8), logMat);
    post2.position.set(0.22, 0.28, -0.55);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.065, 0.26), logMat);
    deck.position.set(0.37, 0.56, -0.55);
    deck.castShadow = true;
    const maple = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 1), getStdMat('#C25A22', 0.8, 0.02));
    maple.position.set(0.58, 0.78, -0.58);
    maple.castShadow = true;
    const mossRock = makeOrganicRock(0.18, getStdMat('#636D5E', 0.9, 0.02), 25);
    mossRock.position.set(-0.54, 0.08, -0.48);
    addReedCluster(-0.62, -0.62, '#347A40', 4);
    propsGroup.add(post1, post2, deck, maple, mossRock);
  } else if (speciesId === 'koala') {
    // Australian red-sandstone & pale-bark eucalyptus tree
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.095, 0.95, 8), getStdMat('#B4ACA2', 0.84, 0.02));
    trunk.position.set(-0.48, 0.47, -0.48);
    trunk.castShadow = true;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.048, 0.55, 7), getStdMat('#B4ACA2', 0.84, 0.02));
    branch.position.set(-0.28, 0.62, -0.42);
    branch.rotation.z = -0.65;
    const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 1), getStdMat('#5F8267', 0.84, 0.02));
    canopy.scale.set(1.1, 0.72, 1.0);
    canopy.position.set(-0.45, 0.96, -0.48);
    canopy.castShadow = true;
    const redRock = makeOrganicRock(0.18, getStdMat('#A45D44', 0.9, 0.02), 18);
    redRock.scale.set(1.2, 0.65, 0.9);
    redRock.position.set(0.5, 0.07, -0.5);
    propsGroup.add(trunk, branch, canopy, redRock);
  } else if (speciesId === 'penguin') {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.46, 18), waterMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0.32, 0.015, -0.32);
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: '#E0F2FE',
      roughness: 0.18,
      metalness: 0.04,
      clearcoat: 0.8,
    });
    const berg1 = makeOrganicRock(0.28, iceMat, 11);
    berg1.scale.set(1.0, 1.35, 0.9);
    berg1.position.set(-0.48, 0.2, -0.5);
    const berg2 = makeOrganicRock(0.2, iceMat, 14);
    berg2.position.set(-0.24, 0.12, -0.56);
    const iceShelf = makeOrganicRock(0.22, getStdMat('#BAE6FD', 0.35, 0.04), 16);
    iceShelf.scale.set(1.3, 0.28, 0.9);
    iceShelf.position.set(-0.42, 0.04, -0.26);
    propsGroup.add(pool, berg1, berg2, iceShelf);
  } else if (speciesId === 'seal') {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.56, 22), waterMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-0.15, 0.015, -0.25);
    const rockMat = getStdMat('#5F6C7B', 0.82, 0.06);
    const rock = makeOrganicRock(0.26, rockMat, 19);
    rock.scale.set(1.35, 0.62, 1.0);
    rock.position.set(0.5, 0.13, -0.5);
    const rock2 = makeOrganicRock(0.16, rockMat, 22);
    rock2.scale.set(1.2, 0.45, 0.9);
    rock2.position.set(0.28, 0.06, -0.58);
    propsGroup.add(pool, rock, rock2);
  } else if (speciesId === 'capybara') {
    const tubWood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72, metalness: 0.04 });
    const tubWall = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 10, 18), tubWood);
    tubWall.rotation.x = Math.PI / 2;
    tubWall.position.set(-0.42, 0.08, -0.42);
    tubWall.castShadow = true;
    const warmWater = new THREE.Mesh(new THREE.CircleGeometry(0.31, 16), waterMat);
    warmWater.rotation.x = -Math.PI / 2;
    warmWater.position.set(-0.42, 0.075, -0.42);
    const yuzuMat = getStdMat('#F97316', 0.35, 0.06);
    const yuzu1 = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), yuzuMat);
    yuzu1.position.set(-0.32, 0.1, -0.46);
    const yuzu2 = yuzu1.clone();
    yuzu2.position.set(-0.5, 0.1, -0.36);
    const stone = makeOrganicRock(0.16, getStdMat('#7B7872', 0.88, 0.02), 30);
    stone.scale.set(1.2, 0.6, 0.9);
    stone.position.set(0.52, 0.06, -0.52);
    addReedCluster(0.62, -0.34, '#4F7A42', 5);
    propsGroup.add(tubWall, warmWater, yuzu1, yuzu2, stone);
  } else if (speciesId === 'toucan') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.075, 0.94, 8), barkMat);
    trunk.position.set(0.56, 0.47, -0.56);
    trunk.castShadow = true;
    const frondMat = getStdMat('#1A7A68', 0.74, 0.03);
    for (let i = 0; i < 5; i++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.032, 0.15), frondMat);
      const ang = (i / 5) * Math.PI * 2 + 0.3;
      frond.position.set(0.56 + Math.cos(ang) * 0.24, 0.94, -0.56 + Math.sin(ang) * 0.24);
      frond.rotation.y = -ang;
      frond.rotation.z = -0.26;
      frond.castShadow = true;
      propsGroup.add(frond);
    }
    const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), barkMat);
    perch.rotation.z = Math.PI / 2;
    perch.position.set(0.28, 0.42, -0.56);
    const fernBush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), getStdMat('#26734D', 0.82, 0.02));
    fernBush.scale.set(1.1, 0.65, 1.1);
    fernBush.position.set(-0.52, 0.1, -0.48);
    const flower = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6), getStdMat('#DC2626', 0.5, 0.04));
    flower.position.set(-0.46, 0.24, -0.46);
    propsGroup.add(trunk, perch, fernBush, flower);
  } else if (speciesId === 'flamingo') {
    const lagoon = new THREE.Mesh(new THREE.CircleGeometry(0.56, 22), waterMat);
    lagoon.rotation.x = -Math.PI / 2;
    lagoon.position.set(0.05, 0.012, -0.2);
    const sandStone = getStdMat('#D6C8B4', 0.85, 0.02);
    for (let i = 0; i < 4; i++) {
      const pebble = makeOrganicRock(0.11, sandStone, 40 + i);
      pebble.scale.set(1.2, 0.55, 1.0);
      pebble.position.set(-0.52 + i * 0.28, 0.04, -0.62 + (i % 2) * 0.14);
      propsGroup.add(pebble);
    }
    addReedCluster(-0.56, -0.46, '#537D46', 6);
    propsGroup.add(lagoon);
  } else if (speciesId === 'cheetah') {
    const lookoutRock = makeOrganicRock(0.28, getStdMat('#A8875A', 0.9, 0.02), 51);
    lookoutRock.scale.set(1.4, 0.72, 1.0);
    lookoutRock.position.set(-0.44, 0.12, -0.48);
    const fallenLog = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.58, 8), barkMat);
    fallenLog.rotation.z = Math.PI / 2;
    fallenLog.rotation.y = -0.35;
    fallenLog.position.set(0.5, 0.06, -0.42);
    fallenLog.castShadow = true;
    addReedCluster(0.56, -0.58, '#C4A858', 6);
    addReedCluster(-0.6, -0.26, '#B89B4E', 4);
    propsGroup.add(lookoutRock, fallenLog);
  } else if (speciesId === 'meerkat') {
    const moundMat = getStdMat('#9C6644', 0.92, 0.01);
    const termiteMound = makeOrganicRock(0.22, moundMat, 55);
    termiteMound.scale.set(1.0, 1.65, 1.0);
    termiteMound.position.set(-0.42, 0.16, -0.48);
    const sunRock = makeOrganicRock(0.2, getStdMat('#BA946C', 0.9, 0.02), 57);
    sunRock.scale.set(1.3, 0.45, 1.0);
    sunRock.position.set(0.48, 0.06, -0.5);
    const burrowHole = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 10),
      getStdMat('#2B1D12', 0.95, 0.0)
    );
    burrowHole.rotation.x = -Math.PI / 2;
    burrowHole.position.set(-0.18, 0.012, -0.58);
    addReedCluster(0.6, -0.34, '#C8AD62', 4);
    propsGroup.add(termiteMound, sunRock, burrowHole);
  } else if (speciesId === 'kangaroo') {
    const redRockMat = getStdMat('#A45338', 0.9, 0.02);
    const uluruOutcrop = makeOrganicRock(0.28, redRockMat, 61);
    uluruOutcrop.scale.set(1.45, 0.8, 0.95);
    uluruOutcrop.position.set(-0.46, 0.14, -0.48);
    const scrubTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.055, 0.62, 7), barkMat);
    scrubTrunk.position.set(0.54, 0.31, -0.52);
    scrubTrunk.castShadow = true;
    const scrubCrown = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.26, 1),
      getStdMat('#6E8A42', 0.86, 0.02)
    );
    scrubCrown.scale.set(1.25, 0.48, 1.1);
    scrubCrown.position.set(0.54, 0.66, -0.52);
    scrubCrown.castShadow = true;
    addReedCluster(0.32, -0.6, '#C4A255', 5);
    propsGroup.add(uluruOutcrop, scrubTrunk, scrubCrown);
  } else if (speciesId === 'peacock') {
    const lanternStone = getStdMat('#8B867E', 0.86, 0.03);
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.24, 8), lanternStone);
    lanternBase.position.set(-0.5, 0.12, -0.5);
    lanternBase.castShadow = true;
    const lanternRoof = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.12, 6), lanternStone);
    lanternRoof.position.set(-0.5, 0.36, -0.5);
    const lanternCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.1, 0.09),
      getStdMat('#FDE68A', 0.4, 0.05)
    );
    lanternCore.position.set(-0.5, 0.27, -0.5);

    const blossomBush = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22, 1),
      getStdMat('#3F7E44', 0.82, 0.02)
    );
    blossomBush.position.set(0.52, 0.14, -0.48);
    blossomBush.castShadow = true;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const flower = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.06, 0),
        getStdMat(i % 2 === 0 ? '#F472B6' : '#FACC15', 0.55, 0.02)
      );
      flower.position.set(0.52 + Math.cos(a) * 0.16, 0.22, -0.48 + Math.sin(a) * 0.16);
      propsGroup.add(flower);
    }
    propsGroup.add(lanternBase, lanternRoof, lanternCore, blossomBush);
  } else if (speciesId === 'polar_bear') {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), waterMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0.42, 0.015, -0.36);
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: '#E6F4FE',
      roughness: 0.18,
      metalness: 0.04,
      clearcoat: 0.85,
    });
    const cliff = makeOrganicRock(0.32, iceMat, 71);
    cliff.scale.set(1.2, 1.35, 0.95);
    cliff.position.set(-0.34, 0.22, -0.36);
    const shelf = makeOrganicRock(0.24, getStdMat('#BAE6FD', 0.35, 0.04), 73);
    shelf.scale.set(1.35, 0.34, 1.0);
    shelf.position.set(-0.22, 0.06, -0.58);
    propsGroup.add(pool, cliff, shelf);
  } else if (speciesId === 'otter') {
    const riverPool = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), waterMat);
    riverPool.rotation.x = -Math.PI / 2;
    riverPool.position.set(-0.18, 0.014, -0.28);
    const bankRock = makeOrganicRock(0.2, getStdMat('#6B7068', 0.86, 0.03), 75);
    bankRock.scale.set(1.25, 0.55, 0.95);
    bankRock.position.set(0.52, 0.08, -0.5);
    const riverLog = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.058, 0.56, 8), barkMat);
    riverLog.rotation.z = Math.PI / 2;
    riverLog.rotation.y = 0.5;
    riverLog.position.set(0.22, 0.05, -0.55);
    riverLog.castShadow = true;
    addReedCluster(-0.62, -0.42, '#3C7A42', 5);
    addReedCluster(0.6, -0.32, '#4A884B', 4);
    propsGroup.add(riverPool, bankRock, riverLog);
  }

  if (automation?.autoFeeder) {
    const feederGroup = new THREE.Group();
    feederGroup.position.set(-half + 0.08, 0, half - 0.14);
    const bodyMat = getStdMat('#334155', 0.35, 0.72);
    const hopper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.14), bodyMat);
    hopper.position.y = 0.22;
    hopper.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.16), getStdMat('#15803D', 0.45, 0.2));
    cap.position.y = 0.36;
    const trough = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.12), getStdMat('#78716C', 0.75, 0.15));
    trough.position.set(0.06, 0.04, 0);
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 8, 6),
      new THREE.MeshStandardMaterial({
        color: automation.autoFeederEnabled ? '#34D399' : '#94A3B8',
        emissive: automation.autoFeederEnabled ? '#10B981' : '#000000',
        emissiveIntensity: automation.autoFeederEnabled ? 0.9 : 0,
      })
    );
    led.position.set(0.08, 0.28, 0.05);
    feederGroup.add(hopper, cap, trough, led);
    group.add(feederGroup);
  }

  if (automation?.autoCleaner) {
    const cleanerGroup = new THREE.Group();
    cleanerGroup.position.set(half - 0.08, 0, half - 0.14);
    const poleMat = getStdMat('#475569', 0.32, 0.78);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.36, 8), poleMat);
    mast.position.y = 0.18;
    mast.castShadow = true;
    const unit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), getStdMat('#0284C7', 0.4, 0.35));
    unit.position.y = 0.36;
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.07, 6), poleMat);
    nozzle.rotation.z = Math.PI / 3;
    nozzle.position.set(-0.06, 0.37, 0);
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 8, 6),
      new THREE.MeshStandardMaterial({
        color: automation.autoCleanerEnabled ? '#38BDF8' : '#94A3B8',
        emissive: automation.autoCleanerEnabled ? '#0EA5E9' : '#000000',
        emissiveIntensity: automation.autoCleanerEnabled ? 0.9 : 0,
      })
    );
    led.position.set(0, 0.42, 0.04);
    cleanerGroup.add(mast, unit, nozzle, led);
    group.add(cleanerGroup);
  }

  return group;
}

const seasonalPatchGeo = new THREE.CircleGeometry(0.16, 8);
const seasonalTinyPetalGeo = new THREE.CircleGeometry(0.055, 5);
const seasonalSnowMoundGeo = new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);

export function shouldShowSeasonalTileEffect(
  x: number,
  y: number,
  tileType: TileType,
  seasonalEvent: SeasonalEventId | null
): boolean {
  if (!seasonalEvent) return false;
  const h = Math.abs((x * 73 + y * 139 + seasonalEvent.charCodeAt(0) * 19) % 10);
  if (
    tileType === 'garden' ||
    tileType === 'pavilion' ||
    tileType === 'fountain' ||
    tileType === 'bench' ||
    tileType === 'landmark' ||
    tileType === 'gate'
  ) {
    return h < 8;
  }
  if (tileType === 'path') {
    return h < 6;
  }
  if (tileType === 'grass') {
    return h < 4;
  }
  if (tileType === 'habitat') {
    return h < 4;
  }
  return h < 5;
}

export function buildSeasonalTileOverlay(
  eventId: SeasonalEventId,
  tileType: TileType,
  gx: number,
  gy: number
): THREE.Group {
  const group = new THREE.Group();
  let seed = (gx * 92821 + gy * 68917 + eventId.charCodeAt(0) * 313) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const isRimOnly = tileType === 'habitat' || tileType === 'snack' || tileType === 'souvenir' || tileType === 'restroom';
  const pickPos = (): [number, number] => {
    if (isRimOnly) {
      const edge = TILE_SIZE * 0.43;
      const side = Math.floor(rand() * 4);
      const along = (rand() - 0.5) * TILE_SIZE * 0.72;
      if (side === 0) return [along, -edge];
      if (side === 1) return [along, edge];
      if (side === 2) return [-edge, along];
      return [edge, along];
    }
    return [(rand() - 0.5) * TILE_SIZE * 0.76, (rand() - 0.5) * TILE_SIZE * 0.76];
  };

  if (eventId === 'spring_sakura') {
    const sakuraMats = [
      getStdMat('#F9A8D4', 0.68, 0.02),
      getStdMat('#FBCFE8', 0.65, 0.02),
      getStdMat('#F472B6', 0.72, 0.02),
    ];
    for (const m of sakuraMats) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -1;
    }

    const petalCount = isRimOnly ? 8 : tileType === 'garden' ? 16 : 12;
    for (let i = 0; i < petalCount; i++) {
      const [px, pz] = pickPos();
      const mat = sakuraMats[i % sakuraMats.length];
      const patch = new THREE.Mesh(i % 3 === 0 ? seasonalPatchGeo : seasonalTinyPetalGeo, mat);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = rand() * Math.PI * 2;
      const sx = 0.65 + rand() * 0.9;
      const sy = 0.55 + rand() * 0.85;
      patch.scale.set(sx, sy, 1);
      patch.position.set(px, 0.017 + (i % 3) * 0.001, pz);
      patch.receiveShadow = true;
      group.add(patch);
    }

    // Add small sakura blossom bough / cluster on grass & garden corner
    if (tileType === 'grass' || tileType === 'garden' || tileType === 'bench') {
      const cornerX = (rand() > 0.5 ? 1 : -1) * 0.92;
      const cornerZ = (rand() > 0.5 ? 1 : -1) * 0.92;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.055, 0.42, 6),
        getStdMat('#5C4033', 0.88, 0.02)
      );
      trunk.position.set(cornerX, 0.21, cornerZ);
      trunk.castShadow = true;
      group.add(trunk);

      const blossomMat = getStdMat('#F9A8D4', 0.76, 0.02);
      for (let b = 0; b < 3; b++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + b * 0.02, 1), blossomMat);
        puff.position.set(
          cornerX + (b - 1) * 0.09,
          0.44 + (b % 2) * 0.06,
          cornerZ + (b === 1 ? 0.07 : -0.05)
        );
        puff.castShadow = true;
        group.add(puff);
      }
    }
  } else if (eventId === 'winter_snow') {
    const snowMat = getStdMat('#F1F5F9', 0.9, 0.02);
    const frostMat = getStdMat('#E0EFFB', 0.85, 0.04);
    snowMat.polygonOffset = true;
    snowMat.polygonOffsetFactor = -1;
    snowMat.polygonOffsetUnits = -1;
    frostMat.polygonOffset = true;
    frostMat.polygonOffsetFactor = -1;
    frostMat.polygonOffsetUnits = -1;

    const driftCount = isRimOnly ? 5 : 8;
    for (let i = 0; i < driftCount; i++) {
      const [px, pz] = pickPos();
      const drift = new THREE.Mesh(seasonalSnowMoundGeo, i % 2 === 0 ? snowMat : frostMat);
      drift.position.set(px, 0.006, pz);
      drift.scale.set(0.85 + rand() * 0.95, 0.22 + rand() * 0.2, 0.75 + rand() * 0.95);
      drift.rotation.y = rand() * Math.PI * 2;
      drift.receiveShadow = true;
      group.add(drift);
    }

    if (tileType === 'path' || tileType === 'gate') {
      // Soft frosted corner crust
      for (const sx of [-1, 1]) {
        const cornerPatch = new THREE.Mesh(seasonalPatchGeo, snowMat);
        cornerPatch.rotation.x = -Math.PI / 2;
        cornerPatch.scale.set(2.2, 1.5, 1);
        cornerPatch.position.set(sx * 0.88, 0.016, (rand() > 0.5 ? 1 : -1) * 0.86);
        cornerPatch.receiveShadow = true;
        group.add(cornerPatch);
      }
    }
  } else if (eventId === 'autumn_maple') {
    const mapleMats = [
      getStdMat('#DC2626', 0.75, 0.02),
      getStdMat('#EA580C', 0.78, 0.02),
      getStdMat('#D97706', 0.76, 0.02),
    ];
    for (const m of mapleMats) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -1;
    }

    const leafCount = isRimOnly ? 8 : 13;
    for (let i = 0; i < leafCount; i++) {
      const [px, pz] = pickPos();
      const leaf = new THREE.Mesh(
        i % 3 === 0 ? seasonalPatchGeo : seasonalTinyPetalGeo,
        mapleMats[i % mapleMats.length]
      );
      leaf.rotation.x = -Math.PI / 2;
      leaf.rotation.z = rand() * Math.PI * 2;
      leaf.scale.set(0.75 + rand() * 0.85, 0.65 + rand() * 0.75, 1);
      leaf.position.set(px, 0.017 + (i % 3) * 0.001, pz);
      leaf.receiveShadow = true;
      group.add(leaf);
    }
  } else if (eventId === 'summer_lantern') {
    const glowMat = getStdMat('#FDE047', 0.55, 0.05);
    glowMat.polygonOffset = true;
    glowMat.polygonOffsetFactor = -1;
    glowMat.polygonOffsetUnits = -1;
    for (let i = 0; i < 6; i++) {
      const [px, pz] = pickPos();
      const dot = new THREE.Mesh(seasonalTinyPetalGeo, glowMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(px, 0.017, pz);
      dot.scale.set(0.7, 0.7, 1);
      group.add(dot);
    }

    if (!isRimOnly) {
      const lx = (gx % 2 === 0 ? 1 : -1) * 0.96;
      const lz = (gy % 2 === 0 ? -1 : 1) * 0.96;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.036, 0.52, 6),
        getStdMat('#4A321F', 0.82, 0.05)
      );
      post.position.set(lx, 0.26, lz);
      post.castShadow = true;
      const lanternBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, 0.16, 8),
        new THREE.MeshStandardMaterial({
          color: '#FBBF24',
          emissive: '#F59E0B',
          emissiveIntensity: 0.75,
          roughness: 0.45,
        })
      );
      lanternBody.position.set(lx, 0.54, lz);
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.07, 8),
        getStdMat('#292524', 0.75, 0.1)
      );
      cap.position.set(lx, 0.65, lz);
      group.add(post, lanternBody, cap);
    }
  }

  return group;
}

const vegBladeGeo = new THREE.ConeGeometry(0.032, 0.16, 4);
const vegShrubGeo = new THREE.DodecahedronGeometry(0.11, 1);
const vegLeafGeo = new THREE.DodecahedronGeometry(0.036, 0);
const vegVineBarGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.36, 5);
const vegSnowBarGeo = new THREE.BoxGeometry(0.32, 0.006, 0.036);
const vegSnowHexGeo = new THREE.CircleGeometry(0.06, 6);
const vegCrystalGeo = new THREE.ConeGeometry(0.042, 0.19, 5);

/**
 * Dynamic habitat vegetation layer driven by animal count & average happiness (tiers 0-4):
 * - Savanna / Bamboo / Rainforest: growing perimeter grass tufts, lush shrubs, blossoms & climbing vines
 * - Arctic: intricate 6-point snowflake ice patterns, sculpted snowdrifts & frosted crystal spires
 */
export function buildHabitatVegetationLayer(
  biome: BiomeType,
  level: 1 | 2 | 3,
  tier: 0 | 1 | 2 | 3 | 4,
  gx: number,
  gy: number
): THREE.Group {
  const group = new THREE.Group();
  if (tier <= 0) return group;

  let seed = (gx * 48271 + gy * 91457 + tier * 7919) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const half = TILE_SIZE * (0.465 + (level - 1) * 0.012);
  const rim = half - 0.11;

  if (biome === 'arctic') {
    const snowPatternMat = getStdMat('#FFFFFF', 0.62, 0.08);
    const icePatternMat = getStdMat('#BAE6FD', 0.42, 0.16);
    snowPatternMat.polygonOffset = true;
    snowPatternMat.polygonOffsetFactor = -1;
    snowPatternMat.polygonOffsetUnits = -1;
    icePatternMat.polygonOffset = true;
    icePatternMat.polygonOffsetFactor = -1;
    icePatternMat.polygonOffsetUnits = -1;

    const addSnowflakePattern = (sx: number, sz: number, scale: number, useIce: boolean) => {
      const flake = new THREE.Group();
      const mat = useIce ? icePatternMat : snowPatternMat;
      for (let k = 0; k < 3; k++) {
        const arm = new THREE.Mesh(vegSnowBarGeo, mat);
        arm.rotation.y = (k * Math.PI) / 3;
        arm.receiveShadow = true;
        flake.add(arm);
      }
      const core = new THREE.Mesh(vegSnowHexGeo, useIce ? snowPatternMat : icePatternMat);
      core.rotation.x = -Math.PI / 2;
      core.position.y = 0.004;
      flake.add(core);
      flake.position.set(sx, 0.015, sz);
      flake.scale.set(scale, 1, scale);
      flake.rotation.y = rand() * Math.PI;
      group.add(flake);
    };

    // Tier 1+: light frost flecks; Tier 2+: crisp snowflake patterns + snow mounds
    const moundCount = tier === 1 ? 2 : tier === 2 ? 3 : tier === 3 ? 5 : 7;
    for (let i = 0; i < moundCount; i++) {
      const angle = (i / moundCount) * Math.PI * 2 + rand() * 0.5;
      const dist = rim * (0.72 + rand() * 0.24);
      const mound = new THREE.Mesh(
        seasonalSnowMoundGeo,
        i % 2 === 0 ? snowPatternMat : icePatternMat
      );
      mound.position.set(Math.cos(angle) * dist, 0.006, Math.sin(angle) * dist);
      const s = 0.65 + tier * 0.14 + rand() * 0.3;
      mound.scale.set(s, 0.24 + tier * 0.04, s * 0.9);
      mound.receiveShadow = true;
      group.add(mound);
    }

    const flakeSpots: Array<[number, number, number]> = [
      [-0.55, 0.56, 0.72],
      [0.54, 0.52, 0.68],
      [-0.64, -0.45, 0.78],
      [0.62, -0.48, 0.8],
      [0.02, 0.68, 0.85],
      [-0.08, -0.66, 0.75],
    ];
    const flakeCount = tier === 1 ? 0 : tier === 2 ? 2 : tier === 3 ? 4 : 6;
    for (let i = 0; i < flakeCount; i++) {
      const [fx, fz, fs] = flakeSpots[i];
      addSnowflakePattern(fx, fz, fs + tier * 0.05, i % 2 === 1);
    }

    // Tier 3-4: corner frosted ice-crystal clusters around posts
    if (tier >= 3) {
      const crystalMat = new THREE.MeshStandardMaterial({
        color: '#E0F2FE',
        emissive: '#38BDF8',
        emissiveIntensity: tier === 4 ? 0.22 : 0.1,
        roughness: 0.25,
        metalness: 0.15,
      });
      const cornerCoords: Array<[number, number]> = [
        [-half, -half],
        [half, -half],
        [half, half],
        [-half, half],
      ];
      const crystalTotal = tier === 4 ? 4 : 2;
      for (let c = 0; c < crystalTotal; c++) {
        const [cx, cz] = cornerCoords[c];
        for (let s = 0; s < 2; s++) {
          const spire = new THREE.Mesh(vegCrystalGeo, crystalMat);
          spire.position.set(
            cx + (cx > 0 ? -0.09 : 0.09) + (s - 0.5) * 0.05,
            0.09 + s * 0.03,
            cz + (cz > 0 ? -0.09 : 0.09)
          );
          spire.scale.setScalar(0.8 + tier * 0.1);
          spire.rotation.z = (s === 0 ? 1 : -1) * 0.22;
          spire.castShadow = true;
          group.add(spire);
        }
      }
    }

    return group;
  }

  // Warm savanna vs lush bamboo/rainforest palette
  const isSavanna = biome === 'savanna';
  const grassMatA = getStdMat(isSavanna ? '#9BA84A' : '#2E8B47', 0.82, 0.02);
  const grassMatB = getStdMat(isSavanna ? '#C5AD54' : '#43A85A', 0.8, 0.02);
  const shrubMat = getStdMat(isSavanna ? '#6F8A3A' : '#23753B', 0.78, 0.02);
  const vineMat = getStdMat(isSavanna ? '#5B7C35' : '#1E6B34', 0.76, 0.02);
  const blossomMat = getStdMat(isSavanna ? '#FBBF24' : '#F472B6', 0.68, 0.02);

  // 1. Perimeter grass blade tufts (scale count & lushness with tier 1..4)
  const tuftSpots: Array<[number, number]> = [
    [-rim, -rim * 0.55],
    [rim, -rim * 0.45],
    [-rim, rim * 0.45],
    [rim, rim * 0.52],
    [-rim * 0.52, rim],
    [rim * 0.48, rim],
    [-rim * 0.62, -rim],
    [rim * 0.58, -rim],
    [0.0, -rim * 0.94],
    [-rim * 0.86, 0.02],
    [rim * 0.88, -0.04],
    [0.14, rim * 0.92],
    [-0.24, rim * 0.88],
    [rim * 0.78, rim * 0.76],
  ];
  const tuftCount = tier === 1 ? 3 : tier === 2 ? 6 : tier === 3 ? 10 : 14;
  for (let i = 0; i < tuftCount; i++) {
    const [tx, tz] = tuftSpots[i % tuftSpots.length];
    const blades = tier >= 3 ? 4 : 3;
    for (let b = 0; b < blades; b++) {
      const ang = (b / blades) * Math.PI * 2 + rand() * 0.7;
      const blade = new THREE.Mesh(vegBladeGeo, (i + b) % 2 === 0 ? grassMatA : grassMatB);
      const hScale = 0.75 + tier * 0.22 + rand() * 0.3;
      blade.scale.set(0.9 + tier * 0.1, hScale, 0.9 + tier * 0.1);
      blade.position.set(
        tx + Math.cos(ang) * 0.045,
        0.065 * hScale,
        tz + Math.sin(ang) * 0.045
      );
      blade.rotation.z = Math.cos(ang) * 0.28;
      blade.rotation.x = Math.sin(ang) * 0.28;
      group.add(blade);
    }
  }

  // 2. Lush corner & back shrubs (tiers 2..4)
  if (tier >= 2) {
    const shrubSpots: Array<[number, number]> = [
      [-half + 0.14, -half + 0.14],
      [half - 0.14, -half + 0.14],
      [-half + 0.15, half - 0.16],
      [half - 0.15, half - 0.16],
      [0.0, -half + 0.15],
      [-half + 0.14, 0.0],
    ];
    const shrubCount = tier === 2 ? 2 : tier === 3 ? 4 : 6;
    for (let i = 0; i < shrubCount; i++) {
      const [sx, sz] = shrubSpots[i];
      const puffCount = tier === 4 ? 3 : 2;
      for (let p = 0; p < puffCount; p++) {
        const puff = new THREE.Mesh(vegShrubGeo, p === 0 ? shrubMat : grassMatB);
        const s = 0.72 + tier * 0.14 - p * 0.16;
        puff.scale.set(s * 1.15, s * 0.82, s * 1.15);
        puff.position.set(
          sx + (p - 0.5) * 0.09,
          0.065 * s + p * 0.035,
          sz + (p % 2 === 0 ? 0.04 : -0.04)
        );
        puff.castShadow = true;
        group.add(puff);
      }

      if (tier >= 3) {
        const flowerCount = tier === 4 ? 3 : 1;
        for (let f = 0; f < flowerCount; f++) {
          const fl = new THREE.Mesh(vegLeafGeo, blossomMat);
          fl.scale.setScalar(0.68);
          fl.position.set(
            sx + (rand() - 0.5) * 0.16,
            0.14 + tier * 0.02 + rand() * 0.04,
            sz + (rand() - 0.5) * 0.16
          );
          group.add(fl);
        }
      }
    }
  }

  // 3. Climbing vines draping along corner posts & enclosure rails (tiers 2..4)
  if (tier >= 2) {
    const vineConfigs: Array<{ x: number; z: number; rotY: number; vertical: boolean }> = [
      { x: -half, z: -half, rotY: 0.4, vertical: true },
      { x: half, z: -half, rotY: -0.4, vertical: true },
      { x: -half * 0.35, z: -half, rotY: 0, vertical: false },
      { x: half * 0.35, z: -half, rotY: 0.2, vertical: false },
      { x: -half, z: 0, rotY: Math.PI / 2, vertical: false },
      { x: half, z: 0, rotY: Math.PI / 2, vertical: false },
    ];
    const vineCount = tier === 2 ? 2 : tier === 3 ? 4 : 6;
    for (let i = 0; i < vineCount; i++) {
      const cfg = vineConfigs[i];
      const strand = new THREE.Mesh(vegVineBarGeo, vineMat);
      if (cfg.vertical) {
        const h = 0.22 + tier * 0.04;
        strand.scale.set(1, h / 0.36, 1);
        strand.position.set(cfg.x, h * 0.5 + 0.02, cfg.z);
        strand.rotation.z = 0.14 * (i % 2 === 0 ? 1 : -1);
      } else {
        strand.rotation.z = Math.PI / 2;
        strand.rotation.y = cfg.rotY;
        strand.scale.set(1, 1.0 + tier * 0.18, 1);
        strand.position.set(cfg.x, 0.2, cfg.z);
      }
      group.add(strand);

      const leafDots = tier === 4 ? 5 : 3;
      for (let l = 0; l < leafDots; l++) {
        const t = (l / (leafDots - 1 || 1)) - 0.5;
        const leaf = new THREE.Mesh(
          vegLeafGeo,
          tier === 4 && l % 2 === 1 ? blossomMat : l % 2 === 0 ? grassMatB : vineMat
        );
        leaf.scale.setScalar(tier === 4 && l % 2 === 1 ? 0.62 : 0.9);
        if (cfg.vertical) {
          leaf.position.set(
            cfg.x + Math.sin(l * 1.9) * 0.045,
            0.08 + (l / leafDots) * (0.18 + tier * 0.04),
            cfg.z + Math.cos(l * 1.9) * 0.045
          );
        } else if (Math.abs(cfg.rotY - Math.PI / 2) < 0.2) {
          leaf.position.set(
            cfg.x + (rand() - 0.5) * 0.05,
            0.18 + Math.sin(l * 1.7) * 0.045,
            cfg.z + t * 0.36
          );
        } else {
          leaf.position.set(
            cfg.x + t * 0.36,
            0.18 + Math.sin(l * 1.7) * 0.045,
            cfg.z + (rand() - 0.5) * 0.05
          );
        }
        group.add(leaf);
      }
    }
  }

  return group;
}


