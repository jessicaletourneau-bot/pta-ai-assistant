# Windham PTA chat redesign

This package contains complete replacement files:
- `index.html` — ChatGPT-inspired conversation layout, persistent browser chat history, suggested prompts, safe rendering of Markdown links, and responsive layout.
- `api/chat.js` — first-person conversational instructions, descriptive Markdown links, and public knowledge-base loading.
- `assets/windham-pta-logo.png` — the official Windham PTA logo used in the chat header and welcome screen.

Keep the existing `knowledge/pta-knowledge.md` file from the previous knowledge-base package in the repository root. Keep `GEMINI_API_KEY` in Vercel Environment Variables.

Deployment:
1. Replace the repository's `index.html`.
2. Replace `api/chat.js`.
3. Upload the `assets` folder and its `windham-pta-logo.png` file.
4. Keep `knowledge/pta-knowledge.md`.
5. Commit and let Vercel deploy.

The iframe must have enough height to show the expanded chat panel. This keeps the launcher available while the chat is closed; opening it displays the larger conversation interface.
