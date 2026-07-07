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

// ── Evidence: peer-reviewed citations verified against PubMed (real PMIDs + DOIs).
// Source: PubMed. Attribution + DOI links are required whenever these are shown.
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

// ── DEEP layer: the smallest-grain molecular cascade (enzymes, residues, ions)
// end-to-end, plus how the chemistry maps to the phase's Book I meaning (pattern).
// Canonical pathway biochemistry; the Evidence block above cites the outcome level.
const DEEP = {
  P0: {
    cascade: [
      'Resting equilibrium: cytosolic ATP:ADP high and AMP:ATP low → AMPK-α Thr172 dephosphorylated → AMPK inactive.',
      'Basal mTORC1 low (Rheb-GTP restrained by TSC1/2) → muscle protein synthesis ≈ breakdown; net protein turnover at detailed balance.',
      'Vagal tone at the sinoatrial node: acetylcholine → M2 muscarinic receptor → Gi → βγ opens GIRK (K⁺) channels → hyperpolarization → resting HR/HRV set point.',
      'Fuel stores topped: muscle glycogen and intramuscular triglyceride full; basal insulin; PDH and CPT1 both idling — either fuel available.',
      'This poised symmetry is the reference zero every later perturbation is measured against.',
    ],
    pattern: 'P0 = Null Symmetry: the undifferentiated, balanced base state before a stimulus breaks symmetry. Molecularly it is detailed balance — synthesis equals degradation, charge equals discharge, sympathetic equals parasympathetic. Assessment reads this symmetry so that every downstream phase has a defined starting point from which the first distinction can be made.',
  },
  P1: {
    cascade: [
      'Dawn light → melanopsin (OPN4) in intrinsically photosensitive retinal ganglion cells → glutamate/PACAP along the retinohypothalamic tract → SCN → phase-locks the master clock.',
      'HPA axis fires: hypothalamic CRH → pituitary POMC cleaved to ACTH → adrenal cortex → cortisol.',
      'Cortisol → cytosolic glucocorticoid receptor (released from HSP90) → nuclear translocation → binds glucocorticoid response elements → transcribes gluconeogenic/catabolic genes (mobilization).',
      'Overnight rising AMP:ATP → LKB1 phosphorylates AMPK-α Thr172 → AMPK active.',
      'AMPK phosphorylates ACC Ser79 (de-represses CPT1 → fat oxidation) and inhibits mTORC1 (Raptor Ser792, TSC2 Ser1387) → the overnight anabolic program is switched off.',
      'β-adrenergic tone rises → cAMP/PKA → hormone-sensitive lipase primed → the fed/repair structure gives way to daytime mobilization.',
    ],
    pattern: 'P1 = Collapse: the prior overnight anabolic structure collapses so the day can begin. Molecularly, the cortisol + AMPK catabolic switch dismantles the fed-state signaling set. Collapse is the first distinction — a symmetric resting state breaks into a directional catabolic flux, the entry point of the recursion.',
  },
  P2: {
    cascade: [
      'Insulin binds the insulin-receptor α-subunits → β-subunit intrinsic tyrosine kinase trans-autophosphorylates.',
      'Recruits IRS-1 (Tyr-phosphorylated) → PI3K (p85 SH2 docks, p110 catalytic) → converts PIP2 → PIP3 at the membrane.',
      'PIP3 recruits PDK1 and Akt via PH domains → Akt phosphorylated at Thr308 (PDK1) and Ser473 (mTORC2) → active.',
      'Akt phosphorylates AS160/TBC1D4 → releases its Rab-GAP brake → Rab-GTP → GLUT4 storage vesicles translocate/fuse → glucose enters → hexokinase → glucose-6-phosphate.',
      'Akt inhibits GSK3β → glycogen synthase dephosphorylated/active → glycogen stored. (Contraction adds an insulin-independent AMPK/Ca²⁺-CaMK GLUT4 route.)',
      'Leucine sensed: binds Sestrin2 → releases GATOR2 → GATOR2 inhibits GATOR1 (the RagA/B GAP) → RagA/B-GTP·RagC/D-GDP → Ragulator recruits mTORC1 to the lysosome where Rheb-GTP activates it → p70S6K1 Thr389, 4E-BP1 Thr37/46.',
    ],
    pattern: 'P2 = Bonding / Structural Pairing: the first stable pairing. Molecularly it is literal binding — ligand to receptor (insulin), substrate to signal (glucose to GLUT4, leucine to Sestrin2), the first closed feedback loop that commits the system to continue. The dyad here is receptor+ligand and enzyme+substrate: the minimal recursive unit.',
  },
  P3: {
    cascade: [
      'Energy/mechanical stress: AMPK phosphorylates ULK1 at Ser317/Ser777 (activating); falling mTORC1 removes the inhibitory ULK1 Ser757 phosphorylation.',
      'ULK1 complex (ULK1–ATG13–FIP200–ATG101) activates the Beclin-1–VPS34 class III PI3K → phosphatidylinositol-3-phosphate (PI3P) marks the phagophore → WIPI2 recruits ATG16L1.',
      'Two ubiquitin-like conjugations build the membrane: ATG7 (E1) + ATG10 form ATG12–ATG5–ATG16L1; ATG7 + ATG3 lipidate LC3-I with phosphatidylethanolamine → LC3-II.',
      'Damaged mitochondria tagged: PINK1 stabilizes on depolarized outer membrane → phospho-ubiquitin → recruits/activates Parkin → poly-ubiquitin chains → p62/SQSTM1 bridges ubiquitin to LC3-II (mitophagy).',
      'Autophagosome closes → fuses with the lysosome (HOPS/SNAREs) → cathepsins hydrolyze cargo → amino acids and fatty acids recycled.',
      'In the depleted window glycogen synthase is up-regulated → glycogen resynthesizes above baseline (supercompensation).',
    ],
    pattern: 'P3 = Fracture: the disassembly of paired structures under load, the descent into repair. Molecularly it is regulated demolition — autophagy, mitophagy, the ubiquitin-proteasome system — a controlled fracture that clears damaged components so a stronger, supercompensated structure can be rebuilt. Breakdown is the mechanism, not the failure.',
  },
  P4: {
    cascade: [
      'Mechanical load strains the costamere (integrin–talin–vinculin–actin) and titin springs → mechanotransduction begins.',
      'Focal adhesion kinase autophosphorylates at Tyr397 → recruits Src; phospholipase D generates phosphatidic acid, which binds the mTOR FRB domain and activates mTORC1.',
      'Signal integration: Akt phosphorylates TSC2 → Rheb-GTP accumulates; amino acids drive Rag GTPases → mTORC1 (mTOR–Raptor–mLST8–PRAS40–DEPTOR) is docked at the lysosome and switched on.',
      'mTORC1 → p70S6K1 Thr389 → phosphorylates rpS6, eIF4B, and eEF2K (relieving the brake on eEF2).',
      'mTORC1 → 4E-BP1 (Thr37/46 → Ser65/Thr70) → releases eIF4E → eIF4F cap complex (eIF4E–eIF4G–eIF4A) assembles on the m⁷G mRNA cap.',
      '43S pre-initiation complex (40S + eIF2·GTP·Met-tRNAi) scans to the AUG → 60S joins → 80S; elongation: eEF1A·GTP delivers aminoacyl-tRNA, the rRNA peptidyl-transferase forms the bond, eEF2·GTP translocates → new sarcomeric protein.',
      'Longer term: mTORC1/MYC drive RNA-Pol-I rRNA transcription (ribosome biogenesis = translational capacity); Pax7⁺ satellite cells proliferate and fuse, donating myonuclei.',
    ],
    pattern: 'P4 = Nested Integration: modular subsystems operating in coordinated, multi-tiered recursion. mTORC1 is the integration node — it nests mechanical, amino-acid, energy, and growth-factor inputs into one output (translation), which nests again into ribosome biogenesis and myonuclear addition. Growth is integration recursing across scales, exactly the phase’s definition.',
  },
  P5: {
    cascade: [
      'Repeated contraction raises three signals: Ca²⁺ transients → CaMKII; AMP:ATP → LKB1 → AMPK-α Thr172; ROS/mechanical stress → p38 MAPK.',
      'These converge on PGC-1α: AMPK phosphorylates it (Thr177/Ser538) and p38 stabilizes it; high NAD⁺:NADH from oxidative flux activates SIRT1, which deacetylates and further activates PGC-1α.',
      'PGC-1α coactivates NRF-1 and NRF-2 → transcription of nuclear-encoded mitochondrial genes and of TFAM; also ERRα for oxidative metabolism.',
      'TFAM enters the mitochondrion → transcribes and helps replicate mtDNA (the 13 core electron-transport-chain subunits).',
      'New Complex I–IV and ATP synthase assemble; CPT1 and β-oxidation enzymes rise; VEGF drives capillary growth for O₂ delivery.',
      'The result is a self-reinforcing loop: more oxidative flux → more NAD⁺ → more SIRT1/PGC-1α → more mitochondria.',
    ],
    pattern: 'P5 = Recursive Stability: sustained internal recursion, an endogenous rhythm. The mitochondrial-biogenesis pathway is literally a positive-feedback recursion (flux → NAD⁺ → SIRT1 → PGC-1α → capacity → flux) that stabilizes the system at a higher oxidative set point — slower, deeper, and harder to break, as the phase name says.',
  },
  P6: {
    cascade: [
      'The central coordinator is the AMPK↔mTOR switch: AMPK phosphorylates TSC2 (Ser1387) and Raptor (Ser722/792) to shut mTORC1 off under energy stress; when energy is replete, Rheb-GTP lets mTORC1 dominate.',
      'Concurrent endurance keeps AMPK elevated → antagonizes mTORC1 → the molecular basis of the interference effect that block sequencing is designed to avoid.',
      'Circadian gating: BMAL1:CLOCK bind E-boxes to time metabolic genes; feeding and exercise entrain the peripheral muscle clock; NAD⁺/SIRT1 and AMPK feed the clock back to metabolism.',
      'Substrate handling, protein synthesis, and autonomic recovery are thereby phase-locked into a repeating daily and weekly sequence.',
    ],
    pattern: 'P6 = Coordinated Modularity: distinct subsystems operating independently yet phase-locked to the whole. Molecularly, the AMPK / mTOR / circadian-clock network is the coordinator that sequences catabolic and anabolic modules in time — the frame that orders the day and the training block so the modules complement rather than interfere.',
  },
  P7: {
    cascade: [
      'β-adrenergic receptor (Gs) → adenylyl cyclase → ATP → cAMP → protein kinase A.',
      'PKA phosphorylates perilipin-1 (releasing CGI-58/ABHD5, which activates ATGL) and hormone-sensitive lipase (Ser563/659/660 → translocates to the lipid droplet).',
      'Triacylglycerol lipolysis cascade: ATGL (TAG→DAG) → HSL (DAG→MAG) → MGL (MAG→glycerol + free fatty acid). Insulin, being antilipolytic, gates the whole chain.',
      'FFA → fatty-acyl-CoA (ACSL) → CPT1 carnitine shuttle into the mitochondrion (malonyl-CoA inhibits CPT1; AMPK lowers malonyl-CoA by phosphorylating ACC).',
      'β-oxidation spiral (4 steps/turn): acyl-CoA dehydrogenase → FADH₂; enoyl-CoA hydratase; 3-hydroxyacyl-CoA dehydrogenase → NADH; thiolase → acetyl-CoA → TCA cycle → electron-transport chain.',
      'Muscle sparing: a retained high-tension resistance stimulus keeps mTORC1/MPS active, while the ubiquitin-proteasome atrophy program (FOXO → MuRF1, atrogin-1/MAFbx, triggered when Akt falls) is held in check by high leucine and that mechanical signal.',
    ],
    pattern: 'P7 = Recursive Shear / Separation: a system-wide unbinding — pruning, apoptosis, metabolic shedding. Molecularly it is the enzymatic separation of stored triacylglycerol into usable fuel, coupled with a restrained proteolysis that removes fat without severing muscle. Optimization that reads as loss because it is, precisely, controlled separation.',
  },
  P7b: {
    cascade: [
      'The bifurcation variable is the energy-charge / AMPK:mTOR balance held over days.',
      'Reintegration branch: energy restored + anabolic signaling (Akt→mTORC1) returns → FOXO stays phosphorylated/cytoplasmic → atrogenes off → supercompensation.',
      'Drift branch: sustained low energy charge → chronic AMPK, low Akt → FOXO nuclear → autophagy/atrogenes dominate → non-functional overreaching.',
      'Autonomic tell: prolonged sympathetic drive can flip to parasympathetic dominance (vagal M2→GIRK) — an unusually low resting HR and blunted HR response that masquerades as recovery while performance falls.',
    ],
    pattern: 'P7b = Divergence: the decision node where the recursion either reintegrates or drifts. Molecularly it is a bistable switch (AMPK vs mTOR, FOXO vs Akt) resolving at a threshold. Calm can mask collapse because the same low-HR reading sits on both sides of the fork — the phase is a genuine branch point, not a step to train through.',
  },
  P8: {
    cascade: [
      'Cellular energy sensor: AMP/ADP bind the AMPK γ-subunit → allosteric activation + protection of Thr172 from dephosphorylation → AMPK reports the energy state.',
      'Nutrient sensor: the Sestrin2–GATOR–Rag axis reports amino-acid availability to mTORC1 → the cell reads its own supply.',
      'Autonomic readout: vagal efferent ACh → SA-node M2 → Gi → GIRK sets beat-to-beat variability; RMSSD indexes parasympathetic reactivation = recovery state.',
      'Interoceptive loop: vagal afferents → nucleus tractus solitarius → insular cortex → conscious readiness; RPE/RIR is this signal made usable.',
      'These readouts gate the day’s dose (green/amber/red) and trigger a deload when suppression persists.',
    ],
    pattern: 'P8 = Reflective Feedback / Conscience: a system that monitors and adjusts itself. Molecularly, AMPK and mTOR are the cell reading its own energy and nutrient state, while the autonomic/interoceptive loop is the organism reading its own recovery. Autoregulation is the phase’s definition enacted — the recursion reflecting on itself and recalibrating.',
  },
  P9: {
    cascade: [
      'Taper: fatigue components (plasma-volume shift, glycogen depletion, autonomic load) decay faster than fitness components (mitochondrial and myofibrillar protein, capillarity) → the fitness-minus-fatigue difference rises to a peak.',
      'Post-activation potentiation: a heavy/explosive conditioning contraction → Ca²⁺/calmodulin → myosin light-chain kinase phosphorylates the myosin regulatory light chain → increased Ca²⁺-sensitivity of cross-bridge cycling → transient rise in force and rate of force development.',
      'Glycogen supercompensation: prior depletion + carbohydrate load → glycogen synthase stores above baseline; each gram of glycogen binds ~3 g water (fuel + hydration).',
      'The peak has switch-like (ultrasensitive, cooperative) character — a narrow window, poised between full expression and over-reach.',
    ],
    pattern: 'P9 = Threshold: recursive tension at maximum saturation, poised between transformation and collapse. Molecularly the system sits at a switch point — potentiated cross-bridges, supercompensated glycogen, fatigue shed — an ultrasensitive threshold rather than a line, exactly the region the phase names.',
  },
  P10: {
    cascade: [
      'Randle cycle (fat side): fatty-acid oxidation raises acetyl-CoA and NADH → activates pyruvate-dehydrogenase kinase → phosphorylates and inhibits PDH; citrate inhibits phosphofructokinase-1 → glucose spared.',
      'Randle cycle (carb side): insulin / high intensity → pyruvate-dehydrogenase phosphatase dephosphorylates and activates PDH → pyruvate flux; malonyl-CoA (from ACC) inhibits CPT1 → fat oxidation switched down when carbohydrate is abundant.',
      'Metabolic flexibility = fast, appropriate switching at these two nodes (PDH on/off, CPT1 gating), enabled by trained mitochondrial density, GLUT4 content, and enzyme capacity.',
      'Consolidation: reduced-volume training holds the adaptation; a reverse diet adds carbohydrate weekly to restore leptin, T3, and NEAT (reversing adaptive thermogenesis) at a new, higher set point.',
    ],
    pattern: 'P10 = Reintegrated Recursion / Resurrection: the system repatterned across all prior levels, a new baseline from which the spiral re-enters higher. Molecularly it is the restored capacity to switch fuels cleanly (the Randle nodes) at an elevated set point — the loop closed and reintegrated, ready to begin the arc again one turn up.',
  },
};

module.exports = async function handler(req, res) {
  const pass = reqKey(req);
  if (!(isMaster(pass) || hasDomain(pass, 'fitness'))) return deny(res);
  const programs = {};
  for (const k of Object.keys(PROGRAMS)) {
    const d = DEEP[k] || {};
    programs[k] = Object.assign({}, PROGRAMS[k], {
      evidence: EVIDENCE[k] || [], evNote: EVNOTES[k] || '',
      cascade: d.cascade || [], pattern: d.pattern || '',
    });
  }
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify({
    ok: true,
    disclaimer: 'Internal programming reference. General fitness education, not medical advice; assumes a screened, healthy trainee. Evidence retrieved from PubMed; findings paraphrased, PMIDs and DOIs given for verification.',
    source: 'PubMed',
    programs,
  }));
};
