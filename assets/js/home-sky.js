
/* ── THE SKY ───────────────────────────────────────────────────────────────────────────────
   Deep space, in layers, at three depths.

   THE GAS IS A REAL PHOTOGRAPH. assets/img/sky-plate.webp is the James Webb Space Telescope's
   NIRCam image of the Cosmic Cliffs in the Carina Nebula (NGC 3324), reduced from 14575px and
   reduced to grey with a hard curve. Its COLOUR is thrown away and only its structure is kept;
   the palette here is ours, not the photograph's. That is the whole reason it does not look
   like a stock space wallpaper: what is borrowed is the one thing procedural noise cannot
   fake, which is real filaments, real dust lanes and real edges at real resolution.

   Compositing, and why the plate needs no alpha channel:
     colour field  ->  MULTIPLY by the grey plate  ->  ADD to the sky with 'lighter'
   Black multiplies to black, and black adds nothing, so the dark sky masks itself. Encoding
   the structure in alpha instead cost 1.47 MB, because Chrome compresses WebP alpha
   losslessly. As grey it is 238 KB.

   LAYERS, slowest to fastest under parallax:
     farBase   void gradient + the dense faint star population        x0.25
     gasLayer  the photograph, tinted and masked                      x0.25
     midLayer  the sparse bright stars, each with a halo              x0.60
     per-frame twinkling stars, cross-flares, shooting star           x1.00
     per-frame the helix
   Each cached layer is drawn PAD px larger than the viewport in every direction, so sliding
   it never exposes an edge.

   Cost: the cached layers are painted once per resize. Per frame it is three drawImage calls
   plus a few hundred small arcs.                                                            */
