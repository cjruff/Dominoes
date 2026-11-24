// Moe's Dominoes — UI controller
// Code: © Corey J Ruff

import { Game, MODES, SPINNER_RULES } from './game.js';
import { chooseMove, LEVELS, LEVEL_NAMES } from './ai.js';
import { openEnds, endsTotal } from './board.js';
import { layoutBoard, previewPlacement } from './layout.js';
import { el, addDefs, drawTile, tileSvg, THEMES } from './render.js';
import { tileId, handPips, makeRng } from './tiles.js';
import { loadDisplay, saveDisplay, applyDisplay, tileTheme, TABLE_PRESETS } from './settings.js';
import { GameTracker, commitGame, liveMedals, loadRecord, resetRecord, ACHIEVEMENTS, CATEGORIES, MEDALS, MEDAL_NAMES,
  medalImg, medalFor, progressOf, tiersReached, totalMedals } from './achievements.js';
import { lineFor } from './personalities.js';
import { BUILT_IN, allPlayers, byId, createPlayer } from './roster.js';
import { loadSetup, saveSetup, loadStats, recordGame, resetStats, viewStats, VARIANTS, LEVEL_ORDER } from './stats.js';

const $ = (id) => document.getElementById(id);
let display = loadDisplay();
let theme = tileTheme(display);
applyDisplay(display);

const MODE_HINTS = {
  fives: 'Score when the open ends add up to a multiple of 5. Draw when stuck. Doubles become spinners.',
  block: 'No drawing — pass when stuck. First out scores everyone else’s pips.',
  draw: 'Draw from the boneyard until you can play. First out scores everyone else’s pips.',
};
const TARGETS = { fives: [61, 100, 150, 200, 250], block: [50, 100, 150, 200], draw: [50, 100, 150, 200] };
const DEFAULT_CPUS = [
  { id: 'moe', level: 'medium' }, { id: 'eyton', level: 'medium' }, { id: 'nala', level: 'medium' },
];

let setup = Object.assign({
  mode: 'fives', spinnerRule: 'first', players: 2, target: 150, name: 'You', cpus: DEFAULT_CPUS,
}, loadSetup() || {});
// Older saves used free-typed names; switch them to roster players.
if (!Array.isArray(setup.cpus) || setup.cpus.some((c) => !c.id || !byId(c.id))) {
  setup.cpus = DEFAULT_CPUS.map((d, i) => ({ ...d, level: (setup.cpus && setup.cpus[i] && setup.cpus[i].level) || 'medium' }));
}

let game = null;
let selected = null;       // tileId of the tile the human picked
let busy = false;          // computer is thinking / animating
let lastNodeCount = 0;
let recorded = false;
let passed = new Set();    // who passed since the last play (for the seat badges)
let allPlays = [];         // every play this game, for best-play stats
let tracker = null;        // achievements tracker for the current game
let newMedals = [];        // medals earned by the game that just finished
let gloatShown = false;
let turnDraws = {};        // tiles drawn this turn, per player (for dialogue)

// =====================================================================
// Setup screen
// =====================================================================
function segInit(id, value, onPick) {
  const seg = $(id);
  for (const b of seg.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.v === String(value));
    b.onclick = () => { for (const x of seg.querySelectorAll('button')) x.classList.toggle('on', x === b); onPick(b.dataset.v); };
  }
}

function renderSetup() {
  segInit('segMode', setup.mode, (v) => { if (v !== setup.mode) setup.target = MODES[v].defaultTarget; setup.mode = v; renderSetup(); });
  segInit('segSpinner', setup.spinnerRule, (v) => { setup.spinnerRule = v; });
  segInit('segPlayers', setup.players, (v) => { setup.players = Number(v); renderSetup(); });
  $('fieldSpinner').classList.toggle('hidden', setup.mode !== 'fives');
  $('modeHint').textContent = MODE_HINTS[setup.mode];
  const sel = $('selTarget');
  sel.innerHTML = '';
  for (const t of TARGETS[setup.mode]) {
    const o = document.createElement('option'); o.value = t; o.textContent = `${t} points`; sel.appendChild(o);
  }
  sel.value = setup.target;
  sel.onchange = () => { setup.target = Number(sel.value); };
  $('inpName').value = setup.name;
  $('inpName').oninput = (e) => { setup.name = e.target.value.trim() || 'You'; };

  renderCpuRows();
}

function renderCpuRows() {
  const list = $('cpuList');
  list.innerHTML = '';
  const roster = allPlayers();
  for (let i = 0; i < setup.players - 1; i++) {
    let c = setup.cpus[i];
    if (!c) {
      // Fill a new seat with the first pet not already at the table
      const taken = new Set(setup.cpus.slice(0, i).map((x) => x.id));
      c = setup.cpus[i] = { id: (roster.find((r) => !taken.has(r.id)) || roster[0]).id, level: 'medium' };
    }
    const takenByOthers = new Set(setup.cpus.slice(0, setup.players - 1).filter((_, k) => k !== i).map((x) => x.id));
    const who = byId(c.id) || BUILT_IN[0];
    const row = document.createElement('div'); row.className = 'cpu-row';
    row.innerHTML = avatarHtml({ name: who.name, portrait: who.face, idx: i + 1 });
    const pick = document.createElement('select');
    for (const r of roster) {
      const o = document.createElement('option'); o.value = r.id; o.textContent = r.name;
      if (takenByOthers.has(r.id)) { o.disabled = true; o.textContent += ' (playing)'; }
      pick.appendChild(o);
    }
    const add = document.createElement('option'); add.value = '__new'; add.textContent = '+ Create New'; pick.appendChild(add);
    pick.value = c.id;
    pick.onchange = () => {
      if (pick.value === '__new') {
        const name = prompt('Name for the new computer player:');
        const p = createPlayer(name);
        if (p && !takenByOthers.has(p.id)) c.id = p.id;
      } else c.id = pick.value;
      saveSetup(setup);
      renderCpuRows();
    };
    const lv = document.createElement('select');
    for (const l of LEVELS) { const o = document.createElement('option'); o.value = l; o.textContent = LEVEL_NAMES[l]; lv.appendChild(o); }
    lv.value = c.level; lv.onchange = () => { c.level = lv.value; };
    if (who.onlyLevel) { lv.value = who.onlyLevel; lv.disabled = true; lv.title = `${who.name} only plays at ${LEVEL_NAMES[who.onlyLevel]}`; }
    row.append(pick, lv); list.appendChild(row);
  }
}

