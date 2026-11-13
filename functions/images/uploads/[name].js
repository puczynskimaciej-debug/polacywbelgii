import { readContent } from '../../../cloudflare/content-store.mjs';

const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
export async function onRequest(context) {
  if (context.env.CMS_CONTENT_BACKEND !== 'd1' || !context.env.DB) return context.next();
  const name = context.params.name;
  if (!/^[A-Za-z0-9_.-]{1,180}\.(?:png|jpe?g|webp|gif|avif)$/i.test(name)) return new Response('Not Found', { status: 404 });
  try {
    const file = await readContent(context.env.DB, `src/Images/uploads/${name}`);
    const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
    return new Response(bytes, { headers: { 'Content-Type': types[name.split('.').at(-1).toLowerCase()], 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    if (error.status === 404) return new Response('Not Found', { status: 404 });
    throw error;
  }
}
