import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import worker from '../worker/index.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
class D1 {
 constructor(sql){this.db=new DatabaseSync(':memory:');this.db.exec(sql);}
 prepare(sql){const db=this.db;let values=[];return {bind(...args){values=args;return this;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},async run(){const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)},results:[]};},execute(){const stmt=db.prepare(sql);const rows=stmt.columns().length?stmt.all(...values):null;const changes=rows?0:Number(stmt.run(...values).changes);return {results:rows||[],meta:{changes}};}};}
 async batch(stmts){this.db.exec('BEGIN');try{const out=stmts.map(s=>s.execute());this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
class R2 {constructor(){this.objects=new Map();}async put(k,b,o){this.objects.set(k,{bytes:new Uint8Array(b),...o});}async get(k){const obj=this.objects.get(k);return obj?{size:obj.bytes.length,body:new Blob([obj.bytes]).stream(),httpMetadata:obj.httpMetadata,arrayBuffer:async()=>obj.bytes.buffer}:null;}async head(k){return this.get(k);}}
async function fixture(){const env={SITE_ORIGIN:'https://circle.test',BOOTSTRAP_ADMIN_EMAIL:'admin@test.example',BACKUP_TOKEN:'backup-test',RESTORE_TOKEN:'restore-test',DB:new D1(await readFile(new URL('../migrations/0001_circle.sql',import.meta.url),'utf8')),MEDIA:new R2()};for(const [id,role]of [['one','member'],['two','member'],['root','admin']]){await env.DB.prepare('INSERT INTO members(id,email,nickname,role,active,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').bind(id,id+'@example.test',id,role,new Date().toISOString(),new Date().toISOString()).run();await env.DB.prepare('INSERT INTO sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(digest(id),id,Date.now()+86400000).run();}return env;}
async function call(env,path,user='one',method='GET',body,headers={}){const request=new Request(env.SITE_ORIGIN+'/api'+path,{method,headers:{Origin:env.SITE_ORIGIN,...(user?{Cookie:'circle_session='+user}:{}),'Content-Type':'application/json',...headers},...(body!==undefined?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{})});const response=await worker.fetch(request,env);let data;if(response.headers.get('Content-Type')?.includes('json'))data=await response.json();return {status:response.status,data,response};}
test('real SQLite: invite gate, ownership, directional affection, approval, comments, media, soft delete, revision restore',async()=>{
 const env=await fixture();try{
 assert.equal((await call(env,'/data',null)).status,401);
 assert.equal((await call(env,'/characters','one','POST',{name:'마법사 A',faction:'mage'})).status,200);
 const a=(await call(env,'/data')).data.characters[0];const b=(await call(env,'/characters','two','POST',{name:'템플러 B',faction:'templar'})).data;
 assert.equal((await call(env,'/characters','two','POST',{...a,name:'탈취'})).status,403);
 assert.equal((await call(env,'/characters','one','POST',{...a,name:'A 수정'})).status,200);
 assert.equal((await call(env,'/characters','one','POST',{...a,name:'오래된 덮어쓰기'})).status,409);
 assert.equal((await call(env,'/affection','one','POST',{source_id:a.id,target_id:b.id,value:75,note:'신뢰'})).status,200);
 assert.equal((await call(env,'/affection','two','POST',{source_id:b.id,target_id:a.id,value:25})).status,200);
 assert.equal((await call(env,'/affection','two','POST',{source_id:a.id,target_id:b.id,value:100})).status,403);
 const r=(await call(env,'/relationships','one','POST',{source_id:a.id,target_id:b.id,name:'비밀 동맹',kind:'동료',status:'approved'})).data;assert.equal(r.status,'pending');
 assert.equal((await call(env,'/relationships','one','POST',{...r,status:'approved'})).status,403);
 const approved=(await call(env,'/relationships','two','POST',{...r,status:'approved'})).data;assert.equal(approved.status,'approved');
 const revised=(await call(env,'/relationships','one','POST',{...approved,description:'다시 동의받을 설명'})).data;assert.equal(revised.status,'pending');
 const c=(await call(env,'/comments','two','POST',{target_id:a.id,character_id:b.id,body:'안녕하세요'})).data;assert.equal(c.character_id,b.id);
 assert.equal((await call(env,'/comments','one','POST',{target_id:a.id,character_id:b.id,body:'대리 작성'})).status,403);
 assert.equal((await call(env,'/posts','one','POST',{title:'공지 위장',category:'notice'})).status,403);
 assert.equal((await call(env,'/upload','one','POST',new Uint8Array([137,80,78,71]),{'Content-Type':'image/png'})).status,400);
 const p=(await call(env,'/posts','one','POST',{title:'이야기',category:'story',character_id:a.id,character_ids:[a.id,b.id]})).data;
 assert.deepEqual(p.character_ids,[a.id,b.id]);
 assert.equal((await call(env,'/comments','two','POST',{post_id:p.id,parent_id:c.id,body:'다른 위치 답글'})).status,400);
 const bytes=new TextEncoder().encode('RIFF0000WEBPVP8 test');const upload=(await call(env,'/upload','one','POST',bytes,{'Content-Type':'image/webp'})).data;
 assert.equal((await call(env,'/files/'+encodeURIComponent(upload.path),null)).status,401);
 assert.equal((await call(env,'/files/'+encodeURIComponent(upload.path),'two')).status,200);
 assert.equal((await call(env,'/media','two','POST',{path:upload.path})).status,403);
 assert.equal((await call(env,'/media','one','POST',{path:upload.path,character_id:a.id})).status,200);
 assert.equal((await call(env,'/characters/'+b.id,'one','DELETE')).status,403);
 assert.equal((await call(env,'/characters/'+b.id,'two','DELETE')).status,200);
 const data=(await call(env,'/data')).data;assert.equal(data.characters.length,1);assert.equal(data.comments[0].character_id,b.id);assert.equal(data.affection.length,2);
 const h=(await call(env,'/history','root')).data.find(h=>h.action==='delete'&&h.record_id===b.id);assert.equal((await call(env,'/history/'+h.id+'/restore','root','POST',{})).status,200);assert.equal((await call(env,'/data')).data.characters.length,2);
 await call(env,'/members','root','POST',{id:'two',email:'two@example.test',nickname:'two',active:false,role:'member'});
 assert.equal((await call(env,'/data','two')).status,401);assert.equal((await call(env,'/files/'+encodeURIComponent(upload.path),'two')).status,401);
 const cross=await call(env,'/characters','one','POST',{name:'CSRF',faction:'mage'},{Origin:'https://evil.test'});assert.equal(cross.status,403);
 }finally{env.DB.db.close();}
});
test('snapshot + R2 restore roundtrip, read-only backup key and rollback on invalid DB',async()=>{
 const env=await fixture(),fresh=await fixture();try{
 const a=(await call(env,'/characters','one','POST',{name:'보존된 캐릭터',faction:'mage',secrets:'비밀',extra:{습관:'독서',circle_faction:'중립',quote:'한 마디',other:'기타 설정',relationship_direction:'동료'}})).data;
 const bytes=new TextEncoder().encode('RIFF0000WEBPVP8 test');const file=(await call(env,'/upload','one','POST',bytes,{'Content-Type':'image/webp'})).data;
 await call(env,'/media','one','POST',{path:file.path,character_id:a.id});
 await call(env,'/backup/status',null,'POST',{status:'complete',details:'previous backup'},{Authorization:'Bearer backup-test'});
 const backup=(await call(env,'/backup/snapshot',null,'GET',undefined,{Authorization:'Bearer backup-test'})).data;
 assert.equal(backup.tables.backup_runs.length,1);
 assert.equal((await call(fresh,'/backup/restore',null,'POST',backup,{Authorization:'Bearer backup-test'})).status,403);
 assert.equal((await call(fresh,'/backup/restore-file',null,'POST',bytes,{Authorization:'Bearer restore-test','Content-Type':'image/webp','X-Object-Key':file.path,'X-Sha256':digest(bytes)})).status,200);
 assert.equal((await call(fresh,'/backup/restore',null,'POST',backup,{Authorization:'Bearer restore-test'})).status,200);
 assert.equal((await fresh.DB.prepare('SELECT count(*) n FROM backup_runs').first()).n,1);assert.equal((await fresh.DB.prepare('SELECT secrets FROM characters WHERE id=?').bind(a.id).first()).secrets,'비밀');assert.equal((await fresh.DB.prepare('SELECT count(*) n FROM sessions').first()).n,0);
 const broken=structuredClone(backup);broken.tables.characters[0].name='변경되면 안 됨';broken.tables.media[0].owner_id='missing';assert.equal((await call(fresh,'/backup/restore',null,'POST',broken,{Authorization:'Bearer restore-test'})).status,400);assert.equal((await fresh.DB.prepare('SELECT name FROM characters WHERE id=?').bind(a.id).first()).name,'보존된 캐릭터');
 }finally{env.DB.db.close();fresh.DB.db.close();}
});
