// Moe's Dominoes — achievements and medals
// Code: © Corey J Ruff
//
// Five medal levels as in Eyton's Cribbage: bronze, silver, gold, platinum, diamond.
// Tiered achievements earn a medal at each count. Single achievements earn one medal.
// A GameTracker watches one game's events; commitGame() adds them to your record
// when the game finishes (a quit game doesn't count, same as stats).

export const MEDALS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
export const MEDAL_NAMES = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', diamond: 'Diamond' };
export const medalImg = (m) => `assets/medals/${m}.webp`;

const T100 = [1, 10, 25, 50, 100];
const T250 = [1, 25, 50, 100, 250];
const T500 = [1, 50, 100, 250, 500];

export const CATEGORIES = [
  'Winning & Competition', 'Domino Mastery', 'Scoring & Big Plays',
  'Evil Genius / Opponent Torment', 'Funny / Unusual', 'Long-Term / Dedication',
];

/**
 * tiers  : counts needed for each medal (5 values = tiered; 1 value = single medal)
 * medal  : the medal a single achievement awards
 * life   : for single achievements read from lifetime totals instead of a counter
 * fives / notBlock : only counted in those games
 */
export const ACHIEVEMENTS = [
  // ---- Winning & Competition ----
  { id: 'firstBlood', cat: 0, name: 'First Blood', desc: 'Win your first game', tiers: [1], medal: 'bronze', life: 'wins' },
  { id: 'dominator', cat: 0, name: 'Domino Dominator', desc: 'Win 10 games', tiers: [10], medal: 'silver', life: 'wins' },
  { id: 'conqueror', cat: 0, name: 'The Conqueror', desc: 'Win 50 games', tiers: [50], medal: 'gold', life: 'wins' },
  { id: 'legend', cat: 0, name: 'Table Legend', desc: 'Win 100 games', tiers: [100], medal: 'platinum', life: 'wins' },
  { id: 'cleanSweep', cat: 0, name: 'Clean Sweep', desc: 'Win a game in which you won every hand (2+ hands)', tiers: T100 },
  { id: 'hatTrick', cat: 0, name: 'Hat Trick', desc: 'Win 3 games in a row', tiers: T250 },
  { id: 'onFire', cat: 0, name: 'On Fire', desc: 'Win 5 games in a row', tiers: T250 },
  { id: 'unstoppable', cat: 0, name: 'Unstoppable', desc: 'Win 10 games in a row', tiers: T100 },
  { id: 'comebackKid', cat: 0, name: 'Comeback Kid', desc: 'Win after being behind by more than 50 points', tiers: [1], medal: 'gold' },
  { id: 'davidGoliath', cat: 0, name: 'David vs. Goliath', desc: 'Beat an Expert opponent', tiers: T100 },
  { id: 'humiliation', cat: 0, name: 'Humiliation', desc: 'Win by 100+ points over an opponent', tiers: T100 },
  { id: 'perfectRecord', cat: 0, name: 'Perfect Record', desc: 'Win a game without losing a single hand', tiers: T100 },

  // ---- Domino Mastery ----
  { id: 'doubleTrouble', cat: 1, name: 'Double Trouble', desc: 'Play 10 doubles in one game', tiers: T100 },
  { id: 'doubleDown', cat: 1, name: 'Double Down', desc: 'Play 5 doubles in one hand', tiers: T100 },
  { id: 'dirtyDeal', cat: 1, name: 'Dirty Deal', desc: 'Be dealt 3+ doubles in one hand', tiers: T100 },
  { id: 'dominoRally', cat: 1, name: 'Domino Rally', desc: 'Score on 3 turns in a row (Fives)', tiers: T250, fives: true },
  { id: 'noDraw', cat: 1, name: 'No Draw Necessary', desc: 'Win a game without drawing a tile (Fives or Draw)', tiers: [1], medal: 'silver', notBlock: true },
  { id: 'blockParty', cat: 1, name: 'Block Party', desc: 'Win a blocked hand', tiers: T250 },
  { id: 'snakeEyes', cat: 1, name: 'Snake Eyes', desc: 'Play the double-one', tiers: T500 },
  { id: 'doubleSixClub', cat: 1, name: 'Double Six Club', desc: 'Play the double-six', tiers: T500 },

  // ---- Scoring & Big Plays ----
  { id: 'pointCollector', cat: 2, name: 'Point Collector', desc: 'Score 100 points (all games)', tiers: [100], medal: 'bronze', life: 'points' },
  { id: 'highRoller', cat: 2, name: 'High Roller', desc: 'Score 500 points (all games)', tiers: [500], medal: 'silver', life: 'points' },
  { id: 'bigWinner', cat: 2, name: 'Big Winner', desc: 'Score 1,000 points (all games)', tiers: [1000], medal: 'gold', life: 'points' },
  { id: 'jackpot', cat: 2, name: 'Jackpot', desc: 'Score 25+ points in a single play', tiers: T500, fives: true },
  { id: 'doubleJackpot', cat: 2, name: 'Double Jackpot', desc: 'Make two 25+ point plays in one hand', tiers: T500, fives: true },
  { id: 'precision', cat: 2, name: 'Precision Landing', desc: 'Win by landing exactly on the target score', tiers: T500 },
  { id: 'scoreboardShock', cat: 2, name: 'Scoreboard Shock', desc: 'Score 50+ points in one hand', tiers: T500 },
  { id: 'shutout', cat: 2, name: 'Shutout', desc: 'Win a game without an opponent scoring', tiers: T500 },
  { id: 'chainReaction', cat: 2, name: 'Chain Reaction', desc: '5 scoring plays in a row, by you and your opponents', tiers: T500, fives: true },
  { id: 'doubledUpOn', cat: 2, name: 'Doubled Up On', desc: 'End a hand holding only doubles (3+)', tiers: T500 },

  // ---- Evil Genius / Opponent Torment ----
  { id: 'deadEnd', cat: 3, name: 'Dead End', desc: 'Your play leaves the next opponent unable to play', tiers: T500 },
  { id: 'gotcha', cat: 3, name: 'Gotcha!', desc: 'Your plays force opponents to draw 5+ tiles in one game', tiers: T500, notBlock: true },
  { id: 'revenge', cat: 3, name: 'The Revenge', desc: 'Beat the opponent who won the previous game', tiers: T500 },
  { id: 'notSoFast', cat: 3, name: 'Not So Fast', desc: 'Force an opponent with one tile left to draw', tiers: T500, notBlock: true },
  { id: 'cruel', cat: 3, name: 'Cruel Intentions', desc: 'Win a blocked hand holding fewer tiles than everyone', tiers: T500 },
  { id: 'denial', cat: 3, name: 'Domino Denial', desc: 'Stop an opponent playing their last tile, then win the hand', tiers: T500 },
  { id: 'saboteur', cat: 3, name: 'The Saboteur', desc: 'An opponent has to draw 3 turns in a row', tiers: T500, notBlock: true },
  { id: 'tooEasy', cat: 3, name: 'Too Easy', desc: 'Beat a Beginner 10 times', tiers: [10], medal: 'bronze', life: 'winsBeginner' },
  { id: 'aiHumiliation', cat: 3, name: 'AI Humiliation', desc: 'Beat an Expert 10 times', tiers: [10], medal: 'platinum', life: 'winsExpert' },
  { id: 'noMercy', cat: 3, name: 'No Mercy', desc: 'Win 10 games against the same opponent', tiers: [10], medal: 'gold', life: 'bestVsOne' },
  { id: 'uno', cat: 3, name: 'Uno!', desc: 'An opponent down to one tile draws 3+', tiers: T500, notBlock: true },
  { id: 'soClose', cat: 3, name: 'So Close, Yet So Far', desc: 'Draw 3+ tiles when down to your last one', tiers: T500, notBlock: true },

  // ---- Funny / Unusual ----
  { id: 'butterfingers', cat: 4, name: 'Butterfingers', desc: 'Draw 10 tiles in one hand', tiers: T500, notBlock: true },
  { id: 'hoarder', cat: 4, name: 'Hoarder', desc: 'Finish a hand with 10+ tiles', tiers: T500, notBlock: true },
  { id: 'doubleDisaster', cat: 4, name: 'Double Disaster', desc: 'Finish a hand holding 3+ doubles', tiers: T500 },
  { id: 'longGame', cat: 4, name: 'The Long Game', desc: 'Play a game lasting 25+ hands', tiers: T500 },
  { id: 'soCloseLose', cat: 4, name: 'So Close!', desc: 'Lose by 1 point (5 in Fives)', tiers: T500 },
  { id: 'comebackNobody', cat: 4, name: 'The Comeback Nobody Saw', desc: 'Win after being 100+ points behind', tiers: T500 },
  { id: 'brickWall', cat: 4, name: 'Brick Wall', desc: '5 blocked hands in one game', tiers: T500 },
  { id: 'godsAngry', cat: 4, name: 'The Domino Gods Are Angry', desc: 'Lose 5 games in a row', tiers: T500 },
  { id: 'cheap', cat: 4, name: 'Cheap Bastard', desc: 'Lose a hand holding only the double-blank', tiers: T500 },
  { id: 'howBoutNo', cat: 4, name: "How 'Bout No!", desc: 'Win a hand while an opponent holds only the double-blank', tiers: T500 },
  { id: 'badPenny', cat: 4, name: 'A Bad Penny', desc: 'Get dealt the double-six right after being stuck with it at the end of the last hand', tiers: T250 },
  { id: 'devilsWork', cat: 4, name: "The Devil's Work", desc: 'End a hand holding just the 6-6 and 6-0', tiers: T500 },

  // ---- Long-Term / Dedication ----
  { id: 'regular', cat: 5, name: 'Regular', desc: 'Play 25 games', tiers: [25], medal: 'bronze', life: 'games' },
  { id: 'familiar', cat: 5, name: 'Familiar Face', desc: 'Play 100 games', tiers: [100], medal: 'silver', life: 'games' },
  { id: 'veteran', cat: 5, name: 'Veteran', desc: 'Play 500 games', tiers: [500], medal: 'gold', life: 'games' },
  { id: 'addicted', cat: 5, name: 'Addicted', desc: 'Play 1,000 games', tiers: [1000], medal: 'platinum', life: 'games' },
  { id: 'getHelp', cat: 5, name: 'Get Help', desc: 'Play 5,000 games', tiers: [5000], medal: 'diamond', life: 'games' },
];
export const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const medalFor = (a, tierIdx) => (a.tiers.length === 1 ? a.medal : MEDALS[tierIdx]);
export const totalMedals = () => ACHIEVEMENTS.reduce((n, a) => n + a.tiers.length, 0);

