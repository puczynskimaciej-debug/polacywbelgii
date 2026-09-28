class HttpError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
function fail(code, status = 400) { throw new HttpError(code, status); }
function reply(statusCode, data, headers = {}) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }, body: JSON.stringify(data) };
}
function readJson(event, max = 20000) {
  if (!String(event.headers['content-type'] || '').startsWith('application/json')) fail('contentType', 415);
  if (event.isBase64Encoded || Buffer.byteLength(event.body || '') > max) fail('tooLarge', 413);
  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { fail('validation'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('validation');
  return data;
}
function handleError(error) {
  if (error instanceof HttpError) return reply(error.status, { error: error.code });
  console.error('CMS request failed:', error.code || error.name);
  return reply(503, { error: 'unavailable' });
}
module.exports = { HttpError, fail, reply, readJson, handleError };
