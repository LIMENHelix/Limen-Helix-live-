/**
 * science-clarity-operator.js — Money-Driven Action Surface for Industry / Industry Domain
 *
 * Self-gates: only runs when ?domain=industry or ?domain=research
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
  if (_dom !== 'industry' && _dom !== 'industry') return;

  var VIEW_ID = 'sos-operator-view';
  var STATUS_KEY = 'limen_industry_operator_status';
  var COLLAPSE_KEY = 'limen_industry_collapse_state';
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
    var brain = brains.get('industry');
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

  // ── INDUSTRY-NATIVE LANGUAGE ──

  var DX_CONTEXT = {
    'SUPPLY_CHAIN_COLLAPSE': {
      what: 'Critical inputs, components, or sub-assemblies are unavailable \u2014 silicon wafers, rare earths, speciality alloys, bearings, or long-lead semiconductors \u2014 stalling production lines across multiple end markets',
      money: 'Reshoring, near-shoring, dual-sourcing, strategic inventory buffering, and alternative-material qualification all see compressed timelines. Industrial distributors, third-party logistics, and specialty chemicals with domestic capacity see demand spikes. CHIPS Act and IRA manufacturing credits accelerate.',
      step: 'Track ISM Manufacturing PMI subindices (supplier deliveries, inventories, prices), BLS industrial producer prices, and Section 232 filings. Position in U.S. industrial distributors, domestic specialty chemical producers, and advanced manufacturing primes.',
      outcome: '$25M-$500M reshoring contracts, domestic capacity expansion capex, or dual-source qualification programs'
    },
    'AUTOMATION_FAILURE': {
      what: 'Industrial automation systems (PLCs, SCADA, robotics, CNC, motion control) are failing under rising production volumes, cybersecurity threats, and aging install bases \u2014 triggering unplanned downtime, throughput loss, and capacity constraints',
      money: 'Predictive maintenance platforms, digital twins, industrial IoT, and rip-and-replace modernization programs all see acute demand. OT/ICS cybersecurity vendors (Dragos, Claroty, Nozomi) are pulled in where legacy systems are exposed. Rockwell, Siemens, Emerson, ABB automation orders rise.',
      step: 'Track ISM PMI production subindex, manufacturing capacity utilization (FRED MCUMFN), industrial robot orders (A3 stats), and OT incident reports (Dragos, Claroty). Position in automation primes, OT cyber, and smart-factory SaaS.',
      outcome: '$10M-$1B+ smart-factory modernization programs, predictive maintenance SaaS ARR, and OT cyber contracts'
    },
    'TOXIC_SPILL': {
      what: 'Industrial incidents \u2014 chemical plant releases, refinery leaks, tailings dam failures, pipeline ruptures, train derailments carrying hazardous materials \u2014 trigger emergency response, regulatory investigation, community health crises, and multi-year remediation',
      money: 'Hazardous waste primes, emergency response contractors, environmental engineering firms, and industrial insurance capacity all see immediate demand. EPA CERCLA / RCRA / CWA enforcement accelerates. State AGs pursue producers under public-nuisance theories.',
      step: 'Track EPA ECHO enforcement actions, NTSB incident reports, PHMSA pipeline incidents, and state environmental agency notices. Position in hazardous waste (Clean Harbors, Republic Services), engineering primes (AECOM, Jacobs, Tetra Tech), and industrial insurance (AIG, Chubb, Zurich).',
      outcome: '$10M-$2B+ emergency response and remediation contracts, multi-year Superfund task orders'
    },
    'QUALITY_CRISIS': {
      what: 'Recalls, field failures, and quality defects cascade across product lines \u2014 automotive, aerospace, consumer products, medical devices \u2014 forcing warranty reserves, brand repricing, class actions, and regulatory mandates for quality system overhauls',
      money: 'Quality management systems (QMS), test-and-measurement vendors, metrology labs, ISO 9001 / AS9100 / IATF 16949 certification bodies, and quality consulting firms all benefit. Contract manufacturers with strong QC track records gain share from competitors forced into recalls.',
      step: 'Track NHTSA recalls, CPSC recalls, FDA medical device MDR, FAA airworthiness directives, and earnings-call warranty reserve changes. Position in QMS software (MasterControl, ETQ Reliance, AssurX), metrology (Mettler-Toledo, Keysight, FLIR), and contract manufacturers.',
      outcome: '$5M-$500M QMS implementation contracts, warranty remediation work, and certification audit revenue'
    },
    'WORKFORCE_SHORTAGE': {
      what: 'Skilled-trade labor shortages (welders, machinists, electricians, pipefitters, industrial technicians) and strike activity are constraining production output; apprenticeship pipelines are insufficient to fill the gap',
      money: 'Industrial staffing agencies, apprenticeship program providers, automation (as labor substitute), and labor-retention software all benefit. Unionized-trade contractors gain bargaining power. Workforce development programs funded by CHIPS / IRA / IIJA accelerate.',
      step: 'Track BLS JOLTS (manufacturing quit and openings rates), USDL apprenticeship enrollment, UAW / USW / Teamsters strike activity, and manufacturing wage growth (FRED CES3000000003). Position in industrial staffing (Kelly Services, ManpowerGroup), automation (Rockwell, Fanuc, ABB), and workforce tech.',
      outcome: 'Sustained staffing fees, $5M-$100M apprenticeship program contracts, automation-for-labor-substitution capex'
    }
  };

  var PATH_LABELS = { 'PATENTABLE': 'PATENT', 'GRANT-ELIGIBLE': 'GRANT', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'PATENTABLE': 'eos-path-patent', 'GRANT-ELIGIBLE': 'eos-path-grant', 'INVESTABLE': 'eos-path-invest' };
  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  var DX_TO_PLAYBOOK = {
    'SUPPLY_CHAIN_COLLAPSE': 'ind_supply',
    'AUTOMATION_FAILURE':    'ind_automation',
    'TOXIC_SPILL':           'ind_safety',
    'QUALITY_CRISIS':        'ind_quality',
    'WORKFORCE_SHORTAGE':    'ind_workforce'
  };

  var INVEST_TARGETS = {
    'ind_supply': [
      { ticker: 'FAST', name: 'Fastenal',                       cik: '815556',  validation: 'HELIX_VALIDATED', reason: 'Largest U.S. industrial distributor of fasteners and MRO supplies; Onsite program embeds into manufacturing plants' },
      { ticker: 'GWW',  name: 'W. W. Grainger',                 cik: '277135',  validation: 'HELIX_VALIDATED', reason: 'Largest North American MRO distributor; reshoring beneficiary with ~1.5M active customers' },
      { ticker: 'MSM',  name: 'MSC Industrial Direct',          cik: '1003078', validation: 'DOMAIN_MAPPED',   reason: 'Metalworking and MRO distributor serving 400K+ industrial customers; class II cutting tools and abrasives' },
      { ticker: 'PKOH', name: 'Park-Ohio Holdings',             cik: '76282',   validation: 'DOMAIN_MAPPED',   reason: 'Supply chain logistics prime serving heavy industry (Ford, Caterpillar, John Deere) with integrated supply programs' },
      { ticker: 'APD',  name: 'Air Products and Chemicals',     cik: '2969',    validation: 'HELIX_VALIDATED', reason: 'Industrial gases (hydrogen, nitrogen, oxygen) \u2014 load-bearing for semiconductor, refining, and metals fabrication' },
      { ticker: 'LIN',  name: 'Linde plc',                      cik: '1707925', validation: 'HELIX_VALIDATED', reason: 'World\u2019s largest industrial gases prime; on-site plant operations at semiconductor fabs and chemical complexes' },
      { ticker: 'CE',   name: 'Celanese',                       cik: '1306830', validation: 'DOMAIN_MAPPED',   reason: 'Specialty chemicals (acetyls, engineered materials) with U.S. Gulf Coast and European production base' },
      { ticker: 'EMN',  name: 'Eastman Chemical',               cik: '915389',  validation: 'DOMAIN_MAPPED',   reason: 'Specialty chemicals and plastics for automotive, construction, durables \u2014 U.S. Gulf Coast vertically integrated' },
      { ticker: 'CBT',  name: 'Cabot Corporation',              cik: '16040',   validation: 'DOMAIN_MAPPED',   reason: 'Carbon black, fumed silica, battery materials \u2014 diversified specialty chemical with deep automotive exposure' },
      { ticker: 'MLM',  name: 'Martin Marietta Materials',      cik: '916076',  validation: 'DOMAIN_MAPPED',   reason: 'Aggregates, cement, ready-mix \u2014 reshoring capex driver; IIJA + CHIPS Act construction demand' },
      { ticker: 'VMC',  name: 'Vulcan Materials',               cik: '1396009', validation: 'DOMAIN_MAPPED',   reason: 'Largest U.S. construction aggregates producer; direct beneficiary of reshoring and infrastructure buildout' },
      { ticker: 'CRH',  name: 'CRH plc',                        cik: '1267091', validation: 'DOMAIN_MAPPED',   reason: 'Global building materials prime; U.S. cement and aggregates exposure to IIJA and reshoring demand' },
      { ticker: 'NUE',  name: 'Nucor',                          cik: '73309',   validation: 'HELIX_VALIDATED', reason: 'Largest U.S. steel producer; electric arc furnace model captures reshoring demand and Section 232 tariffs' },
      { ticker: 'STLD', name: 'Steel Dynamics',                 cik: '1022671', validation: 'HELIX_VALIDATED', reason: 'Mini-mill steel producer with flat-rolled and long-product capacity serving automotive and construction' },
      { ticker: 'XLI',  name: 'Industrial Select Sector SPDR ETF', cik: null,   validation: 'ETF_PROXY',       reason: 'Largest industrial sector ETF \u2014 secondary proxy for U.S. industrial production and capex cycle' }
    ],
    'ind_automation': [
      { ticker: 'ROK',  name: 'Rockwell Automation',            cik: '1024478', validation: 'HELIX_VALIDATED', reason: 'Largest pure-play industrial automation vendor; Logix PLCs, FactoryTalk SCADA, Plex MES are entrenched across U.S. manufacturing' },
      { ticker: 'EMR',  name: 'Emerson Electric',               cik: '32604',   validation: 'HELIX_VALIDATED', reason: 'Process automation prime (DeltaV DCS, AspenTech, Ovation) serving refining, chemicals, pharma, and power generation' },
      { ticker: 'HON',  name: 'Honeywell International',        cik: '773840',  validation: 'HELIX_VALIDATED', reason: 'Experion PKS DCS, Honeywell Forge connected plant, Matrikon OPC \u2014 load-bearing in refining, chemicals, and aerospace manufacturing' },
      { ticker: 'ETN',  name: 'Eaton Corporation',              cik: '31277',   validation: 'HELIX_VALIDATED', reason: 'Industrial electrical and power management; data center and reindustrialization capex beneficiary' },
      { ticker: 'PH',   name: 'Parker Hannifin',                cik: '76334',   validation: 'DOMAIN_MAPPED',   reason: 'Motion and control technologies (hydraulics, pneumatics, filtration, aerospace systems) across industrial platforms' },
      { ticker: 'ITW',  name: 'Illinois Tool Works',            cik: '49826',   validation: 'DOMAIN_MAPPED',   reason: 'Diversified industrial manufacturer (welding, test & measurement, food equipment, specialty products)' },
      { ticker: 'DOV',  name: 'Dover Corporation',              cik: '29905',   validation: 'DOMAIN_MAPPED',   reason: 'Engineered systems (fluids, refrigeration, pumps) serving industrial and commercial end markets' },
      { ticker: 'XYL',  name: 'Xylem',                          cik: '1524472', validation: 'DOMAIN_MAPPED',   reason: 'Water technology prime; industrial water monitoring, smart metering, and treatment systems' },
      { ticker: 'FTV',  name: 'Fortive',                        cik: '1659166', validation: 'DOMAIN_MAPPED',   reason: 'Industrial technology holding (Fluke, Tektronix, Accruent, Gordian) for test, measurement, and facilities' },
      { ticker: 'KEYS', name: 'Keysight Technologies',          cik: '1601046', validation: 'DOMAIN_MAPPED',   reason: 'Electronic design and test for semiconductor, automotive, aerospace manufacturing validation' },
      { ticker: 'TDY',  name: 'Teledyne Technologies',          cik: '1094285', validation: 'DOMAIN_MAPPED',   reason: 'Industrial imaging, digital imaging, instrumentation for manufacturing QC and aerospace' },
      { ticker: 'ROP',  name: 'Roper Technologies',             cik: '882835',  validation: 'DOMAIN_MAPPED',   reason: 'Diversified industrial software and niche industrial hardware; asset-light high-margin operating model' },
      { ticker: 'SIE.DE', name: 'Siemens AG',                   cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Global automation prime (S7/TIA Portal PLCs, SIMATIC PCS 7 DCS, MindSphere industrial IoT) with deep U.S. install base' },
      { ticker: 'ABBN.SW', name: 'ABB Ltd',                     cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Process automation, motion, robotics, electrification \u2014 global top-3 industrial automation vendor' }
    ],
    'ind_safety': [
      { ticker: 'CLH',  name: 'Clean Harbors',                  cik: '822818',  validation: 'HELIX_VALIDATED', reason: 'Largest North American hazardous waste and emergency spill response prime; CleanCo 24/7 response network' },
      { ticker: 'RSG',  name: 'Republic Services',              cik: '1060391', validation: 'DOMAIN_MAPPED',   reason: 'Hazardous waste, industrial cleaning, and environmental services through US Ecology acquisition' },
      { ticker: 'WM',   name: 'Waste Management',               cik: '823768',  validation: 'HELIX_VALIDATED', reason: 'Industrial waste services including landfill gas, industrial recycling, and environmental compliance' },
      { ticker: 'VLTO', name: 'Veralto',                        cik: '1967680', validation: 'HELIX_VALIDATED', reason: 'Water quality and environmental analytics (Hach, ChemTreat, Trojan UV) for industrial spill response' },
      { ticker: 'ECL',  name: 'Ecolab',                         cik: '31462',   validation: 'HELIX_VALIDATED', reason: 'Industrial water, hygiene, and infection prevention chemistry for manufacturing and process industries' },
      { ticker: 'ACM',  name: 'AECOM',                          cik: '868857',  validation: 'HELIX_VALIDATED', reason: 'Environmental engineering prime for Superfund, CERCLA, RCRA, and industrial site remediation' },
      { ticker: 'J',    name: 'Jacobs Solutions',               cik: '52988',   validation: 'HELIX_VALIDATED', reason: 'Industrial environmental engineering and remediation services for federal and private sector clients' },
      { ticker: 'TTEK', name: 'Tetra Tech',                     cik: '831641',  validation: 'HELIX_VALIDATED', reason: 'Environmental consulting prime with deep industrial remediation and regulatory compliance practice' },
      { ticker: 'ERII', name: 'Energy Recovery',                cik: '1421517', validation: 'DOMAIN_MAPPED',   reason: 'Pressure exchange technology for industrial wastewater treatment and chemical processing' },
      { ticker: 'MKSI', name: 'MKS Instruments',                cik: '1049502', validation: 'DOMAIN_MAPPED',   reason: 'Industrial vacuum, photonics, gas analysis \u2014 critical to semiconductor and chemical process safety' },
      { ticker: 'DCI',  name: 'Donaldson Company',              cik: '29644',   validation: 'DOMAIN_MAPPED',   reason: 'Industrial air, liquid, and gas filtration; emissions control products for heavy manufacturing' },
      { ticker: 'AIG',  name: 'American International Group',   cik: '5272',    validation: 'DOMAIN_MAPPED',   reason: 'Industrial and commercial specialty insurance; environmental impairment liability and pollution coverage' }
    ],
    'ind_quality': [
      { ticker: 'DHR',  name: 'Danaher',                        cik: '313616',  validation: 'HELIX_VALIDATED', reason: 'Test & measurement (Fluke, Tektronix via Fortive spin), Beckman Coulter diagnostics \u2014 industrial QA foundation' },
      { ticker: 'MTD',  name: 'Mettler-Toledo',                 cik: '1037646', validation: 'HELIX_VALIDATED', reason: 'Precision instruments, weighing, and analytical lab equipment for industrial metrology and process control' },
      { ticker: 'KEYS', name: 'Keysight Technologies',          cik: '1601046', validation: 'DOMAIN_MAPPED',   reason: 'Electronic test and measurement for semiconductor QA, automotive compliance, and aerospace validation' },
      { ticker: 'A',    name: 'Agilent Technologies',           cik: '1090872', validation: 'HELIX_VALIDATED', reason: 'Analytical instruments (GC, LC, mass spec) for pharmaceutical, chemical, and environmental QA' },
      { ticker: 'TMO',  name: 'Thermo Fisher Scientific',       cik: '97745',   validation: 'HELIX_VALIDATED', reason: 'Analytical instruments and QA reagents for industrial, pharmaceutical, and materials science' },
      { ticker: 'WAT',  name: 'Waters Corporation',             cik: '1000697', validation: 'HELIX_VALIDATED', reason: 'HPLC, mass spec, and Empower chromatography data system \u2014 the QA data backbone for regulated industries' },
      { ticker: 'BRKR', name: 'Bruker',                         cik: '1109354', validation: 'DOMAIN_MAPPED',   reason: 'NMR, mass spec, X-ray for metallurgical, semiconductor, and pharmaceutical materials analysis' },
      { ticker: 'IEX',  name: 'IDEX Corporation',               cik: '832101',  validation: 'DOMAIN_MAPPED',   reason: 'Fluidics, metering, and materials-handling precision products serving quality-critical industrial applications' },
      { ticker: 'ETN',  name: 'Eaton (metrology systems)',      cik: '31277',   validation: 'DOMAIN_MAPPED',   reason: 'Industrial power quality and protection \u2014 upstream driver of manufacturing process quality' },
      { ticker: 'HOLX', name: 'Hologic',                        cik: '859737',  validation: 'DOMAIN_MAPPED',   reason: 'Breast health and diagnostic imaging \u2014 medical device quality process reference as QA benchmark' },
      { ticker: 'ITRI', name: 'Itron',                          cik: '780571',  validation: 'DOMAIN_MAPPED',   reason: 'Smart metering and industrial IoT \u2014 process data foundation for quality monitoring' }
    ],
    'ind_workforce': [
      { ticker: 'MAN',  name: 'ManpowerGroup',                  cik: '871763',  validation: 'DOMAIN_MAPPED',   reason: 'Global industrial staffing prime with Manpower, Experis, Talent Solutions brands serving manufacturing clients' },
      { ticker: 'KFY',  name: 'Korn Ferry',                     cik: '56679',   validation: 'DOMAIN_MAPPED',   reason: 'Global talent advisory \u2014 industrial leadership and skilled-trade placement for manufacturing' },
      { ticker: 'RHI',  name: 'Robert Half',                    cik: '315213',  validation: 'DOMAIN_MAPPED',   reason: 'Specialty staffing for finance, accounting, and technology in industrial clients \u2014 Protiviti consulting arm' },
      { ticker: 'ASGN', name: 'ASGN Incorporated',              cik: '890564',  validation: 'DOMAIN_MAPPED',   reason: 'Technology and government services staffing \u2014 industrial engineering and manufacturing technical talent' },
      { ticker: 'KELYA',name: 'Kelly Services',                 cik: '55135',   validation: 'DOMAIN_MAPPED',   reason: 'Industrial and manufacturing staffing with Kelly Science, Engineering & Technology vertical' },
      { ticker: 'TNET', name: 'TriNet Group',                   cik: '937098',  validation: 'DOMAIN_MAPPED',   reason: 'HR outsourcing for small and mid-cap industrial firms \u2014 benefits, payroll, compliance' },
      { ticker: 'PAYX', name: 'Paychex',                        cik: '723531',  validation: 'DOMAIN_MAPPED',   reason: 'Payroll and HR services for 745K+ clients; heavy small-and-mid-market manufacturing exposure' },
      { ticker: 'ADP',  name: 'Automatic Data Processing',      cik: '8670',    validation: 'DOMAIN_MAPPED',   reason: 'Payroll, HR, and workforce management for industrial enterprises \u2014 large-manufacturer footprint' },
      { ticker: 'ISRG', name: 'Intuitive Surgical (automation proxy)', cik: '1035267', validation: 'DOMAIN_MAPPED', reason: 'Medical robotics leader \u2014 reference point for labor-substituting precision automation in regulated industries' },
      { ticker: 'FANUY',name: 'Fanuc Corporation',              cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Global industrial robotics leader; CNC controllers and factory automation for labor substitution' },
      { ticker: 'ABBN.SW', name: 'ABB Robotics',                cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Top-3 industrial robotics vendor; IRB industrial robots for automotive, electronics, metals fabrication' }
    ]
  };

  // Source-type → playbook ID for non-diagnosis opportunities
  var SOURCE_TO_PLAYBOOK = {
    'company_terminal':  'ind_supply',
    'company_stressed':  'ind_supply',
    'convergence':       'ind_automation',
    'cross_domain':      'ind_supply'
  };

  var PLAYBOOK_DEFS = {
    'ind_supply':     { title: 'Supply Chain & Industrial Materials', domains: ['industry', 'trade'], type: 'invest' },
    'ind_automation': { title: 'Industrial Automation & Smart Factory', domains: ['industry', 'technology'], type: 'invest' },
    'ind_safety':     { title: 'Industrial Safety & Environmental', domains: ['industry', 'environment'], type: 'invest' },
    'ind_quality':    { title: 'Industrial Quality & Metrology', domains: ['industry', 'technology'], type: 'invest' },
    'ind_workforce':  { title: 'Industrial Workforce & Labor', domains: ['industry', 'economy'], type: 'invest' }
  };

  var VAL_LABELS = {
    'HELIX_VALIDATED': { label: 'HELIX VALIDATED', cls: 'eos-val-helix' },
    'NODE_MAPPED':     { label: 'NODE MAPPED',     cls: 'eos-val-node' },
    'DOMAIN_MAPPED':   { label: 'DOMAIN MAPPED',   cls: 'eos-val-domain' },
    'ETF_PROXY':       { label: 'ETF PROXY',       cls: 'eos-val-etf' }
  };

  function resolvePlaybookId(opp) {
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    if (opp.source && SOURCE_TO_PLAYBOOK[opp.source]) return SOURCE_TO_PLAYBOOK[opp.source];
    if (opp.source === 'lagging') return 'ind_supply';
    return null;
  }

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
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Industrial condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

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
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to an Industry portal node. Company-level Helix validation pending.</div>';
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=industry&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '" target="_blank">COMPANY PORTAL</a>';
      if (!t.cik && t.ticker) h += '<a class="eos-target-link" href="company-portal.html?company=' + esc(t.ticker.toLowerCase()) + '" target="_blank">COMPANY PORTAL</a>';
      h += '</div>';
      h += '</div>';
    }

    h += '</div>';
    h += '</div>';
    return h;
  }

  // ── MECHANISM EXPLANATIONS ──

  var MECH_EXPLAIN = {
    'SUPPLY_CHAIN_COLLAPSE': {
      'input_shortage':       { why: 'When critical inputs (chips, rare earths, specialty alloys, long-lead bearings, power semiconductors) run short, entire production lines stall \u2014 not just the affected plant but every downstream customer that needs the output. The 2021-2023 chip shortage pulled $200B+ out of global auto OEM revenue. Fertilizer, silicon, and neon shortages during the Russia-Ukraine conflict repeatedly stalled U.S. and European manufacturers.', move: 'Position in reshoring-beneficiary distributors (Fastenal, Grainger, MSC Industrial), domestic specialty chemical producers (Celanese, Eastman, Cabot), and domestic steel (Nucor, Steel Dynamics) whose capacity is exposed to dual-sourcing and inventory-buffering mandates. Target CHIPS Act, IRA manufacturing credit, and DPA Title III contracts.' },
      'supplier_constraint':  { why: 'Concentrated supply bases \u2014 single-source chemicals, one-mine rare earth processing, monopoly semiconductor foundries \u2014 leave U.S. manufacturers exposed to any disruption at that single point. Government and Fortune 500 procurement teams are writing dual-sourcing mandates, onshoring requirements, and strategic inventory obligations as a direct response.', move: 'Position in industrial gases with domestic plant network (Air Products, Linde), specialty chemical primes with U.S. manufacturing (Celanese, Eastman), and supply chain intelligence vendors (Interos, Resilinc, Everstream Analytics, Sayari). Target Fortune 500 supply chain risk programs and DoD DPA Title III.' },
      'component_scarcity':   { why: 'Sub-assembly and component scarcity (power modules, sensors, precision castings, forged aerospace parts) hits multi-year programs hardest because engineering change orders take 18-36 months to qualify alternatives. Defense, aerospace, and medical device programs are hit first because they have the least flexibility.', move: 'Position in specialty forging and casting (Precision Castparts is private but HEICO, TransDigm, Curtiss-Wright are proxies), industrial distributors (Fastenal, MSC, Grainger), and qualified second-source component manufacturers. Target DoD DPA Title III and CHIPS Act component-qualification grants.' },
      'critical_part_delay':  { why: 'Long-lead critical parts (semiconductor fab equipment, large power transformers, gas turbines, industrial boilers) have 18-36 month lead times that blow out further under demand spikes. Data center buildout, grid modernization, and reshoring capex are all running into these walls right now.', move: 'Position in critical equipment manufacturers (Eaton transformers, GE Vernova turbines, Siemens Energy grid), engineering primes that can design around shortages (AECOM, Jacobs), and strategic inventory platforms (Flexport for intermodal, Project44 for visibility). Target data center hyperscaler contracts and utility grid hardening programs.' }
    },
    'AUTOMATION_FAILURE': {
      'equipment_failure':    { why: 'Industrial equipment failure \u2014 unplanned downtime on presses, CNCs, robotics, conveyors, utilities \u2014 is the single largest controllable cost in manufacturing. Average unplanned downtime is $260K/hour in automotive; $50K-$150K/hour across most discrete manufacturing; and much higher in process industries. Predictive maintenance and digital twins offer 30-50% downtime reduction and are moving from pilot to mandatory.', move: 'Position in automation primes with predictive maintenance platforms (Rockwell FactoryTalk Analytics, Emerson AMS, Honeywell Forge, Siemens MindSphere, GE Digital APM), and pure-play predictive maintenance SaaS (AspenTech, Augury, Uptake, Sensrnet as references). Target Fortune 500 smart factory modernization programs and DOE Advanced Manufacturing Office grants.' },
      'automation_breakdown': { why: 'Aging automation (PLCs installed 20-30 years ago, legacy SCADA without patching, motion controllers on unsupported firmware) is failing under cybersecurity exposure and rising production volumes. The fix is rip-and-replace modernization paid for by CHIPS Act, DOE AMO, and private reshoring capex.', move: 'Position in automation modernization primes (Rockwell, Siemens, ABB, Emerson, Schneider Electric), OT cybersecurity (Dragos, Claroty, Nozomi Networks \u2014 Claroty public via SPAC as reference), and system integrators. Target CHIPS Act factory buildout, DOE AMO efficiency grants, and insurance-driven OT modernization mandates.' },
      'capacity_constraint':  { why: 'Capacity constraints hit first when demand recovers faster than plants can be rebuilt. U.S. manufacturing capacity utilization has been running above 78% structurally post-COVID, meaning most plants have no slack. Every reshoring announcement that actually breaks ground tightens capacity further, driving capex, automation, and second-shift labor spending.', move: 'Position in manufacturing capacity expansion primes (Rockwell, Emerson, ABB), engineering-procurement-construction for plants (Jacobs, Fluor, AECOM Hunt), and industrial real estate REITs (Prologis, Rexford, First Industrial as references). Target CHIPS Act construction, IRA manufacturing credit, and DPA Title III.' },
      'production_halt':      { why: 'Full production halts \u2014 whether from equipment, materials, or labor \u2014 force emergency responses and long-duration recovery. Manufacturers with digital twins, redundancy, and flexible production architecture recover in days; those without take months. This widens the competitive gap and accelerates consolidation in every affected sub-sector.', move: 'Position in redundancy and flexibility technology: digital twin platforms (Rockwell Emulate3D, Siemens Plant Simulation, AnyLogic), flexible automation (Universal Robots via Teradyne, Fanuc, ABB collaborative robots), and modular manufacturing (Dover Engineered Products, IDEX specialty pumps). Target Fortune 500 business continuity programs.' }
    },
    'TOXIC_SPILL': {
      'industrial_incident':  { why: 'Industrial incidents (chemical plant releases, refinery leaks, tailings dam failures, pipeline ruptures, train derailments with hazardous materials) trigger $10M-$5B+ emergency response and remediation programs, plus multi-year regulatory oversight. East Palestine, OH derailment is the archetypal case: $800M+ committed and counting. Every incident accelerates EPA enforcement, state AG pursuit, and industrial insurance repricing.', move: 'Position in hazardous waste primes (Clean Harbors, Republic Services / US Ecology, Waste Management), environmental engineering (AECOM, Jacobs, Tetra Tech, Stantec, Arcadis via DOE), and industrial insurance (AIG, Chubb, Zurich). Target EPA Superfund, DoD Installation Restoration, state-led remediation programs, and CERCLA section 107 cost recovery work.' },
      'contamination_event':  { why: 'Contamination events force evacuations, school closures, drinking water advisories, and multi-year health monitoring. The political and regulatory response is immediate and expensive. Beyond initial cleanup, long-tail exposure to PFAS, dioxins, heavy metals, and benzene creates years of remediation, monitoring, and legal exposure.', move: 'Position in water treatment (Veralto, Ecolab, Xylem, Pentair), PFAS destruction and remediation (Clean Harbors high-temp incineration, Battelle), and environmental consulting (Tetra Tech, AECOM, ERM). Target EPA Safe Drinking Water Act enforcement, state health department contracts, and class-action remediation work.' },
      'safety_failure':       { why: 'Safety failures (OSHA recordables, fatalities, catastrophic process safety events under OSHA PSM) force management changes, capital spending on safety systems, and insurance repricing. The Chemical Safety Board publishes investigation reports that drive industry-wide capital programs. Every major PSM event accelerates safety spending across its sector.', move: 'Position in process safety and instrumented systems (Emerson DeltaV SIS, Honeywell Safety Manager, Siemens Safety Integrated, Yokogawa ProSafe), EHS software (Sphera, Cority, Intelex, Enablon, VelocityEHS), and industrial insurance carriers. Target EPA RMP and OSHA PSM compliance programs.' }
    },
    'QUALITY_CRISIS': {
      'quality_defect':       { why: 'Quality defects cascade across programs \u2014 automotive recalls can reach $5B+ (Takata airbags were $25B+), aerospace recalls ground fleets, medical device recalls trigger FDA 483 letters and warning letters that shut down entire production lines. Warranty reserves reprice. Brands lose share to competitors with better QC track records. Every major recall accelerates QMS and metrology spending across the affected sector.', move: 'Position in quality management systems (MasterControl, ETQ Reliance, AssurX, Sparta Systems \u2014 now Honeywell), metrology and test & measurement (Mettler-Toledo, Keysight, Fortive Fluke/Tektronix, Agilent, Thermo Fisher), and quality consulting / ISO audit services (SGS, Bureau Veritas, Intertek, UL). Target FDA CGMP 483 remediation, NHTSA recall campaigns, and IATF 16949 certification programs.' },
      'recall_risk':          { why: 'Recall exposure \u2014 identified before full field failure \u2014 triggers preemptive containment, retrofit campaigns, and supplier recovery. Supplier quality gates tighten. Contract manufacturers with strong QC become preferred sources, taking share from competitors that can\u2019t demonstrate process control.', move: 'Position in contract manufacturers with strong QC track records (Jabil, Celestica, Flex for electronics; Axcelis, Cohu, Teradyne for semis), and supplier quality platforms (Sparta Systems, MasterControl, ETQ). Target OEM supplier quality programs and IATF 16949 / AS9100 / ISO 13485 certification work.' },
      'inspection_failure':   { why: 'Inspection failures at FDA, FAA, NHTSA, and CPSC force immediate production shutdowns and remediation. Boeing 737 MAX production freezes; Intuitive Surgical 483 letters; automotive recalls from NHTSA ODI investigations. Every inspection failure is a six-month to multi-year fix involving QMS upgrades, process redesign, and third-party verification.', move: 'Position in quality remediation consultants (NSF International, Regulatory Compliance Associates, Compliance Insight Inc as references), metrology and test services (Mettler-Toledo, Keysight calibration), and independent verification & validation (IV&V) firms. Target FDA 483 remediation, NHTSA audit response, and IATF / AS9100 / ISO 13485 corrective action programs.' },
      'reliability_decline':  { why: 'Reliability decline \u2014 MTBF collapse, warranty claim growth, customer complaint trends \u2014 is the leading indicator for full quality crisis. Warranty reserves grow; customer satisfaction drops; repeat purchase rates fall. Smart manufacturers catch this upstream with process data analytics, SPC, and digital twin-based root cause analysis.', move: 'Position in SPC and quality analytics (Minitab, InfinityQS, JMP Statistical Discovery, SAS), digital twin platforms (Rockwell Emulate3D, Siemens Plant Simulation, AnyLogic, Ansys Twin Builder), and process analytics (AspenTech Hyprotech, Uptake, Augury). Target Six Sigma black belt programs, SPC rollouts, and warranty reduction contracts.' }
    },
    'WORKFORCE_SHORTAGE': {
      'labor_shortage':       { why: 'Skilled-trade shortages (welders, machinists, electricians, pipefitters, CNC operators, industrial technicians) are now the binding constraint on U.S. manufacturing expansion. The CHIPS Act alone requires ~115K new semiconductor technicians; IIJA and IRA add hundreds of thousands more. Apprenticeship pipelines are 10-15 years behind what\u2019s needed.', move: 'Position in industrial staffing primes (ManpowerGroup, Kelly Services, Robert Half industrial, ASGN, TNET HR outsourcing), workforce development providers (Penn Foster, Randstad as references), and automation as labor substitution (Rockwell, Fanuc FANUY, ABB). Target CHIPS Act workforce grants, DOL apprenticeship programs, and industrial staffing contracts.' },
      'workforce_gap':        { why: 'The workforce gap (open positions per qualified applicant) is now structural in manufacturing: ~1.9 unemployed workers per manufacturing job opening, but the mismatch in skills means the pipeline is even thinner than the headline suggests. Community college programs, apprenticeships, and OEM-led training academies are the operational fix.', move: 'Position in workforce development platforms (Guild Education, Strategic Education, Graham Holdings education segment), industrial training providers (Penn Foster, Tooling U-SME as reference), and OEM training academies (Rockwell Automation University, Siemens Sitrain, ABB University). Target Department of Labor apprenticeship, CHIPS workforce, and state-level workforce board contracts.' },
      'contractor_limit':     { why: 'Specialty construction contractors (EPC for industrial plants, industrial steel fabricators, hazmat-certified crews, union millwrights) are fully booked through 2026 on CHIPS, IRA, and IIJA projects. New projects face 12-24 month queues before they can even break ground. Every major reshoring announcement that actually breaks ground tightens contractor availability further.', move: 'Position in industrial EPC primes (Jacobs, Fluor, AECOM Hunt, Bechtel as reference since private, McDermott International), and industrial construction labor (MasTec, EMCOR Group, Quanta Services, IES Holdings). Target CHIPS Act construction, IRA manufacturing credit project finance, and IIJA federal contracts.' },
      'labor_stoppage':       { why: 'UAW, USW, Teamsters, IBEW, and related union labor actions in 2023-2025 demonstrated that strike risk is back on the table for every major industrial. The UAW Stand-Up Strike cost GM / Ford / Stellantis $10B+. Boeing Machinists strike grounded a substantial piece of commercial aircraft production. Every strike forces management to bring labor-cost forecasts forward and often accelerates automation spending as a hedge.', move: 'Position in automation-as-hedge (Rockwell, Fanuc, ABB, Emerson), non-union industrial firms in affected sectors, and industrial staffing (ManpowerGroup, Kelly). Target Fortune 500 strike continuity planning and contingent-labor programs.' }
    }
  };

  var MECH_FALLBACK = {
    'input_shortage':       { why: 'Critical inputs are constrained. Reshoring, dual-sourcing, and specialty chemical capacity all benefit.', move: 'Position in MRO distributors (Fastenal, Grainger), specialty chemicals (Celanese, Eastman), and domestic steel (Nucor, Steel Dynamics).' },
    'supplier_constraint':  { why: 'Supply base concentration creates fragility. Dual-sourcing and onshoring spending rises.', move: 'Position in industrial gases (Linde, Air Products) and supply chain intelligence vendors (Interos, Resilinc as references).' },
    'component_scarcity':   { why: 'Components are scarce. Specialty forging, casting, and qualified second sources benefit.', move: 'Position in specialty industrial (HEICO, TransDigm, Curtiss-Wright) and distributors (Fastenal, MSC).' },
    'critical_part_delay':  { why: 'Long-lead critical parts are blowing out schedules. Critical equipment manufacturers benefit.', move: 'Position in Eaton, GE Vernova, Siemens Energy for transformers, turbines, and grid equipment.' },
    'equipment_failure':    { why: 'Industrial equipment failure is driving predictive maintenance spending.', move: 'Position in Rockwell, Emerson, Honeywell Forge, Siemens MindSphere, and GE Digital APM.' },
    'automation_breakdown': { why: 'Aging automation is failing. Modernization and OT cyber spending rises.', move: 'Position in Rockwell, Siemens, ABB, Emerson, Schneider Electric, and OT cyber primes (Dragos, Claroty).' },
    'capacity_constraint':  { why: 'Manufacturing capacity is tight. Expansion capex, automation, and EPC all benefit.', move: 'Position in automation primes (Rockwell, Emerson, ABB) and EPC firms (Jacobs, Fluor, AECOM).' },
    'production_halt':      { why: 'Full production halts force redundancy spending. Digital twin and flexible automation benefit.', move: 'Position in digital twins (Rockwell Emulate3D, Siemens Plant Simulation) and flexible automation (Universal Robots via Teradyne, Fanuc).' },
    'industrial_incident':  { why: 'Industrial incidents trigger emergency response and remediation contracts.', move: 'Position in Clean Harbors, AECOM, Jacobs, Tetra Tech, and industrial insurance (AIG, Chubb).' },
    'contamination_event':  { why: 'Contamination events drive water treatment, remediation, and monitoring demand.', move: 'Position in Veralto, Xylem, Ecolab, Clean Harbors, and environmental engineering primes.' },
    'safety_failure':       { why: 'Process safety events drive SIS, EHS, and insurance repricing.', move: 'Position in Emerson DeltaV SIS, Honeywell Safety Manager, Sphera, Cority, Intelex.' },
    'quality_defect':       { why: 'Quality defects drive QMS, metrology, and audit services demand.', move: 'Position in MasterControl, ETQ, Mettler-Toledo, Keysight, Agilent, Thermo Fisher.' },
    'recall_risk':          { why: 'Recall exposure forces supplier quality programs and audits.', move: 'Position in contract manufacturers (Jabil, Celestica, Flex) and supplier quality platforms.' },
    'inspection_failure':   { why: 'Regulatory inspection failures force remediation and IV&V.', move: 'Position in metrology and calibration services (Mettler-Toledo, Keysight) and quality consulting.' },
    'reliability_decline':  { why: 'Reliability decline leads to upstream warranty and QC spending.', move: 'Position in SPC software (Minitab, InfinityQS, JMP), digital twin platforms, and process analytics (AspenTech).' },
    'labor_shortage':       { why: 'Skilled trade shortages drive staffing, training, and automation spending.', move: 'Position in ManpowerGroup, Kelly Services, Robert Half, and automation primes (Rockwell, Fanuc, ABB).' },
    'workforce_gap':        { why: 'Workforce skill mismatch drives training platform demand.', move: 'Position in Guild Education, Strategic Education, and OEM training academies (Rockwell, Siemens, ABB).' },
    'contractor_limit':     { why: 'Specialty contractor availability is limiting project starts.', move: 'Position in Jacobs, Fluor, AECOM Hunt, MasTec, EMCOR Group, and Quanta Services.' },
    'labor_stoppage':       { why: 'Strike risk is driving automation-as-hedge and continuity planning.', move: 'Position in Rockwell, Fanuc, ABB automation, and staffing primes for contingent labor.' }
  };

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
    return fetch('/assets/data/deep/industry-branch-index.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { _branchIndex = d; return d; }).catch(function () { _branchIndexFailed = true; return null; });
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

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 1: MONEY SUMMARY
  // ══════════════════════════════════════════════════════════════════════

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

    var text = '';
    if (activeDx.length > 0) {
      text = '<b>' + activeDx.length + '</b> active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' at <b>' + pct + '%</b> industrial stress. ';
      var primaryDx = activeDx[0];
      var ctx = DX_CONTEXT[(primaryDx.id || '').toUpperCase()];
      if (ctx) text += ctx.what + '. <b>Money move:</b> ' + ctx.step;
    } else {
      text = 'Industry domain at <b>' + pct + '%</b> stress. No active diagnoses. Watch for supply chain, automation, safety, quality, or workforce signals.';
    }

    // Pulse regime context
    if (pulse && pulse.regime === 'crisis') {
      text += ' <b style="color:#e85454">Regime: CRISIS.</b> Multiple positioning windows are open.';
    } else if (pulse && pulse.regime === 'elevated') {
      text += ' Regime: ELEVATED. Positioning windows may be forming.';
    }

    // Path counts
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

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 2: TOP 3 MONEY PLAYS
  // ══════════════════════════════════════════════════════════════════════

  function buildTopPlays(state) {
    var opps = (state.opportunities || []).slice();
    if (opps.length === 0) return '';
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Exclude the #1 promoted directive — it's already shown as the Anchor Directive card
    var anchorId = null;
    for (var ai = 0; ai < opps.length; ai++) {
      if (opps[ai].source === 'portal_directive' && opps[ai]._directive) { anchorId = opps[ai].id; break; }
    }
    if (anchorId) opps = opps.filter(function (o) { return o.id !== anchorId; });
    var top = opps.slice(0, 3);

    var h = '<div class="eos-plays">';
    for (var i = 0; i < top.length; i++) {
      var o = top[i];
      var dxId = (o.diagnosisId || '').toUpperCase();
      var ctx = DX_CONTEXT[dxId] || null;
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

      // WHY THIS MAKES MONEY — causal chain
      if (o.moneyChain) {
        h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.15)">';
        h += '<b style="color:#C9A94E">WHY THIS MAKES MONEY:</b><br>';
        if (o.moneyChain.doThis) h += '<span style="color:#d0c8b8">Do this:</span> ' + esc(o.moneyChain.doThis) + '<br>';
        if (o.moneyChain.whyPays) h += '<span style="color:#d0c8b8">Why it pays:</span> ' + esc(o.moneyChain.whyPays) + '<br>';
        if (o.moneyChain.target) h += '<span style="color:#d0c8b8">Target:</span> ' + esc(o.moneyChain.target) + '<br>';
        if (o.moneyChain.timing) h += '<span style="color:#d0c8b8">Timing:</span> ' + esc(o.moneyChain.timing) + '<br>';
        if (o.moneyChain.evidence) h += '<span style="color:#d0c8b8">Evidence:</span> ' + esc(o.moneyChain.evidence);
        h += '</div>';
      } else if (ctx) {
        h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.15)">';
        h += '<b style="color:#C9A94E">WHY THIS MAKES MONEY:</b><br>';
        h += '<span style="color:#d0c8b8">' + esc(ctx.money) + '</span>';
        h += '</div>';
      } else {
        h += '<div class="eos-play-why">' + esc(o.explain || o.title) + '</div>';
      }
      // OUTCOME
      h += '<div class="eos-play-outcome">Expected: ' + esc(o.valueRange || (ctx ? ctx.outcome : '') || o.outcome || 'See playbook detail') + '</div>';

      // Collapsible detail — VALIDATION + EXECUTION + FAILURE + GROUNDING
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

      // Mechanism block
      h += renderMechanismBlock(o, 'play');

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

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 3: ACTION QUEUE
  // ══════════════════════════════════════════════════════════════════════

  function buildActionQueue(state) {
    var opps = (state.opportunities || []).slice();

    // Merge claimed opportunities from ledger so they never disappear
    var ledger = window.LIMENClaimLedger;
    if (ledger) {
      var claims = ledger.getClaimsByDomain('industry');
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
          domain: 'industry',
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
      var dxId = (o.diagnosisId || '').toUpperCase();
      var ctx = DX_CONTEXT[dxId] || null;

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
      } else if (ctx) {
        whyCell += '<div class="money-thesis-detail">';
        whyCell += '<span class="mtd-label">MONEY MOVE</span>' + esc(ctx.money);
        whyCell += '<span class="mtd-label">STEP</span>' + esc(ctx.step);
        whyCell += '<span class="mtd-label">OUTCOME</span>' + esc(ctx.outcome);
        whyCell += '</div>';
      }
      // Deep intel for promoted directives inside the expanded view
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
      // Action button row — full width below opportunity
      h += '<tr><td colspan="5" style="padding:0;border-bottom:1px solid rgba(255,255,255,0.04)"><div class="eos-action-row">' + statusHTML;
      // Path-specific action buttons
      var pbId = (o.path === 'INVESTABLE') ? resolvePlaybookId(o) : null;
      if (pbId) {
        h += '<button class="eos-invest-btn" data-pb-id="' + esc(pbId) + '" data-opp-title="' + esc(title) + '">INVEST \u2192</button>';
      }
      // removed: GRANT/PATENT/BUILD workspace buttons — lanes dropped
      if (o.compensation) {
        h += '<span style="font-size:0.22rem;color:#5ab5a0;white-space:nowrap">' + (o.compensation.base || 0) + (o.compensation.unit || '%') + '\u2192' + (o.compensation.maxTier ? o.compensation.maxTier.comp : '?') + (o.compensation.unit || '%') + '</span>';
      }
      // CLAIM button
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'industry') : null;
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

  var _bridgeInitialized = false;

  function renderOperator() {
    if (!_operatorView) return;
    var state = getState();
    if (!state) return;

    var bridge = window.LIMENIndustryPromotionBridge;
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('industry') : null;
      var portalCache = brain ? brain._portalCache : null;

      if (portalCache) {
        var bridgeOpts = { limit: 5 };
        var cached = bridge.getLastPromoted();
        if (cached && cached.length > 0) {
          bridge.promote(state, portalCache, bridgeOpts);
        }
        if (!_bridgeInitialized) {
          _bridgeInitialized = true;
          bridge.promote(state, portalCache, bridgeOpts).then(function (promoted) {
            if (promoted && promoted.length > 0) {
              var freshState = getState();
              if (freshState) _renderOperatorDOM(freshState);
            }
          }).catch(function () {});
        } else {
          bridge.promote(state, portalCache, bridgeOpts);
        }
      } else if (!_bridgeInitialized) {
        setTimeout(function () {
          var retryBrain = brains ? brains.get('industry') : null;
          var retryCache = retryBrain ? retryBrain._portalCache : null;
          if (retryCache && bridge) {
            _bridgeInitialized = true;
            var retryState = getState();
            if (retryState) {
              bridge.promote(retryState, retryCache, { limit: 5 }).then(function (promoted) {
                if (promoted && promoted.length > 0) {
                  var fs = getState();
                  if (fs) _renderOperatorDOM(fs);
                }
              }).catch(function () {});
            }
          }
        }, 5000);
      }
    }

    _renderOperatorDOM(state);
  }

  function _renderOperatorDOM(state) {
    if (!_operatorView) return;

    var h = '';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    h += '<div class="eos-title" style="margin-bottom:0">INDUSTRY \u00b7 OPERATOR SURFACE</div>';
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
      dxContent += '<div style="font-size:0.32rem;color:#908878">No active diagnoses. Watch for supply chain, automation, safety, quality, or workforce signals.</div>';
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
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['industry'], type: 'invest' };

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=industry&returnTo=' + encodeURIComponent('/domain-console?domain=industry');
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
        window.LIMENClaimFlow.openClaimModal(opp, 'industry', function (confirmedOpp, estimate) {
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'industry', estimate);
          }
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel
    if (window.LIMENOperatorPanel) window.LIMENOperatorPanel.mount(_operatorView, 'industry');
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
    if (window.LIMENIndustryBusinessReview) window.LIMENIndustryBusinessReview.mount(_operatorView);
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

    console.log('[IndustryOperator] Booted \u2014 operator view created, toggle wired');
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
