/* Riichi (Japanese) mahjong — yaku, fu and points, played to Tenhou's rules.
   Loads after mahjong.js and reuses its tile ids, findWin and shapeOf.
   Dragons keep the shared ids: B haku 白, F hatsu 發, C chun 中.
   Red fives are a property of the physical tile, not a tile type, so they
   arrive as a count in ctx.aka. Names stay English here and go through t()
   when shown. */
"use strict";

/* which game the table and the guide are set to: "hk" or "riichi" */
let VARIANT="hk";
try{ if(localStorage.getItem("mj-variant")==="riichi") VARIANT="riichi"; }catch(e){}
function setVariant(v){ try{localStorage.setItem("mj-variant",v)}catch(e){} location.reload(); }

/* Tenhou's table, fixed: these are not house rules here, they are the rules */
const R_RULES={aka:3, kuitan:true, start:25000, target:30000, length:"hanchan",
  kazoe:true, kiriage:false, doubleWindPair:4, nagashi:true};

const isHon=t=>!!HONOR[t];
const isTerm=t=>!HONOR[t]&&(t[0]==="1"||t[0]==="9");
const isYao=t=>isHon(t)||isTerm(t);
const GREEN=new Set(["2s","3s","4s","6s","8s","F"]);
const DRAGONS=["B","F","C"], WINDS=["E","S","W","N"];

/* the tile an indicator points at: 9 wraps to 1, N to E, chun back to haku */
function doraOf(t){
  const w=WINDS.indexOf(t); if(w>=0) return WINDS[(w+1)%4];
  const d=DRAGONS.indexOf(t); if(d>=0) return DRAGONS[(d+1)%3];
  return (+t[0]%9+1)+t[1];
}

function chiitoi(h){
  if(h.length!==14) return null;
  const c=counts(h), pairs=[];
  for(let i=0;i<34;i++){ if(c[i]===2) pairs.push(ORDER[i]); else if(c[i]) return null; }
  return pairs.length===7?pairs:null;
}
/* a complete shape, ignoring whether it has a yaku */
const rShape=(h,melds)=>findWin(h,melds||[]).length>0||(!(melds&&melds.length)&&!!chiitoi(h));

/* tiles that complete a 13-tile hand. A wait on a tile you already hold all
   four of is no wait at all. */
function rWaits(h,melds){
  const c=counts(h);
  return ORDER.filter(t=>c[IDX[t]]<4&&rShape(h.concat([t]),melds));
}
/* discards from a 14-tile hand that leave it ready — the riichi candidates */
function rRiichiDiscards(h,melds){
  return [...new Set(h)].filter(t=>{
    const r=h.slice(); r.splice(r.indexOf(t),1);
    return rWaits(r,melds).length>0;
  });
}
/* shanten with seven pairs added; shapeOf already covers the standard shape
   and thirteen orphans */
function rShanten(c,exposed){
  let sh=shapeOf(c,exposed).sh;
  if(!exposed){
    let pairs=0,kinds=0;
    c.forEach(n=>{if(n>=2)pairs++; if(n)kinds++});
    sh=Math.min(sh,6-pairs+Math.max(0,7-kinds));
  }
  return sh;
}

function chuuren(h){
  const s=h[0][1];
  if(!h.every(t=>!isHon(t)&&t[1]===s)) return false;
  const n=new Array(10).fill(0); h.forEach(t=>n[+t[0]]++);
  return n[1]>=3&&n[9]>=3&&[2,3,4,5,6,7,8].every(k=>n[k]>=1);
}

/* han -> base points, and the name of the limit if it reached one */
function rBase(han,fu,yakuman){
  if(yakuman) return {base:8000*yakuman,label:yakuman>1?yakuman+"× yakuman":"Yakuman"};
  if(han>=13) return {base:8000,label:"Kazoe yakuman"};
  if(han>=11) return {base:6000,label:"Sanbaiman"};
  if(han>=8)  return {base:4000,label:"Baiman"};
  if(han>=6)  return {base:3000,label:"Haneman"};
  const b=fu*Math.pow(2,han+2);
  if(han>=5||b>=2000) return {base:2000,label:"Mangan"};
  return {base:b,label:""};
}
const up100=x=>Math.ceil(x/100)*100;
/* what each loser pays, before honba and riichi sticks */
function rPay(base,dealer,tsumo){
  if(!tsumo) return {ron:up100(base*(dealer?6:4))};
  return dealer?{all:up100(base*2)}:{dealer:up100(base*2),other:up100(base)};
}

