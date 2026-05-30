/**
 * deep-portal-harvester.js
 * LIMEN HELIX — Deep Portal Harvester
 *
 * Phase 4: Domain Expansion — supports large portal inventories per domain.
 *
 * The bootstrap currently only harvests top-level domain JSONs ({domainKey}.json).
 * This module adds on-demand deep harvesting of portal sub-trees:
 *   medicine.json → medicine_neurology.json → medicine_neurology_dementia.json → ...
 *
 * Features:
 *   - On-demand deep harvest for a domain
 *   - Portal manifest discovery (probe common naming patterns)
 *   - Batched async fetching with concurrency control
 *   - Portal group/section metadata for UI navigation
 *   - Stable portal IDs (never mutates existing IDs)
 *   - Emits progress events for UI feedback
 *
 * Exposes: window.LIMENDeepPortalHarvester
 */
(function () {
  'use strict';

  var CONCURRENCY = 4;  // Max parallel fetches
  var BASE_PATH = 'assets/data/domains/';

  // ═══════════════════════════════════════════════════════════════
  // Portal manifest — known portal prefixes per domain
  // ═══════════════════════════════════════════════════════════════

  // These are the medicine sub-portals shown in the connectome
  var MEDICINE_PORTALS = [
    'medicine_diagnostics',
    'medicine_neurology',
    'medicine_metabolic',
    'medicine_pediatric_med',
    'medicine_gutbrain',
    'medicine_addiction',
    'medicine_psychedelic',
    'medicine_psychiatry',
    'medicine_cardiology',
    'medicine_oncology',
    'medicine_surgery',
    'medicine_emergency',
    'medicine_primary',
    'medicine_pharmacy',
    'medicine_infectious',
    'medicine_anesthesia',
    'medicine_rehabilitation',
    'medicine_radiology',
    'medicine_pathology',
    'medicine_publichealth',
    'medicine_telehealth',
    'medicine_geriatric',
    'medicine_medresearch',
    'medicine_medquality'
  ];

  // Domain → known portal prefixes (expandable)
  var DOMAIN_PORTALS = {
    health: MEDICINE_PORTALS,
    economy: ['economy_gdp', 'economy_labor', 'economy_trade', 'economy_fiscal', 'economy_monetary'],
    energy: ['energy_oil', 'energy_gas', 'energy_solar', 'energy_wind', 'energy_nuclear', 'energy_grid'],
    environment: ['environment_climate', 'environment_water', 'environment_air', 'environment_biodiversity'],
    technology: ['technology_ai', 'technology_cyber', 'technology_semiconductor', 'technology_cloud'],
    finance: ['finance_banking', 'finance_markets', 'finance_insurance', 'finance_crypto'],
    governance: ['governance_executive', 'governance_legislative', 'governance_judicial'],
    defense: ['defense_military', 'defense_homeland', 'defense_intelligence', 'defense_cyber'],
    agriculture: ['agriculture_crop', 'agriculture_livestock', 'agriculture_irrigation']
  };

  // State
  var _harvesting = {};     // domainId → true if currently harvesting
  var _harvested = {};      // domainId → { count, timestamp }
  var _portalGroups = {};   // domainId → [{ groupId, label, portalIds[] }]

  // ═══════════════════════════════════════════════════════════════
  // Discovery — probe for portal JSON files
  // ═══════════════════════════════════════════════════════════════

  /**
   * Discover available portal JSONs for a domain by probing known prefixes.
   * @param {string} domainId
   * @param {function} callback — (urls[])
   */
  function discoverPortals(domainId, callback) {
    var runtimeKey = domainId;
    var prefixes = DOMAIN_PORTALS[runtimeKey] || [];

    if (prefixes.length === 0) {
      // Generic probe: try {domainId}_*.json
      prefixes = [domainId];
    }

    var urls = [];
    var pending = prefixes.length;
    var done = false;

    if (pending === 0) { callback(urls); return; }

    for (var i = 0; i < prefixes.length; i++) {
      _probeUrl(BASE_PATH + prefixes[i] + '.json', function (url) {
        if (url) urls.push(url);
        pending--;
        if (pending <= 0 && !done) {
          done = true;
          callback(urls);
        }
      });
    }
  }

  function _probeUrl(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', url, true);
    xhr.timeout = 3000;
    xhr.onload = function () {
      callback(xhr.status === 200 ? url : null);
    };
    xhr.onerror = function () { callback(null); };
    xhr.ontimeout = function () { callback(null); };
    xhr.send();
  }

  // ═══════════════════════════════════════════════════════════════
  // Deep harvest — fetch and register portal JSONs
  // ═══════════════════════════════════════════════════════════════

  /**
   * Deep harvest all known portals for a domain.
   * @param {string} domainId
   * @param {object} opts — { maxPortals, onProgress }
   * @param {function} callback — (totalCount)
   */
  function harvestDomain(domainId, opts, callback) {
    if (typeof opts === 'function') { callback = opts; opts = {}; }
    opts = opts || {};
    callback = callback || function () {};

    if (_harvesting[domainId]) {
      console.log('[LIMEN] deep harvest already in progress for ' + domainId);
      callback(0);
      return;
    }

    _harvesting[domainId] = true;
    var maxPortals = opts.maxPortals || 50;
    var onProgress = opts.onProgress || function () {};

    discoverPortals(domainId, function (urls) {
      if (urls.length === 0) {
        _harvesting[domainId] = false;
        console.log('[LIMEN] deep harvest: no portal JSONs found for ' + domainId);
        callback(0);
        return;
      }

      // Limit to maxPortals
      urls = urls.slice(0, maxPortals);

      console.log('[LIMEN] deep harvest: ' + urls.length + ' portals discovered for ' + domainId);
      _dispatch('limen:deep-harvest-start', { domainId: domainId, count: urls.length });

      var mgr = window.LIMENRemedyRegistryManager;
      if (!mgr) {
        _harvesting[domainId] = false;
        callback(0);
        return;
      }

      // Batch fetch with concurrency control
      _batchFetch(urls, CONCURRENCY, function (results) {
        var totalRegistered = 0;
        var groups = {};

        for (var i = 0; i < results.length; i++) {
          if (!results[i].data) continue;

          try {
            var count = mgr.harvestFromPortal(results[i].data, {
              domainId: domainId,
              portalUrl: results[i].url
            });
            totalRegistered += count;

            // Extract group info from domainId
            var portalDomainId = results[i].data.domainId || '';
            var groupId = _extractGroupId(portalDomainId, domainId);
            if (!groups[groupId]) {
              groups[groupId] = { groupId: groupId, label: _formatLabel(groupId), portalIds: [] };
            }
            groups[groupId].portalIds.push(portalDomainId);
          } catch (e) {
            console.warn('[LIMEN] deep harvest error for ' + results[i].url + ':', e.message);
          }

          onProgress({ done: i + 1, total: results.length, registered: totalRegistered });
        }

        // Store portal groups for UI
        _portalGroups[domainId] = [];
        for (var gk in groups) {
          if (groups.hasOwnProperty(gk)) {
            _portalGroups[domainId].push(groups[gk]);
          }
        }

        // Rebuild resolver registry
        if (mgr.buildResolverRegistry) mgr.buildResolverRegistry();

        _harvested[domainId] = { count: totalRegistered, timestamp: Date.now() };
        _harvesting[domainId] = false;

        console.log('[LIMEN] deep harvest complete: ' + totalRegistered +
          ' treatments from ' + urls.length + ' portals for ' + domainId);
        _dispatch('limen:deep-harvest-complete', {
          domainId: domainId,
          count: totalRegistered,
          portals: urls.length
        });

        callback(totalRegistered);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Batch fetch with concurrency
  // ═══════════════════════════════════════════════════════════════

  function _batchFetch(urls, concurrency, callback) {
    var results = new Array(urls.length);
    var nextIndex = 0;
    var active = 0;
    var completed = 0;

    function fetchNext() {
      while (active < concurrency && nextIndex < urls.length) {
        _fetchOne(nextIndex);
        nextIndex++;
      }
    }

    function _fetchOne(index) {
      active++;
      var url = urls[index];
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 10000;
      xhr.onload = function () {
        active--;
        if (xhr.status === 200) {
          try {
            results[index] = { url: url, data: JSON.parse(xhr.responseText) };
          } catch (e) {
            results[index] = { url: url, data: null };
          }
        } else {
          results[index] = { url: url, data: null };
        }
        completed++;
        if (completed >= urls.length) {
          callback(results);
        } else {
          fetchNext();
        }
      };
      xhr.onerror = function () {
        active--;
        results[index] = { url: url, data: null };
        completed++;
        if (completed >= urls.length) callback(results);
        else fetchNext();
      };
      xhr.ontimeout = xhr.onerror;
      xhr.send();
    }

    fetchNext();
  }

  // ═══════════════════════════════════════════════════════════════
  // Group helpers
  // ═══════════════════════════════════════════════════════════════

  function _extractGroupId(portalDomainId, parentDomainId) {
    // e.g. "medicine_neurology_dementia_alzheimers" → "neurology"
    var prefix = portalDomainId.replace(/^medicine_/, '').replace(/^health_/, '');
    var parts = prefix.split('_');
    return parts[0] || parentDomainId;
  }

  function _formatLabel(groupId) {
    if (!groupId) return 'Unknown';
    return groupId.charAt(0).toUpperCase() + groupId.slice(1).replace(/_/g, ' ');
  }

  // ═══════════════════════════════════════════════════════════════
  // Utility
  // ═══════════════════════════════════════════════════════════════

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  /**
   * Get portal groups for a domain (for UI navigation).
   */
  function getPortalGroups(domainId) {
    return _portalGroups[domainId] || [];
  }

  /**
   * Check if a domain has been deep-harvested.
   */
  function isHarvested(domainId) {
    return !!_harvested[domainId];
  }

  /**
   * Get harvest stats for a domain.
   */
  function getHarvestStats(domainId) {
    return _harvested[domainId] || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  window.LIMENDeepPortalHarvester = {
    discoverPortals: discoverPortals,
    harvestDomain: harvestDomain,
    getPortalGroups: getPortalGroups,
    isHarvested: isHarvested,
    getHarvestStats: getHarvestStats,
    DOMAIN_PORTALS: DOMAIN_PORTALS
  };

})();
