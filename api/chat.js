
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AI service is not configured."
    });
  }

  const messages = req.body?.messages;

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 12
  ) {
    return res.status(400).json({
      error: "Invalid conversation."
    });
  }

  const validMessages = messages.every(
    (message) =>
      ["user", "model"].includes(message.role) &&
      typeof message.text === "string" &&
      message.text.length > 0 &&
      message.text.length <= 2000
  );

  if (!validMessages) {
    return res.status(400).json({
      error: "Invalid message format."
    });
  }

  try {
    const apiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are the friendly and knowledgeable
              Windham PTA Assistant.

              Help parents with PTA membership, school events,
              volunteering, fundraising, programs and general
              PTA questions.

              Be friendly, organized and concise.

              Never invent event dates, policies, prices,
              deadlines or contact information.

              If you do not know an answer, explain that
              the visitor should contact the Windham PTA.

              You are an informational assistant, not an
              official spokesperson for the school district.`
            }]
          },
          contents: messages.map((message) => ({
            role: message.role,
            parts: [{ text: message.text }]
          })),
          generationConfig: {
            maxOutputTokens: 500
          }
        })
      }
    );

    const data = await apiRes.json();

    if (!apiRes.ok) {
      console.error("Gemini API error:", data);

      return res.status(502).json({
        error: data.error?.message ||
          "The AI service returned an error."
      });
    }

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!reply) {
      return res.status(502).json({
        error: "The AI did not generate a response."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Chat error:", error);

    if (error.name === "TimeoutError") {
      return res.status(504).json({
        error: "The AI is taking too long. Please try again."
      });
    }

    return res.status(500).json({
      error: "Unable to connect to the AI service."
    });
  }
}
