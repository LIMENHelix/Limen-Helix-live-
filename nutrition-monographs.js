// ═══════════════════════════════════════════════════════════════
// LIMEN HELIX — NUTRITION MONOGRAPH DATABASE
// Clinical reference for nutrition / dietary interventions.
// Not a substitute for clinical guidance. Nutritional interventions
// should be individualized with qualified providers. Evidence levels
// vary. Dietary changes may interact with medications.
// ═══════════════════════════════════════════════════════════════

var NUTRITION_MONOGRAPHS = {

'Omega-3 Fatty Acids': {
  fullName:'Omega-3 Fatty Acids (EPA / DHA)',
  category:'Essential Fatty Acid',
  overview:'Long-chain polyunsaturated fatty acids with anti-inflammatory, neuroprotective, and membrane-modulating properties. EPA drives anti-inflammatory and mood effects; DHA is a structural component of neuronal membranes. The most extensively studied nutritional intervention in psychiatry, with meta-analytic support across depression, ADHD, bipolar, psychosis risk, aggression, and BPD. EPA-dominant formulations (≥60% EPA) consistently outperform DHA-dominant or balanced formulations for mood outcomes.',
  mechanism:'EPA competes with arachidonic acid for COX/LOX enzymes → reduces pro-inflammatory eicosanoids (PGE2, LTB4) and increases anti-inflammatory resolvins and protectins. DHA incorporates into neuronal membrane phospholipids → modulates membrane fluidity, receptor trafficking, and signal transduction. Both reduce NF-κB activation, lower IL-6 and TNF-α, modulate HPA axis, enhance BDNF, and alter dopaminergic and serotonergic neurotransmission. EPA also inhibits phospholipase A2 (elevated in schizophrenia and bipolar).',
  neuralTargets:['Neuronal membrane phospholipids (DHA incorporation)','Inflammatory cascades (NF-κB, COX-2, LOX)','Serotonergic system (5-HT receptor membrane environment)','Dopaminergic system (DA receptor function)','HPA axis (cortisol modulation)','BDNF expression','Prefrontal cortex (structural integrity)','Amygdala (reactivity reduction)'],
  indications:[
    {dx:'MDD',evidence:'A',effectSize:'d=0.28-0.56 (EPA>DHA)',notes:'Liao et al. (2019) meta-analysis of 26 RCTs. EPA ≥60% formulations significantly superior. Optimal: 1-2g EPA/day.'},
    {dx:'Bipolar Disorder',evidence:'B',effectSize:'d=0.34 for depressive episodes',notes:'Sarris et al. (2012). Stoll et al. (1999) landmark RCT. EPA-dominant preferred.'},
    {dx:'ADHD',evidence:'B',effectSize:'d=0.20-0.40',notes:'Bloch & Qawasmi (2011) meta-analysis: modest benefit, particularly for inattention. Higher doses (>1g combined) more effective.'},
    {dx:'Schizophrenia (adjunctive)',evidence:'B',effectSize:'d=0.30-0.45 negative symptoms',notes:'Amminger et al. (2010): ultra-high-risk prevention — 76% reduced conversion at 12 months (landmark).'},
    {dx:'BPD',evidence:'B',effectSize:'d=0.40-0.55 for aggression/impulsivity',notes:'Hallahan et al. (2007): EPA 1.2g reduced aggression and depression in BPD.'},
    {dx:'PTSD',evidence:'B-',effectSize:'d=0.25-0.35',notes:'Matsuoka et al. (2015). Anti-inflammatory mechanism.'},
    {dx:'Antisocial/Conduct Disorder',evidence:'B-',effectSize:'d=0.20-0.35',notes:'Raine et al. (2015): omega-3 reduced antisocial behavior. Gesch et al. (2002): reduced violence in prisoners.'},
    {dx:'Persistent Depressive Disorder',evidence:'B',effectSize:'Extrapolated from MDD',notes:'Chronic inflammatory component supports omega-3 rationale.'},
    {dx:'Schizoaffective Disorder',evidence:'C+',effectSize:'Extrapolated',notes:'Same phospholipase A2 and membrane rationale.'},
    {dx:'Somatic Symptom Disorder',evidence:'C+',effectSize:'Anti-inflammatory',notes:'Systemic inflammation reduction.'},
    {dx:'Tourette\'s Disorder',evidence:'C',effectSize:'Preliminary',notes:'Anti-inflammatory rationale.'},
    {dx:'Gambling Disorder',evidence:'C',effectSize:'Preliminary',notes:'Impulsivity reduction from BPD/ASPD data.'},
    {dx:'Separation Anxiety (Adult)',evidence:'C',effectSize:'Extrapolated',notes:'General anxiolytic effect of EPA.'},
    {dx:'Reactive Attachment Disorder',evidence:'C',effectSize:'Neurodevelopmental',notes:'DHA for brain development; EPA for emotional regulation.'}
  ],
  dosing:{
    standard:'Combined EPA+DHA 1000-2000mg/day',
    moodDisorders:'EPA 1000-2000mg/day (≥60% EPA formulation)',
    adhd:'EPA+DHA combined 1000-2000mg/day',
    psychosis:'EPA 2000-4000mg/day (high-dose adjunctive)',
    form:'Triglyceride form has ~70% better absorption than ethyl ester. Fish oil, krill oil, or algae-derived. Take with fat-containing meal. Enteric-coated reduces fishy burps.',
    foodSources:'Fatty fish (salmon, mackerel, sardines, anchovies): 2-3 servings/week ≈ 500mg EPA+DHA/day. Insufficient alone for most psychiatric indications.',
    onset:'Anti-inflammatory: 4-6 weeks. Mood effects: 4-8 weeks. Full membrane incorporation: 8-12 weeks.'
  },
  sideEffects:['Fishy aftertaste/burps (enteric coating helps)','GI upset, loose stools (dose-dependent)','Mild bruising at high doses','Nausea (take with food)','Rare: increased LDL at very high doses'],
  drugInteractions:['Anticoagulants/antiplatelets: additive bleeding risk >3g/day (monitor INR)','Antihypertensives: may potentiate BP-lowering','Orlistat: reduces absorption','High-dose may increase fasting glucose in diabetics'],
  contraindications:['Fish/shellfish allergy (use algae-derived)','Active bleeding disorders','Pre-surgical: reduce dose 1-2 weeks prior at >3g/day'],
  qualityNotes:'IFOS 5-star certification is gold standard. Test for mercury, PCBs, dioxins. Triglyceride form > ethyl ester. Nordic Naturals, Carlson, WHC brands consistently pass testing.',
  costEstimate:'$15-40/month. Therapeutic doses at higher end.',
  keyCitations:[
    'Liao, Y. et al. (2019). Efficacy of omega-3 PUFAs in depression. Transl Psychiatry, 9(1), 190.',
    'Sublette, M.E. et al. (2011). Meta-analysis of EPA in depression trials. J Clin Psychiatry, 72(12), 1577-1584.',
    'Amminger, G.P. et al. (2010). Omega-3 for indicated prevention of psychotic disorders. Arch Gen Psychiatry, 67(2), 146-154.',
    'Bloch, M.H. & Qawasmi, A. (2011). Omega-3 for ADHD. J Am Acad Child Adolesc Psychiatry, 50(10), 991-1000.',
    'Hallahan, B. et al. (2007). Omega-3 in recurrent self-harm. Br J Psychiatry, 190, 118-122.'
  ]
},

'Magnesium': {
  fullName:'Magnesium',
  category:'Mineral',
  overview:'Essential mineral involved in 600+ enzymatic reactions. Cofactor for neurotransmitter synthesis, NMDA receptor modulation, HPA axis regulation, and GABA function. Deficiency is common (estimated 50% of US population below RDA) and associated with anxiety, depression, insomnia, and migraine. Different forms have different bioavailability and CNS penetrance — glycinate and threonate are preferred for psychiatric indications.',
  mechanism:'NMDA receptor antagonist (blocks calcium channel at physiological concentrations) → reduces glutamate excitotoxicity. Enhances GABA function. Modulates HPA axis → reduces cortisol. Required cofactor for tryptophan hydroxylase (serotonin synthesis) and tyrosine hydroxylase (dopamine/NE synthesis). Regulates neuronal calcium influx. Magnesium threonate (MgT) specifically enhances synaptic magnesium and crosses BBB efficiently.',
  neuralTargets:['NMDA receptors (Mg²⁺ block — reduces excitotoxicity)','GABAergic system (enhances GABA function)','HPA axis (cortisol modulation)','Serotonin synthesis (tryptophan hydroxylase cofactor)','Dopamine/NE synthesis (tyrosine hydroxylase cofactor)','Synaptic plasticity (especially Mg threonate)'],
  indications:[
    {dx:'GAD/Anxiety',evidence:'B',effectSize:'d=0.32-0.45',notes:'Boyle et al. (2017): mild-moderate anxiety. Most effective when baseline Mg status is low.'},
    {dx:'MDD',evidence:'B',effectSize:'d=0.34',notes:'Tarleton et al. (2017): 248mg Mg chloride improved depression comparable to antidepressant in mild-moderate.'},
    {dx:'Insomnia',evidence:'B',effectSize:'d=0.40 for sleep quality',notes:'Abbasi et al. (2012): Mg glycinate improved sleep quality in elderly. 400mg before bed.'},
    {dx:'Migraine Prevention',evidence:'A',effectSize:'Reduced frequency 41%',notes:'400-600mg Mg oxide/citrate daily. AAN Level B recommendation.'},
    {dx:'PMDD',evidence:'B',effectSize:'Symptom reduction (especially with B6)',notes:'Quaranta et al. (2007). Mg + B6 combination.'},
    {dx:'BPD (adjunctive)',evidence:'C+',effectSize:'Preliminary',notes:'NMDA modulation and emotional regulation rationale. Threonate form preferred.'},
    {dx:'PTSD',evidence:'C+',effectSize:'Preliminary',notes:'NMDA modulation may support fear extinction. Threonate form.'},
    {dx:'Tourette Syndrome',evidence:'C',effectSize:'Case reports',notes:'Mg glycinate/citrate as adjunctive.'}
  ],
  dosing:{
    standard:'200-400mg elemental Mg/day',
    therapeutic:'400-600mg/day (divided doses)',
    forms:{
      glycinate:'Best tolerated. Good bioavailability. Calming (glycine is inhibitory). Preferred for anxiety and insomnia. 400mg before bed.',
      threonate:'Specifically designed for CNS penetrance (Magtein patent). Enhances synaptic Mg. Preferred for cognitive function, PTSD, BPD. 1500-2000mg MgT (= ~144mg elemental Mg).',
      citrate:'Good bioavailability. Can cause loose stools (useful for constipation). Migraine prevention.',
      oxide:'Poor bioavailability (4%). Useful mainly as laxative. NOT recommended for psychiatric indications.',
      taurate:'Good bioavailability. Taurine adds additional anxiolytic effect. Cardiovascular benefits.'
    },
    onset:'Muscle relaxation: hours. Anxiety/sleep: 1-2 weeks. Full mood effects: 4-8 weeks.',
    testing:'Serum Mg is a poor marker (only 1% of body Mg is in serum). RBC Mg is more informative. Most people benefit from supplementation regardless of levels.'
  },
  sideEffects:['Loose stools / diarrhea (most common — dose-dependent, form-dependent. Glycinate < citrate < oxide)','Nausea','Abdominal cramping','Rare: hypermagnesemia in renal impairment (monitor in CKD)'],
  drugInteractions:['Bisphosphonates (separate by 2+ hours — Mg reduces absorption)','Antibiotics: fluoroquinolones, tetracyclines (chelation — separate by 2-4 hours)','Diuretics: loop and thiazide diuretics increase Mg excretion (may need higher doses)','Proton pump inhibitors: chronic PPI use reduces Mg absorption','Potassium-sparing diuretics (increased hypermagnesemia risk in renal impairment)'],
  contraindications:['Severe renal impairment (GFR <30) — risk of hypermagnesemia (monitor closely)','Myasthenia gravis (Mg can worsen muscle weakness)','Heart block (Mg affects cardiac conduction)'],
  qualityNotes:'Form matters enormously. Mg oxide is essentially useless for psychiatric purposes. Glycinate (Albion Minerals chelate), threonate (Magtein), and citrate are all acceptable. USP-verified or third-party tested recommended. Elemental Mg content varies by form — check labels carefully.',
  costEstimate:'$10-25/month (glycinate/citrate). $25-40/month (threonate/Magtein).',
  keyCitations:[
    'Tarleton, E.K. et al. (2017). Role of magnesium supplementation in treatment of depression. PLoS ONE, 12(6), e0180067.',
    'Boyle, N.B. et al. (2017). The effects of magnesium supplementation on subjective anxiety and stress. Nutrients, 9(5), 429.',
    'Abbasi, B. et al. (2012). The effect of magnesium supplementation on insomnia in elderly. J Res Med Sci, 17(12), 1161-1169.',
    'Slutsky, I. et al. (2010). Enhancement of learning and memory by elevating brain magnesium. Neuron, 65(2), 165-177.'
  ]
},

'L-Theanine': {
  fullName:'L-Theanine',
  category:'Amino Acid',
  overview:'Non-essential amino acid found primarily in green tea (Camellia sinensis). Crosses the blood-brain barrier and produces calming effects without sedation by modulating alpha brain wave activity, enhancing GABA, and reducing glutamate excitotoxicity. One of the best-tolerated anxiolytic supplements with rapid onset.',
  mechanism:'Crosses BBB within 30-60 minutes. Increases alpha wave activity (8-13 Hz) → relaxed alertness without drowsiness. Modulates GABA, serotonin, and dopamine levels. Partial antagonist at AMPA glutamate receptors → reduces excitotoxicity. Increases BDNF in hippocampus (animal data). Does NOT bind GABA-A receptors directly (unlike benzodiazepines) — mechanism is distinct.',
  neuralTargets:['Cortical alpha oscillations (8-13 Hz enhancement)','GABAergic system (indirect enhancement)','Glutamatergic system (AMPA partial antagonism)','Serotonergic system (5-HT modulation)','Dopaminergic system (DA modulation)','Hippocampus (BDNF — animal data)'],
  indications:[
    {dx:'GAD/Anxiety',evidence:'B',effectSize:'d=0.40-0.52',notes:'Hidese et al. (2019): 200mg/day reduced stress and anxiety. Ritsner et al. (2011): augmentation in schizophrenia.'},
    {dx:'Panic Disorder',evidence:'C+',effectSize:'Preliminary',notes:'Acute anxiolytic via alpha wave enhancement. 200mg as-needed.'},
    {dx:'Social Anxiety',evidence:'C+',effectSize:'Preliminary',notes:'Pre-exposure dosing (200mg 30-60 min before).'},
    {dx:'Insomnia (sleep quality)',evidence:'B',effectSize:'d=0.35',notes:'Improves sleep quality without sedation. 200-400mg before bed. Lyon et al. (2011).'},
    {dx:'ADHD (adjunctive)',evidence:'B',effectSize:'d=0.30',notes:'Lyon et al. (2011): improved sleep quality in boys with ADHD. May help with attention via alpha enhancement.'},
    {dx:'Stress/Performance Anxiety',evidence:'B',effectSize:'Reduced subjective stress',notes:'Kimura et al. (2007): reduced heart rate and salivary IgA during stress task.'}
  ],
  dosing:{
    standard:'100-200mg once or twice daily',
    therapeutic:'200-400mg/day for anxiety. Up to 600mg/day in studies.',
    acute:'200mg 30-60 minutes before stressor (situational use)',
    form:'Capsules or powder. Can take with or without food. Often combined with caffeine for focused calm (100mg L-theanine + 50mg caffeine is a well-studied nootropic stack).',
    onset:'Acute: 30-60 minutes (alpha wave changes measurable within 40 min). Sustained benefit: 2-4 weeks daily use.'
  },
  sideEffects:['Extremely well tolerated','Mild headache (rare)','GI upset (rare)','Slight dizziness (rare, at high doses)','No known sedation, dependence, or withdrawal'],
  drugInteractions:['Antihypertensives (may have additive BP-lowering effect — minor)','Stimulants (L-theanine may blunt stimulant jitteriness — often used deliberately with caffeine)','Sedatives (theoretical additive calming — clinical significance minimal)'],
  contraindications:['None established','Pregnancy/lactation: insufficient data (likely safe at tea-intake levels)','Tea allergy (theoretical)'],
  qualityNotes:'Suntheanine is a patented, pure L-isomer form with most clinical data. Generic L-theanine from reputable manufacturers is also acceptable. Well-characterized compound — quality less variable than herbal supplements.',
  costEstimate:'$10-20/month.',
  keyCitations:[
    'Hidese, S. et al. (2019). Effects of L-theanine administration on stress-related symptoms and cognitive function. Nutrients, 11(10), 2362.',
    'Kimura, K. et al. (2007). L-theanine reduces psychological and physiological stress responses. Biol Psychol, 74(1), 39-45.',
    'Lyon, M.R. et al. (2011). The effects of L-theanine on sleep quality in ADHD. Altern Med Rev, 16(4), 348-354.',
    'Nobre, A.C. et al. (2008). L-theanine, a natural constituent in tea, and its effect on mental state. Asia Pac J Clin Nutr, 17(Suppl 1), 167-168.'
  ]
},

'Iron': {
  fullName:'Iron (Ferrous / Ferritin Optimization)',
  category:'Essential Mineral',
  overview:'Critical cofactor for dopamine synthesis (tyrosine hydroxylase), myelin formation, and mitochondrial function. Deficiency without anemia is associated with ADHD symptoms, cognitive impairment, fatigue, and poor stimulant response. Serum ferritin <45 ng/mL is the psychiatric threshold — brain iron depletion occurs well before anemia. Universal screening recommended in ADHD and developmental disorders.',
  mechanism:'Required cofactor for tyrosine hydroxylase (dopamine/NE synthesis), tryptophan hydroxylase (serotonin), myelination, and mitochondrial electron transport. Brain iron depletion at ferritin <45 impairs striatal dopamine receptor density (Konofal et al., 2008).',
  neuralTargets:['Dopamine synthesis (TH cofactor)','Norepinephrine synthesis','Serotonin synthesis (TPH cofactor)','Striatal dopamine receptor density','Myelination','Mitochondrial electron transport','Basal ganglia (iron-rich region)'],
  indications:[
    {dx:'ADHD',evidence:'B+',effectSize:'d=0.50-0.70 when ferritin <45',notes:'Konofal et al. (2008): iron improved ADHD symptoms. Cortese et al. (2012): ferritin inversely correlates with severity. Screen all ADHD patients.'},
    {dx:'Reactive Attachment Disorder',evidence:'C+',effectSize:'Neurodevelopmental',notes:'Iron critical for brain development. Institutional/neglected children high risk.'},
    {dx:'Oppositional Defiant Disorder',evidence:'C+',effectSize:'Extrapolated from ADHD',notes:'Dopamine synthesis impairment may contribute to dysregulation.'},
    {dx:'Restless Legs (comorbid)',evidence:'A',effectSize:'d=0.60-0.80 when ferritin <75',notes:'Allen et al. (2013). Often comorbid with ADHD.'}
  ],
  dosing:{
    standard:'Elemental iron 30-65mg/day',
    pediatric:'3-6mg/kg/day elemental',
    form:'Ferrous bisglycinate (best tolerated). Sulfate (most studied, more GI effects). Take empty stomach with vitamin C. Avoid with calcium, tea, coffee, dairy.',
    foodSources:'Heme iron (best absorbed): red meat, organ meats, shellfish. Non-heme: spinach, lentils, fortified cereals (add vitamin C). Cast iron cooking adds iron.',
    monitoring:'Check ferritin BEFORE supplementing. Recheck 3 months. Target: 50-100 ng/mL. Do NOT supplement without documented deficiency.',
    onset:'4-8 weeks improvement. Full repletion: 3-6 months.'
  },
  sideEffects:['Constipation (most common)','Nausea, abdominal pain','Black stools (expected)','Metallic taste'],
  drugInteractions:['Levothyroxine (separate 4 hours)','Tetracyclines, fluoroquinolones (separate 2 hours)','Antacids, PPIs (reduce absorption)','Levodopa (separate 2 hours)'],
  contraindications:['Hemochromatosis','Repeated transfusions','Do NOT supplement without ferritin level','Hemolytic anemias','Active GI ulceration'],
  qualityNotes:'Ferrous bisglycinate (Ferrochel) best tolerated. Slow-release reduces GI but may lower absorption. Always check ferritin first.',
  costEstimate:'$5-15/month.',
  keyCitations:[
    'Konofal, E. et al. (2008). Iron supplementation in ADHD children. Pediatr Neurol, 38(1), 20-26.',
    'Cortese, S. et al. (2012). Brain iron levels in ADHD. World J Biol Psychiatry, 13(3), 223-231.',
    'Allen, R.P. et al. (2013). Iron treatment of restless legs syndrome. Sleep Med, 14(12), 1253-1267.'
  ]
},

'Zinc': {
  fullName:'Zinc',
  category:'Essential Mineral',
  overview:'Trace mineral essential for >100 enzymatic reactions including neurotransmitter synthesis, synaptic plasticity, and HPA axis regulation. Concentrated in glutamatergic neurons of hippocampus and cortex. Deficiency associated with depression, ADHD, and anorexia nervosa. Zinc augmentation of SSRIs accelerates antidepressant response.',
  mechanism:'Modulates NMDA receptors (allosteric inhibition). Required cofactor for BDNF synthesis. Regulates hippocampal glutamate release. Anti-inflammatory (inhibits NF-κB). Modulates HPA axis cortisol. Required for B6 activation (PLP). Concentrated in hippocampal mossy fiber synapses.',
  neuralTargets:['NMDA receptors (allosteric inhibition)','BDNF synthesis','Hippocampal glutamate signaling','NF-κB pathway','HPA axis','Synaptic plasticity'],
  indications:[
    {dx:'ADHD',evidence:'B',effectSize:'d=0.30-0.50',notes:'Bilici et al. (2004): zinc 150mg/day improved symptoms. Akhondzadeh et al. (2004): zinc + methylphenidate superior.'},
    {dx:'Anorexia Nervosa',evidence:'B',effectSize:'d=0.40',notes:'Birmingham et al. (1994): 14mg/day doubled weight gain rate. Zinc deficiency universal in AN.'},
    {dx:'MDD (augmentation)',evidence:'B',effectSize:'d=0.30-0.45',notes:'Swardfager et al. (2013): serum zinc lower in depression. Ranjbar et al. (2014): zinc augmentation of SSRI.'},
    {dx:'ODD',evidence:'C+',effectSize:'Extrapolated from ADHD',notes:'Dopamine synthesis and emotional regulation.'},
    {dx:'Reactive Attachment Disorder',evidence:'C+',effectSize:'Neurodevelopmental',notes:'Neglected children high deficiency risk.'}
  ],
  dosing:{
    standard:'15-30mg elemental zinc/day',
    anorexia:'14mg/day (Birmingham protocol)',
    adhd:'15-25mg/day',
    form:'Zinc picolinate or bisglycinate (best absorbed). Avoid oxide. Take with food. Separate from iron.',
    foodSources:'Oysters (richest), red meat, poultry, beans, nuts, dairy. Vegetarians/vegans at higher risk.',
    monitoring:'Serum zinc. Long-term >40mg/day requires copper co-supplementation (1-2mg).',
    onset:'2-4 weeks.'
  },
  sideEffects:['Nausea (take with food)','Metallic taste','Copper depletion >40mg/day chronic','Reduced immune function at very high doses (paradoxical)'],
  drugInteractions:['Penicillamine (separate 2 hours)','Tetracyclines, fluoroquinolones (chelation)','Thiazide diuretics (increase zinc excretion)','Iron (compete for absorption)'],
  contraindications:['Wilson\'s disease','Copper deficiency','Do not exceed 40mg/day long-term without monitoring'],
  qualityNotes:'Picolinate and bisglycinate best absorbed. Sulfate cheap but more GI upset.',
  costEstimate:'$5-15/month.',
  keyCitations:[
    'Bilici, M. et al. (2004). Zinc sulfate in ADHD. Prog Neuropsychopharmacol Biol Psychiatry, 28(1), 181-190.',
    'Birmingham, C.L. et al. (1994). Zinc in anorexia nervosa. Int J Eat Disord, 15(3), 251-255.',
    'Swardfager, W. et al. (2013). Zinc in depression: A meta-analysis. Biol Psychiatry, 74(12), 872-878.'
  ]
},

'Vitamin D': {
  fullName:'Vitamin D (Cholecalciferol / D3)',
  category:'Fat-Soluble Vitamin / Neurosteroid',
  overview:'Fat-soluble vitamin functioning as a neurosteroid with receptors throughout the brain (VDR). Deficiency (<20 ng/mL) is endemic (~40% of US adults) and associated with depression, schizophrenia, autism, and cognitive decline. Vitamin D modulates serotonin synthesis, neuroinflammation, neuroprotection, and neurodevelopment. D3 (cholecalciferol) is the preferred supplemental form.',
  mechanism:'Vitamin D receptor (VDR) expressed in hippocampus, prefrontal cortex, amygdala, and substantia nigra. Regulates gene expression for tryptophan hydroxylase 2 (TPH2) → serotonin synthesis in the brain. Anti-inflammatory: reduces NF-κB activity, TNF-α, IL-6. Neuroprotective: upregulates nerve growth factor (NGF) and GDNF. Modulates calcium signaling and glutamate homeostasis. During neurodevelopment: critical for brain patterning, neuronal differentiation.',
  neuralTargets:['VDR-expressing brain regions (hippocampus, PFC, amygdala)','Serotonin synthesis (TPH2 regulation)','Inflammatory pathways (NF-κB suppression)','Neuroprotective factors (NGF, GDNF)','Calcium/glutamate signaling','Neurodevelopmental pathways'],
  indications:[
    {dx:'MDD',evidence:'B',effectSize:'d=0.28-0.58 (most benefit when deficient)',notes:'Vellekkatt & Menon (2019) meta-analysis positive. Strongest effect in deficient individuals (25-OH-D <20 ng/mL).'},
    {dx:'Schizophrenia',evidence:'B',effectSize:'Deficiency prevalence 65-80% in schizophrenia',notes:'Valipour et al. (2014). Prenatal deficiency is risk factor. Supplementation may improve negative symptoms.'},
    {dx:'ASD',evidence:'B',effectSize:'d=0.35',notes:'Saad et al. (2018): 300 IU/kg/day improved core ASD symptoms. High prevalence of deficiency in ASD.'},
    {dx:'Cognitive Decline',evidence:'B',effectSize:'Deficiency associated with 2x dementia risk',notes:'Littlejohns et al. (2014). Prevention focus.'},
    {dx:'SAD (Seasonal Affective)',evidence:'C+',effectSize:'Mixed results',notes:'May partially address winter deficiency. Light therapy remains first-line.'},
    {dx:'Somatic Symptom Disorder',evidence:'C',effectSize:'Adjunctive',notes:'Widespread pain and fatigue association.'}
  ],
  dosing:{
    standard:'2000-4000 IU/day (maintenance for most adults)',
    therapeutic:'5000-10,000 IU/day for deficiency repletion (8-12 weeks, then maintenance)',
    monitoring:'Check 25-OH-D level. Target: 40-60 ng/mL. Recheck at 3 months.',
    form:'D3 (cholecalciferol) preferred over D2 (ergocalciferol). Take with fat-containing meal for absorption. Liquid, softgel, or tablet.',
    onset:'Serum level increase: 4-8 weeks. Mood effects: 8-12 weeks (if deficient).'
  },
  sideEffects:['Generally very safe at recommended doses','Hypercalcemia (at very high doses >10,000 IU/day chronically without monitoring)','Kidney stones (rare, at high doses with high calcium intake)','GI upset (uncommon)','Hypervitaminosis D symptoms: nausea, weakness, confusion (toxic levels >100 ng/mL)'],
  drugInteractions:['Thiazide diuretics (increased calcium retention → hypercalcemia risk)','Corticosteroids (reduce vitamin D metabolism)','Orlistat/cholestyramine (reduce fat-soluble vitamin absorption)','Statins (some evidence of interaction — clinical significance unclear)','Calcipotriene (topical vitamin D analog — additive hypercalcemia)'],
  contraindications:['Hypercalcemia','Hyperparathyroidism (may worsen)','Granulomatous diseases (sarcoidosis, tuberculosis — increased 1,25-D conversion)','Severe renal disease (impaired conversion — may need calcitriol instead)'],
  qualityNotes:'D3 > D2. Most formulations are adequate. USP-verified or third-party tested for dose accuracy. Combination with K2 (MK-7) is popular but evidence for synergy is limited to bone health, not psychiatric indications. Monitor levels with blood test.',
  costEstimate:'$5-15/month. Very inexpensive.',
  keyCitations:[
    'Vellekkatt, F. & Menon, V. (2019). Efficacy of vitamin D supplementation in MDD: A systematic review and meta-analysis. J Postgrad Med, 65(2), 74-80.',
    'Littlejohns, T.J. et al. (2014). Vitamin D and risk of dementia and Alzheimer disease. Neurology, 83(10), 920-928.',
    'Saad, K. et al. (2018). Randomized controlled trial of vitamin D supplementation in children with ASD. J Child Psychol Psychiatry, 59(1), 20-29.',
    'Anglin, R.E. et al. (2013). Vitamin D deficiency and depression in adults. Br J Psychiatry, 202, 100-107.'
  ]
},

'B Vitamins': {
  fullName:'B Vitamins (B-Complex / Folate / B12 / B6)',
  category:'Water-Soluble Vitamin Complex',
  overview:'Essential for one-carbon metabolism (methylation), neurotransmitter synthesis, myelin maintenance, and homocysteine clearance. Folate (B9) and B12 critical for methylation — deficiency raises neurotoxic homocysteine. B6 is cofactor for serotonin and dopamine synthesis. 30-40% of population has impaired MTHFR conversion of folic acid to active methylfolate.',
  mechanism:'Folate (as L-5-MTHF) is methyl donor for homocysteine → methionine → SAMe (universal methyl donor for >100 reactions). B12 is cofactor. B6 (as PLP) is cofactor for AADC (final step in serotonin and dopamine synthesis) and GAD (GABA synthesis). Homocysteine elevation is directly neurotoxic via NMDA activation and oxidative stress.',
  neuralTargets:['One-carbon/methylation cycle','SAMe synthesis','Serotonin synthesis (B6 as AADC cofactor)','Dopamine synthesis (B6 as AADC cofactor)','GABA synthesis (B6 as GAD cofactor)','Homocysteine clearance','Myelin maintenance (B12)'],
  indications:[
    {dx:'Schizophrenia',evidence:'B',effectSize:'d=0.30-0.45',notes:'Roffman et al. (2013): folate + B12 improved negative symptoms in MTHFR C677T carriers.'},
    {dx:'MDD (treatment-resistant)',evidence:'B',effectSize:'d=0.40-0.60 in folate-deficient',notes:'Papakostas et al. (2012): L-methylfolate 15mg/day augmented SSRI. Test MTHFR, folate, B12, homocysteine.'},
    {dx:'PMDD',evidence:'B',effectSize:'d=0.35',notes:'Wyatt et al. (1999): B6 50-100mg/day reduced PMS symptoms. Synergistic with magnesium.'},
    {dx:'Conversion Disorder/FND',evidence:'C+',effectSize:'Stress-depletion',notes:'Chronic stress depletes B vitamins. B-complex as nutritional rehabilitation.'},
    {dx:'Cognitive Decline Prevention',evidence:'B',effectSize:'d=0.25-0.40',notes:'Smith et al. (2010): B6+B12+folate slowed brain atrophy in MCI with elevated homocysteine.'}
  ],
  dosing:{
    folate:'L-methylfolate 400-1000mcg/day; 15mg/day Rx for SSRI augmentation (Deplin)',
    b12:'Methylcobalamin 1000mcg/day sublingual. IM for pernicious anemia.',
    b6:'25-50mg/day general. 50-100mg/day PMDD (do not exceed 200mg/day — neuropathy).',
    bComplex:'Active forms: methylfolate, methylcobalamin, P5P. Daily.',
    form:'Active/methylated forms critical: L-methylfolate (NOT folic acid), methylcobalamin (NOT cyanocobalamin), P5P (NOT pyridoxine HCl).',
    foodSources:'Folate: dark leafy greens, legumes. B12: meat, fish, eggs, dairy (vegans MUST supplement). B6: poultry, fish, potatoes.',
    monitoring:'Serum B12, folate, homocysteine. MMA for functional B12 deficiency. MTHFR genotyping if treatment-resistant.',
    onset:'2-4 weeks. Homocysteine normalization: 4-8 weeks.'
  },
  sideEffects:['Generally well tolerated','B6 >200mg/day: peripheral neuropathy (reversible)','Folate can mask B12 deficiency — always supplement together','Rare: acne with high-dose B12'],
  drugInteractions:['Methotrexate (folate antagonist)','Phenytoin (reduces folate; folate may reduce seizure threshold)','Levodopa (B6 reduces efficacy — use with carbidopa)','PPIs (reduce B12 absorption)','Metformin (reduces B12 absorption)'],
  contraindications:['B6: do not exceed 200mg/day','Folate without B12 in possible B12 deficiency','Coronary stent (NORVIT trial concern — controversial)'],
  qualityNotes:'Methylated forms critical for MTHFR carriers. Look for L-5-MTHF, methylcobalamin, P5P. Thorne, Jarrow, Seeking Health specialize.',
  costEstimate:'$10-25/month. Rx L-methylfolate $30-100+/month.',
  keyCitations:[
    'Papakostas, G.I. et al. (2012). L-methylfolate for SSRI-resistant MDD. Am J Psychiatry, 169(12), 1267-1274.',
    'Roffman, J.L. et al. (2013). Folate + B12 in schizophrenia. JAMA Psychiatry, 70(5), 481-489.',
    'Wyatt, K.M. et al. (1999). B6 in PMS. BMJ, 318(7195), 1375-1381.',
    'Smith, A.D. et al. (2010). Homocysteine-lowering B vitamins slow brain atrophy in MCI. PLoS ONE, 5(9), e12244.'
  ]
},

'Calcium': {
  fullName:'Calcium',
  category:'Essential Mineral',
  overview:'Most abundant mineral in the body with roles in neuronal excitability, neurotransmitter release, and hormone secretion. Primary psychiatric indication is PMDD, where it has Level A evidence. Estrogen fluctuations alter calcium homeostasis — supplementation stabilizes calcium-dependent neuronal processes disrupted by hormonal cycling.',
  mechanism:'Required for vesicular neurotransmitter release. Intracellular calcium signaling (calmodulin, CaMKII) regulates synaptic plasticity and LTP. In PMDD: estrogen alters calcium homeostasis — supplementation stabilizes calcium-dependent processes. Low calcium associated with increased PMS severity.',
  neuralTargets:['Synaptic vesicle release','Calmodulin/CaMKII signaling','Neuronal excitability','Hormone-calcium interaction'],
  indications:[
    {dx:'PMDD',evidence:'A',effectSize:'d=0.45-0.65',notes:'Thys-Jacobs et al. (1998): 1200mg/day reduced PMS symptoms 48%. First-line nutritional intervention for PMDD.'},
    {dx:'PMS (mood symptoms)',evidence:'A',effectSize:'d=0.50',notes:'Multiple RCTs. 1200mg/day throughout cycle.'}
  ],
  dosing:{
    standard:'1000-1200mg/day elemental calcium',
    pmdd:'1200mg/day divided BID',
    form:'Carbonate (most calcium/tablet, take with food). Citrate (better absorbed, can take without food, preferred on PPI).',
    foodSources:'Dairy, fortified plant milks, sardines with bones, kale, bok choy. NOT spinach (oxalates block absorption).',
    onset:'1-2 menstrual cycles for PMDD.'
  },
  sideEffects:['Constipation (carbonate > citrate)','Bloating','Rare: kidney stones >2000mg/day','Possible CV risk >1500mg/day (controversial)'],
  drugInteractions:['Iron (reduces absorption — separate 2 hours)','Levothyroxine (separate 4 hours)','Tetracyclines, fluoroquinolones (chelation)','Bisphosphonates (separate 30 min)','Thiazides (reduce excretion — monitor)'],
  contraindications:['Hypercalcemia','Hyperparathyroidism','Severe kidney disease','Calcium kidney stone history (use citrate, increase fluids)'],
  qualityNotes:'Carbonate cheapest but requires stomach acid. Citrate better for PPI users. Max 500-600mg per dose. Co-supplement D3 and K2.',
  costEstimate:'$5-15/month.',
  keyCitations:[
    'Thys-Jacobs, S. et al. (1998). Calcium and PMS. Am J Obstet Gynecol, 179(2), 444-452.',
    'Ghanbari, Z. et al. (2009). Calcium in PMS. Taiwan J Obstet Gynecol, 48(2), 124-129.'
  ]
},

'Creatine': {
  fullName:'Creatine (Monohydrate)',
  category:'Amino Acid Derivative / Bioenergetic',
  overview:'Naturally occurring energy reservoir for tissues with high metabolic demand. Brain uses 20% of body energy. Supplementation increases brain phosphocreatine (verified by MRS). Emerging evidence for depression augmentation, particularly in women, through brain energy metabolism enhancement.',
  mechanism:'Creatine + ATP → phosphocreatine (PCr) via creatine kinase. PCr serves as immediate energy buffer. Brain PCr stores increase with supplementation. Proposed to improve PFC function, support neurotransmitter synthesis (ATP-dependent), reduce oxidative stress, enhance mitochondrial function.',
  neuralTargets:['Brain phosphocreatine stores','Prefrontal cortex (high metabolic demand)','Mitochondrial function','Neurotransmitter synthesis (ATP-dependent)','NMDA receptor modulation'],
  indications:[
    {dx:'MDD',evidence:'B',effectSize:'d=0.35-0.55',notes:'Kious et al. (2019) review. Lyoo et al. (2012): 5g/day + SSRI superior in women.'},
    {dx:'MDD (female-specific)',evidence:'B+',effectSize:'d=0.50-0.65',notes:'Women show stronger augmentation effect. May relate to hormonal effects on creatine metabolism.'}
  ],
  dosing:{
    standard:'3-5g/day creatine monohydrate',
    depression:'5g/day (studied dose for MDD augmentation)',
    form:'Monohydrate (most studied, cheapest). Micronized for mixing. No loading phase needed. Dissolves in water.',
    foodSources:'Red meat (~2g/lb), fish. Vegetarians have lower baseline and may show larger response.',
    onset:'Brain PCr increase: 2 weeks. Mood effects: 2-4 weeks.'
  },
  sideEffects:['Water retention/weight gain 1-3 lbs (intracellular)','GI upset at high doses','Muscle cramping (stay hydrated)','Very well tolerated at 3-5g/day'],
  drugInteractions:['Nephrotoxic medications (monitor renal)','Caffeine may reduce benefit (inconclusive)'],
  contraindications:['Severe renal impairment (GFR <30)','Pre-existing kidney disease','Bipolar I: theoretical mania risk (not established — use with caution)'],
  qualityNotes:'Monohydrate is gold standard. Creapure (German) most tested. Other forms no proven advantage. NSF Certified for Sport available.',
  costEstimate:'$8-15/month. Very cheap.',
  keyCitations:[
    'Lyoo, I.K. et al. (2012). Creatine augmentation of SSRI in women with MDD. Am J Psychiatry, 169(9), 937-945.',
    'Kious, B.M. et al. (2019). Creatine for depression. Biomolecules, 9(9), 406.'
  ]
},

'Inositol': {
  fullName:'Inositol (Myo-inositol)',
  category:'Sugar Alcohol / Second Messenger Precursor',
  overview:'Naturally occurring sugar alcohol functioning as second messenger in the phosphatidylinositol (PI) signaling system — the intracellular transduction pathway for serotonin (5-HT2), norepinephrine, and cholinergic receptors. High-dose (12-18g/day) supplementation has evidence in OCD, panic disorder, and depression. Well-tolerated despite high doses. Lithium works via inositol depletion — exogenous inositol works the same pathway from opposite direction.',
  mechanism:'Precursor for PIP2, cleaved by PLC into IP3 and DAG — major second messengers for 5-HT2, alpha-1, muscarinic, and other Gq-coupled receptors. High-dose increases PI turnover → enhances serotonergic signaling downstream of receptor activation.',
  neuralTargets:['PI signaling cycle','5-HT2 receptor second messenger','Noradrenergic receptor signaling','Prefrontal cortex (OCD circuitry)','Amygdala-prefrontal coupling','Orbitofrontal cortex'],
  indications:[
    {dx:'OCD',evidence:'B',effectSize:'d=0.40-0.55',notes:'Fux et al. (1996): 18g/day significantly reduced OCD symptoms. Comparable to fluvoxamine.'},
    {dx:'Panic Disorder',evidence:'B',effectSize:'d=0.45',notes:'Benjamin et al. (1995): 12g/day reduced panic frequency. Comparable to fluvoxamine.'},
    {dx:'Body Dysmorphic Disorder',evidence:'C+',effectSize:'OCD-spectrum',notes:'Same PI signaling mechanism. 12-18g/day.'},
    {dx:'Depression',evidence:'B-',effectSize:'d=0.25-0.35',notes:'Levine et al. (1995). Less consistent than for OCD/panic.'}
  ],
  dosing:{
    standard:'12-18g/day powder in water or juice',
    ocd:'18g/day divided TID (6g × 3)',
    panic:'12g/day divided BID-TID',
    form:'Powder dissolved in liquid (capsules impractical — would need 24-36/day). Myo-inositol is the studied form. Slightly sweet taste.',
    foodSources:'Citrus fruits, beans, grains, nuts contain ~1g/day — far below therapeutic doses.',
    onset:'2-4 weeks initial. Full benefit: 4-6 weeks.'
  },
  sideEffects:['GI: gas, bloating, loose stools (start low, titrate up)','Nausea','Generally well-tolerated at high doses'],
  drugInteractions:['Lithium: theoretical antagonism (same pathway)','SSRIs: may be additive','Carbamazepine: also affects inositol pathway'],
  contraindications:['Bipolar disorder (theoretical mania risk — use with psychiatric supervision)','Pregnancy at high doses (not studied)'],
  qualityNotes:'Myo-inositol is the correct form. Bulk powder essential. D-chiro-inositol is different (PCOS applications). Jarrow, NOW Foods offer pharmaceutical-grade.',
  costEstimate:'$20-40/month at therapeutic doses.',
  keyCitations:[
    'Fux, M. et al. (1996). Inositol treatment of OCD. Am J Psychiatry, 153(9), 1219-1221.',
    'Benjamin, J. et al. (1995). Inositol for panic disorder. Am J Psychiatry, 152(7), 1084-1086.',
    'Levine, J. et al. (1995). Inositol for depression. Am J Psychiatry, 152(5), 792-794.'
  ]
},

'Probiotics': {
  fullName:'Probiotics / Psychobiotics',
  category:'Gut-Brain Axis / Microbiome',
  overview:'Specific probiotic strains ("psychobiotics") with demonstrated effects on brain function via the gut-brain axis. Gut microbiome produces ~95% of body serotonin, synthesizes GABA, modulates vagus nerve, regulates intestinal permeability, and controls peripheral inflammation. Dysbiosis documented in depression, anxiety, autism, and schizophrenia. Strain specificity is critical.',
  mechanism:'Gut-brain communication via: (1) Vagus nerve — direct neural signaling (L. rhamnosus effects blocked by vagotomy). (2) Immune modulation — reduce TNF-α, IL-6, CRP. (3) Neurotransmitter production — Lactobacillus produces GABA; bacteria regulate tryptophan for serotonin. (4) HPA axis modulation — reduce cortisol. (5) SCFA production — butyrate, propionate are anti-inflammatory and neuroactive.',
  neuralTargets:['Vagus nerve (gut-brain signaling)','Serotonin synthesis (tryptophan availability)','GABA production (Lactobacillus)','HPA axis (cortisol modulation)','Inflammatory pathways (gut barrier, LPS)','Enteric nervous system','Hippocampus (BDNF via SCFA)'],
  indications:[
    {dx:'MDD',evidence:'B',effectSize:'d=0.30-0.50',notes:'Liu et al. (2019) meta-analysis positive. Akkasheh et al. (2016): multi-strain reduced BDI scores. L. helveticus + B. longum most studied.'},
    {dx:'Anxiety',evidence:'B-',effectSize:'d=0.25-0.40',notes:'Reis et al. (2018). Strain-specific effects.'},
    {dx:'ASD',evidence:'B-',effectSize:'d=0.20-0.35',notes:'Kang et al. (2017): microbiota transfer improved GI and ASD symptoms. Gut dysbiosis well-documented.'},
    {dx:'IBS + psychiatric comorbidity',evidence:'B',effectSize:'d=0.35-0.50',notes:'B. infantis 35624 (Alflorex/Align) specifically studied.'}
  ],
  dosing:{
    standard:'Multi-strain, 10-50 billion CFU/day',
    psychobiotic:'L. helveticus R0052 + B. longum R0175 (Cerebiome): 3 billion CFU/day — most studied combination',
    form:'Refrigerated for live cultures. Capsules preferred. With or before meals.',
    foodSources:'Yogurt (live cultures), kefir, sauerkraut, kimchi, miso, tempeh, kombucha. Diverse fermented food consumption increases microbiome diversity.',
    prebiotics:'Feed the probiotics: vegetables, fruits, legumes, whole grains. Inulin, FOS, GOS. 5-10g/day fiber.',
    onset:'GI: 1-2 weeks. Mood/anxiety: 4-8 weeks. Microbiome shift: 4-12 weeks.'
  },
  sideEffects:['Gas, bloating (usually transient 1-2 weeks)','Change in bowel habits','Rare: bacteremia in severely immunocompromised'],
  drugInteractions:['Antibiotics: reduce efficacy (take 2+ hours apart)','Immunosuppressants: theoretical risk in immunocompromised','Antifungals: may reduce S. boulardii'],
  contraindications:['Severe immunocompromise (transplant, chemo, AIDS)','Short bowel syndrome','Central venous catheter','Critical illness'],
  qualityNotes:'Strain specificity critical. Look for studied strains with species + strain designation. Third-party CFU count testing (ConsumerLab finds ~25% undercount). Seed, Visbiome, Culturelle, Align generally well-tested.',
  costEstimate:'$20-50/month.',
  keyCitations:[
    'Liu, R.T. et al. (2019). Prebiotics and probiotics for depression and anxiety. BMJ, 366, l4396.',
    'Akkasheh, G. et al. (2016). Probiotic in MDD. Nutrition, 32(3), 315-320.',
    'Kang, D.W. et al. (2017). Microbiota transfer therapy in ASD. Microbiome, 5(1), 10.',
    'Dinan, T.G. & Cryan, J.F. (2017). Microbiome-gut-brain axis. Gastroenterol Clin North Am, 46(1), 77-89.'
  ]
},

'SAMe': {
  fullName:'S-Adenosyl-L-Methionine (SAMe)',
  category:'Methyl Donor',
  overview:'Naturally occurring molecule involved in methylation reactions throughout the body. Major methyl donor for neurotransmitter synthesis (serotonin, dopamine, norepinephrine), phospholipid metabolism, and DNA methylation. Well-studied antidepressant with evidence comparable to tricyclics in some trials. Also used for osteoarthritis and liver disease.',
  mechanism:'Primary methyl donor in CNS: donates methyl groups for synthesis of monoamine neurotransmitters (serotonin, dopamine, norepinephrine) via catechol-O-methyltransferase (COMT) and other methyltransferases. Enhances phospholipid methylation → improves membrane fluidity and receptor function. Upregulates BDNF. Participates in glutathione synthesis (indirect antioxidant). May modulate epigenetic regulation via DNA methylation.',
  neuralTargets:['Monoamine synthesis (5-HT, DA, NE — via methylation)','Phospholipid membranes (fluidity, receptor function)','BDNF expression','Glutathione pathways (indirect)','DNA methylation (epigenetic regulation)','One-carbon metabolism cycle'],
  indications:[
    {dx:'MDD',evidence:'A-/B+',effectSize:'d=0.54-0.84',notes:'Papakostas et al. (2010): SAMe augmentation to SSRI showed 36% response (vs 18% placebo). De Berardis et al. (2016). Some trials show equivalence to imipramine.'},
    {dx:'Dysthymia',evidence:'B',effectSize:'d=0.45',notes:'Chronic depression with presumed methylation deficiency rationale.'},
    {dx:'Osteoarthritis',evidence:'A',effectSize:'Comparable to NSAIDs for pain',notes:'FDA-recognized for OA in Europe. Slower onset than NSAIDs but equivalent efficacy.'},
    {dx:'Liver Disease (alcoholic)',evidence:'B',effectSize:'Improved liver function markers',notes:'Traditional hepatology indication.'}
  ],
  dosing:{
    standard:'400-800mg/day for depression (start low)',
    therapeutic:'800-1600mg/day (antidepressant studies)',
    max:'1600mg/day (higher doses used in OA)',
    form:'Enteric-coated tablets (SAMe is unstable). Butanedisulfonate salt preferred (most stable). Take on empty stomach 30 min before meals. Requires adequate B12 and folate for proper metabolism.',
    onset:'1-2 weeks (faster than SSRIs). Full effect: 4-6 weeks.',
    cofactors:'Ensure adequate B12 and folate intake — SAMe metabolism depends on methylation cycle cofactors.'
  },
  sideEffects:['GI upset: nausea, diarrhea, constipation','Insomnia (take in morning, not evening)','Anxiety/agitation (dose-dependent — reduce dose)','Headache','Dry mouth','CRITICAL: Treatment-emergent mania/hypomania in bipolar patients (same risk as antidepressants)'],
  drugInteractions:['SSRIs/SNRIs: risk of serotonin syndrome (additive serotonergic effect — use with caution, lower doses)','MAOIs: contraindicated (serotonin syndrome risk)','Levodopa: SAMe may reduce efficacy (theoretical — methylation competition)','Dextromethorphan: serotonin syndrome risk (additive)','Tramadol: serotonin syndrome risk'],
  contraindications:['Bipolar disorder (risk of treatment-emergent mania — same as antidepressant)','Concurrent MAOI use','Parkinson\'s disease on levodopa (theoretical interaction)','Pregnancy (insufficient safety data at therapeutic doses)'],
  qualityNotes:'SAMe is chemically unstable — quality varies enormously. Only use enteric-coated, butanedisulfonate salt form. Blister packs preferred over bottles (moisture degrades SAMe). Store in cool, dry place. Brand matters significantly with this supplement. Third-party tested products recommended.',
  costEstimate:'$30-60/month (one of the more expensive supplements at therapeutic doses).',
  keyCitations:[
    'Papakostas, G.I. et al. (2010). S-adenosyl methionine (SAMe) augmentation of SRIs for antidepressant nonresponders. Am J Psychiatry, 167(8), 942-948.',
    'De Berardis, D. et al. (2016). S-adenosyl-L-methionine augmentation in MDD patients. CNS Neurol Disord Drug Targets, 15(1), 35-44.',
    'Sharma, A. et al. (2017). S-adenosylmethionine for depression: A systematic review and dose-response meta-analysis. Am J Psychiatry, 174(12), 1226.',
    'Mischoulon, D. & Fava, M. (2002). Role of SAMe in the treatment of depression. Am J Clin Nutr, 76(5), 1158S-1161S.'
  ]
},

'Sulforaphane': {
  fullName:'Sulforaphane (Broccoli Sprout Extract)',
  category:'Isothiocyanate / Nrf2 Activator',
  overview:'Bioactive compound from cruciferous vegetables (highest concentration in broccoli sprouts). Potent activator of the Nrf2 pathway — the master regulator of antioxidant and anti-inflammatory gene expression. Emerging evidence for autism spectrum disorder, schizophrenia, and neuroinflammation. Produced from glucoraphanin by myrosinase enzyme during chewing/processing of raw cruciferous vegetables.',
  mechanism:'Activates Nrf2 (nuclear factor erythroid 2-related factor 2) → upregulates >200 cytoprotective genes including glutathione synthesis, SOD, NQO1, and heat shock proteins. Reduces NF-κB → anti-inflammatory. Enhances glutathione levels in the brain. May reduce oxidative stress markers in ASD. Heat shock protein induction may explain the "fever effect" in ASD (some children show behavioral improvement during fever).',
  neuralTargets:['Nrf2 pathway (master antioxidant switch)','Glutathione synthesis (brain GSH)','NF-κB (anti-inflammatory)','Heat shock proteins (proteostasis)','Mitochondrial function','Oxidative stress pathways'],
  indications:[
    {dx:'ASD',evidence:'B',effectSize:'34% improved on social responsiveness',notes:'Singh et al. (2014) landmark RCT: sulforaphane improved social interaction, abnormal behavior, and verbal communication in ASD. Reversible upon discontinuation.'},
    {dx:'Schizophrenia',evidence:'C+',effectSize:'Preliminary',notes:'Oxidative stress and glutathione deficit are established in schizophrenia. Nrf2 activation rationale strong. Clinical trials underway.'},
    {dx:'Neuroinflammation (general)',evidence:'B',effectSize:'Biomarker improvement',notes:'Reduces CRP, inflammatory cytokines. Potential neuroprotection.'}
  ],
  dosing:{
    standard:'Sulforaphane 50-100 μmol/day (equivalent to ~100-200g fresh broccoli sprouts)',
    therapeutic:'50-150 μmol/day from standardized supplement',
    form:'Glucoraphanin + myrosinase supplement (enzyme must be present for conversion). Avmacol, BroccoMax, Prostaphane are studied brands. Alternatively: grow and eat fresh broccoli sprouts (most bioavailable). Raw > cooked (cooking destroys myrosinase).',
    onset:'Biomarker changes: 2-4 weeks. ASD behavioral effects: 4-18 weeks (Singh study saw progressive improvement over 18 weeks).'
  },
  sideEffects:['GI upset: gas, bloating (cruciferous vegetable effect)','Heartburn (uncommon)','Thyroid function: theoretical concern with very high intake in iodine-deficient individuals (goitrogen)','Generally very well tolerated'],
  drugInteractions:['CYP enzymes: sulforaphane induces CYP1A2 and CYP3A4 → may reduce levels of some medications (caffeine, theophylline, some statins)','Thyroid medications: theoretical goitrogen effect (monitor TSH if high-dose, long-term)','Anticoagulants: vitamin K content in whole broccoli sprouts (not an issue with pure sulforaphane supplement)'],
  contraindications:['None established for supplemental sulforaphane','Severe hypothyroidism with iodine deficiency (goitrogen concern — theoretical)','Cruciferous vegetable allergy (rare)'],
  qualityNotes:'Sulforaphane is unstable — it must be generated from glucoraphanin by myrosinase enzyme. Many "sulforaphane" supplements contain only glucoraphanin without active myrosinase → minimal conversion. Look for products containing BOTH glucoraphanin AND myrosinase, or use fresh broccoli sprouts (grow at home for ~$5). Avmacol is the brand used in clinical trials.',
  costEstimate:'$25-40/month (supplement). $5/month (home-grown broccoli sprouts — most cost-effective).',
  keyCitations:[
    'Singh, K. et al. (2014). Sulforaphane treatment of autism spectrum disorder (ASD). Proc Natl Acad Sci, 111(43), 15550-15555.',
    'Houghton, C.A. et al. (2013). Sulforaphane: Translational research from laboratory bench to clinic. Nutr Rev, 71(11), 709-726.',
    'Bent, S. et al. (2018). Identification of urinary metabolites that correlate with clinical improvements in children with ASD treated with sulforaphane. Mol Autism, 9, 35.'
  ]
},

'Glycine': {
  fullName:'Glycine',
  category:'Amino Acid / Inhibitory Neurotransmitter',
  overview:'Simplest amino acid serving dual roles: inhibitory neurotransmitter (glycine receptors in brainstem and spinal cord) and co-agonist at NMDA receptors (glutamate system). Low-dose glycine (3g) promotes sleep; high-dose glycine (30-60g/day) augments NMDA receptor function in schizophrenia. Also a precursor to glutathione.',
  mechanism:'At glycine receptors: inhibitory neurotransmission → muscle relaxation, calming. At NMDA receptors: obligatory co-agonist at glycine binding site → enhances NMDA function (relevant to schizophrenia\'s NMDA hypofunction hypothesis). Sleep mechanism: glycine lowers core body temperature via peripheral vasodilation → promotes sleep onset (similar to warm bath effect). Glutathione precursor: glycine + cysteine + glutamate → GSH.',
  neuralTargets:['Glycine receptors (inhibitory neurotransmission)','NMDA receptors (glycine co-agonist site)','Thermoregulation (peripheral vasodilation)','Glutathione synthesis','SCN (possible circadian modulation)'],
  indications:[
    {dx:'Insomnia / Sleep Quality',evidence:'B',effectSize:'d=0.40; improved subjective sleep quality',notes:'Bannai & Kawai (2012): 3g before bed improved sleep quality, reduced daytime sleepiness. Inagawa et al. (2006). Thermoregulation mechanism.'},
    {dx:'Schizophrenia (negative symptoms)',evidence:'B',effectSize:'d=0.38-0.53',notes:'Heresco-Levy et al. (1999): high-dose glycine (0.8g/kg/day, ~60g) as augmentation to antipsychotic. Improves negative symptoms. NOT with clozapine (may reduce efficacy).'},
    {dx:'OCD (adjunctive)',evidence:'C',effectSize:'Case reports / theoretical',notes:'Glycine 60g/day — NMDA modulation rationale. Very limited evidence.'}
  ],
  dosing:{
    sleep:'3g before bedtime (dissolve in warm water — naturally sweet)',
    schizophrenia:'0.4-0.8g/kg/day (typically 30-60g/day in divided doses)',
    form:'Powder (dissolves easily, mildly sweet). Capsules for lower doses. Food-grade glycine is pharmaceutical quality.',
    onset:'Sleep: first night. Schizophrenia: 4-8 weeks at therapeutic dose.'
  },
  sideEffects:['Very well tolerated at 3g sleep dose','GI upset at high doses (30-60g — nausea, soft stools)','Sedation (mild — therapeutic for sleep indication)','Sweet taste'],
  drugInteractions:['Clozapine: high-dose glycine may REDUCE clozapine efficacy (paradoxical — avoid combination)','Other antipsychotics: glycine augmentation generally safe','Anticonvulsants: theoretical interaction (glycine affects excitatory/inhibitory balance)'],
  contraindications:['None established at low doses (3g)','Clozapine-treated patients (high-dose glycine contraindicated)','Renal impairment at very high doses (60g/day is significant amino acid load)'],
  qualityNotes:'Simple, pure compound. Food-grade glycine is pharmaceutical quality. Very inexpensive. Bulk powder is most cost-effective for high-dose schizophrenia indication.',
  costEstimate:'$5-10/month (3g/day). $30-60/month (high-dose 60g/day).',
  keyCitations:[
    'Bannai, M. & Kawai, N. (2012). New therapeutic strategy for amino acid medicine: Glycine improves sleep quality. J Pharmacol Sci, 118(2), 145-148.',
    'Inagawa, K. et al. (2006). Subjective effects of glycine ingestion before bedtime on sleep quality. Sleep Biol Rhythms, 4(1), 75-77.',
    'Heresco-Levy, U. et al. (1999). Efficacy of high-dose glycine in the treatment of enduring negative symptoms of schizophrenia. Arch Gen Psychiatry, 56(1), 29-36.'
  ]
},

'Chamomile Extract': {
  fullName:'Chamomile Extract (Matricaria chamomilla)',
  category:'Herbal Anxiolytic',
  overview:'Traditional herbal remedy with clinical evidence for GAD. Active compound apigenin binds GABA-A benzodiazepine site as partial agonist — anxiolytic without sedation, tolerance, or dependence. Also covered in Supplement Monograph: Apigenin.',
  mechanism:'Apigenin binds GABA-A benzodiazepine site (partial agonist) → anxiolytic without sedation/dependence. Mild MAO inhibition. Anti-inflammatory. Antispasmodic.',
  neuralTargets:['GABA-A receptors (benzo site — partial agonist)','MAO inhibition (mild)','Inflammatory pathways','Vagal tone'],
  indications:[
    {dx:'GAD',evidence:'B',effectSize:'d=0.40-0.55',notes:'Amsterdam et al. (2009): 8-week RCT positive. Mao et al. (2016): 1500mg/day for 38 weeks reduced GAD relapse.'},
    {dx:'Mild-moderate anxiety',evidence:'B',effectSize:'d=0.30-0.45',notes:'Consistent anxiolytic. Good adjunct option.'}
  ],
  dosing:{
    standard:'500-1500mg standardized extract/day',
    gad:'1500mg/day (Amsterdam/Mao protocol)',
    tea:'3-4 cups/day (lower, variable dose)',
    form:'Standardized extract (≥1.2% apigenin) capsules. Tea for mild benefit.',
    foodSources:'Chamomile tea. Extract concentrations higher and more consistent.',
    onset:'Anxiolytic: 1-2 weeks. GAD prevention: sustained use.'
  },
  sideEffects:['Very well tolerated','Allergy if allergic to ragweed/Asteraceae family','Drowsiness (mild)'],
  drugInteractions:['Anticoagulants (coumarin — minimal clinical significance)','Sedatives (additive)','CYP3A4 substrates (theoretical)'],
  contraindications:['Asteraceae/Compositae allergy (ragweed, daisies, marigolds)','Pregnancy (high-dose — tea likely safe)','Surgery (discontinue 2 weeks prior)'],
  qualityNotes:'≥1.2% apigenin. German chamomile (Matricaria) is studied species. See Supplement: Apigenin.',
  costEstimate:'$10-25/month.',
  keyCitations:[
    'Amsterdam, J.D. et al. (2009). Chamomile for GAD. J Clin Psychopharmacol, 29(4), 378-382.',
    'Mao, J.J. et al. (2016). Long-term chamomile for GAD. Phytomedicine, 23(14), 1735-1742.'
  ]
},

'Kava': {
  fullName:'Kava Extract (Piper methysticum)',
  category:'Herbal Anxiolytic',
  overview:'Pacific Island plant with anxiolytic properties comparable to low-dose benzodiazepines. Kavalactones modulate GABA-A, voltage-gated sodium/calcium channels, and MAO-B. Meta-analytic support for GAD. Hepatotoxicity concern attributed to poor manufacturing (stem/leaf, organic solvents) rather than traditional root preparations.',
  mechanism:'Kavalactones enhance GABA-A (distinct from benzo site). Block voltage-gated Na+ channels (anticonvulsant). Block voltage-gated Ca2+ channels (muscle relaxant). Inhibit MAO-B. Modulate NE reuptake. Reduce glutamate. Multi-target explains anxiolysis without cognitive impairment.',
  neuralTargets:['GABA-A complex','Voltage-gated Na+ channels','Voltage-gated Ca2+ channels','MAO-B','Norepinephrine reuptake','Glutamate release','Amygdala'],
  indications:[
    {dx:'GAD',evidence:'B+',effectSize:'d=0.60-0.80',notes:'Pittler & Ernst (2003) Cochrane: kava superior to placebo. Sarris et al. (2013): 120-240mg kavalactones/day. Comparable to buspirone.'}
  ],
  dosing:{
    standard:'120-240mg kavalactones/day',
    acute:'70-120mg for situational anxiety (1-2 hours before)',
    form:'Standardized root extract (water or ethanol — NOT organic solvents). WS 1490 most studied.',
    onset:'Acute: 1-2 hours. Chronic: 1-4 weeks.'
  },
  sideEffects:['Dermatopathy (dry, scaly skin) with prolonged high-dose','Drowsiness','GI upset','Hepatotoxicity: rare but serious — associated with poor-quality products'],
  drugInteractions:['CNS depressants (AVOID alcohol + kava)','Hepatotoxic medications','CYP2E1 substrates','Levodopa','Alprazolam (case report of coma)'],
  contraindications:['Liver disease','Alcohol use disorder','Pregnancy/lactation','Depression (may worsen chronically)','Parkinson\'s disease','Surgery (discontinue 2 weeks)'],
  qualityNotes:'CRITICAL: ONLY root extracts from noble cultivars, water/ethanol extracted. WS 1490 is gold standard. Hepatotoxicity from non-root parts + industrial solvents. Monitor LFTs every 3-6 months. Banned/restricted in some EU countries.',
  costEstimate:'$15-35/month.',
  keyCitations:[
    'Pittler, M.H. & Ernst, E. (2003). Kava for anxiety. Cochrane Database, (1), CD003383.',
    'Sarris, J. et al. (2013). Kava for GAD. J Clin Psychopharmacol, 33(5), 643-648.',
    'Teschke, R. et al. (2012). Kava hepatotoxicity. Ann Hepatol, 11(4), 445-456.'
  ]
},

'Tart Cherry': {
  fullName:'Tart Cherry Juice / Extract',
  category:'Phytonutrient / Natural Melatonin Source',
  overview:'Montmorency tart cherries are a natural food source of melatonin, rich in anthocyanins and proanthocyanidins. Studied for insomnia with mechanism distinct from synthetic melatonin — combines natural melatonin, tryptophan availability enhancement (IDO inhibition), and anti-inflammatory polyphenols.',
  mechanism:'Contains exogenous melatonin. Inhibits IDO → preserves tryptophan for serotonin/melatonin synthesis. Anthocyanins reduce IL-6, TNF-α, CRP. Combined: melatonin supplementation + enhanced endogenous production + reduced inflammation-mediated sleep disruption.',
  neuralTargets:['Melatonin receptors (MT1, MT2)','Tryptophan-serotonin-melatonin pathway','Inflammatory pathways','Suprachiasmatic nucleus (circadian)'],
  indications:[
    {dx:'Insomnia',evidence:'B-',effectSize:'d=0.25-0.40',notes:'Howatson et al. (2012): increased sleep time and efficiency. Pigeon et al. (2010): reduced insomnia severity in older adults.'}
  ],
  dosing:{
    standard:'8 oz tart cherry juice concentrate BID (AM and 30-60 min before bed)',
    extract:'480-1000mg/day capsules (less studied)',
    form:'Montmorency tart cherry juice concentrate (not cocktail). CherryActive, Cheribundi.',
    foodSources:'This IS the food source. Montmorency variety specifically.',
    onset:'1-7 days.'
  },
  sideEffects:['GI upset (high sorbitol)','High sugar in juice (30-40g/8oz)','~130 cal/8oz'],
  drugInteractions:['Anticoagulants (mild antiplatelet)','Sedatives (mild additive)','Diabetes meds (sugar in juice)'],
  contraindications:['Diabetes (high sugar — use extract)','Kidney stones (high oxalates)','Cherry allergy'],
  qualityNotes:'Montmorency variety specifically. 100% concentrate without added sugar. CherryActive, Cheribundi used in research.',
  costEstimate:'$15-30/month.',
  keyCitations:[
    'Howatson, G. et al. (2012). Tart cherry juice on melatonin and sleep. Eur J Nutr, 51(8), 909-916.',
    'Pigeon, W.R. et al. (2010). Tart cherry on sleep in older adults. J Med Food, 13(3), 579-583.'
  ]
},

'Caffeine Management': {
  fullName:'Caffeine Reduction / Elimination',
  category:'Dietary Modification / Stimulant Management',
  overview:'Caffeine acts as adenosine A1/A2A receptor antagonist. Exacerbates anxiety, panic, insomnia, and PTSD hyperarousal by activating sympathetic nervous system, increasing cortisol, and blocking adenosine sleep promotion. Elimination or reduction is first-line nutritional intervention for panic disorder, GAD, and insomnia — often more effective than adding supplements.',
  mechanism:'Blocks adenosine A1/A2A receptors → increased alertness but also cortisol, NE, and sympathetic activation. Half-life 5-6 hours (CYP1A2 slow metabolizers: 10+ hours). Blocks sleep-pressure signal, disrupts sleep architecture even >6 hours before bed.',
  neuralTargets:['Adenosine A1/A2A receptors','Sympathetic nervous system','HPA axis (cortisol)','Noradrenergic system','Sleep architecture (SWS)','Locus coeruleus'],
  indications:[
    {dx:'Panic Disorder',evidence:'A-',effectSize:'Significant provocation/reduction',notes:'Charney et al. (1985): caffeine provokes panic in PD patients. Elimination first-line. May reduce panic 50%+.'},
    {dx:'Insomnia',evidence:'A',effectSize:'Significant',notes:'Drake et al. (2013): 400mg even 6 hours before bed reduced sleep quality. No caffeine after noon minimum.'},
    {dx:'GAD',evidence:'B+',effectSize:'d=0.30-0.50',notes:'Reduction to <100mg/day or elimination. Improvement within 1-2 weeks.'},
    {dx:'Agoraphobia',evidence:'B',effectSize:'Extrapolated from panic',notes:'Sympathetic activation exacerbates panic component.'},
    {dx:'PTSD (hyperarousal)',evidence:'B-',effectSize:'Clinical recommendation',notes:'Amplifies hyperarousal. VA guidelines recommend reduction.'}
  ],
  dosing:{
    panicDisorder:'Complete elimination (all sources)',
    insomnia:'No caffeine after noon. Consider elimination if slow metabolizer.',
    gad:'<100mg/day or eliminate. Taper gradually (10-20% every 3-5 days).',
    withdrawal:'Taper 1-3 weeks. Withdrawal peaks days 1-3 (headache, fatigue). Resolves 7-14 days.',
    hiddenSources:'Coffee ~95mg/8oz, espresso ~63mg/shot, black tea ~47mg, green tea ~28mg, cola ~35mg/12oz, dark chocolate ~12mg/oz, energy drinks 80-300mg, Excedrin 65mg/tablet.',
    substitute:'Decaf (2-15mg), herbal tea (0mg), Swiss Water Process decaf.'
  },
  sideEffects:['WITHDRAWAL: headache, fatigue, irritability, difficulty concentrating, flu-like symptoms (7-14 days)','Temporary reduced energy','Social difficulty'],
  drugInteractions:['REMOVING caffeine may alter medication levels — lithium may INCREASE, clozapine may INCREASE (CYP1A2)','Theophylline (shared pathway)'],
  contraindications:['None — universally safe','Gradual taper if >400mg/day','Bipolar: removal may unmask depression in some'],
  qualityNotes:'N/A — dietary elimination. Key: identify ALL sources. USDA FoodData Central for caffeine content.',
  costEstimate:'Free — saves money.',
  keyCitations:[
    'Charney, D.S. et al. (1985). Caffeine in panic disorders. Arch Gen Psychiatry, 42(3), 233-243.',
    'Drake, C. et al. (2013). Caffeine effects on sleep. J Clin Sleep Med, 9(11), 1195-1200.',
    'Lara, D.R. (2010). Caffeine and psychiatric disorders. J Alzheimers Dis, 20(s1), S239-S248.'
  ]
},

'Mediterranean Diet': {
  fullName:'Mediterranean Diet Pattern',
  category:'Dietary Pattern',
  overview:'Plant-forward pattern: high fruits, vegetables, legumes, whole grains, nuts, olive oil, fish; moderate red wine; low red meat and processed food. Most studied dietary pattern in psychiatry. Only diet with Level A evidence for depression prevention and treatment. SMILES trial (2017): first RCT showing dietary improvement treats clinical depression. Multi-pathway: anti-inflammatory, gut-microbiome modulating, nutrient-dense.',
  mechanism:'(1) Anti-inflammatory: olive oil polyphenols, omega-3, plant polyphenols reduce CRP, IL-6, TNF-α. (2) Gut microbiome: high fiber diversity feeds beneficial bacteria → SCFA production, gut barrier, reduced endotoxemia. (3) Nutrient density: folate, B12, zinc, Mg, vitamin D. (4) Glycemic stability. (5) Neuroprotection: antioxidants. (6) BDNF: associated with higher levels.',
  neuralTargets:['Inflammatory pathways (CRP, IL-6, TNF-α)','Gut-brain axis (microbiome, SCFA)','HPA axis','BDNF expression','Oxidative stress pathways','Serotonin synthesis (nutrient provision)','Neuronal membranes (omega-3, olive oil)'],
  indications:[
    {dx:'MDD (prevention and treatment)',evidence:'A',effectSize:'OR 0.67 prevention; d=0.60 treatment',notes:'Jacka et al. (2017) SMILES: 32% remission vs 8% control. Lassale et al. (2019): 33% reduced depression risk.'},
    {dx:'Persistent Depressive Disorder',evidence:'B+',effectSize:'Extrapolated from MDD',notes:'Chronic inflammation and nutrient depletion in dysthymia.'},
    {dx:'Cognitive decline prevention',evidence:'A-',effectSize:'40% reduced risk',notes:'PREDIMED trial. Valls-Pedret et al. (2015).'},
    {dx:'Anxiety',evidence:'B-',effectSize:'d=0.20-0.35',notes:'Emerging evidence. Anti-inflammatory mechanism.'}
  ],
  dosing:{
    pattern:'Not a dose — sustained dietary pattern. Key: 3+ servings veg/day, 2+ fruits, whole grains primary carb, olive oil primary fat, fish 2-3x/week, legumes 3+/week, nuts daily, minimal processed food.',
    smilesTrial:'Whole grains, 6/day veg, 3/day fruit, 3-4/week legumes, 1/day nuts, 2+/week fish, 3-4/week max red meat, 3 tbsp/day EVOO.',
    implementation:'Gradual 2-4 week transition. Start with EVOO for cooking, extra veg serving, nuts for snacks.',
    monitoring:'Mediterranean Diet Adherence Screener (MEDAS 14-point). Score ≥9 = good adherence.'
  },
  sideEffects:['GI adjustment with fiber increase (1-2 weeks)','Possible cost increase','Social/cultural adjustment','No medical side effects'],
  drugInteractions:['Warfarin (vitamin K from greens — monitor INR)','MAOIs (tyramine in aged cheese/fermented foods)','Grapefruit (CYP3A4 interactions)'],
  contraindications:['Fish allergy (adapt)','Celiac (GF whole grains)','Specific food allergies (adapt within framework)','No absolute contraindications'],
  qualityNotes:'EVOO quality matters — harvest date, dark bottle, reputable origin. Much commercial EVOO is adulterated. COOC certified or DOP European.',
  costEstimate:'Variable. $50-150/month additional over typical American diet. Can be done affordably with legumes, seasonal veg, canned fish.',
  keyCitations:[
    'Jacka, F.N. et al. (2017). SMILES trial: dietary improvement for MDD. BMC Med, 15(1), 23.',
    'Lassale, C. et al. (2019). Healthy dietary indices and depression risk. Mol Psychiatry, 24(7), 965-986.',
    'Psaltopoulou, T. et al. (2013). Mediterranean diet, stroke, cognitive impairment, depression. Ann Neurol, 74(4), 580-591.'
  ]
},

'Anti-inflammatory Diet': {
  fullName:'Anti-inflammatory Dietary Protocol',
  category:'Dietary Pattern',
  overview:'Targeted strategy to reduce systemic inflammation through eliminating pro-inflammatory foods and emphasizing anti-inflammatory nutrients. More specifically targeted than Mediterranean diet at patients with elevated CRP, IL-6, TNF-α — including treatment-resistant depression, Complex PTSD, and adjustment disorders. Inflammatory depression (CRP >3) may respond preferentially to anti-inflammatory interventions.',
  mechanism:'Reduces: omega-6 seed oils (pro-inflammatory eicosanoids), refined sugar (AGE formation, inflammatory cascades), trans fats and ultra-processed foods. Increases: omega-3, turmeric, ginger, berries, dark leafy greens, fermented foods. Improves gut barrier → reduces LPS translocation.',
  neuralTargets:['NF-κB pathway','Inflammatory cytokines (IL-6, TNF-α, CRP)','Gut barrier integrity','HPA axis','Microglial activation','Kynurenine pathway (preserved tryptophan)'],
  indications:[
    {dx:'Complex PTSD',evidence:'B-',effectSize:'d=0.25-0.40',notes:'Chronic trauma elevates inflammatory markers. Addresses neuroinflammatory component. Complementary to trauma therapy.'},
    {dx:'Adjustment Disorder',evidence:'C+',effectSize:'Nutritional stabilization',notes:'Stress-induced inflammation exacerbates symptoms.'},
    {dx:'Treatment-resistant depression (elevated CRP)',evidence:'B',effectSize:'Subgroup-specific',notes:'Raison et al. (2013): anti-inflammatory approaches most effective when CRP >3 mg/L.'}
  ],
  dosing:{
    eliminate:'Seed oils (soybean, corn, sunflower, safflower), refined sugar, trans fats, ultra-processed foods, excessive alcohol',
    emphasize:'Wild fish 3x/week, EVOO, turmeric/ginger daily, 8+ servings colorful vegetables, 2 servings berries/day, fermented foods daily, bone broth, green tea',
    supplements:'Consider: omega-3 (2g EPA), curcumin (bioavailable form), vitamin D if deficient',
    implementation:'Elimination phase (2 weeks strict), then gradual reintroduction to identify individual triggers',
    monitoring:'CRP, IL-6 if available. Symptom tracking.'
  },
  sideEffects:['Social/cultural adjustment','Cost increase','GI adjustment','Potential weight loss (may be desired or undesired)','No medical side effects'],
  drugInteractions:['Same as Mediterranean diet','Turmeric/curcumin: antiplatelet (see Curcumin supplement monograph)'],
  contraindications:['Eating disorder history (restrictive diets can trigger relapse — adapt with ED-informed nutritionist)','Underweight patients (ensure adequate calories)'],
  qualityNotes:'Focus on whole foods, not "anti-inflammatory" branded products. Individualize based on food sensitivities. Work with nutritionist familiar with psychiatric applications.',
  costEstimate:'$50-200/month additional depending on implementation.',
  keyCitations:[
    'Raison, C.L. et al. (2013). A randomized controlled trial of the tumor necrosis factor antagonist infliximab for treatment-resistant depression. JAMA Psychiatry, 70(1), 31-41.',
    'Berk, M. et al. (2013). So depression is an inflammatory disease, but where does the inflammation come from? BMC Med, 11, 200.',
    'Jacka, F.N. et al. (2017). SMILES trial. BMC Med, 15(1), 23.'
  ]
},

'NAC (Nutrition)': {
  fullName:'N-Acetylcysteine (NAC) — Nutritional Context',
  category:'Amino Acid Derivative / Antioxidant Precursor',
  overview:'Supplemental amino acid derivative that serves as the rate-limiting precursor to glutathione, the body\'s primary intracellular antioxidant. Most psychiatric populations show depleted glutathione, elevated oxidative stress, and glutamate dysregulation — all addressable through NAC. See Supplement Monograph: NAC for full pharmacology.',
  mechanism:'Provides cysteine for glutathione synthesis. Modulates glutamate via cystine-glutamate antiporter (system Xc-). Reduces oxidative stress and neuroinflammation. See Supplement Monograph: NAC for full mechanism.',
  neuralTargets:['Glutathione synthesis pathway','Glutamatergic system (system Xc-)','Nucleus accumbens (dopamine modulation)','Inflammatory cascades (TNF-α, IL-6)','Mitochondrial function'],
  indications:[
    {dx:'OCD',evidence:'B',effectSize:'d=0.40-0.60 as augmentation',notes:'Afshar et al. (2012): NAC + fluvoxamine superior. 2400-3000mg/day.'},
    {dx:'Substance Use Disorders',evidence:'B',effectSize:'d=0.30-0.45',notes:'Glutamate normalization. Grant et al. (2014).'},
    {dx:'Bipolar Depression',evidence:'B',effectSize:'d=0.37',notes:'Berk et al. (2008). Adjunctive 2000mg/day.'},
    {dx:'PTSD',evidence:'B-',effectSize:'d=0.25-0.35',notes:'Oxidative stress and glutamate rationale.'},
    {dx:'BPD',evidence:'C+',effectSize:'Preliminary',notes:'Impulsivity and glutamate dysregulation.'},
    {dx:'Body Dysmorphic Disorder',evidence:'C+',effectSize:'d=0.30',notes:'OCD-spectrum rationale.'},
    {dx:'Hoarding Disorder',evidence:'C+',effectSize:'Preliminary',notes:'Glutamate modulation.'},
    {dx:'Gambling Disorder',evidence:'B-',effectSize:'d=0.42',notes:'Grant et al. (2007). 1200-1800mg/day.'}
  ],
  dosing:{
    standard:'1200-1800mg/day divided BID',
    therapeutic:'2000-2400mg/day for psychiatric indications',
    max:'3000mg/day (OCD augmentation)',
    form:'Capsules or powder. Sustained-release may reduce GI effects.',
    foodSources:'Dietary cysteine from poultry, yogurt, eggs, garlic, onions, broccoli. Insufficient alone for therapeutic glutathione restoration.',
    onset:'2-4 weeks initial. Full benefit: 8-12 weeks.'
  },
  sideEffects:['GI upset (most common)','Headache','Foul taste/smell','Rare: bronchospasm in asthmatics'],
  drugInteractions:['Nitroglycerin (potentiates vasodilation)','Activated charcoal (reduces absorption)','See Supplement Monograph: NAC'],
  contraindications:['NAC allergy','Active peptic ulcer','Caution in asthma'],
  qualityNotes:'USP-verified preferred. Well-characterized pharmaceutical compound.',
  costEstimate:'$15-30/month at therapeutic doses.',
  keyCitations:[
    'Berk, M. et al. (2008). NAC as glutathione precursor for schizophrenia. Biol Psychiatry, 64(5), 361-368.',
    'Grant, J.E. et al. (2007). NAC for gambling. Biol Psychiatry, 62(6), 652-657.',
    'Afshar, H. et al. (2012). NAC augmentation of fluvoxamine in OCD. Iran J Psychiatry, 7(4), 184-188.'
  ]
},

'Structured Meal Plan': {
  fullName:'Structured Meal Plan (Eating Disorder Protocol)',
  category:'Dietary Structure / Behavioral Nutrition',
  overview:'A clinician-supervised dietary framework that establishes regular, predictable eating patterns — typically 3 meals and 2-3 snacks at consistent times. This is the cornerstone nutritional intervention for anorexia nervosa, bulimia nervosa, and binge eating disorder. The goal is not specific foods but normalization of eating patterns: reducing restriction (which drives binge/purge cycles), preventing extended fasting (which triggers compensatory overeating), and restoring metabolic signaling. Must be implemented under guidance of a registered dietitian experienced in eating disorders.',
  mechanism:'Addresses the restriction-binge cycle: prolonged food restriction → depleted glycogen → hypoglycemia → intense hunger signals → binge episode → purge/compensatory behavior → guilt/restriction → cycle repeats. Structured eating disrupts this cycle by: (1) maintaining blood glucose stability, (2) normalizing hunger/satiety hormone signaling (ghrelin, leptin, CCK), (3) preventing the cognitive rigidity and decision fatigue that restriction produces, (4) restoring metabolic rate (adaptive thermogenesis reversal), (5) reducing cortisol elevation from starvation stress. Also: regular eating normalizes vagal tone and gut-brain axis signaling.',
  neuralTargets:['Hypothalamic hunger/satiety circuits (ghrelin, leptin normalization)','HPA axis (starvation stress reduction)','Prefrontal cortex (decision fatigue reduction)','Vagal tone (gut-brain axis normalization)','Reward circuitry (reduced binge drive)','Insular cortex (interoceptive awareness restoration)'],
  indications:[
    {dx:'Anorexia Nervosa',evidence:'A',effectSize:'Core treatment component',notes:'APA Practice Guidelines (2023): structured meal plan with dietitian is standard of care for AN. Refeeding must be medically monitored (refeeding syndrome risk). Start 30-40 kcal/kg/day, advance gradually.'},
    {dx:'Bulimia Nervosa',evidence:'A',effectSize:'Reduction in binge/purge frequency',notes:'Regular eating is the behavioral foundation of CBT-E for BN. Fairburn (2008): structured eating plan reduces binge frequency by disrupting restriction-binge cycle.'},
    {dx:'Binge Eating Disorder',evidence:'A',effectSize:'d=0.50-0.70',notes:'Regular structured meals prevent the fasting-triggered binge. Wilson et al. (2010): structured eating is the core behavioral intervention.'}
  ],
  dosing:{
    anorexia:'Start 30-40 kcal/kg/day, advance 200 kcal every 2-3 days toward target (goal: weight restoration at 1-2 lbs/week). Medical monitoring essential — refeeding syndrome risk in first 2 weeks.',
    bulimia:'3 meals + 2-3 snacks at consistent times. No meal skipping. No extended fasting >4 hours while awake. Adequate carbohydrate at each meal to prevent blood sugar drops.',
    bed:'3 meals + 2-3 planned snacks. Consistent times. No restriction between meals. Focus on satisfaction and adequacy rather than restriction.',
    form:'Written meal plan developed with registered dietitian (RD) specializing in eating disorders. Include specific times, portions, and food group targets. Adjust weekly based on progress.',
    monitoring:'AN: daily weight (inpatient) or weekly weight (outpatient), electrolytes, phosphate (refeeding risk), vital signs. BN: weekly weight, electrolytes if purging. BED: focus on eating pattern regularity rather than weight.'
  },
  sideEffects:['AN refeeding: edema, GI discomfort, bloating, constipation (expected during nutritional rehabilitation)','Emotional distress around eating (expected — address in therapy)','Weight gain anxiety (AN/BN)','GI disturbance during normalization of eating patterns'],
  drugInteractions:['Insulin/diabetes medications: meal timing and content affect blood glucose management — coordinate with endocrinologist','Warfarin: consistent vitamin K intake important','Lithium: meal/fluid intake affects lithium levels'],
  contraindications:['Do NOT implement restrictive or "clean eating" framing in patients with eating disorders','Avoid calorie counting in BN and BED (can reinforce obsessive patterns)','Medical instability in AN requires inpatient/residential level of care before outpatient meal planning'],
  qualityNotes:'Must be supervised by a registered dietitian (RD or RDN) with eating disorder specialization (CEDRD credential preferred). Generic nutritionists or self-directed meal planning is insufficient and potentially dangerous. HAES (Health At Every Size) framework should inform approach for BED. Non-diet approach for BN/BED.',
  costEstimate:'RD sessions: $100-250/session (may be insurance-covered with ED diagnosis). Food costs vary.',
  keyCitations:[
    'Fairburn, C.G. (2008). Cognitive Behavior Therapy and Eating Disorders. Guilford Press.',
    'APA (2023). Practice Guidelines for the Treatment of Eating Disorders.',
    'Wilson, G.T. et al. (2010). Psychological treatments of binge eating disorder. Arch Gen Psychiatry, 67(1), 94-101.'
  ]
},

'Protein-rich Breakfast': {
  fullName:'Protein-Rich Breakfast Protocol',
  category:'Meal Timing / Macronutrient Strategy',
  overview:'A targeted dietary intervention emphasizing high-protein breakfast (25-30g protein within 1 hour of waking) to optimize dopaminergic function, stabilize blood glucose, and reduce afternoon/evening impulsivity. Specifically studied in ADHD, where morning protein consumption provides tyrosine (dopamine precursor) during peak medication effectiveness and prevents the blood glucose crashes that exacerbate inattention. Also supports stimulant medication efficacy and reduces appetite suppression rebound.',
  mechanism:'Protein provides amino acid precursors for neurotransmitter synthesis: tyrosine → dopamine/norepinephrine, tryptophan → serotonin. Morning protein intake: (1) supplies tyrosine during peak daytime dopamine demand, (2) slows glucose absorption → prevents mid-morning hypoglycemia → reduces inattention and impulsivity, (3) increases satiety hormones (PYY, GLP-1) → reduces impulsive snacking, (4) counteracts stimulant-medication appetite suppression (protein is more palatable than carbs for stimulant-treated patients in the morning). High-glycemic breakfasts (cereal, toast, juice) produce glucose spikes followed by crashes that mimic and exacerbate ADHD symptoms.',
  neuralTargets:['Dopamine synthesis (tyrosine provision)','Norepinephrine synthesis (tyrosine)','Blood glucose regulation (glycemic stability)','Prefrontal cortex function (sustained glucose and amino acid supply)','Reward circuitry (reduced impulsive eating)'],
  indications:[
    {dx:'ADHD',evidence:'B',effectSize:'d=0.30-0.45',notes:'Millichap & Yee (2012): dietary protein at breakfast supports attention. Wender & Solanto (1991): protein meals improved cognitive performance vs carbohydrate meals in ADHD children. Part of comprehensive nutritional strategy.'},
    {dx:'Stimulant medication optimization',evidence:'B',effectSize:'Clinical consensus',notes:'Protein breakfast before stimulant medication improves efficacy and reduces rebound. Part of standard medication management advice.'}
  ],
  dosing:{
    standard:'25-30g protein at breakfast within 1 hour of waking',
    sources:'Eggs (2-3 = ~18g), Greek yogurt (1 cup = ~15-20g), protein smoothie, cottage cheese, turkey sausage, nut butter on whole grain toast, smoked salmon',
    avoid:'Avoid high-glycemic breakfasts with minimal protein: sugary cereal, toast with jam, juice, pancakes/waffles without protein',
    timing:'Within 1 hour of waking. Before stimulant medication if possible.',
    form:'Whole food protein preferred. Whey or plant protein powder acceptable as supplement.'
  },
  sideEffects:['None at standard dietary protein intake','May require meal prep adjustment','Some patients report reduced appetite for large breakfasts (start with protein smoothie)'],
  drugInteractions:['Stimulant medications: protein breakfast SUPPORTS medication efficacy','MAOIs: avoid high-tyramine protein sources (aged cheese, cured meats)','Levodopa: high-protein meals may reduce absorption (relevant for Parkinson\'s patients, not typical ADHD population)'],
  contraindications:['Severe kidney disease (protein restriction may be indicated — consult nephrologist)','Phenylketonuria (phenylalanine restriction)','Active eating disorder (implement under ED-specialized RD guidance only)'],
  qualityNotes:'Whole food protein sources preferred over processed protein products. Eggs are the most nutrient-dense, cost-effective option. Meal prep strategies help with morning time constraints. Protein smoothies are a practical option for patients with morning appetite suppression.',
  costEstimate:'Minimal additional cost — $10-30/month above typical breakfast.',
  keyCitations:[
    'Millichap, J.G. & Yee, M.M. (2012). The diet factor in ADHD. Pediatrics, 129(2), 330-337.',
    'Wender, E.H. & Solanto, M.V. (1991). Effects of sugar on aggressive and inattentive behavior in children with ADHD. Pediatrics, 88(5), 960-966.'
  ]
},

'Balanced Macronutrients': {
  fullName:'Balanced Macronutrient Protocol (Bulimia Nervosa)',
  category:'Dietary Structure / Eating Disorder Nutrition',
  overview:'A macronutrient-balanced eating strategy specifically designed for bulimia nervosa, emphasizing adequate carbohydrate, protein, and fat at each meal to prevent the physiological triggers of binge eating. Carbohydrate restriction is a particularly potent trigger for binge episodes — the brain interprets carb deprivation as starvation, activating powerful compensatory drives. This intervention ensures all three macronutrients are represented at each meal to maintain stable blood glucose, adequate neurotransmitter precursor supply, and satiety signaling.',
  mechanism:'Carbohydrate provides glucose (brain\'s primary fuel) and tryptophan transport for serotonin synthesis. Protein provides amino acid precursors for neurotransmitters and promotes satiety (PYY, GLP-1). Fat slows gastric emptying, provides essential fatty acids, and contributes to satiety (CCK release). Imbalanced intake — particularly carbohydrate restriction or "clean eating" patterns common in BN — creates: (1) glucose instability → prefrontal hypometabolism → impaired impulse control, (2) serotonin depletion → carb craving → binge trigger, (3) inadequate satiety signaling → persistent hunger drive.',
  neuralTargets:['Hypothalamic hunger circuits (balanced macronutrient satiety)','Serotonin synthesis (carbohydrate-mediated tryptophan transport)','Prefrontal cortex (glucose provision)','Reward circuitry (reduced deprivation-driven binge drive)','Vagal afferents (satiety signaling — CCK, GLP-1, PYY)'],
  indications:[
    {dx:'Bulimia Nervosa',evidence:'A',effectSize:'Core treatment component',notes:'Fairburn (2008) CBT-E: balanced eating is fundamental to binge/purge reduction. Carbohydrate adequacy is essential — restriction drives binge cycle.'},
    {dx:'Binge Eating Disorder',evidence:'B+',effectSize:'Part of structured eating',notes:'Adequate macronutrient balance reduces deprivation-triggered binges.'}
  ],
  dosing:{
    guideline:'Each meal includes protein (1/4 plate), complex carbohydrate (1/4 plate), vegetables/fruit (1/2 plate), and healthy fat. No food groups eliminated.',
    carbohydrate:'Minimum 130g/day (brain glucose requirement). Complex carbs preferred: whole grains, starchy vegetables, legumes, fruit.',
    protein:'0.8-1.2g/kg body weight/day, distributed across meals',
    fat:'Include healthy fat at each meal: olive oil, nuts, avocado, fatty fish. Do NOT restrict fat.',
    avoid:'Do NOT restrict any macronutrient group. Do NOT count calories. Do NOT impose "good/bad" food categories. "Clean eating" and orthorexic patterns should be challenged.',
    form:'Implemented under RD guidance as part of CBT-E or other ED treatment framework.'
  },
  sideEffects:['Anxiety about "forbidden" foods (expected — address in therapy)','GI adjustment during normalization','Possible initial weight fluctuation'],
  drugInteractions:['None specific to the balanced macronutrient approach'],
  contraindications:['Do NOT implement as a "diet" or weight-loss strategy','Active medical instability requires inpatient monitoring','Self-directed implementation without ED-specialized support may be harmful'],
  qualityNotes:'Must be supervised by eating disorder-specialized RD (CEDRD credential). Intuitive eating principles should inform long-term approach. No meal plan should reinforce diet mentality or food rules in ED patients.',
  costEstimate:'RD sessions: $100-250/session. Food costs at normal range.',
  keyCitations:[
    'Fairburn, C.G. (2008). Cognitive Behavior Therapy and Eating Disorders. Guilford Press.',
    'Zickgraf, H.F. et al. (2019). Nutritional adequacy and eating behavior in BN. Int J Eat Disord, 52(9), 1043-1050.'
  ]
},

'Adequate Protein and Fiber': {
  fullName:'Adequate Protein and Fiber Protocol (Binge Eating)',
  category:'Satiety Optimization',
  overview:'A targeted macronutrient strategy for binge eating disorder emphasizing protein (25-30g/meal) and fiber (25-35g/day) to optimize physiological satiety signaling and reduce binge urges. Protein and fiber are the two most satiating macronutrient components — they activate gut hormone cascades (PYY, GLP-1, CCK) that reduce hunger, slow gastric emptying, and reduce reward-driven eating. This approach works WITH the body\'s satiety mechanisms rather than against them through restriction.',
  mechanism:'Protein activates PYY and GLP-1 release from intestinal L-cells → reduces appetite for 4-6 hours. Also increases thermic effect of food (TEF) → greater metabolic demand from digestion. Fiber: soluble fiber forms viscous gel → slows gastric emptying and glucose absorption. Insoluble fiber adds bulk → mechanical stretch receptors in stomach activate vagal satiety signals. Both promote SCFA production in colon → further satiety signaling and anti-inflammatory effects via gut-brain axis.',
  neuralTargets:['Gut hormone satiety cascade (PYY, GLP-1, CCK)','Vagal afferents (mechanical and chemical satiety)','Hypothalamic appetite circuits','Reward circuitry (reduced deprivation-driven motivation)','Gut-brain axis (SCFA production)'],
  indications:[
    {dx:'Binge Eating Disorder',evidence:'B',effectSize:'d=0.30-0.45',notes:'Protein and fiber at meals reduce binge frequency by optimizing physiological satiety. Part of comprehensive BED treatment. Leidy et al. (2015): high-protein meals reduce food motivation and reward-driven eating.'}
  ],
  dosing:{
    protein:'25-30g protein per meal, 15-20g per snack. Distributed throughout day.',
    fiber:'25-35g/day total (most Americans consume 15g). Increase gradually over 2-3 weeks to avoid GI distress.',
    sources:'Protein: eggs, poultry, fish, Greek yogurt, legumes, tofu. Fiber: vegetables, fruits, legumes, whole grains, chia/flax seeds.',
    hydration:'Adequate water (64+ oz/day) essential with increased fiber to prevent constipation.',
    form:'Whole food focus. Not a restrictive diet — emphasis on ADDING protein and fiber, not eliminating other foods.'
  },
  sideEffects:['GI discomfort if fiber increased too rapidly (gas, bloating)','Constipation if inadequate water with fiber increase'],
  drugInteractions:['Fiber may reduce absorption of some medications — take medications 1-2 hours before high-fiber meals','Metformin: fiber may enhance blood glucose-lowering effect'],
  contraindications:['Active eating disorder with restrictive features (protein/fiber focus could reinforce restriction — implement under ED-RD guidance)','GI obstruction or strictures (fiber increase contraindicated)'],
  qualityNotes:'Emphasize whole food sources over protein bars/shakes. Implement as addition to existing eating patterns, not as restriction of other foods. Non-diet framework.',
  costEstimate:'Minimal — legumes and eggs are among the cheapest protein/fiber sources.',
  keyCitations:[
    'Leidy, H.J. et al. (2015). The role of protein in weight loss and maintenance. Am J Clin Nutr, 101(6), 1320S-1329S.',
    'Slavin, J.L. (2005). Dietary fiber and body weight. Nutrition, 21(3), 411-418.'
  ]
},

'Electrolyte Monitoring': {
  fullName:'Electrolyte / Phosphate Monitoring and Repletion',
  category:'Medical Nutrition / Safety Monitoring',
  overview:'Critical medical nutrition intervention for eating disorders involving purging (bulimia nervosa) or severe restriction (anorexia nervosa). Electrolyte imbalances — particularly hypokalemia, hypophosphatemia, and hypomagnesemia — are the primary causes of medical morbidity and mortality in eating disorders. Purging (vomiting, laxative abuse, diuretic misuse) directly depletes potassium, sodium, chloride, and magnesium. Refeeding syndrome in anorexia nervosa causes dangerous hypophosphatemia. This is a medical safety intervention, not a nutritional optimization.',
  mechanism:'Purging (vomiting): loses H+, K+, Cl- → metabolic alkalosis + hypokalemia. Laxative abuse: loses K+, Na+, Mg2+, HCO3- → metabolic acidosis or mixed. Diuretic misuse: loses K+, Na+, Mg2+. Refeeding syndrome (AN): insulin surge during carbohydrate reintroduction drives phosphate, potassium, and magnesium into cells → acute extracellular depletion → cardiac arrhythmia, seizure, respiratory failure, death. Hypokalemia is the most dangerous acute electrolyte emergency: K+ <3.0 → cardiac arrhythmia risk; K+ <2.5 → life-threatening.',
  neuralTargets:['Cardiac conduction system (K+, Mg2+, Ca2+ dependent)','Neuromuscular function (all electrolytes)','CNS function (Na+, glucose)','Renal function (all electrolytes)','Bone metabolism (Ca2+, PO4, vitamin D)'],
  indications:[
    {dx:'Anorexia Nervosa',evidence:'A',effectSize:'Life-saving medical intervention',notes:'Refeeding syndrome monitoring is standard of care. MARSIPAN guidelines: phosphate monitoring Q12-24h during first week of refeeding. Prophylactic phosphate supplementation (0.5-0.8 mmol/kg/day) recommended.'},
    {dx:'Bulimia Nervosa',evidence:'A',effectSize:'Medical safety',notes:'All purging patients require baseline and periodic electrolyte monitoring. ECG if K+ <3.5 or symptomatic.'}
  ],
  dosing:{
    monitoring:'AN refeeding: BMP + Mg + PO4 daily for first week, then Q2-3 days. BN with active purging: BMP weekly initially, monthly when stable.',
    phosphateRepletion:'Oral: 500-1000mg phosphate/day prophylactically during AN refeeding. IV if PO4 <1.0 mg/dL or symptomatic.',
    potassiumRepletion:'Oral KCl 20-40 mEq/day if K+ 3.0-3.5. Urgent IV if K+ <3.0 or symptomatic. Address underlying cause (stop purging).',
    magnesium:'Mg oxide 400-800mg/day or IV Mg if <1.5 mg/dL.',
    thiamine:'Thiamine 200-300mg IV/IM before refeeding initiation in AN (prevents Wernicke encephalopathy).',
    form:'Medical-grade electrolyte replacement. Not consumer electrolyte drinks (inadequate for clinical depletion).'
  },
  sideEffects:['Oral potassium: GI upset, nausea','Oral phosphate: diarrhea','IV replacement: phlebitis at infusion site','Refeeding edema during nutritional rehabilitation (expected, self-limiting)'],
  drugInteractions:['ACE inhibitors / ARBs: potassium-sparing — risk of hyperkalemia with supplementation','Potassium-sparing diuretics: same concern','Digoxin: hypokalemia increases toxicity risk (critical monitoring)','Insulin: drives electrolytes intracellularly — coordinate timing'],
  contraindications:['Hyperkalemia (do not supplement K+ if already elevated)','Hyperphosphatemia','Severe renal failure (electrolyte excretion impaired)','IV potassium rate must not exceed 10-20 mEq/hour via peripheral line (cardiac arrest risk)'],
  qualityNotes:'This is a medical intervention requiring physician oversight, laboratory monitoring, and potentially inpatient care. Not a supplement recommendation. All eating disorder patients with purging or severe restriction require baseline electrolyte panel and ongoing monitoring.',
  costEstimate:'Lab monitoring: $20-100/panel (usually insurance-covered with ED diagnosis). Oral supplements: $5-15/month.',
  keyCitations:[
    'MARSIPAN (2014). Management of Really Sick Patients with Anorexia Nervosa. Royal College of Psychiatrists.',
    'Mehler, P.S. et al. (2010). Medical complications of eating disorders. In Eating Disorders (Grilo & Mitchell, Eds.). Guilford Press.',
    'APA (2023). Practice Guidelines for the Treatment of Eating Disorders.'
  ]
},

'Blood Glucose Stability': {
  fullName:'Blood Glucose Stabilization Protocol',
  category:'Metabolic / Dietary Timing',
  overview:'A dietary strategy focused on preventing blood glucose fluctuations — both hyperglycemic spikes and reactive hypoglycemia — that exacerbate psychiatric symptoms. Specifically relevant for dissociative disorders, where hypoglycemic episodes can trigger or worsen depersonalization/derealization episodes. Also relevant for panic disorder, ADHD, and any condition where autonomic instability is a feature. Reactive hypoglycemia (blood glucose drop 2-4 hours after high-glycemic meal) triggers sympathetic activation that mimics and triggers anxiety/panic/dissociative symptoms.',
  mechanism:'Reactive hypoglycemia occurs when a high-glycemic meal triggers excessive insulin release → blood glucose drops below fasting level 2-4 hours later → counter-regulatory hormones (epinephrine, cortisol, glucagon) activate → sympathetic nervous system activation → anxiety, tremor, confusion, depersonalization, dissociation, panic. In vulnerable individuals (dissociative disorders, panic disorder), these physiological symptoms are interpreted through the lens of existing psychopathology, amplifying the psychiatric presentation. Stable blood glucose: prevents counter-regulatory hormone surges, reduces cortisol variability, maintains consistent prefrontal cortex glucose supply.',
  neuralTargets:['Prefrontal cortex (glucose-dependent function)','Sympathetic nervous system (counter-regulatory activation)','HPA axis (cortisol variability)','Insular cortex (interoceptive awareness of glucose state)','Locus coeruleus (norepinephrine surge during hypoglycemia)'],
  indications:[
    {dx:'Dissociative Disorders (DID/DPDR)',evidence:'B-',effectSize:'Autonomic stabilization',notes:'Hypoglycemic episodes trigger depersonalization and derealization. Blood glucose stabilization reduces frequency and severity of dissociative episodes. Sierra & David (2011): autonomic dysregulation in DPDR.'},
    {dx:'Panic Disorder',evidence:'B-',effectSize:'Trigger reduction',notes:'Reactive hypoglycemia mimics panic attack physiology. Stabilizing glucose reduces false-alarm panic triggers.'},
    {dx:'ADHD',evidence:'C+',effectSize:'Attention stability',notes:'Glucose crashes impair prefrontal function → exacerbate inattention. Consistent glucose supports stimulant medication efficacy.'}
  ],
  dosing:{
    strategy:'Eat every 3-4 hours. Include protein + complex carbohydrate + fat at every meal and snack. Avoid high-glycemic foods in isolation.',
    avoid:'Sugar-sweetened beverages, fruit juice, candy, white bread/rice/pasta in isolation, skipping meals, extended fasting >4-5 hours while awake',
    include:'Complex carbohydrates with fiber (whole grains, legumes, vegetables), protein at every eating occasion, healthy fats for satiety and glucose blunting',
    snacking:'Planned snacks between meals if >4 hours apart: apple + nut butter, cheese + crackers, yogurt + berries, hummus + vegetables',
    monitoring:'Food-symptom diary can identify individual glycemic triggers. Continuous glucose monitor (CGM) for 2 weeks can be revealing (optional, expensive).',
    form:'Dietary pattern modification — no supplements required. Focus on timing and composition.'
  },
  sideEffects:['None — this is a health-promoting dietary pattern','May require meal prep and planning','Social adjustment (regular eating schedule)'],
  drugInteractions:['Insulin/diabetes medications: meal timing directly affects glucose management — coordinate with endocrinologist','Stimulant medications: glucose stability supports medication efficacy','Hypoglycemic agents: consistent carbohydrate intake important'],
  contraindications:['Eating disorder with restrictive features (regular eating is good, but the "rules" framework can be triggering — implement with ED-aware clinician)','Diabetes management should be directed by endocrinologist'],
  qualityNotes:'Simple, free intervention with no medical risks. A food-symptom diary for 2 weeks is the most practical way to identify individual triggers. Pair with meal planning strategies.',
  costEstimate:'Free — may save money by reducing impulse snacking.',
  keyCitations:[
    'Sierra, M. & David, A.S. (2011). Depersonalization: A selective impairment of self-awareness. Conscious Cogn, 20(1), 99-108.',
    'Benton, D. (2002). Carbohydrate ingestion, blood glucose and mood. Neurosci Biobehav Rev, 26(3), 293-308.'
  ]
},

'Multi-micronutrient': {
  fullName:'Multi-Micronutrient Supplementation',
  category:'Broad-Spectrum Micronutrient',
  overview:'Broad-spectrum micronutrient supplementation providing vitamins and minerals at higher-than-RDA doses. Studied in conduct disorder, ADHD, aggression, and mood dysregulation — particularly in populations with nutritional deficiency or suboptimal diets. The rationale: multiple enzymatic pathways for neurotransmitter synthesis require adequate micronutrient cofactors, and deficiency in any one can impair brain function. Broad-spectrum approaches address multiple potential deficiencies simultaneously rather than targeting single nutrients. The Daily Essential Nutrients / EmpowerPlus formula is the most studied broad-spectrum micronutrient for psychiatric indications.',
  mechanism:'Provides cofactors for: (1) neurotransmitter synthesis enzymes (B6 for AADC, iron for TH, zinc for multiple), (2) methylation cycle (folate, B12), (3) antioxidant defense (vitamins C, E, selenium, zinc), (4) mitochondrial energy production (B2, B3, CoQ10, iron), (5) anti-inflammatory pathways (vitamin D, omega-3 if included, zinc, selenium). The hypothesis: in populations with marginal nutritional status, multiple simultaneous micronutrient deficiencies impair brain function via multiple pathways. Broad-spectrum repletion addresses the combinatorial nature of these deficits.',
  neuralTargets:['Neurotransmitter synthesis pathways (multiple cofactors)','Methylation cycle','Antioxidant systems','Mitochondrial function','Inflammatory pathways','HPA axis regulation'],
  indications:[
    {dx:'Conduct Disorder',evidence:'B',effectSize:'d=0.30-0.50',notes:'Rucklidge et al. (2014): broad-spectrum micronutrient (Daily Essential Nutrients) improved aggression and emotional regulation. Gesch et al. (2002): vitamin/mineral supplementation reduced antisocial behavior in young prisoners by 35%.'},
    {dx:'ADHD',evidence:'B',effectSize:'d=0.25-0.40',notes:'Rucklidge et al. (2014, 2018): Daily Essential Nutrients improved ADHD symptoms, particularly emotional dysregulation. Effect size modest but consistent.'},
    {dx:'Mood dysregulation (general)',evidence:'B-',effectSize:'d=0.20-0.35',notes:'Kaplan et al. (2007): EmpowerPlus reduced mood symptoms in bipolar disorder (open-label). Controlled studies ongoing.'},
    {dx:'Oppositional Defiant Disorder',evidence:'C+',effectSize:'Extrapolated from conduct disorder data',notes:'Same aggression and emotional dysregulation rationale.'},
    {dx:'Reactive Attachment Disorder',evidence:'C+',effectSize:'Nutritional rehabilitation rationale',notes:'Institutional/neglected children at high risk of multiple micronutrient deficiency.'}
  ],
  dosing:{
    standard:'Daily Essential Nutrients (DEN) or EmpowerPlus: full dose as per product label (typically 12 capsules/day divided TID). Standard multivitamin is a lower-potency alternative.',
    alternative:'High-quality multivitamin + mineral (Life Extension Two-Per-Day, Thorne Basic Nutrients) as simpler option, though less studied for psychiatric outcomes.',
    form:'Capsules, divided doses throughout day. Take with food.',
    foodFirst:'Dietary improvement should accompany supplementation. Supplements address deficiency but don\'t replace dietary quality.',
    monitoring:'Consider baseline micronutrient panel (zinc, iron/ferritin, B12, folate, vitamin D, magnesium) to identify specific deficiencies for targeted repletion.',
    onset:'4-8 weeks for initial effects. Full benefit: 8-12 weeks.'
  },
  sideEffects:['GI upset (common with multi-mineral formulas)','Nausea (take with food)','Headache (transitional)','High-dose formulas may interact with medications (see interactions)','Iron-containing formulas may cause constipation'],
  drugInteractions:['Psychiatric medications: broad-spectrum micronutrients may alter medication metabolism — Rucklidge recommends starting micronutrients BEFORE or AFTER medication changes, not simultaneously. Some patients require medication dose reductions.','Lithium: micronutrients may affect lithium levels','Anticoagulants: vitamin K in some formulas affects INR','Levothyroxine: iron and calcium in formula require 4-hour separation','MAOIs: B6 content may interact'],
  contraindications:['Hemochromatosis (iron content)','Wilson\'s disease (copper content)','Hypercalcemia','Do not start simultaneously with new psychiatric medication (confounds response assessment)','Renal impairment (mineral accumulation risk)'],
  qualityNotes:'Daily Essential Nutrients (DEN) by Hardy Nutritionals is the most-studied formula for psychiatric outcomes. EmpowerPlus (Truehope) is the earlier version. Both are high-potency formulas specifically designed for psychiatric applications. Standard drugstore multivitamins are significantly lower potency and less studied. Third-party testing for all multi formulas recommended.',
  costEstimate:'$60-100/month for DEN/EmpowerPlus. $15-30/month for standard multivitamin.',
  keyCitations:[
    'Rucklidge, J.J. et al. (2014). Vitamin-mineral treatment of ADHD in adults: A double-blind randomized placebo-controlled trial. Br J Psychiatry, 204(4), 306-315.',
    'Gesch, C.B. et al. (2002). Influence of supplementary vitamins, minerals and essential fatty acids on the antisocial behaviour of young adult prisoners. Br J Psychiatry, 181, 22-28.',
    'Kaplan, B.J. et al. (2007). Effective mood stabilization with a chelated mineral supplement. J Clin Psychiatry, 68(12), 1858-1866.'
  ]
},


'Apigenin': {
  fullName:'Apigenin (Chamomile Extract)',
  category:'Flavonoid / GABA Modulator',
  overview:'Flavonoid found in chamomile (Matricaria chamomilla), parsley, and celery. Binds benzodiazepine site on GABA-A receptors as a partial agonist — producing mild anxiolytic and sedative effects without full benzodiazepine-like impairment or dependence. Chamomile extract (standardized for apigenin) has RCT evidence for anxiety. Apigenin as isolated compound is increasingly available.',
  mechanism:'Partial agonist at benzodiazepine binding site on GABA-A receptor → enhances GABAergic inhibition (milder than benzodiazepines — partial agonism limits maximum effect). Also: inhibits CD38 → increases NAD+ levels (longevity research context). Anti-inflammatory: inhibits COX-2, NF-κB. Anxiolytic and mild sedative without cognitive impairment.',
  neuralTargets:['GABA-A receptor (benzodiazepine site — partial agonist)','CD38 (NAD+ metabolism)','COX-2 and NF-κB (anti-inflammatory)','Monoamine oxidase (mild MAO inhibition)'],
  indications:[
    {dx:'Insomnia',evidence:'B',effectSize:'d=0.35; improved sleep quality',notes:'50mg apigenin or chamomile extract 270mg before bed. Zick et al. (2011). Amsterdam et al. (2009).'},
    {dx:'GAD',evidence:'B',effectSize:'d=0.41',notes:'Amsterdam et al. (2009): chamomile extract (220mg, standardized to 1.2% apigenin) reduced GAD symptoms. Mao et al. (2016): long-term chamomile safe and effective for GAD.'},
    {dx:'Mild Anxiety',evidence:'B',effectSize:'Subjective calming',notes:'Traditional use supported by mechanistic data. Gentle intervention.'}
  ],
  dosing:{
    standard:'50mg apigenin before bed (for sleep). Chamomile extract: 220-500mg standardized extract.',
    therapeutic:'50-100mg apigenin. Chamomile 500-1500mg standardized extract.',
    form:'Apigenin capsules (typically 50mg). Chamomile extract capsules (standardized to apigenin content). Chamomile tea provides small amounts (~3-5mg apigenin per cup).',
    onset:'Sleep: 30-60 minutes. Anxiolytic: 1-2 weeks daily use for sustained effect.'
  },
  sideEffects:['Drowsiness (intended for sleep indication — caution with driving)','Allergic reaction in ragweed/chrysanthemum allergy (cross-reactivity)','GI upset (mild)','Very well tolerated overall'],
  drugInteractions:['Benzodiazepines (additive GABAergic effect)','Sedatives/CNS depressants (additive sedation)','CYP3A4 substrates: apigenin may inhibit CYP3A4','Anticoagulants (chamomile contains coumarin compounds — theoretical)','Blood thinners: chamomile has vitamin K content'],
  contraindications:['Ragweed/Asteraceae family allergy','Pregnancy (chamomile is traditional uterine stimulant — avoid therapeutic doses)','Scheduled surgery (discontinue 2 weeks prior — anticoagulant compounds)'],
  qualityNotes:'For apigenin specifically: look for specified dose (50mg). For chamomile extract: standardization to apigenin content (at least 1.2%). Amsterdam et al. studies used specific pharmaceutical-grade chamomile extract.',
  costEstimate:'$10-20/month.',
  keyCitations:[
    'Amsterdam, J.D. et al. (2009). A randomized double-blind placebo-controlled trial of oral Matricaria recutita for GAD. J Clin Psychopharmacol, 29(4), 378-382.',
    'Mao, J.J. et al. (2016). Long-term chamomile therapy for GAD: A randomized clinical trial. Phytomedicine, 23(14), 1735-1742.',
    'Zick, S.M. et al. (2011). Preliminary examination of the efficacy and safety of a standardized chamomile extract for insomnia. BMC Complement Altern Med, 11, 78.',
    'Salehi, B. et al. (2019). The therapeutic potential of apigenin. Int J Mol Sci, 20(6), 1305.'
  ]
},

'Ashwagandha': {
  fullName:'Ashwagandha (Withania somnifera)',
  category:'Adaptogen',
  overview:'Ayurvedic adaptogenic herb with anxiolytic, anti-stress, and potential antidepressant properties. Active compounds (withanolides) modulate GABA-A receptors, reduce cortisol, and have anti-inflammatory effects. KSM-66 is the most studied standardized extract (full-spectrum root extract, ≥5% withanolides).',
  mechanism:'Withanolides (particularly withaferin A and withanolide D) modulate GABA-A receptors → anxiolytic effect similar to benzodiazepines but without sedation or dependence. Reduces serum cortisol (14-28% reduction in clinical trials). Anti-inflammatory: reduces CRP, TNF-α. May enhance BDNF. Adaptogenic: normalizes stress response via HPA axis modulation rather than suppression.',
  neuralTargets:['GABA-A receptors (positive allosteric modulation)','HPA axis (cortisol reduction)','Inflammatory pathways (TNF-α, CRP)','Serotonergic system (possible 5-HT modulation)','BDNF expression','Thyroid function (may mildly increase T3/T4)'],
  indications:[
    {dx:'GAD',evidence:'B',effectSize:'d=0.56-0.68',notes:'Pratte et al. (2014) systematic review. KSM-66 300mg BID most studied. Lopresti et al. (2019): significant anxiety reduction vs placebo.'},
    {dx:'Stress/Burnout',evidence:'B+',effectSize:'d=0.60; cortisol reduction 14-28%',notes:'Chandrasekhar et al. (2012): 300mg KSM-66 BID reduced perceived stress and cortisol.'},
    {dx:'Adjustment Disorder',evidence:'C+',effectSize:'Extrapolated from stress data',notes:'Adaptogenic properties relevant to adjustment-related stress.'},
    {dx:'Insomnia (stress-related)',evidence:'B',effectSize:'d=0.44',notes:'Langade et al. (2019): 300mg root extract improved sleep quality. Triethylene glycol component may be sleep-active.'},
    {dx:'MDD (mild)',evidence:'C+',effectSize:'d=0.28',notes:'Limited direct evidence for depression. May help via cortisol reduction and inflammation.'},
    {dx:'Cognitive Function',evidence:'B',effectSize:'d=0.31',notes:'Choudhary et al. (2017): improved memory and executive function in healthy adults.'}
  ],
  dosing:{
    standard:'300mg KSM-66 extract twice daily (600mg/day total)',
    range:'250-600mg/day standardized extract',
    form:'KSM-66 (full-spectrum root, ≥5% withanolides) is gold standard. Sensoril (root + leaf, higher withanolide concentration) also studied. Capsule preferred. Can take with food.',
    onset:'Anxiolytic: 2-4 weeks. Cortisol reduction: 4-8 weeks. Full adaptogenic benefit: 8-12 weeks.',
    cycling:'Some practitioners recommend 8 weeks on / 2 weeks off. Evidence for cycling is traditional, not clinical.'
  },
  sideEffects:['GI upset (mild, usually transient)','Drowsiness (some formulations — can be beneficial for insomnia)','Headache (uncommon)','Rare: liver toxicity (case reports at high doses — monitor LFTs if prolonged use)','Thyroid stimulation (may increase T3/T4 — caution in hyperthyroidism)'],
  drugInteractions:['Thyroid medications (may potentiate — monitor TSH)','Sedatives/benzodiazepines (additive sedation)','Immunosuppressants (ashwagandha may stimulate immune function)','Diabetes medications (may lower blood glucose — monitor)','Antihypertensives (may lower BP — monitor)'],
  contraindications:['Hyperthyroidism or Graves\' disease (thyroid stimulation)','Pregnancy (traditional contraindication — may be abortifacient in high doses)','Autoimmune conditions (may stimulate immune response — use with caution)','Nightshade allergy (Solanaceae family)','Scheduled surgery (discontinue 2 weeks prior — sedative and hypoglycemic effects)'],
  qualityNotes:'KSM-66 and Sensoril are patented, standardized extracts with most clinical data. Generic "ashwagandha root powder" varies wildly in withanolide content. Third-party testing (NSF, USP, ConsumerLab) recommended. Heavy metal contamination is a real concern with Ayurvedic herbs.',
  costEstimate:'$15-25/month for KSM-66 extract.',
  keyCitations:[
    'Chandrasekhar, K. et al. (2012). A prospective randomized double-blind placebo-controlled study of ashwagandha root in reducing stress and anxiety. Indian J Psychol Med, 34(3), 255-262.',
    'Pratte, M.A. et al. (2014). An alternative treatment for anxiety: A systematic review of human trial results. J Altern Complement Med, 20(12), 901-908.',
    'Lopresti, A.L. et al. (2019). An investigation into the stress-relieving and pharmacological actions of ashwagandha extract. Medicine, 98(37), e17186.',
    'Langade, D. et al. (2019). Efficacy and safety of ashwagandha root extract on insomnia and anxiety. Cureus, 11(9), e5797.'
  ]
},

'CBD': {
  fullName:'Cannabidiol (CBD)',
  category:'Phytocannabinoid',
  overview:'Non-psychoactive cannabinoid from Cannabis sativa. Unlike THC, CBD does not produce euphoria or impairment. Anxiolytic, anti-inflammatory, and possible antipsychotic properties via multiple receptor systems. FDA-approved as Epidiolex for epilepsy. Psychiatric evidence is growing but limited by inconsistent formulations, dosing, and regulatory status.',
  mechanism:'Multi-target pharmacology: 5-HT1A partial agonist (anxiolytic, antidepressant mechanism — same receptor as buspirone). Allosteric modulator of CB1 receptors (indirect). Inhibits FAAH → increases anandamide (endocannabinoid). TRPV1 agonist (desensitization → analgesic). GPR55 antagonist. Anti-inflammatory: reduces TNF-α, IL-6. Does NOT directly activate CB1 or CB2 receptors at typical doses.',
  neuralTargets:['5-HT1A receptors (anxiolytic — key mechanism)','Endocannabinoid system (FAAH inhibition → increased anandamide)','TRPV1 (pain/anxiety modulation)','Adenosine reuptake (anxiolytic)','Inflammatory pathways (TNF-α, IL-6)','PPARγ (neuroprotection)'],
  indications:[
    {dx:'PTSD',evidence:'B',effectSize:'d=0.35-0.52',notes:'Elms et al. (2019): 91% of PTSD patients showed symptom improvement. Shannon et al. (2019). 25-75mg/day.'},
    {dx:'Social Anxiety',evidence:'B',effectSize:'d=0.44',notes:'Bergamaschi et al. (2011): 600mg reduced anxiety during simulated public speaking. Acute dosing study.'},
    {dx:'GAD',evidence:'C+',effectSize:'Preliminary',notes:'5-HT1A mechanism supports anxiolytic effect. Limited RCTs for GAD specifically.'},
    {dx:'Insomnia',evidence:'C+',effectSize:'d=0.30 (mixed)',notes:'Higher doses (160mg+) may be sedating. Lower doses may be alerting. Inconsistent findings.'},
    {dx:'Epilepsy',evidence:'A',effectSize:'39-41% seizure reduction',notes:'Epidiolex FDA-approved for Dravet, Lennox-Gastaut. Separate from psychiatric indications.'},
    {dx:'Psychosis (adjunctive)',evidence:'C+',effectSize:'Preliminary positive',notes:'McGuire et al. (2018): 1000mg/day improved positive symptoms vs placebo. Single RCT.'}
  ],
  dosing:{
    standard:'25-50mg/day for anxiety/PTSD',
    therapeutic:'50-300mg/day (clinical studies)',
    form:'Full-spectrum hemp extract (contains minor cannabinoids and terpenes — "entourage effect"). Sublingual oil for faster onset. Capsules for consistent dosing. Isolate vs full-spectrum debated. Avoid vaping (lung injury risk). Third-party COA (Certificate of Analysis) mandatory.',
    onset:'Sublingual: 15-30 minutes. Oral: 1-2 hours. Sustained benefit: 2-4 weeks daily use.',
    note:'Dose-response is NOT linear. Some evidence for biphasic effect: low doses alerting, high doses sedating.'
  },
  sideEffects:['Fatigue/drowsiness (dose-dependent)','Diarrhea','Reduced appetite','Dry mouth','Liver enzyme elevation (at high doses — Epidiolex labeling includes hepatotoxicity warning)','Drug interactions via CYP450 system','Weight changes'],
  drugInteractions:['CYP3A4 and CYP2C19 substrates: CBD inhibits these enzymes → increases levels of many medications','Clobazam (Epidiolex data: CBD increases clobazam levels significantly)','Warfarin (CBD may increase INR)','SSRIs/SNRIs: theoretical increased levels via CYP2C19 inhibition','Valproate: increased liver toxicity risk (combination)','Any hepatically-metabolized medication: check CYP interactions'],
  contraindications:['Liver disease (hepatotoxicity risk at high doses)','Concurrent valproate (increased hepatotoxicity)','Pregnancy/lactation (insufficient safety data)','Caution in patients on multiple CYP3A4/2C19 substrates'],
  qualityNotes:'CBD market is poorly regulated. Studies show significant label inaccuracy and contamination. MANDATORY: third-party Certificate of Analysis (COA) showing: cannabinoid content matches label, THC <0.3% (legal limit), no pesticides/heavy metals/solvents. Avoid gas station/convenience store CBD. Full-spectrum hemp extract from reputable manufacturers preferred.',
  costEstimate:'$30-80/month depending on dose and quality. Epidiolex (Rx): $1,300+/month.',
  keyCitations:[
    'Shannon, S. et al. (2019). Cannabidiol in anxiety and sleep: A large case series. Perm J, 23, 18-041.',
    'Bergamaschi, M.M. et al. (2011). Cannabidiol reduces anxiety of simulated public speaking in treatment-naive social phobia patients. Neuropsychopharmacology, 36(6), 1219-1226.',
    'McGuire, P. et al. (2018). Cannabidiol (CBD) as an adjunctive therapy in schizophrenia: A multicenter RCT. Am J Psychiatry, 175(3), 225-231.',
    'Elms, L. et al. (2019). Cannabidiol in the treatment of PTSD: A case series. J Altern Complement Med, 25(4), 392-397.'
  ]
},

'Chromium Picolinate': {
  fullName:'Chromium Picolinate',
  category:'Trace Mineral',
  overview:'Trivalent chromium bound to picolinic acid for enhanced absorption. Enhances insulin sensitivity and may modulate serotonergic and dopaminergic function. Evidence for atypical depression (with carbohydrate craving, hyperphagia) and binge eating disorder via appetite/craving regulation.',
  mechanism:'Enhances insulin receptor signaling → improves glucose uptake → reduces carbohydrate cravings and hyperphagia. May increase tryptophan transport across BBB (via insulin-mediated competition at large neutral amino acid transporter) → increased serotonin synthesis. Possible direct effects on dopaminergic reward circuitry. Insulin resistance is common in depression and binge eating — chromium addresses this metabolic component.',
  neuralTargets:['Insulin receptor signaling (glucose metabolism)','Serotonin synthesis (tryptophan transport)','Dopaminergic reward circuits (indirect)','Hypothalamic appetite regulation'],
  indications:[
    {dx:'Binge Eating Disorder',evidence:'B',effectSize:'d=0.40; reduced binge frequency',notes:'Brownley et al. (2013): 1000mcg/day reduced binge frequency and depressive symptoms. Most effective for carbohydrate craving.'},
    {dx:'Atypical Depression',evidence:'B',effectSize:'d=0.35-0.48',notes:'Docherty et al. (2005): 600mcg/day improved mood, appetite, carbohydrate craving in atypical depression. McLeod et al. (1999).'},
    {dx:'Weight Management (psychiatric medication-induced)',evidence:'C+',effectSize:'Modest',notes:'May attenuate weight gain from atypical antipsychotics.'}
  ],
  dosing:{
    standard:'200-600mcg/day',
    therapeutic:'600-1000mcg/day for psychiatric indications',
    form:'Chromium picolinate (best studied for mood). Capsules. Take with meals.',
    onset:'Appetite/craving changes: 2-4 weeks. Mood effects: 4-8 weeks.'
  },
  sideEffects:['GI upset (mild)','Headache (uncommon)','Insomnia (rare)','Hypoglycemia in diabetics (monitor glucose)','Very rare: case reports of renal toxicity at extremely high doses'],
  drugInteractions:['Diabetes medications / insulin (additive hypoglycemia — monitor)','Thyroid medications (chromium may affect thyroid function)','NSAIDs (may increase chromium absorption)','Antacids (may reduce absorption)'],
  contraindications:['Renal disease (reduced clearance)','Chromate/chromium allergy','Type 1 diabetes (hypoglycemia risk — close monitoring)','Liver disease (case reports of hepatotoxicity at very high doses)'],
  qualityNotes:'Chromium picolinate specifically (not chromium chloride). Picolinate form has best absorption and most psychiatric research. USP-verified preferred.',
  costEstimate:'$5-15/month.',
  keyCitations:[
    'Brownley, K.A. et al. (2013). A double-blind randomized pilot trial of chromium picolinate for binge eating disorder. J Psychosom Res, 75(1), 36-42.',
    'Docherty, J.P. et al. (2005). A double-blind placebo-controlled exploratory trial of chromium picolinate in atypical depression. J Psychiatr Pract, 11(5), 302-314.',
    'McLeod, M.N. et al. (1999). Chromium potentiation of antidepressant pharmacotherapy for dysthymic disorder. J Clin Psychopharmacol, 19(1), 93-94.'
  ]
},

'Curcumin': {
  fullName:'Curcumin (Turmeric Extract)',
  category:'Anti-Inflammatory / Polyphenol',
  overview:'Primary bioactive compound in turmeric (Curcuma longa). Potent anti-inflammatory and antioxidant with emerging evidence for depression, particularly inflammation-associated depression. Poor oral bioavailability is the main challenge — formulation matters significantly (piperine enhancement, liposomal, or BCM-95/Meriva forms required).',
  mechanism:'Inhibits NF-κB pathway → reduces TNF-α, IL-1β, IL-6 (major pro-inflammatory cytokines). Modulates BDNF expression. Inhibits monoamine oxidase (MAO-A and MAO-B) → increases serotonin and dopamine availability. Antioxidant: scavenges reactive oxygen species. May modulate gut microbiome composition. Anti-amyloid properties (Alzheimer\'s research context).',
  neuralTargets:['NF-κB inflammatory pathway','BDNF expression','Monoamine oxidase (MAO inhibition)','Serotonergic and dopaminergic systems (indirect)','Gut-brain axis (microbiome modulation)','Oxidative stress pathways'],
  indications:[
    {dx:'MDD',evidence:'B',effectSize:'d=0.34-0.75 (varies by formulation)',notes:'Lopresti et al. (2014): BCM-95 1000mg = fluoxetine. Ng et al. (2017) meta-analysis positive. Most effective in inflammation-elevated depression.'},
    {dx:'Dysthymia',evidence:'C+',effectSize:'Extrapolated from MDD data',notes:'Chronic low-grade inflammation rationale.'},
    {dx:'Chronic Inflammation (psychiatric comorbidity)',evidence:'B',effectSize:'CRP reduction 0.5-1.5 mg/L',notes:'Sahebkar et al. (2016) meta-analysis of CRP reduction.'},
    {dx:'Anxiety',evidence:'C+',effectSize:'d=0.29',notes:'Limited direct evidence. May help via inflammation reduction.'},
    {dx:'Cognitive Decline',evidence:'C+',effectSize:'Preliminary',notes:'Anti-amyloid properties. Small et al. (2018): improved memory in healthy older adults with Theracurmin.'}
  ],
  dosing:{
    standard:'500-1000mg/day curcuminoids (not raw turmeric powder)',
    therapeutic:'1000-1500mg/day for depression',
    form:'MUST use bioavailability-enhanced form: BCM-95 (Biocurcumax), Meriva (phospholipid complex), Theracurmin (nanoparticle), or curcumin + piperine (BioPerine 5-20mg). Standard curcumin is <5% bioavailable — essentially worthless without enhancement. Take with fat-containing meal.',
    onset:'Anti-inflammatory: 4-8 weeks. Antidepressant: 4-8 weeks. Full benefit: 8-12 weeks.'
  },
  sideEffects:['GI upset, nausea, diarrhea (dose-dependent)','Yellow staining of teeth/skin (cosmetic)','Headache (uncommon)','Rare: elevated liver enzymes at high doses','Rare: allergic contact dermatitis'],
  drugInteractions:['Anticoagulants/antiplatelets (curcumin has antiplatelet properties — increased bleeding risk)','Diabetes medications (may lower blood glucose)','Sulfasalazine (curcumin may increase levels)','Iron supplements (curcumin chelates iron — take separately)','Chemotherapy drugs (complex interactions — discuss with oncologist)'],
  contraindications:['Gallbladder disease/gallstones (curcumin stimulates bile secretion)','Bleeding disorders (antiplatelet effect)','Scheduled surgery (discontinue 2 weeks prior)','Iron deficiency anemia (iron chelation)','Pregnancy (high doses — culinary amounts safe)'],
  qualityNotes:'Formulation is critical. Raw turmeric powder or standard curcumin extract has <5% bioavailability. Only use: BCM-95, Meriva, Theracurmin, Longvida, or curcumin + BioPerine. Third-party testing recommended. Lead contamination documented in some turmeric products.',
  costEstimate:'$20-40/month for enhanced bioavailability forms.',
  keyCitations:[
    'Lopresti, A.L. et al. (2014). Curcumin for the treatment of MDD: A randomised double-blind placebo-controlled study. J Affect Disord, 167, 368-375.',
    'Ng, Q.X. et al. (2017). Clinical use of curcumin in depression: A meta-analysis. J Am Med Dir Assoc, 18(6), 503-508.',
    'Sahebkar, A. et al. (2016). Curcuminoids modulate pro-inflammatory mediators: A meta-analysis. Pharmacol Res, 103, 204-225.',
    'Small, G.W. et al. (2018). Memory and brain amyloid and tau effects of a bioavailable form of curcumin. Am J Geriatr Psychiatry, 26(3), 266-277.'
  ]
},

'Kudzu Extract': {
  fullName:'Kudzu Extract (Puerarin)',
  category:'Herbal / Isoflavone',
  overview:'Extract from Pueraria lobata (kudzu vine) root containing puerarin and daidzin (isoflavones). Traditional Chinese medicine for alcohol intoxication for 2000+ years. Modern research suggests it reduces alcohol consumption without affecting craving — possibly by increasing alcohol sensitivity/aversion. Puerarin is the primary active compound.',
  mechanism:'Isoflavones (puerarin, daidzin) inhibit mitochondrial aldehyde dehydrogenase (ALDH-2) → increased acetaldehyde accumulation → aversive response to alcohol (similar to disulfiram but much milder). May also modulate serotonin and dopamine systems. Daidzin selectively suppresses alcohol intake in animal models. Does NOT appear to reduce craving — reduces consumption per drinking episode.',
  neuralTargets:['ALDH-2 (aldehyde dehydrogenase inhibition)','Serotonergic system (possible modulation)','Dopaminergic reward circuitry (indirect)','Alcohol metabolism pathway'],
  indications:[
    {dx:'Alcohol Use Disorder (harm reduction)',evidence:'B',effectSize:'Reduced drinks per session ~35-50%',notes:'Lukas et al. (2005): kudzu extract reduced beer consumption in heavy drinkers. Lukas et al. (2013): reduced drinking in natural setting. Does not reduce craving — reduces consumption.'},
    {dx:'Binge Drinking',evidence:'B',effectSize:'Reduced heavy drinking episodes',notes:'Most effective for reducing amount per drinking occasion rather than preventing drinking altogether.'}
  ],
  dosing:{
    standard:'500mg kudzu root extract 2-3x daily (standardized to puerarin/isoflavone content)',
    therapeutic:'1500-2500mg/day',
    form:'Standardized root extract capsules. Take 30-60 min before anticipated drinking (harm reduction model). Can also take daily.',
    onset:'Acute: effects on alcohol consumption within first drinking session. Sustained: unclear if tolerance develops.'
  },
  sideEffects:['Generally well tolerated','GI upset (mild)','Headache','Theoretical: anticoagulant effect (isoflavones)','Estrogenic activity (isoflavones — theoretical concern)'],
  drugInteractions:['Disulfiram/metronidazole (additive ALDH-2 inhibition → severe reaction)','Anticoagulants (isoflavones may have mild anticoagulant effect)','Diabetes medications (may affect blood glucose)','Tamoxifen/hormonal therapies (weak estrogenic activity)','Methotrexate (may affect metabolism)'],
  contraindications:['Concurrent disulfiram use (dangerous additive ALDH inhibition)','Hormone-sensitive cancers (weak estrogenic activity)','Pregnancy/lactation','Severe liver disease'],
  qualityNotes:'Standardization varies significantly. Look for products standardized to puerarin or total isoflavone content. The Lukas lab studies used a specific NPI-031 extract.',
  costEstimate:'$15-25/month.',
  keyCitations:[
    'Lukas, S.E. et al. (2005). An extract of the Chinese herbal root kudzu reduces alcohol drinking by heavy drinkers in a naturalistic setting. Alcohol Clin Exp Res, 29(5), 756-762.',
    'Lukas, S.E. et al. (2013). A standardized kudzu extract (NPI-031) reduces alcohol consumption in nontreatment-seeking male heavy drinkers. Psychopharmacology, 226(1), 65-73.',
    'Keung, W.M. & Vallee, B.L. (1998). Kudzu root: An ancient Chinese source of modern antidipsotropic agents. Phytochemistry, 47(4), 499-506.'
  ]
},

'L-Methylfolate': {
  fullName:'L-Methylfolate (5-MTHF)',
  category:'B-Vitamin / Methyl Donor',
  overview:'The biologically active form of folate (vitamin B9) that crosses the blood-brain barrier directly. Unlike folic acid, L-methylfolate does not require conversion by MTHFR enzyme — critical because 10-15% of the population has MTHFR polymorphisms (C677T, A1298C) that reduce conversion by 30-70%. L-methylfolate is a required cofactor for monoamine neurotransmitter synthesis and is FDA-approved as a medical food for depression (Deplin).',
  mechanism:'L-methylfolate donates a methyl group to convert homocysteine → methionine → SAMe → neurotransmitter synthesis (serotonin, dopamine, norepinephrine via BH4 cofactor pathway). MTHFR polymorphisms → reduced L-methylfolate availability → impaired monoamine synthesis → depression vulnerability. Supplementation bypasses the MTHFR bottleneck. Also reduces homocysteine (cardiovascular benefit).',
  neuralTargets:['BH4 (tetrahydrobiopterin) cofactor pathway','Monoamine synthesis (5-HT, DA, NE)','One-carbon metabolism / methylation cycle','Homocysteine metabolism','SAMe production (upstream)'],
  indications:[
    {dx:'MDD (SSRI augmentation)',evidence:'A',effectSize:'d=0.40; NNT ~6',notes:'Papakostas et al. (2012): 15mg L-methylfolate augmented SSRI significantly. FDA-cleared as medical food (Deplin). Most effective in patients with elevated homocysteine or known MTHFR variants.'},
    {dx:'MDD (MTHFR+ patients)',evidence:'A',effectSize:'Higher response rate in C677T carriers',notes:'MTHFR TT genotype patients show greater antidepressant response to L-methylfolate.'},
    {dx:'Treatment-Resistant Depression',evidence:'B+',effectSize:'d=0.40',notes:'Fava & Mischoulon (2009). Addresses potential methylation deficit in non-responders.'},
    {dx:'Schizophrenia (negative symptoms)',evidence:'C+',effectSize:'Preliminary',notes:'Roffman et al. (2013): folate supplementation improved negative symptoms in MTHFR variant carriers.'}
  ],
  dosing:{
    standard:'7.5-15mg/day',
    therapeutic:'15mg/day (Deplin standard dose)',
    form:'L-methylfolate (as Metafolin, Quatrefolic, or generic 5-MTHF). NOT folic acid — folic acid requires MTHFR conversion. Capsule or tablet. Can take with or without food.',
    onset:'2-4 weeks. May take 4-8 weeks for full augmentation benefit.',
    testing:'Consider MTHFR genotyping (C677T, A1298C) and serum homocysteine. Elevated homocysteine (>12 μmol/L) suggests methylation deficit.'
  },
  sideEffects:['Generally very well tolerated','GI upset (mild)','Insomnia (rare — take in morning)','Irritability (rare — may indicate overmethylation in some individuals)','Masking B12 deficiency (theoretical — less concern than with folic acid)'],
  drugInteractions:['Anticonvulsants (phenytoin, carbamazepine, valproate): may reduce folate levels; L-methylfolate may reduce anticonvulsant efficacy (monitor levels)','Methotrexate: folate antagonist — L-methylfolate may reduce methotrexate efficacy (discuss with prescriber)','SSRIs/SNRIs: synergistic (this is the intended augmentation use)'],
  contraindications:['Known allergy to folate products','Active malignancy being treated with antifolates (methotrexate, pemetrexed) — consult oncologist','Untreated B12 deficiency (correct B12 before/with folate supplementation)'],
  qualityNotes:'L-methylfolate (5-MTHF) is the ONLY acceptable form. Do NOT substitute folic acid. Branded forms: Metafolin (Merck), Quatrefolic (Gnosis). Deplin is prescription medical food (15mg). OTC forms at 1-15mg available. Quality is generally consistent for this well-defined compound.',
  costEstimate:'Deplin (Rx): $75-150/month (insurance may cover). OTC L-methylfolate 15mg: $15-30/month.',
  keyCitations:[
    'Papakostas, G.I. et al. (2012). L-methylfolate as adjunctive therapy for SSRI-resistant MDD. Am J Psychiatry, 169(12), 1267-1274.',
    'Fava, M. & Mischoulon, D. (2009). Folate in depression: Efficacy, safety, differences in formulations, and clinical issues. J Clin Psychiatry, 70(Suppl 5), 12-17.',
    'Roffman, J.L. et al. (2013). Randomized multicenter investigation of folate plus vitamin B12 supplementation in schizophrenia. JAMA Psychiatry, 70(5), 481-489.',
    'Shelton, R.C. et al. (2013). Assessing effects of L-methylfolate in depression management. J Clin Psychiatry, 74(10), 965-973.'
  ]
},

'Lavender Oil': {
  fullName:'Lavender Oil (Silexan / Lavela WS 1265)',
  category:'Essential Oil / Phytopharmaceutical',
  overview:'Standardized oral lavender oil preparation (Silexan/Lavela WS 1265) with anxiolytic efficacy comparable to low-dose benzodiazepines and paroxetine in RCTs. The only herbal anxiolytic with multiple positive large-scale RCTs. Active compounds: linalool and linalyl acetate. Mechanism involves voltage-dependent calcium channel (VDCC) modulation. Do NOT confuse oral Silexan with aromatherapy — different routes, different evidence bases.',
  mechanism:'Linalool and linalyl acetate inhibit voltage-dependent calcium channels (VDCCs, N-type and P/Q-type) → reduces presynaptic calcium influx → decreases excitatory neurotransmitter release. May also modulate NMDA receptors and serotonin transporter (SERT). This mechanism is distinct from benzodiazepines (no GABA-A binding) → no sedation, no dependence, no withdrawal.',
  neuralTargets:['Voltage-dependent calcium channels (N-type, P/Q-type)','Presynaptic neurotransmitter release (reduced excitation)','Possible SERT modulation','NMDA receptors (possible modulation)','NOT GABA-A (distinct from benzodiazepines)'],
  indications:[
    {dx:'GAD',evidence:'A',effectSize:'d=0.45; comparable to lorazepam 0.5mg',notes:'Woelk & Schlafke (2010): Silexan 80mg = lorazepam 0.5mg in 6-week RCT. Kasper et al. (2010): significant anxiety reduction vs placebo.'},
    {dx:'Social Anxiety',evidence:'B',effectSize:'d=0.40',notes:'Kasper et al. (2014): Silexan 80mg improved social anxiety.'},
    {dx:'Subsyndromal Anxiety',evidence:'A',effectSize:'d=0.52',notes:'Kasper et al. (2010): effective for anxiety not meeting full GAD criteria.'},
    {dx:'Mixed Anxiety-Depression',evidence:'B',effectSize:'d=0.38',notes:'Kasper et al. (2016): improved both anxiety and depressive symptoms.'},
    {dx:'Insomnia (anxiety-related)',evidence:'B',effectSize:'Improved sleep quality',notes:'Secondary outcome in anxiety trials — improved sleep without sedation.'}
  ],
  dosing:{
    standard:'80mg/day (one Silexan/Lavela WS 1265 softgel)',
    therapeutic:'80-160mg/day',
    form:'Silexan (Lavela WS 1265) standardized softgel capsules ONLY for psychiatric indications. This is NOT the same as lavender essential oil (do NOT ingest non-pharmaceutical essential oils). NOT aromatherapy.',
    onset:'1-2 weeks for initial anxiolytic effect. Full benefit: 4-6 weeks.',
    timing:'Once daily, any time. Can take with or without food.'
  },
  sideEffects:['Lavender-scented burps (most common — take with food)','GI upset/nausea (mild)','Headache (uncommon)','No sedation, cognitive impairment, or psychomotor effects','No dependence, tolerance, or withdrawal (major advantage over benzodiazepines)'],
  drugInteractions:['Minimal known interactions','Theoretical: additive with other anxiolytics (clinical significance low)','Theoretical: possible interaction with CYP3A4 substrates at high doses'],
  contraindications:['Allergy to lavender','Pregnancy/lactation (insufficient data)','Do NOT use non-standardized lavender essential oil orally (hepatotoxic)'],
  qualityNotes:'ONLY use Silexan/Lavela WS 1265 — this is the specific standardized preparation used in all clinical trials. Generic lavender oil capsules are NOT equivalent and may be toxic. Available OTC in the US as Calm Aid (Nature\'s Way) and CalmAid. Available as Lasea in EU (licensed herbal medicine in Germany).',
  costEstimate:'$15-25/month.',
  keyCitations:[
    'Woelk, H. & Schlafke, S. (2010). A multi-center double-blind randomised study of the lavender oil preparation Silexan vs lorazepam for GAD. Phytomedicine, 17(2), 94-99.',
    'Kasper, S. et al. (2010). Silexan, an orally administered Lavandula oil preparation, is effective in the treatment of subsyndromal anxiety. Int Clin Psychopharmacol, 25(5), 277-287.',
    'Kasper, S. et al. (2014). Lavender oil preparation Silexan is effective in GAD — a randomized, double-blind comparison to placebo and paroxetine. Int J Neuropsychopharmacol, 17(6), 859-869.',
    'Kasper, S. et al. (2016). An orally administered Lavandula oil preparation for anxiety disorder and related conditions. Int J Psychiatry Clin Pract, 20(4), 242-254.'
  ]
},

'Melatonin': {
  fullName:'Melatonin',
  category:'Neurohormone / Chronobiotic',
  overview:'Endogenous neurohormone produced by the pineal gland in response to darkness. Primary function: circadian rhythm entrainment via MT1 and MT2 receptors in the suprachiasmatic nucleus. Commonly used for insomnia but evidence strongest for circadian rhythm disorders and jet lag. Modest effect for primary insomnia. Also has antioxidant and immunomodulatory properties.',
  mechanism:'Binds MT1 receptors in SCN → promotes sleep onset (acute soporific effect). Binds MT2 receptors → phase-shifts circadian clock (chronobiotic effect). Antioxidant: direct free radical scavenging. Immunomodulatory: modulates T-cell function. Exogenous melatonin at specific times can advance or delay circadian phase depending on timing relative to endogenous rhythm.',
  neuralTargets:['SCN (MT1/MT2 receptors — circadian entrainment)','Pineal gland (feedback regulation)','Immune system (T-cell modulation)','Oxidative stress pathways (antioxidant)','GABA-A receptor (possible weak modulation at high doses)'],
  indications:[
    {dx:'Circadian Rhythm Sleep-Wake Disorders',evidence:'A',effectSize:'Phase advance 1-2 hours; d=0.46',notes:'Delayed sleep phase: 0.5-3mg 4-5 hours before desired sleep time. Best evidence among sleep indications.'},
    {dx:'Jet Lag',evidence:'A',effectSize:'Reduced jet lag severity',notes:'Herxheimer & Petrie (2002) Cochrane review. 0.5-5mg at destination bedtime.'},
    {dx:'Primary Insomnia',evidence:'B-',effectSize:'d=0.17 for sleep onset; modest',notes:'Ferracioli-Oda et al. (2013): small but statistically significant. Not first-line — CBT-I and sleep hygiene first.'},
    {dx:'ASD (sleep disturbance)',evidence:'A',effectSize:'d=0.67 for sleep onset',notes:'Gringras et al. (2017): 50% of ASD children have sleep problems. Melatonin significantly effective. FDA-approved pediatric form (Slenyto).'},
    {dx:'ADHD (sleep onset)',evidence:'B',effectSize:'d=0.45',notes:'Van der Heijden et al. (2007). Improves sleep onset delay common in ADHD.'},
    {dx:'REM Sleep Behavior Disorder',evidence:'B+',effectSize:'Reduced RBD episodes',notes:'3-12mg. May be diagnostic/therapeutic clue for prodromal synucleinopathy.'}
  ],
  dosing:{
    standard:'0.5-3mg for circadian entrainment (lower is often better)',
    insomnia:'1-5mg 30-60 min before bedtime',
    max:'10mg (higher doses not more effective and may cause next-day grogginess)',
    form:'Immediate-release for sleep onset. Extended-release for sleep maintenance (Circadin 2mg, Rx in EU). Sublingual for faster onset. Gummies often inaccurately dosed.',
    timing:'CRITICAL: timing matters more than dose. For delayed sleep phase: 4-5 hours before desired bedtime. For general insomnia: 30-60 min before bed.',
    onset:'Acute soporific: 30-60 minutes. Circadian phase-shifting: 3-5 days consistent use.'
  },
  sideEffects:['Daytime drowsiness/grogginess (dose-dependent — use lowest effective dose)','Headache','Dizziness','Vivid dreams or nightmares','Mild hypothermia','Possible immune stimulation (theoretical concern in autoimmune conditions)','Rare: next-day cognitive impairment at high doses'],
  drugInteractions:['Anticoagulants (melatonin may have mild anticoagulant effect)','Antihypertensives (additive BP reduction)','CNS depressants (additive sedation)','Fluvoxamine (strong CYP1A2 inhibitor — dramatically increases melatonin levels → use much lower dose)','Diabetes medications (may affect glucose tolerance)','Immunosuppressants (melatonin is immunostimulatory)'],
  contraindications:['Autoimmune conditions (theoretical — immunostimulatory effects)','Seizure disorders (mixed evidence — some studies show benefit, some show lowered threshold)','Depression (high doses may worsen — melatonin suppresses serotonin at MT1 receptor)','Pregnancy/lactation (insufficient safety data for supplementation — endogenous melatonin is fine)'],
  qualityNotes:'OTC melatonin in the US is poorly regulated. Studies show actual content varies 83% from label (Erland & Saxena, 2017). Some products contained serotonin. Use USP-verified or pharmaceutical-grade. Lowest effective dose is preferred — more is NOT better with melatonin.',
  costEstimate:'$5-15/month. Very inexpensive.',
  keyCitations:[
    'Ferracioli-Oda, E. et al. (2013). Meta-analysis: melatonin for the treatment of primary sleep disorders. PLoS ONE, 8(5), e63773.',
    'Gringras, P. et al. (2017). Melatonin for sleep problems in children with neurodevelopmental disorders. BMJ, 358, j4030.',
    'Herxheimer, A. & Petrie, K.J. (2002). Melatonin for the prevention and treatment of jet lag. Cochrane Database Syst Rev.',
    'Erland, L.A. & Saxena, P.K. (2017). Melatonin natural health products and supplements: Presence of serotonin and significant variability. J Clin Sleep Med, 13(2), 275-281.'
  ]
},

'Milk Thistle': {
  fullName:'Milk Thistle (Silymarin / Silybin)',
  category:'Herbal / Hepatoprotective',
  overview:'Flavonoid complex extracted from Silybum marianum seeds. Primarily known for hepatoprotective properties. Emerging psychiatric interest for OCD based on a single RCT showing equivalence to fluoxetine. Anti-inflammatory and antioxidant properties. Silymarin is the standardized extract; silybin is the primary active flavonolignan.',
  mechanism:'Antioxidant: scavenges free radicals, increases glutathione. Anti-inflammatory: inhibits NF-κB and TNF-α. Hepatoprotective: stabilizes hepatocyte membranes, promotes liver regeneration. Neuroprotective: crosses BBB (limited). Proposed OCD mechanism: modulation of serotonergic system and/or anti-inflammatory effects on frontal-striatal circuits.',
  neuralTargets:['NF-κB pathway (anti-inflammatory)','Glutathione synthesis','Serotonergic system (proposed)','Hepatocyte protection (relevant for medication-induced liver damage)','Oxidative stress pathways'],
  indications:[
    {dx:'OCD (augmentation)',evidence:'C+',effectSize:'Comparable to fluoxetine in single RCT',notes:'Sayyah et al. (2010): silymarin 600mg/day = fluoxetine 30mg for OCD. Single small RCT. Needs replication.'},
    {dx:'Liver Protection (psychiatric meds)',evidence:'B',effectSize:'Improved liver enzymes',notes:'Adjunctive hepatoprotection for patients on hepatotoxic medications (valproate, carbamazepine, etc.).'},
    {dx:'Alcoholic Liver Disease',evidence:'B',effectSize:'Improved liver function',notes:'Traditional indication with moderate evidence.'}
  ],
  dosing:{
    standard:'420-600mg silymarin/day (divided into 2-3 doses)',
    form:'Standardized to 70-80% silymarin content. Capsules or tablets. Phosphatidylcholine complex (Siliphos/Silipide) may have better bioavailability. Take with meals.',
    onset:'Liver protection: 2-4 weeks. OCD (if effective): 8 weeks (per Sayyah study).'
  },
  sideEffects:['GI upset, diarrhea (mild)','Allergic reaction (rare — Asteraceae family allergy cross-reactivity)','Headache (uncommon)','Very well tolerated overall'],
  drugInteractions:['CYP3A4 substrates: silymarin may inhibit CYP3A4 → increase levels (moderate concern)','CYP2C9 substrates: possible inhibition','UGT substrates: may affect glucuronidation','Raloxifene/tamoxifen: may increase levels','Indinavir/other protease inhibitors: possible interaction'],
  contraindications:['Asteraceae/Compositae family allergy (ragweed, daisies, marigolds)','Hormone-sensitive conditions (silymarin has weak estrogenic activity — theoretical)'],
  qualityNotes:'Standardized to 70-80% silymarin. Reputable brands with third-party testing preferred. Siliphos (silybin-phosphatidylcholine complex) may have superior bioavailability.',
  costEstimate:'$10-20/month.',
  keyCitations:[
    'Sayyah, M. et al. (2010). A preliminary randomized double-blind clinical trial on the efficacy of aqueous extract of Silybum marianum in OCD. J Med Food, 13(6), 1407-1412.',
    'Saller, R. et al. (2001). An updated systematic review of the pharmacology of silymarin. Forsch Komplementmed, 8(2), 73-80.',
    'Abenavoli, L. et al. (2010). Milk thistle in liver diseases. Phytother Res, 24(10), 1423-1432.'
  ]
},

'Multivitamin': {
  fullName:'Multivitamin + Mineral Supplementation',
  category:'Multi-Micronutrient',
  overview:'Broad-spectrum micronutrient supplementation to correct deficiencies common in psychiatric populations, particularly eating disorders, malnutrition, substance use disorders, and elderly patients. Not a psychiatric treatment per se but addresses the metabolic foundation required for neurotransmitter synthesis and brain function. Deficiency of any single micronutrient (iron, zinc, B12, folate, magnesium, vitamin D) can produce or exacerbate psychiatric symptoms.',
  mechanism:'Provides cofactors for: neurotransmitter synthesis (B6, B12, folate, iron, zinc, magnesium, vitamin C), antioxidant defense (vitamins C, E, selenium, zinc), energy metabolism (B vitamins, iron, CoQ10), myelination (B12, folate), and immune function (zinc, vitamin D, selenium). In eating disorders: refeeding requires micronutrient repletion to support metabolic recovery and prevent refeeding syndrome complications.',
  neuralTargets:['Multiple enzyme systems for neurotransmitter synthesis','Mitochondrial energy production','Antioxidant defense systems','Myelination and neuronal membrane integrity','Immune function (neuroimmune axis)'],
  indications:[
    {dx:'Anorexia Nervosa',evidence:'A (supportive care)',effectSize:'Essential during refeeding',notes:'Not a treatment for AN itself but critical for medical stabilization. Monitor phosphate, potassium, magnesium, thiamine during refeeding.'},
    {dx:'Substance Use Disorders',evidence:'B (deficiency correction)',effectSize:'Addresses common deficiencies',notes:'Alcohol use: thiamine (prevent Wernicke), B12, folate, magnesium, zinc. Opioid use: vitamin D, iron, zinc deficiency common.'},
    {dx:'Conduct Disorder / Antisocial Behavior',evidence:'B',effectSize:'d=0.24-0.40',notes:'Gesch et al. (2002): micronutrient supplementation reduced antisocial behavior in prisoners. Replicated by Zaalberg et al. (2010).'},
    {dx:'Elderly Depression',evidence:'B (deficiency context)',effectSize:'Addresses B12, folate, D deficiency',notes:'Deficiency prevalence high in elderly. Correction may improve or prevent depression.'},
    {dx:'General Psychiatric Populations',evidence:'B (nutritional support)',effectSize:'Variable',notes:'Rucklidge et al. (2014): broad-spectrum micronutrients improved ADHD, mood. Addresses suboptimal intake.'}
  ],
  dosing:{
    standard:'Standard multivitamin/mineral providing ~100% RDA of most nutrients',
    therapeutic:'High-potency formulations (Hardy Nutritionals Daily Essential Nutrients, EMPowerplus) for psychiatric indications — significantly above RDA',
    form:'Capsules or tablets. Avoid gummies (lower nutrient content). Take with food. Split dosing improves absorption for high-potency formulations.',
    specific:'In eating disorders: targeted supplementation guided by labs (phosphate, potassium, magnesium, thiamine, zinc, iron). In alcohol use: high-dose thiamine (300-500mg IV initially, then 100mg oral), B12, folate.',
    monitoring:'Baseline labs: CBC, CMP, iron studies, B12, folate, 25-OH-D, magnesium, zinc, phosphate (if malnourished).'
  },
  sideEffects:['GI upset, nausea (take with food)','Constipation (iron-containing formulations)','Metallic taste','Dark stools (iron)','Rare: hypervitaminosis A or D with prolonged high-dose use','Iron overload in hemochromatosis'],
  drugInteractions:['Thyroid medications (calcium, iron reduce absorption — separate by 4 hours)','Antibiotics (calcium, iron, zinc chelate fluoroquinolones and tetracyclines — separate by 2 hours)','Levodopa (B6 reduces efficacy if not combined with carbidopa)','Warfarin (vitamin K content — maintain consistent intake)','Antacids/PPIs (reduce B12, iron, magnesium absorption)'],
  contraindications:['Hemochromatosis (iron overload)','Wilson\'s disease (copper accumulation)','Hypercalcemia','Renal failure (accumulation of water-soluble vitamins)','Known hypersensitivity to specific ingredients'],
  qualityNotes:'Quality varies enormously. USP-verified or NSF-certified products preferred. ConsumerLab.com tests products for content accuracy. For psychiatric populations: Hardy Nutritionals Daily Essential Nutrients (36-ingredient formula) has most psychiatric research. Standard Centrum/One-A-Day adequate for basic deficiency prevention.',
  costEstimate:'$10-30/month (standard). $50-100/month (high-potency psychiatric formulations).',
  keyCitations:[
    'Gesch, C.B. et al. (2002). Influence of supplementary vitamins, minerals and essential fatty acids on antisocial behaviour. Br J Psychiatry, 181, 22-28.',
    'Rucklidge, J.J. et al. (2014). Vitamin-mineral treatment of ADHD: A randomized controlled trial. Br J Psychiatry, 204, 306-315.',
    'Zaalberg, A. et al. (2010). Effects of nutritional supplements on aggression, rule-breaking, and psychopathology among young adult prisoners. Aggress Behav, 36(2), 117-126.',
    'Kaplan, B.J. et al. (2015). The emerging field of nutritional mental health. Clin Psychol Sci, 3(6), 964-980.'
  ]
},

'NAC': {
  fullName:'N-Acetylcysteine (NAC)',
  category:'Amino Acid Derivative',
  overview:'Precursor to glutathione (the body\'s primary intracellular antioxidant). Modulates glutamatergic neurotransmission via cystine-glutamate antiporter (system Xc-), reduces oxidative stress, and has anti-inflammatory properties. One of the most versatile psychiatric supplements with evidence across multiple diagnoses including OCD, depression, schizophrenia, substance use disorders, gambling, and trichotillomania.',
  mechanism:'Restores glutathione levels → reduces oxidative stress and neuroinflammation. Modulates glutamate: activates cystine-glutamate antiporter (system Xc-) → increases extrasynaptic glutamate → activates presynaptic mGluR2/3 autoreceptors → reduces synaptic glutamate release. This is the proposed mechanism for anti-compulsive and anti-craving effects. Also: reduces TNF-α and IL-6, modulates dopamine release in nucleus accumbens, and may improve mitochondrial function.',
  neuralTargets:['Glutamatergic system (system Xc-, mGluR2/3)','Nucleus accumbens (dopamine modulation)','Prefrontal cortex (glutathione restoration)','Oxidative stress pathways (GSH synthesis)','Inflammatory cascades (TNF-α, IL-6 reduction)','Mitochondrial function'],
  indications:[
    {dx:'OCD',evidence:'B',effectSize:'d=0.40-0.60 as augmentation to SRI',notes:'Afshar et al. (2012): NAC + fluvoxamine superior to fluvoxamine alone. Typical dose 2400-3000mg/day.'},
    {dx:'MDD',evidence:'B',effectSize:'d=0.34-0.48 as augmentation',notes:'Berk et al. (2014). Most evidence as add-on to antidepressant. 1000-2000mg/day.'},
    {dx:'Schizophrenia',evidence:'B',effectSize:'d=0.45 for negative symptoms',notes:'Berk et al. (2008). 2000mg/day as augmentation to antipsychotic. May improve negative symptoms and cognition.'},
    {dx:'Bipolar Depression',evidence:'B',effectSize:'d=0.37',notes:'Berk et al. (2008). Adjunctive 2000mg/day. May reduce depressive episodes.'},
    {dx:'Substance Use Disorders',evidence:'B',effectSize:'d=0.30-0.45',notes:'Cocaine, cannabis, nicotine. Reduces craving via glutamate normalization. Grant et al. (2014).'},
    {dx:'Gambling Disorder',evidence:'B',effectSize:'d=0.42',notes:'Grant et al. (2007). 1200-1800mg/day. Reduces urges.'},
    {dx:'Trichotillomania',evidence:'B',effectSize:'d=0.52',notes:'Grant et al. (2009). 1200-2400mg/day. Reduces hair-pulling urges.'},
    {dx:'BPD (adjunctive)',evidence:'C+',effectSize:'Preliminary',notes:'Glutamate dysregulation and impulsivity rationale.'},
    {dx:'Complex PTSD',evidence:'C+',effectSize:'Preliminary',notes:'Oxidative stress reduction; glutamate modulation.'}
  ],
  dosing:{
    standard:'600-900mg twice daily (1200-1800mg/day total)',
    therapeutic:'1000-1200mg twice daily (2000-2400mg/day) for psychiatric indications',
    max:'3000mg/day (OCD augmentation)',
    form:'Capsules or powder. Take with or without food. Sustained-release may reduce GI side effects.',
    onset:'2-4 weeks for initial effects. Full benefit: 8-12 weeks.',
    timing:'Divided doses (morning and evening). Can be taken with meals to reduce nausea.'
  },
  sideEffects:['GI upset: nausea, diarrhea, bloating (most common, dose-dependent)','Headache','Rash (uncommon)','Foul taste/smell (sulfur compound)','Rare: bronchospasm in asthmatics at very high doses'],
  drugInteractions:['Nitroglycerin: may potentiate vasodilatory effects (avoid combination)','Activated charcoal: reduces NAC absorption','Chemotherapy: theoretical concern about antioxidant interference (discuss with oncologist)','Anticoagulants: may have mild antiplatelet effect at high doses'],
  contraindications:['Allergy to NAC or acetylcysteine','Active peptic ulcer (may worsen GI symptoms)','Caution in asthma (rare bronchospasm risk — more relevant for inhaled form)'],
  qualityNotes:'Look for USP-verified or third-party tested products. Pharmaceutical-grade NAC (same compound used IV for acetaminophen overdose) is well-characterized. Sustained-release formulations may improve tolerability.',
  costEstimate:'$15-30/month at therapeutic doses. Widely available OTC.',
  keyCitations:[
    'Berk, M. et al. (2008). N-acetylcysteine as a glutathione precursor for schizophrenia. Biol Psychiatry, 64(5), 361-368.',
    'Berk, M. et al. (2014). Effect of NAC on depressive symptoms: A systematic review and meta-analysis. J Clin Psychiatry, 75(6), 628-636.',
    'Grant, J.E. et al. (2009). NAC for trichotillomania. Arch Gen Psychiatry, 66(7), 756-763.',
    'Afshar, H. et al. (2012). NAC augmentation of fluvoxamine in OCD. Iran J Psychiatry, 7(4), 184-188.'
  ]
},

'Phosphatidylserine': {
  fullName:'Phosphatidylserine (PS)',
  category:'Phospholipid',
  overview:'Phospholipid concentrated in neuronal membranes, essential for membrane fluidity, receptor function, and neurotransmitter release. Endogenously synthesized but declines with age. Supplementation may improve cognitive function, reduce cortisol response to stress, and support attention. FDA allows qualified health claim for cognitive dysfunction and dementia.',
  mechanism:'Structural component of neuronal membranes → maintains membrane fluidity and receptor accessibility. Cofactor for protein kinase C (PKC) activation → signal transduction. Modulates cortisol response to physical and psychological stress (blunts HPA axis activation). Supports acetylcholine synthesis and dopamine release. May enhance glucose metabolism in the brain.',
  neuralTargets:['Neuronal membrane structure and fluidity','PKC signaling','HPA axis (cortisol blunting)','Acetylcholine system','Dopamine release','Glucose metabolism in brain'],
  indications:[
    {dx:'ADHD',evidence:'B',effectSize:'d=0.28-0.36',notes:'Hirayama et al. (2014): 200mg/day improved attention and impulsivity in children. Manor et al. (2012).'},
    {dx:'PTSD',evidence:'C+',effectSize:'Preliminary (cortisol modulation)',notes:'200-300mg/day. Cortisol blunting may reduce hyperarousal.'},
    {dx:'Age-Related Cognitive Decline',evidence:'B',effectSize:'d=0.30',notes:'FDA qualified health claim. Cenacchi et al. (1993): improved cognitive function in elderly.'},
    {dx:'Stress/Cortisol Reduction',evidence:'B',effectSize:'Reduced cortisol response to exercise stress',notes:'Monteleone et al. (1992): 400-800mg/day blunted cortisol response.'}
  ],
  dosing:{
    standard:'100mg three times daily (300mg/day)',
    therapeutic:'200-400mg/day',
    form:'Soy-derived or sunflower-derived phosphatidylserine. Softgels or powder. Take with meals (fat enhances absorption). Some formulations combined with omega-3 (PS-omega-3 complex).',
    onset:'Cognitive effects: 4-8 weeks. Cortisol modulation: 2-4 weeks.'
  },
  sideEffects:['GI upset (mild — take with food)','Insomnia at high doses (take in morning)','Generally very well tolerated'],
  drugInteractions:['Anticoagulants (theoretical mild anticoagulant effect at high doses)','Cholinesterase inhibitors (additive cholinergic effects)','Antihistamines/anticholinergics (may counteract PS benefits)'],
  contraindications:['Soy allergy (for soy-derived PS — use sunflower-derived)','Antiphospholipid syndrome (theoretical concern)'],
  qualityNotes:'Originally derived from bovine brain (BSE/prion concern). Modern PS is soy-derived or sunflower-derived (safe). Sharp-PS (sunflower-derived, non-GMO) is well-studied branded form. Third-party testing recommended.',
  costEstimate:'$20-35/month.',
  keyCitations:[
    'Hirayama, S. et al. (2014). Effect of phosphatidylserine administration on symptoms of ADHD in children. J Hum Nutr Diet, 27(Suppl 2), 284-291.',
    'Manor, I. et al. (2012). The effect of PS-omega3 on ADHD in children. Eur Psychiatry, 27(8), 584-591.',
    'Cenacchi, T. et al. (1993). Cognitive decline in the elderly: A double-blind placebo-controlled trial on phosphatidylserine. Aging Clin Exp Res, 5(2), 123-133.',
    'Monteleone, P. et al. (1992). Blunting by PS of cortisol response to exercise stress. Eur J Clin Pharmacol, 42(4), 385-388.'
  ]
},

'Pycnogenol': {
  fullName:'Pycnogenol (French Maritime Pine Bark Extract)',
  category:'Polyphenol / Antioxidant',
  overview:'Standardized extract from French maritime pine bark (Pinus pinaster) containing procyanidins, bioflavonoids, and phenolic acids. Potent antioxidant and anti-inflammatory with emerging evidence for ADHD, cognitive function, and cardiovascular health. Enhances endogenous antioxidant enzyme activity (SOD, GPx) and improves endothelial function/nitric oxide production.',
  mechanism:'Procyanidins and catechins are potent free radical scavengers. Upregulates endogenous antioxidant enzymes (SOD, GPx, catalase). Enhances endothelial nitric oxide synthase (eNOS) → improved cerebral blood flow. Inhibits NF-κB → anti-inflammatory. May modulate dopamine and norepinephrine reuptake (proposed ADHD mechanism). Collagen stabilization.',
  neuralTargets:['Oxidative stress pathways (SOD, GPx upregulation)','Endothelial function / cerebral blood flow (eNOS)','Inflammatory pathways (NF-κB)','Dopamine/NE system (possible reuptake modulation)','Collagen/vascular integrity'],
  indications:[
    {dx:'ADHD',evidence:'B',effectSize:'d=0.30-0.42',notes:'Trebaticka et al. (2006): 1mg/kg/day improved attention, hyperactivity, coordination in children. Symptom return upon discontinuation.'},
    {dx:'Cognitive Function (healthy)',evidence:'B',effectSize:'d=0.25',notes:'Luzzi et al. (2011): improved cognitive function in healthy professionals. Cerebral blood flow enhancement.'},
    {dx:'Menopausal Symptoms',evidence:'B',effectSize:'Improved vasomotor symptoms',notes:'Yang et al. (2012).'}
  ],
  dosing:{
    standard:'50-100mg/day (adults)',
    adhd:'1mg/kg/day (pediatric dosing in ADHD studies)',
    form:'Standardized extract tablets or capsules. Pycnogenol is a registered trademark (Horphag Research). Take with meals.',
    onset:'Antioxidant: immediate (biochemical). ADHD symptoms: 4-8 weeks. Full benefit: 8-12 weeks.'
  },
  sideEffects:['GI upset (mild)','Headache (uncommon)','Dizziness (rare)','Very well tolerated overall'],
  drugInteractions:['Anticoagulants/antiplatelets (mild antiplatelet effect — monitor)','Immunosuppressants (immune-modulating properties)','Diabetes medications (may lower blood glucose)','Antihypertensives (may lower BP)'],
  contraindications:['Pine allergy','Autoimmune conditions (immune modulation)','Scheduled surgery (discontinue 2 weeks prior)'],
  qualityNotes:'Pycnogenol is a specific patented extract with defined standardization. Generic "pine bark extract" may not be equivalent. Use only Pycnogenol-branded products or verified equivalents.',
  costEstimate:'$20-35/month.',
  keyCitations:[
    'Trebaticka, J. et al. (2006). Treatment of ADHD with French maritime pine bark extract, Pycnogenol. Eur Child Adolesc Psychiatry, 15(6), 329-335.',
    'Luzzi, R. et al. (2011). Pycnogenol supplementation improves cognitive function, attention, and mental performance in students. Panminerva Med, 53(3 Suppl 1), 75-82.',
    'Rohdewald, P. (2002). A review of the French maritime pine bark extract Pycnogenol. Int J Clin Pharmacol Ther, 40(4), 158-168.'
  ]
},

'Vitex Agnus-Castus': {
  fullName:'Vitex Agnus-Castus (Chasteberry)',
  category:'Herbal / Dopaminergic',
  overview:'Berry extract from Vitex agnus-castus (chaste tree). Primary evidence for premenstrual syndrome (PMS) and premenstrual dysphoric disorder (PMDD). Acts as a dopamine agonist at D2 receptors → reduces prolactin → normalizes progesterone/estrogen ratio. One of the best-studied herbs for menstrual-related mood disorders.',
  mechanism:'Diterpenes in Vitex bind dopamine D2 receptors (agonist) → inhibits prolactin release from anterior pituitary → normalizes luteal phase progesterone levels. Also binds mu-opioid receptors and beta-endorphin receptors (analgesic, mood-modulating). May modulate GABA-A receptors. The prolactin-lowering, progesterone-normalizing mechanism addresses the hormonal component of PMS/PMDD.',
  neuralTargets:['Dopamine D2 receptors (agonist → prolactin suppression)','Pituitary (prolactin regulation)','Mu-opioid receptors (pain/mood)','GABA-A receptors (possible modulation)','HPG axis (hormonal normalization)'],
  indications:[
    {dx:'PMDD',evidence:'B+',effectSize:'52% symptom reduction; NNT ~3-4',notes:'Schellenberg (2001): 20mg/day Vitex superior to placebo for PMS/PMDD. He et al. (2009) meta-analysis positive.'},
    {dx:'PMS',evidence:'A',effectSize:'d=0.50-0.70',notes:'German Commission E approved for PMS. Multiple positive RCTs. ZE 440 extract most studied.'},
    {dx:'Luteal Phase Deficiency',evidence:'B',effectSize:'Normalized progesterone levels',notes:'Milewicz et al. (1993): reduced prolactin, normalized luteal phase.'},
    {dx:'Cyclical Mastalgia',evidence:'B',effectSize:'Reduced breast pain',notes:'Secondary to prolactin reduction.'}
  ],
  dosing:{
    standard:'20-40mg/day dried fruit extract (standardized to 0.5% agnuside)',
    form:'Standardized capsules or liquid extract. ZE 440 (Zeller AG) is the specific extract used in most clinical trials. Take once daily in morning.',
    onset:'1-3 menstrual cycles for full effect. Some improvement within first cycle.',
    duration:'Continue for minimum 3-6 cycles. May discontinue after symptom resolution — some women maintain benefit.'
  },
  sideEffects:['GI upset (mild)','Headache','Acne (paradoxical — may occur initially)','Menstrual flow changes','Skin rash/itching (uncommon)','Reduced efficacy of oral contraceptives (theoretical)'],
  drugInteractions:['Dopamine agonists (bromocriptine, cabergoline): additive dopaminergic effect','Dopamine antagonists (antipsychotics): may reduce antipsychotic efficacy (D2 agonism)','Oral contraceptives: may reduce efficacy (hormonal modulation)','Hormone replacement therapy: may interact','IVF medications: avoid (hormonal interference)'],
  contraindications:['Hormone-sensitive conditions (breast cancer, uterine fibroids)','Pregnancy (traditional emmenagogue — avoid)','Concurrent antipsychotic therapy (D2 agonism may counteract)','IVF/assisted reproduction (hormonal interference)','Pituitary disorders'],
  qualityNotes:'ZE 440 (Zeller AG) is the specific extract with most clinical trial data. Generic chasteberry extracts vary in potency. Standardized to agnuside content. Third-party testing recommended.',
  costEstimate:'$10-20/month.',
  keyCitations:[
    'Schellenberg, R. (2001). Treatment for the premenstrual syndrome with agnus castus fruit extract. BMJ, 322(7279), 134-137.',
    'He, Z. et al. (2009). Treatment for premenstrual syndrome with Vitex agnus castus: A prospective randomized study. Aust N Z J Obstet Gynaecol, 49(2), 162-167.',
    'Milewicz, A. et al. (1993). Vitex agnus castus extract in the treatment of luteal phase defects. Arzneimittelforschung, 43(7), 752-756.'
  ]
},


};

