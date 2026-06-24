/**
 * civilization/handoff-contract.js
 * LIMEN HELIX — Civilization → Main Brain handoff packet producer.
 *
 * Civilization produces structured per-lane packets that the Main Brain can
 * consume to auto-generate artifacts. This module is a PRODUCER. It does
 * not generate artifacts itself — that lives in the Main Brain executor /
 * generators (limen-package-generator, oib-assembler, etc.).
 *
 * Read-only sources:
 *   LIMENCivilizationPackets       (per-domain audited truth)
 *   LIMENCrossDomainAuditState     (cross-domain audit findings)
 *   LIMENCrossNodeOpportunityState (cross-node opportunities)
 *
 * Produces:
 *   { lane, packets: [HandoffPacket, ...] } per artifact lane
 *
 * Lanes:
 *   patents, copyrights, business-grants, research-grants, nsf-project-pitch,
 *   sba-loans, franchise, investments, research-papers
 *
 * HandoffPacket shape:
 *   {
 *     opportunityId, lane,
 *     sourceDomains:  [...],
 *     sourceDiagnoses:[{ domain, label, summary, relevance }, ...],
 *     sourceTreatments:[{ domain, treatment }, ...],   // domain-brain treatment depth
 *     supportingNodes:[{ name, role }, ...],
 *     rationale, evidenceQuality, urgency, confidence,
 *     why, summary,
 *     readyForGeneration   // boolean — passes lane-specific minimum gate
 *   }
 *
 * Volume realism: NO output quotas. If nothing crosses a lane's gate, the
 * lane returns []. We never fabricate opportunity abundance.
 *
 * Provides:
 *   window.LIMENMainBrainHandoff.recompute()
 *   window.LIMENMainBrainHandoff.get()
 *   window.LIMENMainBrainHandoff.byLane(lane)
 *   window.LIMENMainBrainHandoff.summary()
 *   event 'limen:main-brain-handoff-update'
 */
