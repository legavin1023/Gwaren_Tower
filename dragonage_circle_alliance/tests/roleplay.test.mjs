import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import {Window} from 'happy-dom';
import {roleplayDraftKey,inlineRoleplay,roleplayRecords,roleplayPlainText} from '../src/roleplay-domain.mjs';

test('roleplay previews resolve mentions before truncation and never expose stored UUID syntax',()=>{
 const id='765b4c5a-c03e-4dbf-892b-ccf7015ef879',text='솔라스는 대머리 빡빡이 @['+'알리스터'+']('+id+')';
 assert.equal(roleplayPlainText(text,[]),'솔라스는 대머리 빡빡이 @알리스터');
 assert.equal(roleplayPlainText(text,[{id,name:'새 이름'}]),'솔라스는 대머리 빡빡이 @새 이름');
 assert.equal(roleplayPlainText('**@[알리스터]('+id+')**',[],4),'@알리스…');
 assert.equal(roleplayPlainText('@\\[알리스터\\]\\('+id+'\\)',[]),'@알리스터');
 const records=roleplayRecords([],[{id:'root',thread_id:'root',character_id:'a',body:text,updated_at:'2026-11-17',created_at:'2026-11-17'}],['a']);
 assert.equal(records[0].title,'솔라스는 대머리 빡빡이 @알리스터');
});

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

