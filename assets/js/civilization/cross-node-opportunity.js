/**
 * civilization/cross-node-opportunity.js
 * LIMEN HELIX — Cross-node opportunity discovery (read-only).
 *
 * Reads:
 *   - assets/data/brain-node-domains.json  (neurological node → domain mappings)
 *   - LIMENCivilizationPackets             (per-domain audited truth)
 *   - LIMENCrossDomainAuditState           (cross-domain corroboration)
 *
 * Emits structured opportunity candidates with HONEST classification:
 *   {
 *     id, type, summary,
 *     nodes:    [{ name, role, domain, label }, ...],
 *     domains:  ['economy', 'governance', ...],
 *     evidenceQuality, confidence, urgency,
 *     rationale, provenance, lanes
 *   }
 *
 * Types — never lie about strength:
 *   - 'direct'         : a single domain at a node with active brain dx + good evidence
 *   - 'cross-domain'   : multiple domains at the same node aligning (corroborated)
 *   - 'inferred'       : domain elevated at a node, evidence quality middling
 *   - 'white-space'    : node exists in mapping but no active evidence — gap
 *   - 'speculative'    : weak / single-flag — surfaced but flagged
 *
 * Lanes (artifact lane recommendations) — see handoff-contract.js.
 *
 * Provides:
 *   window.LIMENCrossNodeOpportunity.recompute() → list
 *   window.LIMENCrossNodeOpportunity.get()       → last
 *   window.LIMENCrossNodeOpportunity.forDomain(id)
 *   event 'limen:cross-node-opportunity-update'
 */
