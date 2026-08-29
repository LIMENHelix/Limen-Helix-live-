/**
 * relay-grok-image.js — Generate reference images using xAI Grok
 *
 * POST /api/relay-grok-image
 * Body: { description, style }
 *
 * Returns: { imageUrl, prompt, generatedAt }
 * Uses xAI's Grok to generate a reference image
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

    const xaiApiKey = process.env.XAI_API_KEY;
    if (!xaiApiKey) {
      console.warn('[relay-grok-image] XAI_API_KEY not configured');
      return res.status(400).json({ error: 'Image generation not configured' });
    }

    // Build prompt for image generation
    const prompt = `Generate a realistic ${style} of: ${description}. Make it look like a product listing photo. Keep it clean and professional. The image should help someone understand exactly what this item looks like.`;

    try {
      const response = await fetch('https://api.x.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${xaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          model: 'grok-3',
          n: 1
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`xAI API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const imageUrl = data.data && data.data[0] && data.data[0].url;

      if (!imageUrl) {
        throw new Error('No image URL in response');
      }

      return res.status(200).json({
        imageUrl,
        prompt,
        generatedAt: new Date().toISOString(),
        model: 'grok-vision'
      });

    } catch (apiError) {
      console.error('[relay-grok-image] xAI API failed:', apiError.message);
      return res.status(500).json({ error: apiError.message });
    }

  } catch (e) {
    console.error('[relay-grok-image]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