/* yaku, fu for one reading of a standard hand. sets carry {type,tiles,open};
   wait is ryanmen|kanchan|penchan|tanki|shanpon */
function readStd(sets,pair,wait,menzen,ctx){
  const Y=[],K=[],add=(n,zh,h)=>Y.push({n:n,zh:zh,h:h}),man=(n,zh,k)=>K.push({n:n,zh:zh,h:13*(k||1)});
  const tiles=sets.reduce((a,m)=>a.concat(m.tiles),[]).concat([pair,pair]);
  const chows=sets.filter(m=>m.type==="chow"), pungs=sets.filter(m=>m.type!=="chow");
  const kongs=sets.filter(m=>m.type==="kong");
  const anko=pungs.filter(m=>!m.open).length;
  const dragonP=pungs.filter(m=>DRAGONS.indexOf(m.tiles[0])>=0).length;
  const windP=pungs.filter(m=>WINDS.indexOf(m.tiles[0])>=0).length;
  const suits=new Set(tiles.filter(t=>!isHon(t)).map(t=>t[1]));
  const honor=tiles.some(isHon);
  const valuePair=DRAGONS.indexOf(pair)>=0||pair===ctx.seatWind||pair===ctx.roundWind;

  if(anko===4) man("Four concealed pungs","四暗刻");
  if(dragonP===3) man("Big three dragons","大三元");
  if(windP===4) man("Big four winds","大四喜");
  else if(windP===3&&WINDS.indexOf(pair)>=0) man("Little four winds","小四喜");
  if(tiles.every(isHon)) man("All honours","字一色");
  if(tiles.every(t=>GREEN.has(t))) man("All green","緑一色");
  if(tiles.every(isTerm)) man("All terminals","清老頭");
  if(kongs.length===4) man("Four kongs","四槓子");

  if(menzen&&chows.length===4&&!valuePair&&wait==="ryanmen") add("Pinfu","平和",1);
  if(!tiles.some(isYao)) add("All simples","断幺九",1);
  if(menzen){
    const g={}; chows.forEach(m=>{g[m.tiles[0]]=(g[m.tiles[0]]||0)+1});
    const peiko=Object.values(g).reduce((a,n)=>a+(n>>1),0);
    if(peiko>=2) add("Twice pure double chow","二盃口",3);
    else if(peiko===1) add("Pure double chow","一盃口",1);
  }
  pungs.forEach(m=>{
    const x=m.tiles[0];
    if(x==="B") add("Haku","役牌 白",1);
    if(x==="F") add("Hatsu","役牌 發",1);
    if(x==="C") add("Chun","役牌 中",1);
    if(x===ctx.seatWind) add("Seat wind","自風 "+HONOR[x].zh,1);
    if(x===ctx.roundWind) add("Round wind","場風 "+HONOR[x].zh,1);
  });
  const nums=k=>m=>m.tiles[0][0]===k;
  for(let n=1;n<=7;n++){
    if(["m","s","p"].every(s=>chows.some(m=>m.tiles[0]===n+s))){add("Mixed triple chow","三色同順",menzen?2:1);break}
  }
  for(const s of ["m","s","p"]){
    if(["1","4","7"].every(n=>chows.some(m=>m.tiles[0]===n+s))){add("Pure straight","一気通貫",menzen?2:1);break}
  }
  const groupsYao=sets.every(m=>m.tiles.some(isYao))&&isYao(pair);
  const groupsTerm=sets.every(m=>m.tiles.some(isTerm))&&isTerm(pair);
  if(chows.length&&groupsTerm) add("Fully outside hand","純全帯幺九",menzen?3:2);
  else if(chows.length&&groupsYao&&honor) add("Half outside hand","混全帯幺九",menzen?2:1);
  if(pungs.length===4) add("All pungs","対々和",2);
  if(anko===3) add("Three concealed pungs","三暗刻",2);
  for(let n=1;n<=9;n++){
    if(["m","s","p"].every(s=>pungs.some(m=>m.tiles[0]===n+s))){add("Triple pung","三色同刻",2);break}
  }
  if(kongs.length===3) add("Three kongs","三槓子",2);
  if(!chows.length&&tiles.every(isYao)&&honor&&suits.size) add("All terminals and honours","混老頭",2);
  if(dragonP===2&&DRAGONS.indexOf(pair)>=0) add("Little three dragons","小三元",2);
  flush(Y,suits,honor,menzen);

  /* fu */
  const pinfu=Y.some(y=>y.n==="Pinfu");
  let fu;
  if(pinfu&&ctx.tsumo) fu=20;
  else{
    fu=20;
    if(menzen&&!ctx.tsumo) fu+=10;
    if(ctx.tsumo) fu+=2;
    pungs.forEach(m=>{
      let f=2; if(!m.open)f*=2; if(isYao(m.tiles[0]))f*=2; if(m.type==="kong")f*=4;
      fu+=f;
    });
    if(DRAGONS.indexOf(pair)>=0) fu+=2;
    if(pair===ctx.seatWind) fu+=2;
    if(pair===ctx.roundWind) fu+=2;
    if(wait==="kanchan"||wait==="penchan"||wait==="tanki") fu+=2;
    if(!menzen&&fu===20) fu=30;   /* an open hand with nothing in it still pays 30 */
    fu=Math.ceil(fu/10)*10;
  }
  return {yaku:Y,yakuman:K,fu:fu};
}
function flush(Y,suits,honor,menzen){
  if(suits.size!==1) return;
  if(honor) Y.push({n:"Half flush",zh:"混一色",h:menzen?3:2});
  else Y.push({n:"Full flush",zh:"清一色",h:menzen?6:5});
}