(function () {
  'use strict';

  var REBUILD_DEBOUNCE = 800;

  var LANES = [
    'patents', 'copyrights', 'business-grants', 'research-grants',
    'nsf-project-pitch',
    'sba-loans', 'franchise', 'investments', 'research-papers',
    // ─── Finance-native lanes (additive) ──────────────────────────────────
    // Finance is the canonical source domain for capital-market opportunity.
    // These three lanes give finance-native signal (credit/lending, systemic
    // solvency cascades, funding/liquidity constraints) a home so it is not
    // forced through the generic 'investments' thesis lane. Mirror structure
    // of the existing lanes; only the CONTENT is financial. They never touch
    // the validated P3 distress kernel (Thing1) — they consume already-audited
    // civilization packets exactly like every other lane.
    'credit-facilities', 'systemic-risk', 'capital-access',
    // ─── Defense-native + defense-technology coupling lanes (additive) ────
    // Defense is the canonical source/negotiator domain for military-industrial
    // opportunity. 'defense-procurement' is the defense-ONLY lane (programs of
    // record, weapons-system buys, sustainment/readiness contracts). The three
    // coupling lanes (zero-day-acquisition, firmware-licensing, semiconductor-IP)
    // are EXACTLY the lane names cross-node-opportunity.js emits when technology
    // is CO-ELEVATED with defense at a node (TECH_COUPLING_LANES.defense). Until
    // now those hints were dropped at the handoff gate because no LANE_GATES
    // entry existed — defining them here lets defense-technology coupling route
    // cyber-intelligence / firmware / semiconductor-supply artifacts to the
    // defense negotiator, mirroring energy's energy-efficiency-hardware coupling.
    // Defense IDENTITY stays kinetic/industrial/readiness (LMT, RTX, NOC, GD,
    // BA, LHX, HII, LDOS, BAH, KTOS, AVAV); cyber is the technology coupling,
    // NOT defense's own content, and stays distinct from intelligence collection.
    'defense-procurement', 'zero-day-acquisition', 'firmware-licensing', 'semiconductor-IP',
    // ─── Intelligence-native lanes (additive) ─────────────────────────────
    // Intelligence is the canonical source/negotiator domain for collection,
    // all-source analysis, espionage/counterintelligence, and warning. These
    // lanes give intelligence-native signal a home so it is not forced through
    // defense's kinetic procurement lanes or technology's cyber-tooling lanes.
    //   'intelligence-operations'      — covert operations, collection tasking,
    //       analysis-fusion opportunity routed to the intelligence negotiator
    //       (analogous to 'defense-procurement' for kinetic). Single-domain.
    //   'collection-platform-acquisition' — SIGINT/HUMINT/GEOINT/OSINT platform
    //       upgrades routed to intelligence (analogous to 'defense-procurement'
    //       for weapons systems). Single-domain.
    //   'analysis-fusion-capability'   — all-source fusion / Palantir-style
    //       analysis-platform capability. Inherently multi-domain (intelligence
    //       + technology + research), so NOT single-domain.
    // Intelligence IDENTITY is collection / analysis / espionage / warning —
    // distinct from defense (kinetic/industrial/readiness) and from technology
    // (cyber tooling is a coupling, NOT intelligence's own content). Real intel-
    // sector operators anchor these lanes: PLTR, BAH, LDOS, CACI, SAIC, KBR,
    // VRNT, NICE, VRSK.
    'intelligence-operations', 'collection-platform-acquisition', 'analysis-fusion-capability',
    // ─── Trade / supplyChain coupling lane (additive) ─────────────────────
    // Trade's RUNTIME KEY in this file is 'supplyChain' (URL/portal key is
    // 'trade'; see domain-identity.js dual-naming). Trade IDENTITY = international
    // trade & commerce, exports/imports, tariffs & trade policy, shipping &
    // logistics, supply chains, trade balance, customs, trade agreements,
    // sanctions/embargoes, freight & ports — distinct from economy (macro
    // aggregate) and industry (production).
    //
    // 'supply-chain-mapping' is NOT a new invented lane: cross-node-opportunity.js
    // ALREADY emits it from TECH_COUPLING_LANES.energy and TECH_COUPLING_LANES.research
    // (technology↔energy and technology↔research co-elevation). Until now those
    // emissions were SILENTLY DROPPED at the handoff gate because no LANE_GATES
    // entry existed (recompute() skips any lane absent from LANE_GATES) — exactly
    // the dropped-hint situation the defense coupling block fixed. Defining the
    // gate here gives that already-emitted lane a home, routing supply-chain /
    // logistics-network-mapping artifacts to the trade (supplyChain) negotiator.
    // singleDomainOnly is false: a supply-chain-mapping artifact spans a logistics
    // network across multiple counterparties/sectors, so cross-node multi-domain
    // aggregations are appropriate. Real trade/logistics operators anchor this
    // lane: FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO, GXO, AMKBY, DSDVY, ODFL.
    'supply-chain-mapping',
    // ─── Industry-native PRIMARY lanes (additive) ─────────────────────────
    // Industry IDENTITY = manufacturing & industrial production, factory output
    // & capacity utilization, automation & robotics, heavy industry & capital
    // goods, industrial supply chains, machinery & equipment, and industrial
    // maintenance. Real industrial operators anchor these lanes: CAT, DE, GE,
    // HON, MMM, EMR, ITW, ETN, PH, ROK, DOV, GEV. Industry is DISTINCT from
    // trade (logistics/commerce/shipping), economy (macro aggregate), and
    // technology (automation/robotics is a COUPLING, not industry's own content).
    //
    // BEFORE this block, industry appeared ONLY as a SECONDARY co-eligible
    // participant in other domains' lanes (anyDomain lists of patents,
    // business-grants, sba-loans, franchise, nsf-project-pitch, credit-facilities,
    // systemic-risk, capital-access, defense-procurement, firmware-licensing,
    // semiconductor-IP, supply-chain-mapping). It never owned a PRIMARY source
    // lane the way defense owns 'defense-procurement' (line 76), intelligence owns
    // 'intelligence-operations' (line 96), and trade owns 'supply-chain-mapping'
    // (line 117). This block brings industry to PRIMARY-lane parity — industry is
    // the negotiator, not a support domain:
    //   'industrial-capacity-investment'  — capacity-utilization / factory-output
    //       expansion / capital-goods build-out shaped opportunity routed to the
    //       industry negotiator (analogous to 'defense-procurement' for kinetic,
    //       'intelligence-operations' for collection). Single-domain: a capacity
    //       investment is one bounded plant/line/capital-goods program.
    //   'manufacturing-modernization'     — automation / robotics / reshoring /
    //       industrial-maintenance modernization of a single bounded production
    //       base (analogous to a weapons-system modernization buy). Single-domain.
    //   'factory-output-financing'        — working-capital / equipment-financing /
    //       supplier-finance shaped opportunity for a single bounded manufacturer
    //       (analogous to 'collection-platform-acquisition' / a credit facility).
    //       Single-domain.
    //   'supply-chain-sourcing-industrial' — INDUSTRIAL sourcing / supplier-graph /
    //       input-procurement opportunity from the PRODUCTION-NODE side (the
    //       factory sourcing its raw materials, castings, machinery, components) —
    //       DISTINCT from trade's 'supply-chain-mapping' which is the logistics/
    //       freight/customs NETWORK side. Inherently multi-domain (a sourcing graph
    //       spans suppliers across sectors), so NOT single-domain.
    // Like the defense/intelligence blocks, these gates are LIVE (reachable): an
    // industry opportunity whose lane hints are empty falls through to the full
    // LANES list in recompute(), so it is tested against these industry-primary
    // gates. The paired follow-up (NOT done here — single-file edit) is promoting
    // 'industrial-capacity-investment' into DOMAIN_LANE_HINTS.industry in
    // cross-node-opportunity.js so the emitter prefers the industry-primary lane,
    // exactly as defense promoted 'defense-procurement' into its hint list.
    'industrial-capacity-investment', 'manufacturing-modernization',
    'factory-output-financing', 'supply-chain-sourcing-industrial',
    // ─── Governance-native PRIMARY lanes (additive) ───────────────────────
    // Governance IDENTITY = government & public administration, public policy &
    // rulemaking, regulation & oversight, elections & democratic institutions,
    // public finance & budgets, rule of law & institutional integrity, public-
    // services delivery, political stability & legitimacy. Governance is DISTINCT
    // from economy (macro aggregate), finance (capital markets), law (the judicial/
    // legal-SYSTEM domain), and intelligence (collection/analysis). It binds mostly
    // to INSTITUTIONS & INDICATORS, not single companies — anchored by govtech /
    // public-sector operators (TYL Tyler Technologies, MMS Maximus, BAH, LDOS, ACN,
    // GDIT) and policy/governance indices (World Bank WGI, V-Dem, OECD, GAO, CBO,
    // Federal Register), never fabricated tickers.
    //
    // BEFORE this block, governance appeared ONLY as a SECONDARY co-eligible
    // participant in copyrights (anyDomain, line 198) and was entirely absent from
    // every other lane. It never owned a PRIMARY source lane the way defense owns
    // 'defense-procurement', intelligence owns 'intelligence-operations', industry
    // owns 'industrial-capacity-investment', and trade owns 'supply-chain-mapping'.
    // This reflected the historical assumption that governance is a 'background'
    // domain that RECEIVES emissions but never ORIGINATES opportunity. Reality:
    // governance regulation (emissions caps, capital-funding mandates, permitting/
    // environmental-review timelines, prudential supervision, defense-budget
    // authorizations, IP/antitrust/data-privacy/AI policy) is the constraint that
    // SHAPES every other domain's capex and strategic decisions. This block brings
    // governance to PRIMARY-lane parity — governance is the negotiator, not support:
    //   'regulatory-compliance-modernization' — one bounded regulatory-transformation
    //       opportunity for a SINGLE agency (rulemaking modernization, oversight-
    //       platform upgrade, compliance-regime overhaul) routed to the governance
    //       negotiator (analogous to 'defense-procurement' for kinetic). Single-
    //       domain: a compliance modernization targets one bounded agency/regime.
    //   'policy-coordination-platform' — inter-agency policy-alignment / cross-branch
    //       coherence / systemic institutional-coordination opportunity routed to the
    //       governance negotiator as the PRIMARY coordinator. Inherently MULTI-domain
    //       (policy coordination spans agencies and the real-economy domains it
    //       regulates), so NOT single-domain.
    'regulatory-compliance-modernization', 'policy-coordination-platform',
    // ─── Agriculture-native PRIMARY lanes (additive) ──────────────────────
    // Agriculture IDENTITY = farming & crops, livestock & animal protein,
    // agribusiness & food production, food security & supply, fertilizers &
    // crop inputs, irrigation & agricultural water, commodity crops (corn/soy/
    // wheat), agricultural technology & precision ag, and farm economics. Real
    // agriculture operators anchor these lanes: ADM, BG, CTVA, DE, NTR, MOS, CF,
    // TSN, CAG, INGR, AGCO, FMC, and ag-commodity references (CBOT corn/soy/wheat,
    // USDA WASDE). Agriculture is DISTINCT from environment (land/water/climate is
    // a COUPLING, not agriculture's own content), trade (export logistics is a
    // COUPLING), economy (food prices is a COUPLING), and energy (biofuel/
    // fertilizer-energy is a COUPLING, never agriculture's own identity).
    //
    // BEFORE this block, agriculture appeared ONLY as a SECONDARY co-eligible
    // participant in other domains' lanes (anyDomain lists of patents, business-
    // grants, sba-loans, franchise, supply-chain-sourcing-industrial). It never
    // owned a PRIMARY source lane the way defense owns 'defense-procurement'
    // (line 76), intelligence owns 'intelligence-operations' (line 96), industry
    // owns 'industrial-capacity-investment' (line 161), and governance owns
    // 'regulatory-compliance-modernization' (line 197). This block brings
    // agriculture to PRIMARY-lane parity — agriculture is the negotiator, not a
    // support domain:
    //   'crop-input-financing'  — one bounded farm operation's fertilizer / seed /
    //       equipment capex financing (analogous to 'factory-output-financing' for
    //       a manufacturer / an SBA borrower file). Single-domain: one borrower-
    //       equivalent farm entity sourcing inputs (NTR/MOS/CF fertilizer, CTVA
    //       seed, DE/AGCO equipment).
    //   'yield-assurance'       — one bounded crop-insurance / yield-enhancement /
    //       precision-ag program for a single farm operation (analogous to a
    //       weapons-system modernization / 'manufacturing-modernization' for a
    //       single production base). Single-domain: yield assurance targets one
    //       bounded operation's crop-risk and productivity.
    //   'commodity-hedging-facility' — futures / options trading capital / commodity-
    //       risk management facility for a single agribusiness or commodity trader
    //       (CBOT corn/soy/wheat hedging; ADM/BG/INGR processor risk books). Single-
    //       domain: one bounded counterparty's hedging program (analogous to a
    //       credit facility / 'factory-output-financing').
    //   'farm-consolidation'    — farm acquisition / cooperative formation / agri-
    //       business roll-up shaped opportunity. Inherently MULTI-domain (a
    //       consolidation spans operations, finance, and the input/processing graph
    //       across counterparties), so NOT single-domain. Agriculture-primary, with
    //       controlled finance/technology/environment coupling only.
    // Like the defense/intelligence/industry/governance blocks, these gates are
    // LIVE (reachable): an agriculture opportunity whose lane hints are empty falls
    // through to the full LANES list in recompute(), so it is tested against these
    // agriculture-primary gates. The paired follow-up (NOT done here — single-file
    // edit) is promoting 'crop-input-financing' into DOMAIN_LANE_HINTS.agriculture
    // in cross-node-opportunity.js so the emitter prefers the agriculture-primary
    // lane, exactly as defense promoted 'defense-procurement' into its hint list.
    'crop-input-financing', 'yield-assurance',
    'commodity-hedging-facility', 'farm-consolidation',
    // ─── Medicine-native PRIMARY lanes (additive) ─────────────────────────
    // Medicine RUNTIME KEY in this file is 'health' (URL/portal key is 'medicine';
    // see domain-identity.js dual-naming: medicine → snapshotKey 'health'). Medicine
    // IDENTITY = healthcare & medicine, pharmaceuticals & biotech, hospitals & care
    // providers, medical devices & diagnostics, public health & disease control,
    // clinical research & trials, health systems & insurance, and drug development.
    // Real healthcare operators anchor these lanes: UNH (managed care/insurance),
    // HCA, CVS (providers / health systems), JNJ, PFE, MRK, ABBV, LLY, AMGN, GILD
    // (pharma/biotech), TMO, ABT, MDT, ISRG (devices/diagnostics/tools). Medicine is
    // DISTINCT from science (basic research is a COUPLING, not medicine's clinical/
    // care identity), population (demographics/disease-burden is a COUPLING, not
    // medicine's content), and economy (macro aggregate).
    //
    // BEFORE this block, medicine appeared ONLY as a SECONDARY co-eligible participant
    // in other domains' lanes (anyDomain lists of patents (line 337), research-grants
    // (line 343), nsf-project-pitch (line 354), research-papers (line 358)). It NEVER
    // owned a PRIMARY source lane the way defense owns 'defense-procurement' (line 76),
    // intelligence owns 'intelligence-operations' (line 96), industry owns 'industrial-
    // capacity-investment' (line 161), governance owns 'regulatory-compliance-
    // modernization' (line 197), agriculture owns 'crop-input-financing' (line 246),
    // and communication owns 'broadcast-infrastructure-modernization' (line 301). This
    // block brings medicine to PRIMARY-lane parity — medicine is the negotiator, not a
    // support domain:
    //   'clinical-trial-capacity' — one bounded clinical-trial program expansion /
    //       site activation / trial-capacity build-out routed to the medicine
    //       negotiator (analogous to 'defense-procurement' for kinetic, 'industrial-
    //       capacity-investment' for capacity). Single-domain: one bounded trial /
    //       program. Medicine-primary, with the trial-adjacent domains (finance =
    //       trial financing, technology = electronic-health-record / clinical-data
    //       management, research = protocol & academic partnership, governance = FDA
    //       regulatory pathway). Anchored by trial-running operators (PFE, MRK, LLY,
    //       AMGN, GILD pharma; TMO, ABT clinical tools/diagnostics; HCA, UNH care &
    //       trial-site networks). Passing this gate signals only "sufficient packet
    //       detail to attempt a clinical-trial-capacity note" — NOT trial eligibility,
    //       NOT IRB/FDA approval, NOT any prediction of outcome.
    //   'drug-development-financing' — one bounded company's R&D-stage drug / biotech-
    //       platform financing (analogous to 'factory-output-financing' for a
    //       manufacturer / an SBA borrower file). Single-domain: one borrower-
    //       equivalent pharma/biotech entity. Medicine-primary, with the financing-
    //       origination domains (finance = the lender, economy = the pharma R&D/capex
    //       cycle, technology = AI-drug-discovery platform, research = the discovery
    //       pipeline). Anchored by pipeline-stage operators (LLY, ABBV, GILD, AMGN,
    //       PFE, MRK pharma/biotech; TMO, ABT, MDT, ISRG device/diagnostics R&D).
    //   'healthcare-provider-consolidation' — hospital acquisition / health-system
    //       roll-up / provider-network integration shaped opportunity. Inherently
    //       MULTI-domain (it spans clinical operations, finance acquisition capital,
    //       and the payor/governance regulation), so NOT single-domain. Medicine-
    //       primary, with the consolidation-adjacent domains (finance = acquisition
    //       capital, governance = antitrust / certificate-of-need / payor regulation,
    //       law = the merger/regulatory legal regime). Anchored by provider / health-
    //       system / managed-care operators (HCA, CVS, UNH; with provider networks).
    // Like the defense/intelligence/industry/governance/agriculture/communication
    // blocks, these gates are LIVE (reachable): a medicine opportunity whose lane hints
    // are empty falls through to the full LANES list in recompute(), so it is tested
    // against these medicine-primary gates. The paired follow-up (NOT done here —
    // single-file edit) is promoting 'clinical-trial-capacity' into DOMAIN_LANE_HINTS
    // for medicine/health in cross-node-opportunity.js so the emitter prefers the
    // medicine-primary lane, exactly as defense promoted 'defense-procurement'.
    'clinical-trial-capacity', 'drug-development-financing',
    'healthcare-provider-consolidation',
    // ─── Communication-native PRIMARY lanes (additive) ────────────────────
    // Communication IDENTITY = telecommunications & networks, connectivity &
    // broadband, internet infrastructure (towers / fiber / spectrum), media &
    // broadcasting CHANNELS, journalism & news flow, information dissemination,
    // social-media platforms AS DISTRIBUTION, and public-discourse infrastructure.
    // Real telecom/media/network operators anchor these lanes: VZ, T, TMUS,
    // CMCSA, CHTR (carriers/cable); CSCO, ANET (network gear); AMT, CCI, SBAC
    // (towers / wireless infrastructure REITs); NWSA, NYT (news/publishing);
    // META, GOOGL (social-media / search AS DISTRIBUTION CHANNELS). Communication
    // is DISTINCT from culture (culture = content / movements / scenes; communication
    // = the CHANNELS / networks / information-flow that carry it), from technology
    // (chips/software is a COUPLING, not communication's own content), and from
    // intelligence (signals COLLECTION is a COUPLING, not communication's open
    // dissemination identity).
    //
    // BEFORE this block, communication appeared ONLY as a SECONDARY co-eligible
    // participant in copyrights (anyDomain, line 283) and research-papers, and was
    // absent from every other lane. It never owned a PRIMARY source lane the way
    // defense owns 'defense-procurement' (line 76), intelligence owns
    // 'intelligence-operations' (line 96), industry owns 'industrial-capacity-
    // investment' (line 161), governance owns 'regulatory-compliance-modernization'
    // (line 197), and agriculture owns 'crop-input-financing' (line 246). This block
    // brings communication to PRIMARY-lane parity — communication is the negotiator,
    // not a support domain:
    //   'broadcast-infrastructure-modernization' — one bounded telecom / spectrum /
    //       fiber / tower capex program (5G build-out, fiber-to-the-home, spectrum
    //       refarm, tower densification) for a single bounded carrier / infra REIT
    //       routed to the communication negotiator (analogous to 'defense-procurement'
    //       for kinetic, 'industrial-capacity-investment' for capacity). Single-domain:
    //       a network-modernization program targets one bounded operator's plant
    //       (VZ/T/TMUS carriers, AMT/CCI/SBAC towers, CSCO/ANET gear). Anchored to
    //       FCC spectrum-license & broadband-deployment regulatory indicators.
    //   'media-ownership-restructuring' — antitrust / consolidation / divestiture /
    //       station-portfolio restructuring opportunity in the media & broadcasting
    //       CHANNEL layer (NWSA/NYT publishing, CMCSA/CHTR cable distribution) routed
    //       to the communication negotiator. Inherently MULTI-domain (a media
    //       restructuring spans the channel operator, governance/FCC ownership-cap
    //       rulemaking, and finance acquisition capital), so NOT single-domain.
    //   'information-integrity-platform' — disinformation-resistance / content-
    //       moderation / provenance / trust-and-safety platform opportunity at the
    //       information-DISSEMINATION layer (META/GOOGL social-media & search AS
    //       DISTRIBUTION, news-flow integrity). Inherently MULTI-domain (integrity
    //       spans the platform, governance policy, and technology tooling), so NOT
    //       single-domain. DISTINCT from intelligence (this is OPEN dissemination
    //       integrity, not covert signals collection).
    // Like the defense/intelligence/industry/governance/agriculture blocks, these
    // gates are LIVE (reachable): a communication opportunity whose lane hints are
    // empty falls through to the full LANES list in recompute(), so it is tested
    // against these communication-primary gates. The paired follow-up (NOT done here
    // — single-file edit) is promoting 'broadcast-infrastructure-modernization' into
    // DOMAIN_LANE_HINTS.communication in cross-node-opportunity.js so the emitter
    // prefers the communication-primary lane, exactly as defense promoted
    // 'defense-procurement' into its hint list.
    'broadcast-infrastructure-modernization', 'media-ownership-restructuring',
    'information-integrity-platform',
    // ─── Education-native PRIMARY lanes (additive) ────────────────────────
    // Education IDENTITY = schools & universities (K-12 + higher ed), edtech &
    // online learning, student outcomes & literacy, teaching & curriculum,
    // education funding & access/equity, workforce training & skills, credentialing
    // & enrollment, and student debt. Real education-sector operators anchor these
    // lanes: CHGG (Chegg), COUR (Coursera), DUOL (Duolingo), LRN (Stride/K12),
    // ATGE (Adtalem), LOPE (Grand Canyon Education), STRA (Strategic Education),
    // LAUR (Laureate), TWOU (2U), UTI (Universal Technical Institute). Education is
    // DISTINCT from science (basic research is the science/research domain, a
    // COUPLING — not education's teaching/outcomes content), population
    // (demographics/enrollment-pool is a COUPLING, not education's content),
    // technology (edtech tooling/LMS is a COUPLING, not education's own identity),
    // and economy (workforce/skills macro is a COUPLING, not education's content).
    //
    // BEFORE this block, education appeared ONLY as a SECONDARY co-eligible
    // participant in other domains' lanes (anyDomain lists of business-grants
    // (line 402), research-grants (line 403), research-papers (line 418)). It NEVER
    // owned a PRIMARY source lane the way defense owns 'defense-procurement' (line 76),
    // intelligence owns 'intelligence-operations' (line 96), industry owns 'industrial-
    // capacity-investment' (line 161), governance owns 'regulatory-compliance-
    // modernization' (line 197), agriculture owns 'crop-input-financing' (line 246),
    // medicine owns 'clinical-trial-capacity' (line 306), and communication owns
    // 'broadcast-infrastructure-modernization' (line 361). This block brings education
    // to PRIMARY-lane parity — education is the negotiator, not a support domain:
    //   'student-outcome-improvement' — one bounded K-12 / higher-ed student-
    //       achievement program (literacy, graduation/completion, learning-loss
    //       recovery, outcome-measurement) for a single bounded institution / district
    //       routed to the education negotiator (analogous to 'defense-procurement' for
    //       kinetic, 'clinical-trial-capacity' for capacity). Single-domain: one bounded
    //       achievement program. Anchored by outcome operators (CHGG, COUR, DUOL, LRN).
    //   'curriculum-modernization' — pedagogical / content / delivery modernization
    //       (online/blended delivery, curriculum redesign, edtech-enabled instruction)
    //       for a single bounded institution (analogous to 'manufacturing-modernization'
    //       for a single production base). Single-domain. Anchored by COUR, DUOL, TWOU,
    //       LRN (online/blended delivery operators).
    //   'teacher-development-funding' — recruitment / training / professional-
    //       development funding for a single bounded district / institution (analogous to
    //       'factory-output-financing' / an SBA borrower file). Single-domain: one
    //       borrower-equivalent district/institution. Anchored by ATGE, LOPE, STRA, UTI
    //       (teacher-prep / credentialing operators).
    //   'access-equity-program' — enrollment growth / access-barrier removal for a
    //       single bounded population (financial-aid expansion, first-gen access,
    //       affordability, student-debt relief). Single-domain: one bounded population.
    //       Anchored by LOPE, STRA, ATGE, LAUR (broad-access enrollment operators).
    //   'institutional-consolidation' — merger / affiliation / partnership across
    //       schools/universities. Inherently MULTI-domain (a consolidation spans
    //       operations, finance acquisition capital, and the accreditation/governance
    //       regime across counterparties), so NOT single-domain. Anchored by ATGE,
    //       LAUR, STRA, LOPE (multi-institution operators).
    // Like the defense/intelligence/industry/governance/agriculture/medicine/
    // communication blocks, these gates are LIVE (reachable): an education opportunity
    // whose lane hints are empty falls through to the full LANES list in recompute(),
    // so it is tested against these education-primary gates. The paired follow-up (NOT
    // done here — single-file edit) is promoting 'student-outcome-improvement' into
    // DOMAIN_LANE_HINTS.education in cross-node-opportunity.js so the emitter prefers
    // the education-primary lane, exactly as defense promoted 'defense-procurement'.
    'student-outcome-improvement', 'curriculum-modernization',
    'teacher-development-funding', 'access-equity-program',
    'institutional-consolidation'
    // ─── DESIGN NOTE — future trade-native lanes (NOT added now) ──────────
    // Per the wiring-gap analysis: trade currently participates as a SECONDARY
    // participant (via supplyChain in business-grants/sba-loans/franchise/credit-
    // facilities/systemic-risk/capital-access and now supply-chain-mapping), never
    // as a PRIMARY source negotiator the way defense owns 'defense-procurement' or
    // intelligence owns 'intelligence-operations'. A future handoff expansion could
    // add trade-PRIMARY lanes — 'supply-chain-resilience' (trade↔infrastructure:
    // port/freight-network resilience investments), 'logistics-financing'
    // (trade↔finance: working capital / supplier financing), 'trade-compliance-tech'
    // (trade↔technology: customs/EDI/tariff-classification platforms). These are
    // DELIBERATELY NOT added here because no cross-node emitter produces those lane
    // names yet — adding them now would create dead tokens (the dead-token
    // discipline the finance/intelligence blocks observe). Add them only once
    // cross-node-opportunity.js emits them.
  ];

  // ─── Lane gates — minimum quality requirements per artifact type ────────
  // Conservative: only "readyForGeneration" if the gate is genuinely passed.
  // Below the gate, the packet still emits but with readyForGeneration=false
  // so Main Brain can decide.
  //
  // singleDomainOnly: when true, the lane only accepts opportunities whose
  // sourceDomains is exactly one domain. Multi-domain cross-node aggregations
  // are NEVER appropriate for these lanes because each artifact represents
  // a single bounded entity:
  //   - patents:      one invention, one technical mechanism, one inventor set
  //   - franchise:    one replicable unit operating in one regulated FDD scope
  //   - investments:  one thesis, one position-sized bet
  //   - sba-loans:    one borrower entity, one SBA 7(a)/504 file
  // Cross-node multi-domain opportunities still emit packets for the
  // explicitly multi-domain-friendly lanes (research-papers, research-grants,
  // nsf-project-pitch, business-grants, copyrights) so signal is never lost
  // — only routed away from lanes where it would produce garbage filings.
  var LANE_GATES = {
    'patents':         { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['technology','energy','infrastructure','industry','medicine','defense','agriculture'] },
    'copyrights':      { minEvidence: 0.45, minConfidence: 0.50, singleDomainOnly: false, anyDomain: ['culture','communication','religion','governance','law','intelligence'] },
    // business-grants — governance added (additive): governance shapes permitting /
    //   environmental-review / public-funding-mandate timelines that gate the capex
    //   business-grant opportunities originate from (infrastructure-native coupling).
    'business-grants': { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['agriculture','industry','infrastructure','supplyChain','education','energy','technology','governance'] },
    'research-grants': { minEvidence: 0.55, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['research','education','medicine','health','science','environment'] },
    // nsf-project-pitch — NSF SBIR/STTR Project Pitch lane. Stricter than the
    // generic research-grants gate: NSF demands BOTH technical innovation AND
    // commercial potential, so minConfidence is bumped. Passing this gate only
    // signals "sufficient packet detail exists to attempt a Project Pitch
    // draft." It does NOT signal NSF eligibility, submission readiness, fit
    // with NSF priorities, reviewer alignment, or any prediction of award.
    // nsf-project-pitch — governance added (additive): governance owns the public-
    //   research-funding mandates / agency priorities / regulatory-clarity that shape
    //   whether a publicly-funded innovation pitch is fundable (infrastructure/public-
    //   finance coupling). Does NOT signal NSF eligibility — only packet detail.
    'nsf-project-pitch': { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: false, anyDomain: ['research','technology','medicine','health','science','energy','infrastructure','environment','industry','governance'] },
    'sba-loans':       { minEvidence: 0.45, minConfidence: 0.50, singleDomainOnly: true,  anyDomain: ['economy','finance','industry','agriculture','supplyChain','infrastructure','technology'] },
    'franchise':       { minEvidence: 0.45, minConfidence: 0.50, singleDomainOnly: true,  anyDomain: ['supplyChain','industry','culture','agriculture'] },
    'investments':     { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['finance','economy','technology','energy','infrastructure'] },
    'research-papers': { minEvidence: 0.40, minConfidence: 0.45, singleDomainOnly: false, anyDomain: ['research','medicine','health','science','education','population','environment'] },
    // ─── Finance-native lane gates (additive) ─────────────────────────────
    // credit-facilities — one borrower / one syndication / one credit line.
    //   singleDomainOnly: a credit facility is a single bounded counterparty
    //   relationship (like sba-loans / a patent), so cross-node multi-domain
    //   aggregations are routed away. Finance-primary, with the lending-
    //   adjacent real-economy domains that originate credit demand.
    //   Governance added (additive): prudential supervision / public-finance &
    //   budget authority / monetary-policy regime is governance's regulatory domain,
    //   and it shapes (and originates, via public-credit programs) credit demand.
    'credit-facilities':  { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: true,  anyDomain: ['finance','economy','industry','infrastructure','supplyChain','technology','governance'] },
    // systemic-risk — solvency cascades / contagion / liquidity-spiral signal.
    //   Inherently cross-domain (contagion crosses sector boundaries), so
    //   singleDomainOnly is false. Higher evidence/confidence bar: a systemic-
    //   risk packet asserts cross-sector transmission, which demands stronger
    //   support than a single-name thesis. Passing this gate signals only
    //   "sufficient packet detail to attempt a systemic-risk note" — NOT a
    //   prediction of any crisis, and NOT the validated P3 distress kernel.
    //   Governance added (additive): institutional credibility / policy-coherence /
    //   regulatory-clarity / legitimacy is a primary systemic-risk transmission
    //   channel (prudential-supervision gaps, oversight failures, policy-credibility
    //   shocks) — governance's regulatory regime is where systemic risk originates.
    'systemic-risk':      { minEvidence: 0.60, minConfidence: 0.60, singleDomainOnly: false, anyDomain: ['finance','economy','infrastructure','supplyChain','technology','governance'] },
    // capital-access — funding constraints / liquidity gaps / capital-raise
    //   shaped opportunity. Multi-domain-friendly (a capital-access thesis can
    //   span a sector cohort), so singleDomainOnly is false.
    //   Governance added (additive): public finance / fiscal-constraint / budget
    //   stress and the permitting & public-funding mandates governance controls
    //   directly gate capital-access (infrastructure & public-finance coupling).
    'capital-access':     { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['finance','economy','industry','infrastructure','energy','technology','governance'] },
    // ─── Defense-native + defense-technology coupling lane gates (additive) ──
    // defense-procurement — one program of record / one weapons-system buy /
    //   one sustainment-readiness contract for a single bounded prime or
    //   borrower-equivalent. singleDomainOnly: a procurement artifact represents
    //   a single bounded acquisition (like sba-loans / a patent), so cross-node
    //   multi-domain aggregations are routed away. Defense-primary, with the
    //   industrial-base / readiness-adjacent real-economy domains that originate
    //   defense demand (industry = defense industrial base, infrastructure =
    //   basing/logistics, energy = fuel/strategic-reserve coupling, technology =
    //   weapons-system electronics). Passing this gate signals only "sufficient
    //   packet detail to attempt a procurement note" — NOT contract award, NOT
    //   eligibility, NOT any prediction. Real defense primes: LMT, RTX, NOC, GD,
    //   BA, LHX, HII, LDOS, BAH, KTOS, AVAV. Distinct from intelligence
    //   (collection/analysis) and from technology (cyber is a coupling, below).
    'defense-procurement':   { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['defense','industry','infrastructure','energy','technology'] },
    // zero-day-acquisition — defense↔technology coupling. Fires when technology
    //   is co-elevated with defense at a node (TECH_COUPLING_LANES.defense).
    //   Cyber-intelligence / offensive-capability acquisition shaped opportunity
    //   routed to the defense negotiator. Higher evidence/confidence bar: an
    //   acquisition assertion of an offensive cyber capability demands stronger
    //   support. singleDomainOnly false — coupling is inherently multi-domain
    //   (defense + technology present together). Cyber here is the technology
    //   coupling content, NOT defense's own kinetic identity.
    'zero-day-acquisition':  { minEvidence: 0.60, minConfidence: 0.60, singleDomainOnly: false, anyDomain: ['defense','technology','intelligence','infrastructure'] },
    // firmware-licensing — defense↔technology (and energy↔technology) coupling.
    //   Firmware / embedded-control licensing for weapons-system or platform
    //   electronics routed to the negotiating domain. singleDomainOnly false
    //   (coupling). Mirrors energy's firmware-licensing coupling lane exactly;
    //   the gate is shared because the artifact shape is identical regardless of
    //   whether defense or energy is the co-elevated partner.
    'firmware-licensing':    { minEvidence: 0.55, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['defense','technology','energy','industry','infrastructure'] },
    // semiconductor-IP — defense↔technology (and finance/research↔technology)
    //   coupling. Semiconductor-IP / chip-supply licensing shaped opportunity
    //   (the "semiconductor-supply-chain" concern in the gap spec) routed to the
    //   co-elevated negotiator. singleDomainOnly false (coupling). Shared gate
    //   with the technology/finance/research coupling that already emits this
    //   lane name — additive: defense joins the allowed domains, never replaces.
    'semiconductor-IP':      { minEvidence: 0.55, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['defense','technology','finance','research','industry','infrastructure'] },
    // ─── Intelligence-native lane gates (additive) ────────────────────────
    // intelligence-operations — one bounded covert operation / collection
    //   tasking / analysis-fusion engagement routed to the intelligence
    //   negotiator (analogous to defense-procurement for kinetic). Single-
    //   domain: an operation artifact represents a single bounded engagement,
    //   so cross-node multi-domain aggregations are routed away. Intelligence-
    //   primary, with the collection-adjacent real-economy domains that
    //   originate intelligence demand (defense = mission tasking, technology =
    //   collection sensors/processing, infrastructure = basing/ground stations).
    //   Passing this gate signals only "sufficient packet detail to attempt an
    //   intelligence-operations note" — NOT tasking authority, NOT clearance,
    //   NOT any prediction. Real intel-sector operators: PLTR, BAH, LDOS, CACI,
    //   SAIC, KBR, VRNT, NICE, VRSK. Distinct from defense (kinetic) and from
    //   technology (cyber is a coupling, not intelligence's collection identity).
    'intelligence-operations':         { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['intelligence','defense','technology','infrastructure'] },
    // collection-platform-acquisition — one bounded SIGINT/HUMINT/GEOINT/OSINT
    //   platform upgrade / sensor buy / collection-capability acquisition routed
    //   to the intelligence negotiator (analogous to defense-procurement for
    //   weapons systems). Single-domain: a platform acquisition is a single
    //   bounded buy. Intelligence-primary, with the platform-adjacent domains
    //   that supply collection hardware (defense = ISR platforms, technology =
    //   sensors/payloads, infrastructure = ground stations / downlink).
    'collection-platform-acquisition': { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['intelligence','defense','technology','infrastructure'] },
    // analysis-fusion-capability — all-source fusion / Palantir-style analysis-
    //   platform capability. Inherently MULTI-domain (fusion combines collection,
    //   compute, and research), so singleDomainOnly is false. Slightly lower bar
    //   than the operations/platform lanes because a fusion-capability note is an
    //   analytic artifact, not a bounded acquisition. Intelligence + technology +
    //   research are the native fusion partners. Passing this gate signals only
    //   "sufficient packet detail to attempt an analysis-fusion-capability note."
    'analysis-fusion-capability':      { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['intelligence','technology','research','defense','infrastructure'] },
    // ─── Trade / supplyChain coupling lane gate (additive) ────────────────
    // supply-chain-mapping — logistics-network / freight-route / supplier-graph
    //   mapping artifact routed to the trade (supplyChain) negotiator. Fires when
    //   technology is co-elevated with energy or research at a node (already
    //   emitted by TECH_COUPLING_LANES.energy / .research in cross-node-opportunity.js),
    //   and is also reachable when an opportunity touches supplyChain directly.
    //   singleDomainOnly false: a supply-chain map spans a logistics network
    //   across multiple counterparties/sectors, so multi-domain cross-node
    //   aggregations are appropriate (unlike sba-loans/franchise which bound a
    //   single entity). Trade-primary, with the logistics-adjacent domains that
    //   originate supply-chain mapping demand (supplyChain = the trade runtime key,
    //   technology = EDI/visibility platforms, infrastructure = ports/freight
    //   corridors, industry = production nodes, energy/research = the co-elevating
    //   technology partners that emit this lane). Passing this gate signals only
    //   "sufficient packet detail to attempt a supply-chain-mapping note" — NOT a
    //   logistics decision, NOT an award, NOT any prediction. Real trade/logistics
    //   operators: FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO, GXO, AMKBY, DSDVY, ODFL.
    //   Distinct from economy (macro aggregate) and industry (production).
    //   Governance added (additive): trade agreements, customs policy, sanctions/
    //   embargo enforcement and trade-compliance rulemaking are governance domain
    //   (not trade's identity) and reshape the logistics-network map governance
    //   constrains — supplyChain coupling on the policy/enforcement side.
    'supply-chain-mapping':            { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['supplyChain','technology','infrastructure','industry','energy','research','governance'] },
    // ─── Industry-native PRIMARY lane gates (additive) ────────────────────
    // industrial-capacity-investment — one bounded plant / production line /
    //   capital-goods capacity program routed to the industry negotiator
    //   (analogous to defense-procurement / intelligence-operations as a PRIMARY
    //   single-domain lane). singleDomainOnly: a capacity investment is a single
    //   bounded production asset, so cross-node multi-domain aggregations are
    //   routed away. Industry-primary, with the capacity-adjacent real-economy
    //   domains that originate industrial demand (infrastructure = plant siting/
    //   utilities, energy = process power, technology = automation coupling,
    //   supplyChain = input feed, economy = capex cycle). Passing this gate signals
    //   only "sufficient packet detail to attempt an industrial-capacity note" —
    //   NOT a capex decision, NOT financing, NOT any prediction. Real industrial
    //   operators: CAT, DE, GE, HON, MMM, EMR, ITW, ETN, PH, ROK, DOV, GEV.
    //   Distinct from trade (logistics), economy (macro), technology (automation
    //   is a coupling, not industry's own content).
    'industrial-capacity-investment':  { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['industry','infrastructure','energy','technology','supplyChain','economy'] },
    // manufacturing-modernization — one bounded production base's automation /
    //   robotics / reshoring / industrial-maintenance modernization (analogous to
    //   a weapons-system modernization buy). singleDomainOnly: a modernization
    //   program targets a single bounded manufacturer. Industry-primary, with the
    //   modernization-adjacent domains (technology = robotics/automation coupling,
    //   infrastructure = facility/utility upgrade, supplyChain = retooled input
    //   flow, energy = electrification of process heat).
    'manufacturing-modernization':     { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['industry','technology','infrastructure','supplyChain','energy'] },
    // factory-output-financing — one bounded manufacturer's working-capital /
    //   equipment-financing / supplier-finance facility (analogous to sba-loans /
    //   credit-facilities / collection-platform-acquisition as a single bounded
    //   counterparty file). singleDomainOnly: one borrower-equivalent production
    //   entity. Industry-primary, with the financing-origination domains
    //   (finance = the lender, economy = the capex/credit cycle, supplyChain =
    //   the receivables/inventory base, infrastructure = financed plant assets).
    'factory-output-financing':        { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: true,  anyDomain: ['industry','finance','economy','supplyChain','infrastructure'] },
    // supply-chain-sourcing-industrial — industrial INPUT sourcing / supplier-graph
    //   / raw-material & component procurement from the PRODUCTION-NODE side
    //   (the factory sourcing castings, machinery, components, raw materials).
    //   DISTINCT from trade's 'supply-chain-mapping' (the logistics/freight/customs
    //   NETWORK side): this is the industrial buyer's sourcing graph, not the
    //   carrier's route map. singleDomainOnly false: an industrial sourcing graph
    //   spans suppliers across multiple sectors/counterparties, so multi-domain
    //   cross-node aggregations are appropriate. Industry-primary, with the
    //   sourcing-adjacent domains (supplyChain = the upstream supplier network,
    //   infrastructure = sourcing logistics, technology = supplier-visibility
    //   platforms, energy = energy-input sourcing, agriculture = bio-feedstock
    //   inputs). Passing this gate signals only "sufficient packet detail to
    //   attempt an industrial-sourcing note" — NOT a sourcing decision, NOT a
    //   contract, NOT any prediction.
    'supply-chain-sourcing-industrial':{ minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['industry','supplyChain','infrastructure','technology','energy','agriculture'] },
    // ─── Governance-native PRIMARY lane gates (additive) ──────────────────
    // regulatory-compliance-modernization — one bounded regulatory-transformation
    //   opportunity for a SINGLE agency / regime (rulemaking modernization,
    //   oversight-platform upgrade, compliance-regime overhaul) routed to the
    //   governance negotiator (analogous to defense-procurement / intelligence-
    //   operations / industrial-capacity-investment as a PRIMARY single-domain
    //   lane). singleDomainOnly: a compliance modernization targets one bounded
    //   agency/regime, so cross-node multi-domain aggregations are routed away.
    //   Governance-primary, with the modernization-adjacent domains it regulates
    //   and that supply the platform (law = the legal/judicial regime governance
    //   coordinates with but is distinct from, technology = govtech/regtech
    //   platforms, infrastructure = permitting/public-works regimes). Passing this
    //   gate signals only "sufficient packet detail to attempt a regulatory-
    //   modernization note" — NOT a rulemaking, NOT an award, NOT any prediction.
    //   Governance binds to INSTITUTIONS & INDICATORS (World Bank WGI, V-Dem, OECD,
    //   GAO, CBO, Federal Register); where entities are needed, real govtech/public-
    //   sector operators anchor it: TYL, MMS, BAH, LDOS, ACN, GDIT. Distinct from
    //   economy (macro), finance (capital), law (judicial), intelligence.
    'regulatory-compliance-modernization': { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['governance','law','technology','infrastructure'] },
    // policy-coordination-platform — inter-agency policy-alignment / cross-branch
    //   coherence / systemic institutional-coordination opportunity routed to the
    //   governance negotiator as the PRIMARY coordinator. Inherently MULTI-domain
    //   (policy coordination spans agencies and the real-economy domains it
    //   regulates), so singleDomainOnly is false. Slightly lower bar than the
    //   modernization lane because a coordination note is an institutional-analysis
    //   artifact, not a bounded acquisition. Governance-primary, with the macro/
    //   public-finance partners coordination spans (law = legal-framework coherence,
    //   economy = macro policy levers, finance = fiscal/monetary regime). Passing
    //   this gate signals only "sufficient packet detail to attempt a policy-
    //   coordination note" — NOT a policy decision, NOT authority, NOT any prediction.
    'policy-coordination-platform':       { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['governance','law','economy','finance'] },
    // ─── Agriculture-native PRIMARY lane gates (additive) ─────────────────
    // crop-input-financing — one bounded farm operation's fertilizer / seed /
    //   equipment capex financing routed to the agriculture negotiator
    //   (analogous to factory-output-financing / sba-loans as a single bounded
    //   counterparty file). singleDomainOnly: one borrower-equivalent farm entity,
    //   so cross-node multi-domain aggregations are routed away. Agriculture-
    //   primary, with the financing-origination domains (finance = the lender,
    //   economy = the farm-credit/capex cycle, technology = precision-ag input
    //   optimization, industry = equipment/machinery supply). Passing this gate
    //   signals only "sufficient packet detail to attempt a crop-input-financing
    //   note" — NOT a lending decision, NOT any prediction. Real ag-input
    //   operators: NTR, MOS, CF, CTVA, FMC (inputs); DE, AGCO (equipment).
    //   Distinct from environment (land/water/climate coupling), trade (export
    //   logistics coupling), economy (food prices coupling), energy (fertilizer-
    //   energy coupling) — none of which is agriculture's own content.
    'crop-input-financing':       { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: true,  anyDomain: ['agriculture','finance','economy','technology','industry'] },
    // yield-assurance — one bounded crop-insurance / yield-enhancement / precision-
    //   ag program for a single farm operation (analogous to manufacturing-
    //   modernization for a single production base). singleDomainOnly: yield
    //   assurance targets one bounded operation's crop-risk and productivity.
    //   Agriculture-primary, with the assurance-adjacent domains (finance = crop-
    //   insurance underwriting, technology = precision-ag / satellite yield models,
    //   environment = the agronomic-conditions COUPLING that informs but is not
    //   agriculture's content). Passing this gate signals only "sufficient packet
    //   detail to attempt a yield-assurance note" — NOT an underwriting decision,
    //   NOT any prediction. Anchored by CTVA (seed/traits), FMC (crop protection),
    //   DE/AGCO (precision-ag platforms), with USDA WASDE yield context.
    'yield-assurance':            { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['agriculture','finance','technology','environment'] },
    // commodity-hedging-facility — futures / options trading capital / commodity-
    //   risk-management facility for a single agribusiness or commodity trader
    //   (CBOT corn/soy/wheat hedging; processor/merchant risk books). singleDomainOnly:
    //   one bounded counterparty's hedging program (analogous to a credit facility /
    //   factory-output-financing). Agriculture-primary, with the hedging-origination
    //   domains (finance = the futures/options counterparty & clearing, economy =
    //   the commodity-price cycle, trade = the physical-flow COUPLING that the
    //   hedge offsets). Passing this gate signals only "sufficient packet detail to
    //   attempt a commodity-hedging note" — NOT a trading decision, NOT a position,
    //   NOT any prediction. Real ag-merchant/processor operators: ADM, BG, INGR
    //   (grain/oilseed processing & merchandising); CBOT corn/soy/wheat references.
    'commodity-hedging-facility': { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['agriculture','finance','economy','supplyChain'] },
    // farm-consolidation — farm acquisition / cooperative formation / agribusiness
    //   roll-up shaped opportunity. Inherently MULTI-domain (a consolidation spans
    //   operations, finance, and the input/processing graph across counterparties),
    //   so singleDomainOnly is false. Slightly lower bar than the single-bounded
    //   lanes because a consolidation note is a multi-counterparty structural
    //   artifact, not a single bounded file. Agriculture-primary, with the
    //   consolidation-adjacent domains (finance = the acquisition capital, economy =
    //   the farm-economics/scale cycle, technology = the precision-ag platform that
    //   scales across acquired acreage). Passing this gate signals only "sufficient
    //   packet detail to attempt a farm-consolidation note" — NOT an acquisition
    //   decision, NOT any prediction. Anchored by integrators/processors ADM, BG,
    //   TSN, CAG, INGR and the farm-equipment scale partners DE, AGCO.
    'farm-consolidation':         { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['agriculture','finance','economy','technology'] },
    // ─── Medicine-native PRIMARY lane gates (additive) ────────────────────
    // Medicine RUNTIME KEY is 'health' (URL/portal key 'medicine'; domain-identity.js
    // dual-naming). Both 'medicine' and 'health' are listed in anyDomain so the gate
    // matches whichever key the upstream packet/opportunity carries — exactly as
    // research-grants (line 343), nsf-project-pitch (line 354), and research-papers
    // (line 358) list BOTH medicine and health. Medicine is DISTINCT from science
    // (basic research is a coupling), population (disease-burden is a coupling), and
    // economy (macro aggregate).
    //
    // clinical-trial-capacity — one bounded clinical-trial program expansion / site
    //   activation / trial-capacity build-out routed to the medicine negotiator
    //   (analogous to defense-procurement / industrial-capacity-investment as a PRIMARY
    //   single-domain lane). singleDomainOnly: one bounded trial / program, so cross-
    //   node multi-domain aggregations are routed away. Medicine-primary, with the
    //   trial-adjacent domains that originate trial demand (research = protocol &
    //   academic partnership, technology = EHR / clinical-data management, finance =
    //   trial financing, governance = FDA regulatory pathway). Passing this gate
    //   signals only "sufficient packet detail to attempt a clinical-trial-capacity
    //   note" — NOT trial eligibility, NOT IRB/FDA approval, NOT any prediction. Real
    //   trial-running operators: PFE, MRK, LLY, AMGN, GILD (pharma); TMO, ABT (clinical
    //   tools/diagnostics); HCA, UNH (care & trial-site networks).
    'clinical-trial-capacity':         { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['medicine','health','research','technology','finance','governance'] },
    // drug-development-financing — one bounded company's R&D-stage drug / biotech-
    //   platform financing (analogous to factory-output-financing / sba-loans / crop-
    //   input-financing as a single bounded counterparty file). singleDomainOnly: one
    //   borrower-equivalent pharma/biotech entity. Medicine-primary, with the financing-
    //   origination domains (finance = the lender, economy = the pharma R&D/capex cycle,
    //   technology = AI-drug-discovery platform, research = the discovery pipeline,
    //   governance = the regulatory-approval pathway that gates financeability).
    //   Passing this gate signals only "sufficient packet detail to attempt a drug-
    //   development-financing note" — NOT a lending decision, NOT approval, NOT any
    //   prediction. Real pipeline-stage operators: LLY, ABBV, GILD, AMGN, PFE, MRK
    //   (pharma/biotech); TMO, ABT, MDT, ISRG (device/diagnostics R&D).
    'drug-development-financing':       { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: true,  anyDomain: ['medicine','health','finance','technology','research','governance'] },
    // healthcare-provider-consolidation — hospital acquisition / health-system roll-up /
    //   provider-network integration shaped opportunity. Inherently MULTI-domain (it
    //   spans clinical operations, finance acquisition capital, and the payor/governance
    //   regulation), so singleDomainOnly is false. Slightly lower bar than the single-
    //   bounded lanes because a consolidation note is a multi-counterparty structural
    //   artifact, not a single bounded file. Medicine-primary, with the consolidation-
    //   adjacent domains (finance = the acquisition capital, governance = antitrust /
    //   certificate-of-need / payor regulation, law = the merger/regulatory legal
    //   regime). Passing this gate signals only "sufficient packet detail to attempt a
    //   healthcare-provider-consolidation note" — NOT an acquisition decision, NOT an
    //   antitrust ruling, NOT any prediction. Real provider / health-system / managed-
    //   care operators: HCA, CVS, UNH (with provider networks).
    'healthcare-provider-consolidation': { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['medicine','health','finance','governance','law'] },
    // ─── Communication-native PRIMARY lane gates (additive) ───────────────
    // broadcast-infrastructure-modernization — one bounded telecom / spectrum /
    //   fiber / tower capex program (5G build-out, FTTH, spectrum refarm, tower
    //   densification) routed to the communication negotiator (analogous to
    //   defense-procurement / industrial-capacity-investment as a PRIMARY single-
    //   domain lane). singleDomainOnly: a network-modernization program targets a
    //   single bounded operator's plant, so cross-node multi-domain aggregations
    //   are routed away. Communication-primary, with the build-adjacent real-economy
    //   domains that originate connectivity demand (infrastructure = the physical
    //   network / towers / conduit, technology = network gear / chipsets COUPLING,
    //   energy = network power draw, governance = FCC spectrum-license & broadband-
    //   deployment regulatory mandates). Passing this gate signals only "sufficient
    //   packet detail to attempt a broadcast-infrastructure note" — NOT a capex
    //   decision, NOT a license, NOT any prediction. Real operators: VZ, T, TMUS
    //   (carriers), AMT, CCI, SBAC (towers), CSCO, ANET (network gear). Distinct
    //   from culture (content, not channels), technology (gear is a coupling), and
    //   intelligence (collection, not open dissemination).
    'broadcast-infrastructure-modernization': { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['communication','infrastructure','technology','energy','governance'] },
    // media-ownership-restructuring — antitrust / consolidation / divestiture /
    //   station-portfolio restructuring opportunity in the media & broadcasting
    //   CHANNEL layer routed to the communication negotiator. Inherently MULTI-domain
    //   (a media restructuring spans the channel operator, governance/FCC ownership-cap
    //   rulemaking, and finance acquisition capital), so singleDomainOnly is false.
    //   Communication-primary, with the restructuring-adjacent domains (governance =
    //   FCC/antitrust ownership-cap regime, finance = acquisition/divestiture capital,
    //   culture = the CONTENT carried by the channel but NOT communication's own
    //   identity, economy = the media-advertising cycle). Passing this gate signals
    //   only "sufficient packet detail to attempt a media-restructuring note" — NOT
    //   an antitrust ruling, NOT a deal, NOT any prediction. Real channel/media
    //   operators: CMCSA, CHTR (cable distribution), NWSA, NYT (news/publishing).
    'media-ownership-restructuring':           { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['communication','governance','finance','culture','economy'] },
    // information-integrity-platform — disinformation-resistance / content-moderation
    //   / provenance / trust-and-safety platform opportunity at the information-
    //   DISSEMINATION layer (social-media & search AS DISTRIBUTION CHANNELS, news-flow
    //   integrity). Inherently MULTI-domain (integrity spans the platform, governance
    //   policy, and technology tooling), so singleDomainOnly is false. Slightly lower
    //   bar than the infrastructure lane because an integrity note is an analytic /
    //   platform artifact, not a bounded capex buy. Communication-primary, with the
    //   integrity-adjacent domains (technology = moderation / provenance tooling
    //   COUPLING, governance = platform-regulation / content-policy rulemaking,
    //   culture = the discourse carried but NOT communication's own identity). DISTINCT
    //   from intelligence: this is OPEN dissemination integrity, NOT covert signals
    //   collection. Passing this gate signals only "sufficient packet detail to attempt
    //   an information-integrity note" — NOT a moderation decision, NOT a policy, NOT
    //   any prediction. Real dissemination-channel operators: META, GOOGL (social-media
    //   / search as distribution); NWSA, NYT (news-flow).
    'information-integrity-platform':          { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['communication','technology','governance','culture'] },
    // ─── Education-native PRIMARY lane gates (additive) ───────────────────
    // student-outcome-improvement — one bounded K-12 / higher-ed student-
    //   achievement program (literacy, completion, learning-loss recovery,
    //   outcome measurement) for a single bounded institution / district routed to
    //   the education negotiator (analogous to defense-procurement / clinical-trial-
    //   capacity as a PRIMARY single-domain lane). singleDomainOnly: one bounded
    //   achievement program, so cross-node multi-domain aggregations are routed
    //   away. Education-primary, with the outcome-adjacent domains (technology =
    //   edtech / LMS / adaptive-learning tooling COUPLING, research = the pedagogy/
    //   learning-science evidence base, governance = accreditation / accountability
    //   standards). Passing this gate signals only "sufficient packet detail to
    //   attempt a student-outcome note" — NOT an achievement prediction, NOT an
    //   accreditation outcome, NOT any guarantee. Real education operators: CHGG,
    //   COUR, DUOL, LRN. Distinct from science (research is a coupling), population
    //   (demographics is a coupling), economy (workforce is a coupling).
    'student-outcome-improvement':     { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['education','technology','research','governance'] },
    // curriculum-modernization — pedagogical / content / delivery modernization
    //   (online/blended delivery, curriculum redesign, edtech-enabled instruction)
    //   for a single bounded institution (analogous to manufacturing-modernization
    //   for a single production base). singleDomainOnly: a modernization program
    //   targets one bounded institution. Education-primary, with the modernization-
    //   adjacent domains (technology = LMS / delivery-platform COUPLING, research =
    //   instructional-design evidence, governance = curriculum-standards regime).
    //   Real online/blended operators: COUR, DUOL, TWOU, LRN.
    'curriculum-modernization':        { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['education','technology','research','governance'] },
    // teacher-development-funding — recruitment / training / professional-development
    //   funding for a single bounded district / institution (analogous to factory-
    //   output-financing / sba-loans as a single bounded counterparty file).
    //   singleDomainOnly: one borrower-equivalent district/institution. Education-
    //   primary, with the financing-origination domains (finance = the funder/lender,
    //   technology = training-platform COUPLING, governance = certification / licensure
    //   standards). Real teacher-prep / credentialing operators: ATGE, LOPE, STRA, UTI.
    'teacher-development-funding':      { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: true,  anyDomain: ['education','finance','technology','governance'] },
    // access-equity-program — enrollment growth / access-barrier removal for a single
    //   bounded population (financial-aid expansion, first-gen access, affordability,
    //   student-debt relief). singleDomainOnly: one bounded population. Education-
    //   primary, with the access-adjacent domains (governance = public-funding /
    //   financial-aid policy, finance = aid / student-debt instruments, population =
    //   the enrollment-pool COUPLING that informs but is not education's content).
    //   Real broad-access enrollment operators: LOPE, STRA, ATGE, LAUR.
    'access-equity-program':           { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: true,  anyDomain: ['education','governance','finance','population'] },
    // institutional-consolidation — merger / affiliation / partnership across schools /
    //   universities. Inherently MULTI-domain (a consolidation spans operations,
    //   acquisition capital, and the accreditation/governance regime across
    //   counterparties), so singleDomainOnly is false. Slightly lower bar than the
    //   single-bounded lanes because a consolidation note is a multi-counterparty
    //   structural artifact, not a single bounded file. Education-primary, with the
    //   consolidation-adjacent domains (finance = the acquisition capital, governance =
    //   accreditation / regional-accreditor / antitrust regime). Passing this gate
    //   signals only "sufficient packet detail to attempt an institutional-consolidation
    //   note" — NOT a merger decision, NOT an accreditation ruling, NOT any prediction.
    //   Real multi-institution operators: ATGE, LAUR, STRA, LOPE.
    'institutional-consolidation':     { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['education','finance','governance'] }
  };

  var _last = { lanes: {}, timestamp: 0, totalPackets: 0 };
  var _timer = null;

  function _packets() {
    var ad = (typeof window !== 'undefined') ? window.LIMENCivilizationAdapter : null;
    if (ad && typeof ad.getAll === 'function') return ad.getAll() || {};
    return (typeof window !== 'undefined' && window.LIMENCivilizationPackets) || {};
  }
  function _crossDomainAudit() {
    return (typeof window !== 'undefined' && window.LIMENCrossDomainAuditState) || null;
  }
  function _opportunities() {
    var st = (typeof window !== 'undefined' && window.LIMENCrossNodeOpportunityState) || null;
    return (st && Array.isArray(st.list)) ? st.list : [];
  }

  // Top diagnoses per opportunity's source domains.
  function _diagnosesFor(domains, packets) {
    var out = [];
    for (var i = 0; i < domains.length; i++) {
      var p = packets[domains[i]];
      var dx = (p && Array.isArray(p.activeDiagnoses)) ? p.activeDiagnoses : [];
      for (var j = 0; j < Math.min(dx.length, 2); j++) {
        if (!dx[j] || !dx[j].label) continue;
        out.push({
          domain:    domains[i],
          id:        dx[j].id || '',
          label:     dx[j].label,
          summary:   dx[j].summary || '',
          relevance: dx[j].relevance != null ? dx[j].relevance : null,
          active:    !!dx[j].active
        });
      }
    }
    return out;
  }

  // Source treatments per opportunity's domains — carries domain-brain treatment
  // depth into the Main Brain handoff (the civilization packet previously dropped
  // treatments, so this was unavailable). Bounded to keep the handoff actionable.
  // (2026-05-25 loop-tightening — pairs with domain-packet-adapter carry-through.)
  function _treatmentsFor(domains, packets) {
    var out = [];
    for (var i = 0; i < domains.length; i++) {
      var p = packets[domains[i]];
      var tx = (p && Array.isArray(p.treatments)) ? p.treatments : [];
      for (var j = 0; j < tx.length && out.length < 24; j++) {
        if (!tx[j]) continue;
        out.push({ domain: domains[i], treatment: tx[j] });
      }
    }
    return out;
  }

  function _supportingNodes(opp) {
    return (opp && Array.isArray(opp.nodes)) ? opp.nodes.slice() : [];
  }

  function _whyLane(lane, opp) {
    var doms = (opp.domains || []).join(' + ');
    switch (lane) {
      case 'patents':         return 'Domains ' + doms + ' produce technical / methodological output amenable to invention disclosure.';
      case 'copyrights':      return 'Domains ' + doms + ' produce textual / expressive output suitable for copyright registration.';
      case 'business-grants': return 'Domains ' + doms + ' indicate operational opportunity matching small-business / sectoral grant criteria.';
      case 'research-grants': return 'Domains ' + doms + ' indicate research-funding opportunity (NSF/NIH/foundation tracks).';
      case 'nsf-project-pitch': return 'Domains ' + doms + ' carry technical innovation plus commercial-potential signal sufficient to attempt an NSF SBIR/STTR Project Pitch draft (not eligibility, not readiness).';
      case 'sba-loans':       return 'Domains ' + doms + ' indicate financing-shaped opportunity matching SBA 7(a) / 504 criteria.';
      case 'franchise':       return 'Domains ' + doms + ' indicate replication-shaped opportunity (FTC Franchise Rule applies).';
      case 'investments':     return 'Domains ' + doms + ' indicate investable thesis with measurable upside / regulatory tail.';
      case 'research-papers': return 'Domains ' + doms + ' have evidence and pattern density supporting publishable analysis.';
      case 'credit-facilities': return 'Domains ' + doms + ' indicate credit / lending-shaped opportunity (credit line, syndication, debt facility) for a single bounded counterparty.';
      case 'systemic-risk':     return 'Domains ' + doms + ' show cross-sector solvency / liquidity transmission signal sufficient to attempt a systemic-risk note (not a crisis prediction, not the validated distress kernel).';
      case 'capital-access':    return 'Domains ' + doms + ' indicate funding-constraint / liquidity-gap opportunity (capital access, funding runway, liquidity provision).';
      case 'defense-procurement': return 'Domains ' + doms + ' indicate procurement / sustainment-shaped opportunity for a single bounded acquisition (program of record, weapons-system buy, readiness contract) routed to the defense negotiator — not award, not eligibility.';
      case 'zero-day-acquisition': return 'Domains ' + doms + ' show defense↔technology co-elevation routing a cyber-intelligence / offensive-capability acquisition artifact to the defense negotiator (coupling lane; cyber is the technology coupling, not defense\'s kinetic identity).';
      case 'firmware-licensing':  return 'Domains ' + doms + ' show technology co-elevation routing a firmware / embedded-control licensing artifact for platform or weapons-system electronics to the co-elevated negotiator (defense or energy coupling lane).';
      case 'semiconductor-IP':    return 'Domains ' + doms + ' show technology co-elevation routing a semiconductor-IP / chip-supply licensing artifact (defense semiconductor supply chain) to the co-elevated negotiator (coupling lane).';
      case 'intelligence-operations': return 'Domains ' + doms + ' indicate collection / analysis-fusion / covert-operations-shaped opportunity for a single bounded engagement (collection tasking, all-source analysis, counterintelligence) routed to the intelligence negotiator — not tasking authority, not clearance, not award.';
      case 'collection-platform-acquisition': return 'Domains ' + doms + ' indicate a single bounded SIGINT/HUMINT/GEOINT/OSINT collection-platform upgrade / sensor acquisition routed to the intelligence negotiator (analogous to a weapons-system buy for kinetic) — not an acquisition decision, not eligibility.';
      case 'analysis-fusion-capability': return 'Domains ' + doms + ' indicate all-source fusion / analysis-platform capability opportunity (intelligence + technology + research) sufficient to attempt an analysis-fusion-capability note — an inherently multi-domain analytic artifact, not a bounded acquisition.';
      case 'supply-chain-mapping': return 'Domains ' + doms + ' indicate logistics-network / freight-route / supplier-graph mapping opportunity routed to the trade (supplyChain) negotiator — a multi-domain artifact spanning shipping, customs, ports and supplier relationships; not a logistics decision, not an award, not any prediction.';
      case 'industrial-capacity-investment': return 'Domains ' + doms + ' indicate capacity-utilization / factory-output / capital-goods build-out opportunity for a single bounded production asset (plant, line, capital-goods program) routed to the industry negotiator — not a capex decision, not financing, not any prediction.';
      case 'manufacturing-modernization': return 'Domains ' + doms + ' indicate automation / robotics / reshoring / industrial-maintenance modernization of a single bounded production base routed to the industry negotiator (automation is the technology coupling, not industry\'s own content) — not a modernization decision, not an award.';
      case 'factory-output-financing': return 'Domains ' + doms + ' indicate working-capital / equipment-financing / supplier-finance opportunity for a single bounded manufacturer routed to the industry negotiator — a single counterparty file (analogous to an SBA borrower or credit facility); not a lending decision, not any prediction.';
      case 'supply-chain-sourcing-industrial': return 'Domains ' + doms + ' indicate industrial INPUT sourcing / supplier-graph / raw-material & component procurement from the production-node side routed to the industry negotiator — distinct from trade\'s logistics-network mapping; a multi-domain sourcing artifact, not a sourcing decision, not a contract, not any prediction.';
      case 'regulatory-compliance-modernization': return 'Domains ' + doms + ' indicate a bounded regulatory-transformation opportunity for a single agency / regime (rulemaking modernization, oversight-platform upgrade, compliance-regime overhaul) routed to the governance negotiator — anchored to institutions & indicators (WGI/V-Dem/GAO/CBO/Federal Register) and govtech operators (TYL/MMS/BAH/LDOS/ACN/GDIT); not a rulemaking, not an award, not any prediction. Distinct from law (judicial), economy (macro) and finance (capital).';
      case 'policy-coordination-platform': return 'Domains ' + doms + ' indicate inter-agency policy-alignment / cross-branch coherence / systemic institutional-coordination opportunity routed to the governance negotiator as the primary coordinator — an inherently multi-domain institutional-analysis artifact spanning the real-economy domains governance regulates; not a policy decision, not authority, not any prediction.';
      case 'crop-input-financing': return 'Domains ' + doms + ' indicate fertilizer / seed / equipment capex-financing opportunity for a single bounded farm operation routed to the agriculture negotiator — a single counterparty file (analogous to an SBA borrower or factory-output-financing); anchored by ag-input operators (NTR/MOS/CF/CTVA/FMC) and equipment (DE/AGCO); not a lending decision, not any prediction. Distinct from environment (land/water coupling), trade (export logistics coupling) and energy (fertilizer-energy coupling).';
      case 'yield-assurance': return 'Domains ' + doms + ' indicate crop-insurance / yield-enhancement / precision-ag opportunity for a single bounded farm operation routed to the agriculture negotiator — anchored by CTVA/FMC and precision-ag platforms (DE/AGCO) with USDA WASDE yield context; not an underwriting decision, not any prediction. Agronomic conditions are an environment coupling, not agriculture\'s own content.';
      case 'commodity-hedging-facility': return 'Domains ' + doms + ' indicate futures / options / commodity-risk-management facility opportunity (CBOT corn/soy/wheat hedging) for a single bounded agribusiness or commodity trader routed to the agriculture negotiator — anchored by grain/oilseed processors & merchants (ADM/BG/INGR); not a trading decision, not a position, not any prediction. Food-price macro is an economy coupling, physical flow a trade coupling.';
      case 'farm-consolidation': return 'Domains ' + doms + ' indicate farm-acquisition / cooperative-formation / agribusiness roll-up opportunity routed to the agriculture negotiator — an inherently multi-domain structural artifact spanning operations, acquisition capital and the input/processing graph; anchored by integrators/processors (ADM/BG/TSN/CAG/INGR) and equipment scale partners (DE/AGCO); not an acquisition decision, not any prediction.';
      case 'broadcast-infrastructure-modernization': return 'Domains ' + doms + ' indicate telecom / spectrum / fiber / tower capex opportunity (5G build-out, fiber-to-the-home, spectrum refarm, tower densification) for a single bounded carrier or wireless-infrastructure operator routed to the communication negotiator — anchored by carriers (VZ/T/TMUS), tower REITs (AMT/CCI/SBAC) and network gear (CSCO/ANET), with FCC spectrum-license & broadband-deployment context; not a capex decision, not a license, not any prediction. Distinct from culture (content, not channels), technology (gear is a coupling) and intelligence (collection, not open dissemination).';
      case 'media-ownership-restructuring': return 'Domains ' + doms + ' indicate antitrust / consolidation / divestiture / station-portfolio restructuring opportunity in the media & broadcasting CHANNEL layer routed to the communication negotiator — an inherently multi-domain artifact spanning the channel operator, governance/FCC ownership-cap rulemaking and acquisition capital; anchored by cable distributors (CMCSA/CHTR) and news/publishing (NWSA/NYT); not an antitrust ruling, not a deal, not any prediction. The content carried is a culture coupling, not communication\'s own identity.';
      case 'information-integrity-platform': return 'Domains ' + doms + ' indicate disinformation-resistance / content-moderation / provenance / trust-and-safety platform opportunity at the information-DISSEMINATION layer (social-media & search AS DISTRIBUTION channels, news-flow integrity) routed to the communication negotiator — an inherently multi-domain artifact spanning the platform, governance policy and technology tooling; anchored by social/search distribution (META/GOOGL) and news-flow (NWSA/NYT); not a moderation decision, not a policy, not any prediction. Distinct from intelligence: open dissemination integrity, not covert signals collection.';
      case 'student-outcome-improvement': return 'Domains ' + doms + ' indicate a bounded K-12 / higher-ed student-achievement program (literacy, completion, learning-loss recovery, outcome measurement) for a single bounded institution / district routed to the education negotiator — anchored by education operators (CHGG/COUR/DUOL/LRN); not an achievement prediction, not an accreditation outcome, not any guarantee. Distinct from science (research is a coupling), population (demographics is a coupling) and economy (workforce is a coupling).';
      case 'curriculum-modernization': return 'Domains ' + doms + ' indicate pedagogical / content / delivery modernization (online/blended delivery, curriculum redesign, edtech-enabled instruction) for a single bounded institution routed to the education negotiator — edtech / LMS tooling is the technology coupling, not education\'s own content; anchored by online/blended operators (COUR/DUOL/TWOU/LRN); not a modernization decision, not any prediction.';
      case 'teacher-development-funding': return 'Domains ' + doms + ' indicate recruitment / training / professional-development funding opportunity for a single bounded district / institution routed to the education negotiator — a single counterparty file (analogous to an SBA borrower or factory-output-financing); anchored by teacher-prep / credentialing operators (ATGE/LOPE/STRA/UTI); not a funding decision, not any prediction.';
      case 'access-equity-program': return 'Domains ' + doms + ' indicate enrollment growth / access-barrier removal for a single bounded population (financial-aid expansion, first-gen access, affordability, student-debt relief) routed to the education negotiator — anchored by broad-access enrollment operators (LOPE/STRA/ATGE/LAUR); the enrollment pool is a population coupling, not education\'s own content; not an enrollment decision, not any prediction.';
      case 'institutional-consolidation': return 'Domains ' + doms + ' indicate merger / affiliation / partnership across schools/universities routed to the education negotiator — an inherently multi-domain structural artifact spanning operations, acquisition capital and the accreditation/governance regime; anchored by multi-institution operators (ATGE/LAUR/STRA/LOPE); not a merger decision, not an accreditation ruling, not any prediction.';
    }
    return '';
  }

  function _packetForLane(lane, opp, packets) {
    var gate = LANE_GATES[lane];
    if (!gate) return null;
    var domains = (opp && opp.domains) || [];

    // Single-domain gate: lanes representing a single bounded entity (patent,
    // franchise unit, investment thesis, SBA borrower file) cannot accept
    // multi-domain cross-node aggregations. Cross-node opportunities still
    // emit packets for multi-domain-friendly lanes (research-papers,
    // research-grants, business-grants, copyrights, nsf-project-pitch) so
    // their signal is preserved — only routed away from lanes where they
    // would produce garbage filings (e.g., a patent draft titled "8 domains
    // elevated at mPFC" is not a patentable invention).
    if (gate.singleDomainOnly === true && domains.length !== 1) return null;

    // Lane domain affinity — the opportunity must touch at least one allowed
    // domain for the lane (else patent for religion is silly).
    var hit = false;
    for (var i = 0; i < domains.length; i++) {
      if (gate.anyDomain.indexOf(domains[i]) >= 0) { hit = true; break; }
    }
    if (!hit) return null;

    var ev   = opp.evidenceQuality != null ? opp.evidenceQuality : 0;
    var conf = opp.confidence      != null ? opp.confidence      : 0;
    var ready = ev >= gate.minEvidence && conf >= gate.minConfidence;

    var diagnoses = _diagnosesFor(opp.domains || [], packets);

    return {
      opportunityId:    opp.id,
      lane:             lane,
      sourceDomains:    (opp.domains || []).slice(),
      sourceDiagnoses:  diagnoses,
      sourceTreatments: _treatmentsFor(opp.domains || [], packets),
      supportingNodes:  _supportingNodes(opp),
      rationale:        opp.rationale || '',
      evidenceQuality:  ev,
      urgency:          opp.urgency != null ? opp.urgency : 0,
      confidence:       conf,
      why:              _whyLane(lane, opp),
      summary:          opp.summary || '',
      provenance:       opp.provenance || '',
      type:             opp.type || 'unknown',
      warn:             opp.warn || null,
      readyForGeneration: ready,
      gateUsed:         { minEvidence: gate.minEvidence, minConfidence: gate.minConfidence },
      // F0: carry the recurrent brain model from the source domain's packet (energy).
      deepBrain:        (function () { var ds = opp.domains || []; for (var di = 0; di < ds.length; di++) { var pk = packets && packets[ds[di]]; if (pk && pk.deepBrain) return pk.deepBrain; } return null; })()
    };
  }

  // ─── Recompute ──────────────────────────────────────────────────────────
  function recompute() {
    var packets = _packets();
    var opps    = _opportunities();
    var lanes   = {};
    var total   = 0;

    for (var li = 0; li < LANES.length; li++) lanes[LANES[li]] = [];

    for (var oi = 0; oi < opps.length; oi++) {
      var opp = opps[oi];
      // Lane recommendation comes from the opportunity itself (lanes[]) and
      // is then validated against lane gates.
      var oppLanes = Array.isArray(opp.lanes) && opp.lanes.length > 0 ? opp.lanes : LANES;
      for (var li2 = 0; li2 < oppLanes.length; li2++) {
        var lane = oppLanes[li2];
        if (!LANE_GATES[lane]) continue;
        var pkt = _packetForLane(lane, opp, packets);
        if (pkt) {
          lanes[lane].push(pkt);
          total++;
        }
      }
    }

    // Sort each lane by readyForGeneration first, then confidence × evidence.
    for (var lk in lanes) {
      lanes[lk].sort(function (a, b) {
        if (a.readyForGeneration !== b.readyForGeneration) return a.readyForGeneration ? -1 : 1;
        return (b.confidence * b.evidenceQuality) - (a.confidence * a.evidenceQuality);
      });
    }

    _last = { lanes: lanes, timestamp: Date.now(), totalPackets: total };
    if (typeof window !== 'undefined') window.LIMENMainBrainHandoffState = _last;

    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('limen:main-brain-handoff-update', { detail: _last }));
      }
    } catch (e) { /* observer-only */ }
    return _last;
  }

  function _scheduleRebuild() {
    if (_timer) return;
    _timer = setTimeout(function () {
      _timer = null;
      try { recompute(); } catch (err) { /* observer-only */ }
    }, REBUILD_DEBOUNCE);
  }

  function _laneSummary() {
    var out = [];
    for (var li = 0; li < LANES.length; li++) {
      var lane = LANES[li];
      var arr = (_last.lanes && _last.lanes[lane]) || [];
      var ready = arr.filter(function (p) { return p.readyForGeneration; }).length;
      out.push({ lane: lane, total: arr.length, readyForGeneration: ready, pending: arr.length - ready });
    }
    return out;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('limen:civilization-packets-update', _scheduleRebuild);
    window.addEventListener('limen:cross-node-opportunity-update', _scheduleRebuild);
    setTimeout(function () { try { recompute(); } catch (e) {} }, 1500);

    window.LIMENMainBrainHandoff = {
      recompute: recompute,
      get:       function () { return _last; },
      byLane:    function (lane) { return ((_last.lanes && _last.lanes[lane]) || []).slice(); },
      lanes:     function () { return LANES.slice(); },
      summary:   _laneSummary
    };
  }
})();
