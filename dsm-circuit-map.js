// ═══════════════════════════════════════════════════════════════════
// LIMEN HELIX — DSM-5 CIRCUIT MAPPING DATABASE
// Research-informed circuit associations for psychiatric phenotypes
// ═══════════════════════════════════════════════════════════════════
//
// EPISTEMIC STATUS:
//   This database synthesizes population-level neuroimaging findings
//   and maps them to DSM-5 diagnostic categories. These are
//   COMMONLY OBSERVED PATTERNS, not deterministic circuit definitions.
//
//   Key constraints:
//   - DSM diagnoses are descriptive phenotypes, not mechanistic entities
//   - Circuit findings are population-level trends from neuroimaging research
//   - Individual patients may not match population-level patterns
//   - Neuroimaging correlates ≠ causal mechanisms
//   - Intervention targets are inferred from research, not guaranteed pathways
//
//   Appropriate framing:
//   ✓ "Research suggests..." / "Commonly associated with..."
//   ✓ "Frequently observed in..." / "Circuit patterns often include..."
//   ✗ "This disorder IS this circuit" / "This drug targets this exact node"
//
// EVIDENCE LEVELS:
//   A = Meta-analysis / systematic review of RCTs
//   B = Individual RCT or large cohort study
//   C = Open-label trial, case series, or well-designed observational
//   D = Case reports, expert consensus, preclinical with strong translational signal
//
// LEGAL:
//   Informational reference for licensed providers only.
//   Not a diagnostic instrument. Not a treatment recommendation engine.
//   All interventions require clinical judgment and patient-specific evaluation.
//   Circuit associations reflect research literature, not individual patient neurology.
// ═══════════════════════════════════════════════════════════════════

var DSM_CIRCUIT_MAP = {

// ─────────────────────────────────────────────────
// DEPRESSIVE DISORDERS
// ─────────────────────────────────────────────────

'MDD': {
  name: 'Major Depressive Disorder',
  dsm5: '296.2x / 296.3x (F32.x / F33.x)',
  prevalence: '~8.4% US adults annually (NIMH 2021)',
  summary: 'DMN hyperconnectivity drives ruminative self-referential loops. Reward circuit hypofunction reduces motivation. HPA axis chronically elevated. Habenula hyperactive, encoding persistent disappointment signal.',
  criteria: {
    title: 'Diagnostic Criteria 296.2x (F32.x)',
    sections: [
      {id:'A', text:'Five (or more) of the following symptoms present during the same 2-week period, representing a change from previous functioning. At least one is (1) depressed mood or (2) loss of interest/pleasure.',
       items: [
         'Depressed mood most of the day, nearly every day',
         'Markedly diminished interest or pleasure in all, or almost all, activities',
         'Significant weight loss when not dieting or weight gain (>5% in a month), or change in appetite',
         'Insomnia or hypersomnia nearly every day',
         'Psychomotor agitation or retardation nearly every day (observable by others)',
         'Fatigue or loss of energy nearly every day',
         'Feelings of worthlessness or excessive/inappropriate guilt',
         'Diminished ability to think or concentrate, or indecisiveness',
         'Recurrent thoughts of death, recurrent suicidal ideation, or attempt'
       ]},
      {id:'B', text:'Symptoms cause clinically significant distress or impairment in social, occupational, or other important areas of functioning.'},
      {id:'C', text:'The episode is not attributable to the physiological effects of a substance or another medical condition.'},
    ],
    specifiers: ['With anxious distress','With mixed features','With melancholic features','With atypical features','With mood-congruent psychotic features','With mood-incongruent psychotic features','With catatonia','With peripartum onset','With seasonal pattern'],
    severity: ['Mild','Moderate','Severe','In partial remission','In full remission'],
    codingNote: 'Code depends on single (296.2x / F32.x) vs recurrent (296.3x / F33.x), severity, and presence of psychotic features.'
  },
  circuits: [
    {node:'mPFC',   dir:'hyper', detail:'Hyperactive self-referential processing → rumination loops', evidence:'A', cite:'Sheline et al. 2009 PNAS 106(6):1942-7'},
    {node:'PCC',    dir:'hyper', detail:'Locked coupling with mPFC. Failure to decouple for external task engagement', evidence:'A', cite:'Hamilton et al. 2015 Biol Psych 78(4):224-30'},
    {node:'CING',   dir:'altered', detail:'Cingulum bundle white matter integrity reduced → impaired DMN longitudinal connectivity', evidence:'B', cite:'Keedwell et al. 2012 J Affect Disord 138(1-2):139-48'},
    {node:'HAB',    dir:'hyper', detail:'Lateral habenula hyperactive → tonic suppression of VTA/raphe → anhedonia', evidence:'B', cite:'Lawson et al. 2017 Mol Psychiatry 22(10):1379-85'},
    {node:'VTA',    dir:'hypo', detail:'Dopaminergic drive reduced → motivational deficit, psychomotor retardation', evidence:'B', cite:'Dunlop & Nemeroff 2007 Arch Gen Psychiatry 64(3):327-37'},
    {node:'NAcc',   dir:'hypo', detail:'Reward signal blunted → anhedonia, loss of pleasure', evidence:'A', cite:'Pizzagalli et al. 2009 Am J Psychiatry 166(6):702-10'},
    {node:'RAPHE',  dir:'altered', detail:'Serotonergic tone dysregulated. Primary SSRI target.', evidence:'A', cite:'Savitz & Drevets 2009 Neurosci Biobehav Rev 33(7):920-36'},
    {node:'HPA',    dir:'hyper', detail:'Cortisol chronically elevated. Dexamethasone non-suppression.', evidence:'A', cite:'Pariante & Lightman 2008 J Neuroendocrinol 20(6):713-20'},
    {node:'HYPO',   dir:'hyper', detail:'CRH hypersecretion driving HPA hyperactivation', evidence:'A', cite:'Holsboer 2000 Neuropsychopharmacology 23(5):477-501'},
    {node:'HIPP',   dir:'hypo', detail:'Volume reduction 8-10% in recurrent MDD. Glucocorticoid neurotoxicity.', evidence:'A', cite:'Videbech & Ravnkilde 2004 Am J Psychiatry 161(11):1957-66'},
    {node:'dlPFC',  dir:'hypo', detail:'Executive control reduced → impaired cognitive flexibility, concentration', evidence:'A', cite:'Koenigs & Grafman 2009 Curr Opin Neurol 22(6):612-7'},
    {node:'dACC',   dir:'hyper', detail:'Error/conflict monitoring overactive. Treatment response biomarker (Mayberg).', evidence:'A', cite:'Mayberg et al. 1997 J Neuropsychiatry Clin Neurosci 9(3):471-81'},
    {node:'AI',     dir:'hyper', detail:'Interoceptive prediction errors amplified → somatic symptoms of depression', evidence:'B', cite:'Sliz & Hayley 2012 Neurosci Biobehav Rev 36(1):764-85'},
    {node:'DV',     dir:'hyper', detail:'Dorsal vagal dominance → fatigue, withdrawal, psychomotor slowing', evidence:'C', cite:'Porges 2011 Polyvagal Theory, Norton'},
    {node:'VV',     dir:'hypo', detail:'Ventral vagal withdrawal → reduced social engagement, flat affect', evidence:'B', cite:'Rottenberg 2007 Biol Psychol 74(2):200-11'},
    {node:'BDNF',   dir:'hypo', detail:'Serum BDNF reduced. Restored by antidepressants and exercise.', evidence:'A', cite:'Molendijk et al. 2014 Mol Psychiatry 19(7):791-800'},
  ],
  interventions: {
    pharma: [
      {name:'SSRIs', target:['RAPHE','mPFC','HAB'], mechanism:'Increase serotonin availability at postsynaptic receptors. Raphe → cortical projections.', evidence:'A', cite:'Cipriani et al. 2018 Lancet 391(10128):1357-66'},
      {name:'SNRIs', target:['RAPHE','LC','dlPFC'], mechanism:'Dual serotonin + norepinephrine reuptake inhibition. Broader monoamine effect.', evidence:'A', cite:'Cipriani et al. 2018 Lancet 391(10128):1357-66'},
      {name:'Ketamine / Esketamine', target:['HAB','NAcc','BDNF','mPFC'], mechanism:'NMDA antagonism → habenula silencing → rapid glutamate burst → BDNF/synaptogenesis', evidence:'A', cite:'Berman et al. 2000 Biol Psychiatry 47(4):351-4; FDA approved 2019'},
      {name:'Psilocybin', target:['DMN','mPFC','PCC','RAPHE'], mechanism:'5-HT2A agonism → acute DMN dissolution → post-session DMN reconfiguration with reduced hyperconnectivity', evidence:'B', cite:'Carhart-Harris et al. 2017 Sci Rep 7:13187; Davis et al. 2021 JAMA Psychiatry 78(5):481-9'},
      {name:'Bupropion', target:['VTA','NAcc','LC'], mechanism:'Dopamine-norepinephrine reuptake inhibition. Targets motivational deficit.', evidence:'A', cite:'Stahl et al. 2004 J Clin Psychiatry 65(12):1652-70'},
    
      {name:"Ketamine IV (0.5mg/kg)", target:["HAB","GABA_GLU","mPFC","NAcc"], mechanism:"NMDA antagonist → rapid glutamate surge → BDNF/synaptogenesis within hours. Habenula silencing. FDA breakthrough.", evidence:"A", cite:"Zarate et al. 2006 Arch Gen Psychiatry 63(8):856-64"},
      {name:"Esketamine (Spravato)", target:["HAB","GABA_GLU","mPFC"], mechanism:"FDA-approved intranasal NMDA antagonist for treatment-resistant depression", evidence:"A", cite:"Daly et al. 2018 JAMA Psychiatry 75(2):139-48"},
      {name:"Psilocybin-assisted therapy", target:["mPFC","PCC","DMN","5HT"], mechanism:"DMN dissolution → narrative identity reset. 5-HT2A agonism. Rapid antidepressant in RCTs.", evidence:"B", cite:"Carhart-Harris et al. 2021 N Engl J Med 384(15):1402-11"},
    ],
    therapy: [
      {name:'CBT', target:['dlPFC','mPFC','BLA'], mechanism:'Top-down cognitive restructuring. Strengthens dlPFC regulation over amygdala and ruminative DMN.', evidence:'A', cite:'DeRubeis et al. 2008 Nat Rev Neurosci 9(10):788-96'},
      {name:'Behavioral Activation', target:['VTA','NAcc','SMN'], mechanism:'Scheduled activity counteracts motivational circuit hypofunction. Re-engages reward system.', evidence:'A', cite:'Dimidjian et al. 2006 J Consult Clin Psychol 74(4):658-70'},
      {name:'MBCT (Mindfulness-Based CBT)', target:['mPFC','PCC','dACC'], mechanism:'Decentering from ruminative DMN content. Reduces mPFC-PCC hyperconnectivity.', evidence:'A', cite:'Segal et al. 2010; Kuyken et al. 2015 JAMA Psychiatry 72(11):1122-30'},
      {name:'ACT (Acceptance & Commitment)', target:['mPFC','PCC','AI'], mechanism:'Defusion from DMN-generated narrative. Acceptance of interoceptive signals.', evidence:'B', cite:'A-Tjak et al. 2015 Psychother Psychosom 84(1):30-6'},
    ],
    somatic: [
      {name:'Aerobic Exercise (150min/wk)', target:['BDNF','HIPP','VTA','HPA'], mechanism:'BDNF upregulation → hippocampal neurogenesis. HPA normalization. Dopamine release.', evidence:'A', cite:'Schuch et al. 2016 J Psychiatr Res 77:42-51; Cooney et al. 2013 Cochrane'},
      {name:'HRV Biofeedback', target:['VV','NTS','dACC','AI'], mechanism:'Vagal tone restoration → parasympathetic rebalancing → reduced interoceptive distress', evidence:'B', cite:'Caldwell & Steffen 2018 Appl Psychophysiol Biofeedback 43(3):243-51'},
      {name:'Cold Exposure', target:['LC','SNS','VV'], mechanism:'Norepinephrine surge + sympathetic activation → hormetic stress adaptation', evidence:'C', cite:'Shevchuk 2008 Med Hypotheses 70(5):995-1001'},
      {name:'rTMS (left dlPFC)', target:['dlPFC','dACC','mPFC'], mechanism:'Repetitive TMS excites hypoactive left dlPFC → downstream DMN normalization', evidence:'A', cite:'FDA cleared 2008; George et al. 2010 Arch Gen Psychiatry 67(5):507-16'},
    
      {name:"TBS (Theta Burst Stimulation)", target:["dlPFC","dACC","mPFC"], mechanism:"Accelerated TMS protocol — 3-min sessions vs 37-min standard rTMS. Non-inferior efficacy.", evidence:"A", cite:"Blumberger et al. 2018 Lancet 391(10131):1683-92"},
      {name:"Vagus Nerve Stimulation", target:["NTS","VV","LC","RAPHE"], mechanism:"Implanted or transcutaneous vagal stimulation → bottom-up modulation of NTS, LC, raphe", evidence:"B", cite:"Conway et al. 2018 Biol Psychiatry 83(8):705-11"},
      {name:"Whole-body hyperthermia", target:["RAPHE","VV","SNS"], mechanism:"Single session of 38.5°C core temp → serotonergic activation, sustained mood improvement", evidence:"B", cite:"Janssen et al. 2016 JAMA Psychiatry 73(8):789-92"},
    ],
    nutrition: [
      {name:'Omega-3 Fatty Acids (EPA>DHA)', target:['BDNF','mPFC','AI'], mechanism:'Anti-inflammatory, membrane fluidity, BDNF support. EPA component most antidepressant.', evidence:'A', cite:'Liao et al. 2019 Transl Psychiatry 9(1):190'},
      {name:'Vitamin D (2000-5000 IU/day)', target:['RAPHE','HPA'], mechanism:'Cofactor in serotonin synthesis. Deficiency associated with depression.', evidence:'B', cite:'Anglin et al. 2013 Br J Psychiatry 202(2):100-7'},
      {name:'Magnesium (glycinate/threonate)', target:['GABA_GLU','HPA','THETA'], mechanism:'NMDA modulation, GABAergic support, HPA axis calming. Threonate crosses BBB.', evidence:'B', cite:'Tarleton et al. 2017 PLoS One 12(6):e0180067'},
      {name:'Probiotics (Lactobacillus/Bifido)', target:['GBA','ENS','VV'], mechanism:'Gut-brain axis modulation via vagal afferents. Reduces inflammatory cytokines.', evidence:'B', cite:'Nikolova et al. 2019 JAMA Psychiatry 76(12):1291-2'},
      {name:'Creatine (3-5g/day)', target:['dlPFC','mPFC'], mechanism:'Prefrontal phosphocreatine energy buffer. Augments SSRI response.', evidence:'B', cite:'Kious et al. 2019 J Clin Psychiatry 80(6):18r12538'},
      {name:'SAMe (800-1600mg/day)', target:['RAPHE','mPFC'], mechanism:'Methyl donor for monoamine synthesis. Augmentation strategy.', evidence:'B', cite:'Papakostas et al. 2010 Am J Psychiatry 167(8):942-8'},
    
      {name:"Psychobiotics (L. rhamnosus, B. longum)", target:["GBA","ENS","VV","RAPHE"], mechanism:"Specific strains reduce cortisol, increase GABA signaling via vagal afferents", evidence:"B", cite:"Wallace & Milev 2017 Ann Gen Psychiatry 16:14"},
      {name:"Creatine monohydrate (5g/day)", target:["dlPFC","mPFC"], mechanism:"Enhances prefrontal phosphocreatine energy reserves. Augments SSRI response.", evidence:"B", cite:"Kious et al. 2019 J Clin Psychiatry 80(6):18r12538"},
    ],
    supplements: [
      {name:'NAC (N-Acetylcysteine 1200-2400mg)', target:['GABA_GLU','NAcc','mPFC'], mechanism:'Glutamate modulation via cystine-glutamate antiporter. Reduces oxidative stress.', evidence:'B', cite:'Berk et al. 2014 BMC Med 12:74'},
      {name:'L-Methylfolate (15mg)', target:['RAPHE','VTA'], mechanism:'BH4 cofactor for monoamine synthesis. Augments antidepressants in MTHFR variants.', evidence:'A', cite:'Papakostas et al. 2012 Am J Psychiatry 169(12):1267-74'},
      {name:'Curcumin (500-1000mg)', target:['BDNF','HPA','AI'], mechanism:'Anti-inflammatory, BDNF elevation, HPA modulation. Bioavailability-enhanced forms required.', evidence:'B', cite:'Lopresti et al. 2014 J Affect Disord 167:368-75'},
    ]
  },
  metabolic: [
    {factor:'Thyroid dysfunction', relevance:'Hypothyroidism mimics and perpetuates depressive circuits — 25% of treatment-resistant depression has subclinical thyroid pathology. T3 augments serotonergic transmission in raphe nuclei.', screen:'TSH, free T4, free T3; TPO antibodies if TSH borderline'},
    {factor:'Insulin resistance', relevance:'Hyperinsulinemia reduces dopamine signaling in reward circuits (VTA\u2192NAcc) and impairs BDNF-dependent hippocampal neuroplasticity. Bidirectional relationship with HPA axis dysregulation.', screen:'Fasting glucose, HbA1c, fasting insulin; HOMA-IR calculation'},
    {factor:'Inflammatory cytokines', relevance:'Elevated IL-6, TNF-\u03b1, and CRP activate IDO pathway, shunting tryptophan away from serotonin synthesis toward kynurenine (neurotoxic). Drives sickness behavior phenotype overlapping with MDD.', screen:'hs-CRP, ESR; consider IL-6 if treatment-resistant'},
    {factor:'Vitamin D deficiency', relevance:'Vitamin D receptors present in raphe nuclei and hippocampus. Deficiency impairs serotonin synthesis (cofactor for tryptophan hydroxylase 2) and BDNF expression.', screen:'25-OH vitamin D level; target >40 ng/mL'}
  ]
},

// ─────────────────────────────────────────────────
// ANXIETY DISORDERS
// ─────────────────────────────────────────────────

'GAD': {
  name: 'Generalized Anxiety Disorder',
  dsm5: '300.02 (F41.1)',
  prevalence: '~3.1% US adults annually (NIMH)',
  summary: 'Chronic worry driven by BNST sustained threat signaling, salience network hypervigilance, and ventral vagal withdrawal. Amygdala-PFC regulatory circuit impaired.',
  criteria: {
    title: 'Diagnostic Criteria 300.02 (F41.1)',
    sections: [
      {id:'A', text:'Excessive anxiety and worry (apprehensive expectation), occurring more days than not for at least 6 months, about a number of events or activities (such as work or school performance).'},
      {id:'B', text:'The individual finds it difficult to control the worry.'},
      {id:'C', text:'The anxiety and worry are associated with three (or more) of the following six symptoms (with at least some symptoms having been present for more days than not for the past 6 months). Note: Only one item is required in children.',
       items: [
         'Restlessness or feeling keyed up or on edge',
         'Being easily fatigued',
         'Difficulty concentrating or mind going blank',
         'Irritability',
         'Muscle tension',
         'Sleep disturbance (difficulty falling or staying asleep, or restless, unsatisfying sleep)'
       ]},
      {id:'D', text:'The anxiety, worry, or physical symptoms cause clinically significant distress or impairment in social, occupational, or other important areas of functioning.'},
      {id:'E', text:'The disturbance is not attributable to the physiological effects of a substance (e.g., a drug of abuse, a medication) or another medical condition (e.g., hyperthyroidism).'},
      {id:'F', text:'The disturbance is not better explained by another mental disorder (e.g., anxiety or worry about having panic attacks in panic disorder, negative evaluation in social anxiety disorder, contamination or other obsessions in OCD, separation from attachment figures in separation anxiety disorder, reminders of traumatic events in PTSD, gaining weight in anorexia nervosa, physical complaints in somatic symptom disorder, perceived appearance flaws in body dysmorphic disorder, having a serious illness in illness anxiety disorder, or the content of delusional beliefs in schizophrenia or delusional disorder).'}
    ],
    specifiers: [],
    severity: [],
    codingNote: ''
  },
  circuits: [
    {node:'BNST',   dir:'hyper', detail:'Sustained anxiety generator. Unlike amygdala (acute fear), BNST maintains diffuse worry state.', evidence:'A', cite:'Avery et al. 2016 J Neurosci 36(29):7614-21'},
    {node:'BLA',    dir:'hyper', detail:'Threat detection sensitivity elevated. Lower threshold for fear response.', evidence:'A', cite:'Etkin & Wager 2007 Am J Psychiatry 164(10):1476-88'},
    {node:'AI',     dir:'hyper', detail:'Interoceptive prediction amplified → body sensations misread as threat', evidence:'A', cite:'Paulus & Stein 2006 Biol Psychiatry 60(4):383-7'},
    {node:'dACC',   dir:'hyper', detail:'Conflict/error monitoring in overdrive. Scanning for problems.', evidence:'A', cite:'Etkin et al. 2009 Biol Psychiatry 65(2):93-7'},
    {node:'vmPFC',  dir:'hypo', detail:'Failed top-down regulation of amygdala/BNST', evidence:'A', cite:'Etkin et al. 2009 Biol Psychiatry 65(2):93-7'},
    {node:'mPFC',   dir:'hyper', detail:'Worry as DMN self-referential future simulation in threat mode', evidence:'B', cite:'Paulesu et al. 2010 Psychol Med 40(1):117-26'},
    {node:'HPA',    dir:'hyper', detail:'Cortisol variability increased. Not always elevated baseline, but dysregulated recovery.', evidence:'A', cite:'Hoehn-Saric et al. 2004 Psychiatry Res 128(3):281-90'},
    {node:'VV',     dir:'hypo', detail:'Vagal tone reduced → poor physiological self-regulation', evidence:'A', cite:'Thayer et al. 2012 Neurosci Biobehav Rev 36(2):747-56'},
    {node:'LC',     dir:'hyper', detail:'Tonic norepinephrine mode → diffuse vigilance instead of focused attention', evidence:'B', cite:'Goddard et al. 2010 J Psychiatr Res 44(15):1043-9'},
    {node:'SNS',    dir:'hyper', detail:'Sympathetic dominance → muscle tension, GI distress, sleep disruption', evidence:'A', cite:'Hoehn-Saric & McLeod 2000 J Nerv Ment Dis 188(8):496-504'},
  ],
  interventions: {
    pharma: [
      {name:'SSRIs/SNRIs', target:['RAPHE','BLA','BNST'], mechanism:'First-line. Serotonergic modulation of amygdala/BNST threat circuits.', evidence:'A', cite:'Bandelow et al. 2015 World J Biol Psychiatry 16(5):300-7'},
      {name:'Buspirone', target:['RAPHE','mPFC'], mechanism:'5-HT1A partial agonist. Anxiolytic without sedation or dependence.', evidence:'A', cite:'Chessick et al. 2006 Cochrane Database Syst Rev'},
      {name:'Pregabalin', target:['GABA_GLU','BLA','AI'], mechanism:'Calcium channel α2δ subunit → reduces glutamate release in amygdala/insula', evidence:'A', cite:'Feltner et al. 2003 J Clin Psychopharmacol 23(3):240-9'},
      {name:'Hydroxyzine', target:['LC','SNS'], mechanism:'H1 antihistamine. Reduces autonomic hyperarousal. PRN option.', evidence:'A', cite:'Guaiana et al. 2010 Cochrane Database Syst Rev'},
    
      {name:"Pregabalin", target:["BLA","GABA_GLU","BNST"], mechanism:"Alpha-2-delta ligand reduces glutamatergic hyperexcitability in amygdala/BNST circuits", evidence:"A", cite:"Feltner et al. 2003 J Clin Psychopharmacol 23(3):240-9"},
    ],
    therapy: [
      {name:'CBT (worry exposure + cognitive restructuring)', target:['dlPFC','vmPFC','BLA','BNST'], mechanism:'Strengthens PFC regulation. Worry exposure habituates BNST response.', evidence:'A', cite:'Cuijpers et al. 2014 Clin Psychol Rev 34(2):130-40'},
      {name:'ACT', target:['mPFC','AI','PCC'], mechanism:'Defusion from worry content. Acceptance of anxious interoception.', evidence:'B', cite:'Roemer et al. 2008 J Consult Clin Psychol 76(6):1083-9'},
      {name:'Applied Relaxation', target:['VV','SNS','NTS'], mechanism:'Progressive autonomic downregulation. Parasympathetic restoration.', evidence:'A', cite:'Borkovec & Costello 1993 J Consult Clin Psychol 61(4):611-9'},
    ],
    somatic: [
      {name:'HRV Biofeedback', target:['VV','NTS','AI','dACC'], mechanism:'Vagal tone training → restores autonomic balance', evidence:'A', cite:'Goessl et al. 2017 Appl Psychophysiol Biofeedback 42(3):235-46'},
      {name:'Yoga (emphasis on pranayama)', target:['VV','GABA_GLU','HPA'], mechanism:'Vagal stimulation via breath, GABA increase, HPA normalization', evidence:'A', cite:'Cramer et al. 2018 J Evid Based Med 11(1):21-9'},
      {name:'Aerobic Exercise', target:['BDNF','HIPP','HPA','VTA'], mechanism:'Anxiolytic via BDNF, endorphins, HPA normalization', evidence:'A', cite:'Aylett et al. 2018 BMC Health Serv Res 18(1):559'},
    
      {name:"Transcutaneous Vagus Nerve Stimulation (tVNS)", target:["NTS","VV","LC"], mechanism:"Non-invasive auricular vagal stimulation reduces sympathetic tone and anxiety", evidence:"B", cite:"Bretherton et al. 2019 Aging 11(14):4836-57"},
    ],
    nutrition: [
      {name:'Magnesium (glycinate)', target:['GABA_GLU','HPA'], mechanism:'GABAergic support, HPA calming, NMDA modulation', evidence:'B', cite:'Boyle et al. 2017 Nutrients 9(5):429'},
      {name:'L-Theanine (200-400mg)', target:['GABA_GLU','THETA','AI'], mechanism:'Increases GABA, promotes alpha oscillations, reduces anticipatory anxiety', evidence:'B', cite:'Hidese et al. 2019 Nutrients 11(10):2362'},
      {name:'Chamomile Extract (500-1500mg)', target:['BLA','GABA_GLU'], mechanism:'Apigenin binds GABA-A benzodiazepine site. Mild anxiolytic.', evidence:'B', cite:'Mao et al. 2016 Phytomedicine 23(14):1735-42'},
    
      {name:"L-Theanine (200-400mg)", target:["GABA_GLU","THETA","dACC"], mechanism:"Increases GABA, modulates alpha oscillations, reduces ACC hyperactivation", evidence:"B", cite:"Hidese et al. 2019 Nutrients 11(10):2362"},
      {name:"Kava extract (standardized kavalactones)", target:["GABA_GLU","BLA"], mechanism:"GABA-A modulation, amygdala anxiolysis. Non-addictive. Cochrane-reviewed.", evidence:"A", cite:"Pittler & Ernst 2003 Cochrane; Sarris et al. 2013 J Clin Psychopharmacol 33(5):643-8"},
    ],
    supplements: [
      {name:'Ashwagandha (300-600mg KSM-66)', target:['HPA','HYPO','LC'], mechanism:'Cortisol reduction, HPA normalization, GABAergic activity', evidence:'B', cite:'Lopresti et al. 2019 Medicine 98(37):e17186'},
      {name:'Lavender Oil (Silexan 80mg)', target:['BLA','SNS'], mechanism:'Calcium channel modulation in amygdala. Reduces sympathetic activation.', evidence:'A', cite:'Kasper et al. 2014 Int J Neuropsychopharmacol 17(6):859-69'},
    ]
  },
  metabolic: [
    {factor:'Hyperthyroidism mimicry', relevance:'Thyroid hormone excess directly activates sympathetic nervous system and locus coeruleus \u2014 produces anxiety phenotype indistinguishable from GAD. Must rule out before anxiety diagnosis.', screen:'TSH, free T4; thyroid antibodies if autoimmune suspected'},
    {factor:'Hypoglycemia-induced anxiety', relevance:'Reactive hypoglycemia triggers counter-regulatory catecholamine surge via locus coeruleus and sympathetic nervous system \u2014 produces anxiety, tremor, tachycardia identical to GAD symptoms.', screen:'Fasting glucose, HbA1c; consider 2-hour postprandial glucose if symptoms are post-meal'},
    {factor:'Adrenal dysregulation', relevance:'Chronic cortisol elevation from HPA axis hyperactivation sensitizes amygdala and BNST threat circuits, reduces prefrontal inhibitory control, and impairs vagal tone recovery.', screen:'Morning cortisol, DHEA-S; consider 4-point salivary cortisol if adrenal dysregulation suspected'}
  ]
},

'PTSD': {
  name: 'Post-Traumatic Stress Disorder',
  dsm5: '309.81 (F43.10)',
  prevalence: '~3.6% US adults annually (NIMH). ~11-20% of veterans.',
  summary: 'Amygdala-driven intrusion with failed prefrontal extinction. Hippocampal contextualization impaired — memories remain decontextualized threat signals. DMN hyperconnected with amygdala producing ruminative re-experiencing.',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Threat memories over-consolidated. Fear conditioning resistant to extinction.', evidence:'A', cite:'Shin et al. 2006 Neuropsychopharmacology 31(2):231-40'},
    {node:'CeA',    dir:'hyper', detail:'Fear output amplified → exaggerated startle, hypervigilance', evidence:'A', cite:'Rauch et al. 2006 Biol Psychiatry 60(2):113-23'},
    {node:'vmPFC',  dir:'hypo', detail:'Failed fear extinction. Cannot signal "safe." Recall of extinction memory impaired.', evidence:'A', cite:'Milad et al. 2009 Biol Psychiatry 66(12):1075-82'},
    {node:'HIPP',   dir:'hypo', detail:'Volume reduced. Contextual memory impaired → trauma memories lack temporal/spatial tagging → intrusions feel "now"', evidence:'A', cite:'Smith 2005 Am J Psychiatry 162(12):2291-2; Karl et al. 2006'},
    {node:'mPFC',   dir:'hyper', detail:'DMN-amygdala hypercoupling → ruminative traumatic self-referential processing', evidence:'A', cite:'Lanius et al. 2010 Acta Psychiatr Scand 121(1):33-40'},
    {node:'PAG',    dir:'hyper', detail:'Defensive response circuits activated → freeze/dissociative responses', evidence:'B', cite:'Mobbs et al. 2007 Science 317(5841):1079-83'},
    {node:'AI',     dir:'hyper', detail:'Interoceptive hyperawareness → somatic flashbacks, body remembers', evidence:'A', cite:'Simmons et al. 2009 Psychol Med 39(3):523-31'},
    {node:'dACC',   dir:'altered', detail:'Hypoactive during trauma recall (failed error signal) but hyperactive during vigilance', evidence:'A', cite:'Shin et al. 2001 Arch Gen Psychiatry 58(5):485-92'},
    {node:'LC',     dir:'hyper', detail:'Norepinephrine system hyperactive → hyperarousal, insomnia, exaggerated startle', evidence:'A', cite:'Geracioti et al. 2001 Am J Psychiatry 158(8):1227-30'},
    {node:'HPA',    dir:'altered', detail:'Paradoxically low cortisol with enhanced negative feedback. GR hypersensitivity.', evidence:'A', cite:'Yehuda 2009 Ann NY Acad Sci 1179:56-69'},
    {node:'ENDO',   dir:'hypo', detail:'Endocannabinoid deficiency → impaired fear extinction, hyperarousal', evidence:'B', cite:'Neumeister et al. 2013 Mol Psychiatry 18(9):1034-40'},
    {node:'DV',     dir:'hyper', detail:'Dorsal vagal activation during dissociative subtype → numbing, freeze', evidence:'B', cite:'Porges 2011; Lanius et al. 2010'},
    {node:'BNST',   dir:'hyper', detail:'Sustained threat anticipation between triggers', evidence:'B', cite:'Brinkmann et al. 2017 Psychoneuroendocrinology 77:68-75'},
  ],
  criteria: {
    title: 'Diagnostic Criteria 309.81 (F43.10)',
    sections: [
      {id:'A', text:'Exposure to actual or threatened death, serious injury, or sexual violence in one (or more) of the following ways:', items:['1. Directly experiencing the traumatic event(s).','2. Witnessing, in person, the event(s) as it occurred to others.','3. Learning that the traumatic event(s) occurred to a close family member or close friend. In cases of actual or threatened death, the event(s) must have been violent or accidental.','4. Experiencing repeated or extreme exposure to aversive details of the traumatic event(s) (e.g., first responders collecting human remains; police officers repeatedly exposed to details of child abuse). Note: Does not apply to exposure through electronic media, television, movies, or pictures, unless this exposure is work-related.']},
      {id:'B', text:'Presence of one (or more) of the following intrusion symptoms associated with the traumatic event(s), beginning after the traumatic event(s) occurred:', items:['1. Recurrent, involuntary, and intrusive distressing memories of the traumatic event(s).','2. Recurrent distressing dreams in which the content and/or affect of the dream are related to the traumatic event(s).','3. Dissociative reactions (e.g., flashbacks) in which the individual feels or acts as if the traumatic event(s) were recurring.','4. Intense or prolonged psychological distress at exposure to internal or external cues that symbolize or resemble an aspect of the traumatic event(s).','5. Marked physiological reactions to internal or external cues that symbolize or resemble an aspect of the traumatic event(s).']},
      {id:'C', text:'Persistent avoidance of stimuli associated with the traumatic event(s), beginning after the traumatic event(s) occurred, as evidenced by one or both of the following:', items:['1. Avoidance of or efforts to avoid distressing memories, thoughts, or feelings about or closely associated with the traumatic event(s).','2. Avoidance of or efforts to avoid external reminders (people, places, conversations, activities, objects, situations) that arouse distressing memories, thoughts, or feelings about or closely associated with the traumatic event(s).']},
      {id:'D', text:'Negative alterations in cognitions and mood associated with the traumatic event(s), beginning or worsening after the traumatic event(s) occurred, as evidenced by two (or more) of the following:', items:['1. Inability to remember an important aspect of the traumatic event(s) (typically due to dissociative amnesia).','2. Persistent and exaggerated negative beliefs or expectations about oneself, others, or the world.','3. Persistent, distorted cognitions about the cause or consequences of the traumatic event(s) that lead the individual to blame himself/herself or others.','4. Persistent negative emotional state (e.g., fear, horror, anger, guilt, or shame).','5. Markedly diminished interest or participation in significant activities.','6. Feelings of detachment or estrangement from others.','7. Persistent inability to experience positive emotions.']},
      {id:'E', text:'Marked alterations in arousal and reactivity associated with the traumatic event(s), beginning or worsening after the traumatic event(s) occurred, as evidenced by two (or more) of the following:', items:['1. Irritable behavior and angry outbursts (with little or no provocation) typically expressed as verbal or physical aggression toward people or objects.','2. Reckless or self-destructive behavior.','3. Hypervigilance.','4. Exaggerated startle response.','5. Problems with concentration.','6. Sleep disturbance.']},
      {id:'F', text:'Duration of the disturbance (Criteria B, C, D, and E) is more than 1 month.'},
      {id:'G', text:'The disturbance causes clinically significant distress or impairment in social, occupational, or other important areas of functioning.'},
      {id:'H', text:'The disturbance is not attributable to the physiological effects of a substance (e.g., medication, alcohol) or another medical condition.'},
    ],
    specifiers: ['With dissociative symptoms (depersonalization or derealization)','With delayed expression (full criteria not met until at least 6 months after the event)'],
    severity: [],
    codingNote: 'Specify if with dissociative symptoms. Specify if with delayed expression.'
  },
  interventions: {
    pharma: [
      {name:'Prazosin (nighttime)', target:['LC','SNS'], mechanism:'Alpha-1 blocker. Reduces noradrenergic hyperarousal → decreases nightmares.', evidence:'B', cite:'Raskind et al. 2013 Am J Psychiatry 170(9):1003-10'},
      {name:'SSRIs (sertraline/paroxetine)', target:['RAPHE','BLA','vmPFC'], mechanism:'Serotonergic modulation of fear circuits. FDA-approved for PTSD.', evidence:'A', cite:'Hoskins et al. 2015 Psychol Med 45(12):2463-80'},
      {name:'Propranolol (reconsolidation window)', target:['BLA','LC'], mechanism:'Beta-blocker administered during trauma recall disrupts reconsolidation of fear memory', evidence:'B', cite:'Brunet et al. 2018 Am J Psychiatry 175(5):427-33'},
      {name:'MDMA-assisted therapy', target:['BLA','vmPFC','OXY','VV'], mechanism:'Reduces amygdala fear, enhances vmPFC regulation, oxytocin release → enables trauma processing', evidence:'B', cite:'Mitchell et al. 2021 Nat Med 27(6):1025-33; FDA breakthrough designation'},
      {name:'Psilocybin', target:['DMN','mPFC','PCC','BLA'], mechanism:'DMN dissolution allows reconsolidation of trauma narratives without re-traumatization', evidence:'C', cite:'Davis et al. 2023 pilot studies; active clinical trials'},
    ],
    therapy: [
      {name:'EMDR', target:['BLA','HIPP','vmPFC'], mechanism:'Bilateral stimulation during trauma recall → reconsolidation with reduced emotional charge + hippocampal re-contextualization', evidence:'A', cite:'Cusack et al. 2016 Clin Psychol Rev 43:128-41'},
      {name:'CPT (Cognitive Processing Therapy)', target:['mPFC','dlPFC','vmPFC'], mechanism:'Restructures trauma-related DMN narratives ("stuck points"). Restores prefrontal regulation.', evidence:'A', cite:'Resick et al. 2017 JAMA Psychiatry 74(6):554-6'},
      {name:'PE (Prolonged Exposure)', target:['BLA','vmPFC','PAG'], mechanism:'Systematic habituation of fear response. Strengthens extinction memory.', evidence:'A', cite:'Powers et al. 2010 J Clin Psychiatry 71(12):1635-41'},
      {name:'Somatic Experiencing', target:['PAG','AI','DV','VV'], mechanism:'Bottom-up processing of freeze/dissociative patterns stored in defensive circuits', evidence:'C', cite:'Payne et al. 2015 Front Psychol 6:93'},
      {name:'IFS (Internal Family Systems)', target:['mPFC','BLA','vmPFC','PAG'], mechanism:'Parts-based approach to fragmented DMN self-states. Accesses exiled trauma without overwhelming', evidence:'C', cite:'Schwartz 2021; pilot RCTs underway'},
    ],
    somatic: [
      {name:'Stellate Ganglion Block', target:['SNS','LC','BLA'], mechanism:'Local anesthetic injection at C6 sympathetic ganglion → rapid sympathetic reset', evidence:'B', cite:'Rae Olmsted et al. 2020 Psychiatr Res 293:113443'},
      {name:'Yoga (trauma-sensitive)', target:['VV','AI','S1','PAG'], mechanism:'Interoceptive reconditioning. Restores body ownership. Vagal tone improvement.', evidence:'B', cite:'van der Kolk et al. 2014 J Clin Psychiatry 75(6):e559-65'},
      {name:'Neurofeedback (alpha-theta)', target:['mPFC','PCC','THETA'], mechanism:'Normalizes DMN oscillatory patterns. Reduces hyperarousal.', evidence:'B', cite:'van der Kolk et al. 2016 PLoS One 11(12):e0166752'},
      {name:'Float Tank (REST)', target:['DMN','AI','SNS','VV'], mechanism:'Sensory reduction → DMN reset + parasympathetic restoration + interoceptive recalibration', evidence:'C', cite:'Feinstein et al. 2018 PLoS One 13(2):e0190292'},
    ],
    nutrition: [
      {name:'Omega-3 (EPA-dominant)', target:['BDNF','AI','BLA'], mechanism:'Anti-inflammatory, amygdala modulation, BDNF support', evidence:'B', cite:'Matsuoka et al. 2010 J Clin Psychopharmacol 30(2):217-9'},
      {name:'NAC (1200-2400mg)', target:['GABA_GLU','NAcc','BLA'], mechanism:'Glutamate modulation → reduces hyperexcitability in fear circuits', evidence:'C', cite:'Back et al. 2016 J Clin Psychiatry 77(11):e1439-46'},
      {name:'Magnesium threonate', target:['GABA_GLU','BLA','HIPP'], mechanism:'Crosses BBB. Enhances prefrontal-amygdala regulation. Supports extinction.', evidence:'C', cite:'Abumaria et al. 2011 Neuron 72(5):761-74'},
    ],
    supplements: [
      {name:'CBD (25-50mg)', target:['ENDO','BLA','vmPFC'], mechanism:'Endocannabinoid system modulation → enhances fear extinction, reduces reconsolidation', evidence:'B', cite:'Bitencourt & Takahashi 2018 Front Neurosci 12:502'},
      {name:'Phosphatidylserine (300mg)', target:['HPA','HYPO'], mechanism:'Cortisol blunting, HPA normalization', evidence:'B', cite:'Hellhammer et al. 2014 Nutr Res 34(1):33-9'},
    ]
  },
  metabolic: [
    {factor:'HPA axis dysregulation', relevance:'Paradoxical cortisol pattern \u2014 low baseline cortisol with exaggerated reactivity. Impaired negative feedback at hippocampal glucocorticoid receptors perpetuates threat circuit sensitization.', screen:'Morning cortisol, DHEA-S; consider dexamethasone suppression test'},
    {factor:'Cortisol blunting', relevance:'Flattened diurnal cortisol curve reduces anti-inflammatory buffering, allowing chronic low-grade inflammation to drive neuroinflammation and hippocampal volume loss.', screen:'4-point salivary cortisol (AM, noon, afternoon, PM); cortisol awakening response'},
    {factor:'Metabolic syndrome comorbidity', relevance:'PTSD confers 2x risk of metabolic syndrome via chronic sympathetic activation, cortisol dysregulation, and inflammation. Insulin resistance further impairs hippocampal-dependent memory processing.', screen:'Fasting glucose, HbA1c, lipid panel, waist circumference, blood pressure'}
  ]
},

