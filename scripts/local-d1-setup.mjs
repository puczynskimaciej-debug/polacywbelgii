import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const persist = path.join(root,'.local','wrangler');
const wrangler = path.join(root,'node_modules','wrangler','bin','wrangler.js');
const migrations = ['deploy/cloudflare-d1.sql','deploy/cloudflare-d1-0002.sql','deploy/cloudflare-d1-0003-stripe.sql','agent/migrations/001_agent.sql','agent/migrations/002_editorial.sql','agent/migrations/003_content.sql','agent/migrations/004_discovery.sql','agent/migrations/005_chat.sql','agent/migrations/006_article_fields.sql','agent/migrations/007_article_publication.sql','agent/migrations/008_ai_conversations.sql'];
fs.mkdirSync(persist,{ recursive:true });
for (const file of migrations) {
  execFileSync(process.execPath,[wrangler,'d1','execute','DB','--local','--persist-to',persist,'--file',path.join(root,file)],{ cwd:root, stdio:'pipe' });
  console.log(`Applied local D1: ${file}`);
}
