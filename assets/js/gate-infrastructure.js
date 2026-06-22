/**
 * gate-infrastructure.js — client access gate for INFRASTRUCTURE-only admin pages
 * (master, or a person with the infrastructure domain → operator, Liz Jurkoic).
 * Include as the FIRST script in <head>. Bounces everyone else to the front door,
 * and auto-attaches the admin passcode to protected API calls.
 */
(function () {
  var p = null; try { p = JSON.parse(sessionStorage.getItem('limen_admin') || 'null'); } catch (e) {}
  var granted = false; try { granted = sessionStorage.getItem('limen_access') === 'granted'; } catch (e) {}
  var ok = p ? (p.master === true || (Array.isArray(p.domains) && p.domains.indexOf('infrastructure') > -1)) : granted;
  if (!ok) { window.location.replace('/?return=' + encodeURIComponent(location.pathname + location.search)); return; }

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
