/**
 * api/redis-diag.js — Upstash Redis REST diagnostic
 *
 * GET /api/redis-diag?probe=1
 *
 * Surfaces what's wrong with the Upstash configuration without leaking
 * the token. Reports:
 *   - whether env vars are set
 *   - URL protocol + hostname (truncated so token in URL isn't leaked)
 *   - token length + first/last 4 chars
 *   - direct fetch result on PING + SET + GET commands
 *   - HTTP status + response body excerpt on failure
 */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('content-type', 'application/json');

  const url = req.url || '';
  if (url.indexOf('probe=1') === -1) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: 'use ?probe=1 to run diagnostic' }));
  }

  const REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
  const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

  const env = {
    UPSTASH_REDIS_REST_URL_present: !!REST_URL,
    UPSTASH_REDIS_REST_TOKEN_present: !!REST_TOKEN,
    url_length: REST_URL.length,
    token_length: REST_TOKEN.length,
    url_protocol: REST_URL.split(':')[0] || null,
    url_hostname: (() => { try { return new URL(REST_URL).hostname; } catch (e) { return 'INVALID_URL: ' + e.message; } })(),
    url_pathname: (() => { try { return new URL(REST_URL).pathname; } catch (e) { return null; } })(),
    token_prefix: REST_TOKEN.slice(0, 4),
    token_suffix: REST_TOKEN.slice(-4),
    token_has_whitespace: /\s/.test(REST_TOKEN),
    url_has_whitespace: /\s/.test(REST_URL),
    url_has_trailing_slash: REST_URL.endsWith('/')
  };

  // Surface obvious config issues
  const advisories = [];
  if (!REST_URL) advisories.push('UPSTASH_REDIS_REST_URL is empty');
  if (!REST_TOKEN) advisories.push('UPSTASH_REDIS_REST_TOKEN is empty');
  if (REST_URL && env.url_protocol !== 'https') {
    advisories.push('URL protocol is "' + env.url_protocol + '" — must be "https". If you pasted the rediss:// or redis:// connection string, switch to the REST URL (https://...upstash.io) from the Upstash "REST" tab.');
  }
  if (env.url_has_whitespace) advisories.push('URL contains whitespace — re-paste without leading/trailing spaces');
  if (env.token_has_whitespace) advisories.push('TOKEN contains whitespace — re-paste without leading/trailing spaces');
  if (REST_URL && !REST_URL.includes('upstash.io')) {
    advisories.push('URL hostname does not contain "upstash.io" — confirm you copied from the right database');
  }

  const tests = [];

  if (REST_URL && REST_TOKEN && env.url_protocol === 'https') {
    // Test 1: PING
    try {
      const t0 = Date.now();
      const r = await fetch(REST_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + REST_TOKEN,
          'content-type': 'application/json'
        },
        body: JSON.stringify(['PING'])
      });
      const body = await r.text();
      tests.push({
        test: 'PING',
        elapsedMs: Date.now() - t0,
        status: r.status,
        statusText: r.statusText,
        body: body.slice(0, 400)
      });
    } catch (e) {
      tests.push({ test: 'PING', error: String(e && e.message || e) });
    }

    // Test 2: SET probe key
    try {
      const t0 = Date.now();
      const probeKey = 'limen:diag:probe';
      const probeVal = 'diag-' + Date.now();
      const r = await fetch(REST_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + REST_TOKEN,
          'content-type': 'application/json'
        },
        body: JSON.stringify(['SET', probeKey, probeVal, 'EX', '60'])
      });
      const body = await r.text();
      tests.push({
        test: 'SET ' + probeKey + ' (TTL 60s)',
        elapsedMs: Date.now() - t0,
        status: r.status,
        statusText: r.statusText,
        body: body.slice(0, 400),
        wroteVal: probeVal
      });

      // Test 3: GET it back
      const t1 = Date.now();
      const r2 = await fetch(REST_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + REST_TOKEN,
          'content-type': 'application/json'
        },
        body: JSON.stringify(['GET', probeKey])
      });
      const body2 = await r2.text();
      tests.push({
        test: 'GET ' + probeKey,
        elapsedMs: Date.now() - t1,
        status: r2.status,
        statusText: r2.statusText,
        body: body2.slice(0, 400),
        readbackMatches: body2.includes(probeVal)
      });
    } catch (e) {
      tests.push({ test: 'SET/GET', error: String(e && e.message || e) });
    }
  }

  // Verdict
  let verdict;
  if (advisories.length > 0) {
    verdict = 'CONFIG_ISSUE';
  } else if (tests.length === 0) {
    verdict = 'NOT_TESTED';
  } else {
    const allOk = tests.every(t => t.status >= 200 && t.status < 300);
    verdict = allOk ? 'OK' : 'UPSTASH_REJECTED';
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({
    ok: verdict === 'OK',
    verdict: verdict,
    env: env,
    advisories: advisories,
    tests: tests,
    timestamp: Date.now()
  }, null, 2));
};
