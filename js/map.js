/* ---------- interactive map: Panay, centered on Poblacion, Malinao ----------
   Real PSA/NAMRIA boundaries (js/map-data.js, loaded as the map nears the viewport) drawn as a
   dot grid pinned to the map. The grid has continuous level of detail: zooming in spreads the
   dots apart and fades a finer grid in between them, so nothing pops. On top: borders,
   cartographic labels, story pins with routes, a radar lock-on for home, a cursor readout that
   names the barangay / town / province underneath, and live local time, sky and weather. */
(function(){
"use strict";
var card = document.querySelector(".map-card"), cv = document.getElementById("map");
if(!card || !cv || !cv.getContext || !window.Path2D) return;

var BASE = ((document.currentScript && document.currentScript.src) || "js/map.js").replace(/[^\/]*$/, "");
var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
var root = document.documentElement, ctx = cv.getContext("2d");
var LS = "letterSpacing" in ctx;
var q = function(s){ return card.querySelector(s); };
var el = { info:q(".map-info"), tag:q("#miTag"), dist:q("#miDist"), name:q("#miName"), coords:q("#miCoords"),
  desc:q("#miDesc"), places:q(".mi-places"), ctrl:q(".map-ctrl"), hint:q("#mapHint"), hud:q(".map-hud"),
  sky:q("#mapSky"), wx:q("#mapWx"), bar:q("#mapScale i"), barTxt:q("#mapScale span") };
var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

var TAU = Math.PI*2, RAD = Math.PI/180;
var HOME = [122.3076, 11.6442], COSL = Math.cos(HOME[1]*RAD);
var SPAN_MIN = 0.045, SPAN_MAX = 24;               // view width limits (world units ≈ degrees)

/* world space: equirectangular around home; x east, y south, 1 unit = 1° of latitude */
function wx(lon){ return (lon-HOME[0])*COSL; }
function wy(lat){ return HOME[1]-lat; }
function lonOf(x){ return HOME[0]+x/COSL; }
function latOf(y){ return HOME[1]-y; }

var PLACES = [
  { id:"home", ll:HOME, tag:"Home base", name:"Poblacion, Malinao, Aklan", short:"Malinao", sub:"Home",
    desc:"My hometown in northern Panay, about 10 km from campus." },
  { id:"campus", ll:[122.3777, 11.7032], tag:"Campus", name:"Aklan State University – Kalibo", short:"ASU Kalibo", sub:"Campus",
    desc:"Where I study BS Information Technology, majoring in Instructional System Technology." },
  { id:"iloilo", ll:[122.5621, 10.7202], tag:"Competitions", name:"Iloilo City", short:"Iloilo City", sub:"HackForGov 5 · RSC 2026",
    desc:"HackForGov 5 regional round with Team CyberGuild (Top 5, Oct 2026), and the Ready, Spark, Charge energy hackathon (May 2026)." }
];
var byId = {};
PLACES.forEach(function(p){ p.x = wx(p.ll[0]); p.y = wy(p.ll[1]); byId[p.id] = p; });

/* [text, lon, lat, kind, shown from span, to span] */
var STATIC = [
  ["West Philippine Sea",118.3,14.3,"sea",5,99], ["Philippine Sea",126.2,14.8,"sea",5,99], ["Sulu Sea",120.6,8.9,"sea",2.4,99],
  ["Sibuyan Sea",122.78,12.05,"sea",.6,9], ["Visayan Sea",123.55,11.45,"sea",.7,9], ["Panay Gulf",122.2,10.32,"sea",.6,6],
  ["Cuyo East Pass",121.45,11.1,"sea",.7,6], ["Tablas Strait",121.72,12.42,"sea",.7,6],
  ["Luzon",121.2,16.4,"isl",5,99], ["Mindanao",124.9,7.7,"isl",4,99], ["Palawan",118.7,9.7,"isl",4,99],
  ["Mindoro",121.05,12.95,"isl",2,99], ["Panay",122.45,11.12,"isl",3.2,99], ["Negros",123.0,10.0,"isl",1.6,99],
  ["Cebu",123.85,10.45,"isl",2.2,99], ["Bohol",124.2,9.85,"isl",4,99], ["Leyte",124.85,10.95,"isl",4,99],
  ["Samar",125.05,11.9,"isl",4,99], ["Masbate",123.6,12.2,"isl",1.6,99], ["Tablas",122.04,12.42,"isl",.7,4.5],
  ["Sibuyan",122.57,12.42,"isl",.7,4.5],
  ["Manila",120.984,14.599,"city",3,99], ["Cebu City",123.885,10.316,"city",1.4,12], ["Bacolod",122.951,10.676,"city",.7,7],
  ["Roxas City",122.751,11.585,"city",.45,5], ["San Jose de Buenavista",121.941,10.744,"city",.45,4.5],
  ["Boracay",121.925,11.965,"city",.12,2.4]
].map(function(s){ return { n:s[0], x:wx(s[1]), y:wy(s[2]), t:s[3], lo:s[4], hi:s[5] }; });
var WATER = STATIC.filter(function(s){ return s.t==="sea"; });
var PROV_AT = { Aklan:[122.36, 11.42] };              // keep AKLAN clear of the home marker

/* ---------- small helpers ---------- */
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function smooth(e0,e1,v){ var t = clamp((v-e0)/(e1-e0),0,1); return t*t*(3-2*t); }
function ease(t){ return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
function band(span,lo,hi){ return (lo>0 ? smooth(lo*.7,lo,span) : 1) * smooth(hi*1.4,hi,span); }
function km(a,b){
  var p1=a[1]*RAD, p2=b[1]*RAD, dp=p2-p1, dl=(b[0]-a[0])*RAD;
  var h = Math.sin(dp/2)*Math.sin(dp/2) + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2);
  return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
}
function fmtKm(d){ return d<1 ? Math.round(d*1000)+" m" : d<10 ? d.toFixed(1)+" km" : Math.round(d)+" km"; }
function fmtLL(ll,dp){ return Math.abs(ll[1]).toFixed(dp)+"° "+(ll[1]>=0?"N":"S")+", "+ll[0].toFixed(dp)+"° E"; }
function hash(a,b){ var h = (Math.imul(a,374761393) + Math.imul(b,668265263))|0; h = Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; }
function overlaps(r,list){ for(var i=0;i<list.length;i++){ var o=list[i]; if(r[0]<o[2] && r[2]>o[0] && r[1]<o[3] && r[3]>o[1]) return true; } return false; }

/* ---------- colors / fonts (re-read on theme change) ---------- */
var col = {}, RGB = {};
function parse(c){
  c = (c||"").trim();
  if(c[0]==="#"){ var n=c.slice(1); if(n.length===3) n=n.replace(/./g,"$&$&"); var v=parseInt(n.slice(0,6),16); return [v>>16&255, v>>8&255, v&255]; }
  var m = c.match(/[\d.]+/g); return m ? [+m[0],+m[1],+m[2]] : [128,128,128];
}
function rgba(k,a){ var v=RGB[k]; return "rgba("+v[0]+","+v[1]+","+v[2]+","+(a<0?0:a>1?1:a).toFixed(3)+")"; }
function colors(){
  var cs = getComputedStyle(card), rs = getComputedStyle(root);
  col.acc = cs.getPropertyValue("--map-acc").trim() || rs.getPropertyValue("--accent").trim();
  col.fg = rs.getPropertyValue("--fg").trim(); col.muted = rs.getPropertyValue("--muted").trim();
  col.bg = rs.getPropertyValue("--bg-2").trim();
  col.mono = rs.getPropertyValue("--f-mono").trim() || "monospace";
  col.sans = getComputedStyle(document.body).fontFamily;
  RGB = { acc:parse(col.acc), fg:parse(col.fg), muted:parse(col.muted), bg:parse(col.bg) };
  widths = {};
}

/* ---------- geometry ---------- */
var geo = null;
function dec(s,Q){
  var out = []; if(!s) return out;
  var rings = s.split(";");
  for(var r=0;r<rings.length;r++){
    var pts = rings[r].split(" "), a = new Float64Array(pts.length*2), x=0, y=0;
    for(var i=0;i<pts.length;i++){ var p=pts[i], c=p.indexOf(","); x += +p.slice(0,c); y += +p.slice(c+1); a[2*i]=wx(x/Q); a[2*i+1]=wy(y/Q); }
    out.push(a);
  }
  return out;
}
function toPath(rings,close){
  var p = new Path2D();
  for(var r=0;r<rings.length;r++){ var a=rings[r]; p.moveTo(a[0],a[1]); for(var i=2;i<a.length;i+=2) p.lineTo(a[i],a[i+1]); if(close) p.closePath(); }
  return p;
}
function bounds(rings){
  var b=[1e9,1e9,-1e9,-1e9];
  rings.forEach(function(a){ for(var i=0;i<a.length;i+=2){ if(a[i]<b[0])b[0]=a[i]; if(a[i]>b[2])b[2]=a[i]; if(a[i+1]<b[1])b[1]=a[i+1]; if(a[i+1]>b[3])b[3]=a[i+1]; } });
  return b;
}
function inside(rings,x,y){
  var c=false;
  for(var r=0;r<rings.length;r++){ var a=rings[r], n=a.length;
    for(var i=0,j=n-2;i<n;j=i,i+=2){ var yi=a[i+1], yj=a[j+1]; if((yi>y)!==(yj>y) && x < (a[j]-a[i])*(y-yi)/(yj-yi)+a[i]) c=!c; } }
  return c;
}
function initGeo(d){
  var Q = d.q, L = function(k,close){ var r=dec(d[k],Q); return { p:toPath(r,close), b:bounds(r) }; };
  geo = { land:L("land",1), aklan:L("aklan",1), malinao:L("malinao",1), pob:L("pob",1),
    provB:L("provB"), munB:L("munB"), bgyB:L("bgyB"),
    hit: d.hit.map(function(h){ var r=dec(h.r,Q); return { n:h.n, inn:h["in"], t:h.t, r:r, b:bounds(r) }; }),
    lbl: d.lbl.map(function(l){ var at = l.t==="prov" && PROV_AT[l.n] || l.p; return { n:l.n, t:l.t, x:wx(at[0]), y:wy(at[1]) }; }) };
}
function placeName(x,y){
  if(!geo) return "";
  for(var i=0;i<geo.hit.length;i++){
    var h=geo.hit[i], b=h.b;
    if(x<b[0] || x>b[2] || y<b[1] || y>b[3] || !inside(h.r,x,y)) continue;
    return h.t==="bgy" ? h.n+", Malinao" : h.t==="mun" ? h.n+", Aklan" : h.t==="prov" ? h.n+" province" : h.n;
  }
  var best=null, bd=9;
  WATER.forEach(function(s){ var d=(s.x-x)*(s.x-x)+(s.y-y)*(s.y-y); if(d<bd){ bd=d; best=s.n; } });
  return best || "Open sea";
}

/* ---------- camera ---------- */
var W=0, H=0, dpr=1, S0=7.5, R0b=1.35;
var cam = { x:0, y:0, z:400 }, anim=null, vel=null;
function zLim(z){ return Math.max(W/SPAN_MAX, Math.min(W/SPAN_MIN, z)); }
function clampCam(){ cam.z=zLim(cam.z); cam.x=clamp(cam.x, wx(115.5), wx(128)); cam.y=clamp(cam.y, wy(21.5), wy(4)); }
function sx(x){ return W/2+(x-cam.x)*cam.z; }
function sy(y){ return H/2+(y-cam.y)*cam.z; }
function ix(px){ return cam.x+(px-W/2)/cam.z; }
function iy(py){ return cam.y+(py-H/2)/cam.z; }

/* van Wijk & Nuij smooth zoom-and-pan (same model as d3.interpolateZoom), rho = sqrt 2 */
function vanWijk(p0,p1){
  var ux0=p0[0], uy0=p0[1], w0=p0[2], ux1=p1[0], uy1=p1[1], w1=p1[2], dx=ux1-ux0, dy=uy1-uy0, d2=dx*dx+dy*dy, S, f, R=Math.SQRT2;
  if(d2 < 1e-12){ S=Math.log(w1/w0)/R; f=function(t){ return [ux0+t*dx, uy0+t*dy, w0*Math.exp(R*t*S)]; }; }
  else {
    var d1=Math.sqrt(d2), b0=(w1*w1-w0*w0+4*d2)/(4*w0*d1), b1=(w1*w1-w0*w0-4*d2)/(4*w1*d1),
        r0=Math.log(Math.sqrt(b0*b0+1)-b0), r1=Math.log(Math.sqrt(b1*b1+1)-b1);
    S=(r1-r0)/R;
    f=function(t){ var s=t*S, c0=Math.cosh(r0), u=w0/(2*d1)*(c0*Math.tanh(R*s+r0)-Math.sinh(r0)); return [ux0+u*dx, uy0+u*dy, w0*c0/Math.cosh(R*s+r0)]; };
  }
  f.S = Math.abs(S); return f;
}
function flyTo(v,d,done,linear){
  vel = null;
  if(RM){ cam.x=v.x; cam.y=v.y; cam.z=v.z; clampCam(); anim=null; if(done) done(performance.now()); settled(); kick(); return; }
  var I = linear ? (function(a,b){ return function(t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]*Math.pow(b[2]/a[2],t)]; }; })([cam.x,cam.y,W/cam.z],[v.x,v.y,W/v.z])
                 : vanWijk([cam.x,cam.y,W/cam.z],[v.x,v.y,W/v.z]);
  anim = { k:"fly", I:I, t0:null, d:d || clamp((I.S||0)*850, 550, 2600), done:done };
  kick();
}
function viewCenter(){
  var best=null, ba=0;
  freeRects().forEach(function(r){ var a=(r[2]-r[0])*(r[3]-r[1]); if(r[2]>r[0] && r[3]>r[1] && a>ba){ ba=a; best=r; } });
  return best ? [(best[0]+best[2])/2, (best[1]+best[3])/2] : [W/2, H/2];
}
function zoomBy(f,ax,ay,animate){
  if(ax==null){ var c=viewCenter(); ax=c[0]; ay=c[1]; }
  var z1=zLim(cam.z*f), px=ix(ax), py=iy(ay);
  if(!animate || RM){ cam.z=z1; cam.x=px-(ax-W/2)/z1; cam.y=py-(ay-H/2)/z1; clampCam(); settled(); kick(); return; }
  anim = { k:"zoom", z0:cam.z, z1:z1, ax:ax, ay:ay, px:px, py:py, t0:null, d:380 };
  kick();
}
function step(now){
  if(anim){
    if(anim.t0===null) anim.t0=now;
    var t=clamp((now-anim.t0)/anim.d,0,1), e=ease(t);
    if(anim.k==="fly"){ var p=anim.I(e); cam.x=p[0]; cam.y=p[1]; cam.z=W/p[2]; }
    else { cam.z=anim.z0*Math.pow(anim.z1/anim.z0,e); cam.x=anim.px-(anim.ax-W/2)/cam.z; cam.y=anim.py-(anim.ay-H/2)/cam.z; }
    anim.e = e;
    if(t>=1){ var done=anim.done; anim=null; if(done) done(now); settled(); }
  } else if(vel){
    var dt=Math.min(50, now-vel.t); vel.t=now;
    cam.x-=vel.x*dt/cam.z; cam.y-=vel.y*dt/cam.z;
    var k=Math.exp(-dt/260); vel.x*=k; vel.y*=k;
    if(Math.abs(vel.x)+Math.abs(vel.y) < .01){ vel=null; settled(); }
  }
  clampCam();
}

