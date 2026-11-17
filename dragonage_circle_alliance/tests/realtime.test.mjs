import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveUpdates} from '../src/live-updates.mjs';
import {createImageCache} from '../src/image-cache.mjs';
import {RealtimeHub} from '../worker/realtime.mjs';

function browser(){
 const win=new EventTarget(),doc=new EventTarget(),sockets=[],timers=new Map();let next=0;
 win.location={href:'https://circle.test/'};win.navigator={onLine:true};doc.visibilityState='visible';
 class Socket{constructor(url){this.url=url;sockets.push(this);}close(){this.closed=true;}open(){this.onopen?.();}message(data){this.onmessage?.({data:JSON.stringify(data)});}end(code){this.onclose?.({code});}}
 return {win,doc,sockets,timers,Socket,setTimer(fn){timers.set(++next,fn);return next;},clearTimer(id){timers.delete(id);}};
}
test('live connection is idle without timers or reads and updates only on server messages',()=>{
 const b=browser();let data=0,notifications=0,unauthorized=0;
 const live=createLiveUpdates({window:b.win,document:b.doc,Socket:b.Socket,setTimer:b.setTimer,clearTimer:b.clearTimer,onData:()=>data++,onNotifications:()=>notifications++,onUnauthorized:()=>unauthorized++});
 const socket=b.sockets[0];assert.match(socket.url,/^wss:\/\/circle.test\/api\/live\?client=/);
 socket.open();assert.equal(data,0);assert.equal(b.timers.size,0);
 socket.message({type:'ready'});assert.deepEqual([data,notifications],[1,1]);
 socket.message({type:'changed',notifications:true});assert.deepEqual([data,notifications],[1,2]);
 b.doc.visibilityState='hidden';socket.message({type:'changed',data:true,notifications:true});socket.message({type:'changed',data:true});
 assert.deepEqual([data,notifications],[1,2]);assert.equal(b.timers.size,0);
 b.doc.visibilityState='visible';b.doc.dispatchEvent(new Event('visibilitychange'));
 assert.deepEqual([data,notifications],[2,3]);assert.equal(b.sockets.length,1);
 socket.end(1006);assert.equal(b.timers.size,1);const retry=[...b.timers.values()][0];b.timers.clear();retry();
 assert.deepEqual([data,notifications],[2,3]);assert.equal(b.sockets.length,2);
 b.sockets[1].open();b.sockets[1].message({type:'ready'});assert.deepEqual([data,notifications],[3,4]);
 b.sockets[1].end(1008);assert.equal(unauthorized,1);assert.equal(b.timers.size,0);
 live.stop();assert.equal(b.timers.size,0);
});
test('roleplay events refresh only the roleplay feed, coalesce while hidden and stay idle without writes',()=>{
 const b=browser();let data=0,roleplay=0;
 const live=createLiveUpdates({window:b.win,document:b.doc,Socket:b.Socket,setTimer:b.setTimer,clearTimer:b.clearTimer,onData:()=>data++,onRoleplay:()=>roleplay++});
 const socket=b.sockets[0];socket.open();socket.message({type:'ready'});assert.equal(roleplay,1);assert.equal(data,1);
 socket.message({type:'changed',roleplay:true,data:false});assert.equal(roleplay,2);assert.equal(data,1);
 b.doc.visibilityState='hidden';socket.message({type:'changed',roleplay:true});socket.message({type:'changed',roleplay:true});assert.equal(roleplay,2);
 b.doc.visibilityState='visible';b.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(roleplay,3);assert.equal(b.timers.size,0);live.stop();
});

test('image URLs are reused, removed URLs revoked, and late loads after logout discarded',async()=>{
 const loaded=[],revoked=[];const cache=createImageCache(async path=>{loaded.push(path);return 'blob:'+path;},url=>revoked.push(url));
 assert.deepEqual(await cache.resolve(['a','b']),{a:'blob:a',b:'blob:b'});
 await cache.resolve(['a','b']);assert.deepEqual(loaded,['a','b']);
 await cache.resolve(['b','c']);assert.deepEqual(revoked,['blob:a']);assert.deepEqual(loaded,['a','b','c']);
 cache.clear();assert.deepEqual(revoked,['blob:a','blob:b','blob:c']);
 let finish;const pendingCache=createImageCache(()=>new Promise(resolve=>{finish=resolve;}),url=>revoked.push(url));
 const pending=pendingCache.resolve(['late']);await Promise.resolve();pendingCache.clear();finish('blob:late');
 assert.deepEqual(await pending,{});assert.equal(revoked.at(-1),'blob:late');
});
test('hub only queries sessions on write signals, scopes notifications, skips originating tab and closes revoked sessions',async()=>{
 let reads=0;const socket=(memberId,sessionHash,clientId)=>({readyState:1,events:[],closed:[],deserializeAttachment:()=>({memberId,sessionHash,clientId}),send(value){this.events.push(JSON.parse(value));},close(code){this.closed.push(code);}});
 const own=socket('one','valid-one','writer'),otherTab=socket('one','valid-one','reader'),recipient=socket('two','valid-two','reader'),expired=socket('three','expired','reader');
 const sockets=[own,otherTab,recipient,expired];
 const hub=new RealtimeHub({getWebSockets:()=>sockets},{DB:{prepare(){reads++;return {bind(){return this;},async all(){return {results:[{token_hash:'valid-one'},{token_hash:'valid-two'}]};}};}}});
 assert.equal(reads,0);
 await hub.broadcast({notificationMembers:['two']});assert.equal(reads,1);assert.equal(otherTab.events.length,0);assert.deepEqual(recipient.events,[{type:'changed',data:false,notifications:true}]);
 await hub.broadcast({data:true,notificationMembers:['two'],actorMember:'one',actorClient:'writer'});
 assert.equal(own.events.length,0);assert.deepEqual(otherTab.events,[{type:'changed',data:true,notifications:false}]);assert.equal(recipient.events.length,2);assert.deepEqual(expired.closed,[1008]);
 const before=reads;await hub.broadcast({revokeSession:'valid-one'});assert.equal(reads,before);assert.deepEqual(own.closed,[1008]);assert.deepEqual(otherTab.closed,[1008]);
});
