(function(){
"use strict";
var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var FINE = window.matchMedia("(pointer: fine)").matches;
var root = document.documentElement;
var $ = function(s,c){return (c||document).querySelector(s)};
var $$ = function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};

/* ---------- theme ---------- */
try{ var saved = localStorage.getItem("je-theme"); if(saved==="light"||saved==="dark") root.setAttribute("data-theme",saved); }catch(e){}
function isDark(){
  var t = root.getAttribute("data-theme");
  return t!=="light";
}
var themeListeners = [];
function themeChanged(){ themeListeners.forEach(function(f){f()}); }
$("#themeBtn").addEventListener("click", function(e){
  var next = isDark() ? "light" : "dark";
  var apply = function(){ root.setAttribute("data-theme", next); try{localStorage.setItem("je-theme",next)}catch(err){} themeChanged(); };
  if(!document.startViewTransition || RM){ apply(); return; }
  var r = e.currentTarget.getBoundingClientRect();
  var x = r.left + r.width/2, y = r.top + r.height/2;
  var R = Math.hypot(Math.max(x, innerWidth-x), Math.max(y, innerHeight-y));
  var vt = document.startViewTransition(apply);
  vt.ready.then(function(){
    root.animate({clipPath:["circle(0px at "+x+"px "+y+"px)","circle("+R+"px at "+x+"px "+y+"px)"]},
      {duration:700, easing:"cubic-bezier(.7,0,.2,1)", pseudoElement:"::view-transition-new(root)"});
  }).catch(function(){});
});
new MutationObserver(themeChanged).observe(root,{attributes:true,attributeFilter:["data-theme"]});
function cssVar(n){ return getComputedStyle(root).getPropertyValue(n).trim(); }

/* ---------- mobile menu ---------- */
var menuBtn = $("#menuBtn"), mm = $("#mobileMenu");
menuBtn.addEventListener("click", function(){ var o = mm.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", o); });
$$("a", mm).forEach(function(a){ a.addEventListener("click", function(){ mm.classList.remove("open"); menuBtn.setAttribute("aria-expanded","false"); }); });

/* ---------- scramble ---------- */
var GLYPHS = "01<>/\\#$%&*+=?ABCDEFGHKMNPRSTUVXYZ";
function scramble(el, dur){
  var final = el.dataset.final || el.textContent; el.dataset.final = final;
  if(RM){ el.textContent = final; return; }
  var start = performance.now();
  (function tick(now){
    var p = Math.min(1,(now-start)/dur), out = "";
    for(var i=0;i<final.length;i++){
      var c = final[i];
      if(c===" "||c==="."){ out+=c; continue; }
      out += (i/final.length < p*1.15 - .1) ? c : GLYPHS[(Math.random()*GLYPHS.length)|0];
    }
    el.textContent = out;
    if(p<1) requestAnimationFrame(tick); else el.textContent = final;
  })(start);
}
$$("[data-scramble]").forEach(function(el,i){ setTimeout(function(){scramble(el, 1000)}, 120 + i*260); });
$(".logo").addEventListener("mouseenter", function(){
  var t = $("#logoText"); if(t.dataset.busy) return; t.dataset.busy = 1;
  var small = t.querySelector("small"); var base = t.firstChild; var fin = "suante";
  var start = performance.now();
  (function tick(now){ var p=Math.min(1,(now-start)/500), s="";
    for(var i=0;i<fin.length;i++) s += i/fin.length < p ? fin[i] : GLYPHS[(Math.random()*GLYPHS.length)|0];
    base.textContent = s; if(p<1) requestAnimationFrame(tick); else { base.textContent=fin; delete t.dataset.busy; }
  })(start);
});
$("#name").addEventListener("mouseenter", function(){ $$("[data-scramble]").forEach(function(el){ scramble(el,600) }); });

/* ---------- typed roles ---------- */
var roles = ["IT Student","Exploring the World of Cybersecurity","React & Flutter Developer","Hackathon & CTF Competitor"];
var typed = $("#typed");
if(!RM){
  var ri=0, ci=roles[0].length, del=true;
  (function loop(){
    var w = roles[ri];
    if(del){ ci--; typed.textContent = w.slice(0,ci); if(ci<=0){ del=false; ri=(ri+1)%roles.length; } setTimeout(loop, 34); }
    else { var nw = roles[ri]; ci++; typed.textContent = nw.slice(0,ci); if(ci>=nw.length){ del=true; setTimeout(loop, 2200); } else setTimeout(loop, 62); }
  })();
  setTimeout(function(){},0);
}

/* ---------- counters ---------- */
function countUp(el){
  var to = +el.dataset.count; if(RM) return;
  var st = performance.now(), d = 1400;
  (function t(n){ var p=Math.min(1,(n-st)/d), e=1-Math.pow(1-p,4); el.textContent = Math.round(to*e); if(p<1) requestAnimationFrame(t); })(st);
}
setTimeout(function(){ $$("[data-count]").forEach(countUp); }, 500);

/* ---------- split headings ---------- */
$$(".split").forEach(function(h){
  var i = 0;
  (function walk(node){
    Array.prototype.slice.call(node.childNodes).forEach(function(n){
      if(n.nodeType===3){
        var frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function(word){
          if(!word) return;
          if(/^\s+$/.test(word)){ frag.appendChild(document.createTextNode(word)); return; }
          var w = document.createElement("span"); w.style.display="inline-block"; w.style.whiteSpace="nowrap";
          for(var k=0;k<word.length;k++){ var s=document.createElement("span"); s.className="ch"; s.style.setProperty("--i", i++); s.textContent=word[k]; w.appendChild(s); }
          frag.appendChild(w);
        });
        n.parentNode.replaceChild(frag, n);
      } else if(n.nodeType===1){ walk(n); }
    });
  })(h);
  h.setAttribute("aria-label", h.textContent);
});

/* ---------- reveal (only things below the fold start hidden) ---------- */
if("IntersectionObserver" in window && !RM){
  var targets = $$("[data-reveal], .split");
  var vh = innerHeight;
  targets.forEach(function(el){ if(el.getBoundingClientRect().top > vh*0.92) el.classList.add("pending"); });
  var io = new IntersectionObserver(function(es){
    // things that scroll into view together cascade in, ~90ms apart
    var n = 0;
    es.forEach(function(en){
      if(!en.isIntersecting) return;
      var el = en.target; io.unobserve(el);
      if(el.hasAttribute("data-reveal")){
        if(!el.style.getPropertyValue("--d")) el.style.setProperty("--d", (n++*90)+"ms");
        el.classList.add("in");
        el.addEventListener("animationend", function done(e){ if(e.target!==el) return; el.classList.remove("in"); el.removeEventListener("animationend", done); });
      }
      el.classList.remove("pending");
    });
  },{rootMargin:"0px 0px -8% 0px", threshold:0.05});
  targets.forEach(function(el){ if(el.classList.contains("pending")) io.observe(el); });
}

/* ---------- scroll: progress, nav, top button, timeline beam ---------- */
var prog = $("#progress"), nav = $("#nav"), toTop = $("#toTop"), beam = $("#beam"), tl = $("#timeline");
var evs = $$(".ev-wrap");
var scrollQueued = false;
function onScroll(){
  scrollQueued = false;
  var y = scrollY, vh = innerHeight, h = document.documentElement.scrollHeight - vh;
  var mid = vh*0.6, r = tl.offsetParent ? tl.getBoundingClientRect() : null;
  var lit = r ? evs.map(function(ev){ return ev.getBoundingClientRect().top + 38 < mid; }) : null;
  prog.style.transform = "scaleX(" + (h>0 ? y/h : 0) + ")";
  nav.classList.toggle("scrolled", y > 10);
  toTop.classList.toggle("show", y > vh*1.2);
  if(r){
    beam.style.setProperty("--p", Math.max(0, Math.min(1, (mid - r.top)/r.height)));
    evs.forEach(function(ev,i){ ev.classList.toggle("lit", lit[i]); });
  }
}
addEventListener("scroll", function(){ if(!scrollQueued){ scrollQueued = true; requestAnimationFrame(onScroll); } }, {passive:true});
onScroll();
toTop.addEventListener("click", function(){ scrollTo({top:0, behavior: RM?"auto":"smooth"}); });

/* nav active pill */
var links = $$("#links a"), pill = $("#navPill");
function setActive(id){
  links.forEach(function(a){
    var on = a.getAttribute("href")==="#"+id; a.classList.toggle("active", on);
    if(on){ pill.style.opacity=1; pill.style.width=a.offsetWidth+"px"; pill.style.transform="translateX("+a.offsetLeft+"px)"; }
  });
  if(!links.some(function(a){return a.getAttribute("href")==="#"+id})) pill.style.opacity=0;
}
if("IntersectionObserver" in window){
  var secIO = new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting) setActive(en.target.id); }); },{rootMargin:"-45% 0px -50% 0px"});
  $$("main > section[id]").forEach(function(s){ secIO.observe(s); });
}

