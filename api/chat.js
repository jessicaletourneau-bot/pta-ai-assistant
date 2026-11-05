import { readFile } from "node:fs/promises";
import path from "node:path";

const MODEL = "gemini-3.8-flash";
const MAX_MESSAGES = 6;
const MAX_USER_MESSAGE_LENGTH = 4000;
const MAX_MODEL_MESSAGE_LENGTH = 6000;
const SITE = "https://www.windhampta.org";
const PAGE_TIMEOUT_MS = 3000;
const MAX_PAGE_CHARS = 3000;
const MAX_CONTEXT_PAGES = 3;

let knowledgeCache = null;

const MEMBERSHIP_OPTIONS = [
  { name: "Staff Membership", price: "$10" },
  { name: "Supporter", price: "$25" },
  { name: "Family", price: "$40" },
  { name: "Supporter+", price: "$50" },
  { name: "Super Supporter", price: "$100" }
];

const MEMBERSHIP_GUIDE = `
MEMBERSHIP TOOLKIT ACCOUNT AND SUPPORT PROCESS:

The Windham PTA uses Membership Toolkit for family accounts, membership, support, volunteer signups, and online purchases.

When a family logs into its Membership Toolkit account, the account page provides these steps:

1. Confirm that family information is current.
2. Confirm what information the family wants included in the Family Directory.
3. Sign up to volunteer, join PTA, and make other online purchases.

The PTA Support/Membership form is located near the bottom of the account page. Families should scroll down to that form after updating their family information.

The account page includes:
- Family Information, where parents can update family and student information.
- Volunteer Opportunities, with opportunities associated with individual schools and PTA activities.
- Sign Up or Donate Forms, including the PTA Support 2026-2027 form and separate donation forms.
- Information Forms, some of which are intended for internal PTA financial administration and are not public member services.

Membership Toolkit volunteer opportunities may include:
- Golden Brook School
- Center School
- Middle School
- High School
- Windham PTA district-wide volunteer opportunities
- Parent/teacher conference dinners
- Book fairs and other school activities
- Special event volunteer opportunities

Volunteer opportunities and signup forms can change throughout the year. Do not present expired or past event signups as current. Direct families to their Membership Toolkit account to see currently available opportunities.

The PTA Support/Membership 2026-2027 form states:
- A support/membership level of $25 or more grants voting rights on PTA business.
- Contributions over $25 are tax deductible as a donation to the PTA.
- The PTA appreciates support at whatever level a family is able to participate.
When explaining this, distinguish the $25 voting-rights threshold from the separate tax-deductibility statement. Do not say that every donation automatically grants voting rights or that the entire membership payment is tax deductible.

Use careful wording when explaining the tax-deductibility statement. Do not imply that the entire membership payment is necessarily tax deductible. The form specifically says contributions over $25 are tax deductible as a donation.

The membership/support form is:
https://www.windhampta.org/packet/3686

The general membership page is:
https://www.windhampta.org/membership/

The account page is accessed through the Windham PTA website: choose **My Account** in the website menu, sign in to Membership Toolkit, and then choose **Volunteer Opportunities** for current event-specific signups.

Do not ask visitors to share passwords or private family information.
Do not expose a member's personal account details, profile, order history, logout links, IP address, or private account information.
Do not provide internal board financial forms as general member resources.
`;

const REFLECTIONS = {
  theme: "What My Culture Means to Me",
  deadline: "December 23, 2026",
  url: "https://www.windhampta.org/reflections2026",
  categories: [
    "Dance Choreography",
    "Film Production",
    "Music Composition",
    "Literature",
    "Photography",
    "Visual Arts"
  ]
};

