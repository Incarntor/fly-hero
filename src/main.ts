import { fetchReader, loadBrainPositions, loadManifest } from './sim/brain';
import { BrainClient } from './sim/client';
import { BrainView } from './ui/brain-view';
import { Band } from './game/audio';
import { CHANNEL, HeroGame, LANES, type HeroEvent } from './game/hero';
import { renderHighway, type HighwayOptions } from './game/render-highway';
import { renderStage } from './game/render-stage';
import { buildBacking, SONGS, type BackingEvent, type Lane, type Song } from './game/songs';

const DATA_URL = `${import.meta.env.BASE_URL}data/`;
const INPUT_EPSILON = 3;
const THROW_FLIGHT_MS = 450;
const THROW_EFFECT_MS = 380;
/** На сколько вперёд планируем аккомпанемент, мс игрового времени. */
const LOOKAHEAD_MS = 120;
const KEYS: Record<string, Lane> = { KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const flyCtx = $<HTMLCanvasElement>('#fly').getContext('2d')!;
const playerCtx = $<HTMLCanvasElement>('#player').getContext('2d')!;
const stageCtx = $<HTMLCanvasElement>('#stage').getContext('2d')!;
const band = new Band();

const read = fetchReader(DATA_URL);
const manifest = await loadManifest(read);
const brainView = new BrainView($<HTMLCanvasElement>('#brain'), await loadBrainPositions(manifest, read));
const brain = new BrainClient(DATA_URL);
await brain.ready;

let song: Song = SONGS[0];
let fly = new HeroGame(song);
let player: HeroGame | null = null;
let backing: BackingEvent[] = [];
let backingIndex = 0;
let playing = false;
let lastSimMs = 0;
let rates: Record<string, number> = {};
let activeNeurons = 0;
let thrown: { kind: 'sugar' | 'slipper'; startMs: number } | null = null;
type Mode = 'solo' | 'duel' | 'listen';
let mode: Mode = 'solo';
/** Связь игрового времени с часами AudioContext: audio = offset + game / скорость. */
const clock = { offset: Number.NaN, speed: 1 };
const sent: Record<string, number> = { looming_L: 0, looming_R: 0, sugar_L: 0 };
const feedback: { fly: HighwayOptions['feedback']; player: HighwayOptions['feedback'] } = { fly: null, player: null };

// --- меню ---

function showMenu(): void {
  playing = false;
  brain.pause();
  $('#loading').hidden = true;
  $('#results').hidden = true;
  $('#song-menu').hidden = false;
  $('#overlay').hidden = false;
}

$('#songs').replaceChildren(
  ...SONGS.map((candidate) => {
    const button = document.createElement('button');
    button.className = 'song';
    button.innerHTML = `<span class="title"></span><span class="difficulty"></span><span class="artist"></span><span class="blurb"></span>`;
    button.querySelector('.title')!.textContent = candidate.title;
    button.querySelector('.artist')!.textContent = `${candidate.artist} · ${candidate.key} · ${candidate.bpm} BPM`;
    button.querySelector('.difficulty')!.textContent = candidate.difficulty;
    button.querySelector('.blurb')!.textContent = candidate.blurb;
    button.onclick = () => startSong(candidate, selectedMode());
    return button;
  }),
);

function selectedMode(): Mode {
  return (document.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value as Mode) ?? 'solo';
}

function startSong(next: Song, nextMode: Mode): void {
  band.start();
  band.setTempo(next.bpm);
  song = next;
  mode = nextMode;
  clock.offset = Number.NaN;
  fly = new HeroGame(next);
  player = mode === 'duel' ? new HeroGame(next) : null;
  $('#player-wrap').hidden = !player;
  backing = buildBacking(next);
  backingIndex = 0;
  thrown = null;
  feedback.fly = feedback.player = null;
  for (const group of Object.keys(sent)) {
    brain.setInput(group, 0);
    sent[group] = 0;
  }
  brain.reset();
  brainView.clear();
  $('#overlay').hidden = true;
  playing = true;
  brain.resume();
}

// --- кадры мозга ---

brain.onFrame((frame) => {
  let dt = frame.timeMs - lastSimMs;
  lastSimMs = frame.timeMs;
  if (dt < 0 || dt > 250) dt = 0;
  rates = frame.rates;
  activeNeurons = frame.active.length;
  brainView.addSpikes(frame.active);
  updateLanes();
  if (!playing || dt === 0) return;

  if (mode === 'listen') {
    // «идеальное исполнение»: ноты нажимаются ровно в долю
    fly.step(dt, null, false);
    for (const note of fly.notes) if (note.state === 'pending' && note.timeMs <= fly.timeMs) fly.press(note.lane);
  } else {
    fly.step(dt, rates, false);
    player?.step(dt, null, false);
    sendSenses();
  }
  syncClock();
  playBacking();

  for (const event of fly.events.splice(0)) onEvent(event, 'fly');
  if (player) for (const event of player.events.splice(0)) onEvent(event, 'player');
});

function syncClock(): void {
  const target = band.now - fly.timeMs / 1000 / clock.speed;
  // кадры мозга приходят неровно — сглаживаем, а при паузах и сбросах синхронизируемся заново
  if (!Number.isFinite(clock.offset) || Math.abs(target - clock.offset) > 0.08) clock.offset = target;
  else clock.offset += (target - clock.offset) * 0.05;
}

function audioTime(gameMs: number): number {
  return Math.max(band.now, clock.offset + gameMs / 1000 / clock.speed);
}

function playBacking(): void {
  if (fly.finished === 'fail') return;
  const horizon = fly.timeMs + LOOKAHEAD_MS * clock.speed;
  while (backingIndex < backing.length && backing[backingIndex].timeMs <= horizon) {
    const event = backing[backingIndex++];
    band.play(audioTime(event.timeMs), event, 1 / clock.speed);
  }
}

function sendSenses(): void {
  const senses = fly.senses();
  if (thrown) {
    const age = fly.timeMs - thrown.startMs;
    if (age >= THROW_FLIGHT_MS && age < THROW_FLIGHT_MS + THROW_EFFECT_MS) {
      if (thrown.kind === 'sugar') senses.sugar_L = 150;
      else senses.looming_L = senses.looming_R = 220;
    }
    if (age > THROW_FLIGHT_MS + THROW_EFFECT_MS) thrown = null;
  }
  for (const [group, rate] of Object.entries(senses)) {
    if (Math.abs(rate - sent[group]) >= INPUT_EPSILON || (rate === 0 && sent[group] !== 0)) {
      brain.setInput(group, Math.round(rate));
      sent[group] = rate;
    }
  }
}

function onEvent(event: HeroEvent, who: 'fly' | 'player'): void {
  const now = performance.now();
  switch (event.type) {
    case 'hit':
      // гитара мухи звучит из аккомпанемента всегда; человек в дуэли подыгрывает колокольчиком
      if (who === 'player') band.lead(audioTime(event.note.timeMs), event.note.midi, event.note.durationMs / clock.speed, 'player');
      feedback[who] = event.perfect
        ? { text: 'ИДЕАЛЬНО!', color: '#ffd23f', atMs: now }
        : { text: event.offsetMs < 0 ? 'РАНОВАТО' : 'ПОЗДНОВАТО', color: LANES[event.lane].color, atMs: now };
      if (who === 'fly' && event.combo > 0 && event.combo % 20 === 0) band.crowd('cheer');
      break;
    case 'miss':
      fumble(event.note.midi, who === 'fly' ? 1 : 0.8);
      feedback[who] = { text: 'МИМО', color: '#ff4f5e', atMs: now };
      break;
    case 'extra':
      fumble(nearestMelodyMidi(who), 0.6);
      feedback[who] = { text: `ЛИШНЕЕ ${LANES[event.lane].icon}`, color: '#a39cb2', atMs: now };
      break;
    case 'fail':
      // зал свистит, но песня доигрывает до конца
      band.crowd('boo');
      break;
    case 'end':
      band.crowd('cheer');
      finish();
      break;
  }
}

/** Звук ошибки, но не чаще раза в 150 мс — серия промахов не превращается в дробь. */
let lastFumbleAt = -Infinity;
let fumbleCount = 0;
function fumble(midi: number, velocity: number): void {
  const now = performance.now();
  if (now - lastFumbleAt < 200) return;
  lastFumbleAt = now;
  fumbleCount++;
  band.fumble(band.now, midi, velocity);
}

/** Для лишнего нажатия берём высоту ближайшей ноты грифа — чтобы звук ошибки остался в тональности. */
function nearestMelodyMidi(who: 'fly' | 'player'): number {
  const game = who === 'fly' ? fly : player!;
  let best = game.notes[0];
  for (const note of game.notes) if (Math.abs(note.timeMs - game.timeMs) < Math.abs(best.timeMs - game.timeMs)) best = note;
  return best.midi;
}

// --- итоги ---

function finish(): void {
  setTimeout(() => {
    playing = false;
    brain.pause();
    showResults();
  }, 1600);
}

function showResults(): void {
  const stars = fly.booed ? 0 : [0.5, 0.75, 0.9, 0.98].filter((edge) => fly.accuracy >= edge).length + 1;
  $('#results-title').textContent =
    mode === 'listen' ? '🎧 Трек дослушан' : player ? '⚔️ Итоги дуэли' : fly.booed ? '🍅 Муху освистали' : '🎸 Концерт окончен';
  $('#results-stars').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  $('#results-text').textContent = verdict();

  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + Math.abs(b), 0) / values.length : 0);
  const allOffsets = fly.offsets.flat();
  const rows = [
    ['Точность мухи', `${(fly.accuracy * 100).toFixed(0)}%`],
    ['Очки мухи', fly.score.toLocaleString('ru')],
    ['Макс. комбо', String(fly.maxCombo)],
    ['Идеальных нот', String(fly.perfects)],
    ['Лишних нажатий', String(fly.extras)],
    ['Отклонение от ноты', `±${mean(allOffsets).toFixed(0)} мс`],
  ];
  if (player) {
    rows.push(['Ваша точность', `${(player.accuracy * 100).toFixed(0)}%`], ['Ваши очки', player.score.toLocaleString('ru')]);
  }
  rows.push(['Задержка мозга (калибровка)', LANES.map((lane) => `${lane.icon} ${lane.leadMs}`).join(' · ') + ' мс']);
  $('#results-stats').replaceChildren(
    ...rows.map(([label, value], index) => {
      const span = document.createElement('span');
      if (index === rows.length - 1) span.className = 'wide';
      span.innerHTML = `${label}: <b></b>`;
      span.querySelector('b')!.textContent = value;
      return span;
    }),
  );

  $('#song-menu').hidden = true;
  $('#results').hidden = false;
  $('#overlay').hidden = false;
}

