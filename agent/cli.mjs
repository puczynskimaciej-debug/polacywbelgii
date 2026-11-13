import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processItems, parseFeed, parseHtmlLinks } from './core.mjs';
import { defaultEditorialConfig } from './editorial.mjs';
import { openLocalDb, syncLocalState, loadLocalState } from './local-db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const fixture = args.has('--fixture');
const dryRun = args.has('--dry-run');
const statePath = path.join(root, '.local', 'agent', 'fixture-state.json');
const sources = JSON.parse(await fs.readFile(path.join(root, 'agent', 'sources.json'), 'utf8'));
const db = fixture ? null : openLocalDb();
const state = fixture ? await fs.readFile(statePath, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return { items: [], drafts: [], runs: [], sources };
  throw error;
}) : loadLocalState(db, sources);
if (!fixture && !dryRun && state.runs?.length && Date.now() - Date.parse(state.runs.at(-1).at) < 6 * 3600000) throw new Error('Agent runs at most once every six hours');
let items = [];
const errors = [];
if (fixture) {
  items = JSON.parse(await fs.readFile(path.join(root, 'agent', 'fixtures.json'), 'utf8'));
} else {
  for (const source of sources.filter(entry => entry.active && ['rss', 'atom', 'html'].includes(entry.type))) {
    try {
      const target = new URL(source.url);
      if (target.protocol !== 'https:' || target.username || target.password || /^(localhost|127\.|10\.|192\.168\.)/.test(target.hostname)) throw new Error('unsafe source');
      const response = await fetch(source.url, { headers: { Accept: source.type === 'html' ? 'text/html' : 'application/rss+xml, application/atom+xml, application/xml' }, signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok || Number(response.headers.get('content-length')) > 1_000_000) throw new Error('feed unavailable');
      const content = await response.text();
      items.push(...(source.type === 'html' ? parseHtmlLinks(content, source) : parseFeed(content, source)));
    } catch (error) { errors.push({ sourceId: source.id, code: error.message }); }
  }
}
const config = db ? JSON.parse(db.prepare("SELECT value_json FROM ai_config WHERE key='editorial'").get()?.value_json || JSON.stringify(defaultEditorialConfig)) : defaultEditorialConfig;
const pendingInD1 = db ? db.prepare("SELECT count(*) AS n FROM ai_editorial WHERE status='pending_review'").get().n : 0;
const pendingInState = (state.drafts || []).filter(entry => entry.status === 'pending_review').length;
const result = processItems(items, state, { dryRun, maxPending: Math.max(pendingInState, config.maxPending - pendingInD1 + pendingInState) });
result.report.errors.push(...errors);
if (!dryRun) {
  const output = { ...result.state, sources };
  output.runs.at(-1).errors.push(...errors);
  if (fixture) {
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    const temp = `${statePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(output, null, 2) + '\n');
    await fs.rename(temp, statePath);
  } else syncLocalState(db,output);
}
db?.close();
console.log(JSON.stringify(result.report, null, 2));
