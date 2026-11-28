import {fail} from './policy.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const select="SELECT c.*,m.nickname,m.representative_character_id FROM chat_messages c JOIN members m ON m.id=c.member_id";
const room=env=>{if(!env.CHAT)fail('잡담 연결 설정이 필요합니다.',503);return env.CHAT.get(env.CHAT.idFromName('all-members'));};
export async function notifyChat(env,change){
 if(!env.CHAT||!(change.revokeAll||change.revokeSession||change.chatMembers))return;
 const response=await room(env).fetch('https://chat.internal/refresh',{method:'POST',body:JSON.stringify(change)});
 if(!response.ok)throw Error('Chat refresh failed');
}
export async function chatRoute(req,env,me,sessionHash){
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\/chat/,'');
 if(path==='/live'&&req.method==='GET'){
  if(req.headers.get('Origin')!==env.SITE_ORIGIN)fail('요청 출처를 확인할 수 없습니다.',403);
  if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')fail('WebSocket 연결이 필요합니다.',426);
  return room(env).fetch('https://chat.internal/connect',{headers:{Upgrade:'websocket','X-Member-Id':me.id,'X-Session-Hash':sessionHash}});
 }
 if(path==='/messages'&&req.method==='GET'){
  const before=url.searchParams.get('before'),after=url.searchParams.get('after');
  if(before!==null&&after!==null)fail('기록 조회 방향을 확인하세요.');
  const value=before??after;
  if(value!==null&&(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))))fail('기록 위치를 확인하세요.');
  const ascending=after!==null;
  const result=await env.DB.prepare(select+(value!==null?(' WHERE c.id '+(ascending?'>':'<')+' ?'):'')+' ORDER BY c.id '+(ascending?'ASC':'DESC')+' LIMIT 51').bind(...(value!==null?[Number(value)]:[])).all();
  const messages=result.results.slice(0,50);if(!ascending)messages.reverse();
  return json({messages,has_more:result.results.length>50,cursor:messages.at(-1)?.id??Number(after||0)});
 }
 if(path==='/messages'&&req.method==='POST'){
  if(Number(req.headers.get('Content-Length'))>12000)fail('메시지는 2,000자까지 보낼 수 있습니다.');
  const bytes=await req.arrayBuffer();if(bytes.byteLength>12000)fail('메시지가 너무 깁니다.');
  let input;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('메시지를 확인하세요.');}
  return room(env).fetch('https://chat.internal/message',{method:'POST',headers:{'Content-Type':'application/json','X-Member-Id':me.id,'X-Session-Hash':sessionHash},body:JSON.stringify(input)});
 }
 fail('잡담 경로를 찾을 수 없습니다.',404);
}
export class ChatRoom {
 constructor(ctx,env){this.ctx=ctx;this.env=env;if(typeof WebSocketRequestResponsePair!=='undefined')ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 sockets(){return this.ctx.getWebSockets().filter(socket=>socket.readyState===1&&!socket.deserializeAttachment()?.closed);}
 async member(memberId,sessionHash){
  return this.env.DB.prepare('SELECT m.id,m.nickname,m.representative_character_id,s.expires_at FROM members m JOIN sessions s ON s.member_id=m.id WHERE m.id=? AND m.active=1 AND s.token_hash=? AND s.expires_at>?').bind(memberId,sessionHash,Date.now()).first();
 }
 drop(socket,code=1000){if(code===1008){try{socket.send(JSON.stringify({type:'session-ended'}));}catch{}}const state=socket.deserializeAttachment();socket.serializeAttachment({...state,closed:true,typingUntil:0});try{socket.close(code,code===1008?'Session ended':'Connection closed');}catch{}}
 send(socket,event){try{socket.send(JSON.stringify(event));}catch{this.drop(socket,1011);}}
 presence(){
  const now=Date.now(),members=new Map(),typing=new Set();
  for(const socket of this.sockets()){const state=socket.deserializeAttachment();members.set(state.memberId,{id:state.memberId,nickname:state.nickname,representative_character_id:state.representativeId});if(state.typingUntil>now)typing.add(state.memberId);}
  return {type:'presence',members:[...members.values()].sort((a,b)=>a.id.localeCompare(b.id)),typing:[...typing]};
 }
 broadcast(event){for(const socket of this.sockets())this.send(socket,event);}
 async schedule(){
  const sockets=this.sockets();if(!sockets.length){await this.ctx.storage.deleteAlarm();return;}
  const now=Date.now();let next=now+75000;
  for(const socket of sockets){const state=socket.deserializeAttachment(),ping=this.ctx.getWebSocketAutoResponseTimestamp?.(socket)?.getTime()||state.connectedAt;next=Math.min(next,state.expiresAt,ping+75000,...(state.typingUntil>now?[state.typingUntil]:[]));}
  const current=await this.ctx.storage.getAlarm();if(current===null||current>next)await this.ctx.storage.setAlarm(Math.max(now+50,next));
 }
 async announce(){this.broadcast(this.presence());await this.schedule();}
 async refresh(change={}){
  for(const socket of this.sockets()){
   const state=socket.deserializeAttachment();
   if(change.revokeAll||change.revokeSession===state.sessionHash){this.drop(socket,1008);continue;}
   const member=await this.member(state.memberId,state.sessionHash);
   if(!member){this.drop(socket,1008);continue;}
   socket.serializeAttachment({...state,nickname:member.nickname,representativeId:member.representative_character_id,expiresAt:member.expires_at});
  }
  await this.announce();
 }
 async fetch(req){try{
  const path=new URL(req.url).pathname;
  if(path==='/refresh'&&req.method==='POST'){await this.refresh(await req.json());return new Response(null,{status:204});}
  const memberId=req.headers.get('X-Member-Id'),sessionHash=req.headers.get('X-Session-Hash');
  const member=memberId&&sessionHash?await this.member(memberId,sessionHash):null;if(!member)fail('로그인이 만료되었습니다.',401);
  if(path==='/connect'&&req.headers.get('Upgrade')?.toLowerCase()==='websocket'){
   if(this.sockets().filter(socket=>socket.deserializeAttachment().memberId===member.id).length>=8)fail('잡담 창은 계정당 8개까지 열 수 있습니다.',429);
   const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.ctx.acceptWebSocket(server,['member:'+member.id]);
   server.serializeAttachment({memberId:member.id,sessionHash,nickname:member.nickname,representativeId:member.representative_character_id,expiresAt:member.expires_at,connectedAt:Date.now(),typingUntil:0,lastTyping:0,burstAt:Date.now(),burstCount:0});
   this.send(server,{type:'ready'});await this.announce();return new Response(null,{status:101,webSocket:client});
  }
  if(path==='/message'&&req.method==='POST'){
   const input=await req.json();
   if(!input||typeof input.body!=='string'||!input.body.trim()||input.body.length>2000||typeof input.client_message_id!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(input.client_message_id))fail('메시지는 1~2,000자로 입력하세요.');
   const body=input.body.trim();let message=await this.env.DB.prepare(select+' WHERE c.member_id=? AND c.client_message_id=?').bind(member.id,input.client_message_id).first();
   if(message&&message.body!==body)fail('전송 요청이 이미 다른 내용으로 처리되었습니다.',409);
   if(!message){
    if(!this.env.CHAT_RATE_LIMITER?.limit)fail('잡담 요청 제한 설정이 필요합니다.',503);
    let allowed;try{allowed=await this.env.CHAT_RATE_LIMITER.limit({key:'member:'+member.id});}catch{fail('잠시 후 다시 전송해 주세요.',503);}
    if(!allowed.success)return new Response(JSON.stringify({error:'메시지가 너무 빠릅니다. 1분 후 다시 시도해 주세요.'}),{status:429,headers:{'Content-Type':'application/json','Retry-After':'60'}});
    await this.env.DB.prepare('INSERT INTO chat_messages(member_id,client_message_id,body,created_at) VALUES(?,?,?,?) ON CONFLICT(member_id,client_message_id) DO NOTHING').bind(member.id,input.client_message_id,body,new Date().toISOString()).run();
    message=await this.env.DB.prepare(select+' WHERE c.member_id=? AND c.client_message_id=?').bind(member.id,input.client_message_id).first();
    if(!message||message.body!==body)fail('전송 요청 내용을 다시 확인하세요.',409);
   }
   // Commit first. Retries may repeat this event; clients deduplicate by DB id.
   for(const socket of this.sockets()){const state=socket.deserializeAttachment();if(state.memberId===member.id)socket.serializeAttachment({...state,typingUntil:0});}
   await this.refresh();this.broadcast({type:'message',message});return json(message);
  }
  fail('잡담 경로를 찾을 수 없습니다.',404);
 }catch(error){if(error instanceof Response)return error;console.error('Chat request failed');return json({error:'메시지를 처리하지 못했습니다. 다시 시도해 주세요.'},503);}}
 async webSocketMessage(socket,raw){
  try{
   if(typeof raw!=='string'||raw.length>256){this.drop(socket,1008);await this.announce();return;}
   const state=socket.deserializeAttachment(),now=Date.now();if(!state||state.closed)return;
   if(now-state.burstAt>=10000){state.burstAt=now;state.burstCount=0;}state.burstCount++;socket.serializeAttachment(state);
   if(state.burstCount>15){this.drop(socket,1008);await this.announce();return;}
   const event=JSON.parse(raw);if(event.type!=='typing'||typeof event.active!=='boolean')return;
   if(event.active&&now-state.lastTyping<2000)return;
   if(!await this.member(state.memberId,state.sessionHash)){this.drop(socket,1008);await this.announce();return;}
   socket.serializeAttachment({...state,lastTyping:now,typingUntil:event.active?now+6000:0});await this.announce();
  }catch{this.drop(socket,1011);await this.announce();}
 }
 async alarm(){
  const now=Date.now();for(const socket of this.sockets()){const state=socket.deserializeAttachment(),ping=this.ctx.getWebSocketAutoResponseTimestamp?.(socket)?.getTime()||state.connectedAt;if(state.expiresAt<=now)this.drop(socket,1008);else if(ping+75000<=now)this.drop(socket,1001);else if(state.typingUntil&&state.typingUntil<=now)socket.serializeAttachment({...state,typingUntil:0});}
  await this.announce();
 }
 async webSocketClose(socket){this.drop(socket);await this.announce();}
 async webSocketError(socket){this.drop(socket,1011);await this.announce();}
}
