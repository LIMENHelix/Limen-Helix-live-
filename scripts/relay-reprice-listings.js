/**
 * relay-reprice-listings.js — bring already-published listings onto the pricing rule.
 *
 *   node scripts/relay-reprice-listings.js            # DRY RUN, the default. Writes nothing.
 *   node scripts/relay-reprice-listings.js --apply    # writes the new prices
 *
 * WHY THIS EXISTS. Listings were priced cost * (1 + margin) on landed cost, which is
 * correct arithmetic and still could not clear the purchase gate: that gate needs
 * salePrice - landed >= minMarginUsd, and the difference a markup produces is exactly
 * cost * m. At a 35% markup an $8 floor is unreachable for anything under $22.86 landed,
 * so the cheap half of the catalogue was published and then refused at checkout, by
 * construction. A real customer hit it on a phone case. lib/relay-engine.js now prices
 * max(cost * (1 + m), cost + minMarginUsd); everything published before that needs the
 * same treatment, once.
 *
 * IDEMPOTENT BY CONSTRUCTION. The new price is computed from the STORED sourceCost and the
 * LIVE margin, never from the listing's current price, so running this twice produces the
 * same number and running it ten times changes nothing after the first. It never compounds.
 *
 * WHAT IT WILL NOT DO.
 *   - It will not price a listing whose sourceCost or sourceShipping is null. A null is not
 *     a zero: a listing we cannot cost is one we cannot price, so it is skipped, named, and
 *     left exactly as it is.
 *   - It will not delist anything. An item that cannot clear the gate even repriced is
 *     REPORTED and left live, because pulling stock is a business decision and not a
 *     script's to make.
 *   - It cannot fix the requote gap. Prices here are built on the freight quoted to the
 *     supplier's default destination, which is the same figure that misled the original
 *     listing; a distant buyer can still trip cost-drift at checkout, and that is correct
 *     behaviour rather than something to paper over.
 */
const db = require('../lib/limen-db');
const store = require('../lib/relay-store');
const autonomy = require('../lib/relay-autonomy');
const { getMargin } = require('../lib/relay-margin-calculator');

const LIMIT = 500;
const _round = n => Math.round(n * 100) / 100;

async function reprice(opts) {
  const DRY = !(opts && opts.apply === true);
  console.log(DRY ? 'DRY RUN — nothing will be written. Use --apply to write.\n'
                  : 'APPLYING — listing prices will be written.\n');

  const backend = db.getBackend();
  console.log('store backend: ' + backend);
  if (backend !== 'redis') {
    // Said out loud rather than discovered later: with no Redis configured this reads the
    // in-memory store, which on a fresh process is empty. A run that reports "0 listings"
    // because it could not see the real ones must not read as "nothing needed repricing".
    console.log('NOTE: no Redis configured, so this is reading process memory, not the live catalogue.\n');
  }

  const margin = await getMargin();
  const cfg = await autonomy.getConfig();
  const floorUsd = parseFloat(cfg.minMarginUsd) || 0;
  console.log('live margin: ' + (margin * 100).toFixed(0) + '%   minMarginUsd: $' + floorUsd.toFixed(2) +
              '   minMarginPct: ' + ((cfg.minMarginPct || 0) * 100).toFixed(0) + '%');
  console.log('formula: max(cost * ' + (1 + margin).toFixed(2) + ', cost + ' + floorUsd.toFixed(2) + ')\n');

  const listings = await store.activeListings(LIMIT);
  console.log('active listings read: ' + listings.length + '\n');

  const out = { repriced: [], unchanged: [], skipped: [], unsellable: [] };

  for (const l of listings) {
    const cost = l.sourceCost != null ? parseFloat(l.sourceCost) : null;
    // A null cost, or a null freight component, means we cannot state the landed number.
    if (cost == null || !isFinite(cost) || cost <= 0 || l.sourceShipping == null) {
      out.skipped.push({ id: l.id, title: l.title, why: cost == null || !isFinite(cost) || cost <= 0
        ? 'no usable sourceCost' : 'sourceShipping is null, so landed cost is unknown' });
      continue;
    }

    const newPrice = _round(Math.max(cost * (1 + margin), cost + floorUsd));
    const gate = await autonomy.authorize({
      amount: cost, salePrice: newPrice, marketplace: l.sourceMarketplace,
      note: l.title, dryRun: true, skipFunds: true
    });

    if (!gate.allowed) {
      // Left live deliberately. Reported so a human can decide whether to delist, move the
      // floor, or leave it; none of those is a decision this script gets to take.
      out.unsellable.push({ id: l.id, title: l.title, cost: cost, wouldPrice: newPrice, reason: gate.reason });
      continue;
    }

    if (_round(parseFloat(l.price)) === newPrice) {
      out.unchanged.push({ id: l.id, title: l.title, price: newPrice });
      continue;
    }

    out.repriced.push({ id: l.id, title: l.title, cost: cost, from: _round(parseFloat(l.price)), to: newPrice });
    if (!DRY) await store.updateListing(l.id, { price: newPrice, marginAtListing: margin });
  }

  const money = n => '$' + Number(n).toFixed(2);
  const name = t => String(t || '').slice(0, 46);

  if (out.repriced.length) {
    console.log((DRY ? 'WOULD REPRICE' : 'REPRICED') + ' (' + out.repriced.length + ')');
    out.repriced.forEach(r => console.log('  ' + money(r.from).padStart(8) + ' -> ' + money(r.to).padStart(8) +
      '   landed ' + money(r.cost).padStart(8) + '   ' + name(r.title)));
    console.log('');
  }
  if (out.unsellable.length) {
    console.log('CANNOT CLEAR THE GATE EVEN REPRICED (' + out.unsellable.length + ') — left live, decide by hand');
    out.unsellable.forEach(r => console.log('  ' + money(r.wouldPrice).padStart(8) +
      '   landed ' + money(r.cost).padStart(8) + '   ' + name(r.title) + '   [' + r.reason + ']'));
    console.log('');
  }
  if (out.skipped.length) {
    console.log('SKIPPED, NOT PRICED AS ZERO (' + out.skipped.length + ')');
    out.skipped.forEach(r => console.log('  ' + name(r.title) + '   [' + r.why + ']'));
    console.log('');
  }

  console.log('summary: ' + out.repriced.length + (DRY ? ' would be repriced' : ' repriced') +
              ', ' + out.unchanged.length + ' already correct' +
              ', ' + out.unsellable.length + ' unsellable at this floor' +
              ', ' + out.skipped.length + ' skipped');
  if (DRY && (out.repriced.length || out.unsellable.length)) {
    console.log('\nnothing was written. re-run with --apply to write the repriced values.');
  }
  return out;
}

// Exported so the behaviour can be driven twice in one process and checked for
// idempotence. Only self-runs when invoked directly, never on require.
module.exports = { reprice: reprice };

if (require.main === module) {
  reprice({ apply: process.argv.includes('--apply') }).catch(function (e) {
    console.error('reprice failed: ' + (e && e.stack || e));
    process.exit(1);
  });
}
