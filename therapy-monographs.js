// ═══════════════════════════════════════════════════════════════
// LIMEN HELIX — THERAPY MONOGRAPH DATABASE
// Clinical reference for psychotherapy modalities.
// Not a substitute for clinical training or supervision.
// ═══════════════════════════════════════════════════════════════

var THERAPY_MONOGRAPHS = {

// ─── CBT FAMILY ────────────────────────────────────────────

'CBT': {
  fullName:'Cognitive Behavioral Therapy',
  family:'CBT',
  developer:'Aaron T. Beck (1960s)',
  overview:'Structured, time-limited psychotherapy targeting the interaction between thoughts, emotions, and behaviors. Core premise: distorted cognitions maintain psychopathology; restructuring cognitions changes emotional and behavioral responses. Most extensively researched psychotherapy modality.',
  coreComponents:['Cognitive restructuring (identifying/challenging automatic thoughts, intermediate beliefs, core beliefs)','Behavioral experiments (testing predictions)','Activity scheduling / behavioral activation','Psychoeducation (cognitive model)','Homework assignments between sessions','Socratic questioning','Thought records / cognitive logs'],
  indications:[
    {dx:'MDD',evidence:'A',effectSize:'d=0.71 vs waitlist; d=0.38 vs pill placebo',nnt:'NNT ~4 vs waitlist',notes:'Comparable to antidepressants for mild-moderate. Combined CBT+meds superior for severe.'},
    {dx:'GAD',evidence:'A',effectSize:'d=0.82 vs waitlist',nnt:'NNT ~3',notes:'First-line. Intolerance of uncertainty model (Dugas) or metacognitive model (Wells).'},
    {dx:'Panic Disorder',evidence:'A',effectSize:'d=0.87 vs waitlist',nnt:'NNT ~3',notes:'Includes interoceptive exposure. 80-90% panic-free at end of treatment.'},
    {dx:'Social Anxiety',evidence:'A',effectSize:'d=0.86 vs waitlist',nnt:'NNT ~3',notes:'Clark & Wells model. Includes behavioral experiments + video feedback.'},
    {dx:'OCD',evidence:'A',effectSize:'d=1.31 (with ERP)',nnt:'NNT ~2-3',notes:'ERP is the active ingredient. CBT without ERP is insufficient.'},
    {dx:'PTSD',evidence:'A',effectSize:'d=0.62-1.26',nnt:'NNT ~3',notes:'Trauma-focused CBT. See also CPT and PE as specific protocols.'},
    {dx:'Insomnia',evidence:'A',effectSize:'d=0.98 for sleep onset latency',nnt:'NNT ~3',notes:'CBT-I is first-line over medications per AASM guidelines.'},
    {dx:'Bulimia Nervosa',evidence:'A',effectSize:'d=0.78',nnt:'NNT ~3',notes:'CBT-E (enhanced) is gold standard.'},
    {dx:'ADHD (adult)',evidence:'B',effectSize:'d=0.37-0.51',nnt:'NNT ~5-7',notes:'Adjunct to medication. Focus on organization, planning, emotional regulation.'}
  ],
  protocol:{
    format:'Individual (primary). Group available for some indications.',
    sessionLength:'50-60 minutes',
    frequency:'Weekly (standard). Twice weekly for severe/acute.',
    totalSessions:'12-20 sessions (typical). 6-8 for focused protocols (panic, phobia). Up to 30 for complex presentations.',
    phases:[
      {name:'Assessment & Formulation',sessions:'1-3',content:'Presenting problems, cognitive-behavioral formulation, goal setting, psychoeducation on cognitive model, introduce thought monitoring.'},
      {name:'Core Intervention',sessions:'4-14',content:'Cognitive restructuring, behavioral experiments, exposure (if applicable), activity scheduling. Weekly homework review.'},
      {name:'Consolidation & Relapse Prevention',sessions:'15-20',content:'Review gains, anticipate setbacks, develop relapse prevention plan, blueprint letter, spacing of sessions.'}
    ],
    homeworkExamples:['Daily thought records','Behavioral experiments (between sessions)','Activity scheduling logs','Exposure hierarchies (graded practice)','Reading assignments (bibliotherapy)']
  },
  headToHead:[
    {vs:'Medication (SSRI)',finding:'Equivalent for mild-moderate depression. Combined superior for severe depression and chronic conditions. CBT has lower relapse rate post-discontinuation.',cite:'Cuijpers et al., 2013, World Psychiatry'},
    {vs:'Psychodynamic therapy',finding:'CBT has larger short-term effects; differences diminish at long-term follow-up.',cite:'Driessen et al., 2015, Am J Psychiatry'},
    {vs:'ACT',finding:'Roughly equivalent outcomes. ACT may have advantages in treatment-resistant cases and comorbid conditions.',cite:'A-Tjak et al., 2015, Psychother Psychosom'}
  ],
  contraindications:['Active psychosis (modify approach significantly)','Severe intellectual disability (adapt materials)','Active substance intoxication during sessions','Patient unwilling to engage in homework/between-session work'],
  limitations:['Requires motivated, cognitively engaged patient','High dropout rates (15-25%) in some populations','Less effective without exposure component for anxiety disorders','Therapist competence varies significantly','May not address deep relational patterns'],
  trainingRequired:'Postgraduate mental health degree + specific CBT training (e.g., Beck Institute, BABCP accreditation). Minimum 1 year supervised practice. Ongoing supervision recommended.',
  certifications:['Academy of Cognitive Therapy (ACT) certification','BABCP accreditation (UK)','Beck Institute certification','State licensure as prerequisite'],
  dropoutRate:'15-25% across diagnoses. Higher in depression (up to 30%). Lower in structured phobia protocols.',
  relapsePrevention:'Booster sessions at 1, 3, 6 months post-treatment. Mindfulness-based cognitive therapy (MBCT) reduces relapse in recurrent depression.',
  modifications:{
    pediatric:'Use play, drawing, and age-appropriate metaphors. Involve parents. Shorter sessions (30-45 min).',
    elderly:'Slower pace, repetition, written summaries, accommodate sensory/cognitive changes. Address medical comorbidity.',
    cultural:'Adapt examples and metaphors. Address cultural factors in cognitive restructuring. Consider collectivist vs individualist values.',
    digital:'Computerized CBT (cCBT) programs: Beating the Blues, MoodGYM, Woebot. Evidence level B. Therapist-guided > pure self-help.'
  },
  costPerSession:'$150-300/session (US). Some insurance covers 12-20 sessions. Group: $50-100/session.',
  keyCitations:[
    'Beck, J.S. (2020). Cognitive Behavior Therapy: Basics and Beyond, 3rd ed. Guilford Press.',
    'Hofmann, S.G. et al. (2012). The efficacy of CBT: A review of meta-analyses. Cognitive Therapy and Research, 36(5), 427-440.',
    'Cuijpers, P. et al. (2019). A meta-analysis of cognitive-behavioural therapy for adult depression. Psychological Medicine, 49(16), 2664-2680.'
  ]
},

'ERP': {
  fullName:'Exposure and Response Prevention',
  family:'CBT',
  developer:'Victor Meyer (1966), refined by Edna Foa',
  overview:'Specialized CBT protocol for OCD. Systematic, prolonged exposure to obsessional triggers with prevention of compulsive rituals. The gold standard psychotherapy for OCD — more effective than any medication monotherapy. Works via inhibitory learning: new safety associations form that compete with threat associations.',
  coreComponents:['Psychoeducation on OCD cycle','SUDS hierarchy construction (0-100)','In vivo exposure (real-world triggers)','Imaginal exposure (feared consequences)','Response prevention (ritual blocking)','Habituation tracking','Therapist modeling','Between-session exposure homework'],
  indications:[
    {dx:'OCD',evidence:'A',effectSize:'d=1.31 vs control; 60-85% response rate',nnt:'NNT ~2',notes:'Gold standard. Superior to clomipramine and SSRIs as monotherapy. Combined ERP+SSRI may be optimal for severe OCD.'},
    {dx:'BDD',evidence:'B',effectSize:'d=0.87',nnt:'NNT ~3',notes:'Modified ERP with mirror exposure, perceptual retraining.'},
    {dx:'Hoarding Disorder',evidence:'B',effectSize:'d=0.59',nnt:'NNT ~4-5',notes:'Modified: includes sorting, discarding practice, cognitive restructuring re attachment to objects.'},
    {dx:'Tic Disorders',evidence:'B',effectSize:'d=0.57',nnt:'NNT ~4',notes:'ERP for tics: exposure to premonitory urge without ticcing. Alternative to CBIT.'}
  ],
  protocol:{
    format:'Individual (primary). Intensive outpatient available.',
    sessionLength:'60-90 minutes (longer for in-session exposure)',
    frequency:'Weekly (standard). Intensive: daily × 3 weeks.',
    totalSessions:'16-20 sessions (standard). Intensive: 15 sessions over 3 weeks. Up to 30 for complex/severe.',
    phases:[
      {name:'Assessment & Hierarchy',sessions:'1-3',content:'Y-BOCS administration, functional assessment of OCD cycle, build SUDS hierarchy (10+ items graded 20-100), psychoeducation.'},
      {name:'Exposure Phase',sessions:'4-16',content:'Systematic exposure starting mid-hierarchy (SUDS 40-50). In-session exposure 30-45 min minimum per item. Response prevention coached. Move up hierarchy as habituation occurs.'},
      {name:'Consolidation',sessions:'17-20',content:'Address remaining hierarchy items, generalize gains, relapse prevention, develop self-directed exposure plan.'}
    ],
    homeworkExamples:['Daily self-directed exposure (1-2 hours)','Ritual prevention logs','SUDS tracking','Imaginal exposure recordings','Situational exposure assignments']
  },
  headToHead:[
    {vs:'SSRIs',finding:'ERP superior to SSRIs alone (Y-BOCS reduction: 50-60% vs 20-40%). Combined ERP+SSRI may be optimal for severe OCD.',cite:'Foa et al., 2005, JAMA'},
    {vs:'Clomipramine',finding:'ERP equivalent or superior. ERP has better long-term maintenance.',cite:'Simpson et al., 2008'},
    {vs:'ACT for OCD',finding:'ACT shows promise but insufficient evidence to prefer over ERP. May help ERP-resistant cases.',cite:'Twohig et al., 2010'}
  ],
  contraindications:['Active suicidality (stabilize first)','Active substance abuse (compromises habituation)','Severe depression (may need treatment first — motivational impairment)','Hoarding with severe squalor/safety risk (address safety first)'],
  limitations:['High initial anxiety — patient must tolerate distress','25-30% non-response rate','Requires specialized training','Patient must commit to daily homework','Comorbid depression reduces response rates','Some patients refuse exposure'],
  trainingRequired:'Licensed mental health professional + specialized OCD/ERP training. IOCDF provides training directory. Minimum 10 supervised ERP cases recommended.',
  certifications:['IOCDF training programs','Beck Institute OCD specialty','BTTI intensive training'],
  dropoutRate:'20-30%. Higher when starting with high-SUDS items. Gradual approach reduces dropout.',
  relapsePrevention:'Monthly boosters × 6 months. Self-directed exposure continuation. Rapid re-engagement at first sign of relapse.',
  modifications:{
    pediatric:'Parent involvement essential. Play-based exposure for young children. Shorter exposure durations. Reward systems.',
    elderly:'Slower pace. Account for cognitive changes. May need longer treatment.',
    cultural:'Scrupulosity OCD requires cultural sensitivity. Religious consultation may help.',
    digital:'BT Steps, NOCD app, GG OCD. Therapist-guided digital ERP shows promise.'
  },
  costPerSession:'$175-350/session (specialist). Intensive programs: $5,000-15,000 for 3-week intensive.',
  keyCitations:[
    'Foa, E.B. et al. (2012). Exposure and Response (Ritual) Prevention for OCD: Therapist Guide, 2nd ed. Oxford.',
    'Foa, E.B. et al. (2005). Randomized, placebo-controlled trial of ERP, clomipramine, and their combination in OCD. Am J Psychiatry, 162(1), 151-161.',
    'Abramowitz, J.S. et al. (2019). Exposure therapy for OCD: Approach and treatment. Guilford Press.'
  ]
},

'DBT': {
  fullName:'Dialectical Behavior Therapy',
  family:'CBT (third wave)',
  developer:'Marsha M. Linehan (1987)',
  overview:'Comprehensive cognitive-behavioral treatment originally developed for chronically suicidal individuals with BPD. Synthesizes change strategies (CBT) with acceptance strategies (Zen mindfulness). Based on biosocial theory: emotional vulnerability + invalidating environment → emotion dysregulation. Only psychotherapy with RCT evidence for reducing suicidal behavior.',
  coreComponents:['Individual therapy (1x/week)','Skills group (2.5 hrs/week)','Phone coaching (between sessions, as needed)','Therapist consultation team (weekly)','Four skill modules: Mindfulness, Distress Tolerance, Emotion Regulation, Interpersonal Effectiveness','Diary cards (daily tracking)','Behavioral chain analysis','Dialectical strategies'],
  indications:[
    {dx:'BPD',evidence:'A',effectSize:'d=0.60 for suicidal behavior; d=0.46 for self-harm',nnt:'NNT ~4 for suicide attempts',notes:'Gold standard for BPD. Only therapy with Level A evidence for reducing suicidal behavior.'},
    {dx:'Chronic Suicidality',evidence:'A',effectSize:'50% reduction in suicide attempts vs TAU',nnt:'NNT ~4',notes:'Primary indication regardless of diagnosis.'},
    {dx:'Self-Harm',evidence:'A',effectSize:'d=0.54',nnt:'NNT ~4',notes:'Significant reduction in NSSI frequency and severity.'},
    {dx:'Bulimia/BED',evidence:'B',effectSize:'d=0.44',nnt:'NNT ~5',notes:'DBT adapted for eating disorders. Targets emotion-driven eating.'},
    {dx:'Substance Use (with BPD)',evidence:'B',effectSize:'d=0.39',nnt:'NNT ~6',notes:'DBT-SUD adaptation. Addresses substance use as emotion regulation strategy.'},
    {dx:'PTSD (with BPD)',evidence:'B',effectSize:'Emerging',nnt:'Emerging',notes:'DBT-PE (Prolonged Exposure) protocol for comorbid PTSD+BPD.'},
    {dx:'Treatment-Resistant Depression',evidence:'C',effectSize:'Preliminary',nnt:'Under investigation',notes:'DBT skills training as augmentation.'}
  ],
  protocol:{
    format:'Comprehensive (individual + group + phone + consult team). Skills-only groups also evidence-based for some populations.',
    sessionLength:'Individual: 50-60 min. Skills group: 2-2.5 hours.',
    frequency:'Individual: weekly. Skills group: weekly. Phone coaching: as-needed.',
    totalSessions:'Standard: 1 year (52 individual + 52 group). Some research protocols: 6 months. Skills-only: 24 sessions (6 months).',
    phases:[
      {name:'Pre-treatment',sessions:'1-4',content:'Orientation, commitment strategies, informed consent, assess treatment targets, establish diary card.'},
      {name:'Stage 1: Behavioral Stability',sessions:'Ongoing',content:'Target hierarchy: (1) life-threatening behaviors, (2) therapy-interfering behaviors, (3) quality of life behaviors, (4) skills acquisition. Chain analysis for each target behavior.'},
      {name:'Skills Modules (rotating)',sessions:'~6 weeks each, repeat 2x',content:'Mindfulness → Distress Tolerance → Emotion Regulation → Interpersonal Effectiveness. Homework practice between groups.'},
      {name:'Stage 2: Emotional Processing',sessions:'After Stage 1 stability',content:'Trauma processing (if indicated), reducing post-traumatic stress, addressing quiet desperation.'}
    ],
    homeworkExamples:['Daily diary cards (emotions, urges, skills used)','Mindfulness practice (daily)','Distress tolerance skill practice','Interpersonal effectiveness scripts','Emotion regulation worksheets']
  },
  headToHead:[
    {vs:'General psychiatric management',finding:'DBT superior for reducing suicidal behavior, self-harm, ED visits, and inpatient days. Similar for depression/anxiety symptoms.',cite:'McMain et al., 2009, Am J Psychiatry'},
    {vs:'Schema Therapy',finding:'Both effective for BPD. Schema therapy may have advantages at 3-year follow-up for full recovery rates.',cite:'Giesen-Bloo et al., 2006, Arch Gen Psychiatry'},
    {vs:'MBT',finding:'Both reduce BPD symptoms. DBT has more evidence for acute suicidality. MBT may better address mentalizing deficits.',cite:'Stoffers-Winterling et al., 2022, Cochrane'}
  ],
  contraindications:['Active psychosis (stabilize first)','Mandated treatment without any voluntary commitment','Patient requires primary substance detox first','Cannot attend both individual and group components (for comprehensive DBT)'],
  limitations:['Resource-intensive (requires trained team)','High commitment (1 year, multiple weekly contacts)','Limited availability in many areas','Expensive to implement','25-35% dropout rate','May not address deeper characterological issues'],
  trainingRequired:'Licensed clinician + Behavioral Tech/Linehan Board Intensive Training (10 days). Ongoing consultation team membership required. Team of minimum 3 trained therapists recommended.',
  certifications:['Behavioral Tech Intensive Training','DBT-Linehan Board Certification (gold standard)','Foundation-level or comprehensive designation'],
  dropoutRate:'25-35% in first 4 months. Commitment strategies reduce this. Completion rates improve with strong therapeutic alliance.',
  relapsePrevention:'Graduate group (monthly). Phone coaching availability gradually reduced. Skills practice continuation. Re-entry to group if needed.',
  modifications:{
    pediatric:'DBT-A (adolescent): shortened to 16-24 weeks, family skills training, walking the middle path module, multi-family groups.',
    elderly:'Slower pace, repetition, visual aids. Address grief, medical issues, social isolation.',
    cultural:'Validated across multiple cultures. Core dialectics resonate with Eastern philosophy. Adapt examples to cultural context.',
    digital:'DBT Coach app, online skills groups. Hybrid models showing promise post-COVID.'
  },
  costPerSession:'Individual: $150-300. Group: $50-125. Full program: $15,000-25,000/year. Many insurance plans cover.',
  keyCitations:[
    'Linehan, M.M. (2015). DBT Skills Training Manual, 2nd ed. Guilford Press.',
    'Linehan, M.M. et al. (2006). Two-year randomized controlled trial and follow-up of DBT vs therapy by experts for suicidal behaviors and BPD. Arch Gen Psychiatry, 63(7), 757-766.',
    'Chapman, A.L. (2006). Dialectical behavior therapy: Current indications and unique elements. Psychiatry, 3(9), 62-68.'
  ]
},

'EMDR': {
  fullName:'Eye Movement Desensitization and Reprocessing',
  family:'Trauma-focused',
  developer:'Francine Shapiro (1987)',
  overview:'8-phase, integrative psychotherapy model for trauma and adverse life experiences. Core mechanism (debated): bilateral stimulation (eye movements, tapping, or auditory) during traumatic memory recall facilitates adaptive information processing. Hypothesized to work via: (1) taxing working memory during recall (reducing vividness/emotionality), (2) mimicking REM sleep memory consolidation, (3) orienting response activation.',
  coreComponents:['8-phase protocol','Bilateral stimulation (eye movements primary)','Adaptive Information Processing (AIP) model','SUDS and VOC (Validity of Cognition) tracking','Target memory identification','Negative cognition → Positive cognition reprocessing','Body scan','Installation of positive cognition'],
  indications:[
    {dx:'PTSD',evidence:'A',effectSize:'d=0.66-1.01 vs waitlist; comparable to trauma-focused CBT',nnt:'NNT ~3',notes:'WHO, APA, VA/DoD, NICE all recommend as first-line for PTSD. 77-90% no longer meet criteria after 3-6 sessions for single-incident trauma.'},
    {dx:'Complex PTSD',evidence:'B',effectSize:'d=0.58',nnt:'NNT ~4-5',notes:'Requires longer treatment, more stabilization. Modified protocols available.'},
    {dx:'Phobias',evidence:'B',effectSize:'d=0.65',nnt:'NNT ~4',notes:'Single-session EMDR for specific phobias shows rapid results.'},
    {dx:'Panic Disorder',evidence:'B',effectSize:'Emerging',nnt:'Under study',notes:'Targeting panic-related memories and first panic attack.'},
    {dx:'Grief',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Targeting unresolved grief memories.'},
    {dx:'Performance Anxiety',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Recent-event protocols.'}
  ],
  protocol:{
    format:'Individual only.',
    sessionLength:'60-90 minutes (longer sessions common for reprocessing phases)',
    frequency:'Weekly or twice weekly.',
    totalSessions:'Single-incident PTSD: 3-6 sessions. Complex trauma: 12-24+ sessions. Phobias: 1-3 sessions.',
    phases:[
      {name:'Phase 1: History & Treatment Planning',sessions:'1-2',content:'Comprehensive history, identify target memories, assess readiness, develop treatment plan.'},
      {name:'Phase 2: Preparation',sessions:'1-2',content:'Explain EMDR model, establish safe place/container, teach self-regulation skills, build therapeutic alliance.'},
      {name:'Phase 3-6: Assessment, Desensitization, Installation, Body Scan',sessions:'Variable',content:'Target memory → image, negative cognition, positive cognition, emotions, SUDS, body sensations → bilateral stimulation sets → process until SUDS=0, install positive cognition (VOC=7), clear body scan.'},
      {name:'Phase 7: Closure',sessions:'End of each session',content:'Return to equilibrium, self-monitoring log, containment if incomplete processing.'},
      {name:'Phase 8: Re-evaluation',sessions:'Start of next session',content:'Check target memory, assess for new material, determine next target.'}
    ],
    homeworkExamples:['TICES log (Trigger, Image, Cognition, Emotion, Sensation)','Safe place practice','Self-regulation skills between sessions','Journal if new material emerges']
  },
  headToHead:[
    {vs:'Prolonged Exposure',finding:'Comparable efficacy for PTSD. EMDR may work faster (fewer sessions). PE has more homework burden. EMDR may be better tolerated.',cite:'Cusack et al., 2016, Psychol Med'},
    {vs:'CPT',finding:'Both first-line. CPT involves more cognitive work. EMDR less verbal processing of trauma.',cite:'Resick et al., 2017'},
    {vs:'Trauma-focused CBT',finding:'Equivalent outcomes. EMDR requires less homework. TF-CBT may be preferred for children.',cite:'Bisson et al., 2007, Br J Psychiatry'}
  ],
  contraindications:['Active psychosis','Dissociative disorders without stabilization first','Active suicidality (stabilize first)','Unstable medical conditions (seizure disorders — relative)','Insufficient emotional regulation skills','Secondary gain issues'],
  limitations:['Mechanism of action debated — some argue bilateral stimulation is inert','Requires stable patient who can tolerate distress','Not suitable for everyone — some patients abreact strongly','Limited evidence beyond PTSD','High variability in therapist skill','Cannot be done in group format'],
  trainingRequired:'Licensed mental health professional + EMDRIA-approved basic training (minimum 50 hours: 20hr didactic + 20hr supervised practice + 10hr consultation). Level 2 training recommended.',
  certifications:['EMDRIA Certified Therapist (minimum 2 years post-basic, 12+ additional CE hours, 50+ EMDR sessions)','EMDRIA Approved Consultant','EMDR Europe Accredited Practitioner'],
  dropoutRate:'10-20% (lower than many therapies — shorter duration, less homework burden).',
  relapsePrevention:'Re-assessment at 1, 3 months. Target any new disturbing material. Booster sessions available.',
  modifications:{
    pediatric:'EMDR with children: butterfly hug (self-bilateral), storytelling, drawing, shorter sets, parental involvement.',
    elderly:'Effective. May need more preparation phase. Account for cognitive decline. Medical clearance for seizure history.',
    cultural:'Widely validated cross-culturally. Minimal verbal processing may be advantage across cultures. Adapted for collective trauma (e.g., refugee populations).',
    digital:'EMDR via telehealth validated (therapist guides eye movements on screen or uses butterfly hug). Virtual EMDR platforms emerging.'
  },
  costPerSession:'$150-300/session. Some insurance covers. Shorter total course = lower total cost than many therapies.',
  keyCitations:[
    'Shapiro, F. (2018). Eye Movement Desensitization and Reprocessing Therapy, 3rd ed. Guilford Press.',
    'Cusack, K. et al. (2016). Psychological treatments for adults with PTSD: A systematic review and meta-analysis. Clin Psychol Rev, 43, 128-141.',
    'Chen, Y.R. et al. (2014). Efficacy of EMDR therapy for PTSD: Meta-analysis. J Psychiatr Res, 55, 18-26.'
  ]
},

'PE': {
  fullName:'Prolonged Exposure Therapy',
  family:'Trauma-focused CBT',
  developer:'Edna Foa (1986, formalized 2007)',
  overview:'Manualized, trauma-focused CBT for PTSD. Based on Emotional Processing Theory: PTSD maintains through avoidance of trauma-related stimuli. PE breaks avoidance through repeated, prolonged engagement with trauma memories (imaginal exposure) and trauma-related situations (in vivo exposure). One of the most researched PTSD treatments worldwide.',
  coreComponents:['Psychoeducation on PTSD and treatment rationale','Breathing retraining','In vivo exposure (graded hierarchy of avoided situations)','Imaginal exposure (repeated narration of trauma memory, eyes closed, present tense)','Processing of imaginal exposure','SUDS monitoring','Audio recording of imaginal exposure for homework'],
  indications:[
    {dx:'PTSD',evidence:'A',effectSize:'d=1.08-1.82 vs waitlist',nnt:'NNT ~2',notes:'VA/DoD, APA first-line recommendation. 53-80% lose PTSD diagnosis. Effective for combat, sexual assault, accident, childhood abuse.'},
    {dx:'Complex PTSD',evidence:'B',effectSize:'d=0.70',nnt:'NNT ~3-4',notes:'Effective but may need extended course. Consider stabilization first.'},
    {dx:'Comorbid PTSD + SUD',evidence:'B',effectSize:'Emerging',nnt:'Under study',notes:'COPE protocol (Concurrent Treatment of PTSD and Substance Use Disorders Using PE).'}
  ],
  protocol:{
    format:'Individual.',
    sessionLength:'90 minutes (60 min minimum). Longer sessions accommodate imaginal exposure.',
    frequency:'Weekly (standard). Intensive: 10 sessions over 2 weeks (massed PE).',
    totalSessions:'8-15 sessions. Typically 10-12.',
    phases:[
      {name:'Session 1: Psychoeducation',sessions:'1',content:'Rationale for PE, overview of PTSD, introduce breathing retraining, discuss treatment structure.'},
      {name:'Session 2: In Vivo Hierarchy',sessions:'2',content:'Build in vivo exposure hierarchy (situations avoided). Begin in vivo homework. Review common reactions.'},
      {name:'Sessions 3-11: Imaginal + In Vivo',sessions:'3-11',content:'Imaginal exposure: 25-45 min eyes-closed narration of trauma in present tense. Record on audio. Process for 15-20 min. In vivo homework continues escalating.'},
      {name:'Final Session: Review & Relapse Prevention',sessions:'12',content:'Review progress, final imaginal (compare SUDS to first), consolidate gains, plan for maintenance.'}
    ],
    homeworkExamples:['Listen to imaginal exposure recording daily (45-60 min)','In vivo exposure assignments (from hierarchy)','SUDS log for each exposure','Breathing retraining practice']
  },
  headToHead:[
    {vs:'CPT',finding:'Comparable efficacy. PE may work slightly faster. CPT has less emotional intensity per session. Patient preference often determines choice.',cite:'Resick et al., 2012, JAMA Psychiatry'},
    {vs:'EMDR',finding:'Comparable outcomes. PE has more homework burden. Both first-line.',cite:'Cusack et al., 2016'},
    {vs:'Sertraline',finding:'PE superior to sertraline for PTSD. Combined not clearly better than PE alone.',cite:'Foa et al., 2018, JAMA'}
  ],
  contraindications:['Active suicidality with plan (stabilize first)','Active psychosis','Imminent danger (ongoing domestic violence without safety plan)','Severe cognitive impairment','Unstable housing/crisis (basic needs first)'],
  limitations:['High emotional intensity — not all patients tolerate','Homework is demanding (daily 45-60 min)','20-25% dropout','Temporary symptom increase in early sessions (common, expected)','Some clinicians avoid due to fear of retraumatization (not supported by evidence)','Less evidence for dissociative subtype'],
  trainingRequired:'Licensed clinician + PE-specific training (typically through MUSC, VA, or CE programs). Minimum 2-day workshop + supervision on 2 cases. Fidelity monitoring recommended.',
  certifications:['PE Certified Provider (through CTSAs)','VA PE training for VA clinicians','MUSC TF-CBT/PE certification'],
  dropoutRate:'20-25%. Massed PE (intensive) may have lower dropout (15-18%).',
  relapsePrevention:'Booster sessions at 3, 6 months. Continue in vivo exposure. Self-directed imaginal exposure if symptoms return.',
  modifications:{
    pediatric:'TF-CBT is preferred over PE for children/adolescents.',
    elderly:'Effective. May need more sessions. Accommodate medical limitations for in vivo exposure.',
    cultural:'Validated in multiple cultures. Narrative style may need cultural adaptation.',
    digital:'PE Coach app (VA). Telehealth PE validated.'
  },
  costPerSession:'$175-350/session. 10-12 sessions = $1,750-4,200 total.',
  keyCitations:[
    'Foa, E.B. et al. (2019). Prolonged Exposure Therapy for PTSD: Therapist Guide, 2nd ed. Oxford.',
    'Powers, M.B. et al. (2010). A meta-analytic review of PE for PTSD. Clin Psychol Rev, 30(6), 635-641.',
    'Foa, E.B. et al. (2018). PE vs sertraline for PTSD in women veterans. JAMA, 319(10), 2002-2011.'
  ]
},

'CPT': {
  fullName:'Cognitive Processing Therapy',
  family:'Trauma-focused CBT',
  developer:'Patricia Resick (1992)',
  overview:'Manualized, 12-session trauma-focused CBT for PTSD. Targets maladaptive trauma-related beliefs ("stuck points") through cognitive restructuring. Less emphasis on emotional exposure than PE — focuses on meaning-making. Can be delivered with or without written trauma account.',
  coreComponents:['Identify stuck points (maladaptive beliefs about trauma)','Socratic questioning','ABC worksheets (Activating event, Belief, Consequence)','Challenging questions worksheet','Patterns of problematic thinking worksheet','Trauma themes: safety, trust, power/control, esteem, intimacy','Optional written trauma account (Accounts version)'],
  indications:[
    {dx:'PTSD',evidence:'A',effectSize:'d=0.80-1.30',nnt:'NNT ~2-3',notes:'First-line per VA/DoD, APA. Effective for military, sexual assault, childhood abuse, mixed trauma.'},
    {dx:'Complex PTSD',evidence:'B',effectSize:'d=0.68',nnt:'NNT ~3-4',notes:'May need extended course beyond 12 sessions.'},
    {dx:'Comorbid PTSD + Depression',evidence:'A',effectSize:'Depression d=0.73',nnt:'NNT ~3',notes:'Significant depression improvement even without targeting depression directly.'}
  ],
  protocol:{
    format:'Individual (primary). Group CPT also evidence-based.',
    sessionLength:'50 minutes.',
    frequency:'Weekly or twice weekly. Can be delivered in 1-2 sessions/week.',
    totalSessions:'12 sessions (standard, manualized). Extended to 18 for complex cases.',
    phases:[
      {name:'Sessions 1-2: Psychoeducation',sessions:'1-2',content:'PTSD psychoeducation, identify stuck points, impact statement (write about meaning of trauma).'},
      {name:'Sessions 3-7: Processing',sessions:'3-7',content:'ABC worksheets, challenging stuck points, Socratic questioning. Written trauma account (if using Accounts version) in sessions 3-4.'},
      {name:'Sessions 8-12: Themes',sessions:'8-12',content:'Five trauma themes: safety, trust, power/control, esteem, intimacy. Apply challenging skills to each. Final impact statement — compare to initial.'}
    ],
    homeworkExamples:['Impact statement','ABC worksheets (daily)','Challenging beliefs worksheets','Written trauma account (Accounts version)','Theme worksheets']
  },
  headToHead:[
    {vs:'PE',finding:'Comparable. CPT has less emotional intensity per session but more written homework. CPT without account version = less dropout.',cite:'Resick et al., 2012, JAMA Psychiatry'},
    {vs:'EMDR',finding:'Both first-line. CPT more cognitive, EMDR more experiential.',cite:'Cusack et al., 2016'}
  ],
  contraindications:['Active psychosis','Active suicidality with plan','Severe cognitive impairment (limits worksheet use)','Illiteracy (worksheets require reading/writing — adaptations available)'],
  limitations:['Heavy homework burden (daily worksheets)','Requires literacy and cognitive engagement','Some patients find cognitive approach too intellectual','12-session structure may be insufficient for complex trauma','Does not directly target avoidance behaviors'],
  trainingRequired:'Licensed clinician + CPT training (2-day workshop + consultation on 2 cases). CPT certification available through Resick lab/MUSC.',
  certifications:['CPT Certified Provider','CPT Consultant','VA CPT training program'],
  dropoutRate:'18-22%. CPT without written account may have lower dropout.',
  relapsePrevention:'Booster sessions. Continue using challenging beliefs skills independently. Re-engage if stuck points return.',
  modifications:{
    pediatric:'Adapted for adolescents. Simplified worksheets. Parental involvement.',
    elderly:'Effective. Larger print materials. More repetition.',
    cultural:'Validated cross-culturally. Adapt theme examples. Translated into 12+ languages.',
    digital:'CPT Coach app (VA). Telehealth delivery validated.'
  },
  costPerSession:'$150-300/session. 12 sessions = $1,800-3,600 total.',
  keyCitations:[
    'Resick, P.A. et al. (2017). Cognitive Processing Therapy for PTSD: A Comprehensive Manual. Guilford Press.',
    'Resick, P.A. et al. (2012). A randomized clinical trial of group CPT vs group PE in female rape victims. J Consult Clin Psychol, 80(6), 1004-1013.',
    'Asmundson, G.J. et al. (2019). CPT for PTSD: A meta-analysis. Psychol Med, 49(10), 1587-1598.'
  ]
},

'ACT': {
  fullName:'Acceptance and Commitment Therapy',
  family:'CBT (third wave)',
  developer:'Steven C. Hayes (1986, published 1999)',
  overview:'Third-wave behavioral therapy based on Relational Frame Theory. Does NOT aim to reduce symptoms directly — aims to increase psychological flexibility: the ability to be present, open to experience, and engaged in valued action even in the presence of difficult thoughts/feelings. Six core processes arranged in the "hexaflex" model.',
  coreComponents:['Acceptance (vs experiential avoidance)','Cognitive defusion (vs cognitive fusion)','Present moment awareness (vs past/future dwelling)','Self-as-context (vs self-as-content)','Values clarification','Committed action','Hexaflex model','Metaphors and experiential exercises','Creative hopelessness (undermining unworkable control agenda)'],
  indications:[
    {dx:'Chronic Pain',evidence:'A',effectSize:'d=0.55 for pain interference',nnt:'NNT ~4',notes:'Strong evidence for improving function even without pain reduction. NICE recommended.'},
    {dx:'Depression',evidence:'A',effectSize:'d=0.58 vs control',nnt:'NNT ~4-5',notes:'Comparable to CBT. May be better for treatment-resistant/chronic depression.'},
    {dx:'Anxiety Disorders',evidence:'A',effectSize:'d=0.57 vs control',nnt:'NNT ~4',notes:'Across anxiety disorders. Does not target anxiety reduction directly — targets avoidance.'},
    {dx:'OCD',evidence:'B',effectSize:'Emerging, d=0.60-0.77',nnt:'NNT ~4',notes:'ACT for OCD may help ERP-resistant cases. Complements ERP.'},
    {dx:'Substance Use',evidence:'B',effectSize:'d=0.36',nnt:'NNT ~6',notes:'Moderate but consistent effects across substance types.'},
    {dx:'Psychosis',evidence:'B',effectSize:'d=0.46 for rehospitalization',nnt:'NNT ~5',notes:'ACT for psychosis: acceptance of voices rather than elimination.'},
    {dx:'BPD',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Emerging evidence. May complement DBT skills.'}
  ],
  protocol:{
    format:'Individual or group. Both evidence-based.',
    sessionLength:'50-60 minutes (individual). 90-120 minutes (group).',
    frequency:'Weekly.',
    totalSessions:'8-16 sessions typical. Brief ACT: 3-4 sessions. Chronic conditions: open-ended.',
    phases:[
      {name:'Creative Hopelessness',sessions:'1-2',content:'Undermine control agenda. Explore what patient has tried that has not worked. Introduction to willingness as alternative.'},
      {name:'Defusion & Acceptance',sessions:'3-6',content:'Cognitive defusion exercises (leaves on a stream, thank your mind). Acceptance exercises (willingness scales). Mindfulness.'},
      {name:'Values & Committed Action',sessions:'7-12',content:'Values card sort, bull\'s-eye values assessment, committed action steps, behavioral goals aligned with values. Revisit barriers.'},
      {name:'Integration',sessions:'13-16',content:'Hexaflex review, consolidation, self-as-context work, ongoing committed action planning.'}
    ],
    homeworkExamples:['Values worksheet','Mindfulness practice (daily)','Defusion exercises when noticing fusion','Committed action steps (behavioral experiments aligned with values)','Willingness diary']
  },
  headToHead:[
    {vs:'CBT',finding:'Roughly equivalent outcomes across most conditions. ACT may have advantages for treatment-resistant, chronic conditions, and when comorbidity is high.',cite:'A-Tjak et al., 2015, Psychother Psychosom'},
    {vs:'DBT',finding:'Different populations. DBT for BPD/suicidality. ACT broader application. Some overlap in mindfulness and acceptance components.',cite:'Comparison limited — different primary targets'}
  ],
  contraindications:['Active psychosis without modification','Severe cognitive impairment (metaphors require abstract thinking)','Patient in acute crisis needing concrete behavioral management first'],
  limitations:['Mechanism research still evolving','Abstract concepts can be difficult for some patients','Less structured than traditional CBT — therapist skill varies more','Values work can be challenging for anhedonic/alexithymic patients','Fewer disorder-specific protocols than CBT'],
  trainingRequired:'Licensed clinician + ACT-specific training. ACBS (Association for Contextual Behavioral Science) provides training resources. No single mandated certification pathway.',
  certifications:['ACBS Peer-Reviewed ACT Trainer','Various workshop certifications','No single gold-standard certification (unlike DBT)'],
  dropoutRate:'15-25%. Similar to CBT.',
  relapsePrevention:'Values-based living is ongoing. Booster sessions. Return to defusion/acceptance skills as needed.',
  modifications:{
    pediatric:'DNA-V model (Discoverer, Noticer, Advisor, Values). Simplified metaphors. More behavioral, less abstract.',
    elderly:'Effective. Values work particularly meaningful. Acceptance of loss and physical decline.',
    cultural:'Philosophically compatible with many Eastern traditions. Values work is inherently culturally flexible.',
    digital:'ACT Companion app, ACT Coach (VA). Online ACT programs well-validated.'
  },
  costPerSession:'$150-300/session.',
  keyCitations:[
    'Hayes, S.C. et al. (2012). Acceptance and Commitment Therapy, 2nd ed. Guilford Press.',
    'A-Tjak, J.G. et al. (2015). A meta-analysis of the efficacy of ACT for clinically relevant mental and physical health problems. Psychother Psychosom, 84(1), 30-36.',
    'Gloster, A.T. et al. (2020). Impact of psychological flexibility on clinical outcomes. J Consult Clin Psychol, 88(4), 332-339.'
  ]
},

'IPT': {
  fullName:'Interpersonal Therapy',
  family:'Interpersonal',
  developer:'Gerald Klerman & Myrna Weissman (1984)',
  overview:'Time-limited, manualized therapy focusing on interpersonal problems that maintain depression. Does NOT focus on cognitions or behavior patterns — focuses on four interpersonal problem areas. Based on attachment theory and the social origins of depression.',
  coreComponents:['Interpersonal inventory (mapping relationships)','Identification of primary problem area','Focus on one of four areas: grief, role disputes, role transitions, interpersonal deficits','Communication analysis','Role-play','Affect exploration within interpersonal context'],
  indications:[
    {dx:'MDD',evidence:'A',effectSize:'d=0.63 vs control',nnt:'NNT ~4',notes:'First-line per multiple guidelines. Comparable to CBT and medication. Strong evidence for prevention of recurrence.'},
    {dx:'Perinatal Depression',evidence:'A',effectSize:'d=0.70',nnt:'NNT ~3',notes:'Preferred for pregnant/postpartum — no medication exposure. Group IPT also effective for prevention.'},
    {dx:'Bulimia Nervosa',evidence:'A',effectSize:'Equivalent to CBT at 12-month follow-up',nnt:'NNT ~4',notes:'Slower response than CBT initially but catches up by follow-up.'},
    {dx:'Social Anxiety',evidence:'B',effectSize:'d=0.53',nnt:'NNT ~5',notes:'IPT adapted for social anxiety targets interpersonal patterns maintaining avoidance.'},
    {dx:'Dysthymia/PDD',evidence:'B',effectSize:'d=0.44',nnt:'NNT ~5',notes:'May need extended course.'}
  ],
  protocol:{
    format:'Individual (primary). Group IPT also evidence-based.',
    sessionLength:'50 minutes.',
    frequency:'Weekly.',
    totalSessions:'12-16 sessions.',
    phases:[
      {name:'Initial Phase',sessions:'1-4',content:'Depressive symptoms review, interpersonal inventory, identify primary problem area, set treatment contract, assign sick role (temporary).'},
      {name:'Middle Phase',sessions:'5-12',content:'Work on identified problem area using communication analysis, role-play, affect exploration, decision analysis.'},
      {name:'Termination',sessions:'13-16',content:'Review progress, address feelings about ending, relapse prevention, identify early warning signs, plan for ongoing interpersonal skills use.'}
    ],
    homeworkExamples:['Communication practice between sessions','Interpersonal experiments','Journaling about relationship interactions','Grief rituals (if grief focus)']
  },
  headToHead:[
    {vs:'CBT',finding:'Comparable for depression. CBT may work faster. IPT may be preferred when interpersonal issues are primary.',cite:'Cuijpers et al., 2011, Am J Psychiatry'},
    {vs:'Medication',finding:'Comparable for mild-moderate. Combined IPT+meds superior for severe/recurrent.',cite:'Frank et al., 1990, Arch Gen Psychiatry'}
  ],
  contraindications:['Active psychosis','Active substance dependence (address first)','Antisocial personality disorder (limited interpersonal motivation)'],
  limitations:['Does not address cognitive distortions directly','Less effective when depression is not interpersonally driven','Fewer trained therapists than CBT','Does not address avoidance or exposure needs'],
  trainingRequired:'Licensed clinician + IPT-specific training. ISIPT (International Society of Interpersonal Psychotherapy) provides training standards.',
  certifications:['ISIPT Certified IPT Therapist','Various university-based IPT training programs'],
  dropoutRate:'15-20%.',
  relapsePrevention:'Monthly maintenance IPT (IPT-M) effective for preventing recurrence. Shown to prevent relapse over 3 years.',
  modifications:{
    pediatric:'IPT-A (adolescent): 12 sessions, modified for developmental stage, closeness circle, address school/peer issues.',
    elderly:'IPT-Late Life: address bereavement, retirement (role transitions), medical illness, social isolation.',
    cultural:'Interpersonal focus translates well across cultures. Adapt relationship expectations to cultural norms.',
    digital:'Telehealth IPT validated. Some online programs emerging.'
  },
  costPerSession:'$150-300/session. 12-16 sessions = $1,800-4,800 total.',
  keyCitations:[
    'Weissman, M.M. et al. (2018). Comprehensive Guide to Interpersonal Psychotherapy. Oxford.',
    'Cuijpers, P. et al. (2011). Interpersonal psychotherapy for depression: Meta-analysis. Am J Psychiatry, 168(6), 581-592.',
    'Frank, E. et al. (1990). Three-year outcomes for maintenance therapies in recurrent depression. Arch Gen Psychiatry, 47(12), 1093-1099.'
  ]
},

'MI': {
  fullName:'Motivational Interviewing',
  family:'Humanistic / Integrative',
  developer:'William R. Miller & Stephen Rollnick (1991)',
  overview:'Collaborative, person-centered counseling style for strengthening personal motivation for change. Not a technique — a way of being with people. Based on the premise that ambivalence about change is normal and that confrontation increases resistance. Uses the patient\'s own values and goals to resolve ambivalence.',
  coreComponents:['OARS skills (Open questions, Affirmations, Reflections, Summaries)','Express empathy','Develop discrepancy','Roll with resistance','Support self-efficacy','Change talk elicitation','Sustain talk management','Importance and confidence rulers','Decisional balance'],
  indications:[
    {dx:'Substance Use Disorders',evidence:'A',effectSize:'d=0.25-0.57',nnt:'NNT ~5-8',notes:'Most evidence here. Brief MI (1-4 sessions) effective. Enhances engagement in subsequent treatment.'},
    {dx:'Treatment Engagement (any)',evidence:'A',effectSize:'Increases treatment adherence by 20-50%',nnt:'Variable',notes:'MI as prelude to other therapies increases retention and outcomes across diagnoses.'},
    {dx:'Health Behavior Change',evidence:'A',effectSize:'d=0.22-0.44',nnt:'Variable',notes:'Medication adherence, diet, exercise, diabetes management, smoking cessation.'},
    {dx:'Gambling Disorder',evidence:'B',effectSize:'d=0.33',nnt:'NNT ~7',notes:'Brief MI plus CBT.'},
    {dx:'Eating Disorders',evidence:'B',effectSize:'Enhances treatment engagement',nnt:'Variable',notes:'MI as readiness intervention before CBT-E or FBT.'},
    {dx:'Dual Diagnosis',evidence:'B',effectSize:'d=0.38',nnt:'NNT ~6',notes:'MI for substance use in context of mental illness.'}
  ],
  protocol:{
    format:'Individual. Can be delivered in groups (less evidence).',
    sessionLength:'30-60 minutes. Brief MI: 15-20 minutes (e.g., in medical settings).',
    frequency:'1-4 sessions typical. Can be integrated into ongoing therapy.',
    totalSessions:'1-4 sessions (brief MI). Can be ongoing spirit infused into other therapies.',
    phases:[
      {name:'Engaging',sessions:'Ongoing',content:'Build therapeutic alliance, OARS, express empathy. Avoid righting reflex.'},
      {name:'Focusing',sessions:'Session 1-2',content:'Identify target behavior, set agenda collaboratively. What does the patient want to change?'},
      {name:'Evoking',sessions:'Session 2-3',content:'Elicit change talk (DARN-CAT: Desire, Ability, Reasons, Need, Commitment, Activation, Taking steps). Respond to sustain talk without arguing.'},
      {name:'Planning',sessions:'Session 3-4',content:'Consolidate commitment, develop change plan, anticipate barriers, strengthen confidence.'}
    ],
    homeworkExamples:['Values reflection','Pros/cons of change','Small behavioral experiments','Self-monitoring of target behavior']
  },
  headToHead:[
    {vs:'Confrontational approaches',finding:'MI consistently superior to confrontational counseling for substance use. Confrontation increases resistance and dropout.',cite:'Miller & Rollnick, 2013'},
    {vs:'CBT',finding:'Different goals. MI enhances motivation; CBT provides skills. MI+CBT often combined and superior to either alone.',cite:'Hettema et al., 2005, Annual Review of Clinical Psychology'}
  ],
  contraindications:['None absolute. MI is a style, not a treatment for specific disorders. Inappropriate as sole treatment for severe psychiatric conditions requiring medication or structured therapy.'],
  limitations:['Small to moderate effect sizes as standalone','Requires genuine empathy — cannot be delivered mechanically','Spirit of MI more important than technique — hard to standardize','Insufficient alone for severe conditions','Fidelity is difficult to maintain — many therapists think they do MI but don\'t'],
  trainingRequired:'Licensed or paraprofessional + MI training (2-3 day workshop minimum). Coding with MITI (Motivational Interviewing Treatment Integrity) recommended for fidelity.',
  certifications:['MINT (Motivational Interviewing Network of Trainers) membership','Various workshop certificates','No single gold-standard certification'],
  dropoutRate:'Low (5-15%) given brief format.',
  relapsePrevention:'MI principles can be revisited at any point. Booster sessions effective.',
  modifications:{
    pediatric:'MI adapted for adolescents. Parent involvement. Developmental considerations for autonomy.',
    elderly:'Effective. May need to address generational attitudes about change and therapy.',
    cultural:'Core principles (respect, autonomy, non-judgment) are culturally resonant. Adapt language and examples.',
    digital:'MI-based apps and chatbots emerging. Telehealth MI validated.'
  },
  costPerSession:'$100-250/session. Brief: minimal cost when integrated into medical visits.',
  keyCitations:[
    'Miller, W.R. & Rollnick, S. (2013). Motivational Interviewing, 3rd ed. Guilford Press.',
    'Lundahl, B.W. et al. (2010). A meta-analysis of MI: Twenty-five years of empirical studies. Research on Social Work Practice, 20(2), 137-160.',
    'Hettema, J. et al. (2005). MI. Annual Review of Clinical Psychology, 1, 91-111.'
  ]
},

// ─── CBT VARIANTS (STANDALONE PROTOCOLS) ───────────────────

'CBT-I': {
  fullName:'Cognitive Behavioral Therapy for Insomnia',
  family:'CBT',
  developer:'Arthur Spielman, Charles Morin, Michael Perlis (1980s–1990s)',
  overview:'First-line treatment for chronic insomnia per AASM, ACP, and ESRS guidelines — recommended OVER medication. Targets the perpetuating factors of insomnia: conditioned arousal, dysfunctional sleep beliefs, and maladaptive sleep habits. Typically 4–8 sessions. The only insomnia treatment with lasting effects after discontinuation.',
  coreComponents:['Sleep restriction therapy (compress time in bed to match actual sleep)','Stimulus control (bed = sleep only; get up if awake >15 min)','Sleep hygiene education','Cognitive restructuring (catastrophic sleep beliefs)','Relaxation training (progressive muscle relaxation, diaphragmatic breathing)','Sleep diary (daily tracking)'],
  indications:[
    {dx:'Chronic Insomnia',evidence:'A',effectSize:'d=0.98 for sleep onset latency; d=0.84 for wake after sleep onset',nnt:'NNT ~2-3',notes:'First-line over all medications. Effects last years after treatment ends. Medications do not.'},
    {dx:'Insomnia + Depression',evidence:'A',effectSize:'d=0.78 for insomnia; depression also improves',nnt:'NNT ~3',notes:'Treating insomnia with CBT-I improves depression outcomes even without targeting depression directly.'},
    {dx:'Insomnia + Chronic Pain',evidence:'B',effectSize:'d=0.60',nnt:'NNT ~4',notes:'Improves sleep despite ongoing pain. Pain perception may improve secondarily.'},
    {dx:'Insomnia + PTSD',evidence:'B',effectSize:'Moderate',nnt:'NNT ~4',notes:'Adjunct to trauma-focused therapy. Nightmares may need separate intervention (IRT).'}
  ],
  protocol:{
    format:'Individual or group. Brief formats (4 sessions) effective.',
    sessionLength:'30-50 minutes.',
    frequency:'Weekly or biweekly.',
    totalSessions:'4-8 sessions. Many patients improve by session 3-4.',
    phases:[
      {name:'Assessment',sessions:'1',content:'Sleep diary review (1-2 weeks baseline), sleep history, identify perpetuating factors, calculate sleep efficiency, set sleep window.'},
      {name:'Sleep Restriction + Stimulus Control',sessions:'2-3',content:'Implement restricted sleep window (time in bed = average total sleep time, minimum 5 hrs). Stimulus control rules. Expect temporary sleep deprivation — this is the active ingredient.'},
      {name:'Titration + Cognitive',sessions:'4-6',content:'Expand sleep window by 15-30 min when efficiency >85%. Challenge catastrophic beliefs about sleep loss. Relaxation training.'},
      {name:'Maintenance',sessions:'7-8',content:'Consolidate gains, develop relapse prevention plan, discuss tapering sleep medications if applicable.'}
    ],
    homeworkExamples:['Daily sleep diary (bedtime, rise time, estimated sleep time, sleep quality)','Strict stimulus control adherence','No clock-watching','Fixed wake time 7 days/week','No napping (initially)']
  },
  headToHead:[
    {vs:'Benzodiazepines/Z-drugs',finding:'CBT-I equivalent short-term, SUPERIOR long-term. Medications lose efficacy; CBT-I gains persist 1-3 years post-treatment.',cite:'Mitchell et al., 2012, Ann Intern Med'},
    {vs:'Trazodone',finding:'CBT-I superior for sustained improvement. Trazodone has no long-term insomnia efficacy data.',cite:'Jacobs et al., 2004'},
    {vs:'Suvorexant/Lemborexant',finding:'No direct head-to-head. Guidelines recommend CBT-I first. ORAs for patients who fail or cannot access CBT-I.',cite:'AASM Guidelines, 2021'}
  ],
  contraindications:['Untreated sleep apnea (treat first)','Bipolar disorder (sleep restriction can trigger mania — modify protocol)','Seizure disorder (sleep deprivation lowers seizure threshold — modify)','Occupational hazard from daytime sleepiness during early treatment (shift workers, pilots)'],
  limitations:['Initial 1-2 weeks often worse before better (sleep restriction)','Requires high compliance — strict rules','Limited therapist availability','Some patients prefer medication despite evidence','Not effective for circadian rhythm disorders (different mechanism)'],
  trainingRequired:'Licensed clinician + CBT-I specific training. SBSM (Society of Behavioral Sleep Medicine) provides certification pathway.',
  certifications:['SBSM Diplomate in Behavioral Sleep Medicine','CBSM (Certified in Behavioral Sleep Medicine)','Perlis/UPenn CBT-I training'],
  dropoutRate:'10-20% (lower than most therapies — short duration).',
  relapsePrevention:'Maintain fixed wake time. Resume stimulus control at first sign of recurrence. Booster session if needed.',
  modifications:{
    pediatric:'Primarily behavioral for young children (bedtime fading, extinction). Cognitive components for adolescents.',
    elderly:'Highly effective. Preferred over medications (fall risk, cognitive effects). May need slower sleep restriction.',
    cultural:'Sleep beliefs vary culturally — adapt cognitive component. Co-sleeping norms affect stimulus control.',
    digital:'Somryst (FDA-cleared digital CBT-I), Sleepio, Sleepio. Digital CBT-I non-inferior to in-person in RCTs.'
  },
  costPerSession:'$100-250/session. 4-8 sessions = $400-2,000 total. Digital: $0-300.',
  keyCitations:[
    'Edinger, J.D. et al. (2021). Behavioral and psychological treatments for chronic insomnia disorder in adults: AASM systematic review and meta-analysis. J Clin Sleep Med, 17(2), 255-262.',
    'Trauer, J.M. et al. (2015). CBT for chronic insomnia: Systematic review and meta-analysis. Ann Intern Med, 163(3), 191-204.',
    'Morin, C.M. et al. (2006). Psychological and behavioral treatment of insomnia. Sleep, 29(11), 1398-1414.'
  ]
},

'CBT-E': {
  fullName:'Enhanced Cognitive Behavioral Therapy for Eating Disorders',
  family:'CBT',
  developer:'Christopher Fairburn (2008)',
  overview:'Transdiagnostic treatment for all eating disorders — not just bulimia. "Enhanced" refers to broadening focus beyond eating to include mood intolerance, clinical perfectionism, low self-esteem, and interpersonal difficulties as maintaining mechanisms. The most evidence-based psychotherapy for bulimia and the leading treatment for most eating disorders.',
  coreComponents:['Real-time self-monitoring (food diary with context)','Regular eating pattern (3 meals + 2-3 snacks, no gaps >4 hours)','Weekly weighing (collaborative, in session)','Psychoeducation on weight regulation','Addressing dietary restraint and rules','Body checking/avoidance modification','Mindset change (over-evaluation of shape/weight)','Relapse prevention'],
  indications:[
    {dx:'Bulimia Nervosa',evidence:'A',effectSize:'d=0.78; 50-60% cease binge-purge',nnt:'NNT ~2-3',notes:'Gold standard. Superior to all medications. NICE first-line.'},
    {dx:'BED',evidence:'A',effectSize:'d=0.70; 50-60% cease binge eating',nnt:'NNT ~3',notes:'First-line. Also improves eating disorder psychopathology, not just binge frequency.'},
    {dx:'Anorexia (adults)',evidence:'B',effectSize:'d=0.50',nnt:'NNT ~4',notes:'Leading individual therapy for adult anorexia. FBT preferred for adolescents.'},
    {dx:'OSFED/EDNOS',evidence:'B',effectSize:'d=0.60',nnt:'NNT ~4',notes:'Transdiagnostic design means it works across diagnostic categories.'}
  ],
  protocol:{
    format:'Individual. Focused (simpler) or Broad (adds modules for perfectionism, self-esteem, interpersonal difficulties).',
    sessionLength:'50 minutes.',
    frequency:'Twice weekly × 4 weeks, then weekly.',
    totalSessions:'20 sessions over 20 weeks (non-underweight). 40 sessions over 40 weeks (underweight/anorexia).',
    phases:[
      {name:'Stage 1: Starting Well',sessions:'1-8 (twice weekly)',content:'Engage patient, establish real-time self-monitoring, introduce regular eating pattern, collaborative weighing, psychoeducation. Build momentum.'},
      {name:'Stage 2: Taking Stock',sessions:'8-9',content:'Joint review of progress, identify remaining maintaining mechanisms, decide Focused vs Broad version, plan Stage 3.'},
      {name:'Stage 3: Core Mechanisms',sessions:'10-17',content:'Address over-evaluation of shape/weight, dietary restraint/rules, body checking/avoidance, event-related binge triggers. Broad version adds: clinical perfectionism, core low self-esteem, interpersonal difficulties modules.'},
      {name:'Stage 4: Ending Well',sessions:'18-20',content:'Relapse prevention, anticipate setbacks, develop maintenance plan, realistic expectations, phased ending.'}
    ],
    homeworkExamples:['Real-time food monitoring (what, when, where, context, binge/purge/restrict)','Regular eating adherence','Weekly weight record','Body checking reduction','Dietary rule-breaking experiments']
  },
  headToHead:[
    {vs:'Fluoxetine (bulimia)',finding:'CBT-E superior. Fluoxetine 60mg helps but CBT-E alone is better. Combined may have small additional benefit.',cite:'NICE Guidelines, 2017'},
    {vs:'IPT',finding:'CBT-E faster response. IPT catches up by 12-month follow-up. CBT-E preferred first-line due to faster onset.',cite:'Fairburn et al., 2015'},
    {vs:'FBT (adolescents)',finding:'FBT preferred for adolescent anorexia. CBT-E preferred for adults and non-anorexia presentations.',cite:'Lock et al., 2010'}
  ],
  contraindications:['BMI <15 (medical stabilization first — inpatient/day program)','Active suicidality','Severe substance abuse','Medical instability (electrolyte abnormalities, cardiac risk)'],
  limitations:['Requires specialized training — general CBT therapists cannot deliver it','40-50% non-response rate in anorexia','Does not address trauma directly (may need adjunct)','Twice-weekly start phase can be access barrier','Self-monitoring compliance essential'],
  trainingRequired:'Licensed clinician + specific CBT-E training through CREDO (Centre for Research on Eating Disorders at Oxford) or equivalent. Reading the manual alone is insufficient.',
  certifications:['CREDO CBT-E training program','Oxford Eating Disorders training','AED (Academy for Eating Disorders) credentialing'],
  dropoutRate:'20-30%. Higher in anorexia. Lower when therapeutic alliance is strong.',
  relapsePrevention:'Maintenance plan developed in Stage 4. Booster sessions at 4, 12, 20 weeks post-treatment. Resume self-monitoring at first sign of relapse.',
  modifications:{
    pediatric:'CBT-E adapted for adolescents includes parental involvement. FBT generally preferred first for adolescent anorexia.',
    elderly:'Limited evidence. Adapt for medical comorbidities.',
    cultural:'Adapt body image and dietary components to cultural context. Eating norms vary significantly across cultures.',
    digital:'Internet-based CBT-E showing promise. Self-help based on CBT-E (Overcoming Binge Eating) as stepped care first step.'
  },
  costPerSession:'$150-350/session. 20 sessions = $3,000-7,000. 40 sessions = $6,000-14,000.',
  keyCitations:[
    'Fairburn, C.G. (2008). Cognitive Behavior Therapy and Eating Disorders. Guilford Press.',
    'Fairburn, C.G. et al. (2015). Enhanced CBT for eating disorders: A randomised controlled trial. Behav Res Ther, 70, 64-71.',
    'Linardon, J. et al. (2017). The efficacy of CBT-E for eating disorders: A systematic review and meta-analysis. J Consult Clin Psychol, 85(11), 1080-1094.'
  ]
},

'BA': {
  fullName:'Behavioral Activation',
  family:'Behavioral',
  developer:'Peter Lewinsohn (1974), refined by Christopher Martell & Carl Lejuez (2001)',
  overview:'Standalone depression treatment based on the behavioral model: depression is maintained by withdrawal, avoidance, and loss of positive reinforcement. BA systematically increases engagement with rewarding activities and reduces avoidance behaviors. Simpler than full CBT — no cognitive restructuring required. Can be delivered by non-specialist providers, making it highly scalable.',
  coreComponents:['Activity monitoring (baseline)','Values assessment','Activity scheduling (graded, values-aligned)','Avoidance pattern identification','TRAP/TRAC model (Trigger → Response → Avoidance Pattern vs Trigger → Response → Alternative Coping)','Rumination as avoidance behavior','Social re-engagement','Routine building'],
  indications:[
    {dx:'MDD',evidence:'A',effectSize:'d=0.74 vs control; comparable to full CBT',nnt:'NNT ~3',notes:'NICE recommended. Non-inferior to CBT in COBRA trial. Can be delivered by junior mental health workers.'},
    {dx:'Persistent Depressive Disorder',evidence:'B',effectSize:'d=0.55',nnt:'NNT ~4',notes:'Extended course may be needed.'},
    {dx:'Depression + Medical Illness',evidence:'B',effectSize:'d=0.50',nnt:'NNT ~5',notes:'Effective in cancer, cardiac, chronic pain populations. Adaptable to physical limitations.'},
    {dx:'Adolescent Depression',evidence:'B',effectSize:'d=0.56',nnt:'NNT ~4',notes:'NICE recommended for mild-moderate adolescent depression.'}
  ],
  protocol:{
    format:'Individual. Group also evidence-based.',
    sessionLength:'50 minutes. Brief BA: 30 minutes.',
    frequency:'Weekly.',
    totalSessions:'12-16 sessions (standard). Brief BA: 6-8 sessions.',
    phases:[
      {name:'Assessment & Monitoring',sessions:'1-3',content:'Depression assessment, introduce behavioral model, begin activity monitoring (what, when, mood rating), identify patterns of avoidance and withdrawal.'},
      {name:'Activation',sessions:'4-10',content:'Values clarification, schedule graded activities (start small), TRAP → TRAC analysis for avoidance, increase mastery and pleasure activities, address rumination as behavior.'},
      {name:'Consolidation',sessions:'11-16',content:'Maintain activity schedule, generalize skills, address remaining avoidance, relapse prevention, develop ongoing routine.'}
    ],
    homeworkExamples:['Daily activity log with mood ratings','Scheduled pleasant activities (minimum 1/day)','TRAP/TRAC worksheets','Values-aligned goal steps','Social contact scheduling']
  },
  headToHead:[
    {vs:'CBT',finding:'Non-inferior in the COBRA trial (n=440). BA delivered by junior workers was as effective as CBT delivered by experienced therapists. BA is more cost-effective.',cite:'Richards et al., 2016, Lancet'},
    {vs:'Medication (SSRI)',finding:'Comparable for moderate depression. BA + medication may be superior for severe depression.',cite:'Dimidjian et al., 2006'},
    {vs:'ACT',finding:'Both effective for depression. BA is simpler to train and deliver. ACT adds acceptance framework.',cite:'Comparison ongoing'}
  ],
  contraindications:['Active psychosis (modify significantly)','Severe cognitive impairment','Imminent suicide risk (stabilize first)'],
  limitations:['Less effective for anxiety-predominant presentations','Some patients need cognitive component','Requires active engagement — homework compliance essential','May not address deep characterological issues','Limited evidence for complex/chronic presentations'],
  trainingRequired:'Lower training threshold than CBT. Can be delivered by trained junior mental health workers, nurses, community health workers. 2-5 day training + supervision.',
  certifications:['No single gold-standard certification','BABCP training includes BA','Various workshop certificates','Lejuez BATD training'],
  dropoutRate:'15-20%.',
  relapsePrevention:'Maintain activity schedule and routine. Resume monitoring at early signs. Booster sessions available.',
  modifications:{
    pediatric:'Activity scheduling with parent involvement. Reward systems. Age-appropriate activities.',
    elderly:'Highly effective. Adapt activities to physical capacity. Address social isolation specifically.',
    cultural:'Activities and values are inherently culturally flexible. One of the most culturally adaptable treatments.',
    digital:'Behavioral activation apps (MoodKit, Bearable). Step-by-step online programs.'
  },
  costPerSession:'$100-250/session. 12 sessions = $1,200-3,000. Cheaper if delivered by junior staff.',
  keyCitations:[
    'Richards, D.A. et al. (2016). Cost and outcome of BA vs CBT for depression (COBRA): Randomised controlled non-inferiority trial. Lancet, 388(10047), 871-880.',
    'Dimidjian, S. et al. (2006). Randomized trial of BA, CT, and antidepressant medication for acute treatment of MDD. J Consult Clin Psychol, 74(4), 658-670.',
    'Martell, C.R. et al. (2010). Behavioral Activation for Depression: A Clinician\'s Guide. Guilford Press.'
  ]
},

'Schema': {
  fullName:'Schema Therapy',
  family:'Integrative',
  developer:'Jeffrey Young (1990s)',
  overview:'Integrative therapy combining CBT, attachment theory, Gestalt, and psychodynamic approaches. Targets Early Maladaptive Schemas (EMS) — deep, pervasive patterns developed in childhood that drive adult psychopathology. Uses cognitive, experiential, behavioral, and relational techniques. Particularly effective for personality disorders and chronic/treatment-resistant conditions.',
  coreComponents:['Identification of Early Maladaptive Schemas (18 schemas in 5 domains)','Schema modes (moment-to-moment states)','Limited reparenting (therapist provides what was missing in childhood, within bounds)','Imagery rescripting (reworking childhood memories)','Chair work (Gestalt-derived dialogue between modes)','Empathic confrontation','Behavioral pattern-breaking','Schema diaries'],
  indications:[
    {dx:'BPD',evidence:'A',effectSize:'d=0.75; 52% full recovery at 3 years',nnt:'NNT ~3',notes:'Non-inferior to DBT for BPD symptoms. May have advantages for full recovery at long-term follow-up.'},
    {dx:'Personality Disorders (Cluster C)',evidence:'B',effectSize:'d=0.60',nnt:'NNT ~4',notes:'Avoidant, dependent, obsessive-compulsive PDs.'},
    {dx:'Chronic/Recurrent Depression',evidence:'B',effectSize:'d=0.65',nnt:'NNT ~4',notes:'When standard CBT has failed or depression recurs. Targets underlying schemas maintaining vulnerability.'},
    {dx:'Complex PTSD',evidence:'B',effectSize:'Emerging',nnt:'Under study',notes:'Schema therapy for trauma integrates imagery rescripting with schema change.'},
    {dx:'Eating Disorders (chronic)',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'When CBT-E has failed. Addresses underlying schemas (defectiveness, emotional deprivation).'}
  ],
  protocol:{
    format:'Individual (primary). Group schema therapy also evidence-based for personality disorders.',
    sessionLength:'50-90 minutes (longer for experiential work).',
    frequency:'Weekly or twice weekly.',
    totalSessions:'50-100+ sessions over 1-3 years for personality disorders. 20-40 for focal schema work.',
    phases:[
      {name:'Assessment & Education',sessions:'1-8',content:'Schema identification (Young Schema Questionnaire), mode mapping, childhood history, develop case formulation, psychoeducation on schemas and modes.'},
      {name:'Change Phase — Cognitive',sessions:'Ongoing',content:'Challenge schemas through evidence review, schema flashcards, continuum work, pros/cons of schema maintenance vs change.'},
      {name:'Change Phase — Experiential',sessions:'Ongoing',content:'Imagery rescripting of childhood memories, chair work between modes (Vulnerable Child ↔ Healthy Adult ↔ Critic), limited reparenting in therapeutic relationship.'},
      {name:'Change Phase — Behavioral',sessions:'Ongoing',content:'Behavioral pattern-breaking homework, new relationship experiments, gradual reduction of schema-driven avoidance and compensation.'}
    ],
    homeworkExamples:['Schema diary (trigger, schema activated, mode, emotion, behavior)','Schema flashcards (old belief vs new)','Behavioral pattern-breaking experiments','Imagery practice','Letter to inner child']
  },
  headToHead:[
    {vs:'DBT',finding:'Both effective for BPD. DBT may be better for acute suicidality and behavioral crises. Schema therapy may produce higher full recovery rates at 3-year follow-up.',cite:'Giesen-Bloo et al., 2006, Arch Gen Psychiatry'},
    {vs:'CBT',finding:'Schema therapy superior for chronic depression and personality pathology. Standard CBT sufficient for acute, non-chronic presentations.',cite:'Masley et al., 2012'},
    {vs:'TFP',finding:'Schema therapy showed greater improvement in BPD symptoms and higher recovery rates than TFP in the original Dutch trial.',cite:'Giesen-Bloo et al., 2006'}
  ],
  contraindications:['Active psychosis','Active severe substance dependence','Acute suicidality (stabilize with DBT or crisis management first)','Antisocial PD with no motivation for change','Severe dissociation (stabilize first)'],
  limitations:['Long treatment duration (1-3 years for PDs)','Expensive over full course','Fewer trained therapists than CBT/DBT','Experiential techniques require skilled delivery','Limited RCT evidence compared to CBT/DBT','Imagery rescripting can be intense'],
  trainingRequired:'Licensed clinician + Schema Therapy certification through ISST (International Society of Schema Therapy). Standard, Advanced, and Certified levels.',
  certifications:['ISST Certified Schema Therapist','ISST Advanced Certified','ISST Schema Therapy Trainer/Supervisor'],
  dropoutRate:'15-25% (lower than expected for PD populations).',
  relapsePrevention:'Gradual termination (session spacing). Schema flashcards for ongoing use. Booster sessions. Schema awareness as lifelong skill.',
  modifications:{
    pediatric:'Schema therapy for children/adolescents (ST-CA). Involves parents. Mode work adapted to developmental level.',
    elderly:'Limited evidence. Address life review and schema persistence. Adapt imagery work.',
    cultural:'Schema domains are cross-cultural but specific schemas may present differently. Adapt limited reparenting to cultural norms around therapeutic relationships.',
    digital:'Limited digital adaptations. Some online schema therapy groups emerging.'
  },
  costPerSession:'$150-350/session. Full PD course (75 sessions): $11,000-26,000.',
  keyCitations:[
    'Young, J.E. et al. (2003). Schema Therapy: A Practitioner\'s Guide. Guilford Press.',
    'Giesen-Bloo, J. et al. (2006). Outpatient psychotherapy for BPD: Randomized trial of schema-focused therapy vs TFP. Arch Gen Psychiatry, 63(6), 649-658.',
    'Masley, S.A. et al. (2012). Effectiveness of schema therapy for personality disorders: A meta-analysis. Int J Evidence-Based Healthcare, 10, 259-270.'
  ]
},

'MBT': {
  fullName:'Mentalization-Based Treatment',
  family:'Psychodynamic / Integrative',
  developer:'Peter Fonagy & Anthony Bateman (2004)',
  overview:'Semi-structured psychodynamic therapy for BPD based on mentalization — the capacity to understand behavior in terms of mental states (thoughts, feelings, desires, intentions) in self and others. BPD is understood as a disorder of mentalizing: under stress, mentalizing fails, leading to emotional dysregulation, impulsivity, and relationship breakdowns. MBT aims to strengthen and stabilize mentalizing capacity.',
  coreComponents:['Mentalizing stance (curious, not-knowing, inquisitive)','Identifying mentalizing failures (psychic equivalence, pretend mode, teleological thinking)','Affect focus (identifying and labeling emotions in real-time)','Relational mentalizing (understanding self and other in therapeutic relationship)','Stop-rewind-explore technique','Mentalizing the transference','Group mentalizing exercises'],
  indications:[
    {dx:'BPD',evidence:'A',effectSize:'d=0.52; sustained improvement at 8-year follow-up',nnt:'NNT ~4',notes:'RCT evidence for reduction in suicide attempts, self-harm, hospitalization, depression, and interpersonal functioning. Effects strengthen over time.'},
    {dx:'Antisocial PD',evidence:'B',effectSize:'d=0.40',nnt:'NNT ~5',notes:'MOAM (MBT for antisocial PD) trial showed reduced aggression and improved social functioning.'},
    {dx:'Eating Disorders',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'MBT adapted for eating disorders focuses on mentalizing body and emotions.'},
    {dx:'Adolescent Self-Harm',evidence:'B',effectSize:'Significant reduction vs TAU',nnt:'NNT ~4',notes:'MBT-A (adolescent) reduces self-harm and depression.'}
  ],
  protocol:{
    format:'Individual + group (standard). Individual alone also effective.',
    sessionLength:'Individual: 50 min. Group: 90 min.',
    frequency:'Individual: weekly. Group: weekly.',
    totalSessions:'18 months standard program. Stepped-down version: 12 months.',
    phases:[
      {name:'Assessment & Formulation',sessions:'1-4',content:'Mentalizing profile assessment, attachment history, crisis plan, psychoeducation on mentalizing model, establish therapeutic contract.'},
      {name:'Early Treatment',sessions:'Months 1-6',content:'Build therapeutic alliance, identify mentalizing failures in session, practice affect identification, stabilize emotional crises through mentalizing.'},
      {name:'Middle Treatment',sessions:'Months 6-12',content:'Deepen mentalizing capacity, address relational patterns, mentalize transference, group mentalizing skills.'},
      {name:'Ending Phase',sessions:'Months 12-18',content:'Process ending (major mentalizing challenge), consolidate gains, develop ongoing mentalizing practice, transition plan.'}
    ],
    homeworkExamples:['Mentalizing diary (situation, my thoughts, others\' possible thoughts, what I felt, what I did)','Affect labeling practice','Perspective-taking exercises','Group discussion reflection']
  },
  headToHead:[
    {vs:'DBT',finding:'Both effective for BPD. MBT may be better at improving mentalizing and interpersonal functioning. DBT may be better for acute behavioral crises.',cite:'Stoffers-Winterling et al., 2022, Cochrane'},
    {vs:'Structured Clinical Management',finding:'MBT superior for BPD at 18 months and maintained at 8-year follow-up.',cite:'Bateman & Fonagy, 2008, Am J Psychiatry'},
    {vs:'Schema Therapy',finding:'Limited direct comparison. Both address deep personality structures through different theoretical lenses.',cite:'Indirect comparison only'}
  ],
  contraindications:['Active psychosis','Severe cognitive impairment','Current severe substance intoxication','No interest in understanding mental states (purely behavioral presentation)'],
  limitations:['Long treatment duration (18 months)','Requires mentalizing stance — hard to train and maintain','Fewer RCTs than DBT','Less structured than DBT — fidelity harder to ensure','Not widely available outside UK/Europe','Requires genuine curiosity about mental states'],
  trainingRequired:'Licensed clinician + MBT training through Anna Freud Centre or accredited programs. 3-day introductory, then advanced training + supervision.',
  certifications:['Anna Freud Centre MBT Certification','MBT-trained practitioner designation','Various international MBT training centers'],
  dropoutRate:'20-25%.',
  relapsePrevention:'Mentalizing is a lifelong skill. Step-down to monthly, then as-needed. Mentalizing deteriorates under stress — early re-engagement important.',
  modifications:{
    pediatric:'MBT-A for adolescents (12-18 months). Family mentalizing component. MBT-C for children incorporates play.',
    elderly:'Limited evidence. Mentalizing framework applicable but research needed.',
    cultural:'Mentalizing concept translates across cultures. Understanding of mental states is universal. Adapt examples to cultural context.',
    digital:'Online MBT groups emerging post-COVID. Telehealth individual MBT validated.'
  },
  costPerSession:'$150-300/session. 18-month program: $10,000-20,000.',
  keyCitations:[
    'Bateman, A. & Fonagy, P. (2016). Mentalization-Based Treatment for Personality Disorders, 2nd ed. Oxford.',
    'Bateman, A. & Fonagy, P. (2009). Randomized controlled trial of outpatient MBT vs SCM for BPD. Am J Psychiatry, 166(12), 1355-1364.',
    'Bateman, A. & Fonagy, P. (2008). 8-year follow-up of patients treated for BPD: MBT vs TAU. Am J Psychiatry, 165(5), 631-638.'
  ]
},

'IFS': {
  fullName:'Internal Family Systems',
  family:'Systems / Experiential',
  developer:'Richard Schwartz (1990s)',
  overview:'Integrative therapy model viewing the mind as composed of sub-personalities ("parts") organized around a core Self. Three types of parts: Exiles (wounded, carry pain), Managers (protect by controlling), and Firefighters (protect through impulsive emergency action). Healing occurs when Self — characterized by curiosity, compassion, clarity, confidence — leads rather than parts. NREPP evidence-based practice.',
  coreComponents:['Parts identification (noticing internal voices, feelings, impulses as parts)','Self-energy cultivation (curiosity, compassion, calm, clarity, confidence, courage, creativity, connectedness — the "8 Cs")','Unblending (separating from parts to access Self)','Getting permission from protectors','Witnessing exile experiences','Unburdening (releasing stored pain/beliefs)','Internal dialogue between parts','Direct access (therapist speaks directly to parts)'],
  indications:[
    {dx:'Complex PTSD',evidence:'B',effectSize:'d=0.60-0.85',nnt:'NNT ~3-4',notes:'RCT evidence for PTSD symptom reduction. May be particularly suited for complex trauma with multiple memory systems.'},
    {dx:'Depression',evidence:'B',effectSize:'d=0.50',nnt:'NNT ~5',notes:'Addresses parts that maintain depressive patterns (inner critic, withdrawn parts).'},
    {dx:'Anxiety',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Manager parts that generate anxiety. Self-leadership reduces anxiety.'},
    {dx:'Eating Disorders',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Parts that drive restriction, bingeing, purging as protective strategies.'},
    {dx:'Substance Use',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Firefighter parts use substances. Address underlying exile wounds.'}
  ],
  protocol:{
    format:'Individual (primary). IFS-informed groups available.',
    sessionLength:'50-90 minutes.',
    frequency:'Weekly.',
    totalSessions:'Open-ended. Focal: 12-20 sessions. Complex: 40+.',
    phases:[
      {name:'Parts Mapping',sessions:'1-4',content:'Identify key parts, map their relationships, introduce Self, practice noticing parts vs being blended with them. Psychoeducation on IFS model.'},
      {name:'Building Self-Leadership',sessions:'5-10',content:'Strengthen access to Self, practice unblending, begin negotiating with protective parts (Managers), develop internal communication skills.'},
      {name:'Working with Exiles',sessions:'11+',content:'With protector permission, access exiled parts carrying pain. Witness their experience. Retrieve from past context. Unburden stored pain and beliefs.'},
      {name:'Integration',sessions:'Ongoing',content:'New internal relationships, Self-led decision-making, ongoing parts awareness in daily life.'}
    ],
    homeworkExamples:['Parts journaling (noticing parts activation throughout day)','Self-to-part meditation','Parts mapping drawing','Noticing triggers and which parts respond','Self-compassion practice']
  },
  headToHead:[
    {vs:'EMDR',finding:'Both address trauma. IFS uses internal relationship model; EMDR uses bilateral stimulation. Some clinicians integrate both. Limited direct comparison.',cite:'Comparison limited'},
    {vs:'Somatic Experiencing',finding:'Complementary approaches. IFS more cognitive/relational, SE more body-focused. Often integrated.',cite:'No direct comparison'},
    {vs:'CBT',finding:'Different paradigm. IFS targets internal system dynamics; CBT targets cognitions and behaviors. IFS may be better for clients who find CBT too rational/dismissive of their experience.',cite:'Indirect comparison only'}
  ],
  contraindications:['Active psychosis (parts work may worsen reality testing)','Severe dissociative disorder without stabilization (DID requires modified protocol)','Active suicidality with plan (stabilize first)','Inability to access Self state (severe substance intoxication)'],
  limitations:['Limited RCT evidence compared to CBT/DBT/EMDR','Model can seem esoteric to evidence-focused clinicians','Requires strong therapeutic relationship','Open-ended duration can be costly','"Parts" language may not resonate with all clients','Risk of spiritual bypassing if Self is idealized'],
  trainingRequired:'Licensed clinician + IFS Institute training. Level 1 (6 days), Level 2 (6 days), Level 3 (advanced). Certification process available.',
  certifications:['IFS Institute Certified Therapist','IFS-Informed Practitioner','IFS Institute Certified Trainer'],
  dropoutRate:'15-25%.',
  relapsePrevention:'Self-leadership is ongoing practice. Parts awareness becomes automatic with practice. Return to therapy if significant new material surfaces.',
  modifications:{
    pediatric:'IFS adapted for children through play, art, and sandtray. Simplified parts language. Parental IFS psychoeducation.',
    elderly:'Parts accumulated over lifetime. Life review through IFS lens. Address grief, loss, medical parts.',
    cultural:'Self concept resonates across many spiritual traditions. Parts language adaptable to cultural frameworks.',
    digital:'Telehealth IFS effective. IFS meditation apps available.'
  },
  costPerSession:'$150-350/session.',
  keyCitations:[
    'Schwartz, R.C. & Sweezy, M. (2020). Internal Family Systems Therapy, 2nd ed. Guilford Press.',
    'Hodgdon, H.B. et al. (2022). Internal Family Systems (IFS) therapy for PTSD: A randomized controlled trial. J Trauma Stress, 35(2), 467-479.',
    'Anderson, F.G. et al. (2017). Internal Family Systems Skills Training Manual. PESI.'
  ]
},

'SE': {
  fullName:'Somatic Experiencing',
  family:'Body-Oriented / Trauma',
  developer:'Peter Levine (1997)',
  overview:'Body-oriented trauma therapy based on the premise that trauma is stored in the body as incomplete defensive responses (fight/flight/freeze). SE works with bodily sensations rather than narrative memories to renegotiate trauma. Gradual "titrated" approach avoids overwhelm by pendulating between activation and resource states. Based on observations of how animals in the wild discharge survival energy after threat.',
  coreComponents:['Tracking body sensations (interoception)','Titration (small doses of activation, not flooding)','Pendulation (alternating between activation and resource/calm states)','Completion of defensive responses (fight/flight movements)','Discharge (trembling, shaking, heat, breathing shifts)','Resourcing (building felt sense of safety)','SIBAM model (Sensation, Image, Behavior, Affect, Meaning — tracking five channels)','Containment (managing activation within window of tolerance)'],
  indications:[
    {dx:'PTSD',evidence:'B',effectSize:'d=0.94-1.26 in RCTs',nnt:'NNT ~2-3',notes:'RCT evidence for PTSD symptom reduction. May be preferred for patients who cannot tolerate narrative exposure approaches.'},
    {dx:'Complex PTSD',evidence:'B',effectSize:'Moderate-large',nnt:'NNT ~3-4',notes:'Body-based approach may be advantageous for pre-verbal or complex developmental trauma.'},
    {dx:'Chronic Pain',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Addresses pain-trauma intersection through nervous system regulation.'},
    {dx:'Somatic Symptom Disorders',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Directly addresses body-based symptoms.'},
    {dx:'Anxiety/Panic',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Interoceptive work addresses panic sensations at somatic level.'}
  ],
  protocol:{
    format:'Individual.',
    sessionLength:'50-75 minutes.',
    frequency:'Weekly or biweekly.',
    totalSessions:'Open-ended. Focal trauma: 12-20 sessions. Complex: 40+.',
    phases:[
      {name:'Resourcing',sessions:'1-4',content:'Build body awareness, identify resource states (felt sense of safety, calm, strength), practice grounding, establish containment skills.'},
      {name:'Tracking & Titration',sessions:'5-15',content:'Gently approach activation related to trauma. Track body sensations. Titrate — small doses only. Pendulate between activation and resource. Allow discharge.'},
      {name:'Completion',sessions:'Ongoing',content:'Support completion of thwarted defensive responses (orienting, fleeing, fighting movements). Allow full discharge cycle (trembling, heat, spontaneous movement).'},
      {name:'Integration',sessions:'Ongoing',content:'New body experience integrates. Corrective interoceptive experience. Increased resilience. Expanded window of tolerance.'}
    ],
    homeworkExamples:['Daily body scan (5-10 min)','Grounding exercises','Resourcing practice','Noticing body sensations during daily activities','Gentle movement/walking with body awareness']
  },
  headToHead:[
    {vs:'EMDR',finding:'Both process trauma without extensive verbal narrative. SE is slower/more titrated; EMDR can be faster but more activating. SE may be better tolerated for fragile presentations.',cite:'Limited direct comparison'},
    {vs:'PE',finding:'SE involves less explicit trauma narrative than PE. May be preferred for patients who cannot tolerate prolonged exposure to trauma memories.',cite:'Indirect comparison'},
    {vs:'Sensorimotor Psychotherapy',finding:'Similar body-oriented approaches. SE focuses more on nervous system discharge; Sensorimotor adds more cognitive processing and movement sequences.',cite:'Ogden & Fisher, 2015'}
  ],
  contraindications:['Active psychosis','Severe dissociation without stabilization','Active substance intoxication','Medical conditions where body sensation tracking is contraindicated','Patient with no body awareness and no interest in developing it'],
  limitations:['Limited RCT evidence compared to PE/CPT/EMDR','Mechanism of action debated','Concepts like "discharge" lack strong neurobiological validation','Open-ended treatment can be costly','Requires high therapist skill — poor delivery can retraumatize','Difficult to manualize and study'],
  trainingRequired:'SE Practitioner training through Somatic Experiencing International: 3-year, 12-module program (216+ hours) + supervised practice sessions.',
  certifications:['SEP (Somatic Experiencing Practitioner)','SE Intermediate practitioner','SE Assistant/Faculty designation'],
  dropoutRate:'15-20%.',
  relapsePrevention:'Body awareness becomes ongoing practice. Self-regulation skills generalize. Return for tune-up sessions as needed.',
  modifications:{
    pediatric:'SE adapted for children includes play, movement, and art. Parental nervous system co-regulation emphasized.',
    elderly:'Gentle approach appropriate for elderly. Chair-based. Accommodate physical limitations.',
    cultural:'Body-based approach may bypass cultural barriers to verbal emotional expression. However, touch and body awareness norms vary culturally.',
    digital:'Telehealth SE possible but less effective for body-based work. In-person preferred.'
  },
  costPerSession:'$150-350/session.',
  keyCitations:[
    'Levine, P.A. (2010). In an Unspoken Voice: How the Body Releases Trauma and Restores Goodness. North Atlantic Books.',
    'Brom, D. et al. (2017). Somatic Experiencing for PTSD: A randomized controlled outcome study. J Trauma Stress, 30(3), 304-312.',
    'Payne, P. et al. (2015). Somatic Experiencing: Using interoception and proprioception as core elements of trauma therapy. Front Psychol, 6, Article 93.'
  ]
},

'FBT': {
  fullName:'Family-Based Treatment (Maudsley Approach)',
  family:'Family Systems',
  developer:'Christopher Dare & Ivan Eisler, Maudsley Hospital (1980s), manualized by James Lock & Daniel Le Grange',
  overview:'First-line treatment for adolescent anorexia nervosa. Agnostic about the cause of the eating disorder — parents are NOT blamed. Instead, parents are empowered as the primary resource for refeeding their child. Externalized model: the eating disorder is separate from the adolescent. Three-phase approach moves from parental control of eating to adolescent autonomy.',
  coreComponents:['Externalization of the eating disorder (the illness, not the child)','Parental empowerment for refeeding','Family meal (in-session observation and coaching)','Sibling support','Weight restoration as first priority','Gradual return of autonomy to adolescent','No individual therapy until weight-restored (Phase 1)','Unified parental front'],
  indications:[
    {dx:'Adolescent Anorexia Nervosa',evidence:'A',effectSize:'60-75% achieve full weight restoration',nnt:'NNT ~2',notes:'First-line per NICE, APA, AED. Superior to individual therapy for adolescents. Most evidence-based treatment for this population.'},
    {dx:'Adolescent Bulimia',evidence:'B',effectSize:'d=0.55',nnt:'NNT ~4',notes:'FBT-BN adapted for adolescent bulimia. Evidence growing.'},
    {dx:'ARFID (adolescent)',evidence:'C',effectSize:'Preliminary',nnt:'Under study',notes:'Modified FBT for ARFID in development and testing.'},
    {dx:'Young Adults (18-25)',evidence:'B',effectSize:'Moderate',nnt:'Under study',notes:'FBT adapted for transition-age youth. Parents still involved but role modified.'}
  ],
  protocol:{
    format:'Whole family (parents + patient + siblings). Separated family therapy (SFT) for high-conflict families.',
    sessionLength:'50-60 minutes.',
    frequency:'Weekly (Phase 1). Biweekly (Phase 2). Monthly (Phase 3).',
    totalSessions:'15-20 sessions over 6-12 months.',
    phases:[
      {name:'Phase 1: Refeeding',sessions:'1-10',content:'Parents take full charge of eating. Weight restoration is priority. Session 2: family meal in office — therapist observes and coaches parents. Externalize illness. Unite parents. Support siblings.'},
      {name:'Phase 2: Return of Control',sessions:'11-16',content:'As weight restores and eating normalizes, gradually return food choices to adolescent. Age-appropriate autonomy. Address adolescent developmental issues.'},
      {name:'Phase 3: Adolescent Issues',sessions:'17-20',content:'Healthy weight maintained. Focus on normal adolescent development — identity, autonomy, peer relationships. Relapse prevention. Termination.'}
    ],
    homeworkExamples:['Parents plan and supervise all meals (Phase 1)','Food logs','Weight monitored weekly in session','Family discussions about non-food topics','Gradual meal autonomy experiments (Phase 2)']
  },
  headToHead:[
    {vs:'Individual therapy (adolescent AN)',finding:'FBT superior at end of treatment and 6-12 month follow-up. FBT produces faster weight gain and higher remission rates.',cite:'Lock et al., 2010, Arch Gen Psychiatry'},
    {vs:'CBT-E (adolescent AN)',finding:'Both effective. FBT has more evidence for adolescents. CBT-E may be preferred when family involvement is not possible.',cite:'Dalle Grave et al., 2013'},
    {vs:'AFT (Adolescent-Focused Therapy)',finding:'FBT superior for weight restoration at end of treatment and 6-month follow-up.',cite:'Lock et al., 2010'}
  ],
  contraindications:['Parents unable/unwilling to participate','Active domestic violence or severe abuse','Parent with active eating disorder (untreated)','Young person requires inpatient medical stabilization first','Young person lives independently with no family contact'],
  limitations:['Requires highly involved parents — not possible for all families','Can be stressful for families','High-conflict families may need modified format','Less evidence for adults over 25','Not all adolescents respond (25-40% non-response)','Cultural eating norms may conflict with protocol'],
  trainingRequired:'Licensed clinician + FBT-specific training. Lock & Le Grange workshops. Training Institute for Child and Adolescent Eating Disorders provides certification.',
  certifications:['UCSD Eating Disorder Training Program','Lock & Le Grange certified provider','AED member with FBT training'],
  dropoutRate:'10-20% (lower than many ED treatments due to parental involvement and structure).',
  relapsePrevention:'Parents remain vigilant for signs of relapse. Re-engage quickly. Booster sessions. Transition to individual therapy if age-appropriate.',
  modifications:{
    pediatric:'Designed for adolescents. Modified for younger children (more directive). Modified for young adults (more collaborative).',
    elderly:'Not applicable.',
    cultural:'Adapt family role expectations to cultural norms. Meal composition culturally appropriate. Family structure varies — adapt accordingly.',
    digital:'Telehealth FBT validated during COVID. Family meals observed via video.'
  },
  costPerSession:'$150-350/session. 15-20 sessions = $2,250-7,000.',
  keyCitations:[
    'Lock, J. & Le Grange, D. (2013). Treatment Manual for Anorexia Nervosa: A Family-Based Approach, 2nd ed. Guilford Press.',
    'Lock, J. et al. (2010). Randomized clinical trial comparing FBT with AFT for adolescent AN. Arch Gen Psychiatry, 67(10), 1025-1032.',
    'Couturier, J. et al. (2013). Efficacy of FBT for adolescents with eating disorders: A systematic review and meta-analysis. Int J Eat Disord, 46(1), 3-11.'
  ]
},

'MBSR': {
  fullName:'Mindfulness-Based Stress Reduction',
  family:'Mindfulness',
  developer:'Jon Kabat-Zinn (1979, UMass Medical Center)',
  overview:'Structured 8-week group program teaching mindfulness meditation and yoga for stress, pain, and illness. The original secular mindfulness intervention, developed in a medical setting for patients with chronic conditions that medicine could not fully resolve. Based on Buddhist vipassana meditation adapted for clinical contexts. The foundation upon which MBCT and other mindfulness-based interventions were built.',
  coreComponents:['Body scan meditation','Sitting meditation (breath, body, sounds, thoughts, choiceless awareness)','Mindful yoga (gentle hatha)','Walking meditation','Informal mindfulness (eating, daily activities)','All-day retreat (between weeks 6-7)','Didactic teaching on stress physiology','Group inquiry and discussion'],
  indications:[
    {dx:'Chronic Pain',evidence:'A',effectSize:'d=0.33 for pain intensity; d=0.53 for pain-related distress',nnt:'NNT ~4-5',notes:'Original indication. Improves pain coping and quality of life even when pain persists.'},
    {dx:'Anxiety',evidence:'A',effectSize:'d=0.63 vs control',nnt:'NNT ~4',notes:'Comparable to CBT for GAD in head-to-head trial (Hoge et al., 2023, JAMA Psychiatry).'},
    {dx:'Stress/Burnout',evidence:'A',effectSize:'d=0.50-0.70',nnt:'NNT ~3-4',notes:'Healthcare workers, caregivers, high-stress populations.'},
    {dx:'Depression (current)',evidence:'B',effectSize:'d=0.40',nnt:'NNT ~5',notes:'Moderate for active depression. MBCT (derived from MBSR) stronger for relapse prevention.'},
    {dx:'Cancer-Related Distress',evidence:'A',effectSize:'d=0.58',nnt:'NNT ~4',notes:'Widely implemented in cancer centers. Improves quality of life, mood, and sleep.'},
    {dx:'Insomnia',evidence:'B',effectSize:'d=0.44',nnt:'NNT ~5',notes:'Improves sleep quality. CBT-I still first-line for primary insomnia.'}
  ],
  protocol:{
    format:'Group (15-30 participants). Some individual adaptations.',
    sessionLength:'2.5 hours per week + all-day retreat.',
    frequency:'Weekly × 8 weeks + 1 all-day retreat.',
    totalSessions:'8 weekly sessions + all-day retreat = ~30 hours total.',
    phases:[
      {name:'Weeks 1-2: Body Awareness',sessions:'1-2',content:'Body scan meditation, automatic pilot awareness, mindful eating exercise, introduce sitting meditation.'},
      {name:'Weeks 3-4: Working with Limits',sessions:'3-4',content:'Sitting meditation (breath focus), mindful yoga, pleasant/unpleasant events calendar, stress reactivity awareness.'},
      {name:'Weeks 5-6: Being Present',sessions:'5-6',content:'Expand sitting meditation (body, sounds, thoughts), respond vs react, mindful communication.'},
      {name:'Week 6-7: All-Day Retreat',sessions:'Retreat',content:'Full day of silent practice: sitting, walking, yoga, body scan, eating meditation. Deepening experience.'},
      {name:'Weeks 7-8: Integration',sessions:'7-8',content:'Choiceless awareness meditation, loving-kindness meditation, maintaining practice after program, personal mindfulness plan.'}
    ],
    homeworkExamples:['Daily 45-minute formal practice (guided audio)','Informal mindfulness (one daily activity done mindfully)','Pleasant/unpleasant events calendar','Mindful eating exercise','Stress response awareness log']
  },
  headToHead:[
    {vs:'CBT (for anxiety)',finding:'Non-inferior to CBT for GAD in well-powered RCT (Hoge et al., 2023). Both first-line options.',cite:'Hoge et al., 2023, JAMA Psychiatry'},
    {vs:'MBCT',finding:'MBSR is more general; MBCT specifically targets depression relapse with added cognitive elements. Use MBSR for stress/pain/general wellness; MBCT for recurrent depression.',cite:'Segal et al., 2013'},
    {vs:'Relaxation training',finding:'MBSR superior for sustained benefit. Relaxation reduces arousal; MBSR changes relationship to experience.',cite:'Goyal et al., 2014, JAMA Internal Medicine'}
  ],
  contraindications:['Active psychosis','Active suicidality','Recent major trauma (may need stabilization first)','Active substance dependence (may need treatment first)','Severe depression with inability to engage in practice'],
  limitations:['Time-intensive (45 min/day homework)','Group format not ideal for all','Some participants find meditation aversive initially','Mindfulness can initially increase awareness of distress','Requires certified teacher — quality varies','Insurance coverage variable'],
  trainingRequired:'MBSR teacher training through University of Massachusetts Center for Mindfulness or equivalent. Multi-year pathway: personal practice, teacher training intensive, supervised teaching, certification.',
  certifications:['UMass CFM Certified MBSR Teacher','Brown University Mindfulness Center','Bangor University Centre for Mindfulness (UK)'],
  dropoutRate:'15-25%. Higher when homework commitment is not clear upfront.',
  relapsePrevention:'Daily practice is the relapse prevention. Alumni groups. Annual retreats. Practice is cumulative — effects deepen with continued practice.',
  modifications:{
    pediatric:'Adapted as .b (Mindfulness in Schools). Shorter practices. Age-appropriate language.',
    elderly:'Adapted with chair-based yoga. Slower pace. Address grief, isolation, chronic illness.',
    cultural:'Buddhist origins may concern some. Emphasize secular, medical framing. Adapted for diverse populations (BIPOC, LGBTQ+, veterans).',
    digital:'Online MBSR programs widely available. Palouse Mindfulness (free). Apps: Headspace, Calm, Insight Timer.'
  },
  costPerSession:'$300-700 for full 8-week program. Some insurance covers. Hospital-based programs may be less.',
  keyCitations:[
    'Kabat-Zinn, J. (2013). Full Catastrophe Living, Revised ed. Bantam Books.',
    'Goyal, M. et al. (2014). Meditation programs for psychological stress and well-being: Systematic review and meta-analysis. JAMA Internal Medicine, 174(3), 357-368.',
    'Hoge, E.A. et al. (2023). Mindfulness-based stress reduction vs escitalopram for the treatment of adults with anxiety disorders: JAMA Psychiatry, 80(1), 13-21.'
  ]
},

'SensP': {
  fullName:'Sensorimotor Psychotherapy',
  family:'Body-Oriented / Trauma',
  developer:'Pat Ogden (2006)',
  overview:'Body-oriented trauma therapy integrating somatic processing with cognitive and emotional awareness. Builds on Somatic Experiencing with added emphasis on developmental trauma, attachment, and the role of the body in maintaining psychological patterns. Works within the "window of tolerance" using body-first interventions. Tracks five core organizers of experience: body sensation, five-sense perception, movement/impulse, emotion, and cognition.',
  coreComponents:['Tracking body sensation and impulse in real-time','Window of tolerance model (hyperarousal ↔ hypoarousal)','Core organizers (sensation, perception, movement, emotion, cognition)','Mindfulness of the body','Embedded relational mindfulness','Somatic resources (grounding, centering, alignment)','Sequencing (allowing movements to complete)','Working with developmental missing experiences'],
  indications:[
    {dx:'Complex PTSD',evidence:'B',effectSize:'Moderate-large clinical effects',nnt:'NNT ~3-4',notes:'Particularly suited for developmental/attachment trauma where body holds the story.'},
    {dx:'PTSD',evidence:'B',effectSize:'Emerging RCT evidence',nnt:'Under study',notes:'Body-first approach for patients who cannot engage in narrative exposure.'},
    {dx:'Dissociative Disorders',evidence:'C',effectSize:'Clinical evidence',nnt:'Under study',notes:'Phased approach addresses structural dissociation through body awareness.'},
    {dx:'Attachment Disorders',evidence:'C',effectSize:'Clinical evidence',nnt:'Under study',notes:'Addresses developmental missing experiences (holding, being seen, support) through somatic interventions.'}
  ],
  protocol:{
    format:'Individual.',
    sessionLength:'50-90 minutes.',
    frequency:'Weekly.',
    totalSessions:'Open-ended. 20-40+ sessions typical.',
    phases:[
      {name:'Phase 1: Stabilization',sessions:'1-12',content:'Build somatic resources (grounding, centering, boundaries). Expand window of tolerance. Develop body awareness. Establish safety.'},
      {name:'Phase 2: Trauma Processing',sessions:'12-30',content:'Track trauma-related body patterns. Allow thwarted defensive movements to complete. Process traumatic memories through body. Stay within window of tolerance.'},
      {name:'Phase 3: Integration',sessions:'30+',content:'New body-based self-experience. Address developmental deficits. Relational engagement. Embodied daily life.'}
    ],
    homeworkExamples:['Daily body scan/check-in','Grounding exercises','Noticing body posture and movement patterns','Resourcing practice','Mindful walking']
  },
  headToHead:[
    {vs:'Somatic Experiencing',finding:'Similar body-based paradigm. Sensorimotor adds explicit cognitive/emotional processing and developmental focus. SE focuses more on autonomic discharge.',cite:'Ogden & Fisher, 2015'},
    {vs:'EMDR',finding:'Complementary. Some clinicians integrate Sensorimotor body awareness with EMDR processing.',cite:'Indirect comparison'},
    {vs:'PE/CPT',finding:'Sensorimotor may be preferred when patients cannot tolerate narrative trauma exposure. PE/CPT have stronger RCT evidence.',cite:'Indirect comparison'}
  ],
  contraindications:['Active psychosis','Severe dissociation without stabilization plan','Active suicidality','Medical conditions contraindicating body awareness work','No willingness to attend to body experience'],
  limitations:['Limited RCT evidence','Difficult to manualize and study','Long training pathway','Open-ended treatment can be costly','Requires skilled therapist — poor delivery can destabilize','Less widely available than CBT/EMDR'],
  trainingRequired:'Licensed clinician + Sensorimotor Psychotherapy Institute (SPI) training. Level 1: Trauma (3 modules). Level 2: Attachment (3 modules). Each module ~4 days.',
  certifications:['SPI Certified Sensorimotor Psychotherapist','SPI Level 1 or Level 2 completion','SPI Faculty/Trainer'],
  dropoutRate:'15-20%.',
  relapsePrevention:'Body awareness skills are ongoing. Daily practices continue. Return for additional processing as needed.',
  modifications:{
    pediatric:'Adapted with play and movement. Parental involvement.',
    elderly:'Chair-based modifications. Gentle approach. Address body changes with aging.',
    cultural:'Body awareness norms vary. Touch protocols need cultural sensitivity. Modesty and personal space considerations.',
    digital:'Limited telehealth adaptation. In-person strongly preferred for body-based work.'
  },
  costPerSession:'$150-350/session.',
  keyCitations:[
    'Ogden, P., Minton, K. & Pain, C. (2006). Trauma and the Body: A Sensorimotor Approach to Psychotherapy. W.W. Norton.',
    'Ogden, P. & Fisher, J. (2015). Sensorimotor Psychotherapy: Interventions for Trauma and Attachment. W.W. Norton.',
    'Langmuir, J.I. et al. (2012). Sensorimotor Psychotherapy group therapy in the treatment of complex PTSD. Ann NY Acad Sci, 1271(1), 29-37.'
  ]
}

};

// ─── LOOKUP FUNCTION ───────────────────────────────────────
function findTherapyMonograph(name) {
  if (!name) return null;
  var n = name.toLowerCase();

  // Direct match
  var keys = Object.keys(THERAPY_MONOGRAPHS);
  for (var i = 0; i < keys.length; i++) {
    if (n === keys[i].toLowerCase()) return THERAPY_MONOGRAPHS[keys[i]];
  }

  // Fuzzy map
  var fuzzyMap = {
    'cbt-e': 'CBT-E', 'cbt-e (enhanced': 'CBT-E', 'enhanced cbt': 'CBT-E',
    'cbt-i': 'CBT-I', 'cbt for insomnia': 'CBT-I',
    'cbt': 'CBT', 'cognitive behavioral': 'CBT', 'cognitive behaviour': 'CBT',
    'cbt (worry': 'CBT', 'cbt (exposure + cognitive': 'CBT', 'cbt (interoceptive': 'CBT',
    'cbt (graduated social': 'CBT', 'cbt (graduated exposure': 'CBT',
    'cbt (anger': 'CBT', 'cbt (relapse': 'CBT', 'cbt (gambling': 'CBT',
    'cbt for adhd': 'CBT', 'cbt for bipolar': 'CBT', 'cbt for health': 'CBT',
    'cbt for pmdd': 'CBT', 'cbt for psychosis': 'CBT', 'cbt with in vivo': 'CBT',
    'brief cbt': 'CBT', 'cbt (fnd': 'CBT',
    'cbasp': 'CBT',
    'ipt (interpersonal': 'IPT', 'ipt': 'IPT', 'interpersonal therapy': 'IPT', 'interpersonal': 'IPT',
    'ipsrt': 'IPT', 'interpersonal and social rhythm': 'IPT',
    'erp': 'ERP', 'exposure and response': 'ERP', 'cbt (exposure + response': 'ERP',
    'cbt (erp': 'ERP', 'erp for tics': 'ERP',
    'dbt': 'DBT', 'dialectical': 'DBT', 'dbt adapted': 'DBT', 'dbt (dialectical': 'DBT',
    'emdr': 'EMDR', 'eye movement': 'EMDR',
    'pe (prolonged': 'PE', 'prolonged exposure': 'PE',
    'cpt (cognitive processing': 'CPT', 'cpt': 'CPT', 'cognitive processing': 'CPT',
    'act (acceptance': 'ACT', 'act': 'ACT', 'acceptance and commitment': 'ACT', 'act for ocd': 'ACT',
    'motivational interviewing': 'MI', 'motivational': 'MI',
    'exposure therapy': 'PE', 'in vivo exposure': 'PE',
    'behavioral activation': 'BA',
    'mbct': 'CBT', 'mindfulness-based cbt': 'CBT',
    'schema therapy': 'Schema', 'schema': 'Schema',
    'phase-based treatment': 'CPT', 'phase-oriented trauma': 'CPT',
    'psychoeducation': 'CBT',
    'mbsr': 'MBSR', 'mindfulness-based stress': 'MBSR', 'mindfulness training': 'MBSR', 'mindfulness': 'MBSR',
    'somatic experiencing': 'SE', 'sensorimotor': 'SensP',
    'contingency management': 'MI', 'contingency': 'MI',
    '12-step': 'MI', 'aa/na': 'MI',
    'fbt (family': 'FBT', 'family-based treatment': 'FBT',
    'family psychoeducation': 'CBT',
    'mbt (mentalization': 'MBT', 'mbt': 'MBT', 'mentalization': 'MBT',
    'tfp (transference': 'DBT', 'tfp': 'DBT', 'transference-focused': 'DBT',
    'ifs (internal': 'IFS', 'ifs': 'IFS', 'internal family': 'IFS',
    'problem-solving': 'CBT', 'applied relaxation': 'CBT',
    'grounding techniques': 'DBT', 'grounding': 'DBT',
    'social skills': 'CBT', 'cognitive remediation': 'CBT',
    'group therapy': 'CBT',
    'vret': 'PE', 'virtual reality exposure': 'PE',
    'mantra': 'CBT', 'maudsley': 'CBT',
    'pcit': 'CBT', 'parent-child': 'CBT', 'parent management': 'CBT',
    'collaborative problem': 'CBT',
    'defocused communication': 'CBT',
    'cbit': 'ERP',
    'supportive counseling': 'IPT',
    'theraplay': 'CBT', 'tbri': 'CBT',
    'ddp': 'DBT', 'dyadic developmental': 'DBT',
    'attachment-focused': 'DBT',
    'ga (gamblers': 'MI',
    'speech-language': 'CBT', 'occupational therapy': 'CBT',
    'specialized physiotherapy': 'CBT',
    'applied tension': 'CBT',
    'psychotherapy (trauma': 'CPT',
    'fft': 'CBT', 'functional family': 'CBT',
    'mst': 'CBT', 'multisystemic': 'CBT',
    'aba': 'CBT', 'applied behavior': 'CBT',
    'panic-focused psychodynamic': 'IPT',
    'behavioral exposure': 'CBT'
  };

  var fkeys = Object.keys(fuzzyMap);
  for (var f = 0; f < fkeys.length; f++) {
    var key = fkeys[f];
    // For short keys (3 chars or less), require word boundary match
    if (key.length <= 3) {
      var re = new RegExp('(^|\\W)' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\W|$)', 'i');
      if (re.test(n) && fuzzyMap[key]) return THERAPY_MONOGRAPHS[fuzzyMap[key]];
    } else {
      if (n.indexOf(key) !== -1 && fuzzyMap[key]) return THERAPY_MONOGRAPHS[fuzzyMap[key]];
    }
  }

  return null;
}

if (typeof module !== 'undefined') module.exports = { THERAPY_MONOGRAPHS: THERAPY_MONOGRAPHS, findTherapyMonograph: findTherapyMonograph };
