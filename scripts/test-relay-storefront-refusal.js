/**
 * test-relay-storefront-refusal.js — does the SHOPPER get told what went wrong?
 *
 * Closing the cost leak genericised every checkout refusal into one sentence, and the
 * storefront then threw away the per-line array entirely and printed it. A real customer
 * read "Nothing has been charged. Remove these and try again", with no item named and
 * nothing to do about it, and left. That is a rendering claim, and there is no honest way
 * to make one without a renderer.
 *
 * Drives pages/relay-store.html in real headless Chrome against a stubbed checkout API and
 * asserts a refusal names the item, gives its own reason per line, quotes no shipping fee,
 * and leaks no figure. Local server only; nothing leaves the machine. Skips cleanly where
 * there is no Chrome and no WebSocket client.
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

// A WEBSOCKET CLIENT THAT EXISTS ON EVERY SUPPORTED NODE.
//
// package.json engines allows ^20.19.0, and Node 20 has no unflagged global WebSocket. The
// runner launches this script with plain process.execPath, so on a Node 20 machine WITH
// Chrome installed execution reached the CDP connect and threw 'ReferenceError: WebSocket
// is not defined' before a single assertion ran. CI is on Node 22 and never saw it, which
// is the same shape as the bug this file was fixed for once already: a browser test that
// does not run where it claims to.
//
// undici is already a direct dependency and ships a spec WebSocket, so this adds nothing;
// the global is preferred where it exists and undici is the fallback. If neither is
// available the file SKIPS rather than failing, because that is a statement about the
// runtime and not about relay-control.html.
const WS = globalThis.WebSocket || (function () {
  try { return require('undici').WebSocket; } catch (e) { return null; }
})();
if (!WS) { console.log('SKIPPED: no WebSocket client on this runtime; the console test needs one to drive CDP'); process.exit(77); }

const PORT_CDP = 9348;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The status payload under test. Mutated between cases.
// The refusal the server will hand back. Mutated per case.
let REFUSAL = null;
// The catalogue the page loads, so a refused line has a real title to name.
const CATALOG = [
  { id: 'rls_case', title: 'Silicone phone case, matte black', price: 16.52, category: 'other',
    condition: 'new', quantity: 5, image: null, description: 'x' },
  { id: 'rls_cable', title: 'Braided USB-C cable, 2m', price: 14.00, category: 'other',
    condition: 'new', quantity: 5, image: null, description: 'x' }
];

const srv = http.createServer(function (req, res) {
  const u = new URL(req.url, 'http://h');
  if (u.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(ROOT, 'pages/relay-store.html'), 'utf8'));
  }
  const view = u.searchParams.get('view');
  if (view === 'cart-checkout') {
    // A REAL 409 SHAPE, taken from what relay-cart-checkout actually returns.
    res.writeHead(409, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(REFUSAL));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if (view === 'policy') {
    return res.end(JSON.stringify({ version: 'v1', headline: 'All sales final',
      confirmLabel: 'I understand', body: 'Final sale.' }));
  }
  if (view === 'catalog') return res.end(JSON.stringify({ ok: true, listings: CATALOG }));
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

  ws = new WS(page.webSocketDebuggerUrl);
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
  const payMsg = () => ev("(document.getElementById('payMsg')||{}).innerText||''");

  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if (await ev("typeof CATALOG !== 'undefined' && CATALOG.length === 2")) { ready = true; break; } } catch (e) {}
    await sleep(250);
  }
  A('the storefront loaded its catalogue', ready);

  // Drive the real cart and the real checkout modal, not a hand-built payload.
  await ev("CART = { rls_case: 1, rls_cable: 1 }; saveCart(); updateBadge(); renderCart(); checkout();");
  await sleep(400);

  // ── STATE 1 — the quote matches what the server will charge ──
  console.log('\nSTATE 1 — the checkout quote adds no shipping fee');
  const modal = await ev("(document.getElementById('mbox')||{}).innerText||''");
  A('shipping is quoted as free, not as a fee',
    /Free/i.test(modal) && !/5\.99/.test(modal), JSON.stringify(modal).slice(0, 300));
  A('and the total equals the sum of the lines',
    /30\.52/.test(modal), JSON.stringify(modal).slice(0, 300));

  const pay = async function () {
    await ev("EL('f_name').value='A B'; EL('f_email').value='a@b.com'; EL('f_line1').value='1 St';" +
             "EL('f_city').value='KC'; EL('f_state').value='MO'; EL('f_zip').value='64111';" +
             "EL('f_country').value='US'; EL('f_policy').checked = true;");
    await ev("payNow()");
    await sleep(900);
  };

  // ── STATE 2 — one refused line, named ──
  console.log('\nSTATE 2 — the refused item is named, with a reason');
  REFUSAL = {
    ok: false, error: 'some items are no longer available',
    message: 'Nothing has been charged. Remove these and try again.',
    unavailable: [{ listingId: 'rls_case', code: 'out-of-stock',
      reason: 'Sold out at our supplier. Remove it to continue.' }]
  };
  await pay();
  const t1 = await payMsg();
  A('the item is named, not just counted',
    /Silicone phone case/i.test(t1), JSON.stringify(t1).slice(0, 300));
  A('and its reason is shown to the shopper',
    /sold out/i.test(t1) && /remove/i.test(t1), JSON.stringify(t1).slice(0, 300));
  A('the generic headline is still shown above it',
    /Nothing has been charged/i.test(t1), JSON.stringify(t1).slice(0, 300));

  // ── STATE 3 — two refused lines, each with its own reason ──
  console.log('\nSTATE 3 — two refusals do not collapse into one');
  REFUSAL = {
    ok: false, error: 'some items are no longer available',
    message: 'Nothing has been charged. Remove these and try again.',
    unavailable: [
      { listingId: 'rls_case', code: 'out-of-stock', reason: 'Sold out at our supplier. Remove it to continue.' },
      { listingId: 'rls_cable', code: 'no-quote', reason: 'We cannot ship this to your address. Try a different address, or remove it.' }
    ]
  };
  await pay();
  const t2 = await payMsg();
  A('both items are named',
    /Silicone phone case/i.test(t2) && /Braided USB-C cable/i.test(t2), JSON.stringify(t2).slice(0, 400));
  A('and each carries its own distinct reason',
    /sold out/i.test(t2) && /address/i.test(t2), JSON.stringify(t2).slice(0, 400));

  // ── STATE 4 — nothing internal reaches the page ──
  console.log('\nSTATE 4 — the rendered refusal leaks nothing');
  const html4 = await ev("(document.getElementById('payMsg')||{}).innerHTML||''");
  A('no dollar figure is rendered', String(html4).indexOf('$') === -1, JSON.stringify(html4).slice(0, 300));
  A('and none of wallet / committed / margin',
    !/wallet|committed|margin/i.test(String(html4)), JSON.stringify(html4).slice(0, 300));

  // ── STATE 5 — a listing the catalogue no longer holds ──
  console.log('\nSTATE 5 — an unknown listing still renders something');
  REFUSAL = {
    ok: false, error: 'some items are no longer available',
    message: 'Nothing has been charged. Remove these and try again.',
    unavailable: [{ listingId: 'rls_vanished', code: 'inactive', reason: 'No longer available.' }]
  };
  await pay();
  const t5 = await payMsg();
  A('a refusal for an item not in the catalogue is not rendered blank',
    /rls_vanished/.test(t5) && /No longer available/i.test(t5), JSON.stringify(t5).slice(0, 300));
  clearTimeout(watchdog);
  console.log(fails ? '\n' + fails + ' FAILED\n' : '\nALL PASS\n');
  done(fails ? 1 : 0);
});
