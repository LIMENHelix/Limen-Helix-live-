/**
 * medicine-node-business-engine.js — Medicine Node-to-Business Assignment Engine
 *
 * MEDICINE DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture:
 *   - Covers 102 operational nodes (20 RI/framework nodes excluded)
 *   - Filters generic template treatments before inference
 *   - Compares existing companies against business-type directory
 *
 * Outputs 3 buckets:
 *   MAPPED     — already mapped and active in Medicine system
 *   MISSING    — plausible but missing from current Medicine mappings
 *   SPECULATIVE — low-confidence or novel suggestions
 *
 * Approval statuses:
 *   PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_medicine_business_approvals')
 *
 * Self-gates: only runs when ?domain=medicine is in the URL.
 * Exposes: window.LIMENMedicineBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'medicine') return;

  var STORAGE_KEY = 'limen_medicine_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_medicine_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

  // ══════════════════════════════════════════════════════════════════════
  // RI/FRAMEWORK NODES — excluded from business generation
  // ══════════════════════════════════════════════════════════════════════

  var RI_NODES = {
    'ACC': true, 'ASTRO': true, 'BBB': true, 'DMNMTL': true, 'EBA': true,
    'FPC': true, 'IPL': true, 'MFC': true, 'MI': true, 'PMC': true,
    'PPA': true, 'PRC': true, 'S2': true, 'SCN': true, 'SDH': true,
    'SPL': true, 'V4V5': true, 'VIA': true, 'rPFC': true, 'sgACC': true
  };

  // ══════════════════════════════════════════════════════════════════════
  // GENERIC TREATMENT FILTER
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
  // CANONICAL NODE BUSINESS DIRECTORY — 102 operational nodes
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {

    // ── TOP-TIER (22 portal-active) ──────────────────────────────────

    'M1': { fullName: 'Primary Motor Cortex', label: 'Surgical Procedures & Motor Rehab', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output stage — sends direct commands for voluntary movement.', inBusiness: 'In medicine, this is surgical execution and motor rehabilitation — the direct physical interventions that treat disease through hands-on procedures and movement therapy.' },
      function: 'Executes surgical procedures, motor rehabilitation programs, and physical therapy interventions',
      dysregulation: 'Surgical complication, rehabilitation failure, motor function decline post-procedure',
      expectedTypes: [
        { type: 'Surgical robotics company', reason: 'Robotic-assisted surgery platforms improving precision and reducing complication rates', confidence: 0.95 },
        { type: 'Physical rehabilitation technology firm', reason: 'Wearable sensors and AI-guided rehabilitation for post-surgical and stroke recovery', confidence: 0.88 },
        { type: 'Surgical training simulation company', reason: 'VR/AR surgical simulators for resident training and procedure planning', confidence: 0.82 }
      ] },
    'THAL': { fullName: 'Thalamus', label: 'Clinical Data Integration & EHR', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays nearly all sensory and motor signals between subcortical structures and cortex.', inBusiness: 'In medicine, this is clinical data integration — the central relay of patient data from all clinical sources into electronic health records and health information exchanges.' },
      function: 'Integrates and routes clinical data across departments, facilities, and care settings through EHR systems',
      dysregulation: 'EHR interoperability failure, data fragmentation, clinical information loss during handoffs',
      expectedTypes: [
        { type: 'Health information exchange platform', reason: 'Cross-system clinical data exchange enabling care coordination across providers', confidence: 0.95 },
        { type: 'EHR integration company', reason: 'FHIR/HL7 middleware connecting disparate clinical systems into unified patient records', confidence: 0.90 },
        { type: 'Clinical data normalization service', reason: 'Standardizing clinical terminology (SNOMED, ICD, LOINC) across health systems', confidence: 0.85 }
      ] },
    'STRI': { fullName: 'Striatum', label: 'Patient Engagement & Adherence', tier: 'top',
      neuroTranslation: { inNeurology: 'Central to habit formation and reward-based learning through dopaminergic feedback.', inBusiness: 'In medicine, this is patient engagement — the habitual health behaviors, medication adherence, and self-care patterns that determine treatment outcomes.' },
      function: 'Drives patient engagement, medication adherence, and health behavior change programs',
      dysregulation: 'Medication non-adherence, patient dropout, chronic disease self-management failure',
      expectedTypes: [
        { type: 'Digital therapeutics company', reason: 'FDA-cleared software interventions for behavior change in chronic disease management', confidence: 0.95 },
        { type: 'Medication adherence platform', reason: 'Smart pill dispensers, reminder systems, and adherence tracking with pharmacy integration', confidence: 0.90 },
        { type: 'Patient engagement technology firm', reason: 'Gamified health apps, care plan tools, and patient portal enhancements', confidence: 0.85 }
      ] },
    'VTA': { fullName: 'Ventral Tegmental Area', label: 'Medical Innovation & Drug Discovery', tier: 'top',
      neuroTranslation: { inNeurology: 'Origin of mesolimbic dopamine pathway — drives reward-seeking and novelty exploration.', inBusiness: 'In medicine, this is drug discovery and medical innovation — the research-driven pursuit of novel therapeutics, diagnostics, and treatment modalities.' },
      function: 'Drives medical innovation through drug discovery, novel therapeutic development, and clinical research breakthroughs',
      dysregulation: 'Drug pipeline failure, innovation drought, clinical trial failure cascade',
      expectedTypes: [
        { type: 'Drug discovery AI platform', reason: 'Machine learning-driven target identification, molecular design, and clinical trial optimization', confidence: 0.92 },
        { type: 'Biotech venture studio', reason: 'Early-stage therapeutic company creation and development from academic research', confidence: 0.85 },
        { type: 'Clinical trial innovation company', reason: 'Decentralized trials, adaptive designs, and real-world evidence platforms', confidence: 0.82 }
      ] },
    'PAG': { fullName: 'Periaqueductal Gray', label: 'Pain Management & Palliative Care', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates defensive responses and pain modulation under threat.', inBusiness: 'In medicine, this is pain management — the assessment and treatment of acute and chronic pain, including palliative care for life-limiting conditions.' },
      function: 'Manages pain assessment, multimodal pain treatment, and palliative care delivery',
      dysregulation: 'Opioid crisis, uncontrolled chronic pain, palliative care access gaps, pain assessment failure',
      expectedTypes: [
        { type: 'Non-opioid pain therapeutics company', reason: 'Novel analgesics, neuromodulation devices, and non-pharmacological pain interventions', confidence: 0.92 },
        { type: 'Palliative care technology platform', reason: 'Symptom management tools, goals-of-care documentation, and hospice coordination', confidence: 0.85 },
        { type: 'Pain assessment analytics firm', reason: 'Objective pain measurement, opioid risk scoring, and multimodal treatment planning', confidence: 0.82 }
      ] },
    'HIPP': { fullName: 'Hippocampus', label: 'Medical Knowledge & Clinical Evidence', tier: 'top',
      neuroTranslation: { inNeurology: 'Forms and consolidates new memories into long-term storage.', inBusiness: 'In medicine, this is clinical evidence — the accumulation of medical knowledge from clinical trials, case studies, and systematic reviews that inform evidence-based practice.' },
      function: 'Preserves and disseminates clinical evidence, medical literature, and treatment guidelines',
      dysregulation: 'Evidence-practice gap, outdated clinical guidelines, publication bias',
      expectedTypes: [
        { type: 'Clinical evidence synthesis platform', reason: 'Automated systematic reviews, meta-analysis tools, and living guideline systems', confidence: 0.90 },
        { type: 'Medical knowledge management company', reason: 'Clinical decision support content, drug interaction databases, and point-of-care reference tools', confidence: 0.88 },
        { type: 'Real-world evidence analytics firm', reason: 'Post-market surveillance, treatment effectiveness studies, and claims-based research', confidence: 0.85 }
      ] },
    'NTS': { fullName: 'Nucleus Tractus Solitarius', label: 'Vital Signs & Patient Monitoring', tier: 'top',
      neuroTranslation: { inNeurology: 'Primary relay for visceral sensory input — integrates cardiovascular and respiratory signals.', inBusiness: 'In medicine, this is patient monitoring — the continuous collection of vital signs, hemodynamic data, and physiological parameters that detect clinical deterioration.' },
      function: 'Collects, analyzes, and alerts on vital signs and physiological data from patients',
      dysregulation: 'Alarm fatigue, missed clinical deterioration, monitoring gaps in transitions of care',
      expectedTypes: [
        { type: 'Remote patient monitoring company', reason: 'Connected devices for continuous vital sign tracking with AI-based early warning', confidence: 0.95 },
        { type: 'Clinical surveillance platform', reason: 'Hospital early warning systems detecting sepsis, cardiac events, and respiratory failure', confidence: 0.90 },
        { type: 'Wearable biosensor company', reason: 'Medical-grade wearables for ambulatory cardiac, respiratory, and metabolic monitoring', confidence: 0.88 }
      ] },
    'CC': { fullName: 'Corpus Callosum', label: 'Care Coordination & Referral Networks', tier: 'top',
      neuroTranslation: { inNeurology: 'Largest white matter tract connecting left and right hemispheres.', inBusiness: 'In medicine, this is care coordination — the referral networks, care transitions, and provider communication that connect primary care, specialists, and post-acute services.' },
      function: 'Connects healthcare providers through referral networks, care transitions, and inter-provider communication',
      dysregulation: 'Care fragmentation, lost referrals, transition-of-care failures, duplicated testing',
      expectedTypes: [
        { type: 'Care coordination platform', reason: 'Referral management, care transition tracking, and provider communication tools', confidence: 0.95 },
        { type: 'Health information exchange', reason: 'Cross-organizational clinical data sharing for coordinated care delivery', confidence: 0.88 },
        { type: 'Post-acute care network company', reason: 'Skilled nursing, home health, and rehabilitation provider matching and tracking', confidence: 0.82 }
      ] },
    'FORN': { fullName: 'Fornix', label: 'Clinical Data Pipelines & FHIR APIs', tier: 'top',
      neuroTranslation: { inNeurology: 'Major white matter bundle carrying output from hippocampus — dedicated fiber pathway.', inBusiness: 'In medicine, this is clinical data infrastructure — the dedicated pipelines carrying lab results, imaging reports, and clinical notes between healthcare systems via FHIR and HL7.' },
      function: 'Provides core clinical data infrastructure including FHIR APIs, HL7 interfaces, and health data pipelines',
      dysregulation: 'Data pipeline failure, interface breakdown, clinical data latency',
      expectedTypes: [
        { type: 'Healthcare API platform', reason: 'FHIR-native clinical data APIs enabling app development on health system data', confidence: 0.92 },
        { type: 'Clinical data integration middleware', reason: 'HL7v2/FHIR translation, data normalization, and bidirectional EHR connectivity', confidence: 0.88 },
        { type: 'Health data warehouse company', reason: 'Clinical data lake infrastructure for analytics, research, and population health', confidence: 0.85 }
      ] },
    'CBLM': { fullName: 'Cerebellum', label: 'Quality Measurement & Standards', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates voluntary movement with precise timing and calibration.', inBusiness: 'In medicine, this is clinical quality — precisely calibrated quality measurement, accreditation standards, and performance benchmarking that drive healthcare improvement.' },
      function: 'Implements clinical quality measurement, accreditation standards, and performance improvement programs',
      dysregulation: 'Quality measure gaming, accreditation failure, clinical performance decline',
      expectedTypes: [
        { type: 'Healthcare quality analytics firm', reason: 'HEDIS, Stars, MIPS quality measure calculation, benchmarking, and improvement analytics', confidence: 0.95 },
        { type: 'Clinical accreditation consultancy', reason: 'Joint Commission, NCQA, URAC accreditation preparation and ongoing compliance', confidence: 0.88 },
        { type: 'Patient safety analytics platform', reason: 'Adverse event tracking, root cause analysis, and safety culture measurement', confidence: 0.85 }
      ] },
    'OFC': { fullName: 'Orbitofrontal Cortex', label: 'Clinical Decision-Making & Diagnosis', tier: 'top',
      neuroTranslation: { inNeurology: 'Assigns value to choices and outcomes — integrates reward for decision-making.', inBusiness: 'In medicine, this is clinical decision-making — how physicians weigh symptoms, test results, and clinical evidence to arrive at diagnoses and treatment plans.' },
      function: 'Supports clinical decision-making through diagnostic algorithms, clinical pathways, and treatment selection tools',
      dysregulation: 'Diagnostic error, treatment selection bias, clinical pathway non-adherence',
      expectedTypes: [
        { type: 'AI diagnostic platform', reason: 'Machine learning models for differential diagnosis, imaging interpretation, and lab result analysis', confidence: 0.95 },
        { type: 'Clinical pathway management company', reason: 'Evidence-based order sets, treatment protocols, and clinical variation reduction tools', confidence: 0.88 },
        { type: 'Diagnostic decision support firm', reason: 'Bayesian reasoning engines, symptom checkers, and diagnostic probability calculators', confidence: 0.82 }
      ] },
    'S1': { fullName: 'Primary Somatosensory Cortex', label: 'Diagnostic Testing & Lab Results', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes tactile, pressure, and temperature signals from the body.', inBusiness: 'In medicine, this is diagnostic testing — the raw clinical data from lab tests, imaging studies, and physical examinations that clinicians use to assess patient status.' },
      function: 'Collects and disseminates diagnostic test results including laboratory, imaging, and point-of-care testing',
      dysregulation: 'Lab error, delayed results, test result communication failure, over-testing',
      expectedTypes: [
        { type: 'Point-of-care diagnostics company', reason: 'Rapid diagnostic tests for infectious disease, cardiac markers, and metabolic panels at bedside', confidence: 0.95 },
        { type: 'Laboratory informatics platform', reason: 'LIS systems, specimen tracking, and automated result interpretation', confidence: 0.88 },
        { type: 'Diagnostic imaging AI company', reason: 'AI-assisted radiology reading, pathology slide analysis, and imaging workflow optimization', confidence: 0.90 }
      ] },
    'ENS': { fullName: 'Enteric Nervous System', label: 'Hospital Operations & Administration', tier: 'top',
      neuroTranslation: { inNeurology: 'Autonomous nervous system of the gut — manages digestion independently.', inBusiness: 'In medicine, this is hospital operations — the autonomous administrative processes handling bed management, staffing, supplies, and facilities.' },
      function: 'Manages hospital operations including bed flow, staffing, supply chain, and facility management',
      dysregulation: 'ED boarding crisis, staffing shortage, supply chain disruption, operational inefficiency',
      expectedTypes: [
        { type: 'Hospital operations platform', reason: 'Real-time bed management, patient flow optimization, and capacity planning', confidence: 0.92 },
        { type: 'Healthcare workforce management company', reason: 'Nurse scheduling, physician credentialing, and staffing optimization', confidence: 0.88 },
        { type: 'Medical supply chain platform', reason: 'Hospital inventory management, GPO contract optimization, and supply forecasting', confidence: 0.85 }
      ] },
    'dlPFC': { fullName: 'Dorsolateral Prefrontal Cortex', label: 'Treatment Planning & Protocol Design', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports working memory, planning, and multi-goal coordination.', inBusiness: 'In medicine, this is treatment planning — developing multi-step care plans, clinical trial protocols, and population health intervention strategies.' },
      function: 'Develops treatment plans, clinical protocols, and multi-step care management strategies',
      dysregulation: 'Treatment plan fragmentation, protocol non-adherence, care plan complexity overload',
      expectedTypes: [
        { type: 'Clinical trial protocol design platform', reason: 'AI-assisted protocol development, endpoint selection, and study design optimization', confidence: 0.90 },
        { type: 'Care plan management company', reason: 'Longitudinal care planning tools for complex chronic disease management', confidence: 0.88 },
        { type: 'Population health strategy firm', reason: 'Community health needs assessment, intervention design, and outcomes tracking', confidence: 0.82 }
      ] },
    'dACC': { fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Clinical Anomaly & Adverse Event Detection', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects conflicts and errors, signaling when corrective action is needed.', inBusiness: 'In medicine, this is clinical anomaly detection — identifying adverse drug reactions, diagnostic errors, and patient safety events that require corrective action.' },
      function: 'Detects clinical anomalies, adverse events, and safety signals that require intervention',
      dysregulation: 'Missed adverse drug reaction, undetected diagnostic error, safety signal failure',
      expectedTypes: [
        { type: 'Pharmacovigilance AI platform', reason: 'Automated adverse event detection from EHR data, social media, and patient reports', confidence: 0.92 },
        { type: 'Clinical safety surveillance system', reason: 'Real-time detection of hospital-acquired conditions, medication errors, and falls', confidence: 0.88 },
        { type: 'Diagnostic error detection company', reason: 'AI-powered diagnostic second opinions and error pattern identification', confidence: 0.85 }
      ] },
    'vmPFC': { fullName: 'Ventromedial Prefrontal Cortex', label: 'Healthcare Regulation & Compliance', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes subjective value and integrates emotional significance into decisions.', inBusiness: 'In medicine, this is healthcare regulation — FDA oversight, CMS conditions of participation, and state medical board rules that set the boundaries of clinical practice.' },
      function: 'Sets and enforces healthcare regulations including FDA approval, CMS compliance, and medical licensing standards',
      dysregulation: 'Regulatory non-compliance, FDA warning letter, CMS deficiency, license revocation',
      expectedTypes: [
        { type: 'Healthcare compliance platform', reason: 'CMS Conditions of Participation tracking, Joint Commission readiness, and state regulation monitoring', confidence: 0.92 },
        { type: 'FDA regulatory affairs consultancy', reason: '510(k), PMA, IND/NDA submission support and regulatory strategy', confidence: 0.90 },
        { type: 'Healthcare audit and compliance firm', reason: 'Billing compliance, Stark/Anti-Kickback analysis, and OIG exclusion monitoring', confidence: 0.85 }
      ] },
    'BNST': { fullName: 'Bed Nucleus of the Stria Terminalis', label: 'Epidemic Surveillance & Health Threats', tier: 'top',
      neuroTranslation: { inNeurology: 'Mediates sustained anxiety and vigilance to uncertain threats.', inBusiness: 'In medicine, this is epidemic surveillance — monitoring for emerging infectious diseases, bioterrorism threats, and public health emergencies that require sustained vigilance.' },
      function: 'Monitors and assesses emerging health threats including epidemics, antimicrobial resistance, and biosecurity risks',
      dysregulation: 'Missed outbreak detection, pandemic preparedness failure, surveillance system gaps',
      expectedTypes: [
        { type: 'Epidemic intelligence platform', reason: 'AI-powered disease surveillance using syndromic data, wastewater testing, and social media signals', confidence: 0.92 },
        { type: 'Antimicrobial resistance monitoring firm', reason: 'AMR pattern tracking, antibiotic stewardship analytics, and resistance gene surveillance', confidence: 0.88 },
        { type: 'Biosurveillance technology company', reason: 'Environmental monitoring, pathogen detection, and biodefense preparedness tools', confidence: 0.82 }
      ] },
    'CAUD': { fullName: 'Caudate', label: 'Telemedicine & Digital Care Delivery', tier: 'top',
      neuroTranslation: { inNeurology: 'Part of basal ganglia involved in goal-directed action selection and reward anticipation.', inBusiness: 'In medicine, this is telemedicine — the goal-directed pursuit of remote care delivery, virtual consultations, and digital-first healthcare access.' },
      function: 'Delivers healthcare through telemedicine, virtual visits, and remote care platforms',
      dysregulation: 'Telemedicine access barriers, virtual care quality gaps, digital divide in healthcare',
      expectedTypes: [
        { type: 'Telemedicine platform company', reason: 'Video visit technology, asynchronous consults, and virtual care workflow management', confidence: 0.95 },
        { type: 'Remote monitoring and telehealth company', reason: 'Connected devices with clinician dashboards for managing chronic conditions remotely', confidence: 0.90 },
        { type: 'Virtual specialty care platform', reason: 'Telepsychiatry, tele-dermatology, and tele-ICU services for underserved areas', confidence: 0.85 }
      ] },
    'FEF': { fullName: 'Frontal Eye Fields', label: 'Clinical Trial Recruitment & Site Selection', tier: 'top',
      neuroTranslation: { inNeurology: 'Controls voluntary eye movements directing visual attention.', inBusiness: 'In medicine, this is directed clinical research recruitment — targeting specific patient populations, trial sites, and research institutions for clinical study enrollment.' },
      function: 'Directs clinical trial site selection, patient recruitment, and research participant matching',
      dysregulation: 'Trial enrollment failure, site underperformance, recruitment delays extending timelines by years',
      expectedTypes: [
        { type: 'Clinical trial recruitment platform', reason: 'AI-matched patient-trial matching, site feasibility analysis, and recruitment optimization', confidence: 0.92 },
        { type: 'Research site network company', reason: 'Managed clinical trial site networks with performance tracking and quality oversight', confidence: 0.88 },
        { type: 'Patient registry platform', reason: 'Disease-specific registries enabling research recruitment and natural history studies', confidence: 0.82 }
      ] },
    'EMP': { fullName: 'Empathy', label: 'Health Equity & Social Determinants', tier: 'top',
      neuroTranslation: { inNeurology: 'Neural basis of understanding others\' states and experiences.', inBusiness: 'In medicine, this is health equity — understanding how social determinants, structural racism, and economic disparities create unequal health outcomes across populations.' },
      function: 'Measures and addresses health disparities, social determinants of health, and healthcare access inequities',
      dysregulation: 'Health disparity widening, SDOH screening failure, community health neglect',
      expectedTypes: [
        { type: 'Social determinants of health platform', reason: 'SDOH screening, community resource directories, and closed-loop referral tracking', confidence: 0.92 },
        { type: 'Health equity analytics firm', reason: 'Disparity measurement, equity-adjusted quality metrics, and DEI impact assessment', confidence: 0.88 },
        { type: 'Community health technology company', reason: 'CHW workflow tools, community health needs assessment, and population health outreach', confidence: 0.82 }
      ] },
    'BROCA': { fullName: 'Broca\'s Area', label: 'Medical Documentation & Clinical Notes', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured speech output — translates thought into articulated language.', inBusiness: 'In medicine, this is clinical documentation — translating physician observations and clinical reasoning into structured medical records, discharge summaries, and coding-ready notes.' },
      function: 'Produces structured clinical documentation including progress notes, operative reports, and discharge summaries',
      dysregulation: 'Documentation burden, note bloat, coding errors, physician burnout from clerical load',
      expectedTypes: [
        { type: 'Ambient clinical documentation company', reason: 'AI-powered ambient listening that generates clinical notes from physician-patient conversations', confidence: 0.95 },
        { type: 'Clinical NLP platform', reason: 'Natural language processing of unstructured clinical text for coding, research, and quality', confidence: 0.90 },
        { type: 'Medical transcription and coding firm', reason: 'Computer-assisted coding, CDI programs, and documentation improvement services', confidence: 0.85 }
      ] },
    'CING': { fullName: 'Cingulum', label: 'Pharmaceutical Supply Chain', tier: 'top',
      neuroTranslation: { inNeurology: 'White matter bundle connecting frontal and temporal lobes — carries signals along a fixed pathway.', inBusiness: 'In medicine, this is pharmaceutical supply chain — the fixed distribution pathways from drug manufacturer through wholesaler to pharmacy to patient, including cold chain and controlled substance tracking.' },
      function: 'Manages pharmaceutical distribution, drug supply chain integrity, and medication logistics',
      dysregulation: 'Drug shortage, supply chain disruption, counterfeit medication infiltration, cold chain failure',
      expectedTypes: [
        { type: 'Pharmaceutical supply chain platform', reason: 'DSCSA compliance, drug serialization tracking, and supply chain visibility', confidence: 0.92 },
        { type: 'Drug shortage intelligence firm', reason: 'Shortage prediction, alternative sourcing, and therapeutic substitution analytics', confidence: 0.88 },
        { type: 'Cold chain logistics company', reason: 'Temperature-controlled pharmaceutical shipping with real-time monitoring and compliance documentation', confidence: 0.82 }
      ] },

    // ── OPERATIONAL NODES (80) ───────────────────────────────────────

    'A1': { fullName: 'Primary Auditory Cortex', label: 'Clinical Communication & Alerts', tier: 'operational', function: 'Processes clinical communication signals including alarm systems, verbal orders, and SBAR handoffs', dysregulation: 'Alarm fatigue, miscommunication during handoffs, verbal order errors', expectedTypes: [
      { type: 'Clinical communication platform', reason: 'Secure messaging, HIPAA-compliant texting, and role-based clinical alerts', confidence: 0.88 },
      { type: 'Alarm management system', reason: 'Smart alarm prioritization reducing alarm fatigue in ICU and acute care settings', confidence: 0.82 }
    ]},
    'ADR': { fullName: 'Adrenal', label: 'Emergency Medicine & Trauma', tier: 'operational', function: 'Mobilizes emergency medical response including trauma activation, code teams, and disaster medicine', dysregulation: 'ED overcrowding, trauma system failure, code response delays', expectedTypes: [
      { type: 'Emergency department operations platform', reason: 'ED patient flow, triage optimization, and boarding management', confidence: 0.90 },
      { type: 'Trauma system analytics company', reason: 'Trauma registry, injury severity scoring, and trauma center performance benchmarking', confidence: 0.85 }
    ]},
    'AG': { fullName: 'Angular Gyrus', label: 'Medical Coding & Classification', tier: 'operational', function: 'Maintains medical coding standards (ICD-10, CPT, SNOMED, LOINC) and clinical classification systems', dysregulation: 'Coding errors, classification mismatch, claim denials from incorrect coding', expectedTypes: [
      { type: 'Medical coding AI company', reason: 'Automated ICD-10/CPT code suggestion from clinical documentation', confidence: 0.90 },
      { type: 'Clinical terminology management firm', reason: 'SNOMED CT, LOINC, and RxNorm mapping and maintenance services', confidence: 0.82 }
    ]},
    'AI': { fullName: 'Anterior Insula', label: 'Patient Experience & Satisfaction', tier: 'operational', function: 'Provides real-time visibility into patient experience, satisfaction scores, and care quality perception', dysregulation: 'Low HCAHPS scores, patient complaints, poor care experience', expectedTypes: [
      { type: 'Patient experience analytics platform', reason: 'Real-time HCAHPS tracking, sentiment analysis, and experience improvement tools', confidence: 0.88 },
      { type: 'Healthcare service recovery company', reason: 'Real-time complaint resolution, service recovery workflows, and patient advocacy', confidence: 0.82 }
    ]},
    'ANT': { fullName: 'Anterior Thalamus', label: 'Clinical Order Processing', tier: 'operational', function: 'Processes clinical orders including prescriptions, lab orders, imaging requests, and referrals', dysregulation: 'Order entry errors, duplicate orders, failed order transmission', expectedTypes: [
      { type: 'CPOE optimization company', reason: 'Order set management, clinical decision support alerts, and prescribing workflow', confidence: 0.85 },
      { type: 'Electronic prescribing platform', reason: 'E-prescribing with formulary checks, prior authorization, and PDMP integration', confidence: 0.82 }
    ]},
    'ARC': { fullName: 'Arcuate Fasciculus', label: 'Health Data Interoperability', tier: 'operational', function: 'Connects clinical data systems through standardized interfaces and interoperability frameworks', dysregulation: 'Interface failures, data format mismatches, information blocking', expectedTypes: [
      { type: 'Healthcare interoperability platform', reason: 'FHIR API gateways, HL7 translation engines, and data exchange orchestration', confidence: 0.90 },
      { type: 'Trusted Exchange Framework service', reason: 'TEFCA-aligned health information exchange enabling nationwide data sharing', confidence: 0.82 }
    ]},
    'BDNF': { fullName: 'BDNF / Plasticity', label: 'Medical Education & Training', tier: 'operational', function: 'Drives medical education modernization, clinical training innovation, and continuing medical education', dysregulation: 'Training deficiency, outdated clinical skills, CME compliance failure', expectedTypes: [
      { type: 'Medical simulation company', reason: 'VR/AR surgical simulators, patient simulation, and procedural training devices', confidence: 0.88 },
      { type: 'CME platform', reason: 'Continuing medical education, board review, and maintenance of certification tools', confidence: 0.82 }
    ]},
    'BLA': { fullName: 'Basolateral Amygdala', label: 'Healthcare Revenue Cycle & Billing', tier: 'operational', function: 'Manages healthcare revenue cycle including charge capture, claims submission, and reimbursement', dysregulation: 'Revenue cycle leakage, claim denials, collections failure, undercoding', expectedTypes: [
      { type: 'Revenue cycle management company', reason: 'End-to-end RCM including coding, billing, denial management, and collections', confidence: 0.92 },
      { type: 'Prior authorization automation platform', reason: 'AI-powered prior auth submission, status tracking, and appeal management', confidence: 0.88 }
    ]},
    'CARD': { fullName: 'Cardiac', label: 'Cardiovascular Medicine', tier: 'operational', function: 'Delivers cardiovascular diagnostics, interventional cardiology, and cardiac rehabilitation', dysregulation: 'Missed cardiac events, catheterization lab delays, heart failure readmissions', expectedTypes: [
      { type: 'Cardiac monitoring company', reason: 'Continuous ECG monitoring, arrhythmia detection, and cardiac implant remote monitoring', confidence: 0.90 },
      { type: 'Heart failure management platform', reason: 'Remote monitoring, medication titration, and readmission prevention for CHF patients', confidence: 0.85 }
    ]},
    'CLAUST': { fullName: 'Claustrum', label: 'Integrated Care Delivery', tier: 'operational', function: 'Integrates diverse clinical services into unified care delivery models', dysregulation: 'Care fragmentation, service duplication, integrated delivery network dysfunction', expectedTypes: [
      { type: 'Integrated care management platform', reason: 'Unified care plans, multi-disciplinary team coordination, and outcome tracking', confidence: 0.88 },
      { type: 'Accountable care organization technology', reason: 'ACO management tools, shared savings calculation, and care gap identification', confidence: 0.82 }
    ]},
    'CMZ': { fullName: 'Cerebellar Motor Zone', label: 'Medical Equipment & Infrastructure', tier: 'operational', function: 'Provides medical equipment, facility infrastructure, and biomedical engineering support', dysregulation: 'Equipment failure, facility maintenance gaps, biomedical engineering backlog', expectedTypes: [
      { type: 'Medical equipment management company', reason: 'CMMS, preventive maintenance, and asset lifecycle management for hospitals', confidence: 0.85 },
      { type: 'Healthcare facility planning firm', reason: 'Hospital design, capacity planning, and clinical space optimization', confidence: 0.80 }
    ]},
    'CON': { fullName: 'Cingulo-Opercular Network', label: 'Clinical Trial Operations', tier: 'operational', function: 'Sustains ongoing clinical trial operations including monitoring, data collection, and regulatory reporting', dysregulation: 'Protocol deviations, monitoring gaps, data quality issues in trials', expectedTypes: [
      { type: 'Clinical trial management platform', reason: 'CTMS, electronic data capture, and trial monitoring workflow automation', confidence: 0.90 },
      { type: 'eClinical solutions company', reason: 'EDC, eConsent, ePRO, and randomization/trial supply management', confidence: 0.85 }
    ]},
    'CeA': { fullName: 'Central Amygdala', label: 'Infection Control & Hospital Epidemiology', tier: 'operational', function: 'Prevents and controls healthcare-associated infections through surveillance, stewardship, and containment', dysregulation: 'HAI outbreak, antibiotic stewardship failure, infection prevention protocol breach', expectedTypes: [
      { type: 'Infection prevention technology company', reason: 'Real-time HAI surveillance, hand hygiene monitoring, and environmental disinfection', confidence: 0.90 },
      { type: 'Antibiotic stewardship platform', reason: 'Antimicrobial prescribing decision support, de-escalation alerts, and resistance tracking', confidence: 0.85 }
    ]},
    'DAN': { fullName: 'Dorsal Attention Network', label: 'Clinical Peer Review & Credentialing', tier: 'operational', function: 'Conducts targeted clinical peer review, physician credentialing, and privileging decisions', dysregulation: 'Inadequate peer review, credentialing delays, impaired practitioner oversight failure', expectedTypes: [
      { type: 'Provider credentialing platform', reason: 'Automated credentialing verification, primary source verification, and privileging management', confidence: 0.88 },
      { type: 'Clinical peer review company', reason: 'Structured peer review workflows, case scoring, and professional practice evaluation', confidence: 0.82 }
    ]},
    'DISS': { fullName: 'Dissolution', label: 'End-of-Life Care & Hospice', tier: 'operational', function: 'Manages end-of-life care, hospice services, and advance care planning', dysregulation: 'Late hospice referral, advance directive gaps, end-of-life care quality failure', expectedTypes: [
      { type: 'Hospice technology platform', reason: 'Hospice eligibility determination, care coordination, and bereavement support tools', confidence: 0.85 },
      { type: 'Advance care planning company', reason: 'Digital advance directive creation, goals-of-care conversations, and POLST management', confidence: 0.82 }
    ]},
    'DMN': { fullName: 'Default Mode Network', label: 'Long-Range Health Planning & Prevention', tier: 'operational', function: 'Develops long-range health plans, preventive care strategies, and wellness programs', dysregulation: 'Prevention gaps, short-term treatment focus, wellness program failure', expectedTypes: [
      { type: 'Preventive health platform', reason: 'Personalized prevention plans, screening reminders, and risk factor management', confidence: 0.85 },
      { type: 'Corporate wellness company', reason: 'Employee health programs, biometric screening, and population risk reduction', confidence: 0.80 }
    ]},
    'DV': { fullName: 'Dorsal Vagal', label: 'Gastroenterology & Gut Health', tier: 'operational', function: 'Delivers gastrointestinal diagnostics, treatments, and gut microbiome interventions', dysregulation: 'GI diagnostic delays, microbiome disruption, colonoscopy quality gaps', expectedTypes: [
      { type: 'Gut microbiome diagnostics company', reason: 'Microbiome sequencing, dysbiosis detection, and personalized probiotic interventions', confidence: 0.85 },
      { type: 'GI procedure technology firm', reason: 'AI-assisted colonoscopy, capsule endoscopy, and GI motility diagnostics', confidence: 0.82 }
    ]},
    'EC': { fullName: 'Entorhinal Cortex', label: 'Patient Navigation & Wayfinding', tier: 'operational', function: 'Guides patients through complex healthcare systems, appointment scheduling, and care navigation', dysregulation: 'Patient confusion, missed appointments, navigation system failure', expectedTypes: [
      { type: 'Patient navigation platform', reason: 'Care navigation, appointment scheduling, and healthcare system wayfinding', confidence: 0.85 },
      { type: 'Oncology navigation company', reason: 'Cancer care coordination, treatment timeline management, and survivorship planning', confidence: 0.82 }
    ]},
    'ECN': { fullName: 'Executive Control Network', label: 'Healthcare Executive Decision Support', tier: 'operational', function: 'Provides C-suite healthcare analytics, strategic planning tools, and executive dashboards', dysregulation: 'Strategic planning failure, executive blind spots, health system leadership errors', expectedTypes: [
      { type: 'Healthcare executive analytics platform', reason: 'C-suite dashboards, strategic planning tools, and competitive intelligence', confidence: 0.85 },
      { type: 'Health system strategy consultancy', reason: 'M&A advisory, service line planning, and market analysis for health systems', confidence: 0.80 }
    ]},
    'EI': { fullName: 'Excitation-Inhibition', label: 'Drug Dosing & Pharmacokinetics', tier: 'operational', function: 'Calibrates drug dosing, pharmacokinetic modeling, and therapeutic drug monitoring', dysregulation: 'Drug overdose, subtherapeutic dosing, narrow therapeutic index medication errors', expectedTypes: [
      { type: 'Pharmacokinetic modeling company', reason: 'Model-informed precision dosing, TDM analytics, and dosing decision support', confidence: 0.88 },
      { type: 'Medication safety platform', reason: 'Dose range checking, drug interaction alerts, and weight-based dosing calculators', confidence: 0.85 }
    ]},
    'ENDO': { fullName: 'Endocrine', label: 'Endocrinology & Metabolic Medicine', tier: 'operational', function: 'Manages endocrine disorders including diabetes, thyroid disease, and metabolic syndrome', dysregulation: 'Diabetes management failure, thyroid disorder misdiagnosis, metabolic syndrome undertreatment', expectedTypes: [
      { type: 'Diabetes management platform', reason: 'CGM data analytics, insulin dosing algorithms, and diabetes care coordination', confidence: 0.92 },
      { type: 'Endocrine telemedicine company', reason: 'Virtual endocrinology consultations and hormone therapy management', confidence: 0.82 }
    ]},
    'FG': { fullName: 'Fusiform Gyrus', label: 'Medical Imaging & Radiology', tier: 'operational', function: 'Processes and interprets medical images including X-ray, CT, MRI, ultrasound, and nuclear medicine', dysregulation: 'Imaging interpretation error, radiology report delays, incidental finding management failure', expectedTypes: [
      { type: 'Radiology AI company', reason: 'AI-assisted image interpretation for chest X-ray, mammography, CT, and pathology', confidence: 0.95 },
      { type: 'Medical imaging workflow platform', reason: 'PACS/VNA, radiology worklist management, and imaging analytics', confidence: 0.85 }
    ]},
    'FPN': { fullName: 'Frontoparietal Network', label: 'Clinical Research Management', tier: 'operational', function: 'Manages clinical research programs including IRB oversight, study coordination, and grant management', dysregulation: 'IRB approval delays, research compliance gaps, grant management inefficiency', expectedTypes: [
      { type: 'Research administration platform', reason: 'IRB management, grant tracking, and research compliance automation', confidence: 0.85 },
      { type: 'Clinical research informatics company', reason: 'Research data management, biorepository tracking, and cohort identification tools', confidence: 0.82 }
    ]},
    'GBA': { fullName: 'Gut-Brain Axis', label: 'Integrated Mental-Physical Health', tier: 'operational', function: 'Manages the intersection of mental and physical health through integrated behavioral health models', dysregulation: 'Mental health screening gaps in primary care, somatization, psychosomatic underdiagnosis', expectedTypes: [
      { type: 'Collaborative care platform', reason: 'Integrated behavioral health in primary care, psychiatric consultation, and measurement-based care', confidence: 0.88 },
      { type: 'Behavioral health screening company', reason: 'PHQ-9, GAD-7, and SBIRT automated screening with referral management', confidence: 0.82 }
    ]},
    'GABA_GLU': { fullName: 'GABA/Glutamate Balance', label: 'Anesthesiology', tier: 'top',
      neuroTranslation: { inNeurology: 'Fundamental excitatory/inhibitory neurotransmitter balance.', inBusiness: 'In medicine, this is anesthesiology — the precise balance of consciousness suppression and vital function maintenance during surgical procedures.' },
      function: 'Administers anesthesia, manages perioperative pain, and maintains patient stability during surgery',
      dysregulation: 'Anesthesia complication, awareness under anesthesia, post-operative pain management failure',
      expectedTypes: [
        { type: 'Anesthesia equipment manufacturer', reason: 'Ventilators, monitors, and drug delivery systems for anesthesia', confidence: 0.90 },
        { type: 'Perioperative care analytics platform', reason: 'Surgical safety checklists, anesthesia record keeping, and outcome tracking', confidence: 0.85 },
        { type: 'Pain management service', reason: 'Acute and chronic pain management, nerve blocks, and regional anesthesia', confidence: 0.82 }
      ]
    },
    'GP': { fullName: 'Globus Pallidus', label: 'Chronic Disease Management', tier: 'operational', function: 'Manages chronic disease populations including COPD, CHF, diabetes, and CKD through care programs', dysregulation: 'Chronic disease progression, readmission cycles, self-management failure', expectedTypes: [
      { type: 'Chronic care management platform', reason: 'CCM program management, remote monitoring, and care plan adherence tracking', confidence: 0.90 },
      { type: 'Chronic disease outcome analytics firm', reason: 'Risk stratification, intervention targeting, and outcome measurement for chronic populations', confidence: 0.85 }
    ]},
    'HAB': { fullName: 'Habenula', label: 'Substance Use & Addiction Medicine', tier: 'operational', function: 'Manages substance use disorders, addiction treatment, and medication-assisted therapy', dysregulation: 'Addiction treatment gaps, MAT access barriers, substance use disorder stigma', expectedTypes: [
      { type: 'Addiction treatment technology company', reason: 'Digital MAT support, recovery management, and substance use monitoring', confidence: 0.88 },
      { type: 'Opioid use disorder platform', reason: 'Buprenorphine prescribing support, PDMP integration, and recovery outcome tracking', confidence: 0.85 }
    ]},
    'HPA': { fullName: 'HPA Axis', label: 'Stress Medicine & Burnout Prevention', tier: 'operational', function: 'Manages physiological stress responses, healthcare worker burnout, and stress-related illness', dysregulation: 'Clinician burnout epidemic, stress-related medical errors, HPA axis dysregulation disorders', expectedTypes: [
      { type: 'Clinician wellness platform', reason: 'Burnout assessment, resilience training, and mental health support for healthcare workers', confidence: 0.88 },
      { type: 'Stress biomarker diagnostics company', reason: 'Cortisol monitoring, HRV analysis, and objective stress measurement', confidence: 0.80 }
    ]},
    'HYPO': { fullName: 'Hypothalamus', label: 'Vital Organ Support & ICU Medicine', tier: 'operational', function: 'Manages critical care including hemodynamic monitoring, ventilator management, and organ support', dysregulation: 'ICU capacity crisis, ventilator management errors, hemodynamic instability', expectedTypes: [
      { type: 'ICU decision support platform', reason: 'Ventilator weaning protocols, hemodynamic optimization, and sepsis management bundles', confidence: 0.88 },
      { type: 'Critical care telemedicine company', reason: 'Tele-ICU services providing remote intensivist oversight for community hospitals', confidence: 0.85 }
    ]},
    'IC': { fullName: 'Insular Cortex', label: 'Symptom Assessment & Triage', tier: 'operational', function: 'Assesses patient symptoms, performs clinical triage, and prioritizes care urgency', dysregulation: 'Triage errors, symptom underestimation, delayed escalation of deteriorating patients', expectedTypes: [
      { type: 'AI triage platform', reason: 'Symptom assessment chatbots, acuity scoring, and ED triage decision support', confidence: 0.90 },
      { type: 'Nurse triage technology company', reason: 'Telephone triage protocols, after-hours nurse line, and disposition decision support', confidence: 0.85 }
    ]},
    'IPS': { fullName: 'Intraparietal Sulcus', label: 'Surgical Planning & Navigation', tier: 'operational', function: 'Plans surgical approaches, navigational guidance, and intraoperative imaging for procedures', dysregulation: 'Surgical planning errors, intraoperative navigation failure, wrong-site surgery', expectedTypes: [
      { type: 'Surgical navigation company', reason: 'Image-guided surgery, intraoperative CT/MRI, and 3D surgical planning', confidence: 0.88 },
      { type: 'Preoperative planning platform', reason: 'AI-assisted surgical approach selection, anatomical modeling, and risk scoring', confidence: 0.82 }
    ]},
    'LANG': { fullName: 'Language Network', label: 'Patient Communication & Health Literacy', tier: 'operational', function: 'Manages patient-provider communication, health literacy, and multilingual care delivery', dysregulation: 'Health literacy barriers, language access failure, miscommunication leading to adverse events', expectedTypes: [
      { type: 'Medical interpreter technology company', reason: 'Video remote interpreting, AI-assisted translation, and multilingual patient materials', confidence: 0.88 },
      { type: 'Health literacy platform', reason: 'Patient education content at appropriate reading levels, visual health guides, and teach-back tools', confidence: 0.82 }
    ]},
    'LAR': { fullName: 'Laryngeal', label: 'Respiratory Medicine & Pulmonology', tier: 'operational', function: 'Manages respiratory conditions including asthma, COPD, respiratory infections, and ventilator patients', dysregulation: 'Respiratory failure, asthma exacerbation, COPD management gaps', expectedTypes: [
      { type: 'Respiratory monitoring company', reason: 'Connected inhalers, spirometry apps, and respiratory rate monitoring', confidence: 0.88 },
      { type: 'Pulmonary rehabilitation platform', reason: 'Virtual pulmonary rehab, breathing exercise guidance, and COPD self-management', confidence: 0.82 }
    ]},
    'LC': { fullName: 'Locus Coeruleus', label: 'Clinical Alertness & Fatigue Management', tier: 'operational', function: 'Manages clinical vigilance, fatigue mitigation, and cognitive performance in healthcare workers', dysregulation: 'Fatigue-related medical errors, resident duty hour violations, cognitive performance decline', expectedTypes: [
      { type: 'Healthcare worker fatigue management company', reason: 'Duty hour tracking, fatigue risk scoring, and schedule optimization', confidence: 0.82 },
      { type: 'Clinical cognitive performance platform', reason: 'Attention monitoring, workload assessment, and error prevention through fatigue detection', confidence: 0.78 }
    ]},
    'LGN': { fullName: 'Lateral Geniculate Nucleus', label: 'Ophthalmology & Vision Care', tier: 'operational', function: 'Delivers ophthalmic diagnostics, vision correction, and eye disease treatment', dysregulation: 'Vision screening gaps, diabetic retinopathy missed, glaucoma detection failure', expectedTypes: [
      { type: 'Retinal imaging AI company', reason: 'AI-powered diabetic retinopathy screening, glaucoma detection, and macular degeneration monitoring', confidence: 0.92 },
      { type: 'Teleophthalmology platform', reason: 'Remote eye screening, virtual optometry, and ophthalmic image interpretation', confidence: 0.82 }
    ]},
    'MAMM': { fullName: 'Mammillary Bodies', label: 'Clinical Memory & Patient History', tier: 'operational', function: 'Preserves patient medical history, medication lists, and problem lists across care encounters', dysregulation: 'Incomplete medical history, medication reconciliation failure, allergy documentation gaps', expectedTypes: [
      { type: 'Medication reconciliation platform', reason: 'Automated med rec across care transitions, pharmacy data integration, and discrepancy detection', confidence: 0.88 },
      { type: 'Patient health record company', reason: 'Patient-controlled health records, longitudinal history aggregation, and care continuity tools', confidence: 0.82 }
    ]},
    'MDT': { fullName: 'Mediodorsal Thalamus', label: 'Psychiatry & Behavioral Health', tier: 'operational', function: 'Delivers psychiatric assessment, behavioral health treatment, and mental health crisis intervention', dysregulation: 'Mental health access crisis, psychiatric bed shortage, behavioral health workforce gaps', expectedTypes: [
      { type: 'Telepsychiatry platform', reason: 'Virtual psychiatric consultations, e-prescribing for controlled substances, and crisis intervention', confidence: 0.92 },
      { type: 'Mental health measurement company', reason: 'Standardized outcome measures, treatment response tracking, and measurement-based care tools', confidence: 0.85 }
    ]},
    'MGN': { fullName: 'Medial Geniculate Nucleus', label: 'Audiology & Hearing Health', tier: 'operational', function: 'Manages hearing diagnostics, audiology services, and hearing device technology', dysregulation: 'Hearing loss underdiagnosis, hearing aid access barriers, newborn hearing screening gaps', expectedTypes: [
      { type: 'Digital audiology company', reason: 'OTC hearing aids, remote audiogram, and tele-audiology services', confidence: 0.85 },
      { type: 'Hearing screening technology firm', reason: 'Automated audiometry, hearing conservation programs, and ototoxicity monitoring', confidence: 0.80 }
    ]},
    'MICRO': { fullName: 'Microglia', label: 'Clinical Laboratory & Pathology', tier: 'operational', function: 'Performs clinical laboratory testing, anatomic pathology, and laboratory quality management', dysregulation: 'Lab result errors, specimen handling failures, pathology turnaround delays', expectedTypes: [
      { type: 'Digital pathology company', reason: 'Whole slide imaging, AI-assisted pathology diagnosis, and remote pathology consultation', confidence: 0.92 },
      { type: 'Laboratory automation platform', reason: 'Pre-analytical automation, specimen tracking, and laboratory workflow optimization', confidence: 0.85 }
    ]},
    'NAcc': { fullName: 'Nucleus Accumbens', label: 'Healthcare Marketing & Patient Acquisition', tier: 'operational', function: 'Drives patient acquisition, healthcare marketing, and service line growth', dysregulation: 'Patient volume decline, service line underperformance, brand reputation damage', expectedTypes: [
      { type: 'Healthcare marketing platform', reason: 'Patient acquisition analytics, digital marketing for health systems, and reputation management', confidence: 0.82 },
      { type: 'Healthcare CRM company', reason: 'Patient relationship management, outreach campaigns, and retention analytics', confidence: 0.80 }
    ]},
    'NBM': { fullName: 'Nucleus Basalis of Meynert', label: 'Neurology & Cognitive Medicine', tier: 'operational', function: 'Manages neurological conditions including dementia, Alzheimer\'s, Parkinson\'s, and epilepsy', dysregulation: 'Dementia underdiagnosis, neurodegenerative treatment gaps, epilepsy management failure', expectedTypes: [
      { type: 'Cognitive assessment platform', reason: 'Digital cognitive screening, dementia staging, and neurodegenerative disease tracking', confidence: 0.88 },
      { type: 'Epilepsy management company', reason: 'Seizure detection devices, medication tracking, and neuromodulation therapy support', confidence: 0.82 }
    ]},
    'NEOCER': { fullName: 'Neocerebellum', label: 'Precision Medicine & Genomics', tier: 'operational', function: 'Delivers precision medicine through genomic testing, pharmacogenomics, and targeted therapy selection', dysregulation: 'Genomic testing underutilization, pharmacogenomic result non-integration, precision medicine access gaps', expectedTypes: [
      { type: 'Clinical genomics company', reason: 'Whole exome/genome sequencing interpretation, variant classification, and genetic counseling support', confidence: 0.92 },
      { type: 'Pharmacogenomics platform', reason: 'PGx testing integration into EHR, drug-gene interaction alerts, and personalized prescribing', confidence: 0.88 }
    ]},
    'OLF': { fullName: 'Olfactory System', label: 'Environmental Health & Occupational Medicine', tier: 'operational', function: 'Monitors environmental health hazards, occupational exposures, and workplace health programs', dysregulation: 'Occupational exposure undetected, workplace health compliance failure, environmental health hazards', expectedTypes: [
      { type: 'Occupational health platform', reason: 'Employee health screening, exposure monitoring, and workplace wellness management', confidence: 0.82 },
      { type: 'Environmental health analytics firm', reason: 'Air quality impact on health, chemical exposure tracking, and environmental risk assessment', confidence: 0.78 }
    ]},
    'OPIOID': { fullName: 'Opioid System', label: 'Opioid Prescribing & PDMP', tier: 'operational', function: 'Manages opioid prescribing safety, prescription drug monitoring programs, and naloxone distribution', dysregulation: 'Opioid overprescribing, PDMP check gaps, naloxone access failure', expectedTypes: [
      { type: 'Opioid prescribing safety platform', reason: 'PDMP integration, morphine equivalent dose calculators, and prescribing pattern analytics', confidence: 0.90 },
      { type: 'Naloxone distribution technology company', reason: 'Naloxone access tracking, overdose response coordination, and harm reduction tools', confidence: 0.82 }
    ]},
    'OSC': { fullName: 'Oscillatory', label: 'Sleep Medicine & Circadian Health', tier: 'operational', function: 'Manages sleep disorders, circadian rhythm disruption, and sleep-health optimization', dysregulation: 'Sleep apnea underdiagnosis, insomnia treatment gaps, shift worker health deterioration', expectedTypes: [
      { type: 'Sleep diagnostics company', reason: 'Home sleep testing, wearable sleep tracking, and AI-based sleep stage analysis', confidence: 0.88 },
      { type: 'Sleep therapy platform', reason: 'CBT-I digital therapeutics, CPAP adherence monitoring, and circadian health management', confidence: 0.82 }
    ]},
    'OXY': { fullName: 'Oxytocin', label: 'Maternal & Perinatal Health', tier: 'operational', function: 'Manages maternal health, perinatal care, labor and delivery, and neonatal outcomes', dysregulation: 'Maternal mortality, preterm birth, neonatal complications, postpartum depression', expectedTypes: [
      { type: 'Maternal health monitoring company', reason: 'Remote fetal monitoring, preeclampsia detection, and high-risk pregnancy management', confidence: 0.90 },
      { type: 'Perinatal mental health platform', reason: 'Postpartum depression screening, perinatal mood disorder treatment, and virtual lactation support', confidence: 0.85 }
    ]},
    'PBN': { fullName: 'Parabrachial Nucleus', label: 'Nutrition & Dietetics', tier: 'operational', function: 'Manages clinical nutrition, medical diet therapy, and enteral/parenteral nutrition support', dysregulation: 'Malnutrition in hospitalized patients, TPN complications, nutrition screening gaps', expectedTypes: [
      { type: 'Clinical nutrition platform', reason: 'Malnutrition screening, medical nutrition therapy planning, and dietary counseling tools', confidence: 0.85 },
      { type: 'Enteral nutrition management company', reason: 'Tube feeding protocol optimization, parenteral nutrition calculators, and nutrition monitoring', confidence: 0.80 }
    ]},
    'PCC': { fullName: 'Posterior Cingulate Cortex', label: 'Medical Research Translation', tier: 'operational', function: 'Translates medical research findings into clinical practice through implementation science', dysregulation: 'Bench-to-bedside gap, research translation failure, implementation science neglect', expectedTypes: [
      { type: 'Research translation platform', reason: 'Clinical practice guideline dissemination, best practice adoption tools, and implementation tracking', confidence: 0.82 },
      { type: 'Implementation science consultancy', reason: 'Evidence-based practice adoption, de-implementation of low-value care, and clinical transformation', confidence: 0.78 }
    ]},
    'PI': { fullName: 'Posterior Insula', label: 'Physical Examination & Assessment', tier: 'operational', function: 'Supports physical examination, clinical assessment, and bedside evaluation', dysregulation: 'Physical exam skills decline, assessment shortcuts, bedside evaluation gaps', expectedTypes: [
      { type: 'Digital physical exam company', reason: 'AI-augmented stethoscopes, remote physical exam tools, and point-of-care ultrasound guidance', confidence: 0.85 },
      { type: 'Clinical assessment technology firm', reason: 'Structured clinical assessment tools, severity scoring apps, and acuity calculators', confidence: 0.80 }
    ]},
    'PIN': { fullName: 'Pineal', label: 'Chronotherapy & Light Medicine', tier: 'operational', function: 'Manages chronotherapeutic interventions, light therapy, and melatonin-based treatments', dysregulation: 'Seasonal affective disorder, jet lag management, ICU delirium from circadian disruption', expectedTypes: [
      { type: 'Light therapy device company', reason: 'Therapeutic light devices for SAD, circadian entrainment, and ICU delirium prevention', confidence: 0.82 },
      { type: 'Chronotherapy platform', reason: 'Medication timing optimization, circadian-aligned treatment scheduling, and jet lag management', confidence: 0.78 }
    ]},
    'PIT': { fullName: 'Pituitary', label: 'Hormone Therapy & Fertility', tier: 'operational', function: 'Manages hormone replacement therapy, fertility treatments, and pituitary disorder management', dysregulation: 'Hormone imbalance, fertility treatment failure, growth hormone deficiency undertreatment', expectedTypes: [
      { type: 'Fertility technology company', reason: 'IVF cycle management, fertility tracking apps, and reproductive endocrinology analytics', confidence: 0.88 },
      { type: 'Hormone therapy monitoring platform', reason: 'Hormone level tracking, replacement therapy optimization, and endocrine monitoring', confidence: 0.82 }
    ]},
    'PPN': { fullName: 'Pedunculopontine Nucleus', label: 'Rehabilitation & Physical Medicine', tier: 'operational', function: 'Delivers rehabilitation services including physical therapy, occupational therapy, and speech therapy', dysregulation: 'Rehabilitation access gaps, therapy outcome measurement failure, recovery plateau', expectedTypes: [
      { type: 'Virtual rehabilitation platform', reason: 'Telerehab, AI-guided exercise programs, and home-based therapy monitoring', confidence: 0.88 },
      { type: 'Rehabilitation outcome analytics firm', reason: 'Functional outcome measurement, therapy effectiveness tracking, and rehab program optimization', confidence: 0.82 }
    ]},
    'PRECUNEUS': { fullName: 'Precuneus', label: 'Patient Self-Awareness & Health Coaching', tier: 'operational', function: 'Supports patient self-awareness, health coaching, and motivated self-care behaviors', dysregulation: 'Patient disengagement, health coaching gaps, self-care motivation failure', expectedTypes: [
      { type: 'Health coaching platform', reason: 'AI-powered health coaching, motivational interviewing tools, and behavior change support', confidence: 0.85 },
      { type: 'Patient-reported outcomes company', reason: 'PRO collection, symptom tracking apps, and patient-generated health data platforms', confidence: 0.82 }
    ]},
    'PULV': { fullName: 'Pulvinar', label: 'Clinical Information Filtering', tier: 'operational', function: 'Filters and prioritizes clinical information from multiple sources for physician attention', dysregulation: 'Information overload, alert fatigue, clinical signal buried in noise', expectedTypes: [
      { type: 'Clinical intelligence platform', reason: 'AI-curated clinical summaries, smart notification routing, and signal prioritization', confidence: 0.85 },
      { type: 'EHR optimization company', reason: 'Inbox management, chart preparation, and information presentation optimization', confidence: 0.80 }
    ]},
    'PUT': { fullName: 'Putamen', label: 'Clinical Workflow Automation', tier: 'operational', function: 'Automates routine clinical workflows including scheduling, documentation, and result follow-up', dysregulation: 'Workflow inefficiency, manual process burden, clinical task backlog', expectedTypes: [
      { type: 'Healthcare workflow automation company', reason: 'RPA for healthcare, automated result follow-up, and clinical task management', confidence: 0.88 },
      { type: 'Clinical scheduling optimization platform', reason: 'AI-powered scheduling, resource allocation, and OR utilization optimization', confidence: 0.85 }
    ]},
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Mental Health Therapeutics', tier: 'operational', function: 'Delivers mental health treatments including psychopharmacology, psychotherapy, and neuromodulation', dysregulation: 'Antidepressant non-response, psychotherapy access gaps, treatment-resistant depression', expectedTypes: [
      { type: 'Digital mental health therapeutics company', reason: 'FDA-cleared digital CBT, DBT apps, and mental health treatment platforms', confidence: 0.90 },
      { type: 'Neuromodulation therapy company', reason: 'TMS, ketamine/esketamine treatment management, and novel antidepressant delivery', confidence: 0.85 }
    ]},
    'RF': { fullName: 'Reticular Formation', label: 'Hospital Capacity & Throughput', tier: 'operational', function: 'Manages hospital capacity, patient throughput, and system-wide flow optimization', dysregulation: 'Capacity crisis, patient flow bottlenecks, discharge delays, boarding', expectedTypes: [
      { type: 'Hospital capacity management platform', reason: 'Real-time census, discharge prediction, and capacity optimization analytics', confidence: 0.90 },
      { type: 'Transfer center technology company', reason: 'Inter-facility transfer coordination, bed request management, and transport logistics', confidence: 0.82 }
    ]},
    'RSC': { fullName: 'Retrosplenial Cortex', label: 'Healthcare Analytics & Business Intelligence', tier: 'operational', function: 'Provides healthcare business intelligence, financial analytics, and operational reporting', dysregulation: 'Analytics gaps, reporting delays, data-driven decision failure', expectedTypes: [
      { type: 'Healthcare BI platform', reason: 'Clinical and financial analytics, executive dashboards, and operational reporting', confidence: 0.85 },
      { type: 'Healthcare cost analytics company', reason: 'Cost-to-charge analysis, DRG optimization, and value-based care financial modeling', confidence: 0.82 }
    ]},
    'SC': { fullName: 'Superior Colliculus', label: 'Emergency Response & Rapid Deployment', tier: 'operational', function: 'Manages rapid medical response including code teams, rapid response, and emergency deployment', dysregulation: 'Code response delays, rapid response team activation failure, emergency deployment gaps', expectedTypes: [
      { type: 'Emergency response technology company', reason: 'Code blue management, rapid response team coordination, and mass casualty incident tools', confidence: 0.85 },
      { type: 'EMS integration platform', reason: 'Prehospital-to-hospital data exchange, ambulance tracking, and destination coordination', confidence: 0.82 }
    ]},
    'SEPT': { fullName: 'Septum', label: 'Community Health & Outreach', tier: 'operational', function: 'Delivers community health services, outreach programs, and public health interventions', dysregulation: 'Community health gaps, outreach program failure, underserved population neglect', expectedTypes: [
      { type: 'Community health worker technology platform', reason: 'CHW workflow management, community resource directories, and outreach tracking', confidence: 0.85 },
      { type: 'Mobile health clinic management company', reason: 'Mobile clinic scheduling, patient tracking, and community health screening coordination', confidence: 0.80 }
    ]},
    'SMA': { fullName: 'Supplementary Motor Area', label: 'Nursing & Bedside Care', tier: 'operational', function: 'Delivers direct patient care through nursing assessments, medication administration, and care protocols', dysregulation: 'Nursing shortage, medication administration errors, care protocol non-adherence', expectedTypes: [
      { type: 'Nursing workflow technology company', reason: 'Barcode medication administration, nursing documentation, and care plan management', confidence: 0.88 },
      { type: 'Nurse staffing analytics platform', reason: 'Acuity-based staffing models, float pool management, and nurse scheduling optimization', confidence: 0.85 }
    ]},
    'SMN': { fullName: 'Sensorimotor Network', label: 'Orthopedics & Musculoskeletal', tier: 'operational', function: 'Manages orthopedic conditions including joint replacement, fracture care, and sports medicine', dysregulation: 'Joint replacement complications, fracture healing delays, rehabilitation failure', expectedTypes: [
      { type: 'Orthopedic implant tracking company', reason: 'Implant registry, joint replacement outcome tracking, and recall management', confidence: 0.85 },
      { type: 'MSK digital health platform', reason: 'Virtual physical therapy, surgical prehabilitation, and musculoskeletal triage', confidence: 0.82 }
    ]},
    'SN': { fullName: 'Salience Network', label: 'Clinical Prioritization & Triage', tier: 'operational', function: 'Prioritizes clinical attention across competing demands based on urgency and acuity', dysregulation: 'Triage failure, clinical attention misallocation, priority inversion', expectedTypes: [
      { type: 'Clinical prioritization AI company', reason: 'Patient acuity scoring, clinical attention allocation, and deterioration early warning', confidence: 0.88 },
      { type: 'Healthcare resource allocation platform', reason: 'OR scheduling, ICU admission prediction, and resource optimization during surges', confidence: 0.82 }
    ]},
    'SNIG': { fullName: 'Substantia Nigra', label: 'Neurosurgery & Neuromodulation', tier: 'operational', function: 'Delivers neurosurgical interventions including deep brain stimulation and surgical epilepsy treatment', dysregulation: 'DBS programming failures, neurosurgical complication, movement disorder undertreatment', expectedTypes: [
      { type: 'Neuromodulation device company', reason: 'Deep brain stimulators, spinal cord stimulators, and vagus nerve stimulation devices', confidence: 0.88 },
      { type: 'Neurosurgery planning platform', reason: 'Brain mapping, tractography, and AI-assisted neurosurgical planning', confidence: 0.82 }
    ]},
    'SNS': { fullName: 'Sympathetic Nervous System', label: 'Anesthesiology & Perioperative Medicine', tier: 'operational', function: 'Manages anesthesia delivery, perioperative hemodynamics, and post-anesthesia recovery', dysregulation: 'Anesthesia complications, perioperative cardiac events, post-operative recovery delays', expectedTypes: [
      { type: 'Anesthesia information management system', reason: 'AIMS documentation, drug dosing calculators, and hemodynamic monitoring integration', confidence: 0.85 },
      { type: 'Enhanced recovery after surgery (ERAS) platform', reason: 'ERAS protocol management, post-operative milestone tracking, and pain management optimization', confidence: 0.82 }
    ]},
    'STN': { fullName: 'Subthalamic Nucleus', label: 'Healthcare Cost Containment', tier: 'operational', function: 'Controls healthcare spending through utilization management, cost containment, and value assessment', dysregulation: 'Cost overrun, unnecessary utilization, low-value care persistence', expectedTypes: [
      { type: 'Utilization management platform', reason: 'Prior authorization, medical necessity determination, and length-of-stay optimization', confidence: 0.90 },
      { type: 'Healthcare cost transparency company', reason: 'Price comparison tools, cost estimators, and surprise billing prevention', confidence: 0.82 }
    ]},
    'STS': { fullName: 'Superior Temporal Sulcus', label: 'Patient-Provider Relationship', tier: 'operational', function: 'Manages the patient-provider relationship including shared decision-making and trust building', dysregulation: 'Patient trust erosion, shared decision-making failure, therapeutic relationship breakdown', expectedTypes: [
      { type: 'Shared decision-making platform', reason: 'Patient decision aids, option grids, and preference-elicitation tools', confidence: 0.85 },
      { type: 'Patient engagement analytics company', reason: 'Trust measurement, relationship quality metrics, and communication effectiveness scoring', confidence: 0.78 }
    ]},
    'TPJ': { fullName: 'Temporoparietal Junction', label: 'Ethics & Clinical Ethics Consultation', tier: 'operational', function: 'Manages clinical ethics consultation, informed consent, and ethical decision frameworks', dysregulation: 'Informed consent failure, ethical conflicts unresolved, futile care continuation', expectedTypes: [
      { type: 'Clinical ethics consultation platform', reason: 'Ethics case management, framework-guided consultation, and documentation tools', confidence: 0.80 },
      { type: 'Informed consent technology company', reason: 'Multimedia informed consent, comprehension assessment, and consent documentation', confidence: 0.82 }
    ]},
    'TPOLE': { fullName: 'Temporal Pole', label: 'Patient Identity & Record Matching', tier: 'operational', function: 'Manages patient identity resolution, record matching, and master patient index across systems', dysregulation: 'Duplicate records, patient misidentification, record matching errors', expectedTypes: [
      { type: 'Patient identity management company', reason: 'Enterprise MPI, probabilistic matching, and referential matching across health systems', confidence: 0.90 },
      { type: 'Biometric patient identification firm', reason: 'Palm vein, iris scan, or facial recognition for patient identification at point of care', confidence: 0.82 }
    ]},
    'TrkB': { fullName: 'TrkB Receptor', label: 'Regenerative Medicine & Cell Therapy', tier: 'operational', function: 'Delivers regenerative medicine including stem cell therapy, tissue engineering, and growth factor treatments', dysregulation: 'Regenerative therapy failure, unproven stem cell treatments, tissue engineering limitations', expectedTypes: [
      { type: 'Cell therapy manufacturing company', reason: 'CAR-T cell production, stem cell processing, and GMP cell manufacturing', confidence: 0.88 },
      { type: 'Regenerative medicine platform', reason: 'Platelet-rich plasma, exosome therapy, and tissue-engineered product development', confidence: 0.82 }
    ]},
    'UNC': { fullName: 'Uncinate Fasciculus', label: 'Medical Legal & Malpractice', tier: 'operational', function: 'Manages medical-legal risk, malpractice prevention, and litigation support', dysregulation: 'Malpractice crisis, medical-legal risk underassessment, litigation burden', expectedTypes: [
      { type: 'Medical malpractice analytics firm', reason: 'Malpractice risk scoring, claims prediction, and risk reduction interventions', confidence: 0.85 },
      { type: 'Clinical documentation defense company', reason: 'Documentation quality scoring, liability risk identification, and legal-ready record preparation', confidence: 0.80 }
    ]},
    'V1': { fullName: 'Primary Visual Cortex', label: 'Clinical Dashboards & Visualization', tier: 'operational', function: 'Creates clinical data visualizations, operational dashboards, and patient-facing health displays', dysregulation: 'Dashboard overload, visualization without insight, stale clinical displays', expectedTypes: [
      { type: 'Clinical visualization platform', reason: 'Real-time clinical dashboards, patient status boards, and graphical EHR interfaces', confidence: 0.85 },
      { type: 'Healthcare data visualization company', reason: 'Population health maps, surgical outcome graphics, and quality metric displays', confidence: 0.80 }
    ]},
    'VAN': { fullName: 'Ventral Attention Network', label: 'Incidental Finding Management', tier: 'operational', function: 'Manages unexpected clinical findings including incidental imaging results and abnormal screening values', dysregulation: 'Incidental finding lost to follow-up, abnormal result not communicated, screening result management failure', expectedTypes: [
      { type: 'Incidental finding tracking platform', reason: 'Automated follow-up scheduling for incidental findings, result acknowledgment tracking', confidence: 0.85 },
      { type: 'Abnormal result management company', reason: 'Critical result notification, closed-loop follow-up, and overdue result alerts', confidence: 0.82 }
    ]},
    'VERM': { fullName: 'Vermis', label: 'Pediatric Medicine', tier: 'operational', function: 'Delivers pediatric healthcare including well-child care, developmental screening, and childhood immunizations', dysregulation: 'Immunization gaps, developmental delay underdiagnosis, pediatric care access barriers', expectedTypes: [
      { type: 'Pediatric telehealth company', reason: 'Virtual pediatric visits, parent education, and developmental milestone tracking', confidence: 0.88 },
      { type: 'Childhood immunization management platform', reason: 'Immunization registry integration, schedule optimization, and reminder systems', confidence: 0.85 }
    ]},
    'VEST': { fullName: 'Vestibular', label: 'Fall Prevention & Balance', tier: 'operational', function: 'Manages fall prevention, balance assessment, and vestibular disorder treatment', dysregulation: 'Patient falls (leading hospital safety event), balance disorder underdiagnosis, fall injury cascade', expectedTypes: [
      { type: 'Fall prevention technology company', reason: 'Wearable fall detection, bed exit alarms, and predictive fall risk analytics', confidence: 0.90 },
      { type: 'Balance assessment platform', reason: 'Vestibular function testing, computerized dynamic posturography, and fall risk screening', confidence: 0.82 }
    ]},
    'VP': { fullName: 'Ventral Pallidum', label: 'Healthcare Incentive & Value-Based Programs', tier: 'operational', function: 'Designs and manages healthcare incentive programs, value-based contracts, and alternative payment models', dysregulation: 'Value-based contract failure, incentive misalignment, alternative payment model dysfunction', expectedTypes: [
      { type: 'Value-based care analytics platform', reason: 'Total cost of care calculation, shared savings modeling, and quality-adjusted payment analytics', confidence: 0.88 },
      { type: 'Alternative payment model consulting firm', reason: 'ACO design, bundled payment structuring, and risk-sharing arrangement optimization', confidence: 0.82 }
    ]},
    'VV': { fullName: 'Ventral Visual', label: 'Dermatology & Visual Diagnostics', tier: 'operational', function: 'Delivers visual diagnostics including dermatology, wound assessment, and skin cancer screening', dysregulation: 'Skin cancer missed, wound assessment errors, dermatology access gaps', expectedTypes: [
      { type: 'AI dermatology company', reason: 'Skin lesion classification, teledermatology, and melanoma detection algorithms', confidence: 0.92 },
      { type: 'Wound care technology platform', reason: 'Digital wound measurement, healing trajectory prediction, and wound care protocol management', confidence: 0.85 }
    ]},
    'WERN': { fullName: 'Wernicke\'s Area', label: 'Clinical Report Interpretation', tier: 'operational', function: 'Interprets clinical reports including lab results, imaging reads, and consultation notes for clinical action', dysregulation: 'Report misinterpretation, critical finding communication failure, report comprehension errors', expectedTypes: [
      { type: 'Clinical report summarization AI', reason: 'AI-generated report summaries, key finding extraction, and actionable recommendation highlighting', confidence: 0.85 },
      { type: 'Structured reporting platform', reason: 'Standardized radiology reporting, synoptic pathology reports, and templated clinical documents', confidence: 0.80 }
    ]},
    'mPFC': { fullName: 'Medial Prefrontal Cortex', label: 'Physician Well-Being & Self-Reflection', tier: 'operational', function: 'Supports physician self-reflection, professional development, and career well-being', dysregulation: 'Physician burnout, career dissatisfaction, professional identity crisis', expectedTypes: [
      { type: 'Physician wellness platform', reason: 'Burnout assessment, peer support networks, and professional development tools', confidence: 0.82 },
      { type: 'Medical coaching company', reason: 'Executive coaching for physician leaders, career transition support, and mentorship matching', confidence: 0.78 }
    ]},
    'rACC': { fullName: 'Rostral Anterior Cingulate', label: 'Patient Emotional Support & Counseling', tier: 'operational', function: 'Provides emotional support, counseling, and psychosocial care for patients and families', dysregulation: 'Psychosocial support gaps, caregiver burnout, emotional distress underassessment', expectedTypes: [
      { type: 'Patient support and counseling platform', reason: 'Virtual counseling, peer support matching, and caregiver support tools', confidence: 0.85 },
      { type: 'Cancer support technology company', reason: 'Psycho-oncology tools, survivorship care planning, and cancer caregiver support', confidence: 0.82 }
    ]},
    'vlPFC': { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Healthcare Policy & Advocacy', tier: 'operational', function: 'Manages healthcare policy analysis, legislative advocacy, and regulatory affairs', dysregulation: 'Policy blind spots, regulatory surprise, advocacy failure on critical health legislation', expectedTypes: [
      { type: 'Healthcare policy analytics platform', reason: 'Legislative tracking, regulatory impact analysis, and policy change forecasting', confidence: 0.82 },
      { type: 'Healthcare advocacy technology company', reason: 'Grassroots advocacy tools, legislator tracking, and policy impact communication', confidence: 0.78 }
    ]}
  };

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadApprovals() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveApprovals(a) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch (e) {} }
  function getApproval(nodeId, type) { var a = loadApprovals(); return a[nodeId + '::' + type] || null; }
  function setApprovalStatus(nodeId, type, status, reason) {
    var a = loadApprovals();
    a[nodeId + '::' + type] = { status: status, reason: reason || '', reviewed_at: Date.now(), reviewed_by: 'operator' };
    saveApprovals(a);
    try { window.dispatchEvent(new CustomEvent('limen:medicine-approval-update')); } catch (e) {}
  }

  // ══════════════════════════════════════════════════════════════════════
  // INFERENCE ENGINE
  // ══════════════════════════════════════════════════════════════════════

  function runInference() {
    var brains = window.LIMENDomainBrains;
    var brain = brains ? brains.get('health') : null;
    var state = brain ? brain.getState() : null;

    var mapped = [];
    var missing = [];
    var speculative = [];

    var existingCompanies = {};
    if (state && state.companies) {
      for (var ci = 0; ci < state.companies.length; ci++) {
        var c = state.companies[ci];
        if (c.nodeId) {
          if (!existingCompanies[c.nodeId]) existingCompanies[c.nodeId] = [];
          existingCompanies[c.nodeId].push(c.ticker || c.name || c.id);
        }
      }
    }

    var activeNodes = {};
    if (state && state.diagnoses) {
      for (var di = 0; di < state.diagnoses.length; di++) {
        var dx = state.diagnoses[di];
        if (dx.active && dx.affectedNodes) {
          for (var ni = 0; ni < dx.affectedNodes.length; ni++) activeNodes[dx.affectedNodes[ni]] = true;
        }
      }
    }

    var nodeIds = Object.keys(NODE_BUSINESS_DIRECTORY);
    for (var i = 0; i < nodeIds.length; i++) {
      var nodeId = nodeIds[i];
      if (RI_NODES[nodeId]) continue;
      var node = NODE_BUSINESS_DIRECTORY[nodeId];
      var nodeActive = !!activeNodes[nodeId];
      var companies = existingCompanies[nodeId] || [];

      for (var ti = 0; ti < node.expectedTypes.length; ti++) {
        var et = node.expectedTypes[ti];
        if (isGenericTreatment(et.type)) continue;

        var entry = {
          nodeId: nodeId,
          nodeFullName: node.fullName,
          nodeLabel: node.label,
          nodeFunction: node.function,
          dysregulation: node.dysregulation,
          neuroTranslation: node.neuroTranslation || null,
          businessType: et.type,
          reason: et.reason,
          confidence: et.confidence,
          tier: node.tier,
          nodeActive: nodeActive,
          existingCompanies: companies,
          alreadyMapped: companies.length > 0,
          approvalRequired: true,
          approval: getApproval(nodeId, et.type) || { status: 'PROPOSED' },
          bucket: 'MISSING'
        };

        if (companies.length > 0) {
          entry.bucket = 'MAPPED';
          mapped.push(entry);
        } else if (et.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          speculative.push(entry);
        }
      }
    }

    mapped.sort(function (a, b) { return b.confidence - a.confidence; });
    missing.sort(function (a, b) { return b.confidence - a.confidence; });
    speculative.sort(function (a, b) { return b.confidence - a.confidence; });

    return { mapped: mapped, missing: missing, speculative: speculative, totalNodes: nodeIds.length };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENMedicineBusinessEngine = {
    runInference: runInference,
    setApprovalStatus: setApprovalStatus,
    getApproval: getApproval,
    NODE_BUSINESS_DIRECTORY: NODE_BUSINESS_DIRECTORY,
    RI_NODES: RI_NODES,
    isGenericTreatment: isGenericTreatment
  };

  console.log('[MedicineBusinessEngine] Loaded \u2014 102 operational nodes, medicine-native business directory');

})();
