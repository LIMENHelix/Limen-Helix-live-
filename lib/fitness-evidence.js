/**
 * lib/fitness-evidence.js — peer-reviewed citations per phase, verified against
 * PubMed (real PMIDs + DOIs). SHARED source of truth:
 *   - handlers/fitness-program.js  (admin, merges into the full programming)
 *   - handlers/fitness-evidence.js (PUBLIC, citations only — known science is free)
 *
 * Source: PubMed. Attribution + DOI links are required wherever these are shown.
 * Findings are paraphrased one-liners; the PMID/DOI points to the original study.
 */
const EVIDENCE = {
  P0: [
    { ref: 'Plews et al. 2013, Sports Med', pmid: '23852425', doi: '10.1007/s40279-013-0071-8', find: 'Vagally-derived HRV tracks training status: rises reflect adaptation, falls reflect fatigue — supporting HRV as a day-to-day readiness monitor.' },
    { ref: 'Bellenger et al. 2016, Sports Med', pmid: '26888648', doi: '10.1007/s40279-016-0484-2', find: 'Meta-analysis (24 studies): positive adaptation raises resting vagal HRV; interpret alongside other markers.' },
    { ref: 'Bonazza et al. 2016, Am J Sports Med', pmid: '27159297', doi: '10.1177/0363546516641937', find: 'FMS is highly reliable (ICC 0.81); a composite score ≤14 was linked to ~2.7x higher injury odds.' },
    { ref: 'Whittaker et al. 2017, Br J Sports Med', pmid: '27935483', doi: '10.1136/bjsports-2016-096760', find: 'Systematic review: evidence that poor movement-screen quality predicts injury is inconsistent.' },
    { ref: 'Mann et al. 2013, Sports Med', pmid: '23620244', doi: '10.1007/s40279-013-0045-x', find: 'Prescribing intensity to metabolic thresholds (vs %VO2max) gives a more uniform internal stimulus — baseline testing individualizes load.' },
  ],
  P1: [
    { ref: 'Hayes et al. 2010, Chronobiol Int', pmid: '20560706', doi: '10.3109/07420521003778773', find: 'Strength and power typically peak in the late afternoon, tracking higher body/muscle temperature.' },
    { ref: 'Racinais et al. 2007, J Sci Med Sport', pmid: '18078788', doi: '10.1016/j.jsams.2007.09.008', find: 'A genuine morning-to-afternoon rise in cycling peak power, driven mainly by muscle temperature.' },
    { ref: 'Chtourou et al. 2012, J Strength Cond Res', pmid: '21993020', doi: '10.1519/JSC.0b013e31821d5e8d', find: 'Evening strength/power ~3-18% higher; training at a fixed time of day blunts the difference (entrainment).' },
    { ref: 'Yasuo et al. 2017, J Nutr', pmid: '29070712', doi: '10.3945/jn.117.255380', find: 'Morning bright light phase-advanced the dim-light melatonin onset — confirming morning light as an entraining signal.' },
    { ref: 'Gibbs et al. 2013, Clin Nutr', pmid: '24135087', doi: '10.1016/j.clnu.2013.09.018', find: 'Identical meals raised glucose more in the evening than morning — insulin sensitivity falls across the day.' },
    { ref: 'Peek et al. 2016, Cell Metab', pmid: '27773696', doi: '10.1016/j.cmet.2016.09.010', find: 'Muscle BMAL1 regulates glycolytic/mitochondrial metabolism; exercise clock-gene induction is time-of-day dependent.' },
  ],
  P2: [
    { ref: 'Bartlett et al. 2014, Eur J Sport Sci', pmid: '24942068', doi: '10.1080/17461391.2014.920926', find: 'Training with low carbohydrate availability amplifies AMPK/p38-MAPK/PGC-1a and fat-oxidation adaptations (train-low, compete-high).' },
    { ref: 'Impey et al. 2018, Sports Med', pmid: '29453741', doi: '10.1007/s40279-018-0867-7', find: 'Across studies, train-low augmented cell signaling (73%), gene expression (75%), and oxidative-enzyme adaptation (78%).' },
    { ref: 'Areta et al. 2013, J Physiol', pmid: '23459753', doi: '10.1113/jphysiol.2012.244897', find: '20 g protein every 3 h stimulated MPS more than 10 g/1.5 h or 40 g/6 h — distribution matters.' },
    { ref: 'Moore et al. 2014, J Gerontol A', pmid: '25056502', doi: '10.1093/gerona/glu103', find: 'Per-meal MPS plateaus ~0.24 g/kg (young) to ~0.40 g/kg (older) — a relative per-meal protein threshold.' },
    { ref: 'Trommelen & van Loon 2016, Nutrients', pmid: '27916799', doi: '10.3390/nu8120763', find: '≥40 g protein pre-sleep is digested overnight and raises overnight muscle protein synthesis.' },
  ],
  P3: [
    { ref: 'Vachon et al. 2020, Eur J Sport Sci', pmid: '32172680', doi: '10.1080/17461391.2020.1736183', find: 'Meta-analysis: tapering moderately improved power, VO2max, repeated-sprint, and change-of-direction.' },
    { ref: 'Wang et al. 2023, PLoS One', pmid: '37163550', doi: '10.1371/journal.pone.0282838', find: 'Meta-analysis: a ≤21-day taper cutting volume ~41-60% (intensity held) improved endurance performance.' },
    { ref: 'He et al. 2012, Nature', pmid: '22258505', doi: '10.1038/nature10758', find: 'Acute exercise induces autophagy in muscle; this stimulus-induced autophagy is required for exercise metabolic benefits (mice).' },
    { ref: 'Mah et al. 2011, Sleep', pmid: '21731144', doi: '10.5665/SLEEP.1132', find: 'Sleep extension (~111 min/night) improved sprint, shooting accuracy, reaction time, and mood in athletes.' },
    { ref: 'Burke et al. 2016, J Appl Physiol', pmid: '27789774', doi: '10.1152/japplphysiol.00860.2016', find: 'Glycogen depletion is a strong drive for its own resynthesis; carbohydrate optimizes supercompensation.' },
    { ref: 'Vesterinen et al. 2016, Med Sci Sports Exerc', pmid: '26909534', doi: '10.1249/MSS.0000000000000910', find: 'HRV-guided runners improved 3000-m with fewer hard sessions than a predefined plan.' },
  ],
  P4: [
    { ref: 'Schoenfeld et al. 2016, J Sports Sci', pmid: '27433992', doi: '10.1080/02640414.2016.1210197', find: 'Meta-analysis: graded volume dose-response — each weekly set ~+0.37% growth; 10+ sets/muscle/week favored.' },
    { ref: 'Schoenfeld et al. 2019, Med Sci Sports Exerc', pmid: '30153194', doi: '10.1249/MSS.0000000000001764', find: 'RCT (trained men), 1 vs 3 vs 5 sets: hypertrophy followed a dose-response favoring higher volume.' },
    { ref: 'Wackerhage et al. 2019, J Appl Physiol', pmid: '30335577', doi: '10.1152/japplphysiol.00685.2018', find: 'Mechanical signals are the prime hypertrophy stimuli, transduced via mTORC1 to raise muscle protein synthesis.' },
    { ref: 'Robinson et al. 2024, Sports Med', pmid: '38970765', doi: '10.1007/s40279-024-02069-2', find: 'Meta-regression: hypertrophy increased as sets ended closer to failure (lower RIR).' },
    { ref: 'Petrella et al. 2008, J Appl Physiol', pmid: '18436694', doi: '10.1152/japplphysiol.01215.2007', find: 'Robust hypertrophy was associated with satellite-cell activation and myonuclear addition.' },
    { ref: 'Phillips et al. 1997, Am J Physiol', pmid: '9252485', doi: '10.1152/ajpendo.1997.273.1.E99', find: 'Muscle protein synthesis was elevated +112% (3h), +65% (24h), +34% (48h) after a resistance bout.' },
  ],
  P5: [
    { ref: 'Pilegaard et al. 2003, J Physiol', pmid: '12563009', doi: '10.1113/jphysiol.2002.034850', find: 'A single exercise bout transiently raised PGC-1a transcription 10- to >40-fold in human muscle.' },
    { ref: 'Booth et al. 2015, Prog Mol Biol Transl Sci', pmid: '26477913', doi: '10.1016/bs.pmbts.2015.07.016', find: 'PGC-1a is a central regulator of endurance-induced mitochondrial biogenesis.' },
    { ref: 'Seiler & Kjerland 2006, Scand J Med Sci Sports', pmid: '16430681', doi: '10.1111/j.1600-0838.2004.00418.x', find: 'Elite endurance athletes train ~75% easy / 15-20% hard, little at threshold (polarized).' },
    { ref: 'Munoz et al. 2014, Int J Sports Physiol Perform', pmid: '23752040', doi: '10.1123/ijspp.2012-0350', find: 'Polarized (~77/3/20) beat between-thresholds training for 10-km improvement in adherent runners.' },
    { ref: 'Brooks 2018, Cell Metab', pmid: '29617642', doi: '10.1016/j.cmet.2018.03.008', find: 'Lactate shuttle: lactate is a major energy source, gluconeogenic precursor, and signaling molecule.' },
    { ref: 'Achten et al. 2002, Med Sci Sports Exerc', pmid: '11782653', doi: '10.1097/00005768-200201000-00015', find: 'Maximal fat oxidation (Fatmax) at ~64% VO2max, zone ~55-72%.' },
  ],
  P6: [
    { ref: 'Moesgaard et al. 2022, Sports Med', pmid: '35044672', doi: '10.1007/s40279-021-01636-1', find: 'Meta-analysis (volume-equated): periodized RT beat non-periodized for 1RM; undulating > linear in trained lifters.' },
    { ref: 'Ronnestad et al. 2012, Scand J Med Sci Sports', pmid: '22646668', doi: '10.1111/j.1600-0838.2012.01485.x', find: 'Block periodization gave superior VO2max/power vs traditional organization at equal volume in trained cyclists.' },
    { ref: 'Wilson et al. 2012, J Strength Cond Res', pmid: '22002517', doi: '10.1519/JSC.0b013e31823a3e2d', find: 'Meta-analysis: added endurance reduced hypertrophy/strength/power; interference scaled with endurance dose, worst with running.' },
    { ref: 'Hickson 1980, Eur J Appl Physiol', pmid: '7193134', doi: '10.1007/BF00421333', find: 'The original interference study: concurrent training plateaued/declined strength development at weeks 8-10.' },
    { ref: 'Nader 2006, Med Sci Sports Exerc', pmid: '17095931', doi: '10.1249/01.mss.0000233795.39282.33', find: 'Proposed mechanism: endurance-induced AMPK inhibits mTOR signaling, blunting the hypertrophic response.' },
    { ref: 'Gabbett 2016, Br J Sports Med', pmid: '26758673', doi: '10.1136/bjsports-2015-095788', find: 'Acute:chronic workload spikes drive injury; well-developed chronic loads are protective.' },
  ],
  P7: [
    { ref: 'Longland et al. 2016, Am J Clin Nutr', pmid: '26817506', doi: '10.3945/ajcn.115.119339', find: 'In a ~40% deficit + training, 2.4 g/kg protein gained lean mass and lost more fat than 1.2 g/kg.' },
    { ref: 'Phillips 2014, Sports Med', pmid: '25355188', doi: '10.1007/s40279-014-0254-y', find: 'Higher protein during energy deficit preserves lean mass and favors fat loss in athletes.' },
    { ref: 'Lahav et al. 2026, Front Endocrinol', pmid: '41625248', doi: '10.3389/fendo.2025.1725500', find: 'Cohort (304): resistance training was the only modality that preserved/increased fat-free mass during a deficit.' },
    { ref: 'Byrne et al. 2018 (MATADOR), Int J Obes', pmid: '28925405', doi: '10.1038/ijo.2017.206', find: 'Intermittent 2-week-block restriction produced more fat loss and blunted the drop in resting energy expenditure vs continuous.' },
    { ref: 'Most & Redman 2020, Exp Gerontol', pmid: '32057825', doi: '10.1016/j.exger.2020.110875', find: 'Adaptive thermogenesis: restriction lowers energy expenditure beyond lost mass, via falling leptin and thyroid.' },
  ],
  P7b: [
    { ref: 'Meeusen et al. 2013 (ECSS/ACSM), Med Sci Sports Exerc', pmid: '23247672', doi: '10.1249/MSS.0b013e318279a10a', find: 'Consensus: functional overreaching (dip then supercompensation) vs non-functional vs overtraining syndrome (prolonged maladaptation).' },
    { ref: 'Halson 2014, Sports Med', pmid: '25200666', doi: '10.1007/s40279-014-0253-z', find: 'Monitoring tools (HR, HR recovery, neuromuscular, questionnaires) detect fatigue; no single marker is definitive.' },
    { ref: 'Manresa-Rocamora et al. 2021, Scand J Med Sci Sports', pmid: '33533045', doi: '10.1111/sms.13932', find: 'Meta-analysis: HR-based indices detect parasympathetic hyperactivity in functionally overreached athletes.' },
    { ref: 'Dupuy et al. 2013, Appl Physiol Nutr Metab', pmid: '23438233', doi: '10.1139/apnm-2012-0203', find: 'Overreached athletes showed reduced cardiac parasympathetic control in slow-wave sleep, reversing after taper.' },
    { ref: 'Morgan et al. 1987, Br J Sports Med', pmid: '3676635', doi: '10.1136/bjsm.21.3.107', find: 'Mood (POMS) disturbance rose dose-dependently with training load and normalized on unload.' },
  ],
  P8: [
    { ref: 'Manresa-Rocamora et al. 2021, Int J Environ Res Public Health', pmid: '34639599', doi: '10.3390/ijerph181910299', find: 'Meta-analysis: HRV-guided training beat predefined for vagal HRV, with a small non-significant edge for fitness/performance.' },
    { ref: 'Duking et al. 2021, J Sci Med Sport', pmid: '34489178', doi: '10.1016/j.jsams.2021.04.012', find: 'Review: adapting endurance training on wearable HRV tends to improve performance vs predefined programs.' },
    { ref: 'Pareja-Blanco et al. 2020, Med Sci Sports Exerc', pmid: '32049887', doi: '10.1249/MSS.0000000000002295', find: 'Velocity loss within a set is a critical variable; lower velocity-loss yields strength gains with less fatigue and volume.' },
    { ref: 'Jukic et al. 2022, Sports Med', pmid: '36178597', doi: '10.1007/s40279-022-01754-4', find: 'Meta-analysis: lower velocity-loss thresholds reduce fatigue while preserving strength adaptations.' },
    { ref: 'Petro et al. 2024, Sports Health', pmid: '38910451', doi: '10.1177/19417381241260412', find: 'Systematic review: RPE tracks velocity and intensity in resistance exercise — valid for gauging effort.' },
    { ref: 'Zhang et al. 2021, Front Physiol', pmid: '33776802', doi: '10.3389/fphys.2021.651112', find: 'Meta-analysis: autoregulated loading produced superior maximal-strength gains vs fixed loading.' },
  ],
  P9: [
    { ref: 'Bosquet et al. 2007, Med Sci Sports Exerc', pmid: '17762369', doi: '10.1249/mss.0b013e31806010e0', find: 'Meta-analysis: a ~2-week taper exponentially cutting volume 41-60% (intensity/frequency held) maximizes performance.' },
    { ref: 'Xu et al. 2025, Sports Med', pmid: '39853660', doi: '10.1007/s40279-024-02170-6', find: 'Meta-analysis: conditioning activities give a small PAPE effect, moderated by recovery time (inverted-U) and modality.' },
    { ref: 'Hawley et al. 1997, Sports Med', pmid: '9291549', doi: '10.2165/00007256-199724020-00001', find: 'Glycogen supercompensation delays fatigue ~20% and improves performance ~2-3% in events >90 min (not <90 min).' },
    { ref: 'Jensen et al. 2020, J Physiol', pmid: '32686845', doi: '10.1113/JP280247', find: 'High-carbohydrate loading roughly doubled cycling time-to-exhaustion vs a low-carb diet.' },
    { ref: 'Morton et al. 1990, J Appl Physiol', pmid: '2246166', doi: '10.1152/jappl.1990.69.3.1171', find: 'The impulse-response model: a training impulse yields decaying fitness and fatigue responses that predict performance and peak timing.' },
  ],
  P10: [
    { ref: 'Goodpaster & Sparks 2017, Cell Metab', pmid: '28467922', doi: '10.1016/j.cmet.2017.04.015', find: 'Defines metabolic flexibility (switching fuel to demand); obesity and type 2 diabetes are metabolically inflexible.' },
    { ref: 'Meex et al. 2010, Diabetes', pmid: '20028948', doi: '10.2337/db09-1322', find: '12 weeks of combined training restored mitochondrial function and metabolic flexibility and improved insulin sensitivity.' },
    { ref: 'Muller et al. 2016, Curr Obes Rep', pmid: '27739007', doi: '10.1007/s13679-016-0237-4', find: 'Adaptive thermogenesis lowers energy expenditure beyond fat-free-mass loss after weight loss, defending body weight.' },
    { ref: 'Byrne et al. 2017 (MATADOR), Int J Obes', pmid: '28925405', doi: '10.1038/ijo.2017.206', find: 'Interrupting restriction with energy-balance rest blocks reduced adaptive thermogenesis and improved weight-loss efficiency.' },
    { ref: 'Spiering et al. 2021, J Strength Cond Res', pmid: '33629972', doi: '10.1519/JSC.0000000000003964', find: 'Strength/size maintained up to ~32 weeks on ~1 session/week and 1 set/exercise if intensity is held (minimal dose).' },
  ],
};

// Honesty caveats where the literature is mixed or extrapolated — shown with the evidence.
const EVNOTES = {
  P0: 'The FMS is reliable but its injury-PREDICTION validity is contested (specific, insensitive; Dorrel 2015). Treat movement screening as a mobility/quality read, not a validated injury predictor.',
  P2: 'The 0.4 g/kg-per-meal target is the older-adult figure; young men plateau nearer 0.24 g/kg. Treat 0.4 as a practical upper target, not a universal threshold.',
  P4: 'The failure-proximity dose-response is established for HYPERTROPHY, not strength (which is similar across a wide RIR range).',
  P5: 'PGC-1a is a CENTRAL, not strictly required, trigger: muscle-specific knockouts retain exercise-induced mitochondrial biogenesis (redundancy; Rowe 2012).',
  P10: 'Metabolic-flexibility evidence is largely from insulin-resistant/diabetic populations, not trained athletes — read it as mechanistic support, not athlete-proven.',
};

module.exports = { EVIDENCE, EVNOTES };
