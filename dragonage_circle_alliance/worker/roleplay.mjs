import {affiliationType,affiliationLabel} from '../src/affiliation.mjs';
import { fail, isAdmin, validateImage } from './policy.mjs';
import { publishRealtime, requestClient } from './realtime.mjs';
import { sendNotifications, mentionedCharacters } from './notifications.mjs';

export const roleplayTables = ['rp_scenes','rp_messages','rp_assets','rp_changes','rp_preferences','rp_reads'];
const json = data => new Response(JSON.stringify(data), {headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const stamp = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const list = (value, label) => {
 if (!Array.isArray(value) || value.length>100 || value.some(id=>typeof id!=='string'||!id)) fail(label+' 목록을 확인하세요.');
 return [...new Set(value)];
};
const text = (value,max,required=false) => {
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail('입력 내용과 길이를 확인하세요.');
 return value;
};
const decode = (table,row) => row ? {...row,...Object.fromEntries((table==='rp_scenes'?['participant_ids','member_ids','admin_ids']:['attachments']).map(key=>[key,JSON.parse(row[key]||'[]')]))} : null;
const get = async (env,table,id) => decode(table,await env.DB.prepare('SELECT * FROM '+table+' WHERE id=?').bind(id).first());
const characterRows = async env => (await env.DB.prepare('SELECT id,owner_id,name,faction,extra,deleted_at FROM characters').all()).results;
export function canReadScene(me,scene,characters) {
 return !!scene && !scene.deleted_at && (scene.visibility==='members'||scene.owner_id===me.id||scene.member_ids.includes(me.id)||
  scene.participant_ids.some(id=>characters.some(c=>c.id===id&&c.owner_id===me.id))||(isAdmin(me)&&scene.admin_ids.includes(me.id)));
}
function participant(me,scene,characters) {
 return scene.owner_id===me.id || scene.member_ids.includes(me.id) || scene.participant_ids.some(id=>characters.some(c=>c.id===id&&c.owner_id===me.id));
}
async function accessibleScene(env,me,id,characters) {
 const scene=await get(env,'rp_scenes',id);
 if(!canReadScene(me,scene,characters))fail('장면을 찾을 수 없거나 열람 권한이 없습니다.',404);
 return scene;
}
export async function authorizeRoleplayFile(env,me,path) {
 const asset=await env.DB.prepare('SELECT * FROM rp_assets WHERE path=?').bind(path).first();
 if(asset?.scene_id)await accessibleScene(env,me,asset.scene_id,await characterRows(env));
}
export async function filterRoleplayHistory(env,me,rows) {
 if(!rows.some(row=>['rp_scenes','rp_messages'].includes(row.table_name)))return rows;
 const characters=await characterRows(env),scenes=(await env.DB.prepare('SELECT * FROM rp_scenes').all()).results.map(row=>decode('rp_scenes',row));
 return rows.filter(history=>{
  if(!['rp_scenes','rp_messages'].includes(history.table_name))return true;
  const row=JSON.parse(history.after_json),sceneId=history.table_name==='rp_scenes'?row.id:row.scene_id;
  if(!sceneId)return true;
  const scene=scenes.find(scene=>scene.id===sceneId);
  return scene&&canReadScene(me,{...scene,deleted_at:null},characters);
 });
}
export async function restoreRoleplayHistory(env,me,history,ctx,client) {
 if(!(await filterRoleplayHistory(env,me,[history])).length)fail('장면 접근 권한이 없습니다.',403);
 const before=JSON.parse(history.before_json),old=await get(env,history.table_name,history.record_id);
 if(!old||before.id!==old.id)fail('복구할 역극 기록을 찾을 수 없습니다.',404);
 const row={...before,revision:old.revision+1,updated_at:stamp()};
 return commit(env,me,history.table_name,row,old,[],ctx,client);
}
async function checkAssets(env,me,paths,sceneId) {
 for(const path of paths) {
  if(typeof path!=='string')fail('첨부 이미지를 확인하세요.');
  const asset=await env.DB.prepare('SELECT * FROM rp_assets WHERE path=?').bind(path).first();
  if(!asset||asset.owner_id!==me.id||asset.scene_id!==(sceneId||null))fail('이 장면에 직접 업로드한 이미지만 첨부할 수 있습니다.',403);
 }
}
async function commit(env,me,table,row,old,events,ctx,client) {
 const encoded=Object.fromEntries(Object.entries(row).map(([key,value])=>[key,Array.isArray(value)?JSON.stringify(value):value]));
 const keys=Object.keys(encoded),columns=keys.filter(key=>key!=='id');
 const historyId=uuid();
 const statement=old ? env.DB.prepare(`UPDATE ${table} SET ${columns.map(key=>key+'=?').join(',')} WHERE id=? AND revision=?`).bind(...columns.map(key=>encoded[key]),row.id,old.revision) :
  env.DB.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).bind(...keys.map(key=>encoded[key]));
 const result=await env.DB.batch([
  statement,
  env.DB.prepare('INSERT INTO rp_changes(record_type,record_id,created_at) SELECT ?,?,? WHERE changes()>0').bind(table,row.id,row.updated_at),
  env.DB.prepare('INSERT INTO history(id,table_name,record_id,actor_id,action,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()>0').bind(historyId,table,row.id,me.id,row.deleted_at?'delete':old?'update':'create',old?JSON.stringify(old):null,JSON.stringify(row),row.updated_at),
  ...events.map(event=>env.DB.prepare('INSERT INTO notifications(id,member_id,event_key,kind,reasons,title,body,url,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM history WHERE id=?) ON CONFLICT(member_id,event_key) DO NOTHING').bind(event.id,event.member_id,event.event_key,event.kind,JSON.stringify(event.reasons),event.title,event.body,event.url,event.created_at,historyId)),
 ]);
 if(!result[0].meta.changes)fail('다른 곳에서 수정되었습니다. 새로고침 후 다시 시도하세요.',409);
 await publishRealtime(env,{roleplay:true,notificationMembers:events.map(event=>event.member_id),actorMember:me.id,actorClient:client},ctx);
 const delivery=sendNotifications(env,events).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(delivery);else await delivery;
 return row;
}
async function roleplayEvents(env,me,recipients,row,scene,characters,type='message') {
 const events=[];
 for(const [memberId,reason] of recipients)if(memberId&&memberId!==me.id) {
  const member=await env.DB.prepare('SELECT * FROM members WHERE id=? AND active=1').bind(memberId).first();
  const pref=await env.DB.prepare('SELECT mode FROM rp_preferences WHERE id=?').bind(memberId).first();
  if(!member||pref?.mode==='off'||(pref?.mode==='replies'&&reason!=='reply')||(pref?.mode==='mentions'&&!['mention','invite'].includes(reason)))continue;
  if(scene&&!canReadScene(member,scene,characters))continue;
  events.push({id:uuid(),member_id:memberId,event_key:'roleplay:'+type+':'+row.id+':'+row.revision,kind:'own_comment',reasons:['own_comment'],title:{reply:'내 역극에 답글이 도착했습니다',mention:'내 캐릭터가 역극에 언급되었습니다',invite:'새 역극 장면에 초대되었습니다',scene:'참여 중인 장면에 새 글이 도착했습니다'}[reason],body:'역극에서 내용을 확인하세요.',url:'#/roleplay/'+(scene?'scene/'+scene.id:'thread/'+row.thread_id),created_at:row.updated_at});
 }
 return events;
}
function revision(input,old) {
 if(old&&input.revision!==old.revision)fail('다른 곳에서 수정되었습니다. 새로고침 후 다시 시도하세요.',409);
}
export async function roleplayRoute(req,env,me,ctx) {
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\/roleplay/,'');
 const characters=await characterRows(env),client=requestClient(req);
 if(!['GET','HEAD'].includes(req.method)&&path!=='/upload'&&Number(req.headers.get('Content-Length'))>1000000)fail('입력 크기를 초과했습니다.');
 if(path==='/export'&&req.method==='GET') {
  const sceneId=url.searchParams.get('scene'),threadId=url.searchParams.get('thread');
  if(!sceneId&&!threadId)fail('내보낼 역극을 선택하세요.');
  let title='자유 역극';
  if(sceneId)title=(await accessibleScene(env,me,sceneId,characters)).title;
  else {const root=await get(env,'rp_messages',threadId);if(!root||root.scene_id)fail('자유 역극을 찾을 수 없습니다.',404);}
  const rows=(await env.DB.prepare('SELECT * FROM rp_messages WHERE '+(sceneId?'scene_id=?':'thread_id=? AND scene_id IS NULL')+' ORDER BY created_at,id').bind(sceneId||threadId).all()).results;
  const output=[title,...rows.filter(row=>!row.deleted_at&&(url.searchParams.get('ooc')!=='hide'||row.character_id)).map(row=>`${row.created_at} · ${row.character_id?'['+affiliationLabel({faction:row.faction})+']':'[OOC / 오너]'} ${row.author_name}\n${row.body}`)].join('\n\n');
  const html=url.searchParams.get('format')==='html',escape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  return new Response(html?'<!doctype html><html lang="ko"><meta charset="utf-8"><title>'+escape(title)+'</title><style>body{max-width:80ch;margin:40px auto;padding:20px;font:16px/1.9 sans-serif}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><pre>'+escape(output)+'</pre></html>':output,{headers:{'Content-Type':html?'text/html; charset=utf-8':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="roleplay.'+(html?'html':'txt')+'"','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});
 }
 if(path==='/preferences') {
  if(req.method==='GET')return json(await env.DB.prepare('SELECT mode FROM rp_preferences WHERE id=?').bind(me.id).first()||{mode:'all'});
  if(req.method==='POST') {
   const {mode}=await req.json();if(!['all','replies','mentions','off'].includes(mode))fail('알림 설정을 확인하세요.');
   const at=stamp();await env.DB.prepare('INSERT INTO rp_preferences(id,mode,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET mode=excluded.mode,updated_at=excluded.updated_at').bind(me.id,mode,at,at).run();return json({mode});
  }
 }
 if(path==='/read'&&req.method==='POST') {
  const input=await req.json(),message=await get(env,'rp_messages',input.message_id);
  if(!message)fail('메시지가 없습니다.',404);
  if(message.scene_id)await accessibleScene(env,me,message.scene_id,characters);
  const scope=message.scene_id?'scene:'+message.scene_id:'thread:'+message.thread_id,at=stamp();
  await env.DB.prepare('INSERT INTO rp_reads(id,member_id,scope,message_id,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(member_id,scope) DO UPDATE SET message_id=excluded.message_id,updated_at=excluded.updated_at').bind(uuid(),me.id,scope,message.id,at,at).run();return json({ok:true});
 }
 if(path==='/sync'&&req.method==='GET') {
  let cursor=Number(url.searchParams.get('cursor')||0);if(!Number.isSafeInteger(cursor)||cursor<0)fail('갱신 위치가 올바르지 않습니다.');
  const latest=(await env.DB.prepare('SELECT COALESCE(MAX(id),0) n FROM rp_changes').first()).n;
  const reset=cursor>latest;if(reset)cursor=0;
  const page=(await env.DB.prepare('SELECT id FROM rp_changes WHERE id>? AND id<=? ORDER BY id LIMIT 200').bind(cursor,latest).all()).results;
  const upper=page.at(-1)?.id||cursor;
  const scenes=(await env.DB.prepare('SELECT * FROM rp_scenes').all()).results.map(row=>decode('rp_scenes',row)).filter(scene=>canReadScene(me,scene,characters));
  const visible=new Set(scenes.map(scene=>scene.id));
  // Newly accessible scenes must supply their earlier messages as well as new changes.
  const known=(url.searchParams.get('scenes')||'').split(',').filter(Boolean);
  const newlyVisible=scenes.filter(scene=>!known.includes(scene.id)).map(scene=>scene.id);
  const rows=(await env.DB.prepare("SELECT m.* FROM rp_messages m WHERE EXISTS(SELECT 1 FROM rp_changes c WHERE c.record_type='rp_messages' AND c.record_id=m.id AND c.id>? AND c.id<=?) ORDER BY m.created_at,m.id").bind(cursor,upper).all()).results;
  // Scene histories are paged separately when an invitation reveals an old scene.
  const reads=(await env.DB.prepare('SELECT scope,message_id,updated_at FROM rp_reads WHERE member_id=?').bind(me.id).all()).results.filter(read=>!read.scope.startsWith('scene:')||visible.has(read.scope.slice(6)));
  return json({cursor:upper,has_more:upper<latest,reset,scenes,newly_visible:newlyVisible,reads,messages:rows.filter(row=>!row.scene_id||visible.has(row.scene_id)).map(row=>{
   const message=decode('rp_messages',row);
   return message.deleted_at?{...message,body:'',attachments:[]}:message;
  })});
 }
 if(partsForHistory(path)&&req.method==='GET') {
  const sceneId=path.split('/')[2];await accessibleScene(env,me,sceneId,characters);
  const after=url.searchParams.get('after')||'';
  const rows=(await env.DB.prepare('SELECT * FROM rp_messages WHERE scene_id=? AND id>? ORDER BY id LIMIT 100').bind(sceneId,after).all()).results;
  return json({messages:rows.map(row=>{const message=decode('rp_messages',row);return message.deleted_at?{...message,body:'',attachments:[]}:message;}),next:rows.length===100?rows.at(-1).id:null});
 }
 if(path==='/upload'&&req.method==='POST') {
  const sceneId=url.searchParams.get('scene')||null;
  if(sceneId) {
   const scene=await accessibleScene(env,me,sceneId,characters);
   if(!participant(me,scene,characters)&&scene.join_policy!=='open')fail('초대된 참여자만 첨부할 수 있습니다.',403);
  }
  if(Number(req.headers.get('Content-Length'))>10485760)fail('이미지는 10MB 이하여야 합니다.');
  const mime=req.headers.get('Content-Type');if(!['image/webp','image/gif'].includes(mime))fail('WebP 또는 GIF 이미지를 업로드하세요.');
  const bytes=await req.arrayBuffer();validateImage(bytes,mime);
  const path=me.id+'/'+uuid()+(mime==='image/gif'?'.gif':'.webp'),created=stamp();
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  await env.MEDIA.put(path,bytes,{httpMetadata:{contentType:mime}});
  await env.DB.batch([
   env.DB.prepare('INSERT INTO uploads(path,owner_id,bytes,mime,sha256,created_at) VALUES(?,?,?,?,?,?)').bind(path,me.id,bytes.byteLength,mime,sha,created),
   env.DB.prepare('INSERT INTO rp_assets(path,owner_id,scene_id,created_at) VALUES(?,?,?,?)').bind(path,me.id,sceneId,created),
  ]);
  return json({path});
 }
 const parts=path.split('/').filter(Boolean);
 if(parts[0]==='scenes'&&req.method==='POST') {
  if(!(parts.length===1||(parts.length===3&&['join','invite'].includes(parts[2]))))fail('장면 경로를 확인하세요.',404);
  const input=await req.json(),old=input.id?await accessibleScene(env,me,input.id,characters):null;
  revision(input,old);
  const row=old?{...old}:{id:uuid(),owner_id:me.id,title:'',description:'',location:'',visibility:'members',join_policy:'open',status:'active',participant_ids:[],member_ids:[],admin_ids:[],image_path:null,created_at:stamp(),deleted_at:null,revision:0};
  if(parts[2]==='join') {
   if(!old||parts[1]!==old.id||old.join_policy!=='open')fail('공개 참여 장면에서만 참여할 수 있습니다.',403);
   const character=input.character_id?characters.find(c=>c.id===input.character_id&&!c.deleted_at&&c.owner_id===me.id):null;
   if(input.character_id&&!character)fail('본인 캐릭터로만 참여할 수 있습니다.',403);
   if(character)row.participant_ids=[...new Set([...row.participant_ids,character.id])];
   else row.member_ids=[...new Set([...row.member_ids,me.id])];
  } else if(parts[2]==='invite') {
   if(!old||parts[1]!==old.id||(!participant(me,old,characters)&&!isAdmin(me)))fail('장면 참여자만 초대할 수 있습니다.',403);
   row.participant_ids=[...new Set([...row.participant_ids,...list(input.participant_ids,'참여 캐릭터')])];
  } else {
   if(old&&old.owner_id!==me.id&&!isAdmin(me))fail('장면 생성자만 설정을 수정할 수 있습니다.',403);
   for(const key of ['title','description','location','visibility','join_policy','status','participant_ids','admin_ids','image_path'])if(input[key]!==undefined)row[key]=input[key];
   text(row.title,200,true);text(row.description,20000);text(row.location,200);
   if(!['members','participants'].includes(row.visibility)||!['open','invite'].includes(row.join_policy)||!['active','paused','ended','archived'].includes(row.status))fail('장면 설정을 확인하세요.');
   row.participant_ids=list(row.participant_ids,'참여 캐릭터');row.admin_ids=list(row.admin_ids,'허가 운영자');
   for(const id of row.admin_ids){const member=await env.DB.prepare('SELECT role,active FROM members WHERE id=?').bind(id).first();if(!member?.active||!isAdmin(member))fail('허가할 운영자를 확인하세요.');}
   if(!old&&row.image_path)fail('장면을 만든 뒤 대표 이미지를 첨부하세요.');
   if(row.image_path&&row.image_path!==old?.image_path)await checkAssets(env,me,[row.image_path],old.id);
  }
  for(const id of row.participant_ids)if(!characters.some(c=>c.id===id&&(!c.deleted_at||old?.participant_ids.includes(id))))fail('존재하지 않는 참여 캐릭터입니다.');
  row.updated_at=stamp();row.revision++;
  const recipients=new Map(row.participant_ids.filter(id=>!old?.participant_ids.includes(id)).map(id=>[characters.find(c=>c.id===id)?.owner_id,'invite']));
  const events=await roleplayEvents(env,me,recipients,row,row,characters,'invite');
  const saved=await commit(env,me,'rp_scenes',row,old,events,ctx,client);
  return json(saved);
 }
 if(parts[0]==='messages'&&req.method==='POST') {
  const input=await req.json();
  if(!input.id) {
   if(typeof input.request_id!=='string'||!/^[-\w]{1,100}$/.test(input.request_id))fail('전송 식별자가 필요합니다.');
   const duplicate=decode('rp_messages',await env.DB.prepare('SELECT * FROM rp_messages WHERE owner_id=? AND request_id=?').bind(me.id,input.request_id).first());
   if(duplicate){if(duplicate.scene_id)await accessibleScene(env,me,duplicate.scene_id,characters);return json(duplicate.deleted_at?{...duplicate,body:'',attachments:[]}:duplicate);}
  }
  const old=input.id?await get(env,'rp_messages',input.id):null;
  if(input.id&&!old)fail('메시지를 찾을 수 없습니다.',404);
  if(old?.deleted_at)fail('삭제된 메시지입니다.',404);
  if(old&&old.owner_id!==me.id)fail('본인의 메시지만 수정할 수 있습니다.',403);
  revision(input,old);
  const sceneId=old?.scene_id||input.scene_id||null,scene=sceneId?await accessibleScene(env,me,sceneId,characters):null;
  if(old&&['scene_id','parent_id','character_id','thread_id'].some(key=>input[key]!==undefined&&input[key]!==old[key]))fail('작성자와 대화 위치는 바꿀 수 없습니다.');
  if(scene) {
   if(scene.status!=='active'&&!old)fail('진행 중인 장면에서 작성할 수 있습니다.');
   if(!participant(me,scene,characters))fail('장면에 먼저 참여하거나 초대를 받으세요.',403);
  }
  const characterId=old?old.character_id:(input.character_id||null),character=characterId?characters.find(c=>c.id===characterId):null;
  if(!old&&characterId&&(!character||character.deleted_at||character.owner_id!==me.id))fail('본인 캐릭터로만 작성할 수 있습니다.',403);
  if(!old&&scene&&characterId&&!scene.participant_ids.includes(characterId))fail('장면에 참여한 캐릭터를 선택하세요.',403);
  const parentId=old?.parent_id||input.parent_id||null,parent=parentId?await get(env,'rp_messages',parentId):null;
  if(!old&&parentId&&(!parent||parent.deleted_at||parent.scene_id!==sceneId))fail('같은 대화의 메시지에 답글을 작성하세요.');
  const attachments=list(input.attachments??old?.attachments??[],'첨부 이미지');if(attachments.length>10)fail('이미지는 최대 10장입니다.');
  await checkAssets(env,me,attachments.filter(path=>!old?.attachments.includes(path)),sceneId);
  const body=text(input.body??old?.body??'',20000);if(!body.trim()&&!attachments.length)fail('본문 또는 이미지를 입력하세요.');
  const id=old?.id||uuid(),row={id,owner_id:me.id,character_id:characterId,scene_id:sceneId,parent_id:parentId,thread_id:old?.thread_id||parent?.thread_id||id,
   author_name:old?.author_name||character?.name||me.nickname,faction:old?.faction||(character?affiliationType({...character,extra:JSON.parse(character.extra||'{}')}):null),body,attachments,request_id:old?.request_id||input.request_id,created_at:old?.created_at||stamp(),updated_at:stamp(),deleted_at:null,revision:(old?.revision||0)+1};
  const recipients=new Map();
  if(!old) {
   if(scene){recipients.set(scene.owner_id,'scene');scene.member_ids.forEach(id=>recipients.set(id,'scene'));scene.participant_ids.forEach(id=>recipients.set(characters.find(c=>c.id===id)?.owner_id,'scene'));}
   else if(parent)for(const row of (await env.DB.prepare('SELECT DISTINCT owner_id FROM rp_messages WHERE thread_id=? AND deleted_at IS NULL').bind(parent.thread_id).all()).results)recipients.set(row.owner_id,'scene');
   if(parent)recipients.set(parent.owner_id,'reply');
   mentionedCharacters(body).forEach(id=>recipients.set(characters.find(c=>c.id===id&&!c.deleted_at)?.owner_id,'mention'));
  }
  const events=await roleplayEvents(env,me,recipients,row,scene,characters);
  try{return json(await commit(env,me,'rp_messages',row,old,events,ctx,client));}
  catch(error){if(!old){const duplicate=decode('rp_messages',await env.DB.prepare('SELECT * FROM rp_messages WHERE owner_id=? AND request_id=?').bind(me.id,row.request_id).first());if(duplicate)return json(duplicate.deleted_at?{...duplicate,body:'',attachments:[]}:duplicate);}throw error;}
 }
 if(['messages','scenes'].includes(parts[0])&&parts.length===2&&req.method==='DELETE') {
  const table=parts[0]==='messages'?'rp_messages':'rp_scenes',old=await get(env,table,parts[1]);
  if(!old||old.deleted_at)fail('기록을 찾을 수 없습니다.',404);
  const scene=table==='rp_scenes'?old:old.scene_id?await accessibleScene(env,me,old.scene_id,characters):null;
  if(scene&&!canReadScene(me,scene,characters))fail('장면 접근 권한이 없습니다.',403);
  if(old.owner_id!==me.id&&!isAdmin(me))fail('본인의 기록만 삭제할 수 있습니다.',403);
  const expected=Number(req.headers.get('X-Revision'));if(expected!==old.revision)fail('다른 곳에서 수정되었습니다.',409);
  const row={...old,deleted_at:stamp(),updated_at:stamp(),revision:old.revision+1};
  await commit(env,me,table,row,old,[],ctx,client);return json({ok:true});
 }
 fail('역극 경로를 찾을 수 없습니다.',404);
}
function partsForHistory(path){return /^\/scenes\/[^/]+\/history$/.test(path);}
