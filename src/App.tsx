import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardList,
  Compass,
  Hammer,
  Sparkles,
  Timer,
  Utensils,
  X,
} from 'lucide-react';
import { BuildToolbar } from './components/BuildToolbar';
import { EndGameModal } from './components/EndGameModal';
import { InspectorPanel } from './components/InspectorPanel';
import {
  OfflineRewardModal,
  OfflineRewardSummary,
} from './components/OfflineRewardModal';
import { ParkCanvas3D } from './components/ParkCanvas3D';
import {
  PomodoroMode,
  PomodoroPanel,
  formatPomodoroTime,
} from './components/PomodoroPanel';
import { SaveLoadModal } from './components/SaveLoadModal';
import { TitleScreen } from './components/TitleScreen';
import { TopHud } from './components/TopHud';
import {
  ANIMAL_SPECIES,
  CLEANER_NAMES,
  FACILITY_COSTS,
  FLOOR_TYPES,
  GATE_POS,
  GRID_COLS,
  GRID_ROWS,
  KEEPER_NAMES,
  MILESTONES,
  SEASONAL_EVENTS,
  VISITOR_ARCHETYPE_IDS,
  VISITOR_THOUGHTS,
  WEATHERS,
} from './data/zooCatalog';
import {
  AnimalInstance,
  AnimalWeatherBehavior,
  BuildTool,
  CultivatedSpeciesRecord,
  DifficultyMode,
  FloatingPopup,
  FloorType,
  GameState,
  HabitatData,
  KeeperInstance,
  ParkLogEntry,
  ParkStats,
  ParkTile,
  PendingPhotoCapture,
  PhotoAlbumEntry,
  SeasonalEventId,
  SpeciesId,
  StaffRole,
  VisitorArchetype,
  VisitorInstance,
  WeatherType,
} from './types/zoo';
import {
  collectInitialCultivatedSpecies,
  computeParkMetrics,
  createAnimalInstance,
  createInitialGrid,
  createVisitorInstance,
  findNearestPathTileAdjacentTo,
  getAnimalGrowthInfo,
  getHabitatCapacity,
  getWalkableNeighbors,
  nextId,
  pickNextWeather,
  pickRandomSeasonalEvent,
  recomputeConnectivity,
} from './utils/parkLogic';
import { AmbientAudioMode, BGM_TRACKS, BgmTrackId, soundFX } from './utils/sound';
import {
  SAVE_SLOT_DEFAULT_NAMES,
  SaveSlotId,
  ZooSaveSlotSummary,
  deleteSaveSlot,
  formatSaveTimestamp,
  getLatestSaveSummary,
  listSaveSlots,
  loadZooFromSlot,
  saveZooToSlot,
} from './utils/saveSystem';

const TICKS_PER_DAY = 36;
const POMODORO_STORAGE_KEY = 'forest_ark_pomodoro_v1';
const OFFLINE_CLAIMED_STORAGE_KEY = 'forest_ark_offline_claimed_v1';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_OFFLINE_REWARD_DAYS = 30;

const WEATHER_VISUAL_FEEDBACK: Record<
  WeatherType,
  {
    pageBgDay: string;
    pageBgNight: string;
    ambientGlowClass: string;
    stageFrameClass: string;
    badgeClass: string;
    effectLabel: string;
    transitionPopup: string;
  }
> = {
  sunny: {
    pageBgDay: 'bg-[#F4F2EC]',
    pageBgNight: 'bg-[#EAE9E4]',
    ambientGlowClass: 'from-amber-200/20 via-transparent to-transparent',
    stageFrameClass: '',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    effectLabel: '晴朗暖陽 · 自然光影',
    transitionPopup: '晴朗好天氣',
  },
  breezy: {
    pageBgDay: 'bg-[#EBF4F0]',
    pageBgNight: 'bg-[#E2ECEA]',
    ambientGlowClass: 'from-teal-200/22 via-transparent to-cyan-100/12',
    stageFrameClass: 'ring-1 ring-teal-500/20 shadow-[0_8px_24px_rgba(13,148,136,0.08)]',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    effectLabel: '涼爽微風 · 草浪搖曳氣流',
    transitionPopup: '涼爽微風吹拂',
  },
  rainy: {
    pageBgDay: 'bg-[#E5EDF2]',
    pageBgNight: 'bg-[#DCE5EC]',
    ambientGlowClass: 'from-sky-300/24 via-slate-200/12 to-sky-200/16',
    stageFrameClass: 'ring-1 ring-sky-500/25 shadow-[0_10px_28px_rgba(30,64,100,0.12)]',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    effectLabel: '梅雨季 · 路面水窪倒影與漣漪',
    transitionPopup: '梅雨季 · 路面水窪倒影',
  },
  heatwave: {
    pageBgDay: 'bg-[#F8EFE2]',
    pageBgNight: 'bg-[#EFE3D3]',
    ambientGlowClass: 'from-amber-300/26 via-orange-200/12 to-amber-200/18',
    stageFrameClass: 'ring-1 ring-amber-500/30 shadow-[0_10px_30px_rgba(217,119,6,0.14)]',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    effectLabel: '高溫熱浪 · 空氣扭曲 (heat-mirage)',
    transitionPopup: '高溫熱浪 · 空氣扭曲特效',
  },
};

function countElapsedDays(prevTs: number, nowTs: number): number {
  if (!Number.isFinite(prevTs) || prevTs <= 0 || nowTs <= prevTs) return 0;
  const prevDate = new Date(prevTs);
  const nowDate = new Date(nowTs);
  const prevMidnight = new Date(
    prevDate.getFullYear(),
    prevDate.getMonth(),
    prevDate.getDate()
  ).getTime();
  const nowMidnight = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  const calendarDays = Math.round((nowMidnight - prevMidnight) / MS_PER_DAY);
  const exactDays = Math.floor((nowTs - prevTs) / MS_PER_DAY);
  return Math.max(calendarDays, exactDays);
}

function computeOfflineReward(
  parkGrid: ParkTile[][],
  ticketPriceVal: number,
  parkStats: ParkStats,
  lastSavedAt: number,
  nowTs: number
): OfflineRewardSummary | null {
  const elapsedDays = countElapsedDays(lastSavedAt, nowTs);
  if (elapsedDays < 1) return null;

  let animalCount = 0;
  const speciesSet = new Set<SpeciesId>();
  for (let y = 0; y < parkGrid.length; y++) {
    for (let x = 0; x < parkGrid[y].length; x++) {
      const hab = parkGrid[y][x].habitat;
      if (!hab || hab.animals.length === 0) continue;
      animalCount += hab.animals.length;
      speciesSet.add(hab.speciesId);
    }
  }

  const recordedDailyRevenue = Math.max(
    parkStats.dailyRevenue || 0,
    parkStats.lastDayRevenue || 0
  );
  if (animalCount <= 0 && recordedDailyRevenue <= 0) return null;

  const effectiveDays = Math.min(MAX_OFFLINE_REWARD_DAYS, elapsedDays);
  const dailyRevenue =
    recordedDailyRevenue > 0
      ? Math.round(recordedDailyRevenue)
      : Math.round(Math.max(1, animalCount) * ticketPriceVal * 1.5);
  const revenuePartPerDay = Math.round(dailyRevenue * 0.45);
  const animalPartPerDay = animalCount * 22;
  const perDayReward = Math.max(40, revenuePartPerDay + animalPartPerDay);
  const totalReward = perDayReward * effectiveDays;

  return {
    elapsedDays,
    effectiveDays,
    dailyRevenue,
    animalCount,
    speciesCount: speciesSet.size,
    revenuePartPerDay,
    animalPartPerDay,
    totalReward,
    lastClosedLabel: formatSaveTimestamp(lastSavedAt),
  };
}

function getOfflineClaimKey(slotId: SaveSlotId, savedAt: number): string {
  return `${slotId}:${savedAt}`;
}

function hasClaimedOfflineReward(slotId: SaveSlotId, savedAt: number): boolean {
  try {
    const raw = window.localStorage.getItem(OFFLINE_CLAIMED_STORAGE_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) && list.includes(getOfflineClaimKey(slotId, savedAt));
  } catch {
    return false;
  }
}

