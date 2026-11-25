// Moe's Dominoes — display settings (table color, tile style)
// Code: © Corey J Ruff

import { THEMES } from './render.js';

const KEY = 'moesDominoes.display.v1';

export const TABLE_PRESETS = [
  { id: 'green', name: 'Classic Green', color: '#17573b' },
  { id: 'blue', name: 'Casino Blue', color: '#1b4a7a' },
  { id: 'burgundy', name: 'Burgundy', color: '#6b1f2c' },
  { id: 'slate', name: 'Slate', color: '#3a4249' },
];

const DEFAULTS = { table: '#17573b', tiles: 'classic', icons: 'large', iconsV: 2 }; // icons: 'circle' | 'large'

export function loadDisplay() {
  try {
    const d = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
    if (d.iconsV !== 2) { d.icons = 'large'; d.iconsV = 2; } // large portraits became the default
    return d;
  } catch { return { ...DEFAULTS }; }
}
export function saveDisplay(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } }

export const tileTheme = (d) => THEMES[d.tiles] || THEMES.classic;

// ---- colour helpers: build the felt's light centre and dark edge from one colour ----
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
const hsl = (h, s, l) => `hsl(${h.toFixed(0)} ${Math.max(0, Math.min(100, s)).toFixed(0)}% ${Math.max(0, Math.min(100, l)).toFixed(0)}%)`;

/** Apply the table color to the page (CSS variables used by the felt). */
export function applyDisplay(d) {
  const [h, s, l] = hexToHsl(d.table);
  const root = document.documentElement.style;
  root.setProperty('--felt', d.table);
  root.setProperty('--felt-light', hsl(h, s, l + 7));
  root.setProperty('--felt-dark', hsl(h, s, l - 9));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = '#3b2414';
}
