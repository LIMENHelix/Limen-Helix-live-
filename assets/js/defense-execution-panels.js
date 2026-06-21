/**
 * defense-execution-panels.js — RESEARCH Execution Workspace (Defense)
 * Self-gates: ?domain=defense
 * Exposes: window.LIMENDefenseExecutionPanels
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isDefenseDomain = _dom === 'defense';
  var isDefenseWorkspace = window.location.pathname.indexOf('defense-workspace') !== -1;
  if (!isDefenseDomain && !isDefenseWorkspace) return;

  var STORE_KEY = 'limen_defense_exec_panels';
  var _stylesInjected = false;

  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAll(data) { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {} }
  function getWorkspace(oppKey, track) { var all = loadAll(); return (all[oppKey] && all[oppKey][track]) || null; }
  function saveWorkspace(oppKey, track, workspace) { var all = loadAll(); if (!all[oppKey]) all[oppKey] = {}; all[oppKey][track] = workspace; saveAll(all); }

  var RESEARCH_SECTIONS = [
    { id: 'what', title: 'What This Research Is', type: 'info', guidance: 'A defense research brief documents a capability gap, technology landscape, or threat analysis. Outputs: advisory briefs, landscape reports, programme-office input papers. Customers: DoD CDAO, DARPA, IARPA, DIU, AFWERX, NATO STO, allied defence research agencies.', prompt: 'No input needed.' },
    { id: 'why', title: 'Why This Opportunity Warrants Research', type: 'textarea', guidance: 'Explain why this defense opportunity is under-researched or has a capability gap. Address: the threat or capability need, the current state of knowledge, and why new research adds value.', prompt: 'Write 3-5 sentences explaining the gap and why research is valuable now.', prefillFrom: 'whyNow' },
    { id: 'scope', title: 'Research Scope', type: 'fields', fields: [{ id: 'topic', label: 'Research topic / focus area', type: 'text' }, { id: 'geography', label: 'Geographic / theatre scope', type: 'text', placeholder: 'e.g., Indo-Pacific, NATO Eastern Flank, global' }, { id: 'time_horizon', label: 'Time horizon', type: 'select', options: ['Near-term (0-2 years)', 'Mid-term (2-5 years)', 'Long-term (5-10 years)', 'All horizons'] }, { id: 'classification', label: 'Classification level', type: 'select', options: ['Unclassified / FOUO', 'CUI', 'Secret', 'Top Secret', 'Undecided'] }] },
    { id: 'problem', title: 'Problem Statement', type: 'textarea', guidance: 'What capability gap, threat, or knowledge deficiency does this research address? Cite relevant doctrine, programme gaps, or intelligence indicators.', prompt: 'Describe the defense capability gap or threat with specifics.', prefillFrom: 'diagnosis' },
    { id: 'sources', title: 'Key Sources & Data', type: 'textarea', guidance: 'List primary and secondary sources: DoD programme documents, DARPA BAAs, academic literature, vendor assessments, intelligence reports (unclassified).', prompt: 'List key sources you will draw on for this research.' },
    { id: 'methodology', title: 'Research Methodology', type: 'textarea', guidance: 'How will you conduct the research? Options: literature review, expert interviews, capability benchmarking, threat modelling, technology readiness assessment.', prompt: 'Describe the research approach and methods.' },
    { id: 'deliverables', title: 'Deliverables', type: 'fields', fields: [{ id: 'output_type', label: 'Primary output', type: 'select', options: ['Research brief (5-20 pages)', 'Landscape report (20-50 pages)', 'Programme input paper', 'Technology assessment', 'Threat analysis', 'Investment thesis paper'] }, { id: 'audience', label: 'Target audience', type: 'text', placeholder: 'e.g., DoD CDAO, DARPA PM, allied MoD, think-tank' }, { id: 'timeline', label: 'Estimated delivery timeline', type: 'text', placeholder: 'e.g., 4-6 weeks' }] },
    { id: 'customers', title: 'Research Customers', type: 'textarea', guidance: 'Who will receive and act on this research? Name specific programme offices, research agencies, think-tanks, or investment offices.', prompt: 'List 3-5 specific research customers by name.' },
    { id: 'outcomes', title: 'Expected Outcomes', type: 'textarea', guidance: 'What decisions or actions should this research enable? How will you measure impact?', prompt: 'Describe the decisions or actions the research will inform.' },
    { id: 'documents', title: 'Required Documents', type: 'checklist', items: ['Research outline / table of contents', 'Source list (at least 10 primary sources)', 'Key question set', 'Capability gap evidence', 'Threat indicator summary', 'Draft abstract (200 words)', 'Distribution / classification marking plan'] },
    { id: 'review', title: 'Final Review', type: 'review' },
    { id: 'auditor', title: 'Auditor Decision', type: 'auditor' }
  ];

  function injectStyles() {
    if (_stylesInjected) return; _stylesInjected = true;
    var s = document.createElement('style'); s.textContent = [
      '.eep-panel{margin-top:8px;border:1px solid rgba(201,169,78,0.08);border-radius:3px;background:rgba(5,8,16,0.5)}',
      '.eep-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer;user-select:none}',
      '.eep-header:hover{background:rgba(201,169,78,0.03)}',
      '.eep-track-label{font-size:0.32rem;letter-spacing:2px;text-transform:uppercase}',
      '.eep-track-research{color:#5ab5a0}',
      '.eep-progress{font-size:0.26rem;color:#807868}','.eep-toggle{font-size:0.22rem;color:rgba(201,169,78,0.25)}',
      '.eep-body{display:none;padding:0 12px 12px}','.eep-body.open{display:block}',
      '.eep-section{margin-bottom:12px;border-bottom:1px solid rgba(201,169,78,0.04);padding-bottom:8px}',
      '.eep-section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}',
      '.eep-section-title{font-size:0.34rem;color:rgba(201,169,78,0.85);letter-spacing:1.5px;font-weight:600}',
      '.eep-section-check{font-size:0.24rem}',
      '.eep-guidance{font-size:0.32rem;color:#908878;line-height:1.5;margin-bottom:6px;padding:4px 8px;border-left:2px solid rgba(201,169,78,0.08);background:rgba(0,0,0,0.1)}',
      '.eep-textarea{width:100%;min-height:60px;padding:6px 8px;background:#0a0c14;border:1px solid rgba(201,169,78,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.38rem;resize:vertical}',
      '.eep-input{width:100%;padding:4px 8px;background:#0a0c14;border:1px solid rgba(201,169,78,0.12);border-radius:2px;color:#e8e3d9;font-family:inherit;font-size:0.36rem}',
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
    h += '<div class="eep-section-header"><span class="eep-section-title">' + (sectionDone ? '✓ ' : '') + esc(sec.title) + '</span>';
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
      for (var fi = 0; fi < sec.fields.length; fi++) {
        var f = sec.fields[fi]; var fv = fieldVals[f.id] || '';
        h += '<div class="eep-field"><label class="eep-field-label">' + esc(f.label) + '</label>';
        if (f.type === 'select') {
          h += '<select class="eep-select" data-field="' + sec.id + '.' + f.id + '">';
          for (var oi = 0; oi < f.options.length; oi++) h += '<option' + (fv === f.options[oi] ? ' selected' : '') + '>' + esc(f.options[oi]) + '</option>';
          h += '</select>';
        } else h += '<input class="eep-input" type="text" data-field="' + sec.id + '.' + f.id + '" value="' + esc(fv) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
        h += '</div>';
      }
    } else if (sec.type === 'checklist') {
      for (var ci = 0; ci < sec.items.length; ci++) {
        var ik = 'item_' + ci;
        h += '<label class="eep-check-item"><input type="checkbox" class="eep-check" data-sec="' + sec.id + '" data-item="' + ik + '"' + (checked[ik] ? ' checked' : '') + '> ' + esc(sec.items[ci]) + '</label>';
      }
    } else if (sec.type === 'review') {
      var sections = RESEARCH_SECTIONS; var ts = 0, ds = 0;
      for (var ri = 0; ri < sections.length; ri++) { if (sections[ri].type !== 'info' && sections[ri].type !== 'review' && sections[ri].type !== 'auditor') { ts++; if (ws.sectionDone && ws.sectionDone[sections[ri].id]) ds++; } }
      var pct = ts > 0 ? Math.round(ds / ts * 100) : 0;
      h += '<div style="font-size:0.38rem;color:#d0c8b8;margin-bottom:6px">Progress: <b>' + ds + '/' + ts + '</b> (' + pct + '%)</div>';
      h += '<div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:' + pct + '%;background:' + (pct >= 80 ? '#5ab5a0' : pct >= 50 ? '#C9A94E' : '#e85454') + ';border-radius:3px"></div></div>';
      h += '<div style="margin-top:8px"><button class="eep-btn eep-btn-print" data-action="print">PRINT BRIEF</button></div>';
    } else if (sec.type === 'auditor') {
      var as = ws.auditor || {}; h += '<div class="eep-auditor"><div class="eep-auditor-title">AUDITOR REVIEW</div>';
      var sl = as.status || 'DRAFT'; h += '<div style="margin-bottom:6px"><span class="eep-status eep-status-' + sl.toLowerCase() + '">' + sl + '</span></div>';
      h += '<div class="eep-field"><label class="eep-field-label">Auditor comments</label><textarea class="eep-textarea" data-auditor="comments" style="min-height:40px">' + esc(as.comments || '') + '</textarea></div>';
      h += '<div class="eep-auditor-btns"><button class="eep-btn eep-btn-approve" data-action="approve">APPROVE</button><button class="eep-btn eep-btn-deny" data-action="deny">DENY</button><button class="eep-btn eep-btn-revise" data-action="revise">NEEDS REVISION</button></div>';
      if (as.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(as.timestamp).toLocaleString() + '</div>';
      h += '</div>';
    }
    h += '</div>'; return h;
  }

  function renderPanel(oppKey, track, opp) {
    injectStyles();
    var ws = getWorkspace(oppKey, track) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    var sections = RESEARCH_SECTIONS;
    var trackColor = 'eep-track-research';
    var trackLabel = 'RESEARCH BRIEF';
    if (!ws._prefilled && opp) {
      ws._prefilled = true;
      for (var si = 0; si < sections.length; si++) { var sec = sections[si];
        if (sec.prefillFrom && !ws.fields[sec.id]) {
          if (sec.prefillFrom === 'title') ws.fields[sec.id] = opp.title || '';
          if (sec.prefillFrom === 'whyNow') ws.fields[sec.id] = (opp.title || '') + '. This defense condition warrants research because: ' + (opp.reason || opp.whyNow || 'active diagnosis pathway detected.');
          if (sec.prefillFrom === 'diagnosis') ws.fields[sec.id] = 'Defense domain diagnosis: ' + (opp.diagnosisId || 'active').replace(/_/g, ' ') + '. ' + (opp.title || '');
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
    h += '<span class="eep-progress">' + pct + '% · ' + ds + '/' + ts + ' · <span class="eep-status eep-status-' + statusLabel.toLowerCase() + '">' + statusLabel + '</span></span>';
    h += '<span class="eep-toggle">▼</span></div>';
    h += '<div class="eep-body" data-body="' + oppKey + '-' + track + '">';
    for (var ri = 0; ri < sections.length; ri++) h += renderSection(sections[ri], ws, oppKey, track);
    h += '</div></div>'; return h;
  }

  function wirePanel(container, oppKey, track) {
    var panel = container.querySelector('[data-opp="' + oppKey + '"][data-track="' + track + '"]'); if (!panel) return;
    var header = panel.querySelector('[data-toggle="' + oppKey + '-' + track + '"]');
    var body = panel.querySelector('[data-body="' + oppKey + '-' + track + '"]');
    if (header && body) { header.addEventListener('click', function () { body.classList.toggle('open'); var t = header.querySelector('.eep-toggle'); if (t) t.textContent = body.classList.contains('open') ? '▲' : '▼'; }); }
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
    if (path === 'RESEARCHABLE') return renderPanel(oppKey, 'research', opp);
    return '';
  }
  function wireForOpportunity(container, oppKey, path) {
    if (path === 'RESEARCHABLE') wirePanel(container, oppKey, 'research');
  }

  window.LIMENDefenseExecutionPanels = { renderForOpportunity: renderForOpportunity, wireForOpportunity: wireForOpportunity, RESEARCH_SECTIONS: RESEARCH_SECTIONS };
  console.log('[DefenseExecutionPanels] Loaded');
})();
