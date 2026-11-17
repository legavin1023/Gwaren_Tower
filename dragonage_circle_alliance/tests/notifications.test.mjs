import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {notificationPath} from '../src/notificationRoutes.mjs';

test('notification login destinations are restricted to character and board pages',()=>{
 assert.equal(notificationPath('#/roleplay/scene/abc-123'),'/roleplay/scene/abc-123');
 assert.equal(notificationPath('#/roleplay/thread/abc-123'),'/roleplay/thread/abc-123');
 assert.equal(notificationPath('#/board/art/abc-123'),'/board/art/abc-123');
 assert.equal(notificationPath('/characters/abc-123'),'/characters/abc-123');
 for(const url of ['https://evil.test','//evil.test','/admin','/api/export','/board/art/../../admin'])assert.equal(notificationPath(url),'');
});
test('push service worker displays notifications and navigates only inside the site',async()=>{
 const handlers={},shown=[],navigated=[],opened=[];
 const self={addEventListener:(name,handler)=>{handlers[name]=handler;},registration:{scope:'https://circle.test/',showNotification:async(...args)=>shown.push(args)},clients:{claim:async()=>{},matchAll:async()=>[{url:'https://circle.test/#/home',navigate:async url=>{navigated.push(url);return {focus:async()=>{}};}}],openWindow:async url=>opened.push(url)},skipWaiting:()=>{}};
 vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL});
 let pending;
 handlers.push({data:{json:()=>({title:'내 글 댓글',body:'알림 본문',url:'#/board/art/post-id',eventId:'event-id'})},waitUntil:promise=>{pending=promise;}});await pending;
 assert.equal(shown[0][0],'내 글 댓글');assert.equal(shown[0][1].tag,'event-id');
 for(const url of ['#/board/art/post-id','https://evil.test/phish','https://circle.test/api/export']) {
  handlers.notificationclick({notification:{data:{url},close:()=>{}},waitUntil:promise=>{pending=promise;}});await pending;
 }
 assert.equal(navigated[0],'https://circle.test/#/board/art/post-id');
 assert.equal(navigated[1],'https://circle.test/#/home');assert.equal(navigated[2],'https://circle.test/#/home');assert.equal(opened.length,0);
 handlers.push({data:{json:()=>{throw Error('bad payload');}},waitUntil:promise=>{pending=promise;}});await pending;
 assert.equal(shown[1][0],'Gwaren Tower 새 알림');
});
