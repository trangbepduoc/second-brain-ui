---
name: second-brain
description: Hybrid wiki + AI second brain for Tuấn Nguyễn Anh. Use when he wants to store knowledge, query past learnings, generate summaries, or post to social media using his own knowledge base. Supports: (1) adding knowledge via chat (agent) or via web UI, (2) AI-powered synthesis, Q&A, and auto-linking, (3) optional deployment of a simple web UI to Netlify for direct note-taking.
---

# Second Brain (Hybrid Wiki + AI)

A personal knowledge base that belongs to the user, not the AI. AI only powers synthesis, Q&A, and suggestions. The user grows this brain by reading, understanding, and writing notes.

## Core Philosophy

- **AI does NOT replace thinking.** It only reflects, synthesizes, and suggests.
- **User writes notes after reading and understanding.** Not raw book dumps.
- **No Claude Code or Obsidian imitation.** This is a custom wiki + AI assistant.
- **Not a memory dump.** Notes are curated, structured, and purposeful.
- **Hybrid access:**  
  - Chat with the agent (me) to add/query via commands  
  - Web UI (optional) for direct writing and browsing  
  - Agent can use the knowledge to draft posts, answer questions, and propose actions.

## Data Structure

All production notes are stored server-side in Netlify Blobs via a per-site unique `SB_BLOBS_STORE`. Do not ship note data in the skill package.
This file is the durable source of truth and must be treated as critical knowledge infrastructure.

Each note has:
```json
{
  "id": "uuid",
  "category": "Knowledge area / folder",
  "title": "Topic title",
  "content": "Markdown content written by user",
  "tags": ["tag1", "tag2"],
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "linked_notes": ["note-id-1", "note-id-2"],
  "source": "book|course|experiment|chat|web-ui"
}
```

Folders (virtual via tags):
- `#course` — learnings from courses
- `#experiment` — outcomes from testing/automation
- `#philosophy` — principles, beliefs, ways of thinking
- `#people` — notes about individuals (students, partners)
- `#tool` — tool-specific notes
- `#case` — case studies
- `#idea` — rough ideas to develop

## Commands (via chat)

### Add a note
```
second-brain add --title "..." --content "..." --tags course,landing-page --source course
```

### List notes
```
second-brain list --tag course --limit 10
second-brain list --search "landing page"
```

### Query / Q&A
```
second-brain query "What have I learned about landing page hero images on mobile?"
second-brain query "Summarize my philosophy on AI automation."
```

### Synthesize
```
second-brain synthesize --tag experiment --period "2026-04" --format blog-post
second-brain synthesize --tag course --format social-post --platform facebook
```

### Auto-link suggestions
```
second-brain suggest-links --note-id <id>
```

## Scripts

- `scripts/add_note.py` — add a note via CLI
- `scripts/list_notes.py` — list/search notes
- `scripts/query.py` — AI-powered Q&A over notes
- `scripts/synthesize.py` — generate summaries, posts, reports from notes
- `scripts/suggest_links.py` — suggest related notes

## Web UI (optional)

Deploy a simple static UI to Netlify:

- `public/index.html` — current locked production UI (graph + categories + Brain Query)
- `public/category-preview-pro.html` — mirror/reference copy of the same good UI when needed
- Uses client-side JS to read/write via Netlify Functions
- Functions in `functions/`:
  - `add-note.js`
  - `list-notes.js`
  - `set-notes.js`  ← overwrite full notes store for durable sync from UI
  - `brain-query.js` ← Q&A over notes + long-term chat memory via LLM
- Deploy with `netlify deploy --prod --dir public --functions functions`

