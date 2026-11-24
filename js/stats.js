// Moe's Dominoes — saved settings and lifetime stats
// Code: © Corey J Ruff
//
// Stats are kept per game type ("fives-first", "fives-all", "block", "draw"):
//   byLevel : your record against each difficulty (a game counts under the toughest
//             computer player at the table)
//   vs      : your record against each computer player
//   streak  : current and best winning streak
// "All games" is added up from these when shown.

const KEY_STATS = 'moesDominoes.stats.v2';
const KEY_STATS_V1 = 'moesDominoes.stats.v1';
const KEY_SETUP = 'moesDominoes.setup.v1';

export const LEVEL_ORDER = ['beginner', 'medium', 'hard', 'expert'];
export const VARIANTS = [
  { key: 'fives-first', name: 'Fives · First Spinner' },
  { key: 'fives-all', name: 'Fives · Every Double Spins' },
  { key: 'block', name: 'Block' },
  { key: 'draw', name: 'Draw' },
];

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode etc. */ } }

export const loadSetup = () => load(KEY_SETUP, null);
export const saveSetup = (s) => save(KEY_SETUP, s);

export const variantKey = (mode, spinnerRule) => (mode === 'fives' ? `fives-${spinnerRule}` : mode);

const emptyLine = () => ({ played: 0, won: 0, points: 0, hands: 0, handsWon: 0, dominoes: 0, bestPlay: 0, bestMargin: 0 });
const emptyVariant = () => ({ byLevel: {}, vs: {}, streak: { cur: 0, best: 0 } });

export function emptyStats() {
  return { version: 2, variants: {}, overallStreak: { cur: 0, best: 0 }, recent: [] };
}

export function loadStats() {
  const v2 = load(KEY_STATS, null);
  if (v2) return v2;
  // Carry over the simple Session 1 record (games and wins by level, best streak/play).
  const st = emptyStats();
  const v1 = load(KEY_STATS_V1, null);
  if (v1 && v1.totals) {
    for (const [key, t] of Object.entries(v1.totals)) {
      const v = st.variants[key] = emptyVariant();
      for (const [lv, r] of Object.entries(t.byLevel || {})) v.byLevel[lv] = { ...emptyLine(), played: r.played, won: r.won };
      v.streak = { cur: t.streak || 0, best: t.bestStreak || 0 };
      const top = Object.keys(v.byLevel)[0];
      if (top) v.byLevel[top].bestPlay = t.bestPlay || 0;
    }
  }
  return st;
}

/**
 * summary: { mode, spinnerRule, players:[{idx,name,human,level,rosterId,score}], winner, hands,
 *            dominoes, bestPlay, handsWon }
 */
export function recordGame(summary) {
  const st = loadStats();
  const key = variantKey(summary.mode, summary.spinnerRule);
  const v = st.variants[key] || (st.variants[key] = emptyVariant());
  const me = summary.players.find((p) => p.human);
  const opps = summary.players.filter((p) => !p.human);
  const won = summary.winner === me.idx;
  const lv = LEVEL_ORDER[Math.max(...opps.map((p) => LEVEL_ORDER.indexOf(p.level)))] || 'medium';
  const L = v.byLevel[lv] || (v.byLevel[lv] = emptyLine());
  L.played++; if (won) L.won++;
  L.points += me.score;
  L.hands += summary.hands;
  L.handsWon += summary.handsWon;
  L.dominoes += summary.dominoes;
  L.bestPlay = Math.max(L.bestPlay, summary.bestPlay || 0);
  if (won) L.bestMargin = Math.max(L.bestMargin, me.score - Math.max(...opps.map((p) => p.score)));

  for (const p of opps) {
    const id = p.rosterId || p.name;
    const r = v.vs[id] || (v.vs[id] = { name: p.name, played: 0, won: 0, theyWon: 0, ahead: 0 });
    r.name = p.name;
    r.played++;
    if (won) r.won++;
    if (summary.winner === p.idx) r.theyWon++;
    if (me.score > p.score || won) r.ahead++;
  }
  for (const s of [v.streak, st.overallStreak]) { s.cur = won ? s.cur + 1 : 0; s.best = Math.max(s.best, s.cur); }
  st.recent.unshift({ when: new Date().toISOString(), key, won, level: lv,
    players: summary.players.map((p) => ({ n: p.name, s: p.score, h: !!p.human })) });
  st.recent.length = Math.min(st.recent.length, 100);
  save(KEY_STATS, st);
  return st;
}

/** Add two stat lines together. */
function addLine(a, b) {
  return { played: a.played + b.played, won: a.won + b.won, points: a.points + b.points, hands: a.hands + b.hands,
    handsWon: a.handsWon + b.handsWon, dominoes: a.dominoes + b.dominoes,
    bestPlay: Math.max(a.bestPlay, b.bestPlay), bestMargin: Math.max(a.bestMargin, b.bestMargin) };
}

/** Everything the Stats screen shows for one game type, or 'all'. */
export function viewStats(st, which = 'all') {
  const keys = which === 'all' ? VARIANTS.map((x) => x.key) : [which];
  const byLevel = {}; const vs = {};
  let total = emptyLine();
  for (const k of keys) {
    const v = st.variants[k];
    if (!v) continue;
    for (const [lv, line] of Object.entries(v.byLevel)) {
      byLevel[lv] = addLine(byLevel[lv] || emptyLine(), line);
      total = addLine(total, line);
    }
    for (const [id, r] of Object.entries(v.vs)) {
      const t = vs[id] || (vs[id] = { name: r.name, played: 0, won: 0, theyWon: 0, ahead: 0 });
      t.played += r.played; t.won += r.won; t.theyWon += r.theyWon; t.ahead += r.ahead;
    }
  }
  const streak = which === 'all' ? st.overallStreak : (st.variants[which] ? st.variants[which].streak : { cur: 0, best: 0 });
  return { byLevel, total, vs, streak };
}

export function resetStats() { save(KEY_STATS, emptyStats()); try { localStorage.removeItem(KEY_STATS_V1); } catch { /* ignore */ } }
