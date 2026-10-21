const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(resolve(__dirname, '../deploy/cloudflare-d1.sql'), 'utf8'));
db.exec(readFileSync(resolve(__dirname, '../deploy/cloudflare-d1-0002.sql'), 'utf8'));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
if (tables.length !== 9) throw new Error(`Expected 9 tables, found ${tables.length}`);
console.log(`D1 schema valid: ${tables.join(', ')}`);
