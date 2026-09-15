import type { GroupRole } from './brain';

/** Сообщения главный поток → воркер мозга. */
export type ToWorker =
  | { type: 'init'; dataUrl: string; seed?: number }
  /** Частота пуассоновского входа на все нейроны группы, Гц (0 — выключить). */
  | { type: 'input'; group: string; rateHz: number }
  /** Скорость симуляции относительно реального времени: 1 — реальное время, 0.25 — слоу-мо. */
  | { type: 'speed'; value: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' };

export interface GroupInfo {
  role: GroupRole;
  label: string;
  size: number;
}

export interface BrainFrame {
  type: 'frame';
  /** Время внутри симуляции, мс. */
  timeMs: number;
  /** Сколько мс симуляции прошло за мс реального времени (сглажено). Меньше заданной скорости — не успеваем. */
  realtimeFactor: number;
  /** Сглаженная средняя частота спайков на нейрон группы, Гц. */
  rates: Record<string, number>;
  /** Индексы (в полном мозге) нейронов, спайковавших с прошлого кадра. */
  active: Uint32Array;
}

/** Сообщения воркер мозга → главный поток. */
export type FromWorker =
  | { type: 'ready'; neurons: number; edges: number; groups: Record<string, GroupInfo> }
  | BrainFrame
  | { type: 'error'; message: string };