function verdict(): string {
  if (mode === 'listen') return 'Так песня звучит, если сыграть её идеально. Теперь пусть попробует муха.';
  if (player) {
    const diff = fly.score - player.score;
    if (diff > 0) return `Муха победила вас на ${diff.toLocaleString('ru')} очков. У неё 14 664 нейрона, у вас — 86 миллиардов. Неловко.`;
    if (diff < 0) return `Вы победили муху на ${(-diff).toLocaleString('ru')} очков. Поздравляем: 86 миллиардов нейронов не прошли даром.`;
    return 'Ничья. Наука в замешательстве.';
  }
  if (fly.booed) {
    return 'Муху освистали. Мухи в зале улетели, одна вернула билет. На такой скорости giant fiber просто не успевает перезаряжаться — это не гитарист, это нейрон бегства.';
  }
  if (fly.accuracy >= 0.98 && fly.extras === 0) {
    return 'Идеально. 14 664 нейрона и ни одного лишнего движения. Rolling Stone уже звонит, но муха не берёт трубку — у неё нет рук.';
  }
  if (fly.accuracy >= 0.98) {
    return `Все ноты сыграны, но ${fly.extras} раз(а) муха дёрнулась не туда. Подозреваем, что из зала кидали тапки.`;
  }
  if (fly.accuracy >= 0.85) return 'Отличный концерт. Зал из мух требует выйти на бис.';
  if (fly.accuracy >= 0.6) return 'Неплохо для существа, которое пять минут назад пыталось утонуть в уксусе.';
  return 'Ну… зато с душой.';
}

