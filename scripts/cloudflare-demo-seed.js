// Prepare a repeatable D1 seed from the existing showcase migration.
// Output stays in .local; this script never connects to Cloudflare.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'netlify/database/migrations/20260930130000_showcase_ads/migration.sql'), 'utf8');
const matches = [...migration.matchAll(/INSERT INTO ad_orders\(id,data\) VALUES \('([^']+)','((?:[^']|'')*)'::jsonb\) ON CONFLICT \(id\) DO NOTHING;/g)];
if (matches.length !== 36) throw new Error(`Expected 36 showcase orders, found ${matches.length}`);

const rows = matches.map(([, id, value]) => {
  const data = JSON.parse(value.replace(/''/g, "'"));
  if (data.id !== id || data.demoSet !== 'showcase-2026-09-29' || data.source !== 'manual') throw new Error(`Unexpected showcase row ${id}`);
  return data;
});

const now = new Date().toISOString();
const startDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());
const endDate = new Date(Date.parse(startDate) + 29 * 86400000).toISOString().slice(0, 10);
for (const [index, type, description] of [
  [1, 'TOP', 'DEMO · Local restaurant. A sample offer for the Polish community in Belgium.'],
  [2, 'STANDARD', 'DEMO · Intercity transport. A sample listing for journeys across Belgium.'],
  [3, 'STANDARD', 'DEMO · Home renovations. A sample offer from a local business.'],
  [4, 'STANDARD', 'DEMO · Language lessons. A sample listing for newcomers to Belgium.'],
  [5, 'TOP', 'DEMO · LINGO language school. Small group French and Dutch lessons online and in Brussels.'],
  [6, 'STANDARD', 'DEMO · City bicycle for sale. A well-kept bike with a basket, available for pickup in Antwerp.'],
  [7, 'STANDARD', 'DEMO · Homemade cakes. Cheesecakes and celebration cakes made for family gatherings.'],
  [8, 'STANDARD', 'DEMO · Garden help. Lawn mowing, hedge trimming and seasonal tidy-ups near Ghent.'],
  [9, 'STANDARD', 'DEMO · Maths tutoring. Patient explanations and online exercises for students.'],
  [10, 'STANDARD', 'DEMO · Photography walk. Meet fellow enthusiasts and explore Brussels through your lens.'],
  [11, 'STANDARD', 'DEMO · Home cleaning. Regular cleaning and help after moving to a new place.'],
  [12, 'STANDARD', 'DEMO · Books looking for a home. Polish novels and children’s books for pickup in Leuven.']
]) rows.push({
  id: `0ef56b78-7d05-4cce-bd31-2b190f51eb4${index.toString(16)}`, version: 1, type, language: 'en',
  region: 'all', kind: 'text', source: 'manual', status: 'approved', paymentStatus: 'not_required',
  demoSet: 'showcase-2026-09-29', company: '', title: description.slice(0, 70), description,
  contact: 'demo@polacywbelgii.eu', customerName: '', email: 'demo@polacywbelgii.eu',
  phone: '', url: '', image: '', startDate, endDate, days: 30, dailyPrice: 0,
  totalPrice: 0, currency: 'EUR', createdAt: now, updatedAt: now
});

const quote = value => `'${value.replace(/'/g, "''")}'`;
const statements = [
  '-- Demonstration data only. Inserts missing rows; never updates or deletes existing data.',
  '-- Run against the D1 database bound to the production Pages project.',
  ...rows.map(data => `INSERT INTO ad_orders(id,data) VALUES (${quote(data.id)},${quote(JSON.stringify(data))}) ON CONFLICT(id) DO NOTHING;`)
];

const titles = { pl: 'Twoje miejsce w Belgii', fr: 'Votre place en Belgique', nl: 'Jouw plek in België', en: 'Your place in Belgium' };
for (const [language, title] of Object.entries(titles)) {
  const id = `0ef56b78-7d05-4cce-bd31-2b190f51eb5${{ pl: 1, fr: 2, nl: 3, en: 4 }[language]}`;
  const image = `data:image/png;base64,${fs.readFileSync(path.join(root, `.local/premium-${language}.png`)).toString('base64')}`;
  const imageMobile = `data:image/png;base64,${fs.readFileSync(path.join(root, `.local/premium-${language}-mobile.png`)).toString('base64')}`;
  const data = { id, version: 1, type: 'PREMIUM', language, region: 'all', kind: 'image',
    source: 'manual', status: 'approved', paymentStatus: 'not_required', demoSet: 'showcase-2026-09-29',
    company: 'Polacy w Belgii · DEMO', title, description: 'Przykładowa reklama PREMIUM',
    contact: 'Reklama demonstracyjna', customerName: 'Polacy w Belgii',
    email: 'demo@polacywbelgii.eu', phone: '', url: 'https://www.polacywbelgii.eu/',
    image, imageMobile, startDate, endDate, days: 30, dailyPrice: 0, totalPrice: 0,
    currency: 'EUR', createdAt: now, updatedAt: now };
  statements.push(`INSERT INTO ad_orders(id,data) SELECT ${quote(id)},${quote(JSON.stringify({ ...data, image: '', imageMobile: '' }))} WHERE NOT EXISTS (SELECT 1 FROM ad_orders WHERE json_extract(data,'$.language')=${quote(language)} AND json_extract(data,'$.type')='PREMIUM' AND json_extract(data,'$.status') IN ('pending','approved') AND json_extract(data,'$.endDate') >= date('now')) ON CONFLICT(id) DO NOTHING;`);
  for (const [field, content] of Object.entries({ image, imageMobile })) {
    let length = 0;
    for (let offset = 0; offset < content.length; offset += 24000) {
      const chunk = content.slice(offset, offset + 24000);
      statements.push(`UPDATE ad_orders SET data=json_set(data,'$.${field}',json_extract(data,'$.${field}')||${quote(chunk)}) WHERE id=${quote(id)} AND length(json_extract(data,'$.${field}'))=${length};`);
      length += chunk.length;
    }
  }
}

const output = path.join(root, '.local/cloudflare-demo-seed.sql');
fs.writeFileSync(output, statements.join('\n') + '\n');
console.log(`Prepared ${rows.length} showcase orders and 4 conditional PREMIUM banners in ${output}`);
