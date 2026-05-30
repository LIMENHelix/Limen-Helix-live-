export default async function handler(req, res) {
  const { domainId } = req.query;

  if (!domainId) {
    return res.status(400).json({ error: 'Missing domainId parameter' });
  }

  // Reject path traversal
  if (domainId.includes('/') || domainId.includes('..')) {
    return res.status(400).json({ error: 'Invalid domainId' });
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.VERCEL_GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server misconfigured', hint: 'Set GITHUB_TOKEN env var' });
  }

  const url = `https://api.github.com/repos/LIMENHelix/Limen-Helix/contents/assets/data/domains/${encodeURIComponent(domainId)}.json`;

  try {
    const ghRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LimenHelix-Portal'
      }
    });

    if (ghRes.status === 404) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    if (!ghRes.ok) {
      return res.status(502).json({ error: 'GitHub API error', status: ghRes.status });
    }

    const data = await ghRes.json();

    // GitHub Contents API returns base64-encoded content
    if (!data.content) {
      return res.status(502).json({ error: 'No content in GitHub response' });
    }

    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
    const json = JSON.parse(decoded);

    // Cache for 1 hour — these files rarely change
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(json);

  } catch (err) {
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
