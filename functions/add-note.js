const { randomUUID } = require('crypto');
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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const store = makeStore();
    const raw = await store.get(KEY, { type: 'text' });
    const arr = raw ? JSON.parse(raw) : [];

    const now = new Date().toISOString();
    const note = {
      id: body.id || randomUUID(),
      category: body.category || 'General',
      title: body.title || '',
      content: body.content || '',
      tags: Array.isArray(body.tags) ? body.tags : [],
      created_at: body.created_at || now,
      updated_at: now,
      linked_notes: Array.isArray(body.linked_notes) ? body.linked_notes : [],
      source: body.source || 'web-ui'
    };

    arr.push(note);
    await store.set(KEY, JSON.stringify(arr));

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, note, count: arr.length, backend: 'netlify-blobs', store: STORE })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: String(e && e.message || e) })
    };
  }
};
