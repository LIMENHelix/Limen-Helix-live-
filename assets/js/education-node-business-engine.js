/**
 * education-node-business-engine.js — Education Node-to-Business Assignment Engine
 *
 * EDUCATION DOMAIN ONLY. Full-hierarchy inference layer.
 * 103 operational nodes mapped (17 EDUCATION-TOP + 86 EDUCATION-OPERATIONAL).
 * Excludes the same 20 RI / framework nodes as locked domains
 * (note: education.json includes rPFC + sgACC at top level which are RI-excluded).
 *
 * Self-gates: only runs when ?domain=education
 * Exposes: window.LIMENEducationBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'education') return;

  var STORAGE_KEY = 'limen_education_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_education_hierarchy_cache';
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
  // 17 EDUCATION-TOP (full neuroTranslation) + 86 EDUCATION-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── EDUCATION-TOP NODES (17) — full detail with neuroTranslation ──
    'BROCA': {
      fullName: 'Broca\u2019s Area', label: 'K-12 Teaching', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured language and grammatical output, enabling expressive communication.', inBusiness: 'In education, K-12 teaching produces structured curriculum delivery, transforming standards into age-appropriate lessons.' },
      function: 'Translates curriculum into age-appropriate lessons and manages classroom dynamics K through 12',
      dysregulation: 'Teacher shortage, classroom management failure, instructional inconsistency, scripted-curriculum drift',
      expectedTypes: [
        { type: 'K-12 instructional content publisher', reason: 'Provides curriculum, lessons, textbooks for K-12 classrooms', confidence: 0.95 },
        { type: 'Teacher professional development provider', reason: 'PD vendors, instructional coaching organizations', confidence: 0.90 },
        { type: 'Classroom management software (LMS, SIS)', reason: 'Canvas, Schoology, PowerSchool — daily classroom tools', confidence: 0.92 },
        { type: 'Substitute teacher / staffing platform', reason: 'Swing Education, Source4Teachers, district staffing', confidence: 0.85 },
        { type: 'Charter school management organization', reason: 'KIPP, Success Academy, charter networks', confidence: 0.78 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Higher Education', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates semantic information across domains, supporting conceptual reasoning and higher-order thinking.', inBusiness: 'In education, higher education integrates conceptual frameworks across disciplines to develop expert reasoning.' },
      function: 'Delivers degree programs, advanced research training, and expert credentialing at colleges and universities',
      dysregulation: 'Enrollment cliff, tuition crisis, credentialing devaluation, faculty pipeline collapse',
      expectedTypes: [
        { type: 'Online program manager (OPM)', reason: '2U, Coursera, edX, Noodle — bring degrees online', confidence: 0.92 },
        { type: 'Higher education enrollment management', reason: 'Enrollment funnel optimization, admissions consulting', confidence: 0.88 },
        { type: 'University endowment / advancement consulting', reason: 'Ruffalo Noel Levitz, advancement services', confidence: 0.82 },
        { type: 'Higher ed financial aid consulting', reason: 'Net price calculator, financial aid optimization services', confidence: 0.85 },
        { type: 'Academic publishing platform', reason: 'Pearson, Cengage, Macmillan Higher Ed', confidence: 0.85 }
      ]
    },
    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Vocational Training', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output stage where planned actions become physical execution.', inBusiness: 'In education, vocational training produces direct workforce readiness through hands-on skill execution.' },
      function: 'Trains students in applied technical skills for specific career fields',
      dysregulation: 'Skills gap, CTE underfunding, employer disconnection, certification inflation',
      expectedTypes: [
        { type: 'CTE (Career Technical Education) program provider', reason: 'Career and technical education curriculum and equipment', confidence: 0.92 },
        { type: 'Apprenticeship program management', reason: 'Registered apprenticeship intermediaries', confidence: 0.85 },
        { type: 'Trade school / technical college operator', reason: 'Lincoln Tech, Universal Technical Institute', confidence: 0.88 },
        { type: 'Coding bootcamp / accelerated training program', reason: 'General Assembly, App Academy, Flatiron', confidence: 0.85 },
        { type: 'Industry certification provider', reason: 'CompTIA, Cisco, Microsoft, AWS, NCCER', confidence: 0.88 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Curriculum Design', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports working memory, planning, and coordination of multiple simultaneous goals.', inBusiness: 'In education, curriculum design holds learning objectives, scope, sequence, assessments, and pacing simultaneously.' },
      function: 'Designs scope, sequence, learning objectives, and assessment alignment for instructional programs',
      dysregulation: 'Standards misalignment, pacing drift, assessment-curriculum gap, scope creep',
      expectedTypes: [
        { type: 'Curriculum development consultancy', reason: 'Custom curriculum design for districts and states', confidence: 0.85 },
        { type: 'Standards alignment service', reason: 'CCSS, NGSS, state standards alignment audits', confidence: 0.82 },
        { type: 'Open educational resources (OER) platform', reason: 'OER Commons, OpenStax, CK-12 Foundation', confidence: 0.85 },
        { type: 'Curriculum-aligned content publisher', reason: 'Publishers producing materials tied to specific standards', confidence: 0.88 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate', label: 'Student Assessment', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects errors, monitors performance, and signals discrepancies between expectation and outcome.', inBusiness: 'In education, student assessment monitors learning performance and signals gaps between expectations and outcomes.' },
      function: 'Measures student knowledge and skill acquisition through formative and summative assessments',
      dysregulation: 'Test anxiety crisis, opt-out movement, validity drift, high-stakes testing backlash',
      expectedTypes: [
        { type: 'Standardized assessment publisher', reason: 'NWEA MAP, Curriculum Associates iReady, Renaissance', confidence: 0.95 },
        { type: 'Formative assessment platform', reason: 'Formative, Edulastic, Kahoot, Quizizz', confidence: 0.90 },
        { type: 'College-readiness testing organization', reason: 'College Board (SAT, AP), ACT Inc', confidence: 0.92 },
        { type: 'Assessment data analytics platform', reason: 'Forefront Education, Otus, MasteryConnect', confidence: 0.85 },
        { type: 'Item bank / question authoring service', reason: 'Test item development for districts and states', confidence: 0.78 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Learning Science', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes new memories and consolidates short-term to long-term storage.', inBusiness: 'In education, learning science studies how knowledge is encoded, retained, and transferred — the science of memory and learning.' },
      function: 'Researches how learning happens and translates findings into instructional practice',
      dysregulation: 'Research-practice gap, edu-myth proliferation, evidence-based drift, ineffective interventions',
      expectedTypes: [
        { type: 'Education research institute', reason: 'IES, university education schools, learning research labs', confidence: 0.88 },
        { type: 'Learning analytics platform', reason: 'Civitas Learning, Brightspace Insights', confidence: 0.85 },
        { type: 'Cognitive science-based learning tool', reason: 'Spaced repetition, retrieval practice, interleaving products', confidence: 0.82 },
        { type: 'Education research-to-practice translator', reason: 'Translates academic research into classroom practice', confidence: 0.78 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Special Education', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates multimodal sensory input and supports theory of mind.', inBusiness: 'In education, special education integrates diverse student needs and adapts instruction across modalities.' },
      function: 'Provides individualized education through IEPs, 504 plans, and disability accommodations',
      dysregulation: 'IEP non-compliance, inclusion failure, special education funding cuts, due process surge',
      expectedTypes: [
        { type: 'IEP management software vendor', reason: 'Frontline Education, PowerSchool Special Programs', confidence: 0.92 },
        { type: 'Special education staffing agency', reason: 'EBS Healthcare, Soliant Health, district SpEd staffing', confidence: 0.88 },
        { type: 'Assistive technology vendor', reason: 'Communication devices, screen readers, AT solutions', confidence: 0.85 },
        { type: 'Special education compliance consulting', reason: 'IDEA / Section 504 compliance audits and training', confidence: 0.82 },
        { type: 'Therapeutic services provider (OT/PT/SLP)', reason: 'Speech, occupational, physical therapy contractors', confidence: 0.85 }
      ]
    },
    'OXY': {
      fullName: 'Oxytocin System', label: 'Early Childhood Education', tier: 'top',
      neuroTranslation: { inNeurology: 'Modulates social bonding, attachment, and prosocial behavior.', inBusiness: 'In education, early childhood education builds the social, emotional, and cognitive bonds that anchor lifelong learning.' },
      function: 'Provides care and education for children from birth through pre-kindergarten',
      dysregulation: 'Childcare desert, ECE workforce shortage, quality variation, cost crisis',
      expectedTypes: [
        { type: 'Childcare center operator', reason: 'Bright Horizons, KinderCare, Learning Care Group', confidence: 0.92 },
        { type: 'Pre-K curriculum publisher', reason: 'Creative Curriculum, HighScope, Tools of the Mind', confidence: 0.85 },
        { type: 'ECE workforce training organization', reason: 'CDA credential prep, T.E.A.C.H. Early Childhood', confidence: 0.82 },
        { type: 'Childcare management software', reason: 'Brightwheel, Procare, HiMama', confidence: 0.88 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Distance Learning', tier: 'top',
      neuroTranslation: { inNeurology: 'Dynamically allocates cognitive resources and switches between tasks flexibly.', inBusiness: 'In education, distance learning flexibly adapts instruction across modalities, locations, and times.' },
      function: 'Delivers education remotely through online, hybrid, and asynchronous models',
      dysregulation: 'Engagement collapse, completion gap, digital divide, instructor presence failure',
      expectedTypes: [
        { type: 'Online learning platform (MOOC)', reason: 'Coursera, edX, Udemy, Khan Academy', confidence: 0.92 },
        { type: 'Virtual school provider', reason: 'Stride (K12), Connections Academy, Pearson Online Academy', confidence: 0.88 },
        { type: 'LMS / video conferencing for education', reason: 'Zoom Education, Google Meet for EDU, Microsoft Teams', confidence: 0.90 },
        { type: 'Synchronous tutoring platform', reason: 'Varsity Tutors, Wyzant, Tutor.com', confidence: 0.85 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Library Systems', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports self-referential thought, mental imagery, and integration of past experience.', inBusiness: 'In education, library systems integrate curated knowledge from the past to support present and future learning.' },
      function: 'Curates, organizes, and provides access to information resources for learning communities',
      dysregulation: 'Library budget cuts, collection obsolescence, information literacy gap, access inequality',
      expectedTypes: [
        { type: 'Integrated library system (ILS) vendor', reason: 'Innovative Interfaces, Ex Libris, Follett Destiny', confidence: 0.88 },
        { type: 'Academic library database publisher', reason: 'EBSCO, ProQuest, JSTOR, ScienceDirect', confidence: 0.92 },
        { type: 'School library book / media supplier', reason: 'Mackin, Follett School Solutions, Junior Library Guild', confidence: 0.85 },
        { type: 'Library makerspace / equipment supplier', reason: '3D printers, robotics kits, library STEM equipment', confidence: 0.78 }
      ]
    },
    'SMA': {
      fullName: 'Supplementary Motor Area', label: 'Teacher Training', tier: 'top',
      neuroTranslation: { inNeurology: 'Plans and prepares motor sequences before they are executed.', inBusiness: 'In education, teacher training prepares educators with the planned skills and routines they will execute in classrooms.' },
      function: 'Prepares pre-service teachers and provides ongoing professional development for in-service teachers',
      dysregulation: 'Teacher prep program collapse, PD ineffectiveness, induction gap, mentor shortage',
      expectedTypes: [
        { type: 'Teacher preparation program (university-based)', reason: 'Schools of Education, alternative certification programs', confidence: 0.88 },
        { type: 'Alternative certification provider', reason: 'Teach For America, TNTP, urban teacher residencies', confidence: 0.85 },
        { type: 'Instructional coaching platform', reason: 'Sibme, Edthena, BetterLesson coaching', confidence: 0.85 },
        { type: 'PD content / micro-credential provider', reason: 'Learners Edge, Connecting the Dots, Digital Promise', confidence: 0.82 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Educational Policy', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates emotional valuation with long-term consequence assessment for value-based decisions.', inBusiness: 'In education, policy weighs competing values and long-term consequences across students, families, and society.' },
      function: 'Develops federal, state, and local education policy and regulation',
      dysregulation: 'Policy whiplash, federal-state misalignment, unfunded mandates, accountability fatigue',
      expectedTypes: [
        { type: 'Education policy consulting firm', reason: 'Bellwether Education Partners, EdTrust, AIR', confidence: 0.85 },
        { type: 'Education advocacy organization', reason: 'NCTQ, NEPC, EdReform, Center for American Progress', confidence: 0.78 },
        { type: 'State / federal lobbying firm (education)', reason: 'Education government affairs and lobbying', confidence: 0.80 },
        { type: 'Education law firm', reason: 'Education law, IDEA compliance, civil rights litigation', confidence: 0.85 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke\u2019s Area', label: 'Literacy', tier: 'top',
      neuroTranslation: { inNeurology: 'Comprehends language and extracts meaning from symbolic input.', inBusiness: 'In education, literacy is the foundational symbolic comprehension skill that all other learning depends on.' },
      function: 'Develops reading, writing, and language comprehension skills across all grade levels',
      dysregulation: 'Reading crisis, science of reading wars, literacy gap, dyslexia identification gap',
      expectedTypes: [
        { type: 'Reading curriculum publisher', reason: 'Heggerty, Wilson Language, Lexia, Amplify CKLA', confidence: 0.92 },
        { type: 'Literacy assessment and screening tool', reason: 'DIBELS, Acadience Reading, mCLASS', confidence: 0.90 },
        { type: 'Reading intervention service', reason: 'Reading Recovery, Wilson Reading System, Orton-Gillingham', confidence: 0.85 },
        { type: 'Adult literacy program operator', reason: 'ProLiteracy, adult basic education programs', confidence: 0.78 }
      ]
    },
    'IPS': {
      fullName: 'Intraparietal Sulcus', label: 'STEM Education', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports numerical cognition, spatial reasoning, and quantitative thinking.', inBusiness: 'In education, STEM education builds the numerical, spatial, and quantitative reasoning needed for scientific thinking.' },
      function: 'Teaches mathematics, science, technology, and engineering across grade levels',
      dysregulation: 'STEM gap, math anxiety, lab equipment underfunding, computer science access gap',
      expectedTypes: [
        { type: 'STEM curriculum publisher', reason: 'Code.org, Project Lead The Way, Engineering is Elementary', confidence: 0.90 },
        { type: 'Math intervention platform', reason: 'DreamBox, Zearn, ALEKS, IXL', confidence: 0.92 },
        { type: 'Science lab equipment supplier', reason: 'Carolina Biological, Ward\u2019s Science, Vernier', confidence: 0.88 },
        { type: 'Computer science education platform', reason: 'Code.org, Tynker, CodeCombat, CS for All', confidence: 0.85 },
        { type: 'STEM professional development provider', reason: 'BSCS Science Learning, NSTA, NCTM', confidence: 0.82 }
      ]
    },
    'FG': {
      fullName: 'Fusiform Gyrus', label: 'Arts Education', tier: 'top',
      neuroTranslation: { inNeurology: 'Specialized for face/object recognition and visual-pattern identification.', inBusiness: 'In education, arts education develops visual, auditory, and pattern-recognition capacities through creative expression.' },
      function: 'Provides instruction in visual arts, music, theater, and dance',
      dysregulation: 'Arts program elimination, creative pedagogy decline, equity gap in arts access, NCLB residue',
      expectedTypes: [
        { type: 'Arts education curriculum publisher', reason: 'Music First, Quaver Music, Art of Education University', confidence: 0.85 },
        { type: 'School music instrument supplier', reason: 'Music & Arts, Sweetwater Education, Sam Ash Education', confidence: 0.82 },
        { type: 'Arts integration consultancy', reason: 'Kennedy Center Arts Integration, Lincoln Center Education', confidence: 0.78 },
        { type: 'Performing arts program operator', reason: 'Theater education, dance education, school musicals', confidence: 0.75 }
      ]
    },
    'DMN': {
      fullName: 'Default Mode Network', label: 'Research Universities', tier: 'top',
      neuroTranslation: { inNeurology: 'Active during self-referential thought, autobiographical memory, and identity processing.', inBusiness: 'In education, research universities form the institutional identity and intellectual narrative of advanced inquiry.' },
      function: 'Conducts advanced research and trains the next generation of researchers',
      dysregulation: 'Research funding cliff, faculty pipeline collapse, indirect cost rate disputes, R1 stratification',
      expectedTypes: [
        { type: 'Research university operator (R1)', reason: 'Top-tier research institutions', confidence: 0.85 },
        { type: 'Academic research support service', reason: 'Sponsored research administration, grant management', confidence: 0.85 },
        { type: 'University tech transfer office', reason: 'Commercializes university research IP', confidence: 0.82 },
        { type: 'Academic publishing for research', reason: 'Springer Nature, Elsevier, university presses', confidence: 0.85 }
      ]
    },
    'SMN': {
      fullName: 'Somatomotor Network', label: 'Workforce Development', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates sensory and motor functions for coordinated action.', inBusiness: 'In education, workforce development integrates education and labor market signals for coordinated talent supply.' },
      function: 'Connects education to labor market needs through skills training, credentialing, and placement',
      dysregulation: 'Skills mismatch, jobless degrees, credential inflation, employer-school disconnect',
      expectedTypes: [
        { type: 'Workforce development board / WIOA provider', reason: 'Local workforce boards, WIOA Title I services', confidence: 0.85 },
        { type: 'Employer-aligned training program', reason: 'Apprenticeship, employer-paid bootcamps, corporate training', confidence: 0.82 },
        { type: 'Career navigation / placement service', reason: 'Handshake, Year Up, Per Scholas', confidence: 0.85 },
        { type: 'Skills credentialing platform', reason: 'Credly, Accredible, Open Badges', confidence: 0.82 }
      ]
    },

    // ── EDUCATION-OPERATIONAL NODES (86) ──
    'A1':    { fullName: 'Primary Auditory Cortex', label: 'Auditory Learning Tools', tier: 'operational', function: 'Audio-based instruction, language learning, listening skills', dysregulation: 'Listening skill gap', expectedTypes: [{ type: 'Audio-based language learning platform', reason: 'Pimsleur, Audio Lingo, Mango Languages', confidence: 0.80 }, { type: 'Educational podcast publisher', reason: 'Brains On!, Wow in the World, Tumble', confidence: 0.75 }] },
    'ADR':   { fullName: 'Adrenal', label: 'Education Crisis Response', tier: 'operational', function: 'Emergency response to school closures, safety incidents, scandals', dysregulation: 'Crisis response failure', expectedTypes: [{ type: 'School crisis management consultancy', reason: 'Emergency response and recovery for districts', confidence: 0.78 }, { type: 'School safety / security technology vendor', reason: 'Raptor Technologies, Centegix, ALICE Training', confidence: 0.82 }] },
    'AI':    { fullName: 'Anterior Insula', label: 'Education Risk Triage', tier: 'operational', function: 'Identifies and prioritizes risks across schools and districts', dysregulation: 'Risk blindness', expectedTypes: [{ type: 'School risk assessment platform', reason: 'Risk audits, compliance triage', confidence: 0.78 }, { type: 'Student early warning system', reason: 'Hoonuit, Forefront Education, On-Track Indicators', confidence: 0.82 }] },
    'ANT':   { fullName: 'Anterior Thalamus', label: 'Workforce Skill Alignment', tier: 'operational', function: 'Aligns workforce skills with educational outputs', dysregulation: 'Skills mismatch', expectedTypes: [{ type: 'Skills mapping consultancy', reason: 'Maps program outcomes to labor market needs', confidence: 0.78 }, { type: 'Education-employer partnership platform', reason: 'Connects schools to employers for work-based learning', confidence: 0.80 }] },
    'ARC':   { fullName: 'Arcuate Fasciculus', label: 'Comparative Education Analysis', tier: 'operational', function: 'Compares education systems, programs, and outcomes', dysregulation: 'Comparison gap', expectedTypes: [{ type: 'Education benchmarking service', reason: 'PISA, NAEP, state-level comparisons', confidence: 0.78 }, { type: 'School effectiveness analytics', reason: 'GreatSchools, Niche, Stanford Education Data Archive', confidence: 0.85 }] },
    'BDNF':  { fullName: 'BDNF / Plasticity', label: 'Education Innovation', tier: 'operational', function: 'Drives innovative pedagogies and instructional approaches', dysregulation: 'Innovation stagnation', expectedTypes: [{ type: 'Education innovation lab', reason: 'NewSchools Venture Fund, LearnLaunch', confidence: 0.78 }, { type: 'Pilot program manager', reason: 'Manages innovation pilots in schools', confidence: 0.75 }] },
    'BLA':   { fullName: 'Basolateral Amygdala', label: 'School Threat Detection', tier: 'operational', function: 'Detects threats to student and staff safety', dysregulation: 'Threat blindness', expectedTypes: [{ type: 'School threat assessment service', reason: 'Behavioral threat assessment teams', confidence: 0.82 }, { type: 'Anonymous reporting platform', reason: 'STOPit, SafeOregon, Sandy Hook Promise', confidence: 0.80 }] },
    'BNST':  { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Education Workforce Governance', tier: 'operational', function: 'Governs labor standards and educator working conditions', dysregulation: 'Policy gap', expectedTypes: [{ type: 'Teachers union services', reason: 'NEA, AFT, state and local affiliates', confidence: 0.85 }, { type: 'Educator labor compliance consulting', reason: 'Title I, FLSA, employment law for districts', confidence: 0.78 }] },
    'CAUD':  { fullName: 'Caudate Nucleus', label: 'Education Cost Optimization', tier: 'operational', function: 'Optimizes spending across districts and institutions', dysregulation: 'Cost overrun', expectedTypes: [{ type: 'School district financial management software', reason: 'Tyler Technologies, PowerSchool eFinancePLUS', confidence: 0.85 }, { type: 'Education spending analytics service', reason: 'EdBuild, Edunomics Lab', confidence: 0.78 }] },
    'CBLM':  { fullName: 'Cerebellum', label: 'Educational Sequence Coordination', tier: 'operational', function: 'Coordinates sequenced learning progressions and pacing', dysregulation: 'Pacing failure', expectedTypes: [{ type: 'Pacing guide management software', reason: 'Curriculum mapping and pacing tools', confidence: 0.78 }, { type: 'Scope and sequence consultancy', reason: 'Curriculum sequencing services', confidence: 0.75 }] },
    'CC':    { fullName: 'Corpus Callosum', label: 'Cross-Institutional Collaboration', tier: 'operational', function: 'Connects schools, districts, and partners for collaborative work', dysregulation: 'Collaboration breakdown', expectedTypes: [{ type: 'School district collaboration network', reason: 'Education collaborative organizations', confidence: 0.78 }, { type: 'P-20 council facilitation service', reason: 'Cradle-to-career partnerships', confidence: 0.75 }] },
    'CING':  { fullName: 'Cingulum Bundle', label: 'EdTech Innovation Pipeline', tier: 'operational', function: 'Drives innovation pipeline for edtech and instructional design', dysregulation: 'Pipeline stagnation', expectedTypes: [{ type: 'EdTech accelerator', reason: 'Imagine K12, LearnLaunch, NewSchools', confidence: 0.82 }, { type: 'Innovation grant program (foundation)', reason: 'Foundation-funded education R&D', confidence: 0.80 }] },
    'CLAUST':{ fullName: 'Claustrum', label: 'Education Issue Mapping', tier: 'operational', function: 'Maps issues across districts to identify systemic patterns', dysregulation: 'Issue fragmentation', expectedTypes: [{ type: 'Education systems mapping platform', reason: 'Visualizes systemic education issues', confidence: 0.75 }, { type: 'District improvement consultancy', reason: 'Systemic district improvement work', confidence: 0.78 }] },
    'CMZ':   { fullName: 'Cerebellar Marginal Zone', label: 'School Performance Tuning', tier: 'operational', function: 'Fine-tunes school operations and instructional quality', dysregulation: 'Performance degradation', expectedTypes: [{ type: 'School improvement consultancy', reason: 'Targeted school improvement plans', confidence: 0.80 }, { type: 'Continuous improvement coaching', reason: 'Carnegie improvement science, networked improvement communities', confidence: 0.78 }] },
    'CON':   { fullName: 'Cingulo-Opercular Network', label: 'Comparative Innovation Adoption', tier: 'operational', function: 'Compares and adopts best practices across schools', dysregulation: 'Adoption lag', expectedTypes: [{ type: 'Best practices repository', reason: 'What Works Clearinghouse, Evidence for ESSA', confidence: 0.85 }, { type: 'School visit / shadow program', reason: 'Cross-school learning visits', confidence: 0.72 }] },
    'CARD':  { fullName: 'Cardiac Autonomic Centers', label: 'Continuous Education Monitoring', tier: 'operational', function: 'Continuous monitoring of student progress and school operations', dysregulation: 'Monitoring gap', expectedTypes: [{ type: 'Real-time student monitoring platform', reason: 'Continuous progress monitoring tools', confidence: 0.80 }, { type: 'School dashboard service', reason: 'Real-time operational dashboards for principals', confidence: 0.78 }] },
    'CeA':   { fullName: 'Central Amygdala', label: 'Behavioral Threat Operations', tier: 'operational', function: 'Operates behavioral threat assessment and intervention', dysregulation: 'Detection failure', expectedTypes: [{ type: 'Behavior intervention support service', reason: 'PBIS, MTSS, behavior support', confidence: 0.82 }, { type: 'Crisis intervention training provider', reason: 'CPI, Handle With Care, de-escalation training', confidence: 0.80 }] },
    'DAN':   { fullName: 'Dorsal Attention Network', label: 'Education Risk Profiling', tier: 'operational', function: 'Profiles and prioritizes risks across districts', dysregulation: 'Risk profile gap', expectedTypes: [{ type: 'District risk profiling service', reason: 'Comprehensive district risk assessments', confidence: 0.78 }, { type: 'Education insurance broker', reason: 'School district liability and property insurance', confidence: 0.82 }] },
    'DISS':  { fullName: 'Dissolution Network', label: 'Education Contingency Planning', tier: 'operational', function: 'Plans for school closures, mergers, and emergencies', dysregulation: 'Contingency gap', expectedTypes: [{ type: 'School closure / consolidation consultancy', reason: 'District restructuring services', confidence: 0.75 }, { type: 'Continuity of learning planning', reason: 'Pandemic / disaster learning plans', confidence: 0.78 }] },
    'DV':    { fullName: 'Dorsal Vagal Complex', label: 'Education Quality Gates', tier: 'operational', function: 'Enforces quality checkpoints across instruction', dysregulation: 'Quality drift', expectedTypes: [{ type: 'Instructional walkthrough platform', reason: 'TeachBoost, Edthena, Edivate', confidence: 0.80 }, { type: 'Quality assurance for online programs', reason: 'Quality Matters, OLC Quality Scorecard', confidence: 0.78 }] },
    'EC':    { fullName: 'Entorhinal Cortex', label: 'Education Workforce Systems', tier: 'operational', function: 'Manages workforce data systems for educators', dysregulation: 'System fragmentation', expectedTypes: [{ type: 'Educator HRIS / workforce system', reason: 'Frontline HCM, Powerschool TalentEd', confidence: 0.85 }, { type: 'Educator credential tracking system', reason: 'State certification databases', confidence: 0.80 }] },
    'ECN':   { fullName: 'Executive Control Network', label: 'School Leadership Operations', tier: 'operational', function: 'Coordinates principal and superintendent decision-making', dysregulation: 'Leadership drift', expectedTypes: [{ type: 'Principal coaching organization', reason: 'New Leaders, Wallace Foundation programs', confidence: 0.80 }, { type: 'Superintendent search firm', reason: 'BWP, Ray and Associates, JG Consulting', confidence: 0.78 }] },
    'EI':    { fullName: 'E/I Balance', label: 'Education Data Validation', tier: 'operational', function: 'Validates integrity of student and operational data', dysregulation: 'Data corruption', expectedTypes: [{ type: 'Education data quality service', reason: 'Validates data for state reporting', confidence: 0.78 }, { type: 'Student information system data audit', reason: 'SIS data integrity audits', confidence: 0.75 }] },
    'EMP':   { fullName: 'Empathy Circuit', label: 'Equity & Inclusion Programs', tier: 'operational', function: 'Drives equity, inclusion, and culturally responsive teaching', dysregulation: 'Equity gap', expectedTypes: [{ type: 'DEI consulting for schools', reason: 'Equity audits, culturally responsive teaching PD', confidence: 0.82 }, { type: 'Anti-bias training provider', reason: 'Learning for Justice, equity training', confidence: 0.78 }] },
    'ENDO':  { fullName: 'Endocannabinoid System', label: 'Education Process Mapping', tier: 'operational', function: 'Maps educational workflows and processes', dysregulation: 'Mapping gap', expectedTypes: [{ type: 'School workflow mapping consultancy', reason: 'Maps school operational workflows', confidence: 0.75 }, { type: 'Process improvement service', reason: 'Lean methods for school operations', confidence: 0.72 }] },
    'ENS':   { fullName: 'Enteric Nervous System', label: 'School Process Improvement', tier: 'operational', function: 'Drives continuous improvement in school operations', dysregulation: 'Process decay', expectedTypes: [{ type: 'School operations improvement consultancy', reason: 'Lean / continuous improvement for districts', confidence: 0.78 }, { type: 'School process automation service', reason: 'Automates routine administrative tasks', confidence: 0.75 }] },
    'FEF':   { fullName: 'Frontal Eye Fields', label: 'Targeted Education Investigation', tier: 'operational', function: 'Targets specific schools or programs for focused review', dysregulation: 'Investigation drift', expectedTypes: [{ type: 'School audit / accreditation review service', reason: 'AdvancED, Cognia, regional accreditors', confidence: 0.82 }, { type: 'Federal program monitoring service', reason: 'Title I, IDEA monitoring support', confidence: 0.78 }] },
    'FORN':  { fullName: 'Fornix', label: 'Education Change Management', tier: 'operational', function: 'Manages change in schools and districts', dysregulation: 'Change resistance', expectedTypes: [{ type: 'School change management consultancy', reason: 'Helps schools adopt new systems', confidence: 0.78 }, { type: 'Implementation science service', reason: 'NIRN, implementation consulting', confidence: 0.75 }] },
    'GABA_GLU':{ fullName: 'E/I Balance', label: 'School Baseline Assessment', tier: 'operational', function: 'Assesses baseline school capacity and readiness', dysregulation: 'Assessment gap', expectedTypes: [{ type: 'School needs assessment service', reason: 'Comprehensive needs assessments', confidence: 0.78 }, { type: 'Capacity assessment consultancy', reason: 'School capacity audits', confidence: 0.75 }] },
    'GBA':   { fullName: 'Gut-Brain Axis', label: 'Stakeholder Engagement Systems', tier: 'operational', function: 'Manages parent, student, and community engagement', dysregulation: 'Engagement breakdown', expectedTypes: [{ type: 'Parent engagement platform', reason: 'ParentSquare, Bloomz, Class Dojo', confidence: 0.85 }, { type: 'Community engagement consultancy', reason: 'Family-school partnership development', confidence: 0.78 }] },
    'GP':    { fullName: 'Globus Pallidus', label: 'Education Crisis Operations', tier: 'operational', function: 'Operates emergency response for school crises', dysregulation: 'Response failure', expectedTypes: [{ type: 'School emergency operations service', reason: '24/7 school incident response', confidence: 0.78 }, { type: 'Crisis communications for districts', reason: 'PR firms specializing in school crises', confidence: 0.78 }] },
    'HAB':   { fullName: 'Habenula', label: 'Education Baseline Operations', tier: 'operational', function: 'Operates baseline monitoring for education metrics', dysregulation: 'Baseline drift', expectedTypes: [{ type: 'Education performance monitoring tool', reason: 'Tracks key district performance indicators', confidence: 0.78 }, { type: 'School data warehouse service', reason: 'Education-specific data warehousing', confidence: 0.78 }] },
    'HPA':   { fullName: 'HPA Axis', label: 'Educator Stress Response', tier: 'operational', function: 'Manages stress responses across educator workforce', dysregulation: 'Chronic stress', expectedTypes: [{ type: 'Educator wellness program', reason: 'Teacher mental health and wellness services', confidence: 0.82 }, { type: 'Educator burnout prevention consultancy', reason: 'Burnout prevention for school workforce', confidence: 0.78 }] },
    'HYPO':  { fullName: 'Hypothalamus', label: 'Student Wellness Regulation', tier: 'operational', function: 'Maintains student basic needs and wellness baseline', dysregulation: 'Basic needs gap', expectedTypes: [{ type: 'School nutrition / food service operator', reason: 'School lunch program operators', confidence: 0.85 }, { type: 'School-based health center', reason: 'Health services in schools', confidence: 0.82 }] },
    'IC':    { fullName: 'Inferior Colliculus', label: 'Education Change Governance', tier: 'operational', function: 'Governs change processes across districts', dysregulation: 'Uncontrolled change', expectedTypes: [{ type: 'Curriculum adoption review service', reason: 'Manages curriculum review and adoption processes', confidence: 0.78 }, { type: 'Education policy compliance tracking', reason: 'Tracks federal and state policy changes', confidence: 0.80 }] },
    'LAR':   { fullName: 'Laryngeal Motor Cortex', label: 'Predictive Student Modeling', tier: 'operational', function: 'Builds predictive models for student outcomes', dysregulation: 'Model failure', expectedTypes: [{ type: 'Predictive student analytics platform', reason: 'Predicts at-risk students and graduation outcomes', confidence: 0.85 }, { type: 'Early warning system vendor', reason: 'EWS for K-12 and higher ed', confidence: 0.82 }] },
    'LC':    { fullName: 'Locus Coeruleus', label: 'Education Strategy Development', tier: 'operational', function: 'Develops strategic plans for districts and institutions', dysregulation: 'Strategy drift', expectedTypes: [{ type: 'District strategic planning consultancy', reason: 'Long-range district planning services', confidence: 0.80 }, { type: 'Higher ed strategy consultancy', reason: 'EAB, Tyton Partners, Ithaka S+R', confidence: 0.85 }] },
    'LGN':   { fullName: 'Lateral Geniculate Nucleus', label: 'School Capacity Assessment', tier: 'operational', function: 'Assesses physical and instructional capacity of schools', dysregulation: 'Capacity blindness', expectedTypes: [{ type: 'School facility planning service', reason: 'School facility studies and planning', confidence: 0.82 }, { type: 'Enrollment forecast consultancy', reason: 'School demographic forecasting', confidence: 0.85 }] },
    'MAMM':  { fullName: 'Mammillary Bodies', label: 'Education Document Validation', tier: 'operational', function: 'Validates official student and credential records', dysregulation: 'Document integrity failure', expectedTypes: [{ type: 'Transcript verification service', reason: 'National Student Clearinghouse, Parchment', confidence: 0.92 }, { type: 'Credential verification platform', reason: 'Diploma and credential authentication', confidence: 0.85 }] },
    'MDT':   { fullName: 'Mediodorsal Thalamus', label: 'Education Adjudication', tier: 'operational', function: 'Adjudicates disputes in education and discipline', dysregulation: 'Dispute backlog', expectedTypes: [{ type: 'School discipline mediation service', reason: 'Restorative justice and mediation in schools', confidence: 0.80 }, { type: 'Title IX investigation service', reason: 'Independent Title IX investigators', confidence: 0.82 }] },
    'MGN':   { fullName: 'Medial Geniculate Nucleus', label: 'Education Performance Operations', tier: 'operational', function: 'Operates performance monitoring across districts', dysregulation: 'Performance blindness', expectedTypes: [{ type: 'District performance management platform', reason: 'KPI tracking for districts', confidence: 0.80 }, { type: 'School scorecard service', reason: 'Public-facing school performance scorecards', confidence: 0.78 }] },
    'MICRO': { fullName: 'Microbiome', label: 'Education Standards Governance', tier: 'operational', function: 'Governs standards for educational practices', dysregulation: 'Standard erosion', expectedTypes: [{ type: 'Education standards body', reason: 'CCSS, NGSS, state standards developers', confidence: 0.82 }, { type: 'Educator standards organization', reason: 'CAEP, InTASC, NBPTS', confidence: 0.85 }] },
    'NAcc':  { fullName: 'Nucleus Accumbens', label: 'Student Reward & Motivation', tier: 'operational', function: 'Manages student motivation and engagement systems', dysregulation: 'Motivation drift', expectedTypes: [{ type: 'Student engagement platform', reason: 'Class Dojo, ClassCraft, gamification platforms', confidence: 0.85 }, { type: 'Student recognition program service', reason: 'Honor roll, awards, recognition systems', confidence: 0.75 }] },
    'NBM':   { fullName: 'Nucleus Basalis', label: 'Education Metric Evaluation', tier: 'operational', function: 'Evaluates effectiveness of education performance metrics', dysregulation: 'Metric staleness', expectedTypes: [{ type: 'Education evaluation consultancy', reason: 'Designs and evaluates school metric systems', confidence: 0.78 }, { type: 'Education benchmarking service', reason: 'Cross-district benchmarking', confidence: 0.78 }] },
    'NEOCER':{ fullName: 'Neocerebellum', label: 'Capacity Assessment Operations', tier: 'operational', function: 'Operates capacity assessment for schools and programs', dysregulation: 'Operations gap', expectedTypes: [{ type: 'School capacity analytics platform', reason: 'Real-time capacity tracking', confidence: 0.78 }, { type: 'Class size optimization tool', reason: 'Tools for optimizing classroom assignments', confidence: 0.75 }] },
    'NTS':   { fullName: 'Nucleus Tractus Solitarius', label: 'Student Information Routing', tier: 'operational', function: 'Routes student records, transcripts, and applications', dysregulation: 'Routing failure', expectedTypes: [{ type: 'Student information system (SIS)', reason: 'PowerSchool, Infinite Campus, Skyward', confidence: 0.92 }, { type: 'Application processing service', reason: 'Common Application, Coalition Application', confidence: 0.88 }] },
    'OFC':   { fullName: 'Orbitofrontal Cortex', label: 'Education Value Evaluation', tier: 'operational', function: 'Evaluates instructional and program value', dysregulation: 'Value drift', expectedTypes: [{ type: 'ROI analysis service for edtech', reason: 'EdTech ROI evaluation services', confidence: 0.78 }, { type: 'Education program evaluation firm', reason: 'External program evaluators', confidence: 0.82 }] },
    'OLF':   { fullName: 'Olfactory Cortex', label: 'Education Stakeholder Governance', tier: 'operational', function: 'Governs stakeholder engagement policies and protocols', dysregulation: 'Governance gap', expectedTypes: [{ type: 'School board governance consultancy', reason: 'NSBA, training for school board members', confidence: 0.78 }, { type: 'Family engagement compliance service', reason: 'Title I family engagement compliance', confidence: 0.75 }] },
    'OPIOID':{ fullName: 'Opioid System', label: 'Education Crisis Containment', tier: 'operational', function: 'Contains spread of education crises and reputation damage', dysregulation: 'Containment failure', expectedTypes: [{ type: 'School reputation management service', reason: 'Manages district reputation in crises', confidence: 0.75 }, { type: 'School communications consultancy', reason: 'Crisis communications for school districts', confidence: 0.78 }] },
    'OSC':   { fullName: 'Oscillatory Networks', label: 'Education Resilience Innovation', tier: 'operational', function: 'Innovates approaches to school system resilience', dysregulation: 'Resilience gap', expectedTypes: [{ type: 'School resilience consultancy', reason: 'Disaster preparedness, continuity planning', confidence: 0.75 }, { type: 'Pandemic learning continuity tool', reason: 'Hybrid / remote learning continuity tools', confidence: 0.78 }] },
    'PAG':   { fullName: 'Periaqueductal Gray', label: 'Predictive Model Validation', tier: 'operational', function: 'Validates predictive models for student outcomes', dysregulation: 'Model degradation', expectedTypes: [{ type: 'Education model validation service', reason: 'Validates accuracy of educational models', confidence: 0.75 }, { type: 'Education research replication service', reason: 'Independent replication of education research', confidence: 0.72 }] },
    'PBN':   { fullName: 'Parabrachial Nucleus', label: 'Education Sensitivity Analysis', tier: 'operational', function: 'Tests sensitivity of education outcomes to program parameters', dysregulation: 'Fragility blindness', expectedTypes: [{ type: 'Education scenario analysis service', reason: 'What-if analysis for education programs', confidence: 0.75 }, { type: 'School modeling consultancy', reason: 'Models impact of education policy changes', confidence: 0.75 }] },
    'PCC':   { fullName: 'Posterior Cingulate Cortex', label: 'Education Diagnostic Evaluation', tier: 'operational', function: 'Evaluates effectiveness of educational diagnostic tools', dysregulation: 'Diagnostic drift', expectedTypes: [{ type: 'Diagnostic assessment vendor', reason: 'Diagnostic instruments for student needs', confidence: 0.82 }, { type: 'Early literacy screening service', reason: 'Universal screening for reading risk', confidence: 0.85 }] },
    'PI':    { fullName: 'Posterior Insula', label: 'Vendor / Partner Evaluation', tier: 'operational', function: 'Evaluates education vendor performance and partnership health', dysregulation: 'Vendor drift', expectedTypes: [{ type: 'EdTech vendor evaluation service', reason: 'EdSurge, Common Sense Education product reviews', confidence: 0.85 }, { type: 'Education procurement consultancy', reason: 'Helps districts evaluate vendors', confidence: 0.78 }] },
    'PIN':   { fullName: 'Pineal', label: 'Education Cycle Management', tier: 'operational', function: 'Manages cyclical education calendars and grant cycles', dysregulation: 'Cycle drift', expectedTypes: [{ type: 'Grant calendar service for education', reason: 'Tracks education grant deadlines', confidence: 0.78 }, { type: 'School calendar management software', reason: 'Academic calendar planning tools', confidence: 0.75 }] },
    'PIT':   { fullName: 'Pituitary', label: 'Educator Workforce Innovation', tier: 'operational', function: 'Innovates educator development and retention', dysregulation: 'Workforce stagnation', expectedTypes: [{ type: 'Teacher residency program', reason: 'Boston Teacher Residency, Urban Teacher Center', confidence: 0.85 }, { type: 'Educator microcredential platform', reason: 'Digital Promise, BloomBoard', confidence: 0.82 }] },
    'PPN':   { fullName: 'Pedunculopontine Nucleus', label: 'Capacity Diagnostics', tier: 'operational', function: 'Diagnoses capacity bottlenecks in education systems', dysregulation: 'Capacity gap', expectedTypes: [{ type: 'Enrollment capacity diagnostic service', reason: 'Identifies enrollment bottlenecks', confidence: 0.78 }, { type: 'Class size analysis service', reason: 'Analyzes optimal class sizes', confidence: 0.75 }] },
    'PULV':  { fullName: 'Pulvinar', label: 'Education Outcome Innovation', tier: 'operational', function: 'Innovates measurement of education outcomes', dysregulation: 'Measurement stagnation', expectedTypes: [{ type: 'Outcomes-based education consultancy', reason: 'Develops outcome measurement frameworks', confidence: 0.78 }, { type: 'Long-term student outcome tracking', reason: 'College and career success tracking', confidence: 0.82 }] },
    'PUT':   { fullName: 'Putamen', label: 'Education Forensic Analysis', tier: 'operational', function: 'Performs forensic analysis on student outcome data', dysregulation: 'Analysis gap', expectedTypes: [{ type: 'Education data analytics consultancy', reason: 'Deep analysis of student outcome data', confidence: 0.80 }, { type: 'Test fraud / cheating detection service', reason: 'Test integrity and cheating detection', confidence: 0.78 }] },
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Education Network Analysis', tier: 'operational', function: 'Analyzes networks of educators and institutions', dysregulation: 'Network blindness', expectedTypes: [{ type: 'Education network analytics platform', reason: 'Maps relationships between schools and educators', confidence: 0.75 }, { type: 'Professional learning community platform', reason: 'PLC and educator network tools', confidence: 0.78 }] },
    'RF':    { fullName: 'Reticular Formation', label: 'Education Reporting Standards', tier: 'operational', function: 'Governs standards for state and federal education reporting', dysregulation: 'Standard erosion', expectedTypes: [{ type: 'Education data standards body', reason: 'CEDS, Ed-Fi data standards', confidence: 0.78 }, { type: 'State reporting compliance service', reason: 'Helps districts meet state reporting requirements', confidence: 0.82 }] },
    'RSC':   { fullName: 'Retrosplenial Cortex', label: 'Multi-State Education Comparison', tier: 'operational', function: 'Compares education practices across states', dysregulation: 'Comparison gap', expectedTypes: [{ type: 'Cross-state education comparison service', reason: 'Education Commission of the States, ECS reports', confidence: 0.82 }, { type: 'State education data dashboard', reason: 'EdSource, Education Data Initiative', confidence: 0.78 }] },
    'S1':    { fullName: 'Primary Somatosensory Cortex', label: 'Initial School Intake', tier: 'operational', function: 'First contact between students/families and schools', dysregulation: 'Intake bottleneck', expectedTypes: [{ type: 'School enrollment / registration system', reason: 'PowerSchool Enrollment, Infinite Campus enrollment', confidence: 0.85 }, { type: 'School choice application system', reason: 'SchoolMint, common applications for choice districts', confidence: 0.82 }] },
    'SC':    { fullName: 'Superior Colliculus', label: 'EdTech Deployment', tier: 'operational', function: 'Deploys education technology across districts', dysregulation: 'Deployment failure', expectedTypes: [{ type: 'EdTech deployment service', reason: 'Helps districts implement edtech tools', confidence: 0.82 }, { type: 'School IT services provider', reason: 'IT services for K-12 and higher ed', confidence: 0.85 }] },
    'SEPT':  { fullName: 'Septal Nuclei', label: 'Education Risk Quantification', tier: 'operational', function: 'Quantifies risks across education programs', dysregulation: 'Risk blindness', expectedTypes: [{ type: 'Education risk analytics platform', reason: 'Quantifies educational risk factors', confidence: 0.75 }, { type: 'School insurance / risk management', reason: 'Insurance and risk management for schools', confidence: 0.82 }] },
    'STN':   { fullName: 'Subthalamic Nucleus', label: 'Education Compliance Governance', tier: 'operational', function: 'Governs education compliance frameworks', dysregulation: 'Governance failure', expectedTypes: [{ type: 'Education compliance consultancy', reason: 'Helps districts comply with federal and state requirements', confidence: 0.82 }, { type: 'Compliance training for educators', reason: 'FERPA, Title IX, mandated reporter training', confidence: 0.85 }] },
    'STRI':  { fullName: 'Striatum', label: 'Education Procedural Operations', tier: 'operational', function: 'Encodes routine school procedures and SOPs', dysregulation: 'Procedural drift', expectedTypes: [{ type: 'School procedural documentation tool', reason: 'Manages SOPs for schools', confidence: 0.75 }, { type: 'Standard operating practice library', reason: 'Curated school operations documentation', confidence: 0.72 }] },
    'STS':   { fullName: 'Superior Temporal Sulcus', label: 'Compliance Coverage Evaluation', tier: 'operational', function: 'Evaluates compliance program coverage in schools', dysregulation: 'Coverage gap', expectedTypes: [{ type: 'School compliance audit firm', reason: 'External audits of school compliance programs', confidence: 0.78 }, { type: 'Compliance gap assessment for districts', reason: 'Identifies gaps in compliance', confidence: 0.75 }] },
    'THAL':  { fullName: 'Thalamus', label: 'Education Routing & Triage', tier: 'operational', function: 'Routes student records and applications', dysregulation: 'Routing failure', expectedTypes: [{ type: 'Student records management service', reason: 'Records management and transmission', confidence: 0.82 }, { type: 'Education clearing house', reason: 'National Student Clearinghouse, transcript exchange', confidence: 0.88 }] },
    'TPOLE': { fullName: 'Temporal Pole', label: 'Education Trend Analysis', tier: 'operational', function: 'Analyzes trends in education practice and policy', dysregulation: 'Trend blindness', expectedTypes: [{ type: 'Education trends research firm', reason: 'EdTech trend reports, EdWeek Research Center', confidence: 0.82 }, { type: 'Education industry analyst', reason: 'Tyton Partners, EAB, Eduventures', confidence: 0.85 }] },
    'TrkB':  { fullName: 'TrkB Receptor', label: 'Education Pattern Analysis', tier: 'operational', function: 'Identifies anomalous patterns in student data', dysregulation: 'Pattern miss', expectedTypes: [{ type: 'Student outcome pattern analytics', reason: 'Identifies patterns in student outcome data', confidence: 0.78 }, { type: 'Test fraud detection service', reason: 'Detects unusual patterns suggesting cheating', confidence: 0.78 }] },
    'UNC':   { fullName: 'Uncinate Fasciculus', label: 'Education Data Aggregation', tier: 'operational', function: 'Aggregates data across school systems', dysregulation: 'Data fragmentation', expectedTypes: [{ type: 'Education data warehouse provider', reason: 'BrightBytes, Forefront Education', confidence: 0.82 }, { type: 'Cross-system data integration service', reason: 'Integrates SIS, LMS, assessment data', confidence: 0.85 }] },
    'V1':    { fullName: 'Primary Visual Cortex', label: 'Visual Learning Tools', tier: 'operational', function: 'Visual instruction, infographics, video learning', dysregulation: 'Visual literacy gap', expectedTypes: [{ type: 'Educational video platform', reason: 'Edpuzzle, Khan Academy, BrainPOP', confidence: 0.85 }, { type: 'Visual learning content provider', reason: 'Visme, Canva for Education, infographic tools', confidence: 0.80 }] },
    'VAN':   { fullName: 'Ventral Attention Network', label: 'Education Workforce Operations', tier: 'operational', function: 'Operates day-to-day educator allocation', dysregulation: 'Allocation failure', expectedTypes: [{ type: 'Substitute teacher staffing platform', reason: 'Swing Education, Frontline Absence Management', confidence: 0.85 }, { type: 'Educator scheduling software', reason: 'School scheduling and timetabling tools', confidence: 0.82 }] },
    'VERM':  { fullName: 'Cerebellar Vermis', label: 'Core Education Operations', tier: 'operational', function: 'Manages core operational processes for schools', dysregulation: 'Operations breakdown', expectedTypes: [{ type: 'School operations management platform', reason: 'Comprehensive school operations tools', confidence: 0.82 }, { type: 'District operations consultancy', reason: 'Optimizes district operational processes', confidence: 0.78 }] },
    'VEST':  { fullName: 'Vestibular System', label: 'Comparative Balance Analysis', tier: 'operational', function: 'Maintains balance across education portfolio metrics', dysregulation: 'Imbalance', expectedTypes: [{ type: 'School portfolio analytics', reason: 'Balances metrics across schools in district', confidence: 0.75 }, { type: 'Equity analysis service', reason: 'Resource equity analysis for districts', confidence: 0.80 }] },
    'VP':    { fullName: 'Ventral Pallidum', label: 'Student Disposition Operations', tier: 'operational', function: 'Manages student transitions, graduations, and dispositions', dysregulation: 'Transition gap', expectedTypes: [{ type: 'College and career counseling platform', reason: 'Naviance, SCOIR, Cialfo', confidence: 0.85 }, { type: 'Graduation rate improvement service', reason: 'Helps districts improve graduation rates', confidence: 0.82 }] },
    'VTA':   { fullName: 'Ventral Tegmental Area', label: 'Cross-Industry Learning Transfer', tier: 'operational', function: 'Transfers learning practices across industries', dysregulation: 'Learning transfer failure', expectedTypes: [{ type: 'Corporate-education partnership platform', reason: 'Connects industry to schools', confidence: 0.78 }, { type: 'Industry mentor program', reason: 'Brings industry experts to schools', confidence: 0.78 }] },
    'VV':    { fullName: 'Ventral Vagal Complex', label: 'Education Integration Operations', tier: 'operational', function: 'Integrates operational systems across education functions', dysregulation: 'Integration failure', expectedTypes: [{ type: 'Education systems integrator', reason: 'Integrates SIS, LMS, assessment, finance', confidence: 0.82 }, { type: 'iPaaS for schools', reason: 'Integration platform for school systems', confidence: 0.78 }] },
    'SN':    { fullName: 'Salience Network', label: 'Education Priority Detection', tier: 'operational', function: 'Detects what matters most across district signals', dysregulation: 'Priority blindness', expectedTypes: [{ type: 'Early warning indicator system', reason: 'BrightBytes, Hoonuit, Forefront Education', confidence: 0.82 }, { type: 'District signal triage platform', reason: 'Surfaces highest-priority alerts to leadership', confidence: 0.78 }] },
    'SNIG':  { fullName: 'Substantia Nigra', label: 'Education Motor Initiation', tier: 'operational', function: 'Initiates and sustains program rollouts and reforms', dysregulation: 'Rollout failure', expectedTypes: [{ type: 'Education program management firm', reason: 'Drives multi-year reform initiative execution', confidence: 0.78 }, { type: 'Change management consultancy for districts', reason: 'Initiates and sustains reform momentum', confidence: 0.80 }] },
    'SNS':   { fullName: 'Sympathetic Nervous System', label: 'Education Crisis Mobilization', tier: 'operational', function: 'Mobilizes rapid response to schoolwide emergencies', dysregulation: 'Mobilization failure', expectedTypes: [{ type: 'School emergency notification system', reason: 'Raptor, CrisisGo, Navigate360', confidence: 0.85 }, { type: 'Rapid response staffing service', reason: 'Emergency substitute and counselor deployment', confidence: 0.78 }] },
    'LANG':  { fullName: 'Language Network', label: 'Multilingual Education', tier: 'operational', function: 'Bilingual, ESL, and multilingual instructional services', dysregulation: 'EL student support gap', expectedTypes: [{ type: 'ELL / ESL curriculum publisher', reason: 'Imagine Learning, National Geographic Learning', confidence: 0.85 }, { type: 'Translation services for schools', reason: 'Parent communication translation services', confidence: 0.80 }] },
    'mPFC':  { fullName: 'Medial Prefrontal Cortex', label: 'Education Quality Operations', tier: 'operational', function: 'Operates quality management across education programs', dysregulation: 'Quality failure', expectedTypes: [{ type: 'Program quality assurance service', reason: 'External quality reviews of education programs', confidence: 0.78 }, { type: 'School quality auditing service', reason: 'Independent school quality audits', confidence: 0.80 }] },
    'rACC':  { fullName: 'Rostral Anterior Cingulate', label: 'Education Quality Analysis', tier: 'operational', function: 'Analyzes quality of education work product', dysregulation: 'Quality blindness', expectedTypes: [{ type: 'Student work analytics service', reason: 'Analyzes quality of student work', confidence: 0.75 }, { type: 'Teacher feedback / observation platform', reason: 'TeachFX, Edthena classroom observation', confidence: 0.82 }] },
    'vlPFC': { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Education Compliance Operations', tier: 'operational', function: 'Operates day-to-day education compliance processes', dysregulation: 'Operational compliance failure', expectedTypes: [{ type: 'School compliance operations platform', reason: 'Day-to-day compliance management', confidence: 0.82 }, { type: 'FERPA / COPPA compliance service', reason: 'Student data privacy compliance', confidence: 0.85 }] }
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
    var brain = brains.get('education');
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

  function getEducationState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('education');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getEducationState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();
    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('education') : null;
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
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Education.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: this business type becomes eligible for future portal path mapping within Education.';
          else consequence = 'If approved: this business type is recorded as a valid Education mapping. Requires further validation.';
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

  window.LIMENEducationBusinessEngine = {
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

  loadFullHierarchy(function () { console.log('[EducationBusinessEngine] Hierarchy loaded'); });
  console.log('[EducationBusinessEngine] Loaded \u2014 103-node education business engine');
})();