// ─────────────────────────────────────────────────
// NEURODEVELOPMENTAL DISORDERS
// ─────────────────────────────────────────────────

'ADHD': {
  name: 'Attention-Deficit/Hyperactivity Disorder',
  dsm5: '314.0x (F90.x)',
  prevalence: '~4.4% US adults, ~9.8% children (NIMH/CDC)',
  summary: 'DMN fails to suppress during task engagement — intrudes on executive/attention networks. Striatal dopamine signaling hypoactive. Salience network switching impaired. The brain cannot efficiently toggle between internal (DMN) and external (task-positive) modes.',
  circuits: [
    {node:'DMN',    dir:'hyper', detail:'Fails to decouple during tasks. DMN-task network anti-correlation absent or reversed.', evidence:'A', cite:'Sonuga-Barke & Castellanos 2007 Neurosci Biobehav Rev 31(7):977-86'},
    {node:'mPFC',   dir:'hyper', detail:'Self-referential processing intrudes during external attention demands', evidence:'A', cite:'Castellanos et al. 2008 Biol Psychiatry 63(3):332-7'},
    {node:'PCC',    dir:'hyper', detail:'Mind-wandering hub active when it should be quiet', evidence:'A', cite:'Whitfield-Gabrieli et al. 2009 PNAS 106(4):1279-84'},
    {node:'SN',     dir:'hypo', detail:'Salience network switching impaired → cannot efficiently toggle DMN↔TPN', evidence:'A', cite:'Menon & Uddin 2010 Brain Struct Funct 214(5-6):655-67'},
    {node:'AI',     dir:'hypo', detail:'Anterior insula switching deficit → misses relevance signals', evidence:'B', cite:'Uddin et al. 2017 Biol Psychiatry 82(8):558-67'},
    {node:'STRI',   dir:'hypo', detail:'Striatal dopamine signaling reduced → reward delay aversion, motivation deficit', evidence:'A', cite:'Volkow et al. 2009 JAMA 302(10):1084-91'},
    {node:'CAUD',   dir:'hypo', detail:'Caudate volume reduced in children. Cognitive loop underperformance.', evidence:'A', cite:'Castellanos et al. 2002 JAMA 288(14):1740-48'},
    {node:'dlPFC',  dir:'hypo', detail:'Executive function capacity reduced. Working memory, planning impaired.', evidence:'A', cite:'Bush 2010 Ann NY Acad Sci 1191:69-81'},
    {node:'FEF',    dir:'hypo', detail:'Voluntary attention direction impaired', evidence:'B', cite:'Castellanos & Proal 2012 Biol Psychiatry 72(2):75-6'},
    {node:'CBLM',   dir:'altered', detail:'Cerebellar volume/function reduced → timing deficits, coordination issues', evidence:'A', cite:'Valera et al. 2007 Am J Psychiatry 164(6):942-8'},
    {node:'dACC',   dir:'hypo', detail:'Error monitoring reduced → does not register mistakes, impulsivity', evidence:'A', cite:'Bush et al. 1999 Biol Psychiatry 45(12):1542-52'},
    {node:'NAcc',   dir:'hypo', detail:'Reward prediction blunted → delay aversion, novelty-seeking as compensation', evidence:'A', cite:'Scheres et al. 2007 Biol Psychiatry 61(5):720-4'},
  ],
  criteria: {
    title: "Diagnostic Criteria 314.0x (F90.x)",
    sections: [
      {id:"A", text:"A persistent pattern of inattention and/or hyperactivity-impulsivity that interferes with functioning or development, as characterized by (1) and/or (2):", items:["1. Inattention: Six (or more) of the following symptoms have persisted for at least 6 months to a degree that is inconsistent with developmental level and that negatively impacts directly on social and academic/occupational activities: (a) Often fails to give close attention to details or makes careless mistakes. (b) Often has difficulty sustaining attention in tasks or play activities. (c) Often does not seem to listen when spoken to directly. (d) Often does not follow through on instructions and fails to finish schoolwork, chores, or duties. (e) Often has difficulty organizing tasks and activities. (f) Often avoids, dislikes, or is reluctant to engage in tasks that require sustained mental effort. (g) Often loses things necessary for tasks or activities. (h) Is often easily distracted by extraneous stimuli. (i) Is often forgetful in daily activities.","2. Hyperactivity and Impulsivity: Six (or more) of the following symptoms have persisted for at least 6 months: (a) Often fidgets with or taps hands or feet or squirms in seat. (b) Often leaves seat in situations when remaining seated is expected. (c) Often runs about or climbs in situations where it is inappropriate. (d) Often unable to play or engage in leisure activities quietly. (e) Is often \"on the go,\" acting as if \"driven by a motor.\" (f) Often talks excessively. (g) Often blurts out an answer before a question has been completed. (h) Often has difficulty waiting his or her turn. (i) Often interrupts or intrudes on others."]},
      {id:"B", text:"Several inattentive or hyperactive-impulsive symptoms were present prior to age 12 years."},
      {id:"C", text:"Several inattentive or hyperactive-impulsive symptoms are present in two or more settings."},
      {id:"D", text:"There is clear evidence that the symptoms interfere with, or reduce the quality of, social, academic, or occupational functioning."},
      {id:"E", text:"The symptoms do not occur exclusively during the course of schizophrenia or another psychotic disorder and are not better explained by another mental disorder."}
    ],
    specifiers: ["Combined presentation (314.01)","Predominantly inattentive presentation (314.00)","Predominantly hyperactive/impulsive presentation (314.01)"],
    severity: ["Mild","Moderate","Severe"],
    codingNote: "For adults and adolescents age 17 and older, at least 5 symptoms are required for each domain."
  },
    interventions: {
    pharma: [
      {name:'Methylphenidate', target:['STRI','CAUD','dlPFC','dACC'], mechanism:'Dopamine + norepinephrine reuptake inhibition in striatum and PFC. Normalizes DMN-TPN switching.', evidence:'A', cite:'Volkow et al. 2001 Am J Psychiatry 158(4):587-94'},
      {name:'Amphetamine salts', target:['STRI','VTA','dlPFC','NAcc'], mechanism:'Dopamine release + reuptake inhibition. Broader monoamine effect than MPH.', evidence:'A', cite:'Faraone 2018 Expert Opin Pharmacother 19(15):1735-46'},
      {name:'Atomoxetine', target:['LC','dlPFC','mPFC'], mechanism:'Selective NE reuptake inhibitor. Prefrontal norepinephrine enhancement.', evidence:'A', cite:'Michelson et al. 2003 Am J Psychiatry 160(11):1981-6'},
      {name:'Guanfacine XR', target:['dlPFC','LC','dACC'], mechanism:'Alpha-2A agonist. Strengthens PFC networks directly. Reduces LC tonic firing.', evidence:'A', cite:'Arnsten 2010 Am J Psychiatry 167(7):748-51'},
    
      {name:"Guanfacine ER", target:["dlPFC","dACC","LC"], mechanism:"Alpha-2A agonist strengthens PFC network connectivity. Non-stimulant.", evidence:"A", cite:"Sallee et al. 2009 J Am Acad Child Adolesc Psychiatry 48(2):155-65"},
    ],
    therapy: [
      {name:'CBT for ADHD', target:['dlPFC','mPFC','dACC'], mechanism:'Compensatory strategies + executive function scaffolding. Organizational skills.', evidence:'A', cite:'Safren et al. 2010 JAMA 304(8):875-80'},
      {name:'Mindfulness training', target:['DMN','mPFC','PCC','AI'], mechanism:'Trains DMN awareness and deactivation on demand. Improves attentional switching.', evidence:'B', cite:'Mitchell et al. 2015 J Atten Disord 19(7):571-9'},
    ],
    somatic: [
      {name:'Aerobic Exercise', target:['STRI','BDNF','dlPFC','dACC'], mechanism:'Acute dopamine release + BDNF → improved executive function. Effect comparable to low-dose stimulant.', evidence:'A', cite:'Cerrillo-Urbina et al. 2015 Child Care Health Dev 41(6):779-88'},
      {name:'Neurofeedback (SCP or SMR)', target:['DMN','dACC','THETA'], mechanism:'Trains cortical self-regulation. Reduces theta/beta ratio.', evidence:'B', cite:'Arns et al. 2009 Clin EEG Neurosci 40(3):180-9'},
    
      {name:"Neurofeedback (SCP/theta-beta)", target:["dlPFC","dACC","mPFC","THETA"], mechanism:"Self-regulation of cortical oscillations. Normalizes theta/beta ratio.", evidence:"B", cite:"Arns et al. 2009 Clin EEG Neurosci 40(3):180-9"},
      {name:"Aerobic Exercise (30min 5x/week)", target:["BDNF","HIPP","VTA","dlPFC"], mechanism:"Dopamine/NE release, BDNF upregulation, executive function improvement", evidence:"A", cite:"Cerrillo-Urbina et al. 2015 Child Care Health Dev 41(6):779-88"},
    ],
    nutrition: [
      {name:'Omega-3 (EPA+DHA)', target:['BDNF','dlPFC','STRI'], mechanism:'Membrane fluidity, dopamine receptor function, anti-inflammatory', evidence:'A', cite:'Bloch & Qawasmi 2011 J Am Acad Child Adolesc Psychiatry 50(10):991-1000'},
      {name:'Iron (if ferritin <45)', target:['STRI','VTA','SNIG'], mechanism:'Cofactor in dopamine synthesis. Low ferritin correlates with ADHD severity.', evidence:'B', cite:'Konofal et al. 2008 Pediatr Neurol 38(1):20-6'},
      {name:'Zinc (15-25mg)', target:['STRI','dlPFC'], mechanism:'Modulates dopamine transporter function. Augments stimulant response.', evidence:'B', cite:'Oner et al. 2010 Prog Neuropsychopharmacol Biol Psychiatry 34(8):1472-6'},
      {name:'Protein-rich breakfast', target:['VTA','STRI','dlPFC'], mechanism:'Tyrosine (dopamine precursor) availability. Prevents glucose-crash inattention.', evidence:'C', cite:'Wolraich et al. 2005 Pediatrics 115(2):e216-23'},
    
      {name:"Zinc (15-30mg)", target:["VTA","dlPFC"], mechanism:"Cofactor in dopamine synthesis. Deficiency common in ADHD. Augments stimulant response.", evidence:"B", cite:"Bilici et al. 2004 Prog Neuropsychopharmacol Biol Psychiatry 28(1):181-90"},
      {name:"Iron (if ferritin <45)", target:["VTA","SN"], mechanism:"Essential cofactor for tyrosine hydroxylase (dopamine synthesis rate-limiting enzyme)", evidence:"B", cite:"Konofal et al. 2008 Pediatr Neurol 38(1):20-6"},
    ],
    supplements: [
      {name:'Phosphatidylserine (200mg)', target:['dlPFC','dACC','mPFC'], mechanism:'Membrane phospholipid supporting cortical function. Small RCTs positive.', evidence:'B', cite:'Hirayama et al. 2014 J Hum Nutr Diet 27 Suppl 2:284-91'},
      {name:'Pycnogenol (1mg/kg)', target:['STRI','dlPFC','dACC'], mechanism:'Antioxidant, modulates catecholamine metabolism', evidence:'B', cite:'Trebatická et al. 2006 Eur Child Adolesc Psychiatry 15(6):329-35'},
    ]
  },
  metabolic: [
    {factor:'Thyroid hormone effects on attention circuits', relevance:'T3 modulates dopamine receptor density in striatum and prefrontal cortex. Subclinical hypothyroidism impairs executive function and attention \u2014 overlaps significantly with ADHD phenotype.', screen:'TSH, free T4, free T3'},
    {factor:'Iron deficiency', relevance:'Iron is essential cofactor for tyrosine hydroxylase, the rate-limiting enzyme in dopamine synthesis. Low ferritin (<45 ng/mL) correlates with ADHD severity and reduced stimulant response.', screen:'Serum ferritin (not just CBC), serum iron, TIBC; target ferritin >45 ng/mL'},
    {factor:'Omega-3 deficiency', relevance:'Omega-3 fatty acids maintain dopamine receptor membrane fluidity in striatal circuits and support BDNF-dependent prefrontal plasticity. Deficiency impairs dopaminergic neurotransmission.', screen:'Omega-3 index (RBC EPA+DHA); target >8%'}
  ]
},

'ASD': {
  name: 'Autism Spectrum Disorder',
  dsm5: '299.00 (F84.0)',
  prevalence: '~1 in 36 children (CDC 2023). Lifelong.',
  summary: 'DMN underconnected — reduced mPFC-PCC coupling impairs self-referential processing and social cognition. E/I imbalance (excess excitation). STS/mirror system hypoactive for social perception. Predictive processing differences in cerebellum.',
  circuits: [
    {node:'mPFC',     dir:'hypo', detail:'Reduced functional connectivity with PCC. Impaired self-referential processing.', evidence:'A', cite:'Padmanabhan et al. 2017 Biol Psychiatry CNNI 2(6):476-86'},
    {node:'PCC',      dir:'hypo', detail:'DMN coherence reduced. Weak autobiographical narrative integration.', evidence:'A', cite:'Assaf et al. 2010 Autism Res 3(5):223-37'},
    {node:'STS',      dir:'hypo', detail:'Biological motion perception impaired. Gaze processing atypical.', evidence:'A', cite:'Pelphrey et al. 2011 Neuron 71(5):768-81'},
    {node:'FG',       dir:'hypo', detail:'Fusiform face area hypoactivation. Face processing differences.', evidence:'A', cite:'Schultz 2005 Int J Dev Neurosci 23(2-3):125-41'},
    {node:'TPJ',      dir:'hypo', detail:'Theory of mind circuit underactive. Perspective-taking difficulties.', evidence:'A', cite:'Lombardo et al. 2011 Brain 134(1):235-48'},
    {node:'OXY',      dir:'hypo', detail:'Oxytocin system differences → social bonding challenges', evidence:'B', cite:'Andari et al. 2010 PNAS 107(9):4389-94'},
    {node:'AI',       dir:'altered', detail:'Interoception atypical — alexithymia comorbidity. Difficulty reading own body states.', evidence:'B', cite:'Quattrocki & Friston 2014 Trends Cogn Sci 18(7):337-9'},
    {node:'BLA',      dir:'altered', detail:'Amygdala reactivity to social stimuli variable across development; hyperactive in youth, may habituate or reverse', evidence:'B', cite:'Dalton et al. 2005 Nat Neurosci 8(4):519-26'},
    {node:'CBLM',     dir:'altered', detail:'Purkinje cell loss. Predictive processing errors → need for sameness, routine.', evidence:'A', cite:'Courchesne et al. 2001 Curr Opin Neurobiol 11(1):118-24'},
    {node:'CC',       dir:'altered', detail:'Corpus callosum thinning — reduced interhemispheric connectivity; integration deficits', evidence:'A', cite:'Alexander et al. 2007 Neuroimage 36(4):1199-210'},
    {node:'STRI',     dir:'altered', detail:'Repetitive behaviors linked to striatal circuit dysfunction', evidence:'B', cite:'Langen et al. 2012 Biol Psychiatry 72(2):164-71'},
    {node:'LANG',     dir:'altered', detail:'Language network atypical connectivity. Delayed or different development.', evidence:'A', cite:'Eyler et al. 2012 PNAS 109(41):16485-90'},
    {node:'GABA_GLU', dir:'altered', detail:'Excitation/inhibition ratio shifted. GABAergic interneuron dysfunction. Sensory overwhelm.', evidence:'A', cite:'Rubenstein & Merzenich 2003 Genes Brain Behav 2(5):255-67'},
  ],
  criteria: {
    title: "Diagnostic Criteria 299.00 (F84.0)",
    sections: [
      {id:"A", text:"Persistent deficits in social communication and social interaction across multiple contexts, as manifested by all of the following, currently or by history:", items:["1. Deficits in social-emotional reciprocity.","2. Deficits in nonverbal communicative behaviors used for social interaction.","3. Deficits in developing, maintaining, and understanding relationships."]},
      {id:"B", text:"Restricted, repetitive patterns of behavior, interests, or activities, as manifested by at least 2 of the following:", items:["1. Stereotyped or repetitive motor movements, use of objects, or speech.","2. Insistence on sameness, inflexible adherence to routines, or ritualized patterns.","3. Highly restricted, fixated interests that are abnormal in intensity or focus.","4. Hyper- or hyporeactivity to sensory input or unusual interest in sensory aspects of the environment."]},
      {id:"C", text:"Symptoms must be present in the early developmental period."},
      {id:"D", text:"Symptoms cause clinically significant impairment in social, occupational, or other important areas of current functioning."},
      {id:"E", text:"These disturbances are not better explained by intellectual developmental disorder or global developmental delay."}
    ],
    specifiers: ["With or without accompanying intellectual impairment","With or without accompanying language impairment","Associated with a known medical or genetic condition or environmental factor","Associated with another neurodevelopmental, mental, or behavioral disorder","With catatonia"],
    severity: ["Level 1: Requiring support","Level 2: Requiring substantial support","Level 3: Requiring very substantial support"],
    codingNote: "Specify current severity separately for social communication and restricted, repetitive behaviors."
  },
    interventions: {
    pharma: [
      {name:'Risperidone/Aripiprazole (irritability)', target:['BLA','STRI','VTA'], mechanism:'Dopamine/serotonin modulation. FDA-approved for ASD irritability. Does not target core symptoms.', evidence:'A', cite:'McCracken et al. 2002 N Engl J Med 347(5):314-21'},
      {name:'Oxytocin (intranasal, investigational)', target:['OXY','STS','TPJ'], mechanism:'Enhances social salience and face processing. Mixed trial results.', evidence:'B', cite:'Andari et al. 2010 PNAS 107(9):4389-94; variable replication'},
      {name:'Bumetanide (investigational)', target:['EI','GABA_GLU'], mechanism:'NKCC1 inhibitor → shifts GABA from excitatory to inhibitory in immature neurons', evidence:'B', cite:'Lemonnier et al. 2012 Transl Psychiatry 2(12):e202'},
    
      {name:"Intranasal Oxytocin", target:["OXY","STS","TPJ","AI"], mechanism:"Enhances social salience, facial emotion recognition, eye gaze. Mixed RCT results.", evidence:"C", cite:"Yatawara et al. 2016 Mol Autism 7(1):2"},
      {name:"Bumetanide (investigational)", target:["GABA_GLU"], mechanism:"Loop diuretic shifts GABA from excitatory to inhibitory by lowering intracellular chloride. EU trials.", evidence:"C", cite:"Lemonnier et al. 2012 Transl Psychiatry 2(12):e202"},
    ],
    therapy: [
      {name:'ABA (Applied Behavior Analysis)', target:['STRI','dlPFC','CBLM'], mechanism:'Systematic behavioral shaping using reward circuits. Builds adaptive behaviors.', evidence:'A', cite:'Peters-Scheffer et al. 2011 Res Autism Spectr Disord 5(1):60-9'},
      {name:'Social Skills Training', target:['STS','TPJ','FG','OXY'], mechanism:'Explicit teaching of social perception and theory of mind', evidence:'B', cite:'Gates et al. 2017 J Autism Dev Disord 47(12):3739-67'},
      {name:'Occupational Therapy (sensory integration)', target:['AI','S1','EI'], mechanism:'Graduated sensory exposure. Interoceptive training. E/I recalibration.', evidence:'B', cite:'Schaaf et al. 2014 J Autism Dev Disord 44(5):1261-72'},
      {name:'Speech-Language Therapy', target:['BROCA','WERN','LANG','STS'], mechanism:'Language network development. Pragmatic language. Prosody.', evidence:'A', cite:'Kasari et al. 2014 J Am Acad Child Adolesc Psychiatry 53(6):635-46'},
    ],
    somatic: [
      {name:'Exercise (structured)', target:['BDNF','STRI','CBLM','VV'], mechanism:'Motor coordination, BDNF, social opportunity, repetitive behavior reduction', evidence:'B', cite:'Sowa & Meulenbroek 2012 Res Autism Spectr Disord 6(1):46-57'},
    
      {name:"Sensory Integration Therapy", target:["S1","AI","THAL","CB"], mechanism:"Graded sensory exposure normalizes thalamic gating and interoceptive calibration", evidence:"B", cite:"Schaaf et al. 2014 J Autism Dev Disord 44(5):1015-32"},
      {name:"tDCS (left dlPFC)", target:["dlPFC","dACC"], mechanism:"Transcranial direct current stimulation enhances executive function and cognitive flexibility", evidence:"C", cite:"Amatachaya et al. 2015 Front Hum Neurosci 9:458"},
    ],
    nutrition: [
      {name:'Omega-3', target:['BDNF','mPFC','EI'], mechanism:'Anti-inflammatory, membrane support. Modest evidence in ASD.', evidence:'B', cite:'Bent et al. 2014 J Autism Dev Disord 44(11):2991-3005'},
      {name:'Vitamin D', target:['RAPHE','EI'], mechanism:'Serotonin synthesis cofactor. Deficiency common in ASD populations.', evidence:'C', cite:'Patrick & Ames 2014 FASEB J 28(6):2398-413'},
      {name:'Probiotics', target:['GBA','ENS','VV'], mechanism:'Gut-brain axis modulation. GI symptoms common comorbidity.', evidence:'C', cite:'Sanctuary et al. 2018 Clin Ther 40(5):764-77'},
    
      {name:"Sulforaphane (broccoli sprout extract)", target:["BDNF","AI"], mechanism:"Nrf2 activation → reduces oxidative stress and neuroinflammation. Improved social responsiveness in RCT.", evidence:"B", cite:"Singh et al. 2014 Proc Natl Acad Sci 111(43):15550-5"},
    ],
    supplements: [
      {name:'Sulforaphane (broccoli extract)', target:['EI','dlPFC','BLA'], mechanism:'Nrf2 activation → antioxidant, anti-inflammatory. RCT showed behavioral improvement.', evidence:'B', cite:'Singh et al. 2014 PNAS 111(43):15550-5'},
      {name:'Melatonin (1-3mg)', target:['PIN','HYPO'], mechanism:'Sleep onset. Circadian regulation. Sleep disorders in 50-80% of ASD.', evidence:'A', cite:'Malow et al. 2012 J Autism Dev Disord 42(8):1729-37'},
    ]
  }
},

// ─────────────────────────────────────────────────
// OBSESSIVE-COMPULSIVE AND RELATED DISORDERS
// ─────────────────────────────────────────────────

