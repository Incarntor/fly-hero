/** Мозг на канвасе: проекция спереди (x → вправо, y → вниз), спайковавшие нейроны подсвечиваются и гаснут. */

const HEAT_DECAY = 0.85;

export class BrainView {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly heat: Float32Array;
  private readonly hot = new Set<number>();
  private readonly screenX: Float32Array;
  private readonly screenY: Float32Array;
  private readonly background: ImageData;

  constructor(canvas: HTMLCanvasElement, positions: Float32Array) {
    this.ctx = canvas.getContext('2d')!;
    const n = positions.length / 3;
    this.heat = new Float32Array(n);
    this.screenX = new Float32Array(n);
    this.screenY = new Float32Array(n);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = positions[i * 3], y = positions[i * 3 + 1];
      if (x === 0 && y === 0) continue; // нейроны без аннотаций
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const pad = 8;
    const scale = Math.min((canvas.width - 2 * pad) / (maxX - minX), (canvas.height - 2 * pad) / (maxY - minY));
    const offsetX = (canvas.width - (maxX - minX) * scale) / 2;
    const offsetY = (canvas.height - (maxY - minY) * scale) / 2;

    this.background = this.ctx.createImageData(canvas.width, canvas.height);
    const px = this.background.data;
    for (let i = 3; i < px.length; i += 4) {
      px[i - 3] = 10; px[i - 2] = 11; px[i - 1] = 14; px[i] = 255;
    }
    for (let i = 0; i < n; i++) {
      this.screenX[i] = offsetX + (positions[i * 3] - minX) * scale;
      this.screenY[i] = offsetY + (positions[i * 3 + 1] - minY) * scale;
      const o = (Math.floor(this.screenY[i]) * canvas.width + Math.floor(this.screenX[i])) * 4;
      px[o] = Math.min(255, px[o] + 9);
      px[o + 1] = Math.min(255, px[o + 1] + 10);
      px[o + 2] = Math.min(255, px[o + 2] + 14);
    }
  }

  /** Индексы нейронов полного мозга, спайковавших с прошлого кадра. */
  addSpikes(active: Uint32Array): void {
    for (const i of active) {
      this.heat[i] = 1;
      this.hot.add(i);
    }
  }

  clear(): void {
    this.hot.clear();
    this.heat.fill(0);
  }

  draw(): void {
    const { ctx, heat } = this;
    ctx.putImageData(this.background, 0, 0);
    for (const i of this.hot) {
      const h = heat[i];
      ctx.fillStyle = `rgba(255, ${Math.round(110 + 110 * h)}, ${Math.round(60 * h)}, ${Math.min(1, h * 1.5)})`;
      ctx.fillRect(this.screenX[i] - 1, this.screenY[i] - 1, 3, 3);
      heat[i] = h * HEAT_DECAY;
      if (heat[i] < 0.03) this.hot.delete(i);
    }
  }
}
