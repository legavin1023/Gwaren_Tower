import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import {Window} from 'happy-dom';
import {roleplayDraftKey,inlineRoleplay,roleplayRecords} from '../src/roleplay-domain.mjs';

test('roleplay records join multi-character scenes and shared threads without creating relationships; drafts are scoped and text formatting is literal',()=>{
 const scenes=[{id:'group',title:'세 사람',participant_ids:['a','b','c'],status:'active',updated_at:'2026-01-01'},{id:'unrelated',participant_ids:['c'],updated_at:'2026-01-01'}];
 const messages=[{id:'root',thread_id:'root',scene_id:null,character_id:'a',body:'창가',created_at:'2026-01-02',updated_at:'2026-01-02'},{id:'reply',thread_id:'root',scene_id:null,character_id:'b',body:'답글',parent_id:'root',created_at:'2026-01-03',updated_at:'2026-01-03'},{id:'deleted',thread_id:'gone',character_id:'a',deleted_at:'now'}];
 const before=JSON.stringify({scenes,messages});
 const records=roleplayRecords(scenes,messages,['a','b']);assert.deepEqual(records.map(row=>row.id),['root','group']);assert.equal(records[1].character_ids.length,3);
 assert.equal(roleplayRecords(scenes,messages,['a','c']).length,1);assert.equal(JSON.stringify({scenes,messages}),before);
 assert.notEqual(roleplayDraftKey('one','reply:a','actor'),roleplayDraftKey('two','reply:a','actor'));
 assert.notEqual(roleplayDraftKey('one','root','actor'),roleplayDraftKey('one','reply:a','actor'));
 assert.notEqual(roleplayDraftKey('one','root','a'),roleplayDraftKey('one','root','b'));
 assert.deepEqual(inlineRoleplay('말 **강조** *행동* <script>x</script>').map(part=>part.kind),['text','strong','text','em','text']);
 assert.ok(inlineRoleplay('<img onerror=alert(1)>')[0].text.includes('<img'));
});

