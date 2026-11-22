import * as THREE from 'three';
import { VISITOR_ARCHETYPES } from '../data/zooCatalog';
import { VisitorInstance } from '../types/zoo';
import { getContactShadowTexture, getTouristShirtTexture } from './proceduralTextures';

export interface HumanRig {
  hipsPivot: THREE.Group;
  torsoPivot: THREE.Group;
  headPivot: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  baseHipsY: number;
  hasCane: boolean;
  hasBroom: boolean;
}

const humanMatPool = new Map<string, THREE.MeshStandardMaterial>();
function hMat(
  color: string | number,
  roughness = 0.74,
  metalness = 0.03,
  map?: THREE.Texture
): THREE.MeshStandardMaterial {
  const colStr = typeof color === 'number' ? color.toString(16) : color;
  const key = `${colStr}_${roughness.toFixed(2)}_${metalness.toFixed(2)}_${map ? map.uuid : 'none'}`;
  let m = humanMatPool.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness, map });
    humanMatPool.set(key, m);
  }
  return m;
}

function makeLimbSegment(
  topR: number,
  botR: number,
  len: number,
  mat: THREE.Material
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(topR, botR, len, 10);
  geo.translate(0, -len / 2, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function buildArticulatedHumanBase(options: {
  shirtColor: string;
  shirtMap?: THREE.Texture;
  pantsColor: string;
  skinColor: string;
  shoeColor: string;
  hairColor: string;
  hasCane?: boolean;
  hasBroom?: boolean;
  scale?: number;
}): { root: THREE.Group; rig: HumanRig } {
  const root = new THREE.Group();

  // Contact shadow disc grounded at y = 0.005
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.32),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  root.add(shadow);

  const shirtMat = hMat(options.shirtColor, 0.78, 0.02, options.shirtMap);
  const pantsMat = hMat(options.pantsColor, 0.84, 0.02);
  const skinMat = hMat(options.skinColor, 0.66, 0.02);
  const shoeMat = hMat(options.shoeColor, 0.56, 0.06);
  const hairMat = hMat(options.hairColor, 0.82, 0.03);
  const eyeMat = hMat('#18181B', 0.14, 0.06);

  // Realistic ~1:7.3 adult head-to-height proportions
  const thighLen = 0.21;
  const shinLen = 0.205;
  const baseHipsY = thighLen + shinLen + 0.018;

  const hipsPivot = new THREE.Group();
  hipsPivot.position.y = baseHipsY;
  root.add(hipsPivot);

  // Pelvis / Waist
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.072, 0.07, 12), pantsMat);
  pelvis.scale.set(1.16, 1, 0.78);
  pelvis.castShadow = true;
  hipsPivot.add(pelvis);

  // Articulated realistic legs (Hip -> Thigh -> Knee -> Shin -> Shoe)
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.044, -0.02, 0);
    hipsPivot.add(hip);

    const thigh = makeLimbSegment(0.036, 0.026, thighLen, pantsMat);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -thighLen;
    hip.add(knee);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), pantsMat);
    knee.add(kneeCap);

    const shin = makeLimbSegment(0.025, 0.019, shinLen, pantsMat);
    knee.add(shin);

    // Sculpted realistic shoe
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.026, 0.095), shoeMat);
    shoe.position.set(0, -shinLen, 0.022);
    shoe.castShadow = true;
    knee.add(shoe);

    return { hip, knee };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Spine & Realistic Torso
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.028;
  hipsPivot.add(torsoPivot);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.063, 0.26, 12), shirtMat);
  torso.scale.set(1.18, 1, 0.72);
  torso.position.y = 0.135;
  torso.castShadow = true;
  torsoPivot.add(torso);

  // Collar / Shoulders cap
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.084, 12, 8), shirtMat);
  shoulders.scale.set(1.26, 0.36, 0.72);
  shoulders.position.y = 0.25;
  torsoPivot.add(shoulders);

  // Neck & Realistic Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.046, 8), skinMat);
  neck.position.y = 0.285;
  torsoPivot.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.312;
  torsoPivot.add(headPivot);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), skinMat);
  cranium.scale.set(0.9, 1.08, 0.96);
  cranium.position.y = 0.046;
  cranium.castShadow = true;
  headPivot.add(cranium);

  // Realistic subtle nose & natural eyes
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.018, 5), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.042, 0.055);
  headPivot.add(nose);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 6, 6), eyeMat);
    eye.position.set(side * 0.02, 0.052, 0.05);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), skinMat);
    ear.scale.set(0.4, 1.0, 0.65);
    ear.position.set(side * 0.052, 0.045, 0.0);
    headPivot.add(eye, ear);
  }

  // Hair cap
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.059, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  hairBack.position.set(0, 0.05, -0.005);
  hairBack.rotation.x = -0.24;
  headPivot.add(hairBack);

  // Articulated Arms (Shoulder -> UpperArm -> Elbow -> Forearm -> Hand)
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.102, 0.242, 0);
    torsoPivot.add(shoulder);

    const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), shirtMat);
    shoulder.add(sleeve);

    const upperArm = makeLimbSegment(0.021, 0.018, 0.135, shirtMat);
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.135;
    shoulder.add(elbow);

    const forearm = makeLimbSegment(0.017, 0.014, 0.125, skinMat);
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), skinMat);
    hand.position.y = -0.128;
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  if (options.scale) {
    root.scale.setScalar(options.scale);
  }

  const rig: HumanRig = {
    hipsPivot,
    torsoPivot,
    headPivot,
    hipL: leftLeg.hip,
    hipR: rightLeg.hip,
    kneeL: leftLeg.knee,
    kneeR: rightLeg.knee,
    shoulderL: leftArm.shoulder,
    shoulderR: rightArm.shoulder,
    elbowL: leftArm.elbow,
    elbowR: rightArm.elbow,
    baseHipsY,
    hasCane: Boolean(options.hasCane),
    hasBroom: Boolean(options.hasBroom),
  };

  root.userData.humanRig = rig;
  return { root, rig };
}