$('btnStart').onclick = () => { saveSetup(setup); startGame(); };
$('btnStats').onclick = () => showStats();
$('btnAbout').onclick = () => showAbout();
$('btnSettings').onclick = () => showSettings();
$('btnAch').onclick = () => showAchievements();
$('btnRules').onclick = () => showRules();

function showSettings() {
  const isPreset = TABLE_PRESETS.some((p) => p.color.toLowerCase() === display.table.toLowerCase());
  const tableSw = TABLE_PRESETS.map((p) => `
    <button class="swatch ${display.table.toLowerCase() === p.color ? 'on' : ''}" data-color="${p.color}">
      <span class="chip" style="background:${p.color}"></span>${p.name}</button>`).join('');
  const tileSw = Object.values(THEMES).map((t) => `
    <button class="swatch tile-opt ${display.tiles === t.id ? 'on' : ''}" data-tiles="${t.id}">
      <span class="tiles" data-preview="${t.id}"></span>${t.name}</button>`).join('');
  showOverlay(`<h2>Settings</h2>
    <div class="set-section"><h3>Table Color</h3><div class="swatches">${tableSw}
      <label class="swatch ${isPreset ? '' : 'on'}" id="customSw"><input type="color" id="customColor" value="${display.table}">Custom</label>
    </div></div>
    <div class="set-section"><h3>Tiles</h3><div class="swatches">${tileSw}</div></div>
    <div class="buttons"><button class="btn primary" id="setDone">Done</button><button class="btn" id="setReset">Defaults</button></div>`);
  for (const span of $('panel').querySelectorAll('[data-preview]')) {
    const th = THEMES[span.dataset.preview];
    for (const t of [[6, 6], [3, 5], [1, 4]]) span.appendChild(tileSvg(t, { theme: th }));
  }
  const update = () => {
    saveDisplay(display); applyDisplay(display); theme = tileTheme(display);
    if (game) render();
  };
  for (const b of $('panel').querySelectorAll('[data-color]')) b.onclick = () => { display.table = b.dataset.color; update(); showSettings(); };
  $('customColor').oninput = (e) => {
    display.table = e.target.value; update();
    for (const x of $('panel').querySelectorAll('.swatch[data-color]')) x.classList.remove('on');
    $('customSw').classList.add('on');
  };
  for (const b of $('panel').querySelectorAll('[data-tiles]')) b.onclick = () => { display.tiles = b.dataset.tiles; update(); showSettings(); };
  $('setReset').onclick = () => { display = { table: TABLE_PRESETS[0].color, tiles: 'classic' }; update(); showSettings(); };
  $('setDone').onclick = () => (game ? showMenu() : hideOverlay());
}

function showAbout() {
  showOverlay(`<div class="about">
    <img class="about-img" src="assets/about-moe.webp" alt="Moe playing dominoes in a riverboat saloon">
    <h2 style="text-align:center">Moe's Dominoes</h2>
    <p>See a bug? Please report it to <a href="mailto:me@coreyruff.com?subject=Moe%27s%20Dominoes%20bug">me@coreyruff.com</a></p>
    <p style="font-size:13px;opacity:.7">Code: © Corey J Ruff, 2027</p>
  </div><div class="buttons"><button class="btn primary" id="aBack">Back</button></div>`);
  $('aBack').onclick = () => (game ? showMenu() : hideOverlay());
}

// =====================================================================
// Game flow
// =====================================================================
function startGame() {
  const players = [{ name: setup.name || 'You', human: true }];
  for (let i = 0; i < setup.players - 1; i++) {
    const who = byId(setup.cpus[i].id) || BUILT_IN[i];
    players.push({ name: who.name, level: who.onlyLevel || setup.cpus[i].level, portrait: who.face, rosterId: who.id, loseImage: who.loseImage || null });
  }
  // Two independent, unpredictable seeds: one for shuffling, one for the computer players' thinking.
  const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  game = new Game({ mode: setup.mode, spinnerRule: setup.spinnerRule, players, target: setup.target }, makeRng(seed()), makeRng(seed()));
  game.onEvent = onEvent;
  tracker = new GameTracker(game, 0);
  recorded = false; newMedals = []; gloatShown = false; turnDraws = {};
  allPlays = [];
  $('setup').classList.add('hidden');
  $('game').classList.remove('hidden');
  hideOverlay();
  newHand();
}

function newHand() {
  selected = null; lastNodeCount = 0; passed.clear();
  game.startHand();
  render();
  const s = game.s;
  if (s.mustLead) {
    const who = s.players[s.turn];
    status(`${who.human ? 'You lead' : who.name + ' leads'} with the ${s.mustLead[0]}-${s.mustLead[1]}.`);
  } else status(`${game.current.human ? 'Your' : game.current.name + '’s'} lead.`);
  setTimeout(step, 700);
}

function step() {
  const s = game.s;
  if (s.gameOver) return showGameOver();
  if (s.handOver) return showHandOver();
  const p = game.current;
  busy = !p.human;
  render();
  if (p.human) {
    const moves = game.legalMovesFor();
    if (moves.length === 1 && s.board.nodes.length === 0) { selected = tileId(moves[0].tile); render(); }
    if (!moves.length) status(game.canDraw() ? 'No play — draw from the boneyard.' : 'No play and nothing to draw — pass.');
    else status('Your turn.');
    return;
  }
  const delay = p.level === 'expert' ? 450 : 750;
  setTimeout(() => cpuAct(), delay);
}

function cpuAct() {
  const p = game.current;
  if (game.legalMovesFor().length) {
    const m = chooseMove(game, p.level);
    game.play(m);
    render();
    setTimeout(step, 250);
  } else if (game.canDraw()) {
    game.draw();
    render();
    setTimeout(cpuAct, 380);
  } else {
    game.pass();
    render();
    setTimeout(step, 450);
  }
}

