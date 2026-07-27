/**
 * api/hero-image.js — generate domain hero images with xAI, triggered by cron, not by a key.
 *
 *   (Vercel scheduler)                    → generates ONE missing image per run, then stops
 *   GET /api/hero-image?list=1            → PUBLIC. what has been generated so far
 *   GET /api/hero-image?key=...&domain=x  → manual override, still available
 *   GET /api/hero-image?key=...&domain=x&raw=1 → the JPEG bytes
 *
 * WHY THE SPLIT. Generating costs money; retrieving does not, and these images are destined to
 * be public static files in assets/img/ anyway. So GENERATION is gated to Vercel's own
 * scheduler (or an admin key) and RETRIEVAL is public. That means no key has to be handled by a
 * person to get the results out.
 *
 * SELF-TERMINATING BY DESIGN. Each cron run generates at most one image, and only for a domain
 * with no stored result. Once every domain has one, the cron finds nothing to do and spends
 * nothing. It cannot loop.
 *
 * HARD SPEND CAP. A counter in Redis caps total generations ever at HERO_IMAGE_CAP (default
 * 40, against 20 domains). If the counter cannot be read, generation REFUSES. A runaway image
 * loop is the one failure mode here that costs real money, so it fails closed.
 *
 * Only the xAI URL is stored, not the bytes. Upstash bills bandwidth and these are ~300KB
 * each; a URL is a few hundred bytes. The images are fetched from those URLs once and committed
 * as static files, after which this endpoint is scaffolding.
 *
 * WHAT THIS IS NOT. Decorative backdrops. Nothing here produces a figure or anything a reader
 * could mistake for evidence, which matters on a site whose claim is that its numbers are
 * checkable. Prompts are abstract and none depicts a real place, event or person.
 */
var T = require('../lib/tool-fetch');
var db = require('../lib/limen-db');

var ENDPOINT = 'https://api.x.ai/v1/images/generations';
var MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-quality';
var STORE_KEY = 'hero:img:v1';
var COUNT_KEY = 'hero:img:count:v1';
var KEY_VARS = ['SOCIAL_CRON_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY'];

function cap() {
  var n = parseInt(process.env.HERO_IMAGE_CAP, 10);
  return isFinite(n) && n >= 0 ? n : 40;
}

// Deliberately abstract. A hero sits behind white headline text, so these ask for dark,
// low-contrast, wide compositions with the subject CENTRED: the hero box is landscape on
// desktop and PORTRAIT on a phone, where cover crops hard to the middle and discards the sides.
var SUBJECT = {
  agriculture:  'vast farmland under low dramatic light, irrigation lines receding to the horizon',
  communication: 'communication towers and dish arrays silhouetted against a dark dusk sky',
  culture:      'an empty concert hall in low light, seats and stage in deep shadow',
  defense:      'a shipyard at night, cranes and hulls in silhouette under sodium light',
  economy:      'a dense financial district at dusk seen from above, lights beginning to show',
  education:    'a university library interior at night, long shelves receding into shadow',
  energy:       'high-voltage transmission towers marching across dark open country at dusk',
  environment:  'old-growth forest in heavy mist, deep greens, light falling in shafts',
  finance:      'a bank vault door and marble hall in low dramatic light',
  governance:   'neoclassical government architecture at dusk, columns in deep shadow',
  industry:     'a heavy manufacturing floor at night, steel structure and machinery in silhouette, sparks and low amber light',
  infrastructure: 'a long suspension bridge in fog at blue hour, cables receding',
  intelligence: 'a dark operations room, wall of dim screens, no readable text',
  law:          'a courtroom interior in low light, empty bench and gallery, deep shadow',
  medicine:     'a hospital corridor at night, low clinical light receding into darkness',
  population:   'an aerial view of dense housing at dusk, warm window lights in a grid',
  religion:     'a cathedral interior in near darkness, one shaft of light through high windows',
  science:      'a large research instrument in a darkened laboratory, cool blue light',
  technology:   'a server hall in low light, rows receding, cool blue and deep shadow',
  trade:        'a container port at night, stacked containers and gantry cranes under floodlight'
};

var STYLE = 'Cinematic wide landscape photograph, 16:9, muted desaturated palette, deep shadows, ' +
            'dark overall exposure suitable as a background behind white text, subject centred, ' +
            'no text, no words, no lettering, no watermark, no people in the foreground, ' +
            'no logos, photographic realism, shallow contrast.';

function cronHit(req) {
  var h = req.headers || {};
  // Same pattern as handlers/autopilot.js and handlers/social-cron.js. Vercel sends
  // x-vercel-signature on this project, NOT x-vercel-cron, which is why both are accepted.
  if (process.env.CRON_SECRET) return h['authorization'] === 'Bearer ' + process.env.CRON_SECRET;
  return !!(h['x-vercel-cron'] || h['x-vercel-signature']);
}

function keyed(req) {
  var q = req.query || {};
  var supplied = q.key ? String(q.key) : '';
  var configured = KEY_VARS.map(function (n) { return process.env[n] ? String(process.env[n]).trim() : ''; }).filter(Boolean);
  return !!(configured.length && supplied && configured.indexOf(supplied) !== -1);
}

