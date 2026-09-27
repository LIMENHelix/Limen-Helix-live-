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

    const text = await ghRes.text();
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
