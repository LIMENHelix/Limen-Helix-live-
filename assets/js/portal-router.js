/* portal-router.js — Universal portal routing engine
   Parses URL params, fetches registry, populates DOM, calls PortalUI.init() */
(function () {
  'use strict';

  // --- URL parsing ---
  var params = new URLSearchParams(window.location.search);
  var domain = params.get('domain');
  if (!domain) { showError('No domain specified'); return; }

  // Build path key from URL params: domain, l2, l3, l4...
  var segments = [domain];
  for (var i = 2; i <= 8; i++) {
    var seg = params.get('l' + i);
    if (seg) segments.push(seg);
    else break;
  }
  var pathKey = segments.join('/');

  // --- Fetch registry (per-domain split for performance) ---
  var registryDomain = segments[0];
  var registryUrl = 'assets/data/registry/portal-registry-' + registryDomain + '.json';

  fetch(registryUrl)
    .then(function (r) {
      if (!r.ok) throw new Error('Domain registry not found: ' + registryDomain);
      return r.json();
    })
    .then(function (domainRegistry) {
      // Wrap in master-compatible format
      boot(domainRegistry, pathKey);
    })
    .catch(function (err) {
      // Fallback: try master registry (moved out of the assets/data/*.json
      // includeFiles glob so it no longer bundles into the Node function)
      fetch('assets/data/registry/portal-registry.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (masterReg) {
          if (masterReg) boot(masterReg, pathKey);
          else showError('Failed to load registry: ' + err.message);
        })
        .catch(function () { showError('Failed to load portal registry: ' + err.message); });
    });

  // --- Helper: convert path to URL ---
  function pathToUrl(path) {
    var parts = path.split('/');
    var url = '/portal?domain=' + encodeURIComponent(parts[0]);
    for (var i = 1; i < parts.length; i++) {
      url += '&l' + (i + 1) + '=' + encodeURIComponent(parts[i]);
    }
    return url;
  }

  // --- Helper: escape HTML ---
  function esc(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  // --- Error state ---
  function showError(msg) {
    document.title = 'LIMEN HELIX · Portal Not Found';
    var t = document.getElementById('portalTitle');
    if (t) t.textContent = 'Portal Not Found';
    var bc = document.getElementById('portalBreadcrumb');
    if (bc) bc.innerHTML = '<a href="civilization.html">CIVILIZATION</a><span class="bc-sep">\u2192</span><span class="bc-current">NOT FOUND</span>';
    var re = document.getElementById('reTitle');
    if (re) re.textContent = 'Portal Not Found';
    var rd = document.getElementById('reDesc');
    if (rd) rd.textContent = msg;
    var rp = document.getElementById('rePhase');
    if (rp) rp.textContent = '';
    var rs = document.getElementById('reStats');
    if (rs) rs.textContent = '';
    var bt = document.getElementById('bottomTitle');
    if (bt) bt.textContent = 'LIMEN HELIX TRANSFORMATIONAL SCIENCES LLC';
    var bs = document.getElementById('bottomStats');
    if (bs) bs.textContent = '';
  }

  // --- Main boot ---
  function boot(registry, pathKey) {
    var entry = registry.portals[pathKey];

    // Fallback for deep portals not in registry: construct minimal entry
    if (!entry) {
      var domainId = segments.join('_');
      var parentSegments = segments.slice(0, -1);
      var parentPath = parentSegments.length > 0 ? parentSegments.join('/') : null;
      var title = segments[segments.length - 1].replace(/_/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);
      entry = {
        domainId: domainId,
        title: title,
        desc: 'Deep portal — loading from API.',
        phaseTag: '',
        nodeCount: 0,
        issueCount: 0,
        parentPath: parentPath,
        parentLabel: parentSegments.length > 0 ? parentSegments[parentSegments.length - 1] : 'Civilization',
        groups: [],
        childPaths: [],
        childCount: 0
      };
    }

    // --- Document title ---
    document.title = 'LIMEN HELIX \u00b7 ' + entry.title.toUpperCase();

    // --- Topbar title ---
    document.getElementById('portalTitle').textContent = entry.title;

    // --- Breadcrumb ---
    // Collect chain entries from root to current
    var chain = [];  // [{entry, path}] from root to current
    var cur = pathKey;
    while (cur) {
      var e = registry.portals[cur];
      if (!e) break;
      chain.unshift({ entry: e, path: cur });
      cur = e.parentPath;
    }
    // Derive breadcrumb labels: ancestors use the CHILD's parentLabel, last uses own title
    var bcHtml = '<a href="civilization.html">CIVILIZATION</a>';
    for (var i = 0; i < chain.length; i++) {
      bcHtml += '<span class="bc-sep">\u2192</span>';
      var label;
      if (i < chain.length - 1) {
        // Ancestor: use next child's parentLabel as the display label
        label = chain[i + 1].entry.parentLabel.toUpperCase();
        bcHtml += '<a href="' + esc(pathToUrl(chain[i].path)) + '">' + esc(label) + '</a>';
      } else {
        // Current: use own title
        label = chain[i].entry.title.toUpperCase();
        bcHtml += '<span class="bc-current">' + esc(label) + '</span>';
      }
    }
    // Add opportunity context to breadcrumb if arriving from one
    if (oppContext) {
      bcHtml = '<a href="opportunities.html">OPPORTUNITIES</a><span class="bc-sep">\u2192</span>' + bcHtml;
    }
    document.getElementById('portalBreadcrumb').innerHTML = bcHtml;

    // --- Back link ---
    var backEl = document.getElementById('portalBack');
    if (entry.parentPath) {
      var parentEntry = registry.portals[entry.parentPath];
      backEl.href = pathToUrl(entry.parentPath);
      backEl.innerHTML = '\u2190 ' + esc(entry.parentLabel);
    } else {
      backEl.href = 'civilization.html';
      backEl.innerHTML = '\u2190 CIVILIZATION';
    }

    // --- Portal nav: set pn-current for agriculture sub-portals ---
    var pnAgri = document.getElementById('pnAgriculture');
    if (pnAgri && pathKey.indexOf('agriculture') === 0) {
      pnAgri.classList.add('pn-current');
    }

    // --- Right panel empty state ---
    document.getElementById('reTitle').textContent = entry.title;
    document.getElementById('rePhase').textContent = entry.phaseTag;
    document.getElementById('reDesc').textContent = entry.desc || (entry.title + ' portal — domain nodes activated on the universal 123-node brain connectome.');
    var statsText = (entry.nodeCount || 0) + ' active nodes \u00b7 123 brain regions';
    document.getElementById('reStats').textContent = statsText;

    // --- Bottom bar ---
    document.getElementById('bottomTitle').textContent =
      'LIMEN HELIX TRANSFORMATIONAL SCIENCES LLC \u00b7 ' + entry.title.toUpperCase() + ' REFERENCE';
    document.getElementById('bottomStats').textContent = '';

    // --- childPortalResolver ---
    var domainIdToPath = registry.domainIdToPath || {};
    function childPortalResolver(childPortal) {
      // childPortal comes as "p2_agri_soil_testing_portal.html"
      // Strip "_portal.html" to get domainId
      var did = childPortal;
      if (did.endsWith('_portal.html')) {
        did = did.slice(0, -'_portal.html'.length);
      } else if (did.endsWith('.html')) {
        did = did.slice(0, -'.html'.length);
      }
      var resolvedPath = domainIdToPath[did];
      if (resolvedPath) {
        return pathToUrl(resolvedPath);
      }
      // Fallback: return raw filename for backward compat
      return childPortal;
    }

    // --- Opportunity context handoff ---
    // If arriving from an opportunity link, carry context for display
    var oppContext = null;
    if (params.get('from') === 'opp') {
      oppContext = {
        title: params.get('oppTitle') || '',
        type: params.get('oppType') || ''
      };
    }

    // --- Call PortalUI.init ---
    PortalUI.init({
      domainId: entry.domainId,
      parentLabel: entry.parentLabel,
      issuesEnabled: true,
      brainWhy: {},
      groupOrder: entry.groups || [],
      childPortalResolver: childPortalResolver,
      opportunityContext: oppContext
    });
  }
})();
