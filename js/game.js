// Moe's Dominoes — game engine (Fives, Block, Draw)
// Code: © Corey J Ruff
//
// Pure rules: no DOM. The UI and the simulation tests both drive this.
// All state lives in `this.s` as plain JSON, so clone() is cheap and safe.

import { makeSet, tileId, isDouble, pips, handPips, makeRng, roundTo5 } from './tiles.js';
import { newBoard, legalMoves, place, endsTotal, endValues } from './board.js';

export const MODES = {
  fives: { name: "Fives", draws: true, scoresEnds: true, defaultTarget: 150 },
  block: { name: 'Block', draws: false, scoresEnds: false, defaultTarget: 100 },
  draw: { name: 'Draw', draws: true, scoresEnds: false, defaultTarget: 100 },
};

export const SPINNER_RULES = {
  first: 'First spinner only',
  all: 'Every double spins',
};

export function handSize(nPlayers, mode) {
  if (mode === 'fives') return 7;                   // Fives: always 7 each
  if (mode === 'block' && nPlayers === 4) return 7; // 4-player Block uses every tile
  return nPlayers === 2 ? 7 : 5;
}

/**
 * opts: { mode, spinnerRule, players:[{name, human, level, personality}], target, seed }
 */
export class Game {
  /**
   * rng     : used only by computer players' decisions
   * dealRng : used only for shuffling. Kept separate so nothing a player does —
   *           or how strong the computer players are — can affect which tiles are dealt.
   */
  constructor(opts, rng, dealRng) {
    if (opts === undefined) return; // used by clone()
    const mode = opts.mode || 'fives';
    this.rng = rng || makeRng(opts.seed ?? Date.now());
    this.dealRng = dealRng || makeRng(((opts.dealSeed ?? opts.seed ?? Date.now()) ^ 0x9e3779b9) >>> 0);
    this.s = {
      mode,
      spinnerRule: mode === 'fives' ? (opts.spinnerRule || 'first') : 'none',
      target: opts.target || MODES[mode].defaultTarget,
      players: opts.players.map((p, i) => ({
        idx: i, name: p.name, human: !!p.human, level: p.level || 'medium',
        personality: p.personality || null, portrait: p.portrait || null, image: p.image || null, rosterId: p.rosterId || null,
        loseImage: p.loseImage || null, score: 0, hand: [],
      })),
      handNo: 0,
      board: newBoard('none'),
      boneyard: [],
      turn: 0,
      leader: null,          // who led this hand
      mustLead: null,        // tile the first hand's leader must play
      passesInRow: 0,
      drewThisTurn: 0,
      handOver: false,
      gameOver: false,
      handResult: null,
      winner: null,
      lastHandWinner: null,
      voids: [],             // per player: pip values they are known not to hold
      handLog: [],           // events this hand
      handPoints: [],        // points scored this hand, per player
      history: [],           // finished hands
    };
  }

  clone() {
    const g = new Game();
    g.s = JSON.parse(JSON.stringify(this.s));
    g.rng = this.rng;
    g.dealRng = this.dealRng;
    return g;
  }

  get mode() { return MODES[this.s.mode]; }
  get players() { return this.s.players; }
  get current() { return this.s.players[this.s.turn]; }
  get board() { return this.s.board; }

  // ---------- hands ----------

  startHand() {
    const s = this.s;
    const n = s.players.length;
    s.handNo++;
    s.board = newBoard(s.spinnerRule);
    const set = this.dealRng.shuffle(makeSet());
    const size = handSize(n, s.mode);
    for (const p of s.players) p.hand = set.splice(0, size);
    s.boneyard = set;
    s.passesInRow = 0;
    s.drewThisTurn = 0;
    s.handOver = false;
    s.handResult = null;
    s.voids = s.players.map(() => []);
    s.handLog = [];
    s.handPoints = s.players.map(() => 0);
    s.mustLead = null;

    // First hand, or a blocked hand tied for low count: highest double leads.
    // Otherwise the last hand's winner (going out, or lowest count when blocked) leads.
    if (s.handNo === 1 || s.lastHandWinner === null) {
      // Highest double leads (and must play it); with no doubles out, the heaviest tile.
      let best = null;
      for (const p of s.players) for (const t of p.hand) {
        const rank = (isDouble(t) ? 100 : 0) + pips(t) * 2 + Math.max(...t) / 10;
        if (!best || rank > best.rank) best = { rank, p: p.idx, t };
      }
      s.turn = best.p;
      s.mustLead = best.t;
    } else {
      s.turn = s.lastHandWinner;
    }
    s.leader = s.turn;
    this.log({ type: 'handStart', handNo: s.handNo, leader: s.turn, mustLead: s.mustLead });
  }

  log(ev) {
    this.s.handLog.push(ev);
    if (this.onEvent) this.onEvent(ev, this);
  }

  // ---------- turn actions ----------

  legalMovesFor(pIdx = this.s.turn) {
    const s = this.s;
    const p = s.players[pIdx];
    const restrict = s.board.nodes.length === 0 && s.mustLead ? s.mustLead : null;
    return legalMoves(s.board, p.hand, restrict);
  }

  canDraw() {
    const s = this.s;
    return this.mode.draws && s.boneyard.length > 0 && this.legalMovesFor().length === 0;
  }

  mustPass() {
    return this.legalMovesFor().length === 0 && !this.canDraw();
  }

