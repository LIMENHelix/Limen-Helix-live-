/**
 * interoceptive-divergence.js — FIRST SLICE of multi-modal interoception.
 *
 * The system currently computes domain health from ONE channel (structured/
 * financial stress). It has other live channels — affect (polarity), homeostatic
 * (balance), nociception/threat (escalation) — that it ignores. That is single-
 * channel interoception (the alexithymia-equivalent). This module does NOT fix
 * that. It is the MEASUREMENT INSTRUMENT that proves whether multi-channel
 * integration is worth building, and gathers the data to calibrate it.
 *
 * What it does: across ALL domains (no hand-picked case), each cycle it reads the
 * four channels, detects DIVERGENCE (the financial channel disagreeing with the
 * others), logs the raw values + direction + magnitude, and on a later cycle
 * records HOW the divergence resolved (did financial catch up to the alarmed
 * channels — they were right — or did they fall back to baseline — financial was
 * right?). That resolution record is the empirical basis for future per-domain
 * channel weights.
 *
 * What it is NOT: it does NOT modify any health/confidence number, emit into the
 * spine, or change behaviour. Pure read + its own log. It is NOT predictive
 * coding, neuromodulator gain, or active inference — those remain named gaps. It
 * is one first slice; whether divergence detection improves behaviour is the
 * empirical question this instrument exists to answer.
 *
 * DARK by default: runs only when window.LIMEN_ENABLE_INTEROCEPTION is true.
 * Inspect with window.LIMENInteroception.getLog() / .summary().
 *
 * The alarm mappings below are coarse Phase-1 ASSUMPTIONS (tunable), not measured
 * quantities. Raw channel values are logged verbatim so the assumptions can be
 * recalibrated from real resolution data — never hard-code a number as if measured.
 *
 * TWO INTEROCEPTION LAYERS, distinct by design (do not merge or duplicate):
 *   - THIS module = WINDOW-LEVEL, cross-domain: reads EXTERNAL channels
 *     (LIMENDomains.stress / LIMENPolarity / LIMENBalance / LIMENEscalation) across
 *     all 20 domains and, crucially, records HOW each divergence RESOLVED. That
 *     resolution log is the empirical basis for the per-domain channel weights.
 *   - PER-BRAIN self-model = domain-brain-base._computeGenericInteroception (and
 *     energy-brain._computeEnergyInteroception): integrates each brain's OWN INTERNAL
 *     channels (prediction-error / regulation / outcome-ledger / immune / forecast)
 *     into state.interoception, with the same divergence/blind-channel grammar.
 *   The per-brain layer is the live self-model read; this window layer is the
 *   calibration instrument that tells us whether the alarmed channels were right.
 */
