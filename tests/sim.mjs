// Engine soak test: plays thousands of computer-only games and checks invariants.
// Run from the project folder:  node tests/sim.mjs  [gamesPerConfig]
// Code: © Corey J Ruff

import { Game } from '../js/game.js';
import { chooseMove } from '../js/ai.js';
import { makeRng, tileId } from '../js/tiles.js';
import { endsTotal, openEnds } from '../js/board.js';
import { layoutBoard, overlaps } from '../js/layout.js';

const N = Number(process.argv[2] || 200);
let failures = 0;
const fail = (msg) => { failures++; if (failures < 20) console.error('FAIL:', msg); };

function runGame(cfg, seed) {
  const rng = makeRng(seed);
  const g = new Game({ ...cfg, seed }, rng);
  let hands = 0, overlapTiles = 0, placed = 0;
  while (!g.s.gameOver && hands < 60) {
    g.startHand();
    hands++;
    let guard = 500;
    while (!g.s.handOver && guard-- > 0) {
      // Invariant: 28 tiles accounted for
      const all = [...g.s.boneyard, ...g.s.players.flatMap((p) => p.hand), ...g.s.board.nodes.map((n) => n.tile)];
      if (all.length !== 28 || new Set(all.map(tileId)).size !== 28) fail(`tile count ${all.length} seed ${seed}`);
      const moves = g.legalMovesFor();
      if (moves.length) {
        const before = g.current.score;
        const m = chooseMove(g, g.current.level);
        const who = g.current;
        g.play(m);
        const gained = who.score - before;
        if (cfg.mode === 'fives' && gained % 5 !== 0) fail(`non-multiple-of-5 score ${gained}`);
        if (cfg.mode !== 'fives' && !g.s.handOver && gained !== 0) fail('points mid-hand outside Fives');
      } else if (g.canDraw()) g.draw();
      else g.pass();
    }
    if (guard <= 0) fail(`hand did not finish seed ${seed}`);
    const lay = layoutBoard(g.s.board, 1.7);
    placed += g.s.board.nodes.length;
    overlapTiles += overlaps(lay);
  }
  if (!g.s.gameOver) fail(`game did not finish seed ${seed}`);
  return { winner: g.s.winner, hands, overlapTiles, placed };
}

const configs = [];
for (const mode of ['fives', 'block', 'draw']) {
  const rules = mode === 'fives' ? ['first', 'all'] : [null];
  for (const spinnerRule of rules) for (const n of [2, 3, 4]) configs.push({ mode, spinnerRule, n });
}

const t0 = Date.now();
for (const c of configs) {
  let hands = 0, ov = 0, placed = 0;
  for (let i = 0; i < N; i++) {
    const players = Array.from({ length: c.n }, (_, k) => ({ name: `P${k}`, level: ['beginner', 'medium', 'hard'][k % 3] }));
    const r = runGame({ mode: c.mode, spinnerRule: c.spinnerRule, players }, 1000 + i);
    hands += r.hands; ov += r.overlapTiles; placed += r.placed;
  }
  console.log(`${c.mode.padEnd(5)} ${String(c.spinnerRule || '').padEnd(5)} ${c.n}p  avg hands/game ${(hands / N).toFixed(1)}  overlapping tiles ${(100 * ov / Math.max(1, placed)).toFixed(2)}%`);
}

// Strength ladder: each level head-to-head vs the one below (2 players)
const ladder = [['medium', 'beginner'], ['hard', 'medium'], ['expert', 'hard']];
const H2H = Math.max(20, Math.floor(N / 4));
for (const mode of ['fives', 'block', 'draw']) {
  for (const [a, b] of ladder) {
    let wins = 0;
    for (let i = 0; i < H2H; i++) {
      const swap = i % 2;
      const players = swap ? [{ name: 'B', level: b }, { name: 'A', level: a }] : [{ name: 'A', level: a }, { name: 'B', level: b }];
      const r = runGame({ mode, spinnerRule: 'first', players }, 5000 + i);
      if (r.winner === (swap ? 1 : 0)) wins++;
    }
    console.log(`${mode.padEnd(5)} ${a} beats ${b}: ${(100 * wins / H2H).toFixed(0)}% of ${H2H}`);
  }
}

// Fives scoring spot checks
{
  const g = new Game({ mode: 'fives', spinnerRule: 'first', players: [{ name: 'a' }, { name: 'b' }] }, makeRng(1));
  const b = g.s.board;
  const { place } = await import('../js/board.js');
  b.spinnerRule = 'first';
  place(b, { tile: [5, 5], nodeId: null });          // 5-5 alone = 10
  if (endsTotal(b) !== 10) fail(`5-5 alone should be 10, got ${endsTotal(b)}`);
  place(b, { tile: [5, 0], nodeId: 0, slot: 'E' }); // 0 + 10 = 10
  if (endsTotal(b) !== 10) fail(`5-5 + 5-0 should be 10, got ${endsTotal(b)}`);
  if (openEnds(b).some((e) => e.slot === 'N')) fail('spinner sides opened too early');
  place(b, { tile: [5, 3], nodeId: 0, slot: 'W' }); // 0 + 3 = 3
  if (endsTotal(b) !== 3) fail(`expected 3, got ${endsTotal(b)}`);
  if (!openEnds(b).some((e) => e.slot === 'N')) fail('spinner sides should be open');
  place(b, { tile: [5, 2], nodeId: 0, slot: 'N' }); // 0+3+2 = 5
  if (endsTotal(b) !== 5) fail(`expected 5, got ${endsTotal(b)}`);
}

// Deals must not depend on who is playing or how well: same deal seed, different
// levels → identical tiles dealt every hand, for as long as both games last.
{
  for (let seed = 1; seed <= 200; seed++) {
    const deals = (level) => {
      const g = new Game({ mode: 'draw', players: [{ name: 'a', level }, { name: 'b', level }, { name: 'c', level }], dealSeed: seed }, makeRng(seed * 7 + level.length));
      const out = [];
      for (let h = 0; h < 4 && !g.s.gameOver; h++) {
        g.startHand();
        out.push(JSON.stringify([g.s.players.map((p) => p.hand), g.s.boneyard]));
        while (!g.s.handOver) { if (g.legalMovesFor().length) g.play(chooseMove(g)); else if (g.canDraw()) g.draw(); else g.pass(); }
      }
      return out;
    };
    const a = deals('beginner'), b = deals('expert');
    for (let h = 0; h < Math.min(a.length, b.length); h++) if (a[h] !== b[h]) { fail(`deal ${h} differs by level, seed ${seed}`); break; }
  }
}

console.log(`\n${failures ? failures + ' FAILURES' : 'All checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failures ? 1 : 0);
