#!/usr/bin/env node
/**
 * build-deep-directives.js — Hybrid Deep Intelligence Payload Generator
 *
 * Produces TWO outputs per domain:
 *   1. Ranked pool (top 500) — full deep content for instant operator render
 *   2. Branch index (all omitted) — metadata only for drill-deeper research
 *
 * Usage: node scripts/build-deep-directives.js
 */
const fs = require('fs');
const path = require('path');

const DOMAINS_DIR = path.join(__dirname, '..', 'assets', 'data', 'domains');
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'data', 'deep');
const POOL_SIZE = 500;

const DOMAIN_ROOTS = {
  energy: 'energy', trade: 'trade', p2_agri: 'p2_agri', infrastructure: 'infrastructure', finance: 'finance', economy: 'economy', medicine: 'medicine', law: 'law', science: 'science', education: 'education', technology: 'technology', communication: 'communication', defense: 'defense', governance: 'governance', environment: 'environment', industry: 'industry', intelligence: 'intelligence', culture: 'culture', population: 'population', religion: 'religion'
};

// --domain=<name> flag — limits build to a single domain (domain-local build).
// If omitted, all configured domains are built.
var TARGET_DOMAIN = null;
for (var argI = 2; argI < process.argv.length; argI++) {
  var m = /^--domain=(.+)$/.exec(process.argv[argI]);
  if (m) TARGET_DOMAIN = m[1];
}

function loadJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { return null; } }
function portalFileToId(fn) { return fn ? fn.replace(/_portal\.html$/, '').replace(/\.html$/, '') : null; }
function hasDeep(t) { return !!(t.monitoring || t.escalation || t.citation || t.cite); }

function scoreDirective(d) {
  var r = 0;
  r += (d._monitoring ? 2 : 0);
  r += (d._escalation ? 2 : 0);
  r += (d._hasCitation ? 2 : 0);
  r += (d._hasCite ? 1 : 0);
  r += (d._hasSteps ? 1 : 0);
  // Depth bonus: deeper = richer fractal content
  r += Math.min(2, d.depth * 0.4);
  // Evidence bonus
  if (d.treatmentEvidence === 'A' || d.treatmentEvidence === 'Strong') r += 1.5;
  else if (d.treatmentEvidence === 'B' || d.treatmentEvidence === 'Moderate') r += 0.8;
  // Company binding bonus
  if (d.companies && d.companies.length > 0) r += 0.5;
  // Lineage uniqueness: longer ancestry = more specific branch
  r += Math.min(1, (d.ancestryPath || []).length * 0.2);
  return Math.round(r * 100) / 100;
}

