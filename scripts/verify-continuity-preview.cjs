'use strict';
// Existing Git-linked preview only. No deployment, provider action or browser write request is permitted.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const puppeteer = require('puppeteer');
const evidencePath = process.argv[2];
const accessPath = process.argv[3];
if (!evidencePath || !accessPath) throw Error('Supply evidence output and private preview access paths');
(async () => {
  const access = JSON.parse(fs.readFileSync(accessPath, 'utf8')), origin = new URL(access.url).origin;
  const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
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
    await page.goto(access.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    for (const route of ['/civilization-opportunities', '/civilization', '/domain-console?domain=culture', '/helix-brain-grid']) {
      const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => !!document.querySelector('#execution-observatory .exo-domain'), { timeout: 30000 });
      await page.evaluate(() => window.LIMENExecutionObservatory.refresh());
      const hostedHash = await page.evaluate(async () => { const response = await fetch('/assets/js/civilization/execution-observatory.js', { cache: 'no-store' });
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(await response.text()));
        return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join(''); });
      const expectedHash = require('node:crypto').createHash('sha256').update(require('node:child_process').execFileSync('git', ['show', 'HEAD:assets/js/civilization/execution-observatory.js'])).digest('hex');
      assert.equal(hostedHash, expectedHash, 'hosted renderer must match the current Git commit');
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
      await (await page.$('#execution-observatory')).screenshot({ path: screenshot, type: 'jpeg', quality: 78 });
      report.pages.push({ route, rendererSha256: hostedHash, status: response.status(), ...observation, screenshot: path.basename(screenshot) });
    }
    report.renderComplete = true;
    report.resultEndpoints = await page.evaluate(async () => { const domains = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','health','industry','infrastructure','intelligence','law','population','religion','research','supplyChain','technology'];
      const results = []; let next = 0;
      await Promise.all(Array.from({ length: 4 }, async () => { while (next < domains.length) {
        const domain = domains[next++], url = '/api/product-domain-learning-state?domain=' + domain;
        try { const response = await fetch(url, { signal: AbortSignal.timeout(15000) }), body = await response.json();
          results.push({ domain, status: response.status, returnedDomain: body.domain || null, resultStatus: body.status || null,
            reason: body.reason || body.error || null, ready: body.learningGate?.ready === true }); }
        catch (error) { results.push({ domain, status: null, reason: error.name === 'TimeoutError' ? 'result-read-timeout' : 'result-read-failed', ready: false }); }
      } })); return results; });
    report.resultEndpointsComplete = report.resultEndpoints.every(result => result.status != null);
    report.complete = report.renderComplete && report.resultEndpointsComplete;
    if (!report.complete) process.exitCode = 1;
  } catch (error) { report.complete = false; report.failure = String(error.message).replace(new URL(access.url).search, '').slice(0, 240); process.exitCode = 1; }
  finally { await browser.close(); fs.writeFileSync(evidencePath, JSON.stringify(report, null, 2) + '\n'); }
  process.stdout.write(JSON.stringify({ complete: report.complete, pages: report.pages.length,
    cards: report.pages.map(p => p.cards.length), responses: report.responses, blockedRequests: report.blockedRequests.length, errors: report.errors.length, failure: report.failure }) + '\n');
})();
