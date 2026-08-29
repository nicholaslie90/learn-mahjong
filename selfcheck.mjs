// Runs index.html's scripts against a stub DOM and asserts the hand analyzer.
// node selfcheck.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const bodies = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert.equal(bodies.length, 2, "expected two inline scripts");

class E {
  constructor(tag){ this.tagName=tag; this.children=[]; this.style={setProperty(){},cssText:""}; this.dataset={};
    this.classList={add(){},remove(){}}; }
  append(...k){ this.children.push(...k); }
  replaceChildren(...k){ this.children=k; }
  setAttribute(){}
  querySelectorAll(){ return []; }
}
const context = {
  document: { createElement: t => new E(t), getElementById: () => new E("div") },
  setTimeout: () => 0,
  Math, Set, Map, Object, Array, String, Number, JSON, console,
};

const TESTS = `
const ok = (c, m) => { if (!c) throw new Error(m); };
const W = t => findWin(t, []);
const CTX = {seatWind:"E", roundWind:"E", concealed:true, selfDraw:false};
const faanOf = t => { const a = analyze(t, [], CTX); ok(a, "expected a win: " + t); return a.score.faan; };
const named = t => analyze(t, [], CTX).score.pats.map(p => p.n);

// 1. wall composition: 136 playing tiles + 8 bonus
ok(ALL.length === 34, "34 tile types, got " + ALL.length);
startRound();
ok(G.wall.length + G.hand.flat().length + G.flow.flat().length + G.river.length === 144,
   "tiles must be conserved: 136 playing + 8 bonus");

// 2. a plain winning hand parses into four sets and a pair
const win = ["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B","B"];
const d = W(win);
ok(d.length >= 1, "should be a win");
ok(d[0].sets.length === 4 && d[0].pair === "B", "4 sets + B pair");

// 3. honours never form runs
ok(W(["E","S","W","1m","2m","3m","4s","5s","6s","7p","8p","9p","C","C"]).length === 0,
   "E-S-W must not count as a chow");

// 4. a chow may not cross suits
ok(W(["3m","4m","5s","1m","2m","3m","4s","5s","6s","7p","8p","9p","C","C"]).length === 0,
   "3m-4m-5s must not count as a chow");

// 5. thirteen orphans
ok(faanOf(["1m","9m","1s","9s","1p","9p","E","S","W","N","C","F","B","1m"]) === 13 + 1,
   "orphans = 13 faan + concealed");

// 6. pattern scoring (each +1 for fully concealed)
ok(faanOf(["1p","2p","3p","4p","5p","6p","7p","8p","9p","2p","2p","2p","5p","5p"]) === 8,
   "full flush 7 + concealed");
ok(faanOf(["2s","3s","4s","6s","7s","8s","9s","9s","9s","C","C","C","W","W"]) === 5,
   "half flush 3 + dragon pung 1 + concealed 1");
ok(faanOf(["C","C","C","F","F","F","B","B","B","3m","4m","5m","7s","7s"]) === 9,
   "big three dragons 8 + concealed");
ok(named(["3m","3m","3m","7s","7s","7s","9p","9p","9p","E","E","E","5m","5m"])
     .includes("All pungs"), "all pungs detected");
// East pung scores seat wind AND round wind for the dealer in an East round
ok(faanOf(["3m","3m","3m","7s","7s","7s","9p","9p","9p","E","E","E","5m","5m"]) === 6,
   "all pungs 3 + seat wind 1 + round wind 1 + concealed 1");

// 7. when a hand parses two ways, the better-scoring reading wins.
// 111m 222m 333m reads as three pungs (all pungs) or three chows (not) — take the pungs.
ok(faanOf(["1m","1m","1m","2m","2m","2m","3m","3m","3m","C","C","C","9m","9m"]) === 8,
   "all pungs 3 + half flush 3 + dragon pung 1 + concealed 1");

// 8. waits: 13 tiles one short of the hand above
const waits = waitsFor(["2m","3m","4m","5s","5s","5s","7p","8p","9p","E","E","E","B"]);
ok(waits.length === 1 && waits[0] === "B", "should wait on B alone, got " + waits);

// 9. a melded kong still counts as one set, and the replacement tile keeps the count right
ok(findWin(["2m","3m","4m","7p","8p","9p","E","E","E","B","B"],
           [{type:"kong", tiles:["5s","5s","5s","5s"]}]).length === 1, "kong hand should win");

// 10. payout table
ok(units(3) === 8 && units(9) === 96 && units(13) === 128, "faan to units");

// 11. chow is claimable only from the previous player
G.hand[0] = ["3m","4m","1s","2s","3s","5p","6p","7p","C","C","F","F","N"];
G.meld[0] = [];
const kinds = (from) => claimOptions(0, from, "5m").map(o => o.k);
ok(kinds(3).includes("chow"), "chow from the player on your left (seat 3)");
ok(!kinds(1).includes("chow") && !kinds(2).includes("chow"), "no chow from anyone else");
G.hand[0] = ["5m","5m","1s","2s","3s","5p","6p","7p","C","C","F","F","N"];
ok([1,2,3].every(f => claimOptions(0, f, "5m").map(o => o.k).includes("pung")),
   "pung from any seat");

// 12. randomHand always produces what it claims
for (let i = 0; i < 40; i++) {
  ok(W(randomHand(14)).length >= 1, "dealt hand must be a win");
  ok(waitsFor(randomHand(13)).length >= 1, "dealt hand must be one tile short");
}
console.log("selfcheck: all assertions passed");
`;

vm.createContext(context);
vm.runInContext(bodies.join("\n") + "\n" + TESTS, context, { timeout: 30000 });
