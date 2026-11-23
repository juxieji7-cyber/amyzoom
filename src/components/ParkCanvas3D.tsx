import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Compass,
  RotateCcw,
  Eye,
  Camera,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  Heart,
  Paintbrush,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { GATE_POS, GRID_COLS, GRID_ROWS } from '../data/zooCatalog';
import {
  BuildTool,
  FloatingPopup,
  KeeperInstance,
  ParkTile,
  PendingPhotoCapture,
  SeasonalEventId,
  SpeciesId,
  VisitorInstance,
  WeatherType,
} from '../types/zoo';
import {
  animateAnimalRig,
  animateHumanRig,
  AnimalRig,
  build3DGrassField,
  buildAnimalMesh,
  buildCleanerMesh,
  buildFacilityMesh,
  buildHabitatVegetationLayer,
  buildHabitatZoneMesh,
  buildKeeperMesh,
  buildSeasonalTileOverlay,
  buildSurroundingEnvironment,
  buildVisitorMesh,
  getHabitatPropColliders,
  gridToWorld,
  HumanRig,
  shouldShowSeasonalTileEffect,
  TILE_SIZE,
} from '../three/zooModels';
import {
  getHeatMirageTexture,
  getPuddleMaskTexture,
  getRainRippleRingTexture,
  getWaterRippleTexture,
} from '../three/proceduralTextures';
import { soundFX } from '../utils/sound';

import { getHabitatVegetationInfo, getVisitorMoodInfo } from '../utils/parkLogic';

interface ParkCanvas3DProps {
  grid: ParkTile[][];
  weather: WeatherType;
  seasonalEvent: SeasonalEventId | null;
  isNight: boolean;
  avgVisitorMood: number;
  speed: 0 | 1 | 2;
  photoMode: boolean;
  activeTool: BuildTool;
  selectedPos: { x: number; y: number } | null;
  selectedVisitorId: string | null;
  goldenGuideUnlocked?: boolean;
  visitors: VisitorInstance[];
  keepers: KeeperInstance[];
  popups: FloatingPopup[];
  pendingPhotoCaptures?: PendingPhotoCapture[];
  onPhotoCaptured?: (photoId: string, dataUrl: string) => void;
  onTileClick: (x: number, y: number) => void;
  onTilePaintDrag: (x: number, y: number) => void;
  onSelectVisitor: (visitorId: string | null) => void;
  onEnterPhotoMode: () => void;
  onExitPhotoMode: () => void;
}

interface ProjectedLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  subText?: string;
  dialogue?: string;
  nextFacility?: string;
  moodPct?: number;
  moodTone?: 'emerald' | 'sky' | 'amber' | 'rose';
  selected?: boolean;
  kind: 'popup' | 'thought' | 'alert' | 'heart' | 'stargaze' | 'visitor' | 'weather_comfort';
  tone?: FloatingPopup['tone'];
  weatherType?: 'rainy' | 'heatwave';
}

interface AnimalActorEntry {
  mesh: THREE.Group;
  rig: AnimalRig;
  speciesId: SpeciesId;
  tileX: number;
  tileY: number;
  localX: number;
  localZ: number;
  targetX: number;
  targetZ: number;
  yaw: number;
  currentSpeed: number;
  gaitBlend: number;
  walkPhase: number;
  idlePhase: number;
  restBlend: number;
  actionBlend: number;
  mode: 'walking' | 'idle' | 'signature';
  modeTimer: number;
}

interface HumanActorEntry {
  mesh: THREE.Group;
  rig: HumanRig;
  lastSimX: number;
  lastSimY: number;
  waypoints: Array<{ x: number; z: number }>;
  laneX: number;
  laneZ: number;
  yaw: number;
  gaitBlend: number;
  walkPhase: number;
  idlePhase: number;
  archetype?: VisitorInstance['archetype'];
  role?: KeeperInstance['role'];
}

// Pre-allocated math helpers (zero GC inside animation loop)
const _projVec = new THREE.Vector3();
const _targetSkyColor = new THREE.Color();
const _targetFogColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _targetHemiSky = new THREE.Color();
const _targetHemiGround = new THREE.Color();
const _nightSkyColor = new THREE.Color('#0E1A2B');
const _nightMoonColor = new THREE.Color('#7BA3D4');
const _dayHemiSkyColor = new THREE.Color('#DCF2FC');
const _dayHemiGroundColor = new THREE.Color('#4A733E');
const _nightHemiSkyColor = new THREE.Color('#273E5E');
const _nightHemiGroundColor = new THREE.Color('#132219');

function createSpotlightFadeTextures() {
  // Vertical beam falloff texture for volumetric cone
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 32;
  beamCanvas.height = 128;
  const bCtx = beamCanvas.getContext('2d');
  if (bCtx) {
    const grad = bCtx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0, 'rgba(255, 232, 178, 0.9)');
    grad.addColorStop(0.35, 'rgba(255, 226, 165, 0.45)');
    grad.addColorStop(0.82, 'rgba(255, 220, 150, 0.12)');
    grad.addColorStop(1.0, 'rgba(255, 220, 150, 0.0)');
    bCtx.fillStyle = grad;
    bCtx.fillRect(0, 0, 32, 128);
  }
  const beamTex = new THREE.CanvasTexture(beamCanvas);
  beamTex.colorSpace = THREE.SRGBColorSpace;

  // Soft radial pool texture on ground
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = 128;
  poolCanvas.height = 128;
  const pCtx = poolCanvas.getContext('2d');
  if (pCtx) {
    const grad = pCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0.0, 'rgba(255, 230, 172, 0.95)');
    grad.addColorStop(0.45, 'rgba(255, 220, 150, 0.45)');
    grad.addColorStop(0.8, 'rgba(255, 212, 136, 0.12)');
    grad.addColorStop(1.0, 'rgba(255, 212, 136, 0.0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 128, 128);
  }
  const poolTex = new THREE.CanvasTexture(poolCanvas);
  poolTex.colorSpace = THREE.SRGBColorSpace;

  return { beamTex, poolTex };
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function hashIdToLane(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const lx = (((h & 0xff) / 255) - 0.5) * 0.54;
  const lz = ((((h >> 8) & 0xff) & 0xff) / 255 - 0.5) * 0.54;
  return [lx, lz];
}

function getSpeciesPace(speciesId: SpeciesId): { speed: number; strideFreq: number } {
  switch (speciesId) {
    case 'giraffe':
      return { speed: 0.44, strideFreq: 7.5 };
    case 'zebra':
      return { speed: 0.72, strideFreq: 10.5 };
    case 'cheetah':
      return { speed: 0.88, strideFreq: 12.0 };
    case 'lion':
      return { speed: 0.56, strideFreq: 9.0 };
    case 'tiger':
      return { speed: 0.62, strideFreq: 9.5 };
    case 'elephant':
      return { speed: 0.36, strideFreq: 6.5 };
    case 'polar_bear':
      return { speed: 0.4, strideFreq: 7.5 };
    case 'hippo':
      return { speed: 0.3, strideFreq: 8.5 };
    case 'panda':
      return { speed: 0.34, strideFreq: 10.0 };
    case 'red_panda':
      return { speed: 0.62, strideFreq: 13.0 };
    case 'meerkat':
      return { speed: 0.52, strideFreq: 15.0 };
    case 'kangaroo':
      return { speed: 0.66, strideFreq: 8.2 };
    case 'koala':
      return { speed: 0.22, strideFreq: 9.0 };
    case 'peacock':
      return { speed: 0.36, strideFreq: 11.5 };
    case 'penguin':
      return { speed: 0.36, strideFreq: 15.0 };
    case 'seal':
      return { speed: 0.32, strideFreq: 11.0 };
    case 'capybara':
      return { speed: 0.32, strideFreq: 12.0 };
    case 'otter':
      return { speed: 0.54, strideFreq: 13.5 };
    case 'toucan':
      return { speed: 0.18, strideFreq: 14.0 };
    case 'flamingo':
      return { speed: 0.4, strideFreq: 10.0 };
  }
}

function getSpeciesRadius(speciesId: SpeciesId): number {
  switch (speciesId) {
    case 'elephant':
      return 0.24;
    case 'polar_bear':
      return 0.22;
    case 'hippo':
      return 0.21;
    case 'lion':
    case 'tiger':
    case 'cheetah':
    case 'giraffe':
    case 'zebra':
    case 'panda':
      return 0.18;
    case 'kangaroo':
    case 'peacock':
      return 0.16;
    case 'toucan':
    case 'meerkat':
      return 0.1;
    default:
      return 0.14;
  }
}

function getSpeciesFenceLimit(speciesId: SpeciesId, level: 1 | 2 | 3 = 1): number {
  const levelBonus = (level - 1) * 0.035;
  switch (speciesId) {
    case 'elephant':
    case 'hippo':
    case 'giraffe':
    case 'polar_bear':
      return 0.94 + levelBonus;
    case 'lion':
    case 'tiger':
    case 'cheetah':
    case 'zebra':
    case 'panda':
    case 'kangaroo':
      return 1.0 + levelBonus;
    default:
      return 1.05 + levelBonus;
  }
}

function clampAnimalLocalPos(
  lx: number,
  lz: number,
  speciesId: SpeciesId,
  level: 1 | 2 | 3 = 1
): [number, number] {
  const limit = getSpeciesFenceLimit(speciesId, level);
  const bodyR = getSpeciesRadius(speciesId);
  let x = THREE.MathUtils.clamp(lx, -limit, limit);
  let z = THREE.MathUtils.clamp(lz, -limit, limit);

  const colliders = getHabitatPropColliders(speciesId);
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const minD = c.r + bodyR;
      const dx = x - c.x;
      const dz = z - c.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minD * minD) {
        const d = Math.sqrt(dSq);
        if (d > 0.0001) {
          const push = (minD - d) / d;
          x += dx * push;
          z += dz * push;
        } else {
          z += minD;
        }
      }
    }
    x = THREE.MathUtils.clamp(x, -limit, limit);
    z = THREE.MathUtils.clamp(z, -limit, limit);
  }
  return [x, z];
}

function pickSafeAnimalTarget(speciesId: SpeciesId, level: 1 | 2 | 3 = 1): [number, number] {
  const limit = getSpeciesFenceLimit(speciesId, level);
  const bodyR = getSpeciesRadius(speciesId);
  const colliders = getHabitatPropColliders(speciesId);

  for (let attempt = 0; attempt < 14; attempt++) {
    const cx = (Math.random() * 2 - 1) * limit;
    const cz = (Math.random() * 2 - 1) * limit;
    let blocked = false;
    for (const c of colliders) {
      const minD = c.r + bodyR + 0.04;
      const dx = cx - c.x;
      const dz = cz - c.z;
      if (dx * dx + dz * dz < minD * minD) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return [cx, cz];
  }
  return clampAnimalLocalPos(0.22, 0.35, speciesId, level);
}

function resolveSolidTileCollisions(
  wx: number,
  wz: number,
  grid: ParkTile[][],
  margin: number
): [number, number] {
  const halfTile = TILE_SIZE * 0.5;
  const parkHalfW = (GRID_COLS * TILE_SIZE) * 0.5;
  const parkHalfH = (GRID_ROWS * TILE_SIZE) * 0.5;

  let x = wx;
  let z = wz;
  const centerGx = Math.floor((x + parkHalfW) / TILE_SIZE);
  const centerGy = Math.floor((z + parkHalfH) / TILE_SIZE);

  for (let gy = Math.max(0, centerGy - 1); gy <= Math.min(GRID_ROWS - 1, centerGy + 1); gy++) {
    for (let gx = Math.max(0, centerGx - 1); gx <= Math.min(GRID_COLS - 1, centerGx + 1); gx++) {
      const tile = grid[gy]?.[gx];
      if (!tile) continue;
      if (tile.type === 'path') continue;

      const [tcx, tcz] = gridToWorld(gx, gy);

      if (tile.type === 'gate') {
        // Keep clear of left/right ticket booth wings at the gate
        for (const side of [-1, 1]) {
          const bx = tcx + side * 1.25;
          const bz = tcz - 0.05;
          const hx = 0.36 + margin;
          const hz = 0.36 + margin;
          const dx = x - bx;
          const dz = z - bz;
          const ox = hx - Math.abs(dx);
          const oz = hz - Math.abs(dz);
          if (ox > 0 && oz > 0) {
            if (ox < oz) x += dx >= 0 ? ox : -ox;
            else z += dz >= 0 ? oz : -oz;
          }
        }
        continue;
      }

      // Solid non-walkable tiles: habitat (expanded fences), snack, bench, garden, landmark, unwalkable grass borders
      const boxHalf = tile.type === 'habitat' ? TILE_SIZE * 0.48 : tile.type === 'grass' ? halfTile : 0.82;
      const rx = boxHalf + margin;
      const rz = boxHalf + margin;
      const dx = x - tcx;
      const dz = z - tcz;
      const ox = rx - Math.abs(dx);
      const oz = rz - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) {
          x += dx >= 0 ? ox : -ox;
        } else {
          z += dz >= 0 ? oz : -oz;
        }
      }
    }
  }
  return [x, z];
}

