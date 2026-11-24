// Moe's Dominoes — what the computer players say
// Code: © Corey J Ruff
//
// First pass from Corey's list. Each player maps events to lines; when an event
// has several lines one is picked at random. The Session 5 editor will let you add more.
//
// Events:
//   win            this player won the game
//   lose           this player lost the game
//   bigScore       this player scored more than 20 in one play
//   bigDrawSelf    this player drew more than 3 tiles in one turn
//   bigDrawOther   someone else drew more than 3 tiles in one turn

const CAT = { win: ['Meow!'], bigScore: ['Meow!'] };

export const LINES = {
  nala: { bigDrawOther: ["That's Ruff"], bigDrawSelf: ['Ruff it'], lose: ['Ruff it'] },
  moe: CAT,
  eyton: CAT,
  rhys: CAT,
  wally: CAT,
};

export function lineFor(rosterId, event, rng = Math.random) {
  const set = LINES[rosterId] && LINES[rosterId][event];
  if (!set || !set.length) return null;
  return set[Math.floor(rng() * set.length)];
}
