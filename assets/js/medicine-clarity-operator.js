/**
 * medicine-clarity-operator.js — Money-Driven Action Surface for Medicine Domain
 *
 * PRESENTATION LAYER ONLY. Does not modify brain logic, data, or shared components.
 * Company phase/rupture data is READ from kernel outputs (state.companies) — NEVER computed here.
 *
 * Architecture:
 *   - Console (brain panels) renders in #clarity-view — this is the DEFAULT view
 *   - Operator surface renders in #med-operator-view — a SEPARATE sibling container
 *   - Toggle button switches between Console <-> Operator
 *   - The old Clarity/Analyst 3-column grid is not used
 *
 * Self-gates: only runs when ?domain=medicine is in the URL.
 *
 * Sections:
 *   1. MONEY SUMMARY — 1-2 sentences, plain language
 *   2. TOP 3 MONEY PLAYS — prioritized actions with path + payoff
 *   3. ACTION QUEUE — full opportunity table, rewritten for operators
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // GATE — only run on medicine domain console
  // ══════════════════════════════════════════════════════════════════════

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'medicine') return;

  var VIEW_ID = 'med-operator-view';
  var STATUS_KEY = 'limen_medicine_operator_status';
  var COLLAPSE_KEY = 'limen_medicine_collapse_state';
  var _operatorView = null;
  var _isOperatorMode = false;
  var _booted = false;

  // Session-persistent collapse state
  function getCollapseState() {
    try { return JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setCollapsed(sectionId, collapsed) {
    var st = getCollapseState();
    st[sectionId] = collapsed;
    try { sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify(st)); } catch (e) {}
  }
  function isCollapsed(sectionId) {
    return getCollapseState()[sectionId] === true;
  }
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

  // ══════════════════════════════════════════════════════════════════════
  // STYLES — injected once (shared eos- prefix)
  // ══════════════════════════════════════════════════════════════════════

  var _stylesInjected = false;

  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '#' + VIEW_ID + '{padding:20px 24px 60px;font-family:"IBM Plex Mono",monospace;overflow-y:auto;grid-column:1/-1;grid-row:2;display:none}',

      /* Section titles */
      '.eos-title{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;margin-bottom:6px;font-weight:600;text-shadow:0 0 6px rgba(201,169,78,0.2)}',

      /* Money summary */
      '.eos-summary{font-size:0.54rem;color:#f0ece2;line-height:1.65;margin-bottom:18px;max-width:900px}',
      '.eos-summary b{color:#C9A94E}',

      /* Top 3 plays */
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

      /* Action queue table */
      '.eos-queue{width:100%;border-collapse:collapse;margin-bottom:8px}',
      '.eos-queue th{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.75);text-transform:uppercase;text-align:left;padding:5px 8px;border-bottom:1px solid rgba(201,169,78,0.12);font-weight:600}',
      '.eos-queue td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.38rem;color:#d0c8b8;vertical-align:top}',
      '.eos-queue tr:hover{background:rgba(201,169,78,0.02)}',
      '.eos-queue-pri{color:#C9A94E;font-weight:bold;font-size:0.42rem;width:30px}',
      '.eos-queue-name{max-width:220px}',
      '.eos-queue-why{color:#c0b8a5;max-width:340px;line-height:1.4}',
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

      /* Status buttons */
      '.eos-status-btn{font-family:inherit;font-size:0.26rem;letter-spacing:1px;padding:2px 6px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid rgba(255,255,255,0.1);background:none;color:#a09888;margin:1px;white-space:nowrap;display:inline-flex;align-items:center}',
      '.eos-status-btn:hover{border-color:rgba(201,169,78,0.3);color:#C9A94E}',
      '.eos-status-btn.active-new{color:#5ab5a0;border-color:rgba(90,181,160,0.3)}',
      '.eos-status-btn.active-wip{color:#C9A94E;border-color:rgba(201,169,78,0.3)}',
      '.eos-status-btn.active-done{color:#4a8fd4;border-color:rgba(74,143,212,0.3)}',
      '.eos-status-btn.active-watch{color:#807868;border-color:rgba(128,120,104,0.3)}',

      /* Quiet state */
      '.eos-quiet{font-size:0.42rem;color:#b0a898;line-height:1.6;padding:8px 0}',

      /* Collapsible sections */
      '.eos-section-header{display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:4px 0;margin-bottom:6px;user-select:none;-webkit-user-select:none}',
      '.eos-section-header:hover .eos-title{color:rgba(201,169,78,1);text-shadow:0 0 8px rgba(201,169,78,0.4)}',
      '.eos-section-toggle{font-size:0.24rem;color:rgba(201,169,78,0.35);transition:transform 0.2s}',
      '.eos-section-body{overflow:hidden;transition:max-height 0.25s ease,opacity 0.2s ease}',
      '.eos-section-body.collapsed{max-height:0;opacity:0;margin:0;padding:0}',

      /* Anchor Directive card */
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

      /* Deep Proof block */
      '.eos-deepproof{margin-bottom:14px;padding:12px 16px;border:1px solid rgba(74,143,212,0.2);border-left:3px solid rgba(74,143,212,0.6);border-radius:3px;background:rgba(74,143,212,0.03)}',
      '.eos-deepproof-label{font-size:0.24rem;letter-spacing:2.5px;color:rgba(74,143,212,0.8);margin-bottom:6px;font-weight:700}',
      '.eos-deepproof-title{font-size:0.48rem;color:#e0daca;line-height:1.4;margin-bottom:6px}',
      '.eos-deepproof-why{font-size:0.34rem;color:rgba(74,143,212,0.6);line-height:1.5;margin-bottom:8px;font-style:italic}',
      '.eos-deepproof-steps{font-size:0.34rem;color:#c0b8a5;line-height:1.6;margin-bottom:8px}',

      /* Deep Intelligence expandable */
      '.eos-deep-toggle{font-family:inherit;font-size:0.24rem;letter-spacing:1px;padding:2px 8px;border:1px solid rgba(74,143,212,0.2);border-radius:2px;background:rgba(74,143,212,0.03);color:rgba(74,143,212,0.7);cursor:pointer;transition:all 0.15s;margin-top:6px}',
      '.eos-deep-toggle:hover{background:rgba(74,143,212,0.08);color:rgba(74,143,212,0.95)}',
      '.eos-deep-body{overflow:hidden;max-height:0;opacity:0;transition:max-height 0.3s ease,opacity 0.25s ease;margin-top:0}',
      '.eos-deep-body.open{max-height:600px;opacity:1;margin-top:8px}',
      '.eos-deep-section{margin-bottom:8px;padding:6px 10px;border-left:2px solid rgba(74,143,212,0.12);background:rgba(74,143,212,0.02);border-radius:2px}',
      '.eos-deep-label{font-size:0.22rem;letter-spacing:1.5px;color:rgba(74,143,212,0.6);margin-bottom:3px;font-weight:600}',
      '.eos-deep-text{font-size:0.30rem;color:#b0a898;line-height:1.6}',
      '.eos-deep-cite{font-size:0.26rem;color:#908878;line-height:1.5;padding:2px 0}',

      /* Invest button */
      '.eos-invest-btn{font-family:inherit;font-size:0.26rem;letter-spacing:1px;padding:2px 6px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid rgba(90,181,160,0.25);background:rgba(90,181,160,0.04);color:#5ab5a0;margin-left:0;white-space:nowrap;display:inline-flex;align-items:center}',
      '.eos-invest-btn:hover{background:rgba(90,181,160,0.12);border-color:rgba(90,181,160,0.4)}',

      /* Target section */
      '.eos-targets{margin-top:6px;padding-top:5px;border-top:1px solid rgba(201,169,78,0.06)}',
      '.eos-targets-header{display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px;user-select:none}',
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

  // ══════════════════════════════════════════════════════════════════════
  // DATA ACCESS — reads brain state, never writes
  // ══════════════════════════════════════════════════════════════════════

  function getState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('health');
    return brain ? brain.getState() : null;
  }

  function getStatusMap() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}'); } catch (e) { return {}; }
  }

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

  function setStatus(key, status) {
    var map = getStatusMap();
    map[key] = status;
    try { localStorage.setItem(STATUS_KEY, JSON.stringify(map)); } catch (e) {}
  }

  // ══════════════════════════════════════════════════════════════════════
  // LANGUAGE ENGINE — rewrites brain output into money language
  // ══════════════════════════════════════════════════════════════════════

  var DX_CONTEXT = {
    'PANDEMIC': {
      what: 'A novel pathogen is spreading rapidly across populations \u2014 hospitals are overwhelmed, supply chains are disrupted, and public health systems are under extreme strain',
      money: 'Vaccine development accelerates, PPE demand surges, telehealth adoption skyrockets. Hospital systems need surge capacity solutions. Testing companies capture enormous volume. Governments issue emergency procurement contracts.',
      step: 'Check WHO and CDC situation reports. Monitor hospital capacity dashboards. If CFR exceeds 1% and R0 > 2, position in vaccine makers (PFE, MRNA, BNTX), testing companies (DGX, LH), and telehealth platforms (TDOC, AMWL).',
      outcome: '50-200% returns on pandemic-response positioning within 6-12 months'
    },
    'DRUG_RESISTANCE': {
      what: 'Antimicrobial resistance is rendering standard treatments ineffective \u2014 common infections are becoming untreatable with existing antibiotics',
      money: 'Novel antibiotic development becomes urgent. Diagnostic companies that can rapidly identify resistance patterns capture premium pricing. Infection prevention products see demand surge. WHO essential antibiotics list drives procurement.',
      step: 'Check CDC AMR Threats Report. Monitor WHO AWaRe antibiotic classification. If resistance rates exceed 50% for key pathogens, position in novel antibiotic developers, rapid diagnostics (ILMN, CEPX), and infection prevention companies.',
      outcome: '30-100% returns on AMR-focused positioning as resistance crisis escalates'
    },
    'HEALTHCARE_COLLAPSE': {
      what: 'Healthcare delivery infrastructure is failing \u2014 hospital closures, physician shortages, nursing crises, and inability to provide basic care to populations',
      money: 'Locum tenens and travel nurse agencies see explosive demand. Telehealth fills access gaps. Hospital acquisition targets become available at distressed valuations. Automated clinical tools reduce workforce dependency.',
      step: 'Check AHA hospital closure reports. Monitor nurse vacancy rates. If closures exceed 10/quarter nationally, position in staffing companies (AMN, CHE), telehealth (TDOC), and hospital acquirers (HCA, THC).',
      outcome: '20-60% returns on healthcare consolidation and staffing surge plays'
    },
    'MALPRACTICE_CRISIS': {
      what: 'Medical malpractice claims are surging \u2014 insurance premiums are spiking, physicians are leaving high-risk specialties, and defensive medicine is driving up costs',
      money: 'Medical malpractice insurers reprice. Clinical decision support tools see emergency adoption. Documentation improvement companies capture compliance-driven demand. Risk management consulting surges.',
      step: 'Check medical malpractice premium trends. Monitor state tort reform activity. If premium increases exceed 20% annually, position in documentation AI (NUAN), clinical decision support companies, and malpractice data analytics firms.',
      outcome: '15-40% returns on malpractice crisis response positioning'
    },
    'SUPPLY_SHORTAGE': {
      what: 'Critical medical supplies, drugs, or devices are in shortage \u2014 hospitals cannot obtain essential medications, PPE, or surgical supplies',
      money: 'Alternative suppliers capture premium pricing. Drug shortage tracking and substitution analytics become essential. Contract manufacturing organizations see order surges. GPO contract renegotiations create procurement opportunities.',
      step: 'Check FDA drug shortage database. Monitor ASHP shortage reports. If shortages exceed 300 active items, position in CMOs (WBA, CAH), supply chain analytics, and alternative manufacturer stocks.',
      outcome: '20-50% returns on supply shortage positioning across pharmaceutical supply chain'
    },
    'MENTAL_HEALTH_CRISIS': {
      what: 'Mental health demand is overwhelming available capacity \u2014 psychiatric bed shortages, therapist waitlists, and suicide rates are escalating',
      money: 'Digital mental health platforms capture massive patient volume. Telepsychiatry fills access gaps. Payers increase mental health reimbursement. School-based mental health programs receive government funding.',
      step: 'Check SAMHSA National Survey. Monitor psychiatric bed availability. If therapist waitlists exceed 60 days nationally, position in digital mental health (TALK, GDRX), telepsychiatry, and payer-funded programs.',
      outcome: '30-80% returns on mental health access expansion plays'
    },
    'CARE_ACCESS_FAILURE': {
      what: 'Populations are unable to access basic healthcare services \u2014 rural hospital deserts, insurance coverage gaps, and appointment availability crises',
      money: 'FQHC expansion funding surges. Mobile health clinics deploy. Retail health clinics capture primary care volume. Asynchronous telemedicine fills gaps. Community health worker programs receive federal funding.',
      step: 'Check HRSA HPSA designations. Monitor uninsured rate trends. If uninsured exceeds 12% or HPSAs exceed 7,000, position in retail health (CVS, WBA), telehealth (AMWL), and community health technology.',
      outcome: '15-40% returns on healthcare access expansion positioning'
    },
    'CHRONIC_DISEASE_LOAD': {
      what: 'Chronic disease prevalence is overwhelming healthcare capacity \u2014 diabetes, heart failure, COPD, and CKD management costs are consuming healthcare budgets',
      money: 'Value-based care models accelerate. Remote patient monitoring becomes standard of care. GLP-1 agonists (obesity/diabetes) see explosive adoption. Care management platforms capture chronic disease populations.',
      step: 'Check CDC chronic disease prevalence data. Monitor CMS chronic care management billing trends. If chronic disease spending exceeds 90% of healthcare costs, position in RPM companies, GLP-1 makers (LLY, NVO), and CCM platforms.',
      outcome: '25-60% returns on chronic disease management plays as value-based care expands'
    },
    'CLINICAL_COORDINATION_BREAKDOWN': {
      what: 'Clinical care coordination is failing \u2014 handoff errors, lost referrals, duplicated tests, and fragmented care are harming patients and wasting resources',
      money: 'Care coordination platforms see emergency adoption. Health information exchanges receive government mandates. Interoperability vendors capture regulatory-driven demand. Patient navigation companies fill gaps.',
      step: 'Check ONC interoperability mandates. Monitor care transition failure rates. If 30-day readmission rates exceed 15% nationally, position in care coordination (VEEV, HIMS), HIEs, and patient navigation companies.',
      outcome: '20-45% returns on care coordination technology plays'
    },
    'THERAPEUTIC_RELIABILITY_RISK': {
      what: 'Therapeutic interventions are showing inconsistent effectiveness \u2014 drug efficacy varies by population, treatment protocols produce unpredictable outcomes, and clinical variation is excessive',
      money: 'Precision medicine adoption accelerates. Pharmacogenomic testing becomes standard. Clinical pathway management tools reduce variation. Real-world evidence analytics validate treatment effectiveness.',
      step: 'Check FDA label updates and REMS programs. Monitor clinical variation data. If treatment failure rates exceed benchmarks, position in PGx testing (ILMN, MYGN), clinical pathway companies, and RWE analytics.',
      outcome: '20-50% returns on precision medicine and clinical standardization plays'
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // PLAYBOOK MAPPING
  // ══════════════════════════════════════════════════════════════════════

  var DX_TO_PLAYBOOK = {
    'PANDEMIC':                       'med_clinical',
    'DRUG_RESISTANCE':                'med_research',
    'HEALTHCARE_COLLAPSE':            'med_access',
    'MALPRACTICE_CRISIS':             'med_clinical',
    'SUPPLY_SHORTAGE':                'med_clinical',
    'MENTAL_HEALTH_CRISIS':           'med_access',
    'CARE_ACCESS_FAILURE':            'med_access',
    'CHRONIC_DISEASE_LOAD':           'med_clinical',
    'CLINICAL_COORDINATION_BREAKDOWN': 'med_clinical',
    'THERAPEUTIC_RELIABILITY_RISK':   'med_research'
  };

  var SOURCE_TO_PLAYBOOK = {
    'company_terminal':  'med_clinical',
    'company_stressed':  'med_research',
    'convergence':       'med_access',
    'cross_domain':      'med_clinical'
  };

  var PLAYBOOK_DEFS = {
    'med_clinical': { title: 'Clinical Operations & Care Delivery', domains: ['medicine', 'healthcare'], type: 'invest' },
    'med_research': { title: 'Medical Research & Drug Development', domains: ['medicine', 'biotech'], type: 'invest' },
    'med_access':   { title: 'Healthcare Access & Population Health', domains: ['medicine', 'public_health'], type: 'invest' }
  };

  var INVEST_TARGETS = {
    'med_clinical': [
      { ticker: 'JNJ',  name: 'Johnson & Johnson',         cik: '200406',  validation: 'HELIX_VALIDATED', reason: 'Diversified healthcare conglomerate spanning pharma, medtech, and consumer health; defensive earnings from essential healthcare spending' },
      { ticker: 'PFE',  name: 'Pfizer',                    cik: '78003',   validation: 'HELIX_VALIDATED', reason: 'Major pharmaceutical company with broad therapeutic portfolio; pandemic response infrastructure and vaccine capabilities' },
      { ticker: 'UNH',  name: 'UnitedHealth Group',        cik: '731766',  validation: 'HELIX_VALIDATED', reason: 'Largest US health insurer with Optum clinical services; captures value across insurance and care delivery' },
      { ticker: 'ABT',  name: 'Abbott Laboratories',       cik: '1800',    validation: 'HELIX_VALIDATED', reason: 'Medical devices, diagnostics, and nutrition; FreeStyle Libre CGM growth and rapid diagnostics platform' },
      { ticker: 'TMO',  name: 'Thermo Fisher Scientific',  cik: '97745',   validation: 'HELIX_VALIDATED', reason: 'Life sciences tools and diagnostics; essential infrastructure for clinical research and laboratory testing' },
      { ticker: 'ISRG', name: 'Intuitive Surgical',        cik: '1035267', validation: 'HELIX_VALIDATED', reason: 'Robotic surgery leader with da Vinci platform; recurring instrument revenue and expanding procedure volume' }
    ],
    'med_research': [
      { ticker: 'LLY',  name: 'Eli Lilly',                 cik: '59478',   validation: 'HELIX_VALIDATED', reason: 'GLP-1 agonist leader with Mounjaro/Zepbound; Alzheimer\'s drug donanemab; pipeline-driven growth' },
      { ticker: 'MRNA', name: 'Moderna',                   cik: '1682852', validation: 'HELIX_VALIDATED', reason: 'mRNA platform technology with broad therapeutic pipeline beyond COVID vaccines' },
      { ticker: 'REGN', name: 'Regeneron',                 cik: '872589',  validation: 'HELIX_VALIDATED', reason: 'Biologics leader with Eylea, Dupixent; antibody discovery platform and oncology pipeline' },
      { ticker: 'VRTX', name: 'Vertex Pharmaceuticals',    cik: '875320',  validation: 'HELIX_VALIDATED', reason: 'CF franchise dominance and gene therapy pipeline; pain and kidney disease programs' },
      { ticker: 'ILMN', name: 'Illumina',                  cik: '1110803', validation: 'HELIX_VALIDATED', reason: 'Genomic sequencing infrastructure; enables precision medicine and clinical genomics' },
      { ticker: 'IQV',  name: 'IQVIA',                     cik: '1667950', validation: 'HELIX_VALIDATED', reason: 'Clinical trial services and healthcare data analytics; essential CRO infrastructure' }
    ],
    'med_access': [
      { ticker: 'HCA',  name: 'HCA Healthcare',            cik: '860730',  validation: 'HELIX_VALIDATED', reason: 'Largest US hospital operator; benefits from healthcare volume growth and system consolidation' },
      { ticker: 'TDOC', name: 'Teladoc Health',            cik: '1477449', validation: 'HELIX_VALIDATED', reason: 'Telemedicine leader; virtual care fills access gaps in underserved areas' },
      { ticker: 'CVS',  name: 'CVS Health',                cik: '64803',   validation: 'HELIX_VALIDATED', reason: 'Integrated pharmacy, insurance (Aetna), and primary care (Oak Street Health); retail health expansion' },
      { ticker: 'ELV',  name: 'Elevance Health',           cik: '1156039', validation: 'HELIX_VALIDATED', reason: 'Managed Medicaid leader; benefits from government healthcare expansion and value-based care' },
      { ticker: 'CI',   name: 'Cigna Group',               cik: '1739940', validation: 'HELIX_VALIDATED', reason: 'Health insurer with Evernorth services; pharmacy benefit management and care delivery integration' },
      { ticker: 'XLV',  name: 'Health Care Select Sector',  cik: '',       validation: 'ETF_PROXY',       reason: 'Broad healthcare sector ETF proxy; captures sector-wide growth from demographic demand' }
    ]
  };

  function resolvePlaybookId(opp) {
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    if (opp.source && SOURCE_TO_PLAYBOOK[opp.source]) return SOURCE_TO_PLAYBOOK[opp.source];
    if (opp.source === 'lagging') return 'med_clinical';
    return null;
  }

  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  var PATH_LABELS = { 'PATENTABLE': 'PATENT', 'GRANT-ELIGIBLE': 'GRANT', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'PATENTABLE': 'eos-path-patent', 'GRANT-ELIGIBLE': 'eos-path-grant', 'INVESTABLE': 'eos-path-invest' };
  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  var VAL_LABELS = {
    'HELIX_VALIDATED': { label: 'HELIX VALIDATED', cls: 'eos-val-helix' },
    'NODE_MAPPED':     { label: 'NODE MAPPED',     cls: 'eos-val-node' },
    'DOMAIN_MAPPED':   { label: 'DOMAIN MAPPED',   cls: 'eos-val-domain' },
    'ETF_PROXY':       { label: 'ETF PROXY',       cls: 'eos-val-etf' }
  };

  // ══════════════════════════════════════════════════════════════════════
  // MECHANISM EXPLANATION
  // ══════════════════════════════════════════════════════════════════════

  var MECH_EXPLAIN = {
    'PANDEMIC': {
      'pathogen_spread':      { why: 'A novel pathogen is transmitting faster than containment can respond. Healthcare systems are being overwhelmed with acute cases.', move: 'Build a pandemic surveillance and response platform. Sell it to hospitals, public health agencies, and governments needing real-time capacity planning and resource allocation.' },
      'vaccine_development':  { why: 'Vaccine development timelines are being compressed. Clinical trials need massive enrollment fast. Manufacturing scale-up is the bottleneck.', move: 'Build a clinical trial acceleration platform for infectious disease. Sell it to vaccine developers and BARDA for emergency use authorization pathways.' },
      'supply_chain_disruption': { why: 'Medical supply chains are breaking. PPE, ventilators, and essential drugs cannot reach hospitals fast enough.', move: 'Build a medical supply chain visibility platform. Sell it to hospital systems and GPOs needing real-time inventory and alternative sourcing.' },
      'healthcare_surge':     { why: 'Hospitals are beyond capacity. Elective procedures are cancelled. Staff are burned out and getting sick.', move: 'Build a surge capacity management platform. Sell it to hospital systems needing rapid bed expansion, staff redeployment, and patient transfer coordination.' }
    },
    'DRUG_RESISTANCE': {
      'resistance_mutation':  { why: 'Pathogens are evolving resistance mutations faster than new drugs are being developed. Standard empiric therapy is failing.', move: 'Build a resistance pattern analytics platform. Sell it to hospitals and antibiotic developers needing real-time resistance data for treatment and R&D decisions.' },
      'stewardship_failure':  { why: 'Antibiotic stewardship programs are not being followed. Broad-spectrum antibiotics are overused, accelerating resistance.', move: 'Build an antibiotic stewardship decision support tool. Sell it to hospitals needing to improve prescribing and reduce resistance development.' }
    },
    'HEALTHCARE_COLLAPSE': {
      'workforce_shortage':   { why: 'Physicians and nurses are leaving the profession. Remaining staff are burned out. Facilities cannot maintain safe staffing ratios.', move: 'Build a healthcare workforce optimization platform. Sell it to hospital systems and staffing agencies needing demand forecasting and retention analytics.' },
      'facility_closure':     { why: 'Hospitals and clinics are closing in rural and underserved areas. Populations are losing access to basic healthcare services.', move: 'Build a healthcare access analytics platform. Sell it to state health departments and health systems needing to identify and respond to care deserts.' }
    },
    'MENTAL_HEALTH_CRISIS': {
      'demand_surge':         { why: 'Mental health demand has surged beyond available provider capacity. Waitlists exceed 60 days. Emergency psychiatric visits are increasing.', move: 'Build a mental health access optimization platform. Sell it to health systems and payers needing to match patients to available providers and digital interventions.' },
      'workforce_shortage':   { why: 'There are not enough psychiatrists, psychologists, or therapists. Rural areas have almost no mental health providers.', move: 'Build a telepsychiatry platform enabling remote psychiatric care delivery to underserved areas. Sell it to FQHCs and rural health systems.' }
    },
    'CHRONIC_DISEASE_LOAD': {
      'prevalence_increase':  { why: 'Chronic disease rates keep climbing. Obesity, diabetes, heart failure, and CKD are consuming 90%+ of healthcare spending.', move: 'Build a chronic disease population management platform. Sell it to ACOs and health plans needing to reduce total cost of care for their sickest patients.' },
      'treatment_burden':     { why: 'Patients with multiple chronic conditions face impossible treatment complexity. Polypharmacy, conflicting guidelines, and appointment burden lead to poor outcomes.', move: 'Build an integrated care planning tool for multi-morbidity. Sell it to primary care practices and care management companies serving complex patients.' }
    }
  };

  var MECH_FALLBACK = {
    'pathogen_spread':         { why: 'A pathogen is spreading faster than containment can respond.', move: 'Build a surveillance and response coordination platform.' },
    'vaccine_development':     { why: 'Vaccine development is being accelerated under emergency conditions.', move: 'Build clinical trial acceleration tools for infectious disease.' },
    'supply_chain_disruption': { why: 'Medical supply chains are disrupted. Critical items are unavailable.', move: 'Build supply chain visibility and alternative sourcing tools.' },
    'healthcare_surge':        { why: 'Healthcare facilities are beyond normal operating capacity.', move: 'Build surge capacity management and patient flow tools.' },
    'resistance_mutation':     { why: 'Antimicrobial resistance is evolving faster than new drug development.', move: 'Build resistance pattern analytics for clinical and research use.' },
    'stewardship_failure':     { why: 'Antimicrobial stewardship programs are not effectively reducing resistance.', move: 'Build prescribing decision support tools to improve stewardship.' },
    'workforce_shortage':      { why: 'Healthcare workforce is insufficient to meet demand.', move: 'Build workforce optimization and retention analytics platforms.' },
    'facility_closure':        { why: 'Healthcare facilities are closing, creating care access gaps.', move: 'Build access analytics to identify and respond to care deserts.' },
    'demand_surge':            { why: 'Patient demand is exceeding available healthcare capacity.', move: 'Build demand management and patient-provider matching platforms.' },
    'prevalence_increase':     { why: 'Disease prevalence is increasing beyond the capacity to treat.', move: 'Build population health management platforms for chronic disease.' },
    'treatment_burden':        { why: 'Treatment complexity is overwhelming patients and providers.', move: 'Build integrated care planning tools for multi-morbidity management.' }
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

  // ══════════════════════════════════════════════════════════════════════
  // DEEP INTELLIGENCE
  // ══════════════════════════════════════════════════════════════════════

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
    if (di.monitoring) { h += '<div class="eos-deep-section"><div class="eos-deep-label">MONITORING PROTOCOL</div><div class="eos-deep-text">' + esc(typeof di.monitoring === 'string' ? di.monitoring : JSON.stringify(di.monitoring)) + '</div></div>'; }
    if (di.escalation) { h += '<div class="eos-deep-section"><div class="eos-deep-label">IF THIS FAILS</div><div class="eos-deep-text">' + esc(typeof di.escalation === 'string' ? di.escalation : JSON.stringify(di.escalation)) + '</div></div>'; }
    if (di.targetPathway) { h += '<div class="eos-deep-section"><div class="eos-deep-label">STRATEGY PATH</div><div class="eos-deep-text">' + esc(di.targetPathway.replace(/->/g, ' \u2192 ').replace(/_/g, ' ')) + '</div></div>'; }
    if (di.citations && di.citations.length > 0) { h += '<div class="eos-deep-section"><div class="eos-deep-label">SOURCES (' + di.citations.length + ')</div>'; for (var ci = 0; ci < di.citations.length; ci++) { var c = di.citations[ci]; var citeStr = typeof c === 'string' ? c : (c.author || '') + ' (' + (c.year || '') + '). ' + (c.title || '') + '. ' + (c.journal || '') + (c.doi ? ' doi:' + c.doi : ''); h += '<div class="eos-deep-cite">' + esc(citeStr) + '</div>'; } h += '</div>'; }
    else if (di.cite) { h += '<div class="eos-deep-section"><div class="eos-deep-label">SOURCES</div><div class="eos-deep-cite">' + esc(di.cite) + '</div></div>'; }
    if (di.ancestryPath && di.ancestryPath.length > 0) { h += '<div class="eos-deep-section"><div class="eos-deep-label">PORTAL LINEAGE</div><div class="eos-deep-text">' + di.ancestryPath.map(function (p) { return esc(p); }).join(' \u2192 ') + ' (L' + (di.depth || '?') + ')</div></div>'; }
    if (di.portalDomainId || (di.ancestryPath && di.ancestryPath.length > 0)) { var _pid = di.portalDomainId || di.ancestryPath[di.ancestryPath.length - 1]; h += '<div style="margin-top:6px"><button class="eos-deep-toggle" data-portal-source="' + esc(_pid) + '" style="font-size:0.22rem;letter-spacing:1px;color:rgba(74,143,212,0.6);border:1px solid rgba(74,143,212,0.15);padding:2px 8px;border-radius:2px">\u{1F50E} OPEN SOURCE PORTAL</button><div id="portal-inline-' + esc(_pid) + '" style="display:none;margin-top:6px;padding:8px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"></div></div>'; }
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DRILL DEEPER
  // ══════════════════════════════════════════════════════════════════════

  var _branchIndex = null;
  var _branchIndexFailed = false;

  function _loadBranchIndex() {
    if (_branchIndex) return Promise.resolve(_branchIndex);
    if (_branchIndexFailed) return Promise.resolve(null);
    return fetch('/assets/data/deep/medicine-branch-index.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { _branchIndex = data; return data; })
      .catch(function () { _branchIndexFailed = true; return null; });
  }

  function renderDrillDeeper(opp) {
    if (!opp || !opp._omittedSiblingCount || opp._omittedSiblingCount <= 0) return '';
    var dir = opp._directive || {};
    var drillId = 'drill-' + (++_deepToggleCounter);
    var h = '<div style="margin-top:6px">';
    h += '<button class="eos-deep-toggle" data-drill-id="' + drillId + '" data-node="' + esc(dir.nodeId || opp.nodeId || '') + '" data-ancestry="' + esc((dir.ancestryPath || opp.ancestryPath || []).join(',')) + '" style="color:rgba(74,143,212,0.8);border-color:rgba(74,143,212,0.25)">';
    h += '\u{1F50D} DRILL DEEPER \u00b7 ' + opp._omittedSiblingCount + ' related branches</button>';
    h += '<div id="' + drillId + '" class="eos-deep-body" style="max-height:400px;overflow-y:auto"></div>';
    h += '</div>';
    return h;
  }

  function _handleDrillClick(drillId, nodeId, ancestryStr) {
    var container = document.getElementById(drillId);
    if (!container) return;
    if (container.classList.contains('open')) { container.classList.remove('open'); return; }
    container.innerHTML = '<div style="color:#807868;padding:8px">Loading branch index\u2026</div>';
    container.classList.add('open');
    _loadBranchIndex().then(function (idx) {
      if (!idx || !idx.branches) { container.innerHTML = '<div style="color:#807868;padding:8px">Branch index unavailable</div>'; return; }
      var ancestry = ancestryStr ? ancestryStr.split(',') : [];
      var ancestryRoot = ancestry.length >= 2 ? ancestry[1] : '';
      var relevant = [];
      for (var i = 0; i < idx.branches.length; i++) {
        var b = idx.branches[i]; var score = 0;
        if (b.nodeId === nodeId) score += 10;
        if (ancestryRoot && b.ancestryPath && b.ancestryPath.length >= 2 && b.ancestryPath[1] === ancestryRoot) score += 5;
        if (b.parentBranch && ancestry.indexOf(b.parentBranch) !== -1) score += 3;
        if (score > 0) { b._relevance = score + (b.richness || 0); relevant.push(b); }
      }
      relevant.sort(function (a, b) { return b._relevance - a._relevance; });
      relevant = relevant.slice(0, 20);
      if (relevant.length === 0) { container.innerHTML = '<div style="color:#807868;padding:8px">No closely related branches found</div>'; return; }
      var h = '';
      for (var ri = 0; ri < relevant.length; ri++) {
        var br = relevant[ri]; var badges = '';
        if (br.hasMonitoring) badges += '<span style="color:rgba(74,143,212,0.7);margin-right:4px">monitoring</span>';
        if (br.hasCitations) badges += '<span style="color:rgba(90,181,160,0.7);margin-right:4px">citations</span>';
        if (br.hasEscalation) badges += '<span style="color:rgba(201,169,78,0.7);margin-right:4px">escalation</span>';
        h += '<div style="padding:6px 8px;margin-bottom:4px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center"><div>';
        h += '<div style="font-size:0.32rem;color:#c0b8a5">' + esc(br.treatmentLabel) + '</div>';
        h += '<div style="font-size:0.24rem;color:#807868">' + esc(br.portalDomainId) + ' \u00b7 L' + br.depth + ' \u00b7 ' + esc(br.nodeId) + '</div>';
        h += '<div style="font-size:0.22rem;margin-top:2px">' + badges + '</div></div>';
        h += '<button class="eos-deep-toggle" data-load-branch="' + esc(br.portalDomainId) + '" style="font-size:0.22rem;white-space:nowrap">LOAD BRANCH</button></div>';
        h += '<div id="branch-content-' + esc(br.portalDomainId) + '" style="display:none;margin-top:6px;padding:6px;border-top:1px solid rgba(74,143,212,0.1)"></div></div>';
      }
      container.innerHTML = h;
    });
  }

  function _handleLoadBranch(portalDomainId) {
    var contentEl = document.getElementById('branch-content-' + portalDomainId);
    if (!contentEl) return;
    if (contentEl.style.display !== 'none') { contentEl.style.display = 'none'; return; }
    contentEl.style.display = 'block';
    contentEl.innerHTML = '<div style="color:#807868;font-size:0.28rem">Loading ' + portalDomainId + '\u2026</div>';
    fetch('/assets/data/domains/' + encodeURIComponent(portalDomainId) + '.json').then(function(r) { if (r.ok) return r; return fetch('/api/fetch-portal?domainId=' + encodeURIComponent(portalDomainId)); })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var h = ''; var acts = data.activations || [];
        for (var ai = 0; ai < acts.length; ai++) { var a = acts[ai]; for (var ti = 0; ti < (a.treatments || []).length; ti++) { var t = a.treatments[ti]; if (!t.monitoring && !t.escalation && !t.citation && !t.cite) continue; h += '<div style="margin-bottom:8px"><div style="font-size:0.30rem;color:#d0c8b8;font-weight:600">' + esc(t.label || '') + '</div>'; if (t.monitoring) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">MONITORING</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.monitoring === 'string' ? t.monitoring.substring(0, 400) : '') + '</span></div>'; if (t.escalation) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">IF THIS FAILS</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.escalation === 'string' ? t.escalation.substring(0, 400) : '') + '</span></div>'; if (t.cite) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">SOURCES</span><br><span style="font-size:0.26rem;color:#908878">' + esc(typeof t.cite === 'string' ? t.cite.substring(0, 300) : '') + '</span></div>'; h += '</div>'; break; } }
        if (!h) h = '<div style="color:#807868;font-size:0.28rem">No deep content in this branch</div>';
        h += '<div style="margin-top:6px"><button class="eos-deep-toggle" data-portal-source="' + portalDomainId + '" style="font-size:0.22rem;letter-spacing:1px;color:rgba(74,143,212,0.6);border:1px solid rgba(74,143,212,0.15);padding:2px 8px;border-radius:2px">\u{1F50E} OPEN SOURCE PORTAL</button><div id="portal-inline-' + portalDomainId + '" style="display:none;margin-top:6px;padding:8px;border-left:2px solid rgba(74,143,212,0.15);background:rgba(74,143,212,0.02)"></div></div>';
        contentEl.innerHTML = h;
      })
      .catch(function () { contentEl.innerHTML = '<div style="color:#e85454;font-size:0.28rem">Failed to load branch</div>'; });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PORTAL SOURCE — tries HTML first, falls back to API branch loading
  // ══════════════════════════════════════════════════════════════════════

  function _handlePortalSource(pid) {
    // Check if portal HTML exists on Vercel via HEAD request
    var htmlUrl = '/' + pid + '_portal.html';
    fetch(htmlUrl, { method: 'HEAD' }).then(function (r) {
      if (r.ok || r.status === 308) {
        // HTML exists — open in new tab
        window.open(htmlUrl, '_blank');
      } else {
        // HTML not deployed — fall back to API branch loading inline
        _loadBranchInline(pid);
      }
    }).catch(function () {
      _loadBranchInline(pid);
    });
  }

  function _loadBranchInline(pid) {
    var el = document.getElementById('portal-inline-' + pid);
    if (!el) {
      // No inline container — just fetch and show in alert-style
      fetch('/assets/data/domains/' + encodeURIComponent(pid) + '.json').then(function(r) { if (r.ok) return r; return fetch('/api/fetch-portal?domainId=' + encodeURIComponent(pid)); }).then(function (r) { return r.json(); }).then(function (data) {
        var h = '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0e1018;border:1px solid rgba(74,143,212,0.3);border-radius:4px;padding:16px 20px;max-width:600px;max-height:80vh;overflow-y:auto;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.6)">';
        h += '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:0.28rem;letter-spacing:2px;color:rgba(74,143,212,0.7)">SOURCE PORTAL: ' + pid + '</span><button onclick="this.parentNode.parentNode.remove()" style="background:none;border:none;color:#908878;cursor:pointer;font-size:0.4rem">\u2715</button></div>';
        h += _renderBranchContent(data);
        h += '</div>';
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(5,8,16,0.7);z-index:9998';
        overlay.onclick = function () { overlay.remove(); };
        overlay.innerHTML = h;
        document.body.appendChild(overlay);
      }).catch(function () {});
      return;
    }
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = '<div style="color:#807868;font-size:0.28rem">Loading source portal\u2026</div>';
    fetch('/assets/data/domains/' + encodeURIComponent(pid) + '.json').then(function(r) { if (r.ok) return r; return fetch('/api/fetch-portal?domainId=' + encodeURIComponent(pid)); }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (data) {
      el.innerHTML = _renderBranchContent(data);
    }).catch(function () {
      el.innerHTML = '<div style="color:#e85454;font-size:0.28rem">Failed to load source portal</div>';
    });
  }

  function _renderBranchContent(data) {
    var h = '';
    for (var ai = 0; ai < (data.activations || []).length; ai++) {
      var a = data.activations[ai];
      for (var ti = 0; ti < (a.treatments || []).length; ti++) {
        var t = a.treatments[ti];
        if (!t.monitoring && !t.escalation && !t.citation && !t.cite) continue;
        h += '<div style="margin-bottom:8px">';
        h += '<div style="font-size:0.30rem;color:#d0c8b8;font-weight:600">' + esc(t.label || '') + '</div>';
        if (t.monitoring) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">MONITORING</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.monitoring === 'string' ? t.monitoring.substring(0, 400) : '') + '</span></div>';
        if (t.escalation) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">IF THIS FAILS</span><br><span style="font-size:0.28rem;color:#a09888">' + esc(typeof t.escalation === 'string' ? t.escalation.substring(0, 400) : '') + '</span></div>';
        if (t.cite) h += '<div style="margin-top:3px"><span style="font-size:0.22rem;color:rgba(74,143,212,0.6);letter-spacing:1px">SOURCES</span><br><span style="font-size:0.26rem;color:#908878">' + esc(typeof t.cite === 'string' ? t.cite.substring(0, 300) : '') + '</span></div>';
        h += '</div>';
        break;
      }
    }
    if (!h) h = '<div style="color:#807868;font-size:0.28rem">No deep content in this portal</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // ANCHOR DIRECTIVE
  // ══════════════════════════════════════════════════════════════════════

  function renderAnchorDirective(state) {
    var opps = state.opportunities || [];
    var anchor = null; var bestProofScore = -1;
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
    if (!anchor) return '';
    var mc = anchor.moneyChain || {}; var dir = anchor._directive || {}; var companies = anchor.examples || []; var steps = anchor.steps || [];
    var h = '<div class="eos-anchor">';
    h += '<div class="eos-anchor-label">TOP DIRECTIVE \u2014 ACTION NOW';
    if (anchor._mechanism && anchor._mechanism.primaryLabel) { h += ' <span style="margin-left:8px;padding:2px 6px;border:1px solid rgba(90,181,160,0.3);border-radius:2px;color:#5ab5a0;font-size:0.22rem;font-weight:600;letter-spacing:1px">' + esc(anchor._mechanism.primaryLabel.toUpperCase()) + '</span>'; }
    h += '</div>';
    h += '<div class="eos-anchor-title">' + esc(anchor.title) + '</div>';
    var explain = anchor.explain || mc.doThis || '';
    if (explain) h += '<div class="eos-anchor-explain">' + esc(explain) + '</div>';
    h += renderMechanismBlock(anchor, 'anchor');
    h += '<div class="eos-anchor-grid">';
    h += '<div class="eos-anchor-block"><div class="eos-anchor-block-label">' + (anchor._stepsArePortalNative ? 'WHAT TO DO \u00b7 PORTAL-DERIVED' : 'WHAT TO DO \u00b7 OPERATOR SYNTHESIS') + '</div><div class="eos-anchor-block-text">';
    if (steps.length > 0) { for (var si = 0; si < Math.min(steps.length, 5); si++) { var stepText = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || steps[si].label || ''); h += '<div class="eos-anchor-step"><b>' + (si + 1) + '.</b> ' + esc(stepText) + '</div>'; } }
    else if (mc.doThis) h += esc(mc.doThis); else h += esc(anchor.action || 'Execute via operator pathway');
    h += '</div></div>';
    h += '<div class="eos-anchor-block"><div class="eos-anchor-block-label">WHO TO TARGET</div><div class="eos-anchor-block-text">';
    if (companies.length > 0) { for (var ci = 0; ci < Math.min(companies.length, 5); ci++) h += '<div style="padding:1px 0">' + esc(companies[ci]) + '</div>'; }
    if (mc.target) h += '<div style="margin-top:3px;color:#a09888;font-size:0.30rem">' + esc(mc.target) + '</div>';
    if (!companies.length && !mc.target) h += 'See mapped companies in action queue';
    h += '</div></div>';
    h += '<div class="eos-anchor-block"><div class="eos-anchor-block-label">HOW MONEY IS MADE</div><div class="eos-anchor-block-text">';
    if (mc.whyPays) h += esc(mc.whyPays); else h += esc(anchor.outcome || anchor.valueRange || 'See monetization path in expanded view');
    h += '</div></div>';
    h += '<div class="eos-anchor-block"><div class="eos-anchor-block-label">DELIVERABLE &middot; TIMING</div><div class="eos-anchor-block-text">';
    if (anchor._shapedDeliverable) h += '<div style="margin-bottom:4px"><b style="color:#d0c8b8">Produce:</b> ' + esc(anchor._shapedDeliverable) + '</div>';
    if (mc.nextStep) h += '<div style="margin-bottom:3px"><b style="color:#5ab5a0">Next:</b> ' + esc(mc.nextStep) + '</div>';
    if (mc.timing) h += '<div><b style="color:#C9A94E">Window:</b> ' + esc(mc.timing) + '</div>';
    if (anchor.valueRange) h += '<div style="margin-top:2px;color:#5ab5a0">' + esc(anchor.valueRange) + '</div>';
    h += '</div></div></div>';

    // ── SOURCE INTELLIGENCE PROOF BLOCK ──
    // Always render so the operator can see provenance, even on shallow anchors.
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
    if (lineageParts.length > 0) h += '<div class="eos-anchor-lineage">\u25B8 ' + lineageParts.join(' \u2192 ') + '</div>';
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEEP PROOF BLOCK
  // ══════════════════════════════════════════════════════════════════════

  function renderDeepProofBlock(state) {
    var opps = state.opportunities || []; var deep = null; var bestScore = -1;
    for (var i = 0; i < opps.length; i++) { var o = opps[i]; if (o.source !== 'portal_directive' || !o._directive) continue; var depth = (o._directive.depth != null) ? o._directive.depth : 0; if (depth < 2) continue; var score = depth * 0.2 + (o._richness || 0) * 0.15 + (o._stepsArePortalNative ? 0.2 : 0) + (o.rank || 0) * 0.3; if (o._deepIntel && o._deepIntel.monitoring) score += 0.1; if (o._deepIntel && o._deepIntel.citations && o._deepIntel.citations.length > 0) score += 0.1; if (score > bestScore) { bestScore = score; deep = o; } }
    if (!deep) return '';
    var dir = deep._directive || {}; var steps = deep.steps || [];
    var h = '<div class="eos-deepproof"><div class="eos-deepproof-label">DEEP PROOF \u2014 FRACTAL INTELLIGENCE';
    if (deep._mechanism && deep._mechanism.primaryLabel) h += ' <span style="margin-left:8px;padding:2px 6px;border:1px solid rgba(74,143,212,0.3);border-radius:2px;color:rgba(74,143,212,0.9);font-size:0.22rem;font-weight:600;letter-spacing:1px">' + esc(deep._mechanism.primaryLabel.toUpperCase()) + '</span>';
    h += '</div>';
    h += '<div class="eos-deepproof-title">' + esc(deep.title) + '</div>';
    h += '<div class="eos-deepproof-why">Deepest high-quality directive from ';
    if (deep.diagnosisId) h += esc(deep.diagnosisId.replace(/_/g, ' '));
    h += ' branch. Depth L' + (dir.depth || '?');
    if (dir.portalTitle) h += ' via ' + esc(dir.portalTitle);
    h += '. Deeper portal layers reveal more specific, actionable treatment protocols than the top-level brain.</div>';
    h += renderMechanismBlock(deep, 'deep');
    if (steps.length > 0) { h += '<div class="eos-deepproof-steps"><div style="font-size:0.24rem;letter-spacing:1px;color:rgba(74,143,212,0.6);margin-bottom:3px">STEPS</div>'; for (var si = 0; si < Math.min(steps.length, 4); si++) { var st = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || steps[si].label || ''); h += '<div><b>' + (si + 1) + '.</b> ' + esc(st) + '</div>'; } h += '</div>'; }
    h += renderDeepIntel(deep, 'EXPAND DEEP INTELLIGENCE');
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 1: MONEY SUMMARY
  // ══════════════════════════════════════════════════════════════════════

  function buildMoneySummary(state) {
    var stress = state.stress || 0; var pct = Math.round(stress * 100);
    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var opps = state.opportunities || []; var pulse = state.pulse || null;
    var grantCount = opps.filter(function (o) { return o.path === 'GRANT-ELIGIBLE'; }).length;
    var investCount = opps.filter(function (o) { return o.path === 'INVESTABLE'; }).length;
    var patentCount = opps.filter(function (o) { return o.path === 'PATENTABLE'; }).length;
    var h = ''; var text = '';
    if (pulse) { var freshPct = Math.round(pulse.freshnessScore * 100); if (freshPct < 50) h += '<div style="font-size:0.34rem;color:#e85454;padding:4px 8px;margin-bottom:8px;border:1px solid rgba(232,84,84,0.15);border-radius:2px;background:rgba(232,84,84,0.04)">\u26A0 Feed freshness at ' + freshPct + '% \u2014 some data may be stale.</div>'; }
    if (pct >= 70) { text = '<b>Healthcare stress at ' + pct + '% \u2014 crisis territory.</b> Multiple stress pathways are active. Pandemic pressure, drug resistance, or system collapse is under way. '; if (activeDx.length > 0) text += activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' confirmed.'; }
    else if (pct >= 50) { text = '<b>Healthcare stress at ' + pct + '% \u2014 elevated.</b> One or more medical subsystems are showing strain. '; if (activeDx.length > 0) text += activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + '.'; }
    else if (pct >= 25) { text = '<b>Healthcare stress at ' + pct + '%.</b> Above baseline but within normal range. '; if (activeDx.length > 0) text += activeDx.length + ' pathway' + (activeDx.length > 1 ? 's' : '') + ' active. '; text += 'Monitoring for escalation.'; }
    else if (pct > 0) { text = '<b>Healthcare stress at ' + pct + '%.</b> Within normal range. No acute pressure on healthcare delivery. '; }
    else { text = '<b>Medical feeds loading.</b> Waiting for live healthcare data. Assessments are provisional until live data arrives.'; }
    var companies = state.companies || [];
    if (companies.length > 0) { var tc = 0, sc = 0; for (var ci = 0; ci < companies.length; ci++) { if (companies[ci].phase === 'terminal' || companies[ci].phase === 'rupture') tc++; else if (companies[ci].phase === 'stressed' || companies[ci].phase === 'warning') sc++; } if (tc > 0) text += ' <b style="color:#e85454">' + tc + ' company(ies) in terminal/rupture phase</b> (kernel-validated).'; if (sc > 0) text += ' ' + sc + ' company(ies) in stress/warning phase.'; }
    var parts = [];
    if (grantCount > 0) parts.push(grantCount + ' grant path' + (grantCount > 1 ? 's' : ''));
    if (investCount > 0) parts.push(investCount + ' investment position' + (investCount > 1 ? 's' : ''));
    if (patentCount > 0) parts.push(patentCount + ' patent opportunit' + (patentCount > 1 ? 'ies' : 'y'));
    if (parts.length > 0) text += ' Currently showing <b>' + parts.join(', ') + '</b> ready for action.';
    h += '<div class="eos-summary">' + text + '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 2: TOP 3 MONEY PLAYS
  // ══════════════════════════════════════════════════════════════════════

  function buildTopPlays(state) {
    var opps = (state.opportunities || []).slice();
    if (opps.length === 0) return '';
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    var top = opps.slice(0, 3);
    var h = '<div class="eos-plays">';
    for (var i = 0; i < top.length; i++) {
      var o = top[i]; var title = (o.title || '').replace(/_/g, ' '); title = title.charAt(0).toUpperCase() + title.slice(1);
      h += '<div class="eos-play"><span class="eos-play-rank">' + (i + 1) + '</span>';
      h += '<div class="eos-play-name">' + esc(title) + '</div>';
      h += '<span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span>';
      h += promotedBadge(o);
      if (o.moneyChain) { h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.5;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.15)"><b style="color:#C9A94E">WHY THIS MAKES MONEY:</b><br>'; if (o.moneyChain.doThis) h += '<span style="color:#d0c8b8">Do this:</span> ' + esc(o.moneyChain.doThis) + '<br>'; if (o.moneyChain.whyPays) h += '<span style="color:#d0c8b8">Why it pays:</span> ' + esc(o.moneyChain.whyPays); h += '</div>'; }
      else h += '<div class="eos-play-why">' + esc(o.explain || o.title) + '</div>';
      h += '<div class="eos-play-outcome">Expected: ' + esc(o.valueRange || o.outcome || 'See playbook detail') + '</div>';
      if (o.source === 'portal_directive') h += renderDeepIntel(o, 'MORE INTELLIGENCE');
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
    if (opps.length === 0) return '';
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    var statuses = getStatusMap();
    var h = '<table class="eos-queue"><thead><tr><th>#</th><th>OPPORTUNITY</th><th>PATH</th><th>WHY THIS MAKES MONEY</th><th>NEXT STEP</th></tr></thead><tbody>';
    for (var i = 0; i < opps.length; i++) {
      var o = opps[i]; var key = o.id || oppKey(o); var currentStatus = statuses[key] || 'NEW';
      var title = (o.title || '').replace(/_/g, ' '); title = title.charAt(0).toUpperCase() + title.slice(1);
      var whyFull = o.explain || o.action || o.title; var mc = o.moneyChain || null;
      var step = o.action || (o.fastPath && o.fastPath.length > 0 ? o.fastPath[0] : 'Open detail for execution steps');
      var statusHTML = ''; var STATUSES = ['NEW', 'WIP', 'DONE', 'WATCH']; var STATUS_CLASS = { 'NEW': 'active-new', 'WIP': 'active-wip', 'DONE': 'active-done', 'WATCH': 'active-watch' };
      for (var si = 0; si < STATUSES.length; si++) { var st = STATUSES[si]; statusHTML += '<button class="eos-status-btn' + (currentStatus === st ? ' ' + STATUS_CLASS[st] : '') + '" data-key="' + esc(key) + '" data-status="' + st + '">' + st + '</button>'; }
      var whyCell = '<div class="money-thesis-cell"><div class="money-thesis-preview">' + esc(whyFull) + '</div>';
      whyCell += '<div class="money-thesis-expanded hidden">' + esc(whyFull);
      if (mc) { whyCell += '<div class="money-thesis-detail">'; if (mc.doThis) whyCell += '<span class="mtd-label">DO THIS</span>' + esc(mc.doThis); if (mc.whyPays) whyCell += '<span class="mtd-label">WHY THIS PAYS</span>' + esc(mc.whyPays); if (mc.target) whyCell += '<span class="mtd-label">TARGET</span>' + esc(mc.target); if (mc.timing) whyCell += '<span class="mtd-label">TIMING</span>' + esc(mc.timing); whyCell += '</div>'; }
      if (o.source === 'portal_directive' && o._deepIntel) whyCell += renderDeepIntel(o, 'PORTAL INTELLIGENCE');
      whyCell += '</div>';
      whyCell += '<button class="money-thesis-toggle" onclick="this.previousElementSibling.classList.toggle(\'hidden\');this.parentElement.querySelector(\'.money-thesis-preview\').style.display=this.previousElementSibling.classList.contains(\'hidden\')?\'\':\'none\';this.textContent=this.previousElementSibling.classList.contains(\'hidden\')?\'MORE\':\'LESS\'">MORE</button></div>';
      h += '<tr><td class="eos-queue-pri">' + (i + 1) + '</td>';
      h += '<td class="eos-queue-name">' + esc(title) + promotedBadge(o) + '</td>';
      h += '<td><span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span></td>';
      h += '<td class="eos-queue-why">' + whyCell + '</td>';
      h += '<td class="eos-queue-step">' + esc(step) + '</td></tr>';
      // removed: GRANT/PATENT/BUILD workspace buttons — lanes dropped
    }
    h += '</tbody></table>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER — builds operator view content
  // ══════════════════════════════════════════════════════════════════════

  var _bridgeInitialized = false;

  function renderOperator() {
    if (!_operatorView) return;
    var state = getState();
    if (!state) return;

    var bridge = window.LIMENMedicinePromotionBridge;
    console.log('[MedicineOperator] renderOperator: bridge=' + !!bridge + ' bridgeInit=' + _bridgeInitialized);
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('health') : null;
      var portalCache = brain ? brain._portalCache : null;
      if (portalCache) {
        if (!_bridgeInitialized) {
          _bridgeInitialized = true;
          bridge.promote(state, portalCache, { limit: 5 }).then(function (promoted) {
            if (promoted && promoted.length > 0) { var fs = getState(); if (fs) _renderOperatorDOM(fs); }
          }).catch(function (err) { console.error('[MedicineOperator] Bridge error:', err); });
        } else { bridge.promote(state, portalCache, { limit: 5 }); }
      } else if (!_bridgeInitialized) {
        console.log('[MedicineOperator] Portal cache not ready — scheduling 5s retry');
        setTimeout(function () {
          var rb = brains ? brains.get('health') : null;
          var rc = rb ? rb._portalCache : null;
          if (rc && bridge) { _bridgeInitialized = true; var rs = getState(); if (rs) bridge.promote(rs, rc, { limit: 5 }).then(function (p) { if (p && p.length > 0) { var fs = getState(); if (fs) _renderOperatorDOM(fs); } }); }
        }, 5000);
      }
    }
    _renderOperatorDOM(state);
  }

  function _renderOperatorDOM(state) {
    var h = '';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    h += '<div class="eos-title" style="margin-bottom:0">MEDICINE \u00b7 OPERATOR SURFACE</div>';
    h += '<div style="display:flex;gap:6px;align-items:center">';
    h += '<button id="med-back-to-console" style="font-family:monospace;font-size:0.32rem;letter-spacing:2px;text-transform:uppercase;padding:3px 10px;border:1px solid rgba(201,169,78,0.12);border-radius:2px;background:none;color:rgba(200,195,184,0.35);cursor:pointer">\u2190 CONSOLE</button>';
    h += '</div></div>';

    // Diagnosis status panel
    var allDx = state.diagnoses || []; var activeDxList = allDx.filter(function (d) { return d.active; }); var inactiveDxList = allDx.filter(function (d) { return !d.active; });
    var dxContent = '';
    if (activeDxList.length > 0) { for (var adi = 0; adi < activeDxList.length; adi++) { var adx = activeDxList[adi]; dxContent += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.34rem"><span style="color:#5ab5a0">\u25CF ACTIVE</span><span style="color:#e0daca">' + esc((adx.label || adx.id || '').replace(/_/g, ' ')) + '</span><span style="color:#807868;font-size:0.28rem">' + Math.round((adx.relevance || 0) * 100) + '% match</span></div>'; } }
    else { dxContent += '<div style="font-size:0.32rem;color:#908878">No active diagnoses.</div>'; }
    if (inactiveDxList.length > 0) { dxContent += '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:0.26rem;color:#706860;letter-spacing:1px">INACTIVE (' + inactiveDxList.length + ') \u25BC</summary>'; for (var idi = 0; idi < inactiveDxList.length; idi++) { var idx = inactiveDxList[idi]; dxContent += '<div style="font-size:0.30rem;color:#706860;padding:1px 0">\u25CB ' + esc((idx.label || idx.id || '').replace(/_/g, ' ')) + '</div>'; } dxContent += '</details>'; }
    h += wrapCollapsible('diagnosis-status', 'DIAGNOSIS STATUS \u00b7 ' + activeDxList.length + ' ACTIVE \u00b7 ' + inactiveDxList.length + ' INACTIVE', dxContent, false);

    h += renderAnchorDirective(state);
    h += renderDeepProofBlock(state);
    h += buildMoneySummary(state);
    h += wrapCollapsible('top-plays', 'TOP MONEY PLAYS', buildTopPlays(state), false);
    h += wrapCollapsible('action-queue', 'ACTION QUEUE', buildActionQueue(state), false);

    _operatorView.innerHTML = h;

    // Wire back button
    var backBtn = document.getElementById('med-back-to-console');
    if (backBtn) backBtn.addEventListener('click', switchToConsole);

    // Wire status buttons
    var btns = _operatorView.querySelectorAll('.eos-status-btn');
    for (var i = 0; i < btns.length; i++) { btns[i].addEventListener('click', function (e) { e.stopPropagation(); var key = this.getAttribute('data-key'); var status = this.getAttribute('data-status'); setStatus(key, status); var row = this.parentNode; var siblings = row.querySelectorAll('.eos-status-btn'); var SC = { 'NEW': 'active-new', 'WIP': 'active-wip', 'DONE': 'active-done', 'WATCH': 'active-watch' }; for (var j = 0; j < siblings.length; j++) siblings[j].className = 'eos-status-btn' + (siblings[j].getAttribute('data-status') === status ? ' ' + SC[status] : ''); }); }

    // Wire GRANT/PATENT/BUILD buttons
    // removed: GRANT/PATENT/BUILD workspace wiring
    var medicine = window.LIMENMedicine && window.LIMENMedicine.economy;
    if (medicine && medicine.panel) { medicine.panel.inject(); }

    // Mount business review panel
    if (window.LIMENMedicineBusinessReview) { window.LIMENMedicineBusinessReview.mount(_operatorView); }
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIEW SWITCHING
  // ══════════════════════════════════════════════════════════════════════

  function switchToOperator() {
    var cv = document.getElementById('clarity-view');
    if (cv) cv.style.display = 'none';
    if (_operatorView) { _operatorView.style.display = 'block'; renderOperator(); }
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
    if (btnC) btnC.classList.toggle('active', !_isOperatorMode);
    if (btnO) btnO.classList.toggle('active', _isOperatorMode);
  }

  // ══════════════════════════════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════════════════════════════

  function boot() {
    injectStyles();
    var cv = document.getElementById('clarity-view');
    if (!cv) return;
    _operatorView = document.createElement('div');
    _operatorView.id = VIEW_ID;
    _operatorView.style.display = 'none';
    cv.parentNode.insertBefore(_operatorView, cv.nextSibling);

    // Accordion delegation — wired ONCE
    _operatorView.addEventListener('click', function (e) {
      if (e.target.closest('.eos-status-btn') || e.target.closest('button[data-exec-key]') ||
          e.target.closest('button[data-claim-opp]') || e.target.closest('a') ||
          e.target.closest('input') || e.target.closest('select') ||
          e.target.closest('.mbr-btn') || e.target.closest('[data-business-node]')) return;
      var sectionHeader = e.target.closest('.eos-section-header');
      if (sectionHeader) { var sid = sectionHeader.getAttribute('data-section'); var body = _operatorView.querySelector('[data-section-body="' + sid + '"]'); var toggle = sectionHeader.querySelector('.eos-section-toggle'); if (body) { var nowCollapsed = !body.classList.contains('collapsed'); body.classList.toggle('collapsed'); setCollapsed(sid, nowCollapsed); if (toggle) toggle.textContent = nowCollapsed ? '\u25B6' : '\u25BC'; } return; }
      var targetHeader = e.target.closest('.eos-targets-header');
      if (targetHeader) { var tsid = targetHeader.getAttribute('data-section'); var tbody = _operatorView.querySelector('[data-section-body="' + tsid + '"]'); var ttoggle = targetHeader.querySelector('span'); if (tbody) { var nowHidden = tbody.style.display !== 'none'; tbody.style.display = nowHidden ? 'none' : ''; setCollapsed(tsid, nowHidden); if (ttoggle) ttoggle.textContent = nowHidden ? '\u25B6' : '\u25BC'; } return; }
      var targetRow = e.target.closest('.eos-target-row');
      if (targetRow) { var tidx = targetRow.getAttribute('data-target-idx'); var detail = _operatorView.querySelector('[data-target-detail="' + tidx + '"]'); var arrow = targetRow.querySelector('.eos-target-expand'); if (detail) { detail.classList.toggle('open'); if (arrow) arrow.textContent = detail.classList.contains('open') ? '\u25B2' : '\u25BC'; } return; }
      var drillBtn = e.target.closest('[data-drill-id]');
      if (drillBtn) { _handleDrillClick(drillBtn.getAttribute('data-drill-id'), drillBtn.getAttribute('data-node'), drillBtn.getAttribute('data-ancestry')); return; }
      var loadBranchBtn = e.target.closest('[data-load-branch]');
      if (loadBranchBtn) { _handleLoadBranch(loadBranchBtn.getAttribute('data-load-branch')); return; }
      var portalSourceBtn = e.target.closest('[data-portal-source]');
      if (portalSourceBtn) { _handlePortalSource(portalSourceBtn.getAttribute('data-portal-source')); return; }
    });

    // Wire Console/Operator mode buttons
    var btnConsole = document.getElementById('chModeConsole');
    var btnOperator = document.getElementById('chModeOperator');
    if (btnConsole) btnConsole.addEventListener('click', function () { if (_isOperatorMode) switchToConsole(); });
    if (btnOperator) btnOperator.addEventListener('click', function () { if (!_isOperatorMode) switchToOperator(); });

    _booted = true;

    // Auto-open operator if ?mode=operator
    var _params = new URLSearchParams(window.location.search);
    if (_params.get('mode') === 'operator') switchToOperator();

    console.log('[MedicineOperator] Booted \u2014 operator view created, toggle wired');
  }

  // ══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════

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
