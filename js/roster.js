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
  // Corey only plays at Expert. Beat him… or see the picture.
  { id: 'corey', name: 'Corey', face: 'assets/players/corey-face.webp', img: 'assets/players/corey.webp', onlyLevel: 'expert', loseImage: 'assets/players/corey-wins.webp' },
];

export function loadCustom() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function saveCustom(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }

export const allPlayers = () => [...BUILT_IN, ...loadCustom()];
export const byId = (id) => allPlayers().find((p) => p.id === id) || null;

/** Change a custom player's name and/or photo. */
export function updatePlayer(id, changes) {
  const list = loadCustom();
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  if (changes.name != null) p.name = String(changes.name).trim().slice(0, 14) || p.name;
  if (changes.photo !== undefined) { p.face = changes.photo; p.img = changes.photo; }
  saveCustom(list);
  return p;
}
export function deletePlayer(id) { saveCustom(loadCustom().filter((x) => x.id !== id)); }

// Your own photo (shown on your card and in results)
const ME_KEY = 'moesDominoes.me.v1';
export function loadMe() { try { return JSON.parse(localStorage.getItem(ME_KEY)) || {}; } catch { return {}; } }
export function saveMe(me) { try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch { alert('Not enough room to save that picture.'); } }

/** Add a custom player; returns it (or the existing one with that name). */
export function createPlayer(name, photo = null) {
  name = String(name || '').trim().slice(0, 14);
  if (!name) return null;
  const existing = allPlayers().find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const p = { id: `c${Date.now().toString(36)}`, name, face: photo, img: photo, custom: true };
  saveCustom([...loadCustom(), p]);
  return p;
}
