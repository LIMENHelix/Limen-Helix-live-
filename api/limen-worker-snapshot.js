/**
 * api/limen-worker/snapshot.js — Snapshot cache worker
 *
 * GET /api/limen-worker/snapshot
 *
 * Builds console + opportunities snapshots server-side.
 * Browser fetches these instead of computing everything.
 * Called by cron every 2-5 minutes.
 */

var db = require('./lib/limen-db');
var companyScorer = require('./lib/company-phase-scorer');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var start = Date.now();

  // ── Phase 25: Priority-aware parallel company scoring ──
  // Deferred until domain health is available (scored after domain snapshot fetch)

  // Fetch latest domain snapshot
  var domainResp;
  try {
    domainResp = await fetch('https://www.limenhelix.com/api/domain-snapshot');
    domainResp = await domainResp.json();
  } catch (e) {
    res.status(500).json({ ok: false, error: 'domain-snapshot fetch failed: ' + e.message });
    return;
  }

  // Fetch latest defense signals
  var defenseResp;
  try {
    defenseResp = await fetch('https://www.limenhelix.com/api/defense-signals');
    defenseResp = await defenseResp.json();
  } catch (e) {
    defenseResp = { signals: [], macroShock: { detected: false } };
  }

  // Build console snapshot
  var domains = domainResp.domains || {};
  var domainSummary = {};
  var stressRanked = [];
  for (var dk in domains) {
    if (!domains.hasOwnProperty(dk)) continue;
    var d = domains[dk];
    // Phase 24X: Server-side provisional phase (supported phases only)
    // P7a/P9/P10/P8 suppressed — require viability/recovery inputs not available server-side
    var sStress = d.stress || 0;
    var sMat = d.maturity || 'EARLY';
    var sConf = d.confidence || 0;
    var phase = 'p0', phaseLabel = 'SOURCE';
    if (sStress >= 0.59 && sMat === 'STRUCTURAL') { phase = 'p5'; phaseLabel = 'ENDURANCE'; }
    else if (sStress >= 0.59 && sMat === 'CONFIRMED') { phase = 'p3'; phaseLabel = 'INSTABILITY'; }
    else if (sStress >= 0.40 && sMat === 'STRUCTURAL') { phase = 'p5'; phaseLabel = 'ENDURANCE'; }
    else if (sStress >= 0.40 && sMat === 'CONFIRMED') { phase = 'p3'; phaseLabel = 'INSTABILITY'; }
    else if (sStress >= 0.25) { phase = 'p2'; phaseLabel = 'RHYTHM'; }
    else if (sStress >= 0.15 && sMat === 'FORMING') { phase = 'p1'; phaseLabel = 'RUPTURE'; }

    domainSummary[dk] = {
      stress: sStress,
      activity: d.activity || 0,
      confidence: sConf,
      maturity: sMat,
      phase: phase,
      phaseLabel: phaseLabel,
      status: d.status || 'UNKNOWN',
      liveCount: d.liveCount || 0,
      topSignal: (d.signals && d.signals[0]) || null,
      sources: (d.sources || []).map(function(s) { return { name: s.name, live: s.live, channel: s.channel || null }; }),
      _channels: d._channels || null,
      _confidence: d._confidence || null
    };
    stressRanked.push({ domain: dk, stress: sStress, activity: d.activity || 0, confidence: sConf, maturity: sMat, phase: phase });
  }
  stressRanked.sort(function(a, b) { return b.stress - a.stress; });

  var consoleSnapshot = {
    generatedAt: Date.now(),
    version: 2,
    domains: domainSummary,
    stressRanked: stressRanked,
    macroShock: defenseResp.macroShock || { detected: false },
    defenseSignals: (defenseResp.signals || []).slice(0, 6),
    domainCount: Object.keys(domains).length,
    liveCount: Object.keys(domains).filter(function(k) { return domains[k].status === 'LIVE'; }).length,
    convergenceSignals: null // populated below
  };

  // ── Phase 25: Score companies (priority scheduler needs domainSummary) ──
  var companyResult = null;
  try {
    companyResult = await companyScorer.scoreBatch(domainSummary);
  } catch (e) {
    companyResult = { scored: [], error: e.message };
  }

  // ── Phase 25: Build domain company join + convergence signals ──
  var convergenceSignals = {};
  try {
    var domainJoin = await companyScorer.buildDomainJoin();
    convergenceSignals = companyScorer.evaluateConvergenceSignals(domainJoin, domainSummary);
    consoleSnapshot.convergenceSignals = convergenceSignals;
    consoleSnapshot.domainCompanyJoin = domainJoin;
  } catch (e) {
    consoleSnapshot.convergenceSignals = {};
  }

  await db.set('console_snapshot', consoleSnapshot, 300);

  // ── Server-side change log: detect and record domain changes ──
  try {
    var prevSnap = await db.get('prev_console_snapshot');
    if (prevSnap && prevSnap.domains) {
      for (var clk in domainSummary) {
        var cur = domainSummary[clk];
        var prev = prevSnap.domains[clk];
        if (!prev) continue;
        var clKey = 'changelog_' + clk;
        var clLog = await db.get(clKey);
        var clEntries = (clLog && clLog.entries) ? clLog.entries : [];
        var clNow = Date.now();

        // Stress shift > 3%
        if (Math.abs((cur.stress||0) - (prev.stress||0)) > 0.03) {
          var dir = cur.stress > prev.stress ? 'rose' : 'fell';
          clEntries.push({ timestamp:clNow, domain:clk, type:'HEALTH_CHANGE', severity: Math.abs(cur.stress-prev.stress)>0.10?'HIGH':'MEDIUM', title:'Stress '+dir+' to '+Math.round(cur.stress*100)+'%', description:Math.round(prev.stress*100)+'% → '+Math.round(cur.stress*100)+'%', metadata:{} });
        }
        // Maturity change
        if (prev.maturity && prev.maturity !== cur.maturity) {
          clEntries.push({ timestamp:clNow, domain:clk, type:'HEALTH_CHANGE', severity:'HIGH', title:'Maturity: '+prev.maturity+' → '+cur.maturity, description:'', metadata:{} });
        }
        // Phase change
        if (prev.phase && prev.phase !== cur.phase) {
          clEntries.push({ timestamp:clNow, domain:clk, type:'HEALTH_CHANGE', severity:'HIGH', title:'Phase: '+prev.phase+' → '+cur.phase, description:'', metadata:{} });
        }

        if (clEntries.length > 500) clEntries = clEntries.slice(-500);
        await db.set(clKey, { entries:clEntries, updatedAt:clNow }, 604800);
      }
    }
    await db.set('prev_console_snapshot', consoleSnapshot, 600);
  } catch (e) { /* change log non-critical */ }

  // ── Phase 23D-E: Activity-aware opportunity ranking ──
  // rank = stress * confidence * maturityWeight * propagationFactor
  // high stress + high activity → immediate opportunity
  // high stress + low activity → early signal
  // low stress + high activity → crowded / watch
  var MATURITY_WEIGHT = { STRUCTURAL: 1.3, CONFIRMED: 1.0, FORMING: 0.7, EARLY: 0.4 };

  var opportunities = [];
  var FAMILIES = {
    energy: ['grid resilience monitoring', 'fuel logistics intelligence', 'supply routing optimization'],
    defense: ['threat detection platform', 'defense logistics coordination', 'situational awareness SaaS'],
    supplyChain: ['shipping route optimization', 'cargo tracking intelligence', 'supply chain visibility platform'],
    finance: ['risk analytics dashboard', 'volatility hedging tools', 'compliance automation'],
    agriculture: ['food supply chain tracking', 'crop input cost monitoring', 'precision agriculture analytics'],
    health: ['public health surveillance', 'medical supply chain monitoring', 'healthcare capacity analytics'],
    technology: ['cybersecurity monitoring', 'infrastructure resilience testing', 'AI-driven anomaly detection'],
    governance: ['regulatory change tracking', 'policy impact analytics', 'compliance reporting automation'],
    industry: ['manufacturing resilience monitoring', 'industrial IoT analytics', 'equipment lifecycle optimization']
  };

  for (var sdk in domains) {
    var sd = domains[sdk];
    var sdStress = sd.stress || 0;
    var sdConf = sd.confidence || 0;
    var sdActivity = sd.activity || 0;
    var sdMaturity = sd.maturity || 'EARLY';
    var mw = MATURITY_WEIGHT[sdMaturity] || 0.4;

    // Only generate opportunities for domains with meaningful stress or high-confidence signals
    if (sdStress < 0.25 && sdMaturity === 'EARLY') continue;
    if (sdStress < 0.15) continue;

    // Propagation factor: high activity amplifies urgency of stress
    var propagation = 1.0;
    if (sdStress > 0.4 && sdActivity > 0.5) propagation = 1.2; // immediate
    else if (sdStress > 0.4 && sdActivity < 0.2) propagation = 0.8; // early signal, not urgent
    else if (sdStress < 0.25 && sdActivity > 0.5) propagation = 0.5; // crowded/noisy

    var rank = sdStress * sdConf * mw * propagation;

    // Classify opportunity urgency
    var urgency = 'WATCH';
    if (sdStress > 0.5 && sdActivity > 0.3 && sdMaturity !== 'EARLY') urgency = 'IMMEDIATE';
    else if (sdStress > 0.3 && sdConf > 0.5) urgency = 'ACTIVE';
    else if (sdStress > 0.2) urgency = 'EMERGING';

    var families = FAMILIES[sdk] || ['domain-specific solution'];
    for (var fi = 0; fi < families.length; fi++) {
      opportunities.push({
        domain: sdk,
        title: families[fi],
        stress: sdStress,
        confidence: sdConf,
        activity: sdActivity,
        maturity: sdMaturity,
        urgency: urgency,
        rank: Math.round(rank * 1000) / 1000,
        source: 'domain_stress',
        path: fi === 0 ? 'PATENTABLE' : (fi === 1 ? 'INVESTABLE' : 'GRANT-ELIGIBLE')
      });
    }
  }

  // Add macro shock opportunities (these are always high urgency)
  if (defenseResp.signals) {
    for (var msi = 0; msi < defenseResp.signals.length; msi++) {
      var msig = defenseResp.signals[msi];
      if (msig.confidence === 'LOW') continue;
      for (var mdi = 0; mdi < msig.affectedDomains.length; mdi++) {
        var shockDom = msig.affectedDomains[mdi];
        var domConf = (domains[shockDom] && domains[shockDom].confidence) || 0.5;
        opportunities.push({
          domain: shockDom,
          title: msig.eventType.replace(/_/g, ' ').toLowerCase() + ' response',
          stress: msig.magnitude,
          confidence: domConf,
          activity: 0,
          maturity: 'FORMING',
          urgency: msig.magnitude > 0.8 ? 'IMMEDIATE' : 'ACTIVE',
          rank: Math.round(msig.magnitude * msig.confidenceValue * 1000) / 1000,
          source: 'macro_shock',
          path: msig.magnitude > 0.8 ? 'GRANT-ELIGIBLE' : 'INVESTABLE'
        });
      }
    }
  }

  // ── Phase 25: Convergence-driven opportunities (Section 7 output contract) ──
  var CONVERGENCE_OPP_TITLES = {
    CONVERGENCE_TERMINAL: 'terminal convergence response platform',
    CONVERGENCE_INSTABILITY: 'instability convergence intervention',
    DOMAIN_STRUCTURAL: 'structural regime monitoring platform',
    COMPANY_FAILURE_CLUSTER: 'company failure cluster advisory'
  };
  for (var csk in convergenceSignals) {
    var cs = convergenceSignals[csk];
    opportunities.push({
      domain: cs.domain_id,
      title: CONVERGENCE_OPP_TITLES[cs.primary_signal] || cs.primary_signal,
      stress: cs.domain_stress,
      confidence: cs.provenance.financial_kernel ? 0.95 : 0.7,
      activity: 0,
      maturity: 'CONFIRMED',
      urgency: cs.primary_signal === 'CONVERGENCE_TERMINAL' ? 'IMMEDIATE' : 'ACTIVE',
      rank: cs.primary_signal === 'CONVERGENCE_TERMINAL' ? 0.98 : 0.90,
      source: 'convergence',
      primary_signal: cs.primary_signal,
      secondary_signals: cs.secondary_signals,
      p7a_count: cs.p7a_count,
      p3_count: cs.p3_count,
      mapped_company_count: cs.mapped_company_count,
      p7a_ratio: cs.p7a_ratio,
      p3_ratio: cs.p3_ratio,
      provenance: cs.provenance,
      path: cs.primary_signal === 'CONVERGENCE_TERMINAL' ? 'INVESTABLE' : 'GRANT-ELIGIBLE'
    });
  }

  // Sort by rank (stress * confidence * maturity * propagation)
  opportunities.sort(function(a, b) { return (b.rank || 0) - (a.rank || 0); });

  var oppSnapshot = {
    generatedAt: Date.now(),
    version: 3,
    count: opportunities.length,
    opportunities: opportunities.slice(0, 100)
  };

  await db.set('opportunities_snapshot', oppSnapshot, 300);

  res.status(200).json({
    ok: true,
    backend: db.getBackend(),
    consoleSnapshot: { domains: consoleSnapshot.domainCount, live: consoleSnapshot.liveCount },
    opportunitiesSnapshot: { count: oppSnapshot.count },
    convergenceSignals: Object.keys(convergenceSignals).length,
    companyScored: companyResult,
    macroShock: consoleSnapshot.macroShock.detected,
    processedIn: Date.now() - start + 'ms'
  });
};
