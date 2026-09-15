/** Муха играет песню без браузера: точность и задержки по ладам. */

import { fsReader, hasData } from './fs-reader';
import { loadGameGraph, loadManifest } from '../src/sim/brain';
import { LifNetwork } from '../src/sim/lif';
import { GroupReadout } from '../src/sim/readout';
import { HeroGame, LANES } from '../src/game/hero';
import { SONGS } from '../src/game/songs';

if (!hasData()) {
  console.error('Нет public/data — см. README');
  process.exit(1);
}

const FRAME_MS = 16;
const only = process.argv[2];

const manifest = await loadManifest(fsReader);
const graph = await loadGameGraph(manifest, fsReader);
const groups = manifest.groups;

for (const song of SONGS.filter((s) => !only || s.id === only)) {
  const net = new LifNetwork(graph, manifest.lif);
  const readout = new GroupReadout(
    Object.fromEntries(['takeoff', 'turn_L', 'turn_R', 'feed'].map((name) => [name, groups[name].game])),
  );
  const game = new HeroGame(song);
  const sent: Record<string, number> = { looming_L: 0, looming_R: 0, sugar_L: 0 };
  const extras = [0, 0, 0, 0];

  while (!game.finished) {
    net.run(Math.round(FRAME_MS / net.dt));
    readout.update(net.spikeCounts, FRAME_MS);
    net.resetCounts();
    game.step(FRAME_MS, readout.rates, false);
    for (const [group, rate] of Object.entries(game.senses())) {
      if (Math.abs(rate - sent[group]) >= 3 || (rate === 0 && sent[group] !== 0)) {
        net.setInputRate(groups[group].game, rate);
        sent[group] = rate;
      }
    }
    for (const event of game.events.splice(0)) if (event.type === 'extra') extras[event.lane]++;
  }

  const byLane = LANES.map((lane, i) => {
    const notes = game.notes.filter((n) => n.lane === i);
    const hit = notes.filter((n) => n.state === 'hit').length;
    const offsets = game.offsets[i];
    const mean = offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : NaN;
    return `${lane.icon} ${hit}/${notes.length} смещение ${mean.toFixed(0)} мс, лишних ${extras[i]}`;
  });
  console.log(
    `${song.title} (${song.difficulty}): ${game.booed ? 'освистали, но допели' : 'допели'} · точность ${(game.accuracy * 100).toFixed(0)}% · ` +
      `очки ${game.score} · комбо ${game.maxCombo} · идеально ${game.perfects}\n  ${byLane.join('\n  ')}`,
  );
}
