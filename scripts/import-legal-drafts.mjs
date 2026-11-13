import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Podaj lokalną ścieżkę do pełnego tekstu bazowego.');
const text = readFileSync(source,'utf8');
const specs = [
  ['DOKUMENT 1','regulamin','Regulamin portalu'],
  ['DOKUMENT 2','regulamin-ogloszen','Regulamin płatnych ogłoszeń'],
  ['DOKUMENT 3','polityka-prywatnosci','Polityka prywatności'],
  ['DOKUMENT 4','polityka-cookies','Polityka cookies']
];
for (let index=0;index<specs.length;index++) {
  const [marker,slug,title] = specs[index];
  const start = text.indexOf(`# ${marker} — `);
  const next = index+1<specs.length ? text.indexOf(`# ${specs[index+1][0]} — `,start+1) : text.indexOf('\n# ZADANIE 7',start+1);
  if (start<0 || next<0) throw new Error(`Nie znaleziono pełnej sekcji ${marker}`);
  let body = text.slice(start,next).replace(/^# .+\r?\n/,'').replace(/\n---\s*$/,'').trim();
  body = body.split(/\r?\n/).filter(line => !/^(UWAGA WDROŻENIOWA:|Nie należy deklarować|Podstawy prawne należy|Przed publikacją|Przed opublikowaniem|Uzupełnij dokument o:|Nie wpisuj fikcyjnych|Nie deklaruj, że portal|Przed uruchomieniem)/.test(line) && !/^- (Nazwę technologii|Dostawcę\.|Cel\.|Okres działania|Kategorię\.|Informację, czy wymaga zgody)/.test(line)).join('\n').trim();
  const legalKey = { regulamin:'legal.portal','regulamin-ogloszen':'legal.ads','polityka-prywatnosci':'legal.privacy','polityka-cookies':'legal.cookies' }[slug];
  const front = `---\nlayout: legal.njk\ntitle: ${title}\ndescription: Projekt dokumentu ${title.toLowerCase()} PolacywBelgii.eu.\npageKey: legal\nlegalKey: ${legalKey}\npermalink: /${slug}/index.html\n---\n\n`;
  writeFileSync(join('src',`${slug}.md`),front+body+'\n');
  process.stdout.write(`${slug}: ${body.length} znaków\n`);
}
