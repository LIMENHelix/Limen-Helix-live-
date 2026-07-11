/**
 * limen-exec-generator.js
 *
 * Shared draft generator + modal for /civilization (Capital Conversion tab)
 * and /civilization-opportunities (Observatory).
 *
 * LANES: investment + research ONLY. Patent / grant / loan / SBA output
 * generators were retired 2026-06-28 (per the operator's investment+research-only
 * rule). Brains emit only INVESTABLE / RESEARCHABLE. This file now produces:
 *   - Investment Brief  (INVESTABLE)
 *   - Research Brief    (RESEARCHABLE)
 * Legacy docType calls (patent/grant/loan) are normalized to the new briefs so
 * older callers keep working.
 *
 * Runtime discipline: IIFE-wrapped; no DOM mounts / listeners / fetches / LLM
 * calls at load. Modal is created lazily inside _showExecModal().
 *
 * Public surface:
 *   window.LIMENExecGenerator.fromOpportunity(opp, docType) -> boolean
 *     docType: 'investment' | 'research'  (legacy 'loan'->investment, 'patent'/'grant'->research)
 *   window.LIMENExecGenerator.canGround(opp) -> boolean
 *   window.LIMENExecGenerator.canGenerateGrant(opp) -> boolean   (back-compat alias of canGround)
 *
 * Modal toolbar callbacks (referenced from inline onclick in modal HTML):
 *   window._execCopy()  window._execPrint()
 */
