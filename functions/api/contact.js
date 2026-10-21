import { currentUser } from '../../cloudflare/auth.mjs';
import { errorResponse, fail, json, sha256 } from '../../cloudflare/common.mjs';

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) fail('configuration', 503);
    if (request.method === 'GET') {
      await currentUser(request, env);
      const rows = await env.DB.prepare('SELECT id,name,email,subject,message,created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200').all();
      return json({ messages: rows.results });
    }
    if (request.method !== 'POST') fail('method', 405);
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) fail('contentType', 415);
    if (Number(request.headers.get('content-length')) > 20000) fail('tooLarge', 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 20000) fail('tooLarge', 413);
    const input = new URLSearchParams(raw);
    if (input.get('bot-field')) return Response.redirect(new URL('/kontakt/?sent=1', request.url), 303);
    const name = input.get('name')?.trim();
    const email = input.get('email')?.trim();
    const subject = input.get('subject')?.trim();
    const message = input.get('message')?.trim();
    if (!name || name.length > 120 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !subject || subject.length > 120 || !message || message.length > 5000 || input.get('consent') !== 'yes') fail('validation');
    const ipHash = await sha256(`contact:${request.headers.get('cf-connecting-ip') || 'unknown'}`);
    const threshold = new Date(Date.now() - 3600000).toISOString();
    const count = await env.DB.prepare('SELECT count(*) AS n FROM contact_messages WHERE ip_hash=? AND created_at>?').bind(ipHash, threshold).first();
    if (count.n >= 5) fail('rateLimit', 429);
    await env.DB.prepare('INSERT INTO contact_messages(id,name,email,subject,message,ip_hash) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), name, email, subject, message, ipHash).run();
    return Response.redirect(new URL('/kontakt/?sent=1', request.url), 303);
  } catch (error) { return errorResponse(error); }
}
