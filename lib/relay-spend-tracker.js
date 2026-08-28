/**
 * relay-spend-tracker.js — Budget management using PayPal balance
 *
 * Model 3: Dynamic budget based on PayPal account balance.
 * - Never withdraw from PayPal
 * - Use available balance to buy inventory
 * - Profit accumulates in Stripe (customer payments)
 * - System respects PayPal balance as spending power
 *
 * Budget distribution (proportional to marketplace volume):
 *   - Vinted: 40% of PayPal balance
 *   - Poshmark: 30% of PayPal balance
 *   - eBay: 20% of PayPal balance
 *   - Mercari: 10% of PayPal balance
 */

const db = require('./limen-db');
const paypalBalance = require('./relay-paypal-balance');

const MARKETPLACE_ALLOCATION = {
  vinted: 0.40,
  poshmark: 0.30,
  ebay: 0.20,
  mercari: 0.10
};

async function getPayPalBalance() {
  return await paypalBalance.getCurrentBalance();
}

async function getBudget() {
  const ppBalance = await getPayPalBalance();

  // Allocate PayPal balance proportionally to each marketplace
  const budgets = {
    vinted: ppBalance * MARKETPLACE_ALLOCATION.vinted,
    poshmark: ppBalance * MARKETPLACE_ALLOCATION.poshmark,
    ebay: ppBalance * MARKETPLACE_ALLOCATION.ebay,
    mercari: ppBalance * MARKETPLACE_ALLOCATION.mercari,
    total: ppBalance
  };

  // Round to 2 decimals
  Object.keys(budgets).forEach(k => {
    budgets[k] = Math.round(budgets[k] * 100) / 100;
  });

  return budgets;
}

async function canSpend(marketplace, amount) {
  const budgets = await getBudget();

  if (!budgets[marketplace]) {
    throw new Error(`Unknown marketplace: ${marketplace}`);
  }

  if (amount <= 0) return false;
  if (amount > budgets[marketplace]) return false;

  return true;
}

async function recordSpend(marketplace, amount, itemId, itemTitle) {
  if (!await canSpend(marketplace, amount)) {
    const budgets = await getBudget();
    throw new Error(`Insufficient budget: ${marketplace} has $${budgets[marketplace]}, need $${amount}`);
  }

  // Log transaction (don't deduct from PayPal; it's checked live each time)
  let history = await db.get('relay:spend-history') || [];
  const budgets = await getBudget();

  history.push({
    ts: new Date().toISOString(),
    marketplace: marketplace,
    amount: amount,
    itemId: itemId,
    itemTitle: itemTitle,
    paypalBalance: budgets.total,
    budgetRemaining: budgets[marketplace] - amount
  });

  // Keep last 1000 transactions
  if (history.length > 1000) {
    history = history.slice(-1000);
  }

  await db.set('relay:spend-history', history);

  return { spent: amount, remaining: budgets[marketplace] - amount };
}

async function getSpendStatus() {
  const budgets = await getBudget();
  const history = await db.get('relay:spend-history') || [];
  const today = new Date().toISOString().split('T')[0];
  const todayTxns = history.filter(h => h.ts && h.ts.startsWith(today));
  const todaySpent = todayTxns.reduce((sum, h) => sum + h.amount, 0);

  return {
    date: today,
    paypalBalance: budgets.total,
    budgets: budgets,
    todaySpent: Math.round(todaySpent * 100) / 100,
    todayTransactions: todayTxns.length,
    percentOfPayPalUsed: (budgets.total > 0 ? (todaySpent / budgets.total * 100).toFixed(1) : 0) + '%'
  };
}

async function updateAllocation(marketplace, percentage) {
  if (!MARKETPLACE_ALLOCATION[marketplace]) {
    throw new Error(`Unknown marketplace: ${marketplace}`);
  }

  // Validate allocation sums to 1.0
  const newAlloc = { ...MARKETPLACE_ALLOCATION, [marketplace]: percentage };
  const total = Object.values(newAlloc).reduce((sum, v) => sum + v, 0);

  if (Math.abs(total - 1.0) > 0.01) {
    throw new Error(`Allocation must sum to 100%, got ${(total * 100).toFixed(1)}%`);
  }

  MARKETPLACE_ALLOCATION[marketplace] = percentage;
  return MARKETPLACE_ALLOCATION;
}

module.exports = {
  getBudget,
  canSpend,
  recordSpend,
  getSpendStatus,
  updateAllocation,
  MARKETPLACE_ALLOCATION
};
