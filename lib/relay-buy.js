/**
 * relay-buy.js — actually spend the money: buy one item from the source marketplace
 * and have it shipped to the Relay customer.
 *
 * READ THIS BEFORE TRUSTING THE PIPELINE:
 * There is no marketplace in this list with an open, self-serve "buy this for me" API.
 * That is the real ceiling on full autonomy, and no amount of code here removes it.
 *
 *   ebay      A real purchase API exists (Buy > Order). It is a RESTRICTED API: eBay
 *             must approve the application individually, and approval for the Buy APIs
 *             is rarely granted outside of established partners. Wired below and it
 *             will work the day the keyset is approved and EBAY_BUY_TOKEN is set. Until
 *             then it returns needsCredential and nothing is charged.
 *   vinted    No public API of any kind.
 *   poshmark  No public API of any kind.
 *   mercari   Read-only endpoints only; no checkout.
 *   others    Same.
 *
 * SO WHAT ACTUALLY HAPPENS: when no provider can execute, this returns
 * { ok:false, mode:'manual', task:{...} } and the engine files a fulfilment task with
 * the exact URL, price and shipping address. The loop keeps running unattended; a human
 * completes the one step that cannot be automated. That is the honest version of "24/7".
 *
 * The alternative — driving a logged-in account with a headless browser — is against
 * every one of these sites' terms, and the failure mode is not a bad scrape: it is a
 * banned account holding orders the customer already paid for. Not implemented on purpose.
 */

const db = require('./limen-db');
const notify = require('./relay-notify');
const cj = require('./relay-cj');

const EBAY_BUY_TOKEN = process.env.EBAY_BUY_TOKEN || '';
const EBAY_MARKETPLACE = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
const TIMEOUT_MS = parseInt(process.env.RELAY_HTTP_TIMEOUT_MS || '15000', 10);
const TASKS_KEY = 'relay:fulfillment-tasks';

function _id(p) { return p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9); }

