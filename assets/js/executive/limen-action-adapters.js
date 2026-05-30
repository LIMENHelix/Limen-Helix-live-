/**
 * LIMEN Action Adapters — Phase 13 (Draft-Only, Human-Gated)
 *
 * Produces external action drafts from executive/simulation state.
 * No autonomous execution. All outputs are drafts pending approval.
 *
 * Exposes: window.LIMENActionAdapters
 *
 * Adapters: NOTION_PAGE, EMAIL_DRAFT, SLACK_MESSAGE, REPORT_GENERATION, TASK_LIST
 *
 * Events emitted:
 *   limen:draft-created   { draftId, adapterType, sourceType, sourceId, status, trigger }
 *   limen:draft-updated   { draftId, status, trigger }
 *   limen:draft-approved  { draftId, adapterType, trigger }
 *   limen:draft-rejected  { draftId, adapterType, reason, trigger }
 *
 * Owned storage keys:
 *   limen_action_drafts  — draft array (max 100)
 *   limen_action_audit   — meta counters
 */
(function () {
  'use strict';

  var DRAFT_KEY = 'limen_action_drafts';
  var AUDIT_KEY = 'limen_action_audit';
  var MAX_DRAFTS = 100;
  var EVENT_VERSION = 1;
  var ADAPTER_TYPES = ['NOTION_PAGE', 'EMAIL_DRAFT', 'SLACK_MESSAGE', 'REPORT_GENERATION', 'TASK_LIST'];

  function _emit(name, detail) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      detail.eventVersion = EVENT_VERSION;
      detail.timestamp = Date.now();
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    }
  }

  function _uid() { return Date.now() + '_' + Math.random().toString(36).substr(2, 4); }

  var _draftSyncInflight = false;

  function _getDrafts() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function _saveDrafts(drafts) {
    if (drafts.length > MAX_DRAFTS) drafts = drafts.slice(-MAX_DRAFTS);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    // Write-through to server (fire-and-forget)
    _syncDraftsToServer(drafts);
  }

  function _syncDraftsToServer(drafts) {
    if (_draftSyncInflight) return;
    _draftSyncInflight = true;
    fetch('/api/limen-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drafts: drafts }),
      signal: AbortSignal.timeout(5000)
    }).catch(function () {}).finally(function () { _draftSyncInflight = false; });
  }

  // On load: fetch server drafts and merge if newer
  (function _bootDraftsFromServer() {
    fetch('/api/limen-drafts', { signal: AbortSignal.timeout(4000) })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok || !data.drafts || data.drafts.length === 0) return;
        var local = _getDrafts();
        var localNewest = 0;
        for (var i = 0; i < local.length; i++) {
          if (local[i].updatedAt > localNewest) localNewest = local[i].updatedAt;
        }
        var serverTime = data._savedAt || 0;
        if (local.length === 0 || serverTime > localNewest) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(data.drafts));
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('limen:drafts-restored', { detail: { count: data.drafts.length, source: 'server' } }));
          }
        }
      })
      .catch(function () {});
  })();

  function _getAudit() {
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function _updateAudit(event, adapterType, sourceType) {
    var a = _getAudit();
    if (!a.draftsCreated) a.draftsCreated = 0;
    if (!a.draftsApproved) a.draftsApproved = 0;
    if (!a.draftsRejected) a.draftsRejected = 0;
    if (!a.byAdapterType) a.byAdapterType = {};
    if (!a.bySourceType) a.bySourceType = {};

    if (event === 'create') {
      a.draftsCreated++;
      a.byAdapterType[adapterType] = (a.byAdapterType[adapterType] || 0) + 1;
      a.bySourceType[sourceType] = (a.bySourceType[sourceType] || 0) + 1;
    }
    if (event === 'approve') a.draftsApproved++;
    if (event === 'reject') a.draftsRejected++;
    a.lastDraftAt = Date.now();

    localStorage.setItem(AUDIT_KEY, JSON.stringify(a));
  }

  // ══════════════════════════════════════════════════════════════════════
  // ADAPTER GENERATORS
  // Each returns a payload object. No external calls.
  // ══════════════════════════════════════════════════════════════════════

  function _generateNotionPage(input) {
    var exec = window.LIMENExecutive;
    var intent = input.intent || (exec && input.intentId ? exec.getIntent(input.intentId) : null);
    if (!intent) return { title: input.title || 'LIMEN Draft', properties: {}, children: [] };

    var steps = (intent.steps || []).map(function (s, idx) {
      return { type: 'to_do', checked: s.status === 'COMPLETED', text: (idx + 1) + '. [' + s.type + '] ' + s.label };
    });

    var simNote = '';
    if (intent.simulation) {
      simNote = 'Simulation: ' + intent.simulation.evidenceLevel + ' confidence (' + intent.simulation.confidence + '). ' + intent.simulation.summary;
    }

    return {
      title: intent.title,
      properties: {
        Domain: intent.domain,
        Status: intent.status,
        WaitingReason: intent.waitingReason || '',
        Priority: intent.priority,
        Progress: Math.round(intent.progress * 100) + '%',
        Strategy: intent.strategyType
      },
      children: [
        { type: 'heading_2', text: 'Intent Summary' },
        { type: 'paragraph', text: intent.title + ' — ' + intent.domain.toUpperCase() + ' domain' },
        { type: 'paragraph', text: 'Status: ' + intent.status + (intent.waitingReason ? ' (' + intent.waitingReason.replace(/_/g, ' ') + ')' : '') },
        { type: 'paragraph', text: simNote || 'No simulation attached.' },
        { type: 'heading_2', text: 'Steps' }
      ].concat(steps)
    };
  }

  function _generateEmailDraft(input) {
    var exec = window.LIMENExecutive;
    var intent = input.intent || (exec && input.intentId ? exec.getIntent(input.intentId) : null);
    var nextStep = intent && exec ? exec.getNextRecommendedStep(intent.id) : null;

    var subject = input.subject || (intent ? 'LIMEN: ' + intent.title + ' — action needed' : 'LIMEN Alert');
    var body = [];
    body.push('Domain: ' + (intent ? intent.domain.toUpperCase() : input.domain || 'Unknown'));
    if (intent) {
      body.push('Status: ' + intent.status);
      if (intent.waitingReason) body.push('Waiting: ' + intent.waitingReason.replace(/_/g, ' '));
      body.push('Progress: ' + Math.round(intent.progress * 100) + '%');
    }
    if (nextStep && !nextStep.done) {
      body.push('');
      body.push('Next action: ' + nextStep.label);
      body.push('Recommendation: ' + (nextStep.recommendation || ''));
    }
    if (intent && intent.simulation) {
      body.push('');
      body.push('Simulation: ' + intent.simulation.evidenceLevel + ' confidence');
      body.push(intent.simulation.summary);
      if (intent.simulation.riskFlags && intent.simulation.riskFlags.length > 0) {
        body.push('Risk flags: ' + intent.simulation.riskFlags.join(', '));
      }
    }
    body.push('');
    body.push('— LIMEN Executive Control');

    return {
      to: input.to || '[recipient]',
      subject: subject,
      body: body.join('\n')
    };
  }

  function _generateSlackMessage(input) {
    var exec = window.LIMENExecutive;
    var intent = input.intent || (exec && input.intentId ? exec.getIntent(input.intentId) : null);

    var parts = [];
    if (intent) {
      var urgencyIcon = intent.priority > 0.7 ? ':red_circle:' : (intent.priority > 0.4 ? ':large_orange_circle:' : ':white_circle:');
      parts.push(urgencyIcon + ' *' + intent.title + '* [' + intent.status + ']');
      parts.push('Domain: ' + intent.domain.toUpperCase() + ' | Progress: ' + Math.round(intent.progress * 100) + '%');
      if (intent.waitingReason) parts.push('Waiting: ' + intent.waitingReason.replace(/_/g, ' '));
      var next = exec ? exec.getNextRecommendedStep(intent.id) : null;
      if (next && !next.done) parts.push('Next: ' + next.label);
    } else {
      parts.push(':warning: LIMEN Alert: ' + (input.title || input.domain || 'System event'));
    }

    return { channel: input.channel || '#limen-alerts', text: parts.join('\n') };
  }

  function _generateReport(input) {
    var exec = window.LIMENExecutive;
    var sim = window.LIMENSimulation;
    var domains = window.LIMENDomains || {};

    var sections = [];

    // Executive summary
    sections.push('# LIMEN Executive Report');
    sections.push('Generated: ' + new Date().toISOString().substring(0, 19));
    sections.push('');

    // Active intents
    if (exec) {
      var intents = exec.getActiveIntents();
      sections.push('## Active Intents (' + intents.length + ')');
      for (var ii = 0; ii < intents.length; ii++) {
        var intent = intents[ii];
        sections.push('- **' + intent.title + '** [' + intent.status + '] ' + Math.round(intent.progress * 100) + '%');
        if (intent.waitingReason) sections.push('  Waiting: ' + intent.waitingReason.replace(/_/g, ' '));
      }
      sections.push('');

      // Blocked / stale
      var audit = exec.getExecutiveAudit();
      if (audit.blockedCount > 0 || audit.staleCount > 0) {
        sections.push('## Alerts');
        if (audit.blockedCount > 0) sections.push('- **Blocked intents:** ' + audit.blockedCount);
        if (audit.staleCount > 0) sections.push('- **Stale intents:** ' + audit.staleCount);
        sections.push('');
      }
    }

    // Stressed domains
    sections.push('## Domain Stress');
    var domKeys = Object.keys(domains).sort(function (a, b) { return (domains[b].stress || 0) - (domains[a].stress || 0); });
    for (var di = 0; di < Math.min(domKeys.length, 10); di++) {
      var dk = domKeys[di];
      sections.push('- ' + dk.toUpperCase() + ': ' + Math.round((domains[dk].stress || 0) * 100) + '%');
    }
    sections.push('');

    // Simulation highlights
    if (sim) {
      var simAudit = sim.getSimulationAudit();
      sections.push('## Simulation');
      sections.push('- Total runs: ' + simAudit.totalRun);
      sections.push('- Avg confidence: ' + (simAudit.avgConfidence || 0));
      sections.push('');
    }

    // Recommended actions
    sections.push('## Recommended Human Actions');
    if (exec) {
      var queue = exec.getExecutiveQueue();
      for (var qi = 0; qi < Math.min(queue.length, 3); qi++) {
        var q = queue[qi];
        if (q.nextStep && !q.nextStep.done) {
          sections.push('- ' + q.title + ': ' + q.nextStep.label);
        }
      }
    }

    return { format: 'markdown', content: sections.join('\n') };
  }

  function _generateTaskList(input) {
    var exec = window.LIMENExecutive;
    var intent = input.intent || (exec && input.intentId ? exec.getIntent(input.intentId) : null);
    if (!intent) return { tasks: [] };

    var tasks = (intent.steps || []).map(function (s, idx) {
      return {
        order: idx + 1,
        label: s.label,
        type: s.type,
        done: s.status === 'COMPLETED',
        recommendation: s.recommendation || ''
      };
    });

    return { intentTitle: intent.title, domain: intent.domain, tasks: tasks };
  }

  var GENERATORS = {
    NOTION_PAGE: _generateNotionPage,
    EMAIL_DRAFT: _generateEmailDraft,
    SLACK_MESSAGE: _generateSlackMessage,
    REPORT_GENERATION: _generateReport,
    TASK_LIST: _generateTaskList
  };

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  function createDraft(adapterType, input) {
    if (ADAPTER_TYPES.indexOf(adapterType) === -1) {
      return { error: 'UNKNOWN_ADAPTER', adapterType: adapterType };
    }

    var generator = GENERATORS[adapterType];
    var payload = generator(input || {});

    var draft = {
      id: 'draft_' + _uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      adapterType: adapterType,
      status: 'DRAFT',
      approved: false,
      executed: false,
      sourceType: input.sourceType || 'manual',
      sourceId: input.sourceId || input.intentId || '',
      intentId: input.intentId || '',
      domain: input.domain || (input.intent ? input.intent.domain : ''),
      title: payload.title || payload.subject || payload.intentTitle || input.title || 'Untitled Draft',
      summary: payload.text || (payload.body ? payload.body.substring(0, 200) : '') || '',
      payload: payload,
      riskFlags: [],
      approvalContext: {
        requiresHumanApproval: true,
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedReason: null
      }
    };

    // Add risk flags from intent simulation if available
    var exec = window.LIMENExecutive;
    if (input.intentId && exec) {
      var intent = exec.getIntent(input.intentId);
      if (intent && intent.simulation && intent.simulation.riskFlags) {
        draft.riskFlags = intent.simulation.riskFlags.slice();
      }
    }

    var drafts = _getDrafts();
    drafts.push(draft);
    _saveDrafts(drafts);
    _updateAudit('create', adapterType, draft.sourceType);

    _emit('limen:draft-created', {
      draftId: draft.id, adapterType: adapterType,
      sourceType: draft.sourceType, sourceId: draft.sourceId,
      status: 'DRAFT', trigger: 'createDraft'
    });

    return draft;
  }

  function getDraft(id) {
    var drafts = _getDrafts();
    for (var i = 0; i < drafts.length; i++) {
      if (drafts[i].id === id) return drafts[i];
    }
    return null;
  }

  function getDrafts(filter) {
    var drafts = _getDrafts();
    if (!filter) return drafts;
    return drafts.filter(function (d) {
      if (filter.status && d.status !== filter.status) return false;
      if (filter.adapterType && d.adapterType !== filter.adapterType) return false;
      if (filter.domain && d.domain !== filter.domain) return false;
      if (filter.intentId && d.intentId !== filter.intentId) return false;
      return true;
    });
  }

  function approveDraft(id) {
    var drafts = _getDrafts();
    for (var i = 0; i < drafts.length; i++) {
      if (drafts[i].id === id) {
        drafts[i].status = 'APPROVED';
        drafts[i].approved = true;
        drafts[i].executed = false; // Phase 13: never true
        drafts[i].updatedAt = Date.now();
        drafts[i].approvalContext.approvedAt = Date.now();
        _saveDrafts(drafts);
        _updateAudit('approve');
        _emit('limen:draft-approved', {
          draftId: id, adapterType: drafts[i].adapterType,
          trigger: 'approveDraft'
        });
        return drafts[i];
      }
    }
    return null;
  }

  function rejectDraft(id, reason) {
    var drafts = _getDrafts();
    for (var i = 0; i < drafts.length; i++) {
      if (drafts[i].id === id) {
        drafts[i].status = 'REJECTED';
        drafts[i].approved = false;
        drafts[i].executed = false;
        drafts[i].updatedAt = Date.now();
        drafts[i].approvalContext.rejectedAt = Date.now();
        drafts[i].approvalContext.rejectedReason = reason || '';
        _saveDrafts(drafts);
        _updateAudit('reject');
        _emit('limen:draft-rejected', {
          draftId: id, adapterType: drafts[i].adapterType,
          reason: reason || '', trigger: 'rejectDraft'
        });
        return drafts[i];
      }
    }
    return null;
  }

  function renderDraft(id) {
    var draft = getDraft(id);
    if (!draft) return null;
    // Return structured render-ready object, no DOM manipulation
    return {
      id: draft.id,
      adapterType: draft.adapterType,
      status: draft.status,
      approved: draft.approved,
      title: draft.title,
      payload: draft.payload,
      riskFlags: draft.riskFlags,
      approvalContext: draft.approvalContext
    };
  }

  function getAdapterAudit() {
    return _getAudit();
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENActionAdapters = {
    createDraft: createDraft,
    getDraft: getDraft,
    getDrafts: getDrafts,
    approveDraft: approveDraft,
    rejectDraft: rejectDraft,
    renderDraft: renderDraft,
    getAdapterAudit: getAdapterAudit
  };

})();
