const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const MarkdownIt = require('markdown-it');
const { validateContent } = require('../server/cms-content');

const slug = process.argv[2];
if (!slug || !/^[a-z0-9-]{1,90}$/.test(slug)) {
  console.error('Użycie: node scripts/preview-article-draft.js <slug>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const source = path.join(root, '.local', 'drafts', `${slug}.md`);
const text = fs.readFileSync(source, 'utf8');
validateContent(`src/content/articles/${slug}.md`, Buffer.from(text).toString('base64'));
const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
const data = yaml.load(match[1]);
const body = text.slice(match[0].length);
const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="${escape(data.description)}"><title>Szkic: ${escape(data.title)}</title><style>body{font:18px/1.65 system-ui,sans-serif;color:#182638;background:#f7f9fc;margin:0}main{max-width:780px;margin:36px auto;padding:36px;background:white}h1,h2{line-height:1.2}h1{font-size:2.25rem}h2{margin-top:2rem}.draft{display:inline-block;background:#ffe6a7;padding:4px 10px;border-radius:6px;font-weight:700}a{color:#075ba0}p{margin:1.1rem 0}@media(max-width:700px){main{margin:0;padding:22px}}</style></head><body><main><span class="draft">SZKIC LOKALNY</span><h1>${escape(data.title)}</h1><p><strong>${escape(data.description)}</strong></p>${new MarkdownIt({ html: false, linkify: true, typographer: true }).render(body)}</main></body></html>`;
const output = path.join(root, '.local', 'preview', `${slug}.html`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html, 'utf8');
console.log(output);
