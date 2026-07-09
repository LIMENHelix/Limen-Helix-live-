/**
 * lib/inventory-csv.js — parse a clinic's distributor order export (McKesson / Henry Schein /
 * Cardinal / Medline / etc.) into normalized inventory items { product, manufacturer, ndc, lot, qty }.
 *
 * Distributor CSVs have wildly different columns, so we DETECT columns by header keyword rather than
 * assume a layout. If no recognizable header exists, we fall back to treating each line as a product
 * name (paste mode). We never invent fields — a missing column just yields '' for that item.
 */
'use strict';

// minimal RFC-ish CSV row splitter (handles quoted fields containing commas / quotes).
function splitRow(line) {
  var out = [], cur = '', q = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(function (s) { return s.trim(); });
}

var COL = {
  ndc:          /\bndc\b|national drug code/i,
  product:      /descript|item.?name|product.?name|^item$|^product$|material.?desc|catalog.?desc/i,
  manufacturer: /manufacturer|\bmfr\b|\bmfg\b|vendor|brand|labeler|supplier/i,
  lot:          /\blot\b|batch|serial/i,
  qty:          /\bqty\b|quantity|units/i
};

function detectHeader(cells) {
  var map = {}, hits = 0;
  for (var i = 0; i < cells.length; i++) {
    for (var key in COL) {
      if (map[key] === undefined && COL[key].test(cells[i])) { map[key] = i; hits++; break; }
    }
  }
  // need at least a product OR ndc column to call it a real header.
  return (hits >= 1 && (map.product !== undefined || map.ndc !== undefined)) ? map : null;
}

function clip(s, n) { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n) : s; }

function parseInventory(text) {
  var raw = String(text || '').replace(/\r\n?/g, '\n').split('\n').filter(function (l) { return l.trim(); });
  if (!raw.length) return { items: [], mode: 'empty', columns: null };

  // find a header row within the first few lines
  var headerIdx = -1, map = null;
  for (var h = 0; h < Math.min(raw.length, 5); h++) {
    var m = detectHeader(splitRow(raw[h]));
    if (m) { headerIdx = h; map = m; break; }
  }

  var items = [], seen = {};
  function push(it) {
    if (!it.product && !it.ndc) return;
    var k = (it.ndc || '') + '|' + (it.product || '').toLowerCase() + '|' + (it.lot || '').toLowerCase();
    if (seen[k]) return; seen[k] = 1;
    items.push(it);
  }

  if (map) {
    for (var i = headerIdx + 1; i < raw.length; i++) {
      var c = splitRow(raw[i]);
      var g = function (key) { return map[key] !== undefined ? clip(c[map[key]], 200) : ''; };
      push({ product: g('product'), manufacturer: g('manufacturer'), ndc: g('ndc'), lot: g('lot'), qty: g('qty') });
    }
    return { items: items, mode: 'csv', columns: Object.keys(map) };
  }

  // paste fallback: each line = a product (optionally "product - manufacturer" or "product, mfr")
  for (var j = 0; j < raw.length; j++) {
    var line = raw[j];
    var parts = line.split(/\s+[-–—]\s+|\t|,(?=[^,]*$)/);   // split on " - " or last comma
    push({ product: clip(parts[0], 200), manufacturer: clip(parts[1] || '', 200), ndc: '', lot: '', qty: '' });
  }
  return { items: items, mode: 'paste', columns: null };
}

module.exports = { parseInventory: parseInventory, splitRow: splitRow };
