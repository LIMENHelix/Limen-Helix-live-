/**
 * relay-grok-image.js — Generate reference images using xAI Grok
 *
 * POST /api/relay-grok-image
 * Body: { description, style }
 *
 * Returns: { imageUrl, prompt, generatedAt }
 * Uses xAI's grok-imagine-image-quality for product reference images
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

    const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    if (!apiKey) {
      console.warn('[relay-grok-image] XAI_API_KEY/GROK_API_KEY not configured');
      return res.status(400).json({ error: 'Image generation not configured' });
    }

    const model = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-quality';
    const prompt = `${style} of ${description}. professional product photo. clean background. well lit. high quality.`;

    try {
      const response = await fetch('https://api.x.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          aspect_ratio: '16:9'
        })
      });

      if (!response.ok) {
        let errorMsg;
        try {
          const errorData = await response.json();
          errorMsg = JSON.stringify(errorData);
        } catch (e) {
          errorMsg = await response.text();
        }
        throw new Error(`xAI error ${response.status}: ${errorMsg}`);
      }

      const data = await response.json();
      const imageUrl = data.data && data.data[0] && data.data[0].url;

      if (!imageUrl) {
        throw new Error('No image URL in xAI response');
      }

      return res.status(200).json({
        imageUrl,
        prompt,
        generatedAt: new Date().toISOString(),
        model
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
