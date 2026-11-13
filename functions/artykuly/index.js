import { listingPage } from '../../cloudflare/public-pages.mjs';
export async function onRequest(context) {
  return context.env.CMS_CONTENT_BACKEND === 'd1' && context.env.DB ? listingPage(context, 'article') : context.next();
}
