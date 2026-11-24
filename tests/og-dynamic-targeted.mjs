import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {localD1Path} from '../agent/local-db.mjs';

const db=new DatabaseSync(localD1Path());
const now='2026-11-24T12:00:00Z';
const ids=[randomBytes(10).toString('hex'),randomBytes(10).toString('hex')];
const candidates=[
  {id:ids[0],kind:'article',title:'Polski artykuł',description:'Polski opis artykułu',body:'Polska treść',category:'Poradnik',event:null,fields:{image:'/images/hero.jpg',image_nl:'/images/social-home.png',title_nl:'Nederlands artikel',description_nl:'Nederlandse beschrijving',title_fr:'Article français',description_fr:'Description française'}},
  {id:ids[1],kind:'event',title:'Polskie wydarzenie',description:'Polski opis wydarzenia',body:'Polska treść wydarzenia',category:'Kultura',event:{date:'2026-12-12',start:null,endDate:null,end:null,timezone:'Europe/Brussels',region:'brussels',city:'Bruksela',venue:'Test',organizer:'Test',sourceUrl:'https://example.org',status:'scheduled'},fields:{image:'/images/hero.jpg',title_nl:'Nederlands evenement',description_nl:'Nederlandse evenementbeschrijving',title_fr:'Événement français',description_fr:'Description française de l’événement'}}
];
const meta=(html,name)=>new RegExp(`<meta property="${name}" content="([^"]*)">`).exec(html)?.[1];
try {
  for(const row of candidates) {
    db.prepare('INSERT INTO ai_candidates(id,kind,status,title,description,body,category,region,sources_json,verification_json,event_json,article_fields_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(row.id,row.kind,'published',row.title,row.description,row.body,row.category,'brussels','[]',JSON.stringify({status:'verified'}),row.event?JSON.stringify(row.event):null,JSON.stringify(row.fields),now,now);
    db.prepare("INSERT INTO ai_editorial(candidate_id,status,owner_kind,owner_id,approved_by,approved_at,published_at,public_state,updated_at) VALUES(?,'published','admin','fixture','fixture',?,?,'visible',?)").run(row.id,now,now,now);
  }
  for(const row of candidates)for(const language of ['pl','nl','fr']) {
    const path=`/${row.kind==='event'?'wydarzenia':'artykuly'}/ai-${row.id}/`;
    const suffix=language==='pl'?'':`?lang=${language}`;
    const response=await fetch(`http://127.0.0.1:8080${path}${suffix}`);
    assert.equal(response.status,200);
    const html=await response.text();
    const expectedTitle=language==='pl'?row.title:row.fields[`title_${language}`];
    const expectedDescription=language==='pl'?row.description:row.fields[`description_${language}`];
    assert.equal(meta(html,'og:title'),expectedTitle);
    assert.equal(meta(html,'og:description'),expectedDescription);
    assert.equal(meta(html,'og:locale'),language==='pl'?'pl_PL':language==='nl'?'nl_BE':'fr_BE');
    assert.equal(meta(html,'og:url'),`https://www.polacywbelgii.eu${path}${suffix}`);
    const image=language==='nl'&&row.kind==='article'?'/images/social-home.png':'/images/hero.jpg';
    assert.equal(meta(html,'og:image'),`https://www.polacywbelgii.eu${image}`);
    assert.ok(!/<img[^>]+src="\/images\/flags\//.test(html));
    assert.match(html,/<img[^>]+src="\/images\/hero\.jpg"/);
    assert.ok(!html.includes('%%OG_'));
  }
  console.log('OG artykułów i wydarzeń PL/NL/FR bez JavaScriptu: OK');
} finally {
  for(const id of ids) {
    db.prepare('DELETE FROM ai_editorial WHERE candidate_id=?').run(id);
    db.prepare('DELETE FROM ai_candidates WHERE id=?').run(id);
  }
  db.close();
}
