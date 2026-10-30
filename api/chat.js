export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured in Vercel environment variables.' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is missing.' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ADD SYSTEM INSTRUCTIONS HERE:
          systemInstruction: {
            parts: [
              {
                text: "You are an expert, friendly, and organized assistant for the school Parent Teacher Association (PTA). Your job is to help parents and volunteers understand school rules, event guidelines, membership steps, and volunteering policies. Always maintain a helpful, professional tone. If you are unsure of a specific local bylaw or rule, kindly advise them to check with the executive board."
              }
            ]
          },
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Google API rejected the request', details: data });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reach Google API', details: error.message });
  }
}
