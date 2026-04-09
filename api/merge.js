export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;
  if (!image || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  const TOKEN = process.env.REPLICATE_API_KEY;

  try {
    // instruct-pix2pix 예측 시작
    const startRes = await fetch(
      'https://api.replicate.com/v1/models/timbrooks/instruct-pix2pix/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait',
        },
        body: JSON.stringify({
          input: {
            image,
            prompt,
            num_inference_steps: 30,
            image_guidance_scale: 1.5,
            guidance_scale: 7,
          },
        }),
      }
    );

    if (!startRes.ok) {
      const err = await startRes.json();
      return res.status(startRes.status).json({ error: err.detail || 'Replicate error' });
    }

    let pred = await startRes.json();

    // 폴링 (Prefer:wait 가 60s 내 완료 못 하면 이쪽으로 넘어옴)
    let attempts = 0;
    while ((pred.status === 'starting' || pred.status === 'processing') && attempts < 60) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { 'Authorization': `Token ${TOKEN}` },
      });
      pred = await poll.json();
      attempts++;
    }

    if (pred.status === 'succeeded') {
      const src = Array.isArray(pred.output) ? pred.output[0] : pred.output;
      return res.status(200).json({ image: src });
    } else if (pred.status === 'failed') {
      return res.status(400).json({ error: pred.error || 'failed' });
    } else {
      return res.status(500).json({ error: 'timeout' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
