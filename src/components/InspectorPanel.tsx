import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Utensils,
  Sparkles,
  SmilePlus,
  ArrowUpCircle,
  Plus,
  UserCheck,
  Target,
  CheckCircle2,
  Ticket,
  AlertTriangle,
  Sun,
  CloudRain,
  Flame,
  Wind,
  Users,
  Moon,
  Award,
  Cpu,
  Power,
  Smile,
  Meh,
  Frown,
  Volume2,
  BookOpen,
  MapPin,
  TrendingUp,
  Flower2,
  Snowflake,
  Leaf,
  Calendar,
  Sprout,
  Camera,
  Quote,
  Trash2,
  Download,
  X,
} from 'lucide-react';
import {
  ANIMAL_SPECIES,
  BIOMES,
  FACILITY_COSTS,
  MILESTONES,
  SEASONAL_EVENTS,
  SPECIES_LIST,
  VISITOR_ARCHETYPES,
  VISITOR_ARCHETYPE_IDS,
  WEATHERS,
} from '../data/zooCatalog';
import {
  BiomeType,
  CultivatedSpeciesRecord,
  KeeperInstance,
  ParkLogEntry,
  ParkTile,
  PhotoAlbumEntry,
  SeasonalEventId,
  SpeciesId,
  StaffRole,
  VisitorArchetype,
  VisitorInstance,
  WeatherType,
} from '../types/zoo';
import {
  getAnimalGrowthInfo,
  getHabitatCapacity,
  getHabitatVegetationInfo,
  getSpeciesSatisfactionInfo,
  getVisitorMoodInfo,
} from '../utils/parkLogic';
import { soundFX } from '../utils/sound';
import { AnimalSprite } from './AnimalSprite';

interface InspectorPanelProps {
  grid: ParkTile[][];
  selectedTile: ParkTile | null;
  selectedVisitorId: string | null;
  funds: number;
  ticketPrice: number;
  weather: WeatherType;
  nextWeather: WeatherType;
  weatherDaysLeft: number;
  seasonalEvent: SeasonalEventId | null;
  seasonalDaysLeft: number;
  isNight: boolean;
  avgVisitorMood: number;
  visitors: VisitorInstance[];
  visitorTypeCounts: Record<VisitorArchetype, number>;
  cultivatedSpecies: Partial<Record<SpeciesId, CultivatedSpeciesRecord>>;
  photoAlbum: PhotoAlbumEntry[];
  landmarkUnlocked: boolean;
  goldenGuideUnlocked: boolean;
  keepers: KeeperInstance[];
  completedMilestones: string[];
  logs: ParkLogEntry[];
  metrics: {
    habitatCount: number;
    connectedHabitats: number;
    totalAnimals: number;
    uniqueSpeciesCount: number;
    rating: number;
    totalAppeal: number;
    landmarkCount: number;
  };
  totalVisitors: number;
  onFeedHabitat: (x: number, y: number) => void;
  onCleanHabitat: (x: number, y: number) => void;
  onEnrichHabitat: (x: number, y: number) => void;
  onUpgradeHabitat: (x: number, y: number) => void;
  onBuyHabitatAutomation: (x: number, y: number, kind: 'feeder' | 'cleaner') => void;
  onToggleHabitatAutomation: (x: number, y: number, kind: 'feeder' | 'cleaner') => void;
  onAdoptAnimal: (x: number, y: number, speciesId: SpeciesId) => void;
  onHireStaff: (role: StaffRole) => void;
  onChangeTicketPrice: (price: number) => void;
  onSelectLandmarkTool: () => void;
  onDeletePhoto?: (photoId: string) => void;
  onSelectHabitatPos: (x: number, y: number) => void;
  onSelectVisitor: (visitorId: string | null) => void;
  onClearSelection: () => void;
}

const renderWeatherIcon = (w: WeatherType, className = 'w-4 h-4') => {
  switch (w) {
    case 'sunny':
      return <Sun className={`${className} text-amber-500`} />;
    case 'rainy':
      return <CloudRain className={`${className} text-sky-600`} />;
    case 'heatwave':
      return <Flame className={`${className} text-orange-600`} />;
    case 'breezy':
      return <Wind className={`${className} text-teal-600`} />;
  }
};

