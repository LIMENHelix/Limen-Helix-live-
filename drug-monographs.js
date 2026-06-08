// ═══════════════════════════════════════════════════════════════
// LIMEN HELIX — DRUG MONOGRAPH DATABASE
// Informational reference only. Not a substitute for prescribing
// information or clinical judgment.
// ═══════════════════════════════════════════════════════════════

var DRUG_MONOGRAPHS = {

// ─── SSRIs ─────────────────────────────────────────────────
'Sertraline': {
  brand:['Zoloft®'], generic:'Sertraline HCl', class:'SSRI', schedule:'Non-scheduled',
  mechanism:'Selective serotonin reuptake inhibitor. Blocks SERT → increased synaptic 5-HT → receptor desensitization over 2-4 weeks.',
  indications:['MDD','OCD','Panic Disorder','PTSD','SAD','PMDD'],
  dosing:{
    adult:{start:'25-50mg/day',target:'50-200mg/day',max:'200mg/day',titration:'Increase by 25-50mg at ≥1 week intervals'},
    pediatric:{start:'25mg/day (OCD 6-12)',target:'50-200mg',max:'200mg',note:'FDA-approved OCD age 6+'},
    elderly:{start:'12.5-25mg',note:'Slower titration; monitor hyponatremia'},
    renal:'No adjustment required', hepatic:'Use lower doses; reduced clearance'
  },
  sideEffects:{
    common:['Nausea (26%)','Diarrhea (20%)','Insomnia (20%)','Sexual dysfunction (14-30%)','Headache (25%)','Dizziness (12%)','Dry mouth (14%)','Fatigue (12%)','Tremor (8%)'],
    serious:['Serotonin syndrome','Suicidal ideation (age <25)','QTc prolongation (rare)','Hyponatremia/SIADH','Bleeding risk (with NSAIDs)','Discontinuation syndrome'],
    sexual:'Delayed ejaculation, anorgasmia, decreased libido 14-30%'
  },
  blackBox:'Antidepressants increase risk of suicidal thinking and behavior in children, adolescents, and young adults (18-24).',
  contraindications:['MAOIs (14-day washout)','Pimozide','Disulfiram (oral concentrate)'],
  interactions:['MAOIs','Pimozide','Warfarin','NSAIDs','Triptans','Tramadol'],
  monitoring:['Suicidality (first 1-2 months)','Sodium (elderly)','Bleeding','Sexual function','Weight'],
  onset:'2-4 weeks; full response 4-6 weeks',
  halfLife:'~26 hours; desmethylsertraline 62-104 hours',
  pregnancy:'Category C. Third trimester neonatal complications. Balance risk/benefit.',
  costRange:'Generic: $4-15/month. Brand: $300+/month.',
  sponsored:false
},

'Fluoxetine': {
  brand:['Prozac®','Sarafem®'], generic:'Fluoxetine HCl', class:'SSRI', schedule:'Non-scheduled',
  mechanism:'SSRI with longest half-life. Active metabolite norfluoxetine extends duration. Most activating SSRI.',
  indications:['MDD','OCD','Panic Disorder','Bulimia Nervosa','PMDD','Bipolar Depression (with olanzapine)'],
  dosing:{
    adult:{start:'10-20mg/day',target:'20-60mg/day',max:'80mg/day (OCD)',titration:'Increase after several weeks'},
    pediatric:{start:'10mg',target:'20-60mg',max:'60mg',note:'FDA-approved MDD 8+, OCD 7+'},
    elderly:{start:'10mg',note:'Long half-life accumulates'},
    renal:'Caution in severe impairment', hepatic:'Reduce dose or alternate-day dosing'
  },
  sideEffects:{
    common:['Nausea (21%)','Headache (21%)','Insomnia (19%)','Nervousness (13%)','Anorexia (11%)','Diarrhea (12%)','Sexual dysfunction','Tremor (10%)'],
    serious:['Serotonin syndrome','Suicidal ideation','Mania activation','Seizures','Hyponatremia','QTc prolongation (high doses)'],
    sexual:'Lower rates than paroxetine. Delayed orgasm most common.'
  },
  blackBox:'Suicidality in youth.',
  contraindications:['MAOIs (5-week washout)','Thioridazine','Pimozide'],
  interactions:['MAOIs (5-week washout)','CYP2D6 substrates (potent inhibitor)','Tamoxifen (avoid)','Warfarin'],
  monitoring:['Suicidality','Weight','Mania risk','Sodium'],
  onset:'2-4 weeks; full effect 4-8 weeks',
  halfLife:'1-3 days; norfluoxetine 4-16 days',
  pregnancy:'Category C. No clear teratogenic signal.',
  costRange:'Generic: $4-10/month.',
  sponsored:false
},

'Escitalopram': {
  brand:['Lexapro®'], generic:'Escitalopram oxalate', class:'SSRI', schedule:'Non-scheduled',
  mechanism:'S-enantiomer of citalopram. Most selective SSRI. Allosteric binding enhances SERT affinity.',
  indications:['MDD','GAD'],
  dosing:{
    adult:{start:'5-10mg/day',target:'10-20mg/day',max:'20mg/day',titration:'Increase after ≥1 week'},
    pediatric:{start:'5-10mg',target:'10-20mg',note:'FDA-approved MDD 12+'},
    elderly:{start:'5mg',max:'10mg'},
    renal:'Caution in severe', hepatic:'Max 10mg/day'
  },
  sideEffects:{
    common:['Nausea (15%)','Insomnia (9%)','Ejaculation disorder (9-14%)','Somnolence (6%)','Sweating (5%)','Diarrhea (8%)','Dry mouth (6%)'],
    serious:['Serotonin syndrome','QTc prolongation (>20mg)','Suicidal ideation','Hyponatremia','Bleeding'],
    sexual:'Moderate. Lower than paroxetine.'
  },
  blackBox:'Suicidality in youth.',
  contraindications:['MAOIs','Pimozide','IV methylene blue/linezolid'],
  interactions:['MAOIs','QTc-prolonging agents','CYP2C19 inhibitors','Lithium'],
  monitoring:['ECG if >20mg or cardiac risk','Sodium','Suicidality'],
  onset:'1-4 weeks',
  halfLife:'27-32 hours',
  pregnancy:'Category C.',
  costRange:'Generic: $4-10/month.',
  sponsored:false
},

'Paroxetine': {
  brand:['Paxil®','Paxil CR®','Brisdelle®'], generic:'Paroxetine HCl', class:'SSRI', schedule:'Non-scheduled',
  mechanism:'Most potent SERT inhibitor of SSRIs. Mild anticholinergic and NE reuptake activity.',
  indications:['MDD','GAD','SAD','Panic Disorder','PTSD','OCD','PMDD'],
  dosing:{
    adult:{start:'10-20mg/day',target:'20-50mg/day',max:'60mg',titration:'Increase by 10mg weekly'},
    pediatric:{note:'NOT FDA-approved in pediatric MDD. Increased suicidality. Specialist only.'},
    elderly:{start:'10mg',max:'40mg'},
    renal:'Start 10mg; max 40mg severe', hepatic:'Start 10mg; max 40mg'
  },
  sideEffects:{
    common:['Sexual dysfunction (25-40% — highest SSRI)','Somnolence (23%)','Nausea (26%)','Dry mouth (18%)','Weight gain (significant)','Constipation (14%)','Sweating (11%)'],
    serious:['Severe discontinuation syndrome (worst SSRI)','Suicidal ideation','Serotonin syndrome','Birth defects (Category D)','Hyponatremia'],
    sexual:'Highest sexual dysfunction of all SSRIs (25-40%).'
  },
  blackBox:'Suicidality in youth. Cardiac malformations with first-trimester exposure.',
  contraindications:['MAOIs','Thioridazine','Pimozide','Pregnancy (Category D)'],
  interactions:['MAOIs','Tamoxifen (CYP2D6 — avoid)','Thioridazine','Warfarin'],
  monitoring:['Discontinuation symptoms (taper slowly)','Weight','Sexual function','Pregnancy test'],
  onset:'2-4 weeks',
  halfLife:'~21 hours. Short = severe withdrawal.',
  pregnancy:'Category D. Cardiac malformations. Avoid when possible.',
  costRange:'Generic: $4-15/month.',
  sponsored:false
},

// ─── SNRIs ─────────────────────────────────────────────────
'Venlafaxine': {
  brand:['Effexor XR®'], generic:'Venlafaxine HCl', class:'SNRI', schedule:'Non-scheduled',
  mechanism:'Dose-dependent: serotonergic <150mg, noradrenergic ≥150mg. Weak dopamine reuptake at high doses.',
  indications:['MDD','GAD','SAD','Panic Disorder'],
  dosing:{
    adult:{start:'37.5-75mg/day',target:'150-225mg/day',max:'375mg (inpatient)',titration:'Increase 75mg at ≥4-day intervals'},
    elderly:{start:'37.5mg',note:'Monitor BP'},
    renal:'CrCl 10-70: reduce 25-50%', hepatic:'Reduce ≥50%'
  },
  sideEffects:{
    common:['Nausea (31-35%)','Headache (34%)','Dizziness (20%)','Dry mouth (17%)','Insomnia (17%)','Constipation (15%)','Sweating (12%)','Sexual dysfunction (12-20%)'],
    serious:['Severe discontinuation syndrome','Hypertension (dose-related)','Serotonin syndrome','Seizures','Hyponatremia'],
    sexual:'Moderate. Dose-dependent.'
  },
  blackBox:'Suicidality in youth.',
  contraindications:['MAOIs (14-day washout)','IV methylene blue/linezolid'],
  interactions:['MAOIs','CYP2D6 inhibitors','Haloperidol (levels increase)'],
  monitoring:['Blood pressure at every dose increase','Heart rate','Cholesterol (long-term)','Taper ≥2 weeks'],
  onset:'2-4 weeks',
  halfLife:'5 hours; desvenlafaxine 11 hours',
  pregnancy:'Category C. Third trimester neonatal syndrome.',
  costRange:'Generic XR: $10-25/month.',
  sponsored:false
},

'Duloxetine': {
  brand:['Cymbalta®'], generic:'Duloxetine HCl', class:'SNRI', schedule:'Non-scheduled',
  mechanism:'Balanced SNRI. Descending pain modulation pathway activation — effective for comorbid pain conditions.',
  indications:['MDD','GAD','Fibromyalgia','Diabetic Neuropathy','Chronic Pain'],
  dosing:{
    adult:{start:'20-30mg/day',target:'60mg/day',max:'120mg/day',titration:'30mg × 1 week then 60mg'},
    pediatric:{start:'30mg',note:'FDA-approved GAD 7+'},
    elderly:{start:'20mg'},
    renal:'AVOID CrCl <30', hepatic:'AVOID any hepatic impairment (5x exposure)'
  },
  sideEffects:{
    common:['Nausea (24%)','Dry mouth (15%)','Headache (14%)','Somnolence (11%)','Constipation (11%)','Dizziness (10%)','Fatigue (10%)','Decreased appetite (8%)'],
    serious:['Hepatotoxicity','Serotonin syndrome','Stevens-Johnson','Discontinuation syndrome','Urinary retention'],
    sexual:'Moderate. Lower than paroxetine.'
  },
  blackBox:'Suicidality in youth. Hepatotoxicity warning.',
  contraindications:['MAOIs','Angle-closure glaucoma','Severe renal (CrCl <30)','ANY hepatic impairment','Chronic alcohol use'],
  interactions:['MAOIs','CYP1A2 inhibitors (fluvoxamine — avoid)','Alcohol','Thioridazine'],
  monitoring:['LFTs baseline and periodic','Blood pressure','Renal function','Hepatotoxicity signs'],
  onset:'1-4 weeks mood; pain may respond earlier',
  halfLife:'~12 hours',
  pregnancy:'Category C.',
  costRange:'Generic: $8-20/month.',
  sponsored:false
},

// ─── NDRI ──────────────────────────────────────────────────
'Bupropion': {
  brand:['Wellbutrin XL®','Zyban®'], generic:'Bupropion HCl', class:'NDRI', schedule:'Non-scheduled',
  mechanism:'NE-dopamine reuptake inhibitor. No serotonergic activity → no sexual side effects, no weight gain.',
  indications:['MDD','Seasonal Affective','Smoking Cessation','ADHD (off-label)','SSRI sexual dysfunction augmentation'],
  dosing:{
    adult:{start:'150mg XL daily',target:'300mg XL daily',max:'450mg/day',titration:'150mg × 3+ days then increase. Single dose max 450mg XL.'},
    elderly:{start:'150mg XL',note:'Seizure risk'},
    renal:'GFR <90: consider reduction', hepatic:'Severe: 150mg every other day'
  },
  sideEffects:{
    common:['Insomnia (18%)','Dry mouth (17%)','Headache (26%)','Nausea (13%)','Agitation (9%)','Weight loss (14%)','Constipation (10%)','Tremor (6%)'],
    serious:['Seizures (0.4% at 450mg, dose-dependent)','Psychosis/mania','Hypertension','Angle-closure glaucoma'],
    sexual:'Minimal. May IMPROVE SSRI-induced sexual dysfunction.'
  },
  blackBox:'Suicidality in youth. Neuropsychiatric events (smoking cessation).',
  contraindications:['Seizure disorder','Bulimia/anorexia (seizure risk)','MAOIs','Abrupt alcohol/benzo/barbiturate discontinuation'],
  interactions:['MAOIs','Seizure threshold-lowering drugs','CYP2D6 substrates (inhibitor)','Alcohol'],
  monitoring:['Seizure risk factors','Blood pressure','Weight','Mood/agitation'],
  onset:'1-3 weeks',
  halfLife:'21 hours; metabolites 33-37 hours',
  pregnancy:'Category C.',
  costRange:'Generic XL: $15-30/month.',
  sponsored:false
},

// ─── KETAMINE/ESKETAMINE ───────────────────────────────────
'Ketamine IV': {
  brand:['Ketalar® (anesthetic)','Compounded IV'], generic:'Ketamine HCl', class:'NMDA Antagonist', schedule:'Schedule III',
  mechanism:'NMDA antagonist → rapid glutamate surge → AMPA activation → BDNF/synaptogenesis within hours. Habenula silencing. Anti-suicidal effect independent of antidepressant.',
  indications:['Treatment-Resistant Depression','Acute Suicidal Ideation','PTSD (investigational)','Chronic Pain'],
  dosing:{
    adult:{start:'0.5mg/kg IV over 40min',target:'0.5mg/kg per session',max:'0.5mg/kg; 2-3x/week × 2-3 weeks then taper',titration:'Response-guided. Some use 0.1-1.0mg/kg range.'},
    elderly:{note:'Lower doses. Cardiovascular monitoring essential.'},
    renal:'Caution severe', hepatic:'Caution — enzyme elevation with repeated use'
  },
  sideEffects:{
    common:['Dissociation (31-60%)','Dizziness (27%)','Nausea (14-28%)','BP increase (transient 10-30mmHg)','Headache (18%)','Drowsiness','Perceptual disturbances'],
    serious:['Psychotomimetic effects','Cardiovascular (HTN, tachycardia)','Abuse potential (Schedule III)','Cystitis (chronic use)','Hepatotoxicity (chronic)','Cognitive effects (repeated dosing)'],
    sexual:'Not typically affected.'
  },
  blackBox:'None for ketamine. REMS for esketamine (Spravato).',
  contraindications:['Uncontrolled HTN','Aneurysmal vascular disease','Raised ICP','Active psychosis (relative)','Pregnancy'],
  interactions:['CNS depressants','Sympathomimetics','Theophylline'],
  monitoring:['BP and HR during + 2hr post','Dissociation (CADSS)','SpO2','Suicidality pre/post','LFTs with repeated use','Substance use screening'],
  onset:'Antidepressant: 2-24 hours. Anti-suicidal: within hours.',
  halfLife:'2.5 hours; norketamine 5 hours',
  pregnancy:'Avoid. Teratogenic in animals.',
  costRange:'$400-800/session (clinic). Usually not insured for depression.',
  sponsored:false
},

'Esketamine': {
  brand:['Spravato®'], generic:'Esketamine HCl', class:'NMDA Antagonist (S-enantiomer)', schedule:'Schedule III — REMS',
  mechanism:'S-enantiomer with ~4x higher NMDA affinity. FDA-approved intranasal. Same glutamate/BDNF cascade.',
  indications:['Treatment-Resistant Depression (with oral AD)','MDD with Acute Suicidality (with oral AD)'],
  dosing:{
    adult:{start:'56mg intranasal',target:'56-84mg',max:'84mg/session',titration:'Wk 1-4: 2x/week. Wk 5-8: weekly. Wk 9+: weekly or biweekly.'},
    elderly:{note:'Same dosing. Close CV monitoring.'},
    renal:'No adjustment', hepatic:'Severe: not studied'
  },
  sideEffects:{
    common:['Dissociation (41%)','Dizziness (29%)','Nausea (28%)','Sedation (23%)','Vertigo (22%)','Dysgeusia (23%)','Anxiety (13%)','BP increase'],
    serious:['Dissociation requiring observation','Sedation','BP elevation','Abuse potential','Suicidality'],
    sexual:'Not typically affected.'
  },
  blackBox:'Sedation, dissociation, abuse/misuse, suicidality. REMS: certified settings + 2hr post-dose monitoring.',
  contraindications:['Aneurysmal vascular disease','AVM','Intracerebral hemorrhage history'],
  interactions:['CNS depressants','Psychostimulants (BP)','MAOIs (BP)'],
  monitoring:['BP before + 40min post (minimum)','Dissociation assessment','Sedation','2hr observation','No driving same day'],
  onset:'24 hours to 1 week. Some respond after first dose.',
  halfLife:'7-12 hours',
  pregnancy:'Avoid.',
  costRange:'$590-885/session drug cost. Most insurance covers TRD with prior auth.',
  sponsored:false
},

// ─── PSYCHEDELICS ──────────────────────────────────────────
'Psilocybin': {
  brand:['Investigational — no approved brand'], generic:'Psilocybin', class:'5-HT2A Agonist / Classic Psychedelic', schedule:'Schedule I (Breakthrough Therapy)',
  mechanism:'Prodrug → psilocin → 5-HT2A agonism → DMN dissolution → neural plasticity → BDNF → post-acute DMN reconstitution. Mystical experience intensity correlates with outcome.',
  indications:['Treatment-Resistant Depression (Phase III)','MDD (Phase II/III)','End-of-Life Distress','OCD (pilot)','Alcohol Use Disorder (Phase II)'],
  dosing:{
    adult:{start:'25mg (therapeutic)',target:'25mg single dose + psychotherapy',max:'25-30mg/session',titration:'1-2 sessions spaced 2+ weeks. Prep + integration therapy required.'},
    elderly:{note:'Limited data. CV screening recommended.'},
    renal:'No specific data', hepatic:'No specific data'
  },
  sideEffects:{
    common:['Headache (35%)','Nausea (20-30%)','Anxiety during session (15-25%)','Transient HTN','Visual changes','Fatigue post-session','Emotional distress'],
    serious:['Prolonged psychotic reaction (very rare, screened)','Severe panic','HPPD (extremely rare clinical doses)','Trauma reactivation (manageable with support)'],
    sexual:'Not typically affected.'
  },
  blackBox:'N/A (investigational). Favorable safety in clinical trials with screening.',
  contraindications:['Personal/family psychotic disorders','Active psychosis','Lithium (seizure risk)','Tramadol','Unstable CV disease','Pregnancy'],
  interactions:['SSRIs (blunt effect — typically tapered)','Lithium (absolute CI — seizure/cardiac)','Tramadol (seizure)','MAOIs (potentiation)'],
  monitoring:['Pre: psych screening, cardiac, medication review','During: vitals, therapist throughout 6-8hr session','Post: integration therapy','Suicidality 1d, 1wk, 1mo'],
  onset:'20-40min onset. Peak 1-2.5hr. Duration 4-6hr. AD effects within 1 day-1 week, lasting weeks-months.',
  halfLife:'Psilocin: 2-3 hours. Effects persist weeks-months via neuroplasticity.',
  pregnancy:'Contraindicated.',
  costRange:'Estimated $5,000-12,000/treatment episode (drug + therapists + prep + integration).',
  sponsored:false
},

'MDMA': {
  brand:['Midomafetamine (FDA review)'], generic:'MDMA', class:'Empathogen / Serotonin Releasing Agent', schedule:'Schedule I (Breakthrough Therapy PTSD)',
  mechanism:'Reverses SERT/DAT/NET → massive 5-HT, DA, NE release. Oxytocin surge. Reduces amygdala fear while enhancing vmPFC regulation. Creates therapeutic window for trauma processing.',
  indications:['PTSD (Phase III complete)','Social Anxiety in ASD (pilot)'],
  dosing:{
    adult:{start:'80mg + optional 40mg booster at 1.5-2hr',target:'120mg + 60mg booster',max:'180mg total/session',titration:'2-3 sessions, 3-5 weeks apart. Non-drug prep (3) + integration (3-9) sessions.'},
    elderly:{note:'CV risk assessment essential.'},
    renal:'No data', hepatic:'CYP2D6 metabolized. Poor metabolizers: toxicity risk.'
  },
  sideEffects:{
    common:['Jaw clenching (55%)','Decreased appetite (45%)','Nausea (30%)','Sweating (25%)','Fatigue post-session','Insomnia night of','Emotional sensitivity 1-3 days post'],
    serious:['Hyperthermia','Hyponatremia (avoid excess water)','Serotonin syndrome','CV (HR/BP increase)','Transient anxiety/depression in integration'],
    sexual:'May enhance emotional intimacy acutely. No long-term effects.'
  },
  blackBox:'N/A (investigational).',
  contraindications:['Serotonergic medications (washout required)','Uncontrolled HTN','Malignant hyperthermia history','Severe hepatic impairment','Pregnancy','Active psychosis'],
  interactions:['SSRIs/SNRIs (block effects + serotonin syndrome — 5+ half-life washout)','MAOIs (absolute CI)','CYP2D6 inhibitors','Stimulants'],
  monitoring:['BP/HR during session','Temperature','Hydration (not overhydration)','Suicidality','Integration support'],
  onset:'30-60 min onset. Peak 1-2hr. Duration 3-5hr.',
  halfLife:'7-9 hours',
  pregnancy:'Contraindicated.',
  costRange:'Estimated $12,000-15,000/treatment course (3 sessions + all therapy).',
  sponsored:false
},

// ─── STIMULANTS ────────────────────────────────────────────
'Methylphenidate': {
  brand:['Ritalin®','Concerta®','Focalin®','Daytrana®','Quillivant®'], generic:'Methylphenidate HCl', class:'CNS Stimulant', schedule:'Schedule II',
  mechanism:'Blocks DAT and NET → increased dopamine and NE in PFC and striatum. Improves signal-to-noise in prefrontal circuits.',
  indications:['ADHD','Narcolepsy'],
  dosing:{
    adult:{start:'5mg BID (IR) or 18mg (Concerta)',target:'20-60mg/day',max:'72mg/day (Concerta); 60mg/day (IR)',titration:'Increase by 5-10mg weekly'},
    pediatric:{start:'5mg BID (age 6+)',target:'Individualized',max:'72mg Concerta; 60mg IR',note:'FDA-approved age 6+'},
    elderly:{note:'Start low. CV monitoring.'},
    renal:'No specific adjustment', hepatic:'No specific adjustment'
  },
  sideEffects:{
    common:['Decreased appetite (25%)','Insomnia (12%)','Headache (15%)','Abdominal pain (8%)','Nausea','Weight loss','Increased HR/BP','Irritability','Dry mouth'],
    serious:['Cardiovascular (sudden death in structural heart disease)','Growth suppression (children)','Psychosis/mania','Seizures (lower threshold)','Priapism (rare)','Peripheral vasculopathy/Raynaud','Dependence/diversion'],
    sexual:'Rare. Priapism reported rarely.'
  },
  blackBox:'High abuse potential (Schedule II). Sudden death reported in patients with structural cardiac abnormalities.',
  contraindications:['MAOIs (14-day washout)','Glaucoma','Motor tics/Tourette (relative)','Severe anxiety/tension/agitation','Structural cardiac abnormalities','Known hypersensitivity'],
  interactions:['MAOIs','Antihypertensives (reduced effect)','Coumarin anticoagulants','Anticonvulsants (may need dose increase)','SSRIs (serotonin syndrome rare)'],
  monitoring:['Height/weight (children — growth charts)','HR/BP','Cardiac evaluation if symptoms','Tic monitoring','Substance use risk','Appetite/nutrition'],
  onset:'IR: 20-30 min. Concerta: 1 hour. Duration IR: 3-4hr. XR: 8-12hr.',
  halfLife:'2-3 hours (d-MPH is active enantiomer)',
  pregnancy:'Category C. Limited data.',
  costRange:'Generic IR: $15-30/month. Concerta: $50-300/month. Brand varies widely.',
  sponsored:false
},

'Amphetamine': {
  brand:['Adderall®','Adderall XR®','Vyvanse®','Dexedrine®','Mydayis®'], generic:'Mixed amphetamine salts / Lisdexamfetamine', class:'CNS Stimulant', schedule:'Schedule II',
  mechanism:'Promotes DA/NE release from presynaptic vesicles + blocks reuptake + inhibits MAO. More potent dopaminergic effect than methylphenidate.',
  indications:['ADHD','Narcolepsy','BED (lisdexamfetamine)'],
  dosing:{
    adult:{start:'5mg BID (IR) or 20mg XR',target:'20-40mg/day',max:'60mg/day (Adderall); 70mg (Vyvanse)',titration:'Increase by 5-10mg weekly'},
    pediatric:{start:'5mg daily (age 6+)',target:'Individualized',note:'Vyvanse FDA-approved ADHD 6+, BED adult'},
    elderly:{note:'Rarely initiated. CV risk.'},
    renal:'No adjustment. Acidifying agents increase excretion.', hepatic:'No specific adjustment'
  },
  sideEffects:{
    common:['Decreased appetite (36%)','Insomnia (27%)','Dry mouth (26%)','Weight loss','Headache','Anxiety/irritability','Increased HR/BP','Abdominal pain','Nausea'],
    serious:['Cardiovascular (same warnings as MPH)','Growth suppression','Psychosis/mania','Seizures','Serotonin syndrome (with serotonergics)','Dependence/diversion','Peripheral vasculopathy','Rhabdomyolysis (rare)'],
    sexual:'Rare. Reports of erectile dysfunction at high doses.'
  },
  blackBox:'High abuse potential (Schedule II). Sudden death in patients with structural cardiac abnormalities.',
  contraindications:['MAOIs','Advanced arteriosclerosis','Symptomatic cardiovascular disease','Moderate-severe HTN','Glaucoma','Agitated states','History of drug abuse','Hyperthyroidism'],
  interactions:['MAOIs','Acidifying agents (decrease effect)','Alkalinizing agents (increase effect)','Tricyclics','SSRIs (serotonin syndrome)','Antihypertensives'],
  monitoring:['Height/weight (children)','HR/BP','Cardiac evaluation if symptoms','Psychosis screening','Growth velocity','Diversion risk'],
  onset:'Adderall IR: 30-60min, duration 4-6hr. XR: 1-2hr, duration 10-12hr. Vyvanse: 1-2hr, duration 12-14hr.',
  halfLife:'Amphetamine: 10-13hr (pH dependent). Lisdexamfetamine: 1hr (prodrug) → d-amph 10-13hr.',
  pregnancy:'Category C. Neonatal withdrawal reported.',
  costRange:'Generic IR: $20-40/month. Vyvanse: $300+/month (limited generic availability).',
  sponsored:false
},

// ─── ANXIOLYTICS / GABA ────────────────────────────────────
'Pregabalin': {
  brand:['Lyrica®'], generic:'Pregabalin', class:'Alpha-2-Delta Ligand', schedule:'Schedule V',
  mechanism:'Binds alpha-2-delta subunit of voltage-gated calcium channels → reduces glutamate, NE, substance P release. Not a GABA analog despite name.',
  indications:['GAD (EU-approved)','Fibromyalgia','Neuropathic Pain','Epilepsy (adjunct)'],
  dosing:{
    adult:{start:'75mg BID or 50mg TID',target:'150-300mg/day (anxiety); 300-600mg (pain)',max:'600mg/day',titration:'Increase after 3-7 days'},
    elderly:{start:'50mg BID',note:'Adjust for renal function'},
    renal:'CrCl 30-60: reduce 50%. CrCl 15-30: reduce 75%. <15: reduce 90%.', hepatic:'No adjustment (renal elimination)'
  },
  sideEffects:{
    common:['Dizziness (29%)','Somnolence (22%)','Weight gain (14%)','Peripheral edema (6%)','Dry mouth (5%)','Blurred vision','Difficulty concentrating','Euphoria'],
    serious:['Angioedema','Suicidality','Abuse/dependence (Schedule V)','Respiratory depression (with opioids/CNS depressants)','Withdrawal seizures (taper)','Heart failure exacerbation'],
    sexual:'Decreased libido, erectile dysfunction reported in <5%.'
  },
  blackBox:'None. But increased suicidality risk with all anticonvulsants.',
  contraindications:['Hypersensitivity (cross-reactive with gabapentin)'],
  interactions:['CNS depressants (additive sedation)','Opioids (respiratory depression — FDA warning)','Alcohol','Thiazolidinediones (increased edema)'],
  monitoring:['Renal function','Weight','Edema','Suicidality','Signs of abuse','Taper to discontinue (do not stop abruptly)'],
  onset:'Anxiety: 1 week. Pain: 1-2 weeks.',
  halfLife:'~6 hours',
  pregnancy:'Category C. Animal data concerning.',
  costRange:'Generic: $10-30/month.',
  sponsored:false
},

'Prazosin': {
  brand:['Minipress®'], generic:'Prazosin HCl', class:'Alpha-1 Adrenergic Blocker', schedule:'Non-scheduled',
  mechanism:'Alpha-1 antagonist → reduces noradrenergic hyperarousal centrally. Specifically reduces trauma-associated nightmares by blocking NE-driven fear memory replay during REM.',
  indications:['PTSD Nightmares (off-label, VA/DoD guideline recommended)','Hypertension (FDA-approved)'],
  dosing:{
    adult:{start:'1mg at bedtime',target:'6-15mg at bedtime',max:'15mg (nightmares); 20mg/day (HTN)',titration:'Increase by 1-2mg every 3-7 days as tolerated. First-dose hypotension risk.'},
    elderly:{start:'0.5-1mg',note:'Higher fall risk. Orthostatic monitoring.'},
    renal:'No adjustment', hepatic:'No adjustment'
  },
  sideEffects:{
    common:['Dizziness (10%)','Headache (8%)','Drowsiness (8%)','Weakness (7%)','Orthostatic hypotension (first dose)','Nausea (5%)'],
    serious:['First-dose syncope (give at bedtime, start low)','Severe hypotension','Priapism (rare)','Intraoperative floppy iris syndrome'],
    sexual:'Priapism (very rare). Otherwise minimal.'
  },
  blackBox:'None.',
  contraindications:['Known hypersensitivity to quinazolines','Concurrent PDE5 inhibitors (severe hypotension)'],
  interactions:['PDE5 inhibitors (sildenafil, tadalafil — severe hypotension)','Antihypertensives (additive)','Beta-blockers (additive)','NSAIDs (may reduce effect)'],
  monitoring:['Orthostatic BP (especially first dose and titration)','Nightmare frequency/severity','Fall risk (elderly)'],
  onset:'Nightmare reduction: often within first week at therapeutic dose.',
  halfLife:'2-3 hours',
  pregnancy:'Category C.',
  costRange:'Generic: $4-15/month.',
  sponsored:false
},

// ─── ANTIPSYCHOTICS ────────────────────────────────────────
'Aripiprazole': {
  brand:['Abilify®','Aristada® (LAI)'], generic:'Aripiprazole', class:'Atypical Antipsychotic / D2 Partial Agonist', schedule:'Non-scheduled',
  mechanism:'D2 partial agonist (stabilizes dopamine — reduces excess, supplements deficit). 5-HT1A partial agonist. 5-HT2A antagonist. Unique "dopamine system stabilizer."',
  indications:['Schizophrenia','Bipolar I (acute mania, maintenance)','MDD augmentation','Autism irritability','Tourette'],
  dosing:{
    adult:{start:'2-5mg/day (MDD augment); 10-15mg (psychosis)',target:'5-15mg (augment); 15-30mg (psychosis)',max:'30mg/day',titration:'Increase every 2 weeks for augmentation'},
    pediatric:{start:'2mg',note:'FDA-approved: schizophrenia 13+, bipolar 10+, autism irritability 6+, Tourette 6+'},
    elderly:{note:'No specific adjustment but increase fall risk'},
    renal:'No adjustment', hepatic:'No adjustment'
  },
  sideEffects:{
    common:['Akathisia (11-25% — most common reason for discontinuation)','Weight gain (mild vs other antipsychotics)','Headache','Insomnia','Nausea','Constipation','Anxiety','Restlessness'],
    serious:['Akathisia (inner restlessness — distinguish from anxiety)','Tardive dyskinesia','NMS (rare)','Metabolic syndrome (less than olanzapine)','Compulsive behaviors (gambling, shopping, hypersexuality)','Suicidality','Orthostatic hypotension','Seizures'],
    sexual:'Lower rates than typical antipsychotics. Partial agonism preserves prolactin more than antagonists.'
  },
  blackBox:'Increased mortality in elderly dementia patients. Suicidality in youth (MDD augmentation).',
  contraindications:['Hypersensitivity'],
  interactions:['CYP2D6 inhibitors (halve dose)','CYP3A4 inhibitors (halve dose)','CYP3A4 inducers (double dose)','CNS depressants','Antihypertensives'],
  monitoring:['Akathisia assessment (every visit initially)','Metabolic panel (fasting glucose, lipids, weight)','AIMS for tardive dyskinesia','Compulsive behavior screening','BP','Prolactin (if symptoms)'],
  onset:'Psychosis: 1-2 weeks. MDD augmentation: 1-3 weeks.',
  halfLife:'75 hours (aripiprazole); 94 hours (dehydro-aripiprazole)',
  pregnancy:'Category C. Third trimester: EPS/withdrawal in neonate.',
  costRange:'Generic: $10-30/month.',
  sponsored:false
},

'Clozapine': {
  brand:['Clozaril®','FazaClo®','Versacloz®'], generic:'Clozapine', class:'Atypical Antipsychotic', schedule:'Non-scheduled (REMS)',
  mechanism:'Multi-receptor antagonist: D4>D2, 5-HT2A, muscarinic, histamine, alpha-1. Gold standard for treatment-resistant schizophrenia. Only antipsychotic proven to reduce suicidality.',
  indications:['Treatment-Resistant Schizophrenia','Suicidality in Schizophrenia/Schizoaffective'],
  dosing:{
    adult:{start:'12.5mg daily or BID',target:'300-450mg/day',max:'900mg/day',titration:'Increase by 25-50mg/day. Very slow titration. Target over 2-4 weeks.'},
    elderly:{start:'12.5mg',note:'Extreme caution. Higher mortality in dementia.'},
    renal:'Caution', hepatic:'Caution — hepatotoxicity possible'
  },
  sideEffects:{
    common:['Sedation (39%)','Weight gain (31% significant)','Sialorrhea/drooling (31%)','Tachycardia (25%)','Constipation (14%)','Dizziness (19%)','Metabolic syndrome','Hypotension'],
    serious:['Agranulocytosis (1-2% — potentially fatal)','Myocarditis (first month)','Cardiomyopathy','Seizures (dose-related, 5% at >600mg)','Pulmonary embolism','Severe constipation/ileus (can be fatal)','Metabolic syndrome/diabetes','NMS'],
    sexual:'Weight gain and metabolic effects may indirectly affect. Priapism rare.'
  },
  blackBox:'Agranulocytosis, seizures, myocarditis, severe constipation/ileus. REMS: mandatory ANC monitoring.',
  contraindications:['ANC <1500 (general) or <1000 (BEN)','Uncontrolled epilepsy','Paralytic ileus','Myeloproliferative disorders','Concurrent carbamazepine'],
  interactions:['CYP1A2 inhibitors (fluvoxamine — avoid or reduce dose 2/3)','CYP1A2 inducers (smoking — dose increase needed, adjust when starting/stopping)','Bone marrow suppressants','Anticholinergics (additive constipation/ileus)','Benzodiazepines (respiratory depression)'],
  monitoring:['ANC: weekly × 6 months, biweekly × 6 months, then monthly FOR LIFE','Fasting glucose/lipids/A1C','Weight/BMI','ECG (baseline, myocarditis symptoms)','Constipation assessment (every visit)','Seizure risk','Troponin/CRP if fever + tachycardia in first month'],
  onset:'2-4 weeks for initial response. Full effect may take 3-6 months. Some patients respond after months.',
  halfLife:'~12 hours',
  pregnancy:'Category B. Limited data. Neonatal EPS/withdrawal.',
  costRange:'Generic: $50-200/month. Monitoring costs additional.',
  sponsored:false
},

// ─── MOOD STABILIZERS ──────────────────────────────────────
'Lithium': {
  brand:['Lithobid®','Eskalith®'], generic:'Lithium carbonate/citrate', class:'Mood Stabilizer', schedule:'Non-scheduled',
  mechanism:'Multiple: GSK-3β inhibition, inositol depletion, neuroprotection, anti-suicidal (unique), increases grey matter volume. The oldest mood stabilizer with the most evidence.',
  indications:['Bipolar I (acute mania + maintenance)','Bipolar Depression (augmentation)','MDD augmentation','Anti-suicidal (unique indication)'],
  dosing:{
    adult:{start:'300mg BID or TID',target:'900-1200mg/day (0.6-1.2 mEq/L)',max:'1800mg/day (acute mania: 1.0-1.2 mEq/L)',titration:'Check level after 5 days. Adjust by 300mg.'},
    pediatric:{note:'FDA-approved bipolar 7+. Weight-based dosing.'},
    elderly:{start:'150-300mg',target:'Lower levels (0.4-0.8 mEq/L)',note:'Reduced renal clearance. Higher toxicity risk.'},
    renal:'REDUCE dose significantly. Contraindicated in severe renal disease.', hepatic:'No adjustment (renal elimination)'
  },
  sideEffects:{
    common:['Tremor (fine, 15-30%)','Polyuria/polydipsia (25-35%)','Weight gain (20%)','GI upset/nausea','Cognitive dulling','Hypothyroidism (5-35%)','Acne','Edema'],
    serious:['Lithium toxicity (narrow therapeutic index: 0.6-1.2 mEq/L; toxic >1.5)','Nephrogenic diabetes insipidus','Chronic renal disease (long-term)','Hypothyroidism','Cardiac conduction abnormalities','Teratogenicity (Ebstein anomaly)','Serotonin syndrome (with serotonergics)'],
    sexual:'Decreased libido reported. May be related to hypothyroidism.'
  },
  blackBox:'Lithium toxicity can be fatal. Maintain adequate hydration and sodium. Narrow therapeutic index.',
  contraindications:['Severe renal impairment','Severe cardiovascular disease','Severe dehydration/sodium depletion','Brugada syndrome','Pregnancy (1st trimester — Ebstein anomaly)','Concurrent psilocybin (seizure risk)'],
  interactions:['NSAIDs (increase lithium levels — monitor closely)','ACE inhibitors/ARBs (increase levels)','Diuretics especially thiazides (increase levels)','SSRIs (serotonin syndrome)','Carbamazepine (neurotoxicity)','Psilocybin (ABSOLUTE CONTRAINDICATION)'],
  monitoring:['Lithium level: 5 days after each change, then q3-6mo (trough, 12hr post-dose)','Renal: BUN/Cr baseline, q6-12mo','Thyroid: TSH baseline, q6-12mo','Calcium/PTH (hyperparathyroidism)','ECG (baseline if >40yo)','Weight','CBC'],
  onset:'Mania: 1-2 weeks. Full mood stabilization: 4-6 weeks.',
  halfLife:'18-36 hours (longer in elderly)',
  pregnancy:'Category D (1st trimester). Ebstein anomaly 0.05-0.1%. Risk/benefit discussion. Fetal echo if exposed.',
  costRange:'Generic: $4-15/month. Level monitoring: $30-50/draw.',
  sponsored:false
},

// ─── GUANFACINE ────────────────────────────────────────────
'Guanfacine': {
  brand:['Intuniv® (ER)','Tenex® (IR)'], generic:'Guanfacine HCl', class:'Alpha-2A Adrenergic Agonist', schedule:'Non-scheduled',
  mechanism:'Selective alpha-2A agonist. Strengthens PFC network connectivity by enhancing post-synaptic alpha-2A signaling on dendritic spines. Non-stimulant ADHD treatment.',
  indications:['ADHD (Intuniv ER FDA-approved)','Hypertension (Tenex IR)','PTSD (off-label)','Tic Disorders (off-label)'],
  dosing:{
    adult:{start:'1mg daily (ER)',target:'1-4mg daily',max:'4mg/day (ADHD)',titration:'Increase by 1mg/week'},
    pediatric:{start:'1mg daily ER (age 6+)',target:'1-4mg/day (weight-based: 0.05-0.12mg/kg)',max:'4mg/day (age 6-12); 7mg/day (13-17)',note:'FDA-approved ADHD 6-17'},
    elderly:{note:'Start 0.5-1mg. BP monitoring.'},
    renal:'Use caution. Renal elimination.', hepatic:'Use caution. Consider dose reduction.'
  },
  sideEffects:{
    common:['Somnolence (28-38%)','Headache (17%)','Fatigue (12%)','Abdominal pain (10%)','Dizziness (7%)','Hypotension/bradycardia','Decreased appetite','Irritability','Dry mouth'],
    serious:['Hypotension/bradycardia (dose-related)','Syncope','Rebound hypertension (if stopped abruptly)','Sedation','Heart block (rare)'],
    sexual:'Not typically affected.'
  },
  blackBox:'None.',
  contraindications:['Hypersensitivity'],
  interactions:['CYP3A4 inhibitors (increase levels)','CYP3A4 inducers (decrease levels)','CNS depressants (additive sedation)','Antihypertensives (additive hypotension)','Valproic acid (increased valproate levels)'],
  monitoring:['HR and BP (baseline, titration, periodic)','Sedation (usually improves after 2-3 weeks)','Rebound if stopping (taper over 3-7 days)'],
  onset:'1-3 weeks for ADHD symptoms.',
  halfLife:'17 hours (ER)',
  pregnancy:'Category B.',
  costRange:'Generic ER: $15-40/month.',
  sponsored:false
},

// ─── NALTREXONE ────────────────────────────────────────────
'Naltrexone': {
  brand:['ReVia®','Vivitrol® (injection)'], generic:'Naltrexone HCl', class:'Opioid Antagonist', schedule:'Non-scheduled',
  mechanism:'Competitive mu-opioid receptor antagonist. Blocks endogenous opioid reward signal → reduces craving and reward from substance/behavioral addictions.',
  indications:['Alcohol Use Disorder','Opioid Use Disorder (after detox)','Gambling Disorder (off-label)','Binge Eating (off-label)','Self-Harm Reduction (off-label)'],
  dosing:{
    adult:{start:'25mg day 1, then 50mg daily',target:'50mg daily (oral) or 380mg IM monthly (Vivitrol)',max:'50mg/day oral',titration:'Test with 25mg first dose for tolerability'},
    elderly:{note:'No specific adjustment. Standard dosing.'},
    renal:'Caution in mild-moderate. Avoid in severe.', hepatic:'Avoid in acute hepatitis or liver failure. Caution with elevated LFTs.'
  },
  sideEffects:{
    common:['Nausea (10%)','Headache (7%)','Dizziness (4%)','Fatigue','Anxiety','Insomnia','Injection site reactions (Vivitrol: 69%)','Abdominal pain','Joint/muscle pain'],
    serious:['Hepatotoxicity (dose-related, historically at higher doses)','Precipitated withdrawal if opioids in system','Depression/suicidality','Eosinophilic pneumonia (rare, Vivitrol)'],
    sexual:'Not typically affected.'
  },
  blackBox:'Hepatotoxicity risk. Obtain LFTs before starting and periodically. Vulnerability to opioid overdose after discontinuation (lowered tolerance).',
  contraindications:['Current opioid use (precipitated withdrawal)','Positive urine drug screen for opioids','Acute opioid withdrawal','Acute hepatitis/liver failure','Hypersensitivity'],
  interactions:['Opioid analgesics (blocked — pain management emergency plan needed)','Thioridazine','Disulfiram (hepatotoxicity additive)'],
  monitoring:['LFTs baseline + periodic','Opioid-free verification (7-10 days) before starting','Depression/suicidality','Pain management plan (opioids will not work while on naltrexone)','Injection site (Vivitrol)'],
  onset:'Alcohol craving reduction: 1-2 weeks. Full effect: 3-4 weeks.',
  halfLife:'4 hours (naltrexone); 12 hours (6-beta-naltrexol). Vivitrol: sustained release ~30 days.',
  pregnancy:'Category C. Limited data.',
  costRange:'Generic oral: $30-60/month. Vivitrol injection: $1,000-1,500/month.',
  sponsored:false
},

// ─── ANXIOLYTICS (NON-BENZO) ──────────────────────────────
'Buspirone': {
  brand:['BuSpar®'], generic:'Buspirone HCl', class:'Azapirone anxiolytic (5-HT1A partial agonist)', schedule:'Non-scheduled',
  mechanism:'Full agonist at presynaptic 5-HT1A autoreceptors in dorsal raphe (reduces serotonin firing initially); partial agonist at postsynaptic 5-HT1A receptors in hippocampus/cortex. Autoreceptor desensitization over 2-4 weeks restores and enhances serotonergic tone. Weak D2 antagonism. Active metabolite 1-PP is potent α2-adrenergic antagonist. No GABA receptor activity — no sedation, no dependence, no withdrawal.',
  indications:['GAD (FDA-approved)','Anxiety symptoms (short-term)','SSRI augmentation for depression (off-label, STAR*D evidence)','SSRI-induced sexual dysfunction (off-label)'],
  dosing:{
    adult:{start:'5mg BID-TID (or 7.5mg BID)',target:'15-30mg/day in 2-3 divided doses',max:'60mg/day',titration:'Increase by 5mg/day every 2-3 days'},
    pediatric:{start:'Not FDA-approved in children',note:'Two controlled trials in pediatric GAD failed to separate from placebo'},
    elderly:{start:'5mg BID',note:'Start low, adjust cautiously; no specific dose adjustment required but reduced clearance possible'},
    renal:'CrCl 10-70 mL/min: bioavailability increased 4-fold; reduce dose. Not recommended in severe renal impairment.',
    hepatic:'Reduced clearance; use lower doses. Contraindicated in severe hepatic impairment.'
  },
  sideEffects:{
    common:['Dizziness (12%)','Nausea (8%)','Headache (6%)','Nervousness (5%)','Lightheadedness (3%)','Excitement (2%)','Insomnia','GI distress','Dry mouth'],
    serious:['Serotonin syndrome (rare, with serotonergic drugs)','Extrapyramidal symptoms (rare, high doses)','Akathisia (rare)'],
    sexual:'Minimal sexual side effects; may improve SSRI-induced sexual dysfunction when used as augmentation'
  },
  blackBox:'None.',
  contraindications:['MAOIs (14-day washout)','Severe hepatic impairment','Severe renal impairment','Hypersensitivity to buspirone'],
  interactions:['MAOIs (hypertensive crisis risk)','CYP3A4 inhibitors (erythromycin, itraconazole, nefazodone — increase levels; reduce dose to 2.5mg BID)','CYP3A4 inducers (rifampin, carbamazepine — decrease levels; may need dose increase)','Grapefruit juice (increases levels)','Haloperidol (increased haloperidol levels)'],
  monitoring:['Clinical response (allow 2-4 weeks)','Hepatic function if pre-existing disease','Emergence of serotonergic symptoms if combined with SSRIs/SNRIs'],
  onset:'2-4 weeks for full anxiolytic effect. No immediate relief — not useful PRN.',
  halfLife:'2-3 hours (parent compound); active metabolite 1-PP has longer duration. Nonlinear pharmacokinetics at higher doses.',
  pregnancy:'Category B (animal studies negative; inadequate human data). Use only if clearly needed.',
  costRange:'Generic: $10-30/month.',
  clinicalPearls:'Previous benzodiazepine use may reduce effectiveness — works best in benzo-naive patients. Cannot substitute for benzodiazepines and will not prevent benzo withdrawal. Take consistently with or without food (food increases bioavailability 84%). No abuse potential.',
  sponsored:false
},

'Hydroxyzine': {
  brand:['Atarax® (HCl)','Vistaril® (pamoate)'], generic:'Hydroxyzine HCl / Hydroxyzine Pamoate', class:'First-generation antihistamine (H1 antagonist) / Anxiolytic', schedule:'Non-scheduled',
  mechanism:'H1 histamine receptor antagonist with CNS depressant properties. Suppresses subcortical activity producing anxiolytic and sedative effects. Weak 5-HT2A antagonism may contribute to anxiolytic action. Anticholinergic properties. Rapid onset (15-30 min) — useful as PRN anxiolytic alternative to benzodiazepines.',
  indications:['Anxiety (FDA-approved, short-term)','Pruritus/allergic conditions (FDA-approved)','Pre-operative sedation (FDA-approved)','Insomnia (off-label)','Acute agitation (IM, off-label)'],
  dosing:{
    adult:{start:'25mg BID-TID',target:'50-100mg QID (anxiety); 25mg TID-QID (pruritus)',max:'400mg/day',titration:'Start low in elderly; adjust based on response'},
    pediatric:{start:'Under 6: 50mg/day divided; Over 6: 50-100mg/day divided',note:'Pre-op sedation: 0.6mg/kg'},
    elderly:{start:'12.5-25mg',note:'Start low; increased risk of sedation, confusion, falls, anticholinergic effects.'},
    renal:'Use caution, start low; extent of renal excretion not fully determined.',
    hepatic:'Reduced clearance expected; use lower doses.'
  },
  sideEffects:{
    common:['Drowsiness (most common, usually transient)','Dry mouth','Headache','Dizziness','Fatigue'],
    serious:['QT prolongation / Torsade de Pointes','Seizures/tremor (high doses)','Paradoxical excitation','AGEP (rare)','Respiratory depression (with CNS depressants)'],
    sexual:'Not typically associated with sexual dysfunction'
  },
  blackBox:'None.',
  contraindications:['Early pregnancy (teratogenic in animals)','Prolonged QT interval / congenital long QT syndrome','Hypersensitivity to hydroxyzine or cetirizine'],
  interactions:['CNS depressants (opioids, barbiturates, alcohol — potentiates sedation; reduce depressant doses)','QT-prolonging drugs','Anticholinergic drugs (additive effects)','Epinephrine (counteracts pressor action — do not use in overdose)'],
  monitoring:['Sedation level','QTc interval (baseline ECG if risk factors)','Anticholinergic burden (especially elderly)','Fall risk'],
  onset:'15-30 minutes. Clinical effects last 4-6 hours.',
  halfLife:'14-25 hours (adults); ~7 hours (children). Cetirizine is active metabolite.',
  pregnancy:'Contraindicated in early pregnancy (animal teratogenicity). Inadequate human data.',
  costRange:'Generic: $5-20/month.',
  clinicalPearls:'Useful PRN anxiolytic without abuse/dependence risk. Long-term use (>4 months) not studied. Avoid in elderly per Beers Criteria. Note: 1mg HCl ≈ 1.7mg pamoate.',
  sponsored:false
},

// ─── GABAPENTINOIDS ───────────────────────────────────────
'Gabapentin': {
  brand:['Neurontin®','Gralise® (ER)','Horizant® (enacarbil prodrug)'], generic:'Gabapentin', class:'Anticonvulsant / Gabapentinoid (α2δ calcium channel ligand)', schedule:'Non-scheduled federally (Schedule V in some US states)',
  mechanism:'Binds α2δ-1 subunit of voltage-gated calcium channels → reduces presynaptic calcium influx → decreases release of excitatory neurotransmitters (glutamate, norepinephrine, substance P). Structurally similar to GABA but does NOT bind GABA receptors, alter GABA uptake/metabolism, or act as GABA agonist. Saturable L-amino acid transporter absorption limits bioavailability at higher doses.',
  indications:['Postherpetic neuralgia (FDA-approved, adults)','Partial-onset seizures adjunct (FDA-approved, age 3+)','Neuropathic pain (off-label, widely used)','Alcohol use disorder (off-label, adjunct)','Anxiety disorders (off-label)','Restless legs syndrome (Horizant FDA-approved)','Fibromyalgia (off-label)'],
  dosing:{
    adult:{start:'300mg Day 1; 300mg BID Day 2; 300mg TID Day 3',target:'900-1800mg/day TID',max:'3600mg/day in 3 divided doses',titration:'Increase by 300mg/day every 1-7 days as tolerated'},
    pediatric:{start:'10-15mg/kg/day in 3 divided doses (seizures, age 3-11)',note:'Age 12+: adult dosing'},
    elderly:{start:'100-300mg at bedtime',note:'Start low; adjust for renal function.'},
    renal:'CrCl 30-59: 200-700mg BID. CrCl 15-29: 200-700mg daily. CrCl <15: 100-300mg daily. Hemodialysis: 125-350mg post-dialysis.',
    hepatic:'No adjustment needed (not hepatically metabolized).'
  },
  sideEffects:{
    common:['Somnolence (19%)','Dizziness (17%)','Ataxia (13%)','Fatigue (11%)','Peripheral edema (8%)','Nausea (8%)','Weight gain','Blurred vision'],
    serious:['Respiratory depression (with opioids/CNS depressants)','DRESS syndrome (rare)','Suicidal ideation (anticonvulsant class warning)','Anaphylaxis/angioedema (rare)','Withdrawal seizures (if abruptly stopped after chronic use)'],
    sexual:'Occasional decreased libido and erectile dysfunction'
  },
  blackBox:'None. FDA warning: serious breathing difficulties when combined with CNS depressants, especially in elderly and patients with respiratory impairment.',
  contraindications:['Hypersensitivity to gabapentin','Caution with respiratory disease + CNS depressants'],
  interactions:['Opioids (respiratory depression — FDA warning)','CNS depressants (additive sedation)','Antacids (aluminum/magnesium — reduce absorption 20%; take gabapentin ≥2 hrs after)','Morphine (increases gabapentin levels ~44%)','No significant CYP450 interactions'],
  monitoring:['Renal function (dose adjust for CrCl <60)','Sedation/respiratory status (with opioids)','Suicidality (class warning)','Signs of misuse','Taper if discontinuing','Weight'],
  onset:'Pain relief may begin within 1 week; full effect 2-4 weeks at therapeutic dose.',
  halfLife:'5-7 hours (normal renal). ~52 hours with CrCl <30. Removed by hemodialysis.',
  pregnancy:'Category C. Use only if benefit outweighs risk.',
  costRange:'Generic: $10-30/month.',
  clinicalPearls:'Bioavailability decreases at higher single doses (60% at 900mg vs 27% at 4800mg) — MUST split into TID dosing. Common error: subtherapeutic doses without titrating to 1800-3600mg/day. Not effective for absence seizures. No hepatic metabolism — safe in liver disease.',
  sponsored:false
},
// ─── ANTICONVULSANTS / MOOD STABILIZERS ──────────────────

'Topiramate': {
  brand:['Topamax\u00ae','Trokendi XR\u00ae','Qudexy XR\u00ae'], generic:'Topiramate', class:'Anticonvulsant / Carbonic Anhydrase Inhibitor', schedule:'Non-scheduled',
  mechanism:'Multiple mechanisms: blocks voltage-gated sodium channels, enhances GABA-A activity, antagonizes AMPA/kainate glutamate receptors, inhibits carbonic anhydrase. Weight loss via reduced appetite and altered taste.',
  indications:['Epilepsy (FDA)','Migraine prophylaxis (FDA)','Binge Eating Disorder (off-label)','Alcohol Use Disorder (off-label)','Bulimia Nervosa (off-label)','PTSD (off-label)','Obesity (component of Qsymia)'],
  dosing:{
    adult:{start:'25mg/day',target:'100-200mg BID (epilepsy); 50mg BID (migraine)',max:'400mg/day',titration:'Increase by 25-50mg/week. Slow titration reduces cognitive SE.'},
    pediatric:{start:'0.5-1mg/kg/day',target:'5-9mg/kg/day',note:'FDA-approved epilepsy 2+, migraine 12+'},
    elderly:{note:'Start lower. Monitor renal function. Increased metabolic acidosis risk.'},
    renal:'CrCl <70: reduce dose 50%. Dialyzable.', hepatic:'Use with caution in hepatic impairment.'
  },
  sideEffects:{
    common:['Paresthesias (tingling, 35-50%)','Cognitive slowing ("Dopamax", 15-30%)','Weight loss (5-10%)','Fatigue','Dizziness','Taste perversion','Nausea','Anorexia','Word-finding difficulty'],
    serious:['Metabolic acidosis','Kidney stones (1.5%)','Acute myopia / angle-closure glaucoma','Oligohydrosis (decreased sweating)','Suicidal ideation','Hepatotoxicity (rare)','Hyperammonemia (with valproate)'],
    sexual:'Generally neutral. Some report decreased libido at higher doses.'
  },
  blackBox:'Suicidality risk (class warning for anticonvulsants).',
  contraindications:['Metabolic acidosis with concurrent metformin','Pregnancy (Category D \u2014 cleft lip/palate risk)','Kidney stones (relative)'],
  interactions:['Valproate (hyperammonemia)','Carbonic anhydrase inhibitors','Oral contraceptives (reduced efficacy >200mg)','Lithium','CNS depressants','Metformin'],
  monitoring:['Bicarbonate levels','Renal function','Intraocular pressure if visual symptoms','Cognitive function','Weight','Suicidality'],
  onset:'Migraine: 1 month. Weight: 2-4 weeks. Seizure control: 2-4 weeks.',
  halfLife:'21 hours.',
  pregnancy:'Category D. Cleft lip/palate risk 2-5x baseline.',
  costRange:'Generic: $15-40/month.',
  sponsored:false
},

'Lamotrigine': {
  brand:['Lamictal\u00ae','Lamictal XR\u00ae','Lamictal ODT\u00ae'], generic:'Lamotrigine', class:'Anticonvulsant / Mood Stabilizer', schedule:'Non-scheduled',
  mechanism:'Inhibits voltage-sensitive sodium channels, stabilizing presynaptic membranes and reducing glutamate release. Unique antidepressant properties among mood stabilizers \u2014 prevents depressive episodes more than manic.',
  indications:['Bipolar I maintenance (FDA)','Epilepsy (FDA)','Bipolar Depression (off-label, strong evidence)','Depersonalization/Derealization Disorder (off-label)','Treatment-resistant depression (augmentation, off-label)'],
  dosing:{
    adult:{start:'25mg/day (WITHOUT valproate); 25mg every other day (WITH valproate)',target:'200mg/day (monotherapy); 100mg/day (with valproate)',max:'400mg/day',titration:'MUST titrate slowly over 6+ weeks to avoid SJS. Increase by 25-50mg every 2 weeks.'},
    pediatric:{start:'0.3mg/kg/day (with valproate); 0.6mg/kg/day (without)',note:'FDA-approved epilepsy 2+. Not FDA-approved bipolar <18.'},
    elderly:{note:'No specific adjustment but slower titration recommended.'},
    renal:'Caution in significant impairment.', hepatic:'Moderate: reduce by 25%. Severe: reduce by 50%.'
  },
  sideEffects:{
    common:['Headache (29%)','Nausea (14%)','Dizziness (14%)','Insomnia (10%)','Rash (benign, 10%)','Diplopia','Blurred vision','Ataxia'],
    serious:['Stevens-Johnson Syndrome / TEN (0.08-0.8% \u2014 LIFE THREATENING)','Aseptic meningitis','Blood dyscrasias','Multi-organ hypersensitivity','Suicidal ideation'],
    sexual:'Generally favorable \u2014 low rates of sexual dysfunction.'
  },
  blackBox:'Serious skin rashes including Stevens-Johnson syndrome and toxic epidermal necrolysis.',
  contraindications:['Prior hypersensitivity / rash with lamotrigine'],
  interactions:['Valproate (doubles lamotrigine levels \u2014 halve dose)','Carbamazepine, phenytoin (halve lamotrigine levels)','Oral contraceptives (bidirectional interaction)','Rifampin'],
  monitoring:['Rash (any rash \u2192 immediate evaluation)','LFTs','Renal function','Suicidality'],
  onset:'Mood stabilization: 4-6 weeks after reaching target.',
  halfLife:'25 hours (monotherapy); 60 hours (with valproate); 13 hours (with enzyme inducers).',
  pregnancy:'Category C. Relatively safer than valproate.',
  costRange:'Generic: $10-30/month.',
  sponsored:false
},

'Valproate': {
  brand:['Depakote\u00ae','Depakote ER\u00ae','Depakene\u00ae'], generic:'Valproic acid / Divalproex sodium', class:'Anticonvulsant / Mood Stabilizer', schedule:'Non-scheduled',
  mechanism:'Increases GABA via inhibition of GABA transaminase, blocks voltage-gated sodium channels, modulates NMDA glutamate transmission, inhibits histone deacetylase (epigenetic effects).',
  indications:['Epilepsy (FDA)','Bipolar Mania (FDA)','Migraine prophylaxis (FDA)','Bipolar maintenance (off-label)','Aggression (off-label)'],
  dosing:{
    adult:{start:'250mg BID or 500mg ER at bedtime',target:'750-2500mg/day (serum 50-125 mcg/mL)',max:'60mg/kg/day',titration:'Increase by 250-500mg every 2-3 days.'},
    pediatric:{start:'10-15mg/kg/day',target:'30-60mg/kg/day',note:'FDA-approved epilepsy 10+'},
    elderly:{start:'Lower doses',note:'Reduced clearance. Higher free fraction.'},
    renal:'Use with caution.', hepatic:'CONTRAINDICATED in significant hepatic disease.'
  },
  sideEffects:{
    common:['Nausea/vomiting (20-30%)','Tremor (25%)','Weight gain (10-30 lbs)','Hair loss/thinning (12%)','Sedation','Thrombocytopenia (dose-related)'],
    serious:['Hepatotoxicity (fatal, especially <2 years)','Pancreatitis (life-threatening)','Hyperammonemic encephalopathy','PCOS','Neural tube defects (pregnancy)','Suicidal ideation'],
    sexual:'Weight gain and hormonal effects may reduce libido. PCOS in women.'
  },
  blackBox:'Fatal hepatotoxicity. Teratogenicity (neural tube defects, decreased IQ \u2014 CATEGORY X). Pancreatitis.',
  contraindications:['Hepatic disease','Urea cycle disorders','Pregnancy (Category X for migraine)','Mitochondrial disorders (POLG)'],
  interactions:['Lamotrigine (doubles its levels)','Carbapenems (rapid valproate decrease)','Aspirin','Warfarin','Topiramate (hyperammonemia)'],
  monitoring:['LFTs','CBC with platelets','Serum level (50-125 mcg/mL)','Ammonia if AMS','Weight','Pregnancy test'],
  onset:'Mania: 3-5 days.',
  halfLife:'9-16 hours.',
  pregnancy:'Category X (migraine) / D (epilepsy). 1-2% neural tube defect risk. AVOID.',
  costRange:'Generic: $15-50/month.',
  sponsored:false
},

// ─── ATYPICAL ANTIPSYCHOTICS ──────────────────────────────

'Quetiapine': {
  brand:['Seroquel\u00ae','Seroquel XR\u00ae'], generic:'Quetiapine fumarate', class:'Atypical Antipsychotic (Second Generation)', schedule:'Non-scheduled',
  mechanism:'Antagonist at D2 (low affinity), 5-HT2A, H1 (sedation), alpha-1. Active metabolite norquetiapine inhibits NET (antidepressant effect) and is partial 5-HT1A agonist.',
  indications:['Schizophrenia (FDA)','Bipolar Mania (FDA)','Bipolar Depression (FDA)','MDD augmentation (FDA, XR)','Insomnia (off-label)','GAD (off-label)','PTSD (off-label)'],
  dosing:{
    adult:{start:'25mg BID (psychosis) or 50mg HS (depression)',target:'400-800mg/day (schizophrenia); 300mg HS (bipolar depression)',max:'800mg/day',titration:'Titrate over 4+ days for psychosis.'},
    pediatric:{start:'25mg BID',note:'FDA-approved schizophrenia 13+, bipolar mania 10+'},
    elderly:{start:'25mg/day',note:'Black box: increased mortality in dementia-related psychosis.'},
    renal:'No adjustment.', hepatic:'Start 25mg/day. Titrate slowly.'
  },
  sideEffects:{
    common:['Sedation (25-50%)','Weight gain','Dry mouth (15%)','Dizziness','Orthostatic hypotension','Elevated triglycerides/cholesterol'],
    serious:['Metabolic syndrome','Type 2 diabetes','Tardive dyskinesia','NMS','QTc prolongation','Cataracts','Suicidal ideation (young adults)'],
    sexual:'Less prolactin elevation than risperidone.'
  },
  blackBox:'Increased mortality in elderly with dementia-related psychosis. Suicidality (antidepressant indication).',
  contraindications:['Hypersensitivity'],
  interactions:['CYP3A4 inhibitors (ketoconazole)','CYP3A4 inducers (carbamazepine)','CNS depressants'],
  monitoring:['Fasting glucose + lipids','Weight/BMI','Blood pressure','Slit lamp exam','TD screening'],
  onset:'Sedation: immediate. Antipsychotic: 1-2 weeks.',
  halfLife:'~7 hours (quetiapine); ~12 hours (norquetiapine).',
  pregnancy:'Category C.',
  costRange:'Generic: $10-30/month.',
  sponsored:false
},

'Olanzapine': {
  brand:['Zyprexa\u00ae','Zyprexa Zydis\u00ae','Symbyax\u00ae (with fluoxetine)'], generic:'Olanzapine', class:'Atypical Antipsychotic (Second Generation)', schedule:'Non-scheduled',
  mechanism:'Antagonist at D1-D4, 5-HT2A/2C/3/6, H1, M1-M5, alpha-1. Broadest receptor profile \u2014 highly effective but significant metabolic burden.',
  indications:['Schizophrenia (FDA)','Bipolar Mania (FDA)','Bipolar Depression (FDA, with fluoxetine)','Acute agitation (IM, FDA)','Anorexia nervosa (off-label, low dose)'],
  dosing:{
    adult:{start:'5-10mg/day',target:'10-20mg/day',max:'20mg/day',titration:'Increase by 5mg at \u22651 week intervals.'},
    pediatric:{start:'2.5mg',note:'FDA-approved 13+. Greater weight gain than adults.'},
    elderly:{start:'2.5-5mg',note:'Increased mortality in dementia.'},
    renal:'No adjustment.', hepatic:'Start 5mg.'
  },
  sideEffects:{
    common:['Weight gain (5-10kg first year \u2014 WORST in class)','Sedation (35%)','Dry mouth','Increased appetite','Elevated prolactin'],
    serious:['Metabolic syndrome (highest risk in class)','Type 2 diabetes','DKA (rare, fatal)','Tardive dyskinesia','NMS','Post-injection delirium (depot)'],
    sexual:'Prolactin elevation: galactorrhea, amenorrhea, ED.'
  },
  blackBox:'Increased mortality in elderly with dementia. Post-injection delirium/sedation syndrome (Relprevv \u2014 REMS).',
  contraindications:['Hypersensitivity'],
  interactions:['CYP1A2 inducers (smoking \u2014 reduces 50%)','CYP1A2 inhibitors (fluvoxamine \u2014 doubles)','CNS depressants'],
  monitoring:['Fasting glucose + HbA1c','Lipids','Weight','BMI','Blood pressure','Prolactin if symptoms'],
  onset:'IM: 15-30 min. Psychosis: 1-2 weeks.',
  halfLife:'21-54 hours (mean 30).',
  pregnancy:'Category C.',
  costRange:'Generic: $10-40/month.',
  sponsored:false
},

'Risperidone': {
  brand:['Risperdal\u00ae','Risperdal Consta\u00ae (LAI)'], generic:'Risperidone', class:'Atypical Antipsychotic (Second Generation)', schedule:'Non-scheduled',
  mechanism:'Potent D2 and 5-HT2A antagonist. Also blocks alpha-1 and H1. Active metabolite paliperidone. Higher D2 affinity than quetiapine/olanzapine \u2014 more EPS at higher doses.',
  indications:['Schizophrenia (FDA)','Bipolar Mania (FDA)','Irritability in autism (FDA, 5-16)','Tourette (off-label)','Severe aggression (off-label)'],
  dosing:{
    adult:{start:'1-2mg/day',target:'4-6mg/day (schizophrenia); 2-3mg/day (mania)',max:'8mg/day',titration:'Increase by 1mg/day.'},
    pediatric:{start:'0.25mg (15-20kg) or 0.5mg (>20kg)',target:'0.5-3mg/day (autism)',note:'FDA autism irritability 5-16.'},
    elderly:{start:'0.25-0.5mg BID',note:'Increased mortality in dementia. EPS sensitivity.'},
    renal:'Start 0.5mg BID. Max 3mg in severe.', hepatic:'Start 0.5mg BID.'
  },
  sideEffects:{
    common:['Prolactin elevation (highest in class \u2014 70-90%)','Weight gain (moderate)','Sedation','EPS/akathisia','Dizziness'],
    serious:['Hyperprolactinemia \u2192 gynecomastia, galactorrhea, osteoporosis','Tardive dyskinesia','NMS','Cerebrovascular events (elderly)'],
    sexual:'HIGH rates: ED, decreased libido, anorgasmia, galactorrhea.'
  },
  blackBox:'Increased mortality in elderly with dementia.',
  contraindications:['Hypersensitivity to risperidone or paliperidone'],
  interactions:['CYP2D6 inhibitors','Carbamazepine (decreases levels)','CNS depressants','Levodopa (antagonism)'],
  monitoring:['Prolactin','Metabolic panel','Weight/BMI','EPS/AIMS','Blood pressure'],
  onset:'Agitation: hours. Psychosis: 1-2 weeks.',
  halfLife:'3-20 hours; paliperidone 21 hours.',
  pregnancy:'Category C. Third trimester: neonatal EPS.',
  costRange:'Generic: $10-25/month.',
  sponsored:false
},

// ─── BETA BLOCKERS ──────────────────────────────────────

'Propranolol': {
  brand:['Inderal\u00ae','Inderal LA\u00ae'], generic:'Propranolol HCl', class:'Non-selective Beta-Adrenergic Blocker', schedule:'Non-scheduled',
  mechanism:'Non-selective beta-1/beta-2 antagonist. Blocks peripheral sympathetic activation. Lipophilic \u2014 crosses BBB. Disrupts noradrenergic memory reconsolidation (Nader et al., 2000). Reduces somatic anxiety symptoms, not subjective anxiety.',
  indications:['Hypertension (FDA)','Performance anxiety (off-label)','Essential tremor (FDA)','Migraine prophylaxis (FDA)','Memory reconsolidation disruption (experimental)','Akathisia (off-label)'],
  dosing:{
    adult:{start:'10-20mg PRN or BID',target:'10-40mg PRN (performance); 40-160mg/day (standing)',max:'320mg/day',titration:'Increase by 20-40mg every 3-7 days.'},
    pediatric:{start:'0.5-1mg/kg/day',note:'Used for infantile hemangioma.'},
    elderly:{start:'10mg BID',note:'Monitor bradycardia and hypotension.'},
    renal:'Use caution.', hepatic:'Reduce dose 50%.'
  },
  sideEffects:{
    common:['Fatigue (10-20%)','Bradycardia','Cold extremities','Dizziness','Vivid dreams','Exercise intolerance'],
    serious:['Severe bradycardia','Bronchospasm','Heart failure exacerbation','Hypoglycemia masking','Rebound hypertension (abrupt withdrawal)'],
    sexual:'ED in 5-10%.'
  },
  blackBox:'None.',
  contraindications:['Asthma/severe COPD','Sinus bradycardia','Heart block >1st degree','Cardiogenic shock','Decompensated heart failure'],
  interactions:['Calcium channel blockers','Clonidine','Insulin/sulfonylureas','Epinephrine (hypertensive crisis)'],
  monitoring:['Heart rate','Blood pressure','Blood glucose (diabetics)','Taper \u2014 do NOT stop abruptly'],
  onset:'PRN: 30-60 minutes.',
  halfLife:'3-6 hours (IR); 8-10 hours (LA).',
  pregnancy:'Category C.',
  costRange:'Generic: $4-15/month.',
  sponsored:false
},

// ─── NON-STIMULANT ADHD ──────────────────────────────────

'Atomoxetine': {
  brand:['Strattera\u00ae'], generic:'Atomoxetine HCl', class:'Selective Norepinephrine Reuptake Inhibitor (non-stimulant)', schedule:'Non-scheduled',
  mechanism:'Selective NET inhibitor. Increases NE and DA in prefrontal cortex. No effect on DA in nucleus accumbens (low abuse potential). Not a stimulant.',
  indications:['ADHD in children 6+ and adults (FDA)'],
  dosing:{
    adult:{start:'40mg/day',target:'80-100mg/day',max:'100mg/day',titration:'40mg \u00d7 3 days \u2192 80mg \u00d7 2-4 weeks \u2192 100mg.'},
    pediatric:{start:'0.5mg/kg/day',target:'1.2mg/kg/day',max:'1.4mg/kg/day or 100mg',note:'FDA-approved 6+.'},
    elderly:{note:'Start lowest dose.'},
    renal:'No adjustment.', hepatic:'Moderate: 50%. Severe: 25%.'
  },
  sideEffects:{
    common:['Decreased appetite (16-26%)','Nausea (26%)','Dry mouth (17%)','Insomnia (15%)','Fatigue','Dizziness'],
    serious:['Suicidal ideation (0.4% pediatric)','Hepatotoxicity (rare, fatal)','Cardiovascular effects','Priapism (rare)'],
    sexual:'ED, ejaculatory dysfunction, decreased libido.'
  },
  blackBox:'Suicidal ideation in children and adolescents.',
  contraindications:['MAOIs','Narrow-angle glaucoma','Pheochromocytoma','Severe cardiovascular disorders'],
  interactions:['MAOIs','CYP2D6 inhibitors (fluoxetine, paroxetine)','Albuterol'],
  monitoring:['Height/weight (pediatric)','HR and BP','Suicidality','Hepatic function if symptoms'],
  onset:'1-2 weeks; full effect 4-6 weeks.',
  halfLife:'5 hours (normal); 22 hours (CYP2D6 poor metabolizers).',
  pregnancy:'Category C.',
  costRange:'Generic: $30-80/month.',
  sponsored:false
},

// ─── TRICYCLIC ──────────────────────────────────────────

'Clomipramine': {
  brand:['Anafranil\u00ae'], generic:'Clomipramine HCl', class:'Tricyclic Antidepressant (TCA) \u2014 Serotonergic', schedule:'Non-scheduled',
  mechanism:'Most serotonergic TCA. Potent SERT inhibitor plus NE reuptake via desmethylclomipramine. Gold standard pharmacotherapy for OCD. Also blocks H1, muscarinic, alpha-1.',
  indications:['OCD (FDA)','Body Dysmorphic Disorder (off-label)','Panic Disorder (off-label)','Treatment-resistant depression (off-label)'],
  dosing:{
    adult:{start:'25mg/day',target:'100-250mg/day',max:'250mg/day',titration:'Increase by 25mg every 4-7 days. Give at bedtime.'},
    pediatric:{start:'25mg/day',target:'3mg/kg or 100mg',max:'3mg/kg or 200mg',note:'FDA-approved OCD 10+.'},
    elderly:{start:'10-25mg',note:'ECG monitoring. Fall/cardiac risk.'},
    renal:'Use caution.', hepatic:'Reduce dose.'
  },
  sideEffects:{
    common:['Dry mouth (84%)','Sedation (54%)','Tremor (54%)','Constipation (47%)','Dizziness (54%)','Weight gain','Sweating (29%)'],
    serious:['Cardiac arrhythmia / QTc prolongation','Seizures (1-2% at high doses)','Serotonin syndrome','Orthostatic hypotension','Suicidal ideation'],
    sexual:'Very high: anorgasmia (20-40%), ED, decreased libido.'
  },
  blackBox:'Suicidality in youth.',
  contraindications:['MAOIs','Recent MI','Bundle branch block','QTc >450ms'],
  interactions:['MAOIs','CYP2D6 inhibitors','CYP1A2 inhibitors','QTc-prolonging agents','Alcohol/CNS depressants'],
  monitoring:['ECG','Blood levels (150-300 ng/mL)','LFTs','CBC','Blood pressure'],
  onset:'OCD: 4-6 weeks. Full response: 10-12 weeks.',
  halfLife:'32 hours (clomipramine); 69 hours (desmethyl).',
  pregnancy:'Category C.',
  costRange:'Generic: $15-50/month.',
  sponsored:false
},

// ─── CESSATION ──────────────────────────────────────────

'Varenicline': {
  brand:['Chantix\u00ae'], generic:'Varenicline tartrate', class:'Nicotinic Acetylcholine Receptor Partial Agonist', schedule:'Non-scheduled',
  mechanism:'Partial agonist at alpha-4-beta-2 nAChRs. Reduces withdrawal/craving (partial agonist) and blocks nicotine reward (competitive antagonist).',
  indications:['Smoking cessation (FDA)'],
  dosing:{
    adult:{start:'0.5mg daily \u00d7 3 days \u2192 0.5mg BID \u00d7 4 days',target:'1mg BID',max:'1mg BID',titration:'Start 1 week before quit date. 12-week course.'},
    pediatric:{note:'Not FDA-approved <16.'},
    elderly:{note:'No adjustment. Monitor renal function.'},
    renal:'eGFR <30: max 0.5mg BID.', hepatic:'No adjustment.'
  },
  sideEffects:{
    common:['Nausea (30%)','Insomnia (18%)','Abnormal dreams (13%)','Headache','Constipation'],
    serious:['Neuropsychiatric events (black box removed 2016 after EAGLES)','Cardiovascular events (debated)','Seizures (rare)','Angioedema'],
    sexual:'Minimal.'
  },
  blackBox:'None (removed 2016).',
  contraindications:['Hypersensitivity'],
  interactions:['Minimal (not CYP metabolized)','Cimetidine','NRT (increased nausea but combo used)'],
  monitoring:['Neuropsychiatric symptoms','Smoking status','Renal function'],
  onset:'Steady state: 4 days.',
  halfLife:'24 hours.',
  pregnancy:'Category C.',
  costRange:'Generic: $50-100/month.',
  sponsored:false
},

'Disulfiram': {
  brand:['Antabuse\u00ae'], generic:'Disulfiram', class:'Aldehyde Dehydrogenase Inhibitor', schedule:'Non-scheduled',
  mechanism:'Irreversibly inhibits aldehyde dehydrogenase \u2192 acetaldehyde accumulates with alcohol \u2192 severe aversive reaction. Deterrent-based. Also inhibits dopamine beta-hydroxylase.',
  indications:['Alcohol Use Disorder (FDA)','Cocaine Use Disorder (off-label, investigational)'],
  dosing:{
    adult:{start:'250mg daily (12+ hours abstinent)',target:'250mg daily',max:'500mg/day',titration:'Must be alcohol-free before starting.'},
    pediatric:{note:'Not used.'},
    elderly:{note:'Increased hepatotoxicity risk.'},
    renal:'Use caution.', hepatic:'CONTRAINDICATED in severe hepatic disease.'
  },
  sideEffects:{
    common:['Metallic/garlic aftertaste','Drowsiness','Headache'],
    serious:['Disulfiram-ethanol reaction (potentially fatal)','Hepatotoxicity (including fatal)','Peripheral neuropathy','Psychosis (rare)'],
    sexual:'May cause ED.'
  },
  blackBox:'None. Serious warnings about ethanol reaction and hepatotoxicity.',
  contraindications:['Recent alcohol (<12 hours)','Severe cardiac disease','Psychosis','Metronidazole','Severe hepatic disease'],
  interactions:['ALL alcohol (including hidden sources)','Metronidazole','Isoniazid','Phenytoin','Warfarin'],
  monitoring:['LFTs (baseline, 2 weeks, monthly \u00d7 6)','CBC','Patient education on reaction risk'],
  onset:'12 hours. Effect lasts 1-2 weeks after stopping.',
  halfLife:'Irreversible enzyme inhibition.',
  pregnancy:'Category C.',
  costRange:'Generic: $15-30/month.',
  sponsored:false
},

'Buprenorphine': {
  brand:['Suboxone\u00ae (+ naloxone)','Sublocade\u00ae (injection)','Subutex\u00ae'], generic:'Buprenorphine HCl', class:'Partial Opioid Agonist (mu) / Antagonist (kappa)', schedule:'Schedule III',
  mechanism:'Partial mu-opioid agonist with ceiling effect on respiratory depression. High binding affinity blocks other opioids. Kappa antagonist (antidepressant properties). Ceiling effect reduces overdose risk vs full agonists.',
  indications:['Opioid Use Disorder (FDA)','Chronic Pain (transdermal/buccal)','Treatment-resistant depression (off-label, low-dose)'],
  dosing:{
    adult:{start:'2-4mg sublingual day 1 (in withdrawal, COWS \u22658)',target:'8-24mg/day sublingual',max:'24mg/day',titration:'Induction in mild-moderate withdrawal. Micro-dosing (Bernese) protocols available.'},
    pediatric:{note:'OUD: 16+ only.'},
    elderly:{start:'Lower doses',note:'Respiratory monitoring.'},
    renal:'No adjustment.', hepatic:'Moderate: reduce dose. Severe: avoid Suboxone.'
  },
  sideEffects:{
    common:['Headache (36%)','Withdrawal symptoms during induction (25%)','Nausea (15%)','Insomnia','Sweating','Constipation'],
    serious:['Respiratory depression (rare \u2014 ceiling)','Precipitated withdrawal','Hepatotoxicity','QTc prolongation','Neonatal withdrawal','Diversion risk'],
    sexual:'May reduce testosterone \u2192 decreased libido, ED.'
  },
  blackBox:'Benzodiazepine/CNS depressant risks. Abuse/misuse. Respiratory depression. Neonatal withdrawal. Dental problems.',
  contraindications:['Significant respiratory depression','Acute/severe asthma','Known GI obstruction'],
  interactions:['Benzodiazepines (BLACK BOX)','CNS depressants','CYP3A4 inhibitors/inducers','Other opioids','Naltrexone'],
  monitoring:['Urine drug screens','Diversion assessment','LFTs','Respiratory status','COWS during induction','Dental health'],
  onset:'Sublingual: 30-60 minutes.',
  halfLife:'24-42 hours.',
  pregnancy:'Preferred over methadone in many guidelines. Neonatal withdrawal milder.',
  costRange:'Generic sublingual: $50-150/month. Sublocade: $1,500+/month.',
  sponsored:false
},

// ─── SLEEP ──────────────────────────────────────────────

'Melatonin': {
  brand:['OTC various'], generic:'Melatonin', class:'Neurohormone / Chronobiotic', schedule:'Non-scheduled (OTC)',
  mechanism:'Endogenous pineal hormone. MT1 (sleep onset) and MT2 (circadian phase shifting) agonist. Shifts timing of sleep, not depth. NOT sedating at physiological doses.',
  indications:['Circadian rhythm disorders','Primary insomnia (mild)','Jet lag','ASD sleep disturbance','ADHD sleep onset delay'],
  dosing:{
    adult:{start:'0.5mg 30-60 min before bed',target:'0.5-3mg',max:'5mg (higher not more effective)',titration:'Start LOW. Most people take too much.'},
    pediatric:{start:'0.5-1mg',target:'1-3mg',note:'Well-tolerated in ASD/ADHD.'},
    elderly:{start:'0.5mg',note:'Endogenous production declines with age.'},
    renal:'No adjustment.', hepatic:'Start low.'
  },
  sideEffects:{
    common:['Next-day grogginess (if too high)','Headache','Dizziness','Vivid dreams'],
    serious:['Rarely: worsened depression','Anticoagulant interaction'],
    sexual:'Minimal.'
  },
  blackBox:'None.',
  contraindications:['Autoimmune disorders (theoretical)'],
  interactions:['Fluvoxamine (massively increases levels)','Caffeine','Anticoagulants','Beta-blockers (suppress endogenous)'],
  monitoring:['Sleep diary','Timing consistency','Not habit-forming'],
  onset:'30-60 minutes.',
  halfLife:'20-50 minutes.',
  pregnancy:'Insufficient data.',
  costRange:'OTC: $5-15/month.',
  sponsored:false
},

// ─── GLUTAMATE MODULATORS ────────────────────────────────

'N-Acetylcysteine': {
  brand:['NAC (OTC)','Mucomyst\u00ae (Rx)','Acetadote\u00ae (IV)'], generic:'N-Acetylcysteine (NAC)', class:'Glutamate Modulator / Antioxidant', schedule:'Non-scheduled (OTC)',
  mechanism:'Prodrug of L-cysteine \u2192 replenishes glutathione. Restores cystine-glutamate antiporter in nucleus accumbens, normalizing extracellular glutamate in addiction and OCD circuits. Anti-inflammatory via NF-\u03baB.',
  indications:['Acetaminophen overdose (FDA, IV)','Trichotillomania (off-label)','OCD augmentation (off-label)','Substance Use Disorders (off-label)','Bipolar depression augmentation (off-label)','Gambling disorder (off-label)'],
  dosing:{
    adult:{start:'600mg BID',target:'1200-2400mg/day divided',max:'3000mg/day',titration:'Start 600mg BID. Take with food.'},
    pediatric:{note:'Limited psychiatric data. 600-1200mg/day studied.'},
    elderly:{note:'Generally well-tolerated.'},
    renal:'Use caution.', hepatic:'Well-studied in liver disease. Generally safe.'
  },
  sideEffects:{
    common:['GI upset (nausea, diarrhea, bloating)','Sulfurous smell/taste','Headache'],
    serious:['Anaphylactoid reactions (IV, rare)','Bronchospasm (inhaled)'],
    sexual:'None reported.'
  },
  blackBox:'None.',
  contraindications:['Hypersensitivity','Asthma (inhaled form)'],
  interactions:['Nitroglycerin (potentiation)','Activated charcoal (reduced absorption)'],
  monitoring:['GI tolerability','Clinical response (8-12 weeks for psychiatric)'],
  onset:'Psychiatric effects: 8-12 weeks.',
  halfLife:'5.6 hours.',
  pregnancy:'Category B (IV). Limited oral data.',
  costRange:'OTC: $10-25/month.',
  sponsored:false
},

'Memantine': {
  brand:['Namenda\u00ae','Namenda XR\u00ae'], generic:'Memantine HCl', class:'NMDA Receptor Antagonist', schedule:'Non-scheduled',
  mechanism:'Low-moderate affinity uncompetitive NMDA antagonist. Blocks pathological tonic glutamate while preserving phasic (learning) signaling. Neuroprotective against excitotoxicity.',
  indications:['Moderate-severe Alzheimer (FDA)','OCD augmentation (off-label)','Autism (off-label)','Gambling disorder (off-label)'],
  dosing:{
    adult:{start:'5mg daily',target:'10mg BID (IR) or 28mg daily (XR)',max:'20mg/day (IR); 28mg (XR)',titration:'Increase by 5mg/week.'},
    pediatric:{note:'Studied in autism 6-12 at 0.1-0.4mg/kg/day.'},
    elderly:{note:'Primary population studied.'},
    renal:'Severe (CrCl 5-29): max 5mg BID.', hepatic:'Mild-moderate: no adjustment.'
  },
  sideEffects:{
    common:['Dizziness (7%)','Headache (6%)','Constipation (5%)','Confusion (6%)'],
    serious:['Seizures (rare)','Psychosis (rare)','SJS (very rare)'],
    sexual:'Minimal.'
  },
  blackBox:'None.',
  contraindications:['Hypersensitivity to memantine or amantadine'],
  interactions:['NMDA antagonists (ketamine, amantadine, DXM)','Carbonic anhydrase inhibitors','Urine alkalinizers'],
  monitoring:['Cognitive function','Renal function','Behavioral symptoms'],
  onset:'2-4 weeks.',
  halfLife:'60-80 hours.',
  pregnancy:'Category B.',
  costRange:'Generic: $20-50/month.',
  sponsored:false
},

// ─── EXPOSURE AUGMENTATION ──────────────────────────────

'D-Cycloserine': {
  brand:['Seromycin\u00ae (TB)'], generic:'D-Cycloserine', class:'Partial NMDA Agonist (Glycine Site)', schedule:'Non-scheduled',
  mechanism:'Partial agonist at NMDA glycine site. At low doses, facilitates extinction learning during exposure therapy. Does NOT treat anxiety alone \u2014 augments exposure sessions only. NOT for daily use.',
  indications:['Tuberculosis (FDA)','Exposure therapy augmentation for anxiety (off-label, strong evidence)','Specific phobias','Social anxiety','OCD','PTSD (all off-label augmentation)'],
  dosing:{
    adult:{start:'50mg single dose 1hr before exposure',target:'50-250mg single dose pre-session',max:'500mg/session',titration:'Single dose pre-session only. Daily use may reverse benefit.'},
    pediatric:{note:'Studied at 50mg pre-session. Limited data.'},
    elderly:{note:'Standard dose likely appropriate.'},
    renal:'Accumulates \u2014 reduce dose.', hepatic:'No specific adjustment.'
  },
  sideEffects:{
    common:['Well-tolerated at single low doses','Headache','Dizziness','Drowsiness (occasional)'],
    serious:['At TB doses (250-1000mg daily): seizures, psychosis, neuropathy. NOT expected at augmentation doses.'],
    sexual:'None at augmentation doses.'
  },
  blackBox:'None at augmentation doses.',
  contraindications:['Epilepsy (at chronic high doses)','Severe renal impairment','Active psychosis'],
  interactions:['Isoniazid','Ethionamide','Alcohol (seizure threshold)'],
  monitoring:['Response to exposure sessions','Timing compliance (1hr pre-session)','Session-specific only'],
  onset:'1 hour. Effect during exposure session.',
  halfLife:'10 hours.',
  pregnancy:'Category C.',
  costRange:'$20-60/dose (specialty pharmacy).',
  sponsored:false
},

// --- SLEEP AIDS ---

'Trazodone': {
  brand:['Desyrel®','Oleptro® (ER)'], generic:'Trazodone HCl', class:'SARI', schedule:'Non-scheduled',
  mechanism:'5-HT2A/2C antagonist + weak SRI. Low doses: H1/alpha-1 blockade = sedation. Higher doses: antidepressant.',
  indications:['MDD (FDA)','Insomnia (off-label)','Anxiety (off-label)'],
  dosing:{
    adult:{start:'25-50mg HS (insomnia); 150mg/day (depression)',target:'25-100mg (insomnia); 300-600mg (depression)',max:'600mg/day',titration:'Increase 50mg every 3-4 days.'},
    pediatric:{note:'Not FDA-approved. Off-label insomnia.'},
    elderly:{start:'25mg',note:'Orthostatic hypotension. Fall risk.'},
    renal:'No adjustment.', hepatic:'Lower doses.'
  },
  sideEffects:{
    common:['Sedation','Dizziness','Dry mouth','Headache','Nausea','Morning grogginess','Orthostatic hypotension'],
    serious:['Priapism (1 in 6,000-8,000)','QTc prolongation','Serotonin syndrome (high doses)','Cardiac arrhythmia','Suicidal ideation'],
    sexual:'Priapism risk (rare but serious). Otherwise favorable.'
  },
  blackBox:'Suicidality in youth (class warning).',
  contraindications:['MAOIs','Recovery phase of MI','QTc prolongation'],
  interactions:['MAOIs','CYP3A4 inhibitors','CNS depressants','QTc-prolonging agents'],
  monitoring:['Sedation','Orthostatic BP','QTc if risk factors','Priapism education'],
  onset:'Sedation: 30-60 min. Antidepressant: 2-4 weeks.',
  halfLife:'5-9 hours.',
  pregnancy:'Category C.',
  costRange:'Generic: $4-10/month.',
  sponsored:false
},

'Suvorexant': {
  brand:['Belsomra®'], generic:'Suvorexant', class:'Dual Orexin Receptor Antagonist (DORA)', schedule:'Schedule IV',
  mechanism:'OX1R/OX2R antagonist. Blocks wake-promoting orexin signaling. Preserves sleep architecture. No respiratory depression.',
  indications:['Insomnia (FDA)'],
  dosing:{
    adult:{start:'10mg within 30 min of bedtime',target:'10-20mg',max:'20mg',titration:'Need 7+ hours before waking.'},
    pediatric:{note:'Not FDA-approved.'},
    elderly:{note:'No adjustment.'},
    renal:'No adjustment.', hepatic:'Severe: not recommended.'
  },
  sideEffects:{
    common:['Somnolence (7%)','Headache','Dizziness','Abnormal dreams'],
    serious:['Sleep paralysis','Hypnagogic hallucinations','Complex sleep behaviors','Cataplexy-like symptoms','Suicidal ideation'],
    sexual:'Minimal.'
  },
  blackBox:'None.',
  contraindications:['Narcolepsy','Severe hepatic impairment'],
  interactions:['CYP3A4 inhibitors','CNS depressants','Alcohol'],
  monitoring:['Daytime somnolence','Complex sleep behaviors','Depression'],
  onset:'30 minutes.',
  halfLife:'12 hours.',
  pregnancy:'Category C.',
  costRange:'Brand: $350-450/month.',
  sponsored:false
},

'Lorazepam': {
  brand:['Ativan®'], generic:'Lorazepam', class:'Benzodiazepine (Intermediate-acting)', schedule:'Schedule IV',
  mechanism:'GABA-A positive allosteric modulator. No active metabolites. Preferred in hepatic impairment/elderly.',
  indications:['Anxiety disorders (FDA)','Insomnia (FDA)','Status epilepticus (FDA, IV)','Alcohol withdrawal (off-label)','Catatonia (off-label)','Acute agitation (off-label)'],
  dosing:{
    adult:{start:'0.5-1mg BID-TID',target:'2-6mg/day',max:'10mg/day',titration:'Lowest dose, shortest duration.'},
    pediatric:{note:'0.05mg/kg/dose. Caution.'},
    elderly:{start:'0.25-0.5mg',note:'BEERS criteria. Falls. Paradoxical agitation.'},
    renal:'No adjustment.', hepatic:'Preferred benzo -- glucuronidation only.'
  },
  sideEffects:{
    common:['Sedation (15%)','Dizziness (7%)','Weakness','Cognitive impairment','Anterograde amnesia'],
    serious:['Respiratory depression (esp with opioids)','Paradoxical disinhibition','Dependence / withdrawal seizures','Rebound anxiety','Falls','Delirium'],
    sexual:'Decreased libido at higher doses.'
  },
  blackBox:'Combined use with opioids: profound sedation, respiratory depression, coma, death.',
  contraindications:['Acute narrow-angle glaucoma','Severe respiratory insufficiency','Sleep apnea'],
  interactions:['Opioids (BLACK BOX)','CNS depressants','Alcohol','Probenecid','Valproate'],
  monitoring:['Sedation','Respiratory rate','Dependence','Taper plan','CIWA (alcohol withdrawal)'],
  onset:'PO: 15-30 min. IV: 1-3 min.',
  halfLife:'10-20 hours.',
  pregnancy:'Category D.',
  costRange:'Generic: $4-15/month.',
  sponsored:false
},

'Nalmefene': {
  brand:['Selincro® (EU)'], generic:'Nalmefene HCl', class:'Opioid Antagonist', schedule:'Non-scheduled',
  mechanism:'Mu/delta antagonist, kappa partial agonist. Longer t1/2 than naltrexone. PRN before drinking (Sinclair Method).',
  indications:['Alcohol Use Disorder -- reduction (EMA-approved, not FDA-approved for AUD)'],
  dosing:{
    adult:{start:'18mg PRN 1-2hr before drinking',target:'18mg PRN',max:'18mg/day',titration:'As-needed. Not on abstinent days.'},
    pediatric:{note:'Not used.'},
    elderly:{note:'Standard dose.'},
    renal:'Severe: not recommended.', hepatic:'Severe: contraindicated.'
  },
  sideEffects:{
    common:['Nausea (18%)','Dizziness (12%)','Insomnia (9%)','Headache'],
    serious:['Precipitated withdrawal in opioid-dependent','Hepatotoxicity (rare)','Confusion','Hallucinations (rare)'],
    sexual:'Minimal.'
  },
  blackBox:'None.',
  contraindications:['Current opioid use','Opioid withdrawal','Severe hepatic/renal impairment'],
  interactions:['Opioid analgesics (blocked)','Opioid-containing medications'],
  monitoring:['Drinking diary','Opioid status','LFTs'],
  onset:'1-2 hours.',
  halfLife:'12.5 hours.',
  pregnancy:'Not recommended.',
  costRange:'EU: 50-80 EUR/month.',
  sponsored:false
},

'Drospirenone-EE': {
  brand:['Yaz®','Beyaz®','Yasmin®'], generic:'Drospirenone / Ethinyl Estradiol', class:'Combined Oral Contraceptive', schedule:'Non-scheduled',
  mechanism:'Spironolactone-derived progestin. Anti-androgenic + anti-mineralocorticoid. Stabilizes hormonal fluctuations. 24/4 regimen for PMDD.',
  indications:['Contraception (FDA)','PMDD (FDA -- Yaz)','Moderate acne (FDA)'],
  dosing:{
    adult:{start:'1 tablet daily',target:'3mg DRSP/0.02mg EE x 24 + 4 inert',max:'1 tab/day',titration:'Start day 1 of menses.'},
    pediatric:{note:'Post-menarche.'},
    elderly:{note:'Not post-menopause.'},
    renal:'Contraindicated (hyperkalemia).', hepatic:'Contraindicated.'
  },
  sideEffects:{
    common:['Headache','Nausea','Breast tenderness','Breakthrough bleeding','Mood changes'],
    serious:['VTE (3-4x baseline)','Arterial TE (MI, stroke)','Hyperkalemia','Hepatic adenoma','Hypertension'],
    sexual:'Variable.'
  },
  blackBox:'Smoking + age >35: do not use.',
  contraindications:['Smoking + >35','VTE/PE history','CV disease','Thrombophilia','Breast cancer','Hepatic/renal disease'],
  interactions:['K+-sparing diuretics, ACEi, ARBs (hyperkalemia)','CYP3A4 inducers','Lamotrigine (reduces its levels)'],
  monitoring:['Blood pressure','Potassium','VTE symptoms','Mood'],
  onset:'Contraception: 7 days. PMDD: 1-2 cycles.',
  halfLife:'DRSP: 30hr. EE: 24hr.',
  pregnancy:'Category X.',
  costRange:'Generic: $15-40/month.',
  sponsored:false
}


};

