'use strict';

/**
 * api/relay-csv-import — Import listings from CSV.
 *
 * POST { csv, marketplaceId, sellerId, downloadImages?, delayMs? }
 *   → Parse CSV, fetch optional listing images, create Relay listings.
 *
 * SERVER-TO-SERVER ADMINISTRATIVE ROUTE.
 * The only supported callers are trusted operator scripts. There is no browser
 * caller and no public CORS grant. Authentication is a dedicated request header,
 * never a query string, and it is checked before the request body is read.
 *
 * FIX-0103: the old handler was unauthenticated and fetched any caller-supplied
 * image URL, including loopback, private, link-local and metadata addresses, then
 * returned the bytes as base64. This version fails closed on missing server
 * configuration, requires the relay administrator credential, and confines image
 * retrieval to HTTPS public addresses with pinned DNS resolution, manual redirect
 * validation, a timeout and a streaming byte cap.
 *
 * CSV Format:
 * title,price,condition,category,description,imageUrl
 */

const dns = require('node:dns');
const net = require('node:net');
const https = require('node:https');
const RelayAdminAuth = require('../lib/relay-admin-auth');

const ADMIN_HEADER = RelayAdminAuth.ADMIN_HEADER;
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 2;
const IMAGE_TIMEOUT_MS = 8000; // socket inactivity, reset by traffic
const IMAGE_DEADLINE_MS = 15000; // absolute wall-clock cap for one downloadImage call
const MAX_RESPONSE_ROWS = 50;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

function neutralError() {
  return new Error('image_unavailable');
}

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(obj));
}

function setPreflightHeaders(res) {
  res.setHeader('Allow', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + ADMIN_HEADER);
  res.setHeader('Access-Control-Max-Age', '600');
}

function reject(req, res, code, error) {
  sendJSON(res, code, { ok: false, error: error });
  /* Drain without parsing. This keeps the connection well-behaved while
     ensuring no attacker-controlled body is interpreted after a rejection. */
  try { if (typeof req.resume === 'function') req.resume(); } catch (e) {}
}

function authorize(req, res) {
  /* The router checks this same helper before the civilization valves. The
     handler keeps its own check for direct invocation and defense in depth. */
  const result = RelayAdminAuth.checkRelayAdmin(req);
  if (result.ok) return true;
  reject(req, res, result.status, result.error);
  return false;
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) {
      if (Buffer.isBuffer(req.body)) {
        if (req.body.length > MAX_CSV_BYTES) return resolve({ __tooLarge: true });
        try { return resolve(JSON.parse(req.body.toString('utf8') || '{}')); }
        catch (e) { return resolve({}); }
      }
      if (typeof req.body === 'object') {
        let raw = '';
        try { raw = JSON.stringify(req.body); } catch (e) { return resolve({}); }
        if (Buffer.byteLength(raw) > MAX_CSV_BYTES) return resolve({ __tooLarge: true });
        return resolve(req.body);
      }
    }

    let data = '';
    let size = 0;
    let tooLarge = false;
    let done = false;

    function finish(value) {
      if (done) return;
      done = true;
      resolve(value);
    }

    req.on('data', function (chunk) {
      if (tooLarge || done) return;
      size += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
      if (size > MAX_CSV_BYTES) {
        tooLarge = true;
        data = '';
        return;
      }
      data += chunk;
    });
    req.on('end', function () {
      if (done) return;
      if (tooLarge) return finish({ __tooLarge: true });
      try { finish(JSON.parse(data || '{}')); }
      catch (e) { finish({}); }
    });
    req.on('error', function () { finish({}); });
  });
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { ok: false, error: 'CSV must have header and at least 1 row' };

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const titleIdx = headers.indexOf('title');
  const priceIdx = headers.indexOf('price');
  const conditionIdx = headers.indexOf('condition');
  const categoryIdx = headers.indexOf('category');
  const descIdx = headers.indexOf('description');
  const imgIdx = headers.indexOf('imageurl');

  if (titleIdx < 0 || priceIdx < 0) {
    return { ok: false, error: 'CSV must have title and price columns' };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values[titleIdx] || !values[priceIdx]) continue;

    rows.push({
      title: values[titleIdx],
      price: parseFloat(values[priceIdx]) || 0,
      condition: conditionIdx >= 0 ? values[conditionIdx] : 'good',
      category: categoryIdx >= 0 ? values[categoryIdx] : 'home',
      description: descIdx >= 0 ? values[descIdx] : '',
      imageUrl: imgIdx >= 0 ? values[imgIdx] : ''
    });
    if (rows.length > MAX_IMPORT_ROWS) {
      return { ok: false, error: 'row limit exceeded' };
    }
  }

  return { ok: true, rows: rows };
}

