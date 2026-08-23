'use strict';

/* Shared structural pipeline for domain portal classification and authoring
 * admission. It deliberately has no Energy-specific diagnosis map or source
 * hints. The caller supplies a domain and its own checked-in portal surface.
 */
var fs = require('fs');
var path = require('path');
var classifier = require('../scripts/_taxonomy-pilot/_portal-real-content-classifier.cjs');

var DEFAULT_CAP = 120;
function depth(id) { return id.split('_').length - 1; }
function idOf(file) { return file.replace(/\.json$/, ''); }
function domainFiles(root, domain) {
  var prefix = domain === 'agriculture' ? 'p2_agri' : domain;
  return fs.readdirSync(root).filter(function (name) {
    return name.indexOf(prefix) === 0 && name.endsWith('.json');
  }).sort();
}
function sample(files, cap) {
  if (files.length <= cap) return files.slice();
  var step = Math.max(1, Math.floor(files.length / cap));
  var out = [];
  for (var i = 0; i < files.length && out.length < cap; i += step) out.push(files[i]);
  return out;
}
function classify(root, files, cap) {
  var byDepth = {}, totals = {}, candidates = [], real = [], context = [];
  var sampledTotal = 0;
  var grouped = {};
  files.forEach(function (f) { var d = depth(idOf(f)); (grouped[d] = grouped[d] || []).push(f); });
  Object.keys(grouped).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (d) {
    var chosen = Number(d) <= 1 ? grouped[d] : sample(grouped[d], cap);
    byDepth[d] = {};
    chosen.forEach(function (file) {
      var value;
      try { value = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
      catch (err) { value = null; }
      var result = classifier.classifyPortalV2(value);
      byDepth[d][result.classification] = (byDepth[d][result.classification] || 0) + 1;
      totals[result.classification] = (totals[result.classification] || 0) + 1;
      sampledTotal++;
      var id = idOf(file);
      if (result.classification === 'REAL') real.push(id);
      if (result.classification === 'MIXED_CONTEXT_ONLY') context.push({ portalId: id, depth: Number(d), classification: result.classification, reasons: result.reasons });
      if (['NEEDS_AUTHORING', 'DANGEROUS', 'SYNTHETIC'].indexOf(result.classification) >= 0 && candidates.length < 200) {
        candidates.push({ portalId: id, depth: Number(d), classification: result.classification, action: result.classification === 'NEEDS_AUTHORING' ? 'author-missing-fields' : 'replace-fake-authority-with-sourced-content', reason: result.reasons[0] });
      }
    });
  });
  return { sampledTotal: sampledTotal, byDepth: byDepth, classificationTotals: totals, real: real, context: context, candidates: candidates };
}
function build(domain, root, cap) {
  var files = domainFiles(root, domain);
  var q = classify(root, files, cap || DEFAULT_CAP);
  var queue = q.candidates.map(function (c) {
    var dangerous = c.classification === 'DANGEROUS' || c.classification === 'SYNTHETIC';
    return {
      target: c.portalId,
      diagnosis: null,
      level: 'portal',
      depth: c.depth,
      authoringType: c.classification === 'NEEDS_AUTHORING' ? 'treatment needs authoring' : 'treatment needs replacement',
      missingFields: ['real treatments', 'verifiable provenance'],
      existingContext: c.reason,
      unusableTemplateContent: dangerous ? c.reason : null,
      sourceHints: null,
      requiredHumanAction: dangerous
        ? 'Replace templated or authority-masquerading content with sourced material, or demote the portal to context-only'
        : 'Author the missing fields from a primary source and retain observation-level provenance',
      priority: dangerous ? 2 : 1,
      whyItMatters: 'portal content is not evidence until its own provenance and non-template content are reviewed',
      provenance: { classifier: 'classifyPortalV2', sourceRoot: root, sampled: true }
    };
  });
  q.real.forEach(function (portalId) {
    queue.push({
      target: portalId, diagnosis: null, level: 'portal', depth: depth(portalId),
      authoringType: 'provenance review needed',
      missingFields: ['independent provenance review', 'domain relevance review'],
      existingContext: 'classifier candidate: URL/company/non-template shape; not an evidence admission',
      unusableTemplateContent: null, sourceHints: null,
      requiredHumanAction: 'Review source ownership, provenance, domain relevance, and syndication before any evidence admission',
      priority: 1, whyItMatters: 'classifier output is a candidate only; no portal may self-authorise as evidence',
      provenance: { classifier: 'classifyPortalV2', sourceRoot: root, sampled: true }
    });
  });
  q.context.forEach(function (c) {
    queue.push({
      target: c.portalId, diagnosis: null, level: 'portal', depth: c.depth,
      authoringType: 'domain relevance verification needed',
      missingFields: ['verified domain relevance'], existingContext: c.reasons.join('; '),
      unusableTemplateContent: null, sourceHints: null,
      requiredHumanAction: 'Verify the domain relevance from a primary source before treating the company-bearing portal as more than context',
      priority: 3, whyItMatters: 'company labels do not establish domain relevance or evidence independence',
      provenance: { classifier: 'classifyPortalV2', sourceRoot: root, sampled: true }
    });
  });
  queue.sort(function (a, b) { return a.priority - b.priority || a.target.localeCompare(b.target); });
  var byType = {}, byDiagnosis = {};
  queue.forEach(function (x) { byType[x.authoringType] = (byType[x.authoringType] || 0) + 1; });
  return {
    quality: {
      generatedAt: new Date().toISOString(), classifier: 'classifyPortalV2 (canonical)', domain: domain,
      sourceRoot: root, sampledTotal: q.sampledTotal, sampleNote: 'L0/L1 full; L2+ capped per depth; checked-in domain surface only',
      byDepth: q.byDepth, classificationTotals: q.classificationTotals, realPortalsFound: q.real, realPortalCount: q.real.length,
      perDiagnosis: {}, authoringCandidates: q.candidates,
      rules: 'company names alone != real; evidence/cite without verifiable provenance = DANGEROUS; only REAL with provenance is evidence-eligible',
      admission: 'NONE — classification only; authoring admission remains separate'
    },
    cortex: {
      generatedAt: new Date().toISOString(), builtFrom: [domain + ' checked-in domain surface', 'classifyPortalV2 (canonical)'],
      rule: 'Portal tree is navigation/context/authoring substrate only. No unreviewed portal is admitted as evidence.',
      evidenceEligible: { portals: [], externalBundles: [], portalNote: 'empty by design; classifier REAL results remain provenance-review candidates' },
      reviewCandidates: q.real,
      contextOnly: q.context, blockedDangerous: { policy: 'DANGEROUS/SYNTHETIC blocked from evidence and bundle build by default', sampled: q.classificationTotals },
      needsRehydration: q.candidates, perDiagnosis: {}, consumedByRuntime: false,
      admission: 'NONE applied — descriptive index only'
    },
    queue: {
      generatedAt: new Date().toISOString(), builtFrom: [domain + '-portal-quality-index.json', domain + '-certified-cortex-index.json'],
      note: 'Records measured domain-specific authoring gaps. No candidate content or evidence is fabricated.', totalTasks: queue.length,
      byType: byType, byDiagnosis: byDiagnosis, priorityLegend: { 1: 'thin portal requiring source authoring', 2: 'synthetic or authority-masquerading content requiring replacement', 3: 'domain relevance verification' }, tasks: queue
    }
  };
}

module.exports = { build: build, domainFiles: domainFiles, classify: classify };