/* ---------- cursor, magnetic, tilt ---------- */
if(FINE && !RM){
  var cur = $("#cursor"), cx=innerWidth/2, cy=innerHeight/2, tx=cx, ty=cy;
  addEventListener("mousemove", function(e){ tx=e.clientX; ty=e.clientY; cur.classList.add("on"); });
  document.addEventListener("mouseleave", function(){ cur.classList.remove("on"); });
  (function f(){ cx+=(tx-cx)*.2; cy+=(ty-cy)*.2; cur.style.transform="translate("+cx+"px,"+cy+"px)"; requestAnimationFrame(f); })();
  document.addEventListener("mouseover", function(e){ cur.classList.toggle("big", !!e.target.closest("a,button,.chip,[data-lb]")); });

  $$(".mag").forEach(function(b){
    b.addEventListener("mousemove", function(e){ var r=b.getBoundingClientRect(); var x=e.clientX-r.left-r.width/2, y=e.clientY-r.top-r.height/2; b.style.transform="translate("+x*.18+"px,"+y*.3+"px)"; });
    b.addEventListener("mouseleave", function(){ b.style.transform=""; });
  });
  $$(".tilt").forEach(function(c){
    c.addEventListener("mousemove", function(e){
      var r=c.getBoundingClientRect(), px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
      c.style.setProperty("--rx", ((.5-py)*6).toFixed(2)+"deg"); c.style.setProperty("--ry", ((px-.5)*7).toFixed(2)+"deg");
      c.style.setProperty("--mx", (px*100)+"%"); c.style.setProperty("--my", (py*100)+"%");
    });
    c.addEventListener("mouseleave", function(){ c.style.setProperty("--rx","0deg"); c.style.setProperty("--ry","0deg"); });
  });
  $$(".card:not(.tilt)").forEach(function(c){
    c.addEventListener("mousemove", function(e){ var r=c.getBoundingClientRect(); c.style.setProperty("--mx",(e.clientX-r.left)+"px"); c.style.setProperty("--my",(e.clientY-r.top)+"px"); });
  });
}

/* ---------- hero radar parallax ----------
   Eased --px/--py (-1..1) on the stage; CSS turns them into layered offsets + coin tilt.
   Pointer events cover mouse and touch-drag; the rAF loop only runs while easing. */
(function(){
  if(RM) return;
  var st=$("#coinStage"), hero=$(".hero"), tx=0, ty=0, x=0, y=0, raf=0;
  function clamp(v){ return v<-1?-1:v>1?1:v; }
  function step(){
    x+=(tx-x)*.08; y+=(ty-y)*.08;
    st.style.setProperty("--px",x.toFixed(4)); st.style.setProperty("--py",y.toFixed(4));
    raf = (Math.abs(tx-x)>.001||Math.abs(ty-y)>.001) ? requestAnimationFrame(step) : 0;
  }
  function kick(){ if(!raf) raf=requestAnimationFrame(step); }
  hero.addEventListener("pointermove", function(e){
    var r=st.getBoundingClientRect();
    tx=clamp((e.clientX-(r.left+r.width/2))/(innerWidth/2));
    ty=clamp((e.clientY-(r.top+r.height/2))/(innerHeight/2));
    kick();
  },{passive:true});
  function reset(){ tx=ty=0; kick(); }
  hero.addEventListener("pointerleave", reset);
  hero.addEventListener("pointercancel", reset);
})();

/* ---------- logo → radar accent ----------
   Samples the logo on a 64×64 canvas, buckets saturated pixels into 24 hue bins
   (weighted by saturation, nudged toward the rim where badge colors live), takes the
   strongest hue neighbourhood, and normalises it into a readable accent. Neutral
   (white/black/grey) pixels are ignored. Results are cached per image URL.
   Fallbacks: an explicit data-accent="#hex" on the <img>, else FALLBACK (red), e.g. for
   monochrome logos or cross-origin images without CORS, which taint the canvas. */
