const { getStore } = require('@netlify/blobs');
const { requireAuth } = require('./_auth');
const STORE = process.env.SB_BLOBS_STORE;
const SITE_ID = process.env.SB_BLOBS_SITE_ID;
const TOKEN = process.env.SB_BLOBS_TOKEN;
const KEY = 'notes.json';
function makeStore() {
  if (!STORE) throw new Error('SB_BLOBS_STORE is required');
  return getStore(STORE, SITE_ID && TOKEN ? { siteID: SITE_ID, token: TOKEN } : undefined);
}
exports.handler = async (event) => {
  const auth = requireAuth(event); if (!auth.ok) return auth.response;
  try {
    const store = makeStore();
    const raw = await store.get(KEY, { type: 'text' });
    const data = raw ? JSON.parse(raw) : [];
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(Array.isArray(data) ? data : []) };
  } catch (e) {
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: '[]' };
  }
};