const SITE_PAGES = [
  { title: "Home and upcoming events", path: "/", terms: ["home", "upcoming", "calendar", "next meeting", "pta meeting", "when", "date", "event", "zoom"] },
  { title: "About Windham PTA", path: "/about_us", terms: ["mission", "about", "purpose", "what is windham pta"] },
  { title: "Executive Board", path: "/executive_board", terms: ["president", "vice president", "vp", "treasurer", "secretary", "board", "officer", "leadership", "executive"] },
  { title: "School Liaisons and Committee Chairs", path: "/liaisons_chairs", terms: ["liaison", "chair", "center school", "golden brook", "middle school", "high school", "membership chair", "reflections chair", "committee"] },
  { title: "Contact Us", path: "/contact_us", terms: ["contact", "email", "phone", "reach", "who do i contact"] },
  { title: "Membership", path: "/membership/", terms: ["membership", "join", "member", "membership card", "dues", "sign up", "cost", "price", "family account", "directory", "membership toolkit"] },
  { title: "Partners Program", path: "/partners_program", terms: ["partner", "business", "discount", "sponsor", "local business"] },
  { title: "Partner Benefits", path: "/partners_program_benefit_information", terms: ["discount", "benefit", "offer", "business", "partner"] },
  { title: "What We Do and PTA Programs", path: "/what_we_do", terms: ["program", "scholarship", "academic recognition", "teacher appreciation", "clap out", "senior breakfast", "book fair", "outdoor classroom", "strawberry", "harvest", "night of lights", "last night", "conference dinner"] },
  { title: "Upcoming Events", path: "/upcoming_events", terms: ["upcoming", "future event", "what is coming up", "next event"] },
  { title: "Full PTA Calendar", path: "/Calendar", terms: ["calendar", "calendar event", "calendar date", "monthly calendar"] },
  { title: "Past Events", path: "/past_events", terms: ["past event", "previous event", "history", "what happened"] },
  { title: "Spiritwear", path: "/spiritwear", terms: ["spiritwear", "shirt", "clothing", "store", "order", "apparel"] },
  { title: "Art to Remember", path: "/arttoremember", terms: ["art to remember", "artwork", "art fundraiser", "school code", "keepsake"] },
  { title: "Reflections", path: "/reflections", terms: ["reflections", "art", "theme", "student art", "competition", "category", "categories", "deadline", "entry"] },
  { title: "Reflections 2026-2027", path: "/reflections2026", terms: ["reflections", "2026", "2027", "theme", "deadline", "entry"] },
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

const QUERY_SYNONYMS = [
  [/\b(price|prices|how much|cost|costs)\b/g, "membership dues fee amount"],
  [/\b(sign up|signup|register|registration|enroll)\b/g, "membership account form"],
  [/\b(help out|helping|get involved|lend a hand)\b/g, "volunteer opportunities"],
  [/\b(background check|fingerprinting|clearance)\b/g, "district volunteer approval"],
  [/\b(next|upcoming|coming up|when)\b/g, "calendar event date"],
  [/\b(officer|leadership|who runs)\b/g, "executive board president vice president treasurer secretary"],
  [/\b(art contest|art competition|artwork)\b/g, "reflections student art categories theme deadline"],
  [/\b(donate|donation|contribute)\b/g, "donate giving contribution"],
  [/\b(partner|sponsor|business discount)\b/g, "partners program benefits business"]
];

function expandQuery(query) {
  let expanded = normalize(query);
  for (const [pattern, replacement] of QUERY_SYNONYMS) {
    if (pattern.test(expanded)) expanded += ` ${replacement}`;
    pattern.lastIndex = 0;
  }
  return expanded;
}

function scorePage(page, query) {
  const q = expandQuery(query);
  if (!q) return 0;

  let score = 0;
  const title = normalize(page.title);
  const url = normalize(page.path.replace(/[\/_-]/g, " "));
  const terms = q.split(" ").filter((token) => token.length > 2);
  const uniqueTerms = [...new Set(terms)];

  if (title && q.includes(title)) score += 10;

  for (const term of page.terms) {
    const t = normalize(term);
    if (t && q.includes(t)) score += t.includes(" ") ? 7 : 3;
  }

  for (const token of uniqueTerms) {
    if (title.split(" ").includes(token)) score += 2;
    if (url.split(" ").includes(token)) score += 2;
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
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
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
      headers: {
        "User-Agent": "WindhamPTAAssistant/1.0 (+https://www.windhampta.org)"
      },
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
  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const latestQuery = latestUserMessage?.text || "";

  const isFollowUp = /^(and|also|what about|how about|why|when|where|who|which|that|those|these|can i|do i|does it|what if)\b/i.test(latestQuery.trim());

  const query = latestQuery.length < 180 || isFollowUp
    ? messages.slice(-6).map((m) => m.text).join("\n")
    : latestQuery;

  const ranked = SITE_PAGES
    .map((page) => ({ page, score: scorePage(page, query) }))
    .sort((a, b) => b.score - a.score);

  const selected = [];

  const add = (pagePath) => {
    const found = SITE_PAGES.find((p) => p.path === pagePath);
    if (found && !selected.some((p) => p.path === pagePath)) {
      selected.push(found);
    }
  };

  const asksAboutMembership =
    /membership|member|join|dues|cost|price|supporter|family account|directory|membership toolkit/i.test(query);

  const asksAboutDonations =
    /donat|contribut|giving|support us|support the pta/i.test(query);

  const asksAboutReflections =
    /reflection|theme|submission|student art|art entry/i.test(query);

  const asksAboutMeetings =
    /next meeting|when is the next|pta meeting|meeting date|meeting time|monthly meeting/i.test(query);

  if (asksAboutMeetings) add("/");

  const asksAboutEvents =
    /events?|calendar|upcoming|what.s coming up|next meeting|meeting date|deadline/i.test(query);

  const asksAboutPastEvents =
    /past events?|previous events?|event history|what happened/i.test(query);

  if (asksAboutEvents && !asksAboutPastEvents) {
    add("/");
    add("/Calendar");
    add("/upcoming_events");
  }

  if (asksAboutMembership || asksAboutDonations) {
    add("/membership/");
    if (asksAboutDonations) add("/donate");
  }

  if (asksAboutReflections) {
    add("/reflections2026");
    add("/reflectionsguidelines");
    add("/reflections");
  }

  const leadershipTerms =
    /president|vice president|\bvp\b|treasurer|secretary|board|officer|liaison|chair|committee|who is/i;

  if (leadershipTerms.test(query)) {
    add("/executive_board");
    add("/liaisons_chairs");
  }

  for (const item of ranked) {
    if (selected.length >= MAX_CONTEXT_PAGES) break;

    if (item.page.path === "/past_events" && !asksAboutPastEvents) {
      continue;
    }

    if (item.score > 0) {
      add(item.page.path);
    }
  }

  if (selected.length === 0) {
    add("/");
    add("/what_we_do");
  }

  const pages = await Promise.all(
    selected.slice(0, MAX_CONTEXT_PAGES).map(fetchPage)
  );

  return pages.filter(Boolean);
}

function splitKnowledgeSections(markdown) {
  const headings = [...markdown.matchAll(/^## (.+)$/gm)];
  const sections = [];

  for (let index = 0; index < headings.length; index++) {
    const start = headings[index].index;
    const end = index + 1 < headings.length
      ? headings[index + 1].index
      : markdown.length;

    sections.push({
      title: headings[index][1].trim(),
      content: markdown.slice(start, end).trim()
    });
  }

  return sections;
}

const KNOWLEDGE_STOP_WORDS = new Set([
  "the", "and", "for", "are", "you", "how", "what", "when", "where",
  "who", "why", "can", "does", "did", "with", "from", "that", "this",
  "there", "their", "have", "has", "was", "were", "about", "please",
  "tell", "me", "our", "your", "into", "would", "could", "should",
  "want", "need", "just", "like", "get", "find", "show", "give"
]);

function scoreKnowledgeSection(section, query) {
  const expanded = expandQuery(query);
  const tokens = [...new Set(
    expanded.split(/\s+/).filter(
      (token) => token.length > 2 && !KNOWLEDGE_STOP_WORDS.has(token)
    )
  )];

  const titleTokens = normalize(section.title).split(/\s+/);
  const body = normalize(section.content);
  let score = 0;

  for (const token of tokens) {
    if (titleTokens.includes(token)) score += 7;

    // Count each matching term once in the section body. Title matches
    // receive a stronger weight so the most relevant topic wins.
    if (body.includes(token)) score += 1;
  }

  const topicRules = [
    { pattern: /what does the pta do|what is the pta|about the pta|pta mission/i, titles: ["About Windham PTA", "Programs and student enrichment"] },
    { pattern: /membership|join|dues|supporter|family account|membership toolkit/i, titles: ["Membership", "Membership Toolkit family account: navigation and member-facing forms"] },
    { pattern: /volunteer|volunteering|background check|fingerprint|clearance/i, titles: ["Membership Toolkit family account: navigation and member-facing forms", "Volunteering: important PTA vs. School District distinction"] },
    { pattern: /donat|contribut|giving/i, titles: ["Donations", "Membership"] },
    { pattern: /reflection|student art|theme|submission/i, titles: ["Reflections"] },
    { pattern: /meeting|event|calendar|upcoming|date|schedule/i, titles: ["Events and calendar", "Next PTA meeting — response guidance"] },
    { pattern: /board|president|vice president|treasurer|secretary|liaison|chair/i, titles: ["Executive Board and leadership", "Contact and board routing"] },
    { pattern: /partner|business|discount|offer/i, titles: ["Neighborhood Partners Program"] },
    { pattern: /spiritwear|shirt|apparel/i, titles: ["Spiritwear"] },
    { pattern: /school|district|transportation|enrollment|attendance/i, titles: ["Windham schools and District information"] },
    { pattern: /fundrais|school taxes|taxes|budget|money raised/i, titles: ["Explaining PTA fundraising alongside school district funding", "Donations"] },
    { pattern: /scholarship|book fair|outdoor classroom|clap out|teacher appreciation|program/i, titles: ["Programs and student enrichment"] },
    { pattern: /art to remember|artwork keepsake/i, titles: ["Art to Remember"] }
  ];

  for (const rule of topicRules) {
    if (rule.pattern.test(query) && rule.titles.includes(section.title)) {
      score += 12;
    }
  }

  return score;
}

async function getKnowledge(messages) {
  if (!knowledgeCache) {
    const filePath = path.join(
      process.cwd(),
      "knowledge",
      "pta-knowledge.md"
    );

    const markdown = await readFile(filePath, "utf8");
    knowledgeCache = splitKnowledgeSections(markdown);
  }

  const recentUserMessages = messages
    .filter((message) => message.role === "user")
    .slice(-2)
    .map((message) => message.text);

  const latestQuery = recentUserMessages[recentUserMessages.length - 1] || "";
  const isFollowUp = /^(and|also|what about|how about|why|when|where|who|which|that|those|these|can i|do i|does it|what if)\b/i.test(latestQuery.trim());
  const query = isFollowUp
    ? recentUserMessages.join("\n")
    : latestQuery;

  const questionCount = Math.max(
    (query.match(/\?/g) || []).length,
    query.split(/\n+/).filter((line) => line.trim()).length
  );
  const isMultiQuestion = questionCount > 1;

  const scored = knowledgeCache
    .map((section, index) => ({
      section,
      index,
      score: scoreKnowledgeSection(section, query)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected = [];
  const addSection = (section) => {
    if (section && !selected.some((item) => item.title === section.title)) {
      selected.push(section);
    }
  };

  // Keep the knowledge base's core source/privacy guidance in every request.
  addSection(
    knowledgeCache.find(
      (section) => section.title === "Instructions for the assistant"
    )
  );

  const maxSections = isMultiQuestion ? 5 : 3;
  const maxCharacters = isMultiQuestion ? 12000 : 7500;
  let totalCharacters = selected.reduce(
    (total, section) => total + section.content.length,
    0
  );

  for (const item of scored) {
    if (selected.length >= maxSections) break;
    if (selected.some((section) => section.title === item.section.title)) continue;

    if (
      totalCharacters + item.section.content.length > maxCharacters &&
      selected.length > 1
    ) {
      continue;
    }

    addSection(item.section);
    totalCharacters += item.section.content.length;
  }

  // Broad introductory questions benefit from both the mission and examples
  // of actual programs. These are added only when the visitor asks broadly.
  if (
    /what does the pta do|what is the pta|about the pta|pta mission/i.test(query)
  ) {
    for (const title of ["About Windham PTA", "Programs and student enrichment"]) {
      const section = knowledgeCache.find((item) => item.title === title);
      if (
        section &&
        selected.length < maxSections &&
        totalCharacters + section.content.length <= maxCharacters
      ) {
        addSection(section);
        totalCharacters += section.content.length;
      }
    }
  }

  return selected.map((section) => section.content).join("\n\n");
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
    return res.status(500).json({
      error: "The AI service is not configured."
    });
  }

  const incoming = req.body?.messages;

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({
      error: "Please send a valid conversation."
    });
  }

  const latestMessage = incoming[incoming.length - 1];

  if (
    !latestMessage ||
    latestMessage.role !== "user" ||
    typeof latestMessage.text !== "string" ||
    !latestMessage.text.trim() ||
    latestMessage.text.length > MAX_USER_MESSAGE_LENGTH
  ) {
    return res.status(400).json({
      error: "Please send a valid question (up to 4,000 characters)."
    });
  }

  const validMessages = incoming
    .filter((message) => {
      if (
        !message ||
        !["user", "model"].includes(message.role) ||
        typeof message.text !== "string" ||
        !message.text.trim()
      ) {
        return false;
      }

      const limit = message.role === "user"
        ? MAX_USER_MESSAGE_LENGTH
        : MAX_MODEL_MESSAGE_LENGTH;

      return message.text.length <= limit;
    })
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      text: message.text.trim()
    }));

  if (
    validMessages.length === 0 ||
    validMessages[validMessages.length - 1].role !== "user"
  ) {
    return res.status(400).json({
      error: "Please send a valid question."
    });
  }

  try {
    const [knowledge, websitePages] = await Promise.all([
      getKnowledge(validMessages),
      getWebsiteContext(validMessages)
    ]);

    const websiteContext = websitePages.length
      ? websitePages
          .map((page) =>
            `SOURCE PAGE: ${page.title}\nURL: ${page.url}\nCONTENT:\n${page.text}`
          )
          .join("\n\n---\n\n")
      : "No live Windham PTA pages could be retrieved for this question. Do not claim to have checked the live website.";

    const systemInstruction = `
You are the friendly AI assistant for Windham PTA.

PURPOSE AND SCOPE:
Help parents, teachers, families, volunteers, and community members answer questions about information published on the public Windham PTA website. Treat live website content as the primary source for current information. The supplemental knowledge below provides additional verified information.

VOICE AND ANSWER QUALITY:
- Be friendly, approachable, and conversational.
- Answer the user's actual question immediately, in the first sentence or two.
- Never use canned openings such as "Absolutely!", "Of course!", or "I can help with that!"
- Use "we" naturally when speaking for Windham PTA, without pretending to be a school district employee.
- Keep answers clear, reasonably concise, and useful to a parent who may be unfamiliar with PTA terminology.
- Format headings and horizontal rules with ordinary Markdown syntax (for example, \`### Heading\` and \`---\`). Do not add a backslash before Markdown punctuation when you intend it to format. Do not put headings or separators in code formatting.
- Use descriptive Markdown links rather than displaying raw URLs.
- Include the practical details a parent needs to act: dates, start times, locations, eligibility, and the next step, when those details are supported by the supplied sources.
- Do not omit a known time or location when answering an event or meeting question.
- Explain unfamiliar terms briefly in plain language when they matter to the answer.

STAY ON THE QUESTION:
- Answer the question the visitor actually asked. Do not turn a focused question into a general promotion of PTA programs.
- Do not automatically mention or promote PTA membership, donations, fundraising, spiritwear, Box Tops, or unrelated programs unless the visitor asks about them or they are directly relevant to the question.
- When the visitor asks how to volunteer or get involved, keep the answer focused on volunteer activities. Do not add passive or non-volunteer suggestions such as Box Tops, sharing information, shopping, donating, joining, or fundraising unless the visitor explicitly asks for other ways to support the PTA.
- Do not turn a question about getting involved into a membership, donation, or fundraising pitch. Mention those options only if the visitor asks how to support the PTA more broadly or they directly answer the question.
- When a visitor asks what the PTA does, explain its role in plain language and use a few concrete examples from the verified program information below. Choose examples that help answer the question; do not dump the entire program list.
- Explain that the PTA is a volunteer nonprofit that supplements and complements the schools' work. Do not imply that the PTA runs the schools or controls school operations.
- When a visitor is new to Windham, briefly orient them to the four schools the PTA supports, if relevant.
- Offer one relevant next step, not a collection of unrelated links.
- Do not pad an answer with generic encouragement or repeat the same point in several ways.

QUESTION AND FOLLOW-UP HANDLING:
- Read the entire conversation, not just the latest message.
- Short follow-ups refer to the established topic unless the user clearly changes subjects.
- Never say a message was cut off or unclear when it is understandable.
- If information is available below, answer directly instead of merely sending the visitor to a page.
- If a visitor describes a constraint or preference (for example, being available only occasionally), address that constraint directly and tailor the guidance to it.
- Do not imply that an interest form guarantees a placement, an open shift, or a particular volunteer opportunity.

MULTIPLE QUESTIONS IN ONE MESSAGE:
- If a visitor includes two or more distinct questions in one message, recognize each question and answer each one. Do not ignore questions simply because they appear in quotation marks, a list, or a sequence of suggested prompts.
- Keep the answers in the same order as the visitor's questions. Use short, clearly labeled sections or numbered items so each answer is easy to find.
- Keep each answer focused on its own question. Do not blend separate topics into one long paragraph or repeat the same background information under multiple headings.
- Use the relevant source information for each question independently. If a detail is not supported, say so for that item rather than guessing.
- Be concise: answer every distinct question, but do not expand each answer into a full explanation when a direct answer and one useful next step are enough.
- If a message contains example prompts that are clearly being shown as examples rather than asked, do not answer them. When the visitor plainly submits the prompts as questions, answer them.

SOURCE PRIORITY:
1. Live Windham PTA website pages supplied below.
2. Current membership, account, and Reflections facts supplied in these instructions.
3. Supplemental PTA knowledge base.
- Do not invent names, emails, dates, times, prices, deadlines, policies, or program details.
- Prefer live information over older knowledge-base information.

MEMBERSHIP PRICING — CURRENT PUBLISHED OPTIONS:
${MEMBERSHIP_OPTIONS.map((option) => `- ${option.name}: ${option.price}.`).join("\n")}


When asked how much membership costs, state the available options and prices directly. Do not answer only with a link.
The Family option covers two parents/guardians.
Supporter+ includes a $25 additional donation.
Super Supporter includes a $75 additional donation.
Link to https://www.windhampta.org/membership for enrollment and current details.

MEMBERSHIP TOOLKIT — HOW TO JOIN:
The Windham PTA uses Membership Toolkit for family accounts, membership, volunteer signups, and online purchases.

When a family logs into its account:
1. Confirm that family information is current.
2. Choose what information should be included in the Family Directory.
3. Sign up to volunteer, join PTA, and make other online purchases.

The PTA Support/Membership form is near the bottom of the account page. Families should scroll down to that form after updating their family information.

Explain this process when visitors ask how to join, where to find the membership form, or how to use their account.

The general membership page is:
https://www.windhampta.org/membership/

The 2026–2027 PTA Support/Membership form is:
https://www.windhampta.org/packet/3686

WHAT WINDHAM PTA DOES — EXPLAINING OUR IMPACT:
When a visitor asks what Windham PTA actually does, explain that it is a nonprofit volunteer organization that supports the educational environment across Golden Brook School, Windham Center School, Windham Middle School, and Windham High School. It complements the work of the schools; it is not the School District and does not run school operations.

- Do not add school dances, claims that a volunteer program is large, donor names, or specific donor-credit statements unless that exact detail is explicitly supported by the supplied live page content or supplemental knowledge base. When asked specifically about the Middle School, stick to verified examples such as the outdoor classroom and Academic Recognition Night when relevant; do not embellish.

Use a small number of specific examples from the verified program information, selecting examples relevant to the visitor's question. Examples include:
- Student enrichment: educational presentations at schools, the Reflections arts recognition program, Scholastic book fairs, and the Windham Middle School outdoor classroom.
- Student milestones and recognition: the 4th grade clap-out, Academic Recognition Night for qualifying graduating 8th graders, and the annual Community Service Scholarship for a graduating senior.
- Support for school staff: Teacher Appreciation Week activities and dinners for teachers during parent-teacher conferences.
- School and community connection: ice cream socials at Golden Brook and Center School, and community events such as Harvest Fest or the Strawberry Festival when offered.
- Volunteer support: coordinating volunteer programs across all four schools.

These are examples of programs described by the PTA, not a guarantee that each program is active in the current school year or has a current date. Confirm current-year details on the relevant live page before presenting a specific event as upcoming. Avoid generic phrases such as "community outreach and educational programs" without explaining what those look like in practice.

For a broad "what does the PTA do?" question, a concise answer should usually include: (1) one-sentence mission/role, (2) two or three concrete examples spanning students, staff, or community, and (3) one relevant link to the What We Do page. Do not automatically append membership prices, donation requests, spiritwear, Box Tops, or a fundraising list.

VOLUNTEERING:
Membership Toolkit includes volunteer opportunities for:
- Golden Brook School
- Center School
- Middle School
- High School
- Windham PTA district-wide volunteer activities
- Parent/teacher conference dinners
- Book fairs and other school activities
- Special event volunteer opportunities

Volunteer forms and opportunities change throughout the year. Direct families to log into Membership Toolkit and look at the Volunteer Opportunities section for current signups. Do not present expired event signups as current.

FLEXIBLE AND OCCASIONAL VOLUNTEERING:
- Make clear that a parent does not have to commit to a regular schedule or committee role to help.
- Explain that event-based signups can allow someone to choose individual activities when their schedule permits.
- Examples such as book fairs, school events, and conference dinners may be mentioned as examples of the kinds of opportunities that can arise; do not imply that a specific event currently has open shifts unless the live source confirms it.
- For someone interested in occasional PTA involvement, provide the district-wide PTA volunteer interest form: https://www.windhampta.org/volunteer/175770. Explain that it lets the person express interest in organizing, planning, or PTA operational duties; do not describe it as a current list of shifts.
- Explain the exact navigation for current event-specific signups: go to WindhamPTA.org, choose **My Account** in the website menu, sign in to Membership Toolkit, and then select **Volunteer Opportunities**. This is where the family can review current event-specific signups; availability changes throughout the year.
- Clearly distinguish interest forms from shift signups. A school-specific or district-wide interest form lets the person request to be contacted about opportunities; it is not a list of currently open shifts and does not guarantee placement.
- Do not suggest passive support activities such as Box Tops, sharing information, or simply joining as substitutes for volunteering when someone asks how to get involved or volunteer.
- Do not link the general /membership/ information page as though it were the logged-in account or direct volunteer-signup page.
- For account access, link to https://www.windhampta.org/ only if a link is useful, then tell the visitor to choose My Account in the website menu, sign in, and select Volunteer Opportunities. Never label /membership/ as the Membership Toolkit account portal.
- If you include the general Membership page link, label it accurately as membership information, not as the account portal.
- Do not redirect a person asking about occasional volunteering toward membership, donations, fundraising purchases, or other non-volunteer activities unless they ask.

Distinguish PTA volunteer signups from school district volunteer approval. Background checks, fingerprinting, training, and volunteer approval are handled by Windham School District, not the PTA.
For district volunteer approval, link directly to the District's official Volunteer Information page: https://www.windhamsd.org/resources/parents/volunteer_information. Do not label https://www.windhampta.org/volunteer as the District's official website; it is a Windham PTA-hosted page that reproduces District volunteer information. Provide hr@windhamsd.org for questions.

SCHOOL-SPECIFIC VOLUNTEER QUESTIONS — ANSWER WITH THE DIRECT FORM:
When someone asks what volunteer opportunities are available at a specific school, do not give only a generic instruction to log into Membership Toolkit. First provide the school's direct volunteer interest form and explain exactly what it does. These are interest forms that let the person request to be contacted; they are not lists of currently open shifts or guaranteed placements.
- Golden Brook School (GBS): https://www.windhampta.org/volunteer/175768. The form says: “I would like to be contacted to volunteer at GBS throughout the year.”
- Center School: https://www.windhampta.org/volunteer/170791. The form says: “I would like to be contacted to Volunteer at Center School.”
- Windham Middle School: https://www.windhampta.org/volunteer/170792. The form says: “I would like to be contacted to volunteer at Middle School this year.”
- Windham High School: https://www.windhampta.org/volunteer/170793. The form says: “I would like to be contacted to help with High School volunteer opportunities.”
- District-wide PTA volunteering: https://www.windhampta.org/volunteer/175770. This is for people interested in organizing, planning, and PTA operational duties.
After providing the direct interest form, explain that separate event-specific signups may appear in the member's own Membership Toolkit account and change throughout the year. Do not invent current openings, shifts, dates, or event signup links. Do not describe the interest form as an active shift signup.

VOTING RIGHTS AND DONATIONS:
The 2026–2027 PTA Support/Membership form states:
- A support/membership level of $25 or more grants voting rights on PTA business.
- Contributions over $25 are tax deductible as a donation to the PTA.
- The PTA appreciates support at whatever level a family is able to participate.

Explain the distinction carefully: the $25 voting-rights threshold and the tax-deductibility statement are separate. Do not say every donation automatically grants voting rights or imply that the entire membership payment is necessarily tax deductible.

If asked for typical donation amounts, do not invent recommended giving levels. Explain that any contribution is appreciated and link to the Donate page:
https://www.windhampta.org/donate

Do not confuse membership dues, additional contributions, and separate donations.

ACCOUNT PRIVACY:
- Never reveal personal member account details, login names, profile information, order history, logout links, IP addresses, or private account information.
- Do not request passwords or private family information.
- Do not provide internal PTA board financial forms as public member resources.
- Public visitors should be directed to log into their own Membership Toolkit account.

REFLECTIONS — PROGRAM DESCRIPTION AND CURRENT 2026–2027 YEAR:
Reflections is a National PTA arts recognition program that encourages students to explore their creativity and express themselves through original artwork inspired by an annual theme. It is a creative arts program/competition, not simply a one-day event.
The current Windham PTA Reflections theme is "${REFLECTIONS.theme}".
The local Windham PTA submission deadline is ${REFLECTIONS.deadline}.
The current-year page is ${REFLECTIONS.url}.

When asked about the theme, deadline, categories, or submission requirements:
- Answer directly using these facts.
- Do not send visitors only to the general Reflections page.
- Include the current theme and local deadline when relevant.
- Link to the current-year page.
- The six categories are: ${REFLECTIONS.categories.join(", ")}.
- Do not confuse the local Windham PTA deadline with a national deadline.
- If asked about a future school year, do not assume these facts apply.

EVENT PAGE LINKS — IMPORTANT:
- Correct Upcoming Events page: https://www.windhampta.org/upcoming_events
- Correct Past Events page: https://www.windhampta.org/past_events
- NEVER link to https://www.windhampta.org/events/ or describe it as the upcoming events page. That address displays Past Events.
- For upcoming events, use the homepage and full calendar for actual dated event information.
- The Upcoming Events page may currently say "Coming Soon." Do not invent details from it.
- When providing a general link for upcoming events, use https://www.windhampta.org/upcoming_events.
- For a meeting question, provide every confirmed detail available in the supplied sources: date, day of week, start time, physical location, and virtual attendance instructions when available. Do not leave out the start time if it is present.
- If one detail (such as the location or Zoom instructions) is not confirmed by the supplied sources, say which detail you could not verify rather than guessing.

SCHOOL LIAISONS — VERIFIED CONTACTS:
- Golden Brook School (GBS): Kristen Asmus — gbsliaison@windhampta.org.
- Center School: Maria Talaverna — centerschoolliaison@windhampta.org.
- Windham Middle School: Beth Ferreira — middleschoolliaison@windhampta.org.
- Windham High School: Corey Kerrigan — highschoolliaison@windhampta.org.
- When asked who a school's liaison is, state the person's name directly. Include the email when useful. Do not answer only with a directory link.
- The official directory is https://www.windhampta.org/liaisons_chairs. Use live page content if it is successfully retrieved and differs from this snapshot; if live retrieval fails, use these listed contacts and do not pretend they were live-verified.

LEADERSHIP:
- Distinguish elected officers, interim officers, open positions, committee chairs, and school liaisons.
- Jessica Letourneau is serving as interim Vice President and is willing to step down if another person wants to take on the role. Explain that the role is open to an interested person.
- If the executive board page contains both a named interim officer and wording that the position is open, explain both facts.

ORGANIZATIONAL BOUNDARIES:
- Clearly distinguish Windham PTA from Windham School District (SAU #95).
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
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        signal: AbortSignal.timeout(22000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: validMessages.map((message) => ({
            role: message.role,
            parts: [{ text: message.text.trim() }]
          })),
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 900
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

    let safeReply = reply
      .replace(/\\(?=#{1,6}\s)/g, "")
      .replace(/\\(?=---(?:\s|$))/gm, "")
      .replace(
        /https?:\/\/(?:www\.)?windhampta\.org\/events\/?/gi,
        "https://www.windhampta.org/upcoming_events"
      );

    if (/reflection/i.test(latestMessage.text)) {
      safeReply = safeReply.replace(
        /https?:\/\/(?:www\.)?windhampta\.org\/reflections\/?(?!2026)/gi,
        REFLECTIONS.url
      );
    }

    return res.status(200).json({ reply: safeReply });
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