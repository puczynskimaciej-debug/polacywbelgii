const readline = require('node:readline');
const { createInterface } = require('node:readline/promises');
const { randomUUID } = require('node:crypto');
const { database } = require('../server/ads-store');
const auth = require('../server/cms-auth');
async function secret(prompt) {
  process.stdout.write(prompt); readline.emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    function finish(error) { process.stdin.off('keypress', onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); if (error) reject(error); else resolve(value); }
    function onKey(text, key = {}) {
      if (key.ctrl && key.name === 'c') return finish(new Error('Przerwano.'));
      if (key.name === 'return') return finish();
      if (key.name === 'backspace') { value = [...value].slice(0, -1).join(''); return; }
      if (text && !key.ctrl && !key.meta && ![...text].some(char => char.codePointAt(0) < 32 || char.codePointAt(0) === 127)) value += text;
    }
    process.stdin.on('keypress', onKey);
  });
}
async function main() {
  if (!process.stdin.isTTY) throw new Error('Uruchom w interaktywnym terminalu. Hasło nie jest pobierane z argumentów ani plików.');
  const resetting = process.argv.includes('--reset');
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const email = auth.email(await terminal.question('E-mail konta: '));
  const name = resetting ? null : auth.name(await terminal.question('Imię i nazwisko administratora: '));
  terminal.close();
  const password = await secret('Nowe hasło (15–128 znaków, niewidoczne podczas wpisywania): ');
  if (password !== await secret('Powtórz hasło: ')) throw new Error('Hasła nie są zgodne.');
  const hash = await auth.hashPassword(password);
  const pool = database();
  try {
    await auth.transaction(async client => {
      if (resetting) {
        const result = await client.query('UPDATE cms_users SET password_hash=$1,must_change_password=true,version=version+1 WHERE email=$2 RETURNING id', [hash, email]);
        if (!result.rowCount) throw new Error('Nie znaleziono konta.');
        await client.query('DELETE FROM cms_sessions WHERE user_id=$1', [result.rows[0].id]);
        await auth.audit(client, null, 'cli-password-reset', result.rows[0].id);
      } else {
        const { rows: [count] } = await client.query('SELECT count(*)::integer AS total FROM cms_users');
        if (count.total) throw new Error('Pierwsze konto już istnieje. Kolejne osoby dodaj w CMS, a odzyskanie hasła uruchom przez cms:reset-password.');
        const id = randomUUID();
        await client.query("INSERT INTO cms_users(id,email,name,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,'admin',false)", [id, email, name, hash]);
        await auth.audit(client, null, 'bootstrap-admin', id);
      }
    });
    console.log(resetting ? 'Hasło zmienione. Dotychczasowe sesje unieważnione.' : 'Konto administratora utworzone. Możesz zalogować się w /admin/.');
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message === 'passwordLength' ? 'Hasło musi mieć od 15 do 128 znaków.' : error.code || error.message); process.exitCode = 1; });