/* ---------- overlay layout: the map avoids what the HTML panels cover ---------- */
var R = { info:[0,0,0,0], ctrl:[0,0,0,0], hud:[], hudTop:0 };
function rel(e){ var x=0, y=0, n=e; while(n && n!==card){ x+=n.offsetLeft; y+=n.offsetTop; n=n.offsetParent; } return [x, y, x+e.offsetWidth, y+e.offsetHeight]; }
function measure(){
  R.info = rel(el.info); R.ctrl = rel(el.ctrl);
  R.hud = [].slice.call(el.hud.children).filter(function(e){ return e.offsetWidth>0; }).map(rel);
  R.hudTop = R.hud.reduce(function(m,r){ return Math.min(m,r[1]); }, H);
}
function freeRects(){
  var i=R.info, c=R.ctrl, bot=R.hudTop-8;
  return [ [10, i[3]+8, c[3]>i[3]+8 ? c[0]-8 : W-10, bot],      // below the info card
           [i[2]+8, 10, c[1]<bot ? c[0]-8 : W-10, bot] ];        // beside it
}
function fitView(lls,pad){
  var xs=lls.map(function(l){ return wx(l[0]); }), ys=lls.map(function(l){ return wy(l[1]); });
  var x0=Math.min.apply(0,xs), x1=Math.max.apply(0,xs), y0=Math.min.apply(0,ys), y1=Math.max.apply(0,ys), best=null;
  freeRects().forEach(function(r){
    var fw=r[2]-r[0]-2*pad, fh=r[3]-r[1]-2*pad; if(fw<60 || fh<60) return;
    var z=Math.min(fw/Math.max(x1-x0,1e-4), fh/Math.max(y1-y0,1e-4)); if(!best || z>best.z) best={z:z, r:r};
  });
  if(!best) best = { z:Math.min(W/Math.max(x1-x0,1e-4), H/Math.max(y1-y0,1e-4))*.8, r:[0,0,W,H] };
  var z=zLim(best.z), r=best.r, cx=(r[0]+r[2])/2, cy=(r[1]+r[3])/2;
  return { x:(x0+x1)/2-(cx-W/2)/z, y:(y0+y1)/2-(cy-H/2)/z, z:z };
}
function viewOf(id){
  if(id==="all") return fitView([[117.2,5.2],[126.4,19.2]], 4);
  if(id==="home") return fitView([[HOME[0]-.45, HOME[1]-.36],[HOME[0]+.45, HOME[1]+.36]], 0);
  return fitView([HOME, byId[id].ll], id==="campus" ? 64 : 46);
}