'OCD': {
  name: 'Obsessive-Compulsive Disorder',
  dsm5: '300.3 (F42.2)',
  prevalence: '~1.2% US adults (NIMH)',
  summary: 'Cortico-striato-thalamo-cortical (CSTC) loop hyperactive. Caudate nucleus fails to gate intrusive signals. OFC-striatal circuit locked in error-detection mode. STN impulse brake impaired.',
  circuits: [
    {node:'CAUD',   dir:'hyper', detail:'Caudate hyperactive — cognitive loop stuck in "something is wrong" signal', evidence:'A', cite:'Menzies et al. 2008 Neurosci Biobehav Rev 32(3):525-49'},
    {node:'OFC',    dir:'hyper', detail:'Orbitofrontal cortex locked in error/incompleteness detection', evidence:'A', cite:'Chamberlain et al. 2005 Am J Psychiatry 162(7):1228-31'},
    {node:'THAL',   dir:'hyper', detail:'Thalamic relay gate fails to close → obsessive signals keep cycling', evidence:'A', cite:'Saxena et al. 1999 Br J Psychiatry Suppl(35):26-37'},
    {node:'dACC',   dir:'hyper', detail:'Error monitoring in overdrive — persistent "not right" signal', evidence:'A', cite:'Fitzgerald et al. 2005 Biol Psychiatry 57(3):287-94'},
    {node:'STN',    dir:'hypo', detail:'Impulse brake failing → cannot stop compulsive behavior once initiated', evidence:'B', cite:'Mallet et al. 2008 N Engl J Med 359(20):2121-34'},
    {node:'STRI',   dir:'hyper', detail:'Putamen/ventral striatum hyperactive in habit-compulsion loop', evidence:'A', cite:'Rauch et al. 2001 Arch Gen Psychiatry 58(7):669-80'},
    {node:'SN',     dir:'hyper', detail:'Salience network overweights intrusive thoughts as important', evidence:'B', cite:'Stern et al. 2012 Arch Gen Psychiatry 69(10):1013-21'},
    {node:'AI',     dir:'hyper', detail:'Disgust/contamination signals amplified', evidence:'B', cite:'Shapira et al. 2003 Biol Psychiatry 54(11):1235-42'},
    {node:'dlPFC',  dir:'hypo', detail:'Executive override capacity insufficient to break compulsion loop', evidence:'A', cite:'Nakao et al. 2009 Neuroimage 46(3):748-57'},
    {node:'SMA',    dir:'hyper', detail:'Motor preparation for compulsive action pre-activated', evidence:'B', cite:'de Wit et al. 2012 Biol Psychiatry 71(8):684-91'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.3 (F42.2)",
    sections: [
      {id:"A", text:"Presence of obsessions, compulsions, or both:", items:["Obsessions: (1) Recurrent and persistent thoughts, urges, or images that are experienced as intrusive and unwanted. (2) The individual attempts to ignore or suppress such thoughts, urges, or images, or to neutralize them with some other thought or action.","Compulsions: (1) Repetitive behaviors or mental acts that the individual feels driven to perform in response to an obsession or according to rules that must be applied rigidly. (2) The behaviors or mental acts are aimed at preventing or reducing anxiety or distress, or preventing some dreaded event or situation; however, these behaviors or mental acts are not connected in a realistic way with what they are designed to neutralize or prevent, or are clearly excessive."]},
      {id:"B", text:"The obsessions or compulsions are time-consuming (e.g., take more than 1 hour per day) or cause clinically significant distress or impairment in social, occupational, or other important areas of functioning."},
      {id:"C", text:"The obsessive-compulsive symptoms are not attributable to the physiological effects of a substance or another medical condition."},
      {id:"D", text:"The disturbance is not better explained by the symptoms of another mental disorder."}
    ],
    specifiers: ["With good or fair insight","With poor insight","With absent insight/delusional beliefs","Tic-related"],
    severity: ["Mild (Y-BOCS 8-15)","Moderate (Y-BOCS 16-23)","Severe (Y-BOCS 24-31)","Extreme (Y-BOCS 32-40)"],
    codingNote: "Specify if tic-related: if the individual has a current or past history of a tic disorder."
  },
    interventions: {
    pharma: [
      {name:'SSRIs (high dose)', target:['RAPHE','CAUD','OFC'], mechanism:'Serotonergic modulation of OFC-striatal loop. Higher doses needed than depression.', evidence:'A', cite:'Soomro et al. 2008 Cochrane Database Syst Rev'},
      {name:'Clomipramine', target:['RAPHE','CAUD','OFC'], mechanism:'Tricyclic with strong serotonergic effect. Gold standard efficacy.', evidence:'A', cite:'Katz et al. 1990 J Clin Psychiatry 51 Suppl:14-8'},
      {name:'Glutamate modulators (NAC, memantine)', target:['GABA_GLU','CAUD','OFC'], mechanism:'Glutamate excess in CSTC loop. NAC/memantine normalize.', evidence:'B', cite:'Pittenger 2015 Biol Psychiatry 78(11):746-8'},
    
      {name:"Psilocybin (investigational)", target:["OFC","CAUD","STN","DMN"], mechanism:"DMN dissolution breaks OFC-striatal lock. Open-label studies show rapid symptom reduction.", evidence:"C", cite:"Moreno et al. 2006 J Clin Psychiatry 67(11):1735-40; active RCTs"},
    ],
    therapy: [
      {name:'ERP (Exposure and Response Prevention)', target:['BLA','OFC','CAUD','dACC'], mechanism:'Gold standard. Exposure habituates error signal. Response prevention breaks compulsion loop.', evidence:'A', cite:'Öst et al. 2015 Clin Psychol Rev 40:156-69'},
      {name:'ACT for OCD', target:['mPFC','AI','dACC'], mechanism:'Defusion from obsessive content. Acceptance of uncertainty.', evidence:'B', cite:'Twohig et al. 2010 Behav Res Ther 48(8):805-12'},
    ],
    somatic: [
      {name:'DBS (subthalamic nucleus/VC/VS)', target:['STN','STRI','THAL'], mechanism:'Deep brain stimulation breaks CSTC loop electrically. Last resort.', evidence:'B', cite:'Mallet et al. 2008 N Engl J Med 359(20):2121-34'},
      {name:'rTMS (SMA targeting)', target:['SMA','dACC','OFC'], mechanism:'Reduces SMA hyperactivation → decreases urge to perform compulsion', evidence:'B', cite:'Berlim et al. 2013 J Psychiatr Res 47(8):999-1006'},
    
      {name:"Deep Brain Stimulation (VC/VS)", target:["CAUD","STN","OFC","NAcc"], mechanism:"Electrical stimulation of ventral capsule/striatum interrupts OFC-striatal hyperloop", evidence:"B", cite:"Denys et al. 2020 N Engl J Med 382(15):1417-26"},
      {name:"TMS (SMA/pre-SMA)", target:["SMA","dACC","OFC"], mechanism:"Inhibitory rTMS to supplementary motor area reduces compulsion urgency", evidence:"B", cite:"Rehn et al. 2018 Biol Psychiatry 83(10):787-8"},
    ],
    nutrition: [
      {name:'Myoinositol (12-18g/day)', target:['OFC','CAUD'], mechanism:'Second messenger system modulation. Mixed but some positive RCT data.', evidence:'B', cite:'Fux et al. 1996 Am J Psychiatry 153(9):1219-21'},
      {name:'NAC (2400-3000mg)', target:['GABA_GLU','CAUD','STRI'], mechanism:'Glutamate modulation via cystine-glutamate exchange', evidence:'B', cite:'Afshar et al. 2012 J Clin Psychopharmacol 32(6):797-803'},
    
      {name:"NAC (2400-3000mg)", target:["GABA_GLU","CAUD","OFC"], mechanism:"Glutamate modulation in cortico-striatal circuit. Augments SRI response.", evidence:"B", cite:"Afshar et al. 2012 J Clin Psychiatry 73(9):1028-33"},
      {name:"Inositol (12-18g/day)", target:["OFC","5HT"], mechanism:"Second messenger in serotonin signaling. Equivalent to fluvoxamine in one RCT.", evidence:"B", cite:"Fux et al. 1996 Am J Psychiatry 153(9):1219-21"},
    ],
    supplements: [
      {name:'Glycine (high dose, 60g/day)', target:['GABA_GLU','CAUD'], mechanism:'NMDA co-agonist. Glutamate circuit modulation. Difficult compliance.', evidence:'C', cite:'Greenberg et al. 2009 Biol Psychiatry 66(9):e7-9'},
      {name:'Milk thistle (silymarin 600mg)', target:['OFC','dACC'], mechanism:'Comparable to fluoxetine in one RCT. Mechanism unclear — likely anti-inflammatory/serotonergic.', evidence:'C', cite:'Sayyah et al. 2010 Prog Neuropsychopharmacol Biol Psychiatry 34(2):362-5'},
    ]
  }
},

// ─────────────────────────────────────────────────
// SUBSTANCE USE DISORDERS
// ─────────────────────────────────────────────────

'SUD': {
  name: 'Substance Use Disorder (General)',
  dsm5: 'Various (F10-F19)',
  prevalence: '~20.4 million US adults with SUD (SAMHSA 2019)',
  summary: 'Reward circuit hijacked — dopaminergic VTA→NAcc pathway sensitized to substance, desensitized to natural rewards. Habit system (putamen) overtakes goal system (caudate). Prefrontal inhibitory control degraded. DMN self-narrative reorganizes around substance identity.',
  circuits: [
    {node:'NAcc',   dir:'altered', detail:'Initial sensitization to substance cue. Progressive tolerance → natural reward anhedonia.', evidence:'A', cite:'Volkow et al. 2010 Neuropsychopharmacology 35(1):217-38'},
    {node:'VTA',    dir:'hyper', detail:'Dopamine burst to substance cue exceeds natural reward 2-10x', evidence:'A', cite:'Di Chiara & Imperato 1988 PNAS 85(14):5274-8'},
    {node:'PUT',    dir:'hyper', detail:'Habit system dominates → compulsive use despite consequences', evidence:'A', cite:'Everitt & Robbins 2005 Nat Neurosci 8(11):1481-9'},
    {node:'CAUD',   dir:'hypo', detail:'Goal-directed control weakened → cannot choose alternative actions', evidence:'A', cite:'Volkow et al. 2006 J Neurosci 26(24):6583-8'},
    {node:'dlPFC',  dir:'hypo', detail:'Inhibitory control degraded → impulsivity, poor decision-making', evidence:'A', cite:'Goldstein & Volkow 2011 Nat Rev Neurosci 12(11):652-69'},
    {node:'vmPFC',  dir:'hypo', detail:'Value computation distorted — substance overvalued vs long-term goals', evidence:'A', cite:'Bechara 2005 Nat Neurosci 8(11):1458-63'},
    {node:'OFC',    dir:'hyper', detail:'Cue reactivity — substance-associated stimuli trigger craving via OFC', evidence:'A', cite:'Volkow & Fowler 2000 Neuropsychopharmacology 23(2):3-13'},
    {node:'AI',     dir:'hyper', detail:'Interoceptive craving signal. Insula lesion can abolish cigarette addiction.', evidence:'A', cite:'Naqvi et al. 2007 Science 315(5811):531-4'},
    {node:'BLA',    dir:'hyper', detail:'Cue-fear-craving associations. Stress-induced relapse via amygdala.', evidence:'A', cite:'See 2005 Pharmacol Biochem Behav 82(4):721-31'},
    {node:'HPA',    dir:'altered', detail:'Stress → relapse pathway. CRF drives craving.', evidence:'A', cite:'Sinha 2008 Psychopharmacology 158(4):343-59'},
    {node:'mPFC',   dir:'altered', detail:'DMN self-narrative reorganizes around addiction identity', evidence:'B', cite:'Motzkin et al. 2014 Drug Alcohol Depend 139:18-25'},
    {node:'ENDO',   dir:'altered', detail:'Endocannabinoid system disrupted (esp. cannabis, alcohol)', evidence:'B', cite:'Parsons & Hurd 2015 Nat Rev Neurosci 16(10):579-94'},
  ],
  criteria: {
    title: "Diagnostic Criteria — Substance Use Disorders (various codes)",
    sections: [
      {id:"A", text:"A problematic pattern of substance use leading to clinically significant impairment or distress, as manifested by at least 2 of the following within a 12-month period:", items:["1. Substance is often taken in larger amounts or over a longer period than was intended.","2. There is a persistent desire or unsuccessful efforts to cut down or control use.","3. A great deal of time is spent in activities necessary to obtain, use, or recover from the substance.","4. Craving, or a strong desire or urge to use the substance.","5. Recurrent use resulting in a failure to fulfill major role obligations at work, school, or home.","6. Continued use despite having persistent or recurrent social or interpersonal problems caused or exacerbated by the effects.","7. Important social, occupational, or recreational activities are given up or reduced because of use.","8. Recurrent use in situations in which it is physically hazardous.","9. Use is continued despite knowledge of having a persistent or recurrent physical or psychological problem that is likely to have been caused or exacerbated by the substance.","10. Tolerance, as defined by either: (a) a need for markedly increased amounts to achieve intoxication or desired effect, or (b) a markedly diminished effect with continued use of the same amount.","11. Withdrawal, as manifested by either: (a) the characteristic withdrawal syndrome for the substance, or (b) the substance (or a closely related substance) is taken to relieve or avoid withdrawal symptoms."]}
    ],
    specifiers: ["In early remission","In sustained remission","On maintenance therapy","In a controlled environment"],
    severity: ["Mild (2-3 symptoms)","Moderate (4-5 symptoms)","Severe (6+ symptoms)"],
    codingNote: "Code based on specific substance class (alcohol, opioid, stimulant, cannabis, sedative, hallucinogen, inhalant, tobacco, other). ICD-10 codes vary by substance."
  },
    interventions: {
    pharma: [
      {name:'Naltrexone (oral/Vivitrol)', target:['OPIOID','NAcc','VTA'], mechanism:'Mu-opioid antagonist. Blocks reward signal from alcohol/opioids. Reduces craving.', evidence:'A', cite:'Jonas et al. 2014 JAMA 311(18):1889-900'},
      {name:'Buprenorphine (opioid SUD)', target:['OPIOID','VTA','NAcc','PAG'], mechanism:'Partial mu-agonist. Reduces withdrawal, craving, overdose risk.', evidence:'A', cite:'Mattick et al. 2014 Cochrane Database Syst Rev'},
      {name:'Disulfiram (alcohol)', target:['VTA','STRI'], mechanism:'Aldehyde dehydrogenase inhibitor → aversive conditioning', evidence:'A', cite:'Skinner et al. 2014 Cochrane Database Syst Rev'},
      {name:'Varenicline (nicotine)', target:['NAcc','VTA'], mechanism:'Nicotinic partial agonist. Reduces reward from smoking + withdrawal.', evidence:'A', cite:'Cahill et al. 2016 Cochrane Database Syst Rev'},
      {name:'Psilocybin (investigational)', target:['DMN','mPFC','PCC','NAcc'], mechanism:'DMN dissolution → identity narrative reset → breaks addiction self-concept', evidence:'B', cite:'Johnson et al. 2014 J Psychopharmacol 28(11):983-92; Bogenschutz et al. 2022 JAMA Psychiatry 79(10):953-62'},
    ],
    therapy: [
      {name:'Motivational Interviewing', target:['mPFC','vmPFC','dlPFC'], mechanism:'Strengthens intrinsic motivation via DMN narrative engagement. Resolves ambivalence.', evidence:'A', cite:'Vasilaki et al. 2006 Drug Alcohol Rev 25(5):425-40'},
      {name:'CBT (relapse prevention)', target:['dlPFC','vmPFC','OFC','AI'], mechanism:'Cognitive restructuring of craving beliefs. Cue management. PFC strengthening.', evidence:'A', cite:'Magill & Ray 2009 J Consult Clin Psychol 77(6):1089-98'},
      {name:'Contingency Management', target:['NAcc','CAUD','VTA'], mechanism:'Alternative reward delivery. Re-engages natural reward circuitry.', evidence:'A', cite:'Lussier et al. 2006 Addiction 101(11):1546-60'},
      {name:'12-Step (AA/NA)', target:['OXY','VV','mPFC'], mechanism:'Social bonding (oxytocin), DMN narrative restructuring (identity change), vagal co-regulation', evidence:'B', cite:'Kelly et al. 2020 Cochrane Database Syst Rev'},
    ],
    somatic: [
      {name:'Exercise', target:['BDNF','VTA','NAcc','HPA'], mechanism:'Alternative dopamine source. BDNF restoration. Stress reduction.', evidence:'A', cite:'Linke & Ussher 2015 Subst Use Misuse 50(3):373-96'},
      {name:'Auricular Acupuncture (NADA)', target:['VV','NTS','SNS'], mechanism:'Vagal stimulation → parasympathetic activation → withdrawal relief', evidence:'B', cite:'Baker & Chang 2016 J Altern Complement Med 22(1):58-62'},
    ],
    nutrition: [
      {name:'NAC (1200-2400mg)', target:['GABA_GLU','NAcc','dlPFC'], mechanism:'Glutamate normalization in nucleus accumbens. Reduces craving.', evidence:'B', cite:'McClure et al. 2014 Am J Drug Alcohol Abuse 40(5):343-9'},
      {name:'Omega-3', target:['BDNF','dlPFC'], mechanism:'PFC function support, anti-inflammatory', evidence:'C', cite:'Roncero et al. 2020 Drugs 80(7):697-711'},
    ],
    supplements: [
      {name:'Kudzu extract (puerarin)', target:['VTA','NAcc'], mechanism:'Aldehyde dehydrogenase inhibitor + dopamine modulation. Reduces alcohol consumption.', evidence:'B', cite:'Lukas et al. 2005 Alcohol Clin Exp Res 29(5):756-62'},
    ]
  }
},

// ─────────────────────────────────────────────────
// BIPOLAR AND RELATED DISORDERS
// ─────────────────────────────────────────────────

'BIPOLAR_I': {
  name: 'Bipolar I Disorder',
  dsm5: '296.xx (F31.x)',
  prevalence: '~2.8% US adults (bipolar spectrum, NIMH)',
  summary: 'Oscillation between DMN-salience decoupling states. Mania: reward circuit hyperactive, inhibitory control collapsed, DMN grandiosity. Depression phase mirrors MDD circuit. Amygdala reactivity elevated across phases.',
  circuits: [
    {node:'NAcc',   dir:'altered', detail:'Reward system oscillates — hyperactive in mania (grandiosity, risk), hypoactive in depression (anhedonia)', evidence:'A', cite:'Phillips & Swartz 2014 Am J Psychiatry 171(5):505-7'},
    {node:'VTA',    dir:'hyper', detail:'Dopaminergic drive amplified in mania', evidence:'A', cite:'Berk et al. 2007 Neurotox Res 12(4):263-87'},
    {node:'dlPFC',  dir:'hypo', detail:'Executive control impaired across both phases — poor regulation', evidence:'A', cite:'Strakowski et al. 2012 Bipolar Disord 14(4):326-39'},
    {node:'BLA',    dir:'hyper', detail:'Amygdala reactivity elevated in euthymia, mania, and depression', evidence:'A', cite:'Townsend et al. 2013 Biol Psychiatry 74(8):575-83'},
    {node:'vmPFC',  dir:'hypo', detail:'Prefrontal-amygdala regulation impaired → emotional lability', evidence:'A', cite:'Blumberg et al. 2003 Arch Gen Psychiatry 60(6):601-9'},
    {node:'SN',     dir:'altered', detail:'Salience network-DMN coupling disrupted → inappropriate state switching', evidence:'A', cite:'Zhao et al. 2024 BMC Psychiatry 24:428'},
    {node:'DMN',    dir:'altered', detail:'DMN connectivity reduced within network, especially mania', evidence:'A', cite:'Öngür et al. 2010 PNAS 107(20):9222-7'},
    {node:'THAL',   dir:'altered', detail:'Thalamic filtering disrupted → sensory flooding in mania', evidence:'B', cite:'Anticevic et al. 2014 Am J Psychiatry 171(4):463-71'},
  ],
  criteria: {
    title: "Diagnostic Criteria 296.xx (F31.xx)",
    sections: [
      {id:"MANIC", text:"For a diagnosis of Bipolar I Disorder, it is necessary to meet the following criteria for a manic episode. A distinct period of abnormally and persistently elevated, expansive, or irritable mood and abnormally and persistently increased goal-directed activity or energy, lasting at least 1 week and present most of the day, nearly every day (or any duration if hospitalization is necessary)."},
      {id:"B", text:"During the period of mood disturbance and increased energy or activity, 3 (or more) of the following symptoms (4 if the mood is only irritable) are present to a significant degree and represent a noticeable change from usual behavior:", items:["1. Inflated self-esteem or grandiosity.","2. Decreased need for sleep.","3. More talkative than usual or pressure to keep talking.","4. Flight of ideas or subjective experience that thoughts are racing.","5. Distractibility.","6. Increase in goal-directed activity or psychomotor agitation.","7. Excessive involvement in activities that have a high potential for painful consequences."]},
      {id:"C", text:"The mood disturbance is sufficiently severe to cause marked impairment in social or occupational functioning or to necessitate hospitalization to prevent harm to self or others, or there are psychotic features."},
      {id:"D", text:"The episode is not attributable to the physiological effects of a substance or another medical condition."}
    ],
    specifiers: ["With anxious distress","With mixed features","With rapid cycling","With melancholic features","With atypical features","With mood-congruent psychotic features","With mood-incongruent psychotic features","With catatonia","With peripartum onset","With seasonal pattern"],
    severity: ["Mild","Moderate","Severe"],
    codingNote: "At least one lifetime manic episode is required. Major depressive episodes are common but not required for diagnosis."
  },
    interventions: {
    pharma: [
      {name:'Lithium', target:['NAcc','VTA','BDNF','HIPP','dlPFC'], mechanism:'Neuroprotective, glutamate modulation, GSK-3 inhibition, BDNF increase. Gold standard.', evidence:'A', cite:'Geddes et al. 2004 Am J Psychiatry 161(2):217-22'},
      {name:'Valproate', target:['GABA_GLU','BLA','THAL'], mechanism:'GABA enhancement, sodium channel modulation. Antimanic.', evidence:'A', cite:'Bowden et al. 2006 Arch Gen Psychiatry 63(10):1074-82'},
      {name:'Lamotrigine (depression prevention)', target:['GABA_GLU','mPFC','NAcc'], mechanism:'Glutamate reduction. Prevents depressive relapse. Not antimanic.', evidence:'A', cite:'Bowden et al. 2003 Arch Gen Psychiatry 60(4):392-400'},
      {name:'Second-gen antipsychotics', target:['VTA','NAcc','BLA','THAL'], mechanism:'Dopamine/serotonin modulation. Antimanic and maintenance.', evidence:'A', cite:'Cipriani et al. 2011 Ann Intern Med 155(6):364-5'},
    ],
    therapy: [
      {name:'Psychoeducation', target:['dlPFC','mPFC'], mechanism:'Illness recognition, prodrome detection, medication adherence', evidence:'A', cite:'Bond & Anderson 2015 J Affect Disord 174:467-73'},
      {name:'IPSRT (Interpersonal and Social Rhythm)', target:['PIN','HYPO','VV'], mechanism:'Circadian stabilization → prevents episode trigger from rhythm disruption', evidence:'A', cite:'Frank et al. 2005 Arch Gen Psychiatry 62(9):996-1004'},
      {name:'CBT for Bipolar', target:['dlPFC','mPFC','vmPFC'], mechanism:'Thought monitoring, behavioral activation, relapse prevention', evidence:'A', cite:'Miklowitz & Scott 2009 J Clin Psychiatry 70(11):e44'},
    ],
    somatic: [
      {name:'Sleep Regulation', target:['PIN','HYPO','LC','DMN'], mechanism:'Critical. Sleep disruption is the most reliable mania trigger. Circadian entrainment.', evidence:'A', cite:'Harvey et al. 2015 J Consult Clin Psychol 83(3):564-77'},
      {name:'Exercise (moderate, consistent)', target:['BDNF','VTA','HPA','VV'], mechanism:'Mood stabilization, BDNF, circadian anchoring. Avoid overtraining (mania trigger).', evidence:'B', cite:'Ng et al. 2007 Bipolar Disord 9(8):851-6'},
    ],
    nutrition: [
      {name:'Omega-3 (EPA)', target:['BDNF','BLA','dlPFC'], mechanism:'Anti-inflammatory, membrane support. Adjunctive evidence.', evidence:'B', cite:'Sarris et al. 2012 J Clin Psychiatry 73(1):81-6'},
      {name:'NAC', target:['GABA_GLU','NAcc','dlPFC'], mechanism:'Glutamate modulation, oxidative stress reduction', evidence:'B', cite:'Berk et al. 2008 Biol Psychiatry 64(6):468-75'},
    
      {name:"NAC (2000mg)", target:["GABA_GLU","mPFC","NAcc"], mechanism:"Glutamate/oxidative stress modulation. Adjunctive RCT evidence in bipolar depression.", evidence:"B", cite:"Berk et al. 2008 Biol Psychiatry 64(6):468-75"},
      {name:"Omega-3 (EPA dominant)", target:["BDNF","mPFC"], mechanism:"Mood stabilization support. Most evidence for depressive pole.", evidence:"B", cite:"Sarris et al. 2012 J Clin Psychiatry 73(1):81-6"},
    ],
    supplements: []
  },
  metabolic: [
    {factor:'Metabolic syndrome', relevance:'Prevalence 2\u20133x general population, even in medication-naive patients. Insulin resistance impairs prefrontal regulation and reward circuit function, worsening mood instability.', screen:'Fasting glucose, HbA1c, lipid panel, waist circumference, blood pressure; baseline before medication initiation'},
    {factor:'Thyroid effects of lithium', relevance:'Lithium inhibits thyroid hormone release \u2014 up to 40% of lithium-treated patients develop subclinical hypothyroidism. Hypothyroidism accelerates depressive cycling and reduces lithium efficacy.', screen:'TSH, free T4 at baseline and every 6 months on lithium; TPO antibodies at baseline'},
    {factor:'Insulin resistance', relevance:'Both illness and treatments (SGAs, valproate) promote insulin resistance. Hyperinsulinemia reduces VTA dopaminergic signaling, potentially worsening both depressive and manic phases.', screen:'Fasting glucose, HbA1c, fasting insulin at baseline and quarterly on SGAs/valproate'}
  ]
},

// ─────────────────────────────────────────────────
// PERSONALITY DISORDERS
// ─────────────────────────────────────────────────

'BPD': {
  name: 'Borderline Personality Disorder',
  dsm5: '301.83 (F60.3)',
  prevalence: '~1.4% US adults (NIMH)',
  summary: 'Amygdala hyperreactive with impaired prefrontal regulation. Oxytocin/attachment system dysregulated. Identity instability reflects DMN fragmentation. Pain system altered — emotional pain overlaps with physical pain circuitry.',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Amygdala hyperreactivity to emotional stimuli — especially rejection/abandonment cues', evidence:'A', cite:'Donegan et al. 2003 Biol Psychiatry 54(11):1284-93'},
    {node:'vmPFC',  dir:'hypo', detail:'Failed emotion regulation → emotional storms', evidence:'A', cite:'Silbersweig et al. 2007 Am J Psychiatry 164(12):1832-41'},
    {node:'dlPFC',  dir:'hypo', detail:'Cognitive reappraisal capacity reduced', evidence:'A', cite:'Schulze et al. 2011 Biol Psychiatry 69(6):564-73'},
    {node:'AI',     dir:'hyper', detail:'Interoceptive amplification → somatic distress, pain sensitivity', evidence:'B', cite:'Niedtfeld et al. 2012 Biol Psychiatry 71(8):693-700'},
    {node:'dACC',   dir:'altered', detail:'Pain matrix activation to social rejection = physical pain response', evidence:'A', cite:'Eisenberger et al. 2003 Science 302(5643):290-2 (general); extended to BPD'},
    {node:'OXY',    dir:'altered', detail:'Oxytocin effects paradoxical — may increase threat detection in insecure attachment', evidence:'B', cite:'Bartz et al. 2011 Psychoneuroendocrinology 36(8):1219-28'},
    {node:'DMN',    dir:'altered', detail:'Identity instability = DMN narrative coherence fails under emotional load', evidence:'B', cite:'Wolf et al. 2011 Psychiatry Res 194(2):141-8'},
    {node:'OPIOID', dir:'altered', detail:'Endogenous opioid system disrupted — self-harm produces opioid release (pain offset relief)', evidence:'B', cite:'Stanley & Siever 2010 Am J Psychiatry 167(1):28-39'},
    {node:'HPA',    dir:'hyper', detail:'Cortisol reactivity increased, especially to interpersonal stress', evidence:'A', cite:'Lyons-Ruth et al. 2011 Psychoneuroendocrinology 36(10):1508-18'},
  ],
  criteria: {
    title: "Diagnostic Criteria 301.83 (F60.3)",
    sections: [
      {id:"A", text:"A pervasive pattern of instability of interpersonal relationships, self-image, and affects, and marked impulsivity, beginning by early adulthood and present in a variety of contexts, as indicated by 5 (or more) of the following:", items:["1. Frantic efforts to avoid real or imagined abandonment.","2. A pattern of unstable and intense interpersonal relationships characterized by alternating between extremes of idealization and devaluation.","3. Identity disturbance: markedly and persistently unstable self-image or sense of self.","4. Impulsivity in at least 2 areas that are potentially self-damaging (e.g., spending, sex, substance abuse, reckless driving, binge eating).","5. Recurrent suicidal behavior, gestures, or threats, or self-mutilating behavior.","6. Affective instability due to a marked reactivity of mood.","7. Chronic feelings of emptiness.","8. Inappropriate, intense anger or difficulty controlling anger.","9. Transient, stress-related paranoid ideation or severe dissociative symptoms."]}
    ],
    specifiers: [],
    severity: [],
    codingNote: "Personality disorder criteria require onset by early adulthood and stability across time and situations."
  },
    interventions: {
    pharma: [
      {name:'Mood stabilizers (off-label)', target:['BLA','GABA_GLU','NAcc'], mechanism:'Emotional reactivity reduction. No FDA-approved medications for BPD.', evidence:'B', cite:'Lieb et al. 2010 Cochrane Database Syst Rev'},
      {name:'Low-dose antipsychotics (off-label)', target:['BLA','VTA','THAL'], mechanism:'Reduces cognitive-perceptual symptoms, anger, impulsivity', evidence:'B', cite:'Ingenhoven et al. 2010 J Clin Psychiatry 71(1):14-25'},
    
      {name:"Ketamine (investigational)", target:["BLA","vmPFC","GABA_GLU"], mechanism:"Rapid reduction of suicidal ideation and emotional dysregulation", evidence:"C", cite:"Grunebaum et al. 2018 Am J Psychiatry 175(4):327-35"},
    ],
    therapy: [
      {name:'DBT (Dialectical Behavior Therapy)', target:['vmPFC','BLA','AI','VV'], mechanism:'Gold standard. Distress tolerance (vmPFC strengthening), mindfulness (DMN awareness), interpersonal effectiveness (OXY), emotion regulation (amygdala modulation)', evidence:'A', cite:'Linehan et al. 2006 Arch Gen Psychiatry 63(7):757-66'},
      {name:'MBT (Mentalization-Based Treatment)', target:['mPFC','TPJ','STS','OXY'], mechanism:'Strengthens theory of mind and mentalizing capacity. DMN perspective-taking.', evidence:'A', cite:'Bateman & Fonagy 2009 Am J Psychiatry 166(12):1355-64'},
      {name:'Schema Therapy', target:['mPFC','BLA','vmPFC','OXY'], mechanism:'Identifies and restructures early maladaptive schemas (DMN narrative patterns)', evidence:'A', cite:'Giesen-Bloo et al. 2006 Arch Gen Psychiatry 63(6):649-58'},
      {name:'TFP (Transference-Focused)', target:['OXY','mPFC','BLA','TPJ'], mechanism:'Attachment system reworked via therapeutic relationship. Object relations.', evidence:'A', cite:'Doering et al. 2010 Br J Psychiatry 196(5):389-95'},
    ],
    somatic: [
      {name:'Exercise', target:['BDNF','VTA','HPA','VV'], mechanism:'Emotional regulation, stress reduction, vagal restoration', evidence:'C', cite:'Khoury et al. 2019 J Pers Disord 33(5):617-31'},
      {name:'Mindfulness/Yoga', target:['VV','AI','mPFC','PCC'], mechanism:'Interoceptive training, DMN stabilization, vagal tone', evidence:'B', cite:'Elices et al. 2017 Clin Psychol Rev 57:10-18'},
    ],
    nutrition: [
      {name:'Omega-3', target:['BDNF','BLA','dlPFC'], mechanism:'Impulsivity and aggression reduction in RCTs', evidence:'B', cite:'Hallahan et al. 2007 Am J Psychiatry 164(10):1621-2'},
    
      {name:"Omega-3 (EPA 1-2g)", target:["vmPFC","BLA","BDNF"], mechanism:"Reduces impulsivity and aggression. RCT evidence in BPD specifically.", evidence:"B", cite:"Hallahan et al. 2007 Br J Psychiatry 190:118-22"},
      {name:"NAC (2000mg)", target:["GABA_GLU","dACC"], mechanism:"Glutamate modulation reduces emotional reactivity", evidence:"C", cite:"Berk et al. 2013; Dean et al. 2011"},
    ],
    supplements: [
      {name:"Magnesium threonate", target:["GABA_GLU","BLA","vmPFC"], mechanism:"GABA support, amygdala calming, prefrontal regulation", evidence:"C", cite:"Abumaria et al. 2011"}
    ]
  }
},

// ─────────────────────────────────────────────────
// DISSOCIATIVE DISORDERS
// ─────────────────────────────────────────────────

'DID_DPDR': {
  name: 'Dissociative Disorders (DID / DPDR)',
  dsm5: '300.14 (F44.81) / 300.6 (F48.1)',
  prevalence: '~2% DPDR, ~1.5% DID (population surveys vary widely)',
  summary: 'DMN fragmentation — self-referential processing nodes disconnect. Insula-DMN decoupling produces depersonalization. PAG/dorsal vagal activation produces derealization and freeze states. In DID, multiple distinct DMN configurations alternate.',
  circuits: [
    {node:'mPFC',   dir:'hypo', detail:'Self-referential processing disrupted or alternating between states', evidence:'B', cite:'Reinders et al. 2006 Biol Psychiatry 60(7):730-40'},
    {node:'PCC',    dir:'hypo', detail:'DMN hub disconnected from other nodes → narrative self breaks', evidence:'B', cite:'Daniels et al. 2012 PLoS One 7(11):e49834'},
    {node:'AI',     dir:'hypo', detail:'Interoception suppressed → "this isn\'t my body" experience (depersonalization)', evidence:'A', cite:'Phillips et al. 2001 Psychiatry Res 108(3):145-60'},
    {node:'S1',     dir:'hypo', detail:'Body schema representation faded → "my hand isn\'t mine"', evidence:'B', cite:'Sierra & Berrios 2000 Psychopathology 33(3):116-20'},
    {node:'VEST',   dir:'altered', detail:'Spatial self disrupted → floating, detachment from gravity', evidence:'B', cite:'Lopez & Blanke 2011 Front Integr Neurosci 5:17'},
    {node:'PAG',    dir:'hyper', detail:'Defensive freeze activation — dorsal vagal immobilization', evidence:'B', cite:'Porges 2011; van der Hart et al. 2004'},
    {node:'DV',     dir:'hyper', detail:'Dorsal vagal shutdown → numbing, emotional blunting, collapse', evidence:'B', cite:'Porges 2011 Polyvagal Theory'},
    {node:'TPJ',    dir:'altered', detail:'Self-other boundary disrupted → out-of-body experiences, identity confusion', evidence:'A', cite:'Blanke et al. 2004 Brain 127(2):243-58'},
    {node:'BLA',    dir:'altered', detail:'In DPDR: amygdala suppressed (emotional numbing). In DID: hyperactive in trauma states.', evidence:'B', cite:'Phillips et al. 2001; Sierra et al. 2002'},
    {node:'FORN',   dir:'altered', detail:'Memory integration disrupted → amnesia between states', evidence:'C', cite:'Staniloiu & Markowitsch 2012 Lancet Psychiatry'},
  ],
  criteria: {
    title: "Diagnostic Criteria — Dissociative Identity Disorder 300.14 (F44.81) / Depersonalization-Derealization Disorder 300.6 (F48.1)",
    sections: [
      {id:"DID-A", text:"DID Criterion A: Disruption of identity characterized by two or more distinct personality states, which may be described in some cultures as an experience of possession. The disruption in identity involves marked discontinuity in sense of self and sense of agency, accompanied by related alterations in affect, behavior, consciousness, memory, perception, cognition, and/or sensory-motor functioning."},
      {id:"DID-B", text:"DID Criterion B: Recurrent gaps in the recall of everyday events, important personal information, and/or traumatic events that are inconsistent with ordinary forgetting."},
      {id:"DID-C", text:"DID Criterion C: The symptoms cause clinically significant distress or impairment."},
      {id:"DID-D", text:"DID Criterion D: The disturbance is not a normal part of a broadly accepted cultural or religious practice."},
      {id:"DPDR-A", text:"DPDR Criterion A: Persistent or recurrent experiences of depersonalization, derealization, or both: Depersonalization: Experiences of unreality, detachment, or being an outside observer with respect to one's thoughts, feelings, sensations, body, or actions. Derealization: Experiences of unreality or detachment with respect to surroundings."},
      {id:"DPDR-B", text:"DPDR Criterion B: During the depersonalization or derealization experiences, reality testing remains intact."},
      {id:"DPDR-C", text:"DPDR Criterion C: The symptoms cause clinically significant distress or impairment."}
    ],
    specifiers: [],
    severity: [],
    codingNote: "DID and DPDR are distinct diagnoses. DID involves identity disruption with amnesia; DPDR involves detachment with intact reality testing."
  },
    interventions: {
    pharma: [
      {name:'Lamotrigine (DPDR)', target:['GABA_GLU','mPFC','AI'], mechanism:'Glutamate modulation may restore insula-cortical connectivity', evidence:'B', cite:'Sierra et al. 2003 J Clin Psychopharmacol 23(6):634-6'},
      {name:'Naltrexone (DPDR)', target:['OPIOID','AI','mPFC'], mechanism:'Opioid antagonism → reduces numbing/dissociative analgesia', evidence:'B', cite:'Simeon & Knutelska 2005 J Clin Psychopharmacol 25(3):267-70'},
      {name:'SSRIs (comorbid depression/anxiety)', target:['RAPHE','BLA'], mechanism:'Treats common comorbidities. Does not directly treat dissociation.', evidence:'B', cite:'Simeon et al. 2004 Prog Neuropsychopharmacol Biol Psychiatry 28(1):127-33'},
    ],
    therapy: [
      {name:'Phase-oriented trauma therapy', target:['vmPFC','BLA','HIPP','mPFC'], mechanism:'Stabilization → trauma processing → integration. Standard of care for DID.', evidence:'A', cite:'ISSTD Guidelines 2011; Brand et al. 2012'},
      {name:'EMDR', target:['BLA','HIPP','vmPFC'], mechanism:'Reconsolidation of fragmented trauma memories', evidence:'B', cite:'van der Hart et al. 2006 The Haunted Self'},
      {name:'Sensorimotor Psychotherapy', target:['S1','AI','PAG','VV'], mechanism:'Bottom-up body-based processing of freeze/dissociative patterns', evidence:'C', cite:'Ogden et al. 2006 Trauma and the Body'},
      {name:'Grounding techniques', target:['S1','AI','V1','A1','VEST'], mechanism:'Re-engage sensory cortices to counter dissociative disconnection', evidence:'C', cite:'Clinical consensus; Brand et al. 2012 J Trauma Dissociation'},
    ],
    somatic: [
      {name:'Yoga', target:['VV','AI','S1','PAG'], mechanism:'Interoceptive reconnection. Ventral vagal restoration.', evidence:'B', cite:'Price & Hooven 2018 Front Psychiatry 9:72'},
      {name:'Cold water face immersion (dive reflex)', target:['VV','NTS','SNS'], mechanism:'Parasympathetic activation via trigeminocardiac reflex → breaks dissociative freeze', evidence:'C', cite:'Porges 2011; clinical adaptation'},
    ],
    nutrition: [
      {name:'Stable blood glucose', target:['dlPFC','HYPO','mPFC'], mechanism:'Hypoglycemia can trigger dissociative episodes. Regular meals critical.', evidence:'C', cite:'Clinical consensus'},
    
      {name:"Omega-3", target:["BDNF","mPFC","AI"], mechanism:"Neuroplasticity support for integration processes", evidence:"C", cite:"General neuroprotection literature"},
      {name:"Magnesium glycinate", target:["GABA_GLU","VV"], mechanism:"Parasympathetic support, reduces dissociative hyperarousal", evidence:"C", cite:"Boyle et al. 2017"},
    ],
    supplements: []
  }
},

// ─────────────────────────────────────────────────
// SCHIZOPHRENIA SPECTRUM
// ─────────────────────────────────────────────────

