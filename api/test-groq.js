export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, stage: "method", error: "Use POST." });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({
    ok: false, stage: "configuration",
    error: "GROQ_API_KEY is not set in this Vercel environment."
  });

  const model = "openai/gpt-oss-120b";
  const startedAt = Date.now();
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Follow the user's exact instruction." },
          { role: "user", content: "Reply with exactly: GROQ_API_ACCESS_OK" }
        ],
        temperature: 0,
        max_completion_tokens: 40
      })
    });
    const raw = await response.text();
    const elapsedMs = Date.now() - startedAt;
    let data;
    try { data = JSON.parse(raw); }
    catch {
      console.error("[Groq diagnostic] Non-JSON response", response.status, raw.slice(0, 1200));
      return res.status(502).json({
        ok: false, stage: "response_parse", providerHttpStatus: response.status,
        elapsedMs, responsePreview: raw.slice(0, 1200)
      });
    }
    if (!response.ok) {
      console.error("[Groq diagnostic] Provider rejected request", response.status, data.error || data);
      return res.status(502).json({
        ok: false, stage: "provider_rejected_request",
        providerHttpStatus: response.status, elapsedMs,
        providerError: data.error || data,
        message: "Groq received the request but rejected it."
      });
    }
    const outputText = data.choices?.[0]?.message?.content?.trim() || "";
    console.log("[Groq diagnostic] Response", {
      status: response.status, elapsedMs, model: data.model, outputText
    });
    return res.status(200).json({
      ok: Boolean(outputText), stage: outputText ? "complete" : "empty_response",
      requestedModel: model, returnedModel: data.model || null,
      providerHttpStatus: response.status, elapsedMs,
      outputText: outputText || null, usage: data.usage || null
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    console.error("[Groq diagnostic] Fetch failed", {
      elapsedMs, name: error?.name, message: error?.message
    });
    return res.status(504).json({
      ok: false, stage: timedOut ? "request_timeout" : "network_or_fetch_error",
      elapsedMs, errorName: error?.name || "Error",
      error: error?.message || "Request failed before response."
    });
  }
}