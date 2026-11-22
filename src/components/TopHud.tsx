import React, { useEffect, useRef, useState } from 'react';
import {
  Coins,
  Users,
  Star,
  Calendar,
  Pause,
  Play,
  FastForward,
  Volume2,
  VolumeX,
  RotateCcw,
  Sun,
  CloudRain,
  Flame,
  Wind,
  Moon,
  Camera,
  Music,
  ChevronDown,
  Check,
  Shuffle,
  Flower2,
  Snowflake,
  Leaf,
  Sparkles,
  CloudLightning,
  Save,
  BookOpen,
  Timer,
} from 'lucide-react';
import { formatPomodoroTime, PomodoroMode } from './PomodoroPanel';
import { SEASONAL_EVENTS, WEATHERS } from '../data/zooCatalog';
import { SeasonalEventId, WeatherType } from '../types/zoo';
import { AmbientAudioMode, BGM_TRACKS, BgmTrackId } from '../utils/sound';

interface TopHudProps {
  funds: number;
  visitorCount: number;
  rating: number;
  day: number;
  dayProgress: number; // 0 to 100
  isNight: boolean;
  weather: WeatherType;
  weatherDaysLeft: number;
  seasonalEvent: SeasonalEventId | null;
  seasonalDaysLeft: number;
  speed: 0 | 1 | 2;
  muted: boolean;
  bgmMuted: boolean;
  bgmTrack: BgmTrackId;
  rainMode: AmbientAudioMode;
  windMode: AmbientAudioMode;
  thunderMode: AmbientAudioMode;
  pomodoroMode: PomodoroMode;
  pomodoroRunning: boolean;
  pomodoroSecondsLeft: number;
  onOpenPomodoro: () => void;
  onChangeSpeed: (speed: 0 | 1 | 2) => void;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onChangeBgmTrack: (track: BgmTrackId) => void;
  onCycleRainMode: () => void;
  onCycleWindMode: () => void;
  onCycleThunderMode: () => void;
  onEnterPhotoMode: () => void;
  onOpenSaveModal: () => void;
  onReturnTitle: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  funds,
  visitorCount,
  rating,
  day,
  dayProgress,
  isNight,
  weather,
  weatherDaysLeft,
  seasonalEvent,
  seasonalDaysLeft,
  speed,
  muted,
  bgmMuted,
  bgmTrack,
  rainMode,
  windMode,
  thunderMode,
  pomodoroMode,
  pomodoroRunning,
  pomodoroSecondsLeft,
  onOpenPomodoro,
  onChangeSpeed,
  onToggleMute,
  onToggleBgm,
  onChangeBgmTrack,
  onCycleRainMode,
  onCycleWindMode,
  onCycleThunderMode,
  onEnterPhotoMode,
  onOpenSaveModal,
  onReturnTitle,
}) => {
  const [musicMenuOpen, setMusicMenuOpen] = useState(false);
  const [musicFilter, setMusicFilter] = useState<'all' | 'study'>('all');
  const musicMenuRef = useRef<HTMLDivElement>(null);

  const weatherSpec = WEATHERS[weather];
  const seasonalSpec = seasonalEvent ? SEASONAL_EVENTS[seasonalEvent] : null;
  const activeTrack = BGM_TRACKS.find((track) => track.id === bgmTrack) ?? BGM_TRACKS[0];

  useEffect(() => {
    if (!musicMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (musicMenuRef.current && !musicMenuRef.current.contains(event.target as Node)) {
        setMusicMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMusicMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [musicMenuOpen]);

  const filteredTracks =
    musicFilter === 'study'
      ? BGM_TRACKS.filter((track) => track.category === '專注讀書')
      : BGM_TRACKS;

  const handleShuffleTrack = () => {
    const pool = filteredTracks.length > 1 ? filteredTracks : BGM_TRACKS;
    const candidates = pool.filter((track) => track.id !== bgmTrack);
    if (candidates.length === 0) return;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    onChangeBgmTrack(picked.id);
  };

  const renderWeatherIcon = () => {
    switch (weather) {
      case 'sunny':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'rainy':
        return <CloudRain className="w-4 h-4 text-sky-600" />;
      case 'heatwave':
        return <Flame className="w-4 h-4 text-orange-600" />;
      case 'breezy':
        return <Wind className="w-4 h-4 text-teal-600" />;
    }
  };

  const pomodoroActiveColor =
    pomodoroRunning
      ? pomodoroMode === 'focus'
        ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
        : 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100'
      : 'border-[#E2DDD3] bg-white hover:bg-[#FAF9F5] text-[#1A2B20]';

  return (
    <header className="w-full bg-white border-b border-[#E2DDD3] px-3 py-2 lg:px-6 lg:py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4 shrink-0">
      {/* Row 1 on mobile / Zone 1+3 split cleanly */}
      <div className="flex items-center justify-between gap-2 lg:contents">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-[#1A2B20] whitespace-nowrap">
            森之方舟動物園
          </span>
        </div>

        {/* Mobile compact right actions (hidden on lg where full Zone 3 renders) */}
        <div className="flex items-center gap-1.5 lg:hidden shrink-0">
          <button
            type="button"
            onClick={onOpenPomodoro}
            title="開啟番茄時鐘"
            className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${pomodoroActiveColor}`}
          >
            <Timer className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono-num">
              {pomodoroRunning ? formatPomodoroTime(pomodoroSecondsLeft) : '番茄鐘'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSaveModal}
            title="儲存或讀取園區存檔"
            aria-label="儲存或讀取園區存檔"
            className="min-h-[36px] min-w-[36px] px-2 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#FAF9F5] text-[#1A2B20] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4 text-emerald-700" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? '開啟全部聲音' : '全部靜音'}
            aria-label={muted ? '開啟全部聲音' : '全部靜音'}
            className="min-h-[36px] min-w-[36px] px-2 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#FAF9F5] text-[#4A5D50] flex items-center justify-center transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            title="返回主選單"
            aria-label="返回主選單"
            className="min-h-[36px] min-w-[36px] px-2 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#FAF9F5] text-[#4A5D50] flex items-center justify-center transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zone 2: Key Telemetry Metrics (horizontal scroll on narrow mobile screens) */}
      <div className="flex items-center gap-3 lg:gap-5 overflow-x-auto py-0.5 no-scrollbar">
        {/* Mobile Speed Switcher inline at start of telemetry row */}
        <div
          className="flex lg:hidden items-center bg-[#F4F2EC] p-0.5 rounded-lg border border-[#E2DDD3] shrink-0"
          role="group"
          aria-label="模擬速度控制"
        >
          <button
            type="button"
            onClick={() => onChangeSpeed(0)}
            aria-label="暫停模擬"
            className={`px-2 py-1 rounded-md text-xs font-medium flex items-center transition-colors cursor-pointer ${
              speed === 0 ? 'bg-white text-amber-700 shadow-xs' : 'text-[#5B6D60]'
            }`}
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeSpeed(1)}
            className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              speed === 1 ? 'bg-white text-emerald-800 shadow-xs' : 'text-[#5B6D60]'
            }`}
          >
            1x
          </button>
          <button
            type="button"
            onClick={() => onChangeSpeed(2)}
            className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              speed === 2 ? 'bg-white text-emerald-800 shadow-xs' : 'text-[#5B6D60]'
            }`}
          >
            2x
          </button>
        </div>

        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0" title="園區可用資金">
          <Coins className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-600" />
          <span className="text-xs text-[#5B6D60] hidden sm:inline">資金</span>
          <span
            className={`font-mono-num text-xs sm:text-sm font-bold ${
              funds < 0 ? 'text-rose-600' : 'text-[#1A2B20]'
            }`}
          >
            ${funds.toLocaleString()}
          </span>
        </div>

        <div className="h-3.5 w-px bg-[#E2DDD3] shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0" title="目前園內遊客數">
          <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-sky-700" />
          <span className="text-xs text-[#5B6D60] hidden sm:inline">遊客</span>
          <span className="font-mono-num text-xs sm:text-sm font-bold text-[#1A2B20]">{visitorCount}</span>
        </div>

        <div className="h-3.5 w-px bg-[#E2DDD3] shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0" title="目標 4.8 星通關">
          <Star className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-500 fill-amber-400" />
          <span className="text-xs text-[#5B6D60] hidden sm:inline">評價</span>
          <span className="font-mono-num text-xs sm:text-sm font-bold text-[#1A2B20]">
            {rating.toFixed(1)}
            <span className="text-[11px] font-normal text-[#7A8A7E] hidden sm:inline"> / 5.0</span>
          </span>
        </div>

        <div className="h-3.5 w-px bg-[#E2DDD3] shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0" title={weatherSpec.shortDesc}>
          {renderWeatherIcon()}
          <span className="text-xs font-semibold text-[#1A2B20]">{weatherSpec.name}</span>
          <span className="font-mono-num text-[11px] text-[#6A7B6F]">
            ({weatherDaysLeft}天)
          </span>
        </div>

        {seasonalSpec && (
          <>
            <div className="h-3.5 w-px bg-[#E2DDD3] shrink-0" aria-hidden="true" />
            <div
              className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title={seasonalSpec.shortDesc}
            >
              {seasonalSpec.id === 'spring_sakura' ? (
                <Flower2 className="w-3.5 h-3.5 text-pink-500" />
              ) : seasonalSpec.id === 'winter_snow' ? (
                <Snowflake className="w-3.5 h-3.5 text-sky-500" />
              ) : seasonalSpec.id === 'autumn_maple' ? (
                <Leaf className="w-3.5 h-3.5 text-orange-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span className="text-xs font-semibold text-[#1A2B20]">{seasonalSpec.name}</span>
              <span className="font-mono-num text-[11px] text-[#6A7B6F]">
                ({seasonalDaysLeft}天)
              </span>
            </div>
          </>
        )}

        <div className="h-3.5 w-px bg-[#E2DDD3] shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <Calendar className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-emerald-700" />
          <span className="font-mono-num text-xs sm:text-sm font-semibold text-[#1A2B20]">第 {day} 天</span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${
              isNight
                ? 'bg-indigo-950 text-indigo-100'
                : 'bg-amber-100 text-amber-900'
            }`}
            title={isNight ? '夜晚模式：聚光燈開啟，動物休息中' : '白天模式：動物活躍中'}
          >
            {isNight ? (
              <Moon className="w-3 h-3 text-indigo-300" />
            ) : (
              <Sun className="w-3 h-3 text-amber-600" />
            )}
            <span>{isNight ? '夜晚' : '白天'}</span>
          </span>
          <div className="w-14 h-1.5 bg-[#E8E4DA] rounded-full overflow-hidden hidden sm:block">
            <div
              className={`h-full transition-all duration-200 ${
                isNight ? 'bg-indigo-600' : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(100, dayProgress)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Zone 3: Playback Speed, Pomodoro & Audio Controls (desktop full bar + mobile music menu) */}
      <div className="flex items-center justify-between lg:justify-end gap-2 shrink-0">
        <div
          className="hidden lg:flex items-center bg-[#F4F2EC] p-0.5 rounded-lg border border-[#E2DDD3]"
          role="group"
          aria-label="模擬速度控制"
        >
          <button
            type="button"
            onClick={() => onChangeSpeed(0)}
            title="暫停模擬"
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              speed === 0
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-[#5B6D60] hover:text-[#1A2B20]'
            }`}
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">暫停</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSpeed(1)}
            title="正常速度"
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              speed === 1
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-[#5B6D60] hover:text-[#1A2B20]'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>1x</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSpeed(2)}
            title="兩倍速度"
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              speed === 2
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-[#5B6D60] hover:text-[#1A2B20]'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>2x</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenPomodoro}
          title="開啟園區番茄時鐘（專注讀書 / 休息計時）"
          className={`hidden lg:flex px-2.5 py-1.5 rounded-lg border text-xs font-semibold items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${pomodoroActiveColor}`}
        >
          <Timer className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono-num">
            {pomodoroRunning ? formatPomodoroTime(pomodoroSecondsLeft) : '番茄鐘'}
          </span>
        </button>

        <button
          type="button"
          onClick={onEnterPhotoMode}
          title="隱藏介面並切換至第一人稱視角遊覽拍照"
          className="hidden lg:flex px-3 py-1.5 rounded-lg border border-emerald-700/30 bg-[#059669] hover:bg-[#047857] text-xs font-semibold text-white items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>攝影模式</span>
        </button>

        <button
          type="button"
          onClick={onOpenSaveModal}
          title="儲存或讀取園區存檔"
          className="hidden lg:flex px-2.5 py-1.5 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#FAF9F5] text-xs font-semibold text-[#1A2B20] items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
        >
          <Save className="w-3.5 h-3.5 text-emerald-700" />
          <span>存檔</span>
        </button>

        <div className="relative w-full lg:w-auto" ref={musicMenuRef}>
          <div className="flex items-center rounded-lg border border-[#E2DDD3] bg-[#F4F2EC] overflow-hidden w-full lg:w-auto">
            <button
              type="button"
              onClick={onToggleBgm}
              title={bgmMuted ? '開啟背景音樂' : '靜音背景音樂'}
              aria-label={bgmMuted ? '開啟背景音樂' : '靜音背景音樂'}
              className={`min-h-[34px] lg:min-h-0 px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                bgmMuted
                  ? 'bg-[#F4F2EC] text-[#8A988E]'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span className="lg:hidden xl:inline">{bgmMuted ? '音樂關' : '音樂開'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMusicMenuOpen((prev) => !prev)}
              aria-expanded={musicMenuOpen}
              aria-haspopup="listbox"
              aria-label="選擇並套用背景音樂曲目"
              title="點擊展開曲目清單，自由點選套用音樂"
              className="flex-1 lg:flex-initial justify-between bg-white/90 hover:bg-white text-[11px] font-medium text-[#1A2B20] px-2.5 py-1.5 border-l border-[#E2DDD3] flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer min-h-[34px] lg:min-h-0"
            >
              <span className="truncate max-w-[200px] lg:max-w-[138px]">{activeTrack.name}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#6A7B6F] shrink-0 transition-transform duration-150 ${
                  musicMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {musicMenuOpen && (
            <div
              className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-28 sm:top-full sm:mt-2 sm:w-80 bg-white border border-[#E2DDD3] rounded-xl shadow-xl z-50 overflow-hidden"
              role="dialog"
              aria-label="背景音樂曲目選單"
            >
              <div className="px-3 py-2.5 border-b border-[#EFECE4] bg-[#FAF9F5] flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-[#1A2B20]">園區背景音樂</span>
                  <span className="text-[11px] text-[#6A7B6F] font-mono-num">
                    {BGM_TRACKS.length} 首可點選套用
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleShuffleTrack}
                  className="px-2 py-1 rounded-md text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>隨機換曲</span>
                </button>
              </div>

              <div className="px-3 py-2 border-b border-[#EFECE4] bg-[#FAF9F5]/65">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-[#1A2B20]">自然環境音效</span>
                  <span className="text-[10px] text-[#6A7B6F]">自動隨天氣變化或手動開啟</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={onCycleRainMode}
                    title="切換雨聲：自動 / 常駐 / 關閉"
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                      rainMode === 'on' || (rainMode === 'auto' && weather === 'rainy')
                        ? 'border-sky-300 bg-sky-50 text-sky-800'
                        : rainMode === 'off'
                        ? 'border-[#E2DDD3] bg-white text-[#8A988E]'
                        : 'border-[#E2DDD3] bg-white text-[#1A2B20] hover:bg-[#F6F4EE]'
                    }`}
                  >
                    <CloudRain className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      雨聲·{rainMode === 'on' ? '開' : rainMode === 'off' ? '關' : '自動'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onCycleWindMode}
                    title="切換風聲：自動 / 常駐 / 關閉"
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                      windMode === 'on' ||
                      (windMode === 'auto' && (weather === 'breezy' || weather === 'rainy'))
                        ? 'border-teal-300 bg-teal-50 text-teal-800'
                        : windMode === 'off'
                        ? 'border-[#E2DDD3] bg-white text-[#8A988E]'
                        : 'border-[#E2DDD3] bg-white text-[#1A2B20] hover:bg-[#F6F4EE]'
                    }`}
                  >
                    <Wind className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      風聲·{windMode === 'on' ? '開' : windMode === 'off' ? '關' : '自動'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onCycleThunderMode}
                    title="切換持續雷聲：自動 / 常駐 / 關閉"
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                      thunderMode === 'on' || (thunderMode === 'auto' && weather === 'rainy')
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : thunderMode === 'off'
                        ? 'border-[#E2DDD3] bg-white text-[#8A988E]'
                        : 'border-[#E2DDD3] bg-white text-[#1A2B20] hover:bg-[#F6F4EE]'
                    }`}
                  >
                    <CloudLightning className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      雷聲·{thunderMode === 'on' ? '開' : thunderMode === 'off' ? '關' : '自動'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="px-3 pt-2 pb-1.5 border-b border-[#EFECE4] bg-white flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMusicFilter('all')}
                  className={`flex-1 py-1 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    musicFilter === 'all'
                      ? 'bg-[#1A2B20] text-white'
                      : 'bg-[#F4F2EC] text-[#5B6D60] hover:text-[#1A2B20]'
                  }`}
                >
                  全部曲目 ({BGM_TRACKS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMusicFilter('study')}
                  className={`flex-1 py-1 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    musicFilter === 'study'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  <span>
                    專注讀書 ({BGM_TRACKS.filter((t) => t.category === '專注讀書').length})
                  </span>
                </button>
              </div>

              <div
                className="max-h-72 overflow-y-auto p-1.5 space-y-0.5"
                role="listbox"
                aria-label="背景音樂曲目列表"
              >
                {filteredTracks.map((track) => {
                  const isSelected = track.id === bgmTrack;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onChangeBgmTrack(track.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-emerald-50/90 text-emerald-950'
                          : 'hover:bg-[#F6F4EE] text-[#1A2B20]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{track.name}</div>
                        <div className="text-[11px] text-[#6A7B6F] truncate">
                          {track.category} · {track.moodDesc}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        {isSelected ? (
                          <>
                            <span className="text-[11px] font-semibold text-emerald-700">
                              {bgmMuted ? '已套用' : '播放中'}
                            </span>
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                          </>
                        ) : (
                          <span className="text-[11px] font-medium text-[#7A8A7E] opacity-0 group-hover:opacity-100 transition-opacity">
                            套用
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          title={muted ? '開啟全部聲音' : '全部靜音'}
          aria-label={muted ? '開啟全部聲音' : '全部靜音'}
          className="hidden lg:block p-2 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#FAF9F5] text-[#4A5D50] transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onReturnTitle}
          title="返回主選單"
          className="hidden lg:flex px-3 py-1.5 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#FAF9F5] text-xs font-medium text-[#4A5D50] items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">重來</span>
        </button>
      </div>
    </header>
  );
};
