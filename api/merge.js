export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sourceImage, targetImage } = req.body;

  if (!sourceImage || !targetImage) {
    return res.status(400).json({ error: 'Missing images' });
  }

  try {
    // Replicate API 호출
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
      },
      body: JSON.stringify({
        version: '29f7d058a0938ab21ed3e9e8fba15e010b5cef40',  // face-swap 모델
        input: {
          source_image: sourceImage,  // 사용자 얼굴
          target_image: targetImage,  // 헤어스타일 이미지
        },
      }),
    });

    const prediction = await response.json();

    if (prediction.error) {
      return res.status(400).json({ error: prediction.error });
    }

    // 결과 대기
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 120;

    while ((result.status === 'starting' || result.status === 'processing') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusRes = await fetch(
        `https://api.replicate.com/v1/predictions/${result.id}`,
        {
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
          },
        }
      );

      result = await statusRes.json();
      attempts++;
    }

    if (result.status === 'succeeded') {
      return res.status(200).json({ image: result.output });
    } else if (result.status === 'failed') {
      return res.status(400).json({ error: 'Processing failed' });
    } else {
      return res.status(500).json({ error: 'Processing timeout' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
