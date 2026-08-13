/**
 * gate-master.js — credential bridge for protected MASTER actions.
 *
 * Pages are public. This script does not redirect or decide who may view one. It preserves
 * the existing prompt-and-retry behavior only when a caller invokes a server-protected API.
 */
(function () {
  var GATED = /\/api\/(capital-engine|paper-trade|paper-orders|paper-positions|operator-action|trigger-pattern-author|pattern-proposal|print-from-pattern|playbook|ventures|ai-switch|expand-artifact-claude|enrich-portal-claude)\b/;
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
