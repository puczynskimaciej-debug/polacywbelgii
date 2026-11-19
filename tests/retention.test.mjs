import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';
import { runRetention } from '../cloudflare/retention.mjs';
const bundled = await esbuild.build({entryPoints:['functions/api/retention.js'],bundle:true,platform:'neutral',format:'esm',write:false});
const { onRequest: retentionRequest } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['deploy/cloudflare-d1.sql','deploy/cloudflare-d1-0002.sql','deploy/cloudflare-d1-0003-stripe.sql','agent/migrations/005_chat.sql','agent/migrations/008_ai_conversations.sql','deploy/cloudflare-d1-0004-retention.sql','deploy/cloudflare-d1-0005-security-log-holds.sql']) sqlite.exec(readFileSync(file,'utf8'));
  const statement = (sql,values=[]) => ({
    bind(...next) { return statement(sql,next); },
    first() { return Promise.resolve(sqlite.prepare(sql).get(...values) || null); },
    all() { return Promise.resolve({results:sqlite.prepare(sql).all(...values)}); },
    run() { const result=sqlite.prepare(sql).run(...values); return Promise.resolve({meta:{changes:Number(result.changes)}}); }
  });
  return {
    sqlite,
    prepare:sql=>statement(sql),
    batch:async statements=>{
      sqlite.exec('BEGIN');
      try { const results=[]; for(const entry of statements) results.push(await entry.run()); sqlite.exec('COMMIT'); return results; }
      catch(error){ sqlite.exec('ROLLBACK'); throw error; }
    }
  };
}

test('retention dry run, holds, closed cases, legal preservation and idempotency', async()=>{
  const db=database(), at='2026-11-16T13:00:00.000Z', old='2024-01-01T00:00:00.000Z';
  const insert=(sql,...values)=>db.sqlite.prepare(sql).run(...values);
  const user='11111111-1111-4111-8111-111111111111';
  insert("INSERT INTO cms_users(id,email,name,password_hash,role) VALUES(?,?,?,'hash','admin')",user,'admin@example.invalid','Example');
  for(const [id,closed] of [['contact-old',old],['contact-open',null],['contact-held',old]]) insert('INSERT INTO contact_messages(id,name,email,subject,message,ip_hash,created_at,closed_at) VALUES(?,?,?,?,?,?,?,?)',id,'Synthetic','synthetic@example.invalid','Synthetic','Synthetic','hash',old,closed);
  insert("INSERT INTO retention_holds(entity_type,entity_id,reason_code) VALUES('contact','contact-held','complaint')");
  for(const [id,conversation] of [['entry-old','conv-old'],['entry-running','conv-running'],['entry-held','conv-held']]) insert('INSERT INTO ai_chat_entries(id,conversation_id,actor_id,role,body,created_at) VALUES(?,?,?,\'admin\',\'Synthetic\',?)',id,conversation,user,old);
  for(const [conversation,job] of [['conv-old','old-version-job'],['conv-running','running-version-job'],['conv-held','held-version-job']]) insert('INSERT INTO ai_chat_versions(conversation_id,candidate_id,job_id,version,title,description,body,sources_json,created_at) VALUES(?,?,?,1,?,?,?,?,?)',conversation,'candidate',job,'Synthetic','Synthetic','Synthetic','[]',old);
  insert("INSERT INTO ai_chat_jobs(id,conversation_id,actor_id,prompt,status,created_at,updated_at) VALUES('job-running','conv-running',?,'Synthetic','running',?,?)",user,old,old);
  insert("INSERT INTO retention_holds(entity_type,entity_id,reason_code) VALUES('ai_conversation','conv-held','dispute')");
  insert('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)','expired-session',user,old);
  insert('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)','fresh-session',user,'2026-11-17T00:00:00.000Z');
  insert('INSERT INTO cms_login_limits(key,started_at,attempts) VALUES(?,?,1)','old-limit',old);
  insert('INSERT INTO cms_audit(actor_id,action,target,created_at) VALUES(?,?,?,?)',user,'login',user,old);
  const order=(id,changes={})=>JSON.stringify({id,groupId:id,status:'cancelled',paymentStatus:'unpaid',retentionClosedAt:old,createdAt:old,...changes});
  for(const [id,data] of [['unpaid-old',order('unpaid-old')],['unpaid-held',order('unpaid-held')],['paid-old',order('paid-old',{paymentStatus:'paid',status:'approved',actualEndAt:old,retentionUntil:old})],['open-order',order('open-order',{status:'pending'})]]) insert('INSERT INTO ad_orders(id,data,created_at) VALUES(?,?,?)',id,data,old);
  insert("INSERT INTO ad_order_history(order_id,action,created_at) VALUES('unpaid-old','Synthetic',?)",old);
  insert("INSERT INTO ad_payment_events(id,event_type,group_id,received_at,payload_json) VALUES('paid-event','synthetic','paid-old',?,'{}')",old);
  insert("INSERT INTO retention_holds(entity_type,entity_id,reason_code) VALUES('ad_group','unpaid-held','dispute')");
  const env={DB:db,RETENTION_ENABLED:'1',RETENTION_SCOPE:'test'};
  const before=db.sqlite.prepare('SELECT count(*) n FROM contact_messages').get().n;
  const preview=await runRetention(env,{dryRun:true,at});
  assert.equal(preview.counts.contact,1);
  assert.equal(preview.counts.ai_history,2);
  assert.equal(preview.counts.sessions,1);
  assert.equal(preview.counts.unpaid_orders,1);
  assert.equal(preview.counts.paid_orders,0);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM contact_messages').get().n,before);
  const first=await runRetention(env,{at});
  assert.equal(first.status,'completed');
  assert.equal(first.counts.contact,1);
  assert.equal(first.counts.unpaid_orders,1);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM ad_order_history WHERE order_id='unpaid-old'").get().n,0);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM ad_orders WHERE id='paid-old'").get().n,1);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM ad_payment_events WHERE group_id='paid-old'").get().n,1);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM contact_messages WHERE id='contact-held'").get().n,1);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM ai_chat_entries WHERE id='entry-running'").get().n,1);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM ai_chat_versions WHERE conversation_id='conv-old'").get().n,0);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM ai_chat_versions WHERE conversation_id='conv-held'").get().n,1);
  assert.deepEqual(db.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  const again=await runRetention(env,{at});
  assert.equal(again.counts.contact,0);
  assert.equal(again.counts.unpaid_orders,0);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM retention_runs').get().n,2);
  assert.ok(!db.sqlite.prepare('SELECT counts_json FROM retention_runs LIMIT 1').get().counts_json.includes('synthetic@example.invalid'));
  insert("UPDATE retention_policy SET enabled=1,period_days=365 WHERE category='paid_orders'");
  const paid=await runRetention(env,{at});
  assert.equal(paid.counts.paid_orders,1);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM ad_payment_events WHERE group_id='paid-old'").get().n,0);
  db.sqlite.close();
});

