import { articlePage } from '../../cloudflare/public-pages.mjs';

export async function onRequest(context) {
  if (context.env.CMS_CONTENT_BACKEND === 'd1') {
    if (!context.env.DB) return new Response('Unavailable', { status: 503 });
    return articlePage(context);
  }
  const slug = context.params.slug;
  if (!/^ai-[a-f0-9]{20}$/.test(slug || '')) return context.next();
  if (!context.env.DB) return new Response('Unavailable',{ status:503, headers:{ 'Cache-Control':'no-store' } });
  const row = await context.env.DB.prepare('SELECT status,public_state FROM ai_editorial WHERE candidate_id=?').bind(slug.slice(3)).first();
  if (row?.status !== 'published' || row.public_state !== 'visible') return new Response('Not Found',{ status:404, headers:{ 'Cache-Control':'no-store','X-Robots-Tag':'noindex' } });
  return context.next();
}