/* ---------- dot grid with continuous level of detail ----------
   Coarse grid spacing g (world) is the power of two that puts g·z in [S0, 2·S0) screen px. We
   sample the fine grid (g/2): points with both indices even are the coarse grid and draw at
   full weight, the rest fade in as the coarse spacing approaches 2·S0. At the switch the fine
   grid becomes the new coarse grid, so zooming never pops. Coverage per point comes from
   rasterizing each layer into a tiny canvas with one pixel per grid point. */
var mk = document.createElement("canvas"), mctx = mk.getContext("2d", { willReadFrequently:true });
var grid = null, gridKey = "";
function sample(){
  var key = cam.x.toFixed(7)+","+cam.y.toFixed(7)+","+cam.z.toFixed(4)+","+W+","+H;
  if(key===gridKey) return; gridKey = key;
  var z=cam.z, s0=S0*(.7+.3*smooth(9,2.5,W/z)), g=Math.pow(2, Math.ceil(Math.log2(s0/z)-1e-9)), u=Math.log2(g*z/s0), gf=g/2;
  var i0=Math.floor((cam.x-W/2/z)/gf)-1, i1=Math.ceil((cam.x+W/2/z)/gf)+1;
  var j0=Math.floor((cam.y-H/2/z)/gf)-1, j1=Math.ceil((cam.y+H/2/z)/gf)+1;
  var nx=i1-i0+1, ny=j1-j0+1;
  if(mk.width!==nx || mk.height!==ny){ mk.width=nx; mk.height=ny; }
  var vb=[cam.x-W/2/z, cam.y-H/2/z, cam.x+W/2/z, cam.y+H/2/z];
  function layer(L){
    var b=L.b; if(b[2]<vb[0] || b[0]>vb[2] || b[3]<vb[1] || b[1]>vb[3]) return null;
    mctx.setTransform(1,0,0,1,0,0); mctx.clearRect(0,0,nx,ny);
    mctx.setTransform(1/gf,0,0,1/gf,-i0+.5,-j0+.5); mctx.fillStyle="#fff"; mctx.fill(L.p,"evenodd");
    var d=mctx.getImageData(0,0,nx,ny).data, a=new Uint8Array(nx*ny);
    for(var k=0;k<a.length;k++) a[k]=d[k*4+3];
    return a;
  }
  grid = { i0:i0, j0:j0, nx:nx, ny:ny, gf:gf, fw:smooth(0,1,u), land:layer(geo.land), ak:layer(geo.aklan), ml:layer(geo.malinao),
           pb: W/z < 1.2 ? layer(geo.pob) : null };
}
var BK=12, buckets=[]; for(var b=0;b<BK*3;b++) buckets.push([]);
var BASEA=[.46,.7,.95,1];                // land, Aklan, Malinao, Poblacion
function drawDots(now){
  var G=grid; if(!G || !G.land) return;
  var z=cam.z, gz=G.gf*z, ox=W/2-cam.x*z, oy=H/2-cam.y*z, fw=G.fw;
  var hx=sx(0), hy=sy(0), hov=mx>=0 && !drag, RH=86, RH2=RH*RH, R0=R0b*(.8+.2*smooth(9,2.5,W/z));
  var waveR=-1e4, waveA=0, rev=1e9;
  if(!RM && phase==="idle" && arriveT>0){ var wt=((now-arriveT)/1000)%6; waveR=wt*170; waveA=Math.max(0,1-wt/4.2); }
  if(!RM && phase==="scan") rev=(now-tScan)*1.1;
  var land=G.land, ak=G.ak, ml=G.ml, pb=G.pb, i, j, b;
  for(b=0;b<buckets.length;b++) buckets[b].length=0;
  for(j=0;j<G.ny;j++){
    var gj=G.j0+j, y=oy+gj*gz; if(y<-3 || y>H+3) continue;
    var row=j*G.nx, oddJ=gj&1;
    for(i=0;i<G.nx;i++){
      var k=row+i, c=land[k]; if(c<18) continue;
      var gi=G.i0+i, w=(oddJ|(gi&1)) ? fw : 1; if(w<.04) continue;
      var x=ox+gi*gz; if(x<-3 || x>W+3) continue;
      var cov=c/255, cls = pb && pb[k]>127 ? 3 : ml && ml[k]>127 ? 2 : ak && ak[k]>127 ? 1 : 0;
      var a=BASEA[cls]*Math.min(1,cov*1.7)*w, r=R0*(.55+.45*Math.min(1,cov*1.5))*(.3+.7*w)*(cls===3?1.3:1), e=0;
      if(hov){ var dx=x-mx, dy=y-my, d2=dx*dx+dy*dy; if(d2<RH2){ var hv=1-Math.sqrt(d2)/RH; hv*=hv; e=hv; a+=hv*.6; r+=hv*1.2; } }
      if(waveA>0){ var ex=x-hx, ey=y-hy, dd=Math.sqrt(ex*ex+ey*ey)-waveR; if(dd>-60 && dd<60){ var wv=Math.exp(-dd*dd/600)*waveA; a+=wv*.45; r+=wv*.6; if(wv>e) e=wv; } }
      if(!RM){ a+=Math.sin(now*.0018+hash(Math.round(gi*G.gf*4096),Math.round(gj*G.gf*4096))*40)*.06*w; }
      if(rev<1e9){ var rx=x-W/2, ry=y-H/2, ap=clamp((rev-Math.sqrt(rx*rx+ry*ry))/90,0,1); a*=ap; r*=.4+.6*ap; }
      if(a<=.012) continue;
      var ci = cls>=2 || e>.4 ? 2 : cls===1 ? 1 : 0;
      buckets[ci*BK+Math.min(BK-1,(a*BK)|0)].push(x,y,r);
    }
  }
  var fills=[col.muted, col.fg, col.acc];
  for(b=0;b<buckets.length;b++){
    var P=buckets[b]; if(!P.length) continue;
    ctx.globalAlpha=((b%BK)+.5)/BK; ctx.fillStyle=fills[(b/BK)|0]; ctx.beginPath();
    for(var n=0;n<P.length;n+=3){ ctx.moveTo(P[n]+P[n+2],P[n+1]); ctx.arc(P[n],P[n+1],P[n+2],0,TAU); }
    ctx.fill();
  }
  ctx.globalAlpha=1;
}

