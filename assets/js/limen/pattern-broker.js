/**
 * LIMEN Helix — Pattern Broker (the inter-brain bus)
 *
 * Pub/sub fabric for the fractal-recursive brain network. Every brain
 * (master, civilization, connectome, the 20 domain brains, and any
 * future leaf brains) registers with the broker, publishes its
 * pattern envelopes, and subscribes to other brains' patterns.
 *
 * Audit-trail is append-only (H2). All emissions verified against
 * pattern-envelope contract before relay.
 *
 * Exposed via window.LIMENPatternBroker.
 *
 * Depends on: window.LIMENPatternEnvelope (pattern-envelope.js).
 */
(function (root) {
  'use strict';

  var Envelope = root.LIMENPatternEnvelope;
  if (!Envelope) {
    console.error('[LIMENPatternBroker] requires LIMENPatternEnvelope to be loaded first');
    return;
  }

  // ── State ──────────────────────────────────────────────────────────
  var _subscribers = {};      // brainId → [{ subscriberId, handler }]
  var _latest = {};           // brainId → last sealed envelope
  var _registry = {};         // brainId → { kind, registeredAt, lastCycleId }
  var _auditLog = [];         // append-only ring buffer
  var _auditMax = 5000;
  var _auditSeq = 0;
  var _globalListeners = [];  // [{ id, handler }] — receive every emission
  var _emitDepth = 0;
  var _emitDepthMax = 8;      // re-entrancy guard

  // ── Registry ───────────────────────────────────────────────────────
  function register(brainId, kind, meta) {
    if (!brainId) throw new Error('register requires brainId');
    if (_registry[brainId]) {
      // Re-register is fine — bump registeredAt, keep history
      _registry[brainId].registeredAt = Date.now();
      _registry[brainId].kind = kind || _registry[brainId].kind;
      _registry[brainId].meta = meta || _registry[brainId].meta;
    } else {
      _registry[brainId] = {
        brainId: brainId,
        kind: kind || 'unknown',
        meta: meta || {},
        registeredAt: Date.now(),
        lastCycleId: -1,
        emitCount: 0
      };
    }
    _audit('register', { brainId: brainId, kind: kind });
    return _registry[brainId];
  }

  function unregister(brainId) {
    if (_registry[brainId]) delete _registry[brainId];
    if (_subscribers[brainId]) delete _subscribers[brainId];
    if (_latest[brainId]) delete _latest[brainId];
    _audit('unregister', { brainId: brainId });
  }

  function getRegistry() {
    var out = {};
    for (var k in _registry) if (_registry.hasOwnProperty(k)) out[k] = _registry[k];
    return out;
  }

  // ── Subscribe ──────────────────────────────────────────────────────
  function subscribe(subscriberId, brainId, handler) {
    if (!brainId || typeof handler !== 'function') {
      throw new Error('subscribe requires brainId + handler');
    }
    if (!_subscribers[brainId]) _subscribers[brainId] = [];
    var sub = { subscriberId: subscriberId || ('anon-' + Math.random().toString(36).slice(2, 8)), handler: handler };
    _subscribers[brainId].push(sub);
    _audit('subscribe', { subscriberId: sub.subscriberId, brainId: brainId });

    // Deliver the most recent envelope immediately so subscribers don't
    // wait a full cycle for state.
    var latest = _latest[brainId];
    if (latest) {
      try { handler(latest); } catch (e) { console.error('[broker] sync handler error', e); }
    }

    return function unsubscribe() {
      var arr = _subscribers[brainId] || [];
      for (var i = arr.length - 1; i >= 0; i--) {
        if (arr[i] === sub) arr.splice(i, 1);
      }
      _audit('unsubscribe', { subscriberId: sub.subscriberId, brainId: brainId });
    };
  }

  function subscribeAll(subscriberId, handler) {
    if (typeof handler !== 'function') throw new Error('subscribeAll requires handler');
    var entry = { id: subscriberId || ('anon-' + Math.random().toString(36).slice(2, 8)), handler: handler };
    _globalListeners.push(entry);
    _audit('subscribeAll', { subscriberId: entry.id });
    return function unsubscribe() {
      for (var i = _globalListeners.length - 1; i >= 0; i--) {
        if (_globalListeners[i] === entry) _globalListeners.splice(i, 1);
      }
      _audit('unsubscribeAll', { subscriberId: entry.id });
    };
  }

  // ── Emit ───────────────────────────────────────────────────────────
  function emit(envelope) {
    if (!envelope || !envelope.brainId) {
      _audit('emit-reject', { reason: 'no-brainId' });
      return { ok: false, reason: 'no-brainId' };
    }

    // Re-entrancy guard
    if (_emitDepth >= _emitDepthMax) {
      _audit('emit-reject', { brainId: envelope.brainId, reason: 'depth-exceeded', depth: _emitDepth });
      return { ok: false, reason: 'depth-exceeded' };
    }

    // Verify envelope integrity (H1)
    var v = Envelope.verify(envelope);
    if (!v.ok) {
      _audit('emit-reject', { brainId: envelope.brainId, reason: 'verify-fail', detail: v.reason });
      return { ok: false, reason: 'verify-fail', detail: v.reason };
    }

    // Skip duplicate emission (H4 idempotency — same sig = same content)
    var prev = _latest[envelope.brainId];
    if (prev && prev.pattern.signature === envelope.pattern.signature) {
      _audit('emit-dedupe', { brainId: envelope.brainId, sig: envelope.pattern.signature });
      return { ok: true, deduped: true, sig: envelope.pattern.signature };
    }

    // Auto-register if first emission
    if (!_registry[envelope.brainId]) {
      register(envelope.brainId, envelope.brainKind || 'unknown', {});
    }

    _latest[envelope.brainId] = envelope;
    _registry[envelope.brainId].lastCycleId = envelope.cycleId;
    _registry[envelope.brainId].emitCount = (_registry[envelope.brainId].emitCount || 0) + 1;
    _registry[envelope.brainId].lastEmitAt = Date.now();

    _audit('emit', {
      brainId: envelope.brainId,
      cycleId: envelope.cycleId,
      sig: envelope.pattern.signature,
      degraded: envelope.degraded,
      salience: envelope.pattern.salience,
      artifactCount: (envelope.pattern.artifacts || []).length
    });

    // Deliver to per-brain subscribers
    _emitDepth++;
    try {
      var subs = (_subscribers[envelope.brainId] || []).slice();
      for (var i = 0; i < subs.length; i++) {
        try { subs[i].handler(envelope); }
        catch (e) {
          _audit('handler-error', { subscriberId: subs[i].subscriberId, brainId: envelope.brainId, error: String(e && e.message || e) });
        }
      }

      // Deliver to global listeners
      var gs = _globalListeners.slice();
      for (var j = 0; j < gs.length; j++) {
        try { gs[j].handler(envelope); }
        catch (e2) {
          _audit('handler-error', { subscriberId: gs[j].id, scope: 'global', error: String(e2 && e2.message || e2) });
        }
      }
    } finally {
      _emitDepth--;
    }

    // Optional: notify DOM via custom event (decoupled UI binding)
    try {
      if (typeof CustomEvent === 'function' && root.dispatchEvent) {
        root.dispatchEvent(new CustomEvent('limen:brain-pattern', { detail: envelope }));
      }
    } catch (_) { /* SSR / non-DOM */ }

    return { ok: true, sig: envelope.pattern.signature };
  }

  function getLatest(brainId) {
    return _latest[brainId] || null;
  }

  function getAllLatest() {
    var out = {};
    for (var k in _latest) if (_latest.hasOwnProperty(k)) out[k] = _latest[k];
    return out;
  }

  // ── Audit ──────────────────────────────────────────────────────────
  function _audit(type, detail) {
    _auditSeq++;
    _auditLog.push({
      seq: _auditSeq,
      ts: Date.now(),
      type: String(type || 'unknown'),
      detail: detail || {}
    });
    if (_auditLog.length > _auditMax) {
      _auditLog.splice(0, _auditLog.length - _auditMax);
    }
  }

  function auditLog(filter) {
    if (!filter) return _auditLog.slice();
    var out = [];
    for (var i = 0; i < _auditLog.length; i++) {
      var e = _auditLog[i];
      if (filter.type && e.type !== filter.type) continue;
      if (filter.brainId && e.detail && e.detail.brainId !== filter.brainId) continue;
      if (filter.since && e.ts < filter.since) continue;
      out.push(e);
    }
    return out;
  }

  // ── Stats (for UI) ─────────────────────────────────────────────────
  function stats() {
    var brains = Object.keys(_registry).length;
    var subs = 0;
    for (var k in _subscribers) if (_subscribers.hasOwnProperty(k)) subs += _subscribers[k].length;
    var totalEmits = 0;
    for (var b in _registry) if (_registry.hasOwnProperty(b)) totalEmits += (_registry[b].emitCount || 0);
    return {
      brains: brains,
      subscriptions: subs,
      globalListeners: _globalListeners.length,
      totalEmits: totalEmits,
      auditEntries: _auditLog.length,
      currentDepth: _emitDepth
    };
  }

  // ── Reset (test/dev only) ──────────────────────────────────────────
  function reset() {
    _subscribers = {};
    _latest = {};
    _registry = {};
    _auditLog = [];
    _globalListeners = [];
    _auditSeq = 0;
    _emitDepth = 0;
  }

  root.LIMENPatternBroker = {
    register: register,
    unregister: unregister,
    getRegistry: getRegistry,
    subscribe: subscribe,
    subscribeAll: subscribeAll,
    emit: emit,
    getLatest: getLatest,
    getAllLatest: getAllLatest,
    auditLog: auditLog,
    stats: stats,
    reset: reset
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
