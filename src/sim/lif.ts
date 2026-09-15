import type { GameGraph, LifParams } from './brain';

/**
 * Сеть leaky integrate-and-fire нейронов по модели Shiu et al. 2024.
 *
 *   dv/dt = (v_0 − v + g) / t_mbr     dg/dt = −g / tau
 *
 * Спайк при v > v_th → v = v_rst, g = 0, рефрактерный период t_rfc (v и g заморожены).
 * Пресинаптический спайк через t_dly добавляет к g постсинаптического нейрона w_syn × число синапсов.
 * Внешняя стимуляция — пуассоновский вход, каждое событие добавляет w_syn × f_poi к v.
 *
 * Порядок операций в шаге повторяет Brian2 и pipeline/validate.py (референсная реализация):
 * интегрирование → порог → доставка спайков и пуассоновского входа → сброс.
 */

/** Отклонение от покоя, ниже которого нейрон «засыпает» и не пересчитывается. */
const REST_EPS = 1e-6;

/** Детерминированный ГПСЧ (mulberry32), чтобы пробы можно было повторить. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class LifNetwork {
  readonly neurons: number;
  readonly dt: number;
  readonly v: Float32Array;
  readonly g: Float32Array;
  /** Спайки каждого нейрона с последнего вызова resetCounts(). */
  readonly spikeCounts: Uint32Array;
  stepIndex = 0;

  private readonly params: LifParams;
  private readonly rowPtr: Uint32Array;
  private readonly col: Uint32Array;
  private readonly weightMv: Float32Array;

  private readonly decayMembrane: number;
  private readonly decaySynapse: number;
  /** Вклад g в решение для v. */
  private readonly gToV: number;
  private readonly delaySteps: number;
  private readonly refractorySteps: number;

  private readonly refractoryUntil: Int32Array;
  private readonly spikes: Uint32Array;
  /** Кольцевой буфер спайков «в пути»: слот step % delaySteps. */
  private readonly pending: Uint32Array[];
  private readonly pendingCount: Uint32Array;

  private readonly inputRate: Float32Array;
  private inputNeurons = new Uint32Array(0);
  private inputProb = new Float32Array(0);
  private random: () => number;

  constructor(graph: Pick<GameGraph, 'rowPtr' | 'col' | 'weight'>, params: LifParams, options: { seed?: number } = {}) {
    this.neurons = graph.rowPtr.length - 1;
    this.params = params;
    this.dt = params.dt;
    this.rowPtr = graph.rowPtr;
    this.col = graph.col;
    this.weightMv = Float32Array.from(graph.weight, (w) => w * params.w_syn);

    this.decayMembrane = Math.exp(-params.dt / params.t_mbr);
    this.decaySynapse = Math.exp(-params.dt / params.tau);
    this.gToV = params.tau / (params.tau - params.t_mbr);
    this.delaySteps = Math.round(params.t_dly / params.dt);
    this.refractorySteps = Math.round(params.t_rfc / params.dt);

    const n = this.neurons;
    this.v = new Float32Array(n).fill(params.v_0);
    this.g = new Float32Array(n);
    this.spikeCounts = new Uint32Array(n);
    this.refractoryUntil = new Int32Array(n);
    this.spikes = new Uint32Array(n);
    this.pending = Array.from({ length: this.delaySteps }, () => new Uint32Array(256));
    this.pendingCount = new Uint32Array(this.delaySteps);
    this.inputRate = new Float32Array(n);
    this.random = mulberry32(options.seed ?? 1);
  }

  get timeMs(): number {
    return this.stepIndex * this.dt;
  }

  /** Пуассоновский вход, Гц. У нейронов со входом нет рефрактерного периода — как в модели Shiu. */
  setInputRate(neurons: ArrayLike<number>, rateHz: number): void {
    for (let k = 0; k < neurons.length; k++) this.inputRate[neurons[k]] = rateHz;
    this.rebuildInputs();
  }

  clearInputs(): void {
    this.inputRate.fill(0);
    this.rebuildInputs();
  }

  /** Возвращает сеть в покой; входы сохраняются. */
  reset(seed?: number): void {
    this.v.fill(this.params.v_0);
    this.g.fill(0);
    this.refractoryUntil.fill(0);
    this.pendingCount.fill(0);
    this.spikeCounts.fill(0);
    this.stepIndex = 0;
    if (seed !== undefined) this.random = mulberry32(seed);
  }

  resetCounts(): void {
    this.spikeCounts.fill(0);
  }

  /** Выполняет steps шагов, возвращает общее число спайков. */
  run(steps: number): number {
    let total = 0;
    for (let s = 0; s < steps; s++) total += this.step();
    return total;
  }

  step(): number {
    const { v, g, spikes, refractoryUntil } = this;
    const { v_0: v0, v_th: vTh, v_rst: vRst } = this.params;
    const em = this.decayMembrane;
    const es = this.decaySynapse;
    const a = this.gToV;
    const t = this.stepIndex;
    const n = this.neurons;

    // 1–2. интегрирование и порог
    let spikeCount = 0;
    for (let i = 0; i < n; i++) {
      if (refractoryUntil[i] > t) continue;
      const gi = g[i];
      const u = v[i] - v0;
      if (gi === 0 && u === 0) continue;

      const vi = v0 + (u - a * gi) * em + a * gi * es;
      const gNext = gi * es;
      if (Math.abs(gNext) < REST_EPS && Math.abs(vi - v0) < REST_EPS) {
        v[i] = v0;
        g[i] = 0;
      } else {
        v[i] = vi;
        g[i] = gNext;
      }
      if (vi > vTh) spikes[spikeCount++] = i;
    }

    // 3. доставка спайков, отправленных t_dly назад
    const slot = t % this.delaySteps;
    const arriving = this.pending[slot];
    const arrivingCount = this.pendingCount[slot];
    const { rowPtr, col, weightMv } = this;
    for (let k = 0; k < arrivingCount; k++) {
      const pre = arriving[k];
      for (let e = rowPtr[pre], end = rowPtr[pre + 1]; e < end; e++) g[col[e]] += weightMv[e];
    }

    // пуассоновский вход
    const kick = this.params.w_syn * this.params.f_poi;
    const { inputNeurons, inputProb } = this;
    for (let k = 0; k < inputNeurons.length; k++) {
      if (this.random() < inputProb[k]) v[inputNeurons[k]] += kick;
    }

    // текущие спайки уходят в тот же слот и придут через delaySteps шагов
    let buffer = arriving;
    if (buffer.length < spikeCount) {
      buffer = this.pending[slot] = new Uint32Array(Math.max(spikeCount, buffer.length * 2));
    }
    buffer.set(spikes.subarray(0, spikeCount));
    this.pendingCount[slot] = spikeCount;

    // 4. сброс
    const { inputRate, spikeCounts } = this;
    for (let k = 0; k < spikeCount; k++) {
      const i = spikes[k];
      v[i] = vRst;
      g[i] = 0;
      refractoryUntil[i] = t + 1 + (inputRate[i] > 0 ? 0 : this.refractorySteps);
      spikeCounts[i]++;
    }

    this.stepIndex = t + 1;
    return spikeCount;
  }

  private rebuildInputs(): void {
    const neurons: number[] = [];
    for (let i = 0; i < this.neurons; i++) if (this.inputRate[i] > 0) neurons.push(i);
    this.inputNeurons = Uint32Array.from(neurons);
    this.inputProb = Float32Array.from(neurons, (i) => (this.inputRate[i] * this.dt) / 1000);
  }
}
