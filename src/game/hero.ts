/**
 * Fly Hero: логика игры без отрисовки и звука.
 *
 * Четыре лада — четыре нейронных канала:
 *   0 ◀ нота надвигается на левый глаз (looming_L)  → мозг поворачивает вправо (turn_R)
 *   1 ▶ нота надвигается на правый глаз (looming_R) → поворот влево (turn_L)
 *   2 🍬 сладкая нота под лапкой (sugar_L)          → хоботок (feed, MN9)
 *   3 ⚡ нота летит в оба глаза                      → giant fiber без поворота (takeoff)
 *
 * Мозгу нужно время, чтобы разогнаться, поэтому стимул начинается заранее — как калибровка задержки в Guitar Hero.
 */

import { buildChart, songLengthMs, type Lane, type Note, type Song } from './songs';

export const HIT_WINDOW_MS = 140;
export const PERFECT_MS = 45;

export interface LaneSpec {
  icon: string;
  name: string;
  input: string;
  output: string;
  color: string;
  /** За сколько мс до ноты стимул начинает нарастать. */
  leadMs: number;
  /** За сколько мс стимул дорастает до максимума. */
  rampMs: number;
}

export const LANES: LaneSpec[] = [
  { icon: '◀', name: 'Левый глаз', input: 'LPLC2 слева', output: 'поворот →', color: '#3fd37a', leadMs: 180, rampMs: 220 },
  { icon: '▶', name: 'Правый глаз', input: 'LPLC2 справа', output: 'поворот ←', color: '#ff4f5e', leadMs: 185, rampMs: 220 },
  { icon: '🍬', name: 'Сахар', input: 'сладкие рецепторы', output: 'хоботок MN9', color: '#ffd23f', leadMs: 90, rampMs: 120 },
  { icon: '⚡', name: 'Рок-прыжок', input: 'LPLC2 оба глаза', output: 'giant fiber', color: '#4fa3ff', leadMs: 155, rampMs: 220 },
];

/** Пороги каналов, Гц: нажатие по фронту on, отпускание ниже off. */
export const CHANNEL = {
  turn: { on: 15, off: 6 },
  feed: { on: 25, off: 10 },
  jump: { on: 60, off: 25, maxTurn: 12, holdMs: 56 },
};

export type NoteState = 'pending' | 'hit' | 'missed';

export interface ChartNote extends Note {
  state: NoteState;
  offsetMs?: number;
}

export type HeroEvent =
  | { type: 'hit'; lane: Lane; offsetMs: number; perfect: boolean; combo: number; note: ChartNote }
  | { type: 'miss'; lane: Lane; note: ChartNote }
  | { type: 'extra'; lane: Lane }
  | { type: 'fail' }
  | { type: 'end' };

export class HeroGame {
  readonly notes: ChartNote[];
  readonly lengthMs: number;
  timeMs = -1500;
  score = 0;
  combo = 0;
  maxCombo = 0;
  /** Рок-метр 0..100: ноль — муху освистали. */
  meter = 60;
  hits = 0;
  misses = 0;
  extras = 0;
  perfects = 0;
  offsets: number[][] = [[], [], [], []];
  finished: 'end' | 'fail' | null = null;
  /** Рок-метр хоть раз падал до нуля — зал освистал. */
  booed = false;
  events: HeroEvent[] = [];
  /** Когда канал последний раз «нажался» — для анимации. */
  readonly pressedAt = [-Infinity, -Infinity, -Infinity, -Infinity];
  readonly channelOn = [false, false, false, false];
  private jumpCandidateMs = 0;
  private nextMissIndex = 0;

  constructor(readonly song: Song) {
    this.notes = buildChart(song).map((note) => ({ ...note, state: 'pending' }));
    this.lengthMs = songLengthMs(song);
  }

  get accuracy(): number {
    const judged = this.hits + this.misses;
    return judged ? this.hits / judged : 1;
  }

  get multiplier(): number {
    return 1 + Math.min(3, Math.floor(this.combo / 8));
  }

