# learn-mahjong

An interactive guide to **Hong Kong old style** mahjong (香港麻雀), plus a table you can actually play.

**→ https://nicholaslie90.github.io/learn-mahjong/**

### The guide — `index.html`
- **Tiles** — all 144, labelled, coloured by suit
- **Sets** — chow, pung, kong, pair
- **Build a hand** — click tiles into a hand; at 13 it shows every tile you're waiting on, at 14 it splits the hand into melds and scores it
- **Play** — turn order and the claim priority table
- **Scoring** — the faan patterns and the payout table
- **Drills** — name the tile, chow/pung/nothing, can you claim it, score the hand

### The table — `play.html`
A full animated round as East against three bots. Tiles deal in the traditional order, fly between wall, hand, melds and the discard pile, and opponents' hands stay face down until someone wins. Claims are legal-only and priority is enforced — a bot's pung really does beat your chow.

**A coach on every turn.** It names the tile to discard and why ("a lone honour: it can never join a run"), shows the blocks that discard keeps, how many swaps you are from ready, and every live tile that would improve the hand — counting only copies nobody has shown yet. When a call is on offer it tells you whether taking it actually buys you progress or just costs you the concealed-hand faan. Toggle it with **Hints** in the header.

### Layout
| file | what it is |
|---|---|
| `mahjong.js` | tile model, hand analyzer, faan scoring, shanten and the discard advice — shared by both pages |
| `index.html` | the guide |
| `play.html` | the table |
| `selfcheck.mjs` | the tests |

No build, no dependencies. Tiles are Unicode glyphs (U+1F000–U+1F02B), so there are no images to host or keep in sync.

## Check

`node selfcheck.mjs` runs both pages' scripts against a stub DOM and asserts:

- **the analyzer** — set decomposition, honours never forming runs, chows not crossing suits, kong hand-size arithmetic, the faan value of each scoring pattern, and that an ambiguous hand is read the highest-scoring way
- **shanten and advice** — known shanten values, that the blocks a line claims to keep are really in the hand, that the advice never misses a better discard, and that a tile nobody can still draw is never counted as help
- **the engine** — 25 complete rounds played out, checking every round that all 144 tiles are accounted for with no duplicates, that nobody holds more than their melds allow, and that a declared winner really does hold a winning hand

## House rules

Hong Kong old style is a family of tables, not one rulebook, so the points that genuinely differ are settings rather than assumptions — the minimum faan to declare (3 by default), where the payout table caps out, the value of small three dragons, small four winds and all honours, and whether fully concealed, no flowers and all chows count at all. Change them in the guide's **House rules** panel and the faan list, the hand builder and the table all follow; they persist in the browser.

Patterns belonging to other variants are deliberately absent. Three similar sequences (三色同順 — 123 in all three suits) is a Riichi and Chinese Official pattern, not a Hong Kong one, so a hand holding it scores nothing extra here; offering it as a switch would not make this a Hong Kong table.

The table only supports konging on a discard — concealed and added kongs are not implemented.
