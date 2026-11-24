// Head-to-head strength check: node tests/ladder.mjs mode levelA levelB games [players]
import { Game } from '../js/game.js';
import { chooseMove } from '../js/ai.js';
import { makeRng } from '../js/tiles.js';
const [mode='block', a='hard', b='medium', n='200', np='2'] = process.argv.slice(2);
let wins = 0;
for (let i = 0; i < +n; i++) {
  const seat = i % +np;
  const players = Array.from({ length: +np }, (_, k) => ({ name: 'p' + k, level: k === seat ? a : b }));
  const g = new Game({ mode, spinnerRule: 'first', players }, makeRng(777 + i));
  while (!g.s.gameOver) {
    g.startHand();
    while (!g.s.handOver) {
      if (g.legalMovesFor().length) g.play(chooseMove(g)); else if (g.canDraw()) g.draw(); else g.pass();
    }
  }
  if (g.s.winner === seat) wins++;
}
console.log(`${mode} ${np}p: ${a} won ${(100 * wins / n).toFixed(1)}% vs ${b} (fair share ${(100/np).toFixed(0)}%)`);
