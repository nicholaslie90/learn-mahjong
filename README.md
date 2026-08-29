# learn-mahjong

An interactive guide to **Hong Kong old style** mahjong (香港麻雀).

**→ https://nicholaslie90.github.io/learn-mahjong/**

- **Tiles** — all 144, labelled, coloured by suit
- **Sets** — chow, pung, kong, pair
- **Build a hand** — click tiles into a hand; it tells you which tiles you're waiting on at 13, and whether you've won and what it scores at 14
- **Play** — turn order and the claim priority table
- **Scoring** — the faan patterns and the payout table
- **Table** — play a full round as East against three bots
- **Drills** — name the tile, chow/pung/nothing, can you claim it, score the hand

One static `index.html`. No build, no dependencies. Tiles are Unicode glyphs (U+1F000–U+1F02B), so there are no images to host or keep in sync.

## Check

`node selfcheck.mjs` runs the page's own scripts against a stub DOM and asserts the hand analyzer — tile conservation, set decomposition, honours never forming runs, chow-only-from-your-left, kong arithmetic, and the faan values for each scoring pattern.

Payout tables and the exact faan for smaller patterns vary table to table — agree on house rules before the first deal. The practice table enforces no minimum faan, and only supports konging on a discard.
