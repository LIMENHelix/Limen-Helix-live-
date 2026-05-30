/**
 * domain-connectome-map.js
 * LIMEN HELIX — Domain Connectome Map
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Visual force-directed map of domain relationships.
 * Purely observational — no controls that alter system state.
 *
 * Renders as static SVG. Uses D3 if available, otherwise static fallback.
 * Positioned fixed bottom-right, 320x320px, collapsible.
 *
 * Load order: after narrative-memory.js
 */

(function () {
  'use strict';

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];

  var DOMAIN_LABELS = {
    economy: 'ECON',
    energy: 'ENRGY',
    environment: 'ENVIR',
    health: 'HLTH',
    technology: 'TECH',
    research: 'RSRCH',
    supplyChain: 'SUPPLY',
    governance: 'GOV',
    infrastructure: 'INFRA',
    agriculture: 'AGRI',
    industry: 'INDUST',
    education: 'EDU',
    communication: 'COMM',
    culture: 'CULT',
    defense: 'DEF',
    religion: 'RELIG',
    population: 'POP',
    law: 'LAW',
    finance: 'FIN',
    intelligence: 'INTEL'
  };

  // Circular layout positions (center at 160,160, radius 110)
  var POSITIONS = {};
  for (var i = 0; i < DOMAIN_KEYS.length; i++) {
    var angle = (2 * Math.PI * i / DOMAIN_KEYS.length) - Math.PI / 2;
    POSITIONS[DOMAIN_KEYS[i]] = {
      x: 160 + Math.cos(angle) * 110,
      y: 160 + Math.sin(angle) * 110
    };
  }

  // ─── Structural edges from civilization.top.json ────────────────────────
  // Runtime key translations: science→research, medicine→health, trade→supplyChain

  var STRUCTURAL_EDGES = [
    { source: 'governance',     target: 'economy' },
    { source: 'economy',        target: 'infrastructure' },
    { source: 'infrastructure', target: 'energy' },
    { source: 'energy',         target: 'agriculture' },
    { source: 'agriculture',    target: 'industry' },
    { source: 'industry',       target: 'research' },        // science→research
    { source: 'research',       target: 'health' },           // science→medicine = research→health
    { source: 'health',         target: 'education' },         // medicine→education = health→education
    { source: 'education',      target: 'technology' },
    { source: 'technology',     target: 'communication' },
    { source: 'communication',  target: 'culture' },
    { source: 'culture',        target: 'defense' },
    { source: 'defense',        target: 'environment' },
    { source: 'environment',    target: 'religion' },
    { source: 'religion',       target: 'population' },
    { source: 'population',     target: 'supplyChain' },      // population→trade = population→supplyChain
    { source: 'supplyChain',    target: 'law' },               // trade→law = supplyChain→law
    { source: 'law',            target: 'finance' },
    { source: 'finance',        target: 'intelligence' },
    { source: 'intelligence',   target: 'governance' },
    // Cross-links
    { source: 'energy',         target: 'industry' },
    { source: 'research',       target: 'technology' },        // science→technology
    { source: 'education',      target: 'research' },          // education→science
    { source: 'law',            target: 'governance' },
    { source: 'finance',        target: 'economy' },
    { source: 'health',         target: 'population' },        // medicine→population
    { source: 'agriculture',    target: 'population' },
    { source: 'intelligence',   target: 'defense' },
    { source: 'environment',    target: 'energy' },
    { source: 'technology',     target: 'finance' }
  ];

  // ─── Color mapping ──────────────────────────────────────────────────────

  function _stressColor(stress) {
    if (stress > 0.65) return '#E05C3A';   // high — red
    if (stress > 0.40) return '#D4AF37';   // medium — gold
    return '#6B8FA3';                       // low — muted blue
  }

  // ─── State ───────────────────────────────────────────────────────────────

  var containerEl = null;
  var svgEl = null;
  var toggleBtn = null;
  var isCollapsed = true;

  // ─── UI construction ─────────────────────────────────────────────────────

  function _ensureContainer() {
    if (containerEl) return;

    containerEl = document.createElement('div');
    containerEl.id = 'limen-connectome-map';
    containerEl.style.cssText = [
      'position:fixed',
      'bottom:50px',
      'right:12px',
      'width:320px',
      'height:320px',
      'background:rgba(8,9,12,0.92)',
      'border:1px solid rgba(201,169,78,0.15)',
      'border-radius:3px',
      'z-index:1000',
      'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
      'display:none',
      'overflow:hidden'
    ].join(';');

    // DOMAINS toggle button removed — connectome map is now opened via the
    // global top bar's CONNECTOME menu item (assets/js/limen-topbar.js).
    // The container is still appended for any direct callers of _render().
    document.body.appendChild(containerEl);
  }

  // ─── SVG rendering ───────────────────────────────────────────────────────

  function _render() {
    _ensureContainer();
    if (isCollapsed) return;

    var domains = window.LIMENDomains || {};
    var crossDomain = window.LIMENCrossDomain || {};
    var active = crossDomain.active || [];

    // Build SVG string
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" style="background:transparent">';

    // Title
    svg += '<text x="160" y="18" text-anchor="middle" fill="rgba(201,169,78,0.5)" font-family="IBM Plex Mono,monospace" font-size="9" letter-spacing="2">DOMAIN CONNECTOME</text>';

    // Structural edges — baseline connections from civilization connectome
    for (var se = 0; se < STRUCTURAL_EDGES.length; se++) {
      var edge = STRUCTURAL_EDGES[se];
      var seA = POSITIONS[edge.source];
      var seB = POSITIONS[edge.target];
      if (seA && seB) {
        svg += '<line x1="' + seA.x + '" y1="' + seA.y + '" x2="' + seB.x + '" y2="' + seB.y + '" stroke="rgba(201,169,78,0.08)" stroke-width="1"/>';
      }
    }

    // Active edges — highlighted for runtime cross-domain patterns
    for (var e = 0; e < active.length; e++) {
      var pattern = active[e];
      var posA = POSITIONS[pattern.domains[0]];
      var posB = POSITIONS[pattern.domains[1]];
      if (posA && posB) {
        var thickness = Math.max(1, Math.min(4, Math.round(pattern.confidence * 4)));
        var edgeColor = pattern.type === 'risk' ? 'rgba(232,84,58,0.4)' : 'rgba(201,169,78,0.3)';
        svg += '<line x1="' + posA.x + '" y1="' + posA.y + '" x2="' + posB.x + '" y2="' + posB.y + '" stroke="' + edgeColor + '" stroke-width="' + thickness + '"/>';
      }
    }

    // Nodes
    for (var n = 0; n < DOMAIN_KEYS.length; n++) {
      var key = DOMAIN_KEYS[n];
      var d = domains[key] || {};
      var stress = d.stress || 0;
      var pos = POSITIONS[key];
      var radius = Math.max(8, Math.min(24, Math.round(8 + stress * 16)));
      var color = _stressColor(stress);
      var label = DOMAIN_LABELS[key];
      var pct = Math.round(stress * 100);

      // Node circle
      svg += '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + radius + '" fill="' + color + '" opacity="0.7"/>';

      // Glow for high stress
      if (stress > 0.5) {
        svg += '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + (radius + 4) + '" fill="none" stroke="' + color + '" stroke-width="1" opacity="0.3"/>';
      }

      // Label
      svg += '<text x="' + pos.x + '" y="' + (pos.y + radius + 14) + '" text-anchor="middle" fill="rgba(200,195,184,0.6)" font-family="IBM Plex Mono,monospace" font-size="8" letter-spacing="1">' + label + '</text>';

      // Percentage
      svg += '<text x="' + pos.x + '" y="' + (pos.y + 3) + '" text-anchor="middle" fill="rgba(200,195,184,0.8)" font-family="IBM Plex Mono,monospace" font-size="8">' + pct + '</text>';
    }

    svg += '</svg>';

    containerEl.innerHTML = svg;
  }

  // ─── Pulse animation on stress change ────────────────────────────────────

  var _prevStress = {};

  function _checkPulse() {
    var domains = window.LIMENDomains || {};
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var key = DOMAIN_KEYS[i];
      var d = domains[key] || {};
      var curr = d.stress || 0;
      var prev = _prevStress[key] || 0;

      if (Math.abs(curr - prev) > 0.1 && !isCollapsed) {
        _render(); // Re-render to reflect change
        break;     // One re-render is enough
      }
      _prevStress[key] = curr;
    }
  }

  // ─── Event listeners ─────────────────────────────────────────────────────

  function _onUpdate() {
    _checkPulse();
    if (!isCollapsed) _render();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    _ensureContainer();
    window.addEventListener('limen:world-signals-updated', _onUpdate);
    window.addEventListener('limen:domain-update', _onUpdate);
  }

  function stop() {
    window.removeEventListener('limen:world-signals-updated', _onUpdate);
    window.removeEventListener('limen:domain-update', _onUpdate);
    if (containerEl) containerEl.style.display = 'none';
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENDomainMap = {
    start: start,
    stop: stop,
    render: _render,
    toggle: function () {
      _ensureContainer();
      isCollapsed = !isCollapsed;
      containerEl.style.display = isCollapsed ? 'none' : 'block';
      if (!isCollapsed) _render();
    }
  };

})();
