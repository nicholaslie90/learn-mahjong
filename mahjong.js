/* Hong Kong mahjong — tile model, hand analyzer, and the bits both pages share. */
"use strict";

/* ── language ───────────────────────────────────────────────────────────────
   Dictionaries are keyed by the English string itself, so anything missing
   simply falls through to English. i18n.js fills I18N after this file loads;
   pattern names stay English inside the scorer and are translated on render. */
const I18N = {};
const LANGS = [["en","English","EN"],["id","Bahasa Indonesia","ID"]];
let LANG = "en";
try{ const l=localStorage.getItem("mj-lang"); if(l&&LANGS.some(x=>x[0]===l)) LANG=l; }catch(e){}
const dict = () => I18N[LANG];
function t(s){ const d=dict(); const v=d&&d[s]; return v==null?s:v; }
/* "{} tiles left" -> tf("{} tiles left", 7) */
function tf(s){ const a=[].slice.call(arguments,1); let i=0; return t(s).replace(/\{\}/g,()=>a[i++]); }
function setLang(l){ try{localStorage.setItem("mj-lang",l)}catch(e){} location.reload(); }

/* Static markup carries no keys: walk the text nodes and swap whole strings. */
const I18N_SKIP={SCRIPT:1,STYLE:1};
function applyI18n(){
  const d=dict(); if(!d) return;
  document.documentElement.lang=LANG;
  const w=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);
  const jobs=[];
  for(let n=w.nextNode();n;n=w.nextNode()){
    const p=n.parentNode;
    if(p&&I18N_SKIP[p.tagName]) continue;
    const k=n.nodeValue.trim(), v=k&&d[k];
    if(v) jobs.push([n,n.nodeValue.replace(k,()=>v)]);
  }
  jobs.forEach(j=>{j[0].nodeValue=j[1]});
  document.querySelectorAll("[aria-label],[title],[placeholder]").forEach(e=>{
    ["aria-label","title","placeholder"].forEach(a=>{
      const v=e.getAttribute(a), r=v&&d[v.trim()];
      if(r) e.setAttribute(a,r);
    });
  });
}
/* the language picker; the table HUD is tight on phones, so it asks for codes */
function langPicker(short){
  const s=document.createElement("select");
  s.className="lang"; s.setAttribute("aria-label",t("Language"));
  LANGS.forEach(([code,name,abbr])=>{
    const o=document.createElement("option");
    o.value=code; o.textContent=short?abbr:name; if(code===LANG)o.selected=true;
    s.append(o);
  });
  s.onchange=()=>setLang(s.value);
  return s;
}

