/**
 * education-targeting-engine.js — Context-aware targeting for promoted Education directives
 * Exposes: window.LIMENEducationTargetingEngine
 */
(function () {
  'use strict';

  var SEGMENTS = {
    federal_ed_funders: {
      label: 'Federal education funders and agencies',
      keywords: ['US ED', 'Department of Education', 'IES', 'NSF EHR', 'OSEP', 'OESE', 'OPE', 'federal grant', 'Title I', 'Title IX', 'IDEA', 'ESSER'],
      tier3: [
        { name: 'US Department of Education', ticker: null },
        { name: 'IES (Institute of Education Sciences)', ticker: null },
        { name: 'NSF EHR (Education & Human Resources)', ticker: null },
        { name: 'OSEP (Special Education Programs)', ticker: null },
        { name: 'OESE (Elementary & Secondary Ed)', ticker: null }
      ]
    },
    k12_districts: {
      label: 'K-12 school districts and state ed agencies',
      keywords: ['district', 'school board', 'superintendent', 'state education', 'SEA', 'LEA', 'K-12', 'public school', 'charter network'],
      tier3: [
        { name: 'NYC DOE', ticker: null },
        { name: 'LAUSD', ticker: null },
        { name: 'Chicago Public Schools', ticker: null },
        { name: 'Houston ISD', ticker: null },
        { name: 'KIPP Schools', ticker: null }
      ]
    },
    higher_ed: {
      label: 'Higher education institutions and university systems',
      keywords: ['university', 'college', 'higher education', 'provost', 'enrollment', 'admissions', 'tuition', 'endowment', 'community college', 'public university', 'private university'],
      tier3: [
        { name: 'University of California system', ticker: null },
        { name: 'SUNY system', ticker: null },
        { name: 'University of Texas system', ticker: null },
        { name: 'Arizona State University', ticker: null },
        { name: 'Western Governors University', ticker: null }
      ]
    },
    edtech_lms: {
      label: 'EdTech: LMS, classroom tools, content platforms',
      keywords: ['LMS', 'learning management', 'Canvas', 'Blackboard', 'Schoology', 'Google Classroom', 'edtech', 'classroom tool', 'content platform', 'BYOD'],
      tier3: [
        { name: 'Instructure (Canvas)', ticker: 'INST' },
        { name: 'PowerSchool', ticker: 'PWSC' },
        { name: 'Coursera', ticker: 'COUR' },
        { name: '2U Inc', ticker: 'TWOU' },
        { name: 'Chegg', ticker: 'CHGG' }
      ]
    },
    assessment: {
      label: 'Educational assessment and testing',
      keywords: ['assessment', 'test', 'NWEA', 'MAP', 'iReady', 'College Board', 'ACT', 'SAT', 'NAEP', 'standardized'],
      tier3: [
        { name: 'NWEA (Northwest Evaluation Association)', ticker: null },
        { name: 'Curriculum Associates (iReady)', ticker: null },
        { name: 'College Board (SAT, AP)', ticker: null },
        { name: 'ACT Inc', ticker: null },
        { name: 'Pearson VUE', ticker: 'PSO' }
      ]
    },
    edtech_content: {
      label: 'Educational content publishers and curriculum providers',
      keywords: ['curriculum', 'publisher', 'textbook', 'McGraw-Hill', 'Pearson', 'Houghton Mifflin', 'Savvas', 'content', 'instructional materials'],
      tier3: [
        { name: 'McGraw-Hill Education', ticker: null },
        { name: 'Pearson plc', ticker: 'PSO' },
        { name: 'Houghton Mifflin Harcourt', ticker: 'HMHC' },
        { name: 'Scholastic', ticker: 'SCHL' },
        { name: 'Cengage', ticker: null }
      ]
    },
    workforce_dev: {
      label: 'Workforce development and CTE providers',
      keywords: ['workforce', 'CTE', 'career technical', 'apprenticeship', 'community college', 'bootcamp', 'upskilling', 'reskilling', 'certificate', 'micro-credential'],
      tier3: [
        { name: 'Stride Inc (K12 Inc)', ticker: 'LRN' },
        { name: 'Strategic Education', ticker: 'STRA' },
        { name: 'Adtalem Global Education', ticker: 'ATGE' },
        { name: 'Grand Canyon Education', ticker: 'LOPE' },
        { name: 'Lincoln Educational Services', ticker: 'LINC' }
      ]
    },
    foundations: {
      label: 'Education foundations and philanthropy',
      keywords: ['foundation', 'philanthropy', 'Gates Foundation', 'Walton', 'Carnegie', 'Spencer', 'Lumina', 'CZI', 'Heckscher'],
      tier3: [
        { name: 'Bill & Melinda Gates Foundation', ticker: null },
        { name: 'Walton Family Foundation', ticker: null },
        { name: 'Carnegie Corporation of New York', ticker: null },
        { name: 'Lumina Foundation', ticker: null },
        { name: 'Chan Zuckerberg Initiative', ticker: null }
      ]
    },
    student_services: {
      label: 'Student services: counseling, mental health, special ed',
      keywords: ['counseling', 'mental health', 'SEL', 'special education', 'IEP', '504', 'student support', 'wellness', 'school counselor'],
      tier3: [
        { name: 'Hazel Health', ticker: null },
        { name: 'Daybreak Health', ticker: null },
        { name: 'Cartwheel Care', ticker: null },
        { name: 'Effective School Solutions', ticker: null }
      ]
    },
    accreditation: {
      label: 'Accreditation bodies and quality assurance',
      keywords: ['accreditation', 'CAEP', 'WASC', 'SACSCOC', 'middle states', 'NEASC', 'standards', 'quality review'],
      tier3: [
        { name: 'CAEP (Council for the Accreditation of Educator Preparation)', ticker: null },
        { name: 'WASC Senior College and University Commission', ticker: null },
        { name: 'SACSCOC', ticker: null },
        { name: 'Middle States Commission on Higher Education', ticker: null }
      ]
    }
  };

  // Map science.json's 19 top brain nodes to segments (excluding rPFC + sgACC RI)
  var NODE_SEGMENTS = {
    'BROCA':     ['k12_districts', 'edtech_content'],         // K-12 Teaching
    'AG':        ['higher_ed', 'edtech_lms'],                 // Higher Education
    'M1':        ['workforce_dev'],                           // Vocational Training
    'dlPFC':     ['edtech_content', 'k12_districts'],         // Curriculum Design
    'dACC':      ['assessment'],                              // Student Assessment
    'HIPP':      ['higher_ed', 'edtech_content'],             // Learning Science
    'TPJ':       ['student_services'],                        // Special Education
    'OXY':       ['k12_districts', 'student_services'],       // Early Childhood Education
    'FPN':       ['edtech_lms', 'higher_ed'],                 // Distance Learning
    'PRECUNEUS': ['higher_ed'],                               // Library Systems
    'SMA':       ['k12_districts', 'workforce_dev'],          // Teacher Training
    'vmPFC':     ['federal_ed_funders', 'foundations'],       // Educational Policy
    'WERN':      ['k12_districts', 'edtech_content'],         // Literacy
    'IPS':       ['edtech_content', 'higher_ed'],             // STEM Education
    'FG':        ['edtech_content', 'higher_ed'],             // Arts Education
    'DMN':       ['higher_ed', 'foundations'],                // Research Universities
    'SMN':       ['workforce_dev', 'higher_ed']               // Workforce Dev
  };

  var EXCLUSIONS = {
    federal_ed_funders: ['INST', 'COUR', 'TWOU', 'CHGG', 'PSO', 'HMHC', 'SCHL', 'LRN', 'STRA', 'ATGE', 'LOPE', 'LINC'],
    edtech_lms:         ['HMHC', 'SCHL']
  };

  function resolveTargets(directive) {
    if (!directive) return _empty();

    var dir = directive._directive || {};
    var nodeId = dir.nodeId || '';
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || directive.title || '').toLowerCase();
    var dxId = (directive.diagnosisId || '').toLowerCase();
    var path = directive.path || 'INVESTABLE';

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
    if (rawCompanies.length > 0) companyPool = rawCompanies;
    else {
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
      for (var t3i = 0; t3i < segTier3.length; t3i++) if (segTier3[t3i].ticker) validTickers[segTier3[t3i].ticker] = true;
      for (var exi = 0; exi < exclusions.length; exi++) validTickers[exclusions[exi]] = false;
    }

    for (var ci = 0; ci < companyPool.length; ci++) {
      var co = companyPool[ci];
      var ticker = co.ticker || '';
      if (ticker && validTickers[ticker] === false) continue;
      if (ticker && validTickers[ticker] === true) tier1.push({ name: co.name, ticker: ticker, source: 'portal_verified' });
    }

    var tier3 = [];
    var tier1Tickers = {};
    for (var t1i = 0; t1i < tier1.length; t1i++) if (tier1[t1i].ticker) tier1Tickers[tier1[t1i].ticker] = true;

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
    if (path === 'RESEARCHABLE') executionTargets = ['Research desks', 'Institutional research buyers', 'Independent / sell-side analysts'];
    else if (path === 'INVESTABLE') executionTargets = ['EdTech-focused funds', 'Higher-ed services investors', 'University endowments'];

    var formatted = _format(tier1, tier2, tier3, executionTargets);
    return { tier1: tier1, tier2: tier2, tier3: tier3, executionTargets: executionTargets, formatted: formatted, segments: relevantSegments };
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
        if (text.indexOf(kws[ki].toLowerCase()) !== -1) { seen[segKey] = true; segments.push(segKey); break; }
      }
    }
    if (segments.length === 0) segments.push('edtech_lms');
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
    if (executionTargets.length > 0) parts.push('Execute via: ' + executionTargets.join(', ') + '.');
    return parts.join(' ');
  }

  function _empty() { return { tier1: [], tier2: [], tier3: [], executionTargets: [], formatted: '', segments: [] }; }

  window.LIMENEducationTargetingEngine = { resolveTargets: resolveTargets };
})();
