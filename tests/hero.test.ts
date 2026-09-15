import { describe, expect, it } from 'vitest';
import { fsReader, hasData } from '../scripts/fs-reader';
import { HeroGame, HIT_WINDOW_MS, LANES } from '../src/game/hero';
import { barCount, buildBacking, buildChart, buildMelody, grooveAt, introBeats, parseChord, songChords, SONGS, type Lane, type Song } from '../src/game/songs';
import { loadGameGraph, loadManifest } from '../src/sim/brain';
import { LifNetwork } from '../src/sim/lif';
import { GroupReadout } from '../src/sim/readout';

const oneNote: Song = { ...SONGS[0], id: 'test', bpm: 120, transpose: 0, sections: [], chords: 'C', melody: 'C5/8', chart: { minGapMs: 0, minSameLaneMs: 0 } };
const PRESS: Record<Lane, Record<string, number>> = { 0: { turn_R: 40 }, 1: { turn_L: 40 }, 2: { feed: 60 }, 3: {} };

describe('Песни', () => {
  it('такты мелодии полные, аккорды разбираются, мелодия и гармония одной длины', () => {
    for (const song of SONGS) {
      expect(() => buildMelody(song)).not.toThrow();
      expect(song.melody.split('|').length).toBe(barCount(song));
      for (const symbol of song.chords.split('|')) expect(() => parseChord(symbol.trim())).not.toThrow();
    }
    expect(() => buildMelody({ ...oneNote, melody: 'C5/7' })).toThrow(/7 восьмых/);
    expect(buildMelody({ ...oneNote, melody: 'C5/0.5 D5/7.5' })).toHaveLength(2);
    // части с другим грувом лежат внутри песни
    for (const song of SONGS) {
      for (const section of song.sections ?? []) expect(section.to).toBeLessThanOrEqual(barCount(song));
    }
    expect(grooveAt(SONGS[0], 16)).toBe('breakdown');
    expect(grooveAt(SONGS[0], 0)).toBe('doom');
  });

  it('ноты мелодии попадают в гамму аккорда или тональности (нет случайных «фальшивых» нот на сильных долях)', () => {
    for (const song of SONGS) {
      const chords = songChords(song);
      const beat = 60000 / song.bpm;
      for (const note of buildMelody(song)) {
        const position = note.timeMs / beat - introBeats(song);
        if (Math.abs(position % 4) > 1e-6) continue; // проверяем только первую долю такта
        const bar = Math.round(position / 4);
        const chord = chords[bar];
        const tones = chord.intervals.map((i) => (chord.root + i) % 12);
        expect(tones, `${song.id}, такт ${bar + 1}`).toContain(note.midi % 12);
      }
    }
  });

  it('вторая гитара играет ноты аккорда на терцию–кварту ниже мелодии', () => {
    for (const song of SONGS) {
      const chords = songChords(song);
      const beat = 60000 / song.bpm;
      let chordTones = 0;
      const melody = buildMelody(song);
      for (const note of melody) {
        const interval = note.midi - note.harmony;
        expect(interval).toBeGreaterThanOrEqual(3);
        expect(interval).toBeLessThanOrEqual(5);
        const chord = chords[Math.floor((note.timeMs / beat - introBeats(song)) / 4)];
        if (chord.intervals.some((i) => (chord.root + i) % 12 === ((note.harmony % 12) + 12) % 12)) chordTones++;
      }
      expect(chordTones / melody.length, song.id).toBeGreaterThan(0.6);
    }
  });

  it('ноты для мухи соблюдают ограничения, остальную мелодию играет ритм-гитарист', () => {
    for (const song of SONGS) {
      const chart = buildChart(song);
      const melody = buildMelody(song);
      expect(chart.length).toBeGreaterThan(20);
      for (let i = 1; i < chart.length; i++) {
        expect(chart[i].timeMs - chart[i - 1].timeMs).toBeGreaterThanOrEqual(song.chart.minGapMs);
        const previousSameLane = chart.slice(0, i).findLast((n) => n.lane === chart[i].lane);
        if (previousSameLane) expect(chart[i].timeMs - previousSameLane.timeMs).toBeGreaterThanOrEqual(song.chart.minSameLaneMs);
      }
      const leads = buildBacking(song).filter((e) => e.kind === 'lead');
      expect(leads.length).toBe(melody.length); // мелодия звучит целиком, без дыр
      expect(leads.filter((e) => e.kind === 'lead' && e.fly).length).toBe(chart.length);
      expect(new Set(chart.map((n) => n.lane)).size).toBe(4);
    }
  });
});

