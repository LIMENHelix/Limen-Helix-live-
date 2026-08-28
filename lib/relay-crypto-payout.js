/**
 * relay-crypto-payout.js — Send USDC/stablecoin to seller wallets
 *
 * Model 3: Autonomous crypto settlement
 * - Seller earns USDC on Polygon/Solana (no bank wires, instant)
 * - Relay holds 15% commission in USD (Stripe account)
 * - Seller gets 85% in USDC at their wallet address
 *
 * Requires:
 *   - RELAY_CRYPTO_PROVIDER_KEY (Stripe/Moralis/Magic Link API key)
 *   - RELAY_POLYGON_RPC (or Solana RPC)
 *   - Seller wallet address stored in user profile
 */

const crypto = require('crypto');

// In production: integrate with Stripe Connect for ACH OR Moralis SDK for crypto.
// For MVP: log intent to payout record, let operator confirm manually in control panel.

async function sendUSDCToSeller(sellerUserId, amountUSDC, network = 'polygon') {
  if (!sellerUserId || !amountUSDC || amountUSDC <= 0) {
    throw new Error('Invalid seller or amount');
  }

  // Get seller details from marketplace
  const marketplace = require('./relay-marketplace');
  const seller = await marketplace.getUser(sellerUserId);
  if (!seller) throw new Error('Seller not found');

  if (!seller.walletAddress) {
    throw new Error('Seller has no wallet address registered');
  }

  const payout = {
    id: 'payout_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
    sellerId: sellerUserId,
    sellerEmail: seller.email,
    walletAddress: seller.walletAddress,
    amountUSDC: amountUSDC,
    network: network,  // 'polygon' | 'solana'
    status: 'pending',  // pending → queued → confirmed → settled
    txHash: null,
    ts: new Date().toISOString()
  };

  // TODO: Integrate with:
  // - Stripe Connect for USD disbursement (ACH) OR
  // - Moralis SDK to send USDC on-chain OR
  // - Magic Link / Web3 auth for seller self-withdrawal

  // MVP: just record intent, operator approves in dashboard
  const db = require('./limen-db');
  let payouts = await db.get('relay:crypto-payouts') || [];
  payouts.push(payout);
  await db.set('relay:crypto-payouts', payouts);

  return payout;
}

async function getPendingPayouts() {
  const db = require('./limen-db');
  const payouts = await db.get('relay:crypto-payouts') || [];
  return payouts.filter(p => p.status === 'pending' || p.status === 'queued');
}

async function confirmPayout(payoutId) {
  const db = require('./limen-db');
  let payouts = await db.get('relay:crypto-payouts') || [];
  const payout = payouts.find(p => p.id === payoutId);
  if (!payout) throw new Error('Payout not found');

  payout.status = 'queued';
  payout.queuedAt = new Date().toISOString();
  await db.set('relay:crypto-payouts', payouts);

  // TODO: Call actual blockchain/payment API
  // sendToBlockchain(payout);

  return payout;
}

module.exports = {
  sendUSDCToSeller,
  getPendingPayouts,
  confirmPayout
};