export function buildVisitorMesh(visitor: VisitorInstance): THREE.Group {
  const spec = VISITOR_ARCHETYPES[visitor.archetype];
  const shirtMap = visitor.archetype === 'tourist' ? getTouristShirtTexture() : undefined;
  const pantsColor =
    visitor.archetype === 'explorer'
      ? '#5C5449'
      : visitor.archetype === 'tourist'
      ? '#B7A489'
      : visitor.archetype === 'elder'
      ? '#47505A'
      : '#2E3742';
  const hairColor =
    visitor.archetype === 'elder'
      ? '#CBD5E1'
      : visitor.archetype === 'child'
      ? '#3F2B1E'
      : '#221F1D';
  const shoeColor =
    visitor.archetype === 'explorer'
      ? '#5D3D24'
      : visitor.archetype === 'child'
      ? '#A64D4D'
      : '#1F2429';

  const { root, rig } = buildArticulatedHumanBase({
    shirtColor: visitor.archetype === 'tourist' ? '#FFFFFF' : visitor.color,
    shirtMap,
    pantsColor,
    skinColor: visitor.skinColor,
    shoeColor,
    hairColor,
    hasCane: visitor.archetype === 'elder',
    scale: spec.scale,
  });

  if (visitor.archetype === 'explorer') {
    const vest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.068, 0.21, 12),
      hMat('#A8926D', 0.84, 0.02)
    );
    vest.scale.set(1.2, 1, 0.78);
    vest.position.y = 0.14;
    rig.torsoPivot.add(vest);

    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.2, 0.075),
      hMat('#5E442F', 0.86, 0.03)
    );
    pack.position.set(0, 0.15, -0.088);
    pack.castShadow = true;
    rig.torsoPivot.add(pack);

    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.12, 0.012, 14),
      hMat('#BFA780', 0.82, 0.02)
    );
    brim.position.set(0, 0.086, 0);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hMat('#B2976F', 0.82, 0.02)
    );
    crown.position.set(0, 0.086, 0);
    rig.headPivot.add(brim, crown);
  } else if (visitor.archetype === 'photographer') {
    const vest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.068, 0.2, 12),
      hMat('#3F3F46', 0.82, 0.04)
    );
    vest.scale.set(1.2, 1, 0.78);
    vest.position.y = 0.14;
    rig.torsoPivot.add(vest);

    const camBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.044, 0.035),
      hMat('#18181B', 0.35, 0.5)
    );
    camBody.position.set(0, 0.16, 0.075);
    const camLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.055, 10),
      hMat('#64748B', 0.25, 0.78)
    );
    camLens.rotation.x = Math.PI / 2;
    camLens.position.set(0, 0.16, 0.11);
    rig.torsoPivot.add(camBody, camLens);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hMat('#27272A', 0.76, 0.03)
    );
    cap.position.y = 0.06;
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.066, 0.01, 10, 1, false, -0.8, 1.6),
      hMat('#18181B', 0.76, 0.03)
    );
    visor.position.set(0, 0.062, 0.036);
    rig.headPivot.add(cap, visor);
  } else if (visitor.archetype === 'child') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hMat('#D4A64A', 0.7, 0.03)
    );
    cap.position.y = 0.06;
    rig.headPivot.add(cap);

    const miniPack = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.15, 0.058),
      hMat('#4C6E85', 0.75, 0.03)
    );
    miniPack.position.set(0, 0.14, -0.078);
    rig.torsoPivot.add(miniPack);
  } else if (visitor.archetype === 'elder') {
    const glasses = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.012, 0.015),
      hMat('#27272A', 0.25, 0.7)
    );
    glasses.position.set(0, 0.052, 0.055);
    rig.headPivot.add(glasses);

    // Walking cane in right hand
    const caneShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.007, 0.36, 6),
      hMat('#5C3A21', 0.55, 0.1)
    );
    caneShaft.position.set(0, -0.28, 0.02);
    const caneHook = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.014, 0.04),
      hMat('#78350F', 0.5, 0.15)
    );
    caneHook.position.set(0, -0.1, 0.01);
    rig.elbowR.add(caneShaft, caneHook);
  } else if (visitor.archetype === 'tourist') {
    const strawBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.132, 0.011, 14),
      hMat('#DFCFA4', 0.85, 0.02)
    );
    strawBrim.position.y = 0.084;
    const strawCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.062, 0.044, 12),
      hMat('#D4C191', 0.84, 0.02)
    );
    strawCrown.position.y = 0.106;
    const ribbon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.063, 0.063, 0.012, 12),
      hMat('#7F2D2D', 0.72, 0.03)
    );
    ribbon.position.y = 0.092;
    const sunglasses = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.016, 0.018),
      hMat('#18181B', 0.18, 0.5)
    );
    sunglasses.position.set(0, 0.052, 0.055);
    rig.headPivot.add(strawBrim, strawCrown, ribbon, sunglasses);
  } else if (visitor.archetype === 'student') {
    // student: realistic shoulder tote bag
    const satchel = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.14, 0.13),
      hMat('#785A3C', 0.78, 0.03)
    );
    satchel.position.set(-0.088, 0.06, 0);
    rig.torsoPivot.add(satchel);
  } else if (visitor.archetype === 'couple') {
    // Soft knit neck scarf & small crossbody bag
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.042, 0.015, 8, 14),
      hMat('#F4E8DF', 0.85, 0.01)
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.275;
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, 0.09, 0.095),
      hMat('#9E5B5B', 0.72, 0.04)
    );
    bag.position.set(0.085, 0.04, 0.01);
    rig.torsoPivot.add(scarf, bag);
  } else if (visitor.archetype === 'artist') {
    // French beret + wooden sketch easel board carried at side
    const beret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.056, 0.024, 14),
      hMat('#7F2D3A', 0.84, 0.02)
    );
    beret.position.set(-0.01, 0.088, -0.005);
    beret.rotation.z = 0.18;
    rig.headPivot.add(beret);

    const sketchBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.18, 0.14),
      hMat('#C9A875', 0.78, 0.03)
    );
    sketchBoard.position.set(-0.092, 0.1, 0.01);
    const canvasPage = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.14, 0.11),
      hMat('#FAF7EE', 0.85, 0.01)
    );
    canvasPage.position.set(-0.092, 0.1, 0.01);
    rig.torsoPivot.add(sketchBoard, canvasPage);
  } else if (visitor.archetype === 'researcher') {
    // Field vest, round spectacles & clipboard in left hand
    const labVest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.068, 0.22, 12),
      hMat('#D4CEBE', 0.8, 0.02)
    );
    labVest.scale.set(1.2, 1, 0.78);
    labVest.position.y = 0.135;
    rig.torsoPivot.add(labVest);

    const glasses = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.013, 0.014),
      hMat('#1F2937', 0.25, 0.72)
    );
    glasses.position.set(0, 0.052, 0.055);
    rig.headPivot.add(glasses);

    const clipboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.012, 0.13),
      hMat('#7A5434', 0.75, 0.03)
    );
    clipboard.position.set(0, -0.14, 0.045);
    const notes = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.015, 0.1),
      hMat('#FFFFFF', 0.85, 0.01)
    );
    notes.position.set(0, -0.138, 0.045);
    rig.elbowL.add(clipboard, notes);
  } else if (visitor.archetype === 'runner') {
    // Sporty headband + hydration bottle in hand
    const headband = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.018, 14),
      hMat('#F59E0B', 0.65, 0.05)
    );
    headband.position.y = 0.066;
    rig.headPivot.add(headband);

    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.085, 8),
      hMat('#0EA5E9', 0.3, 0.12)
    );
    bottle.position.set(0, -0.14, 0.025);
    rig.elbowR.add(bottle);
  } else if (visitor.archetype === 'foodie') {
    // Iced cup with straw + kraft snack bag
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.017, 0.065, 8),
      hMat('#FDE68A', 0.4, 0.04)
    );
    cup.position.set(0, -0.135, 0.022);
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 0.04, 5),
      hMat('#EF4444', 0.5, 0.05)
    );
    straw.position.set(0, -0.095, 0.022);
    rig.elbowR.add(cup, straw);

    const snackBag = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.1, 0.08),
      hMat('#C99F68', 0.84, 0.01)
    );
    snackBag.position.set(0, -0.16, 0.01);
    rig.elbowL.add(snackBag);
  } else if (visitor.archetype === 'vip') {
    // Tailored dark fedora with gold band & tinted sunglasses
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098, 0.104, 0.01, 14),
      hMat('#1E293B', 0.55, 0.08)
    );
    brim.position.y = 0.084;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.058, 0.048, 12),
      hMat('#1E293B', 0.55, 0.08)
    );
    crown.position.y = 0.11;
    const goldBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.059, 0.059, 0.011, 12),
      hMat('#EAB308', 0.25, 0.85)
    );
    goldBand.position.y = 0.092;
    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.016, 0.018),
      hMat('#111827', 0.15, 0.6)
    );
    shades.position.set(0, 0.052, 0.055);
    rig.headPivot.add(brim, crown, goldBand, shades);

    const lapel = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.14, 0.018),
      hMat('#EAB308', 0.3, 0.78)
    );
    lapel.position.set(0, 0.16, 0.052);
    rig.torsoPivot.add(lapel);
  }

  return root;
}

