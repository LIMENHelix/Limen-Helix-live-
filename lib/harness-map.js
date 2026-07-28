/**
 * lib/harness-map.js — the DECLARED inventory of scheduled work.
 *
 * This is what is SUPPOSED to run. It is not evidence that anything ran; that
 * is lib/heartbeat's ledger, and the two must never be conflated in the UI. A
 * job listed here with no beats is a job that has never been observed to run,
 * and the panel must draw it that way rather than assuming the schedule was
 * honoured.
 *
 * WHY THIS IS DECLARED INSTEAD OF READ
 * vercel.json is the real source of truth for the Vercel crons, and
 * .github/workflows/*.yml for the Actions ones. Neither is readable at runtime:
 * vercel.json's own `functions.api/**.excludeFiles` drops `*.json` from the
 * function bundle, and the workflow files are never bundled at all. So this
 * file restates them.
 *
 * A restatement can drift from what it restates, so drift is made LOUD rather
 * than impossible: scripts/check-harness-map.js diffs this against vercel.json
 * and the workflow files and exits non-zero if they disagree. Run it in verify.
 *
 * kind:
 *   'inward'  — computes and stores. Gets a heartbeat, never a valve: a switch
 *               that can silently turn off your own senses is a liability.
 *   'outward' — sends something into the world on a timer. Gets both, because
 *               this is the only category where a veto means anything.
 */

var JOBS = [
  // ── Vercel crons ────────────────────────────────────────────────────────
  { job: 'limen-worker-ingest',        source: 'vercel', schedule: '*/15 * * * *',              path: '/api/limen-worker-ingest',        kind: 'inward',  role: 'relay',      note: 'Pulls the feed stream in and fans it to domains' },
  { job: 'limen-worker-snapshot',      source: 'vercel', schedule: '5,20,35,50 * * * *',        path: '/api/limen-worker-snapshot',      kind: 'inward',  role: 'relay',      note: 'Freezes the current state' },
  { job: 'limen-worker-score',         source: 'vercel', schedule: '3,33 * * * *',              path: '/api/limen-worker-score',         kind: 'inward',  role: 'proposal',   note: 'Scores companies against the kernel' },
  { job: 'limen-worker-stress-refresh',source: 'vercel', schedule: '0 * * * *',                 path: '/api/limen-worker-stress-refresh',kind: 'inward',  role: 'regulation', note: 'Recomputes the CISS stress field' },
  { job: 'brain-cognition-refresh',    source: 'vercel', schedule: '10,40 * * * *',             path: '/api/brain-cognition-refresh',    kind: 'inward',  role: 'regulation', note: 'Refreshes the cognition layer' },
  { job: 'autopilot',                  source: 'vercel', schedule: '7,37 * * * *',              path: '/api/autopilot',                  kind: 'outward', role: 'motor',      note: 'Runs the outbound cadence. Sends.' },
  { job: 'feed-record',                source: 'vercel', schedule: '12 * * * *',                path: '/api/feed-record',                kind: 'inward',  role: 'return',     note: 'Records realized values. Half of the reafference loop.' },
  { job: 'feed-resolve',               source: 'vercel', schedule: '42 * * * *',                path: '/api/feed-resolve?emit=1',        kind: 'inward',  role: 'return',     note: 'Grades past forecasts forward-only. The other half.' },
  { job: 'brain-weights-cron',         source: 'vercel', schedule: '47 * * * *',                path: '/api/brain-weights-cron',         kind: 'inward',  role: 'return',     note: 'Persists learning without a browser. Was the only hop that needed a human with a tab open.' },
  { job: 'social-cron',                source: 'vercel', schedule: '0 0,2,12,14,16,18,20,22 * * *', path: '/api/social-cron?post=1',     kind: 'outward', role: 'motor',      note: 'Posts publicly, eight times a day' },
  { job: 'subscriber-digest',          source: 'vercel', schedule: '30 13 * * *',               path: '/api/subscriber-digest',          kind: 'outward', role: 'motor',      note: 'Emails subscribers' },
  { job: 'hero-image',                 source: 'vercel', schedule: '*/5 * * * *',               path: '/api/hero-image',                 kind: 'inward',  role: 'relay',      note: 'Generates domain hero images. Decorative, not data.' },

  // ── GitHub Actions ──────────────────────────────────────────────────────
  // These run outside Vercel, so they cannot call lib/heartbeat directly. They
  // report by curling /api/harness?beat=<job>. A workflow that has not been
  // taught to do that simply shows as never-observed, which is accurate.
  { job: 'automail',        source: 'github', schedule: '45 11 * * *', path: '.github/workflows/automail.yml',        kind: 'outward', role: 'motor',    note: 'Sends mail' },
  { job: 'edgar',           source: 'github', schedule: '0 13 * * *',  path: '.github/workflows/edgar.yml',           kind: 'inward',  role: 'relay',    note: 'EDGAR 8-K pull' },
  { job: 'energy-distress', source: 'github', schedule: '0 16 * * 1',  path: '.github/workflows/energy-distress.yml', kind: 'inward',  role: 'relay',    note: 'EIA-860M retirements, weekly' },
  { job: 'immune-system',   source: 'github', schedule: '0 8 * * *',   path: '.github/workflows/immune-system.yml',   kind: 'inward',  role: 'regulation', note: 'Self-check pass' },
  { job: 'realauction',     source: 'github', schedule: '0 11 * * *',  path: '.github/workflows/realauction.yml',     kind: 'inward',  role: 'relay',    note: 'Tax-lien auction calendar' },
  { job: 'rescore-portals', source: 'github', schedule: '0 6 * * 1',   path: '.github/workflows/rescore-portals.yml', kind: 'inward',  role: 'proposal', note: 'Weekly portal rescore after new filings' },
  { job: 'warn',            source: 'github', schedule: '0 12 * * *',  path: '.github/workflows/warn.yml',            kind: 'inward',  role: 'relay',    note: 'WARN plant-closing notices' }
];