(function () {
  'use strict';

  var canvas = document.getElementById('sky');
  var ctx = canvas.getContext('2d', { alpha: false });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Two bakes of the same static scene: without the photograph, and with it. The fade
  // between them is the only moment more than one bitmap is blitted in a frame.
  var sceneDry = document.createElement('canvas'), dryx = sceneDry.getContext('2d');
  var sceneWet = document.createElement('canvas'), wetx = sceneWet.getContext('2d');

  var twinklers = [], flares = [], shooting = null;
  var sat = null, nextSat = 0;
  var alien = null, alienClock = 0, nextAlien = 3, lastFrame = 0;
  var w = 0, h = 0, W = 0, H = 0, dpr = 1, raf = null, t0 = 0, nextShot = 0;

  var PAD = 46;                       // overscan, in CSS px, on every side
  var ANG = -0.42;                    // the galactic plane: up to the right
  var CA = Math.cos(ANG), SA = Math.sin(ANG);

  // Parallax: pointer target, and the smoothed value that actually gets drawn.
  var tgX = 0, tgY = 0, parX = 0, parY = 0;

  var plate = new Image();
  var plateReady = false, gasFade = 0;

  var PALETTE = [
    '255,255,255', '255,255,255', '255,255,255',
    '214,228,255', '182,208,255', '255,246,224', '255,228,180'
  ];
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  /* ── cached layers ─────────────────────────────────────────────────────────────────────
     ONE BITMAP PER FRAME, NOT THREE.

     The first version kept the void, the gas and the bright stars as three separate layers
     and blitted all three every frame so each could parallax at its own rate. Measured, that
     ran at 10 fps on a 1440x900 display: at 2x that is 2880x1800, and three full-canvas
     composites is 15.5 million pixels of blitting per frame, one of them under 'lighter',
     which is the slow path.

     Everything static is now baked into a single bitmap. Depth still reads, because the
     parallax that matters is between the BACKGROUND and the FOREGROUND: the baked scene
     slides at a quarter rate while the twinkling stars, the flares and the helix track the
     pointer fully. Three depths cost 6x the frame time and bought almost nothing over two.

     Two versions are baked, with and without the gas, purely so the photograph can fade in
     when it finishes loading. Once the fade is done only the gas version is ever drawn.    */

  function paintGasInto(target, tw, th) {
    if (!plateReady) return;
    var diag = Math.sqrt(tw * tw + th * th);
    var tmp = document.createElement('canvas');
    tmp.width = Math.round(tw * dpr); tmp.height = Math.round(th * dpr);
    var g2 = tmp.getContext('2d');
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. THE PALETTE. Indigo to teal, running ACROSS the band rather than along it, so the
    //    two hues separate the way distance separates them in a real field.
    var lg = g2.createLinearGradient(
      tw / 2 + SA * diag * 0.5, th / 2 - CA * diag * 0.5,
      tw / 2 - SA * diag * 0.5, th / 2 + CA * diag * 0.5);
    lg.addColorStop(0.00, '#12318C');
    lg.addColorStop(0.45, '#1D5FA8');
    lg.addColorStop(1.00, '#12A6A8');
    g2.fillStyle = lg;
    g2.fillRect(0, 0, tw, th);

    // 2. THE ONE WARM REGION, low and left. The only warm colour in the sky; it ties the
    //    background to the gold in the mark without sitting close enough to compete.
    var ar = diag * 0.34;
    var amber = g2.createRadialGradient(tw * 0.20, th * 0.84, 0, tw * 0.20, th * 0.84, ar);
    amber.addColorStop(0,    'rgba(226,146,54,0.95)');
    amber.addColorStop(0.55, 'rgba(196,116,58,0.45)');
    amber.addColorStop(1,    'rgba(196,116,58,0)');
    g2.fillStyle = amber;
    g2.fillRect(0, 0, tw, th);

    /* 3. THE STRUCTURE. Multiply by the photograph, rotated to run along the band and scaled
          to still cover after rotation. This is the step that removes the fuzziness: every
          filament and dust lane from here on is measured, not generated. */
    g2.save();
    g2.globalCompositeOperation = 'multiply';
    g2.translate(tw / 2, th / 2);
    g2.rotate(ANG);
    var cover = Math.max(tw / plate.width, th / plate.height) * 1.45;
    g2.imageSmoothingEnabled = true;
    g2.imageSmoothingQuality = 'high';
    g2.drawImage(plate, -plate.width * cover / 2, -plate.height * cover / 2,
                 plate.width * cover, plate.height * cover);
    g2.restore();

    /* 4. CONFINE IT TO ONE BAND. White along the axis, black away from it, multiplied in. */
    g2.save();
    g2.globalCompositeOperation = 'multiply';
    g2.translate(tw / 2, th / 2);
    g2.rotate(ANG);
    var bd = diag * 0.62;
    var band = g2.createLinearGradient(0, -bd, 0, bd);
    band.addColorStop(0.00, '#000000');
    band.addColorStop(0.26, '#3a3a3a');
    band.addColorStop(0.50, '#ffffff');
    band.addColorStop(0.74, '#3a3a3a');
    band.addColorStop(1.00, '#000000');
    g2.fillStyle = band;
    g2.fillRect(-diag, -diag, diag * 2, diag * 2);
    g2.restore();

    /* 5. CLEAR THE MIDDLE, as an ELLIPSE not a circle. The wordmark is a wide, short block;
          a circle big enough to protect its width also scoops out everything above and below
          it and leaves the centre looking empty. */
    g2.save();
    g2.globalCompositeOperation = 'multiply';
    g2.translate(tw / 2, th / 2);
    g2.scale(1, (th * 0.30) / (tw * 0.40));
    var cr = tw * 0.40;
    var clear = g2.createRadialGradient(0, 0, 0, 0, 0, cr);
    clear.addColorStop(0.00, '#000000');
    clear.addColorStop(0.55, '#2b2b2b');
    clear.addColorStop(1.00, '#ffffff');
    g2.fillStyle = clear;
    g2.fillRect(-diag, -diag, diag * 2, diag * 2);
    g2.restore();

    // Black adds nothing under 'lighter', so the dark sky masks itself and the plate never
    // needed an alpha channel.
    target.save();
    target.globalCompositeOperation = 'lighter';
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.drawImage(tmp, 0, 0);
    target.restore();
  }

  // Deterministic star placement, so the with-gas and without-gas bakes hold the SAME stars
  // and the fade does not make the whole field jump.
  var starSeed = 1;
  function srand() {
    starSeed = (starSeed * 1103515245 + 12345) & 0x7fffffff;
    return starSeed / 0x7fffffff;
  }

  function bake(target, withGas) {
    target.setTransform(dpr, 0, 0, dpr, 0, 0);
    target.globalCompositeOperation = 'source-over';

    var base = target.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0,    '#04060c');
    base.addColorStop(0.55, '#070c15');
    base.addColorStop(1,    '#03050a');
    target.fillStyle = base;
    target.fillRect(0, 0, W, H);

    var diag = Math.sqrt(W * W + H * H);
    starSeed = 20260803;

    // The dense faint population. This is the layer that makes the field read as deep.
    var n = Math.min(6000, Math.round((W * H) / 300));
    for (var i = 0; i < n; i++) {
      var x = srand() * W, y = srand() * H;
      var d = Math.abs((x - W / 2) * SA - (y - H / 2) * CA);
      var nb = Math.exp(-Math.pow(d / (diag * 0.19), 2));
      if (srand() > 0.34 + nb * 0.66) continue;
      target.beginPath();
      target.arc(x, y, 0.24 + srand() * 0.58, 0, 6.2832);
      target.fillStyle = 'rgba(' + PALETTE[(srand() * PALETTE.length) | 0] + ',' +
        ((0.16 + srand() * 0.54) * (0.58 + nb * 0.42)).toFixed(3) + ')';
      target.fill();
    }

    if (withGas) paintGasInto(target, W, H);

    // The sparse bright population, each with a halo so it reads as a point source rather
    // than a dot. Drawn after the gas so bright stars sit in front of it.
    target.setTransform(dpr, 0, 0, dpr, 0, 0);
    target.globalCompositeOperation = 'source-over';
    var m = Math.min(300, Math.round((W * H) / 6200));
    for (var k = 0; k < m; k++) {
      var mx = srand() * W, my = srand() * H;
      var md = Math.abs((mx - W / 2) * SA - (my - H / 2) * CA);
      var mb = Math.exp(-Math.pow(md / (diag * 0.24), 2));
      if (srand() > 0.42 + mb * 0.58) continue;
      var col = PALETTE[(srand() * PALETTE.length) | 0];
      var r = 0.7 + srand() * 0.7, a = 0.45 + srand() * 0.45;
      var hg = target.createRadialGradient(mx, my, 0, mx, my, r * 5.5);
      hg.addColorStop(0, 'rgba(' + col + ',' + (a * 0.5).toFixed(3) + ')');
      hg.addColorStop(1, 'rgba(' + col + ',0)');
      target.fillStyle = hg;
      target.fillRect(mx - r * 5.5, my - r * 5.5, r * 11, r * 11);
      target.beginPath();
      target.arc(mx, my, r, 0, 6.2832);
      target.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')';
      target.fill();
    }
  }

  function bakeAll() {
    sceneDry.width = Math.round(W * dpr); sceneDry.height = Math.round(H * dpr);
    bake(dryx, false);
    if (plateReady) {
      sceneWet.width = Math.round(W * dpr); sceneWet.height = Math.round(H * dpr);
      bake(wetx, true);
    }
  }

  // ── the helix ───────────────────────────────────────────────────────────────────────────

  /* The company is called LIMEN Helix and until now there was no helix anywhere on the page.

     FIRST ATTEMPT WAS DOTS, AND DOTS DO NOT WORK. Sampling each strand into discrete points
     reads as a beaded necklace no matter how the points are tuned, because the eye joins
     evenly spaced dots into one dotted line instead of separating them into two strands. It
     also flattened the structure: a single wavy row of beads, not something with a front and
     a back.

     What fixes it is CONTINUITY plus DEPTH CONTRAST. Each strand is stroked as an unbroken
     line, and the near half is drawn several times brighter and thicker than the far half,
     so where the strands cross, one clearly passes in front of the other. That crossing is
     the entire readable content of a helix; without it there is just a wave.

     Segments are batched into short runs sharing one alpha, so a 400-sample strand costs
     about 50 strokes rather than 400.                                                      */
  function drawHelix(t, ox, oy) {
    /* PITCH IS EVERYTHING. At radius 205 with 4.4 turns the loops were wider than they were
       tall, which the eye reads as a row of big overlapping ellipses, a decorative swoosh
       competing with the logo. A real double helix has turns much taller than they are wide.
       Halving the radius and doubling the turn count is what changes it from a swoosh into
       a strand, and it stops fighting the wordmark at the same time. */
    var cy = h * 0.52 + oy;
    var R = Math.min(h * 0.105, 108);
    var span = w * 1.34;
    var x0 = w * 0.5 - span / 2 + ox;
    /* PITCH IS FIXED IN PIXELS, so the turn count has to follow the viewport width. A fixed
       9.2 turns is right on a desktop and collapses on a phone: across 390px it puts a whole
       turn every 57px, which stops reading as a helix and becomes vertical hatching over the
       type. Holding the turn at ~210px wide keeps the same strand at every size, about ten
       turns on a desktop and two and a half on a phone. */
    var TURNS = Math.max(2.2, span / 210);
    var N = Math.round(Math.min(560, Math.max(150, TURNS * 48))), CHUNK = 10;
    var phase = reduce ? 0.9 : t * 0.13;

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function pt(u, off) {
      var an = u * TURNS * 6.2832 + phase + off;
      return {
        x: x0 + u * span,
        y: cy + R * Math.sin(an),
        d: (Math.cos(an) + 1) / 2          // 0 far, 1 near
      };
    }
    // Ends dissolve into the field rather than stopping at the screen edge.
    function edge(u) { return Math.min(1, Math.min(u, 1 - u) * 5.0); }

    // Rungs, drawn first and only on the near face, where a real double helix shows them.
    for (var k = 0; k <= N; k += 8) {
      var u0 = k / N;
      var A = pt(u0, 0), B = pt(u0, Math.PI);
      var md = (A.d + B.d) / 2;
      var ra = 0.038 * edge(u0) * Math.pow(md, 1.8);
      if (ra < 0.004) continue;
      ctx.strokeStyle = 'rgba(150,200,255,' + ra.toFixed(3) + ')';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    }

    // Two passes per strand: a wide soft bloom, then the core line on top.
    for (var pass = 1; pass < 2; pass++) {
      var bloom = pass === 0;
      for (var s = 0; s < 2; s++) {
        var off = s * Math.PI;
        for (var i = 0; i < N; i += CHUNK) {
          var uMid = (i + CHUNK / 2) / N;
          var m = pt(uMid, off);
          var e = edge(uMid);
          // depth^2.2 is what separates the strands. A linear ramp leaves the far strand
          // bright enough to compete, and the crossing stops reading.
          var a = (0.024 + 0.30 * Math.pow(m.d, 2.4)) * e;
          if (bloom) a *= 0.10; else a *= 0.9;
          if (a < 0.004) continue;
          var lw = 0.45 + 1.05 * m.d;
          ctx.lineWidth = bloom ? lw * 4.2 : lw;
          ctx.strokeStyle = 'rgba(' + (m.d > 0.7 ? '245,250,255' : '150,190,240') + ',' + a.toFixed(3) + ')';
          ctx.beginPath();
          for (var j = 0; j <= CHUNK; j++) {
            var p = pt(Math.min(1, (i + j) / N), off);
            if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
      }
    }

    /* A few real stars sitting ON the strand, only at the near crest. These are what stop it
       looking like a drawn line: the helix picks up the same points of light as the rest of
       the field, so it belongs to the sky instead of floating over it. */
    for (var q = 0; q < 2; q++) {
      for (var n = 0; n <= N; n += 18) {
        var uu = n / N;
        var g = pt(uu, q * Math.PI);
        if (g.d < 0.955) continue;
        var ga = 0.42 * edge(uu);
        ctx.beginPath();
        ctx.arc(g.x, g.y, 1.25, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,250,235,' + ga.toFixed(3) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(g.x, g.y, 5.5, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,244,215,' + (ga * 0.10).toFixed(3) + ')';
        ctx.fill();
      }
    }
  }

  // ── the moving stars ────────────────────────────────────────────────────────────────────

  function buildTwinklers() {
    twinklers = []; flares = [];
    var count = Math.min(420, Math.round((w * h) / 3400));
    for (var i = 0; i < count; i++) {
      twinklers.push({
        x: rand(-PAD, w + PAD), y: rand(-PAD, h + PAD),
        r: rand(0.5, 1.5), colour: pick(PALETTE), base: rand(0.35, 1.0),
        /* Two rates that do not divide into each other, so the product never repeats on a
           short cycle. One sine gives every star an obvious metronome; two give irregular
           blinking, which is what the eye reads as a real sky. */
        s1: rand(1.1, 4.2), s2: rand(0.3, 1.3),
        p1: Math.random() * 6.2832, p2: Math.random() * 6.2832,
        amp: Math.random() < 0.34 ? rand(0.75, 1.0) : rand(0.25, 0.6)
      });
    }
    var fcount = Math.min(9, Math.max(3, Math.round((w * h) / 150000)));
    for (var k = 0; k < fcount; k++) {
      flares.push({
        x: rand(w * 0.04, w * 0.96), y: rand(h * 0.04, h * 0.96),
        r: rand(1.1, 1.9), colour: pick(PALETTE), base: rand(0.7, 1.0),
        s1: rand(0.5, 1.6), s2: rand(0.2, 0.6),
        p1: Math.random() * 6.2832, p2: Math.random() * 6.2832,
        amp: rand(0.35, 0.7), spikes: rand(5, 11)
      });
    }
  }

  function twinkle(s, t) {
    if (reduce) return s.base;
    var a = 0.5 - 0.5 * Math.cos(s.s1 * t + s.p1);
    var b = 0.5 - 0.5 * Math.cos(s.s2 * t + s.p2);
    return Math.max(0, Math.min(1, s.base * (1 - s.amp * (1 - a * (0.45 + 0.55 * b)))));
  }

  /* A SATELLITE PASS. Not a shooting star, and the difference is the whole point: this
     crosses in a dead straight line at constant speed over about twenty seconds, where a
     meteor is gone in under one. Anyone who has actually stood outside at night reads it
     immediately, and anyone who does not notice loses nothing.

     Roughly half of them flare. Real satellites do this when a flat surface catches the sun
     square on, and it is a brief smooth swell rather than a twinkle. */
  function spawnSat(t) {
    var dir = Math.random() < 0.5 ? 1 : -1;
    var dur = rand(16, 23);
    sat = {
      x: dir > 0 ? -60 : w + 60,
      y: rand(h * 0.08, h * 0.92),
      vx: dir * (w + 120) / dur,
      vy: rand(-h * 0.16, h * 0.16) / dur,
      born: t,
      ttl: dur,
      flareAt: Math.random() < 0.5 ? rand(0.25, 0.75) : -1,
      flareAmp: rand(0.45, 0.8)
    };
  }

  /* THE ALIEN. Deliberately understated: about eighty pixels, no wobble, no beam, no glow.

     It is drawn in near-black so it OCCLUDES the stars behind it rather than being lit. That
     is what makes it read as a solid object passing in front of the sky instead of a sprite
     pasted on top, and it is why the only bright mark on it is a thin rim highlight along the
     top edge, as if catching light from something far away.

     The intent is that you are not quite sure you saw it. */
  function spawnAlien() {
    var dir = 1;
    var dur = 30;
    alien = {
      x: dir > 0 ? -120 : w + 120,
      y: h * 0.30,
      vx: dir * (w + 240) / dur,
      vy: rand(-10, 10) / dur,
      born: alienClock,
      ttl: dur
    };
  }

  function drawAlien(ax, ay, fade) {
    var hull = 'rgba(5,8,14,' + (0.93 * fade).toFixed(3) + ')';
    ctx.save();
    ctx.translate(ax, ay);
    ctx.beginPath();                                  // hull
    ctx.ellipse(0, 0, 40, 8.5, 0, 0, 6.2832);
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.beginPath();                                  // dome
    ctx.ellipse(0, -5.5, 16, 11, 0, Math.PI, 6.2832);
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.beginPath();                                  // rim light along the top edge only
    ctx.ellipse(0, 0, 40, 8.5, 0, Math.PI * 1.06, Math.PI * 1.94);
    ctx.strokeStyle = 'rgba(158,186,228,' + (0.26 * fade).toFixed(3) + ')';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  function spawnShot(t) {
    var dir = Math.random() < 0.5 ? 1 : -1;
    shooting = {
      x: dir > 0 ? rand(-w * 0.1, w * 0.6) : rand(w * 0.4, w * 1.1),
      y: rand(-h * 0.05, h * 0.45),
      vx: dir * rand(420, 760), vy: rand(200, 380),
      ttl: rand(0.55, 1.0), len: rand(70, 190), born: t
    };
  }

  // ── the frame ───────────────────────────────────────────────────────────────────────────

  function draw(now) {
    var t = (now - t0) / 1000;

    /* The alien runs off its own accumulator rather than off t. t restarts whenever the tab
       is hidden and shown again, so a three minute wait would reset every time you glanced
       at another window. This only advances while the page is actually being drawn, which is
       the behaviour the timer is meant to reward. */
    var dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    if (!reduce) alienClock += dt;

    // Ease toward the pointer rather than tracking it. Instant tracking reads as a jitter
    // attached to the mouse; a lag of about a fifth reads as mass.
    parX += (tgX - parX) * 0.055;
    parY += (tgY - parY) * 0.055;

    if (plateReady && gasFade < 1) gasFade = Math.min(1, gasFade + 0.045);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    var fx = (-PAD + parX * 0.25) * dpr, fy = (-PAD + parY * 0.25) * dpr;
    if (!plateReady || gasFade <= 0) {
      ctx.drawImage(sceneDry, fx, fy);
    } else if (gasFade < 1) {
      ctx.drawImage(sceneDry, fx, fy);
      ctx.globalAlpha = gasFade;
      ctx.drawImage(sceneWet, fx, fy);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(sceneWet, fx, fy);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    var ox = parX, oy = parY, i, s, a;

    for (i = 0; i < twinklers.length; i++) {
      s = twinklers[i];
      a = twinkle(s, t);
      if (a < 0.012) continue;
      ctx.beginPath();
      ctx.arc(s.x + ox, s.y + oy, s.r, 0, 6.2832);
      ctx.fillStyle = 'rgba(' + s.colour + ',' + a.toFixed(3) + ')';
      ctx.fill();
      if (a > 0.6) {
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r * 3.4, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + s.colour + ',' + (a * 0.09).toFixed(3) + ')';
        ctx.fill();
      }
    }

    for (i = 0; i < flares.length; i++) {
      s = flares[i];
      a = twinkle(s, t);
      var L = s.spikes * (0.55 + 0.45 * a);
      var sx = s.x + ox, sy = s.y + oy;
      var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 7);
      g.addColorStop(0, 'rgba(' + s.colour + ',' + (a * 0.95).toFixed(3) + ')');
      g.addColorStop(0.28, 'rgba(' + s.colour + ',' + (a * 0.22).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + s.colour + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - s.r * 7, sy - s.r * 7, s.r * 14, s.r * 14);
      ctx.strokeStyle = 'rgba(' + s.colour + ',' + (a * 0.34).toFixed(3) + ')';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(sx - L, sy); ctx.lineTo(sx + L, sy);
      ctx.moveTo(sx, sy - L); ctx.lineTo(sx, sy + L);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, s.r * 0.85, 0, 6.2832);
      ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.9).toFixed(3) + ')';
      ctx.fill();
    }

    drawHelix(t, ox, oy);

    // Shooting star. Rare on purpose: constant meteors look like a screensaver.
    if (!reduce) {
      if (!shooting && t > nextShot) spawnShot(t);
      if (shooting) {
        var age = t - shooting.born;
        if (age > shooting.ttl) {
          shooting = null;
          nextShot = t + rand(5, 14);
        } else {
          var k = age / shooting.ttl;
          var cx = shooting.x + shooting.vx * age + ox;
          var cy = shooting.y + shooting.vy * age + oy;
          var nx = shooting.vx, ny = shooting.vy;
          var nl = Math.sqrt(nx * nx + ny * ny);
          nx /= nl; ny /= nl;
          var fade = Math.sin(Math.PI * k);
          var tg = ctx.createLinearGradient(cx, cy, cx - nx * shooting.len, cy - ny * shooting.len);
          tg.addColorStop(0, 'rgba(255,255,255,' + (0.9 * fade).toFixed(3) + ')');
          tg.addColorStop(0.35, 'rgba(200,220,255,' + (0.35 * fade).toFixed(3) + ')');
          tg.addColorStop(1, 'rgba(160,190,255,0)');
          ctx.strokeStyle = tg;
          ctx.lineWidth = 1.7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx - nx * shooting.len, cy - ny * shooting.len);
          ctx.stroke();
        }
      }
    }

    // Satellite. Additive, because it is a point of reflected sunlight.
    if (!reduce) {
      if (!sat && t > nextSat) spawnSat(t);
      if (sat) {
        var sAge = t - sat.born;
        if (sAge > sat.ttl) {
          sat = null;
          nextSat = t + rand(35, 80);
        } else {
          var sk = sAge / sat.ttl;
          var sa = 0.30 * Math.min(1, Math.min(sk, 1 - sk) * 14);
          if (sat.flareAt > 0) {
            var fd = (sk - sat.flareAt) / 0.055;
            sa += sat.flareAmp * Math.exp(-fd * fd) * Math.min(1, Math.min(sk, 1 - sk) * 14);
          }
          if (sa > 0.006) {
            var sxp = sat.x + sat.vx * sAge + ox, syp = sat.y + sat.vy * sAge + oy;
            ctx.beginPath();
            ctx.arc(sxp, syp, 1.1, 0, 6.2832);
            ctx.fillStyle = 'rgba(255,250,238,' + sa.toFixed(3) + ')';
            ctx.fill();
            if (sa > 0.45) {
              ctx.beginPath();
              ctx.arc(sxp, syp, 5.5, 0, 6.2832);
              ctx.fillStyle = 'rgba(255,246,220,' + (sa * 0.16).toFixed(3) + ')';
              ctx.fill();
            }
          }
        }
      }
    }

    ctx.globalCompositeOperation = 'source-over';

    // The alien occludes, so it has to be drawn last and NOT additively.
    if (!reduce) {
      if (!alien && alienClock > nextAlien) spawnAlien();
      if (alien) {
        var aAge = alienClock - alien.born;
        if (aAge > alien.ttl) {
          alien = null;
          nextAlien = alienClock + rand(300, 540);
        } else {
          var ak = aAge / alien.ttl;
          drawAlien(alien.x + alien.vx * aAge + ox, alien.y + alien.vy * aAge + oy,
                    Math.min(1, Math.min(ak, 1 - ak) * 9));
        }
      }
    }

    raf = requestAnimationFrame(draw);
  }

  // ── wiring ──────────────────────────────────────────────────────────────────────────────

  function resize() {
    w = window.innerWidth; h = window.innerHeight;

    /* dpr MUST BE A WHOLE NUMBER, and then the canvas gets a pixel budget on top.

       Both halves of this were measured, and the first one is counter-intuitive. Scaling the
       backing store by a fraction to save pixels made things WORSE: at 2560x1440, dpr 1.22
       (5.5M pixels) ran at 20fps while dpr 1 (3.7M pixels) ran at 60. A fractional ratio puts
       every drawImage and every arc onto a resampling path, and that costs far more than the
       pixels it saves. So the only choices are 1 and 2.

       Given whole numbers, the budget picks between them. Measured at 2x: 1440x900 (5.2M
       pixels) holds 60fps, 2560x1440 (14.7M) manages 30. The ceiling below sits above the
       common retina laptop sizes and below the big desktop panels, which is exactly where the
       trade should fall. Only the sky canvas steps down; the wordmark is DOM SVG and keeps
       full device resolution either way, so the type never softens. */
    var raw = window.devicePixelRatio || 1;
    var MAXPX = 4500000;
    dpr = (raw >= 1.8 && w * h * 4 <= MAXPX) ? 2 : 1;
    W = w + PAD * 2; H = h + PAD * 2;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bakeAll();
    buildTwinklers();
  }

  function start() {
    if (raf) cancelAnimationFrame(raf);
    t0 = performance.now();
    nextShot = 3;
    nextSat = rand(1, 2);
    lastFrame = 0;
    raf = requestAnimationFrame(draw);
  }

  /* Parallax from the pointer only. Device orientation was the obvious way to do this on a
     phone, and it is deliberately not used: iOS requires an explicit permission prompt for
     motion, and a holding page asking for sensor access before it has said anything is a
     worse first impression than a still background. Touch devices get the drift below. */
  window.addEventListener('pointermove', function (e) {
    if (reduce) return;
    var nx = (e.clientX / w) * 2 - 1, ny = (e.clientY / h) * 2 - 1;
    tgX = -nx * PAD * 0.62;
    tgY = -ny * PAD * 0.62;
  }, { passive: true });

  // A slow autonomous drift, so the page is alive on a phone and never completely static.
  if (!reduce) {
    setInterval(function () {
      if (Math.abs(tgX) < 0.5 && Math.abs(tgY) < 0.5) {
        tgX = rand(-PAD * 0.3, PAD * 0.3);
        tgY = rand(-PAD * 0.2, PAD * 0.2);
      }
    }, 7000);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    else if (!raf) start();
  });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 160);
  });

  /* The plate is 238 KB, so the sky is painted and running before it arrives and the gas
     fades in when it lands. Nothing waits on the network. If it never arrives, the page is
     still a star field rather than a blank rectangle. */
  plate.onload = function () { plateReady = true; bakeAll(); };
  plate.onerror = function () { plateReady = false; };
  plate.src = '/assets/img/sky-plate.webp';

  resize();
  start();
})();
