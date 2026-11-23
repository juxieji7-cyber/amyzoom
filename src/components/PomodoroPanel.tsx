import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Timer,
  Coffee,
  Music,
  Volume2,
  VolumeX,
  Check,
  X,
  BookOpen,
} from 'lucide-react';
import { BGM_TRACKS, BgmTrackId } from '../utils/sound';

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

export interface PomodoroPanelProps {
  mode: PomodoroMode;
  isRunning: boolean;
  secondsLeft: number;
  totalSeconds: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  completedPomodoros: number;
  todayFocusMinutes: number;
  taskLabel: string;
  autoStudyMusic: boolean;
  bgmMuted: boolean;
  bgmTrack: BgmTrackId;
  variant?: 'modal' | 'embedded';
  onClose?: () => void;
  onToggleRun: () => void;
  onReset: () => void;
  onSkipPhase: () => void;
  onSelectMode: (mode: PomodoroMode) => void;
  onSelectPresetMinutes: (mode: PomodoroMode, minutes: number) => void;
  onChangeTaskLabel: (label: string) => void;
  onToggleAutoStudyMusic: () => void;
  onToggleBgm: () => void;
  onChangeBgmTrack: (track: BgmTrackId) => void;
}

export function formatPomodoroTime(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PomodoroPanel: React.FC<PomodoroPanelProps> = ({
  mode,
  isRunning,
  secondsLeft,
  totalSeconds,
  focusMinutes,
  shortBreakMinutes,
  longBreakMinutes,
  completedPomodoros,
  todayFocusMinutes,
  taskLabel,
  autoStudyMusic,
  bgmMuted,
  bgmTrack,
  variant = 'embedded',
  onClose,
  onToggleRun,
  onReset,
  onSkipPhase,
  onSelectMode,
  onSelectPresetMinutes,
  onChangeTaskLabel,
  onToggleAutoStudyMusic,
  onToggleBgm,
  onChangeBgmTrack,
}) => {
  const progress =
    totalSeconds > 0 ? Math.min(1, Math.max(0, (totalSeconds - secondsLeft) / totalSeconds)) : 0;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const studyTracks = BGM_TRACKS.filter((t) => t.category === '專注讀書');

  const accentStroke =
    mode === 'focus' ? '#047857' : mode === 'shortBreak' ? '#0284C7' : '#D97706';
  const primaryBtnClass =
    mode === 'focus'
      ? 'bg-[#059669] hover:bg-[#047857]'
      : mode === 'shortBreak'
      ? 'bg-sky-600 hover:bg-sky-700'
      : 'bg-amber-600 hover:bg-amber-700';

  const modeLabel =
    mode === 'focus' ? '專注讀書時段' : mode === 'shortBreak' ? '短暫休息時段' : '長時休息時段';

  const presetOptions =
    mode === 'focus'
      ? [
          { mins: 15, label: '15 分' },
          { mins: 25, label: '25 分' },
          { mins: 45, label: '45 分' },
          { mins: 50, label: '50 分' },
        ]
      : mode === 'shortBreak'
      ? [
          { mins: 5, label: '5 分' },
          { mins: 10, label: '10 分' },
        ]
      : [
          { mins: 15, label: '15 分' },
          { mins: 20, label: '20 分' },
          { mins: 30, label: '30 分' },
        ];

  const activePresetMinutes =
    mode === 'focus'
      ? focusMinutes
      : mode === 'shortBreak'
      ? shortBreakMinutes
      : longBreakMinutes;

  const content = (
    <div className="bg-white border border-[#E2DDD3] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1A2B20] flex items-center gap-2">
            <Timer className="w-4 h-4 text-rose-600 shrink-0" />
            <span>園區番茄鐘</span>
          </h2>
          <p className="text-xs text-[#5B6D60] mt-0.5 font-mono-num">
            已完成 {completedPomodoros} 顆 · 今日專注 {todayFocusMinutes} 分鐘
          </p>
        </div>
        {variant === 'modal' && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉番茄鐘"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-[#F4F2EC] text-[#5B6D60] hover:text-[#1A2B20] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mode Switcher */}
      <div
        className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F4F2EC] border border-[#E2DDD3]"
        role="tablist"
        aria-label="番茄鐘階段切換"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'focus'}
          onClick={() => onSelectMode('focus')}
          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            mode === 'focus'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-[#5B6D60] hover:text-[#1A2B20]'
          }`}
        >
          專注讀書
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'shortBreak'}
          onClick={() => onSelectMode('shortBreak')}
          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            mode === 'shortBreak'
              ? 'bg-white text-sky-900 shadow-xs'
              : 'text-[#5B6D60] hover:text-[#1A2B20]'
          }`}
        >
          短休息
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'longBreak'}
          onClick={() => onSelectMode('longBreak')}
          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            mode === 'longBreak'
              ? 'bg-white text-amber-900 shadow-xs'
              : 'text-[#5B6D60] hover:text-[#1A2B20]'
          }`}
        >
          長休息
        </button>
      </div>

      {/* Timer Dial & Preset Duration Pills */}
      <div className="py-3 px-4 rounded-2xl bg-[#FAF9F5] border border-[#E2DDD3] flex flex-col items-center gap-3.5">
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 152 152" aria-hidden="true">
            <circle
              cx="76"
              cy="76"
              r={radius}
              fill="none"
              stroke="#E5E0D5"
              strokeWidth="8"
            />
            <circle
              cx="76"
              cy="76"
              r={radius}
              fill="none"
              stroke={accentStroke}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-medium text-[#5B6D60]">{modeLabel}</span>
            <span className="font-mono-num text-4xl font-bold tracking-tight text-[#1A2B20] mt-0.5">
              {formatPomodoroTime(secondsLeft)}
            </span>
            <span className="text-[11px] text-[#6A7B6F] mt-1">
              {isRunning ? '計時進行中' : '已暫停'}
            </span>
          </div>
        </div>

        {/* Preset Durations */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap w-full">
          {presetOptions.map((opt) => {
            const active = activePresetMinutes === opt.mins;
            return (
              <button
                key={opt.mins}
                type="button"
                onClick={() => onSelectPresetMinutes(mode, opt.mins)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold font-mono-num transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1A2B20] text-white'
                    : 'bg-white border border-[#E2DDD3] text-[#4A5D50] hover:border-[#C7BFB0]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Primary Action Row */}
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={onToggleRun}
            className={`flex-1 min-h-[48px] px-4 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs ${primaryBtnClass}`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>暫停</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{mode === 'focus' ? '開始專注' : '開始休息'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onReset}
            title="重設目前階段時間"
            aria-label="重設目前階段時間"
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl border border-[#D8D1C5] bg-white hover:bg-[#F4F2EC] text-[#4A5D50] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onSkipPhase}
            title="跳至下一個階段"
            aria-label="跳至下一個階段"
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl border border-[#D8D1C5] bg-white hover:bg-[#F4F2EC] text-[#4A5D50] transition-colors cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Study Task Label */}
      <div className="space-y-1.5">
        <label htmlFor="pomodoro-task-input" className="text-xs font-semibold text-[#4A5D50] block">
          目前專注事項（選填）
        </label>
        <input
          id="pomodoro-task-input"
          type="text"
          maxLength={40}
          value={taskLabel}
          onChange={(e) => onChangeTaskLabel(e.target.value)}
          placeholder="例如：複習英文單字、整理報告、靜心閱讀"
          className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E2DDD3] bg-[#FAF9F5] focus:bg-white focus:border-emerald-600 focus:outline-none text-sm text-[#1A2B20] placeholder:text-[#8A988E]"
        />
      </div>

      {/* Study Music Companion Controls */}
      <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E2DDD3] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="text-xs font-bold text-[#1A2B20] truncate">讀書白噪音與伴讀音樂</span>
          </div>
          <button
            type="button"
            onClick={onToggleBgm}
            className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
              bgmMuted
                ? 'border-[#E2DDD3] bg-white text-[#6A7B6F]'
                : 'border-emerald-300 bg-emerald-50 text-emerald-900'
            }`}
          >
            {bgmMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{bgmMuted ? '音樂靜音' : '音樂播放中'}</span>
          </button>
        </div>

        <p className="text-[11px] text-[#5B6D60] leading-relaxed">
          {isRunning
            ? '專注模式音效已啟用：已關閉買票與系統提示音，保留動物叫聲並持續播放輕柔雨聲與風聲。'
            : '開始計時後將自動關閉買票與系統提示音，只留動物叫聲與輕柔雨聲、風聲陪伴專注。'}
        </p>

        <button
          type="button"
          onClick={onToggleAutoStudyMusic}
          className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border border-[#E2DDD3] bg-white hover:bg-[#F6F4EE] flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
        >
          <span className="text-xs text-[#1A2B20] flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>開始專注時自動切換至專注讀書曲目</span>
          </span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
              autoStudyMusic ? 'bg-emerald-700 text-white' : 'bg-[#E2DDD3] text-[#5B6D60]'
            }`}
          >
            {autoStudyMusic ? '已開啟' : '已關閉'}
          </span>
        </button>

        <div className="space-y-1">
          {studyTracks.map((track) => {
            const active = bgmTrack === track.id && !bgmMuted;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => onChangeBgmTrack(track.id)}
                className={`w-full min-h-[40px] px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                    : 'bg-white border border-[#ECE7DC] hover:border-[#D5CFC2] text-[#1A2B20]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Music className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="text-xs font-medium truncate">{track.name}</span>
                  <span className="text-[11px] text-[#6A7B6F] shrink-0 hidden sm:inline">
                    · {track.moodDesc}
                  </span>
                </div>
                {active && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-[#6A7B6F] text-center">
        提示：每完成 4 次專注讀書，系統會自動推薦進入 {longBreakMinutes} 分鐘長休息。
      </p>
    </div>
  );

  if (variant === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="園區番茄鐘"
      >
        <div className="w-full max-w-md my-auto shadow-xl rounded-2xl">{content}</div>
      </div>
    );
  }

  return content;
};