/* the yaku that come from the situation, not the shape */
function situational(Y,K,menzen,ctx){
  const add=(n,zh,h)=>Y.push({n:n,zh:zh,h:h});
  if(ctx.tenhou) K.push({n:"Blessing of heaven",zh:"天和",h:13});
  if(ctx.chiihou) K.push({n:"Blessing of earth",zh:"地和",h:13});
  if(ctx.doubleRiichi) add("Double riichi","ダブル立直",2);
  else if(ctx.riichi) add("Riichi","立直",1);
  if(ctx.ippatsu&&(ctx.riichi||ctx.doubleRiichi)) add("Ippatsu","一発",1);
  if(menzen&&ctx.tsumo) add("Fully concealed self-draw","門前清自摸和",1);
  if(ctx.haitei&&ctx.tsumo&&!ctx.rinshan) add("Last tile from the wall","海底摸月",1);
  if(ctx.houtei&&!ctx.tsumo) add("Last discard","河底撈魚",1);
  if(ctx.rinshan) add("After a kong","嶺上開花",1);
  if(ctx.chankan) add("Robbing a kong","槍槓",1);
}

/* Score a win. hand is every concealed tile including the winning one, win is
   the winning tile, melds are [{type,tiles,open}] (a concealed kong is a kong
   with open:false). ctx: seatWind, roundWind, dealer, tsumo, riichi,
   doubleRiichi, ippatsu, haitei, houtei, rinshan, chankan, tenhou, chiihou,
   dora[] and ura[] (indicators), aka (red fives held).
   Returns null if the tiles are not a complete hand; otherwise the best
   reading, whose `yaku` may be empty — a complete hand with no yaku cannot
   be declared (see rCanWin). */
