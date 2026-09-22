/**
 * checkout-result.js — the post-checkout banner for every domain front.
 *
 * Generalizes the pattern that civic-desk.js:48-56 and soft-desk.js proved on
 * seven fronts: after Stripe sends a buyer back to /<domain>?bought=<rung>,
 * the page says so — what happens next, and when the receipt arrives — instead
 * of landing them on a page that looks like nothing happened. A cancelled
 * checkout (?checkout=cancelled) gets a neutral line, not an error.
 *
 * INCLUDED BY ALL TWENTY DOMAIN FRONTS. Two host strategies:
 *   1. The page already has a host (the civic/soft desks' #deskBanner): we fill
 *      it, using its own desk-banner classes so nothing about the page changes.
 *   2. No host: we create one at the top of the page's main container with a
 *      small inline style that matches the fronts' dark theme.
 *
 * Pure render: reads the query string, writes the banner. No network, no state.
 * Exposed as window.LIMEN_CHECKOUT_RESULT so the desk scripts can delegate
 * their banner() to this one implementation instead of keeping a second copy.
 */
(function (root) {
  'use strict';

  var STYLE_ID = 'checkout-result-style';

  function qs() {
    try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(); }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.checkout-result{display:block;margin:16px 18px 0;padding:12px 14px;border-radius:8px;' +
      'background:rgba(126,179,232,0.08);border:1px solid rgba(126,179,232,0.25);font-size:14px;' +
      'color:#cdd6e4;line-height:1.55}' +
      '.checkout-result.ok{color:#9fd6ae;border-color:rgba(111,175,138,0.4);background:rgba(111,175,138,0.07)}' +
      '.checkout-result a{color:#7eb3e8}';
    (document.head || document.documentElement).appendChild(st);
  }

  function findHost() {
    var el = document.getElementById('checkout-result') || document.getElementById('deskBanner');
    if (el) return { el: el, owned: false };
    // No host on this page: make one at the top of the main container.
    var parent = document.querySelector('main') ||
                 document.querySelector('.wrap') ||
                 document.querySelector('.page') ||
                 document.body;
    if (!parent) return null;
    el = document.createElement('div');
    el.id = 'checkout-result';
    parent.insertBefore(el, parent.firstChild);
    return { el: el, owned: true };
  }

  function successHtml(rung) {
    return 'You are subscribed' + (rung ? ' (' + String(rung).replace(/[^a-z0-9-]/gi, '') + ')' : '') + '. ' +
      'What happens next: a receipt and welcome email from us arrives at the address you gave at checkout, ' +
      'and your first briefing goes out on the next run of this watch. ' +
      'Manage or cancel your subscription any time at <a href="/cancel">limenhelix.com/cancel</a>.';
  }

  var CANCELLED_TEXT = 'Checkout cancelled — nothing was charged. The free desk is still yours.';

  /**
   * Render into a host. `hostId` optional: omitted, we find or create the host.
   * Returns true if a banner was shown (there was something to say).
   */
  function banner(hostId) {
    var q = qs();
    var bought = q.get('bought');
    var cancelled = q.get('checkout') === 'cancelled';
    if (!bought && !cancelled) return false;

    var host = hostId
      ? { el: document.getElementById(hostId), owned: false }
      : findHost();
    if (!host || !host.el) return false;
    var el = host.el;

    if (host.owned) {
      ensureStyle();
      el.className = 'checkout-result' + (bought ? ' ok' : '');
    } else {
      // A page-owned host (desk-banner) keeps its own classes.
      el.className = 'desk-banner' + (bought ? ' ok' : '');
    }
    el.hidden = false;
    if (bought) el.innerHTML = successHtml(bought);
    else el.textContent = CANCELLED_TEXT;
    return true;
  }

  root.LIMEN_CHECKOUT_RESULT = { banner: banner };

  function auto() { banner(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', auto);
  } else {
    auto();
  }
})(typeof window !== 'undefined' ? window : this);
