// Moe's Dominoes — the line of play (a tree of placed tiles)
// Code: © Corey J Ruff
//
// The board is plain JSON so it can be cloned for AI simulations and saved.
// Each node records how it connects; the visual layout (layout.js) is worked
// out separately from this list, so the table can re-flow when the screen changes.
//
// Slots:
//   root  : 'E' and 'W' along the line, plus 'N' and 'S' if the root is a spinner
//   child : 'F' (forward), plus 'L' and 'R' if the child is a spinner
// A spinner's side slots ('N'/'S' or 'L'/'R') open only once its line slots are filled.

import { isDouble, otherPip } from './tiles.js';

/** spinnerRule: 'none' (Block/Draw), 'first' (only first double spins), 'all' (every double spins) */
export function newBoard(spinnerRule = 'none') {
  return { nodes: [], spinnerRule, spinnerCount: 0 };
}

export const rootSlots = (n) => (n.spinner ? ['E', 'W', 'N', 'S'] : ['E', 'W']);
export const childSlots = (n) => (n.spinner ? ['F', 'L', 'R'] : ['F']);

function slotsOf(node) {
  return node.parent === null ? rootSlots(node) : childSlots(node);
}

/** Pip showing at a slot of a node. */
function slotValue(node, slot) {
  if (node.parent === null) {
    if (slot === 'W') return node.tile[0];
    if (slot === 'E') return node.tile[1];
    return node.tile[0]; // N/S only exist on a double
  }
  return node.outPip; // F, L, R all show the outer pip (L/R only on doubles)
}

function slotIsOpen(node, slot) {
  if (node.children[slot] != null) return false;
  if (node.parent === null) {
    if (slot === 'N' || slot === 'S') return node.children.E != null && node.children.W != null;
    return true;
  }
  if (slot === 'L' || slot === 'R') return node.children.F != null;
  return true;
}

/** All open ends: [{ nodeId, slot, value }] */
export function openEnds(board) {
  const ends = [];
  for (const n of board.nodes) {
    for (const slot of slotsOf(n)) {
      if (slotIsOpen(n, slot)) ends.push({ nodeId: n.id, slot, value: slotValue(n, slot) });
    }
  }
  return ends;
}

/** Distinct pip values currently playable on. */
export function endValues(board) {
  return [...new Set(openEnds(board).map((e) => e.value))];
}

/** Legal moves for a hand: [{ tile, nodeId, slot }]. Empty board → any tile (nodeId null). */
export function legalMoves(board, hand, restrictTo = null) {
  const pool = restrictTo ? hand.filter((t) => t[0] === restrictTo[0] && t[1] === restrictTo[1]) : hand;
  if (board.nodes.length === 0) return pool.map((tile) => ({ tile, nodeId: null, slot: null }));
  const ends = openEnds(board);
  const moves = [];
  for (const tile of pool) {
    const seen = new Set();
    for (const e of ends) {
      if (tile[0] !== e.value && tile[1] !== e.value) continue;
      // Same tile on two ends showing the same value at the same kind of spot
      // gives different layouts, so keep them all — the player chooses.
      const key = `${e.nodeId}:${e.slot}`;
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push({ tile, nodeId: e.nodeId, slot: e.slot });
    }
  }
  return moves;
}

/** Place a tile. Returns the new node. Mutates board. */
export function place(board, move) {
  const { tile } = move;
  const dbl = isDouble(tile);
  const id = board.nodes.length;
  let spinner = false;
  if (dbl && board.spinnerRule === 'all') spinner = true;
  if (dbl && board.spinnerRule === 'first' && board.spinnerCount === 0) spinner = true;
  if (spinner) board.spinnerCount++;

  if (move.nodeId === null || board.nodes.length === 0) {
    const node = {
      id, tile: [Math.min(...tile), Math.max(...tile)], double: dbl, spinner,
      parent: null, slot: null, inPip: null, outPip: null, children: {},
    };
    board.nodes.push(node);
    return node;
  }
  const parent = board.nodes[move.nodeId];
  const value = slotValue(parent, move.slot);
  if (!slotIsOpen(parent, move.slot)) throw new Error('Slot not open');
  if (tile[0] !== value && tile[1] !== value) throw new Error(`Tile ${tile} does not match ${value}`);
  const node = {
    id, tile: [tile[0], tile[1]], double: dbl, spinner,
    parent: parent.id, slot: move.slot, inPip: value, outPip: otherPip(tile, value), children: {},
  };
  parent.children[move.slot] = id;
  board.nodes.push(node);
  return node;
}

/**
 * All Fives count: the sum of the outer pips on every open line end.
 * A double sitting at an end counts both halves. Empty spinner sides don't count.
 */
export function endsTotal(board) {
  if (board.nodes.length === 0) return 0;
  let total = 0;
  for (const n of board.nodes) {
    if (n.parent === null) {
      const eOpen = n.children.E == null, wOpen = n.children.W == null;
      if (n.double) {
        if (eOpen || wOpen) total += n.tile[0] * 2; // counted once even if both sides are open
      } else {
        if (wOpen) total += n.tile[0];
        if (eOpen) total += n.tile[1];
      }
    } else if (n.children.F == null) {
      total += n.double ? n.outPip * 2 : n.outPip;
    }
  }
  return total;
}

/** Points a Fives play would score (without changing the board). */
export function fivesPointsFor(board, move) {
  place(board, move);
  const t = endsTotal(board);
  undoLast(board);
  return t > 0 && t % 5 === 0 ? t : 0;
}

/** Remove the most recently placed tile (used for look-ahead). */
export function undoLast(board) {
  const n = board.nodes.pop();
  if (!n) return;
  if (n.spinner) board.spinnerCount--;
  if (n.parent !== null) delete board.nodes[n.parent].children[n.slot];
}

export const cloneBoard = (b) => JSON.parse(JSON.stringify(b));
