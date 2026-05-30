/**
 * medicine-execution-panels.js — GRANT and PATENT Execution Workspaces
 *
 * Medicine domain only. Expandable workflow panels for each opportunity.
 * Operator can build a full grant application or patent packet in-portal.
 * Auditor can review and accept/deny.
 *
 * Features:
 *   - Collapsible per-opportunity workspaces
 *   - Editable fields with guidance
 *   - Section checklists with progress tracking
 *   - Auditor review block
 *   - Printable output
 *   - localStorage persistence
 *   - Opportunity-specific prefill
 *
 * Self-gates: only runs when ?domain=medicine
 * Exposes: window.LIMENMedicineExecutionPanels
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var isMedicineDomain = params.get('domain') === 'medicine';
  var isMedicineWorkspace = window.location.pathname.indexOf('medicine-workspace') !== -1;
  if (!isMedicineDomain && !isMedicineWorkspace) return;

  var STORE_KEY = 'limen_medicine_exec_panels';
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
  // SECTION DEFINITIONS — GRANT (12 sections, medicine-specific)
  // ══════════════════════════════════════════════════════════════════════

  var GRANT_SECTIONS = [
    { id: 'what', title: 'What This Grant Is', type: 'info',
      guidance: 'A grant is non-dilutive capital from NIH, FDA, BARDA, NSF, PCORI, private foundations, or other funders to advance a specific clinical research, public health, or medical technology project. You do not repay it. In exchange, you deliver the project outcomes you committed to. This section provides context for operators new to biomedical grant funding.',
      prompt: 'No input needed \u2014 this is context for the operator.' },
    { id: 'why', title: 'Why This Opportunity Qualifies', type: 'textarea',
      guidance: 'Explain in plain language why this Medicine opportunity is a strong candidate for grant funding. Consider: Does it address an unmet clinical need, a public health crisis, drug resistance, healthcare access gaps, or pandemic preparedness? Is there an NIH institute or FDA program priority that aligns?',
      prompt: 'Write 2-3 sentences explaining why this opportunity deserves grant funding in the medical sector.', prefillFrom: 'whyNow' },
    { id: 'eligibility', title: 'Eligibility', type: 'checklist',
      guidance: 'NIH, FDA, and medical research grants have specific eligibility requirements. Check each item that applies to your organization or project.',
      items: ['Organization is a registered US entity', 'Organization has a DUNS/UEI number', 'Organization is registered on SAM.gov', 'No debarment or exclusion status', 'Meets NIH institutional requirements (if applicable)', 'Compliant with federal grant management standards (2 CFR 200)', 'Has audited financial statements available', 'IRB approval obtained or application in process', 'Compliant with FDA 21 CFR Part 11 (electronic records)', 'Has clinical trial registration on ClinicalTrials.gov (if applicable)', 'CMS provider enrollment active (if applicable)', 'HIPAA compliance program in place'] },
    { id: 'applicant', title: 'Applicant Profile', type: 'fields',
      guidance: 'Basic information about who is applying. The grant reviewer needs to verify you are a qualified clinical research, healthcare delivery, or biotech organization.',
      fields: [
        { id: 'org_name', label: 'Organization name', type: 'text', placeholder: 'LIMEN Helix Medical Research LLC' },
        { id: 'org_type', label: 'Organization type', type: 'select', options: ['Academic medical center', 'Clinical research organization (CRO)', 'Biotech / pharmaceutical company', 'Hospital / health system', 'Community health center / FQHC', 'Non-profit research institute', 'Public health agency', 'Digital health company', 'Medical device company', 'Other'] },
        { id: 'uei', label: 'UEI / DUNS number', type: 'text', placeholder: 'e.g., ABC123456789' },
        { id: 'regulatory_id', label: 'Primary registration (NIH eRA Commons / FDA / CMS)', type: 'text', placeholder: 'e.g., NIH Commons ID, FDA Establishment #, CMS NPI' },
        { id: 'irb_info', label: 'IRB of record', type: 'text', placeholder: 'Name of IRB, FWA number' },
        { id: 'contact_name', label: 'Principal Investigator (PI)', type: 'text' },
        { id: 'contact_email', label: 'Contact email', type: 'text' },
        { id: 'contact_phone', label: 'Contact phone', type: 'text' }
      ] },
    { id: 'problem', title: 'Clinical Need / Problem Statement', type: 'textarea',
      guidance: 'What clinical or public health problem does this project address? Be specific. Use real epidemiological data if you have it. Think about: disease burden, mortality/morbidity rates, treatment gaps, drug resistance prevalence, healthcare access barriers, diagnostic accuracy limitations, or mental health service shortages.',
      prompt: 'Describe the medical problem this project addresses. What happens to patients if nothing is done?', prefillFrom: 'diagnosis' },
    { id: 'solution', title: 'Proposed Project / Solution', type: 'textarea',
      guidance: 'What will you actually build, test, or deploy? Be concrete. "We will conduct a Phase II randomized controlled trial of [intervention] in [patient population] measuring [primary endpoint]." Avoid vague language \u2014 say what you will physically create, test, or implement.',
      prompt: 'Describe what you will build, test, or implement. Be specific about clinical endpoints, patient populations, and deliverables.' },
    { id: 'impact', title: 'Impact / Expected Outcomes', type: 'textarea',
      guidance: 'What changes because of this project? Quantify if possible. "Reduces 30-day readmission rate by X%" or "Enables Y community health centers to screen for condition Z" or "Prevents $N in unnecessary emergency department visits."',
      prompt: 'What measurable impact will this project have on patient outcomes or healthcare delivery? Include numbers.' },
    { id: 'budget', title: 'Budget / Use of Funds', type: 'fields',
      guidance: 'How much money do you need and what will you spend it on? NIH and FDA reviewers expect rigorous budgeting aligned with NIH modular or detailed budget formats. Every dollar must have a purpose tied to a clinical deliverable.',
      fields: [
        { id: 'total_amount', label: 'Total funding requested ($)', type: 'text', placeholder: 'e.g., 500000' },
        { id: 'personnel', label: 'Personnel costs', type: 'text', placeholder: 'PI, co-investigators, research coordinators, biostatisticians, clinical staff' },
        { id: 'clinical', label: 'Clinical costs', type: 'text', placeholder: 'Patient recruitment, clinical procedures, laboratory tests, imaging' },
        { id: 'technology', label: 'Technology / equipment', type: 'text', placeholder: 'Medical devices, diagnostic equipment, health IT systems, data platforms' },
        { id: 'professional', label: 'Professional services', type: 'text', placeholder: 'CRO fees, IRB review, DSMB, regulatory consulting, biostatistics' },
        { id: 'travel', label: 'Travel / site visits', type: 'text', placeholder: 'Multi-site coordination, conference presentations, FDA meetings' },
        { id: 'indirect', label: 'Indirect / overhead rate', type: 'text', placeholder: 'e.g., negotiated F&A rate or de minimis 10%' },
        { id: 'match', label: 'Cost share / match (if required)', type: 'text', placeholder: 'Your contribution amount' }
      ] },
    { id: 'timeline', title: 'Timeline / Milestones', type: 'textarea',
      guidance: 'When will each phase of the project happen? NIH grants typically require annual progress reports. Clinical trials need protocol milestones aligned to enrollment, treatment, and follow-up phases.',
      prompt: 'List major milestones with target dates. Example: Q1: IRB approval + site activation. Q2: Patient enrollment begins. Q3-Q6: Treatment phase. Q7-Q8: Follow-up + data collection. Q9-Q10: Analysis + manuscript preparation. Q11-Q12: Publication + dissemination.' },
    { id: 'documents', title: 'Required Documents', type: 'checklist',
      guidance: 'Most NIH, FDA, and biomedical research grants require supporting documents demonstrating clinical rigor, patient safety, and institutional capacity.',
      items: ['NIH Biosketch for PI and key personnel', 'Budget narrative / justification', 'Letters of support from clinical sites', 'IRB approval or pending application', 'Data Safety Monitoring Board (DSMB) plan', 'Clinical trial protocol (if applicable)', 'SAM.gov registration confirmation', 'Institutional capability statement', 'Human subjects protection plan', 'HIPAA compliance documentation', 'FDA IND/IDE status (if applicable)', 'ClinicalTrials.gov registration (if applicable)'] },
    { id: 'review', title: 'Final Review', type: 'review',
      guidance: 'Review everything before submitting. The auditor will check completeness, scientific rigor, clinical feasibility, patient safety protections, and regulatory readiness.' },
    { id: 'auditor', title: 'Auditor Decision', type: 'auditor',
      guidance: 'This section is for the auditor reviewing this grant application for clinical research and medical innovation viability.' }
  ];

  // ══════════════════════════════════════════════════════════════════════
  // SECTION DEFINITIONS — PATENT (14 sections, medicine-specific)
  // ══════════════════════════════════════════════════════════════════════

  var PATENT_SECTIONS = [
    { id: 'what', title: 'What This Patent Is', type: 'info',
      guidance: 'A patent gives you the legal right to prevent others from making, using, or selling your invention for 20 years. In the medicine domain, patents commonly cover: novel drug formulations, medical devices, diagnostic methods, surgical techniques (if machine-assisted), telemedicine systems, AI-driven diagnostic algorithms, drug delivery mechanisms, and clinical decision support tools. A provisional patent costs ~$320 and gives you 12 months to file the full version.',
      prompt: 'No input needed \u2014 this is context for the operator.' },
    { id: 'why', title: 'Why This May Be Patentable', type: 'textarea',
      guidance: 'For something to be patentable, it must be: (1) new \u2014 nobody has done it before, (2) useful \u2014 it solves a real clinical problem, (3) non-obvious \u2014 a person skilled in medical technology would not have thought of it easily. Note: naturally occurring biological substances are generally not patentable \u2014 focus on novel applications, formulations, or technical implementations.',
      prompt: 'Why is this medical invention new, useful, and non-obvious? How does it go beyond known clinical approaches?', prefillFrom: 'whyNow' },
    { id: 'title', title: 'Invention Title', type: 'text',
      guidance: 'A clear, descriptive title. Not a marketing name \u2014 a functional description. Example: "System and Method for Early Detection of Sepsis Using Machine Learning Analysis of Continuous Vital Sign Monitoring Data"',
      prompt: 'Enter a descriptive title for the medical technology invention.', prefillFrom: 'title' },
    { id: 'summary', title: 'Invention Summary', type: 'textarea',
      guidance: 'Describe the invention in 2-4 sentences as if explaining to a smart physician who understands medicine but not the specific technology. What does it do? How does it work at a high level?',
      prompt: 'Summarize the medical technology invention in plain English.' },
    { id: 'problem_solved', title: 'Clinical Problem Being Solved', type: 'textarea',
      guidance: 'What specific clinical problem does this invention solve? The patent examiner needs to understand why existing medical tools or methods are inadequate. Think about: diagnostic accuracy, treatment efficacy, patient safety, care coordination, drug delivery precision, or access to care limitations.',
      prompt: 'What clinical problem exists today that this invention fixes?', prefillFrom: 'diagnosis' },
    { id: 'novelty', title: 'Novelty / What Is Different', type: 'textarea',
      guidance: 'What makes this different from everything that already exists in medical technology? Be specific. "Unlike existing sepsis screening tools that use X, this invention uses Y because Z." Emphasize technical novelty in implementation, not just the clinical goal.',
      prompt: 'What is new about this invention compared to what exists in medicine?' },
    { id: 'prior_art', title: 'Prior Art / Existing Alternatives', type: 'textarea',
      guidance: 'List anything similar that already exists \u2014 patents (search patents.google.com), medical devices (FDA 510(k) database), published clinical studies, existing clinical tools. The patent examiner will search for these, so address them proactively. Include existing patents from major medical device and pharma companies.',
      prompt: 'List known prior art and explain how your invention differs from each.' },
    { id: 'technical', title: 'Technical Description', type: 'textarea',
      guidance: 'Describe how the invention works in enough detail that a biomedical engineer could build it. Include: system architecture, sensor specifications, algorithm details, drug formulation chemistry, device mechanics, API specifications, and clinical integration points. The more technically specific, the stronger the patent.',
      prompt: 'Describe the technical implementation. Components, algorithms, biological mechanisms, device architecture.' },
    { id: 'embodiments', title: 'Embodiments / Alternative Versions', type: 'textarea',
      guidance: 'Describe at least 2-3 different ways the invention could be implemented in the medical domain. This broadens your patent coverage. Example: "In one embodiment, the system operates within a hospital EMR. In another, it functions as a standalone mobile diagnostic app for community health workers."',
      prompt: 'List alternative implementations or variations across different clinical contexts.' },
    { id: 'claims', title: 'Claims Development', type: 'textarea',
      guidance: 'Claims define exactly what you own. Start with one broad claim and add narrower ones. Format: "A computer-implemented method for [clinical function] comprising: (a) [step 1], (b) [step 2], (c) [step 3]." Include system claims and method claims. Emphasize technical steps, not abstract medical concepts.',
      prompt: 'Draft 2-3 initial patent claims. Start broad, then narrow. Focus on technical implementation steps.' },
    { id: 'ownership', title: 'Inventorship / Ownership', type: 'fields',
      guidance: 'Who invented this? Patent law requires listing the actual inventors. In medicine, ensure any employment agreements or prior IP assignments from hospitals, universities, or research institutions are addressed. Bayh-Dole Act applies to federally funded inventions.',
      fields: [
        { id: 'inventor1', label: 'Inventor 1 (full legal name)', type: 'text' },
        { id: 'inventor1_role', label: 'Inventor 1 contribution', type: 'text' },
        { id: 'inventor2', label: 'Inventor 2 (if applicable)', type: 'text' },
        { id: 'assignee', label: 'Assignee (organization that owns the patent)', type: 'text', placeholder: 'LIMEN Helix Medical Research LLC' },
        { id: 'filing_type', label: 'Filing type', type: 'select', options: ['Provisional (12-month placeholder)', 'Non-provisional (full filing)', 'PCT International', 'Undecided'] },
        { id: 'prior_ip', label: 'Prior IP obligations', type: 'text', placeholder: 'Hospital/university IP assignments? Bayh-Dole obligations?' },
        { id: 'fda_status', label: 'FDA regulatory status', type: 'select', options: ['Not applicable', 'Pre-submission planned', 'IND filed', 'IDE filed', '510(k) planned', 'PMA planned', 'De Novo planned'] }
      ] },
    { id: 'documents', title: 'Documents / Diagrams', type: 'checklist',
      guidance: 'Medical technology patents benefit greatly from detailed clinical workflow diagrams, device schematics, algorithm flowcharts, and clinical validation data.',
      items: ['System architecture diagram', 'Clinical workflow integration diagram', 'Algorithm flowchart / pseudocode', 'Device schematic / mechanical drawings', 'Prior art comparison table', 'Clinical validation data / pilot study results', 'Inventor declaration signed', 'Assignment agreement (if assigning to company)', 'Prior art search results printout', 'FDA classification research memo', 'Bayh-Dole compliance check (if federally funded)'] },
    { id: 'review', title: 'Filing Readiness Review', type: 'review',
      guidance: 'Review everything before filing. Ensure technical specificity is sufficient to distinguish from abstract medical concepts and existing clinical tools.' },
    { id: 'auditor', title: 'Auditor Decision', type: 'auditor',
      guidance: 'This section is for the auditor reviewing this patent filing for medical technology viability and patentability.' }
  ];

  // ══════════════════════════════════════════════════════════════════════
  // STYLES
  // ══════════════════════════════════════════════════════════════════════

  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.eep-panel{margin-top:8px;border:1px solid rgba(201,169,78,0.08);border-radius:3px;background:rgba(5,8,16,0.5)}',
      '.eep-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer;user-select:none}',
      '.eep-header:hover{background:rgba(201,169,78,0.03)}',
      '.eep-track-label{font-size:0.32rem;letter-spacing:2px;text-transform:uppercase}',
      '.eep-track-grant{color:#5ab5a0}',
      '.eep-track-patent{color:#a87adb}',
      '.eep-progress{font-size:0.26rem;color:#807868}',
      '.eep-toggle{font-size:0.22rem;color:rgba(201,169,78,0.25)}',
      '.eep-body{display:none;padding:0 12px 12px}',
      '.eep-body.open{display:block}',
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
      '.eep-field{margin-bottom:6px}',
      '.eep-field-label{font-size:0.30rem;color:#908878;margin-bottom:2px;display:block}',
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
      if (auditorState.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(auditorState.timestamp).toLocaleString() + '</div>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER FOR OPPORTUNITY
  // ══════════════════════════════════════════════════════════════════════

  function renderForOpportunity(oppKey, path, opp) {
    injectStyles();
    var track = path === 'PATENTABLE' ? 'patent' : 'grant';
    var sections = track === 'grant' ? GRANT_SECTIONS : PATENT_SECTIONS;
    var ws = getWorkspace(oppKey, track) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };

    // Prefill from opportunity
    if (opp && !ws._prefilled) {
      ws._prefilled = true;
      if (opp.title && !ws.fields['why']) ws.fields['why'] = opp.title;
      if (opp.diagnosisId && !ws.fields['problem']) ws.fields['problem'] = (opp.diagnosisId || '').replace(/_/g, ' ');
    }
    saveWorkspace(oppKey, track, ws);

    var total = 0, done = 0;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].type !== 'info' && sections[i].type !== 'review' && sections[i].type !== 'auditor') { total++; if (ws.sectionDone && ws.sectionDone[sections[i].id]) done++; }
    }
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    var status = ws.auditor && ws.auditor.status ? ws.auditor.status : 'DRAFT';

    var h = '<div class="eep-panel" data-opp="' + esc(oppKey) + '" data-track="' + track + '">';
    h += '<div class="eep-header" data-toggle="' + oppKey + '-' + track + '">';
    h += '<span class="eep-track-label eep-track-' + track + '">' + track.toUpperCase() + ' APPLICATION</span>';
    h += '<span class="eep-progress">' + pct + '% \u00b7 ' + done + '/' + total + ' \u00b7 <span class="eep-status eep-status-' + status.toLowerCase() + '">' + status + '</span></span>';
    h += '<span class="eep-toggle">\u25BC</span>';
    h += '</div>';
    h += '<div class="eep-body" data-body="' + oppKey + '-' + track + '">';
    for (var si = 0; si < sections.length; si++) {
      h += renderSection(sections[si], ws, oppKey, track);
    }
    h += '</div></div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // WIRE FOR OPPORTUNITY
  // ══════════════════════════════════════════════════════════════════════

  function wireForOpportunity(container, oppKey, path) {
    var track = path === 'PATENTABLE' ? 'patent' : 'grant';
    var panel = container.querySelector('[data-opp="' + oppKey + '"][data-track="' + track + '"]');
    if (!panel) return;

    var header = panel.querySelector('[data-toggle="' + oppKey + '-' + track + '"]');
    var body = panel.querySelector('[data-body="' + oppKey + '-' + track + '"]');
    if (header && body) {
      header.addEventListener('click', function () {
        body.classList.toggle('open');
        var t = header.querySelector('.eep-toggle');
        if (t) t.textContent = body.classList.contains('open') ? '\u25B2' : '\u25BC';
      });
    }

    var ws = getWorkspace(oppKey, track) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };

    // Wire all inputs
    panel.querySelectorAll('.eep-textarea, .eep-input, .eep-select').forEach(function (el) {
      el.addEventListener('change', function () {
        var field = this.getAttribute('data-field');
        var aud = this.getAttribute('data-auditor');
        if (field) {
          var parts = field.split('.');
          if (parts.length > 1) {
            if (typeof ws.fields[parts[0]] !== 'object') ws.fields[parts[0]] = {};
            ws.fields[parts[0]][parts[1]] = this.value;
          } else {
            ws.fields[field] = this.value;
          }
        }
        if (aud) {
          ws.auditor = ws.auditor || {};
          ws.auditor[aud] = this.value;
        }
        saveWorkspace(oppKey, track, ws);
      });
    });

    // Wire checklist items
    panel.querySelectorAll('.eep-check').forEach(function (el) {
      el.addEventListener('change', function () {
        var sec = this.getAttribute('data-sec');
        var item = this.getAttribute('data-item');
        if (!ws.checks[sec]) ws.checks[sec] = {};
        ws.checks[sec][item] = this.checked;
        saveWorkspace(oppKey, track, ws);
      });
    });

    // Wire section done
    panel.querySelectorAll('.eep-done-check').forEach(function (el) {
      el.addEventListener('change', function () {
        if (!ws.sectionDone) ws.sectionDone = {};
        ws.sectionDone[this.getAttribute('data-sec')] = this.checked;
        saveWorkspace(oppKey, track, ws);
      });
    });

    // Wire auditor actions
    panel.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        if (action === 'print') { window.print(); return; }
        ws.auditor = ws.auditor || {};
        if (action === 'approve') ws.auditor.status = 'APPROVED';
        if (action === 'deny') ws.auditor.status = 'DENIED';
        if (action === 'revise') ws.auditor.status = 'REVISE';
        ws.auditor.timestamp = Date.now();
        saveWorkspace(oppKey, track, ws);

        var newH = renderForOpportunity(oppKey, track === 'grant' ? 'GRANT-ELIGIBLE' : 'PATENTABLE', null);
        panel.outerHTML = newH;
        wireForOpportunity(container, oppKey, track === 'grant' ? 'GRANT-ELIGIBLE' : 'PATENTABLE');
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENMedicineExecutionPanels = {
    renderForOpportunity: renderForOpportunity,
    wireForOpportunity: wireForOpportunity,
    GRANT_SECTIONS: GRANT_SECTIONS,
    PATENT_SECTIONS: PATENT_SECTIONS
  };

  console.log('[MedicineExecutionPanels] Loaded — grant (12 sections) + patent (14 sections) workspaces ready');
})();
