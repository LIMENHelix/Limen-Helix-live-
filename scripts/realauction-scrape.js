/**
 * realauction-scrape.js — own-nothing distress-supply worker.
 *
 * WHAT: headless-browser scrape of RealAuction county foreclosure calendars
 * (the sites 403 a plain fetch but serve a real browser). Pulls upcoming
 * auction property lists — address, parcel, judgment, appraised market value —
 * from the FL "sweet-spot" ring (high in-migration, off the picked-over cores).
 *
 * WHY: HUD gives us cheap FHA supply; RealAuction gives us DISTRESS supply the
 * market hasn't cleared yet. Equity = appraised market value − final judgment
 * is the arbitrage signal (surplus / assignable-contract candidates). The deal
 * engine reads these alongside HUD; a licensed human closes = the legal gate.
 *
 * RUN: locally  -> node scripts/realauction-scrape.js         (uses system Chrome, dry-run print)
 *      in CI    -> node scripts/realauction-scrape.js         (uses bundled puppeteer chromium + Upstash env -> writes Redis)
 * FLAGS via env: RA_MAX_DATES (dates per county, default 4), RA_COUNTIES (csv of keys to limit).
 *
 * Respect: bounded. Caps dates/county, one page reused, small waits. Do NOT loop-hammer.
 */
'use strict';

// puppeteer-core (local, system Chrome) OR full puppeteer (CI, bundled chromium)
var puppeteer, launchOpts = { headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] };
try {
  puppeteer = require('puppeteer'); // CI: bundled chromium
} catch (e) {
  puppeteer = require('puppeteer-core');
  launchOpts.executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
}

var db = null;
try { db = require('../lib/limen-db'); } catch (e) { /* dry run */ }