(function () {
  'use strict';

  // ─── Execution state (localStorage only) ───────────────────────────────
  var _EXEC_STATE_KEY = 'limen_execution_state';
  function _getExecState() {
    try { return JSON.parse(localStorage.getItem(_EXEC_STATE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function _setExecState(id, state) {
    var s = _getExecState();
    s[id] = state;
    try { localStorage.setItem(_EXEC_STATE_KEY, JSON.stringify(s)); }
    catch (e) { /* swallow quota/security errors */ }
  }

  // ─── Implementation render helper ──────────────────────────────────────
  function _renderImpl(items, lead, fallback) {
    var list = (items || []).filter(Boolean).map(function (x) {
      return String(x).trim();
    }).filter(Boolean);
    if (!list.length) {
      if (fallback === null || fallback === undefined) return '';
      return '<p>' + lead + ' ' + fallback + '.</p>';
    }
    return '<p>' + lead + '</p>' +
      '<ul class="exec-impl-list">' +
      list.map(function (item) { return '<li>' + item + '</li>'; }).join('') +
      '</ul>';
  }

  // ─── Domain context (sector, funders/programs, population, setting) ─────
  var DOMAIN_BASE = {
    medicine:     { context:'clinical', sector:'Medicine', funders:'NIH, AHRQ, HRSA, private health foundations', popBase:'patients, clinicians, and hospital systems', setting:'hospital or multi-specialty practice' },
    energy:       { context:'infrastructure', sector:'Energy', funders:'DOE (ARPA-E, Grid Modernization), NSF, state energy offices', popBase:'utilities, grid operators, and energy-dependent communities', setting:'utility operations center or grid management facility' },
    environment:  { context:'infrastructure', sector:'Environmental Services', funders:'EPA, NOAA, NSF, state environmental agencies', popBase:'communities near environmental hazards and regulatory agencies', setting:'field monitoring station or regulatory agency office' },
    technology:   { context:'workforce', sector:'Technology', funders:'NSF (Future of Work), DOL (ETA), NIST, private tech foundations', popBase:'technology workers, employers, and workforce organizations', setting:'workforce development center or employer training facility' },
    education:    { context:'education', sector:'Education', funders:'Department of Education (IES), NSF (IUSE), Gates Foundation', popBase:'students, educators, and educational institutions', setting:'school, university, or district office' },
    defense:      { context:'infrastructure', sector:'Defense & Security', funders:'DARPA, In-Q-Tel, DOD SBIR/STTR, DHS S&T', popBase:'defense personnel and intelligence analysts', setting:'operations center or secure analysis facility' },
    governance:   { context:'workforce', sector:'Government Services', funders:'NSF (SBE), state/local innovation programs, Bloomberg Philanthropies', popBase:'government agencies and citizens relying on public services', setting:'municipal agency or inter-agency coordination office' },
    finance:      { context:'infrastructure', sector:'Financial Services', funders:'NSF, Federal Reserve research programs, fintech accelerators', popBase:'financial institutions, regulators, and consumers', setting:'bank operations, regulatory office, or fintech platform' },
    industry:     { context:'workforce', sector:'Manufacturing & Industry', funders:'NIST MEP, EDA, DOL, manufacturing extension partnerships', popBase:'manufacturers, industrial workers, and supply chain operators', setting:'factory floor, distribution center, or industrial park' },
    communication:{ context:'infrastructure', sector:'Communications', funders:'NSF, Knight Foundation, MacArthur Foundation', popBase:'media organizations and information consumers', setting:'newsroom, content platform, or community media center' },
    population:   { context:'infrastructure', sector:'Housing & Demographics', funders:'HUD, USDA Rural Development, state housing finance agencies', popBase:'communities facing housing instability and urban planners', setting:'housing authority office or community planning center' },
    law:          { context:'workforce', sector:'Legal & Regulatory', funders:'NSF, Legal Services Corporation, state bar foundations', popBase:'legal professionals, regulatory agencies, and regulated organizations', setting:'law firm, regulatory agency, or legal aid organization' },
    intelligence: { context:'infrastructure', sector:'Intelligence & Analytics', funders:'IARPA, In-Q-Tel, DOD SBIR, intelligence community programs', popBase:'analysts and decision-makers', setting:'analysis center or intelligence fusion facility' },
    trade:        { context:'infrastructure', sector:'Trade & Logistics', funders:'DOC (EDA), SBA, USDA, state trade offices', popBase:'importers, exporters, and logistics providers', setting:'port, distribution hub, or trade compliance office' },
    science:      { context:'education', sector:'Scientific Research', funders:'NSF, NIH, private research foundations', popBase:'researchers, academic institutions, and R&D organizations', setting:'research lab, university department, or tech transfer office' },
    addiction:    { context:'clinical', sector:'Behavioral Health', funders:'SAMHSA, NIH (NIDA), state behavioral health agencies', popBase:'individuals with substance use disorders and treatment providers', setting:'treatment center, community health org, or recovery house' },
    neurology:    { context:'clinical', sector:'Neuroscience & Neurology', funders:'NIH (NINDS), PCORI, neuroscience research foundations', popBase:'neurological patients, neurologists, and research teams', setting:'neurology clinic, academic medical center, or rehab facility' },
    metabolic:    { context:'clinical', sector:'Metabolic Health', funders:'NIH (NIDDK), CDC, ADA research foundation', popBase:'patients with diabetes/obesity and their care teams', setting:'endocrinology clinic, primary care practice, or remote monitoring center' },
    pediatric:    { context:'clinical', sector:'Pediatric Health', funders:'NIH (NICHD), HRSA (MCHB), children\'s health foundations', popBase:'children, parents, pediatricians, and pediatric hospitals', setting:'pediatric practice, children\'s hospital, or early intervention program' },
    economy:        { context:'workforce',      sector:'Regional Economic Development',     funders:'EDA, SBA, Treasury CDFI Fund, state economic development agencies, and community foundations', popBase:'small businesses, workers, lenders, local governments, and workforce boards', setting:'regional economic development office or community development financial institution' },
    infrastructure: { context:'infrastructure', sector:'Public Infrastructure',              funders:'DOT, FEMA, DOE, EPA, state infrastructure banks, and municipal and utility capital programs', popBase:'municipalities, utilities, transit agencies, residents, and critical-service operators', setting:'public works department or utility operations center' },
    agriculture:    { context:'infrastructure', sector:'Agriculture',                        funders:'USDA NIFA, USDA ARS, NRCS, FSA, state agriculture departments, and rural development programs', popBase:'farmers, producers, processors, cooperatives, and rural food-system stakeholders', setting:'farm, cooperative office, or agricultural extension center' },
    culture:        { context:'education',      sector:'Cultural & Civic Institutions',     funders:'NEA, NEH, IMLS, state arts and humanities councils, and community foundations', popBase:'cultural organizations, artists, educators, and community groups', setting:'arts organization, library, museum, or community civic institution' },
    religion:       { context:'workforce',      sector:'Faith & Community Care',             funders:'Office of Faith-Based and Neighborhood Partnerships, community foundations, and interfaith networks', popBase:'congregations, faith leaders, families, and community volunteers', setting:'congregation, interfaith coordination office, or community-service ministry' }
  };

  var DOMAIN_ALIASES = {
    health:       'medicine',
    research:     'science',
    supplyChain:  'trade',
    p2_agri:      'agriculture'
  };

  // FUNCTIONAL-KEYWORD map (NOT canonical nodes). Each key is a human-readable
  // keyword substring-matched against indicator text to flavor a program. The keys
  // are functional-system words, several of them non-nodes (BDNF=plasticity
  // parameter, DMN=composite, vagal=tract, HPA=axis, limbic/executive/sensory/
  // motor/memory=systems), so each entry now carries its TRUTHFUL grounding
  // (real node + motif where one exists, else the non-node kind) — nothing here
  // presents a molecule or a composite as a node-grounded business function.
  var NODE_MEANINGS = {
    'BDNF':     { fn:'learning and adaptation', program:'training and skill-building', scenario:'when practitioners need to learn new protocols or adapt to changing conditions', grounding:{ kind:'parameter', motif:'M6', note:'plasticity / learning-rate parameter on an edge, not a node' } },
    'DMN':      { fn:'planning and self-assessment', program:'strategic planning and organizational review', scenario:'when organizations need to evaluate their own performance and plan improvements', grounding:{ kind:'composite', nodes:['mPFC','PCC','PRECUNEUS'], note:'default-mode composite — a read-only view over its member nodes, not one node' } },
    'vagal':    { fn:'stress response and stabilization', program:'resilience building and crisis stabilization', scenario:'when individuals or systems are under acute stress and need immediate stabilization', grounding:{ kind:'tract', node:'NTS', motif:'M10', note:'vagal afferent = an edge into the interoceptive relay (NTS/AI)' } },
    'HPA':      { fn:'sustained stress management', program:'burnout prevention and workload management', scenario:'when chronic stress is degrading performance and staff retention', grounding:{ kind:'axis', node:'HYPO', motif:'M3', note:'HPA axis; its output node is the hypothalamic/pituitary set-point' } },
    'reward':   { fn:'motivation and incentive', program:'engagement and incentive design', scenario:'when participation rates are low and motivation structures need redesign', grounding:{ kind:'control', node:'NAcc', motif:'M11', note:'reward-drive control motif' } },
    'executive':{ fn:'decision-making and coordination', program:'decision support and workflow coordination', scenario:'when complex decisions require input from multiple stakeholders', grounding:{ kind:'processing', node:'dlPFC', note:'executive-control cortex (processing region, not a control motif)' } },
    'limbic':   { fn:'emotional regulation and safety', program:'psychological safety and trauma-informed care', scenario:'when populations have experienced trauma or operate in high-stress environments', grounding:{ kind:'control', node:'CeA', motif:'M7', note:'threat-monitoring control motif' } },
    'sensory':  { fn:'information intake and monitoring', program:'real-time monitoring and early detection', scenario:'when early warning systems are needed to detect problems before they escalate', grounding:{ kind:'processing', nodes:['S1','V1','A1'], note:'primary sensory cortex (processing regions)' } },
    'motor':    { fn:'action execution and delivery', program:'service delivery and implementation', scenario:'when interventions need to be physically delivered to end users', grounding:{ kind:'processing', nodes:['M1','SMA'], note:'motor cortex (processing regions)' } },
    'memory':   { fn:'institutional knowledge and records', program:'knowledge management and records system', scenario:'when critical institutional knowledge is being lost or is poorly organized', grounding:{ kind:'system', node:'HIPP', note:'hippocampal memory system' } }
  };

  var SIGNAL_PROGRAMS = {
    treatment_gap:    { style:'build a missing capability', verb:'developing', focus:'filling a gap where need is documented but no solution exists', urgency:'A documented need exists with no adequate solution serving it.' },
    institutional_gap:{ style:'create a new model', verb:'establishing', focus:'building capacity where none exists', urgency:'No organization currently provides this function, leaving the need unmet.' },
    cross_domain:     { style:'integrate across sectors', verb:'connecting', focus:'bridging two sectors that currently operate in silos', urgency:'Pressure in one sector is cascading into another with no coordination mechanism.' },
    cross_domain_node:{ style:'integrate across sectors', verb:'connecting', focus:'bridging two sectors that currently operate in silos', urgency:'A critical function spans multiple sectors but is not coordinated.' },
    domain_stress:    { style:'respond to active pressure', verb:'deploying', focus:'responding to active systemic pressure', urgency:'Current stress levels indicate outcomes will deteriorate without intervention.' },
    temporal_gap:     { style:'move first', verb:'creating', focus:'addressing an area where activity has stalled', urgency:'Activity has occurred but no solution has been formalized or deployed.' },
    filing_density:   { style:'formalize emerging practice', verb:'standardizing', focus:'turning informal practice into a structured offering', urgency:'Practitioners are improvising solutions that should be standardized.' },
    novelty:          { style:'translate innovation to practice', verb:'translating', focus:'moving findings into operational use', urgency:'New approaches exist in theory but have not been implemented.' },
    medium_confidence_gap:{ style:'investigate and prototype', verb:'exploring', focus:'testing whether a suspected opening is real and addressable', urgency:'Signals suggest an opening exists but more investigation is needed.' }
  };

  // ─── Grounding (sector / population / phases from the opportunity) ──────
  function _groundOpportunity(opp) {
    var domain = opp.domain || '';
    var resolved = DOMAIN_ALIASES[domain] || domain;
    var base = DOMAIN_BASE[resolved];
    if (!base) return null;

    var sigType = opp.sourceType || 'domain_stress';
    var sigMod = SIGNAL_PROGRAMS[sigType] || SIGNAL_PROGRAMS.domain_stress;

    var nodeMod = null;
    var ind = (opp.indication || '').toUpperCase();
    for (var nk in NODE_MEANINGS) {
      if (ind.indexOf(nk.toUpperCase()) !== -1) { nodeMod = NODE_MEANINGS[nk]; break; }
    }

    var programType = nodeMod ? nodeMod.program : sigMod.style;
    var programName = programType + ' for the ' + base.sector.toLowerCase() + ' sector' + (nodeMod ? ' (' + nodeMod.fn + ')' : '');
    var specificProblem = sigMod.urgency + ' In the ' + base.sector.toLowerCase() + ' sector, ' + (opp.indication || 'systemic stress is creating unmet needs') + '.';
    var scenario = nodeMod ? nodeMod.scenario : 'when ' + base.popBase + ' face challenges current systems cannot address';

    var phase1 = sigType === 'treatment_gap' ? 'Map the gap: who/what is affected, what exists today, and where the shortfall is' :
                 sigType === 'institutional_gap' ? 'Landscape analysis: who serves this need today and where the gap is' :
                 sigType.indexOf('cross_domain') !== -1 ? 'Map the cross-sector interface and who must coordinate' :
                 'Characterize the problem with field data and a literature/market scan';
    var phase2 = 'Develop ' + programType + ' with input from ' + base.popBase + '; build, test, and validate with pilot users at ' + base.setting;
    var phase3 = 'Deploy with partners; measure outcomes for ' + base.popBase + '; document for replication and publication';

    return {
      context: base.context, sector: base.sector, funders: base.funders,
      population: base.popBase, setting: base.setting, program: programName,
      problem: specificProblem, scenario: scenario, focus: sigMod.focus, verb: sigMod.verb,
      style: sigMod.style, triggerSource: sigType.replace(/_/g, ' ').toUpperCase(),
      phase1: phase1, phase2: phase2, phase3: phase3,
      nodeFn: nodeMod ? nodeMod.fn : null, nodeProgram: nodeMod ? nodeMod.program : null
    };
  }

  function _canGround(opp) {
    if (!opp || typeof opp !== 'object') return false;
    return _groundOpportunity(opp) !== null;
  }

  // ─── Investment Brief (INVESTABLE) ─────────────────────────────────────
  function _generateInvestmentBrief(opp) {
    var g = _groundOpportunity(opp);
    var d = opp.domain ? opp.domain.charAt(0).toUpperCase() + opp.domain.slice(1) : 'Domain';
    var sector = g ? g.sector : d;
    var ind = opp.indication || 'an emerging opportunity';
    var stress = Math.round((opp.stress || 0) * 100);
    var conf = Math.round((opp.confidence || 0) * 100);
    var companies = (opp.exposedCompanies || []).filter(Boolean).join(', ');
    var now = new Date().toLocaleDateString();

    return '<h1>INVESTMENT BRIEF</h1>' +
      '<p style="color:#888;font-size:11px">Generated ' + now + ' · Sector: ' + sector + ' · Draft for review — not investment advice</p>' +
      '<h2>Thesis</h2>' +
      '<p>' + sector + ' is showing <strong>' + stress + '% measured stress</strong> around <strong>' + ind + '</strong>. Where a system is strained, capital that relieves the strain tends to be rewarded — this brief frames the investable angle and where to look.</p>' +
      '<h2>What’s driving it</h2>' +
      '<p>' + (g ? g.problem : 'Systemic pressure in this sector is creating unmet, monetizable demand.') + '</p>' +
      _renderImpl(opp.implementations, 'Specific stress points / levers identified:', null) +
      '<h2>The play</h2>' +
      '<p>Position in the companies and assets that most directly relieve this strain in ' + sector.toLowerCase() + '.' + (g ? ' Exposure is cleanest where ' + g.population + ' operate (' + g.setting + ').' : '') + '</p>' +
      (companies
        ? '<p><strong>Names with exposure:</strong> ' + companies + '. Cross-check the command board for the cleanest play.</p>'
        : '<p>Use the command board to surface the public names with cleanest exposure to this strain.</p>') +
      '<h2>Catalysts &amp; timing</h2>' +
      '<p>Re-rating tends to follow once the stress is acknowledged (earnings, policy, supply data). At ' + stress + '% stress and ' + conf + '% confidence this reads as ' + (stress > 65 ? 'an active, near-term' : 'a building') + ' setup. Watch the domain’s live feeds for the inflection.</p>' +
      '<h2>Risks</h2>' +
      '<ul>' +
      '<li>The stress may normalize before the thesis plays out — size accordingly.</li>' +
      '<li>Exposure may be indirect — confirm the company actually addresses this strain, not just the sector.</li>' +
      '<li>Confidence is ' + conf + '% — treat low-confidence signals as watch-list, not entry.</li>' +
      '</ul>' +
      '<h2>Suggested next steps</h2>' +
      '<ul>' +
      '<li>Pull the command board for ' + sector.toLowerCase() + ' names; rank by exposure to ' + ind + '.</li>' +
      '<li>Set alerts on the domain’s live feeds for the catalyst.</li>' +
      '<li>Size to confidence; revisit as stress and feeds update.</li>' +
      '</ul>' +
      '<hr><p style="color:#888;font-size:10px">DRAFT — idea generation only. Not investment advice or a recommendation to buy or sell any security. Confidence ' + conf + '% · stress ' + stress + '%.</p>';
  }

  // ─── Research Brief (RESEARCHABLE) ─────────────────────────────────────
  function _generateResearchBrief(opp) {
    var g = _groundOpportunity(opp);
    var d = opp.domain ? opp.domain.charAt(0).toUpperCase() + opp.domain.slice(1) : 'Domain';
    var sector = g ? g.sector : d;
    var ind = opp.indication || 'an open question';
    var stress = Math.round((opp.stress || 0) * 100);
    var conf = Math.round((opp.confidence || 0) * 100);
    var now = new Date().toLocaleDateString();

    return '<h1>RESEARCH BRIEF</h1>' +
      '<p style="color:#888;font-size:11px">Generated ' + now + (g ? ' · Trigger: ' + g.triggerSource : '') + ' · Draft research direction — not a finding</p>' +
      '<h2>Research question</h2>' +
      '<p>In ' + sector.toLowerCase() + ', ' + ind + '. At <strong>' + stress + '% measured stress</strong> this is where the open question is sharpest: what is actually driving it, and what intervention measurably changes it?</p>' +
      '<h2>Why it matters</h2>' +
      '<p>' + (g ? g.problem : 'A measurable gap exists between what is observed and what is understood in this sector.') + (g ? ' This affects ' + g.population + '.' : '') + '</p>' +
      '<h2>Evidence gap</h2>' +
      _renderImpl(opp.implementations, 'Known signals / partial evidence to build on:', 'limited prior work — largely greenfield') +
      '<h2>Approach</h2>' +
      '<p><strong>Phase 1:</strong> ' + (g ? g.phase1 : 'Characterize the problem with field data and a literature scan') + '.</p>' +
      '<p><strong>Phase 2:</strong> ' + (g ? g.phase2 : 'Develop and test a candidate intervention or model') + '.</p>' +
      '<p><strong>Phase 3:</strong> ' + (g ? g.phase3 : 'Validate, measure outcomes, and document for replication') + '.</p>' +
      '<h2>Expected contributions</h2>' +
      '<ul>' +
      '<li>Peer-reviewable findings on ' + ind + '.</li>' +
      '<li>An open dataset / methodology others can reuse.</li>' +
      '<li>A tested intervention or model for the ' + sector.toLowerCase() + ' sector.</li>' +
      '</ul>' +
      (g ? '<h2>Where to take it</h2><p>Relevant programs / venues: <strong>' + g.funders + '</strong>. Aligns with ' + g.context + ' research priorities in ' + sector.toLowerCase() + '.</p>' : '') +
      '<hr><p style="color:#888;font-size:10px">DRAFT — a research direction generated from live signals, not a validated result. Confidence ' + conf + '% · stress ' + stress + '%.</p>';
  }

  // ─── Modal + export ────────────────────────────────────────────────────
  function _showExecModal(html, oppId, docType) {
    _setExecState(oppId, 'GENERATED');
    var modal = document.getElementById('execModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'execModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px';
      document.body.appendChild(modal);
    }
    var inner = '<div style="background:#0e1018;border:1px solid rgba(201,169,78,0.2);border-radius:6px;max-width:800px;width:100%;max-height:90vh;overflow-y:auto;padding:24px 32px;font-family:Georgia,serif;font-size:13px;color:#d0cec8;line-height:1.7">';
    inner += '<div style="display:flex;gap:8px;margin-bottom:16px;font-family:\'IBM Plex Mono\',monospace">';
    inner += '<button onclick="window._execCopy()" style="font-family:inherit;font-size:11px;padding:4px 12px;background:rgba(201,169,78,0.1);border:1px solid rgba(201,169,78,0.25);color:#C9A94E;border-radius:2px;cursor:pointer;letter-spacing:1px">COPY TO CLIPBOARD</button>';
    inner += '<button onclick="window._execPrint()" style="font-family:inherit;font-size:11px;padding:4px 12px;background:rgba(201,169,78,0.1);border:1px solid rgba(201,169,78,0.25);color:#C9A94E;border-radius:2px;cursor:pointer;letter-spacing:1px">DOWNLOAD PDF</button>';
    inner += '<button onclick="document.getElementById(\'execModal\').style.display=\'none\'" style="font-family:inherit;font-size:11px;padding:4px 12px;background:rgba(232,84,84,0.1);border:1px solid rgba(232,84,84,0.2);color:#e85454;border-radius:2px;cursor:pointer;letter-spacing:1px;margin-left:auto">CLOSE</button>';
    inner += '</div>';
    inner += '<div id="execDocContent">' + html + '</div>';
    inner += '</div>';
    modal.innerHTML = inner;
    modal.style.display = 'flex';
    modal.onclick = function (e) { if (e.target === modal) modal.style.display = 'none'; };
  }

  window._execCopy = function () {
    var content = document.getElementById('execDocContent');
    if (!content) return;
    var text = content.innerText;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { alert('Copied to clipboard'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta); alert('Copied to clipboard');
    }
  };

  window._execPrint = function () {
    var content = document.getElementById('execDocContent');
    if (!content) return;
    var w = window.open('', '_blank');
    w.document.write('<!DOCTYPE html><html><head><title>LIMEN Document</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;color:#222;line-height:1.7;font-size:13px}h1{font-size:18px;border-bottom:2px solid #c9a94e;padding-bottom:6px}h2{font-size:14px;color:#333;margin-top:16px;border-bottom:1px solid #ccc;padding-bottom:3px}table{width:100%;border-collapse:collapse;margin:8px 0}td{padding:4px 8px;border-bottom:1px solid #eee}hr{border:none;border-top:1px solid #c9a94e;margin:16px 0}ul{margin:8px 0;padding-left:20px}li{margin:4px 0}</style></head><body>' + content.innerHTML + '</body></html>');
    w.document.close(); w.focus();
    setTimeout(function () { w.print(); }, 500);
  };

  // ─── Public API ────────────────────────────────────────────────────────
  // Normalize docType: only investment + research survive. Legacy callers
  // (loan/grant/patent) are mapped so they keep producing a sensible brief.
  function _normalizeDocType(t) {
    if (t === 'research' || t === 'patent') return 'research';
    if (t === 'investment' || t === 'loan' || t === 'grant') return 'investment';
    return null;
  }

  window.LIMENExecGenerator = {
    fromOpportunity: function (opp, docType) {
      if (!opp || typeof opp !== 'object') {
        try { console.warn('[LIMENExecGenerator] invalid opportunity object'); } catch (e) {}
        return false;
      }
      var t = _normalizeDocType(docType);
      if (!t) {
        try { console.warn('[LIMENExecGenerator] unsupported docType:', docType); } catch (e) {}
        return false;
      }
      var html;
      try {
        html = (t === 'research') ? _generateResearchBrief(opp) : _generateInvestmentBrief(opp);
      } catch (e) {
        try { console.warn('[LIMENExecGenerator] generator threw for ' + t + ':', e && e.message); } catch (_) {}
        return false;
      }
      if (!html || typeof html !== 'string') return false;
      var oppId = opp.id || opp.opportunityId || 'external-opportunity';
      try { _showExecModal(html, oppId, t); }
      catch (e) { try { console.warn('[LIMENExecGenerator] _showExecModal failed:', e && e.message); } catch (_) {} return false; }
      return true;
    },
    canGround: function (opp) { return _canGround(opp); },
    // Back-compat alias — some callers still reference canGenerateGrant.
    canGenerateGrant: function (opp) { return _canGround(opp); }
  };

})();
