// Generate an insert-only D1 seed for the CMS configuration checked into this release.
// Review target D1 and take a verified backup before executing the generated SQL remotely.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const output = process.argv[2];
if (!output || !/\.sql$/.test(output)) throw new Error('Usage: node scripts/prepare-cms-config-seed.mjs <private-output.sql>');
const paths = ['src/_data/home.json','src/_data/site.json'];
const statements = [];
for (const path of paths) {
  const data = readFileSync(path);
  JSON.parse(data.toString('utf8'));
  const sha = createHash('sha256').update(data.toString('base64')).digest('hex');
  const b64 = data.toString('base64');
  const timestamp = new Date().toISOString();
  statements.push(`INSERT INTO cms_content(path,sha,kind,status,created_at,updated_at,updated_by) SELECT '${path}','${sha}','config','published','${timestamp}','${timestamp}','release-seed' WHERE NOT EXISTS (SELECT 1 FROM cms_content WHERE path='${path}');`);
  statements.push(`INSERT INTO cms_content_chunks(path,position,content) SELECT '${path}',0,'${b64}' WHERE EXISTS (SELECT 1 FROM cms_content WHERE path='${path}' AND updated_by='release-seed' AND sha='${sha}') AND NOT EXISTS (SELECT 1 FROM cms_content_chunks WHERE path='${path}');`);
}
writeFileSync(output, `${statements.join('\n')}\n`, { flag:'wx', mode:0o600 });
console.log(`Prepared insert-only CMS configuration seed for ${paths.length} paths.`);
