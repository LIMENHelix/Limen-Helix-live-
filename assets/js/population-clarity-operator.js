/**
 * population-clarity-operator.js — Money-Driven Action Surface for Population Domain
 *
 * Self-gates: only runs when ?domain=population
 *
 * Sections:
 *   1. TOP DIRECTIVE
 *   2. SOURCE INTELLIGENCE block (inside anchor)
 *   3. DEEP INTELLIGENCE expandable
 *   4. DEEP PROOF — FRACTAL INTELLIGENCE block
 *   5. DRILL DEEPER / LOAD BRANCH
 *   6. TOP MONEY PLAYS
 *   7. ACTION QUEUE
 *   8. BUSINESS REVIEW (mounts population-business-review.js)
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'population' && _dom !== 'population') return;

  var VIEW_ID = 'sos-operator-view';
  var STATUS_KEY = 'limen_population_operator_status';
  var COLLAPSE_KEY = 'limen_population_collapse_state';
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
    var brain = brains.get('population');
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

  // ── POPULATION-NATIVE LANGUAGE ──

  var DX_CONTEXT = {
    'POPULATION_COLLAPSE': {
      what: 'Global fertility rates have fallen below replacement (2.1 TFR) in 60+ countries. South Korea is at 0.72 TFR, China 1.09, Japan 1.20, Italy 1.24, Spain 1.16. Workforce shrinkage is accelerating across OECD nations while dependency ratios invert. Pro-natalist policy interventions (Hungary, Singapore, Japan) show limited efficacy. Causal research points to economic precarity (housing costs, student debt), environmental endocrine disruptors (PFAS, microplastics, phthalates), delayed family formation, contraceptive access expansion, and cultural shifts away from large families. This is a structural civilizational-level transition with no historical precedent at global scale.',
      money: 'Reproductive health technology (IVF, fertility diagnostics, genetic screening), pro-natalist policy consulting, workforce automation to offset shrinking labor pools, immigration processing systems, pension restructuring advisory, and elder-care technology all see surging demand. UNFPA programs expand. Gates Foundation and Wellcome Trust reproductive health funding accelerates. National governments allocate billions to pro-natalist incentive programs.',
      step: 'Track UN Population Division World Population Prospects updates, national vital statistics (CDC NCHS, Eurostat, Japan MHLW), TFR trends by country, UNFPA State of World Population reports, and World Bank fertility indicators. Position in reproductive health (Hologic, CooperSurgical, Natera for NIPT), fertility diagnostics (Thermo Fisher, Illumina), telehealth fertility services (Teladoc, Hims & Hers), and workforce automation (to offset labor shrinkage).',
      outcome: '$50M-$5B+ fertility technology contracts, pro-natalist program spending, pension restructuring advisory, and workforce automation deployment'
    },
    'MASS_MIGRATION': {
      what: '110M+ people forcibly displaced globally (UNHCR 2024), the highest figure ever recorded. Climate migration is accelerating as habitability zones shift. Border infrastructure, asylum processing, refugee settlement, labor market integration, and remittance flows all create massive investment demand. U.S.-Mexico border encounters exceed 2M annually. European Mediterranean crossings, Rohingya displacement, Venezuelan exodus, and African climate migration are concurrent crises.',
      money: 'Border technology and surveillance (sensors, drones, biometrics), immigration processing IT systems, refugee camp infrastructure, labor integration platforms, remittance technology, and settlement housing all see demand. UNHCR, IOM, USAID, and EU asylum budgets expand. Private detention and processing facility operators benefit directly.',
      step: 'Track UNHCR Global Trends reports, IOM World Migration Report, CBP encounter data, Frontex Mediterranean crossing data, and World Bank remittance flows. Position in border technology (L3Harris, Leidos, Axon), immigration IT (Booz Allen, SAIC), infrastructure contractors (Fluor, Parsons, Jacobs), and detention operators (GEO Group, CoreCivic).',
      outcome: '$100M-$10B+ border infrastructure contracts, immigration IT modernization, refugee settlement programs, and labor integration systems'
    },
    'AGING_CRISIS': {
      what: 'Japan is at 29% over-65 population, Italy 24%, Germany 22%, and the ratio is rising across all developed nations. The silver economy is projected to exceed $15T by 2030. Elder care demand is overwhelming existing healthcare and pension systems. Assistive technology, home health, geriatric medicine, and pension restructuring are all under acute pressure. The old-age dependency ratio (65+/working-age) is approaching 50% in Japan and Southern Europe, meaning fewer than two workers per retiree.',
      money: 'Surgical robotics, medical devices, home health services, elder care technology, pension advisory, healthcare facility operators, and insurance companies all benefit from aging demographics. Medicare/Medicaid expansion drives U.S. healthcare capex. Japan and Europe are global leaders in elder care technology adoption. The $15T+ silver economy creates opportunities across healthcare, housing, financial services, and consumer products.',
      step: 'Track WHO Global Health Observatory aging metrics, national pension system solvency reports, OECD Health Statistics, CMS Medicare spending data, and Japan MHLW elder care reports. Position in surgical robotics (Intuitive Surgical), medical devices (Medtronic, Abbott, Stryker, Zimmer Biomet), home health (Amedisys), healthcare operators (HCA, UnitedHealth), and elder-care technology.',
      outcome: '$100M-$10B+ healthcare capex, pension restructuring contracts, elder care technology deployment, and silver economy consumer markets'
    },
    'URBANIZATION_OVERLOAD': {
      what: 'UN projects 68% of humanity will be urban by 2050, up from 56% today. Megacities (10M+) are multiplying across Asia, Africa, and Latin America. Housing shortages, water stress, sanitation gaps, transit overload, and infrastructure strain are now structural conditions in cities from Lagos to Jakarta to Mumbai to Mexico City. Smart city technology demand is accelerating but deployment lags population growth.',
      money: 'Logistics and warehousing REITs, tower and data center operators, water infrastructure companies, construction materials producers, electrical grid contractors, and urban planning technology firms all benefit. World Bank urban development lending expands. National infrastructure bills (U.S. IIJA, EU Green Deal urban components) deploy capital.',
      step: 'Track UN World Urbanization Prospects, World Bank urban development indicators, national housing starts data, water stress indices (WRI Aqueduct), and smart city technology adoption metrics. Position in logistics REITs (Prologis), tower/data centers (American Tower, Equinix, Digital Realty), water infrastructure (American Water Works, Xylem), construction materials (Vulcan, Martin Marietta), and grid contractors (Quanta Services).',
      outcome: '$500M-$50B+ urban infrastructure contracts, housing construction programs, water/sanitation systems, and smart city technology deployments'
    },
    'PANDEMIC_DEMOGRAPHIC_SHOCK': {
      what: 'COVID-19 killed 7M+ officially (20M+ estimated excess mortality). Long COVID affects 10-30% of infected individuals, reducing workforce participation. mRNA platform effects on fertility are under active study (Nature, Lancet). Future pandemic preparedness is now a permanent government budget line. Chronic disease burden (diabetes, cardiovascular, autoimmune) is rising globally and intersects with population health. Antimicrobial resistance threatens to kill 10M/year by 2050.',
      money: 'Vaccine and therapeutics platforms (mRNA, protein subunit), pandemic preparedness infrastructure, public health surveillance systems, long COVID treatment, workforce disability accommodation, and health insurance restructuring all see sustained demand. BARDA, CEPI, Coalition for Epidemic Preparedness, and WHO pandemic preparedness budgets are expanding permanently.',
      step: 'Track WHO Disease Outbreak News, CDC MMWR, IHME Global Burden of Disease updates, excess mortality trackers (The Economist, Our World in Data), and national pandemic preparedness spending. Position in vaccine platforms (Pfizer, Moderna, BioNTech, AstraZeneca), therapeutics (Regeneron, Vertex, Eli Lilly), and health insurance/services (UnitedHealth, AbbVie, Bristol-Myers Squibb).',
      outcome: '$1B-$100B+ pandemic preparedness spending, vaccine platform contracts, public health surveillance systems, and therapeutic development programs'
    }
  };

  var PATH_LABELS = { 'PATENTABLE': 'PATENT', 'GRANT-ELIGIBLE': 'GRANT', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'PATENTABLE': 'eos-path-patent', 'GRANT-ELIGIBLE': 'eos-path-grant', 'INVESTABLE': 'eos-path-invest' };
  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  var DX_TO_PLAYBOOK = {
    'POPULATION_COLLAPSE':        'pop_fertility',
    'MASS_MIGRATION':             'pop_migration',
    'AGING_CRISIS':               'pop_aging',
    'URBANIZATION_OVERLOAD':      'pop_urban',
    'PANDEMIC_DEMOGRAPHIC_SHOCK': 'pop_health'
  };

  var INVEST_TARGETS = {
    'pop_fertility': [
      { ticker: 'HOLX', name: 'Hologic',                         cik: '880149',  validation: 'HELIX_VALIDATED', reason: 'Dominant women\u2019s health diagnostics company; mammography, cervical screening, and reproductive health testing directly tied to fertility monitoring and maternal health surveillance' },
      { ticker: 'TMO',  name: 'Thermo Fisher Scientific',        cik: '97745',   validation: 'HELIX_VALIDATED', reason: 'Fertility diagnostics and IVF laboratory equipment; reproductive endocrinology testing reagents; genetic screening platforms used in preimplantation genetic testing (PGT)' },
      { ticker: 'COO',  name: 'CooperCompanies',                 cik: '711404',  validation: 'HELIX_VALIDATED', reason: 'CooperSurgical is a leading IVF and fertility technology provider; embryo culture media, cryopreservation equipment, and fertility clinic supplies' },
      { ticker: 'ILMN', name: 'Illumina',                        cik: '1110803', validation: 'HELIX_VALIDATED', reason: 'Global leader in genetic sequencing; NIPT (non-invasive prenatal testing), preimplantation genetic screening, and reproductive genomics are core population-health applications' },
      { ticker: 'NTRA', name: 'Natera',                          cik: '1604821', validation: 'HELIX_VALIDATED', reason: 'Market leader in cell-free DNA testing including Panorama NIPT; directly monitors reproductive health outcomes and genetic screening at population scale' },
      { ticker: 'A',    name: 'Agilent Technologies',            cik: '1047469', validation: 'DOMAIN_MAPPED',   reason: 'Reproductive endocrinology testing platforms, hormone assay systems, and laboratory diagnostics used in fertility clinic workflows worldwide' },
      { ticker: 'RGEN', name: 'Repligen',                        cik: '730469',  validation: 'DOMAIN_MAPPED',   reason: 'Bioprocessing equipment supplier for fertility biologics manufacturing; filtration and chromatography systems used in reproductive hormone production' },
      { ticker: 'TDOC', name: 'Teladoc Health',                  cik: '1477449', validation: 'DOMAIN_MAPPED',   reason: 'Telehealth platform expanding fertility consultation access; virtual reproductive health services reach underserved populations globally' },
      { ticker: 'HIMS', name: 'Hims & Hers Health',              cik: '1773751', validation: 'DOMAIN_MAPPED',   reason: 'Direct-to-consumer reproductive and sexual health platform; fertility wellness products and hormone testing kits address population-level reproductive health access' },
      { ticker: 'CORT', name: 'Corcept Therapeutics',            cik: '980858',  validation: 'DOMAIN_MAPPED',   reason: 'Cortisol modulation therapeutics with fertility-adjacent hormonal applications; Cushing syndrome treatment intersects with reproductive endocrine disruption' },
      { ticker: 'PRGO', name: 'Prestige Consumer Healthcare',    cik: '1295947', validation: 'DOMAIN_MAPPED',   reason: 'Consumer reproductive health brands including pregnancy tests, fertility supplements, and over-the-counter reproductive wellness products' }
    ],
    'pop_migration': [
      { ticker: 'GEO',  name: 'The GEO Group',                   cik: '923796',  validation: 'HELIX_VALIDATED', reason: 'Largest private immigration detention operator in the U.S.; ICE processing centers, electronic monitoring, and reentry services directly tied to migration volume' },
      { ticker: 'CXW',  name: 'CoreCivic',                       cik: '1070985', validation: 'HELIX_VALIDATED', reason: 'Second-largest private detention and corrections operator; ICE detention facilities, U.S. Marshals contracts, and immigration processing infrastructure' },
      { ticker: 'FLR',  name: 'Fluor Corporation',                cik: '1124198', validation: 'DOMAIN_MAPPED',   reason: 'Major infrastructure and government services contractor; border facility construction, refugee camp infrastructure, and federal immigration facility engineering' },
      { ticker: 'BAH',  name: 'Booz Allen Hamilton',              cik: '1443646', validation: 'HELIX_VALIDATED', reason: 'Largest IT consulting provider to U.S. government; immigration processing systems, DHS IT modernization, CBP data analytics, and asylum case management platforms' },
      { ticker: 'LDOS', name: 'Leidos',                           cik: '1336920', validation: 'HELIX_VALIDATED', reason: 'Major border technology contractor; CBP surveillance systems, biometric processing, and DHS cybersecurity infrastructure for immigration enforcement' },
      { ticker: 'LHX',  name: 'L3Harris Technologies',            cik: '202058',  validation: 'HELIX_VALIDATED', reason: 'Border surveillance technology provider; sensors, cameras, communications systems, and ISR platforms deployed along U.S. southern border and international boundaries' },
      { ticker: 'AXON', name: 'Axon Enterprise',                  cik: '1069183', validation: 'DOMAIN_MAPPED',   reason: 'Law enforcement technology for border and immigration operations; body cameras, Tasers, and digital evidence management for CBP and ICE agents' },
      { ticker: 'SAIC', name: 'Science Applications International',cik: '1571123', validation: 'DOMAIN_MAPPED',   reason: 'Federal IT services for immigration processing; DHS and CBP system integration, border surveillance data platforms, and immigration case management systems' },
      { ticker: 'PSN',  name: 'Parsons Corporation',              cik: '1601712', validation: 'DOMAIN_MAPPED',   reason: 'Border infrastructure engineering; physical barrier design, port of entry modernization, and federal facility construction for DHS and CBP' },
      { ticker: 'TTEK', name: 'Tetra Tech',                       cik: '831641',  validation: 'DOMAIN_MAPPED',   reason: 'Environmental and infrastructure engineering for refugee settlement and migration-driven urban expansion; USAID and UN-Habitat contractor for displaced population infrastructure' },
      { ticker: 'J',    name: 'Jacobs Solutions',                 cik: '49826',   validation: 'DOMAIN_MAPPED',   reason: 'Infrastructure engineering for migration-driven capacity expansion; federal facility design, port of entry engineering, and humanitarian infrastructure for displaced populations' }
    ],
    'pop_aging': [
      { ticker: 'ISRG', name: 'Intuitive Surgical',               cik: '1035267', validation: 'HELIX_VALIDATED', reason: 'Da Vinci surgical robotics reduce recovery time for elderly patients; aging populations drive surgical procedure volume for joint replacement, cardiac, and cancer surgery' },
      { ticker: 'MDT',  name: 'Medtronic',                        cik: '64670',   validation: 'HELIX_VALIDATED', reason: 'Largest pure-play medical device company; pacemakers, insulin pumps, spinal implants, and neurostimulators all see demand growth from aging demographics' },
      { ticker: 'ABT',  name: 'Abbott Laboratories',              cik: '1800',    validation: 'HELIX_VALIDATED', reason: 'Continuous glucose monitoring (Freestyle Libre), cardiac devices, and diagnostics serve the chronic disease burden that expands with population aging' },
      { ticker: 'SYK',  name: 'Stryker',                          cik: '310764',  validation: 'HELIX_VALIDATED', reason: 'Joint replacement (hip, knee), trauma surgery, and hospital infrastructure equipment; aging populations drive orthopedic procedure volume globally' },
      { ticker: 'ZBH',  name: 'Zimmer Biomet',                    cik: '1136869', validation: 'HELIX_VALIDATED', reason: 'Musculoskeletal healthcare leader; knee and hip replacements, spine surgery, and dental implants serve aging-population orthopedic demand' },
      { ticker: 'EW',   name: 'Edwards Lifesciences',             cik: '1099800', validation: 'HELIX_VALIDATED', reason: 'Transcatheter heart valve replacement (TAVR) is a direct aging-population product; structural heart disease prevalence rises exponentially over age 65' },
      { ticker: 'GEHC', name: 'GE HealthCare Technologies',       cik: '1932393', validation: 'HELIX_VALIDATED', reason: 'Medical imaging (MRI, CT, ultrasound) and patient monitoring equipment; aging populations drive diagnostic imaging volume across all modalities' },
      { ticker: 'BAX',  name: 'Baxter International',             cik: '10456',   validation: 'DOMAIN_MAPPED',   reason: 'Renal care (dialysis), hospital products, and nutritional therapies; kidney disease and chronic conditions rise with population aging' },
      { ticker: 'BDX',  name: 'Becton Dickinson',                 cik: '10795',   validation: 'DOMAIN_MAPPED',   reason: 'Medical supplies, diagnostics, and drug delivery systems used across the continuum of elder care from hospitals to home health to nursing facilities' },
      { ticker: 'GMED', name: 'Globus Medical',                   cik: '1237831', validation: 'DOMAIN_MAPPED',   reason: 'Spine surgery implants and robotic-assisted surgical platforms; degenerative spinal conditions increase with population aging' },
      { ticker: 'AMED', name: 'Amedisys',                         cik: '1095565', validation: 'DOMAIN_MAPPED',   reason: 'Home health and hospice services; aging-in-place demand drives home health utilization as elder populations prefer home care over institutional settings' },
      { ticker: 'HCA',  name: 'HCA Healthcare',                   cik: '860730',  validation: 'HELIX_VALIDATED', reason: 'Largest U.S. hospital operator (182+ hospitals); Medicare volume and aging-population surgical demand are primary revenue drivers' },
      { ticker: 'UNH',  name: 'UnitedHealth Group',               cik: '731766',  validation: 'HELIX_VALIDATED', reason: 'Largest U.S. health insurer with Medicare Advantage as fastest-growing segment; Optum health services division serves aging-population chronic care management' }
    ],
    'pop_urban': [
      { ticker: 'PLD',  name: 'Prologis',                         cik: '1045609', validation: 'HELIX_VALIDATED', reason: 'Largest logistics REIT globally; urban warehousing and last-mile distribution facilities serve the supply chain demands of growing urban populations' },
      { ticker: 'AMT',  name: 'American Tower',                   cik: '1053507', validation: 'HELIX_VALIDATED', reason: 'Global cell tower operator; urban population density drives wireless infrastructure demand for 5G, small cells, and edge computing' },
      { ticker: 'CCI',  name: 'Crown Castle International',       cik: '1051470', validation: 'HELIX_VALIDATED', reason: 'U.S. cell tower and small-cell operator; urban densification requires fiber and small-cell deployments to serve concentrated population centers' },
      { ticker: 'EQIX', name: 'Equinix',                          cik: '1101239', validation: 'HELIX_VALIDATED', reason: 'Global data center operator; urban population growth drives digital infrastructure demand for cloud, edge computing, and content delivery' },
      { ticker: 'DLR',  name: 'Digital Realty Trust',              cik: '1365135', validation: 'DOMAIN_MAPPED',   reason: 'Data center REIT serving urban digital infrastructure needs; population density and urbanization drive data consumption and processing demand' },
      { ticker: 'AWK',  name: 'American Water Works',             cik: '1410636', validation: 'HELIX_VALIDATED', reason: 'Largest U.S. water utility; urban population growth strains water treatment and distribution infrastructure, driving capital investment' },
      { ticker: 'XYL',  name: 'Xylem',                            cik: '1524472', validation: 'HELIX_VALIDATED', reason: 'Water technology company; pumps, treatment systems, and smart water infrastructure address urban water stress from population concentration' },
      { ticker: 'VMC',  name: 'Vulcan Materials',                 cik: '1396009', validation: 'DOMAIN_MAPPED',   reason: 'Largest U.S. aggregates producer; urban construction and infrastructure expansion consume crushed stone, sand, and gravel at scale' },
      { ticker: 'MLM',  name: 'Martin Marietta Materials',        cik: '916076',  validation: 'DOMAIN_MAPPED',   reason: 'Heavy building materials supplier; urban infrastructure construction (roads, bridges, buildings) drives demand for aggregates and cement' },
      { ticker: 'PWR',  name: 'Quanta Services',                  cik: '1040971', validation: 'HELIX_VALIDATED', reason: 'Largest electrical grid contractor in North America; urban population growth requires grid expansion, substation construction, and transmission line upgrades' },
      { ticker: 'URI',  name: 'United Rentals',                   cik: '1067701', validation: 'DOMAIN_MAPPED',   reason: 'Largest equipment rental company; urban construction boom from population growth drives demand for cranes, excavators, and heavy equipment' }
    ],
    'pop_health': [
      { ticker: 'PFE',  name: 'Pfizer',                           cik: '78003',   validation: 'HELIX_VALIDATED', reason: 'mRNA vaccine platform operator (with BioNTech); COVID-19 vaccine, Paxlovid therapeutic, and respiratory vaccine pipeline directly address pandemic demographic impact' },
      { ticker: 'MRNA', name: 'Moderna',                          cik: '1682852', validation: 'HELIX_VALIDATED', reason: 'mRNA vaccine technology platform; COVID-19 vaccine, RSV vaccine, flu vaccine, and cancer vaccine pipeline address pandemic preparedness and population health' },
      { ticker: 'BNTX', name: 'BioNTech',                         cik: '1776985', validation: 'HELIX_VALIDATED', reason: 'mRNA pioneer (Pfizer-BioNTech COVID vaccine); oncology and infectious disease mRNA pipeline addresses long-term population health threats' },
      { ticker: 'AZN',  name: 'AstraZeneca',                      cik: '901832',  validation: 'HELIX_VALIDATED', reason: 'Global vaccine and therapeutics company; COVID-19 vaccine, oncology, cardiovascular, and respiratory portfolios address pandemic and chronic disease population burden' },
      { ticker: 'JNJ',  name: 'Johnson & Johnson',                cik: '200406',  validation: 'HELIX_VALIDATED', reason: 'Diversified pharmaceutical and medical device company; vaccine programs, consumer health, and surgical devices address population health at every level' },
      { ticker: 'REGN', name: 'Regeneron Pharmaceuticals',        cik: '872589',  validation: 'HELIX_VALIDATED', reason: 'Monoclonal antibody platform (REGN-COV2 for COVID); Dupixent for inflammatory disease and Eylea for age-related macular degeneration serve population health' },
      { ticker: 'VRTX', name: 'Vertex Pharmaceuticals',           cik: '875320',  validation: 'HELIX_VALIDATED', reason: 'Cystic fibrosis treatment dominance and pain/sickle cell pipeline; gene editing (CRISPR) partnership addresses genetic disease burden at population scale' },
      { ticker: 'BMY',  name: 'Bristol-Myers Squibb',             cik: '14272',   validation: 'DOMAIN_MAPPED',   reason: 'Oncology and immunology portfolio (Opdivo, Revlimid); cancer and autoimmune disease burden rises with aging and post-pandemic population health changes' },
      { ticker: 'ABBV', name: 'AbbVie',                           cik: '1551152', validation: 'HELIX_VALIDATED', reason: 'Immunology leader (Humira, Skyrizi, Rinvoq); autoimmune disease prevalence and chronic condition management are structural population health demands' },
      { ticker: 'LLY',  name: 'Eli Lilly',                        cik: '59478',   validation: 'HELIX_VALIDATED', reason: 'GLP-1 receptor agonists (Mounjaro, Zepbound) address obesity epidemic; diabetes, obesity, and Alzheimer\u2019s disease portfolios serve the largest population health burdens globally' }
    ]
  };

  var PLAYBOOK_DEFS = {
    'pop_fertility': { title: 'Fertility & Reproductive Health', domains: ['population', 'medicine'], type: 'invest' },
    'pop_migration': { title: 'Migration & Labor Mobility', domains: ['population', 'economy'], type: 'invest' },
    'pop_aging': { title: 'Aging & Longevity Economy', domains: ['population', 'medicine'], type: 'invest' },
    'pop_urban': { title: 'Urbanization & Infrastructure', domains: ['population', 'infrastructure'], type: 'invest' },
    'pop_health': { title: 'Pandemic Demographic Resilience', domains: ['population', 'medicine'], type: 'invest' }
  };

  function resolvePlaybookId(opp) {
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    return 'pop_fertility';
  }

  // ── MECHANISM EXPLANATIONS ──

  var MECH_EXPLAIN = {
    'POPULATION_COLLAPSE': {
      'fertility_decline':         { why: 'Global total fertility rates have fallen below replacement (2.1 TFR) in 60+ countries simultaneously \u2014 an unprecedented phenomenon. South Korea 0.72, China 1.09, Japan 1.20, Italy 1.24, Spain 1.16, U.S. 1.62. Research implicates multiple converging causes: economic precarity (median home price-to-income ratios exceeding 8x in major cities), student debt burden ($1.75T in U.S. alone), environmental endocrine disruptors (PFAS detected in 98% of Americans, microplastics in human placental tissue, phthalate exposure linked to declining sperm counts \u2014 Shanna Swan meta-analysis showing 50% sperm count decline 1973-2011), delayed family formation (median first birth age now 30+ in OECD), expanded contraceptive access, and cultural shifts deprioritizing large families. Observable policy patterns: some governments have simultaneously expanded contraceptive access while cutting childcare subsidies, creating contradictory incentive structures worth tracking.', move: 'Position in reproductive health technology (Hologic HOLX, CooperSurgical COO for IVF, Natera NTRA for NIPT), fertility diagnostics (Thermo Fisher TMO, Illumina ILMN for genetic screening), and telehealth fertility access (Teladoc TDOC, Hims & Hers HIMS). Track UNFPA funding cycles, national pro-natalist program budgets (Hungary spends 5% GDP on family policy), and endocrine disruptor regulation (EPA PFAS rules, EU REACH restrictions).' },
      'workforce_imbalance':       { why: 'As fertility declines and populations age, the worker-to-retiree ratio collapses. Japan is approaching 1.8 workers per retiree (down from 10:1 in 1950). Germany, Italy, and South Korea face similar trajectories. Immigration is used as a workforce supplement (Canada targets 500K immigrants/year, Germany reformed immigration law 2023), while automation serves as a labor substitute (Japan deploys more industrial robots per capita than any nation). The dependency ratio mathematics are unforgiving: each worker must produce enough surplus to support themselves plus a growing share of non-working dependents.', move: 'Position in workforce automation (robotics, AI), immigration processing technology (Booz Allen BAH, Leidos LDOS), labor market platforms, and pension advisory services. Track dependency ratio trajectories by country, immigration quota announcements, and industrial automation adoption rates.' },
      'dependency_ratio':          { why: 'The old-age dependency ratio (population 65+/working-age 15-64) is the fundamental metric of population system sustainability. Japan: 48%. Italy: 37%. Germany: 34%. These ratios mean pension systems designed for 5+ workers per retiree now operate at 2-3:1. Tax base shrinkage is mathematical: fewer workers = less income tax = less revenue for public services. Intergenerational wealth transfer patterns are distorting: housing wealth concentrates in older cohorts while younger cohorts face higher rents, lower homeownership, and student debt. The OECD projects pension spending will consume 10-15% of GDP in aging nations by 2050.', move: 'Position in pension restructuring advisory, retirement financial products, healthcare systems serving aging populations (UnitedHealth UNH, HCA Healthcare), and fiscal policy analysis. Track OECD Pensions at a Glance updates, Social Security Trustees reports, and national pension fund solvency ratios.' },
      'demographic_distortion':    { why: 'Population structure distortions extend beyond age. Sex-ratio imbalance from decades of sex-selective practices: China has 34M excess males, India has 37M excess males. Age-pyramid inversion (more elderly than children) is now reality in Japan, Italy, Germany, and South Korea. Rural depopulation accelerates as young adults concentrate in cities: Japan has 900+ municipalities projected to disappear by 2040. These distortions create cascading social effects: marriage market imbalances, rural service deserts, and concentrated political power in aging demographics.', move: 'Position in demographic analytics platforms, rural revitalization infrastructure, and social services technology. Track national census data for sex ratios, urban/rural population splits, and age-pyramid shape changes. Monitor marriage rate trends and household formation data.' }
    },
    'MASS_MIGRATION': {
      'migration_surge':           { why: 'UNHCR reports 110M+ forcibly displaced people globally (2024), the highest figure ever recorded. Voluntary economic migration adds hundreds of millions more. The scale overwhelms existing border infrastructure, asylum processing systems, and integration programs. U.S. CBP encountered 2.4M+ at the southern border in FY2023. European Mediterranean crossings continue at 100K+/year despite interdiction. Climate migration is projected to displace 216M by 2050 (World Bank).', move: 'Position in border technology (L3Harris LHX surveillance, Leidos LDOS biometrics, Axon AXON), immigration IT (Booz Allen BAH, SAIC), and infrastructure contractors (Fluor FLR, Parsons PSN). Track UNHCR Global Trends, CBP encounter data, and Frontex border statistics.' },
      'displacement_event':        { why: 'Forced displacement events \u2014 wars, natural disasters, climate events, political persecution \u2014 create acute population movements requiring emergency response. The Syria crisis displaced 14M, Ukraine 6M+ external refugees, Venezuela 7.7M emigrants. Each displacement event triggers UNHCR emergency funding, host country infrastructure spending, and long-term integration programs. Climate displacement is becoming a permanent condition in low-lying Pacific islands, Sahel, and South Asian river deltas.', move: 'Position in refugee camp infrastructure (Tetra Tech TTEK, AECOM), humanitarian logistics, and settlement housing. Track UNHCR emergency declarations, OCHA funding appeals, and World Bank IDA displacement funding.' },
      'border_pressure':           { why: 'Physical and administrative border infrastructure is under unprecedented strain. U.S. Customs and Border Protection operates on multi-billion-dollar annual budgets. EU Frontex budget has increased 10x since 2015. Border walls, surveillance systems, biometric processing, and detention facilities are expanding globally. India-Bangladesh, Turkey-Syria, Poland-Belarus, and U.S.-Mexico borders are all sites of major infrastructure investment.', move: 'Position in border surveillance (L3Harris LHX, Leidos LDOS sensors), detention operators (GEO Group GEO, CoreCivic CXW), and infrastructure engineering (Parsons PSN, Jacobs J). Track DHS budget appropriations, EU border management funding, and national border infrastructure tenders.' },
      'urban_influx':              { why: 'Migration flows concentrate in urban areas, creating localized population surges that strain housing, transit, water, and social services. Cities like Istanbul, Beirut, Amman, Bogota, and New York absorb disproportionate shares of migrants. Urban infrastructure was not designed for rapid population increases of 5-15% in single years.', move: 'Position in urban infrastructure (water utilities AWK, construction materials VMC/MLM, grid contractors PWR), housing construction, and urban planning technology. Track city-level population data, building permit trends in gateway cities, and municipal budget strain indicators.' }
    },
    'AGING_CRISIS': {
      'aging_skew':                { why: 'Japan: 29% over 65. Italy: 24%. Germany: 22%. Finland: 23%. Portugal: 23%. The over-65 share is rising by 0.5-1.0 percentage points per year in most OECD countries. By 2050, 1-in-4 people in Europe and North America will be over 65. The silver economy is projected at $15T+ by 2030. Healthcare systems designed for younger populations face structural mismatch.', move: 'Position in elder care technology, surgical robotics (Intuitive Surgical ISRG), medical devices (Medtronic MDT, Stryker SYK, Zimmer Biomet ZBH), and healthcare operators (HCA, UnitedHealth UNH). Track WHO aging statistics, OECD Health at a Glance, and national long-term care spending.' },
      'healthcare_overload':       { why: 'Aging populations drive exponential healthcare demand increases. Per-capita healthcare spending for 65+ is 3-5x that of working-age adults. Hospital bed occupancy in Japan and Italy exceeds 90%. Nursing home waitlists in Germany exceed 200,000. The WHO projects a global shortage of 10M healthcare workers by 2030, concentrated in elder care.', move: 'Position in healthcare capacity expansion (HCA Healthcare, GE HealthCare GEHC imaging equipment), home health (Amedisys AMED), and medical devices that reduce hospital stays (Edwards Lifesciences EW TAVR, Intuitive Surgical ISRG robotics).' },
      'pension_strain':            { why: 'Pay-as-you-go pension systems were designed for 5-7 workers per retiree. At 2-3 workers per retiree, the math breaks. Japan Government Pension Investment Fund ($1.6T) faces structural drawdown. U.S. Social Security Trust Fund projected depletion by 2033. European public pension spending averages 10-14% of GDP. Pension reform is politically toxic but mathematically inevitable.', move: 'Position in financial services targeting retirement (UnitedHealth UNH for Medicare Advantage), pension advisory, annuity providers, and retirement asset management. Track Social Security Trustees Annual Report, OECD Pensions at a Glance, and national pension fund solvency reports.' },
      'workforce_imbalance':       { why: 'As workers retire faster than they are replaced, specific sectors face acute labor shortages. Healthcare, construction, agriculture, and transportation are most affected. Japan labor force participation rate for 60-69 year-olds is 73%. South Korea raised mandatory retirement age. Germany recruited 400K foreign workers in 2023. Automation, immigration, and later retirement are the three levers.', move: 'Position in workforce automation, immigration processing, and later-retirement financial products. Track BLS Job Openings data, sectoral employment trends, and retirement age policy changes.' }
    },
    'URBANIZATION_OVERLOAD': {
      'city_overcrowding':         { why: 'The UN projects 2.5 billion additional urban residents by 2050, concentrated in Asia and Africa. Lagos will reach 32M, Dhaka 28M, Kinshasa 26M. Existing megacities already strain infrastructure limits. Population density in informal settlements reaches 100,000/km2. Overcrowding drives disease transmission, social stress, and infrastructure failure.', move: 'Position in urban infrastructure (Quanta Services PWR for grid, American Water Works AWK for water, Prologis PLD for logistics), construction materials (Vulcan VMC, Martin Marietta MLM), and data/communications infrastructure (American Tower AMT, Equinix EQIX).' },
      'housing_shortage':          { why: 'Housing production lags population growth in nearly every major urban market globally. The U.S. has a deficit of 3.8-6.8M units. UK: 4.3M homes needed. Germany: 700K/year needed vs. 250K built. Affordable housing gap is structural: land scarcity, zoning restrictions, construction cost inflation, and NIMBY opposition constrain supply.', move: 'Position in homebuilding materials (Vulcan VMC, Martin Marietta MLM), construction equipment (United Rentals URI), and housing-adjacent infrastructure (water AWK, grid PWR).' },
      'infrastructure_strain':     { why: 'Urban infrastructure \u2014 water treatment, sewage, electrical grid, roads, transit \u2014 was designed for smaller populations and is failing under current loads. U.S. infrastructure gets a C- grade (ASCE). Water main breaks affect 240,000 households daily. Grid outages are increasing. Transit systems in Delhi, Cairo, Lagos, and Sao Paulo operate beyond design capacity.', move: 'Position in infrastructure contractors (Quanta Services PWR, Xylem XYL water tech), utilities (American Water Works AWK), and communications infrastructure (American Tower AMT, Crown Castle CCI).' },
      'service_overload':          { why: 'Urban public services \u2014 schools, hospitals, fire, police, waste collection, public transit \u2014 are overwhelmed when population growth outpaces fiscal capacity. Class sizes in growing cities exceed 40+ students. Emergency response times lengthen. Service overload drives both public investment and private-sector alternatives.', move: 'Position in urban services technology (smart city platforms, fleet management, waste technology), healthcare facility operators (HCA), and education technology.' }
    },
    'PANDEMIC_DEMOGRAPHIC_SHOCK': {
      'disease_spread':            { why: 'COVID-19 demonstrated that pandemics can kill millions and disrupt entire demographic systems within months. 7M+ official deaths, 20M+ estimated excess deaths. Future pandemic risks include H5N1 avian flu, MERS-CoV, and novel zoonotic spillovers. Antimicrobial resistance threatens 10M deaths/year by 2050. Pandemic preparedness is now a permanent budget line.', move: 'Position in vaccine platforms (Pfizer PFE, Moderna MRNA, BioNTech BNTX), pandemic preparedness infrastructure, and surveillance technology.' },
      'mortality_anomaly':         { why: 'Excess mortality tracking has become a core demographic intelligence tool. The Economist estimated 20M+ COVID deaths vs. 7M official. Post-pandemic excess mortality persists in some regions. U.S. life expectancy dropped 2.7 years during COVID (2019-2021), the largest decline since WWII.', move: 'Position in mortality data analytics, insurance actuarial services, and public health surveillance platforms.' },
      'access_inequality':         { why: 'Pandemic impact was radically unequal. Low-income countries received COVID vaccines months to years after wealthy nations. Within countries, minority and low-income populations experienced 2-3x higher mortality. The COVAX facility failure demonstrated structural global health inequality.', move: 'Position in global health equity platforms, telemedicine (Teladoc TDOC), diagnostic access expansion, and vaccine distribution logistics.' },
      'healthcare_overload':       { why: 'Pandemics overload healthcare systems within weeks. COVID-19 pushed ICU occupancy to 100%+ in Northern Italy, New York, India, and Brazil. Deferred care created 10M+ delayed surgeries in the U.S. 500K+ healthcare workers left the profession 2020-2022. Permanent preparedness requires surge capacity and workforce resilience.', move: 'Position in healthcare capacity (HCA Healthcare, GE HealthCare GEHC), medical devices (Medtronic MDT, Baxter BAX), and workforce health platforms.' }
    }
  };

  var MECH_FALLBACK = {
    'fertility_decline':         { why: 'Fertility rates are falling below replacement globally. Reproductive health technology and pro-natalist programs see demand.', move: 'Position in Hologic (HOLX), CooperSurgical (COO), Natera (NTRA), and fertility diagnostics platforms.' },
    'workforce_imbalance':       { why: 'Worker-to-retiree ratios are collapsing. Automation, immigration processing, and labor market platforms benefit.', move: 'Position in workforce automation, Booz Allen (BAH) immigration IT, and labor market technology.' },
    'dependency_ratio':          { why: 'Dependency ratios are inverting. Pension restructuring and retirement financial services see demand.', move: 'Position in UnitedHealth (UNH) Medicare, pension advisory, and retirement asset management.' },
    'demographic_distortion':    { why: 'Population structure distortions (sex ratio, age pyramid, rural depopulation) create cascading social effects.', move: 'Position in demographic analytics, rural infrastructure, and social services technology.' },
    'migration_surge':           { why: 'Global displacement at record levels. Border technology and immigration processing systems see demand.', move: 'Position in L3Harris (LHX) surveillance, Leidos (LDOS) biometrics, and GEO Group (GEO) processing.' },
    'displacement_event':        { why: 'Forced displacement events trigger emergency response and settlement infrastructure spending.', move: 'Position in refugee infrastructure (Tetra Tech TTEK), humanitarian logistics, and settlement housing.' },
    'border_pressure':           { why: 'Border infrastructure under strain globally. Surveillance, detention, and processing capacity expanding.', move: 'Position in border technology (L3Harris LHX, Axon AXON), detention (GEO, CoreCivic CXW), and infrastructure (Parsons PSN).' },
    'aging_skew':                { why: 'Over-65 populations growing rapidly. Silver economy, elder care, and medical devices see demand.', move: 'Position in Intuitive Surgical (ISRG), Medtronic (MDT), Stryker (SYK), and UnitedHealth (UNH).' },
    'healthcare_overload':       { why: 'Healthcare systems overwhelmed by aging and pandemic effects. Capacity expansion and surge equipment benefit.', move: 'Position in HCA Healthcare, GE HealthCare (GEHC), and medical device companies.' },
    'pension_strain':            { why: 'Pension systems approaching insolvency. Restructuring advisory and retirement products see demand.', move: 'Position in retirement financial services, annuity providers, and pension fund management.' },
    'disease_spread':            { why: 'Pandemic risk is permanent. Vaccine platforms and preparedness infrastructure see sustained investment.', move: 'Position in Pfizer (PFE), Moderna (MRNA), BioNTech (BNTX), and surveillance technology.' },
    'mortality_anomaly':         { why: 'Excess mortality patterns reveal hidden population health trends. Actuarial and surveillance demand rises.', move: 'Position in mortality analytics, insurance actuarial services, and public health surveillance platforms.' }
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
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Population condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

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
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Population portal node. Company-level Helix validation pending.</div>';
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=population&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
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
    return fetch('/assets/data/deep/population-branch-index.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { _branchIndex = d; return d; }).catch(function () { _branchIndexFailed = true; return null; });
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

    var text = '<b>Population domain at ' + pct + '% stress.</b> ';
    if (activeDx.length > 0) {
      text += activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' confirmed. ';
      var primaryDx = activeDx[0];
      var ctx = DX_CONTEXT[(primaryDx.id || '').toUpperCase()];
      if (ctx) text += ctx.what + '. <b>Money move:</b> ' + ctx.step;
    } else {
      text += 'No active diagnoses. Watch for fertility, migration, aging, urbanization, or pandemic demographic signals.';
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
      var claims = ledger.getClaimsByDomain('population');
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
          domain: 'population',
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
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'population') : null;
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
      h += renderMechanismBlock(o, 'play');
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

    var bridge = window.LIMENPopulationPromotionBridge;
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('population') : null;
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
    h += '<div class="eos-title" style="margin-bottom:0">POPULATION \u00b7 OPERATOR SURFACE</div>';
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
      dxContent += '<div style="font-size:0.32rem;color:#908878">No active diagnoses. Watch for fertility, migration, aging, urbanization, or pandemic demographic signals.</div>';
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
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['population'], type: 'invest' };

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=population&returnTo=' + encodeURIComponent('/domain-console?domain=population');
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
        window.LIMENClaimFlow.openClaimModal(opp, 'population', function (confirmedOpp, estimate) {
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'population', estimate);
          }
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel
    if (window.LIMENOperatorPanel) window.LIMENOperatorPanel.mount(_operatorView, 'population');
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
    if (window.LIMENPopulationBusinessReview) window.LIMENPopulationBusinessReview.mount(_operatorView);
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

    console.log('[PopulationOperator] Booted \u2014 operator view created, toggle wired');
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
