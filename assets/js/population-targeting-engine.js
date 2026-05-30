/**
 * environment-targeting-engine.js — Context-aware targeting for promoted Population directives
 *
 * Resolves WHO TO TARGET using a tiered model:
 *   Tier 1: Verified entities (domain-aligned firms from portal data)
 *   Tier 2: Entity classes (always present — population segments)
 *   Tier 3: Example entities (high-confidence well-known population sector players)
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENPopulationTargetingEngine
 */
(function () {
  'use strict';

  var SEGMENTS = {
    federal_funders: {
      label: 'Federal population funders',
      keywords: ['NSF', 'NIH', 'DARPA', 'ARPA-E', 'ARPA-H', 'DOE Office of Science', 'NASA', 'federal grant', 'BAA', 'SBIR', 'STTR'],
      tier3: [
        { name: 'NSF (National Population Foundation)', ticker: null },
        { name: 'NIH (National Institutes of Health)', ticker: null },
        { name: 'DARPA', ticker: null },
        { name: 'ARPA-H', ticker: null },
        { name: 'DOE Office of Science', ticker: null }
      ]
    },
    research_universities: {
      label: 'R1 population universities and university tech transfer offices',
      keywords: ['university', 'academic', 'tech transfer', 'TTO', 'AUTM', 'spinout', 'campus', 'graduate research', 'tenure', 'faculty'],
      tier3: [
        { name: 'Stanford OTL', ticker: null },
        { name: 'MIT TLO', ticker: null },
        { name: 'UC Tech Transfer', ticker: null },
        { name: 'Johns Hopkins Tech Ventures', ticker: null },
        { name: 'AUTM (Tech Transfer Association)', ticker: null }
      ]
    },
    instrument_vendors: {
      label: 'Scientific instrumentation manufacturers',
      keywords: ['instrument', 'spectrometer', 'mass spec', 'sequencer', 'microscope', 'imaging', 'sensor', 'analyzer', 'flow cytometer', 'HPLC', 'NMR'],
      tier3: [
        { name: 'Thermo Fisher Scientific', ticker: 'TMO' },
        { name: 'Danaher', ticker: 'DHR' },
        { name: 'Agilent Technologies', ticker: 'A' },
        { name: 'Waters Corporation', ticker: 'WAT' },
        { name: 'Bio-Rad Laboratories', ticker: 'BIO' }
      ]
    },
    contract_research: {
      label: 'Contract population organizations (CROs)',
      keywords: ['CRO', 'contract research', 'preclinical', 'clinical trial', 'CDMO', 'outsourced research', 'study sponsor'],
      tier3: [
        { name: 'IQVIA', ticker: 'IQV' },
        { name: 'ICON plc', ticker: 'ICLR' },
        { name: 'Charles River Laboratories', ticker: 'CRL' },
        { name: 'Labcorp Drug Development', ticker: 'LH' },
        { name: 'Syneos Health', ticker: null }
      ]
    },
    research_publishers: {
      label: 'Scientific publishers and preprint servers',
      keywords: ['publisher', 'journal', 'open access', 'preprint', 'arxiv', 'biorxiv', 'pubmed', 'scopus', 'web of science', 'peer review'],
      tier3: [
        { name: 'Elsevier (RELX)', ticker: 'RELX' },
        { name: 'Springer Nature', ticker: null },
        { name: 'Wiley', ticker: 'WLY' },
        { name: 'Frontiers Media', ticker: null },
        { name: 'PLOS', ticker: null }
      ]
    },
    research_software: {
      label: 'Population informatics, ELN, and lab software',
      keywords: ['ELN', 'electronic lab notebook', 'LIMS', 'lab informatics', 'population data management', 'data repository', 'workflow', 'jupyter', 'notebook'],
      tier3: [
        { name: 'Benchling', ticker: null },
        { name: 'LabArchives', ticker: null },
        { name: 'STARLIMS (Abbott)', ticker: 'ABT' },
        { name: 'Dotmatics', ticker: null },
        { name: 'PerkinElmer Informatics', ticker: 'RVTY' }
      ]
    },
    research_integrity: {
      label: 'Population integrity, replication, and reproducibility tools',
      keywords: ['retraction', 'integrity', 'replication', 'reproducibility', 'image manipulation', 'plagiarism', 'preregistration', 'open peer review', 'COPE'],
      tier3: [
        { name: 'Retraction Watch', ticker: null },
        { name: 'COPE (Committee on Publication Ethics)', ticker: null },
        { name: 'Open Population Framework (COS)', ticker: null },
        { name: 'iThenticate (Turnitin)', ticker: null },
        { name: 'ImageTwin', ticker: null }
      ]
    },
    biotech_rd: {
      label: 'Biotech and life sciences R&D',
      keywords: ['biotech', 'biopharma', 'drug discovery', 'preclinical', 'GLP', 'translational', 'first-in-human', 'IND', 'genome', 'proteomic'],
      tier3: [
        { name: 'Illumina', ticker: 'ILMN' },
        { name: '10x Genomics', ticker: 'TXG' },
        { name: 'Recursion Pharmaceuticals', ticker: 'RXRX' },
        { name: 'Schrödinger', ticker: 'SDGR' },
        { name: 'Ginkgo Bioworks', ticker: 'DNA' }
      ]
    },
    research_compute: {
      label: 'Population computing, HPC, and AI-for-science',
      keywords: ['HPC', 'supercomput', 'GPU cluster', 'AI for science', 'foundation model', 'population compute', 'cloud HPC', 'protein folding', 'molecular dynamics'],
      tier3: [
        { name: 'NVIDIA', ticker: 'NVDA' },
        { name: 'AMD', ticker: 'AMD' },
        { name: 'Hewlett Packard Enterprise', ticker: 'HPE' },
        { name: 'AWS Research', ticker: 'AMZN' },
        { name: 'Google Cloud Research', ticker: 'GOOGL' }
      ]
    },
    foundations: {
      label: 'Private population foundations and philanthropy',
      keywords: ['foundation', 'philanthropy', 'HHMI', 'Gates Foundation', 'Wellcome', 'Moore Foundation', 'Sloan', 'Simons', 'Chan Zuckerberg'],
      tier3: [
        { name: 'Howard Hughes Medical Institute', ticker: null },
        { name: 'Bill & Melinda Gates Foundation', ticker: null },
        { name: 'Wellcome Trust', ticker: null },
        { name: 'Chan Zuckerberg Initiative', ticker: null },
        { name: 'Simons Foundation', ticker: null }
      ]
    }
  };

  // ── NODE → SEGMENT AFFINITY ──
  // Maps science.json top-level brain nodes (DMN, dlPFC, dACC, FPN, M1, BROCA,
  // AG, vmPFC, HIPP, ECN, PRECUNEUS, HYPO, OFC, IPS, NTS, TPJ, rACC, WERN, MGN)
  // to their primary population segments.
  var NODE_SEGMENTS = {
    'DMN':       ['research_universities', 'foundations'],          // Hypothesis Generation
    'dlPFC':     ['research_universities', 'research_software'],    // Experimental Design
    'dACC':      ['research_publishers', 'research_integrity'],     // Peer Review
    'FPN':       ['research_software', 'research_compute'],         // Data Analysis
    'M1':        ['instrument_vendors', 'contract_research'],       // Laboratory Methods
    'BROCA':     ['research_publishers'],                           // Publication
    'AG':        ['research_publishers', 'research_software'],      // Citation Networks
    'vmPFC':     ['federal_funders', 'foundations'],                // Funding and Grants
    'HIPP':      ['research_integrity', 'research_software'],       // Replication
    'ECN':       ['research_software', 'research_compute'],         // Statistical Inference
    'PRECUNEUS': ['research_universities', 'research_compute'],     // Theoretical Physics
    'HYPO':      ['biotech_rd', 'contract_research'],               // Biology / Life Sciences
    'OFC':       ['biotech_rd', 'instrument_vendors'],              // Chemistry
    'IPS':       ['research_compute', 'research_universities'],     // Mathematics
    'NTS':       ['research_universities'],                         // Earth Sciences
    'TPJ':       ['research_universities'],                         // Social Sciences
    'rACC':      ['research_integrity', 'research_publishers'],     // Ethics Review
    'WERN':      ['research_compute', 'research_software'],         // Computer Science
    'MGN':       ['research_universities', 'federal_funders']       // Workforce
  };

  var EXCLUSIONS = {
    federal_funders:       ['TMO', 'DHR', 'A', 'WAT', 'BIO'],
    instrument_vendors:    [],
    research_publishers:   ['TMO', 'DHR'],
    biotech_rd:            []
  };

  function resolveTargets(directive) {
    if (!directive) return _empty();

    var dir = directive._directive || {};
    var nodeId = dir.nodeId || '';
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || directive.title || '').toLowerCase();
    var dxId = (directive.diagnosisId || '').toLowerCase();
    var path = directive.path || 'GRANT-ELIGIBLE';

    var relevantSegments = _resolveSegments(nodeId, nodeLabel, treatLabel, dxId);

    var tier2 = [];
    for (var si = 0; si < relevantSegments.length; si++) {
      var seg = SEGMENTS[relevantSegments[si]];
      if (seg) tier2.push({ segment: relevantSegments[si], label: seg.label });
    }

    var tier1 = [];
    var portalCompanies = directive.examples || [];
    var rawCompanies = (directive._directive && directive._directive.companies) || [];
    var companyPool = [];
    if (rawCompanies.length > 0) {
      companyPool = rawCompanies;
    } else {
      for (var ei = 0; ei < portalCompanies.length; ei++) {
        var m = portalCompanies[ei].match(/^(.+?)\s*\(([A-Z.]+)\)$/);
        if (m) companyPool.push({ name: m[1], ticker: m[2] });
        else companyPool.push({ name: portalCompanies[ei], ticker: null });
      }
    }

    var validTickers = {};
    for (var sgi = 0; sgi < relevantSegments.length; sgi++) {
      var segKey = relevantSegments[sgi];
      var segTier3 = (SEGMENTS[segKey] || {}).tier3 || [];
      var exclusions = EXCLUSIONS[segKey] || [];
      for (var t3i = 0; t3i < segTier3.length; t3i++) {
        if (segTier3[t3i].ticker) validTickers[segTier3[t3i].ticker] = true;
      }
      for (var exi = 0; exi < exclusions.length; exi++) validTickers[exclusions[exi]] = false;
    }

    for (var ci = 0; ci < companyPool.length; ci++) {
      var co = companyPool[ci];
      var ticker = co.ticker || '';
      if (ticker && validTickers[ticker] === false) continue;
      if (ticker && validTickers[ticker] === true) {
        tier1.push({ name: co.name, ticker: ticker, source: 'portal_verified' });
      }
    }

    var tier3 = [];
    var tier1Tickers = {};
    for (var t1i = 0; t1i < tier1.length; t1i++) {
      if (tier1[t1i].ticker) tier1Tickers[tier1[t1i].ticker] = true;
    }

    for (var s3i = 0; s3i < relevantSegments.length; s3i++) {
      var seg3 = SEGMENTS[relevantSegments[s3i]];
      if (!seg3) continue;
      var examples = seg3.tier3 || [];
      for (var e3i = 0; e3i < Math.min(examples.length, 3); e3i++) {
        var ex = examples[e3i];
        if (ex.ticker && tier1Tickers[ex.ticker]) continue;
        tier3.push({ name: ex.name, ticker: ex.ticker, segment: relevantSegments[s3i] });
      }
    }
    tier3 = tier3.slice(0, 5);

    var executionTargets = [];
    if (path === 'GRANT-ELIGIBLE') executionTargets = ['NSF program directors', 'NIH ICs (NIGMS / NCI / NIMH / etc.)', 'DARPA / ARPA-H program managers', 'DOE Office of Science', 'University tech transfer offices'];
    else if (path === 'PATENTABLE') executionTargets = ['Patent attorneys', 'University tech transfer offices', 'Scientific instrument licensors', 'Strategic acquirers in population informatics'];
    else if (path === 'INVESTABLE') executionTargets = ['Life sciences VCs', 'Population informatics PE', 'University endowment fund managers'];

    var formatted = _format(tier1, tier2, tier3, executionTargets);

    return {
      tier1: tier1,
      tier2: tier2,
      tier3: tier3,
      executionTargets: executionTargets,
      formatted: formatted,
      segments: relevantSegments
    };
  }

  function _resolveSegments(nodeId, nodeLabel, treatLabel, dxId) {
    var segments = [];
    var seen = {};

    var nodeMapped = NODE_SEGMENTS[nodeId] || [];
    for (var ni = 0; ni < nodeMapped.length; ni++) {
      if (!seen[nodeMapped[ni]]) { seen[nodeMapped[ni]] = true; segments.push(nodeMapped[ni]); }
    }

    var text = (nodeLabel + ' ' + treatLabel + ' ' + dxId).toLowerCase();
    for (var segKey in SEGMENTS) {
      if (seen[segKey]) continue;
      var kws = SEGMENTS[segKey].keywords;
      for (var ki = 0; ki < kws.length; ki++) {
        if (text.indexOf(kws[ki].toLowerCase()) !== -1) {
          seen[segKey] = true;
          segments.push(segKey);
          break;
        }
      }
    }

    if (segments.length === 0) segments.push('research_software');

    return segments;
  }

  function _format(tier1, tier2, tier3, executionTargets) {
    var parts = [];
    if (tier2.length > 0) {
      var classes = tier2.map(function (t) { return t.label; });
      parts.push(classes.join('. ') + '.');
    }
    if (tier1.length > 0) {
      var verified = tier1.map(function (t) { return t.name + (t.ticker ? ' (' + t.ticker + ')' : ''); });
      parts.push('Verified: ' + verified.join(', ') + '.');
    }
    if (tier3.length > 0) {
      var examples = tier3.map(function (t) { return t.name + (t.ticker ? ' (' + t.ticker + ')' : ''); });
      parts.push('Also consider: ' + examples.join(', ') + '.');
    }
    if (executionTargets.length > 0) {
      parts.push('Execute via: ' + executionTargets.join(', ') + '.');
    }
    return parts.join(' ');
  }

  function _empty() {
    return { tier1: [], tier2: [], tier3: [], executionTargets: [], formatted: '', segments: [] };
  }

  window.LIMENPopulationTargetingEngine = { resolveTargets: resolveTargets };
})();