$('#results-again').addEventListener('click', () => startSong(song, mode));
$('#results-menu').addEventListener('click', showMenu);
$('#menu').addEventListener('click', showMenu);

// --- управление ---

document.addEventListener('keydown', (event) => {
  const lane = KEYS[event.code];
  if (lane === undefined || event.repeat || !player || !playing) return;
  event.preventDefault();
  player.press(lane);
});

$('#throw-sugar').addEventListener('click', () => {
  if (playing && !thrown) thrown = { kind: 'sugar', startMs: fly.timeMs };
});
$('#throw-slipper').addEventListener('click', () => {
  if (playing && !thrown) thrown = { kind: 'slipper', startMs: fly.timeMs };
});
$<HTMLSelectElement>('#speed').addEventListener('change', (event) => {
  clock.speed = Number((event.target as HTMLSelectElement).value);
  clock.offset = Number.NaN;
  brain.setSpeed(clock.speed);
});
$('#mute').addEventListener('click', () => {
  band.setMuted(!band.muted);
  $('#mute').textContent = band.muted ? '🔇' : '🔊';
});

// --- панель ладов ---

const laneBars = LANES.map((lane, index) => {
  const [max, threshold] = [[60, CHANNEL.turn.on], [60, CHANNEL.turn.on], [120, CHANNEL.feed.on], [220, CHANNEL.jump.on]][index];
  const row = document.createElement('div');
  row.className = 'lane';
  row.innerHTML = `
    <span class="dot" style="background:${lane.color}33;border:2px solid ${lane.color}">${lane.icon}</span>
    <span>${lane.name} <small>${lane.input} → ${lane.output}</small></span>
    <output>0 Гц</output>
    <div class="track"><div class="fill" style="background:${lane.color}"></div><div class="threshold" style="left:${(threshold / max) * 100}%"></div></div>`;
  $('#lanes').append(row);
  return { max, fill: row.querySelector<HTMLElement>('.fill')!, output: row.querySelector('output')! };
});