var accentCache = {}, FALLBACK = {h:356, s:.84, l:.48};
function rgbToHsl(r,g,b){
  var mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, d=mx-mn;
  if(!d) return {h:0, s:0, l:l};
  var h = mx===r ? ((g-b)/d+6)%6 : mx===g ? (b-r)/d+2 : (r-g)/d+4;
  return {h:h*60, s:d/(1-Math.abs(2*l-1)), l:l};
}
function vivid(c){ return {h:c.h, s:Math.max(c.s,.62), l:Math.min(.58,Math.max(.46,c.l))}; }  // readable on black
function dominantAccent(img){
  var hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((img.dataset.accent||"").trim());
  if(hex){ var hx=hex[1].length===3 ? hex[1].replace(/./g,"$&$&") : hex[1], n=parseInt(hx,16);
    return vivid(rgbToHsl((n>>16&255)/255,(n>>8&255)/255,(n&255)/255)); }
  var key = img.currentSrc || img.src;
  if(key in accentCache) return accentCache[key];
  if(!img.complete || !img.naturalWidth) return undefined;      // not loaded yet: the load listener retries
  var N=64, cv=document.createElement("canvas"); cv.width=cv.height=N;
  var g=cv.getContext("2d",{willReadFrequently:true}), data;
  try{ g.drawImage(img,0,0,N,N); data=g.getImageData(0,0,N,N).data; }
  catch(e){ return (accentCache[key]=null); }                   // tainted canvas (cross-origin)
  var W=new Float64Array(24), R=new Float64Array(24), G=new Float64Array(24), B=new Float64Array(24), total=0, k;
  for(var i=0;i<data.length;i+=4){
    if(data[i+3]<128) continue;
    var c=rgbToHsl(data[i]/255,data[i+1]/255,data[i+2]/255);
    if(c.s<.25||c.l<.12||c.l>.9) continue;
    var p=i/4, x=p%N-N/2+.5, y=Math.floor(p/N)-N/2+.5, w=c.s*(.4+Math.sqrt(x*x+y*y)/(N/2));
    k=Math.floor(c.h/15)%24;
    W[k]+=w; R[k]+=data[i]*w; G[k]+=data[i+1]*w; B[k]+=data[i+2]*w; total+=w;
  }
  if(total<N*N*.03) return (accentCache[key]=null);           // essentially monochrome logo
  var best=0, bs=-1;
  for(k=0;k<24;k++){ var sc=W[k]+.5*(W[(k+23)%24]+W[(k+1)%24]); if(sc>bs){bs=sc;best=k;} }
  var sw=0, sr=0, sg=0, sb=0;
  [best+23,best,best+1].forEach(function(j){ j%=24; sw+=W[j]; sr+=R[j]; sg+=G[j]; sb+=B[j]; });
  return (accentCache[key]=vivid(rgbToHsl(sr/sw/255,sg/sw/255,sb/sw/255)));
}
function setRadarAccent(stage, img){
  var c = img ? dominantAccent(img) : null;
  if(c === undefined) return;                                   // logo still loading; keep current accent
  c = c || FALLBACK;
  // take the short way round the colour wheel so red→green doesn't sweep through blue
  var cur = stage._rh == null ? FALLBACK.h : stage._rh;
  var h = cur + ((c.h - cur) % 360 + 540) % 360 - 180;
  var first = stage._rh == null;
  if(first) stage.style.transition = "none";                     // first paint: no fade from the default
  stage._rh = h;
  stage.style.setProperty("--rh", h.toFixed(1));
  stage.style.setProperty("--rs", (c.s*100).toFixed(1)+"%");
  stage.style.setProperty("--rl", (c.l*100).toFixed(1)+"%");
  if(first){ void stage.offsetWidth; stage.style.transition = ""; }
}

/* ---------- guild coin flip ---------- */
(function(){
  var stage=$("#coinStage"), coin=$("#coin"), cap=$("#coinCap"), flip=0, hovering=false;
  var info=[["ASU Dev Guild","Learn · Build · Serve"],["ASU Cyber Guild","Team CyberGuild · HackForGov 5 Top 5"]];
  var faces=[$(".coin .front img"), $(".coin .back img")], side=0;
  function sync(){ setRadarAccent(stage, faces[side]); }
  faces.forEach(function(img, i){
    // re-sync when a logo finishes loading or is swapped at runtime (src/srcset/data-accent)
    img.addEventListener("load", function(){ if(i===side) sync(); });
    new MutationObserver(function(){ if(i===side) sync(); }).observe(img,{attributes:true,attributeFilter:["src","srcset","data-accent"]});
  });
  sync();
  function doFlip(){
    flip+=180; coin.style.setProperty("--flip",flip+"deg");
    side=(flip/180)%2; stage.classList.toggle("cyber", side===1);
    sync();
    cap.classList.add("swap");
    setTimeout(function(){ $("#coinName").textContent=info[side][0]; $("#coinSub").textContent=info[side][1]; cap.classList.remove("swap"); }, 450);
  }
  $("#coinBtn").addEventListener("click", doFlip);
  stage.addEventListener("mouseenter", function(){ hovering=true; });
  stage.addEventListener("mouseleave", function(){ hovering=false; });
  if(!RM) setInterval(function(){ if(!hovering && !document.hidden) doFlip(); }, 4800);
})();

/* ---------- click sparks ---------- */
if(!RM) document.addEventListener("pointerdown", function(e){
  var b=e.target.closest(".btn,.node,.sk-filter button,.coin-tilt,.tabs button,.social"); if(!b) return;
  var cols=[cssVar("--accent"),cssVar("--amber"),cssVar("--fg")];
  for(var i=0;i<12;i++){
    var sp=document.createElement("span"); sp.className="spark";
    var ang=Math.random()*6.283, dist=30+Math.random()*50;
    sp.style.left=e.clientX+"px"; sp.style.top=e.clientY+"px"; sp.style.background=cols[i%3];
    sp.style.setProperty("--dx",Math.cos(ang)*dist+"px"); sp.style.setProperty("--dy",Math.sin(ang)*dist+"px");
    document.body.appendChild(sp); setTimeout(sp.remove.bind(sp),750);
  }
});

