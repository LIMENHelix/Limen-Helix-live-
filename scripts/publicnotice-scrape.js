/**
 * publicnotice-scrape.js — middle-layer supply from state public-notice sites (Column/MSPN
 * platform: georgiapublicnotice.com, floridapublicnotices.com, etc). Non-judicial states (GA)
 * publish the foreclosure/tax-sale notice weeks BEFORE the sale = the earliest legal signal.
 *
 * The notice PAGES are plain HTML; the SEARCH is a React SPA whose API isn't obvious statically.
 * So we drive the search with a headless browser, CAPTURE the search API call, collect the
 * /notices/{id} result links, then parse each notice's legal text into a deal.
 *
 * PN_DEBUG=1 → diagnostic: dump the search UI, the captured network (find the API), notice links,
 *              and one parsed notice. No write. Run this first to map a new site, then wire the real run.
 * PN_SITE (default georgiapublicnotice.com), PN_QUERY (default "notice of sale foreclosure").
 */
'use strict';
var puppeteer, launchOpts = { headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] };
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require('puppeteer-core'); launchOpts.executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'; }

var SITE = process.env.PN_SITE || 'georgiapublicnotice.com';
var QUERY = process.env.PN_QUERY || 'notice of sale under power foreclosure';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

async function run() {
  var browser = await puppeteer.launch(launchOpts);
  var page = await browser.newPage();
  await page.setUserAgent(UA);

  // capture API-ish network (the search backend we couldn't find statically)
  var api = [];
  page.on('response', async function (resp) {
    try {
      var u = resp.url(), ct = (resp.headers()['content-type'] || '');
      if (u.indexOf('.js') >= 0 || u.indexOf('.css') >= 0 || /\.(png|jpg|svg|woff|gif|ico)/.test(u)) return;
      if (/json/i.test(ct) || /search|notice|result|query|api|elastic|amazonaws|execute-api/i.test(u)) {
        var body = ''; try { body = (await resp.text()).slice(0, 400); } catch (e) {}
        api.push({ url: u.slice(0, 160), ct: ct.slice(0, 40), status: resp.status(), sample: body.replace(/\s+/g, ' ') });
      }
    } catch (e) {}
  });

  await page.goto('https://' + SITE + '/search', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2500);

  // dump the search UI so we know how to drive it
  var ui = await page.evaluate(function () {
    var el = function (s) { return [].slice.call(document.querySelectorAll(s)).slice(0, 12).map(function (e) { return (e.name || e.id || e.placeholder || e.type || e.getAttribute('aria-label') || e.textContent || '').toString().replace(/\s+/g, ' ').trim().slice(0, 40); }).filter(Boolean); };
    return { inputs: el('input'), selects: el('select'), buttons: el('button'), links: [].slice.call(document.querySelectorAll('a[href*="/notices/"]')).slice(0, 5).map(function (a) { return a.getAttribute('href'); }) };
  });

  // try to run a search: type the query into the first text input, submit
  var searched = false;
  try {
    var inp = await page.$('input[type="text"], input[type="search"], input:not([type])');
    if (inp) { await inp.click({ clickCount: 3 }); await inp.type(QUERY); await page.keyboard.press('Enter'); await wait(4000); searched = true; }
  } catch (e) {}

  var afterLinks = await page.evaluate(function () {
    return [].slice.call(document.querySelectorAll('a[href*="/notices/"]')).slice(0, 8).map(function (a) { return a.getAttribute('href'); });
  });

  if (process.env.PN_DEBUG) {
    console.log('PNDUMP UI ' + JSON.stringify(ui));
    console.log('PNDUMP SEARCHED ' + searched + ' resultLinks ' + JSON.stringify(afterLinks));
    api.slice(0, 12).forEach(function (a) { console.log('PNDUMP API ' + JSON.stringify(a)); });
    // parse one notice if we found a link
    var link = (afterLinks[0] || ui.links[0]);
    if (link) {
      var nurl = link.indexOf('http') === 0 ? link : ('https://' + SITE + link);
      var np = await browser.newPage(); await np.setUserAgent(UA);
      await np.goto(nurl, { waitUntil: 'domcontentloaded', timeout: 40000 }); await wait(1500);
      var text = await np.evaluate(function () { return (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 900); });
      console.log('PNDUMP NOTICE ' + nurl);
      console.log('PNDUMP NOTICETEXT ' + text);
      await np.close();
    }
    await browser.close();
    console.log('== PN_DEBUG done ==');
    return;
  }

  await browser.close();
  console.log('publicnotice-scrape: non-debug run not yet wired (map via PN_DEBUG first).');
}
run().catch(function (e) { console.error('PN FATAL', e && e.stack || e); process.exit(1); });
