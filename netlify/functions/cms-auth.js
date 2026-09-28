const auth = require('../../server/cms-auth');
const { database } = require('../../server/ads-store');
const { reply, fail, readJson, handleError } = require('../../server/http');
exports.handler = async event => {
  try {
    const action = event.queryStringParameters?.action || 'session';
    const method = event.httpMethod;
    if (method === 'GET' && action === 'session') return reply(200, { user: auth.publicUser(await auth.currentUser(event, { allowPasswordChange: true })) });
    if (method === 'GET' && action === 'users') {
      await auth.currentUser(event, { admin: true });
      return reply(200, { users: (await database().query('SELECT * FROM cms_users ORDER BY created_at')).rows.map(auth.publicUser) });
    }
    if (!['POST', 'PUT'].includes(method)) fail('method', 405);
    auth.checkOrigin(event);
    const input = readJson(event);
    if (method === 'POST' && action === 'login') {
      const result = await auth.login(event, input);
      return reply(200, { user: result.user }, { 'Set-Cookie': result.cookie });
    }
    if (method === 'POST' && action === 'logout') {
      const token = auth.sessionToken(event);
      if (token) await database().query('DELETE FROM cms_sessions WHERE token_hash=$1', [auth.digest(token)]);
      return reply(200, { ok: true }, { 'Set-Cookie': auth.sessionCookie('', 0) });
    }
    if (method === 'POST' && action === 'password') return reply(200, { ok: true }, { 'Set-Cookie': await auth.changePassword(event, input) });
    if (action === 'users') return reply(method === 'POST' ? 201 : 200, { user: await auth.saveUser(event, input, method === 'POST') });
    fail('notFound', 404);
  } catch (error) { return handleError(error); }
};