/* ---------- vector layers (drawn in world space) ---------- */
function worldTx(){ ctx.setTransform(dpr*cam.z,0,0,dpr*cam.z,dpr*(W/2-cam.x*cam.z),dpr*(H/2-cam.y*cam.z)); }
function screenTx(){ ctx.setTransform(dpr,0,0,dpr,0,0); }
function line(p,stroke,px,dash){ var z=cam.z; ctx.strokeStyle=stroke; ctx.lineWidth=px/z; ctx.setLineDash(dash ? [dash[0]/z,dash[1]/z] : []); ctx.stroke(p); }
function drawBorders(span){
  var a; worldTx(); ctx.lineJoin="round";
  if((a=smooth(7,3.5,span))>0) line(geo.provB.p, rgba("fg",.2*a), 1, [3,3]);
  if((a=smooth(2.4,1.3,span))>0) line(geo.munB.p, rgba("fg",.14*a), .8, [2,3]);
  if((a=smooth(.6,.35,span))>0) line(geo.bgyB.p, rgba("acc",.4*a), .8, [2,2.5]);
  if((a=smooth(9,4,span))>0) line(geo.aklan.p, rgba("acc",.3*a), 1);
  ctx.fillStyle=rgba("acc",.06); ctx.fill(geo.malinao.p,"evenodd");
  line(geo.malinao.p, rgba("acc",.85*smooth(12,6,span)), 1.3);
  if((a=smooth(1.2,.5,span))>0){ ctx.fillStyle=rgba("acc",.14*a); ctx.fill(geo.pob.p); line(geo.pob.p, rgba("acc",.9*a), 1.2); }
  ctx.setLineDash([]); screenTx();
}
var GSTEPS=[10,5,2,1,.5,.25,.1,.05,.02,.01];
function drawGraticule(placed){
  var z=cam.z, st=GSTEPS[0], n;
  for(n=0;n<GSTEPS.length;n++){ if(GSTEPS[n]*z*COSL>=120) st=GSTEPS[n]; else break; }
  var lo0=lonOf(ix(0)), lo1=lonOf(ix(W)), la0=latOf(iy(H)), la1=latOf(iy(0)), dp=st>=1?0:(st*10)%1===0?1:2, xs=[], ys=[];
  ctx.strokeStyle=rgba("fg",.06); ctx.lineWidth=1; ctx.setLineDash([2,4]); ctx.beginPath();
  for(n=Math.ceil(lo0/st); n*st<=lo1; n++){ var x=Math.round(sx(wx(n*st)))+.5; xs.push([x,n*st]); ctx.moveTo(x,0); ctx.lineTo(x,H); }
  for(n=Math.ceil(la0/st); n*st<=la1; n++){ var y=Math.round(sy(wy(n*st)))+.5; ys.push([y,n*st]); ctx.moveTo(0,y); ctx.lineTo(W,y); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.font="500 9.5px "+col.mono; ctx.fillStyle=rgba("muted",.55); ctx.textBaseline="middle";
  ctx.textAlign="center";
  xs.forEach(function(v){ var s=v[1].toFixed(dp)+"°E", w=ctx.measureText(s).width, r=[v[0]-w/2-3,4,v[0]+w/2+3,18]; if(!overlaps(r,placed)){ ctx.fillText(s,v[0],11); placed.push(r); } });
  ctx.textAlign="left";
  ys.forEach(function(v){ var s=Math.abs(v[1]).toFixed(dp)+"°"+(v[1]>=0?"N":"S"), w=ctx.measureText(s).width, r=[4,v[0]-12,w+12,v[0]-1]; if(!overlaps(r,placed)){ ctx.fillText(s,7,v[0]-6); placed.push(r); } });
  ctx.textBaseline="alphabetic";
}

/* ---------- labels ---------- */
var widths = {};
function tw(font,s,ls){ var k=font+"|"+ls+"|"+s, v=widths[k]; if(v==null){ ctx.font=font; v=widths[k]=ctx.measureText(s).width+ls*(s.length-1); } return v; }
function text(s,x,y,font,ls,fill,align,halo){
  ctx.font=font; ctx.textAlign="left"; ctx.textBaseline="middle";
  var w=tw(font,s,ls), x0 = align==="center" ? x-w/2 : align==="right" ? x-w : x;
  if(halo){ ctx.lineWidth=3; ctx.lineJoin="round"; ctx.strokeStyle=halo; }
  ctx.fillStyle=fill;
  if(!ls || LS){
    if(LS) ctx.letterSpacing=(ls||0)+"px";
    if(halo) ctx.strokeText(s,x0,y); ctx.fillText(s,x0,y);
    if(LS) ctx.letterSpacing="0px";
  } else {
    for(var i=0;i<s.length;i++){ var ch=s[i]; if(halo) ctx.strokeText(ch,x0,y); ctx.fillText(ch,x0,y); x0+=ctx.measureText(ch).width+ls; }
  }
  ctx.textBaseline="alphabetic";
}
function drawLabels(span,placed){
  var L=[], halo=rgba("bg",.75);
  STATIC.forEach(function(s){ var a=band(span,s.lo,s.hi); if(a>.02) L.push({ s:s, a:a, pr:s.t==="city"?2:s.t==="isl"?4:6 }); });
  geo.lbl.forEach(function(l){
    var a = l.t==="prov" ? band(span,.9,6.5) : l.t==="mun" ? band(span,.07,l.n==="Malinao"?2.6:1.5) : band(span,0,.3);
    if(a>.02) L.push({ s:l, a:a, pr: l.n==="Malinao"?0 : l.t==="prov"?3 : l.t==="mun"?(l.n==="Kalibo"?4:5) : l.n==="Poblacion"?1:7 });
  });
  L.sort(function(a,b){ return a.pr-b.pr; });
  L.forEach(function(it){
    var s=it.s, a=it.a, x=sx(s.x), y=sy(s.y); if(x<-120 || x>W+120 || y<-20 || y>H+20) return;
    var t=s.t, font, ls=0, fill, txt=s.n, align="center", dot=false;
    if(t==="sea"){ font="italic 500 10px "+col.sans; ls=2; txt=txt.toUpperCase(); fill=rgba("muted",.6*a); }
    else if(t==="isl"){ font="600 10px "+col.mono; ls=3; txt=txt.toUpperCase(); fill=rgba("fg",.42*a); }
    else if(t==="prov"){ font="500 10px "+col.mono; ls=2.6; txt=txt.toUpperCase(); fill = s.n==="Aklan" ? rgba("acc",.9*a) : rgba("muted",.75*a); }
    else if(t==="city"){ font="500 11px "+col.sans; fill=rgba("fg",.78*a); align="left"; dot=true; }
    else if(t==="mun"){ font=(s.n==="Malinao"?"700 12px ":s.n==="Kalibo"?"600 11.5px ":"500 11px ")+col.sans; fill = s.n==="Malinao" ? rgba("acc",a) : rgba("fg",.66*a); }
    else { font=(s.n==="Poblacion"?"700 ":"400 ")+"10px "+col.sans; fill = s.n==="Poblacion" ? rgba("fg",.95*a) : rgba("muted",.85*a); }
    var w=tw(font,txt,ls), lx = dot ? x+7 : x, x0 = align==="center" ? lx-w/2 : lx;
    var r=[x0-4, y-8, x0+w+4, y+8]; if(dot) r[0]=x-5;
    if(overlaps(r,placed)) return;
    placed.push(r);
    if(dot){ ctx.fillStyle=rgba("fg",.7*a); ctx.beginPath(); ctx.arc(x,y,2,0,TAU); ctx.fill(); }
    text(txt,lx,y,font,ls,fill,align,halo);
  });
}

/* ---------- routes, pins, home marker ---------- */
function ctrlPt(h,p){ return [(h[0]+p[0])/2+(p[1]-h[1])*.22, (h[1]+p[1])/2-(p[0]-h[0])*.22]; }
function bez(a,c,b,u){ var v=1-u; return [v*v*a[0]+2*v*u*c[0]+u*u*b[0], v*v*a[1]+2*v*u*c[1]+u*u*b[1]]; }
function routeProgress(now){ return phase!=="idle" ? 0 : RM || arriveT<0 ? 1 : clamp((now-arriveT-350)/1100,0,1); }
function drawRoutes(now){
  var pr=routeProgress(now); if(pr<=0) return;
  var h=[sx(0),sy(0)];
  PLACES.forEach(function(p){
    if(p.id==="home") return;
    var b=[sx(p.x),sy(p.y)], c=ctrlPt(h,b), sel=selected===p.id, len=Math.hypot(b[0]-h[0],b[1]-h[1]); if(len<8) return;
    ctx.save(); ctx.strokeStyle = sel ? rgba("acc",.9) : rgba("fg",.3); ctx.lineWidth = sel ? 1.6 : 1.1;
    ctx.setLineDash(sel ? [5,5] : [3,5]); ctx.lineDashOffset = RM ? 0 : -now*.02;
    ctx.beginPath(); var N=56, M=Math.round(N*pr);
    for(var s=0;s<=M;s++){ var pt=bez(h,c,b,s/N); s ? ctx.lineTo(pt[0],pt[1]) : ctx.moveTo(pt[0],pt[1]); }
    ctx.stroke(); ctx.restore();
    if(!sel || pr<1) return;
    if(!RM){
      ctx.fillStyle=col.acc; ctx.shadowColor=col.acc; ctx.shadowBlur=10;
      for(var k=0;k<3;k++){ var pt2=bez(h,c,b,(now*.00028+k/3)%1); ctx.beginPath(); ctx.arc(pt2[0],pt2[1],2.2,0,TAU); ctx.fill(); }
      ctx.shadowBlur=0;
    }
    if(len>120){
      var m=bez(h,c,b,.5), s2=fmtKm(km(HOME,p.ll)), f="500 10px "+col.mono, w=tw(f,s2,0)+14;
      pill(m[0]-w/2, m[1]-10, w, 20, rgba("bg",.9), rgba("acc",.45)); text(s2,m[0],m[1]+.5,f,0,col.fg,"center");
    }
  });
}
function pill(x,y,w,h,fill,stroke){ ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x+.5,y+.5,w,h,6); else ctx.rect(x+.5,y+.5,w,h); ctx.fill(); ctx.stroke(); }
var F_POI, F_SUB;
function poiGeom(p){
  var x=sx(p.x), y=sy(p.y), w=Math.max(tw(F_POI,p.short,0), tw(F_SUB,p.sub,0)), right = x+16+w < W-10;
  var lx = right ? x+16 : x-16-w;
  return { x:x, y:y, lx:lx, w:w, rect:[Math.min(x-12,lx-4), y-17, Math.max(x+12,lx+w+4), y+17] };
}
function drawPOI(p,g,now){
  var sel=selected===p.id, hv=hoverId===p.id, c = sel ? col.acc : col.fg, x=g.x, y=g.y, s=hv?1.15:1;
  if(sel && !RM){ var ph=(now/1400)%1; ctx.strokeStyle=rgba("acc",(1-ph)*.6); ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(x,y,7+ph*18,0,TAU); ctx.stroke(); }
  ctx.fillStyle=rgba("bg",.85); ctx.beginPath(); ctx.arc(x,y,11*s,0,TAU); ctx.fill();
  ctx.strokeStyle=c; ctx.fillStyle=c; ctx.lineWidth=1.4;
  if(p.id==="campus"){
    var L=7*s, l=3.5*s; ctx.beginPath();
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(d){ var cx=x+d[0]*L, cy=y+d[1]*L; ctx.moveTo(cx-d[0]*l,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy-d[1]*l); });
    ctx.stroke(); ctx.fillRect(x-2.5*s,y-2.5*s,5*s,5*s);
  } else {
    var D=7.5*s; ctx.beginPath(); ctx.moveTo(x,y-D); ctx.lineTo(x+D,y); ctx.lineTo(x,y+D); ctx.lineTo(x-D,y); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x,y,2.4*s,0,TAU); ctx.fill();
  }
  var halo=rgba("bg",.8);
  text(p.short, g.lx, y-6, F_POI, 0, sel?col.fg:rgba("fg",.92), "left", halo);
  text(p.sub, g.lx, y+8, F_SUB, 0, sel?rgba("acc",.95):rgba("muted",.95), "left", halo);
  hits.push({ id:p.id, x:x, y:y, r:16, rect:[g.lx-2, y-14, g.lx+g.w+2, y+14] });
}
var RH1=10, RH2=23, RH3=38;
/* callout for home: first quadrant that clears the panels, pins and labels already placed */
function homeTag(X,Y,placed){
  var t1="MALINAO", t2="HOME BASE", f1="600 11px "+col.mono, f2="400 9.5px "+col.mono;
  var bw=Math.max(tw(f1,t1,0),tw(f2,t2,0))+20, bh=36, d=RH3*.72, opts=[[1,-1],[-1,-1],[1,1],[-1,1]];
  for(var i=0;i<opts.length;i++){
    var side=opts[i][0], v=opts[i][1], ex=X+side*d, ey=Y+v*d, hx=ex+side*22, bx = side>0 ? hx+5 : hx-5-bw, by=ey-bh/2;
    var rect=[bx-2,by-2,bx+bw+2,by+bh+2];
    if(bx<6 || bx+bw>W-6 || by<6 || by+bh>R.hudTop-4 || overlaps(rect,placed)) continue;
    return { t1:t1, t2:t2, f1:f1, f2:f2, bw:bw, bh:bh, side:side, v:v, ex:ex, ey:ey, hx:hx, bx:bx, by:by, rect:rect };
  }
  return null;
}
function drawHome(now,g){
  var X=sx(0), Y=sy(0); if(X<-90 || X>W+90 || Y<-90 || Y>H+90) return;
  var t=now/1000, sp=RM?0:t, lock = phase!=="idle" ? 0 : RM || arriveT<0 ? 1 : clamp((now-arriveT)/700,0,1), le=ease(lock);
  var bg=ctx.createRadialGradient(X,Y,0,X,Y,RH3+8); bg.addColorStop(0,rgba("bg",.45)); bg.addColorStop(.75,rgba("bg",.2)); bg.addColorStop(1,rgba("bg",0));
  ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(X,Y,RH3+8,0,TAU); ctx.fill();
  if(!RM && ctx.createConicGradient){
    var ang=(sp*1.1)%TAU, cg=ctx.createConicGradient(ang,X,Y);
    cg.addColorStop(0,rgba("acc",0)); cg.addColorStop(.78,rgba("acc",0)); cg.addColorStop(.995,rgba("acc",.28)); cg.addColorStop(1,rgba("acc",0));
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(X,Y,RH3,0,TAU); ctx.fill();
    ctx.strokeStyle=rgba("acc",.6); ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(X,Y); ctx.lineTo(X+Math.cos(ang)*RH3, Y+Math.sin(ang)*RH3); ctx.stroke();
  }
  ctx.lineWidth=1;
  ctx.strokeStyle=rgba("acc",.4); ctx.beginPath(); ctx.arc(X,Y,RH1,0,TAU); ctx.stroke();
  ctx.setLineDash([3,4]); ctx.strokeStyle=rgba("acc",.3); ctx.beginPath(); ctx.arc(X,Y,RH2,0,TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle=rgba("acc",.24); ctx.beginPath(); ctx.arc(X,Y,RH3,0,TAU); ctx.stroke();
  ctx.save(); ctx.translate(X,Y); ctx.rotate(-sp*.05);
  for(var i=0;i<48;i++){ var maj=i%6===0, c=Math.cos(i*TAU/48), s=Math.sin(i*TAU/48), l=maj?6:3;
    ctx.strokeStyle=rgba("acc",maj?.7:.28); ctx.lineWidth=maj?1.3:1; ctx.beginPath(); ctx.moveTo(c*RH3,s*RH3); ctx.lineTo(c*(RH3+l),s*(RH3+l)); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.translate(X,Y); ctx.rotate(sp*.6); ctx.strokeStyle=rgba("acc",.85); ctx.lineWidth=1.7; ctx.lineCap="round";
  for(var k=0;k<3;k++){ ctx.beginPath(); ctx.arc(0,0,RH2,k*TAU/3+.2,k*TAU/3+.95); ctx.stroke(); }
  ctx.restore();
  var pulse=RM?.5:(t*.5)%1;
  for(var j=0;j<2;j++){ var ph=(pulse+j*.5)%1; ctx.strokeStyle=rgba("acc",(1-ph)*.55); ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(X,Y,7+ph*(RH3-7),0,TAU); ctx.stroke(); }
  if(le>0){
    var L=(10+(RM?0:Math.sin(t*2.2)*1.3))+(1-le)*34, l2=4.5;
    ctx.strokeStyle=rgba("fg",.85*le); ctx.lineWidth=1.4; ctx.lineCap="square"; ctx.beginPath();
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(d){ var cx=X+d[0]*L, cy=Y+d[1]*L; ctx.moveTo(cx-d[0]*l2,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy-d[1]*l2); });
    ctx.stroke(); ctx.lineCap="butt";
  }
  ctx.strokeStyle=rgba("acc",.9); ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(X,Y,7,0,TAU); ctx.stroke();
  ctx.fillStyle=col.acc; ctx.shadowColor=col.acc; ctx.shadowBlur=14; ctx.beginPath(); ctx.arc(X,Y,4,0,TAU); ctx.fill(); ctx.shadowBlur=0;
  ctx.fillStyle=col.fg; ctx.beginPath(); ctx.arc(X,Y,1.5,0,TAU); ctx.fill();
  hits.push({ id:"home", x:X, y:Y, r:16 });
  if(le<=0 || !g) return;
  ctx.globalAlpha=le;
  ctx.strokeStyle=rgba("acc",.7); ctx.fillStyle=col.acc; ctx.lineWidth=1; ctx.beginPath();
  ctx.moveTo(X+g.side*9,Y+g.v*9); ctx.lineTo(g.ex,g.ey); ctx.lineTo(g.hx,g.ey); ctx.stroke();
  ctx.beginPath(); ctx.arc(g.hx,g.ey,2,0,TAU); ctx.fill();
  pill(g.bx,g.by,g.bw,g.bh,rgba("bg",.9),rgba("acc",.45));
  ctx.fillStyle=col.acc; ctx.fillRect(g.bx+.5,g.by+8,2,g.bh-16);
  text(g.t1,g.bx+11,g.by+13,g.f1,0,col.fg,"left");
  text(g.t2,g.bx+11,g.by+25,g.f2,0,col.muted,"left");
  ctx.globalAlpha=1;
  hits.push({ id:"home", rect:g.rect });
}
/* places outside the view get an edge marker that points at them */
function drawOffscreen(){
  if(phase!=="idle") return;
  var top=14, bot=R.hudTop-10, left=12, right=W-12, cx=W/2, cy=(top+bot)/2, done=[];
  PLACES.forEach(function(p){
    var x=sx(p.x), y=sy(p.y), under=[R.info,R.ctrl].some(function(r){ return x>=r[0] && x<=r[2] && y>=r[1] && y<=r[3]; });
    if(x>=0 && x<=W && y>=0 && y<=H && !under) return;
    if(p.id!=="home" && Math.hypot(x-sx(0),y-sy(0))<34) return;
    var dx=x-cx, dy=y-cy, s=Math.min(dx>0?(right-70-cx)/dx:dx<0?(left+70-cx)/dx:1e9, dy>0?(bot-12-cy)/dy:dy<0?(top+12-cy)/dy:1e9);
    // other places: distance from home (matches the info card); home: distance from the view
    var px=cx+dx*s, py=cy+dy*s, d=km(p.id==="home" ? [lonOf(ix(cx)),latOf(iy(cy))] : HOME, p.ll);
    var str=p.short.toUpperCase()+" · "+fmtKm(d), f="500 10px "+col.mono, w=tw(f,str,0)+30, h=22;
    var bx=clamp(px-w/2,left,right-w), by=clamp(py-h/2,top,bot-h), horiz = by<=top+1 || by>=bot-h-1;
    if(overlaps([bx,by,bx+w,by+h],[R.info])) by=Math.max(by,R.info[3]+8);
    if(overlaps([bx,by,bx+w,by+h],[R.ctrl])) bx=Math.min(bx,R.ctrl[0]-8-w);
    for(var n=0;n<4 && overlaps([bx-3,by-3,bx+w+3,by+h+3],done);n++){
      if(horiz) bx = bx+w/2 > cx ? bx-w-8 : bx+w+8; else by = by+h/2 > cy ? by-h-6 : by+h+6;
      bx=clamp(bx,left,right-w); by=clamp(by,top,bot-h);
    }
    done.push([bx,by,bx+w,by+h]);
    pill(bx,by,w,h,rgba("bg",.9),selected===p.id?rgba("acc",.6):rgba("fg",.18));
    var ang=Math.atan2(dy,dx), ax=bx+13, ay=by+h/2;
    ctx.save(); ctx.translate(ax,ay); ctx.rotate(ang); ctx.fillStyle=col.acc; ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-3.5,-4); ctx.lineTo(-1.5,0); ctx.lineTo(-3.5,4); ctx.closePath(); ctx.fill(); ctx.restore();
    text(str,bx+23,ay+.5,f,0,col.fg,"left");
    hits.push({ id:p.id, rect:[bx,by,bx+w,by+h] });
  });
}
/* cursor readout: what's under the pointer, where, and how far from home */
var rdKey="", rdName="";
function drawReadout(){
  if(mx<0 || hoverId || drag || pinch) return;
  var x=ix(mx), y=iy(my), lon=lonOf(x), lat=latOf(y);
  var k=Math.round(x*2e4)+","+Math.round(y*2e4); if(k!==rdKey){ rdKey=k; rdName=placeName(x,y); }
  var hx=sx(0), hy=sy(0);
  ctx.save(); ctx.setLineDash([3,4]); ctx.strokeStyle=rgba("acc",.35); ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(mx,my); ctx.stroke(); ctx.restore();
  ctx.strokeStyle=rgba("fg",.75); ctx.lineWidth=1; ctx.beginPath(); ctx.arc(mx,my,6,0,TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx-10,my); ctx.lineTo(mx-7,my); ctx.moveTo(mx+7,my); ctx.lineTo(mx+10,my); ctx.moveTo(mx,my-10); ctx.lineTo(mx,my-7); ctx.moveTo(mx,my+7); ctx.lineTo(mx,my+10); ctx.stroke();
  var l1=rdName, l2=Math.abs(lat).toFixed(4)+"°"+(lat>=0?"N":"S")+"  "+lon.toFixed(4)+"°E  ·  "+fmtKm(km(HOME,[lon,lat]))+" from home";
  var f1="600 11.5px "+col.sans, f2="400 10px "+col.mono, w=Math.max(tw(f1,l1,0),tw(f2,l2,0))+20, h=38;
  var tx=mx+16, ty=my+14; if(tx+w>W-6) tx=mx-16-w; if(ty+h>R.hudTop-4) ty=my-14-h; tx=Math.max(6,tx); ty=Math.max(6,ty);
  pill(tx,ty,w,h,rgba("bg",.92),rgba("acc",.35));
  text(l1,tx+10,ty+13,f1,0,col.fg,"left");
  text(l2,tx+10,ty+27,f2,0,col.muted,"left");
}