const myTurnNow = () => game && !busy && !game.s.handOver && game.current.human;

function humanPlay(move) {
  if (!myTurnNow()) return;
  busy = true;
  selected = null;
  game.play(move);
  render();
  setTimeout(step, 250);
}

function onEvent(ev, g) {
  const s = g.s;
  if (tracker) { tracker.onEvent(ev, g); for (const m of liveMedals(tracker, g)) flashMedal(m); }
  if (ev.type === 'draw') turnDraws[ev.player] = (turnDraws[ev.player] || 0) + 1;
  if (ev.type === 'play' || ev.type === 'pass') {
    const d = turnDraws[ev.player] || 0;
    turnDraws[ev.player] = 0;
    if (d > 3) {
      say(ev.player, 'bigDrawSelf');
      for (const p of s.players) if (p.idx !== ev.player) say(p.idx, 'bigDrawOther');
    }
    if (ev.type === 'play' && ev.points > 20) say(ev.player, 'bigScore');
  }
  const who = ev.player != null ? s.players[ev.player] : null;
  const nm = who ? (who.human ? 'You' : who.name) : '';
  switch (ev.type) {
    case 'play':
      allPlays.push(ev);
      passed.delete(ev.player);
      if (ev.points) toast(`${nm} ${who.human ? 'score' : 'scores'} ${ev.points}!`);
      status(`${nm} played ${ev.tile[0]}-${ev.tile[1]}${ev.drew ? ` after drawing ${ev.drew}` : ''}${ev.spinner && s.board.nodes.length > 1 ? ' — a spinner!' : ''}.`);
      break;
    case 'draw':
      if (!who.human) status(`${nm} draws… (${ev.left} left)`);
      break;
    case 'pass':
      passed.add(ev.player);
      if (!who.human) toast(`${nm} passes`);
      status(`${nm} ${who.human ? 'pass' : 'passes'}.`);
      break;
    default: break;
  }
}

// =====================================================================
// Rendering
// =====================================================================
function render() {
  if (!game) return;
  renderDocks();
  renderBoard();
  renderHand();
}

// ---------- Player docks: icon, name, score and face-down tiles on the table ----------
const SEAT_SPOTS = { 1: ['top'], 2: ['left', 'right'], 3: ['left', 'top', 'right'] };
const AVATAR_COLORS = ['#b5523b', '#3b6fb5', '#8a4fb0', '#2f8f6b'];

function avatarHtml(p) {
  if (p.portrait) return `<span class="av"><img src="${p.portrait}" alt=""></span>`;
  const ch = esc((p.name.trim()[0] || '?').toUpperCase());
  return `<span class="av" style="background:${AVATAR_COLORS[p.idx % 4]}">${ch}</span>`;
}

function renderDocks() {
  const s = game.s;
  const table = $('table');
  for (const d of table.querySelectorAll('.dock')) d.remove();
  const me = s.players.find((p) => p.human);
  const n = s.players.length;
  const spots = SEAT_SPOTS[n - 1];
  const used = new Set();
  for (let k = 1; k < n; k++) {
    const p = s.players[(me.idx + k) % n];
    const spot = spots[k - 1];
    used.add(spot);
    const d = document.createElement('div');
    d.className = `dock ${spot}` + (p.idx === s.turn && !s.handOver ? ' turn' : '') + (passed.has(p.idx) ? ' passed' : '');
    d.dataset.idx = p.idx;
    const shown = Math.min(p.hand.length, 10);
    const backs = Array.from({ length: shown }, () => '<i class="back"></i>').join('') +
      (p.hand.length > shown ? `<em>+${p.hand.length - shown}</em>` : '');
    d.innerHTML = `${avatarHtml(p)}<div class="who"><span class="nm"></span><span class="lv">${LEVEL_NAMES[p.level]}</span>` +
      `<span class="sc">${p.score}</span></div><div class="backs" title="${p.hand.length} tiles">${backs}</div>`;
    d.querySelector('.nm').textContent = p.name;
    table.appendChild(d);
  }
  table.classList.toggle('has-top', used.has('top'));
  table.classList.toggle('has-sides', used.has('left'));

  const ends = s.mode === 'fives' && s.board.nodes.length ? ` · Ends <b>${endsTotal(s.board)}</b>` : '';
  const bone = MODES[s.mode].draws ? ` · Boneyard <b>${s.boneyard.length}</b>` : '';
  // Fives: the open-ends count, big, in the corner of the table
  const showEnds = s.mode === 'fives' && s.board.nodes.length > 0;
  $('handBadge').textContent = showEnds ? `Ends ${endsTotal(s.board)}` : '';
  $('handBadge').classList.toggle('hidden', !showEnds);
  $('info').innerHTML = `${MODES[s.mode].name}${s.mode === 'fives' && s.spinnerRule === 'all' ? ' (all spin)' : ''} to ${s.target} · Hand ${s.handNo}${ends}${bone}`;
  $('me').className = s.turn === me.idx && !s.handOver ? 'turn' : '';
  $('me').innerHTML = `${avatarHtml(me)}<div class="who"><span class="nm"></span><span class="sc">${me.score}</span></div>`;
  $('me').querySelector('.nm').textContent = me.name;
}

