/**
 * api/redis-audit.js — TEMPORARY Upstash storage audit (safe, read-only).
 *
 * GET /api/redis-audit?probe=1[&iter=300][&sample=12]
 *
 * Answers "what is consuming the 48 GB?" without leaking the token (runs
 * server-side with the env creds). Strategy:
 *   - DBSIZE: total key count
 *   - SCAN sample (capped) → group keys by prefix (text before first ':')
 *   - MEMORY USAGE on a few sample keys per prefix → avg bytes → estimate
 *     total bytes per prefix (avg × full-DB extrapolated count)
 *   - track the biggest individual keys seen + their TYPE
 *
 * READ ONLY — only DBSIZE / SCAN / TYPE / MEMORY USAGE / TTL. Writes nothing,
 * deletes nothing. Remove this file after the audit.
 */
module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  if ((req.url || '').indexOf('probe=1') === -1) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: 'use ?probe=1 to run the audit' }));
  }
  const URL = process.env.UPSTASH_REDIS_REST_URL || '';
  const TOK = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!URL || !TOK) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'redis env not present at runtime' }));
  }
  const q = req.query || {};
  const MAXITER = Math.min(parseInt(q.iter || '300', 10), 2000);   // 300 * COUNT 1000 = ~300k keys sampled
  const SAMPLE = Math.min(parseInt(q.sample || '12', 10), 40);     // MEMORY USAGE samples per prefix

  async function cmd(arr) {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOK, 'content-type': 'application/json' },
      body: JSON.stringify(arr)
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }

  try {
    const t0 = Date.now();
    const dbsize = await cmd(['DBSIZE']);

    let cursor = '0', iter = 0, scanned = 0;
    const prefixes = {};         // pfx -> { count, samples:[keys] }
    do {
      const r = await cmd(['SCAN', cursor, 'COUNT', '1000']);
      cursor = String(r[0]);
      const keys = r[1] || [];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        scanned++;
        const ci = k.indexOf(':');
        const pfx = ci > -1 ? k.slice(0, ci) : '(no-colon)';
        if (!prefixes[pfx]) prefixes[pfx] = { count: 0, samples: [] };
        prefixes[pfx].count++;
        if (prefixes[pfx].samples.length < SAMPLE) prefixes[pfx].samples.push(k);
      }
      iter++;
    } while (cursor !== '0' && iter < MAXITER);

    const fullScan = cursor === '0';
    const scaleFactor = scanned > 0 ? (dbsize / scanned) : 1;   // extrapolate sample → whole DB

    // measure sample bytes + type per prefix
    const out = [];
    let biggest = [];
    for (const pfx in prefixes) {
      const p = prefixes[pfx];
      let totBytes = 0, n = 0, type = '?';
      for (let i = 0; i < p.samples.length; i++) {
        try {
          const mu = await cmd(['MEMORY', 'USAGE', p.samples[i]]);
          if (typeof mu === 'number') { totBytes += mu; n++; biggest.push({ key: p.samples[i], bytes: mu }); }
          if (type === '?') { try { type = await cmd(['TYPE', p.samples[i]]); } catch (e) {} }
        } catch (e) {}
      }
      const avg = n > 0 ? totBytes / n : 0;
      const estCount = Math.round(p.count * scaleFactor);
      out.push({
        prefix: pfx,
        sampledCount: p.count,
        estTotalKeys: estCount,
        type: type,
        avgBytesPerKey: Math.round(avg),
        estTotalBytes: Math.round(avg * estCount),
        estTotalMB: +(avg * estCount / 1048576).toFixed(1)
      });
    }
    out.sort((a, b) => b.estTotalBytes - a.estTotalBytes);
    biggest.sort((a, b) => b.bytes - a.bytes);
    biggest = biggest.slice(0, 25).map(x => ({ key: x.key, KB: +(x.bytes / 1024).toFixed(1) }));

    const estTotalMB = +(out.reduce((s, p) => s + p.estTotalBytes, 0) / 1048576).toFixed(1);

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      dbsize: dbsize,
      keysScanned: scanned,
      fullScan: fullScan,
      note: fullScan ? 'scanned ALL keys' : 'sampled subset; totals extrapolated to dbsize via scaleFactor ' + scaleFactor.toFixed(2),
      estTotalMB: estTotalMB,
      byPrefix: out,
      biggestSampledKeys: biggest,
      elapsedMs: Date.now() - t0
    }, null, 2));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
};
