import { SpeciesId, VisitorArchetype, WeatherType } from '../types/zoo';

export type BgmTrackId =
  | 'piano_stroll'
  | 'piano_nocturne'
  | 'piano_morning_dew'
  | 'piano_rainy_window'
  | 'piano_sakura_breeze'
  | 'piano_winter_snowfall'
  | 'acoustic_safari'
  | 'guitar_campfires'
  | 'bossa_afternoon'
  | 'lofi_warm_cafe'
  | 'bamboo_zen'
  | 'celtic_flute_meadow'
  | 'nordic_harp'
  | 'string_quartet_dawn'
  | 'celesta_starlight'
  | 'marimba_carousel'
  | 'tropical_kalimba'
  | 'music_box_lullaby'
  | 'study_lofi_desk'
  | 'study_felt_piano'
  | 'study_alpha_rhodes'
  | 'study_library_guitar'
  | 'study_rainy_window';

export type AmbientAudioMode = 'auto' | 'on' | 'off';

export interface BgmTrackSpec {
  id: BgmTrackId;
  name: string;
  category: string;
  moodDesc: string;
}

export const BGM_TRACKS: BgmTrackSpec[] = [
  { id: 'piano_stroll', name: '森林漫步（鋼琴版）', category: '鋼琴獨奏', moodDesc: '溫潤輕快' },
  { id: 'piano_nocturne', name: '星空圓舞曲（鋼琴版）', category: '鋼琴獨奏', moodDesc: '浪漫三拍' },
  { id: 'piano_morning_dew', name: '晨露練習曲（鋼琴版）', category: '鋼琴獨奏', moodDesc: '清新晨光' },
  { id: 'piano_rainy_window', name: '雨滴慢板（鋼琴版）', category: '鋼琴獨奏', moodDesc: '抒情微雨' },
  { id: 'piano_sakura_breeze', name: '櫻花微風（鋼琴版）', category: '鋼琴獨奏', moodDesc: '春意柔情' },
  { id: 'piano_winter_snowfall', name: '雪夜小品（鋼琴版）', category: '鋼琴獨奏', moodDesc: '冬雪靜謐' },
  { id: 'acoustic_safari', name: '陽光草原吉他', category: '原聲民謠', moodDesc: '活力開朗' },
  { id: 'guitar_campfires', name: '營火晚風民謠吉他', category: '木吉他', moodDesc: '溫暖抒情' },
  { id: 'bossa_afternoon', name: '午後微風 Bossa', category: '爵士輕調', moodDesc: '慵懶愜意' },
  { id: 'lofi_warm_cafe', name: '園區咖啡廳 Lo-Fi', category: '都會輕律', moodDesc: '微醺放鬆' },
  { id: 'bamboo_zen', name: '翠竹風鈴靜謐', category: '東方禪意', moodDesc: '寧靜平和' },
  { id: 'celtic_flute_meadow', name: '綠野長笛詩篇', category: '凱爾特民謠', moodDesc: '遼闊清風' },
  { id: 'nordic_harp', name: '極地星光豎琴', category: '空靈撥弦', moodDesc: '晶瑩澄澈' },
  { id: 'string_quartet_dawn', name: '晨曦弦樂四重奏', category: '室內弦樂', moodDesc: '優雅溫暖' },
  { id: 'celesta_starlight', name: '星辰鋼片琴', category: '夢幻鍵盤', moodDesc: '閃耀微光' },
  { id: 'marimba_carousel', name: '歡樂旋轉木馬', category: '馬林巴琴', moodDesc: '童趣輕快' },
  { id: 'tropical_kalimba', name: '熱帶雨林卡林巴', category: '世界打擊', moodDesc: '輕盈跳躍' },
  { id: 'music_box_lullaby', name: '夢幻音樂盒小調', category: '八音盒', moodDesc: '童話溫馨' },
  { id: 'study_lofi_desk', name: '深夜書桌 Lo-Fi', category: '專注讀書', moodDesc: '穩拍紓壓' },
  { id: 'study_felt_piano', name: '靜謐柔音鋼琴', category: '專注讀書', moodDesc: '柔和極簡' },
  { id: 'study_alpha_rhodes', name: '澄澈 Alpha 波電鋼琴', category: '專注讀書', moodDesc: '專心沉澱' },
  { id: 'study_library_guitar', name: '圖書館暖木吉他', category: '專注讀書', moodDesc: '平穩伴讀' },
  { id: 'study_rainy_window', name: '微雨窗邊讀書曲', category: '專注讀書', moodDesc: '安定心神' },
];

