import { errorResponse, fail, json, readJson } from '../../cloudflare/common.mjs';
import * as auth from '../../cloudflare/auth.mjs';

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) fail('configuration', 503);
    const action = new URL(request.url).searchParams.get('action') || 'session';
    if (request.method === 'GET' && action === 'session') return json({ user: auth.publicUser(await auth.currentUser(request, env, { allowPasswordChange: true })) });
    if (request.method === 'GET' && action === 'users') {
      await auth.currentUser(request, env, { admin: true });
      const users = await env.DB.prepare('SELECT * FROM cms_users ORDER BY created_at').all();
      return json({ users: users.results.map(auth.publicUser) });
    }
    if (!['POST', 'PUT'].includes(request.method)) fail('method', 405);
    auth.checkOrigin(request, env);
    const input = await readJson(request);
    if (request.method === 'POST' && action === 'login') {
      const result = await auth.login(request, env, input);
      return json({ user: result.user }, 200, { 'Set-Cookie': result.cookie });
    }
    if (request.method === 'POST' && action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': await auth.logout(request, env) });
    if (request.method === 'POST' && action === 'password') return json({ ok: true }, 200, { 'Set-Cookie': await auth.changePassword(request, env, input) });
    if (action === 'users') {
      const user = await auth.saveUser(request, env, input, request.method === 'POST');
      return json({ user }, request.method === 'POST' ? 201 : 200);
    }
    fail('notFound', 404);
  } catch (error) { return errorResponse(error); }
}
