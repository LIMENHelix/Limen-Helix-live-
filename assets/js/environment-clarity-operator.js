/**
 * environment-clarity-operator.js — Money-Driven Action Surface for Environment Domain
 *
 * ENVIRONMENTAL IDENTITY: climate & emissions, air/water/soil pollution & quality,
 * ecosystems & biodiversity, natural resources & conservation, environmental
 * regulation & compliance, climate risk & adaptation, waste management & remediation,
 * carbon markets. Couples to energy via emissions/carbon and to agriculture via
 * land/water use, but keeps a distinct environmental identity.
 *
 * Self-gates: only runs when ?domain=environment or ?domain=research
 *
 * Sections:
 *   1. TOP DIRECTIVE
 *   2. SOURCE INTELLIGENCE block (inside anchor)
 *   3. DEEP INTELLIGENCE expandable
 *   4. DEEP PROOF — FRACTAL INTELLIGENCE block
 *   5. DRILL DEEPER / LOAD BRANCH
 *   6. TOP MONEY PLAYS
 *   7. ACTION QUEUE
 *   8. BUSINESS REVIEW (mounts science-business-review.js)
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'environment' && _dom !== 'research') return;

  var VIEW_ID = 'sos-operator-view';
  var STATUS_KEY = 'limen_environment_operator_status';
  var COLLAPSE_KEY = 'limen_environment_collapse_state';
  var _operatorView = null;
  var _isOperatorMode = false;
  var _booted = false;

  function getCollapseState() { try { return JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}'); } catch (e) { return {}; } }
  function setCollapsed(sectionId, collapsed) { var st = getCollapseState(); st[sectionId] = collapsed; try { sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify(st)); } catch (e) {} }
  function isCollapsed(sectionId) { return getCollapseState()[sectionId] === true; }
  function wrapCollapsible(sectionId, titleText, contentHtml, defaultOpen) {
    var collapsed = isCollapsed(sectionId);
    if (defaultOpen === undefined) defaultOpen = true;
    var cs = getCollapseState();
    if (cs[sectionId] === undefined) collapsed = !defaultOpen;
    var h = '<div class="eos-section-header" data-section="' + sectionId + '">';
    h += '<div class="eos-title" style="margin-bottom:0">' + titleText + '</div>';
    h += '<span class="eos-section-toggle">' + (collapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div class="eos-section-body' + (collapsed ? ' collapsed' : '') + '" data-section-body="' + sectionId + '">';
    h += contentHtml;
    h += '</div>';
    return h;
  }

  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '#' + VIEW_ID + '{padding:20px 24px 60px;font-family:"IBM Plex Mono",monospace;overflow-y:auto;grid-column:1/-1;grid-row:2;display:none}',
      '.eos-title{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;margin-bottom:6px;font-weight:600;text-shadow:0 0 6px rgba(201,169,78,0.2)}',
      '.eos-summary{font-size:0.54rem;color:#f0ece2;line-height:1.65;margin-bottom:18px;max-width:900px}',
      '.eos-summary b{color:#C9A94E}',
      '.eos-plays{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-bottom:18px}',
      '.eos-play{padding:12px 14px;border:1px solid rgba(201,169,78,0.1);border-radius:3px;background:rgba(10,12,20,0.6);transition:border-color 0.2s}',
      '.eos-play:hover{border-color:rgba(201,169,78,0.25)}',
      '.eos-play-rank{font-size:0.6rem;color:rgba(201,169,78,0.25);font-weight:bold;float:right;margin-left:8px}',
      '.eos-play-name{font-size:0.46rem;color:#f0ece2;margin-bottom:4px;line-height:1.4}',
      '.eos-play-path{display:inline-block;font-size:0.28rem;letter-spacing:1.5px;padding:1px 6px;border-radius:2px;margin-bottom:6px}',
      '.eos-path-grant{color:#5ab5a0;border:1px solid rgba(90,181,160,0.25);background:rgba(90,181,160,0.06)}',
      '.eos-path-invest{color:#C9A94E;border:1px solid rgba(201,169,78,0.25);background:rgba(201,169,78,0.06)}',
      '.eos-path-patent{color:#a87adb;border:1px solid rgba(168,122,219,0.25);background:rgba(168,122,219,0.06)}',
      '.eos-play-why{font-size:0.38rem;color:#c9c1b0;line-height:1.5;margin-bottom:4px}',
      '.eos-play-outcome{font-size:0.34rem;color:rgba(201,169,78,0.75);margin-top:4px}',
      '.eos-queue{width:100%;border-collapse:collapse;margin-bottom:8px}',
      '.eos-queue th{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.75);text-transform:uppercase;text-align:left;padding:5px 8px;border-bottom:1px solid rgba(201,169,78,0.12);font-weight:600}',
      '.eos-queue td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.38rem;color:#d0c8b8;vertical-align:top}',
      '.eos-queue tr:hover{background:rgba(201,169,78,0.02)}',
      '.eos-queue-pri{color:#C9A94E;font-weight:bold;font-size:0.42rem;width:30px}',
      '.eos-queue-name{max-width:220px}',
      '.eos-queue-why{color:#c0b8a5;max-width:340px;line-height:1.4}',
      '.eos-quiet{font-size:0.42rem;color:#b0a898;line-height:1.6;padding:8px 0}',
      '.eos-section-header{display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:4px 0;margin-bottom:6px;user-select:none}',
      '.eos-section-header:hover .eos-title{color:rgba(201,169,78,1);text-shadow:0 0 8px rgba(201,169,78,0.4)}',
      '.eos-section-toggle{font-size:0.24rem;color:rgba(201,169,78,0.35);transition:transform 0.2s}',
      '.eos-section-body{overflow:hidden;transition:max-height 0.25s ease,opacity 0.2s ease}',
      '.eos-section-body.collapsed{max-height:0;opacity:0;margin:0;padding:0}',
      '.eos-anchor{margin-bottom:14px;padding:14px 16px;border:1px solid rgba(201,169,78,0.25);border-left:3px solid #C9A94E;border-radius:3px;background:rgba(201,169,78,0.03)}',
      '.eos-anchor-label{font-size:0.24rem;letter-spacing:2.5px;color:#C9A94E;margin-bottom:8px;font-weight:700}',
      '.eos-anchor-title{font-size:0.56rem;color:#f0ece2;line-height:1.4;margin-bottom:8px;font-weight:500}',
      '.eos-anchor-explain{font-size:0.40rem;color:#c0b8a5;line-height:1.6;margin-bottom:10px}',
      '.eos-anchor-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}',
      '@media(max-width:700px){.eos-anchor-grid{grid-template-columns:1fr}}',
      '.eos-anchor-block{padding:8px 10px;border-left:2px solid rgba(201,169,78,0.15);background:rgba(0,0,0,0.1);border-radius:2px}',
      '.eos-anchor-block-label{font-size:0.24rem;letter-spacing:1.5px;color:rgba(201,169,78,0.7);margin-bottom:4px;font-weight:600}',
      '.eos-anchor-block-text{font-size:0.34rem;color:#d0c8b8;line-height:1.6}',
      '.eos-anchor-step{font-size:0.34rem;color:#c0b8a5;padding:2px 0;line-height:1.5}',
      '.eos-anchor-step b{color:#d0c8b8}',
      '.eos-anchor-lineage{font-size:0.24rem;color:rgba(74,143,212,0.6);letter-spacing:0.5px;margin-top:8px;padding-top:6px;border-top:1px solid rgba(201,169,78,0.06)}',
      '.eos-deepproof{margin-bottom:14px;padding:12px 16px;border:1px solid rgba(74,143,212,0.2);border-left:3px solid rgba(74,143,212,0.6);border-radius:3px;background:rgba(74,143,212,0.03)}',
      '.eos-deepproof-label{font-size:0.24rem;letter-spacing:2.5px;color:rgba(74,143,212,0.8);margin-bottom:6px;font-weight:700}',
      '.eos-deepproof-title{font-size:0.48rem;color:#e0daca;line-height:1.4;margin-bottom:6px}',
      '.eos-deepproof-why{font-size:0.34rem;color:rgba(74,143,212,0.6);line-height:1.5;margin-bottom:8px;font-style:italic}',
      '.eos-deep-toggle{font-family:inherit;font-size:0.24rem;letter-spacing:1px;padding:2px 8px;border:1px solid rgba(74,143,212,0.2);border-radius:2px;background:rgba(74,143,212,0.03);color:rgba(74,143,212,0.7);cursor:pointer;transition:all 0.15s;margin-top:6px}',
      '.eos-deep-toggle:hover{background:rgba(74,143,212,0.08);color:rgba(74,143,212,0.95)}',
      '.eos-deep-body{overflow:hidden;max-height:0;opacity:0;transition:max-height 0.3s ease,opacity 0.25s ease;margin-top:0}',
      '.eos-deep-body.open{max-height:600px;opacity:1;margin-top:8px}',
      '.eos-deep-section{margin-bottom:8px;padding:6px 10px;border-left:2px solid rgba(74,143,212,0.12);background:rgba(74,143,212,0.02);border-radius:2px}',
      '.eos-deep-label{font-size:0.22rem;letter-spacing:1.5px;color:rgba(74,143,212,0.6);margin-bottom:3px;font-weight:600}',
      '.eos-deep-text{font-size:0.30rem;color:#b0a898;line-height:1.6}',
      '.eos-deep-cite{font-size:0.26rem;color:#908878;line-height:1.5;padding:2px 0}',

      /* Money thesis cell */
      '.money-thesis-cell{display:flex;flex-direction:column;gap:6px}',
      '.money-thesis-preview{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;line-height:1.5}',
      '.money-thesis-expanded{display:block;line-height:1.5;white-space:pre-line}',
      '.money-thesis-expanded.hidden{display:none}',
      '.money-thesis-detail{margin-top:6px;padding:6px 8px;border-left:2px solid rgba(201,169,78,0.25);font-size:0.34rem;color:#c0b8a5;line-height:1.5}',
      '.money-thesis-detail span.mtd-label{color:rgba(201,169,78,0.7);font-size:0.26rem;letter-spacing:1px;text-transform:uppercase;display:block;margin-top:6px}',
      '.money-thesis-detail span.mtd-label:first-child{margin-top:0}',
      '.money-thesis-toggle{align-self:flex-start;background:none;border:1px solid rgba(201,169,78,0.2);color:#C9A94E;font-size:0.26rem;letter-spacing:1px;padding:2px 8px;cursor:pointer;border-radius:3px}',
      '.money-thesis-toggle:hover{background:rgba(201,169,78,0.08)}',
      '.eos-queue-step{color:#d0cec8;max-width:220px;line-height:1.4}',
      '.eos-queue-status{width:auto}',
      '.eos-action-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:4px 8px 8px 38px}',
      '.eos-action-row td{border-bottom:1px solid rgba(255,255,255,0.025);padding:0}',

      /* Status buttons */
      '.eos-status-btn{font-family:inherit;font-size:0.26rem;letter-spacing:1px;padding:2px 6px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid rgba(255,255,255,0.1);background:none;color:#a09888;margin:1px;white-space:nowrap;display:inline-flex;align-items:center}',
      '.eos-status-btn:hover{border-color:rgba(201,169,78,0.3);color:#C9A94E}',
      '.eos-status-btn.active-new{color:#5ab5a0;border-color:rgba(90,181,160,0.3)}',
      '.eos-status-btn.active-wip{color:#C9A94E;border-color:rgba(201,169,78,0.3)}',
      '.eos-status-btn.active-done{color:#4a8fd4;border-color:rgba(74,143,212,0.3)}',
      '.eos-status-btn.active-watch{color:#807868;border-color:rgba(128,120,104,0.3)}',

      /* Invest button */
      '.eos-invest-btn{font-family:inherit;font-size:0.26rem;letter-spacing:1px;padding:2px 6px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid rgba(90,181,160,0.25);background:rgba(90,181,160,0.04);color:#5ab5a0;margin-left:0;white-space:nowrap;display:inline-flex;align-items:center}',
      '.eos-invest-btn:hover{background:rgba(90,181,160,0.12);border-color:rgba(90,181,160,0.4)}',

      /* Target section */
      '.eos-targets{margin-top:6px;padding-top:5px;border-top:1px solid rgba(201,169,78,0.06)}',
      '.eos-targets-header{display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px;user-select:none}',
      '.eos-targets-header:hover .eos-title{color:rgba(201,169,78,1);text-shadow:0 0 6px rgba(201,169,78,0.3)}',
      '.eos-invest-meaning{font-size:0.28rem;color:#a09888;font-style:italic;margin-bottom:6px}',
      '.eos-target-row{display:flex;align-items:center;gap:6px;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.02);cursor:pointer;transition:background 0.15s}',
      '.eos-target-row:hover{background:rgba(201,169,78,0.03)}',
      '.eos-target-ticker{color:#C9A94E;font-weight:bold;font-size:0.38rem;min-width:42px}',
      '.eos-target-name{color:#d0c8b8;font-size:0.34rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.eos-target-cik{font-size:0.24rem;color:#908878;min-width:70px}',
      '.eos-target-val{font-size:0.22rem;letter-spacing:1px;padding:1px 4px;border-radius:1px;white-space:nowrap}',
      '.eos-val-helix{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)}',
      '.eos-val-node{color:#4a8fd4;border:1px solid rgba(74,143,212,0.2)}',
      '.eos-val-domain{color:#C9A94E;border:1px solid rgba(201,169,78,0.2)}',
      '.eos-val-etf{color:#807868;border:1px solid rgba(128,120,104,0.2)}',
      '.eos-target-fit{font-size:0.30rem;color:#b0a898;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:250px}',
      '.eos-target-expand{font-size:0.22rem;color:rgba(201,169,78,0.3);margin-left:auto}',
      '.eos-target-detail{display:none;padding:6px 8px 8px 48px;font-size:0.32rem;color:#b0a898;line-height:1.5;border-bottom:1px solid rgba(201,169,78,0.04);background:rgba(0,0,0,0.1)}',
      '.eos-target-detail.open{display:block}',
      '.eos-target-link{font-family:inherit;font-size:0.24rem;letter-spacing:0.5px;padding:1px 5px;border:1px solid rgba(201,169,78,0.12);border-radius:1px;background:none;color:#a09888;cursor:pointer;text-decoration:none;transition:all 0.15s;margin-right:3px}',
      '.eos-target-link:hover{color:#C9A94E;border-color:rgba(201,169,78,0.3)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function getState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('environment');
    return brain ? brain.getState() : null;
  }

  function getStatusMap() { try { return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}'); } catch (e) { return {}; } }
  function setStatus(key, status) { var map = getStatusMap(); map[key] = status; try { localStorage.setItem(STATUS_KEY, JSON.stringify(map)); } catch (e) {} }

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function promotedBadge(o) {
    if (!o || o.source !== 'portal_directive' || !o._directive) return '';
    var d = o._directive;
    var depth = d.depth != null ? d.depth : 0;
    var node = d.nodeLabel || d.nodeId || '';
    var isDeep = depth >= 2;
    var borderColor = isDeep ? 'rgba(74,143,212,0.5)' : 'rgba(74,143,212,0.2)';
    var bgColor = isDeep ? 'rgba(74,143,212,0.08)' : 'rgba(74,143,212,0.04)';
    var prefix = isDeep ? 'DEEP L' + depth : 'L' + depth;
    var mechLabel = (o._mechanism && o._mechanism.primaryLabel) ? ' \u00b7 ' + o._mechanism.primaryLabel : '';
    return ' <span style="font-size:0.22rem;letter-spacing:0.5px;padding:1px 5px;border-radius:2px;color:rgba(74,143,212,0.9);border:1px solid ' + borderColor + ';background:' + bgColor + '">' +
      prefix + ' \u00b7 ' + esc(node) + mechLabel + '</span>';
  }

  // ── ENVIRONMENT-NATIVE LANGUAGE ──

  var DX_CONTEXT = {
    'CLIMATE_TIPPING_POINT': {
      what: 'Global temperature anomalies, extreme weather events, and climate volatility are crossing thresholds that cascade through ecosystems, infrastructure, and human systems',
      money: 'Climate adaptation infrastructure, resilience engineering, carbon removal technology, and climate insurance all see accelerated demand. Utilities, ports, rail, and water systems are forced into hardening spending; cat bonds reprice; carbon removal buyers sign multi-year offtakes.',
      step: 'Track NOAA GISTEMP, NASA land/ocean temperature, major weather alerts, and IPCC working group outputs. Position in adaptation infrastructure (utility hardening, stormwater, managed retreat engineering), carbon removal primes, and climate insurance vendors.',
      outcome: '$50M-$5B+ multi-year adaptation contracts or 15-40% carbon removal and climate resilience premium'
    },
    'MASS_EXTINCTION': {
      what: 'Biodiversity loss is accelerating across vertebrates, insects, amphibians, and plants, with habitat fragmentation and invasive species driving population collapses',
      money: 'Conservation tech, environmental DNA (eDNA) monitoring, biodiversity credit markets, and habitat restoration contractors see compounding demand from corporate nature-disclosure mandates (TNFD) and sovereign biodiversity commitments (GBF).',
      step: 'Track IUCN Red List updates, IPBES assessments, and Living Planet Index releases. Position in eDNA vendors, remote sensing biodiversity monitoring, conservation-grade restoration contractors, and biodiversity credit platforms.',
      outcome: '$10M-$500M biodiversity credit offtakes, restoration contracts, or nature-positive infrastructure mandates'
    },
    'OCEAN_ACIDIFICATION': {
      what: 'Marine pH decline, coral bleaching events, hypoxic dead zones, and fishery collapses are accelerating as the ocean absorbs CO2 and warms',
      money: 'Aquaculture resilience tech, coral restoration, marine protected area management, and alternative protein production see capital inflows. Ocean-based carbon removal (alkalinity, seaweed sinking) moves from research to early commercial.',
      step: 'Track NOAA Coral Reef Watch, NOAA Ocean Acidification Program, ICES, and FAO fisheries reports. Position in aquaculture platforms, marine monitoring sensor vendors, and ocean carbon removal companies.',
      outcome: '$5M-$250M ocean-based carbon removal offtakes, aquaculture infrastructure, or fishery rebuilding contracts'
    },
    'DEFORESTATION': {
      what: 'Primary forest loss is accelerating across the Amazon, Congo Basin, and Southeast Asia, driven by agricultural expansion, logging, and fire; carbon sinks are degrading',
      money: 'Satellite monitoring, supply chain traceability for deforestation-linked commodities (EUDR, SBTi FLAG), and reforestation carbon credit supply all see sustained demand. Commodity importers face compliance costs that flow to monitoring vendors.',
      step: 'Track Global Forest Watch weekly alerts, Mongabay coverage, and EUDR enforcement actions. Position in satellite deforestation monitoring, commodity traceability platforms, and nature-based carbon credit suppliers.',
      outcome: '$10M-$1B EUDR compliance contracts, reforestation credit offtakes, or traceability platform ARR'
    },
    'TOXIC_CONTAMINATION': {
      what: 'PFAS, heavy metals, and industrial chemical exposure events are surfacing in drinking water, soil, air, and consumer products at scale; regulatory pressure is tightening',
      money: 'Water treatment, environmental remediation (Superfund, brownfield), air quality monitoring, and PFAS destruction technology see acute demand. EPA enforcement and state-level action create direct contract flow.',
      step: 'Track EPA ECHO enforcement, EPA AirNow, EWG water quality database, and state water quality alerts. Position in water filtration, PFAS destruction vendors, environmental remediation primes, and air quality sensor networks.',
      outcome: '$25M-$5B+ Superfund / DoD / state remediation contracts and sustained water infrastructure capex'
    }
  };

  var PATH_LABELS = { 'PATENTABLE': 'PATENT', 'GRANT-ELIGIBLE': 'GRANT', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'PATENTABLE': 'eos-path-patent', 'GRANT-ELIGIBLE': 'eos-path-grant', 'INVESTABLE': 'eos-path-invest' };
  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  var DX_TO_PLAYBOOK = {
    'CLIMATE_TIPPING_POINT': 'env_climate',
    'MASS_EXTINCTION':       'env_biodiversity',
    'OCEAN_ACIDIFICATION':   'env_ocean',
    'DEFORESTATION':         'env_forest',
    'TOXIC_CONTAMINATION':   'env_pollution'
  };

  var INVEST_TARGETS = {
    'env_climate': [
      { ticker: 'AWK',  name: 'American Water Works',         cik: '1410636', validation: 'HELIX_VALIDATED', reason: 'Largest U.S. investor-owned water utility; climate adaptation capex for drought, flood, and treatment upgrades' },
      { ticker: 'WTRG', name: 'Essential Utilities (Aqua)',   cik: '78128',   validation: 'DOMAIN_MAPPED',   reason: 'Water and natural gas utility with climate-driven infrastructure hardening spend' },
      { ticker: 'WM',   name: 'Waste Management',             cik: '823768',  validation: 'HELIX_VALIDATED', reason: 'Landfill gas-to-energy (LFGTE) and recycling infrastructure, beneficiary of emissions rule tightening' },
      { ticker: 'RSG',  name: 'Republic Services',            cik: '1060391', validation: 'DOMAIN_MAPPED',   reason: 'Environmental services prime \u2014 LFG, recycling, and climate-resilience infrastructure' },
      { ticker: 'CLH',  name: 'Clean Harbors',                cik: '822818',  validation: 'DOMAIN_MAPPED',   reason: 'Hazardous waste, emergency spill response, PFAS remediation \u2014 direct beneficiary of climate-driven disaster response' },
      { ticker: 'NEE',  name: 'NextEra Energy',               cik: '753308',  validation: 'HELIX_VALIDATED', reason: 'Largest U.S. renewables operator; climate-driven demand for firm clean power and grid resilience capex' },
      { ticker: 'ENPH', name: 'Enphase Energy',               cik: '1463101', validation: 'DOMAIN_MAPPED',   reason: 'Distributed solar + storage microinverters; resilience beneficiary as grids face climate stress' },
      { ticker: 'FSLR', name: 'First Solar',                  cik: '1274494', validation: 'DOMAIN_MAPPED',   reason: 'Utility-scale thin-film PV; IRA-backed U.S. manufacturing for climate-policy-driven deployment' },
      { ticker: 'HUBB', name: 'Hubbell',                      cik: '48898',   validation: 'DOMAIN_MAPPED',   reason: 'Grid hardening components (transformers, switchgear) for climate-resilience capex at utilities' },
      { ticker: 'PWR',  name: 'Quanta Services',              cik: '1050915', validation: 'DOMAIN_MAPPED',   reason: 'Largest U.S. electric and pipeline construction contractor; climate-resilience and grid-hardening prime' },
      { ticker: 'ACM',  name: 'AECOM',                        cik: '868857',  validation: 'HELIX_VALIDATED', reason: 'Global engineering prime for climate adaptation, flood defense, resilience planning; Army Corps and state DOT contracts' },
      { ticker: 'J',    name: 'Jacobs Solutions',             cik: '52988',   validation: 'HELIX_VALIDATED', reason: 'Climate resilience engineering, water infrastructure, environmental consulting across federal + international markets' },
      { ticker: 'ICLN', name: 'iShares Global Clean Energy ETF', cik: null,   validation: 'ETF_PROXY',       reason: 'Global clean energy ETF \u2014 secondary proxy for climate-mitigation investment flows' },
      { ticker: 'PBW',  name: 'Invesco WilderHill Clean Energy ETF', cik: null, validation: 'ETF_PROXY',     reason: 'Broader clean energy and climate-tech ETF \u2014 secondary proxy for thematic exposure' }
    ],
    'env_biodiversity': [
      { ticker: 'WM',   name: 'Waste Management (habitat mgmt)', cik: '823768', validation: 'DOMAIN_MAPPED', reason: 'Post-closure landfill habitat restoration and conservation land management \u2014 ~30K protected acres' },
      { ticker: 'WY',   name: 'Weyerhaeuser',                 cik: '106535',  validation: 'DOMAIN_MAPPED',   reason: 'Largest U.S. timberland REIT; sustainable forestry certifications and biodiversity credit optionality' },
      { ticker: 'RYN',  name: 'Rayonier',                     cik: '52827',   validation: 'DOMAIN_MAPPED',   reason: 'Timberland REIT positioned for conservation easements and biodiversity credit markets' },
      { ticker: 'PCH',  name: 'PotlatchDeltic',               cik: '1518287', validation: 'DOMAIN_MAPPED',   reason: 'Timberland REIT with sustainable forestry and habitat conservation mandates' },
      { ticker: 'ACM',  name: 'AECOM (ecology practice)',     cik: '868857',  validation: 'DOMAIN_MAPPED',   reason: 'Environmental impact assessment, ESA Section 7 consultation, NEPA biodiversity work for federal projects' },
      { ticker: 'TTEK', name: 'Tetra Tech',                   cik: '831641',  validation: 'HELIX_VALIDATED', reason: 'Environmental consulting prime; USAID biodiversity programs and USFWS habitat assessment contracts' },
      { ticker: 'STN',  name: 'Stantec',                      cik: '1674930', validation: 'DOMAIN_MAPPED',   reason: 'Ecology, fisheries, and habitat restoration engineering services across North America' },
      { ticker: 'CE',   name: 'Celanese (bio-based chemicals)', cik: '1306830', validation: 'DOMAIN_MAPPED', reason: 'Bio-based acetyl and specialty chemicals supporting reduced-footprint agricultural and forest products' },
      { ticker: 'DE',   name: 'Deere & Company',              cik: '315189',  validation: 'DOMAIN_MAPPED',   reason: 'Precision ag platforms (See & Spray, AutoTrac) that materially reduce pesticide load on pollinators' },
      { ticker: 'TAP',  name: 'Molson Coors (regenerative supply)', cik: '24545', validation: 'DOMAIN_MAPPED', reason: 'Barley and hops supply chain moving to regenerative ag practices; biodiversity commitments tied to water supply' },
      { ticker: 'KOF', name: 'Coca-Cola FEMSA',               cik: '910631',  validation: 'DOMAIN_MAPPED',   reason: 'Watershed restoration and water-replenishment programs in Mexico and Latin America with biodiversity co-benefits' }
    ],
    'env_ocean': [
      { ticker: 'CWCO', name: 'Consolidated Water',           cik: '929547',  validation: 'DOMAIN_MAPPED',   reason: 'Seawater desalination in the Caribbean and Mexico; direct beneficiary of coastal water stress' },
      { ticker: 'XYL',  name: 'Xylem',                        cik: '1524472', validation: 'HELIX_VALIDATED', reason: 'Global water technology prime \u2014 pumps, treatment, and smart water infrastructure; coastal and marine water management' },
      { ticker: 'ERII', name: 'Energy Recovery',              cik: '1421517', validation: 'DOMAIN_MAPPED',   reason: 'Pressure-exchanger technology that makes seawater reverse osmosis economically viable at scale' },
      { ticker: 'AWK',  name: 'American Water Works',         cik: '1410636', validation: 'DOMAIN_MAPPED',   reason: 'Saltwater intrusion remediation for coastal groundwater systems; coastal resilience capex' },
      { ticker: 'WMS',  name: 'Advanced Drainage Systems',    cik: '1604028', validation: 'DOMAIN_MAPPED',   reason: 'Stormwater and coastal drainage infrastructure \u2014 sea-level-rise adaptation capex across U.S. coasts' },
      { ticker: 'ESE',  name: 'ESCO Technologies',            cik: '866706',  validation: 'DOMAIN_MAPPED',   reason: 'Naval marine and oceanographic instrumentation through Dometic/Westland division' },
      { ticker: 'TDW',  name: 'Tidewater',                    cik: '1134319', validation: 'DOMAIN_MAPPED',   reason: 'Offshore marine support vessels; exposure to ocean monitoring, subsea inspection, and offshore renewables' },
      { ticker: 'FMC',  name: 'FMC Corporation (aquaculture health)', cik: '37785', validation: 'DOMAIN_MAPPED', reason: 'Aquaculture health products and marine biosecurity \u2014 fishery collapse reshapes aquaculture demand' },
      { ticker: 'MOWI.OL', name: 'Mowi ASA',                  cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'World\u2019s largest salmon farmer; aquaculture resilience play as wild fishery stocks collapse' },
      { ticker: 'FFISH.OL', name: 'Fish Pool ASA (salmon derivatives)', cik: null, validation: 'ETF_PROXY', reason: 'Salmon derivative index exposure \u2014 secondary proxy for aquaculture market repricing under ocean stress' }
    ],
    'env_forest': [
      { ticker: 'WY',   name: 'Weyerhaeuser',                 cik: '106535',  validation: 'HELIX_VALIDATED', reason: 'Largest U.S. timberland REIT with 10.6M acres; SFI and FSC certifications; carbon and conservation optionality' },
      { ticker: 'RYN',  name: 'Rayonier',                     cik: '52827',   validation: 'DOMAIN_MAPPED',   reason: 'Timberland REIT with strong sustainable forestry and carbon-offset strategy; conservation easements' },
      { ticker: 'PCH',  name: 'PotlatchDeltic',               cik: '1518287', validation: 'DOMAIN_MAPPED',   reason: 'Timberland REIT \u2014 sustainable forestry and carbon credit exposure across Southeast U.S.' },
      { ticker: 'IP',   name: 'International Paper',          cik: '51434',   validation: 'DOMAIN_MAPPED',   reason: 'Largest U.S. containerboard producer with FSC/SFI-certified sustainable forestry operations' },
      { ticker: 'PKG',  name: 'Packaging Corporation of America', cik: '75677', validation: 'DOMAIN_MAPPED', reason: 'Containerboard with sustainable forestry commitments and recycled content mandates' },
      { ticker: 'UFPI', name: 'UFP Industries',               cik: '912242',  validation: 'DOMAIN_MAPPED',   reason: 'Certified wood products distributor; downstream beneficiary of EUDR traceability requirements' },
      { ticker: 'PL',   name: 'Planet Labs',                  cik: '1836833', validation: 'HELIX_VALIDATED', reason: 'Daily-revisit satellite imagery \u2014 load-bearing for Global Forest Watch and EUDR compliance monitoring' },
      { ticker: 'MAXR', name: 'Maxar (if re-listed via proxy)', cik: null,    validation: 'DOMAIN_MAPPED',   reason: 'Historical high-resolution satellite imagery for deforestation monitoring \u2014 currently private via Advent; exposure via satellite peers' },
      { ticker: 'BKSY', name: 'BlackSky Technology',          cik: '1753539', validation: 'DOMAIN_MAPPED',   reason: 'Commercial satellite imagery with deforestation alerting and commodity traceability use cases' },
      { ticker: 'TTEK', name: 'Tetra Tech (forestry consulting)', cik: '831641', validation: 'DOMAIN_MAPPED', reason: 'USAID forest programs, USFS contracts, and EUDR traceability consulting' },
      { ticker: 'ACM',  name: 'AECOM (EUDR / ESIA practice)', cik: '868857',  validation: 'DOMAIN_MAPPED',   reason: 'Environmental and social impact assessments for commodity supply chain deforestation compliance' }
    ],
    'env_pollution': [
      { ticker: 'CLH',  name: 'Clean Harbors',                cik: '822818',  validation: 'HELIX_VALIDATED', reason: 'North America\u2019s largest hazardous waste and emergency spill response prime; PFAS destruction and Superfund exposure' },
      { ticker: 'HCC',  name: 'US Ecology (now part of Republic Services)', cik: '1096752', validation: 'DOMAIN_MAPPED', reason: 'Hazardous waste treatment and disposal \u2014 PFAS, CERCLA, RCRA compliance services' },
      { ticker: 'VLTO', name: 'Veralto',                      cik: '1967680', validation: 'HELIX_VALIDATED', reason: 'Water quality and environmental analytics (Hach, ChemTreat, Trojan UV) \u2014 spun out of Danaher in 2023' },
      { ticker: 'ECL',  name: 'Ecolab',                       cik: '31462',   validation: 'HELIX_VALIDATED', reason: 'Water treatment chemistry and hygiene; PFAS-alternative chemistry supplier to industrial customers' },
      { ticker: 'XYL',  name: 'Xylem',                        cik: '1524472', validation: 'HELIX_VALIDATED', reason: 'Water technology prime; PFAS removal, GAC filtration, UV disinfection infrastructure' },
      { ticker: 'PNR',  name: 'Pentair',                      cik: '77360',   validation: 'DOMAIN_MAPPED',   reason: 'Residential and commercial water treatment; PFAS point-of-entry and point-of-use filtration systems' },
      { ticker: 'AWK',  name: 'American Water Works',         cik: '1410636', validation: 'DOMAIN_MAPPED',   reason: 'Water utility with $1B+ PFAS treatment capex following EPA MCL finalization' },
      { ticker: 'AOS',  name: 'A. O. Smith',                  cik: '91142',   validation: 'DOMAIN_MAPPED',   reason: 'Water treatment products (heaters, softeners, reverse osmosis) with PFAS-capable filtration lines' },
      { ticker: 'ROP',  name: 'Roper Technologies (Neptune water)', cik: '882835', validation: 'DOMAIN_MAPPED', reason: 'Smart water metering and industrial water analytics through Neptune subsidiary' },
      { ticker: 'WMS',  name: 'Advanced Drainage Systems',    cik: '1604028', validation: 'DOMAIN_MAPPED',   reason: 'Stormwater management and industrial runoff control \u2014 MS4 and NPDES compliance infrastructure' },
      { ticker: 'GNRC', name: 'Generac Holdings (clean standby)', cik: '1474735', validation: 'DOMAIN_MAPPED', reason: 'Natural gas and propane standby generation positioned as cleaner-burning alternative to diesel' },
      { ticker: 'DCI',  name: 'Donaldson Company',            cik: '29644',   validation: 'DOMAIN_MAPPED',   reason: 'Industrial air and liquid filtration; emissions control products and PFAS-rated filter media' },
      { ticker: 'PH',   name: 'Parker Hannifin',              cik: '76334',   validation: 'DOMAIN_MAPPED',   reason: 'Industrial filtration division with gas, liquid, and PFAS removal product lines for industrial customers' }
    ]
  };

  var PLAYBOOK_DEFS = {
    'env_climate': { title: 'Climate Adaptation & Resilience', domains: ['environment', 'infrastructure'], type: 'invest' },
    'env_biodiversity': { title: 'Biodiversity Monitoring & Compliance', domains: ['environment', 'science'], type: 'invest' },
    'env_ocean': { title: 'Ocean & Water Stress', domains: ['environment', 'population'], type: 'invest' },
    'env_forest': { title: 'Deforestation & Reforestation', domains: ['environment', 'agriculture'], type: 'invest' },
    'env_pollution': { title: 'Pollution Remediation & Treatment', domains: ['environment', 'industry'], type: 'invest' }
  };

  function resolvePlaybookId(opp) {
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    return 'env_climate';
  }

  // ── MECHANISM EXPLANATIONS ──

  var MECH_EXPLAIN = {
    'CLIMATE_TIPPING_POINT': {
      'climate_warming':    { why: 'Each additional tenth of a degree of warming locks in more permafrost thaw, more ice-sheet loss, more ocean heat content, and more cascading feedback across the earth system. 2024 was the first full calendar year above 1.5\u00b0C; ocean heat content keeps setting records; and tipping-point analyses (AMOC slowdown, Greenland ice sheet instability, Amazon dieback) are moving from speculative to observed. Budgets for grid hardening, water, flood defense, and adaptation engineering are being signed by utilities, cities, states, and national governments simultaneously.', move: 'Position in climate-resilience engineering primes (AECOM, Jacobs, Stantec, Tetra Tech), utility grid hardening (Quanta Services, Hubbell), flood defense and stormwater (Advanced Drainage Systems, Xylem), and climate-resilient utilities (American Water Works, NextEra, Essential Utilities). Range: $50M-$5B+ multi-year resilience contracts.' },
      'extreme_weather':    { why: 'Hurricane, heatwave, wildfire, drought, and flood intensity and frequency are all rising. Property insurance is repricing or withdrawing in Florida, California, Louisiana; FEMA Disaster Relief Fund runs out mid-season; utilities face wildfire ignition liability; and data centers are chasing cooling water. Every major disaster triggers a wave of emergency contracts that bypass normal procurement cycles.', move: 'Position in disaster response primes (Clean Harbors emergency response, AECOM disaster recovery, IES Holdings), standby power (Generac), wildfire-hardened T&D (Quanta Services, MYR Group), climate-resilient cooling and data-center water (Xylem, Mueller Water Products), and reinsurance / cat bond positioning (RenaissanceRe, Everest Group). Pursue FEMA Public Assistance, HMGP, and state emergency response contracts.' },
      'climate_adaptation': { why: 'Adaptation is no longer optional. Cities, ports, airports, rail operators, and water utilities are all writing multi-decade capital plans assuming materially higher temperatures, higher seas, and more variable precipitation. Managed retreat programs, seawalls, cooling centers, stormwater capacity upgrades, and nature-based infrastructure are all seeing new revenue streams from federal IIJA, IRA, and state climate bond programs.', move: 'Position in coastal engineering primes (Jacobs, AECOM, Moffatt & Nichol as reference), stormwater (Advanced Drainage Systems, Core & Main), managed retreat and floodplain restoration contractors, and adaptation advisory services. Target IIJA Resilience, BRIC, and state-level adaptation bonds. Range: $10M-$500M per multi-year contract.' },
      'carbon_removal':     { why: 'As emissions cuts fall short of Paris targets, carbon removal moves from optional to structural. Corporate net-zero commitments (Microsoft, Google, Stripe, Frontier Climate, Shopify), federal DOE Carbon Negative Shot, 45Q tax credits, and EU CBAM all create hard demand for verified tonnes of CO2 removal. Direct air capture, biomass carbon removal, enhanced weathering, and ocean alkalinization are scaling toward megaton-per-year offtakes.', move: 'Position in carbon removal infrastructure and offtake contracts: Occidental (1PointFive DAC), Oxy\u2019s Stratos Texas facility, Heirloom, Climeworks, Charm Industrial, CarbonCapture Inc as references; commercial tickers: OXY (Oxy / 1PointFive), energy majors scaling CCS infrastructure, and industrial gas primes (Linde, Air Products). Target DOE Carbon Negative Shot RFAs, Frontier Climate offtakes, and 45Q-qualified credits.' }
    },
    'MASS_EXTINCTION': {
      'biodiversity_loss':  { why: 'Vertebrate populations are down ~70% since 1970 (WWF Living Planet Index); insect biomass has collapsed in monitored European sites; amphibians are the most threatened vertebrate class; and ~1M species are at risk of extinction per IPBES. The TNFD framework is forcing corporate nature-disclosure, and the Global Biodiversity Framework 30x30 target is creating sovereign commitments that translate into land, marine, and supply chain contracts.', move: 'Position in biodiversity monitoring vendors (eDNA companies: NatureMetrics, SimplexDNA; commercial satellite imagery: Planet Labs, BlackSky), habitat restoration and conservation engineering (AECOM ecology, Tetra Tech, Stantec), and biodiversity credit markets (Verra, Gold Standard nature-based credits). Target TNFD-driven corporate compliance contracts, USAID biodiversity programs, and USFWS Section 7 consultation work.' },
      'deforestation':      { why: 'Forest loss drives biodiversity collapse because tropical forests house 50-80% of terrestrial biodiversity. EUDR forces traceability on coffee, cocoa, palm oil, rubber, soy, cattle, wood, and their derivatives entering the EU \u2014 a massive compliance market that flows directly to satellite monitoring, traceability, and supply chain platforms.', move: 'Position in deforestation monitoring (Planet Labs, BlackSky, satellite imagery primes), supply chain traceability platforms (EcoVadis, Trase Earth, Satelligence as references), and EUDR compliance services (Deloitte Sustainability, PwC, EY supply chain practices). Pursue EUDR operator / trader compliance contracts and USAID forest programs.' },
      'pollution_toxicity': { why: 'Chemical pollution is now recognized as one of the top three drivers of biodiversity loss alongside habitat change and climate. Pesticide load drives pollinator collapse; PFAS bioaccumulates through food chains; pharmaceutical residues disrupt amphibian development; and microplastics have reached every ecosystem on earth. Regulatory responses (EU pesticide reductions, U.S. state PFAS bans, EPA endocrine disruptor screening) are creating new compliance markets.', move: 'Position in pollinator-friendly precision ag (Deere See & Spray, AGCO, CNH precision platforms), PFAS remediation (Clean Harbors, Xylem, Veralto), and pesticide alternatives (Corteva biologicals, FMC biopesticides, Bayer biological seed treatments). Target EPA FIFRA enforcement work and state-level pesticide program contracts.' },
      'regulatory_response':{ why: 'The post-GBF policy wave is large: EU Nature Restoration Law, U.S. ESA listings and critical habitat designations, state biodiversity mandates (California 30x30), and sovereign nature-positive commitments. Corporate disclosure regimes (TNFD, CSRD Article 19a) create reporting requirements that flow to environmental consultants, assurance providers, and platform vendors.', move: 'Position in environmental consulting primes (Tetra Tech, AECOM, Stantec, Arcadis via DOE, Ramboll as reference), assurance and disclosure platforms (Workiva, Sphera, Diligent ESG), and GIS / conservation planning software (ESRI, Trimble, Hexagon as references). Target TNFD pilot corporate contracts and state 30x30 implementation work.' }
    },
    'OCEAN_ACIDIFICATION': {
      'ocean_stress':       { why: 'Ocean pH has dropped ~0.1 since pre-industrial times \u2014 a 30% increase in hydrogen ion concentration. Coral reefs face mass bleaching at +1.5\u00b0C, fishery collapses are accelerating, and dead zones are expanding in the Gulf of Mexico, Baltic, and Chesapeake. Marine heatwaves drive ecosystem-scale mortality events. The fix set is acute: aquaculture resilience, marine monitoring, coral restoration, and pollution reduction to support the ecosystems that remain.', move: 'Position in aquaculture resilience (Mowi, Salmar, Grieg Seafood as references; commercial: FMC aquaculture health), marine monitoring (Xylem Sontek, YSI), desalination (Consolidated Water, Energy Recovery), and pollution reduction (Ecolab, Veralto, Xylem). Pursue NOAA Ocean Acidification Program contracts, ICES work, and state coastal programs.' },
      'climate_warming':    { why: 'Ocean acidification is the direct chemistry outcome of atmospheric CO2 absorption by seawater. Every tonne of CO2 emitted that gets absorbed by the ocean increases ocean acidity further. Climate mitigation is therefore the upstream lever for ocean chemistry, and every mitigation play is also an ocean-chemistry play. Ocean-based CO2 removal is emerging as a dedicated subcategory.', move: 'Position in ocean-based carbon removal (Running Tide, Ebb Carbon, Planetary Technologies, Captura as references; public exposure via marine services and monitoring firms with coastal R&D exposure), and coastal blue-carbon restoration (mangrove, seagrass, kelp). Pursue DOE Carbon Negative Shot ocean-based funding and NOAA blue carbon programs.' },
      'pollution_toxicity': { why: 'Ocean pollution (plastics, PFAS, heavy metals, nutrient runoff from agriculture) compounds acidification stress. Nutrient pollution drives hypoxic dead zones; microplastics are now in every marine food chain; and PFAS contamination is ubiquitous in surface waters. Remediation at scale is increasingly a required part of any coastal management plan.', move: 'Position in water treatment and plastic interception (Xylem, Veralto, Ecolab, Advanced Drainage Systems), PFAS destruction (Clean Harbors), and precision ag nutrient-management (Deere, AGCO). Pursue EPA Chesapeake Bay Program, Gulf Hypoxia Task Force contracts, and state coastal program work.' },
      'regulatory_response':{ why: 'International ocean governance is tightening: UN BBNJ (High Seas Treaty), MARPOL amendments on ship pollution, IMO carbon pricing for shipping, and strengthened fisheries management. Domestic U.S. action includes the Endangered Species Act for marine mammals, Magnuson-Stevens fishery management, and state-level coastal plans. Each of these creates compliance and monitoring contracts.', move: 'Position in shipping emissions control (Wartsila, MAN Energy Solutions as references), fisheries stock assessment and management (Tetra Tech, AECOM marine practice), and IMO / IUCN compliance vendors. Pursue NOAA Fisheries contracts and USFWS marine mammal work.' }
    },
    'DEFORESTATION': {
      'deforestation':      { why: 'Primary forest loss is accelerating in the tropics: Brazil Amazon fluctuates with policy, Colombia and Peru rising, Indonesia stabilizing but secondary forest loss climbing, Congo Basin under pressure from logging and agriculture. EUDR enters its full enforcement period and forces commodity traceability for coffee, cocoa, palm, rubber, cattle, soy, and wood products entering the EU. This alone creates a multi-billion-dollar compliance market.', move: 'Position in satellite deforestation monitoring (Planet Labs NICFI, BlackSky, Global Forest Watch via WRI and Google), supply chain traceability platforms (EcoVadis, Trase Earth, Satelligence), and EUDR compliance consultants (Big 4 sustainability practices, Control Union, Bureau Veritas). Pursue EUDR operator compliance contracts and USAID forest programs.' },
      'biodiversity_loss':  { why: 'Tropical forests contain most of the planet\u2019s terrestrial biodiversity. Losing them means losing species faster than they can be catalogued. Habitat fragmentation is also a top driver of species decline in temperate forests where primary forest loss is not the dominant issue. Restoration and connectivity work is scaling up via federal, state, and private programs.', move: 'Position in reforestation and ecosystem restoration primes (DroneSeed as reference; commercial: Weyerhaeuser timberland restoration, Rayonier), nature-based carbon credit suppliers (Pachama, NCX as references; public exposure via timberland REITs), and ecological restoration services (Tetra Tech, AECOM, Stantec ecology). Target USDA Reforestation Trust Fund, USAID Restore Our Climate, and state wildlife habitat programs.' },
      'soil_degradation':   { why: 'Deforestation exposes soil to erosion, nutrient loss, and degradation, especially in tropical regions with heavy rainfall. Soil organic carbon losses compound the carbon budget problem and degrade future agricultural potential. Regenerative agriculture and agroforestry are the operational fixes, and they are now being funded at scale through USDA Partnerships for Climate-Smart Commodities and private voluntary markets.', move: 'Position in regenerative ag platforms (Indigo Ag, Truterra, Leading Harvest as references; commercial: Deere precision ag, FMC biologicals, Corteva biologicals), agroforestry implementation (Propagate Ventures as reference; public exposure via timber REITs and ag primes), and soil carbon measurement (CIBO Technologies as reference). Pursue USDA Partnerships for Climate-Smart Commodities, NRCS EQIP, and private soil carbon offtakes.' },
      'carbon_removal':     { why: 'Forest carbon remains the largest cost-effective carbon removal opportunity at scale. Reforestation, afforestation, avoided deforestation (REDD+), and improved forest management together provide the bulk of nature-based carbon credits. Quality scrutiny has reset the market after 2023 integrity scandals, but high-integrity suppliers (Verra VCS + CCB, Gold Standard, ART TREES) are seeing renewed demand from corporate buyers.', move: 'Position in timberland REITs with carbon optionality (Weyerhaeuser, Rayonier, PotlatchDeltic), high-integrity nature-based credit suppliers (BlueSource, Finite Carbon as references), and ART TREES jurisdictional credit infrastructure. Pursue Frontier Climate offtakes, corporate net-zero supply contracts, and sovereign REDD+ programs.' }
    },
    'TOXIC_CONTAMINATION': {
      'pollution_toxicity': { why: 'PFAS contamination is now the largest environmental liability in U.S. history. EPA finalized MCLs for PFOA and PFOS at 4 parts per trillion in 2024, forcing water utilities to spend an estimated $1.8B per year on treatment. Superfund-level remediation for PFAS is emerging at military bases, manufacturing sites, and airports. State AGs are pursuing producers under public nuisance theories. All of this flows to water treatment, remediation, and destruction vendors.', move: 'Position in PFAS water treatment (Xylem, Veralto, Pentair, Ecolab, AECOM engineering), PFAS destruction (Clean Harbors high-temperature incineration, Battelle as reference), and water utility treatment capex (American Water Works, Essential Utilities, Pennsylvania-American). Target EPA Superfund contracts, DoD PFAS remediation, and utility-scale water treatment infrastructure.' },
      'industrial_discharge':{ why: 'CERCLA (Superfund), RCRA, and Clean Water Act NPDES enforcement are all seeing elevated activity. Industrial spills and discharges from refineries, pipelines, mines, and manufacturing plants create rapid-response contract flow. Tailings dam failures, pipeline leaks, and train derailment events (East Palestine, OH 2023) have reinforced EPA emergency response funding. The entire hazardous-waste and emergency-response value chain is under sustained demand.', move: 'Position in hazardous waste primes (Clean Harbors, US Ecology / Republic Services, Waste Management), emergency response (Clean Harbors CleanCo, NRC USES), industrial cleaning (Safety-Kleen, MasTec industrial services), and environmental engineering (AECOM Tishman, Jacobs, Tetra Tech). Target EPA Superfund task orders, state-led remediation programs, and DoD Installation Restoration Program contracts.' },
      'water_stress':       { why: 'Water contamination is inseparable from water scarcity. When clean sources are fewer, each remaining source is worth more and gets protected harder. EPA drinking water rules tightening, state-level disinfection byproduct (DBP) regulations, and lead service line replacement mandates (IIJA $15B) all flow to the water utility and treatment chain.', move: 'Position in water utilities (American Water Works, Essential Utilities, Southwest Water), water treatment equipment (Xylem, Veralto, Pentair, Mueller Water Products), and lead service line replacement contractors (MasTec, Quanta Services, IES Holdings). Pursue IIJA lead service line replacement, SRF (State Revolving Fund) contracts, and EPA Safe Drinking Water Act enforcement work.' },
      'regulatory_response':{ why: 'EPA and state environmental agencies are entering a hardened enforcement cycle: ECHO database tracks thousands of violators; EPA Office of Enforcement and Compliance Assurance continues prioritizing environmental justice cases; state AGs are pursuing producers for PFAS and forever chemicals. New rules on methane (oil and gas), HFCs (AIM Act), and TSCA chemical reviews all create compliance markets for environmental consultants and engineering primes.', move: 'Position in environmental consulting primes (Tetra Tech, AECOM, Jacobs, Stantec, Arcadis, ERM as reference), compliance software (Enhesa, Intelex EHS, Sphera, Cority, VelocityEHS), and environmental assurance vendors (Bureau Veritas, SGS, Intertek). Target EPA enforcement support, state DEP contracts, and corporate compliance advisory.' }
    }
  };

  var MECH_FALLBACK = {
    'climate_warming':      { why: 'The climate is warming faster than ecosystems, infrastructure, and communities can adapt. Adaptation, resilience engineering, and carbon removal capex all accelerate.', move: 'Position in climate-resilience engineering (AECOM, Jacobs, Tetra Tech), utility grid hardening (Quanta Services), and carbon removal (Occidental 1PointFive).' },
    'extreme_weather':      { why: 'Extreme weather events are more frequent and more intense. Emergency response, standby power, and disaster-recovery capex surge.', move: 'Position in disaster response (Clean Harbors, AECOM), standby power (Generac), and reinsurance capacity.' },
    'biodiversity_loss':    { why: 'Biodiversity is collapsing across vertebrates, insects, and plants. Monitoring, restoration, and corporate nature-disclosure compliance markets grow.', move: 'Position in environmental consulting (Tetra Tech, AECOM, Stantec) and satellite monitoring (Planet Labs).' },
    'ocean_stress':         { why: 'Ocean chemistry, temperature, and ecosystems are under acute stress. Aquaculture, monitoring, and marine remediation demand grows.', move: 'Position in water tech (Xylem, Veralto), desalination (Consolidated Water, Energy Recovery), and aquaculture.' },
    'deforestation':        { why: 'Forest loss is accelerating in the tropics. EUDR compliance, monitoring, and reforestation capex all scale.', move: 'Position in satellite monitoring (Planet Labs, BlackSky), timberland REITs (Weyerhaeuser, Rayonier), and environmental consulting (Tetra Tech).' },
    'pollution_toxicity':   { why: 'PFAS, heavy metals, and chemical contamination events are driving sustained remediation and treatment spend.', move: 'Position in hazardous waste (Clean Harbors), water treatment (Xylem, Veralto), and consulting primes (AECOM, Tetra Tech).' },
    'water_stress':         { why: 'Water scarcity and contamination are forcing utility and infrastructure capex.', move: 'Position in water utilities (American Water Works), treatment (Xylem, Veralto), and desalination (Consolidated Water).' },
    'soil_degradation':     { why: 'Soil erosion, salinization, and organic matter loss are degrading agricultural potential and carbon sinks.', move: 'Position in precision ag (Deere), biologicals (FMC, Corteva), and soil carbon programs.' },
    'industrial_discharge': { why: 'Industrial spills, pipeline leaks, and refinery discharges are driving emergency response and remediation work.', move: 'Position in hazardous waste primes (Clean Harbors, Republic Services) and environmental engineering (AECOM, Jacobs).' },
    'climate_adaptation':   { why: 'Adaptation infrastructure spending is accelerating across utilities, ports, rail, and water.', move: 'Position in engineering primes (AECOM, Jacobs, Stantec) and utility hardening (Quanta Services, Hubbell).' },
    'carbon_removal':       { why: 'Carbon removal is scaling from pilots to commercial offtakes.', move: 'Position in direct air capture (Occidental 1PointFive), timberland REITs (Weyerhaeuser), and DOE Carbon Negative Shot awardees.' },
    'regulatory_response':  { why: 'Environmental regulation is tightening across EPA, state agencies, and international frameworks.', move: 'Position in environmental consulting primes (Tetra Tech, AECOM, Stantec) and compliance software (Sphera, Cority).' }
  };

  var VAL_LABELS = {
    'HELIX_VALIDATED': { label: 'HELIX VALIDATED', cls: 'eos-val-helix' },
    'NODE_MAPPED':     { label: 'NODE MAPPED',     cls: 'eos-val-node' },
    'DOMAIN_MAPPED':   { label: 'DOMAIN MAPPED',   cls: 'eos-val-domain' },
    'ETF_PROXY':       { label: 'ETF PROXY',       cls: 'eos-val-etf' }
  };

  function renderTargets(pbId) {
    var targets = INVEST_TARGETS[pbId];
    if (!targets || targets.length === 0) return '';
    var tCollapsed = isCollapsed('targets-' + pbId);

    var h = '<div class="eos-targets">';
    h += '<div class="eos-targets-header" data-section="targets-' + pbId + '">';
    h += '<div class="eos-title" style="margin-bottom:0;font-size:0.26rem">SUGGESTED TARGETS \u00b7 ' + targets.length + '</div>';
    h += '<span style="font-size:0.22rem;color:rgba(201,169,78,0.25)">' + (tCollapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div data-section-body="targets-' + pbId + '"' + (tCollapsed ? ' style="display:none"' : '') + '>';
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Environment condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var v = VAL_LABELS[t.validation] || { label: t.validation, cls: '' };
      var shortFit = t.reason.length > 60 ? t.reason.substring(0, 57) + '...' : t.reason;

      h += '<div class="eos-target-row" data-target-idx="' + pbId + '-' + i + '">';
      h += '<span class="eos-target-ticker">' + esc(t.ticker) + '</span>';
      h += '<span class="eos-target-name">' + esc(t.name) + '</span>';
      h += '<span class="eos-target-cik">' + (t.cik ? 'CIK ' + esc(t.cik) : '') + '</span>';
      h += '<span class="eos-target-val ' + v.cls + '">' + v.label + '</span>';
      h += '<span class="eos-target-fit">' + esc(shortFit) + '</span>';
      h += '<span class="eos-target-expand">\u25BC</span>';
      h += '</div>';

      h += '<div class="eos-target-detail" data-target-detail="' + pbId + '-' + i + '">';
      h += '<div style="margin-bottom:4px"><b style="color:#b0a898">Why it fits:</b> ' + esc(t.reason) + '</div>';
      if (t.validation === 'ETF_PROXY') h += '<div style="margin-bottom:4px;color:#807868">This is an ETF sector proxy, not a company-level Helix-validated pick.</div>';
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Environment portal node. Company-level Helix validation pending.</div>';
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=environment&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '" target="_blank">COMPANY PORTAL</a>';
      if (!t.cik && t.ticker) h += '<a class="eos-target-link" href="company-portal.html?company=' + esc(t.ticker.toLowerCase()) + '" target="_blank">COMPANY PORTAL</a>';
      h += '</div>';
      h += '</div>';
    }

    h += '</div>';
    h += '</div>';
    return h;
  }

  function renderMechanismBlock(opp, style) {
    if (!opp || !opp._mechanism || !opp._mechanism.primary) return '';
    var mech = opp._mechanism;
    var dxId = (opp.diagnosisId || '').toUpperCase();
    var dxExplains = MECH_EXPLAIN[dxId] || {};
    var explain = dxExplains[mech.primary] || MECH_FALLBACK[mech.primary] || null;
    if (!explain) return '';
    var borderColor = style === 'deep' ? 'rgba(74,143,212,0.2)' : 'rgba(201,169,78,0.2)';
    var labelColor = style === 'deep' ? 'rgba(74,143,212,0.8)' : 'rgba(201,169,78,0.8)';
    var bgColor = style === 'deep' ? 'rgba(74,143,212,0.02)' : 'rgba(201,169,78,0.02)';
    var h = '<div style="margin:8px 0;padding:8px 10px;border:1px solid ' + borderColor + ';border-radius:3px;background:' + bgColor + '">';
    h += '<div style="font-size:0.24rem;letter-spacing:1.5px;color:' + labelColor + ';font-weight:600;margin-bottom:4px">MECHANISM \u00b7 ' + esc(mech.primaryLabel || mech.primary).toUpperCase() + '</div>';
    h += '<div style="font-size:0.34rem;color:#d0c8b8;line-height:1.6;margin-bottom:4px"><b style="color:#e0daca">Why this matters:</b> ' + esc(explain.why) + '</div>';
    h += '<div style="font-size:0.34rem;color:#5ab5a0;line-height:1.6"><b style="color:#6ec5b0">Commercial move:</b> ' + esc(explain.move) + '</div>';
    h += '</div>';
    return h;
  }

  var _deepToggleCounter = 0;

  function renderDeepIntel(opp, label) {
    if (!opp || !opp._deepIntel) return '';
    var di = opp._deepIntel;
    var hasContent = di.monitoring || di.escalation || (di.citations && di.citations.length > 0) || di.cite || di.targetPathway;
    if (!hasContent) return '';
    var toggleId = 'deep-' + (++_deepToggleCounter);
    label = label || 'DEEP INTELLIGENCE';
    var h = '';
    h += '<button class="eos-deep-toggle" onclick="var b=document.getElementById(\'' + toggleId + '\');b.classList.toggle(\'open\');this.textContent=b.classList.contains(\'open\')?\'\u25BC ' + label + '\':\'\u25B6 ' + label + '\'">\u25B6 ' + label + '</button>';
    h += '<div class="eos-deep-body" id="' + toggleId + '">';
    if (di.monitoring) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">MONITORING PROTOCOL</div>';
      h += '<div class="eos-deep-text">' + esc(typeof di.monitoring === 'string' ? di.monitoring : JSON.stringify(di.monitoring)) + '</div></div>';
    }
    if (di.escalation) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">IF THIS FAILS</div>';
      h += '<div class="eos-deep-text">' + esc(typeof di.escalation === 'string' ? di.escalation : JSON.stringify(di.escalation)) + '</div></div>';
    }
    if (di.targetPathway) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">STRATEGY PATH</div>';
      h += '<div class="eos-deep-text">' + esc(di.targetPathway.replace(/->/g, ' \u2192 ').replace(/_/g, ' ')) + '</div></div>';
    }
    if (di.citations && di.citations.length > 0) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">SOURCES (' + di.citations.length + ')</div>';
      for (var ci = 0; ci < di.citations.length; ci++) {
        var c = di.citations[ci];
        var citeStr = '';
        if (typeof c === 'string') { citeStr = c; }
        else { citeStr = (c.author || '') + ' (' + (c.year || '') + '). ' + (c.title || '') + '. ' + (c.journal || ''); if (c.doi) citeStr += ' doi:' + c.doi; }
        h += '<div class="eos-deep-cite">' + esc(citeStr) + '</div>';
      }
      h += '</div>';
    } else if (di.cite) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">SOURCES</div>';
      h += '<div class="eos-deep-cite">' + esc(di.cite) + '</div></div>';
    }
    if (di.ancestryPath && di.ancestryPath.length > 0) {
      h += '<div class="eos-deep-section"><div class="eos-deep-label">PORTAL LINEAGE</div>';
      h += '<div class="eos-deep-text">' + di.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ') + ' (L' + (di.depth || '?') + ')</div></div>';
    }
    h += '</div>';
    return h;
  }

  // ── DRILL DEEPER ──

  var _branchIndex = null, _branchIndexFailed = false;
  function _loadBranchIndex() {
    if (_branchIndex) return Promise.resolve(_branchIndex);
    if (_branchIndexFailed) return Promise.resolve(null);
    return fetch('/assets/data/deep/environment-branch-index.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { _branchIndex = d; return d; }).catch(function () { _branchIndexFailed = true; return null; });
  }

  function renderDrillDeeper(opp) {
    if (!opp || !opp._omittedSiblingCount || opp._omittedSiblingCount <= 0) return '';
    var dir = opp._directive || {};
    var drillId = 'drill-' + (++_deepToggleCounter);
    return '<div style="margin-top:6px"><button class="eos-deep-toggle" data-drill-id="' + drillId + '" data-node="' + esc(dir.nodeId || opp.nodeId || '') + '" data-ancestry="' + esc((dir.ancestryPath || opp.ancestryPath || []).join(',')) + '" style="color:rgba(74,143,212,0.8);border-color:rgba(74,143,212,0.25)">\u{1F50D} DRILL DEEPER \u00b7 ' + opp._omittedSiblingCount + ' related branches</button><div id="' + drillId + '" class="eos-deep-body" style="max-height:400px;overflow-y:auto"></div></div>';
  }

  function _handleDrillClick(drillId, nodeId, ancestryStr) {
    var c = document.getElementById(drillId);
    if (!c) return;
    if (c.classList.contains('open')) { c.classList.remove('open'); return; }
    c.innerHTML = '<div style="color:#807868;padding:8px">Loading\u2026</div>';
    c.classList.add('open');
    _loadBranchIndex().then(function (idx) {
      if (!idx || !idx.branches) { c.innerHTML = '<div style="color:#807868;padding:8px">Branch index unavailable</div>'; return; }
      var anc = ancestryStr ? ancestryStr.split(',') : [];
      var root = anc.length >= 2 ? anc[1] : '';
      var rel = [];
      for (var i = 0; i < idx.branches.length; i++) {
        var b = idx.branches[i];
        var s = 0;
        if (b.nodeId === nodeId) s += 10;
        if (root && b.ancestryPath && b.ancestryPath.length >= 2 && b.ancestryPath[1] === root) s += 5;
        if (s > 0) { b._rel = s + (b.richness || 0); rel.push(b); }
      }
      rel.sort(function (a, b) { return b._rel - a._rel; });
      rel = rel.slice(0, 20);
      if (!rel.length) { c.innerHTML = '<div style="color:#807868;padding:8px">No related branches</div>'; return; }
      var h = '';
      for (var ri = 0; ri < rel.length; ri++) {
        var br = rel[ri];
        var badges = '';
        if (br.hasMonitoring) badges += '<span style="color:rgba(74,143,212,0.7);margin-right:4px">monitoring</span>';
        if (br.hasCitations) badges += '<span style="color:rgba(90,181,160,0.7);margin-right:4px">citations</span>';
        if (br.hasEscalation) badges += '<span style="color:rgba(201,169,78,0.7);margin-right:4px">escalation</span>';
        h += '<div style="padding:6px 8px;margin-bottom:4px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:0.32rem;color:#c0b8a5">' + esc(br.treatmentLabel) + '</div><div style="font-size:0.24rem;color:#807868">' + esc(br.portalDomainId) + ' \u00b7 L' + br.depth + ' \u00b7 ' + esc(br.nodeId) + '</div><div style="font-size:0.22rem;margin-top:2px">' + badges + '</div></div><button class="eos-deep-toggle" data-load-branch="' + esc(br.portalDomainId) + '" style="font-size:0.22rem;white-space:nowrap">LOAD BRANCH</button></div><div id="branch-content-' + esc(br.portalDomainId) + '" style="display:none;margin-top:6px;padding:6px;border-top:1px solid rgba(74,143,212,0.1)"></div></div>';
      }
      c.innerHTML = h;
    });
  }

  function _handleLoadBranch(pid) {
    var el = document.getElementById('branch-content-' + pid);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = '<div style="color:#807868;font-size:0.28rem">Loading ' + esc(pid) + '\u2026</div>';
    fetch('/assets/data/domains/' + encodeURIComponent(pid) + '.json').then(function(r) { if (r.ok) return r; return fetch('/api/fetch-portal?domainId=' + encodeURIComponent(pid)); })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var h = '';
        var acts = data.activations || [];
        for (var ai = 0; ai < acts.length; ai++) {
          var a = acts[ai];
          for (var ti = 0; ti < (a.treatments || []).length; ti++) {
            var t = a.treatments[ti];
            if (!t.monitoring && !t.escalation && !t.citation && !t.cite) continue;
            h += '<div style="margin-bottom:8px"><div style="font-size:0.30rem;color:#d0c8b8;font-weight:600">' + esc(t.label || '') + '</div>';
            if (t.monitoring) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">MONITORING</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.monitoring === 'string' ? t.monitoring.substring(0, 400) : '') + '</span></div>';
            if (t.escalation) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">IF THIS FAILS</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.escalation === 'string' ? t.escalation.substring(0, 400) : '') + '</span></div>';
            if (t.cite) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">SOURCES</span><br><span style="font-size:0.26rem;color:#908878">' + esc(typeof t.cite === 'string' ? t.cite.substring(0, 300) : '') + '</span></div>';
            h += '</div>';
            break;
          }
        }
        if (!h) h = '<div style="color:#807868;font-size:0.28rem">No deep content in this branch</div>';
        el.innerHTML = h;
      })
      .catch(function () { el.innerHTML = '<div style="color:#e85454;font-size:0.28rem">Failed to load branch</div>'; });
  }
  // ── PORTAL SOURCE ──
  function _handlePortalSource(pid) {
    fetch('/' + pid + '_portal.html', { method: 'HEAD' }).then(function (r) {
      if (r.ok || r.status === 308) { window.open('/' + pid + '_portal.html', '_blank'); }
      else { _loadBranchInline(pid); }
    }).catch(function () { _loadBranchInline(pid); });
  }
  function _loadBranchInline(pid) {
    var el = document.getElementById('portal-inline-' + pid);
    if (el && el.style.display !== 'none') { el.style.display = 'none'; return; }
    if (el) { el.style.display = 'block'; el.innerHTML = '<div style="color:#807868;font-size:0.28rem">Loading source portal\u2026</div>'; }
    fetch('/assets/data/domains/' + encodeURIComponent(pid) + '.json').then(function(r) { if (r.ok) return r; return fetch('/api/fetch-portal?domainId=' + encodeURIComponent(pid)); }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
      var h = _renderBranchContent(data);
      if (el) { el.innerHTML = h; } else {
        var ov = document.createElement('div'); ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(5,8,16,0.7);z-index:9998'; ov.onclick = function(){ov.remove()};
        ov.innerHTML = '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0e1018;border:1px solid rgba(74,143,212,0.3);border-radius:4px;padding:16px 20px;max-width:600px;max-height:80vh;overflow-y:auto;z-index:9999"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:0.28rem;letter-spacing:2px;color:rgba(74,143,212,0.7)">SOURCE: '+pid+'</span><button onclick="this.closest(\'div\').parentNode.remove()" style="background:none;border:none;color:#908878;cursor:pointer;font-size:0.4rem">\u2715</button></div>'+h+'</div>';
        document.body.appendChild(ov);
      }
    }).catch(function () { if (el) el.innerHTML = '<div style="color:#e85454;font-size:0.28rem">Failed to load</div>'; });
  }
  function _renderBranchContent(data) {
    var h = ''; for (var ai = 0; ai < (data.activations || []).length; ai++) { var a = data.activations[ai]; for (var ti = 0; ti < (a.treatments || []).length; ti++) { var t = a.treatments[ti]; if (!t.monitoring && !t.escalation && !t.citation && !t.cite) continue; h += '<div style="margin-bottom:8px"><div style="font-size:0.30rem;color:#d0c8b8;font-weight:600">' + esc(t.label || '') + '</div>'; if (t.monitoring) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">MONITORING</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.monitoring === 'string' ? t.monitoring.substring(0, 400) : '') + '</span></div>'; if (t.escalation) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">IF THIS FAILS</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.escalation === 'string' ? t.escalation.substring(0, 400) : '') + '</span></div>'; if (t.cite) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">SOURCES</span><br><span style="font-size:0.26rem;color:#908878">' + esc(typeof t.cite === 'string' ? t.cite.substring(0, 300) : '') + '</span></div>'; h += '</div>'; break; } }
    if (!h) h = '<div style="color:#807868;font-size:0.28rem">No deep content</div>';
    return h;
  }


  // ── ANCHOR DIRECTIVE ──

  function renderAnchorDirective(state) {
    var opps = state.opportunities || [];
    var anchor = null;
    var bestProofScore = -1;
    var hasActiveDx = (state.diagnoses || []).some(function (d) { return d.active; });
    for (var i = 0; i < opps.length; i++) {
      var o = opps[i];
      if (o.source !== 'portal_directive' || !o._directive) continue;
      var econRel = (o.scores && o.scores.econRelevance != null) ? o.scores.econRelevance : 0.5;
      if (hasActiveDx && econRel < 0.3) continue;
      var displayScore = (o.rank || 0) * 0.35 + (o._richness || 0) * 0.10 + (o._stepsArePortalNative ? 0.12 : 0) + econRel * 0.15;
      if (o._deepIntel && o._deepIntel.monitoring) displayScore += 0.08;
      if (o._deepIntel && o._deepIntel.citations && o._deepIntel.citations.length > 0) displayScore += 0.08;
      if (displayScore > bestProofScore) { bestProofScore = displayScore; anchor = o; }
    }
    if (!anchor) {
      for (var ni = 0; ni < opps.length; ni++) {
        if ((opps[ni].rank || 0) > bestProofScore) { bestProofScore = opps[ni].rank || 0; anchor = opps[ni]; }
      }
    }
    if (!anchor) return '';
    var mc = anchor.moneyChain || {};
    var dir = anchor._directive || {};
    var companies = anchor.examples || [];
    var steps = anchor.steps || [];
    var h = '<div class="eos-anchor">';
    h += '<div class="eos-anchor-label">TOP DIRECTIVE \u2014 ACTION NOW';
    if (anchor._mechanism && anchor._mechanism.primaryLabel) {
      h += ' <span style="margin-left:8px;padding:2px 6px;border:1px solid rgba(90,181,160,0.3);border-radius:2px;color:#5ab5a0;font-size:0.22rem;font-weight:600;letter-spacing:1px">' + esc(anchor._mechanism.primaryLabel.toUpperCase()) + '</span>';
    }
    h += '</div>';
    h += '<div class="eos-anchor-title">' + esc(anchor.title) + '</div>';
    var explain = anchor.explain || mc.doThis || '';
    if (explain) h += '<div class="eos-anchor-explain">' + esc(explain) + '</div>';
    h += renderMechanismBlock(anchor, 'anchor');
    h += '<div class="eos-anchor-grid">';
    h += '<div class="eos-anchor-block">';
    var stepsLabel = anchor._stepsArePortalNative ? 'WHAT TO DO \u00b7 PORTAL-DERIVED' : 'WHAT TO DO \u00b7 OPERATOR SYNTHESIS';
    h += '<div class="eos-anchor-block-label">' + stepsLabel + '</div>';
    h += '<div class="eos-anchor-block-text">';
    if (steps.length > 0) {
      for (var si = 0; si < Math.min(steps.length, 5); si++) {
        var stepText = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || steps[si].label || '');
        h += '<div class="eos-anchor-step"><b>' + (si + 1) + '.</b> ' + esc(stepText) + '</div>';
      }
    } else if (mc.doThis) { h += esc(mc.doThis); }
    else { h += esc(anchor.action || 'Execute via operator pathway'); }
    h += '</div></div>';
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">WHO TO TARGET</div>';
    h += '<div class="eos-anchor-block-text">';
    var rt = anchor._resolvedTargets;
    if (rt) {
      if (rt.tier2 && rt.tier2.length > 0) { for (var t2i = 0; t2i < rt.tier2.length; t2i++) { h += '<div style="padding:2px 0;color:#d0c8b8">\u25B8 ' + esc(rt.tier2[t2i].label) + '</div>'; } }
      if (rt.tier1 && rt.tier1.length > 0) { h += '<div style="margin-top:4px;font-size:0.30rem;color:rgba(201,169,78,0.7);letter-spacing:1px">VERIFIED</div>'; for (var t1i = 0; t1i < rt.tier1.length; t1i++) { h += '<div style="padding:1px 0;color:#e0daca">' + esc(rt.tier1[t1i].name) + (rt.tier1[t1i].ticker ? ' <span style="color:#C9A94E">(' + esc(rt.tier1[t1i].ticker) + ')</span>' : '') + '</div>'; } }
      if (rt.tier3 && rt.tier3.length > 0) { h += '<div style="margin-top:4px;font-size:0.30rem;color:rgba(90,181,160,0.6);letter-spacing:1px">ALSO CONSIDER</div>'; for (var t3i = 0; t3i < Math.min(rt.tier3.length, 4); t3i++) { h += '<div style="padding:1px 0;color:#b0a898">' + esc(rt.tier3[t3i].name) + (rt.tier3[t3i].ticker ? ' (' + esc(rt.tier3[t3i].ticker) + ')' : '') + '</div>'; } }
      if (rt.executionTargets && rt.executionTargets.length > 0) { h += '<div style="margin-top:4px;font-size:0.28rem;color:#908878">Execute via: ' + rt.executionTargets.join(', ') + '</div>'; }
    } else {
      if (companies.length > 0) { for (var ci = 0; ci < Math.min(companies.length, 5); ci++) { h += '<div style="padding:1px 0">' + esc(companies[ci]) + '</div>'; } }
      if (mc.target) h += '<div style="margin-top:3px;color:#a09888;font-size:0.30rem">' + esc(mc.target) + '</div>';
      if (!companies.length && !mc.target) h += 'See mapped targets in action queue';
    }
    h += '</div></div>';
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">HOW MONEY IS MADE</div>';
    h += '<div class="eos-anchor-block-text">';
    if (mc.whyPays) h += esc(mc.whyPays);
    else h += esc(anchor.outcome || anchor.valueRange || 'See monetization path in expanded view');
    h += '</div></div>';
    h += '<div class="eos-anchor-block">';
    h += '<div class="eos-anchor-block-label">TIMING</div>';
    h += '<div class="eos-anchor-block-text">';
    h += esc(mc.timing || anchor.window || 'Active now');
    h += '</div></div>';
    h += '</div>'; // close grid

    // SOURCE INTELLIGENCE BLOCK
    h += '<div style="margin-top:8px;padding:6px 10px;border:1px solid rgba(74,143,212,0.12);border-radius:2px;background:rgba(74,143,212,0.02);font-size:0.28rem">';
    h += '<div style="color:rgba(74,143,212,0.7);letter-spacing:1.5px;font-weight:600;margin-bottom:4px">SOURCE INTELLIGENCE</div>';
    var depthStr = dir.depth != null ? 'L' + dir.depth : 'L0';
    var richStr = anchor._richness || 0;
    var nativeStr = anchor._stepsArePortalNative ? 'portal-native' : 'operator-synthesized';
    var deepFields = [];
    if (anchor._deepIntel) {
      if (anchor._deepIntel.monitoring) deepFields.push('monitoring');
      if (anchor._deepIntel.escalation) deepFields.push('escalation');
      if (anchor._deepIntel.citations && anchor._deepIntel.citations.length > 0) deepFields.push(anchor._deepIntel.citations.length + ' citations');
      if (anchor._deepIntel.targetPathway) deepFields.push('strategy path');
    }
    h += '<div style="color:#b0a898;line-height:1.6">';
    h += '<span style="color:#d0c8b8">Depth:</span> ' + depthStr + ' \u00b7 ';
    h += '<span style="color:#d0c8b8">Steps:</span> ' + nativeStr + ' \u00b7 ';
    h += '<span style="color:#d0c8b8">Richness:</span> ' + richStr + '/5';
    if (deepFields.length > 0) h += ' \u00b7 <span style="color:#d0c8b8">Has:</span> ' + deepFields.join(', ');
    if (dir.portalTitle) h += '<br><span style="color:#d0c8b8">Source:</span> ' + esc(dir.portalTitle) + ' (' + depthStr + ')';
    else if (dir.portalDomainId) h += '<br><span style="color:#d0c8b8">Source:</span> ' + esc(dir.portalDomainId) + ' (' + depthStr + ')';
    if (dir.ancestryPath && dir.ancestryPath.length > 1) h += '<br><span style="color:#d0c8b8">Lineage:</span> ' + dir.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ');
    if (dir.nodeLabel || dir.nodeId) h += '<br><span style="color:#d0c8b8">Brain node:</span> ' + esc(dir.nodeLabel || '') + (dir.nodeId ? ' (' + esc(dir.nodeId) + ')' : '');
    h += '</div></div>';

    h += renderDeepIntel(anchor, 'DEEP INTELLIGENCE');
    h += renderDrillDeeper(anchor);

    var lineageParts = [];
    if (anchor.diagnosisId) lineageParts.push(esc((anchor.diagnosisId || '').replace(/_/g, ' ')));
    if (dir.nodeLabel) lineageParts.push(esc(dir.nodeLabel));
    if (dir.portalTitle) lineageParts.push(esc(dir.portalTitle));
    if (dir.depth != null) lineageParts.push('L' + dir.depth);
    if (dir.rankScore != null) lineageParts.push('score ' + dir.rankScore);
    if (lineageParts.length > 0) h += '<div class="eos-anchor-lineage">\u25B8 ' + lineageParts.join(' \u2192 ') + '</div>';

    h += '</div>';
    return h;
  }

  // ── DEEP PROOF BLOCK ──

  function renderDeepProofBlock(state) {
    var opps = state.opportunities || [];
    var deep = null;
    var bestScore = -1;
    for (var i = 0; i < opps.length; i++) {
      var o = opps[i];
      if (o.source !== 'portal_directive' || !o._directive) continue;
      var depth = (o._directive.depth != null) ? o._directive.depth : 0;
      if (depth < 2) continue;
      var score = depth * 0.2 + (o._richness || 0) * 0.15 + (o._stepsArePortalNative ? 0.2 : 0) + (o.rank || 0) * 0.3;
      if (o._deepIntel && o._deepIntel.monitoring) score += 0.1;
      if (o._deepIntel && o._deepIntel.citations && o._deepIntel.citations.length > 0) score += 0.1;
      if (score > bestScore) { bestScore = score; deep = o; }
    }
    if (!deep) return '';
    var dir = deep._directive || {};
    var mc = deep.moneyChain || {};
    var steps = deep.steps || [];
    var depthStr = 'L' + (dir.depth != null ? dir.depth : '?');
    var nativeStr = deep._stepsArePortalNative ? 'portal-native' : 'operator-synthesized';
    var h = '<div class="eos-deepproof">';
    h += '<div class="eos-deepproof-label">DEEP PROOF \u2014 FRACTAL INTELLIGENCE';
    if (deep._mechanism && deep._mechanism.primaryLabel) {
      h += ' <span style="margin-left:8px;padding:2px 6px;border:1px solid rgba(74,143,212,0.3);border-radius:2px;color:rgba(74,143,212,0.9);font-size:0.22rem;font-weight:600;letter-spacing:1px">' + esc(deep._mechanism.primaryLabel.toUpperCase()) + '</span>';
    }
    h += '</div>';
    h += '<div class="eos-deepproof-title">' + esc(deep.title) + '</div>';
    if (mc.whyPays) h += '<div class="eos-deepproof-why">' + esc(mc.whyPays) + '</div>';
    if (steps.length > 0) {
      h += '<div style="margin-bottom:8px">';
      for (var si = 0; si < Math.min(steps.length, 5); si++) {
        var stepText = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || '');
        h += '<div style="font-size:0.30rem;color:#c0b8a5;padding:1px 0"><b>' + (si + 1) + '.</b> ' + esc(stepText) + '</div>';
      }
      h += '</div>';
    }
    h += renderMechanismBlock(deep, 'deep');
    h += '<div style="font-size:0.28rem;color:#b0a898;line-height:1.6;margin-top:8px;padding-top:6px;border-top:1px solid rgba(74,143,212,0.12)">';
    h += '<div style="font-size:0.22rem;letter-spacing:1.5px;color:rgba(74,143,212,0.7);font-weight:600;margin-bottom:4px">SOURCE INTELLIGENCE</div>';
    h += '<span style="color:rgba(74,143,212,0.8)">Depth:</span> ' + depthStr + ' \u00b7 <span style="color:rgba(74,143,212,0.8)">Steps:</span> ' + nativeStr + ' \u00b7 <span style="color:rgba(74,143,212,0.8)">Richness:</span> ' + (deep._richness || 0) + '/5';
    if (dir.ancestryPath && dir.ancestryPath.length > 0) h += '<br><span style="color:rgba(74,143,212,0.8)">Lineage:</span> ' + dir.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ');
    if (dir.portalDomainId) h += '<br><span style="color:rgba(74,143,212,0.8)">Source portal:</span> ' + esc(dir.portalDomainId);
    if (dir.nodeLabel || dir.nodeId) h += '<br><span style="color:rgba(74,143,212,0.8)">Brain node:</span> ' + esc(dir.nodeLabel || '') + (dir.nodeId ? ' (' + esc(dir.nodeId) + ')' : '');
    h += '</div>';
    h += renderDeepIntel(deep, 'EXPAND DEEP INTELLIGENCE');
    h += renderDrillDeeper(deep);
    h += '</div>';
    return h;
  }

  function buildMoneySummary(state) {
    var stress = state.stress || 0;
    var pct = Math.round(stress * 100);
    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var opps = state.opportunities || [];
    var pulse = state.pulse || null;
    var grantCount = opps.filter(function (o) { return o.path === 'GRANT-ELIGIBLE'; }).length;
    var investCount = opps.filter(function (o) { return o.path === 'INVESTABLE'; }).length;
    var patentCount = opps.filter(function (o) { return o.path === 'PATENTABLE'; }).length;

    var h = '';

    // Pulse freshness warning
    if (pulse) {
      var freshPct = Math.round(pulse.freshnessScore * 100);
      if (freshPct < 50) {
        h += '<div style="font-size:0.34rem;color:#e85454;padding:4px 8px;margin-bottom:8px;border:1px solid rgba(232,84,84,0.15);border-radius:2px;background:rgba(232,84,84,0.04)">\u26A0 Feed freshness at ' + freshPct + '% \u2014 some data may be stale. Confidence reduced.</div>';
      }
      var blocked = (pulse.validatedDiagnoses || []).filter(function (v) { return v.blocked; });
      if (blocked.length > 0) {
        h += '<div style="font-size:0.30rem;color:#C9A94E;padding:3px 8px;margin-bottom:6px;border-left:2px solid rgba(201,169,78,0.2)">' + blocked.length + ' diagnosis(es) blocked by evidence contract \u2014 insufficient live evidence to support activation.</div>';
      }
    }

    var text = '<b>Environment domain at ' + pct + '% stress.</b> ';
    if (activeDx.length > 0) {
      text += activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' confirmed. ';
      var primaryDx = activeDx[0];
      var ctx = DX_CONTEXT[(primaryDx.id || '').toUpperCase()];
      if (ctx) text += ctx.what + '. <b>Money move:</b> ' + ctx.step;
    } else {
      text += 'No active diagnoses. Watch for emerging climate, biodiversity, ocean, deforestation, or contamination signals.';
    }

    if (pulse && pulse.regime === 'crisis') {
      text += ' <b style="color:#e85454">Regime: CRISIS.</b> Multiple positioning windows are open.';
    } else if (pulse && pulse.regime === 'elevated') {
      text += ' Regime: ELEVATED. Positioning windows may be forming.';
    }

    var parts = [];
    if (grantCount > 0) parts.push(grantCount + ' grant path' + (grantCount > 1 ? 's' : ''));
    if (investCount > 0) parts.push(investCount + ' investment position' + (investCount > 1 ? 's' : ''));
    if (patentCount > 0) parts.push(patentCount + ' patent opportunit' + (patentCount > 1 ? 'ies' : 'y'));
    if (parts.length > 0) text += ' Currently showing <b>' + parts.join(', ') + '</b> ready for action.';

    if (pulse && pulse.deltas && pulse.deltas.length > 0) {
      h += '<div class="eos-summary">' + text + '</div>';
      h += '<div style="font-size:0.32rem;color:#908878;margin-bottom:10px;padding:4px 8px;border-left:2px solid rgba(90,181,160,0.2)">';
      h += '<span style="font-size:0.26rem;letter-spacing:1.5px;color:rgba(90,181,160,0.5)">SINCE LAST CYCLE:</span> ';
      var deltaTexts = pulse.deltas.slice(0, 3).map(function (d) { return d.detail; });
      h += deltaTexts.join(' \u00b7 ');
      h += '</div>';
    } else {
      h += '<div class="eos-summary">' + text + '</div>';
    }

    return h;
  }

  function buildTopPlays(state) {
    var opps = (state.opportunities || []).slice();
    if (opps.length === 0) return '';
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    var anchorId = null;
    for (var ai = 0; ai < opps.length; ai++) {
      if (opps[ai].source === 'portal_directive' && opps[ai]._directive) { anchorId = opps[ai].id; break; }
    }
    if (anchorId) opps = opps.filter(function (o) { return o.id !== anchorId; });
    var top = opps.slice(0, 3);

    var h = '<div class="eos-plays">';
    for (var i = 0; i < top.length; i++) {
      var o = top[i];
      var title = (o.title || '').replace(/_/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);

      h += '<div class="eos-play">';
      h += '<span class="eos-play-rank">' + (i + 1) + '</span>';
      h += '<div class="eos-play-name">' + esc(title) + '</div>';
      h += '<span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span>';
      if (o.paths && o.paths.indexOf('BUSINESS') !== -1) h += ' <span class="eos-play-path" style="color:#C9A94E;border:1px solid rgba(201,169,78,0.25);background:rgba(201,169,78,0.06)">BUSINESS</span>';
      if (o.urgency === 'IMMEDIATE' || o.urgency === 'high') h += ' <span style="font-size:0.26rem;color:#e85454;letter-spacing:1px">URGENT</span>';
      h += promotedBadge(o);

      // Compensation strip
      var comp = o.compensation || {};
      h += '<div style="font-size:0.28rem;color:#5ab5a0;margin:3px 0">PAY: ' + (comp.base || 0) + (comp.unit || '%') + ' \u00b7 NEXT: ' + (comp.nextTier ? comp.nextTier.comp + (comp.unit || '%') : '?') + ' \u00b7 MAX: ' + (comp.maxTier ? comp.maxTier.comp + (comp.unit || '%') : '?') + '</div>';

      // WHY THIS MAKES MONEY
      if (o.moneyChain) {
        h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.15)">';
        h += '<b style="color:#C9A94E">WHY THIS MAKES MONEY:</b><br>';
        if (o.moneyChain.doThis) h += '<span style="color:#d0c8b8">Do this:</span> ' + esc(o.moneyChain.doThis) + '<br>';
        if (o.moneyChain.whyPays) h += '<span style="color:#d0c8b8">Why it pays:</span> ' + esc(o.moneyChain.whyPays) + '<br>';
        if (o.moneyChain.target) h += '<span style="color:#d0c8b8">Target:</span> ' + esc(o.moneyChain.target) + '<br>';
        if (o.moneyChain.timing) h += '<span style="color:#d0c8b8">Timing:</span> ' + esc(o.moneyChain.timing) + '<br>';
        if (o.moneyChain.evidence) h += '<span style="color:#d0c8b8">Evidence:</span> ' + esc(o.moneyChain.evidence);
        h += '</div>';
      } else {
        var dxId = (o.diagnosisId || '').toUpperCase();
        var ctx = DX_CONTEXT[dxId] || null;
        if (ctx) {
          h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.15)">';
          h += '<b style="color:#C9A94E">WHY THIS MAKES MONEY:</b><br>';
          h += '<span style="color:#d0c8b8">' + esc(ctx.money) + '</span>';
          h += '</div>';
        } else {
          h += '<div class="eos-play-why">' + esc(o.explain || o.title) + '</div>';
        }
      }
      h += '<div class="eos-play-outcome">Expected: ' + esc(o.valueRange || o.outcome || 'See playbook detail') + '</div>';

      // Collapsible detail
      if (o.explain || o.steps || o.failure) {
        h += '<div style="margin-top:6px;border-top:1px solid rgba(201,169,78,0.06);padding-top:4px">';
        h += '<details style="font-size:0.32rem;color:#908878">';
        h += '<summary style="cursor:pointer;color:rgba(201,169,78,0.5);font-size:0.26rem;letter-spacing:1.5px">DETAIL \u25BC</summary>';
        if (o.action) h += '<div style="margin:4px 0"><b style="color:#b0a898">ACTION:</b> ' + esc(o.action) + '</div>';
        if (o.trigger) h += '<div style="margin:4px 0"><b style="color:#b0a898">TRIGGER:</b> ' + esc(o.trigger) + '</div>';
        if (o.validation) h += '<div style="margin:4px 0"><b style="color:#b0a898">VALIDATION:</b> ' + esc(o.validation) + '</div>';
        if (o.steps && o.steps.length > 0) {
          h += '<div style="margin:4px 0"><b style="color:#b0a898">EXECUTION:</b></div>';
          for (var sti = 0; sti < o.steps.length; sti++) h += '<div style="padding-left:8px;color:#a09888">' + (sti + 1) + '. ' + esc(o.steps[sti]) + '</div>';
        }
        if (o.outcome) h += '<div style="margin:4px 0"><b style="color:#5ab5a0">OUTCOME:</b> ' + esc(o.outcome) + '</div>';
        if (o.failure) h += '<div style="margin:4px 0"><b style="color:#e85454">FAILURE:</b> ' + esc(o.failure) + '</div>';
        if (o.window) h += '<div style="margin:4px 0"><b style="color:#807868">WINDOW:</b> ' + esc(o.window) + '</div>';
        if (o.fastPath && o.fastPath.length > 0) {
          h += '<div style="margin:6px 0;padding:4px 8px;background:rgba(90,181,160,0.03);border-left:2px solid rgba(90,181,160,0.2)">';
          h += '<div style="font-size:0.24rem;letter-spacing:1.5px;color:rgba(90,181,160,0.5);margin-bottom:2px">FAST PATH</div>';
          for (var fpi = 0; fpi < o.fastPath.length; fpi++) h += '<div style="color:#a09888">' + esc(o.fastPath[fpi]) + '</div>';
          h += '</div>';
        }
        if (o.examples && o.examples.length > 0) {
          h += '<div style="margin:4px 0"><b style="color:#807868">EXAMPLES:</b> ' + o.examples.map(function (ex) { return esc(ex); }).join(' \u00b7 ') + '</div>';
        }
        h += '</details></div>';
      }

      // Deep Intelligence for promoted directives
      if (o.source === 'portal_directive') {
        if (o._mechanism && o._mechanism.primary) {
          var dxEx = (MECH_EXPLAIN[(o.diagnosisId || '').toUpperCase()] || {})[o._mechanism.primary] || MECH_FALLBACK[o._mechanism.primary];
          if (dxEx) {
            h += '<div style="font-size:0.30rem;color:#b0a898;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.12)"><b style="color:rgba(201,169,78,0.7)">' + esc(o._mechanism.primaryLabel) + ':</b> ' + esc(dxEx.move) + '</div>';
          }
        }
        h += renderDeepIntel(o, 'MORE INTELLIGENCE');
      }

      // Suggested targets for INVEST plays
      if (o.path === 'INVESTABLE') {
        var pbId = o.playbookId || resolvePlaybookId(o);
        if (pbId) h += renderTargets(pbId);
      }
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function buildActionQueue(state) {
    var opps = (state.opportunities || []).slice();

    // Merge claimed opportunities from ledger
    var ledger = window.LIMENClaimLedger;
    if (ledger) {
      var claims = ledger.getClaimsByDomain('environment');
      var oppIds = {};
      for (var oi = 0; oi < opps.length; oi++) oppIds[opps[oi].id || oppKey(opps[oi])] = true;
      for (var ci = 0; ci < claims.length; ci++) {
        var claim = claims[ci];
        if (claim.status === 'closed') continue;
        if (oppIds[claim.opportunityId]) continue;
        opps.push({
          id: claim.opportunityId,
          title: claim.title,
          path: claim.path || 'GRANT-ELIGIBLE',
          urgency: 'WATCH',
          rank: 0.1,
          source: 'claimed_preserved',
          tier: 3,
          stress: 0,
          domain: 'environment',
          explain: 'This opportunity was claimed but is no longer supported by live feed data. Complete or close your claim.',
          action: 'Review claim status. If still valid, continue execution. If no longer relevant, record outcome and close.',
          _preserved: true
        });
      }
    }

    if (opps.length === 0) return '';
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    var statuses = getStatusMap();

    var h = '<table class="eos-queue"><thead><tr><th>#</th><th>OPPORTUNITY</th><th>PATH</th><th>WHY THIS MAKES MONEY</th><th>NEXT STEP</th></tr></thead><tbody>';

    for (var i = 0; i < opps.length; i++) {
      var o = opps[i];
      var key = o.id || oppKey(o);
      var currentStatus = statuses[key] || 'NEW';
      var title = (o.title || '').replace(/_/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);

      var whyFull = o.explain || o.action || o.title;
      var mc = o.moneyChain || null;
      var step = o.action || (o.fastPath && o.fastPath.length > 0 ? o.fastPath[0] : 'Open detail for execution steps');

      var statusHTML = '';
      var STATUSES = ['NEW', 'WIP', 'DONE', 'WATCH'];
      var STATUS_CLASS = { 'NEW': 'active-new', 'WIP': 'active-wip', 'DONE': 'active-done', 'WATCH': 'active-watch' };
      for (var si = 0; si < STATUSES.length; si++) {
        var st = STATUSES[si];
        statusHTML += '<button class="eos-status-btn' + (currentStatus === st ? ' ' + STATUS_CLASS[st] : '') +
          '" data-key="' + esc(key) + '" data-status="' + st + '">' + st + '</button>';
      }

      // Build collapsible WHY THIS MAKES MONEY cell
      var whyCell = '<div class="money-thesis-cell">';
      whyCell += '<div class="money-thesis-preview">' + esc(whyFull) + '</div>';
      whyCell += '<div class="money-thesis-expanded hidden">' + esc(whyFull);
      if (mc) {
        whyCell += '<div class="money-thesis-detail">';
        if (mc.doThis) whyCell += '<span class="mtd-label">DO THIS</span>' + esc(mc.doThis);
        if (mc.whyPays) whyCell += '<span class="mtd-label">WHY THIS PAYS</span>' + esc(mc.whyPays);
        if (mc.target) whyCell += '<span class="mtd-label">TARGET</span>' + esc(mc.target);
        if (mc.timing) whyCell += '<span class="mtd-label">TIMING</span>' + esc(mc.timing);
        if (mc.invalidIf) whyCell += '<span class="mtd-label">INVALID IF</span>' + esc(mc.invalidIf);
        if (mc.evidence) whyCell += '<span class="mtd-label">EVIDENCE</span>' + esc(mc.evidence);
        if (mc.nextStep) whyCell += '<span class="mtd-label">NEXT STEP</span>' + esc(mc.nextStep);
        whyCell += '</div>';
      }
      if (o.source === 'portal_directive' && o._deepIntel) {
        whyCell += renderDeepIntel(o, 'PORTAL INTELLIGENCE');
      }
      whyCell += '</div>';
      whyCell += '<button class="money-thesis-toggle" onclick="this.previousElementSibling.classList.toggle(\'hidden\');this.parentElement.querySelector(\'.money-thesis-preview\').style.display=this.previousElementSibling.classList.contains(\'hidden\')?\'\':\'none\';this.textContent=this.previousElementSibling.classList.contains(\'hidden\')?\'MORE\':\'LESS\'">MORE</button>';
      whyCell += '</div>';

      h += '<tr' + (o.urgency === 'IMMEDIATE' || o.urgency === 'high' ? ' style="border-left:2px solid #e85454"' : '') + '>';
      h += '<td class="eos-queue-pri">' + (i + 1) + '</td>';
      h += '<td class="eos-queue-name">' + esc(title) + promotedBadge(o) + '</td>';
      h += '<td><span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span></td>';
      h += '<td class="eos-queue-why">' + whyCell + '</td>';
      h += '<td class="eos-queue-step">' + esc(step) + '</td>';
      h += '</tr>';
      // Action button row
      h += '<tr><td colspan="5" style="padding:0;border-bottom:1px solid rgba(255,255,255,0.04)"><div class="eos-action-row">' + statusHTML;
      var pbId = (o.path === 'INVESTABLE') ? resolvePlaybookId(o) : null;
      if (pbId) {
        h += '<button class="eos-invest-btn" data-pb-id="' + esc(pbId) + '" data-opp-title="' + esc(title) + '">INVEST \u2192</button>';
      }
      // removed: GRANT/PATENT/BUILD workspace buttons — lanes dropped
      if (o.compensation) {
        h += '<span style="font-size:0.22rem;color:#5ab5a0;white-space:nowrap">' + (o.compensation.base || 0) + (o.compensation.unit || '%') + '\u2192' + (o.compensation.maxTier ? o.compensation.maxTier.comp : '?') + (o.compensation.unit || '%') + '</span>';
      }
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'environment') : null;
      if (_claimExisting) {
        h += '<span class="eos-status-btn" style="color:#5ab5a0;border-color:rgba(90,181,160,0.2);cursor:default">\u2713 CLAIMED</span>';
      } else {
        h += '<button class="eos-invest-btn" style="color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.06)" data-claim-opp="' + esc(o.id || key) + '">CLAIM</button>';
      }
      h += '</div></td></tr>';
    }
    h += '</tbody></table>';
    return h;
  }

  function renderMoneyPlays(state) {
    var opps = state.opportunities || [];
    if (opps.length === 0) return '<div class="eos-quiet">No opportunities surfaced yet. Brain is still ingesting feeds.</div>';

    // Exclude the #1 promoted directive (already shown as the Anchor Directive card)
    var anchorId = null;
    for (var ai = 0; ai < opps.length; ai++) {
      if (opps[ai].source === 'portal_directive' && opps[ai]._directive) { anchorId = opps[ai].id; break; }
    }
    if (anchorId) opps = opps.filter(function (o) { return o.id !== anchorId; });
    var top = opps.slice(0, 6);
    var h = '<div class="eos-plays">';
    for (var i = 0; i < top.length; i++) {
      var o = top[i];
      var dxId = (o.diagnosisId || '').toUpperCase();
      var ctx = DX_CONTEXT[dxId] || null;
      var pbId = o.playbookId || resolvePlaybookId(o);

      h += '<div class="eos-play">';
      h += '<span class="eos-play-rank">' + (i + 1) + '</span>';
      h += '<div class="eos-play-name">' + esc(o.title || '') + promotedBadge(o) + '</div>';
      h += '<span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span>';
      if (o.urgency === 'IMMEDIATE' || o.urgency === 'high') h += ' <span style="font-size:0.26rem;color:#e85454;letter-spacing:1px;margin-left:4px">URGENT</span>';

      // WHY THIS MAKES MONEY — from DX_CONTEXT
      if (o.moneyChain) {
        h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.15)">';
        h += '<b style="color:#C9A94E">WHY THIS MAKES MONEY:</b><br>';
        if (o.moneyChain.doThis) h += '<span style="color:#d0c8b8">Do this:</span> ' + esc(o.moneyChain.doThis) + '<br>';
        if (o.moneyChain.whyPays) h += '<span style="color:#d0c8b8">Why it pays:</span> ' + esc(o.moneyChain.whyPays) + '<br>';
        if (o.moneyChain.target) h += '<span style="color:#d0c8b8">Target:</span> ' + esc(o.moneyChain.target) + '<br>';
        if (o.moneyChain.timing) h += '<span style="color:#d0c8b8">Timing:</span> ' + esc(o.moneyChain.timing);
        h += '</div>';
      } else if (ctx) {
        h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.15)">';
        h += '<b style="color:#C9A94E">WHY THIS MAKES MONEY:</b><br>';
        h += '<span style="color:#d0c8b8">' + esc(ctx.money) + '</span>';
        h += '</div>';
        h += '<div style="font-size:0.30rem;color:#908878;line-height:1.4;margin:2px 0;padding:2px 8px">';
        h += '<b style="color:#b0a898">STEP:</b> ' + esc(ctx.step);
        h += '</div>';
      } else {
        h += '<div class="eos-play-why">' + esc(o.explain || o.title || '') + '</div>';
      }
      h += '<div class="eos-play-outcome">Expected: ' + esc(o.valueRange || (ctx ? ctx.outcome : '') || o.outcome || 'See diagnosis detail') + '</div>';

      // Mechanism block if available
      h += renderMechanismBlock(o, 'play');

      // INVEST targets if this is an INVESTABLE play
      if (o.path === 'INVESTABLE' && pbId) {
        var targets = INVEST_TARGETS[pbId];
        if (targets && targets.length > 0) {
          h += '<div style="margin-top:6px;padding:4px 8px;border-top:1px solid rgba(201,169,78,0.06)">';
          h += '<div style="font-size:0.24rem;letter-spacing:1.5px;color:rgba(201,169,78,0.5);margin-bottom:3px">SUGGESTED TARGETS \u00b7 ' + targets.length + '</div>';
          for (var ti = 0; ti < Math.min(targets.length, 5); ti++) {
            var t = targets[ti];
            h += '<div style="font-size:0.30rem;color:#c0b8a5;padding:1px 0"><span style="color:#C9A94E;font-weight:bold">' + esc(t.ticker) + '</span> ' + esc(t.name) + ' \u2014 <span style="color:#908878">' + esc(t.reason.length > 80 ? t.reason.substring(0, 77) + '...' : t.reason) + '</span></div>';
          }
          if (targets.length > 5) h += '<div style="font-size:0.26rem;color:rgba(201,169,78,0.4);margin-top:2px">+' + (targets.length - 5) + ' more targets</div>';
          h += '</div>';
        }
      }

      if (o.source === 'portal_directive') h += renderDeepIntel(o, 'MORE INTELLIGENCE');
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderActionQueue(state) {
    var opps = state.opportunities || [];
    if (opps.length === 0) return '<div class="eos-quiet">No opportunities in queue.</div>';
    var h = '<table class="eos-queue"><thead><tr>';
    h += '<th>#</th><th>Opportunity</th><th>Path</th><th>Why now</th><th>Window</th>';
    h += '</tr></thead><tbody>';
    for (var i = 0; i < opps.length; i++) {
      var o = opps[i];
      var dxId = (o.diagnosisId || '').toUpperCase();
      var ctx = DX_CONTEXT[dxId] || null;
      var whyText = o.explain || (o.moneyChain && o.moneyChain.whyPays) || (ctx ? ctx.money : '') || '';
      if (whyText.length > 120) whyText = whyText.substring(0, 117) + '...';
      h += '<tr' + (o.urgency === 'IMMEDIATE' || o.urgency === 'high' ? ' style="border-left:2px solid #e85454"' : '') + '>';
      h += '<td class="eos-queue-pri">' + (i + 1) + '</td>';
      h += '<td class="eos-queue-name">' + esc(o.title || '') + promotedBadge(o) + '</td>';
      h += '<td><span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span></td>';
      h += '<td class="eos-queue-why">' + esc(whyText) + '</td>';
      h += '<td>' + esc(o.window || (o.moneyChain && o.moneyChain.timing) || (ctx ? '1-90 days' : '')) + '</td>';
      h += '</tr>';
    }
    h += '</tbody></table>';
    return h;
  }

  function renderOperator() {
    if (!_operatorView) return;
    var state = getState();
    if (!state) {
      _operatorView.innerHTML = '<div class="eos-quiet">Brain not ready. Loading\u2026</div>';
      return;
    }

    var bridge = window.LIMENEnvironmentPromotionBridge;
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('environment') : null;
      if (brain && brain._portalCache) {
        bridge.promote(state, brain._portalCache, { limit: 5 }).then(function (promoted) {
          if (promoted && promoted.length > 0) {
            var freshState = getState();
            if (freshState) _renderOperatorDOM(freshState);
          }
        }).catch(function () {});
      }
    }

    _renderOperatorDOM(state);
  }

  function _renderOperatorDOM(state) {
    if (!_operatorView) return;

    var h = '';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    h += '<div class="eos-title" style="margin-bottom:0">ENVIRONMENT \u00b7 OPERATOR SURFACE</div>';
    h += '<div style="display:flex;gap:6px;align-items:center">';
    h += '<button id="eos-back-to-console" style="font-family:monospace;font-size:0.32rem;letter-spacing:2px;text-transform:uppercase;padding:3px 10px;border:1px solid rgba(201,169,78,0.12);border-radius:2px;background:none;color:rgba(200,195,184,0.35);cursor:pointer;transition:all 0.2s">\u2190 CONSOLE</button>';
    h += '</div></div>';

    // DIAGNOSIS STATUS PANEL
    var allDx = state.diagnoses || [];
    var activeDxList = allDx.filter(function (d) { return d.active; });
    var inactiveDxList = allDx.filter(function (d) { return !d.active; });
    var dxContent = '';
    if (activeDxList.length > 0) {
      for (var adi = 0; adi < activeDxList.length; adi++) {
        var adx = activeDxList[adi];
        dxContent += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.34rem">';
        dxContent += '<span style="color:#5ab5a0">\u25CF ACTIVE</span>';
        dxContent += '<span style="color:#e0daca">' + esc((adx.label || adx.id || '').replace(/_/g, ' ')) + '</span>';
        dxContent += '<span style="color:#807868;font-size:0.28rem">' + Math.round((adx.relevance || 0) * 100) + '% match \u00b7 ' + (adx.matchedConditions || 0) + '/' + (adx.totalTriggers || 0) + ' triggers</span>';
        if (adx.blocked) dxContent += '<span style="color:#e85454;font-size:0.26rem">BLOCKED: ' + esc(adx.blockReason || '') + '</span>';
        if (adx.evidenceReason) dxContent += '<span style="color:#5ab5a0;font-size:0.26rem">' + esc(adx.evidenceReason) + '</span>';
        dxContent += '</div>';
      }
    } else {
      dxContent += '<div style="font-size:0.32rem;color:#908878">No active diagnoses. Watch for emerging climate, biodiversity, ocean, deforestation, or contamination signals.</div>';
    }
    if (inactiveDxList.length > 0) {
      dxContent += '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:0.26rem;color:#706860;letter-spacing:1px">INACTIVE (' + inactiveDxList.length + ') \u25BC</summary>';
      for (var idi = 0; idi < inactiveDxList.length; idi++) {
        var idx = inactiveDxList[idi];
        dxContent += '<div style="font-size:0.30rem;color:#706860;padding:1px 0">\u25CB ' + esc((idx.label || idx.id || '').replace(/_/g, ' ')) + ' \u2014 ' + (idx.matchedConditions || 0) + '/' + (idx.totalTriggers || 0) + ' triggers';
        if (idx.blocked) dxContent += ' <span style="color:#e85454">(blocked)</span>';
        dxContent += '</div>';
      }
      dxContent += '</details>';
    }
    h += wrapCollapsible('diagnosis-status', 'DIAGNOSIS STATUS \u00b7 ' + activeDxList.length + ' ACTIVE \u00b7 ' + inactiveDxList.length + ' INACTIVE', dxContent, false);

    h += buildMoneySummary(state);
    h += renderAnchorDirective(state);
    h += renderDeepProofBlock(state);
    h += wrapCollapsible('top-plays', 'TOP MONEY PLAYS', buildTopPlays(state), false);
    h += wrapCollapsible('action-queue', 'ACTION QUEUE', buildActionQueue(state), false);

    _operatorView.innerHTML = h;

    // Wire back button
    var backBtn = document.getElementById('eos-back-to-console');
    if (backBtn) backBtn.addEventListener('click', switchToConsole);

    // Wire status buttons
    var btns = _operatorView.querySelectorAll('.eos-status-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var key = this.getAttribute('data-key');
        var status = this.getAttribute('data-status');
        setStatus(key, status);
        var row = this.parentNode;
        var siblings = row.querySelectorAll('.eos-status-btn');
        var SC = { 'NEW': 'active-new', 'WIP': 'active-wip', 'DONE': 'active-done', 'WATCH': 'active-watch' };
        for (var j = 0; j < siblings.length; j++) {
          siblings[j].className = 'eos-status-btn' + (siblings[j].getAttribute('data-status') === status ? ' ' + SC[status] : '');
        }
      });
    }

    // Wire INVEST buttons
    var investBtns = _operatorView.querySelectorAll('[data-pb-id]');
    for (var ib = 0; ib < investBtns.length; ib++) {
      investBtns[ib].addEventListener('click', function (e) {
        e.stopPropagation();
        var pbId = this.getAttribute('data-pb-id');
        var oppTitle = this.getAttribute('data-opp-title');
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['environment'], type: 'invest' };

        var state = getState();
        var opps = state ? (state.opportunities || []) : [];
        var matchOpp = null;
        for (var mi = 0; mi < opps.length; mi++) {
          if (opps[mi].playbookId === pbId && opps[mi].path === 'INVESTABLE') { matchOpp = opps[mi]; break; }
        }
        if (!matchOpp) {
          for (var mi2 = 0; mi2 < opps.length; mi2++) {
            if (opps[mi2].title === oppTitle) { matchOpp = opps[mi2]; break; }
          }
        }

        var mc = matchOpp ? (matchOpp.moneyChain || {}) : {};
        var stressPct = matchOpp ? Math.round((matchOpp.stress || 0) * 100) : 0;
        var targets = INVEST_TARGETS[pbId] || [];
        var targetNames = targets.filter(function(t) { return t.cik; }).map(function(t) { return t.ticker + ' (' + t.name + ')'; }).join(', ');

        var branchUp = mc.doThis ? mc.doThis : '';
        if (mc.whyPays) branchUp += (branchUp ? ' ' : '') + mc.whyPays;
        if (targetNames) branchUp += ' Beneficiaries: ' + targetNames + '.';
        if (!branchUp) branchUp = 'Thesis confirmed \u2014 linked companies reprice higher. Stress persists above ' + stressPct + '%, driving procurement and capital allocation to the sector.';

        var branchDown = mc.invalidIf || (matchOpp && matchOpp.failure) || '';
        if (!branchDown) branchDown = 'Stress resolves below 50%. Diagnosis deactivates. Sector tailwind dissipates before positions can capture repricing.';
        if (targetNames) branchDown += ' Reduce exposure in: ' + targetNames + '.';

        var outcome = '';
        if (matchOpp && matchOpp.valueRange) outcome = 'Value range: ' + matchOpp.valueRange + '. ';
        if (matchOpp && matchOpp.outcome) outcome += matchOpp.outcome;
        else if (mc.whyPays) outcome += mc.whyPays;
        if (mc.timing) outcome += ' Timing: ' + mc.timing;
        if (!outcome) outcome = 'Linked companies capture sector premium during sustained stress. Monitor for confirmation and position sizing.';

        var handoff = {
          pb: {
            id: pbId, title: def.title, domains: def.domains, type: def.type,
            explain: matchOpp ? (matchOpp.explain || oppTitle) : oppTitle,
            action: matchOpp ? (matchOpp.action || '') : '',
            valueRange: matchOpp ? (matchOpp.valueRange || '') : '',
            saturation: 'medium',
            trigger: matchOpp ? (matchOpp.trigger || '') : '',
            validation: matchOpp ? (matchOpp.validation || '') : '',
            steps: matchOpp ? (matchOpp.steps || []) : [],
            branch_up: branchUp,
            branch_down: branchDown,
            outcome: outcome,
            failure: matchOpp ? (matchOpp.failure || mc.invalidIf || '') : '',
            window: matchOpp ? (matchOpp.window || '') : '',
            realWorld: {},
            examples: matchOpp ? (matchOpp.examples || []) : [],
            fastPath: matchOpp ? (matchOpp.fastPath || []) : []
          },
          confidence: matchOpp ? (matchOpp.confidence || 50) : 50,
          urgency: matchOpp ? (matchOpp.urgency || 'medium') : 'medium',
          whyNow: oppTitle,
          status: 'active'
        };
        try { sessionStorage.setItem('limen_invest_opp', JSON.stringify(handoff)); } catch (ex) {}
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=environment&returnTo=' + encodeURIComponent('/domain-console?domain=environment');
      });
    }

    // Wire CLAIM buttons
    var claimBtns = _operatorView.querySelectorAll('[data-claim-opp]');
    for (var cb = 0; cb < claimBtns.length; cb++) {
      claimBtns[cb].addEventListener('click', function (e) {
        e.stopPropagation();
        var oppId = this.getAttribute('data-claim-opp');
        var state = getState();
        var opps = state ? (state.opportunities || []) : [];
        var opp = null;
        for (var oi = 0; oi < opps.length; oi++) {
          if ((opps[oi].id || oppKey(opps[oi])) === oppId) { opp = opps[oi]; break; }
        }
        if (!opp || !window.LIMENClaimFlow) return;
        window.LIMENClaimFlow.openClaimModal(opp, 'environment', function (confirmedOpp, estimate) {
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'environment', estimate);
          }
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel
    if (window.LIMENOperatorPanel) window.LIMENOperatorPanel.mount(_operatorView, 'environment');
    if (window.LIMENExecution && window.LIMENExecution.reliabilityPanel) window.LIMENExecution.reliabilityPanel.mount(_operatorView);
    if (window.LIMENExecution && window.LIMENExecution.phase5 && window.LIMENExecution.phase5.opsDashboard) window.LIMENExecution.phase5.opsDashboard.mount(_operatorView);

    // Workload warning
    if (window.LIMENExecution && window.LIMENExecution.phase5 && window.LIMENExecution.phase5.workload) {
      var warnHtml = window.LIMENExecution.phase5.workload.getWarningHtml();
      if (warnHtml) {
        var warnDiv = document.createElement('div');
        warnDiv.innerHTML = warnHtml;
        var firstClaimBtn = _operatorView.querySelector('[data-claim-opp]');
        if (firstClaimBtn && firstClaimBtn.parentNode) firstClaimBtn.parentNode.insertBefore(warnDiv.firstChild, firstClaimBtn);
      }
    }

    // Mount business review
    if (window.LIMENEnvironmentBusinessReview) window.LIMENEnvironmentBusinessReview.mount(_operatorView);
  }

  function switchToOperator() {
    var cv = document.getElementById('clarity-view');
    if (cv) cv.style.display = 'none';
    if (_operatorView) {
      _operatorView.style.display = 'block';
      renderOperator();
    }
    _isOperatorMode = true;
    updateToggleButton();
  }

  function switchToConsole() {
    if (_operatorView) _operatorView.style.display = 'none';
    var cv = document.getElementById('clarity-view');
    if (cv) cv.style.display = '';
    _isOperatorMode = false;
    updateToggleButton();
  }

  function updateToggleButton() {
    var btnC = document.getElementById('chModeConsole');
    var btnO = document.getElementById('chModeOperator');
    if (btnC) { btnC.classList.toggle('active', !_isOperatorMode); }
    if (btnO) { btnO.classList.toggle('active', _isOperatorMode); }
  }

  function boot() {
    injectStyles();

    var cv = document.getElementById('clarity-view');
    if (!cv) return;

    _operatorView = document.createElement('div');
    _operatorView.id = VIEW_ID;
    _operatorView.style.display = 'none';
    cv.parentNode.insertBefore(_operatorView, cv.nextSibling);

    // ACCORDION DELEGATION
    _operatorView.addEventListener('click', function (e) {
      if (e.target.closest('.eos-status-btn') || e.target.closest('button[data-pb-id]') ||
          e.target.closest('button[data-exec-key]') || e.target.closest('button[data-claim-opp]') ||
          e.target.closest('a') || e.target.closest('input') || e.target.closest('select') ||
          e.target.closest('.ebr-btn') || e.target.closest('[data-business-node]')) return;

      var sectionHeader = e.target.closest('.eos-section-header');
      if (sectionHeader) {
        var sid = sectionHeader.getAttribute('data-section');
        var body = _operatorView.querySelector('[data-section-body="' + sid + '"]');
        var toggle = sectionHeader.querySelector('.eos-section-toggle');
        if (body) {
          var nowCollapsed = !body.classList.contains('collapsed');
          body.classList.toggle('collapsed');
          setCollapsed(sid, nowCollapsed);
          if (toggle) toggle.textContent = nowCollapsed ? '\u25B6' : '\u25BC';
        }
        return;
      }

      var targetHeader = e.target.closest('.eos-targets-header');
      if (targetHeader) {
        var tsid = targetHeader.getAttribute('data-section');
        var tbody = _operatorView.querySelector('[data-section-body="' + tsid + '"]');
        var ttoggle = targetHeader.querySelector('span');
        if (tbody) {
          var nowHidden = tbody.style.display !== 'none';
          tbody.style.display = nowHidden ? 'none' : '';
          setCollapsed(tsid, nowHidden);
          if (ttoggle) ttoggle.textContent = nowHidden ? '\u25B6' : '\u25BC';
        }
        return;
      }

      var targetRow = e.target.closest('.eos-target-row');
      if (targetRow) {
        var idx = targetRow.getAttribute('data-target-idx');
        var detail = _operatorView.querySelector('[data-target-detail="' + idx + '"]');
        var arrow = targetRow.querySelector('.eos-target-expand');
        if (detail) {
          detail.classList.toggle('open');
          if (arrow) arrow.textContent = detail.classList.contains('open') ? '\u25B2' : '\u25BC';
        }
        return;
      }

      var drillBtn = e.target.closest('[data-drill-id]');
      if (drillBtn) {
        _handleDrillClick(drillBtn.getAttribute('data-drill-id'), drillBtn.getAttribute('data-node'), drillBtn.getAttribute('data-ancestry'));
        return;
      }

      var loadBranchBtn = e.target.closest('[data-load-branch]');
      if (loadBranchBtn) { _handleLoadBranch(loadBranchBtn.getAttribute('data-load-branch')); return; }
      var portalSourceBtn = e.target.closest('[data-portal-source]');
      if (portalSourceBtn) { _handlePortalSource(portalSourceBtn.getAttribute('data-portal-source')); return; }

      var deepToggle = e.target.closest('.eos-deep-toggle');
      if (deepToggle) {
        var toggleId = deepToggle.getAttribute('data-toggle');
        var deepBody = document.getElementById('deep-' + toggleId);
        if (deepBody) {
          deepBody.classList.toggle('open');
          deepToggle.textContent = deepBody.classList.contains('open') ? '\u25BC' : '\u25B6';
        }
        return;
      }
    });

    var btnConsole = document.getElementById('chModeConsole');
    var btnOperator = document.getElementById('chModeOperator');
    if (btnConsole) {
      btnConsole.addEventListener('click', function () {
        if (_isOperatorMode) switchToConsole();
      });
    }
    if (btnOperator) {
      btnOperator.addEventListener('click', function () {
        if (!_isOperatorMode) switchToOperator();
      });
    }

    _booted = true;

    var _params = new URLSearchParams(window.location.search);
    if (_params.get('mode') === 'operator') switchToOperator();

    console.log('[EnvironmentOperator] Booted \u2014 operator view created, toggle wired');
  }

  var _bootCheck = setInterval(function () {
    var cv = document.getElementById('clarity-view');
    var state = getState();
    var brainRendered = cv && cv.querySelector('#dcb-exec');
    if (brainRendered && state && state.updated > 0) {
      clearInterval(_bootCheck);
      boot();
    }
  }, 300);

})();