'SCHIZOPHRENIA': {
  name: 'Schizophrenia',
  dsm5: '295.90 (F20.9)',
  prevalence: '~0.25-0.64% globally (GBD 2019)',
  summary: 'Aberrant DMN-salience network coupling. DMN fails to suppress during external tasks → internal signals misattributed as external (hallucinations). Hippocampal-PFC disconnection impairs reality monitoring. Dopamine hypothesis: mesolimbic hyperactive, mesocortical hypoactive.',
  circuits: [
    {node:'DMN',    dir:'hyper', detail:'DMN intrudes during external processing → internal signals feel external', evidence:'A', cite:'Whitfield-Gabrieli et al. 2009 PNAS 106(4):1279-84'},
    {node:'SN',     dir:'altered', detail:'Salience network incorrectly tags internal events as externally significant', evidence:'A', cite:'Palaniyappan & Liddle 2012 J Neurol Neurosurg Psychiatry 83(6):570-4'},
    {node:'VTA',    dir:'hyper', detail:'Dopamine excess in mesolimbic pathway → positive symptoms (delusions, hallucinations)', evidence:'A', cite:'Howes & Kapur 2009 Schizophr Bull 35(3):549-62'},
    {node:'dlPFC',  dir:'hypo', detail:'Mesocortical dopamine deficit → negative symptoms, cognitive impairment', evidence:'A', cite:'Goldman-Rakic 1994 J Neuropsychiatry Clin Neurosci 6(4):348-57'},
    {node:'HIPP',   dir:'hyper', detail:'Hippocampal hyperactivity → source memory deficits → cannot distinguish imagined from real', evidence:'A', cite:'Heckers & Konradi 2010 Schizophr Bull 36(3):545-50'},
    {node:'THAL',   dir:'hypo', detail:'Thalamic sensory gating impaired → sensory flooding', evidence:'A', cite:'Anticevic et al. 2014 Am J Psychiatry 171(4):463-71'},
    {node:'AI',     dir:'hyper', detail:'Aberrant salience to irrelevant stimuli', evidence:'A', cite:'Palaniyappan et al. 2013 Hum Brain Mapp 34(12):3066-76'},
    {node:'BROCA',  dir:'hyper', detail:'Inner speech area active during auditory hallucinations', evidence:'A', cite:'Jardri et al. 2011 Schizophr Bull 37(4):727-35'},
    {node:'A1',     dir:'hyper', detail:'Primary auditory cortex activates during auditory verbal hallucinations', evidence:'A', cite:'Dierks et al. 1999 Neuron 22(3):615-21'},
    {node:'mPFC',   dir:'hyper', detail:'Self-referential processing distorted → ideas of reference, paranoid ideation', evidence:'A', cite:'Holt et al. 2011 Biol Psychiatry 70(4):329-36'},
    {node:'CBLM',   dir:'altered', detail:'Cerebellar-cortical dysconnection → "dysmetria of thought" (Schmahmann)', evidence:'B', cite:'Andreasen & Pierson 2008 Biol Psychiatry 64(2):81-8'},
  ],
  criteria: {
    title: "Diagnostic Criteria 295.90 (F20.9)",
    sections: [
      {id:"A", text:"Two (or more) of the following, each present for a significant portion of time during a 1-month period (or less if successfully treated). At least one of these must be (1), (2), or (3):", items:["1. Delusions.","2. Hallucinations.","3. Disorganized speech (e.g., frequent derailment or incoherence).","4. Grossly disorganized or catatonic behavior.","5. Negative symptoms (i.e., diminished emotional expression or avolition)."]},
      {id:"B", text:"For a significant portion of the time since the onset of the disturbance, level of functioning in one or more major areas (work, interpersonal relations, or self-care) is markedly below the level achieved prior to the onset."},
      {id:"C", text:"Continuous signs of the disturbance persist for at least 6 months, including at least 1 month of symptoms meeting Criterion A (active-phase symptoms) and may include periods of prodromal or residual symptoms."},
      {id:"D", text:"Schizoaffective disorder and depressive or bipolar disorder with psychotic features have been ruled out."},
      {id:"E", text:"The disturbance is not attributable to the physiological effects of a substance or another medical condition."},
      {id:"F", text:"If there is a history of autism spectrum disorder or a communication disorder of childhood onset, the additional diagnosis of schizophrenia is made only if prominent delusions or hallucinations are also present for at least 1 month."}
    ],
    specifiers: ["First episode, currently in acute episode","First episode, currently in partial remission","First episode, currently in full remission","Multiple episodes, currently in acute episode","Multiple episodes, currently in partial remission","Multiple episodes, currently in full remission","Continuous","Unspecified","With catatonia"],
    severity: [],
    codingNote: "Severity rated on a 5-point scale for each of the 5 primary symptoms (Clinician-Rated Dimensions of Psychosis Symptom Severity)."
  },
    interventions: {
    pharma: [
      {name:'Second-gen antipsychotics', target:['VTA','NAcc','THAL','BLA'], mechanism:'D2/5-HT2A antagonism. Reduces mesolimbic dopamine → positive symptom control.', evidence:'A', cite:'Leucht et al. 2013 Lancet 382(9896):951-62'},
      {name:'Clozapine (treatment-resistant)', target:['VTA','NAcc','dlPFC','THAL'], mechanism:'Broad receptor profile. Only drug proven effective in treatment-resistant schizophrenia.', evidence:'A', cite:'Kane et al. 1988 Arch Gen Psychiatry 45(9):789-96'},
      {name:'Long-acting injectables', target:['VTA','NAcc'], mechanism:'Same mechanism, improved adherence → relapse prevention', evidence:'A', cite:'Kishimoto et al. 2014 J Clin Psychiatry 75(11):1279-90'},
    
      {name:"Clozapine (treatment-resistant)", target:["VTA","D2","5HT","GABA_GLU"], mechanism:"Gold standard for treatment-resistant. Unique 5HT2A/D4 profile. Reduces suicidality.", evidence:"A", cite:"Kane et al. 1988 Arch Gen Psychiatry 45(9):789-96; Meltzer 2012"},
    ],
    therapy: [
      {name:'CBT for Psychosis', target:['dlPFC','mPFC','SN'], mechanism:'Reality testing, belief updating, coping with hallucinations', evidence:'A', cite:'Turner et al. 2014 Lancet Psychiatry 1(3):211-9'},
      {name:'Family Psychoeducation', target:['OXY','VV'], mechanism:'Reduces expressed emotion → prevents relapse. Social circuit support.', evidence:'A', cite:'Pharoah et al. 2010 Cochrane Database Syst Rev'},
      {name:'Social Skills Training', target:['STS','TPJ','dlPFC'], mechanism:'Compensatory social cognition training', evidence:'A', cite:'Kurtz & Mueser 2008 J Consult Clin Psychol 76(3):491-504'},
      {name:'Cognitive Remediation', target:['dlPFC','HIPP','dACC'], mechanism:'Computerized cognitive training targeting executive function deficits', evidence:'A', cite:'Wykes et al. 2011 Am J Psychiatry 168(5):472-85'},
    ],
    somatic: [
      {name:'Exercise', target:['BDNF','HIPP','VTA','dlPFC'], mechanism:'Hippocampal volume increase, cognitive improvement, symptom reduction', evidence:'A', cite:'Firth et al. 2017 Schizophr Bull 43(3):546-56'},
    ],
    nutrition: [
      {name:'Omega-3 (prevention)', target:['BDNF','mPFC'], mechanism:'Ultra-high risk: may delay/prevent transition to psychosis', evidence:'B', cite:'Amminger et al. 2010 Arch Gen Psychiatry 67(2):146-54'},
      {name:'Folate + B12', target:['mPFC','HIPP'], mechanism:'Methylation support. Negative symptom improvement in some trials.', evidence:'B', cite:'Roffman et al. 2013 JAMA Psychiatry 70(5):481-9'},
    
      {name:"Glycine (30-60g/day) or Sarcosine", target:["GABA_GLU","dlPFC","HIPP"], mechanism:"NMDA co-agonist. Addresses glutamatergic hypofunction hypothesis. Improves negative symptoms.", evidence:"B", cite:"Javitt et al. 2001 Am J Psychiatry 158(9):1531-3"},
      {name:"High-dose Omega-3 (EPA 2-4g)", target:["BDNF","mPFC","AI"], mechanism:"Anti-inflammatory, neuroprotective. Most effective in early/prodromal psychosis.", evidence:"B", cite:"Amminger et al. 2010 Arch Gen Psychiatry 67(2):146-54"},
    ],
    supplements: [
      {name:'NAC (2000mg)', target:['GABA_GLU','dlPFC','mPFC'], mechanism:'Glutamate modulation. Negative symptom improvement.', evidence:'B', cite:'Berk et al. 2008 Biol Psychiatry 64(5):361-8'},
      {name:'Vitamin D', target:['RAPHE','HIPP'], mechanism:'Deficiency common. Neurodevelopmental relevance.', evidence:'C', cite:'Valipour et al. 2014 J Clin Endocrinol Metab 99(6):E1061-71'},
    ]
  },
  metabolic: [
    {factor:'Metabolic syndrome', relevance:'Prevalence ~40% in schizophrenia populations. Reduces life expectancy by 15\u201320 years. Insulin resistance impairs prefrontal dopaminergic function, worsening negative and cognitive symptoms.', screen:'Fasting glucose, HbA1c, lipid panel, waist circumference, blood pressure at baseline and quarterly'},
    {factor:'Antipsychotic-induced diabetes risk', relevance:'Second-generation antipsychotics (especially clozapine, olanzapine) directly impair pancreatic beta-cell function and promote insulin resistance. Risk highest in first 6 months of treatment.', screen:'Fasting glucose, HbA1c at baseline, 3 months, then annually; fasting insulin if glucose borderline'},
    {factor:'Mitochondrial dysfunction', relevance:'Impaired mitochondrial oxidative phosphorylation reduces ATP availability for energy-intensive prefrontal circuits, contributing to cognitive deficits and negative symptoms.', screen:'Lactate, pyruvate; CoQ10 levels; consider organic acids panel if mitochondrial dysfunction suspected'}
  ]
},

// ─────────────────────────────────────────────────
// EATING DISORDERS
// ─────────────────────────────────────────────────

'AN': {
  name: 'Anorexia Nervosa',
  dsm5: '307.1 (F50.0x)',
  prevalence: '~0.3-0.4% (lifetime). Highest mortality of any psychiatric disorder.',
  summary: 'Insula interoception disrupted — cannot accurately read hunger/satiety signals. OFC value computation distorted — food undervalued. Body schema (somatosensory/parietal) distorted. Reward circuit paradoxically activated by restriction. Hyperactive habit system.',
  circuits: [
    {node:'AI',     dir:'hypo', detail:'Interoceptive awareness impaired → cannot feel hunger accurately', evidence:'A', cite:'Nunn et al. 2011 Eur Eat Disord Rev 19(6):462-74'},
    {node:'OFC',    dir:'altered', detail:'Food value computation distorted → restriction overvalued', evidence:'A', cite:'Steinglass et al. 2015 Neurosci Biobehav Rev 55:455-74'},
    {node:'STRI',   dir:'hyper', detail:'Habit-driven restriction. Compulsive exercise.', evidence:'A', cite:'Godier & Park 2014 Front Psychol 5:199'},
    {node:'NAcc',   dir:'altered', detail:'Paradoxical reward from starvation/restriction → self-starvation maintained', evidence:'B', cite:'Frank et al. 2012 Int J Eat Disord 45(3):307-14'},
    {node:'S1',     dir:'altered', detail:'Body image distortion — somatosensory/parietal body schema', evidence:'B', cite:'Gaudio et al. 2014 Psychiatry Res 224(3):157-61'},
    {node:'dlPFC',  dir:'hyper', detail:'Excessive cognitive control over eating behavior', evidence:'B', cite:'Brooks et al. 2012 Am J Psychiatry 169(10):1046-54'},
    {node:'HYPO',   dir:'hypo', detail:'Hypothalamic appetite circuits suppressed. Leptin, ghrelin dysregulated.', evidence:'A', cite:'Kaye et al. 2013 Physiol Behav 121:28-33'},
    {node:'HPA',    dir:'hyper', detail:'Cortisol elevated from starvation stress', evidence:'A', cite:'Schorr & Miller 2017 Nat Rev Endocrinol 13(3):174-86'},
    {node:'RAPHE',  dir:'altered', detail:'Serotonergic dysregulation. Premorbid anxiety trait. Persists after recovery.', evidence:'A', cite:'Kaye et al. 2009 Ann NY Acad Sci 1148:338-48'},
    {node:'DMN',    dir:'hyper', detail:'Ruminative self-referential processing (body image, food rules)', evidence:'B', cite:'McFadden et al. 2014 Psychiatry Res 221(1):76-83'},
  ],
  criteria: {
    title: "Diagnostic Criteria 307.1 (F50.01/F50.02)",
    sections: [
      {id:"A", text:"Restriction of energy intake relative to requirements, leading to a significantly low body weight in the context of age, sex, developmental trajectory, and physical health."},
      {id:"B", text:"Intense fear of gaining weight or of becoming fat, or persistent behavior that interferes with weight gain, even though at a significantly low weight."},
      {id:"C", text:"Disturbance in the way in which one's body weight or shape is experienced, undue influence of body weight or shape on self-evaluation, or persistent lack of recognition of the seriousness of the current low body weight."}
    ],
    specifiers: ["Restricting type (F50.01)","Binge-eating/purging type (F50.02)"],
    severity: ["Mild (BMI ≥ 17)","Moderate (BMI 16-16.99)","Severe (BMI 15-15.99)","Extreme (BMI < 15)"],
    codingNote: "In partial remission or in full remission may be specified. Severity based on BMI for adults; corresponding BMI percentiles for children and adolescents."
  },
    interventions: {
    pharma: [
      {name:'Olanzapine (low dose)', target:['VTA','NAcc','HYPO','BLA'], mechanism:'Weight gain facilitation, anxiety reduction, appetite stimulation. Best pharma evidence for AN.', evidence:'A', cite:'Attia et al. 2019 Am J Psychiatry 176(6):449-56'},
      {name:'SSRIs (post-weight restoration)', target:['RAPHE','OFC','BLA'], mechanism:'Relapse prevention AFTER weight restored. Ineffective during starvation (serotonin requires tryptophan).', evidence:'B', cite:'Kaye et al. 2001 Am J Psychiatry 158(11):1796-801'},
    ],
    therapy: [
      {name:'FBT (Family-Based Treatment — adolescents)', target:['OXY','VV','HYPO','dlPFC'], mechanism:'Parents direct refeeding. Externalizes illness. Gold standard for adolescent AN.', evidence:'A', cite:'Lock et al. 2010 Arch Gen Psychiatry 67(10):1025-32'},
      {name:'CBT-E (Enhanced CBT for Eating Disorders)', target:['dlPFC','OFC','AI','mPFC'], mechanism:'Addresses overvaluation of shape/weight (OFC), dietary rules (dlPFC), self-evaluation (mPFC)', evidence:'A', cite:'Fairburn et al. 2009 Behav Res Ther 47(6):520-4'},
      {name:'MANTRA (Maudsley Model)', target:['mPFC','STRI','AI'], mechanism:'Addresses thinking style (cognitive rigidity), emotional processing, identity', evidence:'B', cite:'Schmidt et al. 2015 Lancet Psychiatry 2(7):629-36'},
    ],
    somatic: [
      {name:'Yoga (gentle, post-stabilization)', target:['AI','S1','VV'], mechanism:'Interoceptive reconnection. Body acceptance. Only when medically stable.', evidence:'C', cite:'Carei et al. 2010 J Adolesc Health 46(4):346-51'},
    ],
    nutrition: [
      {name:'Zinc (14mg/day)', target:['HYPO','RAPHE'], mechanism:'Taste restoration, appetite stimulation. Deficiency universal in AN.', evidence:'B', cite:'Birmingham & Gritzner 2006 Eat Weight Disord 11(4):e109-11'},
      {name:'Phosphate/electrolyte monitoring', target:['HYPO','cardiac'], mechanism:'CRITICAL: refeeding syndrome prevention. Can be fatal.', evidence:'A', cite:'Mehanna et al. 2008 BMJ 336(7659):1495-8'},
      {name:'Structured meal plan', target:['HYPO','STRI','OFC'], mechanism:'Externalizes food decisions from distorted value computation', evidence:'A', cite:'Clinical consensus'},
    ],
    supplements: [
      {name:'Multivitamin + mineral', target:['BDNF','HPA'], mechanism:'Deficiency correction across multiple micronutrients', evidence:'A', cite:'Clinical standard of care'},
    ]
  }
},

// ─────────────────────────────────────────────────
// ANXIETY DISORDERS (continued)
// ─────────────────────────────────────────────────

'PANIC': {
  name: 'Panic Disorder',
  dsm5: '300.01 (F41.0)',
  prevalence: '~2.7% US adults annually (NIMH)',
  summary: 'Catastrophic misinterpretation of interoceptive signals. Anterior insula amplifies body sensations, amygdala fires false alarm, PAG triggers acute defense cascade. Locus coeruleus norepinephrine surge produces sympathetic storm. Suffocation false alarm model (Klein 1993).',
  circuits: [
    {node:'AI',     dir:'hyper', detail:'Interoceptive prediction errors — normal body signals read as life-threatening', evidence:'A', cite:'Paulus & Stein 2006 Biol Psychiatry 60(4):383-7'},
    {node:'BLA',    dir:'hyper', detail:'False alarm activation — triggers full fear cascade from benign interoceptive input', evidence:'A', cite:'Gorman et al. 2000 Am J Psychiatry 157(4):493-505'},
    {node:'CeA',    dir:'hyper', detail:'Autonomic fear output amplified — HR surge, breathing changes, sweating', evidence:'A', cite:'Gorman et al. 2000 Am J Psychiatry 157(4):493-505'},
    {node:'PAG',    dir:'hyper', detail:'Acute defense cascade — freeze, flight, faint. Panic as brainstem defense activation.', evidence:'B', cite:'Del-Ben & Graeff 2009 Neurosci Biobehav Rev 33(4):532-43'},
    {node:'LC',     dir:'hyper', detail:'Norepinephrine surge → sympathetic storm → tachycardia, tremor, hyperventilation', evidence:'A', cite:'Coplan & Lydiard 1998 Biol Psychiatry 44(12):1264-76'},
    {node:'PBN',    dir:'hyper', detail:'Parabrachial CO2/suffocation chemosensitivity elevated → air hunger', evidence:'B', cite:'Klein 1993 Arch Gen Psychiatry 50(4):306-17'},
    {node:'vmPFC',  dir:'hypo', detail:'Failed safety signal — cannot regulate amygdala false alarm', evidence:'A', cite:'Rauch et al. 2003 Psychiatry Res 124(2):69-78'},
    {node:'SNS',    dir:'hyper', detail:'Sympathetic dominance during attack', evidence:'A', cite:'Friedman & Thayer 1998 J Anxiety Disord 12(6):551-71'},
    {node:'NTS',    dir:'hyper', detail:'Autonomic relay overloaded with interoceptive alarm signals', evidence:'B', cite:'Gorman et al. 2000'},
    {node:'dACC',   dir:'hyper', detail:'Threat anticipation between attacks → anticipatory anxiety', evidence:'B', cite:'Sakai et al. 2005 J Affect Disord 86(2-3):151-60'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.01 (F41.0)",
    sections: [
      {id:"A", text:"Recurrent unexpected panic attacks. A panic attack is an abrupt surge of intense fear or intense discomfort that reaches a peak within minutes, and during which time 4 (or more) of the following symptoms occur:", items:["1. Palpitations, pounding heart, or accelerated heart rate.","2. Sweating.","3. Trembling or shaking.","4. Sensations of shortness of breath or smothering.","5. Feelings of choking.","6. Chest pain or discomfort.","7. Nausea or abdominal distress.","8. Feeling dizzy, unsteady, light-headed, or faint.","9. Chills or heat sensations.","10. Paresthesias (numbness or tingling sensations).","11. Derealization or depersonalization.","12. Fear of losing control or \"going crazy.\"","13. Fear of dying."]},
      {id:"B", text:"At least one of the attacks has been followed by 1 month (or more) of one or both of the following: (1) Persistent concern or worry about additional panic attacks or their consequences. (2) A significant maladaptive change in behavior related to the attacks."},
      {id:"C", text:"The disturbance is not attributable to the physiological effects of a substance or another medical condition."},
      {id:"D", text:"The disturbance is not better explained by another mental disorder."}
    ],
    specifiers: [],
    severity: [],
    codingNote: "Panic attacks can occur in the context of any mental disorder as well as some medical conditions. Panic attack specifier can be applied to any DSM-5 disorder."
  },
    interventions: {
    pharma: [
      {name:'SSRIs', target:['RAPHE','BLA','AI'], mechanism:'First-line. Serotonergic damping of panic circuitry.', evidence:'A', cite:'Andrisano et al. 2013 J Psychopharmacol 27(8):733-42'},
      {name:'SNRIs (venlafaxine)', target:['RAPHE','LC','BLA'], mechanism:'Dual serotonin + norepinephrine modulation', evidence:'A', cite:'Bradwejn et al. 2005 J Clin Psychiatry 66(11):1379-86'},
      {name:'Benzodiazepines (PRN/short-term)', target:['GABA_GLU','BLA','CeA'], mechanism:'Fast GABAergic inhibition of amygdala. Dependence risk limits long-term use.', evidence:'A', cite:'Nardi et al. 2012 Int Clin Psychopharmacol 27(6):307-14'},
    ],
    therapy: [
      {name:'CBT (interoceptive exposure)', target:['AI','BLA','vmPFC','dlPFC'], mechanism:'Gold standard. Interoceptive exposure habituates false alarm. Cognitive restructuring of catastrophic beliefs.', evidence:'A', cite:'Pompoli et al. 2016 Cochrane Database Syst Rev'},
      {name:'Panic-Focused Psychodynamic', target:['mPFC','BLA','AI'], mechanism:'Addresses unconscious conflict meanings of panic sensations', evidence:'B', cite:'Milrod et al. 2007 Am J Psychiatry 164(2):265-72'},
    ],
    somatic: [
      {name:'Breathing retraining (slow exhale)', target:['VV','NTS','SNS','PBN'], mechanism:'Vagal activation via prolonged exhale → parasympathetic counter to sympathetic storm', evidence:'A', cite:'Meuret et al. 2010 J Consult Clin Psychol 78(5):691-704'},
      {name:'Aerobic exercise', target:['LC','BDNF','HPA','AI'], mechanism:'Reduces panic sensitivity to CO2/lactate. Normalizes interoceptive calibration.', evidence:'A', cite:'Broman-Fulks et al. 2004 Behav Res Ther 42(3):257-68'},
    ],
    nutrition: [
      {name:'Magnesium', target:['GABA_GLU','SNS'], mechanism:'GABAergic support, sympathetic calming', evidence:'B', cite:'Boyle et al. 2017 Nutrients 9(5):429'},
      {name:'Caffeine elimination', target:['LC','SNS','AI'], mechanism:'Caffeine is panicogenic — adenosine antagonism amplifies LC firing', evidence:'A', cite:'Charney et al. 1985 Arch Gen Psychiatry 42(3):233-43'},
    ],
    supplements: [
      {name:'L-Theanine (200mg)', target:['GABA_GLU','AI','THETA'], mechanism:'Alpha wave promotion, GABAergic support, anxiolytic without sedation', evidence:'B', cite:'Hidese et al. 2019 Nutrients 11(10):2362'},
    ]
  },
  metabolic: [
    {factor:'Hyperthyroidism mimicry', relevance:'Thyroid hormone excess directly activates locus coeruleus and sympathetic nervous system \u2014 tachycardia, tremor, and sweating from hyperthyroidism are indistinguishable from panic attacks.', screen:'TSH, free T4; thyroid antibodies if autoimmune suspected'},
    {factor:'Hypoglycemia-induced panic', relevance:'Reactive hypoglycemia triggers counter-regulatory adrenergic surge identical to panic cascade \u2014 epinephrine release via sympathetic activation produces tachycardia, diaphoresis, and air hunger.', screen:'Fasting glucose, HbA1c; consider 2-hour postprandial glucose if attacks cluster after meals'},
    {factor:'Adrenal dysregulation', relevance:'Pheochromocytoma and adrenal hyperplasia produce episodic catecholamine surges mimicking panic attacks. Subclinical cortisol dysregulation sensitizes parabrachial CO2 chemosensors.', screen:'Morning cortisol, DHEA-S; 24-hour urine catecholamines/metanephrines if episodic hypertension'}
  ]
},

'SAD': {
  name: 'Social Anxiety Disorder',
  dsm5: '300.23 (F40.10)',
  prevalence: '~7.1% US adults annually (NIMH)',
  summary: 'Amygdala hyperreactive to social evaluation cues. mPFC self-referential processing shifts to negative self-monitoring. STS overprocesses social signals as threatening. Anterior insula amplifies social pain.',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Exaggerated threat response to faces, especially angry/contemptuous expressions', evidence:'A', cite:'Phan et al. 2006 Am J Psychiatry 163(10):1735-7'},
    {node:'mPFC',   dir:'hyper', detail:'Excessive self-referential processing during social situations — "How do I look? What do they think?"', evidence:'A', cite:'Blair et al. 2008 Biol Psychiatry 63(9):891-7'},
    {node:'AI',     dir:'hyper', detail:'Social pain amplification. Blushing awareness. Interoceptive self-consciousness.', evidence:'A', cite:'Etkin & Wager 2007 Am J Psychiatry 164(10):1476-88'},
    {node:'STS',    dir:'hyper', detail:'Social perception in overdrive — reads threat in neutral faces', evidence:'B', cite:'Gentili et al. 2008 J Psychiatry Neurosci 33(5):417-24'},
    {node:'dACC',   dir:'hyper', detail:'Error monitoring heightened in social performance contexts', evidence:'A', cite:'Amir et al. 2005 Biol Psychiatry 57(10):1209-12'},
    {node:'vmPFC',  dir:'hypo', detail:'Failed social safety signal — cannot down-regulate social threat', evidence:'B', cite:'Bruhl et al. 2014 Biol Psychiatry 75(5):337-44'},
    {node:'STRI',   dir:'hypo', detail:'Social reward signal blunted — avoidance wins over approach', evidence:'B', cite:'Richey et al. 2017 Mol Psychiatry 22(3):481-6'},
    {node:'TPJ',    dir:'hyper', detail:'Excessive perspective-taking — "everyone is judging me"', evidence:'B', cite:'Bruhl et al. 2014 Biol Psychiatry 75(5):337-44'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.23 (F40.10)",
    sections: [
      {id:"A", text:"Marked fear or anxiety about one or more social situations in which the individual is exposed to possible scrutiny by others (e.g., social interactions, being observed, performing in front of others)."},
      {id:"B", text:"The individual fears that he or she will act in a way or show anxiety symptoms that will be negatively evaluated."},
      {id:"C", text:"The social situations almost always provoke fear or anxiety."},
      {id:"D", text:"The social situations are avoided or endured with intense fear or anxiety."},
      {id:"E", text:"The fear or anxiety is out of proportion to the actual threat posed by the social situation and to the sociocultural context."},
      {id:"F", text:"The fear, anxiety, or avoidance is persistent, typically lasting for 6 months or more."},
      {id:"G", text:"The fear, anxiety, or avoidance causes clinically significant distress or impairment."},
      {id:"H", text:"The fear, anxiety, or avoidance is not attributable to the physiological effects of a substance or another medical condition."},
      {id:"I", text:"The fear, anxiety, or avoidance is not better explained by the symptoms of another mental disorder."},
      {id:"J", text:"If another medical condition is present, the fear, anxiety, or avoidance is clearly unrelated or is excessive."}
    ],
    specifiers: ["Performance only"],
    severity: [],
    codingNote: "Specify if performance only: if the fear is restricted to speaking or performing in public."
  },
    interventions: {
    pharma: [
      {name:'SSRIs/SNRIs', target:['RAPHE','BLA','mPFC'], mechanism:'First-line. Reduces amygdala reactivity and ruminative self-focus.', evidence:'A', cite:'Mayo-Wilson et al. 2014 Lancet Psychiatry 1(5):368-76'},
      {name:'Propranolol (performance-only)', target:['SNS','LC'], mechanism:'Beta-blocker for performance anxiety — blocks peripheral sympathetic symptoms', evidence:'B', cite:'Steenen et al. 2016 J Psychopharmacol 30(2):128-39'},
      {name:'D-Cycloserine (augmentation)', target:['BLA','GABA_GLU'], mechanism:'NMDA partial agonist given before exposure sessions → enhances extinction learning', evidence:'B', cite:'Hofmann et al. 2006 Arch Gen Psychiatry 63(3):298-304'},
    ],
    therapy: [
      {name:'CBT (exposure + cognitive restructuring)', target:['dlPFC','vmPFC','BLA','mPFC'], mechanism:'Gold standard. Behavioral experiments challenge safety behaviors. Exposure habituates amygdala.', evidence:'A', cite:'Mayo-Wilson et al. 2014 Lancet Psychiatry 1(5):368-76'},
      {name:'ACT', target:['mPFC','AI','PCC'], mechanism:'Defusion from self-evaluative thoughts. Values-directed social engagement.', evidence:'B', cite:'Craske et al. 2014 Behav Res Ther 58:10-23'},
    ],
    somatic: [
      {name:'Exercise', target:['BDNF','VTA','HPA'], mechanism:'Reduces anxiety sensitivity, builds distress tolerance', evidence:'B', cite:'Jazaieri et al. 2012 Cognitive Behav Ther 41(4):261-74'},
    ],
    nutrition: [
      {name:'L-Theanine', target:['GABA_GLU','AI'], mechanism:'Promotes calm alertness without sedation', evidence:'B', cite:'Hidese et al. 2019 Nutrients 11(10):2362'},
      {name:'Magnesium', target:['GABA_GLU','HPA'], mechanism:'GABAergic support', evidence:'B', cite:'Boyle et al. 2017 Nutrients 9(5):429'},
    ],
    supplements: [
      {name:'Lavender oil (Silexan 80mg)', target:['BLA','SNS'], mechanism:'Calcium channel modulation. Anxiolytic without sedation.', evidence:'A', cite:'Kasper et al. 2014 Int J Neuropsychopharmacol 17(6):859-69'},
    ]
  },
  metabolic: [
    {factor:'Hyperthyroidism mimicry', relevance:'Thyroid excess amplifies sympathetic arousal in social contexts \u2014 blushing, tremor, and tachycardia are worsened by hyperthyroid state, reinforcing avoidance behaviors.', screen:'TSH, free T4; thyroid antibodies if autoimmune suspected'},
    {factor:'Hypoglycemia-induced anxiety', relevance:'Blood glucose instability amplifies anterior insula interoceptive signals and locus coeruleus arousal, lowering the threshold for social anxiety symptom activation.', screen:'Fasting glucose, HbA1c; consider continuous glucose monitoring if symptoms correlate with meals'},
    {factor:'Adrenal dysregulation', relevance:'Chronic cortisol elevation from social evaluative stress sensitizes amygdala threat detection circuits and impairs prefrontal regulatory capacity over social fear responses.', screen:'Morning cortisol, DHEA-S; consider 4-point salivary cortisol'}
  ]
},

'SPECIFIC_PHOBIA': {
  name: 'Specific Phobia',
  dsm5: '300.29 (F40.xxx)',
  prevalence: '~9.1% US adults (NIMH). Most common anxiety disorder.',
  summary: 'Amygdala-conditioned fear response to specific stimulus. Classical fear conditioning with failed extinction. PFC regulation capacity intact in non-phobic contexts — problem is stimulus-specific.',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Conditioned fear association — specific stimulus → full fear response', evidence:'A', cite:'Etkin & Wager 2007 Am J Psychiatry 164(10):1476-88'},
    {node:'CeA',    dir:'hyper', detail:'Autonomic fear output to phobic stimulus', evidence:'A', cite:'LeDoux 2000 Annu Rev Neurosci 23:155-84'},
    {node:'vmPFC',  dir:'hypo', detail:'Extinction recall fails for the specific stimulus', evidence:'A', cite:'Milad et al. 2007 Neuron 55(5):861-7'},
    {node:'AI',     dir:'hyper', detail:'Disgust component (blood-injection-injury, animal phobias)', evidence:'B', cite:'Caseras et al. 2010 Biol Psychiatry 68(3):201-8'},
    {node:'THAL',   dir:'hyper', detail:'Subcortical fast path: thalamus → amygdala (bypasses cortex). 12ms fear response.', evidence:'A', cite:'LeDoux 1996 The Emotional Brain'},
    {node:'PAG',    dir:'hyper', detail:'Freeze response (blood-injection → vasovagal syncope via PAG→dorsal vagal)', evidence:'B', cite:'Mobbs et al. 2007 Science 317(5841):1079-83'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.29 (F40.xxx)",
    sections: [
      {id:"A", text:"Marked fear or anxiety about a specific object or situation (e.g., flying, heights, animals, receiving an injection, seeing blood)."},
      {id:"B", text:"The phobic object or situation almost always provokes immediate fear or anxiety."},
      {id:"C", text:"The phobic object or situation is actively avoided or endured with intense fear or anxiety."},
      {id:"D", text:"The fear or anxiety is out of proportion to the actual danger posed by the specific object or situation and to the sociocultural context."},
      {id:"E", text:"The fear, anxiety, or avoidance is persistent, typically lasting for 6 months or more."},
      {id:"F", text:"The fear, anxiety, or avoidance causes clinically significant distress or impairment."},
      {id:"G", text:"The disturbance is not better explained by the symptoms of another mental disorder."}
    ],
    specifiers: ["Animal (F40.218)","Natural environment (F40.228)","Blood-injection-injury (F40.230/231/232/233)","Situational (F40.248)","Other (F40.298)"],
    severity: [],
    codingNote: "Code based on the phobic stimulus. Multiple specific phobia diagnoses can be given."
  },
    interventions: {
    pharma: [
      {name:'D-Cycloserine (exposure augment)', target:['BLA','GABA_GLU'], mechanism:'NMDA partial agonist pre-exposure → enhanced extinction consolidation', evidence:'A', cite:'Ressler et al. 2004 Arch Gen Psychiatry 61(11):1136-44'},
      {name:'Propranolol (reconsolidation)', target:['BLA','LC'], mechanism:'Beta-blocker during reactivation → weakens reconsolidated fear memory', evidence:'B', cite:'Kindt et al. 2009 Nat Neurosci 12(3):256-8'},
    ],
    therapy: [
      {name:'Exposure therapy (in vivo)', target:['BLA','vmPFC','CeA'], mechanism:'Gold standard. Graduated exposure creates new inhibitory extinction memory.', evidence:'A', cite:'Wolitzky-Taylor et al. 2008 Clin Psychol Rev 28(6):1021-37'},
      {name:'VRET (Virtual Reality Exposure)', target:['BLA','vmPFC','V1'], mechanism:'Simulated exposure environment. Equivalent efficacy to in vivo for many phobias.', evidence:'A', cite:'Carl et al. 2019 J Anxiety Disord 61:27-36'},
      {name:'Applied tension (blood-injection)', target:['SNS','PAG','DV'], mechanism:'Muscle tension prevents vasovagal syncope during blood/needle exposure', evidence:'A', cite:'Öst et al. 1991 Behav Res Ther 29(6):561-74'},
    ],
    somatic: [
      {name:"Virtual Reality Exposure Therapy", target:["BLA","vmPFC","AI"], mechanism:"Graded VR exposure activates extinction learning without real-world risk", evidence:"A", cite:"Carl et al. 2019 J Anxiety Disord 61:27-36"},
      {name:"Applied Tension (blood-injection type)", target:["VV","SNS","PAG"], mechanism:"Counters vasovagal syncope response specific to blood-injury phobia", evidence:"A", cite:"Öst et al. 1991 Behav Res Ther 29(6):561-74"}
    ],
    nutrition: [
      {name:"L-Theanine (200mg pre-exposure)", target:["GABA_GLU","dACC"], mechanism:"Anxiolytic support during exposure sessions without sedation", evidence:"C", cite:"Hidese et al. 2019"}
    ],
    supplements: []
  }
},

// ─────────────────────────────────────────────────
// TRAUMA AND STRESSOR-RELATED (continued)
// ─────────────────────────────────────────────────

'CPTSD': {
  name: 'Complex PTSD',
  dsm5: 'Not in DSM-5 (ICD-11: 6B41). Widely used clinically.',
  prevalence: '~1-8% general population (variable by study)',
  summary: 'PTSD circuit signature PLUS developmental impact on self-organization. Prolonged/repeated interpersonal trauma (childhood abuse, captivity, trafficking) produces additional disturbances: affect dysregulation, negative self-concept, relational disturbances. DMN narrative identity fundamentally altered during development.',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Chronic threat detection — interpersonal cues trigger full fear response', evidence:'A', cite:'Teicher & Samson 2016 Nat Rev Neurosci 17(10):652-66'},
    {node:'vmPFC',  dir:'hypo', detail:'Regulatory capacity never fully developed — childhood trauma during PFC maturation window', evidence:'A', cite:'Teicher & Samson 2016 Nat Rev Neurosci 17(10):652-66'},
    {node:'mPFC',   dir:'altered', detail:'Self-concept distorted at developmental level — "I am broken/worthless" wired into DMN baseline', evidence:'A', cite:'van der Kolk 2014 The Body Keeps the Score'},
    {node:'HIPP',   dir:'hypo', detail:'Volume reduced by childhood adversity. Contextual memory impaired.', evidence:'A', cite:'Teicher et al. 2012 Neuropsychopharmacology 37(3):773-92'},
    {node:'AI',     dir:'altered', detail:'Interoception dysregulated — either hyper-aware or disconnected from body', evidence:'A', cite:'Nicholson et al. 2017 Psychol Med 47(8):1324-33'},
    {node:'OXY',    dir:'altered', detail:'Attachment system damaged — oxytocin response paradoxical in insecure attachment', evidence:'A', cite:'Bartz et al. 2011 Psychoneuroendocrinology 36(8):1219-28'},
    {node:'VV',     dir:'hypo', detail:'Ventral vagal social engagement system underdeveloped — cannot co-regulate', evidence:'A', cite:'Porges 2011 Polyvagal Theory'},
    {node:'DV',     dir:'hyper', detail:'Dorsal vagal shutdown dominant stress response — collapse, dissociation, freeze', evidence:'B', cite:'Porges 2011'},
    {node:'HPA',    dir:'altered', detail:'HPA programming altered by early adversity. Cortisol response flattened or paradoxical.', evidence:'A', cite:'Heim & Nemeroff 2001 Biol Psychiatry 49(12):1023-39'},
    {node:'PCC',    dir:'altered', detail:'Autobiographical coherence disrupted — fragmented life narrative', evidence:'B', cite:'Lanius et al. 2015 Eur J Psychotraumatol 6:27505'},
    {node:'PAG',    dir:'hyper', detail:'Chronic defensive posture — freeze/fawn/dissociate as default', evidence:'B', cite:'Kozlowska et al. 2015 Harv Rev Psychiatry 23(4):263-81'},
    {node:'ENDO',   dir:'hypo', detail:'Endocannabinoid system depleted from chronic stress', evidence:'B', cite:'Hill et al. 2010 Psychoneuroendocrinology 35(9):1363-7'},
    {node:'CCorp',  dir:'hypo', detail:'Corpus callosum volume reduced in childhood abuse — impaired interhemispheric integration', evidence:'A', cite:'Teicher et al. 2004 Biol Psychiatry 56(11):788-95'},
  ],
  criteria: {
    title: "ICD-11 Diagnostic Criteria 6B41 (Complex Post-Traumatic Stress Disorder)",
    sections: [
      {id:"PTSD", text:"All diagnostic requirements for PTSD are met (re-experiencing, avoidance, sense of current threat)."},
      {id:"DSO", text:"In addition, Complex PTSD is characterized by severe and persistent Disturbances in Self-Organization (DSO):", items:["1. Affect dysregulation: Problems in affect regulation, including heightened emotional reactivity, violent outbursts, reckless or self-destructive behavior, dissociation under stress, and emotional numbing.","2. Negative self-concept: Persistent beliefs about oneself as diminished, defeated, or worthless, accompanied by deep and pervasive feelings of shame, guilt, or failure.","3. Disturbances in relationships: Persistent difficulties in sustaining relationships and in feeling close to others. The person may consistently avoid, deride, or have little interest in relationships and social engagement, or may alternatively experience occasional intense relationships but have difficulty maintaining them."]},
      {id:"FUNC", text:"The disturbances cause significant impairment in personal, family, social, educational, occupational, or other important areas of functioning."}
    ],
    specifiers: [],
    severity: [],
    codingNote: "CPTSD is an ICD-11 diagnosis (6B41), not a DSM-5 diagnosis. It requires meeting full PTSD criteria plus Disturbances in Self-Organization. Typically associated with prolonged or repeated trauma from which escape is difficult (e.g., childhood abuse, domestic violence, torture)."
  },
    interventions: {
    pharma: [
      {name:'SSRIs', target:['RAPHE','BLA','vmPFC'], mechanism:'Baseline stabilization of serotonergic tone', evidence:'A', cite:'Hoskins et al. 2015 Psychol Med 45(12):2463-80'},
      {name:'Prazosin', target:['LC','SNS'], mechanism:'Nightmare reduction, hyperarousal management', evidence:'B', cite:'Raskind et al. 2013 Am J Psychiatry 170(9):1003-10'},
      {name:'MDMA-assisted therapy', target:['BLA','vmPFC','OXY','VV'], mechanism:'Enables trauma processing with reduced fear + enhanced attachment safety', evidence:'B', cite:'Mitchell et al. 2021 Nat Med 27(6):1025-33'},
    ],
    therapy: [
      {name:'Phase-based treatment (stabilize→process→integrate)', target:['vmPFC','BLA','mPFC','VV','OXY'], mechanism:'Standard of care. Must build regulatory capacity BEFORE trauma processing.', evidence:'A', cite:'Cloitre et al. 2010 Am J Psychiatry 167(8):915-24'},
      {name:'DBT', target:['vmPFC','BLA','AI','VV'], mechanism:'Distress tolerance and emotion regulation skills — addresses affect dysregulation', evidence:'A', cite:'Bohus et al. 2004 Behav Res Ther 42(5):487-99'},
      {name:'EMDR', target:['BLA','HIPP','vmPFC'], mechanism:'Trauma reprocessing after stabilization phase', evidence:'A', cite:'Cusack et al. 2016 Clin Psychol Rev 43:128-41'},
      {name:'IFS', target:['mPFC','BLA','vmPFC','PAG','DV'], mechanism:'Parts work — addresses self-fragmentation. Accesses exiled developmental trauma.', evidence:'C', cite:'Schwartz 2021; pilot RCTs in progress'},
      {name:'Somatic Experiencing', target:['PAG','DV','VV','AI','S1'], mechanism:'Bottom-up completion of frozen defensive responses', evidence:'C', cite:'Payne et al. 2015 Front Psychol 6:93'},
      {name:'Sensorimotor Psychotherapy', target:['S1','AI','PAG','VV','SMN'], mechanism:'Body-based processing of developmental trauma patterns', evidence:'C', cite:'Ogden et al. 2006 Trauma and the Body'},
    ],
    somatic: [
      {name:'Yoga (trauma-sensitive)', target:['VV','AI','S1','PAG'], mechanism:'Interoceptive reconditioning, vagal restoration, body ownership', evidence:'B', cite:'van der Kolk et al. 2014 J Clin Psychiatry 75(6):e559-65'},
      {name:'Neurofeedback', target:['mPFC','PCC','THETA'], mechanism:'DMN stabilization, affect regulation training', evidence:'B', cite:'van der Kolk et al. 2016 PLoS One 11(12):e0166752'},
      {name:'Safe co-regulation (therapeutic relationship)', target:['VV','OXY','NTS'], mechanism:'Ventral vagal activation through attuned relational presence — repairs attachment circuit', evidence:'B', cite:'Porges 2011; Schore 2012'},
    ],
    nutrition: [
      {name:'Anti-inflammatory diet', target:['GBA','AI','HPA'], mechanism:'Chronic trauma increases systemic inflammation → brain inflammation', evidence:'B', cite:'Dantzer et al. 2008 Nat Rev Neurosci 9(1):46-56'},
      {name:'Omega-3', target:['BDNF','BLA'], mechanism:'Anti-inflammatory, BDNF support', evidence:'B', cite:'Matsuoka et al. 2010 J Clin Psychopharmacol 30(2):217-9'},
    ],
    supplements: [
      {name:'NAC', target:['GABA_GLU','BLA'], mechanism:'Glutamate normalization, oxidative stress reduction', evidence:'C', cite:'Back et al. 2016 J Clin Psychiatry 77(11):e1439-46'},
    ]
  }
},

