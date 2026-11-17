import {publishRealtime,requestClient} from './realtime.mjs';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { fail } from './policy.mjs';

export const defaultPreferences = () => ({new_post:true,new_comment:true,tag:true,own_comment:true});
export function preferences(value={}) { return Object.fromEntries(Object.keys(defaultPreferences()).map(key=>[key,value[key]===undefined?true:value[key]===true])); }
export function mentionedCharacters(text) {return [...String(text||'').matchAll(/@\[[^\]]+\]\(([0-9a-f-]{36})\)/gi)].map(match=>match[1]);}
const preview=text=>String(text||'').replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi,'@$1').slice(0,180);
const tags=post=>[...new Set([...(post.character_ids||[]),...mentionedCharacters(post.body)])];

export function notificationEvents({table,row,old,actor,members,characters,post,parent}) {
 if(table==='questions'){
  const target=characters.find(character=>character.id===row.character_id&&!character.deleted_at);
  if(!target)return [];
  const answering=!!old&&row.answer!==old.answer&&!!row.answer;
  if(old&&!answering)return [];
  const recipient=answering?row.owner_id:target.owner_id;
  if(recipient===actor.id||!members.some(member=>member.id===recipient&&member.active))return [];
  return [{id:crypto.randomUUID(),member_id:recipient,event_key:'questions:'+row.id+':'+(answering?'answer-'+row.revision:'created'),kind:answering?'answer':'question',reasons:['own_comment'],title:target.name+(answering?'의 질문에 답변이 등록되었습니다':'에게 새 질문이 도착했습니다'),body:preview(answering?row.answer:row.body),url:'#/characters/'+target.id,created_at:row.updated_at}];
 }
 if(!['posts','comments'].includes(table))return [];
 const creating=!old;
 if(table==='comments'&&!creating)return [];
 const characterOwners=new Map(characters.filter(c=>!c.deleted_at).map(c=>[c.id,c.owner_id]));
 const newTags=table==='posts'?tags(row).filter(id=>!old||!tags(old).includes(id)):mentionedCharacters(row.body);
 const taggedOwners=new Set(newTags.map(id=>characterOwners.get(id)).filter(Boolean));
 const author=members.find(m=>m.id===actor.id)?.nickname||actor.nickname||'오너';
 const destination=table==='posts'?row:post;
 const url=destination?'#/board/'+destination.category+'/'+destination.id:'#/characters/'+row.target_id;
 return members.filter(member=>member.active && member.id!==actor.id).flatMap(member=>{
  const reasons=[];
  if(table==='posts'&&creating)reasons.push('new_post');
  if(table==='comments')reasons.push('new_comment');
  if(taggedOwners.has(member.id))reasons.push('tag');
  if(table==='comments'&&[post?.owner_id,parent?.owner_id,characterOwners.get(row.target_id)].includes(member.id))reasons.push('own_comment');
  if(!creating&&table==='posts'&&!reasons.includes('tag'))return [];
  if(!reasons.length)return [];
  const kind=reasons.includes('own_comment')?'own_comment':reasons.includes('tag')?'tag':table==='posts'?'new_post':'new_comment';
  const title={own_comment:author+'님이 내 글에 댓글을 남겼습니다',tag:author+'님이 내 캐릭터를 태그했습니다',new_post:author+'님의 새 글',new_comment:author+'님의 새 댓글'}[kind];
  return [{id:crypto.randomUUID(),member_id:member.id,event_key:table+':'+row.id+':'+(creating?'created':'tag-'+row.revision),kind,reasons,title,body:preview(row.title||row.body),url,created_at:row.updated_at}];
 });
}