/* ---------- skills orbit ---------- */
(function(){
  var orbit=$("#orbit"); if(!orbit) return;
  $$(".o-ring",orbit).forEach(function(r){
    var ns=$$(".node",r), off=+(r.dataset.off||0);
    ns.forEach(function(n,i){ var a=(i/ns.length*360+off)*Math.PI/180; n.style.left=(50+50*Math.cos(a))+"%"; n.style.top=(50+50*Math.sin(a))+"%"; });
  });
  var nodes=$$(".node",orbit), cats=$$(".sk-cat"), fb=$$(".sk-filter button"), auto=null, touched=false;
  $$(".sk-cat").forEach(function(c){ $$(".chip",c).forEach(function(ch,i){ ch.style.setProperty("--i",i); }); });
  function has(n,f){ return n.dataset.cat.split(" ").indexOf(f)>=0; }
  function focus(f){
    orbit.dataset.focus=f;
    nodes.forEach(function(n){ var m = f==="all" || has(n,f); n.classList.toggle("dim",!m); n.classList.toggle("lit", f!=="all" && m); });
    cats.forEach(function(c){ c.classList.toggle("on", c.dataset.cat===f); });
    fb.forEach(function(b){ b.setAttribute("aria-pressed", String(b.dataset.f===f)); });
  }
  function user(){ touched=true; clearInterval(auto); }
  fb.forEach(function(b){ b.addEventListener("click", function(){ user(); focus(b.dataset.f); }); });
  cats.forEach(function(c){
    var go=function(){ user(); focus(orbit.dataset.focus===c.dataset.cat ? "all" : c.dataset.cat); if(innerWidth<=980) orbit.scrollIntoView({behavior:RM?"auto":"smooth",block:"center"}); };
    c.addEventListener("click", function(e){ if(e.target.closest("a")) return; go(); });
    c.addEventListener("keydown", function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } });
  });
  nodes.forEach(function(n){
    n.addEventListener("mouseenter", function(){ cats.forEach(function(c){ c.classList.toggle("peek", has(n,c.dataset.cat)); }); });
    n.addEventListener("mouseleave", function(){ cats.forEach(function(c){ c.classList.remove("peek"); }); });
    n.addEventListener("click", function(){ user(); focus(n.dataset.cat.split(" ")[0]); });
  });
  // gently cycle through categories until the visitor interacts
  var order=["lang","web","mobile","sec","tools","all"], oi=0;
  if(!RM && "IntersectionObserver" in window){
    new IntersectionObserver(function(es){
      if(touched) return;
      if(es[0].isIntersecting){ if(!auto) auto=setInterval(function(){ if(!orbit.matches(":hover")){ focus(order[oi]); oi=(oi+1)%order.length; } }, 2600); }
      else { clearInterval(auto); auto=null; }
    },{threshold:.4}).observe(orbit);
  }
})();

/* ---------- terminal ---------- */
(function(){
  var el=$("#term"); if(!el) return;
  var P='<span class="p">deadbyte@asu-kalibo</span><span class="m">:~$</span> ';
  var L=[
    ["cmd","whoami"],
    ["out",'John Emmanuel T. Suante <span class="m">·</span> BSIT 2nd year <span class="m">·</span> Malinao, Aklan'],
    ["cmd","cat stack.json"],
    ["out",'{'],
    ["out",'  <span class="k">"languages"</span>: [<span class="s">"TypeScript"</span>, <span class="s">"JavaScript"</span>, <span class="s">"Java"</span>, <span class="s">"Dart"</span>, <span class="s">"Python"</span>],'],
    ["out",'  <span class="k">"web"</span>:       [<span class="s">"React"</span>, <span class="s">"HTML"</span>, <span class="s">"CSS"</span>, <span class="s">"Tailwind CSS"</span>, <span class="s">"Flask"</span>],'],
    ["out",'  <span class="k">"mobile"</span>:    [<span class="s">"Flutter"</span>],'],
    ["out",'  <span class="k">"security"</span>:  [<span class="s">"CTF"</span>, <span class="s">"Ethical hacking"</span>, <span class="s">"Secure auth"</span>]'],
    ["out",'}'],
    ["cmd","./level-up --target cybersecurity"],
    ["out",'<span class="m">[</span><span class="p">████████████</span><span class="m">░░░░░░░░</span><span class="m">]</span> training in progress<span class="m">...</span>'],
    ["cmd",""]
  ];
  function full(){ el.innerHTML = L.map(function(l){ return l[0]==="cmd" ? P+l[1] : l[1]; }).join("\n") + '<span class="cur"></span>'; }
  full();
  if(RM || !("IntersectionObserver" in window)) return;
  var played=false;
  new IntersectionObserver(function(es,o){
    if(!es[0].isIntersecting || played) return; played=true; o.disconnect();
    var html="", li=0;
    function next(){
      if(li>=L.length){ el.innerHTML=html+'<span class="cur"></span>'; return; }
      var l=L[li++];
      if(l[0]==="out"){ html += l[1] + "\n"; el.innerHTML=html+'<span class="cur"></span>'; setTimeout(next, 90); return; }
      var ci=0; html += P;
      (function type(){
        el.innerHTML = html + l[1].slice(0,ci) + '<span class="cur"></span>';
        if(ci < l[1].length){ ci++; setTimeout(type, 38 + Math.random()*40); }
        else { html += l[1] + (li<L.length ? "\n" : ""); setTimeout(next, 380); }
      })();
    }
    el.innerHTML='<span class="cur"></span>'; setTimeout(next, 300);
  },{threshold:.35}).observe(el);
})();

/* ---------- toast / copy ---------- */
var toast = $("#toast"), tT;
function showToast(m){ toast.textContent=m; toast.classList.add("show"); clearTimeout(tT); tT=setTimeout(function(){toast.classList.remove("show")},2000); }
function copy(text, ok, sel){
  var fallback = function(){ if(sel){ var r=document.createRange(); r.selectNodeContents(sel); var s=getSelection(); s.removeAllRanges(); s.addRange(r); showToast("Selected. Press Ctrl+C to copy"); } else showToast("Copy isn't available here"); };
  try{ navigator.clipboard.writeText(text).then(function(){showToast(ok)}, fallback); }catch(e){ fallback(); }
}
$("#copyBtn").addEventListener("click", function(){ copy("suantejohnemmanuel@gmail.com","Email copied", $("#emailText")); });

