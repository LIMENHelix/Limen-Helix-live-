/**
 * test-relay-control-console.js — does the operator console actually SAY it?
 *
 * The status counters existed only in a JSON endpoint the console never called, so an
 * underpayment or a paid-but-never-bought order produced no visible signal anywhere the
 * owner looks. Worse, the outage case rendered as a calm zero. Those are rendering claims,
 * and there is no honest way to make one without a renderer.
 *
 * Drives pages/relay-control.html in real headless Chrome against a stubbed control API
 * and asserts the three states are distinguishable in plain language:
 *   nothing needs you / N things need you / we cannot tell right now.
 *
 * Local server only; nothing leaves the machine. Skips cleanly where there is no Chrome.
 */
const http = require('http'), fs = require('fs'), cp = require('child_process'), path = require('path'), os = require('os');

const ROOT = path.join(__dirname, '..');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(function (c) { try { return fs.existsSync(c); } catch (e) { return false; } });
// 77, NOT 0. scripts/run-tests.mjs treats 0 as PASS and only 77 as SKIP, so exiting 0
// here reported a browser test that never opened a browser as a passing guard on the
// operator console. The reason must be the LAST line printed: the runner shows the final
// non-empty output line as the skip reason.
if (!CHROME) { console.log('SKIPPED: no Chrome on this machine; the console test needs a renderer'); process.exit(77); }

const PORT_CDP = 9347;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The status payload under test. Mutated between cases.
let STATUS = {};
// Counted so a poll that STACKS intervals is visible as a burst of reads, not just as a
// panel that happens to update.
let STATUS_HITS = 0;

const AUTONOMY = {
  ok: true,
  config: { mode: 'queue', perOrderCapUsd: 50, dailyCeilingUsd: 200, minMarginUsd: 8, minMarginPct: 0.15 },
  status: { spentToday: 0, remainingToday: 200, marginToday: 0, awaitingApproval: 0 }
};

