/**
 * relay-grok-image.js — Generate reference images using Replicate Stable Diffusion
 *
 * POST /api/relay-grok-image
 * Body: { description, style }
 *
 * Returns: { imageUrl, prompt, generatedAt }
 * Uses Replicate's Stable Diffusion to generate product reference images
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

    const replicateApiKey = process.env.REPLICATE_API_TOKEN;
    if (!replicateApiKey) {
      console.warn('[relay-grok-image] REPLICATE_API_TOKEN not configured');
      return res.status(400).json({ error: 'Image generation not configured' });
    }

    // Build prompt for Stable Diffusion
    const prompt = `${style} of ${description}. professional product photo. clean background. well lit. high quality.`;

    try {
      // Create prediction
      const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${replicateApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: 'db21e45d3f7023abc9e46f5955aae626417486587a88e0ee8e6b8ce4a9d61d41',
          input: {
            prompt,
            num_outputs: 1,
            height: 512,
            width: 512,
            scheduler: 'K_EULER',
            num_inference_steps: 25,
            guidance_scale: 7.5,
            seed: Math.floor(Math.random() * 1000000)
          }
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(`Replicate error: ${createResponse.status} - ${JSON.stringify(errorData)}`);
      }

      const prediction = await createResponse.json();
      const predictionId = prediction.id;

      // Poll for completion
      let output = null;
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max

      while (!output && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: { 'Authorization': `Token ${replicateApiKey}` }
        });

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }

        const status = await statusResponse.json();

        if (status.status === 'succeeded') {
          output = status.output && status.output[0];
          break;
        } else if (status.status === 'failed') {
          throw new Error(`Prediction failed: ${status.error}`);
        }

        attempts++;
      }

      if (!output) {
        throw new Error('Image generation timed out');
      }

      return res.status(200).json({
        imageUrl: output,
        prompt,
        generatedAt: new Date().toISOString(),
        model: 'stable-diffusion-v1.5'
      });

    } catch (apiError) {
      console.error('[relay-grok-image] Replicate API failed:', apiError.message);
      return res.status(500).json({ error: apiError.message });
    }

  } catch (e) {
    console.error('[relay-grok-image]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