/* ---------- frame ---------- */
var hits=[], selected="home", hoverId=null, mx=-1, my=-1, probeUntil=0, drag=null, pinch=null;
var phase="wait", tScan=0, arriveT=-1, startLL=null, visible=false, seen=false, started=false, raf=0, lastDraw=0, dirty=true;
function render(now){
  screenTx(); ctx.clearRect(0,0,W,H);
  if(!geo){ drawWaiting(now); return; }
  if(probeUntil && now>probeUntil){ probeUntil=0; mx=my=-1; }
  var span=W/cam.z, hx=sx(0), hy=sy(0), placed=[R.info, R.ctrl].concat(R.hud);
  sample(); hits=[];
  var gl=ctx.createRadialGradient(hx,hy,0,hx,hy,Math.min(W,H)*.5); gl.addColorStop(0,rgba("acc",.11)); gl.addColorStop(1,rgba("acc",0));
  ctx.fillStyle=gl; ctx.fillRect(0,0,W,H);
  drawGraticule(placed);
  if(phase==="wait"){ scaleBar(); return; }
  drawDots(now);
  drawBorders(span);
  drawRoutes(now);
  placed.push([hx-RH2-4, hy-RH2-4, hx+RH2+4, hy+RH2+4]);
  var geoms = PLACES.filter(function(p){ return p.id!=="home"; }).map(function(p){ var g=poiGeom(p); if(Math.hypot(g.x-hx,g.y-hy)>34) placed.push(g.rect); return [p,g]; });
  var tag = phase==="idle" ? homeTag(hx,hy,placed) : null; if(tag) placed.push(tag.rect);
  drawLabels(span, placed);
  geoms.forEach(function(pg){ var g=pg[1]; if(g.x>=0 && g.x<=W && g.y>=0 && g.y<=H && Math.hypot(g.x-hx,g.y-hy)>34) drawPOI(pg[0],g,now); });
  drawHome(now, tag);
  drawOffscreen();
  drawReadout();
  if(phase==="scan" && !RM){
    var sy2=((now-tScan)/1000%1.1)/1.1*H, sg=ctx.createLinearGradient(0,sy2-70,0,sy2);
    sg.addColorStop(0,rgba("acc",0)); sg.addColorStop(1,rgba("acc",.16)); ctx.fillStyle=sg; ctx.fillRect(0,sy2-70,W,70);
    ctx.fillStyle=rgba("acc",.55); ctx.fillRect(0,sy2,W,1);
  }
  if(phase==="fly" && anim && startLL){ var e=anim.e||0; el.coords.textContent=fmtLL([startLL[0]+(HOME[0]-startLL[0])*e, startLL[1]+(HOME[1]-startLL[1])*e],4)+" · UTC+8"; }
  scaleBar();
}
function drawWaiting(now){
  var X=W/2, Y=H/2, a=RM?0:(now/600)%TAU;
  ctx.strokeStyle=rgba("acc",.5); ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(X,Y,14,a,a+TAU*.7); ctx.stroke();
  text(failed?"MAP DATA UNAVAILABLE":"LOADING MAP DATA",X,Y+32,"500 10px "+col.mono,2,rgba("muted",.8),"center");
}
function frame(now){
  raf=0; if(!W) return;
  step(now);
  var busy = anim || vel || drag || pinch, live = !RM && visible && !document.hidden;
  if(busy || dirty || (live && (now-lastDraw>=31 || mx>=0))){ render(now); lastDraw=now; dirty=false; }
  if(busy || live) kick(true);
}
function kick(keep){ if(!keep) dirty=true; if(!raf) raf=requestAnimationFrame(frame); }

