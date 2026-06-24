/**
 * civilization/cross-domain-audit.js
 * LIMEN HELIX — Cross-domain audit / deciphering observer (read-only).
 *
 * Civilization is an OBSERVER. This module DOES NOT decide truth, does not
 * mutate domain slots, does not edit packets. It reads
 *   window.LIMENCivilizationPackets / LIMENCivilizationAdapter.getAll()
 * and emits structured cross-domain audit findings:
 *
 *   findings = {
 *     corroborations:      [...], // groups of domains stress-aligned
 *     divergences:         [...], // pairs whose stress diverges materially
 *     proxyHeavy:          [...], // domains with low evidence quality
 *     underfed:            [...], // domains with very low live-feed integrity
 *     baselineHeavy:       [...], // BASELINE_HEAVY flag from packet
 *     evidenceWeak:        [...], // LOW_FEED_PROVENANCE / STRESS_DERIVED_DX
 *     convergence:         [...], // multi-domain elevated + corroborated
 *     comparisons:         [...], // pairwise evidence-quality contrasts
 *     nodeSharedAffinities:[...]  // neurological co-binding findings —
 *                                  // elevated domain A's active diagnosis
 *                                  // engages brain node N; emits the OTHER
 *                                  // business domains that canonically bind
 *                                  // a role at N (per brain-node-domains.json),
 *                                  // with their current stress. Encodes the
 *                                  // load-bearing claim that pattern transfer
 *                                  // between business and neurology flows
 *                                  // through shared node membership, not
 *                                  // through hardcoded affinity groups.
 *     warnings:            [...]  // atlas-completeness warnings, e.g.
 *                                  // TECHNOLOGY_ATLAS_GAP: technology elevated
 *                                  // but absent from the brain node map.
 *   }
 *
 * Read-only. Provides:
 *   window.LIMENCrossDomainAudit.recompute() → findings
 *   window.LIMENCrossDomainAudit.get()       → last findings
 *   event 'limen:cross-domain-audit-update' on rebuild
 */