export const ParkCanvas3D: React.FC<ParkCanvas3DProps> = React.memo(({
  grid,
  weather,
  seasonalEvent,
  isNight,
  avgVisitorMood,
  speed,
  photoMode,
  activeTool,
  selectedPos,
  selectedVisitorId,
  goldenGuideUnlocked = false,
  visitors,
  keepers,
  popups,
  pendingPhotoCaptures,
  onPhotoCaptured,
  onTileClick,
  onTilePaintDrag,
  onSelectVisitor,
  onEnterPhotoMode,
  onExitPhotoMode,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [webglLost, setWebglLost] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'top'>('iso');
  const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>([]);
  const [hoveredTileInfo, setHoveredTileInfo] = useState<{ x: number; y: number } | null>(null);
  const [photoFov, setPhotoFov] = useState<number>(48);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{
    url: string;
    width: number;
    height: number;
    filename: string;
  } | null>(null);
  const [touchPaintMode, setTouchPaintMode] = useState<boolean>(false);

  const captureFnRef = useRef<(() => void) | null>(null);
  const adjustFovRef = useRef<((deltaFov: number) => void) | null>(null);
  const setFpKeyRef = useRef<((code: string, down: boolean) => void) | null>(null);
  const pendingPhotoQueueRef = useRef<PendingPhotoCapture[]>([]);
  const seenPhotoCaptureIdsRef = useRef<Set<string>>(new Set());
  const onPhotoCapturedRef = useRef(onPhotoCaptured);
  onPhotoCapturedRef.current = onPhotoCaptured;

  useEffect(() => {
    if (!activeTool.startsWith('floor_')) {
      setTouchPaintMode(false);
    }
  }, [activeTool]);

  useEffect(() => {
    if (!pendingPhotoCaptures || pendingPhotoCaptures.length === 0) return;
    for (const req of pendingPhotoCaptures) {
      if (!seenPhotoCaptureIdsRef.current.has(req.id)) {
        seenPhotoCaptureIdsRef.current.add(req.id);
        pendingPhotoQueueRef.current.push(req);
      }
    }
    if (seenPhotoCaptureIdsRef.current.size > 80) {
      const keep = Array.from(seenPhotoCaptureIdsRef.current).slice(-40);
      seenPhotoCaptureIdsRef.current = new Set(keep);
    }
  }, [pendingPhotoCaptures]);

  // Latest props in refs so WebGL mount runs once
  const stateRef = useRef({
    grid,
    weather,
    seasonalEvent,
    isNight,
    avgVisitorMood,
    speed,
    photoMode,
    activeTool,
    touchPaintMode,
    selectedPos,
    selectedVisitorId,
    goldenGuideUnlocked,
    visitors,
    keepers,
    popups,
    onTileClick,
    onTilePaintDrag,
    onSelectVisitor,
    cameraPreset,
  });
  stateRef.current = {
    grid,
    weather,
    seasonalEvent,
    isNight,
    avgVisitorMood,
    speed,
    photoMode,
    activeTool,
    touchPaintMode,
    selectedPos,
    selectedVisitorId,
    goldenGuideUnlocked,
    visitors,
    keepers,
    popups,
    onTileClick,
    onTilePaintDrag,
    onSelectVisitor,
    cameraPreset,
  };

  const cameraCmdRef = useRef<{
    targetPos: [number, number, number];
    targetLook: [number, number, number];
  } | null>(null);

  const handleSetCameraPreset = (preset: 'iso' | 'top') => {
    setCameraPreset(preset);
    if (preset === 'top') {
      cameraCmdRef.current = {
        targetPos: [0, 29.5, 6.0],
        targetLook: [0, 0, 0.8],
      };
    } else {
      cameraCmdRef.current = {
        targetPos: [0, 18.8, 22.0],
        targetLook: [0, 0, 0.8],
      };
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 580;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const handleContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#D5E7D0');
    scene.fog = new THREE.FogExp2('#D5E7D0', 0.013);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 180);
    camera.position.set(0, 18.8, 22.0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0.8);
    controls.minDistance = 7.5;
    controls.maxDistance = 44;
    controls.minPolarAngle = 0.22;
    controls.maxPolarAngle = Math.PI / 2.25;

    controls.addEventListener('start', () => {
      cameraCmdRef.current = null;
    });

    // Natural outdoor daylight 3-point + hemisphere studio rig
    const hemiLight = new THREE.HemisphereLight('#DCF2FC', '#4A733E', 0.78);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#FFF5DF', 1.5);
    sunLight.position.set(17, 24, 15);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 64;
    const d = 19;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.018;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#C7E3FF', 0.4);
    rimLight.position.set(-14, 10, -15);
    scene.add(rimLight);

    // Nighttime Spotlights (1 gate + 4 pooled exhibit lights, zero shadow casters to stay fast)
    const { beamTex, poolTex } = createSpotlightFadeTextures();
    const gateConeGeo = new THREE.ConeGeometry(2.15, 4.6, 24, 1, true);
    const gatePoolGeo = new THREE.CircleGeometry(2.05, 28);
    const exhibitConeGeo = new THREE.ConeGeometry(2.05, 4.4, 22, 1, true);
    const exhibitPoolGeo = new THREE.CircleGeometry(1.95, 24);

    const createSpotRig = (
      wx: number,
      wz: number,
      height: number,
      coneGeo: THREE.BufferGeometry,
      poolGeo: THREE.BufferGeometry,
      color: string,
      distance: number,
      angle: number
    ) => {
      const light = new THREE.SpotLight(color, 0, distance, angle, 0.58, 1.35);
      light.castShadow = false;
      light.position.set(wx, height, wz);
      light.target.position.set(wx, 0.05, wz);
      light.visible = false;
      scene.add(light, light.target);

      const coneMat = new THREE.MeshBasicMaterial({
        map: beamTex,
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(wx, height * 0.5, wz);
      cone.visible = false;
      scene.add(cone);

      const poolMat = new THREE.MeshBasicMaterial({
        map: poolTex,
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(wx, 0.028, wz);
      pool.visible = false;
      scene.add(pool);

      return { light, cone, coneMat, pool, poolMat, height };
    };

    const [gateWx, gateWz] = gridToWorld(GATE_POS.x, GATE_POS.y);
    const gateSpotRig = createSpotRig(
      gateWx,
      gateWz,
      4.4,
      gateConeGeo,
      gatePoolGeo,
      '#FFD996',
      14,
      Math.PI / 5.0
    );

    const exhibitSpotRigs = Array.from({ length: 4 }, () =>
      createSpotRig(0, 0, 4.4, exhibitConeGeo, exhibitPoolGeo, '#FFE0A3', 14, Math.PI / 5.0)
    );

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Surrounding continuous grassy park valley & dense forest backdrop
    const envGroup = buildSurroundingEnvironment(maxAniso);
    scene.add(envGroup);

    // Realistic 3D swaying instanced grass tufts across continuous meadow & grassy exhibits
    const grassField = build3DGrassField();
    scene.add(grassField.mesh);

    // Single invisible math-mapped picking plane on layer 1 (zero blocky grid seams!)
    const parkTotalW = GRID_COLS * TILE_SIZE;
    const parkTotalH = GRID_ROWS * TILE_SIZE;
    const pickingPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(parkTotalW, parkTotalH),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      })
    );
    pickingPlane.rotation.x = -Math.PI / 2;
    pickingPlane.position.y = 0.004;
    pickingPlane.layers.enable(1);
    scene.add(pickingPlane);
    const raycastTargets: THREE.Mesh[] = [pickingPlane];

    const tileSlotGroups: THREE.Group[][] = [];
    const tileSlotSignatures: string[][] = [];
    const auraRings: (THREE.Mesh | null)[][] = [];

    for (let y = 0; y < GRID_ROWS; y++) {
      tileSlotGroups.push([]);
      tileSlotSignatures.push([]);
      auraRings.push([]);
      for (let x = 0; x < GRID_COLS; x++) {
        const [wx, wz] = gridToWorld(x, y);

        const slotGroup = new THREE.Group();
        slotGroup.position.set(wx, 0, wz);
        scene.add(slotGroup);
        tileSlotGroups[y].push(slotGroup);
        tileSlotSignatures[y].push('');

        // Soft circular thriving habitat glow ring
        const auraGeo = new THREE.RingGeometry(TILE_SIZE * 0.44, TILE_SIZE * 0.49, 32);
        const auraMat = new THREE.MeshBasicMaterial({
          color: '#FBBF24',
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const aura = new THREE.Mesh(auraGeo, auraMat);
        aura.rotation.x = -Math.PI / 2;
        aura.position.set(wx, 0.025, wz);
        aura.visible = false;
        scene.add(aura);
        auraRings[y].push(aura);
      }
    }

    // Soft rounded Hover & Selection Indicator Rings (non-blocky)
    const makeTileFrame = (color: string, yOffset: number) => {
      const geo = new THREE.RingGeometry(TILE_SIZE * 0.43, TILE_SIZE * 0.47, 36);
      const mat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = yOffset;
      mesh.visible = false;
      return mesh;
    };

    const hoverFrame = makeTileFrame('#34D399', 0.032);
    const selectedFrame = makeTileFrame('#F59E0B', 0.036);
    const guideTargetFrame = makeTileFrame('#38BDF8', 0.042);
    scene.add(hoverFrame, selectedFrame, guideTargetFrame);

    // Dynamic actors containers
    const actorsGroup = new THREE.Group();
    scene.add(actorsGroup);

    const animalMeshes = new Map<string, AnimalActorEntry>();
    const visitorMeshes = new Map<string, HumanActorEntry>();
    const keeperMeshes = new Map<string, HumanActorEntry>();
    const waterRippleTex = getWaterRippleTexture();
    const puddleMaskTex = getPuddleMaskTexture();
    const rainRippleTex = getRainRippleRingTexture();
    const heatMirageTex = getHeatMirageTexture();

    // 3D Road Puddle Reflection & Expanding Raindrop Ripple System (Rainy / Monsoon weather)
    const MAX_PUDDLES = GRID_COLS * GRID_ROWS * 2;
    const puddleGeo = new THREE.PlaneGeometry(1, 1);
    puddleGeo.rotateX(-Math.PI / 2);
    const puddleMat = new THREE.MeshStandardMaterial({
      color: '#8CB6D9',
      alphaMap: puddleMaskTex,
      transparent: true,
      opacity: 0,
      roughness: 0.08,
      metalness: 0.48,
      envMapIntensity: 2.2,
      bumpMap: waterRippleTex,
      bumpScale: 0.018,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const puddleMesh = new THREE.InstancedMesh(puddleGeo, puddleMat, MAX_PUDDLES);
    puddleMesh.position.y = 0.0125;
    puddleMesh.count = 0;
    puddleMesh.visible = false;
    puddleMesh.frustumCulled = false;
    puddleMesh.renderOrder = 1;
    scene.add(puddleMesh);

    const MAX_RIPPLES = 44;
    const rippleGeo = new THREE.PlaneGeometry(1, 1);
    rippleGeo.rotateX(-Math.PI / 2);
    const rippleMat = new THREE.MeshBasicMaterial({
      map: rainRippleTex,
      color: '#E0F2FE',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rippleMesh = new THREE.InstancedMesh(rippleGeo, rippleMat, MAX_RIPPLES);
    rippleMesh.position.y = 0.0148;
    rippleMesh.count = 0;
    rippleMesh.visible = false;
    rippleMesh.frustumCulled = false;
    rippleMesh.renderOrder = 2;
    scene.add(rippleMesh);

    interface PuddleSpot {
      wx: number;
      wz: number;
      rx: number;
      rz: number;
      rotY: number;
      nearGate: boolean;
    }
    const activePuddleSpots: PuddleSpot[] = [];
    const _puddleDummy = new THREE.Object3D();
    const _puddleInstColor = new THREE.Color();
    const _dayPuddleSky = new THREE.Color('#8CB6D9');
    const _nightPuddleSky = new THREE.Color('#344E6B');
    const _nightPuddleLanternTint = new THREE.Color('#FFD89B');
    const _roadWetColor = new THREE.Color();
    const _roadBaseColor = new THREE.Color();
    const _roadDarkWetTint = new THREE.Color('#8A97A4');

    const rebuildPuddleLayout = (grid: ParkTile[][]) => {
      activePuddleSpots.length = 0;
      let count = 0;
      for (let y = 0; y < GRID_ROWS && count < MAX_PUDDLES; y++) {
        for (let x = 0; x < GRID_COLS && count < MAX_PUDDLES; x++) {
          const tile = grid[y]?.[x];
          if (!tile || (tile.type !== 'path' && tile.type !== 'gate')) continue;

          const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
          if (tile.type === 'path' && hash % 5 === 0) continue; // keep ~80% of paths puddled naturally

          const [wx, wz] = gridToWorld(x, y);
          const isWood = tile.type === 'path' && tile.floorType === 'wood';
          const scaleMul = tile.type === 'gate' ? 1.15 : isWood ? 0.58 : 1.0;
          const nearGate = Math.abs(x - GATE_POS.x) + Math.abs(y - GATE_POS.y) <= 2;

          const primaryOffX = (((hash >> 3) % 100) / 100 - 0.5) * 0.82;
          const primaryOffZ = (((hash >> 10) % 100) / 100 - 0.5) * 0.82;
          const rx1 = (0.78 + ((hash >> 2) % 45) * 0.011) * scaleMul;
          const rz1 = (0.56 + ((hash >> 6) % 38) * 0.01) * scaleMul;
          const rot1 = (((hash >> 14) % 314) / 100) * 2;

          _puddleDummy.position.set(wx + primaryOffX, 0, wz + primaryOffZ);
          _puddleDummy.rotation.set(0, rot1, 0);
          _puddleDummy.scale.set(rx1, 1, rz1);
          _puddleDummy.updateMatrix();
          puddleMesh.setMatrixAt(count, _puddleDummy.matrix);
          _puddleInstColor.set(nearGate ? '#FFF5E1' : '#FFFFFF');
          puddleMesh.setColorAt(count, _puddleInstColor);
          activePuddleSpots.push({
            wx: wx + primaryOffX,
            wz: wz + primaryOffZ,
            rx: rx1,
            rz: rz1,
            rotY: rot1,
            nearGate,
          });
          count += 1;

          // Occasional secondary puddle on plaza or wide stone tiles
          if (count < MAX_PUDDLES && !isWood && (tile.type === 'gate' || hash % 3 === 1)) {
            const secOffX = -primaryOffX * 0.72 + (hash % 2 === 0 ? 0.35 : -0.35);
            const secOffZ = -primaryOffZ * 0.72 + (hash % 3 === 0 ? 0.3 : -0.3);
            const rx2 = 0.52 + ((hash >> 8) % 30) * 0.009;
            const rz2 = 0.4 + ((hash >> 12) % 25) * 0.008;
            const rot2 = rot1 + 1.1;
            _puddleDummy.position.set(wx + secOffX, 0, wz + secOffZ);
            _puddleDummy.rotation.set(0, rot2, 0);
            _puddleDummy.scale.set(rx2, 1, rz2);
            _puddleDummy.updateMatrix();
            puddleMesh.setMatrixAt(count, _puddleDummy.matrix);
            _puddleInstColor.set(nearGate ? '#FFF5E1' : '#EBF5FF');
            puddleMesh.setColorAt(count, _puddleInstColor);
            activePuddleSpots.push({
              wx: wx + secOffX,
              wz: wz + secOffZ,
              rx: rx2,
              rz: rz2,
              rotY: rot2,
              nearGate,
            });
            count += 1;
          }
        }
      }
      puddleMesh.count = count;
      puddleMesh.instanceMatrix.needsUpdate = true;
      if (puddleMesh.instanceColor) puddleMesh.instanceColor.needsUpdate = true;
    };

    const rippleStates = Array.from({ length: MAX_RIPPLES }, (_, idx) => ({
      phase: (idx / MAX_RIPPLES) % 1,
      speed: 0.78 + (idx % 5) * 0.12,
      spotIdx: idx,
      jitterX: (((idx * 37) % 100) / 100 - 0.5) * 0.42,
      jitterZ: (((idx * 71) % 100) / 100 - 0.5) * 0.42,
    }));

    // 3D Heatwave Thermal Mirage Ribbons & Rising Dust Motes
    const MAX_MIRAGES = 24;
    const heatMirageGeo = new THREE.PlaneGeometry(2.2, 0.72);
    const heatMirageMat = new THREE.MeshBasicMaterial({
      map: heatMirageTex,
      color: '#FDE68A',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const heatMirageMesh = new THREE.InstancedMesh(heatMirageGeo, heatMirageMat, MAX_MIRAGES);
    heatMirageMesh.visible = false;
    heatMirageMesh.frustumCulled = false;
    scene.add(heatMirageMesh);

    const mirageSpots = Array.from({ length: MAX_MIRAGES }, (_, idx) => ({
      x: ((idx * 5.3) % 24) - 12,
      z: ((idx * 4.1) % 18) - 9,
      baseY: 0.34 + (idx % 4) * 0.24,
      phase: idx * 0.75,
      scaleX: 0.85 + (idx % 3) * 0.28,
      scaleY: 0.75 + (idx % 4) * 0.16,
    }));

    const heatDustCount = 150;
    const heatDustPositions = new Float32Array(heatDustCount * 3);
    for (let i = 0; i < heatDustCount; i++) {
      heatDustPositions[i * 3] = (Math.random() - 0.5) * 30;
      heatDustPositions[i * 3 + 1] = Math.random() * 5.5;
      heatDustPositions[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const heatDustGeo = new THREE.BufferGeometry();
    heatDustGeo.setAttribute('position', new THREE.BufferAttribute(heatDustPositions, 3));
    const heatDustMat = new THREE.PointsMaterial({
      color: '#FDE68A',
      size: 0.14,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const heatDustPoints = new THREE.Points(heatDustGeo, heatDustMat);
    heatDustPoints.visible = false;
    scene.add(heatDustPoints);

    // 3D Rain particles
    const rainCount = 520;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 38;
      rainPositions[i * 3 + 1] = Math.random() * 16;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 32;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: '#BAE6FD',
      size: 0.12,
      transparent: true,
      opacity: 0.72,
    });
    const rainPoints = new THREE.Points(rainGeo, rainMat);
    rainPoints.visible = false;
    scene.add(rainPoints);

    // 3D Seasonal Festival Particles (Sakura petals, Snowflakes, Maple leaves, Fireflies)
    const particleSpriteCanvas = document.createElement('canvas');
    particleSpriteCanvas.width = 32;
    particleSpriteCanvas.height = 32;
    const psCtx = particleSpriteCanvas.getContext('2d');
    if (psCtx) {
      const grad = psCtx.createRadialGradient(16, 16, 2, 16, 16, 15);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      psCtx.fillStyle = grad;
      psCtx.fillRect(0, 0, 32, 32);
    }
    const seasonalParticleTex = new THREE.CanvasTexture(particleSpriteCanvas);
    seasonalParticleTex.colorSpace = THREE.SRGBColorSpace;

    const seasonalCount = 340;
    const seasonalPositions = new Float32Array(seasonalCount * 3);
    for (let i = 0; i < seasonalCount; i++) {
      seasonalPositions[i * 3] = (Math.random() - 0.5) * 32;
      seasonalPositions[i * 3 + 1] = Math.random() * 11;
      seasonalPositions[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    const seasonalGeo = new THREE.BufferGeometry();
    seasonalGeo.setAttribute('position', new THREE.BufferAttribute(seasonalPositions, 3));
    const seasonalMat = new THREE.PointsMaterial({
      color: '#F9A8D4',
      map: seasonalParticleTex,
      size: 0.24,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const seasonalPoints = new THREE.Points(seasonalGeo, seasonalMat);
    seasonalPoints.visible = false;
    scene.add(seasonalPoints);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting & First-Person Photo Mode state
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let hoveredCell: { x: number; y: number } | null = null;
    let pointerDownPos: { x: number; y: number } | null = null;
    let paintDragActive = false;
    let lastRaycastTime = 0;

    let prevPhotoMode = false;
    const savedOrbitPos = new THREE.Vector3(0, 18.8, 22.0);
    const savedOrbitTarget = new THREE.Vector3(0, 0, 0.8);
    let savedOrbitFov = 40;
    let fpYaw = 0;
    let fpPitch = -0.04;
    let fpHeight = 0.78;
    let fpFov = 48;
    let fpDragActive = false;
    let fpLastMouseX = 0;
    let fpLastMouseY = 0;
    const pressedKeys = new Set<string>();

    setFpKeyRef.current = (code: string, down: boolean) => {
      if (down) pressedKeys.add(code);
      else pressedKeys.delete(code);
    };

    captureFnRef.current = () => {
      const prevPr = renderer.getPixelRatio();
      const prevW = container.clientWidth || 1280;
      const prevH = container.clientHeight || 720;
      const snapW = isSoftwareGl ? 1600 : 2560;
      const snapH = Math.max(720, Math.round(snapW * (prevH / Math.max(1, prevW))));

      renderer.setPixelRatio(1);
      renderer.setSize(snapW, snapH, false);
      camera.aspect = snapW / snapH;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);

      const dataUrl = renderer.domElement.toDataURL('image/png');

      renderer.setPixelRatio(prevPr);
      renderer.setSize(prevW, prevH, false);
      camera.aspect = prevW / prevH;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const filename = `森之方舟動物園_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
        now.getDate()
      )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;

      soundFX.playShutter();
      setShutterFlash(true);
      window.setTimeout(() => setShutterFlash(false), 180);
      setCapturedPhoto({ url: dataUrl, width: snapW, height: snapH, filename });

      try {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        // Fallback: user can download directly from preview card
      }
    };

    adjustFovRef.current = (deltaFov: number) => {
      fpFov = THREE.MathUtils.clamp(fpFov + deltaFov, 22, 68);
      setPhotoFov(Math.round(fpFov));
    };

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickGridHit = (
      e: PointerEvent
    ): { x: number; y: number; wx: number; wz: number } | null => {
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(raycastTargets, false);
      if (hits.length > 0) {
        const pt = hits[0].point;
        const gx = Math.floor((pt.x + parkTotalW / 2) / TILE_SIZE);
        const gy = Math.floor((pt.z + parkTotalH / 2) / TILE_SIZE);
        if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
          return { x: gx, y: gy, wx: pt.x, wz: pt.z };
        }
      }
      return null;
    };

    const pickGridCell = (e: PointerEvent): { x: number; y: number } | null => {
      const hit = pickGridHit(e);
      return hit ? { x: hit.x, y: hit.y } : null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.photoMode) {
        if (fpDragActive || e.buttons > 0) {
          const dx = e.clientX - fpLastMouseX;
          const dy = e.clientY - fpLastMouseY;
          fpLastMouseX = e.clientX;
          fpLastMouseY = e.clientY;
          fpYaw -= dx * 0.0042;
          fpPitch = THREE.MathUtils.clamp(fpPitch - dy * 0.0036, -Math.PI * 0.42, Math.PI * 0.42);
        }
        return;
      }

      const now = performance.now();
      if (now - lastRaycastTime < 35) return;
      lastRaycastTime = now;

      const cell = pickGridCell(e);
      if (
        (hoveredCell?.x ?? -1) !== (cell?.x ?? -1) ||
        (hoveredCell?.y ?? -1) !== (cell?.y ?? -1)
      ) {
        hoveredCell = cell;
        setHoveredTileInfo(cell);
      }

      if (
        (paintDragActive || (e.buttons === 1 && e.shiftKey)) &&
        stateRef.current.activeTool.startsWith('floor_') &&
        cell
      ) {
        stateRef.current.onTilePaintDrag(cell.x, cell.y);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (stateRef.current.photoMode) {
        fpDragActive = true;
        fpLastMouseX = e.clientX;
        fpLastMouseY = e.clientY;
        return;
      }

      if (e.button === 0) {
        pointerDownPos = { x: e.clientX, y: e.clientY };
        const wantsPaintDrag =
          (e.shiftKey || stateRef.current.touchPaintMode) &&
          stateRef.current.activeTool.startsWith('floor_');
        if (wantsPaintDrag) {
          controls.enabled = false;
          paintDragActive = true;
          const cell = pickGridCell(e);
          if (cell) stateRef.current.onTileClick(cell.x, cell.y);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (stateRef.current.photoMode) {
        fpDragActive = false;
        return;
      }

      controls.enabled = true;
      if (paintDragActive) {
        paintDragActive = false;
        pointerDownPos = null;
        return;
      }

      if (e.button === 0 && pointerDownPos && !e.shiftKey) {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        const tapThreshold = e.pointerType === 'touch' ? 14 : 6;
        if (Math.hypot(dx, dy) < tapThreshold) {
          const hit = pickGridHit(e);
          if (hit) {
            if (stateRef.current.activeTool === 'select') {
              // Find closest visitor near click point in world space
              let clickedVisitor: VisitorInstance | null = null;
              let bestVisDist = e.pointerType === 'touch' ? 1.65 : 1.35;
              for (const v of stateRef.current.visitors) {
                const vm = visitorMeshes.get(v.id);
                const vx = vm ? vm.mesh.position.x : gridToWorld(v.x, v.y)[0];
                const vz = vm ? vm.mesh.position.z : gridToWorld(v.x, v.y)[1];
                const dist = Math.hypot(vx - hit.wx, vz - hit.wz);
                if (dist < bestVisDist) {
                  bestVisDist = dist;
                  clickedVisitor = v;
                }
              }

              if (clickedVisitor) {
                stateRef.current.onSelectVisitor(clickedVisitor.id);
                soundFX.playVisitorVoice(
                  clickedVisitor.archetype,
                  clickedVisitor.mood < 55 ? 'complaint' : 'greet',
                  true
                );
              } else {
                stateRef.current.onSelectVisitor(null);
                const tile = stateRef.current.grid[hit.y]?.[hit.x];
                if (tile?.type === 'habitat' && tile.habitat && tile.habitat.animals.length > 0) {
                  soundFX.playAnimalVoice(tile.habitat.speciesId);
                }
                stateRef.current.onTileClick(hit.x, hit.y);
              }
            } else {
              stateRef.current.onTileClick(hit.x, hit.y);
            }
          }
        }
      }
      pointerDownPos = null;
    };

    const onWheel = (e: WheelEvent) => {
      if (!stateRef.current.photoMode) return;
      e.preventDefault();
      fpFov = THREE.MathUtils.clamp(fpFov + Math.sign(e.deltaY) * 3, 22, 68);
      setPhotoFov(Math.round(fpFov));
    };

    const onFpKeyDown = (e: KeyboardEvent) => {
      if (!stateRef.current.photoMode) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }
      pressedKeys.add(e.code);
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        captureFnRef.current?.();
      }
    };

    const onFpKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.code);
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onFpKeyDown);
    window.addEventListener('keyup', onFpKeyUp);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let lastLabelSync = 0;

    function updateHumanLocomotion(
      entry: HumanActorEntry,
      simX: number,
      simY: number,
      simSpeed: 0 | 1 | 2,
      isNightMode: boolean,
      grid: ParkTile[][],
      delta: number,
      lookUp = false
    ) {
      // Enqueue new grid target if simulation stepped
      if (simX !== entry.lastSimX || simY !== entry.lastSimY) {
        entry.lastSimX = simX;
        entry.lastSimY = simY;
        const [wx, wz] = gridToWorld(simX, simY);
        entry.waypoints.push({ x: wx + entry.laneX, z: wz + entry.laneZ });
        if (entry.waypoints.length > 4) {
          entry.waypoints.splice(0, entry.waypoints.length - 4);
        }
      }

      if (simSpeed === 0) {
        entry.gaitBlend = THREE.MathUtils.damp(entry.gaitBlend, 0, 8, delta);
        animateHumanRig(entry.rig, entry.gaitBlend, entry.walkPhase, entry.idlePhase, lookUp);
        return;
      }

      entry.idlePhase += delta * (simSpeed === 2 ? 1.4 : 1.0);

      let moving = false;
      let distMoved = 0;

      if (entry.waypoints.length > 0) {
        let wp = entry.waypoints[0];
        let dx = wp.x - entry.mesh.position.x;
        let dz = wp.z - entry.mesh.position.z;
        let dist = Math.hypot(dx, dz);

        // Tighter corner look-ahead so humans turn smoothly inside walkways without clipping adjacent fences
        if (dist < 0.22 && entry.waypoints.length > 1) {
          entry.waypoints.shift();
          wp = entry.waypoints[0];
          dx = wp.x - entry.mesh.position.x;
          dz = wp.z - entry.mesh.position.z;
          dist = Math.hypot(dx, dz);
        }

        if (dist > 0.03) {
          moving = true;
          const nightPace = isNightMode && !entry.role ? 0.72 : 1.0;
          const baseWalkSpeed = (simSpeed === 2 ? 3.7 : 1.95) * nightPace;
          const catchUpBoost = 1 + Math.max(0, entry.waypoints.length - 1) * 0.28;
          const maxStep = baseWalkSpeed * catchUpBoost * delta;
          const step = Math.min(dist, maxStep);

          const rawX = entry.mesh.position.x + (dx / dist) * step;
          const rawZ = entry.mesh.position.z + (dz / dist) * step;
          const [safeX, safeZ] = resolveSolidTileCollisions(rawX, rawZ, grid, 0.22);
          distMoved = Math.hypot(safeX - entry.mesh.position.x, safeZ - entry.mesh.position.z);
          entry.mesh.position.x = safeX;
          entry.mesh.position.z = safeZ;

          if (dist > 0.08) {
            const targetYaw = Math.atan2(dx, dz);
            entry.yaw = dampAngle(entry.yaw, targetYaw, 9.5, delta);
            entry.mesh.rotation.y = entry.yaw;
          }
        } else {
          entry.waypoints.shift();
        }
      }

      // Couple stride frequency directly to world distance moved so feet never skate!
      entry.walkPhase += distMoved * 11.2;
      entry.gaitBlend = THREE.MathUtils.damp(entry.gaitBlend, moving ? 1 : 0, 9.0, delta);
      animateHumanRig(entry.rig, entry.gaitBlend, entry.walkPhase, entry.idlePhase, lookUp);
    }

    let grassTimeAccum = 0;
    let weatherAnimAccum = 0;
    let nightBlend = 0;
    let rainBlend = 0;
    let heatBlend = 0;
    let lastAppliedWetness = -1;
    let lastTileSyncGrid: ParkTile[][] | null = null;
    let lastTileSyncSeasonal: SeasonalEventId | null | undefined = undefined;
    let lastTileSyncMoodInt = -1;
    let roadMeshes: THREE.Mesh[] = [];
    let activeAuraEntries: Array<{ aura: THREE.Mesh; x: number; y: number }> = [];
    let prevHoveredSlotIdx = -1;
    const settlingSlotCoords = new Set<number>();
    let prevProjectedLabels: ProjectedLabel[] = [];

    function projectedLabelsEqual(a: ProjectedLabel[], b: ProjectedLabel[]): boolean {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        const la = a[i];
        const lb = b[i];
        if (
          la.id !== lb.id ||
          la.x !== lb.x ||
          la.y !== lb.y ||
          la.text !== lb.text ||
          la.subText !== lb.subText ||
          la.dialogue !== lb.dialogue ||
          la.nextFacility !== lb.nextFacility ||
          la.selected !== lb.selected ||
          la.moodPct !== lb.moodPct ||
          la.kind !== lb.kind ||
          la.tone !== lb.tone ||
          la.weatherType !== lb.weatherType
        ) {
          return false;
        }
      }
      return true;
    }

    function syncSceneObjects(delta: number, elapsed: number) {
      const s = stateRef.current;

      // Subtle animated water ripples & swaying 3D grass blades
      const weatherDt = s.speed === 0 ? 0 : delta * (s.speed === 2 ? 1.45 : 1.0);
      weatherAnimAccum += weatherDt;
      waterRippleTex.offset.x = (weatherAnimAccum * (0.035 + rainBlend * 0.045)) % 1;
      waterRippleTex.offset.y = (weatherAnimAccum * (0.022 + rainBlend * 0.035)) % 1;
      grassTimeAccum += delta * (s.weather === 'breezy' ? 2.2 : s.weather === 'rainy' ? 1.35 : 1.0);
      grassField.timeUniform.value = grassTimeAccum;

      // 1. Sync Grid Tiles & Hover lift + Thriving Aura + Seasonal Tile Effects
      const moodInt = Math.round(s.avgVisitorMood);
      const needsTileScan =
        s.grid !== lastTileSyncGrid ||
        s.seasonalEvent !== lastTileSyncSeasonal ||
        moodInt !== lastTileSyncMoodInt;

      let gridStructureChanged = false;
      if (needsTileScan) {
        lastTileSyncGrid = s.grid;
        lastTileSyncSeasonal = s.seasonalEvent;
        lastTileSyncMoodInt = moodInt;
        const nextAuraEntries: Array<{ aura: THREE.Mesh; x: number; y: number }> = [];

        for (let y = 0; y < GRID_ROWS; y++) {
          for (let x = 0; x < GRID_COLS; x++) {
            const tile = s.grid[y][x];
            const slot = tileSlotGroups[y][x];
            const hasSeasonal = shouldShowSeasonalTileEffect(x, y, tile.type, s.seasonalEvent);
            const seasonalSig = hasSeasonal && s.seasonalEvent ? s.seasonalEvent : 'none';
            const vegTier =
              tile.type === 'habitat' && tile.habitat
                ? getHabitatVegetationInfo(tile.habitat.biome, tile.habitat.animals).tier
                : 0;
            const sig =
              tile.type === 'habitat' && tile.habitat
                ? `hab_${tile.habitat.speciesId}_${tile.habitat.level}_${tile.connected ? 1 : 0}_${
                    tile.habitat.autoFeeder ? (tile.habitat.autoFeederEnabled ? 2 : 1) : 0
                  }_${tile.habitat.autoCleaner ? (tile.habitat.autoCleanerEnabled ? 2 : 1) : 0}_veg${vegTier}_${seasonalSig}`
                : `${tile.type}_${tile.floorType ?? 'stone'}_${tile.connected ? 1 : 0}_${seasonalSig}`;

            if (tileSlotSignatures[y][x] !== sig) {
              tileSlotSignatures[y][x] = sig;
              gridStructureChanged = true;
              while (slot.children.length > 0) {
                slot.remove(slot.children[0]);
              }
              if (tile.type === 'habitat' && tile.habitat) {
                slot.add(
                  buildHabitatZoneMesh(tile.habitat.speciesId, tile.habitat.level, maxAniso, {
                    autoFeeder: tile.habitat.autoFeeder,
                    autoFeederEnabled: tile.habitat.autoFeederEnabled,
                    autoCleaner: tile.habitat.autoCleaner,
                    autoCleanerEnabled: tile.habitat.autoCleanerEnabled,
                  })
                );
                if (vegTier > 0) {
                  slot.add(
                    buildHabitatVegetationLayer(
                      tile.habitat.biome,
                      tile.habitat.level,
                      vegTier,
                      x,
                      y
                    )
                  );
                }
              } else if (tile.type !== 'grass' && tile.type !== 'habitat') {
                slot.add(buildFacilityMesh(tile.type, tile.connected, maxAniso, tile.floorType ?? 'stone'));
              }
              if (hasSeasonal && s.seasonalEvent) {
                slot.add(buildSeasonalTileOverlay(s.seasonalEvent, tile.type, x, y));
              }
            }

            const aura = auraRings[y][x];
            if (aura) {
              const hab = tile.habitat;
              const hasLowNeed =
                hab &&
                (hab.cleanliness < 40 ||
                  hab.animals.some((a) => a.hunger < 40 || a.happiness < 40));
              const thriving = Boolean(
                hab &&
                  tile.connected &&
                  hab.animals.length > 0 &&
                  !hasLowNeed &&
                  s.avgVisitorMood >= 84 &&
                  hab.cleanliness >= 65 &&
                  hab.animals.every((a) => a.happiness >= 65)
              );
              aura.visible = thriving;
              if (thriving) {
                nextAuraEntries.push({ aura, x, y });
              }
            }
          }
        }
        activeAuraEntries = nextAuraEntries;
      }

      // Track only hovered & settling habitat slots instead of damping all 72 slots per frame
      const currHoverIdx = hoveredCell ? hoveredCell.y * GRID_COLS + hoveredCell.x : -1;
      if (currHoverIdx !== prevHoveredSlotIdx) {
        if (prevHoveredSlotIdx >= 0) settlingSlotCoords.add(prevHoveredSlotIdx);
        if (currHoverIdx >= 0) settlingSlotCoords.add(currHoverIdx);
        prevHoveredSlotIdx = currHoverIdx;
      }
      if (settlingSlotCoords.size > 0) {
        for (const coord of Array.from(settlingSlotCoords)) {
          const sx = coord % GRID_COLS;
          const sy = Math.floor(coord / GRID_COLS);
          const tile = s.grid[sy]?.[sx];
          const slot = tileSlotGroups[sy]?.[sx];
          if (!tile || !slot) {
            settlingSlotCoords.delete(coord);
            continue;
          }
          const isHoveredHere = hoveredCell?.x === sx && hoveredCell?.y === sy;
          const targetScale = tile.type === 'habitat' && isHoveredHere ? 1.03 : 1.0;
          const targetY = tile.type === 'habitat' && isHoveredHere ? 0.04 : 0.0;
          slot.scale.x = THREE.MathUtils.damp(slot.scale.x, targetScale, 12, delta);
          slot.scale.y = THREE.MathUtils.damp(slot.scale.y, targetScale, 12, delta);
          slot.scale.z = THREE.MathUtils.damp(slot.scale.z, targetScale, 12, delta);
          slot.position.y = THREE.MathUtils.damp(slot.position.y, targetY, 12, delta);
          if (
            !isHoveredHere &&
            Math.abs(slot.scale.x - 1.0) < 0.0005 &&
            Math.abs(slot.position.y) < 0.0005
          ) {
            slot.scale.set(1, 1, 1);
            slot.position.y = 0;
            settlingSlotCoords.delete(coord);
          }
        }
      }

      // Pulse only thriving habitat aura rings
      for (let i = 0; i < activeAuraEntries.length; i++) {
        const entry = activeAuraEntries[i];
        const isHoveredHere = hoveredCell?.x === entry.x && hoveredCell?.y === entry.y;
        const wave = 0.5 + 0.5 * Math.sin(elapsed * 3.0 + entry.x * 0.6 + entry.y * 0.4);
        const auraMat = entry.aura.material as THREE.MeshBasicMaterial;
        auraMat.opacity = isHoveredHere ? 0.92 : 0.42 + wave * 0.42;
        const aScale = isHoveredHere ? 1.07 : 0.98 + wave * 0.06;
        entry.aura.scale.set(aScale, aScale, 1);
      }

      if (gridStructureChanged) {
        grassField.syncGridVisibility(s.grid);
        rebuildPuddleLayout(s.grid);
        lastAppliedWetness = -1;
        const nextRoads: THREE.Mesh[] = [];
        for (let y = 0; y < GRID_ROWS; y++) {
          for (let x = 0; x < GRID_COLS; x++) {
            tileSlotGroups[y][x].traverse((obj) => {
              if (obj instanceof THREE.Mesh && obj.userData.isRoadSurface) {
                nextRoads.push(obj);
              }
            });
          }
        }
        roadMeshes = nextRoads;
      }

      // 2. Hover & Selection Frames (hidden in Photo Mode)
      if (!s.photoMode && hoveredCell) {
        const [hx, hz] = gridToWorld(hoveredCell.x, hoveredCell.y);
        hoverFrame.position.x = hx;
        hoverFrame.position.z = hz;
        hoverFrame.visible = true;
        const t = s.grid[hoveredCell.y][hoveredCell.x];
        const valid =
          s.activeTool === 'select'
            ? true
            : s.activeTool === 'demolish'
            ? t.type !== 'grass' && t.type !== 'gate'
            : t.type === 'grass';
        (hoverFrame.material as THREE.MeshBasicMaterial).color.set(
          s.activeTool === 'select' ? '#FBBF24' : valid ? '#34D399' : '#FB7185'
        );
      } else {
        hoverFrame.visible = false;
      }

      if (!s.photoMode && s.selectedPos) {
        const [sx, sz] = gridToWorld(s.selectedPos.x, s.selectedPos.y);
        selectedFrame.position.x = sx;
        selectedFrame.position.z = sz;
        selectedFrame.visible = true;
      } else {
        selectedFrame.visible = false;
      }

      const selectedVisitorObj = s.selectedVisitorId
        ? s.visitors.find((v) => v.id === s.selectedVisitorId)
        : undefined;
      if (
        !s.photoMode &&
        s.goldenGuideUnlocked &&
        selectedVisitorObj &&
        selectedVisitorObj.plannedDestination
      ) {
        const dest = selectedVisitorObj.plannedDestination;
        const [gx, gz] = gridToWorld(dest.x, dest.y);
        guideTargetFrame.position.x = gx;
        guideTargetFrame.position.z = gz;
        guideTargetFrame.visible = true;
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.5);
        const guideScale = 0.96 + pulse * 0.09;
        guideTargetFrame.scale.set(guideScale, guideScale, 1);
        (guideTargetFrame.material as THREE.MeshBasicMaterial).opacity = 0.62 + pulse * 0.32;
      } else {
        guideTargetFrame.visible = false;
      }

      // 3. Sync Animals with prop/wall collision avoidance, sibling separation & 14 signature actions
      const activeAnimalIds = new Set<string>();
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const tile = s.grid[y][x];
          if (tile.type !== 'habitat' || !tile.habitat) continue;
          const [tileWx, tileWz] = gridToWorld(x, y);
          const tileEntries: AnimalActorEntry[] = [];

          const habLevel = tile.habitat.level;
          for (const ani of tile.habitat.animals) {
            activeAnimalIds.add(ani.id);
            let entry = animalMeshes.get(ani.id);
            if (!entry || entry.speciesId !== ani.speciesId) {
              if (entry) actorsGroup.remove(entry.mesh);
              const mesh = buildAnimalMesh(ani.speciesId);
              const rig = mesh.userData.rig as AnimalRig;
              const [startLx, startLz] = clampAnimalLocalPos(
                (ani.localX - 0.5) * 1.7,
                (ani.localY - 0.5) * 1.7,
                ani.speciesId,
                habLevel
              );
              mesh.position.set(tileWx + startLx, 0.012, tileWz + startLz);
              const initYaw = Math.random() * Math.PI * 2;
              mesh.rotation.y = initYaw;
              actorsGroup.add(mesh);

              entry = {
                mesh,
                rig,
                speciesId: ani.speciesId,
                tileX: x,
                tileY: y,
                localX: startLx,
                localZ: startLz,
                targetX: startLx,
                targetZ: startLz,
                yaw: initYaw,
                currentSpeed: 0,
                gaitBlend: 0,
                walkPhase: Math.random() * Math.PI * 2,
                idlePhase: Math.random() * 10,
                restBlend: ani.isResting ? 1 : 0,
                actionBlend: 0,
                mode: 'idle',
                modeTimer: 0.8 + Math.random() * 2.2,
              };
              animalMeshes.set(ani.id, entry);
            }

            const isAnimalResting = Boolean(ani.isResting);
            entry.restBlend = THREE.MathUtils.damp(
              entry.restBlend,
              isAnimalResting ? 1 : 0,
              isAnimalResting ? 2.2 : 3.2,
              delta
            );

            if (s.speed > 0) {
              const timeMult = s.speed === 2 ? 1.85 : 1.0;

              if (isAnimalResting) {
                entry.idlePhase += delta * (s.speed === 2 ? 1.15 : 0.72);
                entry.mode = 'idle';
                entry.currentSpeed = THREE.MathUtils.damp(entry.currentSpeed, 0, 5.0, delta);
                entry.gaitBlend = THREE.MathUtils.damp(entry.gaitBlend, 0, 7.0, delta);
                entry.actionBlend = THREE.MathUtils.damp(entry.actionBlend, 0, 6.0, delta);
              } else {
                entry.idlePhase += delta * timeMult;
                entry.modeTimer -= delta * timeMult;

                const pace = getSpeciesPace(ani.speciesId);
                const hasWeatherTarget =
                  ani.weatherTargetX !== undefined && ani.weatherTargetY !== undefined;
                let weatherLx = 0;
                let weatherLz = 0;
                if (hasWeatherTarget) {
                  [weatherLx, weatherLz] = clampAnimalLocalPos(
                    (ani.weatherTargetX! - 0.5) * 1.7,
                    (ani.weatherTargetY! - 0.5) * 1.7,
                    ani.speciesId,
                    habLevel
                  );
                  const distToWeather = Math.hypot(weatherLx - entry.localX, weatherLz - entry.localZ);
                  if (distToWeather > 0.28 && entry.mode !== 'walking') {
                    entry.targetX = weatherLx;
                    entry.targetZ = weatherLz;
                    entry.mode = 'walking';
                    entry.modeTimer = 3.2;
                  }
                }

                if (entry.mode === 'idle' || entry.mode === 'signature') {
                  entry.currentSpeed = THREE.MathUtils.damp(entry.currentSpeed, 0, 5.0, delta);
                  if (entry.modeTimer <= 0) {
                    if (entry.mode === 'idle' && Math.random() < (hasWeatherTarget ? 0.6 : 0.48)) {
                      // Perform characteristic species behavior!
                      entry.mode = 'signature';
                      entry.modeTimer = 2.4 + Math.random() * 1.4;
                    } else if (hasWeatherTarget) {
                      const [wtx, wtz] = clampAnimalLocalPos(
                        weatherLx + (Math.random() - 0.5) * 0.22,
                        weatherLz + (Math.random() - 0.5) * 0.22,
                        ani.speciesId,
                        habLevel
                      );
                      entry.targetX = wtx;
                      entry.targetZ = wtz;
                      entry.mode = 'walking';
                      entry.modeTimer = 1.8 + Math.random() * 1.2;
                    } else if (ani.speciesId === 'toucan') {
                      entry.targetX = (Math.random() - 0.5) * 1.1;
                      entry.targetZ = (Math.random() - 0.5) * 1.1;
                      entry.mode = 'walking';
                      entry.modeTimer = 1.4 + Math.random() * 1.4;
                    } else {
                      const [tx, tz] = pickSafeAnimalTarget(ani.speciesId, habLevel);
                      entry.targetX = tx;
                      entry.targetZ = tz;
                      entry.mode = 'walking';
                      entry.modeTimer = 3.2 + Math.random() * 2.4;
                    }
                  }
                } else {
                  const dx = entry.targetX - entry.localX;
                  const dz = entry.targetZ - entry.localZ;
                  const dist = Math.hypot(dx, dz);

                  if (dist < 0.05 || entry.modeTimer <= 0) {
                    if (Math.random() < 0.45) {
                      entry.mode = 'signature';
                      entry.modeTimer = 2.4 + Math.random() * 1.4;
                    } else {
                      entry.mode = 'idle';
                      entry.modeTimer = 1.6 + Math.random() * 2.4;
                    }
                  } else {
                    const desiredSpeed = pace.speed * timeMult * Math.min(1, dist / 0.25);
                    entry.currentSpeed = THREE.MathUtils.damp(
                      entry.currentSpeed,
                      desiredSpeed,
                      5.0,
                      delta
                    );
                    const step = Math.min(dist, entry.currentSpeed * delta);
                    const [clampedX, clampedZ] = clampAnimalLocalPos(
                      entry.localX + (dx / dist) * step,
                      entry.localZ + (dz / dist) * step,
                      ani.speciesId,
                      habLevel
                    );
                    const moved = Math.hypot(clampedX - entry.localX, clampedZ - entry.localZ);
                    entry.localX = clampedX;
                    entry.localZ = clampedZ;
                    entry.walkPhase += moved * pace.strideFreq;

                    // If blocked from moving significantly, pick a new clear target
                    if (moved < step * 0.15 && step > 0.002) {
                      if (hasWeatherTarget) {
                        entry.mode = 'idle';
                        entry.modeTimer = 1.8 + Math.random() * 1.6;
                      } else {
                        const [newTx, newTz] = pickSafeAnimalTarget(ani.speciesId, habLevel);
                        entry.targetX = newTx;
                        entry.targetZ = newTz;
                      }
                    }

                    const targetYaw = Math.atan2(dx, dz);
                    entry.yaw = dampAngle(entry.yaw, targetYaw, 5.5, delta);
                  }
                }

                const targetGait =
                  pace.speed > 0 ? Math.min(1, entry.currentSpeed / (pace.speed * 0.75)) : 0;
                entry.gaitBlend = THREE.MathUtils.damp(entry.gaitBlend, targetGait, 7.0, delta);
                entry.actionBlend = THREE.MathUtils.damp(
                  entry.actionBlend,
                  entry.mode === 'signature' ? 1 : 0,
                  4.5,
                  delta
                );
              }
            } else {
              entry.gaitBlend = THREE.MathUtils.damp(entry.gaitBlend, 0, 8.0, delta);
              entry.actionBlend = THREE.MathUtils.damp(entry.actionBlend, 0, 8.0, delta);
            }

            tileEntries.push(entry);
          }

          // Gentle sibling separation so animals in the same habitat never walk through one another
          for (let i = 0; i < tileEntries.length; i++) {
            for (let j = i + 1; j < tileEntries.length; j++) {
              const a = tileEntries[i];
              const b = tileEntries[j];
              const minSep = getSpeciesRadius(a.speciesId) + getSpeciesRadius(b.speciesId) + 0.04;
              const dx = b.localX - a.localX;
              const dz = b.localZ - a.localZ;
              const dSq = dx * dx + dz * dz;
              if (dSq < minSep * minSep) {
                const d = Math.sqrt(dSq) || 0.001;
                const push = (minSep - d) * 0.5;
                const nx = dx / d;
                const nz = dz / d;
                const [ax, az] = clampAnimalLocalPos(a.localX - nx * push, a.localZ - nz * push, a.speciesId, habLevel);
                const [bx, bz] = clampAnimalLocalPos(b.localX + nx * push, b.localZ + nz * push, b.speciesId, habLevel);
                a.localX = ax;
                a.localZ = az;
                b.localX = bx;
                b.localZ = bz;
              }
            }
          }

          for (const entry of tileEntries) {
            entry.mesh.position.set(tileWx + entry.localX, 0.012, tileWz + entry.localZ);
            entry.mesh.rotation.y = entry.yaw;
            animateAnimalRig(
              entry.rig,
              entry.gaitBlend,
              entry.walkPhase,
              entry.idlePhase,
              entry.restBlend,
              entry.actionBlend
            );
          }
        }
      }
      for (const [id, entry] of animalMeshes.entries()) {
        if (!activeAnimalIds.has(id)) {
          actorsGroup.remove(entry.mesh);
          animalMeshes.delete(id);
        }
      }

      // 4. Sync Visitors with continuous corner-rounding, wall collisions & articulated walk
      const activeVisitorIds = new Set<string>();
      for (const vis of s.visitors) {
        activeVisitorIds.add(vis.id);
        let entry = visitorMeshes.get(vis.id);
        if (!entry) {
          const mesh = buildVisitorMesh(vis);
          const rig = mesh.userData.humanRig as HumanRig;
          const [laneX, laneZ] = hashIdToLane(vis.id);
          const [wx, wz] = gridToWorld(vis.x, vis.y);
          const [sx, sz] = resolveSolidTileCollisions(wx + laneX, wz + laneZ, s.grid, 0.22);
          mesh.position.set(sx, 0.01, sz);
          actorsGroup.add(mesh);
          entry = {
            mesh,
            rig,
            lastSimX: vis.x,
            lastSimY: vis.y,
            waypoints: [],
            laneX,
            laneZ,
            yaw: 0,
            gaitBlend: 0,
            walkPhase: Math.random() * Math.PI * 2,
            idlePhase: Math.random() * 10,
            archetype: vis.archetype,
          };
          visitorMeshes.set(vis.id, entry);
        }
        const isStargazing = (vis.stargazePauseTicks ?? 0) > 0;
        updateHumanLocomotion(entry, vis.x, vis.y, s.speed, s.isNight, s.grid, delta, isStargazing);
      }
      for (const [id, entry] of visitorMeshes.entries()) {
        if (!activeVisitorIds.has(id)) {
          actorsGroup.remove(entry.mesh);
          visitorMeshes.delete(id);
        }
      }

      // 5. Sync Staff (Caregivers + Cleaners) with continuous corner-rounding, wall collisions & articulated walk
      const activeKeeperIds = new Set<string>();
      for (const kpr of s.keepers) {
        activeKeeperIds.add(kpr.id);
        let entry = keeperMeshes.get(kpr.id);
        if (!entry || entry.role !== kpr.role) {
          if (entry) actorsGroup.remove(entry.mesh);
          const mesh = kpr.role === 'cleaner' ? buildCleanerMesh() : buildKeeperMesh();
          const rig = mesh.userData.humanRig as HumanRig;
          const [laneX, laneZ] = hashIdToLane(kpr.id);
          const [wx, wz] = gridToWorld(kpr.x, kpr.y);
          const [sx, sz] = resolveSolidTileCollisions(wx + laneX * 0.5, wz + laneZ * 0.5, s.grid, 0.22);
          mesh.position.set(sx, 0.01, sz);
          actorsGroup.add(mesh);
          entry = {
            mesh,
            rig,
            lastSimX: kpr.x,
            lastSimY: kpr.y,
            waypoints: [],
            laneX: laneX * 0.5,
            laneZ: laneZ * 0.5,
            yaw: 0,
            gaitBlend: 0,
            walkPhase: Math.random() * Math.PI * 2,
            idlePhase: Math.random() * 10,
            role: kpr.role,
          };
          keeperMeshes.set(kpr.id, entry);
        }
        updateHumanLocomotion(entry, kpr.x, kpr.y, s.speed, s.isNight, s.grid, delta);
      }
      for (const [id, entry] of keeperMeshes.entries()) {
        if (!activeKeeperIds.has(id)) {
          actorsGroup.remove(entry.mesh);
          keeperMeshes.delete(id);
        }
      }

      // 6. Dynamic 3D Weather + Wet Road Puddles + Heat-Mirage + Day/Night Lighting
      rainBlend = THREE.MathUtils.damp(rainBlend, s.weather === 'rainy' ? 1 : 0, 1.8, delta);
      heatBlend = THREE.MathUtils.damp(heatBlend, s.weather === 'heatwave' ? 1 : 0, 1.8, delta);

      let daySunIntensity = 1.5;
      let dayFogDensity = 0.0125;
      if (s.weather === 'rainy') {
        _targetSkyColor.set('#9DB2BF');
        _targetFogColor.set('#9DB2BF');
        _sunColor.set('#D8E6F2');
        daySunIntensity = 0.82;
        dayFogDensity = 0.0165;
        rainPoints.visible = true;
        if (s.speed > 0) {
          const posAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
          const rainStep = delta * (s.speed === 2 ? 1.45 : 1.0);
          for (let i = 0; i < rainCount; i++) {
            let py = posAttr.getY(i) - rainStep * 14;
            let px = posAttr.getX(i) - rainStep * 1.8;
            if (py < 0) {
              py = 14 + Math.random() * 2;
              px = (Math.random() - 0.5) * 38;
            }
            posAttr.setXY(i, px, py);
          }
          posAttr.needsUpdate = true;
        }
      } else if (s.weather === 'heatwave') {
        _targetSkyColor.set('#F3DFB8');
        _targetFogColor.set('#F3DFB8');
        _sunColor.set('#FFE4A8');
        daySunIntensity = 1.88;
        dayFogDensity = 0.0152;
        rainPoints.visible = false;
      } else if (s.weather === 'breezy') {
        _targetSkyColor.set('#CFE7EA');
        _targetFogColor.set('#CFE7EA');
        _sunColor.set('#FFFFFF');
        daySunIntensity = 1.38;
        dayFogDensity = 0.0118;
        rainPoints.visible = false;
      } else {
        _targetSkyColor.set('#D5E7D0');
        _targetFogColor.set('#D5E7D0');
        _sunColor.set('#FFF5DF');
        daySunIntensity = 1.5;
        dayFogDensity = 0.0125;
        rainPoints.visible = false;
      }

      // Modulate wet road sheen & darken stone/asphalt subtly during rainy monsoon weather
      if (Math.abs(rainBlend - lastAppliedWetness) > 0.012 || (rainBlend < 0.01 && lastAppliedWetness !== 0)) {
        lastAppliedWetness = rainBlend < 0.01 ? 0 : rainBlend;
        const wetAmt = lastAppliedWetness;
        for (let i = 0; i < roadMeshes.length; i++) {
          const obj = roadMeshes[i];
          const mat = obj.material as THREE.MeshStandardMaterial;
          const baseRough = (obj.userData.baseRoughness as number) ?? 0.86;
          const baseMetal = (obj.userData.baseMetalness as number) ?? 0.04;
          const baseHex = (obj.userData.baseColorHex as string) ?? '#FFFFFF';
          mat.roughness = THREE.MathUtils.lerp(baseRough, 0.24, wetAmt);
          mat.metalness = THREE.MathUtils.lerp(baseMetal, 0.2, wetAmt);
          mat.envMapIntensity = THREE.MathUtils.lerp(1.0, 1.55, wetAmt);
          _roadBaseColor.set(baseHex);
          _roadWetColor.copy(_roadBaseColor).lerp(_roadDarkWetTint, wetAmt * 0.26);
          mat.color.copy(_roadWetColor);
        }
      }

      // Reflective Road Puddles + Expanding Raindrop Ripple Rings
      const showPuddles = rainBlend > 0.025 && activePuddleSpots.length > 0;
      puddleMesh.visible = showPuddles;
      if (showPuddles) {
        puddleMat.opacity = rainBlend * (0.78 + 0.06 * Math.sin(weatherAnimAccum * 1.4));
        puddleMat.envMapIntensity = THREE.MathUtils.lerp(2.2, 1.7, nightBlend);
        puddleMat.color.copy(_dayPuddleSky).lerp(_nightPuddleSky, nightBlend);

        // Subtle warm lantern shimmer in puddles near gate/spotlights at night
        for (let i = 0; i < activePuddleSpots.length; i++) {
          if (activePuddleSpots[i].nearGate) {
            _puddleInstColor.set('#FFFFFF').lerp(_nightPuddleLanternTint, nightBlend * 0.72);
            puddleMesh.setColorAt(i, _puddleInstColor);
          }
        }
        if (puddleMesh.instanceColor) puddleMesh.instanceColor.needsUpdate = true;

        const rippleCount = Math.min(MAX_RIPPLES, activePuddleSpots.length * 2);
        rippleMesh.visible = rainBlend > 0.08 && rippleCount > 0;
        rippleMesh.count = rippleCount;
        rippleMat.opacity = rainBlend * (0.56 - nightBlend * 0.14);

        for (let i = 0; i < rippleCount; i++) {
          const rs = rippleStates[i];
          if (s.speed > 0) {
            rs.phase += delta * rs.speed * (s.speed === 2 ? 1.45 : 1.0);
            if (rs.phase >= 1) {
              rs.phase -= 1;
              rs.spotIdx = (rs.spotIdx + 7) % activePuddleSpots.length;
            }
          }
          const spot = activePuddleSpots[rs.spotIdx % activePuddleSpots.length];
          const ease = 1 - Math.pow(1 - rs.phase, 2);
          const ringSize = (0.08 + ease * 0.36) * Math.min(spot.rx, spot.rz);
          const fadeScale = rs.phase < 0.88 ? ringSize : ringSize * Math.max(0.01, (1 - rs.phase) * 8.3);
          _puddleDummy.position.set(
            spot.wx + rs.jitterX * spot.rx * 0.55,
            0,
            spot.wz + rs.jitterZ * spot.rz * 0.55
          );
          _puddleDummy.rotation.set(0, rs.phase * 0.6, 0);
          _puddleDummy.scale.set(fadeScale, 1, fadeScale);
          _puddleDummy.updateMatrix();
          rippleMesh.setMatrixAt(i, _puddleDummy.matrix);
        }
        rippleMesh.instanceMatrix.needsUpdate = true;
      } else {
        rippleMesh.visible = false;
      }

      // 3D Heat-Mirage Shimmer Ribbons & Rising Thermal Motes
      const showHeatMirage = heatBlend > 0.025;
      heatMirageMesh.visible = showHeatMirage;
      heatDustPoints.visible = showHeatMirage;
      if (showHeatMirage) {
        heatMirageMat.opacity = heatBlend * THREE.MathUtils.lerp(0.24, 0.12, nightBlend);
        const camAzimuth = Math.atan2(camera.position.x, camera.position.z);
        for (let i = 0; i < MAX_MIRAGES; i++) {
          const ms = mirageSpots[i];
          const wave = Math.sin(weatherAnimAccum * 2.1 + ms.phase);
          const rise = ((weatherAnimAccum * 0.22 + ms.phase * 0.19) % 1) * 0.45;
          _puddleDummy.position.set(
            ms.x + Math.sin(weatherAnimAccum * 1.3 + ms.phase) * 0.32,
            ms.baseY + rise,
            ms.z + Math.cos(weatherAnimAccum * 1.1 + ms.phase) * 0.2
          );
          _puddleDummy.rotation.set(-0.28, camAzimuth, wave * 0.06);
          _puddleDummy.scale.set(
            ms.scaleX * (1 + wave * 0.12),
            ms.scaleY * (0.9 + Math.cos(weatherAnimAccum * 2.8 + ms.phase) * 0.16),
            1
          );
          _puddleDummy.updateMatrix();
          heatMirageMesh.setMatrixAt(i, _puddleDummy.matrix);
        }
        heatMirageMesh.instanceMatrix.needsUpdate = true;

        heatDustMat.opacity = heatBlend * (0.48 - nightBlend * 0.2);
        if (s.speed > 0) {
          const dAttr = heatDustGeo.getAttribute('position') as THREE.BufferAttribute;
          const dustStep = delta * (s.speed === 2 ? 1.45 : 1.0);
          for (let i = 0; i < heatDustCount; i++) {
            let py = dAttr.getY(i) + dustStep * (0.45 + (i % 4) * 0.12);
            let px = dAttr.getX(i) + Math.sin(weatherAnimAccum * 1.8 + i) * dustStep * 0.25;
            if (py > 5.8) {
              py = 0.08 + Math.random() * 0.3;
              px = (Math.random() - 0.5) * 30;
            }
            dAttr.setXY(i, px, py);
          }
          dAttr.needsUpdate = true;
        }
      }

      // Seasonal 3D Particle Animation
      if (s.seasonalEvent) {
        seasonalPoints.visible = true;
        if (s.seasonalEvent === 'spring_sakura') {
          seasonalMat.color.set('#F9A8D4');
          seasonalMat.size = 0.25;
          seasonalMat.opacity = 0.9;
        } else if (s.seasonalEvent === 'winter_snow') {
          seasonalMat.color.set('#FFFFFF');
          seasonalMat.size = 0.22;
          seasonalMat.opacity = 0.92;
        } else if (s.seasonalEvent === 'autumn_maple') {
          seasonalMat.color.set('#FB923C');
          seasonalMat.size = 0.26;
          seasonalMat.opacity = 0.9;
        } else {
          seasonalMat.color.set('#FDE047');
          seasonalMat.size = 0.2;
          seasonalMat.opacity = 0.85;
        }

        const posAttr = seasonalGeo.getAttribute('position') as THREE.BufferAttribute;
        const stepDt = s.speed === 0 ? delta * 0.25 : delta * (s.speed === 2 ? 1.5 : 1.0);
        for (let i = 0; i < seasonalCount; i++) {
          let px = posAttr.getX(i);
          let py = posAttr.getY(i);
          let pz = posAttr.getZ(i);

          if (s.seasonalEvent === 'summer_lantern') {
            // Gently drifting fireflies above walkways and gardens
            px += Math.sin(elapsed * 1.4 + i) * stepDt * 0.45;
            pz += Math.cos(elapsed * 1.1 + i * 0.7) * stepDt * 0.45;
            py += Math.sin(elapsed * 2.0 + i * 1.3) * stepDt * 0.35;
            if (py > 4.2) py = 0.35;
            if (py < 0.2) py = 2.8;
          } else {
            const fallSpeed = s.seasonalEvent === 'winter_snow' ? 1.65 : 1.35;
            py -= stepDt * fallSpeed;
            px += Math.sin(elapsed * 1.6 + i * 0.65) * stepDt * 0.55 + stepDt * 0.22;
            pz += Math.cos(elapsed * 1.3 + i * 0.45) * stepDt * 0.4;
            if (py < 0.05) {
              py = 9.5 + Math.random() * 2.5;
              px = (Math.random() - 0.5) * 32;
              pz = (Math.random() - 0.5) * 26;
            }
          }
          posAttr.setXYZ(i, px, py, pz);
        }
        posAttr.needsUpdate = true;
      } else {
        seasonalPoints.visible = false;
      }

      nightBlend = THREE.MathUtils.damp(nightBlend, s.isNight ? 1 : 0, 2.2, delta);

      // Blend daylight colors into deep twilight night
      _targetSkyColor.lerp(_nightSkyColor, nightBlend);
      _targetFogColor.lerp(_nightSkyColor, nightBlend);
      _sunColor.lerp(_nightMoonColor, nightBlend);
      _targetHemiSky.copy(_dayHemiSkyColor).lerp(_nightHemiSkyColor, nightBlend);
      _targetHemiGround.copy(_dayHemiGroundColor).lerp(_nightHemiGroundColor, nightBlend);

      const targetSunIntensity = THREE.MathUtils.lerp(daySunIntensity, 0.28, nightBlend);
      sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, targetSunIntensity, 3, delta);
      hemiLight.intensity = THREE.MathUtils.damp(
        hemiLight.intensity,
        THREE.MathUtils.lerp(0.78, 0.22, nightBlend),
        3,
        delta
      );
      rimLight.intensity = THREE.MathUtils.damp(
        rimLight.intensity,
        THREE.MathUtils.lerp(0.4, 0.16, nightBlend),
        3,
        delta
      );
      const dayExposure = s.weather === 'heatwave' ? 1.12 : s.weather === 'rainy' ? 0.99 : 1.06;
      renderer.toneMappingExposure = THREE.MathUtils.damp(
        renderer.toneMappingExposure,
        THREE.MathUtils.lerp(dayExposure, 0.92, nightBlend),
        3,
        delta
      );

      (scene.background as THREE.Color).lerp(_targetSkyColor, Math.min(1, delta * 2.5));
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.lerp(_targetFogColor, Math.min(1, delta * 2.5));
        const targetFogDensity = THREE.MathUtils.lerp(
          dayFogDensity,
          s.weather === 'rainy' ? 0.018 : 0.015,
          nightBlend
        );
        scene.fog.density = THREE.MathUtils.damp(scene.fog.density, targetFogDensity, 2.5, delta);
      }
      sunLight.color.lerp(_sunColor, Math.min(1, delta * 2.5));
      hemiLight.color.copy(_targetHemiSky);
      hemiLight.groundColor.copy(_targetHemiGround);

      // Drive Gate & Pooled Exhibit Spotlights
      const showSpots = nightBlend > 0.02;
      gateSpotRig.light.visible = showSpots;
      gateSpotRig.cone.visible = showSpots;
      gateSpotRig.pool.visible = showSpots;
      gateSpotRig.light.intensity = nightBlend * 18;
      gateSpotRig.coneMat.opacity = nightBlend * 0.16;
      gateSpotRig.poolMat.opacity = nightBlend * 0.26;

      // Pick up to 4 connected habitats (preferring inhabited ones) for exhibit spotlights
      const spotTargets: Array<{ wx: number; wz: number }> = [];
      for (let y = 0; y < GRID_ROWS && spotTargets.length < exhibitSpotRigs.length; y++) {
        for (let x = 0; x < GRID_COLS && spotTargets.length < exhibitSpotRigs.length; x++) {
          const t = s.grid[y][x];
          if (t.type === 'habitat' && t.connected && t.habitat && t.habitat.animals.length > 0) {
            const [wx, wz] = gridToWorld(x, y);
            spotTargets.push({ wx, wz });
          }
        }
      }
      if (spotTargets.length < exhibitSpotRigs.length) {
        for (let y = 0; y < GRID_ROWS && spotTargets.length < exhibitSpotRigs.length; y++) {
          for (let x = 0; x < GRID_COLS && spotTargets.length < exhibitSpotRigs.length; x++) {
            const t = s.grid[y][x];
            if (t.type === 'habitat' && t.connected && t.habitat && t.habitat.animals.length === 0) {
              const [wx, wz] = gridToWorld(x, y);
              spotTargets.push({ wx, wz });
            }
          }
        }
      }

      for (let i = 0; i < exhibitSpotRigs.length; i++) {
        const rig = exhibitSpotRigs[i];
        const target = spotTargets[i];
        const active = showSpots && Boolean(target);
        rig.light.visible = active;
        rig.cone.visible = active;
        rig.pool.visible = active;
        if (target && active) {
          rig.light.position.set(target.wx, rig.height, target.wz);
          rig.light.target.position.set(target.wx, 0.05, target.wz);
          rig.cone.position.set(target.wx, rig.height * 0.5, target.wz);
          rig.pool.position.set(target.wx, 0.028, target.wz);
          rig.light.intensity = nightBlend * 15;
          rig.coneMat.opacity = nightBlend * 0.14;
          rig.poolMat.opacity = nightBlend * 0.24;
        } else {
          rig.light.intensity = 0;
        }
      }

      // 7. Camera Mode: First-Person Photo Mode vs Orbit Management Camera
      if (s.photoMode !== prevPhotoMode) {
        if (s.photoMode) {
          savedOrbitPos.copy(camera.position);
          savedOrbitTarget.copy(controls.target);
          savedOrbitFov = camera.fov;
          controls.enabled = false;
          cameraCmdRef.current = null;

          const [spawnX, spawnZ] = gridToWorld(GATE_POS.x, Math.max(0, GATE_POS.y - 1));
          fpYaw = 0;
          fpPitch = -0.04;
          fpHeight = 0.78;
          fpFov = 48;
          camera.position.set(spawnX, fpHeight, spawnZ);
          camera.rotation.set(fpPitch, fpYaw, 0, 'YXZ');
          camera.fov = fpFov;
          camera.updateProjectionMatrix();
          setPhotoFov(fpFov);
          setProjectedLabels([]);
        } else {
          controls.enabled = true;
          pressedKeys.clear();
          fpDragActive = false;
          camera.position.copy(savedOrbitPos);
          controls.target.copy(savedOrbitTarget);
          camera.fov = savedOrbitFov;
          camera.updateProjectionMatrix();
          controls.update();
          setCapturedPhoto(null);
        }
        prevPhotoMode = s.photoMode;
      }

      if (s.photoMode) {
        const forwardX = -Math.sin(fpYaw);
        const forwardZ = -Math.cos(fpYaw);
        const rightX = Math.cos(fpYaw);
        const rightZ = -Math.sin(fpYaw);

        let moveForward = 0;
        let moveRight = 0;
        if (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp')) moveForward += 1;
        if (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown')) moveForward -= 1;
        if (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight')) moveRight += 1;
        if (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft')) moveRight -= 1;

        const moveLen = Math.hypot(moveForward, moveRight);
        if (moveLen > 0) {
          const isSprint = pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight');
          const moveSpeed = isSprint ? 4.2 : 2.35;
          const step = (moveSpeed * delta) / moveLen;
          let nextCamX = THREE.MathUtils.clamp(
            camera.position.x + (forwardX * moveForward + rightX * moveRight) * step,
            -17.5,
            17.5
          );
          let nextCamZ = THREE.MathUtils.clamp(
            camera.position.z + (forwardZ * moveForward + rightZ * moveRight) * step,
            -14.5,
            14.5
          );
          if (fpHeight < 1.15) {
            [nextCamX, nextCamZ] = resolveSolidTileCollisions(nextCamX, nextCamZ, s.grid, 0.22);
          }
          camera.position.x = nextCamX;
          camera.position.z = nextCamZ;
        }

        if (pressedKeys.has('KeyE')) {
          fpHeight = THREE.MathUtils.clamp(fpHeight + delta * 1.4, 0.28, 2.8);
        }
        if (pressedKeys.has('KeyQ')) {
          fpHeight = THREE.MathUtils.clamp(fpHeight - delta * 1.4, 0.28, 2.8);
        }
        camera.position.y = THREE.MathUtils.damp(camera.position.y, fpHeight, 10, delta);

        if (Math.abs(camera.fov - fpFov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, fpFov, 10, delta);
          camera.updateProjectionMatrix();
        }
        camera.rotation.set(fpPitch, fpYaw, 0, 'YXZ');
      } else {
        if (cameraCmdRef.current) {
          const [tx, ty, tz] = cameraCmdRef.current.targetPos;
          const [lx, ly, lz] = cameraCmdRef.current.targetLook;
          camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 6, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 6, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, tz, 6, delta);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, lx, 6, delta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, ly, 6, delta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, lz, 6, delta);
          if (camera.position.distanceTo(_projVec.set(tx, ty, tz)) < 0.08) {
            cameraCmdRef.current = null;
          }
        }
        controls.update();
      }

      // 8. Project 2D labels throttled ~15fps (suppressed in Photo Mode)
      if (!s.photoMode && elapsed - lastLabelSync > 0.065) {
        lastLabelSync = elapsed;
        const cw = container?.clientWidth || 0;
        const ch = container?.clientHeight || 0;
        if (cw > 0 && ch > 0) {
          const labels: ProjectedLabel[] = [];

          for (const p of s.popups) {
            const [wx, wz] = gridToWorld(p.x, p.y);
            _projVec.set(wx, 1.25, wz).project(camera);
            if (_projVec.z < 1) {
              labels.push({
                id: p.id,
                x: Math.round(((_projVec.x + 1) / 2) * cw),
                y: Math.round(((-_projVec.y + 1) / 2) * ch),
                text: p.text,
                kind: 'popup',
                tone: p.tone,
              });
            }
          }

          // Show selected visitor labels, plus auto-generated weather comfort speech bubbles near pavilions
          let activeWeatherBubbleCount = 0;
          for (const vis of s.visitors) {
            const entry = visitorMeshes.get(vis.id);
            if (!entry) continue;

            if ((vis.photoPauseTicks ?? 0) > 0) {
              _projVec.copy(entry.mesh.position);
              _projVec.y += 1.16;
              _projVec.project(camera);
              if (_projVec.z < 1) {
                labels.push({
                  id: `hr_${vis.id}`,
                  x: Math.round(((_projVec.x + 1) / 2) * cw),
                  y: Math.round(((-_projVec.y + 1) / 2) * ch),
                  text: '合影留念',
                  kind: 'heart',
                });
              }
            }

            if ((vis.stargazePauseTicks ?? 0) > 0) {
              _projVec.copy(entry.mesh.position);
              _projVec.y += vis.id === s.selectedVisitorId ? 1.32 : 1.12;
              _projVec.project(camera);
              if (_projVec.z < 1) {
                labels.push({
                  id: `sg_${vis.id}`,
                  x: Math.round(((_projVec.x + 1) / 2) * cw),
                  y: Math.round(((-_projVec.y + 1) / 2) * ch),
                  text: '✨',
                  kind: 'stargaze',
                });
              }
            }

            if (vis.id === s.selectedVisitorId) {
              _projVec.copy(entry.mesh.position);
              _projVec.y += 0.96;
              _projVec.project(camera);
              if (_projVec.z < 1) {
                const moodInfo = getVisitorMoodInfo(vis.mood);
                const hasWeatherComfort = (vis.weatherComfortBubbleTicks ?? 0) > 0 && vis.weatherComfortWeather;
                labels.push({
                  id: `vis_${vis.id}`,
                  x: Math.round(((_projVec.x + 1) / 2) * cw),
                  y: Math.round(((-_projVec.y + 1) / 2) * ch),
                  text: `${vis.name} · ${moodInfo.label} ${Math.round(vis.mood)}%`,
                  subText: hasWeatherComfort && vis.weatherComfortBoost ? `心情 +${vis.weatherComfortBoost}%` : undefined,
                  dialogue: vis.thought || undefined,
                  nextFacility:
                    s.goldenGuideUnlocked && vis.plannedDestination
                      ? vis.plannedDestination.label
                      : undefined,
                  moodPct: Math.round(vis.mood),
                  moodTone: moodInfo.tone,
                  selected: true,
                  kind: 'visitor',
                  weatherType: hasWeatherComfort ? vis.weatherComfortWeather : undefined,
                });
              }
            } else if (
              (vis.weatherComfortBubbleTicks ?? 0) > 0 &&
              vis.thought &&
              activeWeatherBubbleCount < 5
            ) {
              _projVec.copy(entry.mesh.position);
              _projVec.y += 1.02;
              _projVec.project(camera);
              if (_projVec.z < 1) {
                activeWeatherBubbleCount += 1;
                labels.push({
                  id: `wc_${vis.id}`,
                  x: Math.round(((_projVec.x + 1) / 2) * cw),
                  y: Math.round(((-_projVec.y + 1) / 2) * ch),
                  text: vis.thought,
                  subText: `${vis.name} · 心情 +${vis.weatherComfortBoost ?? 9}%`,
                  kind: 'weather_comfort',
                  weatherType: vis.weatherComfortWeather,
                });
              }
            }
          }

          for (let y = 0; y < GRID_ROWS; y++) {
            for (let x = 0; x < GRID_COLS; x++) {
              const t = s.grid[y][x];
              if (t.type !== 'habitat' || !t.habitat) continue;
              const hasLowNeed =
                t.habitat.cleanliness < 40 ||
                t.habitat.animals.some((a) => a.hunger < 40 || a.happiness < 40);
              if (!t.connected || hasLowNeed) {
                const [wx, wz] = gridToWorld(x, y);
                _projVec.set(wx, 1.08, wz).project(camera);
                if (_projVec.z < 1) {
                  labels.push({
                    id: `al_${x}_${y}`,
                    x: Math.round(((_projVec.x + 1) / 2) * cw),
                    y: Math.round(((-_projVec.y + 1) / 2) * ch),
                    text: !t.connected ? '未連步道' : '需照護',
                    kind: 'alert',
                    tone: !t.connected ? 'rose' : 'amber',
                  });
                }
              }
            }
          }

          if (!projectedLabelsEqual(prevProjectedLabels, labels)) {
            prevProjectedLabels = labels;
            setProjectedLabels(labels);
          }
        }
      }
    }

    const thumbCamera = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 120);
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 280;
    thumbCanvas.height = 210;
    const thumbCtx = thumbCanvas.getContext('2d');
    const _thumbVpSize = new THREE.Vector2();

    function captureCommemorativePhoto(req: PendingPhotoCapture): string | null {
      if (!thumbCtx) return null;
      renderer.getSize(_thumbVpSize);
      if (_thumbVpSize.x < 60 || _thumbVpSize.y < 60) return null;

      const visEntry = visitorMeshes.get(req.visitorId);
      const aniEntry = animalMeshes.get(req.animalId);
      const [visFbX, visFbZ] = gridToWorld(req.tileX, req.tileY);
      const [habFbX, habFbZ] = gridToWorld(req.habitatX, req.habitatY);

      const vx = visEntry ? visEntry.mesh.position.x : visFbX;
      const vz = visEntry ? visEntry.mesh.position.z : visFbZ;
      const ax = aniEntry ? aniEntry.mesh.position.x : habFbX;
      const az = aniEntry ? aniEntry.mesh.position.z : habFbZ;

      const midX = (vx + ax) * 0.5;
      const midZ = (vz + az) * 0.5;
      let dx = vx - ax;
      let dz = vz - az;
      let sep = Math.hypot(dx, dz);
      if (sep < 0.25) {
        dx = 0;
        dz = 1;
        sep = 1;
      }

      let px = -dz / sep;
      let pz = dx / sep;
      const toMainX = camera.position.x - midX;
      const toMainZ = camera.position.z - midZ;
      if (px * toMainX + pz * toMainZ < 0) {
        px = -px;
        pz = -pz;
      }

      const biasX = dx / sep;
      const biasZ = dz / sep;
      const dirLen = Math.hypot(px * 0.85 + biasX * 0.25, pz * 0.85 + biasZ * 0.25) || 1;
      const dirX = (px * 0.85 + biasX * 0.25) / dirLen;
      const dirZ = (pz * 0.85 + biasZ * 0.25) / dirLen;

      const camDist = THREE.MathUtils.clamp(sep * 1.42 + 1.42, 2.5, 4.5);
      const camHeight = THREE.MathUtils.clamp(camDist * 0.48, 1.35, 2.3);
      thumbCamera.position.set(midX + dirX * camDist, camHeight, midZ + dirZ * camDist);
      thumbCamera.lookAt(midX, 0.42, midZ);
      thumbCamera.updateMatrixWorld();

      const prevHoverVis = hoverFrame.visible;
      const prevSelVis = selectedFrame.visible;
      const prevGuideVis = guideTargetFrame.visible;
      hoverFrame.visible = false;
      selectedFrame.visible = false;
      guideTargetFrame.visible = false;

      try {
        const cssCapW = Math.min(280, Math.floor(_thumbVpSize.x));
        const cssCapH = Math.min(210, Math.floor(_thumbVpSize.y));
        const dpr = renderer.getPixelRatio();
        const physW = Math.max(1, Math.round(cssCapW * dpr));
        const physH = Math.max(1, Math.round(cssCapH * dpr));
        const canvasH = renderer.domElement.height;

        thumbCamera.aspect = cssCapW / cssCapH;
        thumbCamera.updateProjectionMatrix();

        renderer.setScissorTest(true);
        renderer.setViewport(0, 0, cssCapW, cssCapH);
        renderer.setScissor(0, 0, cssCapW, cssCapH);
        renderer.clear();
        renderer.render(scene, thumbCamera);

        thumbCtx.clearRect(0, 0, 280, 210);
        thumbCtx.drawImage(
          renderer.domElement,
          0,
          Math.max(0, canvasH - physH),
          physW,
          physH,
          0,
          0,
          280,
          210
        );

        return thumbCanvas.toDataURL('image/jpeg', 0.78);
      } catch {
        return null;
      } finally {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, _thumbVpSize.x, _thumbVpSize.y);
        hoverFrame.visible = prevHoverVis;
        selectedFrame.visible = prevSelVis;
        guideTargetFrame.visible = prevGuideVis;
      }
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(0.08, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      if (!document.hidden) {
        syncSceneObjects(delta, elapsed);

        if (pendingPhotoQueueRef.current.length > 0) {
          const req = pendingPhotoQueueRef.current.shift()!;
          const dataUrl = captureCommemorativePhoto(req);
          if (dataUrl) {
            onPhotoCapturedRef.current?.(req.id, dataUrl);
          }
        }

        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onFpKeyDown);
      window.removeEventListener('keyup', onFpKeyUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      beamTex.dispose();
      poolTex.dispose();
      seasonalParticleTex.dispose();
      puddleGeo.dispose();
      puddleMat.dispose();
      rippleGeo.dispose();
      rippleMat.dispose();
      heatMirageGeo.dispose();
      heatMirageMat.dispose();
      heatDustGeo.dispose();
      heatDustMat.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      seasonalGeo.dispose();
      seasonalMat.dispose();
      gateConeGeo.dispose();
      gatePoolGeo.dispose();
      exhibitConeGeo.dispose();
      exhibitPoolGeo.dispose();
      renderer.dispose();
    };
  }, []);

  const focalLengthMm = Math.round(35 * (48 / photoFov));

  return (
    <div
      className={`relative overflow-hidden bg-[#C8DFC2] select-none ${
        photoMode
          ? 'w-full h-full rounded-none border-0'
          : 'w-full h-[calc(100dvh-16.5rem)] min-h-[320px] max-h-[520px] sm:h-[520px] lg:h-[610px] rounded-2xl border-2 border-[#2A5038] shadow-sm'
      }`}
    >
      {/* Dedicated WebGL Mount */}
      <div
        ref={mountRef}
        className={`w-full h-full touch-none ${
          photoMode ? 'cursor-crosshair active:cursor-grabbing' : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* Dynamic Weather Viewport Filter & Lens Overlay */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none overflow-hidden z-[5] transition-opacity duration-700 ${
          speed === 0 ? 'weather-paused' : ''
        }`}
      >
        {weather === 'rainy' && (
          <>
            {/* Cool damp rain mist & lens condensation vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-sky-900/20 via-slate-800/5 to-sky-950/15" />
            <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(14,45,75,0.32)]" />

            {/* Diagonal foreground rain streaks for parallax depth */}
            <svg
              className="absolute -inset-6 w-[calc(100%+48px)] h-[calc(100%+48px)] opacity-30 animate-weather-rain"
              viewBox="0 0 400 260"
              preserveAspectRatio="none"
            >
              <g stroke="#E0F2FE" strokeWidth="0.9" strokeLinecap="round">
                <line x1="28" y1="12" x2="20" y2="34" />
                <line x1="74" y1="45" x2="66" y2="70" />
                <line x1="118" y1="18" x2="110" y2="40" />
                <line x1="164" y1="88" x2="156" y2="114" />
                <line x1="210" y1="30" x2="202" y2="56" />
                <line x1="258" y1="104" x2="249" y2="132" />
                <line x1="304" y1="22" x2="296" y2="48" />
                <line x1="352" y1="68" x2="344" y2="94" />
                <line x1="48" y1="146" x2="40" y2="172" />
                <line x1="102" y1="176" x2="94" y2="202" />
                <line x1="184" y1="158" x2="176" y2="184" />
                <line x1="238" y1="192" x2="230" y2="220" />
                <line x1="322" y1="162" x2="314" y2="190" />
                <line x1="376" y1="138" x2="368" y2="164" />
              </g>
            </svg>

            {/* Refractive lens water droplets around outer glass */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1000 600"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <radialGradient id="zoo-rain-drop" cx="35%" cy="32%" r="65%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.68)" />
                  <stop offset="35%" stopColor="rgba(205,234,254,0.22)" />
                  <stop offset="78%" stopColor="rgba(120,175,215,0.16)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.38)" />
                </radialGradient>
              </defs>

              {/* Static edge lens beads */}
              <g opacity="0.72">
                <ellipse cx="64" cy="82" rx="6" ry="8" fill="url(#zoo-rain-drop)" />
                <ellipse cx="142" cy="48" rx="4.5" ry="6" fill="url(#zoo-rain-drop)" />
                <ellipse cx="892" cy="76" rx="7" ry="9" fill="url(#zoo-rain-drop)" />
                <ellipse cx="944" cy="144" rx="5" ry="7" fill="url(#zoo-rain-drop)" />
                <ellipse cx="48" cy="462" rx="6.5" ry="8.5" fill="url(#zoo-rain-drop)" />
                <ellipse cx="116" cy="518" rx="4.5" ry="5.5" fill="url(#zoo-rain-drop)" />
                <ellipse cx="922" cy="442" rx="6" ry="8" fill="url(#zoo-rain-drop)" />
                <ellipse cx="848" cy="530" rx="5" ry="6.5" fill="url(#zoo-rain-drop)" />
                <circle cx="235" cy="36" r="3.5" fill="url(#zoo-rain-drop)" />
                <circle cx="765" cy="44" r="4" fill="url(#zoo-rain-drop)" />
                <circle cx="968" cy="296" r="4.2" fill="url(#zoo-rain-drop)" />
                <circle cx="34" cy="264" r="3.8" fill="url(#zoo-rain-drop)" />
              </g>

              {/* Gently sliding droplets down the glass */}
              <g className="animate-rain-droplets">
                <ellipse cx="92" cy="128" rx="4.5" ry="9" fill="url(#zoo-rain-drop)" />
                <ellipse cx="868" cy="166" rx="5" ry="10" fill="url(#zoo-rain-drop)" />
                <ellipse cx="182" cy="422" rx="4" ry="8" fill="url(#zoo-rain-drop)" />
                <ellipse cx="792" cy="390" rx="4.5" ry="9.5" fill="url(#zoo-rain-drop)" />
              </g>
              <g className="animate-rain-droplets-slow">
                <ellipse cx="128" cy="240" rx="5.5" ry="11" fill="url(#zoo-rain-drop)" />
                <ellipse cx="910" cy="280" rx="5" ry="10" fill="url(#zoo-rain-drop)" />
                <ellipse cx="690" cy="96" rx="3.8" ry="7.5" fill="url(#zoo-rain-drop)" />
                <ellipse cx="305" cy="492" rx="4.2" ry="8.5" fill="url(#zoo-rain-drop)" />
              </g>
            </svg>
          </>
        )}

        {weather === 'heatwave' && (
          <>
            {/* Warm golden-amber thermal atmosphere & sun glare */}
            <div
              className={`absolute inset-0 bg-gradient-to-b ${
                isNight
                  ? 'from-amber-900/12 via-transparent to-orange-950/18'
                  : 'from-amber-400/22 via-orange-200/8 to-amber-500/18'
              }`}
            />
            {!isNight && (
              <div className="absolute -top-28 -right-24 w-[28rem] h-[28rem] rounded-full bg-radial from-amber-200/45 via-orange-200/15 to-transparent animate-sun-breathe" />
            )}
            <div
              className={`absolute inset-0 ${
                isNight
                  ? 'shadow-[inset_0_0_80px_rgba(180,83,9,0.18)]'
                  : 'shadow-[inset_0_0_115px_rgba(245,158,11,0.32)]'
              }`}
            />

            {/* Refractive backdrop heat-mirage bands distorting underlying 3D scene */}
            <div className="absolute inset-x-0 top-[14%] h-[22%] heat-mirage-refraction bg-gradient-to-b from-transparent via-amber-100/12 to-transparent animate-heat-mirage" />
            <div className="absolute inset-x-0 top-[44%] h-[24%] heat-mirage-refraction bg-gradient-to-b from-transparent via-orange-100/10 to-transparent animate-heat-mirage-reverse" />
            <div className="absolute inset-x-0 bottom-[6%] h-[26%] heat-mirage-refraction bg-gradient-to-t from-orange-300/16 via-amber-100/10 to-transparent animate-heat-mirage" />

            {/* Lightweight SVG thermal wave curves (animated via CSS without heavy SVG turbulence filters) */}
            <svg
              className="absolute inset-0 w-full h-full opacity-75 animate-heat-mirage"
              viewBox="0 0 1000 600"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="zoo-heat-band" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(253,224,71,0.0)" />
                  <stop offset="45%" stopColor="rgba(254,215,170,0.28)" />
                  <stop offset="100%" stopColor="rgba(251,191,36,0.0)" />
                </linearGradient>
              </defs>

              <g>
                <rect x="0" y="65" width="1000" height="175" fill="url(#zoo-heat-band)" />
                <rect x="0" y="255" width="1000" height="165" fill="url(#zoo-heat-band)" opacity="0.72" />
                <path
                  d="M-40 155 Q 240 128 520 158 T 1040 146"
                  fill="none"
                  stroke="rgba(255,247,214,0.38)"
                  strokeWidth="12"
                />
                <path
                  d="M-40 315 Q 280 340 560 308 T 1040 326"
                  fill="none"
                  stroke="rgba(254,215,170,0.32)"
                  strokeWidth="10"
                />
                <path
                  d="M-40 462 Q 260 442 540 466 T 1040 452"
                  fill="none"
                  stroke="rgba(253,224,71,0.24)"
                  strokeWidth="9"
                />
              </g>
            </svg>

            {/* Subtle rising thermal haze */}
            <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-amber-200/16 to-transparent animate-heat-shimmer" />
          </>
        )}

        {weather === 'breezy' && (
          <>
            <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/8 via-transparent to-cyan-200/10" />
            <svg
              className="absolute inset-0 w-full h-full animate-breezy-drift"
              viewBox="0 0 1000 600"
              preserveAspectRatio="none"
            >
              <g fill="none" stroke="rgba(236,253,245,0.42)" strokeLinecap="round">
                <path d="M40 150 Q 260 120 480 148 T 890 130" strokeWidth="1.6" />
                <path d="M120 290 Q 340 268 560 288 T 940 264" strokeWidth="1.3" />
                <path d="M70 430 Q 290 412 510 432 T 860 415" strokeWidth="1.4" />
              </g>
              <g fill="rgba(220,252,231,0.52)">
                <ellipse cx="220" cy="142" rx="3.5" ry="1.8" transform="rotate(-18 220 142)" />
                <ellipse cx="640" cy="276" rx="4" ry="2" transform="rotate(-12 640 276)" />
                <ellipse cx="470" cy="418" rx="3" ry="1.6" transform="rotate(-22 470 418)" />
              </g>
            </svg>
          </>
        )}

        {weather === 'sunny' && !isNight && (
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-radial from-amber-200/32 via-amber-100/10 to-transparent animate-sun-breathe" />
        )}

        {seasonalEvent === 'spring_sakura' && weather !== 'rainy' && (
          <div className="absolute inset-0 bg-gradient-to-b from-pink-200/10 via-transparent to-rose-200/10" />
        )}

        {seasonalEvent === 'winter_snow' && weather !== 'heatwave' && (
          <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(226,232,240,0.28)] bg-sky-50/5" />
        )}
      </div>

      {/* Projected 2D Semantic Labels Overlay (hidden in Photo Mode) */}
      {!photoMode && (
        <div ref={overlayRef} className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {projectedLabels.map((lbl) => {
            if (lbl.kind === 'popup') {
              return (
                <div
                  key={lbl.id}
                  className={`absolute font-mono-num text-xs font-bold whitespace-nowrap px-2 py-0.5 rounded border shadow-xs ${
                    lbl.tone === 'gold'
                      ? 'bg-[#FFFBEB] text-amber-800 border-amber-300'
                      : lbl.tone === 'green'
                      ? 'bg-[#ECFDF5] text-emerald-900 border-emerald-300'
                      : lbl.tone === 'amber'
                      ? 'bg-[#FFF7ED] text-orange-800 border-orange-300'
                      : 'bg-[#FFF1F2] text-rose-800 border-rose-300'
                  }`}
                  style={{
                    transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
                  }}
                >
                  {lbl.text}
                </div>
              );
            }

            if (lbl.kind === 'heart') {
              return (
                <div
                  key={lbl.id}
                  className="absolute flex items-center justify-center w-6 h-6 rounded-full bg-rose-50 border border-rose-300 shadow-xs"
                  style={{
                    transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
                  }}
                >
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-bounce" />
                </div>
              );
            }

            if (lbl.kind === 'stargaze') {
              return (
                <div
                  key={lbl.id}
                  className="absolute text-base leading-none select-none animate-pulse [text-shadow:0_0_8px_rgba(253,224,71,0.95)]"
                  style={{
                    transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
                  }}
                >
                  {lbl.text}
                </div>
              );
            }

            if (lbl.kind === 'alert') {
              return (
                <div
                  key={lbl.id}
                  className={`absolute text-[10px] font-bold px-1.5 py-0.5 rounded text-white whitespace-nowrap shadow-xs ${
                    lbl.tone === 'rose' ? 'bg-rose-700' : 'bg-amber-600'
                  }`}
                  style={{
                    transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
                  }}
                >
                  {lbl.text}
                </div>
              );
            }

            if (lbl.kind === 'weather_comfort') {
              const isHeat = lbl.weatherType === 'heatwave';
              return (
                <div
                  key={lbl.id}
                  className="absolute flex flex-col items-center z-10"
                  style={{
                    transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
                  }}
                >
                  <div
                    className={`max-w-[215px] rounded-xl border px-2.5 py-1.5 shadow-md backdrop-blur-[2px] ${
                      isHeat
                        ? 'bg-[#FFFDF7]/95 border-orange-300 text-[#1A2B20]'
                        : 'bg-[#F7FBFF]/95 border-sky-300 text-[#1A2B20]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-bold mb-0.5 whitespace-nowrap">
                      <span className={isHeat ? 'text-orange-700' : 'text-sky-700'}>
                        {isHeat ? '⛱️ 涼亭遮陽' : '☂️ 涼亭避雨'}
                      </span>
                      {lbl.subText && (
                        <span className="text-emerald-700 font-mono-num">{lbl.subText}</span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold leading-snug text-[#1A2B20]">
                      {lbl.text}
                    </p>
                  </div>
                  <div
                    className={`w-2.5 h-2.5 -mt-1.5 rotate-45 border-r border-b ${
                      isHeat
                        ? 'bg-[#FFFDF7] border-orange-300'
                        : 'bg-[#F7FBFF] border-sky-300'
                    }`}
                    aria-hidden="true"
                  />
                </div>
              );
            }

            if (lbl.kind === 'visitor') {
              const dialogueColor =
                lbl.moodTone === 'rose'
                  ? 'text-[#FFE4E6]'
                  : lbl.moodTone === 'amber'
                  ? 'text-[#FEF3C7]'
                  : 'text-white';
              return (
                <div
                  key={lbl.id}
                  className={`absolute flex flex-col items-center ${lbl.selected ? 'z-20' : ''}`}
                  style={{
                    transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
                  }}
                >
                  {lbl.weatherType && (
                    <span
                      className={`mb-0.5 px-2 py-0.5 rounded-md border text-[10px] font-bold whitespace-nowrap shadow-xs ${
                        lbl.weatherType === 'heatwave'
                          ? 'bg-orange-50/95 border-orange-300 text-orange-800'
                          : 'bg-sky-50/95 border-sky-300 text-sky-800'
                      }`}
                    >
                      {lbl.weatherType === 'heatwave' ? '⛱️ 涼亭遮陽' : '☂️ 涼亭避雨'}
                      {lbl.subText ? ` · ${lbl.subText}` : ''}
                    </span>
                  )}
                  {lbl.dialogue && (
                    <span
                      className={`max-w-[200px] text-[11.5px] font-bold leading-snug text-center ${dialogueColor} [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_6px_rgba(0,0,0,0.75)]`}
                    >
                      {lbl.dialogue}
                    </span>
                  )}
                  {lbl.selected && lbl.text && (
                    <span className="mt-0.5 text-[11px] font-bold whitespace-nowrap text-[#FDE68A] [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_6px_rgba(0,0,0,0.85)]">
                      {lbl.text}
                    </span>
                  )}
                  {lbl.selected && lbl.nextFacility && (
                    <span className="mt-0.5 px-2 py-0.5 rounded bg-sky-950/90 border border-sky-300/70 text-[10.5px] font-bold whitespace-nowrap text-sky-100 shadow-sm">
                      🏅 想去：{lbl.nextFacility}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={lbl.id}
                className="absolute text-[10px] font-medium bg-white/95 text-[#1A2B20] border border-[#D5CFC2] rounded px-1.5 py-0.5 whitespace-nowrap shadow-xs"
                style={{
                  transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
                }}
              >
                {lbl.text}
              </div>
            );
          })}
        </div>
      )}

      {/* Standard Bottom Camera & Controls Helper Bar */}
      {!photoMode && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-20">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <div className="hidden md:flex px-3 py-1.5 rounded-xl bg-[#1A2B20]/85 text-white text-[11px] items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="whitespace-nowrap">
                左鍵點擊地塊/動物/遊客互動 · 拖曳旋轉 · 右鍵平移 · 滾輪拉近欣賞細節 · Shift+拖曳連續鋪路
              </span>
              {hoveredTileInfo && (
                <span className="font-mono-num text-emerald-200">
                  ({hoveredTileInfo.x + 1},{hoveredTileInfo.y + 1})
                </span>
              )}
            </div>

            {activeTool.startsWith('floor_') && (
              <button
                type="button"
                onClick={() => setTouchPaintMode((v) => !v)}
                className={`lg:hidden min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shadow-xs ${
                  touchPaintMode
                    ? 'bg-[#059669] text-white'
                    : 'bg-[#1A2B20]/85 text-white'
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>{touchPaintMode ? '連續滑動鋪路：開' : '滑動連續鋪路'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto ml-auto">
            <button
              type="button"
              onClick={() => handleSetCameraPreset('iso')}
              className={`min-h-[38px] lg:min-h-0 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                cameraPreset === 'iso'
                  ? 'bg-[#059669] text-white'
                  : 'bg-[#1A2B20]/85 text-white hover:bg-[#1A2B20]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>立體斜角</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetCameraPreset('top')}
              className={`min-h-[38px] lg:min-h-0 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                cameraPreset === 'top'
                  ? 'bg-[#059669] text-white'
                  : 'bg-[#1A2B20]/85 text-white hover:bg-[#1A2B20]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>高空俯視</span>
            </button>
            <button
              type="button"
              onClick={onEnterPhotoMode}
              className="min-h-[38px] lg:min-h-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
              title="切換至第一人稱視角自由遊覽並拍攝高畫質照片"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>攝影模式</span>
            </button>
          </div>
        </div>
      )}

      {/* First-Person Photo Mode Viewfinder Overlay */}
      {photoMode && (
        <>
          {/* Subtle Camera Frame Corners */}
          <div className="absolute inset-4 sm:inset-6 pointer-events-none z-20">
            <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white/65" />
            <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white/65" />
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white/65" />
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white/65" />
          </div>

          {/* Top-Left Minimal Mode Badge & Top-Right Exit Button */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none z-20">
            <div className="px-3 py-1.5 rounded-lg bg-black/55 text-white text-xs flex items-center gap-2 pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="font-semibold">第一人稱攝影模式</span>
              <span className="text-white/75 hidden sm:inline">
                · WASD/方向鍵移動 · 拖曳旋轉視角 · Q/E 調整高度 · 滾輪變焦
              </span>
            </div>

            <button
              type="button"
              onClick={onExitPhotoMode}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-black/65 hover:bg-black/85 text-white text-xs font-semibold flex items-center gap-1.5 pointer-events-auto cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>退出攝影</span>
            </button>
          </div>

          {/* Mobile Touch D-Pad for First-Person Movement */}
          <div className="md:hidden absolute bottom-20 left-4 grid grid-cols-3 gap-1.5 z-20 touch-none select-none">
            <div />
            <button
              type="button"
              aria-label="向前移動"
              onPointerDown={() => setFpKeyRef.current?.('KeyW', true)}
              onPointerUp={() => setFpKeyRef.current?.('KeyW', false)}
              onPointerLeave={() => setFpKeyRef.current?.('KeyW', false)}
              onPointerCancel={() => setFpKeyRef.current?.('KeyW', false)}
              className="w-11 h-11 rounded-xl bg-black/60 active:bg-emerald-600/80 text-white flex items-center justify-center border border-white/20"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div />
            <button
              type="button"
              aria-label="向左移動"
              onPointerDown={() => setFpKeyRef.current?.('KeyA', true)}
              onPointerUp={() => setFpKeyRef.current?.('KeyA', false)}
              onPointerLeave={() => setFpKeyRef.current?.('KeyA', false)}
              onPointerCancel={() => setFpKeyRef.current?.('KeyA', false)}
              className="w-11 h-11 rounded-xl bg-black/60 active:bg-emerald-600/80 text-white flex items-center justify-center border border-white/20"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="向後移動"
              onPointerDown={() => setFpKeyRef.current?.('KeyS', true)}
              onPointerUp={() => setFpKeyRef.current?.('KeyS', false)}
              onPointerLeave={() => setFpKeyRef.current?.('KeyS', false)}
              onPointerCancel={() => setFpKeyRef.current?.('KeyS', false)}
              className="w-11 h-11 rounded-xl bg-black/60 active:bg-emerald-600/80 text-white flex items-center justify-center border border-white/20"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="向右移動"
              onPointerDown={() => setFpKeyRef.current?.('KeyD', true)}
              onPointerUp={() => setFpKeyRef.current?.('KeyD', false)}
              onPointerLeave={() => setFpKeyRef.current?.('KeyD', false)}
              onPointerCancel={() => setFpKeyRef.current?.('KeyD', false)}
              className="w-11 h-11 rounded-xl bg-black/60 active:bg-emerald-600/80 text-white flex items-center justify-center border border-white/20"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom-Center Shutter & Lens Bar */}
          <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-black/65 text-white z-20">
            <button
              type="button"
              onClick={() => adjustFovRef.current?.(5)}
              title="廣角拉遠"
              aria-label="廣角拉遠"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono-num text-xs font-semibold min-w-[44px] text-center">
              {focalLengthMm}mm
            </span>
            <button
              type="button"
              onClick={() => adjustFovRef.current?.(-5)}
              title="望遠拉近"
              aria-label="望遠拉近"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-white/25 mx-1" />

            <button
              type="button"
              onClick={() => captureFnRef.current?.()}
              className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl bg-white text-[#1A2B20] hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="拍攝高畫質 PNG 照片 (Enter)"
            >
              <Camera className="w-4 h-4 text-emerald-700" />
              <span>拍攝照片</span>
            </button>
          </div>

          {/* Captured Photo Preview Card */}
          {capturedPhoto && (
            <div className="absolute bottom-5 left-5 w-52 rounded-xl overflow-hidden bg-black/80 border border-white/25 text-white shadow-lg z-20">
              <img
                src={capturedPhoto.url}
                alt="園區攝影照片預覽"
                className="w-full h-28 object-cover"
              />
              <div className="p-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono-num text-white/80">
                  {capturedPhoto.width}×{capturedPhoto.height}
                </span>
                <div className="flex items-center gap-1.5">
                  <a
                    href={capturedPhoto.url}
                    download={capturedPhoto.filename}
                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>下載</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setCapturedPhoto(null)}
                    aria-label="關閉照片預覽"
                    className="p-1 rounded hover:bg-white/15 text-white/75 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Shutter Flash Feedback */}
          {shutterFlash && (
            <div className="absolute inset-0 bg-white/80 pointer-events-none z-30" />
          )}
        </>
      )}

      {/* WebGL Context Lost Fallback */}
      {webglLost && (
        <div className="absolute inset-0 bg-[#1A2B20]/90 text-white flex flex-col items-center justify-center p-6 z-30">
          <p className="text-base font-bold">3D 畫面暫時中斷</p>
          <p className="text-xs text-stone-300 mt-1">正在重新恢復 WebGL 渲染環境...</p>
        </div>
      )}
    </div>
  );
});