// ─────────────────────────────────────────────────
// EATING DISORDERS (continued)
// ─────────────────────────────────────────────────

'BN': {
  name: 'Bulimia Nervosa',
  dsm5: '307.51 (F50.2)',
  prevalence: '~0.3% (lifetime)',
  summary: 'Binge-purge cycle driven by impaired inhibitory control + reward circuit dysregulation. Unlike AN, dlPFC is hypoactive (cannot stop binge). OFC-striatal circuit oscillates between restriction (overcontrol) and binge (loss of control).',
  circuits: [
    {node:'dlPFC',  dir:'hypo', detail:'Impulse control impaired — cannot stop binge once initiated', evidence:'A', cite:'Marsh et al. 2009 Am J Psychiatry 166(10):1155-62'},
    {node:'NAcc',   dir:'hyper', detail:'Food reward amplified — binge as reward circuit hijack', evidence:'A', cite:'Frank et al. 2012 Int J Eat Disord 45(3):307-14'},
    {node:'OFC',    dir:'altered', detail:'Oscillates between overvaluing restriction and overvaluing food reward', evidence:'B', cite:'Kaye et al. 2013 Physiol Behav 121:28-33'},
    {node:'AI',     dir:'altered', detail:'Interoceptive signals unreliable — hunger/fullness/disgust distorted', evidence:'A', cite:'Frank et al. 2016 J Psychiatry Neurosci 41(5):304-11'},
    {node:'STRI',   dir:'hyper', detail:'Habit loop: restrict → binge → purge → shame → restrict', evidence:'B', cite:'Steinglass & Walsh 2006 Int J Eat Disord 39(4):267-75'},
    {node:'vmPFC',  dir:'hypo', detail:'Emotional eating — failed regulation of negative affect', evidence:'B', cite:'Balodis et al. 2013 Neurosci Biobehav Rev 37(2):279-99'},
    {node:'RAPHE',  dir:'altered', detail:'Serotonergic dysfunction — mood and satiety both affected', evidence:'A', cite:'Kaye et al. 2009 Ann NY Acad Sci 1148:338-48'},
    {node:'HPA',    dir:'altered', detail:'Cortisol elevated by purging and dietary chaos', evidence:'B', cite:'Monteleone et al. 2009 Psychol Med 39(2):295-304'},
  ],
  criteria: {
    title: "Diagnostic Criteria 307.51 (F50.2)",
    sections: [
      {id:"A", text:"Recurrent episodes of binge eating, characterized by both: (1) Eating, in a discrete period of time, an amount of food that is definitely larger than what most individuals would eat in a similar period of time under similar circumstances. (2) A sense of lack of control over eating during the episode."},
      {id:"B", text:"Recurrent inappropriate compensatory behaviors in order to prevent weight gain, such as self-induced vomiting; misuse of laxatives, diuretics, or other medications; fasting; or excessive exercise."},
      {id:"C", text:"The binge eating and inappropriate compensatory behaviors both occur, on average, at least once a week for 3 months."},
      {id:"D", text:"Self-evaluation is unduly influenced by body shape and weight."},
      {id:"E", text:"The disturbance does not occur exclusively during episodes of anorexia nervosa."}
    ],
    specifiers: ["In partial remission","In full remission"],
    severity: ["Mild (1-3 episodes/week)","Moderate (4-7 episodes/week)","Severe (8-13 episodes/week)","Extreme (14+ episodes/week)"],
    codingNote: "Severity based on frequency of inappropriate compensatory behaviors."
  },
    interventions: {
    pharma: [
      {name:'Fluoxetine (60mg)', target:['RAPHE','dlPFC','NAcc','OFC'], mechanism:'Only FDA-approved medication for BN. Reduces binge/purge frequency.', evidence:'A', cite:'Fluoxetine BN Collaborative Study Group 1992 Arch Gen Psychiatry 49(2):139-47'},
      {name:'Topiramate', target:['GABA_GLU','NAcc','AI'], mechanism:'Glutamate modulation, appetite reduction. Off-label but effective.', evidence:'A', cite:'Hoopes et al. 2003 J Clin Psychiatry 64(11):1335-41'},
    ],
    therapy: [
      {name:'CBT-E', target:['dlPFC','OFC','AI','mPFC'], mechanism:'Gold standard. Addresses dietary restraint, body image, mood-triggered eating.', evidence:'A', cite:'Fairburn et al. 2009 Behav Res Ther 47(6):520-4'},
      {name:'IPT (Interpersonal Therapy)', target:['OXY','mPFC','VV'], mechanism:'Addresses interpersonal triggers for binge episodes', evidence:'A', cite:'Agras et al. 2000 Arch Gen Psychiatry 57(5):459-66'},
      {name:'DBT adapted for ED', target:['vmPFC','AI','dlPFC'], mechanism:'Emotion regulation skills for binge-purge urges', evidence:'B', cite:'Safer et al. 2001 J Consult Clin Psychol 69(6):1061-5'},
    ],
    somatic: [
      {name:'Regular meal timing', target:['HYPO','STRI','OFC'], mechanism:'Breaks restriction-binge cycle by normalizing metabolic signals', evidence:'A', cite:'Clinical standard of care'},
    ],
    nutrition: [
      {name:'Electrolyte monitoring', target:['cardiac','HYPO'], mechanism:'CRITICAL: purging depletes potassium → cardiac arrhythmia risk', evidence:'A', cite:'Mehler 2011 Int J Eat Disord 44(3):203-11'},
      {name:'Balanced macronutrients', target:['HYPO','RAPHE','STRI'], mechanism:'Adequate carbohydrate for serotonin synthesis. Adequate protein for satiety.', evidence:'B', cite:'Kaye et al. 2009'},
    ],
    supplements: []
  }
},

'BED': {
  name: 'Binge Eating Disorder',
  dsm5: '307.51 (F50.81)',
  prevalence: '~2.8% US adults (NIMH). Most common eating disorder.',
  summary: 'Reward circuit dominates inhibitory control. Like SUD for food — compulsive consumption despite distress. Unlike BN, no compensatory purging. Striatal habit system overrides frontal control.',
  circuits: [
    {node:'NAcc',   dir:'hyper', detail:'Food reward signal amplified. Palatable food triggers dopamine surge.', evidence:'A', cite:'Wang et al. 2011 Obesity 19(8):1601-8'},
    {node:'dlPFC',  dir:'hypo', detail:'Inhibitory control deficit — cannot stop binge', evidence:'A', cite:'Balodis et al. 2013 Neurosci Biobehav Rev 37(2):279-99'},
    {node:'OFC',    dir:'hyper', detail:'Food cue reactivity — sight/smell triggers craving', evidence:'A', cite:'Schienle et al. 2009 Biol Psychiatry 65(8):654-61'},
    {node:'AI',     dir:'altered', detail:'Interoceptive confusion — emotional states misread as hunger', evidence:'B', cite:'Simmons et al. 2016 Neurosci Biobehav Rev 63:223-38'},
    {node:'STRI',   dir:'hyper', detail:'Habitual overeating circuit — putamen-driven automatic eating', evidence:'B', cite:'Voon et al. 2015 Mol Psychiatry 20(3):345-52'},
    {node:'vmPFC',  dir:'hypo', detail:'Emotional eating — negative affect → binge as regulation strategy', evidence:'B', cite:'Balodis et al. 2013'},
    {node:'VTA',    dir:'altered', detail:'Dopaminergic sensitization to food cues', evidence:'A', cite:'Gearhardt et al. 2011 Am J Clin Nutr 94(1):12-8'},
  ],
  criteria: {
    title: "Diagnostic Criteria 307.51 (F50.81)",
    sections: [
      {id:"A", text:"Recurrent episodes of binge eating, characterized by both: (1) Eating, in a discrete period of time, an amount of food that is definitely larger than what most individuals would eat in a similar period of time under similar circumstances. (2) A sense of lack of control over eating during the episode."},
      {id:"B", text:"The binge-eating episodes are associated with 3 (or more) of the following:", items:["1. Eating much more rapidly than normal.","2. Eating until feeling uncomfortably full.","3. Eating large amounts of food when not feeling physically hungry.","4. Eating alone because of feeling embarrassed by how much one is eating.","5. Feeling disgusted with oneself, depressed, or very guilty afterward."]},
      {id:"C", text:"Marked distress regarding binge eating is present."},
      {id:"D", text:"The binge eating occurs, on average, at least once a week for 3 months."},
      {id:"E", text:"The binge eating is not associated with the recurrent use of inappropriate compensatory behavior as in bulimia nervosa and does not occur exclusively during the course of bulimia nervosa or anorexia nervosa."}
    ],
    specifiers: ["In partial remission","In full remission"],
    severity: ["Mild (1-3 episodes/week)","Moderate (4-7 episodes/week)","Severe (8-13 episodes/week)","Extreme (14+ episodes/week)"],
    codingNote: "Severity based on frequency of binge eating episodes."
  },
    interventions: {
    pharma: [
      {name:'Lisdexamfetamine (Vyvanse)', target:['STRI','dlPFC','NAcc','VTA'], mechanism:'Only FDA-approved med for BED. Dopamine/NE reuptake inhibition → impulse control + reward normalization', evidence:'A', cite:'McElroy et al. 2016 JAMA Psychiatry 73(3):235-42'},
      {name:'Topiramate', target:['GABA_GLU','NAcc','AI'], mechanism:'Appetite reduction, glutamate modulation', evidence:'A', cite:'McElroy et al. 2007 Obesity 15(5):1154-62'},
    ],
    therapy: [
      {name:'CBT-E', target:['dlPFC','OFC','AI','mPFC'], mechanism:'Gold standard. Addresses triggers, mood eating, dietary patterns.', evidence:'A', cite:'Grilo et al. 2011 Biol Psychiatry 70(4):388-94'},
      {name:'IPT', target:['OXY','mPFC','VV'], mechanism:'Addresses interpersonal/emotional triggers', evidence:'A', cite:'Wilson et al. 2010 Arch Gen Psychiatry 67(1):94-101'},
    ],
    somatic: [
      {name:'Exercise (moderate, regular)', target:['VTA','BDNF','HPA','VV'], mechanism:'Alternative reward, mood regulation, body awareness', evidence:'B', cite:'Vancampfort et al. 2014 Psychiatry Res 220(1-2):56-63'},
    ],
    nutrition: [
      {name:'Structured meal plan', target:['HYPO','STRI','OFC'], mechanism:'Removes decision fatigue, normalizes eating patterns', evidence:'A', cite:'Clinical standard'},
      {name:'Adequate protein and fiber', target:['HYPO','AI'], mechanism:'Satiety signaling improvement', evidence:'B', cite:'Paddon-Jones et al. 2008 Am J Clin Nutr 87(5):1558S-61S'},
    ],
    supplements: [
      {name:'Chromium picolinate (600-1000mcg)', target:['HYPO','NAcc'], mechanism:'Insulin sensitization, carbohydrate craving reduction', evidence:'C', cite:'Brownley et al. 2013 Eat Behav 14(1):36-40'},
    ]
  }
},

// ─────────────────────────────────────────────────
// DEPRESSIVE DISORDERS (continued)
// ─────────────────────────────────────────────────

