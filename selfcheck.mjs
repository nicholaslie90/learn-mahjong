// Runs mahjong.js and the play page's engine against a stub DOM, then asserts
// the hand analyzer and plays complete rounds to check the engine's invariants.
//   node selfcheck.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const read = f => readFileSync(new URL(f, import.meta.url), "utf8");
const inline = f => [...read(f).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const bodies = [read("mahjong.js"), read("riichi.js"), ...inline("play.html")];
assert.equal(bodies.length, 3, "expected mahjong.js, riichi.js plus one inline script in play.html");

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
  replaceWith(){}
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
/* ── riichi: yaku, fu and points against Tenhou's tables ──────────────── */
{
// "234m9p9pEE" -> ["2m","3m","4m","9p","9p","E","E"]
const T = s => s.match(/[1-9]+[msp]|[ESWNBFC]/g).flatMap(g => /[msp]/.test(g) ? [...g.slice(0,-1)].map(n => n + g.slice(-1)) : [g]);
const RC = o => Object.assign({seatWind:"S", roundWind:"E", dealer:false, tsumo:false}, o||{});
const R = (h, win, o, melds) => rScore(T(h), melds||[], win, RC(o));
const names = a => a.yaku.map(y => y.n);

ok(doraOf("9p")==="1p" && doraOf("N")==="E" && doraOf("C")==="B" && doraOf("B")==="F" && doraOf("4s")==="5s", "dora order");

// riichi + tsumo + pinfu, 3 han 20 fu: 700/1300
let a = R("234m567m234p678s9p9p", "8s", {tsumo:true, riichi:true});
ok(a.han===3 && a.fu===20 && a.pay.dealer===1300 && a.pay.other===700, "pinfu tsumo " + JSON.stringify(a));
// pinfu ron alone: 1 han 30 fu, 1000
a = R("234m567m234p678s9p9p", "8s");
ok(a.han===1 && a.fu===30 && a.pay.ron===1000 && names(a).includes("Pinfu"), "pinfu ron");
// seven pairs with riichi: 3 han 25 fu, 3200
a = R("1m1m4m4m7p7p2s2sEECCFF", "F", {riichi:true});
ok(a.form==="chiitoi" && a.han===3 && a.fu===25 && a.pay.ron===3200, "chiitoi " + JSON.stringify(a));
// open chun pung, tanki: 1 han, 26 fu rounds to 30, 1000
const chun = [{type:"pung", tiles:["C","C","C"], open:true}];
a = R("2m3m4m6p7p8p3s4s5s9m9m", "9m", {}, chun);
ok(a.han===1 && a.fu===30 && a.pay.ron===1000, "open chun " + JSON.stringify(a));
// open hand with no yaku cannot win
a = R("6p7p8p3s4s5s1m1m1m9m9m", "9m", {}, [{type:"chow", tiles:["2m","3m","4m"], open:true}]);
ok(a && !rCanWin(a), "no yaku, no win");
// closed: riichi + chun + kanchan, 2 han 40 fu, 2600
a = R("CCC4p5p6p7s8s9s2m3m4m5m5m", "3m", {riichi:true});
ok(a.han===2 && a.fu===40 && a.pay.ron===2600, "kanchan chun " + JSON.stringify(a));
// 4 han 30 fu is 7700 — Tenhou does not round it up to mangan
a = R("2m3m4m5p6p7p3s4s5s6s7s8s5m5m", "8s", {riichi:true, dora:["1m"]});
ok(a.han===4 && a.fu===30 && a.pay.ron===7700, "no kiriage " + JSON.stringify(a));
// four concealed pungs: yakuman on tsumo, only toitoi + sanankou on a shanpon ron
a = R("1m1m1m3p3p3p5s5s5s7s7s7s9m9m", "7s", {tsumo:true});
ok(a.yakuman===1 && a.pay.dealer===16000 && a.pay.other===8000, "suuankou tsumo");
a = R("1m1m1m3p3p3p5s5s5s7s7s7s9m9m", "7s");
ok(!a.yakuman && a.han===4 && a.fu===50 && a.pay.ron===8000, "suuankou ron is mangan " + JSON.stringify(a));
// twice pure double chow beats reading it as seven pairs
a = R("2m2m3m3m4m4m5p5p6p6p7p7p8s8s", "8s");
ok(names(a).includes("Twice pure double chow") && a.pay.ron===8000, "ryanpeikou " + JSON.stringify(a));
// thirteen orphans, dealer ron: 48000
a = R("1m9m1s9s1p9pESWNBFC1m", "1m", {dealer:true});
ok(a.yakuman===1 && a.pay.ron===48000, "kokushi");
// dealer tsumo 3 han 30 fu: 2000 all
a = R("2m3m4m5p6p7p3s4s5sCCC5m5m", "5m", {dealer:true, tsumo:true, seatWind:"E", riichi:true});
ok(a.han===3 && a.fu===40 && a.pay.all===2600, "dealer tsumo " + JSON.stringify(a));
// dora count only when there is a yaku; ura only under riichi
a = R("2m3m4m5p6p7p3s4s5s6s7s8s5m5m", "8s", {dora:["4m"], ura:["4m"]});
ok(a.dora.dora===2 && a.dora.ura===0, "dora " + JSON.stringify(a.dora));
// nine gates waits on all nine
ok(rWaits(T("1m1m1m2m3m4m5m6m7m8m9m9m9m"), []).length===9, "chuuren waits");
ok(R("1m1m1m2m3m4m5m6m7m8m9m9m9m5m", "5m").yakuman===1, "chuuren is yakuman");
// seven-pairs shanten: six pairs and a single is ready
ok(rShanten(counts(T("1m1m4m4m7p7p2s2sEECCF")), 0)===0, "chiitoi tenpai");
// riichi candidates leave the hand ready
ok(rRiichiDiscards(T("234m567m234p678s9pN"), []).sort().join()==="9p,N", "N or 9p keeps it ready");
ok(rRiichiDiscards(T("234m567m234p68s9pN1s"), []).length===0, "two loose tiles: not ready");
}

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
    if (W.phase === "rob") rob(W.pend.from, W.pend.tile, 0);
    else if (W.phase === "claim" && W.pend) {
      const p = W.pend;
      const take = p.opts.find(o => o.k === "win")
        || (Math.random() < 0.4 ? p.opts[Math.random() * p.opts.length | 0] : null);
      settle(p.from, p.tile, p.bots, take);
    } else if (W.phase === "discard" && W.turn === 0) {
      if (W.canWin) { done({seat: 0, by: null, a: W.canWin, tile: null}); }
      else if (selfKongs(0).length && Math.random() < 0.7) selfKong(0, selfKongs(0)[0]);
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

// 11. three in hand plus the fourth drawn: kong it, and a replacement comes off the back
startRound();
W.meld[0] = [];
W.hand[0] = ["6m","7m","7m","7m","5s","5s","6s","8s","8s","8s","1p","3p","6p"].map((t,i) => ({i:900+i, t}));
W.drawn[0] = {i:913, t:"7m"};
W.canWin = null; W.phase = "discard"; W.turn = 0;
ok(selfKongs(0).includes("7m"), "four 7m in hand should offer a kong");
const back = W.wall[W.wall.length - 1];
selfKong(0, "7m");
ok(W.meld[0].length === 1 && W.meld[0][0].type === "kong" && W.meld[0][0].tiles.length === 4, "kong laid down");
ok(W.hand[0].length === 10 && W.drawn[0], "10 in hand plus a replacement draw");
ok(BONUS[back.t] || W.drawn[0] === back, "replacement comes from the back of the wall");
ok(ctxFor(0, true).concealed, "a concealed kong keeps the hand concealed");
// and the fourth tile onto a melded pung
W.meld[0].push({type:"pung", tiles:[{i:950,t:"E"},{i:951,t:"E"},{i:952,t:"E"}]});
W.drawn[0] = {i:953, t:"E"};
ok(selfKongs(0).includes("E"), "fourth tile onto a pung should offer a kong");

// 12. a win on the kong replacement scores 槓上開花; after a discard it does not
W.rep = 0;
ok(ctxFor(0, true).kongDraw && !ctxFor(0, false).kongDraw, "replacement draw flagged only for self-draw");
ok(scoreWin({pair:"B", sets:[]}, [], {kongDraw:true}).pats.some(p => p.zh === "槓上開花"), "kong replacement faan");
ok(scoreWin({pair:"B", sets:[]}, [], {robbed:true}).pats.some(p => p.zh === "搶槓"), "robbing the kong faan");

// 13. robbing the kong: Right adds 5m to a pung; we are waiting on 5m, so we may rob it
startRound();
W.meld[1] = [{type:"pung", tiles:[{i:960,t:"5m"},{i:961,t:"5m"},{i:962,t:"5m"}]}];
W.hand[1] = W.hand[1].slice(0, 10); W.drawn[1] = {i:963, t:"5m"};
W.meld[0] = [];
W.hand[0] = ["3m","4m","E","E","E","C","C","C","F","F","F","B","B"].map((t,i) => ({i:970+i, t}));
W.drawn[0] = null; W.turn = 1; W.phase = "discard";
ok(robbers(1, "5m")[0] === 0, "we are first in line to rob");
selfKong(1, "5m");
ok(W.phase === "rob", "robbing is offered, got " + W.phase);
rob(W.pend.from, W.pend.tile, 0);
ok(W.over && W.result.seat === 0 && W.result.by === 1, "we win off Right");
ok(W.result.a.score.pats.some(p => p.zh === "搶槓"), "and it scores robbing the kong");
ok(W.meld[1][0].type === "pung", "Right's pung stays a pung");

/* ── riichi: play whole hanchans on the table ─────────────────────────── */

// seat 0 plays from the coach hook, with random riichi, calls, passes and kongs
function rAutoPlay() {
  for (let guard = 0; guard < 6000 && !W.over; guard++) {
    if (W.phase === "rob") Math.random() < .7 ? rRob() : rPassRob();
    else if (W.phase === "claim" && W.pend) {
      const p = W.pend, win = p.opts.find(o => o.k === "win");
      const take = win && Math.random() < .9 ? win
        : (Math.random() < .3 ? p.opts[Math.random() * p.opts.length | 0] : null);
      settle(p.from, p.tile, p.bots, take);
    } else if (W.phase === "discard" && W.turn === 0) {
      if (W.canWin && Math.random() < .9) winSelf(0);
      else if (W.kyu && Math.random() < .3) done({draw: "kyuushu", seat: 0});
      else if (rSelfKongs(0).length && Math.random() < .5) selfKong(0, rSelfKongs(0)[0]);
      else {
        if (canRiichi(0) && Math.random() < .7) W.rmode = true;
        const l = rLegal(0), a = riichiAdvice();
        const hit = a && Math.random() < .8 && l.find(x => x.t === a.t);
        discard(0, hit || l[Math.random() * l.length | 0]);
      }
    } else throw new Error("riichi stuck: phase=" + W.phase + " turn=" + W.turn + " busy=" + W.busy);
  }
}
const rHeld = () => W.wall.concat(W.ind, W.ura, W.rin, W.hand.flat(), W.river, W.drawn.filter(Boolean))
  .concat(W.meld.flat().flatMap(m => m.tiles));

VARIANT = "riichi";
let rHands = 0, rWins = 0, rRons = 0, rRiichi = 0, rDraws = {};
for (let game = 0; game < 3; game++) {
  G = null;
  for (let hand = 0; ; hand++) {
    ok(hand < 80, "game " + game + " never ended");
    startRound();
    rAutoPlay();
    const tag = "game " + game + " hand " + hand + ": ";
    ok(W.over, tag + "should have finished");
    rHands++;

    const all = rHeld();
    ok(all.length === 136, tag + all.length + " tiles, expected 136");
    ok(new Set(all.map(x => x.i)).size === 136, tag + "duplicated tiles");
    const seen = {};
    all.forEach(x => { seen[x.t] = (seen[x.t] || 0) + 1; });
    ORDER.forEach(x => ok(seen[x] === 4, tag + seen[x] + " copies of " + x));
    const red = all.filter(x => x.red);
    ok(red.length === 3 && red.map(x => x.t).sort().join() === "5m,5p,5s", tag + "red fives " + red.map(x => x.t));
    ok(W.ind.length + W.ura.length + W.rin.length === 14, tag + "dead wall is not 14");
    ok(W.kongs <= 4 && W.nd <= 1 + W.kongs, tag + W.kongs + " kongs, " + W.nd + " indicators");

    const sum = G.pts.reduce((a, b) => a + b, 0) + G.sticks * 1000;
    ok(sum === 100000, tag + "points + sticks = " + sum + " " + JSON.stringify(G));
    for (let s = 0; s < 4; s++) {
      const conceal = W.hand[s].length + (W.drawn[s] ? 1 : 0);
      ok(conceal <= 14 - 3 * W.meld[s].length, tag + "seat " + s + ": " + conceal + " concealed with " + W.meld[s].length + " melds");
    }
    rRiichi += W.ri.filter(Boolean).length;

    const r = W.result;
    if (r.wins) {
      ok(r.wins.length <= 2, tag + "triple ron should be a draw");
      r.wins.forEach(w => {
        rWins++;
        ok(rCanWin(w.a), tag + "declared without a yaku");
        const h = ids(full(w.seat)).concat(w.by != null && !full(w.seat).includes(w.inst) ? [w.tile] : []);
        ok(rShape(h, rMelds(w.seat)), tag + "seat " + w.seat + " declared on an incomplete hand " + h);
        if (w.by != null) { rRons++; ok(!furiten(w.seat), tag + "seat " + w.seat + " ronned while furiten"); }
      });
    } else rDraws[r.draw] = (rDraws[r.draw] || 0) + 1;
    if (G.over) break;
  }
  ok(G.over && G.pts.reduce((a, b) => a + b, 0) === 100000, "game " + game + " ended with " + JSON.stringify(G.pts));
}
ok(rWins > 0 && rRiichi > 0, "riichi: " + rWins + " wins, " + rRiichi + " riichi — the bots are broken");

// rAdvise: same contract as advise(), but seven pairs and orphans count
for (let k = 0; k < 60; k++) {
  const hand = shuffle(ORDER.concat(ORDER, ORDER, ORDER)).slice(0, 14);
  const a = rAdvise(hand, [], counts(hand), {seatWind:"E", roundWind:"E"});
  ok(hand.includes(a.pick.t), "rAdvise named a tile not in hand");
  const best = Math.min(...[...new Set(hand)].map(x => {
    const rest = hand.slice(); rest.splice(rest.indexOf(x), 1);
    return rShanten(counts(rest), 0);
  }));
  ok(a.sh === best, "rAdvise missed a better discard");
  a.pick.accept.forEach(x => {
    const c = counts(a.pick.rest); c[IDX[x.t]]++;
    ok(rShanten(c, 0) < a.sh && x.left >= 1 && x.left <= 4, "rAdvise listed a tile that is no help: " + x.t);
  });
}
const T2 = x => x.match(/[1-9]+[msp]|[ESWNBFC]/g).flatMap(g => /[msp]/.test(g) ? [...g.slice(0,-1)].map(n => n + g.slice(-1)) : [g]);
const RC2 = {seatWind:"S", roundWind:"E", dealer:false};
const cp = T2("1m1m4m4m7p7p2s2sEECC5s9s"), cpa = rAdvise(cp, [], counts(cp), {seatWind:"E", roundWind:"E"});
const noPair = cp.slice(); noPair.splice(noPair.indexOf("9s"), 1);
ok(cpa.sh === 0 && shapeOf(counts(noPair), 0).sh > 0, "seven pairs should beat the standard shape");
ok(cpa.pick.accept.length > 0, "seven-pairs wait is listed");
const rDead = counts(cp); rDead[IDX["C"]] = 4;
ok(rAdvise(cp, [], rDead, {seatWind:"E", roundWind:"E"}).pick.accept.every(x => x.t !== "C"), "rAdvise counted a dead tile");
const rOnly = rAdvise(cp, [], counts(cp), {seatWind:"E", roundWind:"E"}, ["9s"]);
ok(rOnly.pick.t === "9s" && rOnly.front.length === 1, "rAdvise ignores the allowed list");

// furiten: a wait that is in your own discards
const fw = T2("2m3m4m5p6p7p3s4s5s2p2p7s8s");              // waits 6s, 9s
ok(rWaits(fw, []).join() === "6s,9s", "setup waits " + rWaits(fw, []));
ok(rFuriWaits(fw, [], ["9s"]).join() === "9s" && rFuriWaits(fw, [], ["1m"]).length === 0, "furiten only on a thrown wait");
// yaku: pinfu-less no-yaku hand wins on tsumo only; tanyao wins on ron too
const nyw = rYakuWaits(T2("1m2m3m4p5p6p7s8s9s1s1s7p9p"), [], RC2);
ok(nyw.length === 1 && nyw.every(y => !y.ron && y.tsumo), "no yaku on a ron, tsumo ok: " + JSON.stringify(nyw));
const yk = rYakuWaits(T2("2m3m4m5p6p7p3s4s5s6s6s7s8s"), [], RC2);
ok(yk.length > 0 && yk.every(y => y.ron), "tanyao wait wins on ron");
// riichi advice: no yaku means riichi is the call; a thin wait with a yaku is not
const nh = T2("1m2m3m4p5p6p7s8s9s1s1s7p9pE"), na = rRiichiAdvice(nh, [], counts(nh), RC2, []);
ok(na && !na.yaku && na.go && na.t === "E", "no yaku: declare riichi: " + JSON.stringify(na && [na.t, na.go]));
const nf = rRiichiAdvice(nh, [], counts(nh), RC2, ["8p"]);
ok(nf.fur.length > 0, "a thrown wait is flagged furiten");
const th = T2("2m3m4m3s4s5s6s7s8s5p5p4p6p9m"), tseen = counts(th);
tseen[IDX["9m"]] = 4;
const ta = rRiichiAdvice(th, [], tseen, RC2, []);
ok(ta && ta.t === "9m" && ta.yaku && ta.live === 2 && !ta.go, "thin wait with a yaku: stay quiet: " + JSON.stringify(ta && [ta.t, ta.live, ta.go]));
// safe tiles and call shanten
ok(rSafe(T2("1m2m2m3p"), [["2m", "3p"], ["2m"]]).join() === "2m", "genbutsu must be safe against every riichi");
const ch = T2("2m3m5m6m8p8p3s4s6s7s9sEE"), cs = rCallShanten(ch, [], "4m", "chow", ["3m", "5m"]);
ok(cs.sh <= rShanten(counts(ch), 0) && cs.rest.length === 11, "call shanten " + cs.sh + " " + cs.rest.length);

// kuikae: chi 3m with 4m5m, and neither 3m nor 6m may be thrown straight after
ok(kuiOf("3m", {k:"chow", with:["4m","5m"]}).sort().join() === "3m,6m", "kuikae ends of a chi");
ok(kuiOf("4m", {k:"chow", with:["3m","5m"]}).join() === "4m", "a kanchan chi only bans the tile itself");

// pao: the pon of the third dragon makes its discarder liable for big three dragons
{
  const keep = later; later = () => 0;
  G = null; startRound(); G.honba = 0; G.sticks = 0;
  const s = (G.dealer + 1) % 4, f = (s + 1) % 4, d = (s + 2) % 4, P = x => ({type:"pung", tiles:[{t:x},{t:x},{t:x}]});
  W.meld[s] = [P("B")]; W.hand[s].push({t:"F"}, {t:"F"}); W.river.push({t:"F"});
  rSettle(d, "F", [{seat:s, k:"pung"}], null);
  ok(W.pao[s] === null, "two dragon pungs are not pao yet");
  W.hand[s].push({t:"C"}, {t:"C"}); W.river.push({t:"C"});
  rSettle(f, "C", [{seat:s, k:"pung"}], null);
  ok(W.pao[s] === f, "third dragon pon should set pao, got " + W.pao[s]);
  const dsg = {yakuman:1, yaku:[{n:"Big three dragons"}]}, pts = G.pts.slice();
  rDone({wins:[{seat:s, by:null, a:Object.assign({pay:{dealer:16000, other:8000}}, dsg)}]});
  ok(W.delta[f] === -32000 && W.delta[s] === 32000 && W.delta[d] === 0, "pao tsumo: feeder pays all " + W.delta);
  G.pts = pts; W.delta = [0,0,0,0]; G.honba = 1;
  rDone({wins:[{seat:s, by:d, a:Object.assign({pay:{ron:32000}}, dsg)}]});
  ok(W.delta[f] === -16300 && W.delta[d] === -16000 && W.delta[s] === 32300, "pao ron: split 50/50, honba on pao " + W.delta);
  later = keep; G = null;
}
VARIANT = "hk";

/* ── the score sheet ─────────────────────────────────────────────────── */
{
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ": " + JSON.stringify(a));
// hong kong: discarder pays the units alone; self-draw, all three pay
eq(settleHand("hk", {kind:"ron", w:1, from:3, f:3}, 0), [0, 8, 0, -8], "hk ron 3 faan");
eq(settleHand("hk", {kind:"tsumo", w:2, f:5}, 0), [-24, -24, 72, -24], "hk tsumo 5 faan");
eq(settleHand("hk", {kind:"draw"}, 0), [0, 0, 0, 0], "hk draw");
// riichi: 3 han 30 fu non-dealer ron 3900, two honba, own riichi stick back plus one in the pot
eq(settleHand("riichi", {kind:"ron", w:1, from:2, f:3, fu:30, dealer:0, honba:2, riichi:[1]}, 1000), [0, 5500, -4500, 0], "ri ron");
// 1 han 30 fu non-dealer tsumo, 300/500, one honba
eq(settleHand("riichi", {kind:"tsumo", w:3, f:1, fu:30, dealer:0, honba:1}, 0), [-600, -400, -400, 1400], "ri tsumo");
// dealer tsumo 2 han 30 fu: 1000 all
eq(settleHand("riichi", {kind:"tsumo", w:0, f:2, fu:30, dealer:0, honba:0}, 0), [3000, -1000, -1000, -1000], "ri dealer tsumo");
// draw, one tenpai: 3000 from the three noten; riichi stick stays on the table
eq(settleHand("riichi", {kind:"draw", tenpai:[2], riichi:[2], dealer:0}, 0), [-1000, -1000, 2000, -1000], "ri draw");
// double ron off seat 3 by seats 1 and 0: seat 0 is nearer, so it takes the honba and the stick
eq(settleHand("riichi", {kind:"ron", w:1, f:1, fu:30, w2:0, f2:2, fu2:30, from:3, dealer:2, honba:1}, 1000), [3300, 1000, 0, -3300], "ri double ron");
// pao tsumo: the liable seat pays the whole yakuman plus honba; pao ron: half each, honba on the liable seat
eq(settleHand("riichi", {kind:"tsumo", w:1, f:13, dealer:0, honba:1, pao:2}, 0), [0, 32300, -32300, 0], "ri pao tsumo");
eq(settleHand("riichi", {kind:"ron", w:1, f:13, from:3, dealer:0, honba:1, pao:2}, 0), [0, 32300, -16300, -16000], "ri pao ron");
// chombo: reverse mangan; dealer pays 4000 all, a non-dealer 4000 to the dealer and 2000 to the others
eq(settleHand("riichi", {kind:"chombo", w:0, dealer:0}, 0), [-12000, 4000, 4000, 4000], "ri dealer chombo");
eq(settleHand("riichi", {kind:"chombo", w:2, dealer:0}, 0), [4000, 2000, -8000, 2000], "ri chombo");
eq(settleHand("hk", {kind:"chombo", w:1, f:3}, 0), [8, -24, 8, 8], "hk chombo");
eq(nextDeal({kind:"chombo", w:2, dealer:1, honba:2}), {dealer:1, honba:2}, "chombo replays the hand");
eq(nextDeal({kind:"ron", w:3, w2:1, dealer:1, honba:0}), {dealer:1, honba:1}, "dealer in a double ron repeats");
// double yakuman ron, non-dealer: 64000; with pao the liable seat pays half of one, the discarder the rest
eq(settleHand("riichi", {kind:"ron", w:1, f:26, from:3, dealer:0, honba:0}, 0), [0, 64000, 0, -64000], "ri double yakuman");
eq(settleHand("riichi", {kind:"ron", w:1, f:26, from:3, dealer:0, honba:0, pao:2}, 0), [0, 64000, -16000, -48000], "ri pao double yakuman ron");
eq(settleHand("riichi", {kind:"tsumo", w:1, f:26, dealer:0, honba:0, pao:2}, 0), [-16000, 64000, -40000, -8000], "ri pao double yakuman tsumo");
// abortive draw: only the riichi sticks move; the dealer repeats with a honba more
eq(settleHand("riichi", {kind:"abort", riichi:[0, 1, 2, 3], dealer:1, honba:0}, 0), [-1000, -1000, -1000, -1000], "ri four riichi");
eq(nextDeal({kind:"abort", dealer:1, honba:0}), {dealer:1, honba:1}, "abortive draw repeats");
// final scores, 30000 return, uma 10-20: oka and the sticks go to first; a tie goes to the earlier seat
eq(finalScores([35000, 30000, 20000, 14000], 1000, 30000, "10-20").map(x => x.score), [46, 10, -20, -36], "uma and oka");
eq(finalScores([25000, 25000, 25000, 25000], 0, 25000, "0").map(x => x.place), [1, 2, 3, 4], "ties by seat");
eq(finalScores([40000, 30000, 20000, 10000], 0, 30000, "10-20").reduce((a, x) => a + x.score, 0), 0, "finals sum to zero");
// the working says what the payment was made of
const why = [];
settleHand("riichi", {kind:"ron", w:1, from:2, f:3, fu:30, dealer:0, honba:2, riichi:[1]}, 1000, why);
const said = JSON.stringify(why);
ok(said.includes("30,5,960") && said.includes(",3900]") && said.includes('{} honba: +300 per honba, {} in all",2,600]') && said.includes('{"p":1},2000]'), "working: " + said);
eq(nextDeal({kind:"ron", w:1, dealer:0, honba:3}), {dealer:1, honba:0}, "non-dealer win passes the deal");
eq(nextDeal({kind:"tsumo", w:0, dealer:0, honba:0}), {dealer:0, honba:1}, "dealer win repeats");
eq(nextDeal({kind:"draw", tenpai:[1], dealer:3, honba:1}), {dealer:0, honba:2}, "noten dealer passes, honba stays");
}

console.log("selfcheck: all assertions passed (" + wins + " wins, " + washouts
  + " washouts in 25 rounds at a " + RULES.min + "-faan minimum; riichi: 3 hanchans, " + rHands + " hands, "
  + rWins + " wins (" + rRons + " ron), " + rRiichi + " riichi, draws " + JSON.stringify(rDraws) + ")");
`;

vm.createContext(context);
vm.runInContext(bodies.join("\n") + "\n" + TESTS, context, { timeout: 120000 });

// the score sheet's PDF writer: every xref offset must land on its object
{
  const src = read("score.html").match(/\/\* pdf:start \*\/([\s\S]*?)\/\* pdf:end \*\//)[1];
  const pdfText = new Function(src + "; return pdfText;")();
  const lines = Array.from({ length: 130 }, (_, i) => "row " + i + " (paren) back\\slash 東 é");
  const pdf = Buffer.from(pdfText(lines)).toString("latin1");
  const xref = +pdf.match(/startxref\n(\d+)/)[1];
  assert.ok(pdf.startsWith("xref", xref), "startxref points at xref");
  const offs = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => +m[1]);
  assert.equal(offs.length, 2 + 1 + 3 * 2, "catalog, pages, font and three pages of two objects");
  offs.forEach((o, i) => assert.ok(pdf.startsWith((i + 1) + " 0 obj", o), "object " + (i + 1) + " at its offset"));
  assert.ok(pdf.includes("(row 0 \\(paren\\) back\\\\slash ? \xe9) Tj"), "escaping and the latin-1 fallback");
  console.log("selfcheck: score sheet PDF ok");
}
