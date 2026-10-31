export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured in Vercel.' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is missing.' });
  }

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: "You are an expert, friendly, and organized assistant for the school Parent Teacher Association (PTA). Keep answers concise, helpful, and friendly." }]
          },
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return res.status(500).json({ error: 'Google API error', details: data });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
}