// =====================================================================
// Saved record
// =====================================================================
const KEY = 'moesDominoes.achievements.v1';
export function emptyRecord() {
  return {
    version: 1, counts: {}, earned: {},   // earned[id] = number of tiers reached
    life: { games: 0, wins: 0, points: 0, winStreak: 0, lossStreak: 0, winsBeginner: 0, winsExpert: 0,
      winsVs: {}, bestVsOne: 0, lastWinner: null },
  };
}
export function loadRecord(store = globalThis.localStorage) {
  try { return { ...emptyRecord(), ...(JSON.parse(store.getItem(KEY)) || {}) }; } catch { return emptyRecord(); }
}
function saveRecord(rec, store = globalThis.localStorage) { try { store.setItem(KEY, JSON.stringify(rec)); } catch { /* ignore */ } }
export function resetRecord(store = globalThis.localStorage) { saveRecord(emptyRecord(), store); }

export function progressOf(rec, a) {
  return a.life ? (rec.life[a.life] || 0) : (rec.counts[a.id] || 0);
}
export function tiersReached(a, value) {
  let n = 0; for (const t of a.tiers) if (value >= t) n++; return n;
}

// =====================================================================
// Tracking one game
// =====================================================================
export class GameTracker {
  constructor(game, meIdx) {
    this.me = meIdx;
    this.mode = game.s.mode;
    this.n = game.s.players.length;
    this.counts = {};
    this.g = { hands: 0, handsLost: 0, handsWon: 0, blocked: 0, doubles: 0, draws: 0, causedDraws: 0, maxDeficit: 0 };
    this.lastActor = null; this.lastWasPlay = false;
    this.oppDrawStreak = Array(this.n).fill(0);
    this.newHand(game);
  }
  bump(id, by = 1) { this.counts[id] = (this.counts[id] || 0) + by; }

