// Moe's Dominoes — UI controller
// Code: © Corey J Ruff

import { Game, MODES, SPINNER_RULES } from './game.js';
import { chooseMove, LEVELS, LEVEL_NAMES } from './ai.js';
import { openEnds, endsTotal } from './board.js';
import { layoutBoard, previewPlacement } from './layout.js';
import { el, addDefs, drawTile, tileSvg, THEMES } from './render.js';
import { tileId, handPips, makeRng } from './tiles.js';
import { loadSetup, saveSetup, loadStats, recordGame, resetStats, variantKey } from './stats.js';

const $ = (id) => document.getElementById(id);
const theme = THEMES.classic;

const MODE_HINTS = {
  fives: 'Score when the open ends add up to a multiple of 5. Draw when stuck. Doubles become spinners.',
  block: 'No drawing — pass when stuck. First out scores everyone else’s pips.',
  draw: 'Draw from the boneyard until you can play. First out scores everyone else’s pips.',
};
const TARGETS = { fives: [61, 100, 150, 200, 250], block: [50, 100, 150, 200], draw: [50, 100, 150, 200] };
const DEFAULT_CPUS = [
  { name: 'Moe', level: 'medium' }, { name: 'Lou', level: 'medium' }, { name: 'Dot', level: 'medium' },
];

let setup = Object.assign({
  mode: 'fives', spinnerRule: 'first', players: 2, target: 150, name: 'You', cpus: DEFAULT_CPUS,
}, loadSetup() || {});

let game = null;
let selected = null;       // tileId of the tile the human picked
let busy = false;          // computer is thinking / animating
let lastNodeCount = 0;
let recorded = false;
let passed = new Set();    // who passed since the last play (for the seat badges)
let allPlays = [];         // every play this game, for best-play stats

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

  const list = $('cpuList');
  list.innerHTML = '';
  for (let i = 0; i < setup.players - 1; i++) {
    const c = setup.cpus[i] || (setup.cpus[i] = { ...DEFAULT_CPUS[i] });
    const row = document.createElement('div'); row.className = 'cpu-row';
    const inp = document.createElement('input'); inp.value = c.name; inp.maxLength = 14;
    inp.oninput = () => { c.name = inp.value.trim() || DEFAULT_CPUS[i].name; };
    const lv = document.createElement('select');
    for (const l of LEVELS) { const o = document.createElement('option'); o.value = l; o.textContent = LEVEL_NAMES[l]; lv.appendChild(o); }
    lv.value = c.level; lv.onchange = () => { c.level = lv.value; };
    row.append(inp, lv); list.appendChild(row);
  }
}

$('btnStart').onclick = () => { saveSetup(setup); startGame(); };
$('btnStats').onclick = () => showStats();
$('btnAbout').onclick = () => showAbout();

function showAbout() {
  showOverlay(`<div class="about">
    <img class="about-img" src="assets/about-moe.webp" alt="Moe playing dominoes in a riverboat saloon">
    <h2 style="text-align:center">Moe's Dominoes</h2>
    <p>Named for Morgan — “Moe” — our tuxedo cat.</p>
    <p style="font-size:13px;opacity:.7">Code: © Corey J Ruff</p>
  </div><div class="buttons"><button class="btn primary" id="aBack">Back</button></div>`);
  $('aBack').onclick = () => (game ? showMenu() : hideOverlay());
}

