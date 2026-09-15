import type { BrainFrame, FromWorker, GroupInfo, ToWorker } from './protocol';

export interface BrainInfo {
  neurons: number;
  edges: number;
  groups: Record<string, GroupInfo>;
}

/** Обёртка над воркером мозга для главного потока. */
export class BrainClient {
  readonly ready: Promise<BrainInfo>;
  private readonly worker: Worker;
  private readonly frameListeners = new Set<(frame: BrainFrame) => void>();

  constructor(dataUrl: string, seed?: number) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (event: MessageEvent<FromWorker>) => {
        const message = event.data;
        switch (message.type) {
          case 'ready':
            resolve({ neurons: message.neurons, edges: message.edges, groups: message.groups });
            break;
          case 'frame':
            this.frameListeners.forEach((listener) => listener(message));
            break;
          case 'error':
            console.error('[brain]', message.message);
            reject(new Error(message.message));
            break;
        }
      };
      this.worker.onerror = (event) => reject(new Error(event.message));
    });
    this.send({ type: 'init', dataUrl, seed });
  }

  onFrame(listener: (frame: BrainFrame) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  setInput(group: string, rateHz: number): void {
    this.send({ type: 'input', group, rateHz });
  }

  setSpeed(value: number): void {
    this.send({ type: 'speed', value });
  }

  pause(): void {
    this.send({ type: 'pause' });
  }

  resume(): void {
    this.send({ type: 'resume' });
  }

  reset(): void {
    this.send({ type: 'reset' });
  }

  dispose(): void {
    this.worker.terminate();
    this.frameListeners.clear();
  }

  private send(message: ToWorker): void {
    this.worker.postMessage(message);
  }
}