// Parse a CSV line handling quoted fields with proper quote escaping.
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  result.push(current.trim());
  return result;
}

/* ── SSRF containment ─────────────────────────────────────────────────────
   No general egress guard exists in the repository. This is deliberately
   local to the image fetch. Every network destination must be HTTPS and must
   resolve only to public addresses. The validated address is pinned through
   the request lookup, so the connection cannot re-resolve to a different
   address after the check. */

const BLOCKED_NETWORKS = new net.BlockList();
[
  ['0.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.0.0.0', 24, 'ipv4'],
  ['192.0.2.0', 24, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['198.18.0.0', 15, 'ipv4'],
  ['198.51.100.0', 24, 'ipv4'],
  ['203.0.113.0', 24, 'ipv4'],
  ['224.0.0.0', 4, 'ipv4'],
  ['240.0.0.0', 4, 'ipv4'],
  ['::', 128, 'ipv6'],
  ['::1', 128, 'ipv6'],
  ['64:ff9b::', 96, 'ipv6'],
  ['100::', 64, 'ipv6'],
  ['2001::', 32, 'ipv6'],
  ['2001:db8::', 32, 'ipv6'],
  ['2002::', 16, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
  ['fec0::', 10, 'ipv6'],
  ['ff00::', 8, 'ipv6']
].forEach(function (entry) {
  BLOCKED_NETWORKS.addSubnet(entry[0], entry[1], entry[2]);
});

function isProhibitedAddress(address) {
  const value = String(address || '');
  const family = net.isIP(value);
  if (family !== 4 && family !== 6) return true;
  try {
    return BLOCKED_NETWORKS.check(value, family === 4 ? 'ipv4' : 'ipv6') === true;
  } catch (e) {
    return true;
  }
}

function normalizeHost(hostname) {
  let host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (host.charAt(0) === '[' && host.charAt(host.length - 1) === ']') {
    host = host.slice(1, -1);
  }
  return host;
}

function isLoopbackName(host) {
  return host === 'localhost' ||
    host === 'localhost.localdomain' ||
    host === 'ip6-localhost' ||
    host === 'ip6-loopback' ||
    host.slice(-10) === '.localhost';
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise(function (_, reject) {
    timer = setTimeout(function () { reject(neutralError()); }, ms);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeout]).finally(function () { clearTimeout(timer); });
}

async function resolveHost(host, lookup, timeoutMs) {
  if (net.isIP(host)) {
    if (isProhibitedAddress(host)) throw neutralError();
    return [{ address: host, family: net.isIP(host) }];
  }
  if (isLoopbackName(host)) throw neutralError();
  /* Reject numeric-looking and hexadecimal forms even when the URL parser
     normalizes some of them before this point. */
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) throw neutralError();

  let answers;
  try {
    answers = await withTimeout(
      Promise.resolve().then(function () {
        return lookup(host, { all: true, verbatim: true });
      }),
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : IMAGE_TIMEOUT_MS
    );
  } catch (e) {
    throw neutralError();
  }
  if (!Array.isArray(answers)) answers = answers ? [answers] : [];
  if (!answers.length) throw neutralError();
  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i];
    if (!answer || !answer.address || isProhibitedAddress(answer.address)) {
      throw neutralError();
    }
  }
  return answers;
}

async function validateImageUrl(rawUrl, lookup, timeoutMs) {
  let url;
  try { url = new URL(String(rawUrl || '')); }
  catch (e) { throw neutralError(); }
  if (url.protocol !== 'https:') throw neutralError();
  if (url.username || url.password) throw neutralError();
  const host = normalizeHost(url.hostname);
  if (!host) throw neutralError();
  const addresses = await resolveHost(host, lookup || dns.promises.lookup, timeoutMs);
  return { url: url, host: host, addresses: addresses };
}

function toDataUri(buffer, contentType) {
  return 'data:' + contentType + ';base64,' + buffer.toString('base64');
}

