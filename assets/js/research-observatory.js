/**
 * research-observatory.js — Cross-domain structural analysis module
 * for the /civilization console.
 *
 * Analyzes node-entity mapping, domain assignments, and connectome
 * structure to identify research opportunities:
 *   1. Node Visibility Conflicts
 *   2. Cross-Domain Node Clusters
 *   3. Biological → Institutional Gaps
 *   4. Institutional → Biological Hypotheses
 *
 * Renders into #col-right on the civilization page.
 * Feeds into Patent Opportunities module.
 */
(function () {
  'use strict';

  var PANEL_ID = 'limen-research-observatory';
  var _mapping = null;
  var _brain = null;
  var _collapsed = {};

  // ── Load data ────────────────────────────────────────────────────
  function loadJSON(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try { cb(null, JSON.parse(xhr.responseText)); }
        catch (e) { cb(e); }
      } else { cb(new Error('HTTP ' + xhr.status)); }
    };
    xhr.onerror = function () { cb(new Error('Network error')); };
    xhr.send();
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ── Analysis: Node Visibility Conflicts ──────────────────────────
  function analyzeVisibilityConflicts(mappings) {
    // Find nodes active in few domains vs nodes active in many
    var domainCounts = {};
    var nodeDomains = {};

    mappings.forEach(function (m) {
      nodeDomains[m.node_id] = m.domains || [];
      (m.domains || []).forEach(function (d) {
        if (!domainCounts[d]) domainCounts[d] = [];
        domainCounts[d].push(m.node_id);
      });
    });

    var allDomains = Object.keys(domainCounts);
    var conflicts = [];

    // Nodes present in 3+ domains (cross-cutting) but absent from related domains
    mappings.forEach(function (m) {
      if (m.domains.length >= 2) {
        var absent = allDomains.filter(function (d) { return m.domains.indexOf(d) === -1; });
        // Check if node's system suggests it should be in more domains
        var sys = (m.system || '').toLowerCase();
        var shouldBeIn = [];
        if (sys.indexOf('executive') !== -1 && m.domains.indexOf('governance') === -1) shouldBeIn.push('governance');
        if (sys.indexOf('reward') !== -1 && m.domains.indexOf('economy') === -1) shouldBeIn.push('economy');
        if (sys.indexOf('limbic') !== -1 && m.domains.indexOf('defense') === -1) shouldBeIn.push('defense');
        if (sys.indexOf('autonomic') !== -1 && m.domains.indexOf('health') === -1) shouldBeIn.push('health');
        if (sys.indexOf('sensory') !== -1 && m.domains.indexOf('technology') === -1) shouldBeIn.push('technology');
        if (sys.indexOf('language') !== -1 && m.domains.indexOf('education') === -1) shouldBeIn.push('education');
        if (sys.indexOf('memory') !== -1 && m.domains.indexOf('intelligence') === -1) shouldBeIn.push('intelligence');

        if (shouldBeIn.length > 0) {
          conflicts.push({
            node: m.node_id,
            entity: m.mapped_entity,
            system: m.system,
            currentDomains: m.domains,
            missingDomains: shouldBeIn,
            severity: shouldBeIn.length >= 2 ? 'high' : 'medium'
          });
        }
      }
    });

    return conflicts.sort(function (a, b) {
      return b.missingDomains.length - a.missingDomains.length;
    }).slice(0, 15);
  }

  // ── Analysis: Cross-Domain Node Clusters ─────────────────────────
  function analyzeCrossDomainClusters(mappings) {
    var multiDomain = mappings.filter(function (m) { return m.domains && m.domains.length >= 2; });

    // Group by domain-pair
    var pairs = {};
    multiDomain.forEach(function (m) {
      var doms = m.domains.sort();
      for (var i = 0; i < doms.length; i++) {
        for (var j = i + 1; j < doms.length; j++) {
          var key = doms[i] + ' \u2194 ' + doms[j];
          if (!pairs[key]) pairs[key] = [];
          pairs[key].push({ node: m.node_id, entity: m.mapped_entity, confidence: m.confidence });
        }
      }
    });

    // Sort by cluster size
    return Object.keys(pairs).map(function (key) {
      return { domainPair: key, nodes: pairs[key], count: pairs[key].length };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 12);
  }

  // ── Analysis: Biological → Institutional Gaps ────────────────────
  function analyzeBioGaps(mappings) {
    var gaps = [];

    mappings.forEach(function (m) {
      var hasGap = false;
      var reason = '';

      if (m.confidence === 'medium') {
        hasGap = true;
        reason = 'UNVERIFIED — low-confidence mapping for ' + (m.brain_region || m.node_id) + '. Institutional analog not yet identified.';
      }

      // Check for proxy-based mappings
      if (m.mapped_entity && m.mapped_entity.indexOf('proxy') !== -1) {
        hasGap = true;
        reason = 'UNVERIFIED — proxy mapping for ' + (m.brain_region || m.node_id) + '. Direct equivalent not yet established.';
      }

      // Neuromodulatory systems often lack direct institutional analogs
      var sys = (m.system || '').toLowerCase();
      if (sys.indexOf('neuromod') !== -1 || sys.indexOf('plasticity') !== -1 || sys.indexOf('oscillat') !== -1) {
        if (m.confidence !== 'very high') {
          hasGap = true;
          reason = 'HYPOTHESIS — neuromodulatory/plasticity function (' + (m.brain_region || m.node_id) + ') may lack direct organizational equivalent. Potential area for investigation.';
        }
      }

      if (hasGap) {
        gaps.push({
          node: m.node_id,
          region: m.brain_region || m.node_id,
          system: m.system,
          function: m.functional_summary || '',
          currentEntity: m.mapped_entity,
          gapType: reason,
          researchOpportunity: 'HYPOTHESIS — investigate whether institutional analog exists for ' + (m.brain_region || m.node_id) + ' function: ' + (m.functional_summary || '').substring(0, 80)
        });
      }
    });

    return gaps.slice(0, 15);
  }

  // ── Analysis: Institutional → Biological Hypotheses ──────────────
  function analyzeInstitutionalHypotheses(mappings) {
    var hypotheses = [];

    // Find entities that map to multiple brain nodes
    var entityNodes = {};
    mappings.forEach(function (m) {
      var key = m.ticker || m.mapped_entity;
      if (!entityNodes[key]) entityNodes[key] = [];
      entityNodes[key].push({ node: m.node_id, region: m.brain_region, system: m.system });
    });

    Object.keys(entityNodes).forEach(function (key) {
      if (entityNodes[key].length >= 2) {
        var nodes = entityNodes[key];
        var systems = nodes.map(function (n) { return n.system; }).filter(function (s, i, a) { return a.indexOf(s) === i; });
        hypotheses.push({
          entity: key,
          nodeCount: nodes.length,
          nodes: nodes.map(function (n) { return n.node + ' (' + (n.region || '').substring(0, 25) + ')'; }),
          systems: systems,
          hypothesis: 'HYPOTHESIS — ' + key + ' spans ' + nodes.length + ' brain regions across ' + systems.length + ' network(s). May indicate multi-system integration role. Unverified.'
        });
      }
    });

    // Also identify domain-dominant entities
    var domainEntityCounts = {};
    mappings.forEach(function (m) {
      (m.domains || []).forEach(function (d) {
        var key = d + ':' + (m.ticker || m.mapped_entity);
        domainEntityCounts[key] = (domainEntityCounts[key] || 0) + 1;
      });
    });

    // Entities appearing in 3+ domains
    var crossDomainEntities = {};
    mappings.forEach(function (m) {
      var key = m.ticker || m.mapped_entity;
      if (!crossDomainEntities[key]) crossDomainEntities[key] = new Set();
      (m.domains || []).forEach(function (d) { crossDomainEntities[key].add(d); });
    });

    Object.keys(crossDomainEntities).forEach(function (key) {
      var doms = Array.from(crossDomainEntities[key]);
      if (doms.length >= 3) {
        hypotheses.push({
          entity: key,
          nodeCount: 0,
          nodes: [],
          systems: doms,
          hypothesis: 'HYPOTHESIS — ' + key + ' appears across ' + doms.length + ' domains (' + doms.join(', ') + '). Potential cross-domain integration role. Unverified.'
        });
      }
    });

    return hypotheses.sort(function (a, b) { return b.nodeCount - a.nodeCount; }).slice(0, 12);
  }

  // ── Render ───────────────────────────────────────────────────────
  function render(mapping) {
    var mappings = mapping.mappings || [];
    var el = document.getElementById(PANEL_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = PANEL_ID;
      el.className = 'console-panel';
    }

    var conflicts = analyzeVisibilityConflicts(mappings);
    var clusters = analyzeCrossDomainClusters(mappings);
    var bioGaps = analyzeBioGaps(mappings);
    var hypotheses = analyzeInstitutionalHypotheses(mappings);

    var html = '<div class="ro-header" onclick="ResearchObservatory.toggleAll()">';
    html += '<div class="ro-title">RESEARCH OBSERVATORY</div>';
    html += '<div class="ro-subtitle">' + mappings.length + ' nodes \u00b7 ' + (mapping._total_signals || 0) + ' signals \u00b7 ' + (mapping._domains_covered || []).length + ' domains</div>';
    html += '</div>';

    // Section 1: Visibility Conflicts
    html += renderSection('conflicts', 'NODE VISIBILITY GAPS (HEURISTIC)', conflicts.length + ' potential gaps detected',
      conflicts.map(function (c) {
        return '<div class="ro-item ro-conflict">' +
          '<div class="ro-item-head"><span class="ro-node">' + esc(c.node) + '</span> <span class="ro-entity">' + esc(c.entity) + '</span></div>' +
          '<div class="ro-item-detail">Active in: ' + c.currentDomains.join(', ') + '</div>' +
          '<div class="ro-item-gap">Missing from: <strong>' + c.missingDomains.join(', ') + '</strong></div>' +
          '<div class="ro-item-meta">' + esc(c.system) + ' \u00b7 ' + c.severity + '</div>' +
          '</div>';
      }).join('')
    );

    // Section 2: Cross-Domain Clusters
    html += renderSection('clusters', 'CROSS-DOMAIN NODE CLUSTERS', clusters.length + ' domain bridges',
      clusters.map(function (cl) {
        return '<div class="ro-item ro-cluster">' +
          '<div class="ro-item-head">' + esc(cl.domainPair) + ' <span class="ro-count">' + cl.count + ' nodes</span></div>' +
          '<div class="ro-item-detail">' + cl.nodes.map(function (n) { return esc(n.node) + ' (' + esc(n.entity) + ')'; }).join(' \u00b7 ') + '</div>' +
          '</div>';
      }).join('')
    );

    // Section 3: Bio → Institutional Gaps
    html += renderSection('biogaps', 'BIOLOGICAL \u2192 INSTITUTIONAL GAPS (UNVERIFIED)', bioGaps.length + ' unverified mappings',
      bioGaps.map(function (g) {
        return '<div class="ro-item ro-gap">' +
          '<div class="ro-item-head"><span class="ro-node">' + esc(g.node) + '</span> ' + esc(g.region) + '</div>' +
          '<div class="ro-item-detail">' + esc(g.gapType) + '</div>' +
          '<div class="ro-item-opp">\u2192 ' + esc(g.researchOpportunity) + '</div>' +
          '</div>';
      }).join('')
    );

    // Section 4: Institutional → Biological Hypotheses
    html += renderSection('hypotheses', 'INSTITUTIONAL \u2192 BIOLOGICAL HYPOTHESES (UNVERIFIED)', hypotheses.length + ' proposed \u2014 unverified',
      hypotheses.map(function (h) {
        return '<div class="ro-item ro-hypothesis">' +
          '<div class="ro-item-head"><span class="ro-entity">' + esc(h.entity) + '</span>' + (h.nodeCount ? ' \u00b7 ' + h.nodeCount + ' nodes' : '') + '</div>' +
          '<div class="ro-item-detail">' + esc(h.hypothesis) + '</div>' +
          '</div>';
      }).join('')
    );

    // Patent feed link
    html += '<div class="ro-patent-feed">';
    html += '<div class="ro-patent-title">PATENT OPPORTUNITY FEED</div>';
    html += '<div class="ro-patent-count">' + (conflicts.length + bioGaps.length + hypotheses.length) + ' research opportunities identified</div>';
    html += '<div class="ro-patent-items">';
    bioGaps.slice(0, 5).forEach(function (g) {
      html += '<div class="ro-patent-item">\u25B8 ' + esc(g.researchOpportunity).substring(0, 100) + '</div>';
    });
    html += '</div></div>';

    el.innerHTML = html;

    // Attach to right column
    var target = document.getElementById('col-right');
    if (target && !document.getElementById(PANEL_ID)) {
      target.appendChild(el);
    }
  }

  function renderSection(id, title, subtitle, contentHtml) {
    var collapsed = _collapsed[id];
    return '<div class="ro-section' + (collapsed ? ' ro-collapsed' : '') + '">' +
      '<div class="ro-section-header" onclick="ResearchObservatory.toggle(\'' + id + '\')">' +
      '<span class="ro-section-arrow">' + (collapsed ? '\u25B6' : '\u25BC') + '</span> ' +
      '<span class="ro-section-title">' + title + '</span>' +
      '<span class="ro-section-count">' + subtitle + '</span>' +
      '</div>' +
      '<div class="ro-section-body" style="' + (collapsed ? 'display:none' : '') + '">' +
      contentHtml +
      '</div></div>';
  }

  // ── Init ─────────────────────────────────────────────────────────
  function init() {
    loadJSON('assets/data/node-entity-mapping.json', function (err, data) {
      if (err) { console.warn('[ResearchObservatory] Failed to load mapping:', err); return; }
      _mapping = data;
      // Expose mapping to report pipeline for patent/research cross-reference
      window._limenNodeEntityMapping = data;
      render(data);
    });
  }

  // Auto-init after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 1000); });
  } else {
    setTimeout(init, 1000);
  }

  // Public API
  window.ResearchObservatory = {
    init: init,
    toggle: function (id) {
      _collapsed[id] = !_collapsed[id];
      if (_mapping) render(_mapping);
    },
    toggleAll: function () {
      var allCollapsed = Object.keys(_collapsed).every(function (k) { return _collapsed[k]; });
      ['conflicts', 'clusters', 'biogaps', 'hypotheses'].forEach(function (id) { _collapsed[id] = !allCollapsed; });
      if (_mapping) render(_mapping);
    }
  };
})();