  newHand() {
    this.h = { doubles: 0, draws: 0, jackpots: 0, myScoreStreak: 0, chain: [], denied: false };
    this.turnDraws = Array(this.n).fill(0);
    this.turnStartSize = Array(this.n).fill(null);
  }

  deficit(game) {
    const sc = game.s.players.map((p) => p.score);
    const mine = sc[this.me];
    const top = Math.max(...sc.filter((_, i) => i !== this.me));
    this.g.maxDeficit = Math.max(this.g.maxDeficit, top - mine);
  }

  /** Feed every engine event here. */
  onEvent(ev, game) {
    const s = game.s, me = this.me;
    switch (ev.type) {
      case 'handStart': {
        this.newHand(game);
        this.g.hands++;
        const dealt = s.players[me].hand.filter((t) => t[0] === t[1]).length;
        if (dealt >= 3) this.bump('dirtyDeal');
        if (this.stuckWith66 && s.players[me].hand.some((t) => t[0] === 6 && t[1] === 6)) this.bump('badPenny');
        this.stuckWith66 = false;
        break;
      }
      case 'draw': {
        const p = ev.player;
        if (this.turnDraws[p] === 0) this.turnStartSize[p] = s.players[p].hand.length - 1;
        this.turnDraws[p]++;
        break;
      }
      case 'play':
      case 'pass': {
        const p = ev.player;
        const d = this.turnDraws[p];
        const startSize = this.turnStartSize[p] ?? (s.players[p].hand.length + (ev.type === 'play' ? 1 : 0));
        const stuck = d > 0 || ev.type === 'pass';
        if (p !== me) {
          const afterMyPlay = this.lastActor === me && this.lastWasPlay;
          if (afterMyPlay && stuck) this.bump('deadEnd');
          if (afterMyPlay) this.g.causedDraws += d;
          if (afterMyPlay && d > 0 && startSize === 1) this.bump('notSoFast');
          if (startSize === 1 && d >= 3) this.bump('uno');
          if (startSize === 1 && stuck) this.h.denied = true;
          this.oppDrawStreak[p] = d > 0 ? this.oppDrawStreak[p] + 1 : 0;
          if (this.oppDrawStreak[p] === 3) this.bump('saboteur');
        } else {
          if (startSize === 1 && d >= 3) this.bump('soClose');
          this.h.draws += d; this.g.draws += d;
          if (this.h.draws >= 10 && this.h.draws - d < 10) this.bump('butterfingers');
        }
        this.turnDraws[p] = 0; this.turnStartSize[p] = null;
        this.lastActor = p; this.lastWasPlay = ev.type === 'play';
        if (ev.type === 'play') this.onPlay(ev, game);
        else this.h.chain = [];
        break;
      }
      case 'handEnd': this.onHandEnd(ev, game); break;
      default: break;
    }
  }

