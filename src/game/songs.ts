/**
 * Песни: мелодия, гармония и грув. Мелодии оригинальные, названия — нет.
 *
 * Мелодия записана по тактам 4/4 в восьмых: «E4/2» — ми первой октавы длиной две восьмых, «E4/0.5» — шестнадцатая,
 * «-/2» — пауза, «D5~F5/6» — подтяжка струны: нота начинается с ре и плавно въезжает в фа. Песня пишется в удобной тональности и опускается на `transpose` полутонов — так строй ниже.
 * Ноты для мухи выводятся из мелодии, как в Guitar Hero: мелодия идёт вверх — лад сдвигается вправо.
 * Ноты, которые мозгу мухи физически не успеть (слишком плотно), играет «ритм-гитарист». Мелодия звучит всегда,
 * даже если муха промахнулась, — промахи видны в очках и комбо, но не рвут музыку.
 */

export type Lane = 0 | 1 | 2 | 3;
export type Groove = 'doom' | 'gallop' | 'thrash' | 'blast' | 'breakdown' | 'psych';

export interface Note extends MelodyNote {
  lane: Lane;
}

export interface MelodyNote {
  timeMs: number;
  midi: number;
  durationMs: number;
  /** Подтяжка: до какой ноты гитарист дотягивает струну. */
  bendTo?: number;
  /** Вторая гитара: нота аккорда на терцию–кварту ниже мелодии. */
  harmony: number;
}

export type DrumKind = 'kick' | 'snare' | 'hat' | 'ride' | 'crash' | 'stick' | 'tomHigh' | 'tomMid' | 'tomLow';

export type BackingEvent =
  | { timeMs: number; kind: DrumKind; velocity: number }
  /** attackMs — плавное нарастание, для вступления. */
  | { timeMs: number; kind: 'bass'; midi: number; durationMs: number; attackMs?: number }
  | { timeMs: number; kind: 'chord'; midis: number[]; durationMs: number; attackMs?: number }
  /** «Обратная» тарелка: нарастающий шум, который вливается в первый такт. */
  | { timeMs: number; kind: 'swell'; durationMs: number; velocity: number }
  /** Ритм-гитара с дисторшном: пауэр-аккорд, открытый или глушёный ладонью. */
  | { timeMs: number; kind: 'power'; midi: number; fifth: number; durationMs: number; muted: boolean; velocity: number; attackMs?: number }
  /** Чистая гитара: арпеджио по аккорду, с эхом и залом. */
  | { timeMs: number; kind: 'clean'; midi: number; durationMs: number; velocity: number; pan?: number }
  /** Погребальный колокол. */
  | { timeMs: number; kind: 'bell'; midi: number; velocity: number }
  /** Нота мелодии. Звучит всегда, попала муха или нет, — так музыка не рвётся; fly — нота из грифа мухи. */
  | { timeMs: number; kind: 'lead'; midi: number; harmony: number; durationMs: number; fly: boolean; bendTo?: number; smooth?: boolean };

export interface Song {
  id: string;
  title: string;
  artist: string;
  difficulty: string;
  blurb: string;
  bpm: number;
  key: string;
  /** Сдвиг вниз/вверх в полутонах относительно записи. */
  transpose: number;
  groove: Groove;
  /** Мягкий певучий тембр соло вместо металлического. */
  smoothLead?: boolean;
  /** Части с другим грувом: такты с 1, включительно. */
  sections?: { from: number; to: number; groove: Groove }[];
  /** Динамика аранжировки: в этих тактах инструменты молчат, чтобы следующая часть звучала шире. */
  arrangement?: { from: number; to: number; drop: ('chord' | 'bass' | 'power' | 'drums')[] }[];
  /** Аккорд на такт, такты через «|». */
  chords: string;
  melody: string;
  /** Ограничения нот для мухи: минимум между нотами и между нотами на одном ладу, мс. */
  chart: { minGapMs: number; minSameLaneMs: number };
}

const EIGHTHS_PER_BAR = 8;

