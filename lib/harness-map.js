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
 * kind describes function: inward, outward, outcome, or verification.
 * Heartbeat observation and effect control are separate fields. Some outward
 * sovereign lanes use their domain-local valves rather than the older global
 * heartbeat valve; the board must show that distinction instead of inventing
 * a global switch.
 */

var JOBS = [
  // ── Vercel crons ────────────────────────────────────────────────────────
  { job: 'limen-worker-ingest',        source: 'vercel', schedule: '*/15 * * * *',              path: '/api/limen-worker-ingest',        kind: 'inward',  role: 'relay',      note: 'Pulls the feed stream in and fans it to domains' },
  { job: 'limen-worker-snapshot',      source: 'vercel', schedule: '5,20,35,50 * * * *',        path: '/api/limen-worker-snapshot',      kind: 'inward',  role: 'relay',      note: 'Freezes the current state' },
  { job: 'limen-worker-score',         source: 'vercel', schedule: '3,33 * * * *',              path: '/api/limen-worker-score',         kind: 'inward',  role: 'proposal',   note: 'Scores companies against the kernel' },
  { job: 'limen-worker-stress-refresh',source: 'vercel', schedule: '0,30 * * * *',              path: '/api/limen-worker-stress-refresh',kind: 'inward',  role: 'regulation', note: 'Recomputes the CISS stress field' },
  { job: 'limen-worker-autoqueue',     source: 'vercel', schedule: '*/15 * * * *',             path: '/api/limen-worker-autoqueue',     kind: 'inward',  role: 'relay',      note: 'Admits sensed domain work into bounded queues' },
  { job: 'limen-worker-autofire',      source: 'vercel', schedule: '*/30 * * * *',             path: '/api/limen-worker-autofire',      kind: 'inward',  role: 'proposal',   note: 'Selects eligible internal work; external domain authority remains separately gated' },
  { job: 'limen-worker-sleep-cycle',   source: 'vercel', schedule: '0 * * * *',                path: '/api/limen-worker-sleep-cycle',   kind: 'inward',  role: 'regulation', note: 'Runs consolidation and recovery across domain state' },
  { job: 'brain-cognition-refresh',    source: 'vercel', schedule: '10,40 * * * *',             path: '/api/brain-cognition-refresh',    kind: 'inward',  role: 'regulation', note: 'Refreshes the cognition layer' },
  { job: 'domain-commercial-reflex',   source: 'vercel', schedule: '13,43 * * * *',             path: '/api/domain-commercial-reflex',   kind: 'inward',  role: 'proposal',   note: 'Turns each sovereign domain brain\'s own fresh stress and evidence into a separate write-ahead commercial intent; no external effect' },
  { job: 'domain-commercial-artifact-prep', source: 'vercel', schedule: '14,44 * * * *',        path: '/api/domain-commercial-artifact-prep', kind: 'inward', role: 'proposal', note: 'Prepares a durable source-linked customer artifact from each domain\'s own intent; title claims stay attributed and every outward effect remains inhibited' },
  { job: 'domain-video-manifest-prep', source: 'vercel', schedule: '18,48 * * * *', path: '/api/domain-video-manifest-prep', kind: 'inward', role: 'proposal', note: 'Converts only a domain-selected SHORT_VIDEO artifact into an exact attributed narration and abstract visual work order; rendering and upload remain inhibited' },
  { job: 'communication-social-capability', source: 'vercel', schedule: '*/2 * * * *', path: '/api/communication-social-capability', kind: 'outward', role: 'verification', note: 'One-shot bounded Bluesky create -> independent AppView read -> delete -> independent absence proof; never selects or publishes domain content' },
  { job: 'communication-video-cycle', source: 'vercel', schedule: '20,50 * * * *', path: '/api/communication-video-cycle', kind: 'inward', role: 'proposal', note: 'Requires separate current subject-domain and Communication decisions, then persists one exact B14 command; local rendering and every upload remain inhibited' },
  { job: 'domain-subscriber-fulfillment', source: 'vercel', schedule: '*/10 * * * *', path: '/api/domain-subscriber-fulfillment', kind: 'outward', role: 'efference', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Shared transport clock retries seven exact-domain paid fulfillment queues per cycle; each domain retains its own B10/B14, budget, valve and receipt namespace' },
  { job: 'domain-subscriber-outcome-observer', source: 'vercel', schedule: '1,11,21,31,41,51 * * * *', path: '/api/domain-subscriber-outcome-observer', kind: 'outcome', role: 'learning', note: 'Rotates independent Resend outcome reads across seven separately namespaced domain subscriber observers' },
  { job: 'subscriber-email-capability', source: 'vercel', schedule: '8,23,38,53 * * * *', path: '/api/subscriber-email-capability', kind: 'verification', role: 'verification', note: 'Verifies current subscriber-email provider capability without sending customer content' },
  { job: 'finance-paper-cycle',        source: 'vercel', schedule: '16,46 * * * *',             path: '/api/finance-paper-cycle',        kind: 'outward', role: 'motor',      note: 'Advances one gated Finance paper lane cycle against Tradier sandbox only' },
  { job: 'finance-position-owner', source: 'vercel', schedule: '26 * * * *', path: '/api/finance-position-owner', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'finance-local-switches-and-tradier-sandbox-gates', note: 'Reviews attributed open Tradier sandbox positions; live money is structurally excluded' },
  { job: 'economy-investment-cycle', source: 'vercel', schedule: '19,49 * * * *', path: '/api/economy-investment-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the Economy paper-investment lane against Tradier sandbox' },
  { job: 'energy-investment-cycle', source: 'vercel', schedule: '22,52 * * * *', path: '/api/energy-investment-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the Energy paper-investment lane against Tradier sandbox' },
  { job: 'technology-investment-cycle', source: 'vercel', schedule: '25,55 * * * *', path: '/api/technology-investment-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the Technology paper-investment lane against Tradier sandbox' },
  { job: 'autopilot',                  source: 'vercel', schedule: '7,37 * * * *',              path: '/api/autopilot',                  kind: 'outward', role: 'motor',      note: 'Runs the outbound cadence. Sends.' },
  { job: 'feed-record',                source: 'vercel', schedule: '12 * * * *',                path: '/api/feed-record',                kind: 'inward',  role: 'return',     note: 'Records realized values. Half of the reafference loop.' },
  { job: 'feed-resolve',               source: 'vercel', schedule: '42 * * * *',                path: '/api/feed-resolve?emit=1',        kind: 'inward',  role: 'return',     note: 'Grades past forecasts forward-only. The other half.' },
  { job: 'brain-weights-cron',         source: 'vercel', schedule: '47 * * * *',                path: '/api/brain-weights-cron',         kind: 'inward',  role: 'return',     note: 'Persists learning without a browser. Was the only hop needing a human with a tab open.' },
  { job: 'domain-text-read',           source: 'vercel', schedule: '25 */3 * * *',             path: '/api/domain-text-read?run=1',     kind: 'inward',  role: 'relay',      note: 'Reads the headlines we already fetch. PAID (Haiku), kill-switch gated, citations verified.' },
  { job: 'social-cron',                source: 'vercel', schedule: '*/15 * * * *', path: '/api/social-cron?post=1',     kind: 'outward', role: 'motor',      note: 'Evaluates the separately gated public social lane every fifteen minutes' },
  { job: 'communication-social-outcome-observer', source: 'vercel', schedule: '6,21,36,51 * * * *', path: '/api/communication-social-outcome-observer', kind: 'outcome', role: 'learning', note: 'Reads independent public social outcomes for the Communication-owned lane' },
  { job: 'subscriber-digest',          source: 'vercel', schedule: '30 * * * *',                path: '/api/subscriber-digest?motorDomain=legacy', kind: 'outward', role: 'motor', note: 'Emails subscribers only when exact-domain content changes' },
  { job: 'finance-subscriber-cycle', source: 'vercel', schedule: '34 * * * *', path: '/api/finance-subscriber-cycle', kind: 'outward', role: 'efference', heartbeat: 'wrap', effectControl: 'delegated-subscriber-digest-valve-plus-finance-local-gates', note: 'Finance-owned scheduled entrypoint into the guarded subscriber coordinator' },
  { job: 'religion-subscriber-outcome-observer', source: 'vercel', schedule: '41 13 * * *', path: '/api/religion-subscriber-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes Religion subscriber delivery outcomes' },
  { job: 'finance-subscriber-outcome-observer', source: 'vercel', schedule: '46 13 * * *', path: '/api/finance-subscriber-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes Finance subscriber delivery outcomes' },
  { job: 'religion-revenue-fulfillment', source: 'vercel', schedule: '*/10 * * * *', path: '/api/religion-revenue-fulfillment', kind: 'outward', role: 'efference', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Fulfills exact Religion paid entitlements under local budget and motor gates' },
  { job: 'finance-revenue-fulfillment', source: 'vercel', schedule: '5,15,25,35,45,55 * * * *', path: '/api/finance-revenue-fulfillment', kind: 'outward', role: 'efference', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Fulfills exact Finance paid entitlements under local budget and motor gates' },
  { job: 'culture-revenue-fulfillment', source: 'vercel', schedule: '2,22,42 * * * *', path: '/api/culture-revenue-fulfillment', kind: 'outward', role: 'efference', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Fulfills exact Culture paid entitlements under local budget and motor gates' },
  { job: 'education-revenue-fulfillment', source: 'vercel', schedule: '3,23,43 * * * *', path: '/api/education-revenue-fulfillment', kind: 'outward', role: 'efference', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Fulfills exact Education paid entitlements under local budget and motor gates' },
  { job: 'communication-revenue-fulfillment', source: 'vercel', schedule: '4,24,44 * * * *', path: '/api/communication-revenue-fulfillment', kind: 'outward', role: 'efference', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Fulfills exact Communication paid entitlements under local budget and motor gates' },
  { job: 'medicine-revenue-fulfillment', source: 'vercel', schedule: '6,26,46 * * * *', path: '/api/medicine-revenue-fulfillment', kind: 'outward', role: 'efference', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Fulfills exact Medicine paid entitlements under local budget and motor gates' },
  { job: 'culture-subscriber-outcome-observer', source: 'vercel', schedule: '12 * * * *', path: '/api/culture-subscriber-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes Culture subscriber delivery outcomes' },
  { job: 'education-subscriber-outcome-observer', source: 'vercel', schedule: '22 * * * *', path: '/api/education-subscriber-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes Education subscriber delivery outcomes' },
  { job: 'communication-subscriber-outcome-observer', source: 'vercel', schedule: '32 * * * *', path: '/api/communication-subscriber-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes Communication subscriber delivery outcomes' },
  { job: 'medicine-subscriber-outcome-observer', source: 'vercel', schedule: '42 * * * *', path: '/api/medicine-subscriber-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes Medicine subscriber delivery outcomes' },
  { job: 'law-automail-outcome-observer', source: 'vercel', schedule: '17 14 * * *', path: '/api/law-automail-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes independent Law mail outcomes' },
  { job: 'intelligence-autopilot-outcome-observer', source: 'vercel', schedule: '12,42 * * * *', path: '/api/intelligence-autopilot-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes independent Intelligence autopilot outcomes' },
  { job: 'intelligence-autopilot-capability', source: 'vercel', schedule: '15,45 * * * *', path: '/api/intelligence-autopilot-capability', kind: 'verification', role: 'verification', note: 'Verifies the Intelligence autopilot provider capability lease' },
  { job: 'agriculture-homestead-cycle', source: 'vercel', schedule: '37 14 * * *', path: '/api/agriculture-homestead-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the bounded Agriculture homestead service-request lane' },
  { job: 'industry-crm-cycle', source: 'vercel', schedule: '47 14 * * *', path: '/api/industry-crm-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the bounded Industry CRM outreach lane' },
  { job: 'industry-crm-outcome-observer', source: 'vercel', schedule: '57 14 * * *', path: '/api/industry-crm-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes Industry CRM outcomes' },
  { job: 'defense-publication-cycle', source: 'vercel', schedule: '7 15 * * *', path: '/api/defense-publication-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the bounded Defense publication lane' },
  { job: 'defense-publication-outcome-observer', source: 'vercel', schedule: '23 * * * *', path: '/api/defense-publication-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes independent Defense publication outcomes' },
  { job: 'governance-publication-cycle', source: 'vercel', schedule: '17 15 * * *', path: '/api/governance-publication-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the bounded Governance publication lane' },
  { job: 'governance-publication-outcome-observer', source: 'vercel', schedule: '33 * * * *', path: '/api/governance-publication-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes independent Governance publication outcomes' },
  { job: 'infrastructure-real-estate-cycle', source: 'vercel', schedule: '27 15 * * *', path: '/api/infrastructure-real-estate-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the bounded Infrastructure real-estate outreach lane' },
  { job: 'population-real-estate-cycle', source: 'vercel', schedule: '37 15 * * *', path: '/api/population-real-estate-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the bounded Population real-estate outreach lane' },
  { job: 'trade-auction-cycle', source: 'vercel', schedule: '47 15 * * *', path: '/api/trade-auction-cycle', kind: 'outward', role: 'motor', heartbeat: 'wrap', effectControl: 'domain-local-valves', note: 'Runs the bounded Trade auction listing lane' },
  { job: 'trade-auction-outcome-observer', source: 'vercel', schedule: '53 * * * *', path: '/api/trade-auction-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes independent Trade auction outcomes' },
  { job: 'hero-image',                 source: 'vercel', schedule: '*/5 * * * *',               path: '/api/hero-image',                 kind: 'outward',  role: 'motor', heartbeat: 'wrap', effectControl: 'culture-local-valve-ai-kill-and-spend-meter', note: 'Calls xAI to generate a bounded Culture-owned hero asset under local controls' },
  { job: 'culture-hero-outcome-observer', source: 'vercel', schedule: '11 * * * *', path: '/api/culture-hero-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes Culture hero-asset outcomes' },
  { job: 'orb-meeting-cron',           source: 'vercel', schedule: '18 */6 * * *',              path: '/api/orb-meeting-cron?run=1',     kind: 'inward',  role: 'proposal',   note: 'Builds the periodic civilization meeting artifact' },
  { job: 'brain-shadow',               source: 'vercel', schedule: '27 * * * *',                path: '/api/brain-shadow?run=1',         kind: 'inward',  role: 'regulation', note: 'Runs the production shadow brain cycle' },
  { job: 'limen-outcome-observer',     source: 'vercel', schedule: '54 * * * *',                path: '/api/limen-outcome-observer',     kind: 'inward',  role: 'return',     note: 'Observes research/publication outcomes without inventing progress' },
  { job: 'limen-investment-outcome-observer', source: 'vercel', schedule: '57 * * * *',         path: '/api/limen-investment-outcome-observer', kind: 'inward', role: 'return', note: 'Resolves independent paper-investment outcomes at due horizons' },
  { job: 'economy-investment-outcome-observer', source: 'vercel', schedule: '2 * * * *', path: '/api/economy-investment-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes independent Economy paper-investment outcomes' },
  { job: 'energy-investment-outcome-observer', source: 'vercel', schedule: '5 * * * *', path: '/api/energy-investment-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes independent Energy paper-investment outcomes' },
  { job: 'technology-investment-outcome-observer', source: 'vercel', schedule: '8 * * * *', path: '/api/technology-investment-outcome-observer', kind: 'outcome', role: 'learning', note: 'Observes independent Technology paper-investment outcomes' },
  { job: 'limen-research-evaluation-observer', source: 'vercel', schedule: '56 * * * *',        path: '/api/limen-research-evaluation-observer', kind: 'inward', role: 'return', note: 'Returns independently supplied Science/Medicine evaluations to learning' },
  { job: 'finance-motor-capability',   source: 'vercel', schedule: '51 * * * *',                path: '/api/finance-motor-capability',   kind: 'inward',  role: 'return',     note: 'Promotes only independently verified Finance executor and outcome evidence' },
  { job: 'relay-autonomous-scraper', source: 'vercel', schedule: '5,35 * * * *', path: '/api/relay-autonomous-scraper?run=1', kind: 'outward', role: 'motor', heartbeat: 'none', heartbeatException: 'relay-firewall-forbids-foreign-subsystem-import', effectControl: 'cron-auth-relay-budget-and-purchase-queue-controls', note: 'Runs the Relay paid-search/image and purchase-queue cycle; common heartbeat and global AI control remain explicit audit gaps' },

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
  { job: 'warn',            source: 'github', schedule: '0 12 * * *',  path: '.github/workflows/warn.yml',            kind: 'inward',  role: 'relay',    note: 'WARN plant-closing notices' },
  { job: 'repository-check',source: 'github', schedule: '17 6 * * 1',  path: '.github/workflows/repository-check.yml',kind: 'verification', role: 'verification', note: 'Weekly repository parser, boot, and unit-suite bit-rot tripwire' }
];

// `kind` describes world effect. `heartbeat` describes observation wiring.
// They are not the same control: newer sovereign domain lanes may act outward
// while retaining their own local valve/budget/receipt boundary. Only jobs
// whose effectControl is global-heartbeat-valve appear in heartbeat.OUTWARD.
JOBS = JOBS.map(function (job) {
  return Object.assign({
    heartbeat: job.kind === 'outward' ? 'guard' : 'wrap',
    effectControl: job.kind === 'outward' ? 'global-heartbeat-valve' : 'none'
  }, job);
});

/**
 * The functional structures the sun resolves into. Roles above map onto these.
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
  efference:  { label: 'Efference',  structure: 'Premotor + motor tract',       does: 'Carries an admitted domain command to its bounded effect adapter' },
  verification:{ label: 'Verification', structure: 'Error-monitoring cortex',   does: 'Checks whether a claimed capability or invariant is actually present' },
  learning:   { label: 'Learning',   structure: 'Reafference + plasticity',     does: 'Observes outcomes and updates only the owning lane evidence' },
  veto:       { label: 'Veto',       structure: 'vmPFC + basal ganglia stop',  does: 'Cancels an action already in motion' },
  return:     { label: 'Return',     structure: 'Reafference',                 does: 'Senses the consequence and grades the call' }
};

/**
 * Which scheduled jobs actually cost money, re-measured 2026-09-24 by tracing each
 * handler for a paid provider (Anthropic / xAI / OpenAI) directly or through
 * lib/ai-orchestrator and lib/anthropic-call.
 *
 * Regulation remains deterministic. Paid cognition/effect jobs are named here
 * so the board cannot mistake an omitted row for a free call. Common-control
 * gaps remain visible instead of being converted into an implied pass.
 *
 * Anything absent from this table is free. Absence is the safe default here
 * because a job wrongly labelled free would understate spend, and a job wrongly
 * labelled paid only causes a needless second look.
 */
var COST = {
  'domain-text-read': { cost: 'paid', provider: 'Anthropic', model: 'configured Haiku',
                  killSwitch: true, note: 'Routes through anthropic-call, the shared kill switch and spend meter.' },
  'hero-image': { cost: 'paid', provider: 'xAI', model: 'grok-imagine-image-quality',
                  killSwitch: true,
                  note: 'Routes through the shared AI kill switch and spend meter plus Culture-local controls.' },
  'finance-position-owner': { cost: 'paid', provider: 'Anthropic or xAI + Tradier sandbox', model: 'configured Finance provider',
                  killSwitch: false, note: 'Finance-local switches apply; common atomic AI reservation remains unverified.' },
  'relay-autonomous-scraper': { cost: 'paid', provider: 'xAI + search providers', model: 'configured Relay providers',
                  killSwitch: false, note: 'Cron/operator auth and Relay budgets apply; common AI kill/meter coverage remains unverified.' }
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
function globallyValved() { return JOBS.filter(function (j) { return j.effectControl === 'global-heartbeat-valve'; }).map(function (j) { return j.job; }); }

module.exports = { JOBS: JOBS, ROLES: ROLES, COST: COST, costOf: costOf,
                   byJob: byJob, names: names, outward: outward, globallyValved: globallyValved };
