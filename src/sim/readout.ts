/** Сглаженные частоты спайков по группам нейронов — то, что «видит» тело мухи. */
export class GroupReadout {
  readonly rates: Record<string, number> = {};
  private readonly groups: [name: string, neurons: Uint32Array][];

  /**
   * @param groups имя группы → индексы нейронов в сети
   * @param tauMs постоянная сглаживания: чем больше, тем плавнее и медленнее реакция
   */
  constructor(groups: Record<string, ArrayLike<number>>, private readonly tauMs = 100) {
    this.groups = Object.entries(groups).map(([name, neurons]) => [name, Uint32Array.from(neurons)]);
    for (const [name] of this.groups) this.rates[name] = 0;
  }

  /** Учитывает спайки, накопленные за elapsedMs симуляции. */
  update(spikeCounts: Uint32Array, elapsedMs: number): void {
    if (elapsedMs <= 0) return;
    const alpha = 1 - Math.exp(-elapsedMs / this.tauMs);
    for (const [name, neurons] of this.groups) {
      let spikes = 0;
      for (let k = 0; k < neurons.length; k++) spikes += spikeCounts[neurons[k]];
      const instant = (spikes / neurons.length) * (1000 / elapsedMs);
      this.rates[name] += (instant - this.rates[name]) * alpha;
    }
  }

  reset(): void {
    for (const [name] of this.groups) this.rates[name] = 0;
  }
}