function markClaimedOfflineReward(slotId: SaveSlotId, savedAt: number): void {
  try {
    const key = getOfflineClaimKey(slotId, savedAt);
    const raw = window.localStorage.getItem(OFFLINE_CLAIMED_STORAGE_KEY);
    const prev = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(prev)
      ? prev.filter((item): item is string => typeof item === 'string')
      : [];
    if (!list.includes(key)) {
      const next = [key, ...list].slice(0, 24);
      window.localStorage.setItem(OFFLINE_CLAIMED_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage quota errors
  }
}

interface StoredPomodoroPrefs {
  dateStr: string;
  completedPomodoros: number;
  todayFocusMinutes: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  taskLabel: string;
  autoStudyMusic: boolean;
}

function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadPomodoroPrefs(): StoredPomodoroPrefs {
  const today = getTodayDateKey();
  const fallback: StoredPomodoroPrefs = {
    dateStr: today,
    completedPomodoros: 0,
    todayFocusMinutes: 0,
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    taskLabel: '',
    autoStudyMusic: true,
  };
  try {
    const raw = window.localStorage.getItem(POMODORO_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredPomodoroPrefs>;
    const sameDay = parsed.dateStr === today;
    return {
      dateStr: today,
      completedPomodoros:
        sameDay && typeof parsed.completedPomodoros === 'number' ? parsed.completedPomodoros : 0,
      todayFocusMinutes:
        sameDay && typeof parsed.todayFocusMinutes === 'number' ? parsed.todayFocusMinutes : 0,
      focusMinutes: typeof parsed.focusMinutes === 'number' ? parsed.focusMinutes : 25,
      shortBreakMinutes:
        typeof parsed.shortBreakMinutes === 'number' ? parsed.shortBreakMinutes : 5,
      longBreakMinutes: typeof parsed.longBreakMinutes === 'number' ? parsed.longBreakMinutes : 15,
      taskLabel: typeof parsed.taskLabel === 'string' ? parsed.taskLabel : '',
      autoStudyMusic: typeof parsed.autoStudyMusic === 'boolean' ? parsed.autoStudyMusic : true,
    };
  } catch {
    return fallback;
  }
}

function createEmptyVisitorTypeCounts(): Record<VisitorArchetype, number> {
  return {
    explorer: 0,
    photographer: 0,
    child: 0,
    elder: 0,
    tourist: 0,
    student: 0,
    couple: 0,
    artist: 0,
    researcher: 0,
    runner: 0,
    foodie: 0,
    vip: 0,
  };
}

function pickRandomLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

function findAdjacentTileOfType(
  grid: ParkTile[][],
  hx: number,
  hy: number,
  targetType: ParkTile['type']
): { x: number; y: number } | null {
  const dirs: Array<[number, number]> = [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  for (const [dx, dy] of dirs) {
    const nx = hx + dx;
    const ny = hy + dy;
    if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS && grid[ny][nx].type === targetType) {
      return { x: nx, y: ny };
    }
  }
  return null;
}

function getHabitatPoolLocalSpot(speciesId: SpeciesId): { x: number; y: number } {
  switch (speciesId) {
    case 'penguin':
      return { x: 0.68, y: 0.32 };
    case 'seal':
      return { x: 0.41, y: 0.35 };
    case 'polar_bear':
      return { x: 0.72, y: 0.3 };
    case 'hippo':
      return { x: 0.45, y: 0.38 };
    case 'capybara':
      return { x: 0.28, y: 0.28 };
    case 'otter':
      return { x: 0.39, y: 0.34 };
    case 'flamingo':
      return { x: 0.53, y: 0.38 };
    case 'tiger':
      return { x: 0.7, y: 0.28 };
    case 'elephant':
      return { x: 0.28, y: 0.28 };
    case 'zebra':
      return { x: 0.24, y: 0.24 };
    default:
      return { x: 0.5, y: 0.38 };
  }
}

function getHabitatShadeLocalSpot(speciesId: SpeciesId): { x: number; y: number } {
  switch (speciesId) {
    case 'toucan':
    case 'elephant':
    case 'giraffe':
      return { x: 0.76, y: 0.24 };
    case 'panda':
    case 'red_panda':
      return { x: 0.72, y: 0.26 };
    case 'koala':
    case 'peacock':
      return { x: 0.26, y: 0.26 };
    default:
      return { x: 0.32, y: 0.26 };
  }
}

function isAnimalWeatherBehaviorStillValid(
  behavior: AnimalWeatherBehavior | null | undefined,
  label: string | undefined,
  weather: WeatherType,
  hab: HabitatData,
  adjPavilion: { x: number; y: number } | null,
  adjFountain: { x: number; y: number } | null
): boolean {
  if (!behavior) return false;
  if (behavior === 'cool_sprinkler') {
    return Boolean(hab.autoCleaner && hab.autoCleanerEnabled) && (weather === 'sunny' || weather === 'heatwave');
  }
  if (behavior === 'shelter_pavilion') {
    if (label === '涼亭避雨中') return weather === 'rainy' && Boolean(adjPavilion);
    if (label === '涼亭遮陽中') return weather === 'heatwave' && Boolean(adjPavilion);
    if (label === '樹蔭避雨中') return weather === 'rainy';
    return weather === 'rainy' || weather === 'heatwave';
  }
  if (behavior === 'rain_splash') return weather === 'rainy';
  if (behavior === 'cool_pool') {
    if (label === '噴泉降溫中') return (weather === 'sunny' || weather === 'heatwave') && Boolean(adjFountain);
    return weather === 'sunny' || weather === 'heatwave';
  }
  if (behavior === 'sun_bask') return weather === 'sunny' || weather === 'breezy';
  return false;
}

function pickAnimalWeatherReaction(
  ani: AnimalInstance,
  hab: HabitatData,
  tileX: number,
  tileY: number,
  weather: WeatherType,
  adjPavilion: { x: number; y: number } | null,
  adjFountain: { x: number; y: number } | null
): {
  behavior: AnimalWeatherBehavior | null;
  label?: string;
  targetX?: number;
  targetY?: number;
  comfortBonus: number;
} {
  const clamp01 = (v: number) => Math.max(0.18, Math.min(0.82, v));
  const jitter = () => (Math.random() - 0.5) * 0.1;

  if (weather === 'rainy') {
    const isAquaticTropical =
      ani.speciesId === 'hippo' ||
      ani.speciesId === 'otter' ||
      ani.speciesId === 'flamingo' ||
      ani.speciesId === 'capybara';

    if (hab.biome !== 'arctic') {
      if (adjPavilion) {
        const pavilionChance = hab.biome === 'rainforest' || hab.biome === 'bamboo' ? 0.65 : 0.45;
        if (Math.random() < pavilionChance) {
          const dx = Math.sign(adjPavilion.x - tileX);
          const dy = Math.sign(adjPavilion.y - tileY);
          return {
            behavior: 'shelter_pavilion',
            label: '涼亭避雨中',
            targetX: clamp01(0.5 + dx * 0.3 + jitter()),
            targetY: clamp01(0.5 + dy * 0.3 + jitter()),
            comfortBonus: 5,
          };
        }
      }

      if (isAquaticTropical && Math.random() < 0.55) {
        const pool = getHabitatPoolLocalSpot(ani.speciesId);
        return {
          behavior: 'rain_splash',
          label: '雨中戲水中',
          targetX: clamp01(pool.x + jitter()),
          targetY: clamp01(pool.y + jitter()),
          comfortBonus: 3,
        };
      }

      if (Math.random() < 0.48) {
        const shade = getHabitatShadeLocalSpot(ani.speciesId);
        return {
          behavior: 'shelter_pavilion',
          label: '樹蔭避雨中',
          targetX: clamp01(shade.x + jitter()),
          targetY: clamp01(shade.y + jitter()),
          comfortBonus: 3,
        };
      }
    }
    return { behavior: null, comfortBonus: 0 };
  }

  if (weather === 'sunny' || weather === 'heatwave') {
    if (hab.biome === 'arctic') {
      if (hab.autoCleaner && hab.autoCleanerEnabled) {
        const sprinklerChance = weather === 'heatwave' ? 0.85 : 0.65;
        if (Math.random() < sprinklerChance) {
          return {
            behavior: 'cool_sprinkler',
            label: '灑水降溫中',
            targetX: clamp01(0.76 + (Math.random() - 0.5) * 0.08),
            targetY: clamp01(0.76 + (Math.random() - 0.5) * 0.08),
            comfortBonus: 7,
          };
        }
      }

      if (adjFountain && Math.random() < 0.6) {
        const dx = Math.sign(adjFountain.x - tileX);
        const dy = Math.sign(adjFountain.y - tileY);
        return {
          behavior: 'cool_pool',
          label: '噴泉降溫中',
          targetX: clamp01(0.5 + dx * 0.3 + jitter()),
          targetY: clamp01(0.5 + dy * 0.3 + jitter()),
          comfortBonus: 4.5,
        };
      }

      const poolChance = weather === 'heatwave' ? 0.78 : 0.55;
      if (Math.random() < poolChance) {
        const pool = getHabitatPoolLocalSpot(ani.speciesId);
        return {
          behavior: 'cool_pool',
          label: '冰池降溫中',
          targetX: clamp01(pool.x + jitter()),
          targetY: clamp01(pool.y + jitter()),
          comfortBonus: 3.5,
        };
      }
      return { behavior: null, comfortBonus: 0 };
    }

    if (weather === 'heatwave') {
      if (hab.autoCleaner && hab.autoCleanerEnabled && Math.random() < 0.55) {
        return {
          behavior: 'cool_sprinkler',
          label: '灑水降溫中',
          targetX: clamp01(0.76 + (Math.random() - 0.5) * 0.08),
          targetY: clamp01(0.76 + (Math.random() - 0.5) * 0.08),
          comfortBonus: 4.5,
        };
      }
      const likesWater =
        ani.speciesId === 'hippo' ||
        ani.speciesId === 'capybara' ||
        ani.speciesId === 'otter' ||
        ani.speciesId === 'flamingo' ||
        ani.speciesId === 'elephant' ||
        ani.speciesId === 'tiger';
      if (likesWater && Math.random() < 0.6) {
        const pool = getHabitatPoolLocalSpot(ani.speciesId);
        return {
          behavior: 'cool_pool',
          label: '泡水消暑中',
          targetX: clamp01(pool.x + jitter()),
          targetY: clamp01(pool.y + jitter()),
          comfortBonus: 3.5,
        };
      }
      if (adjPavilion && Math.random() < 0.52) {
        const dx = Math.sign(adjPavilion.x - tileX);
        const dy = Math.sign(adjPavilion.y - tileY);
        return {
          behavior: 'shelter_pavilion',
          label: '涼亭遮陽中',
          targetX: clamp01(0.5 + dx * 0.3 + jitter()),
          targetY: clamp01(0.5 + dy * 0.3 + jitter()),
          comfortBonus: 3.5,
        };
      }
    } else if (weather === 'sunny') {
      const sunLover =
        hab.biome === 'savanna' || ani.speciesId === 'peacock' || ani.speciesId === 'capybara';
      if (sunLover && Math.random() < 0.45) {
        return {
          behavior: 'sun_bask',
          label: '日光浴中',
          targetX: clamp01(0.42 + (Math.random() - 0.5) * 0.24),
          targetY: clamp01(0.62 + (Math.random() - 0.5) * 0.16),
          comfortBonus: 2.5,
        };
      }
    }
    return { behavior: null, comfortBonus: 0 };
  }

  if (weather === 'breezy' && Math.random() < 0.38) {
    return {
      behavior: 'sun_bask',
      label: '微風漫步中',
      targetX: clamp01(0.5 + (Math.random() - 0.5) * 0.28),
      targetY: clamp01(0.56 + (Math.random() - 0.5) * 0.24),
      comfortBonus: 2,
    };
  }

  return { behavior: null, comfortBonus: 0 };
}

function getWeatherBehaviorComfortBonus(
  behavior: AnimalWeatherBehavior | null | undefined,
  label: string | undefined,
  biome: HabitatData['biome']
): number {
  if (!behavior) return 0;
  if (behavior === 'cool_sprinkler') return biome === 'arctic' ? 7 : 4.5;
  if (behavior === 'shelter_pavilion') return label === '涼亭避雨中' ? 5 : 3;
  if (behavior === 'cool_pool') return label === '噴泉降溫中' ? 4.5 : 3.5;
  if (behavior === 'rain_splash') return 3;
  if (behavior === 'sun_bask') return 2.5;
  return 0;
}

function findOpenGrassPathTile(
  grid: ParkTile[][],
  visitors: VisitorInstance[]
): { x: number; y: number } | null {
  const occupiedKeys = new Set<string>();
  for (const vis of visitors) {
    if ((vis.stargazePauseTicks ?? 0) > 0) {
      occupiedKeys.add(`${Math.round(vis.x)},${Math.round(vis.y)}`);
    }
    if (vis.stargazeTarget) {
      occupiedKeys.add(`${vis.stargazeTarget.x},${vis.stargazeTarget.y}`);
    }
  }

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const candidates: Array<{ x: number; y: number; grassAdj: number; grassDiag: number; occupied: boolean }> = [];

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const tile = grid[y][x];
      if (tile.type !== 'path' || !tile.connected) continue;

      let grassAdj = 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS && grid[ny][nx].type === 'grass') {
          grassAdj += 1;
        }
      }

      let grassDiag = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS && grid[ny][nx].type === 'grass') {
            grassDiag += 1;
          }
        }
      }

      if (grassAdj > 0) {
        candidates.push({
          x,
          y,
          grassAdj,
          grassDiag,
          occupied: occupiedKeys.has(`${x},${y}`),
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  const unoccupied = candidates.filter((c) => !c.occupied);
  const basePool = unoccupied.length > 0 ? unoccupied : candidates;
  const maxGrassAdj = Math.max(...basePool.map((c) => c.grassAdj));
  const openPool = basePool.filter((c) => c.grassAdj >= Math.min(2, maxGrassAdj));
  const finalPool = openPool.length > 0 ? openPool : basePool;
  const picked = finalPool[Math.floor(Math.random() * finalPool.length)];
  return { x: picked.x, y: picked.y };
}

function getNextStepToward(
  grid: ParkTile[][],
  startX: number,
  startY: number,
  goalX: number,
  goalY: number
): [number, number] | null {
  if (startX === goalX && startY === goalY) return null;
  const queue: Array<{ x: number; y: number; firstStep: [number, number] | null }> = [
    { x: startX, y: startY, firstStep: null },
  ];
  const visited = new Set<string>([`${startX},${startY}`]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = getWalkableNeighbors(grid, curr.x, curr.y).filter(
      ([nx, ny]) => grid[ny][nx].connected
    );
    for (const [nx, ny] of neighbors) {
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const step: [number, number] = curr.firstStep ?? [nx, ny];
      if (nx === goalX && ny === goalY) {
        return step;
      }
      queue.push({ x: nx, y: ny, firstStep: step });
    }
  }

  return null;
}

function pickVisitorMoodWeatherDialogue(
  mood: number,
  weather: WeatherType,
  energy: number,
  hunger: number,
  hasBoughtSnack: boolean,
  isNight: boolean
): string {
  // 1. Strong physical discomfort / needs react with current mood
  if (energy < 38 && Math.random() < 0.45) {
    return pickRandomLine(
      mood < 52
        ? [
            '腳好痠，該找個長椅休息了⋯⋯',
            '走得雙腿好沉重，哪裡有長椅可以坐？',
            '好累喔⋯⋯真的快走不動了！',
          ]
        : [
            '腳好痠，該找個長椅休息了',
            '走累了，找張長椅歇一會順便賞景吧',
            '逛了好久，坐下來吹個風休息一下吧',
          ]
    );
  }

  if (hunger > 65 && !hasBoughtSnack && Math.random() < 0.4) {
    return pickRandomLine(
      mood < 52
        ? ['肚子餓到沒心情逛了，快找輕食攤！', '好餓喔⋯⋯食物攤位到底在哪裡？']
        : ['肚子有點餓，去買個園區點心吧！', '好想買份輕食邊走邊逛']
    );
  }

  // 2. Mood-tier x Weather reactive speech lines
  if (mood >= 85) {
    const happyByWeather: Record<WeatherType, string[]> = {
      sunny: [
        '今天天氣真適合參觀！',
        '陽光灑在草地上太美了，心情超好！',
        '好天氣配上超萌動物，今天太幸福了！',
        '動物們在陽光下好有精神！',
      ],
      breezy: [
        '今天天氣真適合參觀！',
        '微風吹得好舒服，心情滿分！',
        '涼爽微風配森林綠意，逛一整天都不累！',
      ],
      rainy: [
        '雖然下著細雨，但森林雨景別有詩意！',
        '撐傘在雨中看動物，氣氛好安靜好療癒！',
        '雨天人潮剛好，拍照超輕鬆！',
      ],
      heatwave: [
        '天氣雖然熱，但看到這麼棒的動物還是超開心！',
        '只要有樹蔭和動物相伴，大熱天也超值得！',
      ],
    };
    const pool = isNight
      ? [...happyByWeather[weather], '夜間聚光燈好夢幻，逛起來超開心！', '吹著晚風看動物太幸福了！']
      : happyByWeather[weather];
    return pickRandomLine(pool);
  }

  if (mood >= 68) {
    const pleasantByWeather: Record<WeatherType, string[]> = {
      sunny: [
        '今天天氣真適合參觀！',
        '晴朗的天氣散步看動物好愜意！',
        '光線好好，多拍幾張動物照片吧～',
      ],
      breezy: [
        '微風吹拂草地好舒服！',
        '涼爽又好逛，再多看幾個展區吧！',
        '今天氣候宜人，逛起來特別放鬆。',
      ],
      rainy: [
        '細雨綿綿的，雨林區的動物看起來很享受～',
        '還好有帶傘，慢慢逛雨天動物園也不錯。',
      ],
      heatwave: [
        '太陽好大啊，待會去買杯冰飲消暑吧！',
        '天氣蠻熱的，幸好園區綠蔭很多。',
      ],
    };
    const pool = isNight
      ? [...pleasantByWeather[weather], '夜間打光氣氛好好喔！', '夜晚的動物園安靜又迷人。']
      : pleasantByWeather[weather];
    return pickRandomLine(pool);
  }

  if (mood >= 48) {
    const neutralByWeather: Record<WeatherType, string[]> = {
      sunny: ['天氣不錯，再往前看看還有什麼動物吧。', '走了一陣子，有點想找地方乘涼。'],
      breezy: ['微風很涼爽，不過走久了有點小累。', '慢慢散步晃晃，看看還有哪些展區。'],
      rainy: ['下雨鞋子有點濕，希望能快點放晴⋯⋯', '細雨一直下，有些動物都躲起來了呢。'],
      heatwave: ['好悶熱啊⋯⋯好想喝冰水降溫。', '熱浪讓人流好多汗，真想找樹蔭吹風。'],
    };
    const pool = isNight
      ? [...neutralByWeather[weather], '天色暗下來了，靠聚光燈看展區別有一番感覺。']
      : neutralByWeather[weather];
    return pickRandomLine(pool);
  }

  // mood < 48 (irritable / frustrated)
  const irritableByWeather: Record<WeatherType, string[]> = {
    sunny: [
      '太陽曬得好暈，腳好痠，該找個長椅休息了⋯⋯',
      '怎麼一直在繞路，心情有點煩躁起來了！',
      '好累喔，再找不到休息區真想回去了⋯⋯',
    ],
    breezy: [
      '雖然有微風，但又累又餓實在高興不起來。',
      '走了好久都還沒休息，有點不耐煩了⋯⋯',
    ],
    rainy: [
      '雨下不停好煩躁，全身濕答答的好不舒服！',
      '下雨又走得好累，好想找地方避雨！',
    ],
    heatwave: [
      '熱浪快把我烤暈了！冷飲跟長椅到底在哪？',
      '又熱又渴又累，再不休息真的受不了！',
    ],
  };
  const pool = isNight
    ? [...irritableByWeather[weather], '夜深了又好累，逛完這區就準備回家吧⋯⋯']
    : irritableByWeather[weather];
  return pickRandomLine(pool);
}

function findNearestInhabitedHabitatForPhoto(
  grid: ParkTile[][],
  vx: number,
  vy: number
): { x: number; y: number; habitat: HabitatData; animal: AnimalInstance } | null {
  const candidates: Array<{ dist: number; x: number; y: number; habitat: HabitatData }> = [];

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const tile = grid[y][x];
      if (tile.type !== 'habitat' || !tile.habitat || tile.habitat.animals.length === 0) {
        continue;
      }
      const manhattan = Math.abs(x - vx) + Math.abs(y - vy);
      if (manhattan <= 2) {
        candidates.push({ dist: manhattan, x, y, habitat: tile.habitat });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  const minDist = candidates[0].dist;
  const closest = candidates.filter((c) => c.dist === minDist);
  const picked = closest[Math.floor(Math.random() * closest.length)];
  const activeAnimals = picked.habitat.animals.filter((a) => !a.isResting);
  const pool = activeAnimals.length > 0 ? activeAnimals : picked.habitat.animals;
  const animal = pool[Math.floor(Math.random() * pool.length)];
  return { x: picked.x, y: picked.y, habitat: picked.habitat, animal };
}

function buildVisitorPhotoCommentary(params: {
  visitor: VisitorInstance;
  partner?: VisitorInstance;
  speciesName: string;
  animal: AnimalInstance;
  cleanliness: number;
  weather: WeatherType;
  isNight: boolean;
  seasonalEvent: SeasonalEventId | null;
}): string {
  const { visitor, partner, speciesName, animal, cleanliness, weather, isNight, seasonalEvent } =
    params;

  if (cleanliness < 38) {
    return pickRandomLine([
      `${animal.name}（${speciesName}）本身很上相，不過展區地面稍微有點凌亂，清理後拍起來一定更棒。`,
      `拍到可愛的${animal.name}了，希望飼養員待會能順便整理一下圍欄周圍！`,
    ]);
  }
  if (animal.hunger < 38) {
    return pickRandomLine([
      `跟${animal.name}合影時發現牠看起來有點餓了，好希望快點有人來投餵這隻${speciesName}！`,
      `雖然順利和${animal.name}拍了合照，但牠眼神一直望向飼料槽呢。`,
    ]);
  }

  if (animal.weatherBehavior === 'shelter_pavilion') {
    return `雨天裡看見${animal.name}（${speciesName}）自己跑到涼亭下躲雨，這畫面太有靈性了，立刻按快門留念！`;
  }
  if (animal.weatherBehavior === 'cool_sprinkler' || animal.weatherBehavior === 'cool_pool') {
    return `大晴天看到${animal.name}（${speciesName}）在水霧旁邊消暑降溫，沁涼又可愛的模樣超值得紀念！`;
  }
  if (animal.weatherBehavior === 'rain_splash') {
    return `細雨中的${animal.name}看起來精神特別好，我們在雨中留下了超有氛圍的一張合照！`;
  }

  if (seasonalEvent) {
    const seasonLines: Record<SeasonalEventId, string[]> = {
      spring_sakura: [
        `粉嫩櫻花飄落時跟${animal.name}（${speciesName}）拍下這張合照，畫面夢幻得像明信片一樣！`,
        `春櫻配可愛的${speciesName}實在太浪漫了，${animal.name}還剛好轉過頭來看鏡頭！`,
      ],
      summer_lantern: [
        `夏夜祭典燈籠映照著${animal.name}的身影，這張「合影留念」光影超迷人！`,
        `祭典氣氛太熱鬧了，跟${speciesName}「${animal.name}」合照一張留下美好夏日記憶！`,
      ],
      autumn_maple: [
        `金紅楓葉灑落在草地上，和${animal.name}（${speciesName}）的合影充滿濃濃秋意！`,
        `楓紅季節來逛動物園太幸福了，${animal.name}乖乖入鏡讓這張照片滿分！`,
      ],
      winter_snow: [
        `白雪飄落的瞬間與${animal.name}（${speciesName}）合影，冬日限定的童話畫面收藏起來！`,
        `銀白雪景裡的${animal.name}毛茸茸又顯眼，這張冬雪合照值得珍藏一輩子！`,
      ],
    };
    return pickRandomLine(seasonLines[seasonalEvent]);
  }

  if (isNight) {
    return pickRandomLine([
      `夜色下的柔和聚光燈打在${animal.name}（${speciesName}）身上，夜間動物園的合照好有故事感！`,
      `晚上和${animal.name}靜靜合影留念，微涼的夜風配上星光氣氛滿分。`,
    ]);
  }

  if (partner) {
    return pickRandomLine([
      `跟${partner.name}一起站在展區前比 YA，後面的${animal.name}（${speciesName}）剛好也湊過來入鏡！`,
      `今天和${partner.name}逛到這區最驚喜，${animal.name}精神奕奕的樣子拍起來超有活力！`,
      `兩個人一起和${speciesName}「${animal.name}」合影留念，這趟園區散步太充實了！`,
    ]);
  }

  const archetypeLines: Partial<Record<VisitorArchetype, string[]>> = {
    photographer: [
      `抓到絕佳角度！${animal.name}（${speciesName}）的眼神與光影剛剛好，直接榮登今日最佳作品！`,
      `快門按下的瞬間${animal.name}正好抬頭，背景的棲地植栽層次也超好看！`,
    ],
    child: [
      `哇！我跟${animal.name}合照到了！回去要拿給全部同學看這隻超酷的${speciesName}！`,
      `好喜歡${animal.name}喔，牠站在那裡跟我一起看鏡頭耶，好開心！`,
    ],
    couple: [
      `這張和${animal.name}（${speciesName}）的合照角度太甜了，下次約會還要再來看牠！`,
    ],
    artist: [
      `${animal.name}的姿態與毛色在光線下真美，先把這張合照收進圖鑑當寫生靈感！`,
    ],
    researcher: [
      `觀察到${speciesName}「${animal.name}」狀態非常健康有活力，這張生態紀錄合照很有參考價值。`,
    ],
  };

  const specific = archetypeLines[visitor.archetype];
  if (specific && Math.random() < 0.7) {
    return pickRandomLine(specific);
  }

  const weatherSuffix =
    weather === 'sunny'
      ? '陽光正好，顏色拍出來好明亮！'
      : weather === 'breezy'
      ? '微風徐徐吹來，站在欄杆旁拍照特別舒服！'
      : weather === 'rainy'
      ? '雖然下著細雨，能跟可愛動物合照還是很值得！'
      : '雖然天氣暖熱，看到牠充滿朝氣的樣子心情瞬間好了起來！';

  return `終於和${speciesName}「${animal.name}」合影留念了！${weatherSuffix}`;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<DifficultyMode>('standard');
  const [grid, setGrid] = useState<ParkTile[][]>(() => createInitialGrid('standard'));
  const [funds, setFunds] = useState<number>(1200);
  const [ticketPrice, setTicketPrice] = useState<number>(18);
  const [day, setDay] = useState<number>(1);
  const [tickInDay, setTickInDay] = useState<number>(0);
  const [weather, setWeather] = useState<WeatherType>('sunny');
  const [nextWeather, setNextWeather] = useState<WeatherType>('breezy');
  const [weatherDaysLeft, setWeatherDaysLeft] = useState<number>(3);
  const [seasonalEvent, setSeasonalEvent] = useState<SeasonalEventId | null>(null);
  const [seasonalDaysLeft, setSeasonalDaysLeft] = useState<number>(0);
  const lastSeasonalRef = useRef<SeasonalEventId | null>(null);
  const idleSeasonalDaysRef = useRef<number>(0);
  const weatherPopupKeyRef = useRef<Record<string, string>>({});
  const [speed, setSpeed] = useState<0 | 1 | 2>(1);
  const [muted, setMuted] = useState<boolean>(false);
  const [bgmMuted, setBgmMuted] = useState<boolean>(false);
  const [bgmTrack, setBgmTrack] = useState<BgmTrackId>('piano_stroll');
  const [rainMode, setRainMode] = useState<AmbientAudioMode>('auto');
  const [windMode, setWindMode] = useState<AmbientAudioMode>('auto');
  const [thunderMode, setThunderMode] = useState<AmbientAudioMode>('auto');
  const [photoMode, setPhotoMode] = useState<boolean>(false);

  const [activeTool, setActiveTool] = useState<BuildTool>('select');
  const [selectedPos, setSelectedPos] = useState<{ x: number; y: number } | null>({ x: 3, y: 4 });
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);

  const [visitors, setVisitors] = useState<VisitorInstance[]>([]);
  const [visitorTypeCounts, setVisitorTypeCounts] = useState<Record<VisitorArchetype, number>>(
    () => createEmptyVisitorTypeCounts()
  );
  const [cultivatedSpecies, setCultivatedSpecies] = useState<
    Partial<Record<SpeciesId, CultivatedSpeciesRecord>>
  >(() => collectInitialCultivatedSpecies(grid));
  const [landmarkUnlocked, setLandmarkUnlocked] = useState<boolean>(false);
  const [keepers, setKeepers] = useState<KeeperInstance[]>([]);
  const [popups, setPopups] = useState<FloatingPopup[]>([]);
  const [completedMilestones, setCompletedMilestones] = useState<string[]>([]);
  const [victoryDismissed, setVictoryDismissed] = useState<boolean>(false);
  const [negativeFundDays, setNegativeFundDays] = useState<number>(0);

  const [stats, setStats] = useState<ParkStats>({
    totalVisitors: 0,
    peakFunds: 1200,
    daysSurvived: 1,
    dailyRevenue: 0,
    dailyExpenses: 0,
  });

  const [logs, setLogs] = useState<ParkLogEntry[]>([]);
  const [photoAlbum, setPhotoAlbum] = useState<PhotoAlbumEntry[]>([]);
  const [pendingPhotoCaptures, setPendingPhotoCaptures] = useState<PendingPhotoCapture[]>([]);
  const photoAlbumCooldownRef = useRef<number>(0);
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [saveSlots, setSaveSlots] = useState<ZooSaveSlotSummary[]>(() => listSaveSlots());
  const [offlineReward, setOfflineReward] = useState<OfflineRewardSummary | null>(null);
  const lastHiddenAtRef = useRef<number | null>(null);

  const [mobileTab, setMobileTab] = useState<'park' | 'build' | 'manage' | 'pomodoro'>('park');

  const initialPomoPrefs = useMemo(() => loadPomodoroPrefs(), []);
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>('focus');
  const [pomodoroRunning, setPomodoroRunning] = useState<boolean>(false);
  const [pomodoroFocusMins, setPomodoroFocusMins] = useState<number>(initialPomoPrefs.focusMinutes);
  const [pomodoroShortMins, setPomodoroShortMins] = useState<number>(
    initialPomoPrefs.shortBreakMinutes
  );
  const [pomodoroLongMins, setPomodoroLongMins] = useState<number>(
    initialPomoPrefs.longBreakMinutes
  );
  const [pomodoroSecondsLeft, setPomodoroSecondsLeft] = useState<number>(
    initialPomoPrefs.focusMinutes * 60
  );
  const [completedPomodoros, setCompletedPomodoros] = useState<number>(
    initialPomoPrefs.completedPomodoros
  );
  const [todayFocusMinutes, setTodayFocusMinutes] = useState<number>(
    initialPomoPrefs.todayFocusMinutes
  );
  const [pomodoroTaskLabel, setPomodoroTaskLabel] = useState<string>(initialPomoPrefs.taskLabel);
  const [pomodoroAutoStudyMusic, setPomodoroAutoStudyMusic] = useState<boolean>(
    initialPomoPrefs.autoStudyMusic
  );
  const [pomodoroModalOpen, setPomodoroModalOpen] = useState<boolean>(false);
  const [pomodoroBanner, setPomodoroBanner] = useState<{
    title: string;
    subtitle: string;
    nextMode: PomodoroMode;
  } | null>(null);
  const pomodoroEndAtRef = useRef<number | null>(null);

  const refreshSaveSlots = useCallback(() => {
    setSaveSlots(listSaveSlots());
  }, []);

  const addPopup = useCallback(
    (x: number, y: number, text: string, tone: FloatingPopup['tone']) => {
      const id = nextId('pop');
      setPopups((prev) => [...prev.slice(-14), { id, x, y, text, tone }]);
      window.setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== id));
      }, 1500);
    },
    []
  );

  const addLog = useCallback(
    (currentDay: number, message: string, tone: ParkLogEntry['tone'] = 'info') => {
      setLogs((prev) => [{ id: nextId('log'), day: currentDay, message, tone }, ...prev].slice(0, 20));
    },
    []
  );

  const startNewGame = useCallback((mode: DifficultyMode) => {
    const startingFunds = mode === 'sandbox' ? 2800 : mode === 'challenge' ? 750 : 1200;
    const initialGrid = createInitialGrid(mode);
    setDifficulty(mode);
    setGrid(initialGrid);
    setFunds(startingFunds);
    setTicketPrice(18);
    setDay(1);
    setTickInDay(0);
    const initNextWeather = pickNextWeather('sunny');
    setWeather('sunny');
    setNextWeather(initNextWeather);
    setWeatherDaysLeft(2 + Math.floor(Math.random() * 2));
    setSeasonalEvent(null);
    setSeasonalDaysLeft(0);
    lastSeasonalRef.current = null;
    idleSeasonalDaysRef.current = 0;
    weatherPopupKeyRef.current = {};
    setSpeed(1);
    setPhotoMode(false);
    setActiveTool('select');
    setSelectedPos({ x: 3, y: 4 });
    setSelectedVisitorId(null);
    setVisitors([]);
    setVisitorTypeCounts(createEmptyVisitorTypeCounts());
    setCultivatedSpecies(collectInitialCultivatedSpecies(initialGrid));
    setLandmarkUnlocked(false);
    setKeepers([]);
    setPopups([]);
    setCompletedMilestones([]);
    setVictoryDismissed(false);
    setNegativeFundDays(0);
    setStats({
      totalVisitors: 0,
      peakFunds: startingFunds,
      daysSurvived: 1,
      dailyRevenue: 0,
      lastDayRevenue: 0,
      dailyExpenses: 0,
    });
    setOfflineReward(null);
    setLogs([
      {
        id: nextId('log'),
        day: 1,
        message: '森之方舟 3D 動物園開園！每種動物皆擁有專屬生態園區。',
        tone: 'success',
      },
    ]);
    setPhotoAlbum([]);
    setPendingPhotoCaptures([]);
    photoAlbumCooldownRef.current = 0;
    setGameState('PLAYING');
    soundFX.startBgm();
    soundFX.playBuild();
  }, []);

  const avgVisitorMood = useMemo(() => {
    if (visitors.length === 0) return 84;
    return visitors.reduce((acc, v) => acc + v.mood, 0) / visitors.length;
  }, [visitors]);

  const metrics = useMemo(
    () => computeParkMetrics(grid, ticketPrice, weather, avgVisitorMood),
    [grid, ticketPrice, weather, avgVisitorMood]
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (photoMode) {
          setPhotoMode(false);
        } else {
          setActiveTool('select');
        }
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        setSpeed((prev) => (prev === 0 ? 1 : 0));
        return;
      }
      if (photoMode) return;
      const toolMap: Record<string, BuildTool> = {
        '1': 'select',
        '2': 'floor_stone',
        '3': 'snack',
        '4': 'bench',
        '5': 'garden',
        '6': 'souvenir',
        '7': 'fountain',
        '8': 'restroom',
        '9': 'pavilion',
        ...(landmarkUnlocked ? { l: 'landmark' as BuildTool, L: 'landmark' as BuildTool } : {}),
        '0': 'demolish',
      };
      if (toolMap[e.key]) {
        setActiveTool(toolMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, photoMode, landmarkUnlocked]);

  const simRef = useRef({
    difficulty,
    grid,
    funds,
    ticketPrice,
    day,
    tickInDay,
    weather,
    nextWeather,
    weatherDaysLeft,
    seasonalEvent,
    seasonalDaysLeft,
    selectedVisitorId,
    visitors,
    visitorTypeCounts,
    cultivatedSpecies,
    landmarkUnlocked,
    keepers,
    completedMilestones,
    victoryDismissed,
    negativeFundDays,
    stats,
    metrics,
    logs,
    photoAlbum,
    bgmTrack,
  });
  simRef.current = {
    difficulty,
    grid,
    funds,
    ticketPrice,
    day,
    tickInDay,
    weather,
    nextWeather,
    weatherDaysLeft,
    seasonalEvent,
    seasonalDaysLeft,
    selectedVisitorId,
    visitors,
    visitorTypeCounts,
    cultivatedSpecies,
    landmarkUnlocked,
    keepers,
    completedMilestones,
    victoryDismissed,
    negativeFundDays,
    stats,
    metrics,
    logs,
    photoAlbum,
    bgmTrack,
  };

  // Core simulation tick
  useEffect(() => {
    if (gameState !== 'PLAYING' || speed === 0) return;

    const intervalMs = speed === 2 ? 260 : 520;
    const timer = window.setInterval(() => {
      const s = simRef.current;
      const weatherSpec = WEATHERS[s.weather];
      const activeSeasonalSpec = s.seasonalEvent ? SEASONAL_EVENTS[s.seasonalEvent] : null;
      const nextTickRaw = s.tickInDay + 1;
      const nextIsNight = nextTickRaw >= 18 && nextTickRaw < TICKS_PER_DAY;
      const prevIsNight = s.tickInDay >= 18;
      let nextFunds = s.funds;
      let addedVisitors = 0;
      let dailyRevDelta = 0;

      // 1. Update grid (animal wandering + weather-triggered habitat behaviors + hunger/cleanliness decay)
      const nextGrid = s.grid.map((row) =>
        row.map((tile) => {
          if (tile.type !== 'habitat' || !tile.habitat) return tile;
          const hab = tile.habitat;
          const animalCount = hab.animals.length;
          const adjPavilion = findAdjacentTileOfType(s.grid, tile.x, tile.y, 'pavilion');
          const adjFountain = findAdjacentTileOfType(s.grid, tile.x, tile.y, 'fountain');

          const biomeCleanFactor =
            s.weather === 'rainy' && hab.biome === 'rainforest' ? 0.8 : 1.0;
          let nextClean = Math.max(
            0,
            hab.cleanliness -
              animalCount * 0.22 * weatherSpec.cleanDecayMultiplier * biomeCleanFactor
          );
          const nextEnrich = Math.max(0, hab.enrichmentBoost - 0.15);

          // Automated Cleaning System triggers when cleanliness drops below 75%
          if (hab.autoCleaner && hab.autoCleanerEnabled && nextClean < 75) {
            nextClean = Math.min(100, nextClean + 45);
            addPopup(tile.x, tile.y, '自動清潔完成', 'green');
          }

          let weatherComfort = 0;
          if (s.weather === 'heatwave' && hab.biome === 'arctic') weatherComfort = -12;
          else if (s.weather === 'rainy' && hab.biome === 'rainforest') weatherComfort = 10;
          else if (s.weather === 'breezy') weatherComfort = 6;
          else if (s.weather === 'rainy') weatherComfort = -5;

          const biomeHungerFactor =
            s.weather === 'heatwave' && hab.biome === 'arctic'
              ? 1.25
              : s.weather === 'heatwave' && hab.biome === 'savanna'
              ? 0.85
              : 1.0;

          const restHungerFactor = nextIsNight ? 0.55 : 1.0;
          const restComfort = nextIsNight && nextClean >= 50 ? 4 : 0;

          let autoFedTriggered = false;
          const decayedAnimals = hab.animals.map((ani) => {
            const nextHunger = Math.max(
              0,
              ani.hunger -
                0.34 * weatherSpec.hungerDecayMultiplier * biomeHungerFactor * restHungerFactor
            );
            return { ani, nextHunger };
          });

          const shouldAutoFeed = Boolean(
            hab.autoFeeder &&
              hab.autoFeederEnabled &&
              decayedAnimals.some((item) => item.nextHunger < 75)
          );

          const nextAnimals = decayedAnimals.map(({ ani, nextHunger }) => {
            let finalHunger = nextHunger;
            let extraHappy = 0;
            if (shouldAutoFeed) {
              finalHunger = Math.min(100, nextHunger + 36);
              extraHappy = 4;
              autoFedTriggered = true;
            }

            let weatherBehavior: AnimalWeatherBehavior | null = null;
            let weatherBehaviorLabel: string | undefined;
            let weatherTargetX: number | undefined;
            let weatherTargetY: number | undefined;
            let weatherReactionComfort = 0;

            if (!nextIsNight) {
              const keepCurrent =
                isAnimalWeatherBehaviorStillValid(
                  ani.weatherBehavior,
                  ani.weatherBehaviorLabel,
                  s.weather,
                  hab,
                  adjPavilion,
                  adjFountain
                ) && Math.random() < 0.88;

              if (keepCurrent && ani.weatherBehavior) {
                weatherBehavior = ani.weatherBehavior;
                weatherBehaviorLabel = ani.weatherBehaviorLabel;
                weatherTargetX = ani.weatherTargetX;
                weatherTargetY = ani.weatherTargetY;
                weatherReactionComfort = getWeatherBehaviorComfortBonus(
                  weatherBehavior,
                  weatherBehaviorLabel,
                  hab.biome
                );
              } else {
                const picked = pickAnimalWeatherReaction(
                  ani,
                  hab,
                  tile.x,
                  tile.y,
                  s.weather,
                  adjPavilion,
                  adjFountain
                );
                weatherBehavior = picked.behavior;
                weatherBehaviorLabel = picked.label;
                weatherTargetX = picked.targetX;
                weatherTargetY = picked.targetY;
                weatherReactionComfort = picked.comfortBonus;

                if (
                  weatherBehavior &&
                  weatherBehaviorLabel &&
                  (weatherBehaviorLabel === '涼亭避雨中' ||
                    weatherBehaviorLabel === '灑水降溫中' ||
                    weatherBehaviorLabel === '涼亭遮陽中')
                ) {
                  const habKey = `${tile.x}_${tile.y}`;
                  const sig = `${s.day}_${s.weather}_${weatherBehaviorLabel}`;
                  if (weatherPopupKeyRef.current[habKey] !== sig) {
                    weatherPopupKeyRef.current[habKey] = sig;
                    const shortPop =
                      weatherBehaviorLabel === '涼亭避雨中'
                        ? '涼亭避雨'
                        : weatherBehaviorLabel === '灑水降溫中'
                        ? '灑水降溫'
                        : '涼亭遮陽';
                    addPopup(tile.x, tile.y, shortPop, 'amber');
                  }
                }
              }
            }

            const targetHappy = Math.max(
              0,
              Math.min(
                100,
                (finalHunger + nextClean) / 2 +
                  nextEnrich +
                  weatherComfort +
                  weatherReactionComfort +
                  restComfort
              )
            );
            const nextHappy = Math.max(
              0,
              Math.min(100, ani.happiness + (targetHappy - ani.happiness) * 0.08 + extraHappy)
            );

            const welfareNow = (finalHunger + nextHappy + nextClean) / 3;
            const growthGain = nextIsNight
              ? welfareNow >= 70
                ? 0.45
                : 0.15
              : welfareNow >= 80
              ? 2.4
              : welfareNow >= 55
              ? 1.2
              : 0.35;
            const prevPoints = ani.growthPoints ?? 0;
            const nextPoints = Math.min(600, prevPoints + growthGain);
            const prevStageInfo = getAnimalGrowthInfo(prevPoints);
            const nextStageInfo = getAnimalGrowthInfo(nextPoints);
            if (nextStageInfo.tier > prevStageInfo.tier) {
              const spec = ANIMAL_SPECIES[ani.speciesId];
              addPopup(tile.x, tile.y, `進階 ${nextStageInfo.shortLabel}！`, 'gold');
              addLog(
                s.day,
                `${spec.name}「${ani.name}」在細心照護下成長至「${nextStageInfo.label}」！`,
                'success'
              );
              soundFX.playMilestone();
            }

            let lx = ani.localX;
            let ly = ani.localY;
            let tx = ani.targetX;
            let ty = ani.targetY;
            let facingLeft = ani.facingLeft;

            if (!nextIsNight) {
              if (weatherTargetX !== undefined && weatherTargetY !== undefined) {
                tx = weatherTargetX;
                ty = weatherTargetY;
              } else if (Math.random() < 0.25) {
                tx = 0.2 + Math.random() * 0.6;
                ty = 0.26 + Math.random() * 0.48;
              }
              const dx = tx - lx;
              const dy = ty - ly;
              if (Math.abs(dx) > 0.01) {
                facingLeft = dx < 0;
              }
              lx += dx * 0.35;
              ly += dy * 0.35;
            }

            return {
              ...ani,
              hunger: finalHunger,
              happiness: nextHappy,
              localX: lx,
              localY: ly,
              targetX: tx,
              targetY: ty,
              facingLeft,
              isResting: nextIsNight,
              growthPoints: nextPoints,
              growthStage: nextStageInfo.stage,
              weatherBehavior,
              weatherBehaviorLabel,
              weatherTargetX,
              weatherTargetY,
            };
          });

          if (autoFedTriggered) {
            addPopup(tile.x, tile.y, '自動投餵飽足', 'green');
          }

          return {
            ...tile,
            habitat: {
              ...hab,
              cleanliness: nextClean,
              enrichmentBoost: nextEnrich,
              animals: nextAnimals,
            },
          };
        })
      );

      // 2. Staff AI (Animal Caregivers & Park Cleaners)
      const nextKeepers = s.keepers.map((keeper) => {
        if (keeper.cooldownTicks > 0) {
          return { ...keeper, cooldownTicks: keeper.cooldownTicks - 1 };
        }

        const adjDirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        const kx = Math.round(keeper.x);
        const ky = Math.round(keeper.y);

        for (const [dx, dy] of adjDirs) {
          const hx = kx + dx;
          const hy = ky + dy;
          if (hx >= 0 && hx < GRID_COLS && hy >= 0 && hy < GRID_ROWS) {
            const t = nextGrid[hy][hx];
            if (t.type === 'habitat' && t.habitat && t.habitat.animals.length > 0) {
              if (keeper.role === 'keeper') {
                const autoFeederActive = Boolean(t.habitat.autoFeeder && t.habitat.autoFeederEnabled);
                const needsFeed =
                  !autoFeederActive && t.habitat.animals.some((a) => a.hunger < 72);
                const needsEnrich = t.habitat.animals.some((a) => a.happiness < 70);

                if (needsFeed && nextFunds >= 15) {
                  nextFunds -= 15;
                  nextGrid[hy][hx] = {
                    ...t,
                    habitat: {
                      ...t.habitat,
                      animals: t.habitat.animals.map((a) => ({
                        ...a,
                        hunger: Math.min(100, a.hunger + 45),
                        happiness: Math.min(100, a.happiness + 8),
                      })),
                    },
                  };
                  addPopup(hx, hy, '照護員餵食', 'green');
                  return { ...keeper, taskLabel: '餵食動物中', cooldownTicks: 5 };
                }
                if (needsEnrich && nextFunds >= 10) {
                  nextFunds -= 10;
                  nextGrid[hy][hx] = {
                    ...t,
                    habitat: {
                      ...t.habitat,
                      enrichmentBoost: Math.min(30, t.habitat.enrichmentBoost + 18),
                      animals: t.habitat.animals.map((a) => ({
                        ...a,
                        happiness: Math.min(100, a.happiness + 22),
                      })),
                    },
                  };
                  addPopup(hx, hy, '照護員互動', 'green');
                  return { ...keeper, taskLabel: '安撫動物中', cooldownTicks: 5 };
                }
              } else {
                // cleaner role cleans dirty enclosures (prioritizing non-automated habitats)
                const autoCleanerActive = Boolean(
                  t.habitat.autoCleaner && t.habitat.autoCleanerEnabled
                );
                const needsClean = !autoCleanerActive && t.habitat.cleanliness < 74;
                if (needsClean && nextFunds >= 10) {
                  nextFunds -= 10;
                  nextGrid[hy][hx] = {
                    ...t,
                    habitat: {
                      ...t.habitat,
                      cleanliness: Math.min(100, t.habitat.cleanliness + 50),
                    },
                  };
                  addPopup(hx, hy, '清潔員打掃', 'green');
                  return { ...keeper, taskLabel: '清理展區中', cooldownTicks: 5 };
                }
              }
            }
          }
        }

        // Cleaner also periodically sweeps public walkways
        if (keeper.role === 'cleaner' && Math.random() < 0.08) {
          addPopup(kx, ky, '清掃步道', 'green');
          return { ...keeper, taskLabel: '清掃步道中', cooldownTicks: 3 };
        }

        const neighbors = getWalkableNeighbors(nextGrid, kx, ky);
        if (neighbors.length === 0) return keeper;

        let chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
        let bestDist = Infinity;
        let urgentPath: [number, number] | null = null;
        for (let y = 0; y < GRID_ROWS; y++) {
          for (let x = 0; x < GRID_COLS; x++) {
            const t = nextGrid[y][x];
            if (t.type === 'habitat' && t.connected && t.habitat && t.habitat.animals.length > 0) {
              const autoFeederActive = Boolean(t.habitat.autoFeeder && t.habitat.autoFeederEnabled);
              const autoCleanerActive = Boolean(
                t.habitat.autoCleaner && t.habitat.autoCleanerEnabled
              );
              const urgent =
                keeper.role === 'cleaner'
                  ? !autoCleanerActive && t.habitat.cleanliness < 72
                  : (!autoFeederActive && t.habitat.animals.some((a) => a.hunger < 70)) ||
                    t.habitat.animals.some((a) => a.happiness < 65);
              if (urgent) {
                const adjPath = findNearestPathTileAdjacentTo(nextGrid, x, y);
                if (adjPath) {
                  const d = Math.abs(adjPath[0] - kx) + Math.abs(adjPath[1] - ky);
                  if (d < bestDist) {
                    bestDist = d;
                    urgentPath = adjPath;
                  }
                }
              }
            }
          }
        }

        if (urgentPath) {
          let bestN = chosen;
          let minNDist = Infinity;
          for (const [nx, ny] of neighbors) {
            const d = Math.abs(nx - urgentPath[0]) + Math.abs(ny - urgentPath[1]);
            if (d < minNDist) {
              minNDist = d;
              bestN = [nx, ny];
            }
          }
          chosen = bestN;
        }

        return {
          ...keeper,
          x: chosen[0],
          y: chosen[1],
          taskLabel: keeper.role === 'cleaner' ? '巡邏清潔中' : '巡邏照護中',
        };
      });

      // 3. Visitors AI with distinct voices, weather, Day/Night, stargazing & meetup/exhibit photo-op reactions
      photoAlbumCooldownRef.current = Math.max(0, photoAlbumCooldownRef.current - 1);
      const newlyTriggeredPhotoIds = new Set<string>();
      const photoPairedIds = new Set<string>();
      const capturedEntriesThisTick: PhotoAlbumEntry[] = [];
      const capturedRequestsThisTick: PendingPhotoCapture[] = [];

      const recordPhotoOpEntry = (
        primaryVisitor: VisitorInstance,
        partnerVisitor: VisitorInstance | undefined,
        tileX: number,
        tileY: number
      ) => {
        if (capturedEntriesThisTick.length > 0 || photoAlbumCooldownRef.current > 0) return;
        const target = findNearestInhabitedHabitatForPhoto(nextGrid, tileX, tileY);
        if (!target) return;

        const speciesSpec = ANIMAL_SPECIES[target.habitat.speciesId];
        const photoId = nextId('photo');
        const commentary = buildVisitorPhotoCommentary({
          visitor: primaryVisitor,
          partner: partnerVisitor,
          speciesName: speciesSpec.name,
          animal: target.animal,
          cleanliness: target.habitat.cleanliness,
          weather: s.weather,
          isNight: nextIsNight,
          seasonalEvent: s.seasonalEvent,
        });

        capturedEntriesThisTick.push({
          id: photoId,
          day: s.day,
          isNight: nextIsNight,
          weather: s.weather,
          seasonalEvent: s.seasonalEvent,
          speciesId: target.habitat.speciesId,
          speciesName: speciesSpec.name,
          animalId: target.animal.id,
          animalName: target.animal.name,
          visitorId: primaryVisitor.id,
          visitorName: primaryVisitor.name,
          visitorArchetype: primaryVisitor.archetype,
          visitorArchetypeLabel: primaryVisitor.archetypeLabel,
          partnerVisitorName: partnerVisitor?.name,
          visitorMood: Math.min(100, primaryVisitor.mood + 10),
          commentary,
          thumbnailDataUrl: '',
          tileX,
          tileY,
          habitatX: target.x,
          habitatY: target.y,
          capturedAt: Date.now(),
        });

        capturedRequestsThisTick.push({
          id: photoId,
          visitorId: primaryVisitor.id,
          partnerVisitorId: partnerVisitor?.id,
          animalId: target.animal.id,
          speciesId: target.habitat.speciesId,
          tileX,
          tileY,
          habitatX: target.x,
          habitatY: target.y,
        });

        photoAlbumCooldownRef.current = 10;
      };

      for (let i = 0; i < s.visitors.length; i++) {
        const va = s.visitors[i];
        if (
          photoPairedIds.has(va.id) ||
          (va.photoPauseTicks ?? 0) > 0 ||
          (va.photoCooldownTicks ?? 0) > 0 ||
          (va.stargazePauseTicks ?? 0) > 0 ||
          Boolean(va.stargazeTarget) ||
          va.stayTicks <= 3
        ) {
          continue;
        }
        const ax = Math.round(va.x);
        const ay = Math.round(va.y);
        if (nextGrid[ay]?.[ax]?.type !== 'path') continue;

        for (let j = i + 1; j < s.visitors.length; j++) {
          const vb = s.visitors[j];
          if (
            photoPairedIds.has(vb.id) ||
            (vb.photoPauseTicks ?? 0) > 0 ||
            (vb.photoCooldownTicks ?? 0) > 0 ||
            (vb.stargazePauseTicks ?? 0) > 0 ||
            Boolean(vb.stargazeTarget) ||
            vb.stayTicks <= 3
          ) {
            continue;
          }
          const bx = Math.round(vb.x);
          const by = Math.round(vb.y);
          if (ax === bx && ay === by) {
            photoPairedIds.add(va.id);
            photoPairedIds.add(vb.id);
            const hasNearbyHabitat = Boolean(findNearestInhabitedHabitatForPhoto(nextGrid, ax, ay));
            const photoChance = hasNearbyHabitat
              ? va.archetype === 'couple' || vb.archetype === 'couple'
                ? 0.34
                : 0.22
              : va.archetype === 'couple' || vb.archetype === 'couple'
              ? 0.22
              : 0.1;
            if (Math.random() < photoChance) {
              newlyTriggeredPhotoIds.add(va.id);
              newlyTriggeredPhotoIds.add(vb.id);
              addPopup(ax, ay, '♥ 合影留念', 'rose');
              soundFX.playShutter();
              recordPhotoOpEntry(va, vb, ax, ay);
            }
            break;
          }
        }
      }

      // Solo visitor commemorative photo-op directly beside an inhabited habitat
      if (capturedEntriesThisTick.length === 0 && photoAlbumCooldownRef.current === 0) {
        for (const vis of s.visitors) {
          if (
            newlyTriggeredPhotoIds.has(vis.id) ||
            (vis.photoPauseTicks ?? 0) > 0 ||
            (vis.photoCooldownTicks ?? 0) > 0 ||
            (vis.stargazePauseTicks ?? 0) > 0 ||
            Boolean(vis.stargazeTarget) ||
            vis.stayTicks <= 4
          ) {
            continue;
          }
          const vx = Math.round(vis.x);
          const vy = Math.round(vis.y);
          if (nextGrid[vy]?.[vx]?.type !== 'path') continue;

          const adjHabitat = findNearestInhabitedHabitatForPhoto(nextGrid, vx, vy);
          if (!adjHabitat || Math.abs(adjHabitat.x - vx) + Math.abs(adjHabitat.y - vy) > 1) {
            continue;
          }

          const soloChance =
            vis.archetype === 'photographer' ||
            vis.archetype === 'tourist' ||
            vis.archetype === 'couple' ||
            vis.archetype === 'child'
              ? 0.08
              : 0.035;
          if (Math.random() < soloChance) {
            newlyTriggeredPhotoIds.add(vis.id);
            addPopup(vx, vy, '♥ 合影留念', 'rose');
            soundFX.playShutter();
            recordPhotoOpEntry(vis, undefined, vx, vy);
            break;
          }
        }
      }

      const canNightStargaze = nextIsNight && !activeSeasonalSpec;

      const nextVisitors: VisitorInstance[] = s.visitors
        .map((v) => {
          const vx = Math.round(v.x);
          const vy = Math.round(v.y);
          const nextStay = v.stayTicks - 1;
          const startedPhotoNow = newlyTriggeredPhotoIds.has(v.id);
          const prevPause = v.photoPauseTicks ?? 0;
          const nextPauseTicks = startedPhotoNow ? 4 : Math.max(0, prevPause - 1);
          const isPosingPhoto = startedPhotoNow || prevPause > 0;
          const nextCooldownTicks = startedPhotoNow
            ? 12
            : Math.max(0, (v.photoCooldownTicks ?? 0) - 1);

          let stargazeTarget = canNightStargaze && !isPosingPhoto ? v.stargazeTarget ?? null : null;
          let stargazeSeekTicks =
            canNightStargaze && !isPosingPhoto ? v.stargazeSeekTicks ?? 0 : 0;
          let stargazePauseTicks =
            canNightStargaze && !isPosingPhoto
              ? Math.max(0, (v.stargazePauseTicks ?? 0) - 1)
              : 0;
          let stargazeCooldownTicks = Math.max(0, (v.stargazeCooldownTicks ?? 0) - 1);

          const isSelectedVisitor = v.id === s.selectedVisitorId;
          let thought = isPosingPhoto ? '一起合影留念！' : '';
          let hasNewSpeech = isPosingPhoto;
          let mood = Math.max(
            15,
            Math.min(
              100,
              v.mood +
                weatherSpec.visitorMoodDelta +
                (activeSeasonalSpec ? activeSeasonalSpec.visitorMoodDelta : 0) +
                (startedPhotoNow ? 10 : 0)
            )
          );

          // Night Stargazing AI: 15% chance at night without active seasonal festival
          if (
            canNightStargaze &&
            !isPosingPhoto &&
            stargazePauseTicks === 0 &&
            !stargazeTarget &&
            stargazeCooldownTicks === 0 &&
            nextStay > 6 &&
            Math.random() < 0.15
          ) {
            const spot = findOpenGrassPathTile(nextGrid, s.visitors);
            if (spot) {
              if (spot.x === vx && spot.y === vy) {
                stargazePauseTicks = 6;
                stargazeCooldownTicks = 20;
                thought = pickRandomLine([
                  '今晚夜空好清澈，駐足仰望星空真療癒 ✨',
                  '吹著晚風在草地步道仰望星空，心情超棒 ✨',
                  '滿天星斗閃閃發光，來這裡夜遊太值得了 ✨',
                ]);
                hasNewSpeech = true;
              } else {
                stargazeTarget = spot;
                stargazeSeekTicks = 14;
              }
            }
          } else if (stargazeTarget && stargazePauseTicks === 0) {
            if (vx === stargazeTarget.x && vy === stargazeTarget.y) {
              stargazeTarget = null;
              stargazeSeekTicks = 0;
              stargazePauseTicks = 6;
              stargazeCooldownTicks = 20;
              thought = pickRandomLine([
                '這片草地步道視野真開闊，好適合仰望星空 ✨',
                '抬頭看著滿天繁星，整個人都放鬆下來了 ✨',
                '好浪漫的夜空，靜靜看星星真幸福 ✨',
              ]);
              hasNewSpeech = true;
            } else if (stargazeSeekTicks <= 1) {
              stargazeTarget = null;
              stargazeSeekTicks = 0;
              stargazeCooldownTicks = 6;
            } else {
              stargazeSeekTicks -= 1;
            }
          }

          const isStargazingNow = stargazePauseTicks > 0;
          if (isStargazingNow) {
            mood = Math.min(100, mood + 1.6);
          }

          const nightEnergyMult = nextIsNight ? 1.2 : 1.0;
          let energy = Math.max(
            10,
            v.energy - (s.weather === 'heatwave' ? 1.6 : 1.2) * nightEnergyMult
          );
          let hunger = Math.min(100, v.hunger + (s.weather === 'heatwave' ? 1.45 : 1.1));
          let hasBoughtSnack = v.hasBoughtSnack;
          let hasBoughtSouvenir = Boolean(v.hasBoughtSouvenir);

          const adjDirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ];
          if (!isStargazingNow) {
            for (const [dx, dy] of adjDirs) {
            const ax = vx + dx;
            const ay = vy + dy;
            if (ax < 0 || ax >= GRID_COLS || ay < 0 || ay >= GRID_ROWS) continue;
            const adj = nextGrid[ay][ax];

            if (adj.type === 'habitat' && adj.habitat && adj.habitat.animals.length > 0) {
              const zoneSpec = ANIMAL_SPECIES[adj.habitat.speciesId];
              if (adj.habitat.cleanliness < 35) {
                thought = VISITOR_THOUGHTS.dirty[0];
                hasNewSpeech = true;
                mood = Math.max(20, mood - 2);
                if (isSelectedVisitor && Math.random() < 0.08) {
                  soundFX.playVisitorVoice(v.archetype, 'complaint');
                }
              } else if (adj.habitat.animals.some((a) => a.hunger < 35)) {
                thought = VISITOR_THOUGHTS.hungryAnimal[0];
                hasNewSpeech = true;
                mood = Math.max(25, mood - 1.5);
                if (isSelectedVisitor && Math.random() < 0.08) {
                  soundFX.playVisitorVoice(v.archetype, 'complaint');
                }
              } else if (nextIsNight && Math.random() < 0.35) {
                thought =
                  Math.random() < 0.45
                    ? `${zoneSpec.name}睡得好安穩`
                    : VISITOR_THOUGHTS.nightQuiet[
                        Math.floor(Math.random() * VISITOR_THOUGHTS.nightQuiet.length)
                      ];
                hasNewSpeech = true;
                mood = Math.min(100, mood + 1.5);
                if (Math.random() < 0.09) {
                  nextFunds += 6;
                  dailyRevDelta += 6;
                  addPopup(ax, ay, '+$6 夜間賞燈', 'gold');
                }
              } else if (!nextIsNight && Math.random() < 0.25) {
                thought =
                  Math.random() < 0.4
                    ? `${zoneSpec.name}好可愛！`
                    : VISITOR_THOUGHTS.happy[Math.floor(Math.random() * VISITOR_THOUGHTS.happy.length)];
                hasNewSpeech = true;
                mood = Math.min(100, mood + 2);
                if (Math.random() < 0.14) {
                  if (isSelectedVisitor) {
                    soundFX.playVisitorVoice(v.archetype, 'happy');
                  }
                  const tip = v.archetype === 'vip' ? 10 : 6;
                  nextFunds += tip;
                  dailyRevDelta += tip;
                  addPopup(ax, ay, `+$${tip} 讚賞`, 'gold');
                }
              }
            } else if (
              adj.type === 'snack' &&
              hunger > (v.archetype === 'foodie' ? 25 : 40) &&
              !hasBoughtSnack
            ) {
              const snackSpend = v.archetype === 'foodie' ? 18 : 14;
              nextFunds += snackSpend;
              dailyRevDelta += snackSpend;
              hunger = 10;
              mood = Math.min(100, mood + (s.weather === 'heatwave' ? 12 : 8));
              hasBoughtSnack = true;
              thought = s.weather === 'heatwave' ? '冰飲好消暑！' : nextIsNight ? '夜晚熱飲真暖胃' : '點心真好吃';
              hasNewSpeech = true;
              if (isSelectedVisitor) {
                soundFX.playVisitorVoice(v.archetype, 'greet');
              }
              addPopup(ax, ay, `+$${snackSpend} 輕食`, 'gold');
            } else if (
              adj.type === 'souvenir' &&
              !hasBoughtSouvenir &&
              mood >= 55 &&
              Math.random() < 0.65
            ) {
              const souvenirSpend = v.archetype === 'vip' ? 30 : 22;
              nextFunds += souvenirSpend;
              dailyRevDelta += souvenirSpend;
              mood = Math.min(100, mood + 7);
              hasBoughtSouvenir = true;
              thought = pickRandomLine(['買到好可愛的動物紀念品！', '帶個紀念品回家作紀念～']);
              hasNewSpeech = true;
              if (isSelectedVisitor) {
                soundFX.playVisitorVoice(v.archetype, 'happy');
              }
              addPopup(ax, ay, `+$${souvenirSpend} 紀念品`, 'gold');
            } else if (adj.type === 'fountain' && Math.random() < 0.45) {
              energy = Math.min(100, energy + 12);
              mood = Math.min(100, mood + (s.weather === 'heatwave' ? 7 : 4));
              thought =
                s.weather === 'heatwave'
                  ? '噴泉水霧好清涼消暑！'
                  : nextIsNight
                  ? '夜晚噴泉燈光好浪漫！'
                  : '在噴泉旁吹風賞景真舒服！';
              hasNewSpeech = true;
            } else if (adj.type === 'restroom' && Math.random() < 0.35) {
              energy = Math.min(100, energy + 8);
              mood = Math.min(100, mood + 3.5);
              thought = '洗手間好乾淨，整理一下繼續逛！';
              hasNewSpeech = true;
            } else if (
              adj.type === 'pavilion' &&
              (energy < 70 || s.weather === 'rainy' || s.weather === 'heatwave')
            ) {
              energy = Math.min(100, energy + 38);
              mood = Math.min(
                100,
                mood + (s.weather === 'rainy' || s.weather === 'heatwave' ? 9 : 5)
              );
              thought =
                s.weather === 'rainy'
                  ? '在涼亭躲雨賞景好愜意！'
                  : s.weather === 'heatwave'
                  ? '涼亭遮陽好涼爽！'
                  : '在觀景涼亭乘涼休息真舒服！';
              hasNewSpeech = true;
            } else if (adj.type === 'bench' && energy < 60) {
              energy = Math.min(100, energy + 28);
              mood = Math.min(
                100,
                mood + (nextIsNight || s.weather === 'heatwave' || s.weather === 'rainy' ? 5 : 2)
              );
              thought = nextIsNight
                ? '夜風吹拂坐著休息好愜意'
                : s.weather === 'heatwave'
                ? '樹蔭長椅真涼快'
                : '歇一會腳就不痠了，真舒服！';
              hasNewSpeech = true;
            } else if (adj.type === 'landmark') {
              mood = Math.min(100, mood + 3.5);
              if (Math.random() < 0.28) {
                thought = nextIsNight ? '金色地標在夜晚閃閃發光！' : '金色導覽地標好氣派！';
                hasNewSpeech = true;
              }
            }
          }
          }

          let nextThought = '';
          let nextThoughtTicks = 0;

          if (isSelectedVisitor) {
            nextThought = v.thought;
            nextThoughtTicks = Math.max(0, (v.thoughtTicks ?? 0) - 1);

            if (hasNewSpeech) {
              nextThought = thought;
              nextThoughtTicks = isPosingPhoto
                ? Math.max(2, nextPauseTicks)
                : isStargazingNow
                ? Math.max(3, stargazePauseTicks)
                : 5;
            } else if (isStargazingNow && (!nextThought || nextThoughtTicks <= 0)) {
              nextThought = pickRandomLine([
                '抬頭仰望星空，星光閃爍好療癒 ✨',
                '站在空曠草地步道吹晚風看星星真舒服 ✨',
                '今晚星空好美，讓人心情都亮了起來 ✨',
              ]);
              nextThoughtTicks = Math.max(3, stargazePauseTicks);
            } else if (nextThoughtTicks <= 0) {
              if (activeSeasonalSpec && Math.random() < 0.25) {
                const seasonalLines: Record<SeasonalEventId, string[]> = {
                  spring_sakura: [
                    '櫻花瓣飄落在步道上好浪漫！',
                    '春日櫻花祭的動物園區太好拍了！',
                  ],
                  summer_lantern: [
                    '夏夜螢火燈飾把園區點亮得好夢幻！',
                    '趁著螢火祭多逛幾個園區吃點心～',
                  ],
                  autumn_maple: [
                    '滿地楓紅配動物生態區好有秋意！',
                    '秋高氣爽最適合邊散步邊寫生了！',
                  ],
                  winter_snow: [
                    '步道上的白雪好可愛，很有冬季慶典氣氛！',
                    '冬季雪景節來逛動物園別有一番風味！',
                  ],
                };
                nextThought = pickRandomLine(seasonalLines[activeSeasonalSpec.id]);
                nextThoughtTicks = 5;
              } else {
                nextThought = pickVisitorMoodWeatherDialogue(
                  mood,
                  s.weather,
                  energy,
                  hunger,
                  hasBoughtSnack,
                  nextIsNight
                );
                nextThoughtTicks = 5;
              }
            } else if (!isStargazingNow && Math.random() < 0.16) {
              nextThought = pickVisitorMoodWeatherDialogue(
                mood,
                s.weather,
                energy,
                hunger,
                hasBoughtSnack,
                nextIsNight
              );
              nextThoughtTicks = 5;
            }
          }

          const neighbors = getWalkableNeighbors(nextGrid, vx, vy).filter(
            ([nx, ny]) => nextGrid[ny][nx].connected
          );
          let nextX = v.x;
          let nextY = v.y;
          let targetX = v.targetX;
          let targetY = v.targetY;

          if (!isPosingPhoto && !isStargazingNow && neighbors.length > 0) {
            let picked: [number, number] | null = null;
            if (stargazeTarget) {
              picked = getNextStepToward(
                nextGrid,
                vx,
                vy,
                stargazeTarget.x,
                stargazeTarget.y
              );
              if (!picked) {
                stargazeTarget = null;
                stargazeSeekTicks = 0;
              }
            }
            if (!picked) {
              const forwardOptions = neighbors.filter(([nx, ny]) => !(nx === targetX && ny === targetY));
              const pool = forwardOptions.length > 0 ? forwardOptions : neighbors;
              picked = pool[Math.floor(Math.random() * pool.length)];
            }
            targetX = vx;
            targetY = vy;
            nextX = picked[0];
            nextY = picked[1];
          }

          return {
            ...v,
            x: nextX,
            y: nextY,
            targetX,
            targetY,
            energy,
            mood,
            hunger,
            thought: nextThought,
            thoughtTicks: nextThoughtTicks,
            stayTicks: nextStay,
            hasBoughtSnack,
            hasBoughtSouvenir,
            photoPauseTicks: nextPauseTicks,
            photoCooldownTicks: nextCooldownTicks,
            stargazeTarget,
            stargazeSeekTicks,
            stargazePauseTicks,
            stargazeCooldownTicks,
          };
        })
        .filter((v) => v.stayTicks > 0);

      // Spawn new visitor with random archetype & achievement tracking (quiet until clicked)
      let nextVisitorTypeCounts = s.visitorTypeCounts;
      let nextLandmarkUnlocked = s.landmarkUnlocked;
      const nightSpawnMult = nextIsNight ? 0.55 : 1.0;
      const seasonalSpawnMult = activeSeasonalSpec ? activeSeasonalSpec.spawnMultiplier : 1.0;
      if (
        nextVisitors.length < s.metrics.targetVisitors &&
        s.metrics.connectedHabitats > 0 &&
        Math.random() < 0.55 * weatherSpec.visitorSpawnMultiplier * nightSpawnMult * seasonalSpawnMult
      ) {
        const entryFee = s.ticketPrice;
        nextFunds += entryFee;
        dailyRevDelta += entryFee;
        addedVisitors += 1;
        addPopup(GATE_POS.x, GATE_POS.y, `+$${entryFee} 門票`, 'gold');

        const existingNames = new Set(nextVisitors.map((v) => v.name));
        const spawned = createVisitorInstance(
          GATE_POS.x,
          GATE_POS.y,
          existingNames,
          activeSeasonalSpec?.boostedArchetypes
        );
        const newVis: VisitorInstance = {
          ...spawned,
          thought: '',
          thoughtTicks: 0,
        };
        nextVisitors.push(newVis);

        const prevCount = s.visitorTypeCounts[newVis.archetype] || 0;
        nextVisitorTypeCounts = {
          ...s.visitorTypeCounts,
          [newVis.archetype]: prevCount + 1,
        };
        if (prevCount === 0) {
          const collectedNow = VISITOR_ARCHETYPE_IDS.filter(
            (id) => (nextVisitorTypeCounts[id] || 0) > 0
          ).length;
          addLog(
            s.day,
            `首次接待「${newVis.archetypeLabel}」${newVis.name} 入園！（遊客圖鑑 ${collectedNow}/${VISITOR_ARCHETYPE_IDS.length}）`,
            'info'
          );
          if (collectedNow === VISITOR_ARCHETYPE_IDS.length && !s.landmarkUnlocked) {
            nextLandmarkUnlocked = true;
            soundFX.playMilestone();
            addPopup(GATE_POS.x, GATE_POS.y, '解鎖金色導覽地標！', 'gold');
            addLog(
              s.day,
              `遊客成就達成！已集滿全部 ${VISITOR_ARCHETYPE_IDS.length} 種遊客類型，解鎖特殊裝飾「金色導覽地標」（可至園區設施建造以提升園區魅力）！`,
              'success'
            );
          }
        }
      }

      // 4. Milestones check
      const newlyDone: string[] = [];
      for (const m of MILESTONES) {
        if (s.completedMilestones.includes(m.id)) continue;
        let current = 0;
        if (m.type === 'habitats') current = s.metrics.connectedHabitats;
        else if (m.type === 'species') current = s.metrics.uniqueSpeciesCount;
        else if (m.type === 'visitors') current = s.stats.totalVisitors + addedVisitors;
        else if (m.type === 'animals') current = s.metrics.totalAnimals;
        else if (m.type === 'rating') current = s.metrics.rating;

        if (current >= m.targetValue) {
          newlyDone.push(m.id);
          nextFunds += m.reward;
          soundFX.playMilestone();
          addLog(s.day, `達成目標「${m.title}」，獲得獎勵 $${m.reward}！`, 'success');
          if (m.id === 'm_rating_48' && !s.victoryDismissed) {
            setGameState('VICTORY');
          }
        }
      }

      // 5. Day-Night transitions & Day rollover + weather & seasonal festival transitions
      let nextTick = nextTickRaw;
      let nextDay = s.day;
      let nextNegDays = s.negativeFundDays;
      let dailyExp = 0;
      let nextCurrWeather = s.weather;
      let nextUpcomingWeather = s.nextWeather;
      let nextWeatherDays = s.weatherDaysLeft;
      let nextSeasonalEvent = s.seasonalEvent;
      let nextSeasonalDaysLeft = s.seasonalDaysLeft;

      if (!nextSeasonalEvent && s.day === 1 && nextTick === 14 && Math.random() < 0.6) {
        const picked = pickRandomSeasonalEvent(lastSeasonalRef.current);
        const spec = SEASONAL_EVENTS[picked];
        nextSeasonalEvent = picked;
        nextSeasonalDaysLeft = 2 + Math.floor(Math.random() * 2);
        lastSeasonalRef.current = picked;
        idleSeasonalDaysRef.current = 0;
        addPopup(GATE_POS.x, GATE_POS.y, `${spec.name}開跑！`, 'gold');
        addLog(
          s.day,
          `季節性活動「${spec.name}」盛大展開（為期 ${nextSeasonalDaysLeft} 天）！${spec.shortDesc}`,
          'success'
        );
        soundFX.playMilestone();
      }

      if (!prevIsNight && nextIsNight) {
        addLog(s.day, '夜幕降臨！園區開啟聚光燈照明，動物們陸續進入休息狀態。', 'info');
        soundFX.playCare();
      }

      if (nextTick >= TICKS_PER_DAY) {
        nextTick = 0;
        nextDay += 1;
        addLog(nextDay, '晨曦照耀園區，動物們甦醒並開始清晨活動！', 'info');

        nextWeatherDays -= 1;
        if (nextWeatherDays <= 0) {
          nextCurrWeather = s.nextWeather;
          nextUpcomingWeather = pickNextWeather(nextCurrWeather);
          nextWeatherDays = 2 + Math.floor(Math.random() * 3);
          const wSpec = WEATHERS[nextCurrWeather];
          const wVisual = WEATHER_VISUAL_FEEDBACK[nextCurrWeather];
          addPopup(GATE_POS.x, GATE_POS.y, wVisual.transitionPopup, nextCurrWeather === 'rainy' ? 'green' : nextCurrWeather === 'heatwave' ? 'amber' : 'gold');
          addLog(
            nextDay,
            `天氣轉變為「${wSpec.name}」（${wVisual.effectLabel}）：${wSpec.careTip}`,
            nextCurrWeather === 'breezy' || nextCurrWeather === 'sunny' ? 'success' : 'warning'
          );
          if (nextCurrWeather === 'rainy') {
            soundFX.playThunder(0.75);
          } else {
            soundFX.playCare();
          }
        }

        if (nextSeasonalEvent) {
          nextSeasonalDaysLeft -= 1;
          if (nextSeasonalDaysLeft <= 0) {
            const endedSpec = SEASONAL_EVENTS[nextSeasonalEvent];
            addLog(nextDay, `「${endedSpec.name}」圓滿落幕，園區恢復日常營運風貌。`, 'info');
            nextSeasonalEvent = null;
            nextSeasonalDaysLeft = 0;
            idleSeasonalDaysRef.current = 0;
          }
        } else {
          idleSeasonalDaysRef.current += 1;
          if (idleSeasonalDaysRef.current >= 2 || Math.random() < 0.55) {
            const picked = pickRandomSeasonalEvent(lastSeasonalRef.current);
            const spec = SEASONAL_EVENTS[picked];
            nextSeasonalEvent = picked;
            nextSeasonalDaysLeft = 2 + Math.floor(Math.random() * 2);
            lastSeasonalRef.current = picked;
            idleSeasonalDaysRef.current = 0;
            addPopup(GATE_POS.x, GATE_POS.y, `${spec.name}開跑！`, 'gold');
            addLog(
              nextDay,
              `季節性活動「${spec.name}」登場（為期 ${nextSeasonalDaysLeft} 天）！${spec.shortDesc}`,
              'success'
            );
            soundFX.playMilestone();
          }
        }

        let animalUpkeep = 0;
        for (let y = 0; y < GRID_ROWS; y++) {
          for (let x = 0; x < GRID_COLS; x++) {
            const hab = nextGrid[y][x].habitat;
            if (hab) {
              for (const ani of hab.animals) {
                animalUpkeep += ANIMAL_SPECIES[ani.speciesId].dailyUpkeep;
              }
            }
          }
        }
        const staffWages = nextKeepers.reduce(
          (sum, staff) =>
            sum +
            (staff.role === 'cleaner'
              ? FACILITY_COSTS.cleanerDailyWage
              : FACILITY_COSTS.keeperDailyWage),
          0
        );
        dailyExp = animalUpkeep + staffWages;
        nextFunds -= dailyExp;

        if (nextFunds < -400) {
          nextNegDays += 1;
          addLog(nextDay, `警告：園區資金嚴重赤字（連續 ${nextNegDays}/3 天）`, 'warning');
          if (nextNegDays >= 3) {
            setGameState('GAME_OVER');
          }
        } else {
          nextNegDays = 0;
          addLog(nextDay, `第 ${nextDay} 天開始 · 昨日維護費 $${dailyExp}`, 'info');
        }
      }

      // 6. Sync cultivated species growth & satisfaction snapshot
      const activeSpeciesAgg: Partial<
        Record<SpeciesId, { sumSat: number; count: number; maxGrowth: number }>
      > = {};
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const hab = nextGrid[y][x].habitat;
          if (!hab || hab.animals.length === 0) continue;
          for (const ani of hab.animals) {
            const sat = (ani.hunger + ani.happiness + hab.cleanliness) / 3;
            const pts = ani.growthPoints ?? 0;
            const prevAgg = activeSpeciesAgg[ani.speciesId];
            if (!prevAgg) {
              activeSpeciesAgg[ani.speciesId] = { sumSat: sat, count: 1, maxGrowth: pts };
            } else {
              prevAgg.sumSat += sat;
              prevAgg.count += 1;
              if (pts > prevAgg.maxGrowth) prevAgg.maxGrowth = pts;
            }
          }
        }
      }

      const nextCultivated: Partial<Record<SpeciesId, CultivatedSpeciesRecord>> = {
        ...s.cultivatedSpecies,
      };
      let cultivatedChanged = false;
      for (const [sidKey, agg] of Object.entries(activeSpeciesAgg)) {
        const sid = sidKey as SpeciesId;
        if (!agg) continue;
        const avgSat = Math.round(agg.sumSat / agg.count);
        const existing = nextCultivated[sid];
        if (!existing) {
          nextCultivated[sid] = {
            speciesId: sid,
            firstCultivatedDay: nextDay,
            totalRaised: agg.count,
            peakGrowthPoints: agg.maxGrowth,
            peakStage: getAnimalGrowthInfo(agg.maxGrowth).stage,
            lastSatisfaction: avgSat,
          };
          cultivatedChanged = true;
        } else {
          const peakPts = Math.max(existing.peakGrowthPoints, agg.maxGrowth);
          const peakStage = getAnimalGrowthInfo(peakPts).stage;
          if (
            peakPts !== existing.peakGrowthPoints ||
            avgSat !== existing.lastSatisfaction ||
            agg.count > existing.totalRaised
          ) {
            nextCultivated[sid] = {
              ...existing,
              totalRaised: Math.max(existing.totalRaised, agg.count),
              peakGrowthPoints: peakPts,
              peakStage,
              lastSatisfaction: avgSat,
            };
            cultivatedChanged = true;
          }
        }
      }

      const updatedPhotoAlbum =
        capturedEntriesThisTick.length > 0
          ? [...capturedEntriesThisTick, ...s.photoAlbum].slice(0, 28)
          : s.photoAlbum;

      if (capturedEntriesThisTick.length > 0) {
        setPhotoAlbum(updatedPhotoAlbum);
        setPendingPhotoCaptures((prev) => [...prev.slice(-8), ...capturedRequestsThisTick]);
        if (s.photoAlbum.length === 0) {
          const first = capturedEntriesThisTick[0];
          addLog(
            nextDay,
            `「${first.visitorName}」與 ${first.animalName}（${first.speciesName}）完成「合影留念」，已收錄至攝影圖鑑！`,
            'success'
          );
        }
      }

      setGrid(nextGrid);
      setFunds(nextFunds);
      setVisitors(nextVisitors);
      if (nextVisitorTypeCounts !== s.visitorTypeCounts) {
        setVisitorTypeCounts(nextVisitorTypeCounts);
      }
      if (cultivatedChanged) {
        setCultivatedSpecies(nextCultivated);
      }
      if (nextLandmarkUnlocked !== s.landmarkUnlocked) {
        setLandmarkUnlocked(nextLandmarkUnlocked);
      }
      setKeepers(nextKeepers);
      setDay(nextDay);
      setTickInDay(nextTick);
      setWeather(nextCurrWeather);
      setNextWeather(nextUpcomingWeather);
      setWeatherDaysLeft(nextWeatherDays);
      if (nextSeasonalEvent !== s.seasonalEvent) {
        setSeasonalEvent(nextSeasonalEvent);
      }
      if (nextSeasonalDaysLeft !== s.seasonalDaysLeft) {
        setSeasonalDaysLeft(nextSeasonalDaysLeft);
      }
      setNegativeFundDays(nextNegDays);
      if (newlyDone.length > 0) {
        setCompletedMilestones((prev) => [...prev, ...newlyDone]);
      }
      setStats((prev) => ({
        totalVisitors: prev.totalVisitors + addedVisitors,
        peakFunds: Math.max(prev.peakFunds, nextFunds),
        daysSurvived: nextDay,
        dailyRevenue: nextTick === 0 ? 0 : prev.dailyRevenue + dailyRevDelta,
        lastDayRevenue: nextTick === 0 ? prev.dailyRevenue : prev.lastDayRevenue,
        dailyExpenses: dailyExp > 0 ? dailyExp : prev.dailyExpenses,
      }));

      // Auto-save cleanly on each new day rollover
      if (nextTick === 0 && nextDay > s.day) {
        const avgMoodNow =
          nextVisitors.length === 0
            ? 84
            : nextVisitors.reduce((acc, v) => acc + v.mood, 0) / nextVisitors.length;
        const snapMetrics = computeParkMetrics(nextGrid, s.ticketPrice, nextCurrWeather, avgMoodNow);
        const autoSaved = saveZooToSlot('autosave', {
          label: `每日自動存檔 · 第 ${nextDay} 天`,
          difficulty: s.difficulty,
          grid: nextGrid,
          funds: nextFunds,
          ticketPrice: s.ticketPrice,
          day: nextDay,
          tickInDay: 0,
          weather: nextCurrWeather,
          nextWeather: nextUpcomingWeather,
          weatherDaysLeft: nextWeatherDays,
          seasonalEvent: nextSeasonalEvent,
          seasonalDaysLeft: nextSeasonalDaysLeft,
          lastSeasonalEvent: lastSeasonalRef.current,
          idleSeasonalDays: idleSeasonalDaysRef.current,
          visitors: nextVisitors,
          visitorTypeCounts: nextVisitorTypeCounts,
          cultivatedSpecies: nextCultivated,
          landmarkUnlocked: nextLandmarkUnlocked,
          keepers: nextKeepers,
          completedMilestones:
            newlyDone.length > 0 ? [...s.completedMilestones, ...newlyDone] : s.completedMilestones,
          victoryDismissed: s.victoryDismissed,
          negativeFundDays: nextNegDays,
          stats: {
            totalVisitors: s.stats.totalVisitors + addedVisitors,
            peakFunds: Math.max(s.stats.peakFunds, nextFunds),
            daysSurvived: nextDay,
            dailyRevenue: 0,
            lastDayRevenue: s.stats.dailyRevenue,
            dailyExpenses: dailyExp > 0 ? dailyExp : s.stats.dailyExpenses,
          },
          logs: s.logs.slice(0, 20),
          photoAlbum: updatedPhotoAlbum,
          bgmTrack: s.bgmTrack,
          ratingSnapshot: snapMetrics.rating,
          animalCountSnapshot: snapMetrics.totalAnimals,
          speciesCountSnapshot: snapMetrics.uniqueSpeciesCount,
        });
        if (autoSaved) {
          refreshSaveSlots();
        }
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [gameState, speed, addLog, addPopup, refreshSaveSlots]);

  // Tile Interaction Handlers
  const handleBuildAt = useCallback(
    (x: number, y: number, isDragPaint = false) => {
      const tile = grid[y][x];

      if (activeTool === 'select') {
        setSelectedVisitorId(null);
        setSelectedPos({ x, y });
        return;
      }

      if (activeTool === 'demolish') {
        if (tile.type === 'grass' || tile.type === 'gate') {
          if (!isDragPaint) soundFX.playError();
          return;
        }
        let refund = 0;
        if (tile.type === 'path') {
          const ft = tile.floorType ?? 'stone';
          refund = Math.floor(FLOOR_TYPES[ft].cost * 0.5);
        } else if (tile.type === 'snack') refund = Math.floor(FACILITY_COSTS.snack * 0.5);
        else if (tile.type === 'bench') refund = Math.floor(FACILITY_COSTS.bench * 0.5);
        else if (tile.type === 'garden') refund = Math.floor(FACILITY_COSTS.garden * 0.5);
        else if (tile.type === 'souvenir') refund = Math.floor(FACILITY_COSTS.souvenir * 0.5);
        else if (tile.type === 'fountain') refund = Math.floor(FACILITY_COSTS.fountain * 0.5);
        else if (tile.type === 'restroom') refund = Math.floor(FACILITY_COSTS.restroom * 0.5);
        else if (tile.type === 'pavilion') refund = Math.floor(FACILITY_COSTS.pavilion * 0.5);
        else if (tile.type === 'landmark') refund = Math.floor(FACILITY_COSTS.landmark * 0.5);
        else if (tile.type === 'habitat' && tile.habitat) {
          refund = Math.floor(ANIMAL_SPECIES[tile.habitat.speciesId].buildCost * 0.5);
        }

        const updated = grid.map((r, ry) =>
          r.map((t, rx) =>
            rx === x && ry === y ? { x, y, type: 'grass' as const, connected: false, gardenBoost: 0 } : t
          )
        );
        setGrid(recomputeConnectivity(updated));
        setFunds((f) => f + refund);
        if (selectedPos?.x === x && selectedPos?.y === y) setSelectedPos(null);
        addPopup(x, y, `+$${refund} 拆除`, 'amber');
        soundFX.playDemolish();
        return;
      }

      if (activeTool.startsWith('floor_')) {
        const floorType = activeTool.replace('floor_', '') as FloorType;
        const floorSpec = FLOOR_TYPES[floorType];
        if (!floorSpec) return;

        if (tile.type === 'path' && tile.floorType === floorType) {
          return;
        }
        if (tile.type !== 'grass' && tile.type !== 'path') {
          if (!isDragPaint) soundFX.playError();
          return;
        }
        if (funds < floorSpec.cost) {
          if (!isDragPaint) {
            soundFX.playError();
            addPopup(x, y, '資金不足', 'rose');
          }
          return;
        }
        const updated = grid.map((r, ry) =>
          r.map((t, rx) => (rx === x && ry === y ? { ...t, type: 'path' as const, floorType } : t))
        );
        setGrid(recomputeConnectivity(updated));
        setFunds((f) => f - floorSpec.cost);
        soundFX.playBuild();
        return;
      }

      if (tile.type !== 'grass') {
        if (tile.type === 'habitat' && !isDragPaint) {
          setSelectedPos({ x, y });
        } else if (!isDragPaint) {
          soundFX.playError();
        }
        return;
      }

      if (
        activeTool === 'snack' ||
        activeTool === 'bench' ||
        activeTool === 'garden' ||
        activeTool === 'souvenir' ||
        activeTool === 'fountain' ||
        activeTool === 'restroom' ||
        activeTool === 'pavilion' ||
        activeTool === 'landmark'
      ) {
        if (activeTool === 'landmark' && !landmarkUnlocked) {
          soundFX.playError();
          addPopup(x, y, '尚未解鎖地標', 'rose');
          return;
        }
        const cost = FACILITY_COSTS[activeTool];
        if (funds < cost) {
          soundFX.playError();
          addPopup(x, y, '資金不足', 'rose');
          return;
        }
        const updated = grid.map((r, ry) =>
          r.map((t, rx) => (rx === x && ry === y ? { ...t, type: activeTool } : t))
        );
        setGrid(recomputeConnectivity(updated));
        setFunds((f) => f - cost);
        if (activeTool === 'landmark') {
          addPopup(x, y, `金色導覽地標 +${FACILITY_COSTS.landmarkAppeal}魅力`, 'gold');
          addLog(day, `建造了「金色導覽地標」，園區魅力提升 +${FACILITY_COSTS.landmarkAppeal}！`, 'success');
          soundFX.playMilestone();
        } else {
          addPopup(x, y, `-$${cost}`, 'amber');
          soundFX.playBuild();
        }
        return;
      }

      // Dedicated per-species zone construction
      if (activeTool.startsWith('zone_')) {
        const speciesId = activeTool.replace('zone_', '') as SpeciesId;
        const spec = ANIMAL_SPECIES[speciesId];
        if (!spec) return;
        if (funds < spec.buildCost) {
          soundFX.playError();
          addPopup(x, y, '資金不足', 'rose');
          return;
        }
        const updated = grid.map((r, ry) =>
          r.map((t, rx) =>
            rx === x && ry === y
              ? {
                  ...t,
                  type: 'habitat' as const,
                  habitat: {
                    id: nextId('hab'),
                    speciesId,
                    biome: spec.biome,
                    level: 1 as const,
                    cleanliness: 95,
                    enrichmentBoost: 10,
                    animals: [],
                  },
                }
              : t
          )
        );
        setGrid(recomputeConnectivity(updated));
        setFunds((f) => f - spec.buildCost);
        setSelectedPos({ x, y });
        setActiveTool('select');
        addPopup(x, y, `建造${spec.zoneShortName}`, 'green');
        addLog(day, `新建了「${spec.zoneName}」，可點擊專區引進${spec.name}！`, 'info');
        soundFX.playBuild();
      }
    },
    [activeTool, addLog, addPopup, day, funds, grid, landmarkUnlocked, selectedPos]
  );

  const handleFeedHabitat = useCallback(
    (x: number, y: number) => {
      if (funds < FACILITY_COSTS.feed) {
        soundFX.playError();
        return;
      }
      const tile = grid[y][x];
      setGrid((prev) =>
        prev.map((row, ry) =>
          row.map((t, rx) => {
            if (rx !== x || ry !== y || !t.habitat) return t;
            return {
              ...t,
              habitat: {
                ...t.habitat,
                animals: t.habitat.animals.map((a) => {
                  const nextPts = Math.min(600, (a.growthPoints ?? 0) + 5);
                  return {
                    ...a,
                    hunger: Math.min(100, a.hunger + 48),
                    happiness: Math.min(100, a.happiness + 8),
                    growthPoints: nextPts,
                    growthStage: getAnimalGrowthInfo(nextPts).stage,
                  };
                }),
              },
            };
          })
        )
      );
      setFunds((f) => f - FACILITY_COSTS.feed);
      addPopup(x, y, '已餵食飽足', 'green');
      soundFX.playCare();
      if (tile.habitat) soundFX.playAnimalVoice(tile.habitat.speciesId);
    },
    [addPopup, funds, grid]
  );

  const handleCleanHabitat = useCallback(
    (x: number, y: number) => {
      if (funds < FACILITY_COSTS.clean) {
        soundFX.playError();
        return;
      }
      setGrid((prev) =>
        prev.map((row, ry) =>
          row.map((tile, rx) => {
            if (rx !== x || ry !== y || !tile.habitat) return tile;
            return {
              ...tile,
              habitat: {
                ...tile.habitat,
                cleanliness: 100,
              },
            };
          })
        )
      );
      setFunds((f) => f - FACILITY_COSTS.clean);
      addPopup(x, y, '清潔完成', 'green');
      soundFX.playCare();
    },
    [addPopup, funds]
  );

  const handleBuyHabitatAutomation = useCallback(
    (x: number, y: number, kind: 'feeder' | 'cleaner') => {
      const tile = grid[y][x];
      if (!tile.habitat) return;
      const alreadyOwned = kind === 'feeder' ? tile.habitat.autoFeeder : tile.habitat.autoCleaner;
      const cost =
        kind === 'feeder'
          ? FACILITY_COSTS.autoFeederPurchase
          : FACILITY_COSTS.autoCleanerPurchase;
      if (alreadyOwned || funds < cost) {
        soundFX.playError();
        return;
      }

      const spec = ANIMAL_SPECIES[tile.habitat.speciesId];
      setGrid((prev) =>
        prev.map((row, ry) =>
          row.map((t, rx) => {
            if (rx !== x || ry !== y || !t.habitat) return t;
            return {
              ...t,
              habitat: {
                ...t.habitat,
                ...(kind === 'feeder'
                  ? { autoFeeder: true, autoFeederEnabled: true }
                  : { autoCleaner: true, autoCleanerEnabled: true }),
              },
            };
          })
        )
      );
      setFunds((f) => f - cost);
      addPopup(x, y, kind === 'feeder' ? '安裝自動投餵' : '安裝自動清潔', 'gold');
      addLog(
        day,
        `為「${spec.zoneName}」購買並啟用了「${
          kind === 'feeder' ? '自動投餵系統' : '自動清潔系統'
        }」。`,
        'success'
      );
      soundFX.playMilestone();
    },
    [addLog, addPopup, day, funds, grid]
  );

  const handleToggleHabitatAutomation = useCallback(
    (x: number, y: number, kind: 'feeder' | 'cleaner') => {
      setGrid((prev) =>
        prev.map((row, ry) =>
          row.map((t, rx) => {
            if (rx !== x || ry !== y || !t.habitat) return t;
            return {
              ...t,
              habitat: {
                ...t.habitat,
                ...(kind === 'feeder'
                  ? { autoFeederEnabled: !t.habitat.autoFeederEnabled }
                  : { autoCleanerEnabled: !t.habitat.autoCleanerEnabled }),
              },
            };
          })
        )
      );
      soundFX.playCare();
    },
    []
  );

  const handleEnrichHabitat = useCallback(
    (x: number, y: number) => {
      if (funds < FACILITY_COSTS.enrich) {
        soundFX.playError();
        return;
      }
      setGrid((prev) =>
        prev.map((row, ry) =>
          row.map((tile, rx) => {
            if (rx !== x || ry !== y || !tile.habitat) return tile;
            return {
              ...tile,
              habitat: {
                ...tile.habitat,
                enrichmentBoost: 28,
                animals: tile.habitat.animals.map((a) => {
                  const nextPts = Math.min(600, (a.growthPoints ?? 0) + 6);
                  return {
                    ...a,
                    happiness: Math.min(100, a.happiness + 26),
                    growthPoints: nextPts,
                    growthStage: getAnimalGrowthInfo(nextPts).stage,
                  };
                }),
              },
            };
          })
        )
      );
      setFunds((f) => f - FACILITY_COSTS.enrich);
      addPopup(x, y, '心情大好！', 'green');
      soundFX.playCare();
    },
    [addPopup, funds]
  );

  const handleUpgradeHabitat = useCallback(
    (x: number, y: number) => {
      const tile = grid[y][x];
      if (!tile.habitat || tile.habitat.level >= 3) return;
      const upgradeCost = ANIMAL_SPECIES[tile.habitat.speciesId].upgradeCost * tile.habitat.level;
      if (funds < upgradeCost) {
        soundFX.playError();
        return;
      }
      const nextLevel = (tile.habitat.level + 1) as 2 | 3;
      setGrid((prev) =>
        prev.map((row, ry) =>
          row.map((t, rx) => {
            if (rx !== x || ry !== y || !t.habitat) return t;
            return {
              ...t,
              habitat: {
                ...t.habitat,
                level: nextLevel,
              },
            };
          })
        )
      );
      setFunds((f) => f - upgradeCost);
      addPopup(x, y, `升級 Lv.${nextLevel}`, 'gold');
      soundFX.playMilestone();
    },
    [addPopup, funds, grid]
  );

  const handleAdoptAnimal = useCallback(
    (x: number, y: number, speciesId: SpeciesId) => {
      const tile = grid[y][x];
      const spec = ANIMAL_SPECIES[speciesId];
      if (!tile.habitat || tile.habitat.speciesId !== speciesId) return;
      const capacity = getHabitatCapacity(tile.habitat.level);
      if (tile.habitat.animals.length >= capacity || funds < spec.cost) {
        soundFX.playError();
        return;
      }
      const newAnimal = createAnimalInstance(speciesId);
      setGrid((prev) =>
        prev.map((row, ry) =>
          row.map((t, rx) => {
            if (rx !== x || ry !== y || !t.habitat) return t;
            return {
              ...t,
              habitat: {
                ...t.habitat,
                animals: [...t.habitat.animals, newAnimal],
              },
            };
          })
        )
      );
      setCultivatedSpecies((prev) => {
        const existing = prev[speciesId];
        if (!existing) {
          return {
            ...prev,
            [speciesId]: {
              speciesId,
              firstCultivatedDay: day,
              totalRaised: 1,
              peakGrowthPoints: 0,
              peakStage: 'juvenile',
              lastSatisfaction: Math.round((88 + 90 + tile.habitat!.cleanliness) / 3),
            },
          };
        }
        return {
          ...prev,
          [speciesId]: {
            ...existing,
            totalRaised: existing.totalRaised + 1,
          },
        };
      });
      setFunds((f) => f - spec.cost);
      addPopup(x, y, `歡迎 ${newAnimal.name}！`, 'green');
      addLog(day, `在「${spec.zoneName}」引進了${spec.name}「${newAnimal.name}」！`, 'success');
      soundFX.playCoin();
      soundFX.playAnimalVoice(speciesId);
    },
    [addLog, addPopup, day, funds, grid]
  );

  const handleHireStaff = useCallback(
    (role: StaffRole) => {
      const existingCount = keepers.filter((k) => k.role === role).length;
      const hireCost = role === 'cleaner' ? FACILITY_COSTS.cleanerHire : FACILITY_COSTS.keeperHire;
      if (existingCount >= 3 || funds < hireCost) {
        soundFX.playError();
        return;
      }
      const namesPool = role === 'cleaner' ? CLEANER_NAMES : KEEPER_NAMES;
      const name = namesPool[existingCount % namesPool.length];
      setKeepers((prev) => [
        ...prev,
        {
          id: nextId(role === 'cleaner' ? 'cln' : 'kpr'),
          role,
          name,
          x: GATE_POS.x,
          y: GATE_POS.y,
          targetX: GATE_POS.x,
          targetY: GATE_POS.y,
          taskLabel: role === 'cleaner' ? '巡邏清潔中' : '巡邏照護中',
          cooldownTicks: 0,
        },
      ]);
      setFunds((f) => f - hireCost);
      addPopup(GATE_POS.x, GATE_POS.y, `${name}上崗`, 'green');
      addLog(
        day,
        role === 'cleaner'
          ? `雇用了清潔人員「${name}」協助清理展區與維護園區整潔。`
          : `雇用了動物照顧人員「${name}」協助自動餵食與安撫動物。`,
        'success'
      );
      soundFX.playBuild();
    },
    [addLog, addPopup, day, funds, keepers]
  );

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundFX.setMuted(next);
      if (!next) {
        soundFX.unlock();
      }
      return next;
    });
  }, []);

  const handleToggleBgm = useCallback(() => {
    setBgmMuted((prev) => {
      const next = !prev;
      soundFX.setBgmMuted(next);
      if (!next) {
        soundFX.startBgm();
      }
      return next;
    });
  }, []);

  const handleChangeBgmTrack = useCallback((track: BgmTrackId) => {
    setBgmTrack(track);
    soundFX.setBgmTrack(track);
    if (bgmMuted) {
      setBgmMuted(false);
      soundFX.setBgmMuted(false);
    }
    soundFX.startBgm();
  }, [bgmMuted]);

  const handleCycleRainMode = useCallback(() => {
    setRainMode((prev) => {
      const next: AmbientAudioMode = prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto';
      soundFX.setRainMode(next);
      return next;
    });
  }, []);

  const handleCycleWindMode = useCallback(() => {
    setWindMode((prev) => {
      const next: AmbientAudioMode = prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto';
      soundFX.setWindMode(next);
      return next;
    });
  }, []);

  const handleCycleThunderMode = useCallback(() => {
    setThunderMode((prev) => {
      const next: AmbientAudioMode = prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto';
      if (next === 'on' && muted) {
        setMuted(false);
        soundFX.setMuted(false);
      }
      soundFX.setThunderMode(next);
      return next;
    });
  }, [muted]);

  const handleSelectVisitor = useCallback((visitorId: string | null) => {
    setSelectedVisitorId(visitorId);
    setVisitors((prev) =>
      prev.map((vis) => {
        if (vis.id !== visitorId) {
          return vis.thought ? { ...vis, thought: '', thoughtTicks: 0 } : vis;
        }
        const s = simRef.current;
        const currIsNight = s.tickInDay >= 18;
        const spokenLine =
          vis.thought ||
          ((vis.stargazePauseTicks ?? 0) > 0
            ? pickRandomLine([
                '抬頭仰望星空，星光閃爍好療癒 ✨',
                '站在空曠草地步道吹晚風看星星真舒服 ✨',
                '今晚星空好美，心情都變得好幸福 ✨',
              ])
            : pickVisitorMoodWeatherDialogue(
                vis.mood,
                s.weather,
                vis.energy,
                vis.hunger,
                vis.hasBoughtSnack,
                currIsNight
              ));
        return {
          ...vis,
          thought: spokenLine,
          thoughtTicks: 6,
        };
      })
    );
  }, []);

  const handlePhotoCaptured = useCallback((photoId: string, dataUrl: string) => {
    setPhotoAlbum((prev) =>
      prev.map((item) => (item.id === photoId ? { ...item, thumbnailDataUrl: dataUrl } : item))
    );
    setPendingPhotoCaptures((prev) => prev.filter((req) => req.id !== photoId));
  }, []);

  const handleDeletePhoto = useCallback((photoId: string) => {
    setPhotoAlbum((prev) => prev.filter((item) => item.id !== photoId));
  }, []);

  const handleSaveSlot = useCallback(
    (slotId: SaveSlotId, customLabel?: string): boolean => {
      const s = simRef.current;
      const defaultName =
        slotId === 'autosave'
          ? `每日自動存檔 · 第 ${s.day} 天`
          : `${SAVE_SLOT_DEFAULT_NAMES[slotId]} · 第 ${s.day} 天`;
      const ok = saveZooToSlot(slotId, {
        label: customLabel?.trim() || defaultName,
        difficulty: s.difficulty,
        grid: s.grid,
        funds: s.funds,
        ticketPrice: s.ticketPrice,
        day: s.day,
        tickInDay: s.tickInDay,
        weather: s.weather,
        nextWeather: s.nextWeather,
        weatherDaysLeft: s.weatherDaysLeft,
        seasonalEvent: s.seasonalEvent,
        seasonalDaysLeft: s.seasonalDaysLeft,
        lastSeasonalEvent: lastSeasonalRef.current,
        idleSeasonalDays: idleSeasonalDaysRef.current,
        visitors: s.visitors,
        visitorTypeCounts: s.visitorTypeCounts,
        cultivatedSpecies: s.cultivatedSpecies,
        landmarkUnlocked: s.landmarkUnlocked,
        keepers: s.keepers,
        completedMilestones: s.completedMilestones,
        victoryDismissed: s.victoryDismissed,
        negativeFundDays: s.negativeFundDays,
        stats: s.stats,
        logs: s.logs,
        photoAlbum: s.photoAlbum,
        bgmTrack: s.bgmTrack,
        ratingSnapshot: s.metrics.rating,
        animalCountSnapshot: s.metrics.totalAnimals,
        speciesCountSnapshot: s.metrics.uniqueSpeciesCount,
      });
      if (ok) {
        refreshSaveSlots();
        soundFX.playCare();
      } else {
        soundFX.playError();
      }
      return ok;
    },
    [refreshSaveSlots]
  );

  const saveAutosaveSilent = useCallback(
    (overrideFunds?: number, overrideStats?: ParkStats, overrideLogs?: ParkLogEntry[]) => {
      const s = simRef.current;
      const finalFunds = overrideFunds ?? s.funds;
      const finalStats = overrideStats ?? s.stats;
      const finalLogs = overrideLogs ?? s.logs;
      const ok = saveZooToSlot('autosave', {
        label: `每日自動存檔 · 第 ${s.day} 天`,
        difficulty: s.difficulty,
        grid: s.grid,
        funds: finalFunds,
        ticketPrice: s.ticketPrice,
        day: s.day,
        tickInDay: s.tickInDay,
        weather: s.weather,
        nextWeather: s.nextWeather,
        weatherDaysLeft: s.weatherDaysLeft,
        seasonalEvent: s.seasonalEvent,
        seasonalDaysLeft: s.seasonalDaysLeft,
        lastSeasonalEvent: lastSeasonalRef.current,
        idleSeasonalDays: idleSeasonalDaysRef.current,
        visitors: s.visitors,
        visitorTypeCounts: s.visitorTypeCounts,
        cultivatedSpecies: s.cultivatedSpecies,
        landmarkUnlocked: s.landmarkUnlocked,
        keepers: s.keepers,
        completedMilestones: s.completedMilestones,
        victoryDismissed: s.victoryDismissed,
        negativeFundDays: s.negativeFundDays,
        stats: finalStats,
        logs: finalLogs.slice(0, 20),
        photoAlbum: s.photoAlbum,
        bgmTrack: s.bgmTrack,
        ratingSnapshot: s.metrics.rating,
        animalCountSnapshot: s.metrics.totalAnimals,
        speciesCountSnapshot: s.metrics.uniqueSpeciesCount,
      });
      if (ok) {
        refreshSaveSlots();
      }
    },
    [refreshSaveSlots]
  );

  const handleLoadSlot = useCallback(
    (slotId: SaveSlotId) => {
      const loaded = loadZooFromSlot(slotId);
      if (!loaded) {
        soundFX.playError();
        return;
      }

      const nowTs = Date.now();
      const reward = !hasClaimedOfflineReward(slotId, loaded.savedAt)
        ? computeOfflineReward(loaded.grid, loaded.ticketPrice, loaded.stats, loaded.savedAt, nowTs)
        : null;

      if (reward) {
        markClaimedOfflineReward(slotId, loaded.savedAt);
      }

      const nextFunds = reward ? loaded.funds + reward.totalReward : loaded.funds;
      const nextStats: ParkStats = reward
        ? {
            ...loaded.stats,
            peakFunds: Math.max(loaded.stats.peakFunds, nextFunds),
          }
        : loaded.stats;

      const offlineLog: ParkLogEntry[] = reward
        ? [
            {
              id: nextId('log'),
              day: loaded.day,
              message: `離線 ${reward.elapsedDays} 天期間園區持續營運，依每日收入 $${reward.dailyRevenue.toLocaleString()} 與 ${reward.animalCount} 隻動物發放經營獎勵 +$${reward.totalReward.toLocaleString()}！`,
              tone: 'success' as const,
            },
          ]
        : [];

      const nextLogs = [
        ...offlineLog,
        {
          id: nextId('log'),
          day: loaded.day,
          message: `已讀取存檔「${loaded.label}」（第 ${loaded.day} 天）。`,
          tone: 'success' as const,
        },
        ...loaded.logs,
      ].slice(0, 20);

      setDifficulty(loaded.difficulty);
      setGrid(loaded.grid);
      setFunds(nextFunds);
      setTicketPrice(loaded.ticketPrice);
      setDay(loaded.day);
      setTickInDay(loaded.tickInDay);
      setWeather(loaded.weather);
      setNextWeather(loaded.nextWeather);
      setWeatherDaysLeft(loaded.weatherDaysLeft);
      setSeasonalEvent(loaded.seasonalEvent);
      setSeasonalDaysLeft(loaded.seasonalDaysLeft);
      lastSeasonalRef.current = loaded.lastSeasonalEvent;
      idleSeasonalDaysRef.current = loaded.idleSeasonalDays ?? 0;
      weatherPopupKeyRef.current = {};
      setVisitors(loaded.visitors);
      setVisitorTypeCounts(loaded.visitorTypeCounts ?? createEmptyVisitorTypeCounts());
      setCultivatedSpecies(
        loaded.cultivatedSpecies ?? collectInitialCultivatedSpecies(loaded.grid)
      );
      setLandmarkUnlocked(Boolean(loaded.landmarkUnlocked));
      setKeepers(loaded.keepers);
      setCompletedMilestones(loaded.completedMilestones);
      setVictoryDismissed(Boolean(loaded.victoryDismissed));
      setNegativeFundDays(loaded.negativeFundDays ?? 0);
      setStats(nextStats);
      setLogs(nextLogs);
      setPhotoAlbum(Array.isArray(loaded.photoAlbum) ? loaded.photoAlbum : []);
      setPendingPhotoCaptures([]);
      photoAlbumCooldownRef.current = 0;
      setPopups([]);
      setSelectedVisitorId(null);
      setSelectedPos({ x: 3, y: 4 });
      setActiveTool('select');
      setPhotoMode(false);
      setSpeed(1);
      if (loaded.bgmTrack) {
        setBgmTrack(loaded.bgmTrack);
        soundFX.setBgmTrack(loaded.bgmTrack);
      }
      setSaveModalOpen(false);
      setGameState('PLAYING');
      lastHiddenAtRef.current = null;

      if (reward) {
        const avgMoodSnap =
          loaded.visitors.length === 0
            ? 84
            : loaded.visitors.reduce((acc, v) => acc + v.mood, 0) / loaded.visitors.length;
        const snapMetrics = computeParkMetrics(
          loaded.grid,
          loaded.ticketPrice,
          loaded.weather,
          avgMoodSnap
        );
        saveZooToSlot('autosave', {
          label: `每日自動存檔 · 第 ${loaded.day} 天`,
          difficulty: loaded.difficulty,
          grid: loaded.grid,
          funds: nextFunds,
          ticketPrice: loaded.ticketPrice,
          day: loaded.day,
          tickInDay: loaded.tickInDay,
          weather: loaded.weather,
          nextWeather: loaded.nextWeather,
          weatherDaysLeft: loaded.weatherDaysLeft,
          seasonalEvent: loaded.seasonalEvent,
          seasonalDaysLeft: loaded.seasonalDaysLeft,
          lastSeasonalEvent: loaded.lastSeasonalEvent,
          idleSeasonalDays: loaded.idleSeasonalDays ?? 0,
          visitors: loaded.visitors,
          visitorTypeCounts: loaded.visitorTypeCounts ?? createEmptyVisitorTypeCounts(),
          cultivatedSpecies:
            loaded.cultivatedSpecies ?? collectInitialCultivatedSpecies(loaded.grid),
          landmarkUnlocked: Boolean(loaded.landmarkUnlocked),
          keepers: loaded.keepers,
          completedMilestones: loaded.completedMilestones,
          victoryDismissed: Boolean(loaded.victoryDismissed),
          negativeFundDays: loaded.negativeFundDays ?? 0,
          stats: nextStats,
          logs: nextLogs,
          photoAlbum: Array.isArray(loaded.photoAlbum) ? loaded.photoAlbum : [],
          bgmTrack: loaded.bgmTrack,
          ratingSnapshot: snapMetrics.rating,
          animalCountSnapshot: snapMetrics.totalAnimals,
          speciesCountSnapshot: snapMetrics.uniqueSpeciesCount,
        });
        refreshSaveSlots();
        setOfflineReward(reward);
      } else {
        setOfflineReward(null);
      }

      soundFX.unlock();
      soundFX.startBgm();
      soundFX.playMilestone();
    },
    [refreshSaveSlots]
  );

  const handleDeleteSlot = useCallback(
    (slotId: SaveSlotId) => {
      deleteSaveSlot(slotId);
      refreshSaveSlots();
    },
    [refreshSaveSlots]
  );

  const handleContinueLatestSave = useCallback(() => {
    const latest = getLatestSaveSummary();
    if (latest) {
      handleLoadSlot(latest.slotId);
    }
  }, [handleLoadSlot]);

  const pomodoroTotalSeconds =
    (pomodoroMode === 'focus'
      ? pomodoroFocusMins
      : pomodoroMode === 'shortBreak'
      ? pomodoroShortMins
      : pomodoroLongMins) * 60;

  const pomodoroStateRef = useRef({
    mode: pomodoroMode,
    focusMins: pomodoroFocusMins,
    shortMins: pomodoroShortMins,
    longMins: pomodoroLongMins,
    completed: completedPomodoros,
    todayMins: todayFocusMinutes,
    secondsLeft: pomodoroSecondsLeft,
  });
  pomodoroStateRef.current = {
    mode: pomodoroMode,
    focusMins: pomodoroFocusMins,
    shortMins: pomodoroShortMins,
    longMins: pomodoroLongMins,
    completed: completedPomodoros,
    todayMins: todayFocusMinutes,
    secondsLeft: pomodoroSecondsLeft,
  };

  // Persist Pomodoro preferences & daily completion stats
  useEffect(() => {
    try {
      const payload: StoredPomodoroPrefs = {
        dateStr: getTodayDateKey(),
        completedPomodoros,
        todayFocusMinutes,
        focusMinutes: pomodoroFocusMins,
        shortBreakMinutes: pomodoroShortMins,
        longBreakMinutes: pomodoroLongMins,
        taskLabel: pomodoroTaskLabel,
        autoStudyMusic: pomodoroAutoStudyMusic,
      };
      window.localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    completedPomodoros,
    todayFocusMinutes,
    pomodoroFocusMins,
    pomodoroShortMins,
    pomodoroLongMins,
    pomodoroTaskLabel,
    pomodoroAutoStudyMusic,
  ]);

  // Date.now()-anchored Pomodoro countdown (drift-free across background tabs)
  useEffect(() => {
    if (!pomodoroRunning) return;
    if (!pomodoroEndAtRef.current) {
      pomodoroEndAtRef.current = Date.now() + pomodoroStateRef.current.secondsLeft * 1000;
    }

    const interval = window.setInterval(() => {
      const endAt = pomodoroEndAtRef.current;
      if (!endAt) return;
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setPomodoroSecondsLeft(remaining);

      if (remaining <= 0) {
        pomodoroEndAtRef.current = null;
        setPomodoroRunning(false);
        const cur = pomodoroStateRef.current;
        if (cur.mode === 'focus') {
          soundFX.playPomodoroChime('focus_done');
          const nextCompleted = cur.completed + 1;
          const nextTodayMins = cur.todayMins + cur.focusMins;
          setCompletedPomodoros(nextCompleted);
          setTodayFocusMinutes(nextTodayMins);
          const nextMode: PomodoroMode = nextCompleted % 4 === 0 ? 'longBreak' : 'shortBreak';
          const nextMins = nextMode === 'longBreak' ? cur.longMins : cur.shortMins;
          setPomodoroMode(nextMode);
          setPomodoroSecondsLeft(nextMins * 60);
          setPomodoroBanner({
            title: '專注讀書完成！',
            subtitle:
              nextMode === 'longBreak'
                ? `已完成第 ${nextCompleted} 顆番茄，推薦進行 ${cur.longMins} 分鐘長休息。`
                : `已完成第 ${nextCompleted} 顆番茄，起來伸展休息 ${cur.shortMins} 分鐘吧。`,
            nextMode,
          });
        } else {
          soundFX.playPomodoroChime('break_done');
          setPomodoroMode('focus');
          setPomodoroSecondsLeft(cur.focusMins * 60);
          setPomodoroBanner({
            title: '休息時間結束',
            subtitle: `準備好開始下一輪 ${cur.focusMins} 分鐘專注讀書了嗎？`,
            nextMode: 'focus',
          });
        }
      }
    }, 450);

    return () => window.clearInterval(interval);
  }, [pomodoroRunning]);

  // Keep browser tab title showing live Pomodoro countdown while running
  useEffect(() => {
    if (pomodoroRunning) {
      const label = pomodoroMode === 'focus' ? '專注讀書' : '休息中';
      document.title = `${formatPomodoroTime(pomodoroSecondsLeft)} ${label} · 森之方舟動物園`;
    } else {
      document.title = '森之方舟動物園 — 生態園區經營遊戲';
    }
  }, [pomodoroRunning, pomodoroSecondsLeft, pomodoroMode]);

  const ensureStudyMusicPlaying = useCallback(() => {
    if (!pomodoroAutoStudyMusic) return;
    const isStudyTrack = BGM_TRACKS.some(
      (track) => track.id === bgmTrack && track.category === '專注讀書'
    );
    if (!isStudyTrack) {
      setBgmTrack('study_lofi_desk');
      soundFX.setBgmTrack('study_lofi_desk');
    }
    if (bgmMuted) {
      setBgmMuted(false);
      soundFX.setBgmMuted(false);
    }
    soundFX.unlock();
    soundFX.startBgm();
  }, [bgmMuted, bgmTrack, pomodoroAutoStudyMusic]);

  const handleTogglePomodoroRun = useCallback(() => {
    soundFX.unlock();
    setPomodoroBanner(null);
    if (pomodoroRunning) {
      if (pomodoroEndAtRef.current) {
        const rem = Math.max(0, Math.ceil((pomodoroEndAtRef.current - Date.now()) / 1000));
        setPomodoroSecondsLeft(rem);
      }
      pomodoroEndAtRef.current = null;
      setPomodoroRunning(false);
    } else {
      if (pomodoroMode === 'focus') {
        ensureStudyMusicPlaying();
      }
      const secs = pomodoroSecondsLeft > 0 ? pomodoroSecondsLeft : pomodoroTotalSeconds;
      setPomodoroSecondsLeft(secs);
      pomodoroEndAtRef.current = Date.now() + secs * 1000;
      setPomodoroRunning(true);
    }
  }, [
    ensureStudyMusicPlaying,
    pomodoroMode,
    pomodoroRunning,
    pomodoroSecondsLeft,
    pomodoroTotalSeconds,
  ]);

  const handleResetPomodoro = useCallback(() => {
    pomodoroEndAtRef.current = null;
    setPomodoroRunning(false);
    setPomodoroSecondsLeft(pomodoroTotalSeconds);
  }, [pomodoroTotalSeconds]);

  const handleSelectPomodoroMode = useCallback(
    (nextMode: PomodoroMode) => {
      pomodoroEndAtRef.current = null;
      setPomodoroRunning(false);
      setPomodoroBanner(null);
      setPomodoroMode(nextMode);
      const mins =
        nextMode === 'focus'
          ? pomodoroFocusMins
          : nextMode === 'shortBreak'
          ? pomodoroShortMins
          : pomodoroLongMins;
      setPomodoroSecondsLeft(mins * 60);
    },
    [pomodoroFocusMins, pomodoroShortMins, pomodoroLongMins]
  );

  const handleSkipPomodoroPhase = useCallback(() => {
    const nextMode: PomodoroMode =
      pomodoroMode === 'focus'
        ? (completedPomodoros + 1) % 4 === 0
          ? 'longBreak'
          : 'shortBreak'
        : 'focus';
    handleSelectPomodoroMode(nextMode);
  }, [completedPomodoros, handleSelectPomodoroMode, pomodoroMode]);

  const handleSelectPomodoroPreset = useCallback(
    (targetMode: PomodoroMode, minutes: number) => {
      if (targetMode === 'focus') setPomodoroFocusMins(minutes);
      else if (targetMode === 'shortBreak') setPomodoroShortMins(minutes);
      else setPomodoroLongMins(minutes);

      if (targetMode === pomodoroMode) {
        pomodoroEndAtRef.current = null;
        setPomodoroRunning(false);
        setPomodoroSecondsLeft(minutes * 60);
      }
    },
    [pomodoroMode]
  );

  const handleStartNextFromBanner = useCallback(() => {
    if (!pomodoroBanner) return;
    const nextMode = pomodoroBanner.nextMode;
    setPomodoroBanner(null);
    soundFX.unlock();
    if (nextMode === 'focus') {
      ensureStudyMusicPlaying();
    }
    const mins =
      nextMode === 'focus'
        ? pomodoroFocusMins
        : nextMode === 'shortBreak'
        ? pomodoroShortMins
        : pomodoroLongMins;
    const secs = mins * 60;
    setPomodoroMode(nextMode);
    setPomodoroSecondsLeft(secs);
    pomodoroEndAtRef.current = Date.now() + secs * 1000;
    setPomodoroRunning(true);
  }, [
    ensureStudyMusicPlaying,
    pomodoroBanner,
    pomodoroFocusMins,
    pomodoroLongMins,
    pomodoroShortMins,
  ]);

  const selectedTile = selectedPos ? grid[selectedPos.y]?.[selectedPos.x] ?? null : null;
  const isNight = tickInDay >= 18;

  // Sync Day/Night, Weather & Pause state with BGM & ambient nature audio engine
  useEffect(() => {
    soundFX.setNightMode(isNight);
    soundFX.setWeather(weather);
    soundFX.setPaused(gameState !== 'PLAYING' || speed === 0);
  }, [isNight, weather, gameState, speed]);

  // Ensure Web Audio unlocks cleanly on user interaction while playing
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const handleUnlock = () => {
      soundFX.unlock();
      soundFX.startBgm();
    };
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, [gameState]);

  // Periodic gentle ambient animal calls across inhabited habitats (restrained frequency)
  useEffect(() => {
    if (gameState !== 'PLAYING' || speed === 0) return;
    const intervalMs = speed === 2 ? 10000 : 13000;
    const timer = window.setInterval(() => {
      const s = simRef.current;
      const nowIsNight = s.tickInDay >= 18;
      const callChance = nowIsNight ? 0.14 : 0.3;
      if (Math.random() > callChance) return;

      const inhabitedSpecies: SpeciesId[] = [];
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const hab = s.grid[y][x].habitat;
          if (hab && hab.animals.length > 0) {
            inhabitedSpecies.push(hab.speciesId);
          }
        }
      }
      if (inhabitedSpecies.length === 0) return;
      const picked = inhabitedSpecies[Math.floor(Math.random() * inhabitedSpecies.length)];
      soundFX.playAnimalVoice(picked, true);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [gameState, speed]);

  // Auto-save when closing/leaving app & award offline income if resuming from background on a new day
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
        saveAutosaveSilent();
      } else if (document.visibilityState === 'visible' && lastHiddenAtRef.current) {
        const nowTs = Date.now();
        const hiddenAt = lastHiddenAtRef.current;
        lastHiddenAtRef.current = null;
        const s = simRef.current;
        const reward = computeOfflineReward(s.grid, s.ticketPrice, s.stats, hiddenAt, nowTs);
        if (reward) {
          const nextFundsVal = s.funds + reward.totalReward;
          const nextStatsVal: ParkStats = {
            ...s.stats,
            peakFunds: Math.max(s.stats.peakFunds, nextFundsVal),
          };
          const logEntry: ParkLogEntry = {
            id: nextId('log'),
            day: s.day,
            message: `離線 ${reward.elapsedDays} 天期間園區持續營運，依每日收入 $${reward.dailyRevenue.toLocaleString()} 與 ${reward.animalCount} 隻動物發放經營獎勵 +$${reward.totalReward.toLocaleString()}！`,
            tone: 'success',
          };
          const nextLogsVal = [logEntry, ...s.logs].slice(0, 20);
          setFunds(nextFundsVal);
          setStats(nextStatsVal);
          setLogs(nextLogsVal);
          addPopup(GATE_POS.x, GATE_POS.y, `離線獎勵 +$${reward.totalReward}`, 'gold');
          saveAutosaveSilent(nextFundsVal, nextStatsVal, nextLogsVal);
          setOfflineReward(reward);
          soundFX.playMilestone();
        }
      }
    };

    const handlePageHide = () => {
      lastHiddenAtRef.current = Date.now();
      saveAutosaveSilent();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [addPopup, gameState, saveAutosaveSilent]);

  const latestSaveSummary = useMemo(() => {
    if (saveSlots.length === 0) return null;
    return saveSlots.reduce(
      (latest, cur) => (cur.savedAt > latest.savedAt ? cur : latest),
      saveSlots[0]
    );
  }, [saveSlots]);

  const titleOfflineDays = useMemo(() => {
    if (!latestSaveSummary) return 0;
    return countElapsedDays(latestSaveSummary.savedAt, Date.now());
  }, [latestSaveSummary]);

  if (gameState === 'TITLE_MENU') {
    return (
      <>
        <TitleScreen
          onStartGame={startNewGame}
          latestSave={latestSaveSummary}
          offlineDays={titleOfflineDays}
          hasAnySave={saveSlots.length > 0}
          onContinueLatestSave={handleContinueLatestSave}
          onOpenSaveModal={() => {
            refreshSaveSlots();
            setSaveModalOpen(true);
          }}
        />
        {saveModalOpen && (
          <SaveLoadModal
            isPlaying={false}
            slots={saveSlots}
            onClose={() => setSaveModalOpen(false)}
            onSaveSlot={handleSaveSlot}
            onLoadSlot={handleLoadSlot}
            onDeleteSlot={handleDeleteSlot}
          />
        )}
      </>
    );
  }

  const selectedVisitorObj = selectedVisitorId
    ? visitors.find((v) => v.id === selectedVisitorId) ?? null
    : null;
  const weatherVisual = WEATHER_VISUAL_FEEDBACK[weather];

  return (
    <div
      data-weather={weather}
      data-night={isNight ? 'true' : 'false'}
      className={`relative min-h-screen text-[#1A2B20] flex flex-col transition-colors duration-700 ${
        isNight ? weatherVisual.pageBgNight : weatherVisual.pageBgDay
      }`}
    >
      {!photoMode && (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-0 z-0 bg-gradient-to-b ${weatherVisual.ambientGlowClass} transition-opacity duration-700`}
        />
      )}
      <div className={photoMode ? 'contents' : 'relative z-[1] flex-1 flex flex-col'}>
      {!photoMode && (
        <TopHud
          funds={funds}
          visitorCount={visitors.length}
          rating={metrics.rating}
          day={day}
          dayProgress={(tickInDay / TICKS_PER_DAY) * 100}
          isNight={isNight}
          weather={weather}
          weatherDaysLeft={weatherDaysLeft}
          seasonalEvent={seasonalEvent}
          seasonalDaysLeft={seasonalDaysLeft}
          speed={speed}
          muted={muted}
          bgmMuted={bgmMuted}
          bgmTrack={bgmTrack}
          rainMode={rainMode}
          windMode={windMode}
          thunderMode={thunderMode}
          pomodoroMode={pomodoroMode}
          pomodoroRunning={pomodoroRunning}
          pomodoroSecondsLeft={pomodoroSecondsLeft}
          onOpenPomodoro={() => {
            if (window.innerWidth < 1024) {
              setMobileTab('pomodoro');
            } else {
              setPomodoroModalOpen(true);
            }
          }}
          onChangeSpeed={setSpeed}
          onToggleMute={handleToggleMute}
          onToggleBgm={handleToggleBgm}
          onChangeBgmTrack={handleChangeBgmTrack}
          onCycleRainMode={handleCycleRainMode}
          onCycleWindMode={handleCycleWindMode}
          onCycleThunderMode={handleCycleThunderMode}
          onEnterPhotoMode={() => setPhotoMode(true)}
          onOpenSaveModal={() => {
            refreshSaveSlots();
            setSaveModalOpen(true);
          }}
          onReturnTitle={() => {
            saveAutosaveSilent();
            refreshSaveSlots();
            setGameState('TITLE_MENU');
          }}
        />
      )}

      <main
        className={
          photoMode
            ? 'fixed inset-0 z-40 w-screen h-screen m-0 p-0 bg-black'
            : 'flex-1 w-full max-w-[1440px] mx-auto p-2.5 sm:p-4 lg:p-5 pb-24 lg:pb-5 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-start'
        }
      >
        {/* Left/Center Workspace: Build Toolbar + 3D Park Viewport */}
        <section
          className={
            photoMode
              ? 'w-full h-full'
              : `${mobileTab === 'park' ? 'flex' : 'hidden lg:flex'} lg:col-span-8 xl:col-span-8 flex-col gap-2.5 lg:gap-3`
          }
        >
          {!photoMode && (
            <BuildToolbar
              activeTool={activeTool}
              funds={funds}
              landmarkUnlocked={landmarkUnlocked}
              discoveredVisitorCount={
                VISITOR_ARCHETYPE_IDS.filter((id) => (visitorTypeCounts[id] || 0) > 0).length
              }
              totalVisitorTypes={VISITOR_ARCHETYPE_IDS.length}
              mobileExpanded={false}
              onOpenBuildPicker={() => setMobileTab('build')}
              onSelectTool={setActiveTool}
            />
          )}

          <div
            className={
              photoMode
                ? 'w-full h-full'
                : `rounded-2xl transition-shadow duration-700 ${weatherVisual.stageFrameClass}`
            }
          >
            <ParkCanvas3D
              key="park-canvas-3d"
              grid={grid}
              weather={weather}
              seasonalEvent={seasonalEvent}
              isNight={isNight}
              avgVisitorMood={avgVisitorMood}
              speed={speed}
              photoMode={photoMode}
              activeTool={activeTool}
              selectedPos={selectedPos}
              selectedVisitorId={selectedVisitorId}
              visitors={visitors}
              keepers={keepers}
              popups={popups}
              pendingPhotoCaptures={pendingPhotoCaptures}
              onPhotoCaptured={handlePhotoCaptured}
              onTileClick={(x, y) => handleBuildAt(x, y, false)}
              onTilePaintDrag={(x, y) => handleBuildAt(x, y, true)}
              onSelectVisitor={handleSelectVisitor}
              onEnterPhotoMode={() => setPhotoMode(true)}
              onExitPhotoMode={() => setPhotoMode(false)}
            />
          </div>

          {/* Mobile Quick Selection Action Bar (shown beneath 3D canvas on < lg) */}
          {!photoMode && (
            <div className="lg:hidden bg-white border border-[#E2DDD3] rounded-xl p-2.5 shadow-xs">
              {selectedVisitorObj ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1A2B20] truncate">
                      {selectedVisitorObj.name} · {selectedVisitorObj.archetypeLabel}
                    </p>
                    <p className="text-[11px] text-[#5B6D60] truncate">
                      {selectedVisitorObj.thought || `心情 ${Math.round(selectedVisitorObj.mood)}%`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileTab('manage')}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#1A2B20] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    查看檔案 →
                  </button>
                </div>
              ) : selectedTile && selectedTile.type === 'habitat' && selectedTile.habitat ? (
                (() => {
                  const hab = selectedTile.habitat!;
                  const spec = ANIMAL_SPECIES[hab.speciesId];
                  return (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1A2B20] truncate">
                          {spec.zoneName} · {hab.animals.length}/{getHabitatCapacity(hab.level)} 隻
                        </p>
                        <p className="text-[11px] text-[#5B6D60] font-mono-num">
                          清潔度 {Math.round(hab.cleanliness)}% · 點擊右側照護或管理
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleFeedHabitat(selectedTile.x, selectedTile.y)}
                          disabled={hab.animals.length === 0 || funds < FACILITY_COSTS.feed}
                          aria-label="餵食動物"
                          className="min-h-[40px] px-2.5 py-1.5 rounded-lg border border-[#E2DDD3] bg-[#FAF9F5] disabled:opacity-45 text-xs font-semibold text-[#1A2B20] flex items-center gap-1 cursor-pointer"
                        >
                          <Utensils className="w-3.5 h-3.5 text-emerald-700" />
                          <span>餵食</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCleanHabitat(selectedTile.x, selectedTile.y)}
                          disabled={funds < FACILITY_COSTS.clean}
                          aria-label="清潔展區"
                          className="min-h-[40px] px-2.5 py-1.5 rounded-lg border border-[#E2DDD3] bg-[#FAF9F5] disabled:opacity-45 text-xs font-semibold text-[#1A2B20] flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-sky-700" />
                          <span>清潔</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileTab('manage')}
                          className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-[#059669] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                        >
                          管理
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-between gap-2 text-xs text-[#5B6D60]">
                  <span className="truncate">
                    單指拖曳旋轉 · 雙指縮放平移 · 點擊動物區或遊客即可管理
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileTab('manage')}
                    className="min-h-[38px] px-2.5 py-1 rounded-lg border border-[#E2DDD3] bg-[#FAF9F5] text-[#1A2B20] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    總覽與圖鑑
                  </button>
                </div>
              )}
            </div>
          )}

          {!photoMode && (
            <div className="hidden lg:flex flex-wrap items-center justify-between gap-2 text-xs text-[#5B6D60] px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold shrink-0 transition-colors duration-500 ${weatherVisual.badgeClass}`}
                >
                  {weatherVisual.effectLabel}
                </span>
                <span className="truncate">
                  提示：每種動物均有專屬 3D 園區；點選園內遊客後才會說話並顯示名字、心情與聲音（空白鍵暫停）。
                </span>
              </div>
              <span className="font-mono-num shrink-0">
                魅力值 {metrics.totalAppeal} · 動物福利 {metrics.avgWelfare}%
              </span>
            </div>
          )}
        </section>

        {/* Mobile Dedicated Build Picker Tab (< lg) */}
        {!photoMode && mobileTab === 'build' && (
          <div className="lg:hidden">
            <BuildToolbar
              activeTool={activeTool}
              funds={funds}
              landmarkUnlocked={landmarkUnlocked}
              discoveredVisitorCount={
                VISITOR_ARCHETYPE_IDS.filter((id) => (visitorTypeCounts[id] || 0) > 0).length
              }
              totalVisitorTypes={VISITOR_ARCHETYPE_IDS.length}
              mobileExpanded={true}
              onSelectTool={(tool) => {
                setActiveTool(tool);
                setMobileTab('park');
              }}
            />
          </div>
        )}

        {/* Right Panel: Contextual Species Zone Inspector / Park Overview (always mounted on desktop, tab-shown on mobile) */}
        {!photoMode && (
          <div
            className={`${
              mobileTab === 'manage' ? 'block' : 'hidden lg:block'
            } lg:col-span-4 xl:col-span-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-5.5rem)]`}
          >
            <InspectorPanel
              grid={grid}
              selectedTile={selectedTile}
              selectedVisitorId={selectedVisitorId}
              funds={funds}
              ticketPrice={ticketPrice}
              weather={weather}
              nextWeather={nextWeather}
              weatherDaysLeft={weatherDaysLeft}
              seasonalEvent={seasonalEvent}
              seasonalDaysLeft={seasonalDaysLeft}
              isNight={isNight}
              avgVisitorMood={avgVisitorMood}
              visitors={visitors}
              visitorTypeCounts={visitorTypeCounts}
              cultivatedSpecies={cultivatedSpecies}
              photoAlbum={photoAlbum}
              landmarkUnlocked={landmarkUnlocked}
              keepers={keepers}
              completedMilestones={completedMilestones}
              logs={logs}
              metrics={metrics}
              totalVisitors={stats.totalVisitors}
              onFeedHabitat={handleFeedHabitat}
              onCleanHabitat={handleCleanHabitat}
              onEnrichHabitat={handleEnrichHabitat}
              onUpgradeHabitat={handleUpgradeHabitat}
              onBuyHabitatAutomation={handleBuyHabitatAutomation}
              onToggleHabitatAutomation={handleToggleHabitatAutomation}
              onAdoptAnimal={handleAdoptAnimal}
              onHireStaff={handleHireStaff}
              onChangeTicketPrice={setTicketPrice}
              onSelectLandmarkTool={() => {
                setActiveTool('landmark');
                setMobileTab('park');
              }}
              onDeletePhoto={handleDeletePhoto}
              onSelectHabitatPos={(x, y) => {
                handleSelectVisitor(null);
                setSelectedPos({ x, y });
              }}
              onSelectVisitor={handleSelectVisitor}
              onClearSelection={() => {
                setSelectedPos(null);
                handleSelectVisitor(null);
              }}
            />
          </div>
        )}

        {/* Mobile Dedicated Pomodoro Tab (< lg) */}
        {!photoMode && mobileTab === 'pomodoro' && (
          <div className="lg:hidden">
            <PomodoroPanel
              mode={pomodoroMode}
              isRunning={pomodoroRunning}
              secondsLeft={pomodoroSecondsLeft}
              totalSeconds={pomodoroTotalSeconds}
              focusMinutes={pomodoroFocusMins}
              shortBreakMinutes={pomodoroShortMins}
              longBreakMinutes={pomodoroLongMins}
              completedPomodoros={completedPomodoros}
              todayFocusMinutes={todayFocusMinutes}
              taskLabel={pomodoroTaskLabel}
              autoStudyMusic={pomodoroAutoStudyMusic}
              bgmMuted={bgmMuted}
              bgmTrack={bgmTrack}
              variant="embedded"
              onToggleRun={handleTogglePomodoroRun}
              onReset={handleResetPomodoro}
              onSkipPhase={handleSkipPomodoroPhase}
              onSelectMode={handleSelectPomodoroMode}
              onSelectPresetMinutes={handleSelectPomodoroPreset}
              onChangeTaskLabel={setPomodoroTaskLabel}
              onToggleAutoStudyMusic={() => setPomodoroAutoStudyMusic((v) => !v)}
              onToggleBgm={handleToggleBgm}
              onChangeBgmTrack={handleChangeBgmTrack}
            />
          </div>
        )}
      </main>
      </div>

      {/* Non-blocking Pomodoro Phase Completion Toast */}
      {pomodoroBanner && !photoMode && (
        <div
          className="fixed bottom-20 lg:bottom-5 right-3 left-3 sm:left-auto sm:w-96 z-40 bg-white border border-emerald-700/35 rounded-2xl p-3.5 shadow-xl flex flex-col gap-2.5"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <Timer className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1A2B20]">{pomodoroBanner.title}</p>
                <p className="text-xs text-[#5B6D60] mt-0.5 leading-snug">
                  {pomodoroBanner.subtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPomodoroBanner(null)}
              aria-label="關閉提醒"
              className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-[#F4F2EC] text-[#5B6D60] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPomodoroBanner(null)}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E2DDD3] bg-[#FAF9F5] text-xs font-semibold text-[#4A5D50] cursor-pointer"
            >
              稍後
            </button>
            <button
              type="button"
              onClick={handleStartNextFromBanner}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold cursor-pointer"
            >
              {pomodoroBanner.nextMode === 'focus' ? '開始專注讀書' : '開始休息計時'}
            </button>
          </div>
        </div>
      )}

      {/* Fixed Mobile Bottom Thumb Navigation Bar (< lg) */}
      {!photoMode && (
        <nav
          aria-label="手機版主選單"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E2DDD3] grid grid-cols-4 pb-safe shadow-[0_-4px_16px_rgba(26,43,32,0.06)]"
        >
          <button
            type="button"
            onClick={() => setMobileTab('park')}
            className={`min-h-[58px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
              mobileTab === 'park' ? 'text-emerald-800 bg-emerald-50/60' : 'text-[#5B6D60]'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span>園區</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('build')}
            className={`min-h-[58px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
              mobileTab === 'build' ? 'text-emerald-800 bg-emerald-50/60' : 'text-[#5B6D60]'
            }`}
          >
            <Hammer className="w-5 h-5" />
            <span>建造</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('manage')}
            className={`min-h-[58px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
              mobileTab === 'manage' ? 'text-emerald-800 bg-emerald-50/60' : 'text-[#5B6D60]'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span>管理</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('pomodoro')}
            className={`min-h-[58px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
              mobileTab === 'pomodoro'
                ? 'text-rose-800 bg-rose-50/60'
                : pomodoroRunning
                ? 'text-rose-700'
                : 'text-[#5B6D60]'
            }`}
          >
            <Timer className="w-5 h-5" />
            <span className={pomodoroRunning ? 'font-mono-num' : ''}>
              {pomodoroRunning ? formatPomodoroTime(pomodoroSecondsLeft) : '番茄鐘'}
            </span>
          </button>
        </nav>
      )}

      {/* Desktop Pomodoro Modal */}
      {pomodoroModalOpen && (
        <PomodoroPanel
          mode={pomodoroMode}
          isRunning={pomodoroRunning}
          secondsLeft={pomodoroSecondsLeft}
          totalSeconds={pomodoroTotalSeconds}
          focusMinutes={pomodoroFocusMins}
          shortBreakMinutes={pomodoroShortMins}
          longBreakMinutes={pomodoroLongMins}
          completedPomodoros={completedPomodoros}
          todayFocusMinutes={todayFocusMinutes}
          taskLabel={pomodoroTaskLabel}
          autoStudyMusic={pomodoroAutoStudyMusic}
          bgmMuted={bgmMuted}
          bgmTrack={bgmTrack}
          variant="modal"
          onClose={() => setPomodoroModalOpen(false)}
          onToggleRun={handleTogglePomodoroRun}
          onReset={handleResetPomodoro}
          onSkipPhase={handleSkipPomodoroPhase}
          onSelectMode={handleSelectPomodoroMode}
          onSelectPresetMinutes={handleSelectPomodoroPreset}
          onChangeTaskLabel={setPomodoroTaskLabel}
          onToggleAutoStudyMusic={() => setPomodoroAutoStudyMusic((v) => !v)}
          onToggleBgm={handleToggleBgm}
          onChangeBgmTrack={handleChangeBgmTrack}
        />
      )}

      {(gameState === 'VICTORY' || gameState === 'GAME_OVER') && (
        <EndGameModal
          gameState={gameState}
          stats={stats}
          funds={funds}
          rating={metrics.rating}
          animalCount={metrics.totalAnimals}
          speciesCount={metrics.uniqueSpeciesCount}
          onContinuePlaying={() => {
            setVictoryDismissed(true);
            setGameState('PLAYING');
          }}
          onRestart={() => startNewGame(difficulty)}
        />
      )}

      {saveModalOpen && (
        <SaveLoadModal
          isPlaying={gameState === 'PLAYING'}
          slots={saveSlots}
          currentDay={day}
          currentFunds={funds}
          currentRating={metrics.rating}
          onClose={() => setSaveModalOpen(false)}
          onSaveSlot={handleSaveSlot}
          onLoadSlot={handleLoadSlot}
          onDeleteSlot={handleDeleteSlot}
        />
      )}

      {offlineReward && (
        <OfflineRewardModal
          reward={offlineReward}
          onClaim={() => {
            soundFX.playCoin();
            addPopup(GATE_POS.x, GATE_POS.y, `離線獎勵 +$${offlineReward.totalReward}`, 'gold');
            setOfflineReward(null);
          }}
        />
      )}
    </div>
  );
}
