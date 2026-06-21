/**
 * law-node-business-engine.js — Law Node-to-Business Assignment Engine
 *
 * LAW / REGULATION DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture (matches the locked-domain standard):
 *   - Recursively traverses ALL child portal JSONs (depth 0-5, ~19,500 files)
 *   - Covers full 103 operational nodes (13 LAW-TOP + 90 LAW-OPERATIONAL)
 *   - Excludes the same 20 RI / framework nodes as the locked domains
 *   - Filters generic template treatments before inference
 *   - Compares existing companies at ALL depth levels against the law business directory
 *
 * Outputs 3 buckets:
 *   MAPPED     - already mapped and active in Law system
 *   MISSING    - plausible but missing from current Law mappings
 *   SPECULATIVE - low-confidence or novel suggestions
 *
 * Approval statuses:
 *   PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_law_business_approvals')
 *
 * Self-gates: only runs when ?domain=law
 * Exposes: window.LIMENLawBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'law') return;

  var STORAGE_KEY = 'limen_law_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_law_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

  // ══════════════════════════════════════════════════════════════════════
  // RI / FRAMEWORK NODES — same 20 excluded by all locked domains
  // ══════════════════════════════════════════════════════════════════════

  var RI_NODES = {
    'ACC': true, 'ASTRO': true, 'BBB': true, 'DMNMTL': true, 'EBA': true,
    'FPC': true, 'IPL': true, 'MFC': true, 'MI': true, 'PMC': true,
    'PPA': true, 'PRC': true, 'S2': true, 'SCN': true, 'SDH': true,
    'SPL': true, 'V4V5': true, 'VIA': true, 'rPFC': true, 'sgACC': true
  };

  // ══════════════════════════════════════════════════════════════════════
  // GENERIC TREATMENT FILTER — boilerplate that should not generate business
  // ══════════════════════════════════════════════════════════════════════

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
  for (var gi = 0; gi < GENERIC_TREATMENT_PATTERNS.length; gi++) {
    _genericSet[GENERIC_TREATMENT_PATTERNS[gi]] = true;
  }

  function isGenericTreatment(label) {
    if (_genericSet[label]) return true;
    var lower = (label || '').toLowerCase();
    if (lower.indexOf('integrated technology platform') !== -1) return true;
    if (lower.indexOf('diagnostic classification') !== -1 && lower.indexOf('protocol') !== -1) return true;
    if (lower.indexOf('signal ingestion') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('signal filtering') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('signal correlation') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('intervention planning') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('root cause analysis') !== -1 && lower.indexOf('assessment') !== -1) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL NODE BUSINESS DIRECTORY — 103 operational nodes
  // 13 LAW-TOP (full neuroTranslation) + 90 LAW-OPERATIONAL (functional roles)
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── LAW-TOP NODES (13) — full detail with neuroTranslation ──
    'BLA': {
      fullName: 'Basolateral Amygdala', label: 'Criminal Law', tier: 'top',
      neuroTranslation: { inNeurology: 'Performs threat detection and fear conditioning, associating stimuli with negative consequences.', inBusiness: 'In law, criminal law detects threats to social order and conditions deterrence by associating harmful conduct with punishment.' },
      function: 'Defines offenses against the state, establishes culpability, and prescribes punitive or rehabilitative responses to harmful conduct',
      dysregulation: 'Sentencing surge, recidivism spike, prosecutorial overreach, plea bargain coercion, mass incarceration',
      expectedTypes: [
        { type: 'Criminal defense law firm', reason: 'Represents defendants in criminal proceedings', confidence: 0.95 },
        { type: 'Public defender service organization', reason: 'Provides indigent criminal defense', confidence: 0.92 },
        { type: 'White-collar defense practice', reason: 'Defends executives in regulatory and criminal matters', confidence: 0.90 },
        { type: 'Sentencing mitigation specialist', reason: 'Builds mitigation packages for sentencing hearings', confidence: 0.85 },
        { type: 'Criminal justice reform advocacy organization', reason: 'Drives policy and legal reform around incarceration and sentencing', confidence: 0.80 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Legal Reasoning & Doctrinal Synthesis', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates semantic information across domains, supporting conceptual reasoning and analogical thought.', inBusiness: 'In law, legal reasoning integrates statutes, precedent, and facts into doctrinal conclusions through analogical and conceptual synthesis.' },
      function: 'Synthesizes statutes, regulations, and precedent into legal arguments and doctrinal positions',
      dysregulation: 'Reasoning failure, doctrinal incoherence, statutory misinterpretation, brief quality collapse',
      expectedTypes: [
        { type: 'Appellate litigation boutique', reason: 'Specialized in legal-reasoning-intensive appellate work', confidence: 0.92 },
        { type: 'Legal research and brief writing service', reason: 'Outsourced research and writing for law firms', confidence: 0.88 },
        { type: 'AI-assisted legal reasoning platform', reason: 'Software tools that synthesize precedent and draft analyses', confidence: 0.85 },
        { type: 'Academic legal scholarship and amicus practice', reason: 'Develops doctrinal positions for high-impact cases', confidence: 0.78 }
      ]
    },
    'DAN': {
      fullName: 'Dorsal Attention Network', label: 'Regulatory Surveillance & Enforcement Targeting', tier: 'top',
      neuroTranslation: { inNeurology: 'Allocates top-down attention to specific stimuli and locations based on goals.', inBusiness: 'In law, regulatory surveillance directs investigative attention to specific entities and sectors based on enforcement priorities.' },
      function: 'Targets investigative and enforcement attention across regulated industries and individuals',
      dysregulation: 'Enforcement gaps, surveillance overreach, selective prosecution, regulatory blindness',
      expectedTypes: [
        { type: 'Government enforcement agency', reason: 'Conducts investigations and brings enforcement actions', confidence: 0.95 },
        { type: 'Regulatory monitoring platform', reason: 'Tracks enforcement actions and inspection patterns', confidence: 0.90 },
        { type: 'Whistleblower / qui tam law firm', reason: 'Brings False Claims Act and whistleblower retaliation cases', confidence: 0.88 },
        { type: 'Compliance audit and inspection service', reason: 'Pre-emptive readiness assessments before enforcement', confidence: 0.82 },
        { type: 'Investigative journalism and watchdog organization', reason: 'Surfaces regulatory failures for enforcement action', confidence: 0.72 }
      ]
    },
    'DMN': {
      fullName: 'Default Mode Network', label: 'Constitutional Law & Founding Doctrine', tier: 'top',
      neuroTranslation: { inNeurology: 'Active during self-referential thought, autobiographical memory, and identity processing.', inBusiness: 'In law, constitutional doctrine forms the legal systems autobiographical narrative and identity, shaping all subordinate law.' },
      function: 'Defines the foundational rules, rights, and structural limits binding government action',
      dysregulation: 'Constitutional crisis, rights challenge, separation-of-powers conflict, rule-of-law erosion',
      expectedTypes: [
        { type: 'Constitutional litigation boutique', reason: 'Brings First Amendment, Fourth Amendment, and structural constitutional challenges', confidence: 0.92 },
        { type: 'Civil liberties and rights advocacy organization', reason: 'Strategic litigation defending constitutional rights', confidence: 0.90 },
        { type: 'Supreme Court advocacy practice', reason: 'Specialized appellate and SCOTUS-bar practice', confidence: 0.85 },
        { type: 'Constitutional law think tank and amicus author', reason: 'Develops doctrinal arguments and amicus briefs', confidence: 0.78 }
      ]
    },
    'EMP': {
      fullName: 'Empathy Circuit', label: 'Civil Rights & Equity Law', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports perspective-taking and affective response to others suffering.', inBusiness: 'In law, civil rights and equity law gives parties unable to protect themselves a structural mechanism for recognition and redress.' },
      function: 'Protects historically disadvantaged groups and individuals through anti-discrimination, accommodation, and equal-protection law',
      dysregulation: 'Discrimination spike, equal-protection failure, accommodation denial, hostile work environment',
      expectedTypes: [
        { type: 'Civil rights litigation firm', reason: 'Brings discrimination, harassment, and Section 1983 cases', confidence: 0.95 },
        { type: 'Disability rights and ADA practice', reason: 'Enforces accommodation and accessibility law', confidence: 0.90 },
        { type: 'Employment discrimination plaintiff firm', reason: 'Title VII, ADEA, and state employment-discrimination practice', confidence: 0.92 },
        { type: 'Impact litigation and class-action firm', reason: 'Systemic challenges to discriminatory policies', confidence: 0.85 },
        { type: 'Legal aid civil rights program', reason: 'Free and reduced-fee representation for low-income plaintiffs', confidence: 0.82 }
      ]
    },
    'FG': {
      fullName: 'Fusiform Gyrus', label: 'Identity & Identification Law', tier: 'top',
      neuroTranslation: { inNeurology: 'Specialized for face recognition and category identification.', inBusiness: 'In law, identification law governs how legal systems verify, register, and authenticate identity for all transactions and rights.' },
      function: 'Governs identity verification, biometric data, KYC, identification documents, and identity theft remedies',
      dysregulation: 'Identity fraud surge, biometric privacy violation, KYC failure, identification denial',
      expectedTypes: [
        { type: 'Identity verification and KYC platform', reason: 'Automated identity verification for financial and legal compliance', confidence: 0.92 },
        { type: 'Biometric privacy litigation firm', reason: 'BIPA and state biometric-privacy class actions', confidence: 0.88 },
        { type: 'Identity theft remediation service', reason: 'Helps consumers restore identity after theft', confidence: 0.85 },
        { type: 'Notary public and legalization service', reason: 'Notarization, apostille, and identity authentication', confidence: 0.78 }
      ]
    },
    'FORN': {
      fullName: 'Fornix', label: 'Discovery & Evidence Production', tier: 'top',
      neuroTranslation: { inNeurology: 'Pathway connecting hippocampal memory to other regions, supporting memory retrieval.', inBusiness: 'In law, discovery is the structured process of compelling production of stored records and information for use in litigation.' },
      function: 'Compels production of documents, testimony, and electronic evidence under court rules',
      dysregulation: 'Discovery abuse, spoliation, privilege waiver, e-discovery cost explosion',
      expectedTypes: [
        { type: 'E-discovery platform and review service', reason: 'Document review, processing, and production at scale', confidence: 0.95 },
        { type: 'Litigation-support and managed-review provider', reason: 'Outsourced document review and quality control', confidence: 0.90 },
        { type: 'Forensic data collection and preservation specialist', reason: 'Defensible collection of ESI for litigation', confidence: 0.88 },
        { type: 'Privilege review and TAR (technology-assisted review) consultant', reason: 'Predictive coding and privilege protection', confidence: 0.82 },
        { type: 'Discovery dispute and motion practice specialist', reason: 'Discovery counsel for sanctions and motion practice', confidence: 0.78 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Legal Precedent & Case Law', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes new memories and consolidates short-term to long-term storage.', inBusiness: 'In law, case law encodes prior judicial decisions as binding or persuasive authority for future disputes.' },
      function: 'Stores, indexes, and provides access to judicial decisions and the citators that connect them',
      dysregulation: 'Citator failure, precedent drift, conflicting authority, research gap',
      expectedTypes: [
        { type: 'Legal research database and analytics platform', reason: 'Westlaw, Lexis, Bloomberg Law and competitors', confidence: 0.95 },
        { type: 'Case law analytics and litigation analytics provider', reason: 'Judge analytics, motion-success rates, expert reports', confidence: 0.90 },
        { type: 'AI-powered legal research startup', reason: 'Generative-AI legal research and citation tools', confidence: 0.88 },
        { type: 'Free law and open-access legal information project', reason: 'Open access to case law and primary legal materials', confidence: 0.78 }
      ]
    },
    'MDT': {
      fullName: 'Mediodorsal Thalamus', label: 'Administrative Adjudication', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays signals between prefrontal cortex and limbic structures, supporting executive cognition.', inBusiness: 'In law, administrative adjudication relays disputes between executive agencies, regulated parties, and Article III courts.' },
      function: 'Resolves disputes within administrative agencies via ALJs, hearing examiners, and agency review boards',
      dysregulation: 'ALJ backlog, hearing delay, agency capture, judicial-review breakdown',
      expectedTypes: [
        { type: 'Administrative law and agency practice firm', reason: 'Represents parties in agency adjudication and rulemaking', confidence: 0.95 },
        { type: 'Social Security Disability or veterans benefits firm', reason: 'High-volume administrative-hearing practice', confidence: 0.90 },
        { type: 'Immigration court practice', reason: 'Removal defense and immigration hearings', confidence: 0.88 },
        { type: 'Tax court and IRS controversy practice', reason: 'Administrative tax dispute resolution', confidence: 0.85 },
        { type: 'Administrative-law judge case-management platform', reason: 'Software for ALJ docket management', confidence: 0.78 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Regulatory Cost-Benefit & Rulemaking', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates subjective value and updates expectations as outcomes change.', inBusiness: 'In law, regulatory cost-benefit analysis evaluates rules and updates them as policy values, costs, and benefits shift.' },
      function: 'Develops, evaluates, and revises regulations through notice-and-comment rulemaking and economic analysis',
      dysregulation: 'Rulemaking delay, regulatory capture, cost-benefit manipulation, arbitrary-and-capricious vulnerability',
      expectedTypes: [
        { type: 'Regulatory affairs and rulemaking advisory firm', reason: 'Helps clients shape and respond to agency rulemaking', confidence: 0.95 },
        { type: 'Economic and cost-benefit analysis consulting', reason: 'Builds the economic record supporting or opposing rules', confidence: 0.90 },
        { type: 'Rulemaking comment platform and tracker', reason: 'Software for monitoring and submitting regulatory comments', confidence: 0.85 },
        { type: 'OIRA / OMB liaison and review specialist', reason: 'Advises on White House regulatory review process', confidence: 0.80 }
      ]
    },
    'STRI': {
      fullName: 'Striatum', label: 'Procedural Law & Court Routine', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes habitual action sequences and reinforcement-driven routines.', inBusiness: 'In law, procedural rules encode the standardized routines that govern how cases move through courts.' },
      function: 'Defines court rules of civil and criminal procedure, deadlines, motion practice, and procedural compliance',
      dysregulation: 'Procedural default, missed deadline, motion practice failure, court rule violation',
      expectedTypes: [
        { type: 'Court rules and procedural compliance platform', reason: 'Calendars deadlines and procedural requirements', confidence: 0.92 },
        { type: 'Docket calendaring and rules-based scheduling service', reason: 'Calculates deadlines from court rules', confidence: 0.95 },
        { type: 'Procedural motion practice specialist', reason: 'Practitioners focused on procedural motions and standards', confidence: 0.82 },
        { type: 'Bar prep and procedural CLE provider', reason: 'Trains practitioners on civil and criminal procedure', confidence: 0.75 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'International Law & Cross-Border Jurisdiction', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates information across modalities and supports theory of mind.', inBusiness: 'In law, international law requires understanding multiple legal regimes simultaneously and predicting how foreign systems will treat a transaction.' },
      function: 'Manages cross-border legal questions including treaties, conflicts of law, sanctions, and extraterritorial enforcement',
      dysregulation: 'Treaty violation, sanctions friction, conflict of laws, foreign-judgment enforcement gap',
      expectedTypes: [
        { type: 'International trade and sanctions law firm', reason: 'OFAC, BIS, FCPA, and trade-remedy practice', confidence: 0.95 },
        { type: 'Cross-border M&A and international tax practice', reason: 'Multi-jurisdictional structuring and compliance', confidence: 0.92 },
        { type: 'International arbitration and dispute resolution boutique', reason: 'ICC, ICSID, LCIA arbitration practice', confidence: 0.90 },
        { type: 'Foreign law expert witness and consulting service', reason: 'Provides expert opinions on foreign legal regimes', confidence: 0.82 },
        { type: 'Sanctions screening and trade-compliance technology', reason: 'Automated denied-party screening and export-control compliance', confidence: 0.88 }
      ]
    },
    'VP': {
      fullName: 'Ventral Pallidum', label: 'Sentencing & Disposition', tier: 'top',
      neuroTranslation: { inNeurology: 'Translates motivational and reward signals into sustained action selection.', inBusiness: 'In law, sentencing and disposition translate the verdict into sustained action: incarceration, restitution, community supervision, or restoration.' },
      function: 'Determines and administers criminal sentences and civil dispositions including supervision, restitution, and fines',
      dysregulation: 'Sentencing disparity, supervision failure, restitution non-collection, disposition gap',
      expectedTypes: [
        { type: 'Sentencing mitigation and pre-sentence specialist', reason: 'Builds mitigation packages and PSI responses', confidence: 0.92 },
        { type: 'Probation and parole supervision technology', reason: 'Electronic monitoring and supervision case management', confidence: 0.85 },
        { type: 'Restitution and victim-recovery service', reason: 'Collects court-ordered restitution and assists victims', confidence: 0.78 },
        { type: 'Reentry and post-conviction services organization', reason: 'Helps people leaving incarceration reintegrate', confidence: 0.82 }
      ]
    },

    // ── LAW-OPERATIONAL NODES (90) — functional roles in law hierarchy ──
    // 17 nodes that are top in trade but operational in law:
    'NTS':   { fullName: 'Nucleus Tractus Solitarius', label: 'Detention & Custody', tier: 'operational', function: 'Routes detained individuals through pretrial, immigration, and post-conviction custody systems', dysregulation: 'Overcrowding, pretrial detention abuse, custody injury', expectedTypes: [{ type: 'Bail bond and pretrial release service', reason: 'Commercial pretrial release operations', confidence: 0.85 }, { type: 'Pretrial services agency contractor', reason: 'Pretrial supervision and risk assessment', confidence: 0.82 }, { type: 'Correctional operations consulting', reason: 'Jail and prison operational improvement', confidence: 0.78 }] },
    'FEF':   { fullName: 'Frontal Eye Fields', label: 'Targeted Legal Investigation', tier: 'operational', function: 'Focuses investigative resources on specific entities, transactions, or individuals', dysregulation: 'Investigation gap, targeting bias, surveillance overreach', expectedTypes: [{ type: 'Litigation investigation firm', reason: 'Pre-litigation factual investigation and asset tracing', confidence: 0.85 }, { type: 'Special counsel and independent investigation practice', reason: 'Internal investigation and special-counsel work', confidence: 0.88 }] },
    'CBLM':  { fullName: 'Cerebellum', label: 'Multi-Party Coordination', tier: 'operational', function: 'Coordinates many parties, claims, and counsel in complex litigation', dysregulation: 'MDL coordination failure, class certification breakdown', expectedTypes: [{ type: 'Multi-district litigation (MDL) coordination practice', reason: 'Coordinates plaintiffs across consolidated cases', confidence: 0.90 }, { type: 'Class action plaintiff firm', reason: 'Class certification and class-wide settlement', confidence: 0.88 }, { type: 'Mass tort lead counsel and steering committee firm', reason: 'Lead counsel in mass torts', confidence: 0.85 }] },
    'M1':    { fullName: 'Primary Motor Cortex', label: 'Enforcement Execution', tier: 'operational', function: 'Executes court orders, warrants, judgments, and writs in the physical world', dysregulation: 'Execution failure, judgment uncollectability, warrant backlog', expectedTypes: [{ type: 'Process server and judicial service-of-process firm', reason: 'Service of legal documents and writs', confidence: 0.92 }, { type: 'Judgment enforcement and collections practice', reason: 'Post-judgment collection of civil judgments', confidence: 0.88 }, { type: 'Sheriff or marshals service contractor', reason: 'Civil process execution', confidence: 0.78 }] },
    'THAL':  { fullName: 'Thalamus', label: 'Court Clerk & Filing Operations', tier: 'operational', function: 'Routes filings through the clerks office, dockets cases, and manages filing intake', dysregulation: 'Filing backlog, clerk error, intake delay', expectedTypes: [{ type: 'Court case management system vendor', reason: 'Tyler Technologies, Journal Technologies, and similar', confidence: 0.92 }, { type: 'Electronic filing and clerk-of-court technology', reason: 'eFileMA, Tyler Odyssey, eFlex', confidence: 0.90 }, { type: 'Court records and filing-as-a-service vendor', reason: 'Outsourced filing service', confidence: 0.82 }] },
    'dlPFC': { fullName: 'Dorsolateral Prefrontal Cortex', label: 'Litigation Strategy & Case Planning', tier: 'operational', function: 'Holds case theory, witness lists, motion sequences, and trial plans simultaneously', dysregulation: 'Strategy drift, missed motion window, trial preparation failure', expectedTypes: [{ type: 'Litigation strategy consulting and trial-prep firm', reason: 'Case theory and witness preparation services', confidence: 0.85 }, { type: 'Litigation case management platform', reason: 'Holds case theory, fact chronology, and exhibit lists', confidence: 0.88 }, { type: 'Mock trial and jury research provider', reason: 'Tests case strategy with mock juries', confidence: 0.80 }] },
    'S1':    { fullName: 'Primary Somatosensory Cortex', label: 'Initial Intake & Triage', tier: 'operational', function: 'First contact between client and the legal system', dysregulation: 'Intake bottleneck, conflict-check failure, missed limitations period', expectedTypes: [{ type: 'Legal aid and bar referral intake service', reason: 'Routes clients to appropriate counsel', confidence: 0.85 }, { type: 'Law firm intake and conflicts technology', reason: 'Automated intake and conflicts screening', confidence: 0.82 }, { type: 'Legal hotline and advice service', reason: 'Initial legal information and triage', confidence: 0.78 }] },
    'HYPO':  { fullName: 'Hypothalamus', label: 'Interim Relief & Injunctive Orders', tier: 'operational', function: 'Maintains the status quo or prevents harm pending full adjudication', dysregulation: 'TRO denial, injunction violation, status-quo collapse', expectedTypes: [{ type: 'Emergency motions and TRO practice', reason: 'Specialized in temporary restraining orders and preliminary injunctions', confidence: 0.85 }, { type: 'Injunctive relief and equitable remedies firm', reason: 'Trade secret, employment, and IP injunction practice', confidence: 0.82 }] },
    'vmPFC': { fullName: 'Ventromedial Prefrontal Cortex', label: 'Plea Bargaining & Settlement', tier: 'operational', function: 'Weighs competing interests to negotiate resolutions short of full adjudication', dysregulation: 'Coerced plea, settlement collapse, valuation error', expectedTypes: [{ type: 'Mediation and dispute resolution service', reason: 'Neutral mediators for civil disputes', confidence: 0.90 }, { type: 'Settlement counsel and negotiation specialist', reason: 'Settlement-only counsel for complex cases', confidence: 0.85 }, { type: 'Settlement administration provider', reason: 'Administers class action and mass tort settlements', confidence: 0.82 }] },
    'NAcc':  { fullName: 'Nucleus Accumbens', label: 'Damages & Awards', tier: 'operational', function: 'Quantifies and allocates monetary damages, restitution, and statutory awards', dysregulation: 'Damages inflation, undercompensation, fee disputes', expectedTypes: [{ type: 'Litigation funding and plaintiff finance firm', reason: 'Finances plaintiff cases against future recovery', confidence: 0.88 }, { type: 'Damages valuation and forensic economics expert', reason: 'Expert witness damages calculations', confidence: 0.85 }, { type: 'Structured settlement and annuity provider', reason: 'Long-term settlement payment structures', confidence: 0.78 }] },
    'CC':    { fullName: 'Corpus Callosum', label: 'Multi-Forum Coordination', tier: 'operational', function: 'Coordinates parallel proceedings across courts, agencies, and arbitration forums', dysregulation: 'Forum shopping, parallel proceedings conflict, coordination failure', expectedTypes: [{ type: 'Multi-jurisdiction coordination counsel', reason: 'Coordinates parallel litigation across forums', confidence: 0.85 }, { type: 'Conflict of laws and forum strategy specialist', reason: 'Advises on forum selection and choice of law', confidence: 0.78 }] },
    'ECN':   { fullName: 'Executive Control Network', label: 'General Counsel & Legal Operations', tier: 'operational', function: 'Allocates legal resources, manages outside counsel, and aligns legal with business strategy', dysregulation: 'Spend overrun, outside counsel quality drift, strategy misalignment', expectedTypes: [{ type: 'Corporate legal operations consulting', reason: 'Legal-ops maturity assessments and implementation', confidence: 0.90 }, { type: 'Matter management and legal spend platform', reason: 'Tracks matters, spend, and outside counsel performance', confidence: 0.92 }, { type: 'Alternative legal service provider (ALSP)', reason: 'Outsourced legal services for in-house teams', confidence: 0.88 }] },
    'FPN':   { fullName: 'Frontoparietal Network', label: 'Legal Technology Platforms', tier: 'operational', function: 'Provides flexible technology infrastructure across the legal practice stack', dysregulation: 'Integration failure, data silo, platform outage', expectedTypes: [{ type: 'Practice management software (PMS) vendor', reason: 'Clio, MyCase, PracticePanther and similar', confidence: 0.92 }, { type: 'Contract lifecycle management (CLM) platform', reason: 'Ironclad, DocuSign CLM, Icertis, ContractPodAi', confidence: 0.90 }, { type: 'AI-powered legal automation startup', reason: 'Generative AI applied to legal workflows', confidence: 0.85 }] },
    'PIN':   { fullName: 'Pineal', label: 'Statutes of Limitation & Time-Sensitive Filings', tier: 'operational', function: 'Tracks time-sensitive legal deadlines including statutes of limitation, filing windows, and statutes of repose', dysregulation: 'Missed limitations period, time-bar, statute of repose collapse', expectedTypes: [{ type: 'Docket calendaring and statute-of-limitations service', reason: 'Calculates and tracks legal deadlines', confidence: 0.88 }, { type: 'Malpractice prevention and risk management firm', reason: 'Helps law firms avoid missed deadlines', confidence: 0.82 }] },
    'WERN':  { fullName: 'Wernickes Area', label: 'Statutory Interpretation', tier: 'operational', function: 'Extracts meaning from statutory text and legislative history', dysregulation: 'Misinterpretation, ambiguity, legislative-intent dispute', expectedTypes: [{ type: 'Statutory construction expert and consultant', reason: 'Specialized expertise in statutory interpretation', confidence: 0.78 }, { type: 'Legal translation and certified-translator service', reason: 'Translates foreign legal documents and statutes', confidence: 0.82 }] },
    'LANG':  { fullName: 'Language Network', label: 'Legal Drafting & Plain Language', tier: 'operational', function: 'Produces contracts, briefs, and legal documents with appropriate clarity for the audience', dysregulation: 'Drafting error, ambiguity, plain-language failure', expectedTypes: [{ type: 'Document assembly and contract drafting platform', reason: 'Automated legal document generation', confidence: 0.88 }, { type: 'Plain language legal writing service', reason: 'Translates complex legal language for consumers', confidence: 0.78 }, { type: 'Legal writing CLE and training provider', reason: 'Trains lawyers in legal drafting', confidence: 0.72 }] },
    'CARD':  { fullName: 'Cardiac Autonomic Centers', label: 'Continuous Compliance Monitoring', tier: 'operational', function: 'Monitors regulatory compliance continuously rather than at discrete audit points', dysregulation: 'Monitoring gap, alert fatigue, false positive surge', expectedTypes: [{ type: 'Continuous compliance monitoring SaaS', reason: 'Real-time compliance dashboards and alerts', confidence: 0.88 }, { type: 'Real-time regulatory reporting platform', reason: 'Automated regulatory filings as events occur', confidence: 0.85 }] },

    // 73 trade-operational nodes that stay operational in law:
    'A1':    { fullName: 'Primary Auditory Cortex', label: 'Notice & Service of Process', tier: 'operational', function: 'Delivers legal notice to parties and ensures service of process is valid', dysregulation: 'Service failure, notice defect, default judgment vulnerability', expectedTypes: [{ type: 'Process server network', reason: 'Personal service of legal documents', confidence: 0.90 }, { type: 'Notice publication and skip-trace service', reason: 'Locates parties for service', confidence: 0.82 }] },
    'ADR':   { fullName: 'Adrenal', label: 'Crisis Response Counsel', tier: 'operational', function: 'Provides emergency legal response to crises requiring immediate counsel', dysregulation: 'Crisis response delay, escalation failure', expectedTypes: [{ type: 'Crisis legal and PR firm', reason: '24/7 crisis response practice', confidence: 0.85 }, { type: 'Emergency outside counsel hotline', reason: 'On-call legal response for incidents', confidence: 0.78 }] },
    'AI':    { fullName: 'Anterior Insula', label: 'Legal Risk Triage', tier: 'operational', function: 'Classifies and prioritizes incoming legal matters by risk and urgency', dysregulation: 'Misclassification, triage failure', expectedTypes: [{ type: 'Legal risk triage and intake platform', reason: 'Automated risk-based intake routing', confidence: 0.82 }, { type: 'Conflicts and risk-screening service', reason: 'Pre-engagement conflict and risk checks', confidence: 0.85 }] },
    'ANT':   { fullName: 'Anterior Thalamus', label: 'Workforce Compliance Alignment', tier: 'operational', function: 'Aligns workforce capabilities with legal compliance requirements', dysregulation: 'Skills gap, training failure', expectedTypes: [{ type: 'Employment law compliance consulting', reason: 'HR policy and workforce compliance', confidence: 0.85 }, { type: 'Compliance training and certification platform', reason: 'Workforce compliance education', confidence: 0.82 }] },
    'ARC':   { fullName: 'Arcuate Fasciculus', label: 'Comparative Law Research', tier: 'operational', function: 'Compares legal regimes across jurisdictions, courts, and time periods', dysregulation: 'Comparison gap, jurisdictional blindness', expectedTypes: [{ type: 'Comparative and foreign law research service', reason: 'Cross-jurisdictional legal research', confidence: 0.78 }, { type: 'Multi-state legal research provider', reason: 'State-by-state legal comparison', confidence: 0.82 }] },
    'BDNF':  { fullName: 'BDNF / Plasticity', label: 'Legal Innovation & Reform', tier: 'operational', function: 'Drives adaptive change and reform across legal institutions', dysregulation: 'Reform stagnation, change resistance', expectedTypes: [{ type: 'Legal reform advocacy organization', reason: 'Drives systemic legal-system reform', confidence: 0.78 }, { type: 'Legal innovation consulting', reason: 'Innovation strategy for legal organizations', confidence: 0.75 }] },
    'BNST':  { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Workforce Governance', tier: 'operational', function: 'Governs workforce policies and labor standards', dysregulation: 'Policy gap, labor compliance failure', expectedTypes: [{ type: 'Labor and employment compliance firm', reason: 'OSHA, DOL, and state labor compliance', confidence: 0.82 }, { type: 'Workplace investigations specialist', reason: 'Independent workplace investigations', confidence: 0.85 }] },
    'BROCA': { fullName: 'Brocas Area', label: 'Legal Drafting Production', tier: 'operational', function: 'Produces standardized legal documents at scale', dysregulation: 'Drafting error, template drift', expectedTypes: [{ type: 'Document automation and template platform', reason: 'Generates legal documents from templates', confidence: 0.85 }, { type: 'Contract review and AI drafting service', reason: 'AI-assisted contract review and drafting', confidence: 0.82 }] },
    'CAUD':  { fullName: 'Caudate Nucleus', label: 'Cost Recovery & Fee Optimization', tier: 'operational', function: 'Optimizes legal spend and recovers cost overruns', dysregulation: 'Spend overrun, fee dispute', expectedTypes: [{ type: 'Legal spend analytics and bill review service', reason: 'Outside counsel spend analysis and bill auditing', confidence: 0.88 }, { type: 'E-billing and matter management platform', reason: 'Tracks spend against budget at matter level', confidence: 0.85 }] },
    'CING':  { fullName: 'Cingulum Bundle', label: 'Legal Innovation Pipeline', tier: 'operational', function: 'Drives innovation pipelines in law firms and legal departments', dysregulation: 'Innovation stagnation', expectedTypes: [{ type: 'Legal innovation lab', reason: 'Hosts experiments in legal service delivery', confidence: 0.75 }, { type: 'Legaltech accelerator and incubator', reason: 'Cultivates new legal technology startups', confidence: 0.78 }] },
    'CLAUST':{ fullName: 'Claustrum', label: 'Legal Issue Mapping', tier: 'operational', function: 'Maps issues across complex legal matters to identify systemic patterns', dysregulation: 'Issue spotting failure, systemic blindness', expectedTypes: [{ type: 'Legal issue spotting and mapping platform', reason: 'Identifies legal issues across matter portfolios', confidence: 0.78 }, { type: 'Litigation analytics and pattern recognition service', reason: 'Cross-matter pattern detection', confidence: 0.75 }] },
    'CMZ':   { fullName: 'Cerebellar Marginal Zone', label: 'Performance Tuning', tier: 'operational', function: 'Fine-tunes operational performance of legal processes', dysregulation: 'Performance degradation', expectedTypes: [{ type: 'Law firm operations optimization consulting', reason: 'Process tuning for law firms', confidence: 0.78 }, { type: 'Legal-ops performance benchmarking service', reason: 'Benchmarks performance across firms', confidence: 0.75 }] },
    'CON':   { fullName: 'Cingulo-Opercular Network', label: 'Comparative Innovation', tier: 'operational', function: 'Compares and adopts innovative practices from adjacent legal markets', dysregulation: 'Innovation blindness', expectedTypes: [{ type: 'Legal best practices benchmarking service', reason: 'Cross-firm and cross-industry benchmarking', confidence: 0.75 }, { type: 'Legaltech advisory firm', reason: 'Evaluates and recommends legal innovations', confidence: 0.78 }] },
    'CeA':   { fullName: 'Central Amygdala', label: 'Threat Assessment & Prevention', tier: 'operational', function: 'Assesses legal and physical threats and operationalizes protective response', dysregulation: 'Threat detection failure', expectedTypes: [{ type: 'Workplace violence prevention and assessment counsel', reason: 'Threat assessment and protective orders', confidence: 0.82 }, { type: 'Security and protective intelligence service', reason: 'Physical threat assessment for litigants', confidence: 0.78 }] },
    'DISS':  { fullName: 'Dissolution Network', label: 'Legal Contingency Planning', tier: 'operational', function: 'Plans contingency response to legal crises and unexpected outcomes', dysregulation: 'Contingency gap', expectedTypes: [{ type: 'Crisis management and legal contingency consulting', reason: 'Pre-incident contingency planning', confidence: 0.78 }, { type: 'Business continuity for legal organizations', reason: 'BCP for law firms and legal departments', confidence: 0.75 }] },
    'DV':    { fullName: 'Dorsal Vagal Complex', label: 'Quality Gates', tier: 'operational', function: 'Enforces quality checkpoints across legal work product', dysregulation: 'Quality escape, gate bypass', expectedTypes: [{ type: 'Document and brief quality review service', reason: 'Quality assurance for legal deliverables', confidence: 0.78 }, { type: 'Legal QMS (quality management system) vendor', reason: 'Quality systems for legal organizations', confidence: 0.75 }] },
    'EC':    { fullName: 'Entorhinal Cortex', label: 'Workforce Compliance Systems', tier: 'operational', function: 'Manages workforce systems supporting legal compliance', dysregulation: 'System fragmentation', expectedTypes: [{ type: 'Employment compliance SaaS', reason: 'I-9, EEO-1, OSHA, and other workforce-compliance systems', confidence: 0.85 }, { type: 'HRIS compliance module vendor', reason: 'Compliance modules embedded in HR systems', confidence: 0.82 }] },
    'EI':    { fullName: 'E/I Balance', label: 'Legal Data Validation', tier: 'operational', function: 'Validates integrity of legal data across systems', dysregulation: 'Data corruption, validation failure', expectedTypes: [{ type: 'Legal data quality and validation platform', reason: 'Cleanses and validates legal records', confidence: 0.78 }, { type: 'Master data management for legal', reason: 'Single source of truth for matter and client data', confidence: 0.75 }] },
    'ENDO':  { fullName: 'Endocannabinoid System', label: 'Legal Process Mapping', tier: 'operational', function: 'Operates process mapping and visualization for legal workflows', dysregulation: 'Mapping failure', expectedTypes: [{ type: 'Legal process mapping and workflow visualization tool', reason: 'Visualizes legal workflows', confidence: 0.78 }, { type: 'Legal-ops process design consultancy', reason: 'Maps and redesigns legal workflows', confidence: 0.75 }] },
    'ENS':   { fullName: 'Enteric Nervous System', label: 'Legal Process Improvement', tier: 'operational', function: 'Drives continuous improvement in legal-process efficiency', dysregulation: 'Process decay, inefficiency creep', expectedTypes: [{ type: 'Lean legal and process improvement consulting', reason: 'Lean / Six Sigma applied to legal operations', confidence: 0.82 }, { type: 'Legal process mining software', reason: 'Discovers bottlenecks in legal workflows', confidence: 0.78 }] },
    'GABA_GLU':{ fullName: 'E/I Balance', label: 'Compliance Baseline Assessment', tier: 'operational', function: 'Assesses baseline compliance maturity and readiness', dysregulation: 'Assessment gap', expectedTypes: [{ type: 'Compliance maturity assessment firm', reason: 'Evaluates compliance program maturity', confidence: 0.78 }, { type: 'Legal capability audit consultancy', reason: 'Assesses legal department readiness', confidence: 0.75 }] },
    'GBA':   { fullName: 'Gut-Brain Axis', label: 'Stakeholder Engagement Systems', tier: 'operational', function: 'Systems for stakeholder engagement and feedback in legal operations', dysregulation: 'Feedback breakdown', expectedTypes: [{ type: 'Legal stakeholder engagement platform', reason: 'Manages business-client relationships for legal departments', confidence: 0.75 }, { type: 'Vendor and outside counsel management system', reason: 'Manages outside counsel relationships', confidence: 0.82 }] },
    'GP':    { fullName: 'Globus Pallidus', label: 'Crisis Response Operations', tier: 'operational', function: 'Executes crisis response when legal incidents occur', dysregulation: 'Response failure', expectedTypes: [{ type: 'Crisis response legal team', reason: '24/7 incident response counsel', confidence: 0.82 }, { type: 'Litigation hold and incident response platform', reason: 'Automates litigation hold issuance', confidence: 0.85 }] },
    'HAB':   { fullName: 'Habenula', label: 'Compliance Baseline Operations', tier: 'operational', function: 'Operates baseline compliance monitoring and recalibration', dysregulation: 'Baseline drift', expectedTypes: [{ type: 'Continuous compliance monitoring software', reason: 'Tracks compliance against established baselines', confidence: 0.78 }, { type: 'Compliance recalibration consultancy', reason: 'Periodic recalibration of compliance programs', confidence: 0.72 }] },
    'HPA':   { fullName: 'HPA Axis', label: 'Legal Stress Response', tier: 'operational', function: 'Manages stress responses across the legal organization', dysregulation: 'Chronic stress, escalation failure', expectedTypes: [{ type: 'Litigation stress testing and modeling service', reason: 'Tests legal exposure under stress scenarios', confidence: 0.78 }, { type: 'Legal crisis management consulting', reason: 'Manages escalation and response', confidence: 0.75 }] },
    'IC':    { fullName: 'Inferior Colliculus', label: 'Regulatory Change Governance', tier: 'operational', function: 'Governs change processes and approval workflows for regulatory updates', dysregulation: 'Uncontrolled change', expectedTypes: [{ type: 'Regulatory change management platform', reason: 'Tracks regulatory changes and required updates', confidence: 0.85 }, { type: 'Policy update tracking service', reason: 'Monitors regulatory developments', confidence: 0.82 }] },
    'IPS':   { fullName: 'Intraparietal Sulcus', label: 'Legal Reporting & Disclosure', tier: 'operational', function: 'Generates required legal and regulatory reports', dysregulation: 'Reporting gap', expectedTypes: [{ type: 'Regulatory disclosure platform', reason: 'Automated regulatory filings and disclosures', confidence: 0.85 }, { type: 'SEC reporting and compliance technology', reason: 'XBRL and SEC filing automation', confidence: 0.82 }] },
    'LAR':   { fullName: 'Laryngeal Motor Cortex', label: 'Predictive Legal Modeling', tier: 'operational', function: 'Builds predictive models of legal outcomes', dysregulation: 'Model failure, prediction error', expectedTypes: [{ type: 'Litigation outcome prediction platform', reason: 'AI-driven case outcome forecasting', confidence: 0.85 }, { type: 'Judge analytics and motion-success prediction', reason: 'Predicts motion outcomes by judge', confidence: 0.82 }] },
    'LC':    { fullName: 'Locus Coeruleus', label: 'Regulatory Strategy', tier: 'operational', function: 'Develops regulatory strategy and government affairs positioning', dysregulation: 'Regulatory exposure', expectedTypes: [{ type: 'Regulatory affairs and government relations firm', reason: 'Government affairs and regulatory strategy', confidence: 0.88 }, { type: 'Lobbying and policy advocacy firm', reason: 'Direct lobbying on regulatory matters', confidence: 0.85 }] },
    'LGN':   { fullName: 'Lateral Geniculate Nucleus', label: 'Court Capacity Assessment', tier: 'operational', function: 'Assesses capacity across courts and legal-service providers', dysregulation: 'Capacity blindness', expectedTypes: [{ type: 'Court analytics and caseload data provider', reason: 'Court capacity and workload analytics', confidence: 0.82 }, { type: 'Legal market intelligence service', reason: 'Tracks supply and demand across legal markets', confidence: 0.78 }] },
    'MAMM':  { fullName: 'Mammillary Bodies', label: 'Document Validation Operations', tier: 'operational', function: 'Operates document validation and authentication checks', dysregulation: 'Document integrity failure', expectedTypes: [{ type: 'Document authentication and notarization service', reason: 'Notary, apostille, and document authentication', confidence: 0.82 }, { type: 'Legal document verification platform', reason: 'Verifies authenticity of legal documents', confidence: 0.78 }] },
    'MGN':   { fullName: 'Medial Geniculate Nucleus', label: 'Legal Performance Operations', tier: 'operational', function: 'Operates performance monitoring across legal organizations', dysregulation: 'Performance blindness', expectedTypes: [{ type: 'Legal department performance management platform', reason: 'KPI tracking for legal departments', confidence: 0.80 }, { type: 'SLA tracking for managed legal services', reason: 'Tracks ALSP and outsourced legal SLAs', confidence: 0.78 }] },
    'MICRO': { fullName: 'Microbiome', label: 'Diagnostic Standards Governance', tier: 'operational', function: 'Governs standards for legal diagnostics and audits', dysregulation: 'Standard erosion', expectedTypes: [{ type: 'Legal audit and inspection standards body', reason: 'Sets standards for legal audits', confidence: 0.72 }, { type: 'Independent legal compliance audit firm', reason: 'Third-party compliance audit', confidence: 0.78 }] },
    'NBM':   { fullName: 'Nucleus Basalis', label: 'Legal Metric Evaluation', tier: 'operational', function: 'Evaluates effectiveness of legal performance metrics', dysregulation: 'Metric staleness', expectedTypes: [{ type: 'Legal analytics and KPI evaluation consulting', reason: 'Evaluates and improves legal measurement systems', confidence: 0.75 }, { type: 'Legal performance benchmarking service', reason: 'Cross-firm and in-house benchmarking', confidence: 0.78 }] },
    'NEOCER':{ fullName: 'Neocerebellum', label: 'Caseload Capacity Operations', tier: 'operational', function: 'Operates caseload capacity assessment for courts and counsel', dysregulation: 'Capacity assessment failure', expectedTypes: [{ type: 'Caseload analytics platform for courts', reason: 'Real-time court caseload management', confidence: 0.80 }, { type: 'Law firm capacity planning software', reason: 'Capacity planning for law firms', confidence: 0.78 }] },
    'OLF':   { fullName: 'Olfactory Cortex', label: 'Professional Responsibility Governance', tier: 'operational', function: 'Governs attorney conduct and professional responsibility standards', dysregulation: 'Ethics violation, disciplinary gap', expectedTypes: [{ type: 'Bar disciplinary board', reason: 'Enforces professional responsibility standards', confidence: 0.85 }, { type: 'Ethics counsel and professional responsibility advisory', reason: 'Outside ethics counsel for law firms', confidence: 0.82 }] },
    'OPIOID':{ fullName: 'Opioid System', label: 'Crisis Containment', tier: 'operational', function: 'Contains the spread of legal crises and litigation contagion', dysregulation: 'Containment failure', expectedTypes: [{ type: 'Crisis containment legal team', reason: 'Manages litigation containment and prevents spread', confidence: 0.78 }, { type: 'Litigation hold and ESI preservation service', reason: 'Preserves evidence to contain legal exposure', confidence: 0.82 }] },
    'OSC':   { fullName: 'Oscillatory Networks', label: 'Legal Resilience Innovation', tier: 'operational', function: 'Innovates resilience approaches for legal organizations', dysregulation: 'Innovation stagnation', expectedTypes: [{ type: 'Legal resilience and BCP consulting', reason: 'Resilience consulting for legal departments', confidence: 0.75 }, { type: 'Legal scenario simulation platform', reason: 'War-gaming and scenario modeling for legal teams', confidence: 0.72 }] },
    'OXY':   { fullName: 'Oxytocin System', label: 'Compliance Innovation', tier: 'operational', function: 'Innovates compliance processes and automation', dysregulation: 'Compliance lag', expectedTypes: [{ type: 'Compliance automation platform', reason: 'Automates compliance workflows and reporting', confidence: 0.85 }, { type: 'Regulatory innovation consulting', reason: 'Develops new compliance approaches', confidence: 0.78 }] },
    'PAG':   { fullName: 'Periaqueductal Gray', label: 'Predictive Model Validation', tier: 'operational', function: 'Validates accuracy of legal prediction models', dysregulation: 'Model degradation', expectedTypes: [{ type: 'Legal AI model validation service', reason: 'Validates accuracy of legaltech AI tools', confidence: 0.78 }, { type: 'Forecast accuracy monitoring for litigation analytics', reason: 'Tracks prediction accuracy over time', confidence: 0.75 }] },
    'PBN':   { fullName: 'Parabrachial Nucleus', label: 'Legal Sensitivity Analysis', tier: 'operational', function: 'Tests sensitivity of legal outcomes to parameter and assumption changes', dysregulation: 'Fragility blindness', expectedTypes: [{ type: 'Legal scenario analysis and what-if platform', reason: 'Tests sensitivity of litigation outcomes', confidence: 0.78 }, { type: 'Legal simulation consulting', reason: 'Models legal outcomes under varying assumptions', confidence: 0.75 }] },
    'PCC':   { fullName: 'Posterior Cingulate Cortex', label: 'Legal Diagnostic Evaluation', tier: 'operational', function: 'Evaluates effectiveness of legal diagnostic tools and intake systems', dysregulation: 'Diagnostic drift', expectedTypes: [{ type: 'Legal diagnostic audit service', reason: 'Evaluates legal intake and triage accuracy', confidence: 0.75 }, { type: 'Compliance health-check platform', reason: 'Periodic compliance evaluation', confidence: 0.78 }] },
    'PI':    { fullName: 'Posterior Insula', label: 'Counterparty Evaluation', tier: 'operational', function: 'Evaluates counterparty performance and relationship health', dysregulation: 'Relationship decay', expectedTypes: [{ type: 'Counterparty risk evaluation platform', reason: 'Scores legal counterparty risk', confidence: 0.82 }, { type: 'Vendor and supplier risk management for legal', reason: 'Third-party risk management', confidence: 0.85 }] },
    'PIT':   { fullName: 'Pituitary', label: 'Legal Workforce Innovation', tier: 'operational', function: 'Innovates legal workforce development and ALSP models', dysregulation: 'Workforce stagnation', expectedTypes: [{ type: 'Alternative legal service provider (ALSP)', reason: 'Non-traditional legal-service models', confidence: 0.85 }, { type: 'Legal talent platform and freelance lawyer marketplace', reason: 'On-demand legal talent', confidence: 0.82 }] },
    'PPN':   { fullName: 'Pedunculopontine Nucleus', label: 'Capacity Diagnostics', tier: 'operational', function: 'Diagnoses capacity bottlenecks in legal operations', dysregulation: 'Capacity diagnostic failure', expectedTypes: [{ type: 'Legal operations bottleneck assessment', reason: 'Identifies capacity choke points', confidence: 0.78 }, { type: 'Court bottleneck diagnostic service', reason: 'Identifies court process bottlenecks', confidence: 0.75 }] },
    'PRECUNEUS':{ fullName: 'Precuneus', label: 'Compliance Posture Analysis', tier: 'operational', function: 'Analyzes overall compliance posture across the organization', dysregulation: 'Compliance blindness', expectedTypes: [{ type: 'Compliance analytics platform', reason: 'Analyzes compliance across business units', confidence: 0.85 }, { type: 'Regulatory exposure heat-mapping service', reason: 'Visualizes regulatory exposure', confidence: 0.82 }] },
    'PULV':  { fullName: 'Pulvinar', label: 'Legal Outcome Innovation', tier: 'operational', function: 'Innovates measurement of legal outcomes and impact', dysregulation: 'Measurement stagnation', expectedTypes: [{ type: 'Legal impact assessment platform', reason: 'Measures real-world legal outcomes', confidence: 0.75 }, { type: 'Justice analytics and outcomes research', reason: 'Studies systemic legal outcomes', confidence: 0.72 }] },
    'PUT':   { fullName: 'Putamen', label: 'Litigation Forensics', tier: 'operational', function: 'Performs deep forensic analysis on litigation outcomes and root causes', dysregulation: 'Analysis failure', expectedTypes: [{ type: 'Litigation forensic analysis service', reason: 'Post-litigation root cause analysis', confidence: 0.78 }, { type: 'Legal data analytics consulting', reason: 'Deep analytics on legal data', confidence: 0.80 }] },
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Legal Network Analysis', tier: 'operational', function: 'Analyzes networks of parties, counsel, and relationships in legal disputes', dysregulation: 'Network blindness', expectedTypes: [{ type: 'Legal network analytics platform', reason: 'Maps relationships between parties and counsel', confidence: 0.78 }, { type: 'Litigation graph and counsel-network database', reason: 'Counsel and party relationship mapping', confidence: 0.75 }] },
    'RF':    { fullName: 'Reticular Formation', label: 'Legal Reporting Standards', tier: 'operational', function: 'Governs standards for legal reporting and disclosure', dysregulation: 'Standard erosion', expectedTypes: [{ type: 'ABA standards body and section', reason: 'Develops legal-profession standards', confidence: 0.72 }, { type: 'Legal disclosure standards consulting', reason: 'Implements reporting standards', confidence: 0.75 }] },
    'RSC':   { fullName: 'Retrosplenial Cortex', label: 'Multi-Jurisdictional Comparison', tier: 'operational', function: 'Operates systems for cross-jurisdictional legal comparison', dysregulation: 'Comparison failure', expectedTypes: [{ type: 'Multi-state law comparison service', reason: 'Compares laws across US states', confidence: 0.82 }, { type: 'International legal comparison database', reason: 'Cross-country legal comparison', confidence: 0.78 }] },
    'SC':    { fullName: 'Superior Colliculus', label: 'Legaltech Deployment', tier: 'operational', function: 'Deploys and integrates technology across legal operations', dysregulation: 'Deployment failure', expectedTypes: [{ type: 'Legaltech implementation consultancy', reason: 'Implements practice management, CLM, and DMS', confidence: 0.85 }, { type: 'Law firm IT and technology services', reason: 'IT services tailored to law firms', confidence: 0.82 }] },
    'SEPT':  { fullName: 'Septal Nuclei', label: 'Legal Risk Quantification', tier: 'operational', function: 'Quantifies legal risk exposure across the organization', dysregulation: 'Risk blindness', expectedTypes: [{ type: 'Legal risk quantification and analytics platform', reason: 'Quantifies legal exposure in dollars', confidence: 0.85 }, { type: 'Litigation reserves and accruals consulting', reason: 'ASC 450 reserves and contingency analysis', confidence: 0.82 }] },
    'SMA':   { fullName: 'Supplementary Motor Area', label: 'Legal Adaptation Analysis', tier: 'operational', function: 'Analyzes legal-organization adaptation to change', dysregulation: 'Adaptation failure', expectedTypes: [{ type: 'Legal change management consulting', reason: 'Helps legal departments adapt to change', confidence: 0.78 }, { type: 'Legal organizational maturity assessment', reason: 'Assesses adaptation capability', confidence: 0.75 }] },
    'SMN':   { fullName: 'Somatomotor Network', label: 'Multi-Counsel Operations', tier: 'operational', function: 'Coordinates day-to-day work across multiple counsel and parties', dysregulation: 'Coordination failure', expectedTypes: [{ type: 'Co-counsel collaboration platform', reason: 'Multi-firm collaboration software', confidence: 0.80 }, { type: 'Legal project management service', reason: 'Project management for complex matters', confidence: 0.82 }] },
    'SN':    { fullName: 'Salience Network', label: 'Legal Outcome Operations', tier: 'operational', function: 'Operates outcome tracking and validation systems', dysregulation: 'Tracking failure', expectedTypes: [{ type: 'Litigation outcome tracking platform', reason: 'Tracks case results and dispositions', confidence: 0.78 }, { type: 'Settlement and judgment tracking service', reason: 'Monitors case outcomes', confidence: 0.75 }] },
    'SNIG':  { fullName: 'Substantia Nigra', label: 'Predictive Model Evaluation', tier: 'operational', function: 'Evaluates legal prediction model performance over time', dysregulation: 'Model drift', expectedTypes: [{ type: 'Legal AI model performance monitoring', reason: 'Tracks legal AI accuracy', confidence: 0.78 }, { type: 'Forecast accuracy validation consulting', reason: 'Validates prediction quality', confidence: 0.75 }] },
    'SNS':   { fullName: 'Sympathetic Nervous System', label: 'Compliance Operations Systems', tier: 'operational', function: 'Operates real-time compliance monitoring systems', dysregulation: 'System failure', expectedTypes: [{ type: 'Real-time compliance monitoring platform', reason: 'Continuous compliance tracking', confidence: 0.85 }, { type: 'AML and KYC monitoring service', reason: 'Anti-money-laundering operational monitoring', confidence: 0.88 }] },
    'STN':   { fullName: 'Subthalamic Nucleus', label: 'Compliance Governance', tier: 'operational', function: 'Governs compliance program structure and enforcement', dysregulation: 'Governance failure', expectedTypes: [{ type: 'Compliance governance consulting', reason: 'Designs compliance frameworks', confidence: 0.82 }, { type: 'Compliance program management software', reason: 'Manages compliance program structure', confidence: 0.85 }] },
    'STS':   { fullName: 'Superior Temporal Sulcus', label: 'Compliance Coverage Evaluation', tier: 'operational', function: 'Evaluates compliance program coverage and effectiveness', dysregulation: 'Coverage blindness', expectedTypes: [{ type: 'Compliance program effectiveness assessment', reason: 'Evaluates compliance program quality', confidence: 0.78 }, { type: 'Compliance benchmarking service', reason: 'Compares compliance across peers', confidence: 0.75 }] },
    'TPOLE': { fullName: 'Temporal Pole', label: 'Legal Trend Analysis', tier: 'operational', function: 'Analyzes trends in legal practice, regulation, and litigation', dysregulation: 'Trend blindness', expectedTypes: [{ type: 'Legal trends and market intelligence service', reason: 'Identifies emerging legal trends', confidence: 0.82 }, { type: 'Regulatory trend monitoring platform', reason: 'Tracks emerging regulatory trends', confidence: 0.85 }] },
    'TrkB':  { fullName: 'TrkB Receptor', label: 'Legal Pattern Analysis', tier: 'operational', function: 'Identifies anomalous patterns in legal data and litigation', dysregulation: 'Pattern miss', expectedTypes: [{ type: 'Anomaly detection for legal data', reason: 'Identifies unusual patterns in legal datasets', confidence: 0.78 }, { type: 'Litigation pattern analytics service', reason: 'Detects litigation patterns and clusters', confidence: 0.80 }] },
    'UNC':   { fullName: 'Uncinate Fasciculus', label: 'Legal Data Aggregation', tier: 'operational', function: 'Aggregates data across legal systems and sources', dysregulation: 'Data gap', expectedTypes: [{ type: 'Legal data aggregation platform', reason: 'Aggregates data across legal systems', confidence: 0.80 }, { type: 'Multi-source legal intelligence service', reason: 'Combines court, regulatory, and news data', confidence: 0.78 }] },
    'V1':    { fullName: 'Primary Visual Cortex', label: 'Legal Sensitivity Testing', tier: 'operational', function: 'Tests sensitivity of legal exposure to parameter changes', dysregulation: 'Sensitivity blindness', expectedTypes: [{ type: 'Legal what-if simulation platform', reason: 'Tests legal exposure under varying scenarios', confidence: 0.75 }, { type: 'Stress-testing for legal portfolios', reason: 'Stress tests for litigation portfolios', confidence: 0.72 }] },
    'VAN':   { fullName: 'Ventral Attention Network', label: 'Legal Workforce Operations', tier: 'operational', function: 'Operates workforce allocation and deployment for legal services', dysregulation: 'Allocation failure', expectedTypes: [{ type: 'Legal staffing marketplace', reason: 'On-demand legal talent allocation', confidence: 0.85 }, { type: 'Legal workforce deployment platform', reason: 'Real-time legal labor allocation', confidence: 0.82 }] },
    'VERM':  { fullName: 'Cerebellar Vermis', label: 'Core Legal Operations', tier: 'operational', function: 'Manages core operational processes for legal organizations', dysregulation: 'Operational failure', expectedTypes: [{ type: 'Law firm practice management software', reason: 'End-to-end practice management', confidence: 0.85 }, { type: 'Legal operations consulting', reason: 'Optimizes core legal processes', confidence: 0.82 }] },
    'VEST':  { fullName: 'Vestibular System', label: 'Conflict of Laws Analysis', tier: 'operational', function: 'Maintains balance across competing legal regimes and jurisdictions', dysregulation: 'Conflict failure', expectedTypes: [{ type: 'Conflict of laws specialist', reason: 'Resolves choice-of-law and conflicts questions', confidence: 0.80 }, { type: 'Multi-state legal comparison platform', reason: 'Compares legal regimes across states', confidence: 0.78 }] },
    'VTA':   { fullName: 'Ventral Tegmental Area', label: 'Cross-Industry Legal Learning', tier: 'operational', function: 'Drives cross-industry knowledge transfer in legal practice', dysregulation: 'Learning failure', expectedTypes: [{ type: 'Cross-industry legal benchmarking', reason: 'Transfers practices across industries', confidence: 0.75 }, { type: 'Legal knowledge management platform', reason: 'Centralized legal knowledge base', confidence: 0.78 }] },
    'VV':    { fullName: 'Ventral Vagal Complex', label: 'Legal Operations Integration', tier: 'operational', function: 'Integrates operational systems across legal functions', dysregulation: 'Integration failure', expectedTypes: [{ type: 'Legal-ops integration platform', reason: 'Connects legal systems end-to-end', confidence: 0.82 }, { type: 'iPaaS for legal departments', reason: 'Integration platform for legaltech stacks', confidence: 0.78 }] },
    'dACC':  { fullName: 'Dorsal Anterior Cingulate', label: 'Conflict Detection & Resolution', tier: 'operational', function: 'Detects conflicts and routes them to appropriate resolution mechanisms', dysregulation: 'Conflict blindness, resolution failure', expectedTypes: [{ type: 'Conflict-of-interest screening software', reason: 'Automated conflict checks for law firms', confidence: 0.92 }, { type: 'ADR (alternative dispute resolution) provider', reason: 'Mediation and arbitration services', confidence: 0.88 }] },
    'mPFC':  { fullName: 'Medial Prefrontal Cortex', label: 'Legal Quality Operations', tier: 'operational', function: 'Operates quality management across legal work product', dysregulation: 'Quality failure', expectedTypes: [{ type: 'Legal QMS vendor', reason: 'Quality management for legal work', confidence: 0.78 }, { type: 'Brief and document quality review service', reason: 'Independent quality review', confidence: 0.80 }] },
    'rACC':  { fullName: 'Rostral Anterior Cingulate', label: 'Legal Quality Analysis', tier: 'operational', function: 'Analyzes quality metrics and identifies improvement areas', dysregulation: 'Quality blindness', expectedTypes: [{ type: 'Legal work product analytics', reason: 'Analyzes quality of legal deliverables', confidence: 0.75 }, { type: 'Document quality auditing service', reason: 'Audits quality of legal documents', confidence: 0.78 }] },
    'vlPFC': { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Compliance Operations', tier: 'operational', function: 'Operates day-to-day compliance processes for the organization', dysregulation: 'Operational compliance failure', expectedTypes: [{ type: 'Compliance operations platform', reason: 'Day-to-day compliance workflow management', confidence: 0.85 }, { type: 'Outsourced compliance operations service', reason: 'Compliance operations outsourcing', confidence: 0.82 }] }
  };

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadApprovals() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveApprovals(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function approvalKey(nodeId, businessType) {
    return nodeId + '::' + businessType.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);
  }

  function getApprovalStatus(nodeId, businessType) {
    var approvals = loadApprovals();
    return approvals[approvalKey(nodeId, businessType)] || null;
  }

  function setApprovalStatus(nodeId, businessType, status, reason, reviewerRole) {
    var approvals = loadApprovals();
    var key = approvalKey(nodeId, businessType);
    var existing = approvals[key] || {};
    approvals[key] = {
      status: status,
      reason: reason || '',
      nodeId: nodeId,
      businessType: businessType,
      submitted_by: existing.submitted_by || 'operator',
      submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(),
      reviewer: reviewerRole || 'operator'
    };
    saveApprovals(approvals);
    return approvals[key];
  }

  // ══════════════════════════════════════════════════════════════════════
  // FULL HIERARCHY TRAVERSAL — loads child portal company/treatment data
  // ══════════════════════════════════════════════════════════════════════

  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  function loadFullHierarchy(callback) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) {
      return callback(_hierarchyCache);
    }

    try {
      var cached = JSON.parse(sessionStorage.getItem(HIERARCHY_CACHE_KEY));
      if (cached && cached._age && (Date.now() - cached._age) < HIERARCHY_TTL) {
        _hierarchyCache = cached;
        _hierarchyCacheAge = cached._age;
        return callback(cached);
      }
    } catch (e) {}

    var brains = window.LIMENDomainBrains;
    if (!brains) return callback(null);
    var brain = brains.get('law');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = {
      nodeCompanies: {},
      nodeTreatments: {},
      nodeDiagnoses: {},
      nodeLabels: {},
      nodeDepths: {},
      allActivations: []
    };

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
          if (!result.nodeCompanies[nid][tk]) {
            result.nodeCompanies[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason, strength: cos[ci].binding_strength };
          }
        }

        var treats = a.treatments || [];
        for (var ti = 0; ti < treats.length; ti++) {
          var t = treats[ti];
          if (isGenericTreatment(t.label)) continue;
          var tKey = (t.label || '') + '|' + (t.type || '');
          if (!result.nodeTreatments[nid][tKey]) {
            result.nodeTreatments[nid][tKey] = { label: t.label, type: t.type, evidence: t.evidence };
          }
        }

        var dx = a.diagnosticTriggers || [];
        for (var di = 0; di < dx.length; di++) {
          result.nodeDiagnoses[nid][dx[di]] = true;
        }

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

  // ══════════════════════════════════════════════════════════════════════
  // INFERENCE ENGINE — compares directory against full hierarchy
  // ══════════════════════════════════════════════════════════════════════

  function getLawState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('law');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getLawState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('law') : null;
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

    var mapped = [];
    var missing = [];
    var speculative = [];

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
      for (var tk in existingCos) {
        mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')');
      }

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
          if (expected.confidence >= 0.85) {
            consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Law. It will appear as a valid target in investment and research opportunities tied to ' + dir.label + '.';
          } else if (expected.confidence >= 0.75) {
            consequence = 'If approved: this business type becomes eligible for future portal path mapping and audit tracking within Law.';
          } else {
            consequence = 'If approved: this business type is recorded as a valid Law mapping for audit tracking. Requires further validation.';
          }
        }

        var variantState = 'ACTIVE';
        if (approval) {
          if (approval.status === 'DENIED') variantState = 'REJECTED';
          else if (approval.status === 'APPROVED') variantState = 'ACTIVE';
          else variantState = 'PROPOSED';
        } else if (!alreadyMapped && expected.confidence >= 0.75) {
          variantState = 'MISSING';
        } else if (!alreadyMapped) {
          variantState = 'PROPOSED';
        } else {
          variantState = 'MAPPED';
        }
        var showButtons = !!approval || variantState === 'PROPOSED' || variantState === 'MISSING';
        var cardKey = nodeId + '::' + (expected.type || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

        var entry = {
          cardKey: cardKey,
          nodeId: nodeId,
          nodeFullName: dir.fullName || nodeId,
          nodeLabel: dir.label,
          nodeFunction: dir.function,
          plainFunction: dir.function,
          dysregulation: dir.dysregulation || '',
          plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type,
          reason: expected.reason,
          confidence: expected.confidence,
          nodeActive: nodeActive,
          alreadyMapped: alreadyMapped,
          existingCompanies: mappedCompanyNames,
          approval: approval,
          approvalRequired: showButtons,
          variantState: variantState,
          approvalConsequence: consequence,
          tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' +
            (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
            'This creates demand for: ' + expected.type + '. ' + expected.reason + '.'
        };

        if (alreadyMapped) {
          entry.bucket = 'MAPPED';
          mapped.push(entry);
        } else if (expected.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          if (!approval) {
            setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed by inference engine');
            entry.approval = getApprovalStatus(nodeId, expected.type);
          }
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          if (!approval) {
            setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed \u2014 low confidence');
            entry.approval = getApprovalStatus(nodeId, expected.type);
          }
          speculative.push(entry);
        }
      }
    }

    function dedupeExact(arr) {
      var seen = {}; var out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped);
    missing = dedupeExact(missing);
    speculative = dedupeExact(speculative);

    var sortFn = function (a, b) {
      var tierOrder = { 'top': 0, 'operational': 1 };
      var ta = tierOrder[a.tier] || 1, tb = tierOrder[b.tier] || 1;
      if (ta !== tb) return ta - tb;
      if (a.nodeActive !== b.nodeActive) return a.nodeActive ? -1 : 1;
      return b.confidence - a.confidence;
    };
    mapped.sort(sortFn);
    missing.sort(sortFn);
    speculative.sort(sortFn);

    return { mapped: mapped, missing: missing, speculative: speculative, error: null };
  }

  function getApprovedMappings() {
    var result = runInference(null);
    var approved = [];
    var all = result.missing.concat(result.speculative);
    for (var i = 0; i < all.length; i++) {
      if (all[i].approval && all[i].approval.status === 'APPROVED') {
        approved.push(all[i]);
      }
    }
    return approved;
  }

  window.LIMENLawBusinessEngine = {
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

  loadFullHierarchy(function () {
    console.log('[LawBusinessEngine] Hierarchy loaded');
  });

  console.log('[LawBusinessEngine] Loaded \u2014 103-node full-hierarchy law business assignment engine');

})();
