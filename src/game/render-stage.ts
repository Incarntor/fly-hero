/** Сцена: муха с гитарой, зал из мух, прожекторы и пиротехника. */

import type { HeroGame } from './hero';

export interface StageState {
  wallMs: number;
  game: HeroGame;
  /** Кидают на сцену: 0..1 прогресс полёта. */
  thrown: { kind: 'sugar' | 'slipper'; progress: number } | null;
}

export function renderStage(ctx: CanvasRenderingContext2D, { wallMs, game, thrown }: StageState): void {
  const { width, height } = ctx.canvas;
  const hype = game.meter / 100;
  const booed = game.meter < 15;
  const t = game.timeMs;

  ctx.fillStyle = '#0b0912';
  ctx.fillRect(0, 0, width, height);

  // прожекторы
  for (let k = 0; k < 3; k++) {
    const angle = Math.sin(wallMs / 900 + k * 2) * 0.35;
    const x = width * (0.2 + k * 0.3);
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate(angle);
    const beam = ctx.createLinearGradient(0, 0, 0, height);
    const hue = (k * 120 + wallMs / 30) % 360;
    beam.addColorStop(0, `hsla(${hue}, 90%, 60%, ${0.12 + hype * 0.2})`);
    beam.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.lineTo(70, height);
    ctx.lineTo(-70, height);
    ctx.fill();
    ctx.restore();
  }

  // сцена и колонки
  const stageY = height * 0.62;
  ctx.fillStyle = '#231a2c';
  ctx.fillRect(0, stageY, width, height * 0.1);
  for (const x of [20, width - 80]) {
    ctx.fillStyle = '#16121c';
    ctx.fillRect(x, stageY - 70, 60, 70);
    const pump = 1 + (beatPulse(game) * 0.12);
    for (const [dy, r] of [[-50, 14], [-20, 10]] as const) {
      ctx.beginPath();
      ctx.arc(x + 30, stageY + dy, r * pump, 0, Math.PI * 2);
      ctx.fillStyle = '#34283f';
      ctx.fill();
    }
  }

  // пиротехника на рок-прыжке
  const sinceJump = t - game.pressedAt[3];
  if (sinceJump >= 0 && sinceJump < 500) {
    for (const x of [100, width - 100]) {
      for (let k = 0; k < 6; k++) {
        const h = (1 - sinceJump / 500) * (60 + k * 10);
        ctx.fillStyle = `rgba(255, ${120 + k * 20}, 40, ${0.5 - k * 0.06})`;
        ctx.beginPath();
        ctx.ellipse(x + Math.sin(wallMs / 40 + k) * 6, stageY - h / 2, 10 - k, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawRockFly(ctx, width / 2, stageY - 8, game, wallMs);

  // зал: мухи прыгают в такт, если нравится
  for (let k = 0; k < 22; k++) {
    const x = (k + 0.5) * (width / 22);
    const row = k % 2;
    const bounce = booed ? 0 : Math.abs(Math.sin(t / (60000 / game.song.bpm) * Math.PI + k)) * 10 * hype;
    const y = height - 14 - row * 16 - bounce;
    ctx.fillStyle = row ? '#2c2436' : '#3a3046';
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b3262f';
    ctx.beginPath();
    ctx.arc(x - 4, y - 3, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (!booed && hype > 0.7 && k % 5 === 0) {
      // лапки вверх
      ctx.strokeStyle = '#3a3046';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 4);
      ctx.lineTo(x - 10, y - 18);
      ctx.moveTo(x + 6, y - 4);
      ctx.lineTo(x + 10, y - 18);
      ctx.stroke();
    }
  }
  if (booed) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4f5e';
    ctx.fillText('У-У-У-У!', width * 0.25, height - 52);
    ctx.fillText('ФУУУ', width * 0.75, height - 58);
  }

  // что кидают из зала
  if (thrown) {
    const p = thrown.progress;
    const x = width * 0.15 + (width * 0.35) * p;
    const y = height - 20 - Math.sin(p * Math.PI) * 120 - (stageY - height + 60) * p;
    ctx.font = `${22 + p * 8}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(thrown.kind === 'sugar' ? '🍬' : '🩴', x, y);
  }
}

function drawRockFly(ctx: CanvasRenderingContext2D, x: number, y: number, game: HeroGame, wallMs: number): void {
  const t = game.timeMs;
  const recent = (lane: number, ms: number) => t - game.pressedAt[lane] >= 0 && t - game.pressedAt[lane] < ms;
  const jump = recent(3, 300) ? -Math.sin(((t - game.pressedAt[3]) / 300) * Math.PI) * 34 : 0;
  // мотает головой: левый лад — вправо, правый — влево
  const headbang = recent(0, 200) ? 0.45 : recent(1, 200) ? -0.45 : Math.sin(t / (60000 / game.song.bpm) * Math.PI) * 0.08;

  ctx.save();
  ctx.translate(x, y + jump);
  const s = 2.6;
  ctx.scale(s, s);

  // лапки
  ctx.strokeStyle = '#2a1e10';
  ctx.lineWidth = 1.1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 3, 6);
    ctx.lineTo(side * 7, 14);
    ctx.lineTo(side * 9, 15);
    ctx.stroke();
  }

  // крылья
  const buzz = recent(3, 300) ? Math.sin(wallMs / 12) * 0.5 : 0;
  ctx.fillStyle = 'rgba(220, 235, 255, 0.5)';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (1.15 + buzz));
    ctx.beginPath();
    ctx.ellipse(0, -12, 4, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // тело
  ctx.fillStyle = '#b08a4a';
  ctx.beginPath();
  ctx.ellipse(0, 4, 6.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6a3a';
  ctx.beginPath();
  ctx.ellipse(0, -4, 5.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // гитара
  ctx.save();
  ctx.rotate(-0.5);
  ctx.fillStyle = '#d6283a';
  ctx.beginPath();
  ctx.ellipse(-2, 7, 6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1e10';
  ctx.fillRect(3, 5.8, 15, 2.2);
  ctx.fillStyle = '#eee';
  ctx.fillRect(17, 5, 3, 4);
  ctx.restore();
  // лапка бьёт по струнам
  const strum = recent(0, 120) || recent(1, 120) || recent(2, 120) || recent(3, 120) ? 2.5 : 0;
  ctx.strokeStyle = '#2a1e10';
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-5, 6 + strum);
  ctx.stroke();

  // голова
  ctx.save();
  ctx.translate(0, -10);
  ctx.rotate(headbang);
  ctx.fillStyle = '#6a4f2a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#c4202a';
    ctx.beginPath();
    ctx.ellipse(side * 4.8, -1, 3.6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(side * 4.4, -2.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // хоботок — «играет зубами», как Хендрикс
  if (recent(2, 260)) {
    ctx.strokeStyle = '#3a2410';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(0, 9);
    ctx.stroke();
  }
  // антенны-«ирокез»
  ctx.strokeStyle = '#2a1e10';
  ctx.lineWidth = 0.9;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 1.2, -4);
    ctx.lineTo(side * 3, -9);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function beatPulse(game: HeroGame): number {
  const beat = 60000 / game.song.bpm;
  const phase = ((game.timeMs % beat) + beat) % beat / beat;
  return Math.max(0, 1 - phase * 4);
}
