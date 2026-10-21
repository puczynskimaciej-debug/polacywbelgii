import { json } from '../../cloudflare/common.mjs';

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ready: false }, 503);
  try {
    await env.DB.prepare('SELECT id FROM ads_settings LIMIT 1').first();
    await env.DB.prepare('SELECT id FROM cms_users LIMIT 1').first();
    return json({ ready: Boolean(env.CMS_GITHUB_TOKEN) }, env.CMS_GITHUB_TOKEN ? 200 : 503);
  } catch { return json({ ready: false }, 503); }
}
