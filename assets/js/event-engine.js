/**
 * event-engine.js
 * LIMEN HELIX — Event Synthesis Engine
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Converts raw domain stress, balance, global state, cross-domain, and
 * market data into explicit named events with lifecycle (start/update/end).
 *
 * Depends on: window.LIMENDomains, window.LIMENBalance,
 *             window.LIMENGlobalState, window.LIMENCrossDomain,
 *             window.LIMENSourceAudit, window.LIMENMarketStressTriage
 * Listens: limen:domain-update
 * Emits: limen:event, limen:event-start, limen:event-update, limen:event-end
 * Output: window.LIMENEvents
 *
 * Load order: after balance-meter.js, global-state-engine.js
 */

(function () {
  'use strict';

  var UPDATE_MS = 8000;
  var MAX_EVENTS = 30;
  var NOISE_THRESHOLD = 0.25;
  var MATERIAL_STRESS = 0.35;
  var END_HYSTERESIS = 0.20;

  // ─── Event type definitions ─────────────────────────────────────────────

  var EVENT_DEFS = [
    {
      type: 'logistics_pressure',
      domains: ['energy', 'supplyChain'],
      test: function (d) {
        return d.energy.stress >= MATERIAL_STRESS && d.supplyChain.stress >= MATERIAL_STRESS;
      },
      endTest: function (d) {
        return d.energy.stress < END_HYSTERESIS || d.supplyChain.stress < END_HYSTERESIS;
      },
      drivers: function (d) {
        return _pickDrivers(['energy', 'supplyChain'], d, [
          'oil price pressure', 'freight cost elevation', 'supply chain disruption'
        ]);
      }
    },
    {
      type: 'energy_shock',
      domains: ['energy'],
      test: function (d) {
        return d.energy.stress >= 0.60 && (d.energy.trend || 0) > 0.03;
      },
      endTest: function (d) {
        return d.energy.stress < 0.40 || (d.energy.trend || 0) < -0.02;
      },
      drivers: function (d) {
        return _pickDrivers(['energy'], d, [
          'rapid energy price movement', 'supply disruption signal'
        ]);
      }
    },
    {
      type: 'financial_tightening',
      domains: ['economy', 'supplyChain'],
      test: function (d) {
        return d.economy.stress >= 0.45 && d.supplyChain.stress >= 0.30;
      },
      endTest: function (d) {
        return d.economy.stress < 0.25;
      },
      drivers: function (d) {
        return _pickDrivers(['economy', 'supplyChain'], d, [
          'employment contraction', 'demand-supply imbalance', 'credit conditions tightening'
        ]);
      }
    },
    {
      type: 'medical_stress_cluster',
      domains: ['health', 'research'],
      test: function (d) {
        return d.health.stress >= MATERIAL_STRESS && d.research.stress >= MATERIAL_STRESS;
      },
      endTest: function (d) {
        return d.health.stress < END_HYSTERESIS && d.research.stress < END_HYSTERESIS;
      },
      drivers: function (d) {
        return _pickDrivers(['health', 'research'], d, [
          'adverse event reporting surge', 'clinical activity spike', 'research volume anomaly'
        ]);
      }
    },
    {
      type: 'innovation_acceleration',
      domains: ['technology', 'research'],
      test: function (d) {
        return d.technology.stress >= 0.30 && d.research.stress >= 0.30 &&
               ((d.technology.trend || 0) > 0.02 || (d.research.trend || 0) > 0.02);
      },
      endTest: function (d) {
        return d.technology.stress < 0.15 && d.research.stress < 0.15;
      },
      drivers: function (d) {
        return _pickDrivers(['technology', 'research'], d, [
          'patent activity surge', 'research publication spike', 'disruption cycle signal'
        ]);
      }
    },
    {
      type: 'recovery_signal',
      domains: [],
      test: function (d, ctx) {
        return ctx.globalMode === 'recovering' ||
               (ctx.fallingDomains >= 3 && ctx.avgStress < 0.35);
      },
      endTest: function (d, ctx) {
        return ctx.globalMode !== 'recovering' && ctx.fallingDomains < 2;
      },
      drivers: function (d, ctx) {
        var list = [];
        if (ctx.globalMode === 'recovering') list.push('global state recovering');
        if (ctx.fallingDomains > 0) list.push(ctx.fallingDomains + ' domains trending down');
        if (list.length === 0) list.push('stress levels normalizing');
        return list;
      }
    },
    {
      type: 'feed_degradation',
      domains: [],
      test: function (d, ctx) {
        return ctx.fallbackCount >= 4;
      },
      endTest: function (d, ctx) {
        return ctx.fallbackCount <= 1;
      },
      drivers: function (d, ctx) {
        return [ctx.fallbackCount + ' domains on fallback data', 'reduced confidence in readings'];
      }
    },
    {
      type: 'systemic_fragmentation',
      domains: [],
      test: function (d, ctx) {
        return ctx.globalMode === 'fragmented';
      },
      endTest: function (d, ctx) {
        return ctx.globalMode !== 'fragmented';
      },
      drivers: function (d, ctx) {
        return ['conflicting domain signals', 'trend divergence detected'];
      }
    },
    {
      type: 'escalation_rise',
      domains: [],
      test: function (d, ctx) {
        return ctx.globalMode === 'escalating' || ctx.risingDomains >= 4;
      },
      endTest: function (d, ctx) {
        return ctx.globalMode !== 'escalating' && ctx.risingDomains < 2;
      },
      drivers: function (d, ctx) {
        var list = [];
        if (ctx.risingDomains > 0) list.push(ctx.risingDomains + ' domains rising simultaneously');
        if (ctx.crossCount > 0) list.push(ctx.crossCount + ' cross-domain pattern(s) active');
        if (list.length === 0) list.push('systemic stress accelerating');
        return list;
      }
    },
    {
      type: 'stabilization_shift',
      domains: [],
      test: function (d, ctx) {
        return ctx.improvingDomains >= 3 && ctx.avgStress > 0.25;
      },
      endTest: function (d, ctx) {
        return ctx.improvingDomains < 2;
      },
      drivers: function (d, ctx) {
        var list = [];
        if (ctx.improvingDomains > 0) list.push(ctx.improvingDomains + ' domains showing balance improvement');
        list.push('stabilizing pressure emerging');
        return list;
      }
    }
  ];

  // ─── State ──────────────────────────────────────────────────────────────

  var _activeEvents = {};  // type → event object
  var _eventLog = [];
  var _idCounter = 0;
  var _interval = null;
  var _panelEl = null;

  // ─── Core evaluation ───────────────────────────────────────────────────

  function _evaluate() {
    var domains = window.LIMENDomains || {};
    var balance = window.LIMENBalance || {};
    var globalState = window.LIMENGlobalState || {};
    var audit = window.LIMENSourceAudit || {};
    var crossDomain = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) || [];
    var now = Date.now();

    // Build safe domain map (never undefined)
    var d = {};
    var KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
    for (var i = 0; i < KEYS.length; i++) {
      d[KEYS[i]] = domains[KEYS[i]] || { stress: 0, trend: 0, signals: [], confidence: 0 };
    }

    // Build context
    var risingDomains = 0;
    var fallingDomains = 0;
    var improvingDomains = 0;
    var fallbackCount = 0;
    var totalStress = 0;
    for (var j = 0; j < KEYS.length; j++) {
      var dk = KEYS[j];
      var dd = d[dk];
      totalStress += (dd.stress || 0);
      if ((dd.trend || 0) > 0.02) risingDomains++;
      if ((dd.trend || 0) < -0.02) fallingDomains++;
      var bal = balance[dk];
      if (bal && bal.state === 'improving') improvingDomains++;
      var aud = audit[dk];
      if (!aud || aud.status === 'FALLBACK') fallbackCount++;
    }

    var ctx = {
      globalMode: globalState.mode || 'stable',
      risingDomains: risingDomains,
      fallingDomains: fallingDomains,
      improvingDomains: improvingDomains,
      fallbackCount: fallbackCount,
      avgStress: totalStress / KEYS.length,
      crossCount: crossDomain.length
    };

    // Evaluate each event definition
    for (var e = 0; e < EVENT_DEFS.length; e++) {
      var def = EVENT_DEFS[e];
      var existing = _activeEvents[def.type];

      if (existing) {
        // Check if event should end
        if (def.endTest(d, ctx)) {
          existing.status = 'ended';
          existing.ended = now;
          _dispatch('limen:event-end', existing);
          _dispatch('limen:event', { action: 'end', event: existing });
          delete _activeEvents[def.type];
        } else {
          // Update existing event
          var severity = _computeSeverity(def, d, ctx, audit);
          var confidence = _computeConfidence(def.domains, audit);
          var drivers = def.drivers(d, ctx);
          existing.severity = severity;
          existing.confidence = confidence;
          existing.drivers = drivers;
          existing.updated = now;
          _dispatch('limen:event-update', existing);
          _dispatch('limen:event', { action: 'update', event: existing });
        }
      } else {
        // Check if event should start
        if (def.test(d, ctx)) {
          var severity2 = _computeSeverity(def, d, ctx, audit);
          if (severity2 < NOISE_THRESHOLD) continue;

          var evt = {
            id: 'evt_' + String(++_idCounter).padStart(3, '0'),
            type: def.type,
            severity: severity2,
            confidence: _computeConfidence(def.domains, audit),
            status: 'active',
            domains: def.domains.length > 0 ? def.domains.slice() : _inferDomains(def, d, ctx),
            drivers: def.drivers(d, ctx),
            firstSeen: now,
            updated: now
          };

          _activeEvents[def.type] = evt;
          _eventLog.push(evt);
          if (_eventLog.length > MAX_EVENTS) _eventLog.shift();

          _dispatch('limen:event-start', evt);
          _dispatch('limen:event', { action: 'start', event: evt });

          // Narrate new events (skip if already seen from rehydration)
          var store = window.LIMENFeedStore;
          if (store && store.hasSeen('event-start', evt.id, evt.type, 60000)) {
            // Already narrated before refresh — skip
          } else {
            if (store) store.markSeen('event-start', evt.id, evt.type);
            _narrateEvent(evt);
          }
        }
      }
    }

    // Publish
    var activeList = [];
    for (var ak in _activeEvents) {
      activeList.push(_activeEvents[ak]);
    }
    activeList.sort(function (a, b) { return b.severity - a.severity; });

    window.LIMENEvents = {
      active: activeList,
      log: _eventLog,
      count: activeList.length,
      updated: now
    };

    // Persist event state for refresh survival
    var store = window.LIMENFeedStore;
    if (store) store.saveEvents(_activeEvents, _eventLog);

    _renderPanel();
  }

  // ─── Severity + confidence ──────────────────────────────────────────────

  function _computeSeverity(def, d, ctx, audit) {
    if (def.domains.length === 0) {
      // Context-based events
      if (def.type === 'recovery_signal' || def.type === 'stabilization_shift') return 0.35;
      if (def.type === 'feed_degradation') return 0.30 + (ctx.fallbackCount * 0.05);
      if (def.type === 'systemic_fragmentation') return 0.55;
      if (def.type === 'escalation_rise') return 0.65 + (ctx.risingDomains * 0.03);
      return 0.40;
    }

    var total = 0;
    for (var i = 0; i < def.domains.length; i++) {
      total += (d[def.domains[i]].stress || 0);
    }
    var avg = total / def.domains.length;
    return _clamp(_round(avg * 1.1), 0, 1);
  }

  function _computeConfidence(eventDomains, audit) {
    if (eventDomains.length === 0) {
      // Context events: use average audit confidence
      var total = 0;
      var count = 0;
      for (var k in audit) {
        total += (audit[k].confidence || 0);
        count++;
      }
      return count > 0 ? _clamp(_round(total / count), 0, 1) : 0.3;
    }

    var sum = 0;
    for (var i = 0; i < eventDomains.length; i++) {
      var a = audit[eventDomains[i]];
      if (a) {
        // LIVE=0.9, PARTIAL=0.5, FALLBACK=0.1
        if (a.status === 'LIVE') sum += 0.9;
        else if (a.status === 'PARTIAL') sum += 0.5;
        else sum += 0.1;
      } else {
        sum += 0.1;
      }
    }
    return _clamp(_round(sum / eventDomains.length), 0, 1);
  }

  function _inferDomains(def, d, ctx) {
    // For context events, list the most stressed domains
    var KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
    var sorted = KEYS.slice().sort(function (a, b) {
      return (d[b].stress || 0) - (d[a].stress || 0);
    });
    return sorted.slice(0, 2);
  }

  // ─── Driver extraction ──────────────────────────────────────────────────

  function _pickDrivers(domainKeys, d, fallbacks) {
    var drivers = [];
    for (var i = 0; i < domainKeys.length; i++) {
      var sig = d[domainKeys[i]].signals || [];
      for (var s = 0; s < sig.length && drivers.length < 3; s++) {
        drivers.push(sig[s]);
      }
    }
    if (drivers.length === 0) {
      return fallbacks.slice(0, 3);
    }
    return drivers;
  }

  // ─── Narrator integration ──────────────────────────────────────────────

  var EVENT_LABELS = {
    logistics_pressure: 'A logistics pressure event is active.',
    energy_shock: 'An energy shock event has been detected.',
    financial_tightening: 'Financial tightening conditions are emerging.',
    medical_stress_cluster: 'A medical stress cluster is forming.',
    innovation_acceleration: 'Innovation acceleration detected across research and technology.',
    recovery_signal: 'Recovery signals are emerging across the system.',
    feed_degradation: 'Data feed degradation detected. Confidence reduced.',
    systemic_fragmentation: 'Systemic fragmentation detected. Domain signals are conflicting.',
    escalation_rise: 'Escalation is rising. Multiple domains accelerating together.',
    stabilization_shift: 'A stabilization shift is emerging despite elevated stress.'
  };

  function _narrateEvent(evt) {
    var body = EVENT_LABELS[evt.type] || ('Event detected: ' + evt.type + '.');

    var options = [
      { label: 'inspect event', type: 'analysis' },
      { label: 'trace affected domains', type: 'analysis' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'monitoring',
      to: 'event-active',
      type: 'system-event',
      body: body,
      topDrivers: evt.drivers,
      options: options,
      eventType: evt.type,
      eventId: evt.id
    });
  }

  // ─── UI panel (event rail) ─────────────────────────────────────────────

  function _ensurePanel() {
    if (_panelEl) return;
    _panelEl = document.createElement('div');
    _panelEl.id = 'limen-event-rail';
    _panelEl.style.cssText = [
      'position:fixed',
      'top:60px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(8,9,12,0.90)',
      'border:1px solid rgba(201,169,78,0.12)',
      'padding:5px 10px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.42rem',
      'letter-spacing:1.5px',
      'z-index:9994',
      'border-radius:2px',
      'pointer-events:none',
      'box-shadow:0 2px 6px rgba(0,0,0,0.4)',
      'line-height:1.7',
      'display:none',
      'max-width:420px'
    ].join(';');
    document.body.appendChild(_panelEl);
  }

  function _renderPanel() {
    _ensurePanel();

    var events = window.LIMENEvents;
    if (!events || events.count === 0) {
      _panelEl.style.display = 'none';
      return;
    }

    var active = events.active;
    var top = active.slice(0, 4);
    var gold = 'rgba(201,169,78,0.4)';
    var teal = '#5ab5a0';
    var red = '#e85454';
    var orange = '#d4a44e';
    var dimText = 'rgba(200,195,184,0.5)';
    var dim = 'rgba(201,169,78,0.3)';

    var html = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
    html += '<span style="color:' + gold + ';font-size:0.40rem;letter-spacing:2px">EVENTS</span>';

    for (var i = 0; i < top.length; i++) {
      var evt = top[i];
      var sevColor = teal;
      if (evt.severity > 0.65) sevColor = red;
      else if (evt.severity > 0.40) sevColor = orange;

      var sevPct = Math.round(evt.severity * 100);
      var confPct = Math.round(evt.confidence * 100);
      var fresh = _freshness(evt.updated);
      var typeLabel = evt.type.replace(/_/g, ' ');

      html += '<span style="color:' + sevColor + ';border:1px solid ' + sevColor + ';border-radius:2px;padding:1px 5px;font-size:0.40rem">';
      html += typeLabel;
      html += '<span style="color:' + dimText + ';font-size:0.36rem"> ' + sevPct + '% c:' + confPct + '% ' + fresh + '</span>';
      html += '</span>';
    }

    html += '</div>';
    // Gate visibility behind panel state manager
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-event-rail')) {
      return;
    }
    _panelEl.style.display = 'block';
    _panelEl.innerHTML = html;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function _rehydrateEvents() {
    var store = window.LIMENFeedStore;
    if (!store) return;
    var saved = store.loadEvents();
    if (!saved) return;

    // Restore active events
    if (saved.active) {
      for (var type in saved.active) {
        var evt = saved.active[type];
        // Only restore events that aren't too old (30 minutes)
        if (evt.updated && (Date.now() - evt.updated) < 30 * 60 * 1000) {
          _activeEvents[type] = evt;
          // Mark as seen to prevent duplicate narration
          if (store.markSeen) store.markSeen('event-start', evt.id, type);
        }
      }
    }

    // Restore event log
    if (saved.log && saved.log.length > 0) {
      for (var i = 0; i < saved.log.length; i++) {
        var entry = saved.log[i];
        // Deduplicate by ID
        var isDupe = false;
        for (var j = 0; j < _eventLog.length; j++) {
          if (_eventLog[j].id === entry.id) { isDupe = true; break; }
        }
        if (!isDupe) _eventLog.push(entry);
      }
      // Enforce max size
      while (_eventLog.length > MAX_EVENTS) _eventLog.shift();
      // Set ID counter past restored IDs
      for (var k = 0; k < _eventLog.length; k++) {
        var numPart = parseInt((_eventLog[k].id || '').replace('evt_', ''), 10);
        if (!isNaN(numPart) && numPart >= _idCounter) _idCounter = numPart + 1;
      }
    }

    console.log('[LIMEN] event-engine: rehydrated ' + Object.keys(_activeEvents).length + ' active, ' + _eventLog.length + ' log entries');
  }

  function start() {
    if (_interval) return;

    // Rehydrate from persisted store before first evaluation
    _rehydrateEvents();

    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        window.addEventListener('limen:domain-update', _onDomainUpdate);
        _evaluate();
        _interval = setInterval(_evaluate, UPDATE_MS);
      });
    } else {
      window.addEventListener('limen:domain-update', _onDomainUpdate);
      _evaluate();
      _interval = setInterval(_evaluate, UPDATE_MS);
    }
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    if (_panelEl) _panelEl.style.display = 'none';
  }

  function _onDomainUpdate() {
    _evaluate();
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function _round(v) { return Math.round(v * 100) / 100; }

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

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENEvents = {
    active: [],
    log: [],
    count: 0,
    updated: null
  };

  window.LIMENEventEngine = {
    start: start,
    stop: stop
  };

})();