function requestOnce(target, addresses, requestImpl, opts) {
  opts = opts || {};
  const timeoutMs = Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0
    ? opts.timeoutMs
    : IMAGE_TIMEOUT_MS;
  return new Promise(function (resolve, reject) {
    let settled = false;
    function fail() {
      if (settled) return;
      settled = true;
      reject(neutralError());
    }
    function succeed(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }

    const pinned = addresses[0];
    const options = {
      method: 'GET',
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'LIMEN-Relay-CSV-Import/1.0'
      },
      /* Pin the connection to the address validated above. The hostname is
         still used for TLS SNI and certificate verification. */
      lookup: function (hostname, opts, callback) {
        callback(null, pinned.address, pinned.family);
      },
      timeout: timeoutMs,
      agent: false
    };
    if (opts.signal) options.signal = opts.signal;

    let req;
    try {
      req = requestImpl(target, options, function (res) {
        /* Attach first so a destroy during a later rejection cannot surface as
           an unhandled response error. */
        res.on('error', fail);
        if (settled) {
          try { res.destroy(); } catch (e) {}
          return;
        }
        const remote = res.socket && res.socket.remoteAddress;
        if (remote && isProhibitedAddress(remote)) {
          try { res.destroy(); } catch (e) {}
          return fail();
        }

        const status = Number(res.statusCode) || 0;
        if (status >= 300 && status < 400) {
          let location = res.headers && (res.headers.location || res.headers.Location);
          if (Array.isArray(location)) location = location[0];
          try { if (typeof res.resume === 'function') res.resume(); } catch (e) {}
          if (!location) return fail();
          return succeed({ redirect: String(location) });
        }
        if (status !== 200) {
          try { if (typeof res.resume === 'function') res.resume(); } catch (e) {}
          return fail();
        }

        let contentType = res.headers && (res.headers['content-type'] || res.headers['Content-Type']);
        if (Array.isArray(contentType)) contentType = contentType[0];
        contentType = String(contentType || '').toLowerCase().split(';')[0].trim();
        if (ALLOWED_IMAGE_TYPES.indexOf(contentType) === -1) {
          try { res.destroy(); } catch (e) {}
          return fail();
        }

        const declared = parseInt(res.headers && res.headers['content-length'], 10);
        if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
          try { res.destroy(); } catch (e) {}
          return fail();
        }

        const chunks = [];
        let total = 0;
        res.on('data', function (chunk) {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buffer.length;
          if (total > MAX_IMAGE_BYTES) {
            try { res.destroy(); } catch (e) {}
            return fail();
          }
          chunks.push(buffer);
        });
        res.on('end', function () {
          if (settled) return;
          succeed({ contentType: contentType, buffer: Buffer.concat(chunks), bytes: total });
        });
      });
    } catch (e) {
      return fail();
    }

    req.on('timeout', function () {
      try { req.destroy(); } catch (e) {}
      fail();
    });
    req.on('error', fail);
    try {
      req.setTimeout(timeoutMs, function () {
        try { req.destroy(); } catch (e) {}
        fail();
      });
    } catch (e) {}
    try { req.end(); } catch (e) { fail(); }
  });
}

async function downloadImage(rawUrl, deps) {
  deps = deps || {};
  const lookup = deps.lookup || dns.promises.lookup;
  const requestImpl = deps.request || https.request;
  const inactivityMs = Number.isFinite(deps.timeoutMs) && deps.timeoutMs > 0
    ? deps.timeoutMs : IMAGE_TIMEOUT_MS;
  const deadlineMs = Number.isFinite(deps.deadlineMs) && deps.deadlineMs > 0
    ? deps.deadlineMs : IMAGE_DEADLINE_MS;
  const deadlineAt = Date.now() + deadlineMs;
  const controller = new AbortController();
  const deadlineTimer = setTimeout(function () { controller.abort(); }, deadlineMs);
  if (deadlineTimer && typeof deadlineTimer.unref === 'function') deadlineTimer.unref();

  try {
    let current = String(rawUrl || '');
    for (let redirects = 0; ; redirects++) {
      const remaining = deadlineAt - Date.now();
      if (remaining <= 0) throw neutralError();
      const checked = await validateImageUrl(current, lookup, Math.min(inactivityMs, remaining));
      const afterDns = deadlineAt - Date.now();
      if (afterDns <= 0) throw neutralError();
      const result = await requestOnce(checked.url, checked.addresses, requestImpl, {
        signal: controller.signal,
        timeoutMs: Math.min(inactivityMs, afterDns)
      });
      if (result.redirect) {
        if (redirects >= MAX_REDIRECTS) throw neutralError();
        try {
          current = new URL(result.redirect, checked.url).toString();
        } catch (e) {
          throw neutralError();
        }
        continue;
      }
      if (!result.buffer || !result.buffer.length) throw neutralError();
      return toDataUri(result.buffer, result.contentType);
    }
  } finally {
    clearTimeout(deadlineTimer);
  }
}