test('concurrent run is refused and production remains disabled',async()=>{
  const db=database(),env={DB:db,RETENTION_ENABLED:'1',RETENTION_SCOPE:'test'};
  db.sqlite.prepare("UPDATE retention_lock SET owner='other',expires_at='2026-11-17T00:00:00.000Z'").run();
  assert.deepEqual(await runRetention(env,{at:'2026-11-16T13:00:00.000Z'}),{status:'already_running'});
  await assert.rejects(runRetention({...env,RETENTION_SCOPE:'production'}),/retention_disabled/);
  db.sqlite.close();
});

test('administrator-only dry run and case controls use the real API handler',async()=>{
  const db=database();
  const id='11111111-1111-4111-8111-111111111111', contactId='22222222-2222-4222-8222-222222222222';
  db.sqlite.prepare("INSERT INTO cms_users(id,email,name,password_hash,role,must_change_password) VALUES(?,?,?,'hash','admin',0)").run(id,'admin@example.invalid','Example');
  db.sqlite.prepare("INSERT INTO contact_messages(id,name,email,subject,message,ip_hash) VALUES(?,'Synthetic','synthetic@example.invalid','Synthetic','Synthetic','hash')").run(contactId);
  const value='A'.repeat(43),hash=createHash('sha256').update(value).digest('hex');
  db.sqlite.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash,id,'2099-01-01T00:00:00.000Z');
  const env={DB:db};
  const anonymous=await retentionRequest({request:new Request('https://test.example/api/retention'),env});
  assert.equal(anonymous.status,401);
  const cookie=`__Host-pbe_session=${value}`;
  const dry=await retentionRequest({request:new Request('https://test.example/api/retention',{headers:{cookie}}),env});
  assert.equal(dry.status,200);
  assert.equal((await dry.json()).dryRun,true);
  const close=await retentionRequest({request:new Request('https://test.example/api/retention',{method:'POST',headers:{cookie,origin:'https://test.example','content-type':'application/json'},body:JSON.stringify({action:'close-contact',id:contactId})}),env});
  assert.equal(close.status,200);
  assert.ok(db.sqlite.prepare('SELECT closed_at FROM contact_messages WHERE id=?').get(contactId).closed_at);
  const hold=await retentionRequest({request:new Request('https://test.example/api/retention',{method:'POST',headers:{cookie,origin:'https://test.example','content-type':'application/json'},body:JSON.stringify({action:'hold',entityType:'contact',entityId:contactId,reasonCode:'complaint'})}),env});
  assert.equal(hold.status,200);
  assert.equal(db.sqlite.prepare('SELECT reason_code FROM retention_holds WHERE entity_id=?').get(contactId).reason_code,'complaint');
  const call=body=>retentionRequest({request:new Request('https://test.example/api/retention',{method:'POST',headers:{cookie,origin:'https://test.example','content-type':'application/json'},body:JSON.stringify(body)}),env});
  assert.equal((await call({action:'hold-security-logs',reasonCode:'incident',startAt:'2025-01-02T00:00:00.000Z',endAt:'2025-01-01T00:00:00.000Z'})).status,400);
  const created=await call({action:'hold-security-logs',reasonCode:'legal_evidence',startAt:'2025-01-01T00:00:00.000Z'});
  assert.equal(created.status,200);
  const holdId=(await created.json()).id;
  assert.equal(db.sqlite.prepare('SELECT reason_code FROM security_log_holds WHERE id=?').get(holdId).reason_code,'legal_evidence');
  assert.equal((await call({action:'release-security-hold',id:holdId})).status,200);
  assert.equal((await call({action:'release-security-hold',id:holdId})).status,404);
  db.sqlite.close();
});