### Required behavior for any future OpenClaw instance
- The good UI/UX from current production must be preserved unless the user explicitly asks to change it.
- Category edit, topic edit, and note-content edit are separate actions: editing a note must edit only note content/tags, not jump back to category/topic rename flow.
- For long note content, note editing should open in the large left sidebar composer (prefilled content/tags, save button switches to update mode). Keep category/topic rename in small popup prompts because they are short fields.
- Graph orbit layout should prioritize a spacious ring around the brain: few nodes orbit far for premium look; as nodes increase, radius can reduce only gently, with separation/repulsion to avoid crowding and preserve visual clarity.
- Brain node drag must work both when sidebar is hidden and when sidebar is visible. Sidebar state must never disable brain drag gestures.
- The brain must persist notes/categories/topics durably to the shared server-side store, not only localStorage. In production, treat server as the only source of truth; localStorage is cache/recovery only.
- **Data immutability lock (user directive):** never overwrite or delete existing notes during deploys/migrations by default. New deploys must preserve old notes exactly.
- `set-notes` is dangerous and must require explicit confirmation payload (`confirm=ALLOW_SET_NOTES`) plus schema validation and tripwire checks before write.
- Any bulk overwrite must create a server backup snapshot first.
- Reject payloads that look like chat history (`role/content`) or non-note schema.
- Never seed default demo notes/categories in production UI. Default `General` demo content can resurrect deleted data across devices.
- Production UI should sanitize note lists on read/write to strip known demo/ghost notes (`General`, `n1`, `n2`, demo titles like `Openclaw`, `Landing`) so stale localStorage cannot resurrect deleted data.
- Delete flows (note/topic/category) must write the reduced dataset to server immediately, then pull server state back; never merge stale local data after delete.
- For long-note editing, use optimistic local update + non-blocking background server queue (avoid UI freeze while waiting network round-trip).
- Poll/server refresh should pause while user is actively composing/saving to avoid graph jitter and accidental movement freezes.
- Brain Query must always use the LLM, but should prioritize a compact relevant-note context first. Avoid sending an excessively large full-corpus prompt that can trigger upstream inactivity/proxy timeouts.
- Brain Query must call the user-specified OpenAI-compatible endpoint directly and should prefer the intended model alias for that deployment. If the router returns SSE/chunked data, consume the stream incrementally instead of waiting on one giant raw response, otherwise intermediaries may return `Inactivity Timeout` HTML.
- Brain Query backend must have timeout/fallback hardening: call with `stream: true` first, and if upstream/proxy returns timeout HTML (e.g. `Inactivity Timeout`) or request fails, retry once with `stream: false` and lower token budget to prioritize delivery over perfect formatting.
- **Permanent Brain Query stability lock (user directive):** for direct HTTP calls from Netlify Function, pin the provider combo exactly: endpoint `http://103.56.163.244:20128/v1/chat/completions`, model `Content`, auth via fixed known-good API key path/config. Do not use alias `vllm/Content` for direct HTTP calls; that alias is only for OpenClaw runtime/session usage, not raw router HTTP.
- Never depend on Netlify runtime env alone for critical Brain Query auth if that path has already proven flaky. Prefer the known-good fixed combo or a single explicitly verified config source, then verify with a live POST after deploy.
- Brain Query fixes must be deployed without touching note data paths. Model/auth fixes must never call `set-notes`, never migrate notes, and never change UI seed/merge behavior in the same deploy.
- After every Brain Query deploy, run a live smoke test against `/.netlify/functions/brain-query` with a tiny prompt and confirm JSON `answer` exists before declaring success.
- Brain Query retrieval must rank notes by relevance to the question before prompting the LLM: tokenize the question, score notes by matches across category/title/tags/content, build a `topMatched` set, and place that set in a high-priority `relevantContext` block ahead of the full corpus.
- **Brain Query must be server-first for notes data**: do not trust browser local cache as the main source of truth when answering. Backend should load the authoritative shared notes store first, then optionally merge in client-sent notes only as a supplemental cache layer for unsynced changes.
- Frontend Brain Query requests should prefer sending only question/history/memory; avoid shipping the full local `notes` array by default because stale local cache can cause the model to miss valid notes already present on the shared server store.
- For long note bodies, Brain Query context should not truncate too aggressively. Use a larger per-note content window (for example ~2800 chars instead of ~900) and allow a broader matched-note set when needed so checklist/process notes are not cut in half.
- For technical/how-to notes with strong title intent (for example exact phrases like `Google Vertex Model`), retrieval should boost title/category matches aggressively so the exact updated note wins over weaker content matches.
- When a note is long and procedural, prefer a larger context window again (for example ~6000 chars) before concluding the note is missing. Brain Query bugs can come from retrieval truncation even when server save is already correct.
- If relevant notes were found, the LLM must be explicitly forbidden from answering “chưa có thông tin / chưa có kiến thức”. If it still does, backend should replace that reply with a fallback summary built directly from matched notes.
- Chat panel should support role badges, markdown rendering, typing indicator, and right-slide full-height panel.
- Brain replies must include a working per-message copy action (small Copy button at bottom-right of assistant bubble) that copies full reply text reliably with clipboard fallback.
- Any JS change in chat rendering/copy button/markdown/auth must pass a pre-deploy syntax check (`node --check` on extracted `<script>`). Never deploy when script parse fails.