/* ---------- info card + HUD ---------- */
function showPlace(p){
  el.tag.textContent=p.tag; el.name.textContent=p.name; el.desc.textContent=p.desc;
  el.coords.textContent=fmtLL(p.ll,4)+(p.id==="home"?" · UTC+8":"");
  el.dist.textContent = p.id==="home" ? "" : fmtKm(km(HOME,p.ll))+" from home";
  [].forEach.call(el.places.querySelectorAll("button"), function(b){ b.setAttribute("aria-pressed", String(b.getAttribute("data-place")===p.id)); });
  measure();
}
function select(id){
  interrupt(); selected=id; showPlace(byId[id]);
  flyTo(viewOf(id)); kick();
}
var lastBar="";
function scaleBar(){
  var kmpp=111.32/cam.z, target=kmpp*84, p=Math.pow(10,Math.floor(Math.log10(target))), n=target/p;
  var d=(n>=5?5:n>=2?2:1)*p, px=d/kmpp, s=d<1?Math.round(d*1000)+" m":(+d.toPrecision(3))+" km", k=s+"|"+px.toFixed(0);
  if(k===lastBar) return; lastBar=k; el.bar.style.width=px.toFixed(1)+"px"; el.barTxt.textContent=s;
}
var ariaT=0;
function settled(){
  clearTimeout(ariaT);
  ariaT=setTimeout(function(){
    cv.setAttribute("aria-label","Interactive map of Panay, Philippines. Selected: "+byId[selected].name+". View about "+fmtKm(W/cam.z*111.32*COSL)+" across.");
  },400);
}
var hintT=0;
function hint(msg){ el.hint.textContent=msg; el.hint.classList.add("show"); clearTimeout(hintT); hintT=setTimeout(function(){ el.hint.classList.remove("show"); },1500); }

