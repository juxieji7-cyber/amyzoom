export type FlowLevel = 'spotting' | 'light' | 'medium' | 'heavy';

export type PeriodSymptomId =
  | 'cramps'
  | 'fatigue'
  | 'headache'
  | 'bloating'
  | 'mood_swings'
  | 'tender'
  | 'backache'
  | 'cravings';

export type PeriodMoodId = 'calm' | 'happy' | 'sensitive' | 'anxious' | 'tired' | 'irritable';

export interface DailyCycleLog {
  date: string; // YYYY-MM-DD
  isPeriodDay: boolean;
  flow?: FlowLevel;
  symptoms: PeriodSymptomId[];
  mood?: PeriodMoodId;
  note?: string;
}

export interface CycleSettings {
  defaultCycleLength: number; // 21 ~ 40
  defaultPeriodLength: number; // 2 ~ 10
  useAutoAverage: boolean;
}

export interface CustomEncouragement {
  id: string;
  text: string;
  createdAt: number;
}

export interface PeriodTrackerState {
  logs: Record<string, DailyCycleLog>;
  settings: CycleSettings;
  customEncouragements: CustomEncouragement[];
  pinnedEncouragementId?: string | null;
}

export interface PeriodSegment {
  id: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  loggedPeriodDays: number;
  cycleLengthFromPrev: number | null;
  dominantFlow: FlowLevel | null;
  topSymptoms: PeriodSymptomId[];
}

export type CyclePhaseId = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'unknown';

export interface CycleAnalysis {
  segments: PeriodSegment[];
  effectiveCycleLength: number;
  effectivePeriodLength: number;
  latestSegment: PeriodSegment | null;
  currentCycleDay: number | null;
  currentPhase: CyclePhaseId;
  phaseLabel: string;
  phaseAdvice: string;
  nextPeriodStart: string | null;
  nextPeriodEnd: string | null;
  daysUntilNextPeriod: number | null;
  ovulationDate: string | null;
  fertileStart: string | null;
  fertileEnd: string | null;
  predictedPeriodDates: Set<string>;
  predictedFertileDates: Set<string>;
  predictedOvulationDates: Set<string>;
}

const PERIOD_TRACKER_STORAGE_KEY = 'forest_ark_period_tracker_v1';

export const FLOW_OPTIONS: Array<{ id: FlowLevel; label: string; drops: number; colorClass: string }> = [
  { id: 'spotting', label: '極少點狀', drops: 1, colorClass: 'text-rose-400' },
  { id: 'light', label: '少量', drops: 2, colorClass: 'text-rose-500' },
  { id: 'medium', label: '適中', drops: 3, colorClass: 'text-rose-600' },
  { id: 'heavy', label: '偏多', drops: 4, colorClass: 'text-rose-700' },
];

export const SYMPTOM_OPTIONS: Array<{ id: PeriodSymptomId; label: string }> = [
  { id: 'cramps', label: '經痛 / 下腹悶' },
  { id: 'fatigue', label: '疲倦嗜睡' },
  { id: 'backache', label: '腰痠背痛' },
  { id: 'bloating', label: '水腫腹脹' },
  { id: 'headache', label: '頭痛偏頭痛' },
  { id: 'tender', label: '胸部脹痛' },
  { id: 'mood_swings', label: '情緒波動' },
  { id: 'cravings', label: '食慾增加' },
];

export const MOOD_OPTIONS: Array<{ id: PeriodMoodId; label: string; emoji: string }> = [
  { id: 'calm', label: '平靜', emoji: '🌿' },
  { id: 'happy', label: '愉快', emoji: '☀️' },
  { id: 'sensitive', label: '敏感', emoji: '🌧️' },
  { id: 'tired', label: '疲累', emoji: '🌙' },
  { id: 'anxious', label: '焦慮', emoji: '💭' },
  { id: 'irritable', label: '煩躁', emoji: '🔥' },
];

