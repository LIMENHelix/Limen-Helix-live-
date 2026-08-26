/**
 * api/[...route].js — Hono single-entry router (Node runtime, native req/res).
 *
 * WHY: collapse ~57 Vercel functions into ONE, so includeFiles bundles once
 * (≈1.6GB/deploy → one bundle). Vercel forwards every /api/* path that has NO
 * dedicated static function file to this catch-all. Static files take precedence
 * (api/<name>.js while it still exists, and the Python api/limen.py / api/helix.py
 * / api/ping.py), so a route flips to Hono ONLY once its static file is removed —
 * which makes the migration fully incremental and reversible (git mv back).
 *
 * HOW: we use Hono's RegExpRouter purely as the path matcher and invoke each
 * legacy Vercel-style handler with the REAL Node (req, res). No Fetch shim — so
 * raw request bodies (Stripe HMAC, biosensor, lead), res.setHeader/status/json,
 * and req.on('data') all behave exactly as they did as standalone functions.
 *
 * Each handler is required STATICALLY below so Vercel's dependency tracer bundles
 * it into this function. Adding a route = git mv api/<name>.js handlers/<name>.js
 * + one line in HANDLERS.
 */
const { RegExpRouter } = require('hono/router/reg-exp-router');
const CivilizationValve = require('../lib/civilization-valve-control');
const CivilizationValveRegistry = require('../lib/civilization-valve-registry');

// Bumped each migration commit so a deploy is probeable: any unknown /api/* path
// returns this in the miss JSON (curl /api/__probe__ | grep the tag).
const BUILD = 'phase-9';

