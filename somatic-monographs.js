// ═══════════════════════════════════════════════════════════════
// LIMEN HELIX — SOMATIC MONOGRAPH DATABASE
// Clinical reference for somatic/physiological interventions.
// Not a substitute for clinical training or supervision.
// ═══════════════════════════════════════════════════════════════

var SOMATIC_MONOGRAPHS = {

'Exercise': {
  fullName:'Structured Exercise Therapy',
  category:'Movement',
  overview:'Systematic physical activity prescribed at specific frequency, intensity, and duration for mental health outcomes. Aerobic exercise increases BDNF expression, reduces cortisol, enhances hippocampal neurogenesis, and modulates DMN connectivity. Resistance training has independent antidepressant effects via IGF-1 and myokine signaling.',
  mechanism:'Increases BDNF → hippocampal neurogenesis. Reduces HPA axis reactivity → lower basal cortisol. Enhances monoamine transmission (5-HT, DA, NE). Reduces systemic inflammation (IL-6, TNF-α). Improves DMN-executive coupling. Opioidergic activation. Increases GABAergic tone.',
  neuralTargets:['Hippocampus (neurogenesis)','HPA axis (cortisol regulation)','VTA-NAc dopamine circuit','Prefrontal cortex (BDNF-mediated)','DMN-salience coupling','Vagal tone'],
  indications:[
    {dx:'MDD',evidence:'A',effectSize:'d=0.72 vs control',notes:'Comparable to SSRIs mild-moderate. Blumenthal (2007): exercise = sertraline at 16wk; superior relapse prevention at 10mo.'},
    {dx:'GAD',evidence:'A',effectSize:'d=0.48',notes:'Herring et al. (2010) meta-analysis.'},
    {dx:'PTSD',evidence:'B',effectSize:'d=0.35-0.62',notes:'Adjunctive. Reduces hyperarousal specifically.'},
    {dx:'ADHD',evidence:'B',effectSize:'d=0.32-0.58',notes:'Acute aerobic improves executive function 1-2h. Hoza et al. (2015).'},
    {dx:'Schizophrenia',evidence:'B',effectSize:'d=0.33 symptoms; d=0.43 cognition',notes:'Firth et al. (2017). Hippocampal volume increase.'},
    {dx:'Insomnia',evidence:'A',effectSize:'d=0.47',notes:'Moderate aerobic, not within 2h of bedtime.'},
    {dx:'Cognitive Decline Prevention',evidence:'A',effectSize:'RR 0.72 for dementia',notes:'150 min/wk moderate. Strongest modifiable risk factor.'}
  ],
  protocol:{format:'Individual or group.',prescription:'Aerobic: 150 min/wk moderate OR 75 min/wk vigorous. Resistance: 2x/wk. Depression: min 3x/wk, 30-45 min, 60-80% max HR.',rampUp:'Sedentary: start 10 min/day, +10%/wk.',frequency:'3-5x/week',duration:'Acute: single session. Structural changes: 8-12 weeks.',monitoring:'RPE scale. HR monitoring. PHQ-9/GAD-7 monthly.'},
  contraindications:['Unstable cardiac disease','Acute musculoskeletal injury','Active intoxication','Exercise addiction in eating disorder context'],
  sideEffects:['Musculoskeletal soreness','Overtraining syndrome','Injury risk'],
  headToHead:[
    {vs:'SSRIs (MDD)',finding:'Equivalent 16wk. Exercise superior relapse prevention 10mo.',cite:'Blumenthal et al., 2007, Psychosom Med'},
    {vs:'CBT (depression)',finding:'Comparable effect sizes.',cite:'Kvam et al., 2016, J Affect Disord'},
    {vs:'Benzodiazepines (anxiety)',finding:'Equivalent anxiolytic without dependence.',cite:'Herring et al., 2010, Arch Intern Med'}
  ],
  costEstimate:'$0-100/mo gym. Free walking/running. Trainer: $50-150/session.',
  accessibility:'Highly accessible. Adapted forms for all ability levels.',
  timeToEffect:'Acute mood: 20 min. Sustained antidepressant: 2-4 wk. Structural: 8-12 wk.',
  modifications:{pediatric:'60 min/day moderate-vigorous (CDC).',elderly:'Lower impact. Resistance for sarcopenia.',disability:'Seated/wheelchair. Aquatic. Handcycling.'},
  keyCitations:['Blumenthal, J.A. et al. (2007). Exercise and pharmacotherapy in MDD. Psychosom Med, 69(7), 587-596.','Cotman, C.W. et al. (2007). Exercise builds brain health. Trends Neurosci, 30(9), 464-472. DOI: 10.1016/j.tins.2007.06.011','Firth, J. et al. (2017). Aerobic exercise improves cognition in schizophrenia. Schizophr Bull, 43(3), 546-556.','Kvam, S. et al. (2016). Exercise as treatment for depression. J Affect Disord, 202, 67-86.']
},

'Yoga': {
  fullName:'Yoga Therapy',
  category:'Mind-Body',
  overview:'Integrating postures (asana), breathing (pranayama), and meditation (dhyana). Increases GABAergic tone, enhances vagal brake, reduces HPA reactivity, restructures DMN-autonomic coupling.',
  mechanism:'Increases brain GABA (27% — Streeter 2010 MRS). Enhances vagal tone via breath → improved HRV. Reduces cortisol/inflammation. Bottom-up regulation: proprioceptive input restructures PFC-amygdala coupling. Isometric holds = controlled hormesis.',
  neuralTargets:['GABAergic interneurons','Vagal system (NTS, nucleus ambiguus)','HPA axis','Insular cortex (interoception)','mPFC-amygdala coupling','DMN'],
  indications:[
    {dx:'MDD',evidence:'A',effectSize:'d=0.59-0.74',notes:'Cramer et al. (2017) Cochrane.'},
    {dx:'GAD',evidence:'A',effectSize:'d=0.44',notes:'Kundalini and Iyengar styles.'},
    {dx:'PTSD',evidence:'B+',effectSize:'d=0.45-0.85',notes:'TSY. van der Kolk (2014).'},
    {dx:'Insomnia',evidence:'A',effectSize:'d=0.65',notes:'Yoga Nidra particularly effective.'},
    {dx:'Chronic Pain',evidence:'A',effectSize:'d=0.51',notes:'Iyengar for CLBP. Fibromyalgia.'},
    {dx:'SUD',evidence:'B',effectSize:'d=0.28-0.44',notes:'Adjunctive.'}
  ],
  protocol:{format:'Group standard. TSY: small groups, no adjustments.',sessionLength:'60-90 min class. 20-30 min home minimum.',frequency:'2-3x/wk minimum.',duration:'Acute anxiolytic: single session. GABAergic changes: 8-12 wk.',styles:'Hatha, Vinyasa, Iyengar, Kundalini, Yin, Trauma-Sensitive.'},
  contraindications:['Uncontrolled hypertension (inversions)','Acute disc herniation','Glaucoma (inversions)','Late pregnancy (modify)','Active psychosis (grounding only)','Severe dissociation (movement focus)'],
  sideEffects:['Musculoskeletal strain','Lightheadedness from pranayama','Emotional release','Rare: stroke from extreme cervical manipulation'],
  headToHead:[
    {vs:'Walking (anxiety)',finding:'Yoga superior for anxiety and GABA.',cite:'Streeter et al., 2010, J Altern Complement Med'},
    {vs:'CBT (GAD)',finding:'Comparable outcomes.',cite:'Simon et al., 2021, JAMA Psychiatry'}
  ],
  costEstimate:'$10-25/class group. $75-150 individual. Free: YouTube.',
  accessibility:'Highly adaptable. Chair yoga. Props.',
  timeToEffect:'Acute: 20 min. GABA: single session. Sustained: 8-12 wk.',
  modifications:{pediatric:'Playful, shorter (15-30 min).',elderly:'Chair yoga. Gentle Hatha.',traumaSensitive:'No adjustments. Invitational language. Choice-based.'},
  keyCitations:['Streeter, C.C. et al. (2010). Yoga vs walking: mood, anxiety, GABA. J Altern Complement Med, 16(11), 1145-1152. DOI: 10.1089/acm.2010.0007','van der Kolk, B.A. et al. (2014). Yoga as adjunctive for PTSD. J Clin Psychiatry, 75(6), e559-e565.','Cramer, H. et al. (2017). Yoga for depression. Depression Anxiety, 34(6), 508-519.','Simon, N.M. et al. (2021). Yoga vs CBT for GAD. JAMA Psychiatry, 78(1), 13-20.']
},

'Cold Exposure': {
  fullName:'Cold Exposure Therapy / Cold Water Immersion',
  category:'Hormetic Stress',
  overview:'Deliberate cold exposure activates sympathetic NS, releases norepinephrine (200-300% increase), produces compensatory parasympathetic rebound. Repeated exposure → cold adaptation, reduced stress reactivity, enhanced vagal recovery.',
  mechanism:'Acute: massive NE release. Sympathetic activation → cold shock → compensatory parasympathetic rebound. Chronic: reduced basal sympathetic tone, improved HRV, increased brown adipose tissue. Anti-inflammatory via NE reducing TNF-α and IL-6.',
  neuralTargets:['Locus coeruleus (NE)','Sympathetic NS','Vagal system (rebound)','HPA axis','Brown adipose tissue','Anterior insula (interoception)'],
  indications:[
    {dx:'MDD',evidence:'B',effectSize:'d=0.35-0.56 (limited RCTs)',notes:'Shevchuk (2008). Growing evidence.'},
    {dx:'Chronic Inflammation',evidence:'B',effectSize:'Reduced CRP, inflammatory markers',notes:'Muzik et al. (2018) voluntary autonomic modulation.'},
    {dx:'Post-Exercise Recovery',evidence:'A',effectSize:'d=0.28 DOMS reduction',notes:'10-15°C, 10-15 min.'},
    {dx:'Stress Resilience',evidence:'B',effectSize:'Improved HRV, reduced reactivity',notes:'Hormetic adaptation.'}
  ],
  protocol:{format:'Individual.',prescription:'Cold shower: start 15-30s, increase to 2-3 min. Ice bath: 10-15°C, 2-11 min. 3-7x/week.',rampUp:'Wk1: 15-30s. Wk2: 60s. Wk3: 2 min. Wk4+: full cold/ice.',frequency:'Daily showers or 3-4x/wk ice.',duration:'NE response: 30s. Adaptation: 2-4 wk.',safetyProtocol:'Never alone in open water. No cold if cardiac history without clearance.'},
  contraindications:['Uncontrolled cardiovascular disease','Raynaud\'s (severe)','Cold urticaria','Cryoglobulinemia','Pregnancy','Open wounds'],
  sideEffects:['Cold shock response (hyperventilation)','Peripheral vasoconstriction','Afterdrop','Hypothermia risk'],
  headToHead:[{vs:'Exercise (mood)',finding:'Less evidence but complementary. Synergistic NE effects.',cite:'Shevchuk, 2008, Med Hypotheses'}],
  costEstimate:'$0 (showers). Ice: $5-20/session. Cryo chambers: $30-75. Plunge tubs: $150-5000.',
  accessibility:'Highly accessible (cold showers). Ice baths require setup.',
  timeToEffect:'Acute: NE surge 30s, mood lift minutes. Sustained: 2-4 wk.',
  modifications:{pediatric:'NOT recommended young children. Adolescents: mild only.',elderly:'Gradual. Medical clearance. Avoid extreme.',cardiac:'Clearance mandatory. Cool not cold. Gradual.'},
  keyCitations:['Shevchuk, N.A. (2008). Cold shower for depression. Med Hypotheses, 70(5), 995-1001.','Muzik, O. et al. (2018). Brain over body. NeuroImage, 172, 632-641. DOI: 10.1016/j.neuroimage.2018.01.067','Tipton, M.J. et al. (2017). Cold water immersion. Exp Physiol, 102(11), 1335-1355.']
},

'Breathwork': {
  fullName:'Therapeutic Breathwork',
  category:'Autonomic Regulation',
  overview:'Deliberate respiratory manipulation for physiological/psychological effects. Slow breathing activates vagal tone. Cyclic hyperventilation produces sympathetic arousal + parasympathetic rebound. Respiration is the only autonomic function under both voluntary and involuntary control.',
  mechanism:'Slow breathing (≤6/min): pulmonary stretch receptors → vagal afferents → NTS → enhanced cardiac vagal tone. Resonance (~5.5/min) maximizes RSA and HRV. Extended exhale → parasympathetic. Hyperventilation: transient hypocapnia → cerebral vasoconstriction → altered consciousness + sympathetic → parasympathetic rebound.',
  neuralTargets:['NTS','Vagal motor nuclei','Amygdala (vagal afference)','Anterior insula','Prefrontal cortex','LC-NE system'],
  indications:[
    {dx:'GAD',evidence:'A',effectSize:'d=0.52-0.68',notes:'SKY Breath Meditation strongest evidence.'},
    {dx:'MDD',evidence:'B+',effectSize:'d=0.40-0.58',notes:'SKY Yoga adjunctive.'},
    {dx:'PTSD',evidence:'B',effectSize:'d=0.41-0.62',notes:'SKY for veterans. Seppälä et al. (2014).'},
    {dx:'Panic Disorder',evidence:'A',effectSize:'d=0.56',notes:'CART. Meuret et al. (2010).'},
    {dx:'Insomnia',evidence:'B+',effectSize:'d=0.42',notes:'4-7-8, yoga nidra breathing.'},
    {dx:'Hypertension',evidence:'A',effectSize:'-5 to -8 mmHg',notes:'RESPeRATE. FDA-cleared.'}
  ],
  protocol:{techniques:[{name:'Box Breathing (4-4-4-4)',description:'Inhale 4s, hold 4s, exhale 4s, hold 4s.',use:'Acute stress. Military standard.'},{name:'4-7-8 Breathing',description:'Inhale 4s, hold 7s, exhale 8s.',use:'Sleep onset, acute anxiety.'},{name:'Resonance Frequency (~5.5/min)',description:'20 min sessions, calibrated via HRV.',use:'Maximum HRV.'},{name:'SKY Breath Meditation',description:'Cyclical rates with Ujjayi. 25-40 min.',use:'Depression, PTSD, anxiety.'},{name:'Wim Hof Method',description:'30-40 deep breaths → exhale hold → recovery. 3 rounds.',use:'Stress inoculation, anti-inflammatory.'},{name:'Physiological Sigh',description:'Double inhale (nose) + extended exhale (mouth).',use:'Fastest real-time stress reduction.'}],frequency:'Daily 5-10 min minimum.',duration:'Acute: physiological sigh 10s. HRV improvement: 4-8 wk.'},
  contraindications:['Seizure disorders (hyperventilation only)','Cardiovascular disease (hyperventilation)','Pregnancy (aggressive hyperventilation)','Panic disorder (caution hyperventilation early tx)','Severe asthma/COPD','History of pneumothorax'],
  sideEffects:['Lightheadedness/dizziness','Tingling/tetany','Emotional release','Syncope risk (never standing/in water)'],
  headToHead:[{vs:'Medication (anxiety)',finding:'Comparable mild-moderate. No side effects.',cite:'Brown & Gerbarg, 2005, J Altern Complement Med'},{vs:'Meditation',finding:'Faster physiological onset. Meditation stronger long-term DMN.',cite:'Zaccaro et al., 2018, Front Hum Neurosci'}],
  costEstimate:'$0 self-directed. SKY workshop: $200-400. HRV device: $100-300.',
  accessibility:'Extremely accessible. No equipment.',
  timeToEffect:'Physiological sigh: 10s. Box breathing: 2-3 min. HRV: 4-8 wk.',
  modifications:{pediatric:'Shorter cycles. Playful (bubbles, pinwheel). No hyperventilation <12.',elderly:'Gentle only. No aggressive holds. Resonance ideal.',respiratory:'Modify holds. No forceful breathing. Work with pulmonologist.'},
  keyCitations:['Seppälä, E.M. et al. (2014). Breathing meditation decreases PTSD in veterans. J Trauma Stress, 27(4), 397-405.','Zope, S.A. & Zope, R.A. (2013). Sudarshan Kriya Yoga. Int J Yoga, 6(1), 4-10.','Zaccaro, A. et al. (2018). How breath-control can change your life. Front Hum Neurosci, 12, 353. DOI: 10.3389/fnhum.2018.00353']
},

'HRV Biofeedback': {
  fullName:'Heart Rate Variability Biofeedback',
  category:'Biofeedback',
  overview:'Training to increase HRV through real-time physiological feedback via resonance frequency breathing. Low HRV is a transdiagnostic psychopathology marker and all-cause mortality predictor. Restores autonomic flexibility by strengthening baroreflex and vagal brake.',
  mechanism:'Resonance frequency breathing (~5.5/min, individually calibrated) maximizes RSA → trains baroreflex → baroreceptors signal NTS → modulates cardiac vagal output. Repeated training increases resting HRV, reduces sympathetic dominance, improves PFC-amygdala coupling.',
  neuralTargets:['Baroreflex arc','Vagal cardiac neurons (nucleus ambiguus)','mPFC','Amygdala','ACC'],
  indications:[
    {dx:'MDD',evidence:'B+',effectSize:'d=0.38-0.54',notes:'Karavidas et al. (2007).'},
    {dx:'GAD',evidence:'A',effectSize:'d=0.52',notes:'Lehrer & Gevirtz (2014).'},
    {dx:'PTSD',evidence:'B+',effectSize:'d=0.44',notes:'Zucker et al. (2009).'},
    {dx:'Asthma',evidence:'A',effectSize:'Reduced medication, improved peak flow',notes:'Lehrer et al. (2004).'},
    {dx:'Hypertension',evidence:'A',effectSize:'-5 to -7 mmHg',notes:'Comparable to single antihypertensive.'},
    {dx:'Fibromyalgia',evidence:'B',effectSize:'d=0.36',notes:'Hassett et al. (2007).'}
  ],
  protocol:{format:'Individual with equipment → home practice.',sessionLength:'50-60 min initial, 20-30 subsequent.',frequency:'Weekly clinic × 8-10 wk. Daily home 20 min.',totalSessions:'8-10 sessions.',equipment:'PPG sensor + software (HeartMath, Elite HRV). Research: Polar H10 + Kubios. Home: HeartMath Inner Balance (~$160).',phases:[{name:'Assessment',sessions:'1',content:'Individual resonance frequency ID (4.5-7 breaths/min). Baseline HRV.'},{name:'Training',sessions:'2-8',content:'Breathe at resonance with real-time HRV. Reduce feedback reliance.'},{name:'Transfer',sessions:'9-10',content:'Practice without equipment. Daily life application.'}]},
  contraindications:['None absolute. Relative: severe arrhythmia, pacemaker (readings).'],
  sideEffects:['Lightheadedness','Learning frustration','Paradoxical anxiety early'],
  headToHead:[{vs:'Medication (anxiety)',finding:'Comparable mild-moderate. No side effects. Sustainable.',cite:'Lehrer & Gevirtz, 2014, Appl Psychophysiol Biofeedback'}],
  costEstimate:'Clinic: $80-200/session. Home device: $100-300. Full protocol: $800-2500.',
  accessibility:'Requires equipment. Telehealth adaptable after training.',
  timeToEffect:'Single session: measurable. Sustained: 4-6 wk. Full: 8-10 wk.',
  modifications:{pediatric:'Age 8+. Gamified. Shorter (15 min).',elderly:'Standard. Excellent for hypertension.',digital:'Fully telehealth-compatible with home sensors.'},
  keyCitations:['Lehrer, P.M. & Gevirtz, R. (2014). HRV biofeedback. Front Psychol, 5, 756. DOI: 10.3389/fpsyg.2014.00756','Karavidas, M.K. et al. (2007). HRV biofeedback for MDD. Appl Psychophysiol Biofeedback, 32(1), 19-30.','Thayer, J.F. et al. (2012). HRV and neuroimaging meta-analysis. Neurosci Biobehav Rev, 36(2), 747-756. DOI: 10.1016/j.neubiorev.2011.11.009']
},

'Float Tank': {
  fullName:'Floatation-REST (Reduced Environmental Stimulation Therapy)',
  category:'Sensory Modulation',
  overview:'Floating in lightless, soundproof tank with skin-temperature water saturated with Epsom salt (~500 kg MgSO₄). Reduces DMN activity, produces altered states, enhances interoception. Elimination of exteroceptive input shifts to interoceptive channels.',
  mechanism:'Eliminates exteroceptive input → cortical deafferentation → reduced DMN self-referential processing. Enhanced interoceptive detection. Magnesium absorption. Thermoneutral environment. Theta-dominant EEG (4-8 Hz).',
  neuralTargets:['DMN (reduced activity)','Insular cortex (enhanced interoception)','Amygdala (reduced — Feinstein 2018)','Somatosensory cortex','Thalamic relay','PCC/precuneus'],
  indications:[
    {dx:'GAD',evidence:'B+',effectSize:'d=0.52-0.73',notes:'Feinstein et al. (2018). Single session significant.'},
    {dx:'MDD',evidence:'B',effectSize:'d=0.44',notes:'Mood improvement, reduced rumination.'},
    {dx:'Fibromyalgia',evidence:'B',effectSize:'d=0.40-0.55',notes:'Bood et al. (2006).'},
    {dx:'Insomnia',evidence:'B',effectSize:'d=0.38',notes:'Theta induction, muscle relaxation.'},
    {dx:'Stress/Burnout',evidence:'B',effectSize:'d=0.50',notes:'Kjellgren et al. (2014).'}
  ],
  protocol:{format:'Individual. Commercial centers.',sessionLength:'60-90 min.',frequency:'1-2x/wk.',duration:'Acute: single session. Sustained: 4-8 weekly sessions.',preparation:'No caffeine 2-3h. No shaving day of. Shower before. Earplugs.',postSession:'Shower. Hydrate. 15-30 min integration.'},
  contraindications:['Active skin infections/open wounds','Epilepsy (drowning risk)','Severe claustrophobia','Active psychosis/severe dissociation','Alcohol/sedatives','Uncontrolled Type 1 diabetes','Infectious diarrhea (2-wk exclusion)'],
  sideEffects:['Claustrophobia/anxiety (first float)','Nausea (rare)','Salt in eyes/cuts','Disorientation exiting','Emotional release'],
  headToHead:[{vs:'Meditation',finding:'Deeper interoceptive states faster in novices.',cite:'Feinstein et al., 2018, PLoS ONE'}],
  costEstimate:'$50-100/session. Memberships: $50-80/mo. Home tanks: $2,000-30,000.',
  accessibility:'Requires float center. Not covered by insurance.',
  timeToEffect:'Acute: single 60-min session. Cumulative: 4-8 wk weekly.',
  modifications:{pediatric:'Not recommended <12. Adolescents: supervised, shorter.',elderly:'Safe. Assist entry/exit. Excellent for chronic pain.',claustrophobia:'Open-pool. Light on. Door open. Progress gradually.'},
  keyCitations:['Feinstein, J.S. et al. (2018). Floatation-REST anxiolytic/antidepressant effect. PLoS ONE, 13(2), e0190292. DOI: 10.1371/journal.pone.0190292','Bood, S.A. et al. (2006). Flotation-REST for stress-related ailments. Int J Stress Manag, 13(2), 154-175.','Kjellgren, A. et al. (2014). Flotation-REST for muscle tension pain. Pain Res Manag, 6(4), 181-189.']
},

'rTMS': {
  fullName:'Repetitive Transcranial Magnetic Stimulation',
  category:'Neuromodulation',
  overview:'Non-invasive brain stimulation using alternating magnetic fields. FDA-cleared for TRD (2008), OCD (2018), smoking cessation (2020), anxious depression (2022). SAINT protocol: 79% remission in 5 days.',
  mechanism:'Magnetic coil induces cortical electrical current (1-3 cm depth). High-frequency (≥5 Hz) → LTP-like → increased excitability. Low-frequency (≤1 Hz) → LTD-like → decreased. DLPFC stimulation modulates DMN-executive coupling, reduces DMN hyperconnectivity in depression.',
  neuralTargets:['Left DLPFC (primary — depression)','Right DLPFC (anxiety)','mPFC/ACC (deep TMS — OCD)','DMN-executive coupling','Cortico-limbic circuits','Striatal-cortical (OCD)'],
  indications:[
    {dx:'MDD (TRD)',evidence:'A',effectSize:'d=0.53; response 50-58%; remission 28-33%',notes:'FDA-cleared 2008. ≥2 adequate med trials failed.'},
    {dx:'MDD (SAINT)',evidence:'A',effectSize:'79% remission (RCT)',notes:'10 sessions/day × 5 days. fMRI-guided. Cole et al. (2022).'},
    {dx:'OCD',evidence:'A',effectSize:'d=0.45; response 38%',notes:'FDA-cleared 2018. Deep TMS H-coil targeting mPFC/ACC.'},
    {dx:'Smoking Cessation',evidence:'A',effectSize:'OR 2.2 vs sham',notes:'FDA-cleared 2020.'},
    {dx:'PTSD',evidence:'B',effectSize:'d=0.41',notes:'Right DLPFC low-frequency. Not FDA-cleared.'}
  ],
  protocol:{format:'Outpatient. Seated. No anesthesia.',sessionLength:'Standard: 37 min (10 Hz). Theta burst: 3-10 min. SAINT: 10 min × 10/day.',frequency:'5 days/wk × 4-6 wk. SAINT: 5 days total.',totalSessions:'Standard: 20-36. SAINT: 50 over 5 days.',targeting:'5-cm rule (standard). MRI-guided neuronavigation (optimal). SAINT: fMRI-guided DLPFC anticorrelated with sgACC.',monitoring:'Motor threshold. PHQ-9 weekly.'},
  contraindications:['Ferromagnetic implants in head/neck (absolute)','Cochlear implants','Active seizure disorder (relative)','Metallic skull hardware','Pregnancy (relative)'],
  sideEffects:['Headache (20-40%, mild)','Scalp discomfort','Facial twitching','Seizure (~0.01%/session)','Rare: hearing changes (earplugs)','Rare: treatment-emergent hypomania'],
  headToHead:[
    {vs:'Medication (TRD)',finding:'Comparable to switching meds after 2 failures. No systemic side effects.',cite:'Berlim et al., 2014, World J Biol Psychiatry'},
    {vs:'ECT',finding:'ECT more effective (remission 50-65% vs 28-33%). rTMS: no anesthesia, no cognitive side effects.',cite:'Ren et al., 2014, PLoS ONE'},
    {vs:'SAINT vs standard rTMS',finding:'79% vs ~30% remission. 5 days vs 6 weeks.',cite:'Cole et al., 2022, Am J Psychiatry'}
  ],
  costEstimate:'$200-400/session. Full course: $6,000-12,000. Insurance increasingly covers TRD.',
  accessibility:'Specialized clinic required. Growing urban availability.',
  timeToEffect:'Standard: week 2-3 onset, full 4-6 wk. SAINT: 1-5 days.',
  modifications:{pediatric:'Adult FDA-cleared only. Adolescent studies (12+) show safety.',elderly:'Safe. Adjusted motor threshold. No cognitive side effects.',bipolar:'Risk mania. Use with mood stabilizer. Right low-frequency may be safer.'},
  keyCitations:['Cole, E.J. et al. (2022). SAINT for TRD. Am J Psychiatry, 179(2), 132-141.','George, M.S. et al. (2010). Daily left prefrontal TMS for MDD. Arch Gen Psychiatry, 67(5), 507-516.','Berlim, M.T. et al. (2014). HF-rTMS for MDD. Psychol Med, 44(2), 225-239.','Carmi, L. et al. (2019). Deep TMS for OCD. Am J Psychiatry, 176(11), 931-938.']
},

'Neurofeedback': {
  fullName:'EEG Neurofeedback (Neurotherapy)',
  category:'Biofeedback',
  overview:'Real-time training of brainwave patterns via EEG feedback. Sensors measure delta/theta/alpha/beta/gamma; feedback reinforces desired patterns. Protocols target specific frequency bands at specific locations.',
  mechanism:'Operant conditioning of brainwave patterns reinforced via audiovisual feedback. SMR (12-15 Hz at sensorimotor cortex) reduces thalamocortical dysrhythmia. Alpha-theta for addiction/PTSD. Beta for sustained attention. SCP training improves cortical excitability regulation.',
  neuralTargets:['Sensorimotor cortex (SMR)','Frontal cortex (beta/theta ratio)','Parietal/occipital (alpha)','Thalamocortical loops','DMN nodes (alpha-theta)','Frontal asymmetry'],
  indications:[
    {dx:'ADHD',evidence:'A',effectSize:'d=0.40-0.61',notes:'Level 1 "Best Support" AAPB. Arns et al. (2009). Effects sustained at follow-up.'},
    {dx:'Epilepsy',evidence:'A',effectSize:'50%+ seizure reduction in 75%',notes:'Sterman (2000). SMR training.'},
    {dx:'Anxiety',evidence:'B+',effectSize:'d=0.40',notes:'Alpha uptraining, alpha-theta. Hammond (2005).'},
    {dx:'PTSD',evidence:'B',effectSize:'d=0.39-0.55',notes:'Alpha-theta (Peniston). van der Kolk (2016) pilot.'},
    {dx:'SUD',evidence:'B',effectSize:'d=0.37',notes:'Alpha-theta training. Scott et al. (2005).'},
    {dx:'Insomnia',evidence:'B',effectSize:'d=0.44',notes:'SMR improves sleep spindles. Cortoos et al. (2010).'}
  ],
  protocol:{format:'Individual clinic sessions.',sessionLength:'30-60 min (20-30 active).',frequency:'2-3x/wk.',totalSessions:'20-40 (ADHD: 30-40 minimum). Effects often by session 10-15.',equipment:'Clinical: 19-ch qEEG (BrainMaster, NeurOptimal). Consumer: Muse (limited).',phases:[{name:'Assessment',sessions:'1-2',content:'qEEG mapping. Protocol selection.'},{name:'Training',sessions:'3-30',content:'Active neurofeedback. Protocol adjustments.'},{name:'Consolidation',sessions:'31-40',content:'Reduce frequency. Transfer. Booster schedule.'}]},
  contraindications:['Active seizure disorder (some protocols)','Severe dissociative disorders (alpha-theta)','Active psychosis','Recent concussion (wait 2-4 wk)'],
  sideEffects:['Headache (20-30%)','Fatigue','Irritability/emotional lability','Sleep disruption','Rare: seizure provocation'],
  headToHead:[{vs:'Medication (ADHD)',finding:'Comparable effect sizes. NF sustained at follow-up. Medication stops when stopped.',cite:'Arns et al., 2009, Clin EEG Neurosci'}],
  costEstimate:'$80-200/session. Full course: $3,200-8,000. Rarely insurance-covered. Home: $200-800.',
  accessibility:'Specialized clinic. Limited rural. Quality varies significantly.',
  timeToEffect:'Some effects session 10-15. Full: 30-40 sessions (3-6 mo). Sustained long-term.',
  modifications:{pediatric:'Excellent (especially ADHD). Gamified. Shorter (20 min). Age 6+.',elderly:'Safe. Slower learning. More sessions.',home:'Consumer devices limited. Not equivalent to clinical.'},
  keyCitations:['Arns, M. et al. (2009). Neurofeedback for ADHD. Clin EEG Neurosci, 40(3), 180-189.','Sterman, M.B. (2000). EEG operant conditioning for seizures. Clin EEG, 31(1), 45-55.','van der Kolk, B.A. et al. (2016). Neurofeedback for chronic PTSD. PLoS ONE, 11(12), e0166752.','Hammond, D.C. (2005). Neurofeedback for depression and anxiety. J Adult Dev, 12(2-3), 131-137.']
},
'Sleep Hygiene': {
  fullName:'Sleep Hygiene & Sleep Architecture Optimization',
  category:'Behavioral',
  overview:'Behavioral and environmental interventions to optimize sleep. Sleep enables glymphatic clearance, memory consolidation, emotional processing (REM), and DMN recalibration. Chronic disruption is transdiagnostic risk factor and accelerates neurodegeneration.',
  mechanism:'Glymphatic activation (60% interstitial expansion). NREM: hippocampal replay → cortical consolidation. REM: amygdala-PFC emotional processing. Sleep deprivation impairs DMN-executive decoupling. Circadian alignment via SCN entrainment by light.',
  neuralTargets:['Glymphatic system','Hippocampus (NREM consolidation)','Amygdala-PFC (REM processing)','SCN (circadian)','DMN (recalibration)','Pineal (melatonin)','Adenosine receptors'],
  indications:[
    {dx:'Insomnia',evidence:'A',effectSize:'d=0.47 standalone; d=1.09 with stimulus control/restriction',notes:'Component of CBT-I (first-line). Edinger et al. (2021) AASM.'},
    {dx:'MDD',evidence:'A (comorbidity)',effectSize:'Insomnia tx reduces depression relapse 51%',notes:'Irwin et al. (2022): CBT-I as depression prevention.'},
    {dx:'Bipolar',evidence:'A (maintenance)',effectSize:'Sleep disruption predicts episodes',notes:'IPSRT includes sleep stabilization.'},
    {dx:'PTSD',evidence:'B+',effectSize:'Improved sleep reduces daytime PTSD',notes:'Nightmares/insomnia core features.'},
    {dx:'Cognitive Decline',evidence:'A',effectSize:'Short sleep (<6h) → 30% increased dementia risk',notes:'Sabia et al. (2021) Whitehall II.'}
  ],
  protocol:{components:[{name:'Light Exposure',description:'10,000 lux within 30-60 min waking × 20-30 min. Blue-light blocking after sunset.'},{name:'Temperature',description:'65-68°F (18-20°C). Warm bath 1-2h before bed.'},{name:'Timing',description:'Same wake time ±30 min, 7 days/wk.'},{name:'Stimulus Control',description:'Bed for sleep/sex only. Leave if awake >20 min.'},{name:'Sleep Restriction',description:'Limit TIB to actual sleep time. Extend as efficiency >85%.'},{name:'Caffeine',description:'None after noon (half-life 5-7h).'},{name:'Alcohol',description:'None within 3h bedtime.'},{name:'Exercise',description:'Avoid vigorous within 2h bedtime.'}],monitoring:'Sleep diary 2+ wk. Actigraphy optional. PSG if apnea suspected.'},
  contraindications:['Sleep restriction: caution bipolar (mania trigger)','Sleep restriction: caution epilepsy (lowers seizure threshold)'],
  sideEffects:['Sleep restriction: transient daytime sleepiness','Light therapy: headache, eye strain (rare)'],
  headToHead:[{vs:'Sleep Medication',finding:'CBT-I equivalent short-term, superior long-term. Meds lose efficacy, risk dependence.',cite:'Mitchell et al., 2012, Ann Intern Med'},{vs:'Melatonin',finding:'Small effect (d=0.17). Useful circadian misalignment, not primary insomnia.',cite:'Ferracioli-Oda et al., 2013, PLoS ONE'}],
  costEstimate:'$0 self-directed. CBT-I: $150-300 × 6-8 sessions. Apps: $0-50.',
  accessibility:'Highly accessible. Most components free. Light lamp: $30-80.',
  timeToEffect:'Stimulus control: 1-2 wk. Full optimization: 2-4 wk. Architecture changes: 4-8 wk.',
  modifications:{pediatric:'Routines. Screen curfew 1h before bed.',elderly:'6-7h normal. No naps >30 min. Address nocturia.',shiftWork:'Fixed shift preferred. Strategic napping. Melatonin for realignment.'},
  keyCitations:['Edinger, J.D. et al. (2021). Behavioral treatments for insomnia: AASM review. J Clin Sleep Med, 17(2), 255-262.','Irwin, M.R. et al. (2022). CBT-I prevents depression. JAMA Psychiatry, 79(1), 33-41.','Sabia, S. et al. (2021). Sleep duration and dementia risk. Nat Commun, 12, 2289.','Walker, M. (2017). Why We Sleep. Scribner.']
},

'Light Therapy': {
  fullName:'Bright Light Therapy (Phototherapy)',
  category:'Chronobiological',
  overview:'Timed 10,000 lux exposure to entrain circadian rhythms via retinohypothalamic tract. First-line for SAD. Growing evidence for non-seasonal MDD, bipolar depression, circadian disorders, perinatal depression.',
  mechanism:'ipRGCs (melanopsin, 460-490 nm) → retinohypothalamic tract → SCN entrainment → downstream: melatonin suppression, cortisol rhythm normalization, serotonin synthesis (tryptophan hydroxylase upregulation), core temperature. Morning light phase-advances clock.',
  neuralTargets:['SCN (circadian pacemaker)','Pineal (melatonin suppression)','Raphe nuclei (serotonin)','HPA axis (cortisol rhythm)','Retinohypothalamic tract','Habenula'],
  indications:[
    {dx:'SAD',evidence:'A',effectSize:'d=0.84; NNT ~3; 53-80% response',notes:'First-line. Golden et al. (2005).'},
    {dx:'Non-Seasonal MDD',evidence:'A',effectSize:'d=0.62 mono; d=0.76 adjunct SSRI',notes:'Lam et al. (2016) JAMA Psych: light = fluoxetine, combined superior.'},
    {dx:'Bipolar Depression',evidence:'B+',effectSize:'d=0.44-0.67',notes:'Sit et al. (2018): midday (avoid morning mania risk). With mood stabilizer.'},
    {dx:'Perinatal Depression',evidence:'B+',effectSize:'d=0.55',notes:'No fetal medication exposure. Wirz-Justice (2011).'},
    {dx:'Circadian Disorders',evidence:'A',effectSize:'Phase advance 1-2h',notes:'DSWPD: morning light. ASWPD: evening light.'},
    {dx:'Bulimia Nervosa',evidence:'B',effectSize:'d=0.39',notes:'Seasonal component. Lam et al. (1994).'}
  ],
  protocol:{format:'Self-administered home.',equipment:'10,000 lux broad-spectrum white (UV-filtered). 16-24 inches.',timing:'Morning within 30 min waking (most). Bipolar: midday.',sessionLength:'30 min at 10,000 lux.',frequency:'Daily during symptomatic period.',duration:'Response 1-2 wk. Full 2-4 wk. Relapse within days of stopping.',maintenance:'SAD: October-March. Taper 1-2 wk. Resume early fall.'},
  contraindications:['Retinal disease (macular degeneration, retinitis pigmentosa)','Photosensitizing medications (lithium, tetracyclines, St. John\'s Wort)','Bipolar without mood stabilizer (mania risk)','Porphyria','History treatment-emergent mania with light'],
  sideEffects:['Headache (10-20%)','Eye strain','Nausea (rare)','Irritability/agitation','Treatment-emergent hypomania/mania (bipolar — discontinue)','Insomnia (if too late in day)'],
  headToHead:[
    {vs:'SSRIs (SAD)',finding:'Equivalent. Faster onset (1-2 wk vs 4-6). No sexual SE, no discontinuation syndrome.',cite:'Lam et al., 2006, Am J Psychiatry'},
    {vs:'SSRIs (non-seasonal MDD)',finding:'Light = fluoxetine. Combined superior.',cite:'Lam et al., 2016, JAMA Psychiatry'},
    {vs:'CBT-SAD',finding:'Light faster response. CBT-SAD better 2-yr relapse prevention.',cite:'Rohan et al., 2016, Am J Psychiatry'}
  ],
  costEstimate:'Light box: $30-150 one-time. No ongoing costs.',
  accessibility:'Highly accessible once purchased. Self-administered. Portable.',
  timeToEffect:'Partial: 3-5 days. Full: 1-2 wk. Relapse within days of stopping.',
  modifications:{pediatric:'Safe. May prefer over medication.',elderly:'Screen for macular degeneration. May help sundowning.',bipolar:'ONLY with mood stabilizer. Midday. Start 15 min, titrate slowly. Monitor mania.'},
  keyCitations:['Lam, R.W. et al. (2016). Light, fluoxetine, and combination for nonseasonal MDD. JAMA Psychiatry, 73(1), 56-63.','Golden, R.N. et al. (2005). Light therapy for mood disorders. Am J Psychiatry, 162(4), 656-662.','Sit, D.K. et al. (2018). Light for bipolar depression. Am J Psychiatry, 175(2), 131-139.','Terman, M. & Terman, J.S. (2005). Light therapy for depression. CNS Spectrums, 10(8), 647-663.']
},

'Stellate Ganglion Block': {
  fullName:'Stellate Ganglion Block (SGB)',
  category:'Interventional',
  overview:'Injection of local anesthetic into stellate ganglion (sympathetic C6-C7). Interrupts sympathetic fight-or-flight at cervical relay. Rapid-acting for PTSD. Effect outlasts anesthetic duration — breaks pathological sympathetic-amygdala-insular feedback loop.',
  mechanism:'Bupivacaine blockade of stellate ganglion → temporary interruption of sympathetic efferents. Breaks sympathetic hyperactivation → elevated NE → sensitized amygdala → threat detection → sympathetic drive cycle. Brain NGF normalizes post-SGB.',
  neuralTargets:['Stellate ganglion (C6-C7)','Sympathetic efferents','Amygdala (indirect)','Insular cortex','LC-NE system','HPA axis'],
  indications:[
    {dx:'PTSD',evidence:'B+',effectSize:'d=0.78-1.10; 70-80% response open-label',notes:'Lipov (2008, 2012). Rapid onset. Military populations.'},
    {dx:'Anxiety Disorders',evidence:'B',effectSize:'d=0.45-0.65',notes:'Case series.'},
    {dx:'Complex Regional Pain Syndrome',evidence:'A',effectSize:'Established indication',notes:'Traditional pain management.'},
    {dx:'Hot Flashes',evidence:'B',effectSize:'Reduced frequency/severity',notes:'Sympathetic mechanism. Lipov (2008).'}
  ],
  protocol:{format:'Outpatient. Anesthesiologist/pain medicine.',procedure:'Ultrasound/fluoroscopy-guided injection 5-8 mL 0.5% bupivacaine at C6 or C7. Right-sided for PTSD. 10-15 min.',frequency:'Single may suffice. Some: 2 injections (R then L, 1-2 wk apart). Repeat if recur (3-6 mo).',postProcedure:'Monitor 30-60 min. Horner syndrome expected (4-8h). Resume normal activities same day.',onset:'PTSD: hours to days. Pain: minutes to hours.'},
  contraindications:['Anticoagulation','Local infection at site','LA allergy','Contralateral phrenic/pneumothorax','Severe COPD','Glaucoma (relative)'],
  sideEffects:['Horner syndrome (expected — temporary ptosis, miosis, anhidrosis)','Hoarseness (temporary)','Dysphagia (temporary)','Injection site pain/bruising','Pneumothorax (rare <0.1% with US)','Intravascular injection (rare — seizure risk)'],
  headToHead:[
    {vs:'SSRI/SNRI (PTSD)',finding:'SGB onset hours-days vs 4-8 wk. Addresses sympathetic hyperactivation directly.',cite:'Lipov et al., 2012, Mil Med'},
    {vs:'PE/CPT (PTSD)',finding:'SGB may reduce hyperarousal → enable therapy engagement.',cite:'Mulvaney et al., 2014, J Trauma Stress'}
  ],
  costEstimate:'$1,500-3,000/injection. Some VA covers. Private insurance variable.',
  accessibility:'Requires trained interventionalist + imaging. Pain clinics, some VA centers.',
  timeToEffect:'Hours to days. Peak 1-2 wk. Duration weeks to months.',
  modifications:{pediatric:'Not established.',elderly:'Standard with age monitoring. Anticoagulation check.',bilateral:'Some protocols sequential R then L for enhanced effect.'},
  keyCitations:['Lipov, E.G. et al. (2008). SGB for PTSD. Anesth Analg, 107(4), 1442.','Lipov, E.G. et al. (2012). SGB effects on PTSD. Mil Med, 177(2), 125-127.','Mulvaney, S.W. et al. (2014). SGB for PTSD. J Trauma Stress, 27(4), 507-512.','Rae Olmsted, K.L. et al. (2020). SGB for military PTSD RCT. JAMA Psychiatry, 77(2), 130-138.']
},

'DBS': {
  fullName:'Deep Brain Stimulation',
  category:'Neuromodulation',
  overview:'Surgical electrode implantation + pulse generator. FDA-approved: PD, tremor, dystonia, OCD (HDE), epilepsy. Investigational: TRD, anorexia, addiction. Most invasive reversible neuromodulation.',
  mechanism:'High-frequency stimulation (>100 Hz) creates functional lesion — overrides pathological oscillations. For OCD: VC/VS or STN interrupts OFC-striatal hyperconnectivity. For depression: Cg25/BA25 modulates DMN-affective coupling.',
  neuralTargets:['STN (PD, OCD)','VC/VS (OCD, depression)','Cg25/BA25 (depression)','NAc (depression, addiction, anorexia)','GPi (PD, dystonia, Tourette)','Anterior thalamic nucleus (epilepsy)','Medial forebrain bundle (experimental)'],
  indications:[
    {dx:'OCD (severe TRD)',evidence:'A (HDE)',effectSize:'50-70% response',notes:'FDA HDE 2009. Must fail multiple SRIs + ERP + augmentation.'},
    {dx:'TRD',evidence:'B+',effectSize:'40-60% open-label; RCTs mixed',notes:'Cg25, VC/VS, NAc, MFB targets. Recent refinement improving results.'},
    {dx:'Parkinson\'s',evidence:'A',effectSize:'Significant motor improvement',notes:'Gold standard for motor fluctuations.'},
    {dx:'Epilepsy',evidence:'A',effectSize:'50%+ reduction in 54% at 5yr',notes:'FDA 2018. SANTE trial.'},
    {dx:'Tourette',evidence:'B',effectSize:'35-50% tic reduction',notes:'GPi and CM-Pf targets.'}
  ],
  protocol:{format:'Inpatient surgery → outpatient programming.',procedure:'MRI targeting → stereotactic surgery → electrode placement → subclavicular pulse generator.',programming:'Frequency ~130 Hz, pulse width 60-450 μs, 1-10 V/mA. Optimization 3-12 mo.',followUp:'Monthly initially. Quarterly once optimized. Battery replacement 3-10 yr.',reversibility:'Stimulation adjustable/off. Electrodes removable.'},
  contraindications:['Active infection','Coagulopathy','Cannot undergo MRI','Active substance abuse','Cannot comply with follow-up','Personality disorder primary dx','Medical surgical contraindications'],
  sideEffects:['Surgical: infection 2-5%, hemorrhage 1-2%, stroke <1%, lead issues 5%','Stimulation: mood changes, impulsivity (STN), cognitive effects (word fluency)','Device: battery depletion, malfunction, skin erosion','OCD: hypomania risk','Weight changes, sleep disruption, paresthesias'],
  headToHead:[
    {vs:'Ablative surgery (OCD)',finding:'DBS reversible/adjustable. Capsulotomy comparable but irreversible.',cite:'Alonso et al., 2015, Mol Psychiatry'},
    {vs:'rTMS (depression)',finding:'DBS far more invasive but potentially more effective for most refractory. rTMS first.',cite:'Holtzheimer & Mayberg, 2011, Annu Rev Neurosci'}
  ],
  costEstimate:'$50,000-150,000. Insurance covers approved indications.',
  accessibility:'Academic medical centers only. Multidisciplinary team required.',
  timeToEffect:'PD motor: immediate-days. OCD: weeks-months. Depression: weeks-months. Full optimization: 3-12 mo.',
  modifications:{pediatric:'Limited. Adolescents for dystonia/Tourette.',elderly:'Surgical risk assessment. Cognitive baseline important.',bilateral:'Standard for most psychiatric indications.'},
  keyCitations:['Mayberg, H.S. et al. (2005). DBS for TRD. Neuron, 45(5), 651-660.','Denys, D. et al. (2010). DBS NAc for OCD. Arch Gen Psychiatry, 67(10), 1061-1068.','Lozano, A.M. et al. (2019). Subcallosal cingulate DBS for TRD. Lancet Psychiatry, 6(9), 729-737.','Kisely, S. et al. (2014). DBS for OCD meta-analysis. Psychol Med, 44(16), 3533-3542.']
},

'Acupuncture': {
  fullName:'Auricular Acupuncture / NADA Protocol',
  category:'Neuromodulation (Peripheral)',
  overview:'Needles in external ear modulate ANS via auricular branch of vagus nerve (ABVN). NADA: 5 standardized ear points (Shenmen, Sympathetic, Kidney, Liver, Lung). Mechanistically identical to transcutaneous VNS via acupuncture.',
  mechanism:'ABVN (Arnold\'s nerve) innervates concha/tragus → vagal afferent activation → NTS → parasympathetic activation and cortical modulation. Endorphin release, cortisol modulation, anti-inflammatory vagal reflex.',
  neuralTargets:['ABVN','NTS (same target as VNS)','Parasympathetic NS','Endogenous opioid system','HPA axis','Amygdala (indirect)'],
  indications:[
    {dx:'SUD (adjunctive)',evidence:'B',effectSize:'d=0.25-0.45',notes:'NADA widely used. Carter et al. (2011).'},
    {dx:'Anxiety',evidence:'B',effectSize:'d=0.36-0.52',notes:'Pilkington et al. (2007).'},
    {dx:'PTSD',evidence:'B',effectSize:'d=0.40',notes:'Military. King et al. (2015).'},
    {dx:'Insomnia',evidence:'B',effectSize:'d=0.39',notes:'Shenmen and Sympathetic points.'},
    {dx:'Acute Pain/Procedural Anxiety',evidence:'B+',effectSize:'d=0.45',notes:'Battlefield acupuncture (BFA).'},
    {dx:'Perioperative Nausea',evidence:'A',effectSize:'Well-established',notes:'PC6 and auricular points.'}
  ],
  protocol:{format:'Group (NADA standard) or individual.',procedure:'5 sterile needles (34-38g, 13mm) bilaterally: Shenmen, Sympathetic, Kidney, Liver, Lung. Retained 30-45 min.',frequency:'NADA: daily or 3-5x/wk acute. Maintenance: 1-2x/wk.',totalSessions:'10-30 (addiction). 6-12 (anxiety). Ongoing maintenance possible.',practitioner:'Licensed acupuncturist (full scope) or NADA-trained ADS (nurses, social workers, counselors).',alternatives:'Ear seeds (Vaccaria). taVNS devices.'},
  contraindications:['Ear infection/skin condition at site','Needle phobia (use ear seeds)','Hemophilia/anticoagulation (relative)','Pregnancy: avoid certain points (NADA generally safe)'],
  sideEffects:['Minor pain at insertion','Vasovagal response (uncommon)','Minor bleeding/bruising','Drowsiness (therapeutic)','Emotional release'],
  headToHead:[{vs:'Sham acupuncture',finding:'Active generally superior, but sham also shows effects (non-specific vagal stimulation).',cite:'Pilkington et al., 2007, J Psychiatr Ment Health Nurs'}],
  costEstimate:'NADA group: $10-40. Individual: $60-150. ADS training: $250-600. Ear seeds: $5-20.',
  accessibility:'Highly accessible in group format. NADA designed for community settings. Low cost/resource.',
  timeToEffect:'Acute relaxation: minutes. Craving reduction: 20-30 min. Cumulative over weeks.',
  modifications:{pediatric:'Age 5+. Press needles or ear seeds. Shorter (15-20 min).',elderly:'Standard. Gentle. Monitor vasovagal.',groupFormat:'10-30 participants, quiet room, 30-45 min. Minimal verbal. Powerful group dynamic.'},
  keyCitations:['Carter, K.O. et al. (2011). Auricular acupuncture for substance abuse. Am J Addict, 20(1), 11-15.','King, H.C. et al. (2015). Auricular acupuncture for PTSD. Med Acup, 27(1), 42-50.','Pilkington, K. et al. (2007). Acupuncture for anxiety. Acup Med, 25(1-2), 1-10.']
},

'PMR': {
  fullName:'Progressive Muscle Relaxation',
  category:'Behavioral',
  overview:'Systematic tensing/releasing muscle groups. Jacobson (1930s). Muscle tension accompanies anxiety; deliberate release triggers parasympathetic relaxation response. One of most evidence-based relaxation techniques.',
  mechanism:'Deliberate contraction (5-10s) then release → proprioceptive feedback of tension reduction → reduced sympathetic activation. Conditioned relaxation with practice. Reduces cortisol, HR, BP. Reciprocal inhibition: relaxation incompatible with anxiety.',
  neuralTargets:['Somatosensory cortex','Sympathetic NS (reduced)','Parasympathetic (enhanced)','HPA axis','Amygdala (indirect)','Motor cortex'],
  indications:[
    {dx:'GAD',evidence:'A',effectSize:'d=0.57 vs waitlist',notes:'Active component of applied relaxation (Öst).'},
    {dx:'Insomnia',evidence:'A',effectSize:'d=0.53 sleep onset',notes:'Component of CBT-I.'},
    {dx:'Tension Headache',evidence:'A',effectSize:'d=0.55',notes:'Comparable to biofeedback. Rains et al. (2005).'},
    {dx:'Chronic Pain',evidence:'B',effectSize:'d=0.40',notes:'Reduces pain-related muscle guarding.'},
    {dx:'Hypertension',evidence:'B',effectSize:'-5 mmHg systolic',notes:'AHA reasonable adjunct.'},
    {dx:'Panic Disorder',evidence:'B',effectSize:'d=0.35',notes:'Less effective than interoceptive exposure. Useful coping skill.'}
  ],
  protocol:{technique:'16 muscle groups: hands, forearms, biceps, shoulders, forehead, eyes, jaw, neck, chest, abdomen, back, buttocks, thighs, calves, feet. Tense 5-10s, release 15-20s. 20-30 min.',shortForm:'7-group → 4-group → release-only → cue-controlled → applied relaxation.',frequency:'Daily recommended. Min 5x/wk learning phase.',totalSessions:'Therapist-guided: 4-8 to teach. Self-directed: ongoing.',format:'Individual/group. Therapist/audio/self-directed.'},
  contraindications:['Acute muscle injury (skip affected)','Severe chronic pain (release-only, no tension)','Active psychosis (may increase intrusions)','Severe PTSD with body triggers (caution)'],
  sideEffects:['Relaxation-induced anxiety (3-5%)','Muscle soreness from over-tensing','Lightheadedness','Intrusive thoughts','Emotional release'],
  headToHead:[
    {vs:'Diazepam (anxiety)',finding:'Comparable without dependence/tolerance/withdrawal.',cite:'Öst, 1987, Behav Res Ther'},
    {vs:'Meditation',finding:'PMR more concrete/structured for beginners. Meditation stronger long-term DMN.',cite:'Manzoni et al., 2008, Anxiety Stress Coping'}
  ],
  costEstimate:'$0 self-directed. Free audio scripts. Included in therapy sessions.',
  accessibility:'Extremely accessible. No equipment. Anywhere, any time.',
  timeToEffect:'Acute: 20-30 min. Cue-controlled: 4-8 wk daily. Sustained: 2-4 wk.',
  modifications:{pediatric:'Robot/ragdoll game. 6-8 groups. Visual guides. Age 5+.',elderly:'Gentler contractions. Chair-based.',chronic_pain:'Release-only (no tension). Gentle body scan.'},
  keyCitations:['Jacobson, E. (1938). Progressive Relaxation. U Chicago Press.','Öst, L.G. (1987). Applied relaxation. Behav Res Ther, 25(5), 397-409.','Manzoni, G.M. et al. (2008). Relaxation for anxiety: 10-year review. BMC Psychiatry, 8, 41.']
},

'Graded Exercise': {
  fullName:'Graded Exercise Therapy (GET)',
  category:'Movement',
  overview:'Progressive activity increase for deconditioning, exercise avoidance, kinesiophobia. NOTE: GET for CFS/ME controversial — NICE 2021 removed recommendation. Distinction between appropriate progressive exercise and forced activity in post-exertional malaise is clinically critical.',
  mechanism:'Breaks deconditioning cycle: inactivity → reduced fitness → increased perceived effort → avoidance → worse deconditioning. Graded exposure extinguishes kinesiophobia via inhibitory learning.',
  neuralTargets:['Cardiovascular system','HPA axis','Anterior insula (effort perception recalibration)','Amygdala-motor circuits (fear extinction)','Endogenous opioids','Prefrontal cortex (self-efficacy)'],
  indications:[
    {dx:'Fibromyalgia',evidence:'A',effectSize:'d=0.65 fitness; d=0.32 pain',notes:'Bidonde et al. (2017) Cochrane. Pool-based may help.'},
    {dx:'Chronic Low Back Pain',evidence:'A',effectSize:'d=0.52 disability',notes:'First-line. Hayden et al. (2005).'},
    {dx:'Osteoarthritis',evidence:'A',effectSize:'d=0.40 pain; d=0.37 function',notes:'Fransen et al. (2015) Cochrane.'},
    {dx:'CFS/ME',evidence:'CONTROVERSIAL',effectSize:'Contested',notes:'NICE 2021 REMOVED GET recommendation. Contraindicated if confirmed PEM.'},
    {dx:'Post-COVID Deconditioning',evidence:'B',effectSize:'Variable',notes:'WITHOUT PEM only. Screen carefully.'}
  ],
  protocol:{format:'Individual. Physiotherapy-guided.',phases:[{name:'Assessment',sessions:'1-2',content:'Baseline activity. Screen PEM. Start at 50-70% max tolerated.'},{name:'Stabilization',sessions:'3-4',content:'Consistent baseline. No increases.'},{name:'Graduated Increase',sessions:'5-20',content:'+10-20%/wk duration then intensity. Monitor 24-48h. Flare → return previous level.'},{name:'Maintenance',sessions:'Ongoing',content:'Target level. Self-management. Relapse prevention.'}],pacing:'Activity pacing critical. Avoid boom-bust. Time-contingent not symptom-contingent.',monitoring:'Activity diary. 24-48h symptom monitoring. Borg RPE. Step count.'},
  contraindications:['Post-exertional malaise as primary feature (GET CONTRAINDICATED — use pacing)','Unstable cardiac disease','Acute illness','Inflammatory arthropathy flare','Undiagnosed exercise intolerance'],
  sideEffects:['DOMS (expected)','Symptom flare if too rapid','PEM in susceptible populations (this is HARM)','Frustration from slow progress'],
  headToHead:[
    {vs:'CBT for pain',finding:'Combined GET + CBT superior to either alone.',cite:'Williams et al., 2012, Cochrane Database'},
    {vs:'Pacing (CFS/ME)',finding:'NICE 2021: pacing preferred for CFS/ME.',cite:'NICE, 2021, NG206'}
  ],
  costEstimate:'Physio: $75-200/session. Self-directed after guidance: $0.',
  accessibility:'Widely accessible with PT guidance.',
  timeToEffect:'CV improvement: 4-6 wk. Pain reduction: 8-12 wk. Full: 3-6 mo.',
  modifications:{pediatric:'Age-appropriate. Functional goals.',elderly:'Slower progression. Balance. Aquatic.',cfs_me:'DO NOT USE standard GET if PEM confirmed. Adaptive pacing only.'},
  keyCitations:['Bidonde, J. et al. (2017). Exercise for fibromyalgia. Cochrane Database, 6, CD012700.','Hayden, J.A. et al. (2005). Exercise for low back pain. Cochrane Database.','NICE (2021). ME/CFS diagnosis and management. NG206.']
},

'Co-Regulation': {
  fullName:'Co-Regulation / Interpersonal Nervous System Regulation',
  category:'Relational / Autonomic',
  overview:'One person\'s nervous system stabilizes another\'s via social engagement system (ventral vagal), mirror neurons, and oxytocin. Not a discrete technique but neurobiologically grounded framework. LIMEN Phase 2 (Rhythm) is fundamentally co-regulation.',
  mechanism:'Porges polyvagal: VVC mediates social engagement via facial muscles, vocal prosody, middle ear, cardiac vagal tone. Regulated person\'s VVC output provides "neural cues of safety" (neuroception) → activates listener\'s VVC → downregulates sympathetic defense. Mirror neuron system. Oxytocin release → reduced amygdala reactivity, increased trust, enhanced vagal tone.',
  neuralTargets:['Ventral vagal complex','Mirror neuron system','Oxytocin system (PVN → amygdala)','STS (face/voice processing)','Insula (shared interoception)','Amygdala (social safety modulation)'],
  indications:[
    {dx:'Developmental Trauma / Attachment',evidence:'A (framework)',effectSize:'Foundational mechanism',notes:'Bowlby + Porges. Secure attachment IS co-regulation.'},
    {dx:'PTSD',evidence:'B+ (mechanism)',effectSize:'Alliance predicts outcome across treatments',notes:'Wampold (2015).'},
    {dx:'Infant Development',evidence:'A',effectSize:'Maternal sensitivity predicts attachment → lifelong HRV, HPA',notes:'Feldman (2012) bio-behavioral synchrony.'},
    {dx:'ASD',evidence:'B',effectSize:'Relationship-based interventions (DIR/Floortime)',notes:'Social engagement system differences.'},
    {dx:'BPD',evidence:'B (mechanism)',effectSize:'Core mechanism in DBT, MBT',notes:'Co-regulation deficit.'}
  ],
  protocol:{note:'Framework, not discrete technique. Active mechanism in:',applications:[{context:'Therapeutic Relationship',description:'Therapist\'s regulated NS co-regulates client. Why therapist self-care matters.'},{context:'Parent-Infant',description:'Serve-and-return builds neural regulatory circuits.'},{context:'Dyadic Therapy (EFT, AEDP)',description:'Explicitly works with relational NS.'},{context:'Group Therapy/Support',description:'Multiple regulated NSs provide stabilizing field.'},{context:'Body-Based Dyadic',description:'Partner yoga, synchronized breathing.'},{context:'Animal-Assisted',description:'Human-animal co-regulation. Dog-human HRV synchrony.'}],assessment:'HRV synchrony, CIB (Feldman), AAI, WAI.'},
  contraindications:['Forcing engagement on dorsal vagal shutdown can re-traumatize','Active abuse dynamics','Codependency (avoiding self-regulation building)'],
  sideEffects:['Dependency risk in attachment-disrupted','Grief at relationship end','Vicarious dysregulation (burnout)'],
  headToHead:[{vs:'Self-regulation',finding:'Co-regulation precedes self-regulation developmentally. Both necessary.',cite:'Porges, 2011; Schore, 2001'},{vs:'Medication',finding:'Cannot replace co-regulation. SSRIs may facilitate engagement.',cite:'Wampold, 2015'}],
  costEstimate:'Embedded in therapy. Peer support: free. EFT: $150-300/session.',
  accessibility:'Universal in principle. Isolation is primary barrier.',
  timeToEffect:'Acute calming: minutes. Regulatory capacity: months-years. Attachment modification: long-term.',
  modifications:{pediatric:'Primary domain. Theraplay, Circle of Security. Earlier = better.',elderly:'Combat isolation. Group activities. Pet therapy.',telehealth:'Possible but limited. Voice/face transmit. Touch absent. In-person preferred.'},
  keyCitations:['Porges, S.W. (2011). The Polyvagal Theory. Norton.','Feldman, R. (2012). Bio-behavioral synchrony. Dev Rev, 32(3), 199-226.','Schore, A.N. (2001). Secure attachment and right brain development. Infant Ment Health J, 22(1-2), 7-66.','Wampold, B.E. (2015). The Great Psychotherapy Debate, 2nd ed. Routledge.']
}

};

