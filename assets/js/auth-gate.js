/**
 * auth-gate.js — Unified LIMEN access control
 * Include as first script on any protected page.
 * Redirects to gate (/) if not authenticated.
 * Preserves return path via ?return= parameter.
 */
(function() {
  var AUTH_VALUE = 'granted';
  if (sessionStorage.getItem('limen_access') !== AUTH_VALUE) {
    window.location.replace('/?return=' + encodeURIComponent(location.pathname + location.search));
  }
})();
