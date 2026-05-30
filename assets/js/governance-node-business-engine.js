/**
 * governance-node-business-engine.js — Governance Node-to-Business Assignment Engine
 *
 * GOVERNANCE DOMAIN ONLY. Full-hierarchy inference layer.
 * 103 operational nodes mapped (20 GOVERNANCE-TOP + 83 GOVERNANCE-OPERATIONAL).
 * Excludes the same 20 RI / framework nodes as locked domains.
 * (123 total brain nodes - 20 RI exclusions = 103 operational.)
 *
 * Self-gates: only runs when ?domain=governance
 * Exposes: window.LIMENGovernanceBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'governance') return;

  var STORAGE_KEY = 'limen_governance_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_governance_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

  var RI_NODES = {
    'ACC': true, 'ASTRO': true, 'BBB': true, 'DMNMTL': true, 'EBA': true,
    'FPC': true, 'IPL': true, 'MFC': true, 'MI': true, 'PMC': true,
    'PPA': true, 'PRC': true, 'S2': true, 'SCN': true, 'SDH': true,
    'SPL': true, 'V4V5': true, 'VIA': true, 'rPFC': true, 'sgACC': true
  };

  var GENERIC_TREATMENT_PATTERNS = [
    'Deploy Technology Integration Integrated Technology Platform',
    'Deploy KPI Tracking Integrated Technology Platform',
    'Deploy Innovation Pipeline Integrated Technology Platform',
    'Deploy Trend Analysis Integrated Technology Platform',
    'Deploy Scalability Integrated Technology Platform',
    'Deploy Baseline Assessment Integrated Technology Platform',
    'Deploy Reporting Integrated Technology Platform',
    'Deploy Sustainability Integrated Technology Platform',
    'Deploy Cost Optimization Integrated Technology Platform',
    'Deploy Process Improvement Integrated Technology Platform',
    'Deploy Benchmarking Integrated Technology Platform',
    'Deploy Data Collection Integrated Technology Platform',
    'Deploy Delivery Integrated Technology Platform',
    'Deploy Risk Mitigation Integrated Technology Platform',
    'Deploy Resource Planning Integrated Technology Platform',
    'Deploy Execution Integrated Technology Platform',
    'Deploy Stakeholder Coordination Integrated Technology Platform',
    'Deploy Timeline Management Integrated Technology Platform'
  ];
  var _genericSet = {};
  for (var gi = 0; gi < GENERIC_TREATMENT_PATTERNS.length; gi++) _genericSet[GENERIC_TREATMENT_PATTERNS[gi]] = true;

  function isGenericTreatment(label) {
    if (_genericSet[label]) return true;
    var lower = (label || '').toLowerCase();
    if (lower.indexOf('integrated technology platform') !== -1) return true;
    if (lower.indexOf('diagnostic classification') !== -1 && lower.indexOf('protocol') !== -1) return true;
    if (lower.indexOf('signal ingestion') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('intervention planning') !== -1 && lower.indexOf('assessment') !== -1) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL NODE BUSINESS DIRECTORY — 103 operational nodes
  // 20 GOVERNANCE-TOP (full neuroTranslation) + 83 GOVERNANCE-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── GOVERNANCE-TOP NODES (20) — full detail with neuroTranslation ──
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Strategic Policy Direction', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains working memory and goal-directed reasoning over abstract plans.', inBusiness: 'In governance, strategic policy direction is the executive function of the state \u2014 setting national priorities, drafting major reform agendas, and arbitrating among ministers.' },
      function: 'Sets national policy direction, long-range strategy, and reform agendas',
      dysregulation: 'Strategy drift, ministerial silos, reform fatigue, missed long-range planning',
      expectedTypes: [
        { type: 'Policy think tank', reason: 'Brookings, Heritage, Cato, AEI, RAND \u2014 produces long-arc policy direction', confidence: 0.92 },
        { type: 'Strategic planning consultancy for government', reason: 'McKinsey Public Sector, BCG Center for Public Impact, Deloitte Federal', confidence: 0.88 },
        { type: 'Government affairs intelligence platform', reason: 'Bloomberg Government, FiscalNote, Quorum', confidence: 0.85 },
        { type: 'Federal executive recruiting / Schedule C placement', reason: 'Korn Ferry Government, Heidrick & Struggles Public Sector, Russell Reynolds Government, Egon Zehnder Public Sector, Plus Plus Talent, Boyden Government \u2014 place senior political appointees and Schedule C staff', confidence: 0.80 }
      ]
    },
    'BROCA': {
      fullName: 'Broca\u2019s Area', label: 'Legislation & Policy Drafting', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured grammatical language and intentional speech.', inBusiness: 'In governance, legislation and policy drafting is the work of turning political intent into the precise legal language of statutes, regulations, and treaties.' },
      function: 'Drafts legislation, regulations, executive orders, and treaty language',
      dysregulation: 'Bill backlog, drafting errors, ambiguity exploited in court, regulatory capture during drafting',
      expectedTypes: [
        { type: 'Legislative drafting service', reason: 'Hogan Lovells legislative drafting, Holland & Knight legislative practice, Ballard Spahr public finance and legislation, K&L Gates legislative, Akin Gump legislative drafting \u2014 plus the Office of the Legislative Counsel (House and Senate)', confidence: 0.90 },
        { type: 'Regulatory comment / rulemaking SaaS', reason: 'Regulations.gov-adjacent platforms for tracking and submitting comments', confidence: 0.85 },
        { type: 'Lobbying / government affairs firm', reason: 'BGR Group, Brownstein, Akin Gump, Holland & Knight', confidence: 0.92 },
        { type: 'Plain-language statute / regulation translation tool', reason: 'AI tools that summarize laws for the public and stakeholders', confidence: 0.78 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Budget & Appropriations Decisions', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates expected value of choices and updates preferences based on outcomes.', inBusiness: 'In governance, budget and appropriations decisions are how the state assigns value across competing priorities \u2014 the place where every program lives or dies each year.' },
      function: 'Makes budget, appropriations, and resource allocation decisions across government',
      dysregulation: 'Continuing resolution gridlock, omnibus bloat, earmark abuse, budget fights derailing programs',
      expectedTypes: [
        { type: 'Budget transparency platform', reason: 'USAspending.gov, OpenTheBooks, TaxpayerAdvocate', confidence: 0.88 },
        { type: 'Government finance consulting firm', reason: 'PFM Group, Marwick, Deloitte Public Sector', confidence: 0.85 },
        { type: 'Appropriations tracking SaaS', reason: 'Bloomberg Government Appropriations module, FiscalNote', confidence: 0.85 },
        { type: 'Federal grant search / matching platform', reason: 'GrantSelect, Grants.gov, Instrumentl', confidence: 0.82 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Constituent & Stakeholder Engagement', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports perspective-taking and theory of mind \u2014 understanding others\u2019 viewpoints.', inBusiness: 'In governance, constituent and stakeholder engagement is the work of understanding what citizens, businesses, and communities actually want from their government.' },
      function: 'Engages constituents, conducts public consultation, gathers stakeholder feedback',
      dysregulation: 'Disconnection from constituents, missing stakeholder voices, performative consultation, town hall theater',
      expectedTypes: [
        { type: 'Civic engagement platform', reason: 'Granicus, CivicPlus, Bang the Table, PublicInput', confidence: 0.88 },
        { type: 'Constituent management for elected officials', reason: 'IQ, Fireside, Quorum constituent', confidence: 0.85 },
        { type: 'Public consultation / participatory budgeting tool', reason: 'CitizenLab, Decidim, Consul Democracy', confidence: 0.80 },
        { type: 'Civic-tech development shop', reason: 'Code for America, Nava, Skylight', confidence: 0.85 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Inter-Agency Coordination', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates attention and task control across regions in response to changing demands.', inBusiness: 'In governance, inter-agency coordination is the work of getting departments and agencies to actually work together across stovepiped jurisdictions.' },
      function: 'Coordinates across federal departments, state-federal partnerships, and inter-agency task forces',
      dysregulation: 'Stovepiping, turf wars, duplicate programs, missed inter-agency handoffs, NSC dysfunction',
      expectedTypes: [
        { type: 'Inter-agency collaboration consultancy', reason: 'Booz Allen Hamilton, Deloitte Federal, IBM Public Sector, Accenture Federal Services run cross-agency program management offices', confidence: 0.88 },
        { type: 'Federal program integration platform', reason: 'ServiceNow Public Sector, Salesforce Government Cloud, Pegasystems Federal track cross-agency initiatives and shared services', confidence: 0.85 },
        { type: 'NSC / interagency advisor practice', reason: 'McLarty Associates, Albright Stonebridge, Beacon Global Strategies \u2014 staffed by former NSC and senior interagency officials', confidence: 0.82 },
        { type: 'Federal program integration prime', reason: 'Leidos, CACI, SAIC, GDIT integrate IT and operations across multiple cabinet departments', confidence: 0.85 },
        { type: 'Shared services / FedRAMP cloud broker', reason: 'GSA cloud brokers, CGI Federal Shared Services, NTT Data Federal supporting cross-agency cloud and data fabrics', confidence: 0.78 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Strategic Trade-off Decisions', tier: 'top',
      neuroTranslation: { inNeurology: 'Makes strategic tradeoff decisions weighing expected outcomes against values.', inBusiness: 'In governance, strategic tradeoff decisions are the high-stakes choices about which programs to fund, which alliances to honor, and which political capital to spend.' },
      function: 'Makes strategic tradeoff decisions about political capital, program priorities, and policy commitments',
      dysregulation: 'Sunk-cost commitments, decision paralysis, political capital misallocation',
      expectedTypes: [
        { type: 'Political risk advisory firm', reason: 'Eurasia Group, Control Risks, Teneo, RANE Network, Hakluyt, Maplecroft \u2014 sell to corporate boards and sovereign funds', confidence: 0.90 },
        { type: 'Strategic communications consultancy', reason: 'Brunswick Group, FGS Global, Sard Verbinnen, Edelman Public Affairs, Joele Frank \u2014 the firms behind major political crisis comms', confidence: 0.85 },
        { type: 'Polling / public opinion firm', reason: 'Pew Research, Gallup, Morning Consult, YouGov, Ipsos Public Affairs, SSRS \u2014 the rails for tracking shifting political tradeoffs', confidence: 0.88 },
        { type: 'Government strategy consulting practice', reason: 'McKinsey Public Sector, BCG Center for Public Impact, Bain Government, Deloitte Government & Public Services', confidence: 0.85 },
        { type: 'Government affairs intelligence platform', reason: 'Bloomberg Government, FiscalNote, Quorum, Capitol Canary feed real-time political signal into corporate and agency decision teams', confidence: 0.85 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Compliance, Ethics & Enforcement', tier: 'top',
      neuroTranslation: { inNeurology: 'Monitors conflict and errors and signals when adjustment is needed.', inBusiness: 'In governance, compliance, ethics, and enforcement is the work of catching policy violations, ethics breaches, and regulatory failures before they become scandals.' },
      function: 'Enforces ethics rules, compliance regimes, and inspector general functions',
      dysregulation: 'Ethics violations, IG findings ignored, watchdog defunding, accountability theater',
      expectedTypes: [
        { type: 'Government ethics / compliance consultancy', reason: 'Holland & Knight, Crowell & Moring, K&L Gates ethics practices', confidence: 0.85 },
        { type: 'Inspector general support service', reason: 'Kearney & Company (federal IG audit prime), Cotton & Company (Sikich), Williams Adley & Company, Brown & Company CPAs, Allmond & Company \u2014 the federal IG and OIG audit contractor universe', confidence: 0.85 },
        { type: 'GovCon compliance platform', reason: 'Govini compliance, Pax8 govcon tools', confidence: 0.78 },
        { type: 'FCPA / anti-bribery compliance firm', reason: 'Steptoe, K&L Gates, FTI Consulting FCPA practice', confidence: 0.85 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Executive Authority & Rule of Law', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains top-down executive control over goal-directed behavior.', inBusiness: 'In governance, executive authority and rule of law is the framework that limits what the state can do \u2014 separation of powers, due process, judicial review.' },
      function: 'Enforces rule of law, separation of powers, and constitutional limits on state action',
      dysregulation: 'Executive overreach, court packing, judicial independence eroded, emergency powers abuse',
      expectedTypes: [
        { type: 'Constitutional law firm / appellate practice', reason: 'WilmerHale, Boies Schiller Flexner, Gibson Dunn, Williams & Connolly, Munger Tolles \u2014 the firms that argue separation-of-powers cases at the Supreme Court', confidence: 0.88 },
        { type: 'Judicial transparency / court analytics', reason: 'Bloomberg Law court analytics, Lex Machina (LexisNexis), Westlaw Edge (Thomson Reuters), Empirical SCOTUS, Federal Judicial Center tools', confidence: 0.82 },
        { type: 'Civil liberties legal advocacy', reason: 'ACLU, Electronic Frontier Foundation, Lawyers\u2019 Committee for Civil Rights Under Law, NAACP Legal Defense Fund, Knight First Amendment Institute, Protect Democracy', confidence: 0.88 },
        { type: 'Public-interest constitutional NGO', reason: 'Brennan Center for Justice, Common Cause, Citizens for Responsibility and Ethics in Washington (CREW), American Constitution Society', confidence: 0.85 },
        { type: 'Constitutional law publishing / scholarly press', reason: 'Thomson Reuters Westlaw Treatises, LexisNexis Matthew Bender, Oxford University Press, Cambridge University Press constitutional law lists', confidence: 0.78 }
      ]
    },
    'NAcc': {
      fullName: 'Nucleus Accumbens', label: 'Voter Engagement & Election Mobilization', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes reward prediction and motivation to act.', inBusiness: 'In governance, voter engagement and election mobilization is the work of turning citizens out to vote and giving elected officials a real democratic mandate.' },
      function: 'Drives voter registration, turnout, and election mobilization',
      dysregulation: 'Voter apathy, turnout decline, voter suppression, registration backlog',
      expectedTypes: [
        { type: 'Voter registration / GOTV platform', reason: 'Rock the Vote, TurboVote, HeadCount, BallotReady', confidence: 0.88 },
        { type: 'Campaign technology vendor', reason: 'NGP VAN, Action Network, ActBlue, WinRed', confidence: 0.92 },
        { type: 'Election data and modeling firm', reason: 'Catalist, L2, TargetSmart, i360', confidence: 0.85 },
        { type: 'Civic engagement nonprofit', reason: 'When We All Vote, NonProfit Vote, Voto Latino', confidence: 0.82 }
      ]
    },
    'DMN': {
      fullName: 'Default Mode Network', label: 'Standing State Operations', tier: 'top',
      neuroTranslation: { inNeurology: 'Activates during rest and self-referential thought; integrates autobiographical memory.', inBusiness: 'In governance, standing state operations is the day-to-day machinery of government \u2014 the agencies that deliver services, process forms, and keep the lights on regardless of which party is in power.' },
      function: 'Operates standing government services and back-office functions',
      dysregulation: 'Service delivery failures, IT modernization debt, agency staffing crises, citizen experience gaps',
      expectedTypes: [
        { type: 'Government IT modernization service', reason: 'Booz Allen, Leidos, CACI, GDIT, Maximus', confidence: 0.90 },
        { type: 'Federal civilian managed services', reason: 'Maximus, Conduent, ICF, GDIT', confidence: 0.85 },
        { type: 'Citizen experience / digital services consultancy', reason: 'Nava PBC, USDS / 18F alumni firms, Skylight', confidence: 0.85 },
        { type: 'Government workflow / case management SaaS', reason: 'ServiceNow Public Sector, Pega Government, Salesforce Government Cloud', confidence: 0.90 }
      ]
    },
    'SMA': {
      fullName: 'Supplementary Motor Area', label: 'Operational Policy Implementation', tier: 'top',
      neuroTranslation: { inNeurology: 'Plans and prepares motor sequences before they execute.', inBusiness: 'In governance, operational policy implementation is the work of taking a passed law or new regulation and actually putting it into practice across the system.' },
      function: 'Implements policies and rules at operational scale across government',
      dysregulation: 'Implementation gaps, rule freeze, mandate without funding, policy that exists on paper only',
      expectedTypes: [
        { type: 'Federal implementation consultancy', reason: 'Deloitte Government & Public Services, Booz Allen Hamilton, Accenture Federal Services, KPMG Government, Guidehouse \u2014 each runs major civilian implementation portfolios', confidence: 0.92 },
        { type: 'Policy rollout / change management firm', reason: 'ICF International, EY Government & Public Sector, Grant Thornton Public Sector, BDO USA Government Services drive change management for new federal programs', confidence: 0.85 },
        { type: 'Federal PMO support contractor', reason: 'Leidos, CACI, SAIC, GDIT, ManTech, Tetra Tech operate program management offices across HHS, DHS, DoD, and DoE', confidence: 0.88 },
        { type: 'Federal financial systems integrator', reason: 'Maximus, CGI Federal, Conduent State & Local, Accenture Federal stand up benefits, eligibility, and payment systems', confidence: 0.88 },
        { type: 'Citizen-facing service delivery vendor', reason: 'Nava PBC, Skylight, USDS-affiliated firms, Ad Hoc LLC \u2014 the modern digital-services contractors implementing federal programs from the user side', confidence: 0.82 }
      ]
    },
    'STRI': {
      fullName: 'Striatum', label: 'Government Procurement & Contracting', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes reward prediction and selects actions based on expected value.', inBusiness: 'In governance, procurement and contracting is the formal machinery of how the state buys things \u2014 RFPs, IDIQs, OTAs, the entire $700+ billion federal contracting ecosystem.' },
      function: 'Manages federal procurement, contracting, and acquisition cycles',
      dysregulation: 'Procurement bottlenecks, valley of death, sole-source abuse, protest delays',
      expectedTypes: [
        { type: 'Government contract intelligence platform', reason: 'Govini, GovWin, Bloomberg Government, Onvia', confidence: 0.92 },
        { type: 'Federal acquisition consultancy', reason: 'Deltek, GovTribe, BAH acquisition support', confidence: 0.85 },
        { type: 'Bid / proposal writing service', reason: 'Lohfeld Consulting, Privia, Shipley Associates', confidence: 0.85 },
        { type: 'GSA Schedule consulting firm', reason: 'EZGSA, GovKinex, Winvale, FedSchedules, GSA Schedule Contracting Group, Centre Law & Consulting \u2014 help vendors win and maintain GSA Multiple Award Schedules', confidence: 0.80 }
      ]
    },
    'THAL': {
      fullName: 'Thalamus', label: 'Information Routing & FOIA', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays and gates sensory information between cortical and subcortical regions.', inBusiness: 'In governance, information routing and FOIA is the gatekeeper of what information moves between the public, the press, and the state.' },
      function: 'Routes information through and out of government via FOIA, declassification, and public records',
      dysregulation: 'FOIA backlog, classification overuse, records destroyed, transparency theater',
      expectedTypes: [
        { type: 'FOIA / public records processing platform', reason: 'GovQA (Granicus), MuckRock, NextRequest (CivicPlus), FOIAonline (legacy EPA-hosted), Hyland OnBase Public Records \u2014 manage FOIA queues at scale', confidence: 0.88 },
        { type: 'Government records management vendor', reason: 'Iron Mountain Government Services, Hyland Government, OpenText Government, Microsoft Purview Government, GovCIO \u2014 federal records management and retention', confidence: 0.85 },
        { type: 'Government transparency NGO', reason: 'National Security Archive (GWU), MuckRock Foundation, Project on Government Oversight (POGO), American Oversight, Sunlight Foundation alumni network', confidence: 0.80 },
        { type: 'Declassification / classified records consultancy', reason: 'Hagerty Consulting declassification, MITRE Information Security and Privacy, Booz Allen classified records, ManTech classified records management \u2014 support PIDB, NARA ISOO, and agency declassification reviews', confidence: 0.78 },
        { type: 'Federal data publishing platform', reason: 'Data.gov-adjacent platforms, Socrata (Tyler Technologies), OpenGov, ESRI ArcGIS Open Data publish public-facing government records', confidence: 0.82 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Cross-Domain Policy Synthesis', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates semantic information across domains, supporting conceptual reasoning.', inBusiness: 'In governance, cross-domain policy synthesis is the work of pulling together economics, law, science, and public health to solve problems that don\u2019t fit in one agency.' },
      function: 'Synthesizes policy analysis across multiple domains for complex, cross-cutting challenges',
      dysregulation: 'Single-discipline policy myopia, missed externalities, cross-cutting failures (climate, pandemic, AI)',
      expectedTypes: [
        { type: 'Multi-disciplinary policy think tank', reason: 'Brookings Institution, RAND Corporation, Urban Institute, New America, Bipartisan Policy Center, Niskanen Center, Mercatus Center', confidence: 0.90 },
        { type: 'Public-interest tech and policy lab', reason: 'Harvard Belfer Center, Stanford HAI, Berkman Klein Center, GovLab (NYU), Day One Project (FAS), Aspen Tech Policy Hub', confidence: 0.85 },
        { type: 'Cross-sector consulting firm', reason: 'McKinsey Public Sector, BCG Center for Public Impact, Bain Government, Deloitte Government & Public Services, EY Government & Public Sector', confidence: 0.88 },
        { type: 'Federally Funded R&D Center (FFRDC)', reason: 'RAND Corporation, MITRE, Institute for Defense Analyses (IDA), Aerospace Corporation, RAND National Security Research Division \u2014 cross-cutting federal analysis at scale', confidence: 0.88 },
        { type: 'University-affiliated public policy school', reason: 'Harvard Kennedy School (Mossavar-Rahmani Center), Princeton SPIA, Georgetown McCourt, Duke Sanford, UChicago Harris commissioned policy work', confidence: 0.78 }
      ]
    },
    'CAUD': {
      fullName: 'Caudate Nucleus', label: 'Habitual Government Workflow Automation', tier: 'top',
      neuroTranslation: { inNeurology: 'Builds and maintains habitual action sequences that run without conscious effort.', inBusiness: 'In governance, habitual workflow automation is the long, slow work of replacing manual government processes with reliable automated ones \u2014 forms, eligibility checks, payments.' },
      function: 'Automates repetitive government workflows: forms, eligibility, payments, case routing',
      dysregulation: 'Manual workarounds, paper-based processes, eligibility errors, citizen wait times',
      expectedTypes: [
        { type: 'Government workflow automation platform', reason: 'ServiceNow Public Sector, Pegasystems Government, Salesforce Government Cloud, Microsoft Power Platform Government, Appian Federal', confidence: 0.92 },
        { type: 'RPA / robotic process automation for gov', reason: 'UiPath Federal, Automation Anywhere Federal, Blue Prism Government, Microsoft Power Automate Government \u2014 deployed across IRS, SSA, VA', confidence: 0.85 },
        { type: 'Eligibility / benefits modernization vendor', reason: 'Maximus, Deloitte Government, Conduent State & Local, Accenture Federal Services, CGI Federal eligibility systems', confidence: 0.88 },
        { type: 'Federal payments / disbursement platform', reason: 'Fiserv Government, FIS Government, U.S. Bank Government Banking, Comerica Direct Express \u2014 the rails for federal benefit payments', confidence: 0.82 },
        { type: 'Document processing / AI extraction vendor', reason: 'ABBYY Government, Hyperscience Federal, Instabase, Microsoft Form Recognizer Federal \u2014 automate intake of paper forms still flooding agencies', confidence: 0.82 }
      ]
    },
    'CeA': {
      fullName: 'Central Amygdala', label: 'Crisis Response & Emergency Powers', tier: 'top',
      neuroTranslation: { inNeurology: 'Initiates rapid defensive responses to perceived threats.', inBusiness: 'In governance, crisis response and emergency powers is the framework that lets the state act decisively in a crisis \u2014 declarations, mobilization, expedited authorities.' },
      function: 'Manages crisis response, emergency declarations, and special powers activation',
      dysregulation: 'Emergency power abuse, slow declaration, crisis cascade, mission creep on emergency authorities',
      expectedTypes: [
        { type: 'Emergency management consultancy', reason: 'Tetra Tech Disaster Response, Witt O\u2019Brien\u2019s, IEM, ICF Emergency Management & Resilience, Hagerty Consulting, Tidal Basin', confidence: 0.90 },
        { type: 'Crisis communications firm for government', reason: 'Brunswick Group, Levick, Edelman Public Affairs, Sard Verbinnen, Joele Frank, FGS Global crisis practice', confidence: 0.85 },
        { type: 'FEMA / DHS prime support contractor', reason: 'Tetra Tech, AECOM Public Sector, Stantec Disaster Recovery, IEM, AC Disaster Consulting handle FEMA Public Assistance and Stafford Act work', confidence: 0.88 },
        { type: 'Continuity-of-government / COOP planner', reason: 'Witt O\u2019Brien\u2019s COOP, Constellis, ICF Continuity, Booz Allen Continuity Services support classified COG and COOP plans', confidence: 0.82 },
        { type: 'Emergency notification / mass alerting platform', reason: 'Everbridge (BlackRock-acquired), OnSolve, AtHoc (BlackBerry), Rave Mobile Safety \u2014 the systems behind WEA, IPAWS, and federal building alerts', confidence: 0.85 }
      ]
    },
    'LANG': {
      fullName: 'Language Network', label: 'Treaty, Diplomacy & Multilingual Policy', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates the distributed language network across cortical regions.', inBusiness: 'In governance, treaty and multilingual policy is the work of negotiating across languages and legal systems \u2014 treaties, trade agreements, diplomatic communiques.' },
      function: 'Drafts treaties, manages multilingual diplomacy, and coordinates cross-jurisdictional language',
      dysregulation: 'Treaty translation errors, diplomatic miscommunication, cross-border policy fragmentation',
      expectedTypes: [
        { type: 'International law firm', reason: 'Sidley Austin, White & Case, Cleary Gottlieb Steen & Hamilton, Freshfields Bruckhaus Deringer, Hogan Lovells, Steptoe \u2014 lead treaty and sanctions practices', confidence: 0.90 },
        { type: 'Diplomatic translation / interpretation service', reason: 'TransPerfect Government, Lionbridge Government, RWS Holdings, Acolad Group, SDL Government \u2014 cleared linguists for State Department and DoD', confidence: 0.82 },
        { type: 'Multilateral institution support contractor', reason: 'Chemonics International, DAI Global, Tetra Tech ARD, Abt Associates, Palladium Group support USAID, World Bank, UN agency operations', confidence: 0.85 },
        { type: 'Sanctions / export controls compliance firm', reason: 'FTI Consulting sanctions practice, Kroll (Duff & Phelps), K2 Integrity, Berkeley Research Group, AlixPartners advise on OFAC and BIS exposure', confidence: 0.85 },
        { type: 'International arbitration / treaty practice', reason: 'King & Spalding international arbitration, Arnold & Porter, Curtis Mallet-Prevost, Three Crowns LLP \u2014 represent states and corporates in ICSID and UNCITRAL', confidence: 0.82 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Institutional Memory & Records', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes and consolidates episodic memory for long-term retrieval.', inBusiness: 'In governance, institutional memory and records is the long-term archive of what the state did, why, and what it learned \u2014 the source of continuity across administrations.' },
      function: 'Stores and retrieves institutional memory: records, archives, lessons learned',
      dysregulation: 'Records destroyed, knowledge loss across administrations, lessons unlearned, archives defunded',
      expectedTypes: [
        { type: 'Government records management vendor', reason: 'Iron Mountain Government, Microsoft Records Management for gov, Hyland Government', confidence: 0.85 },
        { type: 'National Archives / records consultancy', reason: 'Gimmal records management, AvePoint Public Sector, Iron Mountain Federal records advisory, Hyland OnBase records, Active Navigation (Lighthouse Global) \u2014 advise NARA-bound federal records programs and Capstone email retention', confidence: 0.78 },
        { type: 'Government knowledge management platform', reason: 'KMS Lighthouse, eGain Public Sector, ServiceNow Knowledge', confidence: 0.78 },
        { type: 'Federal data archival vendor', reason: 'FedRAMP-authorized cloud archival providers', confidence: 0.78 }
      ]
    },
    'SN': {
      fullName: 'Salience Network', label: 'Political Risk Detection & Triage', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects what matters most across competing signals.', inBusiness: 'In governance, political risk detection and triage is the work of figuring out which crisis, scandal, or shift actually matters and which is noise.' },
      function: 'Detects salient political risks, scandals, and shifts that demand executive attention',
      dysregulation: 'Crisis blindness, signal-to-noise failure, scandal cascade, missed early warnings',
      expectedTypes: [
        { type: 'Political risk consultancy', reason: 'Eurasia Group, Control Risks, RANE Network, Teneo, Hakluyt, Maplecroft, Stratfor (RANE), Oxford Analytica', confidence: 0.92 },
        { type: 'Government affairs intelligence platform', reason: 'Bloomberg Government, FiscalNote, Quorum, Capitol Canary, Phone2Action, POLITICO Pro feed real-time legislative and regulatory signal', confidence: 0.90 },
        { type: 'Crisis monitoring / social listening for officials', reason: 'Brandwatch (Cision), Meltwater Government, Zignal Labs, NewsWhip, Cision PR Newswire \u2014 monitor narrative shifts and reputational threats', confidence: 0.82 },
        { type: 'OSINT / open-source intelligence vendor', reason: 'Recorded Future, Sayari, Babel Street, Flashpoint, Janes \u2014 surface political signal from public-facing sources', confidence: 0.85 },
        { type: 'Political risk insurance / advisory', reason: 'Aon Political Risk, Marsh Crisis Management, Willis Towers Watson Political Risk \u2014 monetize the risk via insurance instruments', confidence: 0.82 }
      ]
    },
    'FG': {
      fullName: 'Fusiform Gyrus', label: 'Identity Verification & Election Authentication', tier: 'top',
      neuroTranslation: { inNeurology: 'Specializes in recognizing faces, objects, and complex visual patterns.', inBusiness: 'In governance, identity verification and election authentication is the work of confirming who is voting, who is signing, and who has authority \u2014 the trust layer of government.' },
      function: 'Verifies identity and authenticity for voting, government services, and official actions',
      dysregulation: 'Voter ID disputes, identity fraud, credential forgery, biometric overreach',
      expectedTypes: [
        { type: 'Government identity verification vendor', reason: 'ID.me, Login.gov (GSA TTS), Idemia (formerly Morpho / OT-Morpho), CLEAR Secure (YOU), Mitek Systems, Onfido, Jumio Government', confidence: 0.92 },
        { type: 'Election security / authentication vendor', reason: 'ES&S, Dominion Voting Systems, Hart InterCivic, Smartmatic, Clear Ballot, Microvote \u2014 the U.S. voting equipment universe', confidence: 0.90 },
        { type: 'Biometric / credentialing prime', reason: 'Thales Group, IDEMIA, NEC Corporation, Leidos Trusted Identity Group, Idemia I&S North America \u2014 biometric capture and PIV/CAC issuance for federal workforce', confidence: 0.85 },
        { type: 'Federal PKI / digital signature vendor', reason: 'Entrust Federal, DigiCert Federal, Sectigo Federal, IdenTrust, OneSpan (Vasco) \u2014 issue and manage federal PKI certificates', confidence: 0.82 },
        { type: 'Voter registration and verification platform', reason: 'BallotReady, Rock the Vote, TurboVote (Democracy Works), VoteAmerica, Vote.org \u2014 the civic-tech identity layer for voter registration', confidence: 0.78 }
      ]
    },

    // ── GOVERNANCE-OPERATIONAL NODES (83) — 2 business types each ──
    'A1':        { fullName: 'Primary Auditory Cortex', label: 'Public Hearings and Listening Sessions', tier: 'operational', function: 'Operates public hearings, listening sessions, and audio public input', dysregulation: 'Token hearings', expectedTypes: [{ type: 'Hearing transcription / captioning vendor', reason: 'Veritext Federal Government, eScribers, JAVS (Justice AV Solutions), Verbit Federal, FTR Gold (For the Record) provide hearing transcription and captioning to federal and state legislatures', confidence: 0.82 }, { type: 'Public-input platform', reason: 'Granicus PublicInput, Bang the Table (Granicus), CitizenLab, Consul Democracy, Tyler Public Input host structured listening sessions for elected bodies', confidence: 0.80 }] },
    'ADR':       { fullName: 'Adrenal', label: 'Crisis Response Surge Capacity', tier: 'operational', function: 'Provides surge capacity for governance crisis response', dysregulation: 'Crisis fatigue', expectedTypes: [{ type: 'Crisis management consultancy', reason: 'Witt O\u2019Brien\u2019s, IEM (Innovative Emergency Management), Tetra Tech Disaster Response, Hagerty Consulting, AC Disaster Consulting, ICF Emergency Management & Resilience \u2014 surge under FEMA Public Assistance and IMAT activations', confidence: 0.88 }] },
    'AI':        { fullName: 'Anterior Insula', label: 'Risk Triage for Officials', tier: 'operational', function: 'Triages risk signals for elected officials and senior civil servants', dysregulation: 'Risk blindness', expectedTypes: [{ type: 'Political risk triage platform', reason: 'Bloomberg Government Risk Dashboard, FiscalNote Risk Connect, Quorum Federal Tracker, Capitol Canary, POLITICO Pro Intelligence \u2014 used by congressional staff and senior agency officials to triage emerging risks', confidence: 0.85 }] },
    'ANT':       { fullName: 'Anterior Thalamus', label: 'Briefing and Attention Routing', tier: 'operational', function: 'Routes briefings and high-priority items to officials', dysregulation: 'Briefing overload', expectedTypes: [{ type: 'Daily briefing / news intelligence platform', reason: 'POLITICO Pro Morning Briefings, Axios Pro Policy, Bloomberg Government Today, FiscalNote Brief, National Journal Daybook, The Daily Beast Cheat Sheet \u2014 the daily-briefing universe for elected officials and agency leadership', confidence: 0.85 }] },
    'ARC':       { fullName: 'Arcuate Fasciculus', label: 'Speech-to-Text for Government Records', tier: 'operational', function: 'Bridges spoken and written government records', dysregulation: 'Transcription gap', expectedTypes: [{ type: 'Government speech-to-text and transcription vendor', reason: 'Verbit Federal, Otter.ai Government, Rev Government, 3Play Media Government, AppTek Federal, JAVS, Veritext Federal \u2014 transcribe federal hearings, depositions, and agency proceedings under FedRAMP-aligned contracts', confidence: 0.85 }] },
    'BDNF':      { fullName: 'Brain-Derived Neurotrophic Factor', label: 'Public Service Training Pipeline', tier: 'operational', function: 'Trains civil servants and political appointees', dysregulation: 'Skill atrophy', expectedTypes: [{ type: 'Civil service training institution', reason: 'Federal Executive Institute (OPM), Graduate School USA, Brookings Executive Education, Harvard Kennedy School Executive Education, Princeton SPIA Executive Programs, Georgetown McCourt Executive Programs', confidence: 0.85 }, { type: 'Government leadership development firm', reason: 'Partnership for Public Service Center for Government Leadership, Senior Executives Association, Council for Excellence in Government, Government Executive Group leadership programs', confidence: 0.80 }] },
    'BLA':       { fullName: 'Basolateral Amygdala', label: 'Threat Pattern Memory', tier: 'operational', function: 'Maintains memory of past political threats and scandals', dysregulation: 'Historical blindness', expectedTypes: [{ type: 'Political archive and pattern analysis', reason: 'OpenSecrets (Center for Responsive Politics), FollowTheMoney (National Institute on Money in Politics), Center for Public Integrity, ProPublica Represent, Sunlight Foundation alumni datasets \u2014 the historical record of political behavior', confidence: 0.82 }] },
    'BNST':      { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Slow-Burn Reputation Monitoring', tier: 'operational', function: 'Monitors slow-burn reputational decay for officials and agencies', dysregulation: 'Slow erosion missed', expectedTypes: [{ type: 'Long-term institutional trust monitoring', reason: 'Edelman Trust Barometer, Pew Research Center Trust Surveys, Gallup Confidence in Institutions, Morning Consult Government Tracker, Ipsos Public Affairs trust panels \u2014 the longitudinal datasets used to detect reputational drift before it becomes a crisis', confidence: 0.85 }] },
    'CARD':      { fullName: 'Cardiovascular System', label: 'Government Network Heartbeat', tier: 'operational', function: 'Provides uptime and heartbeat monitoring for government networks', dysregulation: 'Network outage', expectedTypes: [{ type: 'Federal IT and network observability vendor', reason: 'Splunk Federal (Cisco), Datadog Federal, Dynatrace Government, New Relic Federal, SolarWinds Government, Cisco AppDynamics Federal \u2014 monitor federal network and application uptime under FedRAMP authorization', confidence: 0.85 }] },
    'CBLM':      { fullName: 'Cerebellum (whole)', label: 'Fine Policy Drafting Refinement', tier: 'operational', function: 'Refines policy and statute language for precision', dysregulation: 'Drafting errors', expectedTypes: [{ type: 'Legislative drafting and regulatory practice', reason: 'Hogan Lovells legislative practice, Holland & Knight legislative drafting, Akin Gump legislative, K&L Gates regulatory, Ballard Spahr public finance and legislation, Office of the Legislative Counsel (House and Senate)', confidence: 0.85 }] },
    'CC':        { fullName: 'Corpus Callosum', label: 'Federal-State-Local Integration', tier: 'operational', function: 'Integrates across federal, state, and local government layers', dysregulation: 'Federalism friction', expectedTypes: [{ type: 'Intergovernmental relations practice', reason: 'PFM Group intergovernmental advisory, Booz Allen State and Local Government, Deloitte State and Local, KPMG State Government, Council of State Governments consulting, NACo (National Association of Counties), NCSL consulting', confidence: 0.85 }] },
    'CING':      { fullName: 'Cingulate Cortex (general)', label: 'Government Conflict Resolution', tier: 'operational', function: 'Resolves internal government disputes and inter-agency conflict', dysregulation: 'Turf wars', expectedTypes: [{ type: 'Federal mediation and ADR service', reason: 'Federal Mediation and Conciliation Service (FMCS), JAMS Government, American Arbitration Association Government, Resolution Systems Institute, Cornerstone Research \u2014 mediate inter-agency, labor-management, and contracting disputes', confidence: 0.80 }] },
    'CLAUST':    { fullName: 'Claustrum', label: 'Cross-Source Government Correlation', tier: 'operational', function: 'Correlates events across government data sources', dysregulation: 'Stovepipe data', expectedTypes: [{ type: 'Government data integration platform', reason: 'Palantir Foundry Public Sector, Snowflake Government, Databricks Federal, Informatica Government, Microsoft Fabric Government, Cloudera Government, Starburst Federal \u2014 cross-source data correlation across federal data lakes and stovepiped systems', confidence: 0.88 }] },
    'CMZ':       { fullName: 'Central Midbrain Zone', label: 'Government Alert and DEFCON Posture', tier: 'operational', function: 'Manages government alert posture and emergency declarations', dysregulation: 'Alert fatigue', expectedTypes: [{ type: 'Emergency declaration and posture management', reason: 'Everbridge Visual Command Center, OnSolve CodeRED, AtHoc (BlackBerry), Rave Mobile Safety, Juvare WebEOC \u2014 systems-of-record for federal, state, and local emergency declarations and FPCON-style posture changes', confidence: 0.85 }] },
    'CON':       { fullName: 'Cingulo-opercular Network', label: 'Sustained Program Management', tier: 'operational', function: 'Sustains long-running federal programs across administrations', dysregulation: 'Program drift', expectedTypes: [{ type: 'Federal program sustainment prime', reason: 'Leidos sustainment, ManTech long-term federal programs, SAIC Sustained Operations, CACI Mission Support, GDIT Federal Civilian, Booz Allen Sustained Programs \u2014 multi-administration program continuity', confidence: 0.85 }] },
    'DAN':       { fullName: 'Dorsal Attention Network', label: 'Goal-Directed Policy Focus', tier: 'operational', function: 'Directs government attention toward stated policy goals', dysregulation: 'Distraction', expectedTypes: [{ type: 'Government goal tracking and OKR platform', reason: 'ServiceNow Strategic Portfolio Management Government, Workboard Federal, Profit.co Government, Performance.gov tools, Microsoft Viva Goals Government \u2014 the rails for tracking presidential, cabinet-level, and gubernatorial priority goals', confidence: 0.82 }] },
    'DISS':      { fullName: 'Dissociation', label: 'Government Wargaming and Tabletops', tier: 'operational', function: 'Runs wargames and tabletops for government decision-makers', dysregulation: 'Untested response plans', expectedTypes: [{ type: 'Government wargaming / tabletop service', reason: 'CSIS Wargaming, RAND Center for Gaming, Booz Allen Wargaming, MITRE Wargaming Center, Center for Naval Analyses (CNA), Institute for Defense Analyses (IDA), Atlantic Council Scowcroft Center wargames', confidence: 0.88 }] },
    'DV':        { fullName: 'Dorsal Vagal Complex', label: 'Program Sunset and Deactivation', tier: 'operational', function: 'Handles graceful sunset of expired government programs', dysregulation: 'Zombie programs', expectedTypes: [{ type: 'Federal program closeout consultancy', reason: 'Booz Allen program closeout, Deloitte Government Program Transition, Guidehouse Program Sunset, Grant Thornton Public Sector wind-down, BDO USA Public Sector closeout \u2014 the firms that handle graceful program termination and rescission management', confidence: 0.82 }] },
    'EC':        { fullName: 'Entorhinal Cortex', label: 'Policy Context Indexing', tier: 'operational', function: 'Indexes policy context for retrieval by analysts', dysregulation: 'Stale context', expectedTypes: [{ type: 'Policy research database', reason: 'Westlaw Edge (Thomson Reuters), LexisNexis Government, Bloomberg Law, HeinOnline Government, ProQuest Congressional, CQ Researcher (FiscalNote), Wolters Kluwer Cheetah \u2014 the policy and legal research databases used by federal analysts and congressional staff', confidence: 0.85 }] },
    'EI':        { fullName: 'Excitatory/Inhibitory Balance', label: 'Regulatory Balance', tier: 'operational', function: 'Balances regulatory action with regulatory restraint', dysregulation: 'Over- or under-regulation', expectedTypes: [{ type: 'Regulatory impact analysis (RIA) provider', reason: 'Resources for the Future, Mercatus Center Regulatory Studies, MITRE Center for Regulatory Sciences, RAND Center for Regulatory Analysis, Industrial Economics Inc., Eastern Research Group \u2014 contracted by OIRA, EPA, DOT, DOE for RIAs', confidence: 0.82 }] },
    'EMP':       { fullName: 'Empathy Circuit', label: 'Empathic Constituent Service', tier: 'operational', function: 'Helps officials engage constituents with empathy', dysregulation: 'Out of touch officials', expectedTypes: [{ type: 'Constituent service training and certification', reason: 'Congressional Management Foundation, Partnership for Public Service, Government Affairs Institute (Georgetown), Senior Executives Association, Brookings Executive Education \u2014 train congressional and agency staff in constituent engagement', confidence: 0.82 }] },
    'ENDO':      { fullName: 'Endocrine System', label: 'Scheduled Government Cycles', tier: 'operational', function: 'Manages scheduled government cycles (budget, election, congress)', dysregulation: 'Schedule slip', expectedTypes: [{ type: 'Legislative calendar and budget cycle platform', reason: 'Bloomberg Government Calendar, FiscalNote Issue Management, POLITICO Pro Calendars, Quorum Federal Calendar, Capitol Canary scheduling, National Journal Daybook \u2014 track Congress, executive, and budget cycle timing', confidence: 0.82 }] },
    'ENS':       { fullName: 'Enteric Nervous System', label: 'Autonomous Agency Operations', tier: 'operational', function: 'Operates autonomous agencies that run without daily political direction', dysregulation: 'Agency drift', expectedTypes: [{ type: 'Independent agency support contractor', reason: 'MITRE FFRDC support to FTC and FCC, ICF Independent Agency Practice, Booz Allen Independent Agency Support, Eastern Research Group regulatory science, ASR Analytics for SEC \u2014 operate inside independent regulatory agencies', confidence: 0.82 }] },
    'FEF':       { fullName: 'Frontal Eye Field', label: 'Attention Routing for Officials', tier: 'operational', function: 'Routes official attention to high-priority items', dysregulation: 'Attention overload', expectedTypes: [{ type: 'Daily briefing and intelligence platform', reason: 'Bloomberg Government Today, POLITICO Playbook / Pro, Axios AM / Pro, FiscalNote Brief, Punchbowl News, National Journal Hotline \u2014 the daily intel funnel for senior officials', confidence: 0.85 }] },
    'FORN':      { fullName: 'Fornix', label: 'Policy Knowledge Pipelines', tier: 'operational', function: 'Moves policy knowledge between research and practice', dysregulation: 'Research-policy gap', expectedTypes: [{ type: 'Policy knowledge transfer program', reason: 'AAAS Science and Technology Policy Fellowships, Presidential Innovation Fellows (GSA TTS), TechCongress fellows, Day One Project (FAS), American Political Science Association Congressional Fellowship, Brookings LEGIS Fellowship', confidence: 0.82 }] },
    'GABA_GLU':  { fullName: 'GABA / Glutamate Balance', label: 'Government Capacity Throttling', tier: 'operational', function: 'Balances government capacity with civic society oversight', dysregulation: 'State overreach', expectedTypes: [{ type: 'Civic oversight NGO', reason: 'Project on Government Oversight (POGO), Citizens for Responsibility and Ethics in Washington (CREW), Common Cause, Public Citizen, Government Accountability Project, Open the Government coalition \u2014 the firms that throttle state overreach via accountability work', confidence: 0.85 }] },
    'GBA':       { fullName: 'Gut-Brain Axis', label: 'Field Feedback to Policy', tier: 'operational', function: 'Maintains feedback from field implementation back to policymakers', dysregulation: 'Policy-practice gap', expectedTypes: [{ type: 'Implementation research / policy evaluation firm', reason: 'Mathematica Policy Research, MDRC, Abt Associates, Westat, Urban Institute, MEF Associates, Insight Policy Research, ICF International \u2014 the federal evaluation contractor universe that closes the loop from field to policy', confidence: 0.88 }] },
    'GP':        { fullName: 'Globus Pallidus', label: 'Policy Approval Gating', tier: 'operational', function: 'Gates policy through approval and review processes', dysregulation: 'Approval bypass', expectedTypes: [{ type: 'Federal rulemaking and review workflow', reason: 'Reginfo.gov OIRA review queue, Regulations.gov (GSA-managed), Federal Register electronic submission system, eCFR.gov, Hyland OnBase Government rulemaking workflow \u2014 the technical rails of OIRA / OMB review', confidence: 0.80 }] },
    'HAB':       { fullName: 'Habenula', label: 'Failure Signal Propagation', tier: 'operational', function: 'Propagates failure signals through government', dysregulation: 'Repeat failures', expectedTypes: [{ type: 'Oversight findings tracking platform', reason: 'Oversight.gov (CIGIE), GAO Watchdog Reports portal, GovExec Daily, Federal News Network, MuckRock IG tracker, POGO Federal Contractor Misconduct Database \u2014 the public surface where IG / GAO findings get propagated', confidence: 0.82 }] },
    'HPA':       { fullName: 'HPA Axis', label: 'Multi-Tier Government Crisis Escalation', tier: 'operational', function: 'Manages multi-tier crisis escalation across government levels', dysregulation: 'Escalation gap', expectedTypes: [{ type: 'Federal crisis escalation and continuity platform', reason: 'Juvare WebEOC, Everbridge Crisis Management, Witt O\u2019Brien\u2019s COG support, Constellis crisis services, ICF Continuity, Booz Allen Continuity Services \u2014 escalation rails between agencies and the National Operations Center', confidence: 0.82 }] },
    'HYPO':      { fullName: 'Hypothalamus', label: 'Government Homeostasis Controller', tier: 'operational', function: 'Maintains baseline government operations under varying conditions', dysregulation: 'Drift from baseline', expectedTypes: [{ type: 'Federal IT operations and observability', reason: 'ServiceNow IT Operations Management Government, Splunk Federal IT Service Intelligence, Datadog Federal, Dynatrace Government, BigPanda Federal \u2014 baseline IT homeostasis monitoring under FedRAMP authorization', confidence: 0.82 }] },
    'IC':        { fullName: 'Inferior Colliculus', label: 'Government Audio Stream Routing', tier: 'operational', function: 'Routes audio streams (hearings, briefings) to processing systems', dysregulation: 'Audio loss', expectedTypes: [{ type: 'Government broadcast / streaming infrastructure', reason: 'C-SPAN, Granicus Government Streaming, Swagit Productions, NEP Group Government, Tightrope Media Cablecast, Tyler Boards & Commissions streaming \u2014 the live and archived broadcast infrastructure for legislatures and councils', confidence: 0.82 }] },
    'IPS':       { fullName: 'Intraparietal Sulcus', label: 'Government Data Engineering', tier: 'operational', function: 'Runs government data engineering and analytics infrastructure', dysregulation: 'Data pipeline failure', expectedTypes: [{ type: 'Government data engineering platform', reason: 'Snowflake Government, Databricks Federal, Palantir Foundry Public Sector, AWS GovCloud Glue / Redshift, Microsoft Fabric Government, Google Cloud Public Sector BigQuery, Cloudera Government \u2014 federal data engineering and analytics under FedRAMP High', confidence: 0.90 }] },
    'LAR':       { fullName: 'Laryngeal Cortex', label: 'Government Spokesperson Operations', tier: 'operational', function: 'Manages official government spokesperson operations', dysregulation: 'Off-message statements', expectedTypes: [{ type: 'Federal public affairs / strategic communications firm', reason: 'Edelman Public Affairs, BCW Government, Hill+Knowlton Strategies Government, Ketchum Government, FleishmanHillard Public Affairs, Kivvit, SKDK Government \u2014 staff federal agency comms shops and political crisis response', confidence: 0.85 }] },
    'LC':        { fullName: 'Locus Coeruleus', label: 'Global Government Alerting', tier: 'operational', function: 'Broadcasts government-wide alerts and emergency notifications', dysregulation: 'Alert overload', expectedTypes: [{ type: 'Government emergency notification platform', reason: 'Everbridge Mass Notification (powers IPAWS feeds), OnSolve CodeRED, Rave Mobile Safety, AtHoc (BlackBerry), Singlewire InformaCast, Alertus, Motorola Solutions WAVE PTX \u2014 the federal and state mass-notification universe', confidence: 0.88 }] },
    'LGN':       { fullName: 'Lateral Geniculate Nucleus', label: 'Visual Intel for Government', tier: 'operational', function: 'Processes visual streams for government use (security camera, satellite)', dysregulation: 'Visual blind spots', expectedTypes: [{ type: 'Government video and surveillance infrastructure', reason: 'Axis Communications Government, Avigilon (Motorola Solutions), Verkada Government, Pelco (Motorola), Genetec Federal, Hanwha Vision Government, Convergint Federal \u2014 federal building, perimeter, and infrastructure surveillance', confidence: 0.85 }] },
    'M1':        { fullName: 'Primary Motor Cortex', label: 'Government Action Execution', tier: 'operational', function: 'Executes government actions (sign bills, issue orders, deploy resources)', dysregulation: 'Failed execution', expectedTypes: [{ type: 'Federal program execution consultancy', reason: 'Booz Allen Hamilton Delivery, Deloitte Government & Public Services Delivery Transformation, McKinsey Public Sector Delivery, Bain Government delivery, Guidehouse Federal Delivery, Accenture Federal Services execution \u2014 the firms that actually carry out signed orders', confidence: 0.88 }] },
    'MAMM':      { fullName: 'Mammillary Bodies', label: 'Long-Term Government Archive', tier: 'operational', function: 'Archives long-term government records and historical files', dysregulation: 'Archive loss', expectedTypes: [{ type: 'Federal records and archive management vendor', reason: 'Iron Mountain Government Services (IRM), Hyland Government Records, OpenText Public Sector, IBM Public Sector records, GovCIO records, Microsoft Purview Government \u2014 hold federal records under NARA retention schedules', confidence: 0.85 }] },
    'MDT':       { fullName: 'Mediodorsal Thalamus', label: 'Decision Gating for Officials', tier: 'operational', function: 'Gates decisions for officials through staff review', dysregulation: 'Bypass of staff review', expectedTypes: [{ type: 'Decision support and briefing platform for officials', reason: 'Bloomberg Government Decision Pro, FiscalNote Issue Management, Quorum Federal Briefing Tools, Capitol Canary Decision Support, POLITICO Pro Intelligence \u2014 the staff-prepared briefing memo and decision-package layer for senior officials', confidence: 0.82 }] },
    'MGN':       { fullName: 'Medial Geniculate Nucleus', label: 'Audio Routing for Hearings', tier: 'operational', function: 'Routes audio from hearings to recording and transcription', dysregulation: 'Audio pipeline failure', expectedTypes: [{ type: 'Hearing audio capture and routing system', reason: 'JAVS (Justice AV Solutions), FTR Gold (For the Record), Liberty Court Recorder (BIS Digital), Wolfvision Government, Crestron Government, Shure Federal \u2014 deployed in federal courtrooms and Congressional hearing rooms', confidence: 0.82 }] },
    'MICRO':     { fullName: 'Microglia', label: 'Government Vulnerability Patching', tier: 'operational', function: 'Patches vulnerabilities in government IT systems', dysregulation: 'Unpatched vulnerabilities', expectedTypes: [{ type: 'Federal vulnerability management vendor', reason: 'Tenable Federal (Nessus), Qualys Federal, Rapid7 Federal (InsightVM), Microsoft Defender Vulnerability Management Government, ServiceNow Vulnerability Response Government, BigFix (HCL) Federal \u2014 deployed against CISA Known Exploited Vulnerabilities and BOD 22-01 mandates', confidence: 0.90 }] },
    'NBM':       { fullName: 'Nucleus Basalis of Meynert', label: 'Government Cadence Management', tier: 'operational', function: 'Sets and sustains government operational cadence', dysregulation: 'Cadence collapse', expectedTypes: [{ type: 'Government performance management platform', reason: 'Performance.gov, ServiceNow Strategic Portfolio Management Government, Workboard Federal, Profit.co Government, Microsoft Viva Goals Government, OpenGov Strategy & Performance \u2014 the rails for OMB-driven priority goals and agency operating cadence', confidence: 0.82 }] },
    'NEOCER':    { fullName: 'Neocerebellum', label: 'Fine Policy Tuning', tier: 'operational', function: 'Fine-tunes policy implementation through prediction-error correction', dysregulation: 'Policy implementation drift', expectedTypes: [{ type: 'Implementation refinement and rapid evaluation firm', reason: 'MDRC, Mathematica Policy Research, Abt Associates, Westat, MEF Associates, Insight Policy Research \u2014 conduct field studies that catch implementation drift early and feed correction loops back to program offices', confidence: 0.85 }] },
    'NTS':       { fullName: 'Nucleus Tractus Solitarius', label: 'Government Telemetry Aggregation', tier: 'operational', function: 'Aggregates telemetry from across government operations', dysregulation: 'Telemetry blind spots', expectedTypes: [{ type: 'Government data and BI dashboard platform', reason: 'Tableau Government (Salesforce), Microsoft Power BI Government, Qlik Government, Looker Government (Google Cloud), Domo Government, ServiceNow Performance Analytics Government \u2014 power Performance.gov-style telemetry rollups', confidence: 0.85 }] },
    'OLF':       { fullName: 'Olfactory System', label: 'Anomaly Detection in Government Data', tier: 'operational', function: 'Detects subtle anomalies in government data', dysregulation: 'Fraud missed', expectedTypes: [{ type: 'Federal fraud and anomaly detection platform', reason: 'Pondera Solutions (Thomson Reuters), SAS Fraud Federal, NICE Actimize Federal, LexisNexis Risk Government, Verisk Government, FICO Federal Decision Management \u2014 surface improper payments, fraud, and anomalies for IG and program integrity teams', confidence: 0.88 }] },
    'OPIOID':    { fullName: 'Opioid System', label: 'Citizen Comfort and Wellbeing Programs', tier: 'operational', function: 'Provides citizen wellbeing programs that build trust and connection', dysregulation: 'Citizen alienation', expectedTypes: [{ type: 'Citizen experience (CX) consultancy', reason: 'Forrester Public Sector CX, McKinsey Customer Experience Government, Deloitte Government Customer Experience, Accenture Federal Customer Experience, Nava PBC, Ad Hoc LLC, Skylight \u2014 the modern federal CX practice', confidence: 0.85 }] },
    'OSC':       { fullName: 'Neural Oscillators', label: 'Government Schedule Synchronization', tier: 'operational', function: 'Synchronizes legislative, executive, and judicial schedules', dysregulation: 'Schedule conflict', expectedTypes: [{ type: 'Government scheduling and coordination platform', reason: 'Bloomberg Government Calendar, Quorum Government Calendar, FiscalNote Issue Calendar, POLITICO Pro Calendars, Capitol Canary scheduling, Microsoft Bookings Government \u2014 align congressional, executive, and judicial calendars across stakeholders', confidence: 0.78 }] },
    'OXY':       { fullName: 'Oxytocin System', label: 'Public Trust and Civic Bond', tier: 'operational', function: 'Builds public trust and civic bond between government and citizens', dysregulation: 'Trust collapse', expectedTypes: [{ type: 'Civic trust measurement and panel research', reason: 'Pew Research Center, Edelman Trust Barometer, Gallup Confidence in Institutions, Morning Consult Government Tracker, Ipsos Public Affairs, SSRS Omnibus, NORC AmeriSpeak Government \u2014 longitudinal panels and trust indices for federal and state institutions', confidence: 0.85 }] },
    'PAG':       { fullName: 'Periaqueductal Gray', label: 'Emergency Lockdown Authorities', tier: 'operational', function: 'Triggers emergency lockdown and special authorities', dysregulation: 'Authority abuse', expectedTypes: [{ type: 'Emergency authorities and national security legal practice', reason: 'Hogan Lovells emergency powers practice, Steptoe National Security, Covington & Burling National Security, Akin Gump national security, Williams & Connolly emergency authorities \u2014 advise agencies and corporates on emergency declarations and DPA invocation', confidence: 0.85 }] },
    'PBN':       { fullName: 'Parabrachial Nucleus', label: 'Government Capacity Signaling', tier: 'operational', function: 'Signals government capacity constraints to political leadership', dysregulation: 'Silent overload', expectedTypes: [{ type: 'Federal workforce capacity and HCM platform', reason: 'OPM USAJOBS, Workday Government, Oracle HCM Cloud Federal, SAP SuccessFactors Government, ServiceNow HR Service Delivery Government \u2014 surface federal workforce capacity, vacancy, and burnout metrics', confidence: 0.82 }] },
    'PCC':       { fullName: 'Posterior Cingulate Cortex', label: 'Retrospective Government Analytics', tier: 'operational', function: 'Provides retrospective analytics on government performance', dysregulation: 'Historical blindness', expectedTypes: [{ type: 'Federal program evaluation and impact analysis firm', reason: 'Mathematica Policy Research, MDRC, Abt Associates, Westat, Urban Institute, ICF International, MEF Associates, RAND Corporation \u2014 prime contractors for OMB Evidence Act evaluations', confidence: 0.88 }] },
    'PI':        { fullName: 'Posterior Insula', label: 'Government Internal State Monitoring', tier: 'operational', function: 'Monitors government internal state (workforce, morale)', dysregulation: 'Workforce burnout', expectedTypes: [{ type: 'Federal employee engagement / survey platform', reason: 'OPM FEVS implementation contractors (Eagle Hill Consulting, ICF Survey Research), Qualtrics Government, Medallia Government, Glint (Microsoft) Government \u2014 administer FEVS, Best Places to Work, and pulse surveys for federal workforces', confidence: 0.82 }] },
    'PIN':       { fullName: 'Pineal Gland', label: 'Scheduled Government Operations', tier: 'operational', function: 'Runs scheduled government operations (budget cycle, fiscal year)', dysregulation: 'Schedule slip', expectedTypes: [{ type: 'Federal financial management platform', reason: 'CGI Momentum Federal Financials, Workday Federal Financial Management, Oracle Federal Financials Cloud, SAP S/4HANA Public Sector, Unison PRISM \u2014 the systems-of-record for federal fiscal year budget execution and apportionment', confidence: 0.85 }] },
    'PIT':       { fullName: 'Pituitary Gland', label: 'Official Order Broadcast', tier: 'operational', function: 'Broadcasts executive orders and official directives', dysregulation: 'Order miscommunication', expectedTypes: [{ type: 'Executive order and directive tracking platform', reason: 'Bloomberg Government Executive Action Tracker, FiscalNote Executive Order database, POLITICO Pro Executive Branch, White House Federal Register feeds, Quorum Federal Action Center \u2014 the EO and presidential memorandum dissemination layer', confidence: 0.82 }] },
    'PPN':       { fullName: 'Pedunculopontine Nucleus', label: 'Continuous Government Operations', tier: 'operational', function: 'Maintains continuous government operations across crises', dysregulation: 'Operations failure', expectedTypes: [{ type: 'Continuity of operations (COOP) consultancy', reason: 'Witt O\u2019Brien\u2019s COOP, Booz Allen Continuity Services, ICF Continuity & Resilience, Hagerty Consulting COOP, Constellis crisis services, Tetra Tech Continuity \u2014 author and exercise federal COOP / COG plans for FEMA Federal Continuity Directives 1 and 2', confidence: 0.88 }] },
    'PRECUNEUS': { fullName: 'Precuneus', label: 'Government Self-Reflection and Analytics', tier: 'operational', function: 'Provides self-reflective analytics on government behavior', dysregulation: 'Self-awareness gap', expectedTypes: [{ type: 'Government transparency and performance dashboard', reason: 'Performance.gov, USAspending.gov, OpenGov Citizen Engagement, Tableau Government public dashboards, Socrata (Tyler Technologies) open data \u2014 the public-facing self-reflective layer of federal performance', confidence: 0.85 }] },
    'PULV':      { fullName: 'Pulvinar', label: 'Critical Issue Attention Weighting', tier: 'operational', function: 'Weights government attention by issue criticality', dysregulation: 'Critical issues missed', expectedTypes: [{ type: 'Government issue prioritization and case management', reason: 'ServiceNow Customer Service Management Government, Pegasystems Government Case Management, Salesforce Government Cloud Case, Hyland OnBase Public Sector, Microsoft Dynamics 365 Government \u2014 prioritize and route critical agency cases', confidence: 0.82 }] },
    'PUT':       { fullName: 'Putamen', label: 'Habit-Formed Bureaucratic Routines', tier: 'operational', function: 'Reinforces habitual bureaucratic routines through repetition', dysregulation: 'Routine rot', expectedTypes: [{ type: 'Government process improvement / Lean firm', reason: 'Booz Allen Process Improvement, Deloitte Government Operational Excellence, Accenture Federal Process Excellence, KPMG Government Lean Six Sigma, Guidehouse Federal Process Optimization \u2014 streamline bureaucratic routines via Lean / Six Sigma engagements', confidence: 0.85 }] },
    'RAPHE':     { fullName: 'Raphe Nuclei', label: 'Government Tone and Mood Regulation', tier: 'operational', function: 'Regulates the tone of government communications', dysregulation: 'Tone-deaf comms', expectedTypes: [{ type: 'Strategic communications training and framing', reason: 'Spitfire Strategies, FrameWorks Institute, Public Affairs Council training, National Association of Government Communicators (NAGC), Plain Language Action and Information Network (PLAIN) \u2014 train federal communicators on tone, framing, and audience', confidence: 0.80 }] },
    'RF':        { fullName: 'Reticular Formation', label: 'Wake-from-Idle Government Activation', tier: 'operational', function: 'Wakes inactive government programs into action', dysregulation: 'Activation lag', expectedTypes: [{ type: 'Federal program startup and digital services unit', reason: 'U.S. Digital Service (USDS), 18F (GSA TTS), Nava PBC, Skylight, Ad Hoc LLC, Booz Allen Program Activation, Deloitte Government Stand-up \u2014 the firms and federal teams that stand up new programs in weeks rather than years', confidence: 0.85 }] },
    'RSC':       { fullName: 'Retrosplenial Cortex', label: 'Government Geographic Mapping', tier: 'operational', function: 'Maps geographic distribution of government services and impacts', dysregulation: 'Geographic blind spots', expectedTypes: [{ type: 'Government GIS platform', reason: 'Esri ArcGIS Government, Hexagon Geospatial Government, Trimble Government Geospatial (TRMB), Maxar Government, Carto Government, Mapbox Government, Google Cloud Public Sector Maps Platform \u2014 federal, state, and local geospatial platforms', confidence: 0.88 }] },
    'S1':        { fullName: 'Primary Somatosensory Cortex', label: 'Citizen Telemetry and Service Sensing', tier: 'operational', function: 'Collects telemetry on citizen service delivery', dysregulation: 'Service blind spots', expectedTypes: [{ type: 'Citizen experience analytics platform', reason: 'Medallia Government, Qualtrics Government, Verint ForeSee Government, Microsoft Customer Voice Government, Salesforce Service Cloud Government, Granicus Citizen Experience \u2014 the federal CX measurement layer required by OMB Circular A-11 Section 280', confidence: 0.85 }] },
    'SC':        { fullName: 'Superior Colliculus', label: 'Orient-to-Crisis Government Dashboards', tier: 'operational', function: 'Orients government attention to new crises rapidly', dysregulation: 'Crisis dashboard overload', expectedTypes: [{ type: 'Real-time crisis monitoring dashboard', reason: 'Everbridge Visual Command Center, Dataminr Public Sector, Juvare WebEOC, Esri ArcGIS Crisis Dashboard, OnSolve Critical Event Management, ICEYE Government \u2014 power the National Operations Center (DHS) and state EOC dashboards', confidence: 0.85 }] },
    'SEPT':      { fullName: 'Septal Nuclei', label: 'Trust Chains and Government PKI', tier: 'operational', function: 'Maintains trust chains and PKI for government', dysregulation: 'Identity / cert rot', expectedTypes: [{ type: 'Federal PKI / identity vendor', reason: 'Entrust Federal, DigiCert Federal, Sectigo Federal, IdenTrust, Carillon Information Security, ID.me, Login.gov (GSA TTS) \u2014 issue and operate federal PKI, CAC, and PIV credentials under FIPS 201 and the Federal PKI Common Policy', confidence: 0.85 }] },
    'SMN':       { fullName: 'Somatomotor Network', label: 'Physical Government Operations', tier: 'operational', function: 'Runs physical government operations (buildings, fleet, mail)', dysregulation: 'Infrastructure failure', expectedTypes: [{ type: 'GSA and federal facilities prime', reason: 'JLL Public Institutions, Cushman & Wakefield Government, CBRE Public Sector, ABM Government Services, ARAMARK Government Services, Sodexo Government, Compass Group Government \u2014 the federal real estate and facilities operations universe', confidence: 0.85 }] },
    'SNIG':      { fullName: 'Substantia Nigra', label: 'Government Reform Initiative Drive', tier: 'operational', function: 'Initiates and sustains government reform initiatives', dysregulation: 'Reform paralysis', expectedTypes: [{ type: 'Government modernization and reform consultancy', reason: 'Booz Allen Modernization, Accenture Federal Modernization, Deloitte Government Transformation, McKinsey Public Sector, BCG Center for Public Impact, Bain Government Transformation, Guidehouse Federal Transformation \u2014 lead major federal modernization initiatives', confidence: 0.88 }] },
    'SNS':       { fullName: 'Sympathetic Nervous System', label: 'Government Surge Mobilization', tier: 'operational', function: 'Mobilizes surge response to acute government crises', dysregulation: 'Surge fatigue', expectedTypes: [{ type: 'Disaster surge prime contractor', reason: 'AECOM Public Sector, Tetra Tech Disaster Response, Stantec Disaster Recovery, IEM, AC Disaster Consulting, Hagerty Consulting, Witt O\u2019Brien\u2019s \u2014 the FEMA Public Assistance and Stafford Act surge contractor universe', confidence: 0.85 }] },
    'STN':       { fullName: 'Subthalamic Nucleus', label: 'Government Action Hold', tier: 'operational', function: 'Halts government actions for review or pause', dysregulation: 'Action bypass', expectedTypes: [{ type: 'Federal litigation hold and rulemaking pause platform', reason: 'Bloomberg Law Litigation Hold, Westlaw Edge Litigation Analytics (Thomson Reuters), Lex Machina Court Analytics (LexisNexis), Relativity Government, Exterro Federal eDiscovery \u2014 manage stay orders, regulatory pauses, and litigation holds', confidence: 0.82 }] },
    'STS':       { fullName: 'Superior Temporal Sulcus', label: 'Pattern of Behavior Analysis', tier: 'operational', function: 'Analyzes behavioral patterns of officials and citizens', dysregulation: 'Pattern blindness', expectedTypes: [{ type: 'Insider threat / behavioral analytics platform', reason: 'Forcepoint Insider Threat (Government), Microsoft Defender for Identity Government, Splunk UEBA Federal, Securonix Federal, Exabeam Government, Proofpoint Insider Threat Management Federal \u2014 federal insider-threat and behavioral analytics for cleared personnel', confidence: 0.85 }] },
    'TPOLE':     { fullName: 'Temporal Pole', label: 'Brand and Reputation Memory of Government', tier: 'operational', function: 'Maintains brand and reputation memory across administrations', dysregulation: 'Brand damage', expectedTypes: [{ type: 'Federal agency PR and brand management firm', reason: 'Edelman Public Affairs, BCW Government, Hill+Knowlton Strategies Government, Burson Cohn & Wolfe Government, Ketchum Government, FleishmanHillard Public Affairs \u2014 manage federal agency brand and crisis reputation across administrations', confidence: 0.82 }] },
    'TrkB':      { fullName: 'Tropomyosin receptor kinase B', label: 'Government Experimentation Authority', tier: 'operational', function: 'Enables safe government experimentation through pilots and waivers', dysregulation: 'No experimentation', expectedTypes: [{ type: 'Federal innovation lab and experimentation service', reason: 'GSA Centers of Excellence, Office of Evaluation Sciences (OES, GSA), Lab at OPM, Defense Innovation Unit (DIU), 18F (GSA TTS), USDS, MITRE Innovation Center, In-Q-Tel \u2014 the federal experimentation infrastructure', confidence: 0.85 }] },
    'UNC':       { fullName: 'Uncinate Fasciculus', label: 'Constituent Relationship Memory & CRM', tier: 'operational', function: 'Maintains long-term constituent relationship memory', dysregulation: 'Constituent decay', expectedTypes: [{ type: 'Constituent CRM platform', reason: 'Fireside (formerly Indigov), IQ (Leidos Digital Solutions), Quorum Constituent, NGP VAN, NationBuilder, Salesforce Government Cloud, Microsoft Dynamics 365 Government \u2014 used by congressional offices, governors, and state legislatures', confidence: 0.88 }] },
    'V1':        { fullName: 'Primary Visual Cortex', label: 'Visual Records and Government Imagery', tier: 'operational', function: 'Captures visual records (photos, video) of government operations', dysregulation: 'Visual record gaps', expectedTypes: [{ type: 'Government visual records and imagery vendor', reason: 'C-SPAN, Defense Visual Information Distribution Service (DVIDS), Getty Images Government, AP Images Government, Reuters Pictures Government, NARA Audiovisual collections \u2014 the official visual record of federal government operations', confidence: 0.80 }] },
    'VAN':       { fullName: 'Ventral Attention Network', label: 'Government Interrupt Handling', tier: 'operational', function: 'Handles interrupt-style urgent government tasks', dysregulation: 'Interrupt fatigue', expectedTypes: [{ type: 'Government task and incident management platform', reason: 'ServiceNow Incident Management Government, Microsoft Planner Government, Asana Enterprise Government, Smartsheet Government, Atlassian Jira Federal, Monday.com Government \u2014 manage urgent task queues for federal staff', confidence: 0.82 }] },
    'VERM':      { fullName: 'Cerebellar Vermis', label: 'Core Government Reliability', tier: 'operational', function: 'Provides core reliability for government IT and operations', dysregulation: 'IT outages', expectedTypes: [{ type: 'Federal IT managed services prime', reason: 'Leidos Federal Managed Services, GDIT Managed Services, CACI Managed IT, ManTech Federal Managed IT, NTT Data Federal Services, Unisys Federal, Peraton \u2014 the federal civilian managed IT services prime universe', confidence: 0.85 }] },
    'VEST':      { fullName: 'Vestibular System', label: 'Policy Drift Detection', tier: 'operational', function: 'Detects drift between intended and actual policy outcomes', dysregulation: 'Policy drift', expectedTypes: [{ type: 'Federal program audit and assurance firm', reason: 'Deloitte Government Audit, KPMG Government Audit, EY Government Assurance, Grant Thornton Public Sector, Cotton & Company (Sikich), Williams Adley & Company \u2014 perform federal financial and program audits under GAGAS / Yellow Book standards', confidence: 0.85 }] },
    'VP':        { fullName: 'Ventral Pallidum', label: 'Government Program Sunset', tier: 'operational', function: 'Handles graceful sunset of expired government programs', dysregulation: 'Zombie programs', expectedTypes: [{ type: 'Program sunset and rescission consultancy', reason: 'Booz Allen Program Closeout, Deloitte Government Rescission Management, Guidehouse Federal Program Transition, Grant Thornton Public Sector wind-down, KPMG Government Program Termination \u2014 manage formal program sunset and rescission packages to OMB', confidence: 0.82 }] },
    'VTA':       { fullName: 'Ventral Tegmental Area', label: 'Citizen Incentive Programs', tier: 'operational', function: 'Designs and operates citizen incentive programs (tax credits, prizes)', dysregulation: 'Incentive misalignment', expectedTypes: [{ type: 'Federal challenge and prize program operator', reason: 'Challenge.gov (GSA), HeroX, Wazoku Crowd (formerly InnoCentive), MITRE Innovation Challenges, XPRIZE Foundation, Capital Consulting Corporation prize support \u2014 operate federal incentive prize competitions under the America COMPETES Act', confidence: 0.82 }] },
    'VV':        { fullName: 'Ventral Vagal Complex', label: 'Calm-State Government Engagement', tier: 'operational', function: 'Runs calm-state government engagement programs (community engagement)', dysregulation: 'Engagement decay', expectedTypes: [{ type: 'Community engagement firm for government', reason: 'ICF Stakeholder Engagement, Kearns & West, Tetra Tech Community Engagement, Spitfire Strategies, Civic Software Foundation, Civic Hall (Microsoft) \u2014 facilitate federal community engagement under NEPA, EJ40, and stakeholder participation requirements', confidence: 0.82 }] },
    'WERN':      { fullName: 'Wernicke\u2019s Area', label: 'Policy Comprehension and Translation', tier: 'operational', function: 'Translates complex policy into understandable language', dysregulation: 'Policy opacity', expectedTypes: [{ type: 'Plain-language and policy translation service', reason: 'Center for Plain Language, Plain Language Action and Information Network (PLAIN), Nava PBC plain-language practice, Ad Hoc LLC plain-language, Civic Software Foundation, Health Literacy Innovations \u2014 implement Plain Writing Act of 2010 across federal communications', confidence: 0.82 }] },
    'mPFC':      { fullName: 'Medial Prefrontal Cortex', label: 'Government Quality Engineering', tier: 'operational', function: 'Runs quality engineering across government programs', dysregulation: 'Quality regressions', expectedTypes: [{ type: 'Federal IV&V (independent verification and validation) prime', reason: 'MITRE FFRDC IV&V, SAIC IV&V, ManTech IV&V, Booz Allen IV&V, Lockheed Martin IV&V, NASA IV&V Facility (Fairmont), Aerospace Corporation FFRDC \u2014 the formal federal IV&V community', confidence: 0.85 }] },
    'rACC':      { fullName: 'Rostral Anterior Cingulate', label: 'Government Conflict Review', tier: 'operational', function: 'Runs review of government decisions and disputes', dysregulation: 'Review bottleneck', expectedTypes: [{ type: 'Federal adjudication and hearings support', reason: 'Maximus Federal Hearings (Office of Hearings and Appeals work), ICF Adjudication, Deloitte Adjudication Services, Public Consulting Group adjudication, Booz Allen agency review services \u2014 staff and process backlog at SSA OHA, EOIR, BVA, and similar appellate bodies', confidence: 0.82 }] },
    'vlPFC':     { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Government Authorization & Access Control', tier: 'operational', function: 'Enforces authorization and access control in government IT', dysregulation: 'Insider threat', expectedTypes: [{ type: 'Federal IAM / PAM / Zero Trust vendor', reason: 'Okta Federal, CyberArk Federal, BeyondTrust Federal, SailPoint Federal, Ping Identity Government, Microsoft Entra Government, Zscaler Federal Zero Trust, Saviynt Federal \u2014 the federal IAM / PAM / Zero Trust universe under OMB M-22-09', confidence: 0.88 }] }
  };

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadApprovals() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveApprovals(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
  function approvalKey(nodeId, businessType) { return nodeId + '::' + businessType.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50); }
  function getApprovalStatus(nodeId, businessType) { return loadApprovals()[approvalKey(nodeId, businessType)] || null; }

  function setApprovalStatus(nodeId, businessType, status, reason, reviewerRole) {
    var approvals = loadApprovals();
    var key = approvalKey(nodeId, businessType);
    var existing = approvals[key] || {};
    approvals[key] = {
      status: status, reason: reason || '', nodeId: nodeId, businessType: businessType,
      submitted_by: existing.submitted_by || 'operator',
      submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(), reviewer: reviewerRole || 'operator'
    };
    saveApprovals(approvals);
    return approvals[key];
  }

  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  function loadFullHierarchy(callback) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) return callback(_hierarchyCache);
    try {
      var cached = JSON.parse(sessionStorage.getItem(HIERARCHY_CACHE_KEY));
      if (cached && cached._age && (Date.now() - cached._age) < HIERARCHY_TTL) {
        _hierarchyCache = cached; _hierarchyCacheAge = cached._age;
        return callback(cached);
      }
    } catch (e) {}
    var brains = window.LIMENDomainBrains;
    if (!brains) return callback(null);
    var brain = brains.get('governance');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = { nodeCompanies: {}, nodeTreatments: {}, nodeDiagnoses: {}, nodeLabels: {}, nodeDepths: {}, allActivations: [] };

    function processActivations(acts, depth) {
      for (var i = 0; i < acts.length; i++) {
        var a = acts[i];
        var nid = a.brainNodeId;
        if (RI_NODES[nid]) continue;
        if (!result.nodeCompanies[nid]) result.nodeCompanies[nid] = {};
        if (!result.nodeTreatments[nid]) result.nodeTreatments[nid] = {};
        if (!result.nodeDiagnoses[nid]) result.nodeDiagnoses[nid] = {};
        if (!result.nodeLabels[nid]) result.nodeLabels[nid] = a.domainLabel || nid;
        if (!result.nodeDepths[nid]) result.nodeDepths[nid] = {};
        result.nodeDepths[nid][depth] = true;
        var cos = a.companies || [];
        for (var ci = 0; ci < cos.length; ci++) {
          var tk = cos[ci].ticker_or_id || cos[ci].name;
          if (!result.nodeCompanies[nid][tk]) result.nodeCompanies[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason, strength: cos[ci].binding_strength };
        }
        var treats = a.treatments || [];
        for (var ti = 0; ti < treats.length; ti++) {
          var t = treats[ti];
          if (isGenericTreatment(t.label)) continue;
          var tKey = (t.label || '') + '|' + (t.type || '');
          if (!result.nodeTreatments[nid][tKey]) result.nodeTreatments[nid][tKey] = { label: t.label, type: t.type, evidence: t.evidence };
        }
        var dx = a.diagnosticTriggers || [];
        for (var di = 0; di < dx.length; di++) result.nodeDiagnoses[nid][dx[di]] = true;
        result.allActivations.push({ brainNodeId: nid, depth: depth, label: a.domainLabel, companiesCount: cos.length });
      }
    }
    processActivations(topLevel.activations || [], 0);
    result._age = Date.now();
    _hierarchyCache = result;
    _hierarchyCacheAge = Date.now();
    try { sessionStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify(result)); } catch (e) {}
    callback(result);
  }

  function getGovernanceState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('governance');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getGovernanceState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();
    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('governance') : null;
      var portal = brain ? brain._portalCache : null;
      if (portal && portal.activations) {
        for (var ai = 0; ai < portal.activations.length; ai++) {
          var act = portal.activations[ai];
          var nid = act.brainNodeId;
          if (!nodeCompanyIndex[nid]) nodeCompanyIndex[nid] = {};
          var cos = act.companies || [];
          for (var ci = 0; ci < cos.length; ci++) {
            var tk = cos[ci].ticker_or_id || cos[ci].name;
            nodeCompanyIndex[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason };
          }
        }
      }
    }

    var mapped = [], missing = [], speculative = [];

    for (var nodeId in NODE_BUSINESS_DIRECTORY) {
      if (RI_NODES[nodeId]) continue;
      var dir = NODE_BUSINESS_DIRECTORY[nodeId];
      var expectedTypes = dir.expectedTypes || [];
      var nodeActive = false;
      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var cci = 0; cci < circuits.length; cci++) {
          if (circuits[cci].nodeId === nodeId) { nodeActive = true; break; }
        }
        if (nodeActive) break;
      }

      var existingCos = nodeCompanyIndex[nodeId] || {};
      var mappedCompanyNames = [];
      for (var tk in existingCos) mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')');

      for (var ti = 0; ti < expectedTypes.length; ti++) {
        var expected = expectedTypes[ti];
        var key = approvalKey(nodeId, expected.type);
        var approval = approvals[key] || null;

        var alreadyMapped = false;
        var typeWords = expected.type.toLowerCase().split(/\s+/);
        for (var mi = 0; mi < mappedCompanyNames.length; mi++) {
          var compLower = mappedCompanyNames[mi].toLowerCase();
          var matchCount = 0;
          for (var wi = 0; wi < typeWords.length; wi++) {
            if (typeWords[wi].length > 3 && compLower.indexOf(typeWords[wi]) !== -1) matchCount++;
          }
          if (matchCount >= 2) { alreadyMapped = true; break; }
        }
        if (!alreadyMapped) {
          for (var ck in existingCos) {
            var fr = (existingCos[ck].reason || '').toLowerCase();
            var matchCount2 = 0;
            for (var w2 = 0; w2 < typeWords.length; w2++) {
              if (typeWords[w2].length > 3 && fr.indexOf(typeWords[w2]) !== -1) matchCount2++;
            }
            if (matchCount2 >= 2) { alreadyMapped = true; break; }
          }
        }

        var consequence = '';
        if (!alreadyMapped) {
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Governance.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: this business type becomes eligible for future portal path mapping within Governance.';
          else consequence = 'If approved: this business type is recorded as a valid Governance mapping. Requires further validation.';
        }

        var variantState = 'ACTIVE';
        if (approval) {
          if (approval.status === 'DENIED') variantState = 'REJECTED';
          else if (approval.status === 'APPROVED') variantState = 'ACTIVE';
          else variantState = 'PROPOSED';
        } else if (!alreadyMapped && expected.confidence >= 0.75) variantState = 'MISSING';
        else if (!alreadyMapped) variantState = 'PROPOSED';
        else variantState = 'MAPPED';

        var showButtons = !!approval || variantState === 'PROPOSED' || variantState === 'MISSING';
        var cardKey = nodeId + '::' + (expected.type || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

        var entry = {
          cardKey: cardKey, nodeId: nodeId, nodeFullName: dir.fullName || nodeId,
          nodeLabel: dir.label, nodeFunction: dir.function, plainFunction: dir.function,
          dysregulation: dir.dysregulation || '', plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type, reason: expected.reason, confidence: expected.confidence,
          nodeActive: nodeActive, alreadyMapped: alreadyMapped,
          existingCompanies: mappedCompanyNames, approval: approval,
          approvalRequired: showButtons, variantState: variantState,
          approvalConsequence: consequence, tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' +
            (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
            'This creates demand for: ' + expected.type + '. ' + expected.reason + '.'
        };

        if (alreadyMapped) { entry.bucket = 'MAPPED'; mapped.push(entry); }
        else if (expected.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed by inference engine'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed \u2014 low confidence'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          speculative.push(entry);
        }
      }
    }

    function dedupeExact(arr) {
      var seen = {}, out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped); missing = dedupeExact(missing); speculative = dedupeExact(speculative);

    var sortFn = function (a, b) {
      var tierOrder = { 'top': 0, 'operational': 1 };
      var ta = tierOrder[a.tier] || 1, tb = tierOrder[b.tier] || 1;
      if (ta !== tb) return ta - tb;
      if (a.nodeActive !== b.nodeActive) return a.nodeActive ? -1 : 1;
      return b.confidence - a.confidence;
    };
    mapped.sort(sortFn); missing.sort(sortFn); speculative.sort(sortFn);
    return { mapped: mapped, missing: missing, speculative: speculative, error: null };
  }

  function getApprovedMappings() {
    var result = runInference(null);
    var approved = [];
    var all = result.missing.concat(result.speculative);
    for (var i = 0; i < all.length; i++) if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    return approved;
  }

  window.LIMENGovernanceBusinessEngine = {
    runInference: function () { return runInference(_hierarchyCache); },
    runInferenceWithHierarchy: runInference,
    loadFullHierarchy: loadFullHierarchy,
    getApprovedMappings: getApprovedMappings,
    setApprovalStatus: setApprovalStatus,
    getApprovalStatus: getApprovalStatus,
    loadApprovals: loadApprovals,
    NODE_DIRECTORY: NODE_BUSINESS_DIRECTORY,
    RI_NODES: RI_NODES,
    isGenericTreatment: isGenericTreatment
  };

  loadFullHierarchy(function () { console.log('[GovernanceBusinessEngine] Hierarchy loaded'); });
  console.log('[GovernanceBusinessEngine] Loaded \u2014 103-node governance business engine');
})();
