// Runs mahjong.js and the play page's engine against a stub DOM, then asserts
// the hand analyzer and plays complete rounds to check the engine's invariants.
//   node selfcheck.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const read = f => readFileSync(new URL(f, import.meta.url), "utf8");
const inline = f => [...read(f).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const bodies = [read("mahjong.js"), ...inline("play.html")];
assert.equal(bodies.length, 2, "expected mahjong.js plus one inline script in play.html");

class E {
  constructor(tag){
    this.tagName = tag; this.children = []; this.dataset = {};
    this.style = { setProperty(){}, cssText: "" };
    this.classList = { add(){}, remove(){} };
    this.clientWidth = 1200; this.clientHeight = 700;
  }
  append(...k){ this.children.push(...k); }
  replaceChildren(...k){ this.children = k; }
  setAttribute(){}
  querySelectorAll(){ return []; }
  focus(){}
}
// setTimeout runs inline, so a whole round plays out synchronously
const context = {
  document: { createElement: t => new E(t), getElementById: () => new E("div") },
  setTimeout: fn => (fn(), 0),
  clearTimeout(){},
  requestAnimationFrame: fn => (fn(), 0),
  addEventListener(){},
  matchMedia: () => ({ matches: false }),
  Math, Set, Map, Object, Array, String, Number, JSON, console,
};

const TESTS = `
const ok = (c, m) => { if (!c) throw new Error(m); };
const Wn = t => findWin(t, []);
const CTX = {seatWind:"E", roundWind:"E", concealed:true, selfDraw:false};
const faanOf = t => { const a = analyze(t, [], CTX); ok(a, "expected a win: " + t); return a.score.faan; };
const named = t => analyze(t, [], CTX).score.pats.map(p => p.n);

/* ── the analyzer ─────────────────────────────────────────────────────── */

// 1. a plain winning hand parses into four sets and a pair
ok(ALL.length === 34, "34 tile types, got " + ALL.length);
const d = Wn(["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B","B"]);
ok(d.length >= 1 && d[0].sets.length === 4 && d[0].pair === "B", "4 sets + B pair");

// 2. honours never form runs
ok(Wn(["E","S","W","1m","2m","3m","4s","5s","6s","7p","8p","9p","C","C"]).length === 0,
   "E-S-W must not count as a chow");

// 3. a chow may not cross suits
ok(Wn(["3m","4m","5s","1m","2m","3m","4s","5s","6s","7p","8p","9p","C","C"]).length === 0,
   "3m-4m-5s must not count as a chow");

// 4. thirteen orphans
ok(faanOf(["1m","9m","1s","9s","1p","9p","E","S","W","N","C","F","B","1m"]) === 14,
   "orphans 13 + concealed 1");

// 5. pattern scoring (each +1 for fully concealed)
ok(faanOf(["1p","2p","3p","4p","5p","6p","7p","8p","9p","2p","2p","2p","5p","5p"]) === 8,
   "full flush 7 + concealed");
ok(faanOf(["2s","3s","4s","6s","7s","8s","9s","9s","9s","C","C","C","W","W"]) === 5,
   "half flush 3 + dragon pung 1 + concealed 1");
ok(faanOf(["C","C","C","F","F","F","B","B","B","3m","4m","5m","7s","7s"]) === 9,
   "big three dragons 8 + concealed");
ok(named(["3m","3m","3m","7s","7s","7s","9p","9p","9p","E","E","E","5m","5m"]).includes("All pungs"),
   "all pungs detected");
// an East pung scores seat wind AND round wind for the dealer in an East round
ok(faanOf(["3m","3m","3m","7s","7s","7s","9p","9p","9p","E","E","E","5m","5m"]) === 6,
   "all pungs 3 + seat wind 1 + round wind 1 + concealed 1");

// 6. when a hand parses two ways, the better-scoring reading wins.
// 111m 222m 333m reads as three pungs (all pungs) or three chows (not) — take the pungs.
ok(faanOf(["1m","1m","1m","2m","2m","2m","3m","3m","3m","C","C","C","9m","9m"]) === 8,
   "all pungs 3 + half flush 3 + dragon pung 1 + concealed 1");

// 7. waits: the hand from test 1, one tile short
const waits = waitsFor(["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B"]);
ok(waits.length === 1 && waits[0] === "B", "should wait on B alone, got " + waits);

// 8. a melded kong counts as one set; the replacement tile keeps the count right
ok(findWin(["2m","3m","4m","7p","8p","9p","E","E","E","B","B"],
           [{type:"kong", tiles:["5s","5s","5s","5s"]}]).length === 1, "kong hand should win");

// 9. payout table
ok(units(3) === 8 && units(9) === 96 && units(13) === 128, "faan to units");

/* ── shanten and the discard advice ───────────────────────────────────── */

// 10. shanten counts the swaps still needed: 0 is ready, -1 is already won
const sh = (t, m) => shapeOf(counts(t), m || 0).sh;
ok(sh(["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B"]) === 0, "that hand is ready");
ok(sh(["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B","B"]) === -1, "a complete hand is -1");
ok(sh(["1m","3m","5m","7m","9m","2s","4s","6s","8s","1p","3p","E","C"]) === 4, "scattered hand is 4 away");
ok(sh(["1m","9m","1s","9s","1p","9p","E","S","W","N","C","F","3m"]) === 1,
   "twelve orphans is one away via the orphan shape");
ok(sh(["2m","3m","4m","7p","8p","9p","E","E","E","B"], 1) === 0, "ready with one meld exposed");

// 11. the blocks a line keeps must actually be in the hand, and must add up
for (let k = 0; k < 200; k++) {
  const bag = shuffle(ORDER.concat(ORDER, ORDER, ORDER));
  const hand = bag.slice(0, 13);
  const shape = shapeOf(counts(hand), 0);
  const have = counts(hand), used = counts(shape.blocks.flatMap(blockTiles));
  ok(used.every((n, i) => n <= have[i]), "kept blocks are not all in the hand: " + hand);
  ok(shape.sh >= -1 && shape.sh <= 8, "shanten out of range: " + shape.sh);
}

// 12. advice always names a tile in the hand and takes the best line available
const seenOf = h => counts(h);
for (let k = 0; k < 60; k++) {
  const hand = shuffle(ORDER.concat(ORDER, ORDER, ORDER)).slice(0, 14);
  const a = advise(hand, [], seenOf(hand), {seatWind:"E", roundWind:"E"});
  ok(hand.includes(a.pick.t), "advised a tile not in hand: " + a.pick.t);
  // no other discard can leave a better hand than the one it picked
  const best = Math.min(...[...new Set(hand)].map(t => {
    const rest = hand.slice(); rest.splice(rest.indexOf(t), 1);
    return shapeOf(counts(rest), 0).sh;
  }));
  ok(a.sh === best, "advice missed a better discard: " + a.sh + " vs " + best);
  // every accepted tile really does improve the hand, and only counts live copies
  a.pick.accept.forEach(x => {
    const c = counts(a.pick.rest); c[IDX[x.t]]++;
    ok(shapeOf(c, 0).sh < a.sh, "listed " + x.t + " as help when it isn't");
    ok(x.left >= 1 && x.left <= 4, "impossible live count for " + x.t + ": " + x.left);
  });
}

// 13. one tile short of a win, the advice keeps the ready hand and names the winning tile
const ready = advise(["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B","9s"], [],
                     seenOf(["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B","9s"]),
                     {seatWind:"E", roundWind:"E"});
ok(ready.pick.t === "9s" && ready.sh === 0, "should throw the odd 9s and stay ready");
ok(ready.pick.accept.length === 1 && ready.pick.accept[0].t === "B", "the wait is the white dragon");
ok(ready.pick.accept[0].left === 3, "one B is in hand, so three are still live");

// 14. a tile already all accounted for is never counted as live help
const gone = counts(["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B","9s"]);
gone[IDX["B"]] = 4;
const dead = advise(["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B","9s"], [], gone,
                    {seatWind:"E", roundWind:"E"});
ok(dead.pick.accept.every(x => x.t !== "B"), "all four B are seen, so B is not live");

/* ── house rules ──────────────────────────────────────────────────────── */

// 15. defaults are the usual Hong Kong table
ok(RULES.min === 3 && RULES.limit === 10 && RULES.s3d === 5 && RULES.allchow === 0,
   "unexpected defaults: " + JSON.stringify(RULES));

// 16. a variable pattern really does follow its setting
const s3dHand = ["C","C","C","F","F","F","B","B","2p","3p","4p","6s","7s","8s"];
ok(faanOf(s3dHand) === 6, "small three dragons 5 + concealed 1");
RULES.s3d = 3;
ok(faanOf(s3dHand) === 4, "small three dragons now 3 + concealed 1");
RULES.s3d = 5;

// 17. switching a pattern off removes it entirely
const plain = ["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B","B"];
const before = faanOf(plain);
RULES.conc = 0;
ok(faanOf(plain) === before - 1, "concealed faan should vanish when it is off");
ok(!named(plain).includes("Fully concealed"), "and stop being listed");
RULES.conc = 1;

// 18. all chows is off by default and only fires on four runs with a plain pair
const chowy = ["1m","2m","3m","4s","5s","6s","7p","8p","9p","3p","4p","5p","2s","2s"];
ok(!named(chowy).includes("All chows"), "off by default");
RULES.allchow = 1;
ok(named(chowy).includes("All chows"), "on when switched on");
ok(!named(plain).includes("All chows"), "never for a hand with pungs");
RULES.allchow = 0;

// 19. the limit is where the payout table stops
ok(units(10) === 128 && units(13) === 128, "capped at 10 faan by default");
RULES.limit = 13;
ok(units(10) === 128 && units(13) === 384 && units(20) === 384, "capped at 13 when set there");
RULES.limit = 10;

// 20. complete is not the same as declarable
const cheap = analyze(chowy, [], CTX);
ok(cheap && cheap.score.faan < 3, "that hand is complete but cheap");
ok(!declarable(cheap), "and cannot be declared on a 3-faan table");
RULES.min = 0;
ok(declarable(cheap), "but can when the table has no minimum");
RULES.min = 3;

/* ── the engine: play complete rounds ─────────────────────────────────── */

// seat 0 is a person, so the round parks until we act. Play it randomly:
// pass or claim, discard, and declare a win whenever one is on offer.
function autoPlay() {
  for (let guard = 0; guard < 4000 && !W.over; guard++) {
    if (W.phase === "claim" && W.pend) {
      const p = W.pend;
      const take = p.opts.find(o => o.k === "win")
        || (Math.random() < 0.4 ? p.opts[Math.random() * p.opts.length | 0] : null);
      settle(p.from, p.tile, p.bots, take);
    } else if (W.phase === "discard" && W.turn === 0) {
      if (W.canWin) { done({seat: 0, by: null, a: W.canWin, tile: null}); }
      else {
        const h = W.hand[0].concat(W.drawn[0] ? [W.drawn[0]] : []);
        discard(0, h[Math.random() * h.length | 0]);
      }
    } else if (!W.over) {
      throw new Error("stuck: phase=" + W.phase + " turn=" + W.turn + " busy=" + W.busy);
    }
  }
}

const held = () => W.wall
  .concat(W.hand.flat(), W.flow.flat(), W.river, W.drawn.filter(Boolean))
  .concat(W.meld.flat().flatMap(m => m.tiles));

let wins = 0, washouts = 0;
for (let round = 0; round < 25; round++) {
  startRound();                       // setTimeout is inline: bots move until it is our turn
  autoPlay();
  ok(W.over, "round " + round + " should have finished");

  const all = held();
  ok(all.length === 144, "round " + round + ": " + all.length + " tiles, expected 144");
  ok(new Set(all.map(t => t.i)).size === 144, "round " + round + ": duplicated tiles");

  const seen = {};
  all.forEach(t => { seen[t.t] = (seen[t.t] || 0) + 1; });
  ORDER.forEach(t => ok((seen[t] || 0) === 4, "round " + round + ": " + seen[t] + " copies of " + t));
  Object.keys(BONUS).forEach(t => ok(seen[t] === 1, "round " + round + ": " + seen[t] + " of " + t));

  // nobody may hold more tiles than their melds allow
  for (let s = 0; s < 4; s++) {
    const conceal = W.hand[s].length + (W.drawn[s] ? 1 : 0);
    ok(conceal <= 14 - 3 * W.meld[s].length,
       "round " + round + " seat " + s + ": " + conceal + " concealed with " + W.meld[s].length + " melds");
  }

  if (W.result) {
    wins++;
    const s = W.result.seat;
    const hand = W.hand[s].concat(W.drawn[s] ? [W.drawn[s]] : []).map(t => t.t);
    const melds = W.meld[s].map(m => ({type: m.type, tiles: m.tiles.map(t => t.t)}));
    ok(findWin(hand, melds).length >= 1, "round " + round + ": declared winner does not hold a winning hand");
    ok(W.result.a && W.result.a.score.faan >= RULES.min,
       "round " + round + ": winner declared on " + W.result.a.score.faan + " faan under a " + RULES.min + " minimum");
  } else washouts++;
}
ok(wins > 0, "25 rounds produced no wins at all — the bots are broken");

// 10. a chow may only be claimed from the previous player; a pung from anyone
startRound();
W.meld[0] = []; W.drawn[0] = null;
W.hand[0] = ["3m","4m","1s","2s","3s","5p","6p","7p","C","C","F","F","N"].map((t,i) => ({i:900+i, t}));
const kinds = from => options(0, from, "5m").map(o => o.k);
ok(kinds(3).includes("chow"), "chow from the player on your left (seat 3)");
ok(!kinds(1).includes("chow") && !kinds(2).includes("chow"), "no chow from anyone else");
W.hand[0] = ["5m","5m","1s","2s","3s","5p","6p","7p","C","C","F","F","N"].map((t,i) => ({i:900+i, t}));
ok([1,2,3].every(f => options(0, f, "5m").map(o => o.k).includes("pung")), "pung from any seat");

console.log("selfcheck: all assertions passed (" + wins + " wins, " + washouts
  + " washouts in 25 rounds at a " + RULES.min + "-faan minimum)");
`;

vm.createContext(context);
vm.runInContext(bodies.join("\n") + "\n" + TESTS, context, { timeout: 120000 });