'PDD': {
  name: 'Persistent Depressive Disorder (Dysthymia)',
  dsm5: '300.4 (F34.1)',
  prevalence: '~1.5% US adults (NIMH)',
  summary: 'Chronic low-grade MDD circuit signature. DMN ruminative baseline is default — not episodic. Reward hypofunction is trait-like. HPA axis chronically but mildly elevated. The person has never known their brain without this configuration.',
  circuits: [
    {node:'mPFC',   dir:'hyper', detail:'Chronic ruminative self-referential processing — baseline not episodic', evidence:'A', cite:'Sheline et al. 2009 PNAS 106(6):1942-7'},
    {node:'PCC',    dir:'hyper', detail:'Locked coupling with mPFC. Trait-level DMN hyperconnectivity.', evidence:'B', cite:'Hamilton et al. 2015 Biol Psychiatry 78(4):224-30'},
    {node:'NAcc',   dir:'hypo', detail:'Chronic anhedonia — trait-level reward deficit', evidence:'B', cite:'Pizzagalli et al. 2009 Am J Psychiatry 166(6):702-10'},
    {node:'dlPFC',  dir:'hypo', detail:'Mild but persistent executive function reduction', evidence:'B', cite:'Koenigs & Grafman 2009'},
    {node:'HPA',    dir:'hyper', detail:'Subtle chronic cortisol elevation — not crisis-level but persistent', evidence:'B', cite:'Stetler & Miller 2011 Psychosom Med 73(2):114-26'},
    {node:'VV',     dir:'hypo', detail:'Low vagal tone as trait marker', evidence:'B', cite:'Rottenberg 2007 Biol Psychol 74(2):200-11'},
    {node:'RAPHE',  dir:'altered', detail:'Chronic serotonergic dysregulation', evidence:'B', cite:'Savitz & Drevets 2009'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.4 (F34.1) — Persistent Depressive Disorder (Dysthymia)",
    sections: [
      {id:"A", text:"Depressed mood for most of the day, for more days than not, as indicated either by subjective account or observation by others, for at least 2 years (1 year for children and adolescents)."},
      {id:"B", text:"Presence, while depressed, of 2 (or more) of the following:", items:["1. Poor appetite or overeating.","2. Insomnia or hypersomnia.","3. Low energy or fatigue.","4. Low self-esteem.","5. Poor concentration or difficulty making decisions.","6. Feelings of hopelessness."]},
      {id:"C", text:"During the 2-year period (1 year for children/adolescents) the individual has never been without the symptoms in Criteria A and B for more than 2 months at a time."},
      {id:"D", text:"Criteria for a major depressive disorder may be continuously present for 2 years."},
      {id:"E", text:"There has never been a manic episode or a hypomanic episode, and criteria for cyclothymic disorder have never been met."},
      {id:"F", text:"The disturbance is not better explained by a persistent schizoaffective disorder, schizophrenia, delusional disorder, or other specified or unspecified schizophrenia spectrum and other psychotic disorder."},
      {id:"G", text:"The symptoms are not attributable to the physiological effects of a substance or another medical condition."},
      {id:"H", text:"The symptoms cause clinically significant distress or impairment."}
    ],
    specifiers: ["With anxious distress","With atypical features","With pure dysthymic syndrome","With persistent major depressive episode","With intermittent major depressive episodes, with current episode","With intermittent major depressive episodes, without current episode"],
    severity: ["Mild","Moderate","Severe"],
    codingNote: "Specify onset: Early onset (before age 21 years) or Late onset (at age 21 years or older). PDD subsumes the previous DSM-IV diagnoses of chronic major depressive disorder and dysthymic disorder."
  },
    interventions: {
    pharma: [
      {name:'SSRIs/SNRIs', target:['RAPHE','mPFC','NAcc'], mechanism:'First-line. May need longer trials (8-12 weeks) due to chronicity.', evidence:'A', cite:'von Wolff et al. 2013 Pharmacopsychiatry 46(2):39-44'},
      {name:'CBASP (medication + therapy combined)', target:['mPFC','dlPFC','NAcc','RAPHE'], mechanism:'Keller study: combined nefazodone + CBASP superior to either alone', evidence:'A', cite:'Keller et al. 2000 N Engl J Med 342(20):1462-70'},
    ],
    therapy: [
      {name:'CBASP (Cognitive Behavioral Analysis System)', target:['mPFC','dlPFC','OXY','VV'], mechanism:'Specifically designed for chronic depression. Interpersonal discrimination training.', evidence:'A', cite:'McCullough 2000 Treatment for Chronic Depression'},
      {name:'Behavioral Activation', target:['VTA','NAcc','SMN'], mechanism:'Counteracts chronic avoidance/withdrawal', evidence:'A', cite:'Cuijpers et al. 2007 Clin Psychol Rev 27(3):318-26'},
      {name:'IPT', target:['OXY','VV','mPFC'], mechanism:'Addresses chronic interpersonal patterns maintaining depression', evidence:'A', cite:'Markowitz et al. 2008 J Affect Disord 110(3):230-8'},
    ],
    somatic: [
      {name:'Exercise (consistent, long-term)', target:['BDNF','VTA','HPA','VV'], mechanism:'Trait-level intervention for trait-level condition', evidence:'A', cite:'Schuch et al. 2016 J Psychiatr Res 77:42-51'},
    ],
    nutrition: [
      {name:'Mediterranean diet', target:['GBA','BDNF','HPA'], mechanism:'Anti-inflammatory dietary pattern. SMILES trial: significant depression improvement.', evidence:'A', cite:'Jacka et al. 2017 BMC Med 15(1):23'},
      {name:'Omega-3', target:['BDNF','mPFC'], mechanism:'Chronic supplementation for chronic condition', evidence:'B', cite:'Liao et al. 2019 Transl Psychiatry 9(1):190'},
    ],
    supplements: [
      {name:'SAMe', target:['RAPHE','mPFC'], mechanism:'Methyl donor augmentation', evidence:'B', cite:'Papakostas et al. 2010 Am J Psychiatry 167(8):942-8'},
      {name:'Curcumin', target:['BDNF','HPA','AI'], mechanism:'Anti-inflammatory, BDNF', evidence:'B', cite:'Lopresti et al. 2014 J Affect Disord 167:368-75'},
    ]
  }
},

// ─────────────────────────────────────────────────
// BIPOLAR (continued)
// ─────────────────────────────────────────────────

'BIPOLAR_II': {
  name: 'Bipolar II Disorder',
  dsm5: '296.89 (F31.81)',
  prevalence: '~0.4-0.8% (often underdiagnosed — mistaken for MDD)',
  summary: 'Similar to Bipolar I but hypomania circuit activation is milder. Depression phase dominates clinical picture. Critical distinction: antidepressant monotherapy can trigger hypomania/rapid cycling. Reward circuit dysregulation is subtler.',
  circuits: [
    {node:'NAcc',   dir:'altered', detail:'Reward oscillation less extreme than BP-I. Hypomania: mildly hyper. Depression: hypo.', evidence:'B', cite:'Nusslock et al. 2012 Annu Rev Clin Psychol 8:243-67'},
    {node:'BLA',    dir:'hyper', detail:'Amygdala reactivity elevated but less than BP-I', evidence:'B', cite:'Townsend et al. 2013 Biol Psychiatry 74(8):575-83'},
    {node:'dlPFC',  dir:'hypo', detail:'Executive function impaired, especially during depressive episodes', evidence:'A', cite:'Bora et al. 2009 Neurosci Biobehav Rev 33(2):171-83'},
    {node:'vmPFC',  dir:'hypo', detail:'Emotion regulation capacity reduced', evidence:'B', cite:'Blumberg et al. 2003 Arch Gen Psychiatry 60(6):601-9'},
    {node:'mPFC',   dir:'hyper', detail:'Ruminative DMN during depressive phase', evidence:'B', cite:'Delvecchio et al. 2012 J Affect Disord 139(3):313-21'},
    {node:'PIN',    dir:'altered', detail:'Circadian disruption is core feature — sleep changes herald episodes', evidence:'A', cite:'Harvey 2008 Clin Psychol Rev 28(8):1339-54'},
    {node:'RAPHE',  dir:'altered', detail:'Serotonergic function impaired — but SSRIs alone are dangerous (switch risk)', evidence:'A', cite:'Gijsman et al. 2004 Am J Psychiatry 161(9):1537-47'},
  ],
  criteria: {
    title: "Diagnostic Criteria 296.89 (F31.81)",
    sections: [
      {id:"A", text:"Criteria have been met for at least one hypomanic episode and at least one major depressive episode."},
      {id:"HYPO", text:"Hypomanic Episode: A distinct period of abnormally and persistently elevated, expansive, or irritable mood and abnormally and persistently increased activity or energy, lasting at least 4 consecutive days and present most of the day, nearly every day. During the period of mood disturbance, 3 (or more) of the following symptoms have persisted (4 if mood is only irritable):", items:["1. Inflated self-esteem or grandiosity.","2. Decreased need for sleep.","3. More talkative than usual or pressure to keep talking.","4. Flight of ideas or subjective experience that thoughts are racing.","5. Distractibility.","6. Increase in goal-directed activity or psychomotor agitation.","7. Excessive involvement in activities that have a high potential for painful consequences."]},
      {id:"B", text:"The episode is associated with an unequivocal change in functioning that is uncharacteristic of the individual when not symptomatic."},
      {id:"C", text:"The disturbance in mood and the change in functioning are observable by others."},
      {id:"D", text:"The episode is not severe enough to cause marked impairment in social or occupational functioning or to necessitate hospitalization."},
      {id:"E", text:"There has never been a manic episode."}
    ],
    specifiers: ["With anxious distress","With mixed features","With rapid cycling","With mood-congruent psychotic features (depressive episodes only)","With peripartum onset","With seasonal pattern"],
    severity: ["Mild","Moderate","Severe"],
    codingNote: "Bipolar II is NOT a milder form of Bipolar I. The depressive burden is often more severe and chronic."
  },
    interventions: {
    pharma: [
      {name:'Lamotrigine', target:['GABA_GLU','mPFC','NAcc'], mechanism:'First-line for bipolar depression prevention. Glutamate modulation.', evidence:'A', cite:'Geddes et al. 2009 Arch Gen Psychiatry 66(12):1386-95'},
      {name:'Quetiapine', target:['VTA','NAcc','RAPHE','THAL'], mechanism:'FDA-approved for bipolar depression. D2/5-HT2A + antihistamine.', evidence:'A', cite:'Calabrese et al. 2005 Am J Psychiatry 162(7):1351-60'},
      {name:'Lithium', target:['NAcc','VTA','BDNF','HIPP'], mechanism:'Mood stabilization. Neuroprotective. Suicide prevention.', evidence:'A', cite:'Cipriani et al. 2013 BMJ 346:f3646'},
      {name:'Caution: SSRI monotherapy', target:['RAPHE'], mechanism:'AVOID without mood stabilizer — switch risk to hypomania or rapid cycling', evidence:'A', cite:'Sachs et al. 2007 N Engl J Med 356(17):1711-22'},
    ],
    therapy: [
      {name:'IPSRT', target:['PIN','HYPO','VV'], mechanism:'Circadian rhythm stabilization — most important non-pharma intervention', evidence:'A', cite:'Frank et al. 2005 Arch Gen Psychiatry 62(9):996-1004'},
      {name:'CBT for Bipolar', target:['dlPFC','mPFC','vmPFC'], mechanism:'Mood monitoring, cognitive restructuring, behavioral activation', evidence:'A', cite:'Miklowitz & Scott 2009 J Clin Psychiatry 70(11):e44'},
      {name:'Psychoeducation', target:['dlPFC','mPFC'], mechanism:'Episode recognition, medication adherence, trigger management', evidence:'A', cite:'Colom et al. 2003 Arch Gen Psychiatry 60(4):402-7'},
    ],
    somatic: [
      {name:'Sleep hygiene (strict)', target:['PIN','HYPO','LC'], mechanism:'Sleep disruption is #1 episode trigger. Consistent sleep-wake time critical.', evidence:'A', cite:'Harvey et al. 2015 J Consult Clin Psychol 83(3):564-77'},
      {name:'Light therapy (winter depression)', target:['PIN','RAPHE','HYPO'], mechanism:'Midday (not morning — lower switch risk) bright light for seasonal component', evidence:'B', cite:'Sit et al. 2018 Am J Psychiatry 175(2):131-9'},
    ],
    nutrition: [
      {name:'Omega-3', target:['BDNF','BLA'], mechanism:'Adjunctive evidence for bipolar depression', evidence:'B', cite:'Sarris et al. 2012 J Clin Psychiatry 73(1):81-6'},
      {name:'NAC', target:['GABA_GLU','NAcc','dlPFC'], mechanism:'Glutamate modulation, oxidative stress', evidence:'B', cite:'Berk et al. 2008 Biol Psychiatry 64(6):468-75'},
    ],
    supplements: []
  },
  metabolic: [
    {factor:'Metabolic syndrome', relevance:'Prevalence 2\u20133x general population. The depressive-dominant course of BP-II means metabolic burden often accumulates undetected during extended low-mood phases with reduced activity.', screen:'Fasting glucose, HbA1c, lipid panel, waist circumference, blood pressure'},
    {factor:'Thyroid effects of lithium', relevance:'Lithium-induced hypothyroidism particularly problematic in BP-II \u2014 can worsen the already dominant depressive pole and be mistaken for worsening depression rather than iatrogenic thyroid suppression.', screen:'TSH, free T4 at baseline and every 6 months on lithium; TPO antibodies at baseline'},
    {factor:'Insulin resistance', relevance:'Medication-related metabolic effects (quetiapine, valproate) compound illness-intrinsic insulin resistance, impairing mesocortical dopamine function and executive control.', screen:'Fasting glucose, HbA1c, fasting insulin at baseline and quarterly on SGAs/valproate'}
  ]
},

// ─────────────────────────────────────────────────
// SLEEP-WAKE DISORDERS
// ─────────────────────────────────────────────────

'INSOMNIA': {
  name: 'Insomnia Disorder',
  dsm5: '780.52 (G47.00)',
  prevalence: '~10-15% chronic insomnia in adults (APA)',
  summary: 'Hyperarousal model — the brain cannot deactivate wake-promoting circuits. DMN fails to transition to sleep-state configuration. LC/SNS arousal persists. dACC rumination prevents cognitive wind-down.',
  circuits: [
    {node:'LC',     dir:'hyper', detail:'Noradrenergic arousal system fails to disengage → cannot "turn off"', evidence:'A', cite:'Bonnet & Arand 2010 Sleep Med Rev 14(2):97-105'},
    {node:'dACC',   dir:'hyper', detail:'Pre-sleep rumination — worry about not sleeping creates self-fulfilling arousal', evidence:'B', cite:'Nofzinger et al. 2004 Am J Psychiatry 161(11):2126-8'},
    {node:'mPFC',   dir:'hyper', detail:'DMN self-referential processing persists when it should quiet for sleep', evidence:'B', cite:'Nofzinger et al. 2004 Am J Psychiatry 161(11):2126-8'},
    {node:'SNS',    dir:'hyper', detail:'Sympathetic arousal elevated — HR, cortisol, body temp all elevated at night', evidence:'A', cite:'Bonnet & Arand 2010 Sleep Med Rev 14(2):97-105'},
    {node:'HYPO',   dir:'altered', detail:'Wake-promoting orexin/hypocretin system overactive', evidence:'B', cite:'Saper et al. 2005 Nature 437(7063):1257-63'},
    {node:'THAL',   dir:'altered', detail:'Thalamic gating fails to shift from relay mode to oscillatory sleep mode', evidence:'B', cite:'Saper et al. 2005 Nature 437(7063):1257-63'},
    {node:'PIN',    dir:'hypo', detail:'Melatonin onset delayed or amplitude reduced', evidence:'A', cite:'Zhdanova et al. 2001 Sleep Med Rev 5(2):155-70'},
    {node:'VV',     dir:'hypo', detail:'Parasympathetic withdrawal — cannot shift to rest-digest state', evidence:'A', cite:'Bonnet & Arand 2010'},
    {node:'RF',     dir:'hyper', detail:'Ascending reticular activating system stays engaged', evidence:'B', cite:'Saper et al. 2005'},
  ],
  criteria: {
    title: "Diagnostic Criteria 780.52 (G47.00)",
    sections: [
      {id:"A", text:"A predominant complaint of dissatisfaction with sleep quantity or quality, associated with one (or more) of the following symptoms:", items:["1. Difficulty initiating sleep.","2. Difficulty maintaining sleep, characterized by frequent awakenings or problems returning to sleep after awakenings.","3. Early-morning awakening with inability to return to sleep."]},
      {id:"B", text:"The sleep disturbance causes clinically significant distress or impairment in social, occupational, educational, academic, behavioral, or other important areas of functioning."},
      {id:"C", text:"The sleep difficulty occurs at least 3 nights per week."},
      {id:"D", text:"The sleep difficulty is present for at least 3 months."},
      {id:"E", text:"The sleep difficulty occurs despite adequate opportunity for sleep."},
      {id:"F", text:"The insomnia is not better explained by and does not occur exclusively during the course of another sleep-wake disorder."},
      {id:"G", text:"The insomnia is not attributable to the physiological effects of a substance."},
      {id:"H", text:"Coexisting mental disorders and medical conditions do not adequately explain the predominant complaint of insomnia."}
    ],
    specifiers: ["With non-sleep disorder mental comorbidity","With other medical comorbidity","With other sleep disorder","Episodic (symptoms last at least 1 month but less than 3 months)","Persistent (symptoms last 3 months or longer)","Recurrent (two or more episodes within 1 year)"],
    severity: [],
    codingNote: "Insomnia disorder can occur independently or as a comorbid condition. CBT-I (Cognitive Behavioral Therapy for Insomnia) is first-line treatment per AASM guidelines."
  },
    interventions: {
    pharma: [
      {name:'Suvorexant/Lemborexant (DORAs)', target:['HYPO','RF','THAL'], mechanism:'Dual orexin receptor antagonist — blocks wake signal. Does not force sedation.', evidence:'A', cite:'Herring et al. 2012 Neurology 79(23):2265-74'},
      {name:'Low-dose trazodone', target:['RAPHE','RF'], mechanism:'5-HT2A antagonism + mild sedation. No dependence risk.', evidence:'B', cite:'Walsh 2004 Am Fam Physician 69(11):2599'},
      {name:'Gabapentin', target:['GABA_GLU','THAL'], mechanism:'Enhances slow-wave sleep. Useful when comorbid pain/anxiety.', evidence:'B', cite:'Lo et al. 2010 Sleep 33(8):1013-24'},
      {name:'Melatonin (0.5-3mg, timed)', target:['PIN','HYPO'], mechanism:'Phase-advance circadian rhythm. Low dose more effective than high for sleep onset.', evidence:'A', cite:'Ferracioli-Oda et al. 2013 PLoS One 8(5):e63773'},
      {name:'Caution: Benzodiazepines/Z-drugs', target:['GABA_GLU','THAL','RF'], mechanism:'Effective short-term but dependence, tolerance, rebound insomnia. Avoid long-term.', evidence:'A', cite:'Wilt et al. 2016 Ann Intern Med 165(2):103-12'},
    ],
    therapy: [
      {name:'CBT-I (CBT for Insomnia)', target:['dACC','mPFC','LC','SNS'], mechanism:'GOLD STANDARD — superior to medication long-term. Sleep restriction, stimulus control, cognitive restructuring of sleep anxiety.', evidence:'A', cite:'Mitchell et al. 2012 Ann Intern Med 157(12):I-37'},
    ],
    somatic: [
      {name:'Sleep restriction therapy', target:['HYPO','RF','THAL'], mechanism:'Builds homeostatic sleep drive by limiting time in bed → consolidates sleep', evidence:'A', cite:'Part of CBT-I; Spielman et al. 1987'},
      {name:'Exercise (morning/afternoon)', target:['BDNF','VV','HPA','PIN'], mechanism:'Deepens slow-wave sleep, normalizes circadian rhythm. Avoid evening.', evidence:'A', cite:'Kredlow et al. 2015 J Behav Med 38(3):427-49'},
      {name:'Progressive muscle relaxation', target:['SNS','VV','NTS'], mechanism:'Parasympathetic activation via systematic muscle tension/release', evidence:'A', cite:'Morin et al. 2006 Sleep 29(11):1398-414'},
    ],
    nutrition: [
      {name:'Tart cherry juice', target:['PIN','RAPHE'], mechanism:'Natural melatonin source + tryptophan. Small but positive RCTs.', evidence:'B', cite:'Pigeon et al. 2010 J Med Food 13(3):579-83'},
      {name:'Magnesium glycinate (400mg)', target:['GABA_GLU','SNS'], mechanism:'GABAergic, muscle relaxant, calming. Take at bedtime.', evidence:'B', cite:'Abbasi et al. 2012 J Res Med Sci 17(12):1161-9'},
      {name:'Caffeine elimination after noon', target:['LC','RF'], mechanism:'Adenosine antagonist half-life 5-6h. Afternoon caffeine disrupts sleep architecture.', evidence:'A', cite:'Drake et al. 2013 J Clin Sleep Med 9(11):1195-200'},
    ],
    supplements: [
      {name:'Glycine (3g before bed)', target:['GABA_GLU','THAL'], mechanism:'Lowers core body temperature, enhances sleep quality', evidence:'B', cite:'Inagawa et al. 2006 Sleep Biol Rhythms 4(1):75-7'},
      {name:'L-Theanine (200mg)', target:['GABA_GLU','THETA'], mechanism:'Alpha wave promotion, anxiolytic, sleep quality improvement', evidence:'B', cite:'Lyon et al. 2011 Altern Med Rev 16(4):348-54'},
      {name:'Apigenin (chamomile, 50mg)', target:['GABA_GLU','BLA'], mechanism:'Benzodiazepine site partial agonist. Mild sedative.', evidence:'C', cite:'Srivastava et al. 2010 Mol Med Report 3(6):895-901'},
    ]
  }
},

// ─────────────────────────────────────────────────
// OCD-RELATED (continued)
// ─────────────────────────────────────────────────

'BDD': {
  name: 'Body Dysmorphic Disorder',
  dsm5: '300.7 (F45.22)',
  prevalence: '~1.7-2.4% general population',
  summary: 'OCD-spectrum. Visual processing detail-focused rather than holistic — sees parts not wholes. OFC-striatal loop locked on perceived flaw. Fusiform face processing distorted for own face.',
  circuits: [
    {node:'OFC',    dir:'hyper', detail:'Locked on perceived defect — "something is wrong with my appearance"', evidence:'A', cite:'Feusner et al. 2010 Arch Gen Psychiatry 67(2):197-205'},
    {node:'CAUD',   dir:'hyper', detail:'CSTC loop engaged like OCD — repetitive checking, comparing', evidence:'B', cite:'Feusner et al. 2010'},
    {node:'FG',     dir:'altered', detail:'Fusiform face processing abnormal for own face — detail-biased, not holistic', evidence:'A', cite:'Feusner et al. 2007 Neuroreport 18(17):1741-4'},
    {node:'V1',     dir:'altered', detail:'Early visual processing shifted toward high spatial frequency (details over gestalt)', evidence:'B', cite:'Feusner et al. 2010'},
    {node:'AI',     dir:'hyper', detail:'Disgust response to own appearance', evidence:'B', cite:'Feusner et al. 2010'},
    {node:'dlPFC',  dir:'hypo', detail:'Cannot disengage from perceived flaw via executive override', evidence:'B', cite:'Grace et al. 2017 Psychol Med 47(8):1321-42'},
    {node:'mPFC',   dir:'hyper', detail:'Self-referential processing dominated by appearance evaluation', evidence:'B', cite:'Bohon et al. 2012 Psychiatry Res 203(2-3):313-5'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.7 (F45.22)",
    sections: [
      {id:"A", text:"Preoccupation with one or more perceived defects or flaws in physical appearance that are not observable or appear slight to others."},
      {id:"B", text:"At some point during the course of the disorder, the individual has performed repetitive behaviors (e.g., mirror checking, excessive grooming, skin picking, reassurance seeking) or mental acts (e.g., comparing his or her appearance with that of others) in response to the appearance concerns."},
      {id:"C", text:"The preoccupation causes clinically significant distress or impairment in social, occupational, or other important areas of functioning."},
      {id:"D", text:"The appearance preoccupation is not better explained by concerns with body fat or weight in an individual whose symptoms meet diagnostic criteria for an eating disorder."}
    ],
    specifiers: ["With muscle dysmorphia","With good or fair insight","With poor insight","With absent insight/delusional beliefs"],
    severity: [],
    codingNote: "Classified in DSM-5 under Obsessive-Compulsive and Related Disorders. Insight specifier is important for treatment planning."
  },
    interventions: {
    pharma: [
      {name:'SSRIs (high dose)', target:['RAPHE','OFC','CAUD'], mechanism:'Same approach as OCD — serotonergic modulation of OFC-striatal loop', evidence:'A', cite:'Phillips et al. 2002 J Clin Psychiatry 63 Suppl 6:7-12'},
      {name:'Clomipramine', target:['RAPHE','OFC','CAUD'], mechanism:'Tricyclic with strong serotonergic effect. When SSRIs fail.', evidence:'B', cite:'Hollander et al. 1999 J Clin Psychopharmacol 19(1):15-20'},
    ],
    therapy: [
      {name:'CBT (ERP + perceptual retraining)', target:['OFC','FG','dlPFC','AI'], mechanism:'Exposure to avoided appearance situations + holistic visual processing training', evidence:'A', cite:'Wilhelm et al. 2014 Behav Ther 45(3):314-27'},
    
      {name:"ERP (Exposure & Response Prevention)", target:["OFC","BLA","AI"], mechanism:"Systematic exposure to appearance-related triggers without ritual response. Gold standard.", evidence:"A", cite:"Wilhelm et al. 2014 Behav Ther 45(3):314-27"},
    ],
    somatic: [
      {name:"rTMS (right dlPFC)", target:["dlPFC","OFC"], mechanism:"Modulates OFC-driven preoccupation circuitry", evidence:"C", cite:"Dunlop et al. 2016 pilot"}
    ],
    nutrition: [
      {name:"NAC (1200-2400mg)", target:["GABA_GLU","OFC"], mechanism:"Glutamate modulation reduces obsessive rumination loop", evidence:"C", cite:"Grant et al. 2016 Ann Clin Psychiatry 28(1):28-34"},
      {name:"Inositol (12-18g)", target:["OFC","5HT"], mechanism:"Serotonin second messenger augmentation", evidence:"C", cite:"Fux et al. 1996; extrapolated from OCD data"}
    ],
    supplements: []
  }
},

'HOARDING': {
  name: 'Hoarding Disorder',
  dsm5: '300.3 (F42.3)',
  prevalence: '~2-6% population estimates',
  summary: 'OFC value computation overweights possessions. dACC generates distress signal at discarding. Attachment/loss circuits activated by objects. Executive function (categorization, decision-making) impaired.',
  circuits: [
    {node:'OFC',    dir:'hyper', detail:'Excessive value assigned to objects — "this might be useful/important"', evidence:'A', cite:'Tolin et al. 2012 Arch Gen Psychiatry 69(8):832-41'},
    {node:'dACC',   dir:'hyper', detail:'Distress signal when discarding — "something bad will happen if I throw this away"', evidence:'A', cite:'Tolin et al. 2012 Arch Gen Psychiatry 69(8):832-41'},
    {node:'AI',     dir:'hyper', detail:'Emotional attachment to objects → interoceptive distress at loss', evidence:'B', cite:'Tolin et al. 2012'},
    {node:'dlPFC',  dir:'hypo', detail:'Categorization deficit — cannot organize, prioritize, decide what to keep', evidence:'A', cite:'Grisham et al. 2010 J Abnorm Psychol 119(2):286-93'},
    {node:'STRI',   dir:'altered', detail:'Acquisition behavior is habit-driven', evidence:'C', cite:'Tolin et al. 2012'},
    {node:'vmPFC',  dir:'altered', detail:'Emotional regulation during discarding impaired', evidence:'B', cite:'Tolin et al. 2012'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.3 (F42.3)",
    sections: [
      {id:"A", text:"Persistent difficulty discarding or parting with possessions, regardless of their actual value."},
      {id:"B", text:"This difficulty is due to a perceived need to save the items and to distress associated with discarding them."},
      {id:"C", text:"The difficulty discarding possessions results in the accumulation of possessions that congest and clutter active living areas and substantially compromises their intended use."},
      {id:"D", text:"The hoarding causes clinically significant distress or impairment in social, occupational, or other important areas of functioning (including maintaining a safe environment for self and others)."},
      {id:"E", text:"The hoarding is not attributable to another medical condition."},
      {id:"F", text:"The hoarding is not better explained by the symptoms of another mental disorder."}
    ],
    specifiers: ["With excessive acquisition","With good or fair insight","With poor insight","With absent insight/delusional beliefs"],
    severity: [],
    codingNote: "Classified under Obsessive-Compulsive and Related Disorders in DSM-5. Specify if with excessive acquisition."
  },
    interventions: {
    pharma: [
      {name:'SSRIs', target:['RAPHE','OFC','dACC'], mechanism:'Modest effect — less responsive than OCD to serotonergics', evidence:'B', cite:'Saxena 2011 Prog Neuropsychopharmacol Biol Psychiatry 35(4):987-91'},
      {name:'Venlafaxine', target:['RAPHE','LC','OFC'], mechanism:'SNRI may have advantage over SSRIs for hoarding', evidence:'C', cite:'Saxena 2011'},
    ],
    therapy: [
      {name:'CBT for Hoarding (Steketee/Frost model)', target:['OFC','dlPFC','dACC','AI'], mechanism:'Cognitive restructuring of object attachment + in-session sorting + motivational interviewing', evidence:'A', cite:'Steketee et al. 2010 J Consult Clin Psychol 78(3):312-6'},
    
      {name:"CBT for Hoarding (Steketee protocol)", target:["dlPFC","OFC","dACC","AI"], mechanism:"Specialized protocol: sorting practice, exposure to discarding, cognitive restructuring of possession attachment", evidence:"A", cite:"Steketee et al. 2010 Behav Res Ther 48(6):487-94"},
    ],
    somatic: [
      {name:"Aerobic Exercise", target:["BDNF","dlPFC","VTA"], mechanism:"Executive function support, reduces decision fatigue", evidence:"C", cite:"Extrapolated from executive function literature"}
    ],
    nutrition: [
      {name:"NAC (2400mg)", target:["GABA_GLU","OFC"], mechanism:"Glutamate modulation for compulsive acquisition", evidence:"C", cite:"Grant et al. 2009; extrapolated from compulsive behavior spectrum"}
    ],
    supplements: []
  }
},

// ─────────────────────────────────────────────────
// NEURODEVELOPMENTAL (continued)
// ─────────────────────────────────────────────────

'TOURETTE': {
  name: "Tourette's Disorder",
  dsm5: '307.23 (F95.2)',
  prevalence: '~0.3-1% children, often improves by adulthood',
  summary: 'Basal ganglia-thalamocortical circuit disinhibition. Striatum fails to properly gate motor programs → tics escape as unwanted motor/vocal output. SMA pre-motor urge signal creates premonitory urge.',
  circuits: [
    {node:'STRI',   dir:'altered', detail:'Striatal interneuron loss → disinhibited motor output', evidence:'A', cite:'Kataoka et al. 2010 J Clin Invest 120(3):831-9'},
    {node:'CAUD',   dir:'altered', detail:'Caudate volume changes in childhood', evidence:'A', cite:'Peterson et al. 2003 Arch Gen Psychiatry 60(4):415-24'},
    {node:'PUT',    dir:'hyper', detail:'Putamen activation associated with tic generation', evidence:'B', cite:'Wang et al. 2011 Neuropsychologia 49(5):1270-80'},
    {node:'GP',     dir:'altered', detail:'Globus pallidus output gate dysregulated → motor programs escape', evidence:'A', cite:'Mink 2001 Muscle Nerve 24(10):1271-88'},
    {node:'THAL',   dir:'altered', detail:'Thalamic relay → motor cortex receives unwanted signals', evidence:'A', cite:'Mink 2001 Muscle Nerve 24(10):1271-88'},
    {node:'SMA',    dir:'hyper', detail:'Premonitory urge — SMA pre-motor activation before tic', evidence:'A', cite:'Bohlhalter et al. 2006 Brain 129(8):2029-37'},
    {node:'M1',     dir:'hyper', detail:'Motor cortex excitability increased → lower threshold for tic execution', evidence:'A', cite:'Ziemann et al. 1997 J Neurol Neurosurg Psychiatry 63(1):61-7'},
    {node:'dACC',   dir:'hyper', detail:'Conflict between urge to tic and urge to suppress', evidence:'B', cite:'Peterson et al. 1998 Arch Gen Psychiatry 55(4):326-33'},
    {node:'dlPFC',  dir:'altered', detail:'Tic suppression recruits PFC — exhausting effortful control', evidence:'B', cite:'Peterson et al. 1998'},
  ],
  criteria: {
    title: "Diagnostic Criteria 307.23 (F95.2)",
    sections: [
      {id:"A", text:"Both multiple motor and one or more vocal tics have been present at some time during the illness, although not necessarily concurrently."},
      {id:"B", text:"The tics may wax and wane in frequency but have persisted for more than 1 year since first tic onset."},
      {id:"C", text:"Onset is before age 18 years."},
      {id:"D", text:"The disturbance is not attributable to the physiological effects of a substance or another medical condition."}
    ],
    specifiers: [],
    severity: [],
    codingNote: "Tic disorders form a spectrum: Provisional Tic Disorder (<1 year), Persistent Motor or Vocal Tic Disorder (single type >1 year), and Tourette's Disorder (both motor and vocal >1 year)."
  },
    interventions: {
    pharma: [
      {name:'Alpha-2 agonists (guanfacine/clonidine)', target:['LC','dlPFC','STRI'], mechanism:'First-line for mild-moderate tics. Reduces noradrenergic drive + PFC support.', evidence:'A', cite:'Weisman et al. 2013 Pediatr Neurol 49(6):422-7'},
      {name:'Antipsychotics (aripiprazole, pimozide)', target:['VTA','STRI','THAL'], mechanism:'Dopamine D2 blockade in striatal circuits. Reserved for severe/refractory.', evidence:'A', cite:'Pringsheim et al. 2012 Can J Neurol Sci 39(6):S46-58'},
      {name:'Topiramate', target:['GABA_GLU','STRI'], mechanism:'GABA enhancement, glutamate reduction in BG circuits', evidence:'B', cite:'Jankovic et al. 2010 Neurology 74(18):1434-41'},
    ],
    therapy: [
      {name:'CBIT (Comprehensive Behavioral Intervention for Tics)', target:['SMA','STRI','dlPFC','dACC'], mechanism:'Gold standard behavioral. Habit reversal training — competing response to premonitory urge.', evidence:'A', cite:'Piacentini et al. 2010 JAMA 303(19):1929-37'},
      {name:'ERP for Tics', target:['SMA','dACC','dlPFC'], mechanism:'Exposure to premonitory urge without ticcing → habituation', evidence:'B', cite:'Verdellen et al. 2004 Behav Modif 28(1):138-50'},
    
      {name:"CBIT (Comprehensive Behavioral Intervention for Tics)", target:["CAUD","SMA","PUT","dlPFC"], mechanism:"Habit reversal training + functional intervention. First-line behavioral. As effective as medication.", evidence:"A", cite:"Piacentini et al. 2010 JAMA 303(19):1929-37"},
    ],
    somatic: [
      {name:'DBS (centromedian thalamus — severe/refractory)', target:['THAL','GP','STRI'], mechanism:'Modulates thalamocortical circuit. Last resort.', evidence:'B', cite:'Schrock et al. 2015 J Neurol Neurosurg Psychiatry 86(9):934-41'},
    ],
    nutrition: [
      {name:'Magnesium', target:['GABA_GLU','STRI'], mechanism:'Anecdotal + small studies suggest tic reduction', evidence:'C', cite:'Garcia-Lopez et al. 2009 Med Clin 133(3):119'},
    
      {name:"Magnesium (glycinate/citrate)", target:["GABA_GLU","CAUD"], mechanism:"GABAergic modulation reduces tic severity. Common deficiency.", evidence:"C", cite:"Garcia-Lopez et al. 2009"},
      {name:"Omega-3", target:["BDNF","dlPFC"], mechanism:"Neuroprotective, reduces neuroinflammation", evidence:"C", cite:"General neuroprotection"},
    ],
    supplements: []
  }
},

// ─────────────────────────────────────────────────
// PERSONALITY DISORDERS (continued)
// ─────────────────────────────────────────────────

'ASPD': {
  name: 'Antisocial Personality Disorder',
  dsm5: '301.7 (F60.2)',
  prevalence: '~1-4% population (higher in prisons: ~50%)',
  summary: 'Amygdala hypoactivation to distress cues — cannot learn from punishment. vmPFC-amygdala regulation impaired but in opposite direction from anxiety: too little, not too much. Reward system biased toward immediate gratification.',
  circuits: [
    {node:'BLA',    dir:'hypo', detail:'Reduced amygdala activation to fearful faces and others\' distress — cannot learn from punishment cues', evidence:'A', cite:'Blair 2008 Ann NY Acad Sci 1129:170-80'},
    {node:'vmPFC',  dir:'hypo', detail:'Impaired moral/social decision-making. Damage produces acquired sociopathy.', evidence:'A', cite:'Anderson et al. 1999 Nat Neurosci 2(11):1032-7'},
    {node:'OFC',    dir:'hypo', detail:'Volume/function reduced → poor outcome prediction, impaired learning from negative consequences', evidence:'A', cite:'Raine et al. 2000 Arch Gen Psychiatry 57(2):119-27'},
    {node:'dlPFC',  dir:'hypo', detail:'Impulse control deficient → acts without considering consequences', evidence:'A', cite:'Yang & Raine 2009 Neurosci Biobehav Rev 33(8):1200-6'},
    {node:'NAcc',   dir:'hyper', detail:'Immediate reward overvalued. Delay discounting steep.', evidence:'B', cite:'Buckholtz et al. 2010 Nat Neurosci 13(4):419-21'},
    {node:'TPJ',    dir:'hypo', detail:'Theory of mind intact (can read people) but moral perspective-taking deficit', evidence:'B', cite:'Harenski et al. 2010 Soc Cogn Affect Neurosci 5(1):110-8'},
    {node:'AI',     dir:'hypo', detail:'Reduced empathic distress — does not feel discomfort at others\' pain', evidence:'A', cite:'Meffert et al. 2013 JAMA Psychiatry 70(6):638-45'},
    {node:'dACC',   dir:'hypo', detail:'Error monitoring reduced — does not register rule violations as salient', evidence:'B', cite:'Kiehl et al. 2001 Biol Psychiatry 50(9):677-84'},
  ],
  criteria: {
    title: "Diagnostic Criteria 301.7 (F60.2)",
    sections: [
      {id:"A", text:"A pervasive pattern of disregard for and violation of the rights of others, occurring since age 15 years, as indicated by 3 (or more) of the following:", items:["1. Failure to conform to social norms with respect to lawful behaviors, as indicated by repeatedly performing acts that are grounds for arrest.","2. Deceitfulness, as indicated by repeated lying, use of aliases, or conning others for personal profit or pleasure.","3. Impulsivity or failure to plan ahead.","4. Irritability and aggressiveness, as indicated by repeated physical fights or assaults.","5. Reckless disregard for safety of self or others.","6. Consistent irresponsibility, as indicated by repeated failure to sustain consistent work behavior or honor financial obligations.","7. Lack of remorse, as indicated by being indifferent to or rationalizing having hurt, mistreated, or stolen from another."]},
      {id:"B", text:"The individual is at least age 18 years."},
      {id:"C", text:"There is evidence of conduct disorder with onset before age 15 years."},
      {id:"D", text:"The occurrence of antisocial behavior is not exclusively during the course of schizophrenia or bipolar disorder."}
    ],
    specifiers: [],
    severity: [],
    codingNote: "Conduct Disorder prior to age 15 is a prerequisite. This is the only personality disorder with a minimum age requirement (18 years)."
  },
    interventions: {
    pharma: [
      {name:'No proven pharmacotherapy', target:[], mechanism:'No medication treats core ASPD. Comorbidities treated individually.', evidence:'D', cite:'National Collaborating Centre 2010 NICE Guidelines'},
      {name:'Mood stabilizers (comorbid aggression)', target:['BLA','GABA_GLU'], mechanism:'Reduces impulsive aggression component', evidence:'B', cite:'Jones et al. 2011 Cochrane Database Syst Rev'},
    ],
    therapy: [
      {name:'MBT (Mentalization-Based)', target:['TPJ','vmPFC','mPFC'], mechanism:'Builds capacity to consider others\' mental states. Early evidence.', evidence:'C', cite:'Bateman et al. 2016 J Consult Clin Psychol 84(10):890-900'},
      {name:'Contingency management', target:['NAcc','STRI','dlPFC'], mechanism:'External reward structure for prosocial behavior (used in forensic settings)', evidence:'B', cite:'Tew et al. 2012 Pers Disord 3(3):239-52'},
    ],
    somatic: [
      {name:"Mindfulness-Based Interventions", target:["vmPFC","dACC","AI","TPJ"], mechanism:"Enhances empathy circuits, improves impulse regulation, increases interoceptive awareness", evidence:"C", cite:"Fix et al. 2015; prison-based mindfulness RCTs"}
    ],
    nutrition: [
      {name:'Omega-3', target:['dlPFC','BLA'], mechanism:'Aggression reduction in prison populations (RCT)', evidence:'B', cite:'Gesch et al. 2002 Br J Psychiatry 181:22-8; Raine et al. 2015 J Child Psychol Psychiatry 56(9):1043-53'},
    
      {name:"Omega-3 (EPA/DHA)", target:["vmPFC","dlPFC","BLA"], mechanism:"Reduced aggression in forensic populations. Prefrontal support.", evidence:"B", cite:"Gesch et al. 2002 Br J Psychiatry 181:22-8; Raine et al. 2015"},
    ],
    supplements: []
  }
},

'NPD': {
  name: 'Narcissistic Personality Disorder',
  dsm5: '301.81 (F60.81)',
  prevalence: '~0.5-5% (wide range based on assessment method)',
  summary: 'Limited neuroimaging research, but emerging picture: empathy circuit hypoactive, self-referential processing amplified, reward circuit biased toward social dominance signals. Right anterior insula structural deficit correlates with empathic deficit.',
  circuits: [
    {node:'AI',     dir:'hypo', detail:'Right anterior insula gray matter reduced — correlates with empathy deficit', evidence:'B', cite:'Schulze et al. 2013 J Psychiatr Res 47(10):1363-9'},
    {node:'mPFC',   dir:'hyper', detail:'Self-referential processing amplified — grandiose self-concept maintained by DMN', evidence:'C', cite:'Fan et al. 2011 J Pers Disord 25(1):87-98'},
    {node:'EMP',    dir:'hypo', detail:'Empathy circuit engagement reduced — cognitive empathy intact, affective empathy impaired', evidence:'B', cite:'Ritter et al. 2011 Psychiatry Res 187(1-2):241-7'},
    {node:'NAcc',   dir:'hyper', detail:'Reward circuit selectively responsive to admiration/status signals', evidence:'C', cite:'Chester et al. 2016 Pers Soc Psychol Bull 42(10):1458-71'},
    {node:'BLA',    dir:'hyper', detail:'Narcissistic injury — criticism triggers disproportionate threat/rage response', evidence:'C', cite:'Fan et al. 2011'},
    {node:'TPJ',    dir:'altered', detail:'Perspective-taking selectively impaired for others\' negative states', evidence:'C', cite:'Ritter et al. 2011'},
  ],
  criteria: {
    title: "Diagnostic Criteria 301.81 (F60.81)",
    sections: [
      {id:"A", text:"A pervasive pattern of grandiosity (in fantasy or behavior), need for admiration, and lack of empathy, beginning by early adulthood and present in a variety of contexts, as indicated by 5 (or more) of the following:", items:["1. Has a grandiose sense of self-importance.","2. Is preoccupied with fantasies of unlimited success, power, brilliance, beauty, or ideal love.","3. Believes that he or she is \"special\" and unique and can only be understood by, or should associate with, other special or high-status people (or institutions).","4. Requires excessive admiration.","5. Has a sense of entitlement.","6. Is interpersonally exploitative.","7. Lacks empathy: is unwilling to recognize or identify with the feelings and needs of others.","8. Is often envious of others or believes that others are envious of him or her.","9. Shows arrogant, haughty behaviors or attitudes."]}
    ],
    specifiers: [],
    severity: [],
    codingNote: "Personality disorder criteria require onset by early adulthood and stability across time and situations."
  },
    interventions: {
    pharma: [
      {name:'No established pharmacotherapy', target:[], mechanism:'No medication treats core NPD. Comorbid depression/anxiety treated per those protocols.', evidence:'D', cite:'Caligor et al. 2015 Am J Psychiatry 172(5):415-22'},
    
      {name:"Low-dose SSRI (comorbid dysphoria)", target:["RAPHE","vmPFC"], mechanism:"Addresses narcissistic injury/depression without targeting core traits", evidence:"C", cite:"Expert consensus; no RCTs for NPD specifically"},
    ],
    therapy: [
      {name:'TFP (Transference-Focused Psychotherapy)', target:['mPFC','TPJ','AI','OXY'], mechanism:'Primary evidence-based approach. Works with grandiosity/devaluation in therapeutic relationship.', evidence:'B', cite:'Diamond et al. 2013 Psychodyn Psychiatry 41(3):385-417'},
      {name:'Schema Therapy', target:['mPFC','BLA','vmPFC'], mechanism:'Addresses vulnerable child schema beneath grandiose presentation', evidence:'B', cite:'Bamelis et al. 2014 JAMA Psychiatry 71(3):255-62'},
      {name:'MBT', target:['TPJ','AI','mPFC'], mechanism:'Builds mentalization capacity — particularly for others\' emotional states', evidence:'C', cite:'Bateman & Fonagy 2013'},
    ],
    somatic: [
      {name:"Compassion-Focused Therapy + mindfulness", target:["vmPFC","AI","TPJ","OXY"], mechanism:"Builds empathy circuit activation through directed compassion practices", evidence:"C", cite:"Gilbert 2014 Br J Clin Psychol 53(1):6-41"}
    ],
    nutrition: [],
    supplements: []
  }
},

'AVPD': {
  name: 'Avoidant Personality Disorder',
  dsm5: '301.82 (F60.6)',
  prevalence: '~2.4% general population',
  summary: 'Overlaps heavily with severe Social Anxiety but more pervasive — identity organized around inadequacy. Amygdala hyperreactive to social rejection. DMN self-concept rigidly negative. Reward circuit hypoactive for social approach.',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Social rejection hypersensitivity — amygdala fires to ambiguous social cues', evidence:'B', cite:'Denny et al. 2015 Soc Cogn Affect Neurosci 10(1):19-27'},
    {node:'mPFC',   dir:'hyper', detail:'Rigid negative self-concept — "I am inadequate" as DMN baseline', evidence:'C', cite:'Extrapolated from social anxiety literature; Blair et al. 2008'},
    {node:'NAcc',   dir:'hypo', detail:'Social reward signal blunted — approach motivation absent', evidence:'C', cite:'Richey et al. 2017 Mol Psychiatry 22(3):481-6 (social anxiety data)'},
    {node:'AI',     dir:'hyper', detail:'Anticipatory anxiety — social situations generate interoceptive alarm', evidence:'B', cite:'Paulus & Stein 2006'},
    {node:'VV',     dir:'hypo', detail:'Ventral vagal social engagement suppressed — cannot feel safe in social contexts', evidence:'C', cite:'Porges 2011'},
    {node:'dACC',   dir:'hyper', detail:'Social rejection registered as pain (Eisenberger social pain overlap)', evidence:'B', cite:'Eisenberger et al. 2003 Science 302(5643):290-2'},
  ],
  criteria: {
    title: "Diagnostic Criteria 301.82 (F60.6)",
    sections: [
      {id:"A", text:"A pervasive pattern of social inhibition, feelings of inadequacy, and hypersensitivity to negative evaluation, beginning by early adulthood and present in a variety of contexts, as indicated by 4 (or more) of the following:", items:["1. Avoids occupational activities that involve significant interpersonal contact, because of fears of criticism, disapproval, or rejection.","2. Is unwilling to get involved with people unless certain of being liked.","3. Shows restraint within intimate relationships because of the fear of being shamed or ridiculed.","4. Is preoccupied with being criticized or rejected in social situations.","5. Is inhibited in new interpersonal situations because of feelings of inadequacy.","6. Views self as socially inept, personally unappealing, or inferior to others.","7. Is unusually reluctant to take personal risks or to engage in any new activities because they may prove embarrassing."]}
    ],
    specifiers: [],
    severity: [],
    codingNote: "Significant overlap with Social Anxiety Disorder. Key distinction: AVPD involves a pervasive pattern of avoidance rooted in deep-seated feelings of inadequacy, while SAD focuses on fear of specific social performance situations."
  },
    interventions: {
    pharma: [
      {name:'SSRIs', target:['RAPHE','BLA','mPFC'], mechanism:'Same approach as social anxiety but longer treatment duration expected', evidence:'B', cite:'Extrapolated from SAD literature; limited AVPD-specific trials'},
    ],
    therapy: [
      {name:'Schema Therapy', target:['mPFC','BLA','vmPFC','OXY'], mechanism:'Addresses defectiveness/shame schema. Builds healthy adult mode.', evidence:'A', cite:'Bamelis et al. 2014 JAMA Psychiatry 71(3):255-62'},
      {name:'CBT (graduated social exposure)', target:['dlPFC','vmPFC','BLA','NAcc'], mechanism:'Behavioral experiments challenging avoidance + cognitive restructuring of inadequacy beliefs', evidence:'B', cite:'Emmelkamp et al. 2006 J Pers Disord 20(3):310-20'},
      {name:'Group therapy', target:['VV','OXY','STS','TPJ'], mechanism:'Social engagement circuit activation in safe environment', evidence:'B', cite:'Alden & Capreol 1993 Behav Res Ther 31(8):723-35'},
    ],
    somatic: [
      {name:"Social skills training + graduated exposure", target:["BLA","vmPFC","STS","TPJ"], mechanism:"Behavioral activation of social circuits with extinction of avoidance", evidence:"B", cite:"Alden & Taylor 2011; Herbert et al. 2005"}
    ],
    nutrition: [
      {name:"L-Theanine (200mg)", target:["GABA_GLU","dACC"], mechanism:"Reduces anticipatory anxiety, supports calm engagement", evidence:"C", cite:"Hidese et al. 2019"},
      {name:"Magnesium glycinate", target:["GABA_GLU","BLA"], mechanism:"GABAergic anxiolysis", evidence:"C", cite:"Boyle et al. 2017"}
    ],
    supplements: []
  }
},

// ─────────────────────────────────────────────────
// ATTACHMENT / DEVELOPMENTAL
// ─────────────────────────────────────────────────

'RAD': {
  name: 'Reactive Attachment Disorder',
  dsm5: '313.89 (F94.1)',
  prevalence: 'Rare (~1% institutionalized children); requires history of neglect',
  summary: 'Attachment circuitry never properly developed due to early deprivation. Oxytocin system underdeveloped. Ventral vagal social engagement system never calibrated through co-regulation. Amygdala-PFC circuits shaped by absence rather than presence.',
  circuits: [
    {node:'OXY',    dir:'hypo', detail:'Oxytocin system never properly calibrated — no reliable caregiver to co-regulate with', evidence:'A', cite:'Fries et al. 2005 PNAS 102(47):17237-40'},
    {node:'VV',     dir:'hypo', detail:'Ventral vagal social engagement system not exercised during critical period', evidence:'B', cite:'Porges 2011; Hostinar et al. 2014 Dev Psychopathol 26(4pt2):1635-53'},
    {node:'vmPFC',  dir:'hypo', detail:'Regulatory capacity not scaffolded by attuned caregiving', evidence:'A', cite:'Tottenham & Galvan 2016 Curr Opin Behav Sci 7:109-14'},
    {node:'BLA',    dir:'hyper', detail:'Amygdala hyperreactive — threat detection biased by early deprivation', evidence:'A', cite:'Tottenham et al. 2010 Dev Sci 13(1):46-61'},
    {node:'mPFC',   dir:'altered', detail:'Self-referential DMN shaped by absence of mirroring — "I am unseen/unworthy"', evidence:'B', cite:'Tottenham & Galvan 2016'},
    {node:'HIPP',   dir:'altered', detail:'Stress-exposed hippocampus during development → memory integration difficulties', evidence:'A', cite:'Teicher et al. 2012 Neuropsychopharmacology 37(3):773-92'},
    {node:'HPA',    dir:'altered', detail:'HPA axis programming altered by early deprivation — abnormal cortisol patterns', evidence:'A', cite:'Gunnar et al. 2001 Dev Psychopathol 13(3):611-28'},
    {node:'CCorp',  dir:'hypo', detail:'Institutional rearing associated with reduced corpus callosum volume', evidence:'A', cite:'Mehta et al. 2009 J Child Psychol Psychiatry 50(8):943-51'},
  ],
  criteria: {
    title: "Diagnostic Criteria 313.89 (F94.1)",
    sections: [
      {id:"A", text:"A consistent pattern of inhibited, emotionally withdrawn behavior toward adult caregivers, manifested by both:", items:["1. The child rarely or minimally seeks comfort when distressed.","2. The child rarely or minimally responds to comfort when distressed."]},
      {id:"B", text:"A persistent social and emotional disturbance characterized by at least 2 of the following:", items:["1. Minimal social and emotional responsiveness to others.","2. Limited positive affect.","3. Episodes of unexplained irritability, sadness, or fearfulness that are evident even during nonthreatening interactions with adult caregivers."]},
      {id:"C", text:"The child has experienced a pattern of extremes of insufficient care as evidenced by at least one of the following:", items:["1. Social neglect or deprivation in the form of persistent lack of having basic emotional needs for comfort, stimulation, and affection met by caregiving adults.","2. Repeated changes of primary caregivers that limit opportunities to form stable attachments.","3. Rearing in unusual settings that severely limit opportunities to form selective attachments."]},
      {id:"D", text:"The care in Criterion C is presumed to be responsible for the disturbed behavior in Criterion A."},
      {id:"E", text:"The criteria are not met for autism spectrum disorder."},
      {id:"F", text:"The disturbance is evident before age 5 years."},
      {id:"G", text:"The child has a developmental age of at least 9 months."}
    ],
    specifiers: ["Persistent (present for more than 12 months)"],
    severity: ["Severe (when a child exhibits all symptoms, each at relatively high levels)"],
    codingNote: "RAD is a disorder of early childhood. Specify if persistent. Specify current severity."
  },
    interventions: {
    pharma: [
      {name:'No established pharmacotherapy', target:[], mechanism:'No medication treats RAD. Comorbidities treated per those protocols.', evidence:'D', cite:'AACAP Practice Parameter 2005'},
    ],
    therapy: [
      {name:'TBRI (Trust-Based Relational Intervention)', target:['OXY','VV','vmPFC','BLA'], mechanism:'Structured relational approach — builds attachment through attuned caregiving within safe boundaries', evidence:'B', cite:'Purvis et al. 2013 Child Youth Serv Rev 35(5):859-68'},
      {name:'DDP (Dyadic Developmental Psychotherapy)', target:['OXY','VV','mPFC','BLA'], mechanism:'Caregiver-child dyad therapy with PACE (playfulness, acceptance, curiosity, empathy)', evidence:'B', cite:'Becker-Weidman 2006 Child Adolesc Soc Work J 23(2):147-71'},
      {name:'Theraplay', target:['VV','OXY','S1','AI'], mechanism:'Structured play-based attachment therapy. Sensory co-regulation.', evidence:'B', cite:'Wettig et al. 2011 Int J Play Ther 20(1):12-25'},
    
      {name:"Dyadic Developmental Psychotherapy", target:["OXY","VV","mPFC","BLA"], mechanism:"Attachment-focused intersubjective therapy rebuilding caregiver-child attunement", evidence:"C", cite:"Hughes 2004; Becker-Weidman 2006 Child Adolesc Soc Work J 23:147-71"},
    ],
    somatic: [
      {name:'Co-regulation activities', target:['VV','OXY','NTS'], mechanism:'Rocking, rhythmic activities, synchronized movement with caregiver → ventral vagal activation', evidence:'C', cite:'Porges 2011; clinical consensus'},
    ],
    nutrition: [
      {name:"Omega-3", target:["BDNF","mPFC"], mechanism:"Neuroplasticity support during critical developmental window", evidence:"C", cite:"Richardson & Montgomery 2005 Pediatrics 115(5):1360-6"},
      {name:"Iron and Zinc screening/supplementation", target:["VTA","dlPFC"], mechanism:"Common deficiencies in neglected populations. Essential for neurodevelopment.", evidence:"B", cite:"Georgieff 2007 Am J Clin Nutr 85(2):614S-20S"}
    ],
    supplements: []
  }
},

// ─────────────────────────────────────────────────
// REPRODUCTIVE PSYCHIATRY
// ─────────────────────────────────────────────────

'PMDD': {
  name: 'Premenstrual Dysphoric Disorder',
  dsm5: '625.4 (N94.3)',
  prevalence: '~3-8% of menstruating individuals',
  summary: 'Abnormal CNS sensitivity to normal hormonal fluctuations. GABA-A receptor subunit expression changes with progesterone metabolite (allopregnanolone) flux. Amygdala reactivity increases luteal phase. Serotonergic function declines premenstrually.',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Amygdala reactivity increases in luteal phase — threat sensitivity amplified', evidence:'A', cite:'Protopopescu et al. 2005 PNAS 102(44):16060-5'},
    {node:'vmPFC',  dir:'hypo', detail:'Prefrontal regulation of amygdala impaired premenstrually', evidence:'A', cite:'Protopopescu et al. 2005'},
    {node:'RAPHE',  dir:'altered', detail:'Serotonergic tone drops premenstrually — irritability, mood lability', evidence:'A', cite:'Halbreich & Kahn 2001 Psychoneuroendocrinology 26(3):253-75'},
    {node:'GABA_GLU', dir:'altered', detail:'Allopregnanolone (progesterone metabolite) modulates GABA-A receptor. Sensitivity to this modulation = PMDD.', evidence:'A', cite:'Bixo et al. 2018 Am J Psychiatry 175(5):453-62'},
    {node:'AI',     dir:'hyper', detail:'Interoceptive amplification of somatic symptoms premenstrually', evidence:'B', cite:'Bannbers et al. 2012 Neuropsychopharmacology 37(11):2421-32'},
    {node:'HPA',    dir:'altered', detail:'Cortisol response blunted in PMDD — paradoxical stress response', evidence:'B', cite:'Kask et al. 2008 Psychoneuroendocrinology 33(4):540-8'},
    {node:'mPFC',   dir:'hyper', detail:'Ruminative self-referential processing increases premenstrually', evidence:'C', cite:'Baller et al. 2013 Biol Psychiatry 74(7):510-7'},
  ],
  criteria: {
    title: "Diagnostic Criteria 625.4 (N94.3)",
    sections: [
      {id:"A", text:"In the majority of menstrual cycles, at least 5 symptoms must be present in the final week before the onset of menses, start to improve within a few days after the onset of menses, and become minimal or absent in the week postmenses."},
      {id:"B", text:"One (or more) of the following symptoms must be present:", items:["1. Marked affective lability (e.g., mood swings; feeling suddenly sad or tearful, or increased sensitivity to rejection).","2. Marked irritability or anger or increased interpersonal conflicts.","3. Marked depressed mood, feelings of hopelessness, or self-deprecating thoughts.","4. Marked anxiety, tension, and/or feelings of being keyed up or on edge."]},
      {id:"C", text:"One (or more) of the following symptoms must additionally be present, to reach a total of 5 symptoms when combined with symptoms from Criterion B:", items:["1. Decreased interest in usual activities.","2. Subjective difficulty in concentration.","3. Lethargy, easy fatigability, or marked lack of energy.","4. Marked change in appetite; overeating; or specific food cravings.","5. Hypersomnia or insomnia.","6. A sense of being overwhelmed or out of control.","7. Physical symptoms such as breast tenderness or swelling, joint or muscle pain, a sensation of \"bloating,\" or weight gain."]},
      {id:"D", text:"The symptoms are associated with clinically significant distress or interference with work, school, usual social activities, or relationships with others."},
      {id:"E", text:"The disturbance is not merely an exacerbation of the symptoms of another disorder."},
      {id:"F", text:"Criterion A should be confirmed by prospective daily ratings during at least 2 symptomatic cycles."}
    ],
    specifiers: [],
    severity: [],
    codingNote: "Prospective daily symptom charting for at least 2 cycles is required for definitive diagnosis. Classified under Depressive Disorders in DSM-5."
  },
    interventions: {
    pharma: [
      {name:'SSRIs (continuous or luteal-phase dosing)', target:['RAPHE','BLA','vmPFC'], mechanism:'First-line. Can dose luteal phase only (day 14-28). Rapid onset in PMDD (vs weeks for MDD).', evidence:'A', cite:'Marjoribanks et al. 2013 Cochrane Database Syst Rev'},
      {name:'Oral contraceptives (drospirenone/EE)', target:['GABA_GLU','HPA','HYPO'], mechanism:'Ovulation suppression → eliminates hormonal cycling trigger', evidence:'A', cite:'Lopez et al. 2012 Cochrane Database Syst Rev'},
      {name:'GnRH agonists (severe/refractory)', target:['HYPO','PIT'], mechanism:'Chemical menopause → eliminates ovarian cycling. Add-back HRT needed.', evidence:'A', cite:'Wyatt et al. 2004 Cochrane Database Syst Rev'},
      {name:'Sepranolone (investigational)', target:['GABA_GLU'], mechanism:'Allopregnanolone antagonist → blocks GABA-A receptor sensitivity to progesterone metabolite', evidence:'B', cite:'Bixo et al. 2018 Am J Psychiatry 175(5):453-62'},
    ],
    therapy: [
      {name:'CBT for PMDD', target:['dlPFC','mPFC','AI'], mechanism:'Cognitive restructuring of premenstrual cognitions + coping skills', evidence:'A', cite:'Kleinstauber et al. 2012 Behav Res Ther 50(2):129-40'},
    ],
    somatic: [
      {name:'Aerobic exercise', target:['BDNF','VTA','HPA','VV'], mechanism:'Reduces symptom severity across multiple domains', evidence:'A', cite:'Daley 2009 Clin Obstet Gynecol 52(3):557-67'},
    ],
    nutrition: [
      {name:'Calcium (1200mg/day)', target:['SNS','BLA'], mechanism:'Calcium fluctuation parallels PMDD symptoms. Supplementation reduces severity.', evidence:'A', cite:'Thys-Jacobs et al. 1998 Am J Obstet Gynecol 179(2):444-52'},
      {name:'Vitamin B6 (50-100mg)', target:['RAPHE'], mechanism:'Cofactor in serotonin synthesis', evidence:'B', cite:'Wyatt et al. 1999 BMJ 318(7195):1375-81'},
      {name:'Magnesium', target:['GABA_GLU','SNS'], mechanism:'GABAergic support, smooth muscle relaxation', evidence:'B', cite:'Quaranta et al. 2007 Magnes Res 20(2):126-30'},
    
      {name:"Calcium (1200mg/day)", target:["HPA","GABA_GLU"], mechanism:"Reduces mood, behavioral, and physical symptoms. Large RCT evidence.", evidence:"A", cite:"Thys-Jacobs et al. 1998 Am J Obstet Gynecol 179(2):444-52"},
    ],
    supplements: [
      {name:'Vitex agnus-castus (chasteberry 20mg)', target:['HYPO','PIT'], mechanism:'Dopaminergic activity at pituitary → reduces prolactin → hormonal modulation', evidence:'A', cite:'Schellenberg 2001 BMJ 322(7279):134-7'},
    
      {name:"Vitex agnus-castus (chasteberry)", target:["HYPO","HPA"], mechanism:"Dopaminergic modulation of prolactin, modulates luteal hormone fluctuations", evidence:"B", cite:"Schellenberg 2001 BMJ 322(7279):134-7"},
      {name:"Magnesium + B6", target:["GABA_GLU","RAPHE"], mechanism:"Combined serotonin/GABA support during luteal phase. Synergistic effect.", evidence:"B", cite:"Fathizadeh et al. 2010 Iran J Nurs Midwifery Res 15(1):401-5"},
    ]
  }
},

// ─────────────────────────────────────────────────
// ADJUSTMENT DISORDERS
// ─────────────────────────────────────────────────

'ADJUSTMENT': {
  name: 'Adjustment Disorder',
  dsm5: '309.x (F43.2x)',
  prevalence: '~2-8% (very common in medical settings)',
  summary: 'Acute stress response that exceeds normal adaptation but does not meet criteria for MDD, GAD, or PTSD. Allostatic load temporarily exceeds regulatory capacity. HPA activated but not yet dysregulated. DMN processing the stressor but not yet locked.',
  circuits: [
    {node:'HPA',    dir:'hyper', detail:'Stress response engaged — appropriate but overwhelming current coping capacity', evidence:'B', cite:'McEwen 1998 N Engl J Med 338(3):171-9'},
    {node:'BLA',    dir:'hyper', detail:'Threat detection mildly elevated related to stressor', evidence:'C', cite:'General stress neuroscience'},
    {node:'mPFC',   dir:'hyper', detail:'DMN processing stressor — ruminative but not locked like MDD', evidence:'C', cite:'General DMN stress literature'},
    {node:'VV',     dir:'hypo', detail:'Vagal tone slightly reduced by acute stress', evidence:'B', cite:'Thayer et al. 2012'},
    {node:'dlPFC',  dir:'hypo', detail:'Executive resources temporarily exceeded by stressor demand', evidence:'C', cite:'Arnsten 2009 Nat Rev Neurosci 10(6):410-22'},
    {node:'dACC',   dir:'hyper', detail:'Distress/conflict signal active', evidence:'C', cite:'General stress neuroscience'},
  ],
  criteria: {
    title: "Diagnostic Criteria 309.x (F43.2x)",
    sections: [
      {id:"A", text:"The development of emotional or behavioral symptoms in response to an identifiable stressor(s) occurring within 3 months of the onset of the stressor(s)."},
      {id:"B", text:"These symptoms or behaviors are clinically significant, as evidenced by one or both of the following:", items:["1. Marked distress that is out of proportion to the severity or intensity of the stressor, taking into account the external context and the cultural factors that might influence symptom severity and presentation.","2. Significant impairment in social, occupational, or other important areas of functioning."]},
      {id:"C", text:"The stress-related disturbance does not meet the criteria for another mental disorder and is not merely an exacerbation of a preexisting mental disorder."},
      {id:"D", text:"The symptoms do not represent normal bereavement."},
      {id:"E", text:"Once the stressor or its consequences have terminated, the symptoms do not persist for more than an additional 6 months."}
    ],
    specifiers: ["With depressed mood (F43.21)","With anxiety (F43.22)","With mixed anxiety and depressed mood (F43.23)","With disturbance of conduct (F43.24)","With mixed disturbance of emotions and conduct (F43.25)","Unspecified (F43.20)"],
    severity: ["Acute (less than 6 months)","Chronic (6 months or longer)"],
    codingNote: "Code based on subtype. Chronic specifier applies only if the duration of the disturbance is 6 months or longer in response to a chronic stressor or a stressor with enduring consequences."
  },
    interventions: {
    pharma: [
      {name:'Short-term anxiolytic if needed', target:['BLA','GABA_GLU'], mechanism:'Brief symptom relief while natural adaptation occurs. Avoid chronic use.', evidence:'B', cite:'Casey 2009 CNS Drugs 23(11):927-38'},
      {name:'Sleep support if disrupted', target:['PIN','HYPO','RF'], mechanism:'Sleep loss impairs coping. Short-term sleep aid if needed.', evidence:'B', cite:'Clinical consensus'},
    ],
    therapy: [
      {name:'Supportive counseling', target:['VV','mPFC','vmPFC'], mechanism:'Co-regulation, meaning-making, coping reinforcement. Often sufficient.', evidence:'A', cite:'Casey 2009 CNS Drugs 23(11):927-38'},
      {name:'Problem-solving therapy', target:['dlPFC','vmPFC','dACC'], mechanism:'Structured approach to stressor management', evidence:'A', cite:'Arean et al. 2010 JAMA 304(1):47-55'},
      {name:'Brief CBT', target:['dlPFC','mPFC','BLA'], mechanism:'Short-course cognitive restructuring + behavioral coping', evidence:'A', cite:'Strain & Diefenbacher 2008 Int J Psychiatry Med 38(2):127-58'},
    ],
    somatic: [
      {name:'Exercise', target:['BDNF','HPA','VV','VTA'], mechanism:'Stress buffer, HPA normalization, mood improvement', evidence:'A', cite:'Rebar et al. 2015 J Psychosom Res 79(4):243-52'},
      {name:'Sleep hygiene', target:['PIN','HYPO','RF'], mechanism:'Protect sleep during stress → preserves coping capacity', evidence:'A', cite:'Clinical consensus'},
    ],
    nutrition: [
      {name:'Anti-inflammatory diet', target:['GBA','HPA'], mechanism:'Stress increases inflammation → dietary support', evidence:'C', cite:'Dantzer et al. 2008'},
    ],
    supplements: [
      {name:'Ashwagandha', target:['HPA','HYPO','LC'], mechanism:'Adaptogenic — cortisol modulation during acute stress', evidence:'B', cite:'Lopresti et al. 2019 Medicine 98(37):e17186'},
    ]
  }
},

// ─────────────────────────────────────────────────
// PSYCHOTIC SPECTRUM (continued)
// ─────────────────────────────────────────────────

'SCHIZOAFFECTIVE': {
  name: 'Schizoaffective Disorder',
  dsm5: '295.70 (F25.x)',
  prevalence: '~0.3% (less common than schizophrenia alone)',
  summary: 'Combines schizophrenia circuit signature with mood episode circuitry. Psychotic features persist beyond mood episodes — distinguishing from mood disorders with psychotic features. Both DMN-salience aberrant coupling AND reward/HPA mood circuit dysregulation present simultaneously.',
  circuits: [
    {node:'DMN',    dir:'hyper', detail:'DMN intrusion during external processing, as in schizophrenia', evidence:'A', cite:'Whitfield-Gabrieli et al. 2009 PNAS 106(4):1279-84'},
    {node:'SN',     dir:'altered', detail:'Salience misattribution — internal events tagged as externally significant', evidence:'A', cite:'Palaniyappan & Liddle 2012 J Neurol Neurosurg Psychiatry 83(6):570-4'},
    {node:'VTA',    dir:'hyper', detail:'Dopamine excess in mesolimbic pathway → positive symptoms', evidence:'A', cite:'Howes & Kapur 2009 Schizophr Bull 35(3):549-62'},
    {node:'dlPFC',  dir:'hypo', detail:'Executive and cognitive impairment overlapping with schizophrenia pattern', evidence:'A', cite:'Keshavan et al. 2011 Prog Neuropsychopharmacol Biol Psychiatry 35(7):1681-95'},
    {node:'NAcc',   dir:'altered', detail:'Reward circuit oscillation during mood phases — hyper in mania, hypo in depression', evidence:'B', cite:'Tost et al. 2010 Psychiatry Res 183(1):1-9'},
    {node:'HPA',    dir:'altered', detail:'Cortisol dysregulation from both psychotic and mood components', evidence:'B', cite:'Walker et al. 2008 Psychol Med 38(4):451-62'},
    {node:'BLA',    dir:'hyper', detail:'Amygdala reactivity elevated — contributed by both psychotic and affective components', evidence:'B', cite:'Rauch et al. 2010 Psychiatry Res 182(3):217-26'},
    {node:'HIPP',   dir:'hyper', detail:'Hippocampal hyperactivity → source monitoring deficits', evidence:'A', cite:'Heckers & Konradi 2010 Schizophr Bull 36(3):545-50'},
    {node:'THAL',   dir:'altered', detail:'Thalamic gating impaired', evidence:'B', cite:'Anticevic et al. 2014 Am J Psychiatry 171(4):463-71'},
    {node:'mPFC',   dir:'hyper', detail:'Self-referential distortion with mood-congruent content', evidence:'B', cite:'Holt et al. 2011 Biol Psychiatry 70(4):329-36'},
  ],
  criteria: {
    title: "Diagnostic Criteria 295.70 (F25.0/F25.1)",
    sections: [
      {id:"A", text:"An uninterrupted period of illness during which there is a major mood episode (major depressive or manic) concurrent with Criterion A of schizophrenia (delusions, hallucinations, disorganized speech, disorganized/catatonic behavior, negative symptoms)."},
      {id:"B", text:"Delusions or hallucinations for 2 or more weeks in the absence of a major mood episode (depressive or manic) during the lifetime duration of the illness."},
      {id:"C", text:"Symptoms that meet criteria for a major mood episode are present for the majority of the total duration of the active and residual portions of the illness."},
      {id:"D", text:"The disturbance is not attributable to the effects of a substance or another medical condition."}
    ],
    specifiers: ["Bipolar type (F25.0): manic episode is part of the presentation","Depressive type (F25.1): only major depressive episodes are part of the presentation","With catatonia"],
    severity: [],
    codingNote: "Criterion B is critical for distinguishing schizoaffective disorder from mood disorder with psychotic features. The 2-week period of psychosis without mood symptoms is the key differentiator."
  },
    interventions: {
    pharma: [
      {name:'Antipsychotics (atypical)', target:['VTA','NAcc','THAL','BLA'], mechanism:'D2/5-HT2A antagonism. Required for psychotic component.', evidence:'A', cite:'Leucht et al. 2013 Lancet 382(9896):951-62'},
      {name:'Mood stabilizer (lithium or valproate)', target:['NAcc','VTA','BDNF','GABA_GLU'], mechanism:'Required for mood component. Lithium additionally neuroprotective.', evidence:'A', cite:'Basan & Leucht 2004 Cochrane Database Syst Rev'},
      {name:'Antidepressant (depressive type, with antipsychotic)', target:['RAPHE','mPFC'], mechanism:'Only with concurrent antipsychotic. Serotonergic augmentation for depressive episodes.', evidence:'B', cite:'APA Practice Guidelines 2020'},
    ],
    therapy: [
      {name:'Psychoeducation', target:['dlPFC','mPFC'], mechanism:'Illness management, prodrome recognition, medication adherence', evidence:'A', cite:'Lincoln et al. 2007 Schizophr Bull 33(3):671-80'},
      {name:'CBT for Psychosis', target:['dlPFC','mPFC','SN'], mechanism:'Reality testing, belief flexibility, coping with hallucinations', evidence:'A', cite:'Turner et al. 2014 Lancet Psychiatry 1(3):211-9'},
      {name:'Social Skills Training', target:['STS','TPJ','dlPFC'], mechanism:'Compensatory social cognition', evidence:'A', cite:'Kurtz & Mueser 2008 J Consult Clin Psychol 76(3):491-504'},
    ],
    somatic: [
      {name:'Exercise', target:['BDNF','HIPP','VTA','dlPFC'], mechanism:'Cognitive improvement, hippocampal support, mood stabilization', evidence:'A', cite:'Firth et al. 2017 Schizophr Bull 43(3):546-56'},
      {name:'Sleep regulation', target:['PIN','HYPO','LC'], mechanism:'Sleep disruption destabilizes both psychotic and mood components', evidence:'A', cite:'Harvey et al. 2015'},
    ],
    nutrition: [
      {name:'Omega-3', target:['BDNF','mPFC'], mechanism:'Anti-inflammatory, neuroprotective adjunct', evidence:'B', cite:'Amminger et al. 2010 Arch Gen Psychiatry 67(2):146-54'},
    ],
    supplements: [
      {name:'NAC', target:['GABA_GLU','dlPFC'], mechanism:'Glutamate modulation', evidence:'B', cite:'Berk et al. 2008 Biol Psychiatry 64(5):361-8'},
    ]
  }
},

// ─────────────────────────────────────────────────
// ANXIETY DISORDERS (continued)
// ─────────────────────────────────────────────────

'AGORAPHOBIA': {
  name: 'Agoraphobia',
  dsm5: '300.22 (F40.00)',
  prevalence: '~1.7% US adults (NIMH)',
  summary: 'Fear and avoidance of situations where escape might be difficult or help unavailable. Often comorbid with panic disorder but independently diagnosable. Amygdala-hippocampal spatial threat encoding combines with catastrophic interoceptive prediction. Avoidance behavior becomes self-reinforcing through negative reinforcement (striatal).',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Threat detection activated by environmental contexts (crowds, open spaces, transit)', evidence:'A', cite:'Gorman et al. 2000 Am J Psychiatry 157(4):493-505'},
    {node:'HIPP',   dir:'hyper', detail:'Spatial-contextual fear memory — specific places encoded as threatening', evidence:'B', cite:'Shin & Liberzon 2010 Neuropsychopharmacology 35(1):169-91'},
    {node:'AI',     dir:'hyper', detail:'Anticipatory interoceptive anxiety — imagining being in feared situation triggers body alarm', evidence:'A', cite:'Paulus & Stein 2006 Biol Psychiatry 60(4):383-7'},
    {node:'vmPFC',  dir:'hypo', detail:'Cannot generate safety signal for feared contexts', evidence:'B', cite:'Rauch et al. 2003 Psychiatry Res 124(2):69-78'},
    {node:'PAG',    dir:'hyper', detail:'Freeze/flight response primed for feared situations', evidence:'B', cite:'Mobbs et al. 2007 Science 317(5841):1079-83'},
    {node:'STRI',   dir:'hyper', detail:'Avoidance behavior habituated — negative reinforcement loop', evidence:'B', cite:'Schlund et al. 2016 Neurosci Biobehav Rev 66:37-47'},
    {node:'dACC',   dir:'hyper', detail:'Threat anticipation — catastrophic future simulation about going outside', evidence:'B', cite:'Etkin & Wager 2007 Am J Psychiatry 164(10):1476-88'},
    {node:'SNS',    dir:'hyper', detail:'Sympathetic activation in anticipation of feared situation', evidence:'A', cite:'Friedman & Thayer 1998 J Anxiety Disord 12(6):551-71'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.22 (F40.00)",
    sections: [
      {id:"A", text:"Marked fear or anxiety about 2 (or more) of the following five situations:", items:["1. Using public transportation.","2. Being in open spaces.","3. Being in enclosed places.","4. Standing in line or being in a crowd.","5. Being outside of the home alone."]},
      {id:"B", text:"The individual fears or avoids these situations because of thoughts that escape might be difficult or help might not be available in the event of developing panic-like symptoms or other incapacitating or embarrassing symptoms."},
      {id:"C", text:"The agoraphobic situations almost always provoke fear or anxiety."},
      {id:"D", text:"The agoraphobic situations are actively avoided, require the presence of a companion, or are endured with intense fear or anxiety."},
      {id:"E", text:"The fear or anxiety is out of proportion to the actual danger posed by the agoraphobic situations and to the sociocultural context."},
      {id:"F", text:"The fear, anxiety, or avoidance is persistent, typically lasting for 6 months or more."},
      {id:"G", text:"The fear, anxiety, or avoidance causes clinically significant distress or impairment."},
      {id:"H", text:"If another medical condition is present, the fear, anxiety, or avoidance is clearly excessive."},
      {id:"I", text:"The fear, anxiety, or avoidance is not better explained by the symptoms of another mental disorder."}
    ],
    specifiers: [],
    severity: [],
    codingNote: "In DSM-5, agoraphobia is diagnosed independently of panic disorder. Both diagnoses can be assigned if criteria for both are met."
  },
    interventions: {
    pharma: [
      {name:'SSRIs', target:['RAPHE','BLA','AI'], mechanism:'First-line. Reduces anticipatory anxiety and amygdala reactivity.', evidence:'A', cite:'Andrisano et al. 2013 J Psychopharmacol 27(8):733-42'},
      {name:'D-Cycloserine (exposure augmentation)', target:['BLA','GABA_GLU'], mechanism:'NMDA partial agonist before exposure sessions enhances extinction', evidence:'B', cite:'Hofmann et al. 2006 Arch Gen Psychiatry 63(3):298-304'},
    ],
    therapy: [
      {name:'CBT with in vivo exposure', target:['BLA','HIPP','vmPFC','dlPFC','STRI'], mechanism:'Gold standard. Graduated exposure to feared situations builds extinction memories. Breaks avoidance reinforcement.', evidence:'A', cite:'Pompoli et al. 2016 Cochrane Database Syst Rev'},
      {name:'VRET (Virtual Reality Exposure)', target:['BLA','HIPP','vmPFC'], mechanism:'Simulated exposure for patients too avoidant for initial in vivo work', evidence:'B', cite:'Carl et al. 2019 J Anxiety Disord 61:27-36'},
    ],
    somatic: [
      {name:'Breathing retraining', target:['VV','NTS','SNS'], mechanism:'Parasympathetic activation for in-situation panic management', evidence:'A', cite:'Meuret et al. 2010 J Consult Clin Psychol 78(5):691-704'},
      {name:'Exercise', target:['BDNF','HPA','LC'], mechanism:'Reduces anxiety sensitivity, builds distress tolerance', evidence:'B', cite:'Broman-Fulks et al. 2004 Behav Res Ther 42(3):257-68'},
    
      {name:"Interoceptive Exposure", target:["AI","dACC","BLA","VV"], mechanism:"Systematic provocation of feared body sensations to reduce catastrophic interpretation", evidence:"A", cite:"Craske et al. 2014 Behav Res Ther 58:10-23"},
    ],
    nutrition: [
      {name:'Caffeine reduction', target:['LC','SNS','AI'], mechanism:'Panicogenic substance worsens anticipatory arousal', evidence:'A', cite:'Charney et al. 1985 Arch Gen Psychiatry 42(3):233-43'},
    
      {name:"Magnesium glycinate", target:["GABA_GLU","BLA"], mechanism:"GABAergic anxiolysis support", evidence:"C", cite:"Boyle et al. 2017"},
      {name:"L-Theanine", target:["GABA_GLU","dACC"], mechanism:"Alpha oscillation modulation, reduces anticipatory anxiety", evidence:"C", cite:"Hidese et al. 2019"},
    ],
    supplements: []
  }
},

'SEPARATION_ANXIETY': {
  name: 'Separation Anxiety Disorder (Adult)',
  dsm5: '309.21 (F93.0)',
  prevalence: '~1.9% adults (often unrecognized in adult populations)',
  summary: 'Excessive fear of separation from attachment figures. Attachment circuit (oxytocin, ventral vagal) dysregulated. Amygdala hyperreactive to separation cues. Overlaps with panic circuitry — separation triggers panic-like autonomic cascade.',
  circuits: [
    {node:'OXY',    dir:'altered', detail:'Attachment system hyperactivated — oxytocin dynamics unstable around separation', evidence:'B', cite:'Feldman 2017 Neurosci Biobehav Rev 79:149-67'},
    {node:'BLA',    dir:'hyper', detail:'Separation cues trigger disproportionate threat response', evidence:'B', cite:'Shin & Liberzon 2010 Neuropsychopharmacology 35(1):169-91'},
    {node:'AI',     dir:'hyper', detail:'Anticipatory distress — interoceptive alarm at thought of separation', evidence:'B', cite:'Paulus & Stein 2006'},
    {node:'VV',     dir:'hypo', detail:'Ventral vagal co-regulation lost when attachment figure absent', evidence:'B', cite:'Porges 2011 Polyvagal Theory'},
    {node:'BNST',   dir:'hyper', detail:'Sustained anxious apprehension about potential separation', evidence:'B', cite:'Avery et al. 2016 J Neurosci 36(29):7614-21'},
    {node:'mPFC',   dir:'hyper', detail:'Ruminative worry about separation/loss scenarios', evidence:'C', cite:'Extrapolated from anxiety literature'},
    {node:'dACC',   dir:'hyper', detail:'Social pain activation — separation registered as painful', evidence:'A', cite:'Eisenberger et al. 2003 Science 302(5643):290-2'},
  ],
  criteria: {
    title: "Diagnostic Criteria 309.21 (F93.0)",
    sections: [
      {id:"A", text:"Developmentally inappropriate and excessive fear or anxiety concerning separation from those to whom the individual is attached, as evidenced by at least 3 of the following:", items:["1. Recurrent excessive distress when anticipating or experiencing separation from home or from major attachment figures.","2. Persistent and excessive worry about losing major attachment figures or about possible harm to them.","3. Persistent and excessive worry about experiencing an untoward event that causes separation from a major attachment figure.","4. Persistent reluctance or refusal to go out, away from home, to school, to work, or elsewhere because of fear of separation.","5. Persistent and excessive fear of or reluctance about being alone or without major attachment figures at home or in other settings.","6. Persistent reluctance or refusal to sleep away from home or to go to sleep without being near a major attachment figure.","7. Repeated nightmares involving the theme of separation.","8. Repeated complaints of physical symptoms when separation from major attachment figures occurs or is anticipated."]},
      {id:"B", text:"The fear, anxiety, or avoidance is persistent, lasting at least 4 weeks in children and adolescents and typically 6 months or more in adults."},
      {id:"C", text:"The disturbance causes clinically significant distress or impairment."},
      {id:"D", text:"The disturbance is not better explained by another mental disorder."}
    ],
    specifiers: [],
    severity: [],
    codingNote: "DSM-5 moved Separation Anxiety Disorder from \"Disorders Usually First Diagnosed in Infancy, Childhood, or Adolescence\" to \"Anxiety Disorders,\" acknowledging its occurrence across the lifespan."
  },
    interventions: {
    pharma: [
      {name:'SSRIs', target:['RAPHE','BLA','BNST'], mechanism:'First-line. Reduces separation-triggered anxiety cascade.', evidence:'A', cite:'Bandelow et al. 2015 World J Biol Psychiatry 16(5):300-7'},
    
      {name:"SSRIs (fluoxetine/sertraline)", target:["RAPHE","BLA","vmPFC","BNST"], mechanism:"First-line pharmacotherapy. Reduces anticipatory anxiety and catastrophic thinking.", evidence:"A", cite:"Strawn et al. 2015 Pharmacotherapy 35(11):1004-22"},
    ],
    therapy: [
      {name:'CBT (graduated exposure to separation)', target:['BLA','vmPFC','dlPFC','OXY'], mechanism:'Systematic desensitization to separation scenarios. Builds independent coping.', evidence:'A', cite:'Schneider et al. 2011 J Am Acad Child Adolesc Psychiatry 50(12):1235-45'},
      {name:'Attachment-focused therapy', target:['OXY','VV','mPFC'], mechanism:'Develop earned secure attachment. Internal working model revision.', evidence:'B', cite:'Mikulincer & Shaver 2007 Attachment in Adulthood'},
    ],
    somatic: [
      {name:'HRV biofeedback', target:['VV','NTS','dACC'], mechanism:'Build autonomic self-regulation capacity independent of co-regulation', evidence:'B', cite:'Goessl et al. 2017 Appl Psychophysiol Biofeedback 42(3):235-46'},
    ],
    nutrition: [
      {name:"Magnesium glycinate", target:["GABA_GLU","BLA"], mechanism:"GABAergic support, amygdala calming", evidence:"C", cite:"Boyle et al. 2017 Nutrients 9(5):429"},
      {name:"Omega-3", target:["BDNF","AI"], mechanism:"Anti-inflammatory, neuroplasticity support", evidence:"C", cite:"Kiecolt-Glaser et al. 2011 Brain Behav Immun 25(8):1725-34"}
    ],
    supplements: []
  }
},

'SELECTIVE_MUTISM': {
  name: 'Selective Mutism',
  dsm5: '312.23 (F94.0)',
  prevalence: '~0.7-2% children. Can persist into adulthood if untreated.',
  summary: 'Consistent failure to speak in specific social situations despite speaking in others. Amygdala threat response to social-evaluative contexts freezes speech motor output. Not a speech/language disorder — a social anxiety variant affecting speech circuits specifically.',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Social-evaluative threat freezes vocal output — amygdala hijack of speech', evidence:'B', cite:'Muris & Ollendick 2015 Clin Child Fam Psychol Rev 18(4):252-71'},
    {node:'BROCA',  dir:'hypo', detail:'Speech production area suppressed by amygdala-driven freeze — not damaged', evidence:'C', cite:'Henkin & Bar-Haim 2015 J Commun Disord 58:84-93'},
    {node:'PAG',    dir:'hyper', detail:'Freeze response specifically targeting vocalization', evidence:'C', cite:'Kozlowska et al. 2015 Harv Rev Psychiatry 23(4):263-81'},
    {node:'LAR',    dir:'hypo', detail:'Laryngeal motor output frozen by defensive cascade', evidence:'C', cite:'Clinical inference from freeze response literature'},
    {node:'AI',     dir:'hyper', detail:'Social anxiety interoceptive component', evidence:'B', cite:'Muris & Ollendick 2015'},
    {node:'STS',    dir:'hyper', detail:'Social perception hypervigilance in unfamiliar social contexts', evidence:'C', cite:'Extrapolated from social anxiety literature'},
    {node:'dACC',   dir:'hyper', detail:'Error monitoring amplified in social-evaluative settings', evidence:'C', cite:'Extrapolated from social anxiety literature'},
  ],
  criteria: {
    title: "Diagnostic Criteria 312.23 (F94.0)",
    sections: [
      {id:"A", text:"Consistent failure to speak in specific social situations in which there is an expectation for speaking (e.g., at school) despite speaking in other situations."},
      {id:"B", text:"The disturbance interferes with educational or occupational achievement or with social communication."},
      {id:"C", text:"The duration of the disturbance is at least 1 month (not limited to the first month of school)."},
      {id:"D", text:"The failure to speak is not attributable to a lack of knowledge of, or comfort with, the spoken language required in the social situation."},
      {id:"E", text:"The disturbance is not better explained by a communication disorder and does not occur exclusively during the course of autism spectrum disorder, schizophrenia, or another psychotic disorder."}
    ],
    specifiers: [],
    severity: [],
    codingNote: "Classified as an Anxiety Disorder in DSM-5. Most common onset is before age 5 but may not come to clinical attention until school entry."
  },
    interventions: {
    pharma: [
      {name:'SSRIs (fluoxetine)', target:['RAPHE','BLA','dACC'], mechanism:'Reduces social anxiety component. Often used when behavioral interventions insufficient alone.', evidence:'B', cite:'Black & Uhde 1994 J Am Acad Child Adolesc Psychiatry 33(7):1000-6; Carlson et al. 2008'},
    
      {name:"Fluoxetine (low-dose)", target:["RAPHE","BLA","dACC"], mechanism:"SSRI reduces social anxiety circuit hyperactivation enabling speech", evidence:"B", cite:"Black & Uhde 1994 J Am Acad Child Adolesc Psychiatry 33(7):1000-6"},
    ],
    therapy: [
      {name:'Behavioral exposure (graduated brave talking)', target:['BLA','BROCA','vmPFC','PAG'], mechanism:'Systematic shaping from nonverbal → whisper → verbal in feared settings. Stimulus fading, sliding in.', evidence:'A', cite:'Bergman et al. 2013 J Am Acad Child Adolesc Psychiatry 52(10):1068-78'},
      {name:'Defocused communication', target:['BLA','dACC','BROCA'], mechanism:'Reduce evaluative pressure — engage in parallel activities where speech is incidental', evidence:'B', cite:'Johnson & Wintgens 2016 The Selective Mutism Resource Manual'},
    ],
    somatic: [
      {name:"Graduated behavioral exposure (Brave program)", target:["BLA","vmPFC","VV"], mechanism:"Systematic desensitization to speaking contexts with sliding scale", evidence:"B", cite:"Bergman et al. 2013 Behav Modif 37(4):559-78"}
    ],
    nutrition: [],
    supplements: []
  }
},