// ═══════════════════════════════════════════════════════════════
// FUZZY MATCHING FUNCTION
// ═══════════════════════════════════════════════════════════════

function findSomaticMonograph(interventionName) {
  if (!interventionName) return null;
  var n = interventionName.toLowerCase().trim();

  // Direct key match
  var keys = Object.keys(SOMATIC_MONOGRAPHS);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === n) return SOMATIC_MONOGRAPHS[keys[i]];
  }

  // Full name match
  for (var i = 0; i < keys.length; i++) {
    var mono = SOMATIC_MONOGRAPHS[keys[i]];
    if (mono.fullName && mono.fullName.toLowerCase() === n) return mono;
  }

  var fuzzyMap = {
    'exercise': 'Exercise', 'aerobic exercise': 'Exercise', 'resistance training': 'Exercise',
    'structured exercise': 'Exercise', 'exercise therapy': 'Exercise', 'physical activity': 'Exercise',
    'running': 'Exercise', 'swimming': 'Exercise', 'walking program': 'Exercise',
    'yoga': 'Yoga', 'yoga therapy': 'Yoga', 'hatha yoga': 'Yoga', 'vinyasa': 'Yoga',
    'kundalini yoga': 'Yoga', 'iyengar yoga': 'Yoga', 'trauma-sensitive yoga': 'Yoga',
    'tsy': 'Yoga', 'yoga nidra': 'Yoga', 'yin yoga': 'Yoga', 'restorative yoga': 'Yoga',
    'asana': 'Yoga',
    'cold exposure': 'Cold Exposure', 'cold water immersion': 'Cold Exposure',
    'cryotherapy': 'Cold Exposure', 'cold therapy': 'Cold Exposure',
    'ice bath': 'Cold Exposure', 'cold shower': 'Cold Exposure',
    'wim hof': 'Cold Exposure', 'cold plunge': 'Cold Exposure',
    'breathwork': 'Breathwork', 'breathing exercises': 'Breathwork',
    'box breathing': 'Breathwork', 'diaphragmatic breathing': 'Breathwork',
    'resonance frequency breathing': 'Breathwork', 'sky breath': 'Breathwork',
    'sudarshan kriya': 'Breathwork', 'physiological sigh': 'Breathwork',
    '4-7-8 breathing': 'Breathwork', 'slow breathing': 'Breathwork',
    'paced breathing': 'Breathwork', 'pranayama': 'Breathwork',
    'breath training': 'Breathwork', 'respiratory training': 'Breathwork',
    'hrv biofeedback': 'HRV Biofeedback', 'heart rate variability biofeedback': 'HRV Biofeedback',
    'heartmath': 'HRV Biofeedback', 'biofeedback': 'HRV Biofeedback',
    'autonomic biofeedback': 'HRV Biofeedback', 'hrv training': 'HRV Biofeedback',
    'float tank': 'Float Tank', 'flotation': 'Float Tank', 'floatation': 'Float Tank',
    'sensory deprivation': 'Float Tank', 'float therapy': 'Float Tank',
    'isolation tank': 'Float Tank', 'floatation-rest': 'Float Tank',
    'rtms': 'rTMS', 'tms': 'rTMS', 'transcranial magnetic stimulation': 'rTMS',
    'repetitive tms': 'rTMS', 'theta burst stimulation': 'rTMS',
    'theta burst': 'rTMS', 'saint protocol': 'rTMS', 'saint': 'rTMS',
    'deep tms': 'rTMS', 'brainsway': 'rTMS',
    'neurofeedback': 'Neurofeedback', 'eeg neurofeedback': 'Neurofeedback',
    'neurotherapy': 'Neurofeedback', 'eeg biofeedback': 'Neurofeedback',
    'brain training': 'Neurofeedback', 'qeeg': 'Neurofeedback',
    'loreta neurofeedback': 'Neurofeedback', 'smr training': 'Neurofeedback',
    'alpha-theta training': 'Neurofeedback',
    'sleep hygiene': 'Sleep Hygiene', 'sleep optimization': 'Sleep Hygiene',
    'sleep architecture': 'Sleep Hygiene', 'circadian rhythm': 'Sleep Hygiene',
    'sleep restriction': 'Sleep Hygiene', 'stimulus control': 'Sleep Hygiene',
    'cbt-i': 'Sleep Hygiene', 'sleep therapy': 'Sleep Hygiene',
    'light therapy': 'Light Therapy', 'bright light therapy': 'Light Therapy',
    'phototherapy': 'Light Therapy', 'light box': 'Light Therapy',
    'dawn simulation': 'Light Therapy', 'chronotherapy': 'Light Therapy',
    'stellate ganglion block': 'Stellate Ganglion Block', 'sgb': 'Stellate Ganglion Block',
    'stellate ganglion': 'Stellate Ganglion Block', 'stellate block': 'Stellate Ganglion Block',
    'dbs': 'DBS', 'deep brain stimulation': 'DBS', 'deep brain': 'DBS',
    'neurostimulation': 'DBS', 'brain stimulation (implanted': 'DBS',
    'acupuncture': 'Acupuncture', 'auricular acupuncture': 'Acupuncture',
    'nada protocol': 'Acupuncture', 'nada': 'Acupuncture',
    'ear acupuncture': 'Acupuncture', 'battlefield acupuncture': 'Acupuncture',
    'ear seeds': 'Acupuncture', 'tavns': 'Acupuncture',
    'transcutaneous vagus': 'Acupuncture', 'vagus nerve stimulation (transcutaneous': 'Acupuncture',
    'pmr': 'PMR', 'progressive muscle relaxation': 'PMR',
    'progressive relaxation': 'PMR', 'muscle relaxation': 'PMR',
    'applied relaxation': 'PMR', 'jacobson relaxation': 'PMR',
    'relaxation training': 'PMR', 'relaxation therapy': 'PMR',
    'graded exercise': 'Graded Exercise', 'graded exercise therapy': 'Graded Exercise',
    'get': 'Graded Exercise', 'graduated exercise': 'Graded Exercise',
    'activity pacing': 'Graded Exercise', 'pacing': 'Graded Exercise',
    'graded activity': 'Graded Exercise',
    'co-regulation': 'Co-Regulation', 'coregulation': 'Co-Regulation',
    'interpersonal regulation': 'Co-Regulation', 'dyadic regulation': 'Co-Regulation',
    'social engagement': 'Co-Regulation', 'ventral vagal': 'Co-Regulation',
    'attachment-based': 'Co-Regulation', 'polyvagal': 'Co-Regulation'
  };

  var fkeys = Object.keys(fuzzyMap);
  for (var f = 0; f < fkeys.length; f++) {
    var key = fkeys[f];
    if (key.length <= 3) {
      var re = new RegExp('(^|\\W)' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\W|$)', 'i');
      if (re.test(n) && fuzzyMap[key]) return SOMATIC_MONOGRAPHS[fuzzyMap[key]];
    } else {
      if (n.indexOf(key) !== -1 && fuzzyMap[key]) return SOMATIC_MONOGRAPHS[fuzzyMap[key]];
    }
  }

  return null;
}

if (typeof module !== 'undefined') module.exports = { SOMATIC_MONOGRAPHS: SOMATIC_MONOGRAPHS, findSomaticMonograph: findSomaticMonograph };
