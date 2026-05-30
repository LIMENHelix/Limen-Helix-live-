/**
 * culture-clarity-operator.js — Money-Driven Action Surface for Culture Domain
 *
 * Self-gates: only runs when ?domain=culture
 *
 * Sections:
 *   1. TOP DIRECTIVE
 *   2. SOURCE INTELLIGENCE block (inside anchor)
 *   3. DEEP INTELLIGENCE expandable
 *   4. DEEP PROOF — FRACTAL INTELLIGENCE block
 *   5. DRILL DEEPER / LOAD BRANCH
 *   6. TOP MONEY PLAYS
 *   7. ACTION QUEUE
 *   8. BUSINESS REVIEW (mounts culture-business-review.js)
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'culture' && _dom !== 'culture') return;

  var VIEW_ID = 'sos-operator-view';
  var STATUS_KEY = 'limen_culture_operator_status';
  var COLLAPSE_KEY = 'limen_culture_collapse_state';
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
    var brain = brains.get('culture');
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

  // ── CULTURE-NATIVE LANGUAGE ──

  var DX_CONTEXT = {
    'CULTURAL_ERASURE': {
      what: 'Languages, traditions, and cultural practices are disappearing as globalization, urbanization, and political suppression dissolve the communities that sustain them \u2014 indigenous languages dying at a rate of one every two weeks, folk art traditions losing practitioner pipelines, and heritage sites falling into disrepair or demolition',
      money: 'Cultural preservation technology, heritage digitization platforms (3D scanning, AR/VR), language-learning apps, streaming platforms licensing indigenous and minority-language content, and cultural tourism operators all see rising demand. NEA and NEH grants accelerate. UNESCO Intangible Heritage programs expand. Philanthropic capital from Ford Foundation, Mellon Foundation, and MacArthur flows into preservation.',
      step: 'Track UNESCO Intangible Cultural Heritage list changes, NEA/NEH grant cycles, Endangered Languages Project data, and Smithsonian Center for Folklife and Cultural Heritage initiatives. Position in cultural content platforms (Disney, Netflix, Spotify for indigenous content licensing), heritage tech (Unity, Roblox for digital preservation), and cultural tourism (Airbnb Experiences, Booking).',
      outcome: '$5M-$200M heritage preservation programs, digital archive contracts, cultural content licensing deals, and foundation grants'
    },
    'HERITAGE_DESTRUCTION': {
      what: 'Physical cultural heritage \u2014 monuments, museums, historic buildings, archaeological sites, sacred spaces \u2014 is being destroyed by conflict, climate change, urban development, or deliberate political demolition, triggering international response and reconstruction programs',
      money: 'Heritage reconstruction engineering firms, museum technology providers, archival and conservation services, cultural insurance underwriters, and architectural preservation firms all benefit. Getty Conservation Institute, World Monuments Fund, and Smithsonian restoration programs expand. UNESCO World Heritage emergency fund activates.',
      step: 'Track UNESCO World Heritage in Danger list, ICOMOS condition reports, Getty Conservation Institute projects, World Monuments Fund Watch list, and Smithsonian restoration contracts. Position in museum technology (interactive displays, climate control, security), conservation engineering, and cultural insurance.',
      outcome: '$10M-$500M heritage reconstruction contracts, museum renovation programs, and archival digitization projects'
    },
    'CENSORSHIP': {
      what: 'Governments, platforms, or institutions are systematically suppressing artistic expression, journalistic freedom, literary publication, or digital speech \u2014 banning books, deplatforming creators, restricting film distribution, or criminalizing cultural discourse',
      money: 'Anti-censorship technology (VPNs, encrypted platforms), independent publishing, alternative content distribution, free-expression legal defense, and creator-economy platforms all see demand spikes. PEN America, Reporters Without Borders, and ACLU litigation programs expand. Creator platforms that guarantee expression rights gain users.',
      step: 'Track PEN America Freedom to Write Index, Reporters Without Borders Press Freedom Index, ALA banned-books data, platform transparency reports (Meta, Alphabet, Snap), and state-level legislative trackers. Position in creator platforms (Meta, Alphabet/YouTube, Reddit, Snap), independent publishing (Squarespace, Wix for creator sites), and expression-tech.',
      outcome: '$5M-$300M in creator platform growth, anti-censorship tech contracts, legal defense funding, and alternative distribution deals'
    },
    'IDENTITY_CRISIS': {
      what: 'Communities, nations, or demographic groups are experiencing acute identity fragmentation \u2014 cultural polarization, generational value conflicts, diaspora disconnection, or loss of shared cultural narratives \u2014 eroding social cohesion and institutional trust',
      money: 'Cultural commerce platforms (handmade, artisanal, identity-driven goods), language-learning technology, cultural travel and experience platforms, wellness and lifestyle brands rooted in cultural identity, and intercultural dialogue programs all benefit. Foundation grants for community cohesion programs expand.',
      step: 'Track Pew Research cultural attitudes surveys, Gallup social cohesion data, Duolingo language-learning trends, Etsy handmade marketplace growth, Airbnb Experiences cultural category data, and cultural identity polling. Position in cultural commerce (Etsy, Shopify cultural merchants, Coupang, MercadoLibre), language tech (Duolingo), and cultural lifestyle brands (Lululemon, Nike, Est\u00e9e Lauder).',
      outcome: '$10M-$500M cultural commerce growth, language platform ARR expansion, cultural experience revenue, and foundation-funded cohesion programs'
    },
    'CREATIVE_STAGNATION': {
      what: 'Creative industries \u2014 music, film, theater, visual arts, gaming, publishing \u2014 are experiencing declining output quality, audience disengagement, talent pipeline collapse, or institutional ossification, threatening the economic and social value of cultural production',
      money: 'Live entertainment operators, music streaming platforms, gaming companies, creative tools and production technology, artist development programs, and cultural marketing platforms all benefit from creative renewal cycles. Live Nation concert revenue, Spotify creator tools, gaming content expansion, and arts education funding all see upside.',
      step: 'Track Billboard/Luminate music data, box office trends (Comscore), Nielsen streaming ratings, Steam/Epic game release data, NEA arts participation surveys, and Tony/Grammy/Emmy nomination diversity metrics. Position in live entertainment (Live Nation, MSG Entertainment), streaming (Spotify, Netflix, Roku), gaming (DraftKings, Penn Entertainment), and creative marketing (Zeta Global, The Trade Desk).',
      outcome: '$10M-$1B+ live entertainment revenue, streaming content deals, gaming franchise launches, and arts education program contracts'
    }
  };

  var PATH_LABELS = { 'PATENTABLE': 'PATENT', 'GRANT-ELIGIBLE': 'GRANT', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'PATENTABLE': 'eos-path-patent', 'GRANT-ELIGIBLE': 'eos-path-grant', 'INVESTABLE': 'eos-path-invest' };
  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  var DX_TO_PLAYBOOK = {
    'CULTURAL_ERASURE':       'culture_heritage',
    'HERITAGE_DESTRUCTION':   'culture_heritage',
    'CENSORSHIP':             'culture_expression',
    'IDENTITY_CRISIS':        'culture_identity',
    'CREATIVE_STAGNATION':    'culture_creative'
  };

  var INVEST_TARGETS = {
    'culture_heritage': [
      { ticker: 'DIS',  name: 'The Walt Disney Company',        cik: '1744489', validation: 'HELIX_VALIDATED', reason: 'Largest cultural IP library on earth; Disney+, Pixar, Marvel, Lucasfilm, and National Geographic preserve and distribute heritage narratives globally' },
      { ticker: 'CMCSA',name: 'Comcast / NBCUniversal',         cik: '1166691', validation: 'HELIX_VALIDATED', reason: 'NBCUniversal, Universal Pictures, DreamWorks, and Peacock carry deep cultural archives; theme parks serve as physical heritage experiences' },
      { ticker: 'WBD',  name: 'Warner Bros. Discovery',         cik: '1437107', validation: 'DOMAIN_MAPPED',   reason: 'HBO, CNN, Discovery Channel, and Warner Bros. film vault are load-bearing cultural heritage archives spanning a century of American storytelling' },
      { ticker: 'PARA', name: 'Paramount Global',               cik: '813828',  validation: 'DOMAIN_MAPPED',   reason: 'CBS, Paramount Pictures, MTV, BET, and Nickelodeon libraries constitute irreplaceable cultural heritage spanning multiple generations' },
      { ticker: 'NFLX', name: 'Netflix',                        cik: '1065280', validation: 'HELIX_VALIDATED', reason: 'Largest global streaming platform investing $17B+/yr in original content; commissions indigenous, minority-language, and culturally specific programming worldwide' },
      { ticker: 'SONY', name: 'Sony Group',                     cik: '313838',  validation: 'DOMAIN_MAPPED',   reason: 'Sony Pictures, Sony Music, and PlayStation constitute a cross-media cultural preservation and distribution powerhouse spanning film, music, and interactive media' },
      { ticker: 'RBLX', name: 'Roblox',                         cik: '1315098', validation: 'DOMAIN_MAPPED',   reason: 'Digital platform where cultural heritage is being recreated in immersive 3D; museums, historic sites, and cultural events are rebuilt as interactive experiences for Gen Z' },
      { ticker: 'U',    name: 'Unity Software',                 cik: '1810806', validation: 'DOMAIN_MAPPED',   reason: 'Real-time 3D engine used by museums (Smithsonian, British Museum) and heritage organizations for digital twin preservation of cultural sites and artifacts' },
      { ticker: 'SPOT', name: 'Spotify',                        cik: '1639920', validation: 'HELIX_VALIDATED', reason: 'Largest audio platform preserving and distributing music, podcasts, and oral culture across 184 markets; indigenous and folk music archives gain global reach' },
      { ticker: 'LYV',  name: 'Live Nation Entertainment',      cik: '1335258', validation: 'HELIX_VALIDATED', reason: 'Largest live entertainment company globally; concerts, festivals, and cultural events are primary vehicles for living heritage transmission' },
      { ticker: 'MSGS', name: 'Madison Square Garden Sports',   cik: '1868726', validation: 'DOMAIN_MAPPED',   reason: 'Iconic cultural venue operator; MSG, Radio City Music Hall, and Beacon Theatre are heritage performance spaces with century-long cultural significance' },
      { ticker: 'IMAX', name: 'IMAX Corporation',               cik: '921582',  validation: 'DOMAIN_MAPPED',   reason: 'Premium large-format cinema technology used for cultural documentary presentation; IMAX documentaries on heritage sites reach millions annually' }
    ],
    'culture_expression': [
      { ticker: 'META', name: 'Meta Platforms',                  cik: '1326801', validation: 'HELIX_VALIDATED', reason: 'Facebook, Instagram, WhatsApp, and Threads are primary platforms for cultural expression; content moderation policies directly shape what cultural speech is permitted globally' },
      { ticker: 'GOOGL',name: 'Alphabet / YouTube',             cik: '1652044', validation: 'HELIX_VALIDATED', reason: 'YouTube is the world\u2019s largest cultural expression platform; Google Arts & Culture digitizes museum collections; Search shapes cultural discourse discovery' },
      { ticker: 'SNAP', name: 'Snap Inc.',                      cik: '1564408', validation: 'DOMAIN_MAPPED',   reason: 'Snapchat AR lenses and Spotlight are primary creative expression tools for Gen Z; cultural trends originate and propagate through Snap\u2019s visual storytelling platform' },
      { ticker: 'PINS', name: 'Pinterest',                      cik: '1562088', validation: 'DOMAIN_MAPPED',   reason: 'Visual discovery platform where cultural aesthetics, design traditions, and creative inspiration are curated and shared across 480M+ monthly users' },
      { ticker: 'RDDT', name: 'Reddit',                         cik: '1713445', validation: 'DOMAIN_MAPPED',   reason: 'Community-driven cultural discourse platform; subreddits serve as digital town squares for every cultural niche from folk art to underground music' },
      { ticker: 'TTWO', name: 'Take-Two Interactive',           cik: '946581',  validation: 'DOMAIN_MAPPED',   reason: 'Grand Theft Auto, Red Dead Redemption, and NBA 2K are cultural artifacts that shape and reflect American cultural narratives for hundreds of millions' },
      { ticker: 'EA',   name: 'Electronic Arts',                cik: '712515',  validation: 'DOMAIN_MAPPED',   reason: 'FIFA/EA Sports FC, Madden, and The Sims franchise embed cultural expression into interactive media reaching 600M+ players globally' },
      { ticker: 'SE',   name: 'Sea Limited',                    cik: '1702780', validation: 'DOMAIN_MAPPED',   reason: 'Garena gaming and Shopee commerce platform serve as Southeast Asian cultural expression and commerce hubs across 700M+ users' },
      { ticker: 'BILI', name: 'Bilibili',                       cik: '1737287', validation: 'DOMAIN_MAPPED',   reason: 'China\u2019s premier cultural expression platform for Gen Z; animation, gaming, music, and cultural commentary content with 340M+ monthly active users' },
      { ticker: 'TME',  name: 'Tencent Music Entertainment',    cik: '1744676', validation: 'DOMAIN_MAPPED',   reason: 'China\u2019s dominant music platform (QQ Music, Kugou, Kuwo) shaping cultural expression for 800M+ users; karaoke and social music features preserve folk traditions' },
      { ticker: 'WIX',  name: 'Wix',                            cik: '1576789', validation: 'DOMAIN_MAPPED',   reason: 'Website builder empowering independent creators, artists, and cultural organizations to establish digital presence outside platform gatekeepers' },
      { ticker: 'SQSP', name: 'Squarespace',                    cik: '1496963', validation: 'DOMAIN_MAPPED',   reason: 'Premium website platform used by artists, galleries, cultural nonprofits, and independent publishers to maintain sovereign cultural expression online' }
    ],
    'culture_identity': [
      { ticker: 'CPNG', name: 'Coupang',                        cik: '1834584', validation: 'DOMAIN_MAPPED',   reason: 'South Korea\u2019s dominant e-commerce platform; K-culture commerce (K-beauty, K-food, K-fashion) reaches global markets through Coupang\u2019s logistics network' },
      { ticker: 'MELI', name: 'MercadoLibre',                   cik: '1099590', validation: 'DOMAIN_MAPPED',   reason: 'Latin America\u2019s largest commerce platform; enables regional cultural commerce, artisan goods, and identity-driven products across 18 countries' },
      { ticker: 'GRAB', name: 'Grab Holdings',                  cik: '1855612', validation: 'DOMAIN_MAPPED',   reason: 'Southeast Asia\u2019s super-app connecting cultural food traditions, local merchants, and community commerce across 700+ cities' },
      { ticker: 'NU',   name: 'Nu Holdings',                    cik: '1904248', validation: 'DOMAIN_MAPPED',   reason: 'Latin America\u2019s largest digital bank; financial inclusion enables cultural entrepreneurship and artisan commerce for 90M+ previously unbanked customers' },
      { ticker: 'SHOP', name: 'Shopify',                        cik: '1594805', validation: 'HELIX_VALIDATED', reason: 'Commerce platform empowering cultural entrepreneurs, indigenous artisans, and identity-driven brands to sell globally without platform intermediation' },
      { ticker: 'ETSY', name: 'Etsy',                           cik: '1370637', validation: 'HELIX_VALIDATED', reason: 'Premier marketplace for handmade, vintage, and culturally significant goods; 90M+ active buyers seeking artisan and identity-authentic products' },
      { ticker: 'ABNB', name: 'Airbnb',                         cik: '1559720', validation: 'HELIX_VALIDATED', reason: 'Airbnb Experiences enable cultural immersion travel; platform connects travelers with local cultural practitioners, artisans, and community traditions worldwide' },
      { ticker: 'BKNG', name: 'Booking Holdings',               cik: '1075531', validation: 'DOMAIN_MAPPED',   reason: 'Cultural tourism infrastructure; Booking.com, Agoda, and OpenTable connect travelers to cultural destinations, heritage hotels, and culinary traditions' },
      { ticker: 'DUOL', name: 'Duolingo',                       cik: '1562088', validation: 'HELIX_VALIDATED', reason: 'World\u2019s largest language-learning platform with 88M+ monthly active users; preserves endangered languages (Hawaiian, Navajo, Scottish Gaelic) alongside major languages' },
      { ticker: 'LULU', name: 'Lululemon Athletica',            cik: '1397187', validation: 'DOMAIN_MAPPED',   reason: 'Wellness-culture lifestyle brand that has defined a global cultural identity movement around mindfulness, yoga, and intentional living' },
      { ticker: 'NKE',  name: 'Nike',                           cik: '320187',  validation: 'DOMAIN_MAPPED',   reason: 'Most culturally influential athletic brand globally; Nike\u2019s collaborations with artists, musicians, and cultural movements shape identity expression across demographics' },
      { ticker: 'EL',   name: 'Est\u00e9e Lauder',                     cik: '1001250', validation: 'DOMAIN_MAPPED',   reason: 'Cultural beauty conglomerate (MAC, Clinique, La Mer, Bobbi Brown) whose brands define beauty standards and cultural identity across global markets' }
    ],
    'culture_creative': [
      { ticker: 'SPOT', name: 'Spotify',                        cik: '1639920', validation: 'HELIX_VALIDATED', reason: 'Largest music streaming platform; Spotify for Artists tools, editorial playlists, and podcast creator programs drive creative industry economics for 11M+ creators' },
      { ticker: 'LYV',  name: 'Live Nation Entertainment',      cik: '1335258', validation: 'HELIX_VALIDATED', reason: 'Controls 70%+ of major concert touring; Ticketmaster, venue operations, and artist management make Live Nation the backbone of live creative industry economics' },
      { ticker: 'MSGS', name: 'Madison Square Garden Sports',   cik: '1868726', validation: 'DOMAIN_MAPPED',   reason: 'Iconic venue operator for premium live cultural and sporting events; MSG brand is synonymous with New York cultural production' },
      { ticker: 'WMG',  name: 'Warner Music Group',             cik: '1319161', validation: 'HELIX_VALIDATED', reason: 'Third-largest music label globally (Atlantic, Warner Records, Elektra); controls publishing rights and artist development pipeline for cultural music production' },
      { ticker: 'DIS',  name: 'The Walt Disney Company',        cik: '1744489', validation: 'HELIX_VALIDATED', reason: 'Largest creative content producer globally; Disney+, theatrical releases, theme parks, and consumer products form the dominant cultural production ecosystem' },
      { ticker: 'NFLX', name: 'Netflix',                        cik: '1065280', validation: 'HELIX_VALIDATED', reason: 'Commissions $17B+/yr in original creative content across 190 countries; Netflix originals drive global cultural conversation and creative talent demand' },
      { ticker: 'ROKU', name: 'Roku',                           cik: '1428439', validation: 'DOMAIN_MAPPED',   reason: 'Connected TV platform reaching 80M+ active accounts; Roku Channel original content and ad-supported cultural programming expand creative distribution' },
      { ticker: 'CZR',  name: 'Caesars Entertainment',          cik: '858339',  validation: 'DOMAIN_MAPPED',   reason: 'Major live entertainment and cultural event venue operator; Caesars Palace, Planet Hollywood, and Las Vegas residency programs are cultural production platforms' },
      { ticker: 'MGM',  name: 'MGM Resorts International',      cik: '789570',  validation: 'DOMAIN_MAPPED',   reason: 'Cultural entertainment complex operator; MGM Grand, Bellagio, and T-Mobile Arena host concerts, shows, and cultural events reaching millions annually' },
      { ticker: 'DKNG', name: 'DraftKings',                     cik: '1883685', validation: 'DOMAIN_MAPPED',   reason: 'Cultural gaming platform transforming sports fandom into interactive cultural participation; 30M+ users engage with sports as cultural entertainment' },
      { ticker: 'PENN', name: 'Penn Entertainment',             cik: '921738',  validation: 'DOMAIN_MAPPED',   reason: 'ESPN Bet partnership and Barstool Sports cultural media integration make Penn a cultural entertainment convergence play bridging sports, media, and gaming' },
      { ticker: 'ZETA', name: 'Zeta Global',                    cik: '1578732', validation: 'DOMAIN_MAPPED',   reason: 'Cultural marketing intelligence platform; AI-driven audience targeting helps creative industries reach culturally aligned audiences at scale' },
      { ticker: 'TTD',  name: 'The Trade Desk',                 cik: '1671933', validation: 'DOMAIN_MAPPED',   reason: 'Programmatic ad platform enabling cultural content monetization; connected TV and audio ad buying fund creative production across streaming platforms' },
      { ticker: 'UMG',  name: 'Universal Music Group',          cik: null,      validation: 'DOMAIN_MAPPED',   reason: 'World\u2019s largest music company (UMG Amsterdam-listed); controls artist development, publishing rights, and cultural music production pipeline globally' }
    ]
  };

  var PLAYBOOK_DEFS = {
    'culture_heritage': { title: 'Heritage Preservation & IP', domains: ['culture', 'law'], type: 'invest' },
    'culture_expression': { title: 'Creative Expression & Media', domains: ['culture', 'communication'], type: 'invest' },
    'culture_identity': { title: 'Identity & Social Cohesion', domains: ['culture', 'population'], type: 'invest' },
    'culture_creative': { title: 'Creative Economy & Innovation', domains: ['culture', 'economy'], type: 'invest' }
  };

  function resolvePlaybookId(opp) {
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    return 'culture_heritage';
  }

  // ── MECHANISM EXPLANATIONS ──

  var MECH_EXPLAIN = {
    'CULTURAL_ERASURE': {
      'identity_fracture':         { why: 'When shared cultural identity fragments \u2014 through diaspora disconnection, generational breaks in tradition transmission, or political suppression of minority cultures \u2014 communities lose the social fabric that held them together. UNESCO reports that 40% of the world\u2019s 7,000 languages are endangered. The Navajo Nation lost 10% of its fluent speakers during COVID alone. Every fractured identity community becomes a market for reconnection technology, cultural content, and heritage preservation.', move: 'Position in language-learning platforms (Duolingo DUOL for endangered language programs), cultural streaming (Netflix indigenous content commissioning, Spotify folk/indigenous music catalogs), cultural commerce (Etsy artisan marketplace, Shopify cultural merchant tools), and heritage digitization (Unity 3D scanning, Roblox cultural world-building). Target NEA/NEH preservation grants, Ford Foundation cultural programs, and Mellon Foundation humanities funding.' },
      'cultural_loss':             { why: 'Cultural loss is the permanent disappearance of practices, languages, art forms, and knowledge systems that cannot be reconstructed once the last practitioners die. The Endangered Languages Project documents ~3,000 languages at risk. Intangible heritage \u2014 oral histories, folk medicine, traditional craftsmanship \u2014 is lost at an accelerating rate as urbanization pulls young people away from traditional communities. Every cultural loss event triggers preservation spending and archival urgency.', move: 'Position in heritage technology companies (Unity for 3D heritage scanning, IMAX for cultural documentaries), media platforms that license and distribute endangered cultural content (Disney+, Netflix, Spotify), and cultural tourism operators (Airbnb Experiences, Booking cultural travel). Target UNESCO Intangible Heritage funding, Smithsonian Center for Folklife, Getty Conservation Institute grants, and MacArthur Foundation genius grants for cultural preservationists.' },
      'symbolic_disunity':         { why: 'When societies lose shared symbols \u2014 through monument removal debates, flag controversies, contested holidays, or narrative fragmentation \u2014 the cultural glue that enables collective action dissolves. The Confederate monument debate in the U.S. generated $500M+ in municipal spending on removal, replacement, and recontextualization. Every symbolic controversy creates demand for cultural mediation, public art commissioning, and narrative infrastructure.', move: 'Position in cultural consulting and public art commissioning (Smithsonian affiliates, local arts councils), media companies that produce cultural narrative content (Disney, Warner Bros Discovery, Paramount), and cultural analytics platforms (Nielsen cultural measurement, Comscore audience analytics). Target NEA Our Town grants, state arts council funding, and municipal cultural infrastructure programs.' },
      'social_cohesion_erosion':   { why: 'Social cohesion erosion \u2014 measured by declining trust in institutions, reduced civic participation, and increasing cultural polarization \u2014 is now a structural condition in most Western democracies. Pew Research documents that interpersonal trust in the U.S. has fallen from 50% (1972) to 30% (2024). Bridgebuilding programs, community arts, interfaith dialogue, and cultural exchange initiatives all receive funding when cohesion metrics decline.', move: 'Position in community engagement platforms (Meta community features, Reddit community subreddits, Snap local stories), cultural experience platforms (Airbnb Experiences, Live Nation community concert series), and cultural identity brands that bridge demographics (Nike cultural campaigns, Lululemon community programs). Target Ford Foundation Building Bridges program, Knight Foundation community grants, and NEA Challenge America grants.' }
    },
    'HERITAGE_DESTRUCTION': {
      'heritage_loss':             { why: 'Heritage loss through conflict, neglect, or deliberate destruction eliminates irreplaceable cultural assets. ISIS destruction of Palmyra, Nimrud, and Mosul Museum generated $200M+ in international reconstruction funding. Climate change threatens 1-in-6 UNESCO World Heritage sites. Every heritage loss event triggers emergency conservation spending, digital preservation programs, and international reconstruction contracts.', move: 'Position in heritage reconstruction engineering (conservation architecture firms), museum technology providers (interactive displays, climate control, security systems), and digital preservation technology (Unity 3D scanning, photogrammetry). Target UNESCO World Heritage Fund, Getty Conservation Institute contracts, World Monuments Fund Watch programs, and Smithsonian restoration initiatives.' },
      'monument_destruction':      { why: 'Monument destruction \u2014 whether by conflict, natural disaster, or political decision \u2014 creates immediate reconstruction demand and long-term conservation programs. The Notre-Dame de Paris fire (2019) generated $850M+ in reconstruction funding. Earthquake damage to cultural sites in Turkey, Syria, Morocco, and Nepal has triggered multi-billion-dollar international reconstruction programs. Every destroyed monument becomes a multi-year engineering and conservation contract.', move: 'Position in architectural conservation firms, construction companies with heritage specialization, museum technology (IMAX documentaries of damaged sites), and crowdfunding platforms that channel cultural giving. Target UNESCO Emergency Fund, ICOMOS emergency missions, Getty Conservation Institute fieldwork, and bilateral cultural reconstruction agreements.' },
      'archive_degradation':       { why: 'Archives \u2014 physical and digital \u2014 are degrading at scale. The Library of Congress estimates 25% of its film collection is at risk. National archives in conflict zones have been destroyed (Iraq, Syria, Ukraine). Digital archives face format obsolescence and bit rot. Every archive degradation event accelerates digitization spending, cold storage investment, and preservation technology procurement.', move: 'Position in cloud storage and archival technology providers (for cultural institutions), media companies with deep library assets (Disney, Warner Bros Discovery, Sony \u2014 their archive preservation spending rises), and cultural digitization services. Target IMLS (Institute of Museum and Library Services) grants, NEH Preservation and Access division, and Andrew W. Mellon Foundation digital humanities programs.' },
      'cultural_manipulation':     { why: 'Cultural manipulation \u2014 governments or institutions rewriting history, sanitizing archives, or weaponizing cultural narratives for propaganda \u2014 triggers counter-responses from preservation organizations, academic institutions, and independent media. Russia\u2019s rewriting of WWII history, China\u2019s cultural assimilation programs in Tibet and Xinjiang, and book-banning movements in U.S. school districts all generate spending on counter-narratives, independent archives, and cultural education.', move: 'Position in independent media and publishing platforms (Reddit, Squarespace, Wix for independent cultural sites), education technology (Duolingo for suppressed languages), and cultural documentation organizations. Target PEN America programs, Reporters Without Borders cultural freedom initiatives, ACLU First Amendment litigation, and Open Society Foundations cultural programs.' }
    },
    'CENSORSHIP': {
      'expression_suppression':    { why: 'Expression suppression \u2014 book bans, content takedowns, artist imprisonment, film censorship \u2014 is accelerating globally. PEN America documented 4,200+ book bans in U.S. schools in 2023-2024 alone. China\u2019s content censorship regime affects 1B+ internet users. Every suppression event drives demand for anti-censorship technology, alternative distribution, and legal defense programs.', move: 'Position in creator platforms that resist censorship pressure (Meta, Alphabet/YouTube, Reddit, Snap), independent publishing platforms (Wix, Squarespace), and expression-tech companies. Target PEN America Emergency Fund, ACLU First Amendment litigation, Reporters Without Borders Press Freedom programs, and Electronic Frontier Foundation digital speech defense.' },
      'narrative_monopolization':  { why: 'When a single narrative dominates public discourse \u2014 through state media control, platform algorithm amplification, or institutional capture \u2014 alternative cultural voices are silenced. China\u2019s state media monopoly, Russia\u2019s RT/Sputnik propaganda network, and U.S. media consolidation all reduce narrative diversity. Counter-narrative demand drives spending on independent media, alternative platforms, and media literacy programs.', move: 'Position in alternative content platforms (Reddit, Bilibili, Snap, Pinterest), independent journalism tools (Wix, Squarespace for independent publishers), and cultural media companies that commission diverse voices (Netflix diverse content programs, Disney multicultural initiatives). Target Knight Foundation journalism grants, MacArthur Foundation media programs, and Ford Foundation narrative change initiatives.' },
      'ideology_lockin':           { why: 'Ideology lock-in occurs when educational institutions, media platforms, or cultural organizations enforce a single ideological framework, excluding competing perspectives. U.S. campus speech controversies, DEI policy reversals, and state-level education content mandates all create demand for pluralistic cultural programming, debate platforms, and ideological diversity programs.', move: 'Position in education technology (Duolingo multilingual exposure), diverse content platforms (Reddit, YouTube diverse creator programs), and cultural organizations that promote intellectual diversity. Target Foundation for Individual Rights and Expression (FIRE) programs, Heterodox Academy initiatives, and NEH public humanities grants that require diverse perspectives.' },
      'interpretive_narrowing':    { why: 'Interpretive narrowing \u2014 when cultural criticism, art interpretation, and historical analysis are constrained to a single approved framework \u2014 kills creative vitality and audience engagement. Museum attendance declines when exhibitions become ideologically monotone. Literary criticism that excludes dissenting readings loses readership. Every narrowing event creates counter-demand for pluralistic cultural programming.', move: 'Position in cultural experience platforms (Airbnb Experiences for alternative cultural tours, Live Nation for diverse performance programming), museum technology (interactive exhibits that offer multiple interpretive frameworks), and education content (Netflix/Disney documentaries that present multiple perspectives). Target NEA Arts Education grants, Mellon Foundation public humanities programs, and Smithsonian educational outreach contracts.' }
    },
    'IDENTITY_CRISIS': {
      'value_conflict':            { why: 'Value conflicts between generational, ethnic, religious, and political groups fracture markets and create demand for cultural mediation, community programming, and identity-affirming products. The U.S. culture wars generate billions in spending on both sides \u2014 from politically aligned media subscriptions to identity-driven consumer brands. Every value conflict deepens market segmentation and creates niche cultural commerce opportunities.', move: 'Position in identity-driven consumer brands (Nike cultural campaigns, Lululemon community wellness, Est\u00e9e Lauder multicultural beauty), cultural commerce platforms (Etsy identity-authentic goods, Shopify cultural merchants, Coupang K-culture exports), and community platforms (Reddit, Meta Groups, Snap local communities). Target brand consulting firms, cultural marketing agencies (Zeta Global, The Trade Desk cultural targeting), and foundation-funded community mediation programs.' },
      'tribal_segmentation':       { why: 'Tribal segmentation \u2014 when cultural communities become echo chambers that cannot communicate across group boundaries \u2014 creates parallel markets, fragmented media ecosystems, and competitive dynamics between cultural identity groups. This segmentation drives demand for cross-cultural platforms, intercultural education, and bridge-building cultural content.', move: 'Position in cross-cultural platforms (Airbnb cultural Experiences, Duolingo language bridges, Netflix global content), cultural commerce that bridges demographics (MercadoLibre Latin American artisan goods reaching global buyers, Bilibili Chinese cultural content reaching Western audiences), and advertising platforms that target across cultural segments (The Trade Desk, Zeta Global). Target UNESCO intercultural dialogue programs, State Department cultural exchange funding, and Ford Foundation bridging grants.' },
      'norm_instability':          { why: 'When cultural norms shift rapidly \u2014 gender roles, workplace culture, religious observance, family structure \u2014 individuals and institutions struggle to navigate the transition. Rapid norm change drives demand for cultural guidance content, identity coaching, wellness programming, and community anchor institutions that provide stability. The wellness industry ($5.6T global) is partly a response to norm instability.', move: 'Position in wellness and lifestyle brands (Lululemon, Nike wellness, Est\u00e9e Lauder self-care), cultural content platforms (Spotify wellness podcasts, Netflix mindfulness content, YouTube cultural guidance creators), and cultural commerce (Etsy handmade and artisanal as anchoring purchases). Target corporate wellness program contracts, community foundation grants, and cultural institution programming budgets.' },
      'ritual_confusion':          { why: 'Ritual confusion \u2014 when communities lose shared ceremonies, holidays, rites of passage, and gathering practices \u2014 creates demand for new ritual design, experience programming, and community gathering infrastructure. Secular funerals, non-religious weddings, alternative coming-of-age ceremonies, and corporate culture rituals are all growth markets. Live Nation, Airbnb Experiences, and cultural event producers fill the ritual gap.', move: 'Position in live experience operators (Live Nation festivals and community concerts, MSG Entertainment cultural events, Caesars and MGM entertainment programming), cultural experience platforms (Airbnb Experiences for ceremonial and traditional events), and cultural commerce (Etsy ceremonial goods, Shopify ritual product merchants). Target NEA folk and traditional arts programs, cultural tourism boards, and municipal cultural programming budgets.' }
    },
    'CREATIVE_STAGNATION': {
      'participation_decay':       { why: 'When audience participation in cultural activities declines \u2014 fewer people attending live performances, visiting museums, reading books, or engaging with new music \u2014 the economic foundation of creative industries erodes. NEA Survey of Public Participation in the Arts shows declining attendance across most art forms since 2012. COVID accelerated the shift but the trend was structural. Every participation decline creates demand for new engagement formats, digital experiences, and audience development programs.', move: 'Position in live entertainment innovators (Live Nation new venue formats, MSG Entertainment premium experiences), streaming platforms expanding cultural access (Spotify podcast growth, Netflix interactive content, Roku free ad-supported cultural programming), and cultural marketing (Zeta Global audience re-engagement, The Trade Desk cultural content advertising). Target NEA Challenge America grants, state arts council audience development programs, and cultural institution membership growth initiatives.' },
      'audience_collapse':         { why: 'Audience collapse occurs when specific creative sectors lose their core audience \u2014 classical music losing under-40 audiences, local newspapers losing subscribers, indie film losing theatrical distribution. Each collapse event forces restructuring: new distribution models, pricing innovation, and format experimentation. The journalism crisis ($30B+ in lost U.S. newspaper revenue since 2005) is the template.', move: 'Position in new-format distribution (Roku connected TV, Spotify audiobooks and podcasts, Reddit cultural communities), creator economy platforms (Snap Spotlight, Pinterest creator tools, YouTube Shorts), and cultural venue operators experimenting with new formats (Live Nation club-size venues, DraftKings interactive entertainment). Target Knight Foundation journalism innovation grants, NEA innovation in arts grants, and foundation-funded cultural sector restructuring programs.' },
      'creative_weakness':         { why: 'Creative weakness \u2014 when the output of cultural industries becomes repetitive, derivative, or risk-averse \u2014 signals institutional ossification. Hollywood sequel dependency (60%+ of major releases are franchises/sequels), music genre homogenization (loudness war, algorithmic optimization), and risk-averse publishing all indicate creative decline. Creative renewal requires new talent pipelines, risk capital, and institutional reform.', move: 'Position in creator development platforms (Spotify for Artists tools, Roblox creator economy, Unity game development democratization), live performance companies that break new artists (Live Nation emerging artist programs, Warner Music Group new artist development), and cultural education (Duolingo creative language learning, Netflix creative talent programs). Target NEA Creative Writing and Visual Arts fellowships, MacArthur Foundation genius grants, and Sundance/Tribeca independent film programs.' },
      'institutional_decline':     { why: 'When cultural institutions \u2014 museums, orchestras, theaters, libraries, film societies, literary magazines \u2014 decline through funding cuts, attendance drops, or leadership failure, the infrastructure of creative production weakens. American Alliance of Museums reports 30%+ of U.S. museums are in financial distress. Orchestra bankruptcies, theater closures, and independent bookstore shutdowns all signal institutional decline.', move: 'Position in museum and venue technology (interactive exhibits, digital ticketing, climate control), institutional management software, and cultural real estate (venue operators like Live Nation, MSG, Caesars who acquire distressed cultural venues). Target IMLS museum grants, NEA organizational capacity grants, Andrew W. Mellon Foundation institutional support, and state cultural institution emergency funds.' }
    }
  };

  var MECH_FALLBACK = {
    'identity_fracture':         { why: 'Cultural identity is fragmenting. Heritage preservation and reconnection technology see demand.', move: 'Position in Duolingo (language preservation), Netflix (indigenous content), Etsy (artisan cultural commerce), and cultural heritage tech.' },
    'cultural_loss':             { why: 'Cultural practices are being permanently lost. Archival and digitization spending accelerates.', move: 'Position in Unity (3D heritage scanning), IMAX (cultural documentaries), Spotify (folk music archives), and Airbnb (cultural experiences).' },
    'symbolic_disunity':         { why: 'Shared cultural symbols are contested. Public art, narrative content, and mediation programs see demand.', move: 'Position in Disney (cultural narrative), Warner Bros Discovery (heritage archives), and Nielsen (cultural analytics).' },
    'social_cohesion_erosion':   { why: 'Social trust is declining. Community engagement platforms and cultural bridging programs benefit.', move: 'Position in Meta (community features), Live Nation (community events), Nike (cultural campaigns), and Airbnb (cultural experiences).' },
    'heritage_loss':             { why: 'Physical and intangible heritage is at risk. Conservation and digitization contracts expand.', move: 'Position in Unity (digital preservation), museum technology providers, and cultural tourism platforms (Airbnb, Booking).' },
    'monument_destruction':      { why: 'Monuments and heritage sites are being destroyed. Reconstruction and conservation spending rises.', move: 'Position in conservation engineering firms, IMAX (heritage documentaries), and cultural reconstruction programs.' },
    'archive_degradation':       { why: 'Cultural archives are degrading. Digitization and preservation technology demand accelerates.', move: 'Position in cloud archival services, Disney/WBD/Sony (library preservation), and digital humanities technology.' },
    'cultural_manipulation':     { why: 'Cultural narratives are being manipulated. Counter-narrative and independent media demand rises.', move: 'Position in Reddit, Squarespace, Wix (independent publishing), Duolingo (suppressed languages), and PEN America programs.' },
    'expression_suppression':    { why: 'Cultural expression is being suppressed. Anti-censorship tech and alternative distribution benefit.', move: 'Position in Meta, YouTube, Reddit, Snap (creator platforms), and Wix/Squarespace (independent publishing).' },
    'narrative_monopolization':  { why: 'A single narrative dominates. Alternative platforms and diverse content commissioning see demand.', move: 'Position in Reddit, Bilibili, Netflix (diverse commissioning), and independent journalism platforms.' },
    'ideology_lockin':           { why: 'Ideological uniformity is being enforced. Pluralistic programming and debate platforms benefit.', move: 'Position in YouTube (diverse creators), Duolingo (multilingual exposure), and education content platforms.' },
    'interpretive_narrowing':    { why: 'Cultural interpretation is being constrained. Pluralistic exhibitions and multi-perspective content see demand.', move: 'Position in museum technology, Netflix/Disney (multi-perspective documentaries), and Airbnb (alternative cultural experiences).' }
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
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Culture condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

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
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Culture portal node. Company-level Helix validation pending.</div>';
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=culture&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
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
    return fetch('/assets/data/deep/culture-branch-index.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { _branchIndex = d; return d; }).catch(function () { _branchIndexFailed = true; return null; });
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

    var text = '<b>Culture domain at ' + pct + '% stress.</b> ';
    if (activeDx.length > 0) {
      text += activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' confirmed. ';
      var primaryDx = activeDx[0];
      var ctx = DX_CONTEXT[(primaryDx.id || '').toUpperCase()];
      if (ctx) text += ctx.what + '. <b>Money move:</b> ' + ctx.step;
    } else {
      text += 'No active diagnoses. Watch for heritage, expression, identity, or creative economy signals.';
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
      var claims = ledger.getClaimsByDomain('culture');
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
          domain: 'culture',
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
      if (o.path === 'GRANT-ELIGIBLE') {
        h += '<button class="eos-invest-btn" style="color:#5ab5a0;border-color:rgba(90,181,160,0.25)" data-exec-key="' + esc(key) + '" data-exec-path="GRANT-ELIGIBLE">GRANT \u2192</button>';
      }
      if (o.path === 'PATENTABLE') {
        h += '<button class="eos-invest-btn" style="color:#a87adb;border-color:rgba(168,122,219,0.25)" data-exec-key="' + esc(key) + '" data-exec-path="PATENTABLE">PATENT \u2192</button>';
      }
      if (o.paths && o.paths.indexOf('BUSINESS') !== -1) {
        h += '<button class="eos-invest-btn" style="color:#C9A94E;border-color:rgba(201,169,78,0.25)" data-exec-key="' + esc(key) + '" data-exec-path="BUSINESS">BUILD \u2192</button>';
      }
      if (o.compensation) {
        h += '<span style="font-size:0.22rem;color:#5ab5a0;white-space:nowrap">' + (o.compensation.base || 0) + (o.compensation.unit || '%') + '\u2192' + (o.compensation.maxTier ? o.compensation.maxTier.comp : '?') + (o.compensation.unit || '%') + '</span>';
      }
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'culture') : null;
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

    var bridge = window.LIMENCulturePromotionBridge;
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('culture') : null;
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
    h += '<div class="eos-title" style="margin-bottom:0">CULTURE \u00b7 OPERATOR SURFACE</div>';
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
      dxContent += '<div style="font-size:0.32rem;color:#908878">No active diagnoses. Watch for heritage, expression, identity, or creative economy signals.</div>';
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
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['culture'], type: 'invest' };

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=culture&returnTo=' + encodeURIComponent('/domain-console?domain=culture');
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
        window.LIMENClaimFlow.openClaimModal(opp, 'culture', function (confirmedOpp, estimate) {
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'culture', estimate);
          }
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel
    if (window.LIMENOperatorPanel) window.LIMENOperatorPanel.mount(_operatorView, 'culture');
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
    if (window.LIMENCultureBusinessReview) window.LIMENCultureBusinessReview.mount(_operatorView);
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

    console.log('[CultureOperator] Booted \u2014 operator view created, toggle wired');
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