const renderSeasonalIcon = (eventId: SeasonalEventId, className = 'w-4 h-4') => {
  switch (eventId) {
    case 'spring_sakura':
      return <Flower2 className={`${className} text-rose-500`} />;
    case 'summer_lantern':
      return <Sparkles className={`${className} text-amber-500`} />;
    case 'autumn_maple':
      return <Leaf className={`${className} text-orange-600`} />;
    case 'winter_snow':
      return <Snowflake className={`${className} text-sky-600`} />;
  }
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  grid,
  selectedTile,
  selectedVisitorId,
  funds,
  ticketPrice,
  weather,
  nextWeather,
  weatherDaysLeft,
  seasonalEvent,
  seasonalDaysLeft,
  isNight,
  avgVisitorMood,
  visitors,
  visitorTypeCounts,
  cultivatedSpecies,
  photoAlbum,
  landmarkUnlocked,
  goldenGuideUnlocked,
  keepers,
  completedMilestones,
  logs,
  metrics,
  totalVisitors,
  onFeedHabitat,
  onCleanHabitat,
  onEnrichHabitat,
  onUpgradeHabitat,
  onBuyHabitatAutomation,
  onToggleHabitatAutomation,
  onAdoptAnimal,
  onHireStaff,
  onChangeTicketPrice,
  onSelectLandmarkTool,
  onDeletePhoto,
  onSelectHabitatPos,
  onSelectVisitor,
  onClearSelection,
}) => {
  const [biomeImgFailed, setBiomeImgFailed] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'inspector' | 'compendium' | 'photos'>('inspector');
  const [biomeFilter, setBiomeFilter] = useState<'all' | BiomeType>('all');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photoSpeciesFilter, setPhotoSpeciesFilter] = useState<'all' | SpeciesId>('all');
  const weatherSpec = WEATHERS[weather];
  const nextWeatherSpec = WEATHERS[nextWeather];
  const seasonalSpec = seasonalEvent ? SEASONAL_EVENTS[seasonalEvent] : null;

  const selectedVisitor = selectedVisitorId
    ? visitors.find((v) => v.id === selectedVisitorId) ?? null
    : null;

  // Switch back to detail inspector automatically when player clicks a visitor or habitat on map
  const selectionKey = selectedVisitorId
    ? `vis:${selectedVisitorId}`
    : selectedTile && selectedTile.type === 'habitat' && selectedTile.habitat
    ? `hab:${selectedTile.x},${selectedTile.y}`
    : '';
  const prevSelectionKeyRef = useRef(selectionKey);
  useEffect(() => {
    if (selectionKey && selectionKey !== prevSelectionKeyRef.current) {
      setActiveTab('inspector');
    }
    prevSelectionKeyRef.current = selectionKey;
  }, [selectionKey]);

  const compendiumData = useMemo(() => {
    const liveStats: Partial<
      Record<
        SpeciesId,
        {
          activeCount: number;
          habitatCount: number;
          firstPos: { x: number; y: number } | null;
          sumSatisfaction: number;
          maxGrowthPoints: number;
        }
      >
    > = {};

    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const tile = grid[y][x];
        if (tile.type !== 'habitat' || !tile.habitat) continue;
        const hab = tile.habitat;
        const sid = hab.speciesId;
        if (!liveStats[sid]) {
          liveStats[sid] = {
            activeCount: 0,
            habitatCount: 0,
            firstPos: { x, y },
            sumSatisfaction: 0,
            maxGrowthPoints: 0,
          };
        }
        const bucket = liveStats[sid]!;
        bucket.habitatCount += 1;
        if (!bucket.firstPos) bucket.firstPos = { x, y };
        for (const ani of hab.animals) {
          bucket.activeCount += 1;
          const sat = (ani.hunger + ani.happiness + hab.cleanliness) / 3;
          bucket.sumSatisfaction += sat;
          const pts = ani.growthPoints ?? 0;
          if (pts > bucket.maxGrowthPoints) bucket.maxGrowthPoints = pts;
        }
      }
    }

    const entries = SPECIES_LIST.filter(
      (spec) => Boolean(cultivatedSpecies[spec.id]) || (liveStats[spec.id]?.activeCount ?? 0) > 0
    ).map((spec) => {
      const live = liveStats[spec.id];
      const rec = cultivatedSpecies[spec.id];
      const activeCount = live?.activeCount ?? 0;
      const habitatCount = live?.habitatCount ?? 0;
      const totalRaised = Math.max(rec?.totalRaised ?? 0, activeCount);
      const effectiveGrowthPoints = Math.max(
        rec?.peakGrowthPoints ?? 0,
        live?.maxGrowthPoints ?? 0
      );
      const growthInfo = getAnimalGrowthInfo(effectiveGrowthPoints);
      const satisfactionPct =
        activeCount > 0 && live
          ? Math.round(live.sumSatisfaction / activeCount)
          : rec?.lastSatisfaction ?? 75;
      const satInfo = getSpeciesSatisfactionInfo(satisfactionPct);

      return {
        spec,
        biome: BIOMES[spec.biome],
        activeCount,
        habitatCount,
        totalRaised,
        firstCultivatedDay: rec?.firstCultivatedDay ?? 1,
        firstPos: live?.firstPos ?? null,
        growthInfo,
        satisfactionPct,
        satInfo,
      };
    });

    entries.sort((a, b) => {
      if (a.activeCount > 0 && b.activeCount === 0) return -1;
      if (a.activeCount === 0 && b.activeCount > 0) return 1;
      if (b.growthInfo.tier !== a.growthInfo.tier) {
        return b.growthInfo.tier - a.growthInfo.tier;
      }
      return b.satisfactionPct - a.satisfactionPct;
    });

    const totalCultivated = entries.length;
    const completionPct = Math.round((totalCultivated / SPECIES_LIST.length) * 100);
    const maturePlusCount = entries.filter((e) => e.growthInfo.tier >= 3).length;
    const primeCount = entries.filter((e) => e.growthInfo.tier === 4).length;
    const avgSatisfaction =
      totalCultivated > 0
        ? Math.round(entries.reduce((sum, e) => sum + e.satisfactionPct, 0) / totalCultivated)
        : 0;
    const overallSatInfo = getSpeciesSatisfactionInfo(avgSatisfaction);

    return {
      entries,
      totalCultivated,
      completionPct,
      maturePlusCount,
      primeCount,
      avgSatisfaction,
      overallSatInfo,
    };
  }, [cultivatedSpecies, grid]);

  const primaryTabLabel = selectedVisitor
    ? '遊客檔案'
    : selectedTile && selectedTile.type === 'habitat' && selectedTile.habitat
    ? '展區管理'
    : '園區總覽';

  const renderTabBar = () => (
    <div
      className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F4F2EC] border border-[#E2DDD3] shrink-0"
      role="tablist"
      aria-label="資訊面板分頁"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'inspector'}
        onClick={() => setActiveTab('inspector')}
        className={`min-h-[40px] lg:min-h-0 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
          activeTab === 'inspector'
            ? 'bg-white text-[#1A2B20] shadow-xs'
            : 'text-[#5B6D60] hover:text-[#1A2B20]'
        }`}
      >
        {primaryTabLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'compendium'}
        onClick={() => setActiveTab('compendium')}
        className={`min-h-[40px] lg:min-h-0 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
          activeTab === 'compendium'
            ? 'bg-white text-emerald-900 shadow-xs'
            : 'text-[#5B6D60] hover:text-[#1A2B20]'
        }`}
      >
        <BookOpen className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
        <span>生態圖鑑</span>
        <span className="font-mono-num text-[10px] text-[#5B6D60]">
          {compendiumData.totalCultivated}/{SPECIES_LIST.length}
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'photos'}
        onClick={() => setActiveTab('photos')}
        className={`min-h-[40px] lg:min-h-0 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
          activeTab === 'photos'
            ? 'bg-white text-rose-900 shadow-xs'
            : 'text-[#5B6D60] hover:text-[#1A2B20]'
        }`}
      >
        <Camera className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span>攝影圖鑑</span>
        <span className="font-mono-num text-[10px] text-[#5B6D60]">
          {photoAlbum.length}
        </span>
      </button>
    </div>
  );

  if (activeTab === 'compendium') {
    const filteredEntries =
      biomeFilter === 'all'
        ? compendiumData.entries
        : compendiumData.entries.filter((e) => e.spec.biome === biomeFilter);

    const biomeFilterOptions: Array<{ id: 'all' | BiomeType; label: string }> = [
      { id: 'all', label: `全部 (${compendiumData.entries.length})` },
      { id: 'savanna', label: '草原' },
      { id: 'bamboo', label: '竹林' },
      { id: 'arctic', label: '極地' },
      { id: 'rainforest', label: '雨林' },
    ];

    return (
      <aside className="bg-white border border-[#E2DDD3] rounded-2xl p-3.5 sm:p-4 flex flex-col gap-4 lg:h-full lg:overflow-y-auto">
        {renderTabBar()}

        {/* Achievement Statistics Overview Card */}
        <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E2DDD3] space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#1A2B20] flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                <span>園區生態培育成就</span>
              </h2>
              <p className="text-[11px] text-[#5B6D60] mt-0.5">
                統計所有已成功培育動物品種的成長階級與滿意度總評
              </p>
            </div>
            <span className="font-mono-num text-xs font-bold text-emerald-800 shrink-0">
              {compendiumData.completionPct}%
            </span>
          </div>

          <div className="h-2 bg-[#E2DDD3] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${compendiumData.completionPct}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E2DDD3] text-xs">
            <div>
              <span className="text-[11px] text-[#6A7B6F] block">已培育品種</span>
              <span className="font-mono-num font-bold text-[#1A2B20]">
                {compendiumData.totalCultivated} / {SPECIES_LIST.length}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#6A7B6F] block">成熟 / 典範</span>
              <span className="font-mono-num font-bold text-[#1A2B20]">
                {compendiumData.maturePlusCount} / {compendiumData.primeCount} 種
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#6A7B6F] block">滿意度總評</span>
              <span
                className={`font-mono-num font-bold ${
                  compendiumData.totalCultivated === 0
                    ? 'text-[#6A7B6F]'
                    : compendiumData.overallSatInfo.tone === 'emerald'
                    ? 'text-emerald-700'
                    : compendiumData.overallSatInfo.tone === 'sky'
                    ? 'text-sky-700'
                    : compendiumData.overallSatInfo.tone === 'amber'
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {compendiumData.totalCultivated === 0
                  ? '--'
                  : `${compendiumData.overallSatInfo.grade} · ${compendiumData.avgSatisfaction}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Biome Filter Buttons */}
        <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="生態圈篩選">
          {biomeFilterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setBiomeFilter(opt.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                biomeFilter === opt.id
                  ? 'bg-[#1A2B20] text-white'
                  : 'bg-[#F4F2EC] text-[#5B6D60] hover:text-[#1A2B20]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Cultivated Species List */}
        {filteredEntries.length === 0 ? (
          <div className="p-4 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] text-center space-y-1">
            <p className="text-xs font-semibold text-[#1A2B20]">尚無已培育的動物品種</p>
            <p className="text-[11px] text-[#6A7B6F]">
              請在園區建造對應生態展區並引進動物，即可在此查看成長階級與滿意度總評。
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredEntries.map((entry) => {
              const SatIcon =
                entry.satInfo.tone === 'emerald'
                  ? CheckCircle2
                  : entry.satInfo.tone === 'sky'
                  ? Smile
                  : entry.satInfo.tone === 'amber'
                  ? Meh
                  : AlertTriangle;
              const satTextColor =
                entry.satInfo.tone === 'emerald'
                  ? 'text-emerald-700'
                  : entry.satInfo.tone === 'sky'
                  ? 'text-sky-700'
                  : entry.satInfo.tone === 'amber'
                  ? 'text-amber-700'
                  : 'text-rose-700';
              const satBarColor =
                entry.satInfo.tone === 'emerald'
                  ? 'bg-emerald-600'
                  : entry.satInfo.tone === 'sky'
                  ? 'bg-sky-600'
                  : entry.satInfo.tone === 'amber'
                  ? 'bg-amber-500'
                  : 'bg-rose-500';

              return (
                <div
                  key={entry.spec.id}
                  className="p-3 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AnimalSprite speciesId={entry.spec.id} size={40} />
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-[#1A2B20] truncate">
                          {entry.spec.name}
                        </h3>
                        <p className="text-[11px] text-[#5B6D60] truncate">
                          {entry.biome.shortName} ·{' '}
                          {entry.activeCount > 0
                            ? `在園 ${entry.activeCount} 隻（${entry.habitatCount} 區）`
                            : '目前無在園個體'}{' '}
                          · 累計 {entry.totalRaised} 隻
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => soundFX.playAnimalVoice(entry.spec.id, true)}
                        title={`聆聽${entry.spec.name}叫聲`}
                        aria-label={`聆聽${entry.spec.name}叫聲`}
                        className="p-1.5 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#F4F2EC] text-[#4A5D50] transition-colors cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      {entry.firstPos && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectHabitatPos(entry.firstPos!.x, entry.firstPos!.y);
                            setActiveTab('inspector');
                          }}
                          title={`查看${entry.spec.zoneName}`}
                          className="px-2 py-1.5 rounded-lg border border-[#E2DDD3] bg-white hover:bg-emerald-50 hover:border-emerald-300 text-[11px] font-semibold text-[#1A2B20] flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3 h-3 text-emerald-700" />
                          <span>展區</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Growth Stage Progress */}
                  <div className="pt-2 border-t border-[#E6E1D6] space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#5B6D60] flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>成長階級</span>
                      </span>
                      <span className="font-semibold text-[#1A2B20] font-mono-num">
                        {entry.growthInfo.label}
                        {!entry.growthInfo.isMax && entry.growthInfo.nextStageLabel && (
                          <span className="text-[#6A7B6F] font-normal">
                            {' '}
                            · 下一階 {entry.growthInfo.nextStageLabel} {entry.growthInfo.progressPct}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#E2DDD3] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all"
                        style={{ width: `${entry.growthInfo.progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Current Satisfaction Overall Rating */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className={`flex items-center gap-1 font-medium ${satTextColor}`}>
                        <SatIcon className="w-3 h-3 shrink-0" />
                        <span>
                          {entry.activeCount > 0 ? '目前滿意度總評' : '歷史滿意度總評'}
                        </span>
                      </span>
                      <span className={`font-mono-num font-bold ${satTextColor}`}>
                        {entry.satInfo.grade} 級 · {entry.satInfo.label} ({entry.satisfactionPct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#E2DDD3] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${satBarColor}`}
                        style={{ width: `${entry.satisfactionPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    );
  }

  if (activeTab === 'photos') {
    const speciesCountMap = new Map<SpeciesId, number>();
    for (const entry of photoAlbum) {
      speciesCountMap.set(entry.speciesId, (speciesCountMap.get(entry.speciesId) ?? 0) + 1);
    }
    const photographedSpecies = Array.from(speciesCountMap.entries());
    const effectivePhotoFilter =
      photoSpeciesFilter !== 'all' && !speciesCountMap.has(photoSpeciesFilter)
        ? 'all'
        : photoSpeciesFilter;
    const filteredPhotos =
      effectivePhotoFilter === 'all'
        ? photoAlbum
        : photoAlbum.filter((p) => p.speciesId === effectivePhotoFilter);
    const activePhoto = selectedPhotoId
      ? photoAlbum.find((p) => p.id === selectedPhotoId) ?? null
      : null;

    return (
      <aside className="bg-white border border-[#E2DDD3] rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3.5 lg:h-full lg:overflow-y-auto">
        {renderTabBar()}

        {/* Header Summary */}
        <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E2DDD3] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#1A2B20] flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-rose-600 shrink-0" />
              <span>遊客合影攝影圖鑑</span>
            </h2>
            <span className="font-mono-num text-xs font-semibold text-[#5B6D60] shrink-0">
              {photoAlbum.length} 張 · {photographedSpecies.length} 種動物
            </span>
          </div>
          <p className="text-[11px] text-[#5B6D60] leading-relaxed">
            園內遊客與動物發生「合影留念」互動時會拍下實景縮圖與心得評語，點擊下方相片即可查看完整評價。
          </p>
        </div>

        {/* Species Filter Buttons */}
        {photographedSpecies.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="攝影動物篩選">
            <button
              type="button"
              onClick={() => setPhotoSpeciesFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                effectivePhotoFilter === 'all'
                  ? 'bg-[#1A2B20] text-white'
                  : 'bg-[#F4F2EC] text-[#5B6D60] hover:text-[#1A2B20]'
              }`}
            >
              全部 ({photoAlbum.length})
            </button>
            {photographedSpecies.map(([sid, count]) => (
              <button
                key={sid}
                type="button"
                onClick={() => setPhotoSpeciesFilter(sid)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  effectivePhotoFilter === sid
                    ? 'bg-[#1A2B20] text-white'
                    : 'bg-[#F4F2EC] text-[#5B6D60] hover:text-[#1A2B20]'
                }`}
              >
                {ANIMAL_SPECIES[sid].name} ({count})
              </button>
            ))}
          </div>
        )}

        {/* Selected Photo Commentary Detail Card */}
        {activePhoto && (
          <div className="p-3 rounded-xl border border-emerald-700/35 bg-[#FAF9F5] space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#1A2B20] truncate">
                  {activePhoto.animalName} · {activePhoto.speciesName}
                </h3>
                <p className="text-[11px] text-[#5B6D60] mt-0.5">
                  合影遊客：{activePhoto.visitorName}（{activePhoto.visitorArchetypeLabel}）
                  {activePhoto.partnerVisitorName ? `與 ${activePhoto.partnerVisitorName}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhotoId(null)}
                aria-label="收合相片詳情"
                className="p-1 rounded-lg hover:bg-[#ECE7DC] text-[#5B6D60] hover:text-[#1A2B20] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full aspect-[4/3] rounded-lg overflow-hidden border border-[#E2DDD3] bg-[#DCEAD6]">
              {activePhoto.thumbnailDataUrl ? (
                <img
                  src={activePhoto.thumbnailDataUrl}
                  alt={`${activePhoto.visitorName}與${activePhoto.animalName}合影`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[#4A5D50]">
                  <AnimalSprite speciesId={activePhoto.speciesId} size={56} />
                  <span className="text-[11px] font-medium">正在整理現場紀念底片⋯</span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-[#5B6D60] font-mono-num">
              第 {activePhoto.day} 天 · {WEATHERS[activePhoto.weather].name}
              {activePhoto.isNight ? ' · 夜間' : ''}
              {activePhoto.seasonalEvent
                ? ` · ${SEASONAL_EVENTS[activePhoto.seasonalEvent].name}`
                : ''}{' '}
              · 當時心情 {Math.round(activePhoto.visitorMood)}%
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-[#E2DDD3]">
              <p className="text-[11px] font-semibold text-[#5B6D60] flex items-center gap-1 mb-1">
                <Quote className="w-3 h-3 text-rose-500 shrink-0" />
                <span>遊客當時評語</span>
              </p>
              <p className="text-xs text-[#1A2B20] leading-relaxed">
                「{activePhoto.commentary}」
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onSelectHabitatPos(activePhoto.habitatX, activePhoto.habitatY);
                    setActiveTab('inspector');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1A2B20] hover:bg-[#2A4232] text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3 h-3" />
                  <span>前往展區</span>
                </button>
                {activePhoto.thumbnailDataUrl && (
                  <a
                    href={activePhoto.thumbnailDataUrl}
                    download={`zoo-photo-d${activePhoto.day}-${activePhoto.speciesId}.jpg`}
                    className="px-2.5 py-1.5 rounded-lg border border-[#D8D1C5] bg-white hover:bg-[#F4F2EC] text-[#1A2B20] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>儲存</span>
                  </a>
                )}
              </div>
              {onDeletePhoto && (
                <button
                  type="button"
                  onClick={() => {
                    onDeletePhoto(activePhoto.id);
                    setSelectedPhotoId(null);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-[#E2DDD3] bg-white hover:bg-rose-50 hover:border-rose-200 text-[#6A7B6F] hover:text-rose-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>移除</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Photo Thumbnail Grid */}
        {filteredPhotos.length === 0 ? (
          <div className="p-5 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] text-center space-y-1.5">
            <Camera className="w-6 h-6 text-[#8A988E] mx-auto" />
            <p className="text-xs font-semibold text-[#1A2B20]">尚無合影留念相片</p>
            <p className="text-[11px] text-[#6A7B6F] leading-relaxed">
              當遊客經過動物展區步道並觸發「合影留念」時，與動物同框的相片縮圖與評語就會自動存入這裡。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredPhotos.map((photo) => {
              const isSelected = selectedPhotoId === photo.id;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedPhotoId(isSelected ? null : photo.id)}
                  className={`text-left rounded-xl border overflow-hidden transition-all cursor-pointer bg-[#FAF9F5] hover:border-emerald-500 ${
                    isSelected
                      ? 'border-emerald-700 ring-2 ring-emerald-600/30 bg-white'
                      : 'border-[#E2DDD3]'
                  }`}
                >
                  <div className="aspect-[4/3] w-full bg-[#DCEAD6] overflow-hidden relative">
                    {photo.thumbnailDataUrl ? (
                      <img
                        src={photo.thumbnailDataUrl}
                        alt={`${photo.visitorName}與${photo.animalName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <AnimalSprite speciesId={photo.speciesId} size={42} />
                      </div>
                    )}
                  </div>
                  <div className="p-2 space-y-0.5">
                    <p className="text-xs font-bold text-[#1A2B20] truncate">
                      {photo.animalName} · {photo.speciesName}
                    </p>
                    <p className="text-[11px] text-[#5B6D60] truncate">
                      {photo.visitorName} · <span className="font-mono-num">D{photo.day}</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>
    );
  }

  if (selectedVisitor) {
    const moodInfo = getVisitorMoodInfo(selectedVisitor.mood);
    const moodPct = Math.round(selectedVisitor.mood);
    const energyPct = Math.round(selectedVisitor.energy);
    const satietyPct = Math.max(0, Math.round(100 - selectedVisitor.hunger));
    const MoodIcon =
      moodInfo.tone === 'emerald' || moodInfo.tone === 'sky'
        ? Smile
        : moodInfo.tone === 'amber'
        ? Meh
        : Frown;

    return (
      <aside className="bg-white border border-[#E2DDD3] rounded-2xl p-3.5 sm:p-4 flex flex-col gap-4 lg:h-full lg:overflow-y-auto">
        {renderTabBar()}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-[#5B6D60]">
              園區遊客檔案 · {selectedVisitor.archetypeLabel}
            </p>
            <h2 className="text-lg font-bold text-[#1A2B20]">{selectedVisitor.name}</h2>
          </div>
          <button
            type="button"
            onClick={() => onSelectVisitor(null)}
            className="text-xs font-medium text-[#5B6D60] hover:text-[#1A2B20] px-2.5 py-1 rounded-md border border-[#E2DDD3] bg-[#FAF9F5] whitespace-nowrap cursor-pointer"
          >
            總覽
          </button>
        </div>

        <div className="p-3.5 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MoodIcon
                className={`w-5 h-5 ${
                  moodInfo.tone === 'emerald'
                    ? 'text-emerald-600'
                    : moodInfo.tone === 'sky'
                    ? 'text-sky-600'
                    : moodInfo.tone === 'amber'
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              />
              <div>
                <p className="text-xs text-[#5B6D60]">目前心情狀態</p>
                <p className="text-sm font-bold text-[#1A2B20]">
                  {moodInfo.label} · <span className="font-mono-num">{moodPct}%</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                soundFX.playVisitorVoice(
                  selectedVisitor.archetype,
                  selectedVisitor.mood < 55 ? 'complaint' : 'greet',
                  true
                )
              }
              className="px-2.5 py-1.5 rounded-lg bg-[#1A2B20] hover:bg-[#2A4232] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>打招呼</span>
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#E2DDD3]">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-14 text-[#5B6D60] shrink-0">心情指數</span>
              <div className="flex-1 h-2 bg-[#E2DDD3] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    moodInfo.tone === 'emerald'
                      ? 'bg-emerald-600'
                      : moodInfo.tone === 'sky'
                      ? 'bg-sky-600'
                      : moodInfo.tone === 'amber'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${moodPct}%` }}
                />
              </div>
              <span className="font-mono-num w-9 text-right font-semibold">{moodPct}%</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="w-14 text-[#5B6D60] shrink-0">遊園體力</span>
              <div className="flex-1 h-2 bg-[#E2DDD3] rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 transition-all"
                  style={{ width: `${energyPct}%` }}
                />
              </div>
              <span className="font-mono-num w-9 text-right font-semibold">{energyPct}%</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="w-14 text-[#5B6D60] shrink-0">飽足程度</span>
              <div className="flex-1 h-2 bg-[#E2DDD3] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${satietyPct}%` }}
                />
              </div>
              <span className="font-mono-num w-9 text-right font-semibold">{satietyPct}%</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E2DDD3] text-xs space-y-1.5">
            {(selectedVisitor.stargazePauseTicks ?? 0) > 0 ? (
              <div className="px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold flex items-center gap-1.5">
                <span>✨</span>
                <span>正在空曠草地步道仰望星空（心情愉悅提升中）</span>
              </div>
            ) : selectedVisitor.stargazeTarget ? (
              <div className="px-2.5 py-1.5 rounded-lg bg-indigo-50/70 border border-indigo-200/80 text-indigo-700 font-medium flex items-center gap-1.5">
                <span>✨</span>
                <span>正前往空曠草地步道準備夜間觀星</span>
              </div>
            ) : null}
            <span className="text-[#5B6D60] block">此刻想法</span>
            <p className="text-[#1A2B20] font-medium bg-white border border-[#E2DDD3] rounded-lg px-2.5 py-2">
              「
              {selectedVisitor.thought ||
                ((selectedVisitor.stargazePauseTicks ?? 0) > 0
                  ? '抬頭仰望星空，漫天星斗好療癒 ✨'
                  : '正在悠閒參觀園區與動物！')}
              」
            </p>
          </div>

          {goldenGuideUnlocked ? (
            <div className="pt-2 border-t border-[#E2DDD3] space-y-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-50 via-yellow-50/70 to-sky-50 border border-amber-300 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600 shrink-0" />
                    金牌嚮導證 · 未來動向透視
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    導覽加成生效中
                  </span>
                </div>
                {selectedVisitor.plannedDestination ? (
                  <div className="bg-white/90 border border-amber-200 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#5B6D60]">接下來預計前往</p>
                        <p className="text-xs font-bold text-sky-900 truncate">
                          {selectedVisitor.plannedDestination.label}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectHabitatPos(
                            selectedVisitor.plannedDestination!.x,
                            selectedVisitor.plannedDestination!.y
                          )
                        }
                        className="px-2.5 py-1 rounded-md bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                      >
                        <MapPin className="w-3 h-3" />
                        定位設施
                      </button>
                    </div>
                    <p className="text-[11px] text-[#4A5D50] leading-relaxed">
                      原因：{selectedVisitor.plannedDestination.reason}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-900/90 bg-white/80 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
                    正在園區內悠閒漫步，準備挑選下一個想逛的設施。
                  </p>
                )}
                <p className="text-[10.5px] text-amber-900/85">
                  ✨ 持有金牌嚮導證時點擊園內遊客，會主動提供貼心導覽提升滿意度與評分。
                </p>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-[#E2DDD3]">
              <div className="p-2.5 rounded-xl bg-white border border-dashed border-[#D5CFC2] text-[11px] text-[#5B6D60] flex items-start gap-2">
                <Award className="w-4 h-4 text-[#8A988E] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#1A2B20] block">
                    未解鎖「金牌嚮導證」
                  </span>
                  <span>
                    達成「遊客圖鑑大師」（集滿 {VISITOR_ARCHETYPE_IDS.length}{' '}
                    種遊客）後，點擊遊客即可查看未來想前往的設施並提升滿意度。
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Habitat Care & Species-Dedicated Adoption Inspector
  if (selectedTile && selectedTile.type === 'habitat' && selectedTile.habitat) {
    const hab = selectedTile.habitat;
    const spec = ANIMAL_SPECIES[hab.speciesId];
    const biome = BIOMES[hab.biome];
    const capacity = getHabitatCapacity(hab.level);
    const canUpgrade = hab.level < 3;
    const upgradeCost = spec.upgradeCost * hab.level;
    const isFull = hab.animals.length >= capacity;
    const cantAffordAdopt = funds < spec.cost;
    const vegInfo = getHabitatVegetationInfo(hab.biome, hab.animals);
    const vegBarColor =
      vegInfo.tone === 'emerald'
        ? 'bg-emerald-600'
        : vegInfo.tone === 'teal'
        ? 'bg-teal-600'
        : vegInfo.tone === 'sky'
        ? 'bg-sky-500'
        : vegInfo.tone === 'amber'
        ? 'bg-amber-500'
        : 'bg-stone-400';

    return (
      <aside className="bg-white border border-[#E2DDD3] rounded-2xl p-3.5 sm:p-4 flex flex-col gap-4 lg:h-full lg:overflow-y-auto">
        {renderTabBar()}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-[#5B6D60]">
              座標 ({selectedTile.x + 1}, {selectedTile.y + 1}) · 等級 {hab.level} · {biome.shortName}
            </p>
            <h2 className="text-lg font-bold text-[#1A2B20]">{spec.zoneName}</h2>
          </div>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs font-medium text-[#5B6D60] hover:text-[#1A2B20] px-2.5 py-1 rounded-md border border-[#E2DDD3] bg-[#FAF9F5] whitespace-nowrap cursor-pointer"
          >
            總覽
          </button>
        </div>

        {/* Biome Artwork Card */}
        <div className="relative h-28 rounded-xl overflow-hidden border border-[#E2DDD3] bg-[#E8E4DA] shrink-0">
          {!biomeImgFailed[biome.id] ? (
            <img
              src={biome.imagePath}
              alt={spec.zoneName}
              referrerPolicy="no-referrer"
              onError={() =>
                setBiomeImgFailed((prev) => ({ ...prev, [biome.id]: true }))
              }
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-sm font-semibold text-[#1A2B20]"
              style={{ backgroundColor: spec.groundColor }}
            >
              {spec.zoneName}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent flex items-end justify-between p-2.5 text-white text-xs">
            <span>
              專區容量 {hab.animals.length} / {capacity} 隻
            </span>
            <span className="font-mono-num">
              清潔度 {Math.round(hab.cleanliness)}%
            </span>
          </div>
        </div>

        {/* Dynamic Habitat Vegetation Level */}
        <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E2DDD3] space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#1A2B20] inline-flex items-center gap-1.5">
              {hab.biome === 'arctic' ? (
                <Snowflake className="w-3.5 h-3.5 text-sky-600" />
              ) : (
                <Sprout className="w-3.5 h-3.5 text-emerald-700" />
              )}
              動態植被層級 · {vegInfo.label}
            </span>
            <span className="font-mono-num text-[11px] font-semibold text-[#5B6D60]">
              生機 {vegInfo.score}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#E8E4DA] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${vegBarColor}`}
              style={{ width: `${vegInfo.score}%` }}
            />
          </div>
          <p className="text-[11px] text-[#5B6D60] leading-snug">{vegInfo.detail}</p>
        </div>

        {!selectedTile.connected && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>此專區尚未連接園區步道，遊客與工作人員無法抵達！</span>
          </div>
        )}

        {isNight && (
          <div className="p-2.5 rounded-xl bg-indigo-950/90 border border-indigo-800 text-indigo-100 text-xs flex items-start gap-2">
            <Moon className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
            <span>夜幕降臨！園區已開啟聚光燈照明，動物進入夜間休息狀態。</span>
          </div>
        )}

        {(weather === 'rainy' || weather === 'heatwave') && (
          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[#4A3A1E] text-xs flex items-start gap-2">
            {renderWeatherIcon(weather, 'w-4 h-4 shrink-0 mt-0.5')}
            <span>
              {weather === 'rainy'
                ? hab.biome === 'rainforest'
                  ? '雨天濕潤氣候讓雨林動物特別開心，但清潔消耗增加。'
                  : '細雨天氣使地面較快累積泥濘，建議多加清潔。'
                : hab.biome === 'arctic'
                ? '熱浪來襲！極地動物飽食與心情下降較快，請密切照護。'
                : '高溫熱浪加速動物體力消耗，請留意及時餵食。'}
            </span>
          </div>
        )}

        {/* Care Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onFeedHabitat(selectedTile.x, selectedTile.y)}
            disabled={hab.animals.length === 0 || funds < FACILITY_COSTS.feed}
            className="min-h-[58px] py-2 px-2 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-45 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Utensils className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-semibold text-[#1A2B20] whitespace-nowrap">
              餵食
            </span>
            <span className="font-mono-num text-[11px] text-[#5B6D60]">
              ${FACILITY_COSTS.feed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onCleanHabitat(selectedTile.x, selectedTile.y)}
            disabled={funds < FACILITY_COSTS.clean}
            className="min-h-[58px] py-2 px-2 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] hover:bg-sky-50 hover:border-sky-300 disabled:opacity-45 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-sky-700" />
            <span className="text-xs font-semibold text-[#1A2B20] whitespace-nowrap">
              清潔
            </span>
            <span className="font-mono-num text-[11px] text-[#5B6D60]">
              ${FACILITY_COSTS.clean}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onEnrichHabitat(selectedTile.x, selectedTile.y)}
            disabled={hab.animals.length === 0 || funds < FACILITY_COSTS.enrich}
            className="min-h-[58px] py-2 px-2 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] hover:bg-amber-50 hover:border-amber-300 disabled:opacity-45 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <SmilePlus className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-[#1A2B20] whitespace-nowrap">
              互動
            </span>
            <span className="font-mono-num text-[11px] text-[#5B6D60]">
              ${FACILITY_COSTS.enrich}
            </span>
          </button>
        </div>

        {/* Upgrade Habitat */}
        {canUpgrade && (
          <button
            type="button"
            onClick={() => onUpgradeHabitat(selectedTile.x, selectedTile.y)}
            disabled={funds < upgradeCost}
            className="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-emerald-700/30 bg-emerald-50/70 hover:bg-emerald-100/70 disabled:opacity-45 flex items-center justify-between text-xs font-semibold text-emerald-900 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <ArrowUpCircle className="w-4 h-4 text-emerald-700" />
              擴建動物領地與容量至 {capacity + 1} 隻
            </span>
            <span className="font-mono-num">${upgradeCost}</span>
          </button>
        )}

        {/* Habitat Automation Systems */}
        <div className="p-3 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#1A2B20] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-700" />
              <span>棲地自動化系統</span>
            </h3>
            <span className="text-[11px] font-semibold text-[#5B6D60]">
              {hab.autoFeederEnabled && hab.autoCleanerEnabled
                ? '雙系統運行中'
                : hab.autoFeederEnabled || hab.autoCleanerEnabled
                ? '部分自動化'
                : hab.autoFeeder || hab.autoCleaner
                ? '已暫停'
                : '手動照護'}
            </span>
          </div>

          {/* Auto-Feeder System */}
          <div className="p-2 rounded-lg border border-[#E2DDD3] bg-white flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-xs font-semibold text-[#1A2B20]">自動投餵系統</span>
                {hab.autoFeeder && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      hab.autoFeederEnabled
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hab.autoFeederEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                      }`}
                    />
                    {hab.autoFeederEnabled ? '運作中' : '已暫停'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6A7B6F] mt-0.5">
                {hab.autoFeeder
                  ? '飽食低於 75% 自動投餵，免照護員往返'
                  : '一次性加裝 · 自動補充飼料減少人力依賴'}
              </p>
            </div>
            {hab.autoFeeder ? (
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(hab.autoFeederEnabled)}
                onClick={() =>
                  onToggleHabitatAutomation(selectedTile.x, selectedTile.y, 'feeder')
                }
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  hab.autoFeederEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-[#E8E4DA] hover:bg-[#DBD5C7] text-[#4A5D50]'
                }`}
              >
                <Power className="w-3 h-3" />
                <span>{hab.autoFeederEnabled ? '開啟' : '關閉'}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={funds < FACILITY_COSTS.autoFeederPurchase}
                onClick={() =>
                  onBuyHabitatAutomation(selectedTile.x, selectedTile.y, 'feeder')
                }
                className="px-2.5 py-1.5 rounded-lg bg-[#1A2B20] hover:bg-[#2A4232] disabled:bg-[#E2DDD3] disabled:text-[#7A8A7E] text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                購買 <span className="font-mono-num">${FACILITY_COSTS.autoFeederPurchase}</span>
              </button>
            )}
          </div>

          {/* Auto-Cleaner System */}
          <div className="p-2 rounded-lg border border-[#E2DDD3] bg-white flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                <span className="text-xs font-semibold text-[#1A2B20]">自動清潔系統</span>
                {hab.autoCleaner && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      hab.autoCleanerEnabled
                        ? 'bg-sky-50 text-sky-800 border border-sky-200'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hab.autoCleanerEnabled ? 'bg-sky-500 animate-pulse' : 'bg-stone-400'
                      }`}
                    />
                    {hab.autoCleanerEnabled ? '運作中' : '已暫停'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6A7B6F] mt-0.5">
                {hab.autoCleaner
                  ? '清潔度低於 75% 自動噴霧淨化，晴熱天亦可為動物灑水降溫'
                  : '一次性加裝 · 自動維持環境整潔與灑水降溫'}
              </p>
            </div>
            {hab.autoCleaner ? (
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(hab.autoCleanerEnabled)}
                onClick={() =>
                  onToggleHabitatAutomation(selectedTile.x, selectedTile.y, 'cleaner')
                }
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  hab.autoCleanerEnabled
                    ? 'bg-sky-600 hover:bg-sky-700 text-white'
                    : 'bg-[#E8E4DA] hover:bg-[#DBD5C7] text-[#4A5D50]'
                }`}
              >
                <Power className="w-3 h-3" />
                <span>{hab.autoCleanerEnabled ? '開啟' : '關閉'}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={funds < FACILITY_COSTS.autoCleanerPurchase}
                onClick={() =>
                  onBuyHabitatAutomation(selectedTile.x, selectedTile.y, 'cleaner')
                }
                className="px-2.5 py-1.5 rounded-lg bg-[#1E4E6E] hover:bg-[#27648C] disabled:bg-[#E2DDD3] disabled:text-[#7A8A7E] text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                購買 <span className="font-mono-num">${FACILITY_COSTS.autoCleanerPurchase}</span>
              </button>
            )}
          </div>
        </div>

        {/* Current Animals in Dedicated Zone */}
        <div>
          <h3 className="text-xs font-semibold text-[#5B6D60] mb-2">
            專區動物狀況 ({hab.animals.length}/{capacity})
          </h3>
          {hab.animals.length === 0 ? (
            <p className="text-xs text-[#6A7B6F] bg-[#FAF9F5] border border-[#E2DDD3] rounded-xl p-3">
              這座「{spec.zoneName}」尚未有動物入住，請點擊下方引進第一隻{spec.name}！
            </p>
          ) : (
            <div className="space-y-2">
              {hab.animals.map((ani) => {
                const hungryLabel = ani.hunger < 40 ? '飢餓' : '飽足';
                const happyLabel = ani.happiness < 45 ? '無聊' : '開心';
                const growthInfo = getAnimalGrowthInfo(ani.growthPoints ?? 0);
                return (
                  <div
                    key={ani.id}
                    className="p-2.5 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] flex items-center gap-3"
                  >
                    <AnimalSprite speciesId={ani.speciesId} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#1A2B20] truncate">
                          {ani.name} · {spec.name}
                        </span>
                        <span className="text-[11px] text-[#5B6D60] shrink-0">
                          {ani.isResting ? (
                            <span className="text-indigo-700 font-semibold">休息中</span>
                          ) : ani.weatherBehaviorLabel ? (
                            <span
                              className={`font-semibold ${
                                ani.weatherBehavior === 'cool_sprinkler' ||
                                ani.weatherBehavior === 'cool_pool'
                                  ? 'text-sky-700'
                                  : ani.weatherBehavior === 'shelter_pavilion' ||
                                    ani.weatherBehavior === 'rain_splash'
                                  ? 'text-teal-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {ani.weatherBehaviorLabel}
                            </span>
                          ) : (
                            `${growthInfo.shortLabel} · 魅力 ${spec.appeal + growthInfo.appealBonus}`
                          )}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-12 text-[#5B6D60] shrink-0">
                            {hungryLabel}
                          </span>
                          <div className="flex-1 h-1.5 bg-[#E2DDD3] rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                ani.hunger < 40 ? 'bg-rose-500' : 'bg-emerald-600'
                              }`}
                              style={{ width: `${Math.round(ani.hunger)}%` }}
                            />
                          </div>
                          <span className="font-mono-num w-8 text-right text-[#4A5D50]">
                            {Math.round(ani.hunger)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-12 text-[#5B6D60] shrink-0">
                            {happyLabel}
                          </span>
                          <div className="flex-1 h-1.5 bg-[#E2DDD3] rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                ani.happiness < 45 ? 'bg-amber-500' : 'bg-sky-600'
                              }`}
                              style={{ width: `${Math.round(ani.happiness)}%` }}
                            />
                          </div>
                          <span className="font-mono-num w-8 text-right text-[#4A5D50]">
                            {Math.round(ani.happiness)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Adopt Dedicated Species */}
        <div className="pt-1 border-t border-[#E2DDD3]">
          <h3 className="text-xs font-semibold text-[#5B6D60] mb-2">
            引進專屬夥伴
          </h3>
          <div className="p-2.5 rounded-xl border border-[#E2DDD3] bg-white flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <AnimalSprite speciesId={spec.id} size={36} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#1A2B20] truncate">
                  {spec.name}
                </p>
                <p className="text-[11px] text-[#5B6D60] truncate">
                  魅力 +{spec.appeal} · 日耗 ${spec.dailyUpkeep} · 愛吃{spec.favoriteFood}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isFull || cantAffordAdopt}
              onClick={() => onAdoptAnimal(selectedTile.x, selectedTile.y, spec.id)}
              className="min-h-[42px] px-3 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] disabled:bg-[#E2DDD3] disabled:text-[#7A8A7E] text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="font-mono-num">${spec.cost}</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Park Overview Mode
  const getMilestoneCurrent = (type: string) => {
    switch (type) {
      case 'habitats':
        return metrics.connectedHabitats;
      case 'species':
        return metrics.uniqueSpeciesCount;
      case 'visitors':
        return totalVisitors;
      case 'animals':
        return metrics.totalAnimals;
      case 'rating':
        return metrics.rating;
      case 'visitor_types':
        return VISITOR_ARCHETYPE_IDS.filter((id) => (visitorTypeCounts[id] || 0) > 0).length;
      default:
        return 0;
    }
  };

  // Count active visitor archetypes
  const archetypeCounts = visitors.reduce<Partial<Record<VisitorArchetype, number>>>(
    (acc, v) => {
      acc[v.archetype] = (acc[v.archetype] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <aside className="bg-white border border-[#E2DDD3] rounded-2xl p-3.5 sm:p-4 flex flex-col gap-5 lg:h-full lg:overflow-y-auto">
      {renderTabBar()}
      {/* Dynamic Weather & Forecast Card */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-bold text-[#1A2B20]">氣象與日夜環境</h2>
          <span className="font-mono-num text-xs text-[#5B6D60]">
            {isNight ? '夜間聚光燈' : '白天營運'} · {weatherDaysLeft} 天後變天
          </span>
        </div>
        <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E2DDD3] space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {renderWeatherIcon(weather, 'w-5 h-5 shrink-0')}
              <div>
                <p className="text-sm font-bold text-[#1A2B20]">{weatherSpec.name}</p>
                <p className="text-[11px] text-[#5B6D60]">
                  遊客平均滿意度 {Math.round(avgVisitorMood)}%
                </p>
              </div>
            </div>
            <div className="text-right text-[11px] text-[#5B6D60] shrink-0">
              <span className="block">下波預報</span>
              <span className="font-semibold text-[#1A2B20] inline-flex items-center gap-1 mt-0.5">
                {renderWeatherIcon(nextWeather, 'w-3 h-3')}
                {nextWeatherSpec.name}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#4A5D50] leading-relaxed">{weatherSpec.shortDesc}</p>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E2DDD3] text-[11px]">
            <div>
              <span className="text-[#6A7B6F] block">人潮係數</span>
              <span className="font-mono-num font-semibold text-[#1A2B20]">
                {Math.round(weatherSpec.visitorSpawnMultiplier * 100)}%
              </span>
            </div>
            <div>
              <span className="text-[#6A7B6F] block">飢餓消耗</span>
              <span className="font-mono-num font-semibold text-[#1A2B20]">
                {Math.round(weatherSpec.hungerDecayMultiplier * 100)}%
              </span>
            </div>
            <div>
              <span className="text-[#6A7B6F] block">髒污累積</span>
              <span className="font-mono-num font-semibold text-[#1A2B20]">
                {Math.round(weatherSpec.cleanDecayMultiplier * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Seasonal Event Card */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[#1A2B20] flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-rose-600" />
            季節性活動
          </h2>
          <span className="font-mono-num text-[11px] text-[#5B6D60]">
            {seasonalSpec ? `${seasonalSpec.seasonLabel} · 剩餘 ${seasonalDaysLeft} 天` : '平常營業日'}
          </span>
        </div>
        {seasonalSpec ? (
          <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E2DDD3] space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {renderSeasonalIcon(seasonalSpec.id, 'w-5 h-5 shrink-0')}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1A2B20] truncate">{seasonalSpec.name}</p>
                  <p className="text-[11px] text-[#5B6D60] truncate">{seasonalSpec.tileEffectDesc}</p>
                </div>
              </div>
              <span className="font-mono-num text-xs font-bold text-[#059669] shrink-0">
                +{Math.round((seasonalSpec.spawnMultiplier - 1) * 100)}% 人潮
              </span>
            </div>
            <p className="text-xs text-[#4A5D50] leading-relaxed">{seasonalSpec.shortDesc}</p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E2DDD3] text-[11px]">
              <div>
                <span className="text-[#6A7B6F] block">入園率提升族群</span>
                <span className="font-semibold text-[#1A2B20]">
                  {seasonalSpec.boostedArchetypes
                    .map((id) => VISITOR_ARCHETYPES[id].label)
                    .join('、')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[#6A7B6F] block">活動心情加成</span>
                <span className="font-mono-num font-semibold text-[#059669]">
                  +{seasonalSpec.visitorMoodDelta.toFixed(2)} / 回合
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E2DDD3] text-xs text-[#5B6D60] leading-relaxed">
            <p className="font-semibold text-[#1A2B20] mb-0.5">平常營業日 · 暫無節慶活動</p>
            <p>營運期間將隨季節變化隨機觸發「春日櫻花祭」、「冬季雪景節」等限定活動，帶來園區地磚景觀變化與特定遊客熱潮。</p>
          </div>
        )}
      </div>

      {/* Visitor Archetype Collection & Achievement System */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[#1A2B20] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-sky-700" />
            遊客圖鑑與成就
          </h2>
          <span className="font-mono-num text-[11px] font-semibold text-[#5B6D60]">
            {VISITOR_ARCHETYPE_IDS.filter((id) => (visitorTypeCounts[id] || 0) > 0).length} /{' '}
            {VISITOR_ARCHETYPE_IDS.length} 種 · 點擊聽聲音
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(VISITOR_ARCHETYPES).map((arch) => {
            const activeCount = archetypeCounts[arch.id] || 0;
            const totalReceived = visitorTypeCounts[arch.id] || 0;
            const collected = totalReceived > 0;
            return (
              <button
                key={arch.id}
                type="button"
                onClick={() => soundFX.playVisitorVoice(arch.id, 'greet', true)}
                title={`累計接待 ${totalReceived} 人 · 目前在園 ${activeCount} 人`}
                className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                  collected
                    ? 'border-emerald-300 bg-emerald-50/55 hover:border-emerald-400'
                    : 'border-[#E2DDD3] bg-[#FAF9F5] hover:border-[#C7BFB0] opacity-75'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  {collected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="font-medium text-[#1A2B20] truncate">{arch.label}</span>
                </span>
                <span className="font-mono-num text-[11px] font-bold text-[#5B6D60] ml-1 shrink-0">
                  {activeCount}
                  <span className="text-[10px] font-normal text-[#7A8A7E]">/{totalReceived}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Golden Guide Pass & Landmark Unlock Reward Banner */}
        {(() => {
          const collectedCount = VISITOR_ARCHETYPE_IDS.filter(
            (id) => (visitorTypeCounts[id] || 0) > 0
          ).length;
          const totalTypes = VISITOR_ARCHETYPE_IDS.length;
          const pct = Math.round((collectedCount / totalTypes) * 100);
          const allUnlocked = landmarkUnlocked || goldenGuideUnlocked;
          return (
            <div
              className={`mt-2 p-2.5 rounded-xl border text-xs ${
                allUnlocked
                  ? 'bg-gradient-to-br from-amber-50 to-sky-50/70 border-amber-300 text-amber-950'
                  : 'bg-[#FAF9F5] border-[#E2DDD3] text-[#4A5D50]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold flex items-center gap-1.5">
                  <Award
                    className={`w-4 h-4 shrink-0 ${
                      allUnlocked ? 'text-amber-600' : 'text-[#8A988E]'
                    }`}
                  />
                  <span>
                    {allUnlocked
                      ? '遊客圖鑑大師 · 已解鎖金牌嚮導證'
                      : '遊客圖鑑大師獎勵：金牌嚮導證'}
                  </span>
                </span>
                {landmarkUnlocked ? (
                  <button
                    type="button"
                    onClick={onSelectLandmarkTool}
                    className="px-2 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors"
                  >
                    建造地標 (${FACILITY_COSTS.landmark})
                  </button>
                ) : (
                  <span className="font-mono-num text-[11px] font-semibold text-[#5B6D60]">
                    {collectedCount}/{totalTypes}
                  </span>
                )}
              </div>
              {allUnlocked ? (
                <div className="text-[11px] text-amber-900 mt-1.5 space-y-1">
                  <p className="font-semibold text-sky-900">
                    🏅 金牌嚮導證生效中：在園區點擊任意遊客即可透視其未來想前往的設施，並立即提供導覽提升滿意度！
                  </p>
                  <p>
                    🏛️ 同時已解鎖「金色導覽地標」：每座連接步道可增加 +{FACILITY_COSTS.landmarkAppeal}{' '}
                    園區魅力並提升評分（目前已有 {metrics.landmarkCount} 座）
                  </p>
                </div>
              ) : (
                <div className="mt-1.5">
                  <div className="h-1.5 bg-[#E2DDD3] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#6A7B6F] mt-1">
                    集滿全部 {totalTypes}{' '}
                    種遊客類型，即可達成「遊客圖鑑大師」解鎖專屬「金牌嚮導證」與「金色導覽地標」
                  </p>
                </div>
              )}
            </div>
          );
        })()}
        {/* Active Visitors Names & Live Moods */}
        <div className="mt-3 pt-3 border-t border-[#E2DDD3]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-[#1A2B20]">在園遊客名錄與心情</h3>
            <span className="font-mono-num text-[11px] text-[#5B6D60]">
              在園 {visitors.length} 位 · 平均 {Math.round(avgVisitorMood)}%
            </span>
          </div>
          {visitors.length === 0 ? (
            <p className="text-[11px] text-[#6A7B6F] bg-[#FAF9F5] border border-[#E2DDD3] rounded-xl p-2.5">
              目前尚無遊客入園，連接動物展區後遊客就會陸續進場。
            </p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {visitors.map((vis) => {
                const moodInfo = getVisitorMoodInfo(vis.mood);
                const moodPct = Math.round(vis.mood);
                const MoodIcon =
                  moodInfo.tone === 'emerald' || moodInfo.tone === 'sky'
                    ? Smile
                    : moodInfo.tone === 'amber'
                    ? Meh
                    : Frown;
                const moodColorClass =
                  moodInfo.tone === 'emerald'
                    ? 'text-emerald-700'
                    : moodInfo.tone === 'sky'
                    ? 'text-sky-700'
                    : moodInfo.tone === 'amber'
                    ? 'text-amber-700'
                    : 'text-rose-700';
                const barColorClass =
                  moodInfo.tone === 'emerald'
                    ? 'bg-emerald-600'
                    : moodInfo.tone === 'sky'
                    ? 'bg-sky-600'
                    : moodInfo.tone === 'amber'
                    ? 'bg-amber-500'
                    : 'bg-rose-500';
                return (
                  <button
                    key={vis.id}
                    type="button"
                    onClick={() => {
                      onSelectVisitor(vis.id);
                      soundFX.playVisitorVoice(
                        vis.archetype,
                        vis.mood < 55 ? 'complaint' : 'greet',
                        true
                      );
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MoodIcon className={`w-3.5 h-3.5 shrink-0 ${moodColorClass}`} />
                        <span className="text-xs font-bold text-[#1A2B20] truncate">
                          {vis.name}
                        </span>
                        <span className="text-[11px] text-[#5B6D60] truncate">
                          · {vis.archetypeLabel}
                        </span>
                      </div>
                      <span className={`font-mono-num text-[11px] font-bold shrink-0 ${moodColorClass}`}>
                        {moodInfo.label} {moodPct}%
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#E2DDD3] rounded-full overflow-hidden shrink-0">
                        <div className={`h-full ${barColorClass}`} style={{ width: `${moodPct}%` }} />
                      </div>
                      <span className="text-[11px] text-[#5B6D60] truncate">
                        {vis.thought || '點擊遊客後即可說話'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ticket Price & Staff Management */}
      <div>
        <h2 className="text-sm font-bold text-[#1A2B20] mb-2.5">園區營運設定</h2>
        <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E2DDD3] space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5 font-medium text-[#1A2B20]">
                <Ticket className="w-3.5 h-3.5 text-amber-600" />
                入園門票定價
              </span>
              <span className="font-mono-num font-bold text-[#1A2B20]">
                ${ticketPrice} / 人
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={40}
              step={2}
              value={ticketPrice}
              onChange={(e) => onChangeTicketPrice(Number(e.target.value))}
              aria-label="調整入園門票定價"
              className="w-full accent-emerald-700 cursor-pointer"
            />
          </div>

          {(() => {
            const caregivers = keepers.filter((k) => k.role === 'keeper');
            const cleaners = keepers.filter((k) => k.role === 'cleaner');
            return (
              <div className="pt-2.5 border-t border-[#E2DDD3] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#1A2B20] flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                      動物照顧人員 ({caregivers.length} / 3)
                    </p>
                    <p className="text-[11px] text-[#5B6D60] mt-0.5">
                      提飼料桶自動餵食與安撫動物 · 日薪 ${FACILITY_COSTS.keeperDailyWage}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onHireStaff('keeper')}
                    disabled={caregivers.length >= 3 || funds < FACILITY_COSTS.keeperHire}
                    className="px-3 py-1.5 rounded-lg bg-[#1A2B20] hover:bg-[#2A4232] disabled:bg-[#E2DDD3] disabled:text-[#7A8A7E] text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    雇用 <span className="font-mono-num">${FACILITY_COSTS.keeperHire}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-[#ECE7DC] flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#1A2B20] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-700" />
                      園區清潔人員 ({cleaners.length} / 3)
                    </p>
                    <p className="text-[11px] text-[#5B6D60] mt-0.5">
                      持掃把清理展區髒污與維持步道整潔 · 日薪 ${FACILITY_COSTS.cleanerDailyWage}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onHireStaff('cleaner')}
                    disabled={cleaners.length >= 3 || funds < FACILITY_COSTS.cleanerHire}
                    className="px-3 py-1.5 rounded-lg bg-[#1E4E6E] hover:bg-[#27648C] disabled:bg-[#E2DDD3] disabled:text-[#7A8A7E] text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    雇用 <span className="font-mono-num">${FACILITY_COSTS.cleanerHire}</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Milestones */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[#1A2B20] flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-700" />
            園長經營目標
          </h2>
          <span className="font-mono-num text-xs text-[#5B6D60]">
            {completedMilestones.length} / {MILESTONES.length}
          </span>
        </div>
        <div className="space-y-2">
          {MILESTONES.map((m) => {
            const done = completedMilestones.includes(m.id);
            const curr = getMilestoneCurrent(m.type);
            const pct = Math.min(100, Math.round((curr / m.targetValue) * 100));
            return (
              <div
                key={m.id}
                className={`p-2.5 rounded-xl border ${
                  done
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-[#FAF9F5] border-[#E2DDD3]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1A2B20] flex items-center gap-1.5">
                    {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                    {m.title}
                  </span>
                  <span className="font-mono-num text-[11px] font-semibold text-amber-700 shrink-0">
                    +${m.reward}
                  </span>
                </div>
                <p className="text-[11px] text-[#5B6D60] mt-1">{m.description}</p>
                {!done && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#E2DDD3] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono-num text-[10px] text-[#5B6D60]">
                      {m.type === 'rating' ? curr.toFixed(1) : curr}/{m.targetValue}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Park Activity Log */}
      <div className="mt-auto pt-2 border-t border-[#E2DDD3]">
        <h3 className="text-xs font-semibold text-[#5B6D60] mb-2">園區動態紀錄</h3>
        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
          {logs.slice(0, 6).map((entry) => (
            <div
              key={entry.id}
              className="text-xs flex items-baseline gap-2 leading-snug text-[#4A5D50]"
            >
              <span className="font-mono-num text-[10px] text-[#7A8A7E] shrink-0">
                D{entry.day}
              </span>
              <span
                className={
                  entry.tone === 'success'
                    ? 'text-emerald-800 font-medium'
                    : entry.tone === 'warning'
                    ? 'text-amber-700 font-medium'
                    : ''
                }
              >
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