test('roleplay editor restores actor-specific drafts, previews safe formatting and retries with the same request id',async()=>{
 const window=new Window({url:'http://localhost:8090'}),names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot','localStorage','history','location'];
 const previous=new Map(names.map(name=>[name,globalThis[name]]));for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});const generated=[];let app;
 const requests=[],revoked=[],revoke=URL.revokeObjectURL;URL.revokeObjectURL=url=>revoked.push(url);
 let failSend=true;
 globalThis.__roleplayTestApi={
  request:async(path,options)=>{const value=options?.body instanceof Blob?null:JSON.parse(options?.body||'{}');requests.push({path,value});if(path==='/roleplay/messages'&&failSend)throw Error('연결이 끊겼습니다');return {id:'saved'};},
  imageBlob:async path=>'blob:'+path,
 };
 try{
  const clientSource=(await readFile(new URL('../src/roleplay-client.mjs',import.meta.url),'utf8')).replace(/import \{request, imageBlob\} from ['"]\.\/api['"];?/g,'const {request,imageBlob}=globalThis.__roleplayTestApi;').replace(/from ['"]\.\/image\.mjs['"]/g,"from '../../src/image.mjs'");
  const clientFile=new URL('rp-client-'+process.pid+'.mjs',folder);await writeFile(clientFile,clientSource);generated.push(clientFile);
  const sources=['Portrait','MentionText','RoleplayText','RoleplayEditor','RoleplayMessage'];
  for(const source of sources){
   const {descriptor}=parse(await readFile(new URL('../src/'+source+'.vue',import.meta.url),'utf8'));
   let code=compileScript(descriptor,{id:source,inlineTemplate:true}).content;
   code=code.replace(/import \{request,imageBlob\} from ['"]\.\/api['"];?/g,'const {request,imageBlob}=globalThis.__roleplayTestApi;');
   code=code.replace(/from ['"]\.\/roleplay-client\.mjs['"]/g,"from './rp-client-"+process.pid+".mjs'");
   code=code.replace(/from ['"]\.\/([^'"]+\.mjs)['"]/g,(all,name)=>name.startsWith('rp-client-')?all:"from '../../src/"+name+"'");
   code=code.replace(/from ['"]\.\/([^'"]+)\.vue['"]/g,(_,name)=>"from './rp-"+name+'-'+process.pid+".mjs'");
   const file=new URL('rp-'+source+'-'+process.pid+'.mjs',folder);await writeFile(file,code);generated.push(file);
  }
  const Editor=(await import(new URL('rp-RoleplayEditor-'+process.pid+'.mjs',folder).href)).default;
  const Message=(await import(new URL('rp-RoleplayMessage-'+process.pid+'.mjs',folder).href)).default;
  const {createApp,h,nextTick,ref}=await import('vue'),{createRouter,createMemoryHistory}=await import('vue-router');
  const characters=[{id:'a',name:'에이라',faction:'mage',owner_id:'one'},{id:'b',name:'카시안',faction:'templar',owner_id:'one'}];
  const context='timeline-new',draftKey=roleplayDraftKey('one',context,'a');
  localStorage.setItem(draftKey,JSON.stringify({body:'기존 임시 글',attachments:[],request_id:'restore-request'}));
  const host=document.createElement('div');document.body.appendChild(host);
  const props={me:{id:'one',nickname:'오너'},actors:characters,characters,context};let saved=0;
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});await router.push('/');
  const mountEditor=()=>{app=createApp({render:()=>h(Editor,{...props,onSaved:()=>saved++})});app.use(router);app.mount(host);};
  const change=async(selector,value,event='input')=>{const el=host.querySelector(selector);el.value=value;el.dispatchEvent(new window.Event(event,{bubbles:true}));await nextTick();};
  mountEditor();assert.equal(host.querySelector('textarea').value,'기존 임시 글');
  const actorSelector='.rp-editor-heading select';await change(actorSelector,'b','change');assert.equal(host.querySelector('textarea').value,'');
  await change('textarea','B의 글');await change(actorSelector,'a','change');assert.equal(host.querySelector('textarea').value,'기존 임시 글');
  await change('textarea','**대사**\n*행동*\n<script>not executable</script>');
  assert.equal(host.querySelector('.rp-preview .rp-body strong').textContent,'대사');assert.equal(host.querySelector('.rp-preview .rp-body em').textContent,'행동');assert.equal(host.querySelector('.rp-preview script'),null);assert.match(host.querySelector('.rp-preview').textContent,/<script>/);
  app.unmount();app=null;mountEditor();assert.match(host.querySelector('textarea').value,/대사/);
  const submit=async()=>{host.querySelector('textarea').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));await nextTick();};
  await submit();assert.equal(saved,0);assert.ok(localStorage.getItem(draftKey));assert.match(host.querySelector('[role=alert]').textContent,/연결/);
  failSend=false;await submit();assert.equal(saved,1);assert.equal(localStorage.getItem(draftKey),null);assert.equal(host.querySelector('textarea').value,'');
  assert.equal(requests[0].value.request_id,requests[1].value.request_id);assert.equal(requests[0].value.character_id,'a');assert.equal(requests[0].value.scene_id,null);
  assert.equal(JSON.parse(localStorage.getItem(roleplayDraftKey('one',context,'b'))).body,'B의 글');
  app.unmount();app=null;
  const message=ref({id:'reply',owner_id:'one',character_id:'b',author_name:'이전 이름',faction:'templar',body:'hello',attachments:[],parent_id:'parent',created_at:'2026-11-17T01:00:00Z',revision:1});
  const all=[{id:'parent',author_name:'에이라',body:'원글'},message.value,{id:'nested',parent_id:'reply',body:'답글'}],events=[];
  app=createApp({render:()=>h(Message,{message:message.value,messages:all,characters,me:{id:'one',role:'member'},images:{},canReply:true,onReply:row=>events.push(row)})});app.use(router);app.mount(host);
  assert.equal(host.querySelector('.rp-avatar-link').getAttribute('href'),'/characters/b');assert.equal(host.querySelector('.character-name').getAttribute('href'),'/characters/b');assert.match(host.textContent,/에이라에게 답글/);
  [...host.querySelectorAll('button')].find(button=>button.textContent.startsWith('답글')).click();assert.equal(events[0].id,'reply');
  message.value={...message.value,deleted_at:'now'};await nextTick();assert.match(host.textContent,/연결된 답글은 보존/);assert.equal(host.querySelector('.rp-body'),null);
  app.unmount();app=null;
  // Privacy changes purge the cached text and images before any subsequent page load.
  let feed,syncCount=0,finishImage;
  // Build a separate client instance for deterministic incremental feed responses.
  const feedFile=new URL('rp-feed-'+process.pid+'.mjs',folder);
  const feedSource=clientSource.replace('const {request,imageBlob}=globalThis.__roleplayTestApi;','const request=(...args)=>globalThis.__roleplayFeedApi.request(...args);const imageBlob=(...args)=>globalThis.__roleplayFeedApi.imageBlob(...args);');
  await writeFile(feedFile,feedSource);generated.push(feedFile);
  globalThis.__roleplayFeedApi={request:async path=>{
   if(path.includes('/history'))return {messages:[],next:null};
   syncCount++;
   return syncCount===1?{cursor:1,scenes:[{id:'private',image_path:null}],messages:[{id:'secret',scene_id:'private',body:'비밀',attachments:['secret.webp']}],reads:[],newly_visible:[],has_more:false}:{cursor:2,scenes:[],messages:[],reads:[],newly_visible:[],has_more:false};
  },imageBlob:()=>new Promise(resolve=>{finishImage=resolve;})};
  const {useRoleplayFeed:useFeed}=await import(feedFile.href);
  app=createApp({setup(){feed=useFeed();return ()=>h('div');}});app.mount(host);
  await feed.sync();assert.equal(feed.messages.value.length,1);
  const pendingImage=feed.ensureImages(['secret.webp']);await nextTick();
  await feed.sync();assert.equal(feed.messages.value.length,0);assert.equal(feed.scenes.value.length,0);
  finishImage('blob:secret');await pendingImage;assert.equal(feed.images.value['secret.webp'],undefined);assert.ok(revoked.includes('blob:secret'));
 }finally{
  app?.unmount();for(const file of generated)await unlink(file);URL.revokeObjectURL=revoke;delete globalThis.__roleplayTestApi;delete globalThis.__roleplayFeedApi;
  await window.happyDOM.abort();window.close();for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;
 }
});
