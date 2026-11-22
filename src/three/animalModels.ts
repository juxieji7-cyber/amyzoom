import * as THREE from 'three';
import { SpeciesId } from '../types/zoo';
import {
  getCapybaraFurTexture,
  getCheetahCoatTexture,
  getContactShadowTexture,
  getElephantSkinTexture,
  getFurBumpTexture,
  getFurCardAlphaTexture,
  getGiraffeCoatTexture,
  getKangarooFurTexture,
  getKoalaFurTexture,
  getLionFurTexture,
  getLionManeTexture,
  getMeerkatCoatTexture,
  getOtterFurTexture,
  getPandaFurTexture,
  getPeacockPlumageTexture,
  getPolarBearFurTexture,
  getRedPandaTailTexture,
  getSealCoatTexture,
  getTigerCoatTexture,
  getToucanBeakTexture,
  getZebraCoatTexture,
} from './proceduralTextures';

export interface AnimalRig {
  speciesId: SpeciesId;
  bodyRoot: THREE.Group;
  neckPivot?: THREE.Group;
  headPivot?: THREE.Group;
  tailPivot?: THREE.Group;
  legFL?: THREE.Group;
  legFR?: THREE.Group;
  legBL?: THREE.Group;
  legBR?: THREE.Group;
  kneeFL?: THREE.Group;
  kneeFR?: THREE.Group;
  kneeBL?: THREE.Group;
  kneeBR?: THREE.Group;
  wingL?: THREE.Group;
  wingR?: THREE.Group;
  footL?: THREE.Group;
  footR?: THREE.Group;
  flipperL?: THREE.Group;
  flipperR?: THREE.Group;
  baseY: number;
}

const matPool = new Map<string, THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>();

function stdMat(
  key: string,
  params: THREE.MeshStandardMaterialParameters
): THREE.MeshStandardMaterial {
  let m = matPool.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial(params);
    matPool.set(key, m);
  }
  return m;
}

function physMat(
  key: string,
  params: THREE.MeshPhysicalMaterialParameters
): THREE.MeshPhysicalMaterial {
  let m = matPool.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = new THREE.MeshPhysicalMaterial(params);
    matPool.set(key, m);
  }
  return m;
}

let sharedFurCardGeo: THREE.PlaneGeometry | null = null;
function getFurCardGeometry(): THREE.PlaneGeometry {
  if (!sharedFurCardGeo) {
    sharedFurCardGeo = new THREE.PlaneGeometry(1, 1);
    sharedFurCardGeo.translate(0, 0.45, 0);
  }
  return sharedFurCardGeo;
}

function furCardMat(
  key: string,
  color: string,
  map?: THREE.Texture,
  roughness = 0.86
): THREE.MeshStandardMaterial {
  return stdMat(`furcard_${key}`, {
    color,
    map: map ?? null,
    alphaMap: getFurCardAlphaTexture(),
    alphaTest: 0.36,
    transparent: false,
    side: THREE.DoubleSide,
    bumpMap: getFurBumpTexture(),
    bumpScale: 0.015,
    roughness,
    metalness: 0.01,
  });
}

interface FurCardPlacement {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

function addFurTuftCards(
  parent: THREE.Object3D,
  mat: THREE.Material,
  placements: FurCardPlacement[]
) {
  const geo = getFurCardGeometry();
  for (const p of placements) {
    const card = new THREE.Mesh(geo, mat);
    card.position.set(p.x, p.y, p.z);
    card.scale.set(p.w, p.h, 1);
    card.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
    card.castShadow = true;
    parent.add(card);
  }
}

function addContactShadow(root: THREE.Group, rx: number, rz: number) {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(rx * 2, rz * 2),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  root.add(shadow);
}

/**
 * Smooth organic torso built with LatheGeometry oriented along +Z (head forward)
 */
function makeOrganicTorso(
  radii: Array<[number, number]>, // [zNormalized (-0.5..0.5), radius]
  length: number,
  scaleX: number,
  scaleY: number,
  mat: THREE.Material,
  radialSegments = 16
): THREE.Mesh {
  const pts = radii.map(([zn, r]) => new THREE.Vector2(Math.max(0.001, r), zn * length));
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.rotateX(Math.PI / 2); // Align lathe Y-axis with +Z forward
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(scaleX, scaleY, 1);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeEyePair(
  parent: THREE.Object3D,
  xOffset: number,
  yOffset: number,
  zOffset: number,
  radius: number,
  irisColor = '#1E1B18'
) {
  const eyeMat = physMat(`eye_${irisColor}`, {
    color: irisColor,
    roughness: 0.06,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  const scleraMat = stdMat('eye_sclera', { color: '#F8FAFC', roughness: 0.25, metalness: 0.0 });
  const geo = new THREE.SphereGeometry(radius, 10, 8);
  const scleraGeo = new THREE.SphereGeometry(radius * 1.15, 10, 8);

  for (const side of [-1, 1]) {
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);
    sclera.position.set(side * xOffset, yOffset, zOffset - radius * 0.12);
    sclera.scale.set(0.85, 0.95, 0.7);
    const pupil = new THREE.Mesh(geo, eyeMat);
    pupil.position.set(side * xOffset * 1.02, yOffset, zOffset + radius * 0.14);
    parent.add(sclera, pupil);
  }
}

function makeTwoSegmentLeg(
  upperLen: number,
  lowerLen: number,
  rTop: number,
  rKnee: number,
  rAnkle: number,
  upperMat: THREE.Material,
  lowerMat: THREE.Material,
  footMat: THREE.Material,
  isHoof: boolean
): { hip: THREE.Group; knee: THREE.Group } {
  const hip = new THREE.Group();

  const upperGeo = new THREE.CylinderGeometry(rTop, rKnee, upperLen, 10);
  upperGeo.translate(0, -upperLen / 2, 0);
  const upperMesh = new THREE.Mesh(upperGeo, upperMat);
  upperMesh.castShadow = true;
  hip.add(upperMesh);

  // Subtle knee joint cap
  const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(rKnee * 1.06, 8, 6), lowerMat);
  kneeCap.position.y = -upperLen;
  hip.add(kneeCap);

  const knee = new THREE.Group();
  knee.position.y = -upperLen;
  hip.add(knee);

  const lowerGeo = new THREE.CylinderGeometry(rKnee * 0.92, rAnkle, lowerLen, 10);
  lowerGeo.translate(0, -lowerLen / 2, 0);
  const lowerMesh = new THREE.Mesh(lowerGeo, lowerMat);
  lowerMesh.castShadow = true;
  knee.add(lowerMesh);

  if (isHoof) {
    const hoof = new THREE.Mesh(
      new THREE.CylinderGeometry(rAnkle * 1.05, rAnkle * 1.35, 0.032, 8),
      footMat
    );
    hoof.position.set(0, -lowerLen + 0.015, 0.008);
    hoof.castShadow = true;
    knee.add(hoof);
  } else {
    const paw = new THREE.Mesh(
      new THREE.SphereGeometry(rAnkle * 1.45, 8, 6),
      footMat
    );
    paw.scale.set(1.1, 0.58, 1.35);
    paw.position.set(0, -lowerLen + rAnkle * 0.45, 0.015);
    paw.castShadow = true;
    knee.add(paw);
  }

  return { hip, knee };
}

export function buildAnimalMesh(speciesId: SpeciesId): THREE.Group {
  const root = new THREE.Group();
  const bodyRoot = new THREE.Group();
  root.add(bodyRoot);

  const furBump = getFurBumpTexture();
  const darkNoseMat = physMat('nose_wet', {
    color: '#171717',
    roughness: 0.18,
    metalness: 0.05,
    clearcoat: 0.7,
  });

  const rig: AnimalRig = {
    speciesId,
    bodyRoot,
    baseY: 0,
  };

  if (speciesId === 'giraffe') {
    const coatMat = stdMat('giraffe_coat_mat', {
      map: getGiraffeCoatTexture(),
      bumpMap: furBump,
      bumpScale: 0.01,
      roughness: 0.78,
      metalness: 0.02,
    });
    const creamMat = stdMat('giraffe_cream', { color: '#F3E3BE', roughness: 0.8, metalness: 0.02 });
    const hoofMat = stdMat('hoof_dark', { color: '#292524', roughness: 0.5, metalness: 0.08 });
    const maneMat = stdMat('giraffe_mane', { color: '#6E3314', roughness: 0.85, metalness: 0.02 });
    const giraffeManeCard = furCardMat('giraffe_mane', '#6E3314');

    addContactShadow(root, 0.24, 0.28);
    rig.baseY = 0.46;
    bodyRoot.position.y = rig.baseY;

    // Sloping sculpted giraffe torso
    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.38, 0.115],
        [-0.1, 0.145],
        [0.2, 0.165],
        [0.42, 0.13],
        [0.5, 0.02],
      ],
      0.44,
      0.78,
      0.95,
      coatMat
    );
    torso.rotation.x = -0.14; // characteristic sloping back
    bodyRoot.add(torso);

