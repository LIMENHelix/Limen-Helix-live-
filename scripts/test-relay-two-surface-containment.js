/* Regression proof for Relay's two public products and C2C checkout safety. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function assert(name, yes, detail) {
  if (yes) { pass++; console.log('PASS ' + name); }
  else { fail++; console.error('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function body(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function res() {
  return { statusCode: 0, headers: {}, payload: '', setHeader(k,v){this.headers[k.toLowerCase()]=v;}, end(v){this.payload=String(v||'');}, json(){try{return JSON.parse(this.payload)}catch(_){return null;}} };
}
function req(payload, key) { return { method:'POST', body:payload, headers:key?{'idempotency-key':key}:{}, on(){} }; }

(async function () {
  // ── public surface containment ──
  const legacy = body('pages/relay.html');
  const fakeCheckout = body('pages/relay-checkout.html');
  const c2c = body('marketplace-storefront.html');
  const bridge = body('handlers/relay-checkout-page.js');
  const legacyHandler = body('handlers/relay-marketplace-page.js');
  const supplyHandler = body('handlers/relay-storefront.js');

  assert('legacy third storefront redirects to /relay', /location\.replace\('\/relay'\)/.test(legacy));
  assert('legacy third storefront no longer exposes Grok image spend', legacy.indexOf('relay-grok-image') < 0);
  assert('simulated checkout page is retired', fakeCheckout.indexOf('Simulate payment processing') < 0 && /\/relay/.test(fakeCheckout));
  assert('searched-item checkout calls real demand purchase', bridge.indexOf('/api/relay-demand-purchase') >= 0);
  assert('legacy marketplace page route redirects to Supply', /statusCode = 308/.test(legacyHandler) && /Location', '\/relay'/.test(legacyHandler));
  assert('house storefront is named Relay Supply', supplyHandler.indexOf('Relay Supply') >= 0);
  assert('C2C page identifies peer-to-peer purpose', c2c.indexOf('peer-to-peer marketplace') >= 0);
  assert('C2C page sends Idempotency-Key', c2c.indexOf("'Idempotency-Key':IDEM") >= 0);
  assert('C2C page checks out one listing, not an incompatible cart array', c2c.indexOf('listingId:CURRENT.id') >= 0 && c2c.indexOf('items:items') < 0);
  assert('C2C page links to seller onboarding', c2c.indexOf('/merchant-onboarding') >= 0);

  // ── handler-level money safety ──
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const mpPath = require.resolve('../lib/relay-marketplace');
  const stripePath = require.resolve('../lib/stripe-rail');
  const journalPath = require.resolve('../lib/relay-c2c-audit');
  const handlerPath = require.resolve('../handlers/relay-marketplace-checkout');
  const calls = [];
  let stripeCalls = 0, orderCalls = 0;
  const listing = { id:'lst_safe', marketplaceId:'mkt_safe', sellerId:'seller_safe', title:'Used jacket', price:25, quantity:1, status:'active' };
  const market = { id:'mkt_safe', status:'active', commissionRate:.15, franchiseFeeRate:.05 };
  const orders = {};
  require.cache[mpPath] = { id:mpPath, filename:mpPath, loaded:true, exports:{
    async getMarketplace(id){return id===market.id?market:null;},
    async getListing(id){return id===listing.id?listing:null;},
    async createOrder(o){calls.push('create-order');orderCalls++;const r={id:'ord_'+orderCalls,subtotal:o.subtotal,commission:3.75,franchiseFee:1.25,sellerPayout:20,...o};orders[r.id]=r;return r;},
    async updateOrder(id,u){orders[id]=Object.assign(orders[id]||{id},u);return orders[id];}
  }};
  require.cache[stripePath] = { id:stripePath, filename:stripePath, loaded:true, exports:{
    hasKey(){return true;},
    async createPaymentLink(o){calls.push('stripe');stripeCalls++;return {ok:true,url:'https://buy.stripe.test/'+stripeCalls,paymentLinkId:'plink_'+stripeCalls,amount:o.amount};}
  }};
  require.cache[journalPath] = { id:journalPath, filename:journalPath, loaded:true, exports:{
    async audit(){calls.push('audit');return {};}, async reconcile(){calls.push('reconcile');return {};}
  }};
  delete require.cache[handlerPath];
  const checkout = require('../handlers/relay-marketplace-checkout');
  const good = {marketplaceId:'mkt_safe',buyerId:'buyer_safe',buyerEmail:'buyer@example.com',listingId:'lst_safe',quantity:1,policyAccepted:true,shippingAddress:{name:'Buyer',line1:'1 Main',city:'Town',state:'MO',postalCode:'64000',country:'US'}};

  delete process.env.RELAY_C2C_ORDER_CAP_USD;
  let r = res(); await checkout(req(good,'idem_missing_cap_12345'),r);
  assert('missing operator C2C cap fails closed', r.statusCode===503, r.payload);
  assert('missing cap creates no Stripe side effect', stripeCalls===0, String(stripeCalls));

  process.env.RELAY_C2C_ORDER_CAP_USD='20';
  r = res(); await checkout(req(good,'idem_over_cap_12345678'),r);
  assert('one cent/order over operator cap is refused', r.statusCode===409, r.payload);
  assert('over-cap refusal creates no Stripe side effect', stripeCalls===0, String(stripeCalls));

  process.env.RELAY_C2C_ORDER_CAP_USD='25';
  r = res(); await checkout(req(good,'idem_at_cap_123456789'),r);
  assert('at-cap order is allowed', r.statusCode===200 && r.json().ok===true, r.payload);
  assert('pre-execution audit precedes order and Stripe', calls.indexOf('audit')>=0 && calls.indexOf('audit')<calls.indexOf('create-order') && calls.indexOf('create-order')<calls.indexOf('stripe'), calls.join(','));
  const first = r.json();
  const stripeAfterFirst = stripeCalls, ordersAfterFirst = orderCalls;
  r = res(); await checkout(req(good,'idem_at_cap_123456789'),r);
  assert('same handler request twice returns same order', r.statusCode===200 && r.json().orderId===first.orderId, r.payload);
  assert('same handler request twice creates one Stripe side effect', stripeCalls===stripeAfterFirst, String(stripeCalls));
  assert('same handler request twice creates one order', orderCalls===ordersAfterFirst, String(orderCalls));

  const multi = Object.assign({},good,{listingId:undefined,items:[{id:'lst_safe',qty:1},{id:'lst_other',qty:1}]});
  r = res(); await checkout(req(multi,'idem_multi_123456789'),r);
  assert('multi-seller cart is refused instead of silently splitting charges', r.statusCode===409, r.payload);

  r = res(); await checkout(req(good,null),r);
  assert('checkout without idempotency key is rejected', r.statusCode===400, r.payload);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exit(1);
})().catch(function (e) { console.error('HARNESS ERROR:', e && e.stack || e); process.exit(1); });
