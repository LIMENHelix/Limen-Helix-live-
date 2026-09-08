/* Drives the real page in headless Chrome at iPhone width and proves the search bar filters.
   CDP over Node's built-in WebSocket. Local server, stubbed catalogue, nothing leaves the box. */
const http = require('http'), fs = require('fs'), cp = require('child_process'), path = require('path'), os = require('os');

const ROOT = path.join(__dirname, '..');

// No Chrome, no test. This is a rendering claim; there is no honest way to make it
// without a renderer, so it reports SKIPPED rather than passing on nothing.
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(function (c) { try { return fs.existsSync(c); } catch (e) { return false; } });
if (!CHROME) { console.log('SKIPPED: no Chrome on this machine; the search test needs a renderer'); process.exit(0); }
const PAGE = process.argv[2] || 'pages/relay-store.html';
const PORT_CDP = 9341;
const IS_SF = PAGE.indexOf('storefront') >= 0;
const CARD = IS_SF ? '.listing-card' : '.card';
const TITLE = IS_SF ? '.title' : '.ptitle';
const INPUT = IS_SF ? 'searchInput' : 'q';

const LISTINGS = [
  { id: 'a1', title: 'Blue Ceramic Mug', category: 'home', description: 'stoneware', price: 18.5, condition: 'new', quantity: 3, status: 'active', images: [], ts: '2026-09-01T00:00:00Z' },
  { id: 'a2', title: 'Wool Scarf', category: 'apparel', description: 'merino', price: 26.0, condition: 'new', quantity: 2, status: 'active', images: [], ts: '2026-09-02T00:00:00Z' },
  { id: 'a3', title: 'Cast Iron Skillet', category: 'home', description: 'seasoned pan', price: 41.0, condition: 'good', quantity: 1, status: 'active', images: [], ts: '2026-09-03T00:00:00Z' }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const srv = http.createServer(function (req, res) {
  const u = req.url.split('?')[0];
  if (u === '/' || u === '/relay') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(ROOT, PAGE), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, count: LISTINGS.length, listings: LISTINGS }));
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
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp3-'));
  let chrome = null, ws = null, fails = 0;
  const done = function (code) {
    try { if (ws) ws.close(); } catch (e) {}
    try { if (chrome) chrome.kill(); } catch (e) {}
    try { srv.close(); } catch (e) {}
    process.exit(code);
  };
  const watchdog = setTimeout(function () { console.log('WATCHDOG: gave up'); done(3); }, 120000);

  chrome = cp.spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-sandbox',
    '--disable-background-networking', '--disable-sync', '--disable-component-update',
    '--no-default-browser-check', '--disable-default-apps', '--disable-extensions',
    '--remote-debugging-port=' + PORT_CDP, '--user-data-dir=' + prof,
    '--window-size=390,844', 'http://127.0.0.1:' + port + '/'
  ], { stdio: 'ignore' });

  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    try {
      const list = await getJSON('/json/list');
      page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch (e) {}
    if (!page) await sleep(300);
  }
  if (!page) { console.log('CHROME DID NOT EXPOSE A PAGE TARGET'); done(2); }

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

  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { if (await ev("document.querySelectorAll('" + CARD + "').length>0")) { ready = true; break; } } catch (e) {}
    await sleep(250);
  }

  const A = function (n, c, d) { if (c) console.log('  PASS ' + n); else { console.log('  FAIL ' + n + (d ? ' :: ' + d : '')); fails++; } };
  const cards = () => ev("document.querySelectorAll('" + CARD + "').length");
  const type = v => ev("(function(){var e=document.getElementById('" + INPUT + "');e.value=" + JSON.stringify(v) + ";e.dispatchEvent(new Event('input',{bubbles:true}));})()");

  console.log(PAGE + ' — headless Chrome, 390x844 (iPhone width)');
  A('the shelf rendered', ready, 'no cards appeared');
  A('3 items on the shelf', (await cards()) === 3, 'cards: ' + (await cards()));

  const size = await ev("getComputedStyle(document.getElementById('" + INPUT + "')).fontSize");
  A('input renders at 16px, so iOS will not zoom the page on focus', size === '16px', String(size));
  A('it sits in a real form, so the iOS keyboard Search key has something to submit',
    (await ev("document.getElementById('" + INPUT + "').form !== null")) === true, 'no form ancestor');
  A('enterkeyhint=search puts a Search key on the iOS keyboard',
    (await ev("document.getElementById('" + INPUT + "').getAttribute('enterkeyhint')")) === 'search');

  await type('wool');
  A('typing "wool" narrows the shelf to 1', (await cards()) === 1, 'cards: ' + (await cards()));
  const t1 = await ev("((document.querySelector('" + TITLE + "')||{}).textContent||'')");
  A('and the one left is the Wool Scarf', String(t1).indexOf('Wool') >= 0, String(t1));

  await type('skillet');
  A('"skillet" matches on title', (await cards()) === 1, 'cards: ' + (await cards()));
  await type('seasoned');
  A('"seasoned" matches on description text', (await cards()) === 1, 'cards: ' + (await cards()));
  await type('MUG');
  A('matching is case-insensitive', (await cards()) === 1, 'cards: ' + (await cards()));
  await type('zzzznope');
  A('a miss shows no cards, not all of them', (await cards()) === 0, 'cards: ' + (await cards()));
  await type('');
  A('clearing restores all 3', (await cards()) === 3, 'cards: ' + (await cards()));

  await type('mug');
  await ev("document.getElementById('" + INPUT + "').focus()");
  const before = await ev("location.pathname");
  await ev("document.getElementById('" + INPUT + "').form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");
  await sleep(500);
  A('submitting the form (what the iOS Search key does) filters and stays on the page',
    (await cards()) === 1 && (await ev("location.pathname")) === before,
    'cards: ' + (await cards()) + ' path: ' + (await ev("location.pathname")));
  if (!IS_SF) {
    A('and the on-screen keyboard is dismissed (the input is blurred)',
      (await ev("document.activeElement.id !== '" + INPUT + "'")) === true,
      'focus: ' + (await ev("document.activeElement.id")));
  }

  clearTimeout(watchdog);
  console.log(fails ? '\n' + fails + ' FAILED\n' : '\nALL PASS\n');
  done(fails ? 1 : 0);
});
