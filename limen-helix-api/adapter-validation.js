#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// adapter-validation.js
// Validation harness for the connectome → proxy → canonical kernel path.
//
// Checks: determinism, monotonicity, directional behavior.
// Does NOT change kernel math. Does NOT create a new scorer.
// Reports observed behavior for calibration decisions.
//
// Run: node limen-helix-api/adapter-validation.js
// ═══════════════════════════════════════════════════════════════════

import { runLimenPipeline, getDominantPhase, LIMEN } from './limen_backtest_kernel.js';

// ── Adapter logic (extracted from connectome-kernel-adapter.js, no window/fetch) ──

var BASE_REVENUE = 1000;
var BASE_OCF     = 200;
var BASE_CASH    = 500;
var BASE_DEBT    = 300;
var BASELINE_QUARTERS = 4;
var STRESS_QUARTERS   = 4;

function _hashSeed(str) {
  var hash = 5381;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function _seededNoise(seed, quarterIdx, metricIdx) {
  var x = seed + quarterIdx * 7919 + metricIdx * 104729;
  x = Math.sin(x) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function _variance(arr) {
  if (arr.length === 0) return 0;
  var mean = arr.reduce(function(a,b){return a+b;},0) / arr.length;
  return arr.reduce(function(a,v){return a+(v-mean)*(v-mean);},0) / arr.length;
}

function buildQuarterSequence() {
  // Fixed quarters for reproducibility (not date-dependent)
  return ['2024Q1','2024Q2','2024Q3','2024Q4','2025Q1','2025Q2','2025Q3','2025Q4'];
}

function adaptToKernelInput(stressData) {
  var domains = stressData.domains || {};
  var nodes = stressData.nodeActivations || [];
  var oppDomains = stressData.oppDomains || [];

  var avgStress = 0, stressCount = 0;
  for (var i = 0; i < oppDomains.length; i++) {
    var d = domains[oppDomains[i]];
    if (d && d.stress > 0) { avgStress += d.stress; stressCount++; }
  }
  avgStress = stressCount > 0 ? avgStress / stressCount : 0;

  var nodeStrengths = [], crossDomainCount = 0;
  for (var ni = 0; ni < Math.min(nodes.length, 20); ni++) {
    nodeStrengths.push(nodes[ni].activationStrength || 0);
    if (nodes[ni].crossDomainNode) crossDomainCount++;
  }
  var nodeVariance = _variance(nodeStrengths);
  var domainDiversity = stressCount > 0 ? Math.min(stressCount / oppDomains.length, 1.0) : 0;
  var crossDomainRatio = nodes.length > 0 ? crossDomainCount / nodes.length : 0;
  var systemicLoad = avgStress * (1 + crossDomainRatio * 0.5);

  var quarters = buildQuarterSequence();
  var Revenue = {}, OCF = {}, Cash = {}, Debt = {};
  var BASE_GROWTH = 0.02;

  for (var qi = 0; qi < quarters.length; qi++) {
    var q = quarters[qi];
    var isBaseline = qi < BASELINE_QUARTERS;

    if (isBaseline) {
      var growthFactor = 1 + BASE_GROWTH * qi;
      Revenue[q] = BASE_REVENUE * growthFactor;
      OCF[q]     = BASE_OCF * growthFactor;
      Cash[q]    = BASE_CASH * growthFactor;
      Debt[q]    = BASE_DEBT * (1 - BASE_GROWTH * 0.3 * qi);
    } else {
      var stressProgression = (qi - BASELINE_QUARTERS + 1) / STRESS_QUARTERS;
      var stressFactor = avgStress * stressProgression;
      var baselineEnd = 1 + BASE_GROWTH * (BASELINE_QUARTERS - 1);
      Revenue[q] = BASE_REVENUE * baselineEnd * (1 - stressFactor * 0.7);
      var ocfVolatility = nodeVariance * 0.5 * ((qi % 2 === 0) ? 1 : -1);
      OCF[q] = BASE_OCF * baselineEnd * (1 - stressFactor * 0.85 + ocfVolatility);
      var resilience = (1 - avgStress) * domainDiversity;
      Cash[q] = BASE_CASH * baselineEnd * (1 - stressFactor * 0.65 * (1 - resilience * 0.3));
      var baselineDebtEnd = 1 - BASE_GROWTH * 0.3 * (BASELINE_QUARTERS - 1);
      Debt[q] = BASE_DEBT * baselineDebtEnd * (1 + systemicLoad * stressProgression * 0.6);
    }
    Revenue[q] = Math.max(Revenue[q], 1);
    Cash[q] = Math.max(Cash[q], 1);
    Debt[q] = Math.max(Debt[q], 0);
  }

  return {
    companyData: { Revenue, OCF, Cash, Debt },
    proxyMapping: { avgStress, nodeVariance, domainDiversity, systemicLoad, crossDomainRatio }
  };
}

// ── Test Scenarios ──

function makeNodes(count, strength, crossDomainPct) {
  var nodes = [];
  for (var i = 0; i < count; i++) {
    nodes.push({
      activationStrength: strength + (i % 3) * 0.05,
      crossDomainNode: i < count * crossDomainPct,
      domainCount: i < count * crossDomainPct ? 2 : 1
    });
  }
  return nodes;
}

var SCENARIOS = [
  {
    name: 'STABLE_LOW',
    description: 'Stable, low-stress single domain',
    domains: { energy: { stress: 0.10, status: 'LIVE' } },
    nodeActivations: makeNodes(3, 0.10, 0),
    oppDomains: ['energy']
  },
  {
    name: 'MODERATE_SINGLE',
    description: 'Moderate stress, single domain',
    domains: { energy: { stress: 0.40, status: 'LIVE' } },
    nodeActivations: makeNodes(8, 0.40, 0.1),
    oppDomains: ['energy']
  },
  {
    name: 'RISING_SINGLE',
    description: 'Rising single-domain stress (high)',
    domains: { economy: { stress: 0.72, status: 'LIVE' } },
    nodeActivations: makeNodes(12, 0.72, 0.15),
    oppDomains: ['economy']
  },
  {
    name: 'SEVERE_SINGLE',
    description: 'Severe concentrated stress, single domain',
    domains: { finance: { stress: 0.92, status: 'LIVE' } },
    nodeActivations: makeNodes(15, 0.92, 0.2),
    oppDomains: ['finance']
  },
  {
    name: 'CROSS_DOMAIN_MODERATE',
    description: 'Two domains stressed moderately, cross-domain nodes present',
    domains: {
      energy: { stress: 0.45, status: 'LIVE' },
      supplyChain: { stress: 0.50, status: 'LIVE' }
    },
    nodeActivations: makeNodes(10, 0.47, 0.4),
    oppDomains: ['energy', 'supplyChain']
  },
  {
    name: 'CROSS_DOMAIN_SEVERE',
    description: 'Three domains converging at high stress',
    domains: {
      economy: { stress: 0.80, status: 'LIVE' },
      finance: { stress: 0.75, status: 'LIVE' },
      industry: { stress: 0.70, status: 'LIVE' }
    },
    nodeActivations: makeNodes(20, 0.75, 0.5),
    oppDomains: ['economy', 'finance', 'industry']
  },
  {
    name: 'RECOVERY_EASING',
    description: 'Previously stressed, now easing (low stress)',
    domains: { health: { stress: 0.18, status: 'LIVE' } },
    nodeActivations: makeNodes(5, 0.18, 0.1),
    oppDomains: ['health']
  },
  {
    name: 'NOISY_NONCRITICAL',
    description: 'Multiple domains with varied low-to-mid stress, high node variance',
    domains: {
      technology: { stress: 0.30, status: 'LIVE' },
      research: { stress: 0.25, status: 'LIVE' },
      education: { stress: 0.15, status: 'PARTIAL' }
    },
    nodeActivations: [
      { activationStrength: 0.10, crossDomainNode: false, domainCount: 1 },
      { activationStrength: 0.55, crossDomainNode: true, domainCount: 2 },
      { activationStrength: 0.05, crossDomainNode: false, domainCount: 1 },
      { activationStrength: 0.60, crossDomainNode: true, domainCount: 2 },
      { activationStrength: 0.08, crossDomainNode: false, domainCount: 1 },
      { activationStrength: 0.50, crossDomainNode: false, domainCount: 1 },
    ],
    oppDomains: ['technology', 'research', 'education']
  },
  {
    name: 'ZERO_STRESS',
    description: 'Zero stress everywhere (absolute calm)',
    domains: { governance: { stress: 0.0, status: 'LIVE' } },
    nodeActivations: [],
    oppDomains: ['governance']
  },
  {
    name: 'MAX_STRESS',
    description: 'Maximum stress, maximum nodes, maximum cross-domain',
    domains: {
      economy: { stress: 1.0, status: 'LIVE' },
      energy: { stress: 1.0, status: 'LIVE' },
      health: { stress: 1.0, status: 'LIVE' }
    },
    nodeActivations: makeNodes(20, 1.0, 0.8),
    oppDomains: ['economy', 'energy', 'health']
  },
];

// ── Monotonicity sweep: same domains, increasing stress ──
var MONOTONICITY_LEVELS = [0.0, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.0];

// ── Run ──

function runScenario(scenario) {
  var adapted = adaptToKernelInput(scenario);
  var result = runLimenPipeline(adapted.companyData, {});
  var lastRow = result.rows && result.rows.length > 0 ? result.rows[result.rows.length - 1] : null;
  return {
    name: scenario.name,
    proxyMapping: adapted.proxyMapping,
    composite: r3(result.composite),
    alert: result.alert,
    trajectory: result.trajectory,
    dominantPhase: lastRow ? getDominantPhase(lastRow) : null,
    C_t: lastRow ? r3(lastRow.C_t || 0) : 0,
    p3: lastRow ? r3(lastRow.p3 || 0) : 0,
    rowCount: result.rows ? result.rows.length : 0,
    pathA: r3(result.details.pathA || 0),
    pathB: r3(result.details.pathB || 0),
    pathC: r3(result.details.pathC || 0),
  };
}

function r3(v) { return Math.round(v * 1000) / 1000; }

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  LIMEN Connectome → Proxy → Kernel Adapter Self-Consistency');
  console.log('  Kernel: limen_backtest_kernel.js (Thing 2 — v4 patent recursive)');
  console.log('  This is NOT Thing 1 distress validation; Thing 1 is api/thing1/limen_backtest.py.');
  console.log('  LIMEN.START_YEAR=' + LIMEN.START_YEAR + '  HYSTERESIS_CONSEC=' + LIMEN.HYSTERESIS_CONSEC);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Scenario Tests ──
  console.log('─── SCENARIO TESTS ───────────────────────────────────────\n');
  var results = [];
  for (var i = 0; i < SCENARIOS.length; i++) {
    var r = runScenario(SCENARIOS[i]);
    results.push(r);
    console.log('  ' + r.name);
    console.log('    ' + SCENARIOS[i].description);
    console.log('    avgStress=' + r.proxyMapping.avgStress + '  sysLoad=' + r.proxyMapping.systemicLoad + '  nodeVar=' + r.proxyMapping.nodeVariance + '  xDomain=' + r.proxyMapping.crossDomainRatio);
    console.log('    composite=' + r.composite + '  alert=' + r.alert + '  trajectory=' + r.trajectory);
    console.log('    phase=' + r.dominantPhase + '  C_t=' + r.C_t + '  p3=' + r.p3);
    console.log('    pathA=' + r.pathA + '  pathB=' + r.pathB + '  pathC=' + r.pathC);
    console.log('');
  }

  // ── Determinism Test ──
  console.log('─── DETERMINISM TEST ─────────────────────────────────────\n');
  var detOk = true;
  for (var di = 0; di < SCENARIOS.length; di++) {
    var r1 = runScenario(SCENARIOS[di]);
    var r2 = runScenario(SCENARIOS[di]);
    if (r1.composite !== r2.composite || r1.trajectory !== r2.trajectory || r1.dominantPhase !== r2.dominantPhase) {
      console.log('  FAIL: ' + SCENARIOS[di].name + ' — non-deterministic');
      detOk = false;
    }
  }
  if (detOk) console.log('  PASS: All scenarios produce identical output on re-run\n');
  else console.log('');

  // ── Monotonicity Sweep ──
  console.log('─── MONOTONICITY SWEEP (economy, single domain) ──────────\n');
  console.log('  stress  composite  trajectory        phase   p3     alert');
  console.log('  ──────  ─────────  ────────────────  ──────  ─────  ─────');
  var prevComposite = -1;
  var monoViolations = [];
  for (var mi = 0; mi < MONOTONICITY_LEVELS.length; mi++) {
    var stress = MONOTONICITY_LEVELS[mi];
    var monoResult = runScenario({
      name: 'mono_' + stress,
      domains: { economy: { stress: stress, status: 'LIVE' } },
      nodeActivations: makeNodes(Math.max(1, Math.round(stress * 15)), stress, 0.1),
      oppDomains: ['economy']
    });
    var flag = '';
    if (mi > 0 && monoResult.composite < prevComposite) {
      flag = ' ← NON-MONOTONE';
      monoViolations.push({ from: MONOTONICITY_LEVELS[mi-1], to: stress, prevComp: prevComposite, curComp: monoResult.composite });
    }
    console.log('  ' + stress.toFixed(2) + '    ' + monoResult.composite.toFixed(3).padStart(8) + '  ' + monoResult.trajectory.padEnd(16) + '  ' + (monoResult.dominantPhase || '?').padEnd(6) + '  ' + monoResult.p3.toFixed(3) + '  ' + (monoResult.alert ? 'YES' : 'no ') + flag);
    prevComposite = monoResult.composite;
  }
  console.log('');

  // ── Cross-Domain Amplification Test ──
  console.log('─── CROSS-DOMAIN AMPLIFICATION ───────────────────────────\n');
  var single05 = runScenario({
    name: 'single_0.5', domains: { economy: { stress: 0.50, status: 'LIVE' } },
    nodeActivations: makeNodes(8, 0.50, 0), oppDomains: ['economy']
  });
  var dual05 = runScenario({
    name: 'dual_0.5', domains: { economy: { stress: 0.50, status: 'LIVE' }, energy: { stress: 0.50, status: 'LIVE' } },
    nodeActivations: makeNodes(12, 0.50, 0.4), oppDomains: ['economy', 'energy']
  });
  var triple05 = runScenario({
    name: 'triple_0.5', domains: { economy: { stress: 0.50, status: 'LIVE' }, energy: { stress: 0.50, status: 'LIVE' }, industry: { stress: 0.50, status: 'LIVE' } },
    nodeActivations: makeNodes(18, 0.50, 0.6), oppDomains: ['economy', 'energy', 'industry']
  });
  console.log('  Same avg stress (0.50), different domain count:');
  console.log('    1 domain:  composite=' + single05.composite + '  sysLoad=' + single05.proxyMapping.systemicLoad + '  trajectory=' + single05.trajectory);
  console.log('    2 domains: composite=' + dual05.composite + '  sysLoad=' + dual05.proxyMapping.systemicLoad + '  trajectory=' + dual05.trajectory);
  console.log('    3 domains: composite=' + triple05.composite + '  sysLoad=' + triple05.proxyMapping.systemicLoad + '  trajectory=' + triple05.trajectory);
  console.log('');

  // ── Summary ──
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('  Determinism:        ' + (detOk ? 'PASS' : 'FAIL'));
  console.log('  Monotonicity:       ' + (monoViolations.length === 0 ? 'PASS' : monoViolations.length + ' violations'));
  if (monoViolations.length > 0) {
    for (var vi = 0; vi < monoViolations.length; vi++) {
      var v = monoViolations[vi];
      console.log('    stress ' + v.from + '→' + v.to + ': composite ' + v.prevComp + '→' + v.curComp);
    }
  }

  // Directional checks
  var zeroResult = results.find(function(r){ return r.name === 'ZERO_STRESS'; });
  var maxResult = results.find(function(r){ return r.name === 'MAX_STRESS'; });
  var stableResult = results.find(function(r){ return r.name === 'STABLE_LOW'; });
  var severeResult = results.find(function(r){ return r.name === 'SEVERE_SINGLE'; });

  var dirPass = true;
  var dirChecks = [];

  function dirCheck(label, condition) {
    dirChecks.push({ label: label, pass: condition });
    if (!condition) dirPass = false;
  }

  dirCheck('zero stress < severe stress composite', zeroResult.composite < severeResult.composite);
  dirCheck('stable < severe composite', stableResult.composite < severeResult.composite);
  dirCheck('zero stress trajectory is STABLE', zeroResult.trajectory === 'STABLE');
  dirCheck('max stress composite > 1.0', maxResult.composite > 1.0);
  dirCheck('severe p3 > stable p3', severeResult.p3 > stableResult.p3);
  dirCheck('recovery composite < severe composite', results.find(function(r){ return r.name === 'RECOVERY_EASING'; }).composite < severeResult.composite);

  console.log('  Directional checks: ' + (dirPass ? 'ALL PASS' : 'SOME FAIL'));
  for (var ci = 0; ci < dirChecks.length; ci++) {
    console.log('    ' + (dirChecks[ci].pass ? 'PASS' : 'FAIL') + ': ' + dirChecks[ci].label);
  }

  // Range check
  console.log('\n  Composite range across scenarios: ' + Math.min.apply(null, results.map(function(r){return r.composite;})) + ' – ' + Math.max.apply(null, results.map(function(r){return r.composite;})));
  console.log('  Phase distribution: ' + results.map(function(r){ return r.dominantPhase; }).join(', '));
  console.log('  Trajectory distribution: ' + results.map(function(r){ return r.trajectory; }).join(', '));

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

main();