test('roleplay workspace toggles panels, keeps the composer separate, restores drafts and retries safely',async()=>{
 const window=new Window({url:'http://localhost:8090'}),names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot','localStorage','history','location'];
 const previous=new Map(names.map(name=>[name,globalThis[name]]));for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});const generated=[];let app;
 const requests=[],revoked=[],revoke=URL.revokeObjectURL;URL.revokeObjectURL=url=>revoked.push(url);
 let failSend=true,failArchive=false,viewResponse=null;
 globalThis.__roleplayTestApi={
  request:async(path,options)=>{if(path.startsWith('/roleplay/sync')&&viewResponse)return viewResponse;const value=options?.body instanceof Blob?null:JSON.parse(options?.body||'{}');requests.push({path,value});if(path==='/roleplay/scenes'&&value.status){if(failArchive)throw Error('Archive failed');const old=viewResponse.scenes.find(row=>row.id===value.id);const saved={...old,status:value.status,revision:old.revision+1};viewResponse.scenes=viewResponse.scenes.map(row=>row.id===saved.id?saved:row);return saved;}if(path==='/roleplay/messages'&&failSend)throw Error('연결이 끊겼습니다');return {id:'saved'};},
  imageBlob:async path=>'blob:'+path,
 };
 try{
  const clientSource=(await readFile(new URL('../src/roleplay-client.mjs',import.meta.url),'utf8')).replace(/import \{request, imageBlob\} from ['"]\.\/api['"];?/g,'const {request,imageBlob}=globalThis.__roleplayTestApi;').replace(/from ['"]\.\/image\.mjs['"]/g,"from '../../src/image.mjs'");
  const clientFile=new URL('rp-client-'+process.pid+'.mjs',folder);await writeFile(clientFile,clientSource);generated.push(clientFile);
  const sources=['Portrait','MentionText','RoleplayText','RoleplayEditor','RoleplayMessage','RoleplayView'];
  for(const source of sources){
   const {descriptor}=parse(await readFile(new URL('../src/'+source+'.vue',import.meta.url),'utf8'));
   let code=compileScript(descriptor,{id:source,inlineTemplate:true}).content.replaceAll("'./affiliation.mjs'","'../../src/affiliation.mjs'");
   code=code.replace(/import \{request,imageBlob\} from ['"]\.\/api['"];?/g,'const {request,imageBlob}=globalThis.__roleplayTestApi;');
   code=code.replace(/import \{request\} from ['"]\.\/api['"];?/g,'const {request}=globalThis.__roleplayTestApi;');
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
  const hiddenId='765b4c5a-c03e-4dbf-892b-ccf7015ef879';
  const message=ref({id:'reply',owner_id:'one',character_id:'b',author_name:'이전 이름',faction:'templar',body:'hello **@[알리스터]('+hiddenId+')**',attachments:[],parent_id:'parent',created_at:'2026-11-17T01:00:00Z',revision:1});
  const all=[{id:'parent',author_name:'에이라',body:'원글 @[알리스터]('+hiddenId+')'},message.value,{id:'nested',parent_id:'reply',body:'답글'}],events=[],parents=[];
  app=createApp({render:()=>h(Message,{message:message.value,messages:all,characters,me:{id:'one',role:'member'},images:{},canReply:true,nested:true,threadRoot:{id:'root',character_id:'b',owner_id:'one'},onReply:row=>events.push(row),onParent:row=>parents.push(row)})});app.use(router);app.mount(host);
  assert.equal(host.querySelector('.rp-avatar-link').getAttribute('href'),'/characters/b');assert.equal(host.querySelector('.character-name').getAttribute('href'),'/characters/b');assert.match(host.textContent,/에이라에게/);
  assert.equal(host.querySelector('.rp-reply-reference').tagName,'BUTTON');
  assert.equal(host.querySelector('.rp-reply-reference').hasAttribute('href'),false);
  assert.equal(host.querySelector('.rp-reply-preview'),null);assert.equal(host.textContent.includes('원글'),false);
  assert.equal(host.querySelector('.rp-author-badge').textContent,'작성자');assert.ok(host.querySelector('.rp-message-meta .rp-message-actions'));assert.equal(host.querySelector('.faction-badge'),null);
  assert.equal(host.textContent.includes(hiddenId),false);assert.equal(host.textContent.includes('@['),false);
  assert.equal(host.querySelector('.rp-body strong').textContent,'@알리스터');
  assert.equal(host.querySelector('time').textContent,'11.17 10:00');assert.match(host.querySelector('time').title,/2026/);
  host.querySelector('button.rp-reply-reference').click();assert.equal(parents[0].id,'parent');
  [...host.querySelectorAll('button')].find(button=>button.textContent.trim()==='↳ 답글').click();assert.equal(events[0].id,'reply');
  message.value={...message.value,deleted_at:'now'};await nextTick();assert.match(host.textContent,/연결된 답글은 보존/);assert.equal(host.querySelector('.rp-body'),null);
  app.unmount();app=null;
  // The conversation scrolls separately from the composer; list and people panels are optional on mobile.
  const View=(await import(new URL('rp-RoleplayView-'+process.pid+'.mjs',folder).href)).default;
  const root={id:'root',thread_id:'root',owner_id:'one',character_id:'a',author_name:'에이라',faction:'mage',body:'늦은 밤의 도서관',attachments:[],created_at:'2026-11-17T01:00:00Z',updated_at:'2026-11-17T01:00:00Z',revision:1};
  viewResponse={cursor:1,scenes:[],messages:[root,{...root,id:'child',character_id:'b',parent_id:'root',body:'답변'}],reads:[],newly_visible:[],has_more:false};
  await router.push('/roleplay');
  app=createApp({render:()=>h(View,{me:{id:'one',role:'member',nickname:'오너'},characters,members:[],liveStatus:'live'})});app.use(router);app.mount(host);
  await new Promise(resolve=>setImmediate(resolve));await nextTick();
  assert.equal(host.querySelectorAll('.rp-thread-card .rp-message-actions button').length,2); // edit and delete only
  assert.equal(host.querySelector('.rp-thread-card > a').textContent,'대화 보기 · 답글 1개');
  assert.equal(host.querySelector('.rp-composer-dock'),null);
  host.querySelector('.rp-new-free').click();await nextTick();await nextTick();await nextTick();
  assert.ok(host.querySelector('.rp-composer-dock'));await change('.rp-composer-dock textarea','새 원글 임시저장');
  host.querySelector('[aria-label="작성창 닫기"]').click();await nextTick();assert.equal(host.querySelector('.rp-composer-dock'),null);
  host.querySelector('.rp-new-free').click();await nextTick();await nextTick();await nextTick();
  assert.equal(host.querySelector('.rp-composer-dock textarea').value,'새 원글 임시저장');
  await router.push('/roleplay/thread/root');await nextTick();
  assert.ok(host.querySelector('.rp-page--detail'));assert.equal(host.querySelectorAll('.rp-log .rp-message').length,1);
  assert.equal(host.querySelectorAll('.rp-transcript > .rp-original').length,1);assert.equal(host.querySelectorAll('#rp-message-root').length,1);assert.equal(host.querySelector('.rp-comments-heading strong').textContent,'댓글 1');
  assert.equal(host.querySelector('.rp-log .rp-is-reply'),null); // Replies to the original post stay at the first comment level.
  assert.equal(host.querySelector('.rp-composer-dock'),null);
  host.querySelector('.rp-mobile-bar button').click();await nextTick();assert.equal(host.querySelector('.rp-mobile-bar button').getAttribute('aria-expanded'),'true');
  host.querySelector('.rp-list-entry').click();await nextTick();assert.equal(host.querySelector('.rp-mobile-bar button').getAttribute('aria-expanded'),'false');
  host.querySelector('.rp-people-toggle').click();await nextTick();assert.equal(host.querySelectorAll('.rp-person').length,2);
  host.querySelector('[aria-label="참여 캐릭터 닫기"]').click();await nextTick();assert.equal(host.querySelector('.rp-people-panel'),null);
  [...host.querySelectorAll('.rp-log button')].find(button=>button.textContent.trim()==='↳ 답글').click();await nextTick();await nextTick();
  const dock=host.querySelector('.rp-composer-dock');assert.ok(dock);assert.equal(dock.closest('.rp-transcript'),null);assert.equal(dock.querySelector('textarea').getAttribute('rows'),'3');
  assert.match(dock.textContent,/에이라에게 답글/);assert.equal(document.activeElement,host.querySelector('.rp-composer-dock textarea'));
  await change('.rp-composer-dock textarea','답글 초안');host.querySelector('[aria-label="작성창 닫기"]').click();await nextTick();assert.equal(host.querySelector('.rp-composer-dock'),null);
  [...host.querySelectorAll('.rp-log button')].find(button=>button.textContent.trim()==='↳ 답글').click();await nextTick();await nextTick();
  assert.equal(host.querySelector('.rp-composer-dock textarea').value,'답글 초안');
  host.querySelector('.rp-composer-dock textarea').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));await nextTick();
  assert.equal(host.querySelector('.rp-composer-dock'),null);
  [...host.querySelectorAll('.rp-log button')].find(button=>button.textContent.trim()==='수정').click();await nextTick();await nextTick();assert.ok(host.querySelector('.rp-composer-dock'));assert.equal(host.querySelector('.rp-composer-dock textarea').value,'답변');
  app.unmount();app=null;
  // Direct archive controls persist only the status/revision and respect ownership.
  const scene={id:'archive-scene',owner_id:'one',title:'Archive scene',description:'',location:'',status:'active',participant_ids:['a'],member_ids:[],admin_ids:[],visibility:'members',join_policy:'open',image_path:null,created_at:'2026-11-17T01:00:00Z',updated_at:'2026-11-17T01:00:00Z',revision:3};
  viewResponse={cursor:10,scenes:[scene],messages:[],reads:[],newly_visible:[],has_more:false};
  await router.push('/roleplay/scene/archive-scene');
  const archiveMe=ref({id:'one',role:'member'});
  app=createApp({render:()=>h(View,{me:archiveMe.value,characters,members:[],liveStatus:'live'})});app.use(router);app.mount(host);
  await new Promise(resolve=>setImmediate(resolve));await nextTick();
  assert.equal(host.querySelectorAll('.rp-archive-button').length,2);
  assert.ok(host.querySelector('.rp-people-toggle + .rp-archive-button'));
  host.querySelector('.rp-scene-header-actions .rp-archive-button').click();
  await new Promise(resolve=>setImmediate(resolve));await nextTick();
  assert.deepEqual(requests.findLast(row=>row.path==='/roleplay/scenes').value,{id:scene.id,revision:3,status:'archived'});
  assert.equal(host.querySelector('.rp-archive-button').textContent,'보관 해제');
  assert.equal(host.querySelector('.rp-new-message'),null);
  host.querySelector('.rp-mobile-bar .rp-archive-button').click();
  await new Promise(resolve=>setImmediate(resolve));await nextTick();
  assert.equal(requests.findLast(row=>row.path==='/roleplay/scenes').value.status,'active');
  assert.ok(host.querySelector('.rp-new-message'));
  failArchive=true;host.querySelector('.rp-archive-button').click();
  await new Promise(resolve=>setImmediate(resolve));await nextTick();
  assert.match(host.querySelector('[role="alert"]').textContent,/Archive failed/);
  assert.equal(host.querySelector('.rp-archive-button').textContent,'보관');
  archiveMe.value={id:'other',role:'member'};await nextTick();assert.equal(host.querySelector('.rp-archive-button'),null);
  archiveMe.value={id:'other',role:'admin'};await nextTick();assert.ok(host.querySelector('.rp-archive-button'));
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
