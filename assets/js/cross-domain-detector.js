/**
 * cross-domain-detector.js
 * LIMEN HELIX — Cross-Domain Pattern Detector
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Detects correlated stress patterns across domains using live feed data.
 * Requires 2 consecutive ticks above threshold to trigger.
 * Factors in stress value, trend direction, freshness, and source confidence.
 *
 * Depends on: window.LIMENDomains, window.LIMENSourceAudit
 * Listens: limen:domain-update
 * Emits: limen:cross-domain-signal, limen:opportunity-detected
 *
 * Renders: compact SYSTEMIC SIGNALS panel (top 3 active patterns)
 *
 * Load order: after domain-signal-engine.js
 */

(function () {
  'use strict';

  // ─── Pattern definitions ─────────────────────────────────────────────────

  var PATTERNS = [
    {
      id: 'energy_supply',
      domains: ['energy', 'supplyChain'],
      threshold: 0.45,
      pattern: 'logistics disruption',
      drivers: ['oil price pressure', 'freight cost elevation', 'fuel supply stress'],
      options: [
        { label: 'trace supply chain exposure', type: 'analysis' },
        { label: 'investigate energy drivers', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'economy_liquidity',
      domains: ['economy', 'supplyChain'],
      threshold: 0.50,
      pattern: 'financial tightening',
      drivers: ['employment contraction', 'logistics cost pressure', 'demand-supply imbalance'],
      options: [
        { label: 'analyze liquidity indicators', type: 'analysis' },
        { label: 'monitor credit conditions', type: 'monitoring' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'health_research',
      domains: ['health', 'research'],
      threshold: 0.40,
      pattern: 'medical innovation cluster',
      drivers: ['adverse event reporting surge', 'publication rate acceleration', 'clinical activity spike'],
      options: [
        { label: 'explore emerging treatments', type: 'discovery' },
        { label: 'trace research-clinical pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'environment_energy',
      domains: ['environment', 'energy'],
      threshold: 0.45,
      pattern: 'climate-resource pressure',
      drivers: ['weather disruption', 'energy demand volatility', 'infrastructure strain'],
      options: [
        { label: 'map climate-energy exposure', type: 'analysis' },
        { label: 'investigate renewable transition', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'tech_research',
      domains: ['technology', 'research'],
      threshold: 0.35,
      pattern: 'innovation acceleration',
      drivers: ['patent activity surge', 'research volume spike', 'disruption cycle signal'],
      options: [
        { label: 'explore technology frontiers', type: 'discovery' },
        { label: 'trace research-to-market pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'economy_health',
      domains: ['economy', 'health'],
      threshold: 0.55,
      pattern: 'economic-health stress',
      drivers: ['labor market pressure', 'healthcare system load', 'public health expenditure stress'],
      options: [
        { label: 'investigate health-economy linkage', type: 'analysis' },
        { label: 'monitor workforce health indicators', type: 'monitoring' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Patterns from civilization connectome (new 13 domains) ────────
    {
      id: 'governance_economy',
      domains: ['governance', 'economy'],
      threshold: 0.45,
      pattern: 'policy-market feedback',
      drivers: ['regulatory intervention', 'fiscal policy shift', 'institutional instability'],
      options: [
        { label: 'trace governance-market linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_energy',
      domains: ['infrastructure', 'energy'],
      threshold: 0.45,
      pattern: 'infrastructure-energy dependency',
      drivers: ['grid strain', 'utility capacity pressure', 'transport-energy coupling'],
      options: [
        { label: 'map infrastructure-energy exposure', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_environment',
      domains: ['infrastructure', 'environment'],
      threshold: 0.45,
      pattern: 'infrastructure-environment coupling',
      drivers: ['water main failure', 'treatment plant capacity', 'flood mitigation deficit', 'climate adaptation barrier', 'stormwater overflow'],
      options: [
        { label: 'map infrastructure-environment exposure', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_governance',
      domains: ['infrastructure', 'governance'],
      threshold: 0.50,
      pattern: 'infrastructure-governance stress',
      drivers: ['permitting delay', 'regulatory constraint', 'funding gap', 'deferred maintenance mandate', 'zoning conflict'],
      options: [
        { label: 'trace infrastructure-governance linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_law',
      domains: ['infrastructure', 'law'],
      threshold: 0.45,
      pattern: 'infrastructure-legal coupling',
      drivers: ['liability exposure', 'compliance violation', 'contract dispute', 'enforcement action', 'bond covenant breach'],
      options: [
        { label: 'trace infrastructure-law linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_economy',
      domains: ['infrastructure', 'economy'],
      threshold: 0.50,
      pattern: 'infrastructure-economic transmission',
      drivers: ['construction employment decline', 'material cost pressure', 'capital unavailable', 'deferred maintenance cost shadow', 'project cancellation'],
      options: [
        { label: 'trace infrastructure-economy linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_agriculture',
      domains: ['infrastructure', 'agriculture'],
      threshold: 0.45,
      pattern: 'infrastructure-agriculture coupling',
      drivers: ['irrigation capacity decline', 'drainage system failure', 'rural road deterioration', 'storage capacity shortage', 'transport access loss'],
      options: [
        { label: 'map infrastructure-agriculture exposure', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_research',
      domains: ['infrastructure', 'research'],
      threshold: 0.40,
      pattern: 'infrastructure innovation cluster',
      drivers: ['research funding pressure', 'aging-asset data scarcity', 'resilience solution gap', 'sensor-tech adoption lag', 'infrastructure modeling lag'],
      options: [
        { label: 'trace infrastructure-research pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_education',
      domains: ['infrastructure', 'education'],
      threshold: 0.45,
      pattern: 'infrastructure workforce pipeline stress',
      drivers: ['engineer shortage', 'technician training gap', 'skill mismatch', 'curriculum lag', 'apprenticeship enrollment decline'],
      options: [
        { label: 'trace infrastructure-education pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'agriculture_population',
      domains: ['agriculture', 'population'],
      threshold: 0.45,
      pattern: 'food-population pressure',
      drivers: ['crop yield decline', 'population growth', 'food distribution stress'],
      options: [
        { label: 'analyze food security indicators', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'industry_economy',
      domains: ['industry', 'economy'],
      threshold: 0.50,
      pattern: 'industrial-economic contraction',
      drivers: ['manufacturing decline', 'demand erosion', 'employment contraction'],
      options: [
        { label: 'trace industrial output drivers', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'finance_economy',
      domains: ['finance', 'economy'],
      threshold: 0.50,
      pattern: 'financial-economic coupling',
      drivers: ['credit tightening', 'market volatility', 'capital flow disruption'],
      options: [
        { label: 'investigate financial contagion', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'defense_intelligence',
      domains: ['defense', 'intelligence'],
      threshold: 0.40,
      pattern: 'security-intelligence escalation',
      drivers: ['threat level elevation', 'information warfare signals', 'surveillance spike'],
      options: [
        { label: 'assess strategic posture', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'law_governance',
      domains: ['law', 'governance'],
      threshold: 0.45,
      pattern: 'regulatory-governance stress',
      drivers: ['compliance burden', 'legislative instability', 'enforcement pressure'],
      options: [
        { label: 'trace regulatory impact chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'communication_culture',
      domains: ['communication', 'culture'],
      threshold: 0.40,
      pattern: 'media-cultural fragmentation',
      drivers: ['narrative divergence', 'misinformation pressure', 'social cohesion strain'],
      options: [
        { label: 'analyze information ecosystem', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'education_research',
      domains: ['education', 'research'],
      threshold: 0.35,
      pattern: 'knowledge pipeline stress',
      drivers: ['funding pressure', 'enrollment shifts', 'research output variance'],
      options: [
        { label: 'trace education-research pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'religion_population',
      domains: ['religion', 'population'],
      threshold: 0.40,
      pattern: 'demographic-moral tension',
      drivers: ['value system pressure', 'demographic transition', 'institutional trust erosion'],
      options: [
        { label: 'investigate social cohesion', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'supplyChain_agriculture',
      domains: ['supplyChain', 'agriculture'],
      threshold: 0.45,
      pattern: 'food logistics disruption',
      drivers: ['freight cost spike', 'cold chain stress', 'distribution bottleneck'],
      options: [
        { label: 'map food supply chain exposure', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'intelligence_governance',
      domains: ['intelligence', 'governance'],
      threshold: 0.40,
      pattern: 'intelligence-governance loop',
      drivers: ['data integrity pressure', 'policy information gap', 'surveillance-state tension'],
      options: [
        { label: 'assess information-policy coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'finance_law',
      domains: ['finance', 'law'],
      threshold: 0.45,
      pattern: 'financial-regulatory coupling',
      drivers: ['compliance cost escalation', 'enforcement activity surge', 'market regulation pressure'],
      options: [
        { label: 'trace financial regulatory impact', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Culture pairs (parity port; mirrors energy/infrastructure structure) ──
    {
      id: 'culture_research',
      domains: ['culture', 'research'],
      threshold: 0.35,
      pattern: 'creative innovation acceleration',
      drivers: ['production-tool breakthrough', 'sonic innovation spike', 'critical-discourse surge', 'taste-making acceleration', 'scene-maturation lag'],
      options: [
        { label: 'explore emerging genres & creators', type: 'discovery' },
        { label: 'trace research-to-creation pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_technology',
      domains: ['culture', 'technology'],
      threshold: 0.45,
      pattern: 'creative-technology dependency',
      drivers: ['distribution-platform strain', 'streaming codec failure', 'production hardware shortage', 'venue-tech capacity loss', 'new-tool adoption surge'],
      options: [
        { label: 'map creative-technology exposure', type: 'analysis' },
        { label: 'investigate virality acceleration', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_finance',
      domains: ['culture', 'finance'],
      threshold: 0.50,
      pattern: 'creative-economy capital coupling',
      drivers: ['arts funding contraction', 'patronage collapse', 'crowdfunding platform stress', 'creative-institution failure', 'capital flow disruption'],
      options: [
        { label: 'investigate creative-finance feedback', type: 'analysis' },
        { label: 'trace scene-expansion capital', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_population',
      domains: ['culture', 'population'],
      threshold: 0.45,
      pattern: 'cultural-participation shift',
      drivers: ['fanbase composition shift', 'generational taste change', 'participation decay', 'heritage loss', 'audience youth bulge'],
      options: [
        { label: 'analyze audience & fanbase indicators', type: 'analysis' },
        { label: 'investigate participation surge', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_governance',
      domains: ['culture', 'governance'],
      threshold: 0.50,
      pattern: 'culture-governance stress',
      drivers: ['arts funding cuts', 'censorship pressure', 'creative-freedom policy shift', 'permit/venue denial', 'institutional legitimacy erosion'],
      options: [
        { label: 'trace culture-governance linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_education',
      domains: ['culture', 'education'],
      threshold: 0.45,
      pattern: 'creative-literacy pipeline stress',
      drivers: ['artist-training gap', 'music-education deficit', 'taste-formation decline', 'media literacy erosion', 'norm-transmission failure'],
      options: [
        { label: 'trace culture-education pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_economy',
      domains: ['culture', 'economy'],
      threshold: 0.50,
      pattern: 'creative-economy transmission',
      drivers: ['venue employment collapse', 'artist revenue decline', 'streaming-royalty pressure', 'sponsorship erosion', 'label/venue closure spike'],
      options: [
        { label: 'trace culture-economy linkage', type: 'analysis' },
        { label: 'investigate creator income growth', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_religion',
      domains: ['culture', 'religion'],
      threshold: 0.40,
      pattern: 'cultural-moral identity tension',
      drivers: ['value conflict', 'ritual confusion', 'identity fracture', 'sacred-music participation decay', 'moral coherence strain'],
      options: [
        { label: 'investigate culture-religion feedback', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    }
  ];

  // ─── State ───────────────────────────────────────────────────────────────

  var _prevAbove = {};          // curated pairs (index-keyed)
  var _sessionTriggered = {};   // curated pairs (index-keyed)
  var _meshAbove = {};          // mesh pairs + clusters (string-keyed)
  var _meshTrig = {};           // mesh pairs + clusters (string-keyed)
  var _activePatterns = [];
  var _idCounter = 0;
  var _panelEl = null;

  for (var p = 0; p < PATTERNS.length; p++) {
    _prevAbove[p] = false;
  }

  // ─── Mesh config: full-web sensing beyond the curated pairs ───────────────
  var DOMAIN_LIST = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
  var MESH_THRESHOLD = 0.6;   // any non-curated pair both above this co-stresses (the web)
  var CLUSTER_MIN = 3;        // a shared-driver cluster needs >= N co-affected domains
  var CYBER_RE = /\b(cve|kev|ransomware|vulnerab|exploit|cyber)\b/i;

  function _pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  var _curatedPairKey = {};
  for (var _ci = 0; _ci < PATTERNS.length; _ci++) { _curatedPairKey[_pairKey(PATTERNS[_ci].domains[0], PATTERNS[_ci].domains[1])] = true; }

  // Truth-preferred stress reader (module-scope twin of detect()'s inner reader).
  function _stressOf(domainId, slot, packets) {
    var pk = packets[domainId];
    if (pk && pk.truth && typeof pk.truth.stressScore === 'number') return pk.truth.stressScore;
    if (pk && typeof pk.stressScore === 'number') return pk.stressScore;
    if (slot && typeof slot.brainStress === 'number') return slot.brainStress;
    if (slot && typeof slot.stress === 'number') return slot.stress;
    return 0;
  }
  // A live cyber feed in this domain's sources/feeds, or a cyber keyword in its signals.
  function _cyberHit(slot) {
    var srcs = slot.sources || slot.brainFeeds || slot._channels || [];
    if (Array.isArray(srcs)) {
      for (var i = 0; i < srcs.length; i++) {
        var s = srcs[i]; if (!s) continue;
        var idt = ((s.name || '') + ' ' + (s.label || '')).trim();
        if (s.live !== false && CYBER_RE.test(idt)) return { label: (s.label || s.name || '').slice(0, 60) };
      }
    }
    var sigs = slot.signals || [];
    if (Array.isArray(sigs)) {
      for (var j = 0; j < sigs.length; j++) {
        var t = (typeof sigs[j] === 'string') ? sigs[j] : (sigs[j] && (sigs[j].signal || sigs[j].label) || '');
        if (CYBER_RE.test(t)) return { label: String(t).slice(0, 60) };
      }
    }
    return null;
  }

  // ─── Detection logic ──────────────────────────────────────────────────

  function detect() {
    var domains = window.LIMENDomains || {};
    var audit = window.LIMENSourceAudit || {};
    var packets = (window.LIMENCivilizationAdapter && window.LIMENCivilizationAdapter.getAll())
                || window.LIMENCivilizationPackets || {};
    var newActive = [];

    // Truth-preferred stress reader: brain via packet truth.stressScore wins
    // over the flat LIMENDomains[id].stress (which can be civ-side / older).
    function _truthStress(domainId, slot) {
      var p = packets[domainId];
      if (p && p.truth && typeof p.truth.stressScore === 'number') return p.truth.stressScore;
      if (p && typeof p.stressScore === 'number') return p.stressScore;
      if (slot && typeof slot.brainStress === 'number') return slot.brainStress;
      if (slot && typeof slot.stress === 'number') return slot.stress;
      return 0;
    }

    for (var i = 0; i < PATTERNS.length; i++) {
      var pat = PATTERNS[i];
      var dA = domains[pat.domains[0]];
      var dB = domains[pat.domains[1]];

      var stressA = _truthStress(pat.domains[0], dA);
      var stressB = _truthStress(pat.domains[1], dB);

      // Both domains must be materially elevated
      var isAbove = stressA >= pat.threshold && stressB >= pat.threshold;

      // Factor in trend — co-rising amplifies, divergent dampens
      var trendA = (dA && dA.trend) || 0;
      var trendB = (dB && dB.trend) || 0;
      var coRising = trendA > 0.02 && trendB > 0.02;

      // Factor in source confidence
      var confA = (dA && dA.confidence) || 0;
      var confB = (dB && dB.confidence) || 0;
      var avgConf = (confA + confB) / 2;

      // Compute severity: average stress weighted by confidence
      var rawSeverity = (stressA + stressB) / 2;
      var severity = _clamp(Math.round(rawSeverity * avgConf * 100) / 100, 0, 1);
      // Boost if co-rising
      if (coRising) severity = _clamp(severity + 0.08, 0, 1);

      // Combined confidence from source confidence and co-trend
      var patternConf = _clamp(Math.round(avgConf * (coRising ? 1.1 : 0.9) * 100) / 100, 0, 1);

      // Require 2 consecutive ticks above threshold
      if (isAbove && _prevAbove[i]) {
        // Build drivers from actual domain signals
        var liveDrivers = _buildLiveDrivers(pat, dA, dB);

        var signal = {
          id: pat.id + '_' + (++_idCounter),
          patternId: pat.id,
          domains: pat.domains.slice(),
          pattern: pat.pattern,
          severity: severity,
          confidence: patternConf,
          drivers: liveDrivers,
          options: pat.options,
          stressA: stressA,
          stressB: stressB,
          sourceStatusA: (audit[pat.domains[0]] && audit[pat.domains[0]].status) || 'FALLBACK',
          sourceStatusB: (audit[pat.domains[1]] && audit[pat.domains[1]].status) || 'FALLBACK',
          updated: Date.now()
        };

        newActive.push(signal);

        // Emit only on first trigger per session
        if (!_sessionTriggered[i]) {
          _sessionTriggered[i] = true;
          _dispatch('limen:cross-domain-signal', signal);
          // Also emit legacy event for narrator compatibility
          _dispatch('limen:opportunity-detected', {
            type: 'systemic',
            domains: pat.domains.slice(),
            label: pat.pattern,
            description: pat.domains[0] + ' and ' + pat.domains[1] + ' show correlated stress',
            confidence: patternConf,
            signal: signal,
            timestamp: Date.now()
          });
        }
      } else if (!isAbove) {
        _sessionTriggered[i] = false;
      }

      _prevAbove[i] = isAbove;
    }

    // ── 2) DYNAMIC MESH + 3) SHARED-DRIVER CLUSTER — full-web sensing ──
    _detectMesh(domains, packets, audit, newActive);
    _detectCyberCluster(domains, packets, audit, newActive);

    // Sort by severity descending
    newActive.sort(function (a, b) { return b.severity - a.severity; });
    _activePatterns = newActive.slice(0, 8);

    window.LIMENCrossDomain = {
      active: _activePatterns,
      all: newActive.slice(),
      patterns: PATTERNS,
      timestamp: Date.now()
    };

    _renderPanel();
  }

  function _buildLiveDrivers(pat, dA, dB) {
    var drivers = [];
    // Pull real signals from domain data
    var sigA = (dA && dA.signals) || [];
    var sigB = (dB && dB.signals) || [];
    for (var a = 0; a < sigA.length && drivers.length < 2; a++) {
      drivers.push(sigA[a]);
    }
    for (var b = 0; b < sigB.length && drivers.length < 3; b++) {
      drivers.push(sigB[b]);
    }
    // Fallback to pattern template drivers if no live signals
    if (drivers.length === 0) {
      for (var f = 0; f < pat.drivers.length && drivers.length < 3; f++) {
        drivers.push(pat.drivers[f]);
      }
    }
    return drivers;
  }

  // ─── Mesh + shared-driver cluster (additive; same emit contract) ──────────

  // 2-tick stability + once-per-session emit, string-keyed (mesh/cluster).
  function _considerKeyed(key, isAbove, buildSignal, legacyDesc, newActive) {
    if (isAbove && _meshAbove[key]) {
      var sig = buildSignal();
      newActive.push(sig);
      if (!_meshTrig[key]) {
        _meshTrig[key] = true;
        _dispatch('limen:cross-domain-signal', sig);
        _dispatch('limen:opportunity-detected', {
          type: 'systemic', domains: sig.domains.slice(), label: sig.pattern,
          description: legacyDesc, confidence: sig.confidence, signal: sig, timestamp: Date.now()
        });
      }
    } else if (!isAbove) {
      _meshTrig[key] = false;
    }
    _meshAbove[key] = isAbove;
  }

  // Any non-curated domain pair both above MESH_THRESHOLD = a sensed web strand.
  function _detectMesh(domains, packets, audit, newActive) {
    function status(id) { return (audit[id] && audit[id].status) || 'FALLBACK'; }
    for (var a = 0; a < DOMAIN_LIST.length; a++) {
      for (var b = a + 1; b < DOMAIN_LIST.length; b++) {
        var idA = DOMAIN_LIST[a], idB = DOMAIN_LIST[b];
        if (_curatedPairKey[_pairKey(idA, idB)]) continue;
        var dA = domains[idA], dB = domains[idB];
        var sA = _stressOf(idA, dA, packets), sB = _stressOf(idB, dB, packets);
        var isAbove = sA >= MESH_THRESHOLD && sB >= MESH_THRESHOLD;
        var confA = (dA && dA.confidence) || 0, confB = (dB && dB.confidence) || 0, avgConf = (confA + confB) / 2;
        var sev = _clamp(Math.round(((sA + sB) / 2) * avgConf * 100) / 100, 0, 1);
        _considerKeyed('mesh:' + _pairKey(idA, idB), isAbove,
          _mkMeshSignal(idA, idB, dA, dB, sA, sB, sev, avgConf, status(idA), status(idB)),
          idA + ' and ' + idB + ' co-stressing (mesh)', newActive);
      }
    }
  }
  function _mkMeshSignal(idA, idB, dA, dB, sA, sB, sev, avgConf, statA, statB) {
    return function () {
      return {
        id: 'mesh_' + idA + '_' + idB + '_' + (++_idCounter), patternId: 'mesh:' + _pairKey(idA, idB),
        domains: [idA, idB], pattern: idA + '–' + idB + ' co-stress', mesh: true,
        severity: sev, confidence: _clamp(Math.round(avgConf * 100) / 100, 0, 1),
        drivers: _buildLiveDrivers({ drivers: [] }, dA, dB),
        options: [{ label: 'trace ' + idA + '–' + idB + ' exposure', type: 'analysis' }, { label: 'hold', type: 'monitoring' }],
        stressA: sA, stressB: sB, sourceStatusA: statA, sourceStatusB: statB, updated: Date.now()
      };
    };
  }

  // One live feed (cyber/CISA KEV) elevated across many domains = the convergence.
  function _detectCyberCluster(domains, packets, audit, newActive) {
    var members = [], labels = {};
    for (var k = 0; k < DOMAIN_LIST.length; k++) {
      var id = DOMAIN_LIST[k], slot = domains[id]; if (!slot) continue;
      var hit = _cyberHit(slot);
      if (hit) { members.push(id); if (hit.label) labels[hit.label] = true; }
    }
    var isAbove = members.length >= CLUSTER_MIN;
    _considerKeyed('cluster:cyber', isAbove,
      _mkCyberSignal(members.slice(), Object.keys(labels), domains, packets, audit),
      members.length + ' domains co-stressing on a live cyber threat (CISA KEV)', newActive);
  }
  function _mkCyberSignal(members, labels, domains, packets, audit) {
    return function () {
      function status(id) { return (audit[id] && audit[id].status) || 'LIVE'; }
      var sorted = members.slice().sort(function (x, y) { return _stressOf(y, domains[y], packets) - _stressOf(x, domains[x], packets); });
      var avg = 0; for (var m = 0; m < sorted.length; m++) avg += _stressOf(sorted[m], domains[sorted[m]], packets);
      avg = sorted.length ? avg / sorted.length : 0;
      var sev = _clamp(Math.round((avg * 0.6 + Math.min(1, sorted.length / 8) * 0.4) * 100) / 100, 0, 1);
      var drv = labels.slice(0, 3); if (!drv.length) drv = ['actively exploited CVEs (CISA KEV)', 'critical-infrastructure cyber threat'];
      return {
        id: 'cluster_cyber_' + (++_idCounter), patternId: 'cluster:cyber', cluster: true,
        domains: sorted.slice(), members: sorted.slice(),
        pattern: 'critical-infrastructure cyber convergence', severity: sev, confidence: 0.7, drivers: drv,
        options: [
          { label: 'find companies exposed across ' + sorted.length + ' domains', type: 'discovery' },
          { label: 'trace cyber-infrastructure transmission', type: 'analysis' },
          { label: 'hold', type: 'monitoring' }
        ],
        stressA: _stressOf(sorted[0], domains[sorted[0]], packets),
        stressB: sorted[1] ? _stressOf(sorted[1], domains[sorted[1]], packets) : 0,
        sourceStatusA: status(sorted[0]), sourceStatusB: sorted[1] ? status(sorted[1]) : 'LIVE', updated: Date.now()
      };
    };
  }

  // ─── Systemic Signals panel ──────────────────────────────────────────────

  var _isConsolePage = (function() {
    var p = location.pathname.replace(/^\//, '').replace(/\.html$/, '');
    return p === '' || p === 'civilization' || p === 'connectome';
  })();

  function _ensurePanel() {
    if (!_isConsolePage) return;
    if (_panelEl) return;
    _panelEl = document.createElement('div');
    _panelEl.id = 'limen-systemic-panel';
    _panelEl.style.cssText = [
      'position:fixed',
      'top:60px',
      'left:12px',
      'background:rgba(8,9,12,0.92)',
      'border:1px solid rgba(201,169,78,0.15)',
      'padding:8px 12px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.48rem',
      'letter-spacing:1.5px',
      'z-index:9996',
      'border-radius:2px',
      'pointer-events:none',
      'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
      'line-height:1.8',
      'min-width:180px',
      'display:none'
    ].join(';');
    document.body.appendChild(_panelEl);
  }

  function _renderPanel() {
    if (!_isConsolePage) return;
    _ensurePanel();

    // Phase 2 Patch B residual — SYSTEMIC SIGNALS panel suppressed to complete
    // the floating-surface removal begun in commits c0d42b6d58a + 564aeb5493b.
    // DOM node preserved via _ensurePanel so ui-mode-manager PANEL_MAP lookups
    // keep resolving. Render output and display:block toggles short-circuited.
    if (_panelEl) _panelEl.style.display = 'none';
    return;

    if (_activePatterns.length === 0) {
      _panelEl.style.display = 'none';
      return;
    }

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.4)';
    var red = '#e85454';
    var orange = '#d4a44e';

    var html = '<div style="color:' + gold + ';font-size:0.50rem;margin-bottom:4px">SYSTEMIC SIGNALS</div>';

    for (var i = 0; i < _activePatterns.length; i++) {
      var pat = _activePatterns[i];
      var sevColor = teal;
      if (pat.severity > 0.65) sevColor = red;
      else if (pat.severity > 0.40) sevColor = orange;

      var sevPct = Math.round(pat.severity * 100);

      html += '<div style="color:' + dim + ';margin-bottom:2px">';
      html += '<span style="color:' + sevColor + '">\u2022</span> ';
      html += '<span style="color:rgba(200,195,184,0.6)">' + pat.pattern + '</span>';
      var confPct = Math.round(pat.confidence * 100);
      html += '<span style="color:' + dim + ';font-size:0.40rem"> ' + sevPct + '%</span>';
      html += '<span style="color:' + dim + ';font-size:0.38rem"> conf:' + confPct + '%</span>';

      // Source status badges + freshness
      var badgeA = pat.sourceStatusA;
      var badgeB = pat.sourceStatusB;
      var badgeColorA = badgeA === 'LIVE' ? teal : (badgeA === 'PARTIAL' ? orange : red);
      var badgeColorB = badgeB === 'LIVE' ? teal : (badgeB === 'PARTIAL' ? orange : red);
      var patFresh = _freshness(pat.updated);
      html += '<br><span style="font-size:0.38rem;color:' + dim + ';margin-left:10px">';
      html += pat.domains[0] + ':<span style="color:' + badgeColorA + '">' + badgeA + '</span>';
      html += ' ' + pat.domains[1] + ':<span style="color:' + badgeColorB + '">' + badgeB + '</span>';
      html += ' \u2022 ' + patFresh;
      html += '</span>';
      html += '</div>';
    }

    // Gate visibility behind panel state manager
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-systemic-panel')) {
      return;
    }
    _panelEl.style.display = 'block';
    _panelEl.innerHTML = html;
  }

  // ─── Event listener ──────────────────────────────────────────────────────

  function _onDomainUpdate() {
    detect();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        window.addEventListener('limen:domain-update', _onDomainUpdate);
        window.addEventListener('limen:world-signals-updated', _onDomainUpdate);
        detect();
      });
    } else {
      window.addEventListener('limen:domain-update', _onDomainUpdate);
      window.addEventListener('limen:world-signals-updated', _onDomainUpdate);
      detect();
    }
  }

  function stop() {
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    window.removeEventListener('limen:world-signals-updated', _onDomainUpdate);
    _activePatterns = [];
    if (_panelEl) _panelEl.style.display = 'none';
  }

  function getActive() {
    return _activePatterns.slice();
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function _freshness(ts) {
    if (!ts) return 'unknown';
    var age = Date.now() - ts;
    if (age < 60000) return 'just now';
    if (age < 3600000) return Math.floor(age / 60000) + 'm ago';
    if (age < 86400000) return Math.floor(age / 3600000) + 'h ago';
    return Math.floor(age / 86400000) + 'd ago';
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENCrossDomain = { active: [], patterns: PATTERNS, timestamp: null };

  window.LIMENCrossDomainDetector = {
    start: start,
    stop: stop,
    detect: detect,
    getActive: getActive
  };

})();
