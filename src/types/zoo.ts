export type GameState = 'TITLE_MENU' | 'PLAYING' | 'GAME_OVER' | 'VICTORY';

export type DifficultyMode = 'standard' | 'sandbox' | 'challenge';

export type BiomeType = 'savanna' | 'bamboo' | 'arctic' | 'rainforest';

export type WeatherType = 'sunny' | 'breezy' | 'rainy' | 'heatwave';

export interface WeatherSpec {
  id: WeatherType;
  name: string;
  shortDesc: string;
  visitorSpawnMultiplier: number;
  visitorMoodDelta: number;
  hungerDecayMultiplier: number;
  cleanDecayMultiplier: number;
  ratingModifier: number;
  careTip: string;
}

export type SeasonalEventId =
  | 'spring_sakura'
  | 'summer_lantern'
  | 'autumn_maple'
  | 'winter_snow';

export interface SeasonalEventSpec {
  id: SeasonalEventId;
  name: string;
  seasonLabel: string;
  shortDesc: string;
  tileEffectDesc: string;
  boostedArchetypes: VisitorArchetype[];
  spawnMultiplier: number;
  visitorMoodDelta: number;
  accentColor: string;
}

export type FloorType = 'stone' | 'brick' | 'wood' | 'gravel' | 'asphalt';

export type TileType =
  | 'grass'
  | 'path'
  | 'habitat'
  | 'snack'
  | 'bench'
  | 'garden'
  | 'souvenir'
  | 'fountain'
  | 'restroom'
  | 'pavilion'
  | 'landmark'
  | 'gate';

export type SpeciesId =
  | 'lion'
  | 'tiger'
  | 'cheetah'
  | 'giraffe'
  | 'zebra'
  | 'elephant'
  | 'hippo'
  | 'meerkat'
  | 'kangaroo'
  | 'panda'
  | 'red_panda'
  | 'koala'
  | 'peacock'
  | 'penguin'
  | 'seal'
  | 'polar_bear'
  | 'capybara'
  | 'otter'
  | 'toucan'
  | 'flamingo';

export type BuildTool =
  | 'select'
  | `floor_${FloorType}`
  | 'snack'
  | 'bench'
  | 'garden'
  | 'souvenir'
  | 'fountain'
  | 'restroom'
  | 'pavilion'
  | 'landmark'
  | 'demolish'
  | `zone_${SpeciesId}`;

export interface AnimalSpeciesSpec {
  id: SpeciesId;
  name: string;
  zoneName: string;
  zoneShortName: string;
  biome: BiomeType;
  buildCost: number;
  upgradeCost: number;
  cost: number;
  appeal: number;
  dailyUpkeep: number;
  groundColor: string;
  fenceColor: string;
  accentColor: string;
  description: string;
  favoriteFood: string;
}

export interface BiomeSpec {
  id: BiomeType;
  name: string;
  shortName: string;
  imagePath: string;
  groundColor: string;
  accentColor: string;
  fenceColor: string;
}

export type AnimalGrowthStage = 'juvenile' | 'growing' | 'mature' | 'prime';

export type AnimalWeatherBehavior =
  | 'shelter_pavilion'
  | 'cool_sprinkler'
  | 'cool_pool'
  | 'rain_splash'
  | 'sun_bask';

export interface CultivatedSpeciesRecord {
  speciesId: SpeciesId;
  firstCultivatedDay: number;
  totalRaised: number;
  peakGrowthPoints: number;
  peakStage: AnimalGrowthStage;
  lastSatisfaction: number;
}

export interface AnimalInstance {
  id: string;
  speciesId: SpeciesId;
  name: string;
  hunger: number; // 0 to 100 (100 = full)
  happiness: number; // 0 to 100
  localX: number; // 0.18 to 0.82 within tile
  localY: number; // 0.22 to 0.78 within tile
  targetX: number;
  targetY: number;
  facingLeft: boolean;
  isResting?: boolean;
  growthPoints?: number;
  growthStage?: AnimalGrowthStage;
  weatherBehavior?: AnimalWeatherBehavior | null;
  weatherBehaviorLabel?: string;
  weatherTargetX?: number;
  weatherTargetY?: number;
}

