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

// Bumped each migration commit so a deploy is probeable: any unknown /api/* path
// returns this in the miss JSON (curl /api/__probe__ | grep the tag).
const BUILD = 'phase-5';

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
  'wave-radar': require('../handlers/wave-radar'),
  'music-feed': require('../handlers/music-feed'),
  'youtube-signal': require('../handlers/youtube-signal'),
  'playbook': require('../handlers/playbook'),
  'ventures': require('../handlers/ventures'),
  'ai-switch': require('../handlers/ai-switch'),
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
  'brain-cognition-refresh': require('../handlers/brain-cognition-refresh'),
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
  'medicine-tools': require('../handlers/medicine-tools'),
  'environment-tools': require('../handlers/environment-tools'),
  'economy-tools': require('../handlers/economy-tools'),
  'education-tools': require('../handlers/education-tools'),
  'governance-tools': require('../handlers/governance-tools'),
  'defense-tools': require('../handlers/defense-tools'),
  'intelligence-tools': require('../handlers/intelligence-tools'),
  'science-tools': require('../handlers/science-tools'),
  'population-tools': require('../handlers/population-tools'),
  'trade-tools': require('../handlers/trade-tools'),
  'social-status': require('../handlers/social-status'),
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
  'enrich-portal-claude': require('../handlers/enrich-portal-claude'),
  'expand-artifact': require('../handlers/expand-artifact'),
  'expand-artifact-claude': require('../handlers/expand-artifact-claude'),
  'fleet': require('../handlers/fleet'),
  'opportunities': require('../handlers/opportunities'),
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
  'limen-intents': require('../handlers/limen-intents'),
  'limen-iteration': require('../handlers/limen-iteration'),
  'limen-operator-calibration': require('../handlers/limen-operator-calibration'),
  'limen-outcome': require('../handlers/limen-outcome'),
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
  'pattern-proposal': require('../handlers/pattern-proposal'),
  'print-from-pattern': require('../handlers/print-from-pattern'),
  'redis-diag': require('../handlers/redis-diag'),
  'trigger-pattern-author': require('../handlers/trigger-pattern-author'),
};

const router = new RegExpRouter();
for (const name of Object.keys(HANDLERS)) router.add('ALL', '/api/' + name, name);

// CJS handlers export the function directly; an ESM-authored one would land on .default.
function resolve(h) { return (h && typeof h !== 'function' && h.default) ? h.default : h; }

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
  return resolve(handler)(req, res);
};
