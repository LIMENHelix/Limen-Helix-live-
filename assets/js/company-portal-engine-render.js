/**
 * company-portal-engine-render.js — surface bridge patterns + engine outputs.
 *
 * Hooks into CompanyPortalUI.renderCompany. After the original render runs,
 * appends two new sections:
 *   - BRIDGE PATTERNS (right panel) — matched neuro↔business mappings
 *   - ENGINE OUTPUTS (center panel) — patent / grant / investment / research
 *     artifacts in a tabbed reader. Replaces the placeholder.
 *
 * Reads portal.bridgeReadings and portal.engineOutputs. Skips silently when
 * either is absent (portal hasn't been bridged or engine-built yet).
 *
 * Load order: company-portal-ui.js must be loaded first, then this file.
 */
(function () {
  'use strict';
  if (!window.CompanyPortalUI || !window.CompanyPortalUI.renderCompany) {
    console.warn('[engine-render] CompanyPortalUI not loaded — engine sections will not appear.');
    return;
  }

  // ─── styles ───────────────────────────────────────────────────────
  var STYLES =
    '.cp-bridge-section{margin-top:14px}' +
    '.cp-bridge-title{font-size:0.38rem;letter-spacing:2.5px;color:rgba(201,169,78,0.55);text-transform:uppercase;margin-bottom:10px;padding-top:10px;border-top:1px solid rgba(201,169,78,0.08)}' +
    '.cp-bridge-card{padding:9px 12px;border:1px solid rgba(201,169,78,0.08);background:rgba(0,0,0,0.2);border-radius:3px;margin-bottom:6px;font-size:0.36rem;cursor:pointer}' +
    '.cp-bridge-card:hover{border-color:rgba(201,169,78,0.25)}' +
    '.cp-bridge-card.open{border-color:rgba(201,169,78,0.4);background:rgba(201,169,78,0.04)}' +
    '.cp-bridge-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}' +
    '.cp-bridge-region{font-size:0.4rem;letter-spacing:1.5px;color:#C9A94E;text-transform:uppercase}' +
    '.cp-bridge-conf{font-size:0.34rem;color:rgba(200,195,184,0.5)}' +
    '.cp-bridge-sig{font-size:0.32rem;color:rgba(200,195,184,0.55);margin-top:3px}' +
    '.cp-bridge-detail{display:none;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04);font-size:0.32rem;color:rgba(200,195,184,0.5);line-height:1.6}' +
    '.cp-bridge-card.open .cp-bridge-detail{display:block}' +
    '.cp-bridge-detail-row{display:flex;justify-content:space-between;padding:2px 0}' +
    '.cp-bridge-detail-row b{color:#e8e3d9;font-weight:normal}' +
    '.cp-bridge-indicators{margin-top:6px;color:rgba(90,181,160,0.7);font-size:0.3rem;letter-spacing:0.5px}' +

    '.cp-engine{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;padding:18px 22px;color:#e8e3d9;font-family:inherit;overflow:hidden}' +
    '.cp-engine-head{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-shrink:0}' +
    '.cp-engine-title{font-size:0.52rem;letter-spacing:3.5px;color:#C9A94E;text-transform:uppercase}' +
    '.cp-engine-summary{font-size:0.32rem;color:rgba(200,195,184,0.4);letter-spacing:1px}' +
    '.cp-engine-tabs{display:flex;gap:4px;margin-bottom:12px;flex-shrink:0;border-bottom:1px solid rgba(201,169,78,0.1);padding-bottom:0}' +
    '.cp-engine-tab{padding:6px 14px;cursor:pointer;font-size:0.36rem;letter-spacing:2px;color:rgba(200,195,184,0.45);border:none;background:none;font-family:inherit;text-transform:uppercase;border-bottom:2px solid transparent;margin-bottom:-1px}' +
    '.cp-engine-tab:hover{color:rgba(201,169,78,0.7)}' +
    '.cp-engine-tab.active{color:#C9A94E;border-bottom-color:#C9A94E}' +
    '.cp-engine-tab-count{font-size:0.3rem;color:rgba(200,195,184,0.3);margin-left:5px}' +
    '.cp-engine-body{flex:1;overflow-y:auto;padding-right:6px}' +
    '.cp-artifact{padding:14px 16px;border:1px solid rgba(201,169,78,0.1);background:rgba(0,0,0,0.25);border-radius:3px;margin-bottom:10px}' +
    '.cp-artifact-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;border-bottom:1px solid rgba(201,169,78,0.08);padding-bottom:6px}' +
    '.cp-artifact-pattern{font-size:0.32rem;letter-spacing:1.5px;color:rgba(201,169,78,0.55);text-transform:uppercase}' +
    '.cp-artifact-conf{font-size:0.32rem;color:rgba(200,195,184,0.45);letter-spacing:1px}' +
    '.cp-artifact-section{margin-bottom:10px}' +
    '.cp-artifact-section-label{font-size:0.3rem;letter-spacing:2px;color:rgba(200,195,184,0.35);text-transform:uppercase;margin-bottom:4px}' +
    '.cp-artifact-text{font-size:0.36rem;line-height:1.65;color:rgba(220,215,200,0.7);white-space:pre-wrap;font-family:inherit}' +
    '.cp-artifact-text.mono{font-family:"IBM Plex Mono",monospace;font-size:0.34rem}' +
    '.cp-claim{padding:8px 12px;border-left:2px solid rgba(201,169,78,0.25);margin-bottom:6px;background:rgba(0,0,0,0.15);font-size:0.34rem;line-height:1.6;color:rgba(220,215,200,0.65);font-family:"IBM Plex Mono",monospace;white-space:pre-wrap}' +
    '.cp-aim{padding:6px 10px;font-size:0.34rem;line-height:1.6;color:rgba(220,215,200,0.65);border-left:2px solid rgba(90,181,160,0.25);margin-bottom:4px}' +
    '.cp-engine-empty{padding:40px;text-align:center;color:rgba(200,195,184,0.25);font-size:0.4rem;letter-spacing:2px;text-transform:uppercase}' +
    '.cp-artifact-actions{display:flex;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04)}' +
    '.cp-artifact-actions button{font-size:0.32rem;color:rgba(201,169,78,0.6);padding:5px 10px;border:1px solid rgba(201,169,78,0.25);border-radius:2px;background:none;font-family:inherit;cursor:pointer;letter-spacing:1px;text-transform:uppercase}' +
    '.cp-artifact-actions button:hover{color:#C9A94E;border-color:rgba(201,169,78,0.6);background:rgba(201,169,78,0.05)}' +
    '.cp-artifact-actions button.print{color:#5ab5a0;border-color:rgba(90,181,160,0.35)}' +
    '.cp-artifact-actions button.print:hover{color:#5ab5a0;border-color:rgba(90,181,160,0.7);background:rgba(90,181,160,0.05)}' +
    '.cp-artifact-actions button.decline{color:#e85454;border-color:rgba(232,84,84,0.35)}' +
    '.cp-artifact-actions button.decline:hover{color:#e85454;border-color:rgba(232,84,84,0.7);background:rgba(232,84,84,0.05)}' +
    '.cp-artifact-actions button:disabled{opacity:0.4;cursor:default}' +
    '.cp-toast{position:fixed;bottom:20px;right:20px;padding:10px 16px;background:rgba(0,0,0,0.85);border:1px solid rgba(201,169,78,0.4);color:#e8e3d9;font-size:0.36rem;border-radius:3px;letter-spacing:1px;z-index:9999;display:none}' +
    '.cp-toast.show{display:block}' +
    '.cp-toast.ok{border-color:rgba(90,181,160,0.5)}' +
    '.cp-toast.err{border-color:rgba(232,84,84,0.5)}' +

    // Gate B v0.2 — PLACEHOLDER_CONTAMINATED suppression styles
    '.cp-v02-section-banner{margin:0 0 14px}' +
    '.cp-v02-card{padding:14px 16px;border:1px solid rgba(232,84,84,0.35);background:rgba(232,84,84,0.04);border-radius:3px;margin-bottom:10px}' +
    '.cp-v02-card-banner{font-size:0.4rem;line-height:1.7;color:rgba(232,180,180,0.95);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(232,84,84,0.2)}' +
    '.cp-v02-card-banner strong{letter-spacing:1.5px;color:#e85454;display:block;margin-bottom:4px}' +
    '.cp-v02-meta{display:grid;grid-template-columns:auto 1fr;column-gap:14px;row-gap:3px;font-size:0.34rem;color:rgba(220,215,200,0.55);margin-bottom:10px}' +
    '.cp-v02-meta .k{color:rgba(200,195,184,0.4);letter-spacing:1.5px;text-transform:uppercase;font-size:0.3rem;padding-top:2px}' +
    '.cp-v02-meta .v{color:#e8e3d9;font-family:"IBM Plex Mono",monospace;font-size:0.34rem;word-break:break-all}' +
    '.cp-v02-meta .v.state{color:#e85454}' +
    '.cp-v02-placeholders{margin-bottom:10px;padding:8px 10px;background:rgba(0,0,0,0.2);border-left:2px solid rgba(232,84,84,0.4);border-radius:2px}' +
    '.cp-v02-placeholders-label{font-size:0.3rem;letter-spacing:2px;color:rgba(232,180,180,0.55);text-transform:uppercase;margin-bottom:6px}' +
    '.cp-v02-placeholders-list code{display:inline-block;font-size:0.34rem;color:#e85454;background:rgba(232,84,84,0.08);padding:2px 6px;margin:2px 4px 2px 0;border:1px solid rgba(232,84,84,0.2);border-radius:2px;font-family:"IBM Plex Mono",monospace}' +
    '.cp-v02-raw-details{margin-top:8px;padding:6px 10px;border:1px dashed rgba(232,84,84,0.25);border-radius:2px;background:rgba(0,0,0,0.15)}' +
    '.cp-v02-raw-details>summary{cursor:pointer;font-size:0.3rem;letter-spacing:2px;color:rgba(232,180,180,0.55);text-transform:uppercase;outline:none}' +
    '.cp-v02-raw-details>summary:hover{color:rgba(232,180,180,0.85)}' +
    '.cp-v02-raw-details>pre{margin:8px 0 0;font-size:0.32rem;line-height:1.5;color:rgba(200,195,184,0.45);font-family:"IBM Plex Mono",monospace;white-space:pre-wrap;word-break:break-all;max-height:280px;overflow:auto}';

  function injectStyles() {
    if (document.getElementById('cp-engine-styles')) return;
    var s = document.createElement('style'); s.id = 'cp-engine-styles'; s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // ─── helpers ──────────────────────────────────────────────────────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function clean(s) { return String(s || '').replace(/_/g, ' '); }

  // ─── bridge readings (right panel) ────────────────────────────────
  function renderBridgeReadings(co) {
    var br = co && co.bridgeReadings;
    if (!br || !br.matched || br.matched.length === 0) return;
    var rc = document.getElementById('rightContent');
    if (!rc) return;
    var h = '<div class="cp-bridge-section">';
    h += '<div class="cp-bridge-title">Bridge patterns · ' + br.matched.length + ' matched</div>';
    for (var i = 0; i < br.matched.length; i++) {
      var m = br.matched[i];
      h += '<div class="cp-bridge-card" data-bidx="' + i + '">';
      h += '<div class="cp-bridge-head">';
      h += '<div class="cp-bridge-region">' + esc(m.neuralRegionLabel || m.neuralRegion || 'pattern') + '</div>';
      h += '<div class="cp-bridge-conf">conf ' + (typeof m.confidence === 'number' ? m.confidence.toFixed(2) : '—') + '</div>';
      h += '</div>';
      h += '<div class="cp-bridge-sig">' + esc(clean(m.businessSignature || 'business signature')) + '</div>';
      h += '<div class="cp-bridge-indicators">indicators: ' + (m.matchedIndicators || []).map(esc).join(' · ') + ' (' + ((m.matchedIndicators || []).length) + '/' + (m.totalIndicators || '?') + ')</div>';
      h += '<div class="cp-bridge-detail">';
      h += '<div class="cp-bridge-detail-row"><span>pattern</span><b>' + esc(m.patternId) + '</b></div>';
      h += '<div class="cp-bridge-detail-row"><span>mapping type</span><b>' + esc(clean(m.mappingType || '')) + '</b></div>';
      h += '<div class="cp-bridge-detail-row"><span>match rate</span><b>' + (typeof m.matchRate === 'number' ? Math.round(m.matchRate * 100) + '%' : '—') + '</b></div>';
      h += '<div class="cp-bridge-detail-row"><span>phase affinity</span><b>' + (m.phaseAffinity || []).join(', ') + '</b></div>';
      if (m.knownTreatments && m.knownTreatments.length) h += '<div style="margin-top:6px;color:rgba(74,143,212,0.6);font-size:0.3rem">clinical treatments: ' + m.knownTreatments.slice(0, 2).map(esc).join('; ') + '</div>';
      h += '</div></div>';
    }
    h += '</div>';
    rc.insertAdjacentHTML('beforeend', h);
    rc.querySelectorAll('.cp-bridge-card').forEach(function (card) {
      card.addEventListener('click', function () { card.classList.toggle('open'); });
    });
  }

  // ─── engine outputs (center panel) ────────────────────────────────
  var LANES = [
    { id: 'patent', label: 'Patent' },
    { id: 'grant', label: 'Grant' },
    { id: 'investment', label: 'Investment' },
    { id: 'research', label: 'Research' }
  ];

  function renderEngineOutputs(co) {
    var eo = co && co.engineOutputs;
    var center = document.getElementById('centerView');
    if (!center) return;
    if (!eo || eo.totalArtifacts === 0) {
      // Leave the placeholder alone — show why we're empty
      var ph = center.querySelector('.center-placeholder');
      if (ph) {
        var sub = ph.querySelector('.cp-sub');
        if (sub) sub.textContent = 'No engine outputs yet — bridge layer hasn\'t fired for this entity';
      }
      return;
    }

    // available lanes
    var available = LANES.filter(function (L) { return (eo[L.id] || []).length > 0; });
    if (available.length === 0) return;

    // build container — replaces the placeholder
    var initialTab = available.find(function (L) { return L.id === 'investment'; }) || available[0];
    var html = '<div class="cp-engine">';
    html += '<div class="cp-engine-head">';
    html += '<div class="cp-engine-title">Engine outputs</div>';
    html += '<div class="cp-engine-summary">' + eo.totalArtifacts + ' artifacts from ' + (eo.bridgeCount || 0) + ' bridge patterns · generated ' + new Date(eo.generatedAt || Date.now()).toLocaleString() + '</div>';
    html += '</div>';

    // Gate B v0.2 — top-level section banner if any engineOutput is
    // placeholder-contaminated. Reads the shared render-authority
    // contract; defensive fallback if the module isn't loaded.
    var RA = window.LIMENRenderAuthority;
    if (RA && RA.classifyAuthority) {
      var sectionAuth = RA.classifyAuthority(co);
      if (sectionAuth.state === RA.STATES.PLACEHOLDER_CONTAMINATED) {
        html += '<div class="cp-v02-section-banner">' +
                RA.renderAuthorityBanner(co, { sectionLabel: 'engine output' }) +
                '</div>';
      }
    }

    html += '<div class="cp-engine-tabs">';
    for (var i = 0; i < available.length; i++) {
      var L = available[i];
      var active = (L.id === initialTab.id) ? ' active' : '';
      html += '<button class="cp-engine-tab' + active + '" data-lane="' + L.id + '">' + L.label + '<span class="cp-engine-tab-count">' + (eo[L.id] || []).length + '</span></button>';
    }
    html += '</div>';
    html += '<div class="cp-engine-body" id="cpEngineBody"></div>';
    html += '</div>';
    center.innerHTML = html;

    // render initial tab
    renderLane(eo, initialTab.id);

    // wire tabs
    center.querySelectorAll('.cp-engine-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        center.querySelectorAll('.cp-engine-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        renderLane(eo, tab.dataset.lane);
      });
    });
  }

  function renderLane(eo, laneId) {
    var body = document.getElementById('cpEngineBody');
    if (!body) return;
    var items = eo[laneId] || [];
    if (items.length === 0) { body.innerHTML = '<div class="cp-engine-empty">No ' + laneId + ' artifacts yet</div>'; return; }
    var h = '';
    for (var i = 0; i < items.length; i++) {
      h += renderArtifact(items[i], laneId, i);
    }
    body.innerHTML = h;
    wireArtifactActions(body);
  }

  function wireArtifactActions(scope) {
    scope.querySelectorAll('button[data-action]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = btn.dataset.action;
        var ref = btn.dataset.ref;
        var parts = ref.split('/');
        var slug = parts[0], lane = parts[1], index = parts[2] || 0;
        var original = btn.textContent;

        // PRINT = download 20-30 page DOCX (Anthropic-augmented, new-business
        // calibrated). Browser saves wherever operator points it (e.g.
        // LIMEN Helix Files on Desktop).
        if (action === 'PRINT') {
          btn.disabled = true; btn.textContent = 'generating 30-90s…';
          showToast('Generating long-form DOCX (20-30 pages, takes 30-90s)…', 'ok');
          var url = '/api/print-document?slug=' + encodeURIComponent(slug) + '&lane=' + encodeURIComponent(lane) + '&index=' + encodeURIComponent(index);
          fetch(url)
            .then(function(r){
              if (!r.ok) return r.json().then(function(j){ throw new Error(j.error || ('HTTP ' + r.status)); });
              return r.blob().then(function(blob){
                var cd = r.headers.get('Content-Disposition') || '';
                var m = cd.match(/filename="([^"]+)"/);
                var fname = m ? m[1] : (slug + '__' + lane + '.docx');
                var dl = document.createElement('a');
                dl.href = URL.createObjectURL(blob); dl.download = fname;
                document.body.appendChild(dl); dl.click(); document.body.removeChild(dl);
                URL.revokeObjectURL(dl.href);
                btn.textContent = '✓ ' + fname;
                showToast('Downloaded ' + fname, 'ok');
                fetch('/api/operator-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'PRINT', artifactRef: ref, portalSlug: slug, lane: lane, patternId: btn.dataset.pattern }) });
              });
            })
            .catch(function(err){
              btn.disabled = false; btn.textContent = original;
              showToast('Print failed: ' + (err.message || err), 'err');
            });
          return;
        }

        // REFRESH / DECLINE keep their queue-based behavior
        btn.disabled = true; btn.textContent = '…';
        fetch('/api/operator-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, artifactRef: ref, portalSlug: slug, lane: lane, patternId: btn.dataset.pattern }) })
          .then(function(r){ return r.json(); })
          .then(function(j){
            btn.textContent = action === 'REFRESH' ? '✓ refresh queued' : '✓ declined';
            showToast(action + ' queued', 'ok');
          })
          .catch(function(err){
            btn.disabled = false; btn.textContent = original;
            showToast('Action failed: ' + (err.message || err), 'err');
          });
      });
    });
  }

  function showToast(msg, kind) {
    var t = document.getElementById('cpToast');
    if (!t) {
      t = document.createElement('div'); t.id = 'cpToast'; t.className = 'cp-toast';
      document.body.appendChild(t);
    }
    t.className = 'cp-toast ' + (kind || '') + ' show';
    t.textContent = msg;
    setTimeout(function(){ t.classList.remove('show'); }, 3500);
  }

  // Gate B v0.2 — suppressed-artifact card. Replaces the full
  // artifact body when classifyArtifactAuthority returns
  // PLACEHOLDER_CONTAMINATED. Strong-form discipline:
  // operator sees the artifact slot is occupied + why it's
  // suppressed, plus the detected placeholders. No buttons; no
  // visible body. Raw artifact JSON available via a collapsed
  // <details> drawer for audit debugging only.
  function renderSuppressedArtifact(item, laneId, index, artAuth) {
    var placeholders = (artAuth && artAuth.placeholdersFound) || [];
    var visible = placeholders.slice(0, 24);
    var rest = placeholders.length - visible.length;
    var phCodes = visible.map(function (p) { return '<code>' + esc(p) + '</code>'; }).join(' ');
    if (rest > 0) phCodes += ' <span style="opacity:0.6;font-size:0.3rem">… (' + rest + ' more)</span>';

    var h = '<div class="cp-v02-card">';
    h += '<div class="cp-v02-card-banner">';
    h += '<strong>INCOMPLETE ARTIFACT — SUPPRESSED.</strong>';
    h += 'This artifact contains unfilled template placeholders and is suppressed.';
    h += '</div>';

    h += '<div class="cp-v02-meta">';
    h += '<div class="k">lane</div><div class="v">' + esc(laneId) + '</div>';
    h += '<div class="k">patternId</div><div class="v">' + esc(item.patternId || '—') + '</div>';
    h += '<div class="k">index</div><div class="v">' + (index != null ? index : 0) + '</div>';
    if (item.confidence != null) {
      h += '<div class="k">confidence</div><div class="v">' + (typeof item.confidence === 'number' ? item.confidence.toFixed(3) : esc(String(item.confidence))) + '</div>';
    }
    h += '<div class="k">authority state</div><div class="v state">PLACEHOLDER_CONTAMINATED</div>';
    h += '<div class="k">suppressDirective</div><div class="v">true</div>';
    h += '<div class="k">placeholderCount</div><div class="v">' + placeholders.length + '</div>';
    h += '</div>';

    h += '<div class="cp-v02-placeholders">';
    h += '<div class="cp-v02-placeholders-label">Detected placeholders</div>';
    h += '<div class="cp-v02-placeholders-list">' + (phCodes || '<span style="opacity:0.5">none</span>') + '</div>';
    h += '</div>';

    // Collapsed raw drawer — for audit/debug only, closed by default.
    var rawJson;
    try { rawJson = JSON.stringify(item.artifact || item, null, 2); }
    catch (e) { rawJson = '[unable to serialize: ' + esc(String(e && e.message)) + ']'; }
    h += '<details class="cp-v02-raw-details">';
    h += '<summary>RAW INCOMPLETE TEMPLATE — DO NOT USE</summary>';
    h += '<pre>' + esc(rawJson) + '</pre>';
    h += '</details>';

    // No action buttons. Print / Refresh / Decline are hidden for
    // contaminated artifacts until they can route through Gate A
    // (state-write chokepoint) or a gated regenerate flow.
    h += '</div>';
    return h;
  }

  function renderArtifact(item, laneId, index) {
    var art = item.artifact || {};
    var artifactRef = (window.__currentPortalSlug || _slugFromUrl()) + '/' + laneId + '/' + (index != null ? index : 0);

    // Gate B v0.2 — artifact-level suppression. If the artifact (or
    // anything inside it) contains uppercase template placeholders,
    // suppress the body and render only the metadata + placeholder
    // list. No action buttons; optional collapsed raw drawer for
    // audit debugging. Operator doctrine:
    //   Placeholder-contaminated text may be shown as evidence of
    //   incompleteness, not as artifact content.
    var RA = window.LIMENRenderAuthority;
    if (RA && RA.classifyArtifactAuthority) {
      var artAuth = RA.classifyArtifactAuthority(item);
      if (artAuth.state === RA.STATES.PLACEHOLDER_CONTAMINATED) {
        return renderSuppressedArtifact(item, laneId, index, artAuth);
      }
    }

    var h = '<div class="cp-artifact">';
    h += '<div class="cp-artifact-head">';
    h += '<div class="cp-artifact-pattern">' + esc(item.patternId || '—') + '</div>';
    h += '<div class="cp-artifact-conf">confidence ' + (typeof item.confidence === 'number' ? item.confidence.toFixed(3) : '—') + '</div>';
    h += '</div>';

    if (laneId === 'patent') {
      if (art.title) h += sect('Title', art.title);
      if (art.abstract) h += sect('Abstract', art.abstract);
      if (art.background) h += sect('Background', art.background);
      if (art.summary) h += sect('Summary', art.summary);
      if (art.claims && art.claims.length) {
        h += '<div class="cp-artifact-section"><div class="cp-artifact-section-label">' + esc(art.claimsPreamble || 'Claims') + '</div>';
        for (var k = 0; k < art.claims.length; k++) h += '<div class="cp-claim">' + esc(art.claims[k]) + '</div>';
        h += '</div>';
      }
      if (art.classification) h += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.3);letter-spacing:1px;margin-top:8px">USPC class: ' + esc(art.classification) + '</div>';
    } else if (laneId === 'grant') {
      if (art.title) h += sect('Title', art.title);
      if (art.abstract) h += sect('Project summary', art.abstract);
      var sa = art.specificAims;
      if (sa) {
        h += '<div class="cp-artifact-section"><div class="cp-artifact-section-label">Specific aims</div>';
        if (sa.longTermGoal) h += '<div class="cp-artifact-text" style="margin-bottom:6px"><em>Long-term goal.</em> ' + esc(sa.longTermGoal) + '</div>';
        if (sa.overallObjective) h += '<div class="cp-artifact-text" style="margin-bottom:6px"><em>Overall objective.</em> ' + esc(sa.overallObjective) + '</div>';
        if (sa.centralHypothesis) h += '<div class="cp-artifact-text" style="margin-bottom:6px"><em>Central hypothesis.</em> ' + esc(sa.centralHypothesis) + '</div>';
        if (sa.rationale) h += '<div class="cp-artifact-text" style="margin-bottom:8px"><em>Rationale.</em> ' + esc(sa.rationale) + '</div>';
        if (sa.aims && sa.aims.length) for (var a = 0; a < sa.aims.length; a++) h += '<div class="cp-aim">' + esc(sa.aims[a]) + '</div>';
        h += '</div>';
      }
      if (art.significance) h += sect('Significance', art.significance);
      if (art.innovation) h += sect('Innovation', art.innovation);
      if (item.programs && item.programs.length) h += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.35);letter-spacing:1px;margin-top:8px">Program matches: ' + item.programs.map(esc).join(' · ') + '</div>';
    } else if (laneId === 'investment') {
      if (art.thesisStatement) h += sect('Thesis statement', art.thesisStatement);
      if (art.header) h += sect('Header', art.header, true);
      if (art.variantView) h += sect('Variant view', art.variantView);
      if (art.catalystBlock) h += sect('Catalysts', art.catalystBlock, true);
      if (art.valuation) h += sect('Valuation', art.valuation, true);
      if (art.positionSizing) h += sect('Position sizing', art.positionSizing, true);
      if (art.risk) h += sect('Risk · falsifiability', art.risk, true);
      if (art.exit) h += sect('Exit conditions', art.exit, true);
      if (item.side) h += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.35);letter-spacing:1px;margin-top:8px">Side: ' + item.side + ' · Horizon: ' + esc(item.horizon || '—') + '</div>';
    } else if (laneId === 'research') {
      if (art.title) h += sect('Title', art.title);
      if (art.hypothesis) h += sect('Hypothesis', art.hypothesis);
      if (art.methodology) h += sect('Methodology', art.methodology);
      if (art.preregistration) h += sect('Preregistration plan', art.preregistration);
      if (art.falsifiability) h += sect('Falsifiability', art.falsifiability);
      if (art.expectedOutcome) h += sect('Expected outcome', art.expectedOutcome);
    } else {
      h += '<div class="cp-artifact-text mono">' + esc(JSON.stringify(art, null, 2)) + '</div>';
    }
    // Action buttons — print / refresh / decline
    var refData = 'data-ref="' + artifactRef + '" data-pattern="' + esc(item.patternId || '') + '"';
    h += '<div class="cp-artifact-actions">';
    h += '<button class="print" ' + refData + ' data-action="PRINT">Print</button>';
    h += '<button class="refresh" ' + refData + ' data-action="REFRESH">Refresh · greater detail</button>';
    h += '<button class="decline" ' + refData + ' data-action="DECLINE">Decline</button>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  function _slugFromUrl() {
    var m = window.location.search.match(/[?&]company=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function sect(label, text, monoFlag) {
    var cls = monoFlag ? ' mono' : '';
    return '<div class="cp-artifact-section">' +
      '<div class="cp-artifact-section-label">' + esc(label) + '</div>' +
      '<div class="cp-artifact-text' + cls + '">' + esc(text) + '</div>' +
    '</div>';
  }

  // ─── wrap CompanyPortalUI.renderCompany ───────────────────────────
  var origRender = window.CompanyPortalUI.renderCompany;
  window.CompanyPortalUI.renderCompany = function (co) {
    var r = origRender(co);
    injectStyles();
    try { renderBridgeReadings(co); } catch (e) { console.warn('[engine-render] bridge render error', e); }
    try { renderEngineOutputs(co); } catch (e) { console.warn('[engine-render] engine render error', e); }
    return r;
  };
})();
