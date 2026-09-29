const crypto = require('crypto');

const MAX_PORTAL_BYTES = 8 * 1024 * 1024;
const SOURCE_SHA_ENV = 'LIMEN_PORTAL_SOURCE_SHA';
const SOURCE_REPOSITORY = 'LIMENHelix/Limen-Helix';

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

async function boundedBytes(response) {
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
      return { bytes: Buffer.concat(chunks, bytes) };
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
      return { bytes: Buffer.concat(chunks, bytes) };
    } catch (_) {
      await cancelBody(response.body);
      return { readFailed: true };
    }
  }

  // Response bodies are always streamed in production. This fallback keeps
  // lightweight mocks honest by measuring the decoded text before parsing.
  try {
    const text = await response.text();
    const bytes = Buffer.from(text, 'utf8');
    return bytes.length > MAX_PORTAL_BYTES ? tooLarge() : { bytes };
  } catch (_) {
    return { readFailed: true };
  }
}

function gitBlobSha(bytes) {
  const header = Buffer.from('blob ' + bytes.length + '\0', 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header, bytes])).digest('hex');
}

// This is the deployed portal contract. It is intentionally explicit instead
// of accepting any valid JSON returned by an upstream repository. Domain
// brains consume these fields directly, so a shape failure is a hard upstream
// error rather than an empty-success response.
function validatePortalSchema(portal, requestedDomainId) {
  if (!portal || typeof portal !== 'object' || Array.isArray(portal)) return 'portal-not-an-object';
  if (typeof portal.domainId !== 'string' || portal.domainId.length === 0) return 'domain-id-missing-or-invalid';
  // L4-L7 files are nested route slugs but intentionally retain their root
  // domainId (for example energy_datacenter.json -> energy). Accept only that
  // authored root-family relationship; never accept an unrelated domain.
  if (requestedDomainId && portal.domainId !== requestedDomainId &&
    !requestedDomainId.startsWith(portal.domainId + '_')) return 'domain-id-does-not-match-request';
  if (typeof portal.title !== 'string' || portal.title.length === 0) return 'title-missing-or-invalid';
  if (typeof portal.phase !== 'string' || portal.phase.length === 0) return 'phase-missing-or-invalid';
  if (!Array.isArray(portal.activations)) return 'activations-not-array';
  // Deep portals may omit authored issues; portal-ui synthesizes them from
  // activations. If present, the field must still have the expected shape.
  if (portal.issues !== undefined && !Array.isArray(portal.issues)) return 'issues-not-array';
  if (portal.edges !== undefined && !Array.isArray(portal.edges)) return 'edges-not-array';
  for (let i = 0; i < portal.activations.length; i++) {
    const activation = portal.activations[i];
    if (!activation || typeof activation !== 'object' || Array.isArray(activation)) return 'activation-shape@' + i;
    if (typeof activation.brainNodeId !== 'string' || activation.brainNodeId.length === 0) {
      return 'activation-brain-node-id@' + i;
    }
    if (activation.treatments !== undefined && !Array.isArray(activation.treatments)) return 'activation-treatments-not-array@' + i;
  }
  return null;
}

function sourceRevision() {
  const value = process.env[SOURCE_SHA_ENV];
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : null;
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

  const revision = sourceRevision();
  if (!revision) {
    return res.status(503).json({
      error: 'Portal source is not pinned',
      hint: `Set ${SOURCE_SHA_ENV} to the approved immutable 40-character source commit SHA`
    });
  }

  const relativePath = `assets/data/domains/${domainId}.json`;
  const metadataUrl = `https://api.github.com/repos/${SOURCE_REPOSITORY}/contents/${relativePath}?ref=${revision}`;

  try {
    // Resolve the file metadata at the immutable source revision first. The
    // metadata SHA is the expected Git blob identity for the exact file.
    const metaRes = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LimenHelix-Portal'
      }
    });

    if (metaRes.status === 404) {
      return res.status(404).json({ error: 'Domain not found' });
    }
    if (!metaRes.ok) {
      return res.status(502).json({ error: 'GitHub metadata error', status: metaRes.status });
    }

    let metadata;
    try {
      metadata = await metaRes.json();
    } catch (_) {
      return res.status(502).json({ error: 'Malformed GitHub metadata response' });
    }
    if (!metadata || metadata.type !== 'file' || metadata.path !== relativePath ||
      typeof metadata.sha !== 'string' || !/^[0-9a-f]{40}$/i.test(metadata.sha)) {
      return res.status(502).json({ error: 'GitHub metadata failed portal identity validation' });
    }

    // Fetch the immutable blob by its content address. This avoids the moving
    // default branch and gives the response an independently checkable source
    // identity even when the portal is larger than GitHub's inline-content cap.
    const blobSha = metadata.sha.toLowerCase();
    const blobRes = await fetch(`https://api.github.com/repos/${SOURCE_REPOSITORY}/git/blobs/${blobSha}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.raw+json',
        'User-Agent': 'LimenHelix-Portal'
      }
    });
    if (blobRes.status === 404) {
      return res.status(404).json({ error: 'Portal blob not found', sourceRevision: revision });
    }
    if (!blobRes.ok) {
      return res.status(502).json({ error: 'GitHub blob error', status: blobRes.status });
    }

    const body = await boundedBytes(blobRes);
    if (body.tooLarge) {
      return res.status(502).json({ error: 'Portal response too large' });
    }
    if (body.readFailed) {
      return res.status(502).json({ error: 'Unable to read portal response from GitHub' });
    }
    if (gitBlobSha(body.bytes) !== blobSha) {
      return res.status(502).json({ error: 'Portal content integrity check failed' });
    }

    let json;
    try {
      json = JSON.parse(body.bytes.toString('utf8'));
    } catch (_) {
      return res.status(502).json({ error: 'Malformed portal JSON from GitHub' });
    }

    const schemaError = validatePortalSchema(json, domainId);
    if (schemaError) {
      return res.status(502).json({ error: 'Portal schema validation failed', reason: schemaError });
    }

    // Cache for 1 hour — these files rarely change. The deployment-level
    // source SHA and response provenance headers make the cache identity clear.
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Limen-Portal-Source-Revision', revision);
    res.setHeader('X-Limen-Portal-Content-Sha', blobSha);
    return res.status(200).json(json);

  } catch (err) {
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
};

module.exports.MAX_PORTAL_BYTES = MAX_PORTAL_BYTES;
module.exports.SOURCE_SHA_ENV = SOURCE_SHA_ENV;
module.exports.SOURCE_REPOSITORY = SOURCE_REPOSITORY;
module.exports.gitBlobSha = gitBlobSha;
module.exports.validatePortalSchema = validatePortalSchema;
