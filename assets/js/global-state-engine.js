/**
 * global-state-engine.js
 * LIMEN HELIX — Global State Engine
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Reads domain stress, trends, cross-domain signals, market triage,
 * source confidence, and freshness to compute a single coherent
 * world-state mode.
 *
 * Modes: stable, pressured, fragmented, escalating, adaptive, recovering
 *
 * Output: window.LIMENGlobalState
 * Events: limen:global-state-update (every cycle), limen:global-state-shift (mode change)
 *
 * Load order: after cross-domain-detector.js, before limen-bootstrap.js
 */

(function () {
  'use strict';

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
  var MODES = ['stable', 'pressured', 'fragmented', 'escalating', 'adaptive', 'recovering'];
  var UPDATE_MS = 6000;
  var HISTORY_MAX = 12;

  // ─── State ───────────────────────────────────────────────────────────────

  var _currentMode = 'stable';
  var _prevMode = null;
  var _score = 0;
  var _confidence = 0;
  var _topDrivers = [];
  var _interval = null;
  var _scoreHistory = [];
  var _panelEl = null;
  var _fadeTimer = null;
  var _lastShownMode = null;

  // ─── Mode computation ──────────────────────────────────────────────────

  function _compute() {
    var domains = window.LIMENDomains || {};
    var audit = window.LIMENSourceAudit || {};
    var crossDomain = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) || [];
    var triage = (window.LIMENMarketStressTriage && typeof window.LIMENMarketStressTriage.getState === 'function')
      ? window.LIMENMarketStressTriage.getState() : null;
    var packets = (window.LIMENCivilizationAdapter && window.LIMENCivilizationAdapter.getAll())
                || window.LIMENCivilizationPackets || {};

    // Gather domain metrics
    var stresses = [];
    var trends = [];
    var confs = [];
    var elevatedDomains = [];
    var risingDomains = [];
    var fallingDomains = [];
    var drivers = [];

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      if (!d) continue;

      // Truth-preferred stress: brain via packet truth.stressScore wins over
      // flat civ-side d.stress. Trend/confidence remain as they were — those
      // surfaces aren't yet brain-emitted, and we don't fabricate brain
      // ownership for fields the brain doesn't produce.
      var pkt = packets[k];
      var s = (pkt && pkt.truth && typeof pkt.truth.stressScore === 'number') ? pkt.truth.stressScore
            : (typeof d.brainStress === 'number')                              ? d.brainStress
            : (d.stress || 0);
      var t = d.trend || 0;
      var c = (typeof d.brainConfidence === 'number') ? d.brainConfidence : (d.confidence || 0);

      stresses.push(s);
      trends.push(t);
      confs.push(c);

      if (s > 0.45) {
        elevatedDomains.push(k);
        // Build driver from real signals if available
        if (d.signals && d.signals.length > 0) {
          drivers.push(d.signals[0]);
        } else {
          drivers.push(k + ' stress elevated');
        }
      }
      if (t > 0.03) risingDomains.push(k);
      if (t < -0.03) fallingDomains.push(k);
    }

    // Average stress
    var avgStress = 0;
    var avgConf = 0;
    if (stresses.length > 0) {
      for (var a = 0; a < stresses.length; a++) avgStress += stresses[a];
      avgStress = avgStress / stresses.length;
      for (var b = 0; b < confs.length; b++) avgConf += confs[b];
      avgConf = avgConf / confs.length;
    }

    // Market triage factor
    var marketStress = 0;
    if (triage && triage.combined !== undefined) {
      marketStress = triage.combined;
    }

    // Cross-domain pattern count and severity
    var crossCount = crossDomain.length;
    var crossMaxSeverity = 0;
    for (var x = 0; x < crossDomain.length; x++) {
      if (crossDomain[x].severity > crossMaxSeverity) {
        crossMaxSeverity = crossDomain[x].severity;
      }
      if (crossDomain[x].pattern) {
        drivers.push(crossDomain[x].pattern);
      }
    }

    // Trend coherence: are domains moving together or apart?
    var trendVariance = _variance(trends);
    var netTrend = 0;
    for (var nt = 0; nt < trends.length; nt++) netTrend += trends[nt];
    netTrend = trends.length > 0 ? netTrend / trends.length : 0;

    // Track score history for recovering detection
    _scoreHistory.push(avgStress);
    if (_scoreHistory.length > HISTORY_MAX) _scoreHistory.shift();

    // ─── Mode scoring ───────────────────────────────────────────────

    var scores = {
      stable: 0,
      pressured: 0,
      fragmented: 0,
      escalating: 0,
      adaptive: 0,
      recovering: 0
    };

    // STABLE: most domains low, trends flat
    if (elevatedDomains.length <= 1 && Math.abs(netTrend) < 0.02 && avgStress < 0.30) {
      scores.stable = 1.0 - avgStress;
    } else if (avgStress < 0.25) {
      scores.stable = 0.6;
    }

    // PRESSURED: 2-3 domains elevated
    if (elevatedDomains.length >= 2 && elevatedDomains.length <= 4) {
      scores.pressured = 0.5 + (elevatedDomains.length * 0.1) + (avgStress * 0.3);
    }

    // FRAGMENTED: domain signals conflict (high variance, mixed trends)
    if (trendVariance > 0.003 && risingDomains.length > 0 && fallingDomains.length > 0) {
      scores.fragmented = 0.4 + (trendVariance * 10) + (Math.abs(risingDomains.length - fallingDomains.length) < 2 ? 0.2 : 0);
    }

    // ESCALATING: multiple domains rising together with acceleration
    if (risingDomains.length >= 3 && netTrend > 0.03 && elevatedDomains.length >= 2) {
      scores.escalating = 0.5 + (risingDomains.length * 0.1) + (netTrend * 5);
      if (crossCount > 0) scores.escalating += 0.15;
    }

    // ADAPTIVE: stress present but stabilizing (some rising, some improving)
    if (elevatedDomains.length >= 1 && fallingDomains.length >= 1 && risingDomains.length <= 2) {
      scores.adaptive = 0.4 + (fallingDomains.length * 0.1);
    }

    // RECOVERING: net stress falling over several cycles
    if (_scoreHistory.length >= 4) {
      var recentHalf = _scoreHistory.slice(Math.floor(_scoreHistory.length / 2));
      var olderHalf = _scoreHistory.slice(0, Math.floor(_scoreHistory.length / 2));
      var recentAvg = _avg(recentHalf);
      var olderAvg = _avg(olderHalf);
      if (olderAvg - recentAvg > 0.03 && recentAvg < 0.40) {
        scores.recovering = 0.5 + ((olderAvg - recentAvg) * 5);
      }
    }

    // Add market stress boost to pressured/escalating
    if (marketStress > 0.50) {
      scores.pressured += 0.15;
      scores.escalating += 0.10;
      drivers.push('market stress elevated');
    }

    // Add cross-domain boost
    if (crossMaxSeverity > 0.50) {
      scores.pressured += 0.10;
      scores.escalating += 0.10;
    }

    // ─── Pick winner ────────────────────────────────────────────────

    var bestMode = 'stable';
    var bestScore = 0;
    for (var m = 0; m < MODES.length; m++) {
      if (scores[MODES[m]] > bestScore) {
        bestScore = scores[MODES[m]];
        bestMode = MODES[m];
      }
    }

    // Normalize score to 0-1
    _score = _clamp(Math.round(bestScore * 100) / 100, 0, 1);
    _confidence = _clamp(Math.round(avgConf * 100) / 100, 0, 1);

    // Deduplicate and limit drivers
    var uniqueDrivers = [];
    var seen = {};
    for (var dr = 0; dr < drivers.length && uniqueDrivers.length < 4; dr++) {
      // A driver should be a display string, but some sources (e.g. a domain's
      // signals[0]) can hand us a structured object/number. Coerce safely — a
      // single malformed driver was throwing here and ABORTING the whole compute
      // BEFORE it dispatched limen:global-state-update, so the exec strip + the
      // Civilization tab silently froze at stale/zero (the "0% confidence" bug).
      var dv = drivers[dr];
      if (typeof dv !== 'string') dv = (dv && (dv.signal || dv.text || dv.label || dv.name)) || (dv != null ? String(dv) : '');
      if (!dv) continue;
      var key = dv.toLowerCase();
      if (!seen[key]) {
        seen[key] = true;
        uniqueDrivers.push(dv);
      }
    }
    _topDrivers = uniqueDrivers;

    // Detect mode shift
    _prevMode = _currentMode;
    _currentMode = bestMode;

    var state = {
      mode: _currentMode,
      score: _score,
      confidence: _confidence,
      topDrivers: _topDrivers,
      updated: Date.now()
    };

    window.LIMENGlobalState = state;
    _dispatch('limen:global-state-update', state);

    if (_prevMode && _prevMode !== _currentMode) {
      _dispatch('limen:global-state-shift', {
        from: _prevMode,
        to: _currentMode,
        score: _score,
        confidence: _confidence,
        topDrivers: _topDrivers,
        updated: Date.now()
      });
    }

    _renderBadge();
  }

  // ─── Badge UI ──────────────────────────────────────────────────────────

  function _ensureBadge() {
    if (_panelEl) return;
    _panelEl = document.createElement('div');
    _panelEl.id = 'limen-global-state-badge';
    _panelEl.style.cssText = [
      'position:fixed',
      'top:8px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(8,9,12,0.88)',
      'border:1px solid rgba(201,169,78,0.15)',
      'padding:6px 14px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.45rem',
      'letter-spacing:1.8px',
      'z-index:9995',
      'border-radius:2px',
      'pointer-events:none',
      'box-shadow:0 2px 6px rgba(0,0,0,0.4)',
      'line-height:1.6',
      'text-align:center',
      'display:none'
    ].join(';');
    document.body.appendChild(_panelEl);
  }

  var MODE_COLORS = {
    stable:     'rgba(90,181,160,0.8)',
    pressured:  '#d4a44e',
    fragmented: '#c97a4e',
    escalating: '#e85454',
    adaptive:   '#5ab5a0',
    recovering: 'rgba(90,181,160,0.9)'
  };

  function _renderBadge() {
    _ensureBadge();

    var gold = 'rgba(201,169,78,0.4)';
    var modeColor = MODE_COLORS[_currentMode] || gold;
    var confPct = Math.round(_confidence * 100);

    // Compute source basis from audit
    var audit = window.LIMENSourceAudit || {};
    var liveCount = 0;
    var partialCount = 0;
    var fallbackCount = 0;
    for (var si = 0; si < DOMAIN_KEYS.length; si++) {
      var aud = audit[DOMAIN_KEYS[si]];
      if (!aud) { fallbackCount++; continue; }
      if (aud.status === 'LIVE') liveCount++;
      else if (aud.status === 'PARTIAL') partialCount++;
      else fallbackCount++;
    }
    var basisLabel = liveCount + ' LIVE';
    if (partialCount > 0) basisLabel += ' ' + partialCount + ' PARTIAL';
    if (fallbackCount > 0) basisLabel += ' ' + fallbackCount + ' FALLBACK';
    var freshLabel = _freshLabel(Date.now());

    var html = '<div style="color:' + gold + ';font-size:0.42rem;margin-bottom:2px">GLOBAL STATE</div>';
    html += '<div style="color:' + modeColor + ';font-size:0.55rem;letter-spacing:2.5px">' + _currentMode.toUpperCase() + '</div>';
    html += '<div style="color:' + gold + ';font-size:0.40rem">confidence: ' + confPct + '%</div>';
    html += '<div style="color:' + gold + ';font-size:0.38rem">basis: ' + basisLabel + '</div>';
    html += '<div style="color:' + gold + ';font-size:0.38rem">' + freshLabel + '</div>';

    // Gate visibility behind panel state manager
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-global-state-badge')) {
      return;
    }

    _panelEl.innerHTML = html;

    // Show badge on mode change or first render, then auto-fade after 5s
    var modeChanged = _lastShownMode !== _currentMode;
    if (modeChanged || !_lastShownMode) {
      _lastShownMode = _currentMode;
      // Cancel pending fade
      if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }
      // Show immediately
      _panelEl.style.display = 'block';
      _panelEl.style.opacity = '1';
      _panelEl.style.transition = 'none';
      // Auto-fade after 5 seconds
      _fadeTimer = setTimeout(function () {
        _panelEl.style.transition = 'opacity 1.5s ease';
        _panelEl.style.opacity = '0';
        _fadeTimer = setTimeout(function () {
          _panelEl.style.display = 'none';
          _fadeTimer = null;
        }, 1500);
      }, 5000);
    }
    // If mode hasn't changed and badge is faded, leave it hidden
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    if (_interval) return;
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        _compute();
        _interval = setInterval(function () { if (!document.hidden) _compute(); }, UPDATE_MS);
        window.addEventListener('limen:global-state-shift', _onShiftForNarrator);
      });
    } else {
      _compute();
      _interval = setInterval(function () { if (!document.hidden) _compute(); }, UPDATE_MS);
      window.addEventListener('limen:global-state-shift', _onShiftForNarrator);
    }
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    window.removeEventListener('limen:global-state-shift', _onShiftForNarrator);
    if (_panelEl) _panelEl.style.display = 'none';
  }

  // ─── Narrator integration ─────────────────────────────────────────────

  function _onShiftForNarrator(e) {
    var detail = e.detail;
    if (!detail) return;
    // Dispatch a narrator-compatible event
    _dispatch('limen:phase-change', {
      from: detail.from,
      to: detail.to,
      type: 'global-state',
      score: detail.score,
      confidence: detail.confidence,
      topDrivers: detail.topDrivers
    });
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function _avg(arr) {
    if (arr.length === 0) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function _variance(arr) {
    if (arr.length < 2) return 0;
    var mean = _avg(arr);
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
      var diff = arr[i] - mean;
      sum += diff * diff;
    }
    return sum / arr.length;
  }

  function _freshLabel(now) {
    var state = window.LIMENGlobalState;
    if (!state || !state.updated) return 'updated: unknown';
    var age = now - state.updated;
    if (age < 60000) return 'updated: just now';
    if (age < 3600000) return 'updated: ' + Math.floor(age / 60000) + 'm ago';
    return 'updated: ' + Math.floor(age / 3600000) + 'h ago';
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENGlobalState = {
    mode: 'stable',
    score: 0,
    confidence: 0,
    topDrivers: [],
    updated: null
  };

  window.LIMENGlobalStateEngine = {
    start: start,
    stop: stop
  };

})();
