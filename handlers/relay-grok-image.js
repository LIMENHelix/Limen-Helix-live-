/**
 * relay-grok-image.js — Generate reference images using Grok
 *
 * POST /api/relay-grok-image
 * Body: { description, style }
 *
 * Returns: { imageUrl, prompt, generatedAt }
 * Uses Grok to generate a reference image of what the customer is looking for
 */

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { description, style = 'product photo' } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description required' });
    }

    // Build Grok prompt
    const grokPrompt = `Generate a realistic ${style} of: ${description}.
    Make it look like a product listing photo. Keep it clean and professional.
    The image should help someone understand exactly what this item looks like.`;

    // Call Grok API
    // NOTE: Grok API endpoint and auth via environment variables
    // GROK_API_KEY and GROK_API_URL should be set in Vercel env
    const grokApiUrl = process.env.GROK_API_URL || 'https://api.x.ai/v1/images/generations';
    const grokApiKey = process.env.GROK_API_KEY;

    if (!grokApiKey) {
      console.warn('[relay-grok-image] GROK_API_KEY not configured, returning mock image');

      // Return mock image for development
      return res.status(200).json({
        imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23f0f0f0" width="400" height="400"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="16" fill="%23999"%3EMock Image: ' + encodeURIComponent(description.substring(0, 20)) + '%3C/text%3E%3C/svg%3E',
        prompt: grokPrompt,
        generatedAt: new Date().toISOString(),
        mock: true
      });
    }

    try {
      const response = await fetch(grokApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${grokApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: grokPrompt,
          model: 'grok-vision',
          n: 1,
          size: '512x512'
        })
      });

      if (!response.ok) {
        throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Extract image URL from Grok response
      const imageUrl = data.data && data.data[0] && data.data[0].url
        ? data.data[0].url
        : null;

      if (!imageUrl) {
        throw new Error('No image URL in Grok response');
      }

      return res.status(200).json({
        imageUrl,
        prompt: grokPrompt,
        generatedAt: new Date().toISOString(),
        model: 'grok-vision'
      });

    } catch (grokError) {
      console.error('[relay-grok-image] Grok API call failed:', grokError.message);

      // Fallback: return mock image if Grok fails
      return res.status(200).json({
        imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23f0f0f0" width="400" height="400"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" fill="%23999"%3EImage generation unavailable%3C/text%3E%3C/svg%3E',
        prompt: grokPrompt,
        generatedAt: new Date().toISOString(),
        error: grokError.message
      });
    }

  } catch (e) {
    console.error('[relay-grok-image]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
