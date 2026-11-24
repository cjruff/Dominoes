// Moe's Dominoes — table layout
// Code: © Corey J Ruff
//
// Turns the line of play into rectangles. Units: a tile is 2 long × 1 wide.
// The whole layout is recomputed from the play order every time, using the
// board area's shape (aspect = width / height), so the line re-flows when the
// window or phone rotates, and the renderer scales the result to fit.
//
// Line arms "snake" in bands: the east arm runs right, turns down, runs back
// left, and so on; the west arm mirrors it upward. Spinner arms make a
// pinwheel (each turns clockwise once at the edge). Anything that would
// overlap tries the other directions first.

const DIRS = { E: { x: 1, y: 0 }, W: { x: -1, y: 0 }, N: { x: 0, y: -1 }, S: { x: 0, y: 1 } };
const CW = { E: 'S', S: 'W', W: 'N', N: 'E' };
const CCW = { E: 'N', N: 'W', W: 'S', S: 'E' };
const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };
const horiz = (d) => d === 'E' || d === 'W';

function pt(A, d, s) { const v = DIRS[d]; return { x: A.x + v.x * s, y: A.y + v.y * s }; }

/** Rectangle covering A + u*[s0,s1] + v*[t0,t1] */
function rectFrom(A, u, s0, s1, v, t0, t1) {
  const U = DIRS[u], V = DIRS[v];
  const xs = [], ys = [];
  for (const s of [s0, s1]) for (const t of [t0, t1]) {
    xs.push(A.x + U.x * s + V.x * t);
    ys.push(A.y + U.y * s + V.y * t);
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const hit = (a, b) => a.x0 < b.x1 - 0.02 && b.x0 < a.x1 - 0.02 && a.y0 < b.y1 - 0.02 && b.y0 < a.y1 - 0.02;
const union = (a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

export function limitsFor(aspect) {
  const a = Math.max(0.45, Math.min(2.6, aspect || 1.6));
  return {
    HX: Math.max(4, Math.min(11, Math.round(a * 5))),
    HY: Math.max(3, Math.min(10, Math.round(6 / a))),
  };
}

function exceeds(rect, d, lim) {
  return horiz(d) ? rect.x1 > lim.HX + 0.01 || rect.x0 < -lim.HX - 0.01
    : rect.y1 > lim.HY + 0.01 || rect.y0 < -lim.HY - 0.01;
}

/** Geometry of a tile entering at exit {A, D} heading c. */
function geometry(exit, c, dbl, inPip, outPip) {
  const { A, D } = exit;
  if (dbl) {
    const p = CW[c];
    const h1 = rectFrom(A, c, 0, 1, p, -1, 0), h2 = rectFrom(A, c, 0, 1, p, 0, 1);
    const center = pt(A, c, 0.5);
    return {
      rect: union(h1, h2), halves: [{ rect: h1, pip: inPip }, { rect: h2, pip: outPip }],
      exits: { F: { A: pt(A, c, 1), D: c }, L: { A: pt(center, CCW[c], 1), D: CCW[c] }, R: { A: pt(center, CW[c], 1), D: CW[c] } },
    };
  }
  if (c === D) {
    const p = CW[c];
    const inner = rectFrom(A, c, 0, 1, p, -0.5, 0.5), outer = rectFrom(A, c, 1, 2, p, -0.5, 0.5);
    return { rect: union(inner, outer), halves: [{ rect: inner, pip: inPip }, { rect: outer, pip: outPip }],
      exits: { F: { A: pt(A, c, 2), D: c } } };
  }
  // Corner: the tile turns, its first half sitting just past the parent's end.
  const inner = rectFrom(A, D, 0, 1, c, -0.5, 0.5), outer = rectFrom(A, D, 0, 1, c, 0.5, 1.5);
  return { rect: union(inner, outer), halves: [{ rect: inner, pip: inPip }, { rect: outer, pip: outPip }],
    exits: { F: { A: pt(pt(A, D, 0.5), c, 1.5), D: c } } };
}

/** Choose a heading and geometry for a tile placed at `exit`. */
function placeAt(exit, dbl, inPip, outPip, rects, lim) {
  const { D, arm } = exit;
  let want = D;
  const straight = geometry(exit, D, dbl, inPip, outPip);
  if (!dbl) {
    if (arm.mode === 'band') {
      if (arm.crossStep) want = arm.nextMain;
      else if (exceeds(straight.rect, D, lim)) want = arm.cross;
    } else {
      // Spiral arms turn clockwise at each edge, each lap a little further out.
      const t = arm.turns || 0;
      if (exceeds(straight.rect, D, { HX: lim.HX + 2.5 * t, HY: lim.HY + 2.5 * t })) want = CW[D];
    }
  }
  const order = dbl ? [D] : [...new Set([want, D, CW[D], CCW[D]])].filter((c) => c !== OPP[D]);
  let chosen = null;
  for (const c of order) {
    const g = c === D ? straight : geometry(exit, c, dbl, inPip, outPip);
    if (!rects.some((r) => hit(r, g.rect))) { chosen = { c, g }; break; }
  }
  if (!chosen) chosen = { c: want, g: want === D ? straight : geometry(exit, want, dbl, inPip, outPip) };

  // Carry the arm's snaking state forward
  const c = chosen.c;
  let next;
  if (arm.mode === 'band') {
    if (!arm.crossStep && c === arm.cross) next = { ...arm, crossStep: true, nextMain: OPP[arm.main] };
    else if (arm.crossStep && c === arm.nextMain) next = { ...arm, crossStep: false, main: c };
    else if (c === D) next = arm;
    else next = { mode: 'spiral', turns: 1 };
  } else next = c === D ? arm : { ...arm, turns: (arm.turns || 0) + 1 };

  const exits = { F: { ...chosen.g.exits.F, arm: next } };
  if (chosen.g.exits.L) {
    exits.L = { ...chosen.g.exits.L, arm: { mode: 'spiral', turns: 0 } };
    exits.R = { ...chosen.g.exits.R, arm: { mode: 'spiral', turns: 0 } };
  }
  return { rect: chosen.g.rect, halves: chosen.g.halves, exits, heading: c };
}

function rootGeometry(node) {
  const [a, b] = node.tile;
  if (node.double) {
    const h1 = { x0: -0.5, y0: -1, x1: 0.5, y1: 0 }, h2 = { x0: -0.5, y0: 0, x1: 0.5, y1: 1 };
    const spiral = { mode: 'spiral', turns: 0 };
    const band = (main, cross) => (node.spinner ? spiral : { mode: 'band', main, cross, crossStep: false });
    return {
      rect: union(h1, h2), halves: [{ rect: h1, pip: a }, { rect: h2, pip: b }],
      exits: {
        E: { A: { x: 0.5, y: 0 }, D: 'E', arm: band('E', 'S') }, W: { A: { x: -0.5, y: 0 }, D: 'W', arm: band('W', 'N') },
        N: { A: { x: 0, y: -1 }, D: 'N', arm: spiral }, S: { A: { x: 0, y: 1 }, D: 'S', arm: spiral },
      },
    };
  }
  const h1 = { x0: -1, y0: -0.5, x1: 0, y1: 0.5 }, h2 = { x0: 0, y0: -0.5, x1: 1, y1: 0.5 };
  return {
    rect: union(h1, h2), halves: [{ rect: h1, pip: a }, { rect: h2, pip: b }],
    exits: {
      E: { A: { x: 1, y: 0 }, D: 'E', arm: { mode: 'band', main: 'E', cross: 'S', crossStep: false } },
      W: { A: { x: -1, y: 0 }, D: 'W', arm: { mode: 'band', main: 'W', cross: 'N', crossStep: false } },
    },
  };
}

/**
 * Lay out a board. Returns { tiles:[{id, rect, halves, double, spinner}], exits, rects, bbox, lim }
 */
export function layoutBoard(board, aspect) {
  const lim = limitsFor(aspect);
  const tiles = [], rects = [], exits = {};
  let bbox = null;
  for (const n of board.nodes) {
    let g;
    if (n.parent === null) g = rootGeometry(n);
    else {
      const ex = exits[`${n.parent}:${n.slot}`];
      g = placeAt(ex, n.double, n.inPip, n.outPip, rects, lim);
    }
    for (const [slot, e] of Object.entries(g.exits)) exits[`${n.id}:${slot}`] = e;
    rects.push(g.rect);
    tiles.push({ id: n.id, rect: g.rect, halves: g.halves, double: n.double, spinner: n.spinner, tile: n.tile });
    bbox = bbox ? union(bbox, g.rect) : g.rect;
  }
  return { tiles, exits, rects, bbox: bbox || { x0: -1, y0: -1, x1: 1, y1: 1 }, lim };
}

/** Where a tile would land for a legal move (for the "drop here" targets). */
export function previewPlacement(lay, move, endValue) {
  const t = move.tile;
  const dbl = t[0] === t[1];
  if (move.nodeId === null) {
    const g = rootGeometry({ tile: [Math.min(...t), Math.max(...t)], double: dbl, spinner: false });
    return { rect: g.rect, halves: g.halves };
  }
  const ex = lay.exits[`${move.nodeId}:${move.slot}`];
  if (!ex) return null;
  // The end's value is the pip that must face inward.
  const inPip = endValue ?? t[0];
  const outPip = t[0] === inPip ? t[1] : t[0];
  return placeAt(ex, dbl, inPip, outPip, lay.rects, lay.lim);
}

/** Count tiles that overlap another tile (layout quality check for tests). */
export function overlaps(lay) {
  let n = 0;
  for (let i = 0; i < lay.rects.length; i++)
    for (let j = i + 1; j < lay.rects.length; j++) if (hit(lay.rects[i], lay.rects[j])) n++;
  return n;
}
