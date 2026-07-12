/**
 * observatory-ui.js — Civilization Opportunity Observatory UI
 *
 * Render layer for /civilization-opportunities. Subscribes to the
 * pure-aggregation surface (window.LIMENObservatory) and triggers the
 * lazy deep-proof loader (window.LIMENObservatoryDeepProof) only on
 * explicit user click.
 *
 * Network discipline:
 *   - Issues NO HTTP requests directly.
 *   - Reads packets synchronously from the aggregator.
 *   - Calls LIMENObservatoryDeepProof.load(diagnosisId) ONLY inside a
 *     click handler — never on render, never on subscription.
 *   - Never references /api/fetch-portal or any portal route.
 *
 * Loaded by: civilization-opportunities.html
 * Replaces: the inline UI bootstrap that shipped in Commit A.
 */
(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────────
  var _activeLane = 'ALL';
  var _searchTerm = '';
  var _expandedDomains = {};      // domainId -> true
  var _expandedDeep = {};         // packetId -> true (deep-proof panel shown)

  // Proof state persistence. Survives every render() call so that an
  // expanded Deep Proof panel does not disappear when the aggregator
  // re-emits packets (5s poll, brain-update events, lane/search changes).
  // Keyed by packet id. Each entry: { kind, data?, packet, diagnosisId }
  // kinds: 'pending' | 'loaded' | 'fallback' | 'transient' | 'no-loader'
  var _proofStateById = {};

  // ─── DOM refs (resolved on init) ────────────────────────────────────────
  var statusEl, emptyEl, domainsEl, searchEl;

  // ─── Helpers ────────────────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtPct(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 'n/a';
    return Math.round(n * 100) + '%';
  }

  function fmtConf(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 'n/a';
    // Brain output uses 0..100 directly for confidence.
    return Math.round(n) + (n > 1 ? '' : '%');
  }

  function laneClass(path) {
    return 'lane-' + (path || 'UNCLASSIFIED').replace(/[^A-Za-z0-9_-]/g, '-');
  }

  // Look up a packet by id from current aggregator output. Used when a
  // Deep Proof click needs the full packet (for fallback rendering) but
  // only the card id is on the button DOM.
  function _findPacketById(id) {
    if (!window.LIMENObservatory) return null;
    var packets = window.LIMENObservatory.getPackets() || [];
    for (var i = 0; i < packets.length; i++) {
      if (packets[i].id === id) return packets[i];
    }
    return null;
  }

  // Inject styles for the new fallback-proof and section UI without
  // editing civilization-opportunities.html. Safe to call repeatedly;
  // a uniquely-IDed <style> tag is added once.
  function _ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('obs-ui-styles')) return;
    var style = document.createElement('style');
    style.id = 'obs-ui-styles';
    style.textContent = [
      '.obs-deep-fallback-intro{color:rgba(212,168,74,0.78);margin-top:4px;font-size:0.42rem;line-height:1.55}',
      '.obs-deep-section{margin-top:8px;padding-top:6px;border-top:1px solid rgba(201,169,78,0.08)}',
      '.obs-deep-section-title{font-size:0.36rem;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,78,0.55);margin-bottom:3px}',
      '.obs-deep-row{font-size:0.40rem;color:rgba(200,195,184,0.65);padding:1px 0;line-height:1.55}',
      '.obs-deep-row b{color:rgba(232,227,217,0.78);font-weight:normal;letter-spacing:0.5px}',
      '.obs-deep-list{margin-left:14px;margin-top:2px;font-size:0.38rem;color:rgba(200,195,184,0.55)}',
      '.obs-deep-list li{padding:1px 0}',
      '.obs-deep-warn b{color:rgba(232,84,84,0.85)}',
      '.obs-deep-falsify{color:rgba(232,84,84,0.65);font-style:italic}',
      '.obs-deep-missing{color:rgba(212,168,74,0.55);font-style:italic;font-size:0.38rem}',

      /* Patch C2 — Coming Next row (visibly demoted, plain text, not buttons) */
      '.obs-art-coming{margin-top:6px;padding:4px 0 2px;font-size:0.36rem;color:rgba(200,195,184,0.42);letter-spacing:0.4px;line-height:1.5;opacity:0.78;cursor:default;-webkit-user-select:none;user-select:none}',
      '.obs-art-coming-label{font-size:0.32rem;letter-spacing:1.5px;text-transform:uppercase;color:rgba(201,169,78,0.4);margin-right:4px}',
      '.obs-art-coming-item{color:rgba(200,195,184,0.5);font-style:italic}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /**
   * Lane filter matching. Brains today emit path ∈
   * { PATENTABLE, GRANT-ELIGIBLE, INVESTABLE, BUSINESS, LOAN/INFRASTRUCTURE }.
   * Research / Regulatory / Operator-Work-Order lanes are derived heuristically
   * from domain + source until upstream emission categorizes them directly.
   * Heuristic mappings are documented so the rule is auditable.
   */
  function matchesLane(packet, lane) {
    if (lane === 'ALL') return true;
    var path = packet.path || '';
    var paths = packet.paths || [];

    // Direct path lanes (brain-emitted)
    if (lane === 'PATENTABLE' || lane === 'GRANT-ELIGIBLE' ||
        lane === 'INVESTABLE' || lane === 'BUSINESS' ||
        lane === 'LOAN/INFRASTRUCTURE') {
      return path === lane || paths.indexOf(lane) !== -1;
    }

    // RESEARCHABLE — the relaned research path the brains actually emit (the
    // filter button uses this name; the old 'RESEARCH' heuristic below never
    // matched it, so the Research lane read empty despite many matches).
    if (lane === 'RESEARCHABLE') {
      return path === 'RESEARCHABLE' || paths.indexOf('RESEARCHABLE') !== -1;
    }

    // Derived lanes
    if (lane === 'RESEARCH') {
      // Heuristic: research-eligible grants tend to emerge from science/
      // research/medicine/environment/education domains.
      var researchDomains = { research: 1, science: 1, medicine: 1, environment: 1, education: 1 };
      return (path === 'GRANT-ELIGIBLE' || paths.indexOf('GRANT-ELIGIBLE') !== -1)
        && !!researchDomains[packet.domain];
    }
    if (lane === 'REGULATORY') {
      // Heuristic: regulatory packets surface in law / governance / finance.
      var regDomains = { law: 1, governance: 1, finance: 1, communication: 1 };
      return !!regDomains[packet.domain];
    }
    if (lane === 'OPERATOR') {
      // Heuristic: operator work-orders surface as lagging / BUSINESS opps.
      return packet.source === 'lagging' || path === 'BUSINESS';
    }

    return false;
  }

  function passesFilter(packet) {
    if (!matchesLane(packet, _activeLane)) return false;
    if (_searchTerm) {
      var t = _searchTerm.toLowerCase();
      var hay = (packet.title || '') + ' ' + (packet.domain || '') + ' ' + (packet.rawDomain || '') + ' ' + (packet.diagnosisId || '');
      if (hay.toLowerCase().indexOf(t) === -1) return false;
    }
    return true;
  }

  function groupByDomain(packets) {
    var groups = {};
    for (var i = 0; i < packets.length; i++) {
      var p = packets[i];
      if (!passesFilter(p)) continue;
      var d = p.domain || 'unknown';
      if (!groups[d]) groups[d] = [];
      groups[d].push(p);
    }
    return groups;
  }

  // ─── Card rendering ─────────────────────────────────────────────────────
  function renderCard(p) {
    var laneCls = laneClass(p.path);
    var urgency = (p.urgency || '').toUpperCase();
    var why = p.whyNow || '';
    var explain = p.explain || '';
    var action = p.action || '';
    var deepShown = !!_expandedDeep[p.id];

    var html = '<div class="obs-card" data-id="' + escHtml(p.id) + '">';

    // Header row
    html += '<div class="obs-card-head">';
    html += '<span class="obs-card-lane ' + laneCls + '">' + escHtml(p.path) + '</span>';
    html += '<span class="obs-card-title">' + escHtml(p.title) + '</span>';
    if (urgency) html += '<span class="obs-card-urgency ' + escHtml(urgency) + '">' + escHtml(urgency) + '</span>';
    html += '</div>';

    // Meta row
    html += '<div class="obs-card-meta">';
    html += '<b>domain:</b> ' + escHtml(p.domain) + ' &middot; ';
    html += '<b>tier:</b> ' + escHtml(String(p.tier || '?')) + ' &middot; ';
    html += '<b>conf:</b> ' + fmtConf(p.confidence) + ' &middot; ';
    html += '<b>stress:</b> ' + fmtPct(p.stress);
    if (p.diagnosisId) html += ' &middot; <b>dx:</b> ' + escHtml(p.diagnosisId);
    if (p.source) html += ' &middot; <b>src:</b> ' + escHtml(p.source);
    html += '</div>';

    // Narrative blocks
    if (why && why !== p.title) html += '<div class="obs-card-why">' + escHtml(why) + '</div>';
    if (explain) html += '<div class="obs-card-explain">' + escHtml(explain) + '</div>';
    if (action) html += '<div class="obs-card-action">&rsaquo; ' + escHtml(action) + '</div>';
    if (p.valueRange) html += '<div class="obs-card-meta"><b>value:</b> ' + escHtml(p.valueRange) + (p.window ? ' &middot; <b>window:</b> ' + escHtml(p.window) : '') + '</div>';

    // Tools row — Deep Proof + WIRED artifact buttons (Patent, Grant, SBA).
    // Patch C2: Investment Memo / Research Outline / Send to Master Brain
    // were demoted to a separate "Coming Next" row below, since they are
    // not wired to a generator or endpoint. Showing them as active buttons
    // misled the manager into thinking the click would do something.
    html += '<div class="obs-card-tools">';
    if (p.diagnosisId) {
      html += '<button class="obs-deep-btn" data-deep="' + escHtml(p.diagnosisId) + '" data-card="' + escHtml(p.id) + '">' +
              (deepShown ? '&#9660;' : '&#9654;') + ' Deep Proof</button>';
    }
    // Retired lanes removed (patent/grant/sba). Standing rule: investment + research
    // ONLY. The brains already relane GRANT->INVESTABLE / PATENT->RESEARCHABLE.
    html += '</div>';

    // Coming Next row — visibly demoted. Plain text spans, NOT buttons.
    // No data-art attribute, so handleArtifactClick is never reached for
    // these. The handler still has defensive fallback behavior in case
    // a stale DOM (older cached page) calls it with invest/research/master.
    html += '<div class="obs-art-coming">' +
            '<span class="obs-art-coming-label">COMING NEXT:</span> ' +
            '<span class="obs-art-coming-item">Investment Memo</span> &middot; ' +
            '<span class="obs-art-coming-item">Research Outline</span> &middot; ' +
            '<span class="obs-art-coming-item">Send to Master Brain</span>' +
            '</div>';

    // Deep proof panel — content is rendered declaratively from
    // _proofStateById so an expanded panel survives every render() call
    // (5s soft-poll, brain-update events, filter changes).
    var panelInner = '';
    if (deepShown) {
      panelInner = renderDeepProofContent(p, _proofStateById[p.id]);
    }
    html += '<div class="obs-deep-panel' + (deepShown ? ' shown' : '') + '" id="deep-' + escHtml(p.id) + '">' + panelInner + '</div>';

    // Artifact notice slot
    html += '<div class="obs-art-notice" id="art-' + escHtml(p.id) + '"></div>';

    html += '</div>';
    return html;
  }

  function render() {
    if (!domainsEl) return;
    var packets = window.LIMENObservatory ? window.LIMENObservatory.getPackets() : [];
    var status = window.LIMENObservatory ? window.LIMENObservatory.getStatus() : { ready: false, brainCount: 0, packetCount: 0 };

    if (statusEl) {
      statusEl.textContent =
        'brains: ' + status.brainCount +
        ' · packets: ' + status.packetCount +
        ' · updated: ' + (status.lastUpdate ? new Date(status.lastUpdate).toLocaleTimeString() : '-');
    }

    var groups = groupByDomain(packets);
    var domainKeys = Object.keys(groups).sort();

    if (domainKeys.length === 0) {
      domainsEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.style.display = 'block';
        if (status.brainCount === 0) {
          emptyEl.innerHTML = 'Brains warming up; waiting for domain packets.<div class="obs-empty-sub">first cycle completes in ~30 seconds</div>';
        } else if (packets.length === 0) {
          emptyEl.innerHTML = 'Brains running but no opportunities have surfaced yet.<div class="obs-empty-sub">opportunities surface as diagnoses activate; check back after a feed cycle</div>';
        } else {
          emptyEl.innerHTML = 'No opportunities match the current filter.<div class="obs-empty-sub">clear search or switch lane</div>';
        }
      }
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    var html = '';
    for (var di = 0; di < domainKeys.length; di++) {
      var d = domainKeys[di];
      var ps = groups[d];
      var expanded = !!_expandedDomains[d];
      html += '<div class="obs-domain-group' + (expanded ? ' expanded' : '') + '" data-domain="' + escHtml(d) + '">';
      html += '<div class="obs-domain-head" data-domain-toggle="' + escHtml(d) + '">';
      html += '<span class="obs-domain-arrow">' + (expanded ? '&#9660;' : '&#9654;') + '</span>';
      html += '<span class="obs-domain-name">' + escHtml(d) + '</span>';
      html += '<span class="obs-domain-count">' + ps.length + ' opportunit' + (ps.length === 1 ? 'y' : 'ies') + '</span>';
      html += '</div>';
      html += '<div class="obs-domain-body">';
      if (expanded) {
        for (var pi = 0; pi < ps.length; pi++) html += renderCard(ps[pi]);
      }
      html += '</div></div>';
    }
    domainsEl.innerHTML = html;
  }

  // ─── Deep-proof panel rendering (lazy, state-driven) ────────────────────

  /**
   * State-driven dispatcher. Returns HTML string for the panel content
   * based on the proof state for a packet. Pure function — no DOM
   * mutation, no fetch, no side effects. Re-runs every render() so an
   * expanded panel always has its current state visible.
   */
  function renderDeepProofContent(packet, state) {
    if (!state) {
      // Defensive: panel is open but no state yet. Should be rare because
      // handleDeepProofClick sets state before triggering render. Use the
      // fallback-proof view since it works without any fetch.
      return renderFallbackProof(packet);
    }
    if (state.kind === 'pending') {
      return '<div class="obs-deep-status">Loading large deep proof for ' +
        escHtml(state.diagnosisId || (packet && packet.diagnosisId) || '') + '&hellip;</div>';
    }
    if (state.kind === 'no-loader') {
      return '<div class="obs-deep-status">Deep proof loader not available</div>' +
        renderFallbackProof(packet);
    }
    if (state.kind === 'transient') {
      return '<div class="obs-deep-status">Deep proof unavailable (transient)</div>' +
        '<div class="obs-deep-fallback">Network or server hiccup. Click Deep Proof again in a moment.</div>' +
        renderFallbackProof(packet);
    }
    if (state.kind === 'loaded') {
      return renderLoadedProof(packet, state.data);
    }
    if (state.kind === 'fallback') {
      return renderFallbackProof(packet);
    }
    return renderFallbackProof(packet);
  }

  /**
   * Aggregated-deep-file render. Summarizes treatments, evidence grades,
   * citations, and shows a top-5 preview.
   */
  function renderLoadedProof(packet, data) {
    var treatments = (data && data.treatments) || [];
    var n = treatments.length;
    var gradeCounts = {};
    var citeCount = 0;
    var stepCount = 0;
    for (var i = 0; i < treatments.length; i++) {
      var t = treatments[i];
      var g = t && t.evidence ? String(t.evidence) : '?';
      gradeCounts[g] = (gradeCounts[g] || 0) + 1;
      if (t && (t.cite || (t.citation && t.citation.length))) citeCount++;
      if (t && t.steps && t.steps.length) stepCount++;
    }
    var gradeBlock = '';
    var gradeKeys = Object.keys(gradeCounts).sort();
    for (var gi = 0; gi < gradeKeys.length; gi++) {
      var k = gradeKeys[gi];
      gradeBlock += '<span class="obs-deep-grade">' + escHtml(k) + ':' + gradeCounts[k] + '</span> ';
    }
    var preview = '';
    for (var pi = 0; pi < Math.min(5, treatments.length); pi++) {
      var tt = treatments[pi];
      var label = (tt && tt.label) || '(untitled)';
      var ev = (tt && tt.evidence) || '';
      preview += '<div class="obs-deep-treatment"><b>[' + escHtml(ev) + ']</b> ' + escHtml(label) + '</div>';
    }
    if (treatments.length > 5) {
      preview += '<div class="obs-deep-treatment-more">&hellip; and ' + (treatments.length - 5) + ' more treatments</div>';
    }
    var loader = window.LIMENObservatoryDeepProof;
    var cacheStatus = loader ? loader.getStatus() : { cacheSize: 0, cacheCap: 2 };
    var dx = (packet && packet.diagnosisId) || '';
    return '<div class="obs-deep-status">Deep proof for ' + escHtml(dx) + ' &mdash; LOADED</div>' +
      '<div class="obs-deep-meta">' +
      '<b>treatments:</b> ' + n + ' &middot; ' +
      '<b>with citations:</b> ' + citeCount + ' &middot; ' +
      '<b>with steps:</b> ' + stepCount + ' &middot; ' +
      '<b>cache:</b> ' + cacheStatus.cacheSize + '/' + cacheStatus.cacheCap +
      '</div>' +
      '<div class="obs-deep-grades">' + gradeBlock + '</div>' +
      '<div class="obs-deep-treatments">' + preview + '</div>';
  }

  /**
   * Fallback proof — packet-level evidence assembled from the brain's
   * own output (no network, no aggregated file required). Replaces the
   * prior "NOT AGGREGATED" stub. Uses every relevant field on the
   * packet so the user sees the full diagnosis context, playbook
   * fields, money chain, validity, falsification rule, and an explicit
   * note about which evidence is missing.
   */
  function renderFallbackProof(packet) {
    if (!packet) {
      return '<div class="obs-deep-fallback">Packet data unavailable.</div>';
    }
    var html = '';
    html += '<div class="obs-deep-status">Packet-level proof</div>';
    html += '<div class="obs-deep-fallback-intro">Aggregated deep file unavailable; showing live packet proof instead.</div>';

    // Diagnosis context
    html += '<div class="obs-deep-section">';
    html += '<div class="obs-deep-section-title">Diagnosis context</div>';
    html += '<div class="obs-deep-row"><b>domain:</b> ' + escHtml(packet.domain) + '</div>';
    html += '<div class="obs-deep-row"><b>lane:</b> ' + escHtml(packet.path) + '</div>';
    if (packet.diagnosisId) html += '<div class="obs-deep-row"><b>diagnosis id:</b> ' + escHtml(packet.diagnosisId) + '</div>';
    if (packet.tier) html += '<div class="obs-deep-row"><b>tier:</b> ' + escHtml(String(packet.tier)) + '</div>';
    html += '<div class="obs-deep-row"><b>confidence:</b> ' + fmtConf(packet.confidence) + '</div>';
    html += '<div class="obs-deep-row"><b>stress:</b> ' + fmtPct(packet.stress) + '</div>';
    if (packet.source) html += '<div class="obs-deep-row"><b>source:</b> ' + escHtml(packet.source) + '</div>';
    if (packet.urgency) html += '<div class="obs-deep-row"><b>urgency:</b> ' + escHtml(packet.urgency) + '</div>';
    html += '</div>';

    // Brain narrative
    if (packet.whyNow || packet.explain || packet.action) {
      html += '<div class="obs-deep-section">';
      html += '<div class="obs-deep-section-title">Brain narrative</div>';
      if (packet.whyNow && packet.whyNow !== packet.title) html += '<div class="obs-deep-row"><b>why now:</b> ' + escHtml(packet.whyNow) + '</div>';
      if (packet.explain) html += '<div class="obs-deep-row"><b>explain:</b> ' + escHtml(packet.explain) + '</div>';
      if (packet.action) html += '<div class="obs-deep-row"><b>action:</b> ' + escHtml(packet.action) + '</div>';
      html += '</div>';
    }

    // Playbook fields
    var pkbFields = [];
    if (packet.valueRange) pkbFields.push(['value range', packet.valueRange]);
    if (packet.window) pkbFields.push(['window', packet.window]);
    if (packet.trigger) pkbFields.push(['trigger', packet.trigger]);
    if (packet.validation) pkbFields.push(['validation', packet.validation]);
    if (packet.outcome) pkbFields.push(['outcome', packet.outcome]);
    if (packet.failure) pkbFields.push(['failure', packet.failure]);
    if (pkbFields.length > 0) {
      html += '<div class="obs-deep-section">';
      html += '<div class="obs-deep-section-title">Playbook</div>';
      for (var pf = 0; pf < pkbFields.length; pf++) {
        html += '<div class="obs-deep-row"><b>' + escHtml(pkbFields[pf][0]) + ':</b> ' + escHtml(pkbFields[pf][1]) + '</div>';
      }
      html += '</div>';
    }

    // Money chain
    if (packet.moneyChain) {
      var mc = packet.moneyChain;
      html += '<div class="obs-deep-section">';
      html += '<div class="obs-deep-section-title">Money chain</div>';
      if (mc.doThis) html += '<div class="obs-deep-row"><b>do this:</b> ' + escHtml(mc.doThis) + '</div>';
      if (mc.whyPays) html += '<div class="obs-deep-row"><b>why pays:</b> ' + escHtml(mc.whyPays) + '</div>';
      if (mc.target) html += '<div class="obs-deep-row"><b>target:</b> ' + escHtml(mc.target) + '</div>';
      if (mc.timing) html += '<div class="obs-deep-row"><b>timing:</b> ' + escHtml(mc.timing) + '</div>';
      if (mc.evidence) html += '<div class="obs-deep-row"><b>evidence:</b> ' + escHtml(mc.evidence) + '</div>';
      if (mc.nextStep) html += '<div class="obs-deep-row"><b>next step:</b> ' + escHtml(mc.nextStep) + '</div>';
      html += '</div>';
    }

    // Validity
    if (packet.validity) {
      var v = packet.validity;
      html += '<div class="obs-deep-section">';
      html += '<div class="obs-deep-section-title">Validity</div>';
      if (v.expiryWindowDays != null) html += '<div class="obs-deep-row"><b>expiry window:</b> ' + escHtml(String(v.expiryWindowDays)) + ' days</div>';
      if (v.requiresRevalidation) html += '<div class="obs-deep-row obs-deep-warn"><b>requires revalidation:</b> yes</div>';
      if (v.invalidationReasons && v.invalidationReasons.length) {
        html += '<div class="obs-deep-row"><b>invalidation reasons:</b><ul class="obs-deep-list">';
        for (var ir = 0; ir < v.invalidationReasons.length; ir++) {
          html += '<li>' + escHtml(v.invalidationReasons[ir]) + '</li>';
        }
        html += '</ul></div>';
      }
      html += '</div>';
    }

    // Falsification — pulled from moneyChain.invalidIf or validity reasons
    var falsify = (packet.moneyChain && packet.moneyChain.invalidIf) ||
      (packet.validity && packet.validity.invalidationReasons && packet.validity.invalidationReasons.length
        ? packet.validity.invalidationReasons.join('; ')
        : '');
    html += '<div class="obs-deep-section">';
    html += '<div class="obs-deep-section-title">Falsification condition</div>';
    if (falsify) {
      html += '<div class="obs-deep-row obs-deep-falsify">' + escHtml(falsify) + '</div>';
    } else {
      html += '<div class="obs-deep-row obs-deep-fallback">No explicit falsification rule emitted by brain for this opportunity.</div>';
    }
    html += '</div>';

    // Missing evidence
    html += '<div class="obs-deep-section">';
    html += '<div class="obs-deep-section-title">Missing evidence</div>';
    html += '<div class="obs-deep-row obs-deep-missing">Aggregated deep file not available at /assets/data/aggregated/' + escHtml(packet.diagnosisId || '?') + '.deep.json &mdash; treatment library, evidence grades, and citation set would normally live there. Only ~6 diagnoses currently have aggregated deep files; the rest fall through to this packet-level proof until aggregation runs.</div>';
    html += '</div>';

    return html;
  }

  /**
   * Click handler — state-driven so render() is the single source of
   * truth for panel content. After every state change we call render(),
   * which rebuilds DOM and re-applies the latest proof state for any
   * expanded packet. Panels survive subsequent aggregator/event-driven
   * re-renders because the state map persists across them.
   *
   * Network discipline: this is the ONLY place where
   * LIMENObservatoryDeepProof.load() is invoked. Never on render, never
   * on subscription, never on boot.
   */
  function handleDeepProofClick(btn) {
    var dx = btn.getAttribute('data-deep');
    var cardId = btn.getAttribute('data-card');
    if (!dx || !cardId) return;

    // Toggle close — keep state cached so re-expand is instant.
    if (_expandedDeep[cardId]) {
      _expandedDeep[cardId] = false;
      render();
      return;
    }

    var packet = _findPacketById(cardId);
    var loader = window.LIMENObservatoryDeepProof;

    // Open the panel. State decides what gets rendered.
    _expandedDeep[cardId] = true;

    // If we already have terminal state for this id (loaded / fallback /
    // transient / no-loader), keep it — re-expansion shows immediately
    // without another fetch.
    var existing = _proofStateById[cardId];
    if (existing && (existing.kind === 'loaded' || existing.kind === 'fallback' || existing.kind === 'no-loader')) {
      // Refresh stored packet reference in case fields changed.
      existing.packet = packet || existing.packet;
      render();
      return;
    }

    if (!loader) {
      _proofStateById[cardId] = { kind: 'no-loader', packet: packet, diagnosisId: dx };
      render();
      return;
    }

    // Pending state — render() will show the loading message.
    _proofStateById[cardId] = { kind: 'pending', packet: packet, diagnosisId: dx };
    render();

    loader.load(dx).then(function (data) {
      // The packet might have been refreshed by aggregator; pick up the
      // current version when we transition out of pending.
      var freshPacket = _findPacketById(cardId) || packet;
      var nextState;
      if (data) {
        nextState = { kind: 'loaded', data: data, packet: freshPacket, diagnosisId: dx };
      } else if (loader.isMissing(dx)) {
        nextState = { kind: 'fallback', packet: freshPacket, diagnosisId: dx };
      } else {
        nextState = { kind: 'transient', packet: freshPacket, diagnosisId: dx };
      }
      _proofStateById[cardId] = nextState;
      // Re-render whether or not the panel is still open — collapsed
      // panels are cheap and the state cache is now warm for re-open.
      render();
    });
  }

  // ─── Artifact buttons ───────────────────────────────────────────────────
  // Patch D1A: Patent / Grant / SBA buttons call window.LIMENExecGenerator
  // (defined in assets/js/ui/console-clarity.js) which dispatches to the
  // same private generators the Capital Conversion tab uses. Unsupported
  // lanes (Investment, Research, Send to Master Brain) remain honest stubs
  // with manager-readable wording — no API calls, no fake success states.

  // Build opp.implementations from real packet fields (Patch D2-B).
  // Closes the first artifact-depth bottleneck by passing available packet
  // content into the existing Patent / Grant / SBA template generators,
  // which already expect an array of strings joined by '; '. No invented
  // content. Missing fields are simply omitted. Capped at 8 entries.
  // Deduped by lowercase row text. Generator templates are NOT modified —
  // richer wording / claim re-grounding / evidence-anchor blocks remain
  // D2-C territory.
  function buildImplementations(packet) {
    if (!packet || typeof packet !== 'object') return [];
    var rows = [];
    var seen = {};

    function normalize(value) {
      if (Array.isArray(value)) return value.filter(Boolean).join('; ');
      if (value && typeof value === 'object') return '';
      return String(value == null ? '' : value).trim();
    }

    function add(label, value) {
      var text = normalize(value);
      if (!text) return;
      var row = label + ': ' + text;
      var key = row.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      rows.push(row);
    }

    var mc = packet.moneyChain || {};
    add('Action',       packet.action);
    add('Do this',      mc.doThis);
    add('Trigger',      packet.trigger);
    add('Validation',   packet.validation);
    add('Next step',    mc.nextStep);
    add('Evidence',     mc.evidence);
    add('Outcome',      packet.outcome);
    add('Failure mode', packet.failure);

    return rows.slice(0, 8);
  }

  // Translate an Observatory packet into the opp shape the generators
  // expect. Pure function — does NOT mutate the source packet and does
  // NOT write any global. Field map confirmed against source-read of
  // _generatePatent / _generateGrant / _generateLoan in console-clarity.js.
  function packetToOpp(p) {
    if (!p || typeof p !== 'object') return null;
    // Generators read opp.confidence as 0..1. Aggregator stores
    // packet.confidence as 0..100 (per observatory-aggregator.js shape).
    // Normalize defensively without changing the underlying packet.
    var confNorm = 0;
    if (typeof p.confidence === 'number' && isFinite(p.confidence)) {
      confNorm = p.confidence > 1 ? p.confidence / 100 : p.confidence;
      confNorm = Math.max(0, Math.min(1, confNorm));
    }
    return {
      id: p.id || '',
      domain: p.domain || '',
      // Generators use opp.indication for patent title and grant problem
      // statement. The closest semantic field on packets is diagnosisId
      // (e.g., "OIL_SHOCK"); whyNow / title are softer fallbacks.
      indication: p.diagnosisId || p.whyNow || p.title || '',
      // Patch D2-B: implementations now derived from real packet fields
      // (action, moneyChain.doThis, trigger, validation, nextStep,
      // evidence, outcome, failure) via buildImplementations(). Empty
      // array still produces the generators' built-in fallback strings.
      implementations: buildImplementations(p),
      stress: typeof p.stress === 'number' ? p.stress : 0,
      confidence: confNorm,
      exposedCompanies: Array.isArray(p.companies) ? p.companies : []
    };
  }

  function handleArtifactClick(btn) {
    var kind = btn.getAttribute('data-art');
    var cardId = btn.getAttribute('data-card');
    if (!kind || !cardId) return;
    var notice = document.getElementById('art-' + cardId);
    if (!notice) return;

    // Unsupported lanes — honest stubs, no API calls, no fake success.
    if (kind === 'invest' || kind === 'research') {
      notice.innerHTML = '<div class="obs-art-msg">Generator not yet implemented for this lane. Wired generators: Patent, Grant, SBA Loan.</div>';
      return;
    }
    if (kind === 'master') {
      notice.innerHTML = '<div class="obs-art-msg">Master Brain handoff endpoint not implemented yet. Queue visibility exists on /civilization; send action is not wired.</div>';
      return;
    }

    // Wired lanes — patent / grant / sba. Map data-art to the docType the
    // public API expects (sba → loan).
    var docType = null;
    if (kind === 'patent') docType = 'patent';
    else if (kind === 'grant') docType = 'grant';
    else if (kind === 'sba') docType = 'loan';
    else {
      // Defensive: any unknown data-art falls through to honest stub.
      notice.innerHTML = '<div class="obs-art-msg">Generator not yet implemented for this lane. Wired generators: Patent, Grant, SBA Loan.</div>';
      return;
    }

    if (!window.LIMENExecGenerator || typeof window.LIMENExecGenerator.fromOpportunity !== 'function') {
      notice.innerHTML = '<div class="obs-art-msg">Draft generator not available on this page yet.</div>';
      return;
    }

    var packet = _findPacketById(cardId);
    if (!packet) {
      notice.innerHTML = '<div class="obs-art-msg">Cannot draft: opportunity packet missing.</div>';
      return;
    }

    var opp = packetToOpp(packet);
    if (!opp) {
      notice.innerHTML = '<div class="obs-art-msg">Cannot draft: opportunity packet missing.</div>';
      return;
    }

    var ok = false;
    try {
      ok = window.LIMENExecGenerator.fromOpportunity(opp, docType);
    } catch (e) {
      try { console.warn('[Observatory] LIMENExecGenerator threw for ' + docType + ':', e && e.message); } catch (_) {}
      ok = false;
    }
    if (!ok) {
      notice.innerHTML = '<div class="obs-art-msg">Draft generator failed for this opportunity.</div>';
      try { console.warn('[Observatory] fromOpportunity returned false for ' + docType + ' on packet ' + cardId); } catch (e) {}
      return;
    }

    // Success: modal opened by LIMENExecGenerator. Clear any prior notice
    // so the inline area doesn't carry stale stub text.
    notice.innerHTML = '';
  }

  // ─── Event wiring ───────────────────────────────────────────────────────
  function wireEvents() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      // Lane filter
      if (t.classList && t.classList.contains('obs-lane-btn')) {
        _activeLane = t.getAttribute('data-lane') || 'ALL';
        var btns = document.querySelectorAll('.obs-lane-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i] === t);
        render();
        return;
      }

      // Domain group toggle
      var head = t.closest('[data-domain-toggle]');
      if (head) {
        var d = head.getAttribute('data-domain-toggle');
        _expandedDomains[d] = !_expandedDomains[d];
        render();
        return;
      }

      // Deep proof button (toggle, lazy load)
      if (t.classList && t.classList.contains('obs-deep-btn')) {
        handleDeepProofClick(t);
        return;
      }

      // Artifact buttons (inert placeholder)
      if (t.classList && t.classList.contains('obs-art-btn')) {
        handleArtifactClick(t);
        return;
      }
    });

    if (searchEl) {
      searchEl.addEventListener('input', function () {
        _searchTerm = this.value || '';
        render();
      });
    }
  }

  // ─── Init ───────────────────────────────────────────────────────────────
  function init() {
    _ensureStyles();

    statusEl = document.getElementById('obs-status-line');
    emptyEl = document.getElementById('obs-empty');
    domainsEl = document.getElementById('obs-domains');
    searchEl = document.getElementById('obs-search');

    wireEvents();

    if (window.LIMENObservatory) {
      window.LIMENObservatory.subscribe(render);
      render();
    } else {
      // Aggregator may load fractionally later. Poll briefly without
      // issuing any network requests.
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (window.LIMENObservatory) {
          clearInterval(iv);
          window.LIMENObservatory.subscribe(render);
          render();
        } else if (tries > 20) {
          clearInterval(iv);
          if (statusEl) statusEl.textContent = 'aggregator not loaded';
        }
      }, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
