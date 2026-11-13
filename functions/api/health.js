import { json } from '../../cloudflare/common.mjs';

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ready: false }, 503);
  try {
    await env.DB.prepare('SELECT id FROM ads_settings LIMIT 1').first();
    await env.DB.prepare('SELECT id FROM cms_users LIMIT 1').first();
    if (env.CMS_CONTENT_BACKEND === 'd1') await env.DB.prepare('SELECT path FROM cms_content LIMIT 1').first();
    const ready = env.CMS_CONTENT_BACKEND === 'd1' || env.CMS_CONTENT_BACKEND === 'github' && Boolean(env.CMS_GITHUB_TOKEN);
    return json({ ready }, ready ? 200 : 503);
  } catch { return json({ ready: false }, 503); }
}