// ─── LOOKUP FUNCTION ───────────────────────────────────────
// Match intervention names to monographs (fuzzy matching)
function findMonograph(interventionName) {
  if (!interventionName) return null;
  var name = interventionName.toLowerCase();
  
  // Direct match
  var keys = Object.keys(DRUG_MONOGRAPHS);
  for (var i = 0; i < keys.length; i++) {
    if (name.indexOf(keys[i].toLowerCase()) !== -1) return DRUG_MONOGRAPHS[keys[i]];
    // Check brand names
    var m = DRUG_MONOGRAPHS[keys[i]];
    for (var b = 0; b < m.brand.length; b++) {
      if (name.indexOf(m.brand[b].replace('®','').toLowerCase()) !== -1) return DRUG_MONOGRAPHS[keys[i]];
    }
  }
  
  // Fuzzy matching for common patterns
  var fuzzyMap = {
    'ssri': null, // too generic
    'sertraline': 'Sertraline', 'zoloft': 'Sertraline',
    'fluoxetine': 'Fluoxetine', 'prozac': 'Fluoxetine',
    'escitalopram': 'Escitalopram', 'lexapro': 'Escitalopram',
    'paroxetine': 'Paroxetine', 'paxil': 'Paroxetine',
    'venlafaxine': 'Venlafaxine', 'effexor': 'Venlafaxine',
    'duloxetine': 'Duloxetine', 'cymbalta': 'Duloxetine',
    'bupropion': 'Bupropion', 'wellbutrin': 'Bupropion',
    'ketamine': 'Ketamine IV', 'esketamine': 'Esketamine', 'spravato': 'Esketamine',
    'psilocybin': 'Psilocybin', 'mdma': 'MDMA',
    'methylphenidate': 'Methylphenidate', 'ritalin': 'Methylphenidate', 'concerta': 'Methylphenidate',
    'amphetamine': 'Amphetamine', 'adderall': 'Amphetamine', 'vyvanse': 'Amphetamine', 'lisdexamfetamine': 'Amphetamine',
    'pregabalin': 'Pregabalin', 'lyrica': 'Pregabalin',
    'prazosin': 'Prazosin', 'minipress': 'Prazosin',
    'aripiprazole': 'Aripiprazole', 'abilify': 'Aripiprazole',
    'clozapine': 'Clozapine', 'clozaril': 'Clozapine',
    'lithium': 'Lithium',
    'guanfacine': 'Guanfacine', 'intuniv': 'Guanfacine',
    'naltrexone': 'Naltrexone', 'vivitrol': 'Naltrexone', 'revia': 'Naltrexone',
    'buspirone': 'Buspirone', 'buspar': 'Buspirone',
    'hydroxyzine': 'Hydroxyzine', 'atarax': 'Hydroxyzine', 'vistaril': 'Hydroxyzine',
    'gabapentin': 'Gabapentin', 'neurontin': 'Gabapentin', 'gralise': 'Gabapentin', 'horizant': 'Gabapentin',
    'topiramate': 'Topiramate', 'topamax': 'Topiramate',
    'lamotrigine': 'Lamotrigine', 'lamictal': 'Lamotrigine',
    'valproate': 'Valproate', 'valproic': 'Valproate', 'depakote': 'Valproate', 'divalproex': 'Valproate',
    'quetiapine': 'Quetiapine', 'seroquel': 'Quetiapine',
    'olanzapine': 'Olanzapine', 'zyprexa': 'Olanzapine',
    'risperidone': 'Risperidone', 'risperdal': 'Risperidone',
    'propranolol': 'Propranolol', 'inderal': 'Propranolol',
    'atomoxetine': 'Atomoxetine', 'strattera': 'Atomoxetine',
    'clomipramine': 'Clomipramine', 'anafranil': 'Clomipramine',
    'varenicline': 'Varenicline', 'chantix': 'Varenicline',
    'disulfiram': 'Disulfiram', 'antabuse': 'Disulfiram',
    'buprenorphine': 'Buprenorphine', 'suboxone': 'Buprenorphine', 'subutex': 'Buprenorphine', 'sublocade': 'Buprenorphine',
    'melatonin': 'Melatonin',
    'nac': 'N-Acetylcysteine', 'n-acetylcysteine': 'N-Acetylcysteine', 'acetylcysteine': 'N-Acetylcysteine',
    'memantine': 'Memantine', 'namenda': 'Memantine',
    'cycloserine': 'D-Cycloserine', 'd-cycloserine': 'D-Cycloserine',
    'trazodone': 'Trazodone', 'desyrel': 'Trazodone',
    'suvorexant': 'Suvorexant', 'belsomra': 'Suvorexant', 'lemborexant': 'Suvorexant', 'dora': 'Suvorexant',
    'lorazepam': 'Lorazepam', 'ativan': 'Lorazepam', 'benzodiazepine': 'Lorazepam',
    'nalmefene': 'Nalmefene', 'selincro': 'Nalmefene',
    'drospirenone': 'Drospirenone-EE', 'yaz': 'Drospirenone-EE', 'oral contraceptive': 'Drospirenone-EE', 'yasmin': 'Drospirenone-EE'
  };
  
  var fkeys = Object.keys(fuzzyMap);
  for (var f = 0; f < fkeys.length; f++) {
    if (name.indexOf(fkeys[f]) !== -1 && fuzzyMap[fkeys[f]]) {
      return DRUG_MONOGRAPHS[fuzzyMap[fkeys[f]]];
    }
  }
  
  return null;
}

if (typeof module !== 'undefined') module.exports = { DRUG_MONOGRAPHS: DRUG_MONOGRAPHS, findMonograph: findMonograph };
