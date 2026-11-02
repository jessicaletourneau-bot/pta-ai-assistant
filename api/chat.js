import { readFile } from "node:fs/promises";
import path from "node:path";

const MODEL = "gemini-3.5-flash-lite";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;
const SITE = "https://www.windhampta.org";
const PAGE_TIMEOUT_MS = 5000;
const MAX_PAGE_CHARS = 9500;
const MAX_CONTEXT_PAGES = 5;

let knowledgeCache = null;

// These are public Windham PTA pages. Pages are fetched when a visitor asks a
// question, so current rosters, events, and program details do not depend only
// on a manually maintained Markdown snapshot.
const SITE_PAGES = [
  { title: "Home and upcoming events", path: "/", terms: ["home", "upcoming", "calendar", "next meeting", "pta meeting", "when", "date", "event", "zoom"] },
  { title: "About Windham PTA", path: "/about_us", terms: ["mission", "about", "purpose", "what is windham pta"] },
  { title: "Executive Board", path: "/executive_board", terms: ["president", "vice president", "vp", "treasurer", "secretary", "board", "officer", "leadership", "executive"] },
  { title: "School Liaisons and Committee Chairs", path: "/liaisons_chairs", terms: ["liaison", "chair", "center school", "golden brook", "middle school", "high school", "membership chair", "reflections chair", "committee"] },
  { title: "Contact Us", path: "/contact_us", terms: ["contact", "email", "phone", "reach", "who do i contact"] },
  { title: "Membership", path: "/membership/", terms: ["membership", "join", "member", "membership card", "dues", "sign up"] },
  { title: "Partners Program", path: "/partners_program", terms: ["partner", "business", "discount", "sponsor", "local business"] },
  { title: "Partner Benefits", path: "/partners_program_benefit_information", terms: ["discount", "benefit", "offer", "business", "partner"] },
  { title: "What We Do and PTA Programs", path: "/what_we_do", terms: ["program", "scholarship", "academic recognition", "teacher appreciation", "clap out", "senior breakfast", "book fair", "outdoor classroom", "strawberry", "harvest", "night of lights", "last night", "conference dinner"] },
  { title: "Upcoming Events", path: "/events/", terms: ["event", "calendar", "upcoming", "meeting", "date", "time", "deadline"] },
  { title: "Past Events", path: "/past_events", terms: ["past event", "previous event", "history"] },
  { title: "Spiritwear", path: "/spiritwear", terms: ["spiritwear", "shirt", "clothing", "store", "order", "apparel"] },
  { title: "Art to Remember", path: "/arttoremember", terms: ["art to remember", "artwork", "art fundraiser", "school code", "keepsake"] },
  { title: "Reflections", path: "/reflections", terms: ["reflections", "art", "theme", "student art", "competition", "category", "categories", "deadline", "entry"] },
  { title: "Reflections 2026-2027", path: "/2026-2027_reflections", terms: ["reflections", "2026", "2027", "theme", "deadline", "entry"] },
  { title: "Reflections Categories and Guidelines", path: "/reflectionsguidelines", terms: ["reflections", "category", "categories", "guidelines", "rules", "format"] },
  { title: "Donate", path: "/donate", terms: ["donate", "donation", "contribute", "give"] },
  { title: "Volunteer", path: "/volunteer", terms: ["volunteer", "background check", "fingerprinting", "designated volunteer", "training", "field trip", "school volunteer"] },
  { title: "Record Volunteer Hours", path: "/record_volunteer_hours", terms: ["volunteer hours", "hours", "log hours", "record hours"] },
  { title: "Windham Schools", path: "/windhamschools", terms: ["school", "schools", "center school", "golden brook", "middle school", "high school", "preschool"] },
  { title: "New Hampshire PTA", path: "/statepta", terms: ["state pta", "new hampshire pta", "statewide"] },
  { title: "National PTA", path: "/nationalpta", terms: ["national pta", "national resources"] }
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9@.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scorePage(page, query) {
  const q = normalize(query);
  if (!q) return 0;
  let score = 0;
  const title = normalize(page.title);
  const url = normalize(page.path.replace(/[\/_-]/g, " "));
  if (q.includes(title)) score += 8;
  for (const term of page.terms) {
    const t = normalize(term);
    if (q.includes(t)) score += t.includes(" ") ? 5 : 2;
  }
  for (const token of q.split(" ")) {
    if (token.length > 3 && (title.includes(token) || url.includes(token))) score += 1;
  }
  return score;
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br|footer|header)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[\t\r ]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
  ).trim();
}

