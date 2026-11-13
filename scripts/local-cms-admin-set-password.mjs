import { hashPassword } from '../cloudflare/auth.mjs';
import { openLocalDb } from '../agent/local-db.mjs';

let raw='';
for await(const chunk of process.stdin){raw+=chunk;if(raw.length>1000)throw new Error('Input is too long');}
const input=JSON.parse(raw);
if(input.email!=='kontakt@polacywbelgii.eu' || typeof input.password!=='string' || input.password.length<15 || input.password.length>128)throw new Error('Valid local administrator password required');
const db=openLocalDb();
try{
  const account=db.prepare('SELECT id FROM cms_users WHERE email=? AND role=? AND active=1').get(input.email,'admin');
  if(!account)throw new Error('Local administrator account is unavailable');
  const hash=await hashPassword(input.password);
  db.exec('BEGIN');
  try{
    db.prepare('UPDATE cms_users SET password_hash=?,must_change_password=0,version=version+1 WHERE id=?').run(hash,account.id);
    db.prepare('DELETE FROM cms_sessions WHERE user_id=?').run(account.id);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  console.log('Local administrator password updated.');
}finally{db.close();}
