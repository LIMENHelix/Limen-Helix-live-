/**
 * relay-paypal-balance.js — Check PayPal account balance
 *
 * Model 3 uses PayPal balance as dynamic budget.
 * Never withdraw; only buy inventory with available balance.
 * Profit accumulates in Stripe (customer payments) and PayPal (seller refunds).
 *
 * Requires:
 *   PAYPAL_CLIENT_ID
 *   PAYPAL_CLIENT_SECRET
 *   PAYPAL_MODE (sandbox or live)
 */

let cachedBalance = null;
let lastFetchTime = 0;
const CACHE_TTL = 300000;  // 5 minutes

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  if (!clientId || !clientSecret) {
    console.warn('[relay-paypal] PayPal credentials not configured');
    return null;
  }

  const endpoint = mode === 'live'
    ? 'https://api.paypal.com'
    : 'https://api.sandbox.paypal.com';

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(`${endpoint}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    return data.access_token || null;
  } catch (e) {
    console.error('[relay-paypal] Access token failed:', e.message);
    return null;
  }
}

async function getCurrentBalance() {
  const now = Date.now();

  // Return cached if fresh
  if (cachedBalance !== null && (now - lastFetchTime) < CACHE_TTL) {
    return cachedBalance;
  }

  const token = await getAccessToken();
  if (!token) {
    console.warn('[relay-paypal] No token, returning cached balance or 0');
    return cachedBalance || 0;
  }

  const mode = process.env.PAYPAL_MODE || 'sandbox';
  const endpoint = mode === 'live'
    ? 'https://api.paypal.com'
    : 'https://api.sandbox.paypal.com';

  try {
    const response = await fetch(`${endpoint}/v1/reporting/balances`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    // Find USD balance in accounts array
    if (data.accounts && Array.isArray(data.accounts)) {
      const usdAccount = data.accounts.find(a => a.currency_code === 'USD');
      if (usdAccount && usdAccount.total_balance) {
        const balance = parseFloat(usdAccount.total_balance.value) || 0;
        cachedBalance = balance;
        lastFetchTime = now;
        return balance;
      }
    }

    return cachedBalance || 0;
  } catch (e) {
    console.error('[relay-paypal] Balance fetch failed:', e.message);
    return cachedBalance || 0;
  }
}

async function canAfford(amount) {
  const balance = await getCurrentBalance();
  return amount > 0 && amount <= balance;
}

module.exports = {
  getCurrentBalance,
  canAfford,
  clearCache: () => { cachedBalance = null; lastFetchTime = 0; }
};
