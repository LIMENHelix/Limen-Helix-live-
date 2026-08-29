/**
 * relay-margin-calculator.js — Calculate and apply margins to search results
 * Hides source costs from customer; shows marked-up price
 */

const DEFAULT_MARGIN_PERCENT = 25;

function calculateMargin(sourceCost, marginPercent = DEFAULT_MARGIN_PERCENT) {
  const margin = sourceCost * (marginPercent / 100);
  return {
    sourceCost,
    margin,
    customerPrice: sourceCost + margin,
    marginPercent
  };
}

function applyMarginToSearchResults(items) {
  // Items come from relay-source-search with {itemId, source, title, price, condition, url}
  // We add margins but HIDE the source cost and URL from customer
  return items.map(item => ({
    itemId: item.itemId,
    title: item.title,
    price: Math.round((item.price + item.price * 0.25) * 100) / 100, // Show customer price
    condition: item.condition,
    // Hidden from customer:
    // source, url, original price
  }));
}

function recordMarginMetrics(order) {
  // Called after payment to record profit metrics
  return {
    orderId: order.orderId,
    sourceCost: order.sourceCost,
    customerPrice: order.customerPrice,
    margin: order.margin,
    marginPercent: 25,
    source: order.sourceMarketplace
  };
}

module.exports = {
  calculateMargin,
  applyMarginToSearchResults,
  recordMarginMetrics,
  DEFAULT_MARGIN_PERCENT
};
