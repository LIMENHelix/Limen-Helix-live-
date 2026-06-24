/**
 * civilization/artifact-packet-builder.js
 * LIMEN HELIX — D3-A3.v3 ArtifactPacket Builder.
 *
 * D3-A3.5 rewrite — Path 2: node-level ArtifactPackets driven by HandoffPacket
 * as the canonical opportunity unit. Observatory packets become evidence
 * enrichment via the (domain, lane→path, diagnosis) tuple. ArtifactPacket
 * count = HandoffPacket count.
 *
 * Composes a read-only ArtifactPacket from already-running packet surfaces:
 *   - HandoffPacket       (window.LIMENMainBrainHandoffState — primary)
 *   - Observatory packet  (window.LIMENObservatory.getPackets() — enrichment)
 *   - /api/domain-snapshot response (passed via options.snapshot, optional)
 *
 * Builder discipline:
 *   - NEVER fetches.
 *   - NEVER mutates input packets.
 *   - NEVER auto-runs. No script tag wiring at this stage.
 *   - NEVER subscribes to events.
 *   - NEVER writes localStorage / persistence.
 *   - Returns deep-frozen objects.
 *
 * Authority decision (D3-A3.5 / Path 2):
 *   HandoffPacket is the canonical opportunity unit (node-level). Observatory
 *   packets enrich via the (domain, lane→path, diagnosis) tuple. ArtifactPacket
 *   count is exactly HandoffPacket count. The deprecated Observatory-driven
 *   path is preserved with a DEPRECATED_OBSERVATORY_DRIVEN_BUILD warning so
 *   manual DevTools callers from D3-A1/A2 still work.
 *
 * Public surface:
 *   window.LIMENArtifactPacketBuilder = {
 *     schemaVersion: 'D3-A3.v3',
 *     buildForOpportunityId(opportunityId, options) -> ArtifactPacket | null,
 *     buildFromHandoffPacket(handoffPacket, options) -> ArtifactPacket | null,   // PRIMARY
 *     buildFromObservatoryPacket(observatoryPacket, options) -> ArtifactPacket | null,  // DEPRECATED
 *     buildFromPacket(observatoryPacket, options) -> ArtifactPacket | null,
 *       // DEPRECATED ALIAS for buildFromObservatoryPacket; preserved for D3-A1
 *       // backward compatibility. Emits DEPRECATED_OBSERVATORY_DRIVEN_BUILD
 *       // warning on every call (via the underlying buildFromObservatoryPacket).
 *     buildAll(options) -> ArtifactPacket[],
 *     validateShape(packet) -> { ok, missing[], warnings[] }
 *   }
 *
 * Top-level shape (12 keys, unchanged from D3-A1.v1):
 *   {
 *     packetSchemaVersion, builtAt, sourcePacketId,
 *     identity{}, signal{}, evidence{}, implementation{}, confidence{},
 *     anti_overclaim{}, provenance{}, lane_hints{}, raw{}
 *   }
 *
 * Identity (D3-A3.v3 — sourceOpportunityId added; id semantic changed):
 *   { id, sourceOpportunityId, domain, rawDomain, title, node, lane,
 *     diagnoses, diagnosisId, playbookId, domainTemplateOf, domainTier }
 *
 *   identity.id semantic break (D3-A3.v2 → D3-A3.v3):
 *     v2 stored the underlying handoff opportunityId (e.g., 'opp-X-1') in
 *     identity.id. Multi-lane fan-out caused identity.id to repeat across
 *     lanes (same source emitted as patents AND grants AND sba), violating
 *     the "globally unique key" contract.
 *     v3 makes identity.id a globally unique COMPOSITE of the form
 *     '<sourceOpportunityId>::<lane>' (e.g., 'opp-X-1::patents'). The
 *     original handoff opportunityId is preserved at identity.sourceOpportunityId.
 *     Callers that previously read identity.id expecting the source
 *     opportunityId MUST migrate to identity.sourceOpportunityId. New
 *     callers should treat identity.id as an opaque unique key.
 *     The top-level sourcePacketId now tracks identity.id (the unique key),
 *     not sourceOpportunityId.
 *
 * Anti-overclaim (D3-A3.v2 — nodeResolved added):
 *   { confidenceClamped, evidenceSourceVerified, noUnsupportedCausalClaims,
 *     feedClassification, feedDivergence, diagnosisActive, rankInBounds,
 *     snapshotFresh, nodeResolved, warnings }
 *
 * Raw (D3-A3.v2 — handoffPacket + observatoryPackets[] for node-level path;
 * matchingHandoffPackets retained for backward compat):
 *   { handoffPacket, observatoryPackets[], matchingHandoffPackets[] }
 *
 * Warning shape:
 *   { code: string, severity: 'info'|'warn'|'block', message: string, field: string|null }
 *
 * Stable warning codes (D3-D verifier pattern-matches on these):
 *   NO_SNAPSHOT, NO_HANDOFF_MATCH, NO_PROVENANCE, NO_PRIMARY_SOURCE,
 *   PRIMARY_BY_FALLBACK, STALE_PRIMARY, CONFIDENCE_CLAMPED,
 *   EVIDENCE_VERIFY_TOKEN_MISSING, SHAPE_MISSING_REQUIRED, SHAPE_NOT_FROZEN,
 *   UNKNOWN_LANE_FOR_PATH_MAP, NO_ENRICHMENT_PATH, NO_OBSERVATORY_ENRICHMENT,
 *   ENRICHMENT_CAP_REACHED, NODE_UNRESOLVED, DEPRECATED_OBSERVATORY_ID_LOOKUP,
 *   DEPRECATED_OBSERVATORY_DRIVEN_BUILD, SCHEMA_VERSION_BUMPED,
 *   NO_LIVE_REAL_FEED, DIAGNOSIS_NOT_ACTIVE, SNAPSHOT_STALE
 */