(function () {
  'use strict';

  // Affinity groups — domains that share systemic exposure. Empirical, edit-
  // safe: changing here only affects which corroborations get computed, never
  // raw domain truth. Conservatively scoped to avoid spurious clusters.
  var AFFINITY_GROUPS = [
    { id: 'energy_chain',        domains: ['energy', 'infrastructure', 'supplyChain'] },
    // Infrastructure's own institutional envelope: grid/water/roads/bridges
    // reliability feeds back into regulatory compliance (law), policy &
    // permitting (governance), and capital access for deferred maintenance
    // (finance). Corroboration here = systemic infrastructure-institutional
    // stress (e.g. a transmission/SCADA reliability failure coinciding with
    // a compliance + capital-funding squeeze).
    { id: 'infrastructure_core', domains: ['infrastructure', 'law', 'governance', 'finance'] },
    // Rule-of-law / institutional-integrity cluster (EXPANDED): the original
    // law+governance+defense triple captured only the security-state slice of
    // institutional integrity. But rule of law is load-bearing wherever an
    // enforcement/compliance regime governs real activity: intelligence (FISA,
    // classification, clearance-vetting integrity), environment (Clean Air/Water
    // Act enforcement, EPA permitting & consent-decree integrity), and finance
    // (securities, lending & anti-fraud enforcement). When law, governance,
    // defense, intelligence, environment and finance co-elevate on rule-of-law
    // stress, the signal is an INSTITUTIONAL-INTEGRITY crisis — a legitimacy
    // feedback loop (compliance erosion → enforcement burden amplifies →
    // institutional incoherence spirals) rather than an isolated legal burden.
    // Governance-side indices: World Bank WGI (rule-of-law / control-of-
    // corruption / government-effectiveness), V-Dem, GAO/IG oversight-backlog
    // counts, judicial docket-delay and compliance-investigation queue time —
    // NOT single-company tickers (institutions & indicators, not firms). Law is
    // the judicial/legal-system domain; governance is policy/rulemaking/
    // oversight; the two co-bear integrity but stay DISTINCT.
    { id: 'rule_of_law',    domains: ['law', 'governance', 'defense', 'intelligence', 'environment', 'finance'] },
    // Economic-core: macro real-economy cycle PLUS its governance steering
    // signal. Monetary & fiscal policy is governance's input into the macro
    // cycle (the law/regulatory regime sets the rules; governance sets the
    // policy stance), so a macro-activity stress is co-borne by the policy
    // regime that must respond to it. Corroboration = economy + finance +
    // industry + governance co-elevated, signalling a macro contraction that
    // the policy apparatus is simultaneously straining to steer. Governance
    // anchors are policy/indicator series (Federal Register rulemaking volume,
    // CBO/OMB fiscal projections, FOMC stance), NOT single companies; macro
    // anchors stay FRED (GDPC1/PAYEMS/INDPRO). Governance kept DISTINCT from
    // economy (macro aggregate) and finance (capital channel).
    { id: 'economic_core',  domains: ['economy', 'finance', 'industry', 'governance'] },
    // Industry's own institutional/production envelope (mirror of
    // infrastructure_core / financial_core / technology_core / defense_core,
    // but built around the PRODUCTION BASE rather than a regulatory regime).
    // Manufacturing & industrial production, factory output & capacity
    // utilization, automation & robotics, heavy industry & capital goods, and
    // industrial maintenance — the CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK/DOV/GEV
    // capital-goods, machinery & equipment complex — is co-borne by the
    // automation substrate that runs the floor (technology — robotics, IoT
    // sensors, AI production scheduling, machine vision), the working/growth
    // capital that funds plants & production lines (finance — capex, working
    // capital), the power/water/road plant factories run on (infrastructure),
    // and the raw-materials/components feedstock (supplyChain). UNLIKE
    // energy_chain — where energy is a SUPPLY commodity flowing OUT to other
    // domains — industry is the PRODUCTION base that converts those inputs into
    // capital goods, so it sits at the convergence of capital, automation,
    // utilities & materials rather than as a downstream consumer. Corroboration
    // here = a production-capability stress (e.g. a capacity-utilization
    // collapse coinciding with a capex/working-capital squeeze + an automation/
    // sensor shortfall + a feedstock constraint). Defense's wartime munitions/
    // vehicle mobilization is a COUPLING (see defense_core), not industry's own
    // identity; trade (logistics/commerce) and economy (macro aggregate) stay
    // DISTINCT.
    // Governance is added here as the institutional envelope of the production
    // base: capacity-utilization & industrial policy, labor/OSHA safety
    // regulation, and environmental permitting are governance's policy/rulemaking
    // couplings into the factory floor. A production-capability stress rarely
    // moves without a parallel policy/permitting/labor-regulation constraint, so
    // governance co-bears the cluster (institutional layer, indicators — Federal
    // Register industrial rulemaking, OSHA enforcement counts — not firms).
    // Technology/finance/infrastructure/supplyChain keep their prior meaning.
    { id: 'industry_core', domains: ['industry', 'technology', 'finance', 'infrastructure', 'supplyChain', 'governance'] },
    // Industry↔technology automation coupling (mirror of
    // intelligence_collection_infrastructure on the production side):
    // technology couples into the factory via automation — robotic arms,
    // AI-driven production scheduling, IoT floor sensors, computer-vision
    // quality control — running on the physical plant (infrastructure). When
    // industry AND technology co-elevate, it signals a production-CAPABILITY
    // transformation rather than isolated demand stress: a foundry ramping a
    // next-generation process node, a plant retooling for a robotic line, a
    // capital-goods OEM (ROK/EMR/ETN automation portfolios) absorbing a control-
    // systems shift. Automation is a COUPLING here — technology keeps its own
    // identity (chips/AI/software) and industry keeps its (factory output &
    // capacity), the two binding only through the production floor.
    { id: 'industry_technology_automation', domains: ['industry', 'technology', 'infrastructure'] },
    // Macro real-economy transmission cluster: the balance-of-payments /
    // employment chain. Trade imbalances (deficit/surplus, tariffs, current
    // account) destroy or build manufacturing employment, which shifts
    // aggregate demand, which is what fiscal & monetary policy must respond
    // to. Bound by the macro identity that a trade deficit is offset by
    // capital inflows; when those inflows dry, output and employment fall.
    // Corroboration = economy + the trade/supply-chain channel + industrial
    // output co-elevated, signalling a real-economy (demand/employment)
    // contraction rather than a capital-channel (credit) freeze. Macro
    // anchors are FRED series (real GDP GDPC1, employment PAYEMS, INDPRO,
    // trade-balance via the BoP identity) and broad-market proxies (SPY/DIA/
    // TLT), NOT single-company tickers. Distinct from finance_systemic, which
    // is the capital channel. Mirror of energy_chain on the demand side.
    // NOTE: the trade/supply-chain domain has DUAL NAMING (see
    // assets/js/domain-identity.js): portal/URL key 'trade', runtime/snapshot
    // key 'supplyChain'. The civilization adapter packets it under the runtime
    // key, so EVERY affinity group below references 'supplyChain' to resolve
    // against real packets. The brain-node taxonomy, by contrast, keys trade
    // bindings under the canonical value 'trade' — so TAXONOMY_DOMAIN_ALIASES
    // (below) maps node value 'trade' → runtime key 'supplyChain'. That
    // normalization is LOAD-BEARING (not cosmetic): without it the
    // node-shared-affinity sibling-stress lookup for trade silently misses, and
    // any unmapped variant ('logistics'/'shipping'/'supply chain') now raises an
    // ATLAS_MAPPING_GAP warning instead of failing silently.
    { id: 'economy_trade_labor', domains: ['economy', 'supplyChain', 'industry'] },
    // Domestic production–employment–demand feedback loop (the production-side
    // mirror of economy_trade_labor's trade-imbalance channel). Where
    // economy_trade_labor binds the cross-border channel (imports destroy/build
    // manufacturing jobs), this binds the DOMESTIC channel: factory output &
    // capacity utilization (industry — CAT, DE, GE, HON, MMM, EMR, ITW, ETN, PH,
    // ROK, DOV, GEV capital-goods & machinery output) drive plant employment,
    // which drives local aggregate demand. A plant idling or a line shutdown
    // cascades into local payrolls and regional consumption independently of any
    // import shock. Corroboration here = industrial output + macro activity +
    // population/employment co-contracting, signalling a domestic capacity-led
    // (not trade-led) demand contraction. Macro anchor INDPRO (industrial
    // production) + PAYEMS-manufacturing; distinct from economy_trade_labor
    // (which is the import-balance channel) and from defense's wartime-
    // mobilization production surge.
    { id: 'economy_industry_labor', domains: ['economy', 'industry', 'population'] },
    // Finance's own institutional envelope: capital markets, credit & lending,
    // banking and liquidity/solvency are co-borne by the broader economy
    // (activity, demand, output), the legal/regulatory enforcement regime
    // (law — capital adequacy, securities compliance, enforcement actions),
    // and monetary/fiscal policy & systemic oversight (governance — central-
    // bank policy, prudential supervision, deposit-insurance backstop).
    // Corroboration here = systemic financial-regulatory stress (e.g. a
    // solvency squeeze coinciding with capital constraints + compliance
    // pressure + policy/oversight stress). Mirror of infrastructure_core /
    // culture_core (a sector wedded to its regulatory envelope).
    { id: 'financial_core', domains: ['finance', 'economy', 'law', 'governance'] },
    // Systemic credit-contagion cluster: when distress propagates through the
    // credit channel it does not stay in banks — credit default events (the
    // dealer/lender complex: GS, MS, C), inventory-financing collapse, trade-
    // finance breakdown, and working-capital seizure cascade into industry,
    // the real economy, and the supply chain, with the legal/policy regime
    // (law/governance) determining whether the cascade is backstopped or
    // amplified. Monitors: (1) credit-to-industry financing-spread widening,
    // (2) inventory-finance covenant violations, (3) cross-border payment-
    // system stress, (4) counterparty-risk concentration. Mirror/extension of
    // energy_chain (energy→infrastructure→supplyChain corroboration) on the
    // capital channel; widens economic_core to its law/governance/supply-chain
    // transmission surface.
    { id: 'finance_systemic', domains: ['finance', 'industry', 'economy', 'supplyChain', 'law', 'governance'] },
    { id: 'human_systems',  domains: ['health', 'population', 'medicine'] },
    // ─── Medicine/health-native affinity groups ───────────────────────────
    // Medicine is a SOURCE domain here (not only the short-form patient-burden
    // member of human_systems). DUAL NAMING (see assets/js/domain-identity.js):
    // portal/URL key 'medicine', runtime/snapshot key 'health' — the
    // civilization adapter packets the brain under the runtime key 'health', so
    // EVERY group below references 'health' to resolve against real packets
    // (human_systems above keeps both 'health' AND 'medicine' for the
    // canonical-vs-runtime co-membership). Medicine's identity is healthcare &
    // care delivery, pharmaceuticals & biotech, hospitals & care providers,
    // medical devices & diagnostics, public health & disease control, clinical
    // research & trials, health systems & insurance, and drug development. Real-
    // sector anchors are the healthcare complex — managed care / payers (UNH,
    // CVS, CI), pharma & biotech (JNJ, PFE, MRK, ABBV, LLY, AMGN, GILD),
    // diagnostics & life-science tools (TMO, ABT), med-tech & devices (MDT, ISRG,
    // ABT), and hospital/care-provider systems (HCA) — plus public-health
    // references (CMS National Health Expenditure, CDC/NVSS surveillance, FDA
    // approval timelines, Leapfrog hospital grades, medical-loss ratios). Kept
    // DISTINCT from research/science (basic medical science is a COUPLING, not
    // medicine's own delivery/regulatory content), population (demographics &
    // disease burden are a COUPLING), and economy (healthcare-cost macro
    // inflation is a COUPLING). NEVER energy oil/gas/grid as medicine's content.
    //
    // (1) healthcare_core — medicine's institutional-envelope group (mirror of
    // infrastructure_core / financial_core / technology_core / defense_core /
    // culture_core, but built around the HEALTHCARE-DELIVERY base). Healthcare
    // delivery + patient burden is co-borne by the medical-science substrate
    // (research — basic science, drug-target discovery, trial methodology), the
    // healthcare regulatory regime (law — FDA/CMS rulemaking, healthcare-fraud
    // enforcement, malpractice liability, HIPAA), the healthcare-policy regime
    // (governance — coverage mandates, reimbursement regimes, public-health
    // direction), and payer/provider capital (finance — insurer solvency UNH/CI,
    // hospital-network bond access HCA). When these co-elevate the signal is a
    // SYSTEMIC healthcare-institutional stress (the whole delivery envelope under
    // pressure) rather than an isolated cost/access episode. human_systems above
    // stays the short-form POPULATION-HEALTH chain (disease burden, public
    // health); healthcare_core is the INSTITUTIONAL-ENVELOPE focus (regulatory,
    // policy, financing regimes). Medicine is the SOURCE; research/population are
    // COUPLINGS, not the delivery identity.
    { id: 'healthcare_core',  domains: ['health', 'population', 'research', 'law', 'governance', 'finance'] },
    // (2) health_core — the healthcare institutional-integrity stress cluster
    // (HIGH priority, the tightest mirror of infrastructure_core / financial_core
    // on the care-financing side): health-insurance solvency, hospital-network
    // capital access, FDA/CMS regulatory burden, and healthcare-fraud enforcement
    // co-bear healthcare institutional integrity. Health-system stress (health)
    // binds to capital access (finance — insurance leverage UNH/CVS/CI, hospital
    // bonds HCA), regulatory/policy burden (governance — FDA approval timelines,
    // CMS NHE cost trends), and legal/compliance risk (law — malpractice, fraud
    // enforcement, consent decrees). Corroboration = health + finance +
    // governance + law co-elevated on healthcare-system burden, signalling a
    // regulatory/capital/compliance squeeze that cascades into care-access — a
    // systemic stress distinct from an isolated cost/access episode. Indices: CMS
    // hospital-quality metrics (Leapfrog grades), healthcare-cost inflation (CMS
    // NHE), insurer medical-loss ratios, FDA approval timelines.
    { id: 'health_core',  domains: ['health', 'finance', 'governance', 'law'] },
    // (3) health_population — the disease-epidemiology transmission channel
    // (mirror of agriculture_population / culture_population on the disease-burden
    // side): disease prevalence & mortality (health) are co-borne by demographic
    // composition (population — aging bulge, birth-cohort aging, population-health
    // status such as obesity/smoking/substance-use trends, social-determinant
    // drivers). Corroboration = health + population co-elevated on disease-
    // prevalence/mortality stress signals a systemic health-burden cycle (aging +
    // disease embedding, pandemic-transmission dynamics) rather than isolated
    // clinical episodes. Metrics: CDC/NVSS disease surveillance (EpiTrax),
    // mortality excess, age-adjusted disease rates, demographic-cohort
    // composition. Population is a COUPLING here (the demographic driver); health
    // is the SOURCE. Distinct from healthcare_core (the institutional envelope).
    { id: 'health_population',  domains: ['health', 'population'] },
    { id: 'knowledge_arc',  domains: ['research', 'education', 'technology'] },
    // Culture's audience-attention economy: cultural output (music scenes,
    // artists, genres, festivals/venues) is co-borne by its narrative carrier
    // (communication — virality, discourse, trend propagation), its taste-
    // forming substrate (education — literacy, canon, critical training), and
    // its audience mass (population — fandom size, attention supply). When all
    // co-elevate, it signals a broad cultural coherence crisis or transition
    // (a movement cresting, a scene fracturing) rather than isolated artist
    // distress. Mirror of energy_chain / knowledge_arc.
    { id: 'culture_arc',    domains: ['culture', 'communication', 'education', 'population'] },
    // Culture's own institutional envelope: creative expression feeds back
    // into faith/meaning systems (religion), narrative infrastructure
    // (communication), and policy & funding/heritage protection (governance).
    // Corroboration here = systemic cultural-institutional stress (e.g. a
    // scene collapse coinciding with censorship pressure + arts-funding cuts +
    // heritage loss). Mirror of infrastructure_core.
    { id: 'culture_core',   domains: ['culture', 'religion', 'communication', 'governance'] },
    // Technology's own institutional envelope (mirror of infrastructure_core /
    // financial_core / culture_core): semiconductors & compute, AI/ML, software
    // & cloud, hardware, cybersecurity, and the R&D/innovation pipeline are
    // co-borne by their regulatory regime (law — IP/patent, antitrust, data
    // privacy, securities for the platform giants AAPL/MSFT/NVDA/GOOGL/META/
    // AMZN/AVGO/ORCL/CRM/AMD/INTC/TSM/ASML/PLTR/CRWD/PANW), their policy & funding
    // regime (governance — AI regulation, tech standards, chip subsidies, trade/
    // export restrictions), and the knowledge substrate that produces fundamental
    // IP and STEM talent (research — R&D funding, university pipelines, basic
    // science). Corroboration here = systemic tech-institutional stress (e.g. an
    // IP-litigation/patent-dispute spike coinciding with antitrust pressure +
    // an R&D-funding squeeze + a STEM-workforce shortage). Technology's capital
    // intensity (foundry buildout, chip design, software talent) couples to
    // policy, law, and research the way energy couples to infrastructure & supply
    // chain. Mirror of infrastructure_core / financial_core / culture_core.
    { id: 'technology_core', domains: ['technology', 'law', 'governance', 'research'] },
    // Defense's own institutional envelope (mirror of infrastructure_core /
    // financial_core / culture_core / technology_core): kinetic force readiness
    // — military spending & procurement, the defense industrial base, weapons
    // systems, basing & alliances, electronic/kinetic warfare, strategic
    // deterrence for LMT/RTX/NOC/GD/BA/LHX/HII/LDOS/BAH/KTOS/AVAV — is co-borne
    // by the industrial production base that builds munitions, vehicles &
    // sustainment (industry), the trade/supply-chain access for dual-use parts,
    // rare-earths & components (supplyChain), the policy/doctrine/alliance
    // regime (governance), the regulatory & acquisition authority (law —
    // DFARS/ITAR, contracting & oversight), and the ISR/threat-posture coupling
    // (intelligence — collection that sets the deterrence picture). Distinct
    // from intelligence (defense = kinetic/industrial/readiness; intelligence =
    // collection/analysis/espionage) and from technology (cyber is a coupling,
    // not the core). Corroboration here = systemic defense-institutional stress
    // (e.g. an industrial-attrition surge coinciding with a supply-chain
    // embargo + alliance fragmentation + a legal/acquisition bottleneck).
    { id: 'defense_core',   domains: ['defense', 'industry', 'supplyChain', 'governance', 'law', 'intelligence'] },
    // Defense-industrial procurement & modernization cluster (mirror of
    // energy_chain on the defense-industrial side): the defense-industrial base
    // — prime contractors & weapons-system OEMs (LMT, RTX, NOC, GD, BA, LHX,
    // HII, LDOS, BAH, KTOS, AVAV) — is co-borne by its innovation substrate
    // (technology — sensors, autonomy, munitions, hypersonics, C4ISR), its
    // supplier/manufacturing base (industry — castings, propulsion, shipyards),
    // its procurement & acquisition-policy regime (governance — budget
    // authorizations, program-of-record decisions, foreign-military sales), and
    // the depot/basing/logistics plant it runs on (infrastructure).
    // Corroboration here = systemic procurement/modernization/readiness stress
    // (e.g. a weapons-program schedule slip coinciding with a supplier shortage
    // + a budget/policy squeeze + depot/basing strain). Narrows defense_core to
    // its industrial-readiness surface; cyber stays a technology coupling, not
    // defense's own identity.
    { id: 'defense_industrial_core', domains: ['defense', 'technology', 'industry', 'governance', 'infrastructure'] },
    // Strategic-deterrence cluster: deterrence posture, alliance & basing
    // commitments, and conflict escalation are co-borne by the defense
    // establishment, its policy/treaty/force-posture regime (governance — war
    // powers, alliance commitments), the legal/regulatory regime governing
    // use-of-force, arms control & export licensing (law — ITAR/arms control),
    // and the strategic-warning & threat-assessment posture (intelligence).
    // Corroboration here = a geopolitical/deterrence stress state (e.g. an
    // escalation/conflict signal coinciding with policy mobilization +
    // arms-control/legal friction + elevated threat warning). Defense =
    // kinetic/industrial/readiness here; intelligence supplies the warning
    // picture, it is not the kinetic actor.
    { id: 'defense_deterrence', domains: ['defense', 'governance', 'law', 'intelligence'] },
    // Defense fuel/logistics resilience (mirror of energy_chain, defense-focused
    // — defense COUPLES to energy via fuel & strategic reserve, but the identity
    // stays defense/readiness, NOT oil/gas/grid as defense's own content).
    // Military fuel supply, strategic petroleum/materiel reserves, and
    // sustainment logistics are co-borne by the energy supply they draw on
    // (energy), the physical lift/basing/depot plant (infrastructure), and the
    // materiel pipeline (supplyChain). Corroboration here = a sustainment/
    // readiness logistics stress (e.g. a fuel-supply or strategic-reserve
    // constraint coinciding with basing/lift strain + a materiel supply-chain
    // shortfall degrading operational readiness).
    { id: 'defense_energy_logistics', domains: ['defense', 'energy', 'infrastructure', 'supplyChain'] },
    // ─── Intelligence-native affinity groups ──────────────────────────────
    // Intelligence is a SOURCE domain here (not only a secondary ISR/warning
    // member in defense_core / defense_deterrence). Its identity is collection
    // (SIGINT/HUMINT/GEOINT/OSINT), all-source analysis & assessment, espionage
    // & counterintelligence, surveillance/reconnaissance, threat warning, covert
    // action, information/influence ops, and the security-clearance/insider-risk
    // regime. Kept DISTINCT from defense (kinetic/industrial/readiness) and from
    // technology (cyber tooling is a coupling, not the identity). Real-sector
    // anchors are intelligence-services & analytics primes (PLTR, BAH, LDOS,
    // CACI, SAIC, KBR, VRNT, NICE, VRSK), NOT energy oil/gas/grid.
    //
    // (1) intelligence_core — the intelligence-institutional envelope (mirror of
    // defense_core / finance_core / technology_core / infrastructure_core /
    // culture_core): intelligence collection, all-source analysis, and counter-
    // intelligence are co-borne by policy tasking & priorities (governance), the
    // FOIA/classification & legal-authority regime (law — FISA, executive orders,
    // IRTPA, declassification), and the knowledge substrate of intelligence-studies
    // scholarship & declassified research (research — academic tradecraft, archival
    // analysis). Corroboration here = systemic intelligence-institutional stress
    // (e.g. a collection-authorization squeeze coinciding with a classification/
    // FOIA fight + an analytic-tradecraft/research gap + a policy-tasking shift).
    { id: 'intelligence_core', domains: ['intelligence', 'governance', 'law', 'research'] },
    // (2) intelligence_collection_infrastructure — the collection-platform layer
    // (mirror of energy_chain on the intelligence side): SIGINT-intercept hardware,
    // cyber-collection platforms, and ISR systems are co-borne by their build/
    // tooling base (technology — signals-intercept hardware, cyber-collection
    // platforms), the physical plant that hosts them (infrastructure — ISR
    // platforms, satellite ground stations, antenna/relay sites), and the
    // collection-platform supply chain for sensors, optics & comms parts
    // (supplyChain). Corroboration here = a collection-capacity stress (e.g. an
    // ISR-platform shortfall coinciding with a ground-station/relay outage + a
    // sensor/optics supply-chain constraint). Cyber tooling is a coupling, not
    // intelligence's own identity.
    { id: 'intelligence_collection_infrastructure', domains: ['intelligence', 'technology', 'infrastructure', 'supplyChain'] },
    // (3) intelligence_analysis_fusion — the all-source analysis & assessment
    // layer: analytic production and fusion are co-borne by the methodology &
    // tradecraft substrate (research — analysis methodologies, structured analytic
    // techniques), the all-source fusion-platform stack (technology — fusion &
    // link-analysis platforms in the PLTR/VRNT/NICE/VRSK mold), and the
    // procurement & operations funding for collection/fusion systems (finance —
    // collection-system procurement & sustainment funding). Corroboration here =
    // an analysis/fusion stress (e.g. an analytic-tradecraft/research gap
    // coinciding with a fusion-platform shortfall + a procurement/operations
    // funding squeeze).
    { id: 'intelligence_analysis_fusion', domains: ['intelligence', 'research', 'technology', 'finance'] },
    // (4) intelligence_oversight_core — the oversight/authorization envelope
    // (HIGH priority, mirror of defense_core / finance_core): intelligence
    // collection, all-source analysis, and counterintelligence are co-borne by
    // Congressional / Inspector-General / transparency oversight & policy tasking
    // (governance — intelligence priorities, foreign-policy constraints) and the
    // legal-regulatory regime plus the security-clearance/insider-risk apparatus
    // (law — FISA, executive orders, IRTPA, clearance vetting & adjudication).
    // Corroboration here = systemic intelligence-institutional stress: a
    // collection-authorization-capability gap when oversight tightens AND legal-
    // framework constraints escalate AND clearance-investigation backlogs spike AND
    // foreign-policy directives shift (the FISA-reauthorization / Congressional-
    // access / transparency-vs-security-clearance tension). Drivers: collection
    // capability vs. legal-authority constraint, oversight-effectiveness vs.
    // transparency-demand, clearance-investigation backlog vs. threat escalation.
    { id: 'intelligence_oversight_core', domains: ['intelligence', 'governance', 'law'] },
    // (5) intelligence_defense_deterrence — the intelligence→deterrence coupling
    // (HIGH priority, mirror of defense_deterrence but with intelligence-collection
    // -gap as the SOURCE stress rather than threat-escalation): defense kinetic
    // readiness and procurement are co-borne by threat-assessment intelligence
    // (intelligence — ISR readiness, all-source collection cadence, analyst
    // availability, allied-intelligence-sharing latency), the defense establishment
    // itself (defense), the industrial-base capacity that builds munitions,
    // platforms & sustainment (industry), supply-chain access for critical
    // components (supplyChain), and procurement/doctrine policy (governance).
    // Corroboration here = intelligence threat-posture stress co-elevated with
    // defense-readiness + industrial-capacity stress, exposing deterrence-
    // credibility coupling under a collection-gap-and-production-capacity squeeze.
    // Distinct from defense_deterrence: intelligence is the load-bearing source
    // (threat-assessment lag, deterrence-posture visibility gap), not just the
    // warning picture.
    { id: 'intelligence_defense_deterrence', domains: ['intelligence', 'defense', 'industry', 'supplyChain', 'governance'] },
    // ─── Governance-native affinity groups ────────────────────────────────
    // Governance is a SOURCE domain here, not only an episodic member that
    // surfaces when culture (culture_core) or infrastructure (infrastructure_
    // core) is stressed. Its identity is government & public administration,
    // public policy & rulemaking, regulation & oversight, elections & democratic
    // institutions, public finance & budgets, rule of law & institutional
    // integrity, public-services delivery, and political stability & legitimacy.
    // Kept DISTINCT from economy (macro aggregate), finance (capital channel),
    // law (the judicial/legal-system domain), and intelligence (collection &
    // analysis). Governance binds mostly to INSTITUTIONS & INDICATORS, not single
    // firms — anchors are governance/policy indices (World Bank WGI, V-Dem, OECD
    // government-effectiveness, GAO, CBO, Federal Register rulemaking volume) and,
    // where a public-sector/govtech entity is genuinely needed, real identifiers
    // (TYL Tyler Technologies, MMS Maximus, BAH, LDOS, ACN, GDIT) — NEVER energy
    // oil/gas/grid content.
    //
    // (1) governance_institutional_envelope — governance's institutional identity
    // (policy/regulation/oversight) binds to rule-of-law enforcement (law),
    // evidence-based policymaking (research), capital access for state operations
    // (finance — public debt, budget capacity, Treasury issuance), and the
    // macro-demand/employment effects of state action (economy). Mirror of
    // infrastructure_core / financial_core / technology_core / defense_core /
    // culture_core, but built around the POLICY/RULEMAKING regime itself rather
    // than a sector wedded to it. Corroboration here = policy stress + legal-
    // enforcement stress + research-consensus stress + capital-constraint co-
    // elevated, signalling a SYSTEMIC institutional bottleneck (the whole
    // institutional envelope under pressure, not just one downstream sector).
    { id: 'governance_institutional_envelope', domains: ['governance', 'law', 'research', 'finance', 'economy'] },
    // (2) governance_core — governance's OWN institutional-integrity stress
    // cluster (mirror of infrastructure_core / financial_core / culture_core /
    // technology_core / defense_core / environment_core): policy-coherence
    // (law — rulemaking vs. legal/regulatory constraint), public confidence &
    // legitimacy (population — political stability, trust in institutions,
    // electoral integrity), fiscal capacity (finance — public finance & budgets),
    // and collection-/policy-authority pressure (intelligence — tasking authority,
    // oversight). When these co-elevate the signal is an institutional-LEGITIMACY
    // crisis — an institutional-trust feedback loop distinct from an isolated
    // fiscal-stress or regulatory-burden episode. Indices: V-Dem democracy &
    // legitimacy, World Bank WGI voice-&-accountability / political-stability,
    // CBO/OMB fiscal-capacity, Federal Register rulemaking throughput. Governance
    // is the SOURCE domain here, not merely a recipient of couplings from others.
    { id: 'governance_core', domains: ['governance', 'law', 'population', 'finance', 'intelligence'] },
    // (3) financial_core_governance — financial-regulatory steering: prudential
    // supervision, capital-adequacy regulation, and securities enforcement are
    // governance's policy/oversight couplings into the capital channel. Mirror of
    // economic_core's governance addition on the FINANCIAL side: a solvency/
    // liquidity stress is co-borne by the macro economy, the legal/securities-
    // enforcement regime, and the prudential-policy regime (governance — central-
    // bank stance, deposit-insurance backstop, capital-adequacy rulemaking).
    // Corroboration = finance + economy + law + governance co-elevated = a
    // systemic financial-regulatory bottleneck. (financial_core above already
    // carries governance; this is the explicit governance-source mirror keeping
    // the prudential-supervision channel visible as governance's own coupling.)
    { id: 'financial_core_governance', domains: ['finance', 'economy', 'law', 'governance'] },
    { id: 'environment_arc',domains: ['environment', 'agriculture', 'energy'] },
    // ─── Environment-native affinity groups ───────────────────────────────
    // Environment is a SOURCE domain here (not only the commodity-mirror member
    // of environment_arc, where energy flows OUT and environment couples IN via
    // emissions). Its identity is climate & emissions, air/water/soil pollution
    // & quality, ecosystems & biodiversity, natural-resource conservation,
    // environmental regulation & compliance, climate risk & adaptation, waste
    // management & remediation, and carbon markets. Kept DISTINCT from energy
    // (oil/gas/grid/power supply) and agriculture (land/water USE is a coupling,
    // not environment's own content). Real-sector anchors are environmental-
    // services & natural-resource primes — waste/remediation (WM, RSG, WCN,
    // CWST, DAR), water utilities & water technology (AWK, WTRG, XYL), and
    // emissions/specialty-chemistry & industrial-gas decarbonization (ECL, LIN,
    // APD, AY) — NOT energy oil/gas/grid as environment's OWN identity.
    //
    // (1) environment_core — the environment-institutional envelope (mirror of
    // defense_core / finance_core / technology_core / infrastructure_core /
    // culture_core): the environmental regulatory regime, climate policy, and
    // environmental-science leadership are co-borne by policy & funding tasking
    // (governance — climate policy, emissions targets, conservation mandates,
    // environmental-agency direction), the environmental-law & enforcement regime
    // (law — Clean Air/Water Act enforcement, EPA/permitting, emissions
    // litigation, pollution liability), and the knowledge substrate that produces
    // climate & ecological science (research — climate modeling, ecosystem
    // monitoring, environmental-science pipelines). Corroboration here = systemic
    // environment-institutional stress (e.g. an environmental-compliance/
    // enforcement spike coinciding with a climate-policy shift + an
    // environmental-science/research funding squeeze).
    { id: 'environment_core', domains: ['environment', 'governance', 'law', 'research'] },
    // (2) environment_climate_adaptation — the climate-resilience capital layer
    // (mirror of energy_chain / industry_core on the adaptation-capex side):
    // climate-resilience capital expenditure, green-infrastructure investment,
    // and climate-risk repricing are co-borne by the physical adaptation plant
    // (infrastructure — sea walls, stormwater, grid hardening, water-resilience
    // works), the macro real economy that bears climate-damage & transition cost
    // (economy — climate-damage drag, transition demand, stranded-asset exposure),
    // and the capital that funds resilience build-out & reprices climate risk
    // (finance — green-bond/adaptation capex, catastrophe-risk repricing,
    // climate-disclosure pressure). Corroboration here = a climate-adaptation
    // capital stress (e.g. a climate-risk repricing event coinciding with a
    // resilience-capex squeeze + adaptation-infrastructure strain + macro
    // climate-damage drag). Energy is a COUPLING via the transition, not
    // environment's own content.
    { id: 'environment_climate_adaptation', domains: ['environment', 'infrastructure', 'economy', 'finance'] },
    // (3) environment_pollution_control — the pollution-monitoring & enforcement
    // layer: pollution monitoring, control technology, and regulatory enforcement
    // are co-borne by the physical control & remediation plant (infrastructure —
    // monitoring networks, treatment/scrubber/remediation works, waste-management
    // facilities for WM/RSG/WCN/CWST), the policy & standards regime (governance —
    // emissions standards, pollution targets, agency enforcement priorities), and
    // the legal/compliance regime (law — pollution liability, enforcement actions,
    // permitting & consent decrees). Corroboration here = a pollution-control
    // stress (e.g. an air/water-quality exceedance coinciding with a
    // monitoring/treatment-plant shortfall + a standards tightening + an
    // enforcement/compliance escalation). Distinct from environment_climate_
    // adaptation (which is the climate-capex channel); this binds the
    // pollution-quality enforcement channel.
    { id: 'environment_pollution_control', domains: ['environment', 'infrastructure', 'governance', 'law'] },
    // ─── Agriculture-native affinity group ────────────────────────────────
    // Agriculture is a SOURCE domain here, not only the coupling target of
    // environment_arc (where energy emissions flow OUT and agriculture couples
    // IN via land/water use). Its OWN identity is farming & crops, livestock &
    // animal protein, agribusiness & food production, food security & supply,
    // fertilizers & crop inputs, irrigation & agricultural water use, commodity
    // crops (corn/soy/wheat), agricultural technology & precision ag, and farm
    // economics. Real-sector anchors are the food/ag complex — grain trading &
    // processing (ADM, BG, INGR), seeds & crop protection (CTVA, FMC), farm
    // machinery & precision ag (DE, AGCO), fertilizers & crop inputs (NTR, MOS,
    // CF), and food/protein production (TSN, CAG) — plus the commodity-market
    // references (CBOT corn/soy/wheat futures, USDA WASDE crop-balance reports).
    // Kept DISTINCT from environment (land/water/climate USE is a coupling, not
    // agriculture's own content), trade (export logistics is a coupling), and
    // economy (food prices / macro food inflation is a coupling). NEVER energy
    // oil/gas/grid as agriculture's OWN content (biofuel demand &
    // fertilizer-energy cost are couplings).
    //
    // agriculture_commodity_chain — the crop→commodity→food-inflation→farm-
    // financing stress channel (mirror of energy_chain / industry_core on the
    // food-production side). A crop-yield shock (drought, disease, USDA WASDE
    // downward revision) transmits to commodity prices (environment couples via
    // the land/water/climate driver; CBOT corn/soy/wheat repricing), which feeds
    // macro food inflation (economy), which raises supply-chain food cost
    // (supplyChain — export/processing logistics for ADM/BG grain flows), which
    // stresses farm financing (finance — operating-loan & land-collateral
    // credit, input-cost working capital for NTR/MOS/CF fertilizer & DE/AGCO
    // equipment capex). When all five co-elevate on stress the signal is a
    // commodity-market / FOOD-SECURITY stress — a food-system feedback loop —
    // rather than an isolated yield loss or a macro demand shock. Distinct from
    // environment_arc (agriculture + environment + energy EMISSIONS focus) and
    // from environment_core (the policy/law/governance/research climate-
    // institutional lens). Environment & economy are COUPLINGS here (the climate
    // driver and the food-price aggregate); agriculture is the SOURCE.
    { id: 'agriculture_commodity_chain', domains: ['agriculture', 'environment', 'economy', 'supplyChain', 'finance'] },
    // ─── Communication-native affinity groups ─────────────────────────────
    // Communication is a SOURCE domain here, not only an episodic MEMBER of
    // culture_arc / culture_core (where culture is the source and communication
    // surfaces as the narrative carrier). Its OWN identity is telecommunications
    // & networks, connectivity & broadband, internet infrastructure (cell towers,
    // fiber, spectrum), media & broadcasting CHANNELS, journalism & news flow,
    // information dissemination, social-media platforms AS DISTRIBUTION, and
    // public-discourse infrastructure. Kept DISTINCT from culture (culture =
    // content/movements/scenes; communication = the CHANNELS/networks/
    // information-flow that carry them), technology (chips/software/cloud is a
    // COUPLING, not communication's identity), and intelligence (signals
    // COLLECTION is a coupling; communication is the open civilian carriage of
    // information). Real-sector anchors are the telecom carriers (VZ, T, TMUS),
    // cable/broadband (CMCSA, CHTR), tower/spectrum REITs (AMT, CCI, SBAC),
    // networking gear (CSCO, ANET), media/journalism (NWSA, NYT), and the
    // platform-distribution giants (META, GOOGL) — NEVER energy oil/gas/grid as
    // communication's OWN content.
    //
    // (1) communication_core — the communication-institutional envelope (HIGH
    // priority; mirror of infrastructure_core / financial_core / culture_core /
    // technology_core / defense_core / governance_core / environment_core, but
    // built around the MEDIA-INSTITUTIONAL base — journalism/media outlets,
    // broadcasting, telecom carriers, spectrum-governance, the free-speech legal
    // regime, and public-discourse infrastructure — rather than a regulatory
    // regime alone). Journalism, media & broadcasting are co-borne by their
    // spectrum / digital-platform / broadcast-licensing policy regime (governance
    // — FCC spectrum auctions, platform/Section-230 policy, broadcast licensing),
    // the free-speech & platform-liability legal regime (law — First-Amendment,
    // platform liability, defamation, FCC/FTC enforcement), the capital that funds
    // newsroom operations & carrier capex (finance — ad-revenue, subscription,
    // newsroom funding, 5G/fiber buildout capital for VZ/T/TMUS/CMCSA/CHTR), the
    // research substrate (research — journalism-partnership, media-literacy R&D,
    // disinformation studies), and the platform/network technology layer
    // (technology — CDN stability, codec standards, social-media APIs, the
    // CSCO/ANET routing fabric). When these co-elevate the signal is a
    // MEDIA-INSTITUTIONAL SUSTAINABILITY / LEGITIMACY crisis — newsroom-layoffs +
    // regulatory-pressure + audience-fragmentation + ad-revenue-collapse moving
    // together (an audience-trust / ad-sustainability / newsroom-operations /
    // regulatory-compliance feedback loop) — rather than an isolated narrative
    // signal. Communication is the SOURCE domain here, not merely the narrative
    // carrier it plays inside culture_core.
    { id: 'communication_core', domains: ['communication', 'governance', 'law', 'finance', 'research', 'technology'] },
    // (2) information_ecosystem_integrity — the OSINT / media-freedom /
    // regulatory-coherence channel (mirror of rule_of_law on the information
    // side): open information flow, media freedom, and news-ecosystem integrity
    // are co-borne by the all-source collection/analysis surface that consumes
    // and is shaped by open media (intelligence — OSINT, influence-ops exposure),
    // the free-speech / platform-liability / press-protection legal regime (law),
    // and the spectrum / platform / press policy regime (governance — media
    // regulation, broadcast licensing, platform oversight). When these co-elevate
    // the signal is an INFORMATION-ECOSYSTEM INTEGRITY stress (press-freedom
    // erosion + platform-liability pressure + collection/influence-ops exposure
    // moving together), distinct from a media-institutional sustainability crisis
    // (communication_core, which is the capital/operations lens). Communication
    // is the SOURCE; intelligence is a COUPLING (collection shaped by open media),
    // NOT the carriage itself.
    { id: 'information_ecosystem_integrity', domains: ['communication', 'intelligence', 'law', 'governance'] },
    // (3) narrative_infrastructure — the attention-flow & democratic-discourse
    // health channel (mirror of culture_arc, but with communication as the SOURCE
    // CHANNEL rather than a member carrier of cultural output): the information/
    // narrative carriage (communication — virality, discourse propagation,
    // platform-distribution reach for META/GOOGL, news flow for NWSA/NYT) drives
    // and is driven by the cultural content it transmits (culture — scenes,
    // movements, the meaning carried), the audience mass that supplies attention
    // (population — fandom/electorate size, attention supply), and the taste-/
    // literacy-forming substrate that conditions how narratives land (education —
    // media literacy, critical-reading capacity). When these co-elevate the signal
    // is a NARRATIVE-INFRASTRUCTURE / public-discourse-health stress (attention
    // fragmentation, discourse-channel breakdown, audience-trust erosion) rather
    // than an isolated cultural-scene shift. Culture is a COUPLING here (the
    // content carried), not the source; communication is the CHANNEL.
    { id: 'narrative_infrastructure', domains: ['communication', 'culture', 'population', 'education'] },
    // (4) telecom_resilience — the network-uptime & spectrum-policy coupling
    // (mirror of energy_chain / intelligence_collection_infrastructure on the
    // telecom side): network connectivity, broadband reach, and carrier-network
    // resilience are co-borne by the physical plant the network runs on
    // (infrastructure — cell towers AMT/CCI/SBAC, fiber routes, data-center
    // interconnect, broadcast sites), the build/equipment & routing-fabric layer
    // (technology — CSCO/ANET networking gear, 5G radios, codec/CDN stack), and
    // the spectrum-allocation & telecom policy regime (governance — FCC spectrum
    // auctions, universal-service mandates, net-neutrality/interconnection
    // policy). When these co-elevate the signal is a TELECOM-RESILIENCE stress
    // (a network-uptime/connectivity failure coinciding with an equipment/routing
    // shortfall + a spectrum/policy constraint) — the carriage-layer mirror of an
    // energy grid-reliability event. Technology is a COUPLING (the gear), not
    // communication's identity (the carriage/connectivity).
    { id: 'telecom_resilience', domains: ['communication', 'infrastructure', 'technology', 'governance'] }
  ];

  // Tunables — keep conservative; this is a deciphering layer not a noise
  // amplifier.
  var STRESS_AGREE_BAND   = 0.10; // group members within ±0.10 stress = agreement
  var DIVERGE_THRESHOLD   = 0.30; // pairs with >=0.30 stress gap = divergence
  var ELEVATED_THRESHOLD  = 0.45; // stress >=0.45 = elevated
  var EVIDENCE_LOW        = 0.40; // evidenceQuality < 0.40 = weak evidence
  var FEED_INTEGRITY_LOW  = 0.34; // feedIntegrity < 1/3 = underfed
  var REBUILD_DEBOUNCE_MS = 600;

  var _last = null;
  var _timer = null;

  // ─── Brain-node taxonomy (loaded once, cached for the page session) ──────
  // Each entry in brain-node-domains.json maps a node to one or more
  // {domain, label, role} business bindings. We invert this once at module
  // init into NODE_TO_DOMAINS so the audit can answer "given brain node N
  // is engaged by stressed domain A, which other business domains also
  // canonically bind a role at N, and what role?"
  //
  // This replaces (well, supplements — both run in parallel) the static
  // AFFINITY_GROUPS list above. Static groups encode operator priors;
  // node-shared affinities encode neurology. Both findings emit; consumers
  // pick which lens to display.
  var _NODE_TO_DOMAINS = null;
  var _taxonomyLoadAttempted = false;

  // Map raw business-domain labels in brain-node-domains.json to the
  // domain ids used in LIMENCivilizationAdapter. Keep conservative:
  // unmapped entries pass through unchanged.
  //
  // IMPORTANT — alias TARGETS are the RUNTIME / SNAPSHOT keys the civilization
  // adapter actually packets under (NOT the portal/URL canonical key), because
  // _nodeSharedAffinities resolves siblings against `packets[domain]`. Per
  // assets/js/domain-identity.js four domains have a runtime key that differs
  // from their portal/canonical key:
  //   trade      → runtime/snapshot key 'supplyChain'  (portal key 'trade')
  //   medicine   → runtime/snapshot key 'health'       (portal key 'medicine')
  //   science    → runtime/snapshot key 'research'     (portal key 'science')
  //   agriculture→ runtime/snapshot key 'agriculture'  (portal key 'p2_agri')
  // brain-node-domains.json keys its bindings by the CANONICAL/portal value
  // (verified: it carries 'trade' x123, 'legal', 'family', 'p2', 'science',
  // etc.), so we must normalize those canonical values DOWN to the runtime key
  // the packets are stored under — otherwise the sibling-stress lookup silently
  // misses (e.g. node value 'trade' would never match packet key 'supplyChain').
  var TAXONOMY_DOMAIN_ALIASES = {
    'business':              'economy',   // generic 'business' rolls up to economy
    'addiction':             'medicine',
    'neurology':             'medicine',
    'psychedelic':           'medicine',
    'metabolic':             'medicine',
    'pediatric':             'medicine',
    'contemplative':         'religion',
    'provider':              'medicine',
    'p2_agri':               'agriculture',
    'research':              'science',
    // ─── trade ↔ supplyChain dual-naming (the load-bearing fix) ───────────
    // brain-node-domains.json tags trade bindings with the canonical value
    // 'trade'; the civilization adapter packets the trade brain under its
    // runtime/snapshot key 'supplyChain' (trade-brain.js domainId/snapshotKey
    // = 'supplyChain', portalKey 'trade'). Map the canonical node value to the
    // runtime key so node-shared affinities resolve. The legacy reverse entry
    // ('supplyChain' → ...) is kept idempotent below for forward-compat with
    // any node entry that already uses the runtime key.
    'trade':                 'supplyChain', // canonical node value → runtime packet key
    'supplyChain':           'supplyChain', // already the runtime key — pass through unchanged
    'logistics':             'supplyChain', // logistics-neutral variant → trade runtime key
    'shipping':              'supplyChain', // logistics-neutral variant → trade runtime key
    'freight':               'supplyChain', // logistics-neutral variant → trade runtime key
    // ─── other canonical→runtime / synonym normalizations present in data ──
    'legal':                 'law',         // brain-node uses 'legal' synonym for the law domain
    'family':                'population',   // brain-node 'family' rolls up to population
    'p2':                    'agriculture'   // brain-node 'p2' is the agriculture phase-2 tag
  };

  // The set of runtime/snapshot domain keys the audit can actually resolve a
  // packet for. Used to flag node-domain values that normalize to something
  // outside the known surface (an atlas/mapping gap). Sourced from the
  // civilization adapter's known domains when available, else a static
  // fallback mirroring assets/js/domain-identity.js snapshot keys.
  // Includes BOTH runtime/snapshot keys (health, research, supplyChain) AND the
  // canonical portal keys that pre-existing alias entries target (medicine,
  // science, trade) — so the ATLAS_MAPPING_GAP guard fires ONLY for genuinely
  // unrecognized node-domain values, never for the established mappings. (The
  // medicine→health / science→research canonical-vs-runtime mismatch is a known
  // pre-existing condition for those domains and is intentionally out of scope
  // for this trade-parity port; this guard does not regress it.)
  var KNOWN_RUNTIME_DOMAINS = {
    energy: 1, supplyChain: 1, finance: 1, economy: 1, governance: 1,
    infrastructure: 1, education: 1, technology: 1, communication: 1,
    culture: 1, defense: 1, environment: 1, religion: 1, population: 1,
    law: 1, intelligence: 1, industry: 1, health: 1, research: 1,
    agriculture: 1,
    // canonical/portal keys that established TAXONOMY_DOMAIN_ALIASES targets use
    medicine: 1, science: 1, trade: 1
  };

  // Accumulates node-domain values that could not be normalized to a known
  // runtime key during the last taxonomy load, so recompute() can surface an
  // ATLAS_MAPPING_GAP warning. Observer-only; never throws, never mutates data.
  var _unmappedTaxDomains = {};

  function _normalizeTaxDomain(d) {
    if (!d) return null;
    return TAXONOMY_DOMAIN_ALIASES[d] || d;
  }

  function _loadTaxonomy() {
    if (_NODE_TO_DOMAINS || _taxonomyLoadAttempted) return;
    _taxonomyLoadAttempted = true;
    fetch('/assets/data/brain-node-domains.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || typeof j !== 'object') return;
        var idx = {};
        var unmapped = {};
        for (var node in j) {
          if (node.charAt(0) === '_') continue;
          var entries = j[node];
          if (!Array.isArray(entries)) continue;
          var list = [];
          var seen = {};
          for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (!e || !e.domain) continue;
            var norm = _normalizeTaxDomain(e.domain);
            if (!norm || seen[norm]) continue;  // dedup by normalized domain
            // Atlas/mapping-gap detection: a node-domain value that normalizes
            // to something outside the known runtime surface will silently miss
            // the packet lookup in _nodeSharedAffinities. Record it (raw →
            // normalized) so recompute() can surface an ATLAS_MAPPING_GAP. This
            // is the trade↔supplyChain dual-naming guard generalized: it catches
            // any future variant spelling ('supply chain', 'logistics', etc.)
            // before it becomes a silent mismatch.
            if (!KNOWN_RUNTIME_DOMAINS[norm]) {
              unmapped[e.domain] = norm;
            }
            seen[norm] = true;
            list.push({ domain: norm, role: e.role || '', label: e.label || '' });
          }
          if (list.length > 0) idx[node] = list;
        }
        _NODE_TO_DOMAINS = idx;
        _unmappedTaxDomains = unmapped;
        // Trigger a rebuild now that the taxonomy is available so the first
        // findings emission carries node-shared affinities.
        _scheduleRebuild();
      })
      .catch(function () { /* observer-only; silent fail */ });
  }

  function _allPackets() {
    var adapter = (typeof window !== 'undefined') ? window.LIMENCivilizationAdapter : null;
    if (adapter && typeof adapter.getAll === 'function') return adapter.getAll() || {};
    return (typeof window !== 'undefined' && window.LIMENCivilizationPackets) || {};
  }

  function _stress(pkt)   { return pkt && typeof pkt.stressScore === 'number' ? pkt.stressScore : null; }
  function _evidence(pkt) { return pkt && pkt.audit && typeof pkt.audit.evidenceQuality === 'number' ? pkt.audit.evidenceQuality : null; }
  function _integrity(pkt){ return pkt && pkt.audit && typeof pkt.audit.feedIntegrity === 'number'   ? pkt.audit.feedIntegrity   : null; }
  function _flags(pkt)    { return Array.isArray(pkt && pkt.auditFlags) ? pkt.auditFlags : []; }

  // ─── Corroboration ──────────────────────────────────────────────────────
  // For each affinity group, are members within STRESS_AGREE_BAND of each
  // other AND elevated together? Only emits non-trivial findings.
  function _corroborations(packets) {
    var out = [];
    for (var i = 0; i < AFFINITY_GROUPS.length; i++) {
      var grp = AFFINITY_GROUPS[i];
      var present = [];
      for (var j = 0; j < grp.domains.length; j++) {
        var p = packets[grp.domains[j]];
        var s = _stress(p);
        if (s != null) present.push({ id: grp.domains[j], stress: s, packet: p });
      }
      if (present.length < 2) continue;
      var min = Math.min.apply(null, present.map(function (x) { return x.stress; }));
      var max = Math.max.apply(null, present.map(function (x) { return x.stress; }));
      var avg = present.reduce(function (a, x) { return a + x.stress; }, 0) / present.length;
      var spread = max - min;
      var elevated = present.filter(function (x) { return x.stress >= ELEVATED_THRESHOLD; });
      // Corroboration requires at least 2 members elevated and tight spread.
      if (elevated.length >= 2 && spread <= STRESS_AGREE_BAND) {
        var summary = elevated.map(function (e) { return e.id; }).join(' + ') +
          ' aligning at ' + Math.round(avg * 100) + '% stress (Δ' + (spread * 100).toFixed(0) + '%)';
        out.push({
          groupId:        grp.id,
          domains:        elevated.map(function (e) { return e.id; }),
          allInGroup:     present.map(function (x) { return x.id; }),
          avgStress:      avg,
          spread:         spread,
          summary:        summary,
          confidence:     Math.max(0, 1 - (spread / STRESS_AGREE_BAND)) * Math.min(1, elevated.length / 3)
        });
      }
    }
    return out;
  }

  // ─── Divergence ─────────────────────────────────────────────────────────
  // Pairs of domains whose stress differs by >= DIVERGE_THRESHOLD. Only
  // emits pairs where at least one side is elevated (else low/low pairs
  // would dominate).
  function _divergences(packets) {
    var ids = Object.keys(packets);
    var out = [];
    for (var a = 0; a < ids.length; a++) {
      for (var b = a + 1; b < ids.length; b++) {
        var pA = packets[ids[a]], pB = packets[ids[b]];
        var sA = _stress(pA), sB = _stress(pB);
        if (sA == null || sB == null) continue;
        var gap = Math.abs(sA - sB);
        if (gap < DIVERGE_THRESHOLD) continue;
        if (sA < ELEVATED_THRESHOLD && sB < ELEVATED_THRESHOLD) continue;
        // Heuristic: only emit "interesting" divergences for domain pairs
        // that share an affinity group. Skip noise across unrelated domains.
        var related = false;
        for (var gi = 0; gi < AFFINITY_GROUPS.length; gi++) {
          var g = AFFINITY_GROUPS[gi];
          if (g.domains.indexOf(ids[a]) >= 0 && g.domains.indexOf(ids[b]) >= 0) { related = true; break; }
        }
        if (!related) continue;
        var hi = sA >= sB ? ids[a] : ids[b];
        var lo = hi === ids[a] ? ids[b] : ids[a];
        out.push({
          domainA: ids[a], stressA: sA,
          domainB: ids[b], stressB: sB,
          gap:     gap,
          summary: hi + ' (' + Math.round(Math.max(sA, sB) * 100) + '%) diverging from ' +
                   lo + ' (' + Math.round(Math.min(sA, sB) * 100) + '%)'
        });
      }
    }
    out.sort(function (x, y) { return y.gap - x.gap; });
    return out.slice(0, 5);
  }

  // ─── Quality lists ──────────────────────────────────────────────────────
  function _qualityLists(packets) {
    var proxyHeavy = [], underfed = [], baselineHeavy = [], evidenceWeak = [];
    var ids = Object.keys(packets);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], p = packets[id];
      var ev = _evidence(p), fi = _integrity(p), flags = _flags(p);
      if (ev != null && ev < EVIDENCE_LOW) {
        proxyHeavy.push({ domain: id, evidenceQuality: ev, summary: id + ' evidence quality ' + Math.round(ev * 100) + '% — proxy-heavy' });
      }
      if (fi != null && fi < FEED_INTEGRITY_LOW) {
        underfed.push({ domain: id, feedIntegrity: fi, summary: id + ' feed integrity ' + Math.round(fi * 100) + '% — under-fed' });
      }
      if (flags.indexOf('BASELINE_HEAVY') >= 0) {
        baselineHeavy.push({ domain: id, summary: id + ' diagnoses appear baseline-heavy (low feed evidence)' });
      }
      if (flags.indexOf('LOW_FEED_PROVENANCE') >= 0 || flags.indexOf('STRESS_DERIVED_DX') >= 0) {
        evidenceWeak.push({ domain: id, flags: flags.filter(function (f) { return f === 'LOW_FEED_PROVENANCE' || f === 'STRESS_DERIVED_DX'; }), summary: id + ' diagnoses lack feed provenance' });
      }
    }
    return { proxyHeavy: proxyHeavy, underfed: underfed, baselineHeavy: baselineHeavy, evidenceWeak: evidenceWeak };
  }

  // ─── Convergence — multi-domain elevated AND corroborated by ≥1 group ──
  function _convergence(packets, corroborations) {
    var elev = [];
    var ids = Object.keys(packets);
    for (var i = 0; i < ids.length; i++) {
      var s = _stress(packets[ids[i]]);
      if (s != null && s >= ELEVATED_THRESHOLD) elev.push(ids[i]);
    }
    if (elev.length < 3) return [];
    if (corroborations.length === 0) return [];
    return [{
      domains:    elev,
      groups:     corroborations.map(function (c) { return c.groupId; }),
      summary:    elev.length + ' domains elevated with ' + corroborations.length +
                  ' affinity-group corroboration' + (corroborations.length === 1 ? '' : 's'),
      confidence: Math.min(1, corroborations.reduce(function (a, c) { return a + c.confidence; }, 0) / corroborations.length)
    }];
  }

  // ─── Pairwise comparisons (e.g. medicine vs religion evidence) ──────────
  function _comparisons(packets) {
    var rivals = [
      ['medicine', 'religion'],
      ['research', 'communication'],
      ['economy', 'governance'],
      ['defense', 'law'],
      ['energy', 'environment'],
      // Infrastructure vs its institutional envelope (mirror of
      // energy↔environment): when infrastructure evidence (grid / SCADA /
      // bridge / water telemetry) is strong but governance, law, or finance
      // are proxy-heavy, the bottleneck is institutional capability — the
      // decision-making gap for infrastructure capital & deferred maintenance,
      // not physical signal.
      ['infrastructure', 'governance'],   // grid/SCADA reliability ↔ policy & permitting stress
      ['infrastructure', 'law'],          // public-works compliance ↔ regulatory enforcement
      ['infrastructure', 'finance'],      // capital access for maintenance ↔ funding-quality stress
      // Culture vs its support infrastructure (mirror of infrastructure↔its
      // institutional envelope): when cultural-output evidence (streaming /
      // virality / venue / festival / fanbase telemetry) is strong but
      // research, education, or finance are proxy-heavy, the bottleneck is
      // support capability — the development pipeline, taste literacy, and
      // creator capital, not the cultural signal itself.
      ['culture', 'research'],            // artist/scene vitality ↔ creative-research & archive infrastructure
      ['culture', 'education'],           // live taste-making/trend signal ↔ literacy & canon-formation stress
      ['culture', 'finance'],             // creator-revenue & venue economics ↔ capital-access quality stress
      // Finance vs its economic / legal / policy envelope (mirror of
      // infrastructure↔its institutional envelope): when finance evidence
      // (bank balance sheets, credit spreads, liquidity & solvency telemetry
      // for JPM/BAC/GS/MS/C/WFC/SCHW, payment rails V/MA, asset managers
      // BLK/KKR/BX) is strong but economy, law, or governance are proxy-heavy,
      // the bottleneck is the surrounding institutional capability — economic
      // demand measurement, regulatory enforcement capacity, and monetary/
      // prudential oversight — not the financial signal itself. Finance drives
      // the comparison as a source domain rather than only being a target.
      ['finance', 'economy'],             // capital flows / credit conditions ↔ economic-activity & demand signal
      ['finance', 'law'],                 // lending & solvency stress ↔ regulatory / securities enforcement quality
      ['finance', 'governance'],          // credit conditions & systemic risk ↔ monetary/fiscal policy & oversight
      // Technology vs its physical / capability envelope (mirror of
      // infrastructure↔its institutional envelope and finance↔its economic
      // envelope): when technology evidence (chip-inventory & foundry telemetry,
      // cyber-threat / CVE disclosure feeds, software release calendars, GitHub
      // commit velocity, patent filings for AAPL/MSFT/NVDA/GOOGL/META/AMZN/AVGO/
      // ORCL/CRM/AMD/INTC/TSM/ASML/PLTR/CRWD/PANW) is rich but infrastructure,
      // defense, or energy are proxy-heavy, the bottleneck is the physical/policy
      // signal — grid telemetry, attack-capability data, deferred build-out — not
      // the tech signal. Technology drives the comparison as a source domain.
      ['technology', 'infrastructure'],   // chip/software/cyber telemetry ↔ physical grid/SCADA/build-out signal
      ['technology', 'defense'],          // CVE/cyber-threat & release feeds ↔ kinetic attack-capability signal
      ['technology', 'energy'],           // compute/foundry & semiconductor signal ↔ grid/power telemetry quality
      // Defense vs its institutional / capability partners (mirror of
      // technology↔its physical envelope and finance↔its economic envelope):
      // when defense evidence (procurement announcements, readiness reports,
      // weapons-test signals, defense-budget cycle, contractor backlog for
      // LMT/RTX/NOC/GD/BA/LHX/HII/LDOS/BAH/KTOS/AVAV) is strong but the partner
      // domain is proxy-heavy, the bottleneck is the partner's signal quality —
      // the intelligence/collection picture, the cyber/physical signal, or the
      // macro demand cycle — not the defense signal itself. Defense drives the
      // comparison as a source domain across all institutional partners.
      ['defense', 'intelligence'],        // procurement/readiness signal ↔ ISR/collection & threat-posture quality
      ['defense', 'technology'],          // kinetic/industrial readiness signal ↔ cyber/CVE & compute-coupling quality
      ['defense', 'infrastructure'],      // weapons-system & basing signal ↔ cyber-physical grid/SCADA telemetry quality
      ['defense', 'economy'],             // military-spending & procurement cycle ↔ macro demand & budget-capacity signal
      // Governance vs its institutional partners (mirror of technology↔its
      // physical envelope, finance↔its economic envelope, defense↔its
      // capability partners): when governance evidence (Federal Register
      // rulemaking volume, GAO/IG oversight reports, CBO/OMB fiscal projections,
      // V-Dem / World Bank WGI institutional indicators, public-services-delivery
      // telemetry for TYL/MMS/ACN/GDIT govtech) is strong but the partner domain
      // is proxy-heavy, the bottleneck is the partner's signal — the legal/
      // enforcement record, the research/evidence base, the fiscal-capacity
      // signal, the public-confidence read, or the collection-authority picture —
      // not the governance signal itself. Governance drives the comparison as a
      // SOURCE domain across its institutional partners. Governance kept DISTINCT
      // from law (judicial/legal-system), economy (macro), finance (capital),
      // intelligence (collection); these are policy/oversight contrasts.
      ['governance', 'law'],              // rulemaking/oversight signal ↔ legal-enforcement & judicial-system signal quality
      ['governance', 'research'],         // policy-evidence demand ↔ research-consensus & evidence-base signal quality
      ['governance', 'finance'],          // public-finance & budget-capacity signal ↔ capital-market & funding signal quality
      ['governance', 'population'],       // legitimacy & institutional-trust signal ↔ public-confidence & political-stability read
      ['governance', 'intelligence'],     // policy-tasking & oversight-authority signal ↔ collection-authorization & ISR picture quality
      // Communication vs its institutional / capability partners (mirror of
      // technology↔its physical envelope, finance↔its economic envelope,
      // defense↔its capability partners, governance↔its institutional partners):
      // when communication evidence (carrier network-uptime & spectrum telemetry
      // for VZ/T/TMUS, broadband/cable subscriber & outage feeds for CMCSA/CHTR,
      // tower-occupancy for AMT/CCI/SBAC, routing-fabric/peering telemetry for
      // CSCO/ANET, newsroom/audience & circulation signal for NWSA/NYT,
      // platform-distribution reach for META/GOOGL) is strong but the partner
      // domain is proxy-heavy, the bottleneck is the partner's signal quality —
      // the spectrum/platform policy read, the free-speech/liability legal record,
      // the ad-revenue/newsroom-capital signal, the physical tower/fiber plant
      // telemetry, or the content/cultural read — NOT the communication signal
      // itself. Communication drives the comparison as a SOURCE domain across its
      // institutional partners. Kept DISTINCT from culture (content/scenes),
      // technology (gear/cloud coupling), and intelligence (collection coupling).
      ['communication', 'governance'],    // spectrum/platform/broadcast-licensing signal ↔ media & telecom policy/oversight quality
      ['communication', 'law'],           // free-speech/platform-liability & press-protection signal ↔ legal-enforcement record quality
      ['communication', 'finance'],       // newsroom/carrier ad-revenue & capex signal ↔ media-operations capital-access quality
      ['communication', 'infrastructure'],// network-uptime & tower/fiber carriage signal ↔ physical telecom-plant telemetry quality
      ['communication', 'culture']        // narrative-carriage & distribution-reach signal ↔ cultural-content/scene-vitality read quality
    ];
    var out = [];
    for (var i = 0; i < rivals.length; i++) {
      var a = rivals[i][0], b = rivals[i][1];
      var pA = packets[a], pB = packets[b];
      var eA = _evidence(pA), eB = _evidence(pB);
      if (eA == null || eB == null) continue;
      var diff = eA - eB;
      if (Math.abs(diff) < 0.15) continue;
      var stronger = diff > 0 ? a : b;
      var weaker   = diff > 0 ? b : a;
      out.push({
        stronger: stronger, weaker: weaker,
        diff: Math.abs(diff),
        summary: stronger + ' is stronger than ' + weaker + ' in evidence quality (Δ ' + Math.round(Math.abs(diff) * 100) + '%)'
      });
    }
    return out;
  }

  // ─── Node-shared affinities (neurology-grounded) ────────────────────────
  // For each elevated domain A, find the brain nodes its active diagnoses
  // touch via portal.issues[].circuits[].nodeId. Then look up which OTHER
  // business domains canonically bind a role at that same node (per
  // brain-node-domains.json). Emits one finding per (elevated_domain,
  // brain_node) tuple, with the sibling domains attached + their current
  // stress for visibility.
  //
  // Sources of circuit-node truth, in priority order:
  //   1. window.LIMENDomains[id].state.diagnoses[].circuits[].nodeId
  //      (already populated by every domain brain per cycle)
  //   2. activeDiagnoses on the packet — only carries labels, no circuits;
  //      we'd need a portal fetch to resolve, which the observer must not
  //      do. Skip if (1) unavailable.
  //
  // Why this matters: this is the mechanism by which neurology and business
  // share signal. A grid-collapse stress in energy ENGAGES THAL (thalamus /
  // routing). THAL is the same node finance binds for "Trade Agreements"
  // and medicine binds for "Diagnostic Routing." When energy is stressed
  // at THAL, the audit surfaces the canonical co-bindings so downstream
  // engines (patent / grant / opportunity surfacing) can read the
  // neurological adjacency without re-deriving it.
  function _domainBrainState(domainId) {
    var brains = (typeof window !== 'undefined') ? window.LIMENDomains : null;
    if (!brains) return null;
    var b = brains[domainId];
    if (!b || !b.state) return null;
    return b.state;
  }

  function _circuitNodesForDomain(domainId) {
    var state = _domainBrainState(domainId);
    if (!state || !Array.isArray(state.diagnoses)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < state.diagnoses.length; i++) {
      var dx = state.diagnoses[i];
      if (!dx || !dx.active) continue;
      var circuits = Array.isArray(dx.circuits) ? dx.circuits : [];
      for (var j = 0; j < circuits.length; j++) {
        var c = circuits[j];
        if (!c || !c.nodeId) continue;
        var key = c.nodeId;
        if (seen[key]) continue;
        seen[key] = true;
        out.push({
          nodeId: c.nodeId,
          diagnosisId:    dx.id || '',
          diagnosisLabel: dx.label || dx.id || '',
          dir:            c.dir || '',
          detail:         c.detail || '',
          evidence:       c.evidence || ''
        });
      }
    }
    return out;
  }

  function _nodeSharedAffinities(packets) {
    var out = [];
    if (!_NODE_TO_DOMAINS) return out;

    var ids = Object.keys(packets);
    for (var i = 0; i < ids.length; i++) {
      var srcId = ids[i];
      var p = packets[srcId];
      var sStress = _stress(p);
      if (sStress == null || sStress < ELEVATED_THRESHOLD) continue;

      var nodes = _circuitNodesForDomain(srcId);
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        var siblings = _NODE_TO_DOMAINS[node.nodeId];
        if (!siblings || siblings.length === 0) continue;

        var shared = [];
        for (var k = 0; k < siblings.length; k++) {
          var sib = siblings[k];
          if (sib.domain === srcId) continue;   // skip self
          var sibPkt = packets[sib.domain];
          var sibStress = _stress(sibPkt);
          shared.push({
            domain:     sib.domain,
            role:       sib.role,
            label:      sib.label,
            stress:     sibStress,
            elevated:   sibStress != null && sibStress >= ELEVATED_THRESHOLD,
            packetSeen: !!sibPkt
          });
        }
        if (shared.length === 0) continue;

        // Sort siblings: elevated first, then by stress desc
        shared.sort(function (a, b) {
          if (a.elevated !== b.elevated) return a.elevated ? -1 : 1;
          return (b.stress || 0) - (a.stress || 0);
        });

        var elevatedSiblings = shared.filter(function (s) { return s.elevated; });
        var summary = srcId + ' stressed at brain node ' + node.nodeId +
                      ' (' + (node.diagnosisLabel || 'active dx') + ')' +
                      ' — ' + shared.length + ' business domain' +
                      (shared.length === 1 ? '' : 's') +
                      ' canonically co-bound at this node' +
                      (elevatedSiblings.length > 0
                        ? '; ' + elevatedSiblings.length + ' also elevated: ' +
                          elevatedSiblings.map(function (s) { return s.domain; }).join(', ')
                        : '');

        out.push({
          source:           srcId,
          sourceStress:     sStress,
          brainNode:        node.nodeId,
          diagnosisId:      node.diagnosisId,
          diagnosisLabel:   node.diagnosisLabel,
          circuitDir:       node.dir,
          circuitDetail:    node.detail,
          circuitEvidence:  node.evidence,
          sharedWith:       shared,
          elevatedSiblings: elevatedSiblings.length,
          summary:          summary
        });
      }
    }

    // Sort findings: source stress desc, then elevated-sibling count desc
    out.sort(function (a, b) {
      if (b.elevatedSiblings !== a.elevatedSiblings) return b.elevatedSiblings - a.elevatedSiblings;
      return (b.sourceStress || 0) - (a.sourceStress || 0);
    });
    return out;
  }

  // ─── Atlas-gap warnings (brain-taxonomy completeness) ───────────────────
  // Technology's cross-domain influence (semiconductors → energy/defense/
  // finance/infrastructure) is invisible if brain nodes don't bind it. The
  // brain taxonomy (brain-node-domains.json) does not yet carry technology
  // sub-domains (semiconductors, cybersecurity, AI/ML), so the neurology-
  // grounded _nodeSharedAffinities mechanism is silent for technology even
  // when it is elevated. Rather than fail silently, emit a visible WARNING so
  // the upstream brain-mapping gap is forced into view. Mirror-extensible to
  // any future domain absent from the atlas while elevated.
  function _atlasGapWarnings(packets, nodeShared) {
    var out = [];
    var s = _stress(packets['technology']);
    if (s != null && s >= ELEVATED_THRESHOLD) {
      var techBound = nodeShared.filter(function (n) { return n.source === 'technology'; }).length;
      if (techBound === 0) {
        out.push({
          warning: 'TECHNOLOGY_ATLAS_GAP',
          domain:  'technology',
          stress:  s,
          message: 'Technology elevated but not connected via brain node map — brain taxonomy may be incomplete.'
        });
      }
    }

    // ─── ATLAS_MAPPING_GAP — node-domain values that did not normalize to a
    // known runtime key. This is the trade↔supplyChain dual-naming guard made
    // general: brain-node-domains.json keys trade bindings as the canonical
    // 'trade' while packets are stored under runtime key 'supplyChain'; if a
    // future node-domains update introduces a variant spelling ('supply chain',
    // 'logistics', etc.) that TAXONOMY_DOMAIN_ALIASES does not cover, the
    // sibling-stress lookup in _nodeSharedAffinities would silently miss. Rather
    // than fail silently, surface every un-normalizable value (raw → normalized)
    // so the mapping gap is forced into view. Observer-only; emits one warning
    // per distinct raw value.
    var gapKeys = Object.keys(_unmappedTaxDomains);
    for (var gi = 0; gi < gapKeys.length; gi++) {
      var raw = gapKeys[gi];
      var norm = _unmappedTaxDomains[raw];
      out.push({
        warning:     'ATLAS_MAPPING_GAP',
        rawDomain:   raw,
        normalized:  norm,
        message:     'brain-node-domains.json domain "' + raw + '" normalized to "' +
                     norm + '", which is not a known runtime domain key — ' +
                     'add it to TAXONOMY_DOMAIN_ALIASES (e.g. trade↔supplyChain) ' +
                     'or its node-shared affinities will silently miss.'
      });
    }
    return out;
  }

  function recompute() {
    var packets = _allPackets();
    var corroborations = _corroborations(packets);
    var divergences   = _divergences(packets);
    var quality       = _qualityLists(packets);
    var convergence   = _convergence(packets, corroborations);
    var comparisons   = _comparisons(packets);
    var nodeShared    = _nodeSharedAffinities(packets);
    var warnings      = _atlasGapWarnings(packets, nodeShared);
    _last = {
      timestamp:           Date.now(),
      domainCount:         Object.keys(packets).length,
      corroborations:      corroborations,
      divergences:         divergences,
      proxyHeavy:          quality.proxyHeavy,
      underfed:            quality.underfed,
      baselineHeavy:       quality.baselineHeavy,
      evidenceWeak:        quality.evidenceWeak,
      convergence:         convergence,
      comparisons:         comparisons,
      nodeSharedAffinities: nodeShared,
      warnings:            warnings,
      taxonomyLoaded:      !!_NODE_TO_DOMAINS
    };
    if (typeof window !== 'undefined') window.LIMENCrossDomainAuditState = _last;
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('limen:cross-domain-audit-update', { detail: _last }));
      }
    } catch (err) { /* observer must never throw */ }
    return _last;
  }

  function _scheduleRebuild() {
    if (_timer) return;
    _timer = setTimeout(function () {
      _timer = null;
      try { recompute(); } catch (err) { /* observer-only */ }
    }, REBUILD_DEBOUNCE_MS);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('limen:civilization-packets-update', _scheduleRebuild);
    // Initial best-effort rebuild — packets may not exist yet; harmless if so.
    setTimeout(function () { try { recompute(); } catch (e) {} }, 800);
    // Kick off the brain-node taxonomy load. When it lands, the loader
    // schedules a rebuild so the first findings emission that includes
    // nodeSharedAffinities happens automatically.
    _loadTaxonomy();

    window.LIMENCrossDomainAudit = {
      recompute: recompute,
      get:       function () { return _last; },
      taxonomyLoaded: function () { return !!_NODE_TO_DOMAINS; }
    };
  }
})();
