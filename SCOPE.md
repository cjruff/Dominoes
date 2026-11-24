# Moe's Dominoes — scope and session plan

Code: © Corey J Ruff

Named for Morgan ("Moe"), a tuxedo cat. A single web app (HTML + JavaScript, no build step) for desktop and phones,
published on GitHub Pages like Eyton's Cribbage. One human player against
1–3 computer players.

## Scope (version 1)

| Area | Included |
|---|---|
| Tile set | Double-six (28 tiles). Engine is written so double-nine/twelve can be added later. |
| Games | **Fives** (All Fives / Muggins scoring), **Block**, **Draw** |
| Fives variants | **First spinner only** · **Every double spins** |
| Players | 2–4: you + 1–3 computer players |
| Computer levels | Beginner, Medium, Hard, Expert |
| Table | Line of play snakes and re-flows to fit the screen, scales down as it grows, re-lays out on rotate/resize |
| Tiles | Drawn in SVG; built-in "Classic white"; custom designs as themes |
| Stats | Lifetime per game type and opponent level; per-person profiles |
| Achievements | Bronze / Silver / Gold / Platinum medals, Achievements screen, post-game button |
| Personalities | Per-computer-player comment lines by game event, portraits, an editor |
| Artwork | Moe portrait (setup screen, app icon), film-frame About image |
| Delivery | PWA (home-screen install, offline), GitHub Pages, export/import backup |

## House rules used (easy to change — say the word)

- Hands: 7 tiles each with 2 players, 5 each with 3–4.
- First hand: the highest double leads and must be played (heaviest tile if no doubles are out). Later hands: last hand's winner leads with anything.
- **Fives:** after each play, if the open ends total a multiple of 5 you score it. A double at an end counts both halves. Going out scores the others' pips rounded to the nearest 5. Reaching the target on a scoring play wins at once.
- **Spinners:** a spinner's side arms open only after both of its line sides are covered. With *Every double spins*, each double in the line opens its two sides once the line continues past it.
- **Block/Draw:** first out scores every opponent's pips. A blocked hand goes to the lowest count (a tie for low scores nothing).
- Draw/Fives: draw one at a time until you can play; pass only when the boneyard is empty.
- Default targets: Fives 150, Block and Draw 100 (selectable).

## Sessions

1. **Engine, computer players, table layout, playable game** ✅ *(this delivery)*
   Rules for all three games and both Fives variants, 4 AI levels, auto-fitting table,
   SVG tiles, setup screen, hand and game summaries, basic stats, simulation tests.
2. **Play-test fixes and table polish** — your feedback from real games; smoother tile animation,
   drag-to-place, hint button, tighter layout when several spinners branch, sound toggle,
   rule options only if wanted later (4 players always play individually — no partners).
3. **Player profiles and full stats** — profiles for shared devices, stats screen by game/variant/level,
   records (biggest Fives play, dominoes, shutouts), export/import backup.
4. **Achievements and medals** — achievement list (I'll draft one; you edit it like the cribbage list),
   tiered medals, Achievements Manager, post-game "medals earned" button.
5. **Personalities** — reuse the cribbage portraits, comment lines for events (big score, domino,
   blocked, drawing a lot, losing streak), personality editor.
6. **Custom tile designs, PWA and publishing** — your tile art as themes (colored pips, ivory,
   image faces), table felts, manifest/service worker/icons, `cjruff/moes-dominoes` on GitHub Pages, phone test.

## Project layout

```
index.html          setup + game screens
css/style.css       table, tray, overlays, phone sizes
js/tiles.js         tile set, RNG, helpers
js/board.js         line of play: open ends, spinners, Fives count
js/game.js          rules engine: deal, lead, play/draw/pass, scoring
js/ai.js            Beginner / Medium / Hard / Expert
js/layout.js        snaking, re-flowing table geometry
js/render.js        SVG tiles and themes
js/stats.js         saved setup + lifetime stats
js/main.js          UI controller
tests/sim.mjs       soak test: thousands of games, rule invariants, layout overlap rate
tests/ladder.mjs    head-to-head strength check between AI levels
```

Run tests from the project folder: `node tests/sim.mjs 100` and
`node tests/ladder.mjs fives expert hard 200`.
To play locally, serve the folder (`python -m http.server`) and open `http://localhost:8000`
(ES modules don't load from `file://`). VS Code's Live Server extension also works.
