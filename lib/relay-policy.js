/**
 * relay-policy.js — Relay's sale terms, versioned, and the record that a buyer accepted them.
 *
 * WHY VERSIONED: "no returns" is only defensible if you can show WHICH text the buyer
 * ticked at the moment they paid. An order stores policyVersion + the sha256 of the exact
 * text it showed. Change the text, bump the version; old orders still resolve to the terms
 * they were actually sold under.
 *
 * WHY NOT "NO REFUNDS EVER": card-network rules (Visa/Mastercard chargeback reason codes
 * 13.1 merchandise-not-received and 13.3 not-as-described) override any store policy. A
 * blanket no-refund line does not stop those; it just guarantees they arrive as chargebacks,
 * which cost the dispute fee ON TOP of the refund and count against the account's dispute
 * ratio. So the policy below refuses CHANGE-OF-MIND returns (the expensive, optional kind)
 * and keeps a fast defined remedy for not-delivered / not-as-described (the kind we lose
 * anyway). That is what protects the margin.
 */

const crypto = require('crypto');
const db = require('./limen-db');

const POLICY_VERSION = '2026-08-30.1';

const POLICY = {
  version: POLICY_VERSION,
  headline: 'All sales are final. No returns, no exchanges, no change-of-mind refunds.',
  terms: [
    {
      key: 'final-sale',
      title: 'Every sale is final',
      body: 'Relay sources each item individually from a third-party seller after you order it. ' +
            'Nothing is held in stock, so an order cannot be un-placed. Once you confirm, the ' +
            'purchase is committed and cannot be cancelled, returned, or exchanged.'
    },
    {
      key: 'no-change-of-mind',
      title: 'No change-of-mind returns',
      body: 'We do not accept returns for fit, colour, taste, buyer\'s remorse, a better price ' +
            'found elsewhere, or an item arriving later than hoped. If you are not certain, do ' +
            'not confirm the order.'
    },
    {
      key: 'condition',
      title: 'Pre-owned and third-party condition',
      body: 'Items are sourced pre-owned or from third-party sellers. Expect normal wear. ' +
            'Photographs shown may be representative reference images of the model, not the ' +
            'exact unit, unless the listing says the photo is of the actual item.'
    },
    {
      key: 'remedy',
      title: 'What we do cover',
      body: 'If the item never arrives, or arrives materially different from what was described ' +
            '(wrong model, undisclosed damage, counterfeit), report it within 14 days of the ' +
            'delivery date and we will refund that order in full. This is the only refund route ' +
            'and it is not a return: do not ship anything back unless we ask you to.'
    },
    {
      key: 'shipping',
      title: 'Shipping and timing',
      body: 'Items ship from the source seller directly to you. Delivery windows are estimates ' +
            'set by that seller and by the carrier, not by Relay. A slow delivery is not grounds ' +
            'for a refund unless the item never arrives.'
    },
    {
      key: 'pricing',
      title: 'Pricing',
      body: 'The price you see is the price you pay. Relay sources the item and keeps the ' +
            'difference between its sourcing cost and your price. That margin is how Relay ' +
            'operates and is not itemised on your receipt.'
    }
  ],
  // The single sentence the buyer ticks. Kept short on purpose: a confirmation nobody
  // reads is a confirmation that will not hold up.
  confirmLabel: 'I understand this sale is FINAL: no returns, no exchanges, no refunds except ' +
                'for an item that never arrives or is materially not as described.',
  remedyWindowDays: 14,
  contact: 'relay@limenhelix.com'
};

/** Canonical text of the policy, used for hashing and for plain-text rendering. */
function policyText() {
  const lines = [POLICY.headline, ''];
  POLICY.terms.forEach(function (t) {
    lines.push(t.title.toUpperCase());
    lines.push(t.body);
    lines.push('');
  });
  lines.push(POLICY.confirmLabel);
  return lines.join('\n');
}

function policyHash() {
  return crypto.createHash('sha256').update(policyText(), 'utf8').digest('hex');
}

function getPolicy() {
  return {
    version: POLICY.version,
    hash: policyHash(),
    headline: POLICY.headline,
    terms: POLICY.terms,
    confirmLabel: POLICY.confirmLabel,
    remedyWindowDays: POLICY.remedyWindowDays,
    contact: POLICY.contact
  };
}

/**
 * Record that a buyer accepted the policy. Returns the acceptance record to be
 * stored ON the order. Callers MUST refuse checkout when accepted !== true.
 */
async function recordAcceptance(opts) {
  opts = opts || {};
  if (opts.accepted !== true) {
    return { ok: false, error: 'policy not accepted' };
  }
  const record = {
    policyVersion: POLICY.version,
    policyHash: policyHash(),
    acceptedAt: new Date().toISOString(),
    buyerId: opts.buyerId || null,
    orderId: opts.orderId || null,
    // Evidence of WHERE the tick happened. IP/UA are what a card network asks for
    // when we contest a "I never agreed to that" dispute.
    ip: opts.ip || null,
    userAgent: opts.userAgent || null
  };
  try {
    let log = await db.get('relay:policy-acceptances') || [];
    log.push(record);
    if (log.length > 5000) log = log.slice(-5000);
    await db.set('relay:policy-acceptances', log);
  } catch (e) {
    // Storage failure must not silently drop the evidence trail.
    return { ok: false, error: 'could not record acceptance: ' + e.message };
  }
  return { ok: true, acceptance: record };
}

/** Pull the request's client IP out of the usual proxy headers. */
function clientIp(req) {
  const h = (req && req.headers) || {};
  const fwd = h['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return h['x-real-ip'] || (req && req.socket && req.socket.remoteAddress) || null;
}

module.exports = {
  POLICY_VERSION,
  getPolicy,
  policyText,
  policyHash,
  recordAcceptance,
  clientIp
};
