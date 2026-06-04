const { getStore } = require('@netlify/blobs');
const store = getStore('second-brain-auth', { siteID: process.env.SB_BLOBS_SITE_ID, token: process.env.SB_BLOBS_TOKEN });
exports.handler = async () => {
  try {
    const data = await store.get('auth', { type: 'json' });
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hasPassword: !!(data && data.hash) })
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hasPassword: false, error: String(e && e.message || e) })
    };
  }
};
