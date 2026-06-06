/**
 * products.js — the sellable LIMEN IP + Stripe payment links (the income mechanism).
 *
 * Products are defined in capital-engine.json ("products"). ensureLinks() creates a
 * Stripe payment link per product (idempotent — cached in Redis), and ctaFor() returns
 * the product that matches a piece of content so produce() can append a real buy CTA.
 *
 * This is how the content engine earns: free grounded essay → CTA to YOUR product →
 * Stripe checkout → income recorded to the ledger. You own the product and the margin.
 */
const fs = require('node:fs');
const path = require('node:path');
const db = require('../api/lib/limen-db');
const stripe = require('./stripe-rail');

const CONTRACT = path.join(__dirname, '..', 'assets', 'data', 'capital-engine.json');
const LINKS_KEY = 'site:product-links';

function _products() {
  try { return JSON.parse(fs.readFileSync(CONTRACT, 'utf8')).products || []; }
  catch (e) { return []; }
}

async function links() { return (await db.get(LINKS_KEY)) || {}; }

// create a Stripe payment link for any product that doesn't have one yet (cached)
async function ensureLinks() {
  const products = _products();
  const cache = await links();
  let created = 0;
  const errors = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (cache[p.id] && cache[p.id].url) continue;
    const r = await stripe.createPaymentLink({ name: p.name, amount: p.price, streamId: p.id });
    if (r.ok) { cache[p.id] = { url: r.url, productId: r.productId, priceId: r.priceId }; created++; }
    else errors.push({ id: p.id, error: r.error });
  }
  if (created) await db.set(LINKS_KEY, cache);
  return { products: products, links: cache, created: created, errors: errors };
}

// pick the product matching a content source card / domain; return its CTA if a link exists
async function ctaFor(sourceCardId) {
  const products = _products();
  if (!products.length) return null;
  const cache = await links();
  let match = products.find(function (p) { return p.sourceCard === sourceCardId && cache[p.id] && cache[p.id].url; });
  if (!match) match = products.find(function (p) { return cache[p.id] && cache[p.id].url; }); // any product with a live link
  if (!match) return null;
  return { id: match.id, name: match.name, blurb: match.blurb || '', url: cache[match.id].url };
}

module.exports = { ensureLinks, links, ctaFor, _products };