/**
 * Animal Caregiver (動物照顧人員): Khaki-olive field uniform, ranger hat, feed bucket
 */
export function buildKeeperMesh(): THREE.Group {
  const { root, rig } = buildArticulatedHumanBase({
    shirtColor: '#4E6B48',
    pantsColor: '#453F35',
    skinColor: '#E5BFA4',
    shoeColor: '#2E2318',
    hairColor: '#2C221A',
    scale: 1.0,
  });

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.024, 12),
    hMat('#3E2717', 0.6, 0.1)
  );
  belt.scale.set(1.18, 1, 0.76);
  belt.position.y = 0.012;
  rig.torsoPivot.add(belt);

  // Caregiver wide-brim hat
  const hatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.12, 0.012, 14),
    hMat('#8A714E', 0.82, 0.02)
  );
  hatBrim.position.y = 0.086;
  const hatCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.064, 0.048, 10),
    hMat('#786040', 0.82, 0.02)
  );
  hatCrown.position.y = 0.11;
  rig.headPivot.add(hatBrim, hatCrown);

  // Stainless steel animal feed bucket in left hand
  const bucketMat = hMat('#94A3B8', 0.3, 0.75);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.038, 0.095, 10), bucketMat);
  bucket.position.set(0, -0.175, 0.01);
  bucket.castShadow = true;
  rig.elbowL.add(bucket);

  return root;
}

