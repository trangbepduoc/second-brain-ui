const { json, makeSession } = require('./_auth');
const crypto = require('crypto');
function sha256(s){ return crypto.createHash('sha256').update(String(s||'')).digest('hex'); }
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method Not Allowed' });
  try {
    const configured = process.env.SB_LOGIN_PASSWORD_SHA256;
    if (!configured || configured.length < 32) return json(503, { ok:false, error:'server auth not configured' });
    const body = JSON.parse(event.body || '{}');
    const pass = String(body.password || '').trim();
    if (!pass || sha256(pass) !== configured) return json(401, { ok:false, error:'invalid password' });
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'set-cookie': `sb_session=${makeSession()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
      },
      body: JSON.stringify({ ok:true })
    };
  } catch(e) { return json(500, { ok:false, error:String(e&&e.message||e) }); }
};
