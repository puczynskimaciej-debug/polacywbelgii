import { publicEntries } from '../cloudflare/public-pages.mjs';

const xml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
export async function onRequest(context) {
  if (context.env.CMS_CONTENT_BACKEND !== 'd1' || !context.env.DB) return context.next();
  const origin = new URL(context.request.url).origin;
  const entries = await publicEntries(context.env.DB);
  const paths = ['/', '/artykuly/', '/wydarzenia/', '/kontakt/', ...entries.map(item => item.url)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(paths)].map(path => `<url><loc>${xml(new URL(path, origin).href)}</loc></url>`).join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
}