async function _fetch(url, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

function providerFor(sourceUrl, sourceMarketplace) {
  const s = String(sourceMarketplace || sourceUrl || '').toLowerCase();
  if (s === 'cj' || s.indexOf('cjdropshipping') !== -1) return 'cj';
  if (s.indexOf('ebay') !== -1) return 'ebay';
  if (s.indexOf('vinted') !== -1) return 'vinted';
  if (s.indexOf('poshmark') !== -1) return 'poshmark';
  if (s.indexOf('mercari') !== -1) return 'mercari';
  return 'unknown';
}

function ebayItemId(sourceUrl, sourceId) {
  if (sourceId && /^v1\|/.test(sourceId)) return sourceId;          // already a Browse itemId
  const m = String(sourceUrl || '').match(/\/itm\/(?:.*\/)?(\d{9,15})/);
  if (m) return 'v1|' + m[1] + '|0';
  if (sourceId && /^\d{9,15}$/.test(sourceId)) return 'v1|' + sourceId + '|0';
  return null;
}

/**
 * eBay Buy > Order, guest checkout. Three calls: initiate a session with the item,
 * apply the customer's shipping address, then place the order.
 * Requires an approved Buy-API keyset; EBAY_BUY_TOKEN is the user access token for it.
 */
async function buyFromEbay(job) {
  if (!EBAY_BUY_TOKEN) {
    return {
      ok: false,
      needsCredential: 'EBAY_BUY_TOKEN',
      error: 'eBay Buy API not enabled. This needs an eBay-approved Buy/Order keyset and a ' +
             'user token in EBAY_BUY_TOKEN. Browse (search) approval does not include Buy.'
    };
  }
  const itemId = ebayItemId(job.sourceUrl, job.sourceId);
  if (!itemId) return { ok: false, error: 'could not read an eBay item id from ' + job.sourceUrl };

  const addr = job.shippingAddress || {};
  const required = ['line1', 'city', 'state', 'postalCode', 'country', 'name'];
  const missing = required.filter(function (k) { return !addr[k]; });
  if (missing.length) return { ok: false, error: 'shipping address missing: ' + missing.join(', ') };

  const headers = {
    Authorization: 'Bearer ' + EBAY_BUY_TOKEN,
    'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  try {
    const initiate = await _fetch('https://api.ebay.com/buy/order/v1/guest_checkout_session/initiate', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        contactEmail: job.contactEmail || process.env.RELAY_CONTACT_EMAIL || '',
        lineItemInputs: [{ itemId: itemId, quantity: job.quantity || 1 }],
        shippingAddress: {
          recipient: addr.name,
          addressLine1: addr.line1,
          addressLine2: addr.line2 || '',
          city: addr.city,
          stateOrProvince: addr.state,
          postalCode: addr.postalCode,
          country: addr.country
        }
      })
    });
    const session = await initiate.json().catch(function () { return {}; });
    if (!initiate.ok) {
      return { ok: false, error: 'eBay initiate failed ' + initiate.status + ': ' + JSON.stringify(session).slice(0, 300) };
    }
    const sessionId = session.checkoutSessionId;
    if (!sessionId) return { ok: false, error: 'eBay returned no checkoutSessionId' };

    // Confirm the price eBay is about to charge matches what we authorised. A listing
    // whose price moved between search and checkout must NOT be bought silently.
    const quoted = parseFloat(
      (session.pricingSummary && session.pricingSummary.total && session.pricingSummary.total.value) || 'NaN'
    );
    if (isFinite(quoted) && isFinite(job.maxCost) && quoted > job.maxCost) {
      return {
        ok: false,
        priceMoved: true,
        quoted: quoted,
        error: 'source price is now $' + quoted.toFixed(2) + ', above the authorised $' + job.maxCost.toFixed(2)
      };
    }

    const place = await _fetch(
      'https://api.ebay.com/buy/order/v1/guest_checkout_session/' + encodeURIComponent(sessionId) + '/place_order',
      { method: 'POST', headers: headers, body: JSON.stringify({}) }
    );
    const placed = await place.json().catch(function () { return {}; });
    if (!place.ok) {
      return { ok: false, error: 'eBay place_order failed ' + place.status + ': ' + JSON.stringify(placed).slice(0, 300) };
    }
    return {
      ok: true,
      provider: 'ebay',
      sourceOrderId: placed.purchaseOrderId || sessionId,
      amount: isFinite(quoted) ? quoted : job.maxCost,
      raw: { checkoutSessionId: sessionId }
    };
  } catch (e) {
    return { ok: false, error: 'eBay purchase error: ' + e.message };
  }
}

/**
 * CJ Dropshipping: the one provider that completes without a human.
 *
 * payType=2 draws on the prepaid CJ wallet, so there is no checkout page to drive and no
 * bot-detection to trip. The failure worth naming separately is an empty wallet: that is
 * not a broken integration, it is a top-up, and the operator needs to be told which.
 */
