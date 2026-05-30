/**
 * science-execution-panels.js — GRANT and PATENT Execution Workspaces (Science)
 *
 * Science domain only. Expandable workflow panels for each opportunity.
 * Operator can build a full grant application or patent packet in-portal.
 *
 * Self-gates: only runs when ?domain=science or ?domain=research
 * Exposes: window.LIMENScienceExecutionPanels
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isScienceDomain = _dom === 'science' || _dom === 'research';
  var isScienceWorkspace = window.location.pathname.indexOf('science-workspace') !== -1;
  if (!isScienceDomain && !isScienceWorkspace) return;

  var STORE_KEY = 'limen_science_exec_panels';
  var _stylesInjected = false;

  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAll(data) { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {} }
  function getWorkspace(oppKey, track) { var all = loadAll(); return (all[oppKey] && all[oppKey][track]) || null; }
  function saveWorkspace(oppKey, track, workspace) { var all = loadAll(); if (!all[oppKey]) all[oppKey] = {}; all[oppKey][track] = workspace; saveAll(all); }

  var GRANT_SECTIONS = [
    { id: 'what', title: 'What This Grant Is', type: 'info', guidance: 'A research grant is non-repayable funding from a federal agency or private foundation. Major science funders: NSF, NIH, DARPA, ARPA-E, ARPA-H, DOE Office of Science, NASA, HHMI, Gates, Wellcome, Simons, Sloan, Moore, Chan Zuckerberg.', prompt: 'No input needed.' },
    { id: 'why', title: 'Why This Opportunity Qualifies', type: 'textarea', guidance: 'Explain why this Science / Research opportunity is a good fit for grant funding. Address: scientific significance, innovation, broader impacts, alignment with the agency mission.', prompt: 'Write 3-5 sentences explaining significance, innovation, and alignment.', prefillFrom: 'whyNow' },
    { id: 'eligibility', title: 'Eligibility', type: 'checklist', guidance: 'Most federal research grants have eligibility rules. Check each that applies.', items: ['Organization is a US accredited institution', 'Organization has a UEI (formerly DUNS) number', 'Organization is registered on SAM.gov / Research.gov', 'PI has terminal degree (PhD / MD / equivalent)', 'No debarment or exclusion status', 'Has financial management compliant with Uniform Guidance (2 CFR 200)', 'Has approved IRB / IACUC / IBC if human or animal subjects'] },
    { id: 'applicant', title: 'PI / Applicant Profile', type: 'fields', guidance: 'Principal Investigator and institution information.', fields: [{ id: 'pi_name', label: 'Principal Investigator', type: 'text' }, { id: 'institution', label: 'Institution', type: 'text' }, { id: 'department', label: 'Department / unit', type: 'text' }, { id: 'uei', label: 'UEI number', type: 'text' }, { id: 'email', label: 'PI email', type: 'text' }, { id: 'orcid', label: 'PI ORCID iD', type: 'text', placeholder: '0000-0000-0000-0000' }] },
    { id: 'specific_aims', title: 'Specific Aims', type: 'textarea', guidance: 'NIH/NSF format. State 2-3 specific aims with hypotheses.', prompt: 'List 2-3 specific aims with their hypotheses.', prefillFrom: 'diagnosis' },
    { id: 'significance', title: 'Significance / Innovation', type: 'textarea', guidance: 'Why does this matter? What is novel?', prompt: 'Explain scientific significance and what is novel about your approach.' },
    { id: 'approach', title: 'Approach / Methods', type: 'textarea', guidance: 'How will you do the work? Include experimental design, statistical power, and rigor measures.', prompt: 'Describe your experimental approach. Address rigor and reproducibility.' },
    { id: 'budget', title: 'Budget', type: 'fields', guidance: 'How much do you need and what for?', fields: [{ id: 'total_amount', label: 'Total funding requested ($)', type: 'text', placeholder: 'e.g., 500000' }, { id: 'personnel', label: 'Personnel (PI/coPIs/postdocs/students)', type: 'text' }, { id: 'equipment', label: 'Equipment', type: 'text' }, { id: 'supplies', label: 'Supplies', type: 'text' }, { id: 'travel', label: 'Travel', type: 'text' }, { id: 'indirect', label: 'Indirect / F&A rate', type: 'text', placeholder: 'e.g., 65% MTDC' }, { id: 'cost_share', label: 'Cost share / match (if required)', type: 'text' }] },
    { id: 'timeline', title: 'Timeline', type: 'textarea', guidance: 'Project period and milestones.', prompt: 'Project period (e.g., 3 years) and key milestones per year.' },
    { id: 'documents', title: 'Required Documents', type: 'checklist', guidance: 'Most research grants require many supporting documents.', items: ['Specific aims page (1 page)', 'Research strategy / approach (12 pages)', 'Bibliography', 'PI biosketch (NIH/NSF format)', 'Co-investigator biosketches', 'Facilities & resources statement', 'Equipment statement', 'Letters of support / collaboration', 'Data management & sharing plan', 'IRB / IACUC / IBC approval (if applicable)', 'Vertebrate animals section (if applicable)', 'Human subjects section (if applicable)'] },
    { id: 'review', title: 'Final Review', type: 'review', guidance: 'Review everything before submission.' },
    { id: 'auditor', title: 'Auditor Decision', type: 'auditor', guidance: 'For the auditor reviewing this grant application.' }
  ];

  var PATENT_SECTIONS = [
    { id: 'what', title: 'What This Patent Is', type: 'info', guidance: 'A patent gives you the legal right to prevent others from making, using, or selling your invention for 20 years. For science/research, this typically protects laboratory methods, instrument designs, software workflows, and biological tools. Provisional ~$320; non-provisional much more.', prompt: 'No input needed.' },
    { id: 'why', title: 'Why This May Be Patentable', type: 'textarea', guidance: 'Patentable = (1) new, (2) useful, (3) non-obvious, AND patent-eligible subject matter (passing Alice/Mayo for software/diagnostic methods). Explain how your invention meets all four.', prompt: 'Why is this invention new, useful, non-obvious, and patent-eligible?', prefillFrom: 'whyNow' },
    { id: 'title', title: 'Invention Title', type: 'text', guidance: 'Example: "Method and System for High-Throughput Single-Cell RNA Sequencing with Reduced Reagent Costs"', prompt: 'Enter a descriptive title.', prefillFrom: 'title' },
    { id: 'summary', title: 'Invention Summary', type: 'textarea', guidance: 'Describe in 2-4 sentences for a smart non-specialist.', prompt: 'Summarize the invention in plain English.' },
    { id: 'problem_solved', title: 'Problem Being Solved', type: 'textarea', guidance: 'What scientific or technical problem does this address?', prompt: 'What problem exists today that this fixes?', prefillFrom: 'diagnosis' },
    { id: 'novelty', title: 'Novelty', type: 'textarea', guidance: 'What makes this different from existing scientific tools, methods, or instruments?', prompt: 'What is new compared to existing science / instrumentation?' },
    { id: 'prior_art', title: 'Prior Art', type: 'textarea', guidance: 'List existing publications, patents, and commercial products that are similar. Search Google Patents AND the relevant scientific literature (PubMed, arXiv, Google Scholar).', prompt: 'List known prior art and how your invention differs.' },
    { id: 'technical', title: 'Technical Description', type: 'textarea', guidance: 'Describe how the invention works in enough detail that a person skilled in the art could build it. Include reagents, protocols, parameters, software architecture.', prompt: 'Describe the technical implementation.' },
    { id: 'embodiments', title: 'Embodiments', type: 'textarea', guidance: 'Describe at least 2-3 different ways the invention could be implemented or applied.', prompt: 'List alternative implementations.' },
    { id: 'claims', title: 'Claims Development', type: 'textarea', guidance: 'Claims define what you own. Start with broad independent claims and add narrower dependent claims.', prompt: 'Draft 2-3 initial patent claims.' },
    { id: 'ownership', title: 'Inventorship / Ownership', type: 'fields', guidance: 'University-employed researchers usually have IP assigned to the institution. Check your university IP policy.', fields: [{ id: 'inventor1', label: 'Inventor 1 (full legal name)', type: 'text' }, { id: 'inventor1_role', label: 'Inventor 1 contribution', type: 'text' }, { id: 'inventor2', label: 'Inventor 2 (if applicable)', type: 'text' }, { id: 'assignee', label: 'Assignee', type: 'text', placeholder: 'University / Institution / Inventor' }, { id: 'tto_contact', label: 'University TTO contact (if applicable)', type: 'text' }, { id: 'filing_type', label: 'Filing type', type: 'select', options: ['Provisional (12-month placeholder)', 'Non-provisional (full filing)', 'PCT International', 'Undecided'] }] },
    { id: 'documents', title: 'Documents / Figures', type: 'checklist', guidance: 'Patents benefit from clear figures.', items: ['Block diagram of system', 'Flowchart of method steps', 'Experimental data / performance figures', 'Prior art comparison table', 'Inventor declaration signed', 'University TTO disclosure form (if applicable)', 'Prior art search results'] },
    { id: 'review', title: 'Filing Readiness Review', type: 'review', guidance: 'Review everything before filing.' },
    { id: 'auditor', title: 'Auditor Decision', type: 'auditor', guidance: 'For the auditor reviewing this patent filing.' }
  ];

  function injectStyles() {
    if (_stylesInjected) return; _stylesInjected = true;
    var s = document.createElement('style'); s.textContent = [
      '.sep-panel{margin-top:8px;border:1px solid rgba(201,169,78,0.08);border-radius:3px;background:rgba(5,8,16,0.5)}',
      '.sep-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer;user-select:none}',
      '.sep-header:hover{background:rgba(201,169,78,0.03)}',
      '.sep-track-label{font-size:0.32rem;letter-spacing:2px;text-transform:uppercase}',
      '.sep-track-grant{color:#5ab5a0}','.sep-track-patent{color:#a87adb}',
      '.sep-progress{font-size:0.26rem;color:#807868}','.sep-toggle{font-size:0.22rem;color:rgba(201,169,78,0.25)}',
      '.sep-body{display:none;padding:0 12px 12px}','.sep-body.open{display:block}',
      '.sep-section{margin-bottom:12px;border-bottom:1px solid rgba(201,169,78,0.04);padding-bottom:8px}',
      '.sep-section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}',
      '.sep-section-title{font-size:0.34rem;color:rgba(201,169,78,0.85);letter-spacing:1.5px;font-weight:600}',
      '.sep-section-check{font-size:0.24rem}',
      '.sep-guidance{font-size:0.32rem;color:#908878;line-height:1.5;margin-bottom:6px;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.08);background:rgba(0,0,0,0.1)}',
      '.sep-textarea{width:100%;min-height:60px;padding:6px 8px;background:#0a0c14;border:1px solid rgba(201,169,78,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.38rem;resize:vertical}',
      '.sep-input{width:100%;padding:4px 8px;background:#0a0c14;border:1px solid rgba(201,169,78,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.36rem}',
      '.sep-select{padding:4px 8px;background:#0a0c14;border:1px solid rgba(201,169,78,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.36rem}',
      '.sep-field{margin-bottom:6px}','.sep-field-label{font-size:0.30rem;color:#908878;margin-bottom:2px;display:block}',
      '.sep-check-item{display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.34rem;color:#b0a898;cursor:pointer}',
      '.sep-check-item input{accent-color:#C9A94E}',
      '.sep-auditor{padding:8px;border:1px solid rgba(201,169,78,0.12);border-radius:3px;background:rgba(201,169,78,0.02)}',
      '.sep-auditor-title{font-size:0.28rem;letter-spacing:2px;color:rgba(201,169,78,0.4);margin-bottom:6px}',
      '.sep-auditor-btns{display:flex;gap:4px;margin-top:6px}',
      '.sep-btn{font-family:inherit;font-size:0.28rem;letter-spacing:1px;padding:3px 10px;border-radius:2px;cursor:pointer;transition:all 0.15s;border:1px solid}',
      '.sep-btn-approve{color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.04)}',
      '.sep-btn-deny{color:#e85454;border-color:rgba(232,84,84,0.3);background:rgba(232,84,84,0.04)}',
      '.sep-btn-revise{color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.04)}',
      '.sep-btn-print{color:#4a8fd4;border-color:rgba(74,143,212,0.3);background:rgba(74,143,212,0.04)}',
      '.sep-status{font-size:0.26rem;letter-spacing:1px;padding:2px 6px;border-radius:2px;display:inline-block}',
      '.sep-status-draft{color:#807868;border:1px solid rgba(128,120,104,0.2)}',
      '.sep-status-approved{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)}',
      '.sep-status-denied{color:#e85454;border:1px solid rgba(232,84,84,0.2)}',
      '.sep-status-revise{color:#C9A94E;border:1px solid rgba(201,169,78,0.2)}'
    ].join('\n'); document.head.appendChild(s);
  }

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function renderSection(sec, ws, oppKey, track) {
    var val = (ws.fields && ws.fields[sec.id]) || '';
    var checked = (ws.checks && ws.checks[sec.id]) || {};
    var sectionDone = ws.sectionDone && ws.sectionDone[sec.id];
    var h = '<div class="sep-section" data-section="' + sec.id + '">';
    h += '<div class="sep-section-header"><span class="sep-section-title">' + (sectionDone ? '\u2713 ' : '') + esc(sec.title) + '</span>';
    if (sec.type !== 'info') h += '<label class="sep-section-check"><input type="checkbox" class="sep-done-check" data-sec="' + sec.id + '"' + (sectionDone ? ' checked' : '') + '> done</label>';
    h += '</div><div class="sep-guidance">' + esc(sec.guidance) + '</div>';
    if (sec.type === 'textarea') {
      if (sec.prompt) h += '<div style="font-size:0.28rem;color:#706860;margin-bottom:3px">' + esc(sec.prompt) + '</div>';
      h += '<textarea class="sep-textarea" data-field="' + sec.id + '">' + esc(val) + '</textarea>';
    } else if (sec.type === 'text') {
      if (sec.prompt) h += '<div style="font-size:0.28rem;color:#706860;margin-bottom:3px">' + esc(sec.prompt) + '</div>';
      h += '<input class="sep-input" type="text" data-field="' + sec.id + '" value="' + esc(val) + '">';
    } else if (sec.type === 'fields') {
      var fieldVals = typeof val === 'object' ? val : {};
      for (var fi = 0; fi < sec.fields.length; fi++) { var f = sec.fields[fi]; var fv = fieldVals[f.id] || '';
        h += '<div class="sep-field"><label class="sep-field-label">' + esc(f.label) + '</label>';
        if (f.type === 'select') { h += '<select class="sep-select" data-field="' + sec.id + '.' + f.id + '">'; for (var oi = 0; oi < f.options.length; oi++) h += '<option' + (fv === f.options[oi] ? ' selected' : '') + '>' + esc(f.options[oi]) + '</option>'; h += '</select>'; }
        else h += '<input class="sep-input" type="text" data-field="' + sec.id + '.' + f.id + '" value="' + esc(fv) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
        h += '</div>'; }
    } else if (sec.type === 'checklist') {
      for (var ci = 0; ci < sec.items.length; ci++) { var ik = 'item_' + ci; h += '<label class="sep-check-item"><input type="checkbox" class="sep-check" data-sec="' + sec.id + '" data-item="' + ik + '"' + (checked[ik] ? ' checked' : '') + '> ' + esc(sec.items[ci]) + '</label>'; }
    } else if (sec.type === 'review') {
      var sections = track === 'grant' ? GRANT_SECTIONS : PATENT_SECTIONS; var ts = 0, ds = 0;
      for (var ri = 0; ri < sections.length; ri++) { if (sections[ri].type !== 'info' && sections[ri].type !== 'review' && sections[ri].type !== 'auditor') { ts++; if (ws.sectionDone && ws.sectionDone[sections[ri].id]) ds++; } }
      var pct = ts > 0 ? Math.round(ds / ts * 100) : 0;
      h += '<div style="font-size:0.38rem;color:#d0c8b8;margin-bottom:6px">Progress: <b>' + ds + '/' + ts + '</b> (' + pct + '%)</div>';
      h += '<div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:' + pct + '%;background:' + (pct >= 80 ? '#5ab5a0' : pct >= 50 ? '#C9A94E' : '#e85454') + ';border-radius:3px"></div></div>';
      if (pct < 100) { h += '<div style="font-size:0.30rem;color:#C9A94E">Missing:</div>'; for (var mi = 0; mi < sections.length; mi++) { if (sections[mi].type !== 'info' && sections[mi].type !== 'review' && sections[mi].type !== 'auditor' && !(ws.sectionDone && ws.sectionDone[sections[mi].id])) h += '<div style="font-size:0.28rem;color:#908878">\u2022 ' + esc(sections[mi].title) + '</div>'; } }
      h += '<div style="margin-top:8px"><button class="sep-btn sep-btn-print" data-action="print">PRINT APPLICATION</button></div>';
    } else if (sec.type === 'auditor') {
      var as = ws.auditor || {}; h += '<div class="sep-auditor"><div class="sep-auditor-title">AUDITOR REVIEW</div>';
      var sl = as.status || 'DRAFT'; h += '<div style="margin-bottom:6px"><span class="sep-status sep-status-' + sl.toLowerCase() + '">' + sl + '</span></div>';
      h += '<div class="sep-field"><label class="sep-field-label">Auditor comments</label><textarea class="sep-textarea" data-auditor="comments" style="min-height:40px">' + esc(as.comments || '') + '</textarea></div>';
      h += '<div class="sep-auditor-btns"><button class="sep-btn sep-btn-approve" data-action="approve">APPROVE</button><button class="sep-btn sep-btn-deny" data-action="deny">DENY</button><button class="sep-btn sep-btn-revise" data-action="revise">NEEDS REVISION</button></div>';
      if (as.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(as.timestamp).toLocaleString() + '</div>';
      h += '</div>';
    }
    h += '</div>'; return h;
  }

  function renderPanel(oppKey, track, opp) {
    injectStyles();
    var ws = getWorkspace(oppKey, track) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    var sections = track === 'grant' ? GRANT_SECTIONS : PATENT_SECTIONS;
    var trackColor = track === 'grant' ? 'sep-track-grant' : 'sep-track-patent';
    var trackLabel = track === 'grant' ? 'GRANT APPLICATION' : 'PATENT FILING';
    if (!ws._prefilled && opp) {
      ws._prefilled = true;
      for (var si = 0; si < sections.length; si++) { var sec = sections[si];
        if (sec.prefillFrom && !ws.fields[sec.id]) {
          if (sec.prefillFrom === 'title') ws.fields[sec.id] = opp.title || '';
          if (sec.prefillFrom === 'whyNow') ws.fields[sec.id] = (opp.title || '') + '. This Science condition creates demand because: ' + (opp.reason || opp.whyNow || 'active diagnosis pathway detected.');
          if (sec.prefillFrom === 'diagnosis') ws.fields[sec.id] = 'Science domain diagnosis: ' + (opp.diagnosisId || 'active').replace(/_/g, ' ') + '. ' + (opp.title || '');
        }
      }
      saveWorkspace(oppKey, track, ws);
    }
    var ts = 0, ds = 0;
    for (var pi = 0; pi < sections.length; pi++) { if (sections[pi].type !== 'info' && sections[pi].type !== 'review' && sections[pi].type !== 'auditor') { ts++; if (ws.sectionDone && ws.sectionDone[sections[pi].id]) ds++; } }
    var pct = ts > 0 ? Math.round(ds / ts * 100) : 0;
    var statusLabel = ws.auditor && ws.auditor.status ? ws.auditor.status : 'DRAFT';
    var h = '<div class="sep-panel" data-opp="' + esc(oppKey) + '" data-track="' + track + '">';
    h += '<div class="sep-header" data-toggle="' + oppKey + '-' + track + '"><span class="sep-track-label ' + trackColor + '">' + trackLabel + '</span>';
    h += '<span class="sep-progress">' + pct + '% \u00b7 ' + ds + '/' + ts + ' \u00b7 <span class="sep-status sep-status-' + statusLabel.toLowerCase() + '">' + statusLabel + '</span></span>';
    h += '<span class="sep-toggle">\u25BC</span></div>';
    h += '<div class="sep-body" data-body="' + oppKey + '-' + track + '">';
    for (var ri = 0; ri < sections.length; ri++) h += renderSection(sections[ri], ws, oppKey, track);
    h += '</div></div>'; return h;
  }

  function wirePanel(container, oppKey, track) {
    var panel = container.querySelector('[data-opp="' + oppKey + '"][data-track="' + track + '"]'); if (!panel) return;
    var header = panel.querySelector('[data-toggle="' + oppKey + '-' + track + '"]');
    var body = panel.querySelector('[data-body="' + oppKey + '-' + track + '"]');
    if (header && body) { header.addEventListener('click', function () { body.classList.toggle('open'); var t = header.querySelector('.sep-toggle'); if (t) t.textContent = body.classList.contains('open') ? '\u25B2' : '\u25BC'; }); }
    var ws = getWorkspace(oppKey, track) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    panel.querySelectorAll('.sep-textarea, .sep-input, .sep-select').forEach(function (el) {
      el.addEventListener('change', function () { var field = this.getAttribute('data-field'); var af = this.getAttribute('data-auditor');
        if (field) { if (field.indexOf('.') !== -1) { var p = field.split('.'); if (typeof ws.fields[p[0]] !== 'object') ws.fields[p[0]] = {}; ws.fields[p[0]][p[1]] = this.value; } else ws.fields[field] = this.value; }
        if (af) { if (!ws.auditor) ws.auditor = {}; ws.auditor[af] = this.value; }
        saveWorkspace(oppKey, track, ws); }); });
    panel.querySelectorAll('.sep-check').forEach(function (el) { el.addEventListener('change', function () { var sec = this.getAttribute('data-sec'); var item = this.getAttribute('data-item'); if (!ws.checks[sec]) ws.checks[sec] = {}; ws.checks[sec][item] = this.checked; saveWorkspace(oppKey, track, ws); }); });
    panel.querySelectorAll('.sep-done-check').forEach(function (el) { el.addEventListener('change', function () { var sec = this.getAttribute('data-sec'); if (!ws.sectionDone) ws.sectionDone = {}; ws.sectionDone[sec] = this.checked; saveWorkspace(oppKey, track, ws); }); });
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

  window.LIMENScienceExecutionPanels = { renderForOpportunity: renderForOpportunity, wireForOpportunity: wireForOpportunity, GRANT_SECTIONS: GRANT_SECTIONS, PATENT_SECTIONS: PATENT_SECTIONS };
  console.log('[ScienceExecutionPanels] Loaded \u2014 GRANT + PATENT workspaces ready');
})();
