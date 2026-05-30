/**
 * religion-clarity-operator.js — Money-Driven Action Surface for Religion Domain
 *
 * Self-gates: only runs when ?domain=religion
 *
 * Sections:
 *   1. TOP DIRECTIVE
 *   2. SOURCE INTELLIGENCE block (inside anchor)
 *   3. DEEP INTELLIGENCE expandable
 *   4. DEEP PROOF — FRACTAL INTELLIGENCE block
 *   5. DRILL DEEPER / LOAD BRANCH
 *   6. TOP MONEY PLAYS
 *   7. ACTION QUEUE
 *   8. BUSINESS REVIEW (mounts religion-business-review.js)
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'religion' && _dom !== 'religion') return;

  var VIEW_ID = 'sos-operator-view';
  var STATUS_KEY = 'limen_religion_operator_status';
  var COLLAPSE_KEY = 'limen_religion_collapse_state';
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
    var brain = brains.get('religion');
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

  // ── RELIGION-NATIVE LANGUAGE ──

  var DX_CONTEXT = {
    'SECTARIAN_CONFLICT': {
      what: 'Sectarian violence between religious communities is active or escalating \u2014 Sunni-Shia friction across Iraq, Syria, Yemen, and Bahrain; Hindu-Muslim tensions in India (Gujarat, Manipur, CAA/NRC protests); Christian-Muslim clashes in Nigeria (Kaduna, Jos Plateau), Central African Republic, and Burkina Faso; Buddhist-Muslim violence in Myanmar (Rohingya) and Sri Lanka; Jewish-Arab friction in Israel/Palestine. Diaspora funding networks amplify local conflicts. $50B+ in annual defense and homeland security spending is directly linked to sectarian fault lines. Proxy wars (Iran-Saudi, India-Pakistan) often run along sectarian boundaries.',
      money: 'Defense contractors serving conflict zones (Lockheed Martin, Raytheon, Northrop Grumman), CVE/counter-terrorism consultancies (Booz Allen, Leidos, CACI), law enforcement technology (Axon, Motorola Solutions), cyber-intelligence platforms (Palantir, Palo Alto Networks, CrowdStrike), and political risk insurers all see demand during sectarian escalation. Foundation grants from USIP, National Endowment for Democracy, and Templeton Foundation fund peacebuilding programs.',
      step: 'Track USCIRF Annual Report, Pew Research Center restrictions indices, ACLED religious violence event data, Open Doors World Watch List, and International Crisis Group reports. Monitor defense budget allocations tied to Middle East, South Asia, and Sahel operations. Position in defense services, CVE consulting, and peacebuilding grant work.',
      outcome: '$10M-$1B+ defense contracts, CVE program funding, peacebuilding grants, and religious freedom legal engagements'
    },
    'INSTITUTIONAL_ABUSE': {
      what: 'Institutional abuse scandals within religious organizations are breaking \u2014 Catholic Church sexual abuse settlements exceed $4B in the U.S. alone (dioceses in Los Angeles, New York, Chicago filing for bankruptcy protection). Southern Baptist Convention sexual abuse crisis (Guidepost Solutions report 2022). Jehovah\u2019s Witnesses child abuse cover-up findings (Australian Royal Commission). Mormon church $100B+ investment fund scandal (Ensign Peak Advisors SEC fine). Anglican Church safeguarding failures (IICSA UK report). Cover-up patterns are institutional and cross-denominational, driving mass disaffiliation and trust collapse.',
      money: 'Forensic accounting firms (FTI Consulting, Kroll), plaintiff law firms (Jeff Anderson & Associates, Pfau Cochran Vertetis Amala), institutional governance consultancies, crisis communications firms, insurance companies facing claims (Chubb, Lloyd\u2019s syndicates), and victim advocacy organizations all see surge demand. Bankruptcy restructuring advisory surges as dioceses and denominations file.',
      step: 'Track diocesan bankruptcy filings (PACER), state attorney general investigations, SNAP (Survivors Network) press releases, Guidepost Solutions and similar third-party investigation reports, and denominational annual meeting resolutions. Position in legal services, forensic investigation, crisis communications, and institutional restructuring advisory.',
      outcome: '$50M-$500M+ abuse settlement administration, institutional restructuring contracts, and crisis governance consulting engagements'
    },
    'RADICALIZATION': {
      what: 'Online and offline radicalization pipelines are active across multiple religious traditions \u2014 ISIS and al-Qaeda online recruitment (Telegram, encrypted platforms), Hindu nationalist violence (RSS/VHP mobilization, cow vigilantism, demolition campaigns), Christian nationalist movements (January 6 overlap, militia-church fusion, dominionist networks), white supremacist religious framing (Christchurch, Buffalo, El Paso manifestos citing religious themes), and ultra-Orthodox Jewish extremism (price tag attacks, settler violence). DHS Countering Violent Extremism (CVE) programs fund deradicalization and prevention. FBI domestic terrorism investigations have tripled since 2017.',
      money: 'CVE program contractors (Booz Allen, CACI, Leidos), social media monitoring platforms (Palantir, Babel Street), cybersecurity firms tracking extremist infrastructure (CrowdStrike, Palo Alto Networks, SentinelOne), deradicalization program operators, and think tanks (RAND, Brookings, George Washington Program on Extremism) all see sustained funding. DHS TVTP grants, State Department CT bureau, and DOJ Community Relations Service fund prevention.',
      step: 'Track DHS TVTP grant awards, FBI Uniform Crime Report hate crimes data, ADL hate incident tracker, SPLC hate group map, Europol TE-SAT annual report, and UN CTED assessments. Monitor social media platform transparency reports for extremist content removal. Position in CVE consulting, content moderation technology, and counter-extremism research.',
      outcome: '$10M-$500M+ CVE contracts, counter-terrorism technology deployments, and deradicalization program grants'
    },
    'SECULARIZATION_CRISIS': {
      what: 'Church attendance has collapsed 40%+ in the U.S. over 30 years (Gallup: 70% membership 1999, 47% 2023). Europe is post-Christian by most measures \u2014 UK church attendance under 5%, Scandinavia under 3%. "Nones" (religiously unaffiliated) are the fastest-growing religious identity in every Western democracy. 4,000+ U.S. churches close annually (Lifeway Research). Mainline Protestant denominations are losing 1M+ members per year. Real estate portfolios of closing churches represent billions in stranded assets. Endowment drawdowns accelerate as membership revenue collapses. Seminaries are closing or consolidating (United Methodist seminaries, Catholic seminaries at 50% of 1965 enrollment). The institutional infrastructure of organized religion is contracting structurally.',
      money: 'Religious real estate disposition (church-to-residential/commercial conversion), endowment management and restructuring, church management SaaS (Planning Center, Pushpay, Tithe.ly), virtual worship technology (Zoom, streaming platforms), pilgrimage and religious tourism operators (Hajj, Camino, Vatican, Jerusalem), and faith-based senior living operators all see demand shifts. Megachurch production technology (Live Nation, AV integrators) captures the consolidation winners.',
      step: 'Track Pew Religious Landscape Study updates, Barna Group church health research, ARDA congregation data, Lifeway Research church closure reports, seminary enrollment data (ATS), and denominational annual reports (UMC, PCUSA, ELCA, SBC). Monitor real estate listings for church properties and endowment fund SEC filings.',
      outcome: '$100M-$5B+ in real estate disposition, endowment restructuring, church technology adoption, and institutional consolidation advisory'
    },
    'THEOLOGICAL_SCHISM': {
      what: 'Major denominations are fracturing along doctrinal and cultural lines \u2014 the Anglican Communion split over same-sex marriage (GAFCON vs. Canterbury), the United Methodist Church global split (2023-2024, 7,600+ churches disaffiliated), Orthodox autocephaly disputes (Moscow-Constantinople break over Ukraine), Reform-Orthodox Judaism tensions (Israeli rabbinate vs. diaspora movements, Western Wall access disputes), and evangelical realignment over Trump-era politics. Property battles over church buildings, mission agency splits, pension fund divisions, and denominational publishing house control create massive legal and financial complexity.',
      money: 'Denominational property litigation (church building ownership fights worth $100M+ per denomination), pension fund division advisory, mission agency restructuring, denominational media splits, and church planting investment from breakaway movements. Alliance Defending Freedom, Becket Fund, and denominational legal teams handle the litigation. Insurance carriers (Church Mutual, Brotherhood Mutual, GuideOne) face coverage disputes.',
      step: 'Track United Methodist disaffiliation vote counts, Anglican Communion Primates Meeting outcomes, Orthodox synod declarations, denominational annual meeting resolutions, and church property litigation dockets. Monitor pension fund actuarial reports and mission agency financial statements.',
      outcome: '$50M-$1B+ property litigation, pension restructuring, and institutional realignment consulting'
    }
  };

  var PATH_LABELS = { 'PATENTABLE': 'PATENT', 'GRANT-ELIGIBLE': 'GRANT', 'INVESTABLE': 'INVEST' };
  var PATH_CLASS = { 'PATENTABLE': 'eos-path-patent', 'GRANT-ELIGIBLE': 'eos-path-grant', 'INVESTABLE': 'eos-path-invest' };
  function pathLabel(p) { return PATH_LABELS[p] || p; }
  function pathClass(p) { return PATH_CLASS[p] || ''; }
  function oppKey(opp) { return (opp.title || '').substring(0, 60).replace(/[^a-zA-Z0-9]/g, '_'); }

  var DX_TO_PLAYBOOK = {
    'SECTARIAN_CONFLICT':    'rel_conflict',
    'INSTITUTIONAL_ABUSE':   'rel_governance',
    'RADICALIZATION':        'rel_security',
    'SECULARIZATION_CRISIS': 'rel_transition',
    'THEOLOGICAL_SCHISM':    'rel_governance'
  };

  var INVEST_TARGETS = {
    'rel_conflict': [
      { ticker: 'LMT',  name: 'Lockheed Martin',                  cik: '936468',  validation: 'HELIX_VALIDATED', reason: 'Largest defense contractor globally; F-35, missile defense, and ISR platforms deployed to every sectarian conflict zone \u2014 Middle East, South Asia, Sahel. Sectarian escalation directly drives weapons procurement cycles.' },
      { ticker: 'RTX',  name: 'RTX Corporation (Raytheon)',        cik: '101829',  validation: 'HELIX_VALIDATED', reason: 'Patriot missile systems, Javelin ATGMs, and precision-guided munitions consumed in Yemen, Syria, and Ukraine; sectarian proxy wars are RTX revenue drivers.' },
      { ticker: 'NOC',  name: 'Northrop Grumman',                 cik: '1133421', validation: 'HELIX_VALIDATED', reason: 'B-21 bomber, Global Hawk UAV, and space-based ISR systems support operations in sectarian conflict theaters; nuclear deterrence posture intersects with religious-state tensions (Pakistan, Israel, Iran).' },
      { ticker: 'BAH',  name: 'Booz Allen Hamilton',              cik: '1443669', validation: 'HELIX_VALIDATED', reason: 'Largest CVE/counter-terrorism consultancy for U.S. government; DHS Countering Violent Extremism programs, FBI domestic terrorism analytics, and USAID conflict prevention work all address religious radicalization.' },
      { ticker: 'LDOS', name: 'Leidos Holdings',                  cik: '1336920', validation: 'HELIX_VALIDATED', reason: 'Counter-terrorism IT services for DHS, DOD, and intelligence community; biometric identity systems, surveillance analytics, and CT data platforms deployed against sectarian threat networks.' },
      { ticker: 'CACI', name: 'CACI International',               cik: '17843',   validation: 'HELIX_VALIDATED', reason: 'Intelligence community and DOD counter-terrorism services; SIGINT, HUMINT support, and CT analytics used against ISIS, al-Qaeda, and sectarian militia networks.' },
      { ticker: 'AXON', name: 'Axon Enterprise',                  cik: '1069183', validation: 'DOMAIN_MAPPED',   reason: 'Law enforcement technology (body cameras, Tasers, digital evidence management) deployed by police forces managing sectarian violence, hate crimes, and religious community protection.' },
      { ticker: 'MSI',  name: 'Motorola Solutions',               cik: '68505',   validation: 'DOMAIN_MAPPED',   reason: 'Public safety communications infrastructure; radio systems, dispatch platforms, and video security used by police managing sectarian incidents, religious site protection, and mass gathering security.' },
      { ticker: 'PANW', name: 'Palo Alto Networks',               cik: '1327567', validation: 'HELIX_VALIDATED', reason: 'Cybersecurity platforms protecting critical infrastructure in sectarian conflict zones; cyber-CT operations against religiously-motivated threat actors (Charming Kitten, APT groups).' },
      { ticker: 'PLTR', name: 'Palantir Technologies',            cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'Gotham platform used by DOD and intelligence community for counter-terrorism targeting; Palantir maps sectarian militia networks, diaspora funding flows, and arms trafficking routes.' },
      { ticker: 'PSN',  name: 'Parsons Corporation',              cik: '1601712', validation: 'DOMAIN_MAPPED',   reason: 'Border security, missile defense, and critical infrastructure protection engineering; serves DHS and DOD in regions where sectarian conflict drives security infrastructure investment.' },
      { ticker: 'HACK', name: 'ETFMG Prime Cyber Security ETF',   cik: null,      validation: 'ETF_PROXY',       reason: 'Broad cybersecurity exposure proxy; sectarian conflict increasingly includes cyber operations (Iran-Israel, India-Pakistan) driving demand across the cyber defense sector.' }
    ],
    'rel_governance': [
      { ticker: 'DIS',  name: 'Walt Disney Company',              cik: '1744489', validation: 'DOMAIN_MAPPED',   reason: 'Faith-based content production through Disney+, National Geographic religious documentaries, and ABC News religion coverage; institutional trust and religious narrative shaping at global scale.' },
      { ticker: 'CMCSA',name: 'Comcast (NBCUniversal)',            cik: '1166691', validation: 'DOMAIN_MAPPED',   reason: 'NBC/MSNBC religion and culture coverage, Peacock streaming religious content, and Sky News religion reporting; media infrastructure that shapes institutional religious narratives.' },
      { ticker: 'NFLX', name: 'Netflix',                          cik: '1065280', validation: 'DOMAIN_MAPPED',   reason: 'Religious content investment (The Two Popes, Messiah, Midnight Mass); Netflix originals exploring institutional abuse, cult dynamics, and religious power generate subscriber engagement and cultural impact.' },
      { ticker: 'SPOT', name: 'Spotify Technology',               cik: '1639920', validation: 'DOMAIN_MAPPED',   reason: 'Religious podcast ecosystem (The Bible in a Year, Church Clarity); Spotify is the largest platform for religious audio content, sermons, and faith-based commentary.' },
      { ticker: 'GOOGL',name: 'Alphabet (Google/YouTube)',         cik: '1652044', validation: 'HELIX_VALIDATED', reason: 'YouTube is the largest platform for religious content globally \u2014 sermons, worship music, religious education, and interfaith dialogue. Google Search shapes religious information access for billions.' },
      { ticker: 'META', name: 'Meta Platforms',                   cik: '1326801', validation: 'HELIX_VALIDATED', reason: 'Facebook/Instagram host the largest religious community groups globally; church communication, religious event organizing, and faith-based fundraising run on Meta platforms. WhatsApp carries religious content in Global South.' },
      { ticker: 'WIX',  name: 'Wix.com',                          cik: '1576789', validation: 'DOMAIN_MAPPED',   reason: 'Website builder used by thousands of churches, mosques, and synagogues; Wix templates for religious organizations are a significant vertical serving institutional digital presence.' },
      { ticker: 'SQSP', name: 'Squarespace',                      cik: '1496963', validation: 'DOMAIN_MAPPED',   reason: 'Premium website platform for religious organizations, megachurches, and faith-based nonprofits; church web presence is a growing digital infrastructure requirement.' },
      { ticker: 'CCOI', name: 'Cogent Communications',            cik: '1158324', validation: 'DOMAIN_MAPPED',   reason: 'Internet backbone infrastructure provider; carries the bandwidth for religious streaming, virtual worship, and faith-based content delivery globally.' },
      { ticker: 'RBLX', name: 'Roblox',                           cik: '1315098', validation: 'DOMAIN_MAPPED',   reason: 'Virtual world platform experimenting with religious education, virtual church spaces, and faith community engagement for younger demographics; emerging frontier for religious institutional reach.' },
      { ticker: 'ZM',   name: 'Zoom Video Communications',        cik: '1585521', validation: 'DOMAIN_MAPPED',   reason: 'Virtual worship infrastructure adopted by 100K+ congregations during COVID and retained post-pandemic; Zoom is now permanent infrastructure for religious community engagement, Bible study, and pastoral care.' },
      { ticker: 'MSFT', name: 'Microsoft',                        cik: '789019',  validation: 'HELIX_VALIDATED', reason: 'Microsoft 365 and Teams used by denominations, dioceses, and religious nonprofits for institutional management; Azure hosts church management SaaS platforms (Planning Center, Pushpay).' }
    ],
    'rel_security': [
      { ticker: 'CRWD', name: 'CrowdStrike Holdings',             cik: '1535527', validation: 'HELIX_VALIDATED', reason: 'Endpoint protection and threat intelligence tracking extremist cyber infrastructure; CrowdStrike Falcon identifies religiously-motivated threat actors and tracks their digital operational security.' },
      { ticker: 'PANW', name: 'Palo Alto Networks',               cik: '1327567', validation: 'HELIX_VALIDATED', reason: 'Next-generation firewall and cloud security protecting government CT infrastructure; Palo Alto Unit 42 tracks extremist cyber operations and religious-state threat actors.' },
      { ticker: 'BAH',  name: 'Booz Allen Hamilton',              cik: '1443669', validation: 'HELIX_VALIDATED', reason: 'CVE program prime contractor; runs DHS TVTP grantee technical assistance, FBI domestic terrorism analytics, and State Department CT bureau consulting.' },
      { ticker: 'LDOS', name: 'Leidos Holdings',                  cik: '1336920', validation: 'HELIX_VALIDATED', reason: 'Intelligence community CT analytics; biometric identity systems, watchlist management, and threat assessment platforms used to track radicalized individuals.' },
      { ticker: 'CACI', name: 'CACI International',               cik: '17843',   validation: 'HELIX_VALIDATED', reason: 'SIGINT and HUMINT support for CT operations; CACI provides intelligence analysis services tracking religious extremist networks for DOD and IC customers.' },
      { ticker: 'SAIC', name: 'Science Applications International',cik: '1571123', validation: 'HELIX_VALIDATED', reason: 'Federal IT services for DHS and DOJ counter-terrorism programs; system integration for terrorist screening databases and CT case management.' },
      { ticker: 'LHX',  name: 'L3Harris Technologies',            cik: '202058',  validation: 'HELIX_VALIDATED', reason: 'ISR platforms, tactical communications, and surveillance systems deployed to monitor extremist activity; Harris night vision and L3 SIGINT equipment used in CT operations globally.' },
      { ticker: 'FTNT', name: 'Fortinet',                         cik: '1262039', validation: 'DOMAIN_MAPPED',   reason: 'Network security appliances protecting government and critical infrastructure from cyber attacks by religiously-motivated threat actors; Fortinet secures many federal civilian and DOD networks.' },
      { ticker: 'S',    name: 'SentinelOne',                      cik: '1508524', validation: 'DOMAIN_MAPPED',   reason: 'AI-powered endpoint security detecting extremist malware and cyber operations; SentinelOne\u2019s autonomous response capabilities serve federal CT and CI protection.' },
      { ticker: 'PLTR', name: 'Palantir Technologies',            cik: '1321655', validation: 'HELIX_VALIDATED', reason: 'Gotham and Apollo platforms used by IC and DOD for CT targeting, radicalization network mapping, and extremist financing tracking; Palantir is the data integration layer for federal CT operations.' },
      { ticker: 'ZS',   name: 'Zscaler',                          cik: '1713683', validation: 'DOMAIN_MAPPED',   reason: 'Zero-trust cloud security platform protecting federal agencies from cyber threats; government CT and CI networks increasingly adopt Zscaler for secure internet access.' },
      { ticker: 'CIBR', name: 'First Trust NASDAQ Cybersecurity ETF', cik: null,  validation: 'ETF_PROXY',       reason: 'Broad cybersecurity sector proxy; religious extremist cyber operations drive sustained demand across the federal cybersecurity vendor ecosystem.' }
    ],
    'rel_transition': [
      { ticker: 'SPG',  name: 'Simon Property Group',             cik: '1063761', validation: 'DOMAIN_MAPPED',   reason: 'Largest U.S. REIT with expertise in commercial property repositioning; church-to-retail/mixed-use conversion projects represent a growing pipeline as 4,000+ churches close annually.' },
      { ticker: 'PLD',  name: 'Prologis',                         cik: '1045609', validation: 'HELIX_VALIDATED', reason: 'Logistics REIT acquiring and converting former religious institutional properties in urban areas; church closures create warehouse and last-mile distribution conversion opportunities.' },
      { ticker: 'O',    name: 'Realty Income',                    cik: '726728',  validation: 'DOMAIN_MAPPED',   reason: 'Triple-net lease REIT; acquires former church properties for commercial tenants. Religious property disposition creates a steady pipeline of well-located, community-zoned real estate.' },
      { ticker: 'WELL', name: 'Welltower',                        cik: '766704',  validation: 'DOMAIN_MAPPED',   reason: 'Healthcare REIT with senior living portfolio; faith-based senior living operators (Presbyterian Homes, Lutheran Services, Catholic Health) are Welltower tenants and acquisition targets as religious institutions restructure.' },
      { ticker: 'VTR',  name: 'Ventas',                           cik: '740260',  validation: 'DOMAIN_MAPPED',   reason: 'Senior living and healthcare REIT; acquires and operates properties from faith-based healthcare systems (Mercy Health, Ascension, Providence) undergoing institutional transition.' },
      { ticker: 'AMT',  name: 'American Tower',                   cik: '1053507', validation: 'HELIX_VALIDATED', reason: 'Cell tower operator with steeple-lease programs; American Tower and competitors lease church steeples for wireless antenna placement, creating revenue for declining congregations and infrastructure for carriers.' },
      { ticker: 'CCI',  name: 'Crown Castle International',       cik: '1051470', validation: 'HELIX_VALIDATED', reason: 'Small-cell and fiber operator; Crown Castle deploys small cells on religious building exteriors and rooftops, creating lease revenue streams for financially stressed congregations.' },
      { ticker: 'DLR',  name: 'Digital Realty Trust',              cik: '1365135', validation: 'DOMAIN_MAPPED',   reason: 'Data center REIT; religious institutional digital transformation (streaming worship, cloud church management) drives demand for the data center infrastructure that hosts these platforms.' },
      { ticker: 'EQIX', name: 'Equinix',                          cik: '1101239', validation: 'HELIX_VALIDATED', reason: 'Global interconnection and data center platform; hosts the cloud infrastructure for church management SaaS (Planning Center, Pushpay, Tithe.ly), religious streaming, and faith-based content delivery.' },
      { ticker: 'BKNG', name: 'Booking Holdings',                 cik: '1075531', validation: 'DOMAIN_MAPPED',   reason: 'Largest online travel platform; religious pilgrimage and tourism (Hajj, Camino de Santiago, Vatican, Jerusalem, Varanasi) represent a growing vertical. Booking.com lists pilgrimage accommodations globally.' },
      { ticker: 'ABNB', name: 'Airbnb',                           cik: '1559720', validation: 'DOMAIN_MAPPED',   reason: 'Short-term rental platform used for faith retreat hosting, pilgrimage accommodation, and religious conference housing; Airbnb Experiences include religious tourism offerings.' },
      { ticker: 'EXPE', name: 'Expedia Group',                    cik: '1324424', validation: 'DOMAIN_MAPPED',   reason: 'Travel platform serving religious tourism and pilgrimage markets; Expedia packages for Holy Land tours, Hajj travel, and faith-based group travel.' },
      { ticker: 'LYV',  name: 'Live Nation Entertainment',        cik: '1335258', validation: 'DOMAIN_MAPPED',   reason: 'Live events and venue technology used by megachurches and large-scale religious events; Hillsong, Passion Conference, and similar events use Live Nation production and ticketing infrastructure.' },
      { ticker: 'MSGS', name: 'Madison Square Garden Sports',     cik: '1636023', validation: 'DOMAIN_MAPPED',   reason: 'Arena and venue operations model applicable to megachurch real estate; large religious venue management, production technology, and event operations parallel MSG\u2019s core competencies.' }
    ]
  };

  var PLAYBOOK_DEFS = {
    'rel_conflict': { title: 'Sectarian Conflict & Security', domains: ['religion', 'defense'], type: 'invest' },
    'rel_governance': { title: 'Religious Governance & Compliance', domains: ['religion', 'governance'], type: 'invest' },
    'rel_security': { title: 'Radicalization & Counter-Extremism', domains: ['religion', 'intelligence'], type: 'invest' },
    'rel_transition': { title: 'Secularization & Cultural Transition', domains: ['religion', 'culture'], type: 'invest' }
  };

  function resolvePlaybookId(opp) {
    if (opp.diagnosisId && DX_TO_PLAYBOOK[opp.diagnosisId]) return DX_TO_PLAYBOOK[opp.diagnosisId];
    return 'rel_conflict';
  }

  // ── MECHANISM EXPLANATIONS ──

  var MECH_EXPLAIN = {
    'SECTARIAN_CONFLICT': {
      'sectarian_escalation':      { why: 'Sectarian escalation follows a predictable pattern: political entrepreneurs instrumentalize religious identity, media amplifies grievance narratives, diaspora funding flows accelerate, and security forces either fail to protect or actively participate. The Sunni-Shia fault line alone drives $50B+ in annual defense spending across the Middle East. Hindu-Muslim violence in India, Christian-Muslim clashes in Nigeria, and Buddhist-Muslim persecution in Myanmar each generate their own conflict economies. ACLED data shows religious identity is cited in 25%+ of political violence events in South Asia and the Sahel.', move: 'Position in defense contractors serving conflict zones (Lockheed Martin LMT, RTX, Northrop Grumman NOC), CVE consultancies (Booz Allen BAH, Leidos LDOS), and peacebuilding organizations (USIP, Search for Common Ground, International Crisis Group). Track USCIRF reports and ACLED event data for escalation signals.' },
      'identity_hardening':        { why: 'Identity hardening is the process by which religious identity becomes the dominant political identity, crowding out civic, ethnic, or class identities. Observable in BJP India (Hindutva), Erdogan Turkey (neo-Ottoman), Israeli settler movement, and European anti-Muslim populism. When identity hardens, compromise space collapses and political systems polarize along religious lines. Diaspora communities amplify home-country identity politics through social media and funding networks. The result is a permanently elevated conflict baseline that sustains defense and security spending.', move: 'Position in political risk consultancies (Eurasia Group, Control Risks), social media monitoring platforms (Palantir PLTR, Babel Street), and religious freedom legal defense (Becket Fund, Alliance Defending Freedom). Track Pew restrictions indices and social media platform extremist content reports.' },
      'grievance_amplification':   { why: 'Grievance amplification operates through social media algorithms that preferentially surface outrage content, diaspora funding that rewards confrontation over compromise, and political leaders who profit from religious polarization. Facebook/Meta internal research (Frances Haugen disclosures) showed that religious content receives disproportionate engagement when it is inflammatory. Al Jazeera, TRT, and state-aligned media in India, Israel, and Iran each amplify sectarian narratives to their respective audiences. Grievance amplification converts local incidents into regional crises within hours.', move: 'Position in content moderation technology (Alphabet GOOGL, Meta META), counter-narrative programming (ISD, Moonshot CVE), and media monitoring (Recorded Future, Babel Street). Track social media platform transparency reports for religious content moderation actions.' },
      'inter_communal_violence':   { why: 'Inter-communal violence is the kinetic expression of sectarian escalation \u2014 mob violence, arson, pogroms, riots, and targeted killings. Jos Plateau (Nigeria) has experienced 50+ mass violence events since 2000. Gujarat (India) 2002 saw 1,000+ killed. Myanmar anti-Rohingya violence displaced 700K+. Each episode triggers insurance claims, property destruction, displacement, security spending, and long-term economic depression in affected areas. International Crisis Group, Human Rights Watch, and Amnesty International document these patterns systematically.', move: 'Position in physical security (Axon AXON, Motorola Solutions MSI), insurance (Chubb CB, Zurich), post-conflict reconstruction, and humanitarian response organizations. Track ACLED violence event data, HRW/Amnesty reports, and insurance claims patterns in conflict zones.' }
    },
    'INSTITUTIONAL_ABUSE': {
      'scandal_exposure':          { why: 'Institutional abuse scandals follow a pattern: victims organize (SNAP, BishopAccountability.org), journalists investigate (Boston Globe Spotlight, AP), prosecutors act (Pennsylvania Grand Jury, Australian Royal Commission), and settlements flow. Catholic abuse settlements: $4B+ in U.S. alone, with LA Archdiocese paying $880M (2024). Southern Baptist Convention Guidepost Solutions report (2022) documented decades of cover-up. Each exposure triggers more victims to come forward, creating a cascade that can bankrupt dioceses (27+ U.S. dioceses in bankruptcy). Forensic accounting firms, plaintiff lawyers, and crisis communications firms see sustained multi-year demand.', move: 'Position in forensic investigation (FTI Consulting FCN, Kroll), plaintiff law (Jeff Anderson & Associates, Pfau Cochran), and institutional governance consulting. Track diocesan bankruptcy filings, state AG investigations, and denominational annual meeting abuse-response resolutions.' },
      'trust_collapse':            { why: 'Trust collapse is the downstream effect of scandal exposure \u2014 when congregants lose faith not in God but in the institution. Gallup shows confidence in organized religion dropped from 68% (1975) to 31% (2023) in the U.S. Barna Group documents that 44% of young adults cite hypocrisy as their reason for leaving church. Trust collapse drives disaffiliation, donation decline, and institutional restructuring. The financial impact compounds: fewer donors, smaller budgets, deferred maintenance, staff cuts, and accelerating decline. Denominational pension funds face actuarial stress as the contribution base shrinks.', move: 'Position in institutional reputation recovery, donor management platforms (Blackbaud, Classy), and church restructuring advisory. Track Gallup institutional confidence surveys, Barna Group trust research, and denominational giving reports.' },
      'authority_erosion':         { why: 'Authority erosion occurs when religious leaders lose the moral standing to speak on behalf of their institutions. The Catholic hierarchy\u2019s credibility on sexual ethics collapsed after the abuse revelations. Southern Baptist Convention leadership faced mass resignations. Megachurch pastors (Mars Hill, Hillsong, Harvest Bible Chapel) fell to scandals that destroyed multi-campus empires. When authority erodes, institutional governance becomes contested, schisms accelerate, and financial oversight weakens \u2014 creating further vulnerability to abuse and mismanagement.', move: 'Position in crisis communications (FGS Global, Brunswick, Edelman), institutional governance consulting, and denominational leadership transition services. Track major denominational leadership elections, pastoral firing/resignation patterns, and congregational split rates.' },
      'accountability_failure':    { why: 'Accountability failure is the systemic condition that enables abuse \u2014 insufficient background checks, no independent reporting channels, internal investigations controlled by accused parties, and legal strategies that prioritize institutional protection over victim safety. The pattern is cross-denominational: Catholic, Southern Baptist, Jehovah\u2019s Witnesses, Mormon, Anglican, and independent megachurches have all exhibited identical accountability failures. Insurance carriers (Church Mutual, Brotherhood Mutual, GuideOne) now require specific abuse prevention protocols as conditions of coverage, creating a compliance market.', move: 'Position in compliance and governance platforms, background check services (Sterling, HireRight), institutional insurance (Church Mutual, Brotherhood Mutual, GuideOne), and independent investigation firms (Guidepost Solutions, Praesidium). Track insurance carrier abuse-prevention requirements and denominational safeguarding policy updates.' }
    },
    'RADICALIZATION': {
      'extremist_capture':         { why: 'Extremist capture occurs when radical factions gain control of religious institutions, converting them into recruitment and funding vehicles. ISIS captured mosques across Iraq and Syria to run governance and recruitment. Hindu nationalist RSS operates 60,000+ shakhas that integrate religious practice with political mobilization. Christian nationalist churches in the U.S. have become political organizing nodes (Patriot Churches, FlashPoint). Ultra-Orthodox settler organizations in Israel operate as both religious institutions and land-seizure networks. Each captured institution generates a revenue stream (donations, government subsidies, real estate) that funds further radicalization.', move: 'Position in CVE program consulting (Booz Allen BAH, CACI), deradicalization program operation, and social media extremist network mapping (Palantir PLTR, CrowdStrike CRWD). Track DHS TVTP grant awards, FBI domestic terrorism arrests, and Europol TE-SAT extremist group designations.' },
      'polarizing_rhetoric':       { why: 'Polarizing religious rhetoric \u2014 sermons, social media content, broadcasting, and publishing \u2014 is the primary driver of radicalization pipeline intake. TBN, Daystar, and independent YouTube channels reach millions with content that ranges from traditional to inflammatory. Islamic extremist content on Telegram and encrypted platforms reaches vulnerable populations globally. Hindu nationalist content on WhatsApp and YouTube generates billions of views. The content moderation challenge is enormous: platforms must distinguish between protected religious expression and incitement to violence, with billions of posts daily.', move: 'Position in content moderation technology (Alphabet GOOGL YouTube policy, Meta META), counter-narrative programming, and media monitoring platforms. Track platform transparency reports, SPLC hate group designation changes, and ADL hate incident data.' },
      'radicalization_pipeline':   { why: 'Radicalization pipelines have been mapped extensively by researchers (RAND, George Washington Program on Extremism, VOX-Pol). The pattern: initial grievance exposure (social media algorithms), community validation (online forums, local groups), identity solidification (in-group/out-group framing), and operational preparation (encrypted communications, training materials). Online radicalization timelines have compressed from years to months. The Christchurch, Buffalo, El Paso, and Halle attackers all followed documented pipeline patterns with religious or quasi-religious ideological components. CVE programs attempt to intervene at each stage.', move: 'Position in CVE technology (content moderation AI, social media monitoring), intervention program operators, and counter-terrorism consulting (Booz Allen BAH, Leidos LDOS, SAIC). Track FBI domestic terrorism case filings, DHS CVE program evaluations, and academic radicalization research output.' },
      'identity_hardening':        { why: 'In the radicalization context, identity hardening is the process by which a person\u2019s religious identity becomes totalizing \u2014 all other identities (citizen, neighbor, colleague) are subordinated. Observable in ISIS foreign fighters who abandoned families, Hindu nationalist lynching participants, and Christian militia members who view secular institutions as enemies. Identity hardening is measurable through language analysis (increased us/them framing, dehumanizing terminology) and behavioral signals (social network contraction, information diet narrowing).', move: 'Position in behavioral analytics (Palantir PLTR, Babel Street), deradicalization counseling services, and academic research programs (Templeton Foundation, USIP grants). Track deradicalization program outcome data and recidivism rates.' }
    },
    'SECULARIZATION_CRISIS': {
      'attendance_contraction':    { why: 'Church attendance in the U.S. has dropped from 70%+ weekly (1960s) to under 30% (Gallup 2023). Mainline Protestant denominations lose 1M+ members annually (PCUSA, ELCA, UMC, Disciples, Episcopal). European attendance is single digits in most countries. 4,000+ U.S. churches close each year (Lifeway Research), while only 3,000 open. The math is structural: aging congregations + youth disengagement + cultural secularization = accelerating contraction. Church closure creates stranded real estate, unemployed clergy, and orphaned community programs. Hartford Institute for Religion Research tracks these dynamics at the congregational level.', move: 'Position in church real estate disposition (Simon Property SPG, Realty Income O), church management technology (Planning Center, Pushpay, Tithe.ly), virtual worship platforms (Zoom ZM), and megachurch consolidation services. Track Lifeway Research church closure data, Hartford Institute congregation studies, and ARDA membership statistics.' },
      'youth_disengagement':       { why: 'Young adults (18-30) are leaving organized religion at historically unprecedented rates. Pew Research: 36% of Millennials are religiously unaffiliated, vs. 17% of Boomers at the same age. Generation Z is even less religious. Barna Group documents that 64% of young adults who grew up in church have disengaged. The primary drivers cited: perceived hypocrisy (44%), conflict with science (25%), negative experiences with LGBT+ community (22%), and irrelevance to daily life. Youth disengagement is a leading indicator of 20-30 year institutional decline \u2014 today\u2019s youth non-participation predicts tomorrow\u2019s empty pews and unfunded budgets.', move: 'Position in digital ministry platforms (YouVersion, Faithlife), social media content creation tools (Canva, Adobe), and youth engagement technology. Track Pew generational religion surveys, Barna Group youth research, and seminary enrollment trends (ATS data).' },
      'membership_decline':        { why: 'Formal membership decline is steeper than attendance decline because members leave years before they stop attending \u2014 they disengage from governance, stop tithing, and withdraw from volunteer roles while still occasionally appearing in pews. Southern Baptist Convention lost 1.3M members (2022-2023). United Methodist Church lost 7,600+ congregations to disaffiliation (2023-2024). Roman Catholic Church: 6.5M U.S. adults left in the last decade. Each lost member represents $1,500-$3,000 in annual giving, compounding into tens of millions per denomination per year.', move: 'Position in donor retention platforms (Blackbaud BLKB, Classy/GoFundMe), church engagement analytics, and denominational restructuring advisory. Track SBC annual meeting statistics, UMC disaffiliation counts, USCCB Catholic giving reports, and NCS (National Congregations Study) findings.' },
      'declining_legitimacy':      { why: 'Religious institutions are losing their legitimacy as moral authorities in public discourse. Gallup institutional confidence in organized religion: 31% (2023), down from 68% (1975). Clergy are no longer among the most trusted professions (Gallup: nurses #1, clergy #8). The abuse scandals, political polarization, financial mismanagement, and perceived hypocrisy have eroded the social license that religious institutions historically held. Loss of legitimacy translates into reduced political influence, tax exemption challenges, zoning opposition to new facilities, and difficulty recruiting clergy.', move: 'Position in institutional reputation research (Gallup, Edelman Trust Barometer), public affairs consulting, and religious freedom legal defense (Becket Fund, Alliance Defending Freedom). Track Gallup confidence surveys, Pew favorability polls, and legislative activity around religious tax exemption reform.' }
    },
    'THEOLOGICAL_SCHISM': {
      'doctrinal_conflict':        { why: 'Doctrinal conflict over sexuality, gender, biblical authority, and social ethics is fracturing major denominations. The Anglican Communion\u2019s GAFCON movement (representing 85% of global Anglicans) has effectively separated from Canterbury over same-sex marriage. United Methodist Church split: 7,600+ conservative congregations disaffiliated (2023-2024) over LGBT+ clergy and marriage. Presbyterian Church (USA) lost 500+ congregations to ECO and EPC over similar issues. Reform-Orthodox Judaism tensions over patrilineal descent, women\u2019s ordination, and Israel\u2019s rabbinate monopoly create permanent institutional friction. Each doctrinal dispute generates legal, financial, and organizational complexity.', move: 'Position in denominational property litigation (church building ownership fights, trust clause enforcement), pension division advisory, and institutional restructuring consulting. Track denominational annual meeting vote tallies, property litigation dockets, and new denomination formation announcements.' },
      'denominational_splintering': { why: 'Denominational splintering creates new institutional entities that require separate governance, financial, legal, and operational infrastructure. The Global Methodist Church (formed from UMC split) must build a new denominational structure from scratch: pension system, publishing house, mission agencies, seminary relationships, and legal entity. ACNA (Anglican Church in North America) separated from the Episcopal Church and spent a decade building parallel institutions. Each split creates demand for legal services, financial advisory, institutional design consulting, and technology platform migration. Splintering also creates competition for members, donors, and clergy between the parent and splinter bodies.', move: 'Position in church planting services (ARC, Stadia, SEND Network), denominational startup consulting, and institutional financial planning. Track new denomination membership growth, church planting rates, and mission agency budget splits.' },
      'leadership_fracture':       { why: 'Leadership fractures occur when senior religious leaders publicly break with each other over doctrine, politics, or governance. Pope Francis vs. traditionalist cardinals (Dubia letters, Latin Mass restrictions). Archbishop of Canterbury vs. GAFCON primates. SBC moderate vs. conservative factions fighting over the convention presidency. These fractures signal institutional instability and often precede formal schism. Leadership fractures also create succession crises: when a denomination\u2019s leader is contested, governance paralysis follows.', move: 'Position in religious leadership development (Duke Divinity, Fuller Seminary, Gordon-Conwell), executive search for religious institutions, and denominational governance consulting. Track major denominational leadership elections, papal appointments, and primatial statements.' },
      'organizational_schism':     { why: 'Organizational schism is the final stage: formal institutional separation with legal, financial, and property implications. The United Methodist disaffiliation process required votes by thousands of congregations, property appraisals, pension fund actuarial calculations, and trust clause negotiations. Anglican property battles have lasted 15+ years in U.S. courts (Diocese of South Carolina, Diocese of San Joaquin). Orthodox autocephaly disputes (Moscow-Constantinople over Ukraine) involve geopolitical dimensions. Each schism creates years of legal and financial work, with millions in legal fees per denomination.', move: 'Position in religious property law, pension actuarial services, institutional insurance (Church Mutual, Brotherhood Mutual, GuideOne), and denominational restructuring advisory. Track property litigation outcomes, pension fund division proposals, and insurance coverage dispute filings.' }
    }
  };

  var MECH_FALLBACK = {
    'sectarian_escalation':      { why: 'Sectarian tensions are escalating between religious communities. Defense, CVE, and peacebuilding organizations see demand.', move: 'Position in defense contractors (LMT, RTX, NOC), CVE consultancies (BAH, LDOS), and peacebuilding grant work (USIP, ICG).' },
    'identity_hardening':        { why: 'Religious identity is hardening as a political identity, collapsing compromise space. Political risk and social media monitoring benefit.', move: 'Position in political risk advisory (Eurasia Group, Control Risks) and social media monitoring (PLTR, CrowdStrike CRWD).' },
    'grievance_amplification':   { why: 'Religious grievance narratives are being amplified through social media and state-aligned media, converting local incidents into regional crises.', move: 'Position in content moderation technology (GOOGL, META), counter-narrative programming, and media monitoring platforms.' },
    'inter_communal_violence':   { why: 'Physical violence between religious communities is active. Security, insurance, and humanitarian response organizations see demand.', move: 'Position in physical security (AXON, MSI), insurance, and humanitarian response organizations (ICRC, UNHCR contractors).' },
    'scandal_exposure':          { why: 'Institutional abuse scandals are breaking. Forensic investigation, plaintiff law, and crisis communications firms see surge demand.', move: 'Position in forensic accounting (FTI Consulting FCN), institutional governance consulting, and crisis communications.' },
    'trust_collapse':            { why: 'Trust in religious institutions is collapsing. Donor management, institutional restructuring, and reputation recovery services benefit.', move: 'Position in donor platforms (Blackbaud), institutional restructuring advisory, and reputation consulting.' },
    'authority_erosion':         { why: 'Religious leaders are losing moral authority. Crisis communications, governance consulting, and leadership transition services see demand.', move: 'Position in crisis communications (Brunswick, Edelman), governance consulting, and executive transition services.' },
    'accountability_failure':    { why: 'Institutional accountability systems have failed. Compliance platforms, background check services, and independent investigation firms benefit.', move: 'Position in compliance platforms, background checks (Sterling, HireRight), and investigation firms (Guidepost Solutions, Praesidium).' },
    'extremist_capture':         { why: 'Radical factions are capturing religious institutions. CVE programs, deradicalization services, and intelligence platforms see funding.', move: 'Position in CVE consulting (BAH, CACI), deradicalization programs, and extremist network mapping (PLTR, CRWD).' },
    'polarizing_rhetoric':       { why: 'Polarizing religious rhetoric is driving radicalization pipeline intake. Content moderation and counter-narrative programming benefit.', move: 'Position in content moderation technology (GOOGL YouTube, META), counter-narrative organizations, and media monitoring.' },
    'radicalization_pipeline':   { why: 'Online radicalization pipelines are active. CVE technology, intervention programs, and counter-terrorism consulting see sustained funding.', move: 'Position in CVE technology, counter-terrorism consulting (BAH, LDOS, SAIC), and intervention program operators.' },
    'attendance_contraction':    { why: 'Church attendance is contracting structurally. Church real estate disposition, virtual worship technology, and management SaaS benefit.', move: 'Position in real estate (SPG, O), virtual worship (ZM), and church management platforms (Planning Center, Pushpay).' },
    'youth_disengagement':       { why: 'Young adults are leaving organized religion at record rates. Digital ministry, youth engagement technology, and content creation tools benefit.', move: 'Position in digital ministry (YouVersion, Faithlife), social media tools, and youth engagement platforms.' },
    'membership_decline':        { why: 'Formal religious membership is declining across denominations. Donor retention, engagement analytics, and restructuring advisory benefit.', move: 'Position in donor platforms (Blackbaud BLKB), church engagement analytics, and denominational restructuring.' },
    'declining_legitimacy':      { why: 'Religious institutions are losing legitimacy as moral authorities. Public affairs consulting and religious freedom legal defense see demand.', move: 'Position in institutional reputation research (Gallup), public affairs consulting, and religious freedom law (Becket Fund, ADF).' },
    'doctrinal_conflict':        { why: 'Doctrinal disputes are fracturing major denominations. Property litigation, pension division, and restructuring consulting benefit.', move: 'Position in denominational property litigation, pension actuarial services, and institutional restructuring advisory.' },
    'denominational_splintering': { why: 'Denominations are splintering into new institutional entities requiring parallel infrastructure. Church planting and startup consulting benefit.', move: 'Position in church planting (ARC, Stadia), denominational startup consulting, and institutional financial planning.' },
    'leadership_fracture':       { why: 'Senior religious leaders are publicly breaking with each other. Governance consulting and leadership development see demand.', move: 'Position in religious leadership development (Duke, Fuller, Gordon-Conwell), executive search, and governance consulting.' },
    'organizational_schism':     { why: 'Formal institutional separation is underway with legal and financial implications. Property law, insurance, and restructuring advisory benefit.', move: 'Position in religious property law, pension actuarial services, insurance (Church Mutual, Brotherhood Mutual), and restructuring.' }
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
    h += '<div class="eos-invest-meaning">INVEST means: take a position in companies or ETFs expected to benefit from this Religion condition. These are not buy recommendations \u2014 candidates for your own due diligence.</div>';

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
      if (t.validation === 'NODE_MAPPED') h += '<div style="margin-bottom:4px;color:#4a8fd4">Mapped to a Religion portal node. Company-level Helix validation pending.</div>';
      h += '<div style="margin-top:4px">';
      if (t.cik) h += '<a class="eos-target-link" href="helix-report.html?cik=' + esc(t.cik) + '&company=' + esc(t.ticker.toLowerCase()) + '&source_surface=domain_clarity_operator&domain=religion&requested_report_type=partial_phase_snapshot" target="_blank">HELIX REPORT</a>';
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
    return fetch('/assets/data/deep/religion-branch-index.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { _branchIndex = d; return d; }).catch(function () { _branchIndexFailed = true; return null; });
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

    var text = '<b>Religion domain at ' + pct + '% stress.</b> ';
    if (activeDx.length > 0) {
      text += activeDx.length + ' active diagnosis pathway' + (activeDx.length > 1 ? 's' : '') + ' confirmed. ';
      var primaryDx = activeDx[0];
      var ctx = DX_CONTEXT[(primaryDx.id || '').toUpperCase()];
      if (ctx) text += ctx.what + '. <b>Money move:</b> ' + ctx.step;
    } else {
      text += 'No active diagnoses. Watch for sectarian conflict, institutional abuse, radicalization, or secularization signals.';
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
      var claims = ledger.getClaimsByDomain('religion');
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
          domain: 'religion',
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
      var _claimExisting = window.LIMENClaimLedger ? window.LIMENClaimLedger.isOpportunityClaimed(o.id || key, 'religion') : null;
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

    var bridge = window.LIMENReligionPromotionBridge;
    if (bridge && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('religion') : null;
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
    h += '<div class="eos-title" style="margin-bottom:0">RELIGION \u00b7 OPERATOR SURFACE</div>';
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
      dxContent += '<div style="font-size:0.32rem;color:#908878">No active diagnoses. Watch for sectarian conflict, institutional abuse, radicalization, or secularization signals.</div>';
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
        var def = PLAYBOOK_DEFS[pbId] || { title: oppTitle, domains: ['religion'], type: 'invest' };

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
        window.location.href = 'investment-console.html?opp=' + encodeURIComponent(pbId) + '&source=religion&returnTo=' + encodeURIComponent('/domain-console?domain=religion');
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
        window.LIMENClaimFlow.openClaimModal(opp, 'religion', function (confirmedOpp, estimate) {
          if (window.LIMENClaimLedger) {
            window.LIMENClaimLedger.createClaim(confirmedOpp, 'religion', estimate);
          }
          renderOperator();
        });
      });
    }

    // Mount operator workflow panel
    if (window.LIMENOperatorPanel) window.LIMENOperatorPanel.mount(_operatorView, 'religion');
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
    if (window.LIMENReligionBusinessReview) window.LIMENReligionBusinessReview.mount(_operatorView);
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

    console.log('[ReligionOperator] Booted \u2014 operator view created, toggle wired');
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