function updateLanes(): void {
  const turnL = rates.turn_L ?? 0;
  const turnR = rates.turn_R ?? 0;
  const values = [turnR - turnL, turnL - turnR, rates.feed ?? 0, rates.takeoff ?? 0];
  laneBars.forEach(({ max, fill, output }, index) => {
    const value = Math.max(0, values[index]);
    fill.style.width = `${Math.min(100, (value / max) * 100)}%`;
    output.value = `${value.toFixed(0)} Гц`;
  });
  $('#brain-status').textContent = `· спайкуют ${activeNeurons}`;
}

// --- отрисовка ---

function render(now: number): void {
  renderHighway(flyCtx, fly, { label: '🪰 Муха', wallMs: now, showChannels: true, feedback: feedback.fly });
  if (player) renderHighway(playerCtx, player, { label: '🧑 Вы', wallMs: now, keys: ['A', 'S', 'D', 'F'], feedback: feedback.player });
  const thrownAge = thrown ? fly.timeMs - thrown.startMs : 0;
  renderStage(stageCtx, {
    wallMs: now,
    game: fly,
    thrown: thrown && thrownAge < THROW_FLIGHT_MS ? { kind: thrown.kind, progress: Math.max(0, thrownAge / THROW_FLIGHT_MS) } : null,
  });
  brainView.draw();
  requestAnimationFrame(render);
}

showMenu();
requestAnimationFrame(render);

// для автотестов в dev-режиме
if (import.meta.env.DEV) {
  Object.assign(window, {
    __hero: { fly: () => fly, player: () => player, fumbles: () => fumbleCount, start: (id: string, nextMode: Mode) => startSong(SONGS.find((s) => s.id === id)!, nextMode) },
  });
}