/**
 * Park Cleaner (園區清潔人員): Light slate-blue sanitation shirt, high-vis trim, cap, 3D broom
 */
export function buildCleanerMesh(): THREE.Group {
  const { root, rig } = buildArticulatedHumanBase({
    shirtColor: '#3B7EA1',
    pantsColor: '#273444',
    skinColor: '#ECC8AE',
    shoeColor: '#1E242B',
    hairColor: '#24201E',
    hasBroom: true,
    scale: 0.99,
  });

  // Reflective safety sash/vest accent
  const vest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.079, 0.067, 0.19, 12),
    hMat('#D9A520', 0.55, 0.08)
  );
  vest.scale.set(1.2, 1, 0.76);
  vest.position.y = 0.145;
  rig.torsoPivot.add(vest);

  // Sanitation peaked cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hMat('#1E4E6E', 0.74, 0.04)
  );
  cap.position.y = 0.06;
  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.066, 0.01, 10, 1, false, -0.8, 1.6),
    hMat('#173E59', 0.74, 0.04)
  );
  visor.position.set(0, 0.062, 0.036);
  rig.headPivot.add(cap, visor);

  // 3D Wooden Push Broom held in right hand
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.56, 6),
    hMat('#9A6E44', 0.72, 0.03)
  );
  handle.position.set(0.01, -0.18, 0.04);
  handle.rotation.x = 0.35;
  handle.castShadow = true;

  const broomHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.03, 0.045),
    hMat('#78350F', 0.8, 0.04)
  );
  broomHead.position.set(0.01, -0.44, 0.13);
  broomHead.rotation.x = 0.35;

  const bristles = new THREE.Mesh(
    new THREE.BoxGeometry(0.142, 0.042, 0.042),
    hMat('#D6B87A', 0.9, 0.01)
  );
  bristles.position.set(0.01, -0.47, 0.142);
  bristles.rotation.x = 0.35;
  rig.elbowR.add(handle, broomHead, bristles);

  return root;
}