async function buyFromCJ(job) {
  if (!cj.configured()) {
    return {
      ok: false,
      needsCredential: 'CJ_API_KEY',
      error: 'CJ not configured. This is the only supplier Relay can buy from unattended.'
    };
  }
  const vid = job.sourceId || job.vid;
  if (!vid) return { ok: false, error: 'no CJ variant id on the listing; it cannot be ordered' };

  // CJ treats orderNumber as an idempotency key. A cart with two CJ lines calls this
  // once per line with the same parent order id, so the second purchase would collide
  // with the first and never place. The listing id makes it unique per line while
  // staying stable across retries of that same line.
  const orderNumber = job.listingId ? job.orderId + '-' + job.listingId : job.orderId;

  // The published cost used a freight quote to CJ's default destination. The customer's
  // real address may cost more, and that difference was never in the margin or the
  // authorised spend. Requote BEFORE buying: once CJ charges the wallet it is too late
  // to decline.
  const addrCountry = String((job.shippingAddress || {}).country || 'US').toUpperCase();
  let carrier = job.carrier || null;
  if (job.sourceShipping != null && isFinite(job.maxCost)) {
    const requote = await cj.freight(vid, job.quantity || 1, addrCountry, (job.shippingAddress || {}).postalCode, job.fromCountry);
    if (!requote) {
      // cj.freight() collapses a timeout, 429 or 5xx to null, which is indistinguishable
      // here from a genuine refusal to quote. Marking it transient keeps a PAID order in
      // the engine's retry sweep instead of filing a manual task that the sweep never
      // revisits. A real refusal simply retries and fails again, which is cheap; the
      // opposite mistake strands the order permanently.
      return {
        ok: false,
        transient: true,
        error: 'no CJ shipping quote to ' + addrCountry + ' (transport or refusal); not buying blind'
      };
    }
    const revised = Math.round((job.maxCost - job.sourceShipping + requote.price) * 100) / 100;
    if (revised > job.maxCost * 1.1) {
      return {
        ok: false,
        error: 'shipping to ' + addrCountry + ' costs $' + requote.price.toFixed(2) +
               ' against $' + Number(job.sourceShipping).toFixed(2) + ' quoted; total $' +
               revised.toFixed(2) + ' exceeds the authorised $' + Number(job.maxCost).toFixed(2)
      };
    }
    carrier = requote.carrier || carrier;
  }

  const r = await cj.placeOrder({
    orderNumber: orderNumber,
    vid: vid,
    quantity: job.quantity || 1,
    shippingAddress: job.shippingAddress,
    carrier: carrier,
    fromCountry: job.fromCountry || null
  });
  if (!r.ok) return r;

  // CJ has ALREADY charged the wallet by this point. An overspend is therefore not a
  // failure to report as ok:false: doing that released the spend reservation, filed a
  // manual task and left the day's spend understated, while inviting a human or a retry
  // to buy the same thing twice. The purchase succeeded; it is flagged for review and
  // settled at the amount actually charged.
  const overspent = r.amount != null && isFinite(job.maxCost) && r.amount > job.maxCost * 1.1;
  return {
    ok: true,
    provider: 'cj',
    sourceOrderId: r.sourceOrderId,
    amount: r.amount != null ? r.amount : job.maxCost,
    needsReview: overspent,
    reviewReason: overspent
      ? 'CJ charged $' + r.amount.toFixed(2) + ' against an authorised $' +
        Number(job.maxCost).toFixed(2) + '; order ' + r.sourceOrderId + ' needs review'
      : null
  };
}

/** File the one step a machine cannot take, with everything a human needs to finish it. */
async function fileManualTask(job, why) {
  const task = {
    id: _id('task'),
    ts: new Date().toISOString(),
    state: 'open',
    reason: why,
    orderId: job.orderId || null,
    listingId: job.listingId || null,
    sourceMarketplace: job.sourceMarketplace || null,
    sourceUrl: job.sourceUrl || null,
    maxCost: job.maxCost != null ? job.maxCost : null,
    quantity: job.quantity || 1,
    shipTo: job.shippingAddress || null,
    // THE VARIANT AND THE NAME, because a human ordering this by hand needs to know WHICH
    // one. A CJ product page lists every size and colour; sourceUrl gets you to the page
    // and sourceId is the only thing that identifies the item on it. Ordering the wrong
    // variant is a customer complaint and a return we do not accept.
    sourceId: job.sourceId || null,
    title: job.title || null,
    decisionId: job.decisionId || null
  };
  try {
    let tasks = await db.get(TASKS_KEY) || [];
    tasks.push(task);
    if (tasks.length > 2000) tasks = tasks.slice(-2000);
    await db.set(TASKS_KEY, tasks);
  } catch (e) {
    return { ok: false, error: 'could not file fulfilment task: ' + e.message };
  }
  // TELL A HUMAN, or the task waits to be discovered. The console shows it, but nobody is
  // watching the console at 11pm, and a paid order sitting unnoticed is the exact failure
  // this task exists to prevent.
  //
  // Awaited so a caller can report what happened, but it CANNOT fail this function:
  // notifyManualTask never throws and returns a reason instead. The task is already
  // written by this point, and a mail problem must never turn a filed task into a failed
  // one. If it did, fulfilment would report a line as unrecorded when it is recorded.
  let notified = { sent: false, reason: 'not attempted' };
  try {
    notified = await notify.notifyManualTask(task, { consoleUrl: process.env.RELAY_CONSOLE_URL || null });
  } catch (e) {
    notified = { sent: false, reason: 'notify threw: ' + (e && e.message) };
  }
  if (!notified.sent) console.warn('[relay-buy] manual task ' + task.id + ' filed but not mailed: ' + notified.reason);
  return { ok: true, task: task, notified: notified };
}

