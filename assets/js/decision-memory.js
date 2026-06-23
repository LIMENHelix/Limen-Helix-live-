/**
 * decision-memory.js
 * LIMEN HELIX — Decision Memory
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Tracks recent user choices (domain focus, action type) and emits
 * concentration signals when repeated attention patterns emerge.
 *
 * Depends on: window.LIMENGlobalState, window.LIMENCrossDomain
 * Listens: limen:user-action
 * Emits: limen:decision-memory-update, limen:phase-change (concentration)
 * Output: window.LIMENDecisionMemory
 *
 * Load order: after event-narrator.js
 */

(function () {
  'use strict';

  var MAX_ENTRIES = 20;
  var CONCENTRATION_THRESHOLD = 3; // same domain N times triggers narrator
  var CONCENTRATION_COOLDOWN = 120000; // 2 min between concentration narrations
  var CHECK_MS = 10000;
  var INFRA_STACK_THRESHOLD = 2; // a vulnerability stack seen N times signals concentration
  var INFRA_STACK_COOLDOWN = 180000; // 3 min between infra-stack narrations

  // ─── Infrastructure vulnerability-stack semantics ─────────────────────────
  // CIVIL domain-semantic concentration. Generic (domain, action) frequency only
  // says WHERE the operator is looking; for infrastructure we also detect WHAT
  // vulnerability STACK the attention concentrates on. Each stack is a co-occurring
  // pair of civil signal families (roads/bridges/water mains/the electric grid/
  // transit/dams-levees/cyber-physical SCADA/deferred maintenance/capital funding).
  // Mirrors the infrastructure-brain cross-domain conditions:
  //   SUPPLY_CHAIN_BOTTLENECK + MAINTENANCE_DEFICIT  → supply-side vulnerability
  //   MAINTENANCE_DEFICIT + CYBER_PHYSICAL_ATTACK    → cyber-resilient capital squeeze
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  var INFRA_SIGNAL_TOKENS = {
    MAINTENANCE_DEFICIT:      /(maintenance|deferred|backlog|asset[_\s-]?deterioration|asset[_\s-]?condition|inspection[_\s-]?fail|structural[_\s-]?stress|aging[_\s-]?infrastructure)/i,
    FUNDING_COLLAPSE:         /(funding|fiscal|budget[_\s-]?cut|capital[_\s-]?ration|capex|municipal[_\s-]?bond|bond[_\s-]?market|federal[_\s-]?grant|fiscal[_\s-]?crisis)/i,
    CYBER_PHYSICAL_ATTACK:    /(cyber|scada|ics|cisa|kev|cve|nvd|ransomware|exploit|advisor|physical[_\s-]?sabotage)/i,
    SUPPLY_CHAIN_BOTTLENECK:  /(supply[_\s-]?chain|materials[_\s-]?shortage|logistics|construction[_\s-]?delay|interconnection[_\s-]?delay|transformer[_\s-]?backlog)/i,
    GRID_DEGRADATION:         /(grid|transmission|distribution|substation|transformer|reserve[_\s-]?margin|utility[_\s-]?fail)/i,
    TRANSPORT_DISRUPTION:     /(road|bridge|highway|transit|port|rail|modal[_\s-]?shift|last[_\s-]?mile|congestion)/i,
    DAM_LEVEE_RISK:           /(dam|levee|floodwall|spillway|reservoir|breach)/i
  };

  // Vulnerability STACKS — ordered token pairs with a civil interpretation. Each
  // describes an operator-concentration meaning specific to an infrastructure
  // vulnerability stack (NOT energy oil/gas/nuclear/datacenter content).
  var INFRA_VULN_STACKS = [
    { id: 'CAPITAL_RATIONING',     signals: ['MAINTENANCE_DEFICIT', 'FUNDING_COLLAPSE'],
      body: 'Operator attention concentrates on the deferred-maintenance + funding-collapse stack — a capital-rationing posture across the civil asset base.' },
    { id: 'CYBER_RESILIENT_SQUEEZE', signals: ['CYBER_PHYSICAL_ATTACK', 'MAINTENANCE_DEFICIT'],
      body: 'Operator attention concentrates on the cyber-physical + deferred-maintenance stack — a capital squeeze on cyber-resilient (SCADA/ICS) upgrade spending.' },
    { id: 'SUPPLY_SIDE_VULNERABILITY', signals: ['CYBER_PHYSICAL_ATTACK', 'SUPPLY_CHAIN_BOTTLENECK'],
      body: 'Operator attention concentrates on the cyber-physical + supply-chain stack — focus on supply-side vulnerability of the build/repair pipeline.' },
    { id: 'GRID_FUNDING_STRESS',   signals: ['GRID_DEGRADATION', 'FUNDING_COLLAPSE'],
      body: 'Operator attention concentrates on the grid-degradation + funding-collapse stack — transmission/distribution reliability under capital constraint.' },
    { id: 'TRANSPORT_MAINTENANCE_GAP', signals: ['TRANSPORT_DISRUPTION', 'MAINTENANCE_DEFICIT'],
      body: 'Operator attention concentrates on the transport-disruption + deferred-maintenance stack — roads/bridges/transit assets past condition thresholds.' }
  ];

  // ─── State ───────────────────────────────────────────────────────────────

  var _entries = [];
  var _lastConcentrationTime = 0;
  var _lastConcentrationDomain = null;
  var _lastInfraStackTime = 0;
  var _lastInfraStackId = null;
  var _interval = null;

  // Detect which civil signal families a user-action references, by scanning its
  // free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical infrastructure signal ids. Never fabricates — empty if nothing matches.
  function _detectInfraSignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in INFRA_SIGNAL_TOKENS) {
      if (INFRA_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // ─── Record decision ─────────────────────────────────────────────────────

  function _onUserAction(e) {
    var detail = e.detail;
    if (!detail) return;

    var globalState = window.LIMENGlobalState || {};
    var crossDomain = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) || [];

    // Find matching cross-domain pattern for this domain
    var matchedPattern = null;
    var domain = detail.domain || null;
    if (domain) {
      for (var i = 0; i < crossDomain.length; i++) {
        var pat = crossDomain[i];
        if (pat.domains && pat.domains.indexOf(domain) !== -1) {
          matchedPattern = pat.pattern || pat.patternId || null;
          break;
        }
      }
    }

    var entry = {
      domain: domain,
      action: detail.action || detail.type || 'unknown',
      type: detail.type || 'unknown',
      timestamp: Date.now(),
      globalState: globalState.mode || 'unknown',
      crossDomainPattern: matchedPattern,
      // CIVIL: which infrastructure signal families this action touches (may be []).
      infraSignals: _detectInfraSignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      )
    };

    _entries.push(entry);
    if (_entries.length > MAX_ENTRIES) {
      _entries.shift();
    }

    _publish();
    _checkConcentration();
    _checkInfraStackConcentration();
  }

  // ─── Concentration detection ──────────────────────────────────────────────

  function _checkConcentration() {
    var now = Date.now();
    if (now - _lastConcentrationTime < CONCENTRATION_COOLDOWN) return;
    if (_entries.length < CONCENTRATION_THRESHOLD) return;

    // Count domain frequency in recent entries (last 10)
    var recent = _entries.slice(-10);
    var counts = {};
    for (var i = 0; i < recent.length; i++) {
      var d = recent[i].domain;
      if (!d) continue;
      // Normalize compound domains (e.g. "energy+environment")
      var parts = d.split('+');
      for (var p = 0; p < parts.length; p++) {
        var pk = parts[p];
        if (pk) {
          counts[pk] = (counts[pk] || 0) + 1;
        }
      }
    }

    // Find domains meeting threshold
    var concentrated = [];
    for (var dk in counts) {
      if (counts[dk] >= CONCENTRATION_THRESHOLD) {
        concentrated.push(dk);
      }
    }

    if (concentrated.length === 0) return;

    // Don't re-narrate the same single-domain concentration
    if (concentrated.length === 1 && concentrated[0] === _lastConcentrationDomain) return;

    _lastConcentrationTime = now;
    _lastConcentrationDomain = concentrated.length === 1 ? concentrated[0] : null;

    // Build narrator message
    var drivers = [];
    var body;

    if (concentrated.length === 1) {
      body = 'Repeated observation posture detected in ' + concentrated[0] + '.';
      drivers.push(counts[concentrated[0]] + ' recent actions in ' + concentrated[0]);
    } else {
      body = 'User attention remains concentrated in ' + concentrated.join(' and ') + '.';
      for (var c = 0; c < concentrated.length; c++) {
        drivers.push(counts[concentrated[c]] + ' recent actions in ' + concentrated[c]);
      }
    }

    // Suggest broadening or deepening
    var options = [];
    for (var o = 0; o < Math.min(concentrated.length, 2); o++) {
      options.push({ label: 'deepen ' + concentrated[o] + ' analysis', type: 'analysis' });
    }
    options.push({ label: 'broaden scope', type: 'monitoring' });
    options.push({ label: 'hold', type: 'monitoring' });

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      topDrivers: drivers,
      options: options,
      body: body
    });
  }

  // ─── Infrastructure vulnerability-stack concentration ─────────────────────
  // Domain-semantic concentration for CIVIL infrastructure: beyond "which domain"
  // (above), surface WHICH vulnerability STACK the operator keeps returning to.
  // Tallies co-occurring civil signal families across recent entries and fires
  // when a known stack (capital rationing, cyber-resilient squeeze, supply-side
  // vulnerability, grid-funding stress, transport-maintenance gap) crosses the
  // threshold. Schema-faithful to _checkConcentration (same phase-change shape).

  function _checkInfraStackConcentration() {
    var now = Date.now();
    if (now - _lastInfraStackTime < INFRA_STACK_COOLDOWN) return;
    if (_entries.length < INFRA_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].infraSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < INFRA_VULN_STACKS.length; k++) {
      var stack = INFRA_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < INFRA_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastInfraStackId) return; // don't re-narrate the same stack

    _lastInfraStackTime = now;
    _lastInfraStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'infrastructure',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Publish ──────────────────────────────────────────────────────────────

  function _publish() {
    var summary = {
      entries: _entries,
      count: _entries.length,
      recentDomains: _recentDomains(5),
      infraSignalConcentration: _infraSignalConcentration(),
      updated: Date.now()
    };

    window.LIMENDecisionMemory = summary;
    _dispatch('limen:decision-memory-update', summary);
  }

  // CIVIL: roll up which infrastructure signal families recent attention concentrates
  // on (descending by count). Empty when no civil signals were detected.
  function _infraSignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].infraSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  function _recentDomains(n) {
    var seen = {};
    var result = [];
    for (var i = _entries.length - 1; i >= 0 && result.length < n; i--) {
      var d = _entries[i].domain;
      if (d && !seen[d]) {
        seen[d] = true;
        result.push(d);
      }
    }
    return result;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  function start() {
    window.addEventListener('limen:user-action', _onUserAction);
    _publish();
  }

  function stop() {
    window.removeEventListener('limen:user-action', _onUserAction);
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  window.LIMENDecisionMemory = {
    entries: [],
    count: 0,
    recentDomains: [],
    updated: null
  };

  window.LIMENDecisionMemoryEngine = {
    start: start,
    stop: stop
  };

})();
