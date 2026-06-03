/**
 * action-selection-gate.js — the basal ganglia (the missing Stage-4 chokepoint).
 *
 * The brain-region atlas found that stages 1–3 run live but there is NO single
 * winner-take-all action-selection gate: execution-next-best-action picks one
 * action but only RETURNS it (no broadcast, no suppression), and the arbiter
 * window.LIMENMasterBrain.decide() is defined but never called. Everything fires
 * in parallel. This module is that one chokepoint.
 *
 * It gathers candidate actions from every stage-4 source, applies the K3
 * inhibition (a DISPUTED / impossible-state candidate can never win), consults
 * the master-brain arbiter (proposal-only context), selects ONE winner, and —
 * when enabled — broadcasts `limen:action-selected` + records it, suppressing
 * the rest. Execution is NEVER auto-allowed: decide() pins executionAllowed:false
 * and this gate only PROPOSES a winner; human confirmation stays downstream.
 *
 * DARK BY DEFAULT. With window.LIMEN_ENABLE_ACTION_GATE falsy the gate is
 * OBSERVE-ONLY: it computes what it WOULD select and exposes it on
 * window.LIMENActionGate.getState() (+ console.debug), but emits nothing, writes
 * nothing, suppresses nothing — zero behavioral change. Flip the flag to arm it.
 *
 * Loads via bootstrap CONSOLE_MODULES; api: LIMENActionGate.
 */
