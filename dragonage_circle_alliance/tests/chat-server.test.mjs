import layout from '../scripts/backup-layout.cjs';
import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import worker from '../worker/index.mjs';import {ChatRoom,notifyChat} from '../worker/chat.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
class DB{constructor(sql){this.db=new DatabaseSync(':memory:');this.db.exec(sql);}prepare(sql){const db=this;let args=[];return {bind(...values){args=values;return this;},async first(){return db.db.prepare(sql).get(...args)||null;},async all(){return {results:db.db.prepare(sql).all(...args)};},async run(){if(db.failInsert&&sql.startsWith('INSERT INTO chat_messages'))throw Error('db failure');return {meta:{changes:Number(db.db.prepare(sql).run(...args).changes)}};},execute(){const statement=db.db.prepare(sql);if(statement.columns().length)return {results:statement.all(...args),meta:{changes:0}};return {results:[],meta:{changes:Number(statement.run(...args).changes)}};}};}async batch(statements){return statements.map(statement=>statement.execute());}}
class Socket{constructor(){this.readyState=1;this.events=[];}serializeAttachment(value){this.state=structuredClone(value);}deserializeAttachment(){return structuredClone(this.state);}send(value){this.events.push(JSON.parse(value));}close(code){this.readyState=3;this.code=code;}}
async function fixture(){
 const sql=(await Promise.all(['0001_circle','0002_representative_character','0003_notifications','0004_character_questions','0005_roleplay','0006_shared_chat'].map(name=>readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8')))).join('\n');
 const env={DB:new DB(sql),SITE_ORIGIN:'https://circle.test',BOOTSTRAP_ADMIN_EMAIL:'root@example.test',BACKUP_TOKEN:'backup-test',WRITE_RATE_LIMITER:{async limit(){return {success:true};}},CHAT_RATE_LIMITER:{async limit(){return {success:true};}}};
 for(const id of ['one','two']){await env.DB.prepare("INSERT INTO members(id,email,nickname,role,active,created_at,updated_at) VALUES(?,?,?,'member',1,?,?)").bind(id,id+'@example.test',id,new Date().toISOString(),new Date().toISOString()).run();await env.DB.prepare('INSERT INTO sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(hash(id),id,Date.now()+86400000).run();}
 const ctx={all:[],alarmAt:null,acceptWebSocket(socket){this.all.push(socket);},getWebSockets(){return this.all;},storage:{async getAlarm(){return ctx.alarmAt;},async setAlarm(at){ctx.alarmAt=at;},async deleteAlarm(){ctx.alarmAt=null;}}};
 const room=new ChatRoom(ctx,env);env.CHAT={idFromName(name){assert.equal(name,'all-members');return name;},get(){return {fetch:(url,options)=>room.fetch(new Request(url,options))};}};
 return {env,ctx,room};
}
async function call(env,path,user='one',method='GET',body,headers={}){return worker.fetch(new Request(env.SITE_ORIGIN+'/api/chat'+path,{method,headers:{Origin:env.SITE_ORIGIN,...(user?{Cookie:'circle_session='+user}:{}),'Content-Type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);}
const input=(body='hello',client_message_id=crypto.randomUUID())=>({body,client_message_id});
function socketGlobals(ctx){const ResponseBefore=globalThis.Response,PairBefore=globalThis.WebSocketPair;globalThis.Response=class extends ResponseBefore{constructor(body,options){if(options?.status===101)return {status:101,webSocket:options.webSocket};super(body,options);}};globalThis.WebSocketPair=class{constructor(){this[0]={};this[1]=new Socket();}};return ()=>{globalThis.Response=ResponseBefore;if(PairBefore===undefined)delete globalThis.WebSocketPair;else globalThis.WebSocketPair=PairBefore;};}
test('shared room validates sessions/origin, persists before fanout, deduplicates retries and rejects edits/spam',async()=>{
 const {env,ctx,room}=await fixture(),restore=socketGlobals(ctx);try{
  assert.equal((await call(env,'/messages',null)).status,401);
  assert.equal((await call(env,'/live','one','GET',undefined,{Upgrade:'websocket',Origin:'https://evil.test'})).status,403);
  assert.equal((await call(env,'/rooms','one','POST',{})).status,404);
  await call(env,'/live','one','GET',undefined,{Upgrade:'websocket'});await call(env,'/live','one','GET',undefined,{Upgrade:'websocket'});await call(env,'/live','two','GET',undefined,{Upgrade:'websocket'});
  assert.equal(ctx.all.length,3);assert.equal(room.presence().members.length,2);assert.equal(room.presence().members.some(member=>'email' in member),false);
  env.DB.failInsert=true;const first=input('<script>literal</script>');assert.equal((await call(env,'/messages','one','POST',first)).status,503);assert.equal(ctx.all[2].events.filter(event=>event.type==='message').length,0);
  env.DB.failInsert=false;const saved=await (await call(env,'/messages','one','POST',first)).json();assert.equal(saved.body,first.body);assert.equal(ctx.all[2].events.at(-1).message.id,saved.id);
  const retry=await (await call(env,'/messages','one','POST',first)).json();assert.equal(retry.id,saved.id);assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM chat_messages').first()).n,1);
  assert.equal((await call(env,'/messages','one','POST',{...first,body:'changed'})).status,409);
  assert.equal((await call(env,'/messages','one','POST',input('x'.repeat(2001)))).status,400);
  assert.equal((await call(env,'/messages','one','POST',input('   '))).status,400);
  env.CHAT_RATE_LIMITER={async limit(){return {success:false};}};const limited=await call(env,'/messages','one','POST',input());assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'60');assert.equal((await call(env,'/messages','one','POST',first)).status,200);
  env.CHAT_RATE_LIMITER={async limit(){return {success:true};}};assert.equal((await call(env,'/messages','two','POST',first)).status,200);
  const snapshot=await worker.fetch(new Request(env.SITE_ORIGIN+'/api/backup/snapshot',{headers:{Authorization:'Bearer backup-test'}}),env);const backup=await snapshot.json();assert.equal(backup.tables.chat_messages.length,2);assert.equal(JSON.parse(layout.categoryExports(backup).find(entry=>entry.file==='잡담/메시지.json').body).length,2);
 }finally{restore();env.DB.db.close();}
});
test('history pages recent-first, older and reconnect gaps without duplicates or missing IDs',async()=>{
 const {env}=await fixture();try{
  for(let i=1;i<=130;i++)await env.DB.prepare('INSERT INTO chat_messages(member_id,client_message_id,body,created_at) VALUES(?,?,?,?)').bind('one','fixture-'+i,'message '+i,new Date().toISOString()).run();
  const recent=await (await call(env,'/messages')).json();assert.equal(recent.messages.length,50);assert.equal(recent.messages[0].id,81);assert.equal(recent.cursor,130);assert.equal(recent.has_more,true);
  const older=await (await call(env,'/messages?before=81')).json();assert.deepEqual([older.messages[0].id,older.messages.at(-1).id],[31,80]);
  let cursor=0,ids=[];for(let pages=0;pages<5;pages++){const page=await (await call(env,'/messages?after='+cursor)).json();ids.push(...page.messages.map(message=>message.id));cursor=page.cursor;if(!page.has_more)break;}
  assert.equal(ids.length,130);assert.equal(new Set(ids).size,130);assert.equal(cursor,130);
  for(const query of ['?before=-1','?after=oops','?before=5&after=2'])assert.equal((await call(env,'/messages'+query)).status,400);
  await env.DB.prepare('UPDATE members SET active=0 WHERE id=?').bind('one').run();assert.equal((await call(env,'/messages')).status,401);
 }finally{env.DB.db.close();}
});
test('hibernation attachments deduplicate tabs, expire typing/leases, and remove revoked members and sessions',async()=>{
 const {env,ctx,room}=await fixture(),restore=socketGlobals(ctx),realNow=Date.now;let now=realNow();Date.now=()=>now;try{
  await call(env,'/live','one','GET',undefined,{Upgrade:'websocket'});await call(env,'/live','one','GET',undefined,{Upgrade:'websocket'});await call(env,'/live','two','GET',undefined,{Upgrade:'websocket'});
  await room.webSocketMessage(ctx.all[0],JSON.stringify({type:'typing',active:true}));assert.deepEqual(room.presence().typing,['one']);const count=ctx.all[2].events.length;
  await room.webSocketMessage(ctx.all[0],JSON.stringify({type:'typing',active:true}));assert.equal(ctx.all[2].events.length,count);
  await room.webSocketMessage(ctx.all[1],JSON.stringify({type:'typing',active:true}));await room.webSocketMessage(ctx.all[0],JSON.stringify({type:'typing',active:false}));assert.deepEqual(room.presence().typing,['one']);
  const revived=new ChatRoom(ctx,env);assert.equal(revived.presence().members.length,2);now+=7000;ctx.alarmAt=null;await revived.alarm();assert.deepEqual(revived.presence().typing,[]);
  await revived.webSocketClose(ctx.all[0]);assert.equal(revived.presence().members.length,2);
  await notifyChat(env,{revokeSession:hash('one')});assert.deepEqual(room.presence().members.map(member=>member.id),['two']);
  await env.DB.prepare('UPDATE members SET active=0 WHERE id=?').bind('two').run();await notifyChat(env,{chatMembers:true});assert.equal(room.presence().members.length,0);assert.equal(ctx.all[2].code,1008);assert.equal(ctx.alarmAt,null);
 }finally{Date.now=realNow;restore();env.DB.db.close();}
});
test('typing stops on send and dead connections disappear without periodic D1 reads',async()=>{
 const {env,ctx,room}=await fixture(),restore=socketGlobals(ctx),realNow=Date.now;let now=realNow();Date.now=()=>now;try{
  await call(env,'/live','one','GET',undefined,{Upgrade:'websocket'});await room.webSocketMessage(ctx.all[0],JSON.stringify({type:'typing',active:true}));
  await call(env,'/messages','one','POST',input());assert.deepEqual(room.presence().typing,[]);
  now+=80000;ctx.alarmAt=null;await room.alarm();assert.equal(room.presence().members.length,0);
  assert.deepEqual((await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%typing%' OR name LIKE '%presence%')").all()).results,[]);
 }finally{Date.now=realNow;restore();env.DB.db.close();}
});
