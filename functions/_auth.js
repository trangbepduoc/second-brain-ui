const crypto = require('crypto');
function json(statusCode, body) { return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) }; }
function getCookie(event, name) {
  const raw = event.headers?.cookie || event.headers?.Cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}
function sign(value) {
  const secret = process.env.SB_AUTH_SECRET;
  if (!secret || secret.length < 24) return '';
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}
function requireAuth(event) {
  const secret = process.env.SB_AUTH_SECRET;
  if (!secret || secret.length < 24) return { ok:false, response: json(503, { ok:false, error:'server auth not configured' }) };
  const token = getCookie(event, 'sb_session');
  if (!token || !token.includes('.')) return { ok:false, response: json(401, { ok:false, error:'auth required' }) };
  const [value, sig] = token.split('.', 2);
  if (!value || !sig || sign(value) !== sig) return { ok:false, response: json(401, { ok:false, error:'auth required' }) };
  return { ok:true };
}
function makeSession() {
  const value = crypto.randomBytes(24).toString('hex');
  return `${value}.${sign(value)}`;
}
module.exports = { json, requireAuth, makeSession };
