const { getStore } = require('@netlify/blobs');
const { requireAuth } = require('./_auth');

const STORE = process.env.SB_BLOBS_STORE;
const SITE_ID = process.env.SB_BLOBS_SITE_ID;
const TOKEN = process.env.SB_BLOBS_TOKEN;
const KEY = 'notes.json';

const API_ENDPOINT = process.env.SECOND_BRAIN_LLM_API_ENDPOINT || process.env.SECOND_BRAIN_LLM_URL || 'http://103.56.163.244:20128/v1/chat/completions';
const MODEL = process.env.SECOND_BRAIN_LLM_MODEL || 'Content';
const LLM_API_KEY = process.env.SECOND_BRAIN_LLM_API_KEY || process.env.OPENAI_API_KEY || 'sk-7bb39f8a2677ab80-ge4ebz-913c336a';
const UPSTREAM_TIMEOUT_MS = 45000;

function makeStore() {
  return getStore(STORE, { siteID: SITE_ID, token: TOKEN });
}

function tokenize(txt='') {
  return String(txt).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && w.length > 1);
}

function noteToText(n, i) {
  return `${i + 1}. [${n.category || 'General'}] ${n.title || ''}\nTags: ${(n.tags || []).join(', ')}\nContent: ${String(n.content || '').slice(0, 6000)}`;
}

async function readSSEText(resp) {
  const reader = resp.body?.getReader?.();
  if (!reader) return await resp.text();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const obj = JSON.parse(payload);
        const piece = obj?.choices?.[0]?.delta?.content || obj?.choices?.[0]?.message?.content || '';
        if (piece) answer += piece;
      } catch {}
    }
  }
  if (answer.trim()) return JSON.stringify({ choices: [{ message: { content: answer.trim() } }] });
  return buffer || '';
}

async function callLLM(messages, { stream = true, maxTokens = 380 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const headers = { 'content-type': 'application/json', accept: 'application/json,text/event-stream' };
    if (LLM_API_KEY) headers.authorization = `Bearer ${LLM_API_KEY}`;
    const resp = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: maxTokens, stream, messages })
    });

    const raw = stream ? await readSSEText(resp) : await resp.text();
    return { ok: resp.ok, raw, status: resp.status };
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event) => {
  const auth = requireAuth(event); if (!auth.ok) return auth.response;
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const question = String(body.question || '').trim();
    const chatHistory = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const memory = Array.isArray(body.memory) ? body.memory.slice(-10) : [];
    const notesFromClient = Array.isArray(body.notes) ? body.notes.slice(-500) : null;

    if (!question) return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Missing question' }) };

    let serverNotes = [];
    try {
      const store = makeStore();
      const raw = await store.get(KEY, { type: 'text' });
      serverNotes = raw ? JSON.parse(raw) : [];
    } catch (_) { serverNotes = []; }

    // Always prioritize server-first truth, then merge client cache to avoid missing notes.
    const merged = new Map();
    for (const n of Array.isArray(serverNotes) ? serverNotes : []) {
      if (n && n.id) merged.set(n.id, n);
    }
    for (const n of (notesFromClient && notesFromClient.length ? notesFromClient : [])) {
      if (!n) continue;
      if (n.id && !merged.has(n.id)) merged.set(n.id, n);
      if (!n.id) merged.set(`client-${Math.random().toString(36).slice(2)}`, n);
    }
    const notes = Array.from(merged.values());

    const qTokens = Array.from(new Set(tokenize(question)));
    const scoreNote = (n) => {
      const hay = tokenize(`${n.category||''} ${n.title||''} ${(n.tags||[]).join(' ')} ${n.content||''}`);
      if (!hay.length || !qTokens.length) return 0;
      const set = new Set(hay);
      let score = 0;
      for (const t of qTokens) if (set.has(t)) score += (t.length >= 6 ? 3 : 1);
      const title = String(n.title||'').toLowerCase();
      const qLower = String(question).toLowerCase();
      if (title.includes(qLower)) score += 12;
      // boost when key phrase words overlap strongly in title/category
      const titleCat = `${String(n.category||'').toLowerCase()} ${title}`;
      const hitCount = qTokens.filter(t => titleCat.includes(t)).length;
      if (hitCount >= 2) score += 8;
      return score;
    };

    const ranked = notes.map(n => ({ n, s: scoreNote(n) })).sort((a,b)=>b.s-a.s);
    const topMatched = ranked.filter(x => x.s > 0).slice(0, 20).map(x => x.n);
    const hasRelevant = topMatched.length > 0;
    const workingSet = hasRelevant ? topMatched : notes.slice(-20);

    const relevantContext = workingSet.map(noteToText).join('\n\n');
    const memoryContext = memory.map((m, i) => `${i + 1}. Q: ${m.q || ''}\nA: ${m.a || ''}`).join('\n\n');

    const messages = [
      { role: 'system', content: 'Bạn là bộ não thứ 2 của ÔNG CHỦ. Trả lời tiếng Việt rõ ràng, có cấu trúc, không bịa.' },
      { role: 'system', content: `KIẾN THỨC LIÊN QUAN NHẤT:\n${relevantContext || '(empty)'}` },
      { role: 'system', content: hasRelevant ? 'Đã có note liên quan. Không nói chưa có thông tin.' : 'Nếu chưa có note liên quan, nói rõ chưa có trong bộ não hiện tại.' },
      { role: 'system', content: `CHAT MEMORY GẦN ĐÂY:\n${memoryContext || '(empty)'}` },
      ...chatHistory,
      { role: 'user', content: question }
    ];

    let llm = await callLLM(messages, { stream: true, maxTokens: 360 });

    // Fallback path for proxies/load balancers that return HTML inactivity pages on long SSE waits.
    if (!llm.ok || /Inactivity Timeout/i.test(String(llm.raw || ''))) {
      llm = await callLLM(messages, { stream: false, maxTokens: 260 });
    }

    const raw = llm.raw;

    if (!llm.ok) {
      return { statusCode: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'LLM request failed', detail: raw || 'empty upstream response', model: MODEL, endpoint: API_ENDPOINT, status: llm.status, key_present: !!LLM_API_KEY, key_len: (LLM_API_KEY||'').length }) };
    }

    let data;
    try { data = JSON.parse(raw); }
    catch (_) {
      return { statusCode: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Upstream returned non-JSON response', detail: String(raw || '').slice(0, 1200), model: MODEL, endpoint: API_ENDPOINT }) };
    }

    const answer = data?.choices?.[0]?.message?.content || 'Chưa có phản hồi từ model.';

    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answer, model: MODEL, endpoint: API_ENDPOINT, matched: workingSet.length }) };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: String(e && e.message || e), model: MODEL, endpoint: API_ENDPOINT }) };
  }
};
