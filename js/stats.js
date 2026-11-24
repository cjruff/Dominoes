// Moe's Dominoes — saved settings and lifetime stats
// Code: © Corey J Ruff
//
// Session 1 keeps a simple record per game type. Profiles, the full stats
// screen and achievements build on this shape in later sessions.

const KEY_STATS = 'moesDominoes.stats.v1';
const KEY_SETUP = 'moesDominoes.setup.v1';

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode etc. */ } }

export const loadSetup = () => load(KEY_SETUP, null);
export const saveSetup = (s) => save(KEY_SETUP, s);

export function emptyStats() {
  return { version: 1, games: [], totals: {} };
}
export const loadStats = () => load(KEY_STATS, emptyStats());

/** variantKey e.g. "fives-first", "block", "draw" */
export function variantKey(mode, spinnerRule) {
  return mode === 'fives' ? `fives-${spinnerRule}` : mode;
}

/**
 * Record a finished game for the human player.
 * summary: { mode, spinnerRule, players:[{name,human,level}], winner, scores, hands, dominoes,
 *            bestPlay, handsWon, target }
 */
export function recordGame(summary) {
  const st = loadStats();
  const key = variantKey(summary.mode, summary.spinnerRule);
  const human = summary.players.findIndex((p) => p.human);
  const won = summary.winner === human;
  const t = st.totals[key] || (st.totals[key] = {
    played: 0, won: 0, points: 0, hands: 0, handsWon: 0, dominoes: 0, bestPlay: 0, streak: 0, bestStreak: 0,
    byLevel: {},
  });
  t.played++; if (won) t.won++;
  t.points += summary.scores[human];
  t.hands += summary.hands;
  t.handsWon += summary.handsWon;
  t.dominoes += summary.dominoes;
  t.bestPlay = Math.max(t.bestPlay, summary.bestPlay || 0);
  t.streak = won ? t.streak + 1 : 0;
  t.bestStreak = Math.max(t.bestStreak, t.streak);
  // Record against the toughest opponent level at the table
  const order = ['beginner', 'medium', 'hard', 'expert'];
  const top = summary.players.filter((p) => !p.human).map((p) => order.indexOf(p.level)).reduce((a, b) => Math.max(a, b), 0);
  const lv = order[top];
  const bl = t.byLevel[lv] || (t.byLevel[lv] = { played: 0, won: 0 });
  bl.played++; if (won) bl.won++;
  st.games.push({ when: new Date().toISOString(), key, n: summary.players.length, won, scores: summary.scores,
    levels: summary.players.map((p) => (p.human ? 'you' : p.level)) });
  if (st.games.length > 500) st.games.splice(0, st.games.length - 500);
  save(KEY_STATS, st);
  return st;
}

export function resetStats() { save(KEY_STATS, emptyStats()); }
