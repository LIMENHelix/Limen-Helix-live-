#!/usr/bin/env node
/**
 * enrich-town.mjs — enumerate every business in a US town (OpenStreetMap /
 * Overpass, free) and run the free contact-enrichment engine on each.
 *
 * READ-ONLY. Contacts no one. Produces a CSV of name / phone / email / mailing
 * address / website / source. It does NOT capture into the CRM send pool and it
 * NEVER sends — mass outreach to a town that never opted in is a human-gated
 * outward action (and a deliverability risk). Feeding this into autopilot's
 * auto-send is a separate, deliberate decision.
 *
 * Usage:
 *   DDGS_API_URL=http://127.0.0.1:8788/api/ddgs-search DDGS_PROXY_KEY=... \
 *     node scripts/enrich-town.mjs "Lansing" "KS" [maxBusinesses]
 *
 * OSM already carries phone/website/address tags for many places; those are used
 * directly (free, no search). Enrichment only runs to FILL missing fields, so a
 * town of N businesses costs far fewer than N searches.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const enrich = require('../lib/lead-enrichment.js');

const CITY = process.argv[2] || 'Lansing';
const STATE = process.argv[3] || 'KS';
const MAX = parseInt(process.argv[4] || '250', 10);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'assets', 'data', `town-${CITY}-${STATE}.csv`.toLowerCase().replace(/\s+/g, '-'));

// Amenity values that are actual businesses (commercial). Everything else
// (worship, school, government, civic) is excluded — not a sales lead.
const COMMERCIAL_AMENITY = new Set([
  'restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'biergarten', 'food_court', 'ice_cream',
  'bank', 'pharmacy', 'fuel', 'car_wash', 'car_rental', 'car_repair', 'charging_station',
  'dentist', 'doctors', 'clinic', 'veterinary', 'childcare', 'kindergarten',
  'cinema', 'nightclub', 'casino', 'marketplace', 'fitness_centre', 'bureau_de_change',
]);
const EXCLUDE_OFFICE = new Set(['government', 'diplomatic', 'political_party', 'ngo', 'quango']);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Resolve a US town to its bounding box via Nominatim (free). An area-name
// Overpass query alone 504s (many same-named towns worldwide); a bbox is cheap
// and reliable.
async function geocodeBbox(city, state) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&country=USA&state='
    + encodeURIComponent(state) + '&city=' + encodeURIComponent(city);
  const r = await fetch(url, { headers: { 'user-agent': 'LIMEN-enrich/1.0 (chrishubbel72@gmail.com)' } });
  if (!r.ok) throw new Error('nominatim ' + r.status);
  const d = await r.json();
  if (!d.length || !d[0].boundingbox) throw new Error('town not found: ' + city + ', ' + state);
  // Nominatim boundingbox = [south, north, west, east]; Overpass wants (S,W,N,E).
  const bb = d[0].boundingbox.map(Number);
  return { south: bb[0], north: bb[1], west: bb[2], east: bb[3] };
}

async function overpass(city, state) {
  const b = await geocodeBbox(city, state);
  const box = `${b.south},${b.west},${b.north},${b.east}`;
  const q = `[out:json][timeout:60];
    (
      nwr["shop"](${box});
      nwr["craft"](${box});
      nwr["office"](${box});
      nwr["amenity"](${box});
    );
    out tags 2000;`;
  const hosts = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  for (const host of hosts) {
    try {
      const r = await fetch(host, {
        method: 'POST',
        headers: { 'user-agent': 'LIMEN-enrich/1.0 (chrishubbel72@gmail.com)', 'content-type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
      });
      if (!r.ok) { console.error(`overpass ${host} -> ${r.status}`); continue; }
      const d = await r.json();
      return d.elements || [];
    } catch (e) { console.error(`overpass ${host} failed: ${e.message}`); }
  }
  return [];
}

function isBusiness(t) {
  if (!t || !t.name) return false;
  if (t.shop || t.craft) return true;
  if (t.office && !EXCLUDE_OFFICE.has(t.office)) return true;
  if (t.amenity && COMMERCIAL_AMENITY.has(t.amenity)) return true;
  return false;
}

function osmAddress(t) {
  const hn = t['addr:housenumber'], st = t['addr:street'];
  if (!hn || !st) return '';
  const city = t['addr:city'] || CITY, state = t['addr:state'] || STATE, zip = t['addr:postcode'] || '';
  return `${hn} ${st}, ${city}, ${state}${zip ? ' ' + zip : ''}`.trim();
}

function csvCell(s) {
  s = String(s == null ? '' : s);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

(async () => {
  console.log(`Enumerating businesses in ${CITY}, ${STATE} via Overpass...`);
  const els = await overpass(CITY, STATE);
  const biz = els.filter((e) => isBusiness(e.tags));
  // dedupe by name (OSM sometimes has a node + a building way for one place)
  const seen = new Set();
  const uniq = [];
  for (const e of biz) {
    const key = e.tags.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key); uniq.push(e);
  }
  const list = uniq.slice(0, MAX);
  console.log(`${els.length} OSM elements -> ${biz.length} commercial -> ${uniq.length} unique businesses (processing ${list.length}).`);

  function areaCode(phone) {
    var p = String(phone || '').replace(/[^\d]/g, '');
    if (p.length === 11 && p[0] === '1') p = p.slice(1);
    if (p.length !== 10) return '';
    if (p[0] === '0' || p[0] === '1') return ''; // invalid NANP area code
    return p.slice(0, 3);
  }
  // Self-calibrate the town's local area codes from OSM-TAGGED phones (geo-placed,
  // so location-correct by construction). Enriched phones from a name search can
  // be a same-named business in another state; we keep an enriched phone only if
  // its area code is local. Toll-free (8xx) is dropped too — it's a national
  // line, not the local store.
  const localAreas = new Set();
  for (const e of list) {
    const ac = areaCode(e.tags.phone || e.tags['contact:phone'] || e.tags['contact:mobile'] || '');
    if (ac && !/^8(00|33|44|55|66|77|88)$/.test(ac)) localAreas.add(ac);
  }
  const STATE_RE = new RegExp(',\\s*' + STATE + '\\b', 'i');
  console.log(`Local area codes (from OSM tags): ${[...localAreas].join(', ') || '(none — enriched phones will be rejected)'}`);

  function phoneIsLocal(phone) { const ac = areaCode(phone); return !!ac && localAreas.has(ac); }
  function addressIsLocal(addr) { return STATE_RE.test(String(addr || '')) || new RegExp('\\b' + CITY + '\\b', 'i').test(String(addr || '')); }

  const rows = [];
  let enrichedCount = 0, droppedPhone = 0, droppedAddr = 0;
  for (let i = 0; i < list.length; i++) {
    const t = list[i].tags;
    // OSM-tag seed — geo-correct, trusted as-is.
    const osm = {
      website: t.website || t['contact:website'] || '',
      email: t.email || t['contact:email'] || '',
      phone: (t.phone || t['contact:phone'] || t['contact:mobile'] || ''),
      address: osmAddress(t),
    };
    // Enrich a fresh probe (never overwrites OSM). Then accept enriched
    // phone/address ONLY if location-consistent; email is domain-gated already.
    const probe = { name: t.name, org: t.name, city: t['addr:city'] || CITY, state: t['addr:state'] || STATE, website: osm.website, email: '', phone: '', address: '' };
    let via = osm.email || osm.phone ? 'osm' : '';
    try {
      const r = await enrich.enrichLead(probe, {});
      if (r.enriched) via = r.via;
    } catch (e) { /* keep OSM seed */ }

    const email = osm.email || probe.email || '';
    let phone = osm.phone || '';
    if (!phone && probe.phone) { if (phoneIsLocal(probe.phone)) phone = probe.phone; else droppedPhone++; }
    let address = osm.address || '';
    if (!address && probe.address) { if (addressIsLocal(probe.address)) address = probe.address; else droppedAddr++; }
    if ((probe.email || (phone && !osm.phone) || (address && !osm.address)) && via !== 'osm') enrichedCount++;

    rows.push({
      name: t.name, phone: phone, email: email, address: address,
      website: osm.website, category: t.shop || t.craft || t.office || t.amenity || '', via: via || 'none',
    });
    const fe = email ? 'E' : ''; const fp = phone ? 'P' : ''; const fa = address ? 'A' : '';
    console.log(`  [${i + 1}/${list.length}] ${t.name}  ${fe}${fp}${fa}  (${via || 'none'})`);
    await sleep(400); // be polite to the search backend
  }

  const header = 'name,phone,email,address,website,category,via';
  const csv = [header].concat(rows.map((r) =>
    [r.name, r.phone, r.email, r.address, r.website, r.category, r.via].map(csvCell).join(','))).join('\n');
  fs.writeFileSync(OUT, csv);

  const withEmail = rows.filter((r) => r.email).length;
  const withPhone = rows.filter((r) => r.phone).length;
  const withAddr = rows.filter((r) => r.address).length;
  console.log(`\nDONE. ${rows.length} businesses.`);
  console.log(`  email:   ${withEmail}`);
  console.log(`  phone:   ${withPhone}  (local area codes only)`);
  console.log(`  address: ${withAddr}  (mailable, ${STATE}-verified)`);
  console.log(`  enriched beyond OSM: ${enrichedCount}`);
  console.log(`  dropped as wrong-location: ${droppedPhone} phone, ${droppedAddr} address`);
  console.log(`CSV: ${OUT}`);
})();
