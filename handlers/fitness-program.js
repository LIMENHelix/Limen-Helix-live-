/**
 * handlers/fitness-program.js — ADMIN-ONLY phase programming for /fitness.
 *
 * GET /api/fitness-program   (auth: x-limen-pass header or ?key=, master=ADMIN_MASTER)
 *   → { ok:true, programs:{ P0:{...}, ... } }
 *
 * Each phase is written as its own exercise-science / exercise-biochemistry
 * chapter: molecular signaling, bioenergetics, endocrine + neural control, the
 * adaptation, the programming prescription, nutrition biochemistry, recovery,
 * and exit criteria. The full text lives ONLY in this server bundle — never in
 * public page source. 403 on a bad/missing passcode.
 *
 * General fitness education, not medical advice; assumes a screened, healthy
 * trainee. Grounded in Issurin, Schoenfeld, Seiler, Volek, Panda, McEwen,
 * Craig/Porges, Brooks (lactate shuttle), Selye (GAS), Banister (fitness-fatigue).
 */
const { reqKey, isMaster, hasDomain, deny } = require('../lib/admin-gate');

const PROGRAMS = {
  P0: {
    name: 'P0 · Null Symmetry — Needs Analysis', stage: 'Assessment', meta: 'One-week diagnostic · repeat quarterly',
    thesis: 'You cannot program a system you have not measured. P0 fixes the athlete’s position on the arc at three nested scales (rep, session, macrocycle) and the constraints that bound loading.',
    chapters: [
      { h: 'Why assessment precedes load', body: 'Every downstream prescription is only as valid as its baseline. The pre-recursive state is a full read, not a workout: it maps the athlete against the arc and surfaces the limiter (mobility, an energy system, recovery capacity, or lifestyle) that will govern the first mesocycle.' },
      { h: 'Structural & movement screen', body: 'Joint-by-joint mobility/stability (the Boyle/Cook model) plus motor control. A pain response is a stop-and-refer, not a training variable.', items: [
        'Overhead squat, single-leg RDL, active straight-leg raise, trunk-stability push-up, shoulder mobility, weight-bearing ankle dorsiflexion, thoracic rotation. Score pass / limited / painful.'] },
      { h: 'Bioenergetic profile', body: 'The three energy systems supply ATP on different timescales: phosphagen (ATP–PCr, seconds), glycolytic (~10–90 s), and oxidative (minutes–hours). Test each to find which one caps the athlete.', items: [
        'Phosphagen/power: a clean 3–5RM or a jump / med-ball throw.',
        'Glycolytic: a repeat-effort test.',
        'Oxidative: submax aerobic test (Cooper 12-min or HR-clamped step) → VO2 proxy and Zone-2 pace at the first lactate turnpoint / nasal-breathing threshold.'] },
      { h: 'Autonomic & recovery baseline', body: 'A 7-day morning resting HR + HRV (RMSSD) baseline is the single most important number captured here: every later phase reads readiness against it. Add chronotype (MEQ), a 2-week sleep log (duration + latency), and perceived stress as an allostatic-load proxy.' },
      { h: 'Body composition & interoception', body: 'Anthropometry (bodyweight, waist:height, girths; optional DEXA/BIA), training age, and a 3-day nutrition log for habitual substrate intake. Finally an interoceptive baseline (Craig/Porges): the accuracy of internal sensing — hunger/satiety, effort, readiness — which is the raw material for the P8 autoregulation layer.' },
    ],
    exit: 'Screen clean + baselines captured → a written phase assignment, red flags, and the first mesocycle. Drop into the assigned phase.',
  },

  P1: {
    name: 'P1 · Collapse — Chronoload', stage: 'Chronobiology', meta: '4 weeks · 4 days · timing is the variable',
    thesis: 'Adaptation is time-of-day dependent. The overnight anabolic state breaks down at waking; P1 aligns the training stimulus with the circadian windows where the cell is primed to respond.',
    chapters: [
      { h: 'The molecular clock', body: 'A central clock in the suprachiasmatic nucleus, entrained by light through the retinohypothalamic tract, synchronizes peripheral clocks in muscle, liver, and adipose. Each runs a ~24 h transcription–translation feedback loop: the BMAL1/CLOCK heterodimer drives PER/CRY, which feed back to inhibit it. Exercise and feeding are themselves peripheral zeitgebers that shift these clocks.' },
      { h: 'Diurnal endocrine architecture', body: 'The cortisol awakening response peaks ~30–45 min after waking then declines across the day — the catabolic mobilization that ends the overnight fed/repair state. Testosterone is highest in the morning; core body temperature and peak neuromuscular power arrive late afternoon (~16:00–18:00); melatonin rises after dusk.' },
      { h: 'The insulin-sensitivity rhythm', body: 'Peripheral clocks gate GLUT4 and muscle glucose uptake, so insulin sensitivity and glucose tolerance are higher in the morning and fall across the day. Carbohydrate is better partitioned earlier; this is why fuel placement (P2) rides on top of clock alignment.' },
      { h: 'Programming', body: 'Place the primary neuromuscular session at the afternoon core-temperature / power peak for most chronotypes (shift earlier for strong morning types). Skill and easy aerobic go in the AM; nothing glycolytic inside the 3 h before sleep.', items: [
        'Wake protocol: fixed wake time; 10–20 min outdoor light within 30 min of waking (SCN entrainment); delay caffeine 60–90 min so adenosine clears.',
        'Sample microcycle: Mon PM strength · Tue AM Zone-2 · Wed mobility · Thu PM strength · Fri PM power/skill · Sat AM long Zone-2 · Sun off.',
        'Evening: dim light after sunset, screens off 60 min pre-bed, last meal ≥3 h before sleep, cool dark room.'] },
      { h: 'Monitoring', body: 'Standardize the session time so the body learns the window. Track the AM HRV trend and sleep latency (<20 min = entrained). If HRV trends down, move the session later or trim a set rather than fight the clock.' },
    ],
    exit: 'Clock entrained: consistent wake, latency <20 min, stable AM HRV → P2 fueling.',
  },

  P2: {
    name: 'P2 · Bonding — Periodized Fueling', stage: 'Nutrient timing', meta: '4 weeks · fuel follows the work',
    thesis: 'Carbohydrate availability is a signal, not just a fuel. Substrate couples to signal here — P2 manipulates availability to direct the adaptation.',
    chapters: [
      { h: 'Insulin signaling & glucose disposal', body: 'Insulin activates PI3K/Akt → AS160 → GLUT4 translocation to the sarcolemma → glucose uptake and glycogen synthase activity. Contraction opens a second, insulin-independent GLUT4 route via AMPK, so the post-exercise window disposes of carbohydrate with little insulin — the biochemistry behind peri-workout carb placement.' },
      { h: 'The train-low paradigm', body: 'Training with low muscle glycogen amplifies AMPK and p38-MAPK signaling to PGC-1α, upregulating mitochondrial and fat-oxidation genes (CPT1, β-HAD). “Train-low, compete-high” periodizes that signal on easy days without chronically degrading the glycogen needed for high-intensity quality (Volek/Burke).' },
      { h: 'Protein & the leucine trigger', body: 'Muscle protein synthesis is maximized by ~0.4 g/kg high-quality protein per meal — enough leucine (~2.5–3 g) to cross the mTORC1 threshold — across 4–5 feedings. The ‘muscle-full’ effect caps per-meal dosing, so distribution beats a single bolus; ~40 g slow protein pre-sleep sustains overnight MPS.' },
      { h: 'Fat & the Randle cycle', body: 'Dietary fat fills the remainder and is weighted onto low-carb days, supporting the glucose–fatty-acid (Randle) shift toward fat oxidation on easy sessions and keeping metabolic flexibility intact.' },
      { h: 'Programming the intake', items: [
        'Hard / glycolytic days: 5–7 g/kg carbohydrate clustered around the session (train-high).',
        'Easy / Zone-2 days: train-low or fasted (<2 g/kg) to bias fat-ox.',
        'Protein 1.6–2.2 g/kg/day split 0.4 g/kg × 4–5; peri-workout on hard days: 30–60 g carb + 20–40 g protein pre, 0.8–1.2 g/kg carb + 30–40 g protein post.',
        'Overnight fast 12–14 h on easy days; total weekly energy stays at the block target — only the daily carb placement moves.'] },
    ],
    exit: 'Energy and session quality hold on periodized intake → P3 recovery.',
  },

  P3: {
    name: 'P3 · Fracture — Supercompensation', stage: 'Recovery', meta: '1-week deload · gated by HRV, not the calendar',
    thesis: 'Fitness is expressed during recovery, not during work. Autophagy dismantles what is worn out; P3 engineers the rebound onto a higher baseline.',
    chapters: [
      { h: 'The fitness-fatigue model', body: 'Training raises both fitness and fatigue; performance is their difference (Banister). Because fatigue decays faster than fitness, a planned unload lets the net rise above baseline — the supercompensation window. Selye’s General Adaptation Syndrome frames the same arc: alarm → resistance → (if load never relents) exhaustion.' },
      { h: 'Autophagy & proteostasis', body: 'Lower mTOR plus energy stress activate AMPK → ULK1 and the FOXO axis → autophagy: LC3-I converts to LC3-II, p62 is cleared, damaged mitochondria are removed by mitophagy, and misfolded protein is recycled. A short fast on the lowest-load day lowers mTOR to let autophagy run, while a retained (light) resistance stimulus protects net protein balance.' },
      { h: 'Glycogen supercompensation', body: 'Depletion followed by reload super-compensates muscle glycogen above baseline: the depleted window upregulates glycogen synthase, so the muscle stores more than it started with.' },
      { h: 'Sleep biochemistry & clearance', body: 'Slow-wave sleep drives the nocturnal growth-hormone pulse and anabolic repair, so an earlier bedtime that protects early-night SWS is worth more than sleeping in. REM (late night) consolidates learning and is suppressed by alcohol. Glymphatic clearance of metabolic waste (AQP4-mediated CSF flux) is sleep- and posture-dependent — side-sleeping, hydrated, no late alcohol.' },
      { h: 'Programming the deload', body: 'A one-week microcycle: cut working sets ~40–50%, hold load near 90% of block top to preserve neural drive, RIR 3–4, nothing to failure. One 16–18 h low-protein fast on the lowest-load day.' },
      { h: 'The HRV-timed return', body: 'Resume loading only when morning HRV (RMSSD) returns to or above baseline for two consecutive days. That parasympathetic reactivation — not the date on the calendar — is the green light.' },
    ],
    exit: 'HRV rebounded, soreness cleared, drive back → re-enter accumulation (P4) or intensification (P7).',
  },

  P4: {
    name: 'P4 · Nested Integration — Accumulation', stage: 'Hypertrophy', meta: '4 weeks · 4 days · upper/lower · RIR-autoregulated',
    thesis: 'Hypertrophy is a mechanotransduction problem solved with accumulated tension. P4 ramps the signal from minimum effective volume to maximum adaptive volume.',
    chapters: [
      { h: 'Mechanotransduction', body: 'Mechanical tension is sensed at costameres and focal adhesions (the integrin–FAK complex), by titin strain, and via phosphatidic-acid signaling, converging on mTORC1 independently of and additively to growth factors. Tension is the primary driver (Schoenfeld ranks it tension > metabolic stress > muscle damage); the ‘pump’ is a secondary signal, not the mechanism.' },
      { h: 'The mTORC1 anabolic node', body: 'mTORC1 phosphorylates p70S6K1 and releases 4E-BP1 from eIF4E, initiating translation and elevating muscle protein synthesis for 24–48 h after a session. Repeated training adds ribosome biogenesis — more translational machinery — which is the longer-term ceiling on how much a muscle can grow.' },
      { h: 'Satellite cells & the myonuclear domain', body: 'High tension and micro-damage activate satellite cells (Pax7+), which proliferate and fuse to donate new myonuclei. This expands transcriptional capacity so hypertrophy can be sustained rather than plateauing at a fixed myonuclear domain.' },
      { h: 'Metabolic stress & motor-unit recruitment', body: 'Glycolytic work accumulates lactate/H+, cell swelling, and metabolite build-up — a secondary hypertrophic stimulus — and drives high-threshold motor-unit recruitment as fatigue rises (the size principle). Sets taken near failure (low RIR) ensure the largest, most growth-prone fibers are recruited.' },
      { h: 'Programming (MEV → MAV)', body: '4-week block, upper/lower, 4 days. Ramp volume from your minimum effective volume in week 1 toward maximum adaptive volume by week 3, then deload.', items: [
        'Lower A (quad): Back squat 4×6-8 tempo 3-0-1 RIR2 · Leg press 3×10-12 · RDL 3×8-10 · Walking lunge 2×12 · Leg curl 3×12-15 · Calf 4×12.',
        'Upper A (push): Bench 4×6-8 RIR2 · Incline DB 3×10 · Seated OHP 3×8-10 · Lateral raise 3×15 · Dips 3×10 · Triceps 3×12-15.',
        'Lower B (hinge): Deadlift 3×5 RIR2 · Front squat 3×8 · Hip thrust 3×10 · Bulgarian split 3×10 · Leg ext 3×15 · Calf 4×15.',
        'Upper B (pull): Weighted pull-up 4×6-8 · Barbell row 4×10 · Chest-supported row 3×12 · Face pull 3×20 · EZ curl 3×10 · Hammer 3×12.',
        'Progression: wk1 ~12 sets/muscle → +1-2 sets/muscle/wk → ~18-20 by wk3; 6–20 reps, RIR 0–3, 2–4 s eccentric for time-under-tension; wk4 deload.'] },
      { h: 'Nutrition & recovery', body: 'Energy surplus +5–10%; protein 1.6–2.2 g/kg (0.4 g/kg × 4–5); carbohydrate around sessions for training quality and glycogen-driven cell volume. Because MPS stays elevated 24–48 h, train a muscle every 48–72 h; 7–9 h sleep.' },
    ],
    exit: 'Gains plateau or volume tolerance maxes out → deload (P3), then intensify (P7) or build the engine (P5).',
  },

  P5: {
    name: 'P5 · Recursive Stability — Aerobic Base', stage: 'Metabolic conditioning', meta: '4-6 weeks · ~80/20 low/high',
    thesis: 'Endurance is mitochondrial. P5 maximizes oxidative machinery through mostly-easy, polarized volume — slower, deeper, harder to break.',
    chapters: [
      { h: 'Mitochondrial biogenesis', body: 'PGC-1α is the master coactivator of mitochondrial biogenesis. It is switched on by AMPK (rising AMP:ATP), CaMKII (calcium transients from repeated contraction), and p38 MAPK, then coactivates NRF-1/2 and TFAM to transcribe both nuclear and mitochondrial genes — more mitochondria and denser cristae.' },
      { h: 'Substrate & the fat-max zone', body: 'Zone-2 (around the first lactate turnpoint, ~2 mmol) maximizes absolute fat oxidation and upregulates CPT1 (fatty-acid transport into the mitochondrion), β-oxidation enzymes such as β-HAD, and intramuscular-triglyceride use — sparing glycogen for when it matters.' },
      { h: 'The lactate shuttle', body: 'Lactate is a fuel, not just a byproduct: trained muscle and heart oxidize it via MCT1 (Brooks’ lactate shuttle). Threshold intervals raise the lactate steady state and clearance capacity, pushing the second turnpoint rightward.' },
      { h: 'Peripheral & central adaptations', body: 'VEGF-driven capillarization improves diffusion; myoglobin rises; plasma volume expands; long low-intensity work improves left-ventricular compliance and stroke volume — the central side of aerobic fitness.' },
      { h: 'Polarized distribution & programming', body: 'Keep ~80% of volume below the first turnpoint (Zone-2: high volume, low autonomic cost) and ~20% at or above threshold/VO2, avoiding the fatiguing ‘grey zone’ (Seiler).', items: [
        'Zone-2: 3–4×/wk, 45–90 min, nasal-breathing/conversational; some fasted for fat-ox.',
        'Threshold: 1×/wk, 4–6×5–8 min at lactate threshold, 2–3 min easy.',
        'VO2 (optional): 1×/wk, 4–6×3 min at ~95% HRmax, 3 min recovery.',
        'Retain strength 2×/wk minimum-dose; progress Zone-2 duration +10–15%/wk.'] },
      { h: 'The readiness marker', body: 'Aerobic decoupling — heart-rate drift across a steady-effort session — below ~5% signals the base is built and the athlete can hold output without cardiac drift.' },
    ],
    exit: 'Zone-2 pace improves at the same HR, decoupling low → sequence into a macrocycle (P6) or peak it (P9).',
  },

  P6: {
    name: 'P6 · Coordinated Modularity — The Macrocycle', stage: 'Periodization', meta: '12-24 weeks · block periodization',
    thesis: 'Adaptations conflict when concurrent and complement when sequenced. P6 orders the blocks into one plan and phase-locks the day around them.',
    chapters: [
      { h: 'Periodization theory', body: 'Selye’s General Adaptation Syndrome (alarm → resistance → exhaustion) underlies every load/recover cycle. Issurin’s block periodization concentrates compatible stimuli into sequential mesocycles — accumulation → transmutation → realization → restitution — rather than training everything at once.' },
      { h: 'The interference effect', body: 'High-volume endurance activates AMPK, which directly antagonizes mTORC1 — the AMPK–mTOR molecular switch — so poorly managed concurrent training blunts strength and hypertrophy. Mitigate: separate modalities by ≥6 h or alternate days, put strength before endurance in a shared session, and keep the non-emphasis quality on a maintenance dose.' },
      { h: 'Residual training effects', body: 'Each quality persists for a characteristic window after its block — aerobic endurance ~25–35 days, maximal strength ~15–25, anaerobic ~5–10. Sequencing blocks to exploit these residuals lets gains stack instead of decaying, which is the entire point of ordering the macrocycle.' },
      { h: 'Chrono-nutrition phase-lock', body: 'Fixed wake/sleep; meals timed to sessions and the circadian window; morning light; carbohydrate periodized to the block’s emphasis (fed for build blocks, train-low for base blocks). The day’s modules are locked in sequence — the frame that holds everything.' },
      { h: 'Load management', body: 'Track weekly load (sets×reps×load, or session-RPE × minutes) and hold the acute:chronic workload ratio between 0.8 and 1.3 — the band associated with lowest injury risk — alongside bodyweight, HRV, and one performance marker per block.' },
    ],
    exit: 'Macrocycle complete → re-screen (P0), consolidate the new baseline (P10), design the next arc.',
  },

  P7: {
    name: 'P7 · Recursive Shear — Intensification', stage: 'Cutting', meta: '6-10 weeks · deficit block',
    thesis: 'In a deficit the body negotiates which tissue to burn. Pruning and metabolic shedding are the goal — P7 rigs the negotiation toward fat and away from muscle.',
    chapters: [
      { h: 'Lipolysis biochemistry', body: 'Catecholamines act on β-adrenergic receptors → cAMP → PKA, which phosphorylates hormone-sensitive lipase (HSL) and perilipin; ATGL initiates triglyceride hydrolysis. Insulin is antilipolytic, so carbohydrate management gates fat release. The liberated free fatty acids are oxidized via CPT1 and β-oxidation.' },
      { h: 'Defending lean mass', body: 'A deficit plus low leucine tilts net protein balance negative through the ubiquitin–proteasome system (the atrophy ligases MuRF1 and atrogin-1/MAFbx) and autophagy. The counter-signals are a retained high-tension resistance stimulus (mTOR) and elevated protein (2.0–2.6 g/kg). Intensity — not volume — carries the ‘keep the muscle’ message in a deficit.' },
      { h: 'Leptin, thyroid & adaptive thermogenesis', body: 'A sustained deficit lowers leptin, which lowers T3, raises hunger, and reduces NEAT and metabolic rate (adaptive thermogenesis). Scheduled refeeds and diet breaks transiently restore leptin, glycogen, and training quality — keeping fat loss going without a metabolic stall.' },
      { h: 'Programming', items: [
        'Energy 15–20% below maintenance (~0.5–1% bodyweight/week; slower is more muscle-sparing).',
        'Heavy compounds 3–4×/wk, 3–5 reps at RIR 1–2, ~2/3 of accumulation volume — retain, don’t grow; cut junk volume the deficit can’t recover.',
        'Protein 2.0–2.6 g/kg; 1–2 carb refeeds/wk at maintenance (~5–6 g/kg); full diet break (1 wk at maintenance) every 4–6 wk.',
        'Zone-2 to widen the deficit; cap HIIT — its recovery cost competes with lifting.'] },
      { h: 'Monitoring', body: 'Biweekly strength-retention test (a top single or triple). A drop over 5% means the deficit is eating muscle — shrink it or add a refeed. Track the weekly-average bodyweight and waist, not the daily scale.' },
    ],
    exit: 'Target composition reached → reverse to maintenance (P10), then the next build.',
  },

  P8: {
    name: 'P8 · Reflective Feedback — Autoregulation', stage: 'Readiness', meta: 'Overlay on any block · daily gating',
    thesis: 'The written plan is a hypothesis; the athlete’s biology is the data. Interoception surfaces what no longer fits — P8 closes the loop daily.',
    chapters: [
      { h: 'Autonomic readiness & HRV', body: 'Heart-rate variability (RMSSD) indexes vagal/parasympathetic tone. Suppressed HRV means incomplete recovery or elevated sympathetic load. Read it against a 7-day rolling baseline: green ≥ baseline, amber ~ −1 SD, red < −1 SD.' },
      { h: 'Allostatic load', body: 'McEwen’s allostatic load is the cumulative wear of repeated stress mediators (cortisol, catecholamines). Training is a deliberate allostatic stressor; autoregulation keeps the athlete in productive overreaching and out of allostatic overload — recalibration, not grinding.' },
      { h: 'Velocity-based gating', body: 'Bar velocity at a fixed load is a real-time proxy for readiness and fatigue. End a set at a velocity-loss threshold — ~20% for hypertrophy, ~10% for strength/power — so both intraset fatigue and daily readiness cap the dose, and the load self-selects to the day.' },
      { h: 'RPE, RIR & interoception', body: 'Perceived effort (Borg/RIR) integrates central and peripheral fatigue; its accuracy is exactly the interoceptive skill baselined in P0. Cap main lifts at RPE 8 (RIR 2) most days; reserve RPE 9–10 for green days only.' },
      { h: 'Dose by color & deload triggers', items: [
        'Green: full session, top loads, chase a PR. Amber: hold the plan, cap top sets, +1 RIR. Red: technical or easy aerobic only, or rest.',
        'Pull a P3 deload forward when: HRV suppressed 3+ days, bar speed at a fixed load down >5%, resting HR up >7, or mounting sleep debt / soreness.'] },
    ],
    exit: 'Readiness robust, no chronic suppression → keep executing the block goal.',
  },

  P7b: {
    name: 'P7b · Divergence — the fork', stage: 'Decision node', meta: 'Read the fork; do not train through it',
    thesis: 'After separation the system either reintegrates or drifts into maladaptation. Calm can mask collapse — P7b reads which way the fork goes.',
    chapters: [
      { h: 'Functional vs non-functional overreaching', body: 'Planned overload produces a transient performance dip that supercompensates on unload — functional overreaching (FOR), the intended outcome. If the load/recovery mismatch persists, performance stays depressed for weeks — non-functional overreaching (NFOR), the antechamber to overtraining syndrome (OTS).' },
      { h: 'The autonomic signature', body: 'Early sympathetic overtraining shows as elevated resting HR, unstable HRV, and restlessness. Deeper parasympathetic overtraining shows as an unusually low resting HR, blunted HR response to effort, fatigue, and anhedonia — which can masquerade as ‘calm.’ Read HRV pattern, mood (POMS), and performance together, never one alone.' },
      { h: 'The decision', body: 'Reintegrate — a structured unload (P3) then re-enter the arc — or drift and accumulate maladaptation. A suddenly ‘easy’ low resting HR paired with falling performance is a red flag, not recovery.' },
    ],
    exit: 'Reintegrate via P3, or escalate rest if NFOR/OTS is suspected — do not add load at the fork.',
  },

  P9: {
    name: 'P9 · Threshold — Realization', stage: 'Peaking', meta: '1-3 week taper into a target date',
    thesis: 'Peak performance is fitness minus fatigue, maximized on a date. Poised between transformation and collapse, P9 sheds fatigue while holding fitness.',
    chapters: [
      { h: 'The taper', body: 'Reduce volume 40–60% along an exponential decay while holding or slightly raising intensity and maintaining frequency. Because fatigue decays faster than fitness (the fitness-fatigue model), the net performance rises to a peak as the taper unloads accumulated fatigue.' },
      { h: 'Neuromuscular potentiation', body: 'Maintained high-intensity work preserves motor-unit firing rate and rate of force development. Post-activation potentiation — myosin regulatory-light-chain phosphorylation after heavy or explosive efforts — can acutely sharpen power, which is why a short primer ~48 h out helps.' },
      { h: 'Glycogen supercompensation & fluid', body: 'Carbohydrate-load 24–48 h pre-event: 8–10 g/kg for endurance; for strength, top off muscle glycogen with hydration and sodium (each gram of glycogen binds ~3 g water). Bank sleep across the taper week.' },
      { h: 'Programming', items: [
        '1–3 wk taper: volume down, intensity sharp (heavy singles/doubles/triples 85–95%), frequency held.',
        'Rehearse openers at ~90% (go/no-go); no new maxes in the taper.',
        'Last genuinely hard session 5–7 days out; short explosive primer ~48 h out.'] },
      { h: 'Go / no-go', body: 'On the day, bar speed, HRV, and subjective readiness converge into a single call.' },
    ],
    exit: 'Compete / peak → restitution (P3), then reset (P0/P10).',
  },

  P10: {
    name: 'P10 · Reintegrated Recursion — Metabolic Flexibility', stage: 'Adaptation', meta: '4-8 week consolidation · then loop',
    thesis: 'The adapted athlete switches fuels on demand and holds the new baseline. Metabolic flexibility is the new set point — the spiral re-enters higher.',
    chapters: [
      { h: 'Metabolic flexibility & the Randle cycle', body: 'Metabolic flexibility is the capacity to switch between fat and carbohydrate oxidation with substrate availability and intensity. In the glucose–fatty-acid (Randle) cycle, fatty-acid oxidation inhibits pyruvate dehydrogenase (PDH) and phosphofructokinase, while insulin and high intensity flip PDH on for carbohydrate flux. Flexibility is fast, appropriate switching; inflexibility underlies metabolic disease.' },
      { h: 'Training for fuel-switching', body: 'Alternate fasted Zone-2 (fat oxidation via CPT1/β-oxidation) with fueled glycolytic sessions (PDH flux, glycogen), and rotate low- and high-carb days so both pathways stay responsive rather than one atrophying.' },
      { h: 'Maintenance dose', body: 'Reduced-volume training — roughly two-thirds of peak — retains most strength and aerobic adaptation for weeks (the minimum effective dose, riding the residual training effects). Two to three quality strength sessions and two to three aerobic sessions per week hold the baseline.' },
      { h: 'Reverse dieting & the set point', body: 'After a cut, add ~5–10% calories per week (mostly carbohydrate) to reverse adaptive thermogenesis — restoring leptin, T3, and NEAT — without fat regain. Hold the new bodyweight 4–8 weeks for an allostatic re-set before the next push.' },
      { h: 'Re-plan the arc', body: 'Re-run the P0 screen; the gaps it surfaces choose the next macrocycle emphasis. The baseline is now higher, and the cycle repeats one turn up.' },
    ],
    exit: 'Baseline consolidated → next macrocycle (P6) or a targeted block.',
  },
};

module.exports = async function handler(req, res) {
  const pass = reqKey(req);
  if (!(isMaster(pass) || hasDomain(pass, 'fitness'))) return deny(res);
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify({
    ok: true,
    disclaimer: 'Internal programming reference. General fitness education, not medical advice; assumes a screened, healthy trainee.',
    programs: PROGRAMS,
  }));
};
