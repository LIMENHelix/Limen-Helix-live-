/**
 * relay-autonomy.js — the one chokepoint every autonomous Relay purchase must pass.
 *
 * Buying from a source marketplace moves money OUT. CLAUDE.md puts that in the
 * FORBIDDEN-autonomously category, not the metered one, so this module exists to make
 * "runs itself 24/7" true without handing the loop an unbounded card.
 *
 * THREE MODES (relay:autonomy.mode, settable from the control panel):
 *   off    nothing is bought. Orders still land and are recorded. Use to stop the world.
 *   queue  DEFAULT. Every purchase is authorised, costed and queued as 'awaiting-approval'.
 *          A human clicks approve and the buy executes. The loop still runs 24/7; only the
 *          money step waits.
 *   auto   The buy executes with no human, subject to EVERY limit below. This is the mode
 *          the operator asked for. It is deliberately not the default.
 *
 * LIMITS, all enforced in auto mode, all fail CLOSED:
 *   perOrderCapUsd    a single source purchase may not exceed this
 *   dailyCeilingUsd   total autonomous spend in a UTC day may not exceed this
 *   minMarginUsd      refuse to buy when the spread does not cover the work
 *   minMarginPct      same, proportionally
 *   requireFunds      the wallet that is ACTUALLY debited must cover it. For CJ that is
 *                     its prepaid wallet, read live; anything else falls back to PayPal.
 *                     This read PayPal for every purchase until 2026-09-03, and no Relay
 *                     purchase has ever debited PayPal — so it refused real sales on a
 *                     number about an unrelated account.
 *   velocityMaxOrders / velocityMaxUsd
 *                     RATE, not total: at most 3 purchases or $60 in any rolling hour.
 *                     The caps above are day totals and the day rolls at 19:00 local, so
 *                     nothing bounded how FAST money could leave. This is the limit that
 *                     does not depend on a human noticing.
 *
 * RESERVE THEN SETTLE: authorize() writes a reservation BEFORE the network call, so two
 * concurrent orders cannot both pass the daily ceiling. settle() converts it to a real
 * spend, release() gives it back if the buy failed. A crash between the two leaves the
 * money reserved, which is the safe direction to fail.
 */

const db = require('./limen-db');
// The ledger is money state: every transition goes through an atomic compare-and-replace
// with bounded retry, so two lambdas can never reserve against the same snapshot. See
// lib/relay-strict-store.js.
const strict = require('./relay-strict-store');

const KEY_CONFIG = 'relay:autonomy';
const KEY_LEDGER = 'relay:autonomy-ledger';
const LEDGER_PKEY = 'limen:' + KEY_LEDGER;

const DEFAULTS = {
  mode: 'queue',
  perOrderCapUsd: 75,
  dailyCeilingUsd: 250,
  minMarginUsd: 8,
  minMarginPct: 0.18,
  requireFunds: true,
  // RATE, not total. See _velocityCheck.
  velocityMaxOrders: 3,
  velocityMaxUsd: 60,
  updatedAt: null,
  updatedBy: null
};

const MODES = ['off', 'queue', 'auto'];

