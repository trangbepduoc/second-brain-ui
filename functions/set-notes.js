const { getStore } = require('@netlify/blobs');
const { requireAuth } = require('./_auth');
const STORE = process.env.SB_BLOBS_STORE;
const SITE_ID = process.env.SB_BLOBS_SITE_ID;
const TOKEN = process.env.SB_BLOBS_TOKEN;
const KEY = 'notes.json';
const BACKUP_PREFIX = 'backups/notes';
const TRIPWIRE_DROP_RATIO = 0.8;
function makeStore() {
  if (!STORE) throw new Error('SB_BLOBS_STORE is required');
  return getStore(STORE, SITE_ID && TOKEN ? { siteID: SITE_ID, token: TOKEN } : undefined);
}
function isRealNote(x) {
  return !!(x && typeof x === 'object' && !Array.isArray(x)
    && (typeof x.title === 'string' || typeof x.content === 'string' || typeof x.category === 'string')
    && !('role' in x && !('title' in x) && !('category' in x)));
}
function normalizeNote(x, i) {
  const now = new Date().toISOString();
  return {
    id: x.id || `note-${Date.now()}-${i}`,
    category: typeof x.category === 'string' && x.category.trim() ? x.category.trim() : 'General',
    title: typeof x.title === 'string' && x.title.trim() ? x.title.trim() : String(x.content || '').trim().slice(0, 80) || 'Untitled',
    content: typeof x.content === 'string' ? x.content : '',
    tags: Array.isArray(x.tags) ? x.tags : [],
    created_at: x.created_at || now,
    updated_at: now,
    linked_notes: Array.isArray(x.linked_notes) ? x.linked_notes : [],
    source: x.source || 'web-ui'
  };
}
exports.handler = async (event) => {
  const auth = requireAuth(event); if (!auth.ok) return auth.response;
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    if (!body || body.confirm !== 'ALLOW_SET_NOTES') {
      return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Missing confirm=ALLOW_SET_NOTES' }) };
    }
    const incoming = Array.isArray(body.notes) ? body.notes : [];
    const filtered = incoming.filter(isRealNote).map(normalizeNote);
    if (!filtered.length) {
      return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Rejected empty or invalid notes payload' }) };
    }
    const store = makeStore();
    const rawExisting = await store.get(KEY, { type: 'text' });
    const existing = rawExisting ? JSON.parse(rawExisting) : [];
    if (Array.isArray(existing) && existing.length >= 10 && filtered.length < Math.floor(existing.length * TRIPWIRE_DROP_RATIO)) {
      return { statusCode: 409, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Tripwire: note count drop too large', existing_count: existing.length, incoming_count: filtered.length }) };
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    await store.set(`${BACKUP_PREFIX}-${ts}.json`, JSON.stringify(Array.isArray(existing) ? existing : []));
    await store.set(KEY, JSON.stringify(filtered));
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, count: filtered.length, backup_key: `${BACKUP_PREFIX}-${ts}.json`, backend: 'netlify-blobs', store: STORE }) };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: String(e && e.message || e) }) };
  }
};
