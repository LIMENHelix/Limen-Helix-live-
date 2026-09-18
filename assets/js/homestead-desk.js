/**
 * homestead-desk.js — Homestead Read + waitlist on /economy and /economy/homestead.
 * Does not start Stripe. Paid L1 stays an ordinary link to /api/checkout?start=1.
 */
(function (root) {
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function track(event, extra) {
    try {
      fetch('/api/homestead-events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ event: event }, extra || {}))
      }).catch(function () {});
    } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('limen:homestead', { detail: { event: event } })); } catch (e2) {}
  }

  function resources(list) {
    return (list || []).map(function (r) {
      return '<a class="hs-res" href="' + esc(r.url) + '" target="_blank" rel="noopener">' +
        '<b>' + esc(r.name) + '</b><span>' + esc(r.why || '') + '</span></a>';
    }).join('');
  }

  function options(list) {
    return '<ol class="hs-opts">' + (list || []).map(function (o) {
      return '<li><b>' + esc(o.t) + '</b> ' + esc(o.d) + '</li>';
    }).join('') + '</ol>';
  }

  function renderRead(j) {
    if (!j || !j.ok) {
      return '<div class="hs-fail">' + esc((j && (j.reason || j.error)) || 'Could not read that place.') + '</div>';
    }
    var p = j.place || {};
    var where = [p.matchedAddress || p.place, p.county, p.state, p.zip].filter(Boolean).join(' · ');
    var ticks = (j.stages || []).map(function (s) {
      return '<span class="hs-tick' + (s.current ? ' on' : '') + '">' + esc(s.label) + '</span>';
    }).join('');
    return '<div class="hs-verdict">Educational stage: <b>' + esc(j.label) + '</b></div>' +
      '<p class="hs-plain">' + esc(j.plain) + '</p>' +
      '<div class="hs-ticks">' + ticks + '</div>' +
      (where ? '<div class="hs-place">' + esc(where) + '</div>' : '') +
      '<div class="hs-fresh">' + esc(j.freshness && j.freshness.label) +
      (j.freshness && j.freshness.asOf ? ' Freshness: ' + esc(j.freshness.asOf) + '.' : '') + '</div>' +
      '<h3>What people in this stage typically do next</h3>' +
      options(j.options) +
      '<h3>Official resources</h3>' +
      '<div class="hs-reslist">' + resources(j.resources) + '</div>' +
      '<div class="hs-disc">' + esc(j.disclaimer) + '</div>' +
      '<div class="hs-up">' +
        '<a class="hs-btn" href="/api/checkout?start=1&amp;domain=economy&amp;rung=p2" data-hs-checkout="l1">Economy Watch · $4 / mo</a>' +
        '<a class="hs-btn ghost" href="#deskWaitlist">Desk Alerts waitlist · $19 later</a>' +
      '</div>';
  }

  function bindRead(opts) {
    opts = opts || {};
    var q = $(opts.qId || 'hsQ');
    var notice = $(opts.noticeId || 'hsNotice');
    var btn = $(opts.btnId || 'hsGo');
    var out = $(opts.outId || 'hsOut');
    if (!q || !btn || !out) return;
    function run() {
      var query = (q.value || '').trim();
      if (!query) { out.innerHTML = '<div class="hs-fail">Enter a ZIP or street address.</div>'; return; }
      out.innerHTML = '<div class="hs-fresh">Reading the place…</div>';
      btn.disabled = true;
      var noticeVal = notice ? notice.value : 'unsure';
      fetch('/api/homestead-read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: query, notice: noticeVal })
      }).then(function (r) { return r.json(); }).then(function (j) {
        out.innerHTML = renderRead(j);
        if (j && j.ok) track('read_complete', { zip: (j.place && j.place.zip) || '' });
        var pay = out.querySelector('[data-hs-checkout="l1"]');
        if (pay) pay.addEventListener('click', function () { track('checkout_start', { zip: (j.place && j.place.zip) || '' }); });
      }).catch(function () {
        out.innerHTML = '<div class="hs-fail">Network error. Try again.</div>';
      }).finally(function () { btn.disabled = false; });
    }
    btn.addEventListener('click', run);
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  }

  function bindWaitlist(opts) {
    opts = opts || {};
    var em = $(opts.emailId || 'hsEmail');
    var nm = $(opts.nameId || 'hsName');
    var cs = $(opts.consentId || 'hsConsent');
    var btn = $(opts.btnId || 'hsWaitBtn');
    var st = $(opts.statId || 'hsWaitStat');
    var zip = $(opts.zipId || 'hsQ');
    if (!em || !btn || !st) return;
    btn.addEventListener('click', function () {
      var email = (em.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        st.textContent = 'Enter a valid email.';
        return;
      }
      if (cs && !cs.checked) {
        st.textContent = 'Please agree to be contacted.';
        return;
      }
      st.textContent = 'Saving…';
      btn.disabled = true;
      fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: nm ? (nm.value || '').trim() : '',
          email: email,
          consent: true,
          interest: opts.interest || 'homestead-desk-waitlist',
          sourcePage: opts.sourcePage || location.pathname,
          domain: 'economy',
          tier: 'homestead-waitlist',
          message: 'ZIP/query ' + (zip && zip.value ? zip.value : 'n/a')
        })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) {
          st.textContent = 'You are on the Desk waitlist. We will not charge $19 until alerts can actually send.';
          track('email_capture', { zip: zip && zip.value ? zip.value : '' });
          em.value = '';
          if (nm) nm.value = '';
        } else {
          st.textContent = (j && j.error) || 'Could not save. Try again.';
        }
      }).catch(function () { st.textContent = 'Network error. Try again.'; })
        .finally(function () { btn.disabled = false; });
    });
  }

  function bindL1Clicks() {
    var nodes = document.querySelectorAll('a[href*="/api/checkout?start=1"][href*="domain=economy"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener('click', function () { track('checkout_start'); });
    }
  }

  function injectEconomyHero() {
    if (document.getElementById('homesteadHeroLink')) return;
    var hero = document.querySelector('.hero-inner') || document.getElementById('hero');
    if (!hero) return;
    var p = document.createElement('p');
    p.className = 'hs-hero-link';
    p.id = 'homesteadHeroLink';
    p.innerHTML = '<a href="/economy/homestead">Homestead Desk · sell before auction</a>' +
      '<span> Free educational read. Not legal advice.</span>';
    hero.appendChild(p);
  }

  function boot(opts) {
    opts = opts || {};
    bindRead(opts.read || {});
    bindWaitlist(opts.waitlist || {});
    bindL1Clicks();
    if (opts.injectHero) injectEconomyHero();
  }

  root.LIMEN_HOMESTEAD = { boot: boot, track: track, renderRead: renderRead, esc: esc };
})(window);
