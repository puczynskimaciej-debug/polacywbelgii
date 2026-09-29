const { fail } = require('./http');
const yaml = require('js-yaml');
const languages = require('../src/_data/languages.json');
const directories = new Set(['src/content/articles', 'src/Images/uploads']);
const configs = new Set(['src/_data/home.json', 'src/_data/site.json']);
function allowedPath(value, writing = false) {
  if (typeof value !== 'string' || value.includes('..') || value.length > 240) fail('path', 403);
  if (configs.has(value) || /^src\/content\/articles\/[a-z0-9-]{1,90}\.md$/.test(value) || /^src\/Images\/uploads\/[A-Za-z0-9_.-]{1,180}\.(?:png|jpe?g|webp|gif|avif)$/i.test(value)) return value;
  if (!writing && directories.has(value)) return value;
  fail('path', 403);
}
function safeUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || value.includes('\\') || [...value].some(char => char.codePointAt(0) < 32)) fail('validation');
  if (!value || (/^\/(?!\/)/.test(value))) return;
  try { if (!['http:', 'https:'].includes(new URL(value).protocol)) fail('validation'); } catch { fail('validation'); }
}
function validateContent(filename, content) {
  if (typeof content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) fail('validation');
  const bytes = Buffer.from(content, 'base64');
  if (bytes.length > 4 * 1024 * 1024) fail('tooLarge', 413);
  if (filename.startsWith('src/Images/uploads/')) {
    const extension = filename.split('.').pop().toLowerCase();
    const valid = /jpe?g/.test(extension) ? bytes.subarray(0, 3).toString('hex') === 'ffd8ff' : extension === 'png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : extension === 'gif' ? /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6)) : extension === 'webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' : bytes.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii', 8, 32));
    if (!valid) fail('image'); return;
  }
  if (bytes.length > 512000) fail('tooLarge', 413);
  const text = bytes.toString('utf8');
  if (filename.endsWith('.md')) {
    if (/\{[{%#]/.test(text)) fail('templateCode');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) fail('validation');
    let data; try { data = yaml.load(match[1], { schema: yaml.JSON_SCHEMA }); } catch { fail('validation'); }
    const keys = new Set(['title', 'date', 'category', 'description', 'image', ...Object.keys(languages).flatMap(language => [`title_${language}`, `description_${language}`, `body_${language}`])]);
    if (!data || typeof data !== 'object' || Object.entries(data).some(([key, value]) => !keys.has(key) || typeof value !== 'string') || !data.title || !Number.isFinite(Date.parse(data.date))) fail('validation');
    safeUrl(data.image || '');
  } else {
    let data; try { data = JSON.parse(text); } catch { fail('validation'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail('validation');
    if (data.locales !== undefined) {
      if (!data.locales || typeof data.locales !== 'object' || Array.isArray(data.locales)) fail('validation');
      for (const [language, localized] of Object.entries(data.locales)) {
        if (!['nl','fr'].includes(language) || !localized || localized.locales !== undefined) fail('validation');
        validateContent(filename, Buffer.from(JSON.stringify(localized)).toString('base64'));
      }
    }
    const strings = (obj, keys) => obj && keys.every(key => typeof obj[key] === 'string');
    if (filename.endsWith('/home.json')) {
      if (!strings(data?.hero, ['eyebrow', 'title', 'description']) || !Array.isArray(data.news) || !Array.isArray(data.notices) || data.news.length > 100 || data.notices.length > 100) fail('validation');
      for (const card of data.news) { if (!strings(card, ['title', 'category', 'description', 'image', 'link'])) fail('validation'); safeUrl(card.link); safeUrl(card.image); }
      for (const notice of data.notices) if (!strings(notice, ['title', 'category', 'date', 'description', 'contact'])) fail('validation');
    } else if (!strings(data?.contact, ['email', 'area', 'heading', 'description']) || !['home', 'articles', 'contact'].every(key => strings(data?.seo?.[key], ['title', 'description']))) fail('validation');
  }
}
async function github(endpoint, options = {}) {
  const token = process.env.CMS_GITHUB_TOKEN;
  const repository = process.env.CMS_GITHUB_REPOSITORY || 'puczynskimaciej-debug/polacywbelgii';
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository)) fail('contentConfiguration', 503);
  const response = await fetch(`https://api.github.com/repos/${repository}${endpoint}`, {
    method: options.method || 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined, signal: AbortSignal.timeout(15000), redirect: 'error'
  });
  if (!response.ok) fail(response.status === 409 || response.status === 422 ? 'conflict' : response.status === 404 ? 'notFound' : 'contentUnavailable', response.status === 404 ? 404 : response.status === 409 || response.status === 422 ? 409 : 502);
  return response.status === 204 ? null : response.json();
}
module.exports = { allowedPath, validateContent, github };
