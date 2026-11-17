import {questionRecord} from './questions.mjs';
import {openRealtime,publishRealtime,requestClient} from './realtime.mjs';
export {RealtimeHub} from './realtime.mjs';
import { prepareNotifications, notificationStatement, sendNotifications, notificationRoute } from './notifications.mjs';
import {tables,fields,fail,requireAdmin,requireSuperAdmin,isAdmin,memberView,memberChange,canEdit,relationshipStatus,validateImage} from './policy.mjs';
const now=()=>new Date().toISOString(),id=()=>crypto.randomUUID();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(x=>x.toString(16).padStart(2,'0')).join('');
const cookie=(req,key)=>req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1)||'';
const setCookie=(env,key,value,seconds)=>`${key}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${env.SITE_ORIGIN.startsWith('https:')?'; Secure':''}`;
const decode=(table,row)=>{if(!row)return null;const r={...row};if(table==='characters')r.extra=JSON.parse(r.extra||'{}');if(table==='posts')r.character_ids=JSON.parse(r.character_ids||'[]');if(table==='relationships')r.directed=!!r.directed;if(table==='members')r.active=!!r.active;return r;};
const encode=value=>typeof value==='object'&&value!==null?JSON.stringify(value):typeof value==='boolean'?Number(value):value??null;
const get=async(env,t,key)=>decode(t,await env.DB.prepare(`SELECT * FROM ${t} WHERE id=?`).bind(key).first());
const live=async(env,key)=>{const c=await get(env,'characters',key);if(!c||c.deleted_at)fail('존재하지 않는 캐릭터입니다.');return c;};
async function session(req,env){const token=cookie(req,'circle_session');if(!token)fail('로그인이 필요합니다.',401);const row=await env.DB.prepare('SELECT m.* FROM members m JOIN sessions s ON s.member_id=m.id WHERE s.token_hash=? AND s.expires_at>? AND m.active=1').bind(await hash(token),Date.now()).first();if(!row)fail('로그인이 만료되었거나 접근이 차단되었습니다.',401);return memberView(env,decode('members',row));}
async function auth(req,env,path,ctx){
 if(path==='/auth/login'){
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.BOOTSTRAP_ADMIN_EMAIL)fail('운영자가 Google 로그인과 관리자 이메일을 먼저 설정해야 합니다.',503);
  const state=id()+id(),verifier=id()+id(),challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  await env.DB.batch([env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('INSERT INTO oauth_states(id,verifier,expires_at) VALUES(?,?,?)').bind(state,verifier,Date.now()+600000)]);
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.SITE_ORIGIN+'/api/auth/callback',response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
  return new Response(null,{status:302,headers:{Location:url.href,'Set-Cookie':setCookie(env,'circle_oauth',state,600),'Cache-Control':'no-store'}});
 }
 if(path==='/auth/callback'){
  try{
   const url=new URL(req.url),state=url.searchParams.get('state');if(!state||state!==cookie(req,'circle_oauth'))fail('OAuth 상태 검증 실패');
   const row=await env.DB.prepare('DELETE FROM oauth_states WHERE id=? AND expires_at>? RETURNING *').bind(state,Date.now()).first();if(!row)fail('만료된 로그인 요청');
   const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code:url.searchParams.get('code')||'',client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.SITE_ORIGIN+'/api/auth/callback',grant_type:'authorization_code',code_verifier:row.verifier})});const token=await response.json();if(!response.ok||!token.access_token)fail('Google 인증 실패');
   const infoResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token}});const info=await infoResponse.json();if(!infoResponse.ok||!info.email_verified||!info.sub||!info.email)fail('확인된 Google 이메일이 필요합니다.');
   const email=info.email.toLowerCase();let member=await env.DB.prepare('SELECT * FROM members WHERE email=?').bind(email).first();
   if(!member&&email===env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()){
     const stamp=now();await env.DB.prepare("INSERT OR IGNORE INTO members(id,email,google_sub,nickname,role,active,created_at,updated_at) VALUES(?,?,?,?,'admin',1,?,?)").bind(id(),email,info.sub,info.name||'운영자',stamp,stamp).run();member=await env.DB.prepare('SELECT * FROM members WHERE email=?').bind(email).first();
   }
   if(!member||!member.active||(member.google_sub&&member.google_sub!==info.sub))fail('초대받지 않은 계정입니다.',403);
   await env.DB.prepare('UPDATE members SET google_sub=? WHERE id=? AND (google_sub IS NULL OR google_sub=?)').bind(info.sub,member.id,info.sub).run();
   const sid=id()+id();await env.DB.prepare('INSERT INTO sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(await hash(sid),member.id,Date.now()+7*86400000).run();
   const headers=new Headers({Location:env.SITE_ORIGIN+'/#/home','Cache-Control':'no-store'});headers.append('Set-Cookie',setCookie(env,'circle_session',sid,604800));headers.append('Set-Cookie',setCookie(env,'circle_oauth','',0));return new Response(null,{status:302,headers});
  }catch{return new Response(null,{status:302,headers:{Location:env.SITE_ORIGIN+'/?auth_error=1','Set-Cookie':setCookie(env,'circle_oauth','',0)}});}
 }
 if(path==='/auth/logout'&&req.method==='POST'){
  const token=cookie(req,'circle_session');if(token){const digest=await hash(token);await env.DB.batch([env.DB.prepare('DELETE FROM push_subscriptions WHERE session_hash=?').bind(digest),env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(digest)]);await publishRealtime(env,{revokeSession:digest},ctx);}return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':setCookie(env,'circle_session','',0),'Cache-Control':'no-store'}});
 }
 fail('인증 경로를 찾을 수 없습니다.',404);
}
async function saveRecord(env,me,table,input,restore=false,ctx,clientId=''){
 if(!tables.includes(table))fail('지원하지 않는 자료입니다.',404);
 if(!input||typeof input!=='object'||Array.isArray(input))fail('잘못된 입력입니다.');
 const old=input.id?await get(env,table,input.id):null;
 if(input.id&&!old)fail('기록을 찾을 수 없습니다.',404);
 if(old&&input.revision!==undefined&&input.revision!==old.revision)fail('다른 곳에서 수정되었습니다. 새로고침 후 다시 시도하세요.',409);
 if(old?.deleted_at&&!restore)fail('삭제된 자료입니다.',404);
 const row={...(old||{}),...Object.fromEntries(fields[table].filter(k=>input[k]!==undefined).map(k=>[k,input[k]]))};
 if(table==='members'){
  requireAdmin(me);row.email=String(row.email||'').trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(row.email))fail('올바른 이메일을 입력하세요.');
  if(old&&row.email!==old.email)fail('등록된 이메일은 변경할 수 없습니다.');
  row.role=row.role||'member';row.active=row.active??true;memberChange(env,me,old,row);
 }else if(['characters','posts','comments','media'].includes(table)){
  row.owner_id=old?.owner_id||me.id;if(old&&!canEdit(me,old))fail('본인의 콘텐츠만 수정할 수 있습니다.',403);
 }
 if(table==='questions')Object.assign(row,questionRecord(me,old,restore?{...row,answered_by:input.answered_by??null,answered_at:input.answered_at??null}:row,await live(env,row.character_id),restore));
 if(table==='characters'){
  row.alias??='';row.extra??={};row.faction??='mage';for(const f of ['age','gender','race','origin','position','personality','background','goals','secrets'])row[f]??='';
  if(!row.extra||Array.isArray(row.extra)||typeof row.extra!=='object')fail('자유 설정은 객체로 입력하세요.');
  if(row.extra.theme_color!=null&&row.extra.theme_color!==''&&!(typeof row.extra.theme_color==='string'&&/^#[0-9a-f]{6}$/i.test(row.extra.theme_color)))fail('테마색은 #으로 시작하는 6자리 색상 코드로 입력하세요.');
  if(typeof row.extra.theme_color==='string')row.extra.theme_color=row.extra.theme_color.toLowerCase();
  if(row.extra.recruitment_status!=null&&!['','open','specific','closed'].includes(row.extra.recruitment_status))fail('자관 모집 상태를 확인하세요.');
  if(row.extra.recruitment_note!=null&&(typeof row.extra.recruitment_note!=='string'||row.extra.recruitment_note.length>500))fail('모집 내용은 500자 이내로 입력하세요.');
  if(row.extra.recruitment_status==='specific'&&!row.extra.recruitment_note?.trim())fail('모집 중인 특정 관계를 입력하세요.');
  if(row.image_path){const image=await env.DB.prepare('SELECT * FROM uploads WHERE path=?').bind(row.image_path).first();if(!image||image.owner_id!==row.owner_id)fail('본인이 업로드한 프로필 이미지를 선택하세요.',403);}
 }
 if(['affection','relationships'].includes(table)){
  const source=await live(env,row.source_id),target=await live(env,row.target_id);if(source.id===target.id)fail('서로 다른 캐릭터를 선택하세요.');
  if(old&&(source.id!==old.source_id||target.id!==old.target_id))fail('등록된 캐릭터는 바꿀 수 없습니다.');
  if(table==='affection'){
   if(source.owner_id!==me.id)fail('본인 캐릭터의 호감도만 수정할 수 있습니다.',403);row.note??='';
   if(!Number.isInteger(row.value)||row.value<0||row.value>100||row.value%5)fail('호감도는 0~100 사이의 5 단위입니다.');
  }else{row.kind??='사용자 지정';row.description??='';row.directed=!!row.directed;row.status??='pending';row.status=relationshipStatus(me,old,row,source,target);}
 }
 if(['posts','comments','media'].includes(table)&&row.character_id){const actor=await live(env,row.character_id);if(actor.owner_id!==row.owner_id)fail('작성자 소유 캐릭터만 선택할 수 있습니다.',403);}
 if(table==='posts'){
  if((row.category==='notice'||old?.category==='notice')&&!isAdmin(me))fail('공지 작성·수정은 운영자 전용입니다.',403);
  row.body??='';row.character_ids??=[];if(!Array.isArray(row.character_ids)||row.character_ids.length>100)fail('캐릭터 태그를 확인하세요.');for(const key of row.character_ids)await live(env,key);
 }
 if(['comments','media'].includes(table)&&row.post_id){const p=await get(env,'posts',row.post_id);if(!p||p.deleted_at)fail('게시글이 존재하지 않습니다.');if(table==='media'&&!canEdit(me,p))fail('본인 글에만 이미지를 첨부할 수 있습니다.',403);if(table==='media'&&p.category==='art'&&(!old||old.post_id!==row.post_id||old.deleted_at)){const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM media WHERE post_id=? AND deleted_at IS NULL').bind(p.id).first();if(count.n>=10)fail('로그 이미지는 최대 10장까지 첨부할 수 있습니다.');}}
 if(table==='comments'){
  row.character_id??=null;row.target_id??=null;row.post_id??=null;row.parent_id??=null;
  if(row.target_id)await live(env,row.target_id);
  if(old&&['target_id','post_id','parent_id'].some(k=>row[k]!==old[k]))fail('댓글 위치는 변경할 수 없습니다.');
  if(row.parent_id){const p=await get(env,'comments',row.parent_id);if(!p||p.deleted_at||p.parent_id||p.target_id!==row.target_id||p.post_id!==row.post_id)fail('같은 글의 댓글에만 답글을 작성할 수 있습니다.');}
 }
 if(table==='media'){
  row.caption??='';const obj=await env.DB.prepare('SELECT * FROM uploads WHERE path=?').bind(row.path).first();if(!obj||obj.owner_id!==row.owner_id)fail('본인의 업로드 파일을 선택하세요.',403);row.bytes=obj.bytes;row.mime=obj.mime;
 }
 for(const f of ['name','title','nickname','kind'])if(fields[table].includes(f)&&(!String(row[f]||'').trim()||String(row[f]).length>(f==='name'&&table==='relationships'?160:f==='title'?200:120)))fail('필수 항목 길이를 확인하세요: '+f);
 row.id=old?.id||id();row.created_at=old?.created_at||now();row.updated_at=now();row.revision=(old?.revision||0)+1;
 if(table!=='members')row.deleted_at=restore?(input.deleted_at||null):old?.deleted_at||null;
 const keys=Object.keys(row).filter(k=>!['image','google_sub'].includes(k));
 const stmt=old?env.DB.prepare(`UPDATE ${table} SET ${keys.filter(k=>k!=='id').map(k=>k+'=?').join(',')} WHERE id=? AND revision=?`).bind(...keys.filter(k=>k!=='id').map(k=>encode(row[k])),row.id,old.revision):env.DB.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).bind(...keys.map(k=>encode(row[k])));
 const events=restore?[]:await prepareNotifications(env,me,table,row,old);
 const changes=await env.DB.batch([stmt,env.DB.prepare('INSERT INTO history(id,table_name,record_id,actor_id,action,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()>0').bind(id(),table,row.id,me.id,restore?'restore':old?'update':'create',old?JSON.stringify(old):null,JSON.stringify(row),now()),...events.map(event=>notificationStatement(env,event,table,row))]);
 if(changes[0].meta.changes&&events.length){const delivery=sendNotifications(env,events).catch(()=>console.error('Push delivery failed'));if(ctx?.waitUntil)ctx.waitUntil(delivery);else await delivery;}
 if(!changes[0].meta.changes)fail('다른 요청과 충돌했습니다. 새로고침하세요.',409);
 await publishRealtime(env,{data:true,notificationMembers:events.map(event=>event.member_id),actorMember:me.id,actorClient:clientId},ctx);
 return table==='members'?memberView(env,row):row;
}
async function snapshot(env){
 const names=[...tables,'uploads','history','backup_runs','notifications'];const results=await env.DB.batch(names.map(t=>env.DB.prepare('SELECT * FROM '+t+' ORDER BY created_at,'+(t==='uploads'?'path':'id'))));return {format:'circle-cloudflare-v1',exported_at:now(),tables:Object.fromEntries(names.map((t,i)=>[t,results[i].results]))};
}
async function backupAuthorized(req,env,restore=false){const expected=restore?env.RESTORE_TOKEN:env.BACKUP_TOKEN;if(!expected||!req.headers.get('Authorization')||await hash(req.headers.get('Authorization'))!==await hash('Bearer '+expected))fail('백업 인증에 실패했습니다.',403);}
async function backupRoute(req,env,path,ctx){
 if(path==='/backup/snapshot'&&req.method==='GET'){await backupAuthorized(req,env);return json(await snapshot(env));}
 if(path.startsWith('/backup/file/')&&req.method==='GET'){await backupAuthorized(req,env);return serveFile(env,decodeURIComponent(path.slice(13)));}
 if(path==='/backup/status'&&req.method==='POST'){await backupAuthorized(req,env);const b=await req.json();await env.DB.prepare('INSERT INTO backup_runs(id,status,details,created_at) VALUES(?,?,?,?)').bind(id(),String(b.status).slice(0,30),JSON.stringify(b).slice(0,4000),now()).run();return json({ok:true});}
 if(path==='/backup/restore-file'&&req.method==='POST'){
  await backupAuthorized(req,env,true);const key=req.headers.get('X-Object-Key');if(!key||!/^[-a-zA-Z0-9/_.]+$/.test(key)||key.includes('..'))fail('잘못된 경로');const body=await req.arrayBuffer();validateImage(body,req.headers.get('Content-Type'));const digest=await hash(body);if(digest!==req.headers.get('X-Sha256'))fail('이미지 무결성 검증 실패');if(await env.MEDIA.head(key)) {const existing=await env.MEDIA.get(key);if(await hash(await existing.arrayBuffer())!==digest)fail('동일 경로에 다른 이미지가 존재합니다.',409);}else await env.MEDIA.put(key,body,{httpMetadata:{contentType:req.headers.get('Content-Type')}});return json({ok:true});
 }
 if(path==='/backup/restore'&&req.method==='POST'){
  await backupAuthorized(req,env,true);const b=await req.json();if(b.format!=='circle-cloudflare-v1')fail('잘못된 백업 형식');
  const names=[...tables.filter(t=>t!=='questions'||Array.isArray(b.tables?.questions)),'uploads','history',...(Array.isArray(b.tables?.backup_runs)?['backup_runs']:[]),...(Array.isArray(b.tables?.notifications)?['notifications']:[])];for(const t of names)if(!Array.isArray(b.tables?.[t]))fail('불완전한 백업: '+t);
  for(const u of b.tables.uploads){const obj=await env.MEDIA.head(u.path);if(!obj||obj.size!==u.bytes)fail('이미지 원본을 먼저 복구하세요: '+u.path);}
  const statements=[env.DB.prepare('PRAGMA defer_foreign_keys=ON')];
  for(const t of names){const schema=await env.DB.prepare('PRAGMA table_info('+t+')').all();const allowed=new Set(schema.results.map(c=>c.name));for(const row of b.tables[t]){const keys=Object.keys(row);if(!keys.length||keys.some(k=>!allowed.has(k)))fail('잘못된 백업 필드');statements.push(env.DB.prepare(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')}) ON CONFLICT(${t==='uploads'?'path':'id'}) DO UPDATE SET ${keys.map(k=>`${k}=excluded.${k}`).join(',')}`).bind(...keys.map(k=>row[k])));}}
  // Supplied snapshot is trusted only after explicit restore-token authentication.
  statements.push(env.DB.prepare('DELETE FROM sessions'),env.DB.prepare('DELETE FROM push_subscriptions'));await env.DB.batch(statements);await publishRealtime(env,{revokeAll:true},ctx);return json({ok:true});
 }
 fail('백업 경로를 찾을 수 없습니다.',404);
}
async function serveFile(env,key){const obj=await env.MEDIA.get(key);if(!obj)fail('이미지를 찾을 수 없습니다.',404);return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}
export default {async fetch(req,env,ctx){
 try{
  const url=new URL(req.url);const path=url.pathname.replace(/^\/api/,'');
  if(path.startsWith('/backup/'))return await backupRoute(req,env,path,ctx);
  if(!['GET','HEAD'].includes(req.method)&&req.headers.get('Origin')!==env.SITE_ORIGIN)fail('요청 출처를 확인할 수 없습니다.',403);
  if(path.startsWith('/auth/'))return await auth(req,env,path,ctx);
  const me=await session(req,env);
  if(path==='/me')return json(me);
  if(path==='/live')return await openRealtime(req,env,me,await hash(cookie(req,'circle_session')));
  if(path.startsWith('/notifications')||path.startsWith('/push/'))return await notificationRoute(req,env,path,me,await hash(cookie(req,'circle_session')),ctx);
  if(path==='/data'&&req.method==='GET'){
   const results=await env.DB.batch(tables.map(t=>env.DB.prepare('SELECT * FROM '+t+(t==='members'?'':' WHERE deleted_at IS NULL')+' ORDER BY created_at')));
   return json(Object.fromEntries(tables.map((t,i)=>[t,results[i].results.map(row=>{
    const record=decode(t,row);if(t!=='members')return record;
    const member=memberView(env,record);
    if(isAdmin(me)){delete member.google_sub;return member;}
    return Object.fromEntries(['id','nickname','role','active','created_at','updated_at','representative_character_id'].map(key=>[key,member[key]]));
   })])));

  }
  if(path==='/export'&&req.method==='GET'){requireSuperAdmin(me);return json(await snapshot(env));}
  if(path==='/profile'&&req.method==='POST'){
   const b=await req.json(),nickname=String(b.nickname||'').trim();if(!nickname||nickname.length>80)fail('닉네임은 1~80자입니다.');
   const representative=b.representative_character_id===undefined?me.representative_character_id:(b.representative_character_id||null);
   if(representative){const character=await live(env,representative);if(character.owner_id!==me.id)fail('본인의 캐릭터만 대표 캐릭터로 선택할 수 있습니다.',403);}
   await env.DB.prepare('UPDATE members SET nickname=?,representative_character_id=?,updated_at=?,revision=revision+1 WHERE id=?').bind(nickname,representative??null,now(),me.id).run();await publishRealtime(env,{data:true,actorMember:me.id,actorClient:requestClient(req)},ctx);return json(memberView(env,await get(env,'members',me.id)));
  }
  if(path==='/history'&&req.method==='GET'){requireSuperAdmin(me);return json((await env.DB.prepare('SELECT * FROM history ORDER BY created_at DESC LIMIT 200').all()).results);}
  if(/^\/history\/[^/]+\/restore$/.test(path)&&req.method==='POST'){requireSuperAdmin(me);const h=await env.DB.prepare('SELECT * FROM history WHERE id=?').bind(path.split('/')[2]).first();if(!h?.before_json)fail('복구할 이전 기록이 없습니다.');const before=JSON.parse(h.before_json);delete before.revision;return json(await saveRecord(env,me,h.table_name,before,true,ctx,requestClient(req)));}
  if(path.startsWith('/files/')&&req.method==='GET')return await serveFile(env,decodeURIComponent(path.slice(7)));
  if(path==='/upload'&&req.method==='POST'){
   const declared=Number(req.headers.get('Content-Length'));if(declared>10485760)fail('이미지는 10MB 이하여야 합니다.');const mime=req.headers.get('Content-Type');if(!['image/webp','image/gif'].includes(mime))fail('WebP 또는 GIF 이미지를 업로드하세요.');const bytes=await req.arrayBuffer();validateImage(bytes,mime);const ext={'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp'}[mime],key=me.id+'/'+id()+'.'+ext;await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});await env.DB.prepare('INSERT INTO uploads(path,owner_id,bytes,mime,sha256,created_at) VALUES(?,?,?,?,?,?)').bind(key,me.id,bytes.byteLength,mime,await hash(bytes),now()).run();return json({path:key});
  }
  const parts=path.split('/').filter(Boolean),table=parts[0];if(!tables.includes(table))fail('페이지를 찾을 수 없습니다.',404);
  if(parts.length===1&&req.method==='POST'){if(Number(req.headers.get('Content-Length'))>1000000)fail('입력 크기를 초과했습니다.');return json(await saveRecord(env,me,table,await req.json(),false,ctx,requestClient(req)));}
  if(parts.length===2&&req.method==='DELETE'){
   if(table==='members'||table==='affection')fail('이 기록은 삭제할 수 없습니다.');const old=await get(env,table,parts[1]);if(!old||old.deleted_at)fail('기록을 찾을 수 없습니다.',404);
   if(table==='questions'){const target=await live(env,old.character_id);if(!isAdmin(me)&&![old.owner_id,target.owner_id].includes(me.id))fail('질문자 또는 캐릭터 오너만 삭제할 수 있습니다.',403);}
   else if(table==='relationships'){const a=await live(env,old.source_id),b=await live(env,old.target_id);if(!isAdmin(me)&&![a.owner_id,b.owner_id].includes(me.id))fail('관계 당사자만 삭제할 수 있습니다.',403);}else if(!canEdit(me,old))fail('본인 콘텐츠만 삭제할 수 있습니다.',403);
   const stamp=now(),next={...old,deleted_at:stamp};const changed=await env.DB.batch([env.DB.prepare(`UPDATE ${table} SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?`).bind(stamp,stamp,old.id,old.revision),env.DB.prepare('INSERT INTO history(id,table_name,record_id,actor_id,action,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()>0').bind(id(),table,old.id,me.id,'delete',JSON.stringify(old),JSON.stringify(next),stamp)]);if(!changed[0].meta.changes)fail('다른 요청과 충돌했습니다. 새로고침하세요.',409);await publishRealtime(env,{data:true,actorMember:me.id,actorClient:requestClient(req)},ctx);return json({ok:true});
  }
  fail('지원하지 않는 요청입니다.',405);
 }catch(error){if(error instanceof Response)return error;console.error(error?.message);return json({error:'요청을 처리하지 못했습니다. 필수 항목과 데이터 연결을 확인하세요.'},400);}
}};
