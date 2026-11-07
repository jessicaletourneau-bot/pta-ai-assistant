// Vercel serverless diagnostic endpoint: /api/test-gemini
// Uses the existing GEMINI_API_KEY environment variable.
// Never sends the API key to the browser.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, stage: "method", error: "Use POST." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      stage: "configuration",
      error: "GEMINI_API_KEY is not set in this Vercel environment."
    });
  }

  const startedAt = Date.now();
  const model = "gemini-3.7-flash";
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";

  console.log("[Gemini diagnostic] 1. Starting request", {
    model,
    endpoint,
    timestamp: new Date().toISOString()
  });

  let response;
  let rawBody = "";

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model,
        input: "Reply with exactly: GEMINI_API_ACCESS_OK",
        store: false,
        generation_config: {
          thinking_level: "low",
          max_output_tokens: 40
        }
      })
    });

    rawBody = await response.text();
    const elapsedMs = Date.now() - startedAt;

    console.log("[Gemini diagnostic] 2. Google responded", {
      httpStatus: response.status,
      elapsedMs,
      responsePreview: rawBody.slice(0, 1800)
    });

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return res.status(502).json({
        ok: false,
        stage: "google_response_parse",
        googleHttpStatus: response.status,
        elapsedMs,
        responsePreview: rawBody.slice(0, 1800),
        error: "Google responded, but the response was not valid JSON."
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        stage: "google_rejected_request",
        googleHttpStatus: response.status,
        elapsedMs,
        googleError: data.error || data,
        error: "Google received the request but rejected it. See googleError."
      });
    }

    const outputText =
      data.output_text ||
      (Array.isArray(data.steps)
        ? data.steps
            .filter(step => step.type === "model_output")
            .flatMap(step => step.content || [])
            .filter(part => part.type === "text" && typeof part.text === "string")
            .map(part => part.text)
            .join("\n")
        : "") ||
      "";

    console.log("[Gemini diagnostic] 3. Parsed successful response", {
      elapsedMs,
      status: data.status,
      hasOutputText: Boolean(outputText)
    });

    return res.status(200).json({
      ok: true,
      stage: "complete",
      model,
      googleHttpStatus: response.status,
      interactionStatus: data.status || null,
      elapsedMs,
      outputText: outputText || null,
      message: outputText
        ? "Gemini API access is working."
        : "Google accepted the request, but no text was found in the response. Inspect responsePreview.",
      responsePreview: outputText ? undefined : rawBody.slice(0, 1800)
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";

    console.error("[Gemini diagnostic] Request failed before a Google response", {
      elapsedMs,
      name: error?.name,
      message: error?.message,
      cause: error?.cause?.message || null
    });

    return res.status(504).json({
      ok: false,
      stage: timedOut ? "request_timeout" : "network_or_fetch_error",
      elapsedMs,
      errorName: error?.name || "Error",
      error: error?.message || "The request failed before a response was received.",
      message: timedOut
        ? "No response from Google within 15 seconds."
        : "The server could not complete the request to Google."
    });
  }
}
