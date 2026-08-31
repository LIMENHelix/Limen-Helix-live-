/**
 * relay-margin-calculator.js — turn a source cost into the price a customer sees.
 *
 * FIXED 2026-08-30. applyMarginToSearchResults() took a marginPercent argument, ignored
 * it, and hardcoded 0.25 inline. So the margin slider in the cockpit moved a number that
 * this file never read: every demand-search result was priced at 25% no matter what the
 * operator set. The margin now comes from one place, the same db key the cockpit writes
 * and relay-engine prices against.
 *
 * The customer-facing shape never carries source, url or original price. That is the
 * whole point of the markup being invisible, and it is checked by test/relay-engine.test.js.
 */

const db = require('./limen-db');

const MARGIN_KEY = 'relay_margin';
const DEFAULT_MARGIN = 0.35;          // fraction, matches api/relay-margin's default

/** The operator-set margin as a fraction (0.35 = 35%). */
async function getMargin() {
  try {
    const v = await db.get(MARGIN_KEY);
    if (typeof v === 'number' && isFinite(v) && v >= 0 && v <= 5) return v;
  } catch (e) { /* fall through */ }
  return DEFAULT_MARGIN;
}

function _round(n) { return Math.round(n * 100) / 100; }

/** Price one item. marginFraction is 0.35 for 35%. */
function calculateMargin(sourceCost, marginFraction) {
  const m = (typeof marginFraction === 'number' && isFinite(marginFraction) && marginFraction >= 0)
    ? marginFraction
    : DEFAULT_MARGIN;
  const cost = parseFloat(sourceCost) || 0;
  const margin = _round(cost * m);
  return {
    sourceCost: cost,
    margin: margin,
    customerPrice: _round(cost + margin),
    marginFraction: m,
    marginPercent: _round(m * 100)
  };
}

/**
 * Apply the live margin to search results and strip everything the customer must not see.
 * Async because the margin is stored, not hardcoded.
 */
async function applyMarginToSearchResults(items, marginFraction) {
  const list = Array.isArray(items) ? items : [];
  const m = (typeof marginFraction === 'number') ? marginFraction : await getMargin();
  return list.map(function (item) {
    const priced = calculateMargin(item.price, m);
    return {
      itemId: item.itemId,
      title: item.title,
      price: priced.customerPrice,
      condition: item.condition,
      image: item.image || null,
      // Deliberately absent: source, url, sourceCost, seller, provider.
    };
  });
}

/** The internal view, for the ledger and the admin board. Never sent to a customer. */
function recordMarginMetrics(order) {
  const cost = parseFloat(order.sourceCost) || 0;
  const price = parseFloat(order.customerPrice) || 0;
  return {
    orderId: order.orderId,
    sourceCost: cost,
    customerPrice: price,
    margin: _round(price - cost),
    marginPercent: price > 0 ? _round(((price - cost) / price) * 100) : 0,
    source: order.sourceMarketplace || null
  };
}

module.exports = {
  getMargin,
  calculateMargin,
  applyMarginToSearchResults,
  recordMarginMetrics,
  DEFAULT_MARGIN
};
