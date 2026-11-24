// Moe's Dominoes — computer players
// Code: © Corey J Ruff
//
// Beginner : mostly random, sometimes spots an easy score
// Medium   : greedy — best immediate points (Fives) or dump the heaviest tile
// Hard     : one-move look-ahead with suit control and opponent "void" reading
// Expert   : Monte Carlo — deals out the unseen tiles many ways (respecting what
//            each opponent has shown they don't hold) and plays the hand out

import { tileId, isDouble, pips, hasPip } from './tiles.js';
import { place, undoLast, endsTotal, endValues, fivesPointsFor, legalMoves } from './board.js';

export const LEVELS = ['beginner', 'medium', 'hard', 'expert'];
export const LEVEL_NAMES = { beginner: 'Beginner', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

export function chooseMove(game, level = game.current.level) {
  const moves = game.legalMovesFor();
  if (moves.length <= 1) return moves[0] || null;
  switch (level) {
    case 'beginner': return beginner(game, moves);
    case 'medium': return medium(game, moves);
    case 'hard': return hard(game, moves);
    case 'expert': return expert(game, moves);
    default: return medium(game, moves);
  }
}

// ---------- Beginner ----------
function beginner(game, moves) {
  const rng = game.rng;
  if (game.mode.scoresEnds && rng() < 0.4) {
    const scoring = moves.filter((m) => fivesPointsFor(game.board, m) > 0);
    if (scoring.length) return rng.pick(scoring);
  }
  return rng.pick(moves);
}

// ---------- Medium ----------
function medium(game, moves) {
  return bestBy(moves, (m) => mediumScore(game.board, m, game.mode.scoresEnds), game.rng);
}

function mediumScore(board, m, scoresEnds) {
  const dump = pips(m.tile) + (isDouble(m.tile) ? 3 : 0);
  if (scoresEnds) return fivesPointsFor(board, m) * 10 + dump;
  return dump;
}

// ---------- Hard ----------
function hard(game, moves) {
  const s = game.s;
  const me = game.current;
  const nextIdx = (me.idx + 1) % s.players.length;
  const next = s.players[nextIdx];
  const unseen = game.unseenBy(me.idx);
  const nextVoids = new Set(s.voids[nextIdx]);
  const oppPool = unseen.filter((t) => !nextVoids.has(t[0]) && !nextVoids.has(t[1]));
  const q = Math.min(0.95, next.hand.length / Math.max(1, unseen.length));

  return bestBy(moves, (m) => {
    const board = s.board;
    const myPts = game.mode.scoresEnds ? fivesPointsFor(board, m) : 0;
    place(board, m);
    const rest = me.hand.filter((t) => tileId(t) !== tileId(m.tile));
    const ends = endValues(board);
    // Suit control: how many of my remaining tiles can follow
    const follow = rest.filter((t) => ends.some((v) => hasPip(t, v))).length;
    // Next player shut out?
    const shut = ends.length > 0 && ends.every((v) => nextVoids.has(v)) ? 1 : 0;
    // Opponent reply threat (Fives): expected best score they could make next
    let threat = 0;
    if (game.mode.scoresEnds) {
      const replies = [];
      for (const t of oppPool) {
        let best = 0;
        for (const r of legalMoves(board, [t])) best = Math.max(best, fivesPointsFor(board, r));
        if (best) replies.push(best);
      }
      replies.sort((a, b) => b - a);
      let miss = 1;
      for (const r of replies) { threat += r * q * miss; miss *= 1 - q; }
    }
    undoLast(board);
    const dump = pips(m.tile) + (isDouble(m.tile) ? 4 : 0);
    if (game.mode.scoresEnds) return myPts * 1.0 - threat * 0.7 + follow * 1.5 + shut * 4 + dump * 0.25;
    return dump * 1.0 + follow * 2.0 + shut * 6;
  }, game.rng);
}

// ---------- Expert ----------
const EXPERT_PLAYOUTS = 160;

function expert(game, moves) {
  const meIdx = game.s.turn;
  // Pre-screen with the Hard evaluation so the playouts focus on sensible moves.
  const candidates = moves.length > 10 ? topN(game, moves, 10) : moves;
  let best = null, bestVal = -Infinity;
  for (const m of candidates) {
    let total = 0;
    for (let i = 0; i < EXPERT_PLAYOUTS; i++) {
      const sim = determinize(game, meIdx);
      const before = sim.s.players.map((p) => p.score);
      sim.play(m);
      playOut(sim);
      const gained = sim.s.players.map((p, j) => p.score - before[j]);
      const mine = gained[meIdx];
      const theirs = Math.max(...gained.filter((_, j) => j !== meIdx));
      total += mine - theirs + (sim.s.winner === meIdx ? 30 : 0) - (sim.s.gameOver && sim.s.winner !== meIdx && sim.s.winner !== null ? 30 : 0);
    }
    const val = total / EXPERT_PLAYOUTS;
    if (val > bestVal) { bestVal = val; best = m; }
  }
  return best;
}

function topN(game, moves, n) {
  const scored = moves.map((m) => ({ m, v: hardValue(game, m) }));
  scored.sort((a, b) => b.v - a.v);
  return scored.slice(0, n).map((x) => x.m);
}

function hardValue(game, m) {
  // Reuse hard()'s scoring by asking it to rank a single move.
  const board = game.board;
  const pts = game.mode.scoresEnds ? fivesPointsFor(board, m) : 0;
  return pts * 3 + pips(m.tile) + (isDouble(m.tile) ? 4 : 0);
}

/** Deal the tiles `meIdx` can't see into the other hands/boneyard, honouring known voids. */
function determinize(game, meIdx) {
  const sim = game.clone();
  const s = sim.s;
  const rng = game.rng;
  const pool = rng.shuffle(game.unseenBy(meIdx));
  const others = s.players.filter((p) => p.idx !== meIdx);
  const needs = others.map((p) => p.hand.length);
  // Most constrained players pick first.
  const order = others.map((p, i) => i).sort((a, b) => s.voids[others[b].idx].length - s.voids[others[a].idx].length);
  const hands = others.map(() => []);
  for (const i of order) {
    const voids = new Set(s.voids[others[i].idx]);
    for (let k = 0; k < pool.length && hands[i].length < needs[i]; ) {
      const t = pool[k];
      if (!voids.has(t[0]) && !voids.has(t[1])) { hands[i].push(t); pool.splice(k, 1); } else k++;
    }
  }
  // Anyone still short (voids too tight to satisfy) just takes what's left.
  others.forEach((p, i) => { while (hands[i].length < needs[i] && pool.length) hands[i].push(pool.pop()); p.hand = hands[i]; });
  s.boneyard = pool;
  sim.onEvent = null;
  return sim;
}

/** Fast play-out of the rest of the current hand with Medium-style play. */
function playOut(sim) {
  let guard = 400;
  while (!sim.s.handOver && guard-- > 0) {
    const moves = sim.legalMovesFor();
    if (moves.length) {
      const m = moves.length === 1 ? moves[0] : bestBy(moves, (mv) => mediumScore(sim.board, mv, sim.mode.scoresEnds), sim.rng);
      sim.play(m);
    } else if (sim.canDraw()) sim.draw();
    else sim.pass();
  }
}

function bestBy(moves, scoreFn, rng) {
  let best = [], bestV = -Infinity;
  for (const m of moves) {
    const v = scoreFn(m);
    if (v > bestV + 1e-9) { bestV = v; best = [m]; } else if (Math.abs(v - bestV) <= 1e-9) best.push(m);
  }
  return best.length === 1 ? best[0] : rng.pick(best);
}

// Exposed for hints later
export { endsTotal };