(function () {
  'use strict';

  var LOG_KEY = 'limen.interoception.divergenceLog.v1';
  var LOG_CAP = 500;
  var DIVERGENCE_GAP = 0.4;        // tunable threshold: financial-vs-others alarm spread to flag
  var QUIET = 0.3, HOT = 0.6;      // tunable bands for "calm" vs "alarmed"
  var RESOLUTION_WINDOW_MS = 2 * 3600 * 1000; // re-check a divergence after ~2h
  var _started = false, _log = null;

  function _enabled() { return window.LIMEN_ENABLE_INTEROCEPTION === true; }

  function _loadLog() {
    if (_log) return _log;
    try { _log = JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { _log = []; }
    return _log;
  }
  function _saveLog() {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(_log.slice(-LOG_CAP))); } catch (e) {}
  }

  // ── Per-channel alarm mapping (coarse, categorical where the numeric scale is
  //    not normalized; raw values logged separately). 0 = calm, 1 = alarmed. ──
  function _financialAlarm(d) { return (d && typeof d.stress === 'number') ? d.stress : null; }

  function _affectAlarm(p) {
    if (!p) return null;
    var lab = String(p.polarity || 'uncertain');
    if (lab === 'negative') return 0.7;
    if (lab === 'mixed') return 0.4;
    if (lab === 'positive') return 0.0;
    return 0.2; // uncertain
  }
  function _homeoAlarm(b) {
    if (!b) return null;
    if (b.state === 'destabilizing') return 0.7;
    if (b.state === 'stabilizing') return 0.0;
    return 0.2; // neutral
  }
  function _nociAlarm(domain) {
    var esc = window.LIMENEscalation;
    if (!esc || !esc.tiers) return 0;
    var t = esc.tiers, hit = 0;
    function scan(arr, lvl) { if (Array.isArray(arr)) for (var i = 0; i < arr.length; i++) { var it = arr[i]; if (it && String(it.domain || '').indexOf(domain) !== -1) hit = Math.max(hit, lvl); } }
    scan(t.immediate, 0.9); scan(t.developing, 0.6); scan(t.watch, 0.3);
    return hit;
  }

  // Snapshot all channels for one domain (raw + alarm), null where channel absent.
  function _snapshot(domain) {
    var d = (window.LIMENDomains || {})[domain] || null;
    var p = (window.LIMENPolarity || {})[domain] || null;
    var b = (window.LIMENBalance || {})[domain] || null;
    return {
      domain: domain,
      financial: { alarm: _financialAlarm(d), stress: d && d.stress, confidence: d && d.confidence },
      affect: { alarm: _affectAlarm(p), label: p && p.polarity, netTone: p && p.netTone, confidence: p && p.confidence },
      homeostatic: { alarm: _homeoAlarm(b), state: b && b.state, net: b && b.net },
      nociception: { alarm: _nociAlarm(domain) }
    };
  }

  // Detect divergence: financial channel disagreeing with the max of the others.
  function _divergence(snap) {
    var fin = snap.financial.alarm;
    if (fin == null) return null;
    var others = [];
    if (snap.affect.alarm != null) others.push({ ch: 'affect', a: snap.affect.alarm });
    if (snap.homeostatic.alarm != null) others.push({ ch: 'homeostatic', a: snap.homeostatic.alarm });
    others.push({ ch: 'nociception', a: snap.nociception.alarm });
    if (others.length === 0) return null;
    var maxOther = others.reduce(function (m, o) { return o.a > m.a ? o : m; }, { a: -1 });
    var minOther = others.reduce(function (m, o) { return o.a < m.a ? o : m; }, { a: 2 });
    var gap, direction, diverging;
    if (fin <= QUIET && maxOther.a >= HOT) {
      gap = maxOther.a - fin; direction = 'financial_quiet_others_hot';
      diverging = others.filter(function (o) { return o.a >= HOT; }).map(function (o) { return o.ch; });
    } else if (fin >= HOT && minOther.a <= QUIET && maxOther.a <= QUIET) {
      gap = fin - minOther.a; direction = 'financial_hot_others_quiet';
      diverging = ['financial'];
    } else {
      return null;
    }
    if (gap < DIVERGENCE_GAP) return null;
    return { direction: direction, magnitude: +gap.toFixed(3), divergingChannels: diverging };
  }

  // Re-check older unresolved divergences: which channel was right?
  function _resolvePending(now) {
    var changed = false;
    for (var i = 0; i < _log.length; i++) {
      var ev = _log[i];
      if (ev.resolved || (now - ev.ts) < RESOLUTION_WINDOW_MS) continue;
      var cur = _snapshot(ev.domain);
      var finNow = cur.financial.alarm;
      if (finNow == null) continue;
      if (ev.direction === 'financial_quiet_others_hot') {
        // did financial rise toward the others (others were right), or did others fall (financial right)?
        var othersNow = Math.max(cur.affect.alarm || 0, cur.homeostatic.alarm || 0, cur.nociception.alarm || 0);
        ev.resolution = (finNow >= HOT) ? 'financial_caught_up_others_led' : (othersNow <= QUIET ? 'others_reverted_financial_held' : 'unresolved_still_open');
      } else {
        var othersNow2 = Math.max(cur.affect.alarm || 0, cur.homeostatic.alarm || 0, cur.nociception.alarm || 0);
        ev.resolution = (othersNow2 >= HOT) ? 'others_caught_up_financial_led' : (finNow <= QUIET ? 'financial_reverted' : 'unresolved_still_open');
      }
      ev.resolvedAt = now; ev.resolvedSnapshot = cur;
      if (ev.resolution !== 'unresolved_still_open') ev.resolved = true;
      changed = true;
    }
    return changed;
  }

  function _cycle() {
    if (!_enabled()) return;
    _loadLog();
    var now = Date.now();
    var doms = window.LIMENDomains ? Object.keys(window.LIMENDomains) : [];
    var newCount = 0;
    for (var i = 0; i < doms.length; i++) {
      var snap = _snapshot(doms[i]);
      var div = _divergence(snap);
      if (!div) continue;
      // de-dupe: skip if an unresolved event for this domain+direction already open
      var dup = _log.some(function (e) { return e.domain === snap.domain && e.direction === div.direction && !e.resolved && (now - e.ts) < RESOLUTION_WINDOW_MS; });
      if (dup) continue;
      _log.push({ ts: now, domain: snap.domain, direction: div.direction, magnitude: div.magnitude, divergingChannels: div.divergingChannels, snapshot: snap, resolved: false });
      newCount++;
    }
    var resolvedChanged = _resolvePending(now);
    if (newCount > 0 || resolvedChanged) {
      _saveLog();
      try { window.dispatchEvent(new CustomEvent('limen:interoceptive-divergence', { detail: { newCount: newCount, total: _log.length } })); } catch (e) {}
    }
  }

  function start() {
    if (_started) return;
    _started = true;
    _loadLog();
    window.addEventListener('limen:domain-update', _cycle);
    // also run on an interval in case domain-update is quiet
    try { setInterval(_cycle, 60000); } catch (e) {}
    _cycle();
  }
  function stop() { _started = false; window.removeEventListener('limen:domain-update', _cycle); }

  window.LIMENInteroception = {
    start: start,
    stop: stop,
    getLog: function () { return _loadLog().slice(); },
    summary: function () {
      var lg = _loadLog();
      var open = lg.filter(function (e) { return !e.resolved; }).length;
      var byRes = {};
      lg.forEach(function (e) { if (e.resolution) byRes[e.resolution] = (byRes[e.resolution] || 0) + 1; });
      var byDom = {};
      lg.forEach(function (e) { byDom[e.domain] = (byDom[e.domain] || 0) + 1; });
      return { enabled: _enabled(), totalEvents: lg.length, openUnresolved: open, byResolution: byRes, byDomain: byDom, note: 'observe-only; affects no health number; arm with window.LIMEN_ENABLE_INTEROCEPTION=true' };
    },
    clearLog: function () { _log = []; _saveLog(); }
  };
})();