/**
 * The five structures the sun resolves into. Roles above map onto these.
 * The veto is deliberately its own node rather than a property of 'proposal':
 * an executive that could only ever agree with itself has no brake, which is
 * why the brain keeps the inhibitory stop path anatomically separate. Drawing
 * them as one node would misreport where the operator's authority actually is.
 */
var ROLES = {
  relay:      { label: 'Relay',      structure: 'Thalamus',                    does: 'Gates signal inward and fans it to domains' },
  regulation: { label: 'Regulation', structure: 'Hypothalamus',                does: 'Holds set-points, computes stress' },
  proposal:   { label: 'Proposal',   structure: 'Dorsolateral PFC',            does: 'Generates postures and rankings' },
  motor:      { label: 'Motor',      structure: 'Motor output',                does: 'Acts on the world' },
  veto:       { label: 'Veto',       structure: 'vmPFC + basal ganglia stop',  does: 'Cancels an action already in motion' },
  return:     { label: 'Return',     structure: 'Reafference',                 does: 'Senses the consequence and grades the call' }
};

/**
 * Which scheduled jobs actually cost money, verified 2026-07-27 by tracing each
 * handler for a paid provider (Anthropic / xAI / OpenAI) directly or through
 * lib/ai-orchestrator and lib/anthropic-call.
 *
 * The answer is ONE of eighteen. The whole regulation loop is deterministic and
 * free, which is the architecture rule holding. The exception is hero-image,
 * and it is also the single AI caller in the repo that does NOT consult
 * lib/ai-kill-switch: it is held back only by a hard counter (HERO_IMAGE_CAP,
 * default 40 generations ever). So "AI is off" has never been strictly true,
 * and the panel must not repeat that claim.
 *
 * Anything absent from this table is free. Absence is the safe default here
 * because a job wrongly labelled free would understate spend, and a job wrongly
 * labelled paid only causes a needless second look.
 */
var COST = {
  'hero-image': { cost: 'paid', provider: 'xAI', model: 'grok-imagine-image-quality',
                  killSwitch: false,
                  note: 'Generates domain hero images. Does NOT check lib/ai-kill-switch; capped by HERO_IMAGE_CAP only.' }
};

function costOf(job) {
  return COST[job] || { cost: 'free', provider: null, model: null, killSwitch: null, note: null };
}

function byJob(job) {
  for (var i = 0; i < JOBS.length; i++) if (JOBS[i].job === job) return JOBS[i];
  return null;
}
function names() { return JOBS.map(function (j) { return j.job; }); }
function outward() { return JOBS.filter(function (j) { return j.kind === 'outward'; }).map(function (j) { return j.job; }); }

module.exports = { JOBS: JOBS, ROLES: ROLES, COST: COST, costOf: costOf,
                   byJob: byJob, names: names, outward: outward };