function _today() { return new Date().toISOString().slice(0, 10); }
function _id() { return 'auth_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9); }
function _round(n) { return Math.round(n * 100) / 100; }

async function getConfig() {
  let stored = null;
  try {
    stored = await db.get(KEY_CONFIG);
  } catch (e) {
    // Ledger unreachable. Fail closed: report 'off' so nothing spends.
    return Object.assign({}, DEFAULTS, { mode: 'off', degraded: true, degradedReason: e.message });
  }
  const cfg = Object.assign({}, DEFAULTS, stored && typeof stored === 'object' ? stored : {});
  if (MODES.indexOf(cfg.mode) === -1) cfg.mode = 'queue';
  return cfg;
}

async function setConfig(patch, who) {
  const cur = await getConfig();
  if (cur.degraded) return { ok: false, error: 'autonomy store unreachable; refusing to write' };

  const next = Object.assign({}, cur, {});
  delete next.degraded;
  delete next.degradedReason;

  if (patch.mode != null) {
    if (MODES.indexOf(patch.mode) === -1) return { ok: false, error: 'mode must be off|queue|auto' };
    next.mode = patch.mode;
  }
  ['perOrderCapUsd', 'dailyCeilingUsd', 'minMarginUsd', 'velocityMaxOrders', 'velocityMaxUsd'].forEach(function (k) {
    if (patch[k] != null) {
      const v = parseFloat(patch[k]);
      if (!isFinite(v) || v < 0) return;
      next[k] = _round(v);
    }
  });
  if (patch.minMarginPct != null) {
    const v = parseFloat(patch.minMarginPct);
    if (isFinite(v) && v >= 0 && v <= 1) next.minMarginPct = v;
  }
  if (patch.requireFunds != null) next.requireFunds = !!patch.requireFunds;

  next.updatedAt = new Date().toISOString();
  next.updatedBy = who || 'unknown';

  try {
    await db.set(KEY_CONFIG, next);
  } catch (e) {
    return { ok: false, error: 'write failed: ' + e.message };
  }
  return { ok: true, config: next };
}

async function _ledger() {
  try {
    const l = await strict.read(LEDGER_PKEY);
    return Array.isArray(l) ? l : [];
  } catch (e) {
    return null;   // null means unreachable, distinct from empty
  }
}

function _trimLedger(rows) {
  return rows.length > 4000 ? rows.slice(-4000) : rows;
}

// One mutate() wrapper per transition: retries are bounded, contention exhaustion and an
// unreachable store both fail CLOSED, and the mutation function sees a copy it can change
// without aliasing the stored value.
async function _ledgerTransition(fn, unreachable) {
  let out;
  try {
    out = await strict.mutate(LEDGER_PKEY, fn, { attempts: 5 });
  } catch (e) {
    return { ok: false, error: unreachable || ('ledger unreachable: ' + e.message) };
  }
  if (!out.committed) {
    return { ok: false, error: 'spend ledger changed under every attempt; failing closed' };
  }
  return out.result;
}

/**
 * Does the funding account cover this spend? → { ok } or { ok:false, reason }
 *
 * Factored out so authorize() and consumeApproved() ask the SAME question. Approval is a
 * human action with human-length delay: a balance that covered the purchase when the
 * reservation was made may not cover it an hour later, and the contract is "never spend
 * into overdraft", not "never start to".
 *
 * Fails CLOSED on an unreadable balance. Note the known limitation, stated rather than
 * hidden: getCurrentBalance() returns `cachedBalance || 0` on every error path, so an
 * outage currently arrives here as a confident $0 rather than as "cannot tell". That
 * refuses, which is the safe direction, but it refuses with the wrong REASON — and it
 * reads the PayPal balance, which is not the account a CJ purchase debits at all. Both
 * are the subject of the funding-source work; this function is where that fix lands.
 */
async function _fundsCover(cfg, amount, marketplace, rows, excludeId) {
  if (!cfg.requireFunds) return { ok: true };
  const need = _round(parseFloat(amount) || 0);
  if (!(need > 0)) return { ok: true };

  // WHICH WALLET IS ACTUALLY DEBITED.
  //
  // This check read a PayPal balance for every purchase, and no Relay purchase has ever
  // debited PayPal. CJ — the only unattended buy path — pays with payType 2 from its own
  // prepaid wallet (lib/relay-cj.js placeOrder). So the gate was refusing real sales on a
  // number unrelated to the money being spent: live PayPal read $0.00 while the question
  // "can we afford this" was about a different account entirely. Nothing in the client
  // could read the right one, which is why it went unnoticed.
  const isCJ = String(marketplace || '').toLowerCase() === 'cj';

  try {
    if (isCJ) {
      const cj = require('./relay-cj');
      const bal = await _cjBalance(cj);
      if (!bal.ok) {
        // Unreadable is NOT empty. Refusing either way is right, but the reason has to be
        // true, or the operator funds the wrong thing chasing a wrong message.
        return { ok: false, reason: 'could not read the CJ wallet (' + bal.error + '); failing closed' };
      }
      // MONEY ALREADY PROMISED. The wallet figure is cached for a minute and does not
      // move until CJ debits it, so two $25 orders inside that window both saw $40 and
      // both passed — the second customer pays and CJ then refuses to fill it. The
      // supplier backstop stops an overdraft; it does not stop a PAID, unfulfillable
      // order. Open reservations are spend we have already committed to, so they come off
      // the top before anything new is authorised.
      // The moment bal.available was true. A settled debit older than this is already
      // out of that number.
      //
      // HONEST NOTE: this stamp changes no outcome today, and a mutation that strips it
      // is not caught by any test. CJ_SETTLE_LAG_MS (5 min) is longer than
      // CJ_BALANCE_TTL_MS (1 min), so the lag bound dominates and reading `at` versus
      // Date.now() can never differ by enough to matter. It is kept because it is the
      // correct anchor - the question is when the FIGURE was true, not when we asked -
      // and it becomes load-bearing the moment the cache TTL grows past the lag. If you
      // raise CJ_BALANCE_TTL_MS, this line starts doing real work and needs a test.
      const snapshotAt = isFinite(bal.at) ? bal.at : Date.now();
      const committed = _round((rows || []).reduce(function (t, r) {
        if (!r) return t;
        // THE ROW BEING SPENT IS NOT ALSO A COMPETING COMMITMENT.
        // Leaving it in double-counted it: a $20 reservation against a $30 wallet was
        // subtracted as committed AND then required to fit in the $10 remainder, so an
        // approval needed twice the purchase price in the wallet and a paid order sat
        // unfulfillable. Exactly one rule in both gates: drop the row from what is
        // already committed, then count its amount once as the new spend.
        if (excludeId && r.id === excludeId) return t;
        if (String(r.marketplace || '').toLowerCase() !== 'cj') return t;
        // A RESERVATION is money promised but not yet taken. The wallet figure cannot
        // reflect it, so it comes off the top - unless it can no longer be spent.
        if (r.state === 'reserved') {
          // A RESERVATION NOBODY CAN SPEND IS NOT A COMMITMENT.
          //
          // Nothing sweeps the ledger, and consumeApproved refuses any row whose day is
          // not today, so a reservation stranded by a failed approval or a crash between
          // buy and settle stays 'reserved' forever. Counting it forever shrank the
          // spendable wallet on every future checkout - the same accumulating phantom
          // the settled-row bound fixes, arriving by a different door.
          //
          // Dropping it is correct on both branches: if the purchase never happened the
          // money never left, and if it did happen without settling, the wallet figure
          // already reflects it. Either way it is not owed twice.
          // 'Not today' is NOT that test on its own. r.day is stamped at authorize() and
          // the UTC date rolls at 19:00 America/Chicago - the middle of a trading day. A
          // reservation taken seconds before that roll is still IN FLIGHT: relay-engine
          // buys and settles it after authorize() returns, and CJ has not been paid yet.
          // Dropping it at the roll would let the next line spend the same dollars, which
          // is the exact overdraft this subtraction exists to stop, arriving once a day at
          // a predictable minute.
          //
          // Dead means dead: a foreign day AND older than any purchase can still be in
          // flight. An undateable row keeps counting, matching the settled branch below.
          const last = Date.parse(r.consumedAt || r.ts || '');
          if (r.day && r.day !== _today() && isFinite(last) &&
              (Date.now() - last) > RESERVATION_INFLIGHT_MS) return t;
          return t + (r.amount || 0);
        }
        if (r.state !== 'settled') return t;
        // A SETTLED debit is only still owing if the wallet figure PREDATES it.
        //
        // settle() flips the row the instant a purchase succeeds, but CJ debits its own
        // wallet on its own schedule, so for a moment the balance we hold is a
        // pre-purchase number and the debit does have to come off. Once we read a balance
        // AFTER the settlement, that money is already gone from the figure and
        // subtracting it again is double-counting.
        //
        // Counting every settled row without that bound was cumulative and permanent: the
        // ledger keeps 4000 rows across days, so a $100 wallet that had ever spent $20
        // reported $80 spendable, then $60 after the next $20, and so on until the gate
        // refused every real sale. The bug grew with the store's own success.
        const st = Date.parse(r.settledAt || '');
        // No timestamp means we cannot tell which side of the snapshot it fell on. Count
        // it: refusing a purchase we could afford is recoverable, authorising one the
        // wallet cannot cover leaves a customer paid and unfulfillable.
        if (!isFinite(st)) return t + (r.amount || 0);
        // The snapshot alone is not quite enough. (An earlier version of this comment
        // said settle() clears the balance cache. It does not - only release() does,
        // and only ever did.) The real gap is smaller but the same shape: CJ applies a
        // debit on its own schedule, so a balance read taken moments after settlement can
        // still be a pre-purchase figure while a bare snapshot bound calls that debit
        // accounted for. That fails OPEN, the one direction that ends with a paid,
        // unfulfillable order, so the bound carries a lag.
        //
        // So a debit stops counting only once a balance read is CJ_SETTLE_LAG_MS clear of
        // it - long enough for CJ to have applied it. Recent debits keep coming off the
        // top; old ones, which the wallet figure certainly already reflects, drop out.
        return st > (snapshotAt - CJ_SETTLE_LAG_MS) ? t + (r.amount || 0) : t;
      }, 0));
      const spendable = _round(bal.available - committed);
      if (spendable < need) {
        return {
          ok: false,
          reason: 'CJ wallet has $' + bal.available.toFixed(2) + ' with $' + committed.toFixed(2) +
                  ' already committed, leaving $' + spendable.toFixed(2) + ' for a $' + need.toFixed(2) + ' purchase'
        };
      }
      return { ok: true };
    }

    const paypal = require('./relay-paypal-balance');
    const bal = await paypal.getCurrentBalance();
    if (!(typeof bal === 'number' && isFinite(bal))) {
      return { ok: false, reason: 'could not read funding balance; failing closed' };
    }
    if (bal < need) {
      return { ok: false, reason: 'funding balance $' + bal.toFixed(2) + ' does not cover $' + need.toFixed(2) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'funding check failed: ' + e.message };
  }
}

/**
 * The CJ wallet, cached briefly. Every line of a cart runs this gate, and CJ serialises
 * its own calls at ~1.1s apiece, so an uncached read would add seconds to a customer's
 * checkout for an answer that cannot meaningfully change between lines.
 *
 * The window is short on purpose: a stale balance can only authorise a spend the wallet
 * cannot cover, and CJ itself refuses that at placeOrder. That is a real backstop, just
 * supplier-side rather than ours.
 */
let _cjBalCache = { at: 0, value: null };
const CJ_BALANCE_TTL_MS = 60 * 1000;
// How long CJ may take to apply a debit to the figure getBalance reports. A settled row
// keeps counting against the wallet until a balance read is this far past it.
const CJ_SETTLE_LAG_MS = 5 * 60 * 1000;
// The longest a reservation can still turn into a real debit. fulfillLine holds one
// across buy.execute - a CJ freight requote plus createOrderV2, each throttled to ~1.1s
// and each allowed RELAY_HTTP_TIMEOUT_MS (20s default) - then settles or releases it.
// Beyond this, a reservation on a dead day is genuinely stranded rather than in progress.
const RESERVATION_INFLIGHT_MS = 15 * 60 * 1000;

async function _cjBalance(cj) {
  if (_cjBalCache.value && (Date.now() - _cjBalCache.at) < CJ_BALANCE_TTL_MS) {
    return _cjBalCache.value;
  }
  const bal = await cj.balance({ timeoutMs: 4000 });
  // Only a GOOD answer is cached. Caching a failure would turn one blip into a minute of
  // refusals across every checkout.
  if (bal && bal.ok) {
    // Stamp WHEN this figure was true. _fundsCover needs it to tell a debit CJ has already
    // taken out of this number from one it has not taken yet.
    const at = Date.now();
    const stamped = Object.assign({}, bal, { at: at });
    _cjBalCache = { at: at, value: stamped };
    return stamped;
  }
  return bal;
}

/**
 * VELOCITY: a hard cap on the RATE of purchasing, not the total.
 *
 * perOrderCapUsd and dailyCeilingUsd are both totals, and _spentToday keys on the UTC
 * date — which rolls at 19:00 America/Chicago, so a runaway at 18:55 local gets a fresh
 * $250 five minutes later. Neither bounds how fast money leaves. A loop that has gone
 * wrong can spend the entire day's ceiling in one cycle and then do it again after the
 * boundary, and nothing stops it except somebody noticing.
 *
 * This is the limit that does not depend on somebody noticing: at most
 * VELOCITY_MAX_ORDERS purchases or VELOCITY_MAX_USD of source spend in any rolling
 * VELOCITY_WINDOW_MS. It is measured from reservation timestamps, so the window genuinely
 * rolls — an order that ages past the window stops counting on its own.
 */
const VELOCITY_WINDOW_MS = 60 * 60 * 1000;   // one rolling hour
const VELOCITY_MAX_ORDERS = 3;
const VELOCITY_MAX_USD = 60;

function _velocityCheck(cfg, rows, amount, excludeId, plannedOrders) {
  const maxOrders = cfg && isFinite(cfg.velocityMaxOrders) ? cfg.velocityMaxOrders : VELOCITY_MAX_ORDERS;
  const maxUsd = cfg && isFinite(cfg.velocityMaxUsd) ? cfg.velocityMaxUsd : VELOCITY_MAX_USD;
  const since = Date.now() - VELOCITY_WINDOW_MS;
  const recent = rows.filter(function (r) {
    if (!r || (r.state !== 'reserved' && r.state !== 'settled')) return false;
    if (excludeId && r.id === excludeId) return false;   // do not count the row being spent
    // WHEN THE MONEY COULD MOVE, not when the row was created. A queue reservation can
    // sit for hours; approving three aged rows in quick succession is a burst of real
    // spending, and keying on ts alone meant NONE of them counted — the rate limit was
    // defeated on exactly the path a human triggers. The latest stamp on the row is the
    // conservative choice: it keeps a purchase inside the window for longer, never less.
    const t = Math.max(
      r.ts ? new Date(r.ts).getTime() : 0,
      r.consumedAt ? new Date(r.consumedAt).getTime() : 0,
      r.settledAt ? new Date(r.settledAt).getTime() : 0
    );
    return t >= since;
  });
  const spent = _round(recent.reduce(function (s, r) { return s + (r.amount || 0); }, 0));
  const want = _round(parseFloat(amount) || 0);

  // Lines this caller is about to commit to but has not reserved. A dry run writes no
  // row, so a four-line cart saw a count of zero on every line, passed checkout, took the
  // money, and then blocked its fourth line at fulfilment. Refuse the basket, not the tail.
  const planned = Math.max(0, parseInt(plannedOrders, 10) || 0);
  if (recent.length + planned >= maxOrders) {
    return {
      ok: false,
      reason: (recent.length + planned) + ' purchases in the last hour reaches the ' +
              maxOrders + ' limit; the rate limit holds further orders until that window clears'
    };
  }
  if (_round(spent + want) > maxUsd) {
    return {
      ok: false,
      reason: '$' + want.toFixed(2) + ' plus $' + spent.toFixed(2) + ' spent in the last hour ' +
              'exceeds the $' + maxUsd + ' hourly rate limit'
    };
  }
  return { ok: true, ordersInWindow: recent.length, spentInWindow: spent };
}

/** Money committed today: reservations still open + settled spends. */
function _spentToday(rows) {
  const d = _today();
  return rows
    .filter(function (r) { return r.day === d && (r.state === 'reserved' || r.state === 'settled'); })
    .reduce(function (s, r) { return s + (r.amount || 0); }, 0);
}

/**
 * authorize({ amount, salePrice, marketplace, orderId, listingId, note })
 *   → { allowed, mode, decisionId, reason, remainingToday, config }
 *
 * allowed:true means AUTO mode cleared every limit and the caller may spend NOW.
 * allowed:false with mode 'queue' is the normal path: the reservation is held and a
 * human approves it. Check `queued` to tell that apart from a hard refusal.
 */
async function authorize(opts) {
  opts = opts || {};
  const amount = _round(parseFloat(opts.amount) || 0);
  const salePrice = parseFloat(opts.salePrice) || 0;
  const cfg = await getConfig();

  const base = { mode: cfg.mode, config: cfg, decisionId: null, queued: false, allowed: false };

  if (!(amount > 0)) {
    return Object.assign(base, { reason: 'amount must be > 0' });
  }
  if (cfg.degraded) {
    return Object.assign(base, { reason: 'autonomy store unreachable; failing closed (' + cfg.degradedReason + ')' });
  }
  if (cfg.mode === 'off') {
    return Object.assign(base, { reason: 'autonomy is OFF; no purchases are being made' });
  }

  // Every limit is evaluated against the SAME ledger version the reservation is then
  // committed onto. If a concurrent writer wins the compare-and-replace, the whole
  // evaluation re-runs against the NEW ledger — caps are never checked against a snapshot
  // that no longer exists, and two concurrent authorisations cannot both fit because each
  // saw the other one's missing row.
  let out;
  try {
    out = await strict.mutate(LEDGER_PKEY, async function (rowsIn) {
      // FRESH per attempt: a refusal on a retry must not inherit the previous attempt's
      // allowed/decisionId fields from a shared object.
      const b0 = { mode: cfg.mode, config: cfg, decisionId: null, queued: false, allowed: false };
      const rows = Array.isArray(rowsIn) ? rowsIn : [];

      // ── margin check: never buy a spread that does not pay for itself ──
      const marginUsd = _round(salePrice - amount);
      const marginPct = salePrice > 0 ? marginUsd / salePrice : 0;
      const marginChecked = salePrice > 0;
      if (marginChecked && marginUsd < cfg.minMarginUsd) {
        return { result: Object.assign(b0, {
          reason: 'margin $' + marginUsd.toFixed(2) + ' is under the $' + cfg.minMarginUsd + ' floor'
        }) };
      }
      if (marginChecked && marginPct < cfg.minMarginPct) {
        return { result: Object.assign(b0, {
          reason: 'margin ' + (marginPct * 100).toFixed(1) + '% is under the ' +
                  (cfg.minMarginPct * 100).toFixed(0) + '% floor'
        }) };
      }

      // ── per-order cap ──
      if (amount > cfg.perOrderCapUsd) {
        return { result: Object.assign(b0, {
          reason: '$' + amount.toFixed(2) + ' exceeds the $' + cfg.perOrderCapUsd + ' per-order cap'
        }) };
      }

      // ── daily ceiling ──
      // `plannedToday` is spend a caller is about to commit to in the same breath but has
      // not reserved yet: the other lines of a cart. Without it every line of a cart
      // dry-runs against the same untouched ledger, so two $60 lines both pass against
      // $100 remaining, the customer is charged for both, and the SECOND real
      // authorisation during fulfilment is the one that discovers it — on a paid order.
      const planned = Math.max(0, parseFloat(opts.plannedToday) || 0);
      const spent = _spentToday(rows);
      const remaining = _round(cfg.dailyCeilingUsd - spent);
      if (_round(amount + planned) > remaining) {
        return { result: Object.assign(b0, {
          remainingToday: remaining,
          reason: planned > 0
            ? '$' + amount.toFixed(2) + ' plus $' + planned.toFixed(2) + ' already in this cart ' +
              'exceeds today\'s remaining ceiling of $' + remaining.toFixed(2)
            : '$' + amount.toFixed(2) + ' exceeds today\'s remaining ceiling of $' + remaining.toFixed(2)
        }) };
      }

      // ── velocity: how FAST, not how much ──
      const vel = _velocityCheck(cfg, rows, _round(amount + planned), null, opts.plannedOrders);
      if (!vel.ok) return { result: Object.assign(b0, { remainingToday: remaining, reason: vel.reason }) };

      // ── real funds ──
      // SKIPPED ONLY FOR A PUBLISH-TIME DRY RUN. skipFunds is honoured exclusively in
      // combination with dryRun, so it can never weaken an authorisation that is about to
      // spend: a caller that omits dryRun gets the funding check whatever it passes here.
      //
      // WHY, so nobody helpfully removes this later. Publishing a listing moves no money.
      // Whether the CJ wallet is funded is a question for the PURCHASE, which happens
      // hours or days later against a wallet that will have moved. Asking it at publish
      // time couples the storefront's existence to the wallet's balance: with the wallet
      // at $0.00, as it is today, a publish gate that ran this check would refuse every
      // item and the storefront would go empty. The gate exists to stop us LISTING what
      // we would refuse to BUY on margin and limit grounds, not to stop us listing while
      // we are broke.
      const skipFunds = opts.dryRun === true && opts.skipFunds === true;
      if (!skipFunds) {
        const funds = await _fundsCover(cfg, _round(amount + planned), opts.marketplace, rows);
        if (!funds.ok) return { result: Object.assign(b0, { remainingToday: remaining, reason: funds.reason }) };
      }

      // ── a dry run answers, without taking a reservation ──
      // Checkout asks this before charging anybody, so a sale the fulfilment loop would
      // refuse is refused while refusing is still free. It deliberately runs the SAME
      // code: a second copy of these rules living in the checkout handlers would drift
      // from this one inside a release, and the copy that matters is this one.
      if (opts.dryRun) {
        return { result: Object.assign(b0, {
          allowed: true,
          queued: cfg.mode === 'queue',
          remainingToday: remaining,
          dryRun: true,
          reason: null
        }) };
      }

      // ── reserve BEFORE the caller spends ──
      const decisionId = _id();
      const row = {
        id: decisionId,
        day: _today(),
        ts: new Date().toISOString(),
        state: 'reserved',
        amount: amount,
        salePrice: salePrice || null,
        marginUsd: marginChecked ? marginUsd : null,
        marketplace: opts.marketplace || null,
        orderId: opts.orderId || null,
        listingId: opts.listingId || null,
        mode: cfg.mode,
        note: opts.note || null
      };
      const next = _trimLedger(rows.concat([row]));

      if (cfg.mode === 'queue') {
        return { write: true, value: next, result: Object.assign(b0, {
          allowed: false,
          queued: true,
          decisionId: decisionId,
          remainingToday: _round(remaining - amount),
          reason: 'queued for human approval (mode=queue)'
        }) };
      }

      return { write: true, value: next, result: Object.assign(b0, {
        allowed: true,
        decisionId: decisionId,
        remainingToday: _round(remaining - amount),
        reason: null
      }) };
    }, { attempts: 5 });
  } catch (e) {
    return Object.assign(base, { reason: 'spend ledger unreachable; failing closed' });
  }
  if (!out.committed) {
    // Bounded retries exhausted: every version we evaluated was already gone. Refusing
    // is the only answer that cannot overspend.
    return Object.assign(base, { reason: 'spend ledger changed under every attempt; failing closed' });
  }
  return out.result;
}

/** The buy went through. Convert the reservation into a settled spend. */
async function settle(decisionId, actual) {
  return _ledgerTransition(function (rowsIn) {
    const rows = Array.isArray(rowsIn) ? rowsIn : [];
    const idx = rows.findIndex(function (r) { return r.id === decisionId; });
    if (idx === -1) return { result: { ok: false, error: 'no such reservation' } };
    const row = rows[idx];
    if (row.state === 'settled') return { result: { ok: true, row: row, already: true } };
    // A RELEASED reservation is money given back. Flipping it to settled would book a
    // spend that the release already returned to the day's headroom — the settle/release
    // race must end in exactly one terminal state, and the first writer wins.
    if (row.state === 'released') return { result: { ok: false, error: 'already released; cannot settle' } };
    const updated = Object.assign({}, row, {
      state: 'settled',
      settledAt: new Date().toISOString()
    });
    if (actual && actual.amount != null) updated.amount = _round(parseFloat(actual.amount));
    if (actual && actual.sourceOrderId) updated.sourceOrderId = actual.sourceOrderId;
    const next = rows.slice();
    next[idx] = updated;
    return { write: true, value: _trimLedger(next), result: { ok: true, row: updated } };
  }, 'ledger unreachable');
}

/** The buy failed or was rejected. Give the headroom back. */
async function release(decisionId, reason) {
  _cjBalCache = { at: 0, value: null };   // money came back; re-read rather than guess
  return _ledgerTransition(function (rowsIn) {
    const rows = Array.isArray(rowsIn) ? rowsIn : [];
    const idx = rows.findIndex(function (r) { return r.id === decisionId; });
    if (idx === -1) return { result: { ok: false, error: 'no such reservation' } };
    const row = rows[idx];
    if (row.state === 'settled') return { result: { ok: false, error: 'already settled; cannot release' } };
    if (row.state === 'released') return { result: { ok: true, row: row, already: true } };
    const updated = Object.assign({}, row, {
      state: 'released',
      releasedAt: new Date().toISOString(),
      releaseReason: reason || null
    });
    const next = rows.slice();
    next[idx] = updated;
    return { write: true, value: _trimLedger(next), result: { ok: true, row: updated } };
  }, 'ledger unreachable');
}

/** Approve a queued reservation so the caller may now spend it. */
async function approve(decisionId, who) {
  return _ledgerTransition(function (rowsIn) {
    const rows = Array.isArray(rowsIn) ? rowsIn : [];
    const idx = rows.findIndex(function (r) { return r.id === decisionId; });
    if (idx === -1) return { result: { ok: false, error: 'no such reservation' } };
    const row = rows[idx];
    if (row.state !== 'reserved') return { result: { ok: false, error: 'reservation is ' + row.state + ', not reserved' } };
    // THE DAY CHECK BELONGS HERE, BEFORE ANYTHING IS WRITTEN.
    //
    // consumeApproved refuses a stale-day approval, but it does so AFTER this function has
    // already stamped approvedAt. pending() filters on !approvedAt, so the click that was
    // about to be rejected is exactly what removed the row from the operator's list: the
    // purchase then refuses, the row stays 'reserved' forever, and the PAID line is
    // stranded with nothing anywhere showing it. _today() is UTC, so the boundary is
    // 19:00 America/Chicago, in the middle of a working evening.
    //
    // Refusing here costs the operator a dead end they can SEE instead of a silence they
    // cannot. It creates no new consume path and moves no money; it only narrows what
    // approve() will accept. consumeApproved's own check stays exactly where it is as the
    // last line of defence, and the wording matches it so both gates say the same thing.
    //
    // What this does NOT do: recover a row already stranded by the old behaviour, or give
    // the operator a way forward from the dead end. Both are deferred deliberately, the
    // first because telling a mid-purchase row from a stranded one needs the in-flight
    // window, the second because re-authorising is a new consume path.
    if (row.day !== _today()) {
      return { result: { ok: false, error: 'that approval is from ' + row.day + ' and cannot be spent today' } };
    }
    const updated = Object.assign({}, row, {
      approvedAt: new Date().toISOString(),
      approvedBy: who || 'operator'
    });
    const next = rows.slice();
    next[idx] = updated;
    return { write: true, value: _trimLedger(next), result: { ok: true, row: updated } };
  }, 'ledger unreachable');
}

/**
 * consumeApproved({ decisionId, orderId, listingId, amount })
 *   → { allowed:true, decisionId, ... }   the human's approval is spent, buy now
 *   → { allowed:false, reason }           not consumable; caller falls back to authorize()
 *
 * THE DEFECT THIS CLOSES
 * approve() stamped approvedAt and nothing ever read it. fulfillLine called authorize()
 * again, which in queue mode created a SECOND reservation and re-queued, so the click
 * bought nothing — and neither reservation was ever settled or released, so every click
 * burned the line cost twice out of dailyCeilingUsd until the UTC day rolled.
 *
 * This is a GATE, not a bypass. Everything authorize() would refuse, this refuses:
 *
 *   mode 'off'      the kill switch means nothing is bought. An approval granted before
 *                   the switch was thrown is not permission to spend after it.
 *   degraded        an unreadable config fails closed, exactly as authorize() does.
 *   queue only      the row must have been reserved in queue mode. An in-flight 'auto'
 *                   reservation, or one orphaned by a crash, is not something a human
 *                   approved — approve() will stamp any reserved row, so this is the
 *                   check that makes the stamp mean what it says.
 *   funds           re-checked HERE. Approval is a human action with human-length delay;
 *                   a balance that covered the purchase at reserve time may not cover it
 *                   an hour later, and requireFunds says "never spend into overdraft",
 *                   not "never start to".
 *   binding         the row must be for this order, this listing, and the same amount.
 *   same day        a reservation counts against the day it was made; consuming it on a
 *                   later day would spend against a ceiling it was never counted in.
 *
 * The row is NOT settled here. It stays 'reserved' so it still counts against today's
 * ceiling while the purchase is in flight, and the caller settles or releases it exactly
 * as it does for a fresh authorize() — one reservation, one outcome.
 */
async function consumeApproved(opts) {
  opts = opts || {};
  const cfg = await getConfig();
  const base = { mode: cfg.mode, config: cfg, decisionId: null, queued: false, allowed: false };

  if (cfg.degraded) {
    return Object.assign(base, { reason: 'autonomy store unreachable; failing closed (' + cfg.degradedReason + ')' });
  }
  if (cfg.mode === 'off') {
    return Object.assign(base, { reason: 'autonomy is OFF; an earlier approval does not authorise a purchase now' });
  }
  if (!opts.decisionId) return Object.assign(base, { reason: 'no decisionId' });

  // As in authorize(), every check runs against the version the consumedAt stamp is
  // committed onto; a lost race re-reads and re-checks rather than spending blind.
  let out;
  try {
    out = await strict.mutate(LEDGER_PKEY, async function (rows) {
      const b0 = { mode: cfg.mode, config: cfg, decisionId: null, queued: false, allowed: false };
      const row = (Array.isArray(rows) ? rows : []).find(function (r) { return r.id === opts.decisionId; });
      if (!row) return { result: Object.assign(b0, { reason: 'no such reservation' }) };
  // A BINDING MISMATCH IS NOT A REFUSAL, IT IS 'NOT THIS LINE'. fulfillPaidOrder hands
  // the same decisionId to every unfinished line of a multi-line order, so the other lines
  // land here. Reporting a plain refusal made them fall through to a fresh authorize(),
  // duplicating their still-live reservations and manual tasks and double-counting the
  // day's and the hour's capacity. The caller needs to tell the two apart.
      if (opts.orderId && row.orderId && row.orderId !== opts.orderId) {
        return { result: Object.assign(b0, { mismatch: true, reason: 'that reservation belongs to a different order' }) };
      }
      if (opts.listingId && row.listingId && row.listingId !== opts.listingId) {
        return { result: Object.assign(b0, { mismatch: true, reason: 'that reservation belongs to a different line' }) };
      }
      if (row.state !== 'reserved') return { result: Object.assign(b0, { reason: 'reservation is ' + row.state + ', not reserved' }) };
      if (!row.approvedAt) return { result: Object.assign(b0, { reason: 'that reservation has not been approved' }) };
      if (row.mode !== 'queue') return { result: Object.assign(b0, { reason: 'that reservation was not queued for approval' }) };
      if (row.consumedAt) return { result: Object.assign(b0, { reason: 'that approval has already been used' }) };
      if (row.day !== _today()) return { result: Object.assign(b0, { reason: 'that approval is from ' + row.day + ' and cannot be spent today' }) };
  // The amount must not have grown since the human looked at it. A freight requote can
  // move it, and an approval is of a number, not of an intention.
      const want = _round(parseFloat(opts.amount) || 0);
      if (want > 0 && row.amount != null && want > _round(row.amount) + 0.005) {
        return { result: Object.assign(b0, {
          reason: 'this line now costs $' + want.toFixed(2) + ', more than the $' +
                  Number(row.amount).toFixed(2) + ' that was approved'
        }) };
      }

      // EVERY LIMIT AS IT STANDS NOW, not as it stood when the row was reserved.
      //
      // An approval is a human action with human-length delay, and limits get tightened
      // for a reason — usually because something has gone wrong. Re-checking only funds
      // and rate meant a pending approval could still spend past a per-order cap that had
      // since been lowered, a daily ceiling that had been cut, or a margin floor that had
      // been raised. A queue of stale approvals that outrank current configuration is not
      // a safety gate.
      if (row.amount > cfg.perOrderCapUsd) {
        return { result: Object.assign(b0, {
          reason: '$' + Number(row.amount).toFixed(2) + ' now exceeds the $' + cfg.perOrderCapUsd + ' per-order cap'
        }) };
      }
      // The row is already counted in spentToday as a live reservation, so the question is
      // whether the day as it stands still fits the ceiling as it stands.
      const spentNow = _spentToday(rows);
      if (spentNow > cfg.dailyCeilingUsd) {
        return { result: Object.assign(b0, {
          reason: '$' + spentNow.toFixed(2) + ' committed today is over the $' + cfg.dailyCeilingUsd + ' ceiling'
        }) };
      }
      if (row.salePrice > 0) {
        const m = _round(row.salePrice - row.amount);
        const pct = m / row.salePrice;
        if (m < cfg.minMarginUsd) {
          return { result: Object.assign(b0, {
            reason: 'margin $' + m.toFixed(2) + ' is under the $' + cfg.minMarginUsd + ' floor as it stands now'
          }) };
        }
        if (pct < cfg.minMarginPct) {
          return { result: Object.assign(b0, {
            reason: 'margin ' + (pct * 100).toFixed(1) + '% is under the ' +
                    (cfg.minMarginPct * 100).toFixed(0) + '% floor as it stands now'
          }) };
        }
      }

      // Clicking approve repeatedly must not outrun the rate limit either. The row being
      // spent is excluded, or it would count itself out.
      // The SAME rule on the dollar side: the row is out of the snapshot, so its amount
      // has to be passed in as the spend. Passing 0 meant the purchase being released
      // never counted at all — two overnight $40 approvals both cleared a $60 hourly cap
      // and $80 moved inside the hour.
      const vel = _velocityCheck(cfg, rows, row.amount, row.id);
      if (!vel.ok) return { result: Object.assign(b0, { reason: vel.reason }) };

      const funds = await _fundsCover(cfg, row.amount, row.marketplace, rows, row.id);
      if (!funds.ok) return { result: Object.assign(b0, { reason: funds.reason }) };

      const idx = rows.findIndex(function (r) { return r.id === row.id; });
      const updated = Object.assign({}, row, { consumedAt: new Date().toISOString() });
      const next = rows.slice();
      next[idx] = updated;
      return { write: true, value: _trimLedger(next), result: Object.assign(b0, {
        allowed: true,
        decisionId: row.id,
        approvedBy: row.approvedBy || null,
        reason: null
      }) };
    }, { attempts: 5 });
  } catch (e) {
    return Object.assign(base, { reason: 'spend ledger unreachable; failing closed' });
  }
  if (!out.committed) {
    return Object.assign(base, { reason: 'spend ledger changed under every attempt; failing closed' });
  }
  return out.result;
}

/**
 * Read one ledger row. Throws when the ledger cannot be read, because callers use this
 * to decide whether money may already have moved — "cannot tell" must never look like
 * "no such reservation".
 */
async function getDecision(decisionId) {
  const rows = await _ledger();
  if (rows === null) throw new Error('spend ledger unreachable');
  return rows.find(function (r) { return r.id === decisionId; }) || null;
}

/**
 * Stamp a reservation just BEFORE createOrderV2 fires. If the process then dies with the
 * supplier's answer unheard, the row still carries the orderNumber a later reconciliation
 * can ask CJ about — the difference between "outcome unknown, go look" and "money
 * silently gone".
 */
async function noteCjAttempt(decisionId, orderNumber) {
  return _ledgerTransition(function (rowsIn) {
    const rows = Array.isArray(rowsIn) ? rowsIn : [];
    const idx = rows.findIndex(function (r) { return r.id === decisionId; });
    if (idx === -1) return { result: { ok: false, error: 'no such reservation' } };
    const row = rows[idx];
    if (row.state !== 'reserved') return { result: { ok: false, error: 'reservation is ' + row.state + ', not reserved' } };
    const updated = Object.assign({}, row, {
      cjOrderNumber: row.cjOrderNumber || String(orderNumber),
      cjAttemptedAt: row.cjAttemptedAt || new Date().toISOString()
    });
    const next = rows.slice();
    next[idx] = updated;
    return { write: true, value: _trimLedger(next), result: { ok: true, row: updated } };
  }, 'ledger unreachable');
}

/**
 * The supplier's answer is unknowable right now (timeout after a possible accept, an
 * accepted order with no id, an ambiguous readback). Hold the reservation and say so on
 * the row, so nothing releases spend that may already be spent and the engine's
 * reconciliation pass knows to ask CJ instead.
 */
async function markReconciliationPending(decisionId, info) {
  info = info || {};
  return _ledgerTransition(function (rowsIn) {
    const rows = Array.isArray(rowsIn) ? rowsIn : [];
    const idx = rows.findIndex(function (r) { return r.id === decisionId; });
    if (idx === -1) return { result: { ok: false, error: 'no such reservation' } };
    const row = rows[idx];
    if (row.state !== 'reserved') return { result: { ok: false, error: 'reservation is ' + row.state + ', not reserved' } };
    const updated = Object.assign({}, row, {
      cjOrderNumber: row.cjOrderNumber || (info.orderNumber ? String(info.orderNumber) : undefined),
      reconciliationPending: {
        at: new Date().toISOString(),
        orderNumber: info.orderNumber ? String(info.orderNumber) : (row.cjOrderNumber || null),
        error: info.error || null
      }
    });
    const next = rows.slice();
    next[idx] = updated;
    return { write: true, value: _trimLedger(next), result: { ok: true, row: updated } };
  }, 'ledger unreachable');
}

/**
 * The line's reservation from an attempt whose outcome was never learned. fulfilment
 * reuses THIS row on retry instead of authorising a second one, so one line can only
 * ever hold one open commitment.
 */
async function findHeldLineReservation(orderId, listingId) {
  const rows = await _ledger();
  if (rows === null) return null;
  const matches = rows.filter(function (r) {
    return r && r.state === 'reserved' && r.cjAttemptedAt &&
           r.orderId === orderId && r.listingId === listingId;
  });
  if (!matches.length) return null;
  return matches[matches.length - 1];
}

/**
 * CJ reservations stuck nonterminal after an attempt: explicitly marked
 * reconciliation-pending, or older than any purchase can still be in flight. Bounded and
 * oldest-first, for the engine's per-cycle reconciliation pass.
 */
async function listHeldCjAttempts(opts) {
  opts = opts || {};
  const olderThanMs = parseInt(opts.olderThanMs, 10) || RESERVATION_INFLIGHT_MS;
  const limit = Math.max(1, parseInt(opts.limit, 10) || 5);
  const rows = await _ledger();
  if (rows === null) return [];
  return rows.filter(function (r) {
    if (!r || r.state !== 'reserved') return false;
    if (String(r.marketplace || '').toLowerCase() !== 'cj') return false;
    if (!r.cjAttemptedAt) return false;
    if (r.reconciliationPending) return true;
    const at = Date.parse(r.cjAttemptedAt);
    return isFinite(at) && (Date.now() - at) > olderThanMs;
  }).sort(function (a, b) {
    return Date.parse(a.cjAttemptedAt) - Date.parse(b.cjAttemptedAt);
  }).slice(0, limit);
}

async function pending() {
  const rows = await _ledger();
  if (rows === null) return [];
  // QUEUE ROWS ONLY. An auto-mode reservation is reserved and unapproved for the whole
  // time its purchase is in flight, so it used to appear here as something the operator
  // could click. Clicking it could not work (consumeApproved refuses a non-queue row)
  // and, before the caller stopped falling through to authorize(), that refusal started
  // a second purchase of a line that was already being bought. Nothing in auto mode is
  // awaiting a human, so nothing in auto mode belongs on the list of things that are.
  return rows.filter(function (r) {
    return r.state === 'reserved' && !r.approvedAt && r.mode === 'queue';
  });
}

async function status() {
  const cfg = await getConfig();
  const rows = await _ledger();
  if (rows === null) {
    return { ok: false, error: 'ledger unreachable', config: cfg };
  }
  const d = _today();
  const today = rows.filter(function (r) { return r.day === d; });
  const settled = today.filter(function (r) { return r.state === 'settled'; });
  const reserved = today.filter(function (r) { return r.state === 'reserved'; });
  const spent = _spentToday(rows);
  return {
    ok: true,
    date: d,
    config: cfg,
    mode: cfg.mode,
    spentToday: _round(spent),
    remainingToday: _round(cfg.dailyCeilingUsd - spent),
    settledCount: settled.length,
    reservedCount: reserved.length,
    awaitingApproval: reserved.filter(function (r) { return !r.approvedAt; }).length,
    marginToday: _round(settled.reduce(function (s, r) { return s + (r.marginUsd || 0); }, 0))
  };
}

module.exports = {
  MODES,
  DEFAULTS,
  getConfig,
  setConfig,
  authorize,
  consumeApproved,
  settle,
  release,
  approve,
  pending,
  status,
  getDecision,
  noteCjAttempt,
  markReconciliationPending,
  findHeldLineReservation,
  listHeldCjAttempts
};