// FLORIDA RealAuction roster (verified 2026-07-04 against county clerk sites — see the
// p3-regulation-business memory + research). Hosts follow <county>.realforeclose.com
// (foreclosure) / <county>.realtaxdeed.com (tax deed), but slugs are NOT guessable —
// RealAuction WAF-403s + wildcard-resolves every subdomain, so each was matched to what
// the CLERK actually publishes. Special slugs: miamidade (NO hyphen), saintjohns (spelled
// out), indian-river (WITH hyphen), santarosa/palmbeach/stlucie (no hyphen). Brevard
// foreclosure is in-person only → its realforeclose host serves TAX DEEDS. ~12 rural
// counties are in-person only (no online supply — an honest ceiling, not a gap).
var COUNTIES = [
  // ── confirmed FORECLOSURE (*.realforeclose.com) ──
  { key: 'miamidade',    name: 'Miami-Dade',   metro: 'Miami',         host: 'miamidade.realforeclose.com',    product: 'foreclosure' },
  { key: 'broward',      name: 'Broward',      metro: 'Ft Lauderdale', host: 'broward.realforeclose.com',      product: 'foreclosure' },
  { key: 'palmbeach',    name: 'Palm Beach',   metro: 'West Palm Beach', host: 'palmbeach.realforeclose.com',  product: 'foreclosure' },
  { key: 'hillsborough', name: 'Hillsborough', metro: 'Tampa',         host: 'hillsborough.realforeclose.com', product: 'foreclosure' },
  { key: 'orange',       name: 'Orange',       metro: 'Orlando',       host: 'orange.realforeclose.com',       product: 'foreclosure' },
  { key: 'pinellas',     name: 'Pinellas',     metro: 'St Petersburg', host: 'pinellas.realforeclose.com',     product: 'foreclosure' },
  { key: 'duval',        name: 'Duval',        metro: 'Jacksonville',  host: 'duval.realforeclose.com',        product: 'foreclosure' },
  { key: 'lee',          name: 'Lee',          metro: 'Ft Myers',      host: 'lee.realforeclose.com',          product: 'foreclosure' },
  { key: 'polk',         name: 'Polk',         metro: 'Lakeland',      host: 'polk.realforeclose.com',         product: 'foreclosure' },
  { key: 'pasco',        name: 'Pasco',        metro: 'Tampa',         host: 'pasco.realforeclose.com',        product: 'foreclosure' },
  { key: 'volusia',      name: 'Volusia',      metro: 'Daytona',       host: 'volusia.realforeclose.com',      product: 'foreclosure' },
  { key: 'seminole',     name: 'Seminole',     metro: 'Orlando',       host: 'seminole.realforeclose.com',     product: 'foreclosure' },
  { key: 'sarasota',     name: 'Sarasota',     metro: 'Sarasota',      host: 'sarasota.realforeclose.com',     product: 'foreclosure' },
  { key: 'manatee',      name: 'Manatee',      metro: 'Bradenton',     host: 'manatee.realforeclose.com',      product: 'foreclosure' },
  { key: 'collier',      name: 'Collier',      metro: 'Naples',        host: 'collier.realforeclose.com',      product: 'foreclosure' },
  { key: 'marion',       name: 'Marion',       metro: 'Ocala',         host: 'marion.realforeclose.com',       product: 'foreclosure' },
  { key: 'alachua',      name: 'Alachua',      metro: 'Gainesville',   host: 'alachua.realforeclose.com',      product: 'foreclosure' },
  { key: 'escambia',     name: 'Escambia',     metro: 'Pensacola',     host: 'escambia.realforeclose.com',     product: 'foreclosure' },
  { key: 'leon',         name: 'Leon',         metro: 'Tallahassee',   host: 'leon.realforeclose.com',         product: 'foreclosure' },
  { key: 'clay',         name: 'Clay',         metro: 'Jacksonville',  host: 'clay.realforeclose.com',         product: 'foreclosure' },
  { key: 'stlucie',      name: 'St. Lucie',    metro: 'Port St Lucie', host: 'stlucie.realforeclose.com',      product: 'foreclosure' },
  { key: 'stjohns',      name: 'St. Johns',    metro: 'St Augustine',  host: 'saintjohns.realforeclose.com',   product: 'foreclosure' },
  { key: 'indianriver',  name: 'Indian River', metro: 'Vero Beach',    host: 'indian-river.realforeclose.com', product: 'foreclosure' },
  { key: 'santarosa',    name: 'Santa Rosa',   metro: 'Pensacola',     host: 'santarosa.realforeclose.com',    product: 'foreclosure' },
  { key: 'flagler',      name: 'Flagler',      metro: 'Palm Coast',    host: 'flagler.realforeclose.com',      product: 'foreclosure' },
  { key: 'bay',          name: 'Bay',          metro: 'Panama City',   host: 'bay.realforeclose.com',          product: 'foreclosure' },
  { key: 'okeechobee',   name: 'Okeechobee',   metro: 'Okeechobee',    host: 'okeechobee.realforeclose.com',   product: 'foreclosure' },
  { key: 'desoto',       name: 'DeSoto',       metro: 'Arcadia',       host: 'desoto.realforeclose.com',       product: 'foreclosure' },
  { key: 'walton',       name: 'Walton',       metro: 'DeFuniak',      host: 'walton.realforeclose.com',       product: 'foreclosure' },
  { key: 'washington',   name: 'Washington',   metro: 'Chipley',       host: 'washington.realforeclose.com',   product: 'foreclosure' },
  { key: 'gilchrist',    name: 'Gilchrist',    metro: 'Gainesville',   host: 'gilchrist.realforeclose.com',    product: 'foreclosure' },
  // ── confirmed TAX DEED ──
  { key: 'osceola',      name: 'Osceola',      metro: 'Orlando',       host: 'osceola.realtaxdeed.com',        product: 'taxdeed' },
  { key: 'brevard',      name: 'Brevard',      metro: 'Melbourne',     host: 'brevard.realforeclose.com',      product: 'taxdeed' },
  { key: 'baker',        name: 'Baker',        metro: 'Macclenny',     host: 'baker.realtaxdeed.com',          product: 'taxdeed' }
];

