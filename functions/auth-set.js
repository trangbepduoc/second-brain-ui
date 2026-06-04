const { getStore } = require('@netlify/blobs');
const store = getStore('second-brain-auth', { siteID: process.env.SB_BLOBS_SITE_ID, token: process.env.SB_BLOBS_TOKEN });
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const hash = String(body.hash || '').trim();
    if (!hash) {
      return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'missing hash' }) };
    }
    await store.setJSON('auth', { hash, updated_at: new Date().toISOString() });
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: String(e && e.message || e) }) };
  }
};
