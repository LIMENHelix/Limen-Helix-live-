#!/usr/bin/env node
/**
 * fetch-news.js — Per-ticker news refresh from Google News RSS.
 *
 * Reads:  assets/data/command-board-eligible.json (302 ELIGIBLE_NOW tickers)
 * Writes: assets/data/news/<ticker_lower>.json — last 10 headlines per ticker
 *         assets/data/news/_index.json — manifest with timestamps
 *
 * Source: news.google.com/rss/search?q=<TICKER>+stock — public RSS, no API
 * key, no auth. Rate-limited gently (700ms between fetches) since Google
 * doesn't enforce a documented quota but will throttle aggressive callers.
 *
 * Output schema per ticker file:
 *   {
 *     ticker, cik, name, _generated, _source,
 *     headlines: [
 *       { title, link, pubDate, source }
 *     ]
 *   }
 *
 * Per Operating Envelope §6.3: news content is observational, not a kernel
 * claim. The page renders headlines as raw signal — does not aggregate
 * into performance claims, does not gate VALIDATED branding on news
 * presence/absence.
 *
 * Cadence: weekly. Either run manually (this script) or wire to Vercel
 * Cron (vercel.json) once the Pro plan / cron infra is in place.
 *
 * Usage:
 *   node scripts/fetch-news.js                  # all 302 ELIGIBLE_NOW
 *   node scripts/fetch-news.js --batch 50       # cap to 50
 *   node scripts/fetch-news.js --tickers WMT,XOM # specific tickers
 *   node scripts/fetch-news.js --dry-run        # preview, no fetches
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '..', 'assets', 'data');
const FEED_PATH = path.join(DATA_DIR, 'command-board-eligible.json');
const NEWS_DIR  = path.join(DATA_DIR, 'news');
const INDEX_PATH = path.join(NEWS_DIR, '_index.json');

const DELAY_MS = 700;
const TIMEOUT_MS = 20000;
const MAX_HEADLINES = 10;

const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf('--' + name);
  if (i === -1) return def;
  if (argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return true;
}
const BATCH = parseInt(flag('batch', 0), 10) || 0;
const TICKERS_ARG = flag('tickers', null);
const DRY_RUN = !!flag('dry-run', false);

function fetchRSS(query) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en';
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: TIMEOUT_MS, headers: { 'User-Agent': 'limen-news-pull/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
        resolve(data);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Lightweight RSS item extractor — Google News returns <item> blocks with
// <title>, <link>, <pubDate>, <source>. No need for a full XML parser.
function parseRSS(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < MAX_HEADLINES) {
    const block = m[1];
    const grab = (tag) => {
      const r = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>');
      const mm = r.exec(block);
      if (!mm) return null;
      let v = mm[1];
      // Strip CDATA wrapper if present
      const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(v.trim());
      if (cdata) v = cdata[1];
      return v.trim();
    };
    items.push({
      title: grab('title'),
      link: grab('link'),
      pubDate: grab('pubDate'),
      source: grab('source'),
    });
  }
  return items;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!fs.existsSync(FEED_PATH)) {
    console.error('FATAL: ' + FEED_PATH + ' missing — run build-command-board.js first');
    process.exit(1);
  }
  const feed = JSON.parse(fs.readFileSync(FEED_PATH, 'utf8'));
  let companies = (feed.companies || []).filter(c => c.t && c.t.length > 0); // need ticker

  if (TICKERS_ARG && typeof TICKERS_ARG === 'string') {
    const wanted = new Set(TICKERS_ARG.split(',').map(s => s.trim().toUpperCase()));
    companies = companies.filter(c => wanted.has((c.t || '').toUpperCase()));
  }
  if (BATCH > 0) companies = companies.slice(0, BATCH);

  if (!fs.existsSync(NEWS_DIR)) fs.mkdirSync(NEWS_DIR, { recursive: true });

  console.log('fetch-news: ' + companies.length + ' tickers to refresh');
  if (DRY_RUN) {
    companies.slice(0, 10).forEach((c, i) => console.log('  ' + (i + 1) + '. ' + c.t.padEnd(8) + c.n.slice(0, 38)));
    if (companies.length > 10) console.log('  ... and ' + (companies.length - 10) + ' more');
    return;
  }

  const index = [];
  let scored = 0, errors = 0;
  const start = Date.now();

  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    const slug = (c.t || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const outPath = path.join(NEWS_DIR, slug + '.json');
    try {
      const xml = await fetchRSS(c.t + ' stock');
      const headlines = parseRSS(xml);
      const out = {
        ticker: c.t,
        cik: c.c,
        name: c.n,
        _generated: new Date().toISOString(),
        _source: 'news.google.com/rss/search',
        headline_count: headlines.length,
        headlines: headlines,
      };
      fs.writeFileSync(outPath, JSON.stringify(out));
      index.push({ ticker: c.t, cik: c.c, slug: slug, generated: out._generated, count: headlines.length });
      scored++;
    } catch (e) {
      const msg = (e.message || String(e)).slice(0, 120);
      index.push({ ticker: c.t, cik: c.c, slug: slug, error: msg });
      errors++;
    }

    if ((scored + errors) % 25 === 0 && (scored + errors) > 0) {
      console.log('  ' + (scored + errors) + '/' + companies.length + ' (scored=' + scored + ' errors=' + errors + ')');
    }
    if (i < companies.length - 1) await sleep(DELAY_MS);
  }

  fs.writeFileSync(INDEX_PATH, JSON.stringify({
    _generated: new Date().toISOString(),
    _total: index.length,
    _scored: scored,
    _errors: errors,
    tickers: index,
  }, null, 0));

  const dur = Math.round((Date.now() - start) / 1000);
  console.log('\n──── DONE ────');
  console.log('Run: ' + dur + 's, scored=' + scored + ', errors=' + errors);
  console.log('Index: ' + INDEX_PATH);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
