/** Гриф в перспективе: ноты едут на игрока и растут — буквально лумминг. */

import { LANES, type HeroGame } from './hero';

const VISIBLE_MS = 1400;
const TOP_Y = 70;
const PAST_MS = 220;

export interface HighwayOptions {
  label: string;
  wallMs: number;
  /** Подписи клавиш под ладами (для человека). */
  keys?: string[];
  /** Показывать под ладами, какой нейронный канал отвечает (для мухи). */
  showChannels?: boolean;
  feedback: { text: string; color: string; atMs: number } | null;
}

export function renderHighway(ctx: CanvasRenderingContext2D, game: HeroGame, options: HighwayOptions): void {
  const { width, height } = ctx.canvas;
  const hitY = height - 120;
  const cx = width / 2;
  const topLane = width * 0.07;
  const bottomLane = width * 0.2;
  const perspective = (p: number) => p * p;
  const laneWidth = (p: number) => topLane + (bottomLane - topLane) * perspective(p);
  const yAt = (p: number) => TOP_Y + (hitY - TOP_Y) * perspective(p);
  const laneX = (lane: number, p: number) => cx + (lane - 1.5) * laneWidth(p);

  ctx.fillStyle = '#07060c';
  ctx.fillRect(0, 0, width, height);

  // гриф
  const pBottom = 1 + PAST_MS / VISIBLE_MS;
  ctx.beginPath();
  ctx.moveTo(laneX(-0.5, 0), TOP_Y);
  ctx.lineTo(laneX(3.5, 0), TOP_Y);
  ctx.lineTo(laneX(3.5, pBottom), yAt(pBottom));
  ctx.lineTo(laneX(-0.5, pBottom), yAt(pBottom));
  ctx.closePath();
  const wood = ctx.createLinearGradient(0, TOP_Y, 0, height);
  wood.addColorStop(0, '#1a1024');
  wood.addColorStop(1, '#3a2233');
  ctx.fillStyle = wood;
  ctx.fill();

  // лады, бегущие навстречу
  const beat = 60000 / game.song.bpm;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  for (let k = Math.ceil(game.timeMs / beat); k * beat < game.timeMs + VISIBLE_MS; k++) {
    const p = 1 - (k * beat - game.timeMs) / VISIBLE_MS;
    if (p < 0) continue;
    ctx.lineWidth = 1 + perspective(p) * 2;
    ctx.beginPath();
    ctx.moveTo(laneX(-0.5, p), yAt(p));
    ctx.lineTo(laneX(3.5, p), yAt(p));
    ctx.stroke();
  }
  // струны
  for (let lane = 0; lane < 4; lane++) {
    ctx.strokeStyle = `${LANES[lane].color}33`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(laneX(lane, 0), TOP_Y);
    ctx.lineTo(laneX(lane, pBottom), yAt(pBottom));
    ctx.stroke();
  }

  // мишени
  for (let lane = 0; lane < 4; lane++) {
    const spec = LANES[lane];
    const x = laneX(lane, 1);
    const sincePress = game.timeMs - game.pressedAt[lane];
    const glow = sincePress < 180 ? 1 - sincePress / 180 : 0;
    ctx.beginPath();
    ctx.arc(x, hitY, 26 + glow * 6, 0, Math.PI * 2);
    ctx.fillStyle = glow > 0 ? spec.color : '#15121c';
    ctx.globalAlpha = 0.25 + glow * 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 4;
    ctx.strokeStyle = spec.color;
    ctx.stroke();
    ctx.font = '18px "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(spec.icon, x, hitY + 1);

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    if (options.keys) ctx.fillText(options.keys[lane], x, hitY + 44);
    if (options.showChannels) {
      ctx.fillText(spec.output, x, hitY + 44);
      if (game.channelOn[lane]) {
        ctx.fillStyle = spec.color;
        ctx.fillRect(x - 16, hitY + 56, 32, 4);
      }
    }
  }

  // ноты
  for (const note of game.notes) {
    const until = note.timeMs - game.timeMs;
    if (until > VISIBLE_MS) break;
    if (until < -PAST_MS || note.state === 'hit') continue;
    const p = 1 - until / VISIBLE_MS;
    const x = laneX(note.lane, p);
    const y = yAt(p);
    const r = 6 + 17 * perspective(Math.min(p, 1.1));
    const spec = LANES[note.lane];
    ctx.globalAlpha = note.state === 'missed' ? 0.3 : 1;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fillStyle = spec.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - r * 0.25, y - r * 0.2, r * 0.35, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // вспышки попаданий
  for (const note of game.notes) {
    if (note.state !== 'hit') continue;
    const age = game.timeMs - (note.timeMs + (note.offsetMs ?? 0));
    if (age < 0 || age > 260) continue;
    const x = laneX(note.lane, 1);
    ctx.globalAlpha = 1 - age / 260;
    ctx.strokeStyle = LANES[note.lane].color;
    ctx.lineWidth = 3;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (20 + age * 0.1), hitY + Math.sin(a) * (14 + age * 0.06));
      ctx.lineTo(x + Math.cos(a) * (34 + age * 0.2), hitY + Math.sin(a) * (22 + age * 0.12));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // рок-метр
  const meterH = hitY - TOP_Y;
  ctx.fillStyle = '#1a1622';
  ctx.fillRect(width - 22, TOP_Y, 12, meterH);
  const meterColor = game.meter > 60 ? '#3fd37a' : game.meter > 30 ? '#ffd23f' : '#ff4f5e';
  ctx.fillStyle = meterColor;
  ctx.fillRect(width - 22, TOP_Y + meterH * (1 - game.meter / 100), 12, meterH * (game.meter / 100));
  ctx.save();
  ctx.translate(width - 30, TOP_Y + meterH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('РОК-МЕТР', 0, 0);
  ctx.restore();

  // шапка: кто играет, очки, комбо, прогресс
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(options.label, 12, 12);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText(`точность ${(game.accuracy * 100).toFixed(0)}%`, 12, 32);
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px "Press Start 2P", monospace';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(game.score.toLocaleString('ru'), width - 12, 12);
  if (game.combo >= 4) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`комбо ${game.combo} · ×${game.multiplier}`, width - 12, 42);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(12, 58, width - 24, 3);
  ctx.fillStyle = '#9147ff';
  ctx.fillRect(12, 58, (width - 24) * Math.max(0, Math.min(1, game.timeMs / game.lengthMs)), 3);

  // отзыв о последнем нажатии
  const feedback = options.feedback;
  if (feedback) {
    const age = options.wallMs - feedback.atMs;
    if (age < 600) {
      ctx.globalAlpha = 1 - age / 600;
      ctx.textAlign = 'center';
      ctx.font = `bold ${22 + (1 - age / 600) * 6}px system-ui, sans-serif`;
      ctx.fillStyle = feedback.color;
      ctx.fillText(feedback.text, cx, hitY - 90 - age * 0.04);
      ctx.globalAlpha = 1;
    }
  }

  if (game.meter <= 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.fillStyle = '#ff4f5e';
    ctx.fillText('У-У-У-У!', cx, 90);
  }
}