function buildDomain(domainId) {
  var rootPath = path.join(DOMAINS_DIR, domainId + '.json');
  var root = loadJSON(rootPath);
  if (!root) { console.error('  FATAL: Root not found: ' + rootPath); process.exit(1); }

  // Phase 1: Full traversal — collect ALL deep candidates
  var allCandidates = [];
  var dedup = {};
  var visited = {};
  var filesTraversed = 0, maxDepth = 0, totalDirectives = 0;

  function traverse(portalId, depth, ancestry, parentPortalId) {
    if (visited[portalId]) return;
    visited[portalId] = true;
    var fp = path.join(DOMAINS_DIR, portalId + '.json');
    var data = loadJSON(fp);
    if (!data) return;
    filesTraversed++;
    if (depth > maxDepth) maxDepth = depth;

    for (var ai = 0; ai < (data.activations || []).length; ai++) {
      var act = data.activations[ai];
      var nodeId = act.brainNodeId || '';
      var companies = (act.companies || []).map(function (c) {
        return { name: c.name || '', ticker: c.ticker_or_id || '', bindingStrength: c.binding_strength || 0 };
      });

      // Best deep treatment per node per portal
      var bestT = null, bestR = -1;
      for (var ti = 0; ti < (act.treatments || []).length; ti++) {
        var t = act.treatments[ti]; totalDirectives++;
        if (!hasDeep(t)) continue;
        var r = (t.monitoring ? 2 : 0) + (t.escalation ? 2 : 0) + (t.citation ? 2 : 0) + (t.cite ? 1 : 0);
        if (r > bestR) { bestR = r; bestT = t; }
      }

      if (bestT) {
        var dk = portalId + '||' + nodeId;
        if (!dedup[dk]) {
          dedup[dk] = true;
          allCandidates.push({
            id: 'dir_' + portalId + '_' + nodeId,
            nodeId: nodeId, nodeLabel: act.domainLabel || '', nodeFunction: act.functional_role || '', nodeGroup: act.group || '',
            treatmentLabel: bestT.label || '', treatmentType: bestT.type || '',
            treatmentDescription: (bestT.description || '').substring(0, 300),
            treatmentEvidence: bestT.evidence || '', treatmentSteps: bestT.steps || [],
            treatmentTarget: bestT.target || '', treatmentCite: bestT.cite || '',
            treatmentCitation: bestT.citation || [],
            treatmentMonitoring: typeof bestT.monitoring === 'string' ? bestT.monitoring.substring(0, 500) : (bestT.monitoring || ''),
            treatmentEscalation: typeof bestT.escalation === 'string' ? bestT.escalation.substring(0, 500) : (bestT.escalation || ''),
            companies: companies, diagnosticTriggers: act.diagnosticTriggers || [],
            depth: depth, portalDomainId: portalId, portalTitle: data.title || '',
            ancestryPath: ancestry.concat([portalId]), branchRelevance: 0,
            _parentPortal: parentPortalId || 'ROOT',
            _monitoring: !!bestT.monitoring, _escalation: !!bestT.escalation,
            _hasCitation: !!(bestT.citation && bestT.citation.length), _hasCite: !!bestT.cite,
            _hasSteps: !!(bestT.steps && bestT.steps.length)
          });
        }
      }

      var cp = act.childPortal;
      if (cp) { var cid = portalFileToId(cp); if (cid) traverse(cid, depth + 1, ancestry.concat([portalId]), portalId); }
    }
  }

  traverse(domainId, 0, [], null);

  // Phase 2: Score all candidates
  for (var i = 0; i < allCandidates.length; i++) {
    allCandidates[i]._rankScore = scoreDirective(allCandidates[i]);
  }

  // Phase 3: Stratified depth-diverse pool selection
  // Guarantee minimum per depth band, fill remaining by score
  var depthBuckets = {};
  for (var bi = 0; bi < allCandidates.length; bi++) {
    var bd = allCandidates[bi].depth;
    if (!depthBuckets[bd]) depthBuckets[bd] = [];
    depthBuckets[bd].push(allCandidates[bi]);
  }
  // Sort each bucket by score
  for (var dk in depthBuckets) depthBuckets[dk].sort(function (a, b) { return b._rankScore - a._rankScore; });

  // Depth allocation: L1=50, L2=100, L3=150, L4=100, L5=100 = 500
  var depthAlloc = { 1: 50, 2: 100, 3: 150, 4: 100, 5: 100 };
  var pool = [];
  var poolSet = {};
  // First pass: guaranteed depth slots
  for (var da in depthAlloc) {
    var bucket = depthBuckets[da] || [];
    var take = Math.min(depthAlloc[da], bucket.length);
    for (var ti = 0; ti < take; ti++) {
      pool.push(bucket[ti]);
      poolSet[bucket[ti].id] = true;
    }
  }
  // Second pass: fill remaining slots by global score (any depth)
  allCandidates.sort(function (a, b) { return b._rankScore - a._rankScore; });
  for (var fi = 0; fi < allCandidates.length && pool.length < POOL_SIZE; fi++) {
    if (!poolSet[allCandidates[fi].id]) {
      pool.push(allCandidates[fi]);
      poolSet[allCandidates[fi].id] = true;
    }
  }

  var omitted = [];
  for (var oi2 = 0; oi2 < allCandidates.length; oi2++) {
    if (!poolSet[allCandidates[oi2].id]) omitted.push(allCandidates[oi2]);
  }

  // Count omitted siblings for each pool directive
  var omittedByNodeAncestor = {};
  for (var oi = 0; oi < omitted.length; oi++) {
    var o = omitted[oi];
    var famKey = (o.ancestryPath && o.ancestryPath.length >= 2 ? o.ancestryPath[1] : o._parentPortal) + '||' + o.nodeId;
    if (!omittedByNodeAncestor[famKey]) omittedByNodeAncestor[famKey] = 0;
    omittedByNodeAncestor[famKey]++;
  }
  for (var pi = 0; pi < pool.length; pi++) {
    var p = pool[pi];
    var pFamKey = (p.ancestryPath && p.ancestryPath.length >= 2 ? p.ancestryPath[1] : p._parentPortal) + '||' + p.nodeId;
    p._omittedSiblingCount = omittedByNodeAncestor[pFamKey] || 0;
  }

  // Strip internal fields from pool
  for (var si = 0; si < pool.length; si++) {
    delete pool[si]._parentPortal; delete pool[si]._monitoring; delete pool[si]._escalation;
    delete pool[si]._hasCitation; delete pool[si]._hasCite; delete pool[si]._hasSteps;
  }

  // Phase 4: Build branch index from omitted candidates (metadata only)
  var branchIndex = [];
  for (var bi = 0; bi < omitted.length; bi++) {
    var b = omitted[bi];
    branchIndex.push({
      portalDomainId: b.portalDomainId, nodeId: b.nodeId, depth: b.depth,
      ancestryPath: b.ancestryPath, parentBranch: b._parentPortal,
      treatmentLabel: (b.treatmentLabel || '').substring(0, 80),
      richness: b._rankScore, hasMonitoring: b._monitoring, hasCitations: b._hasCitation,
      hasEscalation: b._escalation, treatmentType: b.treatmentType
    });
  }

  // Depth distribution
  var poolDepth = {}, indexDepth = {};
  for (var pd = 0; pd < pool.length; pd++) { var d = pool[pd].depth; poolDepth[d] = (poolDepth[d] || 0) + 1; }
  for (var id = 0; id < branchIndex.length; id++) { var d2 = branchIndex[id].depth; indexDepth[d2] = (indexDepth[d2] || 0) + 1; }

  return {
    domainId: domainId, filesTraversed: filesTraversed, maxDepth: maxDepth,
    totalDirectives: totalDirectives, totalCandidates: allCandidates.length,
    pool: pool, poolDepth: poolDepth,
    branchIndex: branchIndex, indexDepth: indexDepth
  };
}