export const DEFAULT_CYCLE_SETTINGS: CycleSettings = {
  defaultCycleLength: 28,
  defaultPeriodLength: 5,
  useAutoAverage: true,
};

export const DEFAULT_ENCOURAGEMENTS_BY_PHASE: Record<CyclePhaseId, string[]> = {
  menstrual: [
    '辛苦了！身體正在好好調整節奏，今天允許自己多休息、多對自己溫柔一點。',
    '喝杯溫熱的飲品暖暖身心，不急不躁，按自己的步調慢慢來就很棒了。',
    '這幾天如果感到疲憊或悶痛，放慢腳步完全沒關係，照顧好自己最重要。',
    '每一次好好休養，都是給下一個健康週期最好的禮物。',
  ],
  follicular: [
    '身體的能量正一點一點回來，今天的妳很有韌性，做任何小事都閃閃發光！',
    '趁著思緒清晰的日子做喜歡的事吧，記得也要替自己留一點喘息的空間。',
    '穩定記錄自己的節奏，代表妳正用心傾聽並愛護自己的身體。',
  ],
  ovulation: [
    '充滿活力的一週，別忘了多補充水分與適度伸展，保持最舒服的狀態。',
    '妳比自己想像的更有力量，今天也請自信、從容地迎接每一個片刻！',
    '好好感受身體帶來的節奏變化，適時放鬆肩膀與呼吸，一切都在軌道上。',
  ],
  luteal: [
    '經前的情緒敏感與疲倦都是身體的正常訊號，不必苛責自己，今天先好好睡一覺吧。',
    '就算偶爾覺得煩躁或提不起勁也沒關係，給自己一點甜暖與包容就好。',
    '已經走過大半個週期了，謝謝一直認真生活、照顧自己的妳。',
  ],
  unknown: [
    '每一次記錄都是對自己身體的溫柔陪伴，妳已經做得很好了！',
    '無論今天忙碌或悠閒，別忘了給自己一個肯定與深呼吸的片刻。',
    '試著寫下一句專屬於自己的鼓勵話語，在每個週期裡給自己打氣吧！',
  ],
};

export function getTodayDateStr(): string {
  return formatDateObj(new Date());
}