export async function prepareNotifications(env,actor,table,row,old) {
 if(!['posts','comments','questions'].includes(table))return [];
 const [members,characters,post,parent]=await Promise.all([
  env.DB.prepare('SELECT id,nickname,active FROM members WHERE active=1').all(),
  env.DB.prepare('SELECT id,owner_id,deleted_at FROM characters').all(),
  row.post_id?env.DB.prepare('SELECT * FROM posts WHERE id=? AND deleted_at IS NULL').bind(row.post_id).first():null,
  row.parent_id?env.DB.prepare('SELECT * FROM comments WHERE id=? AND deleted_at IS NULL').bind(row.parent_id).first():null
 ]);
 return notificationEvents({table,row,old,actor,members:members.results,characters:characters.results,post,parent});
}
export function notificationStatement(env,event,table,row) {
 return env.DB.prepare(`INSERT INTO notifications(id,member_id,event_key,kind,reasons,title,body,url,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ${table} WHERE id=? AND revision=?) ON CONFLICT(member_id,event_key) DO NOTHING`).bind(event.id,event.member_id,event.event_key,event.kind,JSON.stringify(event.reasons),event.title,event.body,event.url,event.created_at,row.id,row.revision);
}
export function validateSubscription(subscription) {
 if(!subscription||typeof subscription.endpoint!=='string'||subscription.endpoint.length>2048)fail('잘못된 알림 구독입니다.');
 let url;try{url=new URL(subscription.endpoint);}catch{fail('잘못된 알림 주소입니다.');}
 const host=url.hostname;
 const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','push.services.mozilla.com','web.push.apple.com'].includes(host)||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');
 if(url.protocol!=='https:'||url.port||url.username||url.password||!allowed)fail('지원하지 않는 브라우저 푸시 주소입니다.');
 for(const [key,length] of [['p256dh',65],['auth',16]]) {
  const value=subscription.keys?.[key];
  if(typeof value!=='string'||!/^[-_A-Za-z0-9]+={0,2}$/.test(value)||value.length>100)fail('잘못된 알림 암호화 키입니다.');
  let bytes;try{bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}catch{fail('잘못된 알림 암호화 키입니다.');}
  if(bytes.length!==length||(key==='p256dh'&&bytes[0]!==4))fail('잘못된 알림 암호화 키입니다.');
 }
 return {endpoint:subscription.endpoint,expirationTime:subscription.expirationTime??null,keys:{p256dh:subscription.keys.p256dh,auth:subscription.keys.auth}};
}
export function shouldPush(event,prefs) {return event.reasons.some(reason=>prefs[reason]);}
export async function sendNotifications(env,events,send=fetch) {
 if(!events.length||!env.PUSH_VAPID_PUBLIC_KEY||!env.PUSH_VAPID_PRIVATE_KEY)return;
 const subscriptions=(await env.DB.prepare('SELECT p.* FROM push_subscriptions p JOIN members m ON m.id=p.member_id JOIN sessions s ON s.token_hash=p.session_hash AND s.member_id=p.member_id WHERE m.active=1 AND s.expires_at>?').bind(Date.now()).all()).results;
 // Bounded concurrency keeps fan-out within Workers' connection limit.
 const tasks=events.flatMap(event=>subscriptions.filter(sub=>sub.member_id===event.member_id&&shouldPush(event,preferences(JSON.parse(sub.preferences)))).map(sub=>({event,sub})));
 for(let index=0;index<tasks.length;index+=4)await Promise.all(tasks.slice(index,index+4).map(async({event,sub})=>{
  try {
   const subscription=validateSubscription(JSON.parse(sub.subscription));
   const payload=await buildPushPayload({data:{title:event.title,body:event.body,url:event.url,eventId:event.id},options:{ttl:86400,urgency:'normal'}},subscription,{subject:env.PUSH_VAPID_SUBJECT||'mailto:'+env.BOOTSTRAP_ADMIN_EMAIL,publicKey:env.PUSH_VAPID_PUBLIC_KEY,privateKey:env.PUSH_VAPID_PRIVATE_KEY});
   const response=await send(subscription.endpoint,{...payload,redirect:'error',signal:AbortSignal.timeout(10000)});
   if([404,410].includes(response.status))await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND member_id=?').bind(sub.endpoint,sub.member_id).run();
   else if(!response.ok)console.error('Push delivery failed: HTTP '+response.status);
   await response.body?.cancel();
  }catch{console.error('Push delivery failed');}
 }));
}

