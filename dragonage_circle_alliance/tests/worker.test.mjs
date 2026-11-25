import {seedLocalDemo,demoRows} from '../worker/demo-data.mjs';
import devWorker from '../worker/dev.mjs';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {sendNotifications,notificationEvents} from '../worker/notifications.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import worker from '../worker/index.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
class D1 {
 constructor(sql){this.db=new DatabaseSync(':memory:');this.db.exec(sql);}
 prepare(sql){const db=this.db;let values=[];return {bind(...args){values=args;return this;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},async run(){const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)},results:[]};},execute(){const stmt=db.prepare(sql);const rows=stmt.columns().length?stmt.all(...values):null;const changes=rows?0:Number(stmt.run(...values).changes);return {results:rows||[],meta:{changes}};}};}
 async batch(stmts){this.db.exec('BEGIN');try{const out=stmts.map(s=>s.execute());this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
class R2 {constructor(){this.objects=new Map();}async put(k,b,o){this.objects.set(k,{bytes:new Uint8Array(b),...o});}async get(k){const obj=this.objects.get(k);return obj?{size:obj.bytes.length,body:new Blob([obj.bytes]).stream(),httpMetadata:obj.httpMetadata,arrayBuffer:async()=>obj.bytes.buffer}:null;}async head(k){return this.get(k);}}
async function fixture(){const env={SITE_ORIGIN:'https://circle.test',BOOTSTRAP_ADMIN_EMAIL:'root@example.test',BACKUP_TOKEN:'backup-test',RESTORE_TOKEN:'restore-test',DB:new D1((await readFile(new URL('../migrations/0001_circle.sql',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../migrations/0002_representative_character.sql',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../migrations/0003_notifications.sql',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../migrations/0004_character_questions.sql',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../migrations/0005_roleplay.sql',import.meta.url),'utf8'))),MEDIA:new R2()};for(const [id,role]of [['one','member'],['two','member'],['root','admin']]){await env.DB.prepare('INSERT INTO members(id,email,nickname,role,active,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').bind(id,id+'@example.test',id,role,new Date().toISOString(),new Date().toISOString()).run();await env.DB.prepare('INSERT INTO sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(digest(id),id,Date.now()+86400000).run();}return env;}
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
 assert.equal((await call(env,'/characters/'+b.id,'two','DELETE')).status,403);
 assert.equal((await call(env,'/characters/'+b.id,'root','DELETE')).status,200);
 const data=(await call(env,'/data')).data;assert.equal(data.characters.length,1);assert.equal(data.comments[0].character_id,b.id);assert.equal(data.affection.length,2);
 const h=(await call(env,'/history','root')).data.find(h=>h.action==='delete'&&h.record_id===b.id);assert.equal((await call(env,'/history/'+h.id+'/restore','root','POST',{})).status,200);assert.equal((await call(env,'/data')).data.characters.length,2);
 await call(env,'/members','root','POST',{id:'two',email:'two@example.test',nickname:'two',active:false,role:'member'});
 assert.equal((await call(env,'/data','two')).status,401);assert.equal((await call(env,'/files/'+encodeURIComponent(upload.path),'two')).status,401);
 const cross=await call(env,'/characters','one','POST',{name:'CSRF',faction:'mage'},{Origin:'https://evil.test'});assert.equal(cross.status,403);
 }finally{env.DB.db.close();}
});
test('roleplay timeline supports multiple owners, replies to replies, OOC, immutable authors, revisions and idempotent sends',async()=>{
 const env=await fixture();try{
 const a=(await call(env,'/characters','one','POST',{name:'마법사 A',faction:'mage'})).data;
 const b=(await call(env,'/characters','two','POST',{name:'템플러 B',faction:'templar'})).data;
 const c=(await call(env,'/characters','one','POST',{name:'두 번째 캐릭터',faction:'templar'})).data;
 const send=(user,body)=>call(env,'/roleplay/messages',user,'POST',{request_id:crypto.randomUUID(),...body});
 assert.equal((await send(null,{character_id:a.id,body:'비회원'})).status,401);
 assert.equal((await send('one',{character_id:b.id,body:'대리 작성'})).status,403);
 const key=crypto.randomUUID(),first=await send('one',{request_id:key,character_id:a.id,body:'"안녕"\n*창가를 본다.*'});assert.equal(first.status,200);
 const root=first.data;assert.equal(root.thread_id,root.id);assert.equal(root.author_name,a.name);
 const duplicate=await send('one',{request_id:key,character_id:a.id,body:root.body});assert.equal(duplicate.data.id,root.id);
 const concurrentKey=crypto.randomUUID();const concurrent=await Promise.all([send('one',{request_id:concurrentKey,body:'동시 전송'}),send('one',{request_id:concurrentKey,body:'동시 전송'})]);
 assert.equal(concurrent[0].status,200);assert.equal(concurrent[0].data.id,concurrent[1].data.id);
 const reply=(await send('two',{character_id:b.id,parent_id:root.id,body:'답글'})).data;
 const nested=(await send('one',{character_id:c.id,parent_id:reply.id,body:'답글에 답글'})).data;
 assert.equal(nested.parent_id,reply.id);assert.equal(nested.thread_id,root.id);assert.equal(nested.character_id,c.id);
 const ooc=(await send('one',{parent_id:nested.id,body:'내일 이어가요'})).data;assert.equal(ooc.character_id,null);
 assert.equal((await call(env,'/roleplay/messages','two','POST',{...root,body:'무단 수정'})).status,403);
 assert.equal((await call(env,'/roleplay/messages','one','POST',{...root,character_id:c.id,body:'작성자 변경'})).status,400);
 const changed=await call(env,'/roleplay/messages','one','POST',{id:root.id,revision:root.revision,body:'수정 본문'});assert.equal(changed.status,200);
 assert.equal((await call(env,'/roleplay/messages','one','POST',{id:root.id,revision:root.revision,body:'오래된 수정'})).status,409);
 await call(env,'/characters','one','POST',{...a,name:'새 이름'});
 const sync=(await call(env,'/roleplay/sync')).data;
 assert.equal(sync.messages.length,5);assert.equal(sync.messages.find(row=>row.id===root.id).character_id,a.id);
 assert.equal(sync.messages.find(row=>row.id===root.id).author_name,'마법사 A');
 assert.equal((await call(env,'/roleplay/sync?cursor='+sync.cursor)).data.messages.length,0);
 const notifications=(await call(env,'/notifications','one')).data.items;assert.ok(notifications.some(row=>row.url==='#/roleplay/thread/'+root.id));
 assert.equal((await call(env,'/roleplay/messages/'+root.id,'one','DELETE',undefined,{'X-Revision':String(changed.data.revision)})).status,200);
 const removed=(await call(env,'/roleplay/sync?cursor='+sync.cursor)).data.messages.find(row=>row.id===root.id);assert.ok(removed.deleted_at);assert.equal(removed.body,'');assert.deepEqual(removed.attachments,[]);
 const exported=await call(env,'/roleplay/export?thread='+root.id+'&ooc=hide');const log=await exported.response.text();assert.match(log,/답글에 답글/);assert.doesNotMatch(log,/내일 이어가요/);
 const data=(await call(env,'/data')).data;assert.equal(data.relationships.length,0);assert.equal(data.affection.length,0);assert.equal(data.rp_messages,undefined);
 }finally{env.DB.db.close();}
});

test('roleplay private scenes enforce read, speaking and image permissions including revocation and explicit admin access',async()=>{
 const env=await fixture();try{
 const a=(await call(env,'/characters','one','POST',{name:'A',faction:'mage'})).data,b=(await call(env,'/characters','two','POST',{name:'B',faction:'templar'})).data,c=(await call(env,'/characters','root','POST',{name:'C',faction:'mage'})).data;
 let scene=(await call(env,'/roleplay/scenes','one','POST',{title:'비공개 도서관',visibility:'participants',join_policy:'invite',participant_ids:[a.id,b.id]})).data;
 const send=(user,body)=>call(env,'/roleplay/messages',user,'POST',{request_id:crypto.randomUUID(),scene_id:scene.id,...body});
 assert.equal((await call(env,'/roleplay/sync','root')).data.scenes.length,0);
 assert.equal((await call(env,'/roleplay/scenes/'+scene.id+'/history','root')).status,404);
 assert.equal((await call(env,'/roleplay/export?scene='+scene.id,'root')).status,404);
 assert.equal((await send('root',{character_id:c.id,body:'몰래 발언'})).status,404);
 const bytes=new TextEncoder().encode('RIFF0000WEBPVP8 test');
 const image=await call(env,'/roleplay/upload?scene='+scene.id,'one','POST',bytes,{'Content-Type':'image/webp'});assert.equal(image.status,200);
 assert.equal((await call(env,'/files/'+encodeURIComponent(image.data.path),'root')).status,404);
 assert.equal((await call(env,'/files/'+encodeURIComponent(image.data.path),'two')).status,200);
 const root=(await send('one',{character_id:a.id,body:'비밀 대화',attachments:[image.data.path]})).data;
 assert.equal((await send('two',{character_id:b.id,body:'답글',parent_id:root.id})).status,200);
 assert.equal((await call(env,'/roleplay/messages','one','POST',{request_id:crypto.randomUUID(),body:'비공개 첨부를 타임라인에 재사용',attachments:[image.data.path]})).status,403);
 const outsiderCursor=(await call(env,'/roleplay/sync','root')).data.cursor;
 scene=(await call(env,'/roleplay/scenes/'+scene.id+'/invite','two','POST',{id:scene.id,revision:scene.revision,participant_ids:[c.id]})).data;
 assert.ok((await call(env,'/roleplay/sync?cursor='+outsiderCursor,'root')).data.newly_visible.includes(scene.id));
 assert.equal((await call(env,'/roleplay/scenes/'+scene.id+'/history','root')).data.messages.length,2);
 assert.equal((await send('root',{character_id:c.id,body:'세 번째 참여자'})).status,200);
 const sceneBefore=scene;
 scene=(await call(env,'/roleplay/scenes','one','POST',{...scene,participant_ids:[a.id,b.id]})).data;
 assert.equal((await call(env,'/files/'+encodeURIComponent(image.data.path),'root')).status,404);
 assert.equal((await call(env,'/roleplay/sync','root')).data.messages.length,0);
 assert.equal((await call(env,'/roleplay/scenes','one','POST',{...sceneBefore,title:'오래된 수정'})).status,409);
 scene=(await call(env,'/roleplay/scenes','one','POST',{...scene,admin_ids:['root']})).data;
 assert.equal((await call(env,'/roleplay/scenes/'+scene.id+'/history','root')).status,200);
 assert.equal((await send('root',{character_id:c.id,body:'운영자도 미참여면 발언 불가'})).status,403);
 assert.equal((await call(env,'/roleplay/messages','root','POST',{id:root.id,revision:root.revision,body:'타인의 글 수정'})).status,403);
 const prefs=await call(env,'/roleplay/preferences','two','POST',{mode:'off'});assert.equal(prefs.status,200);
 const before=(await env.DB.prepare("SELECT COUNT(*) n FROM notifications WHERE member_id='two'").first()).n;
 await send('one',{character_id:a.id,body:'알림 끈 참여자',parent_id:root.id});
 assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM notifications WHERE member_id='two'").first()).n,before);
 assert.equal((await call(env,'/roleplay/read','two','POST',{message_id:root.id})).status,200);
 assert.equal((await call(env,'/roleplay/sync','two')).data.reads.length,1);
 const exported=await call(env,'/roleplay/export?scene='+scene.id+'&format=html','two');assert.equal(exported.status,200);assert.match(await exported.response.text(),/비밀 대화/);
 assert.equal((await call(env,'/roleplay/scenes/'+scene.id,'one','DELETE',undefined,{'X-Revision':String(scene.revision)})).status,200);
 assert.equal((await call(env,'/files/'+encodeURIComponent(image.data.path),'two')).status,404);
 assert.ok((await env.DB.prepare('SELECT deleted_at FROM rp_scenes WHERE id=?').bind(scene.id).first()).deleted_at);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM rp_messages').first()).n,4);
 }finally{env.DB.db.close();}
});

test('roleplay public reading is separate from participation; ended scenes retain messages and can reopen',async()=>{
 const env=await fixture();try{
 const a=(await call(env,'/characters','one','POST',{name:'A',faction:'mage'})).data,b=(await call(env,'/characters','two','POST',{name:'B',faction:'templar'})).data;
 let scene=(await call(env,'/roleplay/scenes','one','POST',{title:'전체 공개 초대 장면',visibility:'members',join_policy:'invite',participant_ids:[a.id]})).data;
 const post=()=>call(env,'/roleplay/messages','two','POST',{request_id:crypto.randomUUID(),scene_id:scene.id,character_id:b.id,body:'참여'});
 assert.equal((await call(env,'/roleplay/sync','two')).data.scenes.length,1);assert.equal((await post()).status,403);
 assert.equal((await call(env,'/roleplay/scenes/'+scene.id+'/join','two','POST',{id:scene.id,revision:scene.revision,character_id:b.id})).status,403);
 scene=(await call(env,'/roleplay/scenes','one','POST',{...scene,join_policy:'open'})).data;
 assert.equal((await call(env,'/roleplay/scenes/'+scene.id+'/join','one','POST',{id:scene.id,revision:scene.revision,character_id:b.id})).status,403);
 scene=(await call(env,'/roleplay/scenes/'+scene.id+'/join','two','POST',{id:scene.id,revision:scene.revision,character_id:b.id})).data;
 const message=(await post()).data;assert.equal(message.character_id,b.id);
 scene=(await call(env,'/roleplay/scenes','one','POST',{...scene,status:'ended'})).data;
 assert.equal((await post()).status,400);
 assert.equal((await call(env,'/roleplay/messages','two','POST',{id:message.id,revision:message.revision,body:'종료 후 오타 수정'})).status,200);
 scene=(await call(env,'/roleplay/scenes','one','POST',{...scene,status:'active'})).data;assert.equal((await post()).status,200);
 const snapshot=(await call(env,'/backup/snapshot',null,'GET',undefined,{Authorization:'Bearer backup-test'})).data;
 assert.equal(snapshot.tables.rp_scenes.length,1);assert.equal(snapshot.tables.rp_messages.length,2);assert.ok(snapshot.tables.history.some(row=>row.table_name==='rp_messages'));
 assert.equal(snapshot.tables.relationships.length,0);assert.equal(snapshot.tables.affection.length,0);
 }finally{env.DB.db.close();}
});

test('roleplay history permissions, safe HTML exports, mention/invite preferences and backup restoration remain durable',async()=>{
 const env=await fixture(),fresh=await fixture();try{
 const a=(await call(env,'/characters','one','POST',{name:'A',faction:'mage'})).data,b=(await call(env,'/characters','two','POST',{name:'B',faction:'templar'})).data;
 await call(env,'/roleplay/preferences','two','POST',{mode:'mentions'});
 let scene=(await call(env,'/roleplay/scenes','one','POST',{title:'비공개 기록',visibility:'participants',join_policy:'invite',participant_ids:[a.id]})).data;
 scene=(await call(env,'/roleplay/scenes/'+scene.id+'/invite','one','POST',{id:scene.id,revision:scene.revision,participant_ids:[b.id]})).data;
 assert.ok((await env.DB.prepare("SELECT * FROM notifications WHERE member_id='two'").all()).results.some(row=>row.title.includes('초대')));
 const bytes=new TextEncoder().encode('RIFF0000WEBPVP8 test');
 const image=(await call(env,'/roleplay/upload?scene='+scene.id,'one','POST',bytes,{'Content-Type':'image/webp'})).data;
 let message=(await call(env,'/roleplay/messages','one','POST',{request_id:crypto.randomUUID(),scene_id:scene.id,character_id:a.id,body:'<script>alert(1)</script> @['+b.name+']('+b.id+')',attachments:[image.path]})).data;
 const notificationCount=(await env.DB.prepare("SELECT COUNT(*) n FROM notifications WHERE member_id='two'").first()).n;assert.equal(notificationCount,2);
 message=(await call(env,'/roleplay/messages','one','POST',{id:message.id,revision:message.revision,body:'수정된 본문'})).data;
 const history=(await env.DB.prepare("SELECT * FROM history WHERE table_name='rp_messages' AND action='update'").all()).results[0];
 assert.equal((await call(env,'/history','root')).data.some(row=>row.id===history.id),false);
 assert.equal((await call(env,'/history/'+history.id+'/restore','root','POST',{})).status,403);
 scene=(await call(env,'/roleplay/scenes','one','POST',{...scene,admin_ids:['root']})).data;
 assert.equal((await call(env,'/history/'+history.id+'/restore','root','POST',{})).status,200);
 const output=await call(env,'/roleplay/export?scene='+scene.id+'&format=html','two');const html=await output.response.text();assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 const snapshot=(await call(env,'/backup/snapshot',null,'GET',undefined,{Authorization:'Bearer backup-test'})).data;
 assert.equal((await call(fresh,'/backup/restore-file',null,'POST',bytes,{Authorization:'Bearer restore-test','Content-Type':'image/webp','X-Object-Key':image.path,'X-Sha256':digest(bytes)})).status,200);
 assert.equal((await call(fresh,'/backup/restore',null,'POST',snapshot,{Authorization:'Bearer restore-test'})).status,200);
 assert.equal((await fresh.DB.prepare('SELECT COUNT(*) n FROM rp_messages').first()).n,1);
 assert.equal((await fresh.DB.prepare('SELECT COUNT(*) n FROM rp_assets').first()).n,1);
 assert.equal((await fresh.DB.prepare("SELECT mode FROM rp_preferences WHERE id='two'").first()).mode,'mentions');
 await fresh.DB.prepare('INSERT INTO sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(digest('two'),'two',Date.now()+86400000).run();
 assert.equal((await call(fresh,'/files/'+encodeURIComponent(image.path),'two')).status,200);
 assert.equal((await call(fresh,'/roleplay/sync','two')).data.messages.length,1);
 }finally{env.DB.db.close();fresh.DB.db.close();}
});

test('roleplay incremental API bounds change pages and catches up without missing or duplicating records',async()=>{
 const env=await fixture();try{
 const at=new Date().toISOString();
 for(let i=0;i<205;i++) {
  const id='rp-'+String(i).padStart(4,'0');
  await env.DB.batch([
   env.DB.prepare('INSERT INTO rp_messages(id,owner_id,thread_id,author_name,body,request_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,'one',id,'one','message '+i,'request-'+i,at,at),
   env.DB.prepare('INSERT INTO rp_changes(record_type,record_id,created_at) VALUES(?,?,?)').bind('rp_messages',id,at),
  ]);
 }
 const first=(await call(env,'/roleplay/sync')).data;assert.equal(first.messages.length,200);assert.equal(first.has_more,true);
 const second=(await call(env,'/roleplay/sync?cursor='+first.cursor)).data;assert.equal(second.messages.length,5);assert.equal(second.has_more,false);
 assert.equal(new Set([...first.messages,...second.messages].map(row=>row.id)).size,205);
 assert.equal((await call(env,'/roleplay/sync?cursor='+second.cursor)).data.messages.length,0);
 assert.equal((await call(env,'/roleplay/sync?cursor=-1')).status,400);
 }finally{env.DB.db.close();}
});

test('admins can use member mode without changing account roles, and mode headers never promote ordinary members',async()=>{
 const env=await fixture();try{
 const memberMode={'X-Circle-Mode':'member'},adminMode={'X-Circle-Mode':'admin'};
 const own=(await call(env,'/characters','root','POST',{name:'관리자의 캐릭터',faction:'mage'})).data;
 const other=(await call(env,'/characters','one','POST',{name:'다른 오너 캐릭터',faction:'templar'})).data;
 const me=(await call(env,'/me','root','GET',undefined,memberMode)).data;
 assert.equal(me.role,'member');assert.equal(me.account_role,'superadmin');
 const data=(await call(env,'/data','root','GET',undefined,memberMode)).data;
 assert.equal(data.members.find(row=>row.id==='one').email,undefined);
 assert.equal((await call(env,'/history','root','GET',undefined,memberMode)).status,403);
 assert.equal((await call(env,'/export','root','GET',undefined,memberMode)).status,403);
 assert.equal((await call(env,'/characters/'+own.id,'root','DELETE',undefined,memberMode)).status,403);
 assert.equal((await call(env,'/characters','root','POST',{...other,name:'무단 수정'},memberMode)).status,403);
 assert.equal((await call(env,'/posts','root','POST',{title:'공지',category:'notice'},memberMode)).status,403);
 assert.equal((await call(env,'/members','root','POST',{email:'invite@example.test',nickname:'초대',role:'member'},memberMode)).status,403);
 assert.equal((await call(env,'/characters','root','POST',{...own,name:'회원처럼 내 캐릭터 수정'},memberMode)).status,200);
 const profile=(await call(env,'/profile','root','POST',{nickname:'오너처럼 사용'},memberMode)).data;
 assert.equal(profile.role,'member');assert.equal(profile.account_role,'superadmin');
 assert.equal((await env.DB.prepare("SELECT role FROM members WHERE id='root'").first()).role,'admin');
 assert.equal((await call(env,'/me','root','GET',undefined,adminMode)).data.role,'superadmin');
 assert.equal((await call(env,'/history','root','GET',undefined,adminMode)).status,200);
 assert.equal((await call(env,'/characters','root','POST',{...other,name:'관리자 모드에서 수정'},adminMode)).status,200);
 assert.equal((await call(env,'/me','one','GET',undefined,adminMode)).data.role,'member');
 assert.equal((await call(env,'/export','one','GET',undefined,adminMode)).status,403);
 assert.equal((await call(env,'/characters/'+own.id,'one','DELETE',undefined,adminMode)).status,403);
 const scene=(await call(env,'/roleplay/scenes','one','POST',{title:'허가한 운영자만',visibility:'participants',participant_ids:[other.id],admin_ids:['root']})).data;
 assert.equal((await call(env,'/roleplay/sync','root','GET',undefined,memberMode)).data.scenes.some(row=>row.id===scene.id),false);
 assert.equal((await call(env,'/roleplay/sync','root','GET',undefined,adminMode)).data.scenes.some(row=>row.id===scene.id),true);
 }finally{env.DB.db.close();}
});

test('character deletion is reserved for admins while owners retain profile editing',async()=>{
 const env=await fixture();try{
 const character=(await call(env,'/characters','one','POST',{name:'보호할 캐릭터',faction:'mage'})).data;
 assert.equal((await call(env,'/characters/'+character.id,'one','DELETE')).status,403);
 assert.equal((await call(env,'/characters/'+character.id,'two','DELETE')).status,403);
 const edited=await call(env,'/characters','one','POST',{...character,name:'오너가 수정'});
 assert.equal(edited.status,200);
 assert.equal((await call(env,'/data')).data.characters.find(row=>row.id===character.id).name,'오너가 수정');
 await env.DB.prepare("UPDATE members SET role='admin' WHERE id='two'").run();
 assert.equal((await call(env,'/characters/'+character.id,'two','DELETE')).status,200);
 assert.equal((await call(env,'/data')).data.characters.some(row=>row.id===character.id),false);
 }finally{env.DB.db.close();}
});

test('portrait changes retain images, support reuse and deletion, and enforce ownership and revisions',async()=>{
 const env=await fixture();try{
 const bytes=new TextEncoder().encode('RIFF0000WEBPVP8 test');
 const upload=async user=>(await call(env,'/upload',user,'POST',bytes,{'Content-Type':'image/webp'})).data.path;
 const first=await upload('one'),second=await upload('one'),foreign=await upload('two');
 let character=(await call(env,'/characters','one','POST',{name:'이미지 이력',faction:'mage',image_path:first,extra:{theme_color:'#397e81'}})).data;
 assert.deepEqual(character.extra.portrait_history.map(image=>image.path),[first]);
 const stale=structuredClone(character);
 character=(await call(env,'/characters','one','POST',{...character,image_path:second})).data;
 assert.equal(character.image_path,second);
 assert.deepEqual(new Set(character.extra.portrait_history.map(image=>image.path)),new Set([first,second]));
 assert.equal(character.extra.theme_color,'#397e81');
 assert.equal((await call(env,'/characters','one','POST',{...stale,image_path:first})).status,409);
 assert.equal((await call(env,'/characters','two','POST',{...character,image_path:foreign})).status,403);
 assert.equal((await call(env,'/characters','one','POST',{...character,extra:{portrait_history:[{path:foreign}]}})).status,403);
 assert.equal((await call(env,'/characters','one','POST',{...character,extra:{portrait_history:'invalid'}})).status,400);
 character=(await call(env,'/characters','one','POST',{...character,image_path:first})).data;
 assert.equal(character.image_path,first);assert.equal(character.extra.portrait_history.length,2);
 character=(await call(env,'/characters','one','POST',{...character,extra:{...character.extra,portrait_history:character.extra.portrait_history.filter(image=>image.path!==second)}})).data;
 assert.deepEqual(character.extra.portrait_history.map(image=>image.path),[first]);
 character=(await call(env,'/characters','one','POST',{...character,image_path:null,extra:{...character.extra,portrait_history:[]}})).data;
 assert.equal(character.image_path,null);assert.deepEqual(character.extra.portrait_history,[]);
 // Legacy profiles gain history when their image is replaced.
 await env.DB.prepare('UPDATE characters SET image_path=?,extra=? WHERE id=?').bind(first,'{}',character.id).run();
 character=(await call(env,'/characters','one','POST',{id:character.id,revision:character.revision,image_path:second})).data;
 assert.deepEqual(new Set(character.extra.portrait_history.map(image=>image.path)),new Set([first,second]));
 // Removing the current image while uploading a replacement must not resurrect it.
 character=(await call(env,'/characters','one','POST',{...character,image_path:first,extra:{portrait_history:[]}})).data;
 assert.deepEqual(character.extra.portrait_history.map(image=>image.path),[first]);
 const loaded=(await call(env,'/data')).data.characters.find(row=>row.id===character.id);
 assert.deepEqual(loaded.extra.portrait_history,character.extra.portrait_history);
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

test('art attachments cap at ten, can be replaced, and GIF originals remain intact', async () => {
  const env = await fixture();
  try {
    const post = (await call(env,'/posts','one','POST',{category:'art',title:'이미지 열 장'})).data;
    const bytes = new TextEncoder().encode('GIF89a original animated bytes');
    const upload = await call(env,'/upload','one','POST',bytes,{'Content-Type':'image/gif'});
    assert.equal(upload.status,200); assert.ok(upload.data.path.endsWith('.gif'));
    const response = (await call(env,'/files/'+encodeURIComponent(upload.data.path),'one')).response;
    assert.equal(response.headers.get('Content-Type'),'image/gif');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    let first;
    for (let i=0; i<10; i++) {
      const file=(await call(env,'/upload','one','POST',bytes,{'Content-Type':'image/gif'})).data;
      const attached=await call(env,'/media','one','POST',{post_id:post.id,path:file.path});
      assert.equal(attached.status,200); first ||= attached.data;
    }
    assert.equal((await call(env,'/media','one','POST',{post_id:post.id,path:upload.data.path})).status,400);
    assert.equal((await call(env,'/media','one','POST',{...first,caption:'기존 이미지 수정'})).status,200);
    assert.equal((await call(env,'/media/'+first.id,'one','DELETE')).status,200);
    assert.equal((await call(env,'/media','one','POST',{post_id:post.id,path:upload.data.path})).status,200);
  } finally { env.DB.db.close(); }
});

test('representative character is saved per member, protected by ownership, and included in backup', async () => {
 const env=await fixture();
 try {
  const own=(await call(env,'/characters','one','POST',{name:'대표 후보',faction:'mage'})).data;
  const second=(await call(env,'/characters','one','POST',{name:'두 번째 후보',faction:'templar'})).data;
  const other=(await call(env,'/characters','two','POST',{name:'다른 오너 캐릭터',faction:'mage'})).data;
  assert.equal((await call(env,'/profile','one','POST',{nickname:'오너',representative_character_id:other.id})).status,403);
  const profile=(await call(env,'/profile','one','POST',{nickname:'오너',representative_character_id:own.id})).data;
  assert.equal(profile.representative_character_id,own.id);
  assert.equal((await call(env,'/me')).data.representative_character_id,own.id);
  const publicMember=(await call(env,'/data','two')).data.members.find(m=>m.id==='one');
  assert.equal(publicMember.representative_character_id,own.id); assert.equal(publicMember.email,undefined);
  assert.equal((await call(env,'/profile','one','POST',{nickname:'이름만 수정'})).data.representative_character_id,own.id);
  assert.equal((await call(env,'/profile','one','POST',{nickname:'오너',representative_character_id:second.id})).data.representative_character_id,second.id);
  const backup=(await call(env,'/backup/snapshot',null,'GET',undefined,{Authorization:'Bearer backup-test'})).data;
  assert.equal(backup.tables.members.find(m=>m.id==='one').representative_character_id,second.id);
  const restored=await fixture();
  try {
   assert.equal((await call(restored,'/backup/restore',null,'POST',backup,{Authorization:'Bearer restore-test'})).status,200);
   assert.equal((await restored.DB.prepare('SELECT representative_character_id FROM members WHERE id=?').bind('one').first()).representative_character_id,second.id);
  } finally {restored.DB.db.close();}

  assert.equal((await call(env,'/profile','one','POST',{nickname:'오너',representative_character_id:null})).data.representative_character_id,null);
  await call(env,'/characters/'+own.id,'root','DELETE');
  assert.equal((await call(env,'/profile','one','POST',{nickname:'오너',representative_character_id:own.id})).status,400);
 } finally {env.DB.db.close();}
});

test('only the pinned highest admin can export, access history, restore, and assign admin roles', async()=>{
 const env=await fixture();
 try {
  assert.equal((await call(env,'/me','root')).data.role,'superadmin');
  assert.equal((await call(env,'/members','root','POST',{id:'two',email:'two@example.test',nickname:'관리자',role:'admin'})).status,200);
  assert.equal((await call(env,'/me','two')).data.role,'admin');
  assert.equal((await call(env,'/members','two','POST',{email:'invite@test.example',nickname:'초대 회원'})).status,200);
  const notice=await call(env,'/posts','two','POST',{title:'일반 관리자의 공지',category:'notice'});assert.equal(notice.status,200);
  for(const user of ['one','two']) {
   assert.equal((await call(env,'/export',user)).status,403);
   assert.equal((await call(env,'/history',user)).status,403);
   assert.equal((await call(env,'/history/fake/restore',user,'POST',{})).status,403);
   assert.equal((await call(env,'/backup/snapshot',user)).status,403);
   assert.equal((await call(env,'/backup/restore',user,'POST',{})).status,403);
  }
  assert.equal((await call(env,'/export','root')).status,200);
  const history=await call(env,'/history','root');assert.equal(history.status,200);
  assert.equal((await call(env,'/members','two','POST',{id:'one',email:'one@example.test',nickname:'탈취',role:'admin'})).status,403);
  assert.equal((await call(env,'/members','two','POST',{id:'two',email:'two@example.test',nickname:'탈취',role:'superadmin'})).status,403);
  assert.equal((await call(env,'/members','two','POST',{id:'root',email:'root@example.test',nickname:'차단',active:false})).status,403);
  assert.equal((await call(env,'/members','root','POST',{id:'two',email:'two@example.test',nickname:'두 번째 최고관리자',role:'superadmin'})).status,403);
  assert.equal((await call(env,'/members','root','POST',{id:'root',email:'root@example.test',nickname:'최고관리자',role:'member'})).status,403);
  assert.equal((await call(env,'/members','root','POST',{id:'root',email:'root@example.test',nickname:'최고관리자',active:false})).status,403);
  assert.equal((await call(env,'/profile','root','POST',{nickname:'최고 관리자'})).data.role,'superadmin');
  assert.equal((await call(env,'/data','one')).data.members.find(m=>m.id==='root').role,'superadmin');
  const item=(await call(env,'/characters','one','POST',{name:'회원의 캐릭터',faction:'mage'})).data;
  const edited=await call(env,'/characters','root','POST',{...item,name:'최고 관리자의 수정'});assert.equal(edited.status,200);
  assert.equal((await call(env,'/characters','two','POST',{...edited.data,name:'일반 관리자의 수정'})).status,200);
  assert.equal((await call(env,'/members','root','POST',{id:'two',email:'two@example.test',nickname:'다시 회원',role:'member'})).status,200);
  assert.equal((await call(env,'/me','two')).data.role,'member');
  assert.equal((await call(env,'/members','two','POST',{email:'blocked@test.example',nickname:'실패'})).status,403);
 }finally{env.DB.db.close();}
});

test('notification inbox targets all owners, deduplicates tags, skips self and edits, and scopes read status',async()=>{
 const env=await fixture();
 try {
  const a=(await call(env,'/characters','one','POST',{name:'내 캐릭터',faction:'mage'})).data;
  const b=(await call(env,'/characters','two','POST',{name:'태그 대상',faction:'templar'})).data;
  const c=(await call(env,'/characters','root','POST',{name:'나중에 태그',faction:'mage'})).data;
  let post=(await call(env,'/posts','one','POST',{title:'새 글',category:'art',character_ids:[b.id,b.id],body:'@[태그 대상]('+b.id+')'})).data;
  assert.equal((await call(env,'/notifications','one')).data.unread,0);
  let inbox=(await call(env,'/notifications','two')).data;
  assert.equal(inbox.unread,1);assert.deepEqual(inbox.items[0].reasons,['new_post','tag']);
  assert.equal(inbox.items[0].url,'#/board/art/'+post.id);
  const foreign=inbox.items[0].id;
  await call(env,'/notifications/read','one','POST',{ids:[foreign]});
  assert.equal((await call(env,'/notifications','two')).data.unread,1);
  await call(env,'/notifications/read','two','POST',{ids:[foreign]});
  assert.equal((await call(env,'/notifications','two')).data.unread,0);
  post=(await call(env,'/posts','one','POST',{...post,body:'내용만 수정'})).data;
  assert.equal((await call(env,'/notifications','two')).data.items.length,1);
  post=(await call(env,'/posts','one','POST',{...post,character_ids:[b.id,c.id]})).data;
  const rootInbox=(await call(env,'/notifications','root')).data;
  assert.equal(rootInbox.items.length,2);assert.equal(rootInbox.items.filter(n=>n.kind==='tag').length,1);
  const comment=(await call(env,'/comments','two','POST',{post_id:post.id,body:'@[내 캐릭터]('+a.id+') 댓글'})).data;
  const ownInbox=(await call(env,'/notifications','one')).data;
  assert.equal(ownInbox.items.length,1);assert.deepEqual(ownInbox.items[0].reasons,['new_comment','tag','own_comment']);
  assert.ok(ownInbox.items[0].body.includes('@내 캐릭터'));assert.ok(!ownInbox.items[0].body.includes(a.id));
  await call(env,'/comments','two','POST',{...comment,body:'댓글 수정'});
  assert.equal((await call(env,'/notifications','one')).data.items.length,1);
  await call(env,'/comments','root','POST',{post_id:post.id,parent_id:comment.id,body:'답글'});
  assert.equal((await call(env,'/notifications','two')).data.items.filter(n=>n.kind==='own_comment').length,1);
  await call(env,'/notifications/read','two','POST',{all:true});
  assert.equal((await call(env,'/notifications','two')).data.unread,0);
  assert.ok((await call(env,'/notifications','one')).data.unread>0);
  assert.equal((await call(env,'/notifications',null)).status,401);
  assert.equal((await call(env,'/notifications/read','one','POST',{all:true},{Origin:'https://evil.test'})).status,403);
  const backup=(await call(env,'/backup/snapshot',null,'GET',undefined,{Authorization:'Bearer backup-test'})).data;
  assert.ok(backup.tables.notifications.length>0);assert.equal(backup.tables.push_subscriptions,undefined);
 }finally{env.DB.db.close();}
});

function pushKeypair(){const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const jwk=keys.privateKey.export({format:'jwk'});return {privateKey:jwk.d,publicKey:Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url')};}
test('device push uses encrypted payloads, rejects endpoint takeover/SSRF, cleans expired endpoints and logout',async()=>{
 const env=await fixture();
 try {
  const server=pushKeypair(),device=pushKeypair();
  const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test-device',expirationTime:null,keys:{p256dh:device.publicKey,auth:randomBytes(16).toString('base64url')}};
  assert.equal((await call(env,'/push/subscribe','two','POST',{subscription})).status,503);
  env.PUSH_VAPID_PUBLIC_KEY=server.publicKey;env.PUSH_VAPID_PRIVATE_KEY=server.privateKey;
  const config=(await call(env,'/push/config','two')).data;assert.equal(config.publicKey,server.publicKey);assert.ok(!JSON.stringify(config).includes(server.privateKey));
  const prefs={new_post:false,new_comment:false,tag:true,own_comment:true};
  assert.equal((await call(env,'/push/subscribe','two','POST',{subscription,preferences:prefs})).status,200);
  assert.equal((await call(env,'/push/subscribe','one','POST',{subscription})).status,403);
  assert.equal((await call(env,'/push/state','one','POST',{endpoint:subscription.endpoint})).data.subscribed,false);
  await call(env,'/push/unsubscribe','one','POST',{endpoint:subscription.endpoint});
  assert.equal((await call(env,'/push/state','two','POST',{endpoint:subscription.endpoint})).data.subscribed,true);
  for(const endpoint of ['http://fcm.googleapis.com/test','https://127.0.0.1/test','https://fcm.googleapis.com.evil.test/test','https://evil.test/test','https://fcm.googleapis.com:444/test']){
   assert.equal((await call(env,'/push/subscribe','two','POST',{subscription:{...subscription,endpoint}})).status,400);
  }
  assert.equal((await call(env,'/push/subscribe','two','POST',{subscription:{...subscription,keys:{p256dh:'invalid',auth:'invalid'}}})).status,400);
  let sent=[];
  const event={id:'test-event',member_id:'two',reasons:['new_post','tag'],title:'내 캐릭터 태그',body:'비밀 알림 본문',url:'#/home'};
  await sendNotifications(env,[event],async(endpoint,payload)=>{sent.push({endpoint,payload});return new Response(null,{status:201});});
  assert.equal(sent.length,1);assert.equal(sent[0].payload.headers['content-encoding'],'aes128gcm');
  assert.ok(sent[0].payload.headers.authorization.startsWith('vapid '));
  assert.ok(!Buffer.from(sent[0].payload.body).toString().includes('비밀 알림 본문'));
  assert.equal(sent[0].payload.redirect,'error');
  await sendNotifications(env,[{...event,reasons:['new_post']}],async()=>{throw Error('disabled event must not send');});
  assert.equal((await call(env,'/push/state','two','POST',{endpoint:subscription.endpoint})).data.preferences.new_post,false);
  await sendNotifications(env,[event],async()=>new Response(null,{status:410}));
  assert.equal((await call(env,'/push/state','two','POST',{endpoint:subscription.endpoint})).data.subscribed,false);
  await call(env,'/push/subscribe','two','POST',{subscription});
  await call(env,'/auth/logout','two','POST',{});
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').first()).n,0);
  sent=[];await sendNotifications(env,[event],async()=>{sent.push('unexpected');return new Response(null,{status:201});});assert.equal(sent.length,0);
 }finally{env.DB.db.close();}
});

test('local development login is loopback-only, separate from production, and uses local sessions',async()=>{
 const env=await fixture();env.LOCAL_DEVELOPMENT='1';
 try{
  const login=await devWorker.fetch(new Request('http://127.0.0.1:8787/api/auth/login'),env);
  assert.equal(login.status,302);assert.equal(login.headers.get('Location'),'http://localhost:8090/#/home');
  const cookie=login.headers.get('Set-Cookie').split(';')[0];
  const meResponse=await devWorker.fetch(new Request('http://localhost:8090/api/me',{headers:{Cookie:cookie}}),env);
  assert.equal(meResponse.status,200);const me=await meResponse.json();assert.equal(me.role,'superadmin');assert.equal(me.email,'developer@circle.local');
  const data=await devWorker.fetch(new Request('http://localhost:8090/api/data',{headers:{Cookie:cookie}}),env);assert.equal(data.status,200);
  assert.equal((await devWorker.fetch(new Request('https://circle.test/api/auth/login'),env)).status,403);
  assert.equal((await devWorker.fetch(new Request('http://localhost:8090/api/auth/login',{headers:{Origin:'https://evil.test'}}),env)).status,403);
  assert.equal((await devWorker.fetch(new Request('http://localhost:8090/api/auth/login',{headers:{'Sec-Fetch-Site':'cross-site'}}),env)).status,403);
  assert.equal((await devWorker.fetch(new Request('http://localhost:8090/api/auth/login'),{...env,LOCAL_DEVELOPMENT:undefined})).status,403);
  for(const frontend of ['http://localhost:8090','http://127.0.0.1:8090','http://[::1]:8090']){
   const entry=await devWorker.fetch(new Request(frontend+'/api/auth/login',{headers:{Origin:frontend}}),env);
   assert.equal(entry.status,302);assert.equal(entry.headers.get('Location'),frontend+'/#/home');
   const localCookie=entry.headers.get('Set-Cookie').split(';')[0];
   const exit=await devWorker.fetch(new Request(frontend+'/api/auth/logout',{method:'POST',headers:{Origin:frontend,Cookie:localCookie}}),env);
   assert.equal(exit.status,200);
   assert.equal((await devWorker.fetch(new Request(frontend+'/api/me',{headers:{Cookie:localCookie}}),env)).status,401);
  }
  for(const foreign of ['http://localhost:8091','http://127.0.0.1.evil.test:8090','http://192.168.1.2:8090'])assert.equal((await devWorker.fetch(new Request('http://localhost:8090/api/auth/login',{headers:{Origin:foreign}}),env)).status,403);
  assert.equal((await call(env,'/auth/login',null)).status,503);
  env.PUSH_VAPID_PUBLIC_KEY='should-not-be-used';env.PUSH_VAPID_PRIVATE_KEY='should-not-be-used';
  const push=await devWorker.fetch(new Request('http://localhost:8090/api/push/config',{headers:{Cookie:cookie}}),env);assert.equal((await push.json()).configured,false);
 }finally{env.DB.db.close();}
});

test('local demo covers populated screens, stores real images, and preserves edits on repeated seed',async()=>{
 const env=await fixture();
 try{
  await assert.rejects(seedLocalDemo(env),/outside local development/);
  env.LOCAL_DEVELOPMENT='1';const result=await seedLocalDemo(env);assert.equal(result.seeded,true);
  assert.equal(result.characters,6);assert.equal(result.posts,7);assert.equal(result.images,23);
  const demo=demoRows();
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM media WHERE post_id=?').bind(demo.posts[4].id).first()).n,10);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM relationships WHERE status=?').bind('pending').first()).n,2);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM characters WHERE owner_id=?').bind('local-developer').first()).n,3);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE member_id=? AND read_at IS NULL').bind('local-developer').first()).n,4);
  const sessionCount=(await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first()).n;
  await env.DB.prepare('UPDATE characters SET name=? WHERE id=?').bind('이름 편집 유지',demo.characters[0].id).run();
  assert.equal((await seedLocalDemo(env)).seeded,false);
  assert.equal((await env.DB.prepare('SELECT name FROM characters WHERE id=?').bind(demo.characters[0].id).first()).name,'이름 편집 유지');
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first()).n,sessionCount);
  for(const upload of (await env.DB.prepare('SELECT * FROM uploads').all()).results){const image=await env.MEDIA.get(upload.path);assert.equal(image.size,upload.bytes);assert.equal(digest(new Uint8Array(await image.arrayBuffer())),upload.sha256);assert.equal(image.httpMetadata.contentType,'image/png');}
  assert.equal((await env.DB.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 }finally{env.DB.db.close();}
});


test('writes publish committed changes and notification recipients; reads and rejected writes do not publish',async()=>{
 const env=await fixture(),events=[];
 env.REALTIME={idFromName:name=>name,get:()=>({async fetch(url,options){events.push(JSON.parse(options.body));return new Response(null,{status:204});}})};
 try{
  await call(env,'/data');await call(env,'/notifications');assert.equal(events.length,0);
  assert.equal((await call(env,'/posts','one','POST',{title:'Realtime',category:'story',body:'Event-driven'},{'X-Circle-Client-Id':'writer'})).status,200);
  assert.equal(events.length,1);assert.equal(events[0].data,true);assert.equal(events[0].actorClient,'writer');assert.equal(events[0].actorMember,'one');assert.deepEqual(new Set(events[0].notificationMembers),new Set(['two','root']));
  assert.equal((await call(env,'/posts','one','POST',{title:'Forbidden',category:'notice'})).status,403);assert.equal(events.length,1);
  assert.equal((await call(env,'/notifications/read','two','POST',{all:true},{'X-Circle-Client-Id':'reader'})).status,200);
  assert.deepEqual(events[1],{notificationMembers:['two'],actorMember:'two',actorClient:'reader'});
  await call(env,'/auth/logout','one','POST',{});assert.deepEqual(events[2],{revokeSession:digest('one')});
 }finally{env.DB.db.close();}
});

test('character theme survives save, updates and backup; malformed colors and foreign edits are rejected',async()=>{
 const env=await fixture();try{
  const created=await call(env,'/characters','one','POST',{name:'Theme',faction:'mage',extra:{theme_color:'#AA6384',other:'Preserve settings'}});
  assert.equal(created.status,200);assert.equal(created.data.extra.theme_color,'#aa6384');
  assert.equal((await call(env,'/data')).data.characters[0].extra.theme_color,'#aa6384');
  const snapshot=(await call(env,'/backup/snapshot',null,'GET',undefined,{Authorization:'Bearer backup-test'})).data;
  assert.equal(JSON.parse(snapshot.tables.characters[0].extra).theme_color,'#aa6384');
  for(const color of ['red','#fff','#123456;color:red',123])assert.equal((await call(env,'/characters','one','POST',{...created.data,extra:{theme_color:color}})).status,400);
  assert.equal((await call(env,'/characters','two','POST',{...created.data,extra:{theme_color:'#123456'}})).status,403);
  const cleared=await call(env,'/characters','one','POST',{...created.data,extra:{...created.data.extra,theme_color:''}});
  assert.equal(cleared.status,200);assert.equal(cleared.data.extra.theme_color,'');assert.equal(cleared.data.extra.other,'Preserve settings');
 }finally{env.DB.db.close();}
});

test('recruitment status and question lifecycle enforce owner permissions, revisions, notifications and backup',async()=>{
 const env=await fixture(),fresh=await fixture();try{
  const target=(await call(env,'/characters','two','POST',{name:'Target',faction:'mage',extra:{recruitment_status:'specific',recruitment_note:'A rival'}})).data;
  for(const extra of [{recruitment_status:'wrong'},{recruitment_status:'specific'},{recruitment_note:123},{recruitment_note:'x'.repeat(501)}])assert.equal((await call(env,'/characters','two','POST',{...target,extra})).status,400);
  assert.equal((await call(env,'/data')).data.characters[0].extra.recruitment_status,'specific');
  assert.equal((await call(env,'/questions',null,'POST',{character_id:target.id,body:'Question'})).status,401);
  assert.equal((await call(env,'/questions','two','POST',{character_id:target.id,body:'Own question'})).status,400);
  assert.equal((await call(env,'/questions','one','POST',{character_id:target.id,body:'Question',answer:'Fake'})).status,403);
  const question=(await call(env,'/questions','one','POST',{character_id:target.id,body:'What if it rains?',owner_id:'two',answered_by:'root'})).data;
  assert.equal(question.owner_id,'one');assert.equal(question.answer,'');assert.equal(question.answered_by,null);
  assert.equal((await call(env,'/notifications','two')).data.items.filter(item=>item.kind==='question').length,1);
  assert.equal((await call(env,'/questions','root','POST',{id:question.id,answer:'Impersonated answer'})).status,403);
  assert.equal((await call(env,'/questions','one','POST',{id:question.id,answer:'Impersonated answer'})).status,403);
  assert.equal((await call(env,'/questions','two','POST',{id:question.id,body:'Changed question',answer:'Answer'})).status,403);
  const revised=(await call(env,'/questions','one','POST',{id:question.id,revision:question.revision,body:'What if it snows?'})).data;
  assert.equal((await call(env,'/questions','two','POST',{id:question.id,revision:question.revision,answer:'Stale'})).status,409);
  const answered=(await call(env,'/questions','two','POST',{id:question.id,revision:revised.revision,answer:'Find shelter.'})).data;
  assert.equal(answered.answered_by,'two');assert.ok(answered.answered_at);assert.equal(answered.body,'What if it snows?');
  assert.equal((await call(env,'/questions','one','POST',{id:question.id,body:'Change after answer'})).status,403);
  assert.equal((await call(env,'/notifications','one')).data.items.filter(item=>item.kind==='answer').length,1);
  assert.equal((await call(env,'/data')).data.questions[0].answer,'Find shelter.');
  const backup=(await call(env,'/backup/snapshot',null,'GET',undefined,{Authorization:'Bearer backup-test'})).data;
  assert.equal(backup.tables.questions[0].answer,'Find shelter.');
  assert.equal((await call(fresh,'/backup/restore',null,'POST',backup,{Authorization:'Bearer restore-test'})).status,200);
  assert.equal((await fresh.DB.prepare('SELECT answer FROM questions').first()).answer,'Find shelter.');
  assert.equal((await call(env,'/questions/'+question.id,'two','DELETE')).status,200);
  assert.equal((await call(env,'/data')).data.questions.length,0);
  const history=(await call(env,'/history','root')).data.find(row=>row.record_id===question.id&&row.action==='delete');
  assert.equal((await call(env,'/history/'+history.id+'/restore','root','POST',{})).status,200);
  assert.equal((await call(env,'/data')).data.questions[0].answered_by,'two');
  const legacy=structuredClone(backup);delete legacy.tables.questions;
  assert.equal((await call(fresh,'/backup/restore',null,'POST',legacy,{Authorization:'Bearer restore-test'})).status,200);
 }finally{env.DB.db.close();fresh.DB.db.close();}
});

test('character affiliation supports four choices and preserves legacy profile settings without a schema change',async()=>{
 const env=await fixture();try{
  for(const type of ['mage','templar','chantry','tranquil']){
   const result=await call(env,'/characters','one','POST',{name:type,faction:'mage',extra:{affiliation_type:type,affiliation:'기존 소속 메모',other:'유지'}});
   assert.equal(result.status,200);assert.equal(result.data.extra.affiliation_type,type);assert.equal(result.data.extra.affiliation,'기존 소속 메모');assert.equal(result.data.faction,type==='templar'?'templar':'mage');
  }
  assert.equal((await call(env,'/characters','one','POST',{name:'Invalid',extra:{affiliation_type:'invalid'}})).status,400);
  const rows=(await call(env,'/data')).data.characters;assert.deepEqual(rows.map(row=>row.extra.affiliation_type).sort(),['chantry','mage','templar','tranquil']);
 }finally{env.DB.db.close();}
});