(function () {
  'use strict';

  var SCHEMA_VERSION = 'D3-A3.v3';

  // Mirror domain-packet-adapter.js BRAIN_STALE_MS (6 min).
  var STALE_MS = 6 * 60 * 1000;

  // Cap on Observatory enrichment per HandoffPacket.
  var ENRICHMENT_CAP = 20;

  // ─── Lane → path map (D3-A3.5; extended D3-A3.7) ───────────────────────
  // HandoffPacket lane name → Observatory packet path (set by domain brains).
  // Used by _findEnrichingObservatoryPackets to scope enrichment search.
  //
  // Three states per lane:
  //   - String value (e.g., 'PATENTABLE'): valid Observatory path; enrichment
  //     filters Observatory packets where obs.path === <value>.
  //   - null value: lane is recognized as a first-class artifact lane but has
  //     no Observatory fan-in defined yet (white-space cross-domain
  //     opportunities). Builder emits NO_ENRICHMENT_PATH (info, not warn) and
  //     produces the ArtifactPacket from the HandoffPacket alone.
  //   - Key absent: lane is genuinely unrecognized. Builder emits
  //     UNKNOWN_LANE_FOR_PATH_MAP (warn) — indicates a data inconsistency
  //     that should be triaged.
  //
  // Distinction between "null value" and "key absent" uses
  // Object.prototype.hasOwnProperty so falsy checks alone don't conflate them.
  var LANE_TO_PATH = {
    'patents':           'PATENTABLE',
    'copyrights':        'PATENTABLE',
    'business-grants':   'GRANT-ELIGIBLE',
    'research-grants':   'GRANT-ELIGIBLE',
    'nsf-project-pitch': 'GRANT-ELIGIBLE',
    'sba-loans':         'INVESTABLE',
    'franchise':         null,
    'investments':       'INVESTABLE',
    'research-papers':   null,
    // ─── Finance-native + supply-chain/trade fan-out lanes (additive) ──────
    // The trade domain (runtime/snapshot key `supplyChain`; URL/portal key
    // `trade` — see domain-identity.js) emits to several lanes beyond the
    // generic grant/loan/franchise set. Per handoff-contract.js LANE_GATES,
    // supplyChain appears in the anyDomain lists of: business-grants, sba-loans,
    // franchise (above) AND the finance-native lanes credit-facilities /
    // systemic-risk / capital-access. Without entries here those lanes hit the
    // "key absent" branch and emit UNKNOWN_LANE_FOR_PATH_MAP (warn), demoting
    // every trade/finance artifact routed through them. These are LANE keys
    // (not domain keys), so they serve every domain that emits to them — energy
    // (capital-access), finance, economy, infrastructure, industry, technology,
    // and supplyChain/trade alike — exactly mirroring how sba-loans/investments
    // already map to INVESTABLE.
    //   - credit-facilities: a bounded borrower / credit-line / syndication =
    //     capital deployment → INVESTABLE path (like sba-loans).
    //   - capital-access:    funding-constraint / capital-raise shaped =
    //     INVESTABLE path (capital deployment).
    //   - systemic-risk:     cross-domain contagion / solvency-cascade signal;
    //     no Observatory fan-in path defined yet (white-space cross-domain
    //     opportunity, like franchise / research-papers) → null. The packet is
    //     built from the HandoffPacket alone and emits NO_ENRICHMENT_PATH
    //     (info, not warn) rather than UNKNOWN_LANE_FOR_PATH_MAP.
    'credit-facilities': 'INVESTABLE',
    'capital-access':    'INVESTABLE',
    'systemic-risk':     null,
    // ─── Industry-native fan-out lanes (additive) ──────────────────────────
    // The industry domain (manufacturing & industrial production — factory
    // output, capacity utilization, automation & robotics, heavy industry &
    // capital goods, machinery & equipment, industrial maintenance) emits to
    // production/capacity/automation-shaped lanes beyond the generic
    // grant/loan/investment set. Without entries here those lanes hit the
    // "key absent" branch and emit UNKNOWN_LANE_FOR_PATH_MAP (warn), demoting
    // every industry artifact routed through them. These are LANE keys (not
    // domain keys), mirroring how sba-loans / investments map to INVESTABLE.
    // Kept DISTINCT from trade (logistics/commerce lanes) and economy (macro
    // aggregate) — these are factory-floor productive-capital lanes.
    //   - industrial-capacity: capacity-utilization / line-expansion shaped =
    //     capital deployment into productive capacity → INVESTABLE path.
    //   - automation-upgrade:  factory automation / robotics retrofit =
    //     capital deployment into productivity → INVESTABLE path.
    //   - factory-output:      production-throughput / output-trend signal; no
    //     Observatory fan-in path defined yet (white-space cross-domain
    //     opportunity, like franchise / systemic-risk) → null. The packet is
    //     built from the HandoffPacket alone and emits NO_ENRICHMENT_PATH
    //     (info, not warn) rather than UNKNOWN_LANE_FOR_PATH_MAP.
    'industrial-capacity': 'INVESTABLE',
    'automation-upgrade':  'INVESTABLE',
    'factory-output':      null,
    // ─── Medicine / health-native fan-out lanes (additive) ─────────────────
    // The medicine domain (runtime/snapshot key `health`; URL/portal key
    // `medicine` — see domain-identity.js) covers healthcare delivery,
    // pharmaceuticals & biotech, hospitals & care providers, medical devices &
    // diagnostics, public health & disease control, clinical research & trials,
    // health systems & insurance, and drug development. It emits to
    // trial / R&D-financing / provider-consolidation-shaped lanes beyond the
    // generic grant/loan/investment set. Without entries here those lanes hit
    // the "key absent" branch and emit UNKNOWN_LANE_FOR_PATH_MAP (warn),
    // demoting every medicine artifact routed through them — exactly the trade /
    // industry / environment gap fixed above. These are LANE keys (not domain
    // keys), mirroring how sba-loans / investments map to INVESTABLE. Kept
    // DISTINCT from science (basic / pre-clinical research is a coupling, not the
    // care-delivery identity), from population (demographics / disease burden is
    // a coupling), and from economy (healthcare spend as a macro aggregate is a
    // coupling). Medicine binds to real healthcare authorities (FDA, NIH/NHLBI,
    // CDC, AAFP, ClinicalTrials.gov) and real healthcare operators (UNH, JNJ,
    // PFE, MRK, ABBV, LLY, TMO, ABT, MDT, ISRG, HCA, CVS, AMGN, GILD).
    //   - clinical-trial-capacity: a bounded trial-infrastructure / site-network
    //     / CRO build-out = capital deployment into trial capacity → INVESTABLE
    //     path (like sba-loans).
    //   - drug-development-financing: pharma / biotech R&D capex (pipeline
    //     financing, platform build-out) = capital deployment into drug
    //     development → INVESTABLE path (capital deployment).
    //   - healthcare-provider-consolidation: a hospital-system / provider-group /
    //     managed-care acquisition = capital deployment into care-delivery
    //     consolidation → INVESTABLE path (acquisition capital).
    'clinical-trial-capacity':           'INVESTABLE',
    'drug-development-financing':         'INVESTABLE',
    'healthcare-provider-consolidation': 'INVESTABLE',
    // ─── Environment-native fan-out lanes (additive) ───────────────────────
    // The environment domain (climate & emissions, air/water/soil pollution &
    // quality, ecosystems & biodiversity, natural resources & conservation,
    // environmental regulation & compliance, climate risk & adaptation, waste
    // management & remediation, carbon markets) emits to climate/pollution/
    // remediation/ecosystem-shaped lanes beyond the generic grant/loan/
    // investment set. Without entries here those lanes hit the "key absent"
    // branch and emit UNKNOWN_LANE_FOR_PATH_MAP (warn), demoting every
    // environment artifact routed through them. These are LANE keys (not domain
    // keys), mirroring how sba-loans / investments map to INVESTABLE. Kept
    // DISTINCT from energy (no oil/gas/grid — environment couples to energy via
    // emissions/carbon, not power generation) and from agriculture (land/water
    // USE is a coupling, not environment's identity).
    //   - climate-adaptation-infrastructure: bounded resilience facility /
    //     adaptation capital project = capital deployment → INVESTABLE path.
    //   - environmental-remediation: bounded cleanup / brownfield / superfund
    //     remediation operator = capital deployment → INVESTABLE path.
    //   - pollution-control-technology: emissions-control / treatment
    //     technology deployment = capital deployment → INVESTABLE path.
    //   - ecosystem-restoration: cross-domain multi-ecosystem opportunity
    //     spanning agriculture/environment co-elevation; no single Observatory
    //     fan-in path defined yet (white-space cross-domain opportunity, like
    //     franchise / systemic-risk / factory-output) → null. The packet is
    //     built from the HandoffPacket alone and emits NO_ENRICHMENT_PATH
    //     (info, not warn) rather than UNKNOWN_LANE_FOR_PATH_MAP.
    //   - carbon-market-access: carbon-credit / offset market access =
    //     capital deployment into a tradable instrument → INVESTABLE path.
    'climate-adaptation-infrastructure': 'INVESTABLE',
    'environmental-remediation':         'INVESTABLE',
    'pollution-control-technology':      'INVESTABLE',
    'ecosystem-restoration':             null,
    'carbon-market-access':              'INVESTABLE',
    // ─── Governance-native fan-out lanes (additive) ────────────────────────
    // The governance domain (government & public administration, public policy
    // & rulemaking, regulation & oversight, elections & democratic institutions,
    // public finance & budgets, rule of law & institutional integrity, public
    // services delivery, political stability & legitimacy) emits to
    // compliance / coordination / institutional-shaped lanes beyond the generic
    // grant/loan/investment set. Without entries here those lanes hit the "key
    // absent" branch and emit UNKNOWN_LANE_FOR_PATH_MAP (warn), demoting every
    // governance artifact routed through them — exactly the trade / industry /
    // environment gap fixed above. These are LANE keys (not domain keys),
    // mirroring how sba-loans / investments map to INVESTABLE. Governance binds
    // mostly to INSTITUTIONS & INDICATORS (World Bank WGI, V-Dem, OECD, GAO,
    // CBO, Federal Register) and real govtech operators (TYL Tyler
    // Technologies, MMS Maximus, BAH, LDOS, ACN, GDIT), NOT single companies.
    // Kept DISTINCT from economy (macro aggregate), finance (capital markets),
    // law (judicial / legal-system is the law domain), and intelligence
    // (collection / analysis). Governance content = rulemaking / oversight /
    // public administration / institutional integrity.
    //   - regulatory-compliance-modernization: a bounded compliance-
    //     infrastructure build-out (rulemaking modernization, regulatory tech,
    //     public-sector compliance systems) = capital deployment into
    //     compliance infrastructure → INVESTABLE path (like sba-loans).
    //   - policy-coordination-platform: an inter-agency coordination platform
    //     (shared services, cross-jurisdiction policy alignment, govtech
    //     coordination) = capital deployment into a coordination platform →
    //     INVESTABLE path (capital deployment).
    //   - institutional-integrity: rule-of-law / oversight / anti-corruption /
    //     legitimacy signal bound to governance INDICATORS (WGI, V-Dem, GAO);
    //     genuine white-space — no Observatory fan-in path defined yet (like
    //     franchise / systemic-risk / factory-output / ecosystem-restoration)
    //     → null. The packet is built from the HandoffPacket alone and emits
    //     NO_ENRICHMENT_PATH (info, not warn) rather than UNKNOWN_LANE_FOR_PATH_MAP.
    'regulatory-compliance-modernization': 'INVESTABLE',
    'policy-coordination-platform':        'INVESTABLE',
    'institutional-integrity':             null,
    // ─── Communication-native fan-out lanes (additive) ─────────────────────
    // The communication domain (telecommunications & networks, connectivity &
    // broadband, internet infrastructure — towers / fiber / spectrum, media &
    // broadcasting CHANNELS, journalism & news flow, information dissemination,
    // social-media platforms as distribution, public-discourse infrastructure)
    // emits to connectivity / spectrum / information-flow-shaped lanes beyond
    // the generic grant/loan/investment set. Without entries here those lanes
    // hit the "key absent" branch and emit UNKNOWN_LANE_FOR_PATH_MAP (warn),
    // demoting every communication artifact routed through them — exactly the
    // trade / industry / environment / governance gap fixed above. These are
    // LANE keys (not domain keys), mirroring how sba-loans / investments map to
    // INVESTABLE. Communication is the NEGOTIATOR, not a secondary participant:
    // defense owns 'defense-procurement', intelligence owns
    // 'intelligence-operations', industry owns 'industrial-capacity', and
    // communication owns its connectivity / spectrum / information lanes. Kept
    // DISTINCT from culture (culture = content / movements / scenes;
    // communication = the CHANNELS / networks / information-flow), from
    // technology (chips / software is a coupling, not the carrier identity), and
    // from intelligence (signals COLLECTION is a coupling, not communication's
    // open-network distribution identity).
    //   - media-infrastructure-resilience: bounded telecom / broadcast / fiber
    //     resilience capex (5G build-out, fiber-to-the-home, tower / data-center
    //     interconnect, broadcast hardening) = capital deployment into carrier
    //     infrastructure → INVESTABLE path (like sba-loans).
    //   - spectrum-allocation-compliance: an FCC spectrum-modernization /
    //     auction / licensing / regulatory-compliance build-out = capital
    //     deployment into spectrum & compliance infrastructure → INVESTABLE path
    //     (capital deployment).
    //   - information-ecosystem-integrity: content-moderation / disinformation
    //     countermeasures / press-freedom / internet-shutdown-resilience signal
    //     bound to communication INDICATORS (RSF Press Freedom Index, CPJ,
    //     Netblocks, Cloudflare Radar); genuine white-space — no Observatory
    //     fan-in path defined yet (like franchise / systemic-risk /
    //     factory-output / ecosystem-restoration / institutional-integrity) →
    //     null. The packet is built from the HandoffPacket alone and emits
    //     NO_ENRICHMENT_PATH (info, not warn) rather than UNKNOWN_LANE_FOR_PATH_MAP.
    'media-infrastructure-resilience': 'INVESTABLE',
    'spectrum-allocation-compliance':  'INVESTABLE',
    'information-ecosystem-integrity': null,
    // ─── Education-native fan-out lanes (additive) ─────────────────────────
    // The education domain (K-12 schools & higher-ed institutions, edtech &
    // online learning, student outcomes & literacy, teaching & curriculum,
    // education funding & access/equity, workforce training & skills,
    // credentialing & enrollment, student debt) emits to outcome /
    // curriculum / access-shaped lanes beyond the generic grant/loan/
    // investment set. Without entries here those lanes hit the "key absent"
    // branch and emit UNKNOWN_LANE_FOR_PATH_MAP (warn), demoting every
    // education artifact routed through them — exactly the trade / industry /
    // environment / governance / communication gap fixed above. These are
    // LANE keys (not domain keys), mirroring how sba-loans / investments map
    // to INVESTABLE. Kept DISTINCT from science (basic research is the science
    // domain), from population (demographics is a coupling), from technology
    // (edtech tooling is a coupling, not education's identity), and from
    // economy (workforce as a macro aggregate is a coupling). Education binds
    // to real education authorities (NCES, IPEDS, ED.gov, UNESCO, OECD, World
    // Bank human capital) and real education operators (CHGG, COUR, DUOL, LRN,
    // ATGE, LOPE, STRA, LAUR, TWOU, UTI).
    //   - student-outcome-improvement: a bounded student-outcome program /
    //     edtech deployment / achievement-intervention = capital deployment
    //     into student outcomes → INVESTABLE path (like sba-loans).
    //   - curriculum-modernization: a curriculum / courseware / instructional-
    //     platform build-out = capital deployment into instructional content →
    //     INVESTABLE path (capital deployment).
    //   - teacher-development-funding: teacher-workforce development / training
    //     / retention capital = capital deployment into the teaching workforce
    //     → INVESTABLE path (capital deployment).
    //   - access-equity-program: a bounded access / equity / affordability
    //     program (under-served enrollment, financial-aid infrastructure) =
    //     capital deployment into access → INVESTABLE path.
    //   - institutional-consolidation: a higher-ed / school-system / edtech
    //     acquisition = capital deployment into institutional consolidation →
    //     INVESTABLE path (acquisition capital).
    //   - learning-outcomes-research: cross-domain learning-science / outcome-
    //     measurement signal bound to education INDICATORS (NCES NAEP, PISA,
    //     IPEDS); genuine white-space — no Observatory fan-in path defined yet
    //     (like franchise / systemic-risk / factory-output / ecosystem-
    //     restoration / institutional-integrity / information-ecosystem-
    //     integrity) → null. The packet is built from the HandoffPacket alone
    //     and emits NO_ENRICHMENT_PATH (info, not warn) rather than
    //     UNKNOWN_LANE_FOR_PATH_MAP.
    'student-outcome-improvement': 'INVESTABLE',
    'curriculum-modernization':    'INVESTABLE',
    'teacher-development-funding':  'INVESTABLE',
    'access-equity-program':        'INVESTABLE',
    'institutional-consolidation':  'INVESTABLE',
    'learning-outcomes-research':   null
  };

  // ─── Lane forbidden-fields policy ──────────────────────────────────────
  // The builder DECLARES policy on lane_hints.forbiddenForLane. It does NOT
  // strip — stripping happens at AI-expansion time (D3-B). Underlying data
  // remains in `raw` for the verifier (D3-D) to compare against.
  var FORBIDDEN_FOR_LANE = {
    'patents':           ['valueRange', 'companies', 'whyPays', 'compensation'],
    'business-grants':   ['valueRange', 'compensation.base'],
    'research-grants':   ['valueRange', 'compensation.base'],
    'nsf-project-pitch': ['valueRange', 'compensation.base'],
    'sba-loans':         [],
    'franchise':         [],
    'investments':       [],
    'copyrights':        [],
    'research-papers':   [],
    // Finance-native / supplyChain-trade fan-out lanes (see LANE_TO_PATH).
    // No fields forbidden — these are capital/risk lanes where valueRange,
    // compensation, and counterparty detail are load-bearing (unlike the
    // patent/grant lanes that strip dollar figures). Mirrors sba-loans /
    // investments policy.
    'credit-facilities': [],
    'capital-access':    [],
    'systemic-risk':     [],
    // Industry-native fan-out lanes (see LANE_TO_PATH). No fields forbidden —
    // these are productive-capital / capacity lanes where valueRange,
    // compensation, and counterparty detail are load-bearing (unlike the
    // patent/grant lanes that strip dollar figures). Mirrors sba-loans /
    // investments policy.
    'industrial-capacity': [],
    'automation-upgrade':  [],
    'factory-output':      [],
    // Medicine / health-native fan-out lanes (see LANE_TO_PATH). No fields
    // forbidden — these are clinical-trial / R&D-financing / provider-
    // consolidation capital lanes where valueRange, compensation, and
    // counterparty detail are load-bearing (unlike the patent/grant lanes that
    // strip dollar figures). Mirrors sba-loans / investments policy.
    'clinical-trial-capacity':           [],
    'drug-development-financing':         [],
    'healthcare-provider-consolidation': [],
    // Environment-native fan-out lanes (see LANE_TO_PATH). No fields forbidden —
    // these are climate/pollution/remediation/carbon capital lanes where
    // valueRange, compensation, and counterparty detail are load-bearing (unlike
    // the patent/grant lanes that strip dollar figures). Mirrors sba-loans /
    // investments policy.
    'climate-adaptation-infrastructure': [],
    'environmental-remediation':         [],
    'pollution-control-technology':      [],
    'ecosystem-restoration':             [],
    'carbon-market-access':              [],
    // Governance-native fan-out lanes (see LANE_TO_PATH). No fields forbidden —
    // these are compliance-infrastructure / coordination-platform / institutional
    // capital lanes where valueRange, compensation, and counterparty detail are
    // load-bearing (unlike the patent/grant lanes that strip dollar figures).
    // Mirrors sba-loans / investments policy.
    'regulatory-compliance-modernization': [],
    'policy-coordination-platform':        [],
    'institutional-integrity':             [],
    // Communication-native fan-out lanes (see LANE_TO_PATH). No fields forbidden —
    // these are carrier-infrastructure / spectrum-compliance / information-integrity
    // capital lanes where valueRange, compensation, and counterparty detail are
    // load-bearing (unlike the patent/grant lanes that strip dollar figures).
    // Mirrors sba-loans / investments policy.
    'media-infrastructure-resilience': [],
    'spectrum-allocation-compliance':  [],
    'information-ecosystem-integrity': [],
    // Education-native fan-out lanes (see LANE_TO_PATH). No fields forbidden —
    // these are student-outcome / curriculum / teacher-development / access-
    // equity / institutional-consolidation capital lanes where valueRange,
    // compensation, and counterparty detail are load-bearing (unlike the
    // patent/grant lanes that strip dollar figures). Mirrors sba-loans /
    // investments policy.
    'student-outcome-improvement': [],
    'curriculum-modernization':    [],
    'teacher-development-funding':  [],
    'access-equity-program':        [],
    'institutional-consolidation':  [],
    'learning-outcomes-research':   []
  };

  // ─── Citation hints — verified URLs / opaque agency tokens ONLY ────────
  // No AI-constructed URLs. If a feed name is not in this map, citationHints
  // omits it. Never invent.
  var CITATION_HINTS = {
    'EIA Petroleum':                'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm',
    'FRED Crude Oil':               'https://fred.stlouisfed.org/series/DCOILWTICO',
    'Massive Crude Oil':            'massive-financial.com',
    'OPEC Reference Basket':        'https://www.opec.org/opec_web/en/data_graphs/40.htm',
    'EIA Weekly Petroleum Status':  'https://www.eia.gov/petroleum/supply/weekly/',
    'EIA Natural Gas Weekly':       'https://www.eia.gov/naturalgas/weekly/',
    'EIA Electricity Monthly':      'https://www.eia.gov/electricity/monthly/',
    'IEA Energy News':              'https://www.iea.org/news',
    'NOAA NWS Alerts':              'https://www.weather.gov/alerts',
    'CISA KEV':                     'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    'USDA Drought Monitor':         'https://droughtmonitor.unl.edu/',
    'World Bank Food':              'https://data.worldbank.org/topic/agriculture-and-rural-development',
    // Culture primary-source authorities: the attention-economy signal layer
    // (streaming charts, discography/credits databases, critical taste-making,
    // venue/festival/box-office health, cultural-participation statistics).
    // Verified canonical landing pages / opaque platform tokens only — never
    // AI-constructed deep links.
    'Spotify Global Charts':         'https://charts.spotify.com/',
    'Billboard Hot 100':             'https://www.billboard.com/charts/hot-100/',
    'Pitchfork':                     'https://pitchfork.com/reviews/albums/',
    'AllMusic Reviews':              'https://www.allmusic.com/newreleases',
    'Discogs Database':              'https://www.discogs.com/',
    'IMDb':                          'https://www.imdb.com/',
    'YouTube Charts':                'https://charts.youtube.com/',
    'Variety':                       'https://variety.com/',
    'Rolling Stone':                 'https://www.rollingstone.com/music/',
    'Pollstar Box Office':           'https://www.pollstar.com/Chart',
    'Bandsintown':                   'https://www.bandsintown.com/',
    'NEA Arts Participation Survey':  'https://www.arts.gov/impact/research/arts-data-profile-series',
    'UNESCO Culture':                'https://www.unesco.org/en/culture',
    // Finance primary-source authorities: the credit & capital-markets signal
    // layer (policy rate / discount window, credit spreads & lending
    // conditions, speculative positioning, rate-path expectations, rating-
    // agency credit conditions, market-stress/volatility). Verified canonical
    // landing pages / opaque agency-terminal tokens only — never AI-constructed
    // deep links. Mirrors the energy / infrastructure / culture structure.
    'Federal Reserve Primary Credit Rate': 'https://www.federalreserve.gov/datadownload/',
    'FRED High Yield Spreads':             'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
    'Bloomberg Credit Conditions':         'bloomberg-terminal',
    'CFTC Commitment of Traders':          'https://www.cftc.gov/market-reports/cftcummitstmt',
    'CME FedWatch Rate Futures':           'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
    "Moody's Credit Conditions Index":     'https://www.moodys.com/',
    'S&P 500 Volatility Index':            'https://www.spglobal.com/marketintelligence/',
    'S&P Credit Conditions':               'https://www.spglobal.com/marketintelligence/',
    'Fitch Credit Ratings':                'https://www.fitchratings.com/',
    // Economy primary-source authorities: the MACRO AGGREGATE signal layer
    // (output/growth, inflation, employment & labor markets, consumer & business
    // sentiment, money supply, the business cycle). Distinct from finance — this
    // is the macroeconomy, NOT capital markets / credit / banks. Verified
    // canonical FRED series landing pages — REAL series ids, never fabricated.
    // Mirrors the energy / infrastructure / culture / finance structure.
    'FRED Real GDP Growth':           'https://fred.stlouisfed.org/series/GDPC1',
    'FRED Unemployment Rate':         'https://fred.stlouisfed.org/series/UNRATE',
    'FRED Nonfarm Payrolls':          'https://fred.stlouisfed.org/series/PAYEMS',
    'FRED CPI Inflation':             'https://fred.stlouisfed.org/series/CPIAUCSL',
    'FRED PCE Inflation':             'https://fred.stlouisfed.org/series/PCEPI',
    'FRED Consumer Sentiment':        'https://fred.stlouisfed.org/series/UMCSENT',
    'FRED Money Supply':              'https://fred.stlouisfed.org/series/M2SL',
    'FRED Industrial Production':     'https://fred.stlouisfed.org/series/INDPRO',
    // Technology primary-source authorities: the COMPUTE & INNOVATION signal
    // layer (semiconductors & compute, AI/ML, software & cloud, hardware &
    // devices, cybersecurity, R&D pipelines). Anchored on real chip/compute
    // investor-relations + standards/research authorities. DISTINCT from
    // finance (fintech is a coupling, not the identity) and from energy
    // (technology couples to energy via compute demand, but its OWN content =
    // chips/software/AI/cyber). Verified canonical landing pages only — never
    // AI-constructed deep links. Mirrors the energy / infrastructure / culture
    // / finance / economy structure.
    'NVIDIA Investor Relations':      'https://investor.nvidia.com/',
    'TSMC Investor':                  'https://investor.tsmc.com/english',
    'AMD Financial':                  'https://ir.amd.com/',
    'Synopsys EDA Trends':            'https://www.synopsys.com/company/newsroom.html',
    'IEEE Xplore':                    'https://ieeexplore.ieee.org/',
    'ArXiv CS':                       'https://arxiv.org/list/cs/recent',
    // Defense primary-source authorities: the DEFENSE-INDUSTRIAL & READINESS
    // signal layer (military spending & procurement, the defense industrial
    // base, weapons-systems programs, military readiness, deterrence posture).
    // Anchored on real defense-prime investor-relations pages + the DoD budget
    // authority. DISTINCT from intelligence (defense = kinetic / industrial /
    // readiness; intelligence = collection / analysis / espionage) and from
    // technology (cyber is a coupling, not defense's core identity). Defense
    // couples to energy via fuel / strategic-reserve but keeps its OWN content
    // = procurement / readiness / deterrence. Verified canonical landing pages
    // only — never AI-constructed deep links. Mirrors the energy /
    // infrastructure / culture / finance / economy / technology structure.
    'DoD Budget Justification':       'https://comptroller.defense.gov/Budget-Materials/',
    'Lockheed Martin Investor Relations': 'https://www.lockheedmartin.com/en-us/investor-relations.html',
    'Raytheon Technologies IR':       'https://investor.rtx.com/',
    'General Dynamics IR':            'https://investor.gd-ms.com/',
    'Northrop Grumman IR':            'https://investor.northropgrumman.com/',
    'Boeing Defense IR':              'https://investor.boeing.com/',
    'L3Harris IR':                    'https://investor.l3harris.com/',
    'Huntington Ingalls IR':          'https://investor.huntingtoningalls.com/',
    'Leidos IR':                      'https://investor.leidos.com/',
    'Booz Allen Hamilton IR':         'https://investors.boozallen.com/',
    'Kratos Defense IR':              'https://ir.kratosdefense.com/',
    'AeroVironment IR':               'https://investor.avav.com/',
    // Intelligence primary-source authorities: the COLLECTION & ANALYSIS signal
    // layer (SIGINT / HUMINT / GEOINT / OSINT collection, all-source fusion &
    // assessment, threat warning, espionage & counterintelligence, surveillance
    // & reconnaissance). Anchored on the official IC component landing pages
    // (ODNI / CIA / NSA / NGA / DIA / intelligence.gov) + the real
    // collection/analysis OPERATOR investor-relations pages (Palantir
    // data-fusion, Booz Allen — the largest single IC contractor, Leidos, CACI,
    // SAIC, KBR, Verint SIGINT/surveillance, NICE intelligence-operations,
    // Verisk OSINT risk-analytics). DISTINCT from defense (defense = kinetic /
    // industrial / readiness; intelligence = collection / analysis / espionage)
    // and from technology (cyber tooling is a coupling to technology, NOT
    // intelligence's identity — no chip / cloud sources). Intelligence couples
    // to energy via strategic warning but keeps its OWN content = collection /
    // assessment / counterintelligence. Verified canonical landing pages only —
    // never AI-constructed deep links. Note the intelligence-operator keys are
    // intentionally suffixed " (Intel)" so they never collide with the
    // identically-named defense-side keys (Booz Allen / Leidos appear in both
    // lanes). Mirrors the energy / infrastructure / culture / finance / economy
    // / technology / defense structure.
    'ODNI Threat Assessment':         'https://www.dni.gov/index.php/newsroom/reports-publications',
    'CIA World Factbook':             'https://www.cia.gov/the-world-factbook/',
    'NSA Signals Intelligence':       'https://www.nsa.gov/Signals-Intelligence/',
    'NGA Geospatial Analysis':        'https://www.nga.mil/',
    'DIA Military Intelligence':      'https://www.dia.mil/',
    'IC All-Source Analysis':         'https://www.intelligence.gov/',
    'Palantir Investor Relations':    'https://investors.palantir.com/',
    'Booz Allen Intelligence (Intel)':'https://investors.boozallen.com/',
    'Leidos Intelligence (Intel)':    'https://investor.leidos.com/',
    'CACI Investor Relations':        'https://investor.caci.com/',
    'SAIC Investor Relations':        'https://investors.saic.com/',
    'KBR Investor Relations':         'https://investors.kbr.com/',
    'Verint Investor Relations':      'https://investors.verint.com/',
    'NICE Investor Relations':        'https://ir.nice.com/',
    'Verisk Investor Relations':      'https://investor.verisk.com/',
    // Industry primary-source authorities: the MANUFACTURING & INDUSTRIAL
    // PRODUCTION signal layer (factory output & capacity utilization,
    // automation & robotics, heavy industry & capital goods, machinery &
    // equipment, industrial maintenance). Anchored on real industrial / capital-
    // goods investor-relations pages (CAT, DE, GE, HON, MMM, EMR, ITW, ETN, PH,
    // ROK, DOV, GEV) plus the structural production authorities (FRED Industrial
    // Production INDPRO, ISM Manufacturing PMI). DISTINCT from economy (FRED
    // INDPRO is shared as a macro series, but industry's content is factory /
    // production output, NOT macro demand aggregates), from trade
    // (logistics/commerce), and from technology (automation is a COUPLING, not
    // industry's identity — no chip/cloud sources). Industry couples to energy
    // via input costs but keeps its OWN content = production / capacity /
    // machinery. Verified canonical landing pages only — never AI-constructed
    // deep links. Mirrors the energy / infrastructure / culture / finance /
    // economy / technology / defense / intelligence structure.
    'Caterpillar Investor Relations': 'https://investors.caterpillar.com/',
    'Deere Investor Relations':       'https://www.deere.com/en/our-company/investor-relations/',
    'GE Investor Relations':          'https://www.gevernova.com/investor-relations',
    'Honeywell Investor Relations':   'https://investor.honeywell.com/',
    '3M Investor Relations':          'https://investors.3m.com/',
    'Emerson Investor Relations':     'https://www.emerson.com/en-us/investors',
    'ITW Investor Relations':         'https://investor.itw.com/',
    'Eaton Investor Relations':       'https://www.eaton.com/us/en-us/company/investor-relations.html',
    'Parker Hannifin Investor Relations': 'https://investors.parker.com/',
    'Rockwell Automation Investor Relations': 'https://ir.rockwellautomation.com/',
    'Dover Investor Relations':       'https://investors.dovercorporation.com/',
    'GE Vernova Investor Relations':  'https://www.gevernova.com/investor-relations',
    'FRED Industrial Production Index': 'https://fred.stlouisfed.org/series/INDPRO',
    'ISM Manufacturing PMI':          'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/',
    // Environment primary-source authorities: the CLIMATE & ENVIRONMENTAL-HEALTH
    // signal layer (climate forcing & emissions, air/water quality, ecosystem &
    // biodiversity health, international climate policy, plus the real
    // environmental-services / waste-remediation / water / treatment OPERATOR
    // investor-relations pages). Anchored on the federal environmental
    // authorities (EPA air/water, NOAA climate, USGS ecosystems), the
    // international assessment authority (IPCC), and real environmental-sector
    // operators (WM, RSG, WCN, CWST waste & remediation; AWK, WTRG, XYL water
    // utilities & technology; ECL water/treatment chemistry; LIN, APD
    // environmental gases; DAR waste-to-value; AY sustainability). DISTINCT from
    // energy (no oil/gas/grid — environment couples to energy via emissions/
    // carbon, but its OWN content = climate/pollution/ecosystems) and from
    // agriculture (land/water USE is a coupling, not the identity). Verified
    // canonical landing pages / opaque agency tokens only — never AI-constructed
    // deep links. Mirrors the energy / infrastructure / culture / finance /
    // economy / technology / defense / intelligence / industry structure.
    'EPA Air Quality':                       'https://www.epa.gov/air-quality',
    'EPA Water Quality':                     'https://www.epa.gov/waterdata',
    'NOAA Climate Data':                     'https://www.ncei.noaa.gov/products/climate-data/',
    'USGS Ecosystem Health':                 'https://www.usgs.gov/ecosystems',
    'IPCC Climate Assessment':               'https://www.ipcc.ch/',
    'International Carbon Market':            'https://icecap.greenclimate.fund/',
    'Waste Management Investor Relations':   'https://investors.wm.com/',
    'Republic Services Investor Relations':  'https://investor.rsg.com/',
    'Waste Connections Investor Relations':  'https://investor.wasteconnections.com/',
    'Casella Waste Systems Investor Relations': 'https://investor.casella.com/',
    'American Water Works Investor Relations':  'https://investor.amwater.com/',
    'Water Technologies Group':              'investor-relations',
    'Xylem Investor Relations':              'https://investors.xylem.com/',
    'Ecolab Investor Relations':             'https://investor.ecolab.com/',
    'Linde Environmental':                   'https://investor.linde.com/',
    'Air Products Environmental':            'https://investor.airproducts.com/',
    'Darling Ingredients Investor Relations': 'https://investor.darlingii.com/',
    'Asure Energy':                          'https://investors.asuregroup.com/',
    // Agriculture primary-source authorities: the CROP / COMMODITY / FARM-INPUT
    // signal layer (crop yields & production statistics, grain-futures price
    // discovery, world supply & demand balance, and the real ag-sector OPERATOR
    // investor-relations pages — commodity processing, ag biotech/seed,
    // fertilizer & crop nutrients, farm equipment, protein/food production).
    // Anchored on the USDA data authorities (NASS QuickStats crop statistics,
    // WASDE world supply/demand estimates), the CBOT grain-futures exchange
    // (corn/soy/wheat price discovery), and real agriculture tickers (ADM, BG,
    // CTVA, DE, NTR, MOS, CF, TSN, CAG, INGR, AGCO, FMC). DISTINCT from energy
    // (no oil/gas/grid — biofuel/fertilizer-energy is a coupling, not the
    // identity), from environment (land/water/climate is a coupling), from trade
    // (export logistics is a coupling), and from economy (food prices are a
    // coupling). Verified canonical landing pages only — never AI-constructed
    // deep links. Mirrors the energy / infrastructure / culture / finance /
    // economy / technology / defense / intelligence / industry / environment
    // structure.
    'USDA NASS':                             'https://quickstats.nass.usda.gov/',
    'CBOT Grain Futures':                    'https://www.cbot.com/market-data/quotes/grains',
    'USDA WASDE':                            'https://www.usda.gov/oce/commodity/wasde',
    'ADM Investor':                          'https://investor.adm.com/',
    'Bunge Investor':                        'https://investors.bunge.com/',
    'Corteva Investor':                      'https://investor.corteva.us/',
    'Deere Agriculture Investor':            'https://www.deere.com/en/our-company/investor-relations/',
    'Nutrien Investor':                      'https://www.nutrien.com/investors',
    'Mosaic Investor':                       'https://investor.mosaicco.com/',
    'CF Industries Investor':                'https://investor.cf.com/',
    'Tyson Foods Investor':                  'https://investor.tyson.com/',
    'Conagra Brands Investor':               'https://www.conagrabrands.com/investors',
    'Ingredion Investor':                    'https://www.ingredion.com/en/investors',
    'AGCO Investor':                         'https://investor.agcocorp.com/',
    'FMC Investor':                          'https://investor.fmc.com/',
    // Communication primary-source authorities: the CONNECTIVITY & INFORMATION-FLOW
    // signal layer (telecom carriers & networks, broadband / connectivity,
    // internet infrastructure — towers / fiber / spectrum, broadcasting & media
    // CHANNELS, journalism & news flow, press freedom, social-media distribution
    // platforms). Anchored on the federal communications regulator (FCC), the
    // press-freedom / journalist-safety authorities (RSF Reporters Without
    // Borders, CPJ Committee to Protect Journalists), the broadcast-industry
    // bodies (NAB, Broadcasters Foundation), and the real telecom / tower /
    // network / media OPERATOR investor-relations pages (VZ, T, TMUS carriers;
    // CMCSA, CHTR cable/broadband; CSCO, ANET networking; AMT, CCI, SBAC towers;
    // NWSA, NYT news; META, GOOGL social/distribution platforms). DISTINCT from
    // culture (no charts / discography / box-office — culture = content/scenes;
    // communication = the CHANNELS that carry it), from technology (no chip /
    // foundry sources — networking silicon is a coupling, not the carrier
    // identity), and from intelligence (no SIGINT / collection sources — signals
    // COLLECTION is a coupling; communication is open-network distribution).
    // Verified canonical landing pages / opaque agency tokens only — never
    // AI-constructed deep links. Mirrors the energy / infrastructure / culture /
    // finance / economy / technology / defense / intelligence / industry /
    // environment / agriculture structure.
    'Federal Communications Commission':     'https://www.fcc.gov/',
    'Press Freedom Index RSF':               'https://rsf.org/en/index',
    'CPJ Press Freedom Violations':          'https://cpj.org/',
    'National Association of Broadcasters':  'https://www.nab.org/',
    'Broadcasters Foundation':               'https://www.broadcastersfoundation.org/',
    'Cloudflare Radar':                      'https://radar.cloudflare.com/',
    'Netblocks Internet Observatory':        'https://netblocks.org/',
    'Verizon Investor Relations':            'https://www.verizon.com/about/investors',
    'AT&T Investor Relations':               'https://investors.att.com/',
    'T-Mobile Investor Relations':           'https://investor.t-mobile.com/',
    'Comcast Investor Relations':            'https://www.cmcsa.com/',
    'Charter Communications Investor Relations': 'https://ir.charter.com/',
    'Cisco Investor Relations':              'https://investor.cisco.com/',
    'Arista Networks Investor Relations':    'https://investors.arista.com/',
    'American Tower Investor Relations':     'https://www.americantower.com/investor-relations',
    'Crown Castle Investor Relations':       'https://investor.crowncastle.com/',
    'SBA Communications Investor Relations': 'https://www.sbasite.com/English/investor-relations/',
    'News Corp Investor Relations':          'https://investors.newscorp.com/',
    'New York Times Investor Relations':     'https://investors.nytco.com/',
    'Meta Investor Relations':               'https://investor.atmeta.com/',
    'Alphabet Investor Relations':           'https://abc.xyz/investor/',
    // Medicine / health primary-source authorities: the HEALTHCARE-DELIVERY &
    // DRUG-DEVELOPMENT signal layer (drug & device regulation, clinical
    // research, disease surveillance & epidemiology, clinical practice
    // guidance, plus the real healthcare / pharma / biotech / medical-device /
    // diagnostics / health-insurance OPERATOR investor-relations pages).
    // Anchored on the federal health authorities (FDA drug/device review, NIH /
    // NHLBI cardiovascular clinical research, CDC epidemiology & disease
    // surveillance, ClinicalTrials.gov trial registry), the family-medicine
    // clinical body (AAFP), and real healthcare tickers (UNH managed care, JNJ
    // pharma/devices, PFE / MRK / ABBV / LLY pharma, TMO life-science tools,
    // ABT / MDT medical devices, ISRG surgical robotics, HCA hospital systems,
    // CVS health services & insurance, AMGN / GILD biotech). DISTINCT from
    // science (basic / pre-clinical research is a coupling, not the
    // care-delivery identity), from population (demographics / disease burden is
    // a coupling), and from environment (environmental-health exposure is a
    // coupling). The runtime/snapshot key is `health`; the URL/portal key is
    // `medicine` (see domain-identity.js). Verified canonical landing pages /
    // opaque agency tokens only — never AI-constructed deep links. Mirrors the
    // energy / infrastructure / culture / finance / economy / technology /
    // defense / intelligence / industry / environment / agriculture /
    // communication structure.
    'FDA Drug Evaluation':                   'https://www.fda.gov/drugs',
    'FDA Medical Device Clearance':          'https://www.fda.gov/medical-devices',
    'NIH NHLBI Clinical Research':           'https://www.nhlbi.nih.gov/science',
    'CDC Disease Surveillance':              'https://www.cdc.gov/surveillance/',
    'ClinicalTrials.gov Registry':           'https://clinicaltrials.gov/',
    'AAFP Clinical Guidance':                'https://www.aafp.org/family-physician/patient-care/clinical-recommendations.html',
    'UnitedHealth Group Investor Relations': 'https://www.unitedhealthgroup.com/investors.html',
    'Johnson & Johnson Investor Relations':  'https://www.investor.jnj.com/',
    'Pfizer Investor Relations':             'https://investors.pfizer.com/',
    'Merck Investor Relations':              'https://www.merck.com/investor-relations/',
    'AbbVie Investor Relations':             'https://investors.abbvie.com/',
    'Eli Lilly Investor Relations':          'https://investor.lilly.com/',
    'Thermo Fisher Investor Relations':      'https://ir.thermofisher.com/',
    'Abbott Investor Relations':             'https://www.abbottinvestor.com/',
    'Medtronic Investor Relations':          'https://investorrelations.medtronic.com/',
    'Intuitive Surgical Investor Relations': 'https://isrg.intuitive.com/',
    'HCA Healthcare Investor Relations':     'https://investor.hcahealthcare.com/',
    'CVS Health Investor Relations':         'https://investors.cvshealth.com/',
    'Amgen Investor Relations':              'https://investors.amgen.com/',
    'Gilead Sciences Investor Relations':    'https://investors.gilead.com/',
    // Education primary-source authorities: the K-12 / HIGHER-ED / WORKFORCE-
    // TRAINING / STUDENT-OUTCOME / CREDENTIALING signal layer (K-12 enrollment
    // & achievement statistics, higher-ed institutional data, student-debt
    // data, workforce-readiness trends, teacher-workforce data, accreditation
    // status). Anchored on the federal education authorities (U.S. Dept of
    // Education, NCES National Center for Education Statistics, IPEDS
    // Integrated Postsecondary Education Data System, NAEP the Nation's Report
    // Card), the international education indices (UNESCO Institute for
    // Statistics, World Bank Human Capital, OECD education / PISA), and the
    // real edtech / higher-ed OPERATOR investor-relations pages (CHGG Chegg,
    // COUR Coursera, DUOL Duolingo, LRN Stride/K12, ATGE Adtalem, LOPE Grand
    // Canyon Education, STRA Strategic Education, LAUR Laureate, TWOU 2U, UTI
    // Universal Technical Institute). DISTINCT from science (basic / academic
    // RESEARCH is the science domain, not education delivery), from population
    // (demographics / enrollment-by-cohort is a coupling), from technology
    // (edtech TOOLING / platforms are a coupling, not education's identity),
    // and from economy (workforce as a macro aggregate is a coupling).
    // Verified canonical landing pages only — never AI-constructed deep links.
    // Mirrors the energy / infrastructure / culture / finance / economy /
    // technology / defense / intelligence / industry / environment /
    // agriculture / communication / medicine structure.
    'NCES Student Data':                     'https://nces.ed.gov/',
    'IPEDS Higher-Ed':                       'https://nces.ed.gov/ipeds/',
    'NAEP Nation Report Card':               'https://www.nationsreportcard.gov/',
    'ED.gov K-12':                           'https://www2.ed.gov/about/overview/fed/10facts/index.html',
    'USDOE Department':                      'https://www.ed.gov/',
    'Federal Student Aid Debt Data':         'https://studentaid.gov/data-center/student/portfolio',
    'UNESCO Institute for Statistics':       'https://uis.unesco.org/',
    'World Bank Human Capital':              'https://www.worldbank.org/en/publication/human-capital',
    'OECD Education Statistics':             'https://www.oecd.org/en/topics/education.html',
    'Chegg Investor Relations':              'https://investor.chegg.com/',
    'Coursera Investor Relations':           'https://investor.coursera.com/',
    'Duolingo Investor Relations':           'https://investors.duolingo.com/',
    'Stride Investor Relations':             'https://investors.stridelearning.com/',
    'Adtalem Investor Relations':            'https://investors.adtalem.com/',
    'Grand Canyon Education Investor Relations': 'https://investors.gce.com/',
    'Strategic Education Investor Relations': 'https://investor.strategiceducation.com/',
    'Laureate Education Investor Relations':  'https://investors.laureate.net/',
    '2U Investor Relations':                 'https://investor.2u.com/',
    'Universal Technical Institute Investor Relations': 'https://investors.uti.edu/'
  };

  // ─── Domain-specific primary source priority ───────────────────────────
  // Each domain maps to an ordered list of authoritative source `name` values
  // (matched against snapshot.domains[domain].sources[].name in _selectPrimary).
  // Highest-priority structural source first. A missing domain entry causes
  // _selectPrimary to fall back to the first live structural source and emit a
  // PRIMARY_BY_FALLBACK warning — which demotes every artifact for that domain.
  var PRIMARY_PRIORITY_MAP = {
    energy: ['EIA Petroleum', 'FRED Crude Oil', 'Massive Crude Oil', 'OPEC Reference Basket'],
    // Infrastructure primary sources: condition/assessment authorities for the
    // civil built environment (roads, bridges, water/sewer mains, grid
    // transmission/distribution reliability, transit/transport, dams/levees,
    // cyber-physical SCADA/ICS, construction & public works, deferred
    // maintenance, capital funding). CISA KEV carries the cyber-physical
    // (ICS/SCADA) critical-infrastructure signal and is already known to
    // CITATION_HINTS + FEED_TOKENS.
    infrastructure: ['ASCE Infrastructure Report Card', 'USACE Levee Safety', 'FHWA Bridge Inventory', 'USDOT Systems Condition', 'CISA KEV', 'EPA Water Infrastructure', 'ITC Rail Condition'],
    // Culture primary sources: attention-economy / creative-output authorities
    // that anchor the cultural signal layer — streaming + sales charts (what is
    // trending), critical taste-making (emergence quality), discography/credits
    // (artist structure), and arts-participation statistics (audience health).
    // Ranked highest-signal structural first: real-time chart movement leads,
    // critical review and participation survey ground it. Mirrors the energy /
    // infrastructure ordering so culture artifacts no longer demote through the
    // PRIMARY_BY_FALLBACK path.
    culture: ['Spotify Global Charts', 'Billboard Hot 100', 'Pitchfork', 'AllMusic Reviews', 'NEA Arts Participation Survey'],
    // Finance primary sources: credit & capital-markets authorities that anchor
    // the financial signal layer — policy rate / discount window (cost of
    // capital), high-yield credit spreads (capital availability / distress
    // pricing), bank-side credit conditions, speculative positioning, and
    // rate-path expectations. Ranked highest-signal structural first: the
    // Federal Reserve policy rate and FRED high-yield spreads lead (the
    // solvency / capital-availability spine), market-stress (VIX) and
    // rating-agency conditions ground it. Mirrors the energy / infrastructure /
    // culture ordering so finance artifacts no longer demote through the
    // PRIMARY_BY_FALLBACK path.
    finance: ['Federal Reserve Primary Credit Rate', 'FRED High Yield Spreads', 'Bloomberg Credit Conditions', 'CFTC Commitment of Traders', 'CME FedWatch Rate Futures', "Moody's Credit Conditions Index", 'S&P 500 Volatility Index'],
    // Economy primary sources: macroeconomic-aggregate authorities that anchor
    // the economy signal layer — output/growth (Real GDP), inflation (CPI/PCE),
    // employment & labor markets (unemployment, payrolls), consumer sentiment,
    // money supply, and industrial production. Ranked highest-signal structural
    // first: Real GDP growth and the unemployment rate lead (the business-cycle
    // spine), inflation and sentiment ground it. Distinct from finance (capital
    // markets / credit). Mirrors the energy / infrastructure / culture / finance
    // ordering so economy artifacts no longer demote through the
    // PRIMARY_BY_FALLBACK path.
    economy: ['FRED Real GDP Growth', 'FRED Unemployment Rate', 'FRED Nonfarm Payrolls', 'FRED CPI Inflation', 'FRED PCE Inflation', 'FRED Consumer Sentiment', 'FRED Industrial Production', 'FRED Money Supply'],
    // Technology primary sources: compute & innovation authorities that anchor
    // the technology signal layer — semiconductor / compute investor reporting
    // (NVIDIA, TSMC, AMD foundry & GPU economics = the silicon spine), EDA /
    // design-tool trends (Synopsys), peer-reviewed engineering research (IEEE
    // Xplore), the AI/ML preprint frontier (ArXiv CS), and the actively-
    // exploited vulnerability catalog (CISA KEV = the cybersecurity signal,
    // already in CITATION_HINTS + FEED_TOKENS). Ranked highest-signal
    // structural first: chip/compute fundamentals lead (the demand & capacity
    // spine for AI/cloud), research & cyber ground it. DISTINCT from finance
    // (no credit/bank sources) and from energy (no oil/gas/grid sources).
    // Mirrors the energy / infrastructure / culture / finance / economy
    // ordering so technology artifacts no longer demote through the
    // PRIMARY_BY_FALLBACK path.
    technology: ['NVIDIA Investor Relations', 'TSMC Investor', 'AMD Financial', 'Synopsys EDA Trends', 'IEEE Xplore', 'ArXiv CS', 'CISA KEV'],
    // Defense primary sources: defense-industrial & readiness authorities that
    // anchor the defense signal layer — defense-prime investor reporting (LMT,
    // RTX, GD, NOC, BA = the procurement & production spine), the DoD budget
    // justification (military spending authority), and the second-tier primes /
    // integrators (LHX electronic warfare, HII shipbuilding, LDOS, BAH, KTOS,
    // AVAV). Ranked highest-signal structural first: the prime contractors'
    // procurement / production / program fundamentals lead (the readiness &
    // deterrence spine), the budget authority grounds it. DISTINCT from
    // intelligence (no collection / espionage sources) and from technology
    // (no chip / cloud sources — cyber is a coupling). Mirrors the energy /
    // infrastructure / culture / finance / economy / technology ordering so
    // defense artifacts no longer demote through the PRIMARY_BY_FALLBACK path.
    defense: ['Lockheed Martin Investor Relations', 'Raytheon Technologies IR', 'General Dynamics IR', 'Northrop Grumman IR', 'Boeing Defense IR', 'DoD Budget Justification', 'L3Harris IR', 'Huntington Ingalls IR', 'Leidos IR', 'Booz Allen Hamilton IR', 'Kratos Defense IR', 'AeroVironment IR'],
    // Intelligence primary sources: collection & analysis authorities that
    // anchor the intelligence signal layer — the all-source assessment &
    // threat-warning authorities (ODNI threat assessment, CIA / NGA / DIA
    // analysis, IC all-source fusion = the assessment spine), the collection
    // authorities (NSA signals intelligence), and the real collection/analysis
    // OPERATORS (Palantir data-integration fusion, Booz Allen — largest single
    // IC contractor, Leidos, CACI, SAIC, Verint SIGINT/surveillance). Ranked
    // highest-signal structural first: the ODNI / IC assessment & fusion
    // authorities lead (the warning & all-source spine), collection authorities
    // and the operator fundamentals ground it. DISTINCT from defense (no
    // procurement / weapons-system sources — collection/analysis, not kinetic)
    // and from technology (no chip / cloud sources — cyber is a coupling).
    // Mirrors the energy / infrastructure / culture / finance / economy /
    // technology / defense ordering so intelligence artifacts no longer demote
    // through the PRIMARY_BY_FALLBACK path.
    intelligence: ['ODNI Threat Assessment', 'IC All-Source Analysis', 'CIA World Factbook', 'NSA Signals Intelligence', 'NGA Geospatial Analysis', 'DIA Military Intelligence', 'Palantir Investor Relations', 'Booz Allen Intelligence (Intel)', 'Leidos Intelligence (Intel)', 'CACI Investor Relations', 'SAIC Investor Relations', 'Verint Investor Relations'],
    // Industry primary sources: manufacturing & industrial-production
    // authorities that anchor the industry signal layer — capital-goods /
    // industrial investor reporting (CAT earthmoving & mining, DE farm &
    // construction equipment, GE/GEV power & industrial, HON automation, MMM
    // diversified manufacturing, EMR process automation, ITW, ETN electrical,
    // PH motion & control, ROK factory automation, DOV = the production &
    // capital-goods spine), plus the structural production authorities (FRED
    // Industrial Production index = factory/mining/utility output, ISM
    // Manufacturing PMI = factory expansion/contraction). Ranked highest-signal
    // structural first: the broad industrial bellwethers (CAT, DE, HON) and
    // automation leaders (EMR, ROK) lead (the capacity & production spine), the
    // INDPRO output index and ISM PMI ground it. DISTINCT from economy (this is
    // factory/production output, not macro demand aggregates), from trade
    // (logistics/commerce), and from technology (automation is a coupling — no
    // chip/cloud sources). Mirrors the energy / infrastructure / culture /
    // finance / economy / technology / defense / intelligence ordering so
    // industry artifacts no longer demote through the PRIMARY_BY_FALLBACK path.
    industry: ['Caterpillar Investor Relations', 'Deere Investor Relations', 'Honeywell Investor Relations', 'Emerson Investor Relations', 'Rockwell Automation Investor Relations', 'GE Investor Relations', '3M Investor Relations', 'ITW Investor Relations', 'Eaton Investor Relations', 'Parker Hannifin Investor Relations', 'Dover Investor Relations', 'GE Vernova Investor Relations', 'FRED Industrial Production Index', 'ISM Manufacturing PMI'],
    // Environment primary sources: climate & environmental-health authorities
    // that anchor the environment signal layer — climate forcing & emissions
    // (NOAA temperature anomaly / CO2 = the climate spine), air & water quality
    // (EPA AQI / contamination), ecosystem & biodiversity health (USGS), and
    // international climate policy (IPCC). Ranked highest-signal structural
    // first: NOAA climate forcing leads (the warming / emissions spine), EPA
    // air/water quality and USGS ecosystem health ground it, IPCC provides the
    // policy anchor. DISTINCT from energy (no oil/gas/grid sources — environment
    // couples to energy via emissions/carbon) and from agriculture (no land/
    // water-use sources — a coupling, not the identity). Mirrors the energy /
    // infrastructure / culture / finance / economy / technology / defense /
    // intelligence / industry ordering so environment artifacts no longer demote
    // through the PRIMARY_BY_FALLBACK path.
    environment: ['NOAA Climate Data', 'EPA Air Quality', 'EPA Water Quality', 'USGS Ecosystem Health', 'IPCC Climate Assessment'],
    // Agriculture primary sources: crop / commodity / farm-input authorities that
    // anchor the agriculture signal layer — USDA crop-yield & production
    // statistics (NASS QuickStats = the structural production spine), grain-
    // futures price discovery (CBOT corn/soy/wheat), world supply & demand
    // balance (USDA WASDE), and the real ag-sector OPERATORS (ADM commodity
    // processing, BG grain trade, CTVA ag biotech/seed, DE farm equipment, NTR /
    // MOS / CF fertilizer & crop nutrients, TSN protein production, CAG / INGR
    // food & ingredients, AGCO farm machinery, FMC crop inputs). Ranked highest-
    // signal structural first: USDA NASS crop statistics and CBOT futures lead
    // (the production & price spine), WASDE supply/demand and a commodity price
    // index ground it, the ag-sector operators provide the company-level signal.
    // DISTINCT from energy (no oil/gas/grid — biofuel/fertilizer-energy is a
    // coupling), from environment (land/water/climate is a coupling), from trade
    // (export logistics is a coupling), and from economy (food prices are a
    // coupling). Mirrors the energy / infrastructure / culture / finance /
    // economy / technology / defense / intelligence / industry / environment
    // ordering so agriculture artifacts no longer demote through the
    // PRIMARY_BY_FALLBACK path.
    agriculture: ['USDA NASS', 'CBOT Grain Futures', 'USDA WASDE', 'ADM Investor', 'Bunge Investor', 'Corteva Investor', 'Nutrien Investor', 'Mosaic Investor', 'CF Industries Investor', 'Deere Agriculture Investor', 'Tyson Foods Investor', 'AGCO Investor', 'FMC Investor'],
    // Communication primary sources: connectivity & information-flow authorities
    // that anchor the communication signal layer — the federal communications
    // regulator (FCC = spectrum / licensing / rulemaking authority), the
    // press-freedom & journalist-safety authorities (RSF Press Freedom Index,
    // CPJ violations = the news-flow / information-integrity spine), the
    // broadcast-industry bodies (NAB, Broadcasters Foundation), and the real
    // telecom / tower / network / media OPERATORS (VZ, T, TMUS carriers; CMCSA,
    // CHTR cable/broadband; CSCO, ANET networking; AMT, CCI, SBAC towers; NWSA,
    // NYT news; META, GOOGL distribution platforms). Ranked highest-signal
    // structural first: the FCC regulatory authority and the carrier / tower
    // operators lead (the connectivity & spectrum spine), press-freedom indices
    // and the distribution platforms ground the information-flow signal.
    // DISTINCT from culture (no charts / discography — culture = content/scenes;
    // communication = the CHANNELS), from technology (no chip / foundry sources
    // — networking silicon is a coupling), and from intelligence (no SIGINT /
    // collection sources — collection is a coupling; communication is
    // open-network distribution). Mirrors the energy / infrastructure / culture /
    // finance / economy / technology / defense / intelligence / industry /
    // environment / agriculture ordering so communication artifacts no longer
    // demote through the PRIMARY_BY_FALLBACK path.
    communication: ['Federal Communications Commission', 'Verizon Investor Relations', 'AT&T Investor Relations', 'T-Mobile Investor Relations', 'Comcast Investor Relations', 'Charter Communications Investor Relations', 'American Tower Investor Relations', 'Crown Castle Investor Relations', 'Cisco Investor Relations', 'Arista Networks Investor Relations', 'Press Freedom Index RSF', 'CPJ Press Freedom Violations', 'News Corp Investor Relations', 'New York Times Investor Relations', 'Meta Investor Relations', 'Alphabet Investor Relations'],
    // Medicine / health primary sources: healthcare-delivery & drug-development
    // authorities that anchor the medicine signal layer — the federal drug &
    // device regulator (FDA drug evaluation / device clearance = the
    // approval-pipeline spine), clinical research & disease surveillance (NIH
    // NHLBI cardiovascular trials, CDC epidemiology, ClinicalTrials.gov
    // registry), clinical practice guidance (AAFP), and the real healthcare /
    // pharma / biotech / device / insurance OPERATORS (UNH managed care, JNJ
    // pharma/devices, PFE / MRK / ABBV / LLY pharma, TMO life-science tools, ABT
    // / MDT devices, ISRG surgical robotics, HCA hospital systems, CVS health
    // services, AMGN / GILD biotech). Ranked highest-signal structural first:
    // the FDA approval pipeline and the large managed-care / pharma operators
    // lead (the care-delivery & drug-development spine), CDC surveillance and the
    // clinical bodies ground it. DISTINCT from science (basic research is a
    // coupling), from population (demographics / disease burden is a coupling),
    // and from environment (environmental-health exposure is a coupling). Keyed
    // under BOTH the runtime/snapshot key `health` (what hp.sourceDomains emits —
    // the brain sets domainId:'health') AND the URL/portal alias `medicine`
    // (see domain-identity.js), so the lookup matches regardless of which key a
    // caller carries. Mirrors the energy / infrastructure / culture / finance /
    // economy / technology / defense / intelligence / industry / environment /
    // agriculture / communication ordering so medicine artifacts no longer demote
    // through the PRIMARY_BY_FALLBACK path.
    health: ['FDA Drug Evaluation', 'FDA Medical Device Clearance', 'UnitedHealth Group Investor Relations', 'Johnson & Johnson Investor Relations', 'Pfizer Investor Relations', 'Merck Investor Relations', 'AbbVie Investor Relations', 'Eli Lilly Investor Relations', 'NIH NHLBI Clinical Research', 'CDC Disease Surveillance', 'ClinicalTrials.gov Registry', 'Thermo Fisher Investor Relations', 'Abbott Investor Relations', 'Medtronic Investor Relations', 'HCA Healthcare Investor Relations', 'CVS Health Investor Relations', 'AAFP Clinical Guidance'],
    medicine: ['FDA Drug Evaluation', 'FDA Medical Device Clearance', 'UnitedHealth Group Investor Relations', 'Johnson & Johnson Investor Relations', 'Pfizer Investor Relations', 'Merck Investor Relations', 'AbbVie Investor Relations', 'Eli Lilly Investor Relations', 'NIH NHLBI Clinical Research', 'CDC Disease Surveillance', 'ClinicalTrials.gov Registry', 'Thermo Fisher Investor Relations', 'Abbott Investor Relations', 'Medtronic Investor Relations', 'HCA Healthcare Investor Relations', 'CVS Health Investor Relations', 'AAFP Clinical Guidance'],
    // Education primary sources: K-12 / higher-ed / workforce-training
    // authorities that anchor the education signal layer — the federal
    // education-statistics authorities (NCES K-12 statistics, IPEDS higher-ed
    // institutional data, NAEP achievement = the outcome & enrollment spine),
    // the U.S. Dept of Education (policy / funding authority), student-debt
    // data (Federal Student Aid portfolio), the international education indices
    // (UNESCO UIS, World Bank Human Capital, OECD / PISA), and the real edtech /
    // higher-ed OPERATORS (CHGG, COUR, DUOL learning platforms; LRN, ATGE,
    // LOPE, STRA, LAUR, TWOU, UTI institutions). Ranked highest-signal
    // structural first: NCES / IPEDS statistics and NAEP achievement lead (the
    // student-outcome & enrollment spine), the department / debt authorities
    // and operators ground it. DISTINCT from science (basic research is the
    // science domain), from population (demographics is a coupling), from
    // technology (edtech tooling is a coupling), and from economy (workforce is
    // a coupling). Mirrors the energy / infrastructure / culture / finance /
    // economy / technology / defense / intelligence / industry / environment /
    // agriculture / communication / medicine ordering so education artifacts no
    // longer demote through the PRIMARY_BY_FALLBACK path.
    education: ['NCES Student Data', 'IPEDS Higher-Ed', 'NAEP Nation Report Card', 'USDOE Department', 'ED.gov K-12', 'Federal Student Aid Debt Data', 'UNESCO Institute for Statistics', 'World Bank Human Capital', 'OECD Education Statistics', 'Chegg Investor Relations', 'Coursera Investor Relations', 'Duolingo Investor Relations', 'Stride Investor Relations', 'Adtalem Investor Relations', 'Grand Canyon Education Investor Relations', 'Strategic Education Investor Relations', '2U Investor Relations', 'Universal Technical Institute Investor Relations']
  };

  // ─── Feed token map for evidence-source verification ───────────────────
  var FEED_TOKENS = {
    'EIA Petroleum':                ['EIA Petroleum', 'EIA', 'Brent'],
    'FRED Crude Oil':               ['FRED Crude Oil', 'FRED', 'WTI', 'DCOILWTICO'],
    'Massive Crude Oil':            ['Massive Crude Oil', 'Massive', 'crude'],
    'OPEC Reference Basket':        ['OPEC Reference Basket', 'OPEC', 'reference basket'],
    'EIA Weekly Petroleum Status':  ['EIA Weekly Petroleum', 'EIA petroleum supply'],
    'EIA Natural Gas Weekly':       ['EIA Natural Gas', 'natural gas'],
    'EIA Electricity Monthly':      ['EIA Electricity', 'electricity monthly'],
    'IEA Energy News':              ['IEA', 'IEA Energy'],
    'NOAA NWS Alerts':              ['NOAA', 'NWS', 'weather alerts'],
    'CISA KEV':                     ['CISA', 'KEV', 'CVEs'],
    'USDA Drought Monitor':         ['USDA Drought', 'drought monitor'],
    'World Bank Food':              ['World Bank Food', 'WB Food'],
    // Culture feed tokens: literal substrings the brain's evidence prose must
    // contain for _isEvidenceSourceVerified to anchor culture artifacts. Each
    // entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP culture feed so the
    // attention-economy signal layer verifies instead of always failing.
    'Spotify Global Charts':        ['Spotify Global Charts', 'Spotify', 'chart', 'streaming'],
    'Billboard Hot 100':            ['Billboard Hot 100', 'Billboard', 'Hot 100', 'chart position'],
    'Pitchfork':                    ['Pitchfork', 'critical score', 'review'],
    'AllMusic Reviews':             ['AllMusic', 'AllMusic Reviews', 'discography', 'credits'],
    'Discogs Database':             ['Discogs', 'release', 'pressing'],
    'IMDb':                         ['IMDb', 'box office', 'cast'],
    'YouTube Charts':               ['YouTube Charts', 'YouTube', 'views', 'trending'],
    'Variety':                      ['Variety', 'box office', 'industry'],
    'Rolling Stone':                ['Rolling Stone', 'review', 'feature'],
    'Pollstar Box Office':          ['Pollstar', 'box office', 'tour gross', 'tickets sold'],
    'Bandsintown':                  ['Bandsintown', 'tour', 'venue', 'tickets'],
    'NEA Arts Participation Survey': ['NEA', 'arts participation', 'attendance'],
    'UNESCO Culture':               ['UNESCO', 'cultural heritage'],
    // Finance feed tokens: literal substrings the brain's evidence prose must
    // contain for _isEvidenceSourceVerified to anchor finance artifacts. Each
    // entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP finance feed so the
    // credit & capital-markets signal layer verifies instead of always failing.
    'Federal Reserve Primary Credit Rate': ['Federal Reserve', 'primary credit rate', 'discount rate', 'policy rate'],
    'FRED High Yield Spreads':             ['FRED', 'high yield', 'credit spread', 'BAMLH0A0HYM2'],
    'Bloomberg Credit Conditions':         ['Bloomberg', 'credit conditions', 'lending standards'],
    'CFTC Commitment of Traders':          ['CFTC', 'Commitment of Traders', 'positioning'],
    'CME FedWatch Rate Futures':           ['CME', 'FedWatch', 'rate futures', 'fed funds'],
    "Moody's Credit Conditions Index":     ["Moody's", 'Moody', 'credit conditions', 'downgrade'],
    'S&P 500 Volatility Index':            ['VIX', 'volatility index', 'market stress'],
    'S&P Credit Conditions':               ['S&P', 'credit conditions', 'rating'],
    'Fitch Credit Ratings':                ['Fitch', 'credit rating', 'default risk'],
    // Economy feed tokens: literal substrings the brain's evidence prose must
    // contain for _isEvidenceSourceVerified to anchor economy artifacts. Each
    // entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP economy feed so the
    // macroeconomic-aggregate signal layer verifies instead of always failing.
    // Anchors are the real FRED series ids + macro vocabulary (GDP, inflation,
    // unemployment, sentiment) — kept DISTINCT from finance (no credit/bank
    // tokens), so the macro evidence is source-verified exactly like finance.
    'FRED Real GDP Growth':       ['FRED', 'Real GDP', 'GDP', 'growth', 'GDPC1'],
    'FRED Unemployment Rate':     ['FRED', 'unemployment', 'jobless', 'UNRATE'],
    'FRED Nonfarm Payrolls':      ['FRED', 'payrolls', 'nonfarm', 'employment', 'PAYEMS'],
    'FRED CPI Inflation':         ['FRED', 'CPI', 'inflation', 'consumer price', 'CPIAUCSL'],
    'FRED PCE Inflation':         ['FRED', 'PCE', 'inflation', 'PCEPI'],
    'FRED Consumer Sentiment':    ['FRED', 'consumer sentiment', 'sentiment', 'UMCSENT'],
    'FRED Money Supply':          ['FRED', 'money supply', 'M2', 'M2SL'],
    'FRED Industrial Production': ['FRED', 'industrial production', 'output', 'INDPRO'],
    // Technology feed tokens: literal substrings the brain's evidence prose must
    // contain for _isEvidenceSourceVerified to anchor technology artifacts. Each
    // entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP technology feed so
    // the compute & innovation signal layer verifies instead of always failing.
    // Anchors are real semiconductor/compute vocabulary (GPU, foundry, EDA),
    // the AI/ML frontier, cloud platforms, and cybersecurity — kept DISTINCT
    // from finance (no credit/bank tokens) and from energy (no oil/gas/grid
    // tokens), so the technology evidence is source-verified exactly like the
    // proven ports. CISA KEV already carries the cyber token set above.
    'NVIDIA Investor Relations':  ['NVIDIA', 'NVDA', 'GPU', 'CUDA', 'accelerator', 'data center compute'],
    'TSMC Investor':              ['TSMC', 'TSM', 'foundry', 'fab', '3nm', '5nm', 'wafer'],
    'AMD Financial':              ['AMD', 'Ryzen', 'EPYC', 'Instinct', 'x86'],
    'Synopsys EDA Trends':        ['Synopsys', 'EDA', 'design tool', 'chip design', 'verification'],
    'IEEE Xplore':                ['IEEE', 'IEEE Xplore', 'engineering research', 'conference paper'],
    'ArXiv CS':                   ['ArXiv', 'arXiv', 'preprint', 'AI', 'LLM', 'neural', 'transformer'],
    'AI/ML':                      ['AI', 'LLM', 'neural', 'transformer', 'inference', 'training run'],
    'Cybersecurity':             ['CVE', 'zero-day', 'CISA', 'exploit', 'breach'],
    'Cloud Platforms':           ['AWS', 'Azure', 'GCP', 'cloud', 'hyperscaler', 'SaaS'],
    // Defense feed tokens: literal substrings the brain's evidence prose must
    // contain for _isEvidenceSourceVerified to anchor defense artifacts. Each
    // entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP defense feed so the
    // defense-industrial & readiness signal layer verifies instead of always
    // failing. Anchors are real defense-prime tickers + program / procurement /
    // readiness / deterrence vocabulary (contract wins, production rates,
    // weapons systems, modernization, deterrence posture) — kept DISTINCT from
    // intelligence (no collection / espionage tokens) and from technology
    // (no chip / cloud tokens; cyber is a coupling, carried by CISA KEV above),
    // and from energy (no oil / gas / grid tokens). Matches the brain prose
    // against real defense-company earnings vocabulary, not government budget
    // lines alone.
    'DoD Budget Justification':           ['DoD', 'Department of Defense', 'defense budget', 'procurement', 'O&M', 'topline'],
    'Lockheed Martin Investor Relations': ['LMT', 'Lockheed', 'F-35', 'missile', 'space', 'hypersonic', 'defense contract'],
    'Raytheon Technologies IR':           ['RTX', 'Raytheon', 'Collins', 'defense', 'Pratt', 'Whitney', 'missile'],
    'General Dynamics IR':                ['GD', 'General Dynamics', 'combat', 'platform', 'shipbuilding', 'submarine'],
    'Northrop Grumman IR':                ['NOC', 'Northrop', 'B-21', 'ICBM', 'Sentinel', 'satellite', 'sensor'],
    'Boeing Defense IR':                  ['BA', 'Boeing', 'P-8', 'CH-47', 'missile defense', 'space launch'],
    'L3Harris IR':                        ['LHX', 'L3Harris', 'electronic warfare', 'communications', 'ISR'],
    'Huntington Ingalls IR':              ['HII', 'Huntington Ingalls', 'shipbuilding', 'carrier', 'submarine', 'Newport News'],
    'Leidos IR':                          ['LDOS', 'Leidos', 'readiness', 'logistics', 'integration', 'sustainment'],
    'Booz Allen Hamilton IR':             ['BAH', 'Booz Allen', 'modernization', 'mission', 'analytics'],
    'Kratos Defense IR':                  ['KTOS', 'Kratos', 'drone', 'target', 'unmanned', 'hypersonic'],
    'AeroVironment IR':                   ['AVAV', 'AeroVironment', 'UAS', 'Switchblade', 'loitering munition', 'tactical'],
    // Intelligence feed tokens: literal substrings the brain's evidence prose
    // must contain for _isEvidenceSourceVerified to anchor intelligence
    // artifacts. Each entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP
    // intelligence feed so the collection & analysis signal layer verifies
    // instead of always failing. Anchors are the real IC collection-method
    // vocabulary (SIGINT, HUMINT, GEOINT, OSINT), all-source assessment outputs
    // (threat assessment, intelligence estimate, declassified assessment,
    // national intelligence), and the real IC OPERATOR tickers / collection
    // platforms (PLTR fusion, BAH operations, LDOS, CACI, SAIC, VRNT
    // surveillance, NICE, VRSK) — kept DISTINCT from defense (no
    // weapons-system / readiness / procurement tokens) and from technology
    // (no chip / cloud tokens; cyber briefings are a coupling, not
    // intelligence's identity), and from energy (no oil / gas / grid tokens).
    'ODNI Threat Assessment':          ['ODNI', 'threat assessment', 'national intelligence', 'intelligence community', 'national security'],
    'CIA World Factbook':              ['CIA', 'World Factbook', 'declassified assessment', 'covert', 'HUMINT'],
    'NSA Signals Intelligence':        ['NSA', 'SIGINT', 'signals intelligence', 'collection', 'interception'],
    'NGA Geospatial Analysis':         ['NGA', 'GEOINT', 'geospatial', 'imagery', 'reconnaissance'],
    'DIA Military Intelligence':       ['DIA', 'military intelligence', 'intelligence estimate', 'order of battle'],
    'IC All-Source Analysis':          ['all-source', 'all source', 'fusion', 'intelligence assessment', 'OSINT'],
    'Palantir Investor Relations':     ['PLTR', 'Palantir', 'data integration', 'fusion platform', 'Gotham', 'Foundry'],
    'Booz Allen Intelligence (Intel)': ['BAH', 'Booz Allen', 'intelligence operations', 'mission analytics', 'all-source'],
    'Leidos Intelligence (Intel)':     ['LDOS', 'Leidos', 'intelligence systems', 'ISR', 'collection support'],
    'CACI Investor Relations':         ['CACI', 'mission technology', 'intelligence support', 'SIGINT', 'expeditionary'],
    'SAIC Investor Relations':         ['SAIC', 'Science Applications', 'intelligence contractor', 'mission integration'],
    'KBR Investor Relations':          ['KBR', 'intelligence logistics', 'mission operations', 'sustainment'],
    'Verint Investor Relations':       ['VRNT', 'Verint', 'SIGINT', 'surveillance', 'intercept', 'lawful interception'],
    'NICE Investor Relations':         ['NICE', 'intelligence operations', 'analytics platform', 'investigation'],
    'Verisk Investor Relations':       ['VRSK', 'Verisk', 'OSINT', 'risk analytics', 'open-source intelligence'],
    // Industry feed tokens: literal substrings the brain's evidence prose must
    // contain for _isEvidenceSourceVerified to anchor industry artifacts. Each
    // entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP industry feed so the
    // manufacturing & industrial-production signal layer verifies instead of
    // always failing. Anchors are real industrial / capital-goods tickers plus
    // production / capacity / automation / machinery / maintenance vocabulary
    // (excavator, combine, turbine, factory automation, capacity utilization,
    // production rate, backlog, robotics) — kept DISTINCT from economy (no bare
    // macro-demand tokens; INDPRO is scoped to factory/mining output here), from
    // trade (no logistics/shipping tokens), and from technology (no chip/cloud
    // tokens; automation is a coupling), and from energy (no oil/gas/grid
    // tokens). Matches the brain prose against real industrial-company earnings
    // vocabulary, not government output lines alone.
    'Caterpillar Investor Relations':         ['CAT', 'Caterpillar', 'excavator', 'loader', 'mining', 'construction equipment', 'backlog'],
    'Deere Investor Relations':               ['DE', 'John Deere', 'Deere', 'combine', 'farm equipment', 'precision agriculture', 'machinery'],
    'GE Investor Relations':                  ['GE', 'General Electric', 'turbine', 'grid equipment', 'industrial controls', 'aerospace engine'],
    'Honeywell Investor Relations':           ['HON', 'Honeywell', 'automation', 'controls', 'process solutions', 'aerospace'],
    '3M Investor Relations':                  ['MMM', '3M', 'manufacturing', 'adhesives', 'abrasives', 'industrial materials'],
    'Emerson Investor Relations':             ['EMR', 'Emerson', 'process automation', 'measurement', 'control valve', 'industrial software'],
    'ITW Investor Relations':                 ['ITW', 'Illinois Tool Works', 'fastening', 'welding', 'industrial', 'components'],
    'Eaton Investor Relations':               ['ETN', 'Eaton', 'electrical', 'power management', 'hydraulics', 'industrial controls'],
    'Parker Hannifin Investor Relations':     ['PH', 'Parker', 'Parker Hannifin', 'motion', 'control', 'hydraulics', 'pneumatics'],
    'Rockwell Automation Investor Relations': ['ROK', 'Rockwell', 'factory automation', 'PLC', 'industrial controls', 'robotics', 'control system'],
    'Dover Investor Relations':               ['DOV', 'Dover', 'industrial equipment', 'pumps', 'manufacturing', 'machinery'],
    'GE Vernova Investor Relations':          ['GEV', 'GE Vernova', 'Vernova', 'turbine', 'industrial power equipment', 'grid'],
    'FRED Industrial Production Index':       ['FRED', 'Industrial Production', 'INDPRO', 'factory output', 'capacity utilization', 'manufacturing output'],
    'ISM Manufacturing PMI':                  ['ISM', 'Manufacturing PMI', 'PMI', 'factory expansion', 'new orders', 'production index'],
    // Environment feed tokens: literal substrings the brain's evidence prose
    // must contain for _isEvidenceSourceVerified to anchor environment
    // artifacts. Each entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP
    // environment feed so the climate & environmental-health signal layer
    // verifies instead of always failing. Anchors are real climate / air /
    // water / ecosystem vocabulary (AQI, temperature anomaly, CO2, species
    // decline, biodiversity) plus real environmental-sector OPERATOR tickers
    // (WM, RSG, WCN, CWST, AWK, WTRG, XYL, ECL, LIN, APD, DAR, AY) and their
    // waste / water / treatment / sustainability vocabulary — kept DISTINCT
    // from energy (no oil/gas/grid tokens — environment couples to energy via
    // emissions/carbon), from agriculture (no land-use/crop tokens — a
    // coupling), and from technology (no chip/cloud tokens). Matches the brain
    // prose against real environmental sources, not generic climate words alone.
    'EPA Air Quality':                       ['EPA', 'air quality index', 'AQI', 'particulate', 'ozone'],
    'EPA Water Quality':                     ['EPA', 'water contamination', 'MCL', 'Safe Drinking Water'],
    'NOAA Climate Data':                     ['NOAA', 'temperature anomaly', 'CO2', 'climate', 'warming'],
    'USGS Ecosystem Health':                 ['USGS', 'species decline', 'habitat loss', 'biodiversity', 'ecosystem'],
    'IPCC Climate Assessment':               ['IPCC', 'climate change', 'anthropogenic', 'emissions', 'global warming'],
    'Waste Management Investor Relations':   ['WM', 'waste', 'landfill', 'recycling', 'solid waste'],
    'Republic Services Investor Relations':  ['RSG', 'Republic Services', 'waste collection', 'disposal'],
    'Waste Connections Investor Relations':  ['WCN', 'Waste Connections', 'waste'],
    'Casella Waste Systems Investor Relations': ['CWST', 'Casella', 'waste'],
    'American Water Works Investor Relations':   ['AWK', 'American Water', 'water utility', 'treatment'],
    'Water Technologies Group':              ['WTRG', 'water tech', 'treatment', 'pipeline'],
    'Xylem Investor Relations':              ['XYL', 'Xylem', 'water management', 'infrastructure'],
    'Ecolab Investor Relations':             ['ECL', 'Ecolab', 'water solutions', 'treatment chemistry'],
    'Linde Environmental':                   ['LIN', 'Linde', 'environmental gases', 'air separation'],
    'Air Products Environmental':            ['APD', 'Air Products', 'environmental solutions', 'emissions'],
    'Darling Ingredients Investor Relations': ['DAR', 'Darling', 'sustainability', 'waste-to-value'],
    'Asure Energy':                          ['AY', 'Asure', 'energy efficiency', 'sustainability'],
    // Agriculture feed tokens: literal substrings the brain's evidence prose must
    // contain for _isEvidenceSourceVerified to anchor agriculture artifacts. Each
    // entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP agriculture feed so
    // the crop / commodity / farm-input signal layer verifies instead of always
    // failing. Anchors are real USDA crop vocabulary (crop yield, bu/acre, corn,
    // soy, wheat, QuickStats, WASDE supply/demand), CBOT grain-futures contract
    // symbols (ZC corn, ZS soybean, ZW wheat), and real agriculture tickers (ADM,
    // BG, CTVA, DE, NTR, MOS, CF, TSN, CAG, INGR, AGCO, FMC) with their
    // commodity-processing / seed / fertilizer / protein / equipment / crop-input
    // vocabulary — kept DISTINCT from energy (no oil/gas/grid tokens; biofuel/
    // fertilizer-energy is a coupling), from environment (no climate/land-use
    // tokens; a coupling), from trade (no export-logistics tokens), and from
    // economy (no food-price macro tokens). Matches the brain prose against real
    // agriculture sources, not generic farm words alone.
    'USDA NASS':                  ['USDA NASS', 'NASS', 'QuickStats', 'crop yield', 'bu/acre', 'corn', 'soybean', 'wheat', 'production', 'harvest'],
    'CBOT Grain Futures':         ['CBOT', 'Chicago Board of Trade', 'corn futures', 'soybean futures', 'wheat futures', 'grain futures', 'ZC', 'ZS', 'ZW', 'contract'],
    'USDA WASDE':                 ['USDA WASDE', 'WASDE', 'world supply', 'supply and demand', 'demand', 'ending stocks', 'estimate', 'consumption'],
    'ADM Investor':              ['ADM', 'Archer Daniels', 'commodity processing', 'oilseed', 'grain merchandising'],
    'Bunge Investor':            ['BG', 'Bunge', 'grain trade', 'oilseed processing', 'agribusiness'],
    'Corteva Investor':          ['CTVA', 'Corteva', 'ag biotech', 'seed', 'crop protection', 'germplasm'],
    'Deere Agriculture Investor': ['DE', 'John Deere', 'Deere', 'combine', 'tractor', 'precision agriculture', 'farm equipment'],
    'Nutrien Investor':          ['NTR', 'Nutrien', 'fertilizer', 'potash', 'crop nutrients', 'ag retail'],
    'Mosaic Investor':           ['MOS', 'Mosaic', 'crop nutrients', 'phosphate', 'potash', 'fertilizer'],
    'CF Industries Investor':    ['CF', 'CF Industries', 'nitrogen', 'ammonia', 'urea', 'fertilizer'],
    'Tyson Foods Investor':      ['TSN', 'Tyson', 'protein production', 'beef', 'poultry', 'pork', 'livestock'],
    'Conagra Brands Investor':   ['CAG', 'Conagra', 'food brand', 'packaged food', 'grocery'],
    'Ingredion Investor':        ['INGR', 'Ingredion', 'ingredient', 'starch', 'sweetener', 'food processing'],
    'AGCO Investor':             ['AGCO', 'farm equipment', 'tractor', 'harvesting', 'farm machinery'],
    'FMC Investor':              ['FMC', 'FMC Corp', 'crop inputs', 'crop protection', 'pesticide', 'agricultural chemistry'],
    // Communication feed tokens: literal substrings the brain's evidence prose
    // must contain for _isEvidenceSourceVerified to anchor communication
    // artifacts. Each entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP
    // communication feed so the connectivity & information-flow signal layer
    // verifies instead of always failing. Anchors are the real communications-
    // regulator vocabulary (FCC, spectrum, rulemaking, auction, licensing),
    // press-freedom / news-flow vocabulary (RSF, CPJ, press freedom, internet
    // shutdown), broadcast vocabulary (NAB, broadcast), and real telecom / tower /
    // network / media OPERATOR tickers (VZ, T, TMUS, CMCSA, CHTR, CSCO, ANET,
    // AMT, CCI, SBAC, NWSA, NYT, META, GOOGL) with their carrier / fiber / 5G /
    // tower / broadband / streaming / distribution vocabulary — kept DISTINCT
    // from culture (no charts / discography / box-office tokens — culture =
    // content; communication = the CHANNELS), from technology (no chip / foundry
    // tokens — networking silicon is a coupling), from intelligence (no SIGINT /
    // collection tokens — collection is a coupling; this is open-network
    // distribution), and from energy (no oil/gas/grid tokens). Matches the brain
    // prose against real communications sources, not generic media words alone.
    'Federal Communications Commission':     ['FCC', 'Federal Communications Commission', 'spectrum', 'rulemaking', 'auction', 'licensing', 'broadband deployment'],
    'Press Freedom Index RSF':               ['RSF', 'Reporters Without Borders', 'press freedom', 'press freedom index'],
    'CPJ Press Freedom Violations':          ['CPJ', 'Committee to Protect Journalists', 'press freedom', 'journalist', 'censorship'],
    'National Association of Broadcasters':  ['NAB', 'National Association of Broadcasters', 'broadcast', 'broadcaster'],
    'Broadcasters Foundation':               ['Broadcasters Foundation', 'broadcast industry'],
    'Cloudflare Radar':                      ['Cloudflare Radar', 'Cloudflare', 'internet traffic', 'outage', 'internet shutdown'],
    'Netblocks Internet Observatory':        ['Netblocks', 'NetBlocks', 'internet shutdown', 'connectivity disruption'],
    'Verizon Investor Relations':            ['VZ', 'Verizon', 'wireless', '5G', 'fiber', 'broadband', 'network'],
    'AT&T Investor Relations':               ['T', 'AT&T', 'wireless', 'fiber', '5G', 'broadband', 'connectivity'],
    'T-Mobile Investor Relations':           ['TMUS', 'T-Mobile', 'wireless', '5G', 'spectrum', 'network'],
    'Comcast Investor Relations':            ['CMCSA', 'Comcast', 'broadband', 'cable', 'Xfinity', 'connectivity', 'media'],
    'Charter Communications Investor Relations': ['CHTR', 'Charter', 'Spectrum', 'broadband', 'cable', 'connectivity'],
    'Cisco Investor Relations':              ['CSCO', 'Cisco', 'networking', 'router', 'switch', 'network infrastructure'],
    'Arista Networks Investor Relations':    ['ANET', 'Arista', 'networking', 'data center switch', 'network infrastructure'],
    'American Tower Investor Relations':     ['AMT', 'American Tower', 'tower', 'cell site', 'macro tower', 'colocation'],
    'Crown Castle Investor Relations':       ['CCI', 'Crown Castle', 'tower', 'small cell', 'fiber', 'cell site'],
    'SBA Communications Investor Relations': ['SBAC', 'SBA Communications', 'tower', 'cell site', 'wireless infrastructure'],
    'News Corp Investor Relations':          ['NWSA', 'News Corp', 'news', 'publishing', 'journalism', 'media'],
    'New York Times Investor Relations':     ['NYT', 'New York Times', 'news', 'journalism', 'subscription', 'digital news'],
    'Meta Investor Relations':               ['META', 'Meta', 'Facebook', 'Instagram', 'social media', 'distribution platform', 'feed'],
    'Alphabet Investor Relations':           ['GOOGL', 'GOOG', 'Alphabet', 'Google', 'YouTube', 'search', 'distribution platform'],
    // Medicine / health feed tokens: literal substrings the brain's evidence
    // prose must contain for _isEvidenceSourceVerified to anchor medicine
    // artifacts. Each entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP
    // medicine feed so the healthcare-delivery & drug-development signal layer
    // verifies instead of always failing. Anchors are the real federal-health
    // authority vocabulary (FDA, approval, NDA, 510(k), PMA, NIH, NHLBI, CDC,
    // surveillance, clinical trial, ClinicalTrials.gov, AAFP) and real
    // healthcare tickers (UNH, JNJ, PFE, MRK, ABBV, LLY, TMO, ABT, MDT, ISRG,
    // HCA, CVS, AMGN, GILD) with their managed-care / pharma / device / biotech /
    // hospital vocabulary — kept DISTINCT from science (no basic-research tokens
    // — a coupling), from population (no demographics tokens — a coupling), and
    // from environment (no environmental-exposure tokens — a coupling). Matches
    // the brain prose against real healthcare sources, not generic health words
    // alone.
    'FDA Drug Evaluation':                   ['FDA', 'CDER', 'drug approval', 'NDA', 'new drug application', 'label'],
    'FDA Medical Device Clearance':          ['FDA', '510(k)', 'PMA', 'device clearance', 'medical device', 'premarket'],
    'NIH NHLBI Clinical Research':           ['NIH', 'NHLBI', 'clinical research', 'cardiovascular', 'clinical study'],
    'CDC Disease Surveillance':              ['CDC', 'surveillance', 'epidemiology', 'incidence', 'outbreak', 'disease'],
    'ClinicalTrials.gov Registry':           ['ClinicalTrials.gov', 'clinical trial', 'NCT', 'trial registry', 'enrollment'],
    'AAFP Clinical Guidance':                ['AAFP', 'family medicine', 'clinical guideline', 'practice recommendation'],
    'UnitedHealth Group Investor Relations': ['UNH', 'UnitedHealth', 'Optum', 'managed care', 'health insurance', 'medical loss ratio'],
    'Johnson & Johnson Investor Relations':  ['JNJ', 'Johnson & Johnson', 'pharmaceutical', 'medical device', 'MedTech'],
    'Pfizer Investor Relations':             ['PFE', 'Pfizer', 'pharmaceutical', 'vaccine', 'drug pipeline'],
    'Merck Investor Relations':              ['MRK', 'Merck', 'pharmaceutical', 'oncology', 'Keytruda', 'drug pipeline'],
    'AbbVie Investor Relations':             ['ABBV', 'AbbVie', 'pharmaceutical', 'immunology', 'drug pipeline'],
    'Eli Lilly Investor Relations':          ['LLY', 'Eli Lilly', 'Lilly', 'pharmaceutical', 'diabetes', 'drug pipeline'],
    'Thermo Fisher Investor Relations':      ['TMO', 'Thermo Fisher', 'life sciences', 'diagnostics', 'lab equipment'],
    'Abbott Investor Relations':             ['ABT', 'Abbott', 'medical device', 'diagnostics', 'continuous glucose'],
    'Medtronic Investor Relations':          ['MDT', 'Medtronic', 'medical device', 'cardiac', 'surgical'],
    'Intuitive Surgical Investor Relations': ['ISRG', 'Intuitive Surgical', 'da Vinci', 'surgical robotics', 'robotic surgery'],
    'HCA Healthcare Investor Relations':     ['HCA', 'HCA Healthcare', 'hospital', 'care delivery', 'health system', 'admissions'],
    'CVS Health Investor Relations':         ['CVS', 'CVS Health', 'Aetna', 'pharmacy', 'health services', 'managed care'],
    'Amgen Investor Relations':              ['AMGN', 'Amgen', 'biotech', 'biologics', 'drug pipeline'],
    'Gilead Sciences Investor Relations':    ['GILD', 'Gilead', 'biotech', 'antiviral', 'HIV', 'drug pipeline'],
    // Education feed tokens: literal substrings the brain's evidence prose must
    // contain for _isEvidenceSourceVerified to anchor education artifacts. Each
    // entry mirrors a CITATION_HINTS / PRIMARY_PRIORITY_MAP education feed so
    // the K-12 / higher-ed / workforce-training / student-outcome /
    // credentialing signal layer verifies instead of always failing. Anchors
    // are the real federal education-authority vocabulary (NCES, IPEDS, NAEP,
    // Dept of Education, enrollment, achievement, graduation rate, student
    // debt), the international index vocabulary (UNESCO, World Bank human
    // capital, OECD, PISA), and real edtech / higher-ed tickers (CHGG, COUR,
    // DUOL, LRN, ATGE, LOPE, STRA, LAUR, TWOU, UTI) with their online-learning /
    // institution / credentialing vocabulary — kept DISTINCT from science (no
    // basic-research tokens — a coupling), from population (no demographics
    // tokens — a coupling), from technology (no chip / cloud tokens — edtech
    // tooling is a coupling), and from economy (no macro-aggregate tokens —
    // workforce is a coupling). Matches the brain prose against real education
    // sources, not generic learning words alone.
    'NCES Student Data':                     ['NCES', 'National Center for Education Statistics', 'enrollment', 'K-12', 'graduation rate', 'achievement'],
    'IPEDS Higher-Ed':                       ['IPEDS', 'postsecondary', 'higher education', 'institution', 'completion', 'enrollment'],
    'NAEP Nation Report Card':               ['NAEP', "Nation's Report Card", 'achievement', 'reading', 'math', 'proficiency'],
    'ED.gov K-12':                           ['ED.gov', 'Department of Education', 'K-12', 'Title I', 'public school'],
    'USDOE Department':                      ['U.S. Department of Education', 'USDOE', 'Department of Education', 'education policy', 'federal funding'],
    'Federal Student Aid Debt Data':         ['Federal Student Aid', 'student debt', 'student loan', 'loan portfolio', 'FAFSA', 'financial aid'],
    'UNESCO Institute for Statistics':       ['UNESCO', 'UIS', 'literacy', 'out-of-school', 'education for all'],
    'World Bank Human Capital':              ['World Bank', 'human capital', 'learning poverty', 'education investment'],
    'OECD Education Statistics':             ['OECD', 'PISA', 'education at a glance', 'tertiary attainment'],
    'Chegg Investor Relations':              ['CHGG', 'Chegg', 'online learning', 'study', 'edtech', 'student services'],
    'Coursera Investor Relations':           ['COUR', 'Coursera', 'online course', 'MOOC', 'edtech', 'credential'],
    'Duolingo Investor Relations':           ['DUOL', 'Duolingo', 'language learning', 'edtech', 'daily active learners'],
    'Stride Investor Relations':             ['LRN', 'Stride', 'K12', 'online K-12', 'virtual school', 'enrollment'],
    'Adtalem Investor Relations':            ['ATGE', 'Adtalem', 'higher education', 'medical education', 'enrollment'],
    'Grand Canyon Education Investor Relations': ['LOPE', 'Grand Canyon', 'university', 'higher education', 'enrollment'],
    'Strategic Education Investor Relations': ['STRA', 'Strategic Education', 'Strayer', 'Capella', 'university', 'enrollment'],
    'Laureate Education Investor Relations':  ['LAUR', 'Laureate', 'university', 'higher education', 'enrollment'],
    '2U Investor Relations':                 ['TWOU', '2U', 'online degree', 'edtech', 'university partner', 'OPM'],
    'Universal Technical Institute Investor Relations': ['UTI', 'Universal Technical Institute', 'workforce training', 'technical', 'skilled trades', 'credential']
  };

  // ─── Module-level flag: SCHEMA_VERSION_BUMPED warning ─────────────────
  // Pushed onto the first packet of the first buildAll call (once per page
  // load). Subsequent calls don't push. Console.info also fires once.
  var _schemaWarningEmitted = false;

  // ─── Helpers (pure; unchanged from D3-A1.v1 except _buildProvenance) ───

  function _stressBand(stress) {
    if (typeof stress !== 'number' || isNaN(stress)) return 'unknown';
    if (stress >= 0.85) return 'critical';
    if (stress >= 0.65) return 'high';
    if (stress >= 0.40) return 'elevated';
    if (stress >= 0.20) return 'moderate';
    return 'baseline';
  }

  function _normalizeConfidence(packet) {
    var raw = packet && typeof packet.confidence === 'number' && isFinite(packet.confidence)
      ? packet.confidence : null;
    if (raw === null) {
      return { fraction: 0, percent: 0, clamped: false, hadValue: false };
    }
    var divided = raw > 1 ? raw / 100 : raw;
    var clamped = Math.max(0, Math.min(1, divided));
    return {
      fraction: clamped,
      percent: Math.round(clamped * 100),
      clamped: clamped !== divided,
      hadValue: true
    };
  }

  // Replicate observatory-ui.js buildImplementations BYTE-IDENTICAL.
  function _buildImplementations(packet) {
    if (!packet || typeof packet !== 'object') return [];
    var rows = [];
    var seen = {};

    function normalize(value) {
      if (Array.isArray(value)) return value.filter(Boolean).join('; ');
      if (value && typeof value === 'object') return '';
      return String(value == null ? '' : value).trim();
    }

    function add(label, value) {
      var text = normalize(value);
      if (!text) return;
      var row = label + ': ' + text;
      var key = row.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      rows.push(row);
    }

    var mc = packet.moneyChain || {};
    add('Action',       packet.action);
    add('Do this',      mc.doThis);
    add('Trigger',      packet.trigger);
    add('Validation',   packet.validation);
    add('Next step',    mc.nextStep);
    add('Evidence',     mc.evidence);
    add('Outcome',      packet.outcome);
    add('Failure mode', packet.failure);

    return rows.slice(0, 8);
  }

  function _deriveUnit(label) {
    if (typeof label !== 'string' || !label) return '';
    if (/\$\d/.test(label) && /(crude|wti|brent|petroleum|oil)/i.test(label)) return '$/bbl';
    if (/\$\d/.test(label)) return '$';
    if (/\d+\s*%/.test(label)) return '%';
    if (/\d+\s+articles?/i.test(label)) return 'count';
    if (/\d+\s+alerts?/i.test(label)) return 'count';
    if (/\d+\s+(documents?|filings?|recalls?)/i.test(label)) return 'count';
    return '';
  }

  function _selectPrimary(domain, sources, warnings) {
    if (!Array.isArray(sources) || sources.length === 0) return null;
    var liveReal = [];
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i];
      if (s && s.live === true && s.classification === 'real' && s.signalType === 'structural') {
        liveReal.push(s);
      }
    }
    if (liveReal.length === 0) return null;

    var priorities = PRIMARY_PRIORITY_MAP[domain];
    if (Array.isArray(priorities) && priorities.length > 0) {
      for (var p = 0; p < priorities.length; p++) {
        for (var li = 0; li < liveReal.length; li++) {
          if (liveReal[li].name === priorities[p]) return liveReal[li];
        }
      }
    }

    warnings.push({
      code: 'PRIMARY_BY_FALLBACK',
      severity: 'info',
      message: 'No priority match for domain "' + domain + '"; using first live structural source "' + liveReal[0].name + '".',
      field: 'provenance.primarySource'
    });
    return liveReal[0];
  }

  /**
   * Parse an active-condition list for a numeric threshold.
   *
   * Convention: highest crossed threshold = strongest active signal.
   * Generalized regex: /_(above|below)_(\d+)$/  — matches both directions.
   *
   * @param  {Array<string>} activeConditions
   * @return {{direction: 'above'|'below', value: number} | null}
   */
  function _parseThreshold(activeConditions) {
    if (!Array.isArray(activeConditions)) return null;
    var best = null;
    for (var i = 0; i < activeConditions.length; i++) {
      var c = activeConditions[i];
      if (typeof c !== 'string') continue;
      var m = c.match(/_(above|below)_(\d+)$/);
      if (!m) continue;
      var n = parseInt(m[2], 10);
      if (!isFinite(n)) continue;
      if (best === null || n > best.value) {
        best = { direction: m[1], value: n };
      }
    }
    return best;
  }

  // _buildProvenance — refactored to take domain explicitly (was packet).
  function _buildProvenance(domain, snapshot, activeConditions, now, warnings) {
    var snapshotTimestamp = null;
    var feedSources = [];
    var primary = null;

    if (snapshot && typeof snapshot === 'object') {
      snapshotTimestamp = _resolveSnapshotTimestamp(snapshot);
      var dom = snapshot.domains && snapshot.domains[domain];
      var sources = dom && Array.isArray(dom.sources) ? dom.sources : [];
      for (var i = 0; i < sources.length; i++) {
        var s = sources[i];
        if (!s) continue;
        // D3-A4: preserve full source-truth fields from snapshot. Broken
        // sources (classification:'broken') are NOT filtered — they remain
        // in feedSources[] for verifier inspection. Derived `unit` and
        // `timestamp` retained for backward compatibility with existing
        // readers (_isEvidenceSourceVerified, _aggregateFeedClassification,
        // _selectPrimary, citationHints lookup).
        feedSources.push({
          name:            s.name || '',
          value:           (typeof s.value === 'number') ? s.value : null,
          label:           s.label || '',
          channel:         s.channel || null,
          quality:         (typeof s.quality === 'number') ? s.quality : null,
          classification:  s.classification || null,
          signalType:      s.signalType || null,
          updated:         (typeof s.updated === 'number') ? s.updated : null,
          fetchedAt:       (typeof s.fetchedAt === 'number') ? s.fetchedAt : null,
          sourceUpdatedAt: s.sourceUpdatedAt || null,
          live:            s.live === true,
          failReason:      s.failReason || null,
          // Derived fields (kept for backward compat):
          unit:            _deriveUnit(s.label || ''),
          timestamp:       (typeof s.updated === 'number') ? s.updated
                           : (typeof s.fetchedAt === 'number') ? s.fetchedAt : null
        });
      }
      primary = _selectPrimary(domain, sources, warnings);
      if (primary === null) {
        warnings.push({
          code: 'NO_PRIMARY_SOURCE',
          severity: 'warn',
          message: 'No live structural source for domain "' + domain + '" in snapshot.',
          field: 'provenance.primarySource'
        });
      }
    } else {
      warnings.push({
        code: 'NO_SNAPSHOT',
        severity: 'warn',
        message: 'options.snapshot not provided; provenance fields default to null/[].',
        field: 'provenance'
      });
    }

    var primarySource = primary ? (primary.name || null) : null;
    var primaryValue  = primary && typeof primary.value === 'number' ? primary.value : null;
    var primaryUnit   = primary ? _deriveUnit(primary.label || '') : '';
    var primaryTimestamp = primary
      ? ((typeof primary.updated === 'number') ? primary.updated
         : (typeof primary.fetchedAt === 'number') ? primary.fetchedAt : null)
      : null;
    var primaryAgeSeconds = primaryTimestamp != null
      ? Math.max(0, Math.round((now - primaryTimestamp) / 1000))
      : null;

    var thresholdTested = _parseThreshold(activeConditions);

    var citationHints = [];
    var seenHint = {};
    for (var fi = 0; fi < feedSources.length; fi++) {
      var hint = CITATION_HINTS[feedSources[fi].name];
      if (hint && !seenHint[hint]) { seenHint[hint] = true; citationHints.push(hint); }
    }

    return {
      primarySource:      primarySource,
      primaryValue:       primaryValue,
      primaryUnit:        primaryUnit,
      primaryTimestamp:   primaryTimestamp,
      primaryAgeSeconds:  primaryAgeSeconds,
      thresholdTested:    thresholdTested,
      feedSources:        feedSources,
      snapshotTimestamp:  snapshotTimestamp,
      citationHints:      citationHints
    };
  }

  function _isEvidenceSourceVerified(observatoryPacket, provenance, warnings) {
    var realLiveFeeds = [];
    for (var i = 0; i < provenance.feedSources.length; i++) {
      var fs = provenance.feedSources[i];
      if (fs && fs.classification === 'real' && fs.live === true && fs.name) {
        realLiveFeeds.push(fs);
      }
    }
    if (realLiveFeeds.length === 0) return false;

    var feedTokens = [];
    for (var fi = 0; fi < realLiveFeeds.length; fi++) {
      var name = realLiveFeeds[fi].name;
      var tokens = FEED_TOKENS[name];
      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        warnings.push({
          code: 'EVIDENCE_VERIFY_TOKEN_MISSING',
          severity: 'warn',
          message: 'No FEED_TOKENS entry for feed "' + name + '"; falling back to feed name only.',
          field: 'anti_overclaim.evidenceSourceVerified'
        });
        tokens = [name];
      }
      var lc = [];
      for (var ti = 0; ti < tokens.length; ti++) {
        if (typeof tokens[ti] === 'string' && tokens[ti].length > 0) {
          lc.push(tokens[ti].toLowerCase());
        }
      }
      feedTokens.push(lc);
    }

    var mc = observatoryPacket.moneyChain || {};
    var fields = [
      observatoryPacket.trigger,
      observatoryPacket.validation,
      observatoryPacket.outcome,
      observatoryPacket.failure,
      mc.evidence,
      mc.whyPays,
      observatoryPacket.explain
    ];
    for (var fldI = 0; fldI < fields.length; fldI++) {
      var s = (typeof fields[fldI] === 'string') ? fields[fldI].toLowerCase() : '';
      if (!s) continue;  // empty = vacuously verified
      var matched = false;
      for (var fdI = 0; fdI < feedTokens.length && !matched; fdI++) {
        var toks = feedTokens[fdI];
        for (var tkI = 0; tkI < toks.length; tkI++) {
          if (s.indexOf(toks[tkI]) !== -1) { matched = true; break; }
        }
      }
      if (!matched) return false;
    }
    return true;
  }

  function _aggregateFeedClassification(provenance) {
    var order = { 'real': 4, 'degraded': 3, 'event': 2, 'broken': 1 };
    var bestRank = 0;
    var best = null;
    for (var i = 0; i < provenance.feedSources.length; i++) {
      var fs = provenance.feedSources[i];
      if (!fs || !fs.live) continue;
      var rank = order[fs.classification] || 0;
      if (rank > bestRank) { bestRank = rank; best = fs.classification; }
    }
    return best;
  }

  function _safeClone(src) {
    if (src === null || typeof src !== 'object') return src;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(src); } catch (e) { /* fall through */ }
    }
    try { return JSON.parse(JSON.stringify(src)); } catch (e) { return null; }
  }

  function _deepFreeze(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Object.isFrozen(value)) return value;
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      var v = value[keys[i]];
      if (v !== null && typeof v === 'object') _deepFreeze(v);
    }
    return Object.freeze(value);
  }

  function _isDeepFrozen(value) {
    if (value === null || typeof value !== 'object') return true;
    if (!Object.isFrozen(value)) return false;
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      if (!_isDeepFrozen(value[keys[i]])) return false;
    }
    return true;
  }

  var TOP_LEVEL_KEYS = [
    'packetSchemaVersion', 'builtAt', 'sourcePacketId',
    'identity', 'signal', 'evidence', 'implementation', 'confidence',
    'anti_overclaim', 'provenance', 'lane_hints', 'raw'
  ];

  function _validateShape(packet) {
    if (!packet || typeof packet !== 'object') {
      return {
        ok: false,
        missing: ['(root)'],
        warnings: [{
          code: 'SHAPE_MISSING_REQUIRED',
          severity: 'block',
          message: 'Packet is null or non-object.',
          field: null
        }]
      };
    }
    var missing = [];
    var warns = [];
    for (var i = 0; i < TOP_LEVEL_KEYS.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(packet, TOP_LEVEL_KEYS[i])) {
        missing.push(TOP_LEVEL_KEYS[i]);
      }
    }

    // D3-A3.v3 identity sub-key validation: id (non-empty + composite '::')
    // and sourceOpportunityId (non-empty) are required. The composite-id
    // contract guarantees global uniqueness across multi-lane fan-out.
    var ident = packet.identity;
    if (!ident || typeof ident !== 'object') {
      missing.push('identity (object)');
    } else {
      if (typeof ident.sourceOpportunityId !== 'string' || ident.sourceOpportunityId.length === 0) {
        missing.push('identity.sourceOpportunityId');
      }
      if (typeof ident.id !== 'string' || ident.id.length === 0) {
        missing.push('identity.id');
      } else if (ident.id.indexOf('::') === -1) {
        missing.push('identity.id (must contain "::" composite separator)');
      }
    }

    if (missing.length > 0) {
      warns.push({
        code: 'SHAPE_MISSING_REQUIRED',
        severity: 'block',
        message: 'Missing required top-level keys: ' + missing.join(', '),
        field: null
      });
    }
    if (!_isDeepFrozen(packet)) {
      warns.push({
        code: 'SHAPE_NOT_FROZEN',
        severity: 'warn',
        message: 'Packet or a nested value is not deep-frozen.',
        field: null
      });
    }
    return { ok: missing.length === 0, missing: missing, warnings: warns };
  }

  // ─── Snapshot resolution (D3-A4) ───────────────────────────────────────
  // Resolves the /api/domain-snapshot payload from one of three sources, in
  // priority order:
  //   1. options.snapshot — explicit caller-provided snapshot (test injection
  //      or D3-A4.2 scheduler).
  //   2. window.LIMENSharedSnapshot.getSnapshot() — the shared spine already
  //      running on civilization.html (shared-snapshot-engine.js, 30s poll).
  //   3. window.LIMENDomainSnapshot — fallback for any future tooling that
  //      publishes the raw snapshot directly on window.
  //
  // Returns null when no snapshot is available; _buildProvenance then
  // emits NO_SNAPSHOT as before. Pure read — never mutates source.
  function _resolveSnapshot(options) {
    if (options && options.snapshot && options.snapshot.domains) {
      return options.snapshot;
    }
    if (typeof window !== 'undefined') {
      if (window.LIMENSharedSnapshot &&
          typeof window.LIMENSharedSnapshot.getSnapshot === 'function') {
        var shared = window.LIMENSharedSnapshot.getSnapshot();
        if (shared && shared.domains) return shared;
      }
      if (window.LIMENDomainSnapshot && window.LIMENDomainSnapshot.domains) {
        return window.LIMENDomainSnapshot;
      }
    }
    return null;
  }

  // ─── Snapshot timestamp resolution (D3-A4.5) ───────────────────────────
  // The snapshot object cached by LIMENSharedSnapshot._latestSnapshot is the
  // raw API response and does NOT carry a `.timestamp` field — the engine
  // stores its fetch time separately at LIMENSharedSnapshot.getDiagnostics()
  // .lastUpdated. Resolves from these candidates in order:
  //   1. snapshot.meta.generatedAt (if API ever returns it)
  //   2. snapshot.timestamp        (legacy / direct injection)
  //   3. LIMENSharedSnapshot.getDiagnostics().lastUpdated  (running engine)
  // Returns null only when no candidate is a finite number. Without this
  // helper, snapshotFresh is permanently false even when the snapshot is
  // ≤30s old, which would silently demote every packet's readiness.
  function _resolveSnapshotTimestamp(snapshot) {
    if (snapshot && snapshot.meta && typeof snapshot.meta.generatedAt === 'number') {
      return snapshot.meta.generatedAt;
    }
    if (snapshot && typeof snapshot.timestamp === 'number') {
      return snapshot.timestamp;
    }
    if (typeof window !== 'undefined' && window.LIMENSharedSnapshot &&
        typeof window.LIMENSharedSnapshot.getDiagnostics === 'function') {
      try {
        var diag = window.LIMENSharedSnapshot.getDiagnostics();
        if (diag && typeof diag.lastUpdated === 'number' && diag.lastUpdated > 0) {
          return diag.lastUpdated;
        }
      } catch (e) { /* swallow — null fallback */ }
    }
    return null;
  }

  // ─── Helpers retained for deprecated buildFromObservatoryPacket path ───

  function _findMatchingHandoffPackets(observatoryPacket, handoffState) {
    if (!observatoryPacket || !handoffState || typeof handoffState !== 'object') return [];
    var lanes = handoffState.lanes || {};
    var oppId = observatoryPacket.id;
    var matches = [];
    for (var laneKey in lanes) {
      if (!Object.prototype.hasOwnProperty.call(lanes, laneKey)) continue;
      var arr = lanes[laneKey];
      if (!Array.isArray(arr)) continue;
      for (var i = 0; i < arr.length; i++) {
        var hp = arr[i];
        if (hp && hp.opportunityId === oppId) {
          matches.push({ lane: laneKey, handoffPacket: hp });
        }
      }
    }
    return matches;
  }

  function _buildLaneHints(matches) {
    var lanes = [];
    var laneGates = {};
    var readyForGeneration = {};
    var forbiddenForLane = {};
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      lanes.push(m.lane);
      laneGates[m.lane] = m.handoffPacket.gateUsed || null;
      readyForGeneration[m.lane] = !!m.handoffPacket.readyForGeneration;
      forbiddenForLane[m.lane] = (FORBIDDEN_FOR_LANE[m.lane] || []).slice();
    }
    return {
      lanes: lanes,
      laneGates: laneGates,
      readyForGeneration: readyForGeneration,
      forbiddenForLane: forbiddenForLane
    };
  }

  function _buildAntiOverclaim(observatoryPacket, provenance, confInfo, activeDiagnoses, now, warnings) {
    var rank = (typeof observatoryPacket.rank === 'number') ? observatoryPacket.rank : null;
    var rankInBounds = (rank === null) ? false : (rank >= 0 && rank <= 1);

    var feedClassification = _aggregateFeedClassification(provenance);
    if (feedClassification === null && provenance.feedSources.length > 0) {
      warnings.push({
        code: 'NO_PROVENANCE',
        severity: 'warn',
        message: 'No live source in feedSources[].',
        field: 'anti_overclaim.feedClassification'
      });
    }

    var snapshotFresh = (provenance.snapshotTimestamp != null)
      ? ((now - provenance.snapshotTimestamp) < STALE_MS)
      : false;
    if (provenance.snapshotTimestamp != null && !snapshotFresh) {
      warnings.push({
        code: 'STALE_PRIMARY',
        severity: 'warn',
        message: 'Snapshot older than ' + STALE_MS + 'ms.',
        field: 'anti_overclaim.snapshotFresh'
      });
    }

    if (confInfo.clamped) {
      warnings.push({
        code: 'CONFIDENCE_CLAMPED',
        severity: 'info',
        message: 'confidence was clamped to [0,1] during normalization.',
        field: 'confidence.confidenceFraction'
      });
    }

    var evidenceSourceVerified = _isEvidenceSourceVerified(observatoryPacket, provenance, warnings);

    var diagnosisActive = false;
    if (Array.isArray(activeDiagnoses) && observatoryPacket.diagnosisId) {
      for (var di = 0; di < activeDiagnoses.length; di++) {
        if (activeDiagnoses[di] === observatoryPacket.diagnosisId) {
          diagnosisActive = true;
          break;
        }
      }
    }

    return {
      confidenceClamped:         confInfo.clamped,
      evidenceSourceVerified:    evidenceSourceVerified,
      noUnsupportedCausalClaims: false,
      feedClassification:        feedClassification,
      feedDivergence:            null,
      diagnosisActive:           diagnosisActive,
      rankInBounds:              rankInBounds,
      snapshotFresh:             snapshotFresh,
      warnings:                  warnings
    };
  }

  // ─── New helpers (D3-A3.5 / Path 2) ────────────────────────────────────

  // Unwrap HandoffPacket sourceDiagnoses into a deduped string[] of IDs.
  // handoff-contract.js produces objects { domain, id, label, ... }; older
  // callers may pass plain strings. Both are accepted.
  function _normalizeDiagnoses(sourceDiagnoses) {
    if (!Array.isArray(sourceDiagnoses)) return [];
    var out = [];
    var seen = {};
    for (var i = 0; i < sourceDiagnoses.length; i++) {
      var d = sourceDiagnoses[i];
      var id = null;
      if (typeof d === 'string') id = d;
      else if (d && typeof d === 'object' && typeof d.id === 'string') id = d.id;
      if (id && !seen[id]) { seen[id] = true; out.push(id); }
    }
    return out;
  }

  // Returns true if any sourceDiagnosis has active === true.
  // handoff-contract.js stamps `active` on each diagnosis from the brain's
  // diagnosis registry; this is the authoritative truth source. D3-A4.5
  // routes diagnosisActive through this rather than relying on the caller
  // to provide options.activeDiagnoses (which buildAll never populated).
  function _anyDiagnosisActive(sourceDiagnoses) {
    if (!Array.isArray(sourceDiagnoses)) return false;
    for (var i = 0; i < sourceDiagnoses.length; i++) {
      var d = sourceDiagnoses[i];
      if (d && typeof d === 'object' && d.active === true) return true;
    }
    return false;
  }

  // Extract the canonical node name for a HandoffPacket.
  // 1. supportingNodes[0].name (preferred — handoff-contract authority)
  // 2. summary regex /at\s+([A-Z0-9_]+)\s*\(([^)]+)\)/  (e.g., "active at OFC (Energy Trading)")
  // 3. else '' + NODE_UNRESOLVED warning
  function _extractNode(hp, warnings) {
    if (hp && Array.isArray(hp.supportingNodes) && hp.supportingNodes.length > 0) {
      var first = hp.supportingNodes[0];
      if (first && typeof first.name === 'string' && first.name.length > 0) {
        return first.name;
      }
    }
    if (hp && typeof hp.summary === 'string') {
      var m = hp.summary.match(/at\s+([A-Z0-9_]+)\s*\(([^)]+)\)/);
      if (m) return m[1];
    }
    warnings.push({
      code: 'NODE_UNRESOLVED',
      severity: 'warn',
      message: 'Could not extract node from supportingNodes or summary regex.',
      field: 'identity.node'
    });
    return '';
  }

  // Filter Observatory packets that enrich a given HandoffPacket.
  // Match tuple: (domain, lane→path, diagnosis ∈ normalized hp diagnoses).
  // Cap at ENRICHMENT_CAP. Warnings emitted per spec.
  function _findEnrichingObservatoryPackets(hp, observatoryPackets, warnings) {
    if (!Array.isArray(observatoryPackets) || observatoryPackets.length === 0) {
      warnings.push({
        code: 'NO_OBSERVATORY_ENRICHMENT',
        severity: 'info',
        message: 'No Observatory packets available for enrichment.',
        field: null
      });
      return [];
    }
    // D3-A3.7: distinguish "key absent" (genuinely unrecognized lane) from
    // "null value" (recognized lane with no Observatory fan-in path defined).
    // Use hasOwnProperty so falsy null doesn't get conflated with missing key.
    if (!Object.prototype.hasOwnProperty.call(LANE_TO_PATH, hp.lane)) {
      warnings.push({
        code: 'UNKNOWN_LANE_FOR_PATH_MAP',
        severity: 'warn',
        message: 'Lane "' + hp.lane + '" has no path mapping; enrichment skipped.',
        field: 'lane'
      });
      return [];
    }
    var path = LANE_TO_PATH[hp.lane];
    if (path === null) {
      warnings.push({
        code: 'NO_ENRICHMENT_PATH',
        severity: 'info',
        message: 'Lane "' + hp.lane + '" is recognized but has no Observatory fan-in path defined. Packet built from HandoffPacket alone.',
        field: 'lane'
      });
      return [];
    }
    var domain = (Array.isArray(hp.sourceDomains) && hp.sourceDomains.length > 0)
      ? hp.sourceDomains[0] : '';
    var diagnoses = _normalizeDiagnoses(hp.sourceDiagnoses);
    var matches = [];
    var capped = false;
    for (var i = 0; i < observatoryPackets.length; i++) {
      var obs = observatoryPackets[i];
      if (!obs) continue;
      if (obs.domain !== domain) continue;
      if (obs.path !== path) continue;
      if (!obs.diagnosisId || diagnoses.indexOf(obs.diagnosisId) === -1) continue;
      matches.push(obs);
      if (matches.length >= ENRICHMENT_CAP) { capped = true; break; }
    }
    if (capped) {
      warnings.push({
        code: 'ENRICHMENT_CAP_REACHED',
        severity: 'info',
        message: 'Observatory enrichment capped at ' + ENRICHMENT_CAP + ' for opportunityId "' + hp.opportunityId + '".',
        field: null
      });
    }
    return matches;
  }

  function _firstNonEmpty(matches, getter) {
    for (var i = 0; i < matches.length; i++) {
      var v = getter(matches[i]);
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  }

  function _aggregateStress(matches) {
    var max = null;
    for (var i = 0; i < matches.length; i++) {
      var s = (typeof matches[i].stress === 'number') ? matches[i].stress : null;
      if (s !== null && (max === null || s > max)) max = s;
    }
    return max;
  }

  // D3-A4.5: lane_hints.readyForGeneration is now gated by hard
  // anti_overclaim flags. Prior behavior passed hp.readyForGeneration
  // through verbatim, allowing a packet to claim readiness while its own
  // anti_overclaim flags contradicted it. Now: a packet is generation-ready
  // for its lane ONLY when handoff-contract's gate AND every hard
  // anti_overclaim flag passes. Failed gates are surfaced as explicit
  // warnings so D3-D verifier and D3-B AI expander cannot silently
  // proceed past contradictions.
  //
  // Hard gates (false → demotes readiness to false):
  //   - feedClassification === 'real' AND ≥1 live source → NO_LIVE_REAL_FEED
  //   - diagnosisActive         → DIAGNOSIS_NOT_ACTIVE
  //   - snapshotFresh           → SNAPSHOT_STALE
  //   - nodeResolved            → NODE_UNRESOLVED already pushed by _extractNode
  //
  // evidenceSourceVerified is preserved as an ADVISORY anti_overclaim flag,
  // not a hard gate. It measures whether brain-generated evidence prose
  // contains literal feed-name substrings against FEED_TOKENS — which
  // describes linguistic anchoring, not data realness. Hard-gating on it
  // would demote essentially every packet regardless of underlying data
  // quality. Data-shape truth-grounding (live + real classification on
  // feedSources[]) is the correct hard gate; prose-anchoring stays as a
  // verifier signal for D3-D / D3-B downstream.
  //
  // The original handoff-contract decision is preserved at
  // laneGates[lane].handoffReady; the failed-gate list at
  // laneGates[lane].failedAntiOverclaimGates lets verifiers see exactly
  // which gates demoted readiness.
  function _buildLaneHintsForHandoff(hp, antiOverclaim, provenance, warnings) {
    var lane = hp.lane;
    var laneGates = {};
    laneGates[lane] = { passed: hp.readyForGeneration === true };
    if (hp.gateUsed && typeof hp.gateUsed === 'object') {
      laneGates[lane].minEvidence = hp.gateUsed.minEvidence;
      laneGates[lane].minConfidence = hp.gateUsed.minConfidence;
    }

    var handoffReady = hp.readyForGeneration === true;
    var ready = handoffReady;
    var failedGates = [];

    if (antiOverclaim && handoffReady) {
      // Data-shape truth-grounding gate (D3-A4.5 revision): the domain
      // must have at least one live source and feedClassification must
      // be 'real'. This replaces the prose-anchoring evidenceSourceVerified
      // hard gate.
      var feedClassificationReal = (antiOverclaim.feedClassification === 'real');
      var hasLiveSource = !!(provenance && Array.isArray(provenance.feedSources)
        && provenance.feedSources.some(function (s) { return s && s.live === true; }));
      if (!feedClassificationReal || !hasLiveSource) {
        ready = false;
        failedGates.push('feedClassificationReal_or_hasLiveSource');
        if (Array.isArray(warnings)) {
          warnings.push({
            code: 'NO_LIVE_REAL_FEED',
            severity: 'warn',
            message: 'No live source with classification real for this domain.',
            field: 'provenance.feedSources'
          });
        }
      }
      if (antiOverclaim.diagnosisActive !== true) {
        ready = false;
        failedGates.push('diagnosisActive');
        if (Array.isArray(warnings)) {
          warnings.push({
            code: 'DIAGNOSIS_NOT_ACTIVE',
            severity: 'warn',
            message: 'diagnosisActive=false; readiness demoted. No source diagnosis on the HandoffPacket has active===true.',
            field: 'lane_hints.readyForGeneration'
          });
        }
      }
      if (antiOverclaim.snapshotFresh !== true) {
        ready = false;
        failedGates.push('snapshotFresh');
        if (Array.isArray(warnings)) {
          warnings.push({
            code: 'SNAPSHOT_STALE',
            severity: 'warn',
            message: 'snapshotFresh=false; readiness demoted. Snapshot is stale or its timestamp could not be resolved.',
            field: 'lane_hints.readyForGeneration'
          });
        }
      }
      if (antiOverclaim.nodeResolved !== true) {
        ready = false;
        failedGates.push('nodeResolved');
        // NODE_UNRESOLVED already emitted by _extractNode if applicable;
        // do not duplicate.
      }
    }

    laneGates[lane].handoffReady = handoffReady;
    laneGates[lane].failedAntiOverclaimGates = failedGates;

    var readyForGeneration = {};
    readyForGeneration[lane] = ready;
    var forbiddenForLane = {};
    forbiddenForLane[lane] = (FORBIDDEN_FOR_LANE[lane] || []).slice();
    return {
      lanes: [lane],
      laneGates: laneGates,
      readyForGeneration: readyForGeneration,
      forbiddenForLane: forbiddenForLane
    };
  }

  function _buildAntiOverclaimForHandoff(hp, primaryObs, nodeResolved, evidence, provenance, confInfo, activeDiagnoses, now, warnings) {
    var rank = (typeof confInfo.fraction === 'number') ? confInfo.fraction : null;
    if (primaryObs && typeof primaryObs.rank === 'number') {
      // Observatory rank is 0..1 already; take whichever is higher.
      if (rank === null || primaryObs.rank > rank) rank = primaryObs.rank;
    }
    var rankInBounds = (rank !== null && rank >= 0 && rank <= 1);

    var feedClassification = _aggregateFeedClassification(provenance);
    if (feedClassification === null && provenance.feedSources.length > 0) {
      warnings.push({
        code: 'NO_PROVENANCE',
        severity: 'warn',
        message: 'No live source in feedSources[].',
        field: 'anti_overclaim.feedClassification'
      });
    }

    var snapshotFresh = (provenance.snapshotTimestamp != null)
      ? ((now - provenance.snapshotTimestamp) < STALE_MS)
      : false;
    if (provenance.snapshotTimestamp != null && !snapshotFresh) {
      warnings.push({
        code: 'STALE_PRIMARY',
        severity: 'warn',
        message: 'Snapshot older than ' + STALE_MS + 'ms.',
        field: 'anti_overclaim.snapshotFresh'
      });
    }

    if (confInfo.clamped) {
      warnings.push({
        code: 'CONFIDENCE_CLAMPED',
        severity: 'info',
        message: 'confidence was clamped to [0,1] during normalization.',
        field: 'confidence.confidenceFraction'
      });
    }

    // Synthetic obs-shaped shim so we can reuse _isEvidenceSourceVerified
    // without duplicating its token-matching logic. The shim only exposes
    // the fields the verifier reads.
    var shim = {
      trigger:    evidence.trigger,
      validation: evidence.validation,
      outcome:    evidence.outcome,
      failure:    evidence.failure,
      explain:    evidence.explain,
      moneyChain: { evidence: evidence.moneyChainEvidence, whyPays: evidence.whyPays }
    };
    var evidenceSourceVerified = _isEvidenceSourceVerified(shim, provenance, warnings);

    // D3-A4.5: prefer reading diagnosis activity directly from the
    // HandoffPacket's sourceDiagnoses[].active field (the authoritative
    // source). Fall back to the legacy options.activeDiagnoses match for
    // any caller that still provides it explicitly (test injection).
    var diagnosisActive = _anyDiagnosisActive(hp.sourceDiagnoses);
    if (!diagnosisActive && Array.isArray(activeDiagnoses)) {
      var diagnoses = _normalizeDiagnoses(hp.sourceDiagnoses);
      for (var di = 0; di < diagnoses.length && !diagnosisActive; di++) {
        for (var ai = 0; ai < activeDiagnoses.length; ai++) {
          if (activeDiagnoses[ai] === diagnoses[di]) { diagnosisActive = true; break; }
        }
      }
    }

    return {
      confidenceClamped:         confInfo.clamped,
      evidenceSourceVerified:    evidenceSourceVerified,
      noUnsupportedCausalClaims: false,
      feedClassification:        feedClassification,
      feedDivergence:            null,
      diagnosisActive:           diagnosisActive,
      rankInBounds:              rankInBounds,
      snapshotFresh:             snapshotFresh,
      nodeResolved:              !!nodeResolved,
      warnings:                  warnings
    };
  }

  // ─── Public: buildFromHandoffPacket (PRIMARY, D3-A3.v2) ───────────────

  function buildFromHandoffPacket(hp, options) {
    if (!hp || typeof hp !== 'object') return null;
    if (!hp.opportunityId || !hp.lane
        || !Array.isArray(hp.sourceDomains)
        || !Array.isArray(hp.sourceDiagnoses)
        || !Array.isArray(hp.supportingNodes)) {
      try { console.info('[ArtifactPacketBuilder] HandoffPacket missing required fields:', hp); } catch (_) {}
      return null;
    }

    var opts = options || {};
    var now = (typeof opts.now === 'number') ? opts.now : Date.now();
    var snapshot = _resolveSnapshot(opts);
    var observatoryPackets = Array.isArray(opts.observatoryPackets)
      ? opts.observatoryPackets
      : ((typeof window !== 'undefined' && window.LIMENObservatory
          && typeof window.LIMENObservatory.getPackets === 'function')
         ? (window.LIMENObservatory.getPackets() || [])
         : []);
    var activeConditions = Array.isArray(opts.activeConditions) ? opts.activeConditions.slice() : [];
    var activeDiagnoses  = Array.isArray(opts.activeDiagnoses)  ? opts.activeDiagnoses.slice()  : null;

    // Initial warnings — supports buildAll injecting SCHEMA_VERSION_BUMPED
    // into the first packet's warnings. Always slice to avoid mutating
    // the shared seed array.
    var warnings = Array.isArray(opts._initialWarnings) ? opts._initialWarnings.slice() : [];

    // Find enriching observatory packets (may emit warnings).
    var matches = _findEnrichingObservatoryPackets(hp, observatoryPackets, warnings);
    var primaryObs = matches.length > 0 ? matches[0] : null;

    // identity (D3-A3.v3 — id is composite '<sourceOpp>::<lane>'; original
    // handoff opportunityId preserved at sourceOpportunityId)
    var node = _extractNode(hp, warnings);
    var diagnoses = _normalizeDiagnoses(hp.sourceDiagnoses);
    var domain = hp.sourceDomains.length > 0 ? hp.sourceDomains[0] : '';
    var sourceOpportunityId = hp.opportunityId;
    var compositeId = sourceOpportunityId + '::' + hp.lane;
    var identity = {
      id:                  compositeId,
      sourceOpportunityId: sourceOpportunityId,
      domain:              domain,
      rawDomain:           domain,
      title:               hp.summary || '',
      node:                node,
      lane:                hp.lane,
      diagnoses:           diagnoses,
      diagnosisId:         diagnoses.length > 0 ? diagnoses[0] : '',
      playbookId:          primaryObs && primaryObs.playbookId ? primaryObs.playbookId : '',
      domainTemplateOf:    domain,
      domainTier:          primaryObs && typeof primaryObs.tier === 'number' ? primaryObs.tier : null
    };

    // signal — aggregated across matches; null fallbacks when no enrichment
    var stress = _aggregateStress(matches);
    var signal = {
      stress:           stress !== null ? stress : 0,
      stressBand:       _stressBand(stress),
      urgency:          primaryObs ? (primaryObs.urgency || '') : '',
      whyNow:           primaryObs ? (primaryObs.whyNow || '') : '',
      activeConditions: activeConditions,
      valueRange:       primaryObs ? (primaryObs.valueRange || '') : '',
      window:           primaryObs ? (primaryObs.window || '') : ''
    };

    // D3-A3.v3.2 — Reverted the v3.1 placeholder fallback. v3.1 synthesized
    // template strings like "Develop intervention for <dx> at <node>" to
    // make the server-side INSUFFICIENT_PACKET_DETAIL gate stop firing.
    // Those template strings propagated through /api/expand-artifact into
    // OpenAI prompts and into the MB-D finalized doc as if they were real
    // patent invention text. They were not.
    //
    // The correct approach: emit empty strings here when Observatory
    // enrichment is missing; let downstream council enrichment (see
    // _councilEnrichWithDirectives in console-clarity.js) populate
    // evidence + implementation from the actual corpus (deep directives
    // at /assets/data/deep/{d}-deep-directives.json) before posting to
    // /api/expand-artifact. Honest 422 INSUFFICIENT_PACKET_DETAIL is
    // preferable to polished placeholder fluff.

    function getMcEv(o) { return (o && o.moneyChain && o.moneyChain.evidence) || ''; }
    function getMcWp(o) { return (o && o.moneyChain && o.moneyChain.whyPays) || ''; }

    // evidence — first non-empty across matches; trigger fallback to hp.summary
    var evidence = {
      trigger:            _firstNonEmpty(matches, function (o) { return o.trigger || ''; }) || (hp.summary || ''),
      validation:         _firstNonEmpty(matches, function (o) { return o.validation || ''; }),
      outcome:            _firstNonEmpty(matches, function (o) { return o.outcome || ''; }),
      failure:            _firstNonEmpty(matches, function (o) { return o.failure || ''; }),
      moneyChainEvidence: _firstNonEmpty(matches, getMcEv),
      whyPays:            _firstNonEmpty(matches, getMcWp),
      explain:            _firstNonEmpty(matches, function (o) { return o.explain || ''; })
    };

    // implementation — derived from primaryObs (D2-C parity preserved).
    // implementationsList uses byte-identical _buildImplementations on the
    // first matched Observatory packet.
    var pmc = primaryObs && primaryObs.moneyChain ? primaryObs.moneyChain : {};
    var implementation = {
      action:              primaryObs ? (primaryObs.action || '') : '',
      doThis:              pmc.doThis || '',
      nextStep:            pmc.nextStep || '',
      target:              pmc.target || '',
      timing:              pmc.timing || '',
      invalidIf:           pmc.invalidIf || '',
      implementationsList: primaryObs ? _buildImplementations(primaryObs) : []
    };

    // confidence — hp.confidence (0..1) drives, primaryObs.rank lifts if higher
    var confInfo = _normalizeConfidence(hp);
    var rank = confInfo.fraction;
    if (primaryObs && typeof primaryObs.rank === 'number' && primaryObs.rank > rank) {
      rank = primaryObs.rank;
    }
    var evidenceQuality = (typeof hp.evidenceQuality === 'number') ? hp.evidenceQuality : null;
    var confidence = {
      confidencePercent:  confInfo.percent,
      confidenceFraction: confInfo.fraction,
      rank:               rank,
      evidenceQuality:    evidenceQuality
    };

    // provenance (refactored to take domain directly)
    var provenance = _buildProvenance(domain, snapshot, activeConditions, now, warnings);

    // anti_overclaim (D3-A3.v2 — nodeResolved added)
    var antiOverclaim = _buildAntiOverclaimForHandoff(
      hp, primaryObs, !!node, evidence, provenance, confInfo, activeDiagnoses, now, warnings
    );

    // lane_hints — single-lane (node-level packets are lane-bound).
    // D3-A4.5: readyForGeneration is gated by hard anti_overclaim flags,
    // so antiOverclaim must already be computed and passed in. Failed
    // gates push warnings into the same warnings array used by the rest
    // of this build call.
    var laneHints = _buildLaneHintsForHandoff(hp, antiOverclaim, provenance, warnings);

    // raw — clones so deep-freeze never touches caller refs.
    // matchingHandoffPackets retained for backward-compat with D3-A1 callers
    // (single-element array containing self).
    var raw = {
      handoffPacket:          _safeClone(hp),
      observatoryPackets:     matches.map(function (m) { return _safeClone(m); }),
      matchingHandoffPackets: [_safeClone(hp)]
    };

    var packet = {
      packetSchemaVersion: SCHEMA_VERSION,
      builtAt:             now,
      sourcePacketId:      identity.id,
      identity:            identity,
      signal:              signal,
      evidence:            evidence,
      implementation:      implementation,
      confidence:          confidence,
      anti_overclaim:      antiOverclaim,
      provenance:          provenance,
      lane_hints:          laneHints,
      deepBrain:           (hp && hp.deepBrain) || null,   // F0: recurrent brain model survives to the finalizer
      raw:                 raw
    };

    return _deepFreeze(packet);
  }

  // ─── Public: buildFromObservatoryPacket (DEPRECATED, retained for compat) ──

  function buildFromObservatoryPacket(observatoryPacket, options) {
    if (!observatoryPacket || typeof observatoryPacket !== 'object') return null;

    var opts = options || {};
    var now = (typeof opts.now === 'number') ? opts.now : Date.now();
    var snapshot = _resolveSnapshot(opts);
    var handoffState = opts.handoffState
      || (typeof window !== 'undefined' ? window.LIMENMainBrainHandoffState : null)
      || null;
    var activeConditions = Array.isArray(opts.activeConditions) ? opts.activeConditions.slice() : [];
    var activeDiagnoses  = Array.isArray(opts.activeDiagnoses)  ? opts.activeDiagnoses.slice()  : null;

    // Initial warnings — supports buildForOpportunityId injecting
    // DEPRECATED_OBSERVATORY_ID_LOOKUP into the returned packet's warnings
    // when the caller passed an Observatory id instead of a Handoff
    // opportunityId. Mirrors the SCHEMA_VERSION_BUMPED injection pattern in
    // buildAll. Always slice to avoid mutating the shared seed array.
    var warnings = Array.isArray(opts._initialWarnings) ? opts._initialWarnings.slice() : [];
    warnings.push({
      code: 'DEPRECATED_OBSERVATORY_DRIVEN_BUILD',
      severity: 'info',
      message: 'buildFromObservatoryPacket is deprecated; prefer buildFromHandoffPacket.',
      field: null
    });

    var domain = observatoryPacket.domain || '';

    // identity (D3-A3.v3 shape — node/lane unknown from obs alone). The
    // deprecated path uses an explicit 'observatory-deprecated' sentinel
    // instead of empty lane so downstream consumers that split identity.id
    // on '::' don't get a trailing empty token. The sentinel is greppable
    // and globally unique relative to handoff-driven packets (no real lane
    // is named 'observatory-deprecated'). DEPRECATED_OBSERVATORY_DRIVEN_BUILD
    // warning already fires on this path.
    var sourceOpportunityIdObs = observatoryPacket.id || '';
    var deprecatedLaneToken = observatoryPacket.lane || 'observatory-deprecated';
    var compositeIdObs = sourceOpportunityIdObs + '::' + deprecatedLaneToken;
    var identity = {
      id:                  compositeIdObs,
      sourceOpportunityId: sourceOpportunityIdObs,
      domain:              domain,
      rawDomain:           observatoryPacket.rawDomain || '',
      title:               observatoryPacket.title || '',
      node:                '',
      lane:                '',
      diagnoses:           observatoryPacket.diagnosisId ? [observatoryPacket.diagnosisId] : [],
      diagnosisId:         observatoryPacket.diagnosisId || '',
      playbookId:          observatoryPacket.playbookId || '',
      domainTemplateOf:    domain,
      domainTier:          (typeof observatoryPacket.tier === 'number') ? observatoryPacket.tier : null
    };

    var signal = {
      stress:           (typeof observatoryPacket.stress === 'number') ? observatoryPacket.stress : 0,
      stressBand:       _stressBand(observatoryPacket.stress),
      urgency:          observatoryPacket.urgency || '',
      whyNow:           observatoryPacket.whyNow || '',
      activeConditions: activeConditions,
      valueRange:       observatoryPacket.valueRange || '',
      window:           observatoryPacket.window || ''
    };

    var mc = observatoryPacket.moneyChain || {};
    var evidence = {
      trigger:            observatoryPacket.trigger || '',
      validation:         observatoryPacket.validation || '',
      outcome:            observatoryPacket.outcome || '',
      failure:            observatoryPacket.failure || '',
      moneyChainEvidence: mc.evidence || '',
      whyPays:            mc.whyPays || '',
      explain:            observatoryPacket.explain || ''
    };

    var implementation = {
      action:              observatoryPacket.action || '',
      doThis:              mc.doThis || '',
      nextStep:            mc.nextStep || '',
      target:              mc.target || '',
      timing:              mc.timing || '',
      invalidIf:           mc.invalidIf || '',
      implementationsList: _buildImplementations(observatoryPacket)
    };

    var confInfo = _normalizeConfidence(observatoryPacket);
    var matches = _findMatchingHandoffPackets(observatoryPacket, handoffState);
    var evidenceQuality = null;
    if (matches.length > 0 && typeof matches[0].handoffPacket.evidenceQuality === 'number') {
      evidenceQuality = matches[0].handoffPacket.evidenceQuality;
    } else {
      warnings.push({
        code: 'NO_HANDOFF_MATCH',
        severity: 'warn',
        message: 'No HandoffPacket found for opportunityId "' + identity.id + '".',
        field: 'lane_hints'
      });
    }

    var confidence = {
      confidencePercent:  confInfo.percent,
      confidenceFraction: confInfo.fraction,
      rank:               (typeof observatoryPacket.rank === 'number') ? observatoryPacket.rank : null,
      evidenceQuality:    evidenceQuality
    };

    var provenance = _buildProvenance(domain, snapshot, activeConditions, now, warnings);
    var antiOverclaim = _buildAntiOverclaim(observatoryPacket, provenance, confInfo, activeDiagnoses, now, warnings);

    // Pad anti_overclaim with nodeResolved=false for D3-A3.v2 shape parity.
    var antiWithNode = {
      confidenceClamped:         antiOverclaim.confidenceClamped,
      evidenceSourceVerified:    antiOverclaim.evidenceSourceVerified,
      noUnsupportedCausalClaims: antiOverclaim.noUnsupportedCausalClaims,
      feedClassification:        antiOverclaim.feedClassification,
      feedDivergence:            antiOverclaim.feedDivergence,
      diagnosisActive:           antiOverclaim.diagnosisActive,
      rankInBounds:              antiOverclaim.rankInBounds,
      snapshotFresh:             antiOverclaim.snapshotFresh,
      nodeResolved:              false,
      warnings:                  antiOverclaim.warnings
    };

    var laneHints = _buildLaneHints(matches);

    var raw = {
      observatoryPacket:      _safeClone(observatoryPacket),
      matchingHandoffPackets: matches.map(function (m) { return _safeClone(m.handoffPacket); })
    };

    var packet = {
      packetSchemaVersion: SCHEMA_VERSION,
      builtAt:             now,
      sourcePacketId:      identity.id,
      identity:            identity,
      signal:              signal,
      evidence:            evidence,
      implementation:      implementation,
      confidence:          confidence,
      anti_overclaim:      antiWithNode,
      provenance:          provenance,
      lane_hints:          laneHints,
      raw:                 raw
    };

    return _deepFreeze(packet);
  }

  // ─── Public: buildForOpportunityId ─────────────────────────────────────
  // Search HandoffPackets first (D3-A3.5 primary). If not found, fall back
  // to Observatory lookup (deprecated path; emits DEPRECATED_OBSERVATORY_ID_LOOKUP
  // via console.info, plus DEPRECATED_OBSERVATORY_DRIVEN_BUILD inside the
  // returned packet's warnings).
  /**
   * Look up an ArtifactPacket by id.
   *
   * D3-A3.v3 accepts EITHER form for `opportunityId`:
   *   - Composite id: '<sourceOpportunityId>::<lane>' (e.g., 'opp-X::patents').
   *     Resolves uniquely to the matching node-level ArtifactPacket.
   *   - Plain sourceOpportunityId (e.g., 'opp-X'). AMBIGUOUS when the source
   *     fans out across multiple lanes — returns the FIRST match found in
   *     iteration order. For unique resolution, pass the full composite id.
   *
   * Falls back to Observatory lookup (deprecated path) if the input doesn't
   * match any HandoffPacket; emits DEPRECATED_OBSERVATORY_ID_LOOKUP and
   * DEPRECATED_OBSERVATORY_DRIVEN_BUILD warnings on the returned packet.
   */
  function buildForOpportunityId(opportunityId, options) {
    if (typeof window === 'undefined') return null;

    var opts = options || {};
    var handoffState = opts.handoffState || window.LIMENMainBrainHandoffState || null;

    // Parse composite vs plain form.
    var targetSourceOpp = opportunityId;
    var targetLane = null;
    var sepIdx = (typeof opportunityId === 'string') ? opportunityId.indexOf('::') : -1;
    if (sepIdx > 0) {
      targetSourceOpp = opportunityId.substring(0, sepIdx);
      targetLane = opportunityId.substring(sepIdx + 2);
    }

    if (handoffState && handoffState.lanes && typeof handoffState.lanes === 'object') {
      var lanes = handoffState.lanes;
      for (var laneKey in lanes) {
        if (!Object.prototype.hasOwnProperty.call(lanes, laneKey)) continue;
        if (targetLane !== null && laneKey !== targetLane) continue;
        var arr = lanes[laneKey];
        if (!Array.isArray(arr)) continue;
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] && arr[i].opportunityId === targetSourceOpp) {
            return buildFromHandoffPacket(arr[i], options);
          }
        }
      }
    }

    if (window.LIMENObservatory && typeof window.LIMENObservatory.getPackets === 'function') {
      var packets = window.LIMENObservatory.getPackets() || [];
      for (var j = 0; j < packets.length; j++) {
        if (packets[j] && packets[j].id === targetSourceOpp) {
          try { console.info('[ArtifactPacketBuilder] DEPRECATED_OBSERVATORY_ID_LOOKUP for "' + opportunityId + '"'); } catch (_) {}
          // Inject DEPRECATED_OBSERVATORY_ID_LOOKUP into the returned
          // packet's warnings so D3-D verifier can pattern-match without
          // reading console output. Caller's options are preserved; a new
          // options object is built so opts._initialWarnings doesn't leak
          // back into the caller.
          var fallbackOpts = {
            now:                opts.now,
            snapshot:           _resolveSnapshot(opts),
            handoffState:       opts.handoffState,
            activeConditions:   opts.activeConditions,
            activeDiagnoses:    opts.activeDiagnoses,
            _initialWarnings: [{
              code: 'DEPRECATED_OBSERVATORY_ID_LOOKUP',
              severity: 'info',
              message: 'Caller passed an Observatory packet ID instead of a HandoffPacket opportunityId. Falling back to deprecated Observatory-driven build.',
              field: null
            }]
          };
          return buildFromObservatoryPacket(packets[j], fallbackOpts);
        }
      }
    }

    return null;
  }

  // ─── Public: buildAll ─────────────────────────────────────────────────
  // Iterates all HandoffPackets across all lanes. Returns ArtifactPacket[]
  // of length === HandoffPacket count. Empty array when handoff state is
  // unavailable (no warnings — page hasn't loaded handoff state yet).

  function buildAll(options) {
    if (typeof window === 'undefined') return [];

    var opts = options || {};
    var handoffState = opts.handoffState || window.LIMENMainBrainHandoffState || null;
    if (!handoffState || !handoffState.lanes || typeof handoffState.lanes !== 'object') return [];

    var observatoryPackets = Array.isArray(opts.observatoryPackets)
      ? opts.observatoryPackets
      : ((window.LIMENObservatory && typeof window.LIMENObservatory.getPackets === 'function')
         ? (window.LIMENObservatory.getPackets() || [])
         : []);

    // Per-call options shared across all packets.
    // Resolve snapshot once at the top — passed into every per-packet build
    // so getSnapshot()/getDomain() aren't re-invoked per packet.
    var resolvedSnapshot = _resolveSnapshot(opts);
    var sharedOpts = {
      now:                 opts.now,
      snapshot:            resolvedSnapshot,
      handoffState:        handoffState,
      observatoryPackets:  observatoryPackets,
      activeConditions:    opts.activeConditions,
      activeDiagnoses:     opts.activeDiagnoses
    };

    // SCHEMA_VERSION_BUMPED: inject into the first packet's warnings on the
    // first buildAll call per page load.
    var schemaWarning = null;
    if (!_schemaWarningEmitted) {
      schemaWarning = {
        code: 'SCHEMA_VERSION_BUMPED',
        severity: 'info',
        message: 'ArtifactPacket schema bumped to ' + SCHEMA_VERSION + ' (D3-A3.v3 — identity.id is now composite "<sourceOpportunityId>::<lane>"; original opportunityId preserved at identity.sourceOpportunityId).',
        field: 'packetSchemaVersion'
      };
      _schemaWarningEmitted = true;
      try { console.info('[ArtifactPacketBuilder] SCHEMA_VERSION_BUMPED → ' + SCHEMA_VERSION); } catch (_) {}
    }

    var lanes = handoffState.lanes;
    var out = [];
    var firstInjected = false;
    for (var laneKey in lanes) {
      if (!Object.prototype.hasOwnProperty.call(lanes, laneKey)) continue;
      var arr = lanes[laneKey];
      if (!Array.isArray(arr)) continue;
      for (var i = 0; i < arr.length; i++) {
        var hp = arr[i];
        if (!hp) continue;

        var perCallOpts = sharedOpts;
        if (schemaWarning && !firstInjected) {
          perCallOpts = {
            now:                sharedOpts.now,
            snapshot:           sharedOpts.snapshot,
            handoffState:       sharedOpts.handoffState,
            observatoryPackets: sharedOpts.observatoryPackets,
            activeConditions:   sharedOpts.activeConditions,
            activeDiagnoses:    sharedOpts.activeDiagnoses,
            _initialWarnings:   [schemaWarning]
          };
        }

        var ap = buildFromHandoffPacket(hp, perCallOpts);
        if (ap) {
          out.push(ap);
          if (schemaWarning && !firstInjected) firstInjected = true;
        }
      }
    }

    return out;
  }

  // ─── D3-G.1 — Async deep-source enrichment ─────────────────────────
  //
  // buildAll() must remain SYNCHRONOUS — callers depend on it returning
  // packets immediately for in-page UI rendering. Deep-source bundles
  // load asynchronously over the network (static JSON fetch), so the
  // enrichment surface is exposed as a separate async path.
  //
  // Shape:
  //   - enrichWithDeepSource(packet)  → Promise<{ ok, packet }>
  //   - buildAllWithDeepSource(opts)  → Promise<packet[]> (best-effort
  //     enrichment per packet; failures leave packet unchanged with
  //     deepSource absent — same as today's behavior).
  //
  // Both delegate to window.LIMENArtifactSourceIndex when present.
  // When the client module is missing, both functions are no-ops that
  // return packets unchanged. NO portal recursion. NO full-corpus
  // scan. NO server write. Bundle absence is reported but not fatal.
  function enrichWithDeepSource(packet) {
    if (!packet || typeof packet !== 'object') return Promise.resolve({ ok: false, code: 'INVALID_PACKET' });
    if (typeof window === 'undefined' || !window.LIMENArtifactSourceIndex) {
      return Promise.resolve({ ok: false, code: 'CLIENT_NOT_LOADED', packet: packet });
    }
    return window.LIMENArtifactSourceIndex.enrichPacket(packet).then(function (r) {
      return r;
    }, function (err) {
      return { ok: false, code: 'CLIENT_THREW', message: (err && err.message) || '', packet: packet };
    });
  }

  function buildAllWithDeepSource(options) {
    var packets = buildAll(options);
    if (!Array.isArray(packets) || !packets.length) return Promise.resolve(packets || []);
    if (typeof window === 'undefined' || !window.LIMENArtifactSourceIndex) {
      return Promise.resolve(packets);
    }
    var pending = packets.map(function (p) {
      return enrichWithDeepSource(p).then(function () { return p; },
                                          function () { return p; });
    });
    return Promise.all(pending);
  }

  if (typeof window !== 'undefined') {
    window.LIMENArtifactPacketBuilder = {
      schemaVersion:              SCHEMA_VERSION,
      buildForOpportunityId:      buildForOpportunityId,
      buildFromHandoffPacket:     buildFromHandoffPacket,
      buildFromObservatoryPacket: buildFromObservatoryPacket,
      buildFromPacket:            buildFromObservatoryPacket,   // D3-A1 backward-compat alias
      buildAll:                   buildAll,
      buildAllWithDeepSource:     buildAllWithDeepSource,       // D3-G.1
      enrichWithDeepSource:       enrichWithDeepSource,         // D3-G.1
      validateShape:              _validateShape
    };
  }
})();