async function fetchPage(page) {
  const url = `${SITE}${page.path}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "WindhamPTAAssistant/1.0 (+https://www.windhampta.org)" },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS)
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html")) return null;
    const html = await response.text();
    const text = htmlToText(html).slice(0, MAX_PAGE_CHARS);
    if (!text) return null;
    return { title: page.title, url, text };
  } catch (error) {
    console.warn(`Windham PTA page fetch failed (${url}):`, error.message);
    return null;
  }
}

async function getWebsiteContext(messages) {
  // Use recent conversation context as well as the latest question. This is
  // what lets short follow-ups such as "for Center School" resolve correctly.
  const query = messages.slice(-6).map((m) => m.text).join("\n");
  const ranked = SITE_PAGES
    .map((page) => ({ page, score: scorePage(page, query) }))
    .sort((a, b) => b.score - a.score);

  const selected = [];
  const add = (path) => {
    const found = SITE_PAGES.find((p) => p.path === path);
    if (found && !selected.some((p) => p.path === path)) selected.push(found);
  };

  // Leadership pages are high-value authoritative sources. Fetch them when
  // the question relates to names, roles, liaisons, or committee ownership.
  const leadershipTerms = /president|vice president|\bvp\b|treasurer|secretary|board|officer|liaison|chair|committee|who is/i;
  if (leadershipTerms.test(query)) {
    add("/executive_board");
    add("/liaisons_chairs");
  }

  for (const item of ranked) {
    if (item.score > 0 && selected.length < MAX_CONTEXT_PAGES) add(item.page.path);
  }

  // A general question still gets the homepage and the broad programs page.
  if (selected.length === 0) {
    add("/");
    add("/what_we_do");
  }

  const pages = await Promise.all(selected.slice(0, MAX_CONTEXT_PAGES).map(fetchPage));
  return pages.filter(Boolean);
}

async function getKnowledge() {
  if (knowledgeCache) return knowledgeCache;
  const filePath = path.join(process.cwd(), "knowledge", "pta-knowledge.md");
  knowledgeCache = await readFile(filePath, "utf8");
  return knowledgeCache;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY.");
    return res.status(500).json({ error: "The AI service is not configured." });
  }

  const incoming = req.body?.messages;
  if (!Array.isArray(incoming) || incoming.length === 0 || incoming.length > MAX_MESSAGES) {
    return res.status(400).json({ error: "Please send a valid conversation." });
  }

  const validMessages = incoming.every((message) =>
    message && ["user", "model"].includes(message.role) &&
    typeof message.text === "string" && message.text.trim().length > 0 &&
    message.text.length <= MAX_MESSAGE_LENGTH
  );

  if (!validMessages || incoming[incoming.length - 1].role !== "user") {
    return res.status(400).json({ error: "The conversation contains an invalid message." });
  }

  try {
    const [knowledge, websitePages] = await Promise.all([
      getKnowledge(),
      getWebsiteContext(incoming)
    ]);

    const websiteContext = websitePages.length
      ? websitePages.map((page) => `SOURCE PAGE: ${page.title}\nURL: ${page.url}\nCONTENT:\n${page.text}`).join("\n\n---\n\n")
      : "No live Windham PTA pages could be retrieved for this question. Do not claim to have checked the live website.";

    const systemInstruction = `
You are the friendly AI assistant for Windham PTA.

PURPOSE AND SCOPE:
Help parents, teachers, families, volunteers, and community members answer questions about information published on the public Windham PTA website. Treat the live website content supplied below as the primary source for current information. The Markdown knowledge base is supplemental background.

VOICE:
- Be friendly, approachable, and conversational.
- Answer the user's actual question immediately. Do not announce that you can help.
- Never use canned openings such as "Absolutely!", "Of course!", or "I can help with that!"
- Use "we" naturally when speaking for Windham PTA.
- Keep answers clear and reasonably concise.
- Do not display raw URLs; use descriptive Markdown links.

QUESTION AND FOLLOW-UP HANDLING:
- Read the entire conversation, not just the latest message.
- Short follow-ups such as "for Center School", "who is current?", "what about the treasurer?", or "tell me more" refer to the established topic unless the user clearly changes subjects.
- Never say a message was cut off or unclear when it is a complete, understandable question.
- If the context already identifies a school, role, event, or program, carry it forward without asking the user to repeat it.
- If a direct answer is present in the live website content, give the answer. Do not merely send the user to a page to find it themselves.

SOURCE PRIORITY AND CURRENT INFORMATION:
1. Live Windham PTA website pages supplied below.
2. Supplemental PTA knowledge base below.
3. If neither supports the answer, say the information is not currently available and provide the most relevant official contact/page.
- Use the page URL associated with each fact when adding a source link.
- Do not invent names, emails, dates, times, prices, deadlines, policies, or program details.
- When live website content conflicts with the supplemental knowledge base, prefer the live page and mention uncertainty only if the live page itself is contradictory.
- If the website does not publish an answer, do not guess.
- Information may change; for time-sensitive information, use the live page content rather than stale dates in the knowledge base.

LEADERSHIP AND ROLE STATUS:
- Distinguish elected officers, interim officers, open positions, committee chairs, and school liaisons.
- The current website identifies Jessica Letourneau as interim Vice President. PTA-provided clarification: Jessica is serving on an interim basis and is willing to step down if another person wants to take on the Vice President role. Explain that the role is open to an interested person; do not describe Jessica as permanently committed or simply say the position is vacant.
- If the executive board page contains both a named interim officer and wording that the position is open, explain both facts clearly.

ORGANIZATIONAL BOUNDARIES:
- Clearly distinguish Windham PTA from Windham School District (SAU #95).
- Volunteer approvals, background checks, fingerprinting, training, and HR decisions belong to the school district.
- Never claim to approve volunteers, register members, accept payments, or change accounts.
- Do not request sensitive student or family information.

LIVE WINDHAM PTA WEBSITE CONTENT:
${websiteContext}

SUPPLEMENTAL WINDHAM PTA KNOWLEDGE BASE:
${knowledge}
`;

    const apiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: incoming.map((message) => ({
            role: message.role,
            parts: [{ text: message.text.trim() }]
          })),
          generationConfig: { temperature: 0.25, maxOutputTokens: 700 }
        })
      }
    );

    const responseText = await apiResponse.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Gemini returned a non-JSON response:", responseText.slice(0, 1000));
      return res.status(502).json({ error: "The AI service returned an unexpected response." });
    }

    if (!apiResponse.ok) {
      console.error("Gemini API error:", data);
      return res.status(502).json({ error: "The AI service could not complete your request." });
    }

    const reply = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!reply) {
      console.error("Gemini returned no usable answer:", data);
      return res.status(502).json({ error: "I didn't receive an answer. Please try again." });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Windham PTA chat error:", error);
    if (error.name === "TimeoutError") {
      return res.status(504).json({ error: "The request took too long. Please try again." });
    }
    if (error.code === "ENOENT") {
      return res.status(500).json({ error: "The PTA knowledge file could not be found." });
    }
    return res.status(500).json({ error: "The chat service is temporarily unavailable." });
  }
}
