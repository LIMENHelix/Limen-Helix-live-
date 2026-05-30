#!/usr/bin/env node
// One-shot test: 8-pass Walmart grant draft via multi-pass runner logic,
// persisted to /api/limen-engine-output. Mirrors the browser-side
// LIMENMultiPassRunner.runMultiPass() flow.

const ENDPOINT = process.env.LIMEN_BASE_URL ? process.env.LIMEN_BASE_URL + '/api/expand-artifact-claude'
                                            : 'https://limenhelix.com/api/expand-artifact-claude';
const PERSIST  = process.env.LIMEN_BASE_URL ? process.env.LIMEN_BASE_URL + '/api/limen-engine-output'
                                            : 'https://limenhelix.com/api/limen-engine-output';
const LANE = process.env.LIMEN_LANE || 'grant';
const sig = 'multipass-test-' + LANE + '-' + Date.now();

const contextPacket = {
  subject: {
    cik: '0000104169', slug: 'walmart', entityName: 'Walmart Inc.',
    industry: { naics: '452319', label: 'All Other General Merchandise Stores', descriptor: 'national big-box retail and grocery' },
    proposedScope: {
      title: 'Frontline workforce reskilling for automated order fulfillment operations',
      description: 'Multi-site reskilling program for store-level associates transitioning to micro-fulfillment center roles, focused on robotics-adjacent operations, exception handling, and customer-facing service in hybrid fulfillment environments.',
      problemStatement: 'Retail logistics is transitioning to automated micro-fulfillment, displacing traditional pick-and-pack roles while creating new roles in robotics oversight, exception handling, and last-mile coordination. Existing workforce development pipelines do not address the mid-career transition from in-store retail roles to fulfillment-technology roles.',
      proposedApproach: 'Cohort-based, paid 12-week training combining classroom instruction, on-floor mentorship, and stipend-supported certification across five core competencies: warehouse management system fluency, robotics exception handling, inventory accuracy auditing, customer service in hybrid environments, and basic predictive maintenance.'
    }
  },
  evidence: {
    citations: [
      { author: 'Bessen, J.E.', year: 2019, title: 'Automation and Jobs: When Technology Boosts Employment', journal: 'Economic Policy', volume: '34(100)', pages: '589-626', doi: '10.1093/epolic/eiaa001', source: 'Bessen, J.E. (2019)', sourceType: 'peer-reviewed' },
      { author: 'Acemoglu, D. and Restrepo, P.', year: 2020, title: 'Robots and Jobs: Evidence from US Labor Markets', journal: 'Journal of Political Economy', volume: '128(6)', pages: '2188-2244', doi: '10.1086/705716', source: 'Acemoglu, D. and Restrepo, P. (2020)', sourceType: 'peer-reviewed' }
    ],
    news: [], priorArt: [],
    financial: { latestQuarter: '2026Q1', historyQuarters: 68 }
  }
};

async function pollForDeploy() {
  console.log('=== polling for new deploy (sections catalog in GET) ===');
  const start = Date.now();
  while (Date.now() - start < 900000) {
    try {
      const r = await fetch(ENDPOINT);
      const j = await r.json();
      if (j && j.sections && j.sections.grant && j.sections.grant.length > 0) {
        console.log('=== deploy live, grant has ' + j.sections.grant.length + ' passes ===');
        return j;
      }
    } catch (e) { /* ignore */ }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 30000));
  }
  throw new Error('deploy poll timed out after 15 min');
}