async function loadStore() {
  var s = await db.get(STORE_KEY);
  return (s && typeof s === 'object') ? s : {};
}

async function generate(domain, promptOverride) {
  var key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!key) return { ok: false, error: 'XAI_API_KEY is not set on this deployment.' };

  var prompt = promptOverride ? String(promptOverride).slice(0, 900) : (SUBJECT[domain] + '. ' + STYLE);
  var body = { model: MODEL, prompt: prompt, n: 1, aspect_ratio: '16:9' };

  async function call(b) {
    var r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(b)
    });
    var j = await r.json().catch(function () { return null; });
    return { ok: r.ok, status: r.status, j: j };
  }

  var res = await call(body);
  // aspect_ratio is not a pinned parameter name in the docs; retry once without it rather than
  // failing the whole request on an unknown field.
  if (!res.ok) { delete body.aspect_ratio; res = await call(body); }
  if (!res.ok || !res.j) {
    return { ok: false, error: 'xAI returned ' + res.status, detail: res.j && (res.j.error && res.j.error.message || JSON.stringify(res.j).slice(0, 240)) };
  }

  var item = (res.j.data && res.j.data[0]) || res.j;
  var url = item.url || item.image_url || null;
  var b64 = item.b64_json || item.base64 || null;
  if (!url && !b64) return { ok: false, error: 'xAI response carried no image' };

  return { ok: true, url: url, hasBase64: !!b64, b64: b64, prompt: prompt, revised: item.revised_prompt || null };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    // ── PUBLIC: what has been generated. No key, no cost, nothing sensitive. ──
    if (q.list === '1') {
      var store = await loadStore();
      var done = Object.keys(store);
      var count = 0;
      try { count = parseInt(await db.get(COUNT_KEY), 10) || 0; } catch (e) {}
      return T.send(res, {
        ok: true,
        generated: done.length,
        ofDomains: Object.keys(SUBJECT).length,
        spentImages: count,
        capImages: cap(),
        pending: Object.keys(SUBJECT).filter(function (d) { return !store[d]; }),
        images: store,
        note: 'URLs come from xAI and may expire. Fetch and commit them to assets/img/<domain>.jpg.'
      });
    }

    var isCron = cronHit(req);
    var isKeyed = keyed(req);
    if (!isCron && !isKeyed) {
      return T.send(res, { ok: false, error: 'Generation is restricted. Add ?list=1 to read results without a key.' }, 401);
    }

    // ── SPEND CAP. Fails CLOSED: an unreadable counter refuses to generate. ──
    var used;
    try { used = parseInt(await db.get(COUNT_KEY), 10) || 0; }
    catch (e) { return T.send(res, { ok: false, error: 'Spend counter unreachable; refusing to generate.' }, 503); }
    if (used >= cap()) {
      return T.send(res, { ok: false, error: 'Image cap reached: ' + used + ' of ' + cap() + '. Raise HERO_IMAGE_CAP to continue.', spentImages: used }, 429);
    }

    var store2 = await loadStore();

    // A cron run picks the FIRST domain with no stored image and stops when there are none.
    var domain = String(q.domain || '').toLowerCase().trim();
    if (isCron && !domain) {
      domain = Object.keys(SUBJECT).filter(function (d) { return !store2[d]; })[0] || '';
      if (!domain) {
        return T.send(res, { ok: true, done: true, generated: Object.keys(store2).length, note: 'Every domain already has an image. Nothing generated, nothing spent.' });
      }
    }
    if (!q.prompt && !SUBJECT[domain]) {
      return T.send(res, { ok: false, error: 'Unknown domain.', domains: Object.keys(SUBJECT) }, 400);
    }
    // Never silently regenerate and re-charge for something already done.
    if (isCron && store2[domain]) {
      return T.send(res, { ok: true, skipped: domain, note: 'Already generated; not regenerating.' });
    }

    var g = await generate(domain, q.prompt);
    if (!g.ok) return T.send(res, { ok: false, domain: domain, error: g.error, detail: g.detail }, 502);

    try { await db.set(COUNT_KEY, used + 1); } catch (e) {}
    store2[domain] = { url: g.url, prompt: g.prompt, revised: g.revised, at: new Date().toISOString(), model: MODEL };
    try { await db.set(STORE_KEY, store2); } catch (e) {}

    if (q.raw === '1' && (g.b64 || g.url)) {
      var buf;
      if (g.b64) buf = Buffer.from(g.b64, 'base64');
      else {
        var img = await fetch(g.url);
        if (!img.ok) return T.send(res, { ok: false, error: 'could not fetch the generated image (' + img.status + ')' }, 502);
        buf = Buffer.from(await img.arrayBuffer());
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Cache-Control', 'no-store');
      return res.end(buf);
    }

    return T.send(res, {
      ok: true, domain: domain, model: MODEL, url: g.url, prompt: g.prompt,
      spentImages: used + 1, capImages: cap(),
      remaining: Object.keys(SUBJECT).filter(function (d) { return !store2[d]; }),
      note: 'Decorative only: nothing here is data. Read all results with ?list=1, no key needed.'
    });
  } catch (e) {
    return T.send(res, { ok: false, error: e.message || 'handler error' }, 500);
  }
};

// Every run records itself. lib/heartbeat is the spike log the /brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('hero-image', module.exports);
