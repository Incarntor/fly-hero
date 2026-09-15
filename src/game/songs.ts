/**
 * Песни: мелодия, гармония и грув. Мелодии оригинальные, названия — нет.
 *
 * Мелодия записана по тактам 4/4 в восьмых: «E4/2» — ми первой октавы длиной две восьмых, «E4/0.5» — шестнадцатая,
 * «-/2» — пауза. Песня пишется в удобной тональности и опускается на `transpose` полутонов — так строй ниже.
 * Ноты для мухи выводятся из мелодии, как в Guitar Hero: мелодия идёт вверх — лад сдвигается вправо.
 * Ноты, которые мозгу мухи физически не успеть (слишком плотно), играет «ритм-гитарист». Мелодия звучит всегда,
 * даже если муха промахнулась, — промахи видны в очках и комбо, но не рвут музыку.
 */

export type Lane = 0 | 1 | 2 | 3;
export type Groove = 'doom' | 'gallop' | 'thrash' | 'blast' | 'breakdown';

export interface Note extends MelodyNote {
  lane: Lane;
}

export interface MelodyNote {
  timeMs: number;
  midi: number;
  durationMs: number;
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
  /** Погребальный колокол. */
  | { timeMs: number; kind: 'bell'; midi: number; velocity: number }
  /** Нота мелодии. Звучит всегда, попала муха или нет, — так музыка не рвётся; fly — нота из грифа мухи. */
  | { timeMs: number; kind: 'lead'; midi: number; harmony: number; durationMs: number; fly: boolean };

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
  /** Части с другим грувом: такты с 1, включительно. */
  sections?: { from: number; to: number; groove: Groove }[];
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
    blurb: 'Похоронный дум в си миноре. Колокол, фригийский брейкдаун и соло. Мухи в зале молча раскачиваются.',
    bpm: 84,
    key: 'B harmonic minor',
    transpose: -5,
    groove: 'doom',
    sections: [{ from: 17, to: 20, groove: 'breakdown' }],
    chords:
      'Em | C | Am | B | Em | C | B | B | Am | Em | C | B | Am | C | B | Em | ' +
      'Em | F | Em | F | ' +
      'Am | B | Em | C | Am | B | C | B | Em',
    melody:
      // тема: нисходящий мотив-плач, проводится секвенцией
      'B4/2 A4/1 G4/1 A4/2 B4/2 | C5/2 B4/1 A4/1 G4/4 | A4/2 G4/1 F#4/1 E4/2 A4/2 | B4/2 C5/1 B4/1 A4/2 F#4/2 | ' +
      'B4/2 A4/1 G4/1 A4/2 B4/2 | E5/2 D5/1 C5/1 B4/2 C5/2 | D#5/2 C5/1 B4/1 A4/2 F#4/2 | B4/6 -/2 | ' +
      'C5/2 D5/1 E5/1 C5/2 A4/2 | B4/2 C5/1 B4/1 G4/2 E4/2 | E5/2 F#5/1 G5/1 E5/2 C5/2 | F#5/2 E5/1 D#5/1 B4/4 | ' +
      'E5/2 D5/1 C5/1 A4/2 C5/2 | G5/2 F#5/1 E5/1 C5/2 E5/2 | F#5/2 E5/1 D#5/1 C5/2 D#5/2 | E5/8 | ' +
      // брейкдаун
      'B4/8 | C5/8 | B4/4 G4/4 | A4/4 F4/4 | ' +
      // соло: гаммовые фразы секвенцией вверх и разрешение в тонику
      'E5/1 D5/1 C5/1 B4/1 C5/2 A4/2 | F#5/1 E5/1 D#5/1 C5/1 D#5/2 B4/2 | ' +
      'G5/1 F#5/1 E5/1 D#5/1 E5/2 B4/2 | G5/1 A5/1 G5/1 E5/1 C5/4 | ' +
      'A5/0.5 G5/0.5 F#5/0.5 E5/0.5 C5/1 E5/1 A5/2 E5/2 | B5/0.5 A5/0.5 G5/0.5 F#5/0.5 D#5/1 F#5/1 B5/2 F#5/2 | ' +
      'C6/0.5 B5/0.5 A5/0.5 G5/0.5 E5/1 G5/1 C6/2 G5/2 | B5/2 A5/1 G5/1 F#5/2 D#5/2 | E5/8',
    chart: { minGapMs: 170, minSameLaneMs: 400 },
  },
  {
    id: 'highway',
    title: 'Highway to Банан',
    artist: 'AC/DNa',
    difficulty: 'Средний',
    blurb: 'Галоп в ре миноре, строй ниже некуда. Брейкдаун и соло шестнадцатыми — бананы на этом шоссе не выживают.',
    bpm: 120,
    key: 'D harmonic minor',
    transpose: -7,
    groove: 'gallop',
    sections: [{ from: 17, to: 20, groove: 'breakdown' }],
    chords:
      'Am | F | G | E | Am | F | Dm | E | F | G | Am | Dm | F | E | E7 | Am | ' +
      'Am | Bb | Am | Bb | ' +
      'Dm | E | Am | F | Dm | E | F | E7 | Am',
    melody:
      // тема: галопирующий мотив с повтором и ответом
      'E5/2 E5/1 D5/1 C5/2 B4/2 | C5/2 C5/1 B4/1 A4/2 G4/2 | B4/2 B4/1 A4/1 G4/2 D5/2 | B4/4 G#4/2 E4/2 | ' +
      'E5/2 E5/1 D5/1 C5/2 B4/2 | C5/2 C5/1 D5/1 E5/2 F5/2 | F5/2 E5/1 D5/1 A4/2 D5/2 | E5/4 D5/2 B4/2 | ' +
      'A5/2 G5/1 F5/1 C5/2 F5/2 | B5/2 A5/1 G5/1 D5/2 G5/2 | C6/2 B5/1 A5/1 E5/2 A5/2 | F5/2 E5/1 D5/1 A5/4 | ' +
      'A5/2 G5/1 F5/1 C5/2 F5/2 | G#5/2 F5/1 E5/1 B4/2 E5/2 | D5/2 E5/1 F5/1 G#5/2 B5/2 | A5/8 | ' +
      // брейкдаун
      'E5/8 | F5/8 | E5/4 C5/4 | D5/4 F5/4 | ' +
      // соло
      'D5/0.5 E5/0.5 F5/1 E5/1 D5/1 A4/2 D5/2 | E5/0.5 F5/0.5 G#5/1 F5/1 E5/1 B4/2 E5/2 | ' +
      'A5/1 G#5/1 A5/1 B5/1 C6/2 A5/2 | C6/1 B5/1 A5/1 G5/1 F5/2 C5/2 | ' +
      'F5/0.5 E5/0.5 D5/1 A5/1 F5/1 D5/2 F5/2 | G#5/0.5 F5/0.5 E5/1 B5/1 G#5/1 E5/2 G#5/2 | ' +
      'A5/1 C6/1 B5/1 A5/1 G#5/1 A5/1 C6/2 | B5/2 G#5/2 E5/2 D5/2 | A5/8',
    chart: { minGapMs: 120, minSameLaneMs: 220 },
  },
  {
    id: 'geosmin',
    title: 'Smells Like Geosmin',
    artist: 'Нервана',
    difficulty: 'Сложный',
    blurb: 'Трэш в до-диез фригийском: тритоны в риффе, брейкдаун и соло шестнадцатыми на 170 BPM. Мозг потеет.',
    bpm: 170,
    key: 'C# phrygian',
    transpose: -4,
    groove: 'thrash',
    sections: [{ from: 18, to: 21, groove: 'breakdown' }],
    chords:
      'Fm | Gb | Fm | Eb | Db | C | Fm | C7 | Fm | Gb | Ebm | Db | Bbm | C | Db | C7 | Fm | ' +
      'Fm | Gb | Fm | Gb | ' +
      'Fm | Db | Eb | C | Fm | Gb | Db | C7 | Fm',
    melody:
      // тема: мотив с верхним вспомогательным звуком, проводится по аккордам
      'C5/2 Db5/1 C5/1 Ab4/2 F4/2 | Db5/2 Eb5/1 Db5/1 Bb4/2 Gb4/2 | C5/2 Bb4/1 Ab4/1 G4/2 F4/2 | G4/2 Ab4/1 Bb4/1 Eb5/4 | ' +
      'F5/2 Eb5/1 Db5/1 Ab4/2 F4/2 | E5/2 F5/1 G5/1 C5/4 | Ab5/2 G5/1 F5/1 C5/2 F5/2 | G5/2 F5/1 E5/1 Bb4/2 C5/2 | ' +
      'F5/2 G5/1 Ab5/1 C6/2 Ab5/2 | Gb5/2 F5/1 Eb5/1 Db5/2 Bb4/2 | Eb5/2 F5/1 Gb5/1 Bb5/2 Gb5/2 | F5/2 Eb5/1 Db5/1 Ab4/4 | ' +
      'Db5/2 C5/1 Bb4/1 F5/2 Db5/2 | E5/2 F5/1 G5/1 C6/4 | Ab5/2 G5/1 F5/1 Db5/2 F5/2 | G5/2 Bb5/1 G5/1 E5/2 C5/2 | F5/8 | ' +
      // брейкдаун
      'C5/8 | Db5/8 | C5/4 Ab4/4 | Bb4/4 Db5/4 | ' +
      // соло
      'F5/0.5 G5/0.5 Ab5/1 G5/1 F5/1 C5/2 F5/2 | Db5/0.5 Eb5/0.5 F5/1 Eb5/1 Db5/1 Ab4/2 Db5/2 | ' +
      'Eb5/0.5 F5/0.5 G5/1 F5/1 Eb5/1 Bb4/2 Eb5/2 | E5/1 F5/1 G5/1 Bb5/1 C6/2 G5/2 | ' +
      'Ab5/0.5 G5/0.5 F5/1 C6/1 Ab5/1 F5/2 Ab5/2 | Bb5/0.5 Ab5/0.5 Gb5/1 Db6/1 Bb5/1 Gb5/2 Bb5/2 | ' +
      'Ab5/1 G5/1 F5/1 Eb5/1 Db5/2 F5/2 | G5/1 E5/1 C5/1 E5/1 G5/2 Bb5/2 | F5/8',
    chart: { minGapMs: 90, minSameLaneMs: 170 },
  },
  {
    id: 'pear',
    title: "Livin' on a Pear",
    artist: 'Bon Juicy',
    difficulty: 'Эксперт (для людей)',
    blurb: 'Блэк-арпеджио в до-диез миноре на 220 BPM с уменьшёнными аккордами. Giant fiber — не гитарист, но старается.',
    bpm: 220,
    key: 'C# harmonic minor',
    transpose: -3,
    groove: 'blast',
    chords: 'Em | F | G | F | Em | C | Am | B | Em | F | D#dim7 | B7 | Em | C | B7 | Em',
    melody:
      'E4/1 G4/1 B4/1 E5/1 B4/1 G4/1 E4/1 G4/1 | F4/1 A4/1 C5/1 F5/1 C5/1 A4/1 F4/1 A4/1 | ' +
      'G4/1 B4/1 D5/1 G5/1 D5/1 B4/1 G4/1 B4/1 | A4/1 C5/1 F5/1 A5/1 F5/1 C5/1 A4/1 C5/1 | ' +
      'E5/1 B4/1 G4/1 B4/1 E5/1 G5/1 E5/1 B4/1 | E5/1 C5/1 G4/1 C5/1 E5/1 G5/1 E5/1 C5/1 | ' +
      'C5/1 A4/1 E4/1 A4/1 C5/1 E5/1 C5/1 A4/1 | D#5/1 B4/1 F#4/1 B4/1 D#5/1 F#5/1 B5/1 F#5/1 | ' +
      'G5/1 E5/1 B4/1 E5/1 G5/1 B5/1 G5/1 E5/1 | A5/1 F5/1 C5/1 F5/1 A5/1 C6/1 A5/1 F5/1 | ' +
      'D#5/1 F#5/1 A5/1 C6/1 A5/1 F#5/1 D#5/1 F#5/1 | B4/1 D#5/1 F#5/1 A5/1 F#5/1 D#5/1 B4/1 A4/1 | ' +
      'B4/1 E5/1 G5/1 B5/1 G5/1 E5/1 B4/1 E5/1 | C5/1 E5/1 G5/1 C6/1 G5/1 E5/1 C5/1 E5/1 | ' +
      'A5/1 F#5/1 D#5/1 B4/1 D#5/1 F#5/1 A5/1 B5/1 | E5/8',
    chart: { minGapMs: 100, minSameLaneMs: 220 },
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
      const match = /^(?:([A-G][#b]?)(\d)|-)\/(\d+(?:\.5)?)$/.exec(token);
      if (!match) throw new Error(`${song.id}, такт ${barIndex + 1}: непонятная нота «${token}»`);
      const length = Number(match[3]);
      if (match[1]) {
        const midi = (Number(match[2]) + 1) * 12 + pitchClass(match[1]) + song.transpose;
        notes.push({
          timeMs: barStartMs(song, barIndex) + position * eighth,
          midi,
          durationMs: length * eighth,
          harmony: harmonize(midi, chords[barIndex], vocabulary),
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
  hat?: string;
  ride?: string;
  rhythm: string;
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
    rhythm: 'O.PPP.PPP.PPO.PP',
    fill: { snare: '........x.x.xxxx', tomLow: '..............X.' },
  },
  // трэш: бочка восьмыми, глушёные чаги с открытыми акцентами
  thrash: {
    kick: 'X.o.x.o.X.o.x.o.',
    snare: '....X.......X...',
    hat: 'x.x.x.x.x.x.x.x.',
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

    events.push({ timeMs: start, kind: 'chord', midis: chordVoicing(chord), durationMs: beat * 4 });
    if (bar % 4 === 0 || sectionStart) {
      const velocity = bar === 0 ? 0.7 : sectionStart || bar % 8 === 0 ? 1 : 0.7;
      events.push({ timeMs: start, kind: 'crash', velocity });
    }
    if (groove.bell && bar % 2 === 0) events.push({ timeMs: start, kind: 'bell', midi: powerRoot(chord) + 24, velocity: 0.8 });

    // во второй половине такта со сбивкой барабаны уступают место томам
    const grooveEnd = (pattern: string | undefined) => (fillBar && pattern ? pattern.slice(0, 8) + '........' : pattern);
    pushDrums('kick', grooveEnd(groove.kick), start);
    pushDrums('snare', grooveEnd(groove.snare), start);
    pushDrums('hat', grooveEnd(groove.hat), start);
    pushDrums('ride', grooveEnd(groove.ride), start);
    if (fillBar) {
      pushDrums('tomHigh', groove.fill.tomHigh, start);
      pushDrums('tomMid', groove.fill.tomMid, start);
      pushDrums('tomLow', groove.fill.tomLow, start);
      pushDrums('snare', groove.fill.snare, start);
    }

    // рифф ритм-гитары и бас в унисон
    const root = powerRoot(chord);
    const hits = [...groove.rhythm].flatMap((symbol, i) => (RIFF[symbol] ? [{ i, ...RIFF[symbol] }] : []));
    hits.forEach(({ i, offset, muted }, k) => {
      const next = hits[k + 1]?.i ?? 16;
      const length = (next - i) * sixteenth;
      // у уменьшённых аккордов на тонике — тритон вместо квинты
      const fifth = offset === 0 && !chord.intervals.includes(7) ? 6 : 7;
      events.push({
        timeMs: start + i * sixteenth,
        kind: 'power',
        midi: root + offset,
        fifth,
        durationMs: muted ? Math.min(length, sixteenth * 1.5) : length * 0.95,
        muted,
        velocity: muted ? 0.8 : 1,
      });
      events.push({ timeMs: start + i * sixteenth, kind: 'bass', midi: root + offset, durationMs: length * 0.9 });
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
    events.push({ timeMs: note.timeMs, kind: 'lead', midi: note.midi, harmony: note.harmony, durationMs: note.durationMs, fly });
  }

  return events.sort((a, b) => a.timeMs - b.timeMs);
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