  onPlay(ev, game) {
    const me = this.me, t = ev.tile, dbl = t[0] === t[1];
    if (ev.player === me) {
      if (dbl) { this.h.doubles++; this.g.doubles++; if (this.h.doubles === 5) this.bump('doubleDown'); }
      if (dbl && t[0] === 1) this.bump('snakeEyes');
      if (dbl && t[0] === 6) this.bump('doubleSixClub');
      if (ev.points >= 25) { this.bump('jackpot'); this.h.jackpots++; if (this.h.jackpots === 2) this.bump('doubleJackpot'); }
      this.h.myScoreStreak = ev.points > 0 ? this.h.myScoreStreak + 1 : 0;
      if (this.h.myScoreStreak === 3) this.bump('dominoRally');
    }
    if (ev.points > 0) {
      this.h.chain.push(ev.player);
      const c = this.h.chain;
      if (c.length >= 5 && c.includes(me) && c.some((p) => p !== me)) { this.bump('chainReaction'); this.h.chain = []; }
    } else this.h.chain = [];
    if (ev.points) this.deficit(game);
  }

  onHandEnd(ev, game) {
    const me = this.me;
    const mine = ev.hands[me];
    const isDbl = (t) => t[0] === t[1];
    if (ev.reason === 'blocked') this.g.blocked++;
    if (ev.winner === me) {
      this.g.handsWon++;
      if (ev.reason === 'blocked') {
        this.bump('blockParty');
        if (ev.hands.every((h, i) => i === me || mine.length < h.length)) this.bump('cruel');
      }
      if (this.h.denied) this.bump('denial');
      if (ev.hands.some((h, i) => i !== me && h.length === 1 && h[0][0] === 0 && h[0][1] === 0)) this.bump('howBoutNo');
    } else {
      this.g.handsLost++;
      if (mine.length === 1 && mine[0][0] === 0 && mine[0][1] === 0) this.bump('cheap');
    }
    this.stuckWith66 = mine.some((t) => t[0] === 6 && t[1] === 6);
    if (mine.length >= 10) this.bump('hoarder');
    if (mine.filter(isDbl).length >= 3) this.bump('doubleDisaster');
    if (mine.length >= 3 && mine.every(isDbl)) this.bump('doubledUpOn');
    if (mine.length === 2 && mine.some((t) => isDbl(t) && t[0] === 6) && mine.some((t) => Math.min(...t) === 0 && Math.max(...t) === 6)) this.bump('devilsWork');
    if (ev.handPoints[me] >= 50) this.bump('scoreboardShock');
    this.deficit(game);
  }
}