const SUIT = {
  m:{label:"Characters", zh:"萬", cp:0x1F007, ink:"ink",    hint:"the number, then 萬"},
  s:{label:"Bamboo",     zh:"索", cp:0x1F010, ink:"jade",   hint:"count the sticks — 1 is a bird"},
  p:{label:"Circles",    zh:"筒", cp:0x1F019, ink:"indigo", hint:"count the dots"}
};
const NUM = ["One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];
const ZHN = ["一","二","三","四","五","六","七","八","九"];
const HONOR = {
  E:{cp:0x1F000,en:"East Wind",   short:"East", zh:"東",ink:"ink",   grp:"wind"},
  S:{cp:0x1F001,en:"South Wind",  short:"South",zh:"南",ink:"ink",   grp:"wind"},
  W:{cp:0x1F002,en:"West Wind",   short:"West", zh:"西",ink:"ink",   grp:"wind"},
  N:{cp:0x1F003,en:"North Wind",  short:"North",zh:"北",ink:"ink",   grp:"wind"},
  C:{cp:0x1F004,en:"Red Dragon",  short:"Red",  zh:"中",ink:"red",   grp:"dragon"},
  F:{cp:0x1F005,en:"Green Dragon",short:"Green",zh:"發",ink:"jade",  grp:"dragon"},
  B:{cp:0x1F006,en:"White Dragon",short:"White",zh:"白",ink:"indigo",grp:"dragon"}
};
const BONUS = {
  b1:{cp:0x1F022,en:"Plum flower",  zh:"梅"}, b2:{cp:0x1F023,en:"Orchid flower",zh:"蘭"},
  b3:{cp:0x1F024,en:"Bamboo flower",zh:"竹"}, b4:{cp:0x1F025,en:"Chrysanthemum flower",zh:"菊"},
  b5:{cp:0x1F026,en:"Spring season",zh:"春"}, b6:{cp:0x1F027,en:"Summer season",zh:"夏"},
  b7:{cp:0x1F028,en:"Autumn season",zh:"秋"}, b8:{cp:0x1F029,en:"Winter season",zh:"冬"}
};
const BACK = "🀫";

/* `en` is the lookup key and stays put; `label` and `short` are what you show. */
function info(id){
  const h=HONOR[id];
  if(h) return Object.assign({},h,{label:t(h.en),short:t(h.short)});
  const b=BONUS[id];
  if(b) return Object.assign({ink:"gold",grp:"bonus",short:t(b.en)},b,{label:t(b.en)});
  const n=+id[0], s=SUIT[id[1]];
  return {cp:s.cp+n-1, label:t(NUM[n-1]+" "+s.label), short:t(NUM[n-1]),
          zh:ZHN[n-1]+s.zh, ink:s.ink, grp:"suit"};
}
/* U+1F004 defaults to emoji presentation; VS15 forces the flat tile glyph. */
function glyph(id){ const c=info(id).cp; return String.fromCodePoint(c)+(c===0x1F004?"︎":""); }
function tileEl(id,opts){
  opts=opts||{};
  const i=info(id), e=document.createElement("span");
  e.className="tile ink-"+i.ink+(opts.lift?" lift":"");
  e.textContent=glyph(id);
  e.setAttribute("role","img");
  e.setAttribute("aria-label",i.label);
  if(opts.i!=null) e.style.setProperty("--i",opts.i);
  return e;
}

const SUITED=["m","s","p"].reduce((a,k)=>a.concat([1,2,3,4,5,6,7,8,9].map(n=>n+k)),[]);
const HONORS=Object.keys(HONOR);
const ALL=SUITED.concat(HONORS);
const ORDER=SUITED.concat(HONORS), IDX={};
ORDER.forEach((id,i)=>{IDX[id]=i});
const bySort=(a,b)=>IDX[a]-IDX[b];
const pick=a=>a[Math.random()*a.length|0];
const shuffle=a=>a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
const el=id=>document.getElementById(id);

function counts(ts){const c=new Array(34).fill(0);ts.forEach(t=>{c[IDX[t]]++});return c;}
/* every way to carve the counts into complete sets, consuming every tile */
function walkSets(c,i,cur,out){
  while(i<34&&c[i]===0)i++;
  if(i===34){out.push(cur.slice());return;}
  if(c[i]>=3){c[i]-=3;cur.push({type:"pung",tiles:[ORDER[i],ORDER[i],ORDER[i]]});walkSets(c,i,cur,out);cur.pop();c[i]+=3;}
  if(i<27&&i%9<=6&&c[i+1]>0&&c[i+2]>0){c[i]--;c[i+1]--;c[i+2]--;
    cur.push({type:"chow",tiles:[ORDER[i],ORDER[i+1],ORDER[i+2]]});walkSets(c,i,cur,out);cur.pop();
    c[i]++;c[i+1]++;c[i+2]++;}
}
/* most sets extractable, leftovers allowed — for the "how close am I" readout */
function maxSets(c,i){
  while(i<34&&c[i]===0)i++;
  if(i===34)return 0;
  let b=maxSets(c,i+1);
  if(c[i]>=3){c[i]-=3;b=Math.max(b,1+maxSets(c,i));c[i]+=3;}
  if(i<27&&i%9<=6&&c[i+1]>0&&c[i+2]>0){c[i]--;c[i+1]--;c[i+2]--;b=Math.max(b,1+maxSets(c,i));c[i]++;c[i+1]++;c[i+2]++;}
  return b;
}
const ORPHANS=["1m","9m","1s","9s","1p","9p"].concat(HONORS);
function orphanWin(ts){
  if(ts.length!==14||!ts.every(t=>ORPHANS.indexOf(t)>=0))return false;
  return new Set(ts).size===13;
}
/* concealed tiles + already-melded sets -> every winning decomposition */
function findWin(hand,melds){
  melds=melds||[];
  if(!melds.length&&orphanWin(hand))return [{orphans:true,pair:null,sets:[]}];
  const need=4-melds.length;
  if(hand.length!==need*3+2)return [];
  const c=counts(hand),res=[];
  for(let p=0;p<34;p++){
    if(c[p]<2)continue;
    c[p]-=2;const out=[];walkSets(c,0,[],out);c[p]+=2;
    out.forEach(st=>{if(st.length===need)res.push({pair:ORDER[p],sets:st})});
  }
  return res;
}
function waitsFor(h){
  const c=counts(h),w=[];
  ORDER.forEach(t=>{if(c[IDX[t]]<4&&findWin(h.concat([t]),[]).length)w.push(t)});
  return w;
}
const UNITS=[1,2,4,8,16,24,32,48,64,96,128,192,256,384];
const units=f=>UNITS[Math.min(Math.max(f,0),RULES.limit)];

function scoreWin(d,melds,ctx){
  const pats=[],add=(n,zh,f)=>pats.push({n:n,zh:zh,f:f});
  if(d.orphans) add("Thirteen orphans","十三么",13);
  else{
    const all=melds.concat(d.sets);
    const tiles=all.reduce((a,m)=>a.concat(m.tiles),[]).concat([d.pair,d.pair]);
    const suits=new Set(tiles.filter(t=>!HONOR[t]).map(t=>t[1]));
    const honor=tiles.some(t=>HONOR[t]);
    const pungs=all.filter(m=>m.type!=="chow");
    const dr=pungs.filter(m=>HONOR[m.tiles[0]]&&HONOR[m.tiles[0]].grp==="dragon");
    const wp=pungs.filter(m=>HONOR[m.tiles[0]]&&HONOR[m.tiles[0]].grp==="wind");
    const pairH=HONOR[d.pair];
    if(wp.length===4) add("Big four winds","大四喜",13);
    else if(wp.length===3&&pairH&&pairH.grp==="wind") add("Small four winds","小四喜",RULES.s4w);
    if(!suits.size) add("All honours","字一色",RULES.allh);
    if(dr.length===3) add("Big three dragons","大三元",8);
    else if(dr.length===2&&pairH&&pairH.grp==="dragon") add("Small three dragons","小三元",RULES.s3d);
    else dr.forEach(m=>add("Dragon pung","三元牌 "+info(m.tiles[0]).zh,1));
    if(suits.size===1) add(honor?"Half flush":"Full flush",honor?"混一色":"清一色",honor?3:7);
    if(pungs.length===4) add("All pungs","碰碰糊",3);
    if(RULES.allchow&&all.length-pungs.length===4&&!pairH) add("All chows","平糊",RULES.allchow);
    wp.forEach(m=>{
      if(m.tiles[0]===ctx.seatWind) add("Seat wind pung","門風",1);
      if(m.tiles[0]===ctx.roundWind) add("Round wind pung","圈風",1);
    });
  }
  if(ctx.selfDraw) add("Self-draw","自摸",1);
  if(ctx.concealed&&RULES.conc) add("Fully concealed","門前清",RULES.conc);
  for(let i=0;i<(ctx.bonusMatch||0);i++) add("Matching flower","花牌",1);
  if(ctx.bonusCount===0&&RULES.noflw) add("No flowers","無花",RULES.noflw);
  return {pats:pats,faan:pats.reduce((a,p)=>a+p.f,0)};
}
/* best-scoring reading of a winning hand, or null if it isn't one */
function analyze(hand,melds,ctx){
  const ds=findWin(hand,melds);
  if(!ds.length)return null;
  let best=null;
  ds.forEach(d=>{const sc=scoreWin(d,melds,ctx);if(!best||sc.faan>best.score.faan)best={d:d,score:sc}});
  return best;
}
function patList(sc){
  const ul=document.createElement("ul");ul.className="pats";
  sc.pats.forEach(p=>{
    const li=document.createElement("li");
    li.innerHTML='<span>'+t(p.n)+' <span class="zh">'+p.zh+'</span></span><b>'+p.f+' faan</b>';
    ul.append(li);
  });
  const tot=document.createElement("li");tot.className="tot";
  tot.innerHTML='<span><b>'+t("Total")+'</b></span><b>'+tf("{} faan · {} units",sc.faan,units(sc.faan))+'</b>';
  ul.append(tot);return ul;
}
function meldRow(sets,pair){
  const r=document.createElement("div");r.className="row";r.style.gap=".9rem";
  sets.concat(pair?[{type:"pair",tiles:[pair,pair]}]:[]).forEach(m=>{
    const f=document.createElement("figure");f.className="meld";f.style.margin="0";
    const rr=document.createElement("div");rr.className="row";
    m.tiles.forEach(t=>rr.append(tileEl(t)));
    const c=document.createElement("figcaption");c.textContent=t(m.type);
    f.append(rr,c);r.append(f);
  });
  return r;
}

/* ── house rules ────────────────────────────────────────────────────────────
   Hong Kong old style is a family of tables, not one rulebook. These are the
   points that genuinely differ from table to table; everything else here is
   settled. Patterns that belong to other variants (three similar sequences,
   for one, which is Riichi and Chinese Official but not Hong Kong) are not
   offered — turning them on would not make this a Hong Kong table. */
const RULE_DEFS=[
  {k:"min",label:"Minimum faan to declare",zh:"最低番數",opts:[0,1,3,5],def:3,
   note:"A hand below this cannot be declared, however complete it is. Three is the usual table."},
  {k:"limit",label:"Limit — faan cap out here",zh:"滿糊",opts:[10,13],def:10,
   note:"Where the payout table stops doubling."},
  {k:"s3d",label:"Small three dragons",zh:"小三元",opts:[3,5],def:5},
  {k:"s4w",label:"Small four winds",zh:"小四喜",opts:[6,10],def:10},
  {k:"allh",label:"All honours",zh:"字一色",opts:[10,13],def:10},
  {k:"conc",label:"Fully concealed",zh:"門前清",opts:[0,1],def:1,
   note:"One faan for never claiming a discard."},
  {k:"noflw",label:"No flowers",zh:"無花",opts:[0,1],def:1,
   note:"One faan for finishing without a single bonus tile."},
  {k:"allchow",label:"All chows",zh:"平糊",opts:[0,1],def:0,
   note:"One faan for four runs and a plain pair. Plenty of tables leave it out."}
];
const RULES={};
RULE_DEFS.forEach(r=>{RULES[r.k]=r.def});
function loadRules(){
  try{
    const j=JSON.parse(localStorage.getItem("mj-rules")||"{}");
    RULE_DEFS.forEach(r=>{if(r.opts.indexOf(j[r.k])>=0)RULES[r.k]=j[r.k]});
  }catch(e){}
}
function saveRules(){try{localStorage.setItem("mj-rules",JSON.stringify(RULES))}catch(e){}}
loadRules();
/* complete is not the same as declarable: most tables set a floor */
const declarable=a=>!!a&&a.score.faan>=RULES.min;

/* ── how close a hand is, and what to throw ─────────────────────────────────
   Shanten is the number of tile swaps still needed: 0 means ready (tenpai).
   shapeOf also hands back the blocks of the best line, so the advice can say
   what a discard keeps rather than only what it throws. */
const BLOCK={pung:3,chow:3,pair:2,run2:2,gap:2};
function shapeOf(cin,exposed){
  const c=cin.slice(), cur=[], cap=5-exposed;
  let best={sh:99,blocks:[]};
  function record(sets,parts,pair){
    let sh=8-2*(sets+exposed)-parts;
    if(sets+exposed+parts===5&&pair==null)sh+=1;
    if(sh<best.sh)best={sh:sh,blocks:cur.slice()};
  }
  /* blocks are taken in non-decreasing tile order, so no line is walked twice */
  function rec(from,sets,parts,pair){
    record(sets,parts,pair);
    if(sets+parts>=cap)return;
    for(let j=from;j<34;j++){
      if(!c[j])continue;
      const run=j<27&&j%9<=6, pairable=j<27&&j%9<=7;
      if(c[j]>=3){c[j]-=3;cur.push([j,"pung"]);rec(j,sets+1,parts,pair);cur.pop();c[j]+=3}
      if(run&&c[j+1]&&c[j+2]){c[j]--;c[j+1]--;c[j+2]--;cur.push([j,"chow"]);
        rec(j,sets+1,parts,pair);cur.pop();c[j]++;c[j+1]++;c[j+2]++}
      if(c[j]>=2){c[j]-=2;cur.push([j,"pair"]);rec(j,sets,parts+1,pair==null?j:pair);cur.pop();c[j]+=2}
      if(pairable&&c[j+1]){c[j]--;c[j+1]--;cur.push([j,"run2"]);rec(j,sets,parts+1,pair);cur.pop();c[j]++;c[j+1]++}
      if(run&&c[j+2]){c[j]--;c[j+2]--;cur.push([j,"gap"]);rec(j,sets,parts+1,pair);cur.pop();c[j]++;c[j+2]++}
    }
  }
  rec(0,0,0,null);
  if(!exposed){                       /* thirteen orphans keeps its own shape */
    let kinds=0,pair=0;
    ORPHANS.forEach(t=>{const n=cin[IDX[t]];if(n>0)kinds++;if(n>1)pair=1});
    const sh=13-kinds-pair;
    if(sh<best.sh)best={sh:sh,blocks:[]};
  }
  return best;
}
const blockTiles=b=>b[1]==="pung"?[ORDER[b[0]],ORDER[b[0]],ORDER[b[0]]]
  :b[1]==="chow"?[ORDER[b[0]],ORDER[b[0]+1],ORDER[b[0]+2]]
  :b[1]==="pair"?[ORDER[b[0]],ORDER[b[0]]]
  :b[1]==="run2"?[ORDER[b[0]],ORDER[b[0]+1]]
  :[ORDER[b[0]],ORDER[b[0]+2]];

/* Which tile to throw. `seen` counts every tile the player can already see —
   their hand, every exposed meld, the discard pile — so acceptance only counts
   copies that could still turn up. */
function advise(hand,melds,seen,ctx){
  const exposed=melds.length;
  const rows=[...new Set(hand)].map(t=>{
    const rest=hand.slice();
    rest.splice(rest.indexOf(t),1);
    const shape=shapeOf(counts(rest),exposed);
    return {t:t,rest:rest,sh:shape.sh,shape:shape};
  });
  const sh=Math.min.apply(null,rows.map(r=>r.sh));
  const front=rows.filter(r=>r.sh===sh);
  front.forEach(r=>{
    const base=counts(r.rest);
    r.accept=[];
    ORDER.forEach(d=>{
      const left=4-(seen[IDX[d]]||0);
      if(left<=0)return;
      base[IDX[d]]++;
      const better=shapeOf(base,exposed).sh<sh;
      base[IDX[d]]--;
      if(better)r.accept.push({t:d,left:left});
    });
    r.live=r.accept.reduce((a,x)=>a+x.left,0);
  });
  front.sort((a,b)=>(b.live-a.live)||(shed(b.t,ctx)-shed(a.t,ctx)));
  return {sh:sh,pick:front[0],front:front};
}
/* higher = happier to let go of */
function shed(t,ctx){
  const h=HONOR[t];
  if(h)return (h.grp==="dragon"||t===ctx.seatWind||t===ctx.roundWind)?2:4;
  const n=+t[0];
  return (n===1||n===9)?3:1;
}
function explain(a,hand,ctx){
  const c=counts(hand), p=a.pick, i=IDX[p.t], have=c[i];
  const h=HONOR[p.t];
  const near=!h&&[-2,-1,1,2].some(d=>{const n=i%9+d;return n>=0&&n<=8&&c[i+d]>0});
  let why;
  if(have>=3) why=t("you already hold three of them and a fourth set has nowhere to go");
  else if(have===2) why=t("the pair is your spare block — a hand only needs four sets and one eye");
  else if(h&&shed(p.t,ctx)===2) why=tf("a lone {} that would score, but it can never join a run and both remaining copies would have to come to you",
    t(h.grp==="dragon"?"dragon":"wind"));
  else if(h) why=t("a lone honour: it can never join a run, so it would take both remaining copies to make anything");
  else if(!near) why=t("a lone tile with no neighbours in hand — there is nothing here to build on");
  else why=t("the loosest tile you hold; the blocks you keep are further along");
  const ready=a.sh===0
    ? t("That leaves you ready.")
    : a.sh===1 ? t("That leaves you one tile from ready.")
    : tf("That leaves you {} tiles from ready.",a.sh);
  return {why:why, ready:ready};
}
