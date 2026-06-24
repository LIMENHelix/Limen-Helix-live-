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

  // Gate B v0.1 predicate + banner extracted to assets/js/render-authority.js
  // (commit 2b1d082). The inline hasNonBlankValue / hasSubstantiveEntries
  // helpers + the _executed branch below now call window.LIMENRenderAuthority.
  // This makes the predicate the single canonical authority across every
  // claim-painting renderer rather than a per-renderer inline patch.
  //
  // Doctrine: a render gate implemented inside one renderer is not a gate;
  // it is a patched exit. The shared module is the contract.

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

    // ── INFRASTRUCTURE-SPECIFIC PORTAL SECTIONS ──────────────────────────
    // Civil-infrastructure parity with the energy domain's company-metadata
    // sections. Mirrors the energy brain's diagnosis families (GRID_DEGRADATION,
    // MAINTENANCE_DEFICIT, INFRA_FUNDING_COLLAPSE, CYBER_PHYSICAL_ATTACK,
    // TRANSPORTATION_DISRUPTION — see infrastructure-brain.js diagnosisIndex)
    // as four company-portal sections. Each reads OPTIONAL company-JSON fields
    // and degrades gracefully (cp-empty) when not yet populated — identical
    // structure to the generic sections below, only the CONTENT is civil.
    // Energy's oil/gas/nuclear/renewable mix is translated to the civil
    // equivalents: asset-type portfolio, deferred-maintenance status,
    // NERC/FERC/OSHA/EPA compliance, and federal-grant/rate-base funding.
    if (co.domainId === 'infrastructure') {
      // Asset Portfolio — breakdown by civil asset type (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Asset Portfolio</div>';
      var _ap = co.assetPortfolio;
      if (_ap && (Array.isArray(_ap) ? _ap.length : Object.keys(_ap).length)) {
        var _apEntries = Array.isArray(_ap)
          ? _ap.map(function (e) { return [e.type || e.label || '', e.share != null ? e.share : (e.value != null ? e.value : e.detail)]; })
          : Object.keys(_ap).map(function (kk) { return [kk, _ap[kk]]; });
        for (var ap = 0; ap < _apEntries.length; ap++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_apEntries[ap][0]) + '</span><span class="cp-value">' + esc(String(_apEntries[ap][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No asset-type distribution recorded (transmission / distribution / roads / water-sewer / transit)</div>';
      }
      rightHtml += '</div>';

      // Maintenance Status — deferred-maintenance / asset-age tiers (energy: storage/reserve)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Maintenance Status</div>';
      var _ms = co.maintenanceStatus;
      if (_ms && Object.keys(_ms).length > 0) {
        var _msKeys = Object.keys(_ms);
        for (var msk = 0; msk < _msKeys.length; msk++) {
          var _msv = _ms[_msKeys[msk]];
          var _msStr = (_msv && typeof _msv === 'object' && !Array.isArray(_msv))
            ? Object.keys(_msv).map(function (sk) { return sk + ': ' + _msv[sk]; }).join('  ·  ')
            : String(_msv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_msKeys[msk]) + '</span><span class="cp-value">' + esc(_msStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No maintenance data (asset-age tiers, overdue-maintenance backlog $)</div>';
      }
      rightHtml += '</div>';

      // Regulatory Compliance — NERC/FERC/OSHA/EPA violation counts & trend
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Regulatory Compliance</div>';
      var _rc = co.regulatoryCompliance;
      if (_rc && (Array.isArray(_rc) ? _rc.length : Object.keys(_rc).length)) {
        var _rcEntries = Array.isArray(_rc)
          ? _rc.map(function (e) { return [e.agency || e.label || '', (e.violations != null ? e.violations : (e.count != null ? e.count : e.detail)) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_rc).map(function (kk) { return [kk, _rc[kk]]; });
        for (var rc = 0; rc < _rcEntries.length; rc++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_rcEntries[rc][0]) + '</span><span class="cp-value">' + esc(String(_rcEntries[rc][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No compliance record (NERC / FERC / OSHA / EPA violation count & trend)</div>';
      }
      rightHtml += '</div>';

      // Capital Funding — federal grant $, state match, rate-base dependency
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Capital Funding</div>';
      var _cf = co.capitalFunding;
      if (_cf && Object.keys(_cf).length > 0) {
        var _cfKeys = Object.keys(_cf);
        for (var cfk = 0; cfk < _cfKeys.length; cfk++) {
          var _cfv = _cf[_cfKeys[cfk]];
          var _cfStr = (_cfv && typeof _cfv === 'object' && !Array.isArray(_cfv))
            ? Object.keys(_cfv).map(function (sk) { return sk + ': ' + _cfv[sk]; }).join('  ·  ')
            : String(_cfv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_cfKeys[cfk]) + '</span><span class="cp-value">' + esc(_cfStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No funding profile (federal grant $ committed, state matching funds, rate-base dependency)</div>';
      }
      rightHtml += '</div>';
    }

    // ── FINANCE-SPECIFIC PORTAL SECTIONS ─────────────────────────────────
    // Capital-markets / credit / liquidity / solvency parity with the energy
    // domain's company-metadata sections, mirroring the infrastructure block
    // above. This is STRICTLY ADDITIVE render-layer content keyed on
    // co.domainId === 'finance'; it never touches the validated P3 distress
    // kernel (Thing1) scoring path consumed by /api/limen/score or
    // /api/helix/helix-report/score — those run server-side off the kernel,
    // not off these optional company-JSON display fields.
    //
    // Energy's oil/gas/grid/datacenter mix is translated to the financial
    // equivalents: facility-type credit portfolio (energy: generation mix),
    // leverage/solvency status (energy: maintenance/asset-age), capital
    // structure & covenant compliance (energy: NERC/FERC compliance), and
    // liquidity position / stress-test coverage (energy: capital funding).
    // Each reads OPTIONAL company-JSON fields and degrades gracefully
    // (cp-empty) when not yet populated — identical structure to the
    // generic sections below, only the CONTENT is financial.
    if (co.domainId === 'finance') {
      // Credit Portfolio — facility types / amounts / maturities (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Credit Portfolio</div>';
      var _cpf = co.creditPortfolio;
      if (_cpf && (Array.isArray(_cpf) ? _cpf.length : Object.keys(_cpf).length)) {
        var _cpfEntries = Array.isArray(_cpf)
          ? _cpf.map(function (e) { return [e.facility || e.type || e.label || '', e.amount != null ? e.amount : (e.share != null ? e.share : (e.value != null ? e.value : e.detail))]; })
          : Object.keys(_cpf).map(function (kk) { return [kk, _cpf[kk]]; });
        for (var cpf = 0; cpf < _cpfEntries.length; cpf++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_cpfEntries[cpf][0]) + '</span><span class="cp-value">' + esc(String(_cpfEntries[cpf][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No credit-facility distribution recorded (term loans / revolvers / bonds / securitizations — amounts & maturities)</div>';
      }
      rightHtml += '</div>';

      // Solvency Status — leverage ratio / equity cushion / default-risk metrics (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Solvency Status</div>';
      var _sst = co.leverageStatus;
      if (_sst && Object.keys(_sst).length > 0) {
        var _sstKeys = Object.keys(_sst);
        for (var ssk = 0; ssk < _sstKeys.length; ssk++) {
          var _sstv = _sst[_sstKeys[ssk]];
          var _sstStr = (_sstv && typeof _sstv === 'object' && !Array.isArray(_sstv))
            ? Object.keys(_sstv).map(function (sk) { return sk + ': ' + _sstv[sk]; }).join('  ·  ')
            : String(_sstv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_sstKeys[ssk]) + '</span><span class="cp-value">' + esc(_sstStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No solvency data (leverage ratio, equity cushion, default-risk / PD metrics)</div>';
      }
      rightHtml += '</div>';

      // Capital Structure — debt/equity mix / subordination / covenant compliance (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Capital Structure</div>';
      var _cst = co.capitalStructure;
      if (_cst && (Array.isArray(_cst) ? _cst.length : Object.keys(_cst).length)) {
        var _cstEntries = Array.isArray(_cst)
          ? _cst.map(function (e) { return [e.tranche || e.tier || e.label || '', (e.share != null ? e.share : (e.amount != null ? e.amount : e.detail)) + (e.covenant ? ' (' + e.covenant + ')' : '')]; })
          : Object.keys(_cst).map(function (kk) { return [kk, _cst[kk]]; });
        for (var cst = 0; cst < _cstEntries.length; cst++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_cstEntries[cst][0]) + '</span><span class="cp-value">' + esc(String(_cstEntries[cst][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No capital-structure record (debt/equity mix, subordination / seniority tranches, covenant compliance)</div>';
      }
      rightHtml += '</div>';

      // Liquidity Position — cash / undrawn facilities / repo haircuts / stress-test coverage (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Liquidity Position</div>';
      var _lqp = co.liquidityPosition;
      if (_lqp && Object.keys(_lqp).length > 0) {
        var _lqpKeys = Object.keys(_lqp);
        for (var lqk = 0; lqk < _lqpKeys.length; lqk++) {
          var _lqpv = _lqp[_lqpKeys[lqk]];
          var _lqpStr = (_lqpv && typeof _lqpv === 'object' && !Array.isArray(_lqpv))
            ? Object.keys(_lqpv).map(function (sk) { return sk + ': ' + _lqpv[sk]; }).join('  ·  ')
            : String(_lqpv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_lqpKeys[lqk]) + '</span><span class="cp-value">' + esc(_lqpStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No liquidity profile (cash & equivalents, undrawn facilities, repo haircuts, stress-test coverage ratio)</div>';
      }
      rightHtml += '</div>';
    }

    // ── ECONOMY-SPECIFIC PORTAL SECTIONS ─────────────────────────────────
    // Macroeconomic parity with the energy domain's company-metadata sections,
    // mirroring the infrastructure and finance blocks above. STRICTLY ADDITIVE
    // render-layer content keyed on co.domainId === 'economy'; it never touches
    // the validated P3 distress kernel scoring path.
    //
    // Economy is the MACRO AGGREGATE and stays DISTINCT from finance (capital
    // markets / credit / banks). Where finance surfaces a company's own credit
    // facilities, economy surfaces how a company is COUPLED to the macro
    // regime — derived from its economy-node mapping (economy-node-business-
    // engine.js maps e.g. a bank to CBLM=Monetary-Policy / credit transmission,
    // a digital retailer to CAUD=Digital-Economy) and that node's dysregulation
    // thresholds. Content is macro only: GDP & growth (GDP/GDPC1), inflation
    // (CPIAUCSL/PCEPI), employment & labor (UNRATE/PAYEMS), sentiment
    // (UMCSENT/INDPRO), fiscal & monetary policy (FEDFUNDS/DGS10), the business
    // cycle, trade balance, and productivity — NEVER oil/gas/grid/datacenter.
    //
    // Energy's oil/gas/grid/datacenter mix is translated to the macro
    // equivalents: macro-factor exposure (energy: generation mix), business-
    // cycle position (energy: maintenance/asset-age), fiscal/monetary policy
    // exposure (energy: NERC/FERC compliance), and demand/supply position
    // (energy: capital funding). Each reads OPTIONAL company-JSON fields and
    // degrades gracefully (cp-empty) when not yet populated.
    if (co.domainId === 'economy') {
      // Macro Exposure — sensitivities to the macro regime (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Macro Exposure</div>';
      var _mex = co.macroExposure;
      if (_mex && (Array.isArray(_mex) ? _mex.length : Object.keys(_mex).length)) {
        var _mexEntries = Array.isArray(_mex)
          ? _mex.map(function (e) { return [e.factor || e.label || '', e.sensitivity != null ? e.sensitivity : (e.beta != null ? e.beta : (e.value != null ? e.value : e.detail))]; })
          : Object.keys(_mex).map(function (kk) { return [kk, _mex[kk]]; });
        for (var mex = 0; mex < _mexEntries.length; mex++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_mexEntries[mex][0]) + '</span><span class="cp-value">' + esc(String(_mexEntries[mex][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No macro-factor sensitivities recorded (GDP-growth sensitivity, employment elasticity, inflation beta vs CPI/PCE, credit-cycle correlation, fiscal-multiplier weight)</div>';
      }
      rightHtml += '</div>';

      // Business Cycle — position in the expansion/recession cycle (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Business Cycle</div>';
      var _bcm = co.businessCycleMetrics;
      if (_bcm && Object.keys(_bcm).length > 0) {
        var _bcmKeys = Object.keys(_bcm);
        for (var bck = 0; bck < _bcmKeys.length; bck++) {
          var _bcmv = _bcm[_bcmKeys[bck]];
          var _bcmStr = (_bcmv && typeof _bcmv === 'object' && !Array.isArray(_bcmv))
            ? Object.keys(_bcmv).map(function (sk) { return sk + ': ' + _bcmv[sk]; }).join('  ·  ')
            : String(_bcmv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_bcmKeys[bck]) + '</span><span class="cp-value">' + esc(_bcmStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No business-cycle data (recession-probability vs base, cycle-relative position, leading-indicator composite, default-risk proxy)</div>';
      }
      rightHtml += '</div>';

      // Policy Exposure — fiscal & monetary policy coupling (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Policy Exposure</div>';
      var _pex = co.policyExposure;
      if (_pex && (Array.isArray(_pex) ? _pex.length : Object.keys(_pex).length)) {
        var _pexEntries = Array.isArray(_pex)
          ? _pex.map(function (e) { return [e.lever || e.policy || e.label || '', (e.exposure != null ? e.exposure : (e.value != null ? e.value : e.detail)) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_pex).map(function (kk) { return [kk, _pex[kk]]; });
        for (var pex = 0; pex < _pexEntries.length; pex++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_pexEntries[pex][0]) + '</span><span class="cp-value">' + esc(String(_pexEntries[pex][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No policy-exposure record (fiscal-stimulus beneficiary vs drag, monetary-transmission lag vs FEDFUNDS/DGS10, regulatory-uncertainty ranking)</div>';
      }
      rightHtml += '</div>';

      // Demand / Supply Position — macro shock resilience (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Demand / Supply Position</div>';
      var _dsp = co.demandSupplyProfile;
      if (_dsp && Object.keys(_dsp).length > 0) {
        var _dspKeys = Object.keys(_dsp);
        for (var dsk = 0; dsk < _dspKeys.length; dsk++) {
          var _dspv = _dsp[_dspKeys[dsk]];
          var _dspStr = (_dspv && typeof _dspv === 'object' && !Array.isArray(_dspv))
            ? Object.keys(_dspv).map(function (sk) { return sk + ': ' + _dspv[sk]; }).join('  ·  ')
            : String(_dspv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_dspKeys[dsk]) + '</span><span class="cp-value">' + esc(_dspStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No demand/supply profile (demand-shock resilience, supply-chain redundancy, input-cost exposure, margin-compression risk)</div>';
      }
      rightHtml += '</div>';
    }

    // ── TECHNOLOGY-SPECIFIC PORTAL SECTIONS ──────────────────────────────
    // Compute / semiconductor / cyber / AI-capex parity with the energy
    // domain's company-metadata sections, mirroring the infrastructure,
    // finance, and economy blocks above. STRICTLY ADDITIVE render-layer
    // content keyed on co.domainId === 'technology'; it never touches the
    // validated P3 distress kernel scoring path.
    //
    // Technology is CHIPS / SOFTWARE / AI / CYBER and stays DISTINCT from
    // finance (fintech is a coupling, not the identity) and from energy
    // (compute couples to energy via power demand, but the domain's OWN
    // content is silicon/software/AI/security, NEVER oil/gas/grid). Sections
    // are anchored to technology-brain.js diagnosis families: Compute
    // Portfolio + Chip Roadmap (CHIP_SHORTAGE), Cybersecurity Posture
    // (CYBER_ATTACK / DATA_BREACH), AI Capex Efficiency (AI_ALIGNMENT_FAILURE
    // / INFRASTRUCTURE_COLLAPSE). Real tickers: NVDA, AMD, INTC, TSM, ASML,
    // AVGO, MSFT, GOOGL, META, AMZN, ORCL, CRM, PLTR, CRWD, PANW, AAPL.
    //
    // Energy's oil/gas/grid/datacenter mix is translated to the compute
    // equivalents: accelerator/cloud portfolio (energy: generation mix),
    // fab-node roadmap (energy: maintenance/asset-age), cybersecurity posture
    // (energy: NERC/FERC compliance), and AI-capex efficiency (energy: capital
    // funding). Each reads OPTIONAL company-JSON fields and degrades
    // gracefully (cp-empty) when not yet populated.
    if (co.domainId === 'technology') {
      // Compute Portfolio — breakdown by accelerator type / cloud / on-prem (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Compute Portfolio</div>';
      var _cmp = co.computePortfolio;
      if (_cmp && (Array.isArray(_cmp) ? _cmp.length : Object.keys(_cmp).length)) {
        var _cmpEntries = Array.isArray(_cmp)
          ? _cmp.map(function (e) { return [e.type || e.accelerator || e.provider || e.label || '', e.share != null ? e.share : (e.capacity != null ? e.capacity : (e.value != null ? e.value : e.detail))]; })
          : Object.keys(_cmp).map(function (kk) { return [kk, _cmp[kk]]; });
        for (var cmp = 0; cmp < _cmpEntries.length; cmp++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_cmpEntries[cmp][0]) + '</span><span class="cp-value">' + esc(String(_cmpEntries[cmp][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No compute distribution recorded (GPU / TPU / custom-ASIC mix, cloud-provider split, on-premise capacity)</div>';
      }
      rightHtml += '</div>';

      // Chip Roadmap — fab node / transition timeline / wafer allocation (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Chip Roadmap</div>';
      var _chr = co.chipRoadmap;
      if (_chr && Object.keys(_chr).length > 0) {
        var _chrKeys = Object.keys(_chr);
        for (var chk = 0; chk < _chrKeys.length; chk++) {
          var _chrv = _chr[_chrKeys[chk]];
          var _chrStr = (_chrv && typeof _chrv === 'object' && !Array.isArray(_chrv))
            ? Object.keys(_chrv).map(function (sk) { return sk + ': ' + _chrv[sk]; }).join('  ·  ')
            : String(_chrv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_chrKeys[chk]) + '</span><span class="cp-value">' + esc(_chrStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No roadmap data (current fab node nm, next-node transition timeline, wafer allocation by design / foundry dependency)</div>';
      }
      rightHtml += '</div>';

      // Cybersecurity Posture — attack surface / disclosure SLA / patch velocity (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Cybersecurity Posture</div>';
      var _cyb = co.cybersecurityPosture;
      if (_cyb && (Array.isArray(_cyb) ? _cyb.length : Object.keys(_cyb).length)) {
        var _cybEntries = Array.isArray(_cyb)
          ? _cyb.map(function (e) { return [e.metric || e.control || e.label || '', (e.value != null ? e.value : (e.count != null ? e.count : e.detail)) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_cyb).map(function (kk) { return [kk, _cyb[kk]]; });
        for (var cyb = 0; cyb < _cybEntries.length; cyb++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_cybEntries[cyb][0]) + '</span><span class="cp-value">' + esc(String(_cybEntries[cyb][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No security posture recorded (supply-chain attack surface, vulnerability-disclosure SLA, patch velocity, open CVE count & trend)</div>';
      }
      rightHtml += '</div>';

      // AI Capex Efficiency — training cost / inference-per-FLOP / power-per-op (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">AI Capex Efficiency</div>';
      var _aice = co.aiCapexEfficiency;
      if (_aice && Object.keys(_aice).length > 0) {
        var _aiceKeys = Object.keys(_aice);
        for (var aik = 0; aik < _aiceKeys.length; aik++) {
          var _aicev = _aice[_aiceKeys[aik]];
          var _aiceStr = (_aicev && typeof _aicev === 'object' && !Array.isArray(_aicev))
            ? Object.keys(_aicev).map(function (sk) { return sk + ': ' + _aicev[sk]; }).join('  ·  ')
            : String(_aicev);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_aiceKeys[aik]) + '</span><span class="cp-value">' + esc(_aiceStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No AI-capex profile (training-cost-per-token trajectory, inference-per-FLOP improvement, power-per-operation, capex-to-utilized-compute ratio)</div>';
      }
      rightHtml += '</div>';
    }

    // ── INTELLIGENCE-SPECIFIC PORTAL SECTIONS ────────────────────────────
    // Collection / analysis / oversight / counterintelligence parity with the
    // energy domain's company-metadata sections, mirroring the infrastructure,
    // finance, economy, and technology blocks above. STRICTLY ADDITIVE
    // render-layer content keyed on co.domainId === 'intelligence'; it never
    // touches the validated P3 distress kernel scoring path consumed by
    // /api/limen/score or /api/helix/helix-report/score.
    //
    // Intelligence is COLLECTION (SIGINT / HUMINT / GEOINT / OSINT / CYBERINT),
    // all-source ANALYSIS & assessment, ESPIONAGE & counterintelligence,
    // surveillance & reconnaissance, threat warning, covert action, and
    // information / influence operations. It stays DISTINCT from defense
    // (defense = kinetic / industrial / readiness) and from technology (cyber
    // tooling is a COUPLING into collection, not the domain's identity). The
    // domain's OWN content is collection disciplines, analytic tradecraft,
    // oversight / clearance, and insider-risk — NEVER oil/gas/grid. Real
    // intelligence-sector tickers: PLTR, BAH, LDOS, CACI, SAIC, KBR, VRNT,
    // NICE, VRSK.
    //
    // Energy's oil/gas/grid/datacenter mix is translated to the intelligence
    // equivalents: collection-discipline portfolio (energy: generation mix),
    // analytical-maturity / tradecraft modernization (energy: maintenance/
    // asset-age), trust & oversight compliance (energy: NERC/FERC compliance),
    // and counterintelligence posture (energy: capital funding). Each reads
    // OPTIONAL company-JSON fields and degrades gracefully (cp-empty) when not
    // yet populated.
    if (co.domainId === 'intelligence') {
      // Collection Capability — breakdown by collection discipline / asset type (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Collection Capability</div>';
      var _coll = co.collectionPortfolio;
      if (_coll && (Array.isArray(_coll) ? _coll.length : Object.keys(_coll).length)) {
        var _collEntries = Array.isArray(_coll)
          ? _coll.map(function (e) { return [e.discipline || e.type || e.label || '', e.share != null ? e.share : (e.assets != null ? e.assets : (e.value != null ? e.value : e.detail))]; })
          : Object.keys(_coll).map(function (kk) { return [kk, _coll[kk]]; });
        for (var coll = 0; coll < _collEntries.length; coll++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_collEntries[coll][0]) + '</span><span class="cp-value">' + esc(String(_collEntries[coll][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No collection-discipline distribution recorded (SIGINT / HUMINT / GEOINT / OSINT / CYBERINT mix, asset types — satellites, sensor networks, human networks)</div>';
      }
      rightHtml += '</div>';

      // Analytical Maturity — fusion / debiasing / tradecraft modernization (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Analytical Maturity</div>';
      var _am = co.analyticalMaturity;
      if (_am && Object.keys(_am).length > 0) {
        var _amKeys = Object.keys(_am);
        for (var amk = 0; amk < _amKeys.length; amk++) {
          var _amv = _am[_amKeys[amk]];
          var _amStr = (_amv && typeof _amv === 'object' && !Array.isArray(_amv))
            ? Object.keys(_amv).map(function (sk) { return sk + ': ' + _amv[sk]; }).join('  ·  ')
            : String(_amv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_amKeys[amk]) + '</span><span class="cp-value">' + esc(_amStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No analytic-maturity data (all-source fusion capability, structured-debiasing investment, tradecraft-modernization tier, analyst-to-collector ratio)</div>';
      }
      rightHtml += '</div>';

      // Trust & Oversight — legal compliance / FOIA / inspector-general findings (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Trust &amp; Oversight</div>';
      var _to = co.trustCompliance;
      if (_to && (Array.isArray(_to) ? _to.length : Object.keys(_to).length)) {
        var _toEntries = Array.isArray(_to)
          ? _to.map(function (e) { return [e.authority || e.body || e.label || '', (e.findings != null ? e.findings : (e.value != null ? e.value : (e.count != null ? e.count : e.detail))) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_to).map(function (kk) { return [kk, _to[kk]]; });
        for (var to = 0; to < _toEntries.length; to++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_toEntries[to][0]) + '</span><span class="cp-value">' + esc(String(_toEntries[to][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No oversight record (FISA / EO-12333 legal compliance, FOIA responsiveness, inspector-general findings & trend, congressional-oversight standing)</div>';
      }
      rightHtml += '</div>';

      // Counterintelligence Posture — insider-threat / supply-chain / compartmentalization (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Counterintelligence Posture</div>';
      var _cip = co.counterintelligencePosture;
      if (_cip && Object.keys(_cip).length > 0) {
        var _cipKeys = Object.keys(_cip);
        for (var cipk = 0; cipk < _cipKeys.length; cipk++) {
          var _cipv = _cip[_cipKeys[cipk]];
          var _cipStr = (_cipv && typeof _cipv === 'object' && !Array.isArray(_cipv))
            ? Object.keys(_cipv).map(function (sk) { return sk + ': ' + _cipv[sk]; }).join('  ·  ')
            : String(_cipv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_cipKeys[cipk]) + '</span><span class="cp-value">' + esc(_cipStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No counterintelligence profile (insider-threat controls, supply-chain security, compartmentalization discipline, clearance-backlog & continuous-vetting coverage)</div>';
      }
      rightHtml += '</div>';
    }

    // ── INDUSTRY-SPECIFIC PORTAL SECTIONS ────────────────────────────────
    // Manufacturing & industrial-production parity with the energy domain's
    // company-metadata sections, mirroring the infrastructure, finance,
    // economy, technology, and intelligence blocks above. STRICTLY ADDITIVE
    // render-layer content keyed on co.domainId === 'industry'; it never
    // touches the validated P3 distress kernel scoring path consumed by
    // /api/limen/score or /api/helix/helix-report/score — those run
    // server-side off the kernel, not off these optional company-JSON
    // display fields.
    //
    // Industry is FACTORY OUTPUT & capacity utilization, automation &
    // robotics, heavy industry & capital goods, machinery & equipment, and
    // industrial maintenance / modernization. It stays DISTINCT from trade
    // (logistics / commerce flow), economy (the macro aggregate), and
    // technology (automation/robotics is a COUPLING into the factory, not the
    // domain's identity). The domain's OWN content is production lines,
    // utilized vs nameplate capacity, equipment age / modernization backlog,
    // and the industrial workforce — NEVER oil/gas/grid. Real industrial /
    // capital-goods tickers: CAT, DE, GE, HON, MMM, EMR, ITW, ETN, PH, ROK,
    // DOV, GEV.
    //
    // Energy's oil/gas/grid/datacenter mix is translated to the industrial
    // equivalents: production-line portfolio (energy: generation mix),
    // capacity-utilization / bottleneck status (energy: maintenance/asset-age),
    // automation posture & modernization backlog (energy: NERC/FERC
    // compliance), and labor position / workforce profile (energy: capital
    // funding). Each reads OPTIONAL company-JSON fields and degrades
    // gracefully (cp-empty) when not yet populated.
    if (co.domainId === 'industry') {
      // Production Portfolio — breakdown by facility type / line / geography (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Production Portfolio</div>';
      var _pp = co.productionPortfolio;
      if (_pp && (Array.isArray(_pp) ? _pp.length : Object.keys(_pp).length)) {
        var _ppEntries = Array.isArray(_pp)
          ? _pp.map(function (e) { return [e.facility || e.line || e.type || e.label || '', e.share != null ? e.share : (e.output != null ? e.output : (e.value != null ? e.value : e.detail))]; })
          : Object.keys(_pp).map(function (kk) { return [kk, _pp[kk]]; });
        for (var pp = 0; pp < _ppEntries.length; pp++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_ppEntries[pp][0]) + '</span><span class="cp-value">' + esc(String(_ppEntries[pp][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No production distribution recorded (facility-type / line / product mix, output share, geographic plant split)</div>';
      }
      rightHtml += '</div>';

      // Capacity Utilization — current vs potential, bottleneck mapping (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Capacity Utilization</div>';
      var _cm = co.capacityMetrics;
      if (_cm && Object.keys(_cm).length > 0) {
        var _cmKeys = Object.keys(_cm);
        for (var cmk = 0; cmk < _cmKeys.length; cmk++) {
          var _cmv = _cm[_cmKeys[cmk]];
          var _cmStr = (_cmv && typeof _cmv === 'object' && !Array.isArray(_cmv))
            ? Object.keys(_cmv).map(function (sk) { return sk + ': ' + _cmv[sk]; }).join('  ·  ')
            : String(_cmv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_cmKeys[cmk]) + '</span><span class="cp-value">' + esc(_cmStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No capacity data (current vs nameplate utilization %, bottleneck stage, backlog / order coverage, downtime hours)</div>';
      }
      rightHtml += '</div>';

      // Automation Posture — equipment age, modernization backlog (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Automation Posture</div>';
      var _as = co.automationStatus;
      if (_as && (Array.isArray(_as) ? _as.length : Object.keys(_as).length)) {
        var _asEntries = Array.isArray(_as)
          ? _as.map(function (e) { return [e.metric || e.line || e.label || '', (e.value != null ? e.value : (e.age != null ? e.age : e.detail)) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_as).map(function (kk) { return [kk, _as[kk]]; });
        for (var as = 0; as < _asEntries.length; as++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_asEntries[as][0]) + '</span><span class="cp-value">' + esc(String(_asEntries[as][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No automation record (robotics / automation coverage %, average equipment age yrs, modernization-backlog $, retooling cadence & trend)</div>';
      }
      rightHtml += '</div>';

      // Labor Position — FTE, skill distribution, turnover, wages (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Labor Position</div>';
      var _lp = co.laborProfile;
      if (_lp && Object.keys(_lp).length > 0) {
        var _lpKeys = Object.keys(_lp);
        for (var lpk = 0; lpk < _lpKeys.length; lpk++) {
          var _lpv = _lp[_lpKeys[lpk]];
          var _lpStr = (_lpv && typeof _lpv === 'object' && !Array.isArray(_lpv))
            ? Object.keys(_lpv).map(function (sk) { return sk + ': ' + _lpv[sk]; }).join('  ·  ')
            : String(_lpv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_lpKeys[lpk]) + '</span><span class="cp-value">' + esc(_lpStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No labor profile (production-FTE count, skill distribution, turnover rate, wage position vs sector, union / overtime exposure)</div>';
      }
      rightHtml += '</div>';
    }

    // ── ENVIRONMENT-SPECIFIC PORTAL SECTIONS ─────────────────────────────
    // Climate / emissions / pollution / ecosystems parity with the energy
    // domain's company-metadata sections, mirroring the infrastructure,
    // finance, economy, technology, intelligence, and industry blocks above.
    // STRICTLY ADDITIVE render-layer content keyed on co.domainId ===
    // 'environment'; it never touches the validated P3 distress kernel
    // scoring path consumed by /api/limen/score or /api/helix/helix-report/
    // score — those run server-side off the kernel, not off these optional
    // company-JSON display fields.
    //
    // Environment is CLIMATE & EMISSIONS (GHG intensity, Scope 1/2/3, carbon
    // budget), AIR/WATER/SOIL POLLUTION & QUALITY, ECOSYSTEMS & BIODIVERSITY
    // (habitat loss, species indices, conservation coverage), NATURAL
    // RESOURCES & CONSERVATION, environmental REGULATION & COMPLIANCE (EPA /
    // state / international permits, emissions caps), climate RISK & adaptation,
    // WASTE MANAGEMENT & remediation, and CARBON MARKETS. It stays DISTINCT
    // from energy (energy = oil/gas/grid/power-generation fuel content;
    // environment couples to energy ONLY via emissions/carbon, its OWN
    // identity is climate/pollution/ecosystems) and from agriculture (land /
    // water use is a coupling, not the domain's identity). Real environmental-
    // sector tickers: WM, RSG, WCN, CWST (waste & remediation), AWK, WTRG, XYL
    // (water utilities & infrastructure), ECL, LIN, APD (treatment / industrial
    // gases & carbon-capture inputs), DAR (renderable-waste / circular), AY
    // (sustainable infrastructure).
    //
    // Energy's generation mix → emissions-source portfolio. Energy's
    // maintenance/asset-age → pollution profile (air/water/soil quality &
    // violation trends). Energy's NERC/FERC compliance → biodiversity &
    // ecosystem status. Energy's capital funding → environmental regulatory
    // compliance (EPA / state / international permits, emissions caps, breach
    // risk). Each reads OPTIONAL company-JSON fields and degrades gracefully
    // (cp-empty) when not yet populated.
    if (co.domainId === 'environment') {
      // Emissions Portfolio — GHG breakdown by source / scope (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Emissions Portfolio</div>';
      var _ep = co.emissionsPortfolio;
      if (_ep && (Array.isArray(_ep) ? _ep.length : Object.keys(_ep).length)) {
        var _epEntries = Array.isArray(_ep)
          ? _ep.map(function (e) { return [e.source || e.scope || e.type || e.label || '', e.share != null ? e.share : (e.intensity != null ? e.intensity : (e.value != null ? e.value : e.detail))]; })
          : Object.keys(_ep).map(function (kk) { return [kk, _ep[kk]]; });
        for (var ep = 0; ep < _epEntries.length; ep++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_epEntries[ep][0]) + '</span><span class="cp-value">' + esc(String(_epEntries[ep][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No emissions distribution recorded (GHG intensity tCO2e, Scope 1 / 2 / 3 breakdown, methane vs CO2 mix, carbon-budget headroom)</div>';
      }
      rightHtml += '</div>';

      // Pollution Profile — air/water/soil quality metrics & violation trends (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Pollution Profile</div>';
      var _pol = co.pollutionProfile;
      if (_pol && Object.keys(_pol).length > 0) {
        var _polKeys = Object.keys(_pol);
        for (var polk = 0; polk < _polKeys.length; polk++) {
          var _polv = _pol[_polKeys[polk]];
          var _polStr = (_polv && typeof _polv === 'object' && !Array.isArray(_polv))
            ? Object.keys(_polv).map(function (sk) { return sk + ': ' + _polv[sk]; }).join('  ·  ')
            : String(_polv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_polKeys[polk]) + '</span><span class="cp-value">' + esc(_polStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No pollution data (air-quality / criteria-pollutant levels, water-discharge quality, soil / hazardous-waste contamination, TRI release trend)</div>';
      }
      rightHtml += '</div>';

      // Biodiversity & Ecosystem Status — habitat / species / conservation coverage (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Biodiversity &amp; Ecosystem Status</div>';
      var _bio = co.biodiversityStatus;
      if (_bio && (Array.isArray(_bio) ? _bio.length : Object.keys(_bio).length)) {
        var _bioEntries = Array.isArray(_bio)
          ? _bio.map(function (e) { return [e.metric || e.indicator || e.label || '', (e.value != null ? e.value : (e.index != null ? e.index : e.detail)) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_bio).map(function (kk) { return [kk, _bio[kk]]; });
        for (var bio = 0; bio < _bioEntries.length; bio++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_bioEntries[bio][0]) + '</span><span class="cp-value">' + esc(String(_bioEntries[bio][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No biodiversity record (habitat-loss rate, species-abundance / IUCN index, conservation-priority-area coverage %, no-net-loss commitment & trend)</div>';
      }
      rightHtml += '</div>';

      // Regulatory Compliance — EPA / state / international permits, emissions caps, breach risk (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Regulatory Compliance</div>';
      var _erc = co.environmentalCompliance;
      if (_erc && Object.keys(_erc).length > 0) {
        var _ercKeys = Object.keys(_erc);
        for (var erck = 0; erck < _ercKeys.length; erck++) {
          var _ercv = _erc[_ercKeys[erck]];
          var _ercStr = (_ercv && typeof _ercv === 'object' && !Array.isArray(_ercv))
            ? Object.keys(_ercv).map(function (sk) { return sk + ': ' + _ercv[sk]; }).join('  ·  ')
            : String(_ercv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_ercKeys[erck]) + '</span><span class="cp-value">' + esc(_ercStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No compliance profile (EPA / state / international environmental permits, Clean Air / Clean Water Act standing, emissions-cap headroom, consent decrees, breach-risk & penalty exposure)</div>';
      }
      rightHtml += '</div>';
    }

    // ── AGRICULTURE-SPECIFIC PORTAL SECTIONS ─────────────────────────────
    // Farming / livestock / agribusiness / food-production parity with the
    // energy domain's company-metadata sections, mirroring the infrastructure,
    // finance, economy, technology, intelligence, industry, and environment
    // blocks above. STRICTLY ADDITIVE render-layer content keyed on the
    // agriculture domain id (co.domainId === 'agriculture' || 'p2_agri', the
    // runtime key per DOMAIN_LABELS / portal routing); it never touches the
    // validated P3 distress kernel scoring path consumed by /api/limen/score
    // or /api/helix/helix-report/score — those run server-side off the kernel,
    // not off these optional company-JSON display fields.
    //
    // Agriculture is FARMING & CROPS, LIVESTOCK & ANIMAL PROTEIN, AGRIBUSINESS
    // & FOOD PRODUCTION, FOOD SECURITY & SUPPLY, FERTILIZERS & CROP INPUTS,
    // IRRIGATION & AGRICULTURAL WATER, COMMODITY CROPS (corn / soy / wheat),
    // AGRICULTURAL TECHNOLOGY & PRECISION AG, and FARM ECONOMICS. It stays
    // DISTINCT from environment (land / water / climate is a coupling, not the
    // identity), from trade (export logistics is a coupling), and from economy
    // (food prices is a coupling). Energy is NEVER the domain's OWN content —
    // biofuel demand and fertilizer-energy cost are couplings, not identity.
    // Real ag-sector tickers: ADM, BG, CTVA, DE, NTR, MOS, CF, TSN, CAG, INGR,
    // AGCO, FMC. Commodity references: CBOT corn / soybeans / wheat, USDA WASDE.
    //
    // Energy's generation mix → crop / livestock production portfolio. Energy's
    // maintenance/asset-age → farm & land status (acreage, deferred-maintenance
    // backlog, land-value trend, soil health). Energy's NERC/FERC compliance →
    // USDA program participation & regulatory compliance. Energy's capital
    // funding → farm capital & debt position. Each reads OPTIONAL company-JSON
    // fields and degrades gracefully (cp-empty) when not yet populated.
    if (co.domainId === 'agriculture' || co.domainId === 'p2_agri') {
      // Crop / Livestock Portfolio — production breakdown by commodity (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Crop / Livestock Portfolio</div>';
      var _agp = co.cropPortfolio || co.livestockPortfolio || co.productionPortfolio;
      if (_agp && (Array.isArray(_agp) ? _agp.length : Object.keys(_agp).length)) {
        var _agpEntries = Array.isArray(_agp)
          ? _agp.map(function (e) { return [e.commodity || e.crop || e.livestock || e.type || e.label || '', e.share != null ? e.share : (e.acres != null ? e.acres : (e.volume != null ? e.volume : (e.value != null ? e.value : e.detail)))]; })
          : Object.keys(_agp).map(function (kk) { return [kk, _agp[kk]]; });
        for (var agp = 0; agp < _agpEntries.length; agp++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_agpEntries[agp][0]) + '</span><span class="cp-value">' + esc(String(_agpEntries[agp][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No production distribution recorded (corn / soybeans / wheat / specialty-crop acreage & yield, beef / dairy / poultry / pork herd & output, CBOT commodity mix, production share %)</div>';
      }
      rightHtml += '</div>';

      // Farm & Land Status — acreage, deferred-maintenance, land value, soil health (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Farm &amp; Land Status</div>';
      var _fls = co.farmStatus || co.landStatus;
      if (_fls && Object.keys(_fls).length > 0) {
        var _flsKeys = Object.keys(_fls);
        for (var flsk = 0; flsk < _flsKeys.length; flsk++) {
          var _flsv = _fls[_flsKeys[flsk]];
          var _flsStr = (_flsv && typeof _flsv === 'object' && !Array.isArray(_flsv))
            ? Object.keys(_flsv).map(function (sk) { return sk + ': ' + _flsv[sk]; }).join('  ·  ')
            : String(_flsv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_flsKeys[flsk]) + '</span><span class="cp-value">' + esc(_flsStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No farm / land data (total acreage owned vs leased, deferred-maintenance backlog $ on equipment & facilities, USDA cropland-value trend, soil-health / organic-matter & erosion metrics)</div>';
      }
      rightHtml += '</div>';

      // Regulatory Compliance — USDA programs, subsidies, conservation, food safety (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Regulatory Compliance</div>';
      var _arc = co.regulatoryCompliance || co.usdaCompliance;
      if (_arc && (Array.isArray(_arc) ? _arc.length : Object.keys(_arc).length)) {
        var _arcEntries = Array.isArray(_arc)
          ? _arc.map(function (e) { return [e.program || e.agency || e.certification || e.label || '', (e.status != null ? e.status : (e.value != null ? e.value : e.detail)) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_arc).map(function (kk) { return [kk, _arc[kk]]; });
        for (var arc = 0; arc < _arcEntries.length; arc++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_arcEntries[arc][0]) + '</span><span class="cp-value">' + esc(String(_arcEntries[arc][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No compliance record (USDA program participation & WASDE-aligned reporting, commodity-subsidy / ARC-PLC eligibility, conservation-program & water-quality standing, food-safety certifications — FSMA / USDA-organic / GAP)</div>';
      }
      rightHtml += '</div>';

      // Capital & Debt Position — farm debt, credit, equipment finance, hedging, insurance (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Capital &amp; Debt Position</div>';
      var _adp = co.capitalDebt || co.farmCapital;
      if (_adp && Object.keys(_adp).length > 0) {
        var _adpKeys = Object.keys(_adp);
        for (var adpk = 0; adpk < _adpKeys.length; adpk++) {
          var _adpv = _adp[_adpKeys[adpk]];
          var _adpStr = (_adpv && typeof _adpv === 'object' && !Array.isArray(_adpv))
            ? Object.keys(_adpv).map(function (sk) { return sk + ': ' + _adpv[sk]; }).join('  ·  ')
            : String(_adpv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_adpKeys[adpk]) + '</span><span class="cp-value">' + esc(_adpStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No capital / debt profile (total farm debt & debt-to-asset ratio, credit-facility types & amounts — operating lines / Farm Credit System, equipment financing, land-value equity cushion, commodity-price hedging exposure — CBOT futures / options, crop & revenue insurance coverage)</div>';
      }
      rightHtml += '</div>';
    }

    // ── MEDICINE / HEALTH-SPECIFIC PORTAL SECTIONS ───────────────────────
    // Healthcare & medicine parity with the energy domain's company-metadata
    // sections, mirroring the infrastructure, finance, economy, technology,
    // intelligence, industry, environment, and agriculture blocks above.
    // STRICTLY ADDITIVE render-layer content keyed on the medicine domain id
    // (co.domainId === 'medicine' || 'health', the dual URL/runtime key per
    // domain-identity.js — medicine is the portalKey, health is the
    // snapshotKey); it never touches the validated P3 distress kernel scoring
    // path consumed by /api/limen/score or /api/helix/helix-report/score —
    // those run server-side off the kernel, not off these optional company-
    // JSON display fields.
    //
    // Medicine is HEALTHCARE & CARE DELIVERY, PHARMACEUTICALS & BIOTECH, DRUG
    // DEVELOPMENT & CLINICAL TRIALS, HOSPITALS & CARE PROVIDERS, MEDICAL
    // DEVICES & DIAGNOSTICS, HEALTH SYSTEMS & INSURANCE, and PUBLIC HEALTH &
    // DISEASE CONTROL. It stays DISTINCT from science (basic / bench research
    // is a coupling, not the identity), from population (demographics &
    // disease burden is a coupling), and from economy (health-spend macro is a
    // coupling). Energy is NEVER the domain's OWN content. Real healthcare-
    // sector tickers: UNH, JNJ, PFE, MRK, ABBV, LLY, TMO, ABT, MDT, ISRG, HCA,
    // CVS, AMGN, GILD.
    //
    // Energy's generation mix → healthcare-portfolio (facility / segment type).
    // Energy's maintenance/asset-age → clinical & operational status (bed
    // utilization, surgical throughput, diagnostic turnaround, staffing,
    // deferred-maintenance). Energy's NERC/FERC compliance → regulatory
    // compliance (FDA / CMS / state licensure / accreditation / HIPAA).
    // Energy's capital funding → reimbursement & financial position (payer mix,
    // denials, margin, drug-pricing exposure). Each reads OPTIONAL company-JSON
    // fields and degrades gracefully (cp-empty) when not yet populated.
    if (co.domainId === 'medicine' || co.domainId === 'health') {
      // Healthcare Portfolio — breakdown by facility / segment type (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Healthcare Portfolio</div>';
      var _hcp = co.healthcarePortfolio || co.facilityPortfolio || co.segmentPortfolio;
      if (_hcp && (Array.isArray(_hcp) ? _hcp.length : Object.keys(_hcp).length)) {
        var _hcpEntries = Array.isArray(_hcp)
          ? _hcp.map(function (e) { return [e.facility || e.segment || e.type || e.label || '', e.share != null ? e.share : (e.beds != null ? e.beds : (e.value != null ? e.value : e.detail))]; })
          : Object.keys(_hcp).map(function (kk) { return [kk, _hcp[kk]]; });
        for (var hcp = 0; hcp < _hcpEntries.length; hcp++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_hcpEntries[hcp][0]) + '</span><span class="cp-value">' + esc(String(_hcpEntries[hcp][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No facility / segment distribution recorded (hospitals / clinics, pharmaceutical manufacturing, diagnostic labs, biotech R&amp;D, medical-device lines, insurance / managed-care — revenue or capacity share %)</div>';
      }
      rightHtml += '</div>';

      // Clinical / Operational Status — utilization, throughput, staffing, deferred-maintenance (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Clinical / Operational Status</div>';
      var _cos = co.clinicalStatus || co.operationalStatus;
      if (_cos && Object.keys(_cos).length > 0) {
        var _cosKeys = Object.keys(_cos);
        for (var cosk = 0; cosk < _cosKeys.length; cosk++) {
          var _cosv = _cos[_cosKeys[cosk]];
          var _cosStr = (_cosv && typeof _cosv === 'object' && !Array.isArray(_cosv))
            ? Object.keys(_cosv).map(function (sk) { return sk + ': ' + _cosv[sk]; }).join('  ·  ')
            : String(_cosv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_cosKeys[cosk]) + '</span><span class="cp-value">' + esc(_cosStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No clinical / operational data (bed-occupancy & utilization %, surgical-suite throughput, diagnostic turnaround time, physician / nurse staffing & vacancy rate, deferred-maintenance backlog $)</div>';
      }
      rightHtml += '</div>';

      // Regulatory Compliance — FDA / CMS / licensure / accreditation / HIPAA (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Regulatory Compliance</div>';
      var _mrc = co.regulatoryCompliance || co.healthCompliance;
      if (_mrc && (Array.isArray(_mrc) ? _mrc.length : Object.keys(_mrc).length)) {
        var _mrcEntries = Array.isArray(_mrc)
          ? _mrc.map(function (e) { return [e.agency || e.program || e.accreditation || e.label || '', (e.status != null ? e.status : (e.violations != null ? e.violations : (e.value != null ? e.value : e.detail))) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_mrc).map(function (kk) { return [kk, _mrc[kk]]; });
        for (var mrc = 0; mrc < _mrcEntries.length; mrc++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_mrcEntries[mrc][0]) + '</span><span class="cp-value">' + esc(String(_mrcEntries[mrc][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No compliance record (FDA clearances / warning letters / recalls, CMS quality / Star ratings & penalties, state licensure standing, Joint Commission accreditation, HIPAA security posture & breach trend)</div>';
      }
      rightHtml += '</div>';

      // Reimbursement & Financial Position — payer mix, denials, margin, drug-pricing exposure (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Reimbursement &amp; Financial Position</div>';
      var _rfp = co.reimbursementProfile || co.payerProfile || co.financialPosition;
      if (_rfp && Object.keys(_rfp).length > 0) {
        var _rfpKeys = Object.keys(_rfp);
        for (var rfpk = 0; rfpk < _rfpKeys.length; rfpk++) {
          var _rfpv = _rfp[_rfpKeys[rfpk]];
          var _rfpStr = (_rfpv && typeof _rfpv === 'object' && !Array.isArray(_rfpv))
            ? Object.keys(_rfpv).map(function (sk) { return sk + ': ' + _rfpv[sk]; }).join('  ·  ')
            : String(_rfpv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_rfpKeys[rfpk]) + '</span><span class="cp-value">' + esc(_rfpStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No reimbursement / financial profile (Medicare / Medicaid mix %, commercial-payer contract coverage, claims-denial rate, operating margin, drug-pricing & IRA-negotiation exposure, patent-cliff / LOE revenue at risk)</div>';
      }
      rightHtml += '</div>';
    }

    // ── EDUCATION-SPECIFIC PORTAL SECTIONS ───────────────────────────────
    // Schools & universities (K-12 + higher ed), edtech / online learning,
    // student outcomes & teaching parity with the energy domain's
    // company-metadata sections, mirroring the infrastructure block above.
    // This is STRICTLY ADDITIVE render-layer content keyed on
    // co.domainId === 'education'; it never touches the validated P3 distress
    // kernel (Thing1) scoring path consumed by /api/limen/score or
    // /api/helix/helix-report/score — those run server-side off the kernel,
    // not off these optional company-JSON display fields.
    //
    // Education COUPLES to economy (workforce pipeline), technology (edtech
    // tooling), and population (demographic / enrollment trends) — couplings,
    // not identity. IDENTITY stays teaching / learning / credentials / schools;
    // distinct from research (basic science = the science domain). Energy's
    // oil/gas/grid mix is translated to the education equivalents:
    // student / enrollment portfolio (energy: generation mix), curriculum &
    // instruction status (energy: maintenance / asset-age), accreditation &
    // compliance (energy: NERC/FERC compliance), and funding & financial aid
    // (energy: capital funding). Real sector tickers: CHGG, COUR, DUOL, LRN,
    // ATGE, LOPE, STRA, LAUR, TWOU, UTI.
    if (co.domainId === 'education') {
      // Student / Enrollment Portfolio — K-12 / higher-ed / online mix + enrollment trend (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Student / Enrollment Portfolio</div>';
      var _ep = co.enrollmentPortfolio || co.studentPortfolio;
      if (_ep && (Array.isArray(_ep) ? _ep.length : Object.keys(_ep).length)) {
        var _epEntries = Array.isArray(_ep)
          ? _ep.map(function (e) { return [e.segment || e.type || e.label || '', e.share != null ? e.share : (e.enrollment != null ? e.enrollment : (e.value != null ? e.value : e.detail))]; })
          : Object.keys(_ep).map(function (kk) { return [kk, _ep[kk]]; });
        for (var ep = 0; ep < _epEntries.length; ep++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_epEntries[ep][0]) + '</span><span class="cp-value">' + esc(String(_epEntries[ep][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No enrollment distribution recorded (K-12 / higher-ed / online-learning mix, total enrollment & YoY trend, completion / retention rate, online vs in-person split)</div>';
      }
      rightHtml += '</div>';

      // Curriculum & Instruction Status — teaching quality, instructor retention, modernization backlog (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Curriculum &amp; Instruction Status</div>';
      var _ci = co.curriculumStatus || co.instructionStatus;
      if (_ci && Object.keys(_ci).length > 0) {
        var _ciKeys = Object.keys(_ci);
        for (var cik = 0; cik < _ciKeys.length; cik++) {
          var _civ = _ci[_ciKeys[cik]];
          var _ciStr = (_civ && typeof _civ === 'object' && !Array.isArray(_civ))
            ? Object.keys(_civ).map(function (sk) { return sk + ': ' + _civ[sk]; }).join('  ·  ')
            : String(_civ);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_ciKeys[cik]) + '</span><span class="cp-value">' + esc(_ciStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No curriculum / instruction data (teaching quality & student-outcome scores, instructor / faculty retention & vacancy rate, curriculum-modernization backlog, course-content refresh cadence)</div>';
      }
      rightHtml += '</div>';

      // Accreditation & Compliance — regional/national accreditation, Title IV, federal-aid eligibility (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Accreditation &amp; Compliance</div>';
      var _ac = co.accreditationCompliance || co.regulatoryCompliance;
      if (_ac && (Array.isArray(_ac) ? _ac.length : Object.keys(_ac).length)) {
        var _acEntries = Array.isArray(_ac)
          ? _ac.map(function (e) { return [e.body || e.agency || e.accreditation || e.label || '', (e.status != null ? e.status : (e.violations != null ? e.violations : (e.value != null ? e.value : e.detail))) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_ac).map(function (kk) { return [kk, _ac[kk]]; });
        for (var ac = 0; ac < _acEntries.length; ac++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_acEntries[ac][0]) + '</span><span class="cp-value">' + esc(String(_acEntries[ac][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No accreditation record (regional / national accreditation standing, Title IV federal-aid eligibility, student-outcome / cohort-default-rate reporting, gainful-employment compliance, state authorization)</div>';
      }
      rightHtml += '</div>';

      // Funding & Financial Aid — endowment, tuition dependency, grant revenue, student-debt coverage (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Funding &amp; Financial Aid</div>';
      var _ffa = co.fundingProfile || co.financialAidProfile;
      if (_ffa && Object.keys(_ffa).length > 0) {
        var _ffaKeys = Object.keys(_ffa);
        for (var ffak = 0; ffak < _ffaKeys.length; ffak++) {
          var _ffav = _ffa[_ffaKeys[ffak]];
          var _ffaStr = (_ffav && typeof _ffav === 'object' && !Array.isArray(_ffav))
            ? Object.keys(_ffav).map(function (sk) { return sk + ': ' + _ffav[sk]; }).join('  ·  ')
            : String(_ffav);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_ffaKeys[ffak]) + '</span><span class="cp-value">' + esc(_ffaStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No funding / aid profile (endowment $ & draw rate, tuition-revenue dependency %, federal / state grant revenue, financial-aid discount rate, student-debt obligation coverage & loan-default exposure)</div>';
      }
      rightHtml += '</div>';
    }

    // POPULATION domain — demographics & population-dynamics parity with the
    // energy domain's company-metadata sections, mirroring the education,
    // economy, technology, intelligence, industry, environment, agriculture,
    // and health blocks above. STRICTLY ADDITIVE render-layer content keyed on
    // co.domainId === 'population'; it never touches the validated P3 distress
    // kernel (Thing1) scoring path consumed by /api/limen/score or
    // /api/helix/helix-report/score — those run server-side off the kernel,
    // not off these optional company-JSON display fields.
    //
    // IDENTITY = demographics & population dynamics, migration & immigration,
    // urbanization & settlement, fertility & mortality, aging & generational
    // shifts, labor-force & human-capital SUPPLY, household formation & housing
    // demand, social structure & inequality. Population BINDS mostly to
    // INDICATORS (US Census / ACS, UN World Population Prospects, Pew Research,
    // BLS) not single companies; where a demographic-exposed entity is needed
    // it uses REAL proxies (WELL, VTR senior-living REITs; housing / migration-
    // exposed names). Kept DISTINCT from economy (labor MARKET is a coupling),
    // medicine (mortality / health is a coupling), education (enrollment is a
    // coupling), and governance. Energy's oil/gas/grid mix is translated to the
    // population equivalents: demographic-structure portfolio (energy:
    // generation mix), aging & vital-rate status (energy: maintenance/asset-age),
    // migration & policy compliance (energy: NERC/FERC compliance), and
    // human-capital & housing-demand position (energy: capital funding).
    if (co.domainId === 'population') {
      // Demographic Structure Portfolio — age/cohort/urban-rural mix + growth trend (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Demographic Structure Portfolio</div>';
      var _dp = co.demographicPortfolio || co.populationPortfolio;
      if (_dp && (Array.isArray(_dp) ? _dp.length : Object.keys(_dp).length)) {
        var _dpEntries = Array.isArray(_dp)
          ? _dp.map(function (e) { return [e.cohort || e.segment || e.type || e.label || '', e.share != null ? e.share : (e.population != null ? e.population : (e.value != null ? e.value : e.detail))]; })
          : Object.keys(_dp).map(function (kk) { return [kk, _dp[kk]]; });
        for (var dp = 0; dp < _dpEntries.length; dp++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_dpEntries[dp][0]) + '</span><span class="cp-value">' + esc(String(_dpEntries[dp][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No demographic distribution recorded (age-cohort / generational mix, urban vs rural settlement split, total population & YoY growth trend, dependency ratio — sources: US Census / ACS, UN World Population Prospects)</div>';
      }
      rightHtml += '</div>';

      // Aging & Vital-Rate Status — fertility, mortality, median age, aging pressure (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Aging &amp; Vital-Rate Status</div>';
      var _vr = co.vitalRateStatus || co.agingStatus;
      if (_vr && Object.keys(_vr).length > 0) {
        var _vrKeys = Object.keys(_vr);
        for (var vrk = 0; vrk < _vrKeys.length; vrk++) {
          var _vrv = _vr[_vrKeys[vrk]];
          var _vrStr = (_vrv && typeof _vrv === 'object' && !Array.isArray(_vrv))
            ? Object.keys(_vrv).map(function (sk) { return sk + ': ' + _vrv[sk]; }).join('  ·  ')
            : String(_vrv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_vrKeys[vrk]) + '</span><span class="cp-value">' + esc(_vrStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No vital-rate data (total fertility rate vs replacement, crude / age-adjusted mortality, median age & aging-pressure trend, old-age dependency ratio — sources: US Census / NCHS vital statistics, UN World Population Prospects)</div>';
      }
      rightHtml += '</div>';

      // Migration & Policy Compliance — immigration flows, settlement policy, mobility regs (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Migration &amp; Policy Compliance</div>';
      var _mp = co.migrationCompliance || co.migrationProfile;
      if (_mp && (Array.isArray(_mp) ? _mp.length : Object.keys(_mp).length)) {
        var _mpEntries = Array.isArray(_mp)
          ? _mp.map(function (e) { return [e.flow || e.body || e.policy || e.label || '', (e.status != null ? e.status : (e.value != null ? e.value : e.detail)) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_mp).map(function (kk) { return [kk, _mp[kk]]; });
        for (var mp = 0; mp < _mpEntries.length; mp++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_mpEntries[mp][0]) + '</span><span class="cp-value">' + esc(String(_mpEntries[mp][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No migration / policy record (net international & domestic migration flows, immigration / settlement policy exposure, naturalization & mobility compliance, region-to-region net-flow trend — sources: US Census ACS migration flows, Pew Research, UN migration estimates)</div>';
      }
      rightHtml += '</div>';

      // Human-Capital & Housing-Demand Position — labor supply, household formation, inequality (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Human-Capital &amp; Housing-Demand Position</div>';
      var _hc = co.humanCapitalPosition || co.housingDemandProfile;
      if (_hc && Object.keys(_hc).length > 0) {
        var _hcKeys = Object.keys(_hc);
        for (var hck = 0; hck < _hcKeys.length; hck++) {
          var _hcv = _hc[_hcKeys[hck]];
          var _hcStr = (_hcv && typeof _hcv === 'object' && !Array.isArray(_hcv))
            ? Object.keys(_hcv).map(function (sk) { return sk + ': ' + _hcv[sk]; }).join('  ·  ')
            : String(_hcv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_hcKeys[hck]) + '</span><span class="cp-value">' + esc(_hcStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No human-capital / housing position (labor-force participation & working-age supply, household-formation rate & housing-demand pressure, educational-attainment / skill distribution, income & wealth inequality (Gini) — sources: BLS labor-force statistics, US Census household & income tables; demographic-exposed proxies: WELL, VTR senior-living REITs, housing / migration-exposed names)</div>';
      }
      rightHtml += '</div>';
    }

    // ── LAW-SPECIFIC PORTAL SECTIONS ─────────────────────────────────────
    // Legal-system / judiciary / litigation parity with the energy domain's
    // company-metadata sections, mirroring the infrastructure, finance, and
    // population blocks above. STRICTLY ADDITIVE render-layer content keyed on
    // co.domainId === 'law'; it never touches the validated P3 distress kernel
    // (Thing1) scoring path consumed by /api/limen/score or
    // /api/helix/helix-report/score — those run server-side off the kernel,
    // not off these optional company-JSON display fields.
    //
    // IDENTITY = the legal system & courts, judiciary & rule of law, litigation
    // & dispute resolution, regulation & compliance, contracts & enforcement,
    // intellectual-property law, criminal justice, and legal services & access
    // to justice. Law BINDS mostly to INDICATORS (US Courts caseload statistics,
    // ABA, DOJ, SCOTUS, World Justice Project Rule-of-Law Index, V-Dem) not
    // single companies; where a legal-sector entity is needed it uses REAL
    // proxies (RELX / LexisNexis, TRI Thomson Reuters / Westlaw, VERX Vertex
    // compliance, CSGP CoStar). Kept DISTINCT from governance (policy /
    // administration / elections), intelligence, and finance — law is the
    // JUDICIAL / legal-system / courts / enforcement surface.
    //
    // The law sections map to legal-system failure modes (the law-brain
    // diagnosis families): Litigation Portfolio mirrors court-docket backlog
    // signals, Compliance Status mirrors regulatory-enforcement / enforcement-
    // gap signals, Judicial Independence mirrors rule-of-law-erosion /
    // constitutional-challenge signals, and Access-to-Justice Capacity mirrors
    // court-backlog / enforcement-capacity constraints. Energy's oil/gas/grid
    // mix is translated to the legal equivalents: case-type / venue / stage
    // portfolio (energy: generation mix), compliance & penalty status (energy:
    // maintenance/asset-age), rule-of-law independence (energy: NERC/FERC
    // compliance), and access-to-justice capacity (energy: capital funding).
    // Each reads OPTIONAL company-JSON fields and degrades gracefully
    // (cp-empty) when not yet populated — identical structure to the generic
    // sections below, only the CONTENT is legal.
    if (co.domainId === 'law') {
      // Litigation Portfolio — case type / venue / stage / exposure (energy: generation mix)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Litigation Portfolio</div>';
      var _lit = co.litigationPortfolio;
      if (_lit && (Array.isArray(_lit) ? _lit.length : Object.keys(_lit).length)) {
        var _litEntries = Array.isArray(_lit)
          ? _lit.map(function (e) { return [e.caseType || e.venue || e.stage || e.type || e.label || '', (e.cases != null ? e.cases : (e.exposure != null ? e.exposure : (e.share != null ? e.share : (e.value != null ? e.value : e.detail)))) + (e.stage && (e.caseType || e.venue) ? ' [' + e.stage + ']' : '')]; })
          : Object.keys(_lit).map(function (kk) { return [kk, _lit[kk]]; });
        for (var lit = 0; lit < _litEntries.length; lit++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_litEntries[lit][0]) + '</span><span class="cp-value">' + esc(String(_litEntries[lit][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No litigation distribution recorded (case type — civil / criminal / IP / contract; venue — federal / state / appellate; procedural stage — pleading / discovery / trial / appeal; dollar exposure — sources: US Courts caseload statistics, PACER, court dockets)</div>';
      }
      rightHtml += '</div>';

      // Compliance Status — regulatory framework coverage, violation trend, penalty exposure (energy: maintenance/asset-age)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Compliance Status</div>';
      var _cmp = co.complianceStatus;
      if (_cmp && Object.keys(_cmp).length > 0) {
        var _cmpKeys = Object.keys(_cmp);
        for (var cmk = 0; cmk < _cmpKeys.length; cmk++) {
          var _cmpv = _cmp[_cmpKeys[cmk]];
          var _cmpStr = (_cmpv && typeof _cmpv === 'object' && !Array.isArray(_cmpv))
            ? Object.keys(_cmpv).map(function (sk) { return sk + ': ' + _cmpv[sk]; }).join('  ·  ')
            : String(_cmpv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_cmpKeys[cmk]) + '</span><span class="cp-value">' + esc(_cmpStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No compliance data (regulatory-framework coverage, violation / enforcement-action trend, penalty & settlement exposure — sources: DOJ enforcement actions, SEC / agency dockets, ABA model rules; compliance proxies: VERX Vertex, RELX, TRI Thomson Reuters)</div>';
      }
      rightHtml += '</div>';

      // Judicial Independence & Rule-of-Law — WJP / V-Dem indices, constitutional challenges (energy: NERC/FERC compliance)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Judicial Independence &amp; Rule-of-Law</div>';
      var _rol = co.ruleOfLaw || co.judicialIndependence;
      if (_rol && (Array.isArray(_rol) ? _rol.length : Object.keys(_rol).length)) {
        var _rolEntries = Array.isArray(_rol)
          ? _rol.map(function (e) { return [e.index || e.metric || e.label || '', (e.score != null ? e.score : (e.count != null ? e.count : (e.value != null ? e.value : e.detail))) + (e.trend ? ' (' + e.trend + ')' : '')]; })
          : Object.keys(_rol).map(function (kk) { return [kk, _rol[kk]]; });
        for (var rol = 0; rol < _rolEntries.length; rol++) {
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_rolEntries[rol][0]) + '</span><span class="cp-value">' + esc(String(_rolEntries[rol][1])) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No rule-of-law record (World Justice Project Rule-of-Law Index score, V-Dem judicial-constraints-on-executive score, constitutional-challenge count, separation-of-powers tension — sources: World Justice Project, V-Dem, SCOTUS docket)</div>';
      }
      rightHtml += '</div>';

      // Access-to-Justice Capacity — court backlog, legal-aid funding, pro-bono / ADR adoption (energy: capital funding)
      rightHtml += '<div class="cp-section">';
      rightHtml += '<div class="cp-section-title">Access-to-Justice Capacity</div>';
      var _atj = co.accessToJustice || co.accessToJusticeCapacity;
      if (_atj && Object.keys(_atj).length > 0) {
        var _atjKeys = Object.keys(_atj);
        for (var atk = 0; atk < _atjKeys.length; atk++) {
          var _atjv = _atj[_atjKeys[atk]];
          var _atjStr = (_atjv && typeof _atjv === 'object' && !Array.isArray(_atjv))
            ? Object.keys(_atjv).map(function (sk) { return sk + ': ' + _atjv[sk]; }).join('  ·  ')
            : String(_atjv);
          rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(_atjKeys[atk]) + '</span><span class="cp-value">' + esc(_atjStr) + '</span></div>';
        }
      } else {
        rightHtml += '<div class="cp-empty">No access-to-justice profile (court-backlog months / pending caseload, legal-aid funding coverage, pro-bono capacity, alternative-dispute-resolution (ADR / mediation / arbitration) adoption — sources: US Courts caseload statistics, Legal Services Corporation, ABA pro-bono surveys)</div>';
      }
      rightHtml += '</div>';
    }

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
      // Gate B render-authority contract. Section-title and banner are
      // both decided by classifyAuthorityV01 against the shared module.
      // Same behavior as the prior inline v0.1; the difference is that
      // the predicate now lives in one place and any other renderer
      // (engine outputs, kernel verdicts, domain panels) gets the same
      // semantics by calling the same contract.
      var RA = window.LIMENRenderAuthority;
      var _state = RA ? RA.classifyAuthorityV01(co) : null;
      var _noEvidence = RA && _state === RA.STATES.NO_EXECUTION_EVIDENCE;

      rightHtml += '<div class="cp-section">';
      if (_noEvidence) {
        rightHtml += '<div class="cp-section-title" style="color:#e85454">Intelligence Cycle \u2014 Procedure Template, Not Executed</div>';
        rightHtml += RA.renderAuthorityBanner(co, { sectionLabel: 'diagnosis' });
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
        var _fv = co.financialHealth[keys[k]];
        // Nested objects (e.g. financialState = {cashLatest, debtLatest,
        // cashRunwayQ}) were String()-coerced to "[object Object]". Expand them
        // into readable "subkey: value" instead.
        var _fvStr = (_fv && typeof _fv === 'object' && !Array.isArray(_fv))
          ? Object.keys(_fv).map(function(sk){ return sk + ': ' + _fv[sk]; }).join('  ·  ')
          : String(_fv);
        rightHtml += '<div class="cp-field"><span class="cp-label">' + esc(keys[k]) + '</span><span class="cp-value">' + esc(_fvStr) + '</span></div>';
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