// name → handler module. Static requires so the tracer bundles them.
const HANDLERS = {
  'admin-auth': require('../handlers/admin-auth'),
  'sales': require('../handlers/sales'),
  'leadgen': require('../handlers/leadgen'),
  'crm': require('../handlers/crm'),
  'spine': require('../handlers/spine'),
  'autopilot': require('../handlers/autopilot'),
  'relay-margin': require('../handlers/relay-margin'),
  'relay-checkout': require('../handlers/relay-checkout'),
  'relay-marketplace': require('../handlers/relay-marketplace'),
  'relay-marketplace-checkout': require('../handlers/relay-marketplace-checkout'),
  'relay-stripe-webhook': require('../handlers/relay-stripe-webhook'),
  'relay-csv-import': require('../handlers/relay-csv-import'),
  'relay-ebay-scraper': require('../handlers/relay-ebay-scraper'),
  'relay-marketplace-scraper': require('../handlers/relay-marketplace-scraper'),
  'relay-vinted-scraper': require('../handlers/relay-vinted-scraper'),
  'wave-radar': require('../handlers/wave-radar'),
  'music-feed': require('../handlers/music-feed'),
  'youtube-signal': require('../handlers/youtube-signal'),
  'playbook': require('../handlers/playbook'),
  'ventures': require('../handlers/ventures'),
  'ai-switch': require('../handlers/ai-switch'),
  'civilization-valves': require('../handlers/civilization-valves'),
  'civil-radar': require('../handlers/civil-radar'),
  'civil-rfps': require('../handlers/civil-rfps'),
  'infra-entry': require('../handlers/infra-entry'),
  'infrastructure-news': require('../handlers/infrastructure-news'),
  'infrastructure-markets': require('../handlers/infrastructure-markets'),
  'music-coach': require('../handlers/music-coach'),
  'release-engine': require('../handlers/release-engine'),
  'hook-studio': require('../handlers/hook-studio'),
  'site-request': require('../handlers/site-request'),
  'api-keys-config': require('../handlers/api-keys-config'),
  'asset-quote': require('../handlers/asset-quote'),
  'biosensor-state': require('../handlers/biosensor-state'),
  'brain-cognition': require('../handlers/brain-cognition'),
  'brain-shadow': require('../handlers/brain-shadow'),
  'finance-preview': require('../handlers/finance-preview'),
  'finance-paper-admission': require('../handlers/finance-paper-admission'),
  'brain-cognition-refresh': require('../handlers/brain-cognition-refresh'),
  'limen-civilization-handoff': require('../handlers/limen-civilization-handoff'),
  'capital-engine': require('../handlers/capital-engine'),
  'critique-artifact': require('../handlers/critique-artifact'),
  'cron-rebuild-engine-outputs': require('../handlers/cron-rebuild-engine-outputs'),
  'cron-repair-held': require('../handlers/cron-repair-held'),
  'defense-signals': require('../handlers/defense-signals'),
  'energy-entry': require('../handlers/energy-entry'),
  'energy-markets': require('../handlers/energy-markets'),
  'energy-news': require('../handlers/energy-news'),
  'energy-agent': require('../handlers/energy-agent'),
  'domain-agent': require('../handlers/domain-agent'),
  'master-agent': require('../handlers/master-agent'),
  'culture-markets': require('../handlers/culture-markets'),
  'culture-news': require('../handlers/culture-news'),
  'finance-markets': require('../handlers/finance-markets'),
  'economy-markets': require('../handlers/economy-markets'),
  'technology-markets': require('../handlers/technology-markets'),
  'defense-markets': require('../handlers/defense-markets'),
  'intelligence-markets': require('../handlers/intelligence-markets'),
  'trade-markets': require('../handlers/trade-markets'),
  'industry-markets': require('../handlers/industry-markets'),
  'environment-markets': require('../handlers/environment-markets'),
  'env-live': require('../handlers/env-live'),
  'population-live': require('../handlers/population-live'),
  'economy-live': require('../handlers/economy-live'),
  'law-live': require('../handlers/law-live'),
  'finance-live': require('../handlers/finance-live'),
  'governance-live': require('../handlers/governance-live'),
  'infrastructure-live': require('../handlers/infrastructure-live'),
  'defense-live': require('../handlers/defense-live'),
  'science-live': require('../handlers/science-live'),
  'trade-live': require('../handlers/trade-live'),
  'industry-live': require('../handlers/industry-live'),
  'technology-live': require('../handlers/technology-live'),
  'intelligence-live': require('../handlers/intelligence-live'),
  'education-live': require('../handlers/education-live'),
  'communication-live': require('../handlers/communication-live'),
  'religion-live': require('../handlers/religion-live'),
  'governance-markets': require('../handlers/governance-markets'),
  'agriculture-markets': require('../handlers/agriculture-markets'),
  'agriculture-tools': require('../handlers/agriculture-tools'),
  'agriculture-homestead-cycle': require('../handlers/agriculture-homestead-cycle'),
  'agriculture-homestead-inbound': require('../handlers/agriculture-homestead-inbound'),
  'agriculture-homestead-status': require('../handlers/agriculture-homestead-status'),
  'agriculture-homestead-recovery': require('../handlers/agriculture-homestead-recovery'),
  'medicine-tools': require('../handlers/medicine-tools'),
  'environment-tools': require('../handlers/environment-tools'),
  'economy-tools': require('../handlers/economy-tools'),
  'economy-investment-cycle': require('../handlers/economy-investment-cycle'),
  'economy-investment-outcome-observer': require('../handlers/economy-investment-outcome-observer'),
  'economy-investment-recovery': require('../handlers/economy-investment-recovery'),
  'economy-investment-status': require('../handlers/economy-investment-status'),
  'energy-investment-cycle': require('../handlers/energy-investment-cycle'),
  'energy-investment-outcome-observer': require('../handlers/energy-investment-outcome-observer'),
  'energy-investment-recovery': require('../handlers/energy-investment-recovery'),
  'energy-investment-status': require('../handlers/energy-investment-status'),
  'technology-investment-cycle': require('../handlers/technology-investment-cycle'),
  'technology-investment-outcome-observer': require('../handlers/technology-investment-outcome-observer'),
  'technology-investment-recovery': require('../handlers/technology-investment-recovery'),
  'technology-investment-status': require('../handlers/technology-investment-status'),
  'education-tools': require('../handlers/education-tools'),
  'governance-tools': require('../handlers/governance-tools'),
  'defense-tools': require('../handlers/defense-tools'),
  'intelligence-tools': require('../handlers/intelligence-tools'),
  'science-tools': require('../handlers/science-tools'),
  'population-tools': require('../handlers/population-tools'),
  'trade-tools': require('../handlers/trade-tools'),
  'social-status': require('../handlers/social-status'),
  'social-cron': require('../handlers/social-cron'),
  'communication-social-decision-status': require('../handlers/communication-social-decision-status'),
  'communication-social-outcome-observer': require('../handlers/communication-social-outcome-observer'),
  'communication-social-recovery': require('../handlers/communication-social-recovery'),
  'checkout': require('../handlers/checkout'),
  'stripe-webhook': require('../handlers/stripe-webhook'),
  'subscriber-digest': require('../handlers/subscriber-digest'),
  'finance-subscriber-cycle': require('../handlers/finance-subscriber-cycle'),
  'finance-subscriber-outcome-observer': require('../handlers/finance-subscriber-outcome-observer'),
  'religion-subscriber-decision-status': require('../handlers/religion-subscriber-decision-status'),
  'religion-subscriber-outcome-observer': require('../handlers/religion-subscriber-outcome-observer'),
  'religion-subscriber-recovery': require('../handlers/religion-subscriber-recovery'),
  'religion-revenue-fulfillment': require('../handlers/religion-revenue-fulfillment'),
  'law-automail-decision-status': require('../handlers/law-automail-decision-status'),
  'law-automail-outcome-observer': require('../handlers/law-automail-outcome-observer'),
  'law-automail-recovery': require('../handlers/law-automail-recovery'),
  'intelligence-autopilot-decision-status': require('../handlers/intelligence-autopilot-decision-status'),
  'intelligence-autopilot-outcome-observer': require('../handlers/intelligence-autopilot-outcome-observer'),
  'intelligence-autopilot-recovery': require('../handlers/intelligence-autopilot-recovery'),
  'subscribers': require('../handlers/subscribers'),
  'hero-image': require('../handlers/hero-image'),
  'culture-hero-decision-status': require('../handlers/culture-hero-decision-status'),
  'culture-hero-outcome-observer': require('../handlers/culture-hero-outcome-observer'),
  'culture-hero-recovery': require('../handlers/culture-hero-recovery'),
  'harness': require('../handlers/harness'),
  'finance-tools': require('../handlers/finance-tools'),
  'technology-tools': require('../handlers/technology-tools'),
  'industry-tools': require('../handlers/industry-tools'),
  'law-tools': require('../handlers/law-tools'),
  'religion-tools': require('../handlers/religion-tools'),
  'communication-markets': require('../handlers/communication-markets'),
  'medicine-markets': require('../handlers/medicine-markets'),
  'education-markets': require('../handlers/education-markets'),
  'population-markets': require('../handlers/population-markets'),
  'science-markets': require('../handlers/science-markets'),
  'law-markets': require('../handlers/law-markets'),
  'religion-markets': require('../handlers/religion-markets'),
  'brain-signals': require('../handlers/brain-signals'),
  'authority-caseload': require('../handlers/authority-caseload'),
  'authority-evidence': require('../handlers/authority-evidence'),
  'authority-wjp': require('../handlers/authority-wjp'),
  'enrich-portal-claude': require('../handlers/enrich-portal-claude'),
  'expand-artifact': require('../handlers/expand-artifact'),
  'expand-artifact-claude': require('../handlers/expand-artifact-claude'),
  'fleet': require('../handlers/fleet'),
  'gazette': require('../handlers/gazette'),
  'opportunities': require('../handlers/opportunities'),
  'orb-voice': require('../handlers/orb-voice'),
  'orb-ledger': require('../handlers/orb-ledger'),
  'orb-meeting-cron': require('../handlers/orb-meeting-cron'),
  'domain-snapshot': require('../handlers/domain-snapshot'),
  'domain-snapshot-debug': require('../handlers/domain-snapshot-debug'),
  'feed-status': require('../handlers/feed-status'),
  'fetch-doc': require('../handlers/fetch-doc'),
  'fetch-portal': require('../handlers/fetch-portal'),
  'kernel-experiment': require('../handlers/kernel-experiment'),
  'lead': require('../handlers/lead'),
  'fitness-program': require('../handlers/fitness-program'),
  'fitness-program-feed': require('../handlers/fitness-program-feed'),
  'fitness-evidence': require('../handlers/fitness-evidence'),
  'deal-engine': require('../handlers/deal-engine'),
  'homestead': require('../handlers/homestead'),
  'homestead-automail': require('../handlers/homestead-automail'),
  'homestead-status': require('../handlers/homestead-status'),
  'homestead-validation': require('../handlers/homestead-validation'),
  'realauction-ingest': require('../handlers/realauction-ingest'),
  'industry': require('../handlers/industry'),
  'industry-ingest': require('../handlers/industry-ingest'),
  'industry-status': require('../handlers/industry-status'),
  'industry-crm-cycle': require('../handlers/industry-crm-cycle'),
  'industry-crm-outcome-observer': require('../handlers/industry-crm-outcome-observer'),
  'industry-crm-status': require('../handlers/industry-crm-status'),
  'industry-crm-recovery': require('../handlers/industry-crm-recovery'),
  'defense-publication-cycle': require('../handlers/defense-publication-cycle'),
  'defense-publication-public': require('../handlers/defense-publication-public'),
  'defense-publication-engagement': require('../handlers/defense-publication-engagement'),
  'defense-publication-outcome-observer': require('../handlers/defense-publication-outcome-observer'),
  'defense-publication-recovery': require('../handlers/defense-publication-recovery'),
  'defense-publication-status': require('../handlers/defense-publication-status'),
  'governance-publication-cycle': require('../handlers/governance-publication-cycle'),
  'governance-publication-public': require('../handlers/governance-publication-public'),
  'governance-publication-engagement': require('../handlers/governance-publication-engagement'),
  'governance-publication-outcome-observer': require('../handlers/governance-publication-outcome-observer'),
  'governance-publication-recovery': require('../handlers/governance-publication-recovery'),
  'governance-publication-status': require('../handlers/governance-publication-status'),
  'infrastructure-real-estate-cycle': require('../handlers/infrastructure-real-estate-cycle'),
  'infrastructure-real-estate-inbound': require('../handlers/infrastructure-real-estate-inbound'),
  'infrastructure-real-estate-recovery': require('../handlers/infrastructure-real-estate-recovery'),
  'infrastructure-real-estate-status': require('../handlers/infrastructure-real-estate-status'),
  'population-real-estate-cycle': require('../handlers/population-real-estate-cycle'),
  'population-real-estate-inbound': require('../handlers/population-real-estate-inbound'),
  'population-real-estate-recovery': require('../handlers/population-real-estate-recovery'),
  'population-real-estate-status': require('../handlers/population-real-estate-status'),
  'trade-auction-cycle': require('../handlers/trade-auction-cycle'),
  'trade-auction-outcome-observer': require('../handlers/trade-auction-outcome-observer'),
  'trade-auction-recovery': require('../handlers/trade-auction-recovery'),
  'trade-auction-status': require('../handlers/trade-auction-status'),
  'finance-distress': require('../handlers/finance-distress'),
  'finance-distress-ingest': require('../handlers/finance-distress-ingest'),
  'finance-distress-status': require('../handlers/finance-distress-status'),
  'energy-distress': require('../handlers/energy-distress'),
  'energy-distress-ingest': require('../handlers/energy-distress-ingest'),
  'energy-distress-status': require('../handlers/energy-distress-status'),
  'skip-trace': require('../handlers/skip-trace'),
  'limen-autofire-log': require('../handlers/limen-autofire-log'),
  'limen-autoqueue': require('../handlers/limen-autoqueue'),
  'limen-changelog': require('../handlers/limen-changelog'),
  'limen-drafts': require('../handlers/limen-drafts'),
  'limen-engine-output': require('../handlers/limen-engine-output'),
  'limen-execution': require('../handlers/limen-execution'),
  'limen-health': require('../handlers/limen-health'),
  'limen-ingest': require('../handlers/limen-ingest'),
  'limen-worker-ingest': require('../handlers/limen-worker-ingest'),
  'limen-worker-snapshot': require('../handlers/limen-worker-snapshot'),
  'limen-worker-score': require('../handlers/limen-worker-score'),
  'system-gain': require('../handlers/system-gain'),
  'limen-worker-stress-refresh': require('../handlers/limen-worker-stress-refresh'),
  'feed-record': require('../handlers/feed-record'),
  'feed-resolve': require('../handlers/feed-resolve'),
  'feed-consolidate': require('../handlers/feed-consolidate'),
  'audit-ledger': require('../handlers/audit-ledger'),
  'transfer-record': require('../handlers/transfer-record'),
  'memory-promote': require('../handlers/memory-promote'),
  'brain-weights': require('../handlers/brain-weights'),
  'brain-weights-cron': require('../handlers/brain-weights-cron'),
  'domain-text-read': require('../handlers/domain-text-read'),
  'limen-intents': require('../handlers/limen-intents'),
  'limen-iteration': require('../handlers/limen-iteration'),
  'limen-operator-calibration': require('../handlers/limen-operator-calibration'),
  'limen-outcome': require('../handlers/limen-outcome'),
  'limen-outcome-observer': require('../handlers/limen-outcome-observer'),
  'limen-investment-outcome-observer': require('../handlers/limen-investment-outcome-observer'),
  'research-evaluation-intake': require('../handlers/research-evaluation-intake'),
  'limen-research-evaluation-observer': require('../handlers/limen-research-evaluation-observer'),
  'product-domain-learning-state': require('../handlers/product-domain-learning-state'),
  'research-paper-developmental-status': require('../handlers/research-paper-developmental-status'),
  'limen-phase-transitions': require('../handlers/limen-phase-transitions'),
  'limen-reciprocity-prose-rewrite': require('../handlers/limen-reciprocity-prose-rewrite'),
  'limen-self-pulse': require('../handlers/limen-self-pulse'),
  'limen-snapshot': require('../handlers/limen-snapshot'),
  'grounded-stress-history': require('../handlers/grounded-stress-history'),
  'limen-stress-propagation': require('../handlers/limen-stress-propagation'),
  'limen-stress-slim': require('../handlers/limen-stress-slim'),
  'limen-worker-autofire': require('../handlers/limen-worker-autofire'),
  'limen-worker-autoqueue': require('../handlers/limen-worker-autoqueue'),
  'limen-worker-sleep-cycle': require('../handlers/limen-worker-sleep-cycle'),
  'market-snapshot': require('../handlers/market-snapshot'),
  'operator-action': require('../handlers/operator-action'),
  'paper-orders': require('../handlers/paper-orders'),
  'paper-positions': require('../handlers/paper-positions'),
  'paper-trade': require('../handlers/paper-trade'),
  'tradier-sandbox': require('../handlers/tradier-sandbox'),
  'tradier-b14': require('../handlers/tradier-b14'),
  'finance-b14': require('../handlers/finance-b14'),
  'finance-motor-capability': require('../handlers/finance-motor-capability'),
  'finance-paper-executor': require('../handlers/finance-paper-executor'),
  'finance-sandbox-commissioning': require('../handlers/finance-sandbox-commissioning'),
  'finance-paper-cycle': require('../handlers/finance-paper-cycle'),
  'finance-paper-status': require('../handlers/finance-paper-status'),
  'finance-trade-decision': require('../handlers/finance-trade-decision'),
  'finance-position-owner': require('../handlers/finance-position-owner'),
  'pattern-proposal': require('../handlers/pattern-proposal'),
  'print-from-pattern': require('../handlers/print-from-pattern'),
  'redis-diag': require('../handlers/redis-diag'),
  'trigger-pattern-author': require('../handlers/trigger-pattern-author'),
};

