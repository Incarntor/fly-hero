/**
 * Синтезатор группы на Web Audio: барабаны, бас, клавишный пэд, гитара с мягким перегрузом и реакция зала.
 * Все методы принимают `when` — момент в часах AudioContext, чтобы звук шёл ровно по сетке, а не по кадрам.
 */

import { midiToFreq, type BackingEvent } from './songs';

export type Timbre = 'fly' | 'smooth' | 'rhythm' | 'player';

export class Band {
  private ctx: BaseAudioContext | null = null;
  private master!: GainNode;
  /** Вход компрессора — общая шина всех инструментов. */
  private bus!: AudioNode;
  private drums!: GainNode;
  private delay!: DelayNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private delaySend!: GainNode;
  private noise!: AudioBuffer;
  muted = false;

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  get running(): boolean {
    return this.ctx !== null;
  }

  /**
   * Вызывать из обработчика клика — браузеры не дают играть звук без жеста пользователя.
   * @param context например OfflineAudioContext — чтобы отрендерить песню в файл
   */
  start(context?: BaseAudioContext): void {
    if (this.ctx) {
      if (this.ctx instanceof AudioContext) void this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = context ?? new AudioContext());

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.2;
    // лимитер после компрессора — чтобы пики не хрипели
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    compressor.connect(limiter).connect(this.master).connect(ctx.destination);
    this.bus = compressor;

    this.drums = ctx.createGain();
    this.drums.gain.value = 0.7;
    this.drums.connect(compressor);

    // ревербератор: затухающий стерео-шум вместо записанного зала
    this.reverb = ctx.createConvolver();
    const length = Math.floor(ctx.sampleRate * 1.8);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    this.reverb.buffer = impulse;
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.35;
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(this.reverb).connect(reverbReturn).connect(compressor);

    // дилей для гитары
    this.delaySend = ctx.createGain();
    const delay = (this.delay = ctx.createDelay(1));
    delay.delayTime.value = 0.3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.2;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 2200;
    const delayReturn = ctx.createGain();
    delayReturn.gain.value = 0.12;
    this.delaySend.connect(delay).connect(delayTone).connect(feedback).connect(delay);
    delayTone.connect(delayReturn).connect(compressor);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Темп для дилея: пунктирная восьмая звучит «музыкально». */
  setTempo(bpm: number): void {
    if (this.ctx) this.delay.delayTime.value = Math.min(0.9, (60 / bpm) * 0.75);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx) this.master.gain.value = muted ? 0 : 0.8;
  }

  /** Сыграть событие аккомпанемента. timeScale > 1 растягивает длительности (слоу-мо). */
  play(when: number, event: BackingEvent, timeScale = 1): void {
    switch (event.kind) {
      case 'bass':
        return this.bass(when, event.midi, event.durationMs * timeScale, (event.attackMs ?? 8) * timeScale);
      case 'chord':
        return this.chord(when, event.midis, event.durationMs * timeScale, (event.attackMs ?? 60) * timeScale);
      case 'power':
        return this.power(when, event.midi, event.fifth, event.durationMs * timeScale, event.muted, event.velocity, (event.attackMs ?? 4) * timeScale);
      case 'swell':
        return this.swell(when, event.durationMs * timeScale, event.velocity);
      case 'lead':
        return this.lead(when, event.midi, event.durationMs * timeScale, event.fly ? (event.smooth ? 'smooth' : 'fly') : 'rhythm', event.harmony, event.bendTo);
      case 'clean':
        return this.clean(when, event.midi, event.durationMs * timeScale, event.velocity);
      case 'bell':
        return this.bell(when, event.midi, event.velocity);
      case 'tomHigh':
        return this.tom(when, 220, event.velocity);
      case 'tomMid':
        return this.tom(when, 160, event.velocity);
      case 'tomLow':
        return this.tom(when, 105, event.velocity);
      default:
        return this[event.kind](when, event.velocity);
    }
  }

