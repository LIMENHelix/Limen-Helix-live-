/**
 * action-suggester.js
 * LIMEN HELIX — Action Suggestion Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Maps domain signals and LIMEN phases into exploration or regulation prompts.
 * Does not make decisions — only suggests possible investigative directions.
 *
 * Action types: discovery, monitoring, regulation, analysis
 *
 * Output: window.LIMENActions (array of current suggestions)
 * Events: limen:user-action (emitted when user selects an action)
 *
 * Load order: after event-narrator.js
 */

(function () {
  'use strict';

  // ─── Action rule definitions ─────────────────────────────────────────────
  // Each rule: domain condition -> array of suggestions

  var DOMAIN_ACTIONS = {
    economy: [
      { label: 'Monitor market volatility indicators', type: 'monitoring', minStress: 0.3 },
      { label: 'Analyze economic resilience patterns', type: 'analysis', minStress: 0.4 },
      { label: 'Investigate structural risk clusters', type: 'analysis', minStress: 0.6 },
      { label: 'Explore counter-cyclical innovation', type: 'discovery', minStress: 0.7 }
    ],
    energy: [
      { label: 'Monitor energy price signals', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore renewable energy technologies', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze supply chain disruptions', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate grid resilience strategies', type: 'regulation', minStress: 0.7 }
    ],
    infrastructure: [
      { label: 'Monitor electric grid transmission/distribution reliability', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore resilient infrastructure funding & capital reallocation', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze construction materials & contractor availability', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate SCADA/ICS breach vectors and deferred-maintenance failure points', type: 'regulation', minStress: 0.7 }
    ],
    environment: [
      { label: 'Monitor ecological indicators', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore environmental design innovation', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze climate mitigation research', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate tipping point indicators', type: 'analysis', minStress: 0.7 }
    ],
    health: [
      { label: 'Review emerging research papers', type: 'discovery', minStress: 0.3 },
      { label: 'Investigate therapy technologies', type: 'discovery', minStress: 0.4 },
      { label: 'Scan clinical trial registries', type: 'monitoring', minStress: 0.5 },
      { label: 'Analyze treatment outcome patterns', type: 'analysis', minStress: 0.6 }
    ],
    technology: [
      { label: 'Monitor technology disruption signals', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore emerging technology domains', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze adoption trajectory shifts', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate infrastructure vulnerabilities', type: 'regulation', minStress: 0.7 }
    ],
    research: [
      { label: 'Monitor publication integrity signals', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore open science initiatives', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze funding allocation patterns', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate reproducibility concerns', type: 'analysis', minStress: 0.7 }
    ],
    supplyChain: [
      { label: 'Monitor logistics delay indicators', type: 'monitoring', minStress: 0.3 },
      { label: 'Identify affected industries', type: 'analysis', minStress: 0.4 },
      { label: 'Map disruption clusters', type: 'analysis', minStress: 0.5 },
      { label: 'Detect innovation gaps', type: 'discovery', minStress: 0.7 }
    ]
  };

  // ─── Cross-reference opportunity rules ───────────────────────────────────
  // When multiple domains are elevated, generate opportunity prompts

  var CROSS_RULES = [
    {
      domains: ['health', 'technology'],
      minStress: [0.4, 0.4],
      label: 'Explore medical technology innovation opportunity',
      body: 'Rising health research activity combined with technology disruption signals.',
      type: 'discovery'
    },
    {
      domains: ['health', 'research'],
      minStress: [0.5, 0.4],
      label: 'Investigate emerging treatment research convergence',
      body: 'Health stress signals aligning with research activity shifts.',
      type: 'discovery'
    },
    {
      domains: ['energy', 'environment'],
      minStress: [0.4, 0.4],
      label: 'Explore clean energy transition opportunity',
      body: 'Energy volatility intersecting with environmental stress indicators.',
      type: 'discovery'
    },
    {
      domains: ['economy', 'supplyChain'],
      minStress: [0.5, 0.5],
      label: 'Analyze economic resilience through supply chain adaptation',
      body: 'Economic and supply chain stress co-occurring — structural opportunity.',
      type: 'analysis'
    },
    {
      domains: ['technology', 'research'],
      minStress: [0.4, 0.4],
      label: 'Investigate research technology innovation convergence',
      body: 'Technology disruption aligning with research pattern shifts.',
      type: 'discovery'
    },
    {
      domains: ['economy', 'energy'],
      minStress: [0.5, 0.5],
      label: 'Analyze energy-economic coupling vulnerabilities',
      body: 'Co-elevated stress in economy and energy domains suggests structural exposure.',
      type: 'analysis'
    },
    {
      domains: ['infrastructure', 'economy'],
      minStress: [0.5, 0.5],
      label: 'Analyze infrastructure capital reallocation opportunity',
      body: 'Co-elevated infrastructure and economic stress suggests deferred-maintenance and funding-gap exposure.',
      type: 'analysis'
    },
    {
      domains: ['infrastructure', 'technology'],
      minStress: [0.4, 0.4],
      label: 'Investigate cyber-physical infrastructure hardening convergence',
      body: 'Infrastructure stress intersecting with technology disruption signals SCADA/ICS and grid-reliability exposure.',
      type: 'discovery'
    }
  ];

  // ─── Phase-sensitive action modifiers ────────────────────────────────────

  var PHASE_ACTIONS = {
    P1: { label: 'Investigate disruption source', type: 'analysis' },
    P3: { label: 'Monitor threat indicators closely', type: 'monitoring' },
    P5: { label: 'Explore emerging awareness patterns', type: 'discovery' },
    P7: { label: 'Observe dissolution process', type: 'monitoring' },
    P9: { label: 'Prepare for threshold transition', type: 'regulation' },
    P10: { label: 'Consolidate new integration patterns', type: 'regulation' }
  };

  // ─── State ───────────────────────────────────────────────────────────────

  var currentActions = [];
  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];

  // ─── Action computation ──────────────────────────────────────────────────

  function computeActions() {
    var domains = window.LIMENDomains || {};
    var phase = window.LIMENPhase || {};
    var actions = [];

    // Domain-specific actions
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      if (!d || d.stress === undefined) continue;

      var domainRules = DOMAIN_ACTIONS[k] || [];
      for (var r = 0; r < domainRules.length; r++) {
        var rule = domainRules[r];
        if (d.stress >= rule.minStress) {
          actions.push({
            label: rule.label,
            domain: k,
            type: rule.type,
            priority: Math.round(d.stress * 100) / 100
          });
        }
      }
    }

    // Cross-reference opportunities
    for (var c = 0; c < CROSS_RULES.length; c++) {
      var cr = CROSS_RULES[c];
      var allMet = true;
      var avgStress = 0;

      for (var cd = 0; cd < cr.domains.length; cd++) {
        var domData = domains[cr.domains[cd]];
        if (!domData || domData.stress < cr.minStress[cd]) {
          allMet = false;
          break;
        }
        avgStress += domData.stress;
      }

      if (allMet) {
        avgStress = avgStress / cr.domains.length;
        actions.push({
          label: cr.label,
          domain: cr.domains.join('+'),
          type: cr.type,
          priority: Math.round(avgStress * 100) / 100,
          crossReference: true,
          body: cr.body
        });
      }
    }

    // Phase-sensitive action
    if (phase.estimated && PHASE_ACTIONS[phase.estimated]) {
      var pa = PHASE_ACTIONS[phase.estimated];
      actions.push({
        label: pa.label,
        domain: 'phase',
        type: pa.type,
        priority: phase.confidence || 0.5,
        phaseAction: true
      });
    }

    // Sort by priority descending
    actions.sort(function (a, b) { return b.priority - a.priority; });

    // Cap at 10
    if (actions.length > 10) actions = actions.slice(0, 10);

    currentActions = actions;
    window.LIMENActions = currentActions;

    return currentActions;
  }

  // ─── Event listener ──────────────────────────────────────────────────────

  function _onDomainUpdate() {
    computeActions();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    window.addEventListener('limen:domain-update', _onDomainUpdate);
    computeActions();
  }

  function stop() {
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    currentActions = [];
    window.LIMENActions = [];
  }

  function getActions() {
    return currentActions.slice();
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENActions = currentActions;

  window.LIMENActionSuggester = {
    start: start,
    stop: stop,
    getActions: getActions,
    compute: computeActions
  };

})();
