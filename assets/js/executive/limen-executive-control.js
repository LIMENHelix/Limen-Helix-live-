/**
 * LIMEN Executive Control Layer — Phase 11
 *
 * Standalone decision engine with human-gated execution.
 * Sits ON TOP of existing systems — consumes signals, does not alter computation.
 * No DOM manipulation — exposes a clean state API and emits events.
 *
 * Loop: detect → prioritize → formulate plan → recommend next step →
 *       wait for human → record outcome → adapt
 *
 * Exposes: window.LIMENExecutive
 *
 * Events emitted:
 *   limen:intent-created      { intent }
 *   limen:intent-updated      { intent }
 *   limen:intent-completed    { intent, outcome }
 *   limen:intent-abandoned    { intent, reason }
 *   limen:step-waiting-user   { intent, step }
 *   limen:attention-updated   { allocation }
 *   limen:executive-audit-updated { audit }
 *
 * Reads from (does not modify):
 *   window.LIMENDomains           — current domain stress
 *   window.LIMENLongMemory        — regime, baseline, trends, cycles
 *   localStorage:limen_anomalies  — recent anomaly events
 *   localStorage:limen_pathway_weights — pathway learning
 *   window._capOpportunities      — opportunity references
 *
 * Owned storage keys (writes limited to these three, no foreign writes):
 *   limen_active_intents    — active/waiting/paused intent list (max 25)
 *   limen_plan_memory       — bounded archetype learning (written on intent completion)
 *   limen_executive_audit   — meta-tracking (creation rate, completion, staleness)
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ══════════════════════════════════════════════════════════════════════

  var INTENT_KEY = 'limen_active_intents';
  var PLAN_MEMORY_KEY = 'limen_plan_memory';
  var AUDIT_KEY = 'limen_executive_audit';

  var MAX_ACTIVE_INTENTS = 25;
  var STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  var BLOCKED_FAIL_COUNT = 2;
  var MIN_SAMPLES_FOR_EFFECT = 3;

  var STEP_TYPES = ['ANALYZE','VALIDATE','POSITION','INVESTIGATE','REGULATE','MONITOR','ESCALATE','REVIEW_OUTCOME'];
  var INTENT_STATUSES = ['ACTIVE','WAITING_USER','PAUSED','COMPLETED','ABANDONED'];
  var HOOK_TYPES = ['TRADE_SIGNAL','EMAIL_DRAFT','REPORT_GENERATION','TASK_CREATION','PORTAL_RECOMMENDATION','GRANT_RESEARCH','PATENT_RESEARCH'];

  var EVENT_VERSION = 1;

  // ── Event emission (surfaces subscribe, executive does not touch DOM) ──
  // Every event includes: eventVersion, timestamp, intentId, previousStatus, nextStatus, trigger
  function _emit(eventName, detail) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      detail.eventVersion = EVENT_VERSION;
      detail.timestamp = Date.now();
      window.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // TRANSITION ENFORCEMENT
  // Legal transitions only. Illegal jumps are blocked and logged.
  // ══════════════════════════════════════════════════════════════════════

  var LEGAL_TRANSITIONS = {
    'ACTIVE':       ['WAITING_USER', 'PAUSED', 'COMPLETED', 'ABANDONED'],
    'WAITING_USER': ['ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'],
    'PAUSED':       ['ACTIVE', 'ABANDONED'],
    'COMPLETED':    [],  // terminal
    'ABANDONED':    []   // terminal
  };

  function _isLegalTransition(from, to) {
    if (!from) return to === 'ACTIVE'; // creation
    var allowed = LEGAL_TRANSITIONS[from];
    return allowed && allowed.indexOf(to) !== -1;
  }

  function _logRejectedTransition(intentId, from, to, trigger) {
    var audit = _getAudit();
    if (!audit.rejectedTransitions) audit.rejectedTransitions = [];
    audit.rejectedTransitions.push({
      intentId: intentId, from: from, to: to, trigger: trigger, at: Date.now()
    });
    // Keep last 50
    if (audit.rejectedTransitions.length > 50) audit.rejectedTransitions = audit.rejectedTransitions.slice(-50);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(audit));
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 1: PERSISTENT INTENT STATE (Server-first, localStorage cache)
  // ══════════════════════════════════════════════════════════════════════

  var _serverSyncInflight = false;

  function _getIntents() {
    try { return JSON.parse(localStorage.getItem(INTENT_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function _saveIntents(intents) {
    localStorage.setItem(INTENT_KEY, JSON.stringify(intents));
    // Write-through to server (fire-and-forget)
    _syncIntentsToServer(intents);
  }

  function _syncIntentsToServer(intents) {
    if (_serverSyncInflight) return;
    _serverSyncInflight = true;
    fetch('/api/limen-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intents: intents }),
      signal: AbortSignal.timeout(5000)
    }).catch(function () {}).finally(function () { _serverSyncInflight = false; });
  }

  // On load: fetch server intents and merge if newer
  (function _bootIntentsFromServer() {
    fetch('/api/limen-intents', { signal: AbortSignal.timeout(4000) })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok || !data.intents || data.intents.length === 0) return;
        var local = _getIntents();
        // Server wins if local is empty OR server is newer
        var localNewest = 0;
        for (var i = 0; i < local.length; i++) {
          if (local[i].updatedAt > localNewest) localNewest = local[i].updatedAt;
        }
        var serverTime = data._savedAt || 0;
        if (local.length === 0 || serverTime > localNewest) {
          localStorage.setItem(INTENT_KEY, JSON.stringify(data.intents));
          _emit('limen:intents-restored', { count: data.intents.length, source: 'server' });
        }
      })
      .catch(function () {});
  })();

  function getActiveIntents() {
    return _getIntents().filter(function (i) {
      return i.status === 'ACTIVE' || i.status === 'WAITING_USER' || i.status === 'PAUSED';
    });
  }

  function getIntent(id) {
    var intents = _getIntents();
    for (var i = 0; i < intents.length; i++) {
      if (intents[i].id === id) return intents[i];
    }
    return null;
  }

  // Duplicate check: no two ACTIVE intents for same domain + strategyType
  function _hasDuplicateActive(domain, strategyType) {
    var active = getActiveIntents();
    for (var i = 0; i < active.length; i++) {
      if (active[i].domain === domain && active[i].strategyType === strategyType &&
          (active[i].status === 'ACTIVE' || active[i].status === 'WAITING_USER')) {
        return active[i];
      }
    }
    return null;
  }

  function createIntent(input) {
    var intents = _getIntents();
    var active = intents.filter(function (i) {
      return i.status === 'ACTIVE' || i.status === 'WAITING_USER' || i.status === 'PAUSED';
    });

    // Cap check
    if (active.length >= MAX_ACTIVE_INTENTS) {
      return { error: 'MAX_ACTIVE_INTENTS reached (' + MAX_ACTIVE_INTENTS + ')' };
    }

    // Duplicate check
    var dup = _hasDuplicateActive(input.domain, input.strategyType);
    if (dup) {
      return { error: 'DUPLICATE_ACTIVE', existingId: dup.id };
    }

    var now = Date.now();
    var uid = now + '_' + Math.random().toString(36).substr(2, 4);
    var intent = {
      id: 'intent_' + (input.domain || 'general') + '_' + uid,
      domain: input.domain || '',
      title: input.title || '',
      priority: input.priority || 0.5,
      attentionWeight: 0,
      status: 'ACTIVE',
      waitingReason: null, // AWAITING_CONFIRMATION | AWAITING_STEP_SELECTION | FAILED_REVIEW | REPLAN_REQUIRED | AWAITING_FINAL_CONFIRMATION
      readyToComplete: false,
      strategyType: input.strategyType || 'general',
      source: input.source || 'executive',
      createdAt: now,
      updatedAt: now,
      lastReviewedAt: now,
      lastTransitionAt: now,
      humanGate: true,
      currentStepIndex: 0,
      progress: 0,
      regimeContext: input.regimeContext || {},
      pathwayContext: input.pathwayContext || {},
      steps: input.steps || [],
      history: []
    };

    intents.push(intent);
    _saveIntents(intents);
    _updateAudit('create');
    _emit('limen:intent-created', {
      intentId: intent.id,
      previousStatus: null,
      nextStatus: 'ACTIVE',
      trigger: 'createIntent',
      intent: intent
    });
    return intent;
  }

  function updateIntent(id, patch) {
    var intents = _getIntents();
    for (var i = 0; i < intents.length; i++) {
      if (intents[i].id === id) {
        var prevStatus = intents[i].status;
        var newStatus = patch.status || prevStatus;
        // Enforce legal transitions
        if (patch.status && !_isLegalTransition(prevStatus, newStatus)) {
          _logRejectedTransition(id, prevStatus, newStatus, 'updateIntent');
          return { error: 'ILLEGAL_TRANSITION', from: prevStatus, to: newStatus };
        }
        for (var k in patch) {
          if (patch.hasOwnProperty(k) && k !== 'id') {
            intents[i][k] = patch[k];
          }
        }
        intents[i].updatedAt = Date.now();
        if (patch.status) intents[i].lastTransitionAt = Date.now();
        _saveIntents(intents);
        _emit('limen:intent-updated', {
          intentId: id,
          previousStatus: prevStatus,
          nextStatus: intents[i].status,
          trigger: 'updateIntent',
          waitingReason: intents[i].waitingReason || null,
          intent: intents[i]
        });
        return intents[i];
      }
    }
    return null;
  }

  function pauseIntent(id) {
    return updateIntent(id, { status: 'PAUSED' });
  }

  function completeIntent(id, outcome) {
    var intent = getIntent(id);
    if (!intent) return null;
    var prevStatus = intent.status;
    if (!_isLegalTransition(prevStatus, 'COMPLETED')) {
      _logRejectedTransition(id, prevStatus, 'COMPLETED', 'completeIntent');
      return { error: 'ILLEGAL_TRANSITION', from: prevStatus, to: 'COMPLETED' };
    }
    intent.status = 'COMPLETED';
    intent.lastTransitionAt = Date.now();
    intent.waitingReason = null;
    intent.readyToComplete = false;
    intent.updatedAt = Date.now();
    intent.history.push({ event: 'completed', outcome: outcome, at: Date.now() });
    intent.progress = 1.0;
    var intents = _getIntents();
    for (var i = 0; i < intents.length; i++) {
      if (intents[i].id === id) { intents[i] = intent; break; }
    }
    _saveIntents(intents);
    _updateAudit('complete');
    _recordPlanOutcome(intent, outcome);
    _emit('limen:intent-completed', {
      intentId: id,
      previousStatus: prevStatus,
      nextStatus: 'COMPLETED',
      trigger: 'completeIntent',
      outcome: outcome,
      intent: intent
    });
    return intent;
  }

  function abandonIntent(id, reason) {
    var intent = getIntent(id);
    if (!intent) return null;
    var prevStatus = intent.status;
    if (!_isLegalTransition(prevStatus, 'ABANDONED')) {
      _logRejectedTransition(id, prevStatus, 'ABANDONED', 'abandonIntent');
      return { error: 'ILLEGAL_TRANSITION', from: prevStatus, to: 'ABANDONED' };
    }
    intent.status = 'ABANDONED';
    intent.lastTransitionAt = Date.now();
    intent.waitingReason = null;
    intent.readyToComplete = false;
    intent.updatedAt = Date.now();
    intent.history.push({ event: 'abandoned', reason: reason, at: Date.now() });
    var intents = _getIntents();
    for (var i = 0; i < intents.length; i++) {
      if (intents[i].id === id) { intents[i] = intent; break; }
    }
    _saveIntents(intents);
    _updateAudit('abandon');
    _recordPlanOutcome(intent, 'FAIL');
    _emit('limen:intent-abandoned', {
      intentId: id,
      previousStatus: prevStatus,
      nextStatus: 'ABANDONED',
      trigger: 'abandonIntent',
      reason: reason,
      intent: intent
    });
    return intent;
  }

  function getNextRecommendedStep(intentId) {
    var intent = getIntent(intentId);
    if (!intent || !intent.steps || intent.steps.length === 0) return null;
    var idx = intent.currentStepIndex || 0;
    if (idx >= intent.steps.length) return { done: true, message: 'All steps completed' };
    return intent.steps[idx];
  }

  function recordStepOutcome(intentId, stepId, outcome, notes) {
    var intents = _getIntents();
    for (var i = 0; i < intents.length; i++) {
      if (intents[i].id !== intentId) continue;
      var intent = intents[i];
      for (var s = 0; s < intent.steps.length; s++) {
        if (intent.steps[s].id !== stepId) continue;
        intent.steps[s].status = outcome === 'SUCCESS' ? 'COMPLETED' : (outcome === 'FAIL' ? 'FAILED' : 'PARTIAL');
        intent.steps[s].outcome = outcome;
        intent.steps[s].notes = notes || '';
        intent.steps[s].completedAt = Date.now();

        // Human-gated advance: move to next step only on SUCCESS or PARTIAL
        var prevStatus = intent.status;
        if (outcome !== 'FAIL') {
          intent.currentStepIndex = s + 1;
          intent.progress = Math.round((s + 1) / intent.steps.length * 100) / 100;
          if (intent.currentStepIndex >= intent.steps.length) {
            // All steps done — awaiting final human signoff
            intent.status = 'WAITING_USER';
            intent.waitingReason = 'AWAITING_FINAL_CONFIRMATION';
            intent.readyToComplete = true;
          } else {
            // More steps — awaiting user to review and confirm next step
            intent.status = 'WAITING_USER';
            intent.waitingReason = 'AWAITING_STEP_SELECTION';
            intent.readyToComplete = false;
          }
        } else {
          // FAIL: keep same step, mark as needing review/replan
          intent.status = 'WAITING_USER';
          intent.readyToComplete = false;
          intent.history.push({ event: 'step_failed', stepId: stepId, at: Date.now() });
          // Check if blocked (2+ fails on same step)
          var failCount = intent.history.filter(function(h) {
            return h.event === 'step_failed' && h.stepId === stepId;
          }).length;
          intent.waitingReason = failCount >= BLOCKED_FAIL_COUNT ? 'REPLAN_REQUIRED' : 'FAILED_REVIEW';
          // Re-run simulation on rejection to update context
          if (window.LIMENSimulation) _attachSimulation(intent);
        }

        intent.updatedAt = Date.now();
        intent.lastReviewedAt = Date.now();
        intent.lastTransitionAt = Date.now();
        _emit('limen:step-waiting-user', {
          intentId: intent.id,
          previousStatus: prevStatus,
          nextStatus: intent.status,
          trigger: 'recordStepOutcome',
          stepId: intent.steps[s].id,
          stepIndex: s,
          waitingReason: intent.waitingReason,
          recommendedAction: intent.steps[s].recommendation || '',
          blockingCondition: intent.waitingReason === 'REPLAN_REQUIRED' ? 'Step failed ' + failCount + '+ times' : null,
          intent: intent,
          step: intent.steps[s]
        });
        break;
      }
      _saveIntents(intents);
      _emit('limen:intent-updated', {
        intentId: intent.id,
        previousStatus: prevStatus,
        nextStatus: intent.status,
        trigger: 'recordStepOutcome',
        waitingReason: intent.waitingReason || null,
        intent: intent
      });
      return intent;
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 2: PLAN ARCHETYPE MEMORY
  // Bounded learning: same family as pathway weights.
  // factor = 0.8 + (weightedAvg × 0.4), bounded [0.8, 1.2]
  // ══════════════════════════════════════════════════════════════════════

  var OUTCOME_SCORE = { SUCCESS: 1.0, PARTIAL: 0.5, FAIL: 0.0 };

  function _getPlanMemory() {
    try { return JSON.parse(localStorage.getItem(PLAN_MEMORY_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function _savePlanMemory(mem) {
    localStorage.setItem(PLAN_MEMORY_KEY, JSON.stringify(mem));
  }

  function _planKey(intent) {
    return (intent.strategyType || 'general') + '::' + (intent.domain || 'any');
  }

  function _computeFactor(bucket) {
    if (!bucket || bucket.samples === 0) return 1.0;
    var avg = bucket.weightedSum / bucket.samples;
    return Math.round((0.8 + avg * 0.4) * 100) / 100;
  }

  function _recordPlanOutcome(intent, outcome) {
    var mem = _getPlanMemory();
    var key = _planKey(intent);
    var score = OUTCOME_SCORE[outcome] != null ? OUTCOME_SCORE[outcome] : 0.5;

    if (!mem[key]) {
      mem[key] = { samples: 0, weightedSum: 0, factor: 1.0, lastOutcomeAt: 0, regimeBuckets: {} };
    }

    mem[key].samples++;
    mem[key].weightedSum += score;
    mem[key].factor = _computeFactor(mem[key]);
    mem[key].lastOutcomeAt = Date.now();

    // Also bucket by regime
    var regime = (intent.regimeContext && intent.regimeContext.current) || 'UNKNOWN';
    if (!mem[key].regimeBuckets[regime]) {
      mem[key].regimeBuckets[regime] = { samples: 0, weightedSum: 0, factor: 1.0 };
    }
    mem[key].regimeBuckets[regime].samples++;
    mem[key].regimeBuckets[regime].weightedSum += score;
    mem[key].regimeBuckets[regime].factor = _computeFactor(mem[key].regimeBuckets[regime]);

    _savePlanMemory(mem);
    return mem[key];
  }

  function getPlanConfidence(strategyType, domain, regime) {
    var mem = _getPlanMemory();
    var key = (strategyType || 'general') + '::' + (domain || 'any');
    var entry = mem[key];
    if (!entry) return { factor: 1.0, samples: 0, confidence: 'NONE' };

    var factor = entry.factor;
    var samples = entry.samples;

    // Use regime-specific bucket if enough samples
    if (regime && entry.regimeBuckets[regime] && entry.regimeBuckets[regime].samples >= MIN_SAMPLES_FOR_EFFECT) {
      factor = entry.regimeBuckets[regime].factor;
      samples = entry.regimeBuckets[regime].samples;
    }

    // Low-sample guard: attenuate toward neutral
    if (samples < MIN_SAMPLES_FOR_EFFECT) {
      factor = 1.0 + (factor - 1.0) * (samples / MIN_SAMPLES_FOR_EFFECT);
      factor = Math.round(factor * 100) / 100;
    }

    var confidence = samples >= 10 ? 'HIGH' : (samples >= MIN_SAMPLES_FOR_EFFECT ? 'MODERATE' : 'LOW');
    return { factor: Math.max(0.8, Math.min(1.2, factor)), samples: samples, confidence: confidence };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 4: ATTENTION ALLOCATION ENGINE
  // Ranks importance across domains. Affects display order only.
  // ══════════════════════════════════════════════════════════════════════

  function getAttentionAllocation() {
    var domains = window.LIMENDomains || {};
    var longMem = window.LIMENLongMemory;
    var activeIntents = getActiveIntents();
    var allocation = {};
    var totalWeight = 0;

    for (var dk in domains) {
      if (!domains.hasOwnProperty(dk)) continue;
      var d = domains[dk];
      var weight = 0;

      // Factor 1: Current stress (0-1) x 0.25
      weight += (d.stress || 0) * 0.25;

      // Factor 2: Long-term regime deviation x 0.15
      if (longMem && longMem.getZScore) {
        var z = longMem.getZScore(dk, 30);
        if (z !== null) weight += Math.min(1, Math.abs(z) / 3) * 0.15;
      }

      // Factor 3: Active intent priority x 0.25
      for (var ai = 0; ai < activeIntents.length; ai++) {
        if (activeIntents[ai].domain === dk) {
          weight += (activeIntents[ai].priority || 0.5) * 0.25;
          break;
        }
      }

      // Factor 4: Trend momentum x 0.15
      if (longMem && longMem.getTrend) {
        var trend = longMem.getTrend(dk, 30);
        if (trend.direction === 'rising') weight += Math.min(0.15, Math.abs(trend.slope) * 10);
      }

      // Factor 5: Anomaly recency x 0.05
      var anomalies = [];
      try { anomalies = JSON.parse(localStorage.getItem('limen_anomalies') || '[]'); } catch(e) {}
      var recentAnomaly = anomalies.filter(function(a) {
        return a.domain === dk && (Date.now() - new Date(a.timestamp).getTime()) < 3600000;
      });
      if (recentAnomaly.length > 0) weight += 0.05;

      // Factor 6: Kernel phase priority modifier x 0.15 (Phase 24)
      var phaseAnn = (window.LIMENPhaseAnnotations || {})[dk];
      if (phaseAnn && phaseAnn.priorityMod !== undefined) {
        weight += phaseAnn.priorityMod * 0.15;
      }

      allocation[dk] = Math.round(weight * 1000) / 1000;
      totalWeight += weight;
    }

    // Normalize to sum=1.0
    if (totalWeight > 0) {
      for (var nk in allocation) {
        allocation[nk] = Math.round(allocation[nk] / totalWeight * 1000) / 1000;
      }
    }

    return allocation;
  }

  // Emit attention update periodically (called by surfaces, not auto-timer)
  function _emitAttentionUpdate() {
    _emit('limen:attention-updated', { allocation: getAttentionAllocation() });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 5: EXECUTIVE QUEUE (prioritized action list)
  // ══════════════════════════════════════════════════════════════════════

  function getExecutiveQueue() {
    var intents = getActiveIntents();
    var attention = getAttentionAllocation();

    // Score each intent
    var scored = intents.map(function (intent) {
      var attn = attention[intent.domain] || 0;
      var planConf = getPlanConfidence(intent.strategyType, intent.domain,
        intent.regimeContext ? intent.regimeContext.current : null);
      var urgency = intent.priority * 0.4 + attn * 0.3 + planConf.factor * 0.2;
      // Waiting-user intents get priority boost
      if (intent.status === 'WAITING_USER') urgency += 0.1;

      return {
        intentId: intent.id,
        title: intent.title,
        domain: intent.domain,
        status: intent.status,
        progress: intent.progress,
        urgency: Math.round(urgency * 100) / 100,
        nextStep: getNextRecommendedStep(intent.id),
        planConfidence: planConf
      };
    });

    scored.sort(function (a, b) { return b.urgency - a.urgency; });
    return scored;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 6: PLAN GENERATION
  // Synthesizes intent + steps from domain context.
  // ══════════════════════════════════════════════════════════════════════

  var STRATEGY_TEMPLATES = {
    stabilization: {
      title: function(d) { return 'Stabilize ' + d + ' domain stress'; },
      steps: [
        { type: 'ANALYZE', label: 'Review stress drivers and signal sources', recommendation: 'Check domain portal for active signals and source quality' },
        { type: 'VALIDATE', label: 'Confirm stress is structural, not noise', recommendation: 'Compare against 30-day baseline and check anomaly history' },
        { type: 'POSITION', label: 'Identify capital or regulatory response', recommendation: 'Review capital opportunities and treatment recommendations' },
        { type: 'MONITOR', label: 'Track for 48h stress trajectory', recommendation: 'Watch for recovery events or continued escalation' },
        { type: 'REVIEW_OUTCOME', label: 'Assess intervention effectiveness', recommendation: 'Record outcome and update plan memory' }
      ]
    },
    opportunity_capture: {
      title: function(d) { return 'Capture ' + d + ' opportunity window'; },
      steps: [
        { type: 'ANALYZE', label: 'Evaluate opportunity grounding and confidence', recommendation: 'Check signal integrity and entity support scores' },
        { type: 'INVESTIGATE', label: 'Research execution path', recommendation: 'Review action stack and fast-entry paths' },
        { type: 'VALIDATE', label: 'Confirm market timing and readiness', recommendation: 'Check command board for sector positioning' },
        { type: 'POSITION', label: 'Execute recommended capital action', recommendation: 'Follow human-approved execution step' },
        { type: 'MONITOR', label: 'Track position and domain trajectory', recommendation: 'Set review cadence of 7 days' },
        { type: 'REVIEW_OUTCOME', label: 'Record outcome', recommendation: 'Mark SUCCESS/PARTIAL/FAIL with notes' }
      ]
    },
    recovery_support: {
      title: function(d) { return 'Support ' + d + ' recovery trajectory'; },
      steps: [
        { type: 'ANALYZE', label: 'Verify recovery is TRUE (not temporary drop)', recommendation: 'Check long-term lens classification' },
        { type: 'REGULATE', label: 'Reinforce successful pathway', recommendation: 'Identify which treatments/actions contributed to stress reduction' },
        { type: 'MONITOR', label: 'Watch for regression', recommendation: 'Monitor for 5 days — if stress returns >80% of pre-recovery, escalate' },
        { type: 'REVIEW_OUTCOME', label: 'Classify recovery durability', recommendation: 'Record whether recovery held or regressed' }
      ]
    },
    anomaly_response: {
      title: function(d) { return 'Respond to ' + d + ' anomaly'; },
      steps: [
        { type: 'ANALYZE', label: 'Identify anomaly type and severity', recommendation: 'Check anomaly report in self-audit panel' },
        { type: 'INVESTIGATE', label: 'Determine root cause', recommendation: 'Review source feeds, recent events, and cross-domain coupling' },
        { type: 'ESCALATE', label: 'Decide response posture', recommendation: 'Choose: contain, exploit, or watch' },
        { type: 'REVIEW_OUTCOME', label: 'Assess whether anomaly resolved', recommendation: 'Record resolution and contributing factors' }
      ]
    }
  };

  function _buildSteps(templateSteps) {
    return templateSteps.map(function (t, idx) {
      return {
        id: 'step_' + (idx + 1),
        label: t.label,
        type: t.type,
        status: 'PENDING',
        requiresHumanApproval: true,
        recommendation: t.recommendation,
        successCondition: '',
        failureCondition: '',
        completedAt: null,
        outcome: null,
        notes: '',
        hookType: null,
        hookPayload: null,
        hookReady: false
      };
    });
  }

  function _getRegimeContext(domain) {
    var longMem = window.LIMENLongMemory;
    if (!longMem) return {};
    var regime = longMem.getRegime(domain, 30);
    var z = longMem.getZScore(domain, 30);
    var trend = longMem.getTrend(domain, 30);
    var cycles = longMem.detectCycles(domain, 90);
    return {
      current: regime,
      zScore: z,
      trend30d: trend.slope,
      cycleFlags: cycles.hasCycle ? [cycles.pattern] : []
    };
  }

  function _getPathwayContext(domain) {
    // Read from the trace pathway map (same as console-clarity)
    var PATHWAY_MAP = {
      energy: ['THAL','dlPFC','BLA'], health: ['NTS','AI','HIPP'],
      finance: ['BLA','vmPFC','NAcc'], technology: ['dlPFC','THAL','BDNF'],
      defense: ['BLA','PAG','dACC'], environment: ['NTS','THAL','AI'],
      education: ['HIPP','PCC','DMN'], governance: ['dlPFC','dACC','mPFC'],
      industry: ['THAL','dlPFC','GP'], trade: ['THAL','dlPFC','NAcc']
    };
    var nodes = PATHWAY_MAP[domain];
    return {
      nodes: nodes || [],
      domains: [domain],
      grounded: !!nodes
    };
  }

  function _chooseStrategy(domain) {
    var domains = window.LIMENDomains || {};
    var d = domains[domain] || {};
    var stress = d.stress || 0;
    var regime = _getRegimeContext(domain);

    // Check for recent anomaly
    var anomalies = [];
    try { anomalies = JSON.parse(localStorage.getItem('limen_anomalies') || '[]'); } catch(e) {}
    var recentAnomaly = anomalies.filter(function(a) {
      return a.domain === domain && (Date.now() - new Date(a.timestamp).getTime()) < 3600000;
    }).length > 0;

    if (recentAnomaly) return 'anomaly_response';
    if (regime.current === 'EXTREME' || stress > 0.7) return 'stabilization';
    if (d.trend < -0.03 && stress < 0.4) return 'recovery_support';
    return 'opportunity_capture';
  }

  // ── Simulation bridge: attach forecast context to intent on creation ──
  function _attachSimulation(intent) {
    var sim = window.LIMENSimulation;
    if (!sim || !intent || !intent.domain) return;

    var baseline = sim.forecastBaseline(intent.domain);
    var prop = sim.simulatePropagation([intent.domain], { steps: 2 });

    var simSummary = [];
    if (baseline.label !== 'INSUFFICIENT_DATA') {
      simSummary.push('Trajectory ' + baseline.projectedDirection.toLowerCase());
    }
    if (prop.downstream.length > 0) {
      simSummary.push('downstream pressure on ' + prop.downstream.slice(0, 2).map(function(d) { return d.domain; }).join('/'));
    }

    var confidence = Math.round(Math.max(baseline.confidence, prop.confidence) * 100) / 100;
    var evidenceLevel = confidence >= 0.5 ? 'MODERATE' : (confidence >= 0.3 ? 'LOW' : 'NONE');
    var riskFlags = (baseline.confidenceReason || []).concat(prop.confidenceReason || []);
    // Deduplicate
    var flagSet = {};
    riskFlags = riskFlags.filter(function(f) { if (flagSet[f]) return false; flagSet[f] = true; return true; });

    intent.simulation = {
      lastSimulationId: baseline.id,
      confidence: confidence,
      evidenceLevel: evidenceLevel,
      summary: simSummary.join('; ') || 'Insufficient data for forecast.',
      riskFlags: riskFlags,
      weak: confidence < 0.3
    };

    // Persist
    var intents = _getIntents();
    for (var i = 0; i < intents.length; i++) {
      if (intents[i].id === intent.id) { intents[i] = intent; break; }
    }
    _saveIntents(intents);
  }

  function generateIntentFromDomain(domain) {
    var strategyType = _chooseStrategy(domain);
    var template = STRATEGY_TEMPLATES[strategyType];
    if (!template) return { error: 'UNKNOWN_STRATEGY' };

    var domains = window.LIMENDomains || {};
    var stress = (domains[domain] && domains[domain].stress) || 0;

    var intent = createIntent({
      domain: domain,
      title: template.title(domain),
      priority: Math.round(Math.min(1, stress + 0.2) * 100) / 100,
      strategyType: strategyType,
      source: 'executive',
      regimeContext: _getRegimeContext(domain),
      pathwayContext: _getPathwayContext(domain),
      steps: _buildSteps(template.steps)
    });

    // Attach simulation context if creation succeeded
    if (intent && intent.id) _attachSimulation(intent);
    return intent;
  }

  function generateIntentFromOpportunity(oppId) {
    var opp = (window._capOpportunities || {})[oppId];
    if (!opp) return { error: 'OPPORTUNITY_NOT_FOUND' };

    var intent = createIntent({
      domain: opp.domain || '',
      title: 'Capture: ' + (opp.title || opp.path || 'opportunity'),
      priority: Math.round(Math.min(1, (opp._priority || 50) / 100) * 100) / 100,
      strategyType: 'opportunity_capture',
      source: 'opportunity',
      regimeContext: _getRegimeContext(opp.domain),
      pathwayContext: _getPathwayContext(opp.domain),
      steps: _buildSteps(STRATEGY_TEMPLATES.opportunity_capture.steps)
    });

    if (intent && intent.id) _attachSimulation(intent);
    return intent;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 8: EXECUTIVE AUDIT + STALENESS
  // ══════════════════════════════════════════════════════════════════════

  function _getAudit() {
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function _updateAudit(event) {
    var audit = _getAudit();
    if (!audit.created) audit.created = 0;
    if (!audit.completed) audit.completed = 0;
    if (!audit.abandoned) audit.abandoned = 0;
    if (!audit.lastActivity) audit.lastActivity = 0;

    if (event === 'create') audit.created++;
    if (event === 'complete') audit.completed++;
    if (event === 'abandon') audit.abandoned++;
    audit.lastActivity = Date.now();

    localStorage.setItem(AUDIT_KEY, JSON.stringify(audit));
  }

  function getExecutiveAudit() {
    var audit = _getAudit();
    var intents = _getIntents();
    var active = intents.filter(function(i) { return i.status === 'ACTIVE' || i.status === 'WAITING_USER'; });
    var now = Date.now();

    // Staleness: no update > 7 days
    var stale = active.filter(function(i) {
      return (now - (i.updatedAt || i.createdAt)) > STALE_THRESHOLD_MS;
    });

    // Blocked: same step failed 2+ times
    var blocked = active.filter(function(i) {
      if (!i.steps || !i.history) return false;
      var currentStep = i.steps[i.currentStepIndex || 0];
      if (!currentStep) return false;
      var failCount = i.history.filter(function(h) {
        return h.event === 'step_failed' && h.stepId === currentStep.id;
      }).length;
      return failCount >= BLOCKED_FAIL_COUNT;
    });

    // Avg steps per completed
    var completed = intents.filter(function(i) { return i.status === 'COMPLETED'; });
    var totalSteps = 0;
    completed.forEach(function(c) { totalSteps += (c.steps ? c.steps.length : 0); });

    // Avg time in WAITING_USER
    var waitTimes = [];
    active.forEach(function(i) {
      if (i.status === 'WAITING_USER') {
        waitTimes.push(now - (i.updatedAt || i.createdAt));
      }
    });
    var avgWait = waitTimes.length > 0 ? Math.round(waitTimes.reduce(function(a,b){return a+b;},0) / waitTimes.length / 60000) : 0;

    // Plan memory summary
    var planMem = _getPlanMemory();
    var planKeys = Object.keys(planMem);
    var planSummary = planKeys.map(function(k) {
      return { key: k, factor: planMem[k].factor, samples: planMem[k].samples };
    }).sort(function(a,b) { return b.factor - a.factor; });

    return {
      totalCreated: audit.created || 0,
      totalCompleted: audit.completed || 0,
      totalAbandoned: audit.abandoned || 0,
      completionRate: audit.created > 0 ? Math.round((audit.completed || 0) / audit.created * 100) : 0,
      activeCount: active.length,
      staleCount: stale.length,
      staleIntents: stale.map(function(s) { return s.id; }),
      blockedCount: blocked.length,
      blockedIntents: blocked.map(function(b) { return b.id; }),
      avgStepsPerCompleted: completed.length > 0 ? Math.round(totalSteps / completed.length * 10) / 10 : 0,
      avgWaitMinutes: avgWait,
      planMemorySummary: planSummary.slice(0, 5),
      lastActivity: audit.lastActivity || 0
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENExecutive = {
    // Intent management
    getActiveIntents: getActiveIntents,
    getIntent: getIntent,
    createIntent: createIntent,
    updateIntent: updateIntent,
    pauseIntent: pauseIntent,
    completeIntent: completeIntent,
    abandonIntent: abandonIntent,

    // Execution
    getNextRecommendedStep: getNextRecommendedStep,
    recordStepOutcome: recordStepOutcome,

    // Queue + attention
    getAttentionAllocation: getAttentionAllocation,
    getExecutiveQueue: getExecutiveQueue,

    // Plan generation
    generateIntentFromOpportunity: generateIntentFromOpportunity,
    generateIntentFromDomain: generateIntentFromDomain,

    // Plan memory
    getPlanConfidence: getPlanConfidence,

    // Audit
    getExecutiveAudit: getExecutiveAudit
  };

})();