/* local sky: next sunrise / sunset for Malinao (suncalc's algorithm) */
var hm = new Intl.DateTimeFormat("en-GB",{ timeZone:"Asia/Manila", hour:"2-digit", minute:"2-digit", hour12:false });
function sunEvents(ms){
  var J1970=2440588, J2000=2451545, J0=.0009, e=23.4397*RAD, lw=-HOME[0]*RAD, phi=HOME[1]*RAD, out=[];
  var d=ms/864e5-.5+J1970-J2000, n0=Math.round(d-J0-lw/TAU);
  for(var n=n0-1;n<=n0+1;n++){
    var ds=J0+lw/TAU+n, M=RAD*(357.5291+.98560028*ds), L=M+RAD*(1.9148*Math.sin(M)+.02*Math.sin(2*M)+.0003*Math.sin(3*M))+RAD*102.9372+Math.PI;
    var dec=Math.asin(Math.sin(e)*Math.sin(L)), noon=J2000+ds+.0053*Math.sin(M)-.0069*Math.sin(2*L);
    var w=Math.acos((Math.sin(-.833*RAD)-Math.sin(phi)*Math.sin(dec))/(Math.cos(phi)*Math.cos(dec)));
    var a=J0+(w+lw)/TAU+n, set=J2000+a+.0053*Math.sin(M)-.0069*Math.sin(2*L), rise=noon-(set-noon);
    out.push([(rise+.5-J1970)*864e5,"Sunrise"],[(set+.5-J1970)*864e5,"Sunset"]);
  }
  return out.sort(function(a,b){ return a[0]-b[0]; });
}
function sky(){
  var now=Date.now(), next=sunEvents(now).filter(function(v){ return v[0]>now; })[0];
  if(!next) return;
  el.sky.textContent=""; el.sky.appendChild(document.createTextNode(next[1]+" "));
  var b=document.createElement("b"); b.textContent=hm.format(new Date(next[0])); el.sky.appendChild(b);
  el.sky.hidden=false;
}
var WMO={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Drizzle",53:"Drizzle",55:"Drizzle",56:"Drizzle",57:"Drizzle",
  61:"Light rain",63:"Rain",65:"Heavy rain",66:"Rain",67:"Rain",80:"Showers",81:"Showers",82:"Heavy showers",95:"Thunderstorm",96:"Thunderstorm",99:"Thunderstorm"};
function showWx(v){
  if(!v || typeof v.temp!=="number") return;
  el.wx.textContent="";
  var b=document.createElement("b"); b.textContent=Math.round(v.temp)+"°C"; el.wx.appendChild(b);
  var s=document.createElement("span"); s.className="wx-txt"; s.textContent=" "+(WMO[v.code]||"Malinao"); el.wx.appendChild(s);
  el.wx.hidden=false; measure();
}
function weather(){
  var KEY="je-wx", c=null;
  try{ c=JSON.parse(sessionStorage.getItem(KEY)); }catch(e){}
  if(c && Date.now()-c.t<9e5){ showWx(c); return; }
  if(!window.fetch) return;
  fetch("https://api.open-meteo.com/v1/forecast?latitude="+HOME[1]+"&longitude="+HOME[0]+"&current=temperature_2m,weather_code&timezone=Asia%2FManila")
    .then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function(d){ var v={ t:Date.now(), temp:d.current.temperature_2m, code:d.current.weather_code }; try{ sessionStorage.setItem(KEY,JSON.stringify(v)); }catch(e){} showWx(v); })
    .catch(function(){});
}

/* ---------- intro: scan the Philippines, then fly in and lock on to home ---------- */
function preset(){
  if(started || !geo || !W) return;
  measure(); var v=viewOf(RM ? "home" : "all"); cam.x=v.x; cam.y=v.y; cam.z=v.z; clampCam();
}
function maybeStart(){
  preset();
  if(started || !geo || !seen || !W) return;
  started=true; measure();
  if(RM){ var v=viewOf("home"); cam.x=v.x; cam.y=v.y; cam.z=v.z; phase="idle"; settled(); kick(); return; }
  var v0=viewOf("all"); cam.x=v0.x; cam.y=v0.y; cam.z=v0.z; clampCam();
  phase="scan"; tScan=performance.now(); startLL=[lonOf(cam.x),latOf(cam.y)];
  card.classList.add("locating"); el.tag.textContent="Locating";
  setTimeout(function(){
    if(phase!=="scan") return;
    phase="fly"; flyTo(viewOf("home"), 2600, function(now){ arrive(now); });
  }, 1100);
  kick();
}
function arrive(now){
  if(phase==="idle") return;
  phase="idle"; arriveT=now; card.classList.remove("locating"); showPlace(byId[selected]); kick();
}
function interrupt(){ anim=null; vel=null; if(phase!=="idle" && started) arrive(performance.now()); }

