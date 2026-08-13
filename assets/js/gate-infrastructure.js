/**
 * gate-infrastructure.js — credential bridge for protected INFRASTRUCTURE actions.
 *
 * Infrastructure pages are public. The server still authorizes protected API actions,
 * and this script keeps the existing prompt-and-retry behavior for those actions only.
 */
(function () {
  var GATED = /\/api\/(capital-engine|paper-trade|operator-action|trigger-pattern-author|pattern-proposal|print-from-pattern|infra-entry)\b/;
  function key(force) {
    var k = ''; try { k = sessionStorage.getItem('limen_cap_key') || sessionStorage.getItem('limen_pass') || ''; } catch (e) {}
    if (!k || force) { k = (window.prompt('Enter your admin passcode:') || '').trim(); try { if (k) sessionStorage.setItem('limen_cap_key', k); } catch (e) {} }
    return k;
  }
  var _f = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && GATED.test(input)) {
      var go = function (force) { var k = key(force); var sep = input.indexOf('?') > -1 ? '&' : '?'; return _f(input + sep + 'key=' + encodeURIComponent(k), init); };
      return go(false).then(function (r) { return r.status === 403 ? go(true) : r; });
    }
    return _f(input, init);
  };
})();
