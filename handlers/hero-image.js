/**
 * api/hero-image.js — generate a domain hero image with xAI, so the 400px thumbnails can go.
 *
 *   GET /api/hero-image?key=...&domain=industry            → JSON: the prompt used + image URL
 *   GET /api/hero-image?key=...&domain=industry&raw=1      → the JPEG bytes themselves, so it
 *                                                            can be saved straight to disk
 *   GET /api/hero-image?key=...&domain=industry&prompt=... → override the prompt to iterate
 *
 * WHY SERVER-SIDE. XAI_API_KEY only exists in the Vercel environment and Vercel will not read a
 * secret back out, so the call has to happen where the key lives.
 *
 * WHAT THIS IS AND IS NOT. These are DECORATIVE hero backdrops. Nothing here produces data, a
 * figure, or anything a reader could mistake for evidence. That distinction matters on a site
 * whose whole claim is that its numbers are checkable: an illustrated header is fine, an
 * illustrated statistic would not be. The prompts below are deliberately abstract and generic
 * for that reason, and none of them depicts a real place, event or person.
 *
 * METERED SPEND. Image generation is billed per image. This does one image per request, is
 * key-gated, and refuses when the key is absent, so it cannot loop or run unattended.
 */
var T = require('../lib/tool-fetch');

var ENDPOINT = 'https://api.x.ai/v1/images/generations';
var MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-quality';
var KEY_VARS = ['SOCIAL_CRON_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY'];

// Deliberately abstract. A hero sits behind white headline text, so these ask for dark,
// low-contrast, wide compositions with the subject centred: the hero box is landscape on
// desktop and PORTRAIT on a phone, and `cover` crops hard to the middle.
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

function authorized(req) {
  var q = req.query || {};
  var supplied = q.key ? String(q.key) : '';
  var configured = KEY_VARS.map(function (n) { return process.env[n] ? String(process.env[n]).trim() : ''; }).filter(Boolean);
  if (!configured.length) return false;
  return !!(supplied && configured.indexOf(supplied) !== -1);
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (!authorized(req)) {
      return T.send(res, { ok: false, error: 'Not authorized. Pass ?key= with an admin key.' }, 401);
    }

    var key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    if (!key) {
      return T.send(res, { ok: false, error: 'XAI_API_KEY is not set on this deployment.' }, 503);
    }

    var domain = String(q.domain || '').toLowerCase().trim();
    if (!q.prompt && !SUBJECT[domain]) {
      return T.send(res, {
        ok: false,
        error: 'Unknown domain. Pass one of these, or supply &prompt= to override.',
        domains: Object.keys(SUBJECT)
      }, 400);
    }

    var prompt = q.prompt ? String(q.prompt).slice(0, 900) : (SUBJECT[domain] + '. ' + STYLE);

    var body = {
      model: MODEL,
      prompt: prompt,
      n: 1
    };
    // The docs describe aspect ratio and resolution options without pinning the parameter
    // names, so these are sent best-effort: if the API ignores or rejects an unknown field we
    // still want the image rather than a hard failure.
    if (q.aspect !== '0') body.aspect_ratio = q.aspect || '16:9';

    var r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var j = await r.json().catch(function () { return null; });

    if (!r.ok || !j) {
      // retry once without the unpinned aspect field before giving up
      if (body.aspect_ratio) {
        delete body.aspect_ratio;
        r = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        j = await r.json().catch(function () { return null; });
      }
      if (!r.ok || !j) {
        return T.send(res, {
          ok: false,
          error: 'xAI returned ' + r.status,
          detail: j && (j.error && j.error.message || JSON.stringify(j).slice(0, 300)),
          model: MODEL
        }, 502);
      }
    }

    var item = (j.data && j.data[0]) || j;
    var url = item.url || item.image_url || null;
    var b64 = item.b64_json || item.base64 || null;

    if (!url && !b64) {
      return T.send(res, { ok: false, error: 'xAI response carried no image', raw: JSON.stringify(j).slice(0, 400) }, 502);
    }

    // raw=1 streams the bytes so the file can be saved straight to assets/img/<domain>.jpg
    if (q.raw === '1') {
      var buf;
      if (b64) {
        buf = Buffer.from(b64, 'base64');
      } else {
        var img = await fetch(url);
        if (!img.ok) return T.send(res, { ok: false, error: 'could not fetch the generated image (' + img.status + ')' }, 502);
        buf = Buffer.from(await img.arrayBuffer());
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Content-Disposition', 'inline; filename="' + (domain || 'hero') + '.jpg"');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(buf);
    }

    return T.send(res, {
      ok: true,
      domain: domain || null,
      model: MODEL,
      prompt: prompt,
      url: url,
      hasBase64: !!b64,
      revisedPrompt: item.revised_prompt || null,
      note: 'Add &raw=1 to the same URL to download the JPEG itself. Decorative only: nothing here is data.'
    });
  } catch (e) {
    return T.send(res, { ok: false, error: e.message || 'handler error' }, 500);
  }
};
