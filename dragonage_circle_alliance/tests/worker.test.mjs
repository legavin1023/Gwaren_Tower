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
async function fixture(){const env={SITE_ORIGIN:'https://circle.test',BOOTSTRAP_ADMIN_EMAIL:'root@example.test',BACKUP_TOKEN:'backup-test',RESTORE_TOKEN:'restore-test',DB:new D1((await readFile(new URL('../migrations/0001_circle.sql',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../migrations/0002_representative_character.sql',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../migrations/0003_notifications.sql',import.meta.url),'utf8'))),MEDIA:new R2()};for(const [id,role]of [['one','member'],['two','member'],['root','admin']]){await env.DB.prepare('INSERT INTO members(id,email,nickname,role,active,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').bind(id,id+'@example.test',id,role,new Date().toISOString(),new Date().toISOString()).run();await env.DB.prepare('INSERT INTO sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(digest(id),id,Date.now()+86400000).run();}return env;}
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
  await call(env,'/characters/'+own.id,'one','DELETE');
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
