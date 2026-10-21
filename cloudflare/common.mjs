export class ApiError extends Error {
  constructor(code, status = 400, details) { super(code); this.code = code; this.status = status; this.details = details; }
}
export const fail = (code, status = 400, details) => { throw new ApiError(code, status, details); };
export const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export function errorResponse(error) {
  if (error instanceof ApiError || (error && typeof error.code === 'string' && Number.isInteger(error.status))) return json({ error: error.code, ...(error.details ? { details: error.details } : {}) }, error.status);
  console.error('Pages API failure:', error?.code || error?.name || 'Error');
  return json({ error: 'unavailable' }, 503);
}
export async function readJson(request, limit = 20000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail('contentType', 415);
  const contentLength = Number(request.headers.get('content-length'));
  if (contentLength > limit) fail('tooLarge', 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > limit) fail('tooLarge', 413);
  let data;
  try { data = JSON.parse(raw || '{}'); } catch { fail('validation'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('validation');
  return data;
}
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());
export const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
export async function sha256(value) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
