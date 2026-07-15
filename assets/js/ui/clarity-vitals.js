/**
 * clarity-vitals.js — the live "brain board" for the civilization page.
 *
 * Renders a STABLE, self-owned card grid ABOVE #console-grid (so the console's periodic
 * innerHTML re-renders never touch it => no bounce). Each card shows a domain's live stress,
 * phase, trajectory, and kernel/fallback source, plus a short vitals waveform whose character
 * scales with stress (erratic/spiky when dysregulated, calm when regulated). Cards are built
 * ONCE and only their values + canvases update in place (no DOM rebuild => no layout jump).
 * The old bouncy grey .clr-domain-grid is hidden (this replaces it). Pure client math, no AI,
 * no network. Reads window.LIMENDomains (populated by the brain adapter). Galaxy untouched.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var D = [
    ['Finance',['finance']],['Medicine',['medicine','health']],['Technology',['technology']],
    ['Industry',['industry']],['Science',['science','research']],['Trade',['trade','supplyChain']],
    ['Defense',['defense']],['Agriculture',['agriculture']],['Law',['law']],['Economy',['economy']],
    ['Education',['education']],['Energy',['energy']],['Communication',['communication']],
    ['Infrastructure',['infrastructure']],['Intelligence',['intelligence']],['Population',['population']],
    ['Governance',['governance']],['Environment',['environment']],['Culture',['culture']],['Religion',['religion']]
  ];
  var FAMCOL = { hold:'#3fd0b0', break:'#ff6a5a', drive:'#8a92ff' };
  var FAMNM  = { hold:'HOLDING', break:'BREAKING', drive:'DRIVING' };
  function famOf(p){ p=String(p||'').toLowerCase().replace(/[ab]$/,'');
    if(p==='p0'||p==='p2'||p==='p6')return'hold';
    if(p==='p1'||p==='p3'||p==='p7'||p==='p9')return'break';
    if(p==='p4'||p==='p5'||p==='p8')return'drive'; return'hold'; }
  function sevCol(s){ return s>=0.68?'#ff6a5a': s>=0.5?'#ffc24b':'#4fd18e'; }

  function live(keys){ var doms=window.LIMENDomains||{}; for(var i=0;i<keys.length;i++){ if(doms[keys[i]]) return doms[keys[i]]; } return null; }
  function readStress(d){ if(!d) return 0; var s=(typeof d.stress==='number'&&isFinite(d.stress))?d.stress:(typeof d.brainStress==='number'&&isFinite(d.brainStress)?d.brainStress:0); if(s>1.5)s=s/100; return Math.max(0,Math.min(1,s)); }
  function readPhase(d){ if(!d) return null; return d.brainKernelPhase || d.brainPhase || null; }
  function readTraj(d){ if(!d) return null; return d.brainKernelTrajectory || d.brainTrajectory || null; }
  function readSrc(d){ if(!d) return 'fallback'; return d.brainPhaseSource==='thing2-kernel'?'kernel':'fallback'; }
  function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function readFeeds(d){
    if(!d) return [];
    var out=[];
    if(Array.isArray(d.sources)&&d.sources.length){
      d.sources.forEach(function(s){ if(!s)return; out.push({name:s.name||s.label||'source', live:(typeof s.live==='boolean'?s.live:null), updated:s.updated}); });
      return out;
    }
    if(Array.isArray(d.brainFeeds)&&d.brainFeeds.length){
      d.brainFeeds.forEach(function(s){ if(!s)return; if(typeof s==='string'){out.push({name:s,live:null});return;} out.push({name:s.name||s.label||'feed', live:(typeof s.live==='boolean'?s.live:null), updated:s.updated}); });
    }
    return out;
  }
  function ago(u){ if(u==null)return''; var ts=(typeof u==='number')?u:Date.parse(u); if(!ts||isNaN(ts))return''; var s=Math.max(0,Math.round((Date.now()-ts)/1000)); return s<60?s+'s':s<3600?Math.round(s/60)+'m':Math.round(s/3600)+'h'; }
  function renderFeeds(m){
    var d=live(m.keys), feeds=readFeeds(d);
    if(!feeds.length){ if(m._feedHtml!=='none'){ m.feeds.innerHTML='<div class="bb-nofeeds">No feeds attached to this domain yet.</div>'; m._feedHtml='none'; } return; }
    var liveN=feeds.filter(function(f){return f.live===true;}).length;
    var shown=feeds.slice(0,5), extra=feeds.length-shown.length;
    var html='<div class="bb-feed-head">Feeds &middot; '+liveN+'/'+feeds.length+' live</div>';
    shown.forEach(function(f){
      var cls=f.live===true?'on':f.live===false?'off':'unk';
      var stat=f.live===true?'LIVE':f.live===false?'OFFLINE':'UNKNOWN';
      var age=ago(f.updated);
      html+='<div class="bb-feed"><span class="bb-fdot '+cls+'"></span>'
        +'<span class="bb-fname">'+esc(f.name)+'</span>'
        +'<span class="bb-fstat '+cls+'">'+stat+'</span>'
        +(age?'<span class="bb-fage">'+esc(age)+'</span>':'')+'</div>';
    });
    if(extra>0) html+='<div class="bb-fmore">+'+extra+' more</div>';
    // change-guarded: only touch the DOM when the feed list actually changed
    if(m._feedHtml!==html){ m.feeds.innerHTML=html; m._feedHtml=html; }
  }

  function injectCSS(){
    if(document.getElementById('limen-bb-css')) return;
    var s=document.createElement('style'); s.id='limen-bb-css';
    s.textContent=[
      '#limen-brain-board{padding:16px 24px 6px;font-family:system-ui,"Segoe UI",Roboto,Arial,sans-serif}',
      '@media(max-width:600px){#limen-brain-board{padding:10px 12px 4px}}',
      '#limen-brain-board .bb-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:12px}',
      '#limen-brain-board .bb-title{font-weight:750;font-size:0.92rem;letter-spacing:.06em;color:#eaf1fb;text-transform:uppercase}',
      '#limen-brain-board .bb-sum{font-family:ui-monospace,monospace;font-size:11px;color:#8fa2bd;display:flex;gap:14px;flex-wrap:wrap}',
      '#limen-brain-board .bb-sum b{width:8px;height:8px;border-radius:2px;display:inline-block;margin-right:5px;vertical-align:-1px}',
      '#limen-brain-board .bb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:12px}',
      '#limen-brain-board .bb-card{position:relative;background:linear-gradient(180deg,rgba(16,24,40,.86),rgba(10,17,30,.92));border:1px solid rgba(120,150,200,.14);border-radius:14px;padding:12px 14px;overflow:hidden;cursor:pointer;transition:border-color .2s}',
      '#limen-brain-board .bb-card:hover{border-color:rgba(120,150,200,.34)}',
      '#limen-brain-board .bb-cx{margin-left:8px;color:#5d6f8d;font-size:11px;transition:transform .2s;flex:none}',
      '#limen-brain-board .bb-card.open .bb-cx{transform:rotate(90deg)}',
      '#limen-brain-board .bb-feeds{display:none;margin-top:11px;border-top:1px solid rgba(120,150,200,.14);padding-top:9px}',
      '#limen-brain-board .bb-card.open .bb-feeds{display:block}',
      '#limen-brain-board .bb-feed-head{font-family:ui-monospace,monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#63748f;margin-bottom:6px}',
      '#limen-brain-board .bb-feed{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px}',
      '#limen-brain-board .bb-fdot{width:7px;height:7px;border-radius:50%;flex:none}',
      '#limen-brain-board .bb-fdot.on{background:#4fd18e;box-shadow:0 0 7px #4fd18e}',
      '#limen-brain-board .bb-fdot.off{background:#e0685c}',
      '#limen-brain-board .bb-fdot.unk{background:#5d6f8d}',
      '#limen-brain-board .bb-fname{color:#cdd8e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#limen-brain-board .bb-fstat{margin-left:auto;font-family:ui-monospace,monospace;font-size:9px;letter-spacing:.06em}',
      '#limen-brain-board .bb-fstat.on{color:#4fd18e} #limen-brain-board .bb-fstat.off{color:#e0685c} #limen-brain-board .bb-fstat.unk{color:#63748f}',
      '#limen-brain-board .bb-fage{color:#5d6f8d;font-family:ui-monospace,monospace;font-size:9px;margin-left:8px}',
      '#limen-brain-board .bb-nofeeds{font-size:11px;color:#63748f;font-style:italic}',
      '#limen-brain-board .bb-card::after{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--sev);box-shadow:0 0 14px var(--sev)}',
      '#limen-brain-board .bb-top{display:flex;align-items:center;gap:8px}',
      '#limen-brain-board .bb-dot{width:9px;height:9px;border-radius:50%;background:var(--sev);flex:none;box-shadow:0 0 8px var(--sev)}',
      '#limen-brain-board .bb-nm{font-weight:680;font-size:1rem;color:#eef3fb;letter-spacing:-.01em}',
      '#limen-brain-board .bb-src{margin-left:auto;font-family:ui-monospace,monospace;font-size:9px;letter-spacing:.06em;color:#63748f;display:inline-flex;align-items:center;gap:4px}',
      '#limen-brain-board .bb-src i{width:6px;height:6px;border-radius:50%;background:#34d1c8;box-shadow:0 0 6px #34d1c8}',
      '#limen-brain-board .bb-src.fb i{background:#5d6f8d;box-shadow:none}',
      '#limen-brain-board .bb-mid{display:flex;align-items:flex-end;gap:6px;margin-top:7px}',
      '#limen-brain-board .bb-val{font-size:1.85rem;font-weight:800;line-height:.9;color:#eef3fb;font-variant-numeric:tabular-nums;letter-spacing:-.03em}',
      '#limen-brain-board .bb-val small{font-size:.6rem;color:#5d6f8d;font-weight:600}',
      '#limen-brain-board canvas.bb-spark{margin-left:auto;width:100px;height:30px;display:block}',
      '#limen-brain-board .bb-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden;margin-top:8px}',
      '#limen-brain-board .bb-fill{height:100%;border-radius:3px;background:var(--sev);width:0;transition:width .6s ease}',
      '#limen-brain-board .bb-tags{display:flex;align-items:center;gap:7px;margin-top:10px;flex-wrap:wrap}',
      '#limen-brain-board .bb-ph{font-family:ui-monospace,monospace;font-size:11px;font-weight:700;padding:3px 8px;border-radius:7px;color:#050b14;background:var(--fam);box-shadow:0 0 12px -3px var(--fam)}',
      '#limen-brain-board .bb-fam{font-family:ui-monospace,monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--fam)}',
      '#limen-brain-board .bb-traj{font-family:ui-monospace,monospace;font-size:9.5px;color:#8fa2bd;border:1px solid rgba(120,150,200,.2);border-radius:6px;padding:3px 7px;margin-left:auto}',
      '#limen-brain-board .bb-traj.bad{color:#ff6a5a;border-color:rgba(255,106,90,.4)}',
      '#limen-brain-board .bb-traj.good{color:#3fd0b0;border-color:rgba(63,208,176,.4)}',
      '#limen-brain-board .bb-decision{margin-top:9px;font-family:ui-monospace,monospace;font-size:10px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
      '#limen-brain-board .bb-post{font-weight:700;letter-spacing:.06em;padding:2px 7px;border-radius:5px;text-transform:uppercase}',
      '#limen-brain-board .bb-post.escalate{color:#ffb4ab;background:rgba(255,106,90,.16)}',
      '#limen-brain-board .bb-post.act{color:#8fe3dd;background:rgba(52,209,200,.15)}',
      '#limen-brain-board .bb-post.hold,#limen-brain-board .bb-post.monitor{color:#7fdcc0;background:rgba(63,208,176,.12)}',
      '#limen-brain-board .bb-post.abstain{color:#9aa6bd;background:rgba(120,150,200,.13)}',
      '#limen-brain-board .bb-act{color:#8fa2bd}',
      '#limen-brain-board .bb-choice{color:#cdd8e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}',
      '#limen-brain-board #bb-ws{background:linear-gradient(180deg,rgba(20,28,48,.92),rgba(12,18,34,.95));border:1px solid rgba(120,150,200,.22);border-radius:16px;padding:15px 18px;margin-bottom:16px}',
      '#limen-brain-board .bb-ws-top{display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-bottom:8px}',
      '#limen-brain-board .bb-ws-lab{font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8fa2bd;font-weight:750}',
      '#limen-brain-board .bb-ws-post{font-family:ui-monospace,monospace;font-weight:750;font-size:12px;letter-spacing:.05em;text-transform:uppercase;padding:3px 10px;border-radius:7px}',
      '#limen-brain-board .bb-ws-post.escalate{color:#ffb4ab;background:rgba(255,106,90,.17)}',
      '#limen-brain-board .bb-ws-post.restrain{color:#ffd18a;background:rgba(255,193,75,.16)}',
      '#limen-brain-board .bb-ws-post.act{color:#8fe3dd;background:rgba(52,209,200,.15)}',
      '#limen-brain-board .bb-ws-post.hold{color:#7fdcc0;background:rgba(63,208,176,.14)}',
      '#limen-brain-board .bb-ws-consc{font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.05em}',
      '#limen-brain-board .bb-ws-consc.restrictive{color:#ffd18a}',
      '#limen-brain-board .bb-ws-consc.permissive{color:#7fdcc0}',
      '#limen-brain-board .bb-ws-report{font-size:12.5px;color:#dbe4f2;line-height:1.55}',
      '#limen-brain-board .bb-ws-spot{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}',
      '#limen-brain-board .bb-ws-chip{font-family:ui-monospace,monospace;font-size:10px;color:#9db0cc;border:1px solid rgba(120,150,200,.26);border-radius:12px;padding:2px 9px}',
      '#limen-brain-board .bb-ws-model{font-family:ui-monospace,monospace;font-size:8.5px;color:#5d6f8d;letter-spacing:.03em;margin-top:9px}',
      /* retire the old bouncy grey domain grid — the board replaces it */
      '.clr-domain-grid{display:none!important}',
      /* ── brighter + larger + feeds visible (operator request) ── */
      '#limen-brain-board .bb-feeds{display:block}',                    /* feeds shown by default, not click-gated */
      '#limen-brain-board .bb-sum{font-size:13px;color:#c9d7ef}',
      '#limen-brain-board .bb-nm{font-size:1.2rem;color:#ffffff;font-weight:720}',
      '#limen-brain-board .bb-val{font-size:2.15rem;color:#ffffff}',
      '#limen-brain-board .bb-val small{font-size:.62rem;color:#7f93b4}',
      '#limen-brain-board .bb-feed{font-size:13px;padding:4px 0}',
      '#limen-brain-board .bb-fname{color:#eaf1fb}',
      '#limen-brain-board .bb-feed-head{font-size:11px;color:#94accf;letter-spacing:.06em}',
      '#limen-brain-board .bb-fstat{font-size:10px}',
      '#limen-brain-board .bb-fmore{font-size:10.5px;color:#7f93b4;padding:3px 0 1px 15px;font-style:italic}',
      '#limen-brain-board .bb-decision{font-size:12px}',
      '#limen-brain-board .bb-post{font-size:11px}',
      '#limen-brain-board .bb-act{color:#bccbe4}',
      '#limen-brain-board .bb-choice{color:#eef3fb}',
      '#limen-brain-board .bb-traj{font-size:11px;color:#c9d7ef}',
      '#limen-brain-board .bb-fam{font-size:10px}',
      '#limen-brain-board .bb-ph{font-size:12px}',
      '#limen-brain-board .bb-src{font-size:10px;color:#8ea6c8}',
      '#limen-brain-board .bb-ws-report{font-size:13.5px;color:#eaf1fb}',
      '#limen-brain-board .bb-title{font-size:1rem;color:#ffffff}'
    ].join('');
    document.head.appendChild(s);
  }

  var cards=[], sumEl=null, wsEl=null;
  function build(){
    var grid=document.getElementById('console-grid');
    var host=document.createElement('section'); host.id='limen-brain-board';
    var head=document.createElement('div'); head.className='bb-head';
    head.innerHTML='<span class="bb-title">Connectome &middot; live brain state</span>'
      +'<span class="bb-sum" id="bb-sum"></span>';
    var g=document.createElement('div'); g.className='bb-grid';
    var ws=document.createElement('div'); ws.id='bb-ws'; ws.innerHTML='<div class="bb-ws-report">binding domains…</div>';
    host.appendChild(head); host.appendChild(ws); host.appendChild(g);
    if(grid&&grid.parentNode) grid.parentNode.insertBefore(host,grid); else document.body.insertBefore(host,document.body.firstChild);
    sumEl=head.querySelector('#bb-sum'); wsEl=ws;

    D.forEach(function(row){
      var c=document.createElement('div'); c.className='bb-card';
      c.innerHTML='<div class="bb-top"><span class="bb-dot"></span><span class="bb-nm">'+row[0]+'</span>'
        +'<span class="bb-src"><i></i><span class="bb-srct">…</span></span><span class="bb-cx">&#9654;</span></div>'
        +'<div class="bb-mid"><span class="bb-val">0<small>/100</small></span><canvas class="bb-spark"></canvas></div>'
        +'<div class="bb-bar"><div class="bb-fill"></div></div>'
        +'<div class="bb-tags"><span class="bb-ph">—</span><span class="bb-fam"></span><span class="bb-traj">—</span></div>'
        +'<div class="bb-decision"></div>'
        +'<div class="bb-feeds"></div>';
      g.appendChild(c);
      var m={ keys:row[1], card:c, name:row[0],
        val:c.querySelector('.bb-val'), fill:c.querySelector('.bb-fill'),
        ph:c.querySelector('.bb-ph'), fam:c.querySelector('.bb-fam'), traj:c.querySelector('.bb-traj'),
        srcW:c.querySelector('.bb-src'), srct:c.querySelector('.bb-srct'), feeds:c.querySelector('.bb-feeds'), dec:c.querySelector('.bb-decision'),
        cv:c.querySelector('canvas'), buf:[], spk:0, seed:row[0].length*1.3, open:false };
      c.addEventListener('click', (function(mm){ return function(){ mm.open=!mm.open; mm.card.classList.toggle('open',mm.open); if(mm.open) renderFeeds(mm); }; })(m));
      size(m); cards.push(m);
    });
  }
  function size(m){ var dpr=Math.min(window.devicePixelRatio||1,2); var w=m.cv.clientWidth||100,h=30;
    m.cv.width=w*dpr; m.cv.height=h*dpr; m.ctx=m.cv.getContext('2d'); m.ctx.setTransform(dpr,0,0,dpr,0,0); m.w=w; m.h=h;
    if(!m.buf.length){ for(var i=0;i<Math.floor(w/2);i++) m.buf.push(0);} }
  window.addEventListener('resize',function(){ cards.forEach(size); });

  var t=0;
  function sample(m,s){ var amp=0.10+s*0.85;
    var y=Math.sin(t*(0.35+s*0.95)+m.seed)*0.40 + Math.sin(t*0.13+m.seed)*0.12;
    if(!REDUCE){ y+=(Math.random()-0.5)*s*s*1.35; if(Math.random()<s*s*0.06)m.spk=(Math.random()<0.5?-1:1)*(0.5+s*0.6); y+=m.spk; m.spk*=0.6; }
    return Math.max(-1,Math.min(1,y))*amp; }
  function drawSpark(m,s,c){ var ctx=m.ctx,w=m.w,h=m.h,mid=h/2;
    m.buf.push(sample(m,s)); if(m.buf.length>Math.floor(w/2))m.buf.shift();
    ctx.clearRect(0,0,w,h); var n=m.buf.length,step=w/(n-1||1),i,x,y;
    ctx.beginPath(); ctx.moveTo(0,mid); for(i=0;i<n;i++)ctx.lineTo(i*step,mid-m.buf[i]*(mid-3)); ctx.lineTo(w,mid);
    var g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,c+'30'); g.addColorStop(1,c+'00'); ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); for(i=0;i<n;i++){x=i*step;y=mid-m.buf[i]*(mid-3);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
    ctx.strokeStyle=c; ctx.lineWidth=1.6; ctx.lineJoin='round'; ctx.shadowColor=c; ctx.shadowBlur=5; ctx.stroke(); ctx.shadowBlur=0;
    var ly=mid-m.buf[n-1]*(mid-3); ctx.beginPath(); ctx.arc(w-1,ly,2,0,7); ctx.fillStyle=c; ctx.fill(); }

  // Per-FRAME (rAF): canvas sparkline ONLY. No DOM text/style writes here, so the
  // waveform stays smooth no matter how heavy the content below the board gets.
  // Stress + color are read from the throttled refresh (m.s / m.col).
  function animate(){ t+=REDUCE?0:0.2;
    for(var i=0;i<cards.length;i++){ var m=cards[i]; try{ drawSpark(m, m.s||0, m.col||'#4fd18e'); }catch(e){} }
    requestAnimationFrame(animate);
  }

  // THROTTLED (~4x/sec): every text + style write, moved OUT of the animation frame
  // and change-guarded so the DOM is only touched when a value actually changes
  // (prevents the per-frame layout thrash that made the waveform stutter once the
  // bottom content loaded). Stress feeds the waveform amplitude via m.s.
  function refreshCards(){
    for(var i=0;i<cards.length;i++){ var m=cards[i]; var d=live(m.keys);
      var s=readStress(d), c=sevCol(s); m.s=s; m.col=c;
      if(m._sev!==c){ m.card.style.setProperty('--sev',c); m._sev=c; }
      var vv=Math.round(s*100); if(m._vv!==vv){ m.val.innerHTML=vv+'<small>/100</small>'; m._vv=vv; }
      var fw=(s*100).toFixed(1)+'%'; if(m._fw!==fw){ m.fill.style.width=fw; m._fw=fw; }
      var p=readPhase(d); var pf=famOf(p); var pc=FAMCOL[pf];
      if(m._pc!==pc){ m.card.style.setProperty('--fam',pc); m._pc=pc; }
      var pt=p?String(p).toUpperCase():'—'; if(m._pt!==pt){ m.ph.textContent=pt; m._pt=pt; }
      var ft=p?FAMNM[pf]:''; if(m._ft!==ft){ m.fam.textContent=ft; m._ft=ft; }
      var tr=readTraj(d); var trt=tr?String(tr).replace(/_/g,' ').toLowerCase():'—';
      if(m._trt!==trt){ m.traj.textContent=trt; m.traj.className='bb-traj'+(/DIVERG|UNRECOV/i.test(tr||'')?' bad':/RECOVERED|STABLE/i.test(tr||'')?' good':''); m._trt=trt; }
      var sr=readSrc(d); if(m._sr!==sr){ m.srct.textContent=sr; m.srcW.className='bb-src'+(sr==='fallback'?' fb':''); m._sr=sr; }
      if(m.dec){ var dc=d&&d.decision;
        if(dc&&dc.posture){ var ch=dc.choice?(' &middot; '+esc(dc.choice)):(dc.vetoed?' &middot; conscience veto':'');
          var decHtml='<span class="bb-post '+esc(dc.posture)+'">'+esc(dc.posture)+'</span><span class="bb-act">'+esc(dc.boundedAction||'')+'</span><span class="bb-choice">'+ch+'</span>';
          if(m._dec!==decHtml){ m.dec.innerHTML=decHtml; m._dec=decHtml; } }
        else if(!m.dec.innerHTML){ m.dec.innerHTML='<span class="bb-act" style="opacity:.5">deciding…</span>'; } }
    }
  }
  var lastSum=0;
  function updSum(){ if(!sumEl) return; var f={hold:0,break:0,drive:0},st=0,k=0;
    D.forEach(function(row){ var d=live(row[1]); var s=readStress(d); if(s>=0.68)st++; var p=readPhase(d); f[famOf(p)]++; if(readSrc(d)==='kernel')k++; });
    sumEl.innerHTML='<span><b style="background:#3fd0b0"></b>holding '+f.hold+'</span>'
      +'<span><b style="background:#ff6a5a"></b>breaking '+f.break+'</span>'
      +'<span><b style="background:#8a92ff"></b>driving '+f.drive+'</span>'
      +'<span style="color:#ff8a7a">'+st+' elevated</span>'
      +'<span style="color:#34d1c8">'+k+'/20 kernel</span>';
    for(var oi=0;oi<cards.length;oi++){ renderFeeds(cards[oi]); }   // feeds visible on every card now
    if(wsEl && window.LIMENWorkspace){
      try{ var w=window.LIMENWorkspace.synthesize(window.LIMENDomains||{});
        if(w && w.ready){
          var spot=(w.broadcast||[]).map(function(b){return '<span class="bb-ws-chip">'+esc(b.domain)+' &middot; '+esc(b.posture)+'</span>';}).join('');
          wsEl.innerHTML='<div class="bb-ws-top"><span class="bb-ws-lab">Global Workspace</span>'
            +'<span class="bb-ws-post '+esc(w.posture)+'">'+esc(w.posture)+' &rarr; '+esc(w.boundedAction)+'</span>'
            +'<span class="bb-ws-consc '+esc(w.conscience.state)+'">conscience: '+esc(w.conscience.state)+'</span></div>'
            +'<div class="bb-ws-report">'+esc(w.selfReport)+'</div>'
            +'<div class="bb-ws-spot">'+spot+'</div>'
            +'<div class="bb-ws-model">'+esc(w.model)+'</div>';
        }
      }catch(e){}
    } }

  function boot(){ injectCSS(); if(!document.getElementById('limen-brain-board')) build();
    refreshCards(); updSum();                 // prime m.s/m.col before the first frame draws
    setInterval(refreshCards,250); setInterval(updSum,1500); requestAnimationFrame(animate); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