// ═══════════════════════════════════════════════════════════════
// FUZZY MATCHING FUNCTION
// Maps all DSM-circuit-map nutrition intervention names to
// their consolidated monograph keys.
// ═══════════════════════════════════════════════════════════════

function findNutritionMonograph(name) {
  if (!name) return null;
  var n = name.toLowerCase().trim();

  // Direct match first
  var keys = Object.keys(NUTRITION_MONOGRAPHS);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === n) return NUTRITION_MONOGRAPHS[keys[i]];
  }

  // Fuzzy map: all known intervention names → monograph keys
  var fuzzyMap = {
    // ── Omega-3 Fatty Acids ──────────────────────────────────────────
    'omega-3': 'Omega-3 Fatty Acids',
    'omega-3 fatty acids': 'Omega-3 Fatty Acids',
    'omega-3 (epa)': 'Omega-3 Fatty Acids',
    'omega-3 (epa+dha)': 'Omega-3 Fatty Acids',
    'omega-3 (epa-dominant)': 'Omega-3 Fatty Acids',
    'omega-3 (prevention)': 'Omega-3 Fatty Acids',
    'omega-3 fatty acids (epa>dha)': 'Omega-3 Fatty Acids',
    'epa': 'Omega-3 Fatty Acids',
    'dha': 'Omega-3 Fatty Acids',
    'fish oil': 'Omega-3 Fatty Acids',
    'epa/dha': 'Omega-3 Fatty Acids',
    'omega 3': 'Omega-3 Fatty Acids',

    // ── Magnesium ─────────────────────────────────────────────────────
    'magnesium': 'Magnesium',
    'magnesium glycinate': 'Magnesium',
    'magnesium threonate': 'Magnesium',
    'magnesium citrate': 'Magnesium',
    'magnesium taurate': 'Magnesium',
    'magnesium (glycinate)': 'Magnesium',
    'magnesium (glycinate/threonate)': 'Magnesium',
    'magnesium glycinate (400mg)': 'Magnesium',
    'magnesium (glycinate/citrate)': 'Magnesium',
    'magtein': 'Magnesium',
    'mg glycinate': 'Magnesium',
    'mg threonate': 'Magnesium',

    // ── L-Theanine ────────────────────────────────────────────────────
    'l-theanine': 'L-Theanine',
    'theanine': 'L-Theanine',
    'l-theanine (200mg)': 'L-Theanine',
    'l-theanine (200-400mg)': 'L-Theanine',
    'suntheanine': 'L-Theanine',

    // ── Iron ──────────────────────────────────────────────────────────
    'iron': 'Iron',
    'iron (if ferritin <45)': 'Iron',
    'iron supplementation': 'Iron',
    'ferrous sulfate': 'Iron',

    // ── Zinc ──────────────────────────────────────────────────────────
    'zinc': 'Zinc',
    'zinc (15-25mg)': 'Zinc',
    'zinc (14mg/day)': 'Zinc',
    'zinc gluconate': 'Zinc',
    'zinc picolinate': 'Zinc',

    // ── Vitamin D ─────────────────────────────────────────────────────
    'vitamin d': 'Vitamin D',
    'vitamin d3': 'Vitamin D',
    'cholecalciferol': 'Vitamin D',
    'vitamin d (2000-5000 iu/day)': 'Vitamin D',
    'vit d': 'Vitamin D',

    // ── B Vitamins / Folate / B12 / B6 ───────────────────────────────
    'b vitamins': 'B Vitamins',
    'b-vitamins': 'B Vitamins',
    'folate + b12': 'B Vitamins',
    'folic acid': 'B Vitamins',
    'vitamin b12': 'B Vitamins',
    'b12': 'B Vitamins',
    'vitamin b6': 'B Vitamins',
    'vitamin b6 (50-100mg)': 'B Vitamins',
    'b6': 'B Vitamins',
    'thiamine': 'B Vitamins',
    'riboflavin': 'B Vitamins',
    'niacin': 'B Vitamins',
    'b-complex': 'B Vitamins',

    // ── L-Methylfolate (separate — prescription-level dosing) ─────────
    'l-methylfolate': 'L-Methylfolate',
    'methylfolate': 'L-Methylfolate',
    'l-methylfolate (15mg)': 'L-Methylfolate',
    '5-mthf': 'L-Methylfolate',
    'deplin': 'L-Methylfolate',
    'metafolin': 'L-Methylfolate',
    'quatrefolic': 'L-Methylfolate',

    // ── Calcium ───────────────────────────────────────────────────────
    'calcium': 'Calcium',
    'calcium (1200mg/day)': 'Calcium',
    'calcium carbonate': 'Calcium',
    'calcium citrate': 'Calcium',

    // ── Creatine ──────────────────────────────────────────────────────
    'creatine': 'Creatine',
    'creatine monohydrate': 'Creatine',
    'creatine (3-5g/day)': 'Creatine',

    // ── Inositol / Myoinositol ────────────────────────────────────────
    'inositol': 'Inositol',
    'myoinositol': 'Inositol',
    'myo-inositol': 'Inositol',
    'myoinositol (12-18g/day)': 'Inositol',
    'inositol (12-18g/day)': 'Inositol',

    // ── Probiotics ────────────────────────────────────────────────────
    'probiotics': 'Probiotics',
    'probiotics (lactobacillus/bifido)': 'Probiotics',
    'lactobacillus': 'Probiotics',
    'bifidobacterium': 'Probiotics',
    'gut microbiome supplementation': 'Probiotics',

    // ── SAMe ──────────────────────────────────────────────────────────
    'same': 'SAMe',
    's-adenosylmethionine': 'SAMe',
    's-adenosyl-l-methionine': 'SAMe',
    'same (800-1600mg/day)': 'SAMe',

    // ── Sulforaphane ──────────────────────────────────────────────────
    'sulforaphane': 'Sulforaphane',
    'broccoli sprout extract': 'Sulforaphane',
    'sulforaphane (broccoli extract)': 'Sulforaphane',
    'glucoraphanin': 'Sulforaphane',
    'broccoli sprout': 'Sulforaphane',

    // ── Glycine ───────────────────────────────────────────────────────
    'glycine': 'Glycine',
    'glycine (3g before bed)': 'Glycine',
    'glycine (3g)': 'Glycine',
    'glycine (high dose, 60g/day)': 'Glycine',
    'glycine (30-60g/day)': 'Glycine',
    'glycine (60g/day)': 'Glycine',

    // ── Apigenin (must come before chamomile to avoid interception)
    'apigenin (chamomile': 'Apigenin',
    'apigenin': 'Apigenin',

    // ── Chamomile / Apigenin ──────────────────────────────────────────
    'chamomile extract': 'Chamomile Extract',
    'chamomile': 'Chamomile Extract',
    'matricaria chamomilla': 'Chamomile Extract',
    'apigenin (chamomile, 50mg)': 'Apigenin',
    'apigenin (50mg)': 'Apigenin',

    // ── Kava ──────────────────────────────────────────────────────────
    'kava': 'Kava',
    'kava kava': 'Kava',
    'piper methysticum': 'Kava',
    'kavalactones': 'Kava',

    // ── Tart Cherry ───────────────────────────────────────────────────
    'tart cherry': 'Tart Cherry',
    'tart cherry juice': 'Tart Cherry',
    'montmorency cherry': 'Tart Cherry',
    'cherry juice': 'Tart Cherry',

    // ── NAC ───────────────────────────────────────────────────────────
    'nac': 'NAC',
    'n-acetylcysteine': 'NAC',
    'n-acetyl cysteine': 'NAC',
    'nac (1200-1800mg)': 'NAC',
    'nac (1200-2400mg)': 'NAC',
    'nac (2000mg)': 'NAC',
    'nac (2400-3000mg)': 'NAC',
    'nac (2400mg)': 'NAC',
    'nac (n-acetylcysteine 1200-2400mg)': 'NAC',

    // ── Ashwagandha ───────────────────────────────────────────────────
    'ashwagandha': 'Ashwagandha',
    'withania somnifera': 'Ashwagandha',
    'ashwagandha (300-600mg ksm-66)': 'Ashwagandha',
    'ksm-66': 'Ashwagandha',
    'sensoril': 'Ashwagandha',

    // ── Curcumin ──────────────────────────────────────────────────────
    'curcumin': 'Curcumin',
    'turmeric': 'Curcumin',
    'curcumin (500-1000mg)': 'Curcumin',
    'curcuma longa': 'Curcumin',
    'bcm-95': 'Curcumin',
    'meriva': 'Curcumin',
    'theracurmin': 'Curcumin',

    // ── CBD ───────────────────────────────────────────────────────────
    'cbd': 'CBD',
    'cannabidiol': 'CBD',
    'cbd (25-50mg)': 'CBD',
    'hemp extract': 'CBD',
    'epidiolex': 'CBD',

    // ── Lavender Oil (Silexan) ────────────────────────────────────────
    'lavender oil': 'Lavender Oil',
    'silexan': 'Lavender Oil',
    'lavender oil (silexan 80mg)': 'Lavender Oil',
    'lavender oil (silexan)': 'Lavender Oil',
    'lavela': 'Lavender Oil',
    'lasea': 'Lavender Oil',
    'calm aid': 'Lavender Oil',

    // ── Melatonin ─────────────────────────────────────────────────────
    'melatonin': 'Melatonin',
    'melatonin (1-3mg)': 'Melatonin',
    'melatonin (0.5-3mg)': 'Melatonin',
    'circadin': 'Melatonin',
    'slenyto': 'Melatonin',

    // ── Phosphatidylserine ────────────────────────────────────────────
    'phosphatidylserine': 'Phosphatidylserine',
    'phosphatidylserine (200mg)': 'Phosphatidylserine',
    'phosphatidylserine (300mg)': 'Phosphatidylserine',
    'sharp-ps': 'Phosphatidylserine',

    // ── Pycnogenol ────────────────────────────────────────────────────
    'pycnogenol': 'Pycnogenol',
    'pine bark extract': 'Pycnogenol',
    'pycnogenol (1mg/kg)': 'Pycnogenol',
    'french maritime pine': 'Pycnogenol',

    // ── Milk Thistle ──────────────────────────────────────────────────
    'milk thistle': 'Milk Thistle',
    'silymarin': 'Milk Thistle',
    'milk thistle (silymarin 600mg)': 'Milk Thistle',
    'silybin': 'Milk Thistle',
    'silybum marianum': 'Milk Thistle',

    // ── Kudzu Extract ─────────────────────────────────────────────────
    'kudzu extract': 'Kudzu Extract',
    'kudzu': 'Kudzu Extract',
    'kudzu extract (puerarin)': 'Kudzu Extract',
    'puerarin': 'Kudzu Extract',
    'pueraria lobata': 'Kudzu Extract',

    // ── Vitex Agnus-Castus ────────────────────────────────────────────
    'vitex agnus-castus': 'Vitex Agnus-Castus',
    'vitex': 'Vitex Agnus-Castus',
    'chasteberry': 'Vitex Agnus-Castus',
    'chaste tree': 'Vitex Agnus-Castus',
    'vitex agnus-castus (chasteberry 20mg)': 'Vitex Agnus-Castus',
    'vitex agnus-castus (chasteberry)': 'Vitex Agnus-Castus',

    // ── Chromium Picolinate ───────────────────────────────────────────
    'chromium picolinate': 'Chromium Picolinate',
    'chromium picolinate (600-1000mcg)': 'Chromium Picolinate',
    'chromium': 'Chromium Picolinate',

    // ── Mediterranean Diet ────────────────────────────────────────────
    'mediterranean diet': 'Mediterranean Diet',
    'mediterranean-style diet': 'Mediterranean Diet',
    'mind diet': 'Mediterranean Diet',

    // ── Anti-inflammatory Diet ────────────────────────────────────────
    'anti-inflammatory diet': 'Anti-inflammatory Diet',
    'anti-inflammatory eating': 'Anti-inflammatory Diet',
    'low-inflammation diet': 'Anti-inflammatory Diet',

    // ── Caffeine Management ───────────────────────────────────────────
    'caffeine management': 'Caffeine Management',
    'caffeine reduction': 'Caffeine Management',
    'caffeine elimination': 'Caffeine Management',
    'caffeine elimination after noon': 'Caffeine Management',
    'reduce caffeine': 'Caffeine Management',
    'avoid caffeine': 'Caffeine Management',
    'caffeine restriction': 'Caffeine Management',

    // ── Structured Meal Plan ──────────────────────────────────────────
    'structured meal plan': 'Structured Meal Plan',
    'structured eating': 'Structured Meal Plan',
    'meal planning': 'Structured Meal Plan',
    'regular meal schedule': 'Structured Meal Plan',

    // ── Protein-rich Breakfast ────────────────────────────────────────
    'protein-rich breakfast': 'Protein-rich Breakfast',
    'protein breakfast': 'Protein-rich Breakfast',
    'high-protein breakfast': 'Protein-rich Breakfast',

    // ── Balanced Macronutrients ───────────────────────────────────────
    'balanced macronutrients': 'Balanced Macronutrients',
    'macronutrient balance': 'Balanced Macronutrients',
    'balanced diet': 'Balanced Macronutrients',

    // ── Adequate Protein and Fiber ────────────────────────────────────
    'adequate protein and fiber': 'Adequate Protein and Fiber',
    'protein and fiber': 'Adequate Protein and Fiber',
    'adequate protein': 'Adequate Protein and Fiber',

    // ── Blood Glucose Stability ───────────────────────────────────────
    'blood glucose stability': 'Blood Glucose Stability',
    'stable blood glucose': 'Blood Glucose Stability',
    'glycemic stability': 'Blood Glucose Stability',
    'blood glucose stabilization': 'Blood Glucose Stability',
    'glycemic control': 'Blood Glucose Stability',

    // ── Electrolyte Monitoring ────────────────────────────────────────
    'electrolyte monitoring': 'Electrolyte Monitoring',
    'phosphate/electrolyte monitoring': 'Electrolyte Monitoring',
    'electrolyte/phosphate monitoring': 'Electrolyte Monitoring',
    'refeeding syndrome monitoring': 'Electrolyte Monitoring',
    'phosphate monitoring': 'Electrolyte Monitoring',

    // ── Multi-micronutrient / Multivitamin ────────────────────────────
    'multi-micronutrient': 'Multi-micronutrient',
    'multi-micronutrient supplementation': 'Multi-micronutrient',
    'micronutrient supplementation': 'Multi-micronutrient',
    'daily essential nutrients': 'Multi-micronutrient',
    'empowerplus': 'Multi-micronutrient',
    'multivitamin': 'Multivitamin',
    'multivitamin + mineral': 'Multivitamin',
    'multivitamin + minerals': 'Multivitamin',
    'multivitamin and mineral': 'Multivitamin'
  };

  var fkeys = Object.keys(fuzzyMap);
  for (var f = 0; f < fkeys.length; f++) {
    var key = fkeys[f];
    if (key.length <= 3) {
      var re = new RegExp('(^|\\W)' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\W|$)', 'i');
      if (re.test(n) && fuzzyMap[key]) return NUTRITION_MONOGRAPHS[fuzzyMap[key]];
    } else {
      if (n.indexOf(key) !== -1 && fuzzyMap[key]) return NUTRITION_MONOGRAPHS[fuzzyMap[key]];
    }
  }

  return null;
}

if (typeof module !== 'undefined') module.exports = { NUTRITION_MONOGRAPHS: NUTRITION_MONOGRAPHS, findNutritionMonograph: findNutritionMonograph };
