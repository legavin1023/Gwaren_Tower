export function mergeChatMessages(current,incoming){const rows=new Map(current.map(row=>[row.id,row]));for(const row of incoming)if(Number.isSafeInteger(row.id)&&row.id>0)rows.set(row.id,row);return [...rows.values()].sort((a,b)=>a.id-b.id);}
export function chatEnterSends(event,composing=false){return event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!composing&&event.keyCode!==229;}
// History reads happen at connection/reconnection or explicit pagination, never on a polling timer.
export function createChatConnection({request,onMessages=()=>{},onPresence=()=>{},onStatus=()=>{},onError=()=>{},onUnauthorized=()=>{},window:win=window,document:doc=document,Socket=win.WebSocket,setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now}={}){
 let socket=null,stopped=false,blocked=false,retry=null,heartbeat=null,typingStop=null,lastTyping=0,typingActive=false,lastPong=0,delay=1000,cursor=0,initial=true,syncing=null,again=false,online=win.navigator?.onLine!==false;
 const status=value=>{if(!stopped)onStatus(value);};
 async function recover(){
  if(syncing){again=true;return syncing;}
  syncing=(async()=>{do{again=false;let more;
   do{const first=initial,data=await request('/chat/messages'+(first?'':'?after='+cursor));if(stopped)return;
    cursor=data.cursor;initial=false;onMessages(data.messages,{kind:first?'initial':'recover',hasMore:data.has_more});more=!first&&data.has_more;
   }while(more&&!stopped);
  }while(again&&!stopped);})().finally(()=>{syncing=null;});return syncing;
 }
 function schedule(){if(stopped||!online||retry!==null)return;status('reconnecting');retry=setTimer(()=>{retry=null;connect();},delay);delay=Math.min(delay*2,30000);}
 function sendTyping(active){
  if(stopped||socket?.readyState!==1)return;
  if(active&&now()-lastTyping<2000)return;
  if(!active&&!typingActive)return;
  socket.send(JSON.stringify({type:'typing',active}));typingActive=active;if(active)lastTyping=now();
 }
 function typing(active=true){if(typingStop!==null)clearTimer(typingStop);typingStop=null;if(!active){sendTyping(false);return;}sendTyping(true);typingStop=setTimer(()=>{typingStop=null;sendTyping(false);},2500);}
 function tick(current){if(heartbeat!==null)clearTimer(heartbeat);heartbeat=setTimer(()=>{heartbeat=null;if(stopped||socket!==current)return;if(current.readyState!==1){disconnect();schedule();return;}if(now()-lastPong>65000){current.close(4000,'Heartbeat timeout');return;}current.send('ping');tick(current);},25000);}
 function disconnect(){if(heartbeat!==null)clearTimer(heartbeat);heartbeat=null;const previous=socket;socket=null;if(previous){previous.onopen=previous.onmessage=previous.onerror=previous.onclose=null;previous.close(1000,'Chat closed');}typingActive=false;onPresence({members:[],typing:[]});}
 function connect(){
  if(stopped||blocked||!online||socket)return;
  if(!Socket){status('unavailable');recover().catch(error=>onError(error.message));return;}
  status('connecting');
  try{
   const url=new URL('/api/chat/live',win.location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
   const current=new Socket(url.href);socket=current;
   current.onopen=()=>{if(stopped||socket!==current)return;delay=1000;lastPong=now();status('live');tick(current);};
   current.onmessage=event=>{if(stopped||socket!==current)return;if(event.data==='pong'){lastPong=now();return;}
    let data;try{data=JSON.parse(event.data);}catch{return;}
    if(data.type==='session-ended'){blocked=true;disconnect();status('unauthorized');onUnauthorized();return;}
    if(data.type==='ready')recover().catch(error=>{if(stopped)return;onError(error.message);current.close(4001,'History retry');});
    if(data.type==='message')onMessages([data.message],{kind:'live'});
    if(data.type==='presence')onPresence(data);
   };
   current.onclose=event=>{if(socket!==current||stopped)return;socket=null;if(heartbeat!==null)clearTimer(heartbeat);heartbeat=null;typingActive=false;onPresence({members:[],typing:[]});if(event.code===1008){blocked=true;status('unauthorized');onUnauthorized();return;}schedule();};
   current.onerror=()=>{if(!stopped&&socket===current){status('reconnecting');current.close();}};
  }catch{socket=null;schedule();}
 }
 function reconnect(){if(retry!==null)clearTimer(retry);retry=null;disconnect();connect();}
 function becameOnline(){online=true;reconnect();}
 function becameOffline(){online=false;if(retry!==null)clearTimer(retry);retry=null;disconnect();status('offline');}
 function visible(){if(doc.visibilityState!=='hidden'&&!socket)connect();}
 win.addEventListener('online',becameOnline);win.addEventListener('offline',becameOffline);doc.addEventListener('visibilitychange',visible);
 if(online)connect();else status('offline');
 return {typing,reconnect,recover,async older(before){return request('/chat/messages?before='+before);},stop(){if(stopped)return;typing(false);stopped=true;if(retry!==null)clearTimer(retry);if(typingStop!==null)clearTimer(typingStop);disconnect();win.removeEventListener('online',becameOnline);win.removeEventListener('offline',becameOffline);doc.removeEventListener('visibilitychange',visible);}};
}
