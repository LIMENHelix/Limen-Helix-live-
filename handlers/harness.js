/**
 * handlers/harness.js — the ledger endpoint. Read what actually ran; flip a valve.
 *
 * GET /api/harness?key=…                          the whole board
 * GET /api/harness?key=…&valve=<job>&open=0|1     shut or open an outward job
 * GET /api/harness?key=…&beat=<job>&ok=1&ms=1234  report a run (GitHub Actions)
 *
 * THE SHAPE OF THE RESPONSE IS THE POINT
 * `declared` is what vercel.json and the workflows say SHOULD happen.
 * `observed` is what lib/heartbeat actually recorded.
 * They are separate objects and are never merged, because the entire failure
 * mode this endpoint exists to prevent is a panel that reads a schedule and
 * renders it as activity. A job with a schedule and no beats has not run. It
 * must look like it has not run.
 *
 * NO CACHE. lib/tool-fetch's send() sets s-maxage=900, which would serve a
 * fifteen-minute-old spike stream to a view whose whole job is to be live.
 *
 * AUTH: same key list the rest of the admin surface uses, and the same
 * fail-closed rule as handlers/lead.js — if no key is configured in the
 * environment, this endpoint is off rather than open.
 */

var HB = require('../lib/heartbeat');
var MAP = require('../lib/harness-map');
var KS = require('../lib/ai-kill-switch');
var SOCIAL = require('../lib/social-post');

var KEY_VARS = ['HARNESS_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY', 'CRON_SECRET'];

function send(res, payload, status) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status || 200;
  return res.end(JSON.stringify(payload));
}

function configuredKeys() {
  return KEY_VARS.map(function (n) { return process.env[n] ? String(process.env[n]).trim() : ''; })
                 .filter(function (v) { return v.length > 0; });
}

function authorized(supplied) {
  var keys = configuredKeys();
  if (!keys.length) return { ok: false, unconfigured: true };
  if (!supplied) return { ok: false };
  for (var i = 0; i < keys.length; i++) if (supplied === keys[i]) return { ok: true };
  return { ok: false };
}

/**
 * Longest gap a schedule should ever leave, in ms. Used to decide whether a job
 * is overdue, which is what starves an edge in the brain view.
 *
 * Deliberately narrow: it handles the five cron shapes this repo actually uses
 * and returns null for anything else. A wrong interval would either cry wolf or
 * hide a dead job, and null (drawn as "cannot tell") is honest where a guess is
 * not. Whoever adds an exotic schedule can teach this then.
 */
function expectedGapMs(schedule) {
  if (!schedule || typeof schedule !== 'string') return null;
  var f = schedule.trim().split(/\s+/);
  if (f.length !== 5) return null;
  var min = f[0], hr = f[1], dom = f[2], mon = f[3], dow = f[4];
  var MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  if (dom !== '*' || mon !== '*') return null;

  // */N * * * *  → every N minutes
  var everyN = /^\*\/(\d+)$/.exec(min);
  if (everyN && hr === '*' && dow === '*') return parseInt(everyN[1], 10) * MIN;

  // a,b,c * * * *  → hourly set; worst gap is the largest wrap-around interval
  if (/^[\d,]+$/.test(min) && hr === '*' && dow === '*') {
    var mins = min.split(',').map(Number).sort(function (a, b) { return a - b; });
    if (mins.length === 1) return HOUR;
    var worst = (60 - mins[mins.length - 1]) + mins[0];
    for (var i = 1; i < mins.length; i++) worst = Math.max(worst, mins[i] - mins[i - 1]);
    return worst * MIN;
  }
  // M H,H,H * * *  → daily set of hours
  if (/^\d+$/.test(min) && /^[\d,]+$/.test(hr) && dow === '*') {
    var hrs = hr.split(',').map(Number).sort(function (a, b) { return a - b; });
    if (hrs.length === 1) return DAY;
    var wh = (24 - hrs[hrs.length - 1]) + hrs[0];
    for (var k = 1; k < hrs.length; k++) wh = Math.max(wh, hrs[k] - hrs[k - 1]);
    return wh * HOUR;
  }
  // M H * * D  → weekly
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && /^\d+$/.test(dow)) return 7 * DAY;
  return null;
}

/**
 * The AI spend picture, with the two boundaries kept separate because they are
 * not the same kind of control. `envEnabled` needs a Vercel change and a
 * redeploy; `runtimePaused` is instant. Collapsing them into one "AI: on/off"
 * would tell the operator they can reach something they cannot.
 */
async function aiState() {
  var envEnabled = !KS.aiDisabled();
  var tokensPerTick = parseInt(process.env.LIMEN_AI_TOKENS_PER_TICK || '0', 10);
  var runtimePaused = await KS.spendPausedRuntime();
  var blocked = await KS.spendDisabled();
  return {
    envEnabled: envEnabled,
    envVar: 'LIMEN_AI_ENABLED',
    tokensPerTick: tokensPerTick,
    runtimePaused: runtimePaused,
    spending: !blocked,
    reason: !envEnabled ? 'env-disabled'
      : (runtimePaused ? 'operator-paused' : (tokensPerTick <= 0 ? 'budget-zero' : 'live')),
    // Stated plainly so the panel never implies the switch reaches further than it does.
    controllableHere: envEnabled,
    needsVercel: !envEnabled
      ? 'Set LIMEN_AI_ENABLED=1 and LIMEN_AI_TOKENS_PER_TICK to a non-zero value in Vercel, then redeploy. Until then this switch cannot enable spend.'
      : null,
    // The one paid job that ignores all of the above.
    ungatedPaidJobs: Object.keys(MAP.COST).filter(function (k) { return MAP.COST[k].killSwitch === false; })
  };
}

