/**
 * handlers/fitness-program.js — ADMIN-ONLY phase programming for /fitness.
 *
 * GET /api/fitness-program            (needs a valid admin passcode)
 *   auth: x-limen-pass header or ?key=  (master = ADMIN_MASTER)
 *   → { ok:true, programs:{ P0:{...}, ... } }
 *
 * The full written mesocycles live ONLY in this server bundle. They are never
 * embedded in fitness.html, so a public visitor (view-source included) sees the
 * ladder names/prices but NOT the programming. 403 on a bad/missing passcode.
 *
 * Programming is general fitness education, grounded in the science cited on the
 * page (Issurin, Schoenfeld, Seiler, Volek, Panda, McEwen, Craig/Porges). It is
 * not medical advice and assumes a screened, healthy trainee.
 */
const { reqKey, isMaster, hasDomain, deny } = require('../lib/admin-gate');

const PROGRAMS = {
  P0: {
    name: 'Needs Analysis',
    stage: 'Assessment',
    goal: 'Establish where the athlete actually sits at every scale (rep, session, macrocycle) and assign the true starting phase. No training is prescribed until the read is done.',
    meta: 'One-week diagnostic · repeat quarterly',
    sections: [
      { h: 'Movement screen', items: [
        'Overhead squat, single-leg RDL, active straight-leg raise, trunk-stability push-up, shoulder mobility, ankle dorsiflexion, thoracic rotation.',
        'Score each pass / limited / painful. Pain = refer out before loading.'] },
      { h: 'Strength & power baselines', items: [
        'Estimated 1RM (or clean 3-5RM) on a squat, hinge, horizontal press, vertical pull.',
        'Bodyweight ratios (relative strength), and a jump or med-ball throw for power.'] },
      { h: 'Aerobic & metabolic', items: [
        '7-day resting AM heart rate + HRV baseline (this is the reference every later phase reads against).',
        'Submax aerobic test (Cooper 12-min or a HR-clamped step test) → Zone-2 pace at nasal-breathing threshold.'] },
      { h: 'Body & lifestyle', items: [
        'Bodyweight, waist:height, girths (optional DEXA/BIA).',
        'Chronotype (MEQ), 2-week sleep log (duration + latency), perceived stress, training age, 3-day nutrition log.'] },
      { h: 'Interoception', items: [
        'Body-scan / hunger-satiety accuracy and a daily readiness self-rating. Sets the baseline for the P8 autoregulation layer.'] },
    ],
    output: 'A written phase assignment at the rep, session, and macrocycle scale, any red flags, and the first mesocycle to run.',
    exit: 'Screen clean + baselines captured → drop into the assigned phase mesocycle.',
  },

  P1: {
    name: 'Chronoload', stage: 'Chronobiology',
    goal: 'Place the hardest work in the window your physiology is primed to adapt, and entrain the clock so that window is reliable.',
    meta: '4 weeks · 4 training days · timing is the variable, not volume',
    sections: [
      { h: 'Wake protocol', items: [
        'Fixed wake time, 7 days. 10-20 min outdoor light within 30 min of waking (anchors cortisol + circadian phase).',
        'Delay caffeine 60-90 min after waking (let adenosine clear first).'] },
      { h: 'Session placement', items: [
        'Primary lifting 6-9 h after wake — the late-afternoon core-temperature / neuromuscular peak for most chronotypes (shift earlier for strong morning types).',
        'Skill, mobility, easy aerobic in the AM. Hard glycolytic work at the personal peak, never inside the 3 h before sleep.'] },
      { h: 'Sample week', items: [
        'Mon PM strength · Tue AM Zone-2 · Wed mobility/off · Thu PM strength · Fri PM power/skill · Sat AM long Zone-2 · Sun off.'] },
      { h: 'Evening / wind-down', items: [
        'Dim light after sunset, screens off 60 min pre-bed, last meal ≥3 h before sleep, cool dark room.'] },
      { h: 'Progression & readiness', items: [
        'Hold intensity; standardize timing so the body learns the window. Week 4 slight deload.',
        'If morning HRV trends down, move the session later or trim a set — don’t fight the clock.'] },
    ],
    exit: 'Clock entrained: consistent wake, sleep latency < 20 min, stable AM HRV → P2 fueling.',
  },

  P2: {
    name: 'Periodized Fueling', stage: 'Nutrient timing',
    goal: 'Match carbohydrate availability to the work in front of you, distribute protein for the leucine trigger, and cycle fasting to session demand.',
    meta: '4 weeks · fuel follows the training, not the clock',
    sections: [
      { h: 'Carbohydrate periodization', items: [
        'Hard / glycolytic days: high carb, 5-7 g/kg, clustered around the session (train-high).',
        'Easy / Zone-2 days: train-low (fasted or < 2 g/kg) to drive mitochondrial and fat-oxidation adaptation.'] },
      { h: 'Protein', items: [
        '1.6-2.2 g/kg/day, split 0.4 g/kg across 4-5 feedings to re-trigger MPS; 40 g slow protein pre-sleep.'] },
      { h: 'Fat & fasting', items: [
        'Fat fills the remainder, weighted onto low-carb days. 12-14 h overnight fast on easy days; break the fast after AM Zone-2 to extend fat-ox.'] },
      { h: 'Peri-workout (hard days)', items: [
        'Pre: 30-60 g carb + 20-40 g protein, 60-90 min out. Post: 0.8-1.2 g/kg carb + 30-40 g protein.'] },
      { h: 'Progression', items: [
        'Keep total weekly energy at the block target (surplus in a build, deficit in a cut); only the day-to-day carb placement moves.'] },
    ],
    exit: 'Energy and session quality hold on periodized intake → P3 recovery.',
  },

  P3: {
    name: 'Supercompensation', stage: 'Recovery',
    goal: 'Program the rebound instead of just resting. Dissipate fatigue faster than fitness so you super-compensate onto a higher baseline.',
    meta: '1-week deload microcycle · gated by HRV, not the calendar',
    sections: [
      { h: 'Deload', items: [
        'Cut working sets ~40-50%. Hold load near 90% of block top to preserve the neural pattern. Nothing to failure, RIR 3-4.'] },
      { h: 'Sleep architecture', items: [
        '8-9 h opportunity, fixed times, cool + dark. Earlier bedtime protects early-night slow-wave sleep (physical repair); no alcohol, which blunts late-night REM.'] },
      { h: 'Glymphatic & clearance', items: [
        'Side-sleeping, hydrated, no late alcohol or heavy late meals — support overnight metabolic clearance.'] },
      { h: 'Autophagy window', items: [
        'One 16-18 h fast on the lowest-load day, kept low-protein that day to lower mTOR and let autophagy run.'] },
      { h: 'HRV-timed return', items: [
        'Resume loading only when morning HRV returns to or above baseline for 2 consecutive days. That is the green light, not the date.'] },
    ],
    exit: 'HRV rebounded, soreness cleared, drive back → re-enter an accumulation (P4) or intensification (P7) block.',
  },

  P4: {
    name: 'Accumulation', stage: 'Hypertrophy',
    goal: 'Grow through mechanical tension and accumulated volume. Ramp from your minimum effective volume toward your max adaptive volume, then unload.',
    meta: '4 weeks · 4 days · upper/lower · RIR-autoregulated',
    sections: [
      { h: 'Lower A — quad-dominant', items: [
        'Back squat 4×6-8, tempo 3-0-1, RIR 2 · Leg press 3×10-12 · RDL 3×8-10 · Walking lunge 2×12 · Seated leg curl 3×12-15 · Calf raise 4×12.'] },
      { h: 'Upper A — push-emphasis', items: [
        'Bench press 4×6-8 RIR 2 · Incline DB press 3×10 · Seated OHP 3×8-10 · Lateral raise 3×15 · Dips 3×10 · Triceps pushdown 3×12-15.'] },
      { h: 'Lower B — hinge-dominant', items: [
        'Deadlift 3×5 RIR 2 · Front squat 3×8 · Hip thrust 3×10 · Bulgarian split squat 3×10 · Leg extension 3×15 · Calf raise 4×15.'] },
      { h: 'Upper B — pull-emphasis', items: [
        'Weighted pull-up 4×6-8 · Barbell row 4×10 · Chest-supported row 3×12 · Face pull 3×20 · EZ-bar curl 3×10 · Hammer curl 3×12.'] },
      { h: 'Progression (MEV → MAV)', items: [
        'Wk1 ~12 sets/muscle (MEV). Add 1-2 sets/muscle each week to ~18-20 by wk3 (MAV). Reps constant; add load when you hit the top of the range at target RIR. Emphasize a 2-4 s eccentric for time-under-tension. Wk4 = deload (P3).'] },
      { h: 'Fuel & recovery', items: [
        'Slight surplus (+5-10%), 1.6-2.2 g/kg protein, carbs around sessions. 7-9 h sleep, ≥48 h between training the same muscle.'] },
    ],
    exit: 'Gains plateau or volume tolerance maxes out → deload, then intensify (P7) or build the engine (P5).',
  },

  P5: {
    name: 'Aerobic Base', stage: 'Metabolic conditioning',
    goal: 'Build the mitochondria and fat-oxidation that make you hard to break. Mostly easy, a little very hard — polarized.',
    meta: '4-6 weeks · 4-6 aerobic sessions · ~80/20 low/high',
    sections: [
      { h: 'Zone-2 (the base)', items: [
        '3-4×/wk, 45-90 min, nasal-breathing / conversational, HR at the first lactate turnpoint (~2 mmol). Some sessions fasted to bias fat-ox.'] },
      { h: 'Threshold', items: [
        '1×/wk: 4-6 × 5-8 min at lactate threshold (comfortably-hard), 2-3 min easy between.'] },
      { h: 'VO2 (optional)', items: [
        '1×/wk: 4-6 × 3 min at ~95% HRmax, 3 min recovery. Keep the hard days genuinely hard and rare.'] },
      { h: 'Retain strength', items: [
        '2×/wk minimum-dose lifting (heavy, low volume) so the base block doesn’t bleed strength.'] },
      { h: 'Progression & marker', items: [
        'Add 10-15% Zone-2 duration/week, hold the intensity zones by HR. Base is built when aerobic decoupling (HR drift across a steady effort) drops below ~5%.'] },
    ],
    exit: 'Zone-2 pace improves at the same HR, decoupling low → sequence it into a macrocycle (P6) or peak it (P9).',
  },

  P6: {
    name: 'The Macrocycle', stage: 'Periodization',
    goal: 'Sequence every block into one plan and phase-lock training, meals, light, and sleep so they pull in the same direction.',
    meta: '12-24 weeks · block periodization',
    sections: [
      { h: 'Block sequence (Issurin)', items: [
        'Accumulation (hypertrophy / aerobic base, 4-6 wk) → Transmutation (strength / event-specific, 3-4 wk) → Realization (peak + taper, 1-2 wk) → Restitution (deload, 1 wk). Repeat, rotating the emphasis.'] },
      { h: 'Manage interference', items: [
        'Concurrent strength + endurance: separate by ≥6 h or alternate days; when in one session, strength before endurance. Keep the non-emphasis quality on maintenance dose.'] },
      { h: 'Phase-lock the day', items: [
        'Fixed wake/sleep; meals timed to sessions and circadian window; AM light; carbohydrate periodized to the block’s emphasis (build = fed, base = train-low).'] },
      { h: 'Load management', items: [
        'Track weekly load (sets×reps×load, or session-RPE × minutes). Hold acute:chronic ratio 0.8-1.3. Watch bodyweight, HRV, and one performance marker per block.'] },
    ],
    exit: 'Macrocycle complete → re-screen (P0), consolidate the new baseline (P10), design the next arc.',
  },

  P7: {
    name: 'Intensification', stage: 'Cutting',
    goal: 'Strip fat while defending muscle: cut volume, hold intensity, keep the heavy stimulus that tells the body to keep its strength.',
    meta: '6-10 weeks · deficit block',
    sections: [
      { h: 'Energy', items: [
        '15-20% below maintenance (~0.5-1% bodyweight/week). Slower is more muscle-sparing.'] },
      { h: 'Training (retain, don’t grow)', items: [
        'Heavy compounds 3-4×/wk, 3-5 reps at RIR 1-2, ~2/3 of accumulation volume. Enough intensity to hold strength; cut the junk volume the deficit can’t recover from.'] },
      { h: 'Protein & refeeds', items: [
        'Protein 2.0-2.6 g/kg (higher in a deficit). 1-2 high-carb refeed days/week at maintenance (~5-6 g/kg carb) to restore glycogen, leptin, and session quality. Full diet break (1 wk at maintenance) every 4-6 weeks.'] },
      { h: 'Conditioning', items: [
        'Add Zone-2 to widen the deficit; cap HIIT — its recovery cost competes with lifting in a deficit.'] },
      { h: 'Readiness gate', items: [
        'Biweekly strength-retention check (a top single or triple). If it drops > 5%, shrink the deficit or add a refeed.'] },
    ],
    exit: 'Target composition reached → reverse to maintenance (P10), then the next build.',
  },

  P8: {
    name: 'Autoregulation', stage: 'Readiness',
    goal: 'Let today’s readiness set today’s dose. The plan bends to the athlete instead of the athlete breaking on the plan.',
    meta: 'Overlay on any block · daily gating',
    sections: [
      { h: 'Morning readiness score', items: [
        'HRV vs 7-day rolling baseline + subjective (sleep, soreness, mood, energy). Green ≥ baseline · Amber ~ −1 SD · Red < −1 SD.'] },
      { h: 'Dose by color', items: [
        'Green: full session, top loads, chase a PR. Amber: hold the plan, cap top sets, add 1 to RIR. Red: technical or easy aerobic only, or rest.'] },
      { h: 'Velocity-based gating', items: [
        'Set a bar-speed target on the main lift; end the set at a velocity-loss threshold (~20% for hypertrophy, ~10% for strength/power). Load self-selects to the day.'] },
      { h: 'Deload triggers', items: [
        'HRV suppressed 3+ days, bar speed at a fixed load down > 5%, resting HR up > 7, mounting sleep debt or soreness → pull a P3 deload forward.'] },
    ],
    exit: 'Readiness robust, no chronic suppression → keep executing the block goal.',
  },

  P9: {
    name: 'Realization', stage: 'Peaking',
    goal: 'Peak on the day it counts. Shed fatigue while holding fitness so performance super-compensates onto the event.',
    meta: '1-3 week taper into a target date',
    sections: [
      { h: 'Taper', items: [
        'Cut volume 40-60% over 1-2 weeks (exponential), hold or slightly raise intensity (heavy singles/doubles/triples at 85-95%), keep frequency. Fatigue falls faster than fitness.'] },
      { h: 'Rehearse, don’t build', items: [
        'Practice event lifts/efforts at ~90% (go/no-go). No new maxes in the taper. Last genuinely hard session 5-7 days out; a short explosive primer ~48 h out.'] },
      { h: 'Fuel & sleep', items: [
        'Carb-load 24-48 h pre-event (endurance 8-10 g/kg; strength: top glycogen + hydration/sodium). Bank sleep across the taper week.'] },
      { h: 'Go / no-go', items: [
        'Green-light from bar speed, HRV, and subjective readiness on the day.'] },
    ],
    exit: 'Compete / peak → restitution (P3), then reset (P0/P10).',
  },

  P10: {
    name: 'Metabolic Flexibility', stage: 'Adaptation',
    goal: 'Hold the elevated baseline, keep both fuel systems responsive, and design the next arc from a consolidated set-point.',
    meta: '4-8 week consolidation · then loop',
    sections: [
      { h: 'Fuel-switching', items: [
        'Alternate fasted Zone-2 (fat-ox) with fueled glycolytic sessions; rotate low-carb and high-carb days so the body stays sharp switching between fat and carbohydrate.'] },
      { h: 'Maintenance dose', items: [
        '~2/3 of peak training volume holds most of the adaptation: 2-3 quality strength + 2-3 aerobic sessions/week.'] },
      { h: 'Reverse diet (post-cut)', items: [
        'Add ~5-10% calories/week (mostly carbohydrate) back toward maintenance to restore metabolic rate and hormones without fat regain.'] },
      { h: 'Consolidate & re-plan', items: [
        'Hold the new bodyweight 4-8 weeks (allostatic re-set) before the next push. Re-run the P0 screen and pick the next macrocycle emphasis from the gaps it surfaces.'] },
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
