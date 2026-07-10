// =============================================
// LIMEN HELIX — PORTAL UI MODULE
// Shared UI logic for all 3-panel portal pages
// Engine-agnostic: works with ConnectomeCore or ConnectomeRenderer
// Matches clinical.html's right panel engine VERBATIM
// =============================================

var PortalUI = (function() {
  'use strict';

  // ═══ ENGINE DETECTION ═══
  var Engine = (typeof ConnectomeCore !== 'undefined') ? ConnectomeCore.Canvas : ConnectomeRenderer;
  var Constants = (typeof ConnectomeCore !== 'undefined') ? ConnectomeCore : ConnectomeRenderer;

  var config = null;
  var currentView = '2d';
  var DATA = null;          // Authoritative source: assets/data/domains/{domainId}.json
  var activeIssueId = null;

  // Canonical intervention categories — used by issueToDx, buildInterventions, tab selector
  var INTERVENTION_CATS = ['strategy', 'coaching', 'structural', 'culture', 'tools'];
  var CAT_LABELS = {strategy:'Strategy', coaching:'Coaching', structural:'Structural', culture:'Culture', tools:'Tools'};

  // Cross-domain lookup: brainNodeId → [{domain, label}]
  var CROSS_DOMAIN_MAP = null;

  // ═══ RIGHT PANEL STATE (matches clinical.html globals) ═══
  var packetSelections = {};
  var activeTab = 'strategy';
  var activeWorkflow = 'snapshot';
  var langMode = 'expert';
  var currentSeverity = 'none';
  var currentDx = null; // adapted dx object for active issue

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // Helper: get node array (handles API difference)
  function getNodeArray() {
    if (Engine.getNodeList) return Engine.getNodeList();
    if (Array.isArray(Engine.getNodes())) return Engine.getNodes();
    var nodes = Engine.getNodes();
    var arr = [];
    for (var k in nodes) arr.push(nodes[k]);
    return arr;
  }

  // Helper: find node by ID in array
  function findNodeById(nodeId) {
    var nodes = getNodeArray();
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === nodeId) return nodes[i];
    }
    return null;
  }

  // Helper: get edges with ai/bi indices for compatibility
  function getEdgesCompat() {
    var edges = Engine.getEdges();
    if (!edges || edges.length === 0) return [];
    if (edges[0] && typeof edges[0].ai === 'number') return edges;
    var nodeList = getNodeArray();
    var idxMap = {};
    for (var i = 0; i < nodeList.length; i++) idxMap[nodeList[i].id] = i;
    return edges.map(function(e) {
      return {
        ai: idxMap[e.a] !== undefined ? idxMap[e.a] : -1,
        bi: idxMap[e.b] !== undefined ? idxMap[e.b] : -1,
        type: e.type, weight: e.w, isDomainEdge: e.isDomainEdge
      };
    });
  }

  // ═══ ISSUE SELECTOR ═══
  // Authoritative source: DATA.issues array from the domain JSON.
  // Each issue must have id and label; circuits[] is optional but expected.
  function buildIssueSelector() {
    if (!config.issuesEnabled || !DATA || !DATA.issues) return;
    var container = document.getElementById('issueSection');
    if (!container) return;

    var html = '<div class="issue-section-label">DIAGNOSE AN ISSUE</div>';
    html += '<div class="issue-items">';
    for (var i = 0; i < DATA.issues.length; i++) {
      var issue = DATA.issues[i];
      if (!issue || !issue.id || !issue.label) continue; // skip malformed entries
      html += '<div class="issue-item" data-issue-id="' + escHtml(issue.id) + '" onclick="PortalUI.toggleIssue(\'' + escHtml(issue.id) + '\')">';
      html += '<span class="issue-name">' + escHtml(issue.label) + '</span>';
      if (issue.circuits && issue.circuits.length > 0) {
        html += '<span class="issue-count">' + issue.circuits.length + ' circuits</span>';
      }
      html += '</div>';
    }
    html += '</div>';
    container.className = 'issue-section';
    container.innerHTML = html;
    container.style.display = 'block';
  }

  function toggleIssue(issueId) {
    if (!DATA || !DATA.issues) return;

    // Toggle — clicking active issue clears it (matches clinical.html selectDx toggle)
    if (activeIssueId === issueId) {
      activeIssueId = null;
      currentDx = null;
      packetSelections = {};
      Engine.clearIssue();
      clearIssueHighlight();
      clearSelection();
      _savePortalSelection();
      return;
    }

    var issue = null;
    for (var i = 0; i < DATA.issues.length; i++) {
      if (DATA.issues[i].id === issueId) { issue = DATA.issues[i]; break; }
    }
    if (!issue) return;

    activeIssueId = issueId;
    packetSelections = {};
    activeWorkflow = 'snapshot';
    currentDx = issueToDx(issue);
    // Default to first non-empty intervention category (agriculture has structural/tools only)
    activeTab = 'strategy';
    for (var ci = 0; ci < INTERVENTION_CATS.length; ci++) {
      if (currentDx.interventions[INTERVENTION_CATS[ci]] && currentDx.interventions[INTERVENTION_CATS[ci]].length > 0) {
        activeTab = INTERVENTION_CATS[ci]; break;
      }
    }
    Engine.selectIssue(issue);
    highlightIssueItem(issueId);
    buildInterventions(currentDx);
    _savePortalSelection();

    // Update 3D if active
    if (typeof ConnectomeCore !== 'undefined' && ConnectomeCore.Brain3D.getState().active) {
      ConnectomeCore.Brain3D.updateNodeStates();
    }
  }

  function highlightIssueItem(issueId) {
    var items = document.querySelectorAll('.issue-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-issue-id') === issueId);
    }
    var nodeItems = document.querySelectorAll('.dx-item');
    for (var i = 0; i < nodeItems.length; i++) nodeItems[i].classList.remove('active');
  }

  function clearIssueHighlight() {
    activeIssueId = null;
    var items = document.querySelectorAll('.issue-item');
    for (var i = 0; i < items.length; i++) items[i].classList.remove('active');
  }

  // ═══════════════════════════════════════════════════════
  // DATA ADAPTER: domain issue → clinical dx shape
  // Authoritative sources:
  //   issue object  → DATA.issues[] from domain JSON
  //   node lookup   → Engine node list (brain-connectome.json + domain activation)
  //   treatments    → activation.treatments[] per node in domain JSON
  //   category map  → INTERVENTION_CATS constant
  // ═══════════════════════════════════════════════════════

  // ═══ LIVE DERIVATION (portals-as-feeds) ═══════════════════════════════
  // Every portal renders its diagnosis from (live domain level x the bound
  // node's motif failure-mode), NOT the frozen stored summary. Same grammar as
  // lib/node-guard.js (server) and domain-brain-base (brain), so every domain
  // and every portal reads identically — universal, because every portal loads
  // this one file. Level source = window.LIMENDomains (cached console snapshot,
  // loaded cheaply by _loadLiveContext — no paid rebuild). Non-nodes are BRAKED.
  var _CANON = null, _canonPromise = null;
  function _loadCanon() {
    if (_CANON) return Promise.resolve(_CANON);
    if (_canonPromise) return _canonPromise;
    _canonPromise = fetch('/assets/data/canonical-nodes.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { _CANON = (j && j.nodes) || {}; return _CANON; })
      .catch(function () { _CANON = {}; return _CANON; });
    return _canonPromise;
  }
  function _rootDomain(d) { return String(d || '').split('_')[0]; }
  function _liveLevel(domainId) {
    try {
      var L = window.LIMENDomains, s = L && L[_rootDomain(domainId)];
      if (s) {
        var v = (typeof s.stress === 'number') ? s.stress
              : (typeof s.distress === 'number') ? s.distress
              : (typeof s.score === 'number') ? s.score : null;
        if (v != null) return v > 1 ? v / 100 : v;   // normalize 0..100 -> 0..1
      }
    } catch (e) {}
    return null;
  }
  function _poleText(rec, pole) {
    // Split on " / " (space-slash-space) — a pole itself may contain a slash,
    // e.g. "mania/addiction / anhedonia".
    var parts = String(rec.failureModes || '').split(/\s+\/\s+/);
    if (pole === 'hyper') return (parts[0] || '').trim() || 'elevated activation';
    if (pole === 'hypo') return (parts[1] || '').trim() || 'suppressed activation';
    return rec.motif ? 'within regulated range' : 'nominal activation';
  }
  function _deriveNode(nodeId, level, dir) {
    var rec = _CANON && _CANON[nodeId];
    if (!rec) return { unknown: true, nodeId: nodeId };
    if (!rec.canBindBusiness) return { blocked: true, nodeId: nodeId, cls: rec.class, remapTo: rec.remapTo };
    // The circuit's AUTHORED direction (Hyper/Hypo) is the issue's inherent
    // dysregulation pole — e.g. a credit freeze IS a shut gate (hypo) whether or
    // not the whole domain is hot. So the authored direction sets the POLE and
    // the live level sets INTENSITY. Only when a circuit carries no direction do
    // we fall back to deriving the pole from the level.
    var dl = String(dir || '').toLowerCase();
    var authoredPole = dl.indexOf('hyper') === 0 ? 'hyper' : dl.indexOf('hypo') === 0 ? 'hypo' : null;
    if (level == null && !authoredPole) return { ok: true, nodeId: nodeId, motif: rec.motif, role: rec.role || null, pole: null, reading: null };
    var pole = authoredPole || (level >= 0.60 ? 'hyper' : (level <= 0.15 ? 'hypo' : 'regulated'));
    return { ok: true, nodeId: nodeId, motif: rec.motif, role: rec.role || null,
             level: level, intensity: level, pole: pole, authored: !!authoredPole, reading: _poleText(rec, pole) };
  }
  // derive a whole issue: primary = first real bound node's live reading; braked = non-node bindings
  function deriveIssue(issue, domainId) {
    if (!_CANON) return null;
    var circuits = (issue && issue.circuits) || [];
    var level = _liveLevel(domainId);
    var primary = null, braked = [];
    for (var i = 0; i < circuits.length; i++) {
      var nid = circuits[i] && circuits[i].nodeId; if (!nid) continue;
      var d = _deriveNode(nid, level, circuits[i] && circuits[i].dir);
      if (d.blocked) { braked.push(d); continue; }
      if (d.ok && !primary) primary = d;
    }
    return { level: level, primary: primary, braked: braked, domain: _rootDomain(domainId) };
  }

  // STRUCTURAL UNIFORMITY: issues[] is authored in only ~half the tree (L1-L3);
  // the deep tree (L4-L7) carries only activations[]. But activations[] with a
  // brainNodeId is present in 100% of portals at every depth. So when a portal
  // has no authored issues, synthesize the diagnosis list from its activations —
  // one node-anchored issue per unique REAL bound node (non-nodes skipped once
  // the registry is loaded; else braked at render). Result: every portal, every
  // domain, every depth presents the identical structure and renders live.
  function _ensureIssues(data) {
    if (!data) return;
    if (Array.isArray(data.issues) && data.issues.length) return; // authored issues win
    var acts = (data.activations || []).filter(function (a) { return a && a.brainNodeId; });
    if (!acts.length) { data.issues = data.issues || []; return; }
    var seen = {}, out = [];
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i], nid = a.brainNodeId;
      if (seen[nid]) continue; seen[nid] = true;
      var rec = _CANON && _CANON[nid];
      if (rec && !rec.canBindBusiness) continue;   // skip non-nodes once registry is loaded
      out.push({
        id: 'act_' + nid,
        label: a.domainLabel || a.nodeRole || (nid + ' activation'),
        summary: a.domainDescription || a.description || ('Node ' + nid + ' is active in this portal; reading derived live below.'),
        circuits: [{ nodeId: nid, dir: a.dir || '', detail: a.state || '' }],
        _synthetic: true
      });
    }
    data.issues = out;
    data._issuesSynthetic = true;
  }

  function issueToDx(issue) {
    var circuits = (issue.circuits || []).filter(function(c) {
      return c && c.nodeId; // skip circuits with missing nodeId
    }).map(function(c) {
      var node = findNodeById(c.nodeId);
      var nodeName = (node && node.domainLabel) ? node.domainLabel : c.nodeId;
      return { node: c.nodeId, dir: c.dir, detail: c.detail || '', evidence: c.evidence || 'C', displayName: nodeName };
    });

    var interventions = { strategy:[], coaching:[], structural:[], culture:[], tools:[] };
    var catMap = { STRATEGY:'strategy', COACHING:'coaching', STRUCTURAL:'structural', CULTURE:'culture', TOOLS:'tools', DIAGNOSTIC:'tools' };
    var seen = {};

    if (issue.circuits) {
      for (var i = 0; i < issue.circuits.length; i++) {
        var circ = issue.circuits[i];
        var node = findNodeById(circ.nodeId);
        if (node && node.treatments) {
          for (var j = 0; j < node.treatments.length; j++) {
            var tx = node.treatments[j];
            if (seen[tx.label]) continue;
            seen[tx.label] = true;
            var cat = catMap[(tx.type || '').toUpperCase()] || 'tools';
            interventions[cat].push({
              name: tx.label,
              evidence: tx.evidence || 'C',
              mechanism: tx.description || '',
              cite: tx.cite || '',
              target: tx.target ? [tx.target] : []
            });
          }
        }
      }
    }

    return {
      name: issue.label,
      dsm5: '',
      prevalence: '',
      summary: issue.summary || issue.description || '',
      circuits: circuits,
      interventions: interventions,
      criteria: null,
      metabolic: null,
      _issue: issue,   // kept so the live reading can be recomputed on refresh
      // Live reading computed from (live domain level x node motif). Null until
      // canonical-nodes.json loads; the open dx re-renders when it + the live
      // snapshot arrive (see init / _loadLiveContext).
      derived: deriveIssue(issue, DATA && DATA.domainId)
    };
  }

  // Recompute the open diagnosis's live reading and re-render it. Called when
  // the canonical registry and/or the live level finish loading, so the words
  // upgrade from baked -> live without a click.
  function _refreshOpenDx() {
    if (!currentDx || !currentDx._issue) return;
    currentDx.derived = deriveIssue(currentDx._issue, DATA && DATA.domainId);
    var content = document.getElementById('interventionContent');
    if (content && content.style.display !== 'none') buildInterventions(currentDx);
  }

  // ═══════════════════════════════════════════════════════
  // RIGHT PANEL ENGINE — copied verbatim from clinical.html
  // with 6 text substitutions applied
  // ═══════════════════════════════════════════════════════

  function buildInterventions(dx) {
    document.getElementById('rightEmpty').style.display = 'none';
    var content = document.getElementById('interventionContent');
    content.style.display = 'block';
    var dd = document.getElementById('nodeDeepDive');
    if (dd) dd.style.display = 'none';
    try {

    var cats = INTERVENTION_CATS;
    var catLabels = CAT_LABELS;

    // ─── LIVE READING: derived from (live domain level × bound node motif) ───
    // This is the verbiage that MOVES as feeds move; the stored summary below
    // becomes authored reference. Brakes any non-node binding it finds.
    var _live = '';
    if (dx.derived) {
      var der = dx.derived;
      if (der.primary && der.primary.reading) {
        var pc = der.primary.pole === 'hyper' ? '#e0913c' : der.primary.pole === 'hypo' ? '#6fa8c8' : '#5ab5a0';
        _live += '<div style="margin-top:8px;padding:8px 10px;border-left:2px solid ' + pc + ';background:rgba(90,181,160,0.06);border-radius:2px">' +
          '<div style="font-size:0.42rem;letter-spacing:2px;color:' + pc + ';text-transform:uppercase">LIVE · ' + escHtml(der.primary.nodeId) + (der.primary.motif ? ' · ' + escHtml(der.primary.motif) : '') + ' · ' + escHtml(der.primary.pole) + (der.primary.authored ? '' : ' (level-derived)') + '</div>' +
          '<div style="font-family:Crimson Pro,serif;font-size:0.86rem;color:var(--text);line-height:1.5;margin-top:4px">' + escHtml(der.primary.reading) + '</div>' +
          '<div style="font-size:0.4rem;color:var(--text-ghost);letter-spacing:1px;margin-top:4px">' + escHtml(der.domain) + (der.primary.authored ? ' intensity ' : ' level ') + (der.level != null ? Math.round(der.level * 100) + '%' : 'n/a') + ' × ' + (der.primary.authored ? 'authored direction' : 'node motif') + ' · updates with feeds</div>' +
          '</div>';
      } else if (der.primary) {
        _live += '<div style="margin-top:6px;font-size:0.42rem;color:var(--text-ghost);letter-spacing:1px">LIVE READING PENDING — awaiting live ' + escHtml(der.domain) + ' level</div>';
      }
      if (der.braked && der.braked.length) {
        _live += '<div style="margin-top:6px;font-size:0.42rem;color:#c98a3c;letter-spacing:1px">⚠ ' + der.braked.length + ' mis-wired binding(s) braked: ' + der.braked.map(function (b) { return escHtml(b.nodeId) + '→' + escHtml(b.remapTo || '?'); }).join(', ') + '</div>';
      }
    }
    var _summaryLabel = _live ? '<div style="font-size:0.42rem;color:var(--text-ghost);letter-spacing:2px;margin-top:10px;text-transform:uppercase">Authored reference</div>' : '';

    // ─── HEADER: Issue info ───
    var html = '<div style="padding:14px 16px;border-bottom:1px solid var(--border)">' +
      '<div style="font-family:Crimson Pro,serif;font-size:1.1rem;font-weight:300;color:var(--gold);letter-spacing:1px">' + escHtml(dx.name) + '</div>' +
      '<div style="font-size:0.5rem;color:var(--gold-dim);letter-spacing:2px;margin-top:2px">' + escHtml(dx.dsm5) + '</div>' +
      '<div style="font-size:0.5rem;color:var(--text-ghost);letter-spacing:1px;margin-top:3px">' + escHtml(dx.prevalence) + '</div>' +
      _live +
      _summaryLabel +
      '<div style="font-family:Crimson Pro,serif;font-size:0.78rem;color:var(--text-dim);line-height:1.5;margin-top:8px">' + escHtml(dx.summary) + '</div>' +
      '<div style="font-size:0.5rem;color:var(--text-ghost);letter-spacing:1px;margin-top:3px">' + (dx.circuits || []).length + ' CIRCUITS AFFECTED</div>' +
      '</div>';

    // ─── SEVERITY BAR (hidden for agriculture portals) ───
    html += '<div class="severity-bar" style="display:none">' +
      '<div class="sev-group">' +
        '<span class="sev-label">SCORE-1</span>' +
        '<input type="number" class="sev-input" id="phq9Input" min="0" max="27" placeholder="\u2014" onchange="updateSeverity()">' +
      '</div>' +
      '<div class="sev-group">' +
        '<span class="sev-label">SCORE-2</span>' +
        '<input type="number" class="sev-input" id="gad7Input" min="0" max="21" placeholder="\u2014" onchange="updateSeverity()">' +
      '</div>' +
      '<span class="sev-badge sev-none" id="sevBadge">NO SCORE</span>' +
      '<div class="lang-toggle" style="margin-left:auto">' +
        '<button class="lang-btn active" id="langClinical" onclick="setLang(\'expert\')">Expert</button>' +
        '<button class="lang-btn" id="langPatient" onclick="setLang(\'summary\')">Summary</button>' +
      '</div>' +
      '</div>';

    // ─── WORKFLOW TABS ───
    html += '<div class="workflow-tabs">' +
      '<div class="wf-tab active" data-wf="snapshot" onclick="switchWorkflow(\'snapshot\')"><span class="wf-icon">\u26A1</span>Snapshot</div>' +
      '<div class="wf-tab" data-wf="criteria" onclick="switchWorkflow(\'criteria\')"><span class="wf-icon">\uD83D\uDCCB</span>Indicators</div>' +
      '<div class="wf-tab" data-wf="interventions" onclick="switchWorkflow(\'interventions\')"><span class="wf-icon">\uD83D\uDC8A</span>Treat</div>' +
      '<div class="wf-tab" data-wf="actions" onclick="switchWorkflow(\'actions\')"><span class="wf-icon">\uD83D\uDCC4</span>Actions</div>' +
      '</div>';

    // ═══ PANEL 1: SNAPSHOT ═══
    html += '<div class="wf-panel active" id="wfSnapshot">';
    html += generateSnapshot(dx);
    html += '</div>';

    // ═══ PANEL 2: INDICATORS (was "Criteria" in clinical.html) ═══
    html += '<div class="wf-panel" id="wfCriteria">';
    if (dx.criteria) {
      html += '<div style="padding:14px 16px;border-bottom:1px solid var(--border)">';
      html += '<div class="crit-title">' + dx.criteria.title + '</div>';
      dx.criteria.sections.forEach(function(s) {
        html += '<div class="crit-section"><span class="crit-id">' + s.id + '.</span>';
        html += '<span class="crit-text">' + s.text + '</span>';
        if (s.items) {
          html += '<div class="crit-items">';
          s.items.forEach(function(item, i) {
            html += '<div class="crit-item"><span class="crit-item-num">' + (i+1) + '.</span> ' + item + '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
      if (dx.criteria.specifiers) {
        html += '<div class="crit-sub-title">SPECIFIERS</div>';
        html += '<div class="crit-tags">';
        dx.criteria.specifiers.forEach(function(s) {
          html += '<span class="crit-tag">' + s + '</span>';
        });
        html += '</div>';
      }
      if (dx.criteria.severity) {
        html += '<div class="crit-sub-title">SEVERITY / COURSE</div>';
        html += '<div class="crit-tags">';
        dx.criteria.severity.forEach(function(s) {
          html += '<span class="crit-tag">' + s + '</span>';
        });
        html += '</div>';
      }
      if (dx.criteria.codingNote) {
        html += '<div class="crit-note">' + dx.criteria.codingNote + '</div>';
      }
      html += '</div>';
    } else {
      // Agriculture: show circuit list as indicators
      html += '<div style="padding:14px 16px;border-bottom:1px solid var(--border)">';
      html += '<div class="crit-title">CIRCUIT INDICATORS</div>';
      if (dx.circuits && dx.circuits.length > 0) {
        dx.circuits.forEach(function(c) {
          var node = findNodeById(c.node);
          var nodeName = (node && node.domainLabel) ? node.domainLabel : (c.displayName || c.node);
          html += '<div class="crit-section">';
          html += '<span class="crit-id">' + escHtml(c.node) + '</span>';
          html += '<span class="crit-text">' + escHtml(nodeName) + ' \u2014 ' + escHtml(c.dir || 'dysreg').toUpperCase() + '</span>';
          if (c.detail) {
            html += '<div class="crit-items"><div class="crit-item">' + escHtml(c.detail) + '</div></div>';
          }
          if (c.evidence) {
            html += '<div class="crit-items"><div class="crit-item">Evidence: ' + escHtml(c.evidence) + '</div></div>';
          }
          html += '</div>';
        });
      } else {
        html += '<div style="padding:30px 16px;color:var(--text-ghost);font-size:0.55rem;letter-spacing:2px;text-align:center">INDICATORS NOT YET AVAILABLE FOR THIS ISSUE</div>';
      }
      html += '</div>';
    }
    // Differential Comparison
    html += generateDifferential(dx);
    html += '</div>';

    // ═══ PANEL 3: INTERVENTIONS ═══
    html += '<div class="wf-panel" id="wfInterventions">';

    // Metabolic considerations (if present)
    if (dx.metabolic && dx.metabolic.length > 0) {
      html += '<div class="metabolic-section">';
      html += '<div class="metabolic-header">METABOLIC CONSIDERATIONS</div>';
      dx.metabolic.forEach(function(m) {
        html += '<div class="metabolic-item">';
        html += '<div class="metabolic-factor">' + m.factor + '</div>';
        html += '<div class="metabolic-relevance">' + m.relevance + '</div>';
        html += '<div class="metabolic-screen"><span class="metabolic-screen-label">SCREEN: </span>' + m.screen + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '<div class="int-tabs">';
    cats.forEach(function(cat) {
      var count = dx.interventions[cat] ? dx.interventions[cat].length : 0;
      html += '<div class="int-tab' + (cat === activeTab ? ' active' : '') + '" data-cat="' + cat + '" onclick="switchTab(\'' + cat + '\')">' +
        catLabels[cat] + ' (' + count + ')</div>';
    });
    html += '</div>';

    html += '<div id="packetBar" style="padding:6px 12px;background:rgba(106,170,106,0.06);border-bottom:1px solid rgba(106,170,106,0.15);display:flex;justify-content:space-between;align-items:center">';
    html += '<span id="packetCount" style="font-size:0.5rem;letter-spacing:1.5px;color:#6aaa6a">0 SELECTED</span>';
    html += '<button id="packetBtn" onclick="printPatientPacket()" style="background:rgba(106,170,106,0.1);border:1px solid rgba(106,170,106,0.3);color:#6aaa6a;padding:5px 14px;font-size:0.45rem;letter-spacing:2.5px;cursor:pointer;text-transform:uppercase;font-family:\'IBM Plex Mono\',monospace;opacity:0.4;pointer-events:none" disabled>\uD83D\uDDA8\uFE0F BUILD REPORT</button>';
    html += '</div>';

    html += '<div class="int-list" id="intList">';
    html += renderInterventionList(dx, activeTab);
    html += '</div>';

    // ═══ RESOLVER INTELLIGENCE (additive secondary layer) ═══
    html += _buildResolverBlock(dx);

    html += '</div>';

    // ═══ PANEL 4: ACTIONS ═══
    html += '<div class="wf-panel" id="wfActions">';
    html += '<div style="padding:14px 16px">';

    // Action buttons
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    html += '<button onclick="generateSOAP()" style="width:100%;padding:12px 16px;background:rgba(201,169,78,0.06);border:1px solid rgba(201,169,78,0.15);color:var(--gold-dim);font-size:0.45rem;letter-spacing:2.5px;cursor:pointer;text-transform:uppercase;font-family:\'IBM Plex Mono\',monospace;text-align:left;transition:all 0.15s"><span style="margin-right:10px">\uD83D\uDCC4</span>GENERATE REPORT<span style="float:right;font-size:0.35rem;color:var(--text-ghost)">Print-ready documentation template</span></button>';
    html += '<button onclick="copyToEMR()" style="width:100%;padding:12px 16px;background:rgba(201,169,78,0.06);border:1px solid rgba(201,169,78,0.15);color:var(--gold-dim);font-size:0.45rem;letter-spacing:2.5px;cursor:pointer;text-transform:uppercase;font-family:\'IBM Plex Mono\',monospace;text-align:left;transition:all 0.15s"><span style="margin-right:10px">\uD83D\uDCCB</span>COPY TO CLIPBOARD<span style="float:right;font-size:0.35rem;color:var(--text-ghost)">Plain text format</span></button>';
    html += '<button onclick="printSnapshot()" style="width:100%;padding:12px 16px;background:rgba(201,169,78,0.06);border:1px solid rgba(201,169,78,0.15);color:var(--gold-dim);font-size:0.45rem;letter-spacing:2.5px;cursor:pointer;text-transform:uppercase;font-family:\'IBM Plex Mono\',monospace;text-align:left;transition:all 0.15s"><span style="margin-right:10px">\uD83D\uDDA8\uFE0F</span>PRINT SNAPSHOT<span style="float:right;font-size:0.35rem;color:var(--text-ghost)">One-page summary</span></button>';
    html += '<button onclick="printPatientPacket()" id="actionPacketBtn" style="width:100%;padding:12px 16px;background:rgba(106,170,106,0.06);border:1px solid rgba(106,170,106,0.15);color:#6aaa6a;font-size:0.45rem;letter-spacing:2.5px;cursor:pointer;text-transform:uppercase;font-family:\'IBM Plex Mono\',monospace;text-align:left;transition:all 0.15s"><span style="margin-right:10px">\uD83D\uDCE6</span>BUILD REPORT<span style="float:right;font-size:0.35rem;color:var(--text-ghost)" id="actionPacketCount">Select interventions in Treat tab</span></button>';
    html += '</div>';

    // Reference codes
    html += generateCPTHints(dx);

    // Disclaimer footer
    html += '<div style="font-size:0.38rem;color:rgba(200,195,184,0.18);letter-spacing:1.5px;margin-top:16px;text-transform:uppercase;line-height:1.8">Intervention lists reflect domain-level findings \u00b7 Evidence updated Feb 2026</div>';

    html += '</div>';
    html += '</div>';

    content.innerHTML = html;
    content.scrollTop = 0;
    } catch(e) {
      content.innerHTML = '<div style="padding:20px;color:#e85454;font-size:0.6rem;letter-spacing:1px">ERROR RENDERING PANEL: ' + (e.message || e) + '</div>';
      console.error('buildInterventions error:', e);
    }
  }

  // ═══ RESOLVER INTELLIGENCE BLOCK (additive — does not replace static treatments) ═══
  function _buildResolverBlock(dx) {
    // Guard: only render if portal-treatment-resolver is loaded and registry is populated
    var ptr = window.LIMENPortalTreatmentResolver;
    var mgr = window.LIMENRemedyRegistryManager;
    if (!ptr || !mgr) return '';

    var topDomain = config.domainId ? config.domainId.split('_')[0] : '';
    if (!topDomain) return '';

    // Gather affected node IDs from the current dx
    var nodeIds = (dx.circuits || []).map(function(c) { return c.node; });

    // Get live domain data if available
    var domData = (window.LIMENDomains && window.LIMENDomains[topDomain]) ? window.LIMENDomains[topDomain] : null;
    var stress = domData ? (domData.stress || 0) : 0;

    var result;
    try {
      result = ptr.resolve(topDomain, {
        stress: stress,
        nodes: nodeIds,
        domains: window.LIMENDomains || {}
      });
    } catch (e) {
      console.warn('[PortalUI] Resolver error:', e);
      return '';
    }

    if (!result || !result.treatments || result.treatments.length === 0) return '';

    // Build visually differentiated block
    var h = '';
    h += '<div style="margin-top:12px;border-top:1px solid rgba(201,169,78,0.08);padding:10px 12px">';
    h += '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">';
    h += '<span style="font-size:0.42rem;letter-spacing:2.5px;color:rgba(201,169,78,0.45);text-transform:uppercase">Registry Intelligence</span>';
    h += '<span style="font-size:0.3rem;letter-spacing:1.5px;color:rgba(200,195,184,0.18)">EVIDENCE-BASED &middot; ADVISORY</span>';
    h += '</div>';

    if (result.isPortalSourced) {
      h += '<div style="font-size:0.34rem;color:rgba(90,181,160,0.5);letter-spacing:1px;margin-bottom:6px">' + result.portalDiagnoses.length + ' portal diagnoses \u00b7 ' + result.treatmentCount + ' candidate treatments scored</div>';
    } else {
      h += '<div style="font-size:0.34rem;color:rgba(200,195,184,0.25);letter-spacing:1px;margin-bottom:6px">Live stress diagnostics \u00b7 ' + result.treatmentCount + ' treatments scored</div>';
    }

    for (var i = 0; i < result.treatments.length; i++) {
      var tx = result.treatments[i];
      var evColor = (tx.evidenceGrade === 'A' || tx.evidenceGrade === 'Strong') ? 'rgba(90,181,160,0.7)' :
                    (tx.evidenceGrade === 'B' || tx.evidenceGrade === 'Moderate') ? 'rgba(201,169,78,0.7)' :
                    'rgba(200,195,184,0.35)';
      var evLabel = tx.evidenceGrade || tx.evidence || '?';
      var sourceLabel = tx._sourceMethod === 'diagnosis' ? 'DX' : tx._sourceMethod === 'circuit' ? 'CKT' : 'DOM';

      h += '<div style="padding:5px 8px;margin-bottom:3px;border-left:2px solid rgba(201,169,78,0.1);background:rgba(0,0,0,0.12)">';
      h += '<div style="display:flex;align-items:baseline;gap:6px">';
      h += '<span style="font-size:0.34rem;letter-spacing:1px;color:' + evColor + ';min-width:14px">' + escHtml(evLabel) + '</span>';
      h += '<span style="font-size:0.44rem;color:rgba(220,215,200,0.7)">' + escHtml(tx.title || tx.label || tx.id) + '</span>';
      h += '<span style="font-size:0.3rem;color:rgba(200,195,184,0.2);letter-spacing:1px;margin-left:auto">' + sourceLabel + '</span>';
      h += '</div>';
      if (tx.rationale) {
        h += '<div style="font-size:0.38rem;color:rgba(200,195,184,0.35);margin-top:2px;line-height:1.5">' + escHtml(tx.rationale) + '</div>';
      }
      if (tx.steps && tx.steps.length > 0) {
        h += '<div style="font-size:0.34rem;color:rgba(200,195,184,0.25);margin-top:2px">';
        for (var si = 0; si < tx.steps.length; si++) {
          var _st = tx.steps[si].step || tx.steps[si];
          if (typeof _st === 'string' && _st.length > 0) {
            h += '<div style="margin-top:1px">' + (si + 1) + '. ' + escHtml(_st.length > 160 ? _st.substring(0, 160) + '\u2026' : _st) + '</div>';
          }
        }
        h += '</div>';
      }
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  // ═══ SNAPSHOT GENERATOR (from clinical.html generateSnapshot) ═══
  function generateSnapshot(dx) {
    var isSimple = (langMode === 'summary');

    // All circuits sorted by evidence level
    var circuits = (dx.circuits || []).slice().sort(function(a,b) {
      var order = {'Strong':0,'A':0,'A-':1,'B+':2,'Moderate':3,'B':3,'B-':4,'C+':5,'C':6,'Limited':6};
      return (order[a.evidence]||9) - (order[b.evidence]||9);
    });

    // First-line interventions: top from each category by evidence
    var firstLine = [];
    var cats = ['strategy','coaching','structural','culture','tools'];
    var catLabels = {strategy:'Strategy',coaching:'Coaching',structural:'Structural',culture:'Culture',tools:'Tools'};
    cats.forEach(function(cat) {
      var items = (dx.interventions[cat] || []).slice().sort(function(a,b) {
        var order = {'Strong':0,'A':0,'A-':1,'B+':2,'Moderate':3,'B':3,'B-':4,'C+':5,'C':6,'Limited':6};
        return (order[a.evidence]||9) - (order[b.evidence]||9);
      });
      if (items.length > 0 && items[0].evidence) {
        var ev = items[0].evidence;
        if (ev === 'Strong' || ev === 'Moderate' || ev === 'A' || ev === 'B+' || ev === 'A-' || ev === 'B') {
          firstLine.push({ cat:catLabels[cat], name:items[0].name, evidence:items[0].evidence });
        }
      }
      if (items.length > 1 && items[1].evidence) {
        var ev2 = items[1].evidence;
        if (ev2 === 'Strong' || ev2 === 'A' || ev2 === 'A-') {
          firstLine.push({ cat:catLabels[cat], name:items[1].name, evidence:items[1].evidence });
        }
      }
    });

    // Red flags — derive from circuit patterns
    var redFlags = [];
    var circuitNodes = {};
    circuits.forEach(function(c) { circuitNodes[c.node] = c; });
    var hasHyper = circuits.some(function(c) { return (c.dir || '').toLowerCase().indexOf('hyper') !== -1; });
    var hasHypo = circuits.some(function(c) { return (c.dir || '').toLowerCase().indexOf('hypo') !== -1; });
    var name = (dx.name || '').toLowerCase();

    if (hasHyper && hasHypo) redFlags.push('Mixed hyper/hypo circuit activation \u2014 assess system-wide stress cascade');
    if (circuits.length >= 5) redFlags.push('High circuit involvement (' + circuits.length + '+ nodes) \u2014 systemic issue requiring coordinated response');
    if (name.indexOf('drought') !== -1 || name.indexOf('water') !== -1) redFlags.push('Water crisis \u2014 immediate assessment of irrigation and livestock water supply');
    if (name.indexOf('cash') !== -1 || name.indexOf('financial') !== -1) redFlags.push('Financial stress \u2014 assess loan covenant status and operating line availability');
    if (name.indexOf('pest') !== -1 || name.indexOf('disease') !== -1) redFlags.push('Biological threat \u2014 scout all fields immediately, contact extension');
    if (name.indexOf('supply') !== -1 || name.indexOf('chain') !== -1) redFlags.push('Supply chain disruption \u2014 identify alternate suppliers and transport routes');
    if (redFlags.length === 0) redFlags.push('Standard operational monitoring at each assessment point');

    // When to escalate
    var referrals = [];
    if (name.indexOf('drought') !== -1) referrals.push('Water management specialist if aquifer levels critical');
    if (name.indexOf('pest') !== -1 || name.indexOf('disease') !== -1) referrals.push('Extension entomologist / plant pathologist for identification and threshold analysis');
    if (name.indexOf('cash') !== -1 || name.indexOf('market') !== -1 || name.indexOf('financial') !== -1) referrals.push('Agricultural lender or farm financial advisor');
    if (name.indexOf('equipment') !== -1) referrals.push('Equipment dealer service team for critical-path repairs');
    if (name.indexOf('supply') !== -1) referrals.push('Logistics coordinator and alternate supplier network');
    if (referrals.length === 0) referrals.push('Specialist consultation if interventions show inadequate response after implementation');

    // Total intervention count
    var totalInt = 0;
    cats.forEach(function(cat) { totalInt += (dx.interventions[cat] || []).length; });

    // Build HTML
    var h = '<div class="snap-card">';
    h += '<div class="snap-header">';
    h += '<div class="snap-title">' + (isSimple ? '\uD83D\uDCCB ISSUE SUMMARY' : '\u26A1 RAPID ASSESSMENT SNAPSHOT') + '</div>';
    h += '<div class="snap-badge">Evidence-Tiered \u00b7 Version Controlled</div>';
    h += '</div>';

    // Core Circuit Dysregulation
    h += '<div class="snap-section"><div class="snap-section-title">' + (isSimple ? 'AREAS AFFECTED' : 'CORE CIRCUIT DYSREGULATION') + '</div>';
    circuits.forEach(function(c) {
      var dirLabel = c.dir || 'dysreg';
      var dirLower = dirLabel.toLowerCase();
      var dirClass = (dirLower.indexOf('hyper') !== -1) ? 'hyper' : (dirLower.indexOf('hypo') !== -1) ? 'hypo' : 'dysreg';
      var node = findNodeById(c.node);
      var nodeName = (node && node.domainLabel) ? node.domainLabel : (c.displayName || c.node);
      h += '<div class="snap-circuit">';
      h += '<span class="snap-node">' + escHtml(nodeName) + '</span>';
      h += '<span class="snap-dir ' + dirClass + '">' + escHtml(dirLabel).toUpperCase() + '</span>';
      h += '<span class="snap-detail">' + escHtml(c.detail) + '</span>';
      h += '</div>';
    });
    h += '</div>';

    // First-Line Interventions
    h += '<div class="snap-section"><div class="snap-section-title">' + (isSimple ? 'RECOMMENDED ACTIONS' : 'FIRST-LINE INTERVENTIONS (RANKED BY EVIDENCE)') + '</div>';
    if (firstLine.length === 0) {
      h += '<div style="font-size:0.5rem;color:var(--text-ghost);padding:4px 0">See tabs below for all ' + totalInt + ' documented interventions</div>';
    }
    firstLine.forEach(function(f) {
      var ev = (f.evidence || '').charAt(0);
      var evClass = (ev === 'A' || f.evidence === 'Strong') ? 'ev-A' : (ev === 'B' || f.evidence === 'Moderate') ? 'ev-B' : 'ev-C';
      h += '<div class="snap-int">';
      h += '<span class="snap-int-name"><span style="color:var(--text-ghost);font-size:0.4rem;margin-right:6px">' + f.cat + '</span>' + escHtml(f.name) + '</span>';
      h += '<span class="snap-int-ev ' + evClass + '">' + escHtml(f.evidence) + '</span>';
      h += '</div>';
    });
    h += '<div style="font-size:0.4rem;color:var(--text-ghost);margin-top:4px;letter-spacing:1px">' + totalInt + ' total interventions across 5 categories \u2014 see tabs below</div>';
    h += '</div>';

    // Red Flags
    h += '<div class="snap-section"><div class="snap-section-title">' + (isSimple ? 'CRITICAL ALERTS' : 'RED FLAGS') + '</div>';
    redFlags.forEach(function(f) {
      h += '<div class="snap-flags">\u26A0 ' + escHtml(f) + '</div>';
    });
    h += '</div>';

    // When to Escalate
    h += '<div class="snap-section"><div class="snap-section-title">' + (isSimple ? 'WHEN TO SEEK HELP' : 'WHEN TO ESCALATE') + '</div>';
    referrals.forEach(function(r) {
      h += '<div class="snap-refer">\u2192 ' + escHtml(r) + '</div>';
    });
    h += '</div>';

    // Quick action hint
    h += '<div style="margin-top:10px;font-size:0.38rem;color:#c9a94e;letter-spacing:1.5px;text-align:center;cursor:pointer" onclick="switchWorkflow(\'actions\')">\uD83D\uDCC4 REPORT \u00b7 COPY \u00b7 PRINT \u2192 ACTIONS TAB</div>';

    h += '</div>';
    // Safety layer: sanitize snapshot HTML text content
    if (window.LIMENResponseSafety) h = window.LIMENResponseSafety.sanitize(h, 'portal_snapshot');
    return h;
  }

  // ═══ INTERVENTION LIST RENDERER (from clinical.html renderInterventionList) ═══
  function renderInterventionList(dx, cat) {
    var items = dx.interventions[cat] || [];
    if (items.length === 0) {
      return '<div style="padding:20px 16px;color:var(--text-ghost);font-size:0.6rem;letter-spacing:1.5px;text-align:center">NO ' + cat.toUpperCase() + ' INTERVENTIONS DOCUMENTED</div>';
    }

    var html = '';
    items.forEach(function(item, i) {
      var ev = (item.evidence || 'C').charAt(0);
      var evClass = 'ev-' + ((ev === 'S' || ev === 'A') ? 'A' : (ev === 'M' || ev === 'B') ? 'B' : 'C');
      var targets = item.target ? item.target.join(' \u2192 ') : '';

      html += '<div class="int-item" onclick="toggleIntItem(this)">';
      var pktKey = cat + '_' + i;
      var pktChecked = packetSelections[pktKey] ? ' checked' : '';
      html += '<div class="int-name"><span><label class="pkt-check" onclick="event.stopPropagation()"><input type="checkbox" class="pkt-cb" data-cat="' + cat + '" data-idx="' + i + '"' + pktChecked + ' onchange="savePktSelection(this);updatePacketCount()"><span class="pkt-mark"></span></label>' + escHtml(item.name) + '</span><span class="int-evidence-badge ' + evClass + '">' + escHtml(item.evidence || 'C') + '</span></div>';
      if (targets) html += '<div class="int-targets">TARGET: ' + escHtml(targets) + '</div>';
      html += '<div class="int-detail">';
      html += '<div class="int-mechanism">' + escHtml(item.mechanism) + '</div>';
      if (item.cite) html += '<div class="int-cite">' + escHtml(item.cite) + '</div>';
      html += '</div>';
      html += '</div>';
    });
    return html;
  }

  // ═══ TAB SWITCHING (from clinical.html switchTab) ═══
  function switchTab(cat) {
    activeTab = cat;
    document.querySelectorAll('.int-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-cat') === cat);
    });
    if (currentDx) {
      document.getElementById('intList').innerHTML = renderInterventionList(currentDx, cat);
    }
    updatePacketCount();
  }

  // ═══ WORKFLOW TAB SWITCHING (from clinical.html switchWorkflow) ═══
  function switchWorkflow(panel) {
    activeWorkflow = panel;
    document.querySelectorAll('.wf-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-wf') === panel);
    });
    document.querySelectorAll('.wf-panel').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById('wf' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (target) target.classList.add('active');
  }

  // ═══ SEVERITY AUTO-FILTER (from clinical.html updateSeverity) ═══
  function updateSeverity() {
    var phqEl = document.getElementById('phq9Input');
    var gadEl = document.getElementById('gad7Input');
    var phq = phqEl ? (parseInt(phqEl.value) || 0) : 0;
    var gad = gadEl ? (parseInt(gadEl.value) || 0) : 0;
    var score = Math.max(phq, gad);
    var badge = document.getElementById('sevBadge');
    if (!badge) return;

    if (score === 0) {
      currentSeverity = 'none';
      badge.className = 'sev-badge sev-none';
      badge.textContent = 'NO SCORE';
    } else if (score <= 4) {
      currentSeverity = 'minimal';
      badge.className = 'sev-badge sev-mild';
      badge.textContent = 'MINIMAL';
    } else if (score <= 9) {
      currentSeverity = 'mild';
      badge.className = 'sev-badge sev-mild';
      badge.textContent = 'MILD';
    } else if (score <= 14) {
      currentSeverity = 'moderate';
      badge.className = 'sev-badge sev-moderate';
      badge.textContent = 'MODERATE';
    } else if (score <= 19) {
      currentSeverity = 'moderately severe';
      badge.className = 'sev-badge sev-moderate';
      badge.textContent = 'MOD-SEVERE';
    } else {
      currentSeverity = 'severe';
      badge.className = 'sev-badge sev-severe';
      badge.textContent = 'SEVERE';
    }

    // Re-render interventions with severity filter emphasis
    if (currentDx) {
      var intList = document.getElementById('intList');
      if (intList) intList.innerHTML = renderInterventionList(currentDx, activeTab);
    }
  }

  // ═══ LANGUAGE TOGGLE (from clinical.html setLang) ═══
  function setLang(mode) {
    langMode = mode;
    var expertBtn = document.getElementById('langClinical');
    var summaryBtn = document.getElementById('langPatient');
    if (expertBtn) expertBtn.classList.toggle('active', mode === 'expert');
    if (summaryBtn) summaryBtn.classList.toggle('active', mode === 'summary');
    // Rebuild snapshot with new language
    if (currentDx) {
      var snapPanel = document.getElementById('wfSnapshot');
      if (snapPanel) snapPanel.innerHTML = generateSnapshot(currentDx);
    }
  }

  // ═══ DIFFERENTIAL COMPARISON (from clinical.html generateDifferential) ═══
  function generateDifferential(dx) {
    if (!DATA || !DATA.issues || DATA.issues.length < 2) return '';

    // Find current issue
    var currentCircuits = {};
    (dx.circuits || []).forEach(function(c) { currentCircuits[c.node] = c; });

    // Compare with other issues in the same domain
    var others = [];
    for (var i = 0; i < DATA.issues.length; i++) {
      var otherIssue = DATA.issues[i];
      if (otherIssue.id === activeIssueId) continue;
      others.push(otherIssue);
    }

    if (others.length === 0) return '';

    var h = '<div class="diff-card">';
    h += '<div class="diff-header">DIFFERENTIAL \u2014 CIRCUIT OVERLAP</div>';

    others.forEach(function(otherIssue) {
      var otherCircuits = {};
      (otherIssue.circuits || []).forEach(function(c) { otherCircuits[c.nodeId] = c; });

      var shared = [], uniqueCurrent = [], uniqueOther = [];
      for (var node in currentCircuits) {
        if (otherCircuits[node]) shared.push(node);
        else uniqueCurrent.push(node);
      }
      for (var node in otherCircuits) {
        if (!currentCircuits[node]) uniqueOther.push(node);
      }

      var maxLen = Math.max(Object.keys(currentCircuits).length, Object.keys(otherCircuits).length);
      var overlap = maxLen > 0 ? Math.round(shared.length / maxLen * 100) : 0;

      h += '<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(200,195,184,0.06)">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      h += '<span style="font-size:0.5rem;color:var(--text)">' + escHtml(otherIssue.label) + '</span>';
      h += '<span style="font-size:0.38rem;letter-spacing:1.5px;color:' + (overlap > 70 ? '#c94040' : overlap > 40 ? 'var(--gold-dim)' : '#6aaa6a') + '">' + overlap + '% OVERLAP</span>';
      h += '</div>';

      if (shared.length) {
        h += '<div style="font-size:0.38rem;color:var(--text-ghost);letter-spacing:1px;margin-bottom:3px">SHARED CIRCUITS:</div>';
        h += '<div class="diff-tags">';
        shared.forEach(function(n) {
          var node = findNodeById(n);
          var label = (node && node.domainLabel) ? node.domainLabel : n;
          h += '<span class="diff-tag shared">' + escHtml(label) + '</span>';
        });
        h += '</div>';
      }
      if (uniqueCurrent.length) {
        h += '<div style="font-size:0.38rem;color:var(--text-ghost);letter-spacing:1px;margin:4px 0 3px">UNIQUE TO ' + escHtml(dx.name).toUpperCase() + ':</div>';
        h += '<div class="diff-tags">';
        uniqueCurrent.forEach(function(n) {
          var node = findNodeById(n);
          var label = (node && node.domainLabel) ? node.domainLabel : n;
          h += '<span class="diff-tag unique">' + escHtml(label) + '</span>';
        });
        h += '</div>';
      }
      h += '</div>';
    });

    h += '</div>';
    return h;
  }

  // ═══ REFERENCE CODE HINTS (from clinical.html generateCPTHints — adapted for agriculture) ═══
  function generateCPTHints(dx) {
    var h = '<div class="cpt-card">';
    h += '<div style="font-size:0.42rem;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold-dim);margin-bottom:8px">REFERENCE STANDARDS</div>';

    var codes = [
      {code:'NAICS 111', desc:'Crop Production'},
      {code:'NAICS 112', desc:'Animal Production and Aquaculture'},
      {code:'NAICS 115', desc:'Support Activities for Agriculture'},
      {code:'NRCS 590', desc:'Nutrient Management Standard'},
      {code:'NRCS 328', desc:'Conservation Crop Rotation'},
      {code:'NRCS 449', desc:'Irrigation Water Management'},
      {code:'GAP', desc:'Good Agricultural Practices Certification'},
      {code:'FSMA', desc:'Food Safety Modernization Act Compliance'}
    ];

    var n = (dx.name || '').toLowerCase();
    if (n.indexOf('pest') !== -1 || n.indexOf('disease') !== -1) {
      codes.push({code:'IPM', desc:'Integrated Pest Management Protocol'});
    }
    if (n.indexOf('drought') !== -1 || n.indexOf('water') !== -1) {
      codes.push({code:'NRCS 442', desc:'Sprinkler System Standard'});
      codes.push({code:'NRCS 441', desc:'Irrigation System — Microirrigation'});
    }
    if (n.indexOf('soil') !== -1) {
      codes.push({code:'NRCS 340', desc:'Cover Crop Standard'});
    }

    codes.forEach(function(c) {
      h += '<div class="cpt-row"><span class="cpt-code">' + escHtml(c.code) + '</span><span class="cpt-desc">' + escHtml(c.desc) + '</span></div>';
    });

    h += '<div class="cpt-note">Reference standards for guidance only \u2014 verify against current USDA-NRCS and state-level requirements.</div>';
    h += '</div>';
    return h;
  }

  // ═══ TOGGLE INTERVENTION ITEM (from clinical.html toggleIntItem) ═══
  function toggleIntItem(el) {
    el.classList.toggle('expanded');
  }

  // ═══ PACKET SELECTION (from clinical.html savePktSelection) ═══
  function savePktSelection(cb) {
    var key = cb.getAttribute('data-cat') + '_' + cb.getAttribute('data-idx');
    if (cb.checked) packetSelections[key] = true;
    else delete packetSelections[key];
  }

  // ═══ PACKET COUNT (from clinical.html updatePacketCount) ═══
  function updatePacketCount() {
    var n = Object.keys(packetSelections).length;
    var countEl = document.getElementById('packetCount');
    var btnEl = document.getElementById('packetBtn');
    if (countEl) countEl.textContent = n + ' SELECTED';
    if (btnEl) {
      btnEl.disabled = n === 0;
      btnEl.style.opacity = n > 0 ? '1' : '0.4';
      btnEl.style.pointerEvents = n > 0 ? 'auto' : 'none';
    }
    // Update action tab packet button too
    var actionCount = document.getElementById('actionPacketCount');
    if (actionCount) {
      actionCount.textContent = n > 0 ? (n + ' selected \u2014 ready to build') : 'Select interventions in Treat tab';
    }
  }

  // ═══ GET SELECTED INTERVENTIONS (from clinical.html getSelectedInterventions) ═══
  function getSelectedInterventions() {
    if (!currentDx) return [];
    var items = [];
    Object.keys(packetSelections).forEach(function(key) {
      var parts = key.split('_');
      var cat = parts[0];
      var idx = parseInt(parts[1]);
      if (currentDx.interventions && currentDx.interventions[cat] && currentDx.interventions[cat][idx]) {
        items.push({ cat: cat, item: currentDx.interventions[cat][idx] });
      }
    });
    return items;
  }

  // ═══ REPORT GENERATOR (from clinical.html generateSOAP — adapted) ═══
  function generateSOAP() {
    if (!currentDx) return;
    var dx = currentDx;
    var items = getSelectedInterventions();
    var date = new Date().toLocaleDateString();
    var dxName = dx.name;

    var circuits = (dx.circuits || []).slice().sort(function(a,b) {
      var order = {'Strong':0,'A':0,'A-':1,'B+':2,'Moderate':3,'B':3,'B-':4,'C+':5,'C':6,'Limited':6};
      return (order[a.evidence]||9) - (order[b.evidence]||9);
    }).slice(0, 5);

    var cats = ['strategy','coaching','structural','culture','tools'];
    var catLabels = {strategy:'Strategy',coaching:'Coaching',structural:'Structural/Infrastructure',culture:'Culture/Community',tools:'Tools/Technology'};

    var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Assessment Report \u2014 ' + dxName + '</title>';
    h += '<style>';
    h += 'body{font-family:"Courier New",monospace;max-width:700px;margin:40px auto;padding:20px;color:#222;line-height:1.6;font-size:13px}';
    h += 'h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:4px;font-family:Georgia,serif}';
    h += 'h2{font-size:13px;color:#333;margin-top:20px;margin-bottom:6px;text-transform:uppercase;letter-spacing:2px;border-bottom:1px solid #999;padding-bottom:3px}';
    h += '.field{margin:2px 0} .label{font-weight:bold}';
    h += '.writein{border-bottom:1px solid #999;display:inline-block;min-width:200px;height:16px;margin-left:4px}';
    h += '.disclaimer{margin-top:30px;padding-top:12px;border-top:2px solid #333;font-size:9px;color:#999}';
    h += '@media print{body{margin:20px}}';
    h += '</style></head><body>';

    h += '<h1>Issue Assessment Report</h1>';
    h += '<div class="field"><span class="label">Date:</span> ' + date + '</div>';
    h += '<div class="field"><span class="label">Operation:</span> <span class="writein"></span></div>';
    h += '<div class="field"><span class="label">Assessor:</span> <span class="writein"></span></div>';
    h += '<div class="field"><span class="label">Issue:</span> ' + escHtml(dxName) + '</div>';

    // SITUATION
    h += '<h2>Situation</h2>';
    h += '<div class="field">Operation experiencing ' + escHtml(dxName) + '.</div>';
    h += '<div class="field"><span class="label">Summary:</span> ' + escHtml(dx.summary) + '</div>';
    h += '<div class="field"><span class="label">Severity:</span> <span class="writein"></span></div>';
    h += '<div class="field"><span class="label">Duration:</span> <span class="writein"></span></div>';

    // ASSESSMENT — circuit rationale
    h += '<h2>Assessment</h2>';
    h += '<div class="field"><span class="label">Issue:</span> ' + escHtml(dxName) + '</div>';
    h += '<div class="field" style="margin-top:6px"><span class="label">Circuit Rationale (LIMEN Helix Neural Map):</span></div>';
    circuits.forEach(function(c) {
      var node = findNodeById(c.node);
      var nodeName = (node && node.domainLabel) ? node.domainLabel : (c.displayName || c.node);
      h += '<div class="field" style="margin-left:20px">\u2022 ' + escHtml(nodeName) + ' (' + escHtml(c.dir || 'dysreg') + '): ' + escHtml(c.detail) + ' [Evidence: ' + escHtml(c.evidence) + ']</div>';
    });

    // PLAN — selected interventions or first-line
    h += '<h2>Intervention Plan</h2>';
    if (items.length > 0) {
      items.forEach(function(sel) {
        h += '<div class="field">\u2022 [' + catLabels[sel.cat] + '] ' + escHtml(sel.item.name) + ' (Evidence: ' + escHtml(sel.item.evidence) + ')</div>';
      });
    } else {
      cats.forEach(function(cat) {
        var its = (dx.interventions[cat] || []).slice().sort(function(a,b) {
          var order = {'Strong':0,'A':0,'A-':1,'B+':2,'Moderate':3,'B':3,'B-':4,'C+':5,'C':6,'Limited':6};
          return (order[a.evidence]||9) - (order[b.evidence]||9);
        });
        if (its.length > 0 && its[0].evidence) {
          var ev = its[0].evidence;
          if (ev === 'Strong' || ev === 'Moderate' || ev === 'A' || ev === 'B+' || ev === 'A-' || ev === 'B') {
            h += '<div class="field">\u2022 [' + catLabels[cat] + '] ' + escHtml(its[0].name) + ' (Evidence: ' + escHtml(its[0].evidence) + ')</div>';
          }
        }
      });
      h += '<div class="field" style="font-size:11px;color:#888;margin-top:4px">(Auto-populated with first-line interventions. Select specific interventions in the portal for customized plan.)</div>';
    }

    h += '<div class="field" style="margin-top:8px"><span class="label">Follow-up:</span> <span class="writein"></span></div>';
    h += '<div class="field"><span class="label">Note:</span> Evidence levels reflect published research. Individual conditions vary. Decisions should be made with local expertise.</div>';

    h += '<div class="disclaimer">';
    h += 'Template generated by LIMEN Helix Portal \u00b7 Evidence-tiered \u00b7 Version controlled<br>';
    h += 'This template is for reference assistance only and does not constitute professional advice.<br>';
    h += 'LIMEN HELIX TRANSFORMATIONAL SCIENCES LLC \u00b7 ' + date;
    h += '</div></body></html>';

    var w = window.open('', '_blank');
    w.document.write(h);
    w.document.close();
    w.focus();
    setTimeout(function() { w.print(); }, 600);
  }

  // ═══ CLIPBOARD COPY (from clinical.html copyToEMR — adapted) ═══
  function copyToEMR() {
    if (!currentDx) return;
    var dx = currentDx;
    var items = getSelectedInterventions();
    var date = new Date().toLocaleDateString();
    var dxName = dx.name;

    var circuits = (dx.circuits || []).slice().sort(function(a,b) {
      var order = {'Strong':0,'A':0,'A-':1,'B+':2,'Moderate':3,'B':3,'B-':4,'C+':5,'C':6,'Limited':6};
      return (order[a.evidence]||9) - (order[b.evidence]||9);
    }).slice(0, 6);

    var cats = ['strategy','coaching','structural','culture','tools'];
    var catLabels = {strategy:'Strategy',coaching:'Coaching',structural:'Structural/Infrastructure',culture:'Culture/Community',tools:'Tools/Technology'};

    var t = '';
    t += '=== ISSUE ASSESSMENT ===\n';
    t += 'Date: ' + date + '\n';
    t += 'Issue: ' + dxName + '\n\n';

    t += 'SITUATION:\n';
    t += dxName + '\n';
    t += 'Summary: ' + dx.summary + '\n\n';

    t += 'ASSESSMENT:\n';
    t += 'Circuit Rationale:\n';
    circuits.forEach(function(c) {
      var node = findNodeById(c.node);
      var nodeName = (node && node.domainLabel) ? node.domainLabel : (c.displayName || c.node);
      t += '  - ' + nodeName + ' (' + (c.dir || 'dysreg').toUpperCase() + '): ' + c.detail + ' [' + c.evidence + ']\n';
    });
    t += '\n';

    t += 'INTERVENTION PLAN:\n';
    if (items.length > 0) {
      items.forEach(function(sel) {
        t += '  - [' + catLabels[sel.cat] + '] ' + sel.item.name + ' (Evidence: ' + sel.item.evidence + ')\n';
        if (sel.item.mechanism) t += '    Rationale: ' + sel.item.mechanism + '\n';
      });
    } else {
      cats.forEach(function(cat) {
        var its = (dx.interventions[cat] || []).slice().sort(function(a,b) {
          var order = {'Strong':0,'A':0,'A-':1,'B+':2,'Moderate':3,'B':3,'B-':4,'C+':5,'C':6,'Limited':6};
          return (order[a.evidence]||9) - (order[b.evidence]||9);
        });
        if (its.length > 0 && its[0].evidence) {
          var ev = its[0].evidence;
          if (ev === 'Strong' || ev === 'Moderate' || ev === 'A' || ev === 'B+' || ev === 'A-' || ev === 'B') {
            t += '  - [' + catLabels[cat] + '] ' + its[0].name + ' (Evidence: ' + its[0].evidence + ')\n';
          }
        }
      });
      t += '  (First-line interventions auto-populated)\n';
    }

    // Red flags
    t += '\nALERTS:\n';
    var nm = (dx.name || '').toLowerCase();
    var hasHyper = circuits.some(function(c) { return (c.dir||'').toLowerCase().indexOf('hyper') !== -1; });
    var hasHypo = circuits.some(function(c) { return (c.dir||'').toLowerCase().indexOf('hypo') !== -1; });
    var flags = [];
    if (hasHyper && hasHypo) flags.push('Mixed hyper/hypo circuit activation - systemic stress cascade');
    if (circuits.length >= 5) flags.push('High circuit involvement - coordinated response needed');
    if (nm.indexOf('drought') !== -1) flags.push('Water crisis - assess irrigation and livestock supply');
    if (nm.indexOf('cash') !== -1) flags.push('Financial stress - assess loan status and operating line');
    if (nm.indexOf('pest') !== -1) flags.push('Biological threat - scout all fields, contact extension');
    if (flags.length === 0) flags.push('Standard operational monitoring');
    flags.forEach(function(f) { t += '  ! ' + f + '\n'; });

    t += '\nFollow-up: \n';
    t += '\n---\n';
    t += 'Intervention lists reflect domain-level findings. Local expertise required.\n';
    t += 'Generated by LIMEN Helix Portal | Evidence-tiered | ' + date + '\n';

    navigator.clipboard.writeText(t).then(function() {
      // Brief visual feedback (find the copy button)
      var btns = document.querySelectorAll('[onclick="copyToEMR()"]');
      if (btns.length > 0) {
        var btn = btns[0];
        var orig = btn.innerHTML;
        btn.innerHTML = '<span style="margin-right:10px">\u2713</span>COPIED TO CLIPBOARD';
        btn.style.borderColor = 'rgba(106,170,106,0.5)';
        btn.style.color = '#6aaa6a';
        setTimeout(function() {
          btn.innerHTML = orig;
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 2000);
      }
    }).catch(function() {
      // Fallback: select from textarea
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  // ═══ PRINT SNAPSHOT (from clinical.html printSnapshot — adapted) ═══
  function printSnapshot() {
    if (!currentDx) return;
    var dx = currentDx;
    var date = new Date().toLocaleDateString();
    var dxName = dx.name;

    var circuits = (dx.circuits || []).slice().sort(function(a,b) {
      var order = {'Strong':0,'A':0,'A-':1,'B+':2,'Moderate':3,'B':3,'B-':4,'C+':5,'C':6,'Limited':6};
      return (order[a.evidence]||9) - (order[b.evidence]||9);
    }).slice(0, 6);

    var cats = ['strategy','coaching','structural','culture','tools'];
    var catLabels = {strategy:'Strategy',coaching:'Coaching',structural:'Structural',culture:'Culture',tools:'Tools'};
    var firstLine = [];
    cats.forEach(function(cat) {
      var items = (dx.interventions[cat] || []).slice().sort(function(a,b) {
        var order = {'Strong':0,'A':0,'A-':1,'B+':2,'Moderate':3,'B':3,'B-':4,'C+':5,'C':6,'Limited':6};
        return (order[a.evidence]||9) - (order[b.evidence]||9);
      });
      for (var i=0; i < Math.min(2, items.length); i++) {
        if (items[i].evidence) {
          var ev = items[i].evidence;
          if (ev === 'Strong' || ev === 'Moderate' || ev === 'A' || ev === 'B+' || ev === 'A-' || ev === 'B') {
            firstLine.push({ cat:catLabels[cat], name:items[i].name, evidence:items[i].evidence, mechanism:items[i].mechanism, target:(items[i].target||[]).join(', '), cite:items[i].cite });
          }
        }
      }
    });

    var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Assessment Snapshot \u2014 ' + dxName + '</title>';
    h += '<style>';
    h += 'body{font-family:Georgia,serif;max-width:700px;margin:30px auto;padding:20px;color:#222;line-height:1.5}';
    h += 'h1{font-size:22px;border-bottom:2px solid #2e7d32;padding-bottom:6px;margin-bottom:2px}';
    h += '.sub{font-size:12px;color:#666;margin-bottom:12px}';
    h += 'h2{font-size:12px;color:#333;text-transform:uppercase;letter-spacing:2px;margin-top:16px;margin-bottom:6px;border-bottom:1px solid #ccc;padding-bottom:3px}';
    h += '.circuit{margin:3px 0;font-size:12px} .node{font-weight:bold;display:inline-block;min-width:60px}';
    h += '.dir{font-size:10px;padding:1px 4px;border-radius:2px;margin-right:4px}';
    h += '.dir.hyper{color:#c00;background:#fee} .dir.hypo{color:#06c;background:#eef} .dir.dysreg{color:#960;background:#ffd}';
    h += '.int{margin:8px 0;font-size:12px;padding:6px 10px;border-left:3px solid #2e7d32;background:#f9fdf9}';
    h += '.int-header{margin-bottom:3px}';
    h += '.ev-badge{display:inline-block;font-size:10px;font-weight:bold;padding:1px 5px;border-radius:3px;background:#2e7d32;color:#fff;margin-left:4px}';
    h += '.int-mech{font-size:11px;color:#444;margin:3px 0;line-height:1.4}';
    h += '.int-target{font-size:11px;color:#555;margin:2px 0}';
    h += '.int-cite{font-size:10px;color:#888;font-style:italic;margin:2px 0}';
    h += '.flag{margin:3px 0;padding:4px 10px;font-size:12px;border-left:3px solid #c00;background:#fff5f5}';
    h += '.refer{margin:3px 0;padding:4px 10px;font-size:12px;border-left:3px solid #06c;background:#f5f8ff}';
    h += '.footer{margin-top:20px;border-top:2px solid #2e7d32;padding-top:10px;font-size:9px;color:#999}';
    h += '@media print{body{margin:15px}}';
    h += '</style></head><body>';

    h += '<h1>Rapid Assessment Snapshot</h1>';
    h += '<div class="sub">' + escHtml(dxName) + ' \u00b7 ' + date + '</div>';
    h += '<p style="font-size:12px">' + escHtml(dx.summary) + '</p>';

    h += '<h2>Core Circuit Dysregulation</h2>';
    circuits.forEach(function(c) {
      var dirLower = (c.dir || 'dysreg').toLowerCase();
      var dc = dirLower.indexOf('hyper') !== -1 ? 'hyper' : dirLower.indexOf('hypo') !== -1 ? 'hypo' : 'dysreg';
      var node = findNodeById(c.node);
      var nodeName = (node && node.domainLabel) ? node.domainLabel : (c.displayName || c.node);
      h += '<div class="circuit"><span class="node">' + escHtml(nodeName) + '</span><span class="dir ' + dc + '">' + escHtml(c.dir || 'dysreg').toUpperCase() + '</span>' + escHtml(c.detail) + '</div>';
    });

    h += '<h2>First-Line Interventions</h2>';
    firstLine.forEach(function(f) {
      h += '<div class="int">';
      h += '<div class="int-header"><strong>' + escHtml(f.cat) + ':</strong> ' + escHtml(f.name) + ' <span class="ev-badge">' + escHtml(f.evidence) + '</span></div>';
      if (f.mechanism) h += '<div class="int-mech">' + escHtml(f.mechanism) + '</div>';
      if (f.target) h += '<div class="int-target"><strong>Pathway:</strong> ' + escHtml(f.target) + '</div>';
      if (f.cite) h += '<div class="int-cite">' + escHtml(f.cite) + '</div>';
      h += '</div>';
    });

    h += '<h2>Red Flags</h2>';
    var redFlags = [];
    var hasHyper = circuits.some(function(c) { return (c.dir||'').toLowerCase().indexOf('hyper') !== -1; });
    var hasHypo = circuits.some(function(c) { return (c.dir||'').toLowerCase().indexOf('hypo') !== -1; });
    var nm = (dx.name || '').toLowerCase();
    if (hasHyper && hasHypo) redFlags.push('Mixed hyper/hypo circuit activation \u2014 systemic stress cascade');
    if (nm.indexOf('drought') !== -1) redFlags.push('Water crisis \u2014 immediate irrigation and livestock assessment');
    if (nm.indexOf('cash') !== -1 || nm.indexOf('financial') !== -1) redFlags.push('Financial stress \u2014 assess loan covenant status');
    if (nm.indexOf('pest') !== -1 || nm.indexOf('disease') !== -1) redFlags.push('Biological threat \u2014 scout all fields, contact extension');
    if (nm.indexOf('equipment') !== -1) redFlags.push('Critical equipment down \u2014 assess repair timeline vs rental');
    if (redFlags.length === 0) redFlags.push('Standard operational monitoring at each assessment point');
    redFlags.forEach(function(f) { h += '<div class="flag">\u26A0 ' + escHtml(f) + '</div>'; });

    h += '<h2>When to Escalate</h2>';
    var referrals = [];
    if (nm.indexOf('drought') !== -1) referrals.push('Water management specialist');
    if (nm.indexOf('pest') !== -1) referrals.push('Extension entomologist / plant pathologist');
    if (nm.indexOf('cash') !== -1 || nm.indexOf('market') !== -1) referrals.push('Agricultural lender or farm financial advisor');
    if (nm.indexOf('equipment') !== -1) referrals.push('Equipment dealer service team');
    if (referrals.length === 0) referrals.push('Specialist referral if inadequate response after implementation');
    referrals.forEach(function(r) { h += '<div class="refer">\u2192 ' + escHtml(r) + '</div>'; });

    h += '<div class="footer">';
    h += 'Evidence-Tiered \u00b7 Version Controlled<br>';
    h += 'Assessment snapshot is for reference only and does not constitute professional advice.<br>';
    h += 'LIMEN HELIX TRANSFORMATIONAL SCIENCES LLC \u00b7 ' + date;
    h += '</div></body></html>';

    var w = window.open('', '_blank');
    w.document.write(h);
    w.document.close();
    w.focus();
    setTimeout(function() { w.print(); }, 600);
  }

  // ═══ REPORT BUILDER (from clinical.html printPatientPacket — adapted) ═══
  function printPatientPacket() {
    if (!currentDx) return;
    var dx = currentDx;
    var items = getSelectedInterventions();
    if (items.length === 0) return;

    var dxName = dx.name;
    var date = new Date().toLocaleDateString();
    var catLabels = {strategy:'Strategy',coaching:'Coaching',structural:'Structural/Infrastructure',culture:'Culture/Community',tools:'Tools/Technology'};

    var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Intervention Report \u2014 ' + escHtml(dxName) + '</title>';
    h += '<style>';
    h += 'body{font-family:Georgia,serif;max-width:700px;margin:0 auto;padding:20px;color:#222;line-height:1.6}';
    h += 'h1{font-size:22px;border-bottom:2px solid #2e7d32;padding-bottom:8px;margin-bottom:4px}';
    h += 'h2{font-size:14px;color:#555;margin-top:24px;margin-bottom:8px;text-transform:uppercase;letter-spacing:2px;border-bottom:1px solid #ccc;padding-bottom:4px}';
    h += 'h3{font-size:18px;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:4px;margin-top:0}';
    h += 'p,li{font-size:13px;margin:4px 0}';
    h += 'ul{padding-left:20px}';
    h += '.cover{text-align:center;padding:60px 20px;page-break-after:always}';
    h += '.cover h1{font-size:28px;border:none;margin-bottom:20px}';
    h += '.cover .dx{font-size:20px;color:#2e7d32;margin:20px 0}';
    h += '.cover .meta{font-size:13px;color:#666;margin:8px 0}';
    h += '.cover .items{margin:30px 0;text-align:left;max-width:400px;margin-left:auto;margin-right:auto}';
    h += '.cover .items li{font-size:13px;margin:4px 0}';
    h += '.cover .disclaimer{font-size:10px;color:#999;margin-top:40px;border-top:1px solid #ddd;padding-top:16px}';
    h += '.cover .writein{border-bottom:1px solid #999;display:inline-block;min-width:250px;height:18px;margin-left:8px}';
    h += '.monograph{page-break-before:always}';
    h += '.mono-cat{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#2e7d32;margin-bottom:4px}';
    h += '.section{margin:12px 0;padding:8px 0;border-bottom:1px solid #eee}';
    h += '.section-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#2e7d32;font-weight:bold;margin-bottom:4px}';
    h += '.pathway{font-size:13px;color:#333;letter-spacing:0.5px;padding:4px 0}';
    h += '.footer{margin-top:20px;padding-top:10px;border-top:1px solid #ccc;font-size:9px;color:#aaa;text-align:center}';
    h += '@media print{body{margin:10px}.cover{padding:40px 20px}}';
    h += '</style></head><body>';

    // ═══ COVER SHEET ═══
    h += '<div class="cover">';
    h += '<h1>Intervention Report</h1>';
    h += '<div class="dx">' + escHtml(dxName) + '</div>';
    h += '<div class="meta">Date: ' + date + '</div>';
    h += '<div class="meta">Operation: <span class="writein"></span></div>';
    h += '<div class="meta">Assessor: <span class="writein"></span></div>';
    h += '<div class="meta" style="margin-top:20px">' + items.length + ' intervention' + (items.length > 1 ? 's' : '') + ' included:</div>';
    h += '<div class="items"><ol>';
    items.forEach(function(sel) {
      h += '<li><strong>' + escHtml(sel.item.name) + '</strong> <span style="color:#888">(' + catLabels[sel.cat] + ')</span></li>';
    });
    h += '</ol></div>';
    h += '<div class="disclaimer">';
    h += 'This report is for informational purposes only and does not constitute professional advice.<br>';
    h += 'Decisions should be made collaboratively with domain experts.<br>';
    h += 'Evidence levels reflect published research as of the date generated and may change.<br><br>';
    h += 'LIMEN HELIX TRANSFORMATIONAL SCIENCES LLC';
    h += '</div></div>';

    // ═══ INDIVIDUAL INTERVENTION DETAILS ═══
    items.forEach(function(sel) {
      var cat = sel.cat;
      var name = sel.item.name;

      h += '<div class="monograph">';
      h += '<div class="mono-cat">' + catLabels[cat] + '</div>';
      h += '<h3>' + escHtml(name) + '</h3>';

      h += '<div class="section"><span class="section-label">Evidence Level</span>';
      h += '<p>' + escHtml(sel.item.evidence || 'N/A') + '</p></div>';

      h += '<div class="section"><span class="section-label">Mechanism</span>';
      h += '<p>' + escHtml(sel.item.mechanism || 'See specialist for details.') + '</p></div>';

      if (sel.item.target && sel.item.target.length > 0) {
        var chain = sel.item.target.join(', ');
        var steps = chain.split('->').map(function(s) { return s.trim(); });
        h += '<div class="section"><span class="section-label">Target Pathway</span>';
        h += '<div class="pathway">' + steps.map(function(s) { return escHtml(s); }).join(' \u2192 ') + '</div></div>';
      }

      h += '<div class="section"><span class="section-label">Citation</span>';
      h += '<p>' + (sel.item.cite ? escHtml(sel.item.cite) : '<em>[CITATION NEEDED]</em>') + '</p></div>';

      h += '<div class="section"><span class="section-label">Monitoring</span>';
      h += '<p>Reassess at regular intervals. Track target pathway metrics for response confirmation.</p></div>';

      h += '<div class="section"><span class="section-label">Escalation</span>';
      h += '<p>If insufficient response after implementation period, escalate to domain specialist.</p></div>';

      h += '<div class="footer">LIMEN HELIX TRANSFORMATIONAL SCIENCES LLC \u00b7 ' + date + '</div>';
      h += '</div>';
    });

    h += '</body></html>';

    var w = window.open('', '_blank');
    w.document.write(h);
    w.document.close();
    w.focus();
    setTimeout(function() { w.print(); }, 600);
  }

  // ═══ NODE LIST ═══
  // Authoritative source: Engine.getActivatedNodes() — returns only nodes
  // with activated===true from the domain JSON activations array.
  // Grouping source: node.domainGroup (set from activation.group in domain JSON).
  // Group ordering: config.groupOrder (from static HTML or portal-registry.json).
  function buildNodeList() {
    var activated = Engine.getActivatedNodes() || [];
    var container = document.getElementById('nodeList');
    if (!container || !config) return;

    var groups = {};
    var groupOrder = config.groupOrder || [];
    for (var i = 0; i < activated.length; i++) {
      var n = activated[i].node;
      var g = n.domainGroup || 'other';
      if (!groups[g]) groups[g] = [];
      groups[g].push({node: n, index: activated[i].index});
    }

    // Fallback: if no explicit groupOrder was provided (e.g., dynamic portal with
    // missing registry groups), derive ordering from the activated nodes' domainGroup values.
    // Labels are auto-generated from the group key.
    if (groupOrder.length === 0) {
      for (var g in groups) groupOrder.push({key: g, label: g.toUpperCase().replace(/_/g, ' ')});
    }

    var html = '';
    for (var gi = 0; gi < groupOrder.length; gi++) {
      var group = groupOrder[gi];
      var gNodes = groups[group.key];
      if (!gNodes || gNodes.length === 0) continue;
      html += '<div class="dx-category" data-group="' + escHtml(group.key) + '">';
      html += '<div class="dx-category-label" onclick="PortalUI.toggleCategory(this)">' + escHtml(group.label) + '<span class="collapse-icon">&#9662;</span></div>';
      html += '<div class="dx-items">';
      for (var j = 0; j < gNodes.length; j++) {
        var n = gNodes[j].node, idx = gNodes[j].index;
        html += '<div class="dx-item" data-idx="' + idx + '" onclick="PortalUI.selectNodeFromList(' + idx + ')">';
        html += '<span class="dx-name">' + escHtml(n.domainLabel || n.label) + '</span>';
        html += '<span class="dx-brain">' + escHtml(n.brainLabel || '') + '</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    container.innerHTML = html;

    // Compute stats
    var EDGES = getEdgesCompat();
    var domainEdgeCount = 0;
    for (var i = 0; i < EDGES.length; i++) { if (EDGES[i].isDomainEdge) domainEdgeCount++; }

    var nodeCount = document.getElementById('nodeCount');
    if (nodeCount) nodeCount.textContent = activated.length + ' ACTIVE NODES \u00b7 ' + domainEdgeCount + ' PATHWAYS';

    _updateBottomStrip();

    var dxStats = document.getElementById('dxStats');
    if (dxStats) dxStats.textContent = activated.length + ' active nodes \u00b7 ' + domainEdgeCount + ' pathways';
  }

  function selectNodeFromList(idx) {
    if (activeIssueId) {
      activeIssueId = null;
      currentDx = null;
      packetSelections = {};
      Engine.clearIssue();
      clearIssueHighlight();
    }
    Engine.select(idx);
    if (Engine.centerOn) Engine.centerOn(idx);
    highlightListItem(idx);
    showNodeDetail(getNodeArray()[idx], idx);
    var node = getNodeArray()[idx];
    _savePortalSelection(node ? node.id : null);
  }

  function highlightListItem(idx) {
    var items = document.querySelectorAll('.dx-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('active');
      if (parseInt(items[i].getAttribute('data-idx')) === idx) {
        items[i].classList.add('active');
        items[i].scrollIntoView({block: 'nearest', behavior: 'smooth'});
      }
    }
  }

  // ═══ TREATMENT RELEVANCE SCORING ═══
  // Scores a treatment against trigger token sets. Returns 0 if no match.
  // Used by showNodeDetail directives, Portal Report, Level Report.
  var _evOrder = {'Strong':0,'A':0,'A-':1,'B+':2,'Moderate':3,'B':3,'B-':4,'C+':5,'C':6,'Limited':6};

  function _normTokensShared(s) {
    return s.toLowerCase().replace(/[_\-]/g, ' ').replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(function(w) { return w.length > 2; });
  }

  function _buildTrigTokenSets(triggers) {
    var sets = [];
    for (var i = 0; i < triggers.length; i++) {
      var tokens = _normTokensShared(triggers[i]);
      if (tokens.length > 0) sets.push(tokens);
    }
    return sets;
  }

  function _scoreTxRelevance(tx, trigTokenSets) {
    if (!trigTokenSets || trigTokenSets.length === 0) return 0;
    var txText = (tx.label || '') + ' ' + (tx.description || '');
    var txTokens = _normTokensShared(txText);
    if (txTokens.length === 0) return 0;
    var total = 0;
    for (var ti = 0; ti < trigTokenSets.length; ti++) {
      var trig = trigTokenSets[ti];
      var shared = 0;
      for (var tk = 0; tk < trig.length; tk++) {
        if (txTokens.indexOf(trig[tk]) !== -1) shared++;
      }
      var threshold = trig.length <= 2 ? 1 : 2;
      if (shared >= threshold) total += shared;
    }
    return total;
  }

  // Sort treatments: evidence primary, trigger-relevance secondary within same tier.
  // trigTokenSets can be null/empty for evidence-only fallback.
  function _sortTreatments(txArray, trigTokenSets) {
    // Attach scores
    for (var i = 0; i < txArray.length; i++) {
      txArray[i]._relScore = _scoreTxRelevance(txArray[i], trigTokenSets);
    }
    txArray.sort(function(a, b) {
      var ea = _evOrder[a.evidence] !== undefined ? _evOrder[a.evidence] : 9;
      var eb = _evOrder[b.evidence] !== undefined ? _evOrder[b.evidence] : 9;
      if (ea !== eb) return ea - eb;
      return b._relScore - a._relScore;
    });
  }

  // Render a LIVE tag if treatment has relevance > 0
  function _txLiveTag(tx) {
    if (tx._relScore > 0) {
      return ' <span style="font-size:0.4rem;letter-spacing:1px;color:var(--hyper,#e85454);vertical-align:middle">LIVE</span>';
    }
    return '';
  }

  // ═══ SHARED REPORT SECTION RENDERERS ═══
  // Used by both buildPortalReport() and buildDrillLevelReport().

  function _renderRecommendedActions(txArray, isUrgent) {
    if (!txArray || txArray.length === 0) return '';
    var topN = Math.min(txArray.length, 3);
    var h = '<div class="nd-section">';
    h += '<div class="nd-section-label">' + (isUrgent ? '<span style="color:var(--hyper,#e85454)">URGENT \u2014 </span>' : '') + 'RECOMMENDED ACTIONS</div>';
    for (var i = 0; i < topN; i++) {
      var rtx = txArray[i];
      var desc = rtx.description || '';
      var dot = desc.indexOf('. ');
      if (dot > 0 && dot < 120) desc = desc.slice(0, dot + 1);
      else if (desc.length > 120) desc = desc.slice(0, 117) + '...';
      h += '<div style="padding:6px 0' + (i < topN - 1 ? ';border-bottom:1px solid rgba(201,169,78,0.04)' : '') + '">';
      h += '<div style="display:flex;align-items:baseline;gap:8px">';
      h += '<span style="color:var(--gold);font-size:0.7rem;font-weight:600">' + (i + 1) + '.</span>';
      h += '<span style="font-size:0.7rem;color:var(--text-dim)">' + escHtml(rtx.label) + _txLiveTag(rtx) + '</span>';
      h += '</div>';
      if (desc) h += '<div style="font-size:0.55rem;color:var(--text-ghost);padding-left:18px;margin-top:2px;line-height:1.5">' + escHtml(desc) + '</div>';
      h += '<div style="font-size:0.45rem;letter-spacing:1px;padding-left:18px;margin-top:3px">';
      if (rtx.evidence) h += '<span style="color:var(--gold-dim)">Evidence: ' + escHtml(rtx.evidence) + '</span>';
      if (rtx.type) h += ' <span style="color:var(--text-ghost)">\u00b7 ' + escHtml(rtx.type) + '</span>';
      h += '</div></div>';
    }
    h += '</div>';
    return h;
  }

  function _renderDirectivesList(txArray, label, maxShow) {
    if (!txArray || txArray.length === 0) return '';
    var shown = Math.min(txArray.length, maxShow || 10);
    var h = '<div class="nd-section"><div class="nd-section-label">' + escHtml(label) + ' (' + txArray.length + ' total, showing ' + shown + ')</div>';
    for (var i = 0; i < shown; i++) {
      var tx = txArray[i];
      h += '<div class="l6-tx">';
      h += '<div class="l6-tx-head">';
      if (tx.evidence) h += '<span class="l6-tx-ev">' + escHtml(tx.evidence) + '</span>';
      if (tx.type) h += '<span class="l6-tx-type">' + escHtml(tx.type) + '</span>';
      h += _txLiveTag(tx);
      h += '</div>';
      h += '<div class="l6-tx-label">' + escHtml(tx.label) + '</div>';
      if (tx.description) h += '<div class="l6-node-desc">' + escHtml(tx.description) + '</div>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function _renderInstitutions(activations, label, maxShow) {
    var companyMap = {};
    for (var i = 0; i < activations.length; i++) {
      var cos = activations[i].companies || [];
      for (var j = 0; j < cos.length; j++) {
        var co = cos[j];
        var coName = co.name || co;
        if (!companyMap[coName]) companyMap[coName] = co;
      }
    }
    var names = Object.keys(companyMap);
    if (names.length === 0) return '';
    var cap = maxShow || 20;
    var h = '<div class="nd-section"><div class="nd-section-label">' + escHtml(label) + ' (' + names.length + ')</div>';
    h += '<div class="l6-companies">';
    for (var k = 0; k < Math.min(names.length, cap); k++) {
      var coObj = companyMap[names[k]];
      h += '<span class="l6-company">' + escHtml(names[k]);
      if (coObj.ticker_or_id && coObj.ticker_or_id !== 'private') h += ' (' + escHtml(coObj.ticker_or_id) + ')';
      h += '</span>';
    }
    if (names.length > cap) h += '<span class="l6-company" style="color:var(--text-ghost)">+ ' + (names.length - cap) + ' more</span>';
    h += '</div></div>';
    return h;
  }

  // ═══ COLLAPSIBLE SECTIONS ═══
  // Applied to showNodeDetail() and selectDrillNode() only, not reports.

  var _COLLAPSE_STORAGE_KEY = 'limen_collapsed_sections';

  function _getCollapsedSet() {
    try {
      var raw = sessionStorage.getItem(_COLLAPSE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function _saveCollapsedSet(obj) {
    try { sessionStorage.setItem(_COLLAPSE_STORAGE_KEY, JSON.stringify(obj)); } catch(e) {}
  }

  // Build a scoped key: viewType:context:label
  function _collapseKey(viewType, contextId, labelText) {
    return viewType + ':' + contextId + ':' + labelText;
  }

  function toggleSection(el) {
    var section = el.parentElement;
    if (!section) return;
    var key = el.getAttribute('data-collapse-key');
    if (!key) return;
    var collapsed = _getCollapsedSet();
    if (section.classList.contains('nd-collapsed')) {
      section.classList.remove('nd-collapsed');
      collapsed[key] = 0; // explicitly opened — overrides default-collapse
    } else {
      section.classList.add('nd-collapsed');
      collapsed[key] = 1;
    }
    _saveCollapsedSet(collapsed);
  }

  // After innerHTML is set, make section labels collapsible and restore state.
  // viewType: 'node' | 'drill'
  // contextId: domainId or drillData.domainId
  // Sections that default to collapsed on first view (analyst can expand)
  var _DEFAULT_COLLAPSED_PREFIXES = ['SYSTEM', 'GROUP', 'WHY THIS BRAIN REGION', 'DIAGNOSTIC TRIGGERS', 'OVERVIEW', 'NARRATIVE', 'PROTOCOL'];

  function _isDefaultCollapsed(labelText) {
    var upper = labelText.toUpperCase();
    for (var i = 0; i < _DEFAULT_COLLAPSED_PREFIXES.length; i++) {
      if (upper.indexOf(_DEFAULT_COLLAPSED_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  function _applyCollapsibleSections(container, viewType, contextId) {
    if (!container) return;
    var collapsed = _getCollapsedSet();
    var labels = container.querySelectorAll('.nd-section-label');
    for (var i = 0; i < labels.length; i++) {
      var lbl = labels[i];
      if (lbl.classList.contains('nd-collapsible')) continue;
      var section = lbl.parentElement;
      if (!section || !section.classList.contains('nd-section')) continue;
      var labelText = lbl.textContent.replace(/[▾▸]\s*/g, '').trim();
      var key = _collapseKey(viewType, contextId, labelText);
      lbl.classList.add('nd-collapsible');
      lbl.setAttribute('data-collapse-key', key);
      lbl.setAttribute('onclick', 'PortalUI.toggleSection(this)');
      if (collapsed[key] === 1) {
        // Analyst explicitly collapsed this section
        section.classList.add('nd-collapsed');
      } else if (collapsed[key] === 0) {
        // Analyst explicitly expanded this section — respect that
      } else {
        // Key not in storage — apply default
        if (_isDefaultCollapsed(labelText)) {
          section.classList.add('nd-collapsed');
        }
      }
    }
  }

  // ═══ ANALYST CONTEXT BAR ═══
  // Compact strip showing domain, portal, diagnosis, node, directive count.
  // Used at top of both showNodeDetail() and selectDrillNode().
  function buildContextBar(opts) {
    // opts: { domain, portal, diagnosis, node, brainId, directives, stress, drillDepth, path }
    var parts = [];
    if (opts.domain) parts.push(escHtml(opts.domain.toUpperCase()));
    if (opts.portal) parts.push(escHtml(opts.portal));
    var h = '<div style="padding:8px 20px 6px;border-bottom:1px solid var(--border);font-size:0.45rem;letter-spacing:1.5px;color:var(--text-ghost);text-transform:uppercase">';
    if (parts.length > 0) {
      h += '<div>' + parts.join(' <span style="color:var(--gold-ghost)"> \u203A </span> ') + '</div>';
    }
    // Drill path line (only in drill views)
    if (opts.path && opts.path.length > 0 && opts.drillDepth > 0) {
      var depthLabel = 'L' + (opts.drillDepth + 1);
      h += '<div style="margin-top:3px;font-size:0.42rem;letter-spacing:1px;color:var(--gold-ghost)">';
      h += depthLabel + ' \u00b7 ';
      h += opts.path.map(function(p) { return escHtml(p); }).join(' \u203A ');
      h += '</div>';
    }
    var meta = [];
    if (opts.diagnosis) meta.push('<span style="color:var(--altered,#d4a84a)">\u25C9 ' + escHtml(opts.diagnosis) + '</span>');
    if (opts.node) meta.push('<span style="color:var(--gold-dim)">' + escHtml(opts.node) + '</span>');
    if (opts.brainId) meta.push('<span style="color:var(--text-ghost)">' + escHtml(opts.brainId) + '</span>');
    if (meta.length > 0) {
      h += '<div style="margin-top:3px;font-size:0.5rem;letter-spacing:1px">' + meta.join(' <span style="color:var(--gold-ghost)"> \u00b7 </span> ') + '</div>';
    }
    var stats = [];
    if (opts.directives > 0) stats.push(opts.directives + ' directive' + (opts.directives > 1 ? 's' : ''));
    if (opts.stress !== null && opts.stress !== undefined) {
      var sc = opts.stress > 0.65 ? 'var(--hyper,#e85454)' : opts.stress > 0.4 ? 'var(--altered,#d4a84a)' : 'var(--hypo,#4a8fd4)';
      stats.push('<span style="color:' + sc + '">stress ' + opts.stress.toFixed(2) + '</span>');
    }
    if (opts.drillDepth > 0) stats.push('depth L' + (opts.drillDepth + 1));
    if (stats.length > 0) {
      h += '<div style="margin-top:3px;font-size:0.45rem;letter-spacing:1px">' + stats.join(' \u00b7 ') + '</div>';
    }
    h += '</div>';
    return h;
  }

  // ═══ NODE DETAIL — DIRECTIVE VIEW (right panel) ═══
  // Shows full node intelligence: function, directives, treatments,
  // diagnostics, companies, connections. ENTER PORTAL loads child
  // data in-panel. No page navigation.
  function showNodeDetail(n, idx) {
    drillStack = []; // reset drill navigation when selecting a new node
    currentDrillData = null;
    if (!n || !n.activated) { clearSelection(); return; }
    var NODES = getNodeArray();
    var EDGES = getEdgesCompat();
    var empty = document.getElementById('rightEmpty');
    var content = document.getElementById('interventionContent');
    var detail = document.getElementById('nodeDeepDive');
    if (!detail) return;
    if (empty) empty.style.display = 'none';
    if (content) content.style.display = 'none';
    detail.style.display = 'block';

    var html = '';

    // ── Analyst Context Bar ──
    var _ctxDomain = config.domainId ? config.domainId.split('_')[0] : '';
    var _ctxPortal = (DATA && DATA.title) ? DATA.title : (config.parentLabel || '');
    var _ctxDiag = null;
    if (activeIssueId && DATA && DATA.issues) {
      for (var _di = 0; _di < DATA.issues.length; _di++) {
        if (DATA.issues[_di].id === activeIssueId) { _ctxDiag = DATA.issues[_di].label; break; }
      }
    }
    var _ctxStress = null;
    if (typeof window !== 'undefined' && window.LIMENDomains && window.LIMENDomains[_ctxDomain]) {
      _ctxStress = window.LIMENDomains[_ctxDomain].stress;
    }
    html += buildContextBar({
      domain: _ctxDomain,
      portal: _ctxPortal,
      diagnosis: _ctxDiag,
      node: n.domainLabel || n.label,
      brainId: n.id,
      directives: (n.treatments && n.treatments.length) || 0,
      stress: _ctxStress,
      drillDepth: 0
    });

    // ── Node Status Summary ──
    (function() {
      var parts = [];
      parts.push(n.activated ? 'Active' : 'Inactive');
      var txCount = (n.treatments && n.treatments.length) || 0;
      if (txCount > 0) parts.push(txCount + ' directive' + (txCount > 1 ? 's' : ''));
      // Count live triggers (quick scan — same logic used later in Live Signals)
      var _triggers = n.diagnosticTriggers || [];
      var _domData = (typeof window !== 'undefined' && window.LIMENDomains && window.LIMENDomains[_ctxDomain]) ? window.LIMENDomains[_ctxDomain] : null;
      if (_triggers.length > 0 && _domData && _domData.signals && _domData.signals.length > 0) {
        var _liveTrigCount = 0;
        var _tSets = _buildTrigTokenSets(_triggers);
        for (var _si = 0; _si < _domData.signals.length; _si++) {
          var _st = typeof _domData.signals[_si] === 'string' ? _domData.signals[_si] : (_domData.signals[_si].label || '');
          var _stTokens = _normTokensShared(_st);
          for (var _ti = 0; _ti < _tSets.length; _ti++) {
            var _shared = 0;
            for (var _tk = 0; _tk < _tSets[_ti].length; _tk++) { if (_stTokens.indexOf(_tSets[_ti][_tk]) !== -1) _shared++; }
            var _thr = _tSets[_ti].length <= 2 ? 1 : 2;
            if (_shared >= _thr) { _liveTrigCount++; break; }
          }
        }
        if (_liveTrigCount > 0) parts.push(_liveTrigCount + ' live trigger' + (_liveTrigCount > 1 ? 's' : ''));
      }
      // Count distressed cross-domain overlaps
      if (CROSS_DOMAIN_MAP && n.id) {
        var _cdEntries = CROSS_DOMAIN_MAP[n.id] || [];
        var _distressed = 0;
        for (var _ci = 0; _ci < _cdEntries.length; _ci++) {
          var _cd = _cdEntries[_ci];
          if (_cd.domain === _ctxDomain) continue;
          if (window.LIMENDomains && window.LIMENDomains[_cd.domain] && window.LIMENDomains[_cd.domain].stress > 0.65) _distressed++;
        }
        if (_distressed > 0) parts.push('cross-domain pressure from ' + _distressed + ' distressed domain' + (_distressed > 1 ? 's' : ''));
      }
      if (parts.length > 0) {
        html += '<div style="padding:4px 20px 6px;font-size:0.5rem;letter-spacing:1px;color:var(--text-ghost);border-bottom:1px solid rgba(201,169,78,0.04)">';
        html += parts.join(' <span style="color:var(--gold-ghost)">\u00b7</span> ');
        html += '</div>';
      }
    })();

    // ── Header ──
    html += '<div class="nd-header">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
    html += '<div>';
    html += '<div class="nd-label">' + escHtml(n.domainLabel || n.label) + '</div>';
    var brainName = (n.brainLabel || n.label).replace(/\n/g, ' ');
    html += '<div class="nd-brain">' + escHtml(brainName) + ' (' + escHtml(n.id) + ')</div>';
    if (n.domainPhase) {
      var phex = Constants.PHASE_COLORS[n.domainPhase] || '#78788C';
      var tagline = Constants.PHASE_TAGLINES ? (Constants.PHASE_TAGLINES[n.domainPhase] || '') : '';
      html += '<div class="nd-phase" style="color:' + phex + '">' + n.domainPhase + ' \u00b7 ' + tagline + '</div>';
    }
    html += '</div>';
    html += '<button class="ndd-close" onclick="PortalUI.clearSelection()">\u2715</button>';
    html += '</div>';
    html += '</div><hr class="nd-divider">';

    // ── System ──
    if (n.sys) {
      html += '<div class="nd-section"><div class="nd-section-label">' + escHtml(n.sys.toUpperCase()) + ' SYSTEM</div></div>';
    }

    // ── Group ──
    if (n.domainGroup) {
      html += '<div class="nd-section"><div class="nd-section-label">GROUP</div>';
      html += '<div class="nd-group">' + escHtml(n.domainGroup.toUpperCase().replace(/_/g, ' ')) + '</div></div>';
    }

    // ── Function: what this node does ──
    if (n.domainFunction) {
      html += '<div class="nd-section"><div class="nd-section-label">FUNCTION</div>';
      html += '<div class="nd-desc">' + escHtml(n.domainFunction) + '</div></div>';
    }

    // ── Why this brain region ──
    var whyText = n.whyThisNode || null;
    if (!whyText) {
      var brainWhy = config.brainWhy || {};
      whyText = brainWhy[n.id] || null;
    }
    if (!whyText && n.brainLabel && config.parentLabel) {
      whyText = 'This node acts as the ' + brainName + ' of ' + config.parentLabel + ' \u2014 processing and regulating this domain function.';
    }
    if (whyText) {
      html += '<div class="nd-section"><div class="nd-section-label">WHY THIS BRAIN REGION?</div>';
      html += '<div class="nd-why">' + escHtml(whyText) + '</div></div>';
    }

    // ── Description ──
    if (n.domainDescription) {
      html += '<div class="nd-section"><div class="nd-section-label">DESCRIPTION</div>';
      html += '<div class="nd-desc">' + escHtml(n.domainDescription) + '</div></div>';
    }

    // ── Diagnostic triggers ──
    if (n.diagnosticTriggers && n.diagnosticTriggers.length > 0) {
      html += '<div class="nd-section"><div class="nd-section-label">DIAGNOSTIC TRIGGERS</div>';
      for (var dt = 0; dt < n.diagnosticTriggers.length; dt++) {
        html += '<div class="nd-edge">' + escHtml(n.diagnosticTriggers[dt]) + '</div>';
      }
      html += '</div>';
    }

    // ── Treatments / Directives (sorted: evidence primary, trigger-relevance secondary) ──
    if (n.treatments && n.treatments.length > 0) {
      var _nodeTrigSets = _buildTrigTokenSets(n.diagnosticTriggers || []);
      var _sortedTx = n.treatments.slice(); // shallow copy to avoid mutating node
      _sortTreatments(_sortedTx, _nodeTrigSets);
      html += '<div class="nd-section"><div class="nd-section-label">DIRECTIVES (' + _sortedTx.length + ')</div>';
      for (var t = 0; t < _sortedTx.length; t++) {
        var tx = _sortedTx[t];
        html += '<div class="l6-tx">';
        html += '<div class="l6-tx-head">';
        if (tx.evidence) html += '<span class="l6-tx-ev">' + escHtml(tx.evidence) + '</span>';
        if (tx.type) html += '<span class="l6-tx-type">' + escHtml(tx.type) + '</span>';
        html += _txLiveTag(tx);
        html += '</div>';
        html += '<div class="l6-tx-label">' + escHtml(tx.label) + '</div>';
        if (tx.description) html += '<div class="l6-node-desc">' + escHtml(tx.description) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    // ── Companies / Institutions ──
    if (n.companies && n.companies.length > 0) {
      html += '<div class="nd-section"><div class="nd-section-label">COMPANIES &amp; INSTITUTIONS</div>';
      html += '<div class="l6-companies">';
      for (var ci = 0; ci < n.companies.length; ci++) {
        var co = n.companies[ci];
        html += '<span class="l6-company">' + escHtml(co.name || co);
        if (co.ticker_or_id && co.ticker_or_id !== 'private') html += ' (' + escHtml(co.ticker_or_id) + ')';
        html += '</span>';
      }
      html += '</div></div>';
    }

    // ── Connections ──
    var connections = [];
    for (var i = 0; i < EDGES.length; i++) {
      var e = EDGES[i];
      if (!e.isDomainEdge) continue;
      if (e.ai === idx) {
        var tgt = NODES[e.bi];
        if (tgt) connections.push({dir: '\u2192', target: tgt.domainLabel || tgt.brainLabel || tgt.label, type: e.type, weight: e.weight});
      } else if (e.bi === idx) {
        var src = NODES[e.ai];
        if (src) connections.push({dir: '\u2190', target: src.domainLabel || src.brainLabel || src.label, type: e.type, weight: e.weight});
      }
    }
    if (connections.length > 0) {
      html += '<div class="nd-section"><div class="nd-section-label">CONNECTIONS</div>';
      for (var i = 0; i < connections.length; i++) {
        var c = connections[i];
        html += '<div class="nd-edge">' + c.dir + ' ' + escHtml(c.target) + ' <span class="nd-edge-type">' + c.type + ' (' + c.weight + ')</span></div>';
      }
      html += '</div>';
    }

    // ── Cross-Domain Influence ──
    if (CROSS_DOMAIN_MAP && n.id) {
      var cdEntries = CROSS_DOMAIN_MAP[n.id];
      if (cdEntries && cdEntries.length > 1) {
        var currentTop = config.domainId ? config.domainId.split('_')[0] : '';
        var otherDomains = [];
        for (var cdi = 0; cdi < cdEntries.length; cdi++) {
          var cde = cdEntries[cdi];
          if (cde.domain === currentTop) continue;
          var stress = null;
          if (typeof window !== 'undefined' && window.LIMENDomains && window.LIMENDomains[cde.domain]) {
            stress = window.LIMENDomains[cde.domain].stress;
          }
          otherDomains.push({ domain: cde.domain, label: cde.label, role: cde.role || '', stress: stress });
        }
        if (otherDomains.length > 0) {
          otherDomains.sort(function(a, b) {
            var sa = a.stress !== null && a.stress !== undefined ? a.stress : -1;
            var sb = b.stress !== null && b.stress !== undefined ? b.stress : -1;
            return sb - sa;
          });
          var distressedCount = 0;
          var distressedNames = [];
          html += '<div class="nd-section"><div class="nd-section-label">CROSS-DOMAIN INFLUENCE</div>';
          for (var odi = 0; odi < otherDomains.length; odi++) {
            var od = otherDomains[odi];
            var hasStress = od.stress !== null && od.stress !== undefined;
            var stressStr = hasStress ? od.stress.toFixed(2) : '\u2014';
            var stressColor = '#78788C';
            var statusTag = '';
            if (hasStress) {
              if (od.stress > 0.65) { stressColor = 'var(--hyper,#e85454)'; statusTag = 'DISTRESSED'; distressedCount++; distressedNames.push(od.label); }
              else if (od.stress > 0.4) { stressColor = 'var(--altered,#d4a84a)'; statusTag = 'ELEVATED'; }
              else { stressColor = 'var(--hypo,#4a8fd4)'; statusTag = 'STABLE'; }
            }
            // Domain row: name + role
            html += '<div style="padding:3px 0">';
            html += '<div class="nd-edge" style="display:flex;justify-content:space-between;align-items:center;padding:0">';
            html += '<span>' + escHtml(od.label) + '</span>';
            html += '<span style="color:' + stressColor + ';font-size:0.5rem;letter-spacing:1px">' + stressStr + (statusTag ? ' ' + statusTag : '') + '</span>';
            html += '</div>';
            if (od.role) {
              html += '<div style="font-size:0.45rem;color:var(--text-ghost);letter-spacing:0.5px;padding-left:2px">' + escHtml(od.role) + '</div>';
            }
            html += '</div>';
          }
          // Coordinated pressure interpretation
          html += '<div class="nd-why" style="margin-top:8px;font-size:0.55rem;letter-spacing:1px;color:var(--text-ghost)">';
          html += 'Shared node: <strong style="color:var(--gold-dim)">' + escHtml(n.id) + '</strong> \u00b7 ' + (otherDomains.length + 1) + ' domains<br>';
          if (distressedCount >= 2) {
            html += '<span style="color:var(--hyper,#e85454)">Coordinated pressure detected \u2014 ' + distressedCount + ' domains under stress are converging on this brain region.</span>';
          } else if (distressedCount === 1) {
            html += '<span style="color:var(--altered,#d4a84a)">' + escHtml(distressedNames[0]) + ' is under stress and sharing this node \u2014 monitor for spillover.</span>';
          } else {
            html += 'Cross-domain activity is within baseline.';
          }
          html += '</div></div>';
        }
      }
    }

    // ── Live Signals (node-specific: stale warning, scored signals, active triggers) ──
    (function() {
      var topDomain = config.domainId ? config.domainId.split('_')[0] : '';
      var domData = (typeof window !== 'undefined' && window.LIMENDomains) ? window.LIMENDomains[topDomain] : null;
      var feedState = (typeof window !== 'undefined' && window.LIMENFeedState) ? window.LIMENFeedState.getState() : null;

      if (domData && domData.signals && domData.signals.length > 0) {
        html += '<div class="nd-section"><div class="nd-section-label">LIVE SIGNALS</div>';

        // Stale data warning (domain stress/feed state now in bottom strip)
        var _isDegraded = feedState === 'degraded';
        var _isStale = domData.updated && (Date.now() - domData.updated > 180000);
        if (_isDegraded || _isStale) {
          var _staleMsg = '';
          if (_isDegraded && _isStale) {
            var _staleMin = Math.round((Date.now() - domData.updated) / 60000);
            _staleMsg = 'FEED DEGRADED \u00b7 last update ' + _staleMin + 'm ago \u2014 signals may be incomplete';
          } else if (_isDegraded) {
            _staleMsg = 'FEED DEGRADED \u2014 signals may be incomplete';
          } else {
            var _staleMin = Math.round((Date.now() - domData.updated) / 60000);
            _staleMsg = 'DATA MAY BE STALE \u2014 last update ' + _staleMin + 'm ago';
          }
          html += '<div style="font-size:0.42rem;letter-spacing:1px;color:var(--altered,#d4a84a);opacity:0.7;padding:3px 0">' + _staleMsg + '</div>';
        }

        // Score and sort signals by relevance to this node's diagnosticTriggers
        var signals = domData.signals;
        var triggers = n.diagnosticTriggers || [];
        var activeTriggers = [];

        function _normTokens(s) {
          return s.toLowerCase().replace(/[_\-]/g, ' ').replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(function(w) { return w.length > 2; });
        }

        var trigTokenSets = [];
        for (var _tti = 0; _tti < triggers.length; _tti++) {
          trigTokenSets.push({ text: triggers[_tti], tokens: _normTokens(triggers[_tti]) });
        }

        var scoredSignals = [];
        for (var sgi = 0; sgi < signals.length; sgi++) {
          var sigText = typeof signals[sgi] === 'string' ? signals[sgi] : (signals[sgi].label || signals[sgi].text || '');
          var sigTokens = _normTokens(sigText);
          var totalScore = 0;
          var matchedTrigger = null;
          for (var tti = 0; tti < trigTokenSets.length; tti++) {
            var trig = trigTokenSets[tti];
            if (trig.tokens.length === 0) continue;
            var shared = 0;
            for (var tk = 0; tk < trig.tokens.length; tk++) {
              if (sigTokens.indexOf(trig.tokens[tk]) !== -1) shared++;
            }
            if (shared > 0) totalScore += shared;
            var threshold = trig.tokens.length <= 2 ? 1 : 2;
            if (shared >= threshold && !matchedTrigger) matchedTrigger = trig.text;
          }
          scoredSignals.push({ text: sigText, score: totalScore, matchedTrigger: matchedTrigger });
          if (matchedTrigger) {
            activeTriggers.push({ trigger: matchedTrigger, signal: sigText });
          }
        }

        scoredSignals.sort(function(a, b) { return b.score - a.score; });

        // Render scored signals
        if (scoredSignals.length > 0) {
          for (var si = 0; si < Math.min(scoredSignals.length, 5); si++) {
            var ss = scoredSignals[si];
            var relColor = ss.score >= 3 ? 'var(--hyper,#e85454)' : ss.score >= 1 ? 'var(--altered,#d4a84a)' : 'var(--text-ghost)';
            var relDot = ss.score >= 1 ? '\u25CF' : '\u26A0';
            html += '<div style="display:flex;align-items:baseline;gap:6px;font-size:0.55rem;padding:2px 0">';
            html += '<span style="color:' + relColor + '">' + relDot + '</span>';
            html += '<span style="color:var(--text-dim);letter-spacing:0.5px;flex:1">' + escHtml(ss.text) + '</span>';
            if (ss.score >= 1) {
              html += '<span style="font-size:0.4rem;letter-spacing:1px;color:' + relColor + ';white-space:nowrap">REL</span>';
            }
            html += '</div>';
          }
          if (scoredSignals.length > 5) {
            html += '<div style="font-size:0.5rem;color:var(--text-ghost);letter-spacing:1px">+ ' + (scoredSignals.length - 5) + ' MORE SIGNALS</div>';
          }
        }

        // Active Triggers
        if (activeTriggers.length > 0) {
          html += '<div style="margin-top:8px;padding:8px 12px;background:rgba(232,84,84,0.06);border:1px solid rgba(232,84,84,0.15);border-radius:3px">';
          html += '<div style="font-size:0.45rem;letter-spacing:2px;color:var(--hyper,#e85454);margin-bottom:6px">ACTIVE TRIGGERS (' + activeTriggers.length + ')</div>';
          for (var ati = 0; ati < activeTriggers.length; ati++) {
            html += '<div style="font-size:0.55rem;color:var(--text-dim);padding:2px 0">';
            html += '<strong style="color:var(--hyper,#e85454)">\u25CF</strong> ' + escHtml(activeTriggers[ati].trigger);
            html += ' <span style="font-size:0.45rem;color:var(--text-ghost)">\u2190 ' + escHtml(activeTriggers[ati].signal) + '</span>';
            html += '</div>';
          }
          html += '<div style="font-size:0.5rem;color:rgba(232,84,84,0.6);margin-top:6px;font-style:italic">';
          html += 'This node\'s diagnostic trigger' + (activeTriggers.length > 1 ? 's are' : ' is') + ' currently active in live feeds.';
          html += '</div></div>';
        }

        html += '</div>';
      }
    })();

    // ── Tiered content block (if present) ──
    if (n.content) {
      var gateParam = new URLSearchParams(window.location.search).get('limen');
      var c = n.content;
      if (c.tier1) {
        html += '<div class="nd-section"><div class="nd-section-label">' + escHtml(c.tier1.label || 'OVERVIEW') + '</div>';
        html += '<div class="nd-content-text">' + escHtml(c.tier1.text) + '</div></div>';
      }
      if (c.tier2) {
        if (c.tier2.access === 'free' || gateParam === c.tier2.gate) {
          html += '<div class="nd-section"><div class="nd-section-label">' + escHtml(c.tier2.label || 'NARRATIVE') + '</div>';
          var t2Paragraphs = c.tier2.text.split('\n\n');
          for (var t2i = 0; t2i < t2Paragraphs.length; t2i++) {
            if (t2Paragraphs[t2i].trim()) html += '<p class="nd-content-text">' + escHtml(t2Paragraphs[t2i].trim()) + '</p>';
          }
          html += '</div>';
        } else {
          html += '<div class="nd-section nd-gated"><div class="nd-section-label">' + escHtml(c.tier2.label || 'NARRATIVE') + '</div>';
          html += '<div class="nd-gated-lock">&#128274; GATED CONTENT</div></div>';
        }
      }
      if (c.tier3) {
        if (c.tier3.access === 'free' || gateParam === c.tier3.gate) {
          html += '<div class="nd-section"><div class="nd-section-label">' + escHtml(c.tier3.label || 'PROTOCOL') + '</div>';
          if (c.tier3.citation) {
            var cite = c.tier3.citation;
            html += '<div class="nd-citation">';
            html += '<span class="nd-cite-authors">' + escHtml(cite.authors) + '</span> ';
            html += '(' + escHtml(String(cite.year)) + '). ';
            html += '<em class="nd-cite-title">' + escHtml(cite.title) + '</em>. ';
            html += '<span class="nd-cite-journal">' + escHtml(cite.journal) + '</span>';
            if (cite.volume) html += ', ' + escHtml(cite.volume);
            if (cite.pages) html += ', ' + escHtml(cite.pages);
            html += '.';
            if (cite.doi) html += ' <a class="nd-cite-doi" href="' + escHtml(cite.url || ('https://doi.org/' + cite.doi)) + '" target="_blank" rel="noopener">DOI: ' + escHtml(cite.doi) + '</a>';
            html += '</div>';
          }
          if (c.tier3.protocol) html += '<div class="nd-content-text nd-protocol">' + escHtml(c.tier3.protocol) + '</div>';
          html += '</div>';
        } else {
          html += '<div class="nd-section nd-gated"><div class="nd-section-label">' + escHtml(c.tier3.label || 'PROTOCOL') + '</div>';
          html += '<div class="nd-gated-lock">&#128274; GATED CONTENT</div></div>';
        }
      }
    }

    // ── ENTER PORTAL — always loads child data in-panel, never navigates away ──
    console.log('[DrillDebug] showNodeDetail childPortal check:', n.id, 'raw:', n.childPortal, 'truthy:', !!n.childPortal);
    if (n.childPortal) {
      var enterDomainId = resolveDomainId(n.childPortal);
      console.log('[DrillDebug] ENTER PORTAL button rendering:', 'raw:', n.childPortal, '→ resolved:', enterDomainId);
      html += '<button class="nd-portal-link" onclick="PortalUI.drillDown(\'' + escHtml(enterDomainId) + '\', \'' + escHtml(n.domainLabel || n.label) + '\')">ENTER PORTAL \u2192</button>';
    }

    detail.innerHTML = html;
    detail.scrollTop = 0;
    _applyCollapsibleSections(detail, 'node', config.domainId + ':' + n.id);
  }

  // ═══ DRILL-DOWN NAVIGATION (L4→L5→L6 via serverless proxy) ═══

  // Normalize childPortal to clean domainId — handles both legacy "_portal.html" and clean formats
  function resolveDomainId(raw) {
    if (!raw) return raw;
    if (raw.indexOf('.') === -1) return raw;                        // already clean
    if (raw.lastIndexOf('_portal.html') === raw.length - 12)
      return raw.slice(0, -12);                                     // legacy _portal.html
    if (raw.lastIndexOf('.html') === raw.length - 5)
      return raw.slice(0, -5);                                      // edge case .html
    return raw;
  }

  var drillStack = []; // [{html, scrollTop, label, leftNodeHtml, leftIssueHtml, leftIssueDisplay, drillData}]
  var currentDrillData = null; // data for current drill level (null = base level)

  function snapshotLeftPanel() {
    var nodeList = document.getElementById('nodeList');
    var issueSection = document.getElementById('issueSection');
    return {
      leftNodeHtml: nodeList ? nodeList.innerHTML : '',
      leftIssueHtml: issueSection ? issueSection.innerHTML : '',
      leftIssueDisplay: issueSection ? issueSection.style.display : '',
      drillData: currentDrillData
    };
  }

  function restoreLeftPanel(entry) {
    var nodeList = document.getElementById('nodeList');
    var issueSection = document.getElementById('issueSection');
    if (nodeList) nodeList.innerHTML = entry.leftNodeHtml;
    if (issueSection) {
      issueSection.innerHTML = entry.leftIssueHtml;
      issueSection.style.display = entry.leftIssueDisplay;
    }
    currentDrillData = entry.drillData;
    // Update stats
    var nodeCount = document.getElementById('nodeCount');
    if (nodeCount && !currentDrillData) {
      // Back at base level — restore from Engine
      var activated = Engine.getActivatedNodes();
      var EDGES = getEdgesCompat();
      var domainEdgeCount = 0;
      for (var i = 0; i < EDGES.length; i++) { if (EDGES[i].isDomainEdge) domainEdgeCount++; }
      nodeCount.textContent = activated.length + ' ACTIVE NODES \u00b7 ' + domainEdgeCount + ' PATHWAYS';
    }
  }

  function drillDown(domainId, parentLabel) {
    console.log('[DrillDebug] drillDown() called:', 'domainId:', domainId, 'parentLabel:', parentLabel);
    var detail = document.getElementById('nodeDeepDive');
    if (!detail) { console.warn('[DrillDebug] drillDown aborted: nodeDeepDive element not found'); return; }

    // Push current state (right + left panels) onto stack
    var entry = snapshotLeftPanel();
    entry.html = detail.innerHTML;
    entry.scrollTop = detail.scrollTop;
    entry.label = parentLabel;
    drillStack.push(entry);

    // Loading state with breadcrumb
    detail.innerHTML = buildDrillBreadcrumb(parentLabel) +
      '<div class="l6-loading"><div class="l6-spinner"></div>LOADING DATA\u2026</div>';
    detail.scrollTop = 0;

    var url = '/api/fetch-portal?domainId=' + encodeURIComponent(domainId);
    console.log('[DrillDebug] drillDown fetching:', url);
    fetch(url).then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function(data) {
      console.log('[DrillDebug] drillDown data received:', 'activations:', (data.activations||[]).length, 'withChildPortal:', (data.activations||[]).filter(function(a){return !!a.childPortal;}).length);
      currentDrillData = data;
      buildDrillLeftPanel(data);
      renderDrillDown(detail, data);
    }).catch(function(err) {
      detail.innerHTML = buildDrillBreadcrumb(null) +
        '<div class="l6-error">FETCH FAILED<div class="l6-error-detail">' + escHtml(err.message) + '</div></div>';
    });
  }

  // Backward-compat alias
  function drillDownL6(domainId, parentLabel) { drillDown(domainId, parentLabel); }

  function buildDrillBreadcrumb(currentLabel) {
    var html = '<div class="nd-header"><div class="drill-breadcrumb">';
    // Back button — always goes up one level
    html += '<button class="l6-back" onclick="PortalUI.drillBack()">\u2190 BACK</button>';
    // Level report button — only when drill data is loaded
    if (currentDrillData) {
      html += '<button class="l6-back" style="margin-left:6px;color:var(--gold-dim)" onclick="PortalUI.showDrillLevelReport()">LEVEL REPORT</button>';
    }
    // Breadcrumb trail
    html += '<div class="drill-trail">';
    for (var i = 0; i < drillStack.length; i++) {
      var lbl = drillStack[i].label;
      html += '<span class="drill-crumb" onclick="PortalUI.drillBackTo(' + i + ')">' + escHtml(lbl) + '</span>';
      html += '<span class="bc-sep">\u2192</span>';
    }
    if (currentLabel) {
      html += '<span class="drill-crumb-current">' + escHtml(currentLabel) + '</span>';
    }
    html += '</div></div></div>';
    return html;
  }

  // ═══ DRILL LEVEL REPORT ═══
  // Snapshot of pre-report drill state for restore on close.
  var _drillReportSnapshot = null;

  function buildDrillLevelReport() {
    var data = currentDrillData;
    if (!data) return '';
    var topDomain = config.domainId ? config.domainId.split('_')[0] : '';
    var activations = data.activations || [];
    var issues = data.issues || [];
    var domData = (typeof window !== 'undefined' && window.LIMENDomains && window.LIMENDomains[topDomain]) ? window.LIMENDomains[topDomain] : null;
    var depth = drillStack.length;
    var depthLabel = 'L' + (depth + 2); // drillStack.length=0 means L2, 1=L3, etc.

    // Aggregate treatments + build trigger context
    var lvlTx = [];
    var _lvlTriggers = [];
    for (var ai = 0; ai < activations.length; ai++) {
      var txList = activations[ai].treatments || [];
      for (var ti = 0; ti < txList.length; ti++) lvlTx.push(txList[ti]);
      var _ltrigs = activations[ai].diagnosticTriggers || [];
      for (var _lgi = 0; _lgi < _ltrigs.length; _lgi++) _lvlTriggers.push(_ltrigs[_lgi]);
    }
    var _lvlTrigSets = _lvlTriggers.length >= 3 ? _buildTrigTokenSets(_lvlTriggers) : [];
    _sortTreatments(lvlTx, _lvlTrigSets);

    var isUrgent = domData && domData.stress > 0.65;

    var html = '';

    // Header with breadcrumb + close
    html += buildDrillBreadcrumb(data.title || data.domainId);
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 20px;border-bottom:1px solid var(--border)">';
    html += '<div style="font-size:0.5rem;letter-spacing:3px;color:var(--gold);text-transform:uppercase">LEVEL REPORT \u00b7 ' + depthLabel + '</div>';
    html += '<button class="ndd-close" onclick="PortalUI.closeDrillLevelReport()">\u2715</button>';
    html += '</div>';

    // ── Level Context ──
    html += '<div class="nd-section"><div class="nd-section-label">LEVEL CONTEXT</div>';
    html += '<div class="nd-desc"><strong style="color:var(--gold-dim)">' + escHtml(data.title || data.domainId) + '</strong>';
    html += ' \u00b7 ' + depthLabel + ' \u00b7 ' + escHtml(topDomain.toUpperCase()) + '</div>';
    // Parent chain
    if (drillStack.length > 0) {
      var chain = [];
      for (var si = 0; si < drillStack.length; si++) chain.push(drillStack[si].label);
      chain.push(data.title || data.domainId);
      html += '<div style="font-size:0.45rem;color:var(--text-ghost);letter-spacing:1px;margin-top:4px">' + chain.map(function(c) { return escHtml(c); }).join(' \u203A ') + '</div>';
    }
    html += '<div class="nd-edge" style="display:flex;justify-content:space-between;margin-top:6px">';
    html += '<span>Nodes at this level</span><span style="color:var(--gold-dim)">' + activations.length + '</span>';
    html += '</div>';
    if (issues.length > 0) {
      html += '<div class="nd-edge" style="display:flex;justify-content:space-between">';
      html += '<span>Diagnoses</span><span style="color:var(--gold-dim)">' + issues.length + '</span>';
      html += '</div>';
    }
    html += '</div>';

    html += _renderRecommendedActions(lvlTx, isUrgent);
    html += _renderDirectivesList(lvlTx, 'LEVEL DIRECTIVES', 10);
    html += _renderInstitutions(activations, 'LEVEL INSTITUTIONS', 15);

    // Timestamp
    html += '<div style="padding:12px 20px;font-size:0.4rem;color:var(--text-ghost);letter-spacing:1px;text-align:right">';
    html += 'GENERATED ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    html += '</div>';

    return html;
  }

  function showDrillLevelReport() {
    if (!currentDrillData) return;
    var detail = document.getElementById('nodeDeepDive');
    if (!detail) return;
    // Snapshot current drill view so close can restore it
    _drillReportSnapshot = { html: detail.innerHTML, scrollTop: detail.scrollTop };
    detail.innerHTML = buildDrillLevelReport();
    detail.scrollTop = 0;
  }

  function closeDrillLevelReport() {
    var detail = document.getElementById('nodeDeepDive');
    if (!detail) return;
    if (_drillReportSnapshot) {
      detail.innerHTML = _drillReportSnapshot.html;
      detail.scrollTop = _drillReportSnapshot.scrollTop;
      _drillReportSnapshot = null;
    } else {
      // Fallback: re-render current drill node
      if (currentDrillData && currentDrillData.activations && currentDrillData.activations.length > 0) {
        selectDrillNode(0);
      }
    }
  }

  function renderDrillDown(detail, data) {
    // Show one node at a time — auto-select the first activation
    if (data.activations && data.activations.length > 0) {
      selectDrillNode(0);
    } else {
      var currentLabel = data.title || data.domainId;
      detail.innerHTML = buildDrillBreadcrumb(currentLabel) +
        '<div style="padding:30px 16px;color:var(--text-ghost);font-size:0.55rem;letter-spacing:2px;text-align:center">NO NODES AT THIS LEVEL</div>';
      detail.scrollTop = 0;
    }
  }

  // ═══ DRILL-LEVEL LEFT PANEL ═══
  function buildDrillLeftPanel(data) {
    var nodeList = document.getElementById('nodeList');
    var issueSection = document.getElementById('issueSection');

    // Build node list from activations
    if (nodeList && data.activations) {
      var groups = {};
      var groupKeys = [];
      for (var i = 0; i < data.activations.length; i++) {
        var act = data.activations[i];
        var g = act.group || 'other';
        if (!groups[g]) { groups[g] = []; groupKeys.push(g); }
        groups[g].push({ act: act, index: i });
      }
      // Use data's group order if available, else discovered order
      var orderedKeys = groupKeys;
      if (data.groups && data.groups.length > 0) {
        orderedKeys = [];
        for (var gi = 0; gi < data.groups.length; gi++) orderedKeys.push(data.groups[gi].key);
        // Append any discovered keys not in the explicit order
        for (var ki = 0; ki < groupKeys.length; ki++) {
          if (orderedKeys.indexOf(groupKeys[ki]) === -1) orderedKeys.push(groupKeys[ki]);
        }
      }
      var html = '';
      for (var gi = 0; gi < orderedKeys.length; gi++) {
        var g = orderedKeys[gi];
        var gNodes = groups[g];
        if (!gNodes || gNodes.length === 0) continue;
        var gLabel = g.toUpperCase().replace(/_/g, ' ');
        if (data.groups) {
          for (var gl = 0; gl < data.groups.length; gl++) {
            if (data.groups[gl].key === g) { gLabel = data.groups[gl].label; break; }
          }
        }
        html += '<div class="dx-category" data-group="' + escHtml(g) + '">';
        html += '<div class="dx-category-label" onclick="PortalUI.toggleCategory(this)">' + escHtml(gLabel) + '<span class="collapse-icon">&#9662;</span></div>';
        html += '<div class="dx-items">';
        for (var j = 0; j < gNodes.length; j++) {
          var item = gNodes[j];
          var act = item.act;
          var label = act.domainLabel || act.brainNodeId;
          html += '<div class="dx-item" data-drill-idx="' + item.index + '" onclick="PortalUI.selectDrillNode(' + item.index + ')">';
          html += '<span class="dx-name">' + escHtml(label) + '</span>';
          html += '<span class="dx-brain">' + escHtml(act.brainNodeId || '') + '</span>';
          html += '</div>';
        }
        html += '</div></div>';
      }
      nodeList.innerHTML = html;
    }

    // Build issue list
    if (issueSection) {
      if (data.issues && data.issues.length > 0) {
        var html = '<div class="issue-section-label">DIAGNOSE AN ISSUE</div>';
        html += '<div class="issue-items">';
        for (var i = 0; i < data.issues.length; i++) {
          var issue = data.issues[i];
          html += '<div class="issue-item" data-issue-id="' + escHtml(issue.id) + '" onclick="PortalUI.selectDrillIssue(' + i + ')">';
          html += '<span class="issue-name">' + escHtml(issue.label) + '</span>';
          if (issue.circuits) {
            html += '<span class="issue-count">' + issue.circuits.length + ' circuits</span>';
          }
          html += '</div>';
        }
        html += '</div>';
        issueSection.className = 'issue-section';
        issueSection.innerHTML = html;
        issueSection.style.display = 'block';
      } else {
        issueSection.innerHTML = '';
        issueSection.style.display = 'none';
      }
    }

    // Update stats
    var nodeCount = document.getElementById('nodeCount');
    if (nodeCount) {
      var count = data.activations ? data.activations.length : 0;
      var depthNum = drillStack.length + 3;
      nodeCount.textContent = count + ' L' + depthNum + ' NODES';
    }
  }

  function selectDrillNode(idx) {
    if (!currentDrillData || !currentDrillData.activations) return;
    var act = currentDrillData.activations[idx];
    if (!act) return;

    // Clear any active issue on canvas
    Engine.clearIssue();

    // Highlight in left panel
    var items = document.querySelectorAll('.dx-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', parseInt(items[i].getAttribute('data-drill-idx')) === idx);
    }

    // Show activation detail in right panel
    var detail = document.getElementById('nodeDeepDive');
    if (!detail) return;
    var empty = document.getElementById('rightEmpty');
    var content = document.getElementById('interventionContent');
    if (empty) empty.style.display = 'none';
    if (content) content.style.display = 'none';
    detail.style.display = 'block';

    var html = buildDrillBreadcrumb(currentDrillData.title || currentDrillData.domainId);

    // ── Analyst Context Bar (drill view) ──
    var _dctxDomain = config.domainId ? config.domainId.split('_')[0] : '';
    var _dctxPortal = currentDrillData.title || currentDrillData.domainId || '';
    var _dctxStress = null;
    if (typeof window !== 'undefined' && window.LIMENDomains && window.LIMENDomains[_dctxDomain]) {
      _dctxStress = window.LIMENDomains[_dctxDomain].stress;
    }
    var _dctxPath = [];
    for (var _pi = 0; _pi < drillStack.length; _pi++) _dctxPath.push(drillStack[_pi].label);
    _dctxPath.push(currentDrillData.title || currentDrillData.domainId || '');
    html += buildContextBar({
      domain: _dctxDomain,
      portal: _dctxPortal,
      diagnosis: null,
      node: act.domainLabel || act.brainNodeId,
      brainId: act.brainNodeId,
      directives: (act.treatments && act.treatments.length) || 0,
      stress: _dctxStress,
      drillDepth: drillStack.length,
      path: _dctxPath
    });

    html += '<div class="nd-header">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
    html += '<div>';
    html += '<div class="nd-label">' + escHtml(act.domainLabel || act.brainNodeId) + '</div>';
    html += '<div class="nd-brain">' + escHtml(act.brainNodeId || '') + '</div>';
    if (act.phase) {
      var phex = Constants.PHASE_COLORS[act.phase] || '#78788C';
      var tagline = Constants.PHASE_TAGLINES ? (Constants.PHASE_TAGLINES[act.phase] || '') : '';
      html += '<div class="nd-phase" style="color:' + phex + '">' + act.phase + ' \u00b7 ' + tagline + '</div>';
    }
    html += '</div>';
    html += '<button class="ndd-close" onclick="PortalUI.clearSelection()">\u2715</button>';
    html += '</div></div><hr class="nd-divider">';

    if (act.group) {
      html += '<div class="nd-section"><div class="nd-section-label">GROUP</div>';
      html += '<div class="nd-group">' + escHtml(act.group.toUpperCase().replace(/_/g, ' ')) + '</div></div>';
    }
    if (act.domainDescription) {
      html += '<div class="nd-section"><div class="nd-section-label">DESCRIPTION</div>';
      html += '<div class="nd-desc">' + escHtml(act.domainDescription) + '</div></div>';
    }
    // Companies
    if (act.companies && act.companies.length > 0) {
      html += '<div class="nd-section"><div class="nd-section-label">COMPANIES</div>';
      html += '<div class="l6-companies">';
      for (var c = 0; c < act.companies.length; c++) {
        var co = act.companies[c];
        html += '<span class="l6-company">' + escHtml(co.name);
        if (co.ticker_or_id && co.ticker_or_id !== 'private') html += ' (' + escHtml(co.ticker_or_id) + ')';
        html += '</span>';
      }
      html += '</div></div>';
    }
    // Treatments
    if (act.treatments && act.treatments.length > 0) {
      html += '<div class="nd-section"><div class="nd-section-label">INTERVENTIONS (' + act.treatments.length + ')</div>';
      for (var t = 0; t < act.treatments.length; t++) {
        var tx = act.treatments[t];
        html += '<div class="l6-tx">';
        html += '<div class="l6-tx-head"><span class="l6-tx-ev">' + escHtml(tx.evidence || '?') + '</span><span class="l6-tx-type">' + escHtml(tx.type || '') + '</span></div>';
        html += '<div class="l6-tx-label">' + escHtml(tx.label) + '</div>';
        if (tx.description) html += '<div class="l6-node-desc">' + escHtml(tx.description) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }
    // Phase convergence for leaf nodes
    if (!act.childPortal) {
      var convPhase = act.phase_archetype || act.phase || null;
      if (convPhase) {
        var cpx = Constants.PHASE_COLORS[convPhase] || '#78788C';
        var cpTag = Constants.PHASE_TAGLINES ? (Constants.PHASE_TAGLINES[convPhase] || '') : '';
        html += '<div class="l6-phase-convergence">';
        html += '<div class="l6-conv-label">PHASE CONVERGENCE</div>';
        html += '<div class="l6-conv-phase" style="color:' + cpx + '">' + convPhase + '</div>';
        if (cpTag) html += '<div class="l6-conv-tagline" style="color:' + cpx + '">' + escHtml(cpTag) + '</div>';
        if (act.functional_role) {
          html += '<div class="l6-conv-role">' + escHtml(act.functional_role.replace(/_/g, ' ').toUpperCase()) + '</div>';
        }
        html += '</div>';
      }
    }
    // DRILL DEEPER — navigate into more specific supporting layers
    console.log('[DrillDebug] selectDrillNode childPortal check:', act.brainNodeId, 'raw:', act.childPortal, 'truthy:', !!act.childPortal);
    if (act.childPortal) {
      var childDomainId = resolveDomainId(act.childPortal);
      console.log('[DrillDebug] DRILL DEEPER button rendering:', 'raw:', act.childPortal, '→ resolved:', childDomainId);
      html += '<button class="nd-portal-link" onclick="PortalUI.drillDown(\'' + escHtml(childDomainId) + '\', \'' + escHtml(act.domainLabel || act.brainNodeId) + '\')">DRILL DEEPER \u2192</button>';
    }

    detail.innerHTML = html;
    detail.scrollTop = 0;
    _applyCollapsibleSections(detail, 'drill', (currentDrillData.domainId || '') + ':' + act.brainNodeId);
  }

  function selectDrillIssue(idx) {
    if (!currentDrillData || !currentDrillData.issues) return;
    var issue = currentDrillData.issues[idx];
    if (!issue) return;

    // Highlight in left panel
    var items = document.querySelectorAll('.issue-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', i === idx);
    }
    var nodeItems = document.querySelectorAll('.dx-item');
    for (var i = 0; i < nodeItems.length; i++) nodeItems[i].classList.remove('active');

    // Activate issue circuits on canvas
    Engine.selectIssue(issue);

    // Build a dx-like object from the drill-level issue
    var circuits = (issue.circuits || []).map(function(c) {
      var nodeName = c.nodeId;
      // Try to find label from activations
      if (currentDrillData.activations) {
        for (var a = 0; a < currentDrillData.activations.length; a++) {
          if (currentDrillData.activations[a].brainNodeId === c.nodeId) {
            nodeName = currentDrillData.activations[a].domainLabel || c.nodeId;
            break;
          }
        }
      }
      return { node: c.nodeId, dir: c.dir, detail: c.detail || '', evidence: c.evidence || 'C', displayName: nodeName };
    });

    // Show issue summary in right panel
    var detail = document.getElementById('nodeDeepDive');
    if (!detail) return;
    var empty = document.getElementById('rightEmpty');
    var content = document.getElementById('interventionContent');
    if (empty) empty.style.display = 'none';
    if (content) content.style.display = 'none';
    detail.style.display = 'block';

    var html = '<div class="nd-header">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
    html += '<div>';
    html += '<div class="nd-label">' + escHtml(issue.label) + '</div>';
    html += '<div class="nd-brain">' + circuits.length + ' circuits</div>';
    html += '</div>';
    html += '<button class="ndd-close" onclick="PortalUI.clearSelection()">\u2715</button>';
    html += '</div></div><hr class="nd-divider">';

    if (issue.summary || issue.description) {
      html += '<div class="nd-section"><div class="nd-section-label">SUMMARY</div>';
      html += '<div class="nd-desc">' + escHtml(issue.summary || issue.description) + '</div></div>';
    }

    if (circuits.length > 0) {
      html += '<div class="nd-section"><div class="nd-section-label">AFFECTED CIRCUITS</div>';
      for (var ci = 0; ci < circuits.length; ci++) {
        var c = circuits[ci];
        var dirLabel = c.dir === 'hyper' ? '\u2191 HYPER' : c.dir === 'hypo' ? '\u2193 HYPO' : '\u223C ALTERED';
        html += '<div class="l6-node" style="padding:8px 0">';
        html += '<div class="l6-node-label">' + escHtml(c.displayName) + '</div>';
        html += '<span class="l6-node-group">' + dirLabel + '</span>';
        if (c.detail) html += '<div class="l6-node-desc">' + escHtml(c.detail) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    detail.innerHTML = html;
    detail.scrollTop = 0;
  }

  function drillBack() {
    var detail = document.getElementById('nodeDeepDive');
    if (!detail || drillStack.length === 0) return;
    var prev = drillStack.pop();
    detail.innerHTML = prev.html;
    detail.scrollTop = prev.scrollTop;
    restoreLeftPanel(prev);
  }

  function drillBackTo(stackIndex) {
    var detail = document.getElementById('nodeDeepDive');
    if (!detail || stackIndex < 0 || stackIndex >= drillStack.length) return;
    // Restore to the state at stackIndex, discard everything above
    var target = drillStack[stackIndex];
    drillStack.length = stackIndex;
    detail.innerHTML = target.html;
    detail.scrollTop = target.scrollTop;
    restoreLeftPanel(target);
  }

  // Legacy alias
  function l6Back() { drillBack(); }

  // ═══ PORTAL REPORT ═══
  // Synthesizes current portal activity into an analyst snapshot.
  // Renders into #nodeDeepDive as an alternate right-panel state.

  function _injectEmptyStateIntelligence() {
    var empty = document.getElementById('rightEmpty');
    if (!empty || !DATA) return;
    // Only inject once
    if (empty.querySelector('.nd-empty-intel')) return;

    var topDomain = config.domainId ? config.domainId.split('_')[0] : '';
    var domData = (typeof window !== 'undefined' && window.LIMENDomains && window.LIMENDomains[topDomain]) ? window.LIMENDomains[topDomain] : null;
    var feedState = (typeof window !== 'undefined' && window.LIMENFeedState) ? window.LIMENFeedState.getState() : null;

    var html = '<div style="text-align:center;margin-bottom:8px;font-size:0.3rem;letter-spacing:1.5px;color:rgba(200,195,184,0.18)">RECURSIVE REGULATION ENGINE</div>';

    // LIVE badge — shows the portal is reading the current snapshot, not frozen structure.
    if (typeof window !== 'undefined' && window._portalLiveAt) {
      var _ageMin = Math.max(0, Math.round((Date.now() - window._portalLiveAt) / 60000));
      var _ageTxt = _ageMin < 1 ? 'just now' : _ageMin + 'm ago';
      html += '<div style="text-align:center;margin-bottom:8px;font-size:0.38rem;letter-spacing:1.5px;color:rgba(90,181,160,0.7)">● LIVE · updated ' + _ageTxt + '</div>';
    }

    // Opportunity context handoff
    if (config.opportunityContext && config.opportunityContext.title) {
      var oc = config.opportunityContext;
      html += '<div style="margin-bottom:12px;padding:6px 10px;background:rgba(90,181,160,0.04);border:1px solid rgba(90,181,160,0.12);border-radius:3px;text-align:left">';
      html += '<div style="font-size:0.38rem;letter-spacing:1.5px;color:rgba(90,181,160,0.6);margin-bottom:2px">FROM OPPORTUNITY</div>';
      html += '<div style="font-size:0.48rem;color:#e8e3d9">' + escHtml(oc.title) + '</div>';
      if (oc.type) html += '<div style="font-size:0.38rem;color:#888;margin-top:1px">' + escHtml(oc.type.toUpperCase()) + ' \u00b7 Explore this domain\u2019s nodes and treatments below</div>';
      html += '</div>';
    }

    // Domain stress + feed state
    if (domData) {
      var stress = domData.stress || 0;
      var sc = stress > 0.65 ? 'var(--hyper,#e85454)' : stress > 0.4 ? 'var(--altered,#d4a84a)' : 'var(--hypo,#4a8fd4)';
      var trend = domData.trend || 0;
      var tw = trend > 0.02 ? '\u2191' : trend < -0.02 ? '\u2193' : '\u2192';
      var feedTag = feedState ? ' \u00b7 feeds ' + feedState : '';
      var statusTag = domData.status ? ' \u00b7 ' + domData.status : '';
      html += '<div style="text-align:center;margin-bottom:6px">';
      html += '<span style="color:' + sc + '">' + escHtml(topDomain.charAt(0).toUpperCase() + topDomain.slice(1)) + ' stress ' + stress.toFixed(2) + ' ' + tw + '</span>';
      html += '<span style="color:var(--text-ghost)">' + statusTag + feedTag + '</span>';
      html += '</div>';
    } else if (feedState) {
      html += '<div style="text-align:center;margin-bottom:6px"><span style="color:var(--text-ghost)">Feeds: ' + feedState.toUpperCase() + '</span></div>';
    }

    // Top signal
    if (domData && domData.signals && domData.signals.length > 0) {
      var sig = domData.signals[0];
      var sigText = typeof sig === 'string' ? sig : (sig.label || sig.text || '');
      if (sigText) html += '<div style="text-align:center;margin-bottom:6px"><span style="color:var(--text-ghost)">\u26A0 ' + escHtml(sigText) + '</span></div>';
    }

    // Top activated nodes for this domain (compact list)
    var activations = DATA.activations || [];
    if (activations.length > 0) {
      html += '<div style="text-align:left;margin-top:10px;padding-top:8px;border-top:1px solid rgba(201,169,78,0.06)">';
      html += '<div style="font-size:0.38rem;letter-spacing:1.5px;color:rgba(201,169,78,0.4);margin-bottom:4px">TOP NODES (' + activations.length + ' active)</div>';
      // Show top 5 by weight
      var sorted = activations.slice().sort(function(a,b) { return (b.weight||0) - (a.weight||0); });
      for (var si = 0; si < Math.min(sorted.length, 5); si++) {
        var act = sorted[si];
        html += '<div style="font-size:0.44rem;padding:2px 0;display:flex;justify-content:space-between">';
        html += '<span style="color:#bbb">' + escHtml(act.brainNodeId) + ' <span style="color:#888">' + escHtml(act.domainLabel || '') + '</span></span>';
        if (act.group) html += '<span style="color:#555;font-size:0.36rem">' + escHtml(act.group) + '</span>';
        html += '</div>';
      }
      if (activations.length > 5) html += '<div style="font-size:0.36rem;color:#555;margin-top:2px">+ ' + (activations.length - 5) + ' more \u2014 click nodes to explore</div>';
      html += '</div>';
    }

    // Top issues (diagnosis context)
    var issues = DATA.issues || [];
    if (issues.length > 0) {
      html += '<div style="text-align:left;margin-top:8px;padding-top:6px;border-top:1px solid rgba(201,169,78,0.06)">';
      html += '<div style="font-size:0.38rem;letter-spacing:1.5px;color:rgba(201,169,78,0.4);margin-bottom:4px">DIAGNOSES (' + issues.length + ')</div>';
      for (var ii = 0; ii < Math.min(issues.length, 3); ii++) {
        var iss = issues[ii];
        html += '<div style="font-size:0.42rem;padding:2px 0;color:#bbb">' + escHtml(iss.label || iss.id) + '</div>';
      }
      if (issues.length > 3) html += '<div style="font-size:0.36rem;color:#555;margin-top:2px">+ ' + (issues.length - 3) + ' more \u2014 use issue selector on left</div>';
      html += '</div>';
    }

    // Real-world mapping from Node Translation Layer (optional)
    if (typeof window !== 'undefined' && window.LIMENNodeTranslation && activations.length > 0) {
      var ntlNodeIds = activations.slice(0, 8).map(function(a) { return a.brainNodeId; });
      var ntlBiz = window.LIMENNodeTranslation.getBusinessesForNodes(ntlNodeIds);
      var ntlSectors = window.LIMENNodeTranslation.getSectorsForNodes(ntlNodeIds);
      if (ntlBiz.length > 0 || ntlSectors.length > 0) {
        html += '<div style="text-align:left;margin-top:8px;padding-top:6px;border-top:1px solid rgba(201,169,78,0.06)">';
        html += '<div style="font-size:0.38rem;letter-spacing:1.5px;color:rgba(201,169,78,0.4);margin-bottom:4px">REAL-WORLD MAPPING</div>';
        if (ntlBiz.length > 0) html += '<div style="font-size:0.42rem;color:#bbb;margin-bottom:2px">' + ntlBiz.slice(0, 4).join(' \u00b7 ') + '</div>';
        if (ntlSectors.length > 0) html += '<div style="font-size:0.38rem;color:#666">' + ntlSectors.slice(0, 4).join(' \u00b7 ') + '</div>';
        html += '</div>';
      }
    }

    // Top recommendation (highest evidence treatment)
    var topTx = null;
    var bestEv = 99;
    for (var ai = 0; ai < activations.length; ai++) {
      var txList = activations[ai].treatments || [];
      for (var ti = 0; ti < txList.length; ti++) {
        var evRank = _evOrder[txList[ti].evidence] !== undefined ? _evOrder[txList[ti].evidence] : 9;
        if (evRank < bestEv) { bestEv = evRank; topTx = txList[ti]; }
      }
    }
    if (topTx) {
      html += '<div style="text-align:center;margin-top:10px;padding-top:6px;border-top:1px solid rgba(201,169,78,0.06)">';
      html += '<span style="color:var(--gold-dim);font-size:0.46rem">\u2605 ' + escHtml(topTx.label) + '</span>';
      if (topTx.evidence) html += ' <span style="color:var(--text-ghost);font-size:0.4rem">(' + escHtml(topTx.evidence) + ')</span>';
      html += '</div>';
    }

    if (!html) return;

    var div = document.createElement('div');
    div.className = 'nd-empty-intel';
    div.style.cssText = 'margin-top:16px;font-size:0.5rem;letter-spacing:0.8px;line-height:1.8';
    div.innerHTML = html;

    // Insert before the report button if it exists, otherwise append
    var reportBtn = empty.querySelector('.nd-portal-report-btn');
    if (reportBtn) {
      empty.insertBefore(div, reportBtn);
    } else {
      empty.appendChild(div);
    }
  }

  function _injectPortalReportButton() {
    var empty = document.getElementById('rightEmpty');
    if (!empty) return;
    // Only inject once
    if (empty.querySelector('.nd-portal-report-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'nd-portal-link nd-portal-report-btn';
    btn.style.marginTop = '20px';
    btn.textContent = 'PORTAL REPORT';
    btn.onclick = function() { showPortalReport(); };
    empty.appendChild(btn);
  }

  // ═══ BOTTOM COMMAND STRIP ═══
  var _bottomStripBound = false;

  function _updateBottomStrip() {
    var el = document.getElementById('bottomStats');
    if (!el) return;

    var topDomain = config.domainId ? config.domainId.split('_')[0] : '';
    var activated = Engine.getActivatedNodes ? Engine.getActivatedNodes() : [];
    var EDGES = getEdgesCompat();
    var edgeCount = 0;
    for (var i = 0; i < EDGES.length; i++) { if (EDGES[i].isDomainEdge) edgeCount++; }

    var parts = [];
    parts.push(activated.length + ' NODES');
    parts.push(edgeCount + ' PATHWAYS');

    var domData = (typeof window !== 'undefined' && window.LIMENDomains && window.LIMENDomains[topDomain]) ? window.LIMENDomains[topDomain] : null;
    if (domData) {
      var stress = domData.stress || 0;
      var trend = domData.trend || 0;
      var arrow = trend > 0.02 ? '\u2191' : trend < -0.02 ? '\u2193' : '\u2192';
      var sc = stress > 0.65 ? 'var(--hyper,#e85454)' : stress > 0.4 ? 'var(--altered,#d4a84a)' : 'var(--hypo,#4a8fd4)';
      parts.push('<span style="color:' + sc + '">STRESS ' + stress.toFixed(2) + ' ' + arrow + '</span>');
    }

    var feedState = (typeof window !== 'undefined' && window.LIMENFeedState) ? window.LIMENFeedState.getState() : null;
    if (feedState) {
      var fc = feedState === 'hydrated' ? 'var(--hypo,#4a8fd4)' : feedState === 'degraded' ? 'var(--hyper,#e85454)' : 'var(--altered,#d4a84a)';
      parts.push('<span style="color:' + fc + '">' + feedState.toUpperCase() + '</span>');
    }

    if (domData && domData.updated) {
      var ago = Math.round((Date.now() - domData.updated) / 1000);
      parts.push(ago < 60 ? ago + 's' : Math.round(ago / 60) + 'm');
    }

    el.innerHTML = parts.join(' <span style="opacity:0.3">\u2502</span> ');

    // Bind live update listener once
    if (!_bottomStripBound) {
      _bottomStripBound = true;
      document.addEventListener('limen:domain-update', function() { _updateBottomStrip(); });
    }
  }

  function buildPortalReport() {
    var topDomain = config.domainId ? config.domainId.split('_')[0] : '';
    var portalTitle = (DATA && DATA.title) ? DATA.title : (config.parentLabel || topDomain);
    var activations = (DATA && DATA.activations) ? DATA.activations : [];
    var issues = (DATA && DATA.issues) ? DATA.issues : [];
    var domData = (typeof window !== 'undefined' && window.LIMENDomains && window.LIMENDomains[topDomain]) ? window.LIMENDomains[topDomain] : null;
    var feedState = (typeof window !== 'undefined' && window.LIMENFeedState) ? window.LIMENFeedState.getState() : null;

    // Pre-aggregate treatments for Recommended Actions + Top Directives
    var allTx = [];
    var _portalTriggers = [];
    for (var _rai = 0; _rai < activations.length; _rai++) {
      var _rtxList = activations[_rai].treatments || [];
      for (var _rti = 0; _rti < _rtxList.length; _rti++) allTx.push(_rtxList[_rti]);
      var _rtrigs = activations[_rai].diagnosticTriggers || [];
      for (var _rgi = 0; _rgi < _rtrigs.length; _rgi++) _portalTriggers.push(_rtrigs[_rgi]);
    }
    // Build trigger context — only apply LIVE boost if sufficient trigger coverage
    var _portalTrigSets = _portalTriggers.length >= 3 ? _buildTrigTokenSets(_portalTriggers) : [];
    _sortTreatments(allTx, _portalTrigSets);

    var isUrgent = domData && domData.stress > 0.65;

    var html = '';

    // Close button
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid var(--border)">';
    html += '<div style="font-size:0.5rem;letter-spacing:3px;color:var(--gold);text-transform:uppercase">PORTAL REPORT</div>';
    html += '<button class="ndd-close" onclick="PortalUI.clearSelection()">\u2715</button>';
    html += '</div>';

    html += _renderRecommendedActions(allTx, isUrgent);

    // ── Portal Summary ──
    html += '<div class="nd-section"><div class="nd-section-label">PORTAL SUMMARY</div>';
    html += '<div class="nd-desc">';
    html += '<strong style="color:var(--gold-dim)">' + escHtml(portalTitle) + '</strong>';
    html += ' \u00b7 ' + escHtml(topDomain.toUpperCase()) + ' DOMAIN';
    html += '</div>';
    var activated = Engine.getActivatedNodes ? Engine.getActivatedNodes() : [];
    html += '<div class="nd-edge" style="display:flex;justify-content:space-between">';
    html += '<span>Active nodes</span><span style="color:var(--gold-dim)">' + activated.length + ' / 111</span>';
    html += '</div>';
    html += '<div class="nd-edge" style="display:flex;justify-content:space-between">';
    html += '<span>Diagnoses available</span><span style="color:var(--gold-dim)">' + issues.length + '</span>';
    html += '</div>';
    html += '<div class="nd-edge" style="display:flex;justify-content:space-between">';
    html += '<span>Total activations</span><span style="color:var(--gold-dim)">' + activations.length + '</span>';
    html += '</div>';
    html += '</div>';

    // ── Stress & Signals ──
    html += '<div class="nd-section"><div class="nd-section-label">STRESS &amp; SIGNALS</div>';
    if (domData) {
      var stress = domData.stress || 0;
      var trend = domData.trend || 0;
      var trendArrow = trend > 0.02 ? '\u2191' : trend < -0.02 ? '\u2193' : '\u2192';
      var trendWord = trend > 0.02 ? 'RISING' : trend < -0.02 ? 'FALLING' : 'STABLE';
      var sc = stress > 0.65 ? 'var(--hyper,#e85454)' : stress > 0.4 ? 'var(--altered,#d4a84a)' : 'var(--hypo,#4a8fd4)';
      html += '<div class="nd-edge" style="display:flex;justify-content:space-between">';
      html += '<span>Domain stress</span><span style="color:' + sc + '">' + stress.toFixed(2) + ' ' + trendArrow + ' ' + trendWord + '</span>';
      html += '</div>';
      if (domData.confidence) {
        html += '<div class="nd-edge" style="display:flex;justify-content:space-between">';
        html += '<span>Confidence</span><span style="color:var(--text-ghost)">' + (domData.confidence * 100).toFixed(0) + '%</span>';
        html += '</div>';
      }
      var signals = domData.signals || [];
      if (signals.length > 0) {
        for (var si = 0; si < Math.min(signals.length, 5); si++) {
          html += '<div style="font-size:0.55rem;color:var(--text-dim);padding:2px 0">';
          html += '\u26A0 ' + escHtml(typeof signals[si] === 'string' ? signals[si] : (signals[si].label || signals[si].text || ''));
          html += '</div>';
        }
      }
    } else {
      html += '<div class="nd-why" style="color:var(--text-ghost)">No live feed data available</div>';
    }
    if (feedState) {
      var fc = feedState === 'hydrated' ? 'var(--hypo,#4a8fd4)' : feedState === 'degraded' ? 'var(--hyper,#e85454)' : 'var(--altered,#d4a84a)';
      html += '<div class="nd-edge" style="display:flex;justify-content:space-between;margin-top:4px">';
      html += '<span>Feed status</span><span style="color:' + fc + ';font-size:0.5rem;letter-spacing:1px">' + feedState.toUpperCase() + '</span>';
      html += '</div>';
    }
    html += '</div>';

    // ── Active Diagnoses ──
    if (issues.length > 0) {
      html += '<div class="nd-section"><div class="nd-section-label">ACTIVE DIAGNOSES (' + issues.length + ')</div>';
      for (var di = 0; di < issues.length; di++) {
        var iss = issues[di];
        var circuitCount = (iss.circuits && iss.circuits.length) || 0;
        html += '<div class="nd-edge" style="display:flex;justify-content:space-between">';
        html += '<span>' + escHtml(iss.label || iss.id) + '</span>';
        html += '<span style="color:var(--text-ghost);font-size:0.5rem">' + circuitCount + ' circuits</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    html += _renderDirectivesList(allTx, 'TOP DIRECTIVES', 10);
    html += _renderInstitutions(activations, 'KEY INSTITUTIONS', 20);

    // ── Cross-Domain Exposure ──
    if (CROSS_DOMAIN_MAP) {
      var exposedDomains = {};
      for (var xi = 0; xi < activated.length; xi++) {
        var nodeId = activated[xi].node ? activated[xi].node.id : null;
        if (!nodeId) continue;
        var cdEntries = CROSS_DOMAIN_MAP[nodeId];
        if (!cdEntries) continue;
        for (var xj = 0; xj < cdEntries.length; xj++) {
          var xd = cdEntries[xj].domain;
          if (xd === topDomain) continue;
          if (!exposedDomains[xd]) exposedDomains[xd] = { label: cdEntries[xj].label, count: 0 };
          exposedDomains[xd].count++;
        }
      }
      var exposedKeys = Object.keys(exposedDomains);
      if (exposedKeys.length > 0) {
        exposedKeys.sort(function(a, b) { return exposedDomains[b].count - exposedDomains[a].count; });
        html += '<div class="nd-section"><div class="nd-section-label">CROSS-DOMAIN EXPOSURE (' + exposedKeys.length + ' domains)</div>';
        for (var ek = 0; ek < Math.min(exposedKeys.length, 12); ek++) {
          var ed = exposedDomains[exposedKeys[ek]];
          html += '<div class="nd-edge" style="display:flex;justify-content:space-between">';
          html += '<span>' + escHtml(ed.label) + '</span>';
          html += '<span style="color:var(--text-ghost);font-size:0.5rem">' + ed.count + ' shared nodes</span>';
          html += '</div>';
        }
        html += '</div>';
      }
    }

    // Timestamp
    html += '<div style="padding:12px 20px;font-size:0.4rem;color:var(--text-ghost);letter-spacing:1px;text-align:right">';
    html += 'GENERATED ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    html += '</div>';

    return html;
  }

  function showPortalReport() {
    drillStack = [];
    currentDrillData = null;
    Engine.deselect();
    var empty = document.getElementById('rightEmpty');
    var content = document.getElementById('interventionContent');
    var detail = document.getElementById('nodeDeepDive');
    if (empty) empty.style.display = 'none';
    if (content) content.style.display = 'none';
    if (detail) { detail.style.display = 'block'; detail.innerHTML = buildPortalReport(); detail.scrollTop = 0; }
    // Clear node highlights
    var items = document.querySelectorAll('.dx-item');
    for (var i = 0; i < items.length; i++) items[i].classList.remove('active');
  }

  function clearSelection() {
    drillStack = []; // reset drill navigation
    currentDrillData = null;
    Engine.deselect();
    var empty = document.getElementById('rightEmpty');
    var content = document.getElementById('interventionContent');
    var detail = document.getElementById('nodeDeepDive');
    if (empty) empty.style.display = '';
    if (content) content.style.display = 'none';
    if (detail) detail.style.display = 'none';
    var items = document.querySelectorAll('.dx-item');
    for (var i = 0; i < items.length; i++) items[i].classList.remove('active');
  }

  // ═══ SEARCH (issues + nodes) ═══
  function filterNodes() {
    var input = document.getElementById('searchInput');
    if (!input) return;
    var query = input.value.toLowerCase().trim();

    // Filter issue items
    var issueItems = document.querySelectorAll('.issue-item');
    for (var i = 0; i < issueItems.length; i++) {
      var item = issueItems[i];
      var name = item.querySelector('.issue-name');
      var nameText = name ? name.textContent.toLowerCase() : '';
      item.style.display = (!query || nameText.indexOf(query) >= 0) ? '' : 'none';
    }

    // Filter node items
    var items = document.querySelectorAll('.dx-item');
    var categories = document.querySelectorAll('.dx-category');
    var catVis = {};
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var name = item.querySelector('.dx-name');
      var brain = item.querySelector('.dx-brain');
      var nameText = name ? name.textContent.toLowerCase() : '';
      var brainText = brain ? brain.textContent.toLowerCase() : '';
      var show = !query || nameText.indexOf(query) >= 0 || brainText.indexOf(query) >= 0;
      item.style.display = show ? '' : 'none';
      var cat = item.closest('.dx-category');
      if (cat) { var g = cat.getAttribute('data-group'); if (!catVis[g]) catVis[g] = false; if (show) catVis[g] = true; }
    }
    for (var i = 0; i < categories.length; i++) {
      var g = categories[i].getAttribute('data-group');
      categories[i].style.display = catVis[g] ? '' : 'none';
    }
  }

  function toggleCategory(el) {
    el.parentElement.classList.toggle('collapsed');
  }

  // ═══ 3D TOGGLE (matches clinical.html toggle3DBrain) ═══
  function toggle3D() {
    if (typeof ConnectomeCore === 'undefined') return;
    var canvas2d = document.getElementById('connectome-canvas');
    ConnectomeCore.Brain3D.toggle(canvas2d);
    var btn = document.getElementById('brain3dToggle');
    var hint = document.getElementById('brain3dHint');
    var state = ConnectomeCore.Brain3D.getState();
    if (btn) {
      if (state.active) {
        btn.classList.add('active');
        btn.innerHTML = '<span class="toggle-icon">\u25CE</span> 2D';
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '<span class="toggle-icon">\uD83E\uDDE0</span> 3D';
      }
    }
    if (hint) {
      if (state.active) {
        hint.classList.add('visible');
        setTimeout(function() { hint.classList.remove('visible'); }, 4000);
      } else {
        hint.classList.remove('visible');
      }
    }
    currentView = state.active ? '3d' : '2d';
  }

  // ═══ CIRCUIT LEGEND (matches clinical.html static legend) ═══
  function buildCircuitLegend() {
    var legend = document.getElementById('phaseLegend');
    if (!legend) return;
    var items = [
      {label: 'HYPER', color: '#e85454'},
      {label: 'HYPO', color: '#4a8fd4'},
      {label: 'ALTERED', color: '#d4a84a'},
      {label: 'INACTIVE', color: 'rgba(255,255,255,0.15)'},
      {label: 'PATHWAYS', color: 'rgba(180,200,220,0.4)'}
    ];
    var html = '';
    for (var i = 0; i < items.length; i++) {
      html += '<div class="legend-item"><div class="legend-dot" style="background:' + items[i].color + '"></div>' + items[i].label + '</div>';
    }
    legend.innerHTML = html;
  }

  // ═══ STATE PERSISTENCE ═══

  function _savePortalSelection(nodeId) {
    if (!window.LIMENUIState) return;
    var fields = {
      selectedIssueId: activeIssueId || null,
      focusDomain: config ? config.domainId : null
    };
    if (nodeId !== undefined) fields.selectedNodeId = nodeId;
    window.LIMENUIState.save(fields);
  }

  function _restorePortalSelection() {
    if (!window.LIMENUIState || !DATA) return;
    var saved = window.LIMENUIState.restore({ samePageType: true });
    if (!saved) return;
    // Restore issue first (takes visual priority)
    if (saved.selectedIssueId && DATA.issues) {
      for (var i = 0; i < DATA.issues.length; i++) {
        if (DATA.issues[i].id === saved.selectedIssueId) {
          toggleIssue(saved.selectedIssueId);
          return; // issue selection implies node context
        }
      }
    }
    // Restore selected node if no issue
    if (saved.selectedNodeId) {
      var nodes = getNodeArray();
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].id === saved.selectedNodeId) {
          selectNodeFromList(j);
          return;
        }
      }
    }
  }

  // Connect the static portal to the LIVE layer. The intel block already renders
  // domain stress + signals from window.LIMENDomains, but portal pages never load
  // a snapshot to populate it — so it stayed dormant (frozen structure only). Fetch
  // the live domain-snapshot once, populate window.LIMENDomains (with portal→runtime
  // dual-key aliases), stamp the refresh time, and re-render the intel block.
  function _loadLiveContext() {
    if (typeof fetch === 'undefined') return;
    var opts = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? { signal: AbortSignal.timeout(8000) } : {};
    try {
      // Read the CACHED console snapshot (Redis-backed, no feed rebuild, no paid
      // Tavily call) — not /api/domain-snapshot, which can trigger a live build.
      fetch('/api/limen-snapshot?type=console', opts)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (snap) {
          if (!snap || !snap.domains) return;
          var doms = snap.domains;
          var ALIAS = { science: 'research', medicine: 'health', trade: 'supplyChain' };
          for (var pk in ALIAS) { if (doms[ALIAS[pk]] && !doms[pk]) doms[pk] = doms[ALIAS[pk]]; }
          // console snapshot carries a single topSignal string, not a signals[] array
          for (var dk in doms) { if (doms[dk] && doms[dk].topSignal && !doms[dk].signals) doms[dk].signals = [doms[dk].topSignal]; }
          window.LIMENDomains = doms;
          window._portalLiveAt = snap.generatedAt || (snap.meta && snap.meta.fetchedAt) || Date.now();
          // re-render the intel block now that live data exists
          try {
            var empty = document.getElementById('rightEmpty');
            if (empty) { var old = empty.querySelector('.nd-empty-intel'); if (old) old.parentNode.removeChild(old); }
            _injectEmptyStateIntelligence();
            // now that a live domain level exists, upgrade the open dx's reading
            _refreshOpenDx();
          } catch (e) {}
        })
        .catch(function () {});
    } catch (e) {}
  }

  // === PUBLIC API ===
  return {
    init: function(cfg) {
      config = cfg;

      // Connect this portal to the live layer (async; re-renders intel when ready)
      _loadLiveContext();

      // Load the canonical node registry; when ready, (a) re-synthesize any
      // activation-derived issue list now that non-nodes can be skipped, and
      // (b) upgrade the open dx from baked text to the live (feed x motif) reading.
      _loadCanon().then(function () {
        if (DATA && DATA._issuesSynthetic) {
          DATA.issues = null; DATA._issuesSynthetic = false;
          _ensureIssues(DATA);
          try { buildIssueSelector(); } catch (e) {}
        }
        _refreshOpenDx();
      });

      // Build circuit legend
      buildCircuitLegend();

      // Bind search
      var searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.addEventListener('input', filterNodes);

      // Bind 3D toggle
      var btn3d = document.getElementById('brain3dToggle');
      if (btn3d) btn3d.addEventListener('click', toggle3D);

      // Hide hint initially
      var hint = document.getElementById('brain3dHint');
      if (hint) hint.style.display = 'none';

      // Init canvas engine
      Engine.init({
        canvas: 'connectome-canvas',
        canvasId: 'connectome-canvas',
        onNodeClick: function(node, idx, pos) {
          console.log('[PortalUI] onNodeClick — node:', node ? node.id : 'null', 'idx:', idx, 'activated:', node ? node.activated : 'n/a');
          if (!node) {
            if (!activeIssueId) clearSelection();
            return;
          }
          if (idx === undefined || idx === null) {
            var nodeList = getNodeArray();
            for (var i = 0; i < nodeList.length; i++) {
              if (nodeList[i] === node) { idx = i; break; }
            }
          }
          if (activeIssueId) {
            if (node && node.affected) {
              highlightListItem(idx);
              showNodeDetail(node, idx);
            }
            return;
          }
          if (node && node.activated) {
            highlightListItem(idx);
            showNodeDetail(node, idx);
          } else {
            clearSelection();
          }
        },
        onNodeHover: function(node) {
          // No tooltip on hover (matches clinical.html — tooltip on click only)
        }
      });

      // Init 3D brain if ConnectomeCore available
      if (typeof ConnectomeCore !== 'undefined' && typeof THREE !== 'undefined') {
        ConnectomeCore.Brain3D.init({
          containerId: 'brain3dContainer',
          getSelectedIssue: function() {
            if (!activeIssueId || !DATA || !DATA.issues) return null;
            for (var i = 0; i < DATA.issues.length; i++) {
              if (DATA.issues[i].id === activeIssueId) return DATA.issues[i];
            }
            return null;
          }
        });
      }

      // Load base brain connectome, then activation map
      // Load cross-domain map (non-blocking, used by showNodeDetail)
      if (!CROSS_DOMAIN_MAP) {
        fetch('assets/data/brain-node-domains.json')
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(map) { if (map) CROSS_DOMAIN_MAP = map; })
          .catch(function() {});
      }

      Engine.loadBase('assets/data/brain-connectome.json', function() {
        var activationUrl = 'assets/data/domains/' + config.domainId + '.json';
        console.log('[PortalUI] loadActivation starting:', activationUrl);
        Engine.loadActivation(activationUrl, function(err, actData) {
          // ConnectomeCore.Canvas passes (err, data), ConnectomeRenderer passes (data)
          if (actData === undefined && err && typeof err === 'object' && !err.message) {
            actData = err; // ConnectomeRenderer style: callback(data)
          }
          console.log('[PortalUI] loadActivation callback — actData?', !!actData, 'err?', err ? (err.message || 'object') : 'none');
          if (actData) {
            DATA = actData;
            // Harvest domain JSON into remedy registry if available
            if (window.LIMENRemedyRegistryManager && typeof window.LIMENRemedyRegistryManager.harvestFromPortal === 'function') {
              try {
                var _harvestCount = window.LIMENRemedyRegistryManager.harvestFromPortal(actData, { portalUrl: 'assets/data/domains/' + config.domainId + '.json' });
                if (_harvestCount > 0) console.log('[PortalUI] Registry harvested ' + _harvestCount + ' treatments from domain JSON');
              } catch (e) { console.warn('[PortalUI] Registry harvest error:', e); }
            }
            var activated = Engine.getActivatedNodes ? Engine.getActivatedNodes() : [];
            console.log('[PortalUI] activated nodes:', activated.length, 'DATA.activations:', (actData.activations||[]).length);
            _ensureIssues(DATA);   // synthesize issues from activations if none authored
            buildNodeList();
            buildIssueSelector();
            _injectEmptyStateIntelligence();
            _injectPortalReportButton();
            _restorePortalSelection();
          } else {
            // Direct JSON 404 — fall back to serverless proxy for L3+ data
            console.log('[PortalUI] static JSON failed, trying API proxy');
            fetch('/api/fetch-portal?domainId=' + encodeURIComponent(config.domainId))
              .then(function(r) { return r.ok ? r.json() : null; })
              .then(function(proxyData) {
                console.log('[PortalUI] API proxy result:', proxyData ? (proxyData.activations||[]).length + ' activations' : 'null');
                if (proxyData) {
                  if (Engine.applyActivation) Engine.applyActivation(proxyData);
                  DATA = proxyData;
                  _ensureIssues(DATA);   // synthesize issues from activations if none authored
                  // Harvest into registry if available
                  if (window.LIMENRemedyRegistryManager && typeof window.LIMENRemedyRegistryManager.harvestFromPortal === 'function') {
                    try { window.LIMENRemedyRegistryManager.harvestFromPortal(proxyData, { portalUrl: '/api/fetch-portal?domainId=' + config.domainId }); } catch (e) {}
                  }
                  buildNodeList();
                  buildIssueSelector();
                  _injectEmptyStateIntelligence();
                  _injectPortalReportButton();
                  _restorePortalSelection();
                }
              })
              .catch(function(e) { console.error('[PortalUI] API proxy failed:', e); });
          }
        });
      });
    },

    // Expose for onclick handlers
    selectNodeFromList: selectNodeFromList,
    toggleCategory: toggleCategory,
    filterNodes: filterNodes,
    clearSelection: clearSelection,
    toggleIssue: toggleIssue,
    toggle3D: toggle3D,
    switchTab: switchTab,
    switchWorkflow: switchWorkflow,
    toggleIntItem: toggleIntItem,
    updateSeverity: updateSeverity,
    setLang: setLang,
    savePktSelection: savePktSelection,
    updatePacketCount: updatePacketCount,
    getSelectedInterventions: getSelectedInterventions,
    printSnapshot: printSnapshot,
    showPortalReport: showPortalReport,
    showDrillLevelReport: showDrillLevelReport,
    closeDrillLevelReport: closeDrillLevelReport,
    toggleSection: toggleSection,
    printPatientPacket: printPatientPacket,
    generateSOAP: generateSOAP,
    copyToEMR: copyToEMR,
    copyToClipboard: copyToEMR,
    drillDown: drillDown,
    drillDownL6: drillDownL6,
    drillBack: drillBack,
    drillBackTo: drillBackTo,
    selectDrillNode: selectDrillNode,
    selectDrillIssue: selectDrillIssue,
    l6Back: l6Back
  };
})();

// ═══ GLOBAL FUNCTION REGISTRATION ═══
// Expose functions on window so onclick handlers in dynamic HTML match clinical.html exactly
window.switchWorkflow = function(p) { PortalUI.switchWorkflow(p); };
window.switchTab = function(c) { PortalUI.switchTab(c); };
window.toggleIntItem = function(el) { PortalUI.toggleIntItem(el); };
window.updateSeverity = function() { PortalUI.updateSeverity(); };
window.setLang = function(m) { PortalUI.setLang(m); };
window.savePktSelection = function(cb) { PortalUI.savePktSelection(cb); };
window.updatePacketCount = function() { PortalUI.updatePacketCount(); };
window.getSelectedInterventions = function() { return PortalUI.getSelectedInterventions(); };
window.printPatientPacket = function() { PortalUI.printPatientPacket(); };
window.generateSOAP = function() { PortalUI.generateSOAP(); };
window.copyToEMR = function() { PortalUI.copyToEMR(); };
window.printSnapshot = function() { PortalUI.printSnapshot(); };
// Overlay close stubs (no monograph data for agriculture, but prevents errors)
window.closeDrugOverlay = function() { var o = document.getElementById('drugOverlay'); if(o) o.classList.remove('open'); };
window.closeTherapyOverlay = function() { var o = document.getElementById('therapyOverlay'); if(o) o.classList.remove('open'); };
window.closeSomaticOverlay = function() { var o = document.getElementById('somaticOverlay'); if(o) o.classList.remove('open'); };
window.closeSupplementOverlay = function() { var o = document.getElementById('supplementOverlay'); if(o) o.classList.remove('open'); };
window.closeNutritionOverlay = function() { var o = document.getElementById('nutritionOverlay'); if(o) o.classList.remove('open'); };