// =====================================================================
// Finishing a game: update the record, report new medals
// =====================================================================
export function commitGame(tracker, game, store = globalThis.localStorage) {
  const rec = loadRecord(store);
  const s = game.s, me = tracker.me;
  const before = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, tiersReached(a, progressOf(rec, a))]));
  const won = s.winner === me;
  const myScore = s.players[me].score;
  const opps = s.players.filter((p) => p.idx !== me);
  const c = { ...tracker.counts };
  const bump = (id, by = 1) => { c[id] = (c[id] || 0) + by; };
  const L = rec.life;

  L.games++;
  L.points += myScore;
  if (won) {
    L.wins++; L.winStreak++; L.lossStreak = 0;
    if (L.winStreak === 3) bump('hatTrick');
    if (L.winStreak === 5) bump('onFire');
    if (L.winStreak === 10) bump('unstoppable');
    if (tracker.g.handsLost === 0) { bump('perfectRecord'); if (tracker.g.hands >= 2) bump('cleanSweep'); }
    if (tracker.g.maxDeficit > 50) bump('comebackKid');
    if (tracker.g.maxDeficit >= 100) bump('comebackNobody');
    if (opps.some((p) => p.level === 'expert')) { bump('davidGoliath'); L.winsExpert++; }
    if (opps.some((p) => p.level === 'beginner')) L.winsBeginner++;
    if (opps.some((p) => myScore - p.score >= 100)) bump('humiliation');
    if (s.mode !== 'block' && tracker.g.draws === 0) bump('noDraw');
    if (myScore === s.target) bump('precision');
    if (opps.every((p) => p.score === 0)) bump('shutout');
    if (L.lastWinner && L.lastWinner !== 'you' && opps.some((p) => (p.rosterId || p.name) === L.lastWinner)) bump('revenge');
    for (const p of opps) {
      const k = p.rosterId || p.name;
      L.winsVs[k] = (L.winsVs[k] || 0) + 1;
      L.bestVsOne = Math.max(L.bestVsOne, L.winsVs[k]);
    }
  } else {
    L.lossStreak++; L.winStreak = 0;
    if (L.lossStreak === 5) bump('godsAngry');
    const w = s.players[s.winner];
    if (w && w.score - myScore === (s.mode === 'fives' ? 5 : 1)) bump('soCloseLose');
  }
  L.lastWinner = won ? 'you' : (s.players[s.winner] ? (s.players[s.winner].rosterId || s.players[s.winner].name) : null);
  if (tracker.g.doubles >= 10) bump('doubleTrouble');
  if (tracker.g.causedDraws >= 5) bump('gotcha');
  if (tracker.g.hands >= 25) bump('longGame');
  if (tracker.g.blocked >= 5) bump('brickWall');

  for (const [id, n] of Object.entries(c)) {
    const a = BY_ID[id];
    if (!a || a.life) continue;
    if (a.fives && s.mode !== 'fives') continue;
    if (a.notBlock && s.mode === 'block') continue;
    rec.counts[id] = (rec.counts[id] || 0) + n;
  }
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    const now = tiersReached(a, progressOf(rec, a));
    rec.earned[a.id] = now;
    for (let t = before[a.id]; t < now; t++) earned.push({ a, tier: t, medal: medalFor(a, t) });
  }
  saveRecord(rec, store);
  return earned;
}