export const SONGS: Song[] = [
  {
    id: 'vinegar',
    title: 'Smoke on the Vinegar',
    artist: 'Deep Pupa',
    difficulty: 'Лёгкий',
    blurb: 'Похоронный дум в си миноре: тема, брейкдаун, соло, второй куплет, бридж и соло-кульминация. Почти два с половиной часа по меркам мухи.',
    bpm: 84,
    key: 'B harmonic minor',
    transpose: -5,
    groove: 'doom',
    sections: [{ from: 17, to: 20, groove: 'breakdown' }],
    arrangement: [{ from: 1, to: 8, drop: ['chord'] }, { from: 17, to: 20, drop: ['chord'] }, { from: 29, to: 32, drop: ['chord'] }],
    chords:
      'Em | C | Am | B | Em | C | B | B | ' +
      'Am | Em | C | B | Am | C | B | Em | ' +
      'Em | F | Em | F | Am | B | Em | C | ' +
      'Am | B | C | B | Em | C | Am | B | ' +
      'Em | C | B | Em | Am | F | C | B | ' +
      'Am | B | Em | C | Am | B | F | B | ' +
      'Em',
    melody:
      // хук: короткая фраза с синкопой, повторяется и идёт секвенцией; с 9-го такта — припев
      'B4/1 D5/1 E5/3 -/1 D5/2 | C5/1 B4/1 G4/3 -/1 B4/2 | ' +
      'A4/1 C5/1 E5/3 -/1 C5/2 | B4/2 D#5/2 F#5/3 -/1 | ' +
      'B4/1 D5/1 E5/3 -/1 D5/2 | C5/1 B4/1 G4/3 -/1 B4/2 | ' +
      'D#5/1 F#5/1 B5/3 -/1 F#5/2 | F#5/2 D#5/2 B4/4 | ' +
      'E5/2 A5/4 G5/2 | B5/2 E5/4 G5/2 | ' +
      'C6/2 B5/2 G5/4 | F#5/4 D#5/4 | ' +
      'E5/2 A5/4 G5/2 | E5/2 G5/4 E5/2 | ' +
      'D#5/2 F#5/2 B5/4 | B4/4 E5/4 | ' +
      // брейкдаун
      'B4/8 | C5/8 | ' +
      'B4/4 G4/4 | A4/4 F4/4 | ' +
      // соло: гаммовые фразы секвенцией вверх и разрешение в тонику
      'E5/1 D5/1 C5/1 B4/1 C5/2 A4/2 | F#5/1 E5/1 D#5/1 C5/1 D#5/2 B4/2 | ' +
      'G5/1 F#5/1 E5/1 D#5/1 E5/2 B4/2 | G5/1 A5/1 G5/1 E5/1 C5/4 | ' +
      'A5/0.5 G5/0.5 F#5/0.5 E5/0.5 C5/1 E5/1 A5/2 E5/2 | B5/0.5 A5/0.5 G5/0.5 F#5/0.5 D#5/1 F#5/1 B5/2 F#5/2 | ' +
      'C6/0.5 B5/0.5 A5/0.5 G5/0.5 E5/1 G5/1 C6/2 G5/2 | B5/2 A5/1 G5/1 F#5/2 D#5/2 | ' +
      // второй куплет: тот же хук октавой выше
      'B5/1 D6/1 E6/3 -/1 D6/2 | C6/1 B5/1 G5/3 -/1 B5/2 | ' +
      'A5/1 C6/1 E6/3 -/1 C6/2 | B5/2 D#6/2 F#6/3 -/1 | ' +
      'E5/2 G5/2 B5/4 | C6/4 G5/2 E5/2 | ' +
      'F#5/2 D#5/2 B4/4 | E5/8 | ' +
      // бридж
      'A4/4 C5/2 E5/2 | F5/4 E5/2 C5/2 | ' +
      'G5/4 E5/2 C5/2 | F#5/2 D#5/2 B4/4 | ' +
      // соло-кульминация и финал
      'A5/0.5 B5/0.5 C6/1 B5/1 A5/1 E5/2 A5/2 | B5/0.5 C6/0.5 D#6/1 C6/1 B5/1 F#5/2 B5/2 | ' +
      'E6/1 B5/1 G5/1 E5/1 G5/2 B5/2 | C6/1 B5/1 G5/1 E5/1 G5/2 C6/2 | ' +
      'E5/0.5 F#5/0.5 G5/0.5 A5/0.5 C6/1 A5/1 E5/2 C5/2 | F#5/0.5 G5/0.5 A5/0.5 B5/0.5 D#6/1 B5/1 F#5/2 D#5/2 | ' +
      'F5/1 A5/1 C6/1 A5/1 F5/2 C5/2 | B5/2 A5/1 F#5/1 D#5/2 F#5/2 | ' +
      'E5/8',
    chart: { minGapMs: 170, minSameLaneMs: 400 },
  },
  {
    id: 'highway',
    title: 'Highway to Банан',
    artist: 'AC/DNa',
    difficulty: 'Средний',
    blurb: 'Галоп в ре миноре со вторым куплетом, бриджем, двумя брейкдаунами и двумя соло. Бананы на этом шоссе не выживают.',
    bpm: 120,
    key: 'D harmonic minor',
    transpose: -7,
    groove: 'gallop',
    sections: [{ from: 17, to: 20, groove: 'breakdown' }, { from: 41, to: 44, groove: 'breakdown' }],
    arrangement: [{ from: 1, to: 8, drop: ['chord'] }, { from: 17, to: 20, drop: ['chord'] }, { from: 29, to: 32, drop: ['chord'] }],
    chords:
      'Am | F | G | E | Am | F | Dm | E | ' +
      'F | G | Am | Dm | F | E | E7 | Am | ' +
      'Am | Bb | Am | Bb | Dm | E | Am | F | ' +
      'Dm | E | F | E7 | Am | F | G | E | ' +
      'Am | F | E | Am | Dm | Am | Bb | E | ' +
      'Am | Bb | Am | E | Dm | E | Am | F | ' +
      'G | E | Am | E7 | Am',
    melody:
      // хук: галопирующая фраза с паузой-синкопой, секвенция по аккордам; с 9-го такта — припев
      'A4/1 A4/1 C5/1 E5/3 -/1 C5/1 | F4/1 F4/1 A4/1 C5/3 -/1 A4/1 | ' +
      'G4/1 G4/1 B4/1 D5/3 -/1 B4/1 | E5/2 D5/1 B4/1 G#4/4 | ' +
      'A4/1 A4/1 C5/1 E5/3 -/1 C5/1 | F4/1 F4/1 A4/1 C5/3 -/1 A4/1 | ' +
      'D5/1 D5/1 F5/1 A5/3 -/1 F5/1 | E5/4 G#4/2 B4/2 | ' +
      'C5/2 A5/4 G5/2 | B4/2 G5/4 F5/2 | ' +
      'C5/2 A5/4 E5/2 | D5/2 F5/4 E5/2 | ' +
      'C5/2 A5/4 G5/2 | B4/2 G#5/4 E5/2 | ' +
      'D5/2 B4/2 G#4/4 | A4/8 | ' +
      // брейкдаун
      'E5/8 | F5/8 | ' +
      'E5/4 C5/4 | D5/4 F5/4 | ' +
      // соло
      'D5/0.5 E5/0.5 F5/1 E5/1 D5/1 A4/2 D5/2 | E5/0.5 F5/0.5 G#5/1 F5/1 E5/1 B4/2 E5/2 | ' +
      'A5/1 G#5/1 A5/1 B5/1 C6/2 A5/2 | C6/1 B5/1 A5/1 G5/1 F5/2 C5/2 | ' +
      'F5/0.5 E5/0.5 D5/1 A5/1 F5/1 D5/2 F5/2 | G#5/0.5 F5/0.5 E5/1 B5/1 G#5/1 E5/2 G#5/2 | ' +
      'A5/1 C6/1 B5/1 A5/1 G#5/1 A5/1 C6/2 | B5/2 G#5/2 E5/2 D5/2 | ' +
      // второй куплет: тот же хук октавой выше
      'A5/1 A5/1 C6/1 E6/3 -/1 C6/1 | F5/1 F5/1 A5/1 C6/3 -/1 A5/1 | ' +
      'G5/1 G5/1 B5/1 D6/3 -/1 B5/1 | E6/2 D6/1 B5/1 G#5/4 | ' +
      'C6/2 A5/4 E5/2 | A5/2 F5/4 C5/2 | ' +
      'G#5/2 E5/4 B4/2 | A4/8 | ' +
      // бридж
      'D5/4 F5/2 A5/2 | C6/4 A5/2 E5/2 | ' +
      'Bb5/4 F5/2 D5/2 | B5/2 G#5/2 E5/4 | ' +
      // второй брейкдаун
      'A4/8 | Bb4/8 | ' +
      'A4/4 E5/4 | G#4/4 B4/4 | ' +
      // соло-кульминация и финал
      'D5/0.5 E5/0.5 F5/1 A5/1 D6/1 A5/2 F5/2 | E5/0.5 F5/0.5 G#5/1 B5/1 E6/1 B5/2 G#5/2 | ' +
      'A5/1 C6/1 E6/1 C6/1 A5/2 E5/2 | F5/1 A5/1 C6/1 A5/1 F5/2 C5/2 | ' +
      'G5/0.5 A5/0.5 B5/1 D6/1 B5/1 G5/2 D5/2 | G#5/0.5 A5/0.5 B5/1 E6/1 B5/1 G#5/2 E5/2 | ' +
      'A5/1 G5/1 F5/1 E5/1 D5/1 C5/1 B4/1 A4/1 | B4/2 D5/2 G#5/2 B5/2 | ' +
      'A5/8',
    chart: { minGapMs: 120, minSameLaneMs: 220 },
  },
  {
    id: 'geosmin',
    title: 'Smells Like Geosmin',
    artist: 'Нервана',
    difficulty: 'Сложный',
    blurb: 'Трэш в до-диез фригийском: тема, брейкдаун, соло, второй куплет и соло-кульминация на 170 BPM.',
    bpm: 170,
    key: 'C# phrygian',
    transpose: -4,
    groove: 'thrash',
    sections: [{ from: 18, to: 21, groove: 'breakdown' }, { from: 38, to: 41, groove: 'breakdown' }],
    arrangement: [{ from: 1, to: 8, drop: ['chord'] }, { from: 18, to: 21, drop: ['chord'] }, { from: 30, to: 33, drop: ['chord'] }],
    chords:
      'Fm | Gb | Fm | Eb | Db | C | Fm | C7 | ' +
      'Fm | Gb | Ebm | Db | Bbm | C | Db | C7 | ' +
      'Fm | Fm | Gb | Fm | Gb | Fm | Db | Eb | ' +
      'C | Fm | Gb | Db | C7 | Fm | Db | Eb | ' +
      'Fm | Fm | Db | C | C7 | Fm | Gb | Fm | ' +
      'C | Fm | Db | Ebm | Gb | Fm | C | Db | ' +
      'C7 | Fm',
    melody:
      // хук: рубленая фраза с паузой на сильную долю; с 9-го такта — припев
      'F4/1 F4/1 Ab4/1 C5/2 -/1 Ab4/2 | Gb4/1 Gb4/1 Bb4/1 Db5/2 -/1 Bb4/2 | ' +
      'F4/1 F4/1 Ab4/1 C5/2 -/1 Eb5/2 | Eb5/2 Bb4/2 G4/4 | ' +
      'Db5/1 Db5/1 F5/1 Ab5/2 -/1 F5/2 | C5/1 C5/1 E5/1 G5/2 -/1 E5/2 | ' +
      'Ab5/2 F5/2 C5/4 | Bb4/2 E5/2 G5/4 | ' +
      'C5/2 F5/4 Ab5/2 | Db5/2 Gb5/4 Bb5/2 | ' +
      'Bb4/2 Eb5/4 Gb5/2 | Ab4/2 Db5/4 F5/2 | ' +
      'F5/2 Bb5/4 Db6/2 | G5/2 C6/4 E5/2 | ' +
      'Ab5/2 F5/2 Db5/4 | G5/2 E5/2 C5/4 | ' +
      'F5/8 | ' +
      // брейкдаун
      'C5/8 | Db5/8 | ' +
      'C5/4 Ab4/4 | Bb4/4 Db5/4 | ' +
      // соло
      'F5/0.5 G5/0.5 Ab5/1 G5/1 F5/1 C5/2 F5/2 | Db5/0.5 Eb5/0.5 F5/1 Eb5/1 Db5/1 Ab4/2 Db5/2 | ' +
      'Eb5/0.5 F5/0.5 G5/1 F5/1 Eb5/1 Bb4/2 Eb5/2 | E5/1 F5/1 G5/1 Bb5/1 C6/2 G5/2 | ' +
      'Ab5/0.5 G5/0.5 F5/1 C6/1 Ab5/1 F5/2 Ab5/2 | Bb5/0.5 Ab5/0.5 Gb5/1 Db6/1 Bb5/1 Gb5/2 Bb5/2 | ' +
      'Ab5/1 G5/1 F5/1 Eb5/1 Db5/2 F5/2 | G5/1 E5/1 C5/1 E5/1 G5/2 Bb5/2 | ' +
      // второй куплет: возвращение хука
      'F5/1 F5/1 Ab5/1 C6/2 -/1 Ab5/2 | Db5/1 Db5/1 F5/1 Ab5/2 -/1 F5/2 | ' +
      'Eb5/1 Eb5/1 G5/1 Bb5/2 -/1 G5/2 | C6/2 Ab5/2 F5/4 | ' +
      'F5/1 F5/1 Ab5/1 C6/2 -/1 Ab5/2 | Ab5/2 F5/2 Db5/4 | ' +
      'G5/2 E5/2 C5/4 | Bb5/2 G5/2 E5/4 | ' +
      // второй брейкдаун
      'F4/8 | Gb4/8 | ' +
      'F4/4 C5/4 | E4/4 G4/4 | ' +
      // соло-кульминация и финал
      'F5/0.5 G5/0.5 Ab5/0.5 Bb5/0.5 C6/1 Ab5/1 F5/2 C5/2 | Db6/0.5 C6/0.5 Bb5/0.5 Ab5/0.5 F5/1 Ab5/1 Db6/2 Ab5/2 | ' +
      'Eb5/0.5 F5/0.5 Gb5/0.5 Ab5/0.5 Bb5/1 Gb5/1 Eb5/2 Bb4/2 | Gb5/1 Bb5/1 Db6/1 Bb5/1 Gb5/2 Db5/2 | ' +
      'Ab5/0.5 G5/0.5 F5/0.5 Eb5/0.5 C5/1 F5/1 Ab5/2 C6/2 | C6/1 Bb5/1 G5/1 E5/1 C5/2 G5/2 | ' +
      'Db6/1 Ab5/1 F5/1 Db5/1 Ab4/2 F5/2 | G5/0.5 Bb5/0.5 C6/1 Bb5/1 G5/1 E5/1 C5/1 G4/2 | ' +
      'F5/8',
    chart: { minGapMs: 90, minSameLaneMs: 170 },
  },
  {
    id: 'pear',
    title: "Livin' on a Pear",
    artist: 'Bon Juicy',
    difficulty: 'Эксперт (для людей)',
    blurb: 'Блэк-арпеджио в до-диез миноре на 220 BPM, брейкдаун и быстрый соляк шестнадцатыми — 15 нот в секунду. Giant fiber старается как может.',
    bpm: 220,
    key: 'C# harmonic minor',
    transpose: -3,
    groove: 'blast',
    sections: [{ from: 17, to: 20, groove: 'breakdown' }],
    arrangement: [{ from: 1, to: 8, drop: ['chord'] }],
    chords:
      'Em | F | G | F | Em | C | Am | B | ' +
      'Em | F | D#dim7 | B7 | Em | C | B7 | Em | ' +
      'Em | F | Em | F | Em | Em | Am | Am | ' +
      'B | B | Em | C | Am | B | Em | B7 | ' +
      'Em',
    melody:
      // тема: арпеджио
      'E4/1 G4/1 B4/1 E5/1 B4/1 G4/1 E4/1 G4/1 | F4/1 A4/1 C5/1 F5/1 C5/1 A4/1 F4/1 A4/1 | ' +
      'G4/1 B4/1 D5/1 G5/1 D5/1 B4/1 G4/1 B4/1 | A4/1 C5/1 F5/1 A5/1 F5/1 C5/1 A4/1 C5/1 | ' +
      'E5/1 B4/1 G4/1 B4/1 E5/1 G5/1 E5/1 B4/1 | E5/1 C5/1 G4/1 C5/1 E5/1 G5/1 E5/1 C5/1 | ' +
      'C5/1 A4/1 E4/1 A4/1 C5/1 E5/1 C5/1 A4/1 | D#5/1 B4/1 F#4/1 B4/1 D#5/1 F#5/1 B5/1 F#5/1 | ' +
      'G5/1 E5/1 B4/1 E5/1 G5/1 B5/1 G5/1 E5/1 | A5/1 F5/1 C5/1 F5/1 A5/1 C6/1 A5/1 F5/1 | ' +
      'D#5/1 F#5/1 A5/1 C6/1 A5/1 F#5/1 D#5/1 F#5/1 | B4/1 D#5/1 F#5/1 A5/1 F#5/1 D#5/1 B4/1 A4/1 | ' +
      'B4/1 E5/1 G5/1 B5/1 G5/1 E5/1 B4/1 E5/1 | C5/1 E5/1 G5/1 C6/1 G5/1 E5/1 C5/1 E5/1 | ' +
      'A5/1 F#5/1 D#5/1 B4/1 D#5/1 F#5/1 A5/1 B5/1 | E5/8 | ' +
      // брейкдаун
      'B4/8 | C5/8 | ' +
      'B4/4 G4/4 | A4/4 F4/4 | ' +
      // соляк: шестнадцатые, гаммы и свипы
      'E5/0.5 F#5/0.5 G5/0.5 A5/0.5 B5/0.5 C6/0.5 B5/0.5 A5/0.5 G5/0.5 F#5/0.5 E5/0.5 F#5/0.5 G5/0.5 A5/0.5 B5/0.5 C6/0.5 | E5/0.5 F#5/0.5 G5/0.5 A5/0.5 B5/0.5 C6/0.5 D#6/0.5 E6/0.5 D#6/0.5 C6/0.5 B5/0.5 A5/0.5 G5/0.5 F#5/0.5 E5/0.5 D#5/0.5 | ' +
      'A4/0.5 B4/0.5 C5/0.5 D5/0.5 E5/0.5 F5/0.5 G5/0.5 A5/0.5 G5/0.5 F5/0.5 E5/0.5 D5/0.5 C5/0.5 B4/0.5 A4/0.5 G4/0.5 | C5/0.5 D5/0.5 E5/0.5 F5/0.5 E5/0.5 D5/0.5 C5/0.5 B4/0.5 A4/0.5 B4/0.5 C5/0.5 D5/0.5 E5/0.5 F5/0.5 G5/0.5 A5/0.5 | ' +
      'B4/0.5 C5/0.5 D#5/0.5 E5/0.5 F#5/0.5 G5/0.5 F#5/0.5 E5/0.5 D#5/0.5 E5/0.5 F#5/0.5 G5/0.5 A5/0.5 B5/0.5 A5/0.5 G5/0.5 | F#5/0.5 G5/0.5 A5/0.5 B5/0.5 C6/0.5 B5/0.5 A5/0.5 G5/0.5 F#5/0.5 E5/0.5 D#5/0.5 C5/0.5 B4/0.5 A4/0.5 G4/0.5 F#4/0.5 | ' +
      'E5/0.5 G5/0.5 B5/0.5 E6/0.5 B5/0.5 G5/0.5 B5/0.5 E6/0.5 B5/0.5 G5/0.5 E5/0.5 B4/0.5 G4/0.5 E4/0.5 G4/0.5 B4/0.5 | C5/0.5 E5/0.5 G5/0.5 C6/0.5 G5/0.5 E5/0.5 C5/0.5 E5/0.5 G5/0.5 C6/0.5 E6/0.5 C6/0.5 G5/0.5 E5/0.5 C5/0.5 G4/0.5 | ' +
      'A4/0.5 C5/0.5 E5/0.5 A5/0.5 E5/0.5 C5/0.5 A4/0.5 C5/0.5 E5/0.5 A5/0.5 C6/0.5 A5/0.5 E5/0.5 C5/0.5 A4/0.5 E4/0.5 | B4/0.5 D#5/0.5 F#5/0.5 B5/0.5 F#5/0.5 D#5/0.5 B4/0.5 D#5/0.5 F#5/0.5 B5/0.5 D#6/0.5 B5/0.5 F#5/0.5 D#5/0.5 B4/0.5 F#4/0.5 | ' +
      'E5/1 F#5/1 G5/1 A5/1 B5/1 C6/1 D#6/1 E6/1 | D#6/1 B5/1 A5/1 F#5/1 D#5/1 B4/1 A4/1 F#4/1 | ' +
      'E5/8',
    chart: { minGapMs: 100, minSameLaneMs: 220 },
  },
  {
    id: 'floyd',
    title: 'Shine On You Crazy Drosophila',
    artist: 'Pink Fly',
    difficulty: 'Медитативный',
    blurb: 'Психоделический прог в ре миноре на три минуты: чистые арпеджио, орган, редкие барабаны и тягучее соло. Мухи в зале сидят на полу и смотрят вверх.',
    bpm: 63,
    key: 'D minor',
    transpose: 0,
    groove: 'psych',
    smoothLead: true,
    arrangement: [{ from: 1, to: 4, drop: ['drums'] }, { from: 29, to: 30, drop: ['drums', 'bass'] }],
    chords:
      'Dm | Dm | C | C | Dm | Dm | C | C | ' +
      'Bb | Bb | Gm | A | Dm | F | C | Gm | ' +
      'Dm | Bb | A | A | Dm | Dm | Bb | C | ' +
      'Dm | Gm | A | Dm | Bb | C | Dm | Dm | ' +
      'Dm | C | Bb | A | Dm | C | Gm | A | ' +
      'Dm | Bb | A | Dm',
    melody:
      // вступление: только арпеджио
      '-/8 | -/8 | ' +
      '-/8 | -/8 | ' +
      // тема: длинные ноты, подтяжка — только в вершине фразы
      'D5/6 -/2 | F5/4 E5/2 D5/2 | ' +
      'E5/6 -/2 | G5~A5/6 -/2 | ' +
      'D5/4 F5/4 | Bb4/6 -/2 | ' +
      'G5/4 F5/2 D5/2 | A5/8 | ' +
      // вторая тема
      'A5/2 F5/2 D5/4 | C6/6 -/2 | ' +
      'E5/2 G5/2 E5/4 | D5/4 Bb4/2 G4/2 | ' +
      'F5/2 A5/2 D6/4 | D6~F6/6 -/2 | ' +
      'C#6/4 A5/4 | E5/8 | ' +
      // тягучее соло
      'D5/2 F5/2 A5/4 | A5~C6/8 | ' +
      'F5/4 D5/2 F5/2 | G5/2 E5/2 C5/4 | ' +
      'D6/6 -/2 | Bb5/2 A5/2 G5/4 | ' +
      'A5/4 C#6~D6/4 | D5/8 | ' +
      // тихая интерлюдия
      'Bb4/8 | C5/8 | ' +
      'D5/4 F5/4 | A4/8 | ' +
      // соло-кульминация
      'F5/2 A5/2 D6/4 | E6/6 -/2 | ' +
      'D6/2 C6/2 A5/4 | C#6/4 E6~F6/4 | ' +
      'A5/2 D6/2 F6/4 | E6/2 C6/2 G5/4 | ' +
      'Bb5~D6/6 -/2 | A5/2 C#6/2 E6/4 | ' +
      // кода
      'D5/4 F5/4 | F5~G5/6 -/2 | ' +
      'E5/4 C#5/4 | D5/8',
    chart: { minGapMs: 300, minSameLaneMs: 700 },
  },
];

