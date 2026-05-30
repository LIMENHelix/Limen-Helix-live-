/**
 * company-resolver.js — Client-side company resolution by name, ticker, or CIK.
 * Loads company-index.json and provides instant lookup without API calls.
 */
(function() {
  'use strict';

  var _index = null;
  var _ready = false;
  var _callbacks = [];

  function loadIndex(cb) {
    if (_ready) { cb(null, _index); return; }
    _callbacks.push(cb);
    if (_callbacks.length > 1) return; // already loading

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'assets/data/company-index.json', true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          _index = JSON.parse(xhr.responseText);
          _ready = true;
          _callbacks.forEach(function(fn) { fn(null, _index); });
        } catch (e) {
          _callbacks.forEach(function(fn) { fn(e, null); });
        }
      } else {
        _callbacks.forEach(function(fn) { fn(new Error('HTTP ' + xhr.status), null); });
      }
      _callbacks = [];
    };
    xhr.onerror = function() {
      _callbacks.forEach(function(fn) { fn(new Error('Network error'), null); });
      _callbacks = [];
    };
    xhr.send();
  }

  /**
   * Resolve user input to a company slug.
   * Tries: exact ticker, exact CIK, slug match, fuzzy name match.
   * Returns { slug, company } or null.
   */
  function resolve(input, cb) {
    if (!input || !input.trim()) { cb(null); return; }
    loadIndex(function(err, idx) {
      if (err || !idx) { cb(null); return; }

      var q = input.trim();
      var qUpper = q.toUpperCase();
      var qLower = q.toLowerCase().replace(/[^a-z0-9 ]/g, '');
      var qNoSpace = qLower.replace(/ /g, '');

      // 1. Exact ticker match
      if (idx.byTicker[qUpper]) {
        var slug = idx.byTicker[qUpper];
        cb({ slug: slug, company: idx.companies[slug], matchType: 'ticker' });
        return;
      }

      // 2. Exact CIK match (strip leading zeros)
      var cikClean = q.replace(/^0+/, '');
      if (idx.byCik[cikClean]) {
        var slug = idx.byCik[cikClean];
        cb({ slug: slug, company: idx.companies[slug], matchType: 'cik' });
        return;
      }

      // 3. Exact slug match
      if (idx.bySlug[qLower]) {
        var slug = idx.bySlug[qLower];
        cb({ slug: slug, company: idx.companies[slug], matchType: 'name' });
        return;
      }
      if (idx.bySlug[qNoSpace]) {
        var slug = idx.bySlug[qNoSpace];
        cb({ slug: slug, company: idx.companies[slug], matchType: 'name' });
        return;
      }

      // 4. Fuzzy: partial name match
      var bestSlug = null;
      var bestScore = 0;
      var slugs = Object.keys(idx.companies);
      for (var i = 0; i < slugs.length; i++) {
        var s = slugs[i];
        var co = idx.companies[s];
        var nameLower = co.name.toLowerCase();
        if (nameLower.indexOf(qLower) !== -1) {
          var score = qLower.length / nameLower.length;
          if (score > bestScore) { bestScore = score; bestSlug = s; }
        }
      }
      if (bestSlug && bestScore > 0.3) {
        cb({ slug: bestSlug, company: idx.companies[bestSlug], matchType: 'fuzzy' });
        return;
      }

      cb(null);
    });
  }

  /**
   * Get autocomplete suggestions for partial input.
   * Returns array of { slug, name, ticker, cik, matchType }.
   */
  function getSuggestions(partial, cb) {
    if (!partial || partial.trim().length < 1) { cb([]); return; }
    loadIndex(function(err, idx) {
      if (err || !idx) { cb([]); return; }

      var q = partial.trim().toLowerCase();
      var qUpper = partial.trim().toUpperCase();
      var results = [];
      var seen = {};

      var slugs = Object.keys(idx.companies);
      for (var i = 0; i < slugs.length; i++) {
        var s = slugs[i];
        var co = idx.companies[s];
        if (seen[s]) continue;

        var match = false;
        var matchType = '';

        // Ticker prefix
        if (co.ticker.toUpperCase().indexOf(qUpper) === 0) {
          match = true; matchType = 'ticker';
        }
        // CIK prefix
        else if (co.cik.indexOf(q.replace(/^0+/, '')) === 0 && q.replace(/^0+/, '').length > 0) {
          match = true; matchType = 'cik';
        }
        // Name contains
        else if (co.name.toLowerCase().indexOf(q) !== -1) {
          match = true; matchType = 'name';
        }
        // Industry contains
        else if (co.industry.toLowerCase().indexOf(q) !== -1) {
          match = true; matchType = 'industry';
        }

        if (match) {
          seen[s] = true;
          results.push({
            slug: s,
            name: co.name,
            ticker: co.ticker,
            cik: co.cik,
            industry: co.industry,
            domainId: co.domainId,
            matchType: matchType
          });
        }
      }

      // Sort: ticker matches first, then name, then industry
      results.sort(function(a, b) {
        var order = { ticker: 0, cik: 1, name: 2, industry: 3 };
        return (order[a.matchType] || 9) - (order[b.matchType] || 9);
      });

      cb(results.slice(0, 10));
    });
  }

  /**
   * Get company portal URL for a slug.
   * Prefers helix-report with CIK when available.
   * Optional opts: { source_surface, requested_report_type, ticker }.
   */
  function getCompanyUrl(slug, cik, opts) {
    if (cik) {
      return getHelixUrl(cik, slug, opts);
    }
    return 'company-portal.html?company=' + encodeURIComponent(slug);
  }

  /**
   * Get HELIX Report URL for a CIK with optional safe context.
   * Allowed query keys: cik, company, source_surface, requested_report_type,
   * ticker, source_opportunity_id, domain, lane, t (timestamp).
   * No formula, no constants, no kernel internals are ever encoded here.
   */
  function getHelixUrl(cik, slug, opts) {
    opts = opts || {};
    var url = 'helix-report.html?cik=' + encodeURIComponent(cik);
    if (slug) url += '&company=' + encodeURIComponent(slug);
    var ALLOWED = ['source_surface', 'requested_report_type', 'ticker',
                   'source_opportunity_id', 'domain', 'lane'];
    ALLOWED.forEach(function(k) {
      if (opts[k] != null && opts[k] !== '') {
        url += '&' + k + '=' + encodeURIComponent(opts[k]);
      }
    });
    return url;
  }

  // Pre-load index
  loadIndex(function() {});

  // Export
  window.LIMENCompanyResolver = {
    resolve: resolve,
    getSuggestions: getSuggestions,
    getCompanyUrl: getCompanyUrl,
    getHelixUrl: getHelixUrl,
    loadIndex: loadIndex
  };
})();