  play(move) {
    const s = this.s;
    if (s.handOver) throw new Error('Hand is over');
    const p = this.current;
    const hi = p.hand.findIndex((t) => tileId(t) === tileId(move.tile));
    if (hi < 0) throw new Error(`${p.name} does not hold ${tileId(move.tile)}`);
    const legal = this.legalMovesFor().some((m) =>
      tileId(m.tile) === tileId(move.tile) && m.nodeId === move.nodeId && m.slot === move.slot);
    if (!legal) throw new Error(`Illegal move ${tileId(move.tile)} @ ${move.nodeId}:${move.slot}`);

    if (s.drewThisTurn > 0) {
      // Every tile drawn before this one failed to match, so the whole hand
      // (minus the tile being played) is now void in the current end values.
      s.voids[p.idx] = endValues(s.board);
    }
    p.hand.splice(hi, 1);
    const node = place(s.board, { tile: move.tile, nodeId: move.nodeId, slot: move.slot });
    s.passesInRow = 0;
    let points = 0;
    if (this.mode.scoresEnds) {
      const total = endsTotal(s.board);
      if (total > 0 && total % 5 === 0) points = total;
    }
    this.log({ type: 'play', player: p.idx, tile: move.tile, nodeId: node.id, spinner: node.spinner,
      points, endsTotal: endsTotal(s.board), drew: s.drewThisTurn });
    s.drewThisTurn = 0;
    if (points) {
      p.score += points;
      s.handPoints[p.idx] += points;
      if (p.score >= s.target) return this.endGame(p.idx, 'reachedTarget');
    }
    if (p.hand.length === 0) return this.endHand(p.idx, 'domino');
    this.advance();
    return null;
  }

  draw() {
    const s = this.s;
    if (!this.canDraw()) throw new Error('Cannot draw now');
    const p = this.current;
    const t = s.boneyard.pop();
    p.hand.push(t);
    s.drewThisTurn++;
    this.log({ type: 'draw', player: p.idx, left: s.boneyard.length });
    return t;
  }

  pass() {
    const s = this.s;
    if (!this.mustPass()) throw new Error('Cannot pass with a playable tile');
    const p = this.current;
    const vals = endValues(s.board);
    if (s.drewThisTurn > 0) s.voids[p.idx] = vals;
    else s.voids[p.idx] = [...new Set([...s.voids[p.idx], ...vals])];
    s.drewThisTurn = 0;
    s.passesInRow++;
    this.log({ type: 'pass', player: p.idx, ends: vals });
    if (s.passesInRow >= s.players.length) return this.endHand(null, 'blocked');
    this.advance();
    return null;
  }

  advance() {
    const s = this.s;
    s.turn = (s.turn + 1) % s.players.length;
  }

  // ---------- scoring ----------

  endHand(dominoBy, reason) {
    const s = this.s;
    const counts = s.players.map((p) => handPips(p.hand));
    let winner = dominoBy;
    if (reason === 'blocked') {
      const low = Math.min(...counts);
      const lows = counts.map((c, i) => (c === low ? i : -1)).filter((i) => i >= 0);
      winner = lows.length === 1 ? lows[0] : null; // a tie for low scores nothing
    }
    let award = 0;
    if (winner !== null) {
      const others = counts.reduce((sum, c, i) => (i === winner ? sum : sum + c), 0);
      // Going out scores everyone else's pips. A blocked hand uses the difference
      // method: the low count scores the others' pips minus their own.
      award = reason === 'blocked' ? Math.max(0, others - counts[winner]) : others;
      if (s.mode === 'fives') award = roundTo5(award);
      s.players[winner].score += award;
      s.handPoints[winner] += award;
    }
    s.handOver = true;
    s.lastHandWinner = winner;
    s.lastHandBlocked = reason === 'blocked';
    s.handResult = { reason, winner, award, counts, hands: s.players.map((p) => p.hand.map((t) => [...t])),
      handPoints: [...s.handPoints], handNo: s.handNo };
    s.history.push({ ...s.handResult, scores: s.players.map((p) => p.score) });
    this.log({ type: 'handEnd', ...s.handResult });

    const top = Math.max(...s.players.map((p) => p.score));
    if (top >= s.target) {
      const leaders = s.players.filter((p) => p.score === top);
      // Ties at the target: the hand winner takes it if tied, otherwise play on.
      if (leaders.length === 1) return this.endGame(leaders[0].idx, 'target');
      if (winner !== null && leaders.some((p) => p.idx === winner)) return this.endGame(winner, 'target');
    }
    return s.handResult;
  }

  endGame(winnerIdx, reason) {
    const s = this.s;
    s.handOver = true;
    s.gameOver = true;
    s.winner = winnerIdx;
    if (!s.handResult) {
      const counts = s.players.map((p) => handPips(p.hand));
      s.handResult = { reason, winner: winnerIdx, award: 0, counts,
        hands: s.players.map((p) => p.hand.map((t) => [...t])), handPoints: [...s.handPoints], handNo: s.handNo };
      s.history.push({ ...s.handResult, scores: s.players.map((p) => p.score) });
    }
    this.log({ type: 'gameEnd', winner: winnerIdx, reason, scores: s.players.map((p) => p.score) });
    return s.handResult;
  }

  // ---------- information a player is allowed to see ----------

  /** Tiles a given player cannot see (other hands + boneyard). */
  unseenBy(pIdx) {
    const s = this.s;
    const seen = new Set(s.players[pIdx].hand.map(tileId));
    for (const n of s.board.nodes) seen.add(tileId(n.tile));
    return makeSet().filter((t) => !seen.has(tileId(t)));
  }
}