// =====================================================================
// Game flow
// =====================================================================
function startGame() {
  const players = [{ name: setup.name || 'You', human: true }];
  for (let i = 0; i < setup.players - 1; i++) players.push({ name: setup.cpus[i].name, level: setup.cpus[i].level });
  game = new Game({ mode: setup.mode, spinnerRule: setup.spinnerRule, players, target: setup.target }, makeRng(Date.now()));
  game.onEvent = onEvent;
  recorded = false;
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

function humanPlay(move) {
  if (busy) return;
  busy = true;
  selected = null;
  game.play(move);
  render();
  setTimeout(step, 250);
}

function onEvent(ev, g) {
  const s = g.s;
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
  renderSeats();
  renderBoard();
  renderHand();
}

function renderSeats() {
  const s = game.s;
  const seats = $('seats');
  seats.innerHTML = '';
  for (const p of s.players) {
    const d = document.createElement('div');
    d.className = 'seat' + (p.idx === s.turn && !s.handOver ? ' turn' : '') + (passed.has(p.idx) ? ' passed' : '');
    d.innerHTML = `<span class="nm"></span>${p.human ? '' : `<span class="lv">${LEVEL_NAMES[p.level]}</span>`}<span class="ct">${p.hand.length}▮</span><span class="sc">${p.score}</span>`;
    d.querySelector('.nm').textContent = p.human ? (p.name || 'You') : p.name;
    seats.appendChild(d);
  }
  const ends = s.mode === 'fives' && s.board.nodes.length ? ` · Ends <b>${endsTotal(s.board)}</b>` : '';
  const bone = MODES[s.mode].draws ? ` · Boneyard <b>${s.boneyard.length}</b>` : '';
  $('info').innerHTML = `${MODES[s.mode].name}${s.mode === 'fives' ? (s.spinnerRule === 'all' ? ' (all spin)' : '') : ''} to ${s.target} · Hand ${s.handNo}${ends}${bone}`;
  const me = s.players.find((p) => p.human);
  $('me').className = s.turn === me.idx && !s.handOver ? 'turn' : '';
  $('me').innerHTML = `<span class="nm"></span><span class="sc">${me.score}</span>`;
  $('me').querySelector('.nm').textContent = me.name;
}

function renderBoard() {
  const s = game.s;
  const svg = $('board');
  const box = $('table').getBoundingClientRect();
  const aspect = box.width / Math.max(1, box.height);
  const lay = layoutBoard(s.board, aspect);
  svg.innerHTML = '';
  addDefs(svg, theme);

  // Targets for the selected tile
  const ghosts = [];
  const me = game.current;
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
    grp.addEventListener('click', () => humanPlay(g.m));
    grp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') humanPlay(g.m); });
  });
}

function pointsIf(m) {
  const sim = game.clone();
  sim.onEvent = null;
  const before = sim.current.score;
  try { sim.play(m); } catch { return 0; }
  return sim.s.players[game.s.turn].score - before;
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
    svg.addEventListener('click', () => onHandTile(t, moves));
    hand.appendChild(svg);
  }
  // Size tiles so the whole hand fits on one row (phones, big draws)
  const n = sorted.length || 1;
  const gap = parseFloat(getComputedStyle(hand).columnGap) || 6;
  const availW = hand.clientWidth - gap * (n - 1) - 10;
  const hgt = Math.max(40, Math.min(hand.clientHeight - 14, 128, availW / (n * 0.545)));
  for (const t of hand.children) t.style.height = `${hgt}px`;
  const canDraw = myTurn && game.canDraw();
  const mustPass = myTurn && !moves.length && !canDraw;
  $('btnDraw').classList.toggle('hidden', !MODES[s.mode].draws);
  $('btnDraw').disabled = !canDraw;
  $('btnDraw').classList.toggle('pulse', canDraw);
  $('btnDraw').textContent = `Draw (${s.boneyard.length})`;
  $('btnPass').disabled = !mustPass;
  $('btnPass').classList.toggle('pulse', mustPass);
}

function onHandTile(t, moves) {
  if (busy) return;
  const id = tileId(t);
  const mine = moves.filter((m) => tileId(m.tile) === id);
  if (!mine.length) {
    const node = [...$('hand').children].find((n) => n.getAttribute('aria-label') === `${t[0]}-${t[1]}`);
    if (node) { node.classList.remove('shake'); void node.getBBox; node.classList.add('shake'); }
    return;
  }
  // Only one place it can go (or same spot either way) → just play it.
  if (mine.length === 1) return humanPlay(mine[0]);
  selected = selected === id ? null : id;
  status(selected ? 'Tap a highlighted spot to place it.' : 'Your turn.');
  render();
}

