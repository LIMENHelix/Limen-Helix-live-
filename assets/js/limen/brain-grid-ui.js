/**
 * LIMEN Helix — Brain Grid UI
 *
 * Renders the fractal-recursive brain network as a four-quadrant DOM grid:
 *   ┌─────────────────────────────────┐
 *   │           MASTER (PFC)          │
 *   ├──────────────┬──────────────────┤
 *   │ CIVILIZATION │   CONNECTOME     │
 *   ├──────────────┴──────────────────┤
 *   │      20 DOMAIN BRAINS           │
 *   └─────────────────────────────────┘
 *
 * Subscribes to the broker (subscribeAll) and re-renders on each emission.
 * Also displays the engine artifact feed (last 20 persisted outputs).
 *
 * Exposed via window.LIMENBrainGridUI.
 *
 * Mount: LIMENBrainGridUI.mount(document.getElementById('brain-grid-root'))
 */
(function (root) {
  'use strict';

  var Envelope = root.LIMENPatternEnvelope;
  var Broker = root.LIMENPatternBroker;
  if (!Envelope || !Broker) {
    console.error('[BrainGridUI] missing dependencies');
    return;
  }

  var _container = null;
  var _emissions = [];           // recent envelopes (any brain)
  var _emissionMax = 200;
  var _renderScheduled = false;
  var _renderIntervalMs = 800;   // coalesce render calls
  var _engineLog = [];
  var _engineLogMax = 30;
  var _engineLogFetchAt = 0;
  var _engineLogIntervalMs = 5000;

  // ── Styles (injected once) ─────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('limen-brain-grid-styles')) return;
    var s = document.createElement('style');
    s.id = 'limen-brain-grid-styles';
    s.textContent = [
      '.lbg-root{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#e6e6e6;background:#0a0a0a;padding:16px;min-height:100vh;box-sizing:border-box}',
      '.lbg-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px;border-bottom:1px solid #222;padding-bottom:12px}',
      '.lbg-title{font-size:20px;font-weight:600;letter-spacing:0.5px}',
      '.lbg-stats{font-size:12px;color:#888;font-family:ui-monospace,Menlo,monospace}',
      '.lbg-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto auto;gap:12px}',
      '.lbg-master{grid-column:1/-1;border:1px solid #3b3b6f;background:linear-gradient(180deg,#101030,#080820);padding:14px;border-radius:6px}',
      '.lbg-civ{border:1px solid #4d3b6f;background:linear-gradient(180deg,#1a0f30,#100820);padding:14px;border-radius:6px}',
      '.lbg-con{border:1px solid #3b6f5d;background:linear-gradient(180deg,#0f3020,#082018);padding:14px;border-radius:6px}',
      '.lbg-domains{grid-column:1/-1;border:1px solid #2a2a2a;background:#0f0f0f;padding:14px;border-radius:6px}',
      '.lbg-feed{grid-column:1/-1;border:1px solid #2a2a2a;background:#0f0f0f;padding:14px;border-radius:6px}',
      '.lbg-panel-title{font-size:13px;font-weight:600;color:#a0a0c0;margin:0 0 8px;letter-spacing:0.4px;text-transform:uppercase}',
      '.lbg-sig{font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#666}',
      '.lbg-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0}',
      '.lbg-meta-cell{background:rgba(255,255,255,0.03);padding:6px 8px;border-radius:4px}',
      '.lbg-meta-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.4px}',
      '.lbg-meta-val{font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#e6e6e6}',
      '.lbg-ops{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}',
      '.lbg-op{background:rgba(255,255,255,0.03);padding:6px;border-radius:4px;font-size:11px}',
      '.lbg-op-name{color:#888;font-size:10px;text-transform:uppercase}',
      '.lbg-op-bar{height:6px;background:#222;border-radius:3px;overflow:hidden;margin-top:3px}',
      '.lbg-op-bar-fill{height:100%;background:linear-gradient(90deg,#5b73a8,#7a9ae6);transition:width 200ms ease-out}',
      '.lbg-op-bar-fill.high{background:linear-gradient(90deg,#a85b5b,#e67a7a)}',
      '.lbg-op-num{color:#bbb;font-family:ui-monospace,Menlo,monospace;font-size:10px;text-align:right;margin-top:2px}',
      '.lbg-domain-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}',
      '.lbg-domain-cell{background:rgba(255,255,255,0.04);padding:6px 8px;border-radius:4px;font-size:11px;border-left:3px solid #444}',
      '.lbg-domain-cell.active{border-left-color:#7a9ae6}',
      '.lbg-domain-cell.hot{border-left-color:#e67a7a;background:rgba(230,122,122,0.08)}',
      '.lbg-domain-name{font-weight:500;color:#ccc}',
      '.lbg-domain-phase{color:#888;font-size:10px;font-family:ui-monospace,Menlo,monospace}',
      '.lbg-domain-stress{color:#bbb;font-size:10px;font-family:ui-monospace,Menlo,monospace}',
      '.lbg-feed-row{display:grid;grid-template-columns:80px 90px 1fr 60px 50px;gap:10px;padding:4px 0;border-bottom:1px solid #1a1a1a;font-size:11px;font-family:ui-monospace,Menlo,monospace}',
      '.lbg-feed-time{color:#666}',
      '.lbg-feed-brain{color:#7a9ae6}',
      '.lbg-feed-sig{color:#999;font-size:10px}',
      '.lbg-feed-stress{color:#bbb;text-align:right}',
      '.lbg-feed-arts{color:#e67a7a;text-align:right}',
      '.lbg-artifact-row{padding:6px 8px;background:rgba(122,154,230,0.05);border-left:3px solid #7a9ae6;margin-top:4px;border-radius:3px;font-size:11px}',
      '.lbg-artifact-row.invest{border-left-color:#e6c97a;background:rgba(230,201,122,0.05)}',
      '.lbg-artifact-row.patent{border-left-color:#7ae6c0;background:rgba(122,230,192,0.05)}',
      '.lbg-artifact-row.grant{border-left-color:#a87ae6;background:rgba(168,122,230,0.05)}',
      '.lbg-artifact-meta{color:#888;font-family:ui-monospace,Menlo,monospace;font-size:10px;margin-top:2px}',
      '.lbg-degraded{color:#e67a7a;font-weight:600;font-size:11px;margin-left:8px}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Scaffold ───────────────────────────────────────────────────────
  function scaffold(el) {
    el.innerHTML = '';
    el.classList.add('lbg-root');
    var header = document.createElement('div');
    header.className = 'lbg-header';
    header.innerHTML = '<div class="lbg-title">LIMEN Helix · Fractal Brain Grid</div>' +
                       '<div class="lbg-stats" id="lbg-stats">initializing…</div>';
    el.appendChild(header);

    var grid = document.createElement('div');
    grid.className = 'lbg-grid';
    grid.innerHTML =
      '<div class="lbg-master" id="lbg-master"><div class="lbg-panel-title">Master · PFC <span class="lbg-sig" id="lbg-master-sig"></span></div></div>' +
      '<div class="lbg-civ" id="lbg-civ"><div class="lbg-panel-title">Civilization · DMN + Salience <span class="lbg-sig" id="lbg-civ-sig"></span></div></div>' +
      '<div class="lbg-con" id="lbg-con"><div class="lbg-panel-title">Connectome · 123-node substrate <span class="lbg-sig" id="lbg-con-sig"></span></div></div>' +
      '<div class="lbg-domains" id="lbg-domains"><div class="lbg-panel-title">20 Domain Brains</div></div>' +
      '<div class="lbg-feed" id="lbg-feed"><div class="lbg-panel-title">Pattern Emissions (live)</div></div>' +
      '<div class="lbg-feed" id="lbg-engines"><div class="lbg-panel-title">Engine Artifacts (persisted READY-TO-SIGN)</div></div>';
    el.appendChild(grid);
  }

  // ── Render ─────────────────────────────────────────────────────────
  function renderOpsBlock(parentEl, operators, kernels) {
    var html = '<div class="lbg-ops">';
    Envelope.OPERATOR_KEYS.forEach(function (k) {
      var op = (operators && operators[k]) || { readiness: 0, salience: 0, evidence: 0 };
      var pct = Math.round((op.readiness || 0) * 100);
      var cls = pct > 60 ? 'high' : '';
      html += '<div class="lbg-op">' +
                '<div class="lbg-op-name">' + escapeHtml(k) + '</div>' +
                '<div class="lbg-op-bar"><div class="lbg-op-bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
                '<div class="lbg-op-num">' + pct + '% rd · ' + Math.round((op.salience||0)*100) + '% sa</div>' +
              '</div>';
    });
    html += '</div>';
    if (kernels && kernels.thing2) {
      var t2 = kernels.thing2;
      html += '<div class="lbg-meta">' +
        metaCell('Dominant phase', t2.dominantPhase || '—') +
        metaCell('Phase conf', (t2.phaseConfidence != null ? t2.phaseConfidence.toFixed(2) : '—')) +
        metaCell('Stress', (t2.stress != null ? t2.stress.toFixed(3) : '—')) +
        metaCell('Trajectory', t2.trajectory || '—') +
        metaCell('Coupling', (t2.coupling && t2.coupling.mode) || '—') +
        metaCell('Kernel', t2.kernelId || '—') +
      '</div>';
    }
    parentEl.insertAdjacentHTML('beforeend', html);
  }

  function metaCell(label, value) {
    return '<div class="lbg-meta-cell"><div class="lbg-meta-label">' + escapeHtml(label) +
           '</div><div class="lbg-meta-val">' + escapeHtml(String(value)) + '</div></div>';
  }

  function renderBrain(panelId, sigId, env) {
    var el = document.getElementById(panelId);
    if (!el) return;
    var sigEl = document.getElementById(sigId);
    while (el.children.length > 1) el.removeChild(el.lastChild);
    if (!env) {
      el.insertAdjacentHTML('beforeend', '<div style="color:#666;font-size:12px">waiting for first emission…</div>');
      if (sigEl) sigEl.textContent = '';
      return;
    }
    if (sigEl) sigEl.textContent = '· sig ' + (env.pattern.signature || '').slice(0, 12) +
      ' · cyc ' + env.cycleId +
      (env.degraded ? ' · DEGRADED' : '');

    renderOpsBlock(el, env.pattern.operators, env.kernels);

    // Salience bar
    var salPct = Math.round((env.pattern.salience || 0) * 100);
    el.insertAdjacentHTML('beforeend',
      '<div style="margin-top:8px"><div class="lbg-op-name">Salience</div>' +
      '<div class="lbg-op-bar"><div class="lbg-op-bar-fill ' + (salPct > 60 ? 'high' : '') + '" style="width:' + salPct + '%"></div></div>' +
      '<div class="lbg-op-num">' + salPct + '%</div></div>');

    // Meta block
    var m = env.pattern._meta || {};
    if (m && Object.keys(m).length) {
      var mhtml = '<div class="lbg-meta">';
      Object.keys(m).slice(0, 8).forEach(function (k) {
        var v = m[k];
        if (typeof v === 'object') v = JSON.stringify(v).slice(0, 40);
        mhtml += metaCell(k, v);
      });
      mhtml += '</div>';
      el.insertAdjacentHTML('beforeend', mhtml);
    }
  }

  function renderDomains() {
    var el = document.getElementById('lbg-domains');
    if (!el) return;
    while (el.children.length > 1) el.removeChild(el.lastChild);

    var registry = Broker.getRegistry();
    var domainBrains = [];
    Object.keys(registry).forEach(function (id) {
      if (registry[id].kind === 'domain' || /^domain[:\-]/i.test(id)) domainBrains.push(id);
    });

    // Also surface from window.LIMENDomains snapshot if available
    var snap = root.LIMENDomains || {};
    var snapKeys = Object.keys(snap);

    if (!domainBrains.length && !snapKeys.length) {
      el.insertAdjacentHTML('beforeend', '<div style="color:#666;font-size:12px">no domain brains registered yet — they emit independently of this grid</div>');
      return;
    }

    var html = '<div class="lbg-domain-grid">';
    var seen = {};
    domainBrains.concat(snapKeys).forEach(function (id) {
      var domainKey = id.replace(/^domain[:\-]/i, '');
      if (seen[domainKey]) return;
      seen[domainKey] = true;
      var snapEntry = snap[domainKey] || {};
      var env = Broker.getLatest(id) || Broker.getLatest('domain:' + domainKey);
      var phase = (env && env.kernels && env.kernels.thing2 && env.kernels.thing2.dominantPhase) ||
                  snapEntry.brainPhase || snapEntry.phase || '—';
      var stress = (env && env.kernels && env.kernels.thing2 && env.kernels.thing2.stress != null) ?
        env.kernels.thing2.stress.toFixed(2) :
        (typeof snapEntry.brainStress === 'number' ? snapEntry.brainStress.toFixed(2) : '—');
      var stressNum = parseFloat(stress);
      var cls = isFinite(stressNum) && stressNum > 0.5 ? 'hot' : (env || snapEntry.brainPhase ? 'active' : '');
      html += '<div class="lbg-domain-cell ' + cls + '">' +
                '<div class="lbg-domain-name">' + escapeHtml(domainKey) + '</div>' +
                '<div class="lbg-domain-phase">' + escapeHtml(phase) + '</div>' +
                '<div class="lbg-domain-stress">stress ' + escapeHtml(stress) + '</div>' +
              '</div>';
    });
    html += '</div>';
    el.insertAdjacentHTML('beforeend', html);
  }

  function renderEmissionsFeed() {
    var el = document.getElementById('lbg-feed');
    if (!el) return;
    while (el.children.length > 1) el.removeChild(el.lastChild);
    var recent = _emissions.slice(-20).reverse();
    if (!recent.length) {
      el.insertAdjacentHTML('beforeend', '<div style="color:#666;font-size:12px">no emissions yet</div>');
      return;
    }
    var html = '<div class="lbg-feed-row" style="font-weight:600;color:#888">' +
      '<div>TIME</div><div>BRAIN</div><div>SIGNATURE</div><div>STRESS</div><div>ARTS</div></div>';
    recent.forEach(function (env) {
      html += '<div class="lbg-feed-row">' +
        '<div class="lbg-feed-time">' + new Date(env.ts).toLocaleTimeString() + '</div>' +
        '<div class="lbg-feed-brain">' + escapeHtml(env.brainId) + '</div>' +
        '<div class="lbg-feed-sig">' + escapeHtml((env.pattern.signature || '').slice(0, 16)) +
          (env.degraded ? '<span class="lbg-degraded">DEGRADED</span>' : '') + '</div>' +
        '<div class="lbg-feed-stress">' +
          (env.kernels && env.kernels.thing2 && env.kernels.thing2.stress != null ?
            env.kernels.thing2.stress.toFixed(3) : '—') + '</div>' +
        '<div class="lbg-feed-arts">' + ((env.pattern.artifacts || []).length || '—') + '</div>' +
      '</div>';
    });
    el.insertAdjacentHTML('beforeend', html);
  }

  function renderEngineFeed() {
    var el = document.getElementById('lbg-engines');
    if (!el) return;
    while (el.children.length > 1) el.removeChild(el.lastChild);
    if (!_engineLog.length) {
      el.insertAdjacentHTML('beforeend', '<div style="color:#666;font-size:12px">no engine artifacts persisted yet · POST → /api/limen-engine-output</div>');
      return;
    }
    var html = '';
    _engineLog.slice(0, _engineLogMax).forEach(function (e) {
      var lane = String(e.lane || '');
      html += '<div class="lbg-artifact-row ' + escapeHtml(lane) + '">' +
        '<div><strong>' + escapeHtml(lane.toUpperCase()) + '</strong> · ' +
          escapeHtml(e.engineId || '') + (e.cik ? ' · CIK ' + escapeHtml(e.cik) : '') + '</div>' +
        '<div class="lbg-artifact-meta">' +
          (e.outputId ? 'id ' + escapeHtml(e.outputId) : '') +
          (e.sig ? ' · sig ' + escapeHtml(e.sig.slice(0,12)) : '') +
          (e.at ? ' · ' + new Date(e.at).toLocaleTimeString() : '') +
        '</div>' +
      '</div>';
    });
    el.insertAdjacentHTML('beforeend', html);
  }

  function renderStats() {
    var el = document.getElementById('lbg-stats');
    if (!el) return;
    var s = Broker.stats();
    el.textContent =
      'brains:' + s.brains +
      ' · subs:' + s.subscriptions +
      ' · emits:' + s.totalEmits +
      ' · audit:' + s.auditEntries +
      ' · arts:' + _engineLog.length;
  }

  function renderAll() {
    if (!_container) return;
    renderStats();
    renderBrain('lbg-master', 'lbg-master-sig', Broker.getLatest('master'));
    renderBrain('lbg-civ',    'lbg-civ-sig',    Broker.getLatest('civilization'));
    renderBrain('lbg-con',    'lbg-con-sig',    Broker.getLatest('connectome'));
    renderDomains();
    renderEmissionsFeed();
    renderEngineFeed();
  }

  function scheduleRender() {
    if (_renderScheduled) return;
    _renderScheduled = true;
    setTimeout(function () { _renderScheduled = false; renderAll(); }, _renderIntervalMs);
  }

  // ── Engine log polling ─────────────────────────────────────────────
  function pollEngineLog() {
    if (typeof fetch !== 'function') return;
    var now = Date.now();
    if (now - _engineLogFetchAt < _engineLogIntervalMs) return;
    _engineLogFetchAt = now;
    fetch('/api/limen-engine-output?log=1&limit=30', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok && Array.isArray(j.entries)) {
          _engineLog = j.entries;
          scheduleRender();
        }
      })
      .catch(function () { /* silent */ });
  }

  // ── Mount ──────────────────────────────────────────────────────────
  function mount(el) {
    if (!el) {
      console.error('[BrainGridUI] mount() requires a target element');
      return;
    }
    injectStyles();
    _container = el;
    scaffold(el);

    Broker.subscribeAll('brain-grid-ui', function (env) {
      _emissions.push(env);
      if (_emissions.length > _emissionMax) {
        _emissions.splice(0, _emissions.length - _emissionMax);
      }
      scheduleRender();
    });

    // Periodic refresh for stats + domains even without new emissions
    setInterval(scheduleRender, 2000);
    // Poll engine log
    setInterval(pollEngineLog, _engineLogIntervalMs);
    // Initial fetch
    pollEngineLog();
    // Initial render
    scheduleRender();
  }

  // ── HTML escape ────────────────────────────────────────────────────
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  root.LIMENBrainGridUI = {
    mount: mount,
    renderNow: renderAll
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
