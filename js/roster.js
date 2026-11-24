// Moe's Dominoes — the computer players you can sit at the table
// Code: © Corey J Ruff
//
// Built-in pets have portraits. "+ Create New" adds a named player (initial
// icon for now); portraits and personalities for them arrive in Session 5.

const KEY = 'moesDominoes.roster.v1';

export const BUILT_IN = [
  { id: 'moe', name: 'Moe', face: 'assets/players/moe-face.webp', img: 'assets/players/moe.webp' },
  { id: 'eyton', name: 'Eyton', face: 'assets/players/eyton-face.webp', img: 'assets/players/eyton.webp' },
  { id: 'nala', name: 'Nala', face: 'assets/players/nala-face.webp', img: 'assets/players/nala.webp' },
  { id: 'rhys', name: 'Rhys', face: 'assets/players/rhys-face.webp', img: 'assets/players/rhys.webp' },
  { id: 'wally', name: 'Wally', face: 'assets/players/wally-face.webp', img: 'assets/players/wally.webp' },
];

export function loadCustom() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function saveCustom(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }

export const allPlayers = () => [...BUILT_IN, ...loadCustom()];
export const byId = (id) => allPlayers().find((p) => p.id === id) || null;

/** Add a custom player; returns it (or the existing one with that name). */
export function createPlayer(name) {
  name = String(name || '').trim().slice(0, 14);
  if (!name) return null;
  const existing = allPlayers().find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const p = { id: `c${Date.now().toString(36)}`, name, face: null, img: null, custom: true };
  saveCustom([...loadCustom(), p]);
  return p;
}
