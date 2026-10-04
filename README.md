# learn-mahjong

An interactive guide to **Hong Kong old style** mahjong (香港麻雀) and **Riichi** (立直麻雀, Japanese, to Tenhou's rules), plus a table you can actually play in either.

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

### The score sheet — `score.html`
For a real table. Start a session (Hong Kong or Riichi, four player names), record each hand as it ends — who won, off whom, the faan or han and fu — and it works out the payments. Riichi sessions also track the dealer, honba, riichi sticks and tenpai payments at a draw, and optionally take a second winner (double ron — honba and sticks go to the winner nearest the discarder's turn) and a pao seat for a yakuman. A **penalty (chombo)** costs a reverse mangan in Riichi (the hand is replayed) or, in Hong Kong, the chosen faan paid to each of the other three. Abortive draws (triple ron, nine terminals and the rest) and double or triple yakuman are covered too, with pao charging the liable seat one yakuman and the rest paid as usual. Riichi sheets show each player's **final score** as if the game ended now: points less the return score (30,000 or 25,000) plus uma (none, 5-10, 10-20, 10-30, 20-30), with the oka and any leftover sticks going to first and ties to the seat nearer the first dealer. Every hand carries its **working** — the base, the multiplier, the honba, who took the sticks — written by the same function that pays it, and a **How scoring works** panel sums up the rules. Scores are points by default; set a **money** rate (per unit in Hong Kong, per 1,000 points in Riichi) and a currency to see each player's takings — it is a display rate, so it can change at any time. Keep as many sessions as you like; they live in the browser's localStorage. Each hand stores its result when entered, so changing house rules later never rewrites an old sheet.

**Share PDF** builds a PDF of the sheet and hands it to the browser's share sheet, or downloads it where file sharing isn't supported. It uses the PDF's built-in Courier font, so names outside Latin-1 (e.g. Chinese characters) print as `?`.

### Riichi
Pick **Riichi 立直** from the variant picker in the guide's nav or the table's HUD; the choice persists in the browser and both pages follow it. The guide's sections, hand builder, scoring tables and drills switch over; the table plays a full hanchan (East and South, into West if nobody reaches 30,000) against three bots, with points, honba and riichi sticks carried hand to hand.

The rules are Tenhou's, fixed rather than settings: 136 tiles with three red fives, open tanyao, kuikae forbidden, no kiriage mangan, kazoe yakuman at 13 han, double ron (triple ron aborts), pao for big three dragons and big four winds, nagashi mangan, and the abortive draws (nine terminals, four winds, four riichi, four kongs). Furiten in all three forms blocks ron. The coach adapts: seven-pairs-aware discard advice, whether to declare riichi or stay concealed, furiten warnings, calls that would leave the hand without a yaku, and your safe tiles once someone has declared.

Not modelled: kongs declared during riichi are allowed only when they keep the waits identical (Tenhou's stricter shape test is not applied), and called tiles are not drawn sideways in melds.

### Language
English or Bahasa Indonesia, switched from the picker in the guide's nav and the table's HUD; the choice persists in the browser. The table vocabulary is left as it is spoken — chow, pung, kong, faan and the Cantonese stay put — and only the prose around them is translated.

Dictionaries live in `i18n.js`, keyed by the English source string, so a missing entry simply falls through to English. Static markup carries no keys: `applyI18n` walks the text nodes once and swaps whole strings, and anything built by script goes through `t()` / `tf()`.

### Layout
| file | what it is |
|---|---|
| `mahjong.js` | tile model, hand analyzer, faan scoring, shanten and the discard advice — shared by both pages |
| `riichi.js` | the Riichi engine: yaku, fu, points, dora, waits, riichi and furiten helpers, and the Riichi coach |
| `i18n.js` | the translations, keyed by the English string |
| `index.html` | the guide |
| `score.html` | the score sheet |
| `play.html` | the table |
| `selfcheck.mjs` | the tests |

No build, no dependencies. Tiles are Unicode glyphs (U+1F000–U+1F02B), so there are no images to host or keep in sync.

## Check

`node selfcheck.mjs` runs both pages' scripts against a stub DOM and asserts:

- **the analyzer** — set decomposition, honours never forming runs, chows not crossing suits, kong hand-size arithmetic, the faan value of each scoring pattern, and that an ambiguous hand is read the highest-scoring way
- **shanten and advice** — known shanten values, that the blocks a line claims to keep are really in the hand, that the advice never misses a better discard, and that a tile nobody can still draw is never counted as help
- **the score sheet** — every payment shape in both variants (ron, tsumo, draws, abortive draws, double ron, pao, chombo), dealer rotation, final scores with uma and oka, the per-hand working, and that the PDF writer's cross-reference table lands on every object
- **riichi scoring** — yaku, fu and points checked against Tenhou's tables (pinfu tsumo 700/1300, no kiriage at 4 han 30 fu, suuankou only on tsumo or tanki, ryanpeikou read over seven pairs, pao payments, and more), plus the Riichi coach's advice
- **the Riichi table** — three complete hanchans played out, checking 136 tiles and three red fives every hand, that points plus riichi sticks always total 100,000, and that no winner lacks a yaku or rons while furiten
- **the engine** — 25 complete rounds played out, checking every round that all 144 tiles are accounted for with no duplicates, that nobody holds more than their melds allow, and that a declared winner really does hold a winning hand

## House rules

Hong Kong old style is a family of tables, not one rulebook, so the points that genuinely differ are settings rather than assumptions — the minimum faan to declare (3 by default), where the payout table caps out, the value of small three dragons, small four winds and all honours, and whether fully concealed, no flowers and all chows count at all. Change them in the guide's **House rules** panel and the faan list, the hand builder and the table all follow; they persist in the browser.

Patterns belonging to other variants are deliberately absent. Three similar sequences (三色同順 — 123 in all three suits) is a Riichi and Chinese Official pattern, not a Hong Kong one, so a hand holding it scores nothing extra here; offering it as a switch would not make this a Hong Kong table.

