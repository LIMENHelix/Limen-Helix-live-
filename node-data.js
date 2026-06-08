// ═══════════════════════════════════════════════════════
// NODE CROSS-SUBSTRATE DATA
// Maps neural nodes to clinical, organizational, provider,
// pharmacological, and contemplative dimensions
// ═══════════════════════════════════════════════════════

var NODE_CROSS_SUBSTRATE = {
  'mPFC': {
    fullName: 'Medial Prefrontal Cortex',
    clinical: [
      {dx:'MDD',dir:'hypo',note:'Reduced self-narrative generation, anhedonic withdrawal'},
      {dx:'PTSD',dir:'hypo',note:'Failed fear extinction, impaired safety signaling'},
      {dx:'GAD',dir:'hyper',note:'Perseverative worry, rumination loops'},
      {dx:'BPD',dir:'dysregulated',note:'Unstable self-model, identity diffusion'},
      {dx:'SAD',dir:'hyper',note:'Excessive self-referential monitoring'}
    ],
    organizational: [
      {phase:'P0',note:'Stable leadership narrative, coherent vision'},
      {phase:'P3',note:'Leadership paralysis \u2014 narrative breaks down under threat'},
      {phase:'P8',note:'New narrative formation, strategic pivot identity'}
    ],
    provider: [
      {type:'Psychiatry',note:'SSRI/SNRI prescribing for rumination reduction'},
      {type:'CBT Therapist',note:'Cognitive restructuring of self-narrative'},
      {type:'Psychedelic-Assisted Therapy',note:'Transient mPFC suppression enables remodeling'}
    ],
    pharma: [
      {name:'SSRIs',mechanism:'Normalize hyperactive self-referential loops',evidence:'A'},
      {name:'Psilocybin',mechanism:'Transient DMN/mPFC suppression \u2192 narrative reset',evidence:'B+'},
      {name:'Ketamine',mechanism:'Rapid glutamatergic modulation of mPFC activity',evidence:'A'},
      {name:'TMS (L-DLPFC)',mechanism:'Indirect mPFC modulation via prefrontal connectivity',evidence:'A'}
    ],
    contemplative: [
      {practice:'Mindfulness meditation',mechanism:'Decentering from self-referential thought \u2014 reduces mPFC hyperactivation in rumination',evidence:'A'},
      {practice:'Loving-kindness (Metta)',mechanism:'Shifts mPFC from threat-monitoring to affiliative processing',evidence:'B+'},
      {practice:'Centering Prayer',mechanism:'Surrender of self-narrative \u2014 voluntary mPFC quieting',evidence:'B'},
      {practice:'Journaling / Expressive Writing',mechanism:'Externalizes mPFC content, reduces recursive loop load',evidence:'B+'}
    ]
  },
  'PCC': {
    fullName: 'Posterior Cingulate Cortex',
    clinical: [
      {dx:'MDD',dir:'hyper',note:'Excessive autobiographical rumination, stuck in past'},
      {dx:'PTSD',dir:'hyper',note:'Intrusive memory replay, dissociative anchoring'},
      {dx:'DISSOCIATIVE',dir:'altered',note:'Depersonalization \u2014 self-continuity disruption'},
      {dx:'GAD',dir:'hyper',note:'Future-oriented self-referential worry'}
    ],
    organizational: [
      {phase:'P7',note:'Identity dissolution \u2014 organizational narrative loses coherence'},
      {phase:'P8',note:'Pivot point \u2014 new organizational identity crystallizes'}
    ],
    provider: [
      {type:'Psychedelic-Assisted Therapy',note:'PCC suppression is primary mechanism of ego dissolution'},
      {type:'Meditation Teacher',note:'Sustained PCC deactivation through focused attention'},
      {type:'Narrative Therapist',note:'Reconstruct autobiographical coherence'}
    ],
    pharma: [
      {name:'Psilocybin',mechanism:'Acute PCC/DMN suppression \u2192 autobiographical reset',evidence:'B+'},
      {name:'Ketamine',mechanism:'Rapid modulation of PCC-mPFC connectivity',evidence:'A'},
      {name:'SSRIs',mechanism:'Gradual reduction of ruminative PCC loops',evidence:'A'}
    ],
    contemplative: [
      {practice:'Focused attention meditation',mechanism:'Sustained PCC deactivation through present-moment anchoring',evidence:'A'},
      {practice:'Non-dual awareness (Dzogchen/Advaita)',mechanism:'Direct dissolution of self-referential PCC activity',evidence:'B+'},
      {practice:'Psychedelic ceremony',mechanism:'Acute PCC suppression \u2192 ego dissolution \u2192 narrative rewrite',evidence:'B+'},
      {practice:'Contemplative inquiry (Who am I?)',mechanism:'Recursive self-investigation collapses PCC\'s autobiographical loops',evidence:'B'}
    ]
  },
  'AMYG': {
    fullName: 'Amygdala (Composite)',
    clinical: [
      {dx:'PTSD',dir:'hyper',note:'Overgeneralized threat detection, fear conditioning persistence'},
      {dx:'GAD',dir:'hyper',note:'Tonic threat vigilance, uncertainty intolerance'},
      {dx:'PANIC',dir:'hyper',note:'Catastrophic interoceptive alarm cascade'},
      {dx:'MDD',dir:'hyper',note:'Negative valence bias, sustained negative affect'},
      {dx:'BPD',dir:'dysregulated',note:'Rapid emotional switching, rejection hypersensitivity'}
    ],
    organizational: [
      {phase:'P1',note:'Initial alarm \u2014 market disruption triggers organizational threat detection'},
      {phase:'P3',note:'Fear cascade \u2014 threat signal dominates all decision-making'},
      {phase:'P9',note:'Cascade failure \u2014 amygdala-driven panic across stakeholders'}
    ],
    provider: [
      {type:'Trauma Therapist (EMDR/PE)',note:'Reconsolidation and extinction protocols'},
      {type:'Psychiatry',note:'Anxiolytic and SSRI management for amygdala reactivity'},
      {type:'Crisis Counselor',note:'Acute stabilization of fear response'}
    ],
    pharma: [
      {name:'SSRIs',mechanism:'Downregulate amygdala reactivity over 4-6 weeks',evidence:'A'},
      {name:'Benzodiazepines',mechanism:'GABA-mediated acute amygdala suppression',evidence:'A'},
      {name:'Propranolol',mechanism:'Block reconsolidation of fear memories',evidence:'B+'},
      {name:'MDMA',mechanism:'Reduce amygdala threat response while maintaining emotional access',evidence:'B+'}
    ],
    contemplative: [
      {practice:'Breath-focused meditation',mechanism:'Vagal afferent pathway dampens amygdala reactivity via insula-prefrontal loop',evidence:'A'},
      {practice:'RAIN technique',mechanism:'Recognize-Allow-Investigate-Nurture \u2014 metacognitive reappraisal reduces amygdala firing',evidence:'B+'},
      {practice:'Compassion meditation',mechanism:'Shifts amygdala from threat to affiliative processing via oxytocin circuits',evidence:'B+'},
      {practice:'Somatic tracking',mechanism:'Befriending body sensations reduces amygdala\'s interoceptive alarm signal',evidence:'B'}
    ]
  },
  'BLA': {
    fullName: 'Basolateral Amygdala',
    clinical: [
      {dx:'PTSD',dir:'hyper',note:'Overgeneralized threat encoding, fear conditioning'},
      {dx:'GAD',dir:'hyper',note:'Tonic threat vigilance, uncertainty intolerance'},
      {dx:'PANIC',dir:'hyper',note:'Catastrophic interoceptive misappraisal'},
      {dx:'SPECIFIC_PHOBIA',dir:'hyper',note:'Stimulus-locked fear association'},
      {dx:'MDD',dir:'hyper',note:'Negative valence bias, anhedonia via reward suppression'}
    ],
    organizational: [
      {phase:'P1',note:'Initial alarm \u2014 market disruption triggers organizational threat detection'},
      {phase:'P3',note:'Fear cascade \u2014 threat signal dominates decision-making'},
      {phase:'P9',note:'Cascade failure \u2014 amygdala-driven panic across stakeholders'}
    ],
    provider: [
      {type:'Trauma Therapist (EMDR/PE)',note:'Reconsolidation and extinction protocols'},
      {type:'Psychiatry',note:'Anxiolytic and SSRI management'},
      {type:'Crisis Counselor',note:'Acute stabilization of fear response'}
    ],
    pharma: [
      {name:'SSRIs',mechanism:'Downregulate amygdala reactivity over 4-6 weeks',evidence:'A'},
      {name:'Benzodiazepines',mechanism:'GABA-mediated acute amygdala suppression',evidence:'A'},
      {name:'Propranolol',mechanism:'Block reconsolidation of fear memories',evidence:'B+'},
      {name:'D-Cycloserine',mechanism:'NMDA partial agonist \u2014 enhance extinction learning',evidence:'B'}
    ],
    contemplative: [
      {practice:'Exposure-based mindfulness',mechanism:'Sustained attention to feared stimuli without reactivity \u2014 extinction learning via BLA reconsolidation',evidence:'B+'},
      {practice:'Tonglen (giving and receiving)',mechanism:'Transforms threat-encoded stimuli into compassion objects \u2014 BLA valence reassignment',evidence:'B'},
      {practice:'Yoga Nidra',mechanism:'Systematic desensitization of BLA-encoded body threat maps',evidence:'B'},
      {practice:'Chanting / Mantra repetition',mechanism:'Rhythmic auditory-vagal activation dampens BLA tonic firing',evidence:'B'}
    ]
  },
  'CeA': {
    fullName: 'Central Nucleus of the Amygdala',
    clinical: [
      {dx:'PTSD',dir:'hyper',note:'Autonomic fear output amplification \u2014 drives freeze/fight/flight cascades'},
      {dx:'PANIC',dir:'hyper',note:'Brainstem alarm relay \u2014 triggers acute autonomic storm'},
      {dx:'GAD',dir:'hyper',note:'Sustained anxious arousal via hypothalamic/PAG projections'},
      {dx:'ADDICTION',dir:'dysregulated',note:'CeA-driven negative reinforcement \u2014 withdrawal-induced anxiety'}
    ],
    organizational: [
      {phase:'P3',note:'Fear output \u2014 translates threat detection into organizational panic behaviors'},
      {phase:'P7a',note:'Terminal alarm \u2014 CeA-equivalent drives irreversible defensive actions'},
      {phase:'P9',note:'Cascade relay \u2014 amplifies distress signals to all downstream systems'}
    ],
    provider: [
      {type:'Trauma Therapist',note:'Reduce CeA output through upstream BLA extinction protocols'},
      {type:'Psychiatry',note:'GABAergic and serotonergic modulation of CeA tone'},
      {type:'Addiction Medicine',note:'CeA-driven withdrawal anxiety management'}
    ],
    pharma: [
      {name:'Benzodiazepines',mechanism:'Direct GABA-A modulation of CeA output neurons',evidence:'A'},
      {name:'CRF Antagonists',mechanism:'Block CRF signaling from CeA to BNST/PAG (experimental)',evidence:'C'},
      {name:'SSRIs',mechanism:'Indirect CeA modulation via serotonergic afferents',evidence:'A'},
      {name:'Nalmefene',mechanism:'Opioid modulation of CeA-driven negative affect',evidence:'B'}
    ],
    contemplative: [
      {practice:'Polyvagal-informed breathwork',mechanism:'Ventral vagal activation counterbalances CeA autonomic output',evidence:'B+'},
      {practice:'Progressive muscle relaxation',mechanism:'Proprioceptive feedback loop reduces CeA-driven muscular tension cascade',evidence:'B+'},
      {practice:'Body scan meditation',mechanism:'Top-down interoceptive awareness modulates CeA autonomic relay',evidence:'B'},
      {practice:'Havening touch',mechanism:'Somatosensory input may dampen CeA output via delta-wave induction',evidence:'C'}
    ]
  },
  'AI': {
    fullName: 'Anterior Insula',
    clinical: [
      {dx:'GAD',dir:'hyper',note:'Amplified interoceptive prediction error'},
      {dx:'PANIC',dir:'hyper',note:'Catastrophic body-signal misinterpretation'},
      {dx:'PTSD',dir:'hyper',note:'Hypervigilant somatic awareness'},
      {dx:'SOMATIC_SYMPTOM',dir:'hyper',note:'Amplified body sensation without organic cause'},
      {dx:'ANOREXIA',dir:'altered',note:'Distorted interoceptive body model'}
    ],
    organizational: [
      {phase:'P1',note:'Disruption detection \u2014 early warning signals from market interoception'},
      {phase:'P5',note:'Sustained vigilance \u2014 organizational hyperawareness of threats'}
    ],
    provider: [
      {type:'Somatic Therapist',note:'Interoceptive recalibration and body awareness'},
      {type:'Biofeedback Provider',note:'HRV training to modulate insular activation'},
      {type:'Interoceptive Exposure Specialist',note:'Graduated somatic desensitization'}
    ],
    pharma: [
      {name:'SSRIs',mechanism:'Reduce interoceptive prediction error signaling',evidence:'A'},
      {name:'Gabapentin',mechanism:'Dampen somatic hyperarousal pathways',evidence:'B'},
      {name:'Beta-Blockers',mechanism:'Reduce peripheral signals feeding insular processing',evidence:'B'},
      {name:'Mindfulness-Based Interventions',mechanism:'Shift insular processing from reactive to observational',evidence:'B+'}
    ],
    contemplative: [
      {practice:'Vipassana body scanning',mechanism:'Trains equanimous observation of interoceptive signals \u2014 reduces insular prediction error',evidence:'A'},
      {practice:'Breathwork (coherent breathing)',mechanism:'HRV entrainment modulates insular interoceptive gain',evidence:'B+'},
      {practice:'Tai Chi / Qigong',mechanism:'Slow movement recalibrates insular body-model predictions',evidence:'B+'},
      {practice:'Floating / sensory deprivation',mechanism:'Minimal exteroceptive input reveals and recalibrates insular baseline',evidence:'B'}
    ]
  },
  'dACC': {
    fullName: 'Dorsal Anterior Cingulate Cortex',
    clinical: [
      {dx:'OCD',dir:'hyper',note:'Error monitoring overdrive \u2014 "something is wrong" signal'},
      {dx:'GAD',dir:'hyper',note:'Excessive conflict detection, uncertainty intolerance'},
      {dx:'PTSD',dir:'hyper',note:'Threat-vigilance error signaling'},
      {dx:'ADHD',dir:'hypo',note:'Insufficient conflict monitoring, poor error correction'},
      {dx:'MDD',dir:'altered',note:'Blunted error signaling, reduced motivation'}
    ],
    organizational: [
      {phase:'P5',note:'Sustained monitoring \u2014 compliance burden, quality control fatigue'},
      {phase:'P6',note:'Executive control engagement \u2014 governance frameworks activated'}
    ],
    provider: [
      {type:'OCD Specialist (ERP)',note:'Habituate error signal through exposure'},
      {type:'Neurofeedback Provider',note:'Train ACC activation patterns'},
      {type:'CBT Therapist',note:'Reappraisal of error/conflict signals'}
    ],
    pharma: [
      {name:'SSRIs/SNRIs',mechanism:'Reduce hyperactive error monitoring in OCD/GAD',evidence:'A'},
      {name:'NAC',mechanism:'Glutamate modulation of ACC circuitry',evidence:'B'},
      {name:'Stimulants',mechanism:'Increase ACC engagement in ADHD hypoactivation',evidence:'A'},
      {name:'TMS',mechanism:'Direct modulation of dorsomedial PFC/ACC',evidence:'B+'}
    ],
    contemplative: [
      {practice:'Open monitoring meditation',mechanism:'Reduces dACC error-signal reactivity by training non-judgmental awareness of conflict',evidence:'A'},
      {practice:'Acceptance and Commitment (ACT exercises)',mechanism:'Defusion from "something is wrong" signal \u2014 dACC learns to detect without escalating',evidence:'B+'},
      {practice:'Labeling practice (noting)',mechanism:'Naming emotions/sensations recruits vlPFC to modulate dACC alarm',evidence:'B+'},
      {practice:'Contemplative walking',mechanism:'Sustained low-conflict focused attention recalibrates dACC baseline',evidence:'B'}
    ]
  },
  'dlPFC': {
    fullName: 'Dorsolateral Prefrontal Cortex',
    clinical: [
      {dx:'MDD',dir:'hypo',note:'Reduced executive function, poor concentration, psychomotor slowing'},
      {dx:'ADHD',dir:'hypo',note:'Working memory deficits, poor sustained attention'},
      {dx:'SCHIZOPHRENIA',dir:'hypo',note:'Cognitive deficits, disorganized thinking'},
      {dx:'PTSD',dir:'hypo',note:'Impaired top-down regulation of fear circuits'}
    ],
    organizational: [
      {phase:'P6',note:'Executive dominance \u2014 restructuring, governance, strategic control'},
      {phase:'P3',note:'Executive suppression \u2014 fear overrides rational decision-making'}
    ],
    provider: [
      {type:'TMS Clinic',note:'FDA-cleared direct L-DLPFC stimulation for MDD'},
      {type:'Cognitive Rehabilitation',note:'Executive function training protocols'},
      {type:'Neuropsychology',note:'Working memory and attention assessment'}
    ],
    pharma: [
      {name:'TMS',mechanism:'Direct electromagnetic activation of L-DLPFC',evidence:'A'},
      {name:'Stimulants',mechanism:'Dopaminergic/noradrenergic dlPFC enhancement',evidence:'A'},
      {name:'Bupropion',mechanism:'Norepinephrine-dopamine reuptake inhibition',evidence:'A'},
      {name:'Modafinil',mechanism:'Wakefulness-promoting dlPFC engagement',evidence:'B+'}
    ],
    contemplative: [
      {practice:'Concentration meditation (Samatha)',mechanism:'Sustained attention training directly engages and strengthens dlPFC circuits',evidence:'A'},
      {practice:'Chess / strategic contemplation',mechanism:'Working memory and planning demands recruit dlPFC',evidence:'B'},
      {practice:'Cognitive reappraisal practice',mechanism:'Deliberate reframing exercises build dlPFC regulatory capacity over amygdala',evidence:'A'},
      {practice:'Study and memorization (Lectio Divina)',mechanism:'Deep reading with working memory engagement strengthens dlPFC',evidence:'B'}
    ]
  },
  'HIPP': {
    fullName: 'Hippocampus',
    clinical: [
      {dx:'PTSD',dir:'hypo',note:'Context encoding failure \u2014 past/present confusion'},
      {dx:'MDD',dir:'hypo',note:'Volume reduction, impaired neurogenesis'},
      {dx:'GAD',dir:'hypo',note:'Impaired safety learning, failed extinction'},
      {dx:'ALZHEIMERS',dir:'hypo',note:'Progressive atrophy, memory consolidation failure'}
    ],
    organizational: [
      {phase:'P10',note:'Remodeling \u2014 new learning, organizational memory reconsolidation'},
      {phase:'P4',note:'Context recovery \u2014 re-establishing situational awareness'}
    ],
    provider: [
      {type:'Trauma-Focused CBT',note:'Contextual processing of traumatic memories'},
      {type:'Memory Clinic / Neuropsychology',note:'Hippocampal-dependent memory assessment'},
      {type:'Exercise Physiologist',note:'Aerobic protocols for hippocampal neurogenesis'}
    ],
    pharma: [
      {name:'SSRIs',mechanism:'Promote hippocampal neurogenesis via BDNF',evidence:'A'},
      {name:'Exercise Protocols',mechanism:'Most potent hippocampal neurogenesis intervention',evidence:'A'},
      {name:'Memantine',mechanism:'NMDA modulation for neuroprotection',evidence:'B+'},
      {name:'Lion\'s Mane',mechanism:'NGF stimulation, hippocampal support',evidence:'B'}
    ],
    contemplative: [
      {practice:'Walking meditation in nature',mechanism:'Spatial navigation + mindfulness \u2014 dual hippocampal engagement promotes neurogenesis',evidence:'A'},
      {practice:'Memory palace / visualization',mechanism:'Deliberate spatial-episodic encoding strengthens hippocampal pattern separation',evidence:'B+'},
      {practice:'Gratitude journaling',mechanism:'Positive memory reconsolidation via hippocampal reactivation',evidence:'B+'},
      {practice:'Dream journaling',mechanism:'Hippocampal replay during sleep \u2014 conscious engagement with consolidation process',evidence:'B'}
    ]
  },
  'BNST': {
    fullName: 'Bed Nucleus of Stria Terminalis',
    clinical: [
      {dx:'GAD',dir:'hyper',note:'Sustained anxiety generator \u2014 chronic dread without clear trigger'},
      {dx:'PTSD',dir:'hyper',note:'Tonic hypervigilance, anticipatory threat'},
      {dx:'PANIC',dir:'hyper',note:'Anticipatory anxiety between attacks'},
      {dx:'SAD',dir:'hyper',note:'Sustained social threat apprehension'}
    ],
    organizational: [
      {phase:'P3',note:'Chronic dread signal \u2014 workforce anxiety without specific trigger'},
      {phase:'P5',note:'Sustained endurance strain \u2014 persistent low-grade organizational fear'}
    ],
    provider: [
      {type:'Anxiety Specialist',note:'Distinguish BNST-driven sustained anxiety from acute fear'},
      {type:'Behavioral Therapist',note:'Uncertainty tolerance training'},
      {type:'DBS Researcher',note:'BNST is emerging deep brain stimulation target'}
    ],
    pharma: [
      {name:'SSRIs',mechanism:'Reduce tonic BNST activation over 4-8 weeks',evidence:'A'},
      {name:'Buspirone',mechanism:'5-HT1A partial agonist \u2014 anxiolytic without sedation',evidence:'B+'},
      {name:'Pregabalin',mechanism:'Reduce BNST-mediated anticipatory anxiety',evidence:'B+'},
      {name:'CRF Antagonists',mechanism:'Block CRF signaling in BNST (experimental)',evidence:'C'}
    ],
    contemplative: [
      {practice:'Uncertainty tolerance meditation',mechanism:'Sitting with "not knowing" \u2014 trains BNST to tolerate ambiguity without escalating',evidence:'B+'},
      {practice:'Yoga Nidra (body rotation)',mechanism:'Systematic relaxation overrides BNST tonic arousal signal',evidence:'B+'},
      {practice:'Philosophical inquiry (Stoic premeditatio)',mechanism:'Deliberate anticipation practice recalibrates BNST threat threshold',evidence:'B'},
      {practice:'Vagal toning (cold exposure / humming)',mechanism:'Parasympathetic activation counterbalances BNST sympathetic output',evidence:'B'}
    ]
  },
  'PAG': {
    fullName: 'Periaqueductal Gray',
    clinical: [
      {dx:'PTSD',dir:'hyper',note:'Freeze/shutdown response, tonic immobility'},
      {dx:'PANIC',dir:'hyper',note:'Suffocation alarm, acute defensive cascade'},
      {dx:'DISSOCIATIVE',dir:'altered',note:'Dorsal PAG-mediated depersonalization/shutdown'},
      {dx:'CHRONIC_PAIN',dir:'altered',note:'Descending pain modulation failure'}
    ],
    organizational: [
      {phase:'P7a',note:'Terminal freeze \u2014 organizational shutdown, decision paralysis'},
      {phase:'P9',note:'Collapse cascade \u2014 system-wide defensive shutdown'}
    ],
    provider: [
      {type:'Somatic Experiencing Therapist',note:'Discharge frozen survival energy'},
      {type:'Pain Specialist',note:'Descending modulation pathway interventions'},
      {type:'Crisis Intervention',note:'Acute freeze/shutdown management'}
    ],
    pharma: [
      {name:'Ketamine',mechanism:'Rapid PAG modulation, dissociative analgesia',evidence:'A'},
      {name:'Naltrexone (Low-Dose)',mechanism:'Opioid system recalibration for PAG tone',evidence:'B'},
      {name:'EMDR',mechanism:'Reprocess PAG-locked traumatic freeze states',evidence:'A'},
      {name:'Prazosin',mechanism:'Alpha-1 blockade \u2014 reduce PAG-mediated nightmares',evidence:'B+'}
    ],
    contemplative: [
      {practice:'Somatic Experiencing (pendulation)',mechanism:'Oscillate between activation and safety \u2014 discharges PAG-locked freeze energy',evidence:'B+'},
      {practice:'Tremoring / TRE',mechanism:'Neurogenic tremor releases PAG-mediated tonic immobility',evidence:'B'},
      {practice:'Ecstatic dance',mechanism:'Voluntary movement overrides dorsal PAG freeze state via ventral PAG activation',evidence:'B'},
      {practice:'Vocal toning / singing',mechanism:'Laryngeal-vagal activation engages ventral PAG analgesic pathways',evidence:'B'}
    ]
  },
  'HPA': {
    fullName: 'Hypothalamic-Pituitary-Adrenal Axis',
    clinical: [
      {dx:'MDD',dir:'dysregulated',note:'Cortisol rhythm disruption, HPA non-suppression'},
      {dx:'PTSD',dir:'hyper',note:'Sensitized stress response, low-threshold activation'},
      {dx:'GAD',dir:'hyper',note:'Chronic cortisol elevation, allostatic load'},
      {dx:'BURNOUT',dir:'hyper',note:'HPA exhaustion from sustained activation'},
      {dx:'PSYCHOTIC_DEPRESSION',dir:'hyper',note:'Extreme HPA dysregulation with cortisol toxicity'}
    ],
    organizational: [
      {phase:'P3',note:'Stress cascade \u2014 financial distress activates organizational cortisol equivalent'},
      {phase:'P5',note:'Allostatic load \u2014 sustained operational stress erodes capacity'},
      {phase:'P9',note:'Collapse threshold \u2014 HPA-equivalent system failure'}
    ],
    provider: [
      {type:'Endocrinology',note:'Cortisol testing, adrenal function assessment'},
      {type:'Integrative Medicine',note:'Adaptogenic and lifestyle interventions'},
      {type:'Stress Management',note:'HRV biofeedback, sleep hygiene protocols'}
    ],
    pharma: [
      {name:'SSRIs',mechanism:'Normalize HPA axis feedback sensitivity over weeks',evidence:'A'},
      {name:'Mifepristone',mechanism:'Glucocorticoid receptor antagonist for psychotic depression',evidence:'B+'},
      {name:'Ashwagandha',mechanism:'Adaptogenic cortisol modulation',evidence:'B'},
      {name:'Phosphatidylserine',mechanism:'Blunt cortisol response to stress',evidence:'B'}
    ],
    contemplative: [
      {practice:'Mindfulness-Based Stress Reduction (MBSR)',mechanism:'8-week protocol shown to reduce salivary cortisol and normalize diurnal HPA rhythm',evidence:'A'},
      {practice:'Restorative yoga',mechanism:'Sustained parasympathetic postures reduce cortisol output via hypothalamic modulation',evidence:'B+'},
      {practice:'Forest bathing (Shinrin-yoku)',mechanism:'Nature immersion reduces cortisol, blood pressure, and sympathetic tone',evidence:'B+'},
      {practice:'Sleep hygiene rituals',mechanism:'Consistent wind-down practice restores cortisol circadian rhythm',evidence:'A'}
    ]
  },
  'vmPFC': {
    fullName: 'Ventromedial Prefrontal Cortex',
    clinical: [
      {dx:'PTSD',dir:'hypo',note:'Failed fear extinction \u2014 cannot generate safety signals to inhibit amygdala'},
      {dx:'MDD',dir:'hypo',note:'Impaired reward valuation and positive affect generation'},
      {dx:'PSYCHOPATHY',dir:'hypo',note:'Reduced empathic concern, impaired moral reasoning'},
      {dx:'OCD',dir:'hypo',note:'Cannot generate "safe enough" signal to terminate checking'},
      {dx:'BPD',dir:'dysregulated',note:'Unstable value computation, shifting moral/emotional judgments'}
    ],
    organizational: [
      {phase:'P0',note:'Value coherence \u2014 stable organizational ethics and reward computation'},
      {phase:'P3',note:'Value collapse \u2014 moral shortcuts under financial pressure'},
      {phase:'P8',note:'Value reconstruction \u2014 new ethical framework after crisis'}
    ],
    provider: [
      {type:'Trauma Therapist (PE/CPT)',note:'Rebuild extinction pathways via vmPFC-amygdala connectivity'},
      {type:'Moral Injury Specialist',note:'Repair vmPFC-mediated value/meaning systems'},
      {type:'Psychedelic-Assisted Therapy',note:'vmPFC reset enables new safety learning'}
    ],
    pharma: [
      {name:'D-Cycloserine',mechanism:'NMDA partial agonist enhances vmPFC extinction consolidation',evidence:'B+'},
      {name:'SSRIs',mechanism:'Strengthen vmPFC-amygdala inhibitory pathway over weeks',evidence:'A'},
      {name:'Ketamine',mechanism:'Rapid vmPFC plasticity \u2192 new safety learning window',evidence:'B+'},
      {name:'Oxytocin (intranasal)',mechanism:'Enhance vmPFC social-safety signaling',evidence:'B'}
    ],
    contemplative: [
      {practice:'Self-compassion meditation',mechanism:'Activates vmPFC safety-signaling pathways \u2014 generates internal "safe enough" signal',evidence:'B+'},
      {practice:'Forgiveness practice',mechanism:'vmPFC recomputes value of transgressor \u2014 releases amygdala-held grudge activation',evidence:'B'},
      {practice:'Values clarification exercise',mechanism:'Deliberate engagement with vmPFC value-computation circuitry',evidence:'B'},
      {practice:'Gratitude meditation',mechanism:'Positive reward revaluation via vmPFC-striatal connectivity',evidence:'B+'}
    ]
  },
  'TPJ': {
    fullName: 'Temporoparietal Junction',
    clinical: [
      {dx:'AUTISM_SPECTRUM',dir:'hypo',note:'Impaired theory of mind \u2014 difficulty modeling others\' mental states'},
      {dx:'SCHIZOPHRENIA',dir:'altered',note:'Self-other boundary confusion, auditory hallucinations'},
      {dx:'DISSOCIATIVE',dir:'altered',note:'Out-of-body experiences via TPJ disruption'},
      {dx:'PTSD',dir:'altered',note:'Dissociative subtype \u2014 depersonalization, altered self-other boundary'},
      {dx:'BPD',dir:'dysregulated',note:'Unstable mentalizing \u2014 oscillates between hyper and hypo empathy'}
    ],
    organizational: [
      {phase:'P0',note:'Stakeholder empathy \u2014 accurate modeling of client/employee mental states'},
      {phase:'P3',note:'Empathy collapse \u2014 leadership loses ability to model stakeholder perspectives'},
      {phase:'P6',note:'Perspective-taking recovery \u2014 restructuring requires accurate theory of mind'}
    ],
    provider: [
      {type:'Social Skills Therapist',note:'Mentalization-based interventions for TPJ training'},
      {type:'Neuropsychology',note:'Theory of mind assessment, perspective-taking evaluation'},
      {type:'Family Therapist',note:'Rebuild mentalization capacity in relational context'}
    ],
    pharma: [
      {name:'Oxytocin (intranasal)',mechanism:'Enhance TPJ-mediated social cognition and empathic accuracy',evidence:'B'},
      {name:'Psilocybin',mechanism:'TPJ activation during peak experience \u2192 enhanced connectedness',evidence:'B+'},
      {name:'MDMA',mechanism:'Increased empathic accuracy via TPJ-mPFC enhancement',evidence:'B+'},
      {name:'TMS (R-TPJ)',mechanism:'Direct modulation of perspective-taking circuitry',evidence:'B'}
    ],
    contemplative: [
      {practice:'Tonglen (giving and receiving)',mechanism:'Deliberate perspective-switching trains TPJ mentalizing circuitry',evidence:'B+'},
      {practice:'Loving-kindness toward difficult persons',mechanism:'Extends TPJ empathic modeling to aversive social targets',evidence:'B+'},
      {practice:'Dialogue practice (Buber\'s I-Thou)',mechanism:'Genuine encounter activates TPJ mutual mentalizing',evidence:'B'},
      {practice:'Contemplative storytelling / Narrative empathy',mechanism:'Imagining others\' inner life strengthens TPJ simulation networks',evidence:'B'}
    ]
  },
  'LC': {
    fullName: 'Locus Coeruleus',
    clinical: [
      {dx:'PTSD',dir:'hyper',note:'Noradrenergic storm \u2014 hyperarousal, startle, insomnia, flashbacks'},
      {dx:'PANIC',dir:'hyper',note:'Acute norepinephrine surge triggers panic cascade'},
      {dx:'GAD',dir:'hyper',note:'Tonic noradrenergic hypervigilance'},
      {dx:'ADHD',dir:'dysregulated',note:'Phasic LC dysfunction \u2014 poor signal-to-noise in attention'},
      {dx:'ALZHEIMERS',dir:'hypo',note:'Early LC degeneration \u2014 precedes cortical pathology'}
    ],
    organizational: [
      {phase:'P1',note:'Alert signal \u2014 LC-equivalent first-responder activation across organization'},
      {phase:'P3',note:'Noradrenergic flood \u2014 sustained alarm erodes decision quality'},
      {phase:'P10',note:'Arousal recalibration \u2014 new baseline vigilance after crisis'}
    ],
    provider: [
      {type:'Psychiatry',note:'Alpha-adrenergic management for hyperarousal'},
      {type:'Sleep Medicine',note:'LC-driven insomnia assessment and intervention'},
      {type:'ADHD Specialist',note:'Optimize LC phasic/tonic balance for attention'}
    ],
    pharma: [
      {name:'Prazosin',mechanism:'Alpha-1 blockade \u2014 reduce LC-driven nightmares and hyperarousal',evidence:'B+'},
      {name:'Clonidine/Guanfacine',mechanism:'Alpha-2 agonist \u2014 reduce LC tonic firing rate',evidence:'A'},
      {name:'Stimulants',mechanism:'Optimize LC phasic firing for ADHD attention regulation',evidence:'A'},
      {name:'Propranolol',mechanism:'Beta-blockade of peripheral LC-norepinephrine effects',evidence:'B+'}
    ],
    contemplative: [
      {practice:'Slow diaphragmatic breathing (4-7-8)',mechanism:'Vagal afferents inhibit LC firing rate via NTS relay \u2014 direct arousal reduction',evidence:'A'},
      {practice:'Yoga (slow, restorative)',mechanism:'Sustained parasympathetic activation downregulates LC tonic output',evidence:'B+'},
      {practice:'Progressive relaxation (Jacobson)',mechanism:'Systematic muscle release reduces proprioceptive LC activation',evidence:'B+'},
      {practice:'Nature immersion (silence)',mechanism:'Low sensory load allows LC tonic firing to normalize toward baseline',evidence:'B'}
    ]
  }
};

// Node full names for deep-dive fallback
var NODE_FULL_NAMES = {
  'mPFC':'Medial Prefrontal Cortex','BLA':'Basolateral Amygdala','AI':'Anterior Insula',
  'PCC':'Posterior Cingulate Cortex','dACC':'Dorsal Anterior Cingulate','HPA':'HPA Axis',
  'dlPFC':'Dorsolateral Prefrontal Cortex','HIPP':'Hippocampus','BNST':'Bed Nucleus Stria Terminalis',
  'PAG':'Periaqueductal Gray','CeA':'Central Amygdala','vmPFC':'Ventromedial PFC',
  'TPJ':'Temporoparietal Junction','LC':'Locus Coeruleus','AMYG':'Amygdala (Composite)',
  'DMN':'Default Mode Network','SN':'Salience Network','ECN':'Executive Control Network',
  'VV':'Ventral Vagal','DV':'Dorsal Vagal','NAcc':'Nucleus Accumbens'
};
