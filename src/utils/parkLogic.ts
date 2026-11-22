import {
  ANIMAL_NICKNAMES,
  ANIMAL_SPECIES,
  FACILITY_COSTS,
  GATE_POS,
  GRID_COLS,
  GRID_ROWS,
  SEASONAL_EVENT_IDS,
  VISITOR_ARCHETYPES,
  VISITOR_ARCHETYPE_IDS,
  VISITOR_NAMES,
  WEATHERS,
} from '../data/zooCatalog';
import {
  AnimalGrowthStage,
  AnimalInstance,
  BiomeType,
  CultivatedSpeciesRecord,
  DifficultyMode,
  ParkTile,
  SeasonalEventId,
  SpeciesId,
  VisitorArchetype,
  VisitorDestinationPlan,
  VisitorInstance,
  WeatherType,
} from '../types/zoo';

let uidCounter = 1;
export function nextId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter}`;
}

export const ANIMAL_GROWTH_STAGES: Array<{
  stage: AnimalGrowthStage;
  tier: number;
  label: string;
  shortLabel: string;
  minPoints: number;
  appealBonus: number;
}> = [
  { stage: 'juvenile', tier: 1, label: '一階 · 幼年期', shortLabel: '幼年期', minPoints: 0, appealBonus: 0 },
  { stage: 'growing', tier: 2, label: '二階 · 成長期', shortLabel: '成長期', minPoints: 80, appealBonus: 3 },
  { stage: 'mature', tier: 3, label: '三階 · 成熟期', shortLabel: '成熟期', minPoints: 200, appealBonus: 7 },
  { stage: 'prime', tier: 4, label: '四階 · 典範期', shortLabel: '典範期', minPoints: 360, appealBonus: 12 },
];

export function getAnimalGrowthInfo(growthPoints = 0) {
  let currentIdx = 0;
  for (let i = ANIMAL_GROWTH_STAGES.length - 1; i >= 0; i--) {
    if (growthPoints >= ANIMAL_GROWTH_STAGES[i].minPoints) {
      currentIdx = i;
      break;
    }
  }
  const current = ANIMAL_GROWTH_STAGES[currentIdx];
  const next = ANIMAL_GROWTH_STAGES[currentIdx + 1] ?? null;
  const progressPct = next
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(((growthPoints - current.minPoints) / (next.minPoints - current.minPoints)) * 100)
        )
      )
    : 100;

  return {
    ...current,
    growthPoints,
    nextStageLabel: next ? next.shortLabel : null,
    nextMinPoints: next ? next.minPoints : current.minPoints,
    progressPct,
    isMax: next === null,
  };
}

export function getSpeciesSatisfactionInfo(score: number): {
  grade: 'S' | 'A' | 'B' | 'C';
  label: string;
  tone: 'emerald' | 'sky' | 'amber' | 'rose';
} {
  if (score >= 88) return { grade: 'S', label: '極佳', tone: 'emerald' };
  if (score >= 72) return { grade: 'A', label: '良好', tone: 'sky' };
  if (score >= 52) return { grade: 'B', label: '普通', tone: 'amber' };
  return { grade: 'C', label: '待加強', tone: 'rose' };
}

export function collectInitialCultivatedSpecies(
  grid: ParkTile[][]
): Partial<Record<SpeciesId, CultivatedSpeciesRecord>> {
  const records: Partial<Record<SpeciesId, CultivatedSpeciesRecord>> = {};
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const hab = grid[y][x].habitat;
      if (!hab) continue;
      for (const ani of hab.animals) {
        const pts = ani.growthPoints ?? 0;
        const stage = getAnimalGrowthInfo(pts).stage;
        const sat = Math.round((ani.hunger + ani.happiness + hab.cleanliness) / 3);
        const existing = records[ani.speciesId];
        if (!existing) {
          records[ani.speciesId] = {
            speciesId: ani.speciesId,
            firstCultivatedDay: 1,
            totalRaised: 1,
            peakGrowthPoints: pts,
            peakStage: stage,
            lastSatisfaction: sat,
          };
        } else {
          existing.totalRaised += 1;
          if (pts > existing.peakGrowthPoints) {
            existing.peakGrowthPoints = pts;
            existing.peakStage = stage;
          }
          existing.lastSatisfaction = Math.round((existing.lastSatisfaction + sat) / 2);
        }
      }
    }
  }
  return records;
}

export function createAnimalInstance(speciesId: SpeciesId): AnimalInstance {
  const nickname = ANIMAL_NICKNAMES[Math.floor(Math.random() * ANIMAL_NICKNAMES.length)];
  const lx = 0.25 + Math.random() * 0.5;
  const ly = 0.28 + Math.random() * 0.44;
  return {
    id: nextId('ani'),
    speciesId,
    name: nickname,
    hunger: 88,
    happiness: 90,
    localX: lx,
    localY: ly,
    targetX: lx,
    targetY: ly,
    facingLeft: Math.random() > 0.5,
    growthPoints: 0,
    growthStage: 'juvenile',
  };
}

export function createVisitorInstance(
  x: number,
  y: number,
  existingNames?: Set<string>,
  boostedArchetypes?: VisitorArchetype[]
): VisitorInstance {
  const useBoosted =
    boostedArchetypes && boostedArchetypes.length > 0 && Math.random() < 0.62;
  const archetype = useBoosted
    ? boostedArchetypes[Math.floor(Math.random() * boostedArchetypes.length)]
    : VISITOR_ARCHETYPE_IDS[Math.floor(Math.random() * VISITOR_ARCHETYPE_IDS.length)];
  const spec = VISITOR_ARCHETYPES[archetype];
  const color = spec.colors[Math.floor(Math.random() * spec.colors.length)];
  const skinColor = spec.skinColors[Math.floor(Math.random() * spec.skinColors.length)];
  const availableNames =
    existingNames && existingNames.size > 0
      ? VISITOR_NAMES.filter((n) => !existingNames.has(n))
      : VISITOR_NAMES;
  const namePool = availableNames.length > 0 ? availableNames : VISITOR_NAMES;
  const name = namePool[Math.floor(Math.random() * namePool.length)];

  return {
    id: nextId('vis'),
    name,
    archetype,
    archetypeLabel: spec.label,
    x,
    y,
    targetX: x,
    targetY: y,
    energy: 95,
    mood: 84,
    hunger: 20 + Math.random() * 25,
    thought: '',
    color,
    skinColor,
    stayTicks: 24 + Math.floor(Math.random() * 16),
    hasBoughtSnack: false,
  };
}

export function pickRandomSeasonalEvent(exclude?: SeasonalEventId | null): SeasonalEventId {
  const pool = exclude
    ? SEASONAL_EVENT_IDS.filter((id) => id !== exclude)
    : SEASONAL_EVENT_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getVisitorMoodInfo(mood: number): {
  label: string;
  tone: 'emerald' | 'sky' | 'amber' | 'rose';
} {
  if (mood >= 85) return { label: '超開心', tone: 'emerald' };
  if (mood >= 68) return { label: '心情愉悅', tone: 'sky' };
  if (mood >= 48) return { label: '情緒普通', tone: 'amber' };
  return { label: '有點煩躁', tone: 'rose' };
}

export function getTileFacilityLabel(tile: ParkTile): string {
  if (tile.type === 'habitat' && tile.habitat) {
    return ANIMAL_SPECIES[tile.habitat.speciesId].zoneName;
  }
  switch (tile.type) {
    case 'snack':
      return '園區輕食攤位';
    case 'bench':
      return '樹蔭休憩長椅';
    case 'garden':
      return '景觀花圃';
    case 'souvenir':
      return '動物紀念品店';
    case 'fountain':
      return '噴泉廣場';
    case 'restroom':
      return '園區洗手間';
    case 'pavilion':
      return '觀景涼亭';
    case 'landmark':
      return '金色導覽地標';
    case 'gate':
      return '園區入口大門';
    default:
      return '園區設施';
  }
}

export function pickVisitorDestinationPlan(
  visitor: VisitorInstance,
  grid: ParkTile[][],
  weather: WeatherType,
  isNight: boolean,
  excludePos?: { x: number; y: number }
): VisitorDestinationPlan | null {
  const vx = Math.round(visitor.x);
  const vy = Math.round(visitor.y);

  interface Candidate {
    plan: VisitorDestinationPlan;
    weight: number;
    isCurrentAdjacent: boolean;
  }
  const candidates: Candidate[] = [];

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const tile = grid[y][x];
      if (!tile.connected) continue;
      if (excludePos && excludePos.x === x && excludePos.y === y) continue;

      const isTargetType =
        tile.type === 'habitat' ||
        tile.type === 'snack' ||
        tile.type === 'souvenir' ||
        tile.type === 'fountain' ||
        tile.type === 'restroom' ||
        tile.type === 'pavilion' ||
        tile.type === 'bench' ||
        tile.type === 'landmark';
      if (!isTargetType) continue;

      const walkSpot = findNearestPathTileAdjacentTo(grid, x, y);
      if (!walkSpot) continue;

      const label = getTileFacilityLabel(tile);
      const isCurrentAdjacent = Math.abs(x - vx) + Math.abs(y - vy) <= 1;
      let weight = 1;
      let reason = `想散步逛去「${label}」看看`;

      if (tile.type === 'habitat' && tile.habitat) {
        const spec = ANIMAL_SPECIES[tile.habitat.speciesId];
        const animalCount = tile.habitat.animals.length;
        if (animalCount === 0) {
          weight = 0.35;
          reason = `好奇去看看「${label}」的生態佈置`;
        } else {
          weight = 3.2 + animalCount * 0.8 + (tile.habitat.level - 1) * 0.6;
          if (visitor.archetype === 'photographer' || visitor.archetype === 'couple') {
            weight *= 1.35;
            reason = `想近距離拍攝「${spec.name}」可愛模樣`;
          } else if (visitor.archetype === 'researcher' || visitor.archetype === 'artist') {
            weight *= 1.3;
            reason = `想仔細觀察「${spec.name}」的生態習性`;
          } else if (weather === 'rainy' && tile.habitat.biome === 'rainforest') {
            weight *= 1.3;
            reason = `想看雨林區的「${spec.name}」在雨中的模樣`;
          } else if (isNight) {
            reason = `想趁夜色聚光燈欣賞「${spec.name}」`;
          } else {
            reason = `想去「${label}」看${spec.name}互動`;
          }
        }
      } else if (tile.type === 'snack') {
        if (visitor.hasBoughtSnack) {
          weight = 0.25;
        } else {
          weight = visitor.hunger > 45 ? 4.8 : visitor.archetype === 'foodie' ? 4.2 : 1.6;
        }
        if (weather === 'heatwave') {
          weight *= 1.35;
          reason = '想買點心與冰飲消暑解渴';
        } else if (isNight) {
          reason = '想買熱食暖胃繼續夜遊';
        } else {
          reason = '嘴饞了，想去買園區限定輕食';
        }
      } else if (tile.type === 'souvenir') {
        weight = visitor.hasBoughtSouvenir
          ? 0.3
          : visitor.archetype === 'tourist' || visitor.archetype === 'vip'
          ? 3.8
          : 1.9;
        reason = '想挑幾個可愛的動物周邊紀念品';
      } else if (tile.type === 'fountain') {
        weight = weather === 'heatwave' ? 3.8 : isNight ? 2.8 : 1.7;
        reason =
          weather === 'heatwave'
            ? '想去噴泉水霧旁吹風降溫'
            : isNight
            ? '想欣賞夜晚的噴泉燈光造景'
            : '想去噴泉廣場吹吹風放鬆一下';
      } else if (tile.type === 'pavilion') {
        weight =
          weather === 'rainy' || weather === 'heatwave'
            ? 4.0
            : visitor.energy < 65
            ? 3.2
            : 1.4;
        reason =
          weather === 'rainy'
            ? '想去觀景涼亭稍微避雨歇息'
            : weather === 'heatwave'
            ? '想去涼亭遮陽納涼喘口氣'
            : '想在觀景涼亭小憩欣賞風景';
      } else if (tile.type === 'bench') {
        weight = visitor.energy < 62 ? 3.5 : 0.9;
        reason = '走累了，想找張樹蔭長椅坐下休息';
      } else if (tile.type === 'restroom') {
        weight = visitor.energy < 75 ? 1.8 : 1.1;
        reason = '想去洗手間整理一下儀容再繼續逛';
      } else if (tile.type === 'landmark') {
        weight = visitor.archetype === 'photographer' || visitor.archetype === 'tourist' ? 3.6 : 2.3;
        reason = '想去金色導覽地標前打卡留念';
      }

      candidates.push({
        plan: {
          label,
          tileType: tile.type,
          x,
          y,
          walkTileX: walkSpot[0],
          walkTileY: walkSpot[1],
          reason,
          speciesId: tile.habitat?.speciesId,
        },
        weight: Math.max(0.1, weight),
        isCurrentAdjacent,
      });
    }
  }

  if (candidates.length === 0) return null;
  const nonAdjacent = candidates.filter((c) => !c.isCurrentAdjacent);
  const pool = nonAdjacent.length > 0 ? nonAdjacent : candidates;
  const totalWeight = pool.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c.plan;
  }
  return pool[pool.length - 1].plan;
}

export function createInitialGrid(mode: DifficultyMode): ParkTile[][] {
  const grid: ParkTile[][] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    const row: ParkTile[] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      row.push({
        x,
        y,
        type: 'grass',
        connected: false,
        gardenBoost: 0,
      });
    }
    grid.push(row);
  }

  // Entrance gate at bottom center with modern asphalt entrance plaza
  grid[GATE_POS.y][GATE_POS.x].type = 'gate';
  grid[GATE_POS.y][GATE_POS.x].floorType = 'asphalt';

  const starterFloors: Array<[number, number, ParkTile['floorType']]> = [
    [3, 7, 'asphalt'],
    [5, 7, 'asphalt'],
    [4, 6, 'brick'],
    [4, 5, 'brick'],
    [4, 4, 'stone'],
    [3, 5, 'stone'],
    [5, 5, 'wood'],
  ];
  for (const [px, py, fType] of starterFloors) {
    grid[py][px].type = 'path';
    grid[py][px].floorType = fType;
  }

  // Starter Lion Rock & Grass Exhibit (left of main plaza, matching reference)
  grid[4][3] = {
    x: 3,
    y: 4,
    type: 'habitat',
    connected: true,
    gardenBoost: 0,
    habitat: {
      id: nextId('hab'),
      speciesId: 'lion',
      biome: 'savanna',
      level: 1,
      cleanliness: 94,
      enrichmentBoost: 12,
      animals: [createAnimalInstance('lion')],
    },
  };

  // Starter Panda Bamboo Exhibit (right of main plaza, matching reference)
  grid[4][5] = {
    x: 5,
    y: 4,
    type: 'habitat',
    connected: true,
    gardenBoost: 0,
    habitat: {
      id: nextId('hab'),
      speciesId: 'panda',
      biome: 'bamboo',
      level: 1,
      cleanliness: 96,
      enrichmentBoost: 12,
      animals: [createAnimalInstance('panda'), ...(mode === 'sandbox' ? [createAnimalInstance('panda')] : [])],
    },
  };

  if (mode === 'sandbox') {
    grid[3][4] = {
      x: 4,
      y: 3,
      type: 'habitat',
      connected: true,
      gardenBoost: 0,
      habitat: {
        id: nextId('hab'),
        speciesId: 'giraffe',
        biome: 'savanna',
        level: 1,
        cleanliness: 95,
        enrichmentBoost: 10,
        animals: [createAnimalInstance('giraffe')],
      },
    };
  }

  // Starter bench for visitors
  grid[6][5].type = 'bench';

  return recomputeConnectivity(grid);
}

export function recomputeConnectivity(grid: ParkTile[][]): ParkTile[][] {
  const next = grid.map((row) =>
    row.map((tile) => ({
      ...tile,
      connected: false,
      gardenBoost: 0,
    }))
  );

  // Compute garden & landmark adjacency boosts
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const tileType = next[y][x].type;
      if (tileType === 'garden' || tileType === 'landmark' || tileType === 'fountain') {
        const boostAmount = tileType === 'landmark' || tileType === 'fountain' ? 2 : 1;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
            next[ny][nx].gardenBoost += boostAmount;
          }
        }
      }
    }
  }

  // BFS from gate through 'path' tiles to mark connected paths, habitats, and park facilities
  const visitedPaths = new Set<string>();
  const queue: Array<[number, number]> = [[GATE_POS.x, GATE_POS.y]];
  visitedPaths.add(`${GATE_POS.x},${GATE_POS.y}`);
  next[GATE_POS.y][GATE_POS.x].connected = true;

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;

      const neighbor = next[ny][nx];
      const key = `${nx},${ny}`;
      if (neighbor.type === 'path') {
        if (!visitedPaths.has(key)) {
          visitedPaths.add(key);
          neighbor.connected = true;
          queue.push([nx, ny]);
        }
      } else if (
        neighbor.type === 'habitat' ||
        neighbor.type === 'snack' ||
        neighbor.type === 'bench' ||
        neighbor.type === 'garden' ||
        neighbor.type === 'souvenir' ||
        neighbor.type === 'fountain' ||
        neighbor.type === 'restroom' ||
        neighbor.type === 'pavilion' ||
        neighbor.type === 'landmark'
      ) {
        neighbor.connected = true;
      }
    }
  }

  return next;
}

export function getHabitatCapacity(level: 1 | 2 | 3): number {
  return level + 1; // Lv1: 2, Lv2: 3, Lv3: 4
}

export function pickNextWeather(exclude?: WeatherType): WeatherType {
  const options: WeatherType[] = ['sunny', 'breezy', 'rainy', 'heatwave'];
  const filtered = exclude ? options.filter((w) => w !== exclude) : options;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export function computeParkMetrics(
  grid: ParkTile[][],
  ticketPrice: number,
  weather: WeatherType = 'sunny',
  avgVisitorMood = 82,
  goldenGuideUnlocked = false
) {
  let totalAppeal = 0;
  let habitatCount = 0;
  let connectedHabitats = 0;
  let totalAnimals = 0;
  const uniqueSpecies = new Set<SpeciesId>();
  let totalWelfare = 0;
  let snackCount = 0;
  let benchCount = 0;
  let souvenirCount = 0;
  let fountainCount = 0;
  let restroomCount = 0;
  let pavilionCount = 0;
  let landmarkCount = 0;

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const tile = grid[y][x];
      if (tile.type === 'snack' && tile.connected) snackCount += 1;
      if (tile.type === 'bench' && tile.connected) benchCount += 1;
      if (tile.type === 'souvenir' && tile.connected) {
        souvenirCount += 1;
        totalAppeal += 10;
      }
      if (tile.type === 'fountain' && tile.connected) {
        fountainCount += 1;
        totalAppeal += 12;
      }
      if (tile.type === 'restroom' && tile.connected) {
        restroomCount += 1;
        totalAppeal += 5;
      }
      if (tile.type === 'pavilion' && tile.connected) {
        pavilionCount += 1;
        totalAppeal += 7;
      }
      if (tile.type === 'landmark' && tile.connected) {
        landmarkCount += 1;
        totalAppeal += FACILITY_COSTS.landmarkAppeal;
      }
      if (tile.type === 'habitat' && tile.habitat) {
        habitatCount += 1;
        const hab = tile.habitat;
        if (tile.connected) connectedHabitats += 1;

        const levelMultiplier = 1 + (hab.level - 1) * 0.25;
        const gardenMultiplier = 1 + Math.min(tile.gardenBoost, 3) * 0.15;

        for (const ani of hab.animals) {
          totalAnimals += 1;
          uniqueSpecies.add(ani.speciesId);
          const spec = ANIMAL_SPECIES[ani.speciesId];
          const welfare = (ani.hunger + ani.happiness + hab.cleanliness) / 3;
          totalWelfare += welfare;

          if (tile.connected) {
            const welfareFactor = 0.5 + (welfare / 100) * 0.7;
            const growthBonus = getAnimalGrowthInfo(ani.growthPoints ?? 0).appealBonus;
            totalAppeal += (spec.appeal + growthBonus) * levelMultiplier * gardenMultiplier * welfareFactor;
          }
        }
      }
    }
  }

  const weatherSpec = WEATHERS[weather];
  const avgWelfare = totalAnimals > 0 ? totalWelfare / totalAnimals : 75;
  const diversityBonus = uniqueSpecies.size * 0.25;
  const amenityBonus = Math.min(
    0.58,
    snackCount * 0.1 +
      benchCount * 0.07 +
      restroomCount * 0.12 +
      pavilionCount * 0.09 +
      souvenirCount * 0.08 +
      fountainCount * 0.08
  );
  const landmarkBonus = Math.min(0.3, landmarkCount * 0.15);
  const guideServiceBonus = goldenGuideUnlocked ? 0.08 : 0;
  const pricePenalty = ticketPrice > 25 ? Math.max(0, (ticketPrice - 25) * 0.03) : 0;
  const moodBonus = ((avgVisitorMood - 75) / 100) * 0.45;
  const weatherMitigation =
    weatherSpec.ratingModifier < 0
      ? Math.min(0.16, snackCount * 0.04 + benchCount * 0.03 + pavilionCount * 0.06 + fountainCount * 0.04)
      : 0;

  const rawRating =
    1.2 +
    Math.min(2.1, totalAppeal / 95) +
    (avgWelfare / 100) * 1.15 +
    diversityBonus +
    amenityBonus +
    landmarkBonus +
    guideServiceBonus +
    moodBonus +
    weatherSpec.ratingModifier +
    weatherMitigation -
    pricePenalty;

  const rating = Math.max(1.0, Math.min(5.0, Number(rawRating.toFixed(1))));

  const baseVisitors =
    connectedHabitats * 2 + totalAppeal / 18 - Math.max(0, ticketPrice - 22) * 0.3;
  const targetVisitors = Math.min(
    28,
    Math.max(2, Math.floor(baseVisitors * weatherSpec.visitorSpawnMultiplier))
  );

  return {
    totalAppeal: Math.round(totalAppeal),
    habitatCount,
    connectedHabitats,
    totalAnimals,
    uniqueSpeciesCount: uniqueSpecies.size,
    avgWelfare: Math.round(avgWelfare),
    rating,
    targetVisitors,
    snackCount,
    benchCount,
    souvenirCount,
    fountainCount,
    restroomCount,
    pavilionCount,
    landmarkCount,
  };
}

export function getWalkableNeighbors(
  grid: ParkTile[][],
  x: number,
  y: number
): Array<[number, number]> {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const result: Array<[number, number]> = [];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
      const t = grid[ny][nx].type;
      if (t === 'path' || t === 'gate') {
        result.push([nx, ny]);
      }
    }
  }
  return result;
}

export function findNearestPathTileAdjacentTo(
  grid: ParkTile[][],
  tx: number,
  ty: number
): [number, number] | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
  ];
  for (const [dx, dy] of dirs) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (
      nx >= 0 &&
      nx < GRID_COLS &&
      ny >= 0 &&
      ny < GRID_ROWS &&
      (grid[ny][nx].type === 'path' || grid[ny][nx].type === 'gate') &&
      grid[ny][nx].connected
    ) {
      return [nx, ny];
    }
  }
  return null;
}

export function getBiomeLabel(biome: BiomeType): string {
  switch (biome) {
    case 'savanna':
      return '草原生態';
    case 'bamboo':
      return '竹林生態';
    case 'arctic':
      return '冰原生態';
    case 'rainforest':
      return '雨林生態';
  }
}

export type HabitatVegetationTier = 0 | 1 | 2 | 3 | 4;

export function getHabitatVegetationInfo(
  biome: BiomeType,
  animals: Array<{ happiness: number }>
): {
  tier: HabitatVegetationTier;
  score: number;
  avgHappiness: number;
  label: string;
  detail: string;
  tone: 'stone' | 'amber' | 'teal' | 'emerald' | 'sky';
} {
  const count = animals.length;
  if (count === 0) {
    return {
      tier: 0,
      score: 0,
      avgHappiness: 0,
      label: biome === 'arctic' ? '休耕雪地 Lv.0' : '基礎地表 Lv.0',
      detail: '尚未引進動物，引進並提升幸福度後將長出豐富植被與花紋。',
      tone: 'stone',
    };
  }

  const avgHappiness = animals.reduce((sum, a) => sum + a.happiness, 0) / count;
  const score = Math.round(Math.min(100, avgHappiness * 0.72 + Math.min(count, 4) * 7.5));

  let tier: HabitatVegetationTier = 1;
  if (score >= 86) tier = 4;
  else if (score >= 72) tier = 3;
  else if (score >= 54) tier = 2;

  if (biome === 'arctic') {
    const arcticMap: Record<
      1 | 2 | 3 | 4,
      { label: string; detail: string; tone: 'amber' | 'sky' | 'teal' }
    > = {
      1: {
        label: '微霜初現 Lv.1',
        detail: '動物數量較少或幸福度偏低，地面僅見零星薄霜。',
        tone: 'amber',
      },
      2: {
        label: '雪紋初綻 Lv.2',
        detail: '雪地開始浮現精緻積雪花紋與細碎雪堆。',
        tone: 'sky',
      },
      3: {
        label: '晶瑩雪花 Lv.3',
        detail: '棲地狀態良好，地面綻放多組積雪花紋與冰晶柱。',
        tone: 'sky',
      },
      4: {
        label: '極地冰晶花境 Lv.4',
        detail: '動物群居且幸福度極佳，冰原鋪滿繁複積雪花紋與冰晶簇！',
        tone: 'teal',
      },
    };
    return { tier, score, avgHappiness, ...arcticMap[tier] };
  }

  if (biome === 'savanna') {
    const savannaMap: Record<
      1 | 2 | 3 | 4,
      { label: string; detail: string; tone: 'amber' | 'teal' | 'emerald' }
    > = {
      1: {
        label: '稀疏嫩芽 Lv.1',
        detail: '邊角冒出少許草原草芽，提升動物數量與幸福度可促進生長。',
        tone: 'amber',
      },
      2: {
        label: '草原草叢 Lv.2',
        detail: '圍欄周邊長出金綠草原草叢，立柱開始攀附綠藤。',
        tone: 'teal',
      },
      3: {
        label: '茂密草境 Lv.3',
        detail: '棲地健康蓬勃，厚實草叢、野花與藤蔓沿著圍欄蔓延。',
        tone: 'emerald',
      },
      4: {
        label: '豐饒大草原 Lv.4',
        detail: '動物數量與幸福度極佳，茂密草叢與開花藤蔓環繞全區！',
        tone: 'emerald',
      },
    };
    return { tier, score, avgHappiness, ...savannaMap[tier] };
  }

  const lushMap: Record<
    1 | 2 | 3 | 4,
    { label: string; detail: string; tone: 'amber' | 'teal' | 'emerald' }
  > = {
    1: {
      label: '初生蕨芽 Lv.1',
      detail: '棲地邊緣長出少許嫩綠草芽，持續照顧可孕育更多植披。',
      tone: 'amber',
    },
    2: {
      label: '青翠灌叢 Lv.2',
      detail: '周邊長出青翠草叢與初生攀爬藤蔓，展現穩定生機。',
      tone: 'teal',
    },
    3: {
      label: '茂密藤蔓 Lv.3',
      detail: '棲地健康度優良，層疊草叢與藤蔓沿著欄杆攀附生長。',
      tone: 'emerald',
    },
    4: {
      label: '繁盛生態秘境 Lv.4',
      detail: '動物數量與幸福度極佳，茂密草叢與開花藤蔓滿布園區！',
      tone: 'emerald',
    },
  };
  return { tier, score, avgHappiness, ...lushMap[tier] };
}

