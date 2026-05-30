/**
 * domain-isolator.js — Domain State Isolation Layer
 *
 * When a page loads with ?domain=X, this module:
 *   1. Creates an isolated domain state container
 *   2. Populates it from the domain-snapshot API (not global state)
 *   3. Provides getActiveDomainState() for all reads
 *   4. Overrides window.LIMENDomains to only contain the scoped domain
 *   5. Updates navigation links to stay within the domain
 *
 * This ensures domain pages are ISOLATED INSTANCES, not filtered global views.
 *
 * Exposes: window.LIMENDomainIsolator
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _activeDomain = params.get('domain') || null;

  // Resolve via canonical domain identity (domain-identity.js must load first)
  var _id = window.LIMENDomainIdentity;
  var _resolved = _activeDomain && _id ? _id.resolve(_activeDomain) : null;
  var _resolvedKey = _resolved ? _resolved.snapshotKey : _activeDomain;

  // Warn if an alias was used at the URL boundary
  if (_id && _activeDomain) _id.warnIfAlias(_activeDomain, 'domain-isolator URL param');

  var LABELS = _id ? (function () {
    var L = {};
    var all = _id.allCanonical();
    for (var i = 0; i < all.length; i++) {
      var r = _id.resolve(all[i]);
      L[all[i]] = r.label;
      if (r.snapshotKey !== all[i]) L[r.snapshotKey] = r.label;
    }
    return L;
  })() : {
    energy:'Energy',defense:'Defense',trade:'Supply Chain',finance:'Finance',
    health:'Health',agriculture:'Agriculture',technology:'Technology',
    environment:'Environment',industry:'Industry',governance:'Governance',
    economy:'Economy',infrastructure:'Infrastructure',communication:'Communication',
    culture:'Culture',law:'Law',religion:'Religion',intelligence:'Intelligence',
    population:'Population',education:'Education',research:'Research',
    supplyChain:'Supply Chain'
  };

  // ══════════════════════════════════════════════════════════════════════
  // ISOLATED STATE CONTAINER
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENDomainInstances = window.LIMENDomainInstances || {};

  var _isolatedState = {
    domain: _resolvedKey,
    label: LABELS[_resolvedKey] || _resolvedKey,
    stress: 0,
    confidence: 0,
    activity: 0,
    maturity: 'EARLY',
    phase: 'p0',
    phaseLabel: 'SOURCE',
    signals: [],
    feeds: [],
    status: 'LOADING',
    liveCount: 0,
    opportunities: [],
    companies: [],
    convergence: null,
    actions: [],
    lastUpdated: null
  };

  if (_resolvedKey) {
    window.LIMENDomainInstances[_resolvedKey] = _isolatedState;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DATA LAYER OVERRIDE
  // When domain is active, LIMENDomains ONLY contains the scoped domain
  // ══════════════════════════════════════════════════════════════════════

  if (_resolvedKey) {
    var _realDomains = {};
    Object.defineProperty(window, 'LIMENDomains', {
      get: function () { return _realDomains; },
      set: function (val) {
        if (val && typeof val === 'object') {
          if (val[_resolvedKey]) {
            // Isolate: only expose the scoped domain
            var filtered = {};
            filtered[_resolvedKey] = val[_resolvedKey];
            _realDomains = filtered;

            // Update isolated state
            var d = val[_resolvedKey];
            _isolatedState.stress = d.stress || 0;
            _isolatedState.confidence = d.confidence || 0;
            _isolatedState.activity = d.activity || 0;
            _isolatedState.maturity = d.maturity || 'EARLY';
            _isolatedState.signals = d.signals || [];
            _isolatedState.feeds = d.sources || [];
            _isolatedState.status = d.status || 'UNKNOWN';
            _isolatedState.liveCount = d.liveCount || 0;
            _isolatedState.lastUpdated = Date.now();
          } else {
            _realDomains = {};
          }
        }
      },
      configurable: true
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // DOMAIN RESOLVER
  // ══════════════════════════════════════════════════════════════════════

  function getActiveDomain() {
    return _activeDomain;
  }

  function getResolvedKey() {
    return _resolvedKey;
  }

  function getActiveDomainState() {
    if (!_resolvedKey) return null;
    return window.LIMENDomainInstances[_resolvedKey] || _isolatedState;
  }

  function isDomainScoped() {
    return !!_resolvedKey;
  }

  function getDomainLabel() {
    return LABELS[_resolvedKey] || _resolvedKey || 'All Domains';
  }

  // ══════════════════════════════════════════════════════════════════════
  // NAVIGATION REWRITE
  // Rewrites all nav links to stay within the domain scope
  // ══════════════════════════════════════════════════════════════════════

  function rewriteNavigation() {
    if (!_activeDomain) return;

    var label = getDomainLabel().toUpperCase();

    // Update page title
    var titleEl = document.getElementById('dcNavBar') || document.getElementById('civTitleBar') || document.getElementById('oppTitleBar') || document.getElementById('cmdNavBar');
    if (titleEl) {
      titleEl.innerHTML =
        '<a href="/civilization" style="color:rgba(201,169,78,0.35);text-decoration:none">ALL DOMAINS</a>' +
        ' <span style="color:rgba(201,169,78,0.15)">&middot;</span> ' +
        '<a href="/domain-console?domain=' + _activeDomain + '" style="color:rgba(201,169,78,0.6);text-decoration:none">' + label + ' CONSOLE</a>' +
        ' <span style="color:rgba(201,169,78,0.15)">&middot;</span> ' +
        '<a href="/' + _activeDomain + '-opportunities" style="color:rgba(201,169,78,0.6);text-decoration:none">' + label + ' OPPORTUNITIES</a>' +
        ' <span style="color:rgba(201,169,78,0.15)">&middot;</span> ' +
        '<a href="/' + _activeDomain + '-command" style="color:rgba(201,169,78,0.6);text-decoration:none">' + label + ' COMMAND</a>' +
        ' <span style="color:rgba(201,169,78,0.15)">&middot;</span> ' +
        '<a href="/portal?domain=' + _activeDomain + '" style="color:rgba(201,169,78,0.6);text-decoration:none">PORTAL</a>';
    }

    // Update document title
    var pageType = 'CONSOLE';
    if (window.location.pathname.indexOf('opportunities') !== -1) pageType = 'OPPORTUNITIES';
    if (window.location.pathname.indexOf('kernel-comparison') !== -1) pageType = 'COMMAND BOARD';
    document.title = 'LIMEN HELIX · ' + label + ' ' + pageType;
  }

  // Run nav rewrite after DOM is ready
  if (_activeDomain) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', rewriteNavigation);
    } else {
      // Small delay to let other scripts create the nav elements
      setTimeout(rewriteNavigation, 100);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENDomainIsolator = {
    getActiveDomain: getActiveDomain,
    getResolvedKey: getResolvedKey,
    getActiveDomainState: getActiveDomainState,
    isDomainScoped: isDomainScoped,
    getDomainLabel: getDomainLabel,
    rewriteNavigation: rewriteNavigation,
    LABELS: LABELS
  };

})();