$('btnDraw').onclick = () => {
  if (busy || !game.canDraw()) return;
  const t = game.draw();
  status(`You drew the ${t[0]}-${t[1]}.`);
  render();
  if (!game.legalMovesFor().length && !game.canDraw()) status('Still nothing to play — pass.');
};
$('btnPass').onclick = () => {
  if (busy || !game.mustPass()) return;
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
  if (r.reason === 'domino') return `${w.human ? 'You' : esc(w.name)} dominoed${r.award ? ` for ${r.award}` : ''}!`;
  if (r.reason === 'blocked') return w ? `Blocked — ${w.human ? 'you have' : esc(w.name) + ' has'} the low count (+${r.award})` : 'Blocked — tie for low count, no points';
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
  }
  const head = s.winner === null ? 'Game over' : w.human ? 'You win! 🎉' : `${esc(w.name)} wins`;
  showOverlay(`<h2>${head}</h2><p>${r.reason === 'reachedTarget' ? 'Reached the target on a scoring play.' : handHeadline(r)}</p>${resultTable(r)}
    <div class="buttons"><button class="btn primary" id="btnAgain">Play again</button><button class="btn" id="btnSetup">Setup</button><button class="btn" id="btnSt">Stats</button></div>`);
  fillMiniHands(r);
  $('btnAgain').onclick = () => startGame();
  $('btnSetup').onclick = () => toSetup();
  $('btnSt').onclick = () => showStats(true);
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
      <button class="btn" id="mRules">How to play</button>
      <button class="btn" id="mStats">Stats</button>
      <button class="btn" id="mAbout">About</button>
      <button class="btn" id="mQuit">Quit game</button>
    </div>`);
  $('mResume').onclick = hideOverlay;
  $('mRules').onclick = showRules;
  $('mStats').onclick = () => showStats(true);
  $('mAbout').onclick = showAbout;
  $('mQuit').onclick = () => { if (confirm('Quit this game? It won’t count in your stats.')) toSetup(); };
}
$('btnMenu').onclick = showMenu;

function showRules() {
  showOverlay(`<h2>How to play</h2><div class="rules">
    <h3>Every game</h3><p>Match a tile to an open end of the line. On the first hand the highest double leads; after that, the last hand's winner leads with anything. Tap a glowing tile to play it — if it fits in more than one place, tap the highlighted spot.</p>
    <h3>Fives</h3><p>After you play, add up the open ends. A double at an end counts both halves. If the total is a multiple of 5 you score it. Stuck? Draw until you can play. Going out scores everyone else's pips, rounded to the nearest 5. A blocked hand goes to the lowest count.</p>
    <p><b>First spinner only:</b> the first double played can be played off all four sides (once both its long sides are covered). <b>Every double spins:</b> every double opens its two sides once the line runs past it.</p>
    <h3>Block</h3><p>No boneyard. If you can't play, you pass. First out — or the lowest count when everyone is stuck — scores all the other players' pips.</p>
    <h3>Draw</h3><p>Like Block, but you draw from the boneyard until you can play.</p>
  </div><div class="buttons"><button class="btn primary" id="rBack">Back</button></div>`);
  $('rBack').onclick = () => (game ? showMenu() : hideOverlay());
}

function showStats(fromGame = false) {
  const st = loadStats();
  const label = { 'fives-first': 'Fives · first spinner', 'fives-all': 'Fives · all spin', block: 'Block', draw: 'Draw' };
  const rows = Object.keys(label).map((k) => {
    const t = st.totals[k];
    if (!t) return `<tr><td>${label[k]}</td><td class="num" colspan="5" style="opacity:.6">not played yet</td></tr>`;
    return `<tr><td>${label[k]}</td><td class="num">${t.played}</td><td class="num">${t.won}</td><td class="num">${Math.round(100 * t.won / t.played)}%</td><td class="num">${t.bestStreak}</td><td class="num">${k.startsWith('fives') ? t.bestPlay : t.dominoes}</td></tr>`;
  }).join('');
  showOverlay(`<h2>Stats</h2>
    <table class="res-table"><tr><th>Game</th><th class="num">Played</th><th class="num">Won</th><th class="num">Win %</th><th class="num">Best streak</th><th class="num">Best play / dominoes</th></tr>${rows}</table>
    <p style="font-size:13px;opacity:.75">Player profiles, per-opponent records and achievements arrive in later sessions.</p>
    <div class="buttons"><button class="btn primary" id="sBack">Back</button><button class="btn" id="sReset">Reset stats</button></div>`);
  $('sBack').onclick = () => (fromGame && game && !game.s.gameOver ? showMenu() : game && game.s.gameOver ? showGameOver() : hideOverlay());
  $('sReset').onclick = () => { if (confirm('Erase all stats?')) { resetStats(); showStats(fromGame); } };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Re-flow the table when the window or phone rotates
let rz = null;
new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => game && renderBoard(), 60); }).observe($('table'));

renderSetup();