test('incident range protects old security logs until release, including interleaved hold',async()=>{
  const db=database(),at='2026-11-16T13:00:00.000Z',old='2024-01-01T00:00:00.000Z';
  db.sqlite.prepare('INSERT INTO cms_login_limits(key,started_at,attempts) VALUES(?,?,1)').run('held-limit',old);
  db.sqlite.prepare('INSERT INTO ad_rate_limits(key,started_at,attempts) VALUES(?,?,1)').run('held-ad-limit',old);
  db.sqlite.prepare("INSERT INTO cms_audit(action,target,created_at) VALUES('test','synthetic',?)").run(old);
  db.sqlite.prepare("INSERT INTO security_log_holds(id,reason_code,start_at,end_at) VALUES('incident-1','incident','2023-12-31T00:00:00.000Z','2024-01-02T00:00:00.000Z')").run();
  const env={DB:db,RETENTION_ENABLED:'1',RETENTION_SCOPE:'test'};
  assert.equal((await runRetention(env,{dryRun:true,at})).counts.security_logs,0);
  assert.equal((await runRetention(env,{at})).counts.security_logs,0);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM cms_audit').get().n,1);
  db.sqlite.prepare("UPDATE security_log_holds SET released_at='2026-11-16T12:00:00.000Z' WHERE id='incident-1'").run();
  assert.equal((await runRetention(env,{dryRun:true,at})).counts.security_logs,3);
  let injected=false;
  const prepare=db.prepare;
  db.prepare=sql=>{
    if(!injected && sql.startsWith('DELETE FROM cms_audit WHERE')){
      injected=true;
      db.sqlite.prepare("INSERT INTO security_log_holds(id,reason_code,start_at) VALUES('incident-2','legal_evidence','2023-12-31T00:00:00.000Z')").run();
    }
    return prepare(sql);
  };
  const result=await runRetention(env,{at});
  assert.equal(injected,true);
  assert.equal(result.counts.security_logs,2);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM cms_audit').get().n,1);
  assert.deepEqual(db.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  db.sqlite.prepare("UPDATE security_log_holds SET released_at='2026-11-16T12:30:00.000Z' WHERE id='incident-2'").run();
  assert.equal((await runRetention(env,{at})).counts.security_logs,1);
  db.sqlite.close();
});

test('failed retention run journals a safe code and releases the lease',async()=>{
  const db=database(),env={DB:db,RETENTION_ENABLED:'1',RETENTION_SCOPE:'test'};
  db.sqlite.prepare("UPDATE retention_policy SET period_days=NULL,enabled=1 WHERE category='contact'").run();
  await assert.rejects(runRetention(env,{at:'2026-11-16T13:00:00.000Z'}),/retention_error/);
  const run=db.sqlite.prepare('SELECT status,error_code,counts_json FROM retention_runs').get();
  assert.equal(run.status,'failed');
  assert.equal(run.error_code,'retention_error');
  assert.equal(db.sqlite.prepare('SELECT owner FROM retention_lock WHERE id=1').get().owner,'');
  db.sqlite.close();
});