// --- разбор нотации ---

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchClass(name: string): number {
  const base = PITCH_CLASS[name[0]];
  const accidental = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
  return (base + accidental + 12) % 12;
}

export interface Chord {
  root: number;
  minor: boolean;
  intervals: number[];
}

const CHORD_QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  '5': [0, 7, 12],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
};

export function parseChord(symbol: string): Chord {
  const match = /^([A-G][#b]?)(maj7|m7|dim7|dim|m|7|sus4|5)?$/.exec(symbol);
  if (!match) throw new Error(`Непонятный аккорд: ${symbol}`);
  const quality = match[2] ?? '';
  const minor = (quality.startsWith('m') && quality !== 'maj7') || quality.startsWith('dim');
  return { root: pitchClass(match[1]), minor, intervals: CHORD_QUALITIES[quality] };
}

export function beatMs(song: Song): number {
  return 60000 / song.bpm;
}

/** Вступление до первого такта: в быстрых песнях длиннее, чтобы нарастание не было скомканным. */
export function introBeats(song: Song): number {
  return song.bpm >= 150 ? 16 : 8;
}

function barStartMs(song: Song, bar: number): number {
  return (introBeats(song) + bar * 4) * beatMs(song);
}

/** Аккорды песни с учётом транспонирования. */
export function songChords(song: Song): Chord[] {
  return song.chords.split('|').map((symbol) => {
    const chord = parseChord(symbol.trim());
    return { ...chord, root: (chord.root + song.transpose + 120) % 12 };
  });
}

export function buildMelody(song: Song): MelodyNote[] {
  const eighth = beatMs(song) / 2;
  const chords = songChords(song);
  const vocabulary = new Set(chords.flatMap((chord) => chord.intervals.map((i) => (chord.root + i) % 12)));
  const notes: MelodyNote[] = [];
  song.melody.split('|').forEach((bar, barIndex) => {
    let position = 0;
    for (const token of bar.trim().split(/\s+/)) {
      const match = /^(?:([A-G][#b]?)(\d)(?:~([A-G][#b]?)(\d))?|-)\/(\d+(?:\.5)?)$/.exec(token);
      if (!match) throw new Error(`${song.id}, такт ${barIndex + 1}: непонятная нота «${token}»`);
      const length = Number(match[5]);
      if (match[1]) {
        const midi = (Number(match[2]) + 1) * 12 + pitchClass(match[1]) + song.transpose;
        const bendTo = match[3] ? (Number(match[4]) + 1) * 12 + pitchClass(match[3]) + song.transpose : undefined;
        notes.push({
          timeMs: barStartMs(song, barIndex) + position * eighth,
          midi,
          durationMs: length * eighth,
          harmony: harmonize(midi, chords[barIndex], vocabulary),
          bendTo,
        });
      }
      position += length;
    }
    if (position !== EIGHTHS_PER_BAR) {
      throw new Error(`${song.id}, такт ${barIndex + 1}: ${position} восьмых вместо ${EIGHTHS_PER_BAR}`);
    }
  });
  return notes;
}

/**
 * Гармония второй гитары: ближайшая снизу нота аккорда на терцию или кварту ниже.
 * Если мелодия на проходящей ноте — терция вниз по звукам, которые вообще звучат в песне.
 */
export function harmonize(midi: number, chord: Chord, vocabulary: Set<number>): number {
  const tones = new Set(chord.intervals.map((interval) => (chord.root + interval) % 12));
  const pc = (value: number) => ((value % 12) + 12) % 12;
  for (const interval of [3, 4, 5]) if (tones.has(pc(midi - interval))) return midi - interval;
  for (const interval of [3, 4]) if (vocabulary.has(pc(midi - interval))) return midi - interval;
  return midi - 3;
}

export function barCount(song: Song): number {
  return song.chords.split('|').length;
}

/** Длина песни: отсчёт + такты + такт на затухание последнего аккорда. */
export function songLengthMs(song: Song): number {
  return barStartMs(song, barCount(song) + 1) + 300;
}

export function grooveAt(song: Song, bar: number): Groove {
  return song.sections?.find((section) => bar + 1 >= section.from && bar + 1 <= section.to)?.groove ?? song.groove;
}

// --- ноты для мухи ---

/** Какие ноты мелодии идут в гриф и на какой лад. Остальные играет ритм-гитарист. */
export function buildChart(song: Song): Note[] {
  const melody = buildMelody(song);
  const low = Math.min(...melody.map((n) => n.midi));
  const high = Math.max(...melody.map((n) => n.midi));
  const band = (midi: number) => clampLane(Math.floor(((midi - low) / (high - low + 1)) * 4));

  const chart: Note[] = [];
  let previousMidi: number | null = null;
  let previousLane: Lane = 0;
  for (const note of melody) {
    // лад следует за контуром мелодии, но тянется к своей высотной зоне, чтобы не упираться в край грифа
    let lane: Lane;
    if (previousMidi === null) {
      lane = band(note.midi);
    } else {
      const delta = note.midi - previousMidi;
      const step = delta === 0 ? 0 : Math.sign(delta) * (Math.abs(delta) >= 5 ? 2 : 1);
      const contour = clampLane(previousLane + step);
      lane = clampLane(Math.round((contour * 2 + band(note.midi)) / 3));
      if (delta !== 0 && lane === previousLane) lane = clampLane(previousLane + Math.sign(delta));
    }
    previousMidi = note.midi;
    previousLane = lane;

    const last = chart.at(-1);
    if (last && note.timeMs - last.timeMs < song.chart.minGapMs) continue;
    const sameLane = chart.findLast((n) => n.lane === lane);
    if (sameLane && note.timeMs - sameLane.timeMs < song.chart.minSameLaneMs) {
      const alternative = ([lane + 1, lane - 1] as number[])
        .filter((l): l is Lane => l >= 0 && l <= 3)
        .find((l) => {
          const other = chart.findLast((n) => n.lane === l);
          return !other || note.timeMs - other.timeMs >= song.chart.minSameLaneMs;
        });
      if (alternative === undefined) continue;
      lane = alternative;
      previousLane = lane;
    }
    chart.push({ ...note, lane });
  }
  return chart;
}

function clampLane(value: number): Lane {
  return Math.max(0, Math.min(3, value)) as Lane;
}

// --- аккомпанемент ---

/**
 * Грув — такт в шестнадцатых (16 символов): «X» — акцент, «x» — обычный удар, «o» — тихий, «.» — пауза.
 * Рифф ритм-гитары: «O»/«P» — открытый/глушёный аккорд на тонике, «B»/«b» — на малую секунду выше,
 * «T»/«t» — на тритон выше. Хроматика звучит только в брейкдаунах: под быстрым соло она спорила бы с мелодией.
 */
interface GroovePattern {
  kick: string;
  snare: string;
  /** Призрачные удары по малому — тихие шестнадцатые между основными. */
  ghost?: string;
  hat?: string;
  ride?: string;
  rhythm: string;
  /** Вместо дисторшн-аккордов — чистое арпеджио: номер ступени аккорда на каждой шестнадцатой. */
  arpeggio?: (number | null)[];
  /** Бас отдельно от риффа: [шестнадцатая, ступень, длина в шестнадцатых]. */
  bassSteps?: [number, 'R' | '5', number][];
  /** Колокол на первую долю каждого второго такта. */
  bell?: boolean;
  /** Сбивка в последнем такте части: томы и малый. */
  fill: { tomHigh?: string; tomMid?: string; tomLow?: string; snare?: string };
}

const GROOVES: Record<Groove, GroovePattern> = {
  // похоронный дум: бочка и малый вполсилы темпа, аккорды звенят, бьёт колокол
  doom: {
    kick: 'X.......X.x.....',
    snare: '........X.......',
    ride: 'x...o...x...o...',
    rhythm: 'O.......O...P.P.',
    bell: true,
    fill: { tomHigh: '........X.x.....', tomMid: '............X.x.', tomLow: '..............XX' },
  },
  // галоп: восьмая и две шестнадцатых
  gallop: {
    kick: 'X.oox.oox.oox.oo',
    snare: '....X.......X...',
    hat: 'x.o.x.o.x.o.x.o.',
    ghost: '..o....o..o.....',
    rhythm: 'O.PPP.PPP.PPO.PP',
    fill: { snare: '........x.x.xxxx', tomLow: '..............X.' },
  },
  // трэш: бочка восьмыми, глушёные чаги с открытыми акцентами
  thrash: {
    kick: 'X.o.x.o.X.o.x.o.',
    snare: '....X.......X...',
    hat: 'x.x.x.x.x.x.x.x.',
    ghost: '..o.....o.o.....',
    rhythm: 'O.P.P.P.P.P.O.P.',
    fill: { tomHigh: '........x.x.....', tomMid: '............x.x.', snare: '..............XX' },
  },
  // бласт: всё восьмыми, райд на долях
  blast: {
    kick: 'X.o.x.o.X.o.x.o.',
    snare: '....X.......X...',
    ride: 'x...x...x...x...',
    rhythm: 'O.P.P.P.O.P.P.P.',
    fill: { snare: '........xxxxxxxx' },
  },
  // психоделический прог: полтемпа, чистые арпеджио, орган и много воздуха
  psych: {
    kick: 'X.......o.......',
    snare: '........X.......',
    ride: 'o...o...o...o...',
    rhythm: '................',
    arpeggio: [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null],
    bassSteps: [[0, 'R', 8], [8, '5', 8]],
    fill: { tomLow: '............o.o.' },
  },
  // брейкдаун: синкопированные чаги с тритоном и малой секундой, бочка в унисон с гитарой; соло здесь тянет длинные ноты
  breakdown: {
    kick: 'X..x.x..X..x.x..',
    snare: '........X.......',
    ride: 'o...o...o...o...',
    rhythm: 'O..P.P..T..P.B..',
    fill: { tomLow: '............XXXX' },
  },
};

const VELOCITY: Record<string, number> = { X: 1, x: 0.72, o: 0.42 };
const RIFF: Record<string, { offset: number; muted: boolean }> = {
  O: { offset: 0, muted: false },
  P: { offset: 0, muted: true },
  B: { offset: 1, muted: false },
  b: { offset: 1, muted: true },
  T: { offset: 6, muted: false },
  t: { offset: 6, muted: true },
};

/** Пауэр-аккорды в очень низком строе: тоника в диапазоне G1..F#2. */
function powerRoot(chord: Chord): number {
  return 31 + ((chord.root - 7 + 12) % 12);
}

function chordVoicing(chord: Chord): number[] {
  const root = 43 + ((chord.root - 7 + 12) % 12); // G2..F#3 — пэд глухой и низкий
  return chord.intervals.map((interval) => root + interval);
}

/** Детерминированный «человеческий фактор»: один и тот же трек звучит одинаково, но не по линейке. */
function humanizer(song: Song): (kind: string) => { shiftMs: number; gain: number } {
  let seed = [...song.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
  // у каждого инструмента своя «расхлябанность»: тарелки гуляют сильнее всего, бочка почти не гуляет
  const spread: Record<string, [shift: number, gain: number]> = {
    hat: [9, 0.18], ride: [9, 0.18], snare: [4, 0.1], kick: [3, 0.06],
    tomHigh: [6, 0.12], tomMid: [6, 0.12], tomLow: [6, 0.12],
    power: [5, 0.07], bass: [4, 0.06], lead: [6, 0], clean: [7, 0.12],
  };
  return (kind) => {
    const [shift, gain] = spread[kind] ?? [0, 0];
    return { shiftMs: random() * shift, gain: 1 + random() * gain };
  };
}

export function buildBacking(song: Song): BackingEvent[] {
  const beat = beatMs(song);
  const sixteenth = beat / 4;
  const chords = songChords(song);
  const events: BackingEvent[] = [];

  // вступление: колокол и пэд проявляются из тишины, гитара и бас нарастают,
  // в последнем такте — «обратная» тарелка и тихая дробь на томах, дальше вступает группа
  const intro = barStartMs(song, 0);
  const first = chords[0];
  const lastIntroBar = intro - beat * 4;
  events.push(
    { timeMs: 0, kind: 'bell', midi: powerRoot(first) + 24, velocity: 0.5 },
    { timeMs: 0, kind: 'chord', midis: chordVoicing(first), durationMs: intro + beat, attackMs: intro * 0.6 },
    { timeMs: intro * 0.25, kind: 'bass', midi: powerRoot(first), durationMs: intro * 0.75, attackMs: intro * 0.6 },
    { timeMs: intro * 0.5, kind: 'power', midi: powerRoot(first), fifth: 7, durationMs: intro * 0.5, muted: false, velocity: 0.8, attackMs: intro * 0.45 },
    { timeMs: lastIntroBar, kind: 'swell', durationMs: beat * 4, velocity: 0.8 },
  );
  if (introBeats(song) >= 16) events.push({ timeMs: intro / 2, kind: 'bell', midi: powerRoot(first) + 24, velocity: 0.55 });
  // тихая дробь по томам, крещендо в первый такт
  const roll = [['tomHigh', 10], ['tomHigh', 11], ['tomMid', 12], ['tomMid', 13], ['tomLow', 14], ['tomLow', 15]] as const;
  roll.forEach(([kind, step], k) => events.push({ timeMs: lastIntroBar + step * sixteenth, kind, velocity: 0.25 + k * 0.08 }));

  const pushDrums = (kind: DrumKind, pattern: string | undefined, start: number) => {
    if (!pattern) return;
    for (let i = 0; i < 16; i++) {
      const velocity = VELOCITY[pattern[i]];
      if (velocity) events.push({ timeMs: start + i * sixteenth, kind, velocity });
    }
  };

  chords.forEach((chord, bar) => {
    const start = barStartMs(song, bar);
    const grooveName = grooveAt(song, bar);
    const groove = GROOVES[grooveName];
    const isLast = bar === chords.length - 1;
    const sectionStart = bar === 0 || grooveAt(song, bar - 1) !== grooveName;
    const fillBar = !isLast && (bar % 8 === 7 || grooveAt(song, bar + 1) !== grooveName);

    const dropped = song.arrangement?.find((a) => bar + 1 >= a.from && bar + 1 <= a.to)?.drop ?? [];
    if (!dropped.includes('chord')) events.push({ timeMs: start, kind: 'chord', midis: chordVoicing(chord), durationMs: beat * 4 });
    if (bar % 4 === 0 || sectionStart) {
      const velocity = bar === 0 ? 0.7 : sectionStart || bar % 8 === 0 ? 1 : 0.7;
      events.push({ timeMs: start, kind: 'crash', velocity });
    }
    if (groove.bell && bar % 2 === 0) events.push({ timeMs: start, kind: 'bell', midi: powerRoot(chord) + 24, velocity: 0.8 });

    // во второй половине такта со сбивкой барабаны уступают место томам
    const grooveEnd = (pattern: string | undefined) =>
      dropped.includes('drums') ? undefined : fillBar && pattern ? pattern.slice(0, 8) + '........' : pattern;
    pushDrums('kick', grooveEnd(groove.kick), start);
    pushDrums('snare', grooveEnd(groove.snare), start);
    pushDrums('hat', grooveEnd(groove.hat), start);
    pushDrums('ride', grooveEnd(groove.ride), start);
    // призрачные удары — еле слышные, но именно от них грув «дышит»
    if (!dropped.includes('drums') && !fillBar && groove.ghost) {
      for (let i = 0; i < 16; i++) if (groove.ghost[i] === 'o') events.push({ timeMs: start + i * sixteenth, kind: 'snare', velocity: 0.16 });
    }
    if (fillBar) {
      pushDrums('tomHigh', groove.fill.tomHigh, start);
      pushDrums('tomMid', groove.fill.tomMid, start);
      pushDrums('tomLow', groove.fill.tomLow, start);
      pushDrums('snare', groove.fill.snare, start);
    }

    // чистое арпеджио вместо дисторшн-аккордов
    if (groove.arpeggio) {
      const voicing = [...chordVoicing(chord).map((midi) => midi + 12), chordVoicing(chord)[0] + 24];
      groove.arpeggio.forEach((degree, i) => {
        if (degree === null) return;
        events.push({
          timeMs: start + i * sixteenth,
          kind: 'clean',
          midi: voicing[Math.min(degree, voicing.length - 1)],
          durationMs: sixteenth * 4,
          velocity: i % 4 === 0 ? 0.9 : 0.6,
          pan: i % 8 < 4 ? -0.35 : 0.35, // арпеджио переливается по сторонам
        });
      });
      for (const [step, degree, length] of groove.bassSteps ?? []) {
        events.push({
          timeMs: start + step * sixteenth,
          kind: 'bass',
          midi: powerRoot(chord) + (degree === '5' ? 7 : 0),
          durationMs: length * sixteenth * 0.95,
        });
      }
      return;
    }

    // рифф ритм-гитары и бас в унисон
    const root = powerRoot(chord);
    const hits = [...groove.rhythm].flatMap((symbol, i) => (RIFF[symbol] ? [{ i, ...RIFF[symbol] }] : []));
    hits.forEach(({ i, offset, muted }, k) => {
      const next = hits[k + 1]?.i ?? 16;
      const length = (next - i) * sixteenth;
      // у уменьшённых аккордов на тонике — тритон вместо квинты
      const fifth = offset === 0 && !chord.intervals.includes(7) ? 6 : 7;
      if (dropped.includes('power')) return;
      events.push({
        timeMs: start + i * sixteenth,
        kind: 'power',
        midi: root + offset,
        fifth,
        durationMs: muted ? Math.min(length, sixteenth * 1.5) : length * 0.95,
        muted,
        velocity: muted ? 0.8 : 1,
      });
      if (!dropped.includes('bass')) events.push({ timeMs: start + i * sixteenth, kind: 'bass', midi: root + offset, durationMs: length * 0.9 });
    });
  });

  // финальный аккорд звенит такт, колокол провожает
  const last = chords.at(-1)!;
  const end = barStartMs(song, chords.length);
  events.push(
    { timeMs: end, kind: 'chord', midis: chordVoicing(last), durationMs: beat * 4 },
    { timeMs: end, kind: 'power', midi: powerRoot(last), fifth: 7, durationMs: beat * 4, muted: false, velocity: 1 },
    { timeMs: end, kind: 'bass', midi: powerRoot(last), durationMs: beat * 3 },
    { timeMs: end, kind: 'bell', midi: powerRoot(last) + 24, velocity: 1 },
    { timeMs: end, kind: 'kick', velocity: 1 },
    { timeMs: end, kind: 'crash', velocity: 1 },
  );

  // мелодия звучит целиком: ноты грифа — гитарой мухи, остальные — ритм-гитаристом
  const charted = new Set(buildChart(song).map((note) => note.timeMs));
  for (const note of buildMelody(song)) {
    const fly = charted.has(note.timeMs);
    events.push({
      timeMs: note.timeMs,
      kind: 'lead',
      midi: note.midi,
      harmony: note.harmony,
      durationMs: note.durationMs,
      fly,
      bendTo: note.bendTo,
      smooth: song.smoothLead,
    });
  }

  // микросдвиги и разная сила удара — чтобы не звучало «по линейке»
  const human = humanizer(song);
  const humanized = events.map((event) => {
    if (event.kind === 'chord' || event.kind === 'bell' || event.kind === 'swell') return event;
    const { shiftMs, gain } = human(event.kind);
    const shifted = { ...event, timeMs: Math.max(0, event.timeMs + shiftMs) };
    return 'velocity' in shifted ? { ...shifted, velocity: Math.min(1, shifted.velocity * gain) } : shifted;
  });

  return humanized.sort((a, b) => a.timeMs - b.timeMs);
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
