import test from 'node:test';import assert from 'node:assert/strict';import {createChatConnection,mergeChatMessages,chatEnterSends} from '../src/chat-client.mjs';
function browser(){const win=new EventTarget(),doc=new EventTarget(),sockets=[],timers=new Map();let id=0,clock=10000;win.location={href:'https://circle.test/'};win.navigator={onLine:true};doc.visibilityState='visible';class Socket{constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}open(){this.readyState=1;this.onopen?.();}message(data){this.onmessage?.({data:typeof data==='string'?data:JSON.stringify(data)});}send(value){this.sent.push(value);}close(code=1000){this.readyState=3;this.onclose?.({code});}}return {win,doc,Socket,sockets,timers,now:()=>clock,advance(value){clock+=value;},setTimer(fn,ms){const key=++id;timers.set(key,{fn,ms});return key;},clearTimer(key){timers.delete(key);},run(ms){const found=[...timers].find(([,task])=>task.ms===ms);assert.ok(found);timers.delete(found[0]);found[1].fn();}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('chat Enter preserves Korean composition and Shift+Enter, and canonical message IDs deduplicate echoes',()=>{
 assert.ok(chatEnterSends({key:'Enter'}));for(const event of [{key:'Enter',shiftKey:true},{key:'Enter',isComposing:true},{key:'Enter',keyCode:229},{key:'a'}])assert.equal(chatEnterSends(event),false);assert.equal(chatEnterSends({key:'Enter'},true),false);
 const merged=mergeChatMessages([{id:3,body:'three'}],[{id:1,body:'one'},{id:3,body:'three'}]);assert.deepEqual(merged.map(row=>row.id),[1,3]);
});
test('chat reconnect recovers all gap pages while typing is throttled and idle timers never poll history',async()=>{
 const b=browser(),requests=[],received=[];let mode='first';
 const client=createChatConnection({window:b.win,document:b.doc,Socket:b.Socket,setTimer:b.setTimer,clearTimer:b.clearTimer,now:b.now,request:async path=>{requests.push(path);if(mode==='first')return {messages:[{id:5}],cursor:5,has_more:true};if(path.endsWith('after=5'))return {messages:[{id:6}],cursor:6,has_more:true};return {messages:[{id:7}],cursor:7,has_more:false};},onMessages:(rows,meta)=>received.push({rows,meta})});
 assert.equal(requests.length,0);b.sockets[0].open();b.sockets[0].message({type:'ready'});await tick();assert.deepEqual(requests,['/chat/messages']);
 client.typing();client.typing();assert.equal(b.sockets[0].sent.length,1);b.advance(2100);client.typing();assert.equal(b.sockets[0].sent.length,2);b.run(2500);assert.equal(JSON.parse(b.sockets[0].sent.at(-1)).active,false);
 b.run(25000);assert.equal(b.sockets[0].sent.at(-1),'ping');assert.equal(requests.length,1);b.sockets[0].message('pong');
 b.sockets[0].message({type:'message',message:{id:7}});mode='catchup';b.sockets[0].close(1006);b.run(1000);b.sockets[1].open();b.sockets[1].message({type:'ready'});await tick();assert.deepEqual(requests.slice(1),['/chat/messages?after=5','/chat/messages?after=6']);assert.equal(received.at(-1).rows[0].id,7);
 client.stop();assert.equal(b.timers.size,0);const count=b.sockets.length;b.win.dispatchEvent(new Event('online'));assert.equal(b.sockets.length,count);
});
test('a rejected session stops reconnecting, and failed catchup reconnects without dropping its cursor',async()=>{
 const b=browser();let unauthorized=false,failed=false;
 const client=createChatConnection({window:b.win,document:b.doc,Socket:b.Socket,setTimer:b.setTimer,clearTimer:b.clearTimer,now:b.now,request:async()=>{throw Error('offline');},onError:()=>{failed=true;},onUnauthorized:()=>{unauthorized=true;}});
 b.sockets[0].open();b.sockets[0].message({type:'ready'});await tick();assert.equal(failed,true);b.run(1000);b.sockets[1].open();b.sockets[1].close(1008);assert.equal(unauthorized,true);assert.equal(b.timers.size,0);const count=b.sockets.length;b.doc.dispatchEvent(new Event('visibilitychange'));b.win.dispatchEvent(new Event('online'));assert.equal(b.sockets.length,count);client.stop();
});

test('session-ended clears presence immediately and prevents reconnect even before close handshake completes',()=>{
 const b=browser(),presence=[];let unauthorized=false;
 const client=createChatConnection({window:b.win,document:b.doc,Socket:b.Socket,setTimer:b.setTimer,clearTimer:b.clearTimer,now:b.now,request:async()=>({messages:[],cursor:0,has_more:false}),onPresence:data=>presence.push(data),onUnauthorized:()=>{unauthorized=true;}});
 b.sockets[0].open();b.sockets[0].message({type:'session-ended'});assert.equal(unauthorized,true);assert.deepEqual(presence.at(-1),{members:[],typing:[]});assert.equal(b.timers.size,0);b.win.dispatchEvent(new Event('online'));assert.equal(b.sockets.length,1);client.stop();
});
