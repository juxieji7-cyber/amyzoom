import React, { useEffect, useState } from 'react';
import {
  Save,
  FolderOpen,
  Trash2,
  X,
  Clock,
  Star,
  Coins,
  Calendar,
  Sparkles,
  Check,
} from 'lucide-react';
import { DifficultyMode } from '../types/zoo';
import {
  SAVE_SLOT_DEFAULT_NAMES,
  SAVE_SLOT_ORDER,
  SaveSlotId,
  ZooSaveSlotSummary,
  formatSaveTimestamp,
} from '../utils/saveSystem';

interface SaveLoadModalProps {
  isPlaying: boolean;
  slots: ZooSaveSlotSummary[];
  currentDay?: number;
  currentFunds?: number;
  currentRating?: number;
  onClose: () => void;
  onSaveSlot: (slotId: SaveSlotId, customLabel?: string) => boolean;
  onLoadSlot: (slotId: SaveSlotId) => void;
  onDeleteSlot: (slotId: SaveSlotId) => void;
}

const DIFFICULTY_LABEL: Record<DifficultyMode, string> = {
  standard: '標準開園',
  sandbox: '自由創意',
  challenge: '經營挑戰',
};

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isPlaying,
  slots,
  currentDay = 1,
  currentFunds = 0,
  currentRating = 1.0,
  onClose,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
}) => {
  const [slotNameDraft, setSlotNameDraft] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<SaveSlotId | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const showNotice = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const handleSave = (slotId: SaveSlotId) => {
    const trimmed = slotNameDraft.trim();
    const ok = onSaveSlot(slotId, trimmed || undefined);
    if (ok) {
      setSlotNameDraft('');
      showNotice(`已儲存至「${trimmed || SAVE_SLOT_DEFAULT_NAMES[slotId]}」`);
    } else {
      showNotice('存檔失敗：瀏覽器儲存空間不足');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1A2B20]/45 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="園區存檔與讀檔管理"
    >
      <div className="w-full max-w-2xl bg-white border border-[#E2DDD3] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EFECE4] bg-[#FAF9F5] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Save className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1A2B20]">園區存檔與讀檔</h2>
              <p className="text-xs text-[#5B6D60]">
                支援每日自動存檔與 3 組手動存檔欄位（儲存於本機瀏覽器）
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉存檔視窗"
            className="p-1.5 rounded-lg text-[#5B6D60] hover:text-[#1A2B20] hover:bg-[#EFECE4] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Park Status Bar + Optional Custom Save Name */}
        {isPlaying && (
          <div className="px-5 py-3 border-b border-[#EFECE4] bg-emerald-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-[#1A2B20]">
              <span className="font-semibold text-emerald-900">目前進度：</span>
              <span className="inline-flex items-center gap-1 font-mono-num">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />第 {currentDay} 天
              </span>
              <span className="inline-flex items-center gap-1 font-mono-num">
                <Coins className="w-3.5 h-3.5 text-amber-600" />${currentFunds.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1 font-mono-num">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                {currentRating.toFixed(1)}
              </span>
            </div>
            <input
              type="text"
              maxLength={22}
              value={slotNameDraft}
              onChange={(e) => setSlotNameDraft(e.target.value)}
              placeholder="自訂存檔備註（選填）"
              className="px-2.5 py-1 text-xs rounded-lg border border-[#D8D1C5] bg-white text-[#1A2B20] placeholder:text-[#8A988E] focus:outline-none focus:border-emerald-600 w-44"
            />
          </div>
        )}

        {feedbackMsg && (
          <div className="px-5 py-2 bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Slot List */}
        <div className="p-5 space-y-3 overflow-y-auto">
          {SAVE_SLOT_ORDER.map((slotId) => {
            const summary = slots.find((s) => s.slotId === slotId) ?? null;
            const isAuto = slotId === 'autosave';

            return (
              <div
                key={slotId}
                className={`rounded-xl border p-4 transition-colors ${
                  summary
                    ? isAuto
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-[#E2DDD3] bg-[#FAF9F5]'
                    : 'border-dashed border-[#D8D1C5] bg-[#FAF9F5]/50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAuto && <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                      <span className="text-sm font-bold text-[#1A2B20] truncate">
                        {summary ? summary.label : SAVE_SLOT_DEFAULT_NAMES[slotId]}
                      </span>
                      {summary && (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-white border border-[#E2DDD3] text-[#4A5D50]">
                          {DIFFICULTY_LABEL[summary.difficulty]}
                        </span>
                      )}
                    </div>

                    {summary ? (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5B6D60]">
                        <span className="font-mono-num font-semibold text-[#1A2B20]">
                          第 {summary.day} 天
                        </span>
                        <span className="font-mono-num">
                          資金 ${summary.funds.toLocaleString()}
                        </span>
                        <span className="font-mono-num">
                          評價 {summary.rating.toFixed(1)}★
                        </span>
                        <span className="font-mono-num">
                          動物 {summary.animalCount} 隻（{summary.speciesCount} 種）
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#7A8A7E]">
                          <Clock className="w-3 h-3" />
                          {formatSaveTimestamp(summary.savedAt)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-[#7A8A7E]">
                        {isAuto
                          ? '尚未建立自動存檔（遊玩至翌日或手動快速備份後自動產生）'
                          : '尚無存檔資料，點擊右側即可儲存目前園區進度'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isPlaying && (
                      <button
                        type="button"
                        onClick={() => handleSave(slotId)}
                        className="px-3 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{summary ? '覆蓋存檔' : '儲存至此'}</span>
                      </button>
                    )}

                    {summary && (
                      <button
                        type="button"
                        onClick={() => onLoadSlot(slotId)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-700/30 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>讀取</span>
                      </button>
                    )}

                    {summary && (
                      confirmDeleteId === slotId ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteSlot(slotId);
                            setConfirmDeleteId(null);
                            showNotice('已刪除存檔紀錄');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          確認刪除
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(slotId)}
                          title="刪除此存檔"
                          aria-label="刪除此存檔"
                          className="p-1.5 rounded-lg border border-[#E2DDD3] bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-[#6A7B6F] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EFECE4] bg-[#FAF9F5] flex items-center justify-between text-xs text-[#6A7B6F]">
          <span>提示：每當遊戲進入新的一天時，系統也會自動備份至「每日自動存檔」。</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-[#D8D1C5] bg-white hover:bg-[#F4F2EC] text-[#1A2B20] font-medium cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