class SoundManager {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private rainNoiseBuffer: AudioBuffer | null = null;
  public muted = false;
  public bgmMuted = false;
  public bgmTrack: BgmTrackId = 'piano_stroll';
  public weather: WeatherType = 'sunny';
  public rainMode: AmbientAudioMode = 'auto';
  public windMode: AmbientAudioMode = 'auto';
  public thunderMode: AmbientAudioMode = 'auto';
  private isNight = false;
  private paused = false;
  private bgmPlaying = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private lastVisitorVoiceAt = 0;
  private lastAnimalVoiceAt = 0;
  private ambientInitialized = false;
  private rainGainNode: GainNode | null = null;
  private windGainNode: GainNode | null = null;
  private thunderBedGainNode: GainNode | null = null;
  private windSwirlFilter: BiquadFilterNode | null = null;
  private ambientTimer: number | null = null;
  private raindropTimer: number | null = null;
  private nextThunderAt = 0;
  private nextWindDriftAt = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    return this.ensureContext();
  }

  unlock() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.ensureAmbientSoundscape();
    this.syncAmbientVolumes();
    if (this.bgmPlaying && !this.bgmTimer) {
      this.scheduleBgmTick();
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  /**
   * 3-second seamless pink-noise buffer for organic rain, wind, and thunder ambience
   */
  private getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.pinkNoiseBuffer && this.pinkNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.pinkNoiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 3.0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.095;
      b6 = white * 0.115926;
    }
    // Crossfade tail into head for click-free seamless looping
    const fadeSamples = Math.min(2048, Math.floor(len * 0.05));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      data[i] = data[i] * t + data[len - fadeSamples + i] * (1 - t);
    }
    this.pinkNoiseBuffer = buf;
    return buf;
  }

  /**
   * 6-second seamless rain-textured buffer: warm pink noise + subtle organic foliage micro-patter
   */
  private getRainNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.rainNoiseBuffer && this.rainNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.rainNoiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 6.0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      let sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.075;
      b6 = white * 0.115926;

      // Occasional soft micro-grain droplet texture baked naturally into the noise field
      if (Math.random() < 0.0022) {
        sample += (Math.random() * 2 - 1) * 0.14;
      }
      data[i] = sample;
    }
    const fadeSamples = Math.min(8192, Math.floor(len * 0.06));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      data[i] = data[i] * t + data[len - fadeSamples + i] * (1 - t);
    }
    this.rainNoiseBuffer = buf;
    return buf;
  }

  private scheduleNextRaindrop() {
    if (this.raindropTimer !== null) {
      window.clearTimeout(this.raindropTimer);
    }
    const delayMs = 780 + Math.random() * 880;
    this.raindropTimer = window.setTimeout(() => {
      if (!this.muted && !this.paused && this.isRainActive()) {
        const c = this.ctx;
        if (c && c.state === 'running') {
          this.playRaindropPair(0);
        }
      }
      this.scheduleNextRaindrop();
    }, delayMs);
  }

  private ensureAmbientSoundscape() {
    if (this.ambientInitialized) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    this.ambientInitialized = true;
    const pinkBuf = this.getPinkNoiseBuffer(ctx);
    const rainBuf = this.getRainNoiseBuffer(ctx);

    // 1. Smooth flowing rainfall bed with gentle slow LFO breathing
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = rainBuf;
    rainSrc.loop = true;

    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.setValueAtTime(380, ctx.currentTime);

    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.setValueAtTime(2200, ctx.currentTime);
    rainLp.Q.setValueAtTime(0.5, ctx.currentTime);

    const rainLfo = ctx.createOscillator();
    rainLfo.type = 'sine';
    rainLfo.frequency.setValueAtTime(0.06, ctx.currentTime);
    const rainLfoGain = ctx.createGain();
    rainLfoGain.gain.setValueAtTime(320, ctx.currentTime);
    rainLfo.connect(rainLfoGain);
    rainLfoGain.connect(rainLp.frequency);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    rainSrc.connect(rainHp);
    rainHp.connect(rainLp);
    rainLp.connect(rainGain);
    rainGain.connect(ctx.destination);
    rainSrc.start();
    rainLfo.start();
    this.rainGainNode = rainGain;

    // 2. Slow, gentle breeze ambience layer (very slow LFO sweep & low volume)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = pinkBuf;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(240, ctx.currentTime);
    windFilter.Q.setValueAtTime(1.15, ctx.currentTime);

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.setValueAtTime(0.045, ctx.currentTime);
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.setValueAtTime(52, ctx.currentTime);
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSrc.start();
    windLfo.start();
    this.windFilterInit(windFilter, windGain);

    // 3. Continuous deep thunder atmospheric rumble bed
    const thunderBedSrc = ctx.createBufferSource();
    thunderBedSrc.buffer = pinkBuf;
    thunderBedSrc.loop = true;

    const thunderBedLp = ctx.createBiquadFilter();
    thunderBedLp.type = 'lowpass';
    thunderBedLp.frequency.setValueAtTime(92, ctx.currentTime);

    const thunderLfo = ctx.createOscillator();
    thunderLfo.type = 'sine';
    thunderLfo.frequency.setValueAtTime(0.22, ctx.currentTime);
    const thunderLfoGain = ctx.createGain();
    thunderLfoGain.gain.setValueAtTime(28, ctx.currentTime);
    thunderLfo.connect(thunderLfoGain);
    thunderLfoGain.connect(thunderBedLp.frequency);

    const thunderBedGain = ctx.createGain();
    thunderBedGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    thunderBedSrc.connect(thunderBedLp);
    thunderBedLp.connect(thunderBedGain);
    thunderBedGain.connect(ctx.destination);
    thunderBedSrc.start();
    thunderLfo.start();
    this.thunderBedGainNode = thunderBedGain;

    // 4. Unhurried, organic "滴答" raindrop pattern (780ms–1660ms natural jitter)
    if (this.raindropTimer === null) {
      this.scheduleNextRaindrop();
    }

    // 5. Slow wind drift & sustained rolling thunder cadence
    if (this.ambientTimer === null) {
      this.nextThunderAt = Date.now() + 1200;
      this.nextWindDriftAt = Date.now() + 4000;
      this.ambientTimer = window.setInterval(() => {
        if (this.muted || this.paused) return;
        const c = this.ctx;
        if (!c || c.state !== 'running') return;

        const nowMs = Date.now();
        if (this.isWindActive() && nowMs >= this.nextWindDriftAt && this.windSwirlFilter) {
          const t = c.currentTime;
          const slowCenter = 200 + Math.random() * 90;
          this.windSwirlFilter.frequency.setTargetAtTime(slowCenter, t, 3.2);
          this.nextWindDriftAt = nowMs + 5500 + Math.random() * 4500;
        }

        if (this.isThunderActive() && nowMs >= this.nextThunderAt) {
          const forcedOn = this.thunderMode === 'on';
          this.playThunder(forcedOn ? 0.85 : 0.72);
          // Sustained overlapping thunder rolls when thunder is active
          this.nextThunderAt = nowMs + (forcedOn ? 4600 + Math.random() * 2200 : 7000 + Math.random() * 4500);
        }
      }, 650);
    }
  }

  private windFilterInit(filter: BiquadFilterNode, gain: GainNode) {
    this.windSwirlFilter = filter;
    this.windGainNode = gain;
  }

  public isRainActive(): boolean {
    if (this.rainMode === 'on') return true;
    if (this.rainMode === 'off') return false;
    return this.weather === 'rainy';
  }

  public isWindActive(): boolean {
    if (this.windMode === 'on') return true;
    if (this.windMode === 'off') return false;
    return this.weather === 'breezy' || this.weather === 'rainy';
  }

  public isThunderActive(): boolean {
    if (this.thunderMode === 'on') return true;
    if (this.thunderMode === 'off') return false;
    return this.weather === 'rainy';
  }

  private syncAmbientVolumes() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.ensureAmbientSoundscape();
    const now = ctx.currentTime;
    const silent = this.muted || this.paused;

    if (this.rainGainNode) {
      // Smooth silky rainfall bed (0.032) paired with unhurried organic water droplets
      const targetRain = silent || !this.isRainActive() ? 0.0001 : 0.032;
      this.rainGainNode.gain.setTargetAtTime(targetRain, now, 0.55);
    }

    if (this.windGainNode) {
      // Gentle, quieter breeze volume (0.026 breezy/on, 0.013 light rain breeze)
      let targetWind = 0.0001;
      if (!silent && this.isWindActive()) {
        targetWind = this.windMode === 'on' || this.weather === 'breezy' ? 0.026 : 0.013;
      }
      this.windGainNode.gain.setTargetAtTime(targetWind, now, 0.75);
    }

    if (this.thunderBedGainNode) {
      let targetThunderBed = 0.0001;
      if (!silent && this.isThunderActive()) {
        targetThunderBed = this.thunderMode === 'on' ? 0.068 : 0.04;
      }
      this.thunderBedGainNode.gain.setTargetAtTime(targetThunderBed, now, 0.6);
    }
  }

  private playRaindropTick(freqStart: number, volume: number, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime + delay;

    // Tiny filtered water splash micro-transient so drop sounds wet & natural, not synthetic
    const splashSrc = ctx.createBufferSource();
    splashSrc.buffer = this.getNoiseBuffer(ctx);
    const splashFilter = ctx.createBiquadFilter();
    splashFilter.type = 'bandpass';
    splashFilter.frequency.setValueAtTime(freqStart * 1.9, now);
    splashFilter.Q.setValueAtTime(3.2, now);
    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0.0004, now);
    splashGain.gain.linearRampToValueAtTime(volume * 0.55, now + 0.004);
    splashGain.gain.exponentialRampToValueAtTime(0.0003, now + 0.024);
    splashSrc.connect(splashFilter);
    splashFilter.connect(splashGain);
    splashGain.connect(ctx.destination);
    splashSrc.start(now, Math.random() * 0.3, 0.028);

    // Soft rounded water-bubble pitch curve
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(freqStart * 1.38, now + 0.042);

    gain.gain.setValueAtTime(0.0004, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.007);
    gain.gain.exponentialRampToValueAtTime(volume * 0.3, now + 0.038);
    gain.gain.exponentialRampToValueAtTime(0.0003, now + 0.088);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  /**
   * Unhurried natural "滴⋯⋯答" water droplet motif with relaxed spacing
   */
  private playRaindropPair(delay = 0) {
    const diFreq = 780 + Math.random() * 240;
    const daFreq = 580 + Math.random() * 190;
    this.playRaindropTick(diFreq, 0.011 + Math.random() * 0.005, delay);
    if (Math.random() < 0.72) {
      const gap = 0.28 + Math.random() * 0.14;
      this.playRaindropTick(daFreq, 0.012 + Math.random() * 0.005, delay + gap);
    }
  }

  /**
   * Long sustained multi-echo rolling thunder (lasts ~6.5 seconds with overlapping swells)
   */
  playThunder(intensity = 0.85) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const pinkBuf = this.getPinkNoiseBuffer(ctx);
    const scale = Math.max(0.45, Math.min(1.2, intensity));

    // Stage 1: Atmospheric crackle onset
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = pinkBuf;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(840, now);
    crackFilter.Q.setValueAtTime(1.0, now);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.001, now);
    crackGain.gain.linearRampToValueAtTime(0.08 * scale, now + 0.035);
    crackGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);
    crackSrc.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackSrc.start(now, Math.random() * 1.2, 0.48);

    // Stage 2: Long 6.5-second continuous rolling thunder body with multiple echo swells
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = pinkBuf;
    rumbleSrc.loop = true;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(195, now + 0.08);
    rumbleFilter.frequency.linearRampToValueAtTime(115, now + 1.8);
    rumbleFilter.frequency.linearRampToValueAtTime(150, now + 3.1);
    rumbleFilter.frequency.exponentialRampToValueAtTime(58, now + 6.4);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.linearRampToValueAtTime(0.22 * scale, now + 0.2);
    rumbleGain.gain.linearRampToValueAtTime(0.14 * scale, now + 1.1);
    rumbleGain.gain.linearRampToValueAtTime(0.19 * scale, now + 1.8);
    rumbleGain.gain.linearRampToValueAtTime(0.11 * scale, now + 2.9);
    rumbleGain.gain.linearRampToValueAtTime(0.15 * scale, now + 3.7);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0008, now + 6.5);

    rumbleSrc.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumbleSrc.start(now, Math.random() * 0.5);
    rumbleSrc.stop(now + 6.6);

    // Stage 3: Sustained deep sub-bass thunder weight
    this.playTone(50, 3.6, 'sine', 0.08 * scale, 0.1, 34);
    this.playTone(44, 3.2, 'sine', 0.06 * scale, 2.0, 32);
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    delay = 0,
    endFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(35, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0008, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + Math.min(0.025, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  /**
   * Warm multi-harmonic acoustic felt-piano synthesis with hammer transient & natural string decay
   */
  private playPianoNote(freq: number, duration: number, velocity = 0.034, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || freq <= 0) return;

    const now = ctx.currentTime + delay;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(4200, freq * 5.2), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(480, freq * 2.1), now + duration);
    filter.Q.setValueAtTime(0.7, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0006, now);
    masterGain.gain.linearRampToValueAtTime(Math.max(0.001, velocity), now + 0.011);
    masterGain.gain.exponentialRampToValueAtTime(Math.max(0.001, velocity * 0.42), now + duration * 0.36);
    masterGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Fundamental + 2nd + 3rd piano string harmonics
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.82, now);
    osc1.connect(g1);
    g1.connect(filter);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.28, now);
    osc2.connect(g2);
    g2.connect(filter);

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, now);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.09, now);
    osc3.connect(g3);
    g3.connect(filter);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    const stopAt = now + duration + 0.04;
    osc1.stop(stopAt);
    osc2.stop(stopAt);
    osc3.stop(stopAt);
  }

  private playFilteredNoise(
    filterFreq: number,
    q: number,
    duration: number,
    volume: number,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0008, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.03);
  }

  /**
   * Shimmering plucked harp / acoustic string note
   */
  private playHarpPluck(freq: number, duration: number, velocity = 0.03, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || freq <= 0) return;

    const now = ctx.currentTime + delay;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0006, now);
    gain.gain.linearRampToValueAtTime(velocity, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.connect(gain);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.22, now);
    g2.gain.exponentialRampToValueAtTime(0.02, now + duration * 0.45);
    osc2.connect(g2);
    g2.connect(gain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.03);
    osc2.stop(now + duration + 0.03);
  }

  /**
   * Woody resonant kalimba / thumb-piano tine
   */
  private playKalimbaNote(freq: number, duration = 0.42, velocity = 0.032, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || freq <= 0) return;

    const now = ctx.currentTime + delay;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0006, now);
    gain.gain.linearRampToValueAtTime(velocity, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);
    gain.connect(ctx.destination);

    const fundamental = ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(freq, now);
    fundamental.connect(gain);

    // Metallic/woody percussive transient overtone
    const tine = ctx.createOscillator();
    tine.type = 'triangle';
    tine.frequency.setValueAtTime(freq * 2.98, now);
    const tineGain = ctx.createGain();
    tineGain.gain.setValueAtTime(0.32, now);
    tineGain.gain.exponentialRampToValueAtTime(0.008, now + 0.055);
    tine.connect(tineGain);
    tineGain.connect(gain);

    fundamental.start(now);
    tine.start(now);
    fundamental.stop(now + duration + 0.03);
    tine.stop(now + 0.07);
  }

  /**
   * Crystalline music-box bell tine
   */
  private playMusicBoxNote(freq: number, duration = 0.72, velocity = 0.024, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || freq <= 0) return;

    const now = ctx.currentTime + delay;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(velocity, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0004, now + duration);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.connect(gain);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 4, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.14, now);
    g2.gain.exponentialRampToValueAtTime(0.005, now + 0.14);
    osc2.connect(g2);
    g2.connect(gain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.03);
    osc2.stop(now + 0.16);
  }

  /**
   * Warm Rhodes-style electric piano for lo-fi & chill tracks
   */
  private playRhodesNote(freq: number, duration = 0.7, velocity = 0.028, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || freq <= 0) return;

    const now = ctx.currentTime + delay;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0006, now);
    gain.gain.linearRampToValueAtTime(velocity, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(velocity * 0.45, now + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.connect(gain);

    const bell = ctx.createOscillator();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(freq * 4, now);
    const bellGain = ctx.createGain();
    bellGain.gain.setValueAtTime(0.16, now);
    bellGain.gain.exponentialRampToValueAtTime(0.002, now + 0.11);
    bell.connect(bellGain);
    bellGain.connect(gain);

    osc1.start(now);
    bell.start(now);
    osc1.stop(now + duration + 0.03);
    bell.stop(now + 0.13);
  }

  /**
   * Mellow felt-muffled piano note tailored for deep study & focus
   */
  private playFeltPianoNote(freq: number, duration = 1.4, velocity = 0.022, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || freq <= 0) return;

    const now = ctx.currentTime + delay;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(1350, freq * 2.4), now);
    filter.Q.setValueAtTime(0.6, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0004, now);
    gain.gain.linearRampToValueAtTime(velocity, now + 0.028);
    gain.gain.exponentialRampToValueAtTime(velocity * 0.48, now + duration * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0004, now + duration);

    filter.connect(gain);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.connect(filter);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 0.999, now);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.55, now);
    osc2.connect(subGain);
    subGain.connect(filter);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.04);
    osc2.stop(now + duration + 0.04);
  }

  /**
   * Soft orchestral string pad note with slow bow attack
   */
  private playStringPad(freq: number, duration = 1.6, velocity = 0.02, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || freq <= 0) return;

    const now = ctx.currentTime + delay;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(2600, freq * 3.8), now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(velocity, now + Math.min(0.28, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    filter.connect(gain);
    gain.connect(ctx.destination);

    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.setValueAtTime(freq * 0.997, now);
    const oscB = ctx.createOscillator();
    oscB.type = 'sawtooth';
    oscB.frequency.setValueAtTime(freq * 1.003, now);

    oscA.connect(filter);
    oscB.connect(filter);
    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + duration + 0.04);
    oscB.stop(now + duration + 0.04);
  }

  /**
   * Breathy wooden / celtic flute voice
   */
  private playFluteNote(freq: number, duration = 0.72, velocity = 0.026, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || freq <= 0) return;

    const now = ctx.currentTime + delay;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0006, now);
    gain.gain.linearRampToValueAtTime(velocity, now + 0.065);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 2.4, now);
    osc.connect(lp);
    lp.connect(gain);

    osc.start(now);
    osc.stop(now + duration + 0.03);
    this.playFilteredNoise(freq * 1.5, 4.5, Math.min(0.14, duration * 0.3), velocity * 0.28, delay);
  }

  /**
   * Resonant wooden marimba bar
   */
  private playMarimbaNote(freq: number, duration = 0.38, velocity = 0.03, delay = 0) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || freq <= 0) return;

    const now = ctx.currentTime + delay;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0006, now);
    gain.gain.linearRampToValueAtTime(velocity, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0004, now + duration);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.connect(gain);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 4, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.24, now);
    g2.gain.exponentialRampToValueAtTime(0.004, now + 0.06);
    osc2.connect(g2);
    g2.connect(gain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.03);
    osc2.stop(now + 0.08);
  }

  private scheduleBgmTick() {
    if (this.bgmTimer !== null) {
      window.clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (!this.bgmPlaying) return;

    const stepMs = (() => {
      switch (this.bgmTrack) {
        case 'piano_nocturne':
          return this.isNight ? 580 : 440;
        case 'piano_morning_dew':
          return this.isNight ? 500 : 370;
        case 'piano_rainy_window':
          return this.isNight ? 660 : 540;
        case 'piano_sakura_breeze':
          return this.isNight ? 560 : 430;
        case 'piano_winter_snowfall':
          return this.isNight ? 680 : 560;
        case 'bamboo_zen':
          return this.isNight ? 700 : 540;
        case 'celtic_flute_meadow':
          return this.isNight ? 540 : 420;
        case 'bossa_afternoon':
          return this.isNight ? 460 : 360;
        case 'lofi_warm_cafe':
          return this.isNight ? 520 : 440;
        case 'nordic_harp':
          return this.isNight ? 620 : 480;
        case 'string_quartet_dawn':
          return this.isNight ? 720 : 580;
        case 'celesta_starlight':
          return this.isNight ? 560 : 440;
        case 'marimba_carousel':
          return this.isNight ? 400 : 310;
        case 'tropical_kalimba':
          return this.isNight ? 440 : 330;
        case 'guitar_campfires':
          return this.isNight ? 540 : 420;
        case 'music_box_lullaby':
          return this.isNight ? 540 : 430;
        case 'study_lofi_desk':
          return 520;
        case 'study_felt_piano':
          return 680;
        case 'study_alpha_rhodes':
          return 600;
        case 'study_library_guitar':
          return 540;
        case 'study_rainy_window':
          return 640;
        default:
          return this.isNight ? 620 : 450;
      }
    })();

    if (!this.muted && !this.bgmMuted && !this.paused) {
      const ctx = this.getContext();
      if (ctx && ctx.state === 'running') {
        if (this.bgmTrack === 'piano_stroll') {
          const step = this.bgmStep % 16;
          // Bright lyrical piano stroll (C -> Am -> F -> G7) with left-hand broken chords
          const dayRight = [
            523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 440.0, 523.25,
            698.46, 659.25, 587.33, 523.25, 587.33, 0, 392.0, 0,
          ];
          const nightRight = [
            392.0, 0, 523.25, 659.25, 440.0, 0, 392.0, 329.63,
            349.23, 440.0, 523.25, 0, 392.0, 0, 293.66, 0,
          ];
          const dayArpeggio = [
            261.63, 329.63, 392.0, 329.63, 220.0, 261.63, 329.63, 261.63,
            174.61, 220.0, 261.63, 220.0, 196.0, 246.94, 293.66, 246.94,
          ];
          const melFreq = this.isNight ? nightRight[step] : dayRight[step];
          const lhFreq = dayArpeggio[step];
          if (melFreq > 0) {
            this.playPianoNote(melFreq, this.isNight ? 0.95 : 0.72, this.isNight ? 0.028 : 0.034);
          }
          if (!this.isNight || step % 2 === 0) {
            this.playPianoNote(
              this.isNight ? lhFreq * 0.5 : lhFreq,
              this.isNight ? 1.15 : 0.65,
              this.isNight ? 0.02 : 0.022,
              0.015
            );
          }
        } else if (this.bgmTrack === 'piano_nocturne') {
          const step = this.bgmStep % 24;
          // Expressive 3/4 waltz piano arrangement (F major / D minor warmth)
          const waltzRight = [
            523.25, 0, 659.25, 698.46, 659.25, 587.33,
            523.25, 0, 440.0, 493.88, 0, 392.0,
            440.0, 0, 523.25, 587.33, 523.25, 440.0,
            392.0, 0, 440.0, 392.0, 0, 0,
          ];
          const nightWaltzRight = [
            440.0, 0, 523.25, 587.33, 0, 523.25,
            440.0, 0, 349.23, 392.0, 0, 329.63,
            293.66, 0, 349.23, 440.0, 0, 392.0,
            329.63, 0, 293.66, 261.63, 0, 0,
          ];
          const waltzLeft = [
            174.61, 261.63, 349.23, 174.61, 261.63, 349.23,
            146.83, 220.0, 293.66, 196.0, 246.94, 392.0,
            220.0, 261.63, 329.63, 174.61, 220.0, 261.63,
            196.0, 293.66, 392.0, 130.81, 261.63, 329.63,
          ];
          const rNote = this.isNight ? nightWaltzRight[step] : waltzRight[step];
          const lNote = waltzLeft[step];
          const isDownbeat = step % 3 === 0;
          if (rNote > 0) {
            this.playPianoNote(rNote, this.isNight ? 1.1 : 0.88, this.isNight ? 0.026 : 0.032);
          }
          this.playPianoNote(
            lNote,
            isDownbeat ? 1.05 : 0.55,
            isDownbeat ? 0.024 : 0.017,
            0.01
          );
        } else if (this.bgmTrack === 'piano_morning_dew') {
          // G major bright morning etude with sparkling broken arpeggios
          const step = this.bgmStep % 16;
          const rh = [
            783.99, 0, 739.99, 783.99, 987.77, 0, 880.0, 783.99,
            659.25, 0, 739.99, 783.99, 587.33, 0, 783.99, 0,
          ];
          const lh = [
            196.0, 293.66, 392.0, 493.88, 164.81, 246.94, 329.63, 392.0,
            130.81, 196.0, 261.63, 329.63, 146.83, 220.0, 293.66, 369.99,
          ];
          const mel = rh[step];
          if (mel > 0) {
            this.playPianoNote(
              this.isNight ? mel * 0.5 : mel,
              this.isNight ? 0.9 : 0.65,
              this.isNight ? 0.024 : 0.032
            );
          }
          this.playPianoNote(lh[step], 0.58, 0.02, 0.012);
        } else if (this.bgmTrack === 'piano_rainy_window') {
          // Tender E minor / Cmaj7 contemplative piano ballad
          const step = this.bgmStep % 16;
          const rh = [
            659.25, 0, 587.33, 493.88, 523.25, 0, 493.88, 440.0,
            392.0, 0, 440.0, 493.88, 440.0, 0, 329.63, 0,
          ];
          const lh = [
            164.81, 246.94, 329.63, 392.0, 130.81, 196.0, 246.94, 329.63,
            110.0, 164.81, 220.0, 261.63, 123.47, 196.0, 246.94, 293.66,
          ];
          if (rh[step] > 0) {
            this.playPianoNote(rh[step], 1.15, this.isNight ? 0.024 : 0.028);
          }
          if (!this.isNight || step % 2 === 0) {
            this.playPianoNote(lh[step], 0.9, 0.019, 0.015);
          }
        } else if (this.bgmTrack === 'acoustic_safari') {
          const step = this.bgmStep % 16;
          // Warm acoustic marimba & guitar stroll
          const dayMelody = [523.25, 0, 659.25, 587.33, 440.0, 0, 523.25, 659.25, 698.46, 0, 659.25, 587.33, 523.25, 440.0, 392.0, 0];
          const nightMelody = [392.0, 0, 523.25, 0, 440.0, 0, 329.63, 0, 349.23, 0, 440.0, 0, 392.0, 0, 293.66, 0];
          const bassRoots = [130.81, 130.81, 110.0, 110.0, 174.61, 174.61, 196.0, 196.0];

          const melFreq = this.isNight ? nightMelody[step] : dayMelody[step];
          if (melFreq > 0) {
            this.playTone(
              melFreq,
              this.isNight ? 0.54 : 0.34,
              this.isNight ? 'sine' : 'triangle',
              this.isNight ? 0.02 : 0.024
            );
          }
          if (step % 4 === 0) {
            const root = bassRoots[Math.floor(step / 2) % bassRoots.length];
            this.playTone(root, stepMs * 0.0036, 'sine', this.isNight ? 0.022 : 0.026);
            this.playTone(root * 1.5, stepMs * 0.0034, 'sine', this.isNight ? 0.013 : 0.016, 0.02);
          }
        } else if (this.bgmTrack === 'bossa_afternoon') {
          // Laid-back Fmaj7 -> G7 -> Em7 -> Am7 Bossa Nova groove
          const step = this.bgmStep % 16;
          const melody = [
            659.25, 0, 587.33, 523.25, 0, 587.33, 659.25, 0,
            698.46, 659.25, 0, 523.25, 440.0, 0, 392.0, 0,
          ];
          const bass = [174.61, 0, 0, 261.63, 196.0, 0, 0, 293.66, 164.81, 0, 0, 246.94, 220.0, 0, 196.0, 0];
          if (melody[step] > 0) {
            this.playPianoNote(melody[step], 0.52, this.isNight ? 0.022 : 0.028);
          }
          if (bass[step] > 0) {
            this.playTone(bass[step], 0.42, 'sine', 0.026);
          }
          // Syncopated chord comp on offbeats
          if (step === 2 || step === 6 || step === 10 || step === 14) {
            const compRoot = step < 4 ? 349.23 : step < 8 ? 392.0 : step < 12 ? 329.63 : 261.63;
            this.playHarpPluck(compRoot, 0.28, 0.016);
            this.playHarpPluck(compRoot * 1.25, 0.28, 0.014, 0.01);
          }
        } else if (this.bgmTrack === 'nordic_harp') {
          // Ethereal A minor / C major cascading harp plucks
          const step = this.bgmStep % 16;
          const arp = [
            440.0, 523.25, 659.25, 880.0, 783.99, 659.25, 523.25, 659.25,
            349.23, 440.0, 523.25, 698.46, 659.25, 587.33, 493.88, 392.0,
          ];
          this.playHarpPluck(arp[step], 1.1, this.isNight ? 0.024 : 0.028);
          if (step % 4 === 0) {
            const drone = step < 8 ? 220.0 : step < 12 ? 174.61 : 196.0;
            this.playTone(drone, 1.35, 'sine', 0.018);
          }
        } else if (this.bgmTrack === 'tropical_kalimba') {
          // Playful rhythmic rainforest kalimba pattern in D major pentatonic
          const step = this.bgmStep % 16;
          const tines = [
            587.33, 739.99, 880.0, 0, 739.99, 659.25, 587.33, 880.0,
            987.77, 0, 880.0, 739.99, 659.25, 587.33, 440.0, 0,
          ];
          const bass = [146.83, 0, 220.0, 0, 146.83, 0, 220.0, 0, 196.0, 0, 293.66, 0, 220.0, 0, 146.83, 0];
          if (tines[step] > 0) {
            this.playKalimbaNote(
              this.isNight ? tines[step] * 0.5 : tines[step],
              0.46,
              this.isNight ? 0.024 : 0.032
            );
          }
          if (bass[step] > 0) {
            this.playKalimbaNote(bass[step], 0.5, 0.022, 0.01);
          }
        } else if (this.bgmTrack === 'music_box_lullaby') {
          // Delicate fairy-tale music box chimes in F major
          const step = this.bgmStep % 16;
          const chimes = [
            698.46, 880.0, 1046.5, 0, 880.0, 783.99, 698.46, 0,
            659.25, 783.99, 880.0, 0, 783.99, 698.46, 523.25, 0,
          ];
          const baseChime = [349.23, 0, 523.25, 0, 293.66, 0, 440.0, 0, 261.63, 0, 392.0, 0, 349.23, 0, 261.63, 0];
          if (chimes[step] > 0) {
            this.playMusicBoxNote(chimes[step], 0.78, this.isNight ? 0.02 : 0.024);
          }
          if (baseChime[step] > 0) {
            this.playMusicBoxNote(baseChime[step], 0.9, 0.016, 0.015);
          }
        } else if (this.bgmTrack === 'piano_sakura_breeze') {
          // D major lyrical sakura spring piano waltz-like arpeggio
          const step = this.bgmStep % 16;
          const rh = [
            587.33, 659.25, 739.99, 880.0, 987.77, 880.0, 739.99, 659.25,
            587.33, 0, 739.99, 880.0, 739.99, 659.25, 587.33, 0,
          ];
          const lh = [
            146.83, 220.0, 293.66, 369.99, 123.47, 185.0, 246.94, 293.66,
            196.0, 246.94, 293.66, 392.0, 220.0, 277.18, 329.63, 220.0,
          ];
          if (rh[step] > 0) {
            this.playPianoNote(rh[step], 0.95, this.isNight ? 0.024 : 0.03);
          }
          this.playPianoNote(lh[step], 0.72, 0.019, 0.012);
        } else if (this.bgmTrack === 'piano_winter_snowfall') {
          // C minor / Eb major delicate crystalline snowfall piano miniature
          const step = this.bgmStep % 16;
          const rh = [
            783.99, 0, 932.33, 783.99, 698.46, 0, 622.25, 587.33,
            523.25, 0, 622.25, 698.46, 587.33, 0, 523.25, 0,
          ];
          const lh = [
            130.81, 196.0, 261.63, 311.13, 155.56, 233.08, 311.13, 392.0,
            174.61, 261.63, 349.23, 415.3, 196.0, 246.94, 293.66, 392.0,
          ];
          if (rh[step] > 0) {
            this.playPianoNote(rh[step], 1.15, 0.025);
          }
          if (!this.isNight || step % 2 === 0) {
            this.playPianoNote(lh[step], 0.95, 0.018, 0.014);
          }
        } else if (this.bgmTrack === 'guitar_campfires') {
          // Warm acoustic fingerpicked G -> Em -> C -> D ballad
          const step = this.bgmStep % 16;
          const fingerpick = [
            196.0, 293.66, 392.0, 493.88, 164.81, 246.94, 329.63, 392.0,
            130.81, 261.63, 329.63, 392.0, 146.83, 220.0, 293.66, 369.99,
          ];
          const topMel = [0, 0, 587.33, 0, 0, 493.88, 0, 440.0, 0, 0, 523.25, 0, 493.88, 0, 440.0, 0];
          this.playHarpPluck(fingerpick[step], 0.68, 0.024);
          if (topMel[step] > 0) {
            this.playHarpPluck(topMel[step], 0.85, 0.022, 0.01);
          }
        } else if (this.bgmTrack === 'lofi_warm_cafe') {
          // Cozy Rhodes 7th chords + muted soft brush beat
          const step = this.bgmStep % 16;
          const roots = [174.61, 164.81, 146.83, 130.81];
          const chordIdx = Math.floor(step / 4);
          if (step % 4 === 0) {
            const r = roots[chordIdx];
            this.playRhodesNote(r * 2, 1.35, 0.022);
            this.playRhodesNote(r * 2.4, 1.3, 0.017, 0.018);
            this.playRhodesNote(r * 3, 1.3, 0.016, 0.032);
            this.playRhodesNote(r * 3.6, 1.2, 0.014, 0.048);
          }
          const lead = [0, 698.46, 0, 659.25, 0, 587.33, 523.25, 0, 0, 523.25, 587.33, 0, 440.0, 0, 392.0, 0];
          if (lead[step] > 0) {
            this.playRhodesNote(lead[step], 0.6, 0.02);
          }
          if (step % 4 === 2) {
            this.playFilteredNoise(2400, 1.4, 0.06, 0.012);
          }
        } else if (this.bgmTrack === 'celtic_flute_meadow') {
          // Open G/D Celtic pastoral flute melody with harp drone
          const step = this.bgmStep % 16;
          const flute = [
            587.33, 0, 659.25, 739.99, 880.0, 0, 739.99, 659.25,
            587.33, 493.88, 440.0, 0, 493.88, 587.33, 440.0, 0,
          ];
          if (flute[step] > 0) {
            this.playFluteNote(flute[step], 0.78, this.isNight ? 0.021 : 0.026);
          }
          if (step % 4 === 0) {
            const drone = step < 8 ? 146.83 : 196.0;
            this.playHarpPluck(drone, 1.2, 0.022);
            this.playHarpPluck(drone * 1.5, 1.1, 0.016, 0.015);
          }
        } else if (this.bgmTrack === 'string_quartet_dawn') {
          // Warm sustained string quartet progressions
          const step = this.bgmStep % 16;
          if (step % 4 === 0) {
            const roots = [130.81, 110.0, 174.61, 196.0];
            const r = roots[Math.floor(step / 4)];
            this.playStringPad(r, 2.0, 0.018);
            this.playStringPad(r * 2.5, 1.9, 0.014, 0.02);
            this.playStringPad(r * 3, 1.9, 0.012, 0.04);
          }
          const violin = [659.25, 0, 783.99, 0, 880.0, 0, 783.99, 659.25, 698.46, 0, 659.25, 0, 587.33, 0, 523.25, 0];
          if (violin[step] > 0) {
            this.playStringPad(violin[step], 1.1, 0.014);
          }
        } else if (this.bgmTrack === 'celesta_starlight') {
          // Sparkling celesta night sky arpeggios
          const step = this.bgmStep % 16;
          const cel = [
            1046.5, 1318.5, 1567.98, 0, 1318.5, 1174.66, 1046.5, 0,
            880.0, 1046.5, 1318.5, 0, 1174.66, 987.77, 783.99, 0,
          ];
          if (cel[step] > 0) {
            this.playMusicBoxNote(cel[step], 0.9, 0.02);
          }
          if (step % 2 === 0) {
            const bass = step < 8 ? 261.63 : step < 12 ? 220.0 : 196.0;
            this.playRhodesNote(bass, 0.8, 0.016, 0.01);
          }
        } else if (this.bgmTrack === 'marimba_carousel') {
          // Cheerful bouncy wooden marimba carousel in C major
          const step = this.bgmStep % 16;
          const mar = [
            523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 523.25,
            587.33, 698.46, 880.0, 698.46, 783.99, 659.25, 587.33, 392.0,
          ];
          this.playMarimbaNote(this.isNight ? mar[step] * 0.5 : mar[step], 0.36, 0.03);
          if (step % 2 === 0) {
            this.playMarimbaNote(step < 8 ? 130.81 : 196.0, 0.4, 0.022, 0.008);
          }
        } else if (this.bgmTrack === 'study_lofi_desk') {
          // Steady 4/4 warm Lo-Fi Rhodes 9th chords + dusty soft brush pulse for deep study
          const step = this.bgmStep % 16;
          const roots = [146.83, 196.0, 130.81, 110.0]; // Dm9 -> G13 -> Cmaj9 -> Am9
          if (step % 4 === 0) {
            const r = roots[Math.floor(step / 4)];
            this.playRhodesNote(r, 1.9, 0.02);
            this.playRhodesNote(r * 1.5, 1.8, 0.014, 0.015);
            this.playRhodesNote(r * 2.25, 1.75, 0.012, 0.03);
          }
          const motif = [0, 0, 523.25, 0, 0, 493.88, 0, 440.0, 0, 0, 392.0, 0, 0, 440.0, 0, 0];
          if (motif[step] > 0) {
            this.playFeltPianoNote(motif[step], 0.95, 0.016);
          }
          if (step % 4 === 0) {
            this.playTone(73.42, 0.16, 'sine', 0.022);
          } else if (step % 4 === 2) {
            this.playFilteredNoise(1800, 1.2, 0.045, 0.009);
          }
        } else if (this.bgmTrack === 'study_felt_piano') {
          // Minimalist felt-muffled piano ostinato in Fmaj7 -> C/E -> Dm7 -> Bbmaj7
          const step = this.bgmStep % 16;
          const lh = [
            174.61, 261.63, 349.23, 261.63,
            164.81, 261.63, 329.63, 261.63,
            146.83, 220.0, 293.66, 220.0,
            116.54, 174.61, 233.08, 174.61,
          ];
          const rh = [523.25, 0, 0, 440.0, 392.0, 0, 0, 0, 440.0, 0, 0, 349.23, 392.0, 0, 0, 0];
          this.playFeltPianoNote(lh[step], 1.45, 0.019);
          if (rh[step] > 0) {
            this.playFeltPianoNote(rh[step], 1.8, 0.02, 0.015);
          }
        } else if (this.bgmTrack === 'study_alpha_rhodes') {
          // Warm low-frequency alpha-wave cushion + steady calm electric piano intervals
          const step = this.bgmStep % 16;
          const padRoots = [130.81, 164.81, 174.61, 196.0];
          if (step % 4 === 0) {
            const r = padRoots[Math.floor(step / 4)];
            this.playTone(r, 2.35, 'sine', 0.022);
            this.playTone(r * 1.5, 2.25, 'sine', 0.012, 0.02);
          }
          const chime = [392.0, 0, 523.25, 0, 493.88, 0, 392.0, 0, 440.0, 0, 523.25, 0, 392.0, 0, 329.63, 0];
          if (chime[step] > 0) {
            this.playRhodesNote(chime[step], 1.35, 0.017);
          }
        } else if (this.bgmTrack === 'study_library_guitar') {
          // Warm acoustic nylon guitar broken chords in warm C / Am / F / Gadd9
          const step = this.bgmStep % 16;
          const arps = [
            130.81, 196.0, 261.63, 329.63,
            110.0, 164.81, 220.0, 261.63,
            174.61, 220.0, 261.63, 349.23,
            196.0, 246.94, 293.66, 392.0,
          ];
          this.playFeltPianoNote(arps[step], 1.25, 0.018);
          if (step % 4 === 2) {
            this.playHarpPluck(arps[step] * 1.5, 0.9, 0.013, 0.012);
          }
        } else if (this.bgmTrack === 'study_rainy_window') {
          // Gentle rainy desk Am9 / Fmaj9 contemplation with soft low pad
          const step = this.bgmStep % 16;
          if (step % 8 === 0) {
            const base = step === 0 ? 110.0 : 174.61;
            this.playTone(base, 4.4, 'sine', 0.02);
            this.playTone(base * 1.5, 4.2, 'sine', 0.011);
          }
          const drops = [440.0, 0, 523.25, 0, 659.25, 0, 523.25, 0, 440.0, 0, 392.0, 0, 329.63, 0, 0, 0];
          if (drops[step] > 0) {
            this.playFeltPianoNote(drops[step], 1.7, 0.019);
          }
        } else {
          // 'bamboo_zen': Serene Japanese pentatonic (Yo scale: D, E, G, A, B) wind chime & flute
          const step = this.bgmStep % 16;
          const zenMelody = [
            587.33, 0, 659.25, 0, 783.99, 659.25, 587.33, 0,
            880.0, 0, 783.99, 659.25, 587.33, 0, 493.88, 0,
          ];
          const nightZen = [
            440.0, 0, 587.33, 0, 659.25, 0, 587.33, 0,
            493.88, 0, 440.0, 0, 392.0, 0, 293.66, 0,
          ];
          const mel = this.isNight ? nightZen[step] : zenMelody[step];
          if (mel > 0) {
            this.playTone(mel, 0.78, 'sine', this.isNight ? 0.02 : 0.024);
            this.playTone(mel * 2, 0.42, 'sine', 0.007, 0.02);
          }
          if (step % 8 === 0) {
            this.playTone(step === 0 ? 146.83 : 196.0, 1.4, 'sine', 0.02);
          }
        }
        this.bgmStep += 1;
      }
    }

    this.bgmTimer = window.setTimeout(() => this.scheduleBgmTick(), stepMs);
  }

  startBgm() {
    this.unlock();
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.scheduleBgmTick();
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer !== null) {
      window.clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  setBgmTrack(track: BgmTrackId) {
    this.bgmTrack = track;
    this.bgmStep = 0;
    if (this.bgmPlaying) {
      this.unlock();
      this.scheduleBgmTick();
    }
  }

  setWeather(weather: WeatherType) {
    this.weather = weather;
    this.syncAmbientVolumes();
  }

  setRainMode(mode: AmbientAudioMode) {
    this.rainMode = mode;
    this.unlock();
    this.syncAmbientVolumes();
  }

  setWindMode(mode: AmbientAudioMode) {
    this.windMode = mode;
    this.unlock();
    this.syncAmbientVolumes();
  }

  setThunderMode(mode: AmbientAudioMode) {
    this.thunderMode = mode;
    this.unlock();
    this.syncAmbientVolumes();
    if (mode === 'on') {
      this.playThunder(0.9);
      this.nextThunderAt = Date.now() + 4800;
    }
  }

  setNightMode(night: boolean) {
    this.isNight = night;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.syncAmbientVolumes();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.syncAmbientVolumes();
  }

  setBgmMuted(bgmMuted: boolean) {
    this.bgmMuted = bgmMuted;
  }

  playBuild() {
    this.playTone(220, 0.09, 'triangle', 0.1);
    this.playTone(330, 0.12, 'triangle', 0.08, 0.05);
  }

  playCoin() {
    this.playTone(880, 0.08, 'sine', 0.06);
    this.playTone(1318.5, 0.14, 'sine', 0.06, 0.06);
  }

  playCare() {
    this.playTone(523.25, 0.1, 'sine', 0.08);
    this.playTone(659.25, 0.14, 'sine', 0.07, 0.07);
  }

  playError() {
    this.playTone(180, 0.12, 'sawtooth', 0.05);
  }

  playMilestone() {
    this.playTone(523.25, 0.12, 'triangle', 0.09, 0);
    this.playTone(659.25, 0.12, 'triangle', 0.09, 0.1);
    this.playTone(783.99, 0.16, 'triangle', 0.09, 0.2);
    this.playTone(1046.5, 0.28, 'triangle', 0.1, 0.3);
  }

  playDemolish() {
    this.playTone(150, 0.1, 'square', 0.04);
    this.playTone(110, 0.14, 'square', 0.03, 0.05);
  }

  playShutter() {
    this.playTone(1750, 0.028, 'square', 0.05, 0, 520);
    this.playTone(1120, 0.035, 'triangle', 0.045, 0.04, 340);
  }

  /**
   * Procedural distinct voice synthesis per visitor archetype & mood
   */
  playVisitorVoice(
    archetype: VisitorArchetype,
    reaction: 'happy' | 'greet' | 'complaint' = 'happy',
    force = false
  ) {
    const nowMs = Date.now();
    if (!force && nowMs - this.lastVisitorVoiceAt < 1100) return;
    this.lastVisitorVoiceAt = nowMs;

    const isComplaint = reaction === 'complaint';
    switch (archetype) {
      case 'child':
        if (isComplaint) {
          this.playTone(640, 0.14, 'triangle', 0.05, 0, 440);
        } else {
          this.playTone(660, 0.08, 'triangle', 0.05, 0, 880);
          this.playTone(880, 0.1, 'triangle', 0.045, 0.08, 1020);
        }
        break;
      case 'elder':
        if (isComplaint) {
          this.playTone(240, 0.18, 'sine', 0.055, 0, 185);
        } else {
          this.playTone(255, 0.14, 'sine', 0.055, 0, 295);
          this.playTone(310, 0.16, 'sine', 0.045, 0.12, 340);
        }
        break;
      case 'photographer':
        this.playTone(1450, 0.03, 'square', 0.03, 0, 400);
        if (!isComplaint) {
          this.playTone(460, 0.12, 'sine', 0.045, 0.06, 560);
        } else {
          this.playTone(400, 0.14, 'sine', 0.04, 0.06, 310);
        }
        break;
      case 'explorer':
        if (isComplaint) {
          this.playTone(360, 0.15, 'triangle', 0.05, 0, 270);
        } else {
          this.playTone(370, 0.09, 'triangle', 0.055, 0, 450);
          this.playTone(500, 0.14, 'triangle', 0.05, 0.08, 560);
        }
        break;
      case 'tourist':
        if (isComplaint) {
          this.playTone(480, 0.16, 'sine', 0.045, 0, 350);
        } else {
          this.playTone(440, 0.08, 'sine', 0.045, 0, 520);
          this.playTone(554, 0.12, 'sine', 0.045, 0.08, 659);
        }
        break;
      case 'student':
        if (isComplaint) {
          this.playTone(520, 0.14, 'sine', 0.04, 0, 390);
        } else {
          this.playTone(510, 0.07, 'sine', 0.045, 0, 590);
          this.playTone(620, 0.09, 'sine', 0.045, 0.07, 720);
        }
        break;
      case 'couple':
        if (isComplaint) {
          this.playTone(500, 0.14, 'sine', 0.04, 0, 380);
        } else {
          this.playTone(587.33, 0.08, 'sine', 0.042, 0, 659.25);
          this.playTone(739.99, 0.12, 'sine', 0.04, 0.07, 880);
        }
        break;
      case 'artist':
        if (isComplaint) {
          this.playTone(430, 0.15, 'triangle', 0.04, 0, 330);
        } else {
          this.playTone(493.88, 0.1, 'triangle', 0.042, 0, 587.33);
          this.playTone(659.25, 0.13, 'sine', 0.04, 0.09, 739.99);
        }
        break;
      case 'researcher':
        if (isComplaint) {
          this.playTone(320, 0.14, 'sine', 0.045, 0, 260);
        } else {
          this.playTone(349.23, 0.08, 'sine', 0.045, 0, 440);
          this.playTone(523.25, 0.1, 'triangle', 0.04, 0.08, 554.37);
        }
        break;
      case 'runner':
        if (isComplaint) {
          this.playTone(390, 0.12, 'triangle', 0.045, 0, 290);
        } else {
          this.playTone(440, 0.06, 'triangle', 0.05, 0, 587.33);
          this.playTone(659.25, 0.08, 'triangle', 0.048, 0.06, 783.99);
        }
        break;
      case 'foodie':
        if (isComplaint) {
          this.playTone(420, 0.15, 'sine', 0.045, 0, 310);
        } else {
          this.playTone(523.25, 0.08, 'sine', 0.045, 0, 659.25);
          this.playTone(783.99, 0.12, 'triangle', 0.042, 0.075, 880);
        }
        break;
      case 'vip':
        if (isComplaint) {
          this.playTone(290, 0.16, 'triangle', 0.05, 0, 220);
        } else {
          this.playTone(392, 0.09, 'triangle', 0.045, 0, 493.88);
          this.playTone(587.33, 0.13, 'sine', 0.045, 0.08, 783.99);
        }
        break;
    }
  }

  /**
   * Multi-layered realistic vocalization for all 20 animal species (ambient or direct interaction)
   */
  playAnimalVoice(speciesId: SpeciesId, ambient = false) {
    const nowMs = Date.now();
    if (ambient && nowMs - this.lastAnimalVoiceAt < 14000) return;
    this.lastAnimalVoiceAt = nowMs;

    const scale = ambient ? 0.42 : 1.0;

    switch (speciesId) {
      case 'lion':
        this.playTone(122, 0.34, 'sawtooth', 0.06 * scale, 0, 64);
        this.playTone(96, 0.32, 'triangle', 0.05 * scale, 0.04, 58);
        this.playFilteredNoise(290, 2.2, 0.36, 0.045 * scale, 0.02);
        break;
      case 'tiger':
        this.playTone(108, 0.22, 'sawtooth', 0.055 * scale, 0, 74);
        this.playFilteredNoise(420, 3.0, 0.18, 0.045 * scale, 0.02);
        this.playFilteredNoise(380, 2.6, 0.16, 0.04 * scale, 0.18);
        break;
      case 'cheetah':
        // Distinct cheetah bird-like high chirp
        this.playTone(1380, 0.075, 'sine', 0.042 * scale, 0, 1790);
        this.playTone(1440, 0.08, 'sine', 0.038 * scale, 0.11, 1860);
        break;
      case 'elephant':
        this.playTone(230, 0.14, 'sawtooth', 0.05 * scale, 0, 610);
        this.playTone(590, 0.26, 'triangle', 0.055 * scale, 0.13, 360);
        this.playFilteredNoise(740, 2.5, 0.22, 0.03 * scale, 0.08);
        break;
      case 'giraffe':
        this.playTone(145, 0.24, 'sine', 0.04 * scale, 0, 118);
        this.playTone(125, 0.18, 'triangle', 0.025 * scale, 0.12, 110);
        break;
      case 'zebra':
        this.playTone(410, 0.1, 'sawtooth', 0.04 * scale, 0, 580);
        this.playTone(480, 0.14, 'triangle', 0.045 * scale, 0.12, 310);
        break;
      case 'meerkat':
        // Quick inquisitive desert sentry squeak-bark
        this.playTone(940, 0.045, 'triangle', 0.042 * scale, 0, 1280);
        this.playTone(1040, 0.05, 'triangle', 0.038 * scale, 0.07, 1340);
        break;
      case 'kangaroo':
        // Gentle low nasal cluck & hop thump
        this.playTone(175, 0.09, 'triangle', 0.04 * scale, 0, 120);
        this.playTone(110, 0.12, 'sine', 0.042 * scale, 0.11, 78);
        break;
      case 'panda':
        this.playTone(480, 0.11, 'sine', 0.045 * scale, 0, 610);
        this.playTone(580, 0.14, 'triangle', 0.035 * scale, 0.1, 510);
        break;
      case 'red_panda':
        this.playTone(860, 0.07, 'sine', 0.04 * scale, 0, 1140);
        this.playTone(980, 0.09, 'sine', 0.038 * scale, 0.08, 790);
        break;
      case 'koala':
        this.playTone(132, 0.18, 'sawtooth', 0.042 * scale, 0, 92);
        this.playTone(118, 0.16, 'triangle', 0.04 * scale, 0.2, 86);
        break;
      case 'peacock':
        // Resonant nasal two-tone peacock fanfare call
        this.playTone(760, 0.16, 'sawtooth', 0.036 * scale, 0, 630);
        this.playTone(1140, 0.18, 'triangle', 0.034 * scale, 0.03, 940);
        this.playTone(780, 0.2, 'triangle', 0.036 * scale, 0.22, 600);
        break;
      case 'hippo':
        this.playTone(76, 0.28, 'sawtooth', 0.05 * scale, 0, 54);
        this.playFilteredNoise(210, 1.8, 0.28, 0.045 * scale, 0.02);
        break;
      case 'capybara':
        this.playTone(650, 0.05, 'triangle', 0.04 * scale, 0, 740);
        this.playTone(720, 0.05, 'triangle', 0.04 * scale, 0.07, 810);
        this.playTone(690, 0.07, 'sine', 0.035 * scale, 0.14, 620);
        break;
      case 'otter':
        // Bubbly playful otter chirps
        this.playTone(1100, 0.055, 'sine', 0.04 * scale, 0, 1460);
        this.playTone(1340, 0.06, 'sine', 0.038 * scale, 0.075, 980);
        this.playTone(1180, 0.055, 'triangle', 0.03 * scale, 0.15, 1420);
        break;
      case 'penguin':
        this.playTone(540, 0.09, 'sawtooth', 0.04 * scale, 0, 720);
        this.playTone(680, 0.12, 'triangle', 0.045 * scale, 0.11, 490);
        break;
      case 'seal':
        this.playTone(320, 0.1, 'sawtooth', 0.042 * scale, 0, 440);
        this.playTone(345, 0.11, 'sawtooth', 0.04 * scale, 0.13, 465);
        break;
      case 'polar_bear':
        // Deep hollow arctic bear growl + frosty breath
        this.playTone(86, 0.3, 'sawtooth', 0.05 * scale, 0, 52);
        this.playFilteredNoise(240, 1.9, 0.32, 0.04 * scale, 0.04);
        break;
      case 'toucan':
        this.playTone(260, 0.06, 'square', 0.026 * scale, 0, 295);
        this.playTone(280, 0.06, 'square', 0.026 * scale, 0.08, 310);
        this.playTone(1080, 0.12, 'sine', 0.035 * scale, 0.16, 840);
        break;
      case 'flamingo':
        this.playTone(470, 0.12, 'sawtooth', 0.035 * scale, 0, 390);
        this.playTone(520, 0.13, 'triangle', 0.04 * scale, 0.13, 430);
        break;
    }
  }
}

export const soundFX = new SoundManager();

