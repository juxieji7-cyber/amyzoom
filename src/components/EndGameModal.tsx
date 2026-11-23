import React from 'react';
import { Trophy, AlertTriangle, RotateCcw, ArrowRight } from 'lucide-react';
import { GameState, ParkStats } from '../types/zoo';

interface EndGameModalProps {
  gameState: Extract<GameState, 'GAME_OVER' | 'VICTORY'>;
  stats: ParkStats;
  funds: number;
  rating: number;
  animalCount: number;
  speciesCount: number;
  onContinuePlaying: () => void;
  onRestart: () => void;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({
  gameState,
  stats,
  funds,
  rating,
  animalCount,
  speciesCount,
  onContinuePlaying,
  onRestart,
}) => {
  const isVictory = gameState === 'VICTORY';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1A2B20]/65 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="endgame-title"
    >
      <div className="w-full max-w-md bg-white border border-[#E2DDD3] rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isVictory ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {isVictory ? <Trophy className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h2 id="endgame-title" className="text-xl font-bold text-[#1A2B20]">
              {isVictory ? '五星級傳奇動物園達成！' : '園區資金週轉困難'}
            </h2>
            <p className="text-sm text-[#5B6D60] mt-0.5">
              {isVictory
                ? '你的生態規劃與動物照護贏得了所有遊客的讚譽。'
                : '連續多日負債導致無法維持園區營運，需要重新規劃收支。'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 my-6 bg-[#FAF9F5] border border-[#E2DDD3] rounded-xl p-4">
          <div>
            <p className="text-xs text-[#5B6D60]">經營天數</p>
            <p className="font-mono-num text-lg font-bold text-[#1A2B20]">
              {stats.daysSurvived} 天
            </p>
          </div>
          <div>
            <p className="text-xs text-[#5B6D60]">累計接待遊客</p>
            <p className="font-mono-num text-lg font-bold text-[#1A2B20]">
              {stats.totalVisitors} 位
            </p>
          </div>
          <div>
            <p className="text-xs text-[#5B6D60]">照護動物 / 物種</p>
            <p className="font-mono-num text-lg font-bold text-[#1A2B20]">
              {animalCount} 隻 · {speciesCount} 種
            </p>
          </div>
          <div>
            <p className="text-xs text-[#5B6D60]">園區最終評價</p>
            <p className="font-mono-num text-lg font-bold text-amber-700">
              {rating.toFixed(1)} / 5.0
            </p>
          </div>
          <div className="col-span-2 pt-2 border-t border-[#E2DDD3] flex items-center justify-between">
            <span className="text-xs text-[#5B6D60]">當前資金 / 歷史最高</span>
            <span className="font-mono-num text-sm font-bold text-[#1A2B20]">
              ${funds.toLocaleString()} / ${stats.peakFunds.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isVictory && (
            <button
              type="button"
              onClick={onContinuePlaying}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <span>繼續自由經營</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              isVictory
                ? 'border border-[#E2DDD3] bg-white hover:bg-[#FAF9F5] text-[#1A2B20]'
                : 'bg-[#059669] hover:bg-[#047857] text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>再玩一次</span>
          </button>
        </div>
      </div>
    </div>
  );
};
