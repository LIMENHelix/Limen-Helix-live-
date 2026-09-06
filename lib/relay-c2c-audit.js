/** Relay C2C immutable audit/reconciliation journals. */
const db = require('./limen-db');
const AUDIT_KEY = 'relay:c2c:audit';
const RECON_KEY = 'relay:c2c:reconciliation';
const MAX = 3000;

function clean(v, n) { return v == null ? null : String(v).slice(0, n || 200); }
function amount(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; }

async function append(key, evt) {
  const row = {
    ts: new Date().toISOString(),
    action: clean(evt.action, 80),
    orderId: clean(evt.orderId, 100),
    listingId: clean(evt.listingId, 100),
    marketplaceId: clean(evt.marketplaceId, 100),
    buyerId: clean(evt.buyerId, 100),
    sellerId: clean(evt.sellerId, 100),
    amount: amount(evt.amount),
    idempotencyKeyHash: clean(evt.idempotencyKeyHash, 80),
    externalId: clean(evt.externalId, 120),
    status: clean(evt.status, 80),
    detail: evt.detail && typeof evt.detail === 'object' ? evt.detail : null
  };
  await db.lpush(key, row);
  await db.ltrim(key, 0, MAX - 1);
  return row;
}

async function audit(evt) { return append(AUDIT_KEY, evt || {}); }
async function reconcile(evt) { return append(RECON_KEY, evt || {}); }
module.exports = { audit, reconcile, AUDIT_KEY, RECON_KEY };