    // 4 long 2-segment legs
    const legH = 0.24;
    const shinH = 0.22;
    const legOffsets: Array<[keyof AnimalRig, keyof AnimalRig, number, number, number]> = [
      ['legFL', 'kneeFL', -0.075, 0.14, 0.04],
      ['legFR', 'kneeFR', 0.075, 0.14, 0.04],
      ['legBL', 'kneeBL', -0.07, -0.14, -0.03],
      ['legBR', 'kneeBR', 0.07, -0.14, -0.03],
    ];
    for (const [legKey, kneeKey, lx, lz, ly] of legOffsets) {
      const { hip, knee } = makeTwoSegmentLeg(
        legH,
        shinH,
        0.034,
        0.022,
        0.017,
        coatMat,
        creamMat,
        hoofMat,
        true
      );
      hip.position.set(lx, ly, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    // Long tapered neck
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.11, 0.17);
    neckPivot.rotation.x = 0.22;
    bodyRoot.add(neckPivot);
    rig.neckPivot = neckPivot;

    const neckGeo = new THREE.CylinderGeometry(0.038, 0.068, 0.44, 12);
    neckGeo.translate(0, 0.22, 0);
    const neckMesh = new THREE.Mesh(neckGeo, coatMat);
    neckMesh.castShadow = true;
    neckPivot.add(neckMesh);

    // Dorsal neck mane ridge with dense strand-by-strand hair cards
    const giraffeManeCards: FurCardPlacement[] = [];
    for (let m = 0; m < 12; m++) {
      giraffeManeCards.push({
        x: (m % 2 === 0 ? -0.008 : 0.008),
        y: 0.02 + m * 0.036,
        z: -0.044,
        w: 0.078,
        h: 0.068,
        rx: -Math.PI * 0.48,
        ry: Math.PI / 2 + (m % 2 === 0 ? 0.14 : -0.14),
      });
    }
    addFurTuftCards(neckPivot, giraffeManeCard, giraffeManeCards);

    // Sculpted Head
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.44, 0.01);
    neckPivot.add(headPivot);
    rig.headPivot = headPivot;

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), coatMat);
    cranium.scale.set(0.85, 0.9, 1.15);
    cranium.position.set(0, 0.02, 0.02);
    cranium.castShadow = true;

    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.042, 0.12, 10), creamMat);
    snout.rotation.x = Math.PI / 2 + 0.18;
    snout.position.set(0, -0.005, 0.095);
    snout.castShadow = true;

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), darkNoseMat);
    nose.scale.set(1.1, 0.8, 0.7);
    nose.position.set(0, -0.018, 0.15);

    makeEyePair(headPivot, 0.042, 0.032, 0.045, 0.013);

    // Ossicones (horns) & Ears
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.07, 6), coatMat);
      horn.position.set(side * 0.022, 0.088, 0.0);
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), maneMat);
      tuft.position.set(side * 0.022, 0.125, 0.0);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 5), creamMat);
      ear.rotation.z = side * -1.1;
      ear.position.set(side * 0.058, 0.045, -0.01);
      headPivot.add(horn, tuft, ear);
    }
    headPivot.add(cranium, snout, nose);

    // Tail
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.03, -0.2);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;

    const tailShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.22, 6), creamMat);
    tailShaft.position.set(0, -0.1, -0.02);
    tailShaft.rotation.x = 0.2;
    const tailTuft = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), maneMat);
    tailTuft.scale.set(0.7, 1.4, 0.7);
    tailTuft.position.set(0, -0.21, -0.04);
    addFurTuftCards(tailPivot, giraffeManeCard, [
      { x: 0, y: -0.2, z: -0.04, w: 0.055, h: 0.075, rx: Math.PI },
      { x: 0, y: -0.2, z: -0.04, w: 0.055, h: 0.075, rx: Math.PI, ry: Math.PI / 2 },
    ]);
    tailPivot.add(tailShaft, tailTuft);
  } else if (speciesId === 'zebra') {
    const zebraMat = stdMat('zebra_coat_mat', {
      map: getZebraCoatTexture(),
      bumpMap: furBump,
      bumpScale: 0.01,
      roughness: 0.68,
      metalness: 0.02,
    });
    const darkMat = stdMat('zebra_dark', { color: '#1C1E22', roughness: 0.75, metalness: 0.04 });
    const whiteMat = stdMat('zebra_white', { color: '#F3F4F6', roughness: 0.72, metalness: 0.02 });
    const hoofMat = stdMat('hoof_dark', { color: '#292524', roughness: 0.45, metalness: 0.08 });
    const zebraManeDarkCard = furCardMat('zebra_mane_d', '#1C1E22');
    const zebraManeLightCard = furCardMat('zebra_mane_w', '#E5E7EB');

    addContactShadow(root, 0.22, 0.28);
    rig.baseY = 0.32;
    bodyRoot.position.y = rig.baseY;

    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.36, 0.125],
        [-0.08, 0.142],
        [0.22, 0.146],
        [0.42, 0.115],
        [0.5, 0.02],
      ],
      0.48,
      0.82,
      0.95,
      zebraMat
    );
    bodyRoot.add(torso);

    const legH = 0.17;
    const shinH = 0.15;
    const legOffsets: Array<[keyof AnimalRig, keyof AnimalRig, number, number]> = [
      ['legFL', 'kneeFL', -0.07, 0.14],
      ['legFR', 'kneeFR', 0.07, 0.14],
      ['legBL', 'kneeBL', -0.07, -0.14],
      ['legBR', 'kneeBR', 0.07, -0.14],
    ];
    for (const [legKey, kneeKey, lx, lz] of legOffsets) {
      const { hip, knee } = makeTwoSegmentLeg(
        legH,
        shinH,
        0.036,
        0.024,
        0.018,
        zebraMat,
        whiteMat,
        hoofMat,
        true
      );
      hip.position.set(lx, -0.02, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    // Arched equine neck
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.06, 0.17);
    neckPivot.rotation.x = 0.48;
    bodyRoot.add(neckPivot);
    rig.neckPivot = neckPivot;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.078, 0.22, 12), zebraMat);
    neck.position.y = 0.1;
    neck.castShadow = true;
    neckPivot.add(neck);

    // Upright zebra mane strand cards
    for (let m = 0; m < 12; m++) {
      addFurTuftCards(neckPivot, m % 2 === 0 ? zebraManeDarkCard : zebraManeLightCard, [
        {
          x: m % 2 === 0 ? -0.006 : 0.006,
          y: 0.015 + m * 0.018,
          z: -0.056,
          w: 0.064,
          h: 0.064,
          rx: -Math.PI * 0.52,
          ry: Math.PI / 2 + (m % 2 === 0 ? 0.12 : -0.12),
        },
      ]);
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.21, 0.015);
    headPivot.rotation.x = -0.25;
    neckPivot.add(headPivot);
    rig.headPivot = headPivot;

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), zebraMat);
    skull.scale.set(0.84, 0.9, 1.15);
    skull.position.set(0, 0.01, 0.02);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.046, 0.12, 10), zebraMat);
    muzzle.rotation.x = Math.PI / 2 + 0.15;
    muzzle.position.set(0, -0.012, 0.095);

    const darkMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), darkMat);
    darkMuzzle.scale.set(0.95, 0.85, 0.8);
    darkMuzzle.position.set(0, -0.022, 0.155);

    makeEyePair(headPivot, 0.044, 0.026, 0.045, 0.012);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.068, 6), zebraMat);
      ear.position.set(side * 0.034, 0.072, -0.01);
      ear.rotation.z = side * -0.25;
      headPivot.add(ear);
    }
    headPivot.add(skull, muzzle, darkMuzzle);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.04, -0.22);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.18, 6), whiteMat);
    tail.position.set(0, -0.09, -0.02);
    tail.rotation.x = 0.22;
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6), darkMat);
    tailTip.rotation.x = Math.PI;
    tailTip.position.set(0, -0.19, -0.04);
    addFurTuftCards(tailPivot, zebraManeDarkCard, [
      { x: 0, y: -0.18, z: -0.04, w: 0.06, h: 0.08, rx: Math.PI },
      { x: 0, y: -0.18, z: -0.04, w: 0.06, h: 0.08, rx: Math.PI, ry: Math.PI / 2 },
    ]);
    tailPivot.add(tail, tailTip);
  } else if (speciesId === 'lion') {
    const lionFurTex = getLionFurTexture();
    const lionManeTex = getLionManeTexture();
    const furMat = stdMat('lion_fur_mat', {
      map: lionFurTex,
      bumpMap: furBump,
      bumpScale: 0.016,
      roughness: 0.82,
      metalness: 0.01,
    });
    const bellyMat = stdMat('lion_belly', { color: '#F0D2A2', bumpMap: furBump, bumpScale: 0.012, roughness: 0.86, metalness: 0.01 });
    const maneMat = stdMat('lion_mane', {
      map: lionManeTex,
      bumpMap: furBump,
      bumpScale: 0.024,
      roughness: 0.9,
      metalness: 0.01,
    });
    const pawMat = stdMat('lion_paw', { color: '#DFAD68', bumpMap: furBump, bumpScale: 0.012, roughness: 0.82, metalness: 0.02 });
    const lionManeCard = furCardMat('lion_mane', '#FFFFFF', lionManeTex, 0.88);
    const lionCoatCard = furCardMat('lion_coat', '#FFFFFF', lionFurTex, 0.84);

    addContactShadow(root, 0.24, 0.28);
    rig.baseY = 0.24;
    bodyRoot.position.y = rig.baseY;

    // Muscular feline torso (deep chest, narrower waist)
    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.36, 0.11],
        [-0.08, 0.105],
        [0.2, 0.138],
        [0.42, 0.115],
        [0.5, 0.02],
      ],
      0.46,
      0.88,
      0.94,
      furMat
    );
    bodyRoot.add(torso);

    // 4 muscular feline legs with paws
    const legH = 0.13;
    const shinH = 0.11;
    const legOffsets: Array<[keyof AnimalRig, keyof AnimalRig, number, number]> = [
      ['legFL', 'kneeFL', -0.075, 0.135],
      ['legFR', 'kneeFR', 0.075, 0.135],
      ['legBL', 'kneeBL', -0.075, -0.135],
      ['legBR', 'kneeBR', 0.075, -0.135],
    ];
    for (const [legKey, kneeKey, lx, lz] of legOffsets) {
      const { hip, knee } = makeTwoSegmentLeg(
        legH,
        shinH,
        0.04,
        0.028,
        0.024,
        furMat,
        furMat,
        pawMat,
        false
      );
      hip.position.set(lx, -0.01, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    // Head & Layered Sculpted Mane
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.08, 0.2);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    // Layered mane core + 24 radial 3D alpha-tested fur strand cards ("根根分明" silhouette!)
    const maneCore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.132, 1), maneMat);
    maneCore.scale.set(1.02, 1.06, 0.84);
    maneCore.position.set(0, 0.01, -0.01);
    maneCore.castShadow = true;
    headPivot.add(maneCore);

    const manePlacements: FurCardPlacement[] = [];
    // Outer thick lion mane halo (24 overlapping tufts)
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      manePlacements.push({
        x: Math.cos(ang) * 0.096,
        y: 0.01 + Math.sin(ang) * 0.1,
        z: 0.018 + (i % 2) * 0.02,
        w: 0.125,
        h: 0.135,
        rx: 0.2 + (i % 3) * 0.09,
        ry: i % 2 === 0 ? 0.3 : -0.3,
        rz: ang - Math.PI / 2,
      });
    }
    // Mid-depth sculpted mane volume (14 tufts)
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + 0.15;
      manePlacements.push({
        x: Math.cos(ang) * 0.082,
        y: 0.01 + Math.sin(ang) * 0.086,
        z: -0.028,
        w: 0.135,
        h: 0.138,
        rx: 0.5,
        ry: Math.PI / 4 + (i % 2 === 0 ? 0.18 : -0.18),
        rz: ang - Math.PI / 2,
      });
    }
    // Inner face-framing ruff + crown mane tufts (10 tufts)
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + 0.3;
      manePlacements.push({
        x: Math.cos(ang) * 0.072,
        y: 0.016 + Math.sin(ang) * 0.075,
        z: 0.052,
        w: 0.09,
        h: 0.095,
        rx: 0.14,
        ry: i % 2 === 0 ? 0.22 : -0.22,
        rz: ang - Math.PI / 2,
      });
    }
    addFurTuftCards(headPivot, lionManeCard, manePlacements);
    addFurTuftCards(headPivot, lionCoatCard, [
      { x: -0.082, y: -0.008, z: 0.068, w: 0.07, h: 0.06, rz: 1.4, ry: 0.28 },
      { x: 0.082, y: -0.008, z: 0.068, w: 0.07, h: 0.06, rz: -1.4, ry: -0.28 },
    ]);

    // Dense dorsal, chest, flank, shoulder & thigh coat strand tufts
    addFurTuftCards(bodyRoot, lionCoatCard, [
      { x: 0, y: 0.12, z: 0.1, w: 0.15, h: 0.075, rx: -0.18, ry: Math.PI / 2 },
      { x: 0, y: 0.115, z: 0.0, w: 0.16, h: 0.072, rx: -0.15, ry: Math.PI / 2 },
      { x: 0, y: 0.11, z: -0.1, w: 0.15, h: 0.07, rx: -0.2, ry: Math.PI / 2 },
      { x: -0.098, y: 0.025, z: 0.07, w: 0.13, h: 0.068, ry: Math.PI / 2, rz: 1.25 },
      { x: 0.098, y: 0.025, z: 0.07, w: 0.13, h: 0.068, ry: Math.PI / 2, rz: -1.25 },
      { x: -0.092, y: 0.02, z: -0.08, w: 0.13, h: 0.068, ry: Math.PI / 2, rz: 1.25 },
      { x: 0.092, y: 0.02, z: -0.08, w: 0.13, h: 0.068, ry: Math.PI / 2, rz: -1.25 },
      { x: -0.085, y: -0.07, z: 0.135, w: 0.07, h: 0.06, rz: 1.35 },
      { x: 0.085, y: -0.07, z: 0.135, w: 0.07, h: 0.06, rz: -1.35 },
      { x: -0.085, y: -0.07, z: -0.135, w: 0.07, h: 0.06, rz: 1.35 },
      { x: 0.085, y: -0.07, z: -0.135, w: 0.07, h: 0.06, rz: -1.35 },
    ]);
    addFurTuftCards(bodyRoot, lionManeCard, [
      { x: 0, y: -0.04, z: 0.155, w: 0.14, h: 0.11, rx: Math.PI * 0.84 },
      { x: -0.035, y: -0.05, z: 0.145, w: 0.11, h: 0.09, rx: Math.PI * 0.85, rz: 0.4 },
      { x: 0.035, y: -0.05, z: 0.145, w: 0.11, h: 0.09, rx: Math.PI * 0.85, rz: -0.4 },
    ]);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), furMat);
    skull.scale.set(1.0, 0.92, 1.05);
    skull.position.set(0, 0.02, 0.06);
    skull.castShadow = true;

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.052, 0.075), bellyMat);
    muzzle.position.set(0, -0.01, 0.13);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.02, 3), darkNoseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.008, 0.17);

    // Prominent expressive lion eyes positioned clearly on the front face surface
    const lionScleraMat = stdMat('lion_eye_sclera', { color: '#FFFDF5', roughness: 0.18, metalness: 0.0 });
    const lionIrisMat = physMat('lion_eye_iris', {
      color: '#F59E0B',
      roughness: 0.08,
      metalness: 0.06,
      clearcoat: 1.0,
    });
    const lionPupilMat = physMat('lion_eye_pupil', {
      color: '#111111',
      roughness: 0.04,
      metalness: 0.08,
      clearcoat: 1.0,
    });
    const lionCatchlightMat = stdMat('lion_eye_glint', { color: '#FFFFFF', roughness: 0.05, metalness: 0.0 });
    const lionBrowMat = stdMat('lion_brow_dark', { color: '#5C2D0C', roughness: 0.82, metalness: 0.02 });
    const lionScleraGeo = new THREE.SphereGeometry(0.0205, 12, 10);
    const lionIrisGeo = new THREE.SphereGeometry(0.016, 12, 10);
    const lionPupilGeo = new THREE.SphereGeometry(0.0105, 10, 8);
    const lionGlintGeo = new THREE.SphereGeometry(0.0042, 6, 6);
    const lionBrowGeo = new THREE.SphereGeometry(0.018, 8, 6);
    for (const side of [-1, 1]) {
      const sclera = new THREE.Mesh(lionScleraGeo, lionScleraMat);
      sclera.scale.set(0.95, 1.02, 0.68);
      sclera.position.set(side * 0.042, 0.039, 0.135);
      const iris = new THREE.Mesh(lionIrisGeo, lionIrisMat);
      iris.scale.set(0.92, 1.0, 0.72);
      iris.position.set(side * 0.042, 0.039, 0.141);
      const pupil = new THREE.Mesh(lionPupilGeo, lionPupilMat);
      pupil.scale.set(0.88, 1.05, 0.72);
      pupil.position.set(side * 0.042, 0.039, 0.146);
      const glint = new THREE.Mesh(lionGlintGeo, lionCatchlightMat);
      glint.position.set(side * 0.042 + 0.0045, 0.044, 0.151);
      const brow = new THREE.Mesh(lionBrowGeo, lionBrowMat);
      brow.scale.set(1.25, 0.42, 0.65);
      brow.rotation.z = side * -0.18;
      brow.position.set(side * 0.041, 0.056, 0.134);
      headPivot.add(sclera, iris, pupil, glint, brow);
    }

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), furMat);
      ear.scale.set(0.8, 1.0, 0.5);
      ear.position.set(side * 0.072, 0.085, 0.05);
      headPivot.add(ear);
    }
    headPivot.add(skull, muzzle, nose);

    // S-curved feline tail with lush dark fur-tuft tip
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.02, -0.2);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.05, -0.1),
      new THREE.Vector3(0, -0.02, -0.2),
      new THREE.Vector3(0, 0.05, -0.25),
    ]);
    const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 12, 0.013, 6, false), furMat);
    tailMesh.castShadow = true;
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), maneMat);
    tuft.scale.set(0.85, 0.85, 1.35);
    tuft.position.set(0, 0.055, -0.26);
    addFurTuftCards(tailPivot, lionManeCard, [
      { x: 0, y: 0.055, z: -0.26, w: 0.088, h: 0.1, rx: -Math.PI * 0.45 },
      { x: 0, y: 0.055, z: -0.26, w: 0.088, h: 0.1, rx: -Math.PI * 0.45, ry: Math.PI / 2 },
      { x: 0, y: 0.055, z: -0.26, w: 0.085, h: 0.095, rx: -Math.PI * 0.45, ry: Math.PI / 4 },
      { x: 0, y: 0.055, z: -0.26, w: 0.085, h: 0.095, rx: -Math.PI * 0.45, ry: -Math.PI / 4 },
    ]);
    tailPivot.add(tailMesh, tuft);
  } else if (speciesId === 'panda') {
    const pandaWhiteTex = getPandaFurTexture('white');
    const pandaBlackTex = getPandaFurTexture('black');
    const whiteFur = stdMat('panda_white', {
      map: pandaWhiteTex,
      bumpMap: furBump,
      bumpScale: 0.018,
      roughness: 0.88,
      metalness: 0.01,
    });
    const blackFur = stdMat('panda_black', {
      map: pandaBlackTex,
      bumpMap: furBump,
      bumpScale: 0.018,
      roughness: 0.86,
      metalness: 0.02,
    });
    const pandaWhiteCard = furCardMat('panda_white', '#FFFFFF', pandaWhiteTex, 0.88);
    const pandaBlackCard = furCardMat('panda_black', '#FFFFFF', pandaBlackTex, 0.86);

    addContactShadow(root, 0.24, 0.26);
    rig.baseY = 0.2;
    bodyRoot.position.y = rig.baseY;

    // Plump bear torso
    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.36, 0.145],
        [-0.08, 0.175],
        [0.18, 0.165],
        [0.42, 0.125],
        [0.5, 0.02],
      ],
      0.44,
      0.98,
      0.94,
      whiteFur
    );
    bodyRoot.add(torso);

    // Signature black shoulder saddle band
    const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.165, 0.13, 14), blackFur);
    saddle.rotation.x = Math.PI / 2;
    saddle.scale.set(1.04, 1.0, 0.96);
    saddle.position.set(0, 0.01, 0.09);
    saddle.castShadow = true;
    bodyRoot.add(saddle);

    // 4 stout articulated bear legs
    const legPositions: Array<[keyof AnimalRig, number, number]> = [
      ['legFL', -0.095, 0.11],
      ['legFR', 0.095, 0.11],
      ['legBL', -0.095, -0.11],
      ['legBR', 0.095, -0.11],
    ];
    for (const [legKey, lx, lz] of legPositions) {
      const { hip } = makeTwoSegmentLeg(
        0.1,
        0.09,
        0.052,
        0.044,
        0.038,
        blackFur,
        blackFur,
        blackFur,
        false
      );
      hip.position.set(lx, -0.02, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
    }

    // Round plump panda head
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.11, 0.19);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), whiteFur);
    head.scale.set(1.08, 0.98, 1.0);
    head.castShadow = true;

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), whiteFur);
    snout.scale.set(1.15, 0.82, 1.0);
    snout.position.set(0, -0.025, 0.11);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), darkNoseMat);
    nose.scale.set(1.25, 0.85, 0.8);
    nose.position.set(0, -0.012, 0.165);

    // Tilted oval black eye patches + glossy eyes
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), blackFur);
      ear.scale.set(1.0, 1.0, 0.55);
      ear.position.set(side * 0.098, 0.1, 0.0);
      headPivot.add(ear);

      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), blackFur);
      patch.scale.set(1.15, 0.88, 0.4);
      patch.rotation.z = side * -0.4;
      patch.position.set(side * 0.052, 0.022, 0.105);
      headPivot.add(patch);
    }
    makeEyePair(headPivot, 0.048, 0.024, 0.116, 0.012);
    headPivot.add(head, snout, nose);

    // Dense fluffy panda cheek, crown, shoulder, flank & rump fur cards
    addFurTuftCards(headPivot, pandaWhiteCard, [
      { x: -0.115, y: -0.01, z: 0.01, w: 0.13, h: 0.095, rz: 1.45, ry: 0.3 },
      { x: 0.115, y: -0.01, z: 0.01, w: 0.13, h: 0.095, rz: -1.45, ry: -0.3 },
      { x: -0.09, y: -0.065, z: 0.03, w: 0.11, h: 0.075, rz: 2.15, ry: 0.2 },
      { x: 0.09, y: -0.065, z: 0.03, w: 0.11, h: 0.075, rz: -2.15, ry: -0.2 },
      { x: 0, y: 0.112, z: 0.0, w: 0.145, h: 0.08, rx: -0.2 },
      { x: 0, y: 0.105, z: -0.04, w: 0.135, h: 0.075, rx: -0.45 },
    ]);
    addFurTuftCards(headPivot, pandaBlackCard, [
      { x: -0.1, y: 0.11, z: 0.0, w: 0.088, h: 0.068, rz: 0.55 },
      { x: 0.1, y: 0.11, z: 0.0, w: 0.088, h: 0.068, rz: -0.55 },
    ]);
    addFurTuftCards(bodyRoot, pandaWhiteCard, [
      { x: 0, y: 0.148, z: -0.06, w: 0.21, h: 0.085, ry: Math.PI / 2 },
      { x: 0, y: 0.135, z: -0.16, w: 0.16, h: 0.075, ry: Math.PI / 2, rx: -0.25 },
      { x: -0.138, y: 0.04, z: -0.06, w: 0.18, h: 0.088, ry: Math.PI / 2, rz: 1.2 },
      { x: 0.138, y: 0.04, z: -0.06, w: 0.18, h: 0.088, ry: Math.PI / 2, rz: -1.2 },
      { x: -0.135, y: 0.01, z: -0.15, w: 0.14, h: 0.078, rz: 1.35 },
      { x: 0.135, y: 0.01, z: -0.15, w: 0.14, h: 0.078, rz: -1.35 },
      { x: 0, y: 0.06, z: -0.21, w: 0.14, h: 0.075, rx: -0.85 },
    ]);
    addFurTuftCards(bodyRoot, pandaBlackCard, [
      { x: 0, y: 0.148, z: 0.09, w: 0.17, h: 0.082, ry: Math.PI / 2 },
      { x: -0.125, y: 0.03, z: 0.11, w: 0.13, h: 0.075, ry: Math.PI / 2, rz: 1.2 },
      { x: 0.125, y: 0.03, z: 0.11, w: 0.13, h: 0.075, ry: Math.PI / 2, rz: -1.2 },
      { x: -0.095, y: -0.06, z: -0.14, w: 0.09, h: 0.065, rz: 1.4 },
      { x: 0.095, y: -0.06, z: -0.14, w: 0.09, h: 0.065, rz: -1.4 },
    ]);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.02, -0.21);
    bodyRoot.add(tailPivot);
    const stubTail = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), whiteFur);
    tailPivot.add(stubTail);
    rig.tailPivot = tailPivot;
  } else if (speciesId === 'red_panda') {
    const rustMat = stdMat('rp_rust', {
      color: '#C84B1B',
      bumpMap: furBump,
      bumpScale: 0.016,
      roughness: 0.82,
      metalness: 0.01,
    });
    const darkMat = stdMat('rp_dark', { color: '#331509', bumpMap: furBump, bumpScale: 0.014, roughness: 0.84, metalness: 0.02 });
    const creamMat = stdMat('rp_cream', { color: '#FFF7ED', bumpMap: furBump, bumpScale: 0.012, roughness: 0.78, metalness: 0.02 });
    const rpTailTex = getRedPandaTailTexture();
    const tailMat = stdMat('rp_tail_mat', {
      map: rpTailTex,
      bumpMap: furBump,
      bumpScale: 0.018,
      roughness: 0.84,
      metalness: 0.02,
    });
    const rpRustCard = furCardMat('rp_rust', '#C84B1B');
    const rpCreamCard = furCardMat('rp_cream', '#FFF7ED');
    const rpTailCard = furCardMat('rp_tail', '#FFFFFF', rpTailTex);

    addContactShadow(root, 0.18, 0.24);
    rig.baseY = 0.14;
    bodyRoot.position.y = rig.baseY;

    const torso = makeOrganicTorso(
      [
        [-0.5, 0.015],
        [-0.36, 0.088],
        [0.0, 0.105],
        [0.36, 0.09],
        [0.5, 0.015],
      ],
      0.34,
      0.92,
      0.88,
      rustMat
    );
    bodyRoot.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), darkMat);
    belly.scale.set(0.85, 0.65, 1.55);
    belly.position.set(0, -0.04, 0.01);
    bodyRoot.add(belly);

    const legPositions: Array<[keyof AnimalRig, number, number]> = [
      ['legFL', -0.062, 0.095],
      ['legFR', 0.062, 0.095],
      ['legBL', -0.062, -0.095],
      ['legBR', 0.062, -0.095],
    ];
    for (const [legKey, lx, lz] of legPositions) {
      const { hip } = makeTwoSegmentLeg(
        0.07,
        0.065,
        0.03,
        0.024,
        0.022,
        darkMat,
        darkMat,
        darkMat,
        false
      );
      hip.position.set(lx, -0.01, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.065, 0.155);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.086, 12, 10), rustMat);
    head.scale.set(1.08, 0.92, 0.98);
    head.castShadow = true;

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), creamMat);
    muzzle.scale.set(1.05, 0.8, 1.1);
    muzzle.position.set(0, -0.018, 0.072);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), darkNoseMat);
    nose.position.set(0, -0.01, 0.112);

    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), creamMat);
      cheek.scale.set(1.0, 0.85, 0.6);
      cheek.position.set(side * 0.055, -0.018, 0.056);

      const brow = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), creamMat);
      brow.position.set(side * 0.032, 0.034, 0.072);

      const earBack = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.055, 6), rustMat);
      earBack.position.set(side * 0.06, 0.072, 0.0);
      earBack.rotation.z = side * -0.3;

      const earRim = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.048, 6), creamMat);
      earRim.position.set(side * 0.06, 0.07, 0.008);
      earRim.rotation.z = side * -0.3;

      headPivot.add(cheek, brow, earBack, earRim);
    }
    makeEyePair(headPivot, 0.034, 0.014, 0.074, 0.01);
    headPivot.add(head, muzzle, nose);

    // Red panda fluffy cheek tufts, ear tips, crown, flank & spine fur cards
    addFurTuftCards(headPivot, rpCreamCard, [
      { x: -0.078, y: -0.01, z: 0.035, w: 0.092, h: 0.075, rz: 1.4 },
      { x: 0.078, y: -0.01, z: 0.035, w: 0.092, h: 0.075, rz: -1.4 },
      { x: -0.065, y: -0.045, z: 0.042, w: 0.075, h: 0.058, rz: 2.0 },
      { x: 0.065, y: -0.045, z: 0.042, w: 0.075, h: 0.058, rz: -2.0 },
      { x: -0.065, y: 0.088, z: 0.0, w: 0.056, h: 0.056, rz: 0.35 },
      { x: 0.065, y: 0.088, z: 0.0, w: 0.056, h: 0.056, rz: -0.35 },
    ]);
    addFurTuftCards(headPivot, rpRustCard, [
      { x: 0, y: 0.078, z: -0.01, w: 0.095, h: 0.055, rx: -0.2 },
      { x: -0.08, y: 0.025, z: -0.01, w: 0.08, h: 0.058, rz: 1.2 },
      { x: 0.08, y: 0.025, z: -0.01, w: 0.08, h: 0.058, rz: -1.2 },
    ]);
    addFurTuftCards(bodyRoot, rpRustCard, [
      { x: 0, y: 0.088, z: 0.05, w: 0.16, h: 0.068, ry: Math.PI / 2 },
      { x: 0, y: 0.086, z: -0.06, w: 0.16, h: 0.068, ry: Math.PI / 2 },
      { x: -0.085, y: 0.02, z: 0.02, w: 0.14, h: 0.06, ry: Math.PI / 2, rz: 1.3 },
      { x: 0.085, y: 0.02, z: 0.02, w: 0.14, h: 0.06, ry: Math.PI / 2, rz: -1.3 },
      { x: -0.08, y: 0.015, z: -0.09, w: 0.13, h: 0.058, ry: Math.PI / 2, rz: 1.3 },
      { x: 0.08, y: 0.015, z: -0.09, w: 0.13, h: 0.058, ry: Math.PI / 2, rz: -1.3 },
    ]);

    // Lush striped ringed tail with radial strand cards
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.02, -0.15);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;

    const tailPts = [
      new THREE.Vector2(0.018, 0),
      new THREE.Vector2(0.048, -0.08),
      new THREE.Vector2(0.054, -0.18),
      new THREE.Vector2(0.036, -0.27),
      new THREE.Vector2(0.006, -0.31),
    ];
    const tailGeo = new THREE.LatheGeometry(tailPts, 12);
    tailGeo.rotateX(Math.PI / 2);
    const tailMesh = new THREE.Mesh(tailGeo, tailMat);
    tailMesh.rotation.x = 0.25;
    tailMesh.castShadow = true;
    tailPivot.add(tailMesh);
    addFurTuftCards(tailPivot, rpTailCard, [
      { x: 0, y: 0.025, z: -0.16, w: 0.27, h: 0.082, ry: Math.PI / 2, rx: -0.25 },
      { x: 0, y: -0.035, z: -0.16, w: 0.25, h: 0.075, ry: Math.PI / 2, rx: Math.PI - 0.25 },
      { x: -0.036, y: 0.01, z: -0.16, w: 0.25, h: 0.08, ry: Math.PI / 2, rz: 1.3 },
      { x: 0.036, y: 0.01, z: -0.16, w: 0.25, h: 0.08, ry: Math.PI / 2, rz: -1.3 },
      { x: -0.028, y: 0.028, z: -0.17, w: 0.22, h: 0.07, ry: Math.PI / 2, rz: 0.65 },
      { x: 0.028, y: 0.028, z: -0.17, w: 0.22, h: 0.07, ry: Math.PI / 2, rz: -0.65 },
    ]);
  } else if (speciesId === 'penguin') {
    const navyMat = stdMat('peng_navy', { color: '#1B2432', roughness: 0.42, metalness: 0.08 });
    const whiteMat = stdMat('peng_white', { color: '#F8FAFC', roughness: 0.55, metalness: 0.02 });
    const goldMat = stdMat('peng_gold', { color: '#F59E0B', roughness: 0.48, metalness: 0.04 });
    const footMat = stdMat('peng_foot', { color: '#334155', roughness: 0.65, metalness: 0.05 });

    addContactShadow(root, 0.14, 0.14);
    rig.baseY = 0.035;
    bodyRoot.position.y = rig.baseY;

    // Streamlined upright King Penguin body (LatheGeometry along vertical Y)
    const bodyPts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.085, 0.04),
      new THREE.Vector2(0.115, 0.12),
      new THREE.Vector2(0.102, 0.22),
      new THREE.Vector2(0.068, 0.29),
      new THREE.Vector2(0.058, 0.34),
      new THREE.Vector2(0.01, 0.38),
    ];
    const bodyGeo = new THREE.LatheGeometry(bodyPts, 14);
    const body = new THREE.Mesh(bodyGeo, navyMat);
    body.castShadow = true;
    bodyRoot.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.096, 12, 10), whiteMat);
    belly.scale.set(0.88, 1.38, 0.65);
    belly.position.set(0, 0.145, 0.044);
    bodyRoot.add(belly);

    // Orange-gold upper breast gradient & ear patches
    const breastGold = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), goldMat);
    breastGold.scale.set(0.95, 0.85, 0.58);
    breastGold.position.set(0, 0.255, 0.045);
    bodyRoot.add(breastGold);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.32, 0.0);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.064, 12, 10), navyMat);
    head.scale.set(0.95, 0.98, 1.08);
    head.castShadow = true;

    const beakUpper = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.095, 8), navyMat);
    beakUpper.rotation.x = Math.PI / 2 + 0.12;
    beakUpper.position.set(0, -0.005, 0.09);

    const beakPlate = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.07, 6), goldMat);
    beakPlate.rotation.x = Math.PI / 2 + 0.12;
    beakPlate.position.set(0, -0.012, 0.082);

    for (const side of [-1, 1]) {
      const earPatch = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), goldMat);
      earPatch.scale.set(0.45, 1.15, 0.75);
      earPatch.position.set(side * 0.056, -0.01, 0.012);
      headPivot.add(earPatch);
    }
    makeEyePair(headPivot, 0.04, 0.018, 0.046, 0.008);
    headPivot.add(head, beakUpper, beakPlate);

    // Tapered flippers pivoted at shoulders
    for (const [wingKey, side] of [
      ['wingL', -1],
      ['wingR', 1],
    ] as const) {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.105, 0.24, 0);
      const wingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.052), navyMat);
      wingMesh.position.set(side * 0.008, -0.075, 0);
      wingMesh.rotation.z = side * -0.14;
      wingMesh.castShadow = true;
      wingPivot.add(wingMesh);
      bodyRoot.add(wingPivot);
      (rig[wingKey] as THREE.Group) = wingPivot;
    }

    // Webbed feet anchored at root level
    for (const [footKey, side] of [
      ['footL', -1],
      ['footR', 1],
    ] as const) {
      const footPivot = new THREE.Group();
      footPivot.position.set(side * 0.048, 0.032, 0.01);
      const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.018, 0.075), footMat);
      footMesh.position.set(0, -0.02, 0.018);
      footMesh.castShadow = true;
      footPivot.add(footMesh);
      root.add(footPivot);
      (rig[footKey] as THREE.Group) = footPivot;
    }
  } else if (speciesId === 'seal') {
    const sealMat = physMat('seal_coat_mat', {
      map: getSealCoatTexture(),
      roughness: 0.26,
      metalness: 0.04,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
    });
    const bellyMat = physMat('seal_belly', {
      color: '#D5DCE4',
      roughness: 0.3,
      metalness: 0.04,
      clearcoat: 0.4,
    });
    const muzzleMat = stdMat('seal_muzzle', { color: '#CBD5E1', roughness: 0.4, metalness: 0.02 });

    addContactShadow(root, 0.2, 0.28);
    rig.baseY = 0.095;
    bodyRoot.position.y = rig.baseY;

    // Streamlined fusiform seal body
    const body = makeOrganicTorso(
      [
        [-0.5, 0.028],
        [-0.32, 0.068],
        [-0.08, 0.105],
        [0.18, 0.118],
        [0.4, 0.095],
        [0.5, 0.02],
      ],
      0.48,
      0.95,
      0.84,
      sealMat
    );
    bodyRoot.add(body);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.096, 12, 10), bellyMat);
    chest.scale.set(0.9, 0.72, 1.35);
    chest.position.set(0, -0.02, 0.05);
    bodyRoot.add(chest);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.075, 0.19);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 10), sealMat);
    head.scale.set(0.98, 0.92, 1.08);
    head.castShadow = true;

    for (const side of [-1, 1]) {
      const whiskerPad = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), muzzleMat);
      whiskerPad.position.set(side * 0.02, -0.015, 0.074);
      headPivot.add(whiskerPad);
    }
    const sealWhiskerCard = furCardMat('seal_whisker', '#E2E8F0');
    addFurTuftCards(headPivot, sealWhiskerCard, [
      { x: -0.036, y: -0.015, z: 0.076, w: 0.04, h: 0.042, rz: 1.5, ry: 0.35 },
      { x: 0.036, y: -0.015, z: 0.076, w: 0.04, h: 0.042, rz: -1.5, ry: -0.35 },
    ]);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), darkNoseMat);
    nose.position.set(0, -0.002, 0.092);
    makeEyePair(headPivot, 0.042, 0.024, 0.062, 0.013);
    headPivot.add(head, nose);

    // Pectoral front flippers
    for (const [flipKey, side] of [
      ['flipperL', -1],
      ['flipperR', 1],
    ] as const) {
      const flipPivot = new THREE.Group();
      flipPivot.position.set(side * 0.095, -0.045, 0.1);
      const flipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.072), sealMat);
      flipMesh.position.set(side * 0.055, -0.01, -0.01);
      flipMesh.rotation.y = side * -0.35;
      flipMesh.castShadow = true;
      flipPivot.add(flipMesh);
      bodyRoot.add(flipPivot);
      (rig[flipKey] as THREE.Group) = flipPivot;
    }

    // Split hind tail flippers
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.015, -0.23);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;

    for (const side of [-1, 1]) {
      const hind = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.022, 0.13), sealMat);
      hind.position.set(side * 0.032, -0.015, -0.055);
      hind.rotation.y = side * 0.32;
      hind.castShadow = true;
      tailPivot.add(hind);
    }
  } else if (speciesId === 'capybara') {
    const capyFurTex = getCapybaraFurTexture();
    const capyMat = stdMat('capy_fur_mat', {
      map: capyFurTex,
      bumpMap: furBump,
      bumpScale: 0.02,
      roughness: 0.9,
      metalness: 0.01,
    });
    const capyCard = furCardMat('capy', '#FFFFFF', capyFurTex, 0.88);
    const darkMat = stdMat('capy_dark', { color: '#4E311B', roughness: 0.86, metalness: 0.02 });
    const yuzuMat = physMat('capy_yuzu', {
      color: '#F97316',
      roughness: 0.35,
      metalness: 0.05,
      clearcoat: 0.3,
    });
    const leafMat = stdMat('capy_leaf', { color: '#16A34A', roughness: 0.65, metalness: 0.02 });

    addContactShadow(root, 0.2, 0.25);
    rig.baseY = 0.13;
    bodyRoot.position.y = rig.baseY;

    // Iconic barrel-shaped body
    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.36, 0.125],
        [0.0, 0.14],
        [0.35, 0.122],
        [0.5, 0.02],
      ],
      0.4,
      0.92,
      0.9,
      capyMat
    );
    bodyRoot.add(torso);
    addFurTuftCards(bodyRoot, capyCard, [
      { x: 0, y: 0.118, z: 0.07, w: 0.2, h: 0.08, ry: Math.PI / 2 },
      { x: 0, y: 0.115, z: -0.07, w: 0.2, h: 0.08, ry: Math.PI / 2 },
      { x: -0.115, y: 0.035, z: 0.05, w: 0.16, h: 0.072, ry: Math.PI / 2, rz: 1.25 },
      { x: 0.115, y: 0.035, z: 0.05, w: 0.16, h: 0.072, ry: Math.PI / 2, rz: -1.25 },
      { x: -0.11, y: 0.03, z: -0.09, w: 0.15, h: 0.07, ry: Math.PI / 2, rz: 1.25 },
      { x: 0.11, y: 0.03, z: -0.09, w: 0.15, h: 0.07, ry: Math.PI / 2, rz: -1.25 },
      { x: 0, y: 0.04, z: -0.18, w: 0.14, h: 0.075, rx: -0.9 },
      { x: 0, y: -0.03, z: 0.14, w: 0.11, h: 0.068, rx: Math.PI * 0.85 },
    ]);

    const legPositions: Array<[keyof AnimalRig, number, number]> = [
      ['legFL', -0.072, 0.1],
      ['legFR', 0.072, 0.1],
      ['legBL', -0.072, -0.1],
      ['legBR', 0.072, -0.1],
    ];
    for (const [legKey, lx, lz] of legPositions) {
      const { hip } = makeTwoSegmentLeg(
        0.065,
        0.055,
        0.036,
        0.03,
        0.026,
        capyMat,
        darkMat,
        darkMat,
        false
      );
      hip.position.set(lx, -0.01, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
    }

    // Distinct blunt-snouted capybara head
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.075, 0.165);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.076, 12, 10), capyMat);
    cranium.scale.set(0.88, 0.92, 1.25);
    cranium.castShadow = true;

    const bluntSnout = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.078, 0.095), capyMat);
    bluntSnout.position.set(0, -0.012, 0.075);
    bluntSnout.castShadow = true;

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.032, 0.02), darkMat);
    nose.position.set(0, -0.008, 0.125);

    makeEyePair(headPivot, 0.044, 0.032, 0.045, 0.009);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), darkMat);
      ear.scale.set(0.65, 1.0, 0.8);
      ear.position.set(side * 0.056, 0.058, -0.01);
      headPivot.add(ear);
    }

    // Tiny balanced Yuzu citrus on head
    const yuzu = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), yuzuMat);
    yuzu.position.set(0, 0.085, 0.02);
    const yuzuLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.014), leafMat);
    yuzuLeaf.position.set(0.01, 0.118, 0.02);
    yuzuLeaf.rotation.z = 0.25;

    headPivot.add(cranium, bluntSnout, nose, yuzu, yuzuLeaf);
    addFurTuftCards(headPivot, capyCard, [
      { x: -0.068, y: -0.01, z: 0.01, w: 0.08, h: 0.06, rz: 1.35 },
      { x: 0.068, y: -0.01, z: 0.01, w: 0.08, h: 0.06, rz: -1.35 },
      { x: 0, y: 0.055, z: -0.035, w: 0.085, h: 0.055, rx: -0.35 },
    ]);
  } else if (speciesId === 'toucan') {
    // Toco Toucan perched on a mossy natural branch
    const blackFeather = physMat('toucan_black', {
      color: '#141923',
      roughness: 0.36,
      metalness: 0.1,
      clearcoat: 0.25,
    });
    const chestYellow = stdMat('toucan_yellow', { color: '#FDE047', roughness: 0.62, metalness: 0.02 });
    const eyeRingBlue = stdMat('toucan_blue_ring', { color: '#38BDF8', roughness: 0.45, metalness: 0.05 });
    const beakMat = physMat('toucan_beak_mat', {
      map: getToucanBeakTexture(),
      roughness: 0.28,
      metalness: 0.06,
      clearcoat: 0.5,
    });
    const woodBranch = stdMat('toucan_branch', { color: '#5D4027', roughness: 0.88, metalness: 0.02 });
    const redCovert = stdMat('toucan_red', { color: '#DC2626', roughness: 0.6, metalness: 0.02 });

    addContactShadow(root, 0.16, 0.16);
    rig.baseY = 0.16;
    bodyRoot.position.y = rig.baseY;

    // Natural wooden perch attached to root
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.16, 7), woodBranch);
    post.position.set(0, 0.08, 0);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.28, 7), woodBranch);
    branch.rotation.z = Math.PI / 2;
    branch.position.set(0, 0.155, 0);
    branch.castShadow = true;
    root.add(post, branch);

    // Avian body
    const body = makeOrganicTorso(
      [
        [-0.5, 0.012],
        [-0.3, 0.055],
        [0.15, 0.076],
        [0.42, 0.062],
        [0.5, 0.012],
      ],
      0.24,
      0.86,
      0.95,
      blackFeather
    );
    body.rotation.x = -0.45;
    body.position.set(0, 0.075, 0);
    bodyRoot.add(body);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), chestYellow);
    chest.scale.set(0.88, 1.15, 0.72);
    chest.position.set(0, 0.11, 0.038);
    bodyRoot.add(chest);

    // Wings
    for (const [wingKey, side] of [
      ['wingL', -1],
      ['wingR', 1],
    ] as const) {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.064, 0.1, 0.01);
      const wingMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), blackFeather);
      wingMesh.scale.set(0.32, 1.35, 0.9);
      wingMesh.position.set(side * 0.008, -0.035, -0.02);
      wingMesh.rotation.x = 0.45;
      wingPivot.add(wingMesh);
      bodyRoot.add(wingPivot);
      (rig[wingKey] as THREE.Group) = wingPivot;
    }

    // Head + iconic curved giant beak
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.185, 0.05);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), blackFeather);
    head.castShadow = true;
    headPivot.add(head);

    // Vivid cobalt blue orbital skin rings
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeRingBlue);
      ring.scale.set(0.5, 1.0, 1.0);
      ring.position.set(side * 0.048, 0.012, 0.024);
      headPivot.add(ring);
    }
    makeEyePair(headPivot, 0.051, 0.012, 0.028, 0.009);

    // Curved oversized beak via TubeGeometry with tapered radius
    const beakPts = [
      new THREE.Vector2(0.002, 0),
      new THREE.Vector2(0.024, 0.03),
      new THREE.Vector2(0.035, 0.09),
      new THREE.Vector2(0.038, 0.145),
      new THREE.Vector2(0.032, 0.168),
    ];
    const beakGeo = new THREE.LatheGeometry(beakPts, 10);
    beakGeo.rotateX(-Math.PI / 2); // Tip points +Z
    const beakMesh = new THREE.Mesh(beakGeo, beakMat);
    beakMesh.scale.set(0.68, 1.08, 1.0);
    beakMesh.position.set(0, -0.005, 0.21);
    beakMesh.rotation.x = 0.12;
    beakMesh.castShadow = true;
    headPivot.add(beakMesh);

    // Tail + crimson undertail coverts
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.01, -0.08);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.018, 0.14), blackFeather);
    tail.rotation.x = -0.35;
    tail.position.set(0, -0.025, -0.05);
    const covert = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), redCovert);
    covert.position.set(0, -0.02, -0.015);
    tailPivot.add(tail, covert);
  } else if (speciesId === 'tiger') {
    const tigerCoatTex = getTigerCoatTexture();
    const tigerMat = stdMat('tiger_coat_mat', {
      map: tigerCoatTex,
      bumpMap: furBump,
      bumpScale: 0.016,
      roughness: 0.82,
      metalness: 0.01,
    });
    const whiteMat = stdMat('tiger_white', { color: '#F8EFE3', bumpMap: furBump, bumpScale: 0.014, roughness: 0.84, metalness: 0.01 });
    const darkMat = stdMat('tiger_dark', { color: '#1B1816', roughness: 0.82, metalness: 0.02 });
    const tigerWhiteCard = furCardMat('tiger_white', '#F8EFE3');
    const tigerCoatCard = furCardMat('tiger_coat', '#FFFFFF', tigerCoatTex);

    addContactShadow(root, 0.25, 0.3);
    rig.baseY = 0.24;
    bodyRoot.position.y = rig.baseY;

    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.36, 0.115],
        [-0.08, 0.112],
        [0.2, 0.14],
        [0.42, 0.115],
        [0.5, 0.02],
      ],
      0.5,
      0.86,
      0.92,
      tigerMat
    );
    bodyRoot.add(torso);

    const legH = 0.13;
    const shinH = 0.11;
    const legOffsets: Array<[keyof AnimalRig, keyof AnimalRig, number, number]> = [
      ['legFL', 'kneeFL', -0.075, 0.15],
      ['legFR', 'kneeFR', 0.075, 0.15],
      ['legBL', 'kneeBL', -0.075, -0.14],
      ['legBR', 'kneeBR', 0.075, -0.14],
    ];
    for (const [legKey, kneeKey, lx, lz] of legOffsets) {
      const { hip, knee } = makeTwoSegmentLeg(
        legH,
        shinH,
        0.041,
        0.028,
        0.024,
        tigerMat,
        tigerMat,
        whiteMat,
        false
      );
      hip.position.set(lx, -0.01, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.08, 0.22);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), tigerMat);
    skull.scale.set(1.04, 0.92, 1.05);
    skull.position.set(0, 0.02, 0.04);
    skull.castShadow = true;

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.048, 0.072), whiteMat);
    muzzle.position.set(0, -0.012, 0.11);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.018, 3), stdMat('tiger_nose', { color: '#C2594E', roughness: 0.4 }));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.005, 0.146);

    for (const side of [-1, 1]) {
      const ruff = new THREE.Mesh(new THREE.SphereGeometry(0.044, 8, 6), whiteMat);
      ruff.scale.set(0.8, 0.85, 0.45);
      ruff.position.set(side * 0.075, -0.005, 0.055);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), darkMat);
      ear.scale.set(0.8, 1.0, 0.5);
      ear.position.set(side * 0.068, 0.085, 0.02);
      headPivot.add(ruff, ear);
    }
    makeEyePair(headPivot, 0.042, 0.036, 0.098, 0.011, '#B45309');
    headPivot.add(skull, muzzle, nose);
    addFurTuftCards(headPivot, tigerWhiteCard, [
      { x: -0.098, y: -0.015, z: 0.055, w: 0.115, h: 0.088, rz: 1.45, ry: 0.25 },
      { x: 0.098, y: -0.015, z: 0.055, w: 0.115, h: 0.088, rz: -1.45, ry: -0.25 },
      { x: -0.08, y: -0.055, z: 0.065, w: 0.085, h: 0.065, rz: 2.05 },
      { x: 0.08, y: -0.055, z: 0.065, w: 0.085, h: 0.065, rz: -2.05 },
    ]);
    addFurTuftCards(headPivot, tigerCoatCard, [
      { x: 0, y: 0.092, z: 0.025, w: 0.11, h: 0.06, rx: -0.2 },
    ]);
    addFurTuftCards(bodyRoot, tigerCoatCard, [
      { x: 0, y: 0.125, z: 0.1, w: 0.19, h: 0.072, ry: Math.PI / 2 },
      { x: 0, y: 0.12, z: -0.02, w: 0.19, h: 0.07, ry: Math.PI / 2 },
      { x: 0, y: 0.115, z: -0.14, w: 0.18, h: 0.068, ry: Math.PI / 2 },
      { x: -0.1, y: 0.03, z: 0.08, w: 0.14, h: 0.068, ry: Math.PI / 2, rz: 1.25 },
      { x: 0.1, y: 0.03, z: 0.08, w: 0.14, h: 0.068, ry: Math.PI / 2, rz: -1.25 },
      { x: -0.095, y: 0.025, z: -0.09, w: 0.14, h: 0.065, ry: Math.PI / 2, rz: 1.25 },
      { x: 0.095, y: 0.025, z: -0.09, w: 0.14, h: 0.065, ry: Math.PI / 2, rz: -1.25 },
    ]);
    addFurTuftCards(bodyRoot, tigerWhiteCard, [
      { x: 0, y: -0.04, z: 0.16, w: 0.11, h: 0.075, rx: Math.PI * 0.85 },
    ]);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.02, -0.22);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.06, -0.11),
      new THREE.Vector3(0, -0.02, -0.22),
      new THREE.Vector3(0, 0.06, -0.28),
    ]);
    const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 12, 0.014, 6, false), tigerMat);
    tailMesh.castShadow = true;
    tailPivot.add(tailMesh);
  } else if (speciesId === 'elephant') {
    const skinMat = stdMat('elephant_skin_mat', {
      map: getElephantSkinTexture(),
      bumpMap: furBump,
      bumpScale: 0.008,
      roughness: 0.88,
      metalness: 0.01,
    });
    const ivoryMat = physMat('elephant_ivory', {
      color: '#F5EFE0',
      roughness: 0.28,
      metalness: 0.04,
      clearcoat: 0.4,
    });
    const nailMat = stdMat('elephant_nail', { color: '#D6D0C4', roughness: 0.72, metalness: 0.02 });

    addContactShadow(root, 0.34, 0.38);
    rig.baseY = 0.27;
    bodyRoot.position.y = rig.baseY;

    // Massive arched elephant torso
    const torso = makeOrganicTorso(
      [
        [-0.5, 0.03],
        [-0.36, 0.195],
        [0.0, 0.235],
        [0.32, 0.22],
        [0.46, 0.16],
        [0.5, 0.03],
      ],
      0.56,
      0.92,
      1.04,
      skinMat
    );
    bodyRoot.add(torso);

    // 4 pillar legs
    const legH = 0.14;
    const shinH = 0.13;
    const legOffsets: Array<[keyof AnimalRig, keyof AnimalRig, number, number]> = [
      ['legFL', 'kneeFL', -0.11, 0.16],
      ['legFR', 'kneeFR', 0.11, 0.16],
      ['legBL', 'kneeBL', -0.105, -0.15],
      ['legBR', 'kneeBR', 0.105, -0.15],
    ];
    for (const [legKey, kneeKey, lx, lz] of legOffsets) {
      const { hip, knee } = makeTwoSegmentLeg(
        legH,
        shinH,
        0.062,
        0.056,
        0.054,
        skinMat,
        skinMat,
        nailMat,
        true
      );
      hip.position.set(lx, -0.02, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.12, 0.26);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), skinMat);
    head.scale.set(0.95, 1.08, 1.0);
    head.castShadow = true;
    headPivot.add(head);

    // Broad fan ears pivoted on wingL / wingR for gentle ear flapping
    for (const [wingKey, side] of [
      ['wingL', -1],
      ['wingR', 1],
    ] as const) {
      const earPivot = new THREE.Group();
      earPivot.position.set(side * 0.12, 0.04, -0.02);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), skinMat);
      ear.scale.set(0.16, 1.15, 0.92);
      ear.position.set(side * 0.05, -0.01, -0.05);
      ear.rotation.y = side * 0.45;
      ear.castShadow = true;
      earPivot.add(ear);
      headPivot.add(earPivot);
      (rig[wingKey] as THREE.Group) = earPivot;
    }

    // Articulated flexible curved trunk pivoted via neckPivot
    const trunkPivot = new THREE.Group();
    trunkPivot.position.set(0, -0.02, 0.115);
    headPivot.add(trunkPivot);
    rig.neckPivot = trunkPivot;

    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.1, 0.06),
      new THREE.Vector3(0, -0.22, 0.07),
      new THREE.Vector3(0, -0.29, 0.12),
    ]);
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 12, 0.032, 8, false);
    const trunkMesh = new THREE.Mesh(trunkGeo, skinMat);
    trunkMesh.castShadow = true;
    trunkPivot.add(trunkMesh);

    // Curved ivory tusks
    for (const side of [-1, 1]) {
      const tuskCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.05, -0.05, 0.09),
        new THREE.Vector3(side * 0.065, -0.09, 0.18),
        new THREE.Vector3(side * 0.055, -0.05, 0.25),
      ]);
      const tusk = new THREE.Mesh(new THREE.TubeGeometry(tuskCurve, 8, 0.014, 6, false), ivoryMat);
      tusk.castShadow = true;
      headPivot.add(tusk);
    }
    makeEyePair(headPivot, 0.098, 0.045, 0.088, 0.012);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.04, -0.26);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.22, 6), skinMat);
    tail.position.set(0, -0.1, -0.02);
    tail.rotation.x = 0.2;
    tailPivot.add(tail);
  } else if (speciesId === 'hippo') {
    const hippoMat = physMat('hippo_skin', {
      color: '#6A616E',
      roughness: 0.46,
      metalness: 0.04,
      clearcoat: 0.32,
      clearcoatRoughness: 0.35,
    });
    const bellyMat = stdMat('hippo_belly', { color: '#9D8C96', roughness: 0.55, metalness: 0.02 });
    const nailMat = stdMat('hippo_nail', { color: '#D6D0C4', roughness: 0.68, metalness: 0.02 });

    addContactShadow(root, 0.28, 0.32);
    rig.baseY = 0.14;
    bodyRoot.position.y = rig.baseY;

    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.36, 0.15],
        [0.0, 0.175],
        [0.36, 0.16],
        [0.5, 0.02],
      ],
      0.52,
      1.04,
      0.92,
      hippoMat
    );
    bodyRoot.add(torso);

    const legPositions: Array<[keyof AnimalRig, number, number]> = [
      ['legFL', -0.095, 0.13],
      ['legFR', 0.095, 0.13],
      ['legBL', -0.095, -0.13],
      ['legBR', 0.095, -0.13],
    ];
    for (const [legKey, lx, lz] of legPositions) {
      const { hip } = makeTwoSegmentLeg(
        0.07,
        0.065,
        0.052,
        0.046,
        0.044,
        hippoMat,
        hippoMat,
        nailMat,
        true
      );
      hip.position.set(lx, -0.02, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.06, 0.23);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), hippoMat);
    cranium.scale.set(1.02, 0.92, 1.05);
    cranium.castShadow = true;

    const broadSnout = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.105, 0.125), bellyMat);
    broadSnout.position.set(0, -0.02, 0.1);
    broadSnout.castShadow = true;

    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), darkNoseMat);
      nostril.position.set(side * 0.038, 0.028, 0.15);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), hippoMat);
      ear.scale.set(0.65, 1.1, 0.5);
      ear.position.set(side * 0.068, 0.09, -0.02);
      headPivot.add(nostril, ear);
    }
    makeEyePair(headPivot, 0.068, 0.052, 0.055, 0.011);
    headPivot.add(cranium, broadSnout);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.01, -0.24);
    bodyRoot.add(tailPivot);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.09, 6), hippoMat);
    tail.rotation.x = -Math.PI * 0.7;
    tail.position.set(0, -0.02, -0.03);
    tailPivot.add(tail);
    rig.tailPivot = tailPivot;
  } else if (speciesId === 'koala') {
    const koalaTex = getKoalaFurTexture();
    const greyFur = stdMat('koala_grey', {
      map: koalaTex,
      bumpMap: furBump,
      bumpScale: 0.018,
      roughness: 0.9,
      metalness: 0.01,
    });
    const creamMat = stdMat('koala_cream', { color: '#EAE6DC', bumpMap: furBump, bumpScale: 0.015, roughness: 0.86, metalness: 0.01 });
    const koalaGreyCard = furCardMat('koala_grey', '#FFFFFF', koalaTex, 0.88);
    const koalaCreamCard = furCardMat('koala_cream', '#EFECE4');

    addContactShadow(root, 0.16, 0.18);
    rig.baseY = 0.12;
    bodyRoot.position.y = rig.baseY;

    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.3, 0.1],
        [0.08, 0.115],
        [0.4, 0.095],
        [0.5, 0.02],
      ],
      0.28,
      0.95,
      0.95,
      greyFur
    );
    torso.rotation.x = -0.35; // Slight sitting/clinging posture
    bodyRoot.add(torso);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 8), creamMat);
    chest.scale.set(0.85, 1.15, 0.65);
    chest.position.set(0, 0.0, 0.052);
    bodyRoot.add(chest);

    const legPositions: Array<[keyof AnimalRig, number, number]> = [
      ['legFL', -0.068, 0.08],
      ['legFR', 0.068, 0.08],
      ['legBL', -0.072, -0.07],
      ['legBR', 0.072, -0.07],
    ];
    for (const [legKey, lx, lz] of legPositions) {
      const { hip } = makeTwoSegmentLeg(
        0.065,
        0.055,
        0.032,
        0.026,
        0.022,
        greyFur,
        greyFur,
        darkNoseMat,
        false
      );
      hip.position.set(lx, -0.01, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.11, 0.1);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), greyFur);
    head.scale.set(1.04, 0.96, 0.98);
    head.castShadow = true;

    const largeNose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), darkNoseMat);
    largeNose.scale.set(0.82, 1.25, 0.72);
    largeNose.position.set(0, -0.004, 0.086);

    for (const side of [-1, 1]) {
      const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), greyFur);
      earOuter.scale.set(0.92, 1.0, 0.45);
      earOuter.position.set(side * 0.086, 0.048, 0.0);
      const earTuft = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), creamMat);
      earTuft.scale.set(0.92, 1.0, 0.4);
      earTuft.position.set(side * 0.086, 0.044, 0.014);
      headPivot.add(earOuter, earTuft);
    }
    makeEyePair(headPivot, 0.036, 0.02, 0.074, 0.0085);
    headPivot.add(head, largeNose);
    addFurTuftCards(headPivot, koalaCreamCard, [
      { x: -0.108, y: 0.06, z: 0.01, w: 0.11, h: 0.082, rz: 0.95 },
      { x: 0.108, y: 0.06, z: 0.01, w: 0.11, h: 0.082, rz: -0.95 },
      { x: -0.1, y: 0.015, z: 0.012, w: 0.092, h: 0.068, rz: 1.68 },
      { x: 0.1, y: 0.015, z: 0.012, w: 0.092, h: 0.068, rz: -1.68 },
      { x: -0.082, y: 0.086, z: 0.006, w: 0.075, h: 0.055, rz: 0.45 },
      { x: 0.082, y: 0.086, z: 0.006, w: 0.075, h: 0.055, rz: -0.45 },
      { x: -0.085, y: -0.025, z: 0.02, w: 0.078, h: 0.058, rz: 1.95 },
      { x: 0.085, y: -0.025, z: 0.02, w: 0.078, h: 0.058, rz: -1.95 },
    ]);
    addFurTuftCards(headPivot, koalaGreyCard, [
      { x: 0, y: 0.086, z: 0.0, w: 0.11, h: 0.068 },
      { x: 0, y: 0.075, z: -0.04, w: 0.1, h: 0.06, rx: -0.35 },
    ]);
    addFurTuftCards(bodyRoot, koalaGreyCard, [
      { x: 0, y: 0.095, z: 0.02, w: 0.15, h: 0.072, ry: Math.PI / 2 },
      { x: 0, y: 0.09, z: -0.08, w: 0.15, h: 0.07, ry: Math.PI / 2 },
      { x: -0.09, y: 0.02, z: -0.04, w: 0.13, h: 0.065, ry: Math.PI / 2, rz: 1.3 },
      { x: 0.09, y: 0.02, z: -0.04, w: 0.13, h: 0.065, ry: Math.PI / 2, rz: -1.3 },
      { x: 0, y: 0.03, z: -0.14, w: 0.11, h: 0.062, rx: -0.85 },
    ]);
  } else if (speciesId === 'flamingo') {
    const coralMat = stdMat('flamingo_coral', { color: '#EA7A88', roughness: 0.62, metalness: 0.02 });
    const paleMat = stdMat('flamingo_pale', { color: '#F7C2C7', roughness: 0.65, metalness: 0.02 });
    const legPink = stdMat('flamingo_leg', { color: '#D6697B', roughness: 0.55, metalness: 0.04 });
    const beakCream = stdMat('flamingo_beak', { color: '#F3E3D8', roughness: 0.45, metalness: 0.02 });

    addContactShadow(root, 0.14, 0.16);
    rig.baseY = 0.36;
    bodyRoot.position.y = rig.baseY;

    const body = makeOrganicTorso(
      [
        [-0.5, 0.015],
        [-0.25, 0.076],
        [0.15, 0.086],
        [0.42, 0.064],
        [0.5, 0.015],
      ],
      0.28,
      0.86,
      0.88,
      coralMat
    );
    bodyRoot.add(body);

    // Folded wings
    for (const [wingKey, side] of [
      ['wingL', -1],
      ['wingR', 1],
    ] as const) {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.068, 0.02, 0.02);
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), paleMat);
      wing.scale.set(0.28, 0.72, 1.65);
      wing.position.set(0, -0.01, -0.05);
      wingPivot.add(wing);
      bodyRoot.add(wingPivot);
      (rig[wingKey] as THREE.Group) = wingPivot;
    }

    // Long slender stilt legs (using legFL/legFR + kneeFL/kneeFR)
    for (const [legKey, kneeKey, lx] of [
      ['legFL', 'kneeFL', -0.036],
      ['legFR', 'kneeFR', 0.036],
    ] as const) {
      const { hip, knee } = makeTwoSegmentLeg(
        0.18,
        0.18,
        0.01,
        0.012,
        0.009,
        legPink,
        legPink,
        legPink,
        false
      );
      hip.position.set(lx, -0.03, 0.0);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    // S-curved slender flamingo neck
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.03, 0.11);
    bodyRoot.add(neckPivot);
    rig.neckPivot = neckPivot;

    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.08, 0.04),
      new THREE.Vector3(0, 0.18, -0.01),
      new THREE.Vector3(0, 0.27, 0.03),
    ]);
    const neckMesh = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 12, 0.015, 8, false), paleMat);
    neckMesh.castShadow = true;
    neckPivot.add(neckMesh);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.275, 0.035);
    neckPivot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8), paleMat);
    head.scale.set(0.9, 0.9, 1.15);

    const beakUpper = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.048, 8), beakCream);
    beakUpper.rotation.x = Math.PI / 2 + 0.45;
    beakUpper.position.set(0, -0.01, 0.045);

    const beakTip = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.038, 8), darkNoseMat);
    beakTip.rotation.x = Math.PI / 2 + 1.05;
    beakTip.position.set(0, -0.035, 0.068);

    makeEyePair(headPivot, 0.026, 0.008, 0.018, 0.0055);
    headPivot.add(head, beakUpper, beakTip);
  } else if (speciesId === 'cheetah') {
    const cheetahTex = getCheetahCoatTexture();
    const coatMat = stdMat('cheetah_coat', {
      map: cheetahTex,
      bumpMap: furBump,
      bumpScale: 0.014,
      roughness: 0.82,
      metalness: 0.02,
    });
    const creamMat = stdMat('cheetah_cream', { color: '#F5E7CC', roughness: 0.85, metalness: 0.01 });
    const cheetahCard = furCardMat('cheetah_coat', '#FFFFFF', cheetahTex, 0.84);

    addContactShadow(root, 0.22, 0.28);
    rig.baseY = 0.25;
    bodyRoot.position.y = rig.baseY;

    const torso = makeOrganicTorso(
      [
        [-0.5, 0.015],
        [-0.36, 0.088],
        [0.0, 0.086],
        [0.34, 0.1],
        [0.5, 0.02],
      ],
      0.46,
      0.78,
      0.88,
      coatMat
    );
    bodyRoot.add(torso);

    const legPositions: Array<[keyof AnimalRig, keyof AnimalRig, number, number]> = [
      ['legFL', 'kneeFL', -0.056, 0.16],
      ['legFR', 'kneeFR', 0.056, 0.16],
      ['legBL', 'kneeBL', -0.058, -0.15],
      ['legBR', 'kneeBR', 0.058, -0.15],
    ];
    for (const [legKey, kneeKey, lx, lz] of legPositions) {
      const { hip, knee } = makeTwoSegmentLeg(
        0.135,
        0.125,
        0.026,
        0.018,
        0.014,
        coatMat,
        coatMat,
        creamMat,
        false
      );
      hip.position.set(lx, -0.01, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.04, 0.2);
    bodyRoot.add(neckPivot);
    rig.neckPivot = neckPivot;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.056, 0.14, 10), coatMat);
    neck.position.set(0, 0.06, 0.02);
    neck.castShadow = true;
    neckPivot.add(neck);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.125, 0.03);
    neckPivot.add(headPivot);
    rig.headPivot = headPivot;

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), coatMat);
    cranium.scale.set(0.92, 0.9, 1.08);
    cranium.castShadow = true;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), creamMat);
    muzzle.scale.set(0.9, 0.72, 1.08);
    muzzle.position.set(0, -0.014, 0.052);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), darkNoseMat);
    nose.position.set(0, -0.005, 0.082);

    // Iconic cheetah black lacrimal tear-stripes from inner eye down to mouth
    const stripeMat = stdMat('cheetah_tear', { color: '#1A1512', roughness: 0.7, metalness: 0.02 });
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), coatMat);
      ear.scale.set(0.7, 1.0, 0.45);
      ear.position.set(side * 0.04, 0.05, -0.01);
      const tear = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0045, 0.036, 5), stripeMat);
      tear.position.set(side * 0.022, -0.006, 0.056);
      tear.rotation.x = 0.42;
      tear.rotation.z = side * -0.18;
      headPivot.add(ear, tear);
    }
    makeEyePair(headPivot, 0.028, 0.015, 0.044, 0.0075, '#B45309');
    headPivot.add(cranium, muzzle, nose);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.03, -0.22);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.05, -0.12),
      new THREE.Vector3(0, -0.02, -0.24),
      new THREE.Vector3(0, 0.03, -0.3),
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 10, 0.013, 6, false), coatMat);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), creamMat);
    tailTip.position.set(0, 0.03, -0.3);
    tailPivot.add(tail, tailTip);

    addFurTuftCards(bodyRoot, cheetahCard, [
      { x: 0, y: 0.092, z: 0.12, w: 0.15, h: 0.055, ry: Math.PI / 2 },
      { x: 0, y: 0.088, z: 0.0, w: 0.15, h: 0.052, ry: Math.PI / 2 },
      { x: 0, y: 0.084, z: -0.12, w: 0.15, h: 0.052, ry: Math.PI / 2 },
      { x: -0.072, y: 0.02, z: 0.06, w: 0.12, h: 0.048, ry: Math.PI / 2, rz: 1.3 },
      { x: 0.072, y: 0.02, z: 0.06, w: 0.12, h: 0.048, ry: Math.PI / 2, rz: -1.3 },
      { x: -0.068, y: 0.02, z: -0.09, w: 0.12, h: 0.048, ry: Math.PI / 2, rz: 1.3 },
      { x: 0.068, y: 0.02, z: -0.09, w: 0.12, h: 0.048, ry: Math.PI / 2, rz: -1.3 },
      { x: 0, y: -0.045, z: 0.14, w: 0.095, h: 0.058, rx: Math.PI * 0.85 },
    ]);
  } else if (speciesId === 'meerkat') {
    const meerkatTex = getMeerkatCoatTexture();
    const coatMat = stdMat('meerkat_coat', {
      map: meerkatTex,
      bumpMap: furBump,
      bumpScale: 0.014,
      roughness: 0.88,
      metalness: 0.01,
    });
    const creamMat = stdMat('meerkat_cream', { color: '#EFE0C6', roughness: 0.86, metalness: 0.01 });
    const maskMat = stdMat('meerkat_mask', { color: '#3B2A1A', roughness: 0.8, metalness: 0.02 });
    const meerkatCard = furCardMat('meerkat_coat', '#FFFFFF', meerkatTex, 0.88);

    addContactShadow(root, 0.12, 0.14);
    rig.baseY = 0.14;
    bodyRoot.position.y = rig.baseY;

    const torso = makeOrganicTorso(
      [
        [-0.5, 0.01],
        [-0.25, 0.054],
        [0.12, 0.052],
        [0.42, 0.042],
        [0.5, 0.012],
      ],
      0.22,
      0.86,
      0.88,
      coatMat
    );
    torso.rotation.x = -0.32;
    bodyRoot.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.044, 8, 6), creamMat);
    belly.scale.set(0.85, 1.35, 0.65);
    belly.position.set(0, 0.01, 0.032);
    bodyRoot.add(belly);

    const legPositions: Array<[keyof AnimalRig, number, number, number]> = [
      ['legFL', -0.036, 0.055, 0.045],
      ['legFR', 0.036, 0.055, 0.045],
      ['legBL', -0.04, -0.045, 0.06],
      ['legBR', 0.04, -0.045, 0.06],
    ];
    for (const [legKey, lx, lz, upperLen] of legPositions) {
      const { hip } = makeTwoSegmentLeg(
        upperLen,
        0.05,
        0.016,
        0.012,
        0.01,
        coatMat,
        creamMat,
        darkNoseMat,
        false
      );
      hip.position.set(lx, -0.02, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.1, 0.07);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), creamMat);
    head.scale.set(1.02, 0.92, 1.0);
    head.castShadow = true;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), coatMat);
    crown.scale.set(0.98, 0.72, 0.95);
    crown.position.set(0, 0.018, -0.008);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.036, 8), creamMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.006, 0.05);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), darkNoseMat);
    nose.position.set(0, -0.004, 0.068);

    for (const side of [-1, 1]) {
      const eyeMask = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), maskMat);
      eyeMask.scale.set(1.15, 0.9, 0.45);
      eyeMask.position.set(side * 0.02, 0.008, 0.04);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), maskMat);
      ear.scale.set(0.6, 0.9, 0.45);
      ear.position.set(side * 0.042, 0.012, -0.005);
      headPivot.add(eyeMask, ear);
    }
    makeEyePair(headPivot, 0.02, 0.008, 0.044, 0.0055);
    headPivot.add(head, crown, snout, nose);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.02, -0.08);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.005, 0.16, 6), coatMat);
    tail.position.set(0, -0.04, -0.055);
    tail.rotation.x = 0.9;
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), maskMat);
    tailTip.position.set(0, -0.09, -0.12);
    tailPivot.add(tail, tailTip);

    addFurTuftCards(headPivot, meerkatCard, [
      { x: -0.048, y: -0.005, z: 0.01, w: 0.052, h: 0.04, rz: 1.25 },
      { x: 0.048, y: -0.005, z: 0.01, w: 0.052, h: 0.04, rz: -1.25 },
      { x: 0, y: 0.044, z: -0.005, w: 0.055, h: 0.036, rx: -0.2 },
    ]);
    addFurTuftCards(bodyRoot, meerkatCard, [
      { x: 0, y: 0.05, z: -0.015, w: 0.11, h: 0.045, rx: -0.35, ry: Math.PI / 2 },
      { x: -0.044, y: 0.0, z: -0.01, w: 0.09, h: 0.04, ry: Math.PI / 2, rz: 1.35 },
      { x: 0.044, y: 0.0, z: -0.01, w: 0.09, h: 0.04, ry: Math.PI / 2, rz: -1.35 },
    ]);
  } else if (speciesId === 'polar_bear') {
    const bearTex = getPolarBearFurTexture();
    const furMat = stdMat('polar_bear_fur', {
      map: bearTex,
      bumpMap: furBump,
      bumpScale: 0.022,
      roughness: 0.9,
      metalness: 0.01,
    });
    const padMat = stdMat('polar_bear_pad', { color: '#C8D4DE', roughness: 0.85, metalness: 0.01 });
    const bearCard = furCardMat('polar_bear_fur', '#F8FAFC', bearTex, 0.9);

    addContactShadow(root, 0.28, 0.34);
    rig.baseY = 0.24;
    bodyRoot.position.y = rig.baseY;

    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.36, 0.15],
        [0.0, 0.16],
        [0.34, 0.145],
        [0.5, 0.02],
      ],
      0.54,
      0.94,
      0.95,
      furMat
    );
    bodyRoot.add(torso);

    const legPositions: Array<[keyof AnimalRig, keyof AnimalRig, number, number]> = [
      ['legFL', 'kneeFL', -0.088, 0.15],
      ['legFR', 'kneeFR', 0.088, 0.15],
      ['legBL', 'kneeBL', -0.092, -0.15],
      ['legBR', 'kneeBR', 0.092, -0.15],
    ];
    for (const [legKey, kneeKey, lx, lz] of legPositions) {
      const { hip, knee } = makeTwoSegmentLeg(
        0.115,
        0.105,
        0.052,
        0.042,
        0.038,
        furMat,
        furMat,
        padMat,
        false
      );
      hip.position.set(lx, -0.02, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.05, 0.24);
    bodyRoot.add(neckPivot);
    rig.neckPivot = neckPivot;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.098, 0.14, 10), furMat);
    neck.position.set(0, 0.04, 0.04);
    neck.castShadow = true;
    neckPivot.add(neck);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.08, 0.1);
    neckPivot.add(headPivot);
    rig.headPivot = headPivot;

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), furMat);
    cranium.scale.set(0.95, 0.9, 1.12);
    cranium.castShadow = true;
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.048, 0.09, 10), furMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, -0.015, 0.082);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), darkNoseMat);
    nose.position.set(0, -0.008, 0.128);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), furMat);
      ear.scale.set(0.85, 0.95, 0.55);
      ear.position.set(side * 0.058, 0.068, -0.015);
      headPivot.add(ear);
    }
    makeEyePair(headPivot, 0.036, 0.022, 0.064, 0.0085);
    headPivot.add(cranium, muzzle, nose);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.02, -0.26);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), furMat);
    tailPivot.add(tail);

    addFurTuftCards(headPivot, bearCard, [
      { x: -0.075, y: -0.01, z: 0.0, w: 0.085, h: 0.065, rz: 1.35 },
      { x: 0.075, y: -0.01, z: 0.0, w: 0.085, h: 0.065, rz: -1.35 },
      { x: 0, y: 0.075, z: -0.01, w: 0.095, h: 0.058 },
    ]);
    addFurTuftCards(bodyRoot, bearCard, [
      { x: 0, y: 0.15, z: 0.14, w: 0.2, h: 0.085, ry: Math.PI / 2 },
      { x: 0, y: 0.152, z: 0.0, w: 0.21, h: 0.085, ry: Math.PI / 2 },
      { x: 0, y: 0.15, z: -0.14, w: 0.2, h: 0.085, ry: Math.PI / 2 },
      { x: -0.14, y: 0.045, z: 0.12, w: 0.15, h: 0.078, rz: 1.35 },
      { x: 0.14, y: 0.045, z: 0.12, w: 0.15, h: 0.078, rz: -1.35 },
      { x: -0.145, y: 0.045, z: -0.02, w: 0.16, h: 0.078, ry: Math.PI / 2, rz: 1.35 },
      { x: 0.145, y: 0.045, z: -0.02, w: 0.16, h: 0.078, ry: Math.PI / 2, rz: -1.35 },
      { x: -0.14, y: 0.045, z: -0.14, w: 0.15, h: 0.078, rz: 1.35 },
      { x: 0.14, y: 0.045, z: -0.14, w: 0.15, h: 0.078, rz: -1.35 },
      { x: 0, y: -0.05, z: 0.2, w: 0.14, h: 0.09, rx: Math.PI * 0.85 },
      { x: -0.095, y: -0.085, z: 0.15, w: 0.09, h: 0.075, rz: 1.4 },
      { x: 0.095, y: -0.085, z: 0.15, w: 0.09, h: 0.075, rz: -1.4 },
    ]);
  } else if (speciesId === 'otter') {
    const otterTex = getOtterFurTexture();
    const furMat = physMat('otter_fur', {
      map: otterTex,
      bumpMap: furBump,
      bumpScale: 0.012,
      roughness: 0.45,
      metalness: 0.04,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
    });
    const creamMat = stdMat('otter_cream', { color: '#DEC8B4', roughness: 0.72, metalness: 0.02 });
    const otterCard = furCardMat('otter_fur', '#DEC8B4');

    addContactShadow(root, 0.16, 0.22);
    rig.baseY = 0.09;
    bodyRoot.position.y = rig.baseY;

    const torso = makeOrganicTorso(
      [
        [-0.5, 0.015],
        [-0.32, 0.072],
        [0.05, 0.078],
        [0.36, 0.068],
        [0.5, 0.015],
      ],
      0.38,
      0.95,
      0.78,
      furMat
    );
    bodyRoot.add(torso);

    const legPositions: Array<[keyof AnimalRig, number, number]> = [
      ['legFL', -0.055, 0.11],
      ['legFR', 0.055, 0.11],
      ['legBL', -0.06, -0.11],
      ['legBR', 0.06, -0.11],
    ];
    for (const [legKey, lx, lz] of legPositions) {
      const { hip } = makeTwoSegmentLeg(
        0.045,
        0.042,
        0.024,
        0.02,
        0.018,
        furMat,
        furMat,
        darkNoseMat,
        false
      );
      hip.position.set(lx, -0.01, lz);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.04, 0.18);
    bodyRoot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), furMat);
    head.scale.set(1.06, 0.88, 1.02);
    head.castShadow = true;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), creamMat);
    muzzle.scale.set(1.08, 0.72, 0.82);
    muzzle.position.set(0, -0.014, 0.038);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), darkNoseMat);
    nose.position.set(0, -0.005, 0.066);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), furMat);
      ear.position.set(side * 0.048, 0.022, -0.005);
      headPivot.add(ear);
    }
    makeEyePair(headPivot, 0.026, 0.014, 0.046, 0.0075);
    headPivot.add(head, muzzle, nose);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.005, -0.18);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.24, 8), furMat);
    tail.rotation.x = -Math.PI / 2 - 0.12;
    tail.scale.set(1.15, 1.0, 0.6);
    tail.position.set(0, -0.01, -0.11);
    tailPivot.add(tail);

    addFurTuftCards(headPivot, otterCard, [
      { x: -0.052, y: -0.01, z: 0.03, w: 0.058, h: 0.04, rz: 1.3 },
      { x: 0.052, y: -0.01, z: 0.03, w: 0.058, h: 0.04, rz: -1.3 },
      { x: 0, y: 0.044, z: -0.005, w: 0.06, h: 0.038 },
    ]);
    addFurTuftCards(bodyRoot, otterCard, [
      { x: 0, y: 0.058, z: 0.04, w: 0.14, h: 0.048, ry: Math.PI / 2 },
      { x: 0, y: 0.054, z: -0.08, w: 0.14, h: 0.048, ry: Math.PI / 2 },
      { x: -0.065, y: 0.01, z: -0.02, w: 0.13, h: 0.046, ry: Math.PI / 2, rz: 1.35 },
      { x: 0.065, y: 0.01, z: -0.02, w: 0.13, h: 0.046, ry: Math.PI / 2, rz: -1.35 },
    ]);
  } else if (speciesId === 'kangaroo') {
    const kangaTex = getKangarooFurTexture();
    const furMat = stdMat('kangaroo_fur', {
      map: kangaTex,
      bumpMap: furBump,
      bumpScale: 0.016,
      roughness: 0.85,
      metalness: 0.01,
    });
    const creamMat = stdMat('kangaroo_cream', { color: '#F2D7BF', roughness: 0.86, metalness: 0.01 });
    const kangaCard = furCardMat('kangaroo_fur', '#FFFFFF', kangaTex, 0.86);

    addContactShadow(root, 0.18, 0.24);
    rig.baseY = 0.22;
    bodyRoot.position.y = rig.baseY;

    // Muscular pear-shaped macropod torso angled upright
    const torso = makeOrganicTorso(
      [
        [-0.5, 0.02],
        [-0.25, 0.115],
        [0.05, 0.105],
        [0.36, 0.072],
        [0.5, 0.02],
      ],
      0.34,
      0.86,
      0.94,
      furMat
    );
    torso.rotation.x = -0.58;
    bodyRoot.add(torso);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), creamMat);
    chest.scale.set(0.84, 1.25, 0.65);
    chest.position.set(0, 0.02, 0.055);
    bodyRoot.add(chest);

    // Short forepaws
    for (const [legKey, side] of [
      ['legFL', -1],
      ['legFR', 1],
    ] as const) {
      const { hip } = makeTwoSegmentLeg(
        0.06,
        0.05,
        0.02,
        0.015,
        0.012,
        furMat,
        creamMat,
        darkNoseMat,
        false
      );
      hip.position.set(side * 0.056, 0.05, 0.1);
      hip.rotation.x = -0.35;
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
    }

    // Powerful hind legs + elongated kangaroo feet
    for (const [legKey, kneeKey, side] of [
      ['legBL', 'kneeBL', -1],
      ['legBR', 'kneeBR', 1],
    ] as const) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.072, -0.02, -0.05);

      const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), furMat);
      thigh.scale.set(0.75, 1.3, 1.15);
      thigh.position.set(0, -0.055, 0.01);
      thigh.castShadow = true;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.11, 0.02);
      hip.add(knee);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.1, 8), furMat);
      shin.position.set(0, -0.04, -0.01);
      shin.rotation.x = 0.25;
      shin.castShadow = true;

      const longFoot = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.02, 0.13), creamMat);
      longFoot.position.set(0, -0.088, 0.042);
      longFoot.castShadow = true;
      knee.add(shin, longFoot);

      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.12, 0.1);
    bodyRoot.add(neckPivot);
    rig.neckPivot = neckPivot;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.052, 0.11, 10), furMat);
    neck.position.set(0, 0.04, 0.015);
    neckPivot.add(neck);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.095, 0.025);
    neckPivot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), furMat);
    head.scale.set(0.88, 0.88, 1.25);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.055, 8), creamMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.008, 0.05);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), darkNoseMat);
    nose.position.set(0, -0.005, 0.078);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), furMat);
      ear.scale.set(0.5, 1.65, 0.35);
      ear.position.set(side * 0.03, 0.062, -0.01);
      ear.rotation.z = side * -0.22;
      headPivot.add(ear);
    }
    makeEyePair(headPivot, 0.028, 0.012, 0.032, 0.007);
    headPivot.add(head, snout, nose);

    // Heavy balancing tail
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.04, -0.11);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.08, -0.14),
      new THREE.Vector3(0, -0.12, -0.28),
      new THREE.Vector3(0, -0.08, -0.38),
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 10, 0.026, 8, false), furMat);
    tail.castShadow = true;
    tailPivot.add(tail);

    addFurTuftCards(bodyRoot, kangaCard, [
      { x: 0, y: 0.08, z: -0.02, w: 0.15, h: 0.062, ry: Math.PI / 2 },
      { x: 0, y: 0.03, z: -0.1, w: 0.14, h: 0.06, ry: Math.PI / 2, rx: -0.45 },
      { x: -0.095, y: -0.02, z: -0.05, w: 0.12, h: 0.068, rz: 1.4 },
      { x: 0.095, y: -0.02, z: -0.05, w: 0.12, h: 0.068, rz: -1.4 },
      { x: -0.08, y: 0.03, z: 0.03, w: 0.11, h: 0.058, ry: Math.PI / 2, rz: 1.3 },
      { x: 0.08, y: 0.03, z: 0.03, w: 0.11, h: 0.058, ry: Math.PI / 2, rz: -1.3 },
      { x: 0, y: -0.01, z: 0.09, w: 0.1, h: 0.068, rx: Math.PI * 0.85 },
    ]);
  } else if (speciesId === 'peacock') {
    const plumageTex = getPeacockPlumageTexture();
    const blueNeckMat = physMat('peacock_blue', {
      color: '#1D4ED8',
      roughness: 0.32,
      metalness: 0.25,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
    });
    const bodyEmeraldMat = physMat('peacock_emerald', {
      color: '#0D9488',
      roughness: 0.42,
      metalness: 0.18,
      clearcoat: 0.65,
    });
    const wingMat = stdMat('peacock_wing', { color: '#785A3C', roughness: 0.72, metalness: 0.05 });
    const legMat = stdMat('peacock_leg', { color: '#78716C', roughness: 0.65, metalness: 0.04 });
    const beakMat = stdMat('peacock_beak', { color: '#D97706', roughness: 0.45, metalness: 0.05 });
    const fanMat = new THREE.MeshStandardMaterial({
      map: plumageTex,
      roughness: 0.46,
      metalness: 0.14,
      side: THREE.DoubleSide,
    });

    addContactShadow(root, 0.15, 0.2);
    rig.baseY = 0.2;
    bodyRoot.position.y = rig.baseY;

    const body = makeOrganicTorso(
      [
        [-0.5, 0.015],
        [-0.25, 0.068],
        [0.12, 0.082],
        [0.42, 0.058],
        [0.5, 0.015],
      ],
      0.26,
      0.86,
      0.88,
      bodyEmeraldMat
    );
    bodyRoot.add(body);

    for (const [wingKey, side] of [
      ['wingL', -1],
      ['wingR', 1],
    ] as const) {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.064, 0.015, 0.02);
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), wingMat);
      wing.scale.set(0.28, 0.68, 1.55);
      wing.position.set(0, -0.01, -0.045);
      wingPivot.add(wing);
      bodyRoot.add(wingPivot);
      (rig[wingKey] as THREE.Group) = wingPivot;
    }

    for (const [legKey, kneeKey, lx] of [
      ['legFL', 'kneeFL', -0.032],
      ['legFR', 'kneeFR', 0.032],
    ] as const) {
      const { hip, knee } = makeTwoSegmentLeg(
        0.095,
        0.095,
        0.011,
        0.01,
        0.008,
        legMat,
        legMat,
        legMat,
        false
      );
      hip.position.set(lx, -0.03, 0.0);
      bodyRoot.add(hip);
      (rig[legKey] as THREE.Group) = hip;
      (rig[kneeKey] as THREE.Group) = knee;
    }

    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.03, 0.1);
    bodyRoot.add(neckPivot);
    rig.neckPivot = neckPivot;

    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.06, 0.035),
      new THREE.Vector3(0, 0.14, 0.01),
      new THREE.Vector3(0, 0.2, 0.025),
    ]);
    const neckMesh = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 10, 0.017, 8, false), blueNeckMat);
    neckMesh.castShadow = true;
    neckPivot.add(neckMesh);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.205, 0.028);
    neckPivot.add(headPivot);
    rig.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), blueNeckMat);
    head.scale.set(0.88, 0.92, 1.15);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.034, 6), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.004, 0.038);

    // 3 crown crest plumes
    for (const ang of [-0.25, 0, 0.25]) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.032, 4), blueNeckMat);
      pin.position.set(Math.sin(ang) * 0.012, 0.038, -0.004);
      pin.rotation.z = -ang;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), beakMat);
      tip.position.set(Math.sin(ang) * 0.018, 0.054, -0.004);
      headPivot.add(pin, tip);
    }
    makeEyePair(headPivot, 0.02, 0.006, 0.015, 0.005);
    headPivot.add(head, beak);

    // Spectacular articulated fan tail train (trails back while walking, swings upright & fans open in signature)
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.035, -0.1);
    bodyRoot.add(tailPivot);
    rig.tailPivot = tailPivot;

    const fanGeo = new THREE.CircleGeometry(0.32, 22, Math.PI * 0.12, Math.PI * 0.76);
    const fanMesh = new THREE.Mesh(fanGeo, fanMat);
    fanMesh.position.set(0, 0.04, 0);
    fanMesh.castShadow = true;
    tailPivot.add(fanMesh);
  }

  root.userData.rig = rig;
  return root;
}

