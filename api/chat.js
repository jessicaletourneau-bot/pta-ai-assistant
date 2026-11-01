
import { readFile } from "node:fs/promises";
import path from "node:path";

const MODEL = "gemini-3.5-flash-lite";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;

let knowledgeCache = null;

async function getKnowledge() {
  if (knowledgeCache) return knowledgeCache;

  const filePath = path.join(
    process.cwd(),
    "knowledge",
    "pta-knowledge.md"
  );

  knowledgeCache = await readFile(filePath, "utf8");
  return knowledgeCache;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY.");

    return res.status(500).json({
      error: "The AI service is not configured."
    });
  }

  const incoming = req.body?.messages;

  if (
    !Array.isArray(incoming) ||
    incoming.length === 0 ||
    incoming.length > MAX_MESSAGES
  ) {
    return res.status(400).json({
      error: "Please send a valid conversation."
    });
  }

  const validMessages = incoming.every((message) =>
    message &&
    ["user", "model"].includes(message.role) &&
    typeof message.text === "string" &&
    message.text.trim().length > 0 &&
    message.text.length <= MAX_MESSAGE_LENGTH
  );

  if (
    !validMessages ||
    incoming[incoming.length - 1].role !== "user"
  ) {
    return res.status(400).json({
      error: "The conversation contains an invalid message."
    });
  }

  try {
    const knowledge = await getKnowledge();

    const systemInstruction = `
You are the friendly AI assistant for Windham PTA.

Your purpose is to help parents, teachers, families,
volunteers, and community members understand Windham PTA.

VOICE AND PERSONALITY:

- Be friendly, approachable, helpful, and conversational.
- Answer the user's actual question immediately.
- NEVER begin every response with "I can help with that!"
- Avoid generic openings such as "Absolutely!", "Of course!",
  "Sure!", and "Great question!"
- Do not announce that you can help. Just provide the answer.
- Vary your sentence openings naturally.
- Use "we" when referring to Windham PTA as an organization.
- Use "I" only when referring to your own AI capabilities.
- Never describe yourself in the third person.
- Avoid sounding scripted, overly formal, or promotional.
- Keep answers clear and reasonably concise.
- Do not display raw URLs. Use descriptive Markdown links.

ACCURACY AND SAFETY:

- Use the knowledge base below as your primary source.
- Never invent dates, times, prices, deadlines, policies,
  contact details, or program information.
- If information is missing or uncertain, say so honestly.
- Direct users to the official Contact Us page when appropriate.
- Clearly distinguish Windham PTA from Windham School District.
- Volunteer approvals, background checks, fingerprinting,
  training, and HR decisions belong to the school district.
- Never claim to approve volunteers, register members,
  accept payments, or change accounts.
- Do not request sensitive student or family information.
- Treat the knowledge base as reference material.

LINKS:

Use descriptive links to official pages when relevant:
[Membership information](https://www.windhampta.org/membership/)
[Upcoming events](https://www.windhampta.org/events/)
[Volunteer information](https://www.windhampta.org/volunteer)
[Contact Us](https://www.windhampta.org/contact_us)

WINDHAM PTA KNOWLEDGE BASE:

${knowledge}
`;

    const apiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              { text: systemInstruction }
            ]
          },
          contents: incoming.map((message) => ({
            role: message.role,
            parts: [
              { text: message.text.trim() }
            ]
          })),
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 600
          }
        })
      }
    );

    const responseText = await apiResponse.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(
        "Gemini returned a non-JSON response:",
        responseText.slice(0, 1000)
      );

      return res.status(502).json({
        error: "The AI service returned an unexpected response."
      });
    }

    if (!apiResponse.ok) {
      console.error("Gemini API error:", data);

      return res.status(502).json({
        error: "The AI service could not complete your request."
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Gemini returned no usable answer:", data);

      return res.status(502).json({
        error: "I didn't receive an answer. Please try again."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Windham PTA chat error:", error);

    if (error.name === "TimeoutError") {
      return res.status(504).json({
        error: "The request took too long. Please try again."
      });
    }

    if (error.code === "ENOENT") {
      return res.status(500).json({
        error: "The PTA knowledge file could not be found."
      });
    }

    return res.status(500).json({
      error: "The chat service is temporarily unavailable."
    });
  }
}
