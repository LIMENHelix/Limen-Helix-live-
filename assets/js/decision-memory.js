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
  var CULTURE_STACK_THRESHOLD = 2; // a cultural-concern stack seen N times signals concentration
  var CULTURE_STACK_COOLDOWN = 180000; // 3 min between culture-stack narrations
  var FINANCE_STACK_THRESHOLD = 2; // a financial-vulnerability stack seen N times signals concentration
  var FINANCE_STACK_COOLDOWN = 180000; // 3 min between finance-stack narrations

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

  // ─── Culture vulnerability-stack semantics ────────────────────────────────
  // CULTURAL domain-semantic concentration. As with infrastructure, generic
  // (domain, action) frequency only says WHERE the operator is looking; for the
  // culture domain we also detect WHAT cultural-concern STACK the attention
  // concentrates on. Each stack is a co-occurring pair of cultural signal families
  // (audience attention/virality/creators-and-artists/scenes-and-movements/
  // backlash-and-cancellation/saturation-and-fatigue/heritage-and-expression).
  // Mirrors the culture-brain cross-domain conditions:
  //   BACKLASH_ACCUMULATION + AUDIENCE_LOSS    → backlash-driven audience exodus
  //   CREATOR_BURNOUT + SCENE_DECLINE          → creator burnout hollowing a scene
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  var CULTURE_SIGNAL_TOKENS = {
    AUDIENCE_LOSS:           /(fanbase|audience|listener|viewer|follower|reach|engagement[_\s-]?drop|unfollow|churn|attention[_\s-]?loss)/i,
    VIRALITY_SHIFT:          /(virality|viral|breakout|trend|trending|momentum|emergence|tastemaker|algorithm|for[_\s-]?you)/i,
    CREATOR_BURNOUT:         /(creator|artist|musician|burnout|exhaustion|hiatus|output[_\s-]?decline|prolific|grind|content[_\s-]?treadmill)/i,
    SCENE_DECLINE:           /(scene|local[_\s-]?scene|genre|movement|subculture|venue[_\s-]?closure|underground|circuit|community[_\s-]?fade)/i,
    BACKLASH_ACCUMULATION:   /(backlash|cancel|cancellation|harassment|pile[_\s-]?on|controversy|outrage|discourse[_\s-]?storm|ratio)/i,
    SATURATION_FATIGUE:      /(saturation|oversaturation|fatigue|overexposure|formulaic|derivative|burnout[_\s-]?of[_\s-]?genre|trend[_\s-]?fatigue)/i,
    HERITAGE_EXPRESSION:     /(heritage|catalog|legacy|preservation|censorship|suppression|expression|de[_\s-]?platform|gatekeep|silencing)/i
  };

  // Cultural-concern STACKS — ordered token pairs with a cultural interpretation.
  // Each describes an operator-concentration meaning specific to a cultural
  // vulnerability stack (NOT energy oil/gas/nuclear/grid/datacenter content).
  var CULTURE_VULN_STACKS = [
    { id: 'BACKLASH_EXODUS',       signals: ['BACKLASH_ACCUMULATION', 'AUDIENCE_LOSS'],
      body: 'Operator attention concentrates on the backlash + audience-loss stack — controversy and discourse storms driving a fanbase exodus.' },
    { id: 'SCENE_HOLLOWING',       signals: ['CREATOR_BURNOUT', 'SCENE_DECLINE'],
      body: 'Operator attention concentrates on the creator-burnout + scene-decline stack — artists exhausting as the local scene/genre circuit thins out.' },
    { id: 'HERITAGE_CANCELLATION', signals: ['BACKLASH_ACCUMULATION', 'HERITAGE_EXPRESSION'],
      body: 'Operator attention concentrates on the cancellation + heritage-loss stack — backlash threatening catalog, legacy, and freedom of cultural expression.' },
    { id: 'FANBASE_FATIGUE',       signals: ['SATURATION_FATIGUE', 'AUDIENCE_LOSS'],
      body: 'Operator attention concentrates on the saturation + audience-loss stack — oversaturation and trend fatigue eroding a once-loyal fanbase.' },
    { id: 'EXPRESSION_COLLAPSE',   signals: ['HERITAGE_EXPRESSION', 'SCENE_DECLINE'],
      body: 'Operator attention concentrates on the expression-suppression + scene-decline stack — censorship/gatekeeping collapsing the space a movement lives in.' }
  ];

  // ─── Finance vulnerability-stack semantics ────────────────────────────────
  // FINANCIAL domain-semantic concentration. As with infrastructure and culture,
  // generic (domain, action) frequency only says WHERE the operator is looking; for
  // the finance domain we also detect WHAT financial-vulnerability STACK the attention
  // concentrates on. Each stack is a co-occurring pair of financial signal families
  // (liquidity & funding/credit spreads & lending/solvency & leverage/margin & collateral/
  // capital flows/default & covenant/counterparty & systemic exposure).
  // Mirrors the finance-brain cross-domain conditions:
  //   LIQUIDITY_CRUNCH + DEFAULT_RISK        → liquidity-driven default spiral
  //   MARGIN_CALL + CAPITAL_FLIGHT           → forced-deleveraging capital exodus
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  // STRICTLY ADDITIVE: independent of the validated P3 distress kernel (Thing1) —
  // this advisory layer never participates in /api/limen/score scoring.
  var FINANCE_SIGNAL_TOKENS = {
    LIQUIDITY_CRUNCH:        /(liquidity|funding[_\s-]?gap|cash[_\s-]?crunch|runnable|deposit[_\s-]?flight|bank[_\s-]?run|frozen[_\s-]?market|illiquid|repo[_\s-]?freeze|funding[_\s-]?stress)/i,
    CREDIT_SPREAD:           /(credit[_\s-]?spread|spread[_\s-]?widen|cds|yield[_\s-]?spread|high[_\s-]?yield|junk[_\s-]?bond|distressed[_\s-]?debt|downgrade|rating[_\s-]?cut|credit[_\s-]?tighten)/i,
    SOLVENCY_PRESSURE:       /(solvency|insolvent|negative[_\s-]?equity|impairment|writedown|write[_\s-]?off|capital[_\s-]?shortfall|tier[_\s-]?1|undercapitalized|book[_\s-]?value[_\s-]?erosion)/i,
    MARGIN_CALL:             /(margin[_\s-]?call|collateral[_\s-]?call|haircut|forced[_\s-]?sale|liquidation|maintenance[_\s-]?margin|variation[_\s-]?margin|deleveraging|fire[_\s-]?sale)/i,
    CAPITAL_FLIGHT:          /(capital[_\s-]?flight|outflow|redemption|withdrawal|fund[_\s-]?run|deposit[_\s-]?outflow|risk[_\s-]?off|flight[_\s-]?to[_\s-]?quality|asset[_\s-]?reallocation)/i,
    DEFAULT_RISK:            /(default|bankruptcy|chapter[_\s-]?11|restructuring|missed[_\s-]?payment|delinquen|nonaccrual|non[_\s-]?performing|charge[_\s-]?off|distress)/i,
    COVENANT_BREACH:         /(covenant|breach|technical[_\s-]?default|leverage[_\s-]?ratio|coverage[_\s-]?ratio|waiver|forbearance|amendment|debt[_\s-]?service)/i,
    COUNTERPARTY_EXPOSURE:   /(counterparty|systemic|contagion|interconnected|exposure|derivative|clearing|too[_\s-]?big[_\s-]?to[_\s-]?fail|cascade|domino)/i
  };

  // Financial-vulnerability STACKS — ordered token pairs with a financial interpretation.
  // Each describes an operator-concentration meaning specific to a financial vulnerability
  // stack (capital markets, credit & lending, banking, liquidity & solvency, M&A, fintech,
  // corporate distress, systemic risk) — NOT energy oil/gas/grid/datacenter content.
  var FINANCE_VULN_STACKS = [
    { id: 'LIQUIDITY_DEFAULT',       signals: ['LIQUIDITY_CRUNCH', 'DEFAULT_RISK'],
      body: 'Operator attention concentrates on the liquidity-crunch + default-risk stack — a funding freeze tipping borrowers into a liquidity-driven default spiral.' },
    { id: 'MARGIN_CAPITAL_FLIGHT',   signals: ['MARGIN_CALL', 'CAPITAL_FLIGHT'],
      body: 'Operator attention concentrates on the margin-call + capital-flight stack — forced deleveraging and collateral calls driving a risk-off capital exodus.' },
    { id: 'CREDIT_SOLVENCY',         signals: ['CREDIT_SPREAD', 'SOLVENCY_PRESSURE'],
      body: 'Operator attention concentrates on the credit-spread + solvency-pressure stack — widening spreads and impairments eroding capital adequacy.' },
    { id: 'LEVERAGE_DELEVERAGING',   signals: ['COVENANT_BREACH', 'MARGIN_CALL'],
      body: 'Operator attention concentrates on the covenant-breach + margin-call stack — leverage limits breached, triggering forced deleveraging and fire sales.' },
    { id: 'REPO_HAIRCUT',            signals: ['COUNTERPARTY_EXPOSURE', 'LIQUIDITY_CRUNCH'],
      body: 'Operator attention concentrates on the counterparty-exposure + liquidity-crunch stack — repo haircuts and funding stress propagating systemic contagion.' }
  ];

  // ─── State ───────────────────────────────────────────────────────────────

  var _entries = [];
  var _lastConcentrationTime = 0;
  var _lastConcentrationDomain = null;
  var _lastInfraStackTime = 0;
  var _lastInfraStackId = null;
  var _lastCultureStackTime = 0;
  var _lastCultureStackId = null;
  var _lastFinanceStackTime = 0;
  var _lastFinanceStackId = null;
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

  // Detect which cultural signal families a user-action references, by scanning its
  // free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical culture signal ids. Never fabricates — empty if nothing matches.
  function _detectCultureSignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in CULTURE_SIGNAL_TOKENS) {
      if (CULTURE_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // Detect which financial signal families a user-action references, by scanning its
  // free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical finance signal ids. Never fabricates — empty if nothing matches.
  function _detectFinanceSignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in FINANCE_SIGNAL_TOKENS) {
      if (FINANCE_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
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
      ),
      // CULTURE: which cultural signal families this action touches (may be []).
      cultureSignals: _detectCultureSignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      ),
      // FINANCE: which financial signal families this action touches (may be []).
      financeSignals: _detectFinanceSignals(
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
    _checkCultureStackConcentration();
    _checkFinanceStackConcentration();
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

  // ─── Culture vulnerability-stack concentration ────────────────────────────
  // Domain-semantic concentration for CULTURE: beyond "which domain" (above),
  // surface WHICH cultural-concern STACK the operator keeps returning to. Tallies
  // co-occurring cultural signal families across recent entries and fires when a
  // known stack (backlash exodus, scene hollowing, heritage cancellation, fanbase
  // fatigue, expression collapse) crosses the threshold. Schema-faithful to
  // _checkInfraStackConcentration (same phase-change shape).

  function _checkCultureStackConcentration() {
    var now = Date.now();
    if (now - _lastCultureStackTime < CULTURE_STACK_COOLDOWN) return;
    if (_entries.length < CULTURE_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].cultureSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < CULTURE_VULN_STACKS.length; k++) {
      var stack = CULTURE_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < CULTURE_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastCultureStackId) return; // don't re-narrate the same stack

    _lastCultureStackTime = now;
    _lastCultureStackId = best.stack.id;

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
      domain: 'culture',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Finance vulnerability-stack concentration ────────────────────────────
  // Domain-semantic concentration for FINANCE: beyond "which domain" (above),
  // surface WHICH financial-vulnerability STACK the operator keeps returning to.
  // Tallies co-occurring financial signal families across recent entries and fires
  // when a known stack (liquidity-default, margin-capital-flight, credit-solvency,
  // leverage-deleveraging, repo-haircut) crosses the threshold. Schema-faithful to
  // _checkInfraStackConcentration (same phase-change shape). STRICTLY ADDITIVE and
  // independent of the validated P3 distress kernel — advisory only.

  function _checkFinanceStackConcentration() {
    var now = Date.now();
    if (now - _lastFinanceStackTime < FINANCE_STACK_COOLDOWN) return;
    if (_entries.length < FINANCE_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].financeSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < FINANCE_VULN_STACKS.length; k++) {
      var stack = FINANCE_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < FINANCE_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastFinanceStackId) return; // don't re-narrate the same stack

    _lastFinanceStackTime = now;
    _lastFinanceStackId = best.stack.id;

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
      domain: 'finance',
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
      cultureSignalConcentration: _cultureSignalConcentration(),
      financeSignalConcentration: _financeSignalConcentration(),
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

  // CULTURE: roll up which cultural signal families recent attention concentrates
  // on (descending by count). Empty when no cultural signals were detected.
  function _cultureSignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].cultureSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  // FINANCE: roll up which financial signal families recent attention concentrates
  // on (descending by count). Empty when no financial signals were detected.
  function _financeSignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].financeSignals || [];
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
