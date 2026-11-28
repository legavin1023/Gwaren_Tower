import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';import {parse,compileScript} from '@vue/compiler-sfc';import {Window} from 'happy-dom';
test('chat UI preserves failed drafts and retries IDs, prevents IME sends, renders text safely and anchors history/new messages',async()=>{
 const window=new Window({url:'http://localhost:8090'}),names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot','history','location'];const previous=new Map(names.map(name=>[name,globalThis[name]]));for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const viewport=new window.EventTarget();viewport.height=800;viewport.offsetTop=0;window.visualViewport=viewport;
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});const files=[];let app,callbacks,stopped=false,fail=true;const calls=[];
 const make=id=>({id,member_id:'two',nickname:'Other',body:id===10?'<img src=x onerror=alert(1)>':'Message '+id,created_at:'2026-11-28T03:00:00Z'});
 globalThis.__chatUI={createChatConnection(options){callbacks=options;options.onStatus('live');return {typing(){},stop(){stopped=true;},async older(){return {messages:Array.from({length:9},(_,i)=>make(i+1)),has_more:false};}};},async request(path,options){calls.push(JSON.parse(options.body));if(fail)throw Error('Network failed');return {...calls.at(-1),id:21,member_id:'one',created_at:'2026-11-28T03:01:00Z'};}};
 try{
  for(const name of ['Portrait','ChatView']){const {descriptor}=parse(await readFile(new URL('../src/'+name+'.vue',import.meta.url),'utf8'));let code=compileScript(descriptor,{id:name,inlineTemplate:true}).content;
   code=code.replace("import {request} from './api';","const {request}=globalThis.__chatUI;");
   code=code.replace("import {createChatConnection,mergeChatMessages,chatEnterSends} from './chat-client.mjs';","import {mergeChatMessages,chatEnterSends} from '../../src/chat-client.mjs';const {createChatConnection}=globalThis.__chatUI;");
   code=code.replace(/from ['"]\.\/Portrait\.vue['"]/g,"from './chat-Portrait-"+process.pid+".mjs'").replace(/from ['"]\.\/([^'"]+\.mjs)['"]/g,(all,name)=>name.startsWith('chat-Portrait-')?all:"from '../../src/"+name+"'");
   const file=new URL('chat-'+name+'-'+process.pid+'.mjs',folder);await writeFile(file,code);files.push(file);
  }
  const {createApp,h,nextTick}=await import('vue'),{createRouter,createMemoryHistory}=await import('vue-router'),View=(await import(files[1].href)).default;
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});await router.push('/chat');const host=document.createElement('div');document.body.append(host);
  app=createApp({render:()=>h(View,{me:{id:'one'},members:[{id:'one',nickname:'Me'},{id:'two',nickname:'Other',representative_character_id:'char'}],characters:[{id:'char',owner_id:'two',name:'Representative',image:'blob:portrait',extra:{}}]})});app.use(router);app.mount(host);
  const list=host.querySelector('.chat-messages');let scroll=0;Object.defineProperty(list,'clientHeight',{get:()=>160});Object.defineProperty(list,'scrollHeight',{get:()=>host.querySelectorAll('[data-chat-id]').length*80});Object.defineProperty(list,'scrollTop',{get:()=>scroll,set:value=>{scroll=Math.max(0,Math.min(value,list.scrollHeight-160));}});list.getBoundingClientRect=()=>({top:0,bottom:160});
  await callbacks.onMessages(Array.from({length:10},(_,i)=>make(i+10)),{kind:'initial',hasMore:true});await nextTick();
  assert.equal(host.querySelector('.chat-message-content p img'),null);assert.match(host.querySelector('.chat-message-content p').textContent,/<img/);assert.ok(host.querySelector('.chat-avatar[href="/characters/char"]'));
  for(const element of host.querySelectorAll('[data-chat-id]'))element.getBoundingClientRect=()=>{const i=[...host.querySelectorAll('[data-chat-id]')].indexOf(element);return {top:i*80-list.scrollTop,bottom:(i+1)*80-list.scrollTop};};
  list.scrollTop=160;list.dispatchEvent(new window.Event('scroll'));await callbacks.onMessages([make(20)],{kind:'live'});assert.equal(list.scrollTop,160);assert.match(host.querySelector('.chat-new-messages').textContent,/1/);
  host.querySelector('.chat-new-messages').click();await nextTick();assert.equal(list.scrollTop,list.scrollHeight-list.clientHeight);
  list.scrollTop=0;list.dispatchEvent(new window.Event('scroll'));await new Promise(resolve=>setImmediate(resolve));await nextTick();assert.equal(list.scrollTop,720);assert.equal(host.querySelectorAll('[data-chat-id]').length,20);
  const textarea=host.querySelector('textarea');textarea.value='안녕하세요';textarea.dispatchEvent(new window.Event('input',{bubbles:true}));await nextTick();
  textarea.dispatchEvent(new window.Event('compositionstart'));textarea.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await nextTick();assert.equal(calls.length,0);textarea.dispatchEvent(new window.Event('compositionend'));
  textarea.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true}));await nextTick();assert.equal(calls.length,0);
  host.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));await nextTick();assert.equal(textarea.value,'안녕하세요');assert.match(host.querySelector('[role="alert"]').textContent,/Network failed/);const retryId=calls[0].client_message_id;
  fail=false;host.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));await nextTick();assert.equal(calls[1].client_message_id,retryId);assert.equal(textarea.value,'');assert.equal(host.querySelectorAll('[data-chat-id="21"]').length,1);
  await callbacks.onMessages([{...make(21),member_id:'one'}],{kind:'live'});assert.equal(host.querySelectorAll('[data-chat-id="21"]').length,1);
  callbacks.onPresence({members:[{id:'one',nickname:'Me'},{id:'two',nickname:'Other'}],typing:['two']});await nextTick();assert.match(host.querySelector('.chat-online summary').textContent,/2명/);assert.match(host.querySelector('.chat-typing').textContent,/Other님이 입력 중/);
  viewport.height=320;viewport.dispatchEvent(new window.Event('resize'));await nextTick();assert.equal(host.querySelector('.chat-room').style.getPropertyValue('--chat-height'),'308px');
 }finally{app?.unmount();for(const file of files)await unlink(file);delete globalThis.__chatUI;await window.happyDOM.abort();window.close();for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