export async function notificationRoute(req,env,path,me,sessionHash,ctx) {
 if(Number(req.headers.get('Content-Length'))>20000)fail('알림 설정 입력 크기를 초과했습니다.');
 const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(path==='/notifications'&&req.method==='GET') {
  const results=await env.DB.batch([env.DB.prepare('SELECT * FROM notifications WHERE member_id=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(me.id),env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE member_id=? AND read_at IS NULL').bind(me.id)]);
  return json({items:results[0].results.map(item=>({...item,reasons:JSON.parse(item.reasons)})),unread:results[1].results[0].n});
 }
 if(path==='/notifications/read'&&req.method==='POST') {
  const body=await req.json(),stamp=new Date().toISOString();
  if(body.all===true)await env.DB.prepare('UPDATE notifications SET read_at=? WHERE member_id=? AND read_at IS NULL').bind(stamp,me.id).run();
  else {if(!Array.isArray(body.ids)||body.ids.length>50||body.ids.some(id=>typeof id!=='string'))fail('알림을 선택하세요.');if(body.ids.length)await env.DB.prepare('UPDATE notifications SET read_at=? WHERE member_id=? AND id IN ('+body.ids.map(()=>'?').join(',')+')').bind(stamp,me.id,...body.ids).run();}
  await publishRealtime(env,{notificationMembers:[me.id],actorMember:me.id,actorClient:requestClient(req)},ctx);
  return json({ok:true});
 }
 if(path==='/push/config'&&req.method==='GET')return json({configured:!!(env.PUSH_VAPID_PUBLIC_KEY&&env.PUSH_VAPID_PRIVATE_KEY),publicKey:env.PUSH_VAPID_PUBLIC_KEY||''});
 if(path==='/push/state'&&req.method==='POST') {
  const body=await req.json();
  const sub=await env.DB.prepare('SELECT preferences,session_hash FROM push_subscriptions WHERE endpoint=? AND member_id=?').bind(String(body.endpoint||''),me.id).first();
  return json({subscribed:!!sub,preferences:sub?preferences(JSON.parse(sub.preferences)):defaultPreferences()});
 }
 if(path==='/push/subscribe'&&req.method==='POST') {
  if(!env.PUSH_VAPID_PUBLIC_KEY||!env.PUSH_VAPID_PRIVATE_KEY)fail('운영자가 푸시 알림 서버 키를 먼저 설정해야 합니다.',503);
  const body=await req.json(),subscription=validateSubscription(body.subscription),stamp=new Date().toISOString();
  const old=await env.DB.prepare('SELECT member_id FROM push_subscriptions WHERE endpoint=?').bind(subscription.endpoint).first();
  if(old&&old.member_id!==me.id)fail('다른 계정의 기기 알림입니다. 기기 알림을 해제한 뒤 다시 신청하세요.',403);
  const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE member_id=?').bind(me.id).first();
  if(!old&&count.n>=10)fail('계정당 알림 기기는 최대 10개입니다.');
  await env.DB.prepare('INSERT INTO push_subscriptions(endpoint,member_id,session_hash,subscription,preferences,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET session_hash=excluded.session_hash,subscription=excluded.subscription,preferences=excluded.preferences,updated_at=excluded.updated_at WHERE push_subscriptions.member_id=excluded.member_id').bind(subscription.endpoint,me.id,sessionHash,JSON.stringify(subscription),JSON.stringify(preferences(body.preferences)),stamp,stamp).run();
  return json({ok:true});
 }
 if(path==='/push/unsubscribe'&&req.method==='POST') {const body=await req.json();await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND member_id=?').bind(String(body.endpoint||''),me.id).run();return json({ok:true});}
 fail('알림 경로를 찾을 수 없습니다.',404);
}
