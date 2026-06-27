// handlers/system-gain.js — read-only window onto γ (system gain).
//
// γ is the collective-surprise signal computed once per cognition cycle in
// brain-cognition-refresh.js: the fraction of the 20 interpretive domain brains
// that are in high prediction-error AT ONCE. It is an OBSERVED signal only — it
// modulates no brain, changes no score. This endpoint just reads the latest value
// + a short rolling history so we can watch whether collective surprise across
// domains tracks anything real (it is NOT validated cross-domain distress).
//
// GET /api/system-gain  ->  { current: {...}, history: [...] }

var { redisGet } = require('../lib/redis-kv.js');

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 's-maxage=15, stale-while-revalidate=15');
  try {
    var g = await redisGet('limen:system_gain');
    res.statusCode = 200;
    if (!g) {
      return res.end(JSON.stringify({
        current: null, history: [],
        note: 'No γ reading yet — the brain-cognition-refresh cron has not run since this shipped. It populates on the next cycle.'
      }));
    }
    return res.end(JSON.stringify(g));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
};
