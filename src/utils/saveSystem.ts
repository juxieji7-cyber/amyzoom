import { GRID_COLS, GRID_ROWS } from '../data/zooCatalog';
import {
  CultivatedSpeciesRecord,
  DifficultyMode,
  KeeperInstance,
  ParkLogEntry,
  ParkStats,
  ParkTile,
  PhotoAlbumEntry,
  SeasonalEventId,
  SpeciesId,
  VisitorArchetype,
  VisitorInstance,
  WeatherType,
} from '../types/zoo';
import { recomputeConnectivity } from './parkLogic';
import { BgmTrackId } from './sound';

export type SaveSlotId = 'autosave' | 'slot_1' | 'slot_2' | 'slot_3';

export const SAVE_SLOT_ORDER: SaveSlotId[] = ['autosave', 'slot_1', 'slot_2', 'slot_3'];

export const SAVE_SLOT_DEFAULT_NAMES: Record<SaveSlotId, string> = {
  autosave: '每日自動存檔',
  slot_1: '存檔欄位 1',
  slot_2: '存檔欄位 2',
  slot_3: '存檔欄位 3',
};

const STORAGE_KEY = 'forest_ark_zoo_saves_v1';

export interface ZooSavePayload {
  version: 1;
  slotId: SaveSlotId;
  label: string;
  savedAt: number;
  difficulty: DifficultyMode;
  grid: ParkTile[][];
  funds: number;
  ticketPrice: number;
  day: number;
  tickInDay: number;
  weather: WeatherType;
  nextWeather: WeatherType;
  weatherDaysLeft: number;
  seasonalEvent: SeasonalEventId | null;
  seasonalDaysLeft: number;
  lastSeasonalEvent: SeasonalEventId | null;
  idleSeasonalDays: number;
  visitors: VisitorInstance[];
  visitorTypeCounts: Record<VisitorArchetype, number>;
  cultivatedSpecies: Partial<Record<SpeciesId, CultivatedSpeciesRecord>>;
  landmarkUnlocked: boolean;
  goldenGuideUnlocked?: boolean;
  keepers: KeeperInstance[];
  completedMilestones: string[];
  victoryDismissed: boolean;
  negativeFundDays: number;
  stats: ParkStats;
  logs: ParkLogEntry[];
  photoAlbum?: PhotoAlbumEntry[];
  bgmTrack: BgmTrackId;
  ratingSnapshot: number;
  animalCountSnapshot: number;
  speciesCountSnapshot: number;
}

export interface ZooSaveSlotSummary {
  slotId: SaveSlotId;
  label: string;
  savedAt: number;
  difficulty: DifficultyMode;
  day: number;
  funds: number;
  rating: number;
  animalCount: number;
  speciesCount: number;
}

type SaveStoreMap = Partial<Record<SaveSlotId, ZooSavePayload>>;

function readStoreMap(): SaveStoreMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as SaveStoreMap;
  } catch {
    return {};
  }
}

function writeStoreMap(map: SaveStoreMap): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

function isValidGrid(grid: unknown): grid is ParkTile[][] {
  if (!Array.isArray(grid) || grid.length !== GRID_ROWS) return false;
  return grid.every(
    (row) =>
      Array.isArray(row) &&
      row.length === GRID_COLS &&
      row.every((tile) => tile && typeof tile === 'object' && typeof tile.type === 'string')
  );
}

export function listSaveSlots(): ZooSaveSlotSummary[] {
  const store = readStoreMap();
  const summaries: ZooSaveSlotSummary[] = [];

  for (const slotId of SAVE_SLOT_ORDER) {
    const entry = store[slotId];
    if (!entry || entry.version !== 1 || !isValidGrid(entry.grid)) continue;
    summaries.push({
      slotId,
      label: entry.label || SAVE_SLOT_DEFAULT_NAMES[slotId],
      savedAt: entry.savedAt,
      difficulty: entry.difficulty ?? 'standard',
      day: entry.day ?? 1,
      funds: entry.funds ?? 0,
      rating: typeof entry.ratingSnapshot === 'number' ? entry.ratingSnapshot : 1.0,
      animalCount: typeof entry.animalCountSnapshot === 'number' ? entry.animalCountSnapshot : 0,
      speciesCount: typeof entry.speciesCountSnapshot === 'number' ? entry.speciesCountSnapshot : 0,
    });
  }

  return summaries;
}

export function getLatestSaveSummary(): ZooSaveSlotSummary | null {
  const slots = listSaveSlots();
  if (slots.length === 0) return null;
  return slots.reduce((latest, cur) => (cur.savedAt > latest.savedAt ? cur : latest), slots[0]);
}

export function saveZooToSlot(
  slotId: SaveSlotId,
  payload: Omit<ZooSavePayload, 'version' | 'slotId' | 'savedAt'>
): boolean {
  const store = readStoreMap();
  const cappedPhotos = Array.isArray(payload.photoAlbum) ? payload.photoAlbum.slice(0, 28) : [];
  const record: ZooSavePayload = {
    ...payload,
    photoAlbum: cappedPhotos,
    version: 1,
    slotId,
    savedAt: Date.now(),
  };
  store[slotId] = record;
  if (writeStoreMap(store)) return true;

  // Retry with fewer thumbnails if localStorage quota is tight
  store[slotId] = {
    ...record,
    photoAlbum: cappedPhotos.slice(0, 10),
  };
  if (writeStoreMap(store)) return true;

  store[slotId] = {
    ...record,
    photoAlbum: [],
  };
  return writeStoreMap(store);
}

export function loadZooFromSlot(slotId: SaveSlotId): ZooSavePayload | null {
  const store = readStoreMap();
  const entry = store[slotId];
  if (!entry || entry.version !== 1 || !isValidGrid(entry.grid)) {
    return null;
  }

  return {
    ...entry,
    grid: recomputeConnectivity(entry.grid),
    visitors: Array.isArray(entry.visitors)
      ? entry.visitors.map((v) => ({ ...v, thought: '', thoughtTicks: 0 }))
      : [],
    keepers: Array.isArray(entry.keepers) ? entry.keepers : [],
    completedMilestones: Array.isArray(entry.completedMilestones) ? entry.completedMilestones : [],
    logs: Array.isArray(entry.logs) ? entry.logs : [],
    photoAlbum: Array.isArray(entry.photoAlbum) ? entry.photoAlbum : [],
  };
}

export function deleteSaveSlot(slotId: SaveSlotId): void {
  const store = readStoreMap();
  delete store[slotId];
  writeStoreMap(store);
}

export function formatSaveTimestamp(ts: number): string {
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
