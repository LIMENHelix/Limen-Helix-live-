/**
 * science-clarity-operator.js — Money-Driven Action Surface for Science / Research Domain
 *
 * Self-gates: only runs when ?domain=science or ?domain=research
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
  if (_dom !== 'science' && _dom !== 'research') return;

  var VIEW_ID = 'sos-operator-view';
  var STATUS_KEY = 'limen_science_operator_status';
  var COLLAPSE_KEY = 'limen_science_collapse_state';
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
      '.eos-deep-cite{font-size:0.26rem;color:#908878;line-height:1.5;padding:2px 0}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function getState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('research');
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

  // ── SCIENCE-NATIVE LANGUAGE ──

  var DX_CONTEXT = {
    'REPLICATION_CRISIS': {
      what: 'Replication failures and reproducibility gaps are spreading across published research',
      money: 'Reproducibility tooling, pre-registration platforms, and replication-focused services gain leverage. Research integrity SaaS becomes mandatory in journal submission workflows.',
      step: 'Track replication studies and Center for Open Science updates. Position in OSF, replication initiatives, and reproducible workflow tools.',
      outcome: '$250K-$5M reproducibility infrastructure grants or 15-25% legaltech-of-science premium'
    },
    'FUNDING_COLLAPSE': {
      what: 'Federal research funding is declining or being delayed across NSF, NIH, and discretionary science accounts',
      money: 'Grant-writing services, foundation funding intermediaries, and SBIR consultancies gain demand. Bridge funding and lab continuity services become critical.',
      step: 'Track NIH/NSF appropriations and continuing resolutions. Position in private research foundations and SBIR-focused startups.',
      outcome: '$250K-$5M bridge funding awards or sustained SBIR consulting revenue'
    },
    'DATA_FRAUD': {
      what: 'Retraction rates, image manipulation detection, and data fabrication cases are surging',
      money: 'Image-integrity software, retraction tracking services, and research integrity consultancies see elevated demand. Journal due diligence tools become mandatory.',
      step: 'Track Retraction Watch and journal integrity announcements. Position in image-manipulation detection SaaS and integrity audit services.',
      outcome: '15-25% research integrity sector premium or sustained audit revenue'
    },
    'PARADIGM_CONFLICT': {
      what: 'Conflicts over scientific paradigms, theoretical disputes, and consensus breakdowns are accelerating',
      money: 'Open peer review, post-publication review, and theoretical research consortia gain leverage. Position in interdisciplinary research bridges.',
      step: 'Track major theoretical disputes and breakthrough claims. Position in open peer review platforms and theoretical research institutes.',
      outcome: '$500K-$5M theoretical research grants or interdisciplinary consortium funding'
    },
    'BRAIN_DRAIN': {
      what: 'Researcher exodus from academic positions accelerating; talent loss to industry and abroad',
      money: 'Scientific recruiting, retention consultancies, and alternative-career programs gain demand. Postdoc bridge programs and research career platforms see traffic surge.',
      step: 'Track NSF/NIH workforce reports and academic job market data. Position in scientific recruiting and retention consulting.',
      outcome: 'Sustained scientific recruiting fees or workforce program revenue'
    },
    'PUBLICATION_BIAS': {
      what: 'Negative result suppression, file-drawer effects, and selective publication patterns are widening',
      money: 'Pre-registration platforms, registered reports infrastructure, and negative-results journals gain traction. Open science publishing platforms see subscription growth.',
      step: 'Track pre-registration adoption rates and negative results journal launches. Position in open science publishing infrastructure.',
      outcome: '$250K-$2M open science infrastructure grants or sustained platform revenue'
    }
  };

  var PATH_LABELS = { 'PATENTABLE': 'PATENT', 'GRANT-ELIGIBLE': 'GRANT', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'PATENTABLE': 'eos-path-patent', 'GRANT-ELIGIBLE': 'eos-path-grant', 'INVESTABLE': 'eos-path-invest' };
  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  var DX_TO_PLAYBOOK = {
    'REPLICATION_CRISIS': 'science_integrity',
    'DATA_FRAUD':         'science_integrity',
    'FUNDING_COLLAPSE':   'science_funding',
    'BRAIN_DRAIN':        'science_workforce',
    'PARADIGM_CONFLICT':  'science_open',
    'PUBLICATION_BIAS':   'science_open'
  };

  var INVEST_TARGETS = {
    'science_integrity': [
      { ticker: 'TMO',  name: 'Thermo Fisher Scientific',     cik: '97745',   validation: 'HELIX_VALIDATED', reason: 'Largest scientific instruments and reagents supplier; benefits from research integrity audits and reproducibility tooling demand' },
      { ticker: 'DHR',  name: 'Danaher',                      cik: '313616',  validation: 'HELIX_VALIDATED', reason: 'Beckman Coulter, Cytiva, Leica \u2014 lab instruments tied directly to reproducibility and QC workflows in biopharma and academic labs' },
      { ticker: 'A',    name: 'Agilent Technologies',         cik: '1090872', validation: 'HELIX_VALIDATED', reason: 'Mass spec, GC, HPLC and lab automation; OpenLab CDS is a de facto standard for regulated data-integrity workflows' },
      { ticker: 'WAT',  name: 'Waters Corporation',           cik: '1000697', validation: 'HELIX_VALIDATED', reason: 'Empower chromatography data system is the industry standard for FDA-regulated GxP integrity and 21 CFR Part 11 compliance' },
      { ticker: 'BIO',  name: 'Bio-Rad Laboratories',         cik: '12208',   validation: 'DOMAIN_MAPPED',   reason: 'Life sciences research tools (ddPCR, western blot) tied directly to figure-integrity and replication-failure remediation' },
      { ticker: 'MTD',  name: 'Mettler-Toledo International', cik: '1037646', validation: 'DOMAIN_MAPPED',   reason: 'Precision lab balances and process analytics \u2014 critical to calibration chain-of-custody and metrology integrity' },
      { ticker: 'ILMN', name: 'Illumina',                     cik: '1110803', validation: 'HELIX_VALIDATED', reason: 'Sequencing platform standardization underpins reproducibility in genomics; NovaSeq X and DRAGEN secondary analysis' },
      { ticker: 'BRKR', name: 'Bruker',                       cik: '1109354', validation: 'DOMAIN_MAPPED',   reason: 'NMR, mass spec, and structural biology instruments whose reference standards are load-bearing for reproducible chemistry and proteomics' },
      { ticker: 'RVTY', name: 'Revvity (formerly PerkinElmer)', cik: '31791', validation: 'DOMAIN_MAPPED',   reason: 'Signals lab informatics and OneSource service \u2014 compliance, instrument qualification, and audit trails for research integrity' },
      { ticker: 'QGEN', name: 'Qiagen',                       cik: '1841024', validation: 'DOMAIN_MAPPED',   reason: 'Sample prep, QIAseq, and QIAcube automation \u2014 standardized kits reduce batch-to-batch variability flagged in replication crises' },
      { ticker: 'TECH', name: 'Bio-Techne',                   cik: '842023',  validation: 'DOMAIN_MAPPED',   reason: 'R&D Systems antibodies and ProteinSimple Simple Western \u2014 antibody validation is a top cited source of irreproducibility' },
      { ticker: 'TXG',  name: '10x Genomics',                 cik: '1770787', validation: 'DOMAIN_MAPPED',   reason: 'Chromium single-cell and Visium spatial platforms whose protocols are under explicit methodology-standardization scrutiny' },
      { ticker: 'PACB', name: 'Pacific Biosciences',          cik: '1299130', validation: 'DOMAIN_MAPPED',   reason: 'HiFi long-read sequencing for reference-grade genomes \u2014 eliminates short-read ambiguity that complicates replication in variant calling' },
      { ticker: 'BDX',  name: 'Becton Dickinson',             cik: '10795',   validation: 'DOMAIN_MAPPED',   reason: 'Life sciences research tools (FACSymphony flow cytometry, BD Rhapsody) and clinical research pre-analytic standardization' },
      { ticker: 'XBI',  name: 'SPDR S&P Biotech ETF',         cik: null,      validation: 'ETF_PROXY',       reason: 'Biotech sector ETF \u2014 secondary proxy for life sciences research integrity and tooling demand surge' }
    ],
    'science_funding': [
      { ticker: 'TMO',  name: 'Thermo Fisher Scientific',     cik: '97745',   validation: 'HELIX_VALIDATED', reason: 'Diversified scientific supplier with deep federal R&D exposure; NIH, DOE, and DoD labs all buy through Thermo\u2019s unified catalog' },
      { ticker: 'WAT',  name: 'Waters Corporation',           cik: '1000697', validation: 'HELIX_VALIDATED', reason: 'Mass spec and chromatography with heavy federal lab installed base; Empower is entrenched at NIH intramural labs' },
      { ticker: 'BIO',  name: 'Bio-Rad Laboratories',         cik: '12208',   validation: 'DOMAIN_MAPPED',   reason: 'Life sciences research tools \u2014 NIH R01-funded labs are a primary customer base for ddPCR and imaging systems' },
      { ticker: 'A',    name: 'Agilent Technologies',         cik: '1090872', validation: 'HELIX_VALIDATED', reason: 'NIH and DOE lab installed base for GC-MS and LC-MS; CrossLab services tie federal funding cycles to sustained revenue' },
      { ticker: 'ILMN', name: 'Illumina',                     cik: '1110803', validation: 'HELIX_VALIDATED', reason: 'Sequencing platform sales directly track NIH All of Us, NHGRI, and Cancer Moonshot appropriations' },
      { ticker: 'BRKR', name: 'Bruker',                       cik: '1109354', validation: 'DOMAIN_MAPPED',   reason: 'High-end instruments (timsTOF, Fourier NMR) sold through NSF MRI and NIH S10 shared-instrument grant programs' },
      { ticker: 'MKSI', name: 'MKS Instruments',              cik: '1049502', validation: 'DOMAIN_MAPPED',   reason: 'Vacuum, photonics, and laser subsystems sold into DOE user facilities (SLAC, Argonne, LBNL) and NIST labs' },
      { ticker: 'AZTA', name: 'Azenta (formerly Brooks Automation)', cik: '933974', validation: 'DOMAIN_MAPPED', reason: 'Sample management and cold chain for federal biobanks; NIH All of Us and NCI biobanking infrastructure' },
      { ticker: 'LH',   name: 'Labcorp Holdings',             cik: '920148',  validation: 'DOMAIN_MAPPED',   reason: 'Clinical trial central lab work tied to NIH and federal health research contracts' },
      { ticker: 'DGX',  name: 'Quest Diagnostics',            cik: '1022079', validation: 'DOMAIN_MAPPED',   reason: 'Reference lab services for federally funded population health and cohort studies' },
      { ticker: 'IDXX', name: 'IDEXX Laboratories',           cik: '874716',  validation: 'DOMAIN_MAPPED',   reason: 'NIH-funded animal research facility health monitoring; critical dependency for IACUC-regulated vivaria' },
      { ticker: 'BDX',  name: 'Becton Dickinson',             cik: '10795',   validation: 'DOMAIN_MAPPED',   reason: 'Federal research supply contracts; NIH biobanks and cell-therapy research pipelines' },
      { ticker: 'XBI',  name: 'SPDR S&P Biotech ETF',         cik: null,      validation: 'ETF_PROXY',       reason: 'Biotech ETF \u2014 secondary proxy for funding-sensitive life-sciences research ecosystem' }
    ],
    'science_workforce': [
      { ticker: 'ICLR', name: 'ICON plc',                     cik: '1060955', validation: 'DOMAIN_MAPPED',   reason: 'Large global CRO; direct absorber of PhD and MD-PhD talent leaving tenure-track academia' },
      { ticker: 'IQV',  name: 'IQVIA Holdings',               cik: '1478242', validation: 'HELIX_VALIDATED', reason: 'Largest CRO worldwide; major employer for statisticians, epidemiologists, and biology PhDs exiting academia' },
      { ticker: 'CRL',  name: 'Charles River Laboratories',   cik: '1100682', validation: 'DOMAIN_MAPPED',   reason: 'Preclinical CRO; absorbs life-sciences PhD, DVM, and toxicology workforce from academic labs' },
      { ticker: 'MEDP', name: 'Medpace Holdings',             cik: '1668397', validation: 'DOMAIN_MAPPED',   reason: 'Full-service CRO concentrated in small and mid-cap biopharma; absorbs clinical and biostatistics PhDs' },
      { ticker: 'LH',   name: 'Labcorp Drug Development',     cik: '920148',  validation: 'DOMAIN_MAPPED',   reason: 'Labcorp\u2019s contract research segment is a direct employer for life-sciences PhDs exiting academic postdocs' },
      { ticker: 'DGX',  name: 'Quest Diagnostics',            cik: '1022079', validation: 'DOMAIN_MAPPED',   reason: 'Research services segment employs biostatistics and molecular biology PhDs across reference labs' },
      { ticker: 'FTRE', name: 'Fortrea Holdings',             cik: '1975216', validation: 'DOMAIN_MAPPED',   reason: 'Spun out of Labcorp in 2023; pure-play CRO absorbing mid-career academic scientists into clinical operations' },
      { ticker: 'TECH', name: 'Bio-Techne',                   cik: '842023',  validation: 'DOMAIN_MAPPED',   reason: 'Research tools company; hiring pipeline for protein chemistry, immunology, and assay development PhDs' },
      { ticker: 'TXG',  name: '10x Genomics',                 cik: '1770787', validation: 'DOMAIN_MAPPED',   reason: 'Single-cell and spatial omics tools company; hires computational biology and genomics PhDs from academia' },
      { ticker: 'XBI',  name: 'SPDR S&P Biotech ETF',         cik: null,      validation: 'ETF_PROXY',       reason: 'Biotech ETF \u2014 secondary proxy for industry absorption of academic life-sciences workforce' }
    ],
    'science_open': [
      { ticker: 'RELX', name: 'RELX plc (Elsevier)',          cik: '1206774', validation: 'HELIX_VALIDATED', reason: 'Largest scientific publisher; ScienceDirect, Scopus, and Mendeley tie open-access transition to institutional revenue' },
      { ticker: 'WLY',  name: 'John Wiley & Sons',            cik: '107140',  validation: 'DOMAIN_MAPPED',   reason: 'Major scientific publisher; transformative open-access agreements with consortia like Projekt DEAL and University of California' },
      { ticker: 'PSO',  name: 'Pearson plc',                  cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'Academic and scholarly publishing exposure; education and assessment division ties to scientific credentialing' },
      { ticker: 'NVDA', name: 'NVIDIA',                       cik: '1045810', validation: 'HELIX_VALIDATED', reason: 'H100 / GH200 / B100 GPUs are the dominant substrate for AI-for-science, drug discovery, and protein structure prediction' },
      { ticker: 'MSFT', name: 'Microsoft',                    cik: '789019',  validation: 'HELIX_VALIDATED', reason: 'Azure for Research grants, Microsoft Academic Graph, and OpenAI integration into scientific research workflows' },
      { ticker: 'GOOGL',name: 'Alphabet (Google Scholar, Cloud)', cik: '1652044', validation: 'HELIX_VALIDATED', reason: 'Google Scholar dominates citation search; DeepMind AlphaFold is a load-bearing tool for structural biology' },
      { ticker: 'AMZN', name: 'Amazon (AWS Open Data)',       cik: '1018724', validation: 'HELIX_VALIDATED', reason: 'AWS Open Data Program hosts petabyte-scale research datasets (1000 Genomes, NASA Earth, NOAA); AWS for Research grants' },
      { ticker: 'AVGO', name: 'Broadcom',                     cik: '1730168', validation: 'DOMAIN_MAPPED',   reason: 'AI accelerator silicon and networking fabric (Tomahawk, Jericho) underpin scientific HPC and national lab clusters' },
      { ticker: 'AMD',  name: 'Advanced Micro Devices',       cik: '2488',    validation: 'DOMAIN_MAPPED',   reason: 'MI300 Instinct accelerators power Frontier and El Capitan exascale supercomputers at Oak Ridge and Livermore' },
      { ticker: 'ARM',  name: 'Arm Holdings',                 cik: '1973239', validation: 'DOMAIN_MAPPED',   reason: 'Arm-based Grace and NVIDIA Grace Hopper architectures powering Fugaku and next-generation scientific supercomputers' },
      { ticker: 'SMCI', name: 'Super Micro Computer',         cik: '1375365', validation: 'DOMAIN_MAPPED',   reason: 'Primary OEM for GPU servers at universities and DOE labs; liquid-cooled racks for AI-for-science clusters' },
      { ticker: 'SKYY', name: 'First Trust Cloud Computing ETF', cik: null,   validation: 'ETF_PROXY',       reason: 'Cloud computing ETF \u2014 secondary proxy for research compute migration to hyperscalers' },
      { ticker: 'BOTZ', name: 'Global X Robotics & AI ETF',   cik: null,      validation: 'ETF_PROXY',       reason: 'Robotics and AI ETF \u2014 secondary proxy for AI-for-science tooling exposure' }
    ]
  };

  function resolvePlaybookId(opp) {
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    return 'science_integrity';
  }

  // ── MECHANISM EXPLANATIONS ──

  var MECH_EXPLAIN = {
    'REPLICATION_CRISIS': {
      'replication_failure': { why: 'Independent groups repeatedly fail to reproduce headline findings across psychology, cancer biology, preclinical neuroscience, and machine learning. The Reproducibility Project: Psychology replicated only 36% of landmark studies; Begley and Ellis showed only 11% of cancer biology findings were reproducible at Amgen; and machine learning benchmark fraud is now endemic. This forces funders, journals, and universities to spend money on independent replication, audit, and pre-registration infrastructure — not as a nice-to-have, but as the only way to keep whole subfields from losing credibility.', move: 'Build or position in independent replication audit platforms (Center for Open Science / COS, Reproducibility Project infrastructure, Science Exchange Replication Studies marketplace), pre-registration services (OSF Registries, AsPredicted, ClinicalTrials.gov registration support), and journal-integration tools that force methods registration before data collection. Target NIH rigor-and-reproducibility RFAs, NSF SBE replication awards, and university research integrity offices. Contract range: $50K-$5M per multi-year replication initiative.' },
      'methodology_gap':     { why: 'Methods sections in published papers are chronically too brief to rebuild an experiment from scratch \u2014 reagents are unspecified, antibody lots are missing, software versions are omitted, and critical parameters (temperature, timing, cell passage number) are left out. This is now a leading mechanical cause of failed replications. Journals and funders are responding with mandatory reporting checklists (ARRIVE 2.0 for animal research, CONSORT for clinical trials, STROBE for observational studies, TRIPOD for prediction models) and with pre-registration requirements that freeze methods before data collection.', move: 'Build or position in methods reporting infrastructure tools that integrate directly with submission workflows: EQUATOR Network reporting-checklist services, Nature-style methods reporting software, SciScore (rigor scoring for NIH grants and manuscripts), protocols.io for step-level protocol sharing, Benchling and LabArchives ELN for full audit trail. Sell to journals as mandatory submission plugins and to NIH IC offices as grant scoring tools.' },
      'data_integrity':      { why: 'Underlying experimental data is often incomplete, inaccessible, or shows signs of post-hoc manipulation \u2014 exclusion of outliers, selective reporting of time points, image splicing, and blot duplication. Journals and research integrity offices now expect authors to make raw data and code available, and they expect integrity screening before publication. This is creating a sustained market for data-integrity audit, image-forensics, and reproducibility-enforcement services.', move: 'Build or position in data integrity audit tooling (Proofig image forensics, ImageTwin AI image analysis, FigCheck, Dryad repository, Zenodo data hosting, GitHub for code archival), and integrity audit services sold to publishers (Elsevier, Springer Nature, Wiley integrity teams, PLOS data availability enforcement, eLife computational reproducibility checks). Target large publisher integrity contracts and university research integrity offices.' },
      'peer_review_strain':  { why: 'Peer reviewers are saturated, unpaid, and time-starved \u2014 meaning they miss replication-critical signals like fabricated blots, impossible statistics, and hidden selective reporting. Review capacity has not scaled with paper volume. Journals respond by deploying algorithmic pre-screens, third-party statistical review, and post-publication peer review platforms that can catch what traditional peer review missed.', move: 'Build or position in reviewer-augmentation and post-publication review platforms: StatReviewer (automated statistical screening), Penelope.ai (manuscript pre-submission QC), PubPeer (post-publication comment layer), F1000Research open peer review, Review Commons (portable peer review for life sciences). Sell to journals as mandatory pre-submission checks and to research integrity offices as continuous surveillance.' }
    },
    'FUNDING_COLLAPSE': {
      'funding_decline':    { why: 'Federal research budgets across NIH, NSF, DOE Office of Science, and USDA are either declining in real terms or being held hostage to continuing resolutions and shutdown cycles. Indirect cost rates are being squeezed. Grant award decisions are being delayed by 6\u201312 months, and PIs are seeing their labs hollowed out by the gaps. This creates a sustained market for bridge funding, grant-writing, foundation funding intermediaries, and SBIR/STTR consultancies that can route around federal friction.', move: 'Build or position in federal grant-writing services (Hanover Research, Grant Training Center), SBIR/STTR consultancies (TurboSBIR, BBCetc, SBDC SBIR programs), foundation funding intermediaries (Instrumentl, Candid / Foundation Directory Online), and research development services sold to university VPR offices. Pursue NIH R13 / F31 / K awards as a pass-through, NSF I-Corps, and DOE Phase I SBIR contracts. Contract range: $25K-$2M per multi-year engagement.' },
      'workforce_loss':     { why: 'Postdocs, grad students, and early-career faculty are leaving academia for industry due to funding precarity \u2014 not because industry is pulling them, but because academic labs literally cannot keep them employed when grants are delayed or shrinking. This accelerates the collapse of the PhD training pipeline and forces universities to spend heavily on retention and bridge programs.', move: 'Build or position in research talent retention services (Burroughs Wellcome Career Awards, HHMI Hanna H. Gray Fellows, Simons Early Career Investigator programs as aspirational references; actual commercial plays: VersatilePhD, MyIDP career development platforms, Beyond the Professoriate coaching services). Sell to university provosts, NIH institutes, and foundations trying to keep the PhD pipeline from emptying out.' },
      'indirect_cost_squeeze': { why: 'Federal negotiators and Congress are squeezing indirect cost rates, which are the main way universities recover the real cost of running research facilities. When indirect rates are cut, universities push the burden back onto PIs, who must now find money for equipment, utilities, and administrative staff that used to come off the top. This creates a scramble for cost-recovery tooling, F&A rate benchmarking, and shared-services consolidation.', move: 'Build or position in research finance tooling (Cayuse, Kuali Research, InfoEd, Workday Grants for award management), indirect cost consulting (Huron Consulting, Attain Partners, Maximus research administration practice), and shared-services consolidation plays (core facility management platforms like iLab / Agilent, Stratocore). Sell to university VPR and controller offices as direct cost-recovery services.' },
      'private_foundation_shift': { why: 'As federal funding shrinks, private research foundations (HHMI, Wellcome Trust, Chan Zuckerberg Initiative, Simons Foundation, Moore Foundation, Sloan, Arnold Ventures, Open Philanthropy) have become load-bearing substitutes for basic research funding. These organizations now make allocation decisions at a scale that rivals smaller NIH institutes. PIs and universities who can access this money are winning; those who cannot are shrinking.', move: 'Build or position in private foundation intermediary services: foundation grant-writing specialists, relationship services for HHMI / Wellcome / CZI investigator programs, and philanthropic advisory services targeting science donors. Pursue roles as grants administrators for new foundations (Arc Institute, Astera Institute, Convergent Research, Speculative Technologies). Publicly-traded exposure is limited; this is mostly a services play with relationship-based revenue.' }
    },
    'DATA_FRAUD': {
      'data_integrity':     { why: 'Image manipulation, data fabrication, and statistical fraud are being detected at increasing rates. Retraction Watch now logs thousands of retractions per year; paper mills are producing industrial-scale fake manuscripts; and AI-assisted image forensics tools like Proofig and ImageTwin are flagging figure duplication in 1\u20134% of submitted manuscripts. Journals, universities, and research integrity offices now treat pre-publication integrity screening as mandatory, not optional.', move: 'Build or position in image integrity screening tools (Proofig, ImageTwin, FigCheck, Imagetwin.ai), plagiarism and paper mill detectors (iThenticate, Turnitin, STM Integrity Hub), and integrity audit services sold to publishers and university research integrity offices. Target the largest publisher deals (Elsevier, Springer Nature, Wiley, Taylor & Francis) and pursue NIH ORI and NSF OIG contracts for retrospective integrity audits.' },
      'peer_review_strain': { why: 'Peer reviewers are missing fraud signals because they are volunteers, they are saturated, and the statistical and image forensics needed to catch fraud is beyond what most reviewers have time or training for. Journals are responding by deploying machine-assisted pre-screens that can flag suspicious figures, statistical impossibilities, and citation-ring signatures before human reviewers even see a manuscript.', move: 'Build or position in fraud-augmented peer review infrastructure: StatReviewer and SciScore for automated statistical and rigor screening, ClearSkies Papermill Alarm, Signals / Morressier integrity dashboards, and STM Integrity Hub. Sell to journals as a mandatory pre-submission gate and to publishers\u2019 integrity teams as a continuous-monitoring layer on top of peer review.' },
      'methodology_gap':    { why: 'Fraud and sloppiness bleed into each other. When methods sections are vague, it becomes impossible to tell whether a result could not be reproduced because the original was fabricated, or because key details were omitted. Forcing stricter methods reporting is therefore a shared response to both fraud and replication failure \u2014 the same infrastructure plays both games.', move: 'Build or position in methods reporting infrastructure: SciScore, Penelope.ai, EQUATOR Network reporting services, and protocols.io for step-level protocol traceability. Sell the package as a fraud-prevention and reproducibility play simultaneously. Target NIH rigor-and-reproducibility RFAs and journal integrity contracts.' },
      'open_science':       { why: 'The open science movement \u2014 open data, open code, pre-registration, transparent peer review \u2014 is the structural response to fraud. When raw data and code must be made public, it is harder to fabricate or selectively report results without being caught. Funders and journals are accelerating open-science mandates as a direct counter-measure to the retraction surge.', move: 'Build or position in open science infrastructure: OSF (Open Science Framework, operated by COS), Zenodo, figshare, Dryad, Code Ocean for executable research, and Binder / RStudio Cloud for reproducible analysis. Sell to journals as mandatory data-and-code deposition gates, and to funders as compliance infrastructure for their open-science policies.' }
    },
    'PARADIGM_CONFLICT': {
      'paradigm_shift':     { why: 'Major theoretical conflicts are emerging across physics (dark matter vs modified gravity, string theory vs loop quantum gravity), biology (the central dogma under CRISPR and RNA world pressure), neuroscience (global workspace vs integrated information theory), and medicine (the amyloid hypothesis in Alzheimer\u2019s). When consensus breaks down, traditional peer review struggles, funders hedge their bets by funding multiple competing camps, and private foundations step in to fund heterodox work that NIH / NSF study sections would reject.', move: 'Build or position in theoretical research institutes and open-review platforms for contested fields: Perimeter Institute, Institute for Advanced Study, KITP, Santa Fe Institute (as references); commercial plays include structured open review platforms (F1000Research, ResearchHub with token incentives, Peer Community In), and private foundations positioned to fund heterodox theory work (Simons, Templeton, Moore, John Templeton Foundation as aspirational references). Target philanthropic research funding and university theoretical research centers.' },
      'peer_review_strain': { why: 'Peer review struggles with paradigm-challenging work because reviewers are drawn from the existing paradigm and tend to reject submissions that threaten the dominant framework. Editors are forced to either suppress the heterodox work or defy their reviewers. The fix is structured open review, where disagreement is logged publicly and readers can judge for themselves.', move: 'Build or position in structured open review platforms: F1000Research (Taylor & Francis), eLife\u2019s new model of reviewed preprints, Review Commons, Peer Community In (community-curated preprint review). Sell to journals as an optional open-review track for paradigm-contested submissions, and to foundations as a way to support heterodox work without committing to publication.' },
      'publication_bias':   { why: 'Paradigm conflicts are made worse by publication bias \u2014 editors and reviewers prefer results that fit the dominant paradigm, so heterodox findings get buried in lower-impact journals or unpublished. This creates file-drawer distortion where the literature looks more supportive of the paradigm than the actual research base is.', move: 'Build or position in registered reports platforms and negative-results journals that guarantee publication regardless of outcome: Peer Community In Registered Reports, Center for Open Science registered reports infrastructure, Journal of Negative Results (Biomed, Ecology), PLOS ONE\u2019s explicit policy of publishing sound methodology regardless of result. Sell to funders as a way to debias literature in contested fields.' },
      'open_science':       { why: 'Open access, open data, and pre-registration are the institutional immune system against paradigm lock-in. When raw data, analysis code, and pre-registered predictions are public, competing paradigms can be tested fairly against the same evidence. Paradigm-contested fields are therefore under pressure to adopt open-science infrastructure faster than stable fields.', move: 'Build or position in open-access publishing infrastructure (PLOS, eLife, Frontiers, MDPI, Copernicus), open-data repositories (Dryad, figshare, Zenodo), and pre-registration platforms (OSF Registries, AsPredicted). Sell to paradigm-contested fields where open-science adoption is politically easier because the status quo is already unstable.' }
    },
    'BRAIN_DRAIN': {
      'workforce_loss':  { why: 'Researchers are leaving academic positions for industry, government, and international positions at accelerating rates. The U.S. PhD pipeline is narrowing at every stage \u2014 fewer students enter, fewer finish, fewer get postdocs, fewer get tenure-track positions, and fewer stay. International students are looking more carefully at Canadian, European, and Asian alternatives. The collapse is structural: postdoc salaries have not kept pace with industry, tenure-track odds have fallen below 10% in most fields, and grant precarity makes academic careers functionally untenable for people with student loans.', move: 'Build or position in scientific workforce platforms: AcademicPositions, Nature Careers, ScienceCareers, AcademicJobsOnline (non-profit); commercial plays include PhD career platforms (VersatilePhD, MyIDP, Beyond the Professoriate), CRO recruiters (CRA International, Kelly Scientific Resources, Planet Pharma), and industry-PhD bridging programs (Insight Data Science as a reference). Sell to universities, NIH institutes, and foundations trying to slow the PhD exit rate.' },
      'funding_decline': { why: 'Funding cuts are the direct accelerant of talent departure. When a lab loses its R01, the postdocs leave first, then the grad students, then the senior technicians, and within 18 months the PI is alone. This is now the modal failure mode for mid-career academic labs, and it creates a market for bridge funding, F32 postdoc salary support, and institutional retention programs.', move: 'Build or position in postdoc bridge funding networks: HHMI Hanna H. Gray fellowships (reference), NIH K99/R00 career transition awards, Burroughs Wellcome Fund Career Awards at the Scientific Interface, Damon Runyon Cancer Research Foundation (references). Commercial plays: institutional retention consultancies sold to university VPR offices, and foundation grant-writing services specialized in career-transition awards.' },
      'translation_gap': { why: 'One of the biggest pulls on academic talent is industry tech transfer. When a PhD has an invention but the university tech transfer office is slow or underfunded, the researcher often leaves academia to spin out the company themselves. Universities that solve the translation gap retain more talent; universities that fail lose their best people to venture-backed startups.', move: 'Build or position in translational research infrastructure: university startup accelerator programs (referenced: YC Bio, Petri, Indie Bio), tech transfer software (Wellspring, Inteum), NIH REACH and SBIR programs for university spinouts, and venture studio models (Flagship Pioneering, ARCH Venture Partners, Third Rock Ventures as aspirational references). Sell to university tech transfer offices and state economic development agencies.' },
      'open_science':    { why: 'Early-career researchers increasingly choose open-science positions over traditional tenure-track roles because the incentives around credit, reuse, and rapid publication are better aligned with their careers. Labs, departments, and institutions that support open science retain more early-career talent; those that don\u2019t lose it.', move: 'Build or position in open-science career infrastructure: reproducible-research skills training platforms (Software Carpentry, Data Carpentry, The Carpentries), open-source scientific software foundations (NumFOCUS, Apache Software Foundation), and open science recognition infrastructure (ORCID, OSF profiles, open-author.org). Sell to universities as a recruiting and retention advantage for early-career hires.' }
    },
    'PUBLICATION_BIAS': {
      'publication_bias': { why: 'Journals strongly prefer positive, novel, clean results. Negative results, null findings, and replication studies are systematically underpublished. This creates a distorted literature where the average reader overestimates effect sizes and believes in effects that the raw evidence does not support. The reform response is registered reports (where publication is guaranteed based on the question, not the result), negative-results journals, and pre-registration mandates from funders.', move: 'Build or position in registered reports infrastructure and negative-results platforms: Peer Community In Registered Reports, Center for Open Science registered reports service, PLOS ONE (policy of publishing sound methodology regardless of result), F1000Research, and dedicated null-result journals. Sell to journals as a debias channel, to funders as a bias-correction policy, and to universities as a tenure-review alternative to glam-journal-only evaluation.' },
      'open_science':     { why: 'Open-science practices \u2014 pre-registration, open data, open peer review \u2014 are the structural counter to publication bias because they freeze the research question and methods before results are known, and because they make suppressed results visible by default. Funder mandates (NIH Data Management and Sharing Policy, Wellcome Trust open-access mandate, Plan S in Europe) are accelerating adoption regardless of individual journal willingness.', move: 'Build or position in pre-registration and open-data platforms: OSF Registries, AsPredicted, ClinicalTrials.gov, ISRCTN, Zenodo, figshare, Dryad. Sell to universities as institutional open-science offices, and to funders as compliance infrastructure for mandatory data sharing policies.' },
      'peer_review_strain': { why: 'Peer review is a major gatekeeper for publication bias because reviewers share the field\u2019s expectations and can unintentionally reject null results as "uninteresting." Structured review criteria and reviewer training on bias can mitigate this, as can open peer review that makes reviewer reasoning public and critique-able.', move: 'Build or position in reviewer training and structured peer review infrastructure: Publons Academy (now Web of Science Researcher) for reviewer training, F1000Research open peer review, eLife reviewed-preprint model, and structured-review templates deployed through ScholarOne and Editorial Manager. Sell to journals as an audit and quality-improvement layer.' },
      'methodology_gap':  { why: 'Publication bias is exacerbated when methods are vague, because reviewers cannot tell if a negative result came from a genuinely null effect or from a flawed experiment. Tighter methods reporting standards are therefore a lever for reducing bias: if methods are clear, null results are publishable; if methods are vague, null results look like failed experiments.', move: 'Build or position in methods reporting services: SciScore, Penelope.ai, EQUATOR Network reporting checklists, protocols.io for step-level protocols. Sell to journals as a bias-correction infrastructure that protects the reputation of negative-result submissions.' }
    }
  };

  var MECH_FALLBACK = {
    'replication_failure': { why: 'Findings cannot be reproduced.', move: 'Build replication tooling and sell to journals.' },
    'data_integrity':     { why: 'Data integrity is at risk.', move: 'Build integrity audit tools and sell to publishers.' },
    'funding_decline':    { why: 'Research funding is shrinking.', move: 'Build grant analytics and sell to research offices.' },
    'publication_bias':   { why: 'Publication bias is widening.', move: 'Build registered reports tooling and sell to journals.' },
    'paradigm_shift':     { why: 'Paradigms are in flux.', move: 'Build structured open debate platforms.' },
    'workforce_loss':     { why: 'Researchers are leaving the system.', move: 'Build career support platforms for PhDs.' },
    'peer_review_strain': { why: 'Peer review is overloaded.', move: 'Build peer review augmentation tools.' },
    'methodology_gap':    { why: 'Methods documentation is incomplete.', move: 'Build methods reporting tools.' },
    'open_science':       { why: 'Open science adoption is uneven.', move: 'Build open science adoption services.' },
    'translation_gap':    { why: 'Research-to-product translation is failing.', move: 'Build tech transfer support services.' }
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
    return fetch('/assets/data/deep/science-branch-index.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { _branchIndex = d; return d; }).catch(function () { _branchIndexFailed = true; return null; });
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
    el.innerHTML = '<div style="color:#807868;font-size:0.28rem">Loading branch\u2026</div>';
    fetch('/assets/data/domains/' + encodeURIComponent(pid) + '.json').then(function(r) { if (r.ok) return r; return fetch('/api/fetch-portal?domainId=' + encodeURIComponent(pid)); })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var h = '';
        for (var ai = 0; ai < (data.activations || []).length; ai++) {
          var a = data.activations[ai];
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

  function renderMoneyPlays(state) {
    var opps = state.opportunities || [];
    if (opps.length === 0) return '<div class="eos-quiet">No opportunities surfaced yet. Brain is still ingesting feeds.</div>';
    var top = opps.slice(0, 6);
    var h = '<div class="eos-plays">';
    for (var i = 0; i < top.length; i++) {
      var o = top[i];
      h += '<div class="eos-play">';
      h += '<span class="eos-play-rank">' + (i + 1) + '</span>';
      h += '<div class="eos-play-name">' + esc(o.title || '') + promotedBadge(o) + '</div>';
      h += '<span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span>';
      if (o.urgency === 'IMMEDIATE' || o.urgency === 'high') h += ' <span style="font-size:0.26rem;color:#e85454;letter-spacing:1px;margin-left:4px">URGENT</span>';
      h += '<div class="eos-play-why">' + esc(o.explain || (o.moneyChain && o.moneyChain.whyPays) || '') + '</div>';
      h += '<div class="eos-play-outcome">' + esc(o.outcome || o.valueRange || '') + '</div>';
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
      h += '<tr' + (o.urgency === 'IMMEDIATE' || o.urgency === 'high' ? ' style="border-left:2px solid #e85454"' : '') + '>';
      h += '<td class="eos-queue-pri">' + (i + 1) + '</td>';
      h += '<td class="eos-queue-name">' + esc(o.title || '') + promotedBadge(o) + '</td>';
      h += '<td><span class="eos-play-path ' + pathClass(o.path) + '">' + pathLabel(o.path) + '</span></td>';
      h += '<td class="eos-queue-why">' + esc(o.explain || (o.moneyChain && o.moneyChain.whyPays) || '') + '</td>';
      h += '<td>' + esc(o.window || (o.moneyChain && o.moneyChain.timing) || '') + '</td>';
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

    var bridge = window.LIMENSciencePromotionBridge;
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('research') : null;
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
    injectStyles();

    var stress = state.stress || 0;
    var stressPct = Math.round(stress * 100);
    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });

    var h = '';
    var summaryText = 'Science domain at <b>' + stressPct + '%</b> stress. ';
    if (activeDx.length > 0) {
      summaryText += '<b>' + activeDx.length + '</b> active diagnoses. ';
      var primaryDx = activeDx[0];
      var ctx = DX_CONTEXT[primaryDx.id];
      if (ctx) summaryText += ctx.what + '. ';
      if (ctx) summaryText += '<b>Money move:</b> ' + ctx.step;
    } else {
      summaryText += 'No active diagnoses. Watch for emerging research integrity, funding, or workforce signals.';
    }
    h += '<div class="eos-summary">' + summaryText + '</div>';

    var anchorHtml = renderAnchorDirective(state);
    if (anchorHtml) h += anchorHtml;

    var deepProofHtml = renderDeepProofBlock(state);
    if (deepProofHtml) h += deepProofHtml;

    h += wrapCollapsible('top-money-plays', 'TOP MONEY PLAYS', renderMoneyPlays(state), true);
    h += wrapCollapsible('action-queue', 'ACTION QUEUE', renderActionQueue(state), true);

    h += '<div id="sbr-mount-point"></div>';

    _operatorView.innerHTML = h;

    var sbrMount = document.getElementById('sbr-mount-point');
    if (sbrMount && window.LIMENScienceBusinessReview) window.LIMENScienceBusinessReview.mount(sbrMount);

    var _top = window.LIMENScience && window.LIMENScience.economy && window.LIMENScience.economy.panel;
    if (_top) _top.inject();
    var _scf = window.LIMENScience && window.LIMENScience.economy && window.LIMENScience.economy.claimFlow;
    if (_scf) _scf.injectIntoCards();
  }

  function switchToOperator() {
    var cv = document.getElementById('clarity-view');
    if (cv) cv.style.display = 'none';
    if (_operatorView) _operatorView.style.display = 'block';
    _isOperatorMode = true;
    updateToggleButton();
    renderOperator();
  }

  function switchToConsole() {
    var cv = document.getElementById('clarity-view');
    if (cv) cv.style.display = '';
    if (_operatorView) _operatorView.style.display = 'none';
    _isOperatorMode = false;
    updateToggleButton();
  }

  function updateToggleButton() {
    var btnC = document.getElementById('chModeConsole');
    var btnO = document.getElementById('chModeOperator');
    if (btnC) btnC.classList.toggle('active', !_isOperatorMode);
    if (btnO) btnO.classList.toggle('active', _isOperatorMode);
  }

  function boot() {
    if (_booted) return;
    injectStyles();

    var clarityView = document.getElementById('clarity-view');
    if (!clarityView || !clarityView.parentNode) return;
    _operatorView = document.createElement('div');
    _operatorView.id = VIEW_ID;
    _operatorView.style.display = 'none';
    clarityView.parentNode.insertBefore(_operatorView, clarityView.nextSibling);

    // Wire page-header Console / Operator buttons
    var btnConsole = document.getElementById('chModeConsole');
    var btnOperator = document.getElementById('chModeOperator');
    if (btnConsole) btnConsole.addEventListener('click', function () { if (_isOperatorMode) switchToConsole(); });
    if (btnOperator) btnOperator.addEventListener('click', function () { if (!_isOperatorMode) switchToOperator(); });

    _operatorView.addEventListener('click', function (e) {
      var sectionHeader = e.target.closest('.eos-section-header');
      if (sectionHeader && !e.target.closest('button') && !e.target.closest('a')) {
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
      var drillBtn = e.target.closest('[data-drill-id]');
      if (drillBtn) {
        _handleDrillClick(drillBtn.getAttribute('data-drill-id'), drillBtn.getAttribute('data-node'), drillBtn.getAttribute('data-ancestry'));
        return;
      }
      var loadBranchBtn = e.target.closest('[data-load-branch]');
      if (loadBranchBtn) {
        _handleLoadBranch(loadBranchBtn.getAttribute('data-load-branch'));
        return;
      }
    });

    _booted = true;

    var _params = new URLSearchParams(window.location.search);
    if (_params.get('mode') === 'operator') switchToOperator();

    console.log('[ScienceClarityOperator] Booted \u2014 operator view ready');
  }

  var _bootCheck = setInterval(function () {
    var cv = document.getElementById('clarity-view');
    var state = getState();
    var brainRendered = cv && cv.querySelector('#dcb-exec');
    if (brainRendered && state && state.updated > 0) {
      clearInterval(_bootCheck);
      boot();

      var _reRendered = false;
      function _onBrainUpdate() {
        if (_reRendered) return;
        var freshState = getState();
        if (freshState && freshState.diagnoses && freshState.diagnoses.some(function (d) { return d.active; })) {
          _reRendered = true;
          window.removeEventListener('limen:domain-brain-update', _onBrainUpdate);
          if (_isOperatorMode) renderOperator();
        }
      }
      window.addEventListener('limen:domain-brain-update', _onBrainUpdate);
      setTimeout(function () { window.removeEventListener('limen:domain-brain-update', _onBrainUpdate); }, 90000);
    }
  }, 300);

  window.LIMENScienceClarityOperator = {
    renderOperator: renderOperator,
    switchToOperator: switchToOperator,
    switchToConsole: switchToConsole
  };

})();
