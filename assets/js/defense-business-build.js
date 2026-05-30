/**
 * education-business-build.js — BUSINESS BUILD Execution Workspace (Education)
 *
 * Defense-native business launch system. Stages with defense-native templates
 * (B2B SaaS, cybersecurity vendor, AI infrastructure, devtools / open source,
 * technology consultancy). 90-day execution plan, printable launch packet.
 *
 * Education domain only.
 * Exposes: window.LIMENDefenseBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isDefense = _dom === 'defense';
  var isWorkspace = window.location.pathname.indexOf('defense-workspace') !== -1;
  if (!isDefense && !isWorkspace) return;

  var STORE_KEY = 'limen_defense_business_build';
  var MODE_KEY = 'limen_dbb_mode';

  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAll(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }
  function getWs(key) { return loadAll()[key] || null; }
  function saveWs(key, ws) { var a = loadAll(); a[key] = ws; saveAll(a); }
  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function getMode() { try { return localStorage.getItem(MODE_KEY) || 'operator'; } catch (e) { return 'operator'; } }
  function setMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch (e) {} }

  var OPERATOR_SECTIONS = ['concept', 'market', 'biz_type', 'entity', 'tax_id', 'compliance', 'banking', 'delivery', 'customers', 'first90', 'readiness'];
  var AUDITOR_ONLY = ['revenue', 'governance', 'startup_costs', 'sources', 'loan_prep', 'team', 'infrastructure', 'legal_docs', 'financial_docs'];

  var TEMPLATES = {
    'defense_tech_startup': {
      label: 'Defense-Tech Startup (Anduril / Shield AI Model)',
      description: 'A venture-backed defense-tech startup building a hardware, software, or autonomous-systems product for DoD and allied militaries. Examples: Anduril, Shield AI, Saronic, Saildrone, Helsing, Hadrian, Quantum Systems, Tekever.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$2M-$50M+ seed/Series A',
      legalNotes: 'Delaware C-Corp. CFIUS-compliant cap table (limited foreign investment, no PRC LP exposure). DDTC registration if exporting (ITAR). Facility security clearance pursuit. CMMC 2.0 Level 2 minimum to handle CUI. Founders need US citizenship for clearance pathway.',
      fundingNotes: 'Defense-focused VCs (Founders Fund, 8VC, a16z American Dynamism, Lux Capital, General Catalyst, Andreessen Horowitz, Lightspeed). In-Q-Tel for IC-relevant tech. SBIR Phase I ($50-300K), Phase II ($1-2M), Phase III (no cap, sole source bridge). Direct OTAs from DIU, AFWERX, NavalX.',
      operatingNotes: 'The defense valley of death is real but shrinking. SBIR \u2192 OTA \u2192 Production contract is the standard path. Reference customers from a single combatant command unlock the rest. AFWERX, NavalX, and DIU are the fastest ways into DoD as a startup.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Verify all founders\u2019 citizenship status (US-born or naturalized for clearance pathway). Issue founder shares with vesting. OUTPUT: Cap table CFIUS-clean.',
        'DAYS 1-7: Apply for EIN. Open business bank account (Mercury / Brex / SVB). Engage defense counsel familiar with ITAR, CFIUS, and DFARS. OUTPUT: Banking and counsel.',
        'DAYS 8-14: Register with SAM.gov. Get DUNS / UEI. Register with DDTC if any export-controlled tech. OUTPUT: Federal vendor registrations live.',
        'DAYS 8-14: Begin CMMC 2.0 readiness (PreVeil, Vanta Federal, Drata Federal). OUTPUT: CUI handling posture documented.',
        'DAYS 15-30: Apply for SBIR Phase I from Air Force, Army, Navy, DARPA, or topic-specific agency. Engage SBIR proposal-writing consultant if needed. OUTPUT: SBIR Phase I submitted.',
        'DAYS 15-30: Reach out to AFWERX, NavalX, Army xTech, and Defense Innovation Unit. Apply for relevant prize challenges. OUTPUT: Innovation hub relationships open.',
        'DAYS 31-60: Build MVP. Demo to a sponsoring program office. Get a problem statement from a real warfighter. OUTPUT: MVP demoed to military customer.',
        'DAYS 31-60: Pitch defense-focused VCs. Target $2M-$10M seed round. OUTPUT: Seed fundraising in process.',
        'DAYS 61-90: Win SBIR Phase I or first OTA. Begin pursuit of Phase II ($1M-$2M). OUTPUT: First federal contract won.'
      ]
    },
    'sbir_consultancy': {
      label: 'Defense Consultancy / SBIR Bid Support',
      description: 'A boutique defense consultancy providing strategy, capability analysis, SBIR/STTR proposal writing, and bid support to defense vendors and federal program offices. Examples: small IDIQ holders supporting AFRL, ONR, ARO, ARL.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$25K-$150K',
      legalNotes: 'LLC or S-Corp typical. SAM.gov registration mandatory. DUNS / UEI required. May need facility security clearance for classified work. Professional liability insurance ($2M-$5M E&O).',
      fundingNotes: 'Self-funded. First clients come from prior networks (former program managers, former contracting officers, former military officers). Retainer + project fees model.',
      operatingNotes: 'Subject matter expertise from prior government service is the moat. 1099 / IDIQ relationships are common. Prime / sub relationships matter for bigger contracts. Reputation in a specific program office unlocks repeat work.',
      first90: [
        'DAYS 1-5: File LLC or S-Corp. Apply for EIN. Open business bank account. OUTPUT: Entity and banking.',
        'DAYS 1-5: Register on SAM.gov. Get DUNS / UEI number. OUTPUT: Federal vendor registration live.',
        'DAYS 6-15: Purchase professional liability ($2M-$5M E&O, ~$2K-$5K/year). OUTPUT: Insurance active.',
        'DAYS 6-15: Define service catalog: SBIR / STTR proposal writing, capability analysis, market research, white papers, OTA bid support, prime / sub teaming. Set rates ($150-$400/hr). OUTPUT: Service menu finalized.',
        'DAYS 16-25: Build templates: MSA, SOW, NDA, teaming agreement, white paper template, capability statement. OUTPUT: Templates ready.',
        'DAYS 16-25: Outreach to 30 prospects in your network. Reach out to former colleagues at primes, program offices, and small defense firms. OUTPUT: 10 prospect conversations booked.',
        'DAYS 26-40: Convert conversations into first SBIR Phase I proposal support engagement. Sign MSA. OUTPUT: First paying engagement.',
        'DAYS 41-60: Deliver first proposals. Bill NET 30. Develop case studies (cleared content). OUTPUT: First engagements delivered.',
        'DAYS 61-90: Convert one-off engagements into monthly retainers. Pursue prime teaming agreements (sub-contractor on a larger bid). OUTPUT: First retainer signed.'
      ]
    },
    'osint_intel_vendor': {
      label: 'OSINT / Intelligence Analysis Vendor',
      description: 'A B2B vendor selling open-source intelligence, geopolitical risk analysis, or AI-augmented analysis tooling to defense, IC, and corporate customers. Examples: Recorded Future, Sayari, Janes, Two Six Technologies, Babel Street.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$1M-$20M',
      legalNotes: 'Delaware C-Corp. SAM.gov registration. Facility clearance pursuit for classified work. Foreign ownership restrictions (CFIUS-clean cap table). DDTC if exporting analysis services. CMMC 2.0 Level 2 minimum.',
      fundingNotes: 'In-Q-Tel for IC-relevant capability. Defense-tech VCs (Founders Fund, 8VC, Lux Capital). Strategic investors (Palantir, BAH). SBIR-to-Phase-III pipeline.',
      operatingNotes: 'Long sales cycles (6-18 months) into IC and DoD. Allied IC partnerships (Five Eyes) accelerate growth. Enterprise sales motion supplements government revenue. Subscription pricing $50K-$1M+ per year per customer.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Cap table CFIUS-clean (no foreign LP exposure to PRC). Verify founder citizenship. OUTPUT: Cap table compliant.',
        'DAYS 1-7: Apply for EIN. Open business bank account. Engage defense / IC counsel. OUTPUT: Banking and counsel.',
        'DAYS 8-14: Register on SAM.gov. Begin facility clearance application (6-18 month process). OUTPUT: SAM and clearance process started.',
        'DAYS 8-14: Begin CMMC 2.0 Level 2 readiness. Implement zero-trust internally. OUTPUT: CUI handling posture.',
        'DAYS 15-30: Build MVP of OSINT collection / analysis platform. Test against unclassified open data. OUTPUT: MVP demo-ready.',
        'DAYS 15-30: Pitch In-Q-Tel for early-stage funding (IC-relevant) and SBIR Phase I. OUTPUT: Funding pipeline open.',
        'DAYS 31-60: Sign 2-3 design partner customers (commercial first \u2014 banks, insurers, large enterprises with risk teams). OUTPUT: First design partners active.',
        'DAYS 31-60: Apply for AFWERX, NavalX, DIU prize challenges to get DoD warm relationships started. OUTPUT: Innovation hub relationships.',
        'DAYS 61-90: Convert first design partner to paid annual subscription ($50K-$250K). Pursue first DoD pilot. OUTPUT: First paying customer + first DoD pilot.'
      ]
    },
    'munitions_replenishment': {
      label: 'Munitions / Defense Industrial Base Manufacturer',
      description: 'A defense industrial base manufacturer producing munitions, components, ammunition, or critical sub-systems for primes and direct sales to allied militaries. Examples: small / mid-size munitions makers, propellant / explosives manufacturers, critical component suppliers.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$5M-$100M+',
      legalNotes: 'Delaware C-Corp or LLC. ITAR / DDTC registration. AS9100 / ISO 9001 quality management. CMMC 2.0 Level 2-3. ATF / state explosives licensing if propellants / energetics. Environmental permits (EPA, state DEC). Facility security clearance.',
      fundingNotes: 'Defense-specific PE (American Industrial Partners, Arlington Capital, Acorn Growth Companies, AE Industrial Partners). DoD industrial base direct funding (Defense Production Act Title III, Industrial Base Analysis and Sustainment). Bank financing with DoD purchase order collateral.',
      operatingNotes: 'Defense manufacturing is capital-intensive but contracts run multi-year and at premium margins. Replenishment urgency creates long-term offtake. Small specialty makers can grow into IDIQ holders. Allied FMS expands the addressable market massively.',
      first90: [
        'DAYS 1-15: Form Delaware C-Corp or LLC. Engage defense counsel familiar with ITAR, DFARS, ATF, and EPA. OUTPUT: Entity and defense counsel.',
        'DAYS 1-15: Register with SAM.gov, DDTC, ATF (if energetics). Begin facility clearance. OUTPUT: Federal registrations live.',
        'DAYS 16-30: Identify capacity gap in DoD or NATO supply chain (specific munition, component, sub-assembly). Validate demand with primes and Defense Logistics Agency. OUTPUT: Demand validation complete.',
        'DAYS 16-30: Begin AS9100 / ISO 9001 certification process. Engage quality consultancy. OUTPUT: QMS process started.',
        'DAYS 31-45: Site selection. Begin facility lease or construction. Environmental permitting started. OUTPUT: Facility under contract.',
        'DAYS 31-45: Pursue Defense Production Act Title III funding for capacity expansion. Apply for IBAS funding. OUTPUT: DPA / IBAS application in process.',
        'DAYS 46-60: Sign teaming agreements with primes (Lockheed, RTX, Northrop, GD, BAE). Pursue sub-contractor role on existing IDIQ. OUTPUT: Prime relationships active.',
        'DAYS 46-60: Begin CMMC 2.0 readiness. Implement secure dev environment. OUTPUT: CMMC program live.',
        'DAYS 61-90: Win first DoD or prime contract (most likely as a sub on an existing IDIQ). OUTPUT: First defense contract in hand.'
      ]
    },
    'space_isr_provider': {
      label: 'Commercial Space ISR / Imagery Provider',
      description: 'A commercial space company providing imagery, signals intelligence, or space domain awareness services to defense and IC customers. Examples: Maxar, Planet Labs, BlackSky, Capella Space, ICEYE, Hawkeye 360.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$20M-$500M+',
      legalNotes: 'Delaware C-Corp. NOAA Commercial Remote Sensing License (CRSRA). FCC space station license. Export controls (USML / EAR). NRO commercial imagery program participation pathway. CFIUS-clean ownership.',
      fundingNotes: 'Space-focused VCs (Founders Fund, Lux Capital, Space Capital, Seraphim Space). NRO Commercial Systems Program Office (CSPO) anchor contracts. NGA Joint Commercial Operations (JCO). Defense Innovation Unit (DIU). NATO and allied space programs.',
      operatingNotes: 'Capital-intensive (satellite manufacturing and launch) but margins on data and analytics services are very high. NRO and NGA are anchor customers; allied governments add volume. Commercial customers (insurance, finance, NGOs) provide diversification.',
      first90: [
        'DAYS 1-15: Incorporate as Delaware C-Corp. Engage space and aerospace counsel. CFIUS-clean cap table. OUTPUT: Entity and counsel.',
        'DAYS 1-15: Apply for EIN. Open business bank account. Begin NOAA CRSRA license application. OUTPUT: Banking and license process started.',
        'DAYS 16-30: Register with SAM.gov and FCC (if launching). Begin export control classification. OUTPUT: Federal registrations and export posture.',
        'DAYS 16-30: Define product (imagery, SIGINT, SDA, RF mapping). Develop initial demo capability using existing platforms or partner data. OUTPUT: Product MVP demo-ready.',
        'DAYS 31-45: Pitch space-focused VCs (Founders Fund, Seraphim, Space Capital). Target $20M-$100M Series A. OUTPUT: Series A fundraising in process.',
        'DAYS 31-45: Engage NRO CSPO and NGA JCO for early relationship building. Apply for relevant SBIR Phase I. OUTPUT: NRO / NGA relationships open.',
        'DAYS 46-60: Sign first commercial design partner customers (insurance, energy, agriculture). OUTPUT: First commercial pilots.',
        'DAYS 61-90: Win first SBIR Phase I or NRO study contract. OUTPUT: First federal revenue.'
      ]
    },
    'security_cooperation_firm': {
      label: 'Security Cooperation / Foreign Military Sales Firm',
      description: 'A defense services firm supporting Foreign Military Sales (FMS), Direct Commercial Sales (DCS), security cooperation, and allied training. Examples: small to mid-size firms supporting DSCA, Office of Defense Cooperation, allied training contracts.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$500K-$10M',
      legalNotes: 'Delaware C-Corp or LLC. ITAR / DDTC registration mandatory. SAM.gov. Facility clearance. Foreign Corrupt Practices Act (FCPA) compliance program. Possible Foreign Agents Registration Act (FARA) registration depending on activities.',
      fundingNotes: 'Self-funded or small-cap PE. DSCA-related contract revenue, allied government direct revenue, prime sub-contractor revenue. Multi-year contracts typical.',
      operatingNotes: 'Allied governments are the customer. Cleared US personnel run engagements. Foreign language and regional expertise are differentiators. Reputation with US Embassies and Office of Defense Cooperation matters.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Engage counsel familiar with ITAR, DDTC, FCPA, and FARA. OUTPUT: Entity and counsel.',
        'DAYS 1-7: Apply for EIN. Open business bank account. OUTPUT: Banking active.',
        'DAYS 8-14: Register with SAM.gov, DDTC, and (if activities require) FARA. OUTPUT: Federal registrations live.',
        'DAYS 8-14: Implement FCPA compliance program (training, procedures, recordkeeping). OUTPUT: FCPA program live.',
        'DAYS 15-30: Define service catalog: FMS execution support, allied training, security cooperation programs, allied capability assessment, partner-nation logistics. OUTPUT: Service menu finalized.',
        'DAYS 15-30: Pursue facility clearance. OUTPUT: Clearance process started.',
        'DAYS 31-60: Outreach to DSCA, geographic combatant commands (CENTCOM, EUCOM, AFRICOM), and Offices of Defense Cooperation in target embassies. OUTPUT: Government customer relationships open.',
        'DAYS 61-90: Win first DSCA-related contract (likely as sub on an IDIQ) or first allied government direct contract. OUTPUT: First contract won.'
      ]
    }
  };

  var STAGES = [
    { title: 'STAGE 1 - CONCEPT & MARKET', sections: [
      { id: 'concept', title: 'What This Business Is', type: 'fields', guidance: 'In one paragraph, describe what this business does and who it serves.', fields: [
        { id: 'name', label: 'Business name', type: 'text' },
        { id: 'mapping_title', label: 'Mapped business type', type: 'text' },
        { id: 'node_source', label: 'Source brain node', type: 'text' },
        { id: 'full_desc', label: 'What this business does (1 paragraph)', type: 'textarea' }
      ] },
      { id: 'market', title: 'Market & Customer', type: 'fields', guidance: 'Who is the customer and why do they need this now?', fields: [
        { id: 'customer', label: 'Primary customer', type: 'text' },
        { id: 'market_size', label: 'Estimated addressable market', type: 'text' },
        { id: 'why_now', label: 'Why this market needs the service NOW', type: 'textarea' }
      ] },
      { id: 'biz_type', title: 'Business Template', type: 'fields', guidance: 'Which template best fits this business?', fields: [
        { id: 'template', label: 'Template', type: 'select', options: ['defense_tech_startup', 'sbir_consultancy', 'osint_intel_vendor', 'munitions_replenishment', 'space_isr_provider', 'security_cooperation_firm'] }
      ] }
    ] },
    { title: 'STAGE 2 - LEGAL & ENTITY', sections: [
      { id: 'entity', title: 'Entity Formation', type: 'fields', fields: [
        { id: 'entity_type', label: 'Entity type', type: 'select', options: ['LLC', 'C-Corp', 'S-Corp', '501(c)(3)', 'Sole Proprietor'] },
        { id: 'state', label: 'State of formation', type: 'text' },
        { id: 'filing_status', label: 'Filing status', type: 'select', options: ['Not started', 'Drafted', 'Filed', 'Confirmed'] }
      ] },
      { id: 'tax_id', title: 'EIN & Tax Setup', type: 'fields', fields: [
        { id: 'ein', label: 'EIN (last 4 digits)', type: 'text' },
        { id: 'tax_year', label: 'Tax year', type: 'text' }
      ] },
      { id: 'compliance', title: 'Defense Regulatory Compliance', type: 'textarea', guidance: 'ITAR / DDTC / DFARS / CMMC 2.0 / SAM.gov / facility clearance / CFIUS / FCPA / FARA / NIST 800-171 / EAR / NOAA CRSRA (space) / ATF (energetics) as applicable.' },
      { id: 'governance', title: 'Governance Documents', type: 'checklist', items: ['Operating agreement / shareholder agreement', 'Founder vesting / restricted stock', '83(b) election filed (if applicable)', 'MSA / DPA / SLA templates', 'NDAs', 'IP assignment agreements', 'Open-source contribution license (CLA/DCO if applicable)'] },
      { id: 'legal_docs', title: 'Required Legal Documents', type: 'checklist', items: ['State formation filing', 'EIN confirmation', 'Insurance policies', 'Background check policy', 'Charter / authorizer approval (if applicable)', 'Student Privacy Pledge signature (if edtech)'] }
    ] },
    { title: 'STAGE 3 - FINANCIAL SETUP', sections: [
      { id: 'banking', title: 'Banking & Accounting', type: 'fields', fields: [
        { id: 'op_bank', label: 'Operating bank', type: 'text' },
        { id: 'accounting_software', label: 'Accounting software', type: 'select', options: ['QuickBooks Online', 'Pilot', 'Bench', 'Other'] }
      ] },
      { id: 'startup_costs', title: 'Startup Costs', type: 'fields', fields: [
        { id: 'cost_legal', label: 'Legal/formation', type: 'text' },
        { id: 'cost_insurance', label: 'Insurance', type: 'text' },
        { id: 'cost_publishing', label: 'Publishing platform / hosting', type: 'text' },
        { id: 'cost_software', label: 'Software / IT', type: 'text' },
        { id: 'cost_personnel', label: 'Personnel (3-month runway)', type: 'text' },
        { id: 'cost_total', label: 'Total startup', type: 'text' }
      ] },
      { id: 'revenue', title: 'Revenue Model', type: 'textarea' },
      { id: 'sources', title: 'Funding Sources', type: 'textarea' },
      { id: 'loan_prep', title: 'Grant / Loan Preparation', type: 'textarea' },
      { id: 'financial_docs', title: 'Financial Documents Ready', type: 'checklist', items: ['Startup budget', 'Year 1 cash flow projection', '3-year P&L projection', 'SBIR / STTR proposal (if applicable)', 'Cap table (if VC track)', 'Pitch deck'] }
    ] },
    { title: 'STAGE 4 - OPERATIONS', sections: [
      { id: 'delivery', title: 'Service / Product Delivery Model', type: 'textarea' },
      { id: 'team', title: 'Team', type: 'textarea' },
      { id: 'infrastructure', title: 'Tech / Facility Infrastructure', type: 'textarea' },
      { id: 'operating_docs', title: 'Operating Procedures', type: 'checklist', items: ['Customer intake / sales process', 'Standard operating procedures (SOPs)', 'Incident response + on-call runbook', 'Customer data handling protocols', 'Billing and invoicing', 'Customer success workflow'] }
    ] },
    { title: 'STAGE 5 - LAUNCH (FIRST 90 DAYS)', sections: [
      { id: 'customers', title: 'Customer / District Acquisition Plan', type: 'textarea' },
      { id: 'first90', title: 'First 90 Days Execution Plan', type: 'fields', fields: [
        { id: 'days_1_30', label: 'Days 1-30', type: 'textarea' },
        { id: 'days_31_60', label: 'Days 31-60', type: 'textarea' },
        { id: 'days_61_90', label: 'Days 61-90', type: 'textarea' }
      ] }
    ] },
    { title: 'STAGE 6 - LAUNCH READINESS', sections: [
      { id: 'readiness', title: 'Launch Readiness Checklist', type: 'checklist', items: ['Legal entity formed and EIN issued', 'Banking and accounting active', 'Insurance in force (cyber + E&O + general liability)', 'SOC 2 / ISO 27001 program started if required', 'Privacy policy + ToS + DPA published', 'Founder/team vesting active', 'First customers / pilots identified', '90-day plan documented'] },
      { id: 'review', title: 'Final Review', type: 'review' }
    ] },
    { title: 'STAGE 7 - AUDITOR DECISION', sections: [
      { id: 'auditor', title: 'Auditor Decision', type: 'auditor' }
    ] }
  ];

  function renderField(sec, ws) {
    var val = (ws.fields && ws.fields[sec.id]) || '';
    var checked = (ws.checks && ws.checks[sec.id]) || {};
    var sectionDone = ws.sectionDone && ws.sectionDone[sec.id];
    var h = '<div class="eep-section" data-section="' + sec.id + '">';
    h += '<div class="eep-section-header"><span class="eep-section-title">' + (sectionDone ? '\u2713 ' : '') + esc(sec.title) + '</span>';
    if (sec.type !== 'info' && sec.type !== 'review' && sec.type !== 'auditor') h += '<label class="eep-section-check"><input type="checkbox" class="eep-done-check" data-sec="' + sec.id + '"' + (sectionDone ? ' checked' : '') + '> done</label>';
    h += '</div>';
    if (sec.guidance) h += '<div class="eep-guidance">' + esc(sec.guidance) + '</div>';

    if (sec.type === 'textarea') {
      h += '<textarea class="eep-textarea" data-field="' + sec.id + '.value">' + esc(typeof val === 'object' ? (val.value || '') : val) + '</textarea>';
    } else if (sec.type === 'fields') {
      var fieldVals = typeof val === 'object' ? val : {};
      for (var fi = 0; fi < sec.fields.length; fi++) {
        var f = sec.fields[fi];
        var fv = fieldVals[f.id] || '';
        h += '<div class="eep-field"><label class="eep-field-label">' + esc(f.label) + '</label>';
        if (f.type === 'select') {
          h += '<select class="eep-select" data-field="' + sec.id + '.' + f.id + '">';
          h += '<option value=""></option>';
          for (var oi = 0; oi < f.options.length; oi++) h += '<option' + (fv === f.options[oi] ? ' selected' : '') + '>' + esc(f.options[oi]) + '</option>';
          h += '</select>';
        } else if (f.type === 'textarea') {
          h += '<textarea class="eep-textarea" data-field="' + sec.id + '.' + f.id + '">' + esc(fv) + '</textarea>';
        } else {
          h += '<input class="eep-input" type="text" data-field="' + sec.id + '.' + f.id + '" value="' + esc(fv) + '">';
        }
        h += '</div>';
      }
    } else if (sec.type === 'checklist') {
      for (var ci = 0; ci < sec.items.length; ci++) {
        var ik = 'item_' + ci;
        h += '<label class="eep-check-item"><input type="checkbox" class="eep-check" data-sec="' + sec.id + '" data-item="' + ik + '"' + (checked[ik] ? ' checked' : '') + '> ' + esc(sec.items[ci]) + '</label>';
      }
    } else if (sec.type === 'review') {
      var ts = 0, ds = 0;
      for (var ssi = 0; ssi < STAGES.length; ssi++) {
        for (var psi = 0; psi < STAGES[ssi].sections.length; psi++) {
          var ps = STAGES[ssi].sections[psi];
          if (ps.type === 'review' || ps.type === 'auditor') continue;
          ts++;
          if (ws.sectionDone && ws.sectionDone[ps.id]) ds++;
        }
      }
      var pct = ts > 0 ? Math.round(ds / ts * 100) : 0;
      h += '<div style="font-size:0.38rem;color:#d0c8b8;margin-bottom:6px">Progress: <b>' + ds + '/' + ts + '</b> (' + pct + '%)</div>';
      h += '<div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:' + pct + '%;background:' + (pct >= 80 ? '#5ab5a0' : pct >= 50 ? '#C9A94E' : '#e85454') + ';border-radius:3px"></div></div>';
      h += '<div style="margin-top:8px"><button class="eep-btn eep-btn-print" data-action="print">PRINT LAUNCH PACKET</button></div>';
    } else if (sec.type === 'auditor') {
      var as = ws.auditor || {};
      var sl = as.status || 'DRAFT';
      h += '<div class="eep-auditor"><div class="eep-auditor-title">AUDITOR REVIEW</div>';
      h += '<div style="margin-bottom:6px"><span class="eep-status eep-status-' + sl.toLowerCase() + '">' + sl + '</span></div>';
      h += '<div class="eep-field"><label class="eep-field-label">Auditor comments</label><textarea class="eep-textarea" data-auditor="comments" style="min-height:40px">' + esc(as.comments || '') + '</textarea></div>';
      h += '<div class="eep-auditor-btns"><button class="eep-btn eep-btn-approve" data-action="approve">APPROVE</button><button class="eep-btn eep-btn-deny" data-action="deny">DENY</button><button class="eep-btn eep-btn-revise" data-action="revise">NEEDS REVISION</button></div>';
      if (as.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(as.timestamp).toLocaleString() + '</div>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function autoGenerate(ws, prefill, tmpl) {
    if (!ws.fields) ws.fields = {};
    if (tmpl && tmpl.first90 && (!ws.fields['first90'] || !ws.fields['first90']['days_1_30'])) {
      ws.fields['first90'] = ws.fields['first90'] || {};
      ws.fields['first90']['days_1_30'] = tmpl.first90.slice(0, 3).join('\n');
      ws.fields['first90']['days_31_60'] = tmpl.first90.slice(3, 6).join('\n');
      ws.fields['first90']['days_61_90'] = tmpl.first90.slice(6).join('\n');
    }
    if (tmpl && (!ws.fields['compliance'] || !ws.fields['compliance']['value'])) {
      ws.fields['compliance'] = { value: tmpl.legalNotes };
    }
    if (tmpl && (!ws.fields['revenue'] || !ws.fields['revenue']['value'])) {
      ws.fields['revenue'] = { value: tmpl.fundingNotes };
    }
    if (tmpl && (!ws.fields['delivery'] || !ws.fields['delivery']['value'])) {
      ws.fields['delivery'] = { value: tmpl.operatingNotes };
    }
  }

  function renderPanel(oppKey, prefill) {
    var ws = getWs(oppKey) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    var mode = getMode();

    if (!ws._prefilled && prefill) {
      ws._prefilled = true;
      if (!ws.fields['concept']) ws.fields['concept'] = {};
      if (prefill.nodeLabel) ws.fields['concept']['node_source'] = prefill.nodeLabel;
      if (prefill.businessType) {
        ws.fields['concept']['mapping_title'] = prefill.businessType;
        ws.fields['concept']['name'] = prefill.businessType + ' Inc.';
      }
      if (prefill.reason) ws.fields['concept']['full_desc'] = prefill.reason;
    }

    var tmplKey = ws.fields && ws.fields['biz_type'] && ws.fields['biz_type']['template'];
    if (!tmplKey && prefill && prefill.businessType) {
      var bt = (prefill.businessType || '').toLowerCase();
      if (bt.indexOf('munition') !== -1 || bt.indexOf('shell') !== -1 || bt.indexOf('propellant') !== -1 || bt.indexOf('explosive') !== -1 || bt.indexOf('manufactur') !== -1) tmplKey = 'munitions_replenishment';
      else if (bt.indexOf('osint') !== -1 || bt.indexOf('intelligence') !== -1 || bt.indexOf('analysis') !== -1 || bt.indexOf('imagery') !== -1) tmplKey = 'osint_intel_vendor';
      else if (bt.indexOf('space') !== -1 || bt.indexOf('satellite') !== -1 || bt.indexOf('isr') !== -1 || bt.indexOf('orbital') !== -1) tmplKey = 'space_isr_provider';
      else if (bt.indexOf('fms') !== -1 || bt.indexOf('foreign military') !== -1 || bt.indexOf('security cooperation') !== -1 || bt.indexOf('allied training') !== -1) tmplKey = 'security_cooperation_firm';
      else if (bt.indexOf('consult') !== -1 || bt.indexOf('sbir') !== -1 || bt.indexOf('proposal') !== -1 || bt.indexOf('advisory') !== -1) tmplKey = 'sbir_consultancy';
      else tmplKey = 'defense_tech_startup';
      if (!ws.fields['biz_type']) ws.fields['biz_type'] = {};
      ws.fields['biz_type']['template'] = tmplKey;
    }
    var tmpl = tmplKey ? TEMPLATES[tmplKey] : null;

    autoGenerate(ws, prefill, tmpl);
    saveWs(oppKey, ws);

    var total = 0, done = 0;
    for (var pi = 0; pi < STAGES.length; pi++) {
      for (var psi = 0; psi < STAGES[pi].sections.length; psi++) {
        var ps = STAGES[pi].sections[psi];
        if (ps.type === 'review' || ps.type === 'auditor') continue;
        total++;
        if (ws.sectionDone && ws.sectionDone[ps.id]) done++;
      }
    }
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    var status = ws.auditor && ws.auditor.status ? ws.auditor.status : 'DRAFT';

    var h = '<div class="eep-panel" data-opp="' + esc(oppKey) + '" data-track="business">';
    h += '<div class="eep-header" data-toggle="' + oppKey + '-business">';
    h += '<span class="eep-track-label" style="color:#C9A94E">BUSINESS BUILD</span>';
    h += '<span class="eep-progress">' + pct + '% \u00b7 ' + done + '/' + total + ' \u00b7 <span class="eep-status eep-status-' + status.toLowerCase() + '">' + status + '</span></span>';
    h += '<span class="eep-toggle">\u25BC</span>';
    h += '</div>';
    h += '<div class="eep-body" data-body="' + oppKey + '-business">';

    h += '<div style="display:flex;gap:4px;margin-bottom:10px;align-items:center">';
    h += '<button class="eep-btn" data-bb-mode="operator" style="' + (mode === 'operator' ? 'color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.08)' : 'color:#807868;border-color:rgba(128,120,104,0.2)') + '">OPERATOR MODE</button>';
    h += '<button class="eep-btn" data-bb-mode="auditor" style="' + (mode === 'auditor' ? 'color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.08)' : 'color:#807868;border-color:rgba(128,120,104,0.2)') + '">AUDITOR MODE</button>';
    h += '<span style="flex:1"></span>';
    h += '<span style="font-size:0.26rem;color:#706860">' + (mode === 'operator' ? 'Simplified guided flow' : 'Full access') + '</span>';
    h += '</div>';

    if (tmpl) {
      h += '<div style="padding:10px 12px;margin-bottom:12px;border:1px solid rgba(90,181,160,0.15);border-radius:3px;background:rgba(90,181,160,0.03)">';
      h += '<div style="font-size:0.36rem;color:#5ab5a0;margin-bottom:4px">We built this for you based on your business type.</div>';
      h += '<div style="font-size:0.32rem;color:#b0a898">Template: <b>' + esc(tmpl.label) + '</b> \u00b7 Capital: ' + esc(tmpl.typicalStartup) + ' \u00b7 ' + (tmpl.regulated ? 'Regulated' : 'Non-regulated') + '</div>';
      h += '<div style="font-size:0.30rem;color:#908878;margin-top:4px">' + esc(tmpl.description) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868;margin-top:6px"><b>Legal:</b> ' + esc(tmpl.legalNotes) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868"><b>Funding:</b> ' + esc(tmpl.fundingNotes) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868"><b>Operations:</b> ' + esc(tmpl.operatingNotes) + '</div>';
      h += '</div>';
    }

    for (var si = 0; si < STAGES.length; si++) {
      var stage = STAGES[si];
      var stageSections = stage.sections.filter(function (sec) {
        if (mode === 'operator' && AUDITOR_ONLY.indexOf(sec.id) !== -1) return false;
        return true;
      });
      if (stageSections.length === 0) continue;
      h += '<div style="margin-bottom:12px">';
      h += '<div style="font-size:0.34rem;letter-spacing:2.5px;color:rgba(201,169,78,0.4);padding:6px 0;border-bottom:1px solid rgba(201,169,78,0.08);margin-bottom:8px">' + esc(stage.title) + '</div>';
      for (var ssi = 0; ssi < stageSections.length; ssi++) h += renderField(stageSections[ssi], ws);
      h += '</div>';
    }

    h += '</div></div>';
    return h;
  }

  function wirePanel(container, oppKey) {
    var panel = container.querySelector('[data-opp="' + esc(oppKey) + '"][data-track="business"]');
    if (!panel) return;
    var header = panel.querySelector('[data-toggle="' + oppKey + '-business"]');
    var body = panel.querySelector('[data-body="' + oppKey + '-business"]');
    if (header && body) {
      header.addEventListener('click', function () { body.classList.toggle('open'); var t = header.querySelector('.eep-toggle'); if (t) t.textContent = body.classList.contains('open') ? '\u25B2' : '\u25BC'; });
    }
    var ws = getWs(oppKey) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };

    panel.querySelectorAll('.eep-textarea, .eep-input, .eep-select').forEach(function (el) {
      el.addEventListener('change', function () {
        var field = this.getAttribute('data-field'); var aud = this.getAttribute('data-auditor');
        if (field) { var p = field.split('.'); if (typeof ws.fields[p[0]] !== 'object') ws.fields[p[0]] = {}; ws.fields[p[0]][p[1]] = this.value; }
        if (aud) { ws.auditor = ws.auditor || {}; ws.auditor[aud] = this.value; }
        saveWs(oppKey, ws);
      });
    });

    panel.querySelectorAll('.eep-check').forEach(function (el) {
      el.addEventListener('change', function () { var sec = this.getAttribute('data-sec'), item = this.getAttribute('data-item'); if (!ws.checks[sec]) ws.checks[sec] = {}; ws.checks[sec][item] = this.checked; saveWs(oppKey, ws); });
    });

    panel.querySelectorAll('.eep-done-check').forEach(function (el) {
      el.addEventListener('change', function () { if (!ws.sectionDone) ws.sectionDone = {}; ws.sectionDone[this.getAttribute('data-sec')] = this.checked; saveWs(oppKey, ws); });
    });

    panel.querySelectorAll('[data-bb-mode]').forEach(function (el) {
      el.addEventListener('click', function () {
        setMode(this.getAttribute('data-bb-mode'));
        var newH = renderPanel(oppKey, null);
        panel.outerHTML = newH;
        wirePanel(container, oppKey);
        var newPanel = container.querySelector('[data-opp="' + esc(oppKey) + '"][data-track="business"]');
        if (newPanel) { var nb = newPanel.querySelector('.eep-body'); if (nb) nb.classList.add('open'); }
      });
    });

    panel.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        if (action === 'print') { window.print(); return; }
        ws.auditor = ws.auditor || {};
        if (action === 'approve') ws.auditor.status = 'APPROVED';
        if (action === 'deny') ws.auditor.status = 'DENIED';
        if (action === 'revise') ws.auditor.status = 'REVISE';
        ws.auditor.timestamp = Date.now();
        saveWs(oppKey, ws);
        var newH = renderPanel(oppKey, null);
        panel.outerHTML = newH;
        wirePanel(container, oppKey);
      });
    });
  }

  window.LIMENDefenseBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[DefenseBusinessBuild] loaded \u2014 7 stages, 6 defense-native templates');
})();
