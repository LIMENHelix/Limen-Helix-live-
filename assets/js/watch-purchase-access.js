/**
 * On-page access after Stripe Checkout returns to /{domain}?bought={rung}.
 * Confirmation only. This script never grants a subscription; Stripe does.
 */
(function () {
  'use strict';
  try {
    var q = new URLSearchParams(window.location.search);
    var bought = q.get('bought');
    var cancelled = q.get('checkout') === 'cancelled';
    if (!bought && !cancelled) return;
    if (document.getElementById('watchPurchaseAccess')) return;

    var domain = (function () {
      var seg = (window.location.pathname || '').replace(/^\/|\/$/g, '').split('/')[0].replace(/\.html$/i, '');
      return seg || 'watch';
    })();

    var box = document.createElement('div');
    box.id = 'watchPurchaseAccess';
    box.setAttribute('role', 'status');
    box.style.cssText = 'max-width:760px;margin:16px auto;padding:16px 18px;border:1px solid rgba(201,169,78,0.35);border-radius:8px;background:rgba(14,19,29,0.92);color:#e9e6dd;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;';

    if (cancelled) {
      box.innerHTML = '<strong style="color:#C9A94E">Checkout cancelled.</strong> <span style="font-size:14px;color:#c8c3b6">Nothing was charged. The live tools on this page stay free.</span>';
    } else {
      var rung = String(bought).replace(/[<>&]/g, '');
      box.innerHTML =
        '<strong style="color:#C9A94E">You are in. This watch is active.</strong>' +
        '<div style="margin-top:8px;font-size:14px;line-height:1.5;color:#c8c3b6">' +
        'Receipt and the first briefing go to the email you used at checkout. ' +
        'This page is your access: the live ' + domain + ' tools stay here. ' +
        'Rung: ' + rung + '.' +
        '</div>';
    }

    var wrap = document.querySelector('.wrap') || document.body;
    if (wrap.firstChild) wrap.insertBefore(box, wrap.firstChild);
    else wrap.appendChild(box);
  } catch (e) {}
})();