module.exports = async function handler(req, res, deps) {
  deps = deps || {};
  const method = String((req && req.method) || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    setPreflightHeaders(res);
    res.statusCode = 204;
    return res.end();
  }
  if (method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJSON(res, 405, { ok: false, error: 'POST only' });
  }

  /* Authentication precedes body parsing, URL handling, DNS, fetch, listing
     creation and response construction. */
  if (!authorize(req, res)) return;

  const body = await readBody(req);
  if (body && body.__tooLarge) {
    return sendJSON(res, 413, { ok: false, error: 'payload too large' });
  }

  const csv = (body && body.csv) || '';
  const marketplaceId = (body && body.marketplaceId) || '';
  const sellerId = (body && body.sellerId) || '';
  const downloadImages = !body || body.downloadImages !== false;
  const delayMs = Math.max(100, parseInt(body && body.delayMs, 10) || 500);

  if (!csv || csv.length < 10) {
    return sendJSON(res, 400, { ok: false, error: 'csv required (min 10 chars)' });
  }
  if (!marketplaceId || !sellerId) {
    return sendJSON(res, 400, { ok: false, error: 'marketplaceId and sellerId required' });
  }

  const parseResult = parseCSV(csv);
  if (!parseResult.ok) {
    return sendJSON(res, 400, { ok: false, error: parseResult.error });
  }

  let marketplace = deps.marketplace;
  if (!marketplace) {
    try {
      marketplace = require('../lib/relay-marketplace');
    } catch (e) {
      console.error('[csv-import] marketplace unavailable');
      return sendJSON(res, 503, { ok: false, error: 'service unavailable' });
    }
  }

  const imageFetcher = deps.downloadImage || downloadImage;
  const rows = parseResult.rows || [];
  const created = [];
  const failed = [];
  let imagesFailed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const images = [];
      if (row.imageUrl && downloadImages) {
        try {
          const image = await imageFetcher(row.imageUrl);
          if (image) images.push(image);
        } catch (e) {
          /* Image retrieval is optional. A rejected or broken image is
             reported as a neutral count; the authorized listing still passes. */
          imagesFailed++;
        }
      }

      const listing = await marketplace.createListing({
        marketplaceId: marketplaceId,
        sellerId: sellerId,
        title: row.title.slice(0, 100),
        price: row.price,
        condition: row.condition,
        category: row.category,
        description: row.description,
        quantity: 1,
        images: images,
        metadata: {
          source: 'csv-import',
          importedAt: new Date().toISOString()
        }
      });
      created.push({ row: row, listing: listing });
    } catch (e) {
      /* Never echo a network error, URL, response byte or store detail. */
      failed.push({ row: row, error: 'import_failed' });
    }

    if (delayMs) {
      await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
    }
  }

  const createdListings = created.slice(0, MAX_RESPONSE_ROWS).map(function (entry) {
    const listing = entry.listing || {};
    return {
      title: entry.row.title,
      price: entry.row.price,
      listingId: listing.id || null,
      marketplaceId: listing.marketplaceId || marketplaceId,
      sellerId: listing.sellerId || sellerId
    };
  });
  const failedRows = failed.slice(0, MAX_RESPONSE_ROWS).map(function (entry) {
    return {
      title: entry.row.title,
      price: entry.row.price,
      error: 'import_failed'
    };
  });

  return sendJSON(res, 200, {
    ok: true,
    created: created.length,
    failed: failed.length,
    imagesFailed: imagesFailed,
    createdListings: createdListings,
    failedRows: failedRows,
    truncated: created.length > MAX_RESPONSE_ROWS || failed.length > MAX_RESPONSE_ROWS,
    source: 'csv-import'
  });
};

module.exports._test = {
  ADMIN_HEADER: ADMIN_HEADER,
  MAX_CSV_BYTES: MAX_CSV_BYTES,
  MAX_IMPORT_ROWS: MAX_IMPORT_ROWS,
  MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
  MAX_REDIRECTS: MAX_REDIRECTS,
  IMAGE_TIMEOUT_MS: IMAGE_TIMEOUT_MS,
  IMAGE_DEADLINE_MS: IMAGE_DEADLINE_MS,
  isProhibitedAddress: isProhibitedAddress,
  normalizeHost: normalizeHost,
  resolveHost: resolveHost,
  validateImageUrl: validateImageUrl,
  downloadImage: downloadImage,
  parseCSV: parseCSV
};
