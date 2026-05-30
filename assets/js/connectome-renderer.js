// =============================================
// LIMEN HELIX — UNIVERSAL CONNECTOME RENDERER
// Sacred shared renderer — DIRECT COPY of clinical.html canvas logic
// All portal HTML files use this single renderer
// =============================================

var ConnectomeRenderer = (function() {
  'use strict';

  // Phase colors for domain overlays
  var PHASE_COLORS = {
    P0:'#8B5CF6', P1:'#F59E0B', P2:'#10B981', P3:'#EF4444', P4:'#3B82F6',
    P5:'#EC4899', P6:'#06B6D4', P7:'#F97316', P8:'#84CC16', P9:'#A78BFA', P10:'#E2E8F0'
  };
  var PHASE_TAGLINES = {
    P0:'Source / Substrate', P1:'Emergence', P2:'Nourishment', P3:'Formation',
    P4:'Structure', P5:'Movement', P6:'Coordination', P7:'Regulation',
    P8:'Repair', P9:'Identity', P10:'Return'
  };

  // ═══ EXACT SYS_COLORS FROM clinical.html (lines 1262-1281) ═══
  var SYS_COLORS = {
    dmn:        {r:201,g:169,b:78},
    salience:   {r:255,g:180,b:60},
    executive:  {r:80,g:140,b:220},
    limbic:     {r:180,g:50,b:50},
    autonomic:  {r:42,g:107,b:90},
    hpa:        {r:200,g:120,b:40},
    plasticity: {r:100,g:180,b:120},
    gutbrain:   {r:140,g:100,b:160},
    entrainment:{r:180,g:160,b:60},
    reward:     {r:220,g:80,b:80},
    motor:      {r:160,g:80,b:60},
    thalamic:   {r:160,g:160,b:160},
    sensory:    {r:120,g:160,b:180},
    language:   {r:180,g:140,b:100},
    basal:      {r:140,g:120,b:80},
    neuromod:   {r:100,g:140,b:140},
    memory:     {r:160,g:120,b:180},
    other:      {r:120,g:120,b:120}
  };

  // ═══ BIOLOGICALLY ACCURATE EDGE TYPES ═══
  // Myelinated axons: 70-120 m/s → fast, bright, sharp pulse
  // Unmyelinated:     0.5-2 m/s  → slow, dim, diffuse pulse
  var EDGE_TYPES = {
    fast:     {speed:[0.015,0.025], rate:0.025, size:[0.5,0.9],  myelinated:true,  brightness:0.9},
    excit:    {speed:[0.010,0.018], rate:0.030, size:[0.6,1.0],  myelinated:true,  brightness:0.8},
    inhib:    {speed:[0.007,0.013], rate:0.018, size:[0.6,1.0],  myelinated:true,  brightness:0.7},
    modul:    {speed:[0.003,0.006], rate:0.012, size:[1.2,2.0],  myelinated:false, brightness:0.35},
    auto:     {speed:[0.002,0.005], rate:0.010, size:[1.0,1.8],  myelinated:false, brightness:0.3},
    hormonal: {speed:[0.001,0.003], rate:0.005, size:[1.5,2.5],  myelinated:false, brightness:0.2},
    peptide:  {speed:[0.001,0.004], rate:0.006, size:[1.3,2.2],  myelinated:false, brightness:0.25},
    plastic:  {speed:[0.001,0.002], rate:0.003, size:[0.8,1.4],  myelinated:false, brightness:0.15}
  };

  // Domain edge colors (for activation map edges)
  var DOMAIN_EDGE_COLORS = {
    SUPPLIES:{r:16,g:185,b:129}, DEPENDS_ON:{r:59,g:130,b:246},
    TRANSFORMS:{r:234,g:179,b:8}, CONTROLS:{r:249,g:115,b:22}
  };

  // Map domain relationship types to neural speed equivalents
  var DOMAIN_NEURAL_MAP = {
    SUPPLIES: 'excit', DEPENDS_ON: 'modul', TRANSFORMS: 'fast', CONTROLS: 'inhib'
  };

  // ═══ PHASE-BASED IMPULSE COLORS ═══
  // P0-P2: cool blue/teal (bonding, rhythm)
  // P3:    red/orange (fracture, stress)
  // P4-P6: green (stability, order)
  // P7-P9: purple/violet (dissolution, threshold)
  // P10:   gold (resurrection, new topology)
  var PHASE_PULSE_COLORS = {
    P0:  {r:14,  g:165, b:233},
    P1:  {r:6,   g:182, b:212},
    P2:  {r:14,  g:165, b:233},
    P3:  {r:239, g:115, b:70},
    P4:  {r:16,  g:185, b:129},
    P5:  {r:34,  g:197, b:94},
    P6:  {r:16,  g:185, b:129},
    P7:  {r:139, g:92,  b:246},
    P8:  {r:167, g:139, b:250},
    P9:  {r:139, g:92,  b:246},
    P10: {r:234, g:179, b:8}
  };

  // ═══ 3-LAYER NODE SCHEMA — STRESS CONSTANTS ═══
  var STRESS_CHANNELS = ['legal','liquidity','funding','solvency','demand','ops','people'];
  var STRESS_COLORS = {
    legal:{r:148,g:163,b:184}, liquidity:{r:56,g:189,b:248}, funding:{r:234,g:179,b:8},
    solvency:{r:139,g:92,b:246}, demand:{r:34,g:197,b:94}, ops:{r:249,g:115,b:22},
    people:{r:236,g:72,b:153}
  };
  var TAU = Math.PI * 2;

  // ═══ 3-LAYER HELPER FUNCTIONS ═══

  function initPhaseVector(phaseStr) {
    var vec = {};
    for (var i = 0; i <= 10; i++) vec['P' + i] = 0;
    if (phaseStr && vec.hasOwnProperty(phaseStr)) {
      vec[phaseStr] = 0.75;
      var idx = parseInt(phaseStr.slice(1));
      if (idx > 0) vec['P' + (idx - 1)] = 0.08;
      if (idx < 10) vec['P' + (idx + 1)] = 0.08;
      var assigned = 0.75 + (idx > 0 ? 0.08 : 0) + (idx < 10 ? 0.08 : 0);
      var remaining = 1 - assigned;
      var crumbCount = 11 - (1 + (idx > 0 ? 1 : 0) + (idx < 10 ? 1 : 0));
      var crumb = crumbCount > 0 ? remaining / crumbCount : 0;
      for (var i = 0; i <= 10; i++) {
        var k = 'P' + i;
        if (k !== phaseStr && !(idx > 0 && i === idx - 1) && !(idx < 10 && i === idx + 1)) {
          vec[k] = crumb;
        }
      }
    } else {
      for (var i = 0; i <= 10; i++) vec['P' + i] = 1 / 11;
    }
    return vec;
  }

  function computeInstability(vec) {
    var vals = [];
    for (var k in vec) vals.push(vec[k]);
    vals.sort(function(a, b) { return b - a; });
    return 1 - ((vals[0] || 0) - (vals[1] || 0));
  }

  function getDominantPhase(vec) {
    var best = 'P0', bestV = -1;
    for (var k in vec) {
      if (vec[k] > bestV) { bestV = vec[k]; best = k; }
    }
    return best;
  }

  function computeTotalStress(sv) {
    var sum = 0;
    for (var i = 0; i < STRESS_CHANNELS.length; i++) {
      sum += (sv[STRESS_CHANNELS[i]] || 0);
    }
    return sum / STRESS_CHANNELS.length;
  }

  function getPhaseColor(n) {
    var phase = n.dominant_phase || 'P0';
    var c = PHASE_PULSE_COLORS[phase] || PHASE_PULSE_COLORS.P0;
    var inst = n.instability || 0;
    var sat = Math.max(0.2, 1 - inst * 0.8);
    return {
      r: Math.round(120 + (c.r - 120) * sat),
      g: Math.round(120 + (c.g - 120) * sat),
      b: Math.round(120 + (c.b - 120) * sat)
    };
  }

  function drawStressRing(x, y, radius, node, alpha) {
    if (!node || node.total_stress < 0.05) return;
    var sv = node.stress_vector;
    if (!sv) return;
    var segAngle = TAU / 7;
    var ringWidth = 2;
    for (var i = 0; i < STRESS_CHANNELS.length; i++) {
      var ch = STRESS_CHANNELS[i];
      var val = sv[ch] || 0;
      if (val < 0.05) continue;
      var c = STRESS_COLORS[ch];
      var a = val * node.total_stress * alpha;
      ctx.beginPath();
      ctx.arc(x, y, radius + ringWidth, i * segAngle, (i + 1) * segAngle);
      ctx.strokeStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
      ctx.lineWidth = ringWidth;
      ctx.stroke();
    }
  }

  function seedStressPortal(n) {
    var sv = {legal:0, liquidity:0, funding:0, solvency:0, demand:0, ops:0, people:0};
    sv.ops = Math.min((n.diagnosticTriggers || []).length / 6, 1);
    sv.people = Math.min((n.treatments || []).length / 6, 1);
    sv.funding = Math.min(1 - (n.activationWeight || 0), 1);
    var controlsCount = 0, suppliesCount = 0, dependsCount = 0, totalDegree = 0;
    for (var i = 0; i < EDGES.length; i++) {
      var e = EDGES[i];
      if (e.a === n.id || e.b === n.id) {
        totalDegree++;
        if (e.type === 'CONTROLS') controlsCount++;
        if (e.type === 'SUPPLIES') suppliesCount++;
        if (e.type === 'DEPENDS_ON') dependsCount++;
      }
    }
    sv.legal = Math.min(controlsCount / 3, 1);
    sv.liquidity = Math.min(suppliesCount / 4, 1);
    sv.demand = Math.min(totalDegree / 6, 1);
    sv.solvency = Math.min(dependsCount / 3, 1);
    n.stress_vector = sv;
    n.total_stress = computeTotalStress(sv);
  }

  function computeUpwardImpact() {
    for (var i = 0; i < NODE_LIST.length; i++) NODE_LIST[i].upward_impact = 0;
    for (var i = 0; i < EDGES.length; i++) {
      var e = EDGES[i];
      var na = NODES[e.a], nb = NODES[e.b];
      if (na) na.upward_impact += (e.w || 0.3) * (na.total_stress || 0);
      if (nb) nb.upward_impact += (e.w || 0.3) * (nb.total_stress || 0);
    }
  }

  // ═══ STATE — matches clinical.html variable structure ═══
  var canvas, ctx;
  var W, H, CX, CY;
  var DPR = 1;
  var t = 0;
  var hoveredNode = null;
  var selectedNode = null;
  var galaxyAngle = 0;
  var galaxySpeed = 0.0003;

  // Node/edge storage — OBJECT by id (like clinical.html)
  var NODES = {};
  var NODE_LIST = [];
  var EDGES = [];

  // ═══ NEURAL PULSE PARTICLES — EXACT COPY from clinical.html ═══
  var PULSES = [];
  var MAX_PULSES = 200;

  // Activation state
  var activationLoaded = false;
  var activationData = null;
  var activationMap = {};

  // Issue/diagnosis state (mirrors clinical.html's selectedDx)
  var selectedIssue = null;

  // Callbacks
  var onNodeClick = null;
  var onNodeHover = null;

  // ═══ LAYOUT — EXACT COPY from clinical.html (lines 1629-1643) ═══
  function layoutNodes() {
    var vw = canvas.parentElement.clientWidth;
    var vh = canvas.parentElement.clientHeight;
    W = vw; H = vh;
    canvas.width = vw * DPR;
    canvas.height = vh * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = vw / 2;
    CY = vh / 2;
    var R = Math.min(vw, vh) * 0.38;
    var maxRadius = Math.min(vw, vh) * 0.4;
    NODE_LIST.forEach(function(n) {
      var spread = n.radius * R * 1.4;
      if (spread > maxRadius) spread = maxRadius;
      n.x = CX + Math.cos(n.angle) * spread;
      n.y = CY + Math.sin(n.angle) * spread;
    });
  }

  // ═══ NODE COLOR — EXACT LOGIC from clinical.html (lines 1647-1658) ═══
  function getNodeColor(n) {
    if (!selectedIssue) {
      var c = SYS_COLORS[n.sys] || SYS_COLORS.other;
      return {r:c.r, g:c.g, b:c.b, a:0.5};
    }
    if (!n.affected) {
      return {r:80, g:80, b:80, a:0.12};
    }
    var dir = n.affected.dir.toLowerCase();
    if (dir.indexOf('hyper') !== -1 || dir.indexOf('sensitized') !== -1) return {r:232, g:84, b:84, a:0.9};
    if (dir.indexOf('hypo') !== -1 || dir.indexOf('reduced') !== -1 || dir.indexOf('underdeveloped') !== -1) return {r:74, g:143, b:212, a:0.9};
    return {r:212, g:168, b:74, a:0.9}; // altered/other
  }

  // ═══ NEURAL IMPULSE SPAWNING — biologically accurate, phase-aware ═══
  function spawnPulses() {
    EDGES.forEach(function(e) {
      if (PULSES.length >= MAX_PULSES) return;
      var na = NODES[e.a], nb = NODES[e.b];
      if (!na || !nb) return;

      // Resolve neural type for domain edges
      var neuralType = e.type;
      if (DOMAIN_NEURAL_MAP[e.type]) neuralType = DOMAIN_NEURAL_MAP[e.type];
      var et = EDGE_TYPES[neuralType] || EDGE_TYPES.excit;
      var rate = et.rate;

      // Modulate by issue selection
      if (selectedIssue) {
        if (na.affected && nb.affected) rate *= 1.8;
        else if (na.affected || nb.affected) rate *= 0.4;
        else rate *= 0.15;
      }
      // Modulate by activation (portal mode)
      else if (activationLoaded) {
        if (na.activated && nb.activated) {
          rate *= 1.8;
          // Co-activation boost: shared phase archetype = stronger coupling
          if (na.domainPhase && nb.domainPhase && na.domainPhase === nb.domainPhase) {
            rate *= 1.6;
          }
          // Shared functional group = moderate coupling boost
          else if (na.domainGroup && nb.domainGroup && na.domainGroup === nb.domainGroup) {
            rate *= 1.3;
          }
        }
        else if (na.activated || nb.activated) rate *= 0.4;
        else rate *= 0.15;
      }

      if (Math.random() < rate) {
        var dir = Math.random() > 0.5 ? 1 : -1;
        var sMin = et.speed[0], sMax = et.speed[1];
        var szMin = et.size[0], szMax = et.size[1];

        // Determine phase color for this impulse
        var phaseColor = null;
        var phaseA = na.domainPhase || '';
        var phaseB = nb.domainPhase || '';
        if (phaseA && PHASE_PULSE_COLORS[phaseA] && phaseB && PHASE_PULSE_COLORS[phaseB]) {
          // Blend the two phase colors
          var ca = PHASE_PULSE_COLORS[phaseA], cb = PHASE_PULSE_COLORS[phaseB];
          phaseColor = {r: Math.round((ca.r+cb.r)/2), g: Math.round((ca.g+cb.g)/2), b: Math.round((ca.b+cb.b)/2)};
        } else if (phaseA && PHASE_PULSE_COLORS[phaseA]) {
          phaseColor = PHASE_PULSE_COLORS[phaseA];
        } else if (phaseB && PHASE_PULSE_COLORS[phaseB]) {
          phaseColor = PHASE_PULSE_COLORS[phaseB];
        }

        PULSES.push({
          a: e.a, b: e.b, neuralType: neuralType,
          progress: dir > 0 ? 0 : 1,
          speed: (sMin + Math.random() * (sMax - sMin)) * dir,
          size: szMin + Math.random() * (szMax - szMin),
          myelinated: et.myelinated,
          brightness: et.brightness,
          phaseColor: phaseColor,
          life: 1
        });
      }
    });
  }

  // ═══ PULSE DRAWING — biologically accurate neural impulses ═══
  // Myelinated: fast, bright, sharp spark
  // Unmyelinated: slow, dim, diffuse glow
  function drawPulses() {
    for (var i = PULSES.length - 1; i >= 0; i--) {
      var p = PULSES[i];
      p.progress += p.speed;

      if (p.progress > 1 || p.progress < 0) {
        PULSES.splice(i, 1);
        continue;
      }

      var na = NODES[p.a], nb = NODES[p.b];
      if (!na || !nb) { PULSES.splice(i, 1); continue; }

      var px = na.x + (nb.x - na.x) * p.progress;
      var py = na.y + (nb.y - na.y) * p.progress;

      // Color priority: phase color > issue/activation state color > system color
      var c;
      var hasState = selectedIssue ? 'affected' : (activationLoaded ? 'activated' : null);

      if (p.phaseColor && hasState && na[hasState] && nb[hasState]) {
        c = p.phaseColor;
      } else if (hasState && na[hasState] && nb[hasState]) {
        var ca = getNodeColor(na), cb = getNodeColor(nb);
        c = {r: Math.round((ca.r+cb.r)/2), g: Math.round((ca.g+cb.g)/2), b: Math.round((ca.b+cb.b)/2)};
      } else if (hasState && (na[hasState] || nb[hasState])) {
        var src = na[hasState] ? na : nb;
        var sc = getNodeColor(src);
        c = p.phaseColor || sc;
      } else {
        var sca = SYS_COLORS[na.sys] || SYS_COLORS.other;
        var scb = SYS_COLORS[nb.sys] || SYS_COLORS.other;
        c = {r: Math.round((sca.r+scb.r)/2), g: Math.round((sca.g+scb.g)/2), b: Math.round((sca.b+scb.b)/2)};
      }

      var baseAlpha = hasState ? (na[hasState] && nb[hasState] ? 0.7 : 0.15) : 0.3;
      var edgeFade = Math.min(p.progress * 5, (1 - p.progress) * 5, 1);
      var alpha = baseAlpha * edgeFade * p.brightness;

      if (p.myelinated) {
        // Myelinated: sharp, bright spark — crisp dot
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, TAU);
        ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
        ctx.fill();
        // Bright core
        if (alpha > 0.3) {
          ctx.beginPath();
          ctx.arc(px, py, p.size * 0.4, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.4) + ')';
          ctx.fill();
        }
      } else {
        // Unmyelinated: diffuse glow — soft radial gradient
        var glowR = p.size * 2.5;
        var grad = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        grad.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (alpha * 0.8) + ')');
        grad.addColorStop(0.5, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (alpha * 0.3) + ')');
        grad.addColorStop(1, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)');
        ctx.beginPath();
        ctx.arc(px, py, glowR, 0, TAU);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
  }

  // ═══ HIT TESTING — EXACT COPY from clinical.html (lines 1756-1764) ═══
  function getMouseNode(mx, my) {
    var best = null, bestD = 20;
    NODE_LIST.forEach(function(n) {
      // All 111 nodes always interactive
      var dx = mx - n.x, dy = my - n.y;
      var d = Math.sqrt(dx*dx + dy*dy);
      var hitR = Math.max(n.size * 2, 12);
      if (d < hitR && d < bestD) { best = n; bestD = d; }
    });
    return best;
  }

  // ═══ MAIN DRAW LOOP — EXACT COPY from clinical.html (lines 1664-1753) ═══
  function draw() {
    t += 0.016;
    galaxyAngle += galaxySpeed;
    ctx.clearRect(0, 0, W, H);

    // Determine which state property to check for highlights
    var stateKey = selectedIssue ? 'affected' : (activationLoaded ? 'activated' : null);

    // Update node positions with rotation — tightened cluster layout
    var R = Math.min(W, H) * 0.38;
    var maxRadius = Math.min(W, H) * 0.4;
    NODE_LIST.forEach(function(n) {
      var a = n.angle + galaxyAngle;
      var spread = n.radius * R * 1.4;
      if (spread > maxRadius) spread = maxRadius;
      n.x = CX + Math.cos(a) * spread;
      n.y = CY + Math.sin(a) * spread;
    });

    // Draw edges — EXACT clinical.html (lines 1677-1695)
    EDGES.forEach(function(e) {
      var a = NODES[e.a], b = NODES[e.b];
      if (!a || !b) return;
      var ca = getNodeColor(a);
      var cb = getNodeColor(b);
      var alpha = 0.06;
      if (selectedIssue) {
        if (a.affected && b.affected) alpha = 0.2;
        else if (a.affected || b.affected) alpha = 0.06;
        else alpha = 0.02;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(' + Math.round((ca.r+cb.r)/2) + ',' + Math.round((ca.g+cb.g)/2) + ',' + Math.round((ca.b+cb.b)/2) + ',' + alpha + ')';
      ctx.lineWidth = selectedIssue && a.affected && b.affected ? 1.5 : 0.5;
      ctx.stroke();
    });

    // Spawn and draw neural pulses — EXACT clinical.html
    spawnPulses();
    drawPulses();

    // Draw nodes — EXACT clinical.html (lines 1701-1750)
    NODE_LIST.forEach(function(n) {
      var c = getNodeColor(n);
      var sz = n.size;
      var isHovered = (hoveredNode === n);

      if (selectedIssue && n.affected) {
        var pulse = 1 + Math.sin(t * 2 + n.angle * 5) * 0.15;
        sz *= pulse * 1.3;

        var grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, sz * 4);
        grad.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.2)');
        grad.addColorStop(1, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)');
        ctx.beginPath();
        ctx.arc(n.x, n.y, sz * 4, 0, TAU);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      if (isHovered) sz *= 1.5;

      // Node circle — EXACT clinical.html (lines 1724-1728)
      ctx.beginPath();
      ctx.arc(n.x, n.y, sz, 0, TAU);
      ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + c.a + ')';
      ctx.fill();

      // Stroke — EXACT clinical.html (lines 1730-1734)
      if (isHovered || (selectedIssue && n.affected)) {
        ctx.strokeStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + Math.min(c.a + 0.3, 1) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label — EXACT clinical.html (lines 1736-1749)
      if (sz > 2.5 || isHovered || (selectedIssue && n.affected)) {
        var labelAlpha = selectedIssue ? (n.affected ? 0.8 : 0.1) : 0.35;
        if (isHovered) labelAlpha = 1;
        ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + labelAlpha + ')';
        var fontSize = Math.max(7, Math.min(sz * 1.3, 13));
        ctx.font = (sz > 5 ? '500 ' : '') + fontSize + 'px IBM Plex Mono';
        ctx.textAlign = 'center';
        var labelOffset = sz > 8 ? sz + 18 : sz + 10;
        var lines = n.label.split('\n');
        lines.forEach(function(line, i) {
          ctx.fillText(line, n.x, n.y + labelOffset + i * (fontSize + 2));
        });
      }
    });

    // ═══ BIOSENSOR VIZ OVERLAY — additive modulation, graceful no-op if disabled ═══
    _applyBioViz(t);

    requestAnimationFrame(draw);
  }

  // Biosensor visualization modulation
  // Reads window.LIMENBiosensor.viz if available.
  // Applies subtle visual effects on top of standard clinical.html rendering.
  // All effects lerp smoothly and degrade to zero when biosensor is off.
  var _bioViz = { nodeActivity: 0, chaos: 0, fireRate: 0, colorShift: 0, pulseRate: 1 };
  var _bioVizEnabled = true;

  function _applyBioViz(time) {
    if (!_bioVizEnabled) return;
    var bio = window.LIMENBiosensor;
    if (!bio || !bio.active || !bio.viz) {
      // Lerp back to neutral when no biosensor
      _bioViz.nodeActivity *= 0.95;
      _bioViz.chaos *= 0.95;
      _bioViz.fireRate *= 0.95;
      _bioViz.colorShift *= 0.95;
      _bioViz.pulseRate += (1 - _bioViz.pulseRate) * 0.05;
      if (Math.abs(_bioViz.nodeActivity) < 0.001) return; // fully neutral, skip
    } else {
      var v = bio.viz;
      // Lerp toward target (smooth 2-second time constant at ~60fps → alpha ~0.008)
      var alpha = 0.008;
      _bioViz.nodeActivity += (v.nodeActivity - _bioViz.nodeActivity) * alpha;
      _bioViz.chaos += (v.chaos - _bioViz.chaos) * alpha;
      _bioViz.fireRate += (v.fireRate - _bioViz.fireRate) * alpha;
      _bioViz.colorShift += ((v.colorShift || 0) - _bioViz.colorShift) * alpha;
      _bioViz.pulseRate += ((v.pulseRate || 1) - _bioViz.pulseRate) * alpha;
    }

    // Apply effects to nodes
    var nAct = _bioViz.nodeActivity;
    var chaos = _bioViz.chaos;
    var cShift = _bioViz.colorShift;
    var pRate = _bioViz.pulseRate;
    if (Math.abs(nAct) < 0.005 && Math.abs(chaos) < 0.005 && Math.abs(cShift) < 0.005) return;

    NODE_LIST.forEach(function(n) {
      // nodeActivity → brightness boost (additive glow, max ±10% size)
      var sizeDelta = nAct * 0.1 * n.size;
      // chaos → subtle position jitter (max ±1.5px)
      var jitterX = chaos * (Math.sin(time * 7.3 + n.angle * 13) * 1.5);
      var jitterY = chaos * (Math.cos(time * 5.7 + n.angle * 11) * 1.5);
      // pulseRate → breathing effect on node alpha
      var breathe = Math.sin(time * pRate * 1.5 + n.angle) * 0.04 * Math.abs(nAct);

      if (Math.abs(sizeDelta) < 0.05 && Math.abs(jitterX) < 0.1 && Math.abs(breathe) < 0.002) return;

      var c = SYS_COLORS[n.sys] || SYS_COLORS.other;
      // colorShift: -1 = cooler (blue tint), +1 = warmer (red tint)
      var r = c.r, g = c.g, b = c.b;
      if (cShift > 0.01) { r = Math.min(255, r + cShift * 30); b = Math.max(0, b - cShift * 15); }
      else if (cShift < -0.01) { b = Math.min(255, b - cShift * 30); r = Math.max(0, r + cShift * 15); }

      var bioAlpha = 0.08 + breathe;
      if (bioAlpha < 0.01) return;

      // Draw subtle bio-overlay glow
      ctx.beginPath();
      ctx.arc(n.x + jitterX, n.y + jitterY, n.size + sizeDelta, 0, TAU);
      ctx.fillStyle = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + Math.max(0, Math.min(bioAlpha, 0.15)) + ')';
      ctx.fill();
    });
  }

  // ═══ BUILD FROM BASE JSON ═══
  function buildFromBase(base) {
    NODES = {};
    NODE_LIST = [];
    EDGES = [];

    // Create nodes — same structure as clinical.html's addNode()
    for (var i = 0; i < base.nodes.length; i++) {
      var bn = base.nodes[i];
      var n = {
        id: bn.id,
        label: bn.label,
        sys: bn.system,
        angle: bn.angle || 0,
        radius: bn.radius || 0,
        size: bn.size || 4,
        x: 0, y: 0,
        activated: false,
        affected: null,       // issue circuit data: {dir, detail, evidence}
        domainLabel: null,
        domainDescription: null,
        domainFunction: null,
        domainPhase: null,
        domainGroup: null,
        childPortal: null,
        activationWeight: 0,
        diagnosticTriggers: [],
        treatments: [],
        whyThisNode: null,
        brainLabel: bn.label,
        brainFunction: bn.brainFunction || null,
        phase_vector: {},
        dominant_phase: '',
        stress_vector: {legal:0,liquidity:0,funding:0,solvency:0,demand:0,ops:0,people:0},
        total_stress: 0,
        instability: 0,
        upward_impact: 0
      };
      NODES[bn.id] = n;
      NODE_LIST.push(n);
    }

    // Create edges — same structure as clinical.html's addTypedEdge()
    if (base.edges) {
      for (var i = 0; i < base.edges.length; i++) {
        var e = base.edges[i];
        if (NODES[e.source] && NODES[e.target]) {
          EDGES.push({a: e.source, b: e.target, w: 0.3, type: e.type || 'excit', isDomainEdge: false});
        }
      }
    }

    // Apply activation if already loaded
    if (activationData) {
      applyActivationInternal();
    }
  }

  // ═══ APPLY ACTIVATION MAP ═══
  function applyActivationInternal() {
    if (!activationData || !activationData.activations) return;
    activationMap = {};

    var acts = activationData.activations;
    for (var i = 0; i < acts.length; i++) {
      var act = acts[i];
      var n = NODES[act.brainNodeId];
      if (!n) continue;
      n.activated = true;
      n.domainLabel = act.domainLabel || null;
      n.domainDescription = act.domainDescription || '';
      n.domainFunction = act.domainFunction || '';
      n.domainPhase = act.phase || '';
      n.domainGroup = act.group || '';
      n.childPortal = act.childPortal || null;
      n.activationWeight = act.weight || 0.5;
      n.diagnosticTriggers = act.diagnosticTriggers || [];
      n.treatments = act.treatments || [];
      n.whyThisNode = act.whyThisNode || null;
      n.phase_vector = initPhaseVector(n.domainPhase);
      n.dominant_phase = getDominantPhase(n.phase_vector);
      n.instability = computeInstability(n.phase_vector);
      seedStressPortal(n);
      activationMap[act.brainNodeId] = act;
    }

    // Add domain edges
    if (activationData.edges) {
      for (var i = 0; i < activationData.edges.length; i++) {
        var e = activationData.edges[i];
        if (NODES[e.source] && NODES[e.target]) {
          EDGES.push({a: e.source, b: e.target, w: e.weight || 0.5, type: e.type || 'excit', isDomainEdge: true});
        }
      }
    }

    activationLoaded = true;
    computeUpwardImpact();
  }

  // ═══ ISSUE SELECTION — mirrors clinical.html's selectDx/clearDx ═══
  function selectIssueInternal(issue) {
    // Clear any previous affected states
    NODE_LIST.forEach(function(n) { n.affected = null; });

    selectedIssue = issue;

    if (!issue || !issue.circuits) return;

    // Set n.affected on matching nodes
    for (var i = 0; i < issue.circuits.length; i++) {
      var circ = issue.circuits[i];
      var n = NODES[circ.nodeId];
      if (n) {
        n.affected = {
          dir: circ.dir,
          detail: circ.detail,
          evidence: circ.evidence
        };
      }
    }
  }

  function clearIssueInternal() {
    selectedIssue = null;
    NODE_LIST.forEach(function(n) { n.affected = null; });
  }

  // ═══ MOUSE EVENTS — EXACT COPY from clinical.html ═══
  function setupMouse() {
    canvas.addEventListener('mousemove', function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var n = getMouseNode(mx, my);
      if (n !== hoveredNode) {
        hoveredNode = n;
        canvas.style.cursor = n ? 'pointer' : 'default';
        if (onNodeHover) onNodeHover(n);
      }
    });

    canvas.addEventListener('mouseleave', function() {
      hoveredNode = null;
      canvas.style.cursor = 'default';
      if (onNodeHover) onNodeHover(null);
    });

    canvas.addEventListener('click', function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var n = getMouseNode(mx, my);

      if (n) {
        selectedNode = n;
        if (onNodeClick) onNodeClick(n, getNodeIndex(n));
      } else {
        selectedNode = null;
        if (onNodeClick) onNodeClick(null, -1);
      }
    });
  }

  function getNodeIndex(node) {
    for (var i = 0; i < NODE_LIST.length; i++) {
      if (NODE_LIST[i] === node) return i;
    }
    return -1;
  }

  // ═══ PUBLIC API ═══
  return {
    SYS_COLORS: SYS_COLORS,
    PHASE_COLORS: PHASE_COLORS,
    PHASE_TAGLINES: PHASE_TAGLINES,
    STRESS_CHANNELS: STRESS_CHANNELS,
    STRESS_COLORS: STRESS_COLORS,
    PHASE_PULSE_COLORS: PHASE_PULSE_COLORS,

    init: function(opts) {
      canvas = document.getElementById(opts.canvasId);
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      onNodeClick = opts.onNodeClick || null;
      onNodeHover = opts.onNodeHover || null;

      layoutNodes();
      setupMouse();
      window.addEventListener('resize', layoutNodes);
      draw();
    },

    // Load the universal brain base
    loadBase: function(url, callback) {
      fetch(url)
        .then(function(r) { if (!r.ok) throw new Error('not found'); return r.json(); })
        .then(function(data) {
          buildFromBase(data);
          layoutNodes();
          if (callback) callback(data);
        })
        .catch(function(err) { console.error('ConnectomeRenderer: Failed to load base', url, err); });
    },

    // Load activation map from URL
    loadActivation: function(url, callback) {
      fetch(url)
        .then(function(r) { if (!r.ok) throw new Error('not found'); return r.json(); })
        .then(function(data) {
          activationData = data;
          if (Object.keys(NODES).length > 0) {
            applyActivationInternal();
          }
          if (callback) callback(data);
        })
        .catch(function(err) { console.error('ConnectomeRenderer: Failed to load activation', url, err); });
    },

    // Apply activation data directly
    applyActivation: function(data) {
      activationData = data;
      if (Object.keys(NODES).length > 0) {
        applyActivationInternal();
      }
    },

    // Issue/diagnosis selection (mirrors clinical.html's selectDx/clearDx)
    selectIssue: function(issue) {
      selectIssueInternal(issue);
    },

    clearIssue: function() {
      clearIssueInternal();
    },

    getSelectedIssue: function() {
      return selectedIssue;
    },

    select: function(idx) {
      selectedNode = (idx >= 0 && idx < NODE_LIST.length) ? NODE_LIST[idx] : null;
    },

    deselect: function() { selectedNode = null; },

    centerOn: function(idx) {
      // No camera in clinical.html — no-op for visual parity
    },

    setViewMode: function(mode) {
      // No view mode switching — clinical.html has one view
    },

    getNodes: function() { return NODE_LIST; },
    getEdges: function() {
      // Return edges with ai/bi indices for portal-ui.js compatibility
      var result = [];
      for (var i = 0; i < EDGES.length; i++) {
        var e = EDGES[i];
        var ai = getNodeIndex(NODES[e.a]);
        var bi = getNodeIndex(NODES[e.b]);
        result.push({ai: ai, bi: bi, type: e.type, weight: e.w, isDomainEdge: e.isDomainEdge});
      }
      return result;
    },
    getActivationMap: function() { return activationMap; },
    getActivatedNodes: function() {
      var result = [];
      for (var i = 0; i < NODE_LIST.length; i++) {
        if (NODE_LIST[i].activated) result.push({node: NODE_LIST[i], index: i});
      }
      return result;
    },

    // 3-Layer schema public API
    getPhaseVector: function(nodeId) { var n = NODES[nodeId]; return n ? n.phase_vector : null; },
    getStressVector: function(nodeId) { var n = NODES[nodeId]; return n ? n.stress_vector : null; },
    getTotalStress: function(nodeId) { var n = NODES[nodeId]; return n ? n.total_stress : 0; },
    getUpwardImpact: function(nodeId) { var n = NODES[nodeId]; return n ? n.upward_impact : 0; },
    getInstability: function(nodeId) { var n = NODES[nodeId]; return n ? n.instability : 0; },
    setStressVector: function(nodeId, sv) {
      var n = NODES[nodeId]; if (!n) return;
      n.stress_vector = sv;
      n.total_stress = computeTotalStress(sv);
      computeUpwardImpact();
    },
    setPhaseVector: function(nodeId, pv) {
      var n = NODES[nodeId]; if (!n) return;
      n.phase_vector = pv;
      n.dominant_phase = getDominantPhase(pv);
      n.instability = computeInstability(pv);
    },

    // Biosensor visualization control
    setBioVizEnabled: function(enabled) { _bioVizEnabled = !!enabled; },
    isBioVizEnabled: function() { return _bioVizEnabled; },

    destroy: function() {
      window.removeEventListener('resize', layoutNodes);
    }
  };
})();
