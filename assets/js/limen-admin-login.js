/**
 * limen-admin-login.js — reusable admin-login modal for the public domain fronts.
 *
 * Drop <script src="assets/js/limen-admin-login.js"></script> on a page, then call
 * LimenAdminLogin.open() from an "Admin" button. Posts the passcode to /api/admin-auth;
 * on success stores the session and routes to /admin. No secret lives in the client.
 */
(function () {
  'use strict';
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  function mount() {
    if (document.getElementById('limen-admin-overlay')) return;
    var ov = el(
      '<div id="limen-admin-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.94);display:none;align-items:center;justify-content:center;z-index:9999;font-family:\'IBM Plex Mono\',monospace">' +
        '<div style="background:#06060e;border:1px solid rgba(201,169,78,0.35);padding:34px 30px 26px;border-radius:4px;max-width:330px;width:90%;position:relative">' +
          '<button id="lal-close" aria-label="close" style="position:absolute;top:6px;right:12px;background:none;border:none;color:rgba(239,233,216,0.4);font-size:1.3rem;cursor:pointer">&times;</button>' +
          '<div style="font-size:0.62rem;letter-spacing:5px;color:#c9a94e;text-transform:uppercase;margin-bottom:22px">Authorized Access</div>' +
          '<form id="lal-form">' +
            '<input id="lal-pw" type="password" placeholder="passcode" autocomplete="off" style="width:100%;background:transparent;border:none;border-bottom:1px solid rgba(201,169,78,0.35);color:#e8e3d9;font-family:inherit;font-size:1rem;letter-spacing:3px;padding:6px 2px;outline:none">' +
            '<div id="lal-err" style="min-height:14px;margin-top:12px;font-size:0.58rem;letter-spacing:2px;color:#d4574b;text-transform:uppercase"></div>' +
            '<button type="submit" style="margin-top:18px;width:100%;background:transparent;border:1px solid rgba(201,169,78,0.45);color:#c9a94e;font-family:inherit;letter-spacing:3px;padding:9px;cursor:pointer;text-transform:uppercase">Enter</button>' +
          '</form>' +
          '<div style="margin-top:16px;font-size:0.52rem;letter-spacing:2px;color:rgba(239,233,216,0.35);text-transform:uppercase">Assigned operators only</div>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(ov);
    ov.querySelector('#lal-close').onclick = function () { ov.style.display = 'none'; };
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.style.display = 'none'; });
    ov.querySelector('#lal-form').onsubmit = function (e) {
      e.preventDefault();
      var pw = ov.querySelector('#lal-pw').value;
      var err = ov.querySelector('#lal-err');
      err.textContent = 'checking…';
      fetch('/api/admin-auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode: pw }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) {
            try { sessionStorage.setItem('limen_access', 'granted'); sessionStorage.setItem('limen_admin', JSON.stringify(j.person)); } catch (e) {}
            window.location.href = '/admin';
          } else { err.textContent = (j && j.error) || 'invalid'; }
        })
        .catch(function () { err.textContent = 'error — try again'; });
    };
  }

  window.LimenAdminLogin = {
    open: function () { mount(); var o = document.getElementById('limen-admin-overlay'); o.style.display = 'flex'; setTimeout(function () { var i = document.getElementById('lal-pw'); if (i) i.focus(); }, 50); }
  };
})();
