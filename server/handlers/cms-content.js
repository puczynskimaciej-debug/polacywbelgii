const { currentUser } = require('../cms-auth');
const { reply, readJson, fail, handleError } = require('../http');
const { allowedPath, validateContent, github } = require('../cms-content');
exports.handler = async event => {
  try {
    const user = await currentUser(event);
    const query = event.queryStringParameters || {};
    const branch = process.env.CMS_GITHUB_BRANCH || 'main';
    if (event.httpMethod === 'GET' && query.action === 'history') {
      if (user.role !== 'admin') fail('forbidden', 403);
      return reply(200, await github(`/commits?${new URLSearchParams({ sha: branch, per_page: '50' })}`));
    }
    if (!['GET', 'PUT', 'DELETE'].includes(event.httpMethod)) fail('method', 405);
    const filename = allowedPath(query.path, event.httpMethod !== 'GET');
    const endpoint = '/contents/' + filename.split('/').map(encodeURIComponent).join('/');
    if (event.httpMethod === 'GET') return reply(200, await github(`${endpoint}?${new URLSearchParams({ ref: branch })}`));
    const input = readJson(event, 5700000);
    if (event.httpMethod === 'DELETE' && filename.startsWith('src/_data/')) fail('path', 403);
    if (input.sha !== undefined && !/^[0-9a-f]{40,64}$/.test(input.sha)) fail('validation');
    if (event.httpMethod === 'DELETE' && !input.sha) fail('validation');
    if (event.httpMethod === 'PUT') validateContent(filename, input.content);
    const message = `CMS: ${event.httpMethod === 'DELETE' ? 'usunięcie' : 'zapis'} ${filename} (${user.name}; konto ${user.id})`;
    return reply(200, await github(endpoint, { method: event.httpMethod, body: { message, branch, ...(input.sha ? { sha: input.sha } : {}), ...(event.httpMethod === 'PUT' ? { content: input.content } : {}) } }));
  } catch (error) { return handleError(error); }
};
