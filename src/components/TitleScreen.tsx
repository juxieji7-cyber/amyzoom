import React, { useState } from 'react';
import {
  Play,
  Compass,
  HeartHandshake,
  Sparkles,
  FolderOpen,
  Clock,
  Heart,
  RefreshCw,
  CalendarHeart,
} from 'lucide-react';
import { TITLE_BANNER_IMAGE } from '../data/zooCatalog';
import { DifficultyMode } from '../types/zoo';
import { ZooSaveSlotSummary, formatSaveTimestamp } from '../utils/saveSystem';

interface TitleScreenProps {
  onStartGame: (mode: DifficultyMode) => void;
  latestSave: ZooSaveSlotSummary | null;
  offlineDays?: number;
  hasAnySave: boolean;
  onContinueLatestSave: () => void;
  onOpenSaveModal: () => void;
  startupEncouragement: { text: string; isCustom: boolean };
  onRefreshEncouragement: () => void;
  onOpenPeriodTracker: () => void;
}

const MODES: Array<{
  id: DifficultyMode;
  label: string;
  funds: string;
  summary: string;
}> = [
  {
    id: 'standard',
    label: '標準開園',
    funds: '起始資金 $1,200',
    summary: '均衡的門票收益與照護支出，適合體驗完整園區規劃。',
  },
  {
    id: 'sandbox',
    label: '自由創意',
    funds: '起始資金 $2,800',
    summary: '附贈兩座基礎棲地與充裕預算，盡情打造夢想生態園區。',
  },
  {
    id: 'challenge',
    label: '經營挑戰',
    funds: '起始資金 $750',
    summary: '嚴格考驗動線規劃與資金周轉，挑戰精準經營實力。',
  },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  latestSave,
  offlineDays = 0,
  hasAnySave,
  onContinueLatestSave,
  onOpenSaveModal,
  startupEncouragement,
  onRefreshEncouragement,
  onOpenPeriodTracker,
}) => {
  const [selectedMode, setSelectedMode] = useState<DifficultyMode>('standard');
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F2EC] text-[#1A2B20] flex flex-col items-center justify-center p-3 sm:p-6 md:p-10">
      <div className="w-full max-w-5xl bg-white border border-[#E2DDD3] rounded-2xl overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left: Illustrated Park Artwork */}
        <div className="lg:col-span-7 relative bg-[#D9E7D5] min-h-[200px] sm:min-h-[280px] lg:min-h-[540px]">
          {!imgError ? (
            <img
              src={TITLE_BANNER_IMAGE}
              alt="森之方舟動物園全景插畫"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-emerald-800 to-teal-900 text-white">
              <Compass className="w-14 h-14 mb-3 opacity-80" />
              <p className="text-xl font-bold">森之方舟動物園</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A2B20]/85 via-[#1A2B20]/20 to-transparent flex flex-col justify-end p-6 md:p-8 text-white">
            <p className="text-xs font-medium tracking-wide text-emerald-200 mb-1.5">
              生態園區規劃 · 動物照護模擬
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-balance">
              森之方舟動物園
            </h1>
            <p className="mt-2 text-sm text-stone-200 max-w-md leading-relaxed">
              在立體 3D 園區中鋪設石板步道、打造專屬動物棲地區域，迎來各有裝扮與聲線的遊客，逐步邁向五星級動物園。
            </p>
          </div>
        </div>

        {/* Right: Mode Selection & Game Guide */}
        <div className="lg:col-span-5 p-4 sm:p-6 md:p-8 flex flex-col justify-between gap-5 bg-white">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#1A2B20] mb-3">核心玩法</h2>
              <ul className="space-y-2 text-sm text-[#4A5D50]">
                <li className="flex items-start gap-2.5">
                  <Compass className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                  <span>鋪設連接入口的石板步道，遊客才會走進各個棲地參觀並消費。</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <HeartHandshake className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                  <span>定期餵食、清潔與提供玩具，也可雇用保育員自動照護動物。</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                  <span>搭配輕食攤、長椅與觀景花圃提升好評，達成 4.8 星通關評價。</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-rose-900 truncate">
                    今日經期鼓勵
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/90 border border-rose-200 text-rose-700 shrink-0">
                    {startupEncouragement.isCustom ? '自訂語錄' : '暖心推薦'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={onRefreshEncouragement}
                    title="隨機換一句鼓勵話語"
                    className="px-2 py-1 rounded-md bg-white border border-rose-200 hover:bg-rose-100/70 text-[11px] font-semibold text-rose-800 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>換一句</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPeriodTracker}
                    title="開啟月經週期紀錄表並自訂話語"
                    className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <CalendarHeart className="w-3 h-3" />
                    <span>週期表</span>
                  </button>
                </div>
              </div>
              <p className="text-xs font-medium text-[#1A2B20] leading-relaxed">
                「{startupEncouragement.text}」
              </p>
            </div>

            {latestSave && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-900">已有儲存進度</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#5B6D60]">
                    <Clock className="w-3 h-3" />
                    {formatSaveTimestamp(latestSave.savedAt)}
                  </span>
                </div>
                <div className="text-xs text-[#1A2B20] font-mono-num">
                  {latestSave.label} · 第 {latestSave.day} 天 · ${latestSave.funds.toLocaleString()} · {latestSave.rating.toFixed(1)}★
                </div>
                {offlineDays >= 1 && (
                  <p className="text-xs font-semibold text-amber-800">
                    已休園離線 {offlineDays} 天 · 繼續進度即可領取離線經營獎勵
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onContinueLatestSave}
                    className="flex-1 min-h-[44px] py-2 px-3 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>繼續上次進度</span>
                  </button>
                  {hasAnySave && (
                    <button
                      type="button"
                      onClick={onOpenSaveModal}
                      className="min-h-[44px] py-2 px-3 rounded-lg border border-[#D8D1C5] bg-white hover:bg-[#FAF9F5] text-[#1A2B20] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-emerald-700" />
                      <span>讀取存檔</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold text-[#1A2B20] mb-2.5">選擇開園模式</h2>
              <div className="space-y-2">
                {MODES.map((mode) => {
                  const active = selectedMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSelectedMode(mode.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        active
                          ? 'border-emerald-700 bg-emerald-50/70'
                          : 'border-[#E2DDD3] bg-[#FAF9F5] hover:border-[#C7BFB0]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-[#1A2B20]">{mode.label}</span>
                        <span className="font-mono-num text-xs text-emerald-800 font-medium">
                          {mode.funds}
                        </span>
                      </div>
                      <p className="text-xs text-[#5B6D60] mt-1 leading-relaxed">{mode.summary}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartGame(selectedMode)}
            className="w-full min-h-[48px] py-3.5 px-5 bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white font-semibold text-base rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>開始經營新動物園</span>
          </button>
        </div>
      </div>
    </div>
  );
};