/* ---------- input ---------- */
var ptrs={}, lastTap=0, lastTapP=[0,0];
function pos(e){ var r=cv.getBoundingClientRect(); return [(e.clientX-r.left)*W/r.width, (e.clientY-r.top)*H/r.height]; }
function pick(x,y){
  for(var i=hits.length-1;i>=0;i--){ var h=hits[i];
    if(h.r && (x-h.x)*(x-h.x)+(y-h.y)*(y-h.y)<=h.r*h.r) return h.id;
    if(h.rect && x>=h.rect[0] && x<=h.rect[2] && y>=h.rect[1] && y<=h.rect[3]) return h.id; }
  return null;
}
function hover(){ var id = mx>=0 && !drag && !pinch ? pick(mx,my) : null; hoverId=id; cv.classList.toggle("on-poi", !!id); }
function two(){ var k=Object.keys(ptrs), a=ptrs[k[0]], b=ptrs[k[1]]; return { d:Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1])), x:(a[0]+b[0])/2, y:(a[1]+b[1])/2 }; }
cv.addEventListener("pointerdown", function(e){
  if(e.pointerType==="mouse" && e.button!==0) return;
  var p=pos(e); ptrs[e.pointerId]=p;
  var n=Object.keys(ptrs).length, touch=e.pointerType==="touch";
  if(!touch){ try{ cv.setPointerCapture(e.pointerId); }catch(_){} interrupt(); }
  vel=null;
  if(n===1) drag={ x0:p[0], y0:p[1], cx:cam.x, cy:cam.y, moved:false, touch:touch, hist:[[performance.now(),p[0],p[1]]] };
  else if(n===2){ interrupt(); drag=null; var t=two(); pinch={ d0:t.d, z0:cam.z, px:ix(t.x), py:iy(t.y) }; }
});
cv.addEventListener("pointermove", function(e){
  var p=pos(e);
  if(e.pointerType!=="touch"){ mx=p[0]; my=p[1]; probeUntil=0; }
  if(ptrs[e.pointerId]) ptrs[e.pointerId]=p;
  if(pinch && Object.keys(ptrs).length>=2){
    var t=two(); cam.z=zLim(pinch.z0*t.d/pinch.d0); cam.x=pinch.px-(t.x-W/2)/cam.z; cam.y=pinch.py-(t.y-H/2)/cam.z; clampCam();
    if(e.cancelable) e.preventDefault(); kick(); return;
  }
  if(drag && ptrs[e.pointerId]){
    var dx=p[0]-drag.x0, dy=p[1]-drag.y0;
    if(!drag.moved && dx*dx+dy*dy>36){ drag.moved=true; if(!drag.touch) cv.classList.add("dragging"); }
    if(drag.moved){
      if(drag.touch){ if(Math.abs(dx)>Math.abs(dy)*1.2) hint("Use two fingers to move the map"); }
      else { cam.x=drag.cx-dx/cam.z; cam.y=drag.cy-dy/cam.z; clampCam(); drag.hist.push([performance.now(),p[0],p[1]]); if(drag.hist.length>6) drag.hist.shift(); }
    }
  }
  hover(); kick();
});
function up(e){
  var p=pos(e), had=!!ptrs[e.pointerId]; delete ptrs[e.pointerId];
  var n=Object.keys(ptrs).length;
  if(pinch){ if(n<2){ pinch=null; drag=null; settled(); } return; }
  if(!drag || !had) return;
  cv.classList.remove("dragging");
  if(!drag.moved && e.type==="pointerup") tap(p, drag.touch);
  else if(drag.moved && !drag.touch){
    var h=drag.hist, a=h[0], b=h[h.length-1], dt=b[0]-a[0];
    if(dt>0 && performance.now()-b[0]<90) vel={ x:(b[1]-a[1])/dt, y:(b[2]-a[2])/dt, t:performance.now() }; else settled();
  }
  drag=null; hover(); kick();
}
cv.addEventListener("pointerup", up);
cv.addEventListener("pointercancel", up);
cv.addEventListener("pointerleave", function(e){ if(e.pointerType!=="touch"){ mx=my=-1; hover(); kick(); } });
function tap(p,touch){
  var id=pick(p[0],p[1]);
  if(id){ select(id); return; }
  if(!touch) return;
  var now=performance.now();
  if(now-lastTap<320 && Math.hypot(p[0]-lastTapP[0],p[1]-lastTapP[1])<30){ lastTap=0; mx=my=-1; probeUntil=0; interrupt(); zoomBy(2,p[0],p[1],true); return; }
  lastTap=now; lastTapP=p; mx=p[0]; my=p[1]; probeUntil=now+3500; kick();
}
cv.addEventListener("dblclick", function(e){ var p=pos(e); if(pick(p[0],p[1])) return; interrupt(); zoomBy(2,p[0],p[1],true); });
cv.addEventListener("wheel", function(e){
  if(!(e.ctrlKey || e.metaKey)){ hint((MAC?"⌘":"Ctrl")+" + scroll to zoom the map"); return; }
  e.preventDefault(); interrupt();
  var p=pos(e), dy=e.deltaMode===1 ? e.deltaY*16 : e.deltaMode===2 ? e.deltaY*H : e.deltaY;
  zoomBy(Math.exp(-clamp(dy,-120,120)*.0042), p[0], p[1], false);
},{ passive:false });
var gz=0;   // Safari trackpad pinch
cv.addEventListener("gesturestart", function(e){ e.preventDefault(); interrupt(); gz=cam.z; });
cv.addEventListener("gesturechange", function(e){ e.preventDefault(); var p=pos(e); zoomBy(gz*e.scale/cam.z, p[0], p[1], false); });
cv.addEventListener("keydown", function(e){
  var k=e.key, d=Math.min(W,H)*.22/cam.z, v=null;
  if(k==="ArrowLeft") v={x:cam.x-d, y:cam.y, z:cam.z};
  else if(k==="ArrowRight") v={x:cam.x+d, y:cam.y, z:cam.z};
  else if(k==="ArrowUp") v={x:cam.x, y:cam.y-d, z:cam.z};
  else if(k==="ArrowDown") v={x:cam.x, y:cam.y+d, z:cam.z};
  else if(k==="+" || k==="=") { interrupt(); zoomBy(2,null,null,true); }
  else if(k==="-" || k==="_") { interrupt(); zoomBy(.5,null,null,true); }
  else if(k==="0") { interrupt(); flyTo(viewOf("all")); }
  else if(k==="1" || k==="2" || k==="3") select(PLACES[+k-1].id);
  else if(k==="Home") select("home");
  else return;
  e.preventDefault();
  if(v){ interrupt(); flyTo(v,260,null,true); }
});
cv.addEventListener("focus", function(){ if(cv.matches(":focus-visible")) card.classList.add("kbd"); });
cv.addEventListener("blur", function(){ card.classList.remove("kbd"); });
el.places.addEventListener("click", function(e){ var b=e.target.closest("button[data-place]"); if(b) select(b.getAttribute("data-place")); });
el.ctrl.addEventListener("click", function(e){
  var b=e.target.closest("button[data-act]"); if(!b) return;
  var a=b.getAttribute("data-act"); interrupt();
  if(a==="in") zoomBy(2,null,null,true); else if(a==="out") zoomBy(.5,null,null,true);
  else if(a==="home") select("home"); else if(a==="all") flyTo(viewOf("all"));
});

/* ---------- size, theme, visibility, data ---------- */
function size(){
  var w=cv.clientWidth, h=cv.clientHeight; if(!w || !h) return;
  var span = W ? W/cam.z : 0;
  dpr=Math.min(2, window.devicePixelRatio||1); W=w; H=h;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
  S0 = W<520 ? 6.5 : 7.5; R0b = W<520 ? 1.15 : 1.35;
  if(span) cam.z=W/span;
  gridKey=""; measure(); clampCam(); maybeStart(); kick();
}
F_POI="600 12px sans-serif"; F_SUB="400 10px monospace";
function fonts(){ colors(); F_POI="600 12px "+col.sans; F_SUB="400 10px "+col.mono; kick(); }
var failed=false;
function loadData(){
  if(loadData.done) return; loadData.done=true;
  if(window.__MAPDATA__){ initGeo(window.__MAPDATA__); maybeStart(); return; }
  var s=document.createElement("script"); s.src=BASE+"map-data.js"; s.async=true;
  s.onload=function(){ if(window.__MAPDATA__){ initGeo(window.__MAPDATA__); window.__MAPDATA__=null; maybeStart(); kick(); } else { failed=true; kick(); } };
  s.onerror=function(){ failed=true; kick(); };
  document.head.appendChild(s);
}
fonts(); size();
if(window.ResizeObserver) new ResizeObserver(size).observe(cv); else addEventListener("resize", size);
new MutationObserver(function(){ fonts(); }).observe(root,{ attributes:true, attributeFilter:["data-theme"] });
if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ fonts(); measure(); });
document.addEventListener("visibilitychange", function(){ kick(); });
if("IntersectionObserver" in window){
  new IntersectionObserver(function(es){ if(es[0].isIntersecting) loadData(); },{ rootMargin:"900px 0px" }).observe(cv);
  new IntersectionObserver(function(es){
    var en=es[0]; visible=en.isIntersecting;
    if(visible){ loadData(); if(en.intersectionRatio>=.3){ seen=true; maybeStart(); } kick(); }
  },{ threshold:[0,.3] }).observe(cv);
} else { visible=seen=true; loadData(); }
sky(); setInterval(sky, 60000);
weather();
})();
