import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarHeart,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Droplet,
  Heart,
  Minus,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import {
  CustomEncouragement,
  CycleAnalysis,
  DEFAULT_ENCOURAGEMENTS_BY_PHASE,
  DailyCycleLog,
  FLOW_OPTIONS,
  FlowLevel,
  MOOD_OPTIONS,
  PeriodMoodId,
  PeriodSegment,
  PeriodSymptomId,
  PeriodTrackerState,
  SYMPTOM_OPTIONS,
  addDays,
  buildPeriodLogsCsv,
  formatDateObj,
  formatFullZhDate,
  formatShortZhDate,
  getTodayDateStr,
  parseDateStr,
} from '../utils/periodTracker';

interface PeriodTrackerModalProps {
  trackerState: PeriodTrackerState;
  analysis: CycleAnalysis;
  onUpdateState: (updater: (prev: PeriodTrackerState) => PeriodTrackerState) => void;
  onClose: () => void;
}

type TrackerTab = 'calendar' | 'table' | 'settings';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export const PeriodTrackerModal: React.FC<PeriodTrackerModalProps> = ({
  trackerState,
  analysis,
  onUpdateState,
  onClose,
}) => {
  const todayStr = getTodayDateStr();
  const [activeTab, setActiveTab] = useState<TrackerTab>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewYear, setViewYear] = useState<number>(() => parseDateStr(todayStr).getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => parseDateStr(todayStr).getMonth());
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);
  const [encouragementOpen, setEncouragementOpen] = useState<boolean>(false);
  const [newEncouragementText, setNewEncouragementText] = useState<string>('');
  const [editingEncId, setEditingEncId] = useState<string | null>(null);
  const [editingEncText, setEditingEncText] = useState<string>('');
  const [quoteOffset, setQuoteOffset] = useState<number>(() => Math.floor(Math.random() * 997));
  const [ignorePinForBrowse, setIgnorePinForBrowse] = useState<boolean>(false);
  const [justSavedMsg, setJustSavedMsg] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingEncId) {
          setEditingEncId(null);
          return;
        }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingEncId, onClose]);

  const selectedLog: DailyCycleLog = trackerState.logs[selectedDate] ?? {
    date: selectedDate,
    isPeriodDay: false,
    symptoms: [],
  };

  const todayLog = trackerState.logs[todayStr];
  const isTodayPeriod = Boolean(todayLog?.isPeriodDay);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1, 12, 0, 0, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0, 12, 0, 0, 0).getDate();

    const cells: Array<{ dateStr: string; dayNum: number; inMonth: boolean }> = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dt = new Date(viewYear, viewMonth, -i, 12, 0, 0, 0);
      cells.push({ dateStr: formatDateObj(dt), dayNum: dt.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d, 12, 0, 0, 0);
      cells.push({ dateStr: formatDateObj(dt), dayNum: d, inMonth: true });
    }
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      const dt = new Date(viewYear, viewMonth + 1, i, 12, 0, 0, 0);
      cells.push({ dateStr: formatDateObj(dt), dayNum: dt.getDate(), inMonth: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const upsertLog = (dateStr: string, updater: (prev: DailyCycleLog) => DailyCycleLog | null) => {
    onUpdateState((prev) => {
      const existing: DailyCycleLog = prev.logs[dateStr] ?? {
        date: dateStr,
        isPeriodDay: false,
        symptoms: [],
      };
      const updated = updater(existing);
      const nextLogs = { ...prev.logs };
      if (
        !updated ||
        (!updated.isPeriodDay &&
          updated.symptoms.length === 0 &&
          !updated.mood &&
          !(updated.note && updated.note.trim()))
      ) {
        delete nextLogs[dateStr];
      } else {
        nextLogs[dateStr] = updated;
      }
      return { ...prev, logs: nextLogs };
    });
  };

  const handleTogglePeriodDay = (dateStr: string) => {
    upsertLog(dateStr, (curr) => {
      const nextIsPeriod = !curr.isPeriodDay;
      return {
        ...curr,
        isPeriodDay: nextIsPeriod,
        flow: nextIsPeriod ? curr.flow ?? 'medium' : undefined,
      };
    });
  };

  const handleMarkConsecutiveDays = (startDate: string, count: number) => {
    onUpdateState((prev) => {
      const nextLogs = { ...prev.logs };
      for (let i = 0; i < count; i++) {
        const d = addDays(startDate, i);
        const existing = nextLogs[d] ?? { date: d, isPeriodDay: false, symptoms: [] };
        const defaultFlow: FlowLevel = i === 0 ? 'medium' : i <= 2 ? 'medium' : 'light';
        nextLogs[d] = {
          ...existing,
          isPeriodDay: true,
          flow: existing.flow ?? defaultFlow,
        };
      }
      return { ...prev, logs: nextLogs };
    });
  };

  const handleQuickTodayPeriodToggle = () => {
    if (isTodayPeriod) {
      handleTogglePeriodDay(todayStr);
    } else {
      handleMarkConsecutiveDays(todayStr, trackerState.settings.defaultPeriodLength);
      setSelectedDate(todayStr);
      const dt = parseDateStr(todayStr);
      setViewYear(dt.getFullYear());
      setViewMonth(dt.getMonth());
    }
  };

  const handleSelectFlow = (flow: FlowLevel) => {
    upsertLog(selectedDate, (curr) => ({
      ...curr,
      isPeriodDay: true,
      flow,
    }));
  };

  const handleToggleSymptom = (symptom: PeriodSymptomId) => {
    upsertLog(selectedDate, (curr) => {
      const exists = curr.symptoms.includes(symptom);
      return {
        ...curr,
        symptoms: exists
          ? curr.symptoms.filter((s) => s !== symptom)
          : [...curr.symptoms, symptom],
      };
    });
  };

  const handleSelectMood = (mood: PeriodMoodId) => {
    upsertLog(selectedDate, (curr) => ({
      ...curr,
      mood: curr.mood === mood ? undefined : mood,
    }));
  };

  const handleChangeNote = (note: string) => {
    upsertLog(selectedDate, (curr) => ({
      ...curr,
      note,
    }));
  };

  const handleDeleteSegment = (seg: PeriodSegment) => {
    onUpdateState((prev) => {
      const nextLogs = { ...prev.logs };
      const totalSpan = analysis.segments.find((s) => s.id === seg.id)?.durationDays ?? 1;
      for (let i = 0; i < totalSpan; i++) {
        const d = addDays(seg.startDate, i);
        const entry = nextLogs[d];
        if (!entry) continue;
        const cleaned: DailyCycleLog = { ...entry, isPeriodDay: false, flow: undefined };
        if (cleaned.symptoms.length === 0 && !cleaned.mood && !(cleaned.note && cleaned.note.trim())) {
          delete nextLogs[d];
        } else {
          nextLogs[d] = cleaned;
        }
      }
      return { ...prev, logs: nextLogs };
    });
  };

  const handleJumpToDate = (dateStr: string) => {
    const dt = parseDateStr(dateStr);
    setViewYear(dt.getFullYear());
    setViewMonth(dt.getMonth());
    setSelectedDate(dateStr);
    setActiveTab('calendar');
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleExportCsv = () => {
    const csv = buildPeriodLogsCsv(trackerState.logs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `月經週期紀錄表_${todayStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sortedDailyLogs = useMemo(
    () => Object.values(trackerState.logs).sort((a, b) => b.date.localeCompare(a.date)),
    [trackerState.logs]
  );

  const flowLabelMap = useMemo(
    () => Object.fromEntries(FLOW_OPTIONS.map((f) => [f.id, f.label])) as Record<FlowLevel, string>,
    []
  );
  const symptomLabelMap = useMemo(
    () =>
      Object.fromEntries(SYMPTOM_OPTIONS.map((s) => [s.id, s.label])) as Record<
        PeriodSymptomId,
        string
      >,
    []
  );
  const moodMap = useMemo(
    () =>
      Object.fromEntries(MOOD_OPTIONS.map((m) => [m.id, m])) as Record<
        PeriodMoodId,
        (typeof MOOD_OPTIONS)[number]
      >,
    []
  );

  const countdownText =
    analysis.daysUntilNextPeriod === null
      ? '待建立紀錄'
      : analysis.daysUntilNextPeriod === 0
      ? '預計今日開始'
      : analysis.daysUntilNextPeriod > 0
      ? `還有 ${analysis.daysUntilNextPeriod} 天`
      : `已延後 ${Math.abs(analysis.daysUntilNextPeriod)} 天`;

  const availableEncouragements = useMemo(() => {
    const customItems = trackerState.customEncouragements.map((item) => ({
      id: item.id,
      text: item.text,
      isCustom: true,
    }));
    const phaseDefaults = DEFAULT_ENCOURAGEMENTS_BY_PHASE[analysis.currentPhase].map(
      (text, idx) => ({
        id: `default_${analysis.currentPhase}_${idx}`,
        text,
        isCustom: false,
      })
    );
    return [...customItems, ...phaseDefaults];
  }, [trackerState.customEncouragements, analysis.currentPhase]);

  const pinnedCustomItem = useMemo(
    () =>
      trackerState.pinnedEncouragementId
        ? trackerState.customEncouragements.find(
            (item) => item.id === trackerState.pinnedEncouragementId
          ) ?? null
        : null,
    [trackerState.customEncouragements, trackerState.pinnedEncouragementId]
  );

  const activeEncouragement = useMemo(() => {
    if (pinnedCustomItem && !ignorePinForBrowse) {
      return {
        id: pinnedCustomItem.id,
        text: pinnedCustomItem.text,
        isCustom: true,
        isPinned: true,
      };
    }
    const list = availableEncouragements;
    const picked = list[quoteOffset % list.length];
    return {
      ...picked,
      isPinned: Boolean(pinnedCustomItem && picked.id === pinnedCustomItem.id),
    };
  }, [availableEncouragements, ignorePinForBrowse, pinnedCustomItem, quoteOffset]);

  const handleNextEncouragement = () => {
    setIgnorePinForBrowse(true);
    setQuoteOffset((prev) => (prev + 1) % Math.max(1, availableEncouragements.length));
  };

  const handleAddCustomEncouragement = (rawText?: string) => {
    const trimmed = (rawText ?? newEncouragementText).trim();
    if (!trimmed) return;
    const newItem: CustomEncouragement = {
      id: `enc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      createdAt: Date.now(),
    };
    onUpdateState((prev) => ({
      ...prev,
      customEncouragements: [newItem, ...prev.customEncouragements],
    }));
    setNewEncouragementText('');
    setIgnorePinForBrowse(true);
    setQuoteOffset(0);
    setJustSavedMsg(true);
    window.setTimeout(() => setJustSavedMsg(false), 2400);
  };

  const handleTogglePinEncouragement = (id: string) => {
    onUpdateState((prev) => ({
      ...prev,
      pinnedEncouragementId: prev.pinnedEncouragementId === id ? null : id,
    }));
    setIgnorePinForBrowse(false);
  };

  const handleSaveEditEncouragement = (id: string) => {
    const trimmed = editingEncText.trim();
    if (!trimmed) return;
    onUpdateState((prev) => ({
      ...prev,
      customEncouragements: prev.customEncouragements.map((item) =>
        item.id === id ? { ...item, text: trimmed } : item
      ),
    }));
    setEditingEncId(null);
    setEditingEncText('');
  };

  const handleDeleteCustomEncouragement = (id: string) => {
    onUpdateState((prev) => ({
      ...prev,
      customEncouragements: prev.customEncouragements.filter((item) => item.id !== id),
      pinnedEncouragementId:
        prev.pinnedEncouragementId === id ? null : prev.pinnedEncouragementId,
    }));
    if (editingEncId === id) {
      setEditingEncId(null);
      setEditingEncText('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="月經週期紀錄表"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl my-auto bg-white border border-[#E2DDD3] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#EFECE4] bg-[#FAF9F5] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
              <CalendarHeart className="w-5 h-5 text-rose-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#1A2B20] truncate">月經週期紀錄表</h2>
              <p className="text-[11px] text-[#5B6D60] truncate">
                本機隱私儲存 · 自動推算週期階段與下次經期預測
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="關閉月經週期紀錄表"
            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl hover:bg-[#EFECE4] text-[#5B6D60] hover:text-[#1A2B20] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4">
          {/* Cycle Overview Summary Card */}
          <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/85 via-[#FFFDFB] to-amber-50/45 p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {analysis.currentCycleDay !== null && (
                    <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white">
                      週期第 {analysis.currentCycleDay} 天
                    </span>
                  )}
                  <span className="text-sm font-bold text-[#1A2B20]">{analysis.phaseLabel}</span>
                </div>
                <p className="text-xs text-[#4A5D50] leading-relaxed">{analysis.phaseAdvice}</p>
              </div>

              <button
                type="button"
                onClick={handleQuickTodayPeriodToggle}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer shadow-xs ${
                  isTodayPeriod
                    ? 'bg-white border border-rose-300 text-rose-700 hover:bg-rose-50'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                <Droplet className="w-3.5 h-3.5" />
                <span>{isTodayPeriod ? '取消今日經期標記' : '今天經期來了'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 border-t border-rose-200/60">
              <div className="rounded-xl bg-white/90 border border-[#EFECE4] px-2.5 py-2">
                <span className="text-[11px] text-[#6A7B6F] block">下次經期預測</span>
                <span className="text-xs sm:text-sm font-bold text-rose-700 font-mono-num">
                  {analysis.nextPeriodStart
                    ? `${formatShortZhDate(analysis.nextPeriodStart)}（${countdownText}）`
                    : '尚未建立'}
                </span>
              </div>
              <div className="rounded-xl bg-white/90 border border-[#EFECE4] px-2.5 py-2">
                <span className="text-[11px] text-[#6A7B6F] block">平均週期長度</span>
                <span className="text-xs sm:text-sm font-bold text-[#1A2B20] font-mono-num">
                  {analysis.effectiveCycleLength} 天
                </span>
              </div>
              <div className="rounded-xl bg-white/90 border border-[#EFECE4] px-2.5 py-2">
                <span className="text-[11px] text-[#6A7B6F] block">平均經期天數</span>
                <span className="text-xs sm:text-sm font-bold text-[#1A2B20] font-mono-num">
                  {analysis.effectivePeriodLength} 天
                </span>
              </div>
              <div className="rounded-xl bg-white/90 border border-[#EFECE4] px-2.5 py-2">
                <span className="text-[11px] text-[#6A7B6F] block">預計排卵 / 紀錄數</span>
                <span className="text-xs sm:text-sm font-bold text-[#1A2B20] font-mono-num">
                  {analysis.ovulationDate ? formatShortZhDate(analysis.ovulationDate) : '—'} ·{' '}
                  {analysis.segments.length} 次
                </span>
              </div>
            </div>

            {/* Warm Encouragement Quote + Self-Written Custom Editor */}
            <div className="rounded-xl bg-white/95 border border-rose-200/80 p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="text-[11px] font-bold text-rose-800">
                        週期鼓勵話語
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          activeEncouragement.isCustom
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-[#F4F2EC] text-[#5B6D60]'
                        }`}
                      >
                        {activeEncouragement.isPinned
                          ? '置頂自訂語錄'
                          : activeEncouragement.isCustom
                          ? '我的自訂話語'
                          : '階段暖心語'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-[13px] font-semibold text-[#1A2B20] leading-relaxed">
                      「{activeEncouragement.text}」
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleNextEncouragement}
                    title="換一句鼓勵話語"
                    className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[#E2DDD3] bg-[#FAF9F5] hover:bg-[#F1EFE7] text-[11px] font-semibold text-[#4A5D50] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>換一句</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEncouragementOpen((prev) => !prev)}
                    aria-expanded={encouragementOpen}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                      encouragementOpen
                        ? 'border-rose-400 bg-rose-600 text-white'
                        : 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800'
                    }`}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>
                      管理語錄 ({trackerState.customEncouragements.length})
                    </span>
                  </button>
                </div>
              </div>

              {/* Always-visible custom daily period encouragement input */}
              <div className="pt-2 border-t border-[#EFECE4] space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    id="period-custom-encouragement-input"
                    type="text"
                    maxLength={100}
                    value={newEncouragementText}
                    onChange={(e) => setNewEncouragementText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomEncouragement();
                      }
                    }}
                    placeholder="自訂每日經期鼓勵話語（儲存後開啟遊戲將隨機顯示）"
                    className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] focus:bg-white focus:border-rose-400 focus:outline-none text-xs text-[#1A2B20] placeholder:text-[#8A988E]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCustomEncouragement()}
                    disabled={!newEncouragementText.trim()}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-45 text-white text-xs font-bold whitespace-nowrap cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    儲存話語
                  </button>
                </div>
                {justSavedMsg && (
                  <p className="text-[11px] font-semibold text-emerald-700">
                    已儲存至本機，開啟遊戲時將隨機顯示你的鼓勵話語！
                  </p>
                )}
              </div>

              {encouragementOpen && (
                <div className="pt-2 border-t border-[#EFECE4] space-y-2.5">
                  {trackerState.customEncouragements.length === 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#5B6D60]">
                      <span>靈感範例（點擊快速加入）：</span>
                      {[
                        '今天只要舒服地照顧好自己就滿分了',
                        '喝杯熱可可，給自己一個大大的擁抱',
                        '情緒起伏沒關係，我永遠站在自己這邊',
                      ].map((sample) => (
                        <button
                          key={sample}
                          type="button"
                          onClick={() => handleAddCustomEncouragement(sample)}
                          className="px-2 py-0.5 rounded-md border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-800 cursor-pointer transition-colors"
                        >
                          + {sample}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                      {trackerState.customEncouragements.map((item) => {
                        const isPinned = trackerState.pinnedEncouragementId === item.id;
                        const isEditing = editingEncId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs ${
                              isPinned
                                ? 'border-rose-300 bg-rose-50/60'
                                : 'border-[#ECE7DC] bg-[#FAF9F5]'
                            }`}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 flex-1">
                                <input
                                  type="text"
                                  maxLength={100}
                                  value={editingEncText}
                                  onChange={(e) => setEditingEncText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEditEncouragement(item.id);
                                    } else if (e.key === 'Escape') {
                                      setEditingEncId(null);
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 rounded-md border border-rose-300 bg-white text-xs text-[#1A2B20] focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditEncouragement(item.id)}
                                  aria-label="儲存修改"
                                  className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingEncId(null)}
                                  aria-label="取消修改"
                                  className="p-1 rounded-md border border-[#E2DDD3] bg-white text-[#5B6D60] cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-[#1A2B20] font-medium flex-1 break-words">
                                  {item.text}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePinEncouragement(item.id)}
                                    title={isPinned ? '取消置頂' : '設為優先顯示'}
                                    aria-label={isPinned ? '取消置頂' : '設為優先顯示'}
                                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                                      isPinned
                                        ? 'bg-rose-600 text-white'
                                        : 'text-[#6A7B6F] hover:bg-white hover:text-rose-700'
                                    }`}
                                  >
                                    <Pin className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEncId(item.id);
                                      setEditingEncText(item.text);
                                    }}
                                    title="編輯這句話"
                                    aria-label="編輯這句話"
                                    className="p-1 rounded-md text-[#6A7B6F] hover:bg-white hover:text-[#1A2B20] transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomEncouragement(item.id)}
                                    title="刪除這句話"
                                    aria-label="刪除這句話"
                                    className="p-1 rounded-md text-[#6A7B6F] hover:bg-white hover:text-rose-700 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sub-navigation Tabs */}
          <div
            className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F4F2EC] border border-[#E2DDD3]"
            role="tablist"
            aria-label="月經週期功能分頁"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'calendar'}
              onClick={() => setActiveTab('calendar')}
              className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-white text-[#1A2B20] shadow-xs'
                  : 'text-[#5B6D60] hover:text-[#1A2B20]'
              }`}
            >
              <CalendarHeart className="w-3.5 h-3.5 text-rose-600" />
              <span>月曆與每日紀錄</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'table'}
              onClick={() => setActiveTab('table')}
              className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-white text-[#1A2B20] shadow-xs'
                  : 'text-[#5B6D60] hover:text-[#1A2B20]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>週期歷史紀錄表 ({analysis.segments.length})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-[#1A2B20] shadow-xs'
                  : 'text-[#5B6D60] hover:text-[#1A2B20]'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 text-[#5B6D60]" />
              <span>週期設定</span>
            </button>
          </div>

          {/* TAB 1: Interactive Calendar + Daily Log Editor */}
          {activeTab === 'calendar' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Calendar Grid */}
              <div className="md:col-span-7 rounded-2xl border border-[#E2DDD3] bg-[#FAF9F5] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      aria-label="上個月"
                      className="w-8 h-8 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#F1EFE7] flex items-center justify-center text-[#1A2B20] cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono-num text-sm font-bold text-[#1A2B20] px-2">
                      {viewYear} 年 {viewMonth + 1} 月
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      aria-label="下個月"
                      className="w-8 h-8 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#F1EFE7] flex items-center justify-center text-[#1A2B20] cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleJumpToDate(todayStr)}
                    className="px-2.5 py-1 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#F1EFE7] text-[11px] font-semibold text-[#4A5D50] cursor-pointer"
                  >
                    回到今天
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_LABELS.map((w) => (
                    <div key={w} className="text-[11px] font-semibold text-[#6A7B6F] py-1">
                      {w}
                    </div>
                  ))}
                  {calendarCells.map((cell) => {
                    const log = trackerState.logs[cell.dateStr];
                    const isPeriod = Boolean(log?.isPeriodDay);
                    const isPredictedPeriod =
                      !isPeriod && analysis.predictedPeriodDates.has(cell.dateStr);
                    const isOvulation =
                      !isPeriod && analysis.predictedOvulationDates.has(cell.dateStr);
                    const isFertile =
                      !isPeriod &&
                      !isPredictedPeriod &&
                      analysis.predictedFertileDates.has(cell.dateStr);
                    const isSelected = cell.dateStr === selectedDate;
                    const isToday = cell.dateStr === todayStr;
                    const hasDetails = Boolean(
                      log && (log.symptoms.length > 0 || log.mood || (log.note && log.note.trim()))
                    );

                    let cellClass = 'bg-white border-[#ECE7DC] text-[#1A2B20] hover:border-[#C9C1B2]';
                    if (!cell.inMonth) {
                      cellClass = 'bg-white/45 border-transparent text-[#9BA89E]';
                    }
                    if (isPeriod) {
                      cellClass = 'bg-rose-500 border-rose-600 text-white hover:bg-rose-600';
                    } else if (isPredictedPeriod) {
                      cellClass =
                        'bg-rose-50 border-dashed border-rose-400 text-rose-800 hover:bg-rose-100/70';
                    } else if (isOvulation) {
                      cellClass =
                        'bg-amber-100/90 border-amber-400 text-amber-950 hover:bg-amber-200/70';
                    } else if (isFertile) {
                      cellClass =
                        'bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100/60';
                    }

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(cell.dateStr)}
                        className={`relative h-10 sm:h-11 rounded-xl border text-xs font-semibold font-mono-num flex flex-col items-center justify-center transition-all cursor-pointer ${cellClass} ${
                          isSelected ? 'ring-2 ring-[#1A2B20] ring-offset-1 z-10' : ''
                        }`}
                      >
                        <span>{cell.dayNum}</span>
                        <div className="flex items-center gap-0.5 h-2">
                          {isToday && (
                            <span
                              className={`w-1 h-1 rounded-full ${
                                isPeriod ? 'bg-white' : 'bg-emerald-600'
                              }`}
                              title="今天"
                            />
                          )}
                          {isOvulation && (
                            <Sparkles className="w-2.5 h-2.5 text-amber-600" aria-label="預計排卵日" />
                          )}
                          {hasDetails && (
                            <span
                              className={`w-1 h-1 rounded-full ${
                                isPeriod ? 'bg-rose-100' : 'bg-[#4A5D50]'
                              }`}
                              title="有症狀或筆記"
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 border-t border-[#E6E1D6] text-[11px] text-[#5B6D60]">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                    實際經期
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-50 border border-dashed border-rose-400 inline-block" />
                    預測經期
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 inline-block" />
                    排卵 / 易孕期
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                    今天
                  </span>
                </div>
              </div>

              {/* Selected Date Detail Editor */}
              <div className="md:col-span-5 rounded-2xl border border-[#E2DDD3] bg-white p-3.5 space-y-3.5">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#EFECE4]">
                  <div>
                    <p className="text-sm font-bold text-[#1A2B20]">
                      {formatFullZhDate(selectedDate)}
                    </p>
                    <p className="text-[11px] text-[#6A7B6F]">
                      {selectedDate === todayStr
                        ? '今天'
                        : selectedLog.isPeriodDay
                        ? '已記錄為經期'
                        : analysis.predictedPeriodDates.has(selectedDate)
                        ? '系統預測經期日'
                        : analysis.predictedOvulationDates.has(selectedDate)
                        ? '系統預計排卵日'
                        : '點擊下方項目立即自動儲存'}
                    </p>
                  </div>
                  {trackerState.logs[selectedDate] && (
                    <button
                      type="button"
                      onClick={() => upsertLog(selectedDate, () => null)}
                      title="清除這天的所有紀錄"
                      className="px-2 py-1 rounded-lg border border-[#E2DDD3] text-[11px] text-[#6A7B6F] hover:text-rose-700 hover:border-rose-200 cursor-pointer"
                    >
                      清除本日
                    </button>
                  )}
                </div>

                {/* Period Day Toggle + Multi-day Quick Fill */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePeriodDay(selectedDate)}
                      className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        selectedLog.isPeriodDay
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'bg-[#FAF9F5] border-[#E2DDD3] text-[#1A2B20] hover:border-rose-300'
                      }`}
                    >
                      <Droplet className="w-3.5 h-3.5" />
                      <span>{selectedLog.isPeriodDay ? '本日為經期（已標記）' : '標記本日為經期'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleMarkConsecutiveDays(
                        selectedDate,
                        trackerState.settings.defaultPeriodLength
                      )
                    }
                    className="w-full py-1.5 px-2.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100/70 text-[11px] font-semibold text-rose-800 transition-colors cursor-pointer"
                  >
                    從此日開始連續標記 {trackerState.settings.defaultPeriodLength} 天經期
                  </button>
                </div>

                {/* Flow Level */}
                {selectedLog.isPeriodDay && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[#4A5D50] block">經血流量</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {FLOW_OPTIONS.map((opt) => {
                        const active = selectedLog.flow === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectFlow(opt.id)}
                            className={`py-1.5 px-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                              active
                                ? 'bg-rose-50 border-rose-400 text-rose-900'
                                : 'bg-[#FAF9F5] border-[#E2DDD3] text-[#5B6D60] hover:border-rose-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Symptoms */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#4A5D50] block">身體症狀（可複選）</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SYMPTOM_OPTIONS.map((sym) => {
                      const active = selectedLog.symptoms.includes(sym.id);
                      return (
                        <button
                          key={sym.id}
                          type="button"
                          onClick={() => handleToggleSymptom(sym.id)}
                          className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold'
                              : 'bg-[#FAF9F5] border-[#E2DDD3] text-[#4A5D50] hover:border-[#C5BDB0]'
                          }`}
                        >
                          {sym.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mood */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#4A5D50] block">當日心情</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MOOD_OPTIONS.map((m) => {
                      const active = selectedLog.mood === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectMood(m.id)}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-50 border-amber-400 text-amber-950 font-semibold'
                              : 'bg-[#FAF9F5] border-[#E2DDD3] text-[#4A5D50] hover:border-[#C5BDB0]'
                          }`}
                        >
                          <span>{m.emoji}</span>
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-1">
                  <label htmlFor="period-note-input" className="text-xs font-semibold text-[#4A5D50] block">
                    備註筆記（體溫 / 用藥 / 身體感受）
                  </label>
                  <input
                    id="period-note-input"
                    type="text"
                    maxLength={80}
                    value={selectedLog.note ?? ''}
                    onChange={(e) => handleChangeNote(e.target.value)}
                    placeholder="例如：體溫 36.4°C、喝了熱紅豆湯比較舒緩"
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] focus:bg-white focus:border-rose-400 focus:outline-none text-xs text-[#1A2B20] placeholder:text-[#8A988E]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Structured Cycle History Table + Daily Logs Table */}
          {activeTab === 'table' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold text-[#1A2B20]">歷次月經週期統計表</h3>
                  <p className="text-[11px] text-[#5B6D60]">
                    系統會自動將連續經期日期整理成週期紀錄，並計算間隔天數
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={sortedDailyLogs.length === 0}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E2DDD3] bg-[#FAF9F5] hover:bg-[#F1EFE7] disabled:opacity-45 text-xs font-semibold text-[#1A2B20] flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>匯出紀錄表 CSV</span>
                </button>
              </div>

              {analysis.segments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D8D1C5] bg-[#FAF9F5] p-6 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#1A2B20]">目前尚無經期週期紀錄</p>
                  <p className="text-xs text-[#5B6D60]">
                    請回到「月曆與每日紀錄」標記經期日期，或點擊上方「今天經期來了」開始記錄。
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-[#E2DDD3] overflow-x-auto bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAF9F5] border-b border-[#E2DDD3] text-[#5B6D60]">
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">次序</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">經期起訖日期</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">經期天數</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">週期間隔</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">常見流量與症狀</th>
                        <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE4]">
                      {[...analysis.segments].reverse().map((seg, revIdx) => {
                        const cycleNo = analysis.segments.length - revIdx;
                        const intervalStatus =
                          seg.cycleLengthFromPrev === null
                            ? null
                            : seg.cycleLengthFromPrev < 21
                            ? '偏短'
                            : seg.cycleLengthFromPrev > 35
                            ? '偏長'
                            : '規律';
                        return (
                          <tr key={seg.id} className="hover:bg-[#FAF9F5]/80">
                            <td className="py-2.5 px-3 font-mono-num font-bold text-rose-700 whitespace-nowrap">
                              第 {cycleNo} 次
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleJumpToDate(seg.startDate)}
                                className="font-mono-num font-semibold text-[#1A2B20] hover:text-rose-700 underline decoration-dotted cursor-pointer"
                              >
                                {seg.startDate} ~ {seg.endDate}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 font-mono-num whitespace-nowrap">
                              {seg.durationDays} 天
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {seg.cycleLengthFromPrev !== null ? (
                                <span className="inline-flex items-center gap-1.5 font-mono-num">
                                  <span className="font-semibold">{seg.cycleLengthFromPrev} 天</span>
                                  {intervalStatus && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                        intervalStatus === '規律'
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                                      }`}
                                    >
                                      {intervalStatus}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[#8A988E]">首次基準</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[#4A5D50]">
                              <div className="flex flex-wrap items-center gap-1">
                                {seg.dominantFlow && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-semibold">
                                    {flowLabelMap[seg.dominantFlow]}
                                  </span>
                                )}
                                {seg.topSymptoms.map((symId) => (
                                  <span
                                    key={symId}
                                    className="px-1.5 py-0.5 rounded bg-[#F4F2EC] text-[#4A5D50] text-[10px]"
                                  >
                                    {symptomLabelMap[symId]}
                                  </span>
                                ))}
                                {!seg.dominantFlow && seg.topSymptoms.length === 0 && (
                                  <span className="text-[#8A988E]">無額外備註</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDeleteSegment(seg)}
                                title="移除這次經期標記"
                                className="p-1.5 rounded-lg text-[#7A8A7E] hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {sortedDailyLogs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#1A2B20]">每日詳細紀錄明細</h4>
                  <div className="rounded-xl border border-[#E2DDD3] overflow-x-auto bg-white max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-[#FAF9F5] border-b border-[#E2DDD3] text-[#5B6D60]">
                        <tr>
                          <th className="py-2 px-3 font-semibold whitespace-nowrap">日期</th>
                          <th className="py-2 px-3 font-semibold whitespace-nowrap">經期 / 流量</th>
                          <th className="py-2 px-3 font-semibold whitespace-nowrap">症狀</th>
                          <th className="py-2 px-3 font-semibold whitespace-nowrap">心情</th>
                          <th className="py-2 px-3 font-semibold">備註</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFECE4]">
                        {sortedDailyLogs.map((log) => (
                          <tr key={log.date} className="hover:bg-[#FAF9F5]/80">
                            <td className="py-2 px-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleJumpToDate(log.date)}
                                className="font-mono-num font-semibold text-[#1A2B20] hover:text-rose-700 cursor-pointer"
                              >
                                {log.date}
                              </button>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {log.isPeriodDay ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-semibold">
                                  經期{log.flow ? ` · ${flowLabelMap[log.flow]}` : ''}
                                </span>
                              ) : (
                                <span className="text-[#8A988E]">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[#4A5D50]">
                              {log.symptoms.length > 0
                                ? log.symptoms.map((s) => symptomLabelMap[s]).join('、')
                                : '—'}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {log.mood ? `${moodMap[log.mood].emoji} ${moodMap[log.mood].label}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-[#4A5D50] max-w-[200px] truncate">
                              {log.note?.trim() || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-3.5 max-w-lg">
              <div className="rounded-2xl border border-[#E2DDD3] bg-[#FAF9F5] p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#1A2B20]">預設週期天數</p>
                    <p className="text-[11px] text-[#5B6D60]">兩次經期第一天的標準間隔（21–40 天）</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            defaultCycleLength: Math.max(21, prev.settings.defaultCycleLength - 1),
                          },
                        }))
                      }
                      aria-label="減少週期天數"
                      className="w-8 h-8 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#F1EFE7] flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono-num text-sm font-bold w-12 text-center">
                      {trackerState.settings.defaultCycleLength} 天
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            defaultCycleLength: Math.min(40, prev.settings.defaultCycleLength + 1),
                          },
                        }))
                      }
                      aria-label="增加週期天數"
                      className="w-8 h-8 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#F1EFE7] flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E6E1D6]">
                  <div>
                    <p className="text-xs font-bold text-[#1A2B20]">預設經期持續天數</p>
                    <p className="text-[11px] text-[#5B6D60]">每次經期的標準天數（2–10 天）</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            defaultPeriodLength: Math.max(2, prev.settings.defaultPeriodLength - 1),
                          },
                        }))
                      }
                      aria-label="減少經期天數"
                      className="w-8 h-8 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#F1EFE7] flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono-num text-sm font-bold w-12 text-center">
                      {trackerState.settings.defaultPeriodLength} 天
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            defaultPeriodLength: Math.min(10, prev.settings.defaultPeriodLength + 1),
                          },
                        }))
                      }
                      aria-label="增加經期天數"
                      className="w-8 h-8 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#F1EFE7] flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E6E1D6]">
                  <div>
                    <p className="text-xs font-bold text-[#1A2B20]">自動依據歷史紀錄調整平均天數</p>
                    <p className="text-[11px] text-[#5B6D60]">
                      累積 2 次以上經期紀錄後，自動以歷史平均推算下次日期
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateState((prev) => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          useAutoAverage: !prev.settings.useAutoAverage,
                        },
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      trackerState.settings.useAutoAverage
                        ? 'bg-emerald-700 text-white'
                        : 'bg-[#E2DDD3] text-[#4A5D50]'
                    }`}
                  >
                    {trackerState.settings.useAutoAverage ? '已開啟' : '已關閉'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs font-bold text-rose-900">清除所有週期紀錄</p>
                  <p className="text-[11px] text-rose-700">
                    僅會刪除本機瀏覽器內的週期紀錄，不會影響動物園存檔。
                  </p>
                </div>
                {!confirmClearAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-xs font-semibold text-rose-700 cursor-pointer"
                  >
                    清空資料
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E2DDD3] bg-white text-xs font-semibold text-[#4A5D50] cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateState((prev) => ({ ...prev, logs: {} }));
                        setConfirmClearAll(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      確定全部清空
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
