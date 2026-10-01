/**
 * LIMEN Helix — Execution Observatory
 *
 * Read-only operator surface for the server cognition refresh and autofire
 * audit. This intentionally reports readiness, persistence, observations and
 * holds; it never opens a valve, dispatches a provider call, or treats a
 * browser-side brain mirror as execution evidence.
 *
 * Mount: <div id="execution-observatory"></div>
 */
(function (root) {
  'use strict';

  var DOMAINS = [
    'energy', 'infrastructure', 'culture', 'finance', 'economy',
    'technology', 'defense', 'intelligence', 'trade', 'industry',
    'environment', 'governance', 'agriculture', 'communication', 'medicine',
    'education', 'population', 'science', 'law', 'religion'
  ];
  var ALIASES = { trade: 'supplyChain', medicine: 'health', science: 'research' };
  var POLL_MS = 30000;
  var COGNITION_TTL_MS = 3 * 3600 * 1000; // server cognition storage TTL
  var state = { cognition: {}, cognitionCount: 0, cognitionTs: 0, autofire: null, error: null, loading: true, lastRefreshAt: 0 };
  var mounted = false;
  var pollTimer = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function obj(value) { return value && typeof value === 'object' ? value : {}; }
  function n(value, fallback) { return typeof value === 'number' && isFinite(value) ? value : (fallback == null ? 0 : fallback); }
  function yes(value) { return value === true ? 'YES' : 'NO'; }
  function count(value) { return Array.isArray(value) ? value.length : (typeof value === 'number' ? value : 0); }
  function time(value) {
    if (!value) return '—';
    var d = new Date(value);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }
  function age(value) {
    if (!value) return 'unknown';
    var ms = typeof value === 'number' ? value : Date.parse(value);
    if (!isFinite(ms)) return 'unknown';
    var seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (seconds < 60) return seconds + 's ago';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    return Math.floor(seconds / 3600) + 'h ago';
  }
  function cls(value) { return String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  function badge(value, kind) { return '<span class="exo-badge exo-' + cls(kind || value) + '">' + esc(value || 'UNOBSERVED') + '</span>'; }
  function api(url) {
    return fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
      return response.json();
    });
  }

  function browserBrain(domain) {
    var candidates = [domain, ALIASES[domain]];
    var all = root.LIMENDomainBrains && typeof root.LIMENDomainBrains.getAll === 'function'
      ? root.LIMENDomainBrains.getAll() : {};
    var snapshots = root.LIMENDomains || {};
    for (var i = 0; i < candidates.length; i++) {
      var key = candidates[i];
      if (!key) continue;
      if (all && all[key] && all[key].state) return all[key].state;
      if (snapshots && snapshots[key]) return snapshots[key];
    }
    return null;
  }

  function laneCounts(packet) {
    var opportunities = packet && packet.truth && packet.truth.opportunities;
    var result = { investments: 0, research: 0, other: 0 };
    arr(opportunities).forEach(function (opportunity) {
      var path = String(opportunity && (opportunity.path || opportunity.lane) || '').toUpperCase();
      if (path === 'INVESTABLE' || path === 'INVESTMENTS' || path === 'INVESTMENT') result.investments++;
      else if (path === 'RESEARCHABLE' || path === 'RESEARCH-PAPERS' || path === 'RESEARCH') result.research++;
      else result.other++;
    });
    return result;
  }

  function record(domain) {
    var entry = state.cognition[domain] || null;
    var c = entry && entry.c ? entry.c : {};
    var packet = c.serverPacket || {};
    var truth = packet.truth || {};
    var browser = browserBrain(domain) || {};
    var receipt = c.motorReceiptPersistence || {};
    var capability = c.motorCapabilityEvidence || {};
    var valve = c.externalValveEvidence || {};
    var organs = c.brainOrgans || {};
    var emission = organs.autonomousInternalEmission || {};
    var metabolism = organs.resourceMetabolism || {};
    var learning = organs.externalActionLearning || {};
    var commercial = organs.commercialReflex || {};
    var social = commercial.publicSocialOutcome || {};
    var packetPersist = c.serverPacketPersistence || {};
    var gates = receipt.gates || {};
    var lanes = laneCounts(packet);
    var serverSeen = !!entry;
    var timestamp = entry && (typeof entry.ts === 'number' ? entry.ts : Date.parse(entry.ts));
    var fresh = !!(serverSeen && isFinite(timestamp) && timestamp > 0 && timestamp <= Date.now() && Date.now() - timestamp < COGNITION_TTL_MS);
    var observed = !!(learning.latestSignalId || social.latestSignalId);
    // Learning credit and outcome signals do not establish earned revenue.
    var revenue = 'UNOBSERVED';
    var blockers = arr(receipt.blockers).concat(capability.reason ? [capability.reason] : []).concat(valve.reason ? [valve.reason] : []);
    if (serverSeen && !fresh) blockers.push('server-cognition-stale-or-invalid-timestamp');
    var capabilityCurrent = fresh && capability.verified === true && typeof capability.validUntil === 'number' && capability.validUntil > Date.now();
    if (capability.verified === true && !capabilityCurrent) blockers.push('capability-expiry-missing-or-expired');
    var externallyReady = capabilityCurrent && valve.eligible === true && gates.mayDispatchExternal === true;
    var stateLabel = !serverSeen ? 'UNOBSERVED' : !fresh ? 'HELD' : externallyReady ? 'EXTERNAL-READY' : capabilityCurrent ? 'CAPABILITY-VERIFIED' : blockers.length ? 'HELD' : 'PAPER';
    return {
      domain: domain, entry: entry, c: c, packet: packet, truth: truth, browser: browser,
      receipt: receipt, capability: capability, valve: valve, organs: organs,
      emission: emission, metabolism: metabolism, learning: learning,
      commercial: commercial, social: social, packetPersist: packetPersist,
      fresh: fresh,
      gates: gates, lanes: lanes, serverSeen: serverSeen, observed: observed,
      revenue: revenue, blockers: blockers, stateLabel: stateLabel
    };
  }

  function chainItem(label, value, kind) {
    return '<div class="exo-chain-item"><span class="exo-chain-label">' + esc(label) +
      '</span>' + badge(value, kind || value) + '</div>';
  }

  function renderGlobal() {
    var fire = state.autofire || {};
    var cycles = arr(fire.cycles);
    var fired = cycles.reduce(function (sum, c) { return sum + n(c.fired); }, 0);
    var skipped = cycles.reduce(function (sum, c) { return sum + n(c.skipped); }, 0);
    var errors = cycles.reduce(function (sum, c) { return sum + n(c.errors); }, 0);
    var budget = fire.budget || {};
    var budgetText = budget.armed ? ('$' + n(budget.remainingUsd).toFixed(2) + ' remaining of $' + n(budget.dailyCapUsd).toFixed(2)) : 'CLOSED / no autonomous spend budget';
    return '<div class="exo-global">' +
      '<div><span class="exo-kicker">SERVER COGNITION</span><b>' + esc(state.cognitionCount + '/20') + '</b><small> newest ' + esc(age(state.cognitionTs)) + '</small></div>' +
      '<div><span class="exo-kicker">AUTOFIRE</span><b>' + esc(String(cycles.length)) + '</b><small> cycles · ' + fired + ' fired · ' + skipped + ' skipped · ' + errors + ' errors</small></div>' +
      '<div><span class="exo-kicker">BUDGET GATE</span><b>' + esc(budget.armed ? 'ARMED' : 'CLOSED') + '</b><small>' + esc(budgetText) + '</small></div>' +
      '<div><span class="exo-kicker">READING MODE</span><b>OBSERVE ONLY</b><small>no provider call, spend, or external effect</small></div>' +
      '</div>';
  }

  function renderDomain(row) {
    var packet = row.packet;
    var phase = row.c.phase || (row.truth && (row.truth.phaseLabel || row.truth.phase)) || row.browser.brainPhase || row.browser.phase || '—';
    var stress = row.c.stress != null ? row.c.stress : row.truth.stressScore;
    var confidence = row.truth.confidence != null ? row.truth.confidence : row.browser.brainConfidence;
    var diagnosisCount = count(row.truth.activeDiagnoses) || count(row.browser.brainDiagnoses);
    var opportunityCount = count(row.truth.opportunities) || count(row.browser.brainOpportunities);
    var feedHealth = row.truth.feedHealth || {};
    var sensed = n(feedHealth.live) > 0 ? 'LIVE ' + n(feedHealth.live) + '/' + n(feedHealth.configured) : (row.c.interoception ? 'PRESENT' : 'UNOBSERVED');
    var diagnosed = diagnosisCount ? diagnosisCount + ' ACTIVE' : 'NONE';
    var routed = (row.lanes.investments + row.lanes.research) > 0 ? row.lanes.investments + ' INV · ' + row.lanes.research + ' RES' : (opportunityCount ? opportunityCount + ' OTHER' : 'NONE');
    var trace = row.c.businessTrace || {};
    var traceValid = trace.schemaVersion === 'culture-business-trace-readout/1.0' && row.domain === 'culture' &&
      trace.ownerDomain === row.domain && trace.observationOnly === true && trace.externalActionAuthorized === false && trace.status === 'RECORDED';
    var businessDecision = traceValid && trace.decision;
    var businessCommand = traceValid && trace.command;
    var decided = businessDecision ? 'RECORDED ' + businessDecision.status : 'UNOBSERVED';
    var command = businessCommand ? 'RECORDED ' + businessCommand.status : 'UNOBSERVED';
    var receipt = businessCommand && businessCommand.providerReceiptId ? 'PROVIDER-ACCEPTED' : 'UNOBSERVED';
    var observation = row.observed ? 'SIGNAL ' + (row.learning.latestSignalId || row.social.latestSignalId) : 'UNOBSERVED';
    var statusLine = row.serverSeen ? 'server ' + age(row.entry.ts) + ' · packet ' + (row.packetPersist.ok ? 'persisted' : 'held') : 'server cognition unavailable';
    var blockers = row.blockers.slice(0, 3).join(' · ');
    var afferent = row.learning.financialAfferent || {};
    var routedReturn = row.learning.routedOutcomeReturn || {};
    var returnedResult = routedReturn.latest || {};
    var originRef = arr(returnedResult.sourceDomains)[0] || {};
    var learningOwner = row.learning.domain || ALIASES[row.domain] || row.domain;
    var resultUrl = '/api/product-domain-learning-state?domain=' + encodeURIComponent(learningOwner);
    if (!blockers) blockers = row.stateLabel === 'PAPER' ? 'provider-owned executor/observer evidence is not present in the server read' : 'none reported';
    return '<article class="exo-domain exo-state-' + cls(row.stateLabel) + '">' +
      '<div class="exo-domain-head"><span class="exo-domain-name">' + esc(row.domain) + '</span>' + badge(row.stateLabel, row.stateLabel) + '<span class="exo-domain-meta">phase ' + esc(phase) + ' · stress ' + esc(stress == null ? '—' : Number(stress).toFixed(2)) + ' · conf ' + esc(confidence == null ? '—' : Number(confidence).toFixed(2)) + '</span></div>' +
      '<div class="exo-domain-sub">' + esc(statusLine) + ' · owner ' + esc(row.receipt.ownerDomain || row.valve.ownerDomain || row.domain) + ' · lane ' + esc(row.receipt.lane || row.valve.lane || '—') + '</div>' +
      '<div class="exo-chain">' +
        chainItem('SENSED', sensed, feedHealth.live > 0 ? 'live' : sensed === 'UNOBSERVED' ? 'unobserved' : 'present') +
        chainItem('DIAGNOSED', diagnosed, diagnosisCount ? 'present' : 'held') +
        chainItem('ROUTED', routed, (row.lanes.investments + row.lanes.research) ? 'routed' : opportunityCount ? 'present' : 'held') +
        chainItem('DECIDED', decided, businessDecision ? 'persisted' : 'unobserved') +
        chainItem('COMMAND', command, businessCommand ? 'persisted' : 'unobserved') +
        chainItem('RECEIPT', receipt, receipt === 'PROVIDER-ACCEPTED' ? 'persisted' : 'unobserved') +
        chainItem('OBSERVED', observation, row.observed ? 'observed' : 'unobserved') +
        chainItem('REVENUE', row.revenue, 'unobserved') +
      '</div>' +
      '<div class="exo-facts">' +
        '<span>internal emission <b>' + esc(n(row.emission.emittedCount)) + '</b> · staged ' + esc(n(row.emission.stagedCount)) + '</span>' +
        '<span>readiness receipt <b>' + esc(row.receipt.status || (row.receipt.ok ? 'PERSISTED' : 'UNOBSERVED')) + '</b> · preparation ' + esc(row.gates.mayPrepare === true ? 'PERMITTED' : 'HELD') + '</span>' +
        '<span>business trace <b>' + esc(trace.status || 'UNOBSERVED') + '</b> · ' + esc(trace.reason || (traceValid ? 'historical records; dispatch revalidates authority' : 'business decision/command read not connected for this domain')) + '</span>' +
        (businessDecision ? '<span>decision <b>' + esc(businessDecision.id) + '</b> · packet ' + esc(businessDecision.packetId || 'UNOBSERVED') + ' · ' + esc(time(businessDecision.decidedAt)) + ' · key ' + esc(businessDecision.key) + '</span>' : '') +
        (businessCommand ? '<span>command <b>' + esc(businessCommand.id) + '</b> · decision ' + esc(businessCommand.decisionId) + ' · ' + esc(time(businessCommand.commandedAt)) + ' · key ' + esc(businessCommand.key) + ' · provider receipt ' + esc(businessCommand.providerReceiptId || 'UNOBSERVED') + '</span>' : '') +
        '<span>executor <b>' + esc(yes(row.capability.executorVerified)) + '</b></span>' +
        '<span>outcome observer <b>' + esc(yes(row.capability.independentOutcomeObserverVerified)) + '</b></span>' +
        '<span>external valve <b>' + esc(row.valve.eligible === true ? 'ELIGIBLE' : 'HELD') + '</b></span>' +
        '<span>capability expires <b>' + esc(time(row.capability.validUntil)) + '</b> · dispatch revalidates current authority</span>' +
        '<span>packet <b>' + esc(row.packetPersist.ok === true ? 'PERSISTED' : 'HELD') + '</b></span>' +
        '<span>commercial reflex <b>' + esc(row.commercial.status || 'UNOBSERVED') + '</b></span>' +
        '<span>learning credit <b>' + esc(row.social.normalizedCredit == null ? 'UNOBSERVED' : row.social.normalizedCredit) + '</b> (not revenue)</span>' +
        '<span>returned learning <b>' + esc(row.learning.status || 'UNOBSERVED') + '</b> · ' + esc(row.learning.reason || row.learning.latestSignalId || 'no signal') + '</span>' +
        '<span>learner gate <b>' + esc(row.learning.learningGate && row.learning.learningGate.ready === true ? 'READY' : 'HELD') + '</b> · resolved ' + esc(n(row.learning.resolvedCount)) + '</span>' +
        '<span>action <b>' + esc(row.learning.actionId || 'UNOBSERVED') + '</b> · event ' + esc(row.learning.eventId || 'UNOBSERVED') + ' · observed ' + esc(time(row.learning.observedAt)) + '</span>' +
        (afferent.status ? '<span>Finance afferent <b>' + esc(afferent.status) + '</b> · ' + esc(afferent.signalId || afferent.reason || 'no signal') + ' · action ' + esc(afferent.actionId || 'UNOBSERVED') + ' · separate from motor authority</span>' : '') +
        (routedReturn.status ? '<span>routed outcome return <b>' + esc(routedReturn.status) + '</b> · ' + esc(returnedResult.returnId || routedReturn.reason || 'no return') + ' · owner ' + esc(returnedResult.ownerDomain || 'UNOBSERVED') + ' · action ' + esc(returnedResult.actionId || 'UNOBSERVED') + ' · source packet ' + esc(originRef.sourcePacketId || originRef.sourceArtifactRef || 'UNOBSERVED') + ' · learning stays with destination; origin observation only' + (routedReturn.reason ? ' · ' + esc(routedReturn.reason) : '') + arr(routedReturn.failures).map(function (failure) { return ' · ' + esc(failure.ownerDomain + ': ' + failure.reason); }).join('') + '</span>' : '') +
        '<span>result read <a href="' + esc(resultUrl) + '">' + esc(resultUrl) + '</a> · readiness key ' + esc(row.receipt.key || 'UNOBSERVED') + '</span>' +
      '</div>' +
      '<div class="exo-blockers"><span>WHY THIS IS NOT AUTONOMOUSLY EXTERNAL:</span> ' + esc(blockers) + '</div>' +
      '</article>';
  }

  function render() {
    var el = document.getElementById('execution-observatory');
    if (!el) return;
    var errorText = state.error ? '<div class="exo-error">read failure: ' + esc(state.error) + ' · retrying automatically</div>' : '';
    var rows = DOMAINS.map(record);
    el.innerHTML = '<section class="exo-root">' +
      '<header class="exo-header"><div><div class="exo-title">Execution Observatory</div><div class="exo-subtitle">Where the repaired domain loops are, what has persisted, and what remains held</div></div><div class="exo-refresh">' + (state.loading ? 'loading…' : 'refreshed ' + esc(age(state.lastRefreshAt))) + '</div></header>' +
      errorText + renderGlobal() +
      '<div class="exo-legend"><span>FLOW</span> SENSED → DIAGNOSED → ROUTED → DECIDED → COMMAND → RECEIPT → OBSERVED → REVENUE <i>“HELD” means the gate is visible and closed; “UNOBSERVED” means no evidence was returned.</i></div>' +
      '<div class="exo-domains">' + rows.map(renderDomain).join('') + '</div>' +
      '<footer class="exo-footer">Read-only records. Internal emissions and preparation gates are shown separately from business decisions and commands. Provider acceptance requires its recorded identity; it does not establish an independent outcome or revenue.</footer>' +
      '</section>';
  }

  function injectStyles() {
    if (document.getElementById('execution-observatory-styles')) return;
    var style = document.createElement('style');
    style.id = 'execution-observatory-styles';
    style.textContent = [
      '#execution-observatory{grid-column:1/-1;width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
      '.exo-root{margin:12px 0 18px;padding:14px;border:1px solid rgba(122,154,230,.28);border-radius:6px;background:linear-gradient(180deg,rgba(14,20,38,.96),rgba(8,11,20,.96));color:#d8deeb}',
      '.exo-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:1px solid rgba(122,154,230,.18);padding-bottom:10px}',
      '.exo-title{font-size:16px;font-weight:700;letter-spacing:.5px;color:#9eb7f2}',
      '.exo-subtitle,.exo-refresh,.exo-domain-sub,.exo-footer{font-size:10px;color:#7e8ba8;margin-top:4px}',
      '.exo-refresh{white-space:nowrap}',
      '.exo-global{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}',
      '.exo-global>div{padding:8px;background:rgba(255,255,255,.035);border-radius:4px;min-width:0}',
      '.exo-kicker{display:block;font-size:9px;letter-spacing:1px;color:#7483a5;margin-bottom:3px}',
      '.exo-global b{display:block;font-size:13px;color:#eef2fa}',
      '.exo-global small{display:block;font-size:9px;color:#8c97ae;margin-top:3px;line-height:1.35}',
      '.exo-legend{font-size:9px;color:#9aa7c1;line-height:1.6;margin:8px 0 10px}.exo-legend span{color:#708ac1;letter-spacing:1px}.exo-legend i{display:block;color:#68758f;font-style:normal}',
      '.exo-domains{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
      '.exo-domain{padding:9px;border:1px solid rgba(255,255,255,.08);border-left:3px solid #5e6d87;border-radius:4px;background:rgba(255,255,255,.025);min-width:0}',
      '.exo-state-external-verified{border-left-color:#65d3ad}.exo-state-paper{border-left-color:#d8bd6e}.exo-state-held{border-left-color:#d58b8b}.exo-state-unobserved{border-left-color:#69748b}',
      '.exo-domain-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.exo-domain-name{text-transform:uppercase;font-size:12px;font-weight:700;color:#e7ebf4;letter-spacing:.6px}.exo-domain-meta{margin-left:auto;font-size:9px;color:#8692aa}',
      '.exo-badge{display:inline-block;padding:2px 5px;border:1px solid currentColor;border-radius:3px;font-size:8px;letter-spacing:.7px;white-space:nowrap}',
      '.exo-live,.exo-present,.exo-routed,.exo-decided,.exo-credit,.exo-observed,.exo-persisted{color:#72d3af}.exo-ready{color:#9eb7f2}.exo-pending,.exo-held{color:#e0c476}.exo-unobserved{color:#8892a5}.exo-paper{color:#e0c476}.exo-capability-verified,.exo-external-ready{color:#72d3af}',
      '.exo-chain{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;margin-top:8px}.exo-chain-item{min-width:0;text-align:center;padding:4px 2px;background:rgba(0,0,0,.18);border-radius:3px}.exo-chain-label{display:block;font-size:7px;letter-spacing:.6px;color:#77839a;margin-bottom:3px}',
      '.exo-chain-item .exo-badge{max-width:100%;overflow:hidden;text-overflow:ellipsis}',
      '.exo-facts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:8px;color:#7f8ba2}.exo-facts b{font-weight:600;color:#ced7e7}',
      '.exo-blockers{margin-top:7px;font-size:8px;line-height:1.4;color:#b19b9b}.exo-blockers span{color:#d18f8f;letter-spacing:.5px}',
      '.exo-error{margin-top:8px;padding:7px;background:rgba(180,70,70,.15);border:1px solid rgba(210,110,110,.25);font-size:9px;color:#e6a0a0}',
      '@media(max-width:900px){.exo-global{grid-template-columns:repeat(2,minmax(0,1fr))}.exo-domains{grid-template-columns:1fr}.exo-chain{grid-template-columns:repeat(4,minmax(0,1fr))}.exo-domain-meta{margin-left:0;width:100%}}',
      '@media(max-width:520px){.exo-global{grid-template-columns:1fr}.exo-chain{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    ].join('');
    document.head.appendChild(style);
  }

  function refresh() {
    state.loading = true;
    render();
    return Promise.all([
      api('/api/brain-cognition'),
      api('/api/limen-autofire-log?limit=50')
    ]).then(function (results) {
      var data = results[0];
      state.cognition = data && data.cognition || {};
      state.cognitionCount = n(data && data.count);
      state.cognitionTs = data && data.newest || 0;
      state.autofire = results[1] || {};
      state.error = null;
    }).catch(function (error) {
      state.error = String(error && error.message || error);
      // A failed read cannot continue to advertise previously cached readiness.
      state.cognition = {};
      state.cognitionCount = 0;
      state.cognitionTs = 0;
      state.autofire = null;
    }).then(function () {
      state.loading = false;
      state.lastRefreshAt = Date.now();
      render();
    });
  }

  function mount() {
    if (mounted || !document.getElementById('execution-observatory')) return;
    mounted = true;
    injectStyles();
    refresh();
    pollTimer = setInterval(refresh, POLL_MS);
    root.addEventListener('limen:domain-brain-update', render);
    root.addEventListener('limen:domain-update', render);
  }

  root.LIMENExecutionObservatory = { mount: mount, refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