module.exports = async function handler(req, res) {
  try {
    var u = new URL(req.url, 'http://local');
    var q = u.searchParams;
    var auth = authorized(q.get('key') || '');

    if (auth.unconfigured) {
      return send(res, {
        ok: false,
        error: 'The harness is not configured. Set one of ' + KEY_VARS.join(', ') + ' in Vercel to enable it.',
        note: 'Failing closed on purpose: an unset key disables this endpoint rather than opening it.'
      }, 503);
    }
    if (!auth.ok) return send(res, { ok: false, error: 'unauthorized' }, 401);

    // ── write: flip a valve ───────────────────────────────────────────────
    var valveJob = q.get('valve');
    if (valveJob) {
      var open = q.get('open');
      var wantOpen = !(open === '0' || open === 'false' || open === 'no');
      var r = await HB.setValve(valveJob, wantOpen, q.get('reason') || 'set from the harness panel');
      return send(res, r, r.ok ? 200 : 400);
    }

    // ── write: the AI spend switch ────────────────────────────────────────
    // Runtime only. LIMEN_AI_ENABLED is an environment variable and no request
    // can change it, so this flips the Redis pause that lib/ai-kill-switch
    // consults. It can only pause spend the env already permits; it can never
    // open spend past the env boundary. Saying otherwise would be a lie about
    // where the operator's authority actually reaches.
    var ai = q.get('ai');
    if (ai) {
      if (ai !== 'pause' && ai !== 'resume') return send(res, { ok: false, error: 'ai must be pause or resume' }, 400);
      await KS.setSpendPaused(ai === 'pause');
      var st = await aiState();
      return send(res, { ok: true, ai: st,
        note: ai === 'pause' ? 'Autonomous AI spend paused. Takes effect immediately, no redeploy.'
          : (st.envEnabled ? 'Runtime pause lifted. Spend is live within the token ceiling.'
                           : 'Runtime pause lifted, but LIMEN_AI_ENABLED is not 1, so spend stays blocked at the environment boundary.') });
    }

    // ── write: the social posting pause ───────────────────────────────────
    var soc = q.get('social');
    if (soc) {
      if (soc !== 'pause' && soc !== 'resume') return send(res, { ok: false, error: 'social must be pause or resume' }, 400);
      var r2 = await SOCIAL.setPaused(soc === 'pause', 'set from the harness panel');
      return send(res, r2.ok ? { ok: true, social: r2.state } : r2, r2.ok ? 200 : 500);
    }

    // ── write: a run reported from outside Vercel (GitHub Actions) ────────
    var beatJob = q.get('beat');
    if (beatJob) {
      if (!MAP.byJob(beatJob)) {
        return send(res, { ok: false, error: 'unknown job "' + beatJob + '". Declare it in lib/harness-map.js first.' }, 400);
      }
      var okFlag = q.get('ok');
      var row = await HB.beat(beatJob, {
        ok: !(okFlag === '0' || okFlag === 'false'),
        ms: q.get('ms') ? parseInt(q.get('ms'), 10) : null,
        note: q.get('note') || null
      });
      return send(res, { ok: true, recorded: row });
    }

    // ── read: the board ───────────────────────────────────────────────────
    var names = MAP.names();
    var led = await HB.read(names, parseInt(q.get('limit'), 10) || 120);
    var now = Date.now();

    var jobs = MAP.JOBS.map(function (j) {
      var last = led.last[j.job] || null;
      var gap = expectedGapMs(j.schedule);
      var since = last ? (now - last.at) : null;
      // Overdue only when we know the expected gap AND have a baseline to
      // measure from. Never observed = "never", which is not the same as late.
      var overdue = (gap && since != null) ? (since > gap * 1.5) : null;
      var money = MAP.costOf(j.job);
      return {
        job: j.job,
        cost: money,
        declared: { schedule: j.schedule, source: j.source, path: j.path, kind: j.kind, role: j.role, note: j.note, expectedGapMs: gap },
        observed: last ? { at: last.at, ok: last.ok, ms: last.ms, note: last.note, sinceMs: since, overdue: overdue }
                       : { at: null, ok: null, ms: null, note: null, sinceMs: null, overdue: null, neverObserved: true },
        valve: (j.kind === 'outward') ? (led.valves[j.job] || { open: true }) : null
      };
    });

    var observedCount = jobs.filter(function (j) { return !j.observed.neverObserved; }).length;

    var socialState = await SOCIAL.isPaused();

    return send(res, {
      ok: true,
      at: now,
      roles: MAP.ROLES,
      ai: await aiState(),
      social: socialState,
      paidJobs: Object.keys(MAP.COST),
      jobs: jobs,
      spikes: led.spikes,
      spikeCap: led.cap,
      coverage: {
        declared: jobs.length,
        observed: observedCount,
        neverObserved: jobs.length - observedCount,
        note: observedCount === 0
          ? 'Nothing has reported yet. The brain view must render dark: a schedule is not evidence of a run.'
          : observedCount + ' of ' + jobs.length + ' jobs have been observed to run at least once.'
      }
    });
  } catch (e) {
    return send(res, { ok: false, error: e.message || 'handler error' }, 500);
  }
};
