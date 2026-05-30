#!/usr/bin/env node
/**
 * build-brain-node-business-mapping.js
 *
 * Joins the 124-node canonical taxonomy (assets/data/brain-node-domains.json)
 * with the 111-directory's rich per-node neuroscience info (_node_directory.json),
 * emitting assets/data/brain-node-business-mapping.json — the authoring reference
 * portal authors consult when binding a company to a brainNodeId.
 *
 * The 124-taxonomy stays canonical for what node IDs exist. This artifact adds:
 *   - region (full anatomical name)
 *   - network (DMN / Salience / Executive / Limbic / ...)
 *   - phase (P-numbers from the 111-directory's phase model)
 *   - function (one-paragraph neuroscience description)
 *   - dysregulation (hyperactive / hypoactive patterns)
 *   - business (industries that typically bind to this node)
 *   - source ("111-directory" | "draft" | "synthesized")
 *   - domainBindings (existing per-domain role assignments from 124-taxonomy)
 *
 * Per feedback memory "ask if unsure when binding a company to a brain node":
 * this artifact answers WHAT-INDUSTRIES-MAP-TO-NODE (general, no ambiguity to ask).
 * Specific company-role bindings inside a portal's functionalNetwork still need
 * user confirmation when ambiguous.
 *
 * Usage:
 *   node scripts/build-brain-node-business-mapping.js
 */

const fs = require('fs');
const path = require('path');

const TAXONOMY = path.join(__dirname, '..', 'assets', 'data', 'brain-node-domains.json');
const DIRECTORY = path.join(__dirname, '..', '_node_directory.json');
const OUT = path.join(__dirname, '..', 'assets', 'data', 'brain-node-business-mapping.json');