/* ---------- modals ---------- */
var lastFocus;
function openModal(m){ lastFocus=document.activeElement; m.hidden=false; requestAnimationFrame(function(){ m.classList.add("open"); }); document.body.style.overflow="hidden"; var c=m.querySelector("[data-close]"); c && c.focus(); }
function closeModal(m){ m.classList.remove("open"); document.body.style.overflow=""; setTimeout(function(){ m.hidden=true; }, 300); lastFocus && lastFocus.focus(); }
$$(".modal").forEach(function(m){
  m.addEventListener("click", function(e){ if(e.target===m || e.target.closest("[data-close]")) closeModal(m); });
});
addEventListener("keydown", function(e){ if(e.key==="Escape") $$(".modal.open").forEach(closeModal); });
var lb = $("#lightbox");
document.addEventListener("click", function(e){
  var t = e.target.closest("[data-lb]"); if(!t) return;
  $("#lbImg").src = t.dataset.lb; $("#lbImg").alt = t.dataset.cap || ""; $("#lbCap").textContent = t.dataset.cap || ""; openModal(lb);
});
var resume = $("#resume");
$("#resumeBtn").addEventListener("click", function(){ openModal(resume); });
$("#pdfCv").addEventListener("click", function(){
  var old = document.title;
  document.title = "John Emmanuel Suante - Resume";
  document.body.classList.add("print-resume");
  window.print();
  document.body.classList.remove("print-resume");
  document.title = old;
});
$("#copyCv").addEventListener("click", function(){ copy(resume.querySelector(".box").innerText.replace(/Copy resume text[\s\S]*$/,"").trim(), "Resume text copied", null); });

/* ---------- tabs ---------- */
var tabs = $$("#tabs [role=tab]"), tabPill = $("#tabPill");
function placePill(b){ tabPill.style.width=b.offsetWidth+"px"; tabPill.style.transform="translateX("+(b.offsetLeft-5)+"px)"; tabPill.style.left="5px"; }
tabs.forEach(function(b){
  b.addEventListener("click", function(){
    tabs.forEach(function(x){ var on = x===b; x.setAttribute("aria-selected", on); $("#"+x.getAttribute("aria-controls")).hidden = !on; });
    placePill(b); onScroll();
  });
});
placePill(tabs[0]); addEventListener("resize", function(){ placePill($("#tabs [aria-selected=true]")); var a=$("#links a.active"); a && setActive(a.getAttribute("href").slice(1)); });
if(document.fonts) document.fonts.ready.then(function(){ placePill($("#tabs [aria-selected=true]")); });

/* ---------- clock ---------- */
var fmt = new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Manila",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
function clock(){ var s = fmt.format(new Date()); $("#clock").textContent = s; $("#clock2").textContent = s.slice(0,5); }
clock(); setInterval(clock, 1000);

