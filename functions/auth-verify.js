const { getStore } = require('@netlify/blobs');
const store = getStore('second-brain-auth', { siteID: process.env.SB_BLOBS_SITE_ID, token: process.env.SB_BLOBS_TOKEN });
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const hash = String(body.hash || '').trim();
    const data = await store.get('auth', { type: 'json' });
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: !!(data && data.hash && data.hash === hash), hasPassword: !!(data && data.hash) })
    };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: String(e && e.message || e) }) };
  }
};
