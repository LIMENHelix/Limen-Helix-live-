/**
 * test-proposal-retention.cjs — verify the approved/rejected archive fix against
 * the LIVE Upstash Redis, and perform the one-time backfill of any approved/
 * rejected currently in the queue into the never-trimmed archives.
 *
 * Preview deploys can't reach production Redis (env-scoping), so this is the real
 * verification step. Read-only EXCEPT it backfills approved/rejected into their
 * archive hashes — which is exactly the self-heal the endpoint now does on read.
 *
 * Run locally with the production Upstash creds (copy from Vercel → Project →
 * Settings → Environment Variables):
 *
 *   PowerShell:
 *     $env:UPSTASH_REDIS_REST_URL='https://...'; $env:UPSTASH_REDIS_REST_TOKEN='...'; node scripts/test-proposal-retention.cjs
 *
 *   bash:
 *     UPSTASH_REDIS_REST_URL='https://...' UPSTASH_REDIS_REST_TOKEN='...' node scripts/test-proposal-retention.cjs
 */
const author = require('../lib/pattern-author.js');

function tally(proposals) {
  const by = {};
  for (const p of proposals) { const s = (p && p.status) || 'none'; by[s] = (by[s] || 0) + 1; }
  return by;
}

(async () => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('\n  Missing Redis creds. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
    console.error('  (Vercel → limen-helix-live → Settings → Environment Variables), then re-run.\n');
    process.exit(1);
  }

  console.log('\nPass 1 — listProposals() (this triggers the self-heal backfill into the archives)…');
  const first = await author.listProposals();
  console.log('  storage =', first.storage, '| unique proposals =', first.proposals.length);
  console.log('  by status:', JSON.stringify(tally(first.proposals)));

  console.log('\nPass 2 — listProposals() again (should be stable + now archive-served)…');
  const second = await author.listProposals();
  const t1 = JSON.stringify(tally(first.proposals));
  const t2 = JSON.stringify(tally(second.proposals));
  console.log('  by status:', t2);

  console.log('\nResult:');
  console.log('  ' + (t1 === t2
    ? 'STABLE — counts identical across passes (archives are serving approved/rejected).'
    : 'counts shifted between passes — only expected if a worker is actively writing proposals.'));
  console.log('  APPROVED retained :', tally(second.proposals).APPROVED || 0);
  console.log('  REJECTED retained :', tally(second.proposals).REJECTED || 0);
  console.log('\n  If APPROVED/REJECTED now show up here, the archive fix works — approved/');
  console.log('  rejected are preserved independent of the pending-queue LTRIM.\n');
})().catch(e => { console.error('\nFAILED:', e && e.message || e, '\n'); process.exit(1); });
