/**
 * civic-desk.js — shared helpers for the Civic-domain product desks
 * (intelligence, population, law, governance). Loaded only by those four pages.
 *
 * Does not start checkout itself. Paid CTAs stay ordinary links to
 * /api/checkout?start=1&domain=&rung= so a visitor can open Stripe
 * without JavaScript.
 *
 * Soft 3 (culture / religion / education) uses assets/js/soft-desk.js.
 * This file is a sibling, not a replacement.
 */
(function (root) {
  function qs() {
    try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(); }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function money(n, dp) {
    var v = Number(n);
    if (!isFinite(v)) return 'n/a';
    return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(dp == null ? 2 : dp);
  }

  function bigUsd(n) {
    if (n == null || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }

  function intc(n) {
    var v = Number(n);
    if (!isFinite(v)) return 'n/a';
    return Math.round(v).toLocaleString();
  }

  function banner(hostId) {
    var el = document.getElementById(hostId);
    if (!el) return;
    var q = qs();
    if (q.get('bought')) {
      el.hidden = false;
      el.className = 'desk-banner ok';
      el.textContent = 'You are in. We will watch what you named on checkout.';
    } else if (q.get('checkout') === 'cancelled') {
      el.hidden = false;
      el.className = 'desk-banner';
      el.textContent = 'Checkout cancelled. The free desk is still yours.';
    }
  }

  function lead(opts) {
    var nm = document.getElementById(opts.nameId);
    var em = document.getElementById(opts.emailId);
    var cs = document.getElementById(opts.consentId);
    var btn = document.getElementById(opts.btnId);
    var st = document.getElementById(opts.statId);
    if (!em || !btn || !st) return;
    btn.addEventListener('click', function () {
      var email = (em.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        st.style.color = 'var(--bad)';
        st.textContent = 'Enter a valid email.';
        return;
      }
      if (cs && !cs.checked) {
        st.style.color = 'var(--bad)';
        st.textContent = 'Please agree to be contacted.';
        return;
      }
      st.style.color = 'var(--accent)';
      st.textContent = 'Saving…';
      btn.disabled = true;
      fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: nm ? (nm.value || '').trim() : '',
          email: email,
          consent: true,
          interest: opts.interest,
          sourcePage: opts.sourcePage,
          domain: opts.domain,
          tier: opts.tier || 'watchlist'
        })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) {
          st.style.color = 'var(--ok)';
          st.textContent = 'You are on the list. Thank you.';
          if (nm) nm.value = '';
          em.value = '';
        } else {
          st.style.color = 'var(--bad)';
          st.textContent = (j && j.error) || 'Could not save. Try again.';
        }
      }).catch(function () {
        st.style.color = 'var(--bad)';
        st.textContent = 'Network error. Try again.';
      }).finally(function () { btn.disabled = false; });
    });
  }

  function fail(msg) {
    return '<div class="fail"><b>Not available right now.</b> ' + esc(msg) + '</div>';
  }

  function freshness(j) {
    if (!j) return '';
    var bits = [];
    if (j.asOf) bits.push('as of ' + j.asOf);
    if (j.updated) bits.push('read ' + String(j.updated).slice(0, 16).replace('T', ' ') + ' UTC');
    if (j.stale) bits.push('stale' + (j.staleReason ? ': ' + j.staleReason : ''));
    return bits.join(' · ');
  }

  root.LIMEN_CIVIC_DESK = {
    qs: qs, esc: esc, money: money, bigUsd: bigUsd, intc: intc,
    banner: banner, lead: lead, fail: fail, freshness: freshness
  };
})(window);
