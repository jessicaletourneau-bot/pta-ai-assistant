import { readFile } from "node:fs/promises";
import path from "node:path";

const MODEL = "gemini-3.5-flash-lite";
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

To find current event-specific volunteer signups, select **My Account** in the Windham PTA website menu, then select **Sign In** to access Membership Toolkit, and once signed in select **Volunteer Opportunities**. The first navigation step is **My Account**.

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
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim()
  );
}

async function fetchPage(page) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(`${SITE}${page.path}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "WindhamPTAAssistant/1.0"
      }
    });

    if (!response.ok) return null;

    const html = await response.text();
    const text = htmlToText(html).slice(0, MAX_PAGE_CHARS);

    return text ? `PAGE: ${page.title}\nURL: ${SITE}${page.path}\n${text}` : null;
  } catch (error) {
    console.warn(`Could not retrieve ${page.path}:`, error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isContextualFollowUp(message) {
  const text = normalize(message);
  return /^(and|also|what about|how about|what was|who was|where was|when was)\b/.test(text) ||
    /\b(it|that|they|them|their|her|him|she|he|there|those|these|the same|the other)\b/.test(text);
}

async function getWebsiteContext(messages) {
  const latestMessage = messages[messages.length - 1]?.text || "";
  const previousUser = messages.filter((message) => message.role === "user").slice(-2, -1)[0];
  const combinedQuery = previousUser && isContextualFollowUp(latestMessage)
    ? `${previousUser.text} ${latestMessage}`
    : latestMessage;

  const rankedPages = SITE_PAGES
    .map((page) => ({
      page,
      score: scorePage(page, combinedQuery)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_PAGES);

  const pages = await Promise.all(
    rankedPages.map((item) => fetchPage(item.page))
  );

  return pages.filter(Boolean).join("\n\n");
}

const KNOWLEDGE_STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "what", "when",
  "where", "how", "can", "could", "would", "should", "does", "do", "did",
  "are", "is", "was", "were", "have", "has", "had", "you", "your", "our",
  "their", "they", "them", "she", "her", "his", "its", "about", "into",
  "onto", "then", "than", "there", "here", "please", "help", "want", "need",
  "like", "just", "also", "more", "some", "any", "all", "not", "but",
  "who", "why", "which", "while", "during", "through", "after", "before",
  "get", "got", "make", "made", "much", "many", "very", "one", "two",
  "three", "new", "school", "schools"
]);

function splitKnowledgeSections(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const sections = [];
  let currentTitle = "General";
  let currentLines = [];

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (currentLines.length) {
        sections.push({
          title: currentTitle,
          content: currentLines.join("\n").trim()
        });
      }
      currentTitle = line.replace(/^##\s+/, "").trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length) {
    sections.push({
      title: currentTitle,
      content: currentLines.join("\n").trim()
    });
  }

  return sections.filter((section) => section.content);
}

function scoreKnowledgeSection(section, query) {
  const expanded = expandQuery(query);
  const tokens = [...new Set(
    expanded
      .split(/\s+/)
      .filter((token) => token.length > 2 && !KNOWLEDGE_STOP_WORDS.has(token))
  )];

  const title = normalize(section.title);
  const body = normalize(section.content);
  let score = 0;

  for (const token of tokens) {
    if (title.split(" ").includes(token)) score += 7;
    if (body.includes(token)) score += 1;
  }

  const q = normalize(query);

  if (/volunteer|volunteering|volunteer opportunities|sign up to help/.test(q) &&
      /volunteer/i.test(section.title)) score += 18;

  if (/membership|member|dues|join|account|toolkit/.test(q) &&
      /membership|account/i.test(section.title)) score += 14;

  if (/reflections|theme|art category|submission deadline/.test(q) &&
      /reflections/i.test(section.title)) score += 18;

  if (/board|president|treasurer|secretary|liaison|committee chair/.test(q) &&
      /board|liaison|leadership|contact/i.test(section.title)) score += 14;

  return score;
}

async function getKnowledge(messages) {
  if (!knowledgeCache) {
    const filePath = path.join(process.cwd(), "knowledge", "pta-knowledge.md");
    const markdown = await readFile(filePath, "utf8");
    knowledgeCache = splitKnowledgeSections(markdown);
  }

  const userMessages = messages.filter((message) => message.role === "user");
  const latest = userMessages[userMessages.length - 1]?.text || "";
  const previous = userMessages[userMessages.length - 2]?.text || "";
  const query = previous && isContextualFollowUp(latest)
    ? `${previous} ${latest}`
    : latest;

  const questionCount = Math.max(
    (latest.match(/\?/g) || []).length,
    latest.split(/\n+/).filter((line) => line.trim()).length
  );
  const isMultiQuestion = questionCount > 1;

  const alwaysInclude = knowledgeCache.filter((section) =>
    /instructions for the assistant/i.test(section.title)
  );

  const ranked = knowledgeCache
    .filter((section) => !alwaysInclude.includes(section))
    .map((section) => ({
      section,
      score: scoreKnowledgeSection(section, query)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const maxSections = isMultiQuestion ? 5 : 3;
  const maxChars = isMultiQuestion ? 12000 : 7500;
  const selected = [...alwaysInclude];
  let totalChars = selected.reduce(
    (sum, section) => sum + section.content.length,
    0
  );

  for (const item of ranked) {
    if (selected.length >= maxSections + alwaysInclude.length) break;
    if (totalChars + item.section.content.length > maxChars) continue;

    selected.push(item.section);
    totalChars += item.section.content.length;
  }

  if (
    selected.length === alwaysInclude.length &&
    knowledgeCache.length > alwaysInclude.length
  ) {
    const fallbackSections = knowledgeCache.filter((section) =>
      /about windham pta|quick answer patterns|contact and board routing/i.test(section.title)
    );

    for (const section of fallbackSections) {
      if (selected.includes(section)) continue;
      if (totalChars + section.content.length > maxChars) continue;
      selected.push(section);
      totalChars += section.content.length;
    }
  }

  return selected.map((section) => section.content).join("\n\n");
}

function validateMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .slice(-MAX_MESSAGES)
    .filter((message) =>
      message &&
      ["user", "assistant"].includes(message.role) &&
      typeof message.text === "string"
    )
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(
        0,
        message.role === "user"
          ? MAX_USER_MESSAGE_LENGTH
          : MAX_MODEL_MESSAGE_LENGTH
      )
    }))
    .filter((message) => message.text.length > 0);
}

const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_DELAYS_MS = [750, 1500];
const GEMINI_REQUEST_TIMEOUT_MS = 22000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

function isRetryableNetworkError(error) {
  return error?.name === "TimeoutError" ||
    error?.name === "AbortError" ||
    error instanceof TypeError;
}

async function fetchGeminiWithRetry(url, options) {
  let lastError;

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS)
      });

      if (!isRetryableGeminiStatus(response.status) ||
          attempt === GEMINI_MAX_ATTEMPTS) {
        return response;
      }

      console.warn(
        `Gemini returned HTTP ${response.status}; retrying attempt ${attempt + 1}/${GEMINI_MAX_ATTEMPTS}.`
      );
      await wait(GEMINI_RETRY_DELAYS_MS[attempt - 1]);
    } catch (error) {
      lastError = error;

      if (!isRetryableNetworkError(error) ||
          attempt === GEMINI_MAX_ATTEMPTS ||
          (error.name === "TimeoutError" && attempt >= 2)) {
        throw error;
      }

      console.warn(
        `Gemini request failed (${error.name || "network error"}); retrying attempt ${attempt + 1}/${GEMINI_MAX_ATTEMPTS}.`
      );
      await wait(GEMINI_RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  throw lastError || new Error("Gemini request failed after retries.");
}

function buildSystemPrompt(websiteContext, knowledge) {
  return `
You are the Windham PTA Assistant, the helpful AI assistant on the Windham PTA website.

IDENTITY AND TONE:
- Refer to yourself as the Windham PTA Assistant. Do not call yourself a chatbot.
- Be warm, clear, conversational, and concise.
- Speak as a helpful representative of Windham PTA. Use "we" naturally when appropriate.
- Do not sound overly promotional, scripted, or cheesy.
- Answer the visitor's actual question first. Do not overwhelm them with unrelated information.
- Use plain language. Explain PTA terminology when needed.
- Do not invent facts, dates, programs, volunteer openings, prices, contacts, or policies.
- If the available information does not answer a question, say so and direct the visitor to the appropriate PTA contact or official source.
- Do not repeat the same information unnecessarily.
- Prioritize the visitor's latest question. Use earlier conversation only when it clarifies the current question or the visitor explicitly refers to something discussed earlier.
- Do not bring earlier topics into an answer when they are not needed. For example, if the visitor asks who the GBS liaison is, answer with the GBS liaison's name and relevant contact or link; do not repeat the Vice President information from an earlier exchange.
- For a straightforward factual question, normally give a direct answer in one or two sentences. Add a link or contact detail when it is useful, but do not add unrelated roles, background, or extra offers.
- Avoid stock openings such as "As the Windham PTA Assistant, I can help" or "I can help you with those contacts." Start with the answer.
- When a visitor repeats a question, answer it directly and consistently. You may rephrase naturally, but do not expand the answer simply because it was asked again.
- Conversation history is context, not a checklist of facts to repeat. Do not summarize previous turns unless the visitor asks for a recap.
- Treat a new, self-contained question as a new topic. Do not carry details from the prior topic into its answer. Use earlier turns only when the latest message clearly refers back to them (for example, "what about her email?" or "and what does she do?").
- CONTACT ACCURACY IS CRITICAL: Never guess, construct, or borrow an email address. Only associate an email with a person or role when the supplied source explicitly pairs that exact person or role with that exact address. An email listed for a school liaison must never be used as the Vice President's email, or vice versa. If no verified email is provided for the requested person or role, give the appropriate official directory or Contact Us link instead.
- Use descriptive Markdown links instead of displaying raw URLs.
- Never claim to have completed an action that you cannot actually perform.

ANSWERING QUESTIONS:
- Prioritize verified live Windham PTA website content and the supplemental knowledge base below.
- Use the most specific relevant information available.
- If live content conflicts with older supplemental information, prefer current live content when it is clearly current and relevant.
- If neither source confirms a detail, do not guess.
- Do not describe an interest form as an active signup.
- Do not claim an opportunity is currently open unless the live source confirms it.
- Do not say that the PTA approves school volunteers; that is handled by Windham School District.
- If a visitor asks for a link, provide the most direct relevant link available.
- Avoid directing visitors to generic pages when a specific page or form is available.

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

Volunteer forms and opportunities change throughout the year. Direct families to log into Membership Toolkit and look at the Volunteer Opportunities section for current signups. Do not present expired or past event signups as current.

FLEXIBLE AND OCCASIONAL VOLUNTEERING:
- Make clear that a parent does not have to commit to a regular schedule or committee role to help.
- Explain that event-based signups can allow someone to choose individual activities when their schedule permits.
- Examples such as book fairs, school events, and conference dinners may be mentioned as examples of the kinds of opportunities that can arise; do not imply that a specific event currently has open shifts unless the live source confirms it.
- For someone interested in occasional PTA involvement, provide the district-wide PTA volunteer interest form: https://www.windhampta.org/volunteer/175770. Explain that it lets the person express interest in organizing, planning, or PTA operational duties; do not describe it as a current list of shifts.
- For general questions about finding current event-specific volunteer signups, explain the navigation in this exact order: **My Account** in the Windham PTA website menu → **Sign In** to access Membership Toolkit → **Volunteer Opportunities** once signed in. The first navigation step must be **My Account**. Do not tell the visitor to visit or open WindhamPTA.org as a preliminary step, and do not put Sign In before My Account.
- Explain this naturally in your own words and adapt the amount of detail to the visitor's question. Do not use a canned or fixed response, and do not replace or suppress the rest of your answer.
- Preserve and include any relevant school-specific or district-wide volunteer interest form links when they help answer the visitor's question. Clearly explain that these are interest forms, not lists of currently open shifts. For general signup questions, explain the account navigation as well; do not treat the navigation and relevant forms as mutually exclusive.
- If a visitor needs a link to reach the site, you may provide the homepage link separately, but do not frame visiting the homepage as the first navigation step.
- This is where the family can review current event-specific signups; availability changes throughout the year.
- Clearly distinguish interest forms from shift signups. A school-specific or district-wide interest form lets the person request to be contacted about opportunities; it is not a list of currently open shifts and does not guarantee placement.
- Do not suggest passive support activities such as Box Tops, sharing information, or simply joining as substitutes for volunteering when someone asks how to get involved or volunteer.
- Do not link the general /membership/ information page as though it were the logged-in account or direct volunteer-signup page.
- Never label /membership/ as the Membership Toolkit account portal; it is general membership information.
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
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY environment variable.");
      return res.status(500).json({
        error: "The chat service is not configured correctly."
      });
    }

    const validMessages = validateMessages(req.body?.messages);

    if (!validMessages.length) {
      return res.status(400).json({
        error: "Please enter a message before sending."
      });
    }

    const latestMessage = validMessages[validMessages.length - 1];

    if (latestMessage.role !== "user") {
      return res.status(400).json({
        error: "The latest message must be from the visitor."
      });
    }

    const [websiteContext, knowledge] = await Promise.all([
      getWebsiteContext(validMessages),
      getKnowledge(validMessages)
    ]);

    const systemInstruction = buildSystemPrompt(websiteContext, knowledge);
    const conversationForModel = isContextualFollowUp(latestMessage.text)
      ? validMessages
      : [latestMessage];

    const apiResponse = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: conversationForModel.map((message) => ({
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
      // Gemini sometimes escapes emphasis markers; restore them for Markdown rendering.
      .replace(/\\\*/g, "*")
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