const MAX_PORTAL_BYTES = 8 * 1024 * 1024;

function header(res, name) {
  if (!res || !res.headers) return null;
  if (typeof res.headers.get === 'function') return res.headers.get(name);
  return res.headers[name] || res.headers[name.toLowerCase()] || null;
}

async function cancelBody(body) {
  try { if (body && typeof body.cancel === 'function') await body.cancel(); } catch (_) {}
}

function tooLarge() {
  return { tooLarge: true };
}

function chunkBytes(value) {
  if (typeof value === 'string') return Buffer.from(value);
  return Buffer.from(value);
}

async function boundedText(response) {
  const contentLength = header(response, 'content-length');
  if (contentLength !== null && /^\d+$/.test(String(contentLength)) && Number(contentLength) > MAX_PORTAL_BYTES) {
    await cancelBody(response.body);
    return tooLarge();
  }

  // Fetch implementations used by Vercel expose a Web ReadableStream. Read it
  // in bounded chunks so a false/missing Content-Length cannot make text() and
  // JSON.parse() retain an unbounded upstream response.
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        const chunk = chunkBytes(next.value);
        if (chunk.length > MAX_PORTAL_BYTES - bytes) {
          await cancelBody(reader);
          return tooLarge();
        }
        if (chunk.length) {
          chunks.push(chunk);
          bytes += chunk.length;
        }
      }
      return { text: Buffer.concat(chunks, bytes).toString('utf8') };
    } catch (_) {
      await cancelBody(reader);
      return { readFailed: true };
    } finally {
      try { reader.releaseLock(); } catch (_) {}
    }
  }

  // Keep compatibility with Node-style test doubles and fetch adapters that
  // expose an async-iterable body instead of a Web ReadableStream.
  if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    let bytes = 0;
    try {
      for await (const value of response.body) {
        const chunk = chunkBytes(value);
        if (chunk.length > MAX_PORTAL_BYTES - bytes) {
          await cancelBody(response.body);
          return tooLarge();
        }
        if (chunk.length) {
          chunks.push(chunk);
          bytes += chunk.length;
        }
      }
      return { text: Buffer.concat(chunks, bytes).toString('utf8') };
    } catch (_) {
      await cancelBody(response.body);
      return { readFailed: true };
    }
  }

  // Response bodies are always streamed in production. This fallback keeps
  // lightweight mocks honest by measuring the decoded text before parsing.
  try {
    const text = await response.text();
    return Buffer.byteLength(text, 'utf8') > MAX_PORTAL_BYTES ? tooLarge() : { text };
  } catch (_) {
    return { readFailed: true };
  }
}

module.exports = async function handler(req, res) {
  const { domainId } = req.query;

  if (!domainId) {
    return res.status(400).json({ error: 'Missing domainId parameter' });
  }

  // Hard shape gate: the proxy may only ever read assets/data/domains/<id>.json
  // from the LIMENHelix/Limen-Helix repo. Anything that is not a plain slug
  // (letters, digits, underscore, hyphen) is rejected before any token spend —
  // this covers path traversal, separators, control characters and overlong
  // ids in one check.
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(domainId)) {
    return res.status(400).json({ error: 'Invalid domainId' });
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.VERCEL_GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server misconfigured', hint: 'Set GITHUB_TOKEN env var' });
  }

  const url = `https://api.github.com/repos/LIMENHelix/Limen-Helix/contents/assets/data/domains/${encodeURIComponent(domainId)}.json`;

  try {
    // Raw media type: the default JSON media type omits base64 `content` for
    // files >1 MiB (e.g. deep education portals at ~1.8 MiB), which used to make
    // every large portal unretrievable. Raw works for any size GitHub serves.
    const ghRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.raw+json',
        'User-Agent': 'LimenHelix-Portal'
      }
    });

    if (ghRes.status === 404) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    if (!ghRes.ok) {
      return res.status(502).json({ error: 'GitHub API error', status: ghRes.status });
    }

    const body = await boundedText(ghRes);
    if (body.tooLarge) {
      return res.status(502).json({ error: 'Portal response too large' });
    }
    if (body.readFailed) {
      return res.status(502).json({ error: 'Unable to read portal response from GitHub' });
    }
    const text = body.text;
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: 'Malformed portal JSON from GitHub' });
    }

    // Cache for 1 hour — these files rarely change
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(json);

  } catch (err) {
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}

module.exports.MAX_PORTAL_BYTES = MAX_PORTAL_BYTES;
