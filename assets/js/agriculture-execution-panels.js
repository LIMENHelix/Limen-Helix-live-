/**
 * agriculture-execution-panels.js — GRANT and PATENT Execution Workspaces
 *
 * Agriculture domain only. Expandable workflow panels for each opportunity.
 * Operator can build a full grant application or patent packet in-portal.
 * Auditor can review and accept/deny.
 *
 * Self-gates: only runs when ?domain=agriculture
 * Exposes: window.LIMENAgricultureExecutionPanels
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var isAgriDomain = params.get('domain') === 'agriculture';
  var isAgriWorkspace = window.location.pathname.indexOf('agriculture-workspace') !== -1;
  if (!isAgriDomain && !isAgriWorkspace) return;

  var STORE_KEY = 'limen_agriculture_exec_panels';
  var _stylesInjected = false;

  // ══════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveAll(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function getWorkspace(oppKey, track) {
    var all = loadAll();
    return (all[oppKey] && all[oppKey][track]) || null;
  }
  function saveWorkspace(oppKey, track, workspace) {
    var all = loadAll();
    if (!all[oppKey]) all[oppKey] = {};
    all[oppKey][track] = workspace;
    saveAll(all);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECTION DEFINITIONS — GRANT (Agriculture-Native)
  // ══════════════════════════════════════════════════════════════════════

  var GRANT_SECTIONS = [
    { id: 'what', title: 'What This Grant Is', type: 'info',
      guidance: 'A grant is free money from a government agency (USDA, NSF, state Dept of Agriculture) or foundation to fund a specific agricultural project. You do not pay it back. In exchange, you deliver the project you promised. Common agriculture grants include USDA NIFA, SARE, EQIP, CSP, and state-level conservation programs.',
      prompt: 'No input needed — this is context for the operator.' },
    { id: 'why', title: 'Why This Opportunity Qualifies', type: 'textarea',
      guidance: 'Explain in plain English why this Agriculture opportunity is a good fit for grant funding. Think about: Does it improve food security? Does it address conservation, sustainability, or climate adaptation? Is there a USDA priority that matches?',
      prompt: 'Write 2-3 sentences explaining why this opportunity deserves grant funding.', prefillFrom: 'whyNow' },
    { id: 'eligibility', title: 'Eligibility', type: 'checklist',
      guidance: 'Grant programs have rules about who can apply. Check each item that applies to your operation.',
      items: ['Operation is a registered US agricultural entity', 'Has DUNS/UEI number', 'Registered on SAM.gov', 'No debarment or exclusion status', 'Meets USDA small/beginning farmer definition (if applicable)', 'Can provide cost-share or match if required', 'Has conservation plan on file (if NRCS program)', 'Located in eligible county/state for program'] },
    { id: 'applicant', title: 'Applicant Profile', type: 'fields',
      guidance: 'Basic information about the farm, ranch, or agricultural organization applying.',
      fields: [
        { id: 'org_name', label: 'Farm / Organization name', type: 'text', placeholder: 'e.g., Heartland Farms LLC' },
        { id: 'org_type', label: 'Operation type', type: 'select', options: ['Family Farm', 'Ranch', 'Cooperative', 'Agribusiness', 'Non-profit', 'University/Research', 'Tribal', 'Other'] },
        { id: 'uei', label: 'UEI / DUNS number', type: 'text', placeholder: 'e.g., ABC123456789' },
        { id: 'acres', label: 'Total acres operated', type: 'text', placeholder: 'e.g., 640' },
        { id: 'contact_name', label: 'Primary contact', type: 'text' },
        { id: 'contact_email', label: 'Contact email', type: 'text' },
        { id: 'county_state', label: 'County and state', type: 'text', placeholder: 'e.g., Story County, Iowa' }
      ] },
    { id: 'problem', title: 'Need / Problem Statement', type: 'textarea',
      guidance: 'What agricultural problem does this project solve? Be specific. Use real data if you have it — yield losses, soil test results, water usage metrics, pest damage estimates. The reviewer should finish reading this and think: "Yes, this is a real problem."',
      prompt: 'Describe the agricultural problem this project addresses. What happens if nothing is done?', prefillFrom: 'diagnosis' },
    { id: 'solution', title: 'Proposed Project / Solution', type: 'textarea',
      guidance: 'What will you actually build, plant, install, or implement? Be concrete. "We will install 3 center-pivot irrigation systems with soil moisture sensors on 480 acres" not "We will leverage precision agriculture synergies."',
      prompt: 'Describe what you will build, deploy, or implement. Be specific about deliverables.' },
    { id: 'impact', title: 'Impact / Expected Outcomes', type: 'textarea',
      guidance: 'What changes because of this project? Quantify if possible. "Reduces water usage by 30% across 640 acres" or "Prevents $200K/year in crop losses from drought stress" or "Creates 5 permanent jobs in rural community."',
      prompt: 'What measurable impact will this project have? Include numbers if you can.' },
    { id: 'budget', title: 'Budget / Use of Funds', type: 'fields',
      guidance: 'How much money do you need and what will you spend it on? USDA reviewers want to see that every dollar has a purpose.',
      fields: [
        { id: 'total_amount', label: 'Total funding requested ($)', type: 'text', placeholder: 'e.g., 150000' },
        { id: 'equipment', label: 'Equipment / materials', type: 'text', placeholder: 'Irrigation, sensors, machinery' },
        { id: 'seed_input', label: 'Seed / inputs / amendments', type: 'text', placeholder: 'Cover crop seed, soil amendments' },
        { id: 'labor', label: 'Labor / consulting', type: 'text', placeholder: 'Agronomist, installation labor' },
        { id: 'travel', label: 'Travel / fieldwork', type: 'text', placeholder: 'Site visits, training' },
        { id: 'indirect', label: 'Indirect / overhead rate', type: 'text', placeholder: 'e.g., 10% or negotiated rate' },
        { id: 'match', label: 'Cost share / match', type: 'text', placeholder: 'Your contribution amount' }
      ] },
    { id: 'timeline', title: 'Timeline / Milestones', type: 'textarea',
      guidance: 'When will each phase happen? Agricultural grants often align with growing seasons. Be realistic about planting windows, construction seasons, and regulatory timelines.',
      prompt: 'List major milestones with target dates. Example: Spring Y1: Soil testing. Summer Y1: Equipment install. Fall Y1: Cover crop establishment. Spring Y2: First monitored growing season.' },
    { id: 'documents', title: 'Required Documents', type: 'checklist',
      guidance: 'Most agricultural grants require supporting documents. Check each item you have ready.',
      items: ['Farm/operation capability statement', 'Budget narrative / justification', 'Letters of support (extension agent, NRCS, cooperative)', 'Resumes of key personnel', 'SAM.gov registration confirmation', 'Conservation plan (if NRCS program)', 'Soil test results (if relevant)', 'Water use permits (if irrigation project)', 'Environmental review (if applicable)', 'FSA farm records / acreage report'] },
    { id: 'review', title: 'Final Review', type: 'review',
      guidance: 'Review everything before submitting. The auditor will check completeness, coherence, and alignment with the funding opportunity.' },
    { id: 'auditor', title: 'Auditor Decision', type: 'auditor',
      guidance: 'This section is for the auditor reviewing this grant application.' }
  ];

  // ══════════════════════════════════════════════════════════════════════
  // SECTION DEFINITIONS — PATENT (Agriculture-Native)
  // ══════════════════════════════════════════════════════════════════════

  var PATENT_SECTIONS = [
    { id: 'what', title: 'What This Patent Is', type: 'info',
      guidance: 'A patent gives you the legal right to prevent others from making, using, or selling your agricultural invention for 20 years. Common agriculture patents cover seed genetics, precision agriculture systems, livestock management tools, food processing methods, and irrigation technology. A provisional patent costs ~$320 and gives you 12 months to file the full version.',
      prompt: 'No input needed — this is context for the operator.' },
    { id: 'why', title: 'Why This May Be Patentable', type: 'textarea',
      guidance: 'For something to be patentable, it must be: (1) new — nobody has done it before, (2) useful — it solves a real agricultural problem, (3) non-obvious — a person skilled in agtech would not have thought of it easily. Explain why your idea meets these three tests.',
      prompt: 'Why is this invention new, useful, and non-obvious?', prefillFrom: 'whyNow' },
    { id: 'title', title: 'Invention Title', type: 'text',
      guidance: 'A clear, descriptive title. Not a marketing name — a functional description. Example: "System and Method for Autonomous Soil Moisture-Based Irrigation Scheduling Using Multi-Depth Tensiometer Arrays"',
      prompt: 'Enter a descriptive title for the invention.', prefillFrom: 'title' },
    { id: 'summary', title: 'Invention Summary', type: 'textarea',
      guidance: 'Describe the invention in 2-4 sentences as if explaining to a smart person who is not an agriculture expert. What does it do? How does it work at a high level?',
      prompt: 'Summarize the invention in plain English.' },
    { id: 'problem_solved', title: 'Problem Being Solved', type: 'textarea',
      guidance: 'What specific agricultural problem does this invention solve? The patent examiner needs to understand why existing solutions are inadequate. Reference specific crop losses, resource waste, or efficiency gaps.',
      prompt: 'What agricultural problem exists today that this invention fixes?', prefillFrom: 'diagnosis' },
    { id: 'novelty', title: 'Novelty / What Is Different', type: 'textarea',
      guidance: 'What makes this different from everything that already exists in agriculture? Be specific. "Unlike existing drip irrigation systems that use fixed schedules, this invention dynamically adjusts flow rates based on real-time crop transpiration measurements."',
      prompt: 'What is new about this invention compared to what exists?' },
    { id: 'prior_art', title: 'Prior Art / Existing Alternatives', type: 'textarea',
      guidance: 'List anything similar that already exists — patents, commercial products, university research. The patent examiner will search for these anyway. Search patents.google.com and USDA research databases before writing this section.',
      prompt: 'List known prior art and explain how your invention differs from each.' },
    { id: 'technical', title: 'Technical Description', type: 'textarea',
      guidance: 'Describe how the invention works in enough detail that an agricultural engineer could build it. Include sensors, algorithms, mechanical components, biological processes, or chemical formulations.',
      prompt: 'Describe the technical implementation. Components, process steps, data flows.' },
    { id: 'embodiments', title: 'Embodiments / Alternative Versions', type: 'textarea',
      guidance: 'Describe at least 2-3 different ways the invention could be implemented. This broadens your patent coverage. Example: "In one embodiment, the system uses capacitive soil sensors. In another embodiment, the system uses satellite NDVI data. In a third embodiment, the system combines both with weather forecast integration."',
      prompt: 'List alternative implementations or variations of the invention.' },
    { id: 'claims', title: 'Claims Development', type: 'textarea',
      guidance: 'Claims define exactly what you own. Start with one broad claim and add narrower ones. Format: "A method for [doing X] comprising: (a) [step 1], (b) [step 2], (c) [step 3]." Your patent attorney will refine these, but drafting initial claims helps.',
      prompt: 'Draft 2-3 initial patent claims. Start broad, then narrow.' },
    { id: 'ownership', title: 'Inventorship / Ownership', type: 'fields',
      guidance: 'Who invented this? Patent law requires listing the actual inventors.',
      fields: [
        { id: 'inventor1', label: 'Inventor 1 (full legal name)', type: 'text' },
        { id: 'inventor1_role', label: 'Inventor 1 contribution', type: 'text' },
        { id: 'inventor2', label: 'Inventor 2 (if applicable)', type: 'text' },
        { id: 'assignee', label: 'Assignee (organization that owns the patent)', type: 'text', placeholder: 'LIMEN Helix Transformational Sciences LLC' },
        { id: 'filing_type', label: 'Filing type', type: 'select', options: ['Provisional (12-month placeholder)', 'Non-provisional (full filing)', 'PCT International', 'Undecided'] }
      ] },
    { id: 'documents', title: 'Documents / Diagrams', type: 'checklist',
      guidance: 'Patents benefit greatly from diagrams. Even rough sketches help the examiner and attorney understand the invention.',
      items: ['Block diagram of system architecture', 'Flowchart of method steps', 'Field layout / deployment diagram', 'Prior art comparison table', 'Data/performance charts (yield improvement, water savings)', 'Inventor declaration signed', 'Assignment agreement (if assigning to company)', 'Prior art search results printout'] },
    { id: 'review', title: 'Filing Readiness Review', type: 'review',
      guidance: 'Review everything before filing. A provisional patent is forgiving — it just needs to describe the invention. A non-provisional must be precise.' },
    { id: 'auditor', title: 'Auditor Decision', type: 'auditor',
      guidance: 'This section is for the auditor reviewing this patent filing.' }
  ];

  // ══════════════════════════════════════════════════════════════════════
  // STYLES
  // ══════════════════════════════════════════════════════════════════════

  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.eep-panel{margin-top:8px;border:1px solid rgba(90,181,160,0.08);border-radius:3px;background:rgba(5,8,16,0.5)}',
      '.eep-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer;user-select:none}',
      '.eep-header:hover{background:rgba(90,181,160,0.03)}',
      '.eep-track-label{font-size:0.32rem;letter-spacing:2px;text-transform:uppercase}',
      '.eep-track-grant{color:#5ab5a0}',
      '.eep-track-patent{color:#a87adb}',
      '.eep-progress{font-size:0.26rem;color:#807868}',
      '.eep-toggle{font-size:0.22rem;color:rgba(90,181,160,0.25)}',
      '.eep-body{display:none;padding:0 12px 12px}',
      '.eep-body.open{display:block}',
      '.eep-section{margin-bottom:12px;border-bottom:1px solid rgba(90,181,160,0.04);padding-bottom:8px}',
      '.eep-section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}',
      '.eep-section-title{font-size:0.34rem;color:rgba(90,181,160,0.85);letter-spacing:1.5px;font-weight:600}',
      '.eep-section-check{font-size:0.24rem}',
      '.eep-guidance{font-size:0.32rem;color:#908878;line-height:1.5;margin-bottom:6px;padding:4px 8px;border-left:2px solid rgba(90,181,160,0.08);background:rgba(0,0,0,0.1)}',
      '.eep-textarea{width:100%;min-height:60px;padding:6px 8px;background:#0a0c14;border:1px solid rgba(90,181,160,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.38rem;resize:vertical}',
      '.eep-textarea:focus{border-color:rgba(90,181,160,0.3);outline:none}',
      '.eep-input{width:100%;padding:4px 8px;background:#0a0c14;border:1px solid rgba(90,181,160,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.36rem}',
      '.eep-input:focus{border-color:rgba(90,181,160,0.3);outline:none}',
      '.eep-select{padding:4px 8px;background:#0a0c14;border:1px solid rgba(90,181,160,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.36rem}',
      '.eep-field{margin-bottom:6px}',
      '.eep-field-label{font-size:0.30rem;color:#908878;margin-bottom:2px;display:block}',
      '.eep-check-item{display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.34rem;color:#b0a898;cursor:pointer}',
      '.eep-check-item input{accent-color:#5ab5a0}',
      '.eep-auditor{padding:8px;border:1px solid rgba(90,181,160,0.12);border-radius:3px;background:rgba(90,181,160,0.02)}',
      '.eep-auditor-title{font-size:0.28rem;letter-spacing:2px;color:rgba(90,181,160,0.4);margin-bottom:6px}',
      '.eep-auditor-btns{display:flex;gap:4px;margin-top:6px}',
      '.eep-btn{font-family:inherit;font-size:0.28rem;letter-spacing:1px;padding:3px 10px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid}',
      '.eep-btn-approve{color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.04)}',
      '.eep-btn-deny{color:#e85454;border-color:rgba(232,84,84,0.3);background:rgba(232,84,84,0.04)}',
      '.eep-btn-revise{color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.04)}',
      '.eep-btn-print{color:#4a8fd4;border-color:rgba(74,143,212,0.3);background:rgba(74,143,212,0.04)}',
      '.eep-status{font-size:0.26rem;letter-spacing:1px;padding:2px 6px;border-radius:2px;display:inline-block}',
      '.eep-status-draft{color:#807868;border:1px solid rgba(128,120,104,0.2)}',
      '.eep-status-review{color:#C9A94E;border:1px solid rgba(201,169,78,0.2)}',
      '.eep-status-approved{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)}',
      '.eep-status-denied{color:#e85454;border:1px solid rgba(232,84,84,0.2)}',
      '.eep-status-revise{color:#C9A94E;border:1px solid rgba(201,169,78,0.2)}',
      '@media print{.eep-guidance{border-left:1px solid #ccc}.eep-panel{border:1px solid #ddd;break-inside:avoid}.eep-btn,.eep-auditor-btns,.eep-toggle,.eep-header{cursor:default}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER SECTIONS
  // ══════════════════════════════════════════════════════════════════════

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function renderSection(sec, ws, oppKey, track) {
    var val = (ws.fields && ws.fields[sec.id]) || '';
    var checked = (ws.checks && ws.checks[sec.id]) || {};
    var sectionDone = ws.sectionDone && ws.sectionDone[sec.id];

    var h = '<div class="eep-section" data-section="' + sec.id + '">';
    h += '<div class="eep-section-header">';
    h += '<span class="eep-section-title">' + (sectionDone ? '\u2713 ' : '') + esc(sec.title) + '</span>';
    if (sec.type !== 'info') {
      h += '<label class="eep-section-check"><input type="checkbox" class="eep-done-check" data-sec="' + sec.id + '"' + (sectionDone ? ' checked' : '') + '> done</label>';
    }
    h += '</div>';
    h += '<div class="eep-guidance">' + esc(sec.guidance) + '</div>';

    if (sec.type === 'textarea') {
      if (sec.prompt) h += '<div style="font-size:0.28rem;color:#706860;margin-bottom:3px">' + esc(sec.prompt) + '</div>';
      h += '<textarea class="eep-textarea" data-field="' + sec.id + '">' + esc(val) + '</textarea>';
    } else if (sec.type === 'text') {
      if (sec.prompt) h += '<div style="font-size:0.28rem;color:#706860;margin-bottom:3px">' + esc(sec.prompt) + '</div>';
      h += '<input class="eep-input" type="text" data-field="' + sec.id + '" value="' + esc(val) + '">';
    } else if (sec.type === 'fields') {
      var fieldVals = typeof val === 'object' ? val : {};
      for (var fi = 0; fi < sec.fields.length; fi++) {
        var f = sec.fields[fi];
        var fv = fieldVals[f.id] || '';
        h += '<div class="eep-field">';
        h += '<label class="eep-field-label">' + esc(f.label) + '</label>';
        if (f.type === 'select') {
          h += '<select class="eep-select" data-field="' + sec.id + '.' + f.id + '">';
          for (var oi = 0; oi < f.options.length; oi++) {
            h += '<option' + (fv === f.options[oi] ? ' selected' : '') + '>' + esc(f.options[oi]) + '</option>';
          }
          h += '</select>';
        } else {
          h += '<input class="eep-input" type="text" data-field="' + sec.id + '.' + f.id + '" value="' + esc(fv) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
        }
        h += '</div>';
      }
    } else if (sec.type === 'checklist') {
      for (var ci = 0; ci < sec.items.length; ci++) {
        var itemKey = 'item_' + ci;
        h += '<label class="eep-check-item"><input type="checkbox" class="eep-check" data-sec="' + sec.id + '" data-item="' + itemKey + '"' + (checked[itemKey] ? ' checked' : '') + '> ' + esc(sec.items[ci]) + '</label>';
      }
    } else if (sec.type === 'review') {
      var totalSections = 0, doneSections = 0;
      var sections = track === 'grant' ? GRANT_SECTIONS : PATENT_SECTIONS;
      for (var ri = 0; ri < sections.length; ri++) {
        if (sections[ri].type !== 'info' && sections[ri].type !== 'review' && sections[ri].type !== 'auditor') {
          totalSections++;
          if (ws.sectionDone && ws.sectionDone[sections[ri].id]) doneSections++;
        }
      }
      var pct = totalSections > 0 ? Math.round(doneSections / totalSections * 100) : 0;
      h += '<div style="font-size:0.38rem;color:#d0c8b8;margin-bottom:6px">Progress: <b>' + doneSections + '/' + totalSections + '</b> sections complete (' + pct + '%)</div>';
      h += '<div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:' + pct + '%;background:' + (pct >= 80 ? '#5ab5a0' : pct >= 50 ? '#C9A94E' : '#e85454') + ';border-radius:3px;transition:width 0.3s"></div></div>';
      if (pct < 100) {
        h += '<div style="font-size:0.30rem;color:#C9A94E">Missing sections:</div>';
        for (var mi = 0; mi < sections.length; mi++) {
          if (sections[mi].type !== 'info' && sections[mi].type !== 'review' && sections[mi].type !== 'auditor' && !(ws.sectionDone && ws.sectionDone[sections[mi].id])) {
            h += '<div style="font-size:0.28rem;color:#908878">\u2022 ' + esc(sections[mi].title) + '</div>';
          }
        }
      }
      h += '<div style="margin-top:8px"><button class="eep-btn eep-btn-print" data-action="print">PRINT APPLICATION</button></div>';
    } else if (sec.type === 'auditor') {
      var auditorState = ws.auditor || {};
      h += '<div class="eep-auditor">';
      h += '<div class="eep-auditor-title">AUDITOR REVIEW</div>';
      var statusLabel = auditorState.status || 'DRAFT';
      var statusCls = 'eep-status-' + statusLabel.toLowerCase();
      h += '<div style="margin-bottom:6px"><span class="eep-status ' + statusCls + '">' + statusLabel + '</span></div>';
      h += '<div class="eep-field"><label class="eep-field-label">Auditor comments</label><textarea class="eep-textarea" data-auditor="comments" style="min-height:40px">' + esc(auditorState.comments || '') + '</textarea></div>';
      if (auditorState.status === 'DENIED') {
        h += '<div class="eep-field"><label class="eep-field-label">Denial reason</label><textarea class="eep-textarea" data-auditor="denial_reason" style="min-height:30px">' + esc(auditorState.denial_reason || '') + '</textarea></div>';
      }
      if (auditorState.status === 'REVISE') {
        h += '<div class="eep-field"><label class="eep-field-label">Required revisions</label><textarea class="eep-textarea" data-auditor="revisions" style="min-height:30px">' + esc(auditorState.revisions || '') + '</textarea></div>';
      }
      h += '<div class="eep-auditor-btns">';
      h += '<button class="eep-btn eep-btn-approve" data-action="approve">APPROVE</button>';
      h += '<button class="eep-btn eep-btn-deny" data-action="deny">DENY</button>';
      h += '<button class="eep-btn eep-btn-revise" data-action="revise">NEEDS REVISION</button>';
      h += '</div>';
      if (auditorState.timestamp) {
        h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(auditorState.timestamp).toLocaleString() + '</div>';
      }
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER FULL PANEL
  // ══════════════════════════════════════════════════════════════════════

  function renderPanel(oppKey, track, opp) {
    injectStyles();
    var ws = getWorkspace(oppKey, track) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    var sections = track === 'grant' ? GRANT_SECTIONS : PATENT_SECTIONS;
    var trackColor = track === 'grant' ? 'eep-track-grant' : 'eep-track-patent';
    var trackLabel = track === 'grant' ? 'GRANT APPLICATION' : 'PATENT FILING';

    if (!ws._prefilled && opp) {
      ws._prefilled = true;
      for (var si = 0; si < sections.length; si++) {
        var sec = sections[si];
        if (sec.prefillFrom && !ws.fields[sec.id]) {
          if (sec.prefillFrom === 'title') ws.fields[sec.id] = opp.title || '';
          if (sec.prefillFrom === 'whyNow') ws.fields[sec.id] = (opp.title || '') + '. This Agriculture condition creates demand because: ' + (opp.reason || opp.whyNow || 'active diagnosis pathway detected.');
          if (sec.prefillFrom === 'diagnosis') ws.fields[sec.id] = 'Agriculture domain diagnosis: ' + (opp.diagnosisId || 'active').replace(/_/g, ' ') + '. ' + (opp.title || '');
        }
      }
      saveWorkspace(oppKey, track, ws);
    }

    var totalSections = 0, doneSections = 0;
    for (var pi = 0; pi < sections.length; pi++) {
      if (sections[pi].type !== 'info' && sections[pi].type !== 'review' && sections[pi].type !== 'auditor') {
        totalSections++;
        if (ws.sectionDone && ws.sectionDone[sections[pi].id]) doneSections++;
      }
    }
    var pct = totalSections > 0 ? Math.round(doneSections / totalSections * 100) : 0;
    var statusLabel = ws.auditor && ws.auditor.status ? ws.auditor.status : 'DRAFT';

    var h = '<div class="eep-panel" data-opp="' + esc(oppKey) + '" data-track="' + track + '">';
    h += '<div class="eep-header" data-toggle="' + oppKey + '-' + track + '">';
    h += '<span class="eep-track-label ' + trackColor + '">' + trackLabel + '</span>';
    h += '<span class="eep-progress">' + pct + '% complete \u00b7 ' + doneSections + '/' + totalSections + ' \u00b7 <span class="eep-status eep-status-' + statusLabel.toLowerCase() + '">' + statusLabel + '</span></span>';
    h += '<span class="eep-toggle">\u25BC</span>';
    h += '</div>';
    h += '<div class="eep-body" data-body="' + oppKey + '-' + track + '">';

    for (var ri = 0; ri < sections.length; ri++) {
      h += renderSection(sections[ri], ws, oppKey, track);
    }

    h += '</div></div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // EVENT WIRING
  // ══════════════════════════════════════════════════════════════════════

  function wirePanel(container, oppKey, track) {
    var panel = container.querySelector('[data-opp="' + oppKey + '"][data-track="' + track + '"]');
    if (!panel) return;

    var header = panel.querySelector('[data-toggle="' + oppKey + '-' + track + '"]');
    var body = panel.querySelector('[data-body="' + oppKey + '-' + track + '"]');
    if (header && body) {
      header.addEventListener('click', function () {
        body.classList.toggle('open');
        var toggle = header.querySelector('.eep-toggle');
        if (toggle) toggle.textContent = body.classList.contains('open') ? '\u25B2' : '\u25BC';
      });
    }

    var ws = getWorkspace(oppKey, track) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };

    panel.querySelectorAll('.eep-textarea, .eep-input, .eep-select').forEach(function (el) {
      el.addEventListener('change', function () {
        var field = this.getAttribute('data-field');
        var auditorField = this.getAttribute('data-auditor');
        if (field) {
          if (field.indexOf('.') !== -1) {
            var parts = field.split('.');
            if (typeof ws.fields[parts[0]] !== 'object') ws.fields[parts[0]] = {};
            ws.fields[parts[0]][parts[1]] = this.value;
          } else {
            ws.fields[field] = this.value;
          }
        }
        if (auditorField) {
          if (!ws.auditor) ws.auditor = {};
          ws.auditor[auditorField] = this.value;
        }
        saveWorkspace(oppKey, track, ws);
      });
    });

    panel.querySelectorAll('.eep-check').forEach(function (el) {
      el.addEventListener('change', function () {
        var sec = this.getAttribute('data-sec');
        var item = this.getAttribute('data-item');
        if (!ws.checks[sec]) ws.checks[sec] = {};
        ws.checks[sec][item] = this.checked;
        saveWorkspace(oppKey, track, ws);
      });
    });

    panel.querySelectorAll('.eep-done-check').forEach(function (el) {
      el.addEventListener('change', function () {
        var sec = this.getAttribute('data-sec');
        if (!ws.sectionDone) ws.sectionDone = {};
        ws.sectionDone[sec] = this.checked;
        saveWorkspace(oppKey, track, ws);
      });
    });

    panel.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        if (action === 'approve') { ws.auditor = ws.auditor || {}; ws.auditor.status = 'APPROVED'; ws.auditor.timestamp = Date.now(); }
        if (action === 'deny') { ws.auditor = ws.auditor || {}; ws.auditor.status = 'DENIED'; ws.auditor.timestamp = Date.now(); }
        if (action === 'revise') { ws.auditor = ws.auditor || {}; ws.auditor.status = 'REVISE'; ws.auditor.timestamp = Date.now(); }
        if (action === 'print') { window.print(); return; }
        saveWorkspace(oppKey, track, ws);
        var newHtml = renderPanel(oppKey, track, null);
        panel.outerHTML = newHtml;
        wirePanel(container, oppKey, track);
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  function renderForOpportunity(oppKey, path, opp) {
    if (path === 'GRANT-ELIGIBLE') return renderPanel(oppKey, 'grant', opp);
    if (path === 'PATENTABLE') return renderPanel(oppKey, 'patent', opp);
    return '';
  }

  function wireForOpportunity(container, oppKey, path) {
    if (path === 'GRANT-ELIGIBLE') wirePanel(container, oppKey, 'grant');
    if (path === 'PATENTABLE') wirePanel(container, oppKey, 'patent');
  }

  window.LIMENAgricultureExecutionPanels = {
    renderForOpportunity: renderForOpportunity,
    wireForOpportunity: wireForOpportunity,
    GRANT_SECTIONS: GRANT_SECTIONS,
    PATENT_SECTIONS: PATENT_SECTIONS
  };

  console.log('[AgricultureExecutionPanels] Loaded — GRANT + PATENT workspaces ready');

})();