function renderBoard() {
  const s = game.s;
  const svg = $('board');
  const box = svg.getBoundingClientRect();
  const aspect = box.width / Math.max(1, box.height);
  const lay = layoutBoard(s.board, aspect);
  svg.innerHTML = '';
  addDefs(svg, theme);

  // Targets for the selected tile
  const ghosts = [];
  const me = game.current;
  ghostEls = [];
  if (me.human && !s.handOver && selected) {
    const ends = openEnds(s.board);
    for (const m of game.legalMovesFor().filter((mv) => tileId(mv.tile) === selected)) {
      const end = ends.find((e) => e.nodeId === m.nodeId && e.slot === m.slot);
      const pv = previewPlacement(lay, m, end ? end.value : null);
      if (pv) ghosts.push({ m, pv });
    }
  }

  let bb = { ...lay.bbox };
  for (const g of ghosts) bb = { x0: Math.min(bb.x0, g.pv.rect.x0), y0: Math.min(bb.y0, g.pv.rect.y0), x1: Math.max(bb.x1, g.pv.rect.x1), y1: Math.max(bb.y1, g.pv.rect.y1) };
  // Keep tiles from getting huge early on: show at least ~9 tile-lengths across.
  const pad = 1.2;
  let w = bb.x1 - bb.x0 + pad * 2, h = bb.y1 - bb.y0 + pad * 2;
  const minW = Math.max(14, 18 * Math.min(1, aspect)), minH = minW / aspect;
  w = Math.max(w, minW); h = Math.max(h, minH);
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
  svg.setAttribute('viewBox', `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  placeSideDocks(bb, cx - w / 2, cy - h / 2, w);

  for (const t of lay.tiles) {
    drawTile(svg, t.halves, { theme, spinner: t.spinner && s.spinnerRule !== 'none', className: t.id >= lastNodeCount ? 'fresh' : '' });
  }
  lastNodeCount = s.board.nodes.length;

  ghosts.forEach((g, i) => {
    const grp = drawTile(svg, g.pv.halves, { ghost: true, className: 'ghost' });
    grp.setAttribute('tabindex', '0');
    grp.setAttribute('role', 'button');
    if (s.mode === 'fives') {
      const r = g.pv.rect;
      // Label what the play would score
      const pts = pointsIf(g.m);
      if (pts) el('text', { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, class: 'ghost-label' }, grp).textContent = `+${pts}`;
    }
    ghostEls.push({ m: g.m, el: grp });
    grp.addEventListener('click', () => humanPlay(g.m));
    grp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') humanPlay(g.m); });
  });
}

// Phones/tablets: slide the left and right players in next to the tiles (away from
// the camera notch when held sideways). As the line grows they move back out, but
// never past the screen's safe area.
const isTouch = window.matchMedia('(pointer: coarse)');
let safeProbe = null;
function safeArea() {
  // CSS env() values can't be read directly, so measure them on a hidden element.
  if (!safeProbe) {
    safeProbe = document.createElement('div');
    safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';
    document.body.appendChild(safeProbe);
  }
  const cs = getComputedStyle(safeProbe);
  return { safeL: parseFloat(cs.paddingLeft) || 0, safeR: parseFloat(cs.paddingRight) || 0 };
}
function placeSideDocks(bb, vx, vy, vw) {
  const table = $('table');
  const docks = table.querySelectorAll('.dock.left, .dock.right');
  if (!isTouch.matches) { for (const d of docks) d.style.left = d.style.right = ''; return; }
  const tr = table.getBoundingClientRect(), sr = $('board').getBoundingClientRect();
  const scale = sr.width / vw;
  const tilesL = sr.left - tr.left + (bb.x0 - vx) * scale;
  const tilesR = sr.left - tr.left + (bb.x1 - vx) * scale;
  const { safeL, safeR } = safeArea();
  for (const d of docks) {
    const dw = d.offsetWidth, gap = 14;
    if (d.classList.contains('left')) {
      d.style.right = '';
      d.style.left = `${Math.max(safeL + 6, Math.min(tr.width / 2 - dw - gap, tilesL - dw - gap))}px`;
    } else {
      d.style.left = '';
      d.style.right = `${Math.max(safeR + 6, Math.min(tr.width / 2 - dw - gap, tr.width - tilesR - dw - gap))}px`;
    }
  }
}

function pointsIf(m) {
  const sim = game.clone();
  sim.onEvent = null;
  // Only the points for the play itself — not the pips collected if it ends the hand.
  let pts = 0;
  sim.onEvent = (ev) => { if (ev.type === 'play') pts = ev.points || 0; };
  try { sim.play(m); } catch { return 0; }
  return pts;
}

function renderHand() {
  const s = game.s;
  const me = s.players.find((p) => p.human);
  const hand = $('hand');
  hand.innerHTML = '';
  const myTurn = s.turn === me.idx && !s.handOver && !busy;
  const moves = myTurn ? game.legalMovesFor() : [];
  const playable = new Set(moves.map((m) => tileId(m.tile)));
  const sorted = [...me.hand].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const t of sorted) {
    const id = tileId(t);
    const svg = tileSvg(t, { theme });
    svg.classList.add(playable.has(id) ? 'playable' : myTurn ? 'dim' : 'idle');
    if (selected === id) svg.classList.add('selected');
    svg.dataset.id = id;
    svg.addEventListener('pointerdown', (e) => startDrag(e, t, moves, svg));
    hand.appendChild(svg);
  }
  // Size tiles so the whole hand fits on one row (phones, big draws)
  const n = sorted.length || 1;
  const gap = parseFloat(getComputedStyle(hand).columnGap) || 6;
  // The hand sits between your icon and the buttons, so measure what's left of the tray.
  const tray = $('tray'), cs = getComputedStyle(tray);
  const trayGap = parseFloat(cs.columnGap) || 12;
  const room = tray.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    - $('me').offsetWidth - $('actions').offsetWidth - trayGap * 2;
  const availW = room - gap * (n - 1) - 10;
  const hgt = Math.max(36, Math.min(tray.clientHeight - 22, 128, availW / (n * 0.545)));
  for (const t of hand.children) t.style.height = `${hgt}px`;
  const canDraw = myTurn && game.canDraw();
  const mustPass = myTurn && !moves.length && !canDraw;
  $('btnDraw').classList.toggle('hidden', !MODES[s.mode].draws);
  $('btnDraw').disabled = !canDraw;
  $('btnDraw').classList.toggle('pulse', canDraw);
  const left = s.boneyard.length;
  $('btnDraw').innerHTML = `Draw <small>(${left} in boneyard)</small>`;
  $('btnPass').disabled = !mustPass;
  $('btnPass').classList.toggle('pulse', mustPass);
}

// ---------- Dragging tiles from the hand ----------
// A tap still works as before; moving more than a few pixels turns it into a drag.
// While dragging, every spot the tile fits is outlined and the nearest one lights up.
let ghostEls = [];
let drag = null;

function startDrag(e, t, moves, node) {
  if (!myTurnNow() || e.button > 0) return;
  e.preventDefault();
  drag = { t, moves, node, x0: e.clientX, y0: e.clientY, active: false, float: null, hot: null };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', cancelDrag);
}

function onDragMove(e) {
  if (!drag) return;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    const id = tileId(drag.t);
    if (!drag.moves.some((m) => tileId(m.tile) === id)) { shake(drag.t); return cancelDrag(); }
    drag.active = true;
    const r = drag.node.getBoundingClientRect();
    drag.w = r.width; drag.h = r.height;
    drag.float = tileSvg(drag.t, { theme, className: 'drag-float' });
    drag.float.style.width = `${r.width}px`; drag.float.style.height = `${r.height}px`;
    document.body.appendChild(drag.float);
    selected = id;
    render();
    const src = $('hand').querySelector(`[data-id="${id}"]`);
    if (src) src.classList.add('lifted');
  }
  drag.float.style.transform = `translate(${e.clientX - drag.w / 2}px, ${e.clientY - drag.h / 2}px) rotate(-6deg)`;
  // Nearest target within reach
  let best = null, bestD = Infinity;
  for (const g of ghostEls) {
    const b = g.el.getBoundingClientRect();
    const d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2));
    if (d < bestD) { bestD = d; best = g; }
  }
  const reach = Math.max(70, drag.h * 1.1);
  const hot = best && bestD < reach ? best : null;
  for (const g of ghostEls) g.el.classList.toggle('hot', g === hot);
  drag.hot = hot;
}

function onDragEnd(e) {
  if (!drag) return;
  const d = drag;
  cleanupDrag();
  if (!d.active) return onHandTile(d.t, d.moves); // it was a tap
  if (d.hot) return humanPlay(d.hot.m);
  // Dropped over the table with only one possible spot → play it there.
  const tb = $('table').getBoundingClientRect();
  const overTable = e.clientX >= tb.left && e.clientX <= tb.right && e.clientY >= tb.top && e.clientY <= tb.bottom;
  const mine = d.moves.filter((m) => tileId(m.tile) === tileId(d.t));
  if (overTable && mine.length === 1) return humanPlay(mine[0]);
  selected = mine.length > 1 ? tileId(d.t) : null;
  status(selected ? 'Drop it on a highlighted spot, or tap one.' : 'Your turn.');
  render();
}

function cancelDrag() {
  const wasActive = drag && drag.active;
  cleanupDrag();
  if (wasActive) { selected = null; render(); }
}

function cleanupDrag() {
  if (drag && drag.float) drag.float.remove();
  drag = null;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', cancelDrag);
}

function shake(t) {
  const node = $('hand').querySelector(`[data-id="${tileId(t)}"]`);
  if (node) { node.classList.remove('shake'); void node.getBoundingClientRect(); node.classList.add('shake'); }
}

function onHandTile(t, moves) {
  if (!myTurnNow()) return;
  const id = tileId(t);
  const mine = moves.filter((m) => tileId(m.tile) === id);
  if (!mine.length) {
    shake(t);
    return;
  }
  // Double-tap plays a tile that fits in only one place; one tap just picks it up
  // and shows where it can go (tap a spot, or drag, to place it).
  const now = performance.now();
  const isDouble = lastTap.id === id && now - lastTap.at < 450;
  lastTap = { id, at: now };
  if (isDouble && mine.length === 1) { lastTap = { id: null, at: 0 }; return humanPlay(mine[0]); }
  if (isDouble) { selected = id; status('It fits in more than one place — tap the spot you want.'); return render(); }
  selected = selected === id ? null : id;
  status(selected ? (mine.length === 1 ? 'Double-tap the tile, tap the spot, or drag it there.' : 'Tap a highlighted spot, or drag it there.') : 'Your turn.');
  render();
}
let lastTap = { id: null, at: 0 };

$('btnDraw').onclick = () => {
  if (!myTurnNow() || !game.canDraw()) return;
  const t = game.draw();
  status(`You drew the ${t[0]}-${t[1]}.`);
  render();
  if (!game.legalMovesFor().length && !game.canDraw()) status('Still nothing to play — pass.');
};
$('btnPass').onclick = () => {
  if (!myTurnNow() || !game.mustPass()) return;
  busy = true;
  game.pass();
  render();
  setTimeout(step, 300);
};

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
}
function status(msg) { $('status').textContent = msg; }

// =====================================================================
// Overlays
// =====================================================================
function showOverlay(html) { $('panel').innerHTML = html; $('overlay').classList.remove('hidden'); }
function hideOverlay() { $('overlay').classList.add('hidden'); }

function resultTable(r) {
  const s = game.s;
  const rows = s.players.map((p, i) => `
    <tr class="${r.winner === i ? 'win' : ''}">
      <td>${esc(p.human ? p.name : p.name)}</td>
      <td><div class="mini-hand" data-i="${i}"></div></td>
      <td class="num">${r.counts[i]}</td>
      <td class="num">${r.handPoints[i] ? '+' + r.handPoints[i] : ''}</td>
      <td class="num"><b>${p.score}</b></td>
    </tr>`).join('');
  return `<table class="res-table"><tr><th>Player</th><th>Left in hand</th><th class="num">Pips</th><th class="num">This hand</th><th class="num">Total</th></tr>${rows}</table>`;
}
function fillMiniHands(r) {
  for (const div of $('panel').querySelectorAll('.mini-hand')) {
    for (const t of r.hands[Number(div.dataset.i)]) div.appendChild(tileSvg(t, { theme, horizontal: true }));
  }
}

function handHeadline(r) {
  const s = game.s;
  const w = r.winner != null ? s.players[r.winner] : null;
  if (r.reason === 'domino') return `${w.human ? 'You' : esc(w.name)} dominoed${r.award ? ` for <b class="gold">${r.award}</b>` : ''}!`;
  if (r.reason === 'blocked') return w ? `Blocked — ${w.human ? 'you have' : esc(w.name) + ' has'} the low count (<b class="gold">+${r.award}</b>)` : 'Blocked — tie for low count, no points';
  return 'Hand over';
}

function showHandOver() {
  const r = game.s.handResult;
  render();
  showOverlay(`<h2>Hand ${r.handNo}</h2><p>${handHeadline(r)}</p>${resultTable(r)}
    <div class="buttons"><button class="btn primary" id="btnNext">Next hand</button></div>`);
  fillMiniHands(r);
  $('btnNext').onclick = () => { hideOverlay(); newHand(); };
}

function showGameOver() {
  const s = game.s;
  const r = s.handResult;
  render();
  const w = s.players[s.winner];
  if (!recorded) {
    recorded = true;
    const human = s.players.findIndex((p) => p.human);
    let best = 0, doms = 0, handsWon = 0;
    for (const h of s.history) { if (h.winner === human) { handsWon++; if (h.reason === 'domino') doms++; } }
    for (const ev of allPlays) if (ev.player === human) best = Math.max(best, ev.points || 0);
    recordGame({ mode: s.mode, spinnerRule: s.spinnerRule, players: s.players, winner: s.winner,
      scores: s.players.map((p) => p.score), hands: s.handNo, dominoes: doms, bestPlay: best, handsWon, target: s.target });
    allPlays = [];
    if (tracker) newMedals = commitGame(tracker, game);
  }
  const human = s.players.find((p) => p.human);
  const corey = s.players.find((p) => p.loseImage);
  if (corey && s.winner !== human.idx && !gloatShown) { gloatShown = true; showGloat(corey); }
  const head = s.winner === null ? 'Game over' : w.human ? 'You win! 🎉' : `${esc(w.name)} wins`;
  // What the computer players say about the result
  const quotes = s.players.filter((p) => !p.human).map((p) => {
    const line = p.idx === s.winner ? lineFor(p.rosterId, 'win')
      : (p.score === 0 && lineFor(p.rosterId, 'loseZero')) || lineFor(p.rosterId, 'lose');
    return line ? `<div class="quote">${avatarHtml(p)}<b>${esc(p.name)}:</b> “${esc(line)}”</div>` : '';
  }).join('');
  const shown = newMedals.slice(0, 8);
  const medalsHtml = newMedals.length ? `<div class="new-medals"><h3>New medals!</h3><div class="medal-row">${shown.map((m) =>
    `<div class="nm-item"><img src="${medalImg(m.medal)}" alt="${MEDAL_NAMES[m.medal]}"><span>${esc(m.a.name)}</span></div>`).join('')}
    ${newMedals.length > shown.length ? `<div class="nm-more">+${newMedals.length - shown.length} more</div>` : ''}</div></div>` : '';
  showOverlay(`<h2>${head}</h2><p>${r.reason === 'reachedTarget' ? 'Reached the target on a scoring play.' : handHeadline(r)}</p>${quotes}${resultTable(r)}${medalsHtml}
    <div class="buttons"><button class="btn primary" id="btnAgain">Play again</button><button class="btn" id="goAch">Achievements</button><button class="btn" id="btnSt">Stats</button></div>`);
  fillMiniHands(r);
  $('goAch').onclick = () => showAchievements(showGameOver);
  // Back to the main screen (your last choices are kept) so you can change the game or opponents.
  $('btnAgain').onclick = () => { document.getElementById('gloat')?.remove(); toSetup(); };
  $('btnSt').onclick = () => showStats(true);
}


// ---------- Medal flash (as each one is earned) ----------
function flashMedal(m) {
  let box = document.getElementById('medalPops');
  if (!box) { box = document.createElement('div'); box.id = 'medalPops'; document.body.appendChild(box); }
  const d = document.createElement('div');
  d.className = 'medal-pop';
  d.innerHTML = `<img src="${medalImg(m.medal)}" alt=""><div><small>${MEDAL_NAMES[m.medal]} medal</small><b>${esc(m.a.name)}</b></div>`;
  box.appendChild(d);
  setTimeout(() => d.classList.add('out'), 3000);
  setTimeout(() => d.remove(), 3500);
}

// ---------- Speech bubbles ----------
function say(idx, event) {
  const p = game.s.players[idx];
  if (!p || p.human) return;
  const line = lineFor(p.rosterId, event);
  if (!line) return;
  const table = $('table');
  const dock = table.querySelector(`.dock[data-idx="${idx}"]`);
  if (!dock) return;
  const tr = table.getBoundingClientRect(), dr = dock.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = line;
  if (dock.classList.contains('top')) { b.classList.add('below'); b.style.left = `${dr.left - tr.left + dr.width / 2}px`; b.style.top = `${dr.bottom - tr.top + 10}px`; }
  else if (dock.classList.contains('left')) { b.classList.add('right'); b.style.left = `${dr.right - tr.left + 10}px`; b.style.top = `${dr.top - tr.top + 18}px`; }
  else { b.classList.add('left'); b.style.right = `${tr.right - dr.left + 10}px`; b.style.top = `${dr.top - tr.top + 18}px`; }
  table.appendChild(b);
  setTimeout(() => b.classList.add('fade'), 2200);
  setTimeout(() => b.remove(), 2700);
}

// ---------- Achievements screen ----------
function showAchievements(back) {
  const rec = loadRecord();
  let got = 0;
  const sections = CATEGORIES.map((cat, ci) => {
    const rows = ACHIEVEMENTS.filter((a) => a.cat === ci).map((a) => {
      const v = progressOf(rec, a);
      const n = tiersReached(a, v);
      got += n;
      const top = n ? medalFor(a, n - 1) : (a.tiers.length === 1 ? a.medal : 'bronze');
      const next = a.tiers[n];
      const prog = next != null ? `${Math.min(v, next).toLocaleString()} / ${next.toLocaleString()}` : 'Complete';
      const pips = a.tiers.length > 1
        ? `<div class="pips">${MEDALS.map((m, i) => `<i class="pip ${m} ${i < n ? 'on' : ''}" title="${MEDAL_NAMES[m]}: ${a.tiers[i].toLocaleString()}"></i>`).join('')}</div>`
        : `<div class="pips single">${MEDAL_NAMES[a.medal]}</div>`;
      return `<div class="ach ${n ? 'got' : ''}"><img src="${medalImg(top)}" alt=""><div class="ach-txt"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div>
        <div class="ach-prog">${pips}<small>${prog}</small></div></div>`;
    }).join('');
    return `<h3 class="ach-cat">${esc(cat)}</h3>${rows}`;
  }).join('');
  showOverlay(`<h2>Achievements</h2><p class="ach-sum"><b>${got}</b> of ${totalMedals()} medals earned</p>
    <div class="ach-list">${sections}</div>
    <div class="buttons"><button class="btn primary" id="achBack">Back</button><button class="btn" id="achReset">Reset medals</button></div>`);
  $('achBack').onclick = () => (back ? back() : hideOverlay());
  $('achReset').onclick = () => { if (confirm('Erase all medals and achievement progress?')) { resetRecord(); showAchievements(back); } };
}

// Shown over everything when you lose a game with Corey at the table. Tap to close.
function showGloat(p) {
  const img = new Image();
  img.onload = () => {
    const d = document.createElement('div');
    d.id = 'gloat';
    d.appendChild(img);
    const cap = document.createElement('p'); cap.textContent = `${p.name} wins. Tap to continue.`; d.appendChild(cap);
    d.onclick = () => d.remove();
    document.body.appendChild(d);
  };
  img.src = p.loseImage; // silently skipped until the picture is added
}

function toSetup() {
  hideOverlay();
  game = null; allPlays = [];
  $('game').classList.add('hidden');
  $('setup').classList.remove('hidden');
  renderSetup();
}

function showMenu() {
  showOverlay(`<h2>Menu</h2>
    <div class="buttons" style="flex-wrap:wrap">
      <button class="btn primary" id="mResume">Resume</button>
      <button class="btn" id="mRules">Rules</button>
      <button class="btn" id="mSettings">Settings</button>
      <button class="btn" id="mAch">Achievements</button>
      <button class="btn" id="mStats">Stats</button>
      <button class="btn" id="mAbout">About</button>
      <button class="btn" id="mQuit">Quit game</button>
    </div>`);
  $('mResume').onclick = hideOverlay;
  $('mRules').onclick = showRules;
  $('mStats').onclick = () => showStats(true);
  $('mAch').onclick = () => showAchievements(showMenu);
  $('mAbout').onclick = showAbout;
  $('mSettings').onclick = showSettings;
  $('mQuit').onclick = () => { if (confirm('Quit this game? It won’t count in your stats.')) toSetup(); };
}
$('btnMenu').onclick = showMenu;

function showRules() {
  showOverlay(`<h2>Rules</h2><div class="rules">
    <h3>The deal</h3><p>Moe's Dominoes uses a double-six set (28 tiles). With 2 players each gets 7 tiles; with 3 or 4 players, 5 each — except 4-player Block, which deals 7 each and uses every tile. The rest are the boneyard. Everyone plays for themselves.</p>
    <h3>Who leads</h3><p>On the first hand, the player with the highest double leads and must play it (if nobody has a double, the heaviest tile leads). After that, the winner of the last hand leads with any tile — the player who went out, or the lowest count when the hand was blocked. If a blocked hand ties for the lowest count, the highest double leads again.</p>
    <h3>Playing</h3><p>Turns go clockwise. Match one end of your tile to an open end of the line. Doubles are placed crosswise. Tap a tile to see where it fits, then tap the spot, double-tap the tile, or drag it there.</p>
    <h3>Ending a hand</h3><p><b>Going out (domino):</b> play your last tile and you score the pips left in everyone else's hands.<br>
      <b>Blocked:</b> when nobody can play, the lowest count wins the hand and scores the <i>difference</i>: everyone else's pips minus their own. Example: you hold 8, your opponents hold 28 between them — you score 20. A tie for lowest scores nothing.</p>
    <h3>Fives</h3><p>After each play, add up the open ends of the line. A double at an end counts both halves. If the total is a multiple of 5 (5, 10, 15…) you score it right away. Stuck? Draw from the boneyard until you can play; pass only when it's empty. End-of-hand points are rounded to the nearest 5. Reach the target on a scoring play and you win on the spot.</p>
    <p><b>First spinner only:</b> the first double played becomes the spinner — once both its long sides are covered, you can also play off its two short sides. <b>Every double spins:</b> every double works that way.</p>
    <h3>Block</h3><p>No drawing. If you can't play, you pass.</p>
    <h3>Draw</h3><p>Like Block, but when you can't play you draw from the boneyard until you can. Pass only when the boneyard is empty.</p>
    <h3>Winning</h3><p>The first player to reach the target score (chosen at setup) wins.</p>
  </div><div class="buttons"><button class="btn primary" id="rBack">Back</button></div>`);
  $('rBack').onclick = () => (game ? showMenu() : hideOverlay());
}

// Download every stats table (all game types) as a CSV file for Excel / Google Sheets.
function exportStats() {
  const st = loadStats();
  const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const pct = (w, n) => (n ? Math.round((100 * w) / n) : '');
  const rows = [['Game type', 'Table', 'Level / Player', 'Played', 'Won', 'Lost', 'Win %', 'Avg points', 'Hands won', 'Hands played',
    'Dominoes', 'Best play', 'Best margin', 'They won', 'Finished ahead', 'Current streak', 'Best streak']];
  for (const opt of [{ key: 'all', name: 'All Games' }, ...VARIANTS]) {
    const v = viewStats(st, opt.key);
    const line = (label, L) => rows.push([opt.name, 'By difficulty', label, L.played, L.won, L.played - L.won, pct(L.won, L.played),
      L.played ? Math.round(L.points / L.played) : '', L.handsWon, L.hands, L.dominoes, L.bestPlay || '', L.bestMargin || '', '', '',
      label === 'Total' ? v.streak.cur : '', label === 'Total' ? v.streak.best : '']);
    for (const lv of LEVEL_ORDER) if (v.byLevel[lv]) line(LEVEL_NAMES[lv], v.byLevel[lv]);
    line('Total', v.total);
    for (const [id, r] of Object.entries(v.vs)) {
      const who = byId(id);
      rows.push([opt.name, 'Vs. players', who ? who.name : r.name, r.played, r.won, '', pct(r.won, r.played), '', '', '', '', '', '', r.theyWon, r.ahead, '', '']);
    }
  }
  const csv = '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
  download(`Moes-Dominoes-stats-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
}

// ---------- Backup / import (stats, medals, players, settings) ----------
const BACKUP_PREFIX = 'moesDominoes.';
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function backupAll() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(BACKUP_PREFIX)) data[k] = localStorage.getItem(k);
  }
  const file = { app: "Moe's Dominoes", kind: 'backup', version: 1, saved: new Date().toISOString(), data };
  download(`Moes-Dominoes-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(file, null, 1), 'application/json');
}

function restoreAll() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    let file;
    try { file = JSON.parse(await f.text()); } catch { return alert('That file isn’t a Moe’s Dominoes backup.'); }
    if (!file || file.kind !== 'backup' || !file.data || typeof file.data !== 'object') return alert('That file isn’t a Moe’s Dominoes backup.');
    const keys = Object.keys(file.data).filter((k) => k.startsWith(BACKUP_PREFIX) && typeof file.data[k] === 'string');
    if (!keys.length) return alert('That backup is empty.');
    const when = file.saved ? new Date(file.saved).toLocaleString() : 'an unknown date';
    if (!confirm(`Replace the stats, medals, players and settings on this device with the backup from ${when}?${game && !game.s.gameOver ? ' The game in progress will end.' : ''}`)) return;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k.startsWith(BACKUP_PREFIX)) localStorage.removeItem(k);
    }
    for (const k of keys) localStorage.setItem(k, file.data[k]);
    location.reload();
  };
  inp.click();
}

let statsView = 'all';
function showStats(fromGame = false) {
  const st = loadStats();
  const v = viewStats(st, statsView);
  const fives = statsView === 'all' || statsView.startsWith('fives');
  const pct = (w, n) => (n ? `${Math.round((100 * w) / n)}%` : '–');
  const dash = (n, x) => (n ? x : '–');
  const lineRow = (label, L, cls = '') => `<tr class="${cls}"><td>${label}</td>
    <td class="num">${L.played}</td><td class="num">${L.won}</td><td class="num">${L.played - L.won}</td>
    <td class="num">${pct(L.won, L.played)}</td><td class="num">${dash(L.played, Math.round(L.points / (L.played || 1)))}</td>
    <td class="num">${dash(L.hands, `${L.handsWon}/${L.hands}`)}</td><td class="num">${dash(L.played, L.dominoes)}</td>
    ${fives ? `<td class="num">${dash(L.bestPlay, L.bestPlay)}</td>` : ''}<td class="num">${dash(L.bestMargin, L.bestMargin)}</td></tr>`;
  const zero = { played: 0, won: 0, points: 0, hands: 0, handsWon: 0, dominoes: 0, bestPlay: 0, bestMargin: 0 };
  const levelRows = LEVEL_ORDER.map((lv) => lineRow(LEVEL_NAMES[lv], v.byLevel[lv] || zero)).join('') + lineRow('<b>Total</b>', v.total, 'total');

  // Every player you can sit with, plus anyone from older games
  const roster = allPlayers();
  const ids = [...roster.map((r) => r.id), ...Object.keys(v.vs).filter((id) => !roster.some((r) => r.id === id))];
  const vsRows = ids.map((id) => {
    const r = v.vs[id] || { played: 0, won: 0, theyWon: 0, ahead: 0 };
    const who = byId(id) || { name: (v.vs[id] && v.vs[id].name) || id, face: null };
    return `<tr><td><span class="who-cell">${avatarHtml({ name: who.name, portrait: who.face, idx: 1 })}${esc(who.name)}</span></td>
      <td class="num">${r.played}</td><td class="num">${r.won}</td><td class="num">${r.theyWon}</td>
      <td class="num">${pct(r.won, r.played)}</td><td class="num">${dash(r.played, `${r.ahead}/${r.played}`)}</td></tr>`;
  }).join('');

  const opts = [{ key: 'all', name: 'All Games' }, ...VARIANTS];
  showOverlay(`<h2>Stats</h2>
    <div class="seg stats-seg">${opts.map((o) => `<button data-v="${o.key}" class="${o.key === statsView ? 'on' : ''}">${o.name}</button>`).join('')}</div>
    <p class="streaks">Win streak: <b>${v.streak.cur}</b> now · best <b>${v.streak.best}</b></p>
    <h3 class="st-h">By difficulty</h3>
    <p class="st-note">A game counts under the toughest computer player at the table.</p>
    <div class="table-scroll"><table class="res-table stats-table"><tr><th>Level</th><th class="num">Played</th><th class="num">Won</th><th class="num">Lost</th>
      <th class="num">Win %</th><th class="num">Avg pts</th><th class="num">Hands won</th><th class="num">Dominoes</th>
      ${fives ? '<th class="num">Best play</th>' : ''}<th class="num">Best margin</th></tr>${levelRows}</table></div>
    <h3 class="st-h">Vs. players</h3>
    <div class="table-scroll"><table class="res-table stats-table"><tr><th>Player</th><th class="num">Games together</th><th class="num">You won</th>
      <th class="num">They won</th><th class="num">Your win %</th><th class="num">Finished ahead</th></tr>${vsRows}</table></div>
    <div class="buttons"><button class="btn primary" id="sBack">Back</button><button class="btn" id="sExport">Export stats</button>
      <button class="btn" id="sBackup">Back up</button><button class="btn" id="sRestore">Import backup</button><button class="btn" id="sReset">Reset stats</button></div>
    <p class="st-note">Export stats makes a spreadsheet (CSV). Back up saves your stats, medals, players and settings in one file that Import backup can load on any device.</p>`);
  $('sExport').onclick = exportStats;
  $('sBackup').onclick = backupAll;
  $('sRestore').onclick = restoreAll;
  for (const b of $('panel').querySelectorAll('.stats-seg button')) b.onclick = () => { statsView = b.dataset.v; showStats(fromGame); };
  $('sBack').onclick = () => (fromGame && game && !game.s.gameOver ? showMenu() : game && game.s.gameOver ? showGameOver() : hideOverlay());
  $('sReset').onclick = () => { if (confirm('Erase all stats?')) { resetStats(); showStats(fromGame); } };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Re-flow the table when the window or phone rotates
let rz = null;
new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => game && renderBoard(), 60); }).observe($('table'));

renderSetup();
