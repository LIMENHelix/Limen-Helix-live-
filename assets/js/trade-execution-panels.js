/**
 * trade-execution-panels.js — GRANT and PATENT Execution Workspaces
 *
 * Trade domain only. Expandable workflow panels for each opportunity.
 * Operator can build a full grant application or patent packet in-portal.
 * Auditor can review and accept/deny.
 *
 * Self-gates: only runs when ?domain=supplyChain or ?domain=trade
 * Exposes: window.LIMENTradeExecutionPanels
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isTradeDomain = _dom === 'supplyChain' || _dom === 'trade';
  var isTradeWorkspace = window.location.pathname.indexOf('trade-workspace') !== -1;
  if (!isTradeDomain && !isTradeWorkspace) return;

  var STORE_KEY = 'limen_trade_exec_panels';
  var _stylesInjected = false;

  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAll(data) { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {} }
  function getWorkspace(oppKey, track) { var all = loadAll(); return (all[oppKey] && all[oppKey][track]) || null; }
  function saveWorkspace(oppKey, track, workspace) { var all = loadAll(); if (!all[oppKey]) all[oppKey] = {}; all[oppKey][track] = workspace; saveAll(all); }

  var GRANT_SECTIONS = [
    { id: 'what', title: 'What This Grant Is', type: 'info', guidance: 'A grant is free money from a government agency or foundation to fund a specific project. You do not pay it back. In exchange, you deliver the project you promised.', prompt: 'No input needed — this is context for the operator.' },
    { id: 'why', title: 'Why This Opportunity Qualifies', type: 'textarea', guidance: 'Explain in plain English why this Trade/Supply Chain opportunity is a good fit for grant funding. Think about: Is there a public benefit? Does it address port infrastructure, freight resilience, or trade security?', prompt: 'Write 2-3 sentences explaining why this opportunity deserves grant funding.', prefillFrom: 'whyNow' },
    { id: 'eligibility', title: 'Eligibility', type: 'checklist', guidance: 'Grant programs have rules about who can apply. Check each item that applies to your organization.', items: ['Organization is a registered US entity', 'Organization has a DUNS/UEI number', 'Organization is registered on SAM.gov', 'No debarment or exclusion status', 'Meets small business size standard (if SBA)', 'Can provide cost-share or match if required', 'Has financial management systems in place'] },
    { id: 'applicant', title: 'Applicant Profile', type: 'fields', guidance: 'Basic information about who is applying.', fields: [{ id: 'org_name', label: 'Organization name', type: 'text', placeholder: 'LIMEN Helix Transformational Sciences LLC' }, { id: 'org_type', label: 'Organization type', type: 'select', options: ['For-profit', 'Non-profit', 'Government', 'University', 'Individual', 'Other'] }, { id: 'uei', label: 'UEI / DUNS number', type: 'text', placeholder: 'e.g., ABC123456789' }, { id: 'contact_name', label: 'Primary contact', type: 'text' }, { id: 'contact_email', label: 'Contact email', type: 'text' }, { id: 'contact_phone', label: 'Contact phone', type: 'text' }] },
    { id: 'problem', title: 'Need / Problem Statement', type: 'textarea', guidance: 'What supply chain or trade problem does this project solve? Be specific. Use real data if you have it.', prompt: 'Describe the trade/logistics problem this project addresses. What happens if nothing is done?', prefillFrom: 'diagnosis' },
    { id: 'solution', title: 'Proposed Project / Solution', type: 'textarea', guidance: 'What will you actually build or do? Be concrete.', prompt: 'Describe what you will build, deploy, or implement. Be specific about deliverables.' },
    { id: 'impact', title: 'Impact / Expected Outcomes', type: 'textarea', guidance: 'What changes because of this project? Quantify if possible.', prompt: 'What measurable impact will this project have? Include numbers if you can.' },
    { id: 'budget', title: 'Budget / Use of Funds', type: 'fields', guidance: 'How much money do you need and what will you spend it on?', fields: [{ id: 'total_amount', label: 'Total funding requested ($)', type: 'text', placeholder: 'e.g., 250000' }, { id: 'personnel', label: 'Personnel costs', type: 'text', placeholder: 'Salaries, benefits, contractors' }, { id: 'equipment', label: 'Equipment / materials', type: 'text', placeholder: 'Hardware, software, supplies' }, { id: 'travel', label: 'Travel / fieldwork', type: 'text', placeholder: 'Site visits, conferences' }, { id: 'indirect', label: 'Indirect / overhead rate', type: 'text', placeholder: 'e.g., 15% or negotiated rate' }, { id: 'match', label: 'Cost share / match (if required)', type: 'text', placeholder: 'Your contribution amount' }] },
    { id: 'timeline', title: 'Timeline / Milestones', type: 'textarea', guidance: 'When will each phase of the project happen?', prompt: 'List major milestones with target dates.' },
    { id: 'documents', title: 'Required Documents', type: 'checklist', guidance: 'Most grants require supporting documents. Check each item you have ready.', items: ['Organizational capability statement', 'Budget narrative / justification', 'Letters of support', 'Resumes of key personnel', 'SAM.gov registration confirmation', 'Financial audit (if required)', 'Environmental review (if applicable)', 'Data management plan (if applicable)'] },
    { id: 'review', title: 'Final Review', type: 'review', guidance: 'Review everything before submitting.' },
    { id: 'auditor', title: 'Auditor Decision', type: 'auditor', guidance: 'This section is for the auditor reviewing this grant application.' }
  ];

  var PATENT_SECTIONS = [
    { id: 'what', title: 'What This Patent Is', type: 'info', guidance: 'A patent gives you the legal right to prevent others from making, using, or selling your invention for 20 years. A provisional patent costs ~$320 and gives you 12 months to file the full version.', prompt: 'No input needed — this is context for the operator.' },
    { id: 'why', title: 'Why This May Be Patentable', type: 'textarea', guidance: 'For something to be patentable, it must be: (1) new, (2) useful, (3) non-obvious. Explain why your idea meets these three tests.', prompt: 'Why is this invention new, useful, and non-obvious?', prefillFrom: 'whyNow' },
    { id: 'title', title: 'Invention Title', type: 'text', guidance: 'A clear, descriptive title. Example: "System and Method for Real-Time Freight Route Optimization Using Congestion Prediction"', prompt: 'Enter a descriptive title for the invention.', prefillFrom: 'title' },
    { id: 'summary', title: 'Invention Summary', type: 'textarea', guidance: 'Describe the invention in 2-4 sentences as if explaining to a smart person who is not an expert.', prompt: 'Summarize the invention in plain English.' },
    { id: 'problem_solved', title: 'Problem Being Solved', type: 'textarea', guidance: 'What specific problem does this invention solve?', prompt: 'What problem exists today that this invention fixes?', prefillFrom: 'diagnosis' },
    { id: 'novelty', title: 'Novelty / What Is Different', type: 'textarea', guidance: 'What makes this different from everything that already exists?', prompt: 'What is new about this invention compared to what exists?' },
    { id: 'prior_art', title: 'Prior Art / Existing Alternatives', type: 'textarea', guidance: 'List anything similar that already exists. Search patents.google.com before writing this section.', prompt: 'List known prior art and explain how your invention differs from each.' },
    { id: 'technical', title: 'Technical Description', type: 'textarea', guidance: 'Describe how the invention works in enough detail that someone skilled in the field could build it.', prompt: 'Describe the technical implementation. Components, process steps, data flows.' },
    { id: 'embodiments', title: 'Embodiments / Alternative Versions', type: 'textarea', guidance: 'Describe at least 2-3 different ways the invention could be implemented.', prompt: 'List alternative implementations or variations of the invention.' },
    { id: 'claims', title: 'Claims Development', type: 'textarea', guidance: 'Claims define exactly what you own. Start with one broad claim and add narrower ones.', prompt: 'Draft 2-3 initial patent claims. Start broad, then narrow.' },
    { id: 'ownership', title: 'Inventorship / Ownership', type: 'fields', guidance: 'Who invented this? Patent law requires listing the actual inventors.', fields: [{ id: 'inventor1', label: 'Inventor 1 (full legal name)', type: 'text' }, { id: 'inventor1_role', label: 'Inventor 1 contribution', type: 'text' }, { id: 'inventor2', label: 'Inventor 2 (if applicable)', type: 'text' }, { id: 'assignee', label: 'Assignee (organization that owns the patent)', type: 'text', placeholder: 'LIMEN Helix Transformational Sciences LLC' }, { id: 'filing_type', label: 'Filing type', type: 'select', options: ['Provisional (12-month placeholder)', 'Non-provisional (full filing)', 'PCT International', 'Undecided'] }] },
    { id: 'documents', title: 'Documents / Diagrams', type: 'checklist', guidance: 'Patents benefit greatly from diagrams.', items: ['Block diagram of system architecture', 'Flowchart of method steps', 'Prior art comparison table', 'Data/performance charts (if available)', 'Inventor declaration signed', 'Assignment agreement (if assigning to company)', 'Prior art search results printout'] },
    { id: 'review', title: 'Filing Readiness Review', type: 'review', guidance: 'Review everything before filing.' },
    { id: 'auditor', title: 'Auditor Decision', type: 'auditor', guidance: 'This section is for the auditor reviewing this patent filing.' }
  ];

  function injectStyles() {
    if (_stylesInjected) return; _stylesInjected = true;
    var s = document.createElement('style'); s.textContent = [
      '.eep-panel{margin-top:8px;border:1px solid rgba(201,169,78,0.08);border-radius:3px;background:rgba(5,8,16,0.5)}',
      '.eep-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer;user-select:none}',
      '.eep-header:hover{background:rgba(201,169,78,0.03)}',
      '.eep-track-label{font-size:0.32rem;letter-spacing:2px;text-transform:uppercase}',
      '.eep-track-grant{color:#5ab5a0}','.eep-track-patent{color:#a87adb}',
      '.eep-progress{font-size:0.26rem;color:#807868}','.eep-toggle{font-size:0.22rem;color:rgba(201,169,78,0.25)}',
      '.eep-body{display:none;padding:0 12px 12px}','.eep-body.open{display:block}',
      '.eep-section{margin-bottom:12px;border-bottom:1px solid rgba(201,169,78,0.04);padding-bottom:8px}',
      '.eep-section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}',
      '.eep-section-title{font-size:0.34rem;color:rgba(201,169,78,0.85);letter-spacing:1.5px;font-weight:600}',
      '.eep-section-check{font-size:0.24rem}',
      '.eep-guidance{font-size:0.32rem;color:#908878;line-height:1.5;margin-bottom:6px;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.08);background:rgba(0,0,0,0.1)}',
      '.eep-textarea{width:100%;min-height:60px;padding:6px 8px;background:#0a0c14;border:1px solid rgba(201,169,78,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.38rem;resize:vertical}',
      '.eep-textarea:focus{border-color:rgba(201,169,78,0.3);outline:none}',
      '.eep-input{width:100%;padding:4px 8px;background:#0a0c14;border:1px solid rgba(201,169,78,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.36rem}',
      '.eep-input:focus{border-color:rgba(201,169,78,0.3);outline:none}',
      '.eep-select{padding:4px 8px;background:#0a0c14;border:1px solid rgba(201,169,78,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.36rem}',
      '.eep-field{margin-bottom:6px}','.eep-field-label{font-size:0.30rem;color:#908878;margin-bottom:2px;display:block}',
      '.eep-check-item{display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.34rem;color:#b0a898;cursor:pointer}',
      '.eep-check-item input{accent-color:#C9A94E}',
      '.eep-auditor{padding:8px;border:1px solid rgba(201,169,78,0.12);border-radius:3px;background:rgba(201,169,78,0.02)}',
      '.eep-auditor-title{font-size:0.28rem;letter-spacing:2px;color:rgba(201,169,78,0.4);margin-bottom:6px}',
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
      '.eep-status-revise{color:#C9A94E;border:1px solid rgba(201,169,78,0.2)}'
    ].join('\n'); document.head.appendChild(s);
  }

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function renderSection(sec, ws, oppKey, track) {
    var val = (ws.fields && ws.fields[sec.id]) || '';
    var checked = (ws.checks && ws.checks[sec.id]) || {};
    var sectionDone = ws.sectionDone && ws.sectionDone[sec.id];
    var h = '<div class="eep-section" data-section="' + sec.id + '">';
    h += '<div class="eep-section-header"><span class="eep-section-title">' + (sectionDone ? '\u2713 ' : '') + esc(sec.title) + '</span>';
    if (sec.type !== 'info') h += '<label class="eep-section-check"><input type="checkbox" class="eep-done-check" data-sec="' + sec.id + '"' + (sectionDone ? ' checked' : '') + '> done</label>';
    h += '</div><div class="eep-guidance">' + esc(sec.guidance) + '</div>';
    if (sec.type === 'textarea') {
      if (sec.prompt) h += '<div style="font-size:0.28rem;color:#706860;margin-bottom:3px">' + esc(sec.prompt) + '</div>';
      h += '<textarea class="eep-textarea" data-field="' + sec.id + '">' + esc(val) + '</textarea>';
    } else if (sec.type === 'text') {
      if (sec.prompt) h += '<div style="font-size:0.28rem;color:#706860;margin-bottom:3px">' + esc(sec.prompt) + '</div>';
      h += '<input class="eep-input" type="text" data-field="' + sec.id + '" value="' + esc(val) + '">';
    } else if (sec.type === 'fields') {
      var fieldVals = typeof val === 'object' ? val : {};
      for (var fi = 0; fi < sec.fields.length; fi++) { var f = sec.fields[fi]; var fv = fieldVals[f.id] || '';
        h += '<div class="eep-field"><label class="eep-field-label">' + esc(f.label) + '</label>';
        if (f.type === 'select') { h += '<select class="eep-select" data-field="' + sec.id + '.' + f.id + '">'; for (var oi = 0; oi < f.options.length; oi++) h += '<option' + (fv === f.options[oi] ? ' selected' : '') + '>' + esc(f.options[oi]) + '</option>'; h += '</select>'; }
        else h += '<input class="eep-input" type="text" data-field="' + sec.id + '.' + f.id + '" value="' + esc(fv) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
        h += '</div>'; }
    } else if (sec.type === 'checklist') {
      for (var ci = 0; ci < sec.items.length; ci++) { var ik = 'item_' + ci; h += '<label class="eep-check-item"><input type="checkbox" class="eep-check" data-sec="' + sec.id + '" data-item="' + ik + '"' + (checked[ik] ? ' checked' : '') + '> ' + esc(sec.items[ci]) + '</label>'; }
    } else if (sec.type === 'review') {
      var sections = track === 'grant' ? GRANT_SECTIONS : PATENT_SECTIONS; var ts = 0, ds = 0;
      for (var ri = 0; ri < sections.length; ri++) { if (sections[ri].type !== 'info' && sections[ri].type !== 'review' && sections[ri].type !== 'auditor') { ts++; if (ws.sectionDone && ws.sectionDone[sections[ri].id]) ds++; } }
      var pct = ts > 0 ? Math.round(ds / ts * 100) : 0;
      h += '<div style="font-size:0.38rem;color:#d0c8b8;margin-bottom:6px">Progress: <b>' + ds + '/' + ts + '</b> (' + pct + '%)</div>';
      h += '<div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:' + pct + '%;background:' + (pct >= 80 ? '#5ab5a0' : pct >= 50 ? '#C9A94E' : '#e85454') + ';border-radius:3px"></div></div>';
      if (pct < 100) { h += '<div style="font-size:0.30rem;color:#C9A94E">Missing:</div>'; for (var mi = 0; mi < sections.length; mi++) { if (sections[mi].type !== 'info' && sections[mi].type !== 'review' && sections[mi].type !== 'auditor' && !(ws.sectionDone && ws.sectionDone[sections[mi].id])) h += '<div style="font-size:0.28rem;color:#908878">\u2022 ' + esc(sections[mi].title) + '</div>'; } }
      h += '<div style="margin-top:8px"><button class="eep-btn eep-btn-print" data-action="print">PRINT APPLICATION</button></div>';
    } else if (sec.type === 'auditor') {
      var as = ws.auditor || {}; h += '<div class="eep-auditor"><div class="eep-auditor-title">AUDITOR REVIEW</div>';
      var sl = as.status || 'DRAFT'; h += '<div style="margin-bottom:6px"><span class="eep-status eep-status-' + sl.toLowerCase() + '">' + sl + '</span></div>';
      h += '<div class="eep-field"><label class="eep-field-label">Auditor comments</label><textarea class="eep-textarea" data-auditor="comments" style="min-height:40px">' + esc(as.comments || '') + '</textarea></div>';
      if (as.status === 'DENIED') h += '<div class="eep-field"><label class="eep-field-label">Denial reason</label><textarea class="eep-textarea" data-auditor="denial_reason" style="min-height:30px">' + esc(as.denial_reason || '') + '</textarea></div>';
      if (as.status === 'REVISE') h += '<div class="eep-field"><label class="eep-field-label">Required revisions</label><textarea class="eep-textarea" data-auditor="revisions" style="min-height:30px">' + esc(as.revisions || '') + '</textarea></div>';
      h += '<div class="eep-auditor-btns"><button class="eep-btn eep-btn-approve" data-action="approve">APPROVE</button><button class="eep-btn eep-btn-deny" data-action="deny">DENY</button><button class="eep-btn eep-btn-revise" data-action="revise">NEEDS REVISION</button></div>';
      if (as.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(as.timestamp).toLocaleString() + '</div>';
      h += '</div>';
    }
    h += '</div>'; return h;
  }

  function renderPanel(oppKey, track, opp) {
    injectStyles();
    var ws = getWorkspace(oppKey, track) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    var sections = track === 'grant' ? GRANT_SECTIONS : PATENT_SECTIONS;
    var trackColor = track === 'grant' ? 'eep-track-grant' : 'eep-track-patent';
    var trackLabel = track === 'grant' ? 'GRANT APPLICATION' : 'PATENT FILING';
    if (!ws._prefilled && opp) {
      ws._prefilled = true;
      for (var si = 0; si < sections.length; si++) { var sec = sections[si];
        if (sec.prefillFrom && !ws.fields[sec.id]) {
          if (sec.prefillFrom === 'title') ws.fields[sec.id] = opp.title || '';
          if (sec.prefillFrom === 'whyNow') ws.fields[sec.id] = (opp.title || '') + '. This Trade condition creates demand because: ' + (opp.reason || opp.whyNow || 'active diagnosis pathway detected.');
          if (sec.prefillFrom === 'diagnosis') ws.fields[sec.id] = 'Trade domain diagnosis: ' + (opp.diagnosisId || 'active').replace(/_/g, ' ') + '. ' + (opp.title || '');
        }
      }
      saveWorkspace(oppKey, track, ws);
    }
    var ts = 0, ds = 0;
    for (var pi = 0; pi < sections.length; pi++) { if (sections[pi].type !== 'info' && sections[pi].type !== 'review' && sections[pi].type !== 'auditor') { ts++; if (ws.sectionDone && ws.sectionDone[sections[pi].id]) ds++; } }
    var pct = ts > 0 ? Math.round(ds / ts * 100) : 0;
    var statusLabel = ws.auditor && ws.auditor.status ? ws.auditor.status : 'DRAFT';
    var h = '<div class="eep-panel" data-opp="' + esc(oppKey) + '" data-track="' + track + '">';
    h += '<div class="eep-header" data-toggle="' + oppKey + '-' + track + '"><span class="eep-track-label ' + trackColor + '">' + trackLabel + '</span>';
    h += '<span class="eep-progress">' + pct + '% \u00b7 ' + ds + '/' + ts + ' \u00b7 <span class="eep-status eep-status-' + statusLabel.toLowerCase() + '">' + statusLabel + '</span></span>';
    h += '<span class="eep-toggle">\u25BC</span></div>';
    h += '<div class="eep-body" data-body="' + oppKey + '-' + track + '">';
    for (var ri = 0; ri < sections.length; ri++) h += renderSection(sections[ri], ws, oppKey, track);
    h += '</div></div>'; return h;
  }

  function wirePanel(container, oppKey, track) {
    var panel = container.querySelector('[data-opp="' + oppKey + '"][data-track="' + track + '"]'); if (!panel) return;
    var header = panel.querySelector('[data-toggle="' + oppKey + '-' + track + '"]');
    var body = panel.querySelector('[data-body="' + oppKey + '-' + track + '"]');
    if (header && body) { header.addEventListener('click', function () { body.classList.toggle('open'); var t = header.querySelector('.eep-toggle'); if (t) t.textContent = body.classList.contains('open') ? '\u25B2' : '\u25BC'; }); }
    var ws = getWorkspace(oppKey, track) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    panel.querySelectorAll('.eep-textarea, .eep-input, .eep-select').forEach(function (el) {
      el.addEventListener('change', function () { var field = this.getAttribute('data-field'); var af = this.getAttribute('data-auditor');
        if (field) { if (field.indexOf('.') !== -1) { var p = field.split('.'); if (typeof ws.fields[p[0]] !== 'object') ws.fields[p[0]] = {}; ws.fields[p[0]][p[1]] = this.value; } else ws.fields[field] = this.value; }
        if (af) { if (!ws.auditor) ws.auditor = {}; ws.auditor[af] = this.value; }
        saveWorkspace(oppKey, track, ws); }); });
    panel.querySelectorAll('.eep-check').forEach(function (el) { el.addEventListener('change', function () { var sec = this.getAttribute('data-sec'); var item = this.getAttribute('data-item'); if (!ws.checks[sec]) ws.checks[sec] = {}; ws.checks[sec][item] = this.checked; saveWorkspace(oppKey, track, ws); }); });
    panel.querySelectorAll('.eep-done-check').forEach(function (el) { el.addEventListener('change', function () { var sec = this.getAttribute('data-sec'); if (!ws.sectionDone) ws.sectionDone = {}; ws.sectionDone[sec] = this.checked; saveWorkspace(oppKey, track, ws); }); });
    panel.querySelectorAll('[data-action]').forEach(function (el) { el.addEventListener('click', function () { var action = this.getAttribute('data-action');
      if (action === 'approve') { ws.auditor = ws.auditor || {}; ws.auditor.status = 'APPROVED'; ws.auditor.timestamp = Date.now(); }
      if (action === 'deny') { ws.auditor = ws.auditor || {}; ws.auditor.status = 'DENIED'; ws.auditor.timestamp = Date.now(); }
      if (action === 'revise') { ws.auditor = ws.auditor || {}; ws.auditor.status = 'REVISE'; ws.auditor.timestamp = Date.now(); }
      if (action === 'print') { window.print(); return; }
      saveWorkspace(oppKey, track, ws); var newHtml = renderPanel(oppKey, track, null); panel.outerHTML = newHtml; wirePanel(container, oppKey, track); }); });
  }

  function renderForOpportunity(oppKey, path, opp) {
    if (path === 'GRANT-ELIGIBLE') return renderPanel(oppKey, 'grant', opp);
    if (path === 'PATENTABLE') return renderPanel(oppKey, 'patent', opp);
    return '';
  }
  function wireForOpportunity(container, oppKey, path) {
    if (path === 'GRANT-ELIGIBLE') wirePanel(container, oppKey, 'grant');
    if (path === 'PATENTABLE') wirePanel(container, oppKey, 'patent');
  }

  window.LIMENTradeExecutionPanels = { renderForOpportunity: renderForOpportunity, wireForOpportunity: wireForOpportunity, GRANT_SECTIONS: GRANT_SECTIONS, PATENT_SECTIONS: PATENT_SECTIONS };
  console.log('[TradeExecutionPanels] Loaded \u2014 GRANT + PATENT workspaces ready');
})();