async function main() {
  const catalog = await pollForDeploy();
  const sections = catalog.sections[LANE];

  console.log('');
  console.log('=== firing ' + sections.length + '-pass ' + LANE + ' for Walmart ===');

  let aggregateDraft = '';
  let aggregateSections = [];
  let aggregateOpenItems = [];
  let aggregateChecklist = [];
  let aggregateCitations = [];
  let totalTokens = 0;
  let totalElapsed = 0;
  let lastModel = null;
  let firstAgency = null, firstFormat = null, firstTitle = null;
  const passes = [];

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const priorTitles = aggregateSections.map(s => s.heading || s.id || '');
    const t0 = Date.now();
    console.log('');
    console.log('--- pass ' + (i+1) + '/' + sections.length + ': ' + sec.id + ' (target ' + sec.targetTokens + ' tokens) ---');

    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lane: LANE,
          cik: '0000104169',
          sourcePatternSig: sig,
          readiness: 0.62,
          maxTokens: Math.min(Math.round(sec.targetTokens * 1.3), 16000),
          contextPacket: contextPacket,
          kernelSnapshot: { thing2: { dominantPhase: 'p6', stress: 0.28, trajectory: 'STABLE' }, ts: Date.now() },
          pass: { sectionIndex: i, sectionId: sec.id, sectionName: sec.name, priorSectionTitles: priorTitles }
        })
      });
      const j = await r.json();
      const elapsed = Date.now() - t0;
      totalElapsed += elapsed;

      if (!j.ok) {
        console.log('  FAIL: ' + (j.error || 'unknown') + ' (' + (elapsed/1000).toFixed(1) + 's)');
        passes.push({ sectionIndex: i, sectionId: sec.id, ok: false, error: j.error, elapsedMs: elapsed });
        aggregateDraft += '\n\n---\n\n## [SECTION ' + (i+1) + ' FAILED] ' + sec.name + '\n\n`[REGENERATE_NEEDED: ' + (j.error || 'unknown') + ']`\n';
        continue;
      }

      const outer = j.structured || {};
      const inner = outer.structured || outer;
      const body = j.draftBody || '';
      const outTokens = (j.usage && j.usage.output_tokens) || 0;
      totalTokens += outTokens;
      lastModel = j.model;

      if (!firstAgency && inner.agency_or_office) firstAgency = inner.agency_or_office;
      if (!firstFormat && inner.format_standard) firstFormat = inner.format_standard;
      if (!firstTitle && inner.title) firstTitle = inner.title;

      if (aggregateDraft.length > 0) aggregateDraft += '\n\n---\n\n';
      aggregateDraft += body;

      if (Array.isArray(inner.sections) && inner.sections.length > 0) {
        inner.sections.forEach(s => aggregateSections.push(Object.assign({}, s, { passId: sec.id })));
      } else {
        aggregateSections.push({ heading: sec.name, id: sec.id, completeness: 0.9, passId: sec.id });
      }

      (inner.openItems || []).forEach(oi => aggregateOpenItems.push(Object.assign({}, oi, { passId: sec.id })));
      (inner.readyToSignChecklist || []).forEach(c => aggregateChecklist.push(Object.assign({}, c, { passId: sec.id })));
      (inner.evidenceCitationsUsed || []).forEach(c => aggregateCitations.push(c));

      console.log('  OK: ' + (elapsed/1000).toFixed(1) + 's, ' + outTokens + ' tokens, ' + body.length + ' bytes');
      passes.push({ sectionIndex: i, sectionId: sec.id, ok: true, elapsedMs: elapsed, tokens: outTokens, draftBytes: body.length });
    } catch (err) {
      console.log('  EXCEPTION: ' + err.message);
      passes.push({ sectionIndex: i, sectionId: sec.id, ok: false, error: err.message });
    }
  }

  const totalWords = aggregateDraft.split(/\s+/).filter(Boolean).length;
  console.log('');
  console.log('=== MULTI-PASS COMPLETE ===');
  console.log('total wall: ' + (totalElapsed/1000).toFixed(1) + 's (' + (totalElapsed/60000).toFixed(1) + ' min)');
  console.log('total tokens out: ' + totalTokens);
  console.log('total draft bytes: ' + aggregateDraft.length);
  console.log('total words: ' + totalWords);
  console.log('passes succeeded: ' + passes.filter(p => p.ok).length + '/' + passes.length);

  // Persist
  console.log('');
  console.log('=== persisting ===');
  const persistHeaders = { 'content-type': 'application/json' };
  if (process.env.LIMEN_OPERATOR_TOKEN) {
    persistHeaders.authorization = 'Bearer ' + process.env.LIMEN_OPERATOR_TOKEN;
  }
  const persistRes = await fetch(PERSIST, {
    method: 'POST',
    headers: persistHeaders,
    body: JSON.stringify({
      cik: '0000104169', slug: 'walmart', engineId: 'engine-grant', lane: LANE,
      sourcePatternSig: sig, readiness: 0.62,
      kernelSnapshot: { thing2: { dominantPhase: 'p6', stress: 0.28, trajectory: 'STABLE' }, ts: Date.now() },
      payload: {
        title: firstTitle || 'Grant draft for Walmart workforce reskilling',
        lane: LANE, agency_or_office: firstAgency, format_standard: firstFormat,
        draftBody: aggregateDraft,
        structured: {
          title: firstTitle, lane: LANE,
          agency_or_office: firstAgency, format_standard: firstFormat,
          sections: aggregateSections, openItems: aggregateOpenItems,
          readyToSignChecklist: aggregateChecklist,
          readyToSign: passes.every(p => p.ok),
          wordCount: totalWords, evidenceCitationsUsed: aggregateCitations
        },
        readyToSign: passes.every(p => p.ok),
        openItems: aggregateOpenItems,
        readyToSignChecklist: aggregateChecklist,
        wordCount: totalWords, multiPass: true, passes: passes,
        claudeModel: lastModel, claudeUsage: { output_tokens: totalTokens },
        citations: aggregateCitations
      }
    })
  });
  const pj = await persistRes.json();
  console.log('persist http=' + persistRes.status + ' ok=' + pj.ok);
  console.log('storage=' + pj.storage + ' outputId=' + pj.outputId);
  if (pj.redisError) console.log('REDIS_ERROR=' + pj.redisError);
  if (!pj.ok) {
    console.log('PERSIST_FAIL detail=' + JSON.stringify(pj).slice(0, 500));
    const path = await import('node:path');
    const fs2 = await import('node:fs/promises');
    const fallback = path.resolve('scripts/_persist-fallback-' + LANE + '-' + Date.now() + '.json');
    await fs2.writeFile(fallback, JSON.stringify({
      lane: LANE, sourcePatternSig: sig, draftBody: aggregateDraft,
      title: firstTitle, agency_or_office: firstAgency, format_standard: firstFormat,
      sections: aggregateSections, openItems: aggregateOpenItems,
      readyToSignChecklist: aggregateChecklist, wordCount: totalWords,
      passes: passes, usage: { output_tokens: totalTokens }, model: lastModel
    }, null, 2));
    console.log('LOCAL FALLBACK saved to: ' + fallback);
    process.exit(1);
  }
  console.log('');
  console.log('VIEWER: https://limenhelix.com/helix-artifact.html?id=' + pj.outputId);
  console.log('LIST:   https://limenhelix.com/helix-artifacts.html');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
