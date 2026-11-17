import {clientId} from './client-id.mjs';
// A connection and write events only. Reconnect timers never fetch application data.
export function createLiveUpdates({onData=()=>{},onNotifications=()=>{},onUnauthorized=()=>{},onStatus=()=>{},window:win=window,document:doc=document,Socket=win.WebSocket,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let socket=null,retry=null,delay=1000,stopped=false,online=win.navigator?.onLine!==false,status='',pendingData=false,pendingNotifications=false;
 function report(value){if(status!==value){status=value;onStatus(value);}}
 function invoke(callback){try{const result=callback();result?.catch?.(()=>{});}catch{}}
 function flush(){if(stopped||doc.visibilityState==='hidden')return;if(pendingData){pendingData=false;invoke(onData);}if(pendingNotifications){pendingNotifications=false;invoke(onNotifications);}}
 function schedule(){if(stopped||!online||retry!==null)return;report('reconnecting');retry=setTimer(()=>{retry=null;connect();},delay);delay=Math.min(delay*2,30000);}
 function disconnect(){const previous=socket;socket=null;if(previous){previous.onopen=previous.onmessage=previous.onclose=previous.onerror=null;previous.close(1000,'Page disconnected');}}
 function connect(){
  if(stopped||!online||socket)return;
  if(!Socket){report('unavailable');return;}
  report('connecting');
  try{
   const url=new URL('/api/live',win.location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('client',clientId);
   const current=new Socket(url.href);socket=current;
   current.onopen=()=>{if(stopped||socket!==current)return;delay=1000;report('live');};
   current.onmessage=message=>{
    if(stopped||socket!==current)return;
    let event;try{event=JSON.parse(message.data);}catch{return;}
    if(event.type==='ready'){pendingData=true;pendingNotifications=true;}
    else if(event.type==='changed'){pendingData ||= event.data===true;pendingNotifications ||= event.notifications===true;}
    else return;
    flush();
   };
   current.onerror=()=>{if(!stopped&&socket===current)report('reconnecting');};
   current.onclose=event=>{
    if(stopped||socket!==current)return;socket=null;
    if(event.code===1008){report('unauthorized');invoke(onUnauthorized);return;}
    if(online)schedule();else report('offline');
   };
  }catch{socket=null;schedule();}
 }
 function visibility(){if(doc.visibilityState!=='hidden'){flush();connect();}}
 function becameOnline(){online=true;if(retry!==null){clearTimer(retry);retry=null;}connect();}
 function becameOffline(){online=false;if(retry!==null){clearTimer(retry);retry=null;}disconnect();report('offline');}
 doc.addEventListener('visibilitychange',visibility);win.addEventListener('online',becameOnline);win.addEventListener('offline',becameOffline);
 if(online)connect();else report('offline');
 return {stop(){if(stopped)return;stopped=true;if(retry!==null)clearTimer(retry);retry=null;disconnect();doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('online',becameOnline);win.removeEventListener('offline',becameOffline);}};
}