// ─────────────────────────────────────────────────
// DISRUPTIVE / IMPULSE-CONTROL DISORDERS
// ─────────────────────────────────────────────────

'CONDUCT': {
  name: 'Conduct Disorder',
  dsm5: '312.xx (F91.x)',
  prevalence: '~2-10% children/adolescents',
  summary: 'Repetitive violation of others\' rights and social norms. Overlaps with ASPD circuitry but in developmental context. Amygdala hyporesponsive to distress cues (callous-unemotional subtype) OR hyperreactive (reactive aggression subtype). Two distinct circuit profiles.',
  circuits: [
    {node:'BLA',    dir:'altered', detail:'Callous-unemotional: amygdala underresponsive to fear/distress. Reactive: amygdala hyperresponsive to perceived threat.', evidence:'A', cite:'Blair 2013 Trends Cogn Sci 17(7):295-310'},
    {node:'vmPFC',  dir:'hypo', detail:'Moral/social decision-making impaired. Reduced punishment sensitivity.', evidence:'A', cite:'Finger et al. 2008 Arch Gen Psychiatry 65(5):586-94'},
    {node:'OFC',    dir:'hypo', detail:'Outcome prediction and reinforcement learning impaired', evidence:'A', cite:'Finger et al. 2008'},
    {node:'dlPFC',  dir:'hypo', detail:'Executive control deficit → impulsivity, poor planning', evidence:'A', cite:'Rubia et al. 2009 Am J Psychiatry 166(1):83-94'},
    {node:'AI',     dir:'hypo', detail:'Empathic distress response reduced — does not feel uncomfortable at others\' pain', evidence:'A', cite:'Lockwood et al. 2013 Curr Biol 23(10):901-5'},
    {node:'STRI',   dir:'altered', detail:'Reward processing atypical — immediate gratification overvalued', evidence:'B', cite:'Finger et al. 2011 Am J Psychiatry 168(2):152-62'},
    {node:'NAcc',   dir:'hyper', detail:'Reward sensitivity elevated for immediate reinforcement', evidence:'B', cite:'Finger et al. 2011'},
    {node:'dACC',   dir:'hypo', detail:'Error monitoring and conflict detection reduced', evidence:'B', cite:'Rubia et al. 2009'},
  ],
  criteria: {
    title: "Diagnostic Criteria 312.xx (F91.x)",
    sections: [
      {id:"A", text:"A repetitive and persistent pattern of behavior in which the basic rights of others or major age-appropriate societal norms or rules are violated, as manifested by the presence of at least 3 of the following 15 criteria in the past 12 months from any of the categories below, with at least 1 criterion present in the past 6 months:", items:["Aggression to People and Animals: (1) Often bullies, threatens, or intimidates others. (2) Often initiates physical fights. (3) Has used a weapon that can cause serious physical harm. (4) Has been physically cruel to people. (5) Has been physically cruel to animals. (6) Has stolen while confronting a victim. (7) Has forced someone into sexual activity.","Destruction of Property: (8) Has deliberately engaged in fire setting with the intention of causing serious damage. (9) Has deliberately destroyed others' property.","Deceitfulness or Theft: (10) Has broken into someone else's house, building, or car. (11) Often lies to obtain goods or favors or to avoid obligations. (12) Has stolen items of nontrivial value without confronting a victim.","Serious Violations of Rules: (13) Often stays out at night despite parental prohibitions, beginning before age 13. (14) Has run away from home overnight at least twice. (15) Is often truant from school, beginning before age 13."]},
      {id:"B", text:"The disturbance in behavior causes clinically significant impairment in social, academic, or occupational functioning."},
      {id:"C", text:"If the individual is age 18 years or older, criteria are not met for antisocial personality disorder."}
    ],
    specifiers: ["Childhood-onset type (prior to age 10)","Adolescent-onset type (no symptoms prior to age 10)","Unspecified onset","With limited prosocial emotions (callous-unemotional traits)"],
    severity: ["Mild","Moderate","Severe"],
    codingNote: "The \"with limited prosocial emotions\" specifier requires at least 2 of: lack of remorse/guilt, callous-lack of empathy, unconcerned about performance, shallow or deficient affect — persistently over at least 12 months across multiple settings."
  },
    interventions: {
    pharma: [
      {name:'No FDA-approved medications for CD', target:[], mechanism:'Comorbidities treated individually (ADHD, depression, irritability).', evidence:'D', cite:'AACAP Practice Parameter 2007'},
      {name:'Risperidone (severe aggression)', target:['VTA','BLA','NAcc'], mechanism:'Reduces reactive aggression component. Short-term use.', evidence:'B', cite:'Findling et al. 2000 J Am Acad Child Adolesc Psychiatry 39(4):509-16'},
      {name:'Stimulants (if comorbid ADHD)', target:['STRI','dlPFC','dACC'], mechanism:'Improves executive control. Reduces impulsive aggression.', evidence:'A', cite:'Connor et al. 2002 J Am Acad Child Adolesc Psychiatry 41(6):614-23'},
    ],
    therapy: [
      {name:'MST (Multisystemic Therapy)', target:['vmPFC','dlPFC','OXY','VV'], mechanism:'Family + school + peer systems. Addresses environmental reinforcement of antisocial behavior.', evidence:'A', cite:'Henggeler et al. 2009 J Consult Clin Psychol 77(1):26-37'},
      {name:'Parent Management Training', target:['STRI','vmPFC','OXY'], mechanism:'Trains parents in contingency management — restructures reinforcement environment', evidence:'A', cite:'Kazdin 2005 J Clin Child Adolesc Psychol 34(3):548-58'},
      {name:'FFT (Functional Family Therapy)', target:['OXY','VV','vmPFC'], mechanism:'Reduces family conflict, improves communication, restructures relational patterns', evidence:'A', cite:'Alexander et al. 2013 Functional Family Therapy'},
    ],
    somatic: [
      {name:'Exercise (structured sports/martial arts)', target:['dlPFC','STRI','VTA','BDNF'], mechanism:'Impulse control training, prosocial structure, dopamine regulation', evidence:'B', cite:'Barzegari et al. 2012 Procedia Soc Behav Sci 69:1902-5'},
    ],
    nutrition: [
      {name:'Omega-3', target:['dlPFC','BLA'], mechanism:'Aggression reduction in youth (prison and community studies)', evidence:'B', cite:'Raine et al. 2015 J Child Psychol Psychiatry 56(9):1043-53'},
    
      {name:"Omega-3 (EPA/DHA)", target:["vmPFC","dlPFC","BLA"], mechanism:"Significant aggression reduction in youth. Multiple RCTs.", evidence:"A", cite:"Raine et al. 2015 J Child Psychol Psychiatry 56(5):509-20"},
      {name:"Multi-micronutrient supplementation", target:["dlPFC","VTA","RAPHE"], mechanism:"Broad nutritional support reduces antisocial behavior in institutionalized populations", evidence:"B", cite:"Gesch et al. 2002 Br J Psychiatry 181:22-8"},
    ],
    supplements: []
  }
},

