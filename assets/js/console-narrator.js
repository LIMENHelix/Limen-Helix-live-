/**
 * console-narrator.js
 * LIMEN HELIX — Console Voice & Narration Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 *
 * Produces concise, calm, mission-control-style narration from:
 *   - Feed events (domain stress, escalation shifts)
 *   - Global state transitions
 *   - Biosensor regulation state changes
 *   - Feed reliability degradation
 *
 * Voice modes: silent, analyst, command
 * Uses browser speechSynthesis as local baseline.
 * Structured so premium TTS can be swapped in later.
 *
 * Output: window.LIMENConsoleNarrator
 * Events: limen:narrator-speak (on each narration)
 *
 * Load order: after biosensor-bridge.js, before limen-bootstrap.js
 */

(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────

  var MODES = ['silent', 'analyst', 'command'];
  var SPEAK_COOLDOWN_MS = 8000;     // Min gap between spoken messages
  var MAX_QUEUE = 6;                 // Max pending narrations
  var PRIORITY_HIGH = 3;
  var PRIORITY_MEDIUM = 2;
  var PRIORITY_LOW = 1;
  var SPEAK_TIMEOUT_MS = 15000;     // Safety: reset _speaking if stuck this long

  // ─── State ──────────────────────────────────────────────────────────────

  var _mode = 'analyst';             // Current voice mode
  var _muted = false;                // Global mute
  var _queue = [];                   // Narration queue [{text, priority, timestamp}]
  var _lastSpokeAt = 0;             // Timestamp of last spoken message
  var _speakStartedAt = 0;          // When _speaking was set true (for timeout)
  var _interval = null;
  var _controlEl = null;
  var _synth = null;                 // SpeechSynthesis reference
  var _selectedVoice = null;         // Preferred voice
  var _speaking = false;
  var _lastGlobalMode = null;        // Track global state to only narrate shifts

  // Dedup: prevent same message within 30 seconds
  var _recentMessages = {};          // text → timestamp

  // ─── Voice synthesis abstraction ────────────────────────────────────────
  // This layer can be swapped out for premium TTS (ElevenLabs, etc.)

  var _voiceBackend = {
    type: 'browser',

    init: function () {
      if (typeof window.speechSynthesis === 'undefined') return false;
      _synth = window.speechSynthesis;
      // Pick a good voice once voices are loaded
      _pickVoice();
      if (_synth.onvoiceschanged !== undefined) {
        _synth.onvoiceschanged = _pickVoice;
      }
      return true;
    },

    speak: function (text, onEnd) {
      if (!_synth || _muted || _mode === 'silent') {
        if (onEnd) onEnd();
        return;
      }
      var utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.92;    // Slightly slow — calm, deliberate
      utt.pitch = 0.95;   // Slightly low — authoritative
      utt.volume = 0.7;   // Not loud — ambient
      if (_selectedVoice) utt.voice = _selectedVoice;
      utt.onend = function () {
        _speaking = false;
        _speakStartedAt = 0;
        if (onEnd) onEnd();
      };
      utt.onerror = function () {
        _speaking = false;
        _speakStartedAt = 0;
        if (onEnd) onEnd();
      };
      _speaking = true;
      _speakStartedAt = Date.now();
      _synth.speak(utt);
    },

    cancel: function () {
      if (_synth) _synth.cancel();
      _speaking = false;
    },

    isSpeaking: function () {
      // Safety timeout: if _speaking has been true for too long, reset it
      // (handles Chrome bug where onend/onerror never fires)
      if (_speaking && _speakStartedAt > 0 && (Date.now() - _speakStartedAt > SPEAK_TIMEOUT_MS)) {
        _speaking = false;
        _speakStartedAt = 0;
        if (_synth) _synth.cancel(); // Clear any stuck utterance
      }
      return _speaking || (_synth && _synth.speaking);
    }
  };

  function _pickVoice() {
    if (!_synth) return;
    var voices = _synth.getVoices();
    if (!voices || voices.length === 0) return;

    // Prefer English voices with natural/premium quality
    var preferred = ['Google UK English Female', 'Google US English', 'Samantha',
                     'Karen', 'Daniel', 'Microsoft Zira', 'Microsoft David'];
    for (var p = 0; p < preferred.length; p++) {
      for (var v = 0; v < voices.length; v++) {
        if (voices[v].name.indexOf(preferred[p]) !== -1) {
          _selectedVoice = voices[v];
          return;
        }
      }
    }
    // Fallback: first English voice
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.indexOf('en') === 0) {
        _selectedVoice = voices[i];
        return;
      }
    }
    _selectedVoice = voices[0];
  }

  // ─── Narration generation ───────────────────────────────────────────────

  // Templates per mode
  var TEMPLATES = {
    analyst: {
      escalation_rise:     'Escalation rising. Multiple domains accelerating.',
      escalation_drop:     'Escalation easing. Immediate signals clearing.',
      domain_distress:     '{domain} domain pressure increasing.',
      // Infrastructure-specific distress voice — operational/engineering-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) but for
      // civil infrastructure: grid reliability, deferred maintenance, transport, funding, cyber-physical.
      infra_grid_degradation:    'Grid infrastructure under stress. Transmission and distribution reliability degrading.',
      infra_maintenance_deficit: 'Deferred maintenance accumulating. Asset condition deteriorating across the network.',
      infra_cyber_physical:      'Cyber-physical exposure rising. SCADA and control-system integrity at risk.',
      infra_transport_disruption:'Transport network strained. Roads, bridges, and transit capacity degrading.',
      infra_funding_collapse:    'Capital funding gap widening. Infrastructure investment falling behind need.',
      infra_generic:             'Infrastructure under stress. Public works and capital systems pressured.',
      // Culture-specific distress voice — scene/creator/attention-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure port above, but for cultural systems: virality, creator ecosystems,
      // scene health, fanbase cohesion, discourse/backlash. Maps to culture-brain diagnosisIndex
      // (CULTURAL_ERASURE / HERITAGE_DESTRUCTION / CENSORSHIP / IDENTITY_CRISIS / CREATIVE_STAGNATION).
      culture_viral_collapse:    'Viral momentum collapsing. Trending signals decaying faster than the audience can sustain.',
      culture_creator_burnout:   'Creator ecosystem under strain. Output cadence and artist retention deteriorating.',
      culture_scene_saturation:  'Scene saturating. Discovery crowding out and breakout potential thinning.',
      culture_fanbase_fracture:  'Fanbase cohesion fracturing. Audience attention splintering across tribes.',
      culture_backlash_spiral:   'Backlash spiral forming. Discourse turning adversarial around the movement.',
      culture_generic:           'Cultural domain under stress. Scenes, creators, and audiences pressured.',
      // Finance-specific distress voice — capital-markets/credit/liquidity-grounded,
      // mirrors energy's per-diagnosis narration and the infrastructure/culture ports above,
      // but for financial systems: solvency, credit spreads, margin/collateral, leverage,
      // funding liquidity, counterparty/systemic risk. Maps to the finance domain's distress
      // flavors alongside (never replacing) the validated P3 distress kernel.
      finance_solvency_crisis:       'Solvency under pressure. Capital adequacy and balance-sheet cushion eroding.',
      finance_credit_spread_widening:'Credit spreads widening. Risk premia repricing as default expectations climb.',
      finance_margin_call_pressure:  'Margin pressure building. Collateral calls and haircuts tightening across positions.',
      finance_deleveraging_cascade:  'Deleveraging cascade forming. Forced asset sales feeding back into prices.',
      finance_liquidity_crunch:      'Funding liquidity tightening. Short-term financing and market depth thinning.',
      finance_counterparty_risk:     'Counterparty risk rising. Bilateral exposure and settlement chains under strain.',
      finance_generic:               'Financial domain under stress. Capital, credit, and liquidity pressured.',
      // Economy-specific distress voice — MACRO-AGGREGATE/business-cycle-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure/culture/finance ports above, but for the macroeconomy: GDP & growth,
      // inflation (CPI/PCE), employment & labor markets, consumer & business sentiment,
      // monetary & fiscal policy, the recession/expansion cycle. Maps to economy-node-business-
      // engine fields (M1→Industrial-Production, THAL→GDP, STRI→Consumer-Spending,
      // CBLM→Monetary-Policy, OFC→Price-Formation). Bound to MACRO INDICATORS (FRED series
      // GDPC1/CPIAUCSL/PCEPI/UNRATE/PAYEMS/FEDFUNDS/DGS10/UMCSENT/INDPRO + broad-market proxies
      // SPY/DIA/TLT/GLD), NOT single-company tickers — and DISTINCT from finance (capital markets).
      economy_recession:             'GDP growth stalling. Demand weakness and inventory correction accelerating.',
      economy_inflation:             'Price level surging. CPI and PCE running hot as expectations risk unanchoring.',
      economy_stagflation:           'Stagflation signature forming. Prices climbing while output and growth stall.',
      economy_credit_crunch:         'Credit conditions tightening. Spreads widening and lending standards constricting.',
      economy_policy_error:          'Policy miscalibration risk rising. Rate path and fiscal stance straining confidence.',
      economy_employment_deterioration:'Labor market softening. Jobless claims rising and payroll momentum fading.',
      economy_demand_weakness:       'Aggregate demand weakening. Consumer confidence and business investment pulling back.',
      economy_supply_disruption:     'Supply-side pressure building. Producer prices and input shortages straining output.',
      economy_generic:               'Macroeconomy under stress. Growth, prices, and employment pressured.',
      // Technology-specific distress voice — semiconductors/compute/AI/software/cyber-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure/culture/finance/economy ports above, but for the TECHNOLOGY domain identity:
      // semiconductors & compute (fabs, GPUs/TPUs, wafer supply), AI/ML (training, inference,
      // alignment), software & cloud, hardware & devices, cybersecurity, R&D & innovation pipelines,
      // platform networks, data infrastructure. Maps to technology-brain diagnosisIndex (CYBER_ATTACK /
      // AI_ALIGNMENT_FAILURE / INFRASTRUCTURE_COLLAPSE / DATA_BREACH / CHIP_SHORTAGE / PLATFORM_MONOPOLY).
      // Couples to energy via compute demand but keeps tech identity (chips/AI/software/cyber), and is
      // DISTINCT from finance (fintech is a coupling, not the identity). Real tickers: NVDA, AVGO, AMD,
      // INTC, TSM, ASML, MSFT, GOOGL, META, AMZN, ORCL, CRM, AAPL, PLTR, CRWD, PANW.
      tech_chip_shortage:            'Semiconductor supply tightening. Wafer allocation and foundry capacity falling behind demand.',
      tech_compute_bottleneck:       'Compute capacity constraints rising. GPU/TPU allocation pressure accelerating across training and inference.',
      tech_ai_alignment_failure:     'AI alignment risk rising. Model behavior, autonomy, and bias drift exceeding control margins.',
      tech_cyber_breach:             'Cyber exposure rising. Intrusion, ransomware, and data-exfiltration pressure climbing.',
      tech_platform_monopoly:        'Platform concentration deepening. Lock-in and innovation suppression distorting competition.',
      tech_supply_disruption:        'Hardware supply chain strained. Component scarcity and manufacturing bottlenecks propagating.',
      tech_obsolescence_acceleration:'Obsolescence accelerating. Legacy stacks and aging hardware repricing faster than refresh cycles.',
      tech_breakthrough_emergence:   'Breakthrough signal forming. A capability step-change is reshaping the technology frontier.',
      tech_generic:                  'Technology domain under stress. Compute, software, and platforms pressured.',
      // Defense-specific distress voice — military/procurement/readiness/deterrence-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure/culture/finance/economy/technology ports above, but for the DEFENSE domain
      // identity: military spending & procurement, the defense industrial base, geopolitical conflict
      // & deterrence, weapons systems, military readiness & sustainment, alliances & basing,
      // electronic/kinetic warfare, strategic deterrence. Defense COUPLES to energy via fuel /
      // strategic-reserve and to technology via cyber, but keeps its own kinetic/industrial/readiness
      // identity — and is kept DISTINCT from intelligence (collection/analysis/espionage) and from
      // technology (cyber is a coupling, not the identity). Real tickers: LMT, RTX, NOC, GD, BA, LHX,
      // HII, LDOS, BAH, KTOS, AVAV. CLIENT-SIDE narration flavor only — never touches any scoring path.
      defense_readiness_drop:        'Force readiness declining. Munitions depletion and sustainment gaps widening; review procurement and modernization status.',
      defense_conflict_escalation:   'Conflict escalation detected. Deterrence posture under pressure as geopolitical tension intensifies.',
      defense_industrial_strain:     'Defense industrial base showing capacity strain. Supplier consolidation and throughput limits rising.',
      defense_procurement_breakdown: 'Procurement program under strain. Cost overruns and acquisition delays threatening capability delivery.',
      defense_alliance_fracture:     'Alliance cohesion weakening. Basing access and coalition burden-sharing under strain.',
      defense_kinetic_warfare:       'Kinetic engagement intensifying. Weapons-system attrition and platform loss rates climbing.',
      defense_generic:               'Defense domain under stress. Readiness, procurement, and deterrence pressured.',
      // Intelligence-specific distress voice — collection/analysis/espionage-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure/culture/finance/economy/technology/defense ports above, but for the
      // INTELLIGENCE domain identity: intelligence collection (SIGINT/HUMINT/GEOINT/OSINT),
      // all-source analysis & assessment, espionage & counterintelligence, surveillance &
      // reconnaissance, threat warning, covert action, information & influence operations,
      // security clearance & insider risk. Intelligence COUPLES to defense via threat warning
      // and to technology via cyber tooling, but keeps its own collection/analysis/espionage
      // identity — kept DISTINCT from defense (kinetic/industrial/readiness) and technology
      // (cyber tooling is a coupling, not the identity). Anchored to the five portal diagnosis
      // families: collection_gap, analytical_distortion, oversight_failure, surveillance_excess,
      // counterintelligence_failure, adversarial_penetration. Real tickers: PLTR, BAH, LDOS,
      // CACI, SAIC, KBR, VRNT, NICE, VRSK. CLIENT-SIDE narration flavor only — never touches scoring.
      intel_collection_gap:            'Collection coverage degrading. SIGINT, HUMINT, and GEOINT gaps widening against priority targets.',
      intel_analytical_distortion:     'Analytical integrity under strain. Assessment bias, politicization, and confidence drift rising across all-source product.',
      intel_oversight_failure:         'Oversight controls weakening. Authorization, audit, and accountability gaps exposing the collection enterprise.',
      intel_surveillance_excess:       'Surveillance footprint overreaching. Domestic and bulk-collection exposure exceeding warrant and minimization limits.',
      intel_counterintelligence_failure:'Counterintelligence breach forming. Insider risk, mole exposure, and clearance compromise threatening sources and methods.',
      intel_adversarial_penetration:   'Adversary penetration rising. Foreign interference, cyber espionage, and network intrusion compromising the collection perimeter.',
      intel_generic:                   'Intelligence domain under stress. Collection, analysis, and counterintelligence pressured.',
      global_shift:        'Global state shifted to {state}.',
      event_start:         '{event} detected.',
      event_end:           '{event} resolved.',
      feed_hydrated:       'Feeds online. System active.',
      feed_degradation:    'Feed reliability degraded. Falling back to inferred signals.',
      feed_recovery:       'Feed connectivity restored.',
      regulation_calm:     'User state: calm. System nominal.',
      regulation_focused:  'User state: focused.',
      regulation_pressured:'User state: pressured. Consider pacing.',
      regulation_overloaded:'User state: overloaded. Reducing information density.',
      regulation_recovering:'System stabilizing. Pressure is easing.'
    },
    command: {
      escalation_rise:     'Escalation. Multiple domains active. Review immediately.',
      escalation_drop:     'Escalation cleared. Resume monitoring.',
      domain_distress:     '{domain} elevated. Investigate.',
      infra_grid_degradation:    'Grid reliability degrading. Inspect transmission and distribution.',
      infra_maintenance_deficit: 'Maintenance backlog critical. Prioritize asset repair.',
      infra_cyber_physical:      'Cyber-physical threat. Harden SCADA and control systems.',
      infra_transport_disruption:'Transport disruption. Assess roads, bridges, transit.',
      infra_funding_collapse:    'Funding gap critical. Secure infrastructure capital.',
      infra_generic:             'Infrastructure elevated. Investigate public works.',
      culture_viral_collapse:    'Viral momentum collapsing. Reassess release timing and audience pull.',
      culture_creator_burnout:   'Creator strain critical. Protect output cadence and artist retention.',
      culture_scene_saturation:  'Scene saturated. Find differentiation or a fresh lane.',
      culture_fanbase_fracture:  'Fanbase fracturing. Re-anchor the core audience.',
      culture_backlash_spiral:   'Backlash spiral. Manage discourse before it compounds.',
      culture_generic:           'Cultural domain elevated. Investigate scenes and creators.',
      finance_solvency_crisis:       'Solvency stress. Shore up capital and balance-sheet cushion.',
      finance_credit_spread_widening:'Spreads widening. Reprice credit risk and hedge exposure.',
      finance_margin_call_pressure:  'Margin pressure. Manage collateral and reduce leverage.',
      finance_deleveraging_cascade:  'Deleveraging cascade. Contain forced selling and protect liquidity.',
      finance_liquidity_crunch:      'Liquidity crunch. Secure funding lines and preserve cash.',
      finance_counterparty_risk:     'Counterparty risk. Review exposures and settlement chains.',
      finance_generic:               'Financial domain elevated. Investigate capital and credit.',
      economy_recession:             'Growth stalling. Demand collapse. Cut capex and preserve cash.',
      economy_inflation:             'Inflation surging. Hedge price risk and reprice contracts.',
      economy_stagflation:           'Stagflation. Prices up, output down. Protect margins and liquidity.',
      economy_credit_crunch:         'Credit crunch. Lock funding lines before they close.',
      economy_policy_error:          'Policy risk. Reposition for rate and fiscal shifts.',
      economy_employment_deterioration:'Labor weakening. Plan for slower demand and hiring freezes.',
      economy_demand_weakness:       'Demand weak. Defer expansion and conserve capital.',
      economy_supply_disruption:     'Supply shock. Secure inputs and rebuild inventory buffers.',
      economy_generic:               'Macroeconomy elevated. Investigate growth and prices.',
      tech_chip_shortage:            'Chip shortage. Secure wafer allocation and qualify second-source foundries.',
      tech_compute_bottleneck:       'Compute shortage. Secure cloud quota and optimize inference efficiency.',
      tech_ai_alignment_failure:     'AI alignment failure. Halt autonomy escalation and tighten model guardrails.',
      tech_cyber_breach:             'Cyber breach. Contain intrusion, rotate credentials, and harden the perimeter.',
      tech_platform_monopoly:        'Platform lock-in. Diversify dependencies and reduce single-vendor exposure.',
      tech_supply_disruption:        'Hardware supply shock. Pre-buy components and rebuild inventory buffers.',
      tech_obsolescence_acceleration:'Stack obsolescing. Accelerate migration and retire legacy hardware.',
      tech_breakthrough_emergence:   'Breakthrough emerging. Reprioritize R&D and move on the capability lead.',
      tech_generic:                  'Technology domain elevated. Investigate compute and platforms.',
      defense_readiness_drop:        'Readiness degrading. Replenish munitions and accelerate sustainment and modernization.',
      defense_conflict_escalation:   'Conflict escalating. Reinforce deterrence posture and review force positioning.',
      defense_industrial_strain:     'Industrial base strained. Expand supplier capacity and secure critical components.',
      defense_procurement_breakdown: 'Procurement breaking down. Recover program cost and schedule before capability slips.',
      defense_alliance_fracture:     'Alliance fracturing. Shore up basing access and coalition commitments.',
      defense_kinetic_warfare:       'Kinetic conflict active. Sustain platforms and manage attrition and resupply.',
      defense_generic:               'Defense domain elevated. Investigate readiness and procurement.',
      intel_collection_gap:            'Collection gap. Retask SIGINT/HUMINT/GEOINT and close coverage against priority targets; review PLTR/BAH tasking posture.',
      intel_analytical_distortion:     'Analytic distortion. Re-run alternative analysis, strip bias, and recalibrate confidence before dissemination.',
      intel_oversight_failure:         'Oversight failure. Restore authorization, audit trail, and accountability across the collection enterprise.',
      intel_surveillance_excess:       'Surveillance overreach. Enforce minimization and warrant limits; pull back bulk collection now.',
      intel_counterintelligence_failure:'Counterintelligence breach. Lock down sources and methods, freeze clearances, and hunt the insider.',
      intel_adversarial_penetration:   'Adversary penetration. Contain foreign intrusion and harden countermeasures; check LDOS/CACI/SAIC perimeter posture.',
      intel_generic:                   'Intelligence domain elevated. Investigate collection and counterintelligence.',
      global_shift:        'State change: {state}.',
      event_start:         'Event: {event}. Tracking.',
      event_end:           'Event cleared: {event}.',
      feed_hydrated:       'Feeds online. Monitoring.',
      feed_degradation:    'Feed degraded. Confidence reduced.',
      feed_recovery:       'Feeds restored.',
      regulation_calm:     'Operator nominal.',
      regulation_focused:  'Operator focused.',
      regulation_pressured:'Operator pressured. Manage load.',
      regulation_overloaded:'Operator overloaded. Reduce exposure.',
      regulation_recovering:'Operator recovering. Stabilizing.'
    }
  };

  function _template(key, vars) {
    var templates = TEMPLATES[_mode] || TEMPLATES.analyst;
    var text = templates[key];
    if (!text) return null;
    if (vars) {
      for (var k in vars) {
        text = text.replace('{' + k + '}', vars[k]);
      }
    }
    return text;
  }

  // ─── Narration queueing ─────────────────────────────────────────────────

  function _narrate(key, vars, priority) {
    if (_mode === 'silent') return;

    var text = _template(key, vars);
    if (!text) return;

    // Dedup check
    var now = Date.now();
    if (_recentMessages[text] && (now - _recentMessages[text]) < 30000) return;
    _recentMessages[text] = now;

    // Prune old dedup entries
    for (var msg in _recentMessages) {
      if (now - _recentMessages[msg] > 60000) delete _recentMessages[msg];
    }

    _queue.push({
      text: text,
      priority: priority || PRIORITY_MEDIUM,
      timestamp: now
    });

    // Sort by priority (high first), then by timestamp (oldest first)
    _queue.sort(function (a, b) {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });

    // Enforce max queue
    while (_queue.length > MAX_QUEUE) _queue.pop();

    // Emit event for UI/logging
    _dispatch('limen:narrator-speak', { text: text, priority: priority, mode: _mode });
  }

  // ─── Queue processor ────────────────────────────────────────────────────

  function _processQueue() {
    if (_mode === 'silent' || _muted) return;
    if (_voiceBackend.isSpeaking()) return;
    if (_queue.length === 0) return;

    var now = Date.now();
    if (now - _lastSpokeAt < SPEAK_COOLDOWN_MS) return;

    var item = _queue.shift();
    if (!item) return;

    // Skip stale messages (older than 30 seconds)
    if (now - item.timestamp > 30000) {
      _processQueue(); // Try next
      return;
    }

    _lastSpokeAt = now;
    var _safeText = item.text;
    if (window.LIMENResponseSafety) _safeText = window.LIMENResponseSafety.sanitize(_safeText, 'narrator');
    _voiceBackend.speak(_safeText, function () {
      // After speaking, try next in queue
      setTimeout(_processQueue, 500);
    });
  }

  // ─── Event listeners ────────────────────────────────────────────────────

  function _onEscalationShift(e) {
    var detail = e.detail;
    if (!detail) return;
    if (detail.direction === 'escalating') {
      _narrate('escalation_rise', {}, PRIORITY_HIGH);
    } else if (detail.direction === 'deescalating') {
      _narrate('escalation_drop', {}, PRIORITY_MEDIUM);
    }
  }

  function _onDomainDistress(e) {
    var detail = e.detail;
    if (!detail || !detail.domain) return;
    var NAMES = {
      economy: 'Economy', energy: 'Energy', environment: 'Environment',
      health: 'Health', technology: 'Technology', research: 'Research',
      supplyChain: 'Supply chain', infrastructure: 'Infrastructure',
      culture: 'Culture', finance: 'Finance', defense: 'Defense',
      intelligence: 'Intelligence'
    };

    // Infrastructure parity: mirror energy's per-diagnosis voice. Energy distinguishes
    // OIL_SHOCK / GRID_COLLAPSE etc via its diagnosisIndex; here we classify the civil
    // distress flavor from the emitted signal content and narrate an infrastructure-
    // specific line instead of the generic '{domain} domain pressure increasing'.
    if (detail.domain === 'infrastructure') {
      var key = _classifyInfraDistress(detail.signals);
      if (key) {
        _narrate(key, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Culture parity: mirror energy's per-diagnosis voice the same way infrastructure does.
    // Culture distinguishes viral collapse / creator burnout / scene saturation / fanbase
    // fracture / backlash via culture-brain diagnosisIndex; classify the cultural distress
    // flavor from signal content and narrate a culture-specific line instead of the generic.
    if (detail.domain === 'culture') {
      var ckey = _classifyCultureDistress(detail.signals);
      if (ckey) {
        _narrate(ckey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Finance parity: mirror energy's per-diagnosis voice the same way infrastructure and
    // culture do. This is the CLIENT-SIDE narration flavor only — it never touches the
    // validated P3 distress kernel (Thing1) or any scoring path. Classify the financial
    // distress flavor from signal content (solvency / spreads / margin / deleveraging /
    // liquidity / counterparty) and narrate a finance-specific line instead of the generic.
    if (detail.domain === 'finance') {
      var fkey = _classifyFinanceDistress(detail.signals);
      if (fkey) {
        _narrate(fkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Economy parity: mirror energy's per-diagnosis voice the same way infrastructure,
    // culture, and finance do. Economy is the MACRO AGGREGATE — classify the macroeconomic
    // distress flavor from signal content (recession / inflation / stagflation / credit crunch /
    // policy error / employment deterioration / demand weakness / supply disruption) and narrate
    // an economy-specific line instead of the generic. This is CLIENT-SIDE narration flavor only,
    // bound to MACRO INDICATORS (FRED series + broad-market proxies), kept DISTINCT from finance.
    if (detail.domain === 'economy') {
      var ekey = _classifyEconomyDistress(detail.signals);
      if (ekey) {
        _narrate(ekey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Technology parity: mirror energy's per-diagnosis voice the same way infrastructure,
    // culture, finance, and economy do. Technology distinguishes chip shortage / compute
    // bottleneck / AI alignment failure / cyber breach / platform monopoly / supply disruption /
    // obsolescence / breakthrough via technology-brain diagnosisIndex (CYBER_ATTACK /
    // AI_ALIGNMENT_FAILURE / INFRASTRUCTURE_COLLAPSE / DATA_BREACH / CHIP_SHORTAGE /
    // PLATFORM_MONOPOLY). Classify the tech distress flavor from signal content and narrate a
    // technology-specific line instead of the generic. CLIENT-SIDE narration flavor only.
    if (detail.domain === 'technology') {
      var tkey = _classifyTechnologyDistress(detail.signals);
      if (tkey) {
        _narrate(tkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Defense parity: mirror energy's per-diagnosis voice the same way infrastructure, culture,
    // finance, economy, and technology do. Defense is the KINETIC/INDUSTRIAL/READINESS identity —
    // classify the defense distress flavor from signal content (force readiness / conflict
    // escalation / industrial-base strain / procurement breakdown / alliance fracture / kinetic
    // warfare) and narrate a defense-specific line instead of the generic. Kept DISTINCT from
    // intelligence (collection/analysis/espionage) and technology (cyber is a coupling). This is
    // CLIENT-SIDE narration flavor only — it never touches any scoring path.
    if (detail.domain === 'defense') {
      var dkey = _classifyDefenseDistress(detail.signals);
      if (dkey) {
        _narrate(dkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Intelligence parity: mirror energy's per-diagnosis voice the same way infrastructure,
    // culture, finance, economy, technology, and defense do. Intelligence is the COLLECTION/
    // ANALYSIS/ESPIONAGE identity — classify the intelligence distress flavor from signal
    // content (collection gap / analytical distortion / oversight failure / surveillance excess /
    // counterintelligence failure / adversarial penetration) and narrate an intelligence-specific
    // line instead of the generic. Kept DISTINCT from defense (kinetic/industrial/readiness) and
    // technology (cyber tooling is a coupling, not the identity). CLIENT-SIDE narration flavor only.
    if (detail.domain === 'intelligence') {
      var ikey = _classifyIntelligenceDistress(detail.signals);
      if (ikey) {
        _narrate(ikey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    _narrate('domain_distress', { domain: NAMES[detail.domain] || detail.domain }, PRIORITY_MEDIUM);
  }

  // Map raw infrastructure signal content → a civil distress voice key.
  // Civil vocabulary mirrors infrastructure-brain diagnosisIndex (GRID_DEGRADATION /
  // MAINTENANCE_DEFICIT / CYBER_PHYSICAL_ATTACK / TRANSPORTATION_DISRUPTION /
  // INFRA_FUNDING_COLLAPSE). Translates energy oil/gas/nuclear content to civil
  // grid/transport/water/funding equivalents. Returns a TEMPLATES key, or null.
  function _classifyInfraDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: cyber-physical and funding are sharpest, then transport,
    // grid, maintenance; fall back to a generic infrastructure line.
    if (/cyber|scada|sabotage|control[\s_-]?system|ics\b/.test(blob)) return 'infra_cyber_physical';
    if (/fund|fiscal|budget|bond|capex|capital|grant/.test(blob))      return 'infra_funding_collapse';
    if (/bridge|road|transit|transport|port|congestion|last[\s_-]?mile|modal/.test(blob)) return 'infra_transport_disruption';
    if (/grid|transmission|distribution|substation|transformer|reserve[\s_-]?margin|utility|reliability/.test(blob)) return 'infra_grid_degradation';
    if (/maintenance|deferred|deterioration|inspection|asset[\s_-]?condition|aging|backlog/.test(blob)) return 'infra_maintenance_deficit';
    return 'infra_generic';
  }

  // Map raw culture signal content → a cultural distress voice key.
  // Cultural vocabulary mirrors culture-brain diagnosisIndex (CULTURAL_ERASURE /
  // HERITAGE_DESTRUCTION / CENSORSHIP / IDENTITY_CRISIS / CREATIVE_STAGNATION) expressed
  // in the music/creator/attention-economy identity: virality, creator ecosystems, scene
  // health, fanbase cohesion, discourse/backlash. Translates energy oil/gas/grid content to
  // cultural equivalents. Returns a TEMPLATES key, or null.
  function _classifyCultureDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: backlash and viral collapse are sharpest, then fanbase fracture,
    // creator burnout, scene saturation; fall back to a generic culture line.
    if (/backlash|cancel|cancellation|outrage|controversy|discourse|pile[\s_-]?on/.test(blob)) return 'culture_backlash_spiral';
    if (/viral|trending|trend|breakout|momentum|hype|algorithm|reach[\s_-]?collapse/.test(blob)) return 'culture_viral_collapse';
    if (/fanbase|fandom|audience[\s_-]?(fracture|split)|tribal|tribe|fragmentation|defection|churn/.test(blob)) return 'culture_fanbase_fracture';
    if (/creator|artist|burnout|cadence|output|retention|exodus|attrition|stagnation/.test(blob)) return 'culture_creator_burnout';
    if (/scene|saturation|saturat|crowd|oversupply|genre[\s_-]?fatigue|discovery|attention/.test(blob)) return 'culture_scene_saturation';
    return 'culture_generic';
  }

  // Map raw finance signal content → a financial distress voice key.
  // Financial vocabulary covers the finance domain identity: capital markets, credit &
  // lending, banking, liquidity & solvency, investment & funding, M&A, payments & fintech,
  // corporate distress & default, and systemic financial risk. This is the narration flavor
  // ONLY — it sits alongside, and never alters, the validated P3 distress kernel (Thing1) or
  // any scoring path consumed by /api/limen/score. Translates energy oil/gas/grid content to
  // financial equivalents. Returns a TEMPLATES key, or null.
  function _classifyFinanceDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: solvency/default and credit spreads are sharpest, then margin/
    // collateral, deleveraging, counterparty, funding liquidity; fall back to a generic
    // finance line. Mirrors the energy/infra/culture classifier structure exactly.
    if (/solvency|insolvent|default|bankrupt|covenant|capital[\s_-]?adequacy|write[\s_-]?down|impairment/.test(blob)) return 'finance_solvency_crisis';
    if (/credit[\s_-]?spread|spread[\s_-]?widen|cds\b|yield|risk[\s_-]?premi|downgrade|rating/.test(blob)) return 'finance_credit_spread_widening';
    if (/margin[\s_-]?call|margin|collateral|haircut|repo|rehypothec/.test(blob)) return 'finance_margin_call_pressure';
    if (/delever|deleverag|forced[\s_-]?sale|fire[\s_-]?sale|unwind|liquidation[\s_-]?cascade|contagion/.test(blob)) return 'finance_deleveraging_cascade';
    if (/counterparty|settlement|bilateral|clearing|systemic|interbank/.test(blob)) return 'finance_counterparty_risk';
    if (/liquidity|funding|cash[\s_-]?crunch|market[\s_-]?depth|illiquid|run\b|withdrawal/.test(blob)) return 'finance_liquidity_crunch';
    return 'finance_generic';
  }

  // Map raw macro signal content → a macroeconomic distress voice key.
  // Macro vocabulary covers the ECONOMY domain identity: GDP & growth, inflation (CPI/PCE),
  // employment & labor markets, consumer & business sentiment, fiscal & monetary policy
  // (central banks, interest rates), the recession/expansion business cycle, trade, productivity,
  // money supply. Bound to REAL MACRO INDICATORS — FRED series ids (GDP, GDPC1, CPIAUCSL, PCEPI,
  // UNRATE, PAYEMS, FEDFUNDS, DGS10, UMCSENT, INDPRO) and broad-market proxies (SPY, DIA, TLT,
  // GLD) — NOT single-company tickers. This is the narration flavor ONLY and is kept DISTINCT
  // from finance (capital markets / credit / banks). Returns a TEMPLATES key, or null.
  function _classifyEconomyDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: stagflation (the joint price+output signature) first so it isn't
    // masked by a lone inflation or recession token; then credit crunch, inflation, recession,
    // employment, supply, policy, demand; fall back to a generic macro line. Mirrors the
    // energy/infra/culture/finance classifier structure exactly. Matches FRED-series shorthand
    // (cpiaucsl/pcepi/unrate/payems/fedfunds/dgs10/umcsent/indpro/gdpc1) alongside plain words.
    if (/stagflation|(stagnant|stalling|contracting).*(inflation|price)|(inflation|price).*(stagnant|stalling|contracting)/.test(blob)) return 'economy_stagflation';
    if (/credit[\s_-]?crunch|lending[\s_-]?(standard|tighten)|refinanc|spread[\s_-]?widen|tight(er|ening)?[\s_-]?credit|dgs10/.test(blob)) return 'economy_credit_crunch';
    if (/inflation|cpi|cpiaucsl|pce(pi)?|wage[\s_-]?price|price[\s_-]?(surge|level)|expectations[\s_-]?unanchor|deflation/.test(blob)) return 'economy_inflation';
    if (/recession|gdp|gdpc1|contraction|downturn|negative[\s_-]?growth|inventory[\s_-]?correction|indpro|industrial[\s_-]?production/.test(blob)) return 'economy_recession';
    if (/unemploy|unrate|jobless|payems|payroll|labor[\s_-]?(force|market)|layoff|hiring[\s_-]?freeze|wage[\s_-]?stagnation/.test(blob)) return 'economy_employment_deterioration';
    if (/supply[\s_-]?(chain|disruption|shock)|producer[\s_-]?price|ppi\b|input[\s_-]?shortage|bottleneck/.test(blob)) return 'economy_supply_disruption';
    if (/policy|fedfunds|fed[\s_-]?funds|rate[\s_-]?(hike|cut|miscalibrat|path)|central[\s_-]?bank|fiscal[\s_-]?cliff|monetary/.test(blob)) return 'economy_policy_error';
    if (/demand[\s_-]?weak|consumer[\s_-]?(confidence|sentiment)|umcsent|capex[\s_-]?(pause|pullback)|investment[\s_-]?pullback|business[\s_-]?sentiment/.test(blob)) return 'economy_demand_weakness';
    return 'economy_generic';
  }

  // Map raw technology signal content → a technology distress voice key.
  // Tech vocabulary covers the TECHNOLOGY domain identity: semiconductors & compute (fabs, GPUs/
  // TPUs, wafer/foundry supply), AI/ML (training, inference, alignment, autonomy), software & cloud,
  // hardware & devices, cybersecurity, R&D & innovation pipelines, platform networks, data
  // infrastructure. Maps to technology-brain diagnosisIndex (CYBER_ATTACK / AI_ALIGNMENT_FAILURE /
  // INFRASTRUCTURE_COLLAPSE / DATA_BREACH / CHIP_SHORTAGE / PLATFORM_MONOPOLY) plus emergence/
  // obsolescence flavors. Recognizes real tech tickers (NVDA, AVGO, AMD, INTC, TSM, ASML, MSFT,
  // GOOGL, META, AMZN, ORCL, CRM, AAPL, PLTR, CRWD, PANW). Technology COUPLES to energy via compute
  // demand but keeps its own identity (chips/AI/software/cyber) and stays DISTINCT from finance.
  // This is the narration flavor ONLY — it never touches any scoring path. Returns a TEMPLATES key.
  function _classifyTechnologyDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: AI alignment and cyber/data breach are sharpest, then chip shortage,
    // compute bottleneck, platform monopoly, supply disruption, breakthrough emergence,
    // obsolescence; fall back to a generic technology line. Mirrors the energy/infra/culture/
    // finance/economy classifier structure exactly. Matches real tech tickers alongside plain words.
    if (/ai[\s_-]?(alignment|safety|misalign)|alignment[\s_-]?(failure|gap|risk)|autonomy[\s_-]?(overreach|escalat)|bias[\s_-]?amplif|model[\s_-]?(drift|behavior)|rogue[\s_-]?(model|agent)/.test(blob)) return 'tech_ai_alignment_failure';
    if (/cyber|breach|ransomware|intrusion|exfiltrat|credential[\s_-]?compromise|data[\s_-]?(breach|leak)|privacy[\s_-]?exposure|crwd|panw|zero[\s_-]?day|malware|phishing/.test(blob)) return 'tech_cyber_breach';
    if (/chip|semiconductor|wafer|foundry|fab\b|node[\s_-]?(shrink|process)|tsm|asml|nvda|avgo|amd|intc|lithography/.test(blob)) return 'tech_chip_shortage';
    if (/compute|gpu|tpu|accelerator|training[\s_-]?(run|cluster)|inference|cloud[\s_-]?(quota|capacity)|datacenter[\s_-]?(constraint|capacity)|fly\b/.test(blob)) return 'tech_compute_bottleneck';
    if (/platform|monopoly|lock[\s_-]?in|antitrust|market[\s_-]?concentration|app[\s_-]?store|gatekeeper|googl|meta\b|amzn|aapl|msft/.test(blob)) return 'tech_platform_monopoly';
    if (/supply[\s_-]?(chain|disruption|shock|constraint)|component[\s_-]?(scarcity|shortage)|manufacturing[\s_-]?bottleneck|hardware[\s_-]?supply|logistics|export[\s_-]?control/.test(blob)) return 'tech_supply_disruption';
    if (/breakthrough|emergence|step[\s_-]?change|frontier[\s_-]?(model|capab)|state[\s_-]?of[\s_-]?the[\s_-]?art|capability[\s_-]?(leap|jump)|innovation[\s_-]?surge|paradigm[\s_-]?shift/.test(blob)) return 'tech_breakthrough_emergence';
    if (/obsolesc|legacy[\s_-]?(stack|system|hardware)|deprecat|end[\s_-]?of[\s_-]?life|aging[\s_-]?(hardware|infra)|technical[\s_-]?debt|refresh[\s_-]?cycle|stagnant[\s_-]?stack/.test(blob)) return 'tech_obsolescence_acceleration';
    return 'tech_generic';
  }

  // Map raw defense signal content → a defense distress voice key.
  // Defense vocabulary covers the DEFENSE domain identity: military spending & procurement,
  // the defense industrial base, geopolitical conflict & deterrence, weapons systems, military
  // readiness & sustainment, alliances & basing, electronic/kinetic warfare, strategic deterrence.
  // Recognizes real defense primes/suppliers as tickers (LMT, RTX, NOC, GD, BA, LHX, HII, LDOS,
  // BAH, KTOS, AVAV). Defense COUPLES to energy via fuel/strategic-reserve and to technology via
  // cyber, but keeps its own kinetic/industrial/readiness identity and stays DISTINCT from
  // intelligence (collection/analysis/espionage) and technology (cyber = coupling). Mirrors the
  // energy/infra/culture/finance/economy/technology classifier structure exactly. Returns a
  // TEMPLATES key, or null. CLIENT-SIDE narration flavor only — never touches any scoring path.
  function _classifyDefenseDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: active kinetic warfare and conflict escalation are sharpest, then
    // readiness, procurement, industrial-base strain, alliance fracture; fall back to a generic
    // defense line. Matches real defense tickers (lmt/rtx/noc/gd/lhx/hii/ldos/bah/ktos/avav) and
    // 'ba' as a word-boundary token to avoid colliding with substrings.
    if (/kinetic|missile[\s_-]?(strike|barrage)|airstrike|attrition|platform[\s_-]?loss|combat[\s_-]?loss|weapons[\s_-]?expenditure|live[\s_-]?fire|engagement[\s_-]?rate/.test(blob)) return 'defense_kinetic_warfare';
    if (/conflict[\s_-]?(escalat|outbreak)|escalation|deterrence|war[\s_-]?(risk|footing)|geopolitical|invasion|mobiliz|theater[\s_-]?tension|flashpoint|nuclear[\s_-]?posture/.test(blob)) return 'defense_conflict_escalation';
    if (/readiness|munition|sustainment|stockpile[\s_-]?(depletion|draw)|maintenance[\s_-]?backlog|operational[\s_-]?tempo|optempo|fleet[\s_-]?availability|spares[\s_-]?shortage|modernization[\s_-]?gap/.test(blob)) return 'defense_readiness_drop';
    if (/procurement|acquisition|cost[\s_-]?overrun|program[\s_-]?(cancel|delay|breach)|nunn[\s_-]?mccurdy|schedule[\s_-]?slip|contract[\s_-]?award|budget[\s_-]?cut|sequester/.test(blob)) return 'defense_procurement_breakdown';
    if (/industrial[\s_-]?base|supplier[\s_-]?(consolidat|capacity)|shipyard|foundry[\s_-]?(closure|strain)|sub[\s_-]?tier|capacity[\s_-]?strain|throughput[\s_-]?limit|lmt|rtx|noc|gd\b|lhx|hii|ldos|bah|ktos|avav/.test(blob)) return 'defense_industrial_strain';
    if (/alliance|nato|coalition|basing|access[\s_-]?(denial|loss)|burden[\s_-]?sharing|treaty|allied[\s_-]?(withdrawal|fracture)|partner[\s_-]?nation/.test(blob)) return 'defense_alliance_fracture';
    return 'defense_generic';
  }

  // Map raw intelligence signal content → an intelligence distress voice key.
  // Intelligence vocabulary covers the INTELLIGENCE domain identity: intelligence collection
  // (SIGINT/HUMINT/GEOINT/OSINT/MASINT), all-source analysis & assessment, espionage &
  // counterintelligence, surveillance & reconnaissance (ISR), threat warning & indications,
  // covert action, information & influence operations, security clearance & insider risk.
  // Anchored to the five portal diagnosis families (collection_gap / analytical_distortion /
  // oversight_failure / surveillance_excess + trust_boundary_breach / network_intrusion +
  // counterintelligence). Recognizes real intel-sector tickers (PLTR, BAH, LDOS, CACI, SAIC,
  // KBR, VRNT, NICE, VRSK). Intelligence COUPLES to defense via threat warning and to technology
  // via cyber tooling, but keeps its own collection/analysis/espionage identity and stays DISTINCT
  // from defense (kinetic/industrial/readiness) and technology (cyber tooling = coupling). Mirrors
  // the energy/infra/culture/finance/economy/technology/defense classifier structure exactly.
  // Returns a TEMPLATES key, or null. CLIENT-SIDE narration flavor only — never touches scoring.
  function _classifyIntelligenceDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: counterintelligence breach and adversarial penetration are sharpest
    // (sources/methods + foreign penetration), then surveillance overreach, oversight failure,
    // analytical distortion, collection gap; fall back to a generic intelligence line. Matches
    // real intel-sector tickers (pltr/bah/ldos/caci/saic/kbr/vrnt/nice/vrsk) alongside plain words,
    // with word boundaries on short tokens to avoid substring collisions.
    if (/counterintelligence|counter[\s_-]?intel|mole|insider[\s_-]?(threat|risk)|sources[\s_-]?and[\s_-]?methods|clearance[\s_-]?(compromise|breach)|defector|double[\s_-]?agent|leak[\s_-]?investigation|whistleblower[\s_-]?exposure/.test(blob)) return 'intel_counterintelligence_failure';
    if (/foreign[\s_-]?(interference|influence)|cyber[\s_-]?espionage|network[\s_-]?intrusion|adversary[\s_-]?penetration|hostile[\s_-]?service|exfiltrat|implant|supply[\s_-]?chain[\s_-]?compromise|nation[\s_-]?state[\s_-]?actor|trust[\s_-]?boundary/.test(blob)) return 'intel_adversarial_penetration';
    if (/surveillance[\s_-]?(excess|overreach|scandal)|bulk[\s_-]?collection|mass[\s_-]?surveillance|domestic[\s_-]?(spying|collection)|warrantless|minimization|fisa|privacy[\s_-]?(violation|overreach)|fourth[\s_-]?amendment/.test(blob)) return 'intel_surveillance_excess';
    if (/oversight[\s_-]?(failure|gap)|authorization[\s_-]?gap|accountability|audit[\s_-]?(gap|failure)|congressional[\s_-]?oversight|inspector[\s_-]?general|unauthorized[\s_-]?(access|collection)|legal[\s_-]?authority/.test(blob)) return 'intel_oversight_failure';
    if (/analyt|assessment[\s_-]?(bias|distortion)|politiciz|confidence[\s_-]?(drift|inflation)|cognitive[\s_-]?bias|groupthink|intelligence[\s_-]?(failure|surprise)|warning[\s_-]?failure|estimate[\s_-]?error|pltr|vrnt|nice|vrsk/.test(blob)) return 'intel_analytical_distortion';
    if (/collection[\s_-]?(gap|shortfall)|sigint|humint|geoint|osint|masint|isr\b|coverage[\s_-]?gap|source[\s_-]?(loss|recruitment)|reconnaissance|tasking|denied[\s_-]?area|bah|ldos|caci|saic|kbr/.test(blob)) return 'intel_collection_gap';
    return 'intel_generic';
  }

  function _onGlobalStateUpdate(e) {
    var detail = e.detail;
    if (!detail || !detail.mode) return;
    // Only narrate when the mode actually changes, not on every 6s cycle
    if (detail.mode === _lastGlobalMode) return;
    _lastGlobalMode = detail.mode;
    _narrate('global_shift', { state: detail.mode }, PRIORITY_MEDIUM);
  }

  function _onEventAction(e) {
    var detail = e.detail;
    if (!detail || !detail.event) return;
    var evt = detail.event;
    var label = (evt.type || '').replace(/_/g, ' ');
    if (detail.action === 'start') {
      _narrate('event_start', { event: label }, PRIORITY_MEDIUM);
    } else if (detail.action === 'end') {
      _narrate('event_end', { event: label }, PRIORITY_LOW);
    }
  }

  function _onFeedStateChange(e) {
    var detail = e.detail;
    if (!detail) return;
    if (detail.to === 'degraded') {
      _narrate('feed_degradation', {}, PRIORITY_HIGH);
    } else if (detail.to === 'hydrated') {
      // Recovery from degraded OR initial hydration both trigger speech
      _narrate(detail.from === 'degraded' ? 'feed_recovery' : 'feed_hydrated', {}, PRIORITY_MEDIUM);
    }
  }

  function _onFeedHydrated(e) {
    // Primary trigger: feeds come online (fires once per page load)
    _narrate('feed_hydrated', {}, PRIORITY_MEDIUM);
  }

  function _onRegulationUpdate(e) {
    var detail = e.detail;
    if (!detail || !detail.state) return;
    var key = 'regulation_' + detail.state;
    // Only narrate meaningful transitions
    if (detail.state === 'unknown') return;
    _narrate(key, {}, PRIORITY_LOW);
  }

  // ─── Voice control UI ───────────────────────────────────────────────────

  function _ensureControl() {
    if (_controlEl) return;
    _controlEl = document.createElement('div');
    _controlEl.id = 'limen-voice-control';
    _controlEl.style.cssText = [
      'position:fixed',
      'bottom:4px',
      'right:12px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.38rem',
      'letter-spacing:1.2px',
      'z-index:9998',
      'pointer-events:auto',
      'display:flex',
      'gap:4px',
      'align-items:center'
    ].join(';');

    _renderControl();
    document.body.appendChild(_controlEl);
  }

  function _renderControl() {
    if (!_controlEl) return;

    var dim = 'rgba(201,169,78,0.35)';
    var active = 'rgba(201,169,78,0.7)';
    var btnBase = 'background:rgba(201,169,78,0.06);border:1px solid rgba(201,169,78,0.12);' +
      'color:{color};font-family:"IBM Plex Mono",monospace;font-size:0.36rem;' +
      'letter-spacing:1.2px;padding:2px 6px;cursor:pointer;border-radius:2px;' +
      'transition:background 0.2s,color 0.2s';

    var html = '';

    // Mute toggle
    var muteLabel = _muted ? 'MUTED' : 'VOICE';
    var muteColor = _muted ? 'rgba(232,84,84,0.6)' : dim;
    html += '<button id="limen-voice-mute" style="' + btnBase.replace('{color}', muteColor) + '">' + muteLabel + '</button>';

    // Mode buttons
    for (var i = 0; i < MODES.length; i++) {
      var m = MODES[i];
      var color = (m === _mode) ? active : dim;
      html += '<button class="limen-voice-mode" data-mode="' + m + '" style="' + btnBase.replace('{color}', color) + '">' + m.toUpperCase() + '</button>';
    }

    _controlEl.innerHTML = html;

    // Bind mute
    var muteBtn = document.getElementById('limen-voice-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        _muted = !_muted;
        if (_muted) _voiceBackend.cancel();
        _renderControl();
      });
    }

    // Bind mode buttons
    var modeBtns = _controlEl.querySelectorAll('.limen-voice-mode');
    for (var b = 0; b < modeBtns.length; b++) {
      modeBtns[b].addEventListener('click', function () {
        var newMode = this.getAttribute('data-mode');
        if (MODES.indexOf(newMode) !== -1) {
          _mode = newMode;
          if (_mode === 'silent') _voiceBackend.cancel();
          _renderControl();
        }
      });
    }
  }

  // ─── Public API: mode and mute control ──────────────────────────────────

  function setMode(mode) {
    if (MODES.indexOf(mode) === -1) return;
    _mode = mode;
    if (_mode === 'silent') _voiceBackend.cancel();
    _renderControl();
  }

  function getMode() {
    return _mode;
  }

  function setMuted(muted) {
    _muted = !!muted;
    if (_muted) _voiceBackend.cancel();
    _renderControl();
  }

  function isMuted() {
    return _muted;
  }

  // Allow external modules to inject narration
  function speak(text, priority) {
    if (!text || _mode === 'silent') return;
    var prio = priority || PRIORITY_MEDIUM;
    var now = Date.now();
    if (_recentMessages[text] && (now - _recentMessages[text]) < 30000) return;
    _recentMessages[text] = now;
    _queue.push({ text: text, priority: prio, timestamp: now });
    _queue.sort(function (a, b) {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });
    while (_queue.length > MAX_QUEUE) _queue.pop();
    _dispatch('limen:narrator-speak', { text: text, priority: prio, mode: _mode });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function start() {
    if (_interval) return;

    // Initialize voice backend
    _voiceBackend.init();

    // Create UI control
    _ensureControl();

    // Listen for system events
    window.addEventListener('limen:escalation-shift', _onEscalationShift);
    window.addEventListener('limen:domain-distress', _onDomainDistress);
    window.addEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.addEventListener('limen:event', _onEventAction);
    window.addEventListener('limen:feed-hydrated', _onFeedHydrated);
    window.addEventListener('limen:feed-state-change', _onFeedStateChange);
    window.addEventListener('limen:regulation-update', _onRegulationUpdate);

    // Catch up: if feeds already hydrated before we started listening,
    // queue the hydration narration now (bootstrap starts us last)
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.isHydrated === 'function' && fs.isHydrated()) {
      _narrate('feed_hydrated', {}, PRIORITY_MEDIUM);
    }

    // Seed _lastGlobalMode from current state so we don't
    // narrate "shifted to stable" on the first routine update
    var gs = window.LIMENGlobalState;
    if (gs && gs.mode) {
      _lastGlobalMode = gs.mode;
    }

    // Process queue periodically
    _interval = setInterval(_processQueue, 1000);
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    _voiceBackend.cancel();
    window.removeEventListener('limen:escalation-shift', _onEscalationShift);
    window.removeEventListener('limen:domain-distress', _onDomainDistress);
    window.removeEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.removeEventListener('limen:event', _onEventAction);
    window.removeEventListener('limen:feed-hydrated', _onFeedHydrated);
    window.removeEventListener('limen:feed-state-change', _onFeedStateChange);
    window.removeEventListener('limen:regulation-update', _onRegulationUpdate);
    if (_controlEl && _controlEl.parentNode) {
      _controlEl.parentNode.removeChild(_controlEl);
      _controlEl = null;
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENConsoleNarrator = {
    start: start,
    stop: stop,
    setMode: setMode,
    getMode: getMode,
    setMuted: setMuted,
    isMuted: isMuted,
    speak: speak,

    // For future TTS swap-in
    setVoiceBackend: function (backend) {
      if (backend && typeof backend.speak === 'function') {
        _voiceBackend.cancel();
        _voiceBackend = backend;
      }
    }
  };

})();
