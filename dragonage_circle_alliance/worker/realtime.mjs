// Event-driven only: no timers, periodic D1 queries or per-connection polling.
import {fail} from './policy.mjs';
export function requestClient(req){const value=req.headers.get('X-Circle-Client-Id')||'';return /^[-\w]{1,80}$/.test(value)?value:'';}
export async function publishRealtime(env,change,ctx){
 if(!env.REALTIME)return;
 const delivery=(async()=>{
  const hub=env.REALTIME.get(env.REALTIME.idFromName('circle-live'));
  const response=await hub.fetch('https://realtime.internal/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(change)});
  if(!response.ok)throw new Error('Realtime delivery failed');await response.body?.cancel();
 })().catch(()=>console.error('Realtime delivery failed'));
 if(ctx?.waitUntil)ctx.waitUntil(delivery);else await delivery;
}
export async function openRealtime(req,env,me,sessionHash){
 if(req.method!=='GET'||req.headers.get('Upgrade')?.toLowerCase()!=='websocket')fail('WebSocket 연결이 필요합니다.',426);
 if(req.headers.get('Origin')!==env.SITE_ORIGIN)fail('요청 출처를 확인할 수 없습니다.',403);
 if(!env.REALTIME)fail('실시간 연결 설정을 배포해야 합니다.',503);
 const client=new URL(req.url).searchParams.get('client')||'';
 const hub=env.REALTIME.get(env.REALTIME.idFromName('circle-live'));
 // Build fresh internal headers; the public client cannot supply another member/session.
 return hub.fetch('https://realtime.internal/connect',{headers:{Upgrade:'websocket','X-Member-Id':me.id,'X-Session-Hash':sessionHash,'X-Client-Id':/^[-\w]{1,80}$/.test(client)?client:''}});
}
export class RealtimeHub {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(req){
  const path=new URL(req.url).pathname;
  if(path==='/connect'&&req.headers.get('Upgrade')?.toLowerCase()==='websocket'){
   const memberId=req.headers.get('X-Member-Id'),sessionHash=req.headers.get('X-Session-Hash');
   if(!memberId||!sessionHash)return new Response('Forbidden',{status:403});
   const pair=new WebSocketPair(),client=pair[0],server=pair[1];
   this.ctx.acceptWebSocket(server,['member:'+memberId]);
   server.serializeAttachment({memberId,sessionHash,clientId:req.headers.get('X-Client-Id')||''});
   server.send(JSON.stringify({type:'ready'}));
   return new Response(null,{status:101,webSocket:client});
  }
  if(path==='/publish'&&req.method==='POST'){
   await this.broadcast(await req.json());return new Response(null,{status:204});
  }
  return new Response('Not found',{status:404});
 }
 async broadcast(change){
  const sockets=this.ctx.getWebSockets().filter(socket=>socket.readyState===1);
  if(change.revokeAll||change.revokeSession){for(const socket of sockets){const state=socket.deserializeAttachment();if(change.revokeAll||state?.sessionHash===change.revokeSession)socket.close(1008,'Session ended');}return;}
  const notificationMembers=new Set(change.notificationMembers||[]);
  const relevant=sockets.filter(socket=>{const state=socket.deserializeAttachment();return state&&(change.data||notificationMembers.has(state.memberId));});
  if(!relevant.length)return;
  // Validate active sessions only when a write actually occurs, never while idle.
  const hashes=[...new Set(relevant.map(socket=>socket.deserializeAttachment().sessionHash))],valid=new Set();
  for(let index=0;index<hashes.length;index+=50){const batch=hashes.slice(index,index+50);const result=await this.env.DB.prepare('SELECT s.token_hash FROM sessions s JOIN members m ON m.id=s.member_id WHERE m.active=1 AND s.expires_at>? AND s.token_hash IN ('+batch.map(()=>'?').join(',')+')').bind(Date.now(),...batch).all();for(const row of result.results)valid.add(row.token_hash);}
  for(const socket of relevant){
   const state=socket.deserializeAttachment();
   if(!valid.has(state.sessionHash)){socket.close(1008,'Session ended');continue;}
   if(change.actorClient&&state.memberId===change.actorMember&&state.clientId===change.actorClient)continue;
   const event={type:'changed',data:!!change.data,notifications:notificationMembers.has(state.memberId)};
   try{socket.send(JSON.stringify(event));}catch{try{socket.close(1011,'Connection closed');}catch{}}
  }
 }
 webSocketMessage(socket){socket.close(1008,'Read-only connection');}
 webSocketClose(socket){try{socket.close(1000,'Closed');}catch{}}
 webSocketError(socket){try{socket.close(1011,'Connection error');}catch{}}
}