/**
 * Natural human walk cycle with knee bend, opposite arm swing, hip bounce, pelvic twist, and idle breathing
 */
export function animateHumanRig(
  rig: HumanRig,
  gaitBlend: number,
  walkPhase: number,
  idlePhase: number,
  lookUp = false
) {
  const stride = Math.sin(walkPhase);
  const strideOpp = Math.sin(walkPhase + Math.PI);

  const walkBob = (1 - Math.cos(walkPhase * 2)) * 0.014 * gaitBlend;
  const idleBreath = Math.sin(idlePhase * 2.0) * 0.003 * (1 - gaitBlend);
  rig.hipsPivot.position.y = rig.baseHipsY + walkBob + idleBreath;

  rig.hipsPivot.rotation.y = stride * 0.07 * gaitBlend;
  rig.hipsPivot.rotation.z = Math.cos(walkPhase) * 0.03 * gaitBlend;

  rig.torsoPivot.rotation.y = -stride * 0.08 * gaitBlend;
  const stargazeLean = lookUp ? -0.07 * (1 - gaitBlend) : 0;
  rig.torsoPivot.rotation.x =
    0.035 * gaitBlend + Math.sin(idlePhase * 1.3) * 0.012 * (1 - gaitBlend) + stargazeLean;

  const legAmp = 0.45 * gaitBlend;
  rig.hipL.rotation.x = stride * legAmp;
  rig.hipR.rotation.x = strideOpp * legAmp;

  rig.kneeL.rotation.x = Math.max(0, Math.cos(walkPhase)) * 0.56 * gaitBlend;
  rig.kneeR.rotation.x = Math.max(0, -Math.cos(walkPhase)) * 0.56 * gaitBlend;

  const armAmp = 0.34 * gaitBlend;
  rig.shoulderL.rotation.x = strideOpp * armAmp;
  rig.elbowL.rotation.x = -0.16 * gaitBlend - Math.max(0, strideOpp) * 0.22 * gaitBlend;

  if (rig.hasCane) {
    rig.shoulderR.rotation.x = -0.2 + stride * 0.2 * gaitBlend;
    rig.elbowR.rotation.x = -0.32;
  } else if (rig.hasBroom) {
    // Sweeps gently when paused, holds steady when walking
    const sweep = Math.sin(idlePhase * 3.4) * 0.16 * (1 - gaitBlend);
    rig.shoulderR.rotation.x = -0.25 + stride * 0.18 * gaitBlend + sweep;
    rig.shoulderR.rotation.z = Math.cos(idlePhase * 3.4) * 0.1 * (1 - gaitBlend);
    rig.elbowR.rotation.x = -0.32;
  } else {
    rig.shoulderR.rotation.x = stride * armAmp;
    rig.elbowR.rotation.x = -0.16 * gaitBlend - Math.max(0, stride) * 0.22 * gaitBlend;
  }

  if (lookUp && gaitBlend < 0.25) {
    rig.headPivot.rotation.y = Math.sin(idlePhase * 0.45) * 0.16;
    rig.headPivot.rotation.x = -0.44 + Math.sin(idlePhase * 0.85) * 0.05;
  } else {
    rig.headPivot.rotation.y = Math.sin(idlePhase * 0.7) * 0.22;
    rig.headPivot.rotation.x = Math.sin(idlePhase * 1.2) * 0.04 - 0.02 * gaitBlend;
  }
}