export function formatDateObj(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateStr(dateStr: string): Date {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDays(dateStr: string, delta: number): string {
  const dt = parseDateStr(dateStr);
  dt.setDate(dt.getDate() + delta);
  return formatDateObj(dt);
}

export function diffDays(fromStr: string, toStr: string): number {
  const from = parseDateStr(fromStr).getTime();
  const to = parseDateStr(toStr).getTime();
  return Math.round((to - from) / 86400000);
}

export function formatShortZhDate(dateStr: string): string {
  const [, mStr, dStr] = dateStr.split('-');
  return `${Number(mStr)}/${Number(dStr)}`;
}

export function formatFullZhDate(dateStr: string): string {
  const [yStr, mStr, dStr] = dateStr.split('-');
  return `${yStr} 年 ${Number(mStr)} 月 ${Number(dStr)} 日`;
}

export function loadPeriodTrackerState(): PeriodTrackerState {
  try {
    const raw = window.localStorage.getItem(PERIOD_TRACKER_STORAGE_KEY);
    if (!raw) {
      return {
        logs: {},
        settings: { ...DEFAULT_CYCLE_SETTINGS },
        customEncouragements: [],
        pinnedEncouragementId: null,
      };
    }
    const parsed = JSON.parse(raw) as Partial<PeriodTrackerState>;
    const rawSettings = parsed.settings ?? DEFAULT_CYCLE_SETTINGS;
    const settings: CycleSettings = {
      defaultCycleLength: Math.max(
        21,
        Math.min(40, Math.round(rawSettings.defaultCycleLength ?? 28))
      ),
      defaultPeriodLength: Math.max(
        2,
        Math.min(10, Math.round(rawSettings.defaultPeriodLength ?? 5))
      ),
      useAutoAverage:
        typeof rawSettings.useAutoAverage === 'boolean' ? rawSettings.useAutoAverage : true,
    };

    const logs: Record<string, DailyCycleLog> = {};
    if (parsed.logs && typeof parsed.logs === 'object') {
      for (const [key, entry] of Object.entries(parsed.logs)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !entry || typeof entry !== 'object') continue;
        logs[key] = {
          date: key,
          isPeriodDay: Boolean(entry.isPeriodDay),
          flow: entry.flow,
          symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [],
          mood: entry.mood,
          note: typeof entry.note === 'string' ? entry.note : undefined,
        };
      }
    }

    const customEncouragements: CustomEncouragement[] = Array.isArray(parsed.customEncouragements)
      ? parsed.customEncouragements
          .filter(
            (item): item is CustomEncouragement =>
              Boolean(item) &&
              typeof item.id === 'string' &&
              typeof item.text === 'string' &&
              item.text.trim().length > 0
          )
          .map((item) => ({
            id: item.id,
            text: item.text.trim(),
            createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          }))
      : [];

    const pinnedEncouragementId =
      typeof parsed.pinnedEncouragementId === 'string' &&
      customEncouragements.some((e) => e.id === parsed.pinnedEncouragementId)
        ? parsed.pinnedEncouragementId
        : null;

    return { logs, settings, customEncouragements, pinnedEncouragementId };
  } catch {
    return {
      logs: {},
      settings: { ...DEFAULT_CYCLE_SETTINGS },
      customEncouragements: [],
      pinnedEncouragementId: null,
    };
  }
}

export function savePeriodTrackerState(state: PeriodTrackerState): void {
  try {
    window.localStorage.setItem(PERIOD_TRACKER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function extractPeriodSegments(logs: Record<string, DailyCycleLog>): PeriodSegment[] {
  const periodDates = Object.values(logs)
    .filter((l) => l.isPeriodDay)
    .map((l) => l.date)
    .sort();

  if (periodDates.length === 0) return [];

  const groups: string[][] = [];
  for (const date of periodDates) {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup) {
      groups.push([date]);
      continue;
    }
    const lastDate = lastGroup[lastGroup.length - 1];
    const gap = diffDays(lastDate, date);
    // Treat 1-day spotting pause (gap <= 2) as same menstrual period; >= 3 days starts a new cycle
    if (gap <= 2) {
      lastGroup.push(date);
    } else {
      groups.push([date]);
    }
  }

  return groups.map((dates, idx) => {
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const durationDays = diffDays(startDate, endDate) + 1;
    const prevGroup = idx > 0 ? groups[idx - 1] : null;
    const cycleLengthFromPrev = prevGroup ? diffDays(prevGroup[0], startDate) : null;

    const flowCounts: Partial<Record<FlowLevel, number>> = {};
    const symptomCounts: Partial<Record<PeriodSymptomId, number>> = {};

    // Inspect all logged days spanning startDate..endDate
    for (let offset = 0; offset < durationDays; offset++) {
      const d = addDays(startDate, offset);
      const log = logs[d];
      if (!log) continue;
      if (log.flow) {
        flowCounts[log.flow] = (flowCounts[log.flow] ?? 0) + 1;
      }
      for (const sym of log.symptoms) {
        symptomCounts[sym] = (symptomCounts[sym] ?? 0) + 1;
      }
    }

    const dominantFlow =
      (Object.entries(flowCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] as
        | FlowLevel
        | undefined) ?? null;

    const topSymptoms = (Object.entries(symptomCounts)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 3)
      .map(([id]) => id) as PeriodSymptomId[]);

    return {
      id: `${startDate}_${endDate}`,
      startDate,
      endDate,
      durationDays,
      loggedPeriodDays: dates.length,
      cycleLengthFromPrev,
      dominantFlow,
      topSymptoms,
    };
  });
}

export function computeCycleAnalysis(
  state: PeriodTrackerState,
  todayStr: string = getTodayDateStr()
): CycleAnalysis {
  const segments = extractPeriodSegments(state.logs);
  const { settings } = state;

  const validCycleIntervals = segments
    .map((s) => s.cycleLengthFromPrev)
    .filter((len): len is number => len !== null && len >= 18 && len <= 60);

  const effectiveCycleLength =
    settings.useAutoAverage && validCycleIntervals.length > 0
      ? Math.round(
          validCycleIntervals.reduce((sum, n) => sum + n, 0) / validCycleIntervals.length
        )
      : settings.defaultCycleLength;

  const validPeriodDurations = segments
    .map((s) => s.durationDays)
    .filter((len) => len >= 2 && len <= 12);

  const effectivePeriodLength =
    settings.useAutoAverage && validPeriodDurations.length > 0
      ? Math.max(
          2,
          Math.min(
            10,
            Math.round(
              validPeriodDurations.reduce((sum, n) => sum + n, 0) / validPeriodDurations.length
            )
          )
        )
      : settings.defaultPeriodLength;

  if (segments.length === 0) {
    return {
      segments,
      effectiveCycleLength,
      effectivePeriodLength,
      latestSegment: null,
      currentCycleDay: null,
      currentPhase: 'unknown',
      phaseLabel: '尚未建立週期紀錄',
      phaseAdvice: '點選月曆上的經期開始日，或按「今天經期來了」，即可自動推算週期與下次預測日期。',
      nextPeriodStart: null,
      nextPeriodEnd: null,
      daysUntilNextPeriod: null,
      ovulationDate: null,
      fertileStart: null,
      fertileEnd: null,
      predictedPeriodDates: new Set(),
      predictedFertileDates: new Set(),
      predictedOvulationDates: new Set(),
    };
  }

  // Pick the most recent segment starting on or before today, or fallback to latest segment
  const pastOrCurrent = segments.filter((seg) => seg.startDate <= todayStr);
  const latestSegment =
    pastOrCurrent.length > 0 ? pastOrCurrent[pastOrCurrent.length - 1] : segments[segments.length - 1];

  const currentCycleDay = Math.max(1, diffDays(latestSegment.startDate, todayStr) + 1);
  const nextPeriodStart = addDays(latestSegment.startDate, effectiveCycleLength);
  const nextPeriodEnd = addDays(nextPeriodStart, effectivePeriodLength - 1);
  const daysUntilNextPeriod = diffDays(todayStr, nextPeriodStart);

  // Ovulation typically occurs ~14 days prior to the next expected period
  const ovulationOffsetFromStart = Math.max(8, effectiveCycleLength - 14);
  const ovulationDate = addDays(latestSegment.startDate, ovulationOffsetFromStart);
  const fertileStart = addDays(ovulationDate, -4);
  const fertileEnd = addDays(ovulationDate, 1);

  const todayLog = state.logs[todayStr];
  let currentPhase: CyclePhaseId = 'follicular';
  let phaseLabel = '濾泡期（活力回升）';
  let phaseAdvice = '雌激素逐漸上升，精神與皮膚狀態通常較穩定，適合安排運動與專注學習。';

  if (todayLog?.isPeriodDay || currentCycleDay <= Math.max(latestSegment.durationDays, effectivePeriodLength)) {
    if (todayLog?.isPeriodDay || currentCycleDay <= latestSegment.durationDays) {
      currentPhase = 'menstrual';
      phaseLabel = '經期中（休養照護）';
      phaseAdvice = '身體正在排經期，記得多喝溫熱飲、注意腹部保暖，適度放慢步調休息。';
    }
  }

  if (currentPhase !== 'menstrual') {
    if (todayStr >= fertileStart && todayStr <= fertileEnd) {
      currentPhase = 'ovulation';
      phaseLabel = todayStr === ovulationDate ? '預計排卵日' : '排卵期（易孕期）';
      phaseAdvice = '體溫與荷爾蒙波動較明顯，可能出現輕微腹悶或分泌物增加，可多補充水分。';
    } else if (todayStr > fertileEnd) {
      currentPhase = 'luteal';
      phaseLabel = '黃體期（經前調理）';
      phaseAdvice = '接近下次經期容易感到疲倦、水腫或情緒敏感，建議減少咖啡因與高鹽飲食。';
    }
  }

  const predictedPeriodDates = new Set<string>();
  const predictedFertileDates = new Set<string>();
  const predictedOvulationDates = new Set<string>();

  // Project next 4 cycles forward so multi-month browsing shows accurate predictions
  for (let cycleIdx = 0; cycleIdx < 4; cycleIdx++) {
    const baseStart = addDays(latestSegment.startDate, effectiveCycleLength * cycleIdx);
    if (cycleIdx > 0) {
      for (let d = 0; d < effectivePeriodLength; d++) {
        const pDate = addDays(baseStart, d);
        if (!state.logs[pDate]?.isPeriodDay) {
          predictedPeriodDates.add(pDate);
        }
      }
    }
    const ovDate = addDays(baseStart, ovulationOffsetFromStart);
    predictedOvulationDates.add(ovDate);
    for (let f = -4; f <= 1; f++) {
      const fDate = addDays(ovDate, f);
      if (!state.logs[fDate]?.isPeriodDay) {
        predictedFertileDates.add(fDate);
      }
    }
  }

  return {
    segments,
    effectiveCycleLength,
    effectivePeriodLength,
    latestSegment,
    currentCycleDay,
    currentPhase,
    phaseLabel,
    phaseAdvice,
    nextPeriodStart,
    nextPeriodEnd,
    daysUntilNextPeriod,
    ovulationDate,
    fertileStart,
    fertileEnd,
    predictedPeriodDates,
    predictedFertileDates,
    predictedOvulationDates,
  };
}

export function buildPeriodLogsCsv(logs: Record<string, DailyCycleLog>): string {
  const flowLabelMap: Record<FlowLevel, string> = {
    spotting: '極少點狀',
    light: '少量',
    medium: '適中',
    heavy: '偏多',
  };
  const symptomLabelMap = Object.fromEntries(SYMPTOM_OPTIONS.map((s) => [s.id, s.label]));
  const moodLabelMap = Object.fromEntries(MOOD_OPTIONS.map((m) => [m.id, m.label]));

  const rows = Object.values(logs)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((log) => {
      const cols = [
        log.date,
        log.isPeriodDay ? '是' : '否',
        log.isPeriodDay && log.flow ? flowLabelMap[log.flow] : '',
        log.symptoms.map((s) => symptomLabelMap[s] ?? s).join('、'),
        log.mood ? moodLabelMap[log.mood] : '',
        (log.note ?? '').replace(/"/g, '""'),
      ];
      return cols.map((c) => `"${c}"`).join(',');
    });

  return `\uFEFF日期,是否經期,經血量,身體症狀,當日心情,備註\n${rows.join('\n')}`;
}

export function pickRandomDailyEncouragement(
  state: PeriodTrackerState,
  phase: CyclePhaseId,
  excludeText?: string
): { id: string; text: string; isCustom: boolean } {
  const customPool = state.customEncouragements;
  if (customPool.length > 0) {
    const filtered =
      excludeText && customPool.length > 1
        ? customPool.filter((c) => c.text !== excludeText)
        : customPool;
    const pool = filtered.length > 0 ? filtered : customPool;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return { id: picked.id, text: picked.text, isCustom: true };
  }

  const defaults = DEFAULT_ENCOURAGEMENTS_BY_PHASE[phase] ?? DEFAULT_ENCOURAGEMENTS_BY_PHASE.unknown;
  const filtered =
    excludeText && defaults.length > 1 ? defaults.filter((t) => t !== excludeText) : defaults;
  const pool = filtered.length > 0 ? filtered : defaults;
  const idx = Math.floor(Math.random() * pool.length);
  return {
    id: `default_${phase}_${idx}`,
    text: pool[idx],
    isCustom: false,
  };
}
