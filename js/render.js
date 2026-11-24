// Moe's Dominoes — SVG drawing of tiles and the table
// Code: © Corey J Ruff
//
// Tile designs are "themes" so custom sets can be dropped in later
// (colored pips, ivory, image faces…). Units match layout.js: a half is 1×1.

const NS = 'http://www.w3.org/2000/svg';

export const THEMES = {
  classic: {
    id: 'classic', name: 'Classic White', face: '#fbfaf4', face2: '#e9e6da', edge: '#2a2a2a', divider: '#6b6b6b',
    pip: '#111111', pipColors: null, back: '#7b1e1e', backPattern: '#a33a3a', spinnerMark: '#c9a227',
  },
  black: {
    id: 'black', name: 'Black', face: '#2b2b2b', face2: '#121212', edge: '#5a5a5a', divider: '#8a8a8a',
    pip: '#f6f6f2', pipColors: null, back: '#7b1e1e', backPattern: '#a33a3a', spinnerMark: '#d8b04a',
  },
  blue: {
    id: 'blue', name: 'Dark Blue', face: '#23427a', face2: '#132a55', edge: '#0a1733', divider: '#9fb3d9',
    pip: '#ffffff', pipColors: null, back: '#7b1e1e', backPattern: '#a33a3a', spinnerMark: '#d8b04a',
  },
};

export function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

// Pip positions in a unit square. "Wide" halves (on a horizontal tile) lay six out in rows of 3.
const P = { a: 0.24, m: 0.5, z: 0.76 };
function pipSpots(v, wide) {
  const { a, m, z } = P;
  switch (v) {
    case 0: return [];
    case 1: return [[m, m]];
    case 2: return wide ? [[a, z], [z, a]] : [[a, a], [z, z]];
    case 3: return wide ? [[a, z], [m, m], [z, a]] : [[a, a], [m, m], [z, z]];
    case 4: return [[a, a], [z, a], [a, z], [z, z]];
    case 5: return [[a, a], [z, a], [m, m], [a, z], [z, z]];
    case 6: return wide ? [[a, a], [m, a], [z, a], [a, z], [m, z], [z, z]]
      : [[a, a], [a, m], [a, z], [z, a], [z, m], [z, z]];
    default: return [];
  }
}

/**
 * Draw one tile. halves: [{rect:{x0,y0,x1,y1}, pip}] (two unit squares).
 * opts: { theme, className, spinner, ghost, faceDown }
 */
export function drawTile(parent, halves, opts = {}) {
  const th = opts.theme || THEMES.classic;
  const g = el('g', { class: `tile ${opts.className || ''}` }, parent);
  const r = {
    x0: Math.min(halves[0].rect.x0, halves[1].rect.x0), y0: Math.min(halves[0].rect.y0, halves[1].rect.y0),
    x1: Math.max(halves[0].rect.x1, halves[1].rect.x1), y1: Math.max(halves[0].rect.y1, halves[1].rect.y1),
  };
  const inset = 0.04;
  const w = r.x1 - r.x0 - inset * 2, h = r.y1 - r.y0 - inset * 2;
  const wide = w > h;
  if (opts.ghost) {
    el('rect', { x: r.x0 + inset, y: r.y0 + inset, width: w, height: h, rx: 0.14, class: 'ghost-rect' }, g);
    return g;
  }
  // soft shadow
  el('rect', { x: r.x0 + inset + 0.05, y: r.y0 + inset + 0.07, width: w, height: h, rx: 0.14, fill: 'rgba(0,0,0,0.28)' }, g);
  if (opts.faceDown) {
    el('rect', { x: r.x0 + inset, y: r.y0 + inset, width: w, height: h, rx: 0.14, fill: th.back, stroke: th.edge, 'stroke-width': 0.04 }, g);
    el('rect', { x: r.x0 + 0.2, y: r.y0 + 0.2, width: w - 0.32, height: h - 0.32, rx: 0.08, fill: 'none', stroke: th.backPattern, 'stroke-width': 0.05 }, g);
    return g;
  }
  el('rect', { x: r.x0 + inset, y: r.y0 + inset, width: w, height: h, rx: 0.14, fill: `url(#faceGrad-${th.id})`, stroke: th.edge, 'stroke-width': 0.035 }, g);
  // divider
  const a = halves[0].rect, b = halves[1].rect;
  if (Math.abs(a.x1 - b.x0) < 0.01 || Math.abs(b.x1 - a.x0) < 0.01) {
    const x = Math.abs(a.x1 - b.x0) < 0.01 ? a.x1 : a.x0;
    el('line', { x1: x, y1: r.y0 + 0.16, x2: x, y2: r.y1 - 0.16, stroke: th.divider, 'stroke-width': 0.035 }, g);
  } else {
    const y = Math.abs(a.y1 - b.y0) < 0.01 ? a.y1 : a.y0;
    el('line', { x1: r.x0 + 0.16, y1: y, x2: r.x1 - 0.16, y2: y, stroke: th.divider, 'stroke-width': 0.035 }, g);
  }
  if (opts.spinner) {
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    el('circle', { cx, cy, r: 0.07, fill: th.spinnerMark, stroke: '#6d5410', 'stroke-width': 0.015 }, g);
  }
  for (const half of halves) {
    const color = th.pipColors ? th.pipColors[half.pip] : th.pip;
    for (const [px, py] of pipSpots(half.pip, wide)) {
      el('circle', { cx: half.rect.x0 + px, cy: half.rect.y0 + py, r: 0.095, fill: color }, g);
    }
  }
  return g;
}

/** Gradient defs shared by an SVG. */
export function addDefs(svg, theme = THEMES.classic) {
  theme = theme || THEMES.classic;
  const defs = el('defs', {}, svg);
  const lg = el('linearGradient', { id: `faceGrad-${theme.id}`, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  el('stop', { offset: '0%', 'stop-color': theme.face }, lg);
  el('stop', { offset: '100%', 'stop-color': theme.face2 }, lg);
}

/** A standalone upright tile (for the hand tray, summaries). */
export function tileSvg(tile, opts = {}) {
  const horizontal = !!opts.horizontal;
  const svg = el('svg', {
    viewBox: horizontal ? '-0.05 -0.05 2.2 1.2' : '-0.05 -0.05 1.2 2.2',
    class: `tile-svg ${opts.className || ''}`, role: 'img',
    'aria-label': opts.faceDown ? 'face-down tile' : `${tile[0]}-${tile[1]}`,
  });
  addDefs(svg, opts.theme);
  const halves = horizontal
    ? [{ rect: { x0: 0, y0: 0, x1: 1, y1: 1 }, pip: tile[0] }, { rect: { x0: 1, y0: 0, x1: 2, y1: 1 }, pip: tile[1] }]
    : [{ rect: { x0: 0, y0: 0, x1: 1, y1: 1 }, pip: tile[0] }, { rect: { x0: 0, y0: 1, x1: 1, y1: 2 }, pip: tile[1] }];
  drawTile(svg, halves, { theme: opts.theme, faceDown: opts.faceDown });
  return svg;
}