const router = new RegExpRouter();
for (const name of Object.keys(HANDLERS)) router.add('ALL', '/api/' + name, name);

// CJS handlers export the function directly; an ESM-authored one would land on .default.
function resolve(h) { return (h && typeof h !== 'function' && h.default) ? h.default : h; }

// These exact POST contracts only validate and durably enqueue an owned work
// item. Their GET/cron side performs the outward effect. No other mapped POST
// receives this preparation exception: Autopilot and Law mail, for example,
// can execute externally from POST and must cross the valve.
const PREPARATION_POST_ROUTES = new Set([
  'agriculture-homestead-cycle', 'economy-investment-cycle',
  'energy-investment-cycle', 'infrastructure-real-estate-cycle',
  'population-real-estate-cycle', 'technology-investment-cycle',
  'trade-auction-cycle'
]);

function runtimeValveHold(name, req) {
  const valveId = CivilizationValveRegistry.forRoute(name);
  if (!valveId) return null;
  const method = String(req.method || 'GET').toUpperCase();
  // POST on these exact cycle routes only queues exact work; it does not create
  // the outward effect. Keep preparation available while the efferent valve is
  // closed. Every other method/route combination remains inhibited.
  if (method === 'POST' && PREPARATION_POST_ROUTES.has(name)) return null;
  return CivilizationValve.authorize(valveId).then(function (result) {
    return result.allowed ? null : result;
  });
}

module.exports = async function honoEntry(req, res) {
  let pathname = req.url || '';
  try { pathname = new URL(req.url, 'http://h').pathname; } catch (e) {}
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  let name = null;
  try {
    const m = router.match(req.method || 'GET', pathname);
    if (m && m[0] && m[0][0]) name = m[0][0][0];
  } catch (e) {}

  const handler = name && HANDLERS[name];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'route not handled by Hono entry', path: pathname, build: BUILD }));
  }
  const heldCheck = runtimeValveHold(name, req);
  // Preserve synchronous dispatch for every route outside the efferent valve
  // topology. Only a mapped outward-effect route crosses the durable async gate.
  const held = heldCheck && typeof heldCheck.then === 'function'
    ? await heldCheck
    : heldCheck;
  if (held) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({
      ok: true,
      status: 'HELD',
      reason: held.reason,
      valveId: held.valveId,
      valveReceiptId: held.receipt && held.receipt.receiptId || null,
      externalEffectExecuted: false,
      observersRemainOpen: true,
      recoveryRemainsOpen: true
    }));
  }
  return resolve(handler)(req, res);
};
