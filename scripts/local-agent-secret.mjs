import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root,'.dev.vars');
if (!fs.existsSync(file)) {
  fs.writeFileSync(file,`AGENT_SERVICE_TOKEN=${randomBytes(32).toString('base64url')}\n`,{ flag:'wx', mode:0o600 });
  console.log('Created ignored local .dev.vars with AGENT_SERVICE_TOKEN');
} else if (!/^AGENT_SERVICE_TOKEN=[A-Za-z0-9_-]{32,}$/m.test(fs.readFileSync(file,'utf8'))) {
  throw new Error('Add AGENT_SERVICE_TOKEN to existing .dev.vars without overwriting its other secrets');
} else console.log('Existing local AGENT_SERVICE_TOKEN is configured');