const srv = http.createServer(function (req, res) {
  const u = new URL(req.url, 'http://h');
  if (u.pathname === '/' ) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(ROOT, 'pages/relay-control.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  const action = u.searchParams.get('action');
  if (action === 'autonomy') return res.end(JSON.stringify(AUTONOMY));
  if (action === 'status') { STATUS_HITS++; return res.end(JSON.stringify(STATUS)); }
  if (action === 'readiness') return res.end(JSON.stringify({ ok: true, checks: [] }));
  if (action === 'pending-approvals') return res.end(JSON.stringify({ ok: true, approvals: [] }));
  if (action === 'inventory') return res.end(JSON.stringify({ ok: true, count: 0, totalCost: 0, totalSell: 0, listings: [], bySupplier: {} }));
  res.end(JSON.stringify({ ok: true }));
});

function getJSON(p) {
  return new Promise(function (ok, no) {
    http.get('http://127.0.0.1:' + PORT_CDP + p, function (r) {
      let d = ''; r.on('data', c => d += c); r.on('end', function () { try { ok(JSON.parse(d)); } catch (e) { no(e); } });
    }).on('error', no);
  });
}

srv.listen(0, async function () {
  const port = srv.address().port;
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpctl-'));
  let chrome = null, ws = null, fails = 0;
  const done = function (code) {
    try { if (ws) ws.close(); } catch (e) {}
    try { if (chrome) chrome.kill(); } catch (e) {}
    try { srv.close(); } catch (e) {}
    process.exit(code);
  };
  const watchdog = setTimeout(function () { console.log('WATCHDOG: gave up'); done(3); }, 120000);

  chrome = cp.spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-sync', '--disable-component-update',
    '--no-default-browser-check', '--disable-default-apps', '--disable-extensions',
    '--remote-debugging-port=' + PORT_CDP, '--user-data-dir=' + prof,
    '--window-size=1100,900', 'http://127.0.0.1:' + port + '/'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  // Chrome's own stderr, kept so a startup failure is diagnosable. With stdio ignored and
  // no error handler, every failure below looked identical: 'no page target', with no way
  // to tell a missing shared library from a crashed sandbox from a busy port.
  let chromeErr = '';
  try { chrome.stderr.on('data', function (d) { chromeErr += d.toString().slice(0, 2000); }); } catch (e) {}
  chrome.on('error', function (e) { chromeErr += '\nspawn error: ' + (e && e.message); });

  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    try { page = (await getJSON('/json/list')).find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (e) {}
    if (!page) await sleep(300);
  }
  if (!page) {
    // SKIP, not FAIL. No assertion about the console ever ran, so this says nothing about
    // relay-control.html. Reporting it as a product failure would put a permanent red on
    // the branch for an environment fact and train everyone to ignore the signal. What it
    // must not do is report PASS. The captured stderr is printed first so the next run
    // says WHY; the skip reason has to be the last line for the runner to pick it up.
    if (chromeErr.trim()) console.log('chrome stderr: ' + chromeErr.trim().split('\n').slice(0, 6).join(' | '));
    console.log('SKIPPED: Chrome at ' + CHROME + ' never exposed a CDP page target; no console assertion ran');
    done(77);
  }

  ws = new WebSocket(page.webSocketDebuggerUrl);
  const waiters = new Map(); let seq = 0;
  ws.addEventListener('message', function (e) {
    let m; try { m = JSON.parse(e.data); } catch (x) { return; }
    if (waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); }
  });
  await new Promise(function (ok, no) {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('ws error')), { once: true });
  });
  const send = (method, params) => new Promise(function (ok) {
    const id = ++seq; waiters.set(id, ok);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const ev = async function (expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    const res = r.result || {};
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails).slice(0, 300));
    return res.result ? res.result.value : undefined;
  };
  await send('Runtime.enable');

  const A = function (n, c, d) { if (c) console.log('  PASS ' + n); else { console.log('  FAIL ' + n + (d ? ' :: ' + d : '')); fails++; } };
  const panel = () => ev("(document.getElementById('attention')||{}).innerText||''");
  // Re-run the refresh loop so the page picks up the new STATUS, then let it settle.
  const reload = async function () { await ev("refresh()"); await sleep(600); };

  // unlock
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if (await ev("!!document.getElementById('key')")) { ready = true; break; } } catch (e) {}
    await sleep(250);
  }
  A('the console loaded', ready, 'no key field');
  await ev("document.getElementById('key').value='testkey'; unlock();");
  await sleep(900);
  A('the operator key unlocks the board',
    (await ev("!document.getElementById('main').classList.contains('hide')")) === true);

  console.log('\nSTATE 1 — nothing wrong');
  STATUS = { ok: true, needsAttention: 0, heldForReview: 0, openTasks: 0, strandedWithoutTask: 0, awaitingPayment: 3, paidUnfulfilled: 0, heldReasons: [] };
  await reload();
  let t = await panel();
  A('it says, in words, that nothing needs the operator', /Nothing needs you/i.test(t), JSON.stringify(t).slice(0, 160));
  A('and it is painted as the all-clear, not as a warning',
    (await ev("!!document.querySelector('#attention .allclear')")) === true);

  console.log('\nSTATE 2 — a customer paid and nothing was bought');
  STATUS = { ok: true, needsAttention: 2, heldForReview: 1, openTasks: 0, strandedWithoutTask: 1, awaitingPayment: 0, paidUnfulfilled: 1,
    heldReasons: [{ orderId: 'ord_777', reason: 'paid $18.00, expected $22.25' }] };
  await reload();
  t = await panel();
  A('it says how many things need the operator', /2 things need you/i.test(t), JSON.stringify(t).slice(0, 200));
  A('it names the paid-but-never-bought order in plain words',
    /Paid, but never bought/i.test(t), JSON.stringify(t).slice(0, 300));
  A('it names the held payment', /held for review/i.test(t), JSON.stringify(t).slice(0, 300));
  A('and it shows the actual reason, not just a count',
    t.indexOf('ord_777') >= 0 && /expected \$22\.25/.test(t), JSON.stringify(t).slice(0, 300));
  A('it is NOT painted as the all-clear',
    (await ev("!!document.querySelector('#attention .allclear')")) === false);

  console.log('\nSTATE 3 — the database is down (the state that used to read as calm)');
  STATUS = { ok: true, needsAttention: null, heldForReview: null, openTasks: 0, strandedWithoutTask: null,
    awaitingPayment: null, paidUnfulfilled: null, ordersUnavailable: 'redis-get-unreachable', heldReasons: [] };
  await reload();
  t = await panel();
  A('an outage does NOT report that nothing needs attention',
    !/Nothing needs you/i.test(t), JSON.stringify(t).slice(0, 200));
  A('it says plainly that it cannot tell', /cannot (read|tell)/i.test(t), JSON.stringify(t).slice(0, 250));
  A('it warns against reading that as fine', /unknown/i.test(t), JSON.stringify(t).slice(0, 250));
  A('and it is painted as an alarm, not as the all-clear',
    (await ev("!!document.querySelector('#attention .unknown')")) === true &&
    (await ev("!!document.querySelector('#attention .allclear')")) === false);

  console.log('\nSTATE 4 — a null count with no error field is still not zero');
  STATUS = { ok: true, needsAttention: null, heldForReview: null, openTasks: 0, strandedWithoutTask: null, awaitingPayment: null, paidUnfulfilled: null, heldReasons: [] };
  await reload();
  t = await panel();
  A('a null attention count is never rendered as an all-clear',
    !/Nothing needs you/i.test(t) && (await ev("!!document.querySelector('#attention .unknown')")) === true,
    JSON.stringify(t).slice(0, 200));

  console.log('\nSTATE 5 — an approval that was accepted but bought nothing');
  await ev("FAILED_APPROVALS = []; paintApprovals([]);");
  await ev("(function(){ window.__origPost = post; post = function(){ return Promise.resolve({ ok:false, reason:'CJ wallet has $0.00, leaving $0.00 for a $22.25 purchase' }); }; })()");
  await ev("approve('dec_stuck_1')");
  await sleep(700);
  const ap = await ev("(document.getElementById('approvals')||{}).innerText||''");
  A('a refused purchase does NOT vanish silently',
    /Approved, but NOT bought/i.test(ap), JSON.stringify(ap).slice(0, 250));
  A('it shows the actual reason the money did not move',
    /CJ wallet has \$0\.00/.test(ap), JSON.stringify(ap).slice(0, 250));
  A('and it stays retryable, so the reservation is not stranded',
    /Try again/i.test(ap) &&
    (await ev("document.getElementById('approvals').innerHTML.indexOf('dec_stuck_1') >= 0")) === true,
    JSON.stringify(ap).slice(0, 250));
  A('the failure survives a refresh instead of being wiped by it',
    (await ev("(function(){ paintApprovals([]); return document.getElementById('approvals').innerText; })()")).indexOf('Approved, but NOT bought') >= 0);

  // ── STATE 6 ─────────────────────────────────────────────────────────────
  // The panel is an ALARM, so it has to keep looking. The status read ran only inside
  // refresh() and nothing called it again, so a console left open on a green all-clear kept
  // showing it while orders piled up underneath. Proven WITHOUT touching refresh(): the
  // page must notice on its own.
  console.log('\nSTATE 6 — the all-clear does not outlive the condition that produced it');
  STATUS = { ok: true, needsAttention: 0, heldForReview: 0, openTasks: 0, strandedWithoutTask: 0, awaitingPayment: 0 };
  // Set the interval, then let refresh() do the wiring. The test must NOT call
  // startPolling() itself: doing so proved only that the function works, and a page that
  // never called it still passed. Reintroducing the missing call is what caught that.
  await ev("POLL_MS = 400;");
  await reload();
  A('it starts on a genuine all-clear', /Nothing needs you/i.test(await panel()));

  // The world changes. Nobody clicks anything and nobody reloads.
  STATUS = { ok: true, needsAttention: 2, heldForReview: 1, openTasks: 1, strandedWithoutTask: 0, awaitingPayment: 0 };
  await sleep(1400);
  const polled = await panel();
  A('the panel notices on its own, with no click and no reload',
    !/Nothing needs you/i.test(polled) && /2 things need you/i.test(polled),
    JSON.stringify(polled).slice(0, 200));

  // ── STATE 7 ─────────────────────────────────────────────────────────────
  // A refresh loop that paints green over an unreadable backend is the confident-zero
  // defect one layer up, and the layer where it would be least visible. The poll must carry
  // the outage rendering, not just the happy path.
  console.log('\nSTATE 7 — the poll must not paint green over a failed read');
  STATUS = { ok: true, needsAttention: 0, heldForReview: 0, openTasks: 0, strandedWithoutTask: 0, awaitingPayment: 0 };
  await sleep(900);
  A('it returns to the all-clear while the read is healthy', /Nothing needs you/i.test(await panel()));
  STATUS = { ok: true, needsAttention: null, ordersUnavailable: 'order store unreadable' };
  await sleep(1400);
  const failedPoll = await panel();
  A('a FAILED status read never renders as the all-clear',
    !/Nothing needs you/i.test(failedPoll), JSON.stringify(failedPoll).slice(0, 220));
  A('and it says plainly that it cannot tell',
    /cannot tell|cannot read/i.test(failedPoll), JSON.stringify(failedPoll).slice(0, 220));

  // The guard, not just the behaviour. unlock() and every action call refresh(), which
  // starts the poll; without clearInterval first, the intervals multiply and the page
  // hammers its own endpoint at a rate that climbs with every operator click.
  await ev("POLL_MS = 300; startPolling(); startPolling(); startPolling();");
  const hitsBefore = STATUS_HITS;
  await sleep(1500);
  const bursts = STATUS_HITS - hitsBefore;
  A('three startPolling calls leave ONE interval running, not three',
    bursts <= 8, bursts + ' status reads in 1.5s at a 300ms interval (one timer is ~5)');
  await ev("if (POLL) clearInterval(POLL);");

  // ── STATE 8 ─────────────────────────────────────────────────────────────
  // A supplier overspend past the 10% tolerance is flagged with needsReview and a
  // reviewReason, and the order then ships. Nothing read either field, so the console could
  // say 'Nothing needs you' over a purchase the code had marked for a human.
  console.log('\nSTATE 8 — a flagged overspend is described, not just counted');
  STATUS = {
    ok: true, needsAttention: 1, heldForReview: 0, openTasks: 0, strandedWithoutTask: 0,
    awaitingPayment: 0, flaggedLines: 1,
    flaggedReasons: [{ orderId: 'ord_over_1', listingId: 'lst_x', reason: 'CJ charged $14.90 against $11.00 approved' }]
  };
  await reload();
  const flagPanel = await panel();
  A('a flagged overspend is not reported as nothing needing you',
    !/Nothing needs you/i.test(flagPanel), JSON.stringify(flagPanel).slice(0, 220));
  A('it is named in words the operator can act on',
    /above the approved price/i.test(flagPanel), JSON.stringify(flagPanel).slice(0, 260));
  A('and the REASON is rendered, not just the count',
    /14\.90/.test(flagPanel) && /11\.00/.test(flagPanel), JSON.stringify(flagPanel).slice(0, 300));

  clearTimeout(watchdog);
  console.log(fails ? '\n' + fails + ' FAILED\n' : '\nALL PASS\n');
  done(fails ? 1 : 0);
});