  /**
   * @param rates частоты нейронов мозга; null — играет человек, нажатия приходят через press()
   * @param canFail в дуэли песня не обрывается, даже если рок-метр упал до нуля
   */
  step(dtMs: number, rates: Record<string, number> | null, canFail = true): void {
    if (dtMs <= 0 || this.finished) return;
    this.timeMs += dtMs;
    if (rates) this.detectPresses(dtMs, rates);

    // пропущенные ноты
    for (let i = this.nextMissIndex; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.timeMs + HIT_WINDOW_MS > this.timeMs) break;
      if (note.state === 'pending') {
        note.state = 'missed';
        this.misses++;
        this.combo = 0;
        this.meter = Math.max(0, this.meter - 8);
        this.events.push({ type: 'miss', lane: note.lane, note });
      }
      this.nextMissIndex = i + 1;
    }

    if (this.meter <= 0 && !this.booed) {
      this.booed = true;
      this.events.push({ type: 'fail' });
    }
    if (this.meter <= 0 && canFail) {
      this.finished = 'fail';
    } else if (this.timeMs >= this.lengthMs) {
      this.finished = 'end';
      this.events.push({ type: 'end' });
    }
  }

  /** Частоты стимулов, Гц. */
  senses(): Record<'looming_L' | 'looming_R' | 'sugar_L', number> {
    const level = [0, 0, 0, 0];
    for (let i = this.nextMissIndex; i < this.notes.length; i++) {
      const note = this.notes[i];
      const until = note.timeMs - this.timeMs;
      if (until > 600) break;
      if (note.state !== 'pending') continue; // пойманная нота больше не пугает
      const lane = LANES[note.lane];
      const progress = (lane.leadMs - until) / lane.rampMs;
      if (progress <= 0) continue;
      level[note.lane] = Math.max(level[note.lane], Math.min(1, progress) ** 2);
    }
    return {
      looming_L: 220 * Math.max(level[0], level[3]),
      looming_R: 220 * Math.max(level[1], level[3]),
      sugar_L: 150 * Math.min(1, level[2] * 1.5),
    };
  }

  private detectPresses(dtMs: number, rates: Record<string, number>): void {
    const turnL = rates.turn_L ?? 0;
    const turnR = rates.turn_R ?? 0;
    const feed = rates.feed ?? 0;
    const takeoff = rates.takeoff ?? 0;

    this.updateChannel(0, turnR - turnL > CHANNEL.turn.on, turnR - turnL < CHANNEL.turn.off);
    this.updateChannel(1, turnL - turnR > CHANNEL.turn.on, turnL - turnR < CHANNEL.turn.off);
    this.updateChannel(2, feed > CHANNEL.feed.on, feed < CHANNEL.feed.off);

    // прыжок — giant fiber без поворота, и держится хотя бы пару кадров
    const symmetric = takeoff > CHANNEL.jump.on && Math.max(turnL, turnR) < CHANNEL.jump.maxTurn;
    this.jumpCandidateMs = symmetric ? this.jumpCandidateMs + dtMs : 0;
    this.updateChannel(3, this.jumpCandidateMs >= CHANNEL.jump.holdMs, takeoff < CHANNEL.jump.off);
  }

  private updateChannel(lane: Lane, on: boolean, off: boolean): void {
    if (!this.channelOn[lane] && on) {
      this.channelOn[lane] = true;
      this.press(lane);
    } else if (this.channelOn[lane] && off) {
      this.channelOn[lane] = false;
    }
  }

  press(lane: Lane): void {
    if (this.finished) return;
    this.pressedAt[lane] = this.timeMs;
    let best: ChartNote | undefined;
    for (let i = this.nextMissIndex; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.timeMs - HIT_WINDOW_MS > this.timeMs) break;
      if (note.lane !== lane || note.state !== 'pending') continue;
      if (!best || Math.abs(note.timeMs - this.timeMs) < Math.abs(best.timeMs - this.timeMs)) best = note;
    }
    if (!best) {
      this.extras++;
      this.combo = 0; // дёрнулась не туда — как неверный удар по струнам
      this.meter = Math.max(0, this.meter - 3);
      this.events.push({ type: 'extra', lane });
      return;
    }
    const offsetMs = this.timeMs - best.timeMs;
    const perfect = Math.abs(offsetMs) <= PERFECT_MS;
    best.state = 'hit';
    best.offsetMs = offsetMs;
    this.hits++;
    if (perfect) this.perfects++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += (50 + (perfect ? 25 : 0)) * this.multiplier;
    this.meter = Math.min(100, this.meter + 4);
    this.offsets[lane].push(offsetMs);
    this.events.push({ type: 'hit', lane, offsetMs, perfect, combo: this.combo, note: best });
  }
}
