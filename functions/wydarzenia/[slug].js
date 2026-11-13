import { articlePage } from '../../cloudflare/public-pages.mjs';
export async function onRequest(context) {
  if (context.env.CMS_CONTENT_BACKEND !== 'd1' || !context.env.DB) return context.next();
  return articlePage(context);
}