(function () {
  'use strict';

  var ELEVATED        = 0.45;
  var EVIDENCE_GOOD   = 0.55;
  var EVIDENCE_MID    = 0.35;
  var URGENCY_HIGH    = 0.65;
  var URGENCY_LOW     = 0.30;
  var REBUILD_DEBOUNCE = 700;

  var _nodeMap = null;
  var _list    = [];
  var _byDomain = {};
  var _timer   = null;
  var _idCounter = 0;

  // ─── Source data load (brain-node-domains.json) ─────────────────────────
  // We don't bundle the JSON inline — fetch once and cache. If fetch fails
  // we degrade to empty (observer must never throw). Browser-only.
  function _loadNodeMap() {
    if (_nodeMap || typeof fetch !== 'function') return Promise.resolve(_nodeMap || {});
    return fetch('assets/data/brain-node-domains.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { _nodeMap = j || {}; return _nodeMap; })
      .catch(function () { _nodeMap = {}; return _nodeMap; });
  }

  function _packets() {
    var ad = (typeof window !== 'undefined') ? window.LIMENCivilizationAdapter : null;
    if (ad && typeof ad.getAll === 'function') return ad.getAll() || {};
    return (typeof window !== 'undefined' && window.LIMENCivilizationPackets) || {};
  }

  function _stress(p)   { return p && typeof p.stressScore === 'number' ? p.stressScore : null; }
  function _evidence(p) { return p && p.audit && typeof p.audit.evidenceQuality === 'number' ? p.audit.evidenceQuality : null; }
  function _flags(p)    { return Array.isArray(p && p.auditFlags) ? p.auditFlags : []; }

  // Lane heuristics — domains have natural artifact-lane affinities.
  // This is a HINT only; handoff-contract refines based on evidence.
  var DOMAIN_LANE_HINTS = {
    technology:    [ 'nsf-project-pitch', 'research-grants', 'business-grants', 'investments', 'research-papers'],
    // ─── Research / Science = BASIC & APPLIED R&D / DISCOVERY / PUBLICATION
    //     (lane hints reflect knowledge-production + innovation-commercialization
    //     identity — NEVER energy oil/gas/grid content) ───────────────────────
    // Research/Science identity is scientific research & discovery, basic &
    // applied research, R&D pipelines, academic & lab science, peer review &
    // publication, research funding & grants, scientific instruments & methods,
    // and the innovation pipeline. Real research-sector names: TMO, DHR, A
    // (Agilent), MTD (Mettler-Toledo), WAT (Waters), ILMN (Illumina), BIO
    // (Bio-Rad), RVTY (Revvity), BRKR (Bruker), IQV (IQVIA), ICLR (ICON) — the
    // life-sciences instruments / reagents / clinical-research-org space — and
    // research AUTHORITIES NSF, NIH, arXiv, Nature, OpenAlex, NASA. Research is
    // DISTINCT from technology (applied product DEV is a coupling, not research's
    // basic-discovery identity), medicine (clinical research is a coupling),
    // education (academic TEACHING is a coupling), and economy (R&D-spend macro
    // is a coupling). 'science' is the URL/portal key; 'research' is the runtime/
    // snapshot key (domain-identity dual-naming) — BOTH are mapped so whichever
    // key a packet/node-mapping uses routes identically.
    //
    // Energy anchors the multi-lane pattern (energy = [
    // 'business-grants'] — a multi-faceted IP + financing + grants space).
    // Research's OWN opportunity space is similarly multi-faceted and spans BOTH
    // knowledge-PRODUCTION lanes and innovation-COMMERCIALIZATION lanes: peer-
    // reviewed output (research-papers), research funding (research-grants),
    // IP discovery from research (patents — the lab→invention-disclosure edge),
    // and translational/commercializable funded-proposal innovation (nsf-project-
    // pitch). Exactly as the energy/medicine/education blocks warn, only tokens
    // that route to a REAL, research- OR science-accepting LANE_GATES entry in
    // handoff-contract.js may live here, or recompute() silently drops them (the
    // dead-token anti-pattern). All four below are live, research-accepting gates:
    // 'research-papers' / 'research-grants' / 'nsf-project-pitch' (the research-
    // side multi-domain gates) and 'patents' (broad anyDomain IP gate). This
    // brings research to lane parity with energy via its own knowledge-production
    // + innovation-commercialization space. Additive only — never removes prior
    // domains' hints.
    research:      ['research-papers', 'research-grants', 'patents', 'nsf-project-pitch'],
    // ─── Medicine / Health = CLINICAL + LIFE-SCIENCES READINESS (lane hints
    //     reflect clinical-research / pharmaceutical-IP / biotech-financing
    //     identity — NEVER energy oil/gas/grid content) ─────────────────────
    // Medicine's identity is healthcare & care delivery (UNH, HCA, CVS), the
    // pharmaceutical & biotech pipeline (JNJ, PFE, MRK, ABBV, LLY, AMGN, GILD),
    // medical devices & diagnostics (TMO, ABT, MDT, ISRG), public health &
    // disease control, clinical research & trials, and drug development —
    // DISTINCT from science (basic research is a coupling), population (disease
    // burden / demographics is a coupling), and economy (macro). 'medicine' is
    // the URL/portal key; 'health' is the runtime/snapshot key (domain-identity
    // dual-naming) — BOTH are mapped so whichever key a packet uses routes.
    //
    // Energy anchors the multi-lane pattern (energy = [
    // 'business-grants'] — a multi-faceted IP + financing + grants space).
    // Medicine's OWN opportunity space is similarly multi-faceted: clinical
    // research output (research-papers), pharmaceutical/diagnostic IP (patents),
    // clinical-trial / disease-control grants (research-grants), and translational
    // innovation pitches (nsf-project-pitch). Exactly as the energy/defense/
    // governance blocks warn, only tokens that route to a REAL, medicine- OR
    // health-accepting LANE_GATES entry in handoff-contract.js may live here, or
    // recompute() silently drops them (the dead-token anti-pattern). Against the
    // current contract those are: 'patents' (anyDomain includes 'medicine'),
    // 'research-grants' / 'nsf-project-pitch' / 'research-papers' (anyDomain
    // includes BOTH 'medicine' and 'health'). The gap's requested 'business-
    // grants' and 'investments' are NOT added here — their gates do NOT list
    // medicine/health in anyDomain (would be silently dropped). The biotech-
    // startup-grant and medtech-VC opportunities those represent are carried
    // CONDITIONALLY (HEALTH_COUPLING_LANES, below) through the medicine-accepting
    // multi-domain gates when the financing partner (finance/economy) is actually
    // co-elevated — not as dead tokens.
    medicine:      ['research-papers', 'patents', 'research-grants', 'nsf-project-pitch'],
    health:        ['research-papers', 'research-grants', 'nsf-project-pitch'],
    energy:        [ 'sba-loans', 'business-grants'],
    industry:      [ 'sba-loans'],
    agriculture:   [ 'sba-loans', 'patents'],
    // ─── Economy = MACRO AGGREGATE (additive macro lanes) ──────────────────
    // Economy is the macro aggregate (GDP/growth, inflation CPI/PCE, employment
    // PAYEMS/UNRATE, fiscal & monetary policy FEDFUNDS/DGS10, sentiment UMCSENT,
    // the recession/expansion business cycle) — DISTINCT from finance (capital
    // markets / credit / banks). Firm-level lending/position lanes ('sba-loans',
    // 'investments') are singleDomainOnly and therefore DROP macro-aggregate,
    // multi-domain opportunities (forecasting, policy scenario analysis, real-
    // time data infrastructure, cross-sector regime calls). Those need a home.
    //
    // The gap's intended macro lanes — economic-research, policy-white-papers,
    // fred-syndication, forecasting-models — are macro/advisory in spirit. They
    // map to EXISTING, already-gated, economy-accepting lanes in handoff-contract
    // so the routing is LIVE (not a dead token the contract silently drops):
    //   • economic-research / forecasting-models / policy scenario  → 'systemic-risk'
    //       (singleDomainOnly:false, anyDomain includes 'economy') — carries the
    //       multi-domain macro-regime / cross-sector / business-cycle signal that
    //       the single-domain lanes route away.
    //   • policy-white-papers / fred-syndication / capital conditions → 'capital-access'
    //       (singleDomainOnly:false, anyDomain includes 'economy') — macro funding/
    //       liquidity-condition opportunity that spans a sector cohort.
    // Existing firm-level lanes are kept (never removed). credit-facilities is
    // deliberately NOT added here — that is finance-native credit/lending; economy
    // stays the macro aggregate, distinct from finance.
    economy:       [ 'investments', 'systemic-risk', 'capital-access'],
    finance:       ['investments', 'copyrights', 'patents', 'business-grants', 'sba-loans', 'research-grants'],
    // ─── Education = SCHOOLS / EDTECH / STUDENT OUTCOMES (lane hints reflect
    //     learning, funding & access identity — NEVER energy oil/gas/grid
    //     content, and DISTINCT from the science research domain) ─────────────
    // Education's identity is schools & universities (K-12 + higher ed), edtech &
    // online learning, student outcomes & literacy, teaching & curriculum,
    // education funding & access/equity, workforce training & skills,
    // credentialing & enrollment, and student debt. Real education-sector names:
    // CHGG (study/learning services), COUR, DUOL, TWOU (edtech / online learning),
    // LRN (Stride K-12 virtual), ATGE (Adtalem), LOPE (Grand Canyon), STRA
    // (Strategic Education), LAUR (Laureate), UTI (Universal Technical Institute /
    // workforce-skills training). Education is DISTINCT from science (basic
    // RESEARCH is the science domain, a COUPLING here — not education's own
    // content), population (demographics / enrollment cohorts is a COUPLING),
    // technology (edtech TOOLING is a COUPLING, not education's identity), and
    // economy (workforce / labor-market is a COUPLING). NEVER energy content.
    //
    // Energy anchors the multi-lane pattern (energy = [
    // 'business-grants'] — a multi-faceted IP + financing + grants space).
    // Education's OWN opportunity space — student-outcome-improvement, curriculum-
    // modernization, teacher-development-funding, access-equity-program,
    // institutional-consolidation — is similarly multi-faceted. But exactly as the
    // economy, defense, intelligence, governance, medicine and communication
    // blocks warn, only tokens that route to a REAL, education-accepting
    // LANE_GATES entry in handoff-contract.js may live here, or recompute()
    // silently drops them (the dead-token anti-pattern; see handoff-contract.js
    // `if (!LANE_GATES[lane]) continue;`). Against the CURRENT contract, the
    // ONLY gates whose anyDomain includes 'education' are 'business-grants'
    // (line 402), 'research-grants' (line 403), and 'research-papers' (line 418).
    // So those three LIVE, education-accepting lanes are the hint set:
    //   • 'business-grants'  — education access/equity programs, institutional
    //       capacity, edtech small-business / workforce-training funding.
    //   • 'research-grants'  — education research, curriculum & pedagogy studies,
    //       student-outcome / literacy improvement programs.
    //   • 'research-papers'  — education evidence output (learning-science,
    //       outcome studies) — the copyrightable/published education work product.
    //
    // SYMMETRY CHECK (paired with handoff-contract.js): the education-PRIMARY
    // lanes the gap names — 'student-outcome-improvement', 'curriculum-
    // modernization', 'teacher-development-funding', 'access-equity-program',
    // 'institutional-consolidation' — describe the SHAPE of education's own
    // negotiator opportunities (analogous to defense's 'defense-procurement',
    // industry's 'industrial-capacity-investment', communication's 'broadcast-
    // infrastructure-modernization'). They are documented here as the INTENT, but
    // are NOT emitted as bare tokens: those PRIMARY gates do NOT yet exist in
    // handoff-contract.js LANE_GATES (adding them would require editing handoff-
    // contract.js, out of scope for this additive single-file port). This mirrors
    // the defense block's INTERIM state BEFORE 'defense-procurement' was promoted —
    // when an education-accepting PRIMARY gate for those lanes is later added to
    // LANE_GATES, promote 'student-outcome-improvement' to the FRONT of this hint
    // list (exactly as defense promoted 'defense-procurement' first). Until then
    // the live gates carry education's opportunity space. Additive only — never
    // removes prior domains' hints.
    education:     [ 'business-grants', 'research-papers'],
    // 'science' = the URL/portal alias of the 'research' runtime key (see the
    // research block above + domain-identity.js dual-naming). Kept at lane parity
    // with research so whichever key a node-mapping/packet uses routes identically
    // to the same knowledge-production + innovation-commercialization lanes.
    science:       ['research-papers', 'research-grants', 'patents', 'nsf-project-pitch'],
    governance:    [],
    law:           [],
    // ─── Defense = MILITARY-INDUSTRIAL READINESS (lane hints reflect kinetic/
    //     industrial identity, not IP) ───────────────────────────────────────
    // Defense's identity is military spending & procurement, the defense
    // industrial base (LMT, RTX, NOC, GD, BA, LHX, HII, LDOS, BAH, KTOS, AVAV),
    // geopolitical conflict & strategic deterrence, weapons-system modernization,
    // military readiness, alliances & basing, and electronic/kinetic warfare —
    // NOT patent filings. Defense is DISTINCT from intelligence (collection/
    // analysis/espionage) and from technology (cyber is a coupling, not native).
    // It couples to energy via fuel security / strategic petroleum reserve, but
    // its OWN content stays kinetic/industrial readiness — never oil/gas/grid.
    //
    // Energy anchors the multi-lane pattern: energy = [
    // 'business-grants'] reflects a multi-faceted opportunity space (IP
    // licensing, small-business suppliers, infrastructure grants). Defense's
    // opportunity space is similarly multi-faceted — procurement contracts,
    // strategic partnerships, weapons-system modernization, deterrence/readiness
    // posture — but the lanes that would carry those distinctions
    // ('defense-procurement', 'strategic-deterrence', 'weapons-modernization')
    // do NOT yet exist in handoff-contract.js. Adding them here as bare tokens
    // would be silently dropped by the contract gate (no matching lane), exactly
    // the dead-token anti-pattern the economy block above warns against.
    //
    // LIVE: the defense-native procurement lane now EXISTS in handoff-contract.js
    // ('defense-procurement', singleDomainOnly:true, anyDomain includes 'defense'
    // alongside the industrial-base/readiness-adjacent domains industry/
    // infrastructure/energy/technology). The interim dead-token risk is therefore
    // resolved — both hints below route to real, defense-accepting LANE_GATES
    // entries (no silent drop). This brings defense to lane parity with energy
    // (energy = [], a multi-faceted IP +
    // financing + grants space) via defense's OWN multi-faceted space:
    //   • 'defense-procurement' FIRST — defense identity is kinetic/industrial
    //     readiness: programs of record, weapons-system buys, sustainment/
    //     readiness contracts (real primes: LMT, RTX, NOC, GD, BA, LHX, HII,
    //     LDOS, BAH, KTOS, AVAV). This is the procurement/readiness/deterrence
    //     posture lane the interim comment promised to promote.
    //   • 'patents' demoted to the IP edge case — defense industrial-base process
    //     / weapons-system invention disclosure (sensors, EW, logistics tech IP).
    // The technology-coupling lanes (zero-day-acquisition, firmware-licensing,
    // semiconductor-IP) are NOT listed here on purpose: they fire only when
    // technology is CO-ELEVATED with defense at a node (TECH_COUPLING_LANES.defense
    // adds them conditionally), keeping cyber as a technology coupling — NOT
    // defense's own kinetic content, and distinct from intelligence collection.
    defense:       ['defense-procurement', 'patents'],
    // ─── Intelligence = COLLECTION / ALL-SOURCE ANALYSIS / ESPIONAGE
    //     (lane hints reflect collection & assessment identity, not kinetic
    //     readiness and not cyber tooling) ──────────────────────────────────
    // Intelligence's identity is collection (SIGINT/HUMINT/GEOINT/OSINT),
    // all-source analysis & assessment, espionage & counterintelligence,
    // surveillance & reconnaissance, threat warning, covert action, information/
    // influence operations, and security-clearance/insider-risk work. Real
    // intelligence-sector names: PLTR (all-source analytics), BAH, LDOS, CACI,
    // SAIC, KBR (mission-IT / analysis services), VRNT, NICE (collection/
    // surveillance analytics), VRSK (risk intelligence). Intelligence is DISTINCT
    // from defense (kinetic/industrial readiness) and from technology (cyber
    // tooling is a COUPLING, not the identity).
    //
    // Energy anchors the multi-lane pattern (energy = [
    // 'business-grants'] — a multi-faceted IP + financing + grants space).
    // Intelligence's OWN opportunity space is similarly multi-faceted —
    // all-source assessment (systemic-risk shaped), collection capability,
    // counterintelligence/insider-risk, financial-intelligence (finint),
    // biointelligence (research) — but, exactly like the economy and defense
    // blocks above warn, only tokens that route to a REAL, intelligence-accepting
    // LANE_GATES entry in handoff-contract.js may live here unconditionally;
    // anything else is silently dropped (the dead-token anti-pattern).
    //
    // Against the current handoff-contract LANE_GATES, the intelligence-native
    // gate is 'copyrights' (anyDomain includes 'intelligence' — assessments,
    // analytic products, finished-intelligence reports are copyrightable work
    // product). 'research-papers' is kept (pre-existing; biointelligence/OSINT
    // research output) even though the contract currently routes it via the
    // research-side domains — it stays as an honest affinity hint, the contract
    // decides. The gap's other requested unconditional tokens
    // ('systemic-risk','insider-risk-assessment',
    // 'fintech-infrastructure','intelligence-sharing') are NOT added here:
    // 'systemic-risk'/'research-grants' exist but do not list 'intelligence' in
    // anyDomain (would be dropped), and the remaining three do not exist as gates
    // at all. The collection↔technology and finint↔finance opportunities are
    // therefore carried CONDITIONALLY (coupling, below) where the co-elevated
    // partner that negotiates them is actually present — not as dead tokens.
    intelligence:  [ 'research-papers'],
    communication: [],
    culture:       [ 'franchise', 'patents', 'research-papers', 'business-grants', 'research-grants'],
    religion:      [],
    population:    ['research-papers'],
    environment:   [ 'patents'],
    infrastructure:[ 'research-grants', 'research-papers', 'business-grants', 'sba-loans'],
    supplyChain:   [ 'sba-loans', 'franchise']
  };

  // ─── Technology co-domain coupling lanes (additive) ─────────────────────
  // Mirrors energy's pattern of routing artifacts to the correct domain
  // negotiator. Technology's IDENTITY stays chips/software/AI/cyber; these
  // lanes only fire when technology is CO-ELEVATED with a partner domain at
  // the same node, routing tech-native artifacts (firmware, semiconductor IP,
  // cyber-intelligence) to the partner that negotiates them:
  //   • technology ↔ defense  → cyber-intelligence coupling (zero-day, firmware)
  //   • technology ↔ energy   → efficiency-hardware coupling (compute/grid HW)
  //   • technology ↔ finance  → fintech-infrastructure coupling
  // Defense/finance/research coupling lanes carry semiconductor-IP licensing
  // and supply-chain mapping. Additive only — never removes the generic
  // technology R&D lanes above.
  //   • technology ↔ intelligence → cyber-intelligence coupling (zero-day):
  //       when technology is co-elevated with intelligence on a cyber-threat
  //       surface, the offensive/defensive cyber-capability acquisition shaped
  //       opportunity routes to the intelligence negotiator. 'zero-day-
  //       acquisition' is the ONLY requested cyber-coupling token that exists in
  //       LANE_GATES AND lists 'intelligence' in anyDomain — so it is the only
  //       one added (the gap's 'cyber-intelligence-sharing' and 'APT-threat-
  //       briefing' are NOT real gates and would be silently dropped). Cyber
  //       stays a technology coupling here, NOT intelligence's own collection/
  //       analysis identity.
  var TECH_COUPLING_LANES = {
    defense: ['zero-day-acquisition', 'firmware-licensing', 'semiconductor-IP'],
    energy:  ['energy-efficiency-hardware', 'firmware-licensing', 'supply-chain-mapping'],
    finance: ['fintech-infrastructure', 'semiconductor-IP', 'investments'],
    research:['semiconductor-IP', 'supply-chain-mapping'],
    intelligence: ['zero-day-acquisition']
  };

  // ─── Finance co-domain coupling lanes (additive, finint) ────────────────
  // Mirrors the technology-coupling pattern but keyed on FINANCE being co-
  // elevated. Fires only when finance is present in an opportunity's domain set
  // alongside a partner that originates a finance-shaped opportunity, routing
  // the artifact to the finance negotiator. The intelligence↔finance case is
  // financial-intelligence (finint): illicit-finance tracking, sanctions/AML
  // exposure, capital-access stress surfaced by intelligence collection. Only
  // tokens that route to a REAL, finance-accepting LANE_GATES entry may live
  // here — 'capital-access' (singleDomainOnly:false, anyDomain includes
  // 'finance') is the live finint-adjacent lane. The gap's 'fintech-
  // infrastructure' and 'illicit-finance-tracking' are NOT real gates and would
  // be dropped, so they are deliberately omitted (dead-token discipline).
  var FINANCE_COUPLING_LANES = {
    intelligence: ['capital-access']
  };

  // ─── Governance co-domain coupling lanes (additive, policy-regime) ──────
  // Mirrors the technology-/finance-coupling pattern but keyed on GOVERNANCE
  // being co-elevated. Fires only when governance is present in an
  // opportunity's domain set alongside a partner domain whose capex/strategy
  // is shaped by a POLICY REGIME — the coupling unique to governance.
  //
  // GOVERNANCE IDENTITY (distinct from economy=macro, finance=capital,
  // law=judicial/legal-system, intelligence=collection): government & public
  // administration, public policy & rulemaking, regulation & oversight,
  // elections & democratic institutions, public finance & budgets, rule of
  // law & institutional integrity, public-services delivery, political
  // stability & legitimacy. Governance binds to INSTITUTIONS & INDICES, not
  // single firms — where entities are needed the real govtech/public-sector
  // identifiers are TYL (Tyler Technologies), MMS (Maximus), BAH, LDOS, ACN,
  // GDIT, and the policy/governance indices are World Bank WGI, V-Dem, OECD,
  // GAO, CBO, and the Federal Register. NEVER energy oil/gas/grid content.
  //
  // The policy-regime couplings the gap names —
  //   • governance ↔ energy    : carbon-regulatory-compliance (emissions-cap /
  //       transition-mandate policy shaping capex)
  //   • governance ↔ finance   : prudential-compliance-modernization (capital-
  //       adequacy / stress-test regulatory framework)
  //   • governance ↔ defense   : acquisition-authority-modernization (program-
  //       of-record decision-making / procurement-authority efficiency)
  //   • governance ↔ technology: tech-regulation-modernization (IP / antitrust /
  //       data-privacy regulation shaping capex)
  // — describe the SHAPE of each opportunity. But exactly as the economy,
  // defense, and intelligence blocks above warn, only tokens that route to a
  // REAL, governance-accepting LANE_GATES entry in handoff-contract.js may be
  // emitted, or recompute() silently drops them (the dead-token anti-pattern;
  // see handoff-contract.js line `if (!LANE_GATES[lane]) continue;`). Against
  // the current contract, the ONLY gate whose anyDomain includes 'governance'
  // is 'copyrights' — governance's analytic/policy work product (rulemaking
  // analyses, regulatory-compliance frameworks, policy white papers, oversight
  // assessments) is the copyrightable artifact every policy-regime coupling
  // produces. So each coupling routes to 'copyrights' (LIVE, never dropped),
  // and the named lanes above (carbon-regulatory-compliance, prudential-
  // compliance-modernization, acquisition-authority-modernization, tech-
  // regulation-modernization) are documented here as the INTENT — they are NOT
  // emitted as bare tokens (no matching gate yet; adding gates would require
  // editing handoff-contract.js, out of scope for this additive port). When a
  // governance-accepting gate for those lanes is later added to LANE_GATES,
  // swap the 'copyrights' value for the named token — the emitter below already
  // routes governance couplings to the governance negotiator. Additive only —
  // never removes the generic governance lanes above.
  var GOVERNANCE_COUPLING_LANES = {
    energy:      [], // carbon-regulatory-compliance (intent)
    finance:     [], // prudential-compliance-modernization (intent)
    defense:     [], // acquisition-authority-modernization (intent)
    technology:  []  // tech-regulation-modernization (intent)
  };

  // ─── Medicine/Health co-domain coupling lanes (additive, life-sciences) ──
  // Mirrors the technology-/finance-/governance-coupling pattern but keyed on
  // MEDICINE (or its runtime alias 'health') being co-elevated. Fires only when
  // medicine/health is present in an opportunity's domain set alongside a
  // partner domain that originates a healthcare-shaped opportunity, routing the
  // artifact to the medicine negotiator. Medicine's identity stays clinical /
  // pharmaceutical / medtech (UNH, JNJ, PFE, MRK, ABBV, LLY, TMO, ABT, MDT,
  // ISRG, HCA, CVS, AMGN, GILD) — NEVER energy oil/gas/grid content.
  //
  // The healthcare couplings the gap names —
  //   • medicine ↔ finance   : pharma-funding / medtech-VC / biotech startup
  //       capital (the venture financing the JNJ/PFE/LLY pipeline + ISRG/MDT
  //       device companies raise)
  //   • medicine ↔ technology : medtech-IP (digital-health, diagnostic-device,
  //       AI-imaging invention disclosure shaping capex)
  //   • medicine ↔ defense    : biodefense (medical-countermeasure / pandemic-
  //       preparedness / BARDA-style procurement readiness)
  //   • medicine ↔ science    : translational basic-research → clinical pipeline
  //   • medicine ↔ population  : disease-burden / epidemiology-driven demand
  // — describe the SHAPE of each opportunity. But exactly as the economy,
  // defense, intelligence, and governance blocks above warn, only tokens that
  // route to a REAL, medicine- OR health-accepting LANE_GATES entry in
  // handoff-contract.js may be emitted, or recompute() silently drops them (the
  // dead-token anti-pattern; see handoff-contract.js `if (!LANE_GATES[lane])`).
  // Against the current contract, the medicine/health-accepting multi-domain
  // gates (singleDomainOnly:false, so usable for a coupling) are 'nsf-project-
  // pitch' (anyDomain includes BOTH medicine and health) and 'research-papers'
  // (likewise). So each healthcare coupling routes through those LIVE gates —
  // 'nsf-project-pitch' carries the translational/commercializable innovation
  // shape (pharma-funding, medtech-IP, biodefense countermeasure development),
  // 'research-papers' carries the clinical/epidemiological evidence shape
  // (disease-burden, translational science). The named lanes above
  // (pharma-funding, medtech-IP, biodefense-procurement) are documented here as
  // the INTENT — they are NOT emitted as bare tokens (no matching medicine-
  // accepting gate yet; adding gates would require editing handoff-contract.js,
  // out of scope for this additive port). When a medicine-accepting gate for
  // those lanes is later added to LANE_GATES, swap the value for the named
  // token — the emitter below already routes medicine couplings to the medicine
  // negotiator. Additive only — never removes the generic medicine/health lanes
  // above.
  var HEALTH_COUPLING_LANES = {
    finance:     [], // pharma-funding / medtech-VC (intent)
    economy:     [], // biotech-startup capital (intent)
    technology:  [], // medtech-IP / digital-health (intent)
    defense:     [], // biodefense countermeasure (intent)
    science:     ['research-papers'],   // translational basic→clinical
    population:  ['research-papers']    // disease-burden / epidemiology
  };

  // ─── Research/Science co-domain coupling lanes (additive, life-sciences /
  //     translational triangle) ──────────────────────────────────────────────
  // The INVERSE of HEALTH_COUPLING_LANES.science (which fires when MEDICINE is
  // primary and science is the partner). This block fires when RESEARCH (or its
  // URL alias 'science') is the PRIMARY co-elevated domain alongside a partner
  // that originates a research-shaped opportunity, routing the translational-
  // research artifact to the research/science negotiator. Research is the basic-
  // research SOURCE; medicine/health is the clinical coupling; population is the
  // epidemiology coupling. Together they form the life-sciences triangle
  // (medicine ↔ research ↔ population on disease epidemiology). Research's
  // identity stays basic & applied discovery / R&D / publication (TMO, DHR, A,
  // MTD, WAT, ILMN, BIO, RVTY, BRKR, IQV, ICLR; authorities NSF, NIH, arXiv,
  // Nature, OpenAlex, NASA) — NEVER energy oil/gas/grid content.
  //
  // The translational couplings —
  //   • research ↔ medicine/health : translational basic-research → clinical
  //       evidence pipeline (the science-source side of the triangle)
  //   • research ↔ population       : disease-epidemiology / cohort study
  //       (population epidemiology demand on research)
  //   • research ↔ finance          : biotech/cleantech research-startup capital
  //       (commercializable funded research seeking venture financing)
  //   • research ↔ technology       : applied R&D → deep-tech commercialization
  //       (lab discovery feeding applied product dev — tech stays the coupling)
  // — describe the SHAPE of each opportunity. Exactly as the economy / defense /
  // intelligence / governance / medicine blocks warn, only tokens that route to
  // a REAL, research- OR science-accepting LANE_GATES entry in handoff-
  // contract.js may be emitted, or recompute() silently drops them (the dead-
  // token anti-pattern; see handoff-contract.js `if (!LANE_GATES[lane])`).
  // Against the current contract, the research/science-accepting multi-domain
  // gates (singleDomainOnly:false, so usable for a coupling) are 'nsf-project-
  // pitch' and 'research-papers'. So each coupling routes through those LIVE
  // gates — 'nsf-project-pitch' carries the commercializable/translational-
  // innovation shape (biotech/cleantech startup, deep-tech R&D), 'research-
  // papers' carries the clinical/epidemiological evidence shape (translational
  // medicine, disease-epidemiology cohort studies). The 'investments' lane the
  // gap names for biotech/cleantech research-startup financing is NOT emitted as
  // a bare token here — 'investments' is singleDomainOnly and its anyDomain does
  // not include research/science (would be silently dropped); that financing
  // shape is carried CONDITIONALLY through 'nsf-project-pitch' (the live
  // translational/commercializable-research gate) when finance/technology is
  // actually co-elevated — not as a dead token. Accepts either dual-naming key
  // (science portal-key OR research runtime-key). Additive only — never removes
  // the generic research/science lanes above.
  var RESEARCH_COUPLING_LANES = {
    medicine:    ['research-papers'],     // translational basic→clinical evidence
    health:      ['research-papers'],     // translational basic→clinical (alias)
    population:  ['research-papers'],     // disease-epidemiology cohort study
    finance:     [],   // biotech/cleantech research-startup (intent)
    technology:  []    // applied R&D → deep-tech commercialization
  };

  function _laneHints(domains) {
    var bag = {};
    for (var i = 0; i < domains.length; i++) {
      var lanes = DOMAIN_LANE_HINTS[domains[i]] || [];
      for (var j = 0; j < lanes.length; j++) bag[lanes[j]] = (bag[lanes[j]] || 0) + 1;
    }
    // Conditional technology coupling: only when technology is co-elevated
    // with a partner domain in this same opportunity's domain set.
    if (domains.indexOf('technology') >= 0) {
      for (var ci = 0; ci < domains.length; ci++) {
        var partner = domains[ci];
        if (partner === 'technology') continue;
        var couple = TECH_COUPLING_LANES[partner];
        if (!couple) continue;
        for (var cj = 0; cj < couple.length; cj++) {
          // Weight coupling lanes so they out-rank generic R&D lanes when the
          // coupling is actually present (real co-domain elevation).
          bag[couple[cj]] = (bag[couple[cj]] || 0) + 2;
        }
      }
    }
    // Conditional finance coupling (finint): only when finance is co-elevated
    // with a partner domain in this same opportunity's domain set. Mirrors the
    // technology-coupling weighting so finint lanes out-rank generic hints.
    if (domains.indexOf('finance') >= 0) {
      for (var fi = 0; fi < domains.length; fi++) {
        var fpartner = domains[fi];
        if (fpartner === 'finance') continue;
        var fcouple = FINANCE_COUPLING_LANES[fpartner];
        if (!fcouple) continue;
        for (var fj = 0; fj < fcouple.length; fj++) {
          bag[fcouple[fj]] = (bag[fcouple[fj]] || 0) + 2;
        }
      }
    }
    // Conditional governance coupling (policy-regime): only when governance is
    // co-elevated with a partner domain (energy/finance/defense/technology) in
    // this same opportunity's domain set. Mirrors the technology-/finance-
    // coupling weighting so the policy-regime lane out-ranks generic hints,
    // routing the carbon/prudential/acquisition/tech-regulation compliance
    // artifact to the governance negotiator (via its live 'copyrights' gate).
    if (domains.indexOf('governance') >= 0) {
      for (var gi = 0; gi < domains.length; gi++) {
        var gpartner = domains[gi];
        if (gpartner === 'governance') continue;
        var gcouple = GOVERNANCE_COUPLING_LANES[gpartner];
        if (!gcouple) continue;
        for (var gj = 0; gj < gcouple.length; gj++) {
          bag[gcouple[gj]] = (bag[gcouple[gj]] || 0) + 2;
        }
      }
    }
    // Conditional medicine/health coupling (life-sciences): only when medicine
    // (or its runtime alias 'health') is co-elevated with a partner domain
    // (finance/economy/technology/defense/science/population) in this same
    // opportunity's domain set. Mirrors the technology-/finance-/governance-
    // coupling weighting so the healthcare lane out-ranks generic hints, routing
    // the pharma-funding / medtech-IP / biodefense / translational artifact to
    // the medicine negotiator (via its live 'nsf-project-pitch' / 'research-
    // papers' gates). Accepts either dual-naming key (medicine portal-key OR
    // health runtime-key).
    if (domains.indexOf('medicine') >= 0 || domains.indexOf('health') >= 0) {
      for (var hi = 0; hi < domains.length; hi++) {
        var hpartner = domains[hi];
        if (hpartner === 'medicine' || hpartner === 'health') continue;
        var hcouple = HEALTH_COUPLING_LANES[hpartner];
        if (!hcouple) continue;
        for (var hj = 0; hj < hcouple.length; hj++) {
          bag[hcouple[hj]] = (bag[hcouple[hj]] || 0) + 2;
        }
      }
    }
    // Conditional research/science coupling (life-sciences / translational
    // triangle): only when research (or its URL alias 'science') is co-elevated
    // with a partner domain (medicine/health/population/finance/technology) in
    // this same opportunity's domain set. Mirrors the technology-/finance-/
    // governance-/medicine-coupling weighting so the translational-research lane
    // out-ranks generic hints, routing the basic→clinical evidence / disease-
    // epidemiology / biotech-cleantech-startup / deep-tech artifact to the
    // research negotiator (via its live 'research-papers' / 'nsf-project-pitch'
    // gates). Accepts either dual-naming key (research runtime-key OR science
    // portal-key).
    if (domains.indexOf('research') >= 0 || domains.indexOf('science') >= 0) {
      for (var ri = 0; ri < domains.length; ri++) {
        var rpartner = domains[ri];
        if (rpartner === 'research' || rpartner === 'science') continue;
        var rcouple = RESEARCH_COUPLING_LANES[rpartner];
        if (!rcouple) continue;
        for (var rj = 0; rj < rcouple.length; rj++) {
          bag[rcouple[rj]] = (bag[rcouple[rj]] || 0) + 2;
        }
      }
    }
    return Object.keys(bag).sort(function (a, b) { return bag[b] - bag[a]; });
  }

  function _genId() {
    return 'opp-' + Date.now().toString(36) + '-' + (++_idCounter).toString(36);
  }

  // ─── Build opportunities from one neurological node ─────────────────────
  function _opportunitiesAtNode(nodeName, nodeMappings, packets) {
    if (!Array.isArray(nodeMappings) || nodeMappings.length === 0) return [];
    var elevatedHere = [];
    var allDomains = [];
    for (var i = 0; i < nodeMappings.length; i++) {
      var m = nodeMappings[i];
      if (!m || !m.domain) continue;
      var p = packets[m.domain];
      var s = _stress(p), e = _evidence(p), flags = _flags(p);
      var entry = { name: nodeName, role: m.role || '', domain: m.domain, label: m.label || m.domain,
                    stress: s, evidence: e, flags: flags, packet: p };
      allDomains.push(entry);
      if (s != null && s >= ELEVATED) elevatedHere.push(entry);
    }
    var out = [];

    // CROSS-DOMAIN at this node — 2+ elevated domains corroborated by node.
    if (elevatedHere.length >= 2) {
      var avgEv = elevatedHere.reduce(function (a, x) { return a + (x.evidence || 0); }, 0) / elevatedHere.length;
      var avgStress = elevatedHere.reduce(function (a, x) { return a + (x.stress || 0); }, 0) / elevatedHere.length;
      var domains = elevatedHere.map(function (x) { return x.domain; });
      var conf = Math.min(0.95, avgEv * 0.7 + Math.min(1, elevatedHere.length / 4) * 0.3);
      out.push({
        id:              _genId(),
        type:            'cross-domain',
        nodes:           [{ name: nodeName, role: elevatedHere[0].role, domain: 'multi', label: 'multi' }],
        domains:         domains,
        evidenceQuality: avgEv,
        confidence:      conf,
        urgency:         avgStress,
        summary:         elevatedHere.length + ' domains elevated at ' + nodeName +
                         ' (' + domains.join(' + ') + ')',
        rationale:       'Multiple domains active at the same neurological node — cross-system opportunity. Roles: ' +
                         elevatedHere.map(function (x) { return x.domain + '=' + x.role; }).join(' | '),
        provenance:      'node_map:' + nodeName + '; brain-truth packets',
        lanes:           _laneHints(domains),
        warn:            avgEv < EVIDENCE_MID ? 'EVIDENCE_THIN' : null
      });
    }

    // DIRECT — single elevated domain at node with strong evidence.
    for (var di = 0; di < elevatedHere.length; di++) {
      var d = elevatedHere[di];
      if (d.evidence == null || d.evidence < EVIDENCE_GOOD) continue;
      // Already produced cross-domain — skip duplicate single-domain emit
      // when this domain is part of a cross-domain group
      if (elevatedHere.length >= 2) continue;
      out.push({
        id:              _genId(),
        type:            'direct',
        nodes:           [{ name: nodeName, role: d.role, domain: d.domain, label: d.label }],
        domains:         [d.domain],
        evidenceQuality: d.evidence,
        confidence:      Math.min(0.9, d.evidence * 0.8 + Math.min(1, (d.stress || 0) / 0.8) * 0.2),
        urgency:         d.stress,
        summary:         d.domain + ' active at ' + nodeName + ' (' + d.role + ')',
        rationale:       'Single-domain elevation at ' + nodeName + ' with strong feed-grounded evidence.',
        provenance:      'node_map:' + nodeName + '; ' + d.domain + ' packet',
        lanes:           _laneHints([d.domain]),
        warn:            null
      });
    }

    // INFERRED — single elevated, mid-quality evidence.
    for (var ii = 0; ii < elevatedHere.length; ii++) {
      var e2 = elevatedHere[ii];
      if (e2.evidence == null || e2.evidence >= EVIDENCE_GOOD) continue;
      if (e2.evidence < EVIDENCE_MID) continue;
      if (elevatedHere.length >= 2) continue;
      out.push({
        id:              _genId(),
        type:            'inferred',
        nodes:           [{ name: nodeName, role: e2.role, domain: e2.domain, label: e2.label }],
        domains:         [e2.domain],
        evidenceQuality: e2.evidence,
        confidence:      Math.min(0.7, e2.evidence * 0.7),
        urgency:         e2.stress,
        summary:         e2.domain + ' likely active at ' + nodeName + ' (' + e2.role + ')',
        rationale:       'Stress elevated but evidence quality mid-range — likely real, needs corroboration.',
        provenance:      'node_map:' + nodeName + '; ' + e2.domain + ' packet (mid-quality)',
        lanes:           _laneHints([e2.domain]),
        warn:            'EVIDENCE_MID'
      });
    }

    // SPECULATIVE — flagged dx but very weak provenance.
    for (var sp = 0; sp < allDomains.length; sp++) {
      var d3 = allDomains[sp];
      var fls = d3.flags || [];
      var hasWeak = fls.indexOf('LOW_FEED_PROVENANCE') >= 0 ||
                    fls.indexOf('STRESS_DERIVED_DX')   >= 0 ||
                    fls.indexOf('BASELINE_HEAVY')      >= 0;
      if (!hasWeak) continue;
      // Avoid duplicate — only emit speculative when no stronger entry
      // already exists for that domain at this node.
      if (elevatedHere.indexOf(d3) >= 0 && d3.evidence != null && d3.evidence >= EVIDENCE_MID) continue;
      out.push({
        id:              _genId(),
        type:            'speculative',
        nodes:           [{ name: nodeName, role: d3.role, domain: d3.domain, label: d3.label }],
        domains:         [d3.domain],
        evidenceQuality: d3.evidence != null ? d3.evidence : 0,
        confidence:      0.2,
        urgency:         d3.stress != null ? d3.stress * 0.5 : 0,
        summary:         d3.domain + ' flag at ' + nodeName + ' (weak provenance)',
        rationale:       'Domain flagged ' + fls.join(',') + ' — opportunity surface only, weak evidence.',
        provenance:      'node_map:' + nodeName + '; ' + d3.domain + ' packet flags=' + fls.join('|'),
        lanes:           _laneHints([d3.domain]),
        warn:            'WEAK_PROVENANCE'
      });
    }

    // WHITE-SPACE — node has mappings but no active evidence anywhere.
    if (elevatedHere.length === 0) {
      var anyData = allDomains.some(function (x) { return x.stress != null; });
      if (anyData) {
        var weakDomains = allDomains.filter(function (x) { return x.stress != null && x.stress < ELEVATED; })
                                    .map(function (x) { return x.domain; });
        if (weakDomains.length >= 2) {
          out.push({
            id:              _genId(),
            type:            'white-space',
            nodes:           [{ name: nodeName, role: nodeMappings[0].role, domain: 'multi', label: 'multi' }],
            domains:         weakDomains,
            evidenceQuality: 0,
            confidence:      0.15,
            urgency:         0,
            summary:         nodeName + ' connects ' + weakDomains.length + ' quiet domains — possible white-space',
            rationale:       'Node has multi-domain mapping but no domain currently elevated — opportunity for novel synthesis.',
            provenance:      'node_map:' + nodeName + '; quiet-domain inference',
            lanes:           _laneHints(weakDomains),
            warn:            'NO_DIRECT_EVIDENCE'
          });
        }
      }
    }
    return out;
  }

  // ─── Recompute ──────────────────────────────────────────────────────────
  function recompute() {
    return _loadNodeMap().then(function (map) {
      var packets = _packets();
      _idCounter = 0;
      var all = [];
      var nodeNames = Object.keys(map);
      for (var i = 0; i < nodeNames.length; i++) {
        var name = nodeNames[i];
        if (name.charAt(0) === '_') continue; // skip schema markers
        all = all.concat(_opportunitiesAtNode(name, map[name], packets));
      }
      // Sort: cross-domain first (highest urgency × confidence), then direct,
      // then inferred, then speculative, then white-space.
      var typeRank = { 'cross-domain': 0, 'direct': 1, 'inferred': 2, 'speculative': 3, 'white-space': 4 };
      all.sort(function (a, b) {
        var ra = typeRank[a.type] || 9, rb = typeRank[b.type] || 9;
        if (ra !== rb) return ra - rb;
        return (b.confidence * (b.urgency || 0.1)) - (a.confidence * (a.urgency || 0.1));
      });
      _list = all;

      // Index by domain for forDomain() lookup.
      _byDomain = {};
      for (var k = 0; k < all.length; k++) {
        var doms = all[k].domains || [];
        for (var di = 0; di < doms.length; di++) {
          if (!_byDomain[doms[di]]) _byDomain[doms[di]] = [];
          _byDomain[doms[di]].push(all[k]);
        }
      }

      if (typeof window !== 'undefined') window.LIMENCrossNodeOpportunityState = { list: _list, timestamp: Date.now() };
      try {
        if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('limen:cross-node-opportunity-update', { detail: { list: _list, timestamp: Date.now() } }));
        }
      } catch (e) { /* observer-only */ }
      return _list;
    });
  }

  function _scheduleRebuild() {
    if (_timer) return;
    _timer = setTimeout(function () {
      _timer = null;
      try { recompute(); } catch (err) { /* observer-only */ }
    }, REBUILD_DEBOUNCE);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('limen:civilization-packets-update', _scheduleRebuild);
    setTimeout(function () { try { recompute(); } catch (e) {} }, 1200);

    window.LIMENCrossNodeOpportunity = {
      recompute: recompute,
      get:       function () { return _list.slice(); },
      forDomain: function (id) { return (_byDomain[id] || []).slice(); }
    };
  }
})();