## Using the Brain

### When the user says:
- “Lưu cái này vào bộ não thứ 2 của tôi” → `second-brain add …`
- “Tổng hợp các bài học landing page cho tôi” → `second-brain synthesize …`
- “Dựa trên bộ não, hãy đăng bài Facebook về tối ưu CPL” → synthesize → post via `facebook-page-publisher`
- “Tôi vừa đọc xong cuốn …, hãy lưu lại ý chính” → user provides content → `second-brain add …`

### When the user writes via web UI:
- UI calls Netlify Functions → reads/writes server-side Netlify Blobs store
- Agent can still read and synthesize

## Important Rules

- **Never add raw large texts (books, transcripts) without user curation.**
- **Always ask if uncertain about tagging or linking.**
- **Synthesized outputs should reflect user’s own words and thoughts.**
- **Web UI is optional.** Core is the data + agent interaction.
- **Respect privacy:** no note content in public repositories unless explicitly requested.
- **This second brain is bất khả xâm phạm**: it contains the user's accumulated knowledge and must be treated as precious long-term capital.
- **Do not casually redesign the good UI** once the user says it is "quá ngon rồi". Freeze the approved UI and only change it with explicit user instruction.
- **Always maintain durable storage + backup mindset**. Before risky migrations or UI rewrites, export/backup notes from the authenticated server API and preserve the approved UI HTML.
- **Second brain data is bất khả xâm phạm**: categories, topics, notes, and Brain Query behavior are valuable accumulated knowledge assets. Treat edits/migrations/deploys with the same care as production data.
- **If the user wants this on another OpenClaw instance, replicate the same architecture and guardrails exactly**: stable UI, durable notes store, Brain Query with LLM, and backup discipline.

## Initial Setup

Run once to create data file:
```bash
mkdir -p /home/openclaw/.openclaw/workspace/second-brain/data
```

## Example Workflow

1. User finishes a course → writes notes → `second-brain add …`
2. User wants to recall → `second-brain query "..."`
3. User needs a blog post → `second-brain synthesize --format blog-post`
4. User wants to post to Facebook → synthesize → `facebook-page-publisher`
5. User prefers web UI → opens deployed Netlify site → adds/writes notes directly

## Critical Deploy Guard
- Tuyệt đối KHÔNG deploy skill/UI second-brain lên domain `nguyenanhtuan.edu.vn` hoặc `www.nguyenanhtuan.edu.vn`.
- Chỉ deploy vào site second-brain riêng (`second-brain-anh-1777710641.netlify.app`) hoặc subdomain riêng dành cho brain (ví dụ `brain.nguyenanhtuan.edu.vn`) sau khi user yêu cầu rõ.
- Landing page chính và thank-you page chính của user là bất khả xâm phạm; second-brain không được phép dùng chung site/domain đó.

## Backup Rule (mandatory)
- Before major refactors or schema changes, create a timestamped backup of:
  - `public/index.html`
  - `public/category-preview-pro.html` (if present)
  - Keep at least one known-good UI snapshot and one known-good notes snapshot.

- **Second Brain Netlify Blobs isolation hard-lock (2026-06-02):** Không dùng generic store `second-brain-store` cho nhiều site/cloned installs. Mỗi user/site phải có unique `SB_BLOBS_STORE` hoặc hardcoded unique fallback riêng (ví dụ example: `second-brain-store-<unique-user-site-timestamp>`). Không copy `SB_BLOBS_SITE_ID`/`SB_BLOBS_TOKEN` sang Claw/site khác. Sau deploy/clone phải live-check `/.netlify/functions/list-notes` giữa domain anh và domain clone để chắc notes không bị shared. Nếu phát hiện shared, backup notes, rotate store, restore notes vào store mới, patch local functions, rồi commit.