// Hand-authored drafts for the 76 taxonomy IDs that don't have a direct
// abbrev-match in the 111-directory. Each is a SHORT general business-binding
// description; confidence is "draft" until reviewed. These are well-established
// neuroscience-to-industry mappings — not company-specific bindings (those
// require user confirmation per feedback memory).
const DRAFTS = {
  NAcc:   { region: 'Nucleus Accumbens', network: 'Reward', phase: 'P5/P0',
    function: 'Reward processing, motivation, addiction, wanting vs. liking distinction, salience gating into action. Camelcase variant of NAc; the substantive node in this taxonomy.',
    dysregulation: 'Hyperactive → compulsive seeking, addiction. Hypoactive → anhedonia, depression.',
    business: 'Addiction treatment centers, behavioral economics firms, loyalty/rewards platforms, gambling industry regulators, sales-incentive platforms' },
  DMN:    { region: 'Default Mode Network (network-level)', network: 'DMN', phase: 'P0/P8',
    function: 'Network-level: rest-state activity, autobiographical narrative, self-referential thought, mind-wandering. Aggregates mPFC + PCC + AG + precuneus + parts of HIPP.',
    dysregulation: 'Hyperactive → rumination, depression, ego inflation. Hypoactive → depersonalization, psychedelic ego dissolution.',
    business: 'Brand strategy firms, corporate identity consulting, legacy/heritage agencies, succession planning, executive coaching' },
  STRI:   { region: 'Striatum (Caudate + Putamen + NAc aggregate)', network: 'Basal Ganglia', phase: 'P6/P5',
    function: 'Action selection, habit formation, procedural learning, reward-based decision-making. Habit-circuit machinery.',
    dysregulation: 'Hyperactive → compulsion, OCD, Tourette\'s. Hypoactive → Parkinson\'s bradykinesia.',
    business: 'Workflow automation, process management, manufacturing operations, habit-forming product design, RPA / robotic process automation, training-platform companies' },
  HPA:    { region: 'Hypothalamic-Pituitary-Adrenal axis', network: 'HPA Axis', phase: 'P3/P1',
    function: 'Master stress-response cascade — CRH → ACTH → cortisol. Bridges acute (sympathetic) and chronic (cortisol) stress responses.',
    dysregulation: 'Hyperactive → chronic stress, Cushing\'s, immunosuppression. Hypoactive → adrenal fatigue.',
    business: 'Stress management programs, cortisol testing labs, occupational health, corporate wellness, endocrinology practices, crisis-management consulting' },
  GABA_GLU: { region: 'GABA-Glutamate balance (neurotransmitter system)', network: 'Oscillatory', phase: 'P5/P3',
    function: 'Excitatory (glutamate) and inhibitory (GABA) balance — sets cortical excitability, network synchrony, sleep depth. The brain\'s gain control.',
    dysregulation: 'Glutamate excess → excitotoxicity, anxiety, seizure. GABA deficit → anxiety, insomnia.',
    business: 'Anti-anxiety pharma, sleep medicine, anesthesiology, neurology, seizure-monitoring devices, market-makers / liquidity providers (finance analog)' },
  OPIOID: { region: 'Endogenous Opioid System', network: 'Neuromodulatory', phase: 'P3/P4',
    function: 'Pain modulation, social bonding (mu-opioid), reward/affect (beta-endorphin), withdrawal/aversion (kappa-opioid). Hedonic tone.',
    dysregulation: 'Excess seeking → addiction. Deficit → social pain, depression, fibromyalgia.',
    business: 'Pain management clinics, opioid pharma (prescription + addiction treatment), MAT clinics, social-bonding platforms, customer-loyalty platforms' },
  HAB:    { region: 'Habenula (Lateral)', network: 'Limbic/Reward', phase: 'P3',
    function: 'Anti-reward signal — encodes negative prediction errors, punishment, disappointment. Inhibits VTA/RAPHE (DA/5-HT suppression). Implicated in treatment-resistant depression.',
    dysregulation: 'Hyperactive → learned helplessness, treatment-resistant depression. Hypoactive → mania, lack of loss-aversion.',
    business: 'Depression treatment companies, DBS device manufacturers, loss-aversion / negative-incentive research, behavioral economics firms' },
  GBA:    { region: 'Gut-Brain Axis (vagal + microbiome + ENS)', network: 'Gut-Brain', phase: 'P0/P4',
    function: 'Bidirectional gut-brain signaling — vagal afferents + microbial metabolites + ENS. Produces 95% of body\'s serotonin via enterochromaffin cells.',
    dysregulation: 'Dysbiosis → mood, immune, metabolic disorder. Vagal tone loss → autonomic dysregulation.',
    business: 'Gut microbiome companies, probiotics industry, IBS treatment, functional GI medicine, food-as-medicine companies' },
  HIPP:   { region: 'Hippocampus (CA1/CA3/DG aggregate)', network: 'Limbic/Memory', phase: 'P0/P10',
    function: 'Episodic memory encoding/retrieval, spatial navigation, pattern separation/completion, context encoding. Neurogenesis hub.',
    dysregulation: 'Atrophy → Alzheimer\'s, PTSD context-binding failure. Hyperactive → intrusive recall, PTSD flashback.',
    business: 'Data management firms, knowledge management, corporate training, archival/library services, spatial intelligence, Alzheimer\'s care, RAG / vector-database companies' },
  VP:     { region: 'Ventral Pallidum', network: 'Basal Ganglia/Reward', phase: 'P5',
    function: 'Reward circuit output node — translates limbic motivation into motor action. Hedonic hotspot for "liking" component of reward.',
    dysregulation: 'Hypoactive → anhedonia. Hyperactive → compulsive seeking.',
    business: 'Reward-circuit therapeutics, addiction treatment, sales-incentive design, gamification platforms' },
  BDNF:   { region: 'Brain-Derived Neurotrophic Factor (growth factor)', network: 'Plasticity', phase: 'P10/P8',
    function: 'Neuroplasticity master regulator — synaptic strength, neurogenesis, dendritic growth. Downstream of exercise, ketamine, psychedelics, antidepressants.',
    dysregulation: 'Low BDNF → depression, cognitive decline. High BDNF → enhanced learning, recovery.',
    business: 'R&D departments, innovation incubators, brain-training apps, ketamine/psychedelic clinics, exercise/wellness brands' },
  RAPHE:  { region: 'Raphe Nuclei (Dorsal + Median)', network: 'Neuromodulatory', phase: 'P4/P3',
    function: 'Primary serotonin source. Mood regulation, patience/waiting behavior, social hierarchy, threat tolerance, sleep.',
    dysregulation: 'Low → depression, anxiety, impulsivity. High → mood elevation, social withdrawal.',
    business: 'SSRI/SNRI pharma, mood-tracking apps, sleep tech, social platform design, workplace culture consulting' },
  HYPO:   { region: 'Hypothalamus (preoptic / lateral / arcuate)', network: 'Autonomic/Homeostatic', phase: 'P0/P3',
    function: 'Homeostatic regulation — temperature, hunger, thirst, sleep, circadian, sexual behavior, autonomic outflow. The body\'s thermostat.',
    dysregulation: 'Lesion → cachexia, hyperphagia, sleep loss. Tumor → hormonal cascade failure.',
    business: 'Endocrinology, sleep medicine, circadian-rhythm tech, weight-management programs, metabolic medicine, smart-thermostat IoT' },
  EMP:    { region: 'Empathy circuit (AI + ACC + TPJ aggregate)', network: 'Social', phase: 'P2/P8',
    function: 'Network-level empathy — pain empathy (AI+ACC), cognitive empathy (TPJ), affective empathy (mirror neurons).',
    dysregulation: 'Hyperactive → empathic distress burnout. Hypoactive → psychopathy, autism social cognition deficit.',
    business: 'UX research, customer service training, mediation/conflict resolution, autism intervention, social robotics, HR consulting' },
  CBLM:   { region: 'Cerebellum (vermis + hemispheres + dentate aggregate)', network: 'Cerebellum', phase: 'P6/P5',
    function: 'Motor coordination + cognitive timing + error correction + predictive coding. Recent: implicated in cognition + emotion regulation.',
    dysregulation: 'Lesion → ataxia, dysmetria, cognitive-affective syndrome. Atrophy → emotional dysregulation.',
    business: 'Precision robotics, manufacturing quality control, surgical robotics, financial algorithm timing, fall-prevention tech' },
  THAL:   { region: 'Thalamus (multiple nuclei aggregate)', network: 'Thalamus', phase: 'P1/P6',
    function: 'Sensory relay + attention gating + arousal modulation. The brain\'s switching station — almost all sensory + motor info passes through.',
    dysregulation: 'Lesion → coma (intralaminar), neglect, anesthesia. Hyperactive → thalamic pain syndrome.',
    business: 'Telecommunications routing, data infrastructure, content delivery networks, market-data providers, anesthesiology' },
  OXY:    { region: 'Oxytocin System', network: 'Neuromodulatory', phase: 'P2/P4',
    function: 'Social bonding, trust, in-group affiliation, childbirth/lactation, pair-bonding. Released by social touch and synchrony.',
    dysregulation: 'Low → social aloofness, attachment disorder. High → in-group bias, tribalism.',
    business: 'Loyalty programs, community platforms, dating services, relationship counseling, in-person retail/hospitality, religious organizations' },
  FPN:    { region: 'Frontoparietal Network (=FPCN)', network: 'Executive', phase: 'P6/P5',
    function: 'Cognitive control, flexible task-switching, goal maintenance, working-memory updates. Distinct from DMN (mind-wandering) and DAN (top-down attention).',
    dysregulation: 'Hypoactive → executive dysfunction, ADHD. Hyperactive → cognitive rigidity.',
    business: 'Management consulting, strategic planning firms, executive search, ERP/PPM software, agile-transformation services, fractional COO firms' },
  BROCA:  { region: "Broca's Area (IFG)", network: 'Executive/Language', phase: 'P6/P2',
    function: 'Language production, syntactic processing, action observation (mirror neuron region), semantic control.',
    dysregulation: 'Lesion → Broca\'s aphasia (non-fluent). Hyperactive → palilalia.',
    business: 'Speech therapy practices, language learning, public-speaking coaching, legal advocacy, PR agencies, content marketing' },
  SMN:    { region: 'Sensorimotor Network', network: 'Motor/Sensory', phase: 'P5/P6',
    function: 'Sensorimotor integration — M1+S1+SMA+premotor coordination. Closed-loop sensing + acting.',
    dysregulation: 'Stroke → hemiplegia/hemisensory loss. Plasticity gain → motor learning.',
    business: 'Industrial automation, robotics, prosthetics, AR/VR haptics, physical therapy, athletic coaching, surgical training' },
  OSC:    { region: 'Oscillatory dynamics (theta/alpha/beta/gamma)', network: 'Oscillatory', phase: 'P5/P6',
    function: 'Neural rhythms enabling coordination across distant brain regions. Theta (memory), alpha (cortical inhibition), beta (motor + maintenance), gamma (binding).',
    dysregulation: 'Theta dysregulation → memory loss. Gamma decoherence → schizophrenia. Beta excess → motor freezing.',
    business: 'EEG companies, neurofeedback, meditation tech, sleep-stage research, brain-computer interfaces' },
  VV:     { region: 'Ventral Vagal complex', network: 'Autonomic/Arousal', phase: 'P2/P4',
    function: 'Ventral vagal branch (parasympathetic, social engagement system per Polyvagal Theory). Heart-rate variability, facial expression, prosody, breathing.',
    dysregulation: 'Low tone → social withdrawal, depression. Hyperactive → fainting (vasovagal).',
    business: 'HRV-monitoring wearables, polyvagal-informed therapy practices, voice-tech, breathing-app companies, customer-engagement platforms' },
  PRECUNEUS: { region: 'Precuneus', network: 'DMN', phase: 'P9/P10',
    function: 'Visuospatial mental imagery, episodic memory, consciousness integration. Convergence zone for self-awareness across modalities.',
    dysregulation: 'Hyperactive → rumination, depression. Hypoactive → psychedelic ego dissolution, anesthesia.',
    business: 'Creative agencies, VR/AR companies, architectural visualization, scenario planning, futures consultancies' },
  ECN:    { region: 'Executive Control Network (=FPCN)', network: 'Executive', phase: 'P6',
    function: 'Cognitive flexibility, top-down attention, goal maintenance — overlapping but not identical to FPN. Some authors treat FPN/ECN as synonyms.',
    dysregulation: 'Same as FPN.',
    business: 'Same business set as FPN — management consulting, strategic planning, executive-control software' },
  SNS:    { region: 'Sympathetic Nervous System', network: 'Autonomic', phase: 'P1/P3',
    function: 'Fight-flight activation — distributed sympathetic chain ganglia, locus coeruleus norepinephrine, adrenal medulla epinephrine.',
    dysregulation: 'Chronic activation → hypertension, anxiety, immunosuppression. Underactive → orthostatic intolerance.',
    business: 'Stress physiology research, cardiovascular medicine, hypertension treatment, occupational health, military physiology' },
  WERN:   { region: "Wernicke's Area (posterior STG)", network: 'Language', phase: 'P6/P2',
    function: 'Language comprehension, semantic processing of heard speech. Connects phonological signal to meaning.',
    dysregulation: 'Lesion → Wernicke\'s aphasia (fluent but meaningless). Disconnection → conduction aphasia.',
    business: 'Speech-language pathology, language learning, translation services, legal transcription, voice-content production' },
  FG:     { region: 'Fusiform Gyrus (FFA/VWFA)', network: 'Sensory/Memory', phase: 'P2/P0',
    function: 'Face recognition (Fusiform Face Area), word recognition (Visual Word Form Area), category-specific visual representation.',
    dysregulation: 'Lesion → prosopagnosia (face blindness), alexia. Hyperactive → face pareidolia.',
    business: 'Facial recognition companies, visual search tech, OCR/document recognition, brand logo design, retail surveillance' },
  CC:     { region: 'Cingulate Cortex (anterior + mid + posterior aggregate)', network: 'Salience', phase: 'P1/P6',
    function: 'Aggregate cingulate — error monitoring (dACC), emotional regulation (rACC), autobiographical memory (PCC). The brain\'s referee.',
    dysregulation: 'Hyperactive → OCD checking, depression rumination. Hypoactive → apathy, anosognosia.',
    business: 'Compliance / audit firms, conflict resolution, quality assurance, regulatory consulting' },
  FORN:   { region: 'Fornix', network: 'Limbic/Memory', phase: 'P0/P2',
    function: 'Major output tract of hippocampus to mammillary bodies, septum, anterior thalamus. Memory consolidation and retrieval pathway.',
    dysregulation: 'Lesion → anterograde amnesia, confabulation.',
    business: 'Memory-care facilities, neurosurgical device companies, white-matter imaging firms' },
  CAUD:   { region: 'Caudate Nucleus', network: 'Basal Ganglia', phase: 'P6/P0',
    function: 'Goal-directed behavior, cognitive flexibility, spatial learning, reward-based decision-making. Head of basal ganglia.',
    dysregulation: 'Hyperactive → OCD compulsions. Hypoactive → Huntington\'s, executive dysfunction.',
    business: 'Process automation, workflow optimization, OCD treatment, behavioral health tech, goal-setting platforms' },
  FEF:    { region: 'Frontal Eye Field', network: 'Attention/Motor', phase: 'P1/P5',
    function: 'Voluntary saccade control, top-down attentional priority maps, working memory for spatial locations.',
    dysregulation: 'Lesion → eye-movement deficit, attention bias.',
    business: 'Eye-tracking companies, gaze-based UX research, attention analytics, autonomous-vehicle perception' },
  MICRO:  { region: 'Microglia (neuroimmune cells)', network: 'Neuroimmune', phase: 'P3/P10',
    function: 'Brain\'s resident immune cells — synaptic pruning, neuroinflammation, debris clearance, neuroprotection. Activated by stress, infection, injury.',
    dysregulation: 'Chronic activation → neuroinflammation, depression, Alzheimer\'s. Suppressed → poor injury recovery.',
    business: 'Neuroinflammation pharma, post-COVID clinics, Alzheimer\'s therapeutics, psychedelic therapy, neuroimmunology labs' },
  DV:     { region: 'Dorsal Vagal complex', network: 'Autonomic', phase: 'P3/P7',
    function: 'Dorsal vagal branch — freeze/shutdown response, subdiaphragmatic visceral control (gut, liver, pancreas). Polyvagal Theory: the immobilization branch.',
    dysregulation: 'Excess activation → dissociation, depression, GI shutdown. Underactive → metabolic dysregulation.',
    business: 'Gastroenterology, hepatology, metabolic-health companies, trauma-informed therapy, freeze-response training' },
  PIN:    { region: 'Pineal Gland', network: 'Circadian', phase: 'P0/P7',
    function: 'Melatonin production — circadian rhythm entrainment, sleep onset, seasonal physiology. Light-suppressed.',
    dysregulation: 'Calcification → poor sleep. Excess melatonin → seasonal-affective patterns.',
    business: 'Sleep medicine, melatonin/sleep-aid pharma, light therapy, jet-lag remedies, shift-work health programs' },
  SEPT:   { region: 'Septal Nuclei', network: 'Limbic', phase: 'P4/P2',
    function: 'Reward, pleasure, social bonding, hippocampal theta-rhythm generation, anxiety modulation.',
    dysregulation: 'Lesion → septal rage. Hyperactive → euphoria, hypersexuality.',
    business: 'Social bonding platforms, relationship counseling, oxytocin therapeutics, community building, dating services' },
  LANG:   { region: 'Language Network (Broca + Wernicke + AG aggregate)', network: 'Language', phase: 'P6/P2',
    function: 'Distributed language network — production, comprehension, semantics, syntax. Lateralized (typically left hemisphere).',
    dysregulation: 'Stroke → aphasias of varying type. Neurodegeneration → primary progressive aphasia.',
    business: 'Speech-language pathology, language learning, translation, LLM/NLP companies, accessibility (subtitling/captioning), legal advocacy' },
  UNC:    { region: 'Uncinate Fasciculus', network: 'Connectivity', phase: 'P2/P3',
    function: 'White-matter tract connecting orbitofrontal cortex to anterior temporal lobe. Carries emotional-mnemonic associations.',
    dysregulation: 'Disrupted → emotional-memory disconnect, PTSD, frontotemporal dementia.',
    business: 'Diffusion-MRI imaging, white-matter therapeutics, dementia research' },
  CING:   { region: 'Cingulum Bundle', network: 'Connectivity', phase: 'P6/P1',
    function: 'White-matter tract along the cingulate, connecting frontal-limbic-temporal regions. Carries attention + emotion regulation signals.',
    dysregulation: 'Disrupted → attention deficit, emotion dysregulation, depression.',
    business: 'Diffusion-MRI imaging, depression DBS targets, connectivity-based diagnostics' },
  CON:    { region: 'Cingulo-Opercular Network', network: 'Attention', phase: 'P5/P6',
    function: 'Tonic alertness, task-set maintenance, sustained attention — distinct from phasic FPN switching.',
    dysregulation: 'Hypoactive → attention lapses, ADHD-inattentive type. Hyperactive → hypervigilance.',
    business: 'Attention-training platforms, ADHD therapeutics, vigilance-monitoring tech, surveillance-operations design' },
  CARD:   { region: 'Cardiac Autonomic Control (NTS + NA + DMV)', network: 'Autonomic', phase: 'P2/P4',
    function: 'Heart-rate variability, baroreceptor reflex, cardiac autonomic balance. Integrated brainstem control.',
    dysregulation: 'Low HRV → cardiovascular risk, poor stress resilience. Imbalance → arrhythmia.',
    business: 'Cardiac monitoring, HRV wearables, telecardiology, autonomic-balance therapies' },
  LGN:    { region: 'Lateral Geniculate Nucleus', network: 'Thalamus/Sensory', phase: 'P0',
    function: 'Thalamic relay for vision — magnocellular (motion) + parvocellular (form/color) + koniocellular (S-cone) pathways to V1.',
    dysregulation: 'Lesion → visual field defects, color vision deficits.',
    business: 'Ophthalmology, vision correction, retinal imaging, vision-restoration prosthetics' },
  rACC:   { region: 'Rostral ACC', network: 'Salience/Limbic', phase: 'P3/P4',
    function: 'Emotional regulation, autonomic tone, reward valuation, conflict between emotion and cognition. Same family as sgACC but more rostral.',
    dysregulation: 'Hyperactive → depression. Hypoactive → emotional blunting.',
    business: 'Mental-health clinics, mood-disorder pharma, emotional-regulation apps' },
  MI:     { region: 'Mid Insula', network: 'Interoception', phase: 'P4/P5',
    function: 'Integration of body-state with behavioral context — bridge between raw interoceptive signal (PI) and emotional-cognitive meaning (AI).',
    dysregulation: 'Dysregulated → eating disorders, addiction, somatic-symptom disorders.',
    business: 'Eating-disorder treatment, addiction recovery, integrative medicine, occupational therapy, performance coaching' },
  PIT:    { region: 'Pituitary Gland (anterior + posterior)', network: 'HPA Axis / Endocrine', phase: 'P3',
    function: 'Bridge between neural stress signal and systemic hormones — ACTH, TSH, LH/FSH, GH, prolactin, oxytocin, vasopressin.',
    dysregulation: 'Adenoma → hormonal excess. Apoplexy → panhypopituitarism.',
    business: 'Endocrinology, hormone replacement, fertility clinics, sports-performance medicine, biohacking' },
  ADR:    { region: 'Adrenal Glands (cortex + medulla aggregate)', network: 'HPA Axis/Autonomic', phase: 'P1/P3',
    function: 'Cortex: cortisol + aldosterone (sustained stress, metabolism). Medulla: epinephrine + norepinephrine (acute stress).',
    dysregulation: 'Adrenal insufficiency → Addison\'s. Excess → Cushing\'s.',
    business: 'Functional medicine, longevity clinics, adrenal-fatigue programs, emergency medicine, tactical training' },
  SNIG:   { region: 'Substantia Nigra (SN)', network: 'Motor/Reward', phase: 'P6/P5',
    function: 'Dopamine for motor control + habit formation. Basal ganglia input via nigrostriatal pathway. Procedural learning.',
    dysregulation: 'Degeneration → Parkinson\'s. Hyperdopaminergia → psychosis.',
    business: 'Parkinson\'s therapeutics, motor rehabilitation, habit-design products, sports training' },
  RF:     { region: 'Reticular Formation', network: 'Brainstem/Arousal', phase: 'P0/P1',
    function: 'Brainstem core controlling arousal, sleep-wake cycle, gross motor tone, vital-sign regulation.',
    dysregulation: 'Lesion → coma. Disruption → sleep disorders.',
    business: 'Anesthesiology, sleep medicine, ICU monitoring, consciousness research' },
  LAR:    { region: 'Larynx motor + sensory control', network: 'Brainstem/Motor', phase: 'P2',
    function: 'Laryngeal motor (recurrent laryngeal nerve), voice production, swallow protection.',
    dysregulation: 'Paralysis → voice loss, aspiration risk.',
    business: 'ENT/laryngology, voice therapy, speech pathology, professional voice coaching' },
  VEST:   { region: 'Vestibular System', network: 'Sensory/Balance', phase: 'P2/P4',
    function: 'Balance, head position, vestibulo-ocular reflex, gravity sensing.',
    dysregulation: 'Lesion → vertigo, balance failure, motion sickness.',
    business: 'Vestibular rehab, fall prevention, balance therapy, VR motion-sickness mitigation' },
  EI:     { region: 'Excitation-Inhibition balance (network-level)', network: 'Oscillatory', phase: 'P5/P3',
    function: 'Network-wide ratio of glutamate to GABA. Sets cortical gain and signal-to-noise. Critical for sensory accuracy, sleep, plasticity.',
    dysregulation: 'Imbalance → autism (E>I), schizophrenia (variable), epilepsy (E>>I).',
    business: 'Autism therapeutics, antiepileptic pharma, sleep medicine, sensory-processing therapy' },
  PULV:   { region: 'Pulvinar Thalamus', network: 'Thalamus', phase: 'P1/P5',
    function: 'Attentional filtering — routes salient visual/multisensory information. Suppresses irrelevant signals. High-level attention switchboard.',
    dysregulation: 'Lesion → spatial attention deficit.',
    business: 'Information filtering tech, cybersecurity (threat-signal filtering), media monitoring, sensory design, UX research' },
  CLAUST: { region: 'Claustrum', network: 'Consciousness', phase: 'P9/P7',
    function: 'Global consciousness coordinator — integrates information across all cortical areas simultaneously. Crick & Koch\'s consciousness candidate.',
    dysregulation: 'Stimulation → loss of consciousness (Koubeissi 2014). Lesion → variable awareness deficit.',
    business: 'Consciousness research labs, anesthesiology, meditation tech, psychedelic therapy, general-AI research' },
  DISS:   { region: 'Dissociation Circuit (DMN+claustrum+vagal aggregate)', network: 'Consciousness/Defense', phase: 'P9/P3',
    function: 'Detachment from self / surroundings under overwhelming threat. Combines DMN suppression + claustrum decoupling + dorsal vagal shutdown.',
    dysregulation: 'Chronic → DID, derealization. Acute → trauma response.',
    business: 'Trauma-informed therapy, DID/dissociation clinics, ketamine-assisted psychotherapy, mindfulness programs' },
  ENDO:   { region: 'Endogenous Cannabinoid System', network: 'Neuromodulatory', phase: 'P4/P5',
    function: 'Retrograde modulation of synaptic strength. Anxiety, appetite, pain, memory, neuroprotection.',
    dysregulation: 'Low tone → anxiety, PTSD. Excess → motivation deficit.',
    business: 'Cannabis pharma, CBD wellness brands, PTSD treatment, appetite-regulation products' },
  IC:     { region: 'Inferior Colliculus', network: 'Brainstem/Auditory', phase: 'P0',
    function: 'Midbrain auditory relay — integrates ascending auditory information, sound localization.',
    dysregulation: 'Lesion → auditory processing deficits, sound localization failure.',
    business: 'Hearing aids, audiology, acoustic engineering, cochlear implants' },
  MGN:    { region: 'Medial Geniculate Nucleus', network: 'Thalamus/Auditory', phase: 'P0',
    function: 'Thalamic relay for hearing — gates auditory information to A1.',
    dysregulation: 'Lesion → cortical deafness.',
    business: 'Hearing diagnostics, auditory implant tech' },
  PRC:    { region: 'Perirhinal Cortex', network: 'Limbic/Memory', phase: 'P0',
    function: 'Object recognition memory, familiarity-based recognition, semantic memory interface with episodic memory.',
    dysregulation: 'Lesion → object recognition deficit, semantic dementia.',
    business: 'Brand recognition research, product design, consumer research, trademark law, retail merchandising' },
  NEOCER: { region: 'Neocerebellum (lateral cerebellar hemispheres)', network: 'Cerebellum/Cognition', phase: 'P6/P5',
    function: 'Cognitive timing, language, predictive coding, working-memory support. The "cognitive" cerebellum.',
    dysregulation: 'Lesion → cerebellar cognitive affective syndrome.',
    business: 'Speech therapy, financial-algo timing, surgical robotics, predictive analytics' },
  MAMM:   { region: 'Mammillary Bodies', network: 'Limbic/Memory', phase: 'P0/P2',
    function: 'Part of Papez circuit — receives hippocampal input via fornix, projects to anterior thalamus. Memory consolidation.',
    dysregulation: 'Atrophy → Korsakoff\'s syndrome, confabulation (thiamine deficiency).',
    business: 'Korsakoff/Wernicke clinics, alcohol-recovery programs, B-vitamin nutrition' },
  NBM:    { region: 'Nucleus Basalis of Meynert', network: 'Neuromodulatory', phase: 'P0/P6',
    function: 'Cholinergic broadcast to entire cortex — attention, memory encoding, neuroplasticity gating.',
    dysregulation: 'Atrophy → Alzheimer\'s cognitive decline.',
    business: 'Alzheimer\'s therapeutics, cognitive enhancement, AChE-inhibitor pharma, nootropics' },
  CMZ:    { region: 'Central Migratory Zone (subventricular zone)', network: 'Plasticity', phase: 'P10/P8',
    function: 'Adult neurogenesis source — neural stem cells migrate from SVZ to olfactory bulb, hippocampus, lesion sites.',
    dysregulation: 'Suppressed → impaired recovery, depression. Excess → glioma origin.',
    business: 'Regenerative medicine, neural stem-cell therapeutics, post-stroke recovery, neurogenesis research' },
  ARC:    { region: 'Arcuate Nucleus (hypothalamus)', network: 'HPA/Endocrine', phase: 'P3/P0',
    function: 'Hypothalamic feeding circuit — AgRP (hunger) and POMC (satiety) neurons. Master appetite regulator.',
    dysregulation: 'Hyperphagia (AgRP hyperactive) → obesity. Anorexia (POMC hyperactive).',
    business: 'Obesity pharma (GLP-1), eating-disorder clinics, weight-management programs, appetite research' },
  PUT:    { region: 'Putamen', network: 'Basal Ganglia', phase: 'P6/P5',
    function: 'Motor learning, procedural skill acquisition, habit formation, reinforcement learning for motor sequences.',
    dysregulation: 'Degeneration → Parkinson\'s motor symptoms. Hyperactive → tics.',
    business: 'Skill training platforms, sports coaching tech, physical therapy, industrial skills certification' },
  TPOLE:  { region: 'Temporal Pole', network: 'Limbic/Semantic', phase: 'P2/P0',
    function: 'Semantic hub — concept knowledge, social-emotional processing, person identification.',
    dysregulation: 'Atrophy → semantic dementia. Lesion → person/place name retrieval failure.',
    business: 'Semantic-knowledge graphs, frontotemporal dementia clinics, concept-based search' },
  MDT:    { region: 'Mediodorsal Thalamus', network: 'Thalamus', phase: 'P6/P1',
    function: 'Relay between limbic system and PFC — emotional-cognitive integration, working memory support, consciousness gating.',
    dysregulation: 'Lesion → executive function + memory deficits. Schizophrenia involvement.',
    business: 'Decision-support systems, cognitive enhancement, schizophrenia pharma' },
  ANT:    { region: 'Anterior Thalamus', network: 'Thalamus/Memory', phase: 'P0/P2',
    function: 'Part of Papez circuit — spatial memory, head direction cells, context encoding. Critical for episodic memory formation.',
    dysregulation: 'Lesion → episodic-memory failure.',
    business: 'Navigation tech, spatial-data firms, location-based services, autonomous-vehicle mapping' },
  VERM:   { region: 'Cerebellar Vermis', network: 'Cerebellum', phase: 'P4/P2',
    function: 'Midline cerebellum — balance, posture, gait, emotional regulation (vermal projections to limbic).',
    dysregulation: 'Lesion → truncal ataxia, gait disturbance. Atrophy in autism, depression.',
    business: 'Balance rehabilitation, vestibular therapy, yoga/movement instruction, fall prevention' },
  TrkB:   { region: 'TrkB Receptor (BDNF receptor)', network: 'Plasticity', phase: 'P10/P8',
    function: 'BDNF signaling receptor — gates neuroplasticity, synaptic strengthening, antidepressant response.',
    dysregulation: 'Low signaling → depression. Loss-of-function variants → cognitive deficits.',
    business: 'Antidepressant pharma (TrkB agonists / BDNF-mimetics), psychedelic therapeutics, neuroplasticity research' },
  VIA:    { region: 'Visual Awareness (V1+higher visual cortex aggregate)', network: 'Sensory/Consciousness', phase: 'P0/P2',
    function: 'Network-level conscious visual awareness — V1 + V2/V4/IT + parietal attentional networks.',
    dysregulation: 'Lesion → blindsight (unconscious vision), neglect.',
    business: 'Ophthalmology, neuro-ophthalmology, visual-prosthesis companies, autonomous-vehicle perception' },
  V4V5:   { region: 'Visual Association Cortex (V4 color + V5/MT motion)', network: 'Sensory', phase: 'P2/P7',
    function: 'Color perception (V4), motion processing (V5/MT), object recognition pathway.',
    dysregulation: 'Lesion → achromatopsia (V4), akinetopsia (V5).',
    business: 'Video technology, motion capture, color science, automotive motion-safety, sports analytics' },
  SDH:    { region: 'Spinal Dorsal Horn', network: 'Pain/Autonomic', phase: 'P3/P5',
    function: 'Pain signal gating (Gate Control Theory), proprioceptive relay, spinal reflexes, descending modulation from brain.',
    dysregulation: 'Sensitization → chronic pain. Loss → analgesia.',
    business: 'Pain management, spinal-cord stimulation, physical therapy, chronic-pain pharma' },
  FPC:    { region: 'Frontopolar Cortex (rPFC = BA10)', network: 'Executive/Metacognition', phase: 'P8/P6',
    function: 'Counterfactual reasoning, exploration vs. exploitation tradeoffs, metacognition, multi-tasking, prospective memory.',
    dysregulation: 'Hypoactive → impulsivity, lack of long-term planning.',
    business: 'Strategic-foresight consulting, scenario-planning firms, futurology, exploration-stage VC' },
  PI:     { region: 'Posterior Insula', network: 'Sensory/Interoception', phase: 'P4/P2',
    function: 'Primary interoceptive cortex — maps body\'s current physiological state (temperature, pain, cardiac, visceral).',
    dysregulation: 'Dysregulation → eating disorders, somatic-symptom disorders, alexithymia.',
    business: 'Biofeedback companies, health-monitoring wearables, somatic therapy, pain-assessment tools' },
  ACC:    { region: 'Anterior Cingulate Cortex (general)', network: 'Salience', phase: 'P1/P6',
    function: 'Conflict monitoring, error detection, effort allocation, emotional pain processing, decision-making under uncertainty.',
    dysregulation: 'Hyperactive → OCD, depression rumination. Hypoactive → apathy.',
    business: 'Quality assurance, compliance auditing, conflict resolution, performance management' },
  OLF:    { region: 'Olfactory System (bulb + piriform)', network: 'Limbic', phase: 'P0/P3',
    function: 'Olfactory processing, scent-memory association (most direct sensory route to hippocampus), threat/food detection via smell.',
    dysregulation: 'Anosmia → early Alzheimer\'s, Parkinson\'s marker. Hyperosmia → migraine.',
    business: 'Fragrance industry, food science, flavor companies, Alzheimer\'s early diagnostics, scent marketing' },
  ASTRO:  { region: 'Astrocytes', network: 'Neuroimmune', phase: 'P4/P10',
    function: 'Synaptic support, neurotransmitter recycling (glutamate/GABA), blood-brain barrier maintenance, metabolic support.',
    dysregulation: 'Reactive astrocytosis → scar tissue, inflammation. Loss → metabolic collapse of neurons.',
    business: 'Neuroregeneration, BBB drug-delivery tech, glutamate-targeting pharma, glia-focused biotech' },
  DMNMTL: { region: 'DMN Medial Temporal Lobe Subsystem', network: 'DMN/Memory', phase: 'P0/P2',
    function: 'DMN subsystem coupling hippocampus + parahippocampal + retrosplenial + posterior IPL — episodic / autobiographical memory retrieval mode.',
    dysregulation: 'Atrophy → Alzheimer\'s. Hyperactive → rumination, intrusive autobiographical recall.',
    business: 'Alzheimer\'s diagnostics, autobiographical-memory research, narrative therapy, legacy-planning' },
  NAc:    { region: 'Nucleus Accumbens (stub alias of NAcc — should be deduplicated)', network: 'Reward', phase: 'P5/P0',
    function: 'Identical to NAcc — both abbreviations exist as separate taxonomy keys; NAcc has 29 bindings, NAc has 1. Future cleanup: merge into NAcc.',
    dysregulation: 'See NAcc.',
    business: 'See NAcc.' },
};

