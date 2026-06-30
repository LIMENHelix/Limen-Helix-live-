/**
 * regulation-renderer.js
 * LIMEN HELIX — Unified Regulation Renderer
 *
 * Renders each domain as one coherent decision block:
 *   name → state/severity/trajectory → stress/confidence → stressors →
 *   summary sentence → diagnosis → fractal answer → treatments (hierarchy) →
 *   actions → local impact → global impact → evidence chain (collapsed)
 *
 * Also produces a global coherence summary across all 20 domains.
 *
 * Consumed by console-clarity (Regulation tab) and domain-repair-map.
 *
 * Exposes: window.LIMENRegulationRenderer
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // Palette
  // ═══════════════════════════════════════════════════════════════

  var GOLD = '#C9A94E';
  var GOLD_DIM = 'rgba(201,169,78,0.12)';
  var GOLD_MED = 'rgba(201,169,78,0.3)';
  var GOLD_BG = 'rgba(201,169,78,0.04)';
  var BG_DARK = '#181a20';
  var BG_CARD = '#12141a';
  var TEXT_PRIMARY = '#d0cec8';
  var TEXT_DIM = '#888';
  var TEXT_MUTED = '#666';
  var RED = '#e85454';
  var ORANGE = '#FF9800';
  var GREEN = '#4CAF50';
  var BLUE = '#4a8fd4';

  var DOMAIN_ORDER = [
    'economy', 'energy', 'environment', 'health', 'technology', 'research',
    'supplyChain', 'governance', 'infrastructure', 'agriculture',
    'industry', 'education', 'communication', 'culture',
    'defense', 'religion', 'population', 'law', 'finance', 'intelligence'
  ];

  var STATE_COLORS = {
    critical: RED, escalating: RED, fragmented: ORANGE,
    pressured: ORANGE, recovering: GREEN, stable: GREEN
  };

  var STATE_PHRASES = {
    critical: 'in crisis', escalating: 'escalating', fragmented: 'under mixed pressure',
    pressured: 'under pressure', recovering: 'recovering', stable: 'stable'
  };

  // Plain-language translation of the stress-trajectory descriptor (NOT the
  // P0–P10 developmental phase — this is just where stress sits in its cycle).
  var PHASE_PHRASES = {
    peak: 'stress at a peak', ascending: 'stress rising', descending: 'stress easing',
    trough: 'quiet · low stress', plateau: 'holding steady'
  };

  // ═══════════════════════════════════════════════════════════════
  // Styles
  // ═══════════════════════════════════════════════════════════════

  function _injectStyles() {
    if (document.getElementById('limen-regulation-css')) return;
    var s = document.createElement('style');
    s.id = 'limen-regulation-css';
    s.textContent = [
      // Container
      '.lreg-container { font-family:"IBM Plex Mono",monospace; color:' + TEXT_PRIMARY + '; }',
      '.lreg-title { font-size:0.7rem; letter-spacing:2px; text-transform:uppercase; color:' + GOLD + ';',
      '  margin:0 0 12px; padding-bottom:6px; border-bottom:1px solid ' + GOLD_DIM + '; }',

      // Global coherence panel
      '.lreg-global { background:' + BG_DARK + '; border:1px solid ' + GOLD_DIM + '; border-radius:4px;',
      '  padding:10px 12px; margin-bottom:14px; }',
      '.lreg-global-title { font-size:0.5rem; letter-spacing:1.5px; text-transform:uppercase;',
      '  color:' + GOLD + '; margin-bottom:6px; }',
      '.lreg-global-stat { font-size:0.55rem; color:' + TEXT_DIM + '; line-height:1.6; }',
      '.lreg-global-narrative { font-size:0.55rem; color:' + TEXT_PRIMARY + '; line-height:1.5;',
      '  margin-top:6px; padding:6px 8px; border-left:2px solid ' + GOLD + ';',
      '  background:' + GOLD_BG + '; border-radius:0 3px 3px 0; }',

      // Grid
      '.lreg-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }',
      '@media(max-width:700px) { .lreg-grid { grid-template-columns:1fr; } }',

      // Card
      '.lreg-card { background:' + BG_CARD + '; border:1px solid ' + GOLD_DIM + '; border-radius:4px;',
      '  padding:10px 12px; transition:border-color 0.3s; }',
      '.lreg-card.critical { border-left:3px solid ' + RED + '; }',
      '.lreg-card.escalating { border-left:3px solid ' + RED + '; }',
      '.lreg-card.pressured { border-left:3px solid ' + ORANGE + '; }',
      '.lreg-card.stable { border-left:3px solid ' + GREEN + '; }',
      '.lreg-card.recovering { border-left:3px solid ' + GREEN + '; }',
      '.lreg-card.fragmented { border-left:3px solid ' + ORANGE + '; }',

      // Header
      '.lreg-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }',
      '.lreg-domain { font-size:0.68rem; letter-spacing:1px; text-transform:uppercase; color:' + GOLD + '; }',
      '.lreg-badges { display:flex; gap:4px; align-items:center; }',
      '.lreg-badge { font-size:0.42rem; letter-spacing:0.5px; text-transform:uppercase; padding:1px 5px;',
      '  border-radius:2px; border:1px solid; }',

      // Summary sentence
      '.lreg-summary { font-size:0.55rem; color:' + TEXT_PRIMARY + '; line-height:1.45;',
      '  margin:5px 0 6px; padding:5px 8px; border-left:2px solid ' + GOLD + ';',
      '  background:' + GOLD_BG + '; border-radius:0 3px 3px 0; }',

      // Stress bar
      '.lreg-stress-row { display:flex; align-items:center; gap:6px; margin:3px 0; }',
      '.lreg-stress-label { width:32px; font-size:0.42rem; color:' + TEXT_MUTED + '; text-transform:uppercase;',
      '  letter-spacing:0.5px; }',
      '.lreg-stress-bar { flex:1; height:3px; background:rgba(255,255,255,0.06); border-radius:2px;',
      '  overflow:hidden; }',
      '.lreg-stress-fill { height:100%; border-radius:2px;',
      '  background:linear-gradient(90deg,' + BLUE + ',' + ORANGE + ',' + RED + '); transition:width 0.5s; }',
      '.lreg-conf-fill { height:100%; border-radius:2px;',
      '  background:linear-gradient(90deg,#F44336,' + ORANGE + ',' + GREEN + '); transition:width 0.5s; }',
      '.lreg-stress-val { width:30px; text-align:right; font-size:0.42rem; color:' + TEXT_MUTED + '; }',

      // Meta
      '.lreg-meta { font-size:0.42rem; color:' + TEXT_MUTED + '; margin:2px 0 4px; }',

      // Stressors
      '.lreg-stressor { font-size:0.48rem; color:' + RED + '; padding:1px 0 1px 8px;',
      '  border-left:2px solid rgba(232,84,84,0.3); margin:1px 0; }',

      // Section labels
      '.lreg-section-label { font-size:0.45rem; letter-spacing:1px; text-transform:uppercase;',
      '  color:' + GOLD_MED + '; margin:6px 0 3px; }',

      // Diagnosis
      '.lreg-dx { font-size:0.52rem; color:' + TEXT_DIM + '; padding:2px 0 2px 8px;',
      '  border-left:2px solid ' + GOLD_DIM + '; margin:1px 0; }',
      '.lreg-dx.portal { border-left-color:' + GOLD + '; }',

      // Fractal answer (priority visual)
      '.lreg-fractal { border:1px solid ' + GOLD + '; border-radius:4px; padding:8px 10px;',
      '  margin:6px 0; background:' + GOLD_BG + '; }',
      '.lreg-fractal-label { font-size:0.45rem; letter-spacing:1.5px; text-transform:uppercase;',
      '  color:' + GOLD + '; margin-bottom:3px; }',
      '.lreg-fractal-answer { font-size:0.58rem; color:' + TEXT_PRIMARY + '; line-height:1.45; }',
      '.lreg-fractal-meta { font-size:0.4rem; color:' + TEXT_MUTED + '; margin-top:4px; }',

      // Treatments (hierarchy)
      '.lreg-tx-primary { font-size:0.55rem; color:' + GOLD + '; padding:3px 8px;',
      '  background:rgba(201,169,78,0.08); border-radius:2px; margin:2px 0;',
      '  border-left:2px solid ' + GOLD + '; }',
      '.lreg-tx-secondary { font-size:0.5rem; color:' + TEXT_DIM + '; padding:2px 8px;',
      '  background:rgba(201,169,78,0.03); border-radius:2px; margin:1px 0;',
      '  border-left:2px solid ' + GOLD_DIM + '; }',
      '.lreg-tx-supporting { font-size:0.45rem; color:' + TEXT_MUTED + '; padding:1px 8px; margin:1px 0; }',

      // Actions
      '.lreg-action { font-size:0.48rem; color:#bbb; padding:1px 0 1px 12px; margin:1px 0; }',

      // Repair impact
      '.lreg-impact { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:4px 0; }',
      '@media(max-width:500px) { .lreg-impact { grid-template-columns:1fr; } }',
      '.lreg-impact-col { font-size:0.48rem; }',
      '.lreg-impact-label { color:' + GOLD_MED + '; text-transform:uppercase; letter-spacing:0.5px;',
      '  margin-bottom:2px; font-size:0.4rem; }',
      '.lreg-impact-value { color:' + TEXT_DIM + '; margin:1px 0; }',
      '.lreg-impact-value.positive { color:' + GREEN + '; }',

      // Evidence chain (collapsible)
      '.lreg-evidence { font-size:0.48rem; border:1px solid ' + GOLD_DIM + '; border-radius:3px;',
      '  margin:5px 0 2px; overflow:hidden; }',
      '.lreg-evidence-header { padding:4px 8px; cursor:pointer; color:' + GOLD_MED + ';',
      '  font-size:0.42rem; letter-spacing:1px; text-transform:uppercase;',
      '  background:rgba(201,169,78,0.02); user-select:none; }',
      '.lreg-evidence-header:hover { background:rgba(201,169,78,0.06); color:' + GOLD + '; }',
      '.lreg-evidence-body { padding:6px 8px; display:none; }',
      '.lreg-evidence-body.open { display:block; }',
      '.lreg-chain-step { font-size:0.45rem; color:' + TEXT_DIM + '; padding:1px 0; }',
      '.lreg-chain-arrow { color:' + GOLD + '; margin:0 3px; }',

      // Quality tier indicators
      '.lreg-quality { font-size:0.4rem; display:inline-block; padding:1px 4px; border-radius:2px;',
      '  letter-spacing:0.5px; text-transform:uppercase; margin-left:4px; }',
      '.lreg-quality.full { color:' + GREEN + '; border:1px solid ' + GREEN + '; }',
      '.lreg-quality.partial { color:' + ORANGE + '; border:1px solid ' + ORANGE + '; }',
      '.lreg-quality.generic { color:' + RED + '; border:1px solid ' + RED + '; }',
      '.lreg-completeness { font-size:0.42rem; color:' + TEXT_MUTED + '; margin:2px 0; }',
      '.lreg-action-plan { font-size:0.48rem; color:' + TEXT_DIM + '; padding:3px 8px;',
      '  background:rgba(255,255,255,0.02); border-radius:2px; margin:2px 0;',
      '  border-left:2px solid ' + GOLD_DIM + '; }',
      '.lreg-action-plan.reliable { border-left-color:' + GREEN + '; }',
      '.lreg-action-plan-title { color:' + GOLD + '; font-size:0.5rem; }',
      '.lreg-action-plan-detail { color:' + TEXT_MUTED + '; font-size:0.42rem; margin-top:2px; }',

      // Empty state
      '.lreg-empty { text-align:center; padding:40px 20px; color:' + TEXT_DIM + ';',
      '  font-size:0.6rem; font-style:italic; }',

      // Gate B #9b — confidence authority badges
      '.lreg-conf-badge { font-size:0.45rem; letter-spacing:1.5px; padding:3px 7px;',
      '  border-radius:2px; margin:6px 0 8px; text-transform:uppercase;',
      '  display:inline-block; }',
      '.lreg-conf-badge.low { color:#e85454; background:rgba(232,84,84,0.06);',
      '  border:1px solid rgba(232,84,84,0.25); }',
      '.lreg-conf-badge.moderate { color:#FF9800; background:rgba(255,152,0,0.05);',
      '  border:1px solid rgba(255,152,0,0.25); }',
      '.lreg-conf-badge-reason { display:block; font-size:0.4rem; color:rgba(200,195,184,0.55);',
      '  letter-spacing:0.5px; text-transform:none; margin-top:2px; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════
  // Gate B #9b — Confidence authority classification.
  //
  // Per-domain regulation block authority. Visual downgrade only —
  // body remains visible at all confidence levels. The classifier
  // reads reg.confidence (already populated in the regulation engine
  // output) and decides whether to add a header badge above the
  // claim-bearing body.
  //
  // Doctrine carried (operator 2026-06-01):
  //   Reliability signals govern rendering, not just display adjacent.
  //
  // The existing per-card "conf" stress-row at line ~513 continues to
  // display the numeric confidence value; the badge sits ABOVE the
  // stress/conf bars so the operator sees authority status before
  // reading the values.
  //
  // ABSENT is not reachable in _buildUnifiedCard / renderCompactRegulation
  // because callers (renderRegulationTab / renderDomainRegulation /
  // domain-repair-map host) already filter out null/error regs upstream.
  // Source-absent at the whole-tab level is handled by the pre-existing
  // honest empty-state in renderRegulationTab at line 421 ("Regulation
  // engine has not run yet. Waiting for domain data...") — preserved
  // per the doctrine "don't over-banner honest empty states."
  // ═══════════════════════════════════════════════════════════════

  function _classifyRegulationAuthority(reg) {
    var conf = reg && typeof reg.confidence === 'number' ? reg.confidence : 0;
    if (conf < 0.4) {
      return {
        level: 'LOW_CONFIDENCE',
        badge: 'LOW CONFIDENCE · ' + Math.round(conf * 100) + '%',
        reason: 'Regulation engine confidence below 40% — interpret with caution.'
      };
    }
    if (conf < 0.65) {
      return {
        level: 'MODERATE_CONFIDENCE',
        badge: 'MODERATE CONFIDENCE · ' + Math.round(conf * 100) + '%',
        reason: null
      };
    }
    return { level: 'FULL', badge: null, reason: null };
  }

  function _appendRegulationBadge(authority, parent) {
    if (!authority || !authority.badge) return;
    var el = document.createElement('div');
    var cls = authority.level === 'LOW_CONFIDENCE' ? 'low' : 'moderate';
    el.className = 'lreg-conf-badge ' + cls;
    el.textContent = authority.badge;
    if (authority.reason) {
      var r = document.createElement('span');
      r.className = 'lreg-conf-badge-reason';
      r.textContent = authority.reason;
      el.appendChild(r);
    }
    parent.appendChild(el);
  }

  // ═══════════════════════════════════════════════════════════════
  // Summary sentence generator
  // ═══════════════════════════════════════════════════════════════

  function _buildSummarySentence(reg) {
    var name = reg.name || reg.domainId;
    var phrase = STATE_PHRASES[reg.state] || reg.state || 'in unknown state';

    // What is wrong
    var problem = name + ' is ' + phrase;
    if (reg.stressors && reg.stressors.length > 0) {
      problem += ' (' + String(reg.stressors[0].name || '').replace(/_/g, ' ') + ')';
    } else if (reg.diagnosis && reg.diagnosis.primary) {
      problem += ' (' + (reg.diagnosis.primary.title || 'diagnosed') + ')';
    }

    // What to do
    var fix = '';
    if (reg.fractalAnswer && reg.fractalAnswer.treatment) {
      fix = reg.fractalAnswer.answer || '';
    } else if (reg.treatments && reg.treatments.length > 0) {
      fix = reg.treatments[0].title || '';
    }
    if (fix) {
      // Lowercase first char, trim trailing period
      fix = fix.charAt(0).toLowerCase() + fix.slice(1);
      if (fix.charAt(fix.length - 1) === '.') fix = fix.slice(0, -1);
    }

    // Why it matters
    var impact = '';
    var globalRepair = reg.globalRepair || [];
    if (globalRepair.length > 0) {
      var targets = [];
      for (var i = 0; i < Math.min(globalRepair.length, 2); i++) {
        targets.push(globalRepair[i].name);
      }
      impact = 'stabilize ' + targets.join('/') + ' spillover';
    } else if (reg.localRepair && reg.localRepair.reduction > 0) {
      impact = 'reduce local stress by ' + (reg.localRepair.reduction * 100).toFixed(0) + '%';
    }

    // Assemble
    var sentence = problem;
    if (fix) sentence += '; prioritize ' + fix;
    if (impact) sentence += ' to ' + impact;
    sentence += '.';

    return sentence;
  }

  // ═══════════════════════════════════════════════════════════════
  // Global coherence summary
  // ═══════════════════════════════════════════════════════════════

  function _buildGlobalCoherence(output) {
    var el = document.createElement('div');
    el.className = 'lreg-global';

    var title = document.createElement('div');
    title.className = 'lreg-global-title';
    title.textContent = 'System Coherence';
    el.appendChild(title);

    // Gather analytics
    var distressed = [];
    var portalSourced = 0;
    var totalTx = 0;
    var totalActions = 0;
    var totalVerified = 0;
    var totalGeneric = 0;
    var stressorMap = {};     // stressor name → count
    var globalImpacts = [];   // { domain, reduction, targets[] }

    for (var dk in output) {
      if (!output.hasOwnProperty(dk)) continue;
      var r = output[dk];
      if (r.error) continue;

      if ((r.stress || 0) > 0.65) distressed.push(r);
      if (r.isPortalSourced) portalSourced++;
      totalTx += (r.treatments || []).length;
      totalActions += (r.actions || []).length;
      if (r.qualityTiers) {
        totalVerified += (r.qualityTiers.fully_specified || 0);
        totalGeneric += (r.qualityTiers.generic || 0);
      }

      // Track stressor names for common driver detection
      var stressors = r.stressors || [];
      for (var si = 0; si < stressors.length; si++) {
        var sName = stressors[si].name || 'unnamed';
        stressorMap[sName] = (stressorMap[sName] || 0) + 1;
      }

      // Track cross-domain stabilization value
      var gr = r.globalRepair || [];
      if (gr.length > 0 && (r.localRepair && r.localRepair.reduction > 0)) {
        var totalPropagated = 0;
        var targets = [];
        for (var gi = 0; gi < gr.length; gi++) {
          totalPropagated += gr[gi].propagatedReduction;
          targets.push(gr[gi].name);
        }
        globalImpacts.push({
          domain: r.name || dk,
          domainId: dk,
          reduction: r.localRepair.reduction,
          propagated: totalPropagated,
          totalValue: r.localRepair.reduction + totalPropagated,
          targets: targets
        });
      }
    }

    // Sort distressed by stress desc
    distressed.sort(function (a, b) { return (b.stress || 0) - (a.stress || 0); });

    // Find common driver
    var commonDriver = null;
    var maxDriverCount = 0;
    for (var driverName in stressorMap) {
      if (stressorMap.hasOwnProperty(driverName) && stressorMap[driverName] > maxDriverCount) {
        maxDriverCount = stressorMap[driverName];
        commonDriver = driverName;
      }
    }

    // Sort interventions by cross-domain value
    globalImpacts.sort(function (a, b) { return b.totalValue - a.totalValue; });

    // Stats line
    var stats = document.createElement('div');
    stats.className = 'lreg-global-stat';
    var statsHTML = '<span style="color:' + GOLD + '">20</span> domains regulated · ';
    statsHTML += '<span style="color:' + (distressed.length > 0 ? RED : GREEN) + '">' +
      distressed.length + '</span> distressed · ';
    statsHTML += '<span style="color:' + GOLD + '">' + totalTx + '</span> candidate interventions · ';
    statsHTML += '<span style="color:' + (totalVerified > 0 ? GREEN : ORANGE) + '">' +
      totalVerified + '</span> of ' + totalTx + ' confirmed ' +
      '<span style="color:rgba(200,195,184,0.45)">(the rest are model estimates)</span>';
    stats.innerHTML = statsHTML;
    el.appendChild(stats);

    // Narrative
    var narrative = document.createElement('div');
    narrative.className = 'lreg-global-narrative';
    var narText = '';

    // Most stressed domains
    if (distressed.length > 0) {
      var topNames = [];
      for (var di = 0; di < Math.min(distressed.length, 3); di++) {
        topNames.push(distressed[di].name + ' (' + Math.round((distressed[di].stress || 0) * 100) + '%)');
      }
      narText += 'Most stressed: ' + topNames.join(', ') + '. ';
    } else {
      narText += 'No domains above distress threshold. ';
    }

    // Common driver
    if (commonDriver && maxDriverCount >= 2) {
      narText += 'Common driver across ' + maxDriverCount + ' domains: ' + commonDriver.replace(/_/g, ' ') + '. ';
    }

    // Highest-value intervention
    if (globalImpacts.length > 0) {
      var best = globalImpacts[0];
      narText += 'Highest cross-domain stabilization: treating ' + best.domain +
        ' (local \u2193' + (best.reduction * 100).toFixed(0) + '%, propagates to ' +
        best.targets.slice(0, 2).join(', ') + ').';
    }

    if (!narText) narText = 'System is nominal. No interventions required.';
    narrative.textContent = narText;
    el.appendChild(narrative);

    return el;
  }

  // ═══════════════════════════════════════════════════════════════
  // Deduplication helpers
  // ═══════════════════════════════════════════════════════════════

  /**
   * Deduplicate actions: if an action's text already appears in a treatment title,
   * or if two actions have the same text, collapse them.
   */
  function _deduplicateActions(actions, treatments) {
    if (!actions || actions.length === 0) return [];

    var seen = {};
    var txTitles = {};
    var i;

    // Index treatment titles (lowered)
    for (i = 0; i < (treatments || []).length; i++) {
      var t = (treatments[i].title || '').toLowerCase();
      if (t) txTitles[t] = true;
    }

    var result = [];
    for (i = 0; i < actions.length; i++) {
      var key = (actions[i].action || '').toLowerCase().trim();
      if (!key || seen[key]) continue;
      // Skip if action is just a restatement of a treatment title
      if (txTitles[key]) continue;
      seen[key] = true;
      result.push(actions[i]);
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Full Regulation Tab
  // ═══════════════════════════════════════════════════════════════

  function renderRegulationTab(containerEl) {
    _injectStyles();
    if (!containerEl) return;
    containerEl.innerHTML = '';

    var output = window.LIMENRegulationOutput;
    if (!output || Object.keys(output).length === 0) {
      var empty = document.createElement('div');
      empty.className = 'lreg-empty';
      empty.textContent = 'Regulation engine has not run yet. Waiting for domain data...';
      containerEl.appendChild(empty);
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'lreg-container';

    var title = document.createElement('div');
    title.className = 'lreg-title';
    title.textContent = 'Domain Regulation — the 20 real-world domains';
    wrap.appendChild(title);

    // Plain-language explainer + disambiguation from the Vitals page. These are
    // two different "bodies": Regulation = the world's domains (live brains);
    // Vitals = LIMEN's own machine health (offline sensors). Same metaphor,
    // different subject — so say which one this is.
    var intro = document.createElement('div');
    intro.style.cssText = 'font-size:0.4rem;line-height:1.5;color:rgba(200,195,184,0.6);margin:2px 0 10px;max-width:780px';
    intro.innerHTML = 'For each domain: how stressed it is right now, what looks wrong, the best move to relieve it, and the ripple to other domains. ' +
      'Numbers below a domain’s confidence are <b>model estimates, not confirmed outcomes</b>. ' +
      '<span style="color:rgba(200,195,184,0.4)">This is the state of the world’s domains — not LIMEN’s own system health (that’s the <b>/vitals</b> page).</span>';
    wrap.appendChild(intro);

    // Global coherence summary
    wrap.appendChild(_buildGlobalCoherence(output));

    // Grid of unified domain cards — distressed first, then by stress desc
    var sorted = [];
    for (var i = 0; i < DOMAIN_ORDER.length; i++) {
      var dk = DOMAIN_ORDER[i];
      if (output[dk] && !output[dk].error) sorted.push(output[dk]);
    }
    sorted.sort(function (a, b) { return (b.stress || 0) - (a.stress || 0); });

    var grid = document.createElement('div');
    grid.className = 'lreg-grid';

    for (var j = 0; j < sorted.length; j++) {
      grid.appendChild(_buildUnifiedCard(sorted[j]));
    }

    wrap.appendChild(grid);
    containerEl.appendChild(wrap);
  }

  // ═══════════════════════════════════════════════════════════════
  // Unified Domain Card
  // ═══════════════════════════════════════════════════════════════

  function _buildUnifiedCard(reg) {
    var card = document.createElement('div');
    card.className = 'lreg-card ' + (reg.state || 'stable');

    // ── 1. Domain name + state/urgency badges ──
    var header = document.createElement('div');
    header.className = 'lreg-header';

    var nameEl = document.createElement('span');
    nameEl.className = 'lreg-domain';
    nameEl.textContent = reg.name || reg.domainId;
    header.appendChild(nameEl);

    var badges = document.createElement('span');
    badges.className = 'lreg-badges';

    var stateColor = STATE_COLORS[reg.state] || TEXT_DIM;
    var stateBadge = document.createElement('span');
    stateBadge.className = 'lreg-badge';
    stateBadge.style.color = stateColor;
    stateBadge.style.borderColor = stateColor;
    stateBadge.textContent = reg.state || '?';
    badges.appendChild(stateBadge);

    if (reg.urgency && reg.urgency !== 'minimal' && reg.urgency !== 'low') {
      var urgColor = reg.urgency === 'critical' ? RED : reg.urgency === 'high' ? ORANGE : BLUE;
      var urgBadge = document.createElement('span');
      urgBadge.className = 'lreg-badge';
      urgBadge.style.color = urgColor;
      urgBadge.style.borderColor = urgColor;
      urgBadge.textContent = reg.urgency;
      badges.appendChild(urgBadge);
    }

    if (reg.trajectory && reg.trajectory !== 'stable') {
      var trajColor = reg.trajectory === 'worsening' ? RED : GREEN;
      var trajBadge = document.createElement('span');
      trajBadge.className = 'lreg-badge';
      trajBadge.style.color = trajColor;
      trajBadge.style.borderColor = trajColor;
      trajBadge.textContent = reg.trajectory === 'worsening' ? '\u2191 worsening' : '\u2193 improving';
      badges.appendChild(trajBadge);
    }

    header.appendChild(badges);
    card.appendChild(header);

    // Gate B #9b — confidence authority badge above the body. Visual
    // downgrade only; the body and the per-card conf bar below remain
    // visible at all confidence levels.
    _appendRegulationBadge(_classifyRegulationAuthority(reg), card);

    // ── 2. Stress + Confidence bars ──
    card.appendChild(_stressRow('stress', reg.stress || 0, 'lreg-stress-fill'));
    card.appendChild(_stressRow('conf', reg.confidence || 0, 'lreg-conf-fill'));

    // ── 3. Meta line (plain-language stress phase + honest data source) ──
    var meta = document.createElement('div');
    meta.className = 'lreg-meta';
    meta.textContent = PHASE_PHRASES[reg.dominantPhase] || (reg.dominantPhase || '');
    meta.textContent += reg.isPortalSourced
      ? ' · matched to authored portal content'
      : ' · inferred (no authored match)';
    card.appendChild(meta);

    // ── 4. Active stressors ──
    var stressors = reg.stressors || [];
    if (stressors.length > 0) {
      for (var si = 0; si < Math.min(stressors.length, 3); si++) {
        var sEl = document.createElement('div');
        sEl.className = 'lreg-stressor';
        sEl.textContent = '\u26A0 ' + String(stressors[si].name || '').replace(/_/g, ' ');
        card.appendChild(sEl);
      }
    }

    // ── 5. Summary sentence ──
    var summary = document.createElement('div');
    summary.className = 'lreg-summary';
    summary.textContent = _buildSummarySentence(reg);
    card.appendChild(summary);

    // ── 6. What looks wrong ──
    // The card's live state badge already carries severity (from current
    // stress). The diagnosis object also has a *static* severity authored in
    // the portal — showing both made cards read as self-contradictory
    // ("CRITICAL" + "moderate: Grid Collapse"). So we show the matched
    // condition NAME only and let the live state badge speak to severity.
    if (reg.diagnosis && reg.diagnosis.primary) {
      _appendLabel(card, 'What looks wrong');
      var dx = reg.diagnosis.primary;
      var dxEl = document.createElement('div');
      dxEl.className = 'lreg-dx' + (reg.diagnosis.portalSourced ? ' portal' : '');
      dxEl.textContent = 'Closest match: ' + (dx.title || dx.id);
      if (reg.diagnosis.count > 1) dxEl.textContent += ' (+' + (reg.diagnosis.count - 1) + ' related)';
      card.appendChild(dxEl);
    }

    // ── 7. Fractal answer (priority position) ──
    if (reg.fractalAnswer && reg.fractalAnswer.treatment) {
      _renderFractalInline(reg.fractalAnswer, card);
    }

    // ── 8. Treatment hierarchy + quality tiers ──
    var treatments = reg.treatments || [];
    if (treatments.length > 0) {
      _appendLabel(card, 'Candidate interventions');
      for (var ti = 0; ti < treatments.length; ti++) {
        var txEl = document.createElement('div');
        if (ti === 0) {
          txEl.className = 'lreg-tx-primary';
          txEl.textContent = '\u25B8 ' + (treatments[ti].title || treatments[ti].id);
        } else if (ti <= 2) {
          txEl.className = 'lreg-tx-secondary';
          txEl.textContent = '\u25B8 ' + (treatments[ti].title || treatments[ti].id);
        } else {
          txEl.className = 'lreg-tx-supporting';
          txEl.textContent = '\u00B7 ' + (treatments[ti].title || treatments[ti].id);
        }
        // Quality tier badge
        var qTier = treatments[ti]._qualityTier;
        if (qTier) {
          var qBadge = document.createElement('span');
          qBadge.className = 'lreg-quality ' + (qTier === 'fully_specified' ? 'full' : qTier === 'partial' ? 'partial' : 'generic');
          qBadge.textContent = qTier === 'fully_specified' ? 'verified' : qTier === 'partial' ? 'inferred' : 'unverified';
          txEl.appendChild(qBadge);
        }
        card.appendChild(txEl);
      }

      // Honest verified-vs-inferred indicator. "0% verified" presented as a
      // bare stat read as a quality score; say plainly how many are confirmed.
      if (reg.portalCompleteness !== undefined) {
        var nVerified = (reg.qualityTiers && reg.qualityTiers.fully_specified) || 0;
        var compEl = document.createElement('div');
        compEl.className = 'lreg-completeness';
        compEl.textContent = nVerified === 0
          ? 'None of these are confirmed protocols yet — model-matched candidates from this domain’s portals.'
          : nVerified + ' of ' + treatments.length + ' confirmed; the rest are model-matched candidates.';
        card.appendChild(compEl);
      }
    }

    // ── 9. Actions (deduplicated) ──
    var actions = _deduplicateActions(reg.actions || [], treatments);
    if (actions.length > 0) {
      _appendLabel(card, 'Ordered steps');
      // Global 1..N numbering. The per-treatment `sequence` reset to 1 for each
      // treatment's first step, so the list rendered as "[1] … [1] … [1]".
      for (var ai = 0; ai < Math.min(actions.length, 4); ai++) {
        var actEl = document.createElement('div');
        actEl.className = 'lreg-action';
        actEl.textContent = (ai + 1) + '. ' + actions[ai].action;
        card.appendChild(actEl);
      }
    }

    // ── 10. Local impact ──
    var hasLocal = reg.localRepair && reg.localRepair.reduction > 0;
    var hasGlobal = reg.globalRepair && reg.globalRepair.length > 0;
    if (hasLocal || hasGlobal) {
      _renderImpact(reg.localRepair, reg.globalRepair, card);
    }

    // ── 11. Evidence chain (collapsed) ──
    if (reg.evidenceChain) {
      _renderEvidenceCollapsible(reg.evidenceChain, card);
    }

    return card;
  }

  // ═══════════════════════════════════════════════════════════════
  // Card sub-renderers
  // ═══════════════════════════════════════════════════════════════

  function _stressRow(label, value, fillClass) {
    var row = document.createElement('div');
    row.className = 'lreg-stress-row';
    var lbl = document.createElement('span');
    lbl.className = 'lreg-stress-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    var track = document.createElement('div');
    track.className = 'lreg-stress-bar';
    var fill = document.createElement('div');
    fill.className = fillClass;
    fill.style.width = (Math.min(value, 1) * 100) + '%';
    track.appendChild(fill);
    row.appendChild(track);
    var val = document.createElement('span');
    val.className = 'lreg-stress-val';
    val.textContent = (value * 100).toFixed(0) + '%';
    row.appendChild(val);
    return row;
  }

  function _renderFractalInline(fractal, parent) {
    var wrap = document.createElement('div');
    wrap.className = 'lreg-fractal';

    var label = document.createElement('div');
    label.className = 'lreg-fractal-label';
    label.textContent = 'Best single move';
    wrap.appendChild(label);

    var answer = document.createElement('div');
    answer.className = 'lreg-fractal-answer';
    answer.textContent = fractal.answer || 'No answer';
    wrap.appendChild(answer);

    var metaParts = [];
    if (fractal.path && fractal.path.length > 1) {
      metaParts.push(fractal.path.join(' \u2192 '));
    }
    if (fractal.confidence) {
      metaParts.push('confidence ' + (fractal.confidence * 100).toFixed(0) + '%');
    }
    if (metaParts.length > 0) {
      var metaEl = document.createElement('div');
      metaEl.className = 'lreg-fractal-meta';
      metaEl.textContent = metaParts.join(' · ');
      wrap.appendChild(metaEl);
    }

    parent.appendChild(wrap);
  }

  function _renderImpact(local, global, parent) {
    var wrap = document.createElement('div');
    wrap.className = 'lreg-impact';

    // Local
    var localCol = document.createElement('div');
    localCol.className = 'lreg-impact-col';
    var localLabel = document.createElement('div');
    localLabel.className = 'lreg-impact-label';
    localLabel.textContent = 'If applied \u2014 here (projected)';
    localCol.appendChild(localLabel);
    if (local && local.reduction > 0) {
      var lv = document.createElement('div');
      lv.className = 'lreg-impact-value positive';
      lv.textContent = '~' + Math.round(local.reduction * 100) + '% relief (' +
        Math.round(local.currentStress * 100) + '% \u2192 ' +
        Math.round(local.projectedStress * 100) + '%)';
      localCol.appendChild(lv);
    } else {
      var lv2 = document.createElement('div');
      lv2.className = 'lreg-impact-value';
      lv2.textContent = 'No measurable reduction';
      localCol.appendChild(lv2);
    }
    wrap.appendChild(localCol);

    // Global
    var globalCol = document.createElement('div');
    globalCol.className = 'lreg-impact-col';
    var globalLabel = document.createElement('div');
    globalLabel.className = 'lreg-impact-label';
    globalLabel.textContent = 'Ripple to other domains (est.)';
    globalCol.appendChild(globalLabel);
    global = global || [];
    if (global.length > 0) {
      for (var gi = 0; gi < Math.min(global.length, 3); gi++) {
        var gv = document.createElement('div');
        gv.className = 'lreg-impact-value positive';
        gv.textContent = '\u2192 ' + global[gi].name + ': ~' +
          Math.round(global[gi].propagatedReduction * 100) + '%';
        globalCol.appendChild(gv);
      }
    } else {
      var ng = document.createElement('div');
      ng.className = 'lreg-impact-value';
      ng.textContent = 'No downstream propagation';
      globalCol.appendChild(ng);
    }
    wrap.appendChild(globalCol);

    parent.appendChild(wrap);
  }

  function _renderEvidenceCollapsible(chain, parent) {
    if (!chain || !chain.chain) return;

    var wrap = document.createElement('div');
    wrap.className = 'lreg-evidence';

    var header = document.createElement('div');
    header.className = 'lreg-evidence-header';
    header.textContent = '\u25B6 Why we think this (' +chain.chain.length + ' steps)';

    var body = document.createElement('div');
    body.className = 'lreg-evidence-body';

    var steps = chain.chain || [];
    for (var i = 0; i < steps.length; i++) {
      var stepEl = document.createElement('div');
      stepEl.className = 'lreg-chain-step';
      if (i > 0) {
        var arrow = document.createElement('span');
        arrow.className = 'lreg-chain-arrow';
        arrow.textContent = '\u2193 ';
        stepEl.appendChild(arrow);
      }
      stepEl.appendChild(document.createTextNode(steps[i]));
      body.appendChild(stepEl);
    }

    header.addEventListener('click', function () {
      var isOpen = body.classList.contains('open');
      body.classList.toggle('open');
      header.textContent = (isOpen ? '\u25B6' : '\u25BC') + ' Why we think this (' +steps.length + ' steps)';
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    parent.appendChild(wrap);
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  function _appendLabel(parent, text) {
    var label = document.createElement('div');
    label.className = 'lreg-section-label';
    label.textContent = text;
    parent.appendChild(label);
  }

  // ═══════════════════════════════════════════════════════════════
  // Legacy API — backward-compatible exports used by domain-repair-map
  // ═══════════════════════════════════════════════════════════════

  function renderEvidenceChain(chain, el) {
    _injectStyles();
    _renderEvidenceCollapsible(chain, el);
  }

  function renderFractalAnswer(fractal, el) {
    _injectStyles();
    if (!fractal || !fractal.treatment) return;
    _renderFractalInline(fractal, el);
  }

  function renderRepairImpact(local, global, el) {
    _injectStyles();
    _renderImpact(local, global, el);
  }

  function renderDomainRegulation(domainId, containerEl) {
    _injectStyles();
    if (!containerEl) return;
    var output = window.LIMENRegulationOutput;
    if (!output || !output[domainId]) return;
    containerEl.appendChild(_buildUnifiedCard(output[domainId]));
  }

  /**
   * Render a compact unified card for embedding in domain-repair-map.
   * Includes: summary sentence, fractal answer, impact, evidence.
   * Omits sections already shown by the repair-map host card.
   */
  function renderCompactRegulation(domainId, hostCard) {
    _injectStyles();
    var output = window.LIMENRegulationOutput;
    if (!output || !output[domainId]) return;
    var reg = output[domainId];

    // Gate B #9b — confidence authority badge at the top of the compact
    // block (before summary sentence). When this renders inside a
    // domain-repair-map card the host card already has its own
    // domain-level Gate B (#9a); this badge specifically signals the
    // REGULATION block's confidence, separate from the host's.
    _appendRegulationBadge(_classifyRegulationAuthority(reg), hostCard);

    // Summary sentence
    var summary = document.createElement('div');
    summary.className = 'lreg-summary';
    summary.style.marginTop = '6px';
    summary.textContent = _buildSummarySentence(reg);
    hostCard.appendChild(summary);

    // Fractal answer
    if (reg.fractalAnswer && reg.fractalAnswer.treatment) {
      _renderFractalInline(reg.fractalAnswer, hostCard);
    }

    // Impact
    var hasLocal = reg.localRepair && reg.localRepair.reduction > 0;
    var hasGlobal = reg.globalRepair && reg.globalRepair.length > 0;
    if (hasLocal || hasGlobal) {
      _renderImpact(reg.localRepair, reg.globalRepair, hostCard);
    }

    // Evidence (collapsed)
    if (reg.evidenceChain) {
      _renderEvidenceCollapsible(reg.evidenceChain, hostCard);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  window.LIMENRegulationRenderer = {
    renderRegulationTab: renderRegulationTab,
    renderDomainRegulation: renderDomainRegulation,
    renderCompactRegulation: renderCompactRegulation,
    renderEvidenceChain: renderEvidenceChain,
    renderFractalAnswer: renderFractalAnswer,
    renderRepairImpact: renderRepairImpact
  };

})();