function rScore(hand,melds,win,ctx){
  melds=melds||[];
  const menzen=melds.every(m=>!m.open);
  const reads=[];
  const finish=(Y,K,fu,form)=>{
    situational(Y,K,menzen,ctx);
    reads.push({yaku:Y,yakuman:K,fu:fu,form:form});
  };

  const ds=findWin(hand,melds);
  ds.forEach(d=>{
    if(d.orphans){
      const K=[{n:"Thirteen orphans",zh:"国士無双",h:13}];
      return finish([],K,30,"kokushi");
    }
    /* every place the winning tile could have gone gives a different wait */
    const spots=[];
    if(d.pair===win) spots.push(-1);
    d.sets.forEach((m,i)=>{if(m.tiles.indexOf(win)>=0)spots.push(i)});
    spots.forEach(sp=>{
      let wait="tanki";
      const sets=d.sets.map((m,i)=>{
        const s={type:m.type,tiles:m.tiles,open:false};
        if(i===sp){
          if(m.type==="pung"){wait="shanpon";if(!ctx.tsumo)s.open=true}
          else{
            const k=m.tiles.indexOf(win), lo=+m.tiles[0][0];
            wait=k===1?"kanchan":(k===0&&lo===7)||(k===2&&lo===1)?"penchan":"ryanmen";
          }
        }
        return s;
      }).concat(melds.map(m=>({type:m.type,tiles:m.tiles,open:!!m.open})));
      const r=readStd(sets,d.pair,wait,menzen,ctx);
      if(menzen&&!melds.length&&chuuren(hand)) r.yakuman.push({n:"Nine gates",zh:"九蓮宝燈",h:13});
      finish(r.yaku,r.yakuman,r.fu,"std");
    });
  });

  const ps=!melds.length&&chiitoi(hand);
  if(ps){
    const Y=[{n:"Seven pairs",zh:"七対子",h:2}],K=[];
    const suits=new Set(hand.filter(t=>!isHon(t)).map(t=>t[1])), honor=hand.some(isHon);
    if(hand.every(isHon)) K.push({n:"All honours",zh:"字一色",h:13});
    if(!hand.some(isYao)) Y.push({n:"All simples",zh:"断幺九",h:1});
    if(hand.every(isYao)&&suits.size) Y.push({n:"All terminals and honours",zh:"混老頭",h:2});
    flush(Y,suits,honor,true);
    finish(Y,K,25,"chiitoi");
  }
  if(!reads.length) return null;

  const dora=doraCount(hand,melds,ctx);
  let best=null;
  reads.forEach(r=>{
    const yakuman=r.yakuman.reduce((a,y)=>a+y.h/13,0);
    const yaku=yakuman?r.yakuman:r.yaku;
    const yhan=yaku.reduce((a,y)=>a+y.h,0);
    const han=yakuman?0:yhan+(yhan?dora.dora+dora.aka+dora.ura:0);
    const lim=rBase(han,r.fu,yakuman);
    const sc={yaku:yaku,han:han,fu:r.fu,yakuman:yakuman,form:r.form,
      dora:yakuman?{dora:0,aka:0,ura:0}:dora,base:yaku.length?lim.base:0,label:lim.label};
    sc.pay=rPay(sc.base,!!ctx.dealer,!!ctx.tsumo);
    if(!best||sc.base>best.base||(sc.base===best.base&&sc.han>best.han)) best=sc;
  });
  return best;
}
const rCanWin=a=>!!a&&a.yaku.length>0;

function doraCount(hand,melds,ctx){
  const all=hand.concat(melds.reduce((a,m)=>a.concat(m.tiles),[]));
  const hits=ind=>(ind||[]).reduce((a,i)=>{const d=doraOf(i);return a+all.filter(t=>t===d).length},0);
  const riichi=ctx.riichi||ctx.doubleRiichi;
  return {dora:hits(ctx.dora),aka:ctx.aka||0,ura:riichi?hits(ctx.ura):0};
}

/* the score card: one line per yaku, then dora, then the total */
function rPatList(sc){
  const ul=document.createElement("ul");ul.className="pats";
  const line=(name,zh,h)=>{
    const li=document.createElement("li");
    li.innerHTML='<span>'+name+' <span class="zh">'+zh+'</span></span><b>'+h+'</b>';
    ul.append(li);
  };
  sc.yaku.forEach(y=>line(t(y.n),y.zh,sc.yakuman?t("Yakuman"):tf("{} han",y.h)));
  if(!sc.yakuman){
    if(sc.dora.dora) line(t("Dora"),"ドラ",tf("{} han",sc.dora.dora));
    if(sc.dora.aka) line(t("Red fives"),"赤ドラ",tf("{} han",sc.dora.aka));
    if(sc.dora.ura) line(t("Ura-dora"),"裏ドラ",tf("{} han",sc.dora.ura));
  }
  const tot=document.createElement("li");tot.className="tot";
  const head=sc.yakuman?t(sc.label):tf("{} han {} fu",sc.han,sc.fu)+(sc.label?" · "+t(sc.label):"");
  tot.innerHTML='<span><b>'+t("Total")+'</b></span><b>'+head+'</b>';
  ul.append(tot);return ul;
}

