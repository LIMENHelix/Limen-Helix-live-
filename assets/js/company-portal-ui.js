/**
 * company-portal-ui.js — Dynamic company portal renderer.
 * Loads company data from JSON and renders the full portal view.
 * Works with company-resolver.js for URL param resolution.
 */
(function() {
  'use strict';

  var DOMAIN_LABELS = {
    energy: 'Energy', finance: 'Finance', technology: 'Technology',
    infrastructure: 'Infrastructure', industry: 'Industry', p2_agri: 'Agriculture',
    health: 'Health', communication: 'Communication', defense: 'Defense',
    science: 'Science / Research', education: 'Education', population: 'Population',
    law: 'Law / Governance', economy: 'Economy', governance: 'Governance',
    trade: 'Trade', environment: 'Environment', religion: 'Religion',
    intelligence: 'Intelligence', culture: 'Culture', medicine: 'Medicine'
  };

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // Gate B v0.1 predicate helpers — empirically matched against production
  // data shape (assets/data/companies/*.json). Production uses empty string
  // for unexecuted financialHealth.asOf (e.g. chevron); v0's null-only check
  // produced a false negative. These helpers treat null, undefined, empty
  // string, and whitespace-only strings as non-execution. Container helper
  // treats empty array / empty object as absence regardless of presence of
  // the slot itself.
  function hasNonBlankValue(value) {
    return value !== null &&
           value !== undefined &&
           String(value).trim().length > 0;
  }

  function hasSubstantiveEntries(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  }

  function getParam(name) {
    var url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function loadJSON(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try { cb(null, JSON.parse(xhr.responseText)); } catch (e) { cb(e, null); }
      } else { cb(new Error('HTTP ' + xhr.status), null); }
    };
    xhr.onerror = function() { cb(new Error('Network error'), null); };
    xhr.send();
  }

  function renderCompany(co) {
    var domainLabel = DOMAIN_LABELS[co.domainId] || co.domainId;
    var portalFile = co.domainId + '_portal.html';
    if (co.domainId === 'p2_agri') portalFile = 'p2_agri_portal.html';

    // Topbar \u2014 these elements existed in the per-page topbar that TOPBAR.1
    // replaced with the shared assets/js/limen-topbar.js global. Null-guard
    // each access so renderCompany doesn't throw on pages that consume the
    // global topbar (which is now all of them).
    function _set(id, text, href) {
      var el = document.getElementById(id);
      if (!el) return;
      if (text != null) el.textContent = text;
      if (href != null) el.href = href;
    }
    _set('companyTitle', co.name, null);
    _set('bcDomain', domainLabel.toUpperCase(), portalFile);
    _set('bcCompany', co.name.toUpperCase(), null);
    _set('backLink', '\u2190 ' + domainLabel, portalFile);
    document.title = 'LIMEN HELIX \u00b7 ' + co.name;

    // Left panel — Company identity
    var leftHtml = '';
    leftHtml += '<div class="cp-section">';
    leftHtml += '<div class="cp-section-title">Identity</div>';
    leftHtml += '<div class="cp-field"><span class="cp-label">Name</span><span class="cp-value">' + esc(co.name) + '</span></div>';
    leftHtml += '<div class="cp-field"><span class="cp-label">Ticker</span><span class="cp-value cp-ticker">' + esc(co.ticker) + '</span></div>';
    leftHtml += '<div class="cp-field"><span class="cp-label">CIK</span><span class="cp-value">' + esc(co.cik) + '</span></div>';
    leftHtml += '<div class="cp-field"><span class="cp-label">SIC</span><span class="cp-value">' + esc(co.sic) + '</span></div>';
    leftHtml += '<div class="cp-field"><span class="cp-label">Industry</span><span class="cp-value">' + esc(co.industry) + '</span></div>';
    leftHtml += '<div class="cp-field"><span class="cp-label">Domain</span><span class="cp-value"><a href="' + portalFile + '">' + esc(domainLabel) + '</a></span></div>';
    if (co.portalAttachment) {
      leftHtml += '<div class="cp-field"><span class="cp-label">Portal</span><span class="cp-value">' + esc(co.portalAttachment) + '</span></div>';
    }
    leftHtml += '</div>';

    // SEC links
    leftHtml += '<div class="cp-section">';
    leftHtml += '<div class="cp-section-title">SEC / EDGAR</div>';
    leftHtml += '<a class="cp-link" href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + esc(co.cik) + '&type=10-K&dateb=&owner=include&count=10" target="_blank" rel="noopener">10-K Filings</a>';
    leftHtml += '<a class="cp-link" href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + esc(co.cik) + '&type=10-Q&dateb=&owner=include&count=10" target="_blank" rel="noopener">10-Q Filings</a>';
    leftHtml += '</div>';

    // HELIX Report link
    leftHtml += '<div class="cp-section">';
    leftHtml += '<div class="cp-section-title">HELIX Analysis</div>';
    leftHtml += '<a class="cp-action" href="' + esc(co.helixReportUrl || ('helix-report.html?cik=' + co.cik)) + '">Run v4.0 Phase Analysis \u2192</a>';
    leftHtml += '</div>';

    // FRED Series
    if (co.fredSeries && co.fredSeries.length > 0) {
      leftHtml += '<div class="cp-section">';
      leftHtml += '<div class="cp-section-title">FRED Series</div>';
      for (var i = 0; i < co.fredSeries.length; i++) {
        var sid = co.fredSeries[i];
        leftHtml += '<a class="cp-link cp-fred" href="https://fred.stlouisfed.org/series/' + esc(sid) + '" target="_blank" rel="noopener">' + esc(sid) + '</a>';
      }
      leftHtml += '</div>';
    }

    document.getElementById('leftContent').innerHTML = leftHtml;

    // Right panel — Domain context
    var rightHtml = '';
    rightHtml += '<div class="cp-section">';
    rightHtml += '<div class="cp-section-title">Domain Relevance</div>';
    rightHtml += '<div class="cp-narrative">' + esc(co.domainRelevance) + '</div>';
    rightHtml += '</div>';

    rightHtml += '<div class="cp-section">';
    rightHtml += '<div class="cp-section-title">Portal Relevance</div>';
    rightHtml += '<div class="cp-narrative">' + esc(co.portalRelevance) + '</div>';
    rightHtml += '</div>';

    // Warning signals (placeholder for future)
    rightHtml += '<div class="cp-section">';
    rightHtml += '<div class="cp-section-title">Warning Signals</div>';
    if (co.warningSignals && co.warningSignals.length > 0) {
      for (var w = 0; w < co.warningSignals.length; w++) {
        rightHtml += '<div class="cp-signal cp-warning">' + esc(co.warningSignals[w]) + '</div>';
      }
    } else {
      rightHtml += '<div class="cp-empty">No active warnings</div>';
    }
    rightHtml += '</div>';

    // Opportunity signals (placeholder for future)
    rightHtml += '<div class="cp-section">';
    rightHtml += '<div class="cp-section-title">Opportunity Signals</div>';
    if (co.opportunitySignals && co.opportunitySignals.length > 0) {
      for (var o = 0; o < co.opportunitySignals.length; o++) {
        rightHtml += '<div class="cp-signal cp-opportunity">' + esc(co.opportunitySignals[o]) + '</div>';
      }
    } else {
      rightHtml += '<div class="cp-empty">No active opportunities</div>';
    }
    rightHtml += '</div>';

    // Intelligence Cycle
    if (co.intelligenceCycle && co.intelligenceCycle.length > 0) {
      // Gate B v0.1 \u2014 render execution gate. Categorical: if no execution
      // evidence exists for this entity, the intelligence-cycle text is a
      // procedure template, not entity-specific diagnosis. v0 used a
      // null-only predicate which produced a false negative on Chevron
      // (asOf=""). v0.1 uses helpers that treat null, undefined, empty
      // string, and whitespace-only strings as non-execution.
      // Existing fields read; no schema migration. Strong-form: banner at
      // section-title weight, not as a caveat below the verdict.
      // Boolean() coercion forces _executed to true/false so downstream
      // code cannot rely on a truthy non-boolean ("2024-Q3", arrays, etc).
      var _executed = Boolean(
        (co.financialHealth && hasNonBlankValue(co.financialHealth.asOf)) ||
        hasSubstantiveEntries(co.engineOutputs) ||
        hasSubstantiveEntries(co.bridgeReadings)
      );

      rightHtml += '<div class="cp-section">';
      if (!_executed) {
        rightHtml += '<div class="cp-section-title" style="color:#e85454">Intelligence Cycle \u2014 Procedure Template, Not Executed</div>';
        rightHtml += '<div style="padding:10px 12px;margin:6px 0 10px;border:1px solid rgba(232,84,84,0.35);background:rgba(232,84,84,0.06);border-radius:3px;font-size:0.4rem;line-height:1.7;color:rgba(232,180,180,0.85)">';
        rightHtml += '<strong style="letter-spacing:1.5px;color:#e85454">PROCEDURE TEMPLATE \u2014 NOT RUN FOR THIS ENTITY.</strong> ';
        rightHtml += 'The text below describes how diagnosis <em>would</em> be performed for ' + esc(co.name || 'this entity') + ', not what diagnosis has found. No execution recorded: ';
        rightHtml += '<code style="color:#e85454">financialHealth.asOf=' + (co.financialHealth && co.financialHealth.asOf != null ? esc(String(co.financialHealth.asOf)) : 'null') + '</code> &middot; ';
        rightHtml += '<code style="color:#e85454">engineOutputs=' + (Array.isArray(co.engineOutputs) && co.engineOutputs.length > 0 ? co.engineOutputs.length + ' items' : 'absent') + '</code> &middot; ';
        rightHtml += '<code style="color:#e85454">bridgeReadings=' + (Array.isArray(co.bridgeReadings) && co.bridgeReadings.length > 0 ? co.bridgeReadings.length + ' items' : 'absent') + '</code>';
        rightHtml += '</div>';
      } else {
        rightHtml += '<div class="cp-section-title">Intelligence Cycle</div>';
      }
      var layerIcons = { signal: '\u25C9', state: '\u25A3', diagnosis: '\u25C8', regulate: '\u25B7', action: '\u25B6', feedback: '\u25C0', adapt: '\u27F3' };
      for (var ic = 0; ic < co.intelligenceCycle.length; ic++) {
        var layer = co.intelligenceCycle[ic];
        // Canonical shape (enrich-portal-claude.js): { layer, name, items:[string,...] }
        // Legacy stub shape: { layerId, title, description, signals|diagnostics|actions:[{source|type, description}] }
        var layerId = layer.layer || layer.layerId || '';
        var layerLabel = layer.name || layer.title || layerId;
        var icon = layerIcons[layerId] || '\u25CB';
        rightHtml += '<div class="cp-intel-layer">';
        rightHtml += '<div class="cp-intel-header"><span class="cp-intel-icon">' + icon + '</span> ' + esc(String(layerLabel).toUpperCase()) + '</div>';
        if (layer.description) {
          rightHtml += '<div class="cp-intel-desc">' + esc(layer.description) + '</div>';
        }
        // New shape: items[] are plain strings. Legacy: signals|diagnostics|actions[] are {source|type, description} objects.
        var items = layer.items || layer.signals || layer.diagnostics || layer.actions || [];
        for (var ii = 0; ii < items.length; ii++) {
          var item = items[ii];
          rightHtml += '<div class="cp-intel-item">';
          if (item && typeof item === 'object') {
            if (item.source || item.type) rightHtml += '<span class="cp-intel-type">' + esc(item.source || item.type) + '</span> ';
            rightHtml += esc(item.description);
          } else {
            rightHtml += esc(item);
          }
          rightHtml += '</div>';
        }
        rightHtml += '</div>';
      }
      rightHtml += '</div>';
    }

    // Financial health (placeholder for future)
    rightHtml += '<div class="cp-section">';
    rightHtml += '<div class="cp-section-title">Financial Health</div>';
    if (co.financialHealth && Object.keys(co.financialHealth).length > 0) {
      var keys = Object.keys(co.financialHealth);
      for (var k = 0; k < keys.length; k++) {
        rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(keys[k]) + '</span><span class="cp-value">' + esc(String(co.financialHealth[keys[k]])) + '</span></div>';
      }
    } else {
      rightHtml += '<div class="cp-empty">Run HELIX Analysis to populate</div>';
    }
    rightHtml += '</div>';

    document.getElementById('rightContent').innerHTML = rightHtml;
    document.getElementById('rightEmpty').style.display = 'none';
    document.getElementById('rightContent').style.display = 'block';

    // Bottom bar
    document.getElementById('bottomLabel').textContent = co.name.toUpperCase() + ' \u00b7 ' + domainLabel.toUpperCase() + ' DOMAIN';
    document.getElementById('bottomStats').textContent = co.ticker + ' \u00b7 CIK ' + co.cik + ' \u00b7 SIC ' + co.sic;
  }

  function showError(msg) {
    document.getElementById('leftContent').innerHTML = '<div class="cp-error">' + esc(msg) + '</div>';
  }

  // showCompanyAbsent — graceful fallback when a slug has no deep portal but
  // is still known to the system (kernel-eligible row in command-board-data
  // or command-board-eligible). Renders an honest "portal not built yet"
  // message with the row's kernel data + a CTA back to kernel-comparison.
  // Triggered by deletions performed by the immune system (strip-placeholder-
  // portals.mjs) — the portal file is gone on purpose; this stops the bare
  // "Company not found" from leaking that as a system error.
  function showCompanyAbsent(slug, row, source) {
    var phase = (row.p || '').toUpperCase();
    var traj = (row.tr || row.trajectory || '').toUpperCase();
    var alert = row.a === true || row.alert === true;
    var composite = row.co != null ? row.co : (row.composite != null ? row.composite : null);
    var cik = row.c || row.cik;
    var name = row.n || row.name || slug;
    var ticker = row.t || row.ticker;
    var sector = row.sec || row.sector || row.d || row.domain || '';
    // The CB row carries a kernel reading (K1 phase + composite). Frame it
    // kernel-agnostic: this is "K1 says X" — not "the kernel" generically.
    // K2 and K3 readings would appear here too if the row carried them.
    var kernelChips = '';
    if (phase || composite !== null) {
      kernelChips +=
        '<div style="margin-bottom:10px">' +
          '<span style="display:inline-block;font-size:0.3rem;letter-spacing:2px;color:#5ab5a0;border:1px solid rgba(90,181,160,0.3);padding:2px 8px;border-radius:2px;background:rgba(90,181,160,0.05);margin-right:6px">K1 · FINANCIAL</span>' +
          (phase ? '<span style="color:#C9A94E;font-size:0.4rem;letter-spacing:1.5px">' + esc(phase) + '</span>' : '') +
          (composite !== null ? '<span style="color:rgba(200,195,184,0.55);font-size:0.36rem;margin-left:10px">composite ' + (typeof composite === 'number' ? composite.toFixed(3) : esc(String(composite))) + '</span>' : '') +
          (alert ? '<span style="color:#e85454;font-size:0.34rem;letter-spacing:1.5px;margin-left:10px">⚠ ALERT</span>' : '') +
        '</div>';
    }
    // K2 (polyvagal) — not yet on CB rows; will be populated by persist-k2-readings.mjs
    kernelChips +=
      '<div style="margin-bottom:10px;opacity:0.55">' +
        '<span style="display:inline-block;font-size:0.3rem;letter-spacing:2px;color:#C9A94E;border:1px solid rgba(201,169,78,0.25);padding:2px 8px;border-radius:2px;background:rgba(201,169,78,0.04);margin-right:6px">K2 · POLYVAGAL</span>' +
        '<span style="color:rgba(200,195,184,0.4);font-size:0.34rem">reading not yet persisted — run scripts/persist-k2-readings.mjs after the gate-relaxation deploys</span>' +
      '</div>';
    kernelChips +=
      '<div style="opacity:0.35">' +
        '<span style="display:inline-block;font-size:0.3rem;letter-spacing:2px;color:#4a8fd4;border:1px solid rgba(74,143,212,0.25);padding:2px 8px;border-radius:2px;background:rgba(74,143,212,0.04);margin-right:6px">K3 · RELATIONAL</span>' +
        '<span style="color:rgba(200,195,184,0.3);font-size:0.34rem">slot reserved — kernel TBD</span>' +
      '</div>';

    var html =
      '<div class="cp-absent" style="padding:20px;border:1px solid rgba(201,169,78,0.18);border-radius:3px;background:rgba(0,0,0,0.2);max-width:780px">' +
        '<div style="font-size:0.42rem;letter-spacing:2px;color:#C9A94E;margin-bottom:8px;text-transform:uppercase">No deep portal file</div>' +
        '<div style="font-size:0.7rem;letter-spacing:1px;color:#e8e3d9;margin-bottom:6px">' + esc(name) + (ticker ? ' <span style="color:rgba(200,195,184,0.45);font-size:0.46rem;margin-left:6px">' + esc(ticker) + '</span>' : '') + '</div>' +
        '<div style="font-size:0.36rem;color:rgba(200,195,184,0.5);line-height:1.6;margin-bottom:16px">No fractal portal was authored (or it was placeholder soup and the immune system removed it). The entity is still in the system — kernel readings below.</div>' +
        '<div style="margin-bottom:14px;padding:12px;border:1px solid rgba(255,255,255,0.04);background:rgba(0,0,0,0.2);border-radius:2px">' +
          '<div style="font-size:0.3rem;letter-spacing:2px;color:rgba(200,195,184,0.35);margin-bottom:8px;text-transform:uppercase">Kernel readings</div>' +
          kernelChips +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;font-size:0.34rem;margin-bottom:14px">' +
          (cik ? '<div><div style="color:rgba(200,195,184,0.3);font-size:0.3rem;letter-spacing:1.5px">CIK</div><div style="color:rgba(200,195,184,0.7)">' + esc(cik) + '</div></div>' : '') +
          (sector ? '<div><div style="color:rgba(200,195,184,0.3);font-size:0.3rem;letter-spacing:1.5px">SECTOR</div><div style="color:rgba(200,195,184,0.7)">' + esc(sector) + '</div></div>' : '') +
          (traj ? '<div><div style="color:rgba(200,195,184,0.3);font-size:0.3rem;letter-spacing:1.5px">TRAJECTORY (K1)</div><div style="color:rgba(200,195,184,0.7)">' + esc(traj) + '</div></div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:10px;font-size:0.32rem;letter-spacing:1.5px">' +
          '<a href="/kernel-comparison.html" style="padding:6px 12px;border:1px solid rgba(201,169,78,0.3);color:#C9A94E;text-decoration:none;border-radius:2px">← KERNEL-ELIGIBLE LIST</a>' +
          (cik ? '<a href="/helix-report.html?cik=' + encodeURIComponent(cik) + '&source_surface=portal_absent&requested_report_type=partial_phase_snapshot" style="padding:6px 12px;border:1px solid rgba(201,169,78,0.3);color:#C9A94E;text-decoration:none;border-radius:2px">HELIX REPORT</a>' : '') +
        '</div>' +
        '<div style="margin-top:14px;font-size:0.28rem;color:rgba(200,195,184,0.25);letter-spacing:1px">source: ' + esc(source) + ' · slug ' + esc(slug) + '</div>' +
      '</div>';
    document.getElementById('leftContent').innerHTML = html;
  }

  // resolveCompanyAbsence — async lookup of slug in CB universes. Calls back
  // with (row, source) if found, else null.
  function resolveCompanyAbsence(slug, cb) {
    loadJSON('assets/data/command-board-eligible.json', function(e1, eligibleData) {
      var rows = (eligibleData && eligibleData.companies) || [];
      for (var i = 0; i < rows.length; i++) if (rows[i].s === slug) { cb(rows[i], 'command-board-eligible'); return; }
      loadJSON('assets/data/command-board-data.json', function(e2, cbData) {
        var rows2 = (cbData && cbData.companies) || [];
        for (var j = 0; j < rows2.length; j++) if (rows2[j].s === slug) { cb(rows2[j], 'command-board-data'); return; }
        cb(null, null);
      });
    });
  }

  // Delegate through the exported property so external wrappers
  // (e.g., company-portal.html's inline kernel button + functionalNetwork
  // panel extensions) actually fire. The export was already mutable; the
  // internal init was just bypassing it.
  function _render(data) {
    var fn = (window.CompanyPortalUI && window.CompanyPortalUI.renderCompany) || renderCompany;
    return fn(data);
  }

  function init() {
    var companySlug = getParam('company');
    var ticker = getParam('ticker');
    var cik = getParam('cik');

    if (companySlug) {
      loadJSON('assets/data/companies/' + companySlug + '.json', function(err, data) {
        if (!err) { _render(data); return; }
        // miss: companySlug may be a known duplicate slug of a canonical portal
        // (e.g. akamai -> akamai_technologies). Resolve via the alias map, then
        // fall back to the not-found message.
        loadJSON('assets/data/company-aliases.json', function(aerr, amap) {
          var canon = amap && amap.aliases && amap.aliases[companySlug];
          if (canon && canon !== companySlug) {
            loadJSON('assets/data/companies/' + canon + '.json', function(e2, d2) {
              if (!e2) { _render(d2); return; }
              // alias resolution also missed — try graceful CB fallback
              resolveCompanyAbsence(companySlug, function(row, source) {
                if (row) showCompanyAbsent(companySlug, row, source);
                else showError('Company not found: ' + companySlug);
              });
            });
          } else {
            // no alias — try graceful CB fallback before declaring not found
            resolveCompanyAbsence(companySlug, function(row, source) {
              if (row) showCompanyAbsent(companySlug, row, source);
              else showError('Company not found: ' + companySlug);
            });
          }
        });
      });
    } else if (ticker || cik) {
      // Use resolver
      var input = ticker || cik;
      if (typeof window.LIMENCompanyResolver !== 'undefined') {
        window.LIMENCompanyResolver.resolve(input, function(result) {
          if (result) {
            loadJSON('assets/data/companies/' + result.slug + '.json', function(err, data) {
              if (err) { showError('Company data not found'); return; }
              _render(data);
            });
          } else {
            showError('No company found for: ' + input);
          }
        });
      } else {
        showError('Company resolver not loaded');
      }
    } else {
      showError('No company specified. Use ?company=slug, ?ticker=XOM, or ?cik=34088');
    }
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CompanyPortalUI = { init: init, renderCompany: renderCompany };
})();
