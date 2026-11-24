// Plays many games with a computer "you" and reports how often each achievement counts.
// node tests/achievements.mjs [games]
import { Game } from '../js/game.js';
import { chooseMove } from '../js/ai.js';
import { makeRng } from '../js/tiles.js';
import { GameTracker, commitGame, loadRecord, ACHIEVEMENTS, progressOf } from '../js/achievements.js';

const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
const N = Number(process.argv[2] || 300);
const levels = ['beginner', 'medium', 'hard', 'expert'];
let medals = 0;
for (let i = 0; i < N; i++) {
  const mode = ['fives', 'block', 'draw'][i % 3];
  const n = 2 + (i % 3);
  const players = [{ name: 'You', human: true, level: 'hard' }];
  const names = ['moe', 'eyton', 'nala'];
  for (let k = 1; k < n; k++) players.push({ name: names[k - 1], rosterId: names[k - 1], level: levels[(i + k) % 4] });
  const g = new Game({ mode, spinnerRule: i % 2 ? 'all' : 'first', players, target: mode === 'fives' ? 150 : 100 }, makeRng(i + 1), makeRng(i * 31 + 7));
  let tr = null;
  g.onEvent = (ev, game) => { if (tr) tr.onEvent(ev, game); };
  tr = new GameTracker(g, 0);
  while (!g.s.gameOver) {
    g.startHand();
    while (!g.s.handOver) { if (g.legalMovesFor().length) g.play(chooseMove(g, g.current.level)); else if (g.canDraw()) g.draw(); else g.pass(); }
  }
  medals += commitGame(tr, g, mem).length;
}
const rec = loadRecord(mem);
console.log(`${N} games, ${medals} medals earned, wins ${rec.life.wins}`);
for (const a of ACHIEVEMENTS) console.log(`${String(progressOf(rec, a)).padStart(6)}  ${'★'.repeat(rec.earned[a.id] || 0).padEnd(5)}  ${a.name}`);