async function openTasks() {
  try {
    const tasks = await db.get(TASKS_KEY) || [];
    return tasks.filter(function (t) { return t.state === 'open'; });
  } catch (e) {
    return [];
  }
}

async function closeTask(taskId, result) {
  try {
    const tasks = await db.get(TASKS_KEY) || [];
    const t = tasks.find(function (x) { return x.id === taskId; });
    if (!t) return { ok: false, error: 'no such task' };
    t.state = 'done';
    t.closedAt = new Date().toISOString();
    t.sourceOrderId = (result && result.sourceOrderId) || null;
    t.actualCost = (result && result.amount != null) ? parseFloat(result.amount) : null;
    await db.set(TASKS_KEY, tasks);
    return { ok: true, task: t };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * execute(job) — the single entry point.
 * job = { orderId, listingId, sourceMarketplace, sourceId, sourceUrl, maxCost,
 *         quantity, shippingAddress, contactEmail, decisionId }
 *
 * Returns { ok:true, sourceOrderId, amount } when money actually moved,
 * or { ok:false, mode:'manual', task } when a human has to finish it,
 * or { ok:false, error } on a real failure.
 */
async function execute(job) {
  job = job || {};
  const provider = providerFor(job.sourceUrl, job.sourceMarketplace);

  // ok is assembled field by field on purpose. Spreading the fileManualTask result in
  // here once overwrote ok:false with the task-write's own ok:true, so a purchase that
  // had NOT happened was returned as a success and the caller settled the spend and
  // marked the order shipped. Never let a bookkeeping result decide this flag.
  if (provider === 'cj') {
    const r = await buyFromCJ(job);
    if (r.ok) return r;
    // A timeout, a 429 or a momentary auth blip is not a job for a human. Converting it
    // to 'manual' removed a PAID order from the engine's retry sweep permanently, because
    // that sweep only revisits missing or failed fulfilments. Transient failures stay
    // retryable; only a definite refusal becomes a manual task.
    const transient = /timeout|abort|ECONNRESET|socket|429|rate|temporarily|502|503|504|authentication failed/i
      .test(r.error || '');
    if (transient) {
      return { ok: false, transient: true, provider: 'cj', error: r.error };
    }
    const filed = await fileManualTask(job, r.error || 'CJ order did not complete');
    return {
      ok: false,
      mode: 'manual',
      provider: 'cj',
      error: r.error || 'CJ order did not complete',
      needsCredential: r.needsCredential || null,
      insufficientBalance: r.insufficientBalance || false,
      overspent: r.overspent || false,
      task: filed.task || null,
      taskError: filed.ok ? null : filed.error
    };
  }

  if (provider === 'ebay') {
    const r = await buyFromEbay(job);
    if (r.ok) return r;
    const filed = await fileManualTask(job, r.error || 'eBay purchase did not complete');
    return {
      ok: false,
      mode: 'manual',
      provider: 'ebay',
      error: r.error || 'eBay purchase did not complete',
      needsCredential: r.needsCredential || null,
      priceMoved: r.priceMoved || false,
      quoted: r.quoted != null ? r.quoted : null,
      task: filed.task || null,
      taskError: filed.ok ? null : filed.error
    };
  }

  const why = provider === 'unknown'
    ? 'unrecognised source marketplace; no purchase provider'
    : provider + ' has no public purchase API; this order needs a human to buy it';
  const filed = await fileManualTask(job, why);
  return {
    ok: false,
    mode: 'manual',
    provider: provider,
    error: why,
    task: filed.task || null,
    taskError: filed.ok ? null : filed.error
  };
}

module.exports = {
  execute,
  buyFromCJ,
  providerFor,
  ebayItemId,
  fileManualTask,
  openTasks,
  closeTask,
  TASKS_KEY
};
