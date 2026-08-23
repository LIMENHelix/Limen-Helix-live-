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
function unique(values) {
  var seen = {}, out = [];
  values.forEach(function (value) {
    var normalized = String(value || '').trim();
    if (!normalized || seen[normalized.toLowerCase()]) return;
    seen[normalized.toLowerCase()] = true;
    out.push(normalized);
  });
  return out;
}
function extractIdentifiers(value) {
  var blob = JSON.stringify(value || {});
  var dois = unique((blob.match(/\b10\.\d{4,9}\/[\-._;()/:A-Z0-9]+\b/ig) || [])
    .map(function (x) { return x.replace(/[.,;:)]+$/, ''); }));
  var pmids = [];
  function walk(node, key) {
    if (Array.isArray(node)) { node.forEach(function (x) { walk(x, key); }); return; }
    if (!node || typeof node !== 'object') {
      if (typeof node === 'string' && /pmid|pubmed/i.test(String(key || ''))) {
        pmids = pmids.concat(node.match(/\b\d{6,9}\b/g) || []);
      }
      return;
    }
    Object.keys(node).forEach(function (k) { walk(node[k], k); });
  }
  walk(value, '');
  return { dois: unique(dois), pmids: unique(pmids) };
}
function observe(value) {
  var acts = value && Array.isArray(value.activations) ? value.activations : [];
  var labels = [], companies = 0, evidenceGrades = 0, citations = 0;
  acts.forEach(function (a) {
    companies += Array.isArray(a.companies) ? a.companies.length : 0;
    (a.treatments || []).forEach(function (t) {
      if (t && (t.label || t.title)) labels.push(t.label || t.title);
      if (t && t.evidence) evidenceGrades++;
      if (t && (t.cite || (Array.isArray(t.citation) && t.citation.length))) citations++;
    });
  });
  var blob = JSON.stringify(value || {});
  var urls = blob.match(/https?:\/\/[^\s"']+/g) || [];
  var sourceArrays = value && Array.isArray(value.sources) ? value.sources.length : 0;
  var identifiers = extractIdentifiers(value);
  var templates = labels.filter(classifier.isTemplate).length;
  return {
    sourceFile: null,
    sourceUrlCount: urls.length,
    sourceArrayCount: sourceArrays,
    citationCount: citations,
    evidenceGradeCount: evidenceGrades,
    companyCount: companies,
    treatmentCount: labels.length,
    templateRatio: labels.length ? Math.round(templates / labels.length * 1000) / 1000 : 1,
    doiCount: identifiers.dois.length,
    pmidCount: identifiers.pmids.length,
    provenanceState: urls.length || sourceArrays
      ? 'URL_OR_SOURCES_PRESENT_UNVERIFIED'
      : (identifiers.dois.length || identifiers.pmids.length
        ? 'IDENTIFIER_PRESENT_UNRESOLVED'
        : 'NO_VERIFIABLE_PROVENANCE')
  };
}
function classify(root, files, cap) {
  var byDepth = {}, totals = {}, candidates = [], real = [], context = [], observations = {};
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
      observations[id] = observe(value);
      observations[id].sourceFile = file;
      if (result.classification === 'REAL') real.push(id);
      if (result.classification === 'MIXED_CONTEXT_ONLY') context.push({ portalId: id, depth: Number(d), classification: result.classification, reasons: result.reasons });
      if (['NEEDS_AUTHORING', 'DANGEROUS', 'SYNTHETIC'].indexOf(result.classification) >= 0 && candidates.length < 200) {
        candidates.push({ portalId: id, depth: Number(d), classification: result.classification, action: result.classification === 'NEEDS_AUTHORING' ? 'author-missing-fields' : 'replace-fake-authority-with-sourced-content', reason: result.reasons[0] });
      }
    });
  });
  return { sampledTotal: sampledTotal, byDepth: byDepth, classificationTotals: totals, real: real, context: context, candidates: candidates, observations: observations };
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
      observed: q.observations[c.portalId],
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
      observed: q.observations[portalId],
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
      observed: q.observations[c.portalId],
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

module.exports = { build: build, domainFiles: domainFiles, classify: classify, observe: observe, extractIdentifiers: extractIdentifiers };
