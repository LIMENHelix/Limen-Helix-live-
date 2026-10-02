'use strict';
// Existing Git-linked preview only. No deployment, provider action or browser write request is permitted.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const puppeteer = require('puppeteer');
const evidencePath = process.argv[2];
const accessPath = process.argv[3];
if (!evidencePath || !accessPath) throw Error('Supply evidence output and private preview access paths');
async function readResults(origin, cookie) {
  const domains = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','health','industry','infrastructure','intelligence','law','population','religion','research','supplyChain','technology'];
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (next < domains.length) {
    const domain = domains[next++], started = Date.now();
    try {
      const response = await fetch(origin + '/api/product-domain-learning-state?domain=' + domain,
        { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      results.push({ domain, status: response.status, elapsedMs: Date.now() - started,
        returnedDomain: body.domain || null, ownerMatches: body.domain === domain, resultStatus: body.status || null,
        reason: body.reason || body.error || null, ready: body.learningGate?.ready === true });
    } catch (error) { results.push({ domain, status: null, elapsedMs: Date.now() - started,
      reason: error.name === 'TimeoutError' ? 'result-read-timeout' : 'result-read-failed', ready: false }); }
  } }));
  return results;
}
(async () => {
  const access = JSON.parse(fs.readFileSync(accessPath, 'utf8')), origin = new URL(access.url).origin;
  const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 15000, ...(chrome ? { executablePath: chrome } : {}) });
  const report = { schemaVersion: 'continuity-preview-render/1.0', measuredAt: new Date().toISOString(), origin,
    evidenceLevel: 'GIT-LINKED-PREVIEW', sourceCommit: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), writeRequestsAllowed: false, blockedRequests: [], errors: [], responses: [], pages: [] };
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1480, height: 1060 });
    await page.setRequestInterception(true);
    const reads = new Set(['/api/brain-cognition', '/api/limen-autofire-log', '/api/domain-snapshot', '/api/product-domain-learning-state']);
    page.on('request', request => {
      const url = new URL(request.url());
      const sameOrigin = url.origin === origin;
      const allowed = sameOrigin && ['GET', 'HEAD'].includes(request.method()) &&
        (!url.pathname.startsWith('/api/') || reads.has(url.pathname));
      if (allowed) request.continue();
      else { report.blockedRequests.push({ method: request.method(), path: url.pathname, reason: 'outside-read-only-verification-scope' }); request.abort(); }
    });
    page.on('pageerror', error => report.errors.push(String(error.message).slice(0, 220)));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/') || url.pathname.endsWith('execution-observatory.js')) report.responses.push({ path: url.pathname, status: response.status() });
    });
    // This access URL is private and must never be written to evidence or shown in output.
    report.stage = 'private-preview-access';
    await page.goto(access.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    report.stage = 'result-endpoint-reads';
    const cookies = await page.cookies(origin);
    report.resultEndpoints = await readResults(origin, cookies.map(cookie => cookie.name + '=' + cookie.value).join('; '));
    report.resultEndpointsComplete = report.resultEndpoints.every(result => result.status != null && (result.status !== 200 || result.ownerMatches));
    // Hash the immutable preview asset outside the browser. The isolated probe
    // showed a browser-protocol stall here while the same grid DOM rendered.
    report.stage = 'renderer-hash';
    const renderer = await fetch(origin + '/assets/js/civilization/execution-observatory.js', {
      headers: { cookie: cookies.map(cookie => cookie.name + '=' + cookie.value).join('; ') },
      redirect: 'manual', signal: AbortSignal.timeout(15000)
    });
    assert.equal(renderer.status, 200);
    const hostedHash = require('node:crypto').createHash('sha256').update(await renderer.text()).digest('hex');
    const expectedHash = require('node:crypto').createHash('sha256').update(require('node:child_process').execFileSync('git', ['show', 'HEAD:assets/js/civilization/execution-observatory.js'])).digest('hex');
    assert.equal(hostedHash, expectedHash, 'hosted renderer must match the current Git commit');
    for (const route of ['/civilization-opportunities', '/civilization', '/domain-console?domain=culture', '/helix-brain-grid']) {
      report.stage = 'navigate:' + route;
      const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => !!document.querySelector('#execution-observatory .exo-domain'), { timeout: 30000 });
      report.stage = 'refresh:' + route;
      await page.evaluate(() => window.LIMENExecutionObservatory.refresh());
      report.stage = 'read-domain-cards:' + route;
      const observation = await page.evaluate(() => {
        const el = document.getElementById('execution-observatory');
        return { title: document.title, attached: !!el, rendererPresent: typeof window.LIMENExecutionObservatory?.refresh === 'function',
          cards: Array.from(el.querySelectorAll('.exo-domain')).map(card => ({
            domain: card.querySelector('.exo-domain-name')?.textContent || null,
            text: card.innerText.slice(0, 1800)
          })), error: el.querySelector('.exo-error')?.textContent || null };
      });
      assert(observation.attached && observation.rendererPresent, 'hosted observatory is absent');
      assert.equal(observation.cards.length, 20, 'hosted observatory must retain twenty domain cards');
      const screenshot = evidencePath.replace(/\.json$/, '') + '-' + report.pages.length + '.jpg';
      const evidence = { route, rendererSha256: hostedHash, status: response.status(), ...observation };
      report.pages.push(evidence);
      report.stage = 'viewport-screenshot:' + route;
      await page.screenshot({ path: screenshot, type: 'jpeg', quality: 78, fullPage: false });
      evidence.screenshot = path.basename(screenshot);
      evidence.screenshotScope = 'viewport; twenty-card coverage is DOM evidence';
    }
    report.renderComplete = true;
    report.stage = 'complete';
    report.complete = report.renderComplete && report.resultEndpointsComplete;
    if (!report.complete) process.exitCode = 1;
  } catch (error) { report.complete = false; report.failure = String(error.message).replace(new URL(access.url).search, '').slice(0, 240); process.exitCode = 1; }
  finally { await browser.close(); fs.writeFileSync(evidencePath, JSON.stringify(report, null, 2) + '\n'); }
  process.stdout.write(JSON.stringify({ complete: report.complete, pages: report.pages.length,
    cards: report.pages.map(p => p.cards.length), resultReads: report.resultEndpoints?.length || 0,
    resultEndpointsComplete: report.resultEndpointsComplete === true, stage: report.stage,
    responses: report.responses, blockedRequests: report.blockedRequests.length, errors: report.errors.length, failure: report.failure }) + '\n');
})();