// Manual normalization for keys that exist in 124-taxonomy but differ only in
// case from the 111-directory. Maps taxonomyId -> directoryId.
const CASE_NORMALIZE = {
  dlPFC: 'DLPFC',
};

const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY, 'utf8'));
const directory = JSON.parse(fs.readFileSync(DIRECTORY, 'utf8'));

// Build abbrev→directory-entry lookup
const dirByAbbrev = {};
for (const entry of directory) {
  const m = (entry.region || '').match(/\(([^)]+)\)\s*$/);
  if (m) dirByAbbrev[m[1]] = entry;
}

const out = {};
let stats = { fromDirectory: 0, fromDraft: 0, missingBoth: 0 };

for (const id of Object.keys(taxonomy)) {
  let entry, source;
  // 1. Direct match
  if (dirByAbbrev[id]) {
    entry = dirByAbbrev[id];
    source = '111-directory';
    stats.fromDirectory++;
  }
  // 2. Case-normalized match
  else if (CASE_NORMALIZE[id] && dirByAbbrev[CASE_NORMALIZE[id]]) {
    entry = dirByAbbrev[CASE_NORMALIZE[id]];
    source = '111-directory (case-normalized)';
    stats.fromDirectory++;
  }
  // 3. Hand-authored draft
  else if (DRAFTS[id]) {
    entry = DRAFTS[id];
    source = 'draft';
    stats.fromDraft++;
  }
  else {
    entry = {
      region: id,
      network: null,
      phase: null,
      function: 'TODO — author description',
      dysregulation: null,
      business: 'TODO — author business mapping',
    };
    source = 'stub';
    stats.missingBoth++;
  }

  out[id] = {
    region: entry.region,
    network: entry.network || null,
    phase: entry.phase || null,
    function: entry.function || null,
    dysregulation: entry.dysregulation || null,
    business: entry.business || null,
    source,
    domainBindings: taxonomy[id] || [],
  };
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Wrote ${path.relative(process.cwd(), OUT)} with ${Object.keys(out).length} entries`);
console.log(`  from directory:   ${stats.fromDirectory}`);
console.log(`  from draft:       ${stats.fromDraft}`);
console.log(`  missing (stubbed):${stats.missingBoth}`);
if (stats.missingBoth > 0) {
  console.log('\n  stubbed node IDs (need authoring):');
  for (const id of Object.keys(out)) {
    if (out[id].source === 'stub') console.log('   -', id);
  }
}