/**
 * Smooth biomechanically authentic gait + nighttime resting pose + 14-species signature behaviors.
 * @param gaitBlend 0 = idle breathing/grazing, 1 = full locomotion stride
 * @param restBlend 0 = awake, 1 = curled/lying resting state
 * @param actionBlend 0..1 characteristic species-specific behavior blend
 */
export function animateAnimalRig(
  rig: AnimalRig,
  gaitBlend: number,
  walkPhase: number,
  idlePhase: number,
  restBlend = 0,
  actionBlend = 0
) {
  const { speciesId, bodyRoot, headPivot, neckPivot, tailPivot } = rig;
  const awake = 1 - restBlend;
  const act = actionBlend * awake;
  const sleepBreath = Math.sin(idlePhase * 1.15) * 0.006 * restBlend;

  if (speciesId === 'penguin') {
    const waddle = Math.sin(walkPhase);
    const cheerWave = Math.sin(idlePhase * 8.5);
    bodyRoot.rotation.z = waddle * 0.18 * gaitBlend * awake;
    bodyRoot.rotation.x = 0.12 * restBlend - 0.16 * act;
    bodyRoot.position.y =
      rig.baseY * (1 - restBlend * 0.35) +
      Math.abs(Math.cos(walkPhase)) * 0.014 * gaitBlend * awake +
      Math.max(0, cheerWave) * 0.025 * act +
      Math.sin(idlePhase * 2) * 0.004 * awake +
      sleepBreath;

    if (rig.footL) {
      rig.footL.rotation.x = Math.sin(walkPhase) * 0.35 * gaitBlend * awake;
      rig.footL.position.y = 0.032 + Math.max(0, Math.sin(walkPhase)) * 0.018 * gaitBlend * awake;
    }
    if (rig.footR) {
      rig.footR.rotation.x = -Math.sin(walkPhase) * 0.35 * gaitBlend * awake;
      rig.footR.position.y = 0.032 + Math.max(0, -Math.sin(walkPhase)) * 0.018 * gaitBlend * awake;
    }
    if (rig.wingL) {
      rig.wingL.rotation.z =
        (-0.15 - gaitBlend * (0.22 + waddle * 0.16)) * awake -
        (0.72 + cheerWave * 0.42) * act -
        0.05 * restBlend;
    }
    if (rig.wingR) {
      rig.wingR.rotation.z =
        (0.15 + gaitBlend * (0.22 - waddle * 0.16)) * awake +
        (0.72 + cheerWave * 0.42) * act +
        0.05 * restBlend;
    }
    if (headPivot) {
      headPivot.rotation.y = Math.sin(idlePhase * 0.8) * 0.22 * (1 - gaitBlend * 0.6) * awake;
      headPivot.rotation.x = 0.28 * restBlend - 0.38 * act;
      headPivot.rotation.z = -waddle * 0.08 * gaitBlend * awake + 0.12 * restBlend;
    }
    return;
  }

  if (speciesId === 'seal') {
    const scoot = Math.sin(walkPhase);
    const clap = Math.sin(idlePhase * 9.0);
    bodyRoot.position.y =
      rig.baseY * (1 - restBlend * 0.28) +
      Math.max(0, scoot) * 0.018 * gaitBlend * awake +
      0.032 * act +
      sleepBreath;
    bodyRoot.rotation.x = scoot * 0.11 * gaitBlend * awake - 0.32 * act;
    if (rig.flipperL) {
      rig.flipperL.rotation.y =
        (-0.15 + Math.cos(walkPhase) * 0.45 * gaitBlend) * awake +
        (0.45 + clap * 0.38) * act -
        0.35 * restBlend;
      rig.flipperL.rotation.z = Math.sin(walkPhase) * 0.18 * gaitBlend * awake + 0.42 * act;
    }
    if (rig.flipperR) {
      rig.flipperR.rotation.y =
        (0.15 - Math.cos(walkPhase) * 0.45 * gaitBlend) * awake -
        (0.45 + clap * 0.38) * act +
        0.35 * restBlend;
      rig.flipperR.rotation.z = -Math.sin(walkPhase) * 0.18 * gaitBlend * awake - 0.42 * act;
    }
    if (tailPivot) {
      tailPivot.rotation.y = Math.sin(walkPhase * 0.8 + idlePhase) * (0.14 + gaitBlend * 0.15) * awake;
      tailPivot.rotation.x = -scoot * 0.12 * gaitBlend * awake + 0.18 * act;
    }
    if (headPivot) {
      headPivot.rotation.y = Math.sin(idlePhase * 0.9) * 0.25 * (1 - gaitBlend * 0.5) * awake;
      headPivot.rotation.x =
        (-scoot * 0.08 * gaitBlend + Math.sin(idlePhase * 1.6) * 0.06) * awake -
        0.24 * act +
        0.22 * restBlend;
      headPivot.rotation.z = 0.15 * restBlend + Math.sin(idlePhase * 4.5) * 0.12 * act;
    }
    return;
  }

  if (speciesId === 'toucan') {
    const hop = Math.abs(Math.sin(walkPhase));
    const singBob = Math.sin(idlePhase * 6.5);
    bodyRoot.position.y =
      rig.baseY + (hop * 0.045 * gaitBlend + Math.sin(idlePhase * 2.2) * 0.005) * awake + sleepBreath * 0.5;
    bodyRoot.rotation.x = -0.15 * act;
    if (rig.wingL) {
      rig.wingL.rotation.z = -gaitBlend * (0.35 + Math.sin(walkPhase * 2) * 0.25) * awake - (0.78 + singBob * 0.18) * act;
    }
    if (rig.wingR) {
      rig.wingR.rotation.z = gaitBlend * (0.35 + Math.sin(walkPhase * 2) * 0.25) * awake + (0.78 + singBob * 0.18) * act;
    }
    if (headPivot) {
      headPivot.rotation.y = Math.sin(idlePhase * 1.4) * 0.35 * awake + 0.85 * restBlend;
      headPivot.rotation.x = 0.24 * restBlend + (-0.34 + singBob * 0.22) * act;
      headPivot.rotation.z = Math.sin(idlePhase * 0.9) * 0.16 * awake;
    }
    if (tailPivot) {
      tailPivot.rotation.x = (Math.sin(idlePhase * 2.2) * 0.08 - hop * 0.15 * gaitBlend + 0.25 * act) * awake;
    }
    return;
  }

  if (speciesId === 'flamingo') {
    const stride = Math.sin(walkPhase);
    const bob = Math.abs(Math.cos(walkPhase)) * 0.014 * gaitBlend * awake;
    const tuckBlend = Math.max(restBlend, act);
    bodyRoot.position.y =
      rig.baseY * (1 - restBlend * 0.12) + bob + Math.sin(idlePhase * 1.8) * 0.004 * awake + sleepBreath;
    if (rig.legFL) rig.legFL.rotation.x = stride * 0.36 * gaitBlend * awake - 0.1 * restBlend;
    if (rig.legFR) rig.legFR.rotation.x = -stride * 0.36 * gaitBlend * awake - 0.52 * tuckBlend;
    if (rig.kneeFL) rig.kneeFL.rotation.x = -Math.max(0, Math.cos(walkPhase)) * 0.55 * gaitBlend * awake;
    if (rig.kneeFR) rig.kneeFR.rotation.x = -Math.max(0, -Math.cos(walkPhase)) * 0.55 * gaitBlend * awake + 1.25 * tuckBlend;
    if (neckPivot) {
      neckPivot.rotation.x =
        (Math.sin(walkPhase) * 0.09 * gaitBlend + Math.sin(idlePhase * 0.9) * 0.08 * (1 - gaitBlend)) * awake +
        0.58 * act -
        0.35 * restBlend;
      neckPivot.rotation.y = Math.sin(idlePhase * 3.5) * 0.35 * act;
    }
    if (headPivot) {
      headPivot.rotation.y = Math.sin(idlePhase * 1.1) * 0.28 * awake + 0.72 * restBlend + 0.45 * act;
      headPivot.rotation.x = 0.42 * act;
    }
    return;
  }

  if (speciesId === 'peacock') {
    const stride = Math.sin(walkPhase);
    const bob = Math.abs(Math.cos(walkPhase)) * 0.012 * gaitBlend * awake;
    bodyRoot.position.y =
      rig.baseY * (1 - restBlend * 0.35) + bob + Math.sin(idlePhase * 1.9) * 0.004 * awake + sleepBreath;
    bodyRoot.rotation.x = 0.08 * restBlend - 0.1 * act;

    if (rig.legFL) rig.legFL.rotation.x = stride * 0.38 * gaitBlend * awake - 0.45 * restBlend;
    if (rig.legFR) rig.legFR.rotation.x = -stride * 0.38 * gaitBlend * awake - 0.45 * restBlend;
    if (rig.kneeFL) rig.kneeFL.rotation.x = -Math.max(0, Math.cos(walkPhase)) * 0.48 * gaitBlend * awake + 0.9 * restBlend;
    if (rig.kneeFR) rig.kneeFR.rotation.x = -Math.max(0, -Math.cos(walkPhase)) * 0.48 * gaitBlend * awake + 0.9 * restBlend;

    if (rig.wingL) rig.wingL.rotation.z = -0.06 - 0.26 * act;
    if (rig.wingR) rig.wingR.rotation.z = 0.06 + 0.26 * act;

    if (neckPivot) {
      neckPivot.rotation.x =
        (Math.sin(walkPhase) * 0.12 * gaitBlend + Math.sin(idlePhase * 1.2) * 0.07 * (1 - gaitBlend)) * awake -
        0.15 * act +
        0.25 * restBlend;
    }
    if (headPivot) {
      headPivot.rotation.y = Math.sin(idlePhase * 1.3) * 0.28 * awake + 0.65 * restBlend;
      headPivot.rotation.z = Math.sin(idlePhase * 3.8) * 0.12 * act;
    }
    if (tailPivot) {
      // Trail train backwards while walking/idle; fan dramatically upright when displaying (act -> 1)!
      tailPivot.rotation.x = THREE.MathUtils.lerp(1.26, 0.08, act) + 0.12 * restBlend;
      tailPivot.rotation.y = Math.sin(idlePhase * 4.2) * 0.16 * act + Math.sin(walkPhase) * 0.08 * gaitBlend * awake;
      const fanWidth = 0.34 + act * 0.85;
      const fanHeight = 0.82 + act * 0.35;
      tailPivot.scale.set(fanWidth, fanHeight, 1);
    }
    return;
  }

  if (speciesId === 'kangaroo') {
    // Synchronized macropod two-footed hop gait + upright boxing signature!
    const hopCycle = Math.max(0, Math.sin(walkPhase));
    const hopSwing = Math.sin(walkPhase);
    bodyRoot.position.y =
      rig.baseY * (1 - restBlend * 0.38) +
      hopCycle * 0.095 * gaitBlend * awake +
      Math.sin(idlePhase * 1.8) * 0.005 * awake +
      0.032 * act +
      sleepBreath;
    bodyRoot.rotation.x =
      (0.24 * gaitBlend - hopSwing * 0.14 * gaitBlend) * awake - 0.18 * act + 0.32 * restBlend;

    const hindSwing = hopSwing * 0.56 * gaitBlend * awake + 0.72 * restBlend;
    if (rig.legBL) rig.legBL.rotation.x = hindSwing;
    if (rig.legBR) rig.legBR.rotation.x = hindSwing;
    if (rig.kneeBL) rig.kneeBL.rotation.x = -hopCycle * 0.45 * gaitBlend * awake - 0.85 * restBlend;
    if (rig.kneeBR) rig.kneeBR.rotation.x = -hopCycle * 0.45 * gaitBlend * awake - 0.85 * restBlend;

    const boxJab = Math.sin(idlePhase * 10.5);
    if (rig.legFL) {
      rig.legFL.rotation.x = -0.35 - (0.55 + boxJab * 0.32) * act;
    }
    if (rig.legFR) {
      rig.legFR.rotation.x = -0.35 - (0.55 - boxJab * 0.32) * act;
    }
    if (neckPivot) {
      neckPivot.rotation.x = 0.12 + 0.25 * restBlend - 0.14 * act;
    }
    if (headPivot) {
      headPivot.rotation.y = Math.sin(idlePhase * 1.1) * 0.25 * awake + Math.sin(idlePhase * 3.2) * 0.22 * act;
      headPivot.rotation.x = 0.2 * restBlend;
    }
    if (tailPivot) {
      tailPivot.rotation.x = (-hopSwing * 0.22 * gaitBlend - 0.18 * act) * awake;
    }
    return;
  }

  // Quadruped biomechanics + folded resting posture + signature actions
  const pFL = walkPhase;
  const pBR = walkPhase + 0.28;
  const pFR = walkPhase + Math.PI;
  const pBL = walkPhase + Math.PI + 0.28;

  const strideAmp =
    speciesId === 'giraffe'
      ? 0.34
      : speciesId === 'cheetah'
      ? 0.5
      : speciesId === 'zebra' || speciesId === 'lion' || speciesId === 'tiger'
      ? 0.44
      : speciesId === 'elephant' || speciesId === 'hippo' || speciesId === 'polar_bear'
      ? 0.28
      : speciesId === 'red_panda' || speciesId === 'meerkat'
      ? 0.42
      : 0.32;

  const kneeBendAmp =
    speciesId === 'giraffe' || speciesId === 'zebra' || speciesId === 'cheetah'
      ? 0.58
      : speciesId === 'elephant' || speciesId === 'polar_bear'
      ? 0.34
      : 0.42;

  const restFoldFront = speciesId === 'elephant' || speciesId === 'giraffe' ? -0.45 : -0.92;
  const restFoldKneeF = speciesId === 'elephant' || speciesId === 'giraffe' ? 0.78 : 1.42;
  const restFoldBack = speciesId === 'elephant' || speciesId === 'giraffe' ? 0.42 : 0.85;
  const restFoldKneeB = speciesId === 'elephant' || speciesId === 'giraffe' ? -0.72 : -1.28;

  // Signature limb pose modifiers
  const isStandingRedPanda = speciesId === 'red_panda' ? act : 0;
  const isSittingPanda = speciesId === 'panda' ? act : 0;
  const isScratchKoala = speciesId === 'koala' ? act : 0;
  const isChillCapy = speciesId === 'capybara' ? act : 0;
  const isSentryMeerkat = speciesId === 'meerkat' ? act : 0;
  const isPlayOtter = speciesId === 'otter' ? act : 0;

  if (rig.legFL) {
    rig.legFL.rotation.x =
      Math.sin(pFL) * strideAmp * gaitBlend * awake +
      restFoldFront * restBlend -
      0.75 * isStandingRedPanda -
      0.55 * isSittingPanda -
      0.4 * isChillCapy -
      0.7 * isSentryMeerkat -
      0.55 * isPlayOtter;
  }
  if (rig.legFR) {
    rig.legFR.rotation.x =
      Math.sin(pFR) * strideAmp * gaitBlend * awake +
      restFoldFront * restBlend -
      0.75 * isStandingRedPanda -
      (0.55 + Math.sin(idlePhase * 7) * 0.2) * isSittingPanda -
      (0.85 + Math.sin(idlePhase * 9) * 0.18) * isScratchKoala -
      0.4 * isChillCapy -
      0.7 * isSentryMeerkat -
      (0.55 + Math.sin(idlePhase * 8) * 0.18) * isPlayOtter -
      (speciesId === 'polar_bear' ? Math.sin(idlePhase * 6.5) * 0.35 * act : 0);
  }
  if (rig.legBL) {
    rig.legBL.rotation.x =
      Math.sin(pBL) * strideAmp * gaitBlend * awake +
      restFoldBack * restBlend +
      0.55 * isStandingRedPanda +
      0.45 * isSittingPanda +
      0.35 * isChillCapy +
      0.55 * isSentryMeerkat +
      0.45 * isPlayOtter;
  }
  if (rig.legBR) {
    rig.legBR.rotation.x =
      Math.sin(pBR) * strideAmp * gaitBlend * awake +
      restFoldBack * restBlend +
      0.55 * isStandingRedPanda +
      0.45 * isSittingPanda +
      0.35 * isChillCapy +
      0.55 * isSentryMeerkat +
      0.45 * isPlayOtter;
  }

  if (rig.kneeFL) rig.kneeFL.rotation.x = Math.max(0, Math.cos(pFL)) * kneeBendAmp * gaitBlend * awake + restFoldKneeF * restBlend;
  if (rig.kneeFR) rig.kneeFR.rotation.x = Math.max(0, Math.cos(pFR)) * kneeBendAmp * gaitBlend * awake + restFoldKneeF * restBlend;
  if (rig.kneeBL) rig.kneeBL.rotation.x = -Math.max(0, Math.cos(pBL)) * (kneeBendAmp * 0.7) * gaitBlend * awake + restFoldKneeB * restBlend;
  if (rig.kneeBR) rig.kneeBR.rotation.x = -Math.max(0, Math.cos(pBR)) * (kneeBendAmp * 0.7) * gaitBlend * awake + restFoldKneeB * restBlend;

  const bounce = Math.abs(Math.sin(walkPhase)) * 0.018 * gaitBlend * awake;
  const breath = Math.sin(idlePhase * 2.0) * 0.004 * awake;
  const lieDownDrop =
    speciesId === 'giraffe'
      ? 0.44
      : speciesId === 'zebra' || speciesId === 'elephant' || speciesId === 'cheetah'
      ? 0.38
      : 0.54;

  const actionBodyY =
    isStandingRedPanda * 0.065 +
    isSentryMeerkat * 0.05 +
    isPlayOtter * 0.042 -
    isSittingPanda * 0.055 -
    isChillCapy * 0.032 -
    (speciesId === 'hippo' ? act * 0.015 : 0) +
    (speciesId === 'cheetah' ? -act * 0.04 : 0);

  bodyRoot.position.y =
    rig.baseY * (1 - restBlend * lieDownDrop) + bounce + breath + sleepBreath + actionBodyY;

  bodyRoot.rotation.x =
    -0.62 * isStandingRedPanda -
    0.46 * isSentryMeerkat -
    0.48 * isPlayOtter -
    0.26 * isSittingPanda -
    ((speciesId === 'lion' || speciesId === 'tiger' || speciesId === 'polar_bear') ? 0.14 * act : 0) +
    (speciesId === 'cheetah' ? 0.12 * act : 0);

  bodyRoot.rotation.z =
    Math.sin(walkPhase) *
      (speciesId === 'panda' || speciesId === 'capybara' || speciesId === 'hippo' || speciesId === 'elephant' || speciesId === 'polar_bear'
        ? 0.055
        : 0.028) *
      gaitBlend *
      awake +
    Math.sin(idlePhase * 3.5) * 0.09 * isSittingPanda +
    Math.sin(idlePhase * 6.5) * 0.12 * isPlayOtter +
    Math.sin(idlePhase * 2.2) * 0.08 * isScratchKoala;

  if (speciesId === 'elephant') {
    if (neckPivot) {
      neckPivot.rotation.x =
        Math.sin(idlePhase * 1.4 + walkPhase * 0.5) * 0.16 * awake - 0.78 * act - 0.18 * restBlend;
      neckPivot.rotation.z = Math.cos(idlePhase * 0.9) * 0.1 * awake + Math.sin(idlePhase * 4.5) * 0.24 * act;
    }
    if (rig.wingL) rig.wingL.rotation.y = (Math.sin(idlePhase * 1.5) * 0.18 + Math.sin(idlePhase * 5.2) * 0.34 * act) * awake;
    if (rig.wingR) rig.wingR.rotation.y = (-Math.sin(idlePhase * 1.5) * 0.18 - Math.sin(idlePhase * 5.2) * 0.34 * act) * awake;
  } else if (neckPivot) {
    const baseNeckX = speciesId === 'giraffe' ? 0.22 : 0.48;
    const actionNeckX =
      speciesId === 'zebra'
        ? 0.58 * act // dip down to graze
        : speciesId === 'giraffe'
        ? -0.18 * act // stretch up to canopy
        : 0;
    neckPivot.rotation.x =
      baseNeckX +
      actionNeckX +
      (Math.sin(walkPhase) * 0.08 * gaitBlend +
        Math.max(0, Math.sin(idlePhase * 0.6)) * 0.14 * (1 - gaitBlend)) *
        awake +
      0.35 * restBlend;
    if (speciesId === 'giraffe') {
      neckPivot.rotation.z = Math.sin(idlePhase * 3.0) * 0.1 * act;
    }
  }

  if (headPivot) {
    let actionHeadX = 0;
    let actionHeadY = 0;
    let actionHeadZ = 0;
    if (speciesId === 'lion' || speciesId === 'tiger' || speciesId === 'polar_bear') {
      actionHeadX = (-0.36 + Math.sin(idlePhase * 6) * 0.06) * act; // proud roar/sniff up
      actionHeadY = Math.sin(idlePhase * 3) * 0.16 * act;
    } else if (speciesId === 'cheetah') {
      actionHeadX = -0.18 * act; // intense stalk stare
      actionHeadY = Math.sin(idlePhase * 2.5) * 0.14 * act;
    } else if (speciesId === 'meerkat') {
      actionHeadX = 0.38 * act;
      actionHeadY = Math.sin(idlePhase * 3.8) * 0.62 * act; // horizon sentry scan!
    } else if (speciesId === 'otter') {
      actionHeadX = 0.34 * act;
      actionHeadZ = Math.sin(idlePhase * 5.2) * 0.14 * act;
    } else if (speciesId === 'hippo') {
      actionHeadX = -0.38 * act; // big yawn tilt up
      actionHeadZ = Math.sin(idlePhase * 3.5) * 0.12 * act;
    } else if (speciesId === 'giraffe' || speciesId === 'zebra') {
      actionHeadX = Math.sin(idlePhase * 9.5) * 0.15 * act; // leaf/grass nibble
    } else if (speciesId === 'panda') {
      actionHeadX = (0.18 + Math.sin(idlePhase * 8.5) * 0.15) * act; // bamboo munch
    } else if (speciesId === 'red_panda') {
      actionHeadX = 0.42 * act; // look level while torso reared up
      actionHeadY = Math.sin(idlePhase * 4) * 0.35 * act;
    } else if (speciesId === 'koala') {
      actionHeadZ = 0.28 * act;
    } else if (speciesId === 'capybara') {
      actionHeadZ = Math.sin(idlePhase * 2.2) * 0.07 * act; // yuzu wobble
      actionHeadX = Math.sin(idlePhase * 4.5) * 0.05 * act;
    }

    headPivot.rotation.x =
      (speciesId === 'zebra' ? -0.25 : 0) +
      (Math.sin(walkPhase + 0.5) * 0.07 * gaitBlend +
        Math.sin(idlePhase * 0.8) * 0.08 * (1 - gaitBlend)) *
        awake +
      actionHeadX +
      0.28 * restBlend;
    headPivot.rotation.y =
      Math.sin(idlePhase * 0.65) * 0.22 * (1 - gaitBlend * 0.7) * awake + actionHeadY;
    headPivot.rotation.z = 0.14 * restBlend + actionHeadZ;
  }

  if (tailPivot) {
    const tailActionAmp =
      speciesId === 'lion' ||
      speciesId === 'tiger' ||
      speciesId === 'zebra' ||
      speciesId === 'cheetah' ||
      speciesId === 'otter'
        ? 0.42 * act
        : 0;
    tailPivot.rotation.y =
      (Math.sin(idlePhase * 2.2 + walkPhase * 0.5) * (0.16 + gaitBlend * 0.18) +
        Math.sin(idlePhase * 7.5) * tailActionAmp) *
      awake;
    if (speciesId === 'red_panda') {
      tailPivot.rotation.x = (Math.sin(walkPhase * 2) * 0.08 * gaitBlend - 0.38 * isStandingRedPanda) * awake;
    }
  }
}