// ── MAIN ──
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
console.log('=== Building Hybrid Deep Intelligence Payloads ===\n');
var allPassed = true;

for (var entry of Object.entries(DOMAIN_ROOTS)) {
  var label = entry[0], rootId = entry[1];
  if (TARGET_DOMAIN && label !== TARGET_DOMAIN) continue;
  console.log('--- ' + label + ' ---');
  var result = buildDomain(rootId);

  if (result.pool.length === 0) { console.error('  FAIL: empty pool'); allPassed = false; continue; }

  // Write ranked pool
  var poolPath = path.join(OUTPUT_DIR, rootId + '-deep-directives.json');
  var poolData = JSON.stringify({
    domainId: result.domainId, generatedAt: Date.now(),
    traversal: { filesTraversed: result.filesTraversed, maxDepth: result.maxDepth, totalDirectives: result.totalDirectives, totalCandidates: result.totalCandidates, retained: result.pool.length },
    depthDistribution: result.poolDepth, directives: result.pool
  });
  fs.writeFileSync(poolPath, poolData);
  var poolKB = Math.round(fs.statSync(poolPath).size / 1024);

  // Write branch index
  var indexPath = path.join(OUTPUT_DIR, rootId + '-branch-index.json');
  var fd = fs.openSync(indexPath, 'w');
  fs.writeSync(fd, '{"domainId":"' + result.domainId + '","generatedAt":' + Date.now() + ',"count":' + result.branchIndex.length + ',"depthDistribution":' + JSON.stringify(result.indexDepth) + ',"branches":[');
  for (var wi = 0; wi < result.branchIndex.length; wi++) {
    if (wi > 0) fs.writeSync(fd, ',');
    fs.writeSync(fd, JSON.stringify(result.branchIndex[wi]));
  }
  fs.writeSync(fd, ']}');
  fs.closeSync(fd);
  var indexKB = Math.round(fs.statSync(indexPath).size / 1024);

  console.log('  Files traversed: ' + result.filesTraversed);
  console.log('  Candidates: ' + result.totalCandidates);
  console.log('  Ranked pool: ' + result.pool.length + ' (' + poolKB + ' KB) depth=' + JSON.stringify(result.poolDepth));
  console.log('  Branch index: ' + result.branchIndex.length + ' (' + indexKB + ' KB) depth=' + JSON.stringify(result.indexDepth));
  console.log('');
}

if (allPassed) console.log('=== ALL DOMAINS PASSED ===');
else { console.error('=== SOME DOMAINS FAILED ==='); process.exit(1); }
