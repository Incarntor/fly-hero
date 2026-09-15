/// <reference lib="webworker" />
/** Web Worker: крутит LIF-симуляцию в темпе реального времени и шлёт кадры в главный поток. */

import { fetchReader, loadGameGraph, loadManifest, type GameGraph, type Manifest } from './brain';
import { LifNetwork } from './lif';
import type { FromWorker, GroupInfo, ToWorker } from './protocol';
import { GroupReadout } from './readout';

/** Сколько реального времени отдаём симуляции за кадр, мс. Остальное — на обработку сообщений. */
const FRAME_BUDGET_MS = 12;
const FRAME_INTERVAL_MS = 16;
/** После долгой паузы (вкладка в фоне) не пытаемся догнать больше этого. */
const MAX_CATCHUP_MS = 100;

const scope = self as unknown as DedicatedWorkerGlobalScope;

let manifest: Manifest;
let graph: GameGraph;
let net: LifNetwork | undefined;
let readout: GroupReadout;
let speed = 1;
let paused = false;
let lastWall = 0;
let stepDebt = 0;
let realtimeFactor = 0;

function post(message: FromWorker, transfer: Transferable[] = []): void {
  scope.postMessage(message, transfer);
}

async function init(dataUrl: string, seed = 1): Promise<void> {
  const read = fetchReader(dataUrl);
  manifest = await loadManifest(read);
  graph = await loadGameGraph(manifest, read);
  net = new LifNetwork(graph, manifest.lif, { seed });

  const groups: Record<string, GroupInfo> = {};
  const readoutGroups: Record<string, number[]> = {};
  for (const [name, spec] of Object.entries(manifest.groups)) {
    groups[name] = { role: spec.role, label: spec.label ?? name, size: spec.game.length };
    readoutGroups[name] = spec.game;
  }
  readout = new GroupReadout(readoutGroups);

  post({ type: 'ready', neurons: graph.neurons, edges: graph.col.length, groups });
  lastWall = performance.now();
  setTimeout(tick, 0);
}

function tick(): void {
  if (!net) return;
  const frameStart = performance.now();
  const wallElapsed = Math.min(frameStart - lastWall, MAX_CATCHUP_MS);
  lastWall = frameStart;

  let steps = 0;
  if (!paused) {
    stepDebt += (wallElapsed * speed) / net.dt;
    // шагаем пачками, пока не исчерпали долг или бюджет кадра
    while (stepDebt >= 1 && performance.now() - frameStart < FRAME_BUDGET_MS) {
      const batch = Math.min(Math.floor(stepDebt), 20);
      net.run(batch);
      stepDebt -= batch;
      steps += batch;
    }
    // не успели — отстаём честно, без накопления долга: игра увидит realtimeFactor < speed
    stepDebt = Math.min(stepDebt, 1);
  }

  const simElapsed = steps * net.dt;
  if (wallElapsed > 0) realtimeFactor += (simElapsed / wallElapsed - realtimeFactor) * 0.1;
  readout.update(net.spikeCounts, simElapsed);
  const active = collectActive(net.spikeCounts);
  net.resetCounts();
  post(
    { type: 'frame', timeMs: net.timeMs, realtimeFactor, rates: { ...readout.rates }, active },
    [active.buffer],
  );

  setTimeout(tick, Math.max(0, FRAME_INTERVAL_MS - (performance.now() - frameStart)));
}

function collectActive(counts: Uint32Array): Uint32Array {
  let size = 0;
  for (let i = 0; i < counts.length; i++) if (counts[i] > 0) size++;
  const active = new Uint32Array(size);
  for (let i = 0, k = 0; i < counts.length; i++) if (counts[i] > 0) active[k++] = graph.index[i];
  return active;
}

scope.onmessage = (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'init':
        init(message.dataUrl, message.seed).catch((error: unknown) => post({ type: 'error', message: String(error) }));
        break;
      case 'input': {
        const group = manifest?.groups[message.group];
        if (!net || !group) throw new Error(`Неизвестная группа ${message.group}`);
        net.setInputRate(group.game, Math.max(0, message.rateHz));
        break;
      }
      case 'speed':
        speed = Math.max(0, message.value);
        break;
      case 'pause':
        paused = true;
        break;
      case 'resume':
        paused = false;
        break;
      case 'reset':
        net?.reset();
        readout?.reset();
        break;
    }
  } catch (error) {
    post({ type: 'error', message: String(error) });
  }
};
