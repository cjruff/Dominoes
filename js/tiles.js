// Moe's Dominoes — tile set helpers
// Code: © Corey J Ruff

export const MAX_PIP = 6; // double-six set (double-nine/twelve later)

/** A tile is [a, b] with a <= b. Its id is "a-b". */
export function makeSet(maxPip = MAX_PIP) {
  const set = [];
  for (let a = 0; a <= maxPip; a++) for (let b = a; b <= maxPip; b++) set.push([a, b]);
  return set;
}

export const tileId = (t) => `${Math.min(t[0], t[1])}-${Math.max(t[0], t[1])}`;
export const isDouble = (t) => t[0] === t[1];
export const pips = (t) => t[0] + t[1];
export const hasPip = (t, v) => t[0] === v || t[1] === v;
export const otherPip = (t, v) => (t[0] === v ? t[1] : t[0]);
export const handPips = (hand) => hand.reduce((s, t) => s + pips(t), 0);

/** Small seedable RNG (mulberry32) so simulations are repeatable. */
export function makeRng(seed = Date.now()) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (n) => Math.floor(rng() * n);
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return rng;
}

export const roundTo5 = (n) => Math.round(n / 5) * 5;