(function () {
  'use strict';

  var _state = { lastSelection: null, runs: 0 };
  var _debounce = null;

  function _enabled() {
    try { return !!(typeof window !== 'undefined' && window.LIMEN_ENABLE_ACTION_GATE); }
    catch (e) { return false; }
  }

  function _num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

  function _scoreOf(a) {
    if (!a) return 0;
    if (a._boostedScore != null) return _num(a._boostedScore);
    if (a.score != null) return _num(a.score);
    if (a.rank != null) return _num(a.rank);
    if (a.priority != null) return _num(a.priority);
    return 0;
  }

  function _labelOf(a) {
    return (a && (a.title || a.label || a.name || a.id)) || 'action';
  }

  // K3 inhibition: a candidate whose epistemic state is disputed/impossible/
  // fabricated can never win (the prefrontal "don't act on what's refuted").
  function _k3Veto(a) {
    if (!a) return true;
    var st = a.epistemicState || a.evidenceState || a.state || a.verdict;
    if (st && /disput|impossible|fabricat|refut/i.test(String(st))) return true;
    return false;
  }

  // Gather candidate actions from every stage-4 source. Each read is defensive:
  // a missing source contributes nothing rather than throwing.
  function _candidates() {
    var out = [];
    // Source 1 — execution next-best-action (the existing single-action picker).
    try {
      var ex = (typeof window !== 'undefined') && window.LIMENExecution;
      var p10 = ex && ex.phase10;
      var nba = p10 && p10.nextAction;
      var a = (typeof nba === 'function') ? nba() : null;
      if (a) out.push({ source: 'next-best-action', action: a, score: _scoreOf(a) });
    } catch (e) {}
    // Source 2 — decision-synthesis EXECUTE-NOW bucket (defensive shape probing).
    try {
      var ex2 = (typeof window !== 'undefined') && window.LIMENExecution;
      var ds = ex2 && (ex2.decisionSynthesis || (ex2.phase && ex2.phase.decisionSynthesis));
      var buckets = ds && (typeof ds.getBuckets === 'function' ? ds.getBuckets() : ds.buckets);
      var exec = buckets && (buckets.executeNow || buckets.EXECUTE_NOW || buckets['EXECUTE NOW']);
      if (exec && exec.length) {
        for (var i = 0; i < exec.length; i++) {
          out.push({ source: 'decision-synthesis', action: exec[i], score: _scoreOf(exec[i]) });
        }
      }
    } catch (e) {}
    return out;
  }

  // Consult the master-brain arbiter for proposal-only context. Returns [] in
  // prod today (no OIB builder wired) — handled gracefully, never depended on.
  function _arbiterProposals() {
    try {
      var mb = (typeof window !== 'undefined') && window.LIMENMasterBrain;
      if (mb && typeof mb.decide === 'function') {
        var d = mb.decide();
        return Array.isArray(d) ? d : [];
      }
    } catch (e) {}
    return [];
  }

  // Pure winner-take-all selection. K3-veto first, then highest score wins;
  // the rest are the suppression set. No side effects — testable in isolation.
  function select() {
    var raw = _candidates();
    var cands = [];
    for (var i = 0; i < raw.length; i++) { if (!_k3Veto(raw[i].action)) cands.push(raw[i]); }
    var vetoed = raw.length - cands.length;
    var proposals = _arbiterProposals();
    if (!cands.length) {
      return { winner: null, suppressed: [], vetoed: vetoed, proposals: proposals, candidateCount: 0 };
    }
    cands.sort(function (a, b) { return _scoreOf(b.action) - _scoreOf(a.action); });
    return {
      winner: cands[0],
      suppressed: cands.slice(1),
      vetoed: vetoed,
      proposals: proposals,
      candidateCount: cands.length
    };
  }

  function run(trigger) {
    var sel;
    try { sel = select(); }
    catch (e) { return { winner: null, suppressed: [], error: String(e && e.message || e) }; }

    _state.runs++;
    _state.lastSelection = {
      at: Date.now(),
      trigger: trigger || 'manual',
      enabled: _enabled(),
      winner: sel.winner ? { label: _labelOf(sel.winner.action), source: sel.winner.source, score: _scoreOf(sel.winner.action) } : null,
      suppressedCount: sel.suppressed.length,
      vetoed: sel.vetoed,
      candidateCount: sel.candidateCount,
      arbiterProposals: sel.proposals.length
    };

    if (!_enabled()) {
      // DARK: observe only. Record intent; emit nothing, write nothing, suppress nothing.
      try {
        if (typeof console !== 'undefined' && console.debug) {
          console.debug('[action-gate DARK] would select:', _state.lastSelection.winner,
            '| suppress', sel.suppressed.length, '| vetoed', sel.vetoed, '| candidates', sel.candidateCount);
        }
      } catch (e) {}
      return sel;
    }

    // ARMED: broadcast the single winner + suppression set; record to memory.
    // Still proposal-only — executionAllowed is hard-false; downstream human
    // confirmation (execution-human-confirmation) remains the execution gate.
    if (sel.winner) {
      try {
        if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new window.CustomEvent('limen:action-selected', {
            detail: {
              winner: sel.winner,
              suppressed: sel.suppressed,
              proposals: sel.proposals,
              executionAllowed: false,
              selectedAt: Date.now(),
              trigger: trigger || 'manual'
            }
          }));
        }
      } catch (e) {}
      try {
        var mem = window.LIMENExecution && window.LIMENExecution.phase9 && window.LIMENExecution.phase9.decisionMemory;
        if (mem && typeof mem.recordDecisionEvent === 'function') {
          mem.recordDecisionEvent({
            kind: 'action-selected',
            title: _labelOf(sel.winner.action),
            source: sel.winner.source,
            suppressed: sel.suppressed.length,
            vetoed: sel.vetoed,
            candidates: sel.candidateCount,
            executionAllowed: false
          });
        }
      } catch (e) {}
    }
    return sel;
  }

  function _schedule() {
    if (_debounce) return;
    try {
      _debounce = setTimeout(function () { _debounce = null; run('event'); }, 600);
    } catch (e) { _debounce = null; }
  }

  function init() {
    try {
      if (typeof window === 'undefined' || !window.addEventListener) return;
      if (init._wired) return; init._wired = true;
      window.addEventListener('limen:domain-update', _schedule);
      window.addEventListener('limen:civilization-packets-update', _schedule);
      window.addEventListener('limen:global-state-update', _schedule);
    } catch (e) {}
  }

  var API = {
    run: run,
    select: select,
    init: init,
    start: init,            // bootstrap calls .start(); idempotent with init
    isEnabled: _enabled,
    getState: function () { return _state; }
  };

  try {
    if (typeof window !== 'undefined') {
      window.LIMENActionGate = API;
      if (typeof document !== 'undefined' && document.addEventListener) {
        if (document.readyState !== 'loading') init();
        else document.addEventListener('DOMContentLoaded', init);
      }
    }
  } catch (e) {}

  // CommonJS export for the node test harness (browser ignores this).
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})();
// auto-sync canary 2026-06-03 (run 2, secret now set): verifying the lean→full GitHub Action mirrors this. Safe to remove.
