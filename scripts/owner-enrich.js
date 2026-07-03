/**
 * owner-enrich.js — attach OWNER NAME + MAILING ADDRESS to FL deals, free.
 *
 * Source: Florida Statewide Cadastral (FDOR NAL joined to parcels), a free public
 * ArcGIS FeatureServer covering all 67 counties, ~10.8M parcels. Owner name +
 * mailing address is public record; this is the same owner data BatchData resells.
 * (Phone/email are NOT here — those are proprietary skip-trace, ~$0.15/record.)
 *
 * KEY: the statewide PARCEL_ID = the county STRAP with all punctuation stripped
 * (e.g. Lee "32-44-24-C2-01206.0240" -> "324424C2012060240"). Exact-match queries
 * are fast; LIKE/broad scans time out on 10.8M rows, so we always match by PARCEL_ID.
 *
 * RUN: node scripts/owner-enrich.js <deals.json> [outCsv]
 *   reads a deals array (needs .parcel), writes <deals>.enriched.json + a mail CSV.
 */
'use strict';
var fs = require('fs');
var BASE = 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query';
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

async function ownerFor(parcel) {
  var pid = String(parcel || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!pid) return null;
  var url = BASE + '?where=' + encodeURIComponent("PARCEL_ID='" + pid + "'") +
    '&outFields=' + encodeURIComponent('OWN_NAME,OWN_ADDR1,OWN_ADDR2,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1') +
    '&returnGeometry=false&f=json';
  try {
    var r = await fetch(url, { headers: { 'accept': 'application/json' } });
    var j = await r.json();
    var a = j && j.features && j.features[0] && j.features[0].attributes;
    if (!a || !a.OWN_NAME) return null;
    var mailLine = [a.OWN_ADDR1, a.OWN_ADDR2].filter(Boolean).join(' ');
    return {
      name: (a.OWN_NAME || '').trim(),
      mailAddr: mailLine.trim(),
      mailCity: (a.OWN_CITY || '').trim(),
      mailState: (a.OWN_STATE || '').trim(),
      mailZip: String(a.OWN_ZIPCD || '').trim().slice(0, 5),
      absentee: !!(mailLine && a.PHY_ADDR1 && mailLine.replace(/\s+/g, '').toUpperCase().indexOf(String(a.PHY_ADDR1).replace(/\s+/g, '').toUpperCase().slice(0, 8)) < 0)
    };
  } catch (e) { return null; }
}

function csvCell(s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

async function main() {
  var inPath = process.argv[2];
  if (!inPath || !fs.existsSync(inPath)) { console.error('usage: node scripts/owner-enrich.js <deals.json> [outCsv]'); process.exit(1); }
  var outCsv = process.argv[3] || inPath.replace(/\.json$/, '') + '.mail.csv';
  var deals = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  deals = deals.filter(function (d) { return d.equity == null || d.equity != null; }); // keep all
  console.log('enriching ' + deals.length + ' deals with owner + mailing (FL statewide cadastral, free)...');

  var hit = 0;
  for (var i = 0; i < deals.length; i++) {
    var o = await ownerFor(deals[i].parcel);
    deals[i].owner = o;
    if (o) { hit++; process.stdout.write('.'); } else process.stdout.write('x');
    await wait(150); // polite
  }
  process.stdout.write('\n');
  console.log('matched owner for ' + hit + '/' + deals.length + '.');

  // write enriched json
  var enrichedPath = inPath.replace(/\.json$/, '') + '.enriched.json';
  fs.writeFileSync(enrichedPath, JSON.stringify(deals, null, 1));

  // write mail CSV (ranked by equity), owner + mailing address
  var ranked = deals.filter(function (d) { return d.equity != null; }).sort(function (a, b) { return b.equity - a.equity; });
  var head = ['rank', 'equity', 'sale_date', 'owner_name', 'mail_to_addr', 'mail_to_city', 'mail_to_state', 'mail_to_zip', 'absentee', 'property_address', 'property_city', 'property_zip', 'case_number', 'parcel'];
  var rows = [head];
  ranked.forEach(function (d, i) {
    var o = d.owner || {};
    rows.push([i + 1, d.equity, d.saleDate, o.name || '', o.mailAddr || d.street, o.mailCity || d.city, o.mailState || 'FL', o.mailZip || d.zip, o.absentee ? 'YES' : '', d.street, d.city, d.zip, d.caseNumber, d.parcel]);
  });
  fs.writeFileSync(outCsv, rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'));
  console.log('wrote ' + enrichedPath);
  console.log('wrote ' + outCsv);
  console.log('\nTop 8 with owners:');
  ranked.slice(0, 8).forEach(function (d, i) {
    var o = d.owner || {};
    console.log('  ' + (i + 1) + '. ' + (o.name || '(no match)') + (o.absentee ? ' [ABSENTEE]' : '') + '  |  ' + d.street + ', ' + d.city + '  |  $' + d.equity + ' equity' + (o.mailAddr ? '  |  mail: ' + o.mailAddr + ', ' + o.mailCity + ' ' + o.mailState + ' ' + o.mailZip : ''));
  });
}
main().catch(function (e) { console.error('FATAL', e); process.exit(1); });
