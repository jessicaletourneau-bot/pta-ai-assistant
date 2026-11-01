# Windham PTA AI Assistant knowledge base

## Files
- `knowledge/pta-knowledge.md`: public Windham PTA reference material used by the assistant.
- `api/chat.js`: Vercel serverless endpoint that reads the knowledge file and sends it to Gemini.

## Install
1. Add the `knowledge` folder and `pta-knowledge.md` to the root of your existing GitHub repository.
2. Replace `api/chat.js` with the supplied version.
3. Keep `GEMINI_API_KEY` in Vercel Environment Variables. Never put it in GitHub or browser code.
4. Commit to the branch connected to Vercel and let it deploy.
5. Test with the questions listed below.

The existing `index.html` should continue to work because the endpoint still accepts `{ messages: [{ role, text }] }` and returns `{ reply }`.

## Suggested tests
- How do I join Windham PTA?
- Do I need to be a member to donate?
- How do I access my digital membership card?
- Who handles school volunteer fingerprinting?
- Where can I find current partner discounts?
- When is the next PTA meeting?
- Who is the current PTA treasurer?

## Maintenance
Update `knowledge/pta-knowledge.md` when public information changes. Verify event dates, partner offers, board contacts, and annual program details on the live website before publishing updates.

## Important
This starter knowledge base contains public information only. Do not add private board discussions, student/family records, passwords, payment details, or confidential documents.