  // --- барабаны ---

  kick(when: number, velocity = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.07);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(1 * velocity, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.42);
    osc.connect(gain).connect(this.drums);
    osc.start(when);
    osc.stop(when + 0.45);
    // щелчок колотушки — чтобы бочку было слышно сквозь гитары
    this.noiseBurst(when, 'bandpass', 3500, 0.22 * velocity, 0.015, this.drums, 1.2);
  }

  snare(when: number, velocity = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.noiseBurst(when, 'bandpass', 1700, 0.6 * velocity, 0.22, this.drums, 0.6, 0.45);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, when);
    osc.frequency.exponentialRampToValueAtTime(140, when + 0.08);
    gain.gain.setValueAtTime(0.45 * velocity, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
    osc.connect(gain).connect(this.drums);
    osc.start(when);
    osc.stop(when + 0.1);
  }

  hat(when: number, velocity = 1): void {
    this.noiseBurst(when, 'highpass', 8000, 0.08 * velocity, 0.035, this.drums);
  }

  /** «Обратная» тарелка: шум нарастает и светлеет к концу, обрывается ровно в долю. */
  swell(when: number, durationMs: number, velocity = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const duration = durationMs / 1000;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, when);
    filter.frequency.exponentialRampToValueAtTime(5000, when + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.12 * velocity, when + duration);
    gain.gain.linearRampToValueAtTime(0.0001, when + duration + 0.03);
    source.connect(filter).connect(gain).connect(this.drums);
    const send = ctx.createGain();
    send.gain.value = 0.4;
    gain.connect(send).connect(this.reverbSend);
    source.start(when);
    source.stop(when + duration + 0.05);
  }

  ride(when: number, velocity = 1): void {
    this.noiseBurst(when, 'bandpass', 6500, 0.09 * velocity, 0.45, this.drums, 1.5, 0.2);
    this.tone(when, 3100, 0.012 * velocity, 0.5, 'sine');
  }

  tom(when: number, freq: number, velocity = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(freq * 1.4, when);
    osc.frequency.exponentialRampToValueAtTime(freq, when + 0.05);
    gain.gain.setValueAtTime(0.55 * velocity, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
    osc.connect(gain).connect(this.drums);
    const send = ctx.createGain();
    send.gain.value = 0.3;
    gain.connect(send).connect(this.reverbSend);
    osc.start(when);
    osc.stop(when + 0.4);
    this.noiseBurst(when, 'lowpass', 1200, 0.12 * velocity, 0.05, this.drums);
  }

  crash(when: number, velocity = 1): void {
    this.noiseBurst(when, 'highpass', 4000, 0.2 * velocity, 2.2, this.drums, 0.5, 0.35);
  }

  stick(when: number, velocity = 1): void {
    this.noiseBurst(when, 'bandpass', 3200, 0.3 * velocity, 0.03, this.drums, 4);
  }

  // --- бас и клавиши ---

  bass(when: number, midi: number, durationMs: number, attackMs = 8): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const duration = durationMs / 1000;
    const attack = attackMs / 1000;
    const freq = midiToFreq(midi);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    if (attack > 0.05) {
      gain.gain.linearRampToValueAtTime(0.11, when + attack);
    } else {
      gain.gain.exponentialRampToValueAtTime(0.17, when + attack);
      gain.gain.exponentialRampToValueAtTime(0.11, when + 0.12);
    }
    gain.gain.setValueAtTime(0.11, when + Math.max(attack, 0.12, duration - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration + 0.05);

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = freq;
    const growl = ctx.createOscillator();
    growl.type = 'sawtooth';
    growl.frequency.value = freq;
    const growlFilter = ctx.createBiquadFilter();
    growlFilter.type = 'lowpass';
    growlFilter.frequency.setValueAtTime(900, when);
    growlFilter.frequency.exponentialRampToValueAtTime(300, when + 0.15);
    const growlGain = ctx.createGain();
    growlGain.gain.value = 0.35;

    body.connect(gain);
    growl.connect(growlFilter).connect(growlGain).connect(gain);
    gain.connect(this.bus);
    for (const osc of [body, growl]) {
      osc.start(when);
      osc.stop(when + duration + 0.08);
    }
  }

  /** Тёплый пэд: по два расстроенных голоса на ноту через мягкий фильтр. */
  chord(when: number, midis: number[], durationMs: number, attackMs = 60): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const duration = durationMs / 1000;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, when);
    filter.frequency.linearRampToValueAtTime(850, when + duration * 0.5);
    filter.Q.value = 0.3;
    const gain = ctx.createGain();
    const level = 0.06 / Math.sqrt(midis.length);
    const attack = attackMs / 1000;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(level, when + attack);
    gain.gain.setValueAtTime(level, when + Math.max(attack, duration - 0.1));
    gain.gain.linearRampToValueAtTime(0.0001, when + duration + 0.25);
    filter.connect(gain);
    gain.connect(this.bus);
    gain.connect(this.reverbSend);

    for (const midi of midis) {
      for (const [type, detune] of [['sawtooth', -7], ['triangle', 7]] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midiToFreq(midi);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(when);
        osc.stop(when + duration + 0.3);
      }
    }
  }

  /**
   * Погребальный колокол: неровный спектр с «гулом» октавой ниже и минорной терцией в обертонах —
   * отсюда характерная мрачность. Высокие обертоны гаснут быстрее низких.
   */
  bell(when: number, midi: number, velocity = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const freq = midiToFreq(midi);
    const out = ctx.createGain();
    out.gain.value = 0.16 * velocity;
    out.connect(this.bus);
    const send = ctx.createGain();
    send.gain.value = 0.9;
    out.connect(send).connect(this.reverbSend);
    const partials: [ratio: number, level: number][] = [
      [0.5, 0.6], [1, 1], [1.19, 0.55], [1.5, 0.3], [2, 0.45], [2.67, 0.22], [3.01, 0.18], [4.17, 0.1],
    ];
    for (const [ratio, level] of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const decay = Math.min(5, 4 / ratio);
      osc.frequency.value = freq * ratio;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(level, when + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
      osc.connect(gain).connect(out);
      osc.start(when);
      osc.stop(when + decay + 0.05);
    }
    this.noiseBurst(when, 'bandpass', 2500, 0.08 * velocity, 0.03, this.bus, 2);
  }

  /**
   * Чистая гитара: мягкий щипок с лёгким хорусом, длинным затуханием, эхом и большим залом —
   * для психоделических арпеджио.
   */
  clean(when: number, midi: number, durationMs: number, velocity = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const duration = Math.max(0.3, durationMs / 1000);
    const freq = midiToFreq(midi);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(2600, when);
    tone.frequency.exponentialRampToValueAtTime(900, when + duration);
    tone.Q.value = 0.4;
    const gain = ctx.createGain();
    const level = 0.13 * velocity;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    for (const [type, detune, mix] of [['triangle', -5, 1], ['sawtooth', 6, 0.35], ['sine', 0, 0.5]] as const) {
      const osc = ctx.createOscillator();
      const partial = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      partial.gain.value = mix;
      osc.connect(partial).connect(tone);
      osc.start(when);
      osc.stop(when + duration + 0.1);
    }
    tone.connect(gain).connect(this.bus);
    const reverb = ctx.createGain();
    reverb.gain.value = 0.55;
    gain.connect(reverb).connect(this.reverbSend);
    const delay = ctx.createGain();
    delay.gain.value = 0.4;
    gain.connect(delay).connect(this.delaySend);
  }

  // --- ритм-гитара ---

  /**
   * Пауэр-аккорд (тоника, квинта, октава) через жёсткий перегруз и «кабинет».
   * muted — глушёный ладонью «чаг»: короткий, тёмный и плотный.
   */
  power(when: number, midi: number, fifth: number, durationMs: number, muted: boolean, velocity = 1, attackMs = 4): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const duration = Math.max(0.06, durationMs / 1000);
    const mix = ctx.createGain();
    mix.gain.value = 0.25;
    const oscillators: OscillatorNode[] = [];
    for (const interval of [0, fifth, 12]) {
      for (const detune of [-9, 9]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToFreq(midi + interval);
        osc.detune.value = detune;
        osc.connect(mix);
        oscillators.push(osc);
      }
    }
    const tight = ctx.createBiquadFilter();
    tight.type = 'highpass';
    tight.frequency.value = 70;
    const drive = ctx.createWaveShaper();
    drive.curve = softClipCurve(9);
    const cabinet = ctx.createBiquadFilter();
    cabinet.type = 'lowpass';
    cabinet.frequency.setValueAtTime(muted ? 1100 : 3600, when);
    if (muted) cabinet.frequency.exponentialRampToValueAtTime(500, when + duration);
    cabinet.Q.value = 0.8;
    const scoop = ctx.createBiquadFilter();
    scoop.type = 'peaking';
    scoop.frequency.value = 550;
    scoop.Q.value = 0.9;
    scoop.gain.value = -6;
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 180;
    low.gain.value = muted ? 5 : 2;

    const gain = ctx.createGain();
    const level = (muted ? 0.4 : 0.28) * velocity;
    const attack = attackMs / 1000;
    gain.gain.setValueAtTime(0.0001, when);
    if (attack > 0.05) {
      // нарастание из тишины — для вступления
      gain.gain.linearRampToValueAtTime(level * 0.75, when + attack);
      gain.gain.setValueAtTime(level * 0.75, when + Math.max(attack, duration - 0.06));
      gain.gain.exponentialRampToValueAtTime(0.0005, when + duration + 0.1);
    } else if (muted) {
      gain.gain.exponentialRampToValueAtTime(level, when + attack);
      gain.gain.exponentialRampToValueAtTime(0.0005, when + duration);
    } else {
      gain.gain.exponentialRampToValueAtTime(level, when + attack);
      gain.gain.exponentialRampToValueAtTime(level * 0.75, when + 0.25);
      gain.gain.setValueAtTime(level * 0.75, when + Math.max(0.25, duration - 0.06));
      gain.gain.exponentialRampToValueAtTime(0.0005, when + duration + 0.1);
    }
    mix.connect(tight).connect(drive).connect(scoop).connect(low).connect(cabinet).connect(gain).connect(this.bus);
    if (!muted) {
      const send = ctx.createGain();
      send.gain.value = 0.15;
      gain.connect(send).connect(this.reverbSend);
    }
    for (const osc of oscillators) {
      osc.start(when);
      osc.stop(when + duration + 0.15);
    }
  }

  // --- соло ---

  /**
   * fly — гитара мухи: мягкий перегруз, вибрато, дилей. rhythm — ритм-гитарист, тише и темнее.
   * player — человек в дуэли: колокольчик октавой выше, чтобы не спорить с гитарой.
   */
  /** @param bendTo нота, в которую соло-гитара подтягивает струну */
  lead(when: number, midi: number, durationMs: number, timbre: Timbre, harmony?: number, bendTo?: number): void {
    if (!this.ctx) return;
    const maxDuration = timbre === 'smooth' ? 4 : 1.6;
    const duration = Math.max(0.12, Math.min(maxDuration, durationMs / 1000));
    if (timbre === 'player') return this.glockenspiel(when, midi + 12);
    const level = timbre === 'rhythm' ? 0.15 : 0.3;
    const bend = bendTo === undefined ? 0 : bendTo - midi;
    this.guitarVoice(when, midi, duration, level, timbre, bend);
    // вторая гитара — через свой «усилитель», иначе общий перегруз даст грязные разностные тоны
    if (harmony !== undefined) this.guitarVoice(when, harmony, duration, level * 0.55, timbre, bend);
  }

  private guitarVoice(when: number, midi: number, duration: number, level: number, timbre: Timbre, bend = 0): void {
    const ctx = this.ctx!;
    const freq = midiToFreq(midi);
    const voices: OscillatorNode[] = [];
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    for (const detune of [-3, 3]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.setValueAtTime(detune - 10, when); // лёгкий щипок, без заметной фальши
      osc.detune.linearRampToValueAtTime(detune, when + 0.02);
      if (bend) {
        // подтяжка: струна плавно въезжает в нужную ноту и повисает там
        const rise = Math.min(duration * 0.55, 0.9);
        osc.detune.setValueAtTime(detune, when + duration * 0.12);
        osc.detune.linearRampToValueAtTime(detune + bend * 100 * 1.04, when + duration * 0.12 + rise);
        osc.detune.linearRampToValueAtTime(detune + bend * 100, when + duration * 0.12 + rise + 0.12);
      }
      osc.connect(mix);
      voices.push(osc);
    }
    // вибрато только на длинных нотах
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.5;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.setValueAtTime(0, when);
    if (duration > 0.4) {
      // после подтяжки вибрато вступает позже и глубже — нота «висит» и дышит
      const start = bend ? Math.min(duration * 0.7, 1.2) : 0.2;
      vibratoDepth.gain.setValueAtTime(0, when + start);
      vibratoDepth.gain.linearRampToValueAtTime(timbre === 'smooth' ? 16 : 9, when + Math.min(duration, start + 0.4));
    }
    vibrato.connect(vibratoDepth);
    for (const osc of voices) vibratoDepth.connect(osc.detune);

    const drive = ctx.createWaveShaper();
    drive.curve = softClipCurve(timbre === 'fly' ? 3 : timbre === 'smooth' ? 1.8 : 2.2);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = timbre === 'fly' ? 2400 : timbre === 'smooth' ? 3000 : 1600;
    tone.Q.value = 0.6;
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 800;
    body.gain.value = 3;

    const gain = ctx.createGain();
    const sustain = timbre === 'smooth' ? 0.9 : 0.75;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + (timbre === 'smooth' ? 0.03 : 0.008));
    gain.gain.exponentialRampToValueAtTime(level * sustain, when + 0.15);
    gain.gain.setValueAtTime(level * sustain, when + Math.max(0.15, duration - 0.05));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration + (timbre === 'smooth' ? 0.5 : 0.1));

    mix.connect(drive).connect(body).connect(tone).connect(gain);
    gain.connect(this.bus);
    const echo = ctx.createGain();
    echo.gain.value = timbre === 'smooth' ? 0.7 : 1;
    gain.connect(echo).connect(this.delaySend);
    const room = ctx.createGain();
    room.gain.value = timbre === 'smooth' ? 1.6 : 1;
    gain.connect(room).connect(this.reverbSend);
    for (const osc of [...voices, vibrato]) {
      osc.start(when);
      osc.stop(when + duration + (timbre === 'smooth' ? 0.6 : 0.15));
    }
  }

  /**
   * Ошибка: сорванный фальшивый аккорд на перегрузе (нота + малая секунда + тритон — диссонанс сразу звучит как «не то»),
   * который проваливается рычагом тремоло на тон вниз, плюс скрежет медиатора. Короткий — не успевает надоесть.
   */
  fumble(when: number, midi: number, velocity = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // держим в среднем регистре гитары: слишком низко — утонет в ритм-гитарах, слишком высоко — будет пищать
    let pitch = midi;
    while (pitch > 71) pitch -= 12;
    while (pitch < 59) pitch += 12;

    const mix = ctx.createGain();
    mix.gain.value = 0.3;
    const oscillators: OscillatorNode[] = [];
    for (const interval of [0, 1, 6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiToFreq(pitch + interval);
      osc.detune.setValueAtTime(0, when + 0.03);
      osc.detune.linearRampToValueAtTime(-200, when + 0.22); // провал рычагом
      osc.connect(mix);
      oscillators.push(osc);
    }
    const tight = ctx.createBiquadFilter();
    tight.type = 'highpass';
    tight.frequency.value = 250;
    const drive = ctx.createWaveShaper();
    drive.curve = softClipCurve(7);
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 1800;
    presence.Q.value = 1;
    presence.gain.value = 6;
    const cabinet = ctx.createBiquadFilter();
    cabinet.type = 'lowpass';
    cabinet.frequency.value = 4200;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.3 * velocity, when + 0.004);
    gain.gain.setValueAtTime(0.3 * velocity, when + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);
    mix.connect(tight).connect(drive).connect(presence).connect(cabinet).connect(gain).connect(this.bus);
    const send = ctx.createGain();
    send.gain.value = 0.15;
    gain.connect(send).connect(this.reverbSend);
    for (const osc of oscillators) {
      osc.start(when);
      osc.stop(when + 0.26);
    }

    // скрежет медиатора по обмотке струн
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const scrape = ctx.createBiquadFilter();
    scrape.type = 'bandpass';
    scrape.Q.value = 3;
    scrape.frequency.setValueAtTime(4200, when);
    scrape.frequency.exponentialRampToValueAtTime(1400, when + 0.09);
    const scrapeGain = ctx.createGain();
    scrapeGain.gain.setValueAtTime(0.0001, when);
    scrapeGain.gain.exponentialRampToValueAtTime(0.22 * velocity, when + 0.008);
    scrapeGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
    source.connect(scrape).connect(scrapeGain).connect(this.bus);
    source.start(when, Math.random() * 0.5);
    source.stop(when + 0.12);
  }




  crowd(kind: 'cheer' | 'boo'): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    if (kind === 'cheer') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, t);
      filter.frequency.linearRampToValueAtTime(1500, t + 0.8);
      filter.Q.value = 0.6;
    } else {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, t);
      filter.frequency.linearRampToValueAtTime(220, t + 1.4);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(kind === 'cheer' ? 0.22 : 0.3, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2);
    source.connect(filter).connect(gain).connect(this.bus);
    gain.connect(this.reverbSend);
    source.start(t);
    source.stop(t + 2.1);
  }

  private glockenspiel(when: number, midi: number): void {
    const ctx = this.ctx!;
    const freq = midiToFreq(midi);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.06, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.6);
    for (const [ratio, level] of [[1, 1], [3, 0.25], [5.4, 0.08]] as const) {
      const osc = ctx.createOscillator();
      const partial = ctx.createGain();
      osc.frequency.value = freq * ratio;
      partial.gain.value = level;
      osc.connect(partial).connect(gain);
      osc.start(when);
      osc.stop(when + 0.65);
    }
    gain.connect(this.bus);
    gain.connect(this.reverbSend);
  }

  private tone(when: number, freq: number, volume: number, duration: number, type: OscillatorType): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain).connect(this.drums);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  private noiseBurst(
    when: number,
    type: BiquadFilterType,
    freq: number,
    volume: number,
    duration: number,
    destination: AudioNode,
    q = 0.7,
    reverb = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0005, when + duration);
    source.connect(filter).connect(gain).connect(destination);
    if (reverb) {
      const send = ctx.createGain();
      send.gain.value = reverb;
      gain.connect(send).connect(this.reverbSend);
    }
    source.start(when, Math.random() * 0.5);
    source.stop(when + duration + 0.02);
  }

}

const curves = new Map<number, Float32Array<ArrayBuffer>>();

function softClipCurve(amount: number): Float32Array<ArrayBuffer> {
  let curve = curves.get(amount);
  if (!curve) {
    curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    curves.set(amount, curve);
  }
  return curve;
}