describe('HeroGame', () => {
  it('нажатие вовремя — попадание, без нажатия — промах', () => {
    const game = new HeroGame(oneNote);
    const { timeMs: noteTime, lane } = game.notes[0];
    while (game.timeMs < noteTime - 10) game.step(16, {});
    game.step(16, PRESS[lane]);
    expect(game.hits).toBe(1);
    expect(game.combo).toBe(1);

    const missed = new HeroGame(oneNote);
    while (missed.timeMs < noteTime + HIT_WINDOW_MS + 20) missed.step(16, {});
    expect(missed.misses).toBe(1);
  });

  it('нажатие без ноты рядом — лишнее', () => {
    const game = new HeroGame(oneNote);
    game.step(16, { feed: 60 });
    expect(game.extras).toBe(1);
    expect(game.events).toContainEqual({ type: 'extra', lane: 2 });
  });

  it('прыжок не срабатывает, если giant fiber идёт вместе с поворотом', () => {
    const game = new HeroGame(oneNote);
    for (let k = 0; k < 10; k++) game.step(16, { takeoff: 150, turn_R: 40 });
    expect(game.pressedAt[3]).toBe(-Infinity);
  });

  it('стимул нарастает к ноте и выключается после попадания', () => {
    const game = new HeroGame(oneNote);
    const { timeMs: noteTime, lane } = game.notes[0];
    const total = () => Object.values(game.senses()).reduce((a, b) => a + b, 0);
    while (game.timeMs < noteTime - LANES[lane].leadMs - 50) game.step(16, {});
    expect(total()).toBe(0);
    while (game.timeMs < noteTime) game.step(16, {});
    expect(total()).toBeGreaterThan(100);
    game.press(lane);
    expect(total()).toBe(0);
  });

  it('человек играет через press()', () => {
    const game = new HeroGame(oneNote);
    while (game.timeMs < game.notes[0].timeMs) game.step(16, null);
    game.press(game.notes[0].lane);
    expect(game.hits).toBe(1);
  });
});

describe.skipIf(!hasData())('Мозг играет', () => {
  it('«Smoke on the Vinegar»: муха играет вступление песни и попадает в ноты', async () => {
    const manifest = await loadManifest(fsReader);
    const graph = await loadGameGraph(manifest, fsReader);
    const net = new LifNetwork(graph, manifest.lif);
    const groups = manifest.groups;
    const readout = new GroupReadout(
      Object.fromEntries(['takeoff', 'turn_L', 'turn_R', 'feed'].map((name) => [name, groups[name].game])),
    );
    // берём первые 8 тактов песни: проверяем мозг, а не выносливость теста
    const full = SONGS[0];
    const short = { ...full, chords: full.chords.split('|').slice(0, 8).join('|'), melody: full.melody.split('|').slice(0, 8).join('|') };
    const game = new HeroGame(short);
    const sent: Record<string, number> = {};
    while (!game.finished) {
      for (const [group, rate] of Object.entries(game.senses())) {
        if (Math.abs(rate - (sent[group] ?? 0)) < 3 && !(rate === 0 && sent[group])) continue;
        net.setInputRate(groups[group].game, rate);
        sent[group] = rate;
      }
      net.run(160);
      readout.update(net.spikeCounts, 16);
      net.resetCounts();
      game.step(16, readout.rates);
    }
    expect(game.finished).toBe('end');
    expect(game.accuracy).toBeGreaterThan(0.8);
  });
});