'ODD': {
  name: 'Oppositional Defiant Disorder',
  dsm5: '313.81 (F91.3)',
  prevalence: '~3.3% (children/adolescents)',
  summary: 'Angry/irritable mood, argumentative behavior, vindictiveness. Distinct from conduct disorder — ODD lacks serious aggression and rights violations. Frustrative non-reward circuitry hyperactive. Amygdala-PFC emotion regulation impaired.',
  circuits: [
    {node:'BLA',    dir:'hyper', detail:'Frustration/anger threshold lowered — threat response to authority/perceived unfairness', evidence:'A', cite:'Leibenluft 2011 Am J Psychiatry 168(2):129-42'},
    {node:'vmPFC',  dir:'hypo', detail:'Emotion regulation of anger/frustration impaired', evidence:'A', cite:'Marsh et al. 2008 Am J Psychiatry 165(8):1006-14'},
    {node:'OFC',    dir:'altered', detail:'Frustrative non-reward — expected reward not received triggers outsized anger', evidence:'A', cite:'Blair 2013 Trends Cogn Sci 17(7):295-310'},
    {node:'dlPFC',  dir:'hypo', detail:'Executive control of emotional behavior reduced', evidence:'B', cite:'Rubia et al. 2009 Am J Psychiatry 166(1):83-94'},
    {node:'dACC',   dir:'hyper', detail:'Conflict detection amplified — reads authority as threat', evidence:'B', cite:'Leibenluft 2011'},
    {node:'NAcc',   dir:'altered', detail:'Reward expectation disrupted — frustrative non-reward activates anger circuit', evidence:'B', cite:'Blair 2013'},
    {node:'AI',     dir:'hyper', detail:'Interoceptive anger amplification', evidence:'C', cite:'Leibenluft 2011'},
  ],
  criteria: {
    title: "Diagnostic Criteria 313.81 (F91.3)",
    sections: [
      {id:"A", text:"A pattern of angry/irritable mood, argumentative/defiant behavior, or vindictiveness lasting at least 6 months as evidenced by at least 4 symptoms from any of the following categories, and exhibited during interaction with at least one individual who is not a sibling:", items:["Angry/Irritable Mood: (1) Often loses temper. (2) Is often touchy or easily annoyed. (3) Is often angry and resentful.","Argumentative/Defiant Behavior: (4) Often argues with authority figures or, for children and adolescents, with adults. (5) Often actively defies or refuses to comply with requests from authority figures or with rules. (6) Often deliberately annoys others. (7) Often blames others for his or her mistakes or misbehavior.","Vindictiveness: (8) Has been spiteful or vindictive at least twice within the past 6 months."]},
      {id:"B", text:"The disturbance in behavior is associated with distress in the individual or others in his or her immediate social context, or it impacts negatively on social, educational, occupational, or other important areas of functioning."},
      {id:"C", text:"The behaviors do not occur exclusively during the course of a psychotic, substance use, depressive, or bipolar disorder. Also, the criteria are not met for disruptive mood dysregulation disorder."}
    ],
    specifiers: [],
    severity: ["Mild (symptoms confined to only one setting)","Moderate (some symptoms in at least two settings)","Severe (some symptoms in three or more settings)"],
    codingNote: "For children younger than 5, the behavior should occur on most days for at least 6 months. For individuals 5 years or older, the behavior should occur at least once per week for at least 6 months."
  },
    interventions: {
    pharma: [
      {name:'No FDA-approved medications for ODD', target:[], mechanism:'Treat comorbidities (ADHD, anxiety, depression)', evidence:'D', cite:'Steiner et al. 2007 CNS Spectr 12(7):546-51'},
      {name:'Stimulants (if comorbid ADHD)', target:['STRI','dlPFC','dACC'], mechanism:'Improves executive regulation of frustration response', evidence:'A', cite:'MTA Cooperative Group 1999'},
    ],
    therapy: [
      {name:'Parent Management Training (PMT)', target:['STRI','vmPFC','OXY'], mechanism:'Gold standard. Restructures parent-child reinforcement patterns. Reduces coercive cycles.', evidence:'A', cite:'Eyberg et al. 2008 J Clin Child Adolesc Psychol 37(1):215-37'},
      {name:'PCIT (Parent-Child Interaction Therapy)', target:['OXY','VV','vmPFC','BLA'], mechanism:'Live-coached parent-child sessions. Builds positive interaction, sets consistent limits.', evidence:'A', cite:'Thomas & Zimmer-Gembeck 2007 J Abnorm Child Psychol 35(3):475-95'},
      {name:'CBT (anger management)', target:['dlPFC','vmPFC','BLA','dACC'], mechanism:'Cognitive restructuring of hostile attributions + coping skills for frustration', evidence:'A', cite:'Sukhodolsky et al. 2004 Aggress Violent Behav 9(3):247-69'},
      {name:'Collaborative Problem Solving (CPS)', target:['dlPFC','OFC','vmPFC'], mechanism:'Identifies lagging skills, solves problems collaboratively rather than through control', evidence:'B', cite:'Greene et al. 2004 J Consult Clin Psychol 72(6):1157-64'},
    ],
    somatic: [
      {name:'Exercise', target:['VTA','BDNF','dlPFC'], mechanism:'Frustration outlet, executive function improvement', evidence:'C', cite:'Clinical consensus'},
    ],
    nutrition: [
      {name:"Omega-3 (EPA/DHA)", target:["vmPFC","dlPFC","BLA"], mechanism:"Reduces reactive aggression, improves emotion regulation", evidence:"B", cite:"Raine et al. 2015"},
      {name:"Iron/Zinc screening", target:["VTA","dlPFC"], mechanism:"Deficiency linked to irritability and impulsivity", evidence:"C", cite:"Konofal et al. 2008"}
    ],
    supplements: []
  }
},

// ─────────────────────────────────────────────────
// BEHAVIORAL ADDICTIONS
// ─────────────────────────────────────────────────

'GAMBLING': {
  name: 'Gambling Disorder',
  dsm5: '312.31 (F63.0)',
  prevalence: '~0.2-0.3% severe; ~1-3% any level (APA)',
  summary: 'Behavioral addiction sharing core circuitry with substance use disorders. Reward circuit hijacked by intermittent reinforcement schedule — the most powerful conditioning schedule. Near-miss signals maintain behavior through reward prediction error. Prefrontal control degraded.',
  circuits: [
    {node:'NAcc',   dir:'hyper', detail:'Reward anticipation amplified by gambling cues. Near-miss activates reward circuit as if win.', evidence:'A', cite:'Clark et al. 2009 PNAS 106(7):2583-7'},
    {node:'VTA',    dir:'altered', detail:'Dopaminergic sensitization to gambling-related stimuli', evidence:'A', cite:'Linnet et al. 2011 Neuroimage 57(1):138-45'},
    {node:'dlPFC',  dir:'hypo', detail:'Impulse control impaired — cannot stop despite mounting losses', evidence:'A', cite:'Potenza et al. 2003 Arch Gen Psychiatry 60(8):828-36'},
    {node:'vmPFC',  dir:'hypo', detail:'Value computation distorted — sunk cost fallacy, loss chasing', evidence:'A', cite:'Potenza et al. 2003'},
    {node:'OFC',    dir:'hyper', detail:'Cue reactivity — gambling environments trigger craving', evidence:'A', cite:'Crockford et al. 2005 NeuroReport 16(16):1849-52'},
    {node:'AI',     dir:'hyper', detail:'Excitement/anticipation interoception amplified', evidence:'B', cite:'Clark et al. 2009'},
    {node:'STRI',   dir:'hyper', detail:'Habitual gambling behavior — putamen-driven automatic play', evidence:'B', cite:'van Holst et al. 2010 Neurosci Biobehav Rev 34(1):87-97'},
    {node:'dACC',   dir:'altered', detail:'Error monitoring impaired — does not appropriately register losses', evidence:'B', cite:'Potenza et al. 2003'},
  ],
  criteria: {
    title: "Diagnostic Criteria 312.31 (F63.0)",
    sections: [
      {id:"A", text:"Persistent and recurrent problematic gambling behavior leading to clinically significant impairment or distress, as indicated by the individual exhibiting 4 (or more) of the following in a 12-month period:", items:["1. Needs to gamble with increasing amounts of money in order to achieve the desired excitement.","2. Is restless or irritable when attempting to cut down or stop gambling.","3. Has made repeated unsuccessful efforts to control, cut back, or stop gambling.","4. Is often preoccupied with gambling.","5. Often gambles when feeling distressed.","6. After losing money gambling, often returns another day to get even (\"chasing\" losses).","7. Lies to conceal the extent of involvement with gambling.","8. Has jeopardized or lost a significant relationship, job, or educational or career opportunity because of gambling.","9. Relies on others to provide money to relieve desperate financial situations caused by gambling."]},
      {id:"B", text:"The gambling behavior is not better explained by a manic episode."}
    ],
    specifiers: ["Episodic","Persistent","In early remission (3-12 months)","In sustained remission (12+ months)"],
    severity: ["Mild (4-5 criteria)","Moderate (6-7 criteria)","Severe (8-9 criteria)"],
    codingNote: "Gambling Disorder is the only behavioral (non-substance) addiction in DSM-5, classified under Substance-Related and Addictive Disorders due to shared reward circuit pathology."
  },
    interventions: {
    pharma: [
      {name:'Naltrexone', target:['OPIOID','NAcc','VTA'], mechanism:'Opioid antagonist reduces gambling urge/excitement. Best evidence for pharmacotherapy.', evidence:'A', cite:'Grant et al. 2008 Am J Psychiatry 165(11):1472-7'},
      {name:'Nalmefene', target:['OPIOID','NAcc'], mechanism:'Opioid modulator. European approval for gambling.', evidence:'A', cite:'Grant et al. 2006 Am J Psychiatry 163(2):303-12'},
      {name:'NAC', target:['GABA_GLU','NAcc'], mechanism:'Glutamate normalization in reward circuit', evidence:'B', cite:'Grant et al. 2007 Biol Psychiatry 62(6):652-7'},
    
      {name:"Naltrexone (50-150mg)", target:["NAcc","VTA","OFC"], mechanism:"Opioid antagonist reduces reward signal from gambling wins. Reduces urges.", evidence:"A", cite:"Grant et al. 2008 Am J Psychiatry 165(11):1472-81"},
    ],
    therapy: [
      {name:'CBT (gambling-specific)', target:['dlPFC','vmPFC','OFC','dACC'], mechanism:'Cognitive restructuring of gambling cognitions (gambler\'s fallacy, illusion of control). Behavioral alternatives.', evidence:'A', cite:'Gooding & Tarrier 2009 Clin Psychol Rev 29(2):145-53'},
      {name:'Motivational Interviewing', target:['mPFC','vmPFC','dlPFC'], mechanism:'Resolves ambivalence about quitting', evidence:'A', cite:'Yakovenko et al. 2015 Addiction 110(11):1709-31'},
      {name:'GA (Gamblers Anonymous)', target:['OXY','VV','mPFC'], mechanism:'Peer support, identity restructuring, accountability', evidence:'B', cite:'Petry et al. 2006 J Consult Clin Psychol 74(3):555-67'},
    ],
    somatic: [
      {name:'Exercise', target:['VTA','BDNF','NAcc'], mechanism:'Alternative dopamine source', evidence:'C', cite:'Clinical consensus'},
    ],
    nutrition: [
      {name:"NAC (1200-1800mg)", target:["GABA_GLU","NAcc"], mechanism:"Glutamate normalization in nucleus accumbens reduces craving", evidence:"B", cite:"Grant et al. 2014 Biol Psychiatry 75(9):708-14"},
      {name:"Omega-3", target:["BDNF","dlPFC"], mechanism:"Prefrontal support for impulse control", evidence:"C", cite:"Buydens-Branchey et al. 2008"}
    ],
    supplements: [
      {name:'NAC (1200-1800mg)', target:['GABA_GLU','NAcc'], mechanism:'Glutamate modulation in nucleus accumbens', evidence:'B', cite:'Grant et al. 2007 Biol Psychiatry 62(6):652-7'},
    ]
  }
},

// ─────────────────────────────────────────────────
// SOMATIC SYMPTOM AND RELATED DISORDERS
// ─────────────────────────────────────────────────

'SOMATIC_SYMPTOM': {
  name: 'Somatic Symptom Disorder',
  dsm5: '300.82 (F45.1)',
  prevalence: '~5-7% general population',
  summary: 'Excessive thoughts, feelings, and behaviors related to somatic symptoms. Anterior insula interoceptive prediction amplifies normal body signals. Prefrontal catastrophizing drives health anxiety. Distinguishing feature: the distress is about the symptoms, whether or not a medical condition explains them.',
  circuits: [
    {node:'AI',     dir:'hyper', detail:'Interoceptive prediction errors amplified — normal body signals read as pathological', evidence:'A', cite:'Paulus & Stein 2006 Biol Psychiatry 60(4):383-7; Van den Bergh et al. 2017 Front Psychol 8:2239'},
    {node:'dACC',   dir:'hyper', detail:'Threat monitoring locked on body symptoms', evidence:'B', cite:'Perez et al. 2015 JAMA Neurol 72(12):1468-78'},
    {node:'mPFC',   dir:'hyper', detail:'Catastrophic self-referential processing about health', evidence:'B', cite:'Van den Bergh et al. 2017 Front Psychol 8:2239'},
    {node:'BLA',    dir:'hyper', detail:'Fear response to somatic sensations', evidence:'B', cite:'Garcia-Campayo et al. 2009 BMC Psychiatry 9:1'},
    {node:'S1',     dir:'hyper', detail:'Somatosensory cortex amplified processing of body signals', evidence:'B', cite:'Perez et al. 2015'},
    {node:'dlPFC',  dir:'hypo', detail:'Cannot cognitively override catastrophic health beliefs', evidence:'C', cite:'Rief & Broadbent 2007 J Psychosom Res 62(4):469-78'},
    {node:'PI',     dir:'hyper', detail:'Posterior insula raw interoceptive signal amplified', evidence:'B', cite:'Avery et al. 2014 Nat Commun 5:5506'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.82 (F45.1)",
    sections: [
      {id:"A", text:"One or more somatic symptoms that are distressing or result in significant disruption of daily life."},
      {id:"B", text:"Excessive thoughts, feelings, or behaviors related to the somatic symptoms or associated health concerns as manifested by at least one of the following:", items:["1. Disproportionate and persistent thoughts about the seriousness of one's symptoms.","2. Persistently high level of anxiety about health or symptoms.","3. Excessive time and energy devoted to these symptoms or health concerns."]},
      {id:"C", text:"Although any one somatic symptom may not be continuously present, the state of being symptomatic is persistent (typically more than 6 months)."}
    ],
    specifiers: ["With predominant pain","Persistent (severe symptoms, marked impairment, long duration >6 months)"],
    severity: ["Mild (only one Criterion B symptom)","Moderate (two or more Criterion B symptoms)","Severe (two or more Criterion B symptoms plus multiple somatic complaints or one very severe somatic symptom)"],
    codingNote: "DSM-5 replaced somatization disorder, undifferentiated somatoform disorder, and pain disorder with this single category. The presence of a medical explanation does not exclude the diagnosis."
  },
    interventions: {
    pharma: [
      {name:'SSRIs/SNRIs', target:['RAPHE','AI','dACC','BLA'], mechanism:'Reduces somatic anxiety and catastrophic cognitions. Also treats pain component via descending serotonergic pathways.', evidence:'A', cite:'Kleinstauber et al. 2014 J Psychosom Res 76(1):20-30'},
    ],
    therapy: [
      {name:'CBT for Health Anxiety', target:['dlPFC','AI','mPFC','dACC'], mechanism:'Cognitive restructuring of catastrophic body interpretation + behavioral experiments (reducing checking, reassurance)', evidence:'A', cite:'van Dessel et al. 2014 BMJ 348:g1821'},
      {name:'ACT', target:['AI','mPFC','PCC'], mechanism:'Acceptance of somatic sensations without catastrophic interpretation', evidence:'B', cite:'Wetherell et al. 2011 J Consult Clin Psychol 79(5):613-21'},
      {name:'MBSR', target:['AI','dACC','mPFC'], mechanism:'Interoceptive exposure with non-judgmental stance → recalibrates interoceptive prediction', evidence:'B', cite:'Lakhan & Schofield 2013 Front Psychiatry 4:127'},
    ],
    somatic: [
      {name:'Graded exercise', target:['AI','S1','BDNF','VV'], mechanism:'Recalibrates body signal interpretation. Demonstrates body capability.', evidence:'B', cite:'Claassen-van Dessel et al. 2018 Cochrane Database Syst Rev'},
    
      {name:"Graded Exercise Therapy", target:["AI","S1","SMN","VV"], mechanism:"Recalibrates interoceptive prediction errors and somatic attention", evidence:"B", cite:"Sharpe & Chalder 2015; adapted from functional syndrome literature"},
      {name:"Mindfulness-Based Stress Reduction", target:["AI","dACC","mPFC","PCC"], mechanism:"Decentering from somatic hypervigilance, DMN-insula decoupling", evidence:"B", cite:"Lakhan & Schofield 2013 Front Psychiatry 4:47"},
    ],
    nutrition: [
      {name:"Omega-3 (anti-inflammatory)", target:["AI","BDNF"], mechanism:"Reduces neuroinflammation contributing to central sensitization", evidence:"C", cite:"Ricker & Haas 2017"},
      {name:"Vitamin D", target:["HPA","RAPHE"], mechanism:"Deficiency correlated with chronic pain and somatic symptoms", evidence:"B", cite:"Wepner et al. 2014 Pain 155(2):261-8"}
    ],
    supplements: []
  }
},

'ILLNESS_ANXIETY': {
  name: 'Illness Anxiety Disorder',
  dsm5: '300.7 (F45.21)',
  prevalence: '~1.3-10% (depending on care setting; high in medical populations)',
  summary: 'Preoccupation with having or acquiring a serious illness despite minimal or no somatic symptoms. Unlike somatic symptom disorder, the distress is about the IDEA of illness, not about actual symptoms. OFC-striatal checking loop resembles OCD. Health-related safety behaviors maintain anxiety.',
  circuits: [
    {node:'OFC',    dir:'hyper', detail:'Locked on health threat — "something is wrong/will go wrong with my body"', evidence:'B', cite:'Asmundson et al. 2010 Clin Psychol Rev 30(7):745-53'},
    {node:'CAUD',   dir:'hyper', detail:'Checking/reassurance-seeking loop (OCD-spectrum)', evidence:'B', cite:'Asmundson et al. 2010'},
    {node:'AI',     dir:'hyper', detail:'Body scanning — hyperattention to interoceptive signals looking for signs of illness', evidence:'A', cite:'Paulus & Stein 2006'},
    {node:'dACC',   dir:'hyper', detail:'Uncertainty intolerance — "I need to know for sure I\'m not sick"', evidence:'B', cite:'Abramowitz & Braddock 2011'},
    {node:'mPFC',   dir:'hyper', detail:'Ruminative health-related self-referential processing', evidence:'C', cite:'Extrapolated from health anxiety literature'},
    {node:'BLA',    dir:'hyper', detail:'Health-related threat sensitivity', evidence:'B', cite:'Asmundson et al. 2010'},
    {node:'dlPFC',  dir:'hypo', detail:'Cannot override health anxiety through reasoning', evidence:'C', cite:'Abramowitz & Braddock 2011'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.7 (F45.21)",
    sections: [
      {id:"A", text:"Preoccupation with having or acquiring a serious illness."},
      {id:"B", text:"Somatic symptoms are not present or, if present, are only mild in intensity. If another medical condition is present or there is a high risk for developing a medical condition, the preoccupation is clearly excessive or disproportionate."},
      {id:"C", text:"There is a high level of anxiety about health, and the individual is easily alarmed about personal health status."},
      {id:"D", text:"The individual performs excessive health-related behaviors (e.g., repeatedly checks body for signs of illness) or exhibits maladaptive avoidance (e.g., avoids doctor appointments and hospitals)."},
      {id:"E", text:"Illness preoccupation has been present for at least 6 months, but the specific illness that is feared may change over that period of time."},
      {id:"F", text:"The illness-related preoccupation is not better explained by another mental disorder."}
    ],
    specifiers: ["Care-seeking type","Care-avoidant type"],
    severity: [],
    codingNote: "Replaces DSM-IV hypochondriasis. Distinguished from Somatic Symptom Disorder by the absence of significant somatic symptoms."
  },
    interventions: {
    pharma: [
      {name:'SSRIs', target:['RAPHE','OFC','CAUD','BLA'], mechanism:'Treats OCD-spectrum checking behavior + anxiety component', evidence:'A', cite:'Fallon et al. 2017 JAMA 317(20):2097-105'},
    
      {name:"SSRIs (fluoxetine, paroxetine)", target:["RAPHE","OFC","AI"], mechanism:"Reduces health-related obsessive preoccupation. OFC/insula modulation.", evidence:"B", cite:"Fallon et al. 2003 Am J Psychiatry 160(5):981-3"},
    ],
    therapy: [
      {name:'CBT (exposure + response prevention)', target:['OFC','CAUD','AI','dlPFC','dACC'], mechanism:'Exposure to health uncertainty. Response prevention for checking/reassurance-seeking.', evidence:'A', cite:'Tyrer et al. 2014 Lancet 383(9913):219-25'},
      {name:'ACT', target:['mPFC','AI','PCC'], mechanism:'Acceptance of uncertainty about health. Defusion from health catastrophizing.', evidence:'B', cite:'Eilenberg et al. 2016 J Psychosom Res 85:16-23'},
    ],
    somatic: [
      {name:"Interoceptive Exposure", target:["AI","dACC","VV"], mechanism:"Systematic exposure to body sensations to reduce catastrophic interpretation", evidence:"B", cite:"Weck et al. 2015 J Consult Clin Psychol 83(3):665-76"}
    ],
    nutrition: [
      {name:"L-Theanine (200mg)", target:["GABA_GLU","dACC"], mechanism:"Alpha oscillation increase, anxiety reduction without sedation", evidence:"C", cite:"Hidese et al. 2019"}
    ],
    supplements: []
  }
},

'CONVERSION_FND': {
  name: 'Conversion Disorder / Functional Neurological Disorder',
  dsm5: '300.11 (F44.x)',
  prevalence: '~4-12 per 100,000 (incidence). ~50,000+ new cases/year US.',
  summary: 'Neurological symptoms (weakness, seizures, blindness, movement abnormalities) without structural neurological damage. NOT malingering — patients are not faking. Reflects disruption of motor/sensory planning and execution at the level of intention and self-agency. Prefrontal-motor disconnection with limbic override.',
  circuits: [
    {node:'SMA',    dir:'hypo', detail:'Supplementary motor area hypoactivated during attempted movement — intention-to-act fails', evidence:'A', cite:'Voon et al. 2010 Brain 133(5):1526-36'},
    {node:'dlPFC',  dir:'hypo', detail:'Reduced prefrontal engagement during voluntary motor tasks', evidence:'A', cite:'Voon et al. 2010 Brain 133(5):1526-36'},
    {node:'M1',     dir:'altered', detail:'Primary motor cortex structurally intact but functionally disconnected from motor intention', evidence:'A', cite:'Stone et al. 2007 J Neurol Neurosurg Psychiatry 78(7):708-12'},
    {node:'BLA',    dir:'hyper', detail:'Amygdala activation to emotional stimuli predicts symptom severity', evidence:'A', cite:'Voon et al. 2010 Brain 133(5):1526-36'},
    {node:'AI',     dir:'altered', detail:'Disrupted self-agency — "this movement is not mine"', evidence:'B', cite:'Perez et al. 2015 JAMA Neurol 72(12):1468-78'},
    {node:'TPJ',    dir:'altered', detail:'Self-agency and body ownership disrupted — TPJ is key to sense of "I am doing this"', evidence:'A', cite:'Perez et al. 2015 JAMA Neurol 72(12):1468-78'},
    {node:'dACC',   dir:'hyper', detail:'Heightened self-monitoring during motor attempts', evidence:'B', cite:'Perez et al. 2015'},
    {node:'STRI',   dir:'altered', detail:'Habitual movement patterns disrupted or locked', evidence:'B', cite:'Voon et al. 2011 Brain 134(11):3116-26'},
    {node:'PAG',    dir:'hyper', detail:'Defensive freeze patterns may underlie some conversion paralysis', evidence:'C', cite:'Kozlowska et al. 2015 Harv Rev Psychiatry 23(4):263-81'},
  ],
  criteria: {
    title: "Diagnostic Criteria 300.11 (F44.x) — Functional Neurological Symptom Disorder",
    sections: [
      {id:"A", text:"One or more symptoms of altered voluntary motor or sensory function."},
      {id:"B", text:"Clinical findings provide evidence of incompatibility between the symptom and recognized neurological or medical conditions."},
      {id:"C", text:"The symptom or deficit is not better explained by another medical or mental disorder."},
      {id:"D", text:"The symptom or deficit causes clinically significant distress or impairment in social, occupational, or other important areas of functioning or warrants medical evaluation."}
    ],
    specifiers: ["With weakness or paralysis (F44.4)","With abnormal movement (F44.4)","With swallowing symptoms (F44.4)","With speech symptom (F44.4)","With attacks or seizures (F44.5)","With anesthesia or sensory loss (F44.6)","With special sensory symptom (F44.6)","With mixed symptoms (F44.7)","With acute episode (<6 months)","With persistent episode (≥6 months)","With or without psychological stressor"],
    severity: [],
    codingNote: "DSM-5 renamed \"Conversion Disorder\" to include \"Functional Neurological Symptom Disorder.\" Criterion B requires positive clinical signs of internal inconsistency (e.g., Hoover sign, tremor entrainment), not simply the absence of neurological explanation."
  },
    interventions: {
    pharma: [
      {name:'No primary pharmacotherapy', target:[], mechanism:'Treat comorbid depression/anxiety per those protocols. No drug treats FND directly.', evidence:'D', cite:'Espay et al. 2018 Neurology 90(7):325-31'},
      {name:'SSRIs (comorbid depression/anxiety)', target:['RAPHE','BLA'], mechanism:'Comorbid mood/anxiety very common. Treating these may reduce symptom driver.', evidence:'B', cite:'Voon et al. 2016 J Neurol Neurosurg Psychiatry 87(10):1113-9'},
    ],
    therapy: [
      {name:'Specialized physiotherapy', target:['SMA','M1','STRI','TPJ'], mechanism:'Gold standard. Retrains motor planning through specific techniques that bypass the disrupted intention pathway.', evidence:'A', cite:'Nielsen et al. 2015 J Neurol Neurosurg Psychiatry 86(10):1113-9'},
      {name:'CBT (FND-specific)', target:['dlPFC','AI','BLA','dACC'], mechanism:'Addresses illness beliefs, self-monitoring, avoidance behavior. Symptom reattribution.', evidence:'A', cite:'Goldstein et al. 2010 J Neurol Neurosurg Psychiatry 81(8):878-87'},
      {name:'Psychoeducation (early, clear diagnosis)', target:['dlPFC','mPFC'], mechanism:'CRITICAL first step. Explain the diagnosis positively ("your brain\'s software, not hardware"). Early clear diagnosis improves outcome.', evidence:'A', cite:'Stone et al. 2016 Pract Neurol 16(3):217-23'},
      {name:'Psychotherapy (trauma processing if relevant)', target:['BLA','vmPFC','HIPP'], mechanism:'~30-50% have trauma history. Processing may reduce limbic driver of symptoms.', evidence:'B', cite:'Ludwig et al. 2018 J Neurol 265(10):2180-90'},
    ],
    somatic: [
      {name:'Graded motor/sensory retraining', target:['SMA','M1','S1','STRI'], mechanism:'Progressive rebuilding of motor programs through repetition, avoiding the "trying too hard" pattern', evidence:'A', cite:'Nielsen et al. 2015'},
    
      {name:"Specialized Physiotherapy (consensus approach)", target:["SMN","S1","CB","SMA"], mechanism:"Motor reprogramming via attention diversion, normal movement pattern retraining", evidence:"A", cite:"Nielsen et al. 2015 J Neurol Neurosurg Psychiatry 86(10):1113-9"},
      {name:"tDCS over motor cortex", target:["SMN","SMA","dlPFC"], mechanism:"Transcranial stimulation restores voluntary motor command pathways", evidence:"C", cite:"Aybek & Voon 2019 Handb Clin Neurol 168:181-94"},
    ],
    nutrition: [
      {name:"B-complex vitamins", target:["RAPHE","LC"], mechanism:"Methylation support for neurotransmitter synthesis; deficiency mimics functional symptoms", evidence:"C", cite:"Kennedy 2016 Nutrients 8(2):68"}
    ],
    supplements: []
  }
},

};


// ═══ UTILITY FUNCTIONS ═══

// Get all diagnoses
function getDiagnoses() {
  return Object.keys(DSM_CIRCUIT_MAP).map(function(k) {
    return {code: k, name: DSM_CIRCUIT_MAP[k].name, dsm5: DSM_CIRCUIT_MAP[k].dsm5};
  });
}

// Get circuit signature for a diagnosis
function getCircuitSignature(dxCode) {
  return DSM_CIRCUIT_MAP[dxCode] || null;
}

// Get all nodes affected by a diagnosis (for connectome highlighting)
function getAffectedNodes(dxCode) {
  var dx = DSM_CIRCUIT_MAP[dxCode];
  if (!dx) return [];
  return dx.circuits.map(function(c) {
    return {node: c.node, direction: c.dir, detail: c.detail, evidence: c.evidence};
  });
}

// Get all interventions targeting a specific node across all diagnoses
function getInterventionsForNode(nodeId) {
  var results = [];
  Object.keys(DSM_CIRCUIT_MAP).forEach(function(dxCode) {
    var dx = DSM_CIRCUIT_MAP[dxCode];
    Object.keys(dx.interventions).forEach(function(category) {
      dx.interventions[category].forEach(function(intervention) {
        if (intervention.target && intervention.target.indexOf(nodeId) !== -1) {
          results.push({
            diagnosis: dx.name,
            dxCode: dxCode,
            category: category,
            intervention: intervention.name,
            mechanism: intervention.mechanism,
            evidence: intervention.evidence,
            cite: intervention.cite
          });
        }
      });
    });
  });
  return results;
}

// Get all diagnoses affecting a specific node
function getDiagnosesForNode(nodeId) {
  var results = [];
  Object.keys(DSM_CIRCUIT_MAP).forEach(function(dxCode) {
    var dx = DSM_CIRCUIT_MAP[dxCode];
    dx.circuits.forEach(function(c) {
      if (c.node === nodeId) {
        results.push({
          diagnosis: dx.name,
          dxCode: dxCode,
          direction: c.dir,
          detail: c.detail,
          evidence: c.evidence
        });
      }
    });
  });
  return results;
}

// Cross-diagnostic analysis: which nodes are most commonly affected?
function getMostAffectedNodes() {
  var counts = {};
  Object.keys(DSM_CIRCUIT_MAP).forEach(function(dxCode) {
    DSM_CIRCUIT_MAP[dxCode].circuits.forEach(function(c) {
      counts[c.node] = (counts[c.node] || 0) + 1;
    });
  });
  return Object.keys(counts)
    .map(function(k) { return {node: k, count: counts[k]}; })
    .sort(function(a, b) { return b.count - a.count; });
}

if (typeof module !== 'undefined') module.exports = {DSM_CIRCUIT_MAP, getDiagnoses, getCircuitSignature, getAffectedNodes, getInterventionsForNode, getDiagnosesForNode, getMostAffectedNodes};
