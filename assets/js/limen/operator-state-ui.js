/**
 * operator-state-ui.js
 * LIMEN HELIX — Operator State Panel + Self-Report Correction
 *
 * Floating panel that surfaces the current humanStatePacket so the
 * operator can see what the gate sees, and provides one-click
 * accurate/inaccurate buttons that feed the calibration loop.
 *
 * Reads:    window.LIMENHumanStatePacket
 * Refers:   window.LIMENHumanContextGate
 * Posts to: /api/limen-operator-calibration (auth-gated)
 *
 * Per CLAUDE.md prime directive: visible-by-default ONLY on console pages
 * where the biosensor stack is already running. Other pages can mount
 * via window.LIMENOperatorStateUI.mount(). No localStorage. RAM only.
 *
 * Load order: AFTER human-context-gate.js.
 */
(function () {
  'use strict';

  var _root = null;
  var _els = {};
  var _mounted = false;
  var _renderInterval = null;
  var _lastPacket = null;
  var _RENDER_MS = 1500;

  // Operator token — read once from window for server publish/calibration.
  // The token is operator-injected (e.g., via console paste). Never stored.
  function _operatorToken() {
    return (typeof window !== 'undefined' && window.__LIMEN_OPERATOR_TOKEN__) || '';
  }

  function _phaseColor(phase) {
    switch (phase) {
      case 'HUMAN_P0_BASELINE':       return 'rgba(180,180,170,0.85)';
      case 'HUMAN_P1_AROUSAL_RISE':   return 'rgba(212,180,80,0.85)';
      case 'HUMAN_P2_FOCUSED_FLOW':   return 'rgba(90,200,140,0.95)';
      case 'HUMAN_P3_FRAGMENTATION':  return 'rgba(220,160,90,0.85)';
      case 'HUMAN_P4_OVERLOAD':       return 'rgba(232,120,80,0.95)';
      case 'HUMAN_P5_DEPLETION':      return 'rgba(160,140,200,0.85)';
      case 'HUMAN_P6_RECOVERY':       return 'rgba(140,180,210,0.85)';
      case 'HUMAN_P7_REDLINE':        return 'rgba(232,80,80,1.0)';
      default:                        return 'rgba(180,180,170,0.7)';
    }
  }

  function mount() {
    if (_mounted) return;
    _root = document.createElement('div');
    _root.id = 'limen-operator-state-panel';
    _root.style.cssText = [
      'position:fixed', 'bottom:12px', 'right:12px', 'z-index:9997',
      'width:296px', 'background:rgba(8,10,16,0.94)',
      'border:1px solid rgba(201,169,78,0.40)', 'border-radius:8px',
      'font:11px/1.45 ui-monospace,Menlo,Consolas,monospace',
      'color:#e8dec0', 'box-shadow:0 8px 32px rgba(0,0,0,0.55)',
      'backdrop-filter:blur(6px)', '-webkit-backdrop-filter:blur(6px)',
      'user-select:none'
    ].join(';');

    _root.innerHTML =
      '<div id="losp-head" style="display:flex;align-items:center;justify-content:space-between;'
      + 'padding:7px 10px;border-bottom:1px solid rgba(201,169,78,0.22);">'
      +   '<div style="font-weight:600;color:#c9a94e;letter-spacing:0.06em;font-size:10px;">'
      +     'OPERATOR STATE · <span id="losp-status">SENSING</span>'
      +   '</div>'
      +   '<button id="losp-toggle" style="background:transparent;border:1px solid rgba(201,169,78,0.30);'
      +     'color:#c9a94e;border-radius:3px;padding:1px 6px;cursor:pointer;font:inherit;">−</button>'
      + '</div>'
      + '<div id="losp-body" style="padding:10px;">'
      +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
      +     '<div id="losp-phase-dot" style="width:10px;height:10px;border-radius:50%;background:#444;"></div>'
      +     '<div id="losp-phase" style="font-weight:600;font-size:13px;color:#e8dec0;">--</div>'
      +   '</div>'
      +   '<div id="losp-phase-desc" style="font-size:10px;color:#a89668;margin-bottom:8px;'
      +       'line-height:1.4;min-height:24px;">—</div>'

      // Derived state bars
      +   '<div style="border-top:1px dashed rgba(201,169,78,0.18);padding-top:8px;">'
      +     bar('Arousal',       'arousal')
      +     bar('Coherence',     'coherence')
      +     bar('Cognitive Load','cogload')
      +     bar('Fatigue',       'fatigue')
      +     bar('Frustration',   'frustration')
      +     bar('Flow State',    'flow')
      +     bar('Overload Risk', 'overload')
      +   '</div>'

      // Recommended system behavior
      +   '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed rgba(201,169,78,0.18);">'
      +     '<div style="font-size:10px;color:#c9a94e;letter-spacing:0.05em;margin-bottom:5px;">SYSTEM BEHAVIOR</div>'
      +     '<div style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:10px;">'
      +       row('UI mode',      'rsb-uimode')
      +       row('Task mode',    'rsb-taskmode')
      +       row('Prompt style', 'rsb-promptstyle')
      +       row('Interrupts',   'rsb-interrupt')
      +       row('Autofire',     'rsb-autofire')
      +     '</div>'
      +   '</div>'

      // Refusal stats
      +   '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed rgba(201,169,78,0.18);font-size:10px;">'
      +     '<div style="display:grid;grid-template-columns:auto auto auto;gap:2px 6px;color:#a89668;">'
      +       '<span>refused</span><span id="losp-refused" style="color:#e8dec0;text-align:right;">0</span><span style="color:#a89668;">hard</span>'
      +       '<span style="color:#a89668;">allowed</span><span id="losp-allowed" style="color:#e8dec0;text-align:right;">0</span><span id="losp-hard" style="color:#df9a9a;text-align:right;">0</span>'
      +     '</div>'
      +   '</div>'

      // Self-report correction
      +   '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed rgba(201,169,78,0.18);">'
      +     '<div style="font-size:10px;color:#c9a94e;letter-spacing:0.05em;margin-bottom:5px;">THIS READING IS</div>'
      +     '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
      +       '<button id="losp-accurate" style="background:rgba(76,176,80,0.14);border:1px solid rgba(76,176,80,0.55);'
      +         'color:#9adfa1;border-radius:4px;padding:5px;cursor:pointer;font:inherit;font-size:10px;">ACCURATE</button>'
      +       '<button id="losp-inaccurate" style="background:rgba(176,76,76,0.14);border:1px solid rgba(176,76,76,0.55);'
      +         'color:#df9a9a;border-radius:4px;padding:5px;cursor:pointer;font:inherit;font-size:10px;">INACCURATE</button>'
      +     '</div>'
      +     '<div id="losp-report-status" style="font-size:9px;color:#a89668;margin-top:5px;min-height:12px;"></div>'
      +   '</div>'

      // Identity provenance footer
      +   '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed rgba(201,169,78,0.18);'
      +       'font-size:9px;color:#8a7a4a;display:flex;justify-content:space-between;">'
      +     '<span id="losp-conf">conf —</span>'
      +     '<span id="losp-ident">id —</span>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(_root);

    _els.status = document.getElementById('losp-status');
    _els.body = document.getElementById('losp-body');
    _els.toggle = document.getElementById('losp-toggle');
    _els.phase = document.getElementById('losp-phase');
    _els.phaseDot = document.getElementById('losp-phase-dot');
    _els.phaseDesc = document.getElementById('losp-phase-desc');
    _els.allowed = document.getElementById('losp-allowed');
    _els.refused = document.getElementById('losp-refused');
    _els.hard = document.getElementById('losp-hard');
    _els.accurate = document.getElementById('losp-accurate');
    _els.inaccurate = document.getElementById('losp-inaccurate');
    _els.reportStatus = document.getElementById('losp-report-status');
    _els.conf = document.getElementById('losp-conf');
    _els.ident = document.getElementById('losp-ident');
    ['arousal','coherence','cogload','fatigue','frustration','flow','overload'].forEach(function (k) {
      _els['bar-' + k]  = document.getElementById('losp-bar-' + k);
      _els['barv-' + k] = document.getElementById('losp-barv-' + k);
    });
    ['uimode','taskmode','promptstyle','interrupt','autofire'].forEach(function (k) {
      _els['rsb-' + k] = document.getElementById('losp-rsb-' + k);
    });

    _els.toggle.addEventListener('click', function () {
      var collapsed = _els.body.style.display === 'none';
      _els.body.style.display = collapsed ? 'block' : 'none';
      _els.toggle.textContent = collapsed ? '−' : '+';
    });
    _els.accurate.addEventListener('click', function () { _sendSelfReport(true); });
    _els.inaccurate.addEventListener('click', function () { _sendSelfReport(false); });

    _mounted = true;

    // Subscribe to packet emissions
    if (window.LIMENHumanStatePacket && typeof window.LIMENHumanStatePacket.subscribe === 'function') {
      window.LIMENHumanStatePacket.subscribe(function (packet) {
        _lastPacket = packet;
        _renderImmediate();
        _maybePublish(packet);
      });
    }

    if (!_renderInterval) {
      _renderInterval = setInterval(_renderImmediate, _RENDER_MS);
    }
    _renderImmediate();
  }

  function bar(label, id) {
    return '<div style="margin-bottom:4px;">'
      + '<div style="display:flex;justify-content:space-between;font-size:10px;color:#8a7a4a;">'
      +   '<span>' + label + '</span>'
      +   '<span id="losp-barv-' + id + '">—</span>'
      + '</div>'
      + '<div style="height:3px;background:rgba(201,169,78,0.08);border-radius:2px;overflow:hidden;">'
      + '<div id="losp-bar-' + id + '" style="height:100%;background:#c9a94e;width:0%;transition:width 300ms linear;"></div>'
      + '</div></div>';
  }

  function row(label, id) {
    return '<span style="color:#a89668;">' + label + '</span>'
      + '<span id="losp-' + id + '" style="color:#e8dec0;text-align:right;font-variant-numeric:tabular-nums;">—</span>';
  }

  function _setBar(id, val) {
    var bar = _els['bar-' + id];
    var lab = _els['barv-' + id];
    if (!bar) return;
    if (val == null || isNaN(val)) {
      bar.style.width = '0%';
      if (lab) lab.textContent = '—';
      return;
    }
    var p = Math.max(0, Math.min(1, val));
    bar.style.width = (p * 100).toFixed(0) + '%';
    if (lab) lab.textContent = p.toFixed(2);
  }

  function _setText(el, val) {
    if (el && el.textContent !== val) el.textContent = val;
  }

  function _renderImmediate() {
    var pkt = _lastPacket;
    if (!pkt && window.LIMENHumanStatePacket && window.LIMENHumanStatePacket.getLatestHumanStatePacket) {
      pkt = window.LIMENHumanStatePacket.getLatestHumanStatePacket();
    }
    if (!pkt) {
      _setText(_els.status, 'WAITING');
      return;
    }

    _setText(_els.status, pkt.available ? 'LIVE' : 'NO SIGNAL');
    _setText(_els.phase, pkt.phase || '—');
    if (_els.phaseDot) _els.phaseDot.style.background = _phaseColor(pkt.phase);
    _setText(_els.phaseDesc, pkt.phaseDescription || '—');

    var d = pkt.derivedState || {};
    _setBar('arousal',     d.arousal);
    _setBar('coherence',   d.coherence);
    _setBar('cogload',     d.cognitiveLoad);
    _setBar('fatigue',     d.fatigue);
    _setBar('frustration', d.frustration);
    _setBar('flow',        d.flowState);
    _setBar('overload',    d.overloadRisk);

    var rsb = pkt.recommendedSystemBehavior || {};
    _setText(_els['rsb-uimode'],      rsb.uiMode || '—');
    _setText(_els['rsb-taskmode'],    rsb.taskMode || '—');
    _setText(_els['rsb-promptstyle'], rsb.promptStyle || '—');
    _setText(_els['rsb-interrupt'],   rsb.interruptLevel || '—');
    _setText(_els['rsb-autofire'],    rsb.allowAutofire ? 'yes' : 'no');

    var stats = window.LIMENHumanContextGate && window.LIMENHumanContextGate.getStats
      ? window.LIMENHumanContextGate.getStats() : null;
    if (stats) {
      _setText(_els.allowed, String(stats.allowed));
      _setText(_els.refused, String(stats.refused));
      _setText(_els.hard, String(stats.hardRefused));
    }

    _setText(_els.conf, 'conf ' + (pkt.confidence != null ? pkt.confidence.toFixed(2) : '—'));
    _setText(_els.ident, 'id ' + (pkt.identityVersion || '—'));
  }

  // ── Self-report → calibration endpoint ──
  function _sendSelfReport(accurate) {
    var pkt = _lastPacket;
    if (!pkt) return;
    var body = {
      type: 'self_report',
      reportedAccurate: !!accurate,
      packet: pkt,
      ts: Date.now()
    };
    _setText(_els.reportStatus, 'sending…');
    var headers = { 'content-type': 'application/json' };
    var tok = _operatorToken();
    if (tok) headers.authorization = 'Bearer ' + tok;
    fetch('/api/limen-operator-calibration', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          _setText(_els.reportStatus, accurate ? 'recorded · accurate' : 'recorded · inaccurate');
        } else {
          var msg = (res.j && res.j.error) ? res.j.error : 'failed';
          _setText(_els.reportStatus, 'failed: ' + msg);
        }
      })
      .catch(function (e) {
        _setText(_els.reportStatus, 'error: ' + (e && e.message || 'network'));
      });
  }

  // Optional packet publish — only when operator token is present.
  // Auth-gated server-side; no token → no publish (no tracking).
  var _lastPublishTs = 0;
  var _PUBLISH_MS = 60000;
  function _maybePublish(packet) {
    if (!_operatorToken()) return;
    var now = Date.now();
    if (now - _lastPublishTs < _PUBLISH_MS) return;
    _lastPublishTs = now;
    fetch('/api/limen-operator-calibration', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + _operatorToken()
      },
      body: JSON.stringify({ type: 'state_publish', packet: packet, ts: now })
    }).catch(function () { /* silent — best-effort */ });
  }

  // ── Boot ──
  function boot() {
    if (_mounted) return;
    // Auto-mount only on console pages — match biosensor-control-panel.js.
    // Civilization removed 2026-06-25 per operator: no operator-state biosensor panel there.
    var p = (window.location.pathname || '').replace(/^\//, '').replace(/\/$/, '');
    var ok = (p === '' || p === 'domain-console.html' || p === 'domain-console' ||
              p.indexOf('energy-') === 0);
    if (!ok) return;
    mount();
  }

  if (typeof window !== 'undefined') {
    window.LIMENOperatorStateUI = {
      mount: mount,
      isMounted: function () { return _mounted; }
    };
    if (typeof document !== 'undefined') {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(boot, 1200);
      } else {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1200); });
      }
    }
  }
})();
