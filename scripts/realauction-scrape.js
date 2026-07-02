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

// FL sweet-spot ring: Tampa/Orlando overflow, high inflow, not the picked-over cores.
// Each = a RealForeclose subdomain. Extendable: add {key,name,host,product}.
var COUNTIES = [
  { key: 'pasco',    name: 'Pasco',    metro: 'Tampa',   host: 'pasco.realforeclose.com',    product: 'foreclosure' },
  { key: 'polk',     name: 'Polk',     metro: 'Lakeland',host: 'polk.realforeclose.com',     product: 'foreclosure' },
  { key: 'lee',      name: 'Lee',      metro: 'Ft Myers',host: 'lee.realforeclose.com',      product: 'foreclosure' },
  { key: 'osceola',  name: 'Osceola',  metro: 'Orlando', host: 'osceola.realforeclose.com',  product: 'foreclosure' }
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
  return raw.map(function (o) { return normalize(o, county, date); }).filter(Boolean);
}

function normalize(o, county, date) {
  var caseNo = o['Case #:'] || o['Case Number:'] || '';
  var street = o['Property Address:'] || o['Property Address'] || '';
  var cityzip = o[''] || ''; // sometimes "TRINITY, 34655" (Pasco); Polk packs it into street
  // combine both possible layouts, then pull the 5-digit zip from anywhere
  var combined = (street + ' ' + cityzip).replace(/\s+/g, ' ').trim();
  var zm = combined.match(/\b(\d{5})\b/);
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

  // dedupe by case #, keep live, rank by equity (biggest surplus first)
  var seen = {}, live = [];
  all.forEach(function (d) {
    var k = d.caseNumber || (d.parcel + d.saleDate);
    if (seen[k]) return; seen[k] = 1;
    if (isLive(d)) live.push(d);
  });
  live.sort(function (a, b) { return (b.equity || -1e15) - (a.equity || -1e15); });

  var meta = { updatedMs: Date.now(), counties: report, total: live.length };

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