export interface HabitatData {
  id: string;
  speciesId: SpeciesId;
  biome: BiomeType;
  level: 1 | 2 | 3;
  cleanliness: number; // 0 to 100
  enrichmentBoost: number; // 0 to 30 temporary happiness boost
  animals: AnimalInstance[];
  autoFeeder?: boolean;
  autoFeederEnabled?: boolean;
  autoCleaner?: boolean;
  autoCleanerEnabled?: boolean;
}

export interface ParkTile {
  x: number;
  y: number;
  type: TileType;
  floorType?: FloorType;
  habitat?: HabitatData;
  connected: boolean;
  gardenBoost: number; // count of adjacent gardens
}

export type VisitorArchetype =
  | 'explorer'
  | 'photographer'
  | 'child'
  | 'elder'
  | 'tourist'
  | 'student'
  | 'couple'
  | 'artist'
  | 'researcher'
  | 'runner'
  | 'foodie'
  | 'vip';

export interface VisitorDestinationPlan {
  label: string;
  tileType: TileType;
  x: number;
  y: number;
  walkTileX: number;
  walkTileY: number;
  reason: string;
  speciesId?: SpeciesId;
}

export interface VisitorInstance {
  id: string;
  name: string;
  archetype: VisitorArchetype;
  archetypeLabel: string;
  x: number; // grid coordinate float
  y: number;
  targetX: number;
  targetY: number;
  energy: number; // 0 to 100
  mood: number; // 0 to 100
  hunger: number; // 0 to 100 (higher = hungrier)
  thought: string;
  thoughtTicks?: number;
  color: string;
  skinColor: string;
  stayTicks: number;
  hasBoughtSnack: boolean;
  hasBoughtSouvenir?: boolean;
  photoPauseTicks?: number;
  photoCooldownTicks?: number;
  stargazeTarget?: { x: number; y: number } | null;
  stargazeSeekTicks?: number;
  stargazePauseTicks?: number;
  stargazeCooldownTicks?: number;
  plannedDestination?: VisitorDestinationPlan | null;
  destinationSeekTicks?: number;
  guidedCooldownTicks?: number;
}

export type StaffRole = 'keeper' | 'cleaner';

export interface KeeperInstance {
  id: string;
  role: StaffRole;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  taskLabel: string;
  cooldownTicks: number;
}

export interface FloatingPopup {
  id: string;
  x: number; // grid coordinate
  y: number;
  text: string;
  tone: 'gold' | 'green' | 'amber' | 'rose';
}

export interface MilestoneSpec {
  id: string;
  title: string;
  description: string;
  reward: number;
  targetValue: number;
  type: 'animals' | 'species' | 'visitors' | 'rating' | 'habitats' | 'visitor_types';
}

export interface ParkLogEntry {
  id: string;
  day: number;
  message: string;
  tone: 'info' | 'success' | 'warning';
}

export interface ParkStats {
  totalVisitors: number;
  peakFunds: number;
  daysSurvived: number;
  dailyRevenue: number;
  lastDayRevenue?: number;
  dailyExpenses: number;
}

export interface PhotoAlbumEntry {
  id: string;
  day: number;
  isNight: boolean;
  weather: WeatherType;
  seasonalEvent: SeasonalEventId | null;
  speciesId: SpeciesId;
  speciesName: string;
  animalId: string;
  animalName: string;
  visitorId: string;
  visitorName: string;
  visitorArchetype: VisitorArchetype;
  visitorArchetypeLabel: string;
  partnerVisitorName?: string;
  visitorMood: number;
  commentary: string;
  thumbnailDataUrl: string;
  tileX: number;
  tileY: number;
  habitatX: number;
  habitatY: number;
  capturedAt: number;
}

export interface PendingPhotoCapture {
  id: string;
  visitorId: string;
  partnerVisitorId?: string;
  animalId: string;
  speciesId: SpeciesId;
  tileX: number;
  tileY: number;
  habitatX: number;
  habitatY: number;
}