/* ── coach helpers ───────────────────────────────────────────────────────
   Same shape as advise() in mahjong.js, but counting seven pairs and
   thirteen orphans. `only` limits the candidates (what the rules let you throw). */
function rAdvise(hand,melds,seen,ctx,only){
  const ex=melds.length;
  const rows=[...new Set(only||hand)].map(t=>{
    const rest=hand.slice();
    rest.splice(rest.indexOf(t),1);
    return {t:t,rest:rest,sh:rShanten(counts(rest),ex)};
  });
  const sh=Math.min.apply(null,rows.map(r=>r.sh));
  const front=rows.filter(r=>r.sh===sh);
  front.forEach(r=>{
    const base=counts(r.rest);
    r.shape=shapeOf(base,ex);
    r.accept=[];
    ORDER.forEach(d=>{
      const left=4-(seen[IDX[d]]||0);
      if(left<=0)return;
      base[IDX[d]]++;
      const better=rShanten(base,ex)<sh;
      base[IDX[d]]--;
      if(better)r.accept.push({t:d,left:left});
    });
    r.live=r.accept.reduce((a,x)=>a+x.left,0);
  });
  front.sort((a,b)=>(b.live-a.live)||(shed(b.t,ctx)-shed(a.t,ctx)));
  return {sh:sh,pick:front[0],front:front};
}
/* the waits of a 13-tile hand that sit in your own discards */
const rFuriWaits=(h,melds,disc)=>rWaits(h,melds).filter(x=>disc.indexOf(x)>=0);
/* each wait, and whether it wins on a ron / a tsumo without riichi */
function rYakuWaits(h,melds,ctx){
  const c=Object.assign({dora:[],ura:[],aka:0},ctx,{riichi:false,doubleRiichi:false,ippatsu:false});
  const go=(w,ts)=>rCanWin(rScore(h.concat([w]),melds,w,Object.assign({},c,{tsumo:ts})));
  return rWaits(h,melds).map(w=>({t:w,ron:go(w,false),tsumo:go(w,true)}));
}
/* should you declare riichi, and on what? Only discards that keep the hand ready;
   a furiten wait (one you threw, or the tile you throw now) is worth less. */
function rRiichiAdvice(h,melds,seen,ctx,disc){
  let best=null;
  rRiichiDiscards(h,melds).forEach(x=>{
    const rest=h.slice(); rest.splice(rest.indexOf(x),1);
    const waits=rWaits(rest,melds), fur=waits.filter(w=>w===x||disc.indexOf(w)>=0);
    const live=waits.reduce((a,w)=>a+Math.max(0,4-(seen[IDX[w]]||0)),0);
    const r={t:x,rest:rest,waits:waits,live:live,fur:fur,
      yaku:rYakuWaits(rest,melds,ctx).every(y=>y.ron)};
    const better=!best||(!r.fur.length&&best.fur.length)||(!r.fur.length===!best.fur.length&&
      (r.live>best.live||(r.live===best.live&&shed(x,ctx)>shed(best.t,ctx))));
    if(better)best=r;
  });
  /* with a yaku already and a thin wait, staying quiet keeps the hand flexible */
  if(best)best.go=!best.yaku||best.live>=5;
  return best;
}
/* tiles in hand that every riichi player has already thrown (現物) */
const rSafe=(hand,lists)=>[...new Set(hand)].filter(x=>lists.every(l=>l.indexOf(x)>=0));
/* shanten after calling `tile` with `use` (the hand's own tiles), at best discard */
function rCallShanten(hand,melds,tile,kind,use){
  const rest=hand.slice();
  use.forEach(x=>{const i=rest.indexOf(x);if(i>=0)rest.splice(i,1)});
  const ex=melds.length+1;
  if(kind==="kong")return {rest:rest,sh:rShanten(counts(rest),ex)};
  let sh=99;
  [...new Set(rest)].forEach(d=>{
    const r=rest.slice(); r.splice(r.indexOf(d),1);
    sh=Math.min(sh,rShanten(counts(r),ex));
  });
  return {rest:rest,sh:sh};
}
