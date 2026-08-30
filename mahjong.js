/* Hong Kong mahjong — tile model, hand analyzer, and the bits both pages share. */
"use strict";

const SUIT = {
  m:{label:"Characters", zh:"萬", cp:0x1F007, ink:"ink",    hint:"the number, then 萬"},
  s:{label:"Bamboo",     zh:"索", cp:0x1F010, ink:"jade",   hint:"count the sticks — 1 is a bird"},
  p:{label:"Circles",    zh:"筒", cp:0x1F019, ink:"indigo", hint:"count the dots"}
};
const NUM = ["One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];
const ZHN = ["一","二","三","四","五","六","七","八","九"];
const HONOR = {
  E:{cp:0x1F000,label:"East Wind",   zh:"東",ink:"ink",   grp:"wind"},
  S:{cp:0x1F001,label:"South Wind",  zh:"南",ink:"ink",   grp:"wind"},
  W:{cp:0x1F002,label:"West Wind",   zh:"西",ink:"ink",   grp:"wind"},
  N:{cp:0x1F003,label:"North Wind",  zh:"北",ink:"ink",   grp:"wind"},
  C:{cp:0x1F004,label:"Red Dragon",  zh:"中",ink:"red",   grp:"dragon"},
  F:{cp:0x1F005,label:"Green Dragon",zh:"發",ink:"jade",  grp:"dragon"},
  B:{cp:0x1F006,label:"White Dragon",zh:"白",ink:"indigo",grp:"dragon"}
};
const BONUS = {
  b1:{cp:0x1F022,label:"Plum flower",  zh:"梅"}, b2:{cp:0x1F023,label:"Orchid flower",zh:"蘭"},
  b3:{cp:0x1F024,label:"Bamboo flower",zh:"竹"}, b4:{cp:0x1F025,label:"Chrysanthemum flower",zh:"菊"},
  b5:{cp:0x1F026,label:"Spring season",zh:"春"}, b6:{cp:0x1F027,label:"Summer season",zh:"夏"},
  b7:{cp:0x1F028,label:"Autumn season",zh:"秋"}, b8:{cp:0x1F029,label:"Winter season",zh:"冬"}
};
const BACK = "🀫";

function info(id){
  if(HONOR[id]) return HONOR[id];
  if(BONUS[id]) return Object.assign({ink:"gold",grp:"bonus"},BONUS[id]);
  const n=+id[0], s=SUIT[id[1]];
  return {cp:s.cp+n-1, label:NUM[n-1]+" "+s.label, zh:ZHN[n-1]+s.zh, ink:s.ink, grp:"suit"};
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
const UNITS=[1,2,4,8,16,24,32,48,64,96];
const units=f=>f>=10?128:UNITS[f];

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
    else if(wp.length===3&&pairH&&pairH.grp==="wind") add("Small four winds","小四喜",10);
    if(!suits.size) add("All honours","字一色",10);
    if(dr.length===3) add("Big three dragons","大三元",8);
    else if(dr.length===2&&pairH&&pairH.grp==="dragon") add("Small three dragons","小三元",5);
    else dr.forEach(m=>add("Dragon pung "+info(m.tiles[0]).zh,"三元牌",1));
    if(suits.size===1) add(honor?"Half flush":"Full flush",honor?"混一色":"清一色",honor?3:7);
    if(pungs.length===4) add("All pungs","碰碰糊",3);
    wp.forEach(m=>{
      if(m.tiles[0]===ctx.seatWind) add("Seat wind pung","門風",1);
      if(m.tiles[0]===ctx.roundWind) add("Round wind pung","圈風",1);
    });
  }
  if(ctx.selfDraw) add("Self-draw","自摸",1);
  if(ctx.concealed) add("Fully concealed","門前清",1);
  for(let i=0;i<(ctx.bonusMatch||0);i++) add("Matching flower","花牌",1);
  if(ctx.bonusCount===0) add("No flowers","無花",1);
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
    li.innerHTML='<span>'+p.n+' <span class="zh">'+p.zh+'</span></span><b>'+p.f+' faan</b>';
    ul.append(li);
  });
  const t=document.createElement("li");t.className="tot";
  t.innerHTML='<span><b>Total</b></span><b>'+sc.faan+' faan · '+units(sc.faan)+' units</b>';
  ul.append(t);return ul;
}
function meldRow(sets,pair){
  const r=document.createElement("div");r.className="row";r.style.gap=".9rem";
  sets.concat(pair?[{type:"pair",tiles:[pair,pair]}]:[]).forEach(m=>{
    const f=document.createElement("figure");f.className="meld";f.style.margin="0";
    const rr=document.createElement("div");rr.className="row";
    m.tiles.forEach(t=>rr.append(tileEl(t)));
    const c=document.createElement("figcaption");c.textContent=m.type;
    f.append(rr,c);r.append(f);
  });
  return r;
}

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
  if(have>=3) why="you already hold three of them and a fourth set has nowhere to go";
  else if(have===2) why="the pair is your spare block — a hand only needs four sets and one eye";
  else if(h&&shed(p.t,ctx)===2) why="a lone "+(h.grp==="dragon"?"dragon":"wind")
    +" that would score, but it can never join a run and both remaining copies would have to come to you";
  else if(h) why="a lone honour: it can never join a run, so it would take both remaining copies to make anything";
  else if(!near) why="a lone tile with no neighbours in hand — there is nothing here to build on";
  else why="the loosest tile you hold; the blocks you keep are further along";
  const ready=a.sh===0
    ? "That leaves you ready."
    : a.sh===1 ? "That leaves you one tile from ready."
    : "That leaves you "+a.sh+" tiles from ready.";
  return {why:why, ready:ready};
}
