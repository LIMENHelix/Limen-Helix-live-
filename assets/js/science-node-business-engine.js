/**
 * science-node-business-engine.js — Science Node-to-Business Assignment Engine
 *
 * SCIENCE / RESEARCH DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture (matches the locked-domain standard):
 *   - Recursively traverses ALL child portal JSONs (depth 0-5, ~18,200 files)
 *   - Covers full 103 operational nodes (19 SCIENCE-TOP + 84 SCIENCE-OPERATIONAL)
 *   - Excludes the same 20 RI / framework nodes as the locked domains
 *   - Filters generic template treatments before inference
 *
 * Outputs 3 buckets:
 *   MAPPED     - already mapped and active in Science system
 *   MISSING    - plausible but missing from current Science mappings
 *   SPECULATIVE - low-confidence or novel suggestions
 *
 * Approval statuses: PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_science_business_approvals')
 *
 * Self-gates: only runs when ?domain=science or ?domain=research
 * Exposes: window.LIMENScienceBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'science' && _dom !== 'research') return;

  var STORAGE_KEY = 'limen_science_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_science_hierarchy_cache';
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
  // 19 SCIENCE-TOP (full neuroTranslation) + 84 SCIENCE-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── SCIENCE-TOP NODES (19) — full detail with neuroTranslation ──
    'DMN': {
      fullName: 'Default Mode Network', label: 'Hypothesis Generation', tier: 'top',
      neuroTranslation: { inNeurology: 'Active during unconstrained internally-directed thought, imagination, mental simulation, and creative ideation.', inBusiness: 'In science, hypothesis generation requires free-ranging mental exploration to conceive novel testable explanatory frameworks.' },
      function: 'Produces novel candidate explanations by combining existing knowledge with creative inference',
      dysregulation: 'Hypothesis drought, unfalsifiable framing, confirmation bias dominance',
      expectedTypes: [
        { type: 'Interdisciplinary research consortium', reason: 'Santa Fe Institute, Flatiron Institute, Allen Institute, Kavli Institutes for cross-field hypothesis generation', confidence: 0.90 },
        { type: 'Theoretical research institute', reason: 'Perimeter Institute, Institute for Advanced Study (IAS), KITP Santa Barbara, Niels Bohr Institute for dedicated theoretical work', confidence: 0.85 },
        { type: 'AI-assisted hypothesis generation tool', reason: 'Elicit (Ought), SciSpace, Consensus.app, Scite, Iris.ai for LLM-augmented literature search and hypothesis surfacing', confidence: 0.82 },
        { type: 'Open peer brainstorming platform', reason: 'ResearchHub, ResearchGate Q&A, PubPeer, Mastodon science instances for early-stage idea discussion', confidence: 0.75 },
        { type: 'Independent research foundation', reason: 'Simons Foundation, Chan Zuckerberg Initiative, Arc Institute, Astera Institute, Convergent Research for high-risk speculative funding', confidence: 0.78 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Experimental Design', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports working memory, planning, and coordination of multiple simultaneous goals.', inBusiness: 'In science, experimental design holds variables, controls, sample sizes, and statistical power simultaneously to plan a rigorous study.' },
      function: 'Designs and plans rigorous experiments with appropriate controls, power, and reproducibility safeguards',
      dysregulation: 'Underpowered studies, missing controls, p-hacking, design drift',
      expectedTypes: [
        { type: 'Statistical consulting service', reason: 'Stata Corp Professional Services, SAS Institute Consulting, Cytel, Berry Consultants for Bayesian and frequentist study design', confidence: 0.92 },
        { type: 'Pre-registration platform', reason: 'Locks experimental design before data collection (Open Science Framework)', confidence: 0.88 },
        { type: 'Research methods training organization', reason: 'Trains PIs and postdocs in rigorous experimental design', confidence: 0.82 },
        { type: 'Clinical trial protocol design CRO', reason: 'Designs Phase I-IV clinical trials with regulatory rigor', confidence: 0.90 },
        { type: 'Power analysis software vendor', reason: 'G*Power, PASS, and similar sample-size calculators', confidence: 0.78 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Peer Review', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects conflict and errors, monitors performance, flags discrepancies between expectation and outcome.', inBusiness: 'In science, peer review detects errors, conflicts of interest, and methodological flaws before publication.' },
      function: 'Reviews submitted manuscripts and grants for rigor, novelty, and significance',
      dysregulation: 'Reviewer fatigue, desk-reject rate spike, predatory journals, peer review backlog',
      expectedTypes: [
        { type: 'Peer review management platform', reason: 'ScholarOne, Editorial Manager, OpenReview', confidence: 0.92 },
        { type: 'Open peer review service', reason: 'Public post-publication review (PubPeer, F1000)', confidence: 0.85 },
        { type: 'Reviewer training organization', reason: 'Trains researchers to provide constructive peer reviews', confidence: 0.78 },
        { type: 'Journal publishing house', reason: 'Operates the peer review pipeline for scientific journals', confidence: 0.95 },
        { type: 'Predatory journal detection service', reason: 'Cabells, Beall lists, and journal credibility analytics', confidence: 0.82 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Data Analysis', tier: 'top',
      neuroTranslation: { inNeurology: 'Dynamically allocates cognitive resources and switches between analysis tasks.', inBusiness: 'In science, data analysis flexibly applies statistical, computational, and visualization tools to extract meaning from raw data.' },
      function: 'Statistical analysis, computational analysis, and interpretation of experimental data',
      dysregulation: 'Statistical errors, data dredging, analysis drift, reproducibility failures',
      expectedTypes: [
        { type: 'Research data analysis platform', reason: 'Jupyter, RStudio, MATLAB, statistical computing environments', confidence: 0.92 },
        { type: 'Bioinformatics analysis service', reason: 'Sequence alignment, variant calling, expression analysis', confidence: 0.90 },
        { type: 'AI-for-science analytics company', reason: 'ML applied to research data interpretation', confidence: 0.88 },
        { type: 'Reproducible analysis workflow tool', reason: 'Snakemake, Nextflow, Galaxy, reproducible pipelines', confidence: 0.85 },
        { type: 'Statistical consulting firm', reason: 'Berry Consultants, Cytel, Axio Research, Metrum Research Group for outsourced biostatistics and clinical trial statistical analysis', confidence: 0.82 }
      ]
    },
    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Laboratory Methods', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output stage where planned actions become physical execution.', inBusiness: 'In science, laboratory methods are the physical execution of experiments — pipetting, cell culture, instrument operation.' },
      function: 'Executes physical experimental work in laboratory settings',
      dysregulation: 'Protocol drift, technique inconsistency, contamination, equipment failure',
      expectedTypes: [
        { type: 'Laboratory equipment manufacturer', reason: 'Pipettes, centrifuges, incubators, cell culture supplies', confidence: 0.95 },
        { type: 'Lab automation / robotics vendor', reason: 'Automates repetitive laboratory tasks (Hamilton, Tecan, Beckman)', confidence: 0.92 },
        { type: 'Reagent and consumables supplier', reason: 'Sigma-Aldrich, ThermoFisher, VWR', confidence: 0.95 },
        { type: 'Protocol management software (ELN)', reason: 'Electronic lab notebooks for protocol tracking and reproducibility', confidence: 0.88 },
        { type: 'Contract research lab service', reason: 'Eurofins Scientific, Charles River, Labcorp Drug Development, WuXi AppTec, Science Exchange marketplace for technique-specific lab outsourcing', confidence: 0.85 }
      ]
    },
    'BROCA': {
      fullName: 'Broca\u2019s Area', label: 'Publication and Dissemination', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured language and grammatical output.', inBusiness: 'In science, publication produces structured written reports of research findings for the scientific record.' },
      function: 'Writes, submits, and publishes research findings in journals, conferences, and preprints',
      dysregulation: 'Publication bias, file drawer problem, preprint quality drift, ghost authorship',
      expectedTypes: [
        { type: 'Scientific journal publisher', reason: 'Elsevier, Springer Nature, Wiley, society journals', confidence: 0.95 },
        { type: 'Preprint server', reason: 'arXiv, bioRxiv, medRxiv, ChemRxiv, SSRN', confidence: 0.92 },
        { type: 'Manuscript editing service', reason: 'AJE, Editage, scientific editing for non-native English authors', confidence: 0.85 },
        { type: 'Open access publishing platform', reason: 'PLOS, Frontiers, eLife, MDPI', confidence: 0.88 },
        { type: 'Research dissemination platform', reason: 'ResearchGate, Academia.edu, Google Scholar profiles', confidence: 0.78 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Citation Networks', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates semantic information across domains, supporting conceptual reasoning and analogical thought.', inBusiness: 'In science, citation networks integrate prior work across fields, supporting reference, attribution, and impact measurement.' },
      function: 'Tracks, indexes, and analyzes citation relationships across scientific literature',
      dysregulation: 'Citation gaming, self-citation cycles, reference list manipulation, impact factor drift',
      expectedTypes: [
        { type: 'Citation database provider', reason: 'Scopus, Web of Science, Dimensions, Google Scholar', confidence: 0.95 },
        { type: 'Bibliometric analytics platform', reason: 'Altmetric, ImpactStory, research impact measurement', confidence: 0.88 },
        { type: 'Reference management software', reason: 'Zotero, Mendeley, EndNote', confidence: 0.92 },
        { type: 'Citation manipulation detection service', reason: 'Clarivate Integrity Watchdog, Cabells Predatory Reports, STM Integrity Hub, Retraction Watch Database for citation ring and paper mill detection', confidence: 0.78 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Funding and Grants', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates emotional valuation with long-term consequence assessment for value-based decision-making.', inBusiness: 'In science, grant funding decisions weigh scientific value, feasibility, and long-term impact across competing proposals.' },
      function: 'Awards, manages, and disburses research funding through grants and contracts',
      dysregulation: 'Funding cuts, grant award delays, indirect cost disputes, sequestration',
      expectedTypes: [
        { type: 'Federal grant-writing consultancy', reason: 'NSF, NIH, DARPA grant proposal development', confidence: 0.92 },
        { type: 'Grants management software', reason: 'Cayuse, Kuali, InfoEd, Workday Grants', confidence: 0.88 },
        { type: 'Research foundation', reason: 'HHMI, Wellcome, Gates, Simons, Sloan, Moore — private research funders', confidence: 0.95 },
        { type: 'University research administration office', reason: 'Pre-award and post-award management', confidence: 0.90 },
        { type: 'SBIR / STTR consultancy', reason: 'TurboSBIR, BBCetc, Dawnbreaker \u2014 Phase I/II/III proposal development for biotech and deep-tech startups pursuing NIH and DOE awards', confidence: 0.85 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Replication', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes new memories and consolidates short-term to long-term storage.', inBusiness: 'In science, replication consolidates findings from short-term study results into established scientific knowledge.' },
      function: 'Independently reproduces published findings to establish or refute their reliability',
      dysregulation: 'Replication failure, reproducibility crisis, methodology gaps',
      expectedTypes: [
        { type: 'Reproducibility project organization', reason: 'Center for Open Science, Reproducibility Project: Cancer Biology', confidence: 0.92 },
        { type: 'Pre-registration platform', reason: 'Locks methods before data collection to prevent post-hoc tweaking', confidence: 0.88 },
        { type: 'Replication-focused journal', reason: 'Journals dedicated to publishing replication studies', confidence: 0.78 },
        { type: 'Reproducible research toolkit vendor', reason: 'Containerization, workflow tools (Docker, Singularity, Nextflow)', confidence: 0.85 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Statistical Inference', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates goal-directed attention and cognitive resource allocation for inference.', inBusiness: 'In science, statistical inference allocates cognitive resources to extract valid conclusions from data while controlling for chance.' },
      function: 'Statistical methods, hypothesis testing, and inference from data to populations',
      dysregulation: 'p-hacking, multiple comparisons, base rate neglect, statistical illiteracy',
      expectedTypes: [
        { type: 'Statistical software vendor', reason: 'SAS, SPSS, Stata, R/Bioconductor', confidence: 0.95 },
        { type: 'Bayesian inference platform', reason: 'Stan, PyMC, JAGS for modern Bayesian workflows', confidence: 0.85 },
        { type: 'Statistics education platform', reason: 'DataCamp, Coursera biostatistics, university stats programs', confidence: 0.82 },
        { type: 'Statistical consulting service for researchers', reason: 'Stata Corp consulting, SAS Institute professional services, Cytel statistical consulting for NIH R01, NSF, and clinical trial grants', confidence: 0.88 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Theoretical Physics & Foundational Sciences', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports self-referential thought, mental imagery, and abstract spatial reasoning.', inBusiness: 'In science, theoretical work uses abstract reasoning and mental simulation to develop foundational frameworks.' },
      function: 'Theoretical physics, mathematics, and foundational science research',
      dysregulation: 'Theoretical stagnation, paradigm conflict, mathematical errors, foundational disputes',
      expectedTypes: [
        { type: 'Theoretical physics institute', reason: 'Perimeter Institute, Institute for Advanced Study, KITP', confidence: 0.90 },
        { type: 'Mathematical research software', reason: 'Mathematica, Maple, SageMath, Lean theorem prover', confidence: 0.85 },
        { type: 'Quantum simulation platform', reason: 'Software for quantum many-body physics and quantum chemistry', confidence: 0.82 },
        { type: 'Open foundational research consortium', reason: 'Open access theoretical physics and pure math collaborations', confidence: 0.78 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'Biology and Life Sciences', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates homeostatic functions and integrates physiological signals across body systems.', inBusiness: 'In science, life sciences research investigates the integrated physiological and molecular systems of living organisms.' },
      function: 'Biological research spanning molecular, cellular, organismal, and ecological scales',
      dysregulation: 'Reagent contamination, cell line misidentification, ecological replication crisis, data fragmentation',
      expectedTypes: [
        { type: 'Life sciences instrument vendor', reason: 'Sequencers, microscopes, flow cytometers, PCR machines', confidence: 0.95 },
        { type: 'Biological reagent supplier', reason: 'Antibodies, enzymes, cell lines, model organisms', confidence: 0.92 },
        { type: 'Bioinformatics software vendor', reason: 'Geneious, Benchling, DNAnexus, SnapGene', confidence: 0.90 },
        { type: 'Contract research organization (life sciences)', reason: 'Preclinical CROs for biotech and pharma', confidence: 0.92 },
        { type: 'Biological data repository', reason: 'GenBank, GEO, ArrayExpress, PDB, UniProt', confidence: 0.85 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Chemistry', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates subjective value of options and updates expectations as outcomes change.', inBusiness: 'In science, chemistry evaluates and updates molecular reactivity, synthesis routes, and structure-property relationships.' },
      function: 'Chemical research spanning synthesis, characterization, and physical chemistry',
      dysregulation: 'Synthesis irreproducibility, NMR misinterpretation, characterization gap, supply chain disruption',
      expectedTypes: [
        { type: 'Chemistry instrument manufacturer', reason: 'NMR, mass spec, HPLC, IR spectrometers', confidence: 0.95 },
        { type: 'Chemical reagent supplier', reason: 'Sigma-Aldrich, TCI, Strem, fine chemicals catalogs', confidence: 0.95 },
        { type: 'Computational chemistry software', reason: 'Gaussian, Schr\u00f6dinger, OpenMM, GROMACS', confidence: 0.88 },
        { type: 'Chemical structure database', reason: 'PubChem, ChemSpider, Reaxys, SciFinder', confidence: 0.90 }
      ]
    },
    'IPS': {
      fullName: 'Intraparietal Sulcus', label: 'Mathematics', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports numerical cognition, spatial reasoning, and quantity representation.', inBusiness: 'In science, mathematics provides the formal structures and computational tools across all quantitative research.' },
      function: 'Pure and applied mathematics research, numerical methods, and mathematical tooling',
      dysregulation: 'Proof verification gap, mathematical software errors, numerical instability',
      expectedTypes: [
        { type: 'Mathematical software vendor', reason: 'Mathematica, MATLAB, Maple, SageMath', confidence: 0.92 },
        { type: 'Numerical libraries provider', reason: 'NumPy, SciPy, Eigen, BLAS/LAPACK', confidence: 0.85 },
        { type: 'Mathematical research institute', reason: 'IAS, MSRI, Clay Mathematics Institute', confidence: 0.85 },
        { type: 'Formal verification / theorem proving tools', reason: 'Coq, Lean, Isabelle, Agda', confidence: 0.78 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Earth Sciences', tier: 'top',
      neuroTranslation: { inNeurology: 'Routes visceral sensory input from the body to higher brain regions.', inBusiness: 'In science, Earth sciences route environmental sensory data from the planet to scientific analysis pipelines.' },
      function: 'Geology, climatology, oceanography, and atmospheric sciences research',
      dysregulation: 'Sensor network gaps, climate model uncertainty, geological data fragmentation',
      expectedTypes: [
        { type: 'Environmental sensor network operator', reason: 'NOAA, USGS sensor networks, ocean and weather buoys', confidence: 0.90 },
        { type: 'Earth observation satellite operator', reason: 'NASA EOS, Landsat, ESA Sentinel, commercial earth obs', confidence: 0.92 },
        { type: 'Climate modeling consortium', reason: 'CMIP, IPCC, university climate research centers', confidence: 0.85 },
        { type: 'Geospatial data platform', reason: 'ESRI, Google Earth Engine, Planet Labs', confidence: 0.88 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Social Sciences', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates multimodal sensory input and supports theory of mind and social cognition.', inBusiness: 'In science, social sciences integrate observations of human behavior, institutions, and societies through theory of mind frameworks.' },
      function: 'Sociology, psychology, economics, political science, and behavioral research',
      dysregulation: 'Replication crisis (psychology), survey response bias, p-hacking, file drawer effect',
      expectedTypes: [
        { type: 'Social science survey platform', reason: 'Qualtrics, SurveyMonkey, REDCap', confidence: 0.92 },
        { type: 'Behavioral research tools vendor', reason: 'PsychoPy, OpenSesame, jsPsych, Inquisit', confidence: 0.85 },
        { type: 'Social science data archive', reason: 'ICPSR, UK Data Service, GESIS', confidence: 0.85 },
        { type: 'Crowdsourced subject pool', reason: 'Prolific, Amazon Mechanical Turk, CloudResearch', confidence: 0.82 }
      ]
    },
    'rACC': {
      fullName: 'Rostral Anterior Cingulate Cortex', label: 'Ethics Review', tier: 'top',
      neuroTranslation: { inNeurology: 'Engages in self-monitoring, moral reasoning, and emotional evaluation.', inBusiness: 'In science, ethics review monitors research practices for moral compliance, human/animal welfare, and integrity.' },
      function: 'IRB human subjects review, IACUC animal welfare, dual-use research oversight, research integrity',
      dysregulation: 'IRB backlog, ethics breach, research misconduct, conflict of interest',
      expectedTypes: [
        { type: 'IRB management software vendor', reason: 'Huron, IRBNet, Streamlyne', confidence: 0.90 },
        { type: 'Research ethics consultancy', reason: 'PRIM&R (Public Responsibility in Medicine and Research), Quorum Review, Sterling IRB consulting for institutional ethics program design and IRB accreditation (AAHRPP)', confidence: 0.82 },
        { type: 'Independent commercial IRB', reason: 'WCG, Advarra, Sterling for industry-sponsored research', confidence: 0.92 },
        { type: 'Research integrity oversight body', reason: 'ORI, university research integrity offices', confidence: 0.85 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke\u2019s Area', label: 'Computer Science', tier: 'top',
      neuroTranslation: { inNeurology: 'Comprehends language and extracts meaning from symbolic input.', inBusiness: 'In science, computer science develops the symbolic systems (algorithms, programming languages) that other sciences depend on.' },
      function: 'Computer science research including algorithms, systems, AI, ML, programming languages, theory',
      dysregulation: 'Reproducibility crisis (ML), benchmark gaming, conference review fatigue, code rot',
      expectedTypes: [
        { type: 'AI / ML research platform', reason: 'PyTorch, TensorFlow, JAX, Hugging Face', confidence: 0.92 },
        { type: 'CS research conference organization', reason: 'NeurIPS, ICML, ICLR, ACL, CVPR review and publishing', confidence: 0.88 },
        { type: 'Open source CS research foundation', reason: 'Apache, Linux Foundation, Eclipse', confidence: 0.85 },
        { type: 'CS reproducibility tools', reason: 'Papers With Code, ML reproducibility checklists', confidence: 0.82 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Workforce', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays auditory information from cochlea to auditory cortex; gateway for perception.', inBusiness: 'In science, the workforce pipeline relays trained scientists from universities to research positions.' },
      function: 'Recruits, trains, and retains the scientific workforce — graduate students, postdocs, faculty',
      dysregulation: 'Brain drain, postdoc bottleneck, tenure-track collapse, talent loss to industry',
      expectedTypes: [
        { type: 'Scientific recruiting agency', reason: 'Kelly Scientific Resources, Planet Pharma, CRA International, Slone Partners, Klein Hersh for PhD-level life-sciences recruiting', confidence: 0.85 },
        { type: 'Postdoctoral training program', reason: 'NIH F32, NSF postdoctoral fellowships, institutional T32s', confidence: 0.88 },
        { type: 'Research career platform', reason: 'AcademicJobsOnline, Nature Careers, ScienceCareers', confidence: 0.85 },
        { type: 'Mentorship and professional development organization', reason: 'NRMN, NextProf, scientific career development', confidence: 0.78 }
      ]
    },

    // ── SCIENCE-OPERATIONAL NODES (84) — functional roles in science hierarchy ──
    'A1':    { fullName: 'Primary Auditory Cortex', label: 'Notice & Communication', tier: 'operational', function: 'Initial communication of new findings, conferences, scientific announcements', dysregulation: 'Communication gap, announcement delay', expectedTypes: [{ type: 'Scientific conference organizer', reason: 'Hosts research presentations and announcements', confidence: 0.85 }, { type: 'Research news service', reason: 'EurekAlert, ScienceDaily, university press offices', confidence: 0.82 }] },
    'ADR':   { fullName: 'Adrenal', label: 'Crisis Response in Research', tier: 'operational', function: 'Emergency response to research crises, data loss, contamination, retractions', dysregulation: 'Crisis response failure', expectedTypes: [{ type: 'Research integrity crisis consultancy', reason: 'Kearney & Company federal research integrity practice, Huron Life Sciences, Guidehouse Research Integrity Services for retraction event management', confidence: 0.78 }, { type: 'Lab contamination remediation service', reason: 'Clean Harbors BSL decontamination, Stericycle Environmental Solutions, PuroClean biohazard remediation for post-event lab cleanup', confidence: 0.75 }] },
    'AI':    { fullName: 'Anterior Insula', label: 'Research Risk Triage', tier: 'operational', function: 'Identifies and prioritizes risks in research projects', dysregulation: 'Risk blindness', expectedTypes: [{ type: 'Research risk management software', reason: 'Cayuse IRB/IACUC/Biosafety risk modules, Kuali Research risk dashboards, Huron Click risk analytics for university VPR offices', confidence: 0.78 }, { type: 'Scientific due diligence service', reason: 'Clarivate Cortellis, Evaluate Pharma, GlobalData Healthcare for investor and funder scientific claim validation', confidence: 0.82 }] },
    'ANT':   { fullName: 'Anterior Thalamus', label: 'Research Workforce Alignment', tier: 'operational', function: 'Aligns scientific workforce skills with project needs', dysregulation: 'Skills gap', expectedTypes: [{ type: 'Scientific staffing agency', reason: 'Matches PhD-level scientists to research projects', confidence: 0.82 }, { type: 'Lab skills training platform', reason: 'Cold Spring Harbor courses, EMBO practical courses', confidence: 0.80 }] },
    'ARC':   { fullName: 'Arcuate Fasciculus', label: 'Comparative Research Analysis', tier: 'operational', function: 'Compares findings across studies and labs', dysregulation: 'Comparison gap', expectedTypes: [{ type: 'Systematic review platform', reason: 'Covidence, Rayyan, DistillerSR for systematic reviews', confidence: 0.85 }, { type: 'Meta-analysis software vendor', reason: 'Comprehensive Meta-Analysis, RevMan, metafor', confidence: 0.82 }] },
    'BDNF':  { fullName: 'BDNF / Plasticity', label: 'Research Innovation & Method Development', tier: 'operational', function: 'Develops new methods and adapts existing approaches', dysregulation: 'Method stagnation', expectedTypes: [{ type: 'Methods development consultancy', reason: 'Cold Spring Harbor Laboratory Meetings & Courses, EMBO Practical Courses, Janelia Research Campus method development residencies', confidence: 0.78 }, { type: 'Scientific innovation incubator', reason: 'IndieBio, Petri (Pillar VC), Nucleate, LabCentral, JLABS (Johnson & Johnson) for biotech and life-sciences method commercialization', confidence: 0.80 }] },
    'BLA':   { fullName: 'Basolateral Amygdala', label: 'Research Threat Detection', tier: 'operational', function: 'Detects threats to research integrity, IP, and lab safety', dysregulation: 'Threat blindness', expectedTypes: [{ type: 'Research IP protection service', reason: 'Wellspring (Inteum), Questel Orbit Intelligence, Clarivate Derwent Innovation for university tech-transfer IP monitoring', confidence: 0.80 }, { type: 'Lab safety compliance platform', reason: 'BioRAFT (SafetyStratus), VelocityEHS, Enablon (Wolters Kluwer), Intelex EHS for university and biotech research facility safety', confidence: 0.85 }] },
    'BNST':  { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Research Workforce Governance', tier: 'operational', function: 'Governs labor standards and policies for research workers', dysregulation: 'Policy gap', expectedTypes: [{ type: 'Postdoc and grad student union services', reason: 'UAW Local 5810 (University of California postdocs), SEIU Local 1021 academic workers, UE Local 255 Johns Hopkins for academic collective bargaining', confidence: 0.78 }, { type: 'Research HR compliance consultancy', reason: 'Huron Research Compliance, Attain Partners Higher Ed HR, Sibson Consulting federal-compliance practice for NIH/NSF personnel policy', confidence: 0.80 }] },
    'CAUD':  { fullName: 'Caudate Nucleus', label: 'Research Cost Optimization', tier: 'operational', function: 'Optimizes research costs and indirect cost recovery', dysregulation: 'Cost overrun', expectedTypes: [{ type: 'Research cost analytics platform', reason: 'Cayuse Sponsored Projects, Kuali Research Financials, Workday Grants Management, InfoEd SPIN for lab-level expense tracking against awards', confidence: 0.82 }, { type: 'Indirect cost rate consultancy', reason: 'Maximus Federal (F&A rate negotiations with DHHS and ONR), Attain Partners, Huron Research, Cohn Reznick research finance practice', confidence: 0.80 }] },
    'CBLM':  { fullName: 'Cerebellum', label: 'Research Coordination', tier: 'operational', function: 'Coordinates multi-step research workflows and collaborations', dysregulation: 'Coordination failure', expectedTypes: [{ type: 'Multi-site clinical trial coordinator', reason: 'Coordinates trials across many sites', confidence: 0.85 }, { type: 'Research project management platform', reason: 'Asana, Monday, Notion for research teams', confidence: 0.82 }] },
    'CC':    { fullName: 'Corpus Callosum', label: 'Cross-Lab Collaboration', tier: 'operational', function: 'Connects labs and institutions for collaborative research', dysregulation: 'Collaboration breakdown', expectedTypes: [{ type: 'Research collaboration platform', reason: 'Slack, Microsoft Teams, virtual labs', confidence: 0.85 }, { type: 'International research network', reason: 'Global Research Council, EU framework programs', confidence: 0.82 }] },
    'CING':  { fullName: 'Cingulum Bundle', label: 'Research Innovation Pipeline', tier: 'operational', function: 'Drives innovation pipeline from discovery to translation', dysregulation: 'Innovation stagnation', expectedTypes: [{ type: 'University innovation accelerator', reason: 'University-based startup incubators', confidence: 0.82 }, { type: 'Translational research center', reason: 'NIH NCATS, university CTSAs', confidence: 0.85 }] },
    'CLAUST':{ fullName: 'Claustrum', label: 'Research Issue Mapping', tier: 'operational', function: 'Maps and connects issues across research domains', dysregulation: 'Issue fragmentation', expectedTypes: [{ type: 'Research landscape analytics', reason: 'Maps research fields and connections', confidence: 0.78 }, { type: 'Scientific knowledge graph platform', reason: 'OpenAlex, Dimensions knowledge graphs', confidence: 0.80 }] },
    'CMZ':   { fullName: 'Cerebellar Marginal Zone', label: 'Lab Performance Tuning', tier: 'operational', function: 'Fine-tunes laboratory operational performance', dysregulation: 'Performance degradation', expectedTypes: [{ type: 'Lab operations consulting', reason: 'Siemens Lean Laboratory, GE Healthcare Lab Operations, Accenture Life Sciences consulting for lab throughput optimization', confidence: 0.78 }, { type: 'Equipment calibration service', reason: 'Agilent CrossLab Services, Thermo Fisher Unity Lab Services, Waters Professional Services, PerkinElmer OneSource for instrument calibration and qualification', confidence: 0.85 }] },
    'CON':   { fullName: 'Cingulo-Opercular Network', label: 'Research Best Practice Adoption', tier: 'operational', function: 'Identifies and adopts best practices across labs', dysregulation: 'Adoption lag', expectedTypes: [{ type: 'Research best practices consultancy', reason: 'Spreads good practices across institutions', confidence: 0.75 }, { type: 'Open methods sharing platform', reason: 'protocols.io, JoVE, methods journals', confidence: 0.82 }] },
    'CeA':   { fullName: 'Central Amygdala', label: 'Research Threat Operations', tier: 'operational', function: 'Operates threat detection systems for research environments', dysregulation: 'Detection failure', expectedTypes: [{ type: 'Lab security service', reason: 'Physical and cyber security for research labs', confidence: 0.78 }, { type: 'Biosafety oversight service', reason: 'BSL-2/3/4 compliance and oversight', confidence: 0.82 }] },
    'DAN':   { fullName: 'Dorsal Attention Network', label: 'Research Risk Profiling', tier: 'operational', function: 'Profiles and prioritizes scientific risks', dysregulation: 'Risk profile gap', expectedTypes: [{ type: 'Research portfolio risk service', reason: 'Risk assessment for grant portfolios', confidence: 0.78 }, { type: 'Funding compliance audit service', reason: 'Audits research grants for compliance', confidence: 0.85 }] },
    'DISS':  { fullName: 'Dissolution Network', label: 'Research Contingency Planning', tier: 'operational', function: 'Plans contingency for research disruptions and failures', dysregulation: 'Contingency gap', expectedTypes: [{ type: 'Lab continuity planning service', reason: 'Prepares labs for disruptions (pandemics, funding cuts)', confidence: 0.75 }, { type: 'Sample storage and disaster recovery', reason: 'Secure offsite storage of biological samples', confidence: 0.80 }] },
    'DV':    { fullName: 'Dorsal Vagal Complex', label: 'Research Quality Gates', tier: 'operational', function: 'Enforces quality checkpoints across the research process', dysregulation: 'Quality drift', expectedTypes: [{ type: 'Research quality management system', reason: 'GLP, GCP, ISO 17025 compliance for labs', confidence: 0.85 }, { type: 'Scientific QA consultancy', reason: 'Quality assurance for research operations', confidence: 0.80 }] },
    'EC':    { fullName: 'Entorhinal Cortex', label: 'Research Workforce Systems', tier: 'operational', function: 'Manages research workforce data systems', dysregulation: 'System fragmentation', expectedTypes: [{ type: 'Research HR information system', reason: 'Workday Grants & Effort Certification, Oracle HCM Research, Huron Click IRB personnel module for research staff credential management', confidence: 0.80 }, { type: 'Research personnel certification tracking', reason: 'CITI Program, BioRAFT (now SafetyStratus), LabArchives Inspector, and Vivarium certification tracking for IACUC/biosafety compliance', confidence: 0.78 }] },
    'EI':    { fullName: 'E/I Balance', label: 'Research Data Validation', tier: 'operational', function: 'Validates integrity of research data', dysregulation: 'Data corruption', expectedTypes: [{ type: 'Research data integrity service', reason: 'Validates and audits scientific datasets', confidence: 0.82 }, { type: 'Image manipulation detection software', reason: 'ImageTwin, Proofig for figure integrity', confidence: 0.85 }] },
    'EMP':   { fullName: 'Empathy Circuit', label: 'Cross-Domain Research Learning', tier: 'operational', function: 'Transfers learning across research domains and disciplines', dysregulation: 'Siloed learning', expectedTypes: [{ type: 'Interdisciplinary research center', reason: 'Santa Fe Institute, Flatiron Institute, MIT McGovern, Broad Institute, Allen Institute for interdisciplinary life sciences and complex systems', confidence: 0.78 }, { type: 'Scientific knowledge transfer platform', reason: 'Quanta Magazine, Nautilus, Knowable Magazine, Semantic Scholar TLDR for cross-disciplinary research translation', confidence: 0.75 }] },
    'ENDO':  { fullName: 'Endocannabinoid System', label: 'Research Process Mapping', tier: 'operational', function: 'Maps research workflows and processes', dysregulation: 'Process mapping gap', expectedTypes: [{ type: 'Research workflow mapping software', reason: 'Maps lab workflows and identifies bottlenecks', confidence: 0.78 }, { type: 'Research process improvement consultancy', reason: 'Lean lab and process improvement', confidence: 0.75 }] },
    'ENS':   { fullName: 'Enteric Nervous System', label: 'Research Process Improvement', tier: 'operational', function: 'Drives continuous improvement in research processes', dysregulation: 'Process decay', expectedTypes: [{ type: 'Lean lab consultancy', reason: 'Applies lean methods to research operations', confidence: 0.78 }, { type: 'Research process automation tools', reason: 'Workflow automation for repetitive lab tasks', confidence: 0.82 }] },
    'FEF':   { fullName: 'Frontal Eye Fields', label: 'Targeted Research Investigation', tier: 'operational', function: 'Targets specific research questions for focused investigation', dysregulation: 'Investigation drift', expectedTypes: [{ type: 'Focused research initiative', reason: 'NIH RFAs, NSF Big Ideas, targeted research', confidence: 0.82 }, { type: 'Investigation-specific funding service', reason: 'Targeted philanthropic research funding', confidence: 0.78 }] },
    'FG':    { fullName: 'Fusiform Gyrus', label: 'Research KPI Tracking', tier: 'operational', function: 'Tracks research performance indicators', dysregulation: 'KPI drift', expectedTypes: [{ type: 'Research analytics platform', reason: 'Clarivate InCites, Elsevier SciVal, Digital Science Dimensions for institutional publication, grant, citation, and impact analytics', confidence: 0.85 }, { type: 'Research output dashboard', reason: 'Symplectic Elements (Digital Science), Elsevier Pure, VIVO, Vivli for institutional research information management', confidence: 0.82 }] },
    'FORN':  { fullName: 'Fornix', label: 'Research Change Management', tier: 'operational', function: 'Manages changes in research practices and protocols', dysregulation: 'Change resistance', expectedTypes: [{ type: 'Research change management consultancy', reason: 'Huron Research Consulting, Attain Partners, Eab (Education Advisory Board) for university VPR transformation and open-science adoption programs', confidence: 0.75 }, { type: 'Protocol change management software', reason: 'Veeva Vault Clinical, Medidata Rave, Benchling Protocols, protocols.io for version-controlled protocol amendment workflows', confidence: 0.80 }] },
    'GABA_GLU':{ fullName: 'E/I Balance', label: 'Research Baseline Assessment', tier: 'operational', function: 'Assesses baseline research capabilities', dysregulation: 'Assessment gap', expectedTypes: [{ type: 'Research capability assessment service', reason: 'Assesses lab and institutional research capacity', confidence: 0.78 }, { type: 'Research benchmarking firm', reason: 'Compares institutions on research metrics', confidence: 0.82 }] },
    'GBA':   { fullName: 'Gut-Brain Axis', label: 'Research Stakeholder Systems', tier: 'operational', function: 'Manages stakeholder engagement with research', dysregulation: 'Stakeholder breakdown', expectedTypes: [{ type: 'Public engagement platform', reason: 'Citizen science and public-facing research engagement', confidence: 0.78 }, { type: 'Stakeholder consultation service', reason: 'Patient advocacy groups, community advisory boards', confidence: 0.82 }] },
    'GP':    { fullName: 'Globus Pallidus', label: 'Research Crisis Operations', tier: 'operational', function: 'Operates emergency response for research crises', dysregulation: 'Response failure', expectedTypes: [{ type: 'Research incident response service', reason: 'Kroll research investigations practice, Nardello & Co forensic integrity investigations, Ankura scientific misconduct response', confidence: 0.78 }, { type: 'Crisis communications for science', reason: 'Edelman science crisis practice, Weber Shandwick Health, APCO Worldwide scientific reputation management for retractions and misconduct events', confidence: 0.80 }] },
    'HAB':   { fullName: 'Habenula', label: 'Research Baseline Operations', tier: 'operational', function: 'Operates baseline monitoring for research activities', dysregulation: 'Baseline drift', expectedTypes: [{ type: 'Research operations monitoring tool', reason: 'iLab Operations Software (Agilent CrossLab), Stratocore PPMS, Clustermarket for core facility utilization and baseline tracking', confidence: 0.78 }, { type: 'Research dashboard service', reason: 'Tableau research editions, Power BI for research administration, Elsevier Pure dashboards, Symplectic Elements live dashboards', confidence: 0.78 }] },
    'HPA':   { fullName: 'HPA Axis', label: 'Research Stress Response', tier: 'operational', function: 'Manages stress responses across the research enterprise', dysregulation: 'Chronic stress', expectedTypes: [{ type: 'Researcher wellness program', reason: 'Mental health support for academic researchers', confidence: 0.80 }, { type: 'Research burnout consultancy', reason: 'Addresses burnout in research workforce', confidence: 0.75 }] },
    'IC':    { fullName: 'Inferior Colliculus', label: 'Research Change Governance', tier: 'operational', function: 'Governs changes to research protocols and policies', dysregulation: 'Uncontrolled change', expectedTypes: [{ type: 'Protocol amendment review service', reason: 'IRB amendment processing and tracking', confidence: 0.82 }, { type: 'Research policy consultancy', reason: 'Develops institutional research policies', confidence: 0.75 }] },
    'LANG':  { fullName: 'Language Network', label: 'Scientific Communication', tier: 'operational', function: 'Distributes scientific findings through structured language networks', dysregulation: 'Communication failure, jargon overload', expectedTypes: [{ type: 'Science writing service', reason: 'Translates technical research for grant narratives and lay summaries', confidence: 0.82 }, { type: 'Scientific translation service', reason: 'Translates research between languages for international collaboration', confidence: 0.78 }] },
    'CARD':  { fullName: 'Cardiac Autonomic Centers', label: 'Continuous Research Monitoring', tier: 'operational', function: 'Continuous monitoring of long-running research programs and clinical trials', dysregulation: 'Monitoring gap, alert fatigue', expectedTypes: [{ type: 'Clinical trial monitoring service', reason: 'IQVIA Clinical Trial Monitoring, ICON plc RBM, Parexel MedSafe, Advarra DSMB services for continuous safety and efficacy oversight', confidence: 0.85 }, { type: 'Long-term study tracking platform', reason: 'Medidata Rave (Dassault Syst\u00e8mes), Veeva Vault CTMS, Oracle Clinical One, REDCap longitudinal module for cohort and panel studies', confidence: 0.80 }] },
    'VP':    { fullName: 'Ventral Pallidum', label: 'Research Outcome Disposition', tier: 'operational', function: 'Translates research conclusions into final dispositions (publish, file IP, terminate, scale)', dysregulation: 'Disposition gap, project drift', expectedTypes: [{ type: 'Project decision-gate consultancy', reason: 'BCG Biopharma, McKinsey Life Sciences, ZS Associates for go/no-go gate design on preclinical and translational programs', confidence: 0.75 }, { type: 'Research portfolio prioritization service', reason: 'Planview Portfolios, Sciforma R&D Portfolio, Clarivate Cortellis Portfolio Analytics for university and biotech R&D allocation', confidence: 0.78 }] },
    'LAR':   { fullName: 'Laryngeal Motor Cortex', label: 'Predictive Research Modeling', tier: 'operational', function: 'Builds predictive models for research outcomes', dysregulation: 'Model failure', expectedTypes: [{ type: 'Research prediction analytics', reason: 'Predicts grant success and citation impact', confidence: 0.75 }, { type: 'Scientific forecasting service', reason: 'Forecasts research trends and breakthroughs', confidence: 0.72 }] },
    'LC':    { fullName: 'Locus Coeruleus', label: 'Research Strategy', tier: 'operational', function: 'Develops research strategy and priorities', dysregulation: 'Strategy drift', expectedTypes: [{ type: 'Research strategy consultancy', reason: 'Develops research strategy for institutions and funders', confidence: 0.82 }, { type: 'Science policy think tank', reason: 'AAAS, NAS, RAND science policy analysis', confidence: 0.85 }] },
    'LGN':   { fullName: 'Lateral Geniculate Nucleus', label: 'Research Capacity Assessment', tier: 'operational', function: 'Assesses research capacity at labs and institutions', dysregulation: 'Capacity blindness', expectedTypes: [{ type: 'Research capacity analytics', reason: 'Elsevier SciVal capacity analytics, Clarivate InCites institutional strength analysis, Digital Science Dimensions benchmarking', confidence: 0.78 }, { type: 'Lab utilization monitoring', reason: 'iLab Operations Software (Agilent), Stratocore PPMS, Corefacility for equipment booking and utilization tracking across university cores', confidence: 0.82 }] },
    'MAMM':  { fullName: 'Mammillary Bodies', label: 'Research Document Validation', tier: 'operational', function: 'Validates research documents and records', dysregulation: 'Document integrity failure', expectedTypes: [{ type: 'Research document management system', reason: 'Veeva Vault RIM, MasterControl Documents, Oracle Argus, Dotmatics Documents for GxP-compliant research document management', confidence: 0.80 }, { type: 'Lab notebook validation service', reason: 'LabArchives, Benchling Notebook, SciNote, IDBS E-WorkBook for electronic lab notebook validation and IP provenance', confidence: 0.78 }] },
    'MDT':   { fullName: 'Mediodorsal Thalamus', label: 'Research Adjudication', tier: 'operational', function: 'Adjudicates disputes in research and authorship', dysregulation: 'Dispute backlog', expectedTypes: [{ type: 'Research arbitration service', reason: 'Resolves authorship and IP disputes', confidence: 0.78 }, { type: 'Publication ethics committee service', reason: 'COPE-style ethics consultation for journals', confidence: 0.82 }] },
    'MICRO': { fullName: 'Microbiome', label: 'Research Standards Governance', tier: 'operational', function: 'Governs standards for research practices', dysregulation: 'Standard erosion', expectedTypes: [{ type: 'Research standards body', reason: 'NIST, ISO standards for laboratory practice', confidence: 0.78 }, { type: 'Research certification organization', reason: 'A2LA, GLP certification', confidence: 0.82 }] },
    'NAcc':  { fullName: 'Nucleus Accumbens', label: 'Research Reward & Recognition', tier: 'operational', function: 'Manages prestige, awards, and motivation for researchers', dysregulation: 'Recognition drift', expectedTypes: [{ type: 'Scientific awards organization', reason: 'Nobel Foundation, Lasker, Breakthrough Prize', confidence: 0.85 }, { type: 'Research metrics platform', reason: 'h-index, citation analytics for promotion', confidence: 0.85 }] },
    'NBM':   { fullName: 'Nucleus Basalis', label: 'Research Metric Evaluation', tier: 'operational', function: 'Evaluates effectiveness of research metrics', dysregulation: 'Metric staleness', expectedTypes: [{ type: 'Research evaluation consultancy', reason: 'RAND Science and Technology Policy Institute, SPRU (University of Sussex), Technopolis Group for research metric system design and evaluation', confidence: 0.75 }, { type: 'DORA-aligned evaluation service', reason: 'DORA (San Francisco Declaration on Research Assessment), CoARA (Coalition for Advancing Research Assessment), Leiden Manifesto implementation services', confidence: 0.78 }] },
    'NEOCER':{ fullName: 'Neocerebellum', label: 'Research Capacity Operations', tier: 'operational', function: 'Operates research capacity assessment', dysregulation: 'Operations gap', expectedTypes: [{ type: 'Core facility management service', reason: 'Operates university core research facilities', confidence: 0.82 }, { type: 'Shared instrument booking platform', reason: 'iLab, BookitLab, equipment scheduling', confidence: 0.85 }] },
    'OLF':   { fullName: 'Olfactory Cortex', label: 'Research Stakeholder Governance', tier: 'operational', function: 'Governs stakeholder engagement policies', dysregulation: 'Governance gap', expectedTypes: [{ type: 'Research policy advisory board', reason: 'Institutional research policy oversight', confidence: 0.78 }, { type: 'Community advisory board service', reason: 'Patient and community input on research', confidence: 0.80 }] },
    'OPIOID':{ fullName: 'Opioid System', label: 'Research Crisis Containment', tier: 'operational', function: 'Contains spread of research crises and reputation damage', dysregulation: 'Containment failure', expectedTypes: [{ type: 'Research reputation management', reason: 'Edelman Science, APCO Worldwide Academic & Research, Weber Shandwick Health for university reputation defense during misconduct events', confidence: 0.75 }, { type: 'Retraction management service', reason: 'Retraction Watch Database (Center for Scientific Integrity), Crossref Retraction Watch service, COPE (Committee on Publication Ethics) dispute resolution', confidence: 0.80 }] },
    'OSC':   { fullName: 'Oscillatory Networks', label: 'Research Resilience Innovation', tier: 'operational', function: 'Innovates approaches to research resilience', dysregulation: 'Resilience gap', expectedTypes: [{ type: 'Research resilience consultancy', reason: 'Huron Research Continuity practice, Alvarez & Marsal Higher Education, SRI International research operations advisory for bridge planning during grant gaps', confidence: 0.75 }, { type: 'Lab continuity planning tools', reason: 'Origami Risk, Sword Active Risk, Resolver GRC for lab business continuity and disaster recovery plan management', confidence: 0.72 }] },
    'OXY':   { fullName: 'Oxytocin System', label: 'Research Compliance Innovation', tier: 'operational', function: 'Innovates compliance approaches for research', dysregulation: 'Compliance lag', expectedTypes: [{ type: 'Research compliance automation', reason: 'Huron Click (IRB, IACUC, Safety, Agreements), Cayuse IRB/IACUC, Streamlyne Research, IRBNet for end-to-end compliance workflow automation', confidence: 0.85 }, { type: 'Research integrity tooling', reason: 'iThenticate (Turnitin), Proofig image forensics, ImageTwin, SciScore, Penelope.ai for pre-publication integrity screening', confidence: 0.82 }] },
    'PAG':   { fullName: 'Periaqueductal Gray', label: 'Predictive Research Assessment', tier: 'operational', function: 'Assesses predictive model accuracy for research', dysregulation: 'Model degradation', expectedTypes: [{ type: 'Research prediction validation service', reason: 'Validates accuracy of research forecasting models', confidence: 0.72 }, { type: 'Scientific impact prediction service', reason: 'Predicts which papers will become highly cited', confidence: 0.70 }] },
    'PBN':   { fullName: 'Parabrachial Nucleus', label: 'Research Sensitivity Analysis', tier: 'operational', function: 'Tests sensitivity of research findings to assumptions', dysregulation: 'Fragility blindness', expectedTypes: [{ type: 'Sensitivity analysis software', reason: 'Tests robustness of statistical conclusions', confidence: 0.75 }, { type: 'Multiverse analysis tool', reason: 'Tests robustness across analytical choices', confidence: 0.78 }] },
    'PCC':   { fullName: 'Posterior Cingulate Cortex', label: 'Research Diagnostic Evaluation', tier: 'operational', function: 'Evaluates diagnostic effectiveness of research', dysregulation: 'Evaluation gap', expectedTypes: [{ type: 'Research evaluation service', reason: 'Independent evaluation of research programs', confidence: 0.78 }, { type: 'Research methods audit firm', reason: 'Audits research methodology for grants and journals', confidence: 0.75 }] },
    'PI':    { fullName: 'Posterior Insula', label: 'Research Counterparty Evaluation', tier: 'operational', function: 'Evaluates collaborator and vendor performance', dysregulation: 'Evaluation gap', expectedTypes: [{ type: 'Research collaborator evaluation service', reason: 'ORCID collaboration tracking, Clarivate Web of Science author profiles, Scopus Author ID for institutional collaborator vetting', confidence: 0.75 }, { type: 'Vendor management for research', reason: 'SciQuest (Jaggaer Research), Coupa Higher Education, Ariba for reagent and equipment supplier management at universities', confidence: 0.78 }] },
    'PIN':   { fullName: 'Pineal', label: 'Research Cycle Management', tier: 'operational', function: 'Manages cyclical research processes (grant cycles, publication windows)', dysregulation: 'Cycle drift', expectedTypes: [{ type: 'Grant calendar service', reason: 'Pivot-RP (ProQuest), Grants.gov forecast service, Instrumentl grant discovery, SPIN (InfoEd) for federal and foundation deadline tracking', confidence: 0.82 }, { type: 'Research milestone tracking', reason: 'Asana for Research, Monday.com Life Sciences, Smartsheet research project templates, Kuali Research deliverables tracking', confidence: 0.80 }] },
    'PIT':   { fullName: 'Pituitary', label: 'Research Workforce Innovation', tier: 'operational', function: 'Innovates research workforce development', dysregulation: 'Workforce stagnation', expectedTypes: [{ type: 'New scientist training programs', reason: 'Innovative graduate and postdoc training models', confidence: 0.78 }, { type: 'Alternative career pathway program', reason: 'Industry, policy, communication tracks for PhDs', confidence: 0.80 }] },
    'PPN':   { fullName: 'Pedunculopontine Nucleus', label: 'Research Capacity Diagnostics', tier: 'operational', function: 'Diagnoses capacity bottlenecks in research operations', dysregulation: 'Capacity gap', expectedTypes: [{ type: 'Lab bottleneck diagnostic service', reason: 'Siemens Lean Laboratory assessments, Accenture Life Sciences operations practice, Deloitte R&D Performance advisory for lab throughput diagnostics', confidence: 0.78 }, { type: 'Research throughput analytics', reason: 'iLab Operations (Agilent), Stratocore PPMS analytics, Corefacility, Clustermarket utilization reporting for core facility throughput measurement', confidence: 0.75 }] },
    'PULV':  { fullName: 'Pulvinar', label: 'Research Outcome Innovation', tier: 'operational', function: 'Innovates outcome measurement for research', dysregulation: 'Measurement stagnation', expectedTypes: [{ type: 'Research impact analytics', reason: 'Overton.io (policy citations), Altmetric Explorer (Digital Science), Kudos Pro (research dissemination and impact tracking)', confidence: 0.78 }, { type: 'Altmetrics platform', reason: 'Altmetric (Digital Science), Plum Analytics (Elsevier), Impactstory / OurResearch, Lens.org for non-traditional metrics', confidence: 0.85 }] },
    'PUT':   { fullName: 'Putamen', label: 'Research Forensic Analysis', tier: 'operational', function: 'Performs forensic analysis on research misconduct', dysregulation: 'Analysis gap', expectedTypes: [{ type: 'Research misconduct investigation service', reason: 'Kroll academic investigations practice, Nardello & Co research forensics, Ankura Research Integrity, ORI (Office of Research Integrity) referred consultants', confidence: 0.80 }, { type: 'Image and data forensics for science', reason: 'Proofig AI image forensics, ImageTwin, FigCheck, Forensic Science Communications image analysis for blot and figure duplication detection', confidence: 0.85 }] },
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Research Network Analysis', tier: 'operational', function: 'Analyzes networks of researchers and collaborations', dysregulation: 'Network blindness', expectedTypes: [{ type: 'Research collaboration network analytics', reason: 'Analyzes co-authorship and collaboration networks', confidence: 0.80 }, { type: 'Researcher graph database', reason: 'Maps researcher relationships and influence', confidence: 0.78 }] },
    'RF':    { fullName: 'Reticular Formation', label: 'Research Reporting Standards', tier: 'operational', function: 'Governs research reporting standards', dysregulation: 'Standard erosion', expectedTypes: [{ type: 'Reporting standards body', reason: 'EQUATOR Network, CONSORT, ARRIVE, STROBE', confidence: 0.85 }, { type: 'Reporting checklist software', reason: 'Embeds reporting standards in submission workflows', confidence: 0.78 }] },
    'RSC':   { fullName: 'Retrosplenial Cortex', label: 'Cross-Field Research Comparison', tier: 'operational', function: 'Compares research practices across fields', dysregulation: 'Comparison gap', expectedTypes: [{ type: 'Cross-field benchmarking service', reason: 'Compares research norms across disciplines', confidence: 0.75 }, { type: 'Disciplinary best practices repository', reason: 'Curated best practices by field', confidence: 0.72 }] },
    'S1':    { fullName: 'Primary Somatosensory Cortex', label: 'Research Initial Intake', tier: 'operational', function: 'First contact between researchers and the research support system', dysregulation: 'Intake bottleneck', expectedTypes: [{ type: 'Research administration intake', reason: 'Pre-award intake at university research offices', confidence: 0.82 }, { type: 'Researcher onboarding service', reason: 'Onboards new PIs into institutional systems', confidence: 0.80 }] },
    'SC':    { fullName: 'Superior Colliculus', label: 'Research Technology Deployment', tier: 'operational', function: 'Deploys research technology and platforms', dysregulation: 'Deployment failure', expectedTypes: [{ type: 'Research IT services', reason: 'University research computing and IT', confidence: 0.85 }, { type: 'Research software implementation', reason: 'Implements ELN, LIMS, grants management systems', confidence: 0.82 }] },
    'SEPT':  { fullName: 'Septal Nuclei', label: 'Research Risk Quantification', tier: 'operational', function: 'Quantifies research risks across projects', dysregulation: 'Risk blindness', expectedTypes: [{ type: 'Research risk quantification service', reason: 'Huron Research Risk Advisory, PwC Pharma and Life Sciences risk practice, Deloitte Biopharma R&D risk analytics for portfolio-level quantification', confidence: 0.75 }, { type: 'Grant risk analytics', reason: 'NIH RePORTER analytics, Dimensions Grant Analytics (Digital Science), Federal RePORTER data feeds for award and execution risk modeling', confidence: 0.72 }] },
    'SMA':   { fullName: 'Supplementary Motor Area', label: 'Research Adaptation Analysis', tier: 'operational', function: 'Analyzes adaptation patterns in research practice', dysregulation: 'Adaptation failure', expectedTypes: [{ type: 'Research practice change consultancy', reason: 'Center for Open Science (COS) institutional programs, Huron Click implementation services, Research Square author services for new-method adoption', confidence: 0.75 }, { type: 'Research maturity assessment', reason: 'FAIR Data Maturity Model assessments (GO FAIR), NIH Data Management and Sharing policy audit services, Digital Science maturity benchmarking', confidence: 0.78 }] },
    'SMN':   { fullName: 'Somatomotor Network', label: 'Research Stakeholder Operations', tier: 'operational', function: 'Operates day-to-day stakeholder coordination for research', dysregulation: 'Coordination breakdown', expectedTypes: [{ type: 'Research collaboration platform', reason: 'Multi-party coordination for research projects', confidence: 0.80 }, { type: 'Research event management', reason: 'Conferences, workshops, training events', confidence: 0.82 }] },
    'SN':    { fullName: 'Salience Network', label: 'Research Outcome Operations', tier: 'operational', function: 'Operates outcome tracking for research projects', dysregulation: 'Tracking failure', expectedTypes: [{ type: 'Research outcome tracking platform', reason: 'Altmetric (Digital Science), Plum Analytics (Elsevier), Impactstory, Overton.io for research impact and policy-citation tracking', confidence: 0.78 }, { type: 'Grant outcome reporting service', reason: 'NIH RPPR (Research Performance Progress Report) support, NSF Research.gov reporting, Cayuse Outcomes, InfoEd Deliverables', confidence: 0.80 }] },
    'SNIG':  { fullName: 'Substantia Nigra', label: 'Research Predictive Evaluation', tier: 'operational', function: 'Evaluates predictive model performance for research', dysregulation: 'Model drift', expectedTypes: [{ type: 'Research analytics validation', reason: 'Clarivate Web of Science algorithm audit, Elsevier Scopus coverage audits, OpenAlex (OurResearch) open data validation for research analytics', confidence: 0.72 }, { type: 'Research forecast accuracy service', reason: 'Metaculus Science Track, Good Judgment Open Research, Replication Markets for predicting replication and impact outcomes', confidence: 0.70 }] },
    'SNS':   { fullName: 'Sympathetic Nervous System', label: 'Research Compliance Systems', tier: 'operational', function: 'Operates real-time research compliance monitoring', dysregulation: 'System failure', expectedTypes: [{ type: 'Continuous compliance monitoring for labs', reason: 'BioRAFT (SafetyStratus), VelocityEHS Lab Module, Intelex EHS continuous monitoring for IBC/IACUC/IRB compliance', confidence: 0.82 }, { type: 'Research safety monitoring', reason: 'Kenexa Lab Safety, Enablon EHS (Wolters Kluwer), VelocityEHS Incident Management for automated lab safety incident detection', confidence: 0.80 }] },
    'STN':   { fullName: 'Subthalamic Nucleus', label: 'Research Compliance Governance', tier: 'operational', function: 'Governs research compliance frameworks', dysregulation: 'Governance failure', expectedTypes: [{ type: 'Research compliance consultancy', reason: 'Huron Research Compliance, Attain Partners Research Compliance, WCG Avoca, BDO USA Research Compliance practice for institutional program design', confidence: 0.82 }, { type: 'Compliance training for researchers', reason: 'CITI Program (BRANY), OLAW tutorials (NIH), Epigeum Research Integrity courses, AAALAC training, Advarra Training for RCR and regulatory education', confidence: 0.85 }] },
    'STRI':  { fullName: 'Striatum', label: 'Research Procedural Operations', tier: 'operational', function: 'Encodes routine research procedures and SOPs', dysregulation: 'Procedural drift', expectedTypes: [{ type: 'Lab SOP management system', reason: 'Version-controlled standard operating procedures', confidence: 0.82 }, { type: 'Research protocol library', reason: 'protocols.io, JoVE methods library', confidence: 0.85 }] },
    'STS':   { fullName: 'Superior Temporal Sulcus', label: 'Research Compliance Coverage', tier: 'operational', function: 'Evaluates research compliance program coverage', dysregulation: 'Coverage gap', expectedTypes: [{ type: 'Research compliance audit firm', reason: 'Kearney & Company, Cotton & Company (Sikich), Baker Tilly Higher Ed, Plante Moran for institutional NIH/NSF/DOE compliance audits', confidence: 0.78 }, { type: 'Compliance gap assessment', reason: 'AAHRPP accreditation gap services, Huron Click Risk Assessment, Navex Global RiskRate for research compliance gap scoring', confidence: 0.75 }] },
    'TPOLE': { fullName: 'Temporal Pole', label: 'Research Trend Analysis', tier: 'operational', function: 'Analyzes trends in research output and topics', dysregulation: 'Trend blindness', expectedTypes: [{ type: 'Research trends analytics', reason: 'CB Insights Research Pulse, Clarivate Web of Science Emerging Topics, Elsevier SciVal Topic Prominence, Dimensions Topic analytics', confidence: 0.82 }, { type: 'Scientific landscape mapping', reason: 'VOSviewer, CiteSpace, SciMAT, Clarivate InCites for bibliometric field mapping and emerging area discovery', confidence: 0.80 }] },
    'THAL':  { fullName: 'Thalamus', label: 'Research Routing & Triage', tier: 'operational', function: 'Routes research requests, samples, and submissions', dysregulation: 'Routing failure', expectedTypes: [{ type: 'Sample tracking system', reason: 'LabVantage LIMS, STARLIMS (Abbott Informatics), Thermo Fisher SampleManager LIMS, Azenta sample management for end-to-end biobanking workflows', confidence: 0.85 }, { type: 'Submission routing for journals', reason: 'Clarivate ScholarOne Manuscripts, Aries Editorial Manager (Elsevier), River Valley ReView, Morressier for journal submission routing', confidence: 0.82 }] },
    'TrkB':  { fullName: 'TrkB Receptor', label: 'Research Pattern Analysis', tier: 'operational', function: 'Identifies anomalous patterns in research data', dysregulation: 'Pattern miss', expectedTypes: [{ type: 'Research data anomaly detection', reason: 'Dotmatics Insight, Benchling Analyses, KNIME Analytics Platform, Databricks Life Sciences for scientific dataset anomaly detection', confidence: 0.80 }, { type: 'Statistical outlier detection software', reason: 'GraphPad Prism ROUT outlier testing, JMP Statistical Discovery (SAS), Stata mixed-outlier tools, Minitab Outliers for experimental data outlier identification', confidence: 0.78 }] },
    'UNC':   { fullName: 'Uncinate Fasciculus', label: 'Research Data Aggregation', tier: 'operational', function: 'Aggregates data across research systems', dysregulation: 'Data fragmentation', expectedTypes: [{ type: 'Research data aggregation platform', reason: 'Combines data from multiple lab systems', confidence: 0.82 }, { type: 'Federated research data service', reason: 'Connects distributed research datasets', confidence: 0.80 }] },
    'V1':    { fullName: 'Primary Visual Cortex', label: 'Research Sensitivity Testing', tier: 'operational', function: 'Tests sensitivity of research outcomes', dysregulation: 'Sensitivity blindness', expectedTypes: [{ type: 'Statistical sensitivity testing tool', reason: 'Tests robustness of statistical conclusions', confidence: 0.78 }, { type: 'Research scenario modeling', reason: 'Models impact of methodological choices', confidence: 0.75 }] },
    'VAN':   { fullName: 'Ventral Attention Network', label: 'Research Workforce Operations', tier: 'operational', function: 'Operates day-to-day research workforce allocation', dysregulation: 'Allocation failure', expectedTypes: [{ type: 'Research staff scheduling platform', reason: 'iLab Core Scheduling (Agilent), Stratocore PPMS Booking, Clustermarket for core facility and shared-lab scheduling', confidence: 0.78 }, { type: 'Researcher time allocation tool', reason: 'Workday Grants Effort Certification, Huron ECRT (Effort Certification and Reporting Technology), Maximus ecrt for NIH/NSF effort reporting', confidence: 0.85 }] },
    'VERM':  { fullName: 'Cerebellar Vermis', label: 'Core Research Operations', tier: 'operational', function: 'Manages core operational processes for research labs', dysregulation: 'Operations breakdown', expectedTypes: [{ type: 'Lab management software', reason: 'Quartzy, LabGuru, Benchling, SciNote, Labforward for end-to-end research lab operations management', confidence: 0.85 }, { type: 'Research operations consultancy', reason: 'Huron Research Operations, Accenture Life Sciences Lab Advisory, Deloitte R&D Operations practice for core facility process optimization', confidence: 0.80 }] },
    'VEST':  { fullName: 'Vestibular System', label: 'Research Balance Analysis', tier: 'operational', function: 'Maintains balance across research portfolio risks', dysregulation: 'Imbalance', expectedTypes: [{ type: 'Research portfolio analytics', reason: 'Planview Portfolios, Sciforma R&D Portfolio, Clarivate Cortellis Competitive Intelligence, Elsevier SciVal Benchmarking for grant and project risk balancing', confidence: 0.75 }, { type: 'Scientific portfolio management', reason: 'Accolade Science Portfolio, Planisware 6, Sopheon Accolade for institutional R&D portfolio optimization', confidence: 0.78 }] },
    'VTA':   { fullName: 'Ventral Tegmental Area', label: 'Cross-Industry Research Learning', tier: 'operational', function: 'Drives cross-industry knowledge transfer to research', dysregulation: 'Learning failure', expectedTypes: [{ type: 'Industry-academia knowledge transfer', reason: 'Connects academic and industry research', confidence: 0.78 }, { type: 'Research best practices library', reason: 'Centralized knowledge from many fields', confidence: 0.75 }] },
    'VV':    { fullName: 'Ventral Vagal Complex', label: 'Research Integration Operations', tier: 'operational', function: 'Integrates research operational systems', dysregulation: 'Integration failure', expectedTypes: [{ type: 'Research systems integration service', reason: 'Connects ELN, LIMS, grants, and HR systems', confidence: 0.80 }, { type: 'Research data integration platform', reason: 'iPaaS for research informatics', confidence: 0.78 }] },
    'mPFC':  { fullName: 'Medial Prefrontal Cortex', label: 'Research Quality Operations', tier: 'operational', function: 'Operates quality management for research outputs', dysregulation: 'Quality failure', expectedTypes: [{ type: 'Research output quality service', reason: 'Quality review of manuscripts and grants', confidence: 0.78 }, { type: 'Manuscript quality auditing', reason: 'Pre-submission quality review', confidence: 0.80 }] },
    'vlPFC': { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Research Compliance Operations', tier: 'operational', function: 'Operates day-to-day research compliance', dysregulation: 'Compliance gap', expectedTypes: [{ type: 'Research compliance operations service', reason: 'WCG (WIRB-Copernicus Group), Advarra, Sterling IRB, Schulman IRB for outsourced institutional research compliance operations', confidence: 0.82 }, { type: 'IRB and IACUC operations service', reason: 'Huron Click IRB, Cayuse IRB/IACUC, IRBNet (Research Dataware), Streamlyne IRB for day-to-day protocol review operations', confidence: 0.85 }] }
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
      status: status, reason: reason || '',
      nodeId: nodeId, businessType: businessType,
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

  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  function loadFullHierarchy(callback) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) return callback(_hierarchyCache);
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
    var brain = brains.get('research');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = {
      nodeCompanies: {}, nodeTreatments: {}, nodeDiagnoses: {},
      nodeLabels: {}, nodeDepths: {}, allActivations: []
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

  function getScienceState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('research');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getScienceState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('research') : null;
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
          if (expected.confidence >= 0.85) {
            consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Science. It will appear as a valid target in grants, investments, and patent searches tied to ' + dir.label + '.';
          } else if (expected.confidence >= 0.75) {
            consequence = 'If approved: this business type becomes eligible for future portal path mapping and audit tracking within Science.';
          } else {
            consequence = 'If approved: this business type is recorded as a valid Science mapping for audit tracking. Requires further validation.';
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
    mapped.sort(sortFn); missing.sort(sortFn); speculative.sort(sortFn);

    return { mapped: mapped, missing: missing, speculative: speculative, error: null };
  }

  function getApprovedMappings() {
    var result = runInference(null);
    var approved = [];
    var all = result.missing.concat(result.speculative);
    for (var i = 0; i < all.length; i++) {
      if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    }
    return approved;
  }

  window.LIMENScienceBusinessEngine = {
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

  loadFullHierarchy(function () { console.log('[ScienceBusinessEngine] Hierarchy loaded'); });

  console.log('[ScienceBusinessEngine] Loaded \u2014 103-node full-hierarchy science business assignment engine');

})();