var MAX_DATES = parseInt(process.env.RA_MAX_DATES || '4', 10);
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

function parseMoney(s) {
  if (!s) return null;
  var m = String(s).replace(/[^0-9.]/g, '');
  if (!m) return null;
  var n = parseFloat(m);
  return isNaN(n) ? null : Math.round(n);
}

// pull upcoming dates that actually have auctions off the month calendar
async function auctionDates(page, county) {
  await page.goto('https://' + county.host + '/index.cfm?zaction=USER&zmethod=CALENDAR', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2500);
  var dates = await page.evaluate(function () {
    var out = [];
    document.querySelectorAll('[dayid]').forEach(function (box) {
      var d = (box.getAttribute('dayid') || '').trim();
      var txt = (box.innerText || '').replace(/\s+/g, ' ');
      // a day with auctions shows a count + a time (e.g. "2 Foreclosure ... 11:00 AM")
      var has = /\d\s*(Foreclosure|Tax|Auction|FC)/i.test(txt) || /\d{1,2}:\d\d\s*(AM|PM)/i.test(txt);
      if (/^\d\d\/\d\d\/\d{4}$/.test(d) && has) out.push(d);
    });
    return out;
  });
  // dedupe + future-only + cap
  var seen = {}, keep = [];
  var today = new Date(); today.setHours(0, 0, 0, 0);
  dates.forEach(function (d) {
    if (seen[d]) return; seen[d] = 1;
    var p = d.split('/'); var dt = new Date(+p[2], +p[0] - 1, +p[1]);
    if (dt >= today) keep.push(d);
  });
  keep.sort(function (a, b) { var A = a.split('/'), B = b.split('/'); return new Date(+A[2], +A[0], +A[1]) - new Date(+B[2], +B[0], +B[1]); });
  return keep.slice(0, MAX_DATES);
}

async function scrapeDate(page, county, date) {
  var url = 'https://' + county.host + '/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=' + date;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(3500);
  var raw = await page.evaluate(function () {
    var res = [];
    document.querySelectorAll('.AUCTION_ITEM').forEach(function (box) {
      var o = {};
      var st = box.querySelector('.ASTAT_MSGB, .ASTAT_MSGA, [class*="ASTAT"]');
      if (st) o._status = st.innerText.replace(/\s+/g, ' ').trim();
      box.querySelectorAll('table tr').forEach(function (row) {
        var l = row.querySelector('.AD_LBL'), v = row.querySelector('.AD_DTA');
        if (l && v) { var k = l.innerText.replace(/\s+/g, ' ').trim(); o[k] = v.innerText.replace(/\n/g, ' | ').replace(/[ \t]+/g, ' ').trim(); }
      });
      if (Object.keys(o).length) res.push(o);
    });
    return res;
  });
  if (process.env.RA_DEBUG_RAW) {
    raw.slice(0, 3).forEach(function (o) { console.log('RAWDUMP ' + county.key + ' ' + JSON.stringify(o)); });
  }
  return raw.map(function (o) { return normalize(o, county, date); }).filter(Boolean);
}

// Some counties (Indian River, Flagler) render the house number and street in adjacent
// inline elements with no whitespace, so innerText glues them: "87CROOKED LN" / "65661ST ST".
// Re-insert the missing space — numbered-street case first (6566|1ST), then lettered (87|CROOKED).
function fixMergedStreet(s) {
  s = String(s || '').trim();
  s = s.replace(/^(\d+)(\d(?:ST|ND|RD|TH)\b)/i, '$1 $2');  // 65661ST -> 6566 1ST
  s = s.replace(/^(\d+)([A-Za-z])/, '$1 $2');              // 87CROOKED -> 87 CROOKED
  return s;
}

