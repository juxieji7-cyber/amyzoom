import React from 'react';
import { Calendar, Coins, PawPrint, Sparkles, TrendingUp } from 'lucide-react';

export interface OfflineRewardSummary {
  elapsedDays: number;
  effectiveDays: number;
  dailyRevenue: number;
  animalCount: number;
  speciesCount: number;
  revenuePartPerDay: number;
  animalPartPerDay: number;
  totalReward: number;
  lastClosedLabel: string;
}

interface OfflineRewardModalProps {
  reward: OfflineRewardSummary;
  onClaim: () => void;
}

export const OfflineRewardModal: React.FC<OfflineRewardModalProps> = ({ reward, onClaim }) => {
  const dailyTotal = reward.revenuePartPerDay + reward.animalPartPerDay;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1A2B20]/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-reward-title"
    >
      <div className="w-full max-w-md bg-white border border-[#E2DDD3] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 id="offline-reward-title" className="text-xl font-bold text-[#1A2B20]">
              離線經營成果結算
            </h2>
            <p className="text-xs sm:text-sm text-[#5B6D60] mt-0.5 leading-relaxed">
              在你休園離開的{' '}
              <span className="font-mono-num font-bold text-[#1A2B20]">
                {reward.elapsedDays}
              </span>{' '}
              天期間，動物與保育團隊仍持續運作，已為你累積園區收益！
            </p>
            {reward.lastClosedLabel && (
              <p className="text-[11px] text-[#7A8A7E] mt-1 font-mono-num">
                上次離開：{reward.lastClosedLabel}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/75 p-4 text-center">
          <p className="text-xs font-semibold text-emerald-900">本次補發離線經營獎勵</p>
          <p className="font-mono-num text-3xl font-bold text-emerald-800 mt-1 flex items-center justify-center gap-2">
            <Coins className="w-6 h-6 text-amber-600 shrink-0" />
            <span>+${reward.totalReward.toLocaleString()}</span>
          </p>
          {reward.elapsedDays > reward.effectiveDays && (
            <p className="text-[11px] text-[#5B6D60] mt-1">
              單次返園最多結算 {reward.effectiveDays} 天營運獎勵
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 bg-[#FAF9F5] border border-[#E2DDD3] rounded-xl p-3.5 text-xs">
          <div>
            <p className="text-[#5B6D60] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>離線經過天數</span>
            </p>
            <p className="font-mono-num text-base font-bold text-[#1A2B20] mt-0.5">
              {reward.elapsedDays} 天
            </p>
          </div>

          <div>
            <p className="text-[#5B6D60] flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>園區每日收入基準</span>
            </p>
            <p className="font-mono-num text-base font-bold text-[#1A2B20] mt-0.5">
              ${reward.dailyRevenue.toLocaleString()} / 天
            </p>
          </div>

          <div>
            <p className="text-[#5B6D60] flex items-center gap-1">
              <PawPrint className="w-3.5 h-3.5 text-sky-700 shrink-0" />
              <span>園區動物規模</span>
            </p>
            <p className="font-mono-num text-base font-bold text-[#1A2B20] mt-0.5">
              {reward.animalCount} 隻 · {reward.speciesCount} 種
            </p>
          </div>

          <div>
            <p className="text-[#5B6D60]">每日淨補助</p>
            <p className="font-mono-num text-base font-bold text-emerald-800 mt-0.5">
              +${dailyTotal.toLocaleString()} / 天
            </p>
          </div>

          <div className="col-span-2 pt-2.5 border-t border-[#E2DDD3] flex items-center justify-between gap-2 text-[11px] text-[#5B6D60]">
            <span>每日收益明細</span>
            <span className="font-mono-num text-[#1A2B20] font-semibold">
              收入分潤 ${reward.revenuePartPerDay.toLocaleString()} + 動物加碼 $
              {reward.animalPartPerDay.toLocaleString()}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClaim}
          className="w-full min-h-[48px] py-3 px-5 rounded-xl bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white text-sm font-bold transition-all cursor-pointer shadow-xs"
        >
          開心領取獎勵並繼續經營
        </button>
      </div>
    </div>
  );
};
