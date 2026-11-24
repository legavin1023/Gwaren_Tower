import {mentionText} from '../src/mention-text.mjs';
import {notificationEvents} from '../worker/notifications.mjs';
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
 handlers.push({data:{json:()=>({title:'@[Anders](local-demo-101)',body:'@\\[Anders\\]\\(765b4c5a-c03e-4dbf-892b-ccf7015ef879\\)'})},waitUntil:promise=>{pending=promise;}});await pending;
 assert.equal(shown[2][0],'@Anders');assert.equal(shown[2][1].body,'@Anders');

});

test('notification previews remove mention IDs before truncation, including escaped and legacy tags',()=>{
 const id='765b4c5a-c03e-4dbf-892b-ccf7015ef879';
 for(const input of ['@['+'앤더스'+']('+id+')','@['+'앤더스'+'](local-demo-101)','@['+'앤더스'+']('+id.slice(0,10)])assert.equal(mentionText(input),'@앤더스');
 assert.equal(mentionText('@\\[앤더스\\]\\('+id+'\\)'),'@앤더스');
 assert.equal(mentionText('hello @name (note)'),'hello @name (note)');
 const events=notificationEvents({table:'posts',row:{id:'post',owner_id:'one',category:'story',character_ids:[],title:'@\\[앤더스\\]\\('+id+'\\)',body:'text',revision:1,updated_at:'2026-11-25'},actor:{id:'one',nickname:'Owner'},members:[{id:'one',active:true},{id:'two',active:true}],characters:[]});
 assert.ok(events.length);assert.equal(events[0].body,'@앤더스');
});