function normalize(o, county, date) {
  var caseNo = o['Case #:'] || o['Case Number:'] || '';
  var street = fixMergedStreet(o['Property Address:'] || o['Property Address'] || '');
  var cityzip = o[''] || ''; // sometimes "TRINITY, 34655" (Pasco); Polk packs it into street
  // combine both possible layouts, then pull the 5-digit zip from anywhere
  var combined = (street + ' ' + cityzip).replace(/\s+/g, ' ').trim();
  // zip is at the END after the state, never the leading house number: prefer FL-adjacent, else the LAST 5-digit group
  var zm = combined.match(/\bFL[- ,]*(\d{5})\b/i);
  if (!zm) { var all = combined.match(/\b\d{5}\b/g); zm = all ? [null, all[all.length - 1]] : null; }
  var zip = zm ? zm[1] : '';
  // city: prefer the dedicated cityzip cell, else the token before ", FL" in the street
  var city = '';
  var cm = cityzip.match(/^([A-Za-z .'-]+?),?\s*(?:FL)?[- ]*\d{5}?$/);
  if (cm && cm[1]) city = cm[1].trim();
  if (!city) { var sm = street.match(/,\s*([A-Za-z .'-]+?),?\s*FL/i); if (sm) city = sm[1].trim(); }
  var judgment = parseMoney(o['Final Judgment Amount:'] || o['Opening Bid:'] || o['Judgment Amount:']);
  var market = parseMoney(o['Property App. Market Value:'] || o['Assessed Value:'] || o['Appraised Value:']);
  var maxBid = o['Plaintiff Max Bid:'] || o['Plaintiff Max Bid'] || '';
  var status = (o._status || '').trim();
  // clean display address: normalize state, drop dangling "FL-" / trailing punctuation
  var address = combined
    .replace(/,?\s*FL[- ]*(\d{5})?\s*$/i, function (m, z) { return z ? (', FL ' + z) : ', FL'; })
    .replace(/[-,\s]+$/, '')
    .trim();
  if (city && address.toUpperCase().indexOf(city.toUpperCase()) < 0) address = street + ', ' + city;
  var equity = (market != null && judgment != null) ? (market - judgment) : null;
  return {
    source: 'RealAuction',
    product: county.product,
    county: county.name,
    metro: county.metro,
    state: 'FL',
    saleDate: date,
    caseNumber: caseNo,
    address: address,
    street: street,
    city: city,
    zip: zip,
    parcel: o['Parcel ID:'] || o['Parcel ID'] || '',
    judgment: judgment,          // debt owed = opening-bid basis
    marketValue: market,         // county appraised value
    plaintiffMaxBid: maxBid,
    equity: equity,              // marketValue - judgment = the surplus/assignment signal
    status: status,
    url: 'https://' + county.host + '/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=' + date
  };
}

// active + has value + not already sold/canceled/bankrupt
function isLive(d) {
  var s = (d.status || '').toLowerCase();
  if (/cancel|sold|closed|bankrupt|withdrawn|redeem|struck/.test(s)) return false;
  return d.marketValue != null && d.marketValue > 0;
}

async function run() {
  var only = (process.env.RA_COUNTIES || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var counties = only.length ? COUNTIES.filter(function (c) { return only.indexOf(c.key) >= 0; }) : COUNTIES;

  var browser = await puppeteer.launch(launchOpts);
  var page = await browser.newPage();
  await page.setUserAgent(UA);

  var all = [], report = [];
  for (var i = 0; i < counties.length; i++) {
    var c = counties[i];
    try {
      var dates = await auctionDates(page, c);
      var got = 0;
      for (var j = 0; j < dates.length; j++) {
        var items = await scrapeDate(page, c, dates[j]);
        got += items.length;
        all = all.concat(items);
        await wait(1200);
      }
      report.push(c.name + ': ' + dates.length + ' dates, ' + got + ' items');
    } catch (e) {
      report.push(c.name + ': ERROR ' + e.message);
    }
  }
  await browser.close();

  // diagnostic: raw label/value pairs already logged in scrapeDate — stop before enrich/write
  if (process.env.RA_DEBUG_RAW) { console.log('== RA_DEBUG_RAW: raw pairs dumped, skipping enrich + write =='); return; }

  // dedupe by case #, keep live, rank by equity (biggest surplus first)
  var seen = {}, live = [];
  all.forEach(function (d) {
    var k = d.caseNumber || (d.parcel + d.saleDate);
    if (seen[k]) return; seen[k] = 1;
    if (isLive(d)) live.push(d);
  });
  live.sort(function (a, b) { return (b.equity || -1e15) - (a.equity || -1e15); });

  // P3 ENRICHMENT: owner + property type + motivated-seller priority (FL cadastral, free).
  // Turns the raw ranked list into "top opportunities" (heirs / absentee / high-equity) that
  // the Homestead portal groups by state -> county. Best-effort: on failure, store unenriched.
  try {
    var enrich = require('../lib/deal-enrich.js');
    console.log('  enriching ' + live.length + ' deals (owner + P3 priority)...');
    await enrich.enrichDeals(live, { gap: 120, log: true });
    // re-rank: work-first tier, then priority, then equity
    live.sort(function (a, b) {
      if ((a.tier || 9) !== (b.tier || 9)) return (a.tier || 9) - (b.tier || 9);
      if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
      return (b.equity || -1e15) - (a.equity || -1e15);
    });
  } catch (e) { console.error('  enrich skipped (continuing unenriched):', e.message); }

  var meta = { updatedMs: Date.now(), counties: report, total: live.length };

  // optional: dump the full deal array to a file for downstream tools (owner lookup, etc.)
  if (process.env.RA_DUMP) {
    try { require('fs').writeFileSync(process.env.RA_DUMP, JSON.stringify(live, null, 1)); console.log('  -> dumped ' + live.length + ' deals to ' + process.env.RA_DUMP); } catch (e) { console.error('dump failed', e.message); }
  }

  console.log('== RealAuction scrape ==');
  report.forEach(function (r) { console.log('  ' + r); });
  console.log('  LIVE deals (deduped): ' + live.length);
  console.log('  top 5 by equity:');
  live.slice(0, 5).forEach(function (d) {
    console.log('    ' + d.county + ' | ' + d.address + ' | judg $' + (d.judgment || '?') + ' | mkt $' + (d.marketValue || '?') + ' | equity $' + (d.equity || '?') + ' | ' + d.saleDate);
  });

  // WRITE PATH. Primary (CI): POST to the gated ingest endpoint — it holds Vercel's
  // Upstash creds, and a POST bypasses the Vercel Security Checkpoint. Secondary
  // (local): direct Redis if Upstash env is present. Else dry-run print.
  var ingestUrl = process.env.RA_INGEST_URL; // e.g. https://limenhelix.com/api/realauction-ingest
  var ingestKey = process.env.RA_INGEST_KEY || process.env.LEAD_ADMIN_KEY || '';
  if (ingestUrl) {
    try {
      var r = await fetch(ingestUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: ingestKey, deals: live, meta: meta })
      });
      var jr = await r.json().catch(function () { return {}; });
      console.log('  -> POST ingest ' + r.status + ' ' + JSON.stringify(jr));
      if (!r.ok || !jr.ok) process.exitCode = 2;
    } catch (e) { console.error('  ingest POST failed:', e.message); process.exitCode = 2; }
  } else if (db && process.env.UPSTASH_REDIS_REST_URL) {
    await db.set('realauction:deals', live, 60 * 60 * 30); // 30h TTL (daily cron refreshes)
    await db.set('realauction:meta', meta, 60 * 60 * 30);
    console.log('  -> wrote realauction:deals (' + live.length + ') + realauction:meta to Redis');
  } else {
    console.log('  (dry run: no ingest URL / Upstash env, not written)');
  }
  return live.length;
}

run().then(function (n) { process.exit(0); }).catch(function (e) { console.error('FATAL', e); process.exit(1); });
