/**
 * limen-exec-generator.js
 *
 * Shared draft generator + modal for /civilization (Capital Conversion tab)
 * and /civilization-opportunities (Observatory).
 *
 * Loaded by:
 *   civilization.html               (before assets/js/ui/console-clarity.js)
 *   civilization-opportunities.html (before assets/js/civilization/observatory-ui.js)
 *
 * Runtime discipline:
 *   - IIFE-wrapped; no DOM mounts at load time.
 *   - No event listeners attached at IIFE time.
 *   - No fetches, no API calls, no Redis writes, no LLM calls.
 *   - The execution modal is created lazily inside _showExecModal()
 *     on first call and re-used thereafter.
 *
 * Public surface:
 *   window.LIMENExecGenerator.fromOpportunity(opp, docType) -> boolean
 *   window.LIMENExecGenerator.canGenerateGrant(opp) -> boolean
 *
 * Modal toolbar callbacks (must remain on window — referenced from inline
 * onclick handlers inside the modal HTML):
 *   window._execCopy()
 *   window._execPrint()
 *
 * Persistence side-effect (pre-existing behavior, unchanged):
 *   _setExecState(oppId, 'GENERATED') writes localStorage 'limen_execution_state'
 *   on every successful modal open.
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

  // ─── Implementation render helper (D2-C) ───────────────────────────────
  // Renders opp.implementations (array of 'Label: value' strings shaped by
  // D2-B in observatory-ui.js) as a structured <p> lead + <ul>. When the
  // array is empty: if fallback is a string, render '<p>{lead} {fallback}.</p>';
  // if fallback === null/undefined, render '' (caller omits the section).
  // No escaping — consistent with this file's existing raw interpolation.
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

  // ─── Patent generator ──────────────────────────────────────────────────
  function _generatePatent(opp) {
    var d = opp.domain ? opp.domain.charAt(0).toUpperCase() + opp.domain.slice(1) : 'Technology';
    var ind = opp.indication || 'system optimization';
    var stress = Math.round((opp.stress || 0) * 100);
    var now = new Date().toLocaleDateString();

    return '<h1>PROVISIONAL PATENT APPLICATION</h1>' +
      '<p style="color:#888;font-size:11px">Generated ' + now + ' · LIMEN Helix Execution Engine · Draft for attorney review</p>' +
      '<h2>Title of Invention</h2>' +
      '<p>System and Method for ' + d + '-Domain Recursive Intelligence Analysis and Intervention Coordination Addressing ' + ind + '</p>' +
      '<h2>Field of Invention</h2>' +
      '<p>This invention relates to the field of ' + d.toLowerCase() + ' systems analysis, specifically to computational methods for detecting, classifying, and coordinating responses to structural stress patterns using recursive phase-state modeling and connectome-mapped intervention pathways.</p>' +
      '<h2>Background</h2>' +
      '<p>Current approaches to ' + d.toLowerCase() + ' domain monitoring rely on isolated metrics and reactive intervention. There exists no integrated system that maps domain stress signals to a structured phase model, identifies intervention gaps through recursive intelligence layers, and coordinates treatment pathways across institutional boundaries. The ' + d.toLowerCase() + ' domain currently exhibits ' + stress + '% normalized stress, indicating systemic pressure that existing tools cannot adequately address.</p>' +
      '<h2>Summary of the Invention</h2>' +
      '<p>The present invention provides a recursive intelligence system that: (1) ingests multi-source domain signals and normalizes stress indicators; (2) maps detected patterns to a connectome-based node structure representing functional subsystems; (3) classifies the system state using an 11-phase kernel model; (4) identifies intervention pathways through an evidence-weighted remedy resolution pipeline; and (5) coordinates treatment delivery across institutional and operational boundaries. The system specifically addresses: ' + ind + '.</p>' +
      '<h2>Detailed Description</h2>' +
      '<p>The system operates through seven recursive intelligence layers: Signal Detection, State Interpretation, Diagnostic Classification, Regulatory Coordination, Action Orchestration, Feedback Integration, and Adaptive Healing. Each layer processes information from the layer below and feeds results upward, creating a closed-loop intelligence cycle.</p>' +
      '<p>In the preferred embodiment, the system monitors the ' + d.toLowerCase() + ' domain using live feed sources, computes normalized stress values, and maps detected patterns to a 123-node connectome structure. When stress exceeds threshold values, the system activates intervention pathways derived from an evidence-graded treatment registry containing domain-specific remedies.</p>' +
      _renderImpl(opp.implementations, 'Key implementation components include:', 'automated analysis and intervention') +
      '<h2>Claims</h2>' +
      '<p><strong>Claim 1 (Independent):</strong> A computer-implemented method for recursive domain intelligence analysis comprising: receiving multi-source stress signals from a ' + d.toLowerCase() + ' domain; normalizing said signals using domain-specific dampening factors; mapping normalized signals to a connectome node structure; classifying system state using a multi-phase kernel model; and generating prioritized intervention recommendations through an evidence-weighted remedy resolution pipeline.</p>' +
      '<p><strong>Claim 2 (Dependent on 1):</strong> The method of Claim 1, wherein the multi-phase kernel model comprises at least eleven distinct phase states including baseline, disruption, instability, stabilization, order, and dissolution phases, each characterized by specific combinations of variance, autocorrelation, slope, and acceleration metrics.</p>' +
      '<p><strong>Claim 3 (Dependent on 1):</strong> The method of Claim 1, wherein the evidence-weighted remedy resolution pipeline applies a seven-step selection process comprising candidate retrieval, node match scoring, direction filtering, contraindication checking, confidence gating, composite ranking, and fallback hierarchy traversal.</p>' +
      '<hr><p style="color:#888;font-size:10px">DRAFT ONLY — Requires patent attorney review before filing. File provisional at uspto.gov ($320 small entity fee).</p>';
  }

  // ─── Real-world translation layer ──────────────────────────────────────
  // Domain base contexts (sector, funders, population base)
  var DOMAIN_BASE = {
    medicine:     { context:'clinical', sector:'Medicine', funders:'NIH, AHRQ, HRSA, private health foundations', popBase:'patients, clinicians, and hospital systems', setting:'hospital or multi-specialty practice' },
    energy:       { context:'infrastructure', sector:'Energy', funders:'DOE (ARPA-E, Grid Modernization), NSF, state energy offices', popBase:'utilities, grid operators, and energy-dependent communities', setting:'utility operations center or grid management facility' },
    environment:  { context:'infrastructure', sector:'Environmental Services', funders:'EPA, NOAA, NSF, state environmental agencies', popBase:'communities near environmental hazards and regulatory agencies', setting:'field monitoring station or regulatory agency office' },
    technology:   { context:'workforce', sector:'Technology', funders:'NSF (Future of Work), DOL (ETA), NIST, private tech foundations', popBase:'technology workers, employers, and workforce organizations', setting:'workforce development center or employer training facility' },
    education:    { context:'education', sector:'Education', funders:'Department of Education (IES), NSF (IUSE), Gates Foundation', popBase:'students, educators, and educational institutions', setting:'school, university, or district office' },
    defense:      { context:'infrastructure', sector:'Defense & Security', funders:'DARPA, In-Q-Tel, DOD SBIR/STTR, DHS S&T', popBase:'defense personnel and intelligence analysts', setting:'operations center or secure analysis facility' },
    governance:   { context:'workforce', sector:'Government Services', funders:'NSF (SBE), state/local innovation grants, Bloomberg Philanthropies', popBase:'government agencies and citizens relying on public services', setting:'municipal agency or inter-agency coordination office' },
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
    // ── Brain-emitted top-level canonical domain keys (D2-A; D2-A2) ──────
    // First-class entries for the canonical domains the 20 brains map to.
    // D2-A added economy, infrastructure, agriculture, culture, religion as
    // first-class. D2-A2 removed the duplicate-drift entries (health,
    // research, p2_agri); those keys now resolve through DOMAIN_ALIASES to
    // canonical medicine, science, agriculture below.
    economy:        { context:'workforce',      sector:'Regional Economic Development',     funders:'EDA, SBA, Treasury CDFI Fund, state economic development agencies, and community foundations', popBase:'small businesses, workers, lenders, local governments, and workforce boards', setting:'regional economic development office, community development financial institution, or local workforce board' },
    infrastructure: { context:'infrastructure', sector:'Public Infrastructure',              funders:'DOT, FEMA, DOE, EPA, state infrastructure banks, and municipal and utility capital programs', popBase:'municipalities, utilities, transit agencies, residents, and critical-service operators', setting:'public works department, utility operations center, or critical-facility coordination office' },
    agriculture:    { context:'infrastructure', sector:'Agriculture',                        funders:'USDA NIFA, USDA ARS, NRCS, FSA, state agriculture departments, and rural development programs', popBase:'farmers, producers, processors, cooperatives, and rural food-system stakeholders', setting:'farm, cooperative office, agricultural extension center, or rural processing facility' },
    culture:        { context:'education',      sector:'Cultural & Civic Institutions',     funders:'NEA, NEH, IMLS, state arts and humanities councils, community foundations, and local philanthropy', popBase:'cultural organizations, artists, educators, community groups, and youth and family audiences', setting:'arts organization, library, museum, or community civic institution' },
    religion:       { context:'workforce',      sector:'Faith & Community Care',             funders:'Office of Faith-Based and Neighborhood Partnerships, community foundations, disaster-response funds, and interfaith networks', popBase:'congregations, faith leaders, families, vulnerable residents, and community volunteers', setting:'congregation, interfaith coordination office, chaplaincy program, or community-service ministry' }
  };

  // ─── Grounding alias map (Patch D2-A; extended D2-A2) ──────────────────
  // Drifted brain emissions and legacy/internal keys map to their canonical
  // top-level domain entries here so _groundOpportunity always reaches the
  // canonical DOMAIN_BASE record for grant text. Brain emissions, snapshot
  // keys, and Observatory packet domains are NOT changed by this map —
  // canonicalization is local to grant grounding.
  var DOMAIN_ALIASES = {
    health:       'medicine',     // medicine-brain emits domainId 'health'
    research:     'science',      // science-brain emits domainId 'research'
    supplyChain:  'trade',        // trade-brain emits domainId 'supplyChain'
    p2_agri:      'agriculture'   // legacy/internal portal-prefix key
  };

  // Node meaning translation — maps connectome/signal concepts to real functions
  var NODE_MEANINGS = {
    'BDNF':     { fn:'learning and adaptation', program:'training and skill-building', scenario:'when practitioners need to learn new protocols or adapt to changing conditions' },
    'DMN':      { fn:'planning and self-assessment', program:'strategic planning and organizational review', scenario:'when organizations need to evaluate their own performance and plan improvements' },
    'vagal':    { fn:'stress response and stabilization', program:'resilience building and crisis stabilization', scenario:'when individuals or systems are under acute stress and need immediate stabilization' },
    'HPA':      { fn:'sustained stress management', program:'burnout prevention and workload management', scenario:'when chronic stress is degrading performance and staff retention' },
    'reward':   { fn:'motivation and incentive', program:'engagement and incentive design', scenario:'when participation rates are low and motivation structures need redesign' },
    'executive':{ fn:'decision-making and coordination', program:'decision support and workflow coordination', scenario:'when complex decisions require input from multiple stakeholders' },
    'limbic':   { fn:'emotional regulation and safety', program:'psychological safety and trauma-informed care', scenario:'when populations have experienced trauma or operate in high-stress environments' },
    'sensory':  { fn:'information intake and monitoring', program:'real-time monitoring and early detection', scenario:'when early warning systems are needed to detect problems before they escalate' },
    'motor':    { fn:'action execution and delivery', program:'service delivery and implementation', scenario:'when interventions need to be physically delivered to end users' },
    'memory':   { fn:'institutional knowledge and records', program:'knowledge management and records system', scenario:'when critical institutional knowledge is being lost or is poorly organized' }
  };

  // Signal type → program style modification
  var SIGNAL_PROGRAMS = {
    treatment_gap:    { style:'build a missing service', verb:'developing', focus:'filling a gap where diagnosis exists but treatment does not', urgency:'This gap means people are being identified as needing help but no adequate service exists to help them.' },
    institutional_gap:{ style:'create a new organizational model', verb:'establishing', focus:'building institutional capacity where none exists', urgency:'No organization currently provides this function, leaving the population unserved.' },
    cross_domain:     { style:'integrate across sectors', verb:'connecting', focus:'bridging two sectors that currently operate in silos', urgency:'Problems in one sector are causing cascading failures in another, but no coordination mechanism exists.' },
    cross_domain_node:{ style:'integrate across sectors', verb:'connecting', focus:'bridging two sectors that currently operate in silos', urgency:'A critical function spans multiple sectors but is not being coordinated.' },
    domain_stress:    { style:'deploy urgent intervention', verb:'deploying', focus:'responding to active systemic pressure', urgency:'Current stress levels indicate that without intervention, outcomes will deteriorate significantly.' },
    temporal_gap:     { style:'build first-mover solution', verb:'creating', focus:'addressing an area where innovation has stalled', urgency:'Activity has occurred but no solution has been formalized or deployed.' },
    filing_density:   { style:'formalize emerging practice', verb:'standardizing', focus:'turning informal practices into structured programs', urgency:'Practitioners are improvising solutions that should be standardized.' },
    novelty:          { style:'translate innovation to practice', verb:'translating', focus:'moving research findings into operational use', urgency:'New approaches exist in theory but have not been implemented.' },
    medium_confidence_gap:{ style:'investigate and prototype', verb:'exploring', focus:'testing whether a suspected need is real and addressable', urgency:'Signals suggest a problem exists but more investigation is needed before committing resources.' }
  };

  // Build opportunity-specific grounding
  function _groundOpportunity(opp) {
    var domain = opp.domain || '';
    // Patch D2-A: resolve mechanism-level keys (e.g., supplyChain) to their
    // canonical first-class DOMAIN_BASE domain (e.g., trade) before lookup.
    // Direct DOMAIN_BASE keys are unaffected.
    var resolved = DOMAIN_ALIASES[domain] || domain;
    var base = DOMAIN_BASE[resolved];
    if (!base) return null;

    var sigType = opp.sourceType || 'domain_stress';
    var sigMod = SIGNAL_PROGRAMS[sigType] || SIGNAL_PROGRAMS.domain_stress;

    // Extract node meaning if indication contains a known node
    var nodeMod = null;
    var ind = (opp.indication || '').toUpperCase();
    for (var nk in NODE_MEANINGS) {
      if (ind.indexOf(nk.toUpperCase()) !== -1) {
        nodeMod = NODE_MEANINGS[nk];
        break;
      }
    }

    // Build specific program description
    var programType = nodeMod ? nodeMod.program : sigMod.style;
    var programName = programType + ' for ' + base.sector.toLowerCase() + ' sector ' + (nodeMod ? nodeMod.fn : 'improvement');

    // Build specific problem
    var specificProblem = sigMod.urgency + ' In the ' + base.sector.toLowerCase() + ' sector, ' + (opp.indication || 'systemic stress is creating unmet needs') + '.';

    // Build specific scenario
    var scenario = nodeMod ? nodeMod.scenario : 'when ' + base.popBase + ' face challenges that current systems cannot adequately address';

    // Build phases from signal type + domain
    var phase1 = sigType === 'treatment_gap' ? 'Map the specific treatment gap: identify who is diagnosed, what they need, and what currently exists' :
                 sigType === 'institutional_gap' ? 'Conduct landscape analysis: identify what organizations serve this population and where the gap exists' :
                 sigType.indexOf('cross_domain') !== -1 ? 'Map the cross-sector interface: identify which organizations on each side need to coordinate and how' :
                 'Conduct needs assessment with ' + base.popBase + ' at ' + base.setting;
    var phase2 = 'Develop ' + programType + ' with input from ' + base.popBase + '. Build, test, and validate with pilot users at ' + base.setting;
    var phase3 = 'Deploy with partner organizations. Measure outcomes for ' + base.popBase + '. Document results for replication and publication';

    return {
      context: base.context,
      sector: base.sector,
      funders: base.funders,
      population: base.popBase,
      setting: base.setting,
      program: programName,
      problem: specificProblem,
      scenario: scenario,
      focus: sigMod.focus,
      verb: sigMod.verb,
      style: sigMod.style,
      triggerSource: sigType.replace(/_/g, ' ').toUpperCase(),
      phase1: phase1,
      phase2: phase2,
      phase3: phase3,
      nodeFn: nodeMod ? nodeMod.fn : null,
      nodeProgram: nodeMod ? nodeMod.program : null
    };
  }

  // Check if grant generation is possible
  function _canGenerateGrant(opp) {
    if (!opp || typeof opp !== 'object') return false;
    return _groundOpportunity(opp) !== null;
  }

  // ─── Grant generator ───────────────────────────────────────────────────
  function _generateGrant(opp) {
    var g = _groundOpportunity(opp);
    if (!g) return '<h1>Grant template requires domain grounding</h1><p>This domain (' + (opp.domain || 'unknown') + ') does not have funder and population context registered. Patent and SBA drafts are still available for this packet.</p>';

    var stress = Math.round((opp.stress || 0) * 100);
    var conf = Math.round((opp.confidence || 0) * 100);
    var now = new Date().toLocaleDateString();
    var progName = g.program.charAt(0).toUpperCase() + g.program.slice(1);

    return '<h1>GRANT APPLICATION — CONCEPT PAPER</h1>' +
      '<p style="color:#888;font-size:11px">Generated ' + now + ' · Trigger: ' + g.triggerSource + ' · Draft for program officer review</p>' +

      '<h2>Project Title</h2>' +
      '<p>' + progName + '</p>' +

      '<h2>Problem Statement</h2>' +
      '<p>' + g.problem + '</p>' +
      '<p>This problem directly affects <strong>' + g.population + '</strong>. The core issue is ' + g.focus + '. Current approaches are fragmented, reactive, and fail to coordinate across the organizations that serve this population. Sector stress is currently at ' + stress + '%, indicating active and measurable systemic pressure.</p>' +

      '<h2>Target Population and Setting</h2>' +
      '<p><strong>Who is served:</strong> ' + g.population + '</p>' +
      '<p><strong>Where the program operates:</strong> ' + g.setting + '</p>' +
      '<p><strong>When it is used:</strong> ' + g.scenario + '</p>' +

      '<h2>Proposed Solution</h2>' +
      '<p>We propose ' + g.verb + ' a <strong>' + g.program + '</strong> that addresses this gap by ' + g.focus + '.</p>' +
      '<p>The program will: (1) assess the specific needs of ' + g.population + ' in the ' + g.setting + '; (2) deploy an evidence-matched intervention tailored to the identified problem; (3) coordinate delivery across the organizations that currently operate in silos; and (4) measure outcomes systematically to build an evidence base for replication.</p>' +
      _renderImpl(opp.implementations, 'Specific intervention components drawn from existing evidence-graded practice include:', null) +
      (g.nodeFn ? '<p>The program specifically targets the ' + g.nodeFn + ' function — ' + g.nodeProgram + ' — which is the area where current systems are failing the population served.</p>' : '') +

      '<h2>Technical Approach</h2>' +
      '<p><strong>Phase 1 (Months 1–6):</strong> ' + g.phase1 + '. Deliverables: needs assessment report, stakeholder engagement summary, program design specification.</p>' +
      '<p><strong>Phase 2 (Months 7–12):</strong> ' + g.phase2 + '. Deliverables: functional prototype, validation protocol, user feedback report.</p>' +
      '<p><strong>Phase 3 (Months 13–18):</strong> ' + g.phase3 + '. Deliverables: pilot results, outcome measurement report, sustainability plan, publication draft.</p>' +

      '<h2>Expected Impact</h2>' +
      '<ul>' +
      '<li>Directly improve outcomes for ' + g.population + ' by addressing the identified ' + g.focus.split(' ').slice(0, 4).join(' ') + '</li>' +
      '<li>Reduce time-to-intervention by coordinating across organizations that currently operate independently</li>' +
      '<li>Produce measurable outcome data suitable for peer-reviewed publication</li>' +
      '<li>Create replicable model that can be deployed in similar ' + g.context + ' settings in other regions</li>' +
      '</ul>' +

      '<h2>Funding Fit</h2>' +
      '<p>Recommended sources: <strong>' + g.funders + '</strong></p>' +
      '<p>This project aligns with ' + g.context + ' innovation priorities and ' + g.sector.toLowerCase() + ' sector improvement mandates. The ' + g.triggerSource.toLowerCase() + ' trigger indicates active demand that funders in this space are positioned to address.</p>' +

      '<h2>Budget Estimate</h2>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<tr style="border-bottom:1px solid #333"><td>Phase 1: Assessment & Design</td><td style="text-align:right">$75,000 – $125,000</td></tr>' +
      '<tr style="border-bottom:1px solid #333"><td>Phase 2: Development & Validation</td><td style="text-align:right">$100,000 – $175,000</td></tr>' +
      '<tr style="border-bottom:1px solid #333"><td>Phase 3: Pilot & Measurement</td><td style="text-align:right">$50,000 – $100,000</td></tr>' +
      '<tr style="font-weight:bold"><td>Total</td><td style="text-align:right">$225,000 – $400,000</td></tr></table>' +

      '<h2>Timeline</h2>' +
      '<p>18 months total. Quarterly milestones with measurable deliverables at each phase gate.</p>' +

      '<h2 style="color:#888;font-size:12px">Technical Appendix</h2>' +
      '<p style="color:#888;font-size:11px">Signal source: ' + g.triggerSource + '. Domain stress: ' + stress + '%. Analysis confidence: ' + conf + '%. This project was identified through systematic monitoring of ' + g.sector.toLowerCase() + ' sector indicators using multi-source data analysis. Technical methodology details available on request.</p>' +

      '<hr><p style="color:#888;font-size:10px">DRAFT ONLY — Adapt to specific FOA requirements. Recommended search: ' + g.funders + ' via grants.gov.</p>';
  }

  // ─── Loan / SBA generator ──────────────────────────────────────────────
  function _generateLoan(opp) {
    var d = opp.domain ? opp.domain.charAt(0).toUpperCase() + opp.domain.slice(1) : 'Technology';
    var ind = opp.indication || 'platform development';
    var stress = Math.round((opp.stress || 0) * 100);
    var companies = (opp.exposedCompanies || []).join(', ') || d + ' sector operators';
    var now = new Date().toLocaleDateString();

    return '<h1>LOAN APPLICATION PACKAGE</h1>' +
      '<p style="color:#888;font-size:11px">Generated ' + now + ' · LIMEN Helix Execution Engine · Draft for lender review</p>' +
      '<h2>Use of Funds</h2>' +
      '<p>Requested capital will fund development and deployment of a ' + d.toLowerCase() + ' domain intelligence platform addressing: ' + ind + '. Specific expenditures include software development, data infrastructure, pilot deployment with initial customers, and 12-month operating runway.</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="border-bottom:1px solid #333"><td>Software Development</td><td style="text-align:right">35%</td></tr>' +
      '<tr style="border-bottom:1px solid #333"><td>Data Infrastructure + APIs</td><td style="text-align:right">20%</td></tr>' +
      '<tr style="border-bottom:1px solid #333"><td>Pilot Deployment</td><td style="text-align:right">15%</td></tr>' +
      '<tr style="border-bottom:1px solid #333"><td>Operating Expenses (12 mo)</td><td style="text-align:right">25%</td></tr>' +
      '<tr><td>Contingency</td><td style="text-align:right">5%</td></tr></table>' +
      '<h2>Business Purpose</h2>' +
      '<p>The ' + d.toLowerCase() + ' sector is under ' + stress + '% measured stress, creating demand for integrated monitoring and intervention tools. Current market offerings are fragmented and reactive. Our platform provides continuous recursive intelligence — detecting problems earlier, matching interventions more accurately, and tracking outcomes systematically.</p>' +
      _renderImpl(opp.implementations, 'Core capability:', 'monitoring and intervention platform') +
      '<h2>Revenue Model</h2>' +
      '<ul>' +
      '<li><strong>SaaS Subscription:</strong> Monthly per-seat licensing for platform access ($500–$2,000/mo per organization)</li>' +
      '<li><strong>Implementation Services:</strong> Onboarding, integration, and customization ($5,000–$25,000 per deployment)</li>' +
      '<li><strong>Data Services:</strong> API access for downstream analytics consumers</li>' +
      '</ul>' +
      '<h2>Market Context</h2>' +
      '<p>Target customers include: ' + companies + '. The addressable market consists of organizations operating in the ' + d.toLowerCase() + ' domain that currently lack integrated stress monitoring and intervention coordination capabilities. Domain stress at ' + stress + '% indicates active demand pressure.</p>' +
      '<h2>Risk Factors</h2>' +
      '<ul>' +
      '<li>Domain stress may normalize before platform reaches market (mitigated by multi-domain applicability)</li>' +
      '<li>Competitive entry from established analytics providers (mitigated by recursive intelligence methodology IP)</li>' +
      '<li>Customer acquisition cycle may exceed 6 months (mitigated by pilot program with early adopters)</li>' +
      '</ul>' +
      '<h2>Repayment Logic</h2>' +
      '<p>Monthly repayment begins Month 7 (after initial customer acquisition). At 10 customers averaging $1,000/mo subscription, monthly revenue of $10,000 supports loan service on amounts up to $150,000 at standard SBA terms. Break-even projected at Month 14–18.</p>' +
      '<hr><p style="color:#888;font-size:10px">DRAFT ONLY — Adapt to specific lender requirements. SBA 7(a) or 504 programs may apply.</p>';
  }

  // ─── Modal + export ────────────────────────────────────────────────────
  function _showExecModal(html, oppId, docType) {
    // Pre-existing side-effect: mark this opportunity GENERATED.
    _setExecState(oppId, 'GENERATED');

    // Lazy create or reuse the modal element. Mounted to document.body —
    // page-agnostic, so this works on /civilization and on
    // /civilization-opportunities without per-page DOM assumptions.
    var modal = document.getElementById('execModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'execModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px';
      document.body.appendChild(modal);
    }

    var inner = '<div style="background:#0e1018;border:1px solid rgba(201,169,78,0.2);border-radius:6px;max-width:800px;width:100%;max-height:90vh;overflow-y:auto;padding:24px 32px;font-family:Georgia,serif;font-size:13px;color:#d0cec8;line-height:1.7">';
    // Toolbar
    inner += '<div style="display:flex;gap:8px;margin-bottom:16px;font-family:\'IBM Plex Mono\',monospace">';
    inner += '<button onclick="window._execCopy()" style="font-family:inherit;font-size:11px;padding:4px 12px;background:rgba(201,169,78,0.1);border:1px solid rgba(201,169,78,0.25);color:#C9A94E;border-radius:2px;cursor:pointer;letter-spacing:1px">COPY TO CLIPBOARD</button>';
    inner += '<button onclick="window._execPrint()" style="font-family:inherit;font-size:11px;padding:4px 12px;background:rgba(201,169,78,0.1);border:1px solid rgba(201,169,78,0.25);color:#C9A94E;border-radius:2px;cursor:pointer;letter-spacing:1px">DOWNLOAD PDF</button>';
    inner += '<button onclick="document.getElementById(\'execModal\').style.display=\'none\'" style="font-family:inherit;font-size:11px;padding:4px 12px;background:rgba(232,84,84,0.1);border:1px solid rgba(232,84,84,0.2);color:#e85454;border-radius:2px;cursor:pointer;letter-spacing:1px;margin-left:auto">CLOSE</button>';
    inner += '</div>';
    // Content
    inner += '<div id="execDocContent">' + html + '</div>';
    inner += '</div>';

    modal.innerHTML = inner;
    modal.style.display = 'flex';
    modal.onclick = function (e) { if (e.target === modal) modal.style.display = 'none'; };
  }

  // Export: copy. Stays on window — modal toolbar uses inline onclick.
  window._execCopy = function () {
    var content = document.getElementById('execDocContent');
    if (!content) return;
    var text = content.innerText;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { alert('Copied to clipboard'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Copied to clipboard');
    }
  };

  // Export: print-to-PDF. Stays on window — modal toolbar uses inline onclick.
  window._execPrint = function () {
    var content = document.getElementById('execDocContent');
    if (!content) return;
    var w = window.open('', '_blank');
    w.document.write('<!DOCTYPE html><html><head><title>LIMEN Document</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;color:#222;line-height:1.7;font-size:13px}h1{font-size:18px;border-bottom:2px solid #c9a94e;padding-bottom:6px}h2{font-size:14px;color:#333;margin-top:16px;border-bottom:1px solid #ccc;padding-bottom:3px}table{width:100%;border-collapse:collapse;margin:8px 0}td{padding:4px 8px;border-bottom:1px solid #eee}hr{border:none;border-top:1px solid #c9a94e;margin:16px 0}ul{margin:8px 0;padding-left:20px}li{margin:4px 0}</style></head><body>' + content.innerHTML + '</body></html>');
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 500);
  };

  // ─── Public API ────────────────────────────────────────────────────────
  // Called by:
  //   /civilization-opportunities Observatory artifact buttons
  //   /civilization Capital Conversion (via window._execGenerate wrapper)
  window.LIMENExecGenerator = {
    fromOpportunity: function (opp, docType) {
      if (!opp || typeof opp !== 'object') {
        try { console.warn('[LIMENExecGenerator] invalid opportunity object'); } catch (e) {}
        return false;
      }
      if (docType !== 'patent' && docType !== 'grant' && docType !== 'loan') {
        try { console.warn('[LIMENExecGenerator] unsupported docType:', docType); } catch (e) {}
        return false;
      }
      var html;
      try {
        if (docType === 'patent') html = _generatePatent(opp);
        else if (docType === 'grant') html = _generateGrant(opp);
        else /* loan */ html = _generateLoan(opp);
      } catch (e) {
        try { console.warn('[LIMENExecGenerator] generator threw for ' + docType + ':', e && e.message); } catch (_) {}
        return false;
      }
      if (!html || typeof html !== 'string') {
        try { console.warn('[LIMENExecGenerator] generator produced no html for ' + docType); } catch (e) {}
        return false;
      }
      var oppId = opp.id || opp.opportunityId || 'external-opportunity';
      try {
        _showExecModal(html, oppId, docType);
      } catch (e) {
        try { console.warn('[LIMENExecGenerator] _showExecModal failed:', e && e.message); } catch (_) {}
        return false;
      }
      return true;
    },
    canGenerateGrant: function (opp) {
      return _canGenerateGrant(opp);
    }
  };

})();
