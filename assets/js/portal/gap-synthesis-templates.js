/**
 * gap-synthesis-templates.js — Phase 25G
 *
 * Domain-specific diagnosis/treatment/drill-deeper templates.
 * Structured data — no logic. Consumed by limen-gap-synthesis-engine.js.
 *
 * Each diagnosis template:
 *   titlePattern, mechanismPattern, triggerConditions, nodeAffinity, businessAffinity
 *
 * Each treatment level:
 *   titlePattern, actionPattern, mechanismPattern, whoExecutes, timeHorizon
 *
 * Full templates: energy, supplyChain, defense, finance, health, agriculture
 * Stub templates: remaining 14 domains
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSIS TEMPLATES PER DOMAIN
  // triggerConditions: matched against active event families + stress signals
  // ══════════════════════════════════════════════════════════════════════

  var DIAGNOSIS_TEMPLATES = {
    energy: [
      { titlePattern: 'Fuel Distribution Instability', mechanismPattern: 'Fuel supply pathways are disrupted by upstream production constraints, refinery bottlenecks, or distribution infrastructure failures, creating cascading delivery shortfalls.', triggerConditions: ['OIL_SHOCK', 'REFINERY_ATTACK', 'crude_elevated'], nodeAffinity: ['NTS', 'THAL', 'ENS'], businessAffinity: ['fuel logistics', 'refinery operations', 'distribution networks'] },
      { titlePattern: 'Grid Resilience Failure', mechanismPattern: 'Power grid infrastructure cannot absorb demand surges or supply interruptions, leading to rolling capacity deficits and reliability degradation.', triggerConditions: ['energy_stress_high', 'infrastructure_stress'], nodeAffinity: ['THAL', 'dlPFC', 'GP'], businessAffinity: ['grid operators', 'utility companies', 'energy storage'] },
      { titlePattern: 'Energy Price Transmission Shock', mechanismPattern: 'Upstream energy price spikes propagate through dependent sectors (transport, manufacturing, agriculture) faster than downstream price adjustments can absorb.', triggerConditions: ['OIL_SHOCK', 'crude_elevated', 'cross_domain_energy'], nodeAffinity: ['BLA', 'vmPFC', 'NAcc'], businessAffinity: ['energy trading', 'commodity hedging', 'industrial consumers'] },
      { titlePattern: 'Chokepoint Dependency Exposure', mechanismPattern: 'Critical energy transit routes (straits, pipelines, port facilities) face elevated threat, revealing single-point-of-failure dependencies in supply architecture.', triggerConditions: ['STRAIT_DISRUPTION', 'PORT_DISRUPTION', 'TANKER_THREAT'], nodeAffinity: ['NTS', 'PAG', 'dACC'], businessAffinity: ['marine logistics', 'pipeline operators', 'risk monitoring'] },
      { titlePattern: 'Insurance Withdrawal Cascade', mechanismPattern: 'War risk or environmental hazard reclassification causes insurers to withdraw coverage from energy assets, freezing operations and investment.', triggerConditions: ['STRAIT_DISRUPTION', 'MILITARY_ESCALATION', 'energy_stress_high'], nodeAffinity: ['vmPFC', 'BLA', 'dlPFC'], businessAffinity: ['insurance', 'risk analytics', 'asset management'] }
    ],
    supplyChain: [
      { titlePattern: 'Maritime Routing Breakdown', mechanismPattern: 'Shipping lanes and vessel routing are destabilized by conflict-zone disruption, insurance withdrawal, and chokepoint uncertainty, impairing global cargo flow.', triggerConditions: ['STRAIT_DISRUPTION', 'PORT_DISRUPTION', 'TANKER_THREAT', 'NAVAL_THREAT'], nodeAffinity: ['NTS', 'ENS', 'VTA'], businessAffinity: ['routing analytics', 'marine logistics', 'risk monitoring'] },
      { titlePattern: 'Freight Cost Acceleration', mechanismPattern: 'Transportation costs escalate beyond absorption capacity as fuel surcharges, rerouting premiums, and capacity scarcity compound simultaneously.', triggerConditions: ['freight_elevated', 'OIL_SHOCK', 'supply_stress_high'], nodeAffinity: ['THAL', 'dlPFC', 'NAcc'], businessAffinity: ['freight brokers', 'logistics platforms', 'supply chain finance'] },
      { titlePattern: 'Inventory Buffer Depletion', mechanismPattern: 'Safety stock and buffer inventory across supply chains erode under sustained disruption, leaving downstream operations vulnerable to any additional shock.', triggerConditions: ['supply_stress_high', 'supply_persistent'], nodeAffinity: ['HIPP', 'vmPFC', 'ENS'], businessAffinity: ['inventory management', 'demand planning', 'warehouse operations'] },
      { titlePattern: 'Last-Mile Delivery Fracture', mechanismPattern: 'Final delivery networks fragment under capacity constraints, labor shortages, or infrastructure degradation, creating systematic fulfillment failures.', triggerConditions: ['supply_stress_high', 'infrastructure_stress'], nodeAffinity: ['ENS', 'GP', 'M1'], businessAffinity: ['delivery platforms', 'fulfillment centers', 'fleet management'] },
      { titlePattern: 'Supplier Concentration Risk', mechanismPattern: 'Critical inputs depend on a small number of suppliers in vulnerable geographies, creating systemic single-source failure exposure.', triggerConditions: ['cross_domain_supply', 'SANCTIONS', 'supply_stress_high'], nodeAffinity: ['dlPFC', 'dACC', 'THAL'], businessAffinity: ['procurement analytics', 'supplier diversification', 'trade compliance'] }
    ],
    defense: [
      { titlePattern: 'Escalation Cascade', mechanismPattern: 'Military actions trigger retaliatory sequences across multiple theaters, creating compounding threat multiplication that outpaces diplomatic response capacity.', triggerConditions: ['MILITARY_ESCALATION', 'MISSILE_ATTACK', 'AIRSTRIKE'], nodeAffinity: ['PAG', 'BLA', 'dACC'], businessAffinity: ['defense contractors', 'intelligence platforms', 'situational awareness'] },
      { titlePattern: 'Strait Control Disruption', mechanismPattern: 'Naval chokepoints face contested access, disrupting commercial shipping and energy transit while elevating insurance and rerouting costs.', triggerConditions: ['STRAIT_DISRUPTION', 'NAVAL_THREAT', 'TANKER_THREAT'], nodeAffinity: ['NTS', 'THAL', 'PAG'], businessAffinity: ['maritime security', 'naval logistics', 'defense intelligence'] },
      { titlePattern: 'Cyber-Physical Infrastructure Attack', mechanismPattern: 'Critical infrastructure faces combined cyber and physical attack vectors, degrading operational capacity across energy, communications, and transport systems.', triggerConditions: ['CYBER_ATTACK', 'REFINERY_ATTACK', 'cross_domain_defense'], nodeAffinity: ['dlPFC', 'THAL', 'dACC'], businessAffinity: ['cybersecurity', 'infrastructure protection', 'incident response'] },
      { titlePattern: 'Nuclear Threat Escalation', mechanismPattern: 'Nuclear posturing or deployment threats create existential risk assessment failures across all planning horizons, paralyzing normal decision-making.', triggerConditions: ['NUCLEAR_THREAT', 'MILITARY_ESCALATION'], nodeAffinity: ['BLA', 'PAG', 'vmPFC'], businessAffinity: ['defense policy', 'nuclear monitoring', 'crisis management'] }
    ],
    finance: [
      { titlePattern: 'Volatility Regime Shift', mechanismPattern: 'Market volatility transitions from contained to structural, invalidating risk models calibrated to prior regime and exposing unhedged positions.', triggerConditions: ['finance_stress_high', 'cross_domain_finance', 'SANCTIONS'], nodeAffinity: ['BLA', 'vmPFC', 'NAcc'], businessAffinity: ['risk analytics', 'volatility products', 'portfolio management'] },
      { titlePattern: 'Credit Transmission Freeze', mechanismPattern: 'Interbank lending and commercial credit channels constrict as counterparty risk perception spikes, starving operating businesses of working capital.', triggerConditions: ['finance_stress_high', 'economy_stress'], nodeAffinity: ['vmPFC', 'dlPFC', 'HIPP'], businessAffinity: ['credit analytics', 'trade finance', 'banking operations'] },
      { titlePattern: 'Commodity Price Dislocation', mechanismPattern: 'Commodity prices decouple from fundamental supply-demand dynamics due to geopolitical risk premium, speculation, or sanctions, creating unpredictable cost environments.', triggerConditions: ['OIL_SHOCK', 'SANCTIONS', 'cross_domain_finance'], nodeAffinity: ['THAL', 'NAcc', 'BLA'], businessAffinity: ['commodity trading', 'hedging platforms', 'supply chain finance'] },
      { titlePattern: 'Capital Flight Acceleration', mechanismPattern: 'Investment capital exits vulnerable markets faster than stabilization measures can respond, creating self-reinforcing withdrawal dynamics.', triggerConditions: ['finance_stress_high', 'MILITARY_ESCALATION', 'SANCTIONS'], nodeAffinity: ['BLA', 'PAG', 'vmPFC'], businessAffinity: ['capital markets', 'fund management', 'sovereign risk'] }
    ],
    health: [
      { titlePattern: 'Medical Supply Chain Fracture', mechanismPattern: 'Pharmaceutical and medical device supply chains are disrupted by upstream manufacturing concentration, logistics failures, or regulatory bottlenecks.', triggerConditions: ['health_stress_elevated', 'supply_stress', 'cross_domain_health'], nodeAffinity: ['NTS', 'ENS', 'AI'], businessAffinity: ['pharma distribution', 'medical devices', 'hospital procurement'] },
      { titlePattern: 'Adverse Event Surveillance Gap', mechanismPattern: 'Drug safety monitoring systems are overwhelmed by volume or complexity, creating detection delays for emerging safety signals.', triggerConditions: ['fda_events_elevated', 'health_stress_elevated'], nodeAffinity: ['AI', 'dACC', 'dlPFC'], businessAffinity: ['pharmacovigilance', 'clinical data platforms', 'regulatory compliance'] },
      { titlePattern: 'Healthcare Capacity Saturation', mechanismPattern: 'Hospital and clinic systems reach capacity limits under sustained demand, degrading care quality and creating triage failures.', triggerConditions: ['health_stress_high', 'population_stress'], nodeAffinity: ['THAL', 'PAG', 'NTS'], businessAffinity: ['hospital operations', 'telemedicine', 'capacity planning'] }
    ],
    agriculture: [
      { titlePattern: 'Agricultural Input Delivery Fracture', mechanismPattern: 'Fertilizer, seed, or equipment delivery networks are disrupted by upstream supply constraints or logistics failures, threatening planting windows and yield potential.', triggerConditions: ['agriculture_stress', 'supply_stress', 'FOOD_CRISIS'], nodeAffinity: ['ENS', 'NTS', 'THAL'], businessAffinity: ['agricultural inputs', 'farm equipment', 'logistics'] },
      { titlePattern: 'Crop Insurance Market Instability', mechanismPattern: 'Weather volatility and yield uncertainty outpace actuarial models, causing insurance premium spikes or coverage withdrawal for vulnerable regions.', triggerConditions: ['agriculture_stress', 'environment_stress', 'climate_elevated'], nodeAffinity: ['vmPFC', 'BLA', 'HIPP'], businessAffinity: ['crop insurance', 'agricultural finance', 'risk modeling'] },
      { titlePattern: 'Food Price Transmission Shock', mechanismPattern: 'Agricultural commodity price spikes propagate to consumer food prices faster than income adjustments, creating food security stress in vulnerable populations.', triggerConditions: ['FOOD_CRISIS', 'OIL_SHOCK', 'agriculture_stress'], nodeAffinity: ['NTS', 'AI', 'PAG'], businessAffinity: ['food distribution', 'commodity trading', 'social services'] }
    ],

    // Stub templates for remaining domains (1-2 templates each)
    technology:      [{ titlePattern: 'Technology Supply Concentration Risk', mechanismPattern: 'Critical technology components depend on concentrated manufacturing in vulnerable regions.', triggerConditions: ['technology_stress', 'supply_stress'], nodeAffinity: ['dlPFC', 'THAL'], businessAffinity: ['semiconductor', 'cloud infrastructure'] }],
    environment:     [{ titlePattern: 'Environmental Threshold Breach', mechanismPattern: 'Environmental indicators cross critical thresholds, triggering regulatory and operational responses.', triggerConditions: ['environment_stress_high', 'climate_elevated'], nodeAffinity: ['NTS', 'AI'], businessAffinity: ['environmental monitoring', 'remediation'] }],
    governance:      [{ titlePattern: 'Regulatory Coordination Breakdown', mechanismPattern: 'Regulatory bodies lose coordination capacity under crisis conditions.', triggerConditions: ['governance_stress', 'cross_domain_governance'], nodeAffinity: ['dlPFC', 'dACC'], businessAffinity: ['compliance', 'policy analytics'] }],
    industry:        [{ titlePattern: 'Manufacturing Resilience Failure', mechanismPattern: 'Industrial production capacity degrades under input cost pressure and supply disruption.', triggerConditions: ['industry_stress', 'supply_stress'], nodeAffinity: ['THAL', 'GP'], businessAffinity: ['manufacturing', 'industrial automation'] }],
    communication:   [{ titlePattern: 'Information Integrity Degradation', mechanismPattern: 'Communication channels become unreliable under disinformation or infrastructure disruption.', triggerConditions: ['communication_stress', 'CYBER_ATTACK'], nodeAffinity: ['dlPFC', 'AI'], businessAffinity: ['media platforms', 'content verification'] }],
    infrastructure:  [{ titlePattern: 'Infrastructure Redundancy Failure', mechanismPattern: 'Critical infrastructure lacks redundancy to absorb concurrent failures.', triggerConditions: ['infrastructure_stress', 'cross_domain_infra'], nodeAffinity: ['THAL', 'GP'], businessAffinity: ['construction', 'utilities'] }],
    education:       [{ titlePattern: 'Research Translation Bottleneck', mechanismPattern: 'Research outputs fail to translate into applied solutions due to institutional barriers.', triggerConditions: ['education_stress', 'research_stress'], nodeAffinity: ['HIPP', 'PCC'], businessAffinity: ['edtech', 'research institutions'] }],
    law:             [{ titlePattern: 'Compliance Burden Volatility', mechanismPattern: 'Regulatory change pace exceeds organizational adaptation capacity.', triggerConditions: ['law_stress', 'governance_stress'], nodeAffinity: ['dlPFC', 'dACC'], businessAffinity: ['legal tech', 'compliance platforms'] }],
    culture:         [{ titlePattern: 'Cultural Production Disruption', mechanismPattern: 'Creative and cultural industries face distribution or revenue model disruption.', triggerConditions: ['culture_stress'], nodeAffinity: ['DMN', 'NAcc'], businessAffinity: ['entertainment', 'media'] }],
    religion:        [{ titlePattern: 'Interfaith Tension Escalation', mechanismPattern: 'Religious community tensions amplify under economic or political stress.', triggerConditions: ['religion_stress', 'population_stress'], nodeAffinity: ['BLA', 'mPFC'], businessAffinity: ['community services', 'social organizations'] }],
    intelligence:    [{ titlePattern: 'Intelligence Visibility Gap', mechanismPattern: 'Threat assessment capability degrades as information sources become unreliable or inaccessible.', triggerConditions: ['intelligence_stress', 'CYBER_ATTACK'], nodeAffinity: ['dlPFC', 'THAL'], businessAffinity: ['intelligence platforms', 'cybersecurity'] }],
    population:      [{ titlePattern: 'Demographic Service Mismatch', mechanismPattern: 'Population service infrastructure misaligns with actual demographic needs.', triggerConditions: ['population_stress', 'health_stress'], nodeAffinity: ['AI', 'NTS'], businessAffinity: ['healthcare systems', 'social services'] }],
    research:        [{ titlePattern: 'Research Funding Fragmentation', mechanismPattern: 'Research funding becomes fragmented across competing priorities.', triggerConditions: ['research_stress', 'economy_stress'], nodeAffinity: ['HIPP', 'dlPFC'], businessAffinity: ['research institutions', 'funding platforms'] }],
    economy:         [{ titlePattern: 'Economic Transmission Disruption', mechanismPattern: 'Normal economic transmission mechanisms (credit, employment, trade) degrade simultaneously.', triggerConditions: ['economy_stress', 'finance_stress'], nodeAffinity: ['vmPFC', 'THAL'], businessAffinity: ['financial services', 'employment platforms'] }]
  };

  // ══════════════════════════════════════════════════════════════════════
  // TREATMENT LEVEL TEMPLATES (8 levels)
  // ══════════════════════════════════════════════════════════════════════

  var TREATMENT_LEVELS = [
    { level: 'monitoring',    type: 'DIAGNOSTIC', titleSuffix: 'Monitoring Protocol', actionPattern: 'Deploy continuous monitoring and early warning systems for {mechanism}.', whoExecutes: ['operations teams', 'monitoring platforms', 'analysts'], timeHorizon: 'immediate' },
    { level: 'stabilization', type: 'STRATEGY',   titleSuffix: 'Stabilization Response', actionPattern: 'Implement containment measures to prevent {mechanism} from cascading into dependent systems.', whoExecutes: ['executive leadership', 'crisis teams', 'operational managers'], timeHorizon: 'immediate-7d' },
    { level: 'rerouting',     type: 'STRUCTURAL',  titleSuffix: 'Alternative Pathway Design', actionPattern: 'Design and activate alternative pathways to reduce dependence on disrupted channels affected by {mechanism}.', whoExecutes: ['logistics operators', 'supply chain managers', 'infrastructure teams'], timeHorizon: '7d-30d' },
    { level: 'resilience',    type: 'STRUCTURAL',  titleSuffix: 'Resilience Architecture', actionPattern: 'Build structural redundancy and adaptive capacity to absorb future occurrences of {mechanism}.', whoExecutes: ['system architects', 'engineering teams', 'capital planners'], timeHorizon: '30d-90d' },
    { level: 'capital',       type: 'STRATEGY',   titleSuffix: 'Capital Positioning', actionPattern: 'Position capital instruments (investment, insurance, hedging) to manage exposure created by {mechanism}.', whoExecutes: ['financial teams', 'risk managers', 'investors'], timeHorizon: '7d-90d' },
    { level: 'policy',        type: 'CULTURE',    titleSuffix: 'Policy Coordination', actionPattern: 'Coordinate policy and regulatory response to address systemic conditions enabling {mechanism}.', whoExecutes: ['policy teams', 'regulatory bodies', 'industry associations'], timeHorizon: '30d-180d' },
    { level: 'operational',   type: 'TOOLS',      titleSuffix: 'Operational Deployment', actionPattern: 'Deploy operational tools and processes that directly counter the effects of {mechanism}.', whoExecutes: ['field operators', 'technology teams', 'service providers'], timeHorizon: 'immediate-30d' },
    { level: 'recovery',      type: 'COACHING',   titleSuffix: 'Recovery Protocol', actionPattern: 'Establish recovery pathways for systems and organizations damaged by {mechanism}.', whoExecutes: ['recovery teams', 'advisory firms', 'rebuilding coordinators'], timeHorizon: '90d-365d' }
  ];

  // ══════════════════════════════════════════════════════════════════════
  // NODE-BUSINESS FUNCTION TEMPLATES
  // Maps brain nodes to business function descriptions for drill-deeper
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_MAP = {
    NTS:   { function: 'Sensory input and condition monitoring', subActions: ['deploy field sensors', 'establish threshold alerts', 'track condition metrics'], metrics: ['sensor coverage', 'alert response time', 'condition drift rate'] },
    VTA:   { function: 'Reward/incentive and prioritization', subActions: ['rebalance incentive structures', 'prioritize high-value pathways', 'adjust reward signals'], metrics: ['incentive alignment score', 'priority compliance rate', 'resource allocation efficiency'] },
    ENS:   { function: 'Operational throughput and processing', subActions: ['optimize throughput capacity', 'balance processing loads', 'clear bottlenecks'], metrics: ['throughput rate', 'processing latency', 'queue depth'] },
    vmPFC: { function: 'Value assessment and decision-making', subActions: ['reassess value models', 'update decision criteria', 'calibrate risk tolerance'], metrics: ['decision accuracy', 'value model drift', 'risk-adjusted returns'] },
    dlPFC: { function: 'Executive planning and coordination', subActions: ['coordinate multi-stakeholder response', 'sequence intervention priorities', 'allocate resources strategically'], metrics: ['plan execution rate', 'coordination efficiency', 'resource utilization'] },
    BLA:   { function: 'Threat detection and urgency signaling', subActions: ['calibrate threat detection thresholds', 'filter false alarms', 'escalate confirmed threats'], metrics: ['detection sensitivity', 'false positive rate', 'escalation response time'] },
    HIPP:  { function: 'Memory, context, and pattern recognition', subActions: ['compare current conditions to historical patterns', 'identify precedent situations', 'update baseline models'], metrics: ['pattern match confidence', 'baseline deviation', 'historical similarity score'] },
    NAcc:  { function: 'Motivation and resource allocation', subActions: ['reallocate resources to highest-impact areas', 'activate reserve capacity', 'incentivize rapid response'], metrics: ['resource deployment speed', 'allocation efficiency', 'reserve utilization'] },
    AI:    { function: 'Interoception and system state awareness', subActions: ['assess internal system health', 'detect early degradation signals', 'report condition changes'], metrics: ['system health index', 'degradation detection time', 'state reporting latency'] },
    PAG:   { function: 'Emergency response and survival mode', subActions: ['activate emergency protocols', 'engage survival-mode operations', 'triage non-essential functions'], metrics: ['emergency response time', 'triage accuracy', 'essential function uptime'] },
    dACC:  { function: 'Conflict detection and error monitoring', subActions: ['detect conflicting signals', 'flag inconsistencies', 'trigger review cycles'], metrics: ['conflict detection rate', 'error correction time', 'signal consistency score'] },
    THAL:  { function: 'Information routing and relay', subActions: ['optimize information flow paths', 'reduce routing latency', 'ensure signal fidelity'], metrics: ['routing efficiency', 'signal loss rate', 'information latency'] },
    mPFC:  { function: 'Self-model and identity integration', subActions: ['maintain organizational coherence', 'align actions with mission', 'resolve identity conflicts'], metrics: ['mission alignment score', 'coherence index', 'identity stability'] },
    PCC:   { function: 'Default mode and narrative integration', subActions: ['maintain strategic narrative', 'integrate disparate signals', 'sustain long-term perspective'], metrics: ['narrative coherence', 'integration completeness', 'perspective stability'] },
    DMN:   { function: 'Baseline operations and autonomous function', subActions: ['maintain baseline operational capacity', 'preserve autonomous functions', 'monitor default state health'], metrics: ['baseline operation rate', 'autonomous function uptime', 'default state deviation'] },
    GP:    { function: 'Action selection and motor planning', subActions: ['select optimal action sequences', 'plan operational movements', 'gate non-productive actions'], metrics: ['action selection accuracy', 'operational throughput', 'gate efficiency'] },
    BDNF:  { function: 'Adaptation and structural plasticity', subActions: ['enable structural reorganization', 'support learning from disruption', 'build adaptive capacity'], metrics: ['adaptation rate', 'learning efficiency', 'structural flexibility index'] }
  };

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENGapTemplates = {
    DIAGNOSIS_TEMPLATES: DIAGNOSIS_TEMPLATES,
    TREATMENT_LEVELS: TREATMENT_LEVELS,
    NODE_BUSINESS_MAP: NODE_BUSINESS_MAP
  };

})();
