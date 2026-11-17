import content from '../../server/cms-content.js';
import { currentUser } from '../../cloudflare/auth.mjs';
import { errorResponse, fail, json, readJson } from '../../cloudflare/common.mjs';
import { listContent, readContent, writeContent, withdrawContent, contentHistory, changeArticlePublication } from '../../cloudflare/content-store.mjs';

async function github(env, endpoint, options = {}) {
  const repository = env.CMS_GITHUB_REPOSITORY || 'puczynskimaciej-debug/polacywbelgii';
  if (!env.CMS_GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(repository)) fail('contentConfiguration', 503);
  const response = await fetch(`https://api.github.com/repos/${repository}${endpoint}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${env.CMS_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'polacywbelgii-cms' },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15000), redirect: 'error'
  });
  if (!response.ok) fail(response.status === 409 || response.status === 422 ? 'conflict' : response.status === 404 ? 'notFound' : 'contentUnavailable', response.status === 404 ? 404 : response.status === 409 || response.status === 422 ? 409 : 502);
  return response.status === 204 ? null : response.json();
}

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) fail('configuration', 503);
    const user = await currentUser(request, env);
    const query = new URL(request.url).searchParams;
    const branch = env.CMS_GITHUB_BRANCH || 'cloudflare-migration';
    const useD1 = env.CMS_CONTENT_BACKEND === 'd1';
    if (!useD1 && env.CMS_CONTENT_BACKEND !== 'github') fail('contentConfiguration', 503);
    if (request.method === 'GET' && query.get('action') === 'history') {
      if (user.role !== 'admin') fail('forbidden', 403);
      if (useD1) return json(await contentHistory(env.DB));
      return json(await github(env, `/commits?${new URLSearchParams({ sha: branch, per_page: '50' })}`));
    }
    if (!['GET', 'PUT', 'DELETE', 'POST'].includes(request.method)) fail('method', 405);
    if (request.method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin) fail('origin', 403);
    const filename = content.allowedPath(query.get('path'), request.method !== 'GET');
    if (useD1) {
      if (request.method === 'GET') return json(filename === 'src/content/articles' || filename === 'src/Images/uploads' ? await listContent(env.DB, filename) : await readContent(env.DB, filename));
      const input = await readJson(request, 5700000);
      if (input.sha !== undefined && !/^[0-9a-f]{40,64}$/.test(input.sha)) fail('validation');
      if (request.method === 'POST') {
        if (!filename.startsWith('src/content/articles/') || !input.sha || !['publish-now','schedule','unschedule','withdraw'].includes(input.action)) fail('validation');
        return json(await changeArticlePublication(env.DB,filename,input.sha,input.action,input.scheduledAt,user));
      }
      if (request.method === 'DELETE') {
        if (filename.startsWith('src/_data/') || !input.sha) fail('validation');
        return json(await withdrawContent(env.DB, filename, input.sha, user));
      }
      content.validateContent(filename, input.content);
      return json(await writeContent(env.DB, filename, input.content, input.sha, user, input.status));
    }
    const endpoint = '/contents/' + filename.split('/').map(encodeURIComponent).join('/');
    if (request.method === 'GET') return json(await github(env, `${endpoint}?${new URLSearchParams({ ref: branch })}`));
    const input = await readJson(request, 5700000);
    if (request.method === 'DELETE' && filename.startsWith('src/_data/')) fail('path', 403);
    if (input.sha !== undefined && !/^[0-9a-f]{40,64}$/.test(input.sha)) fail('validation');
    if (request.method === 'DELETE' && !input.sha) fail('validation');
    if (request.method === 'PUT') content.validateContent(filename, input.content);
    const message = `CMS: ${request.method === 'DELETE' ? 'usunięcie' : 'zapis'} ${filename} (${user.name}; konto ${user.id})`;
    return json(await github(env, endpoint, { method: request.method, body: { message, branch, ...(input.sha ? { sha: input.sha } : {}), ...(request.method === 'PUT' ? { content: input.content } : {}) } }));
  } catch (error) { return errorResponse(error); }
}