/* ---------- hero dot field ---------- */
(function(){
  var cv = $("#field"), ctx = cv.getContext("2d"), paths = [], W, H, dpr, mx=-999, my=-999, run=true, col, acc;
  function size(){ dpr=Math.min(2,devicePixelRatio||1); W=cv.offsetWidth; H=cv.offsetHeight; cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); colors(); draw(performance.now()); }
  function colors(){ col=cssVar("--dot"); acc=cssVar("--accent"); }
  themeListeners.push(function(){ colors(); draw(performance.now()); });
  var hero = $(".hero");
  hero.addEventListener("mousemove", function(e){ var r=cv.getBoundingClientRect(); mx=e.clientX-r.left; my=e.clientY-r.top; });
  hero.addEventListener("mouseleave", function(){ mx=my=-999; });
  function draw(t){
    ctx.clearRect(0,0,W,H);
    var s = W<600 ? 22 : 28;
    for(var b=0;b<20;b++){ paths[b] = paths[b] || []; paths[b].length = 0; }
    for(var y=s/2; y<H; y+=s){
      for(var x=s/2; x<W; x+=s){
        var dx=x-mx, dy=y-my, d=Math.sqrt(dx*dx+dy*dy);
        var hov = Math.max(0, 1 - d/170);
        var wave = RM ? 0 : (Math.sin(x*0.012 + y*0.008 - t*0.0011)+1)/2;
        var a = 0.2 + wave*0.3 + hov*0.6;
        var r = 1 + hov*1.9 + wave*0.35;
        var ox = hov ? -dx/d*hov*6 : 0, oy = hov ? -dy/d*hov*6 : 0;
        paths[(hov>0.05 ? 10 : 0) + Math.min(9, Math.floor(Math.min(1,a)*10))].push(x+ox, y+oy, r);
      }
    }
    for(var k=0;k<20;k++){
      var P = paths[k]; if(!P.length) continue;
      ctx.globalAlpha = ((k%10)+0.5)/10; ctx.fillStyle = k>=10 ? acc : col;
      ctx.beginPath();
      for(var i=0;i<P.length;i+=3){ ctx.moveTo(P[i]+P[i+2], P[i+1]); ctx.arc(P[i], P[i+1], P[i+2], 0, 6.283); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function loop(t){ if(run) draw(t); requestAnimationFrame(loop); }
  addEventListener("resize", size); size();
  if(!RM){
    if("IntersectionObserver" in window) new IntersectionObserver(function(e){ run = e[0].isIntersecting; }).observe(cv);
    requestAnimationFrame(loop);
  }
})();

/* ---------- dot-matrix map of Panay, centered on Poblacion, Malinao ---------- */
(function(){
  var HOME = [122.3076, 11.6442];
  // Simplified coastlines [lon, lat]
  var LAND = [
    // Panay
    [[121.87,11.86],[121.93,11.90],[122.00,11.87],[122.09,11.83],[122.17,11.81],[122.26,11.78],[122.33,11.74],[122.38,11.72],[122.43,11.67],[122.46,11.62],[122.50,11.60],[122.54,11.60],[122.62,11.58],[122.70,11.60],[122.76,11.59],[122.85,11.55],[122.93,11.50],[123.00,11.47],[123.06,11.50],[123.12,11.57],[123.16,11.52],[123.15,11.44],[123.10,11.37],[123.05,11.27],[123.06,11.18],[122.98,11.13],[122.88,11.05],[122.80,10.96],[122.72,10.83],[122.64,10.74],[122.57,10.69],[122.49,10.69],[122.40,10.67],[122.30,10.66],[122.22,10.63],[122.13,10.58],[122.05,10.52],[121.98,10.45],[121.93,10.43],[121.92,10.52],[121.95,10.63],[121.97,10.72],[121.95,10.80],[121.98,10.90],[122.04,11.00],[122.05,11.10],[122.03,11.20],[122.03,11.30],[122.06,11.42],[122.08,11.55],[122.09,11.66],[122.04,11.72],[121.96,11.75],[121.90,11.78]],
    // Guimaras
    [[122.52,10.70],[122.62,10.72],[122.70,10.68],[122.74,10.58],[122.70,10.47],[122.62,10.42],[122.55,10.47],[122.52,10.57]],
    // Negros (northwest)
    [[123.12,10.97],[123.20,11.00],[123.33,10.97],[123.45,10.93],[123.55,10.85],[123.75,10.80],[123.90,10.50],[123.90,9.80],[122.85,9.80],[122.86,10.15],[122.85,10.35],[122.80,10.52],[122.90,10.60],[122.95,10.70],[122.97,10.80],[123.05,10.90]],
    // Tablas
    [[121.95,12.20],[122.03,12.18],[122.10,12.30],[122.12,12.45],[122.08,12.62],[122.02,12.68],[121.97,12.55],[121.95,12.38]],
    // Romblon
    [[122.24,12.53],[122.30,12.52],[122.33,12.58],[122.28,12.65],[122.23,12.60]],
    // Sibuyan
    [[122.48,12.38],[122.58,12.30],[122.70,12.33],[122.72,12.45],[122.62,12.52],[122.50,12.48]],
    // Carabao, Boracay, Semirara, Caluya
    [[121.90,12.03],[121.96,12.03],[121.96,12.11],[121.90,12.11]],
    [[121.905,11.94],[121.955,11.95],[121.945,12.00],[121.915,11.995]],
    [[121.34,12.02],[121.44,12.01],[121.45,12.09],[121.36,12.11]],
    [[121.51,11.89],[121.58,11.89],[121.58,11.97],[121.51,11.96]],
    // Mindoro (southeast)
    [[120.50,13.40],[121.60,13.20],[121.55,12.90],[121.52,12.60],[121.45,12.45],[121.38,12.30],[121.25,12.22],[121.10,12.25],[120.95,12.40],[120.50,12.70]],
    // Masbate (southwest)
    [[123.25,12.35],[123.30,12.20],[123.45,12.15],[123.60,12.05],[123.80,11.95],[124.20,12.00],[124.20,12.60],[123.70,12.55],[123.45,12.55],[123.30,12.45]],
    // Gigantes, Sicogon, Bantayan
    [[123.31,11.56],[123.37,11.57],[123.37,11.64],[123.31,11.63]],
    [[123.21,11.43],[123.28,11.44],[123.27,11.50],[123.21,11.49]],
    [[123.68,11.12],[123.78,11.13],[123.78,11.25],[123.70,11.25]]
  ];
  var PLACES = [];
  function inPoly(x,y,p){ var c=false; for(var i=0,j=p.length-1;i<p.length;j=i++){ var xi=p[i][0],yi=p[i][1],xj=p[j][0],yj=p[j][1]; if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) c=!c; } return c; }
  function isLand(lon,lat){ for(var k=0;k<LAND.length;k++) if(inPoly(lon,lat,LAND[k])) return true; return false; }

  var cv=$("#map"), ctx=cv.getContext("2d"), W,H,dpr,k,cosL=Math.cos(HOME[1]*Math.PI/180), dots=[], mpaths=[], step, col={}, mx=-999,my=-999, t0=null, visible=false;
  function proj(ll){ return [W/2 + (ll[0]-HOME[0])*cosL*k, H/2 - (ll[1]-HOME[1])*k]; }
  function colors(){ col.dot=cssVar("--dot"); col.acc=getComputedStyle(cv).getPropertyValue("--map-acc").trim()||cssVar("--accent"); col.amber=cssVar("--amber"); col.fg=cssVar("--fg"); col.muted=cssVar("--muted"); col.bg=cssVar("--bg-2"); col.font=getComputedStyle(document.body).fontFamily; col.mono=cssVar("--f-mono"); }
  function build(){
    dpr=Math.min(2,devicePixelRatio||1); W=cv.offsetWidth; H=cv.offsetHeight; cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    k = Math.max(H/1.8, W/(2.9*cosL));      // px per degree
    step = W < 520 ? 7 : 8;
    dots=[];
    for(var y=step/2;y<H;y+=step) for(var x=step/2;x<W;x+=step){
      var lon = HOME[0] + (x-W/2)/(k*cosL), lat = HOME[1] - (y-H/2)/k;
      if(isLand(lon,lat)){ var dx=x-W/2, dy=y-H/2; dots.push({x:x,y:y,d:Math.sqrt(dx*dx+dy*dy),r:Math.random()}); }
    }
  }
  function draw(now){
    if(t0===null) t0=now; var t=(now-t0)/1000;
    ctx.clearRect(0,0,W,H);
    var maxD = Math.hypot(W,H)/2;
    var reveal = RM ? 1e9 : t*520;          // px/sec radial reveal from home
    var waveR = RM ? -999 : ((t*150) % (maxD+200));
    var glowR = Math.min(W,H)*0.36;
    // glow
    var g = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,glowR*1.4);
    g.addColorStop(0, hexA(col.acc,.14)); g.addColorStop(1, hexA(col.acc,0));
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    for(var b=0;b<20;b++){ mpaths[b] = mpaths[b] || []; mpaths[b].length = 0; }
    for(var i=0;i<dots.length;i++){
      var p=dots[i]; if(p.d > reveal) continue;
      var appear = Math.min(1,(reveal-p.d)/120);
      var near = Math.max(0, 1-p.d/glowR);
      var w = Math.exp(-Math.pow(p.d-waveR,2)/900);
      var hx=p.x-mx, hy=p.y-my, hd=Math.sqrt(hx*hx+hy*hy), hov=Math.max(0,1-hd/70);
      var tw = RM?0:(Math.sin(t*2+p.r*20)+1)*0.08;
      var a = (0.38 + near*0.5 + w*0.5 + hov*0.6 + tw) * appear;
      var r = (1.15 + near*0.9 + w*0.9 + hov*1.4) * (0.4+0.6*appear);
      mpaths[((near>0.3 || w>0.35 || hov>0.1) ? 10 : 0) + Math.min(9, Math.floor(Math.min(1,a)*10))].push(p.x, p.y, r);
    }
    for(var bk=0;bk<20;bk++){
      var P = mpaths[bk]; if(!P.length) continue;
      ctx.globalAlpha = ((bk%10)+0.5)/10; ctx.fillStyle = bk>=10 ? col.acc : col.muted;
      ctx.beginPath();
      for(var z=0;z<P.length;z+=3){ ctx.moveTo(P[z]+P[z+2], P[z+1]); ctx.arc(P[z], P[z+1], P[z+2], 0, 6.283); }
      ctx.fill();
    }
    ctx.globalAlpha=1;
    // route arcs from home
    var h = proj(HOME), ready = Math.min(1, Math.max(0,(t-0.9)/1.2));
    PLACES.forEach(function(pl){
      if(pl.kind==="home") return;
      var q = proj(pl.ll); var c = pl.kind==="comp"? col.amber : col.fg;
      var mxp=(h[0]+q[0])/2 + (q[1]-h[1])*0.25, myp=(h[1]+q[1])/2 - (q[0]-h[0])*0.25;
      ctx.save(); ctx.strokeStyle=hexA(c,.75); ctx.lineWidth=1.4; ctx.setLineDash([4,5]); ctx.lineDashOffset = RM?0:-t*18;
      ctx.beginPath();
      var N=40, M=Math.round(N*(RM?1:ready));
      for(var s=0;s<=M;s++){ var u=s/N, x=(1-u)*(1-u)*h[0]+2*(1-u)*u*mxp+u*u*q[0], y=(1-u)*(1-u)*h[1]+2*(1-u)*u*myp+u*u*q[1]; s?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke(); ctx.restore();
      if(ready>=1 || RM){
        ctx.fillStyle=c; ctx.beginPath(); ctx.arc(q[0],q[1],4,0,6.283); ctx.fill();
        ctx.strokeStyle=hexA(c,.45); ctx.lineWidth=1; ctx.beginPath(); ctx.arc(q[0],q[1],9,0,6.283); ctx.stroke();
        label(pl.name, pl.sub, q[0], q[1], c, pl.kind==="campus", false, pl.kind==="campus");
      }
    });
    drawHome(h[0], h[1], t);
    drawCursor(h[0], h[1]);
  }
  /* home marker: radar lock-on — sweep, ranged rings with ticks, rotating brackets,
     breathing corner locks, pulses, glowing core, and a callout tag */
  function drawHome(X, Y, t){
    var R1=22, R2=46, R3=72, sp=RM?0:t, TAU=6.2832;
    ctx.save(); ctx.strokeStyle=hexA(col.acc,.16); ctx.lineWidth=1; ctx.setLineDash([2,6]);
    ctx.beginPath(); ctx.moveTo(0,Y); ctx.lineTo(X-R3-12,Y); ctx.moveTo(X+R3+12,Y); ctx.lineTo(W,Y);
    ctx.moveTo(X,0); ctx.lineTo(X,Y-R3-12); ctx.moveTo(X,Y+R3+12); ctx.lineTo(X,H); ctx.stroke(); ctx.restore();
    // scope backdrop keeps the marker legible over dense dots
    var bg=ctx.createRadialGradient(X,Y,0,X,Y,R3+6); bg.addColorStop(0,hexA(col.bg,.55)); bg.addColorStop(.85,hexA(col.bg,.35)); bg.addColorStop(1,hexA(col.bg,0));
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(X,Y,R3+6,0,TAU); ctx.fill();
    // sweep
    if(!RM && ctx.createConicGradient){
      var ang=(sp*1.1)%TAU, cg=ctx.createConicGradient(ang,X,Y);
      cg.addColorStop(0,hexA(col.acc,0)); cg.addColorStop(.78,hexA(col.acc,0)); cg.addColorStop(.995,hexA(col.acc,.26)); cg.addColorStop(1,hexA(col.acc,0));
      ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(X,Y,R3,0,TAU); ctx.fill();
      ctx.strokeStyle=hexA(col.acc,.6); ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(X,Y); ctx.lineTo(X+Math.cos(ang)*R3, Y+Math.sin(ang)*R3); ctx.stroke();
    }
    // range rings
    ctx.lineWidth=1;
    ctx.strokeStyle=hexA(col.acc,.38); ctx.beginPath(); ctx.arc(X,Y,R1,0,TAU); ctx.stroke();
    ctx.save(); ctx.setLineDash([3,4]); ctx.strokeStyle=hexA(col.acc,.28); ctx.beginPath(); ctx.arc(X,Y,R2,0,TAU); ctx.stroke(); ctx.restore();
    ctx.strokeStyle=hexA(col.acc,.22); ctx.beginPath(); ctx.arc(X,Y,R3,0,TAU); ctx.stroke();
    // compass ticks on the outer ring, slowly rotating
    ctx.save(); ctx.translate(X,Y); ctx.rotate(-sp*0.05);
    for(var i=0;i<72;i++){ var maj=i%9===0; ctx.strokeStyle=hexA(col.acc, maj?.7:.28); ctx.lineWidth=maj?1.4:1;
      var c=Math.cos(i*TAU/72), s=Math.sin(i*TAU/72); ctx.beginPath(); ctx.moveTo(c*R3,s*R3); ctx.lineTo(c*(R3+(maj?7:3.5)),s*(R3+(maj?7:3.5))); ctx.stroke(); }
    ctx.restore();
    // rotating bracket arcs
    ctx.save(); ctx.translate(X,Y); ctx.rotate(sp*0.6); ctx.strokeStyle=hexA(col.acc,.85); ctx.lineWidth=1.8; ctx.lineCap="round";
    for(var q=0;q<3;q++){ ctx.beginPath(); ctx.arc(0,0,R2,q*TAU/3+0.2,q*TAU/3+0.95); ctx.stroke(); }
    ctx.restore();
    // pulses
    var pulse=RM?0.5:(t*0.5)%1;
    for(var j=0;j<2;j++){ var ph=(pulse+j*0.5)%1; ctx.strokeStyle=hexA(col.acc,(1-ph)*0.6); ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(X,Y,8+ph*(R3-8),0,TAU); ctx.stroke(); }
    // breathing lock-on corners
    var L=13+(RM?0:Math.sin(t*2.2)*1.6), l=5;
    ctx.strokeStyle=hexA(col.fg,.85); ctx.lineWidth=1.4; ctx.lineCap="square"; ctx.beginPath();
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(d){ var cx=X+d[0]*L, cy=Y+d[1]*L; ctx.moveTo(cx-d[0]*l,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy-d[1]*l); });
    ctx.stroke(); ctx.lineCap="butt";
    // core
    ctx.strokeStyle=hexA(col.acc,.9); ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(X,Y,8.5,0,TAU); ctx.stroke();
    ctx.fillStyle=col.acc; ctx.shadowColor=col.acc; ctx.shadowBlur=16; ctx.beginPath(); ctx.arc(X,Y,4.5,0,TAU); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle=col.fg; ctx.beginPath(); ctx.arc(X,Y,1.6,0,TAU); ctx.fill();
    // callout: elbow leader to a tag (right, else left, else below on narrow maps)
    var t1="MALINAO", t2="HOME · 11.64°N 122.31°E";
    ctx.font="600 12px "+col.mono; var w1=ctx.measureText(t1).width; ctx.font="400 10px "+col.mono; var w2=ctx.measureText(t2).width;
    var bw=Math.max(w1,w2)+20, bh=40, d=R3*.72, bx, by;
    ctx.strokeStyle=hexA(col.acc,.7); ctx.fillStyle=col.acc; ctx.lineWidth=1; ctx.beginPath();
    var side = X+d+32+bw < W-8 ? 1 : X-d-32-bw > 8 ? -1 : 0;
    if(side){
      var ex=X+side*d, ey=Y-d, hx=ex+side*26;
      ctx.moveTo(X+side*11,Y-11); ctx.lineTo(ex,ey); ctx.lineTo(hx,ey); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx,ey,2,0,TAU); ctx.fill();
      bx = side>0 ? hx+6 : hx-6-bw; by = ey-bh/2;
    } else {
      var vy=Y+R3+18;
      ctx.moveTo(X,Y+11); ctx.lineTo(X,vy); ctx.stroke();
      ctx.beginPath(); ctx.arc(X,vy,2,0,TAU); ctx.fill();
      bx = Math.min(W-8-bw, Math.max(8, X-bw/2)); by = vy+6;
    }
    ctx.fillStyle=hexA(col.bg,.88); ctx.strokeStyle=hexA(col.acc,.45); ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(bx,by,bw,bh,6); else ctx.rect(bx,by,bw,bh); ctx.fill(); ctx.stroke();
    ctx.fillStyle=col.acc; ctx.fillRect(bx,by+8,2,bh-16);
    ctx.textAlign="left"; ctx.font="600 12px "+col.mono; ctx.fillStyle=col.fg; ctx.fillText(t1,bx+11,by+17);
    ctx.font="400 10px "+col.mono; ctx.fillStyle=col.muted; ctx.fillText(t2,bx+11,by+31);
  }
  /* cursor readout: live lat/lon + distance from home, tethered to the marker */
  function drawCursor(X, Y){
    if(mx<0) return;
    var lon=HOME[0]+(mx-W/2)/(k*cosL), lat=HOME[1]-(my-H/2)/k;
    var km=Math.hypot((lon-HOME[0])*cosL,lat-HOME[1])*111.32;
    ctx.save(); ctx.setLineDash([3,4]); ctx.strokeStyle=hexA(col.acc,.35); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(X,Y); ctx.lineTo(mx,my); ctx.stroke(); ctx.restore();
    ctx.strokeStyle=hexA(col.fg,.7); ctx.lineWidth=1; ctx.beginPath(); ctx.arc(mx,my,6,0,6.2832); ctx.stroke();
    var txt=Math.abs(lat).toFixed(3)+"°"+(lat>=0?"N":"S")+"  "+lon.toFixed(3)+"°E  ·  "+km.toFixed(1)+" km";
    ctx.font="500 10px "+col.mono; var tw=ctx.measureText(txt).width+14, tx=mx+14, ty=my+12;
    if(tx+tw>W-6) tx=mx-14-tw; if(ty+20>H-6) ty=my-32;
    ctx.fillStyle=hexA(col.bg,.88); ctx.strokeStyle=hexA(col.acc,.35); ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(tx,ty,tw,20,5); else ctx.rect(tx,ty,tw,20); ctx.fill(); ctx.stroke();
    ctx.fillStyle=col.fg; ctx.textAlign="left"; ctx.fillText(txt,tx+7,ty+13.5);
  }
  function label(a,b,x,y,c,above,big,left){
    ctx.font = (big?"700 15px ":"600 12px ") + col.font;
    var tx = x + (big?70:14), ty = above ? y - 22 : y + 4;
    if(left || x > W - 150){ ctx.textAlign="right"; tx = x - 14; } else ctx.textAlign="left";
    ctx.fillStyle = col.fg; ctx.fillText(a, tx, ty);
    ctx.font = "400 10.5px " + col.mono; ctx.fillStyle = col.muted; ctx.fillText(b, tx, ty+14);
    ctx.textAlign="left";
  }
  function hexA(c,a){
    c=c.trim(); if(c[0]==="#"){ var n=c.slice(1); if(n.length===3) n=n.replace(/./g,"$&$&"); var v=parseInt(n,16); return "rgba("+(v>>16&255)+","+(v>>8&255)+","+(v&255)+","+a+")"; }
    var m=c.match(/[\d.]+/g); return m ? "rgba("+m[0]+","+m[1]+","+m[2]+","+a+")" : c;
  }
  cv.addEventListener("mousemove", function(e){ var r=cv.getBoundingClientRect(); mx=e.clientX-r.left; my=e.clientY-r.top; if(RM) draw(performance.now()); });
  cv.addEventListener("mouseleave", function(){ mx=my=-999; if(RM) draw(performance.now()); });
  themeListeners.push(function(){ colors(); if(RM||!visible) draw(performance.now()); });
  addEventListener("resize", function(){ build(); draw(performance.now()); });
  colors(); build(); draw(performance.now());
  function loop(now){ if(visible) draw(now); requestAnimationFrame(loop); }
  if(!RM){
    if("IntersectionObserver" in window){
      new IntersectionObserver(function(e){ var was=visible; visible=e[0].isIntersecting; if(visible && !was && t0!==null && performance.now()-t0 > 8000){} },{threshold:0.15}).observe(cv);
      var firstIO = new IntersectionObserver(function(e){ if(e[0].isIntersecting){ t0=null; firstIO.disconnect(); } },{threshold:0.3});
      firstIO.observe(cv);
    } else visible=true;
    requestAnimationFrame(loop);
  }
})();

/* ---------- contact: secure-channel handshake ---------- */
(function(){
  var log = $("#cxLog"), sid = $("#cxSid");
  if(!log) return;
  var hex = "0123456789abcdef", id = "";
  for(var i=0;i<8;i++) id += hex[Math.floor(Math.random()*16)];
  if(sid) sid.textContent = "sid:" + id;
  if(RM || !("IntersectionObserver" in window)) return;
  var html = log.innerHTML.split("\n");
  log.innerHTML = html.map(function(l){ return '<span class="ln">'+l+'</span>'; }).join("\n");
  var lines = $$(".ln", log);
  new IntersectionObserver(function(es,o){
    if(!es[0].isIntersecting) return; o.disconnect();
    lines.forEach(function(l,k){ setTimeout(function(){ l.classList.add("on"); }, 250 + k*380); });
  },{threshold:.4}).observe(log);
})();

})();
