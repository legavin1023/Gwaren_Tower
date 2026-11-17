import test from 'node:test';import assert from 'node:assert/strict';
import {relationshipArchive} from '../src/relationship-archive.mjs';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';import {parse,compileScript} from '@vue/compiler-sfc';import {Window} from 'happy-dom';
test('pair archive matches both directions and both participants, with tags, authors and structured mentions only',()=>{
 const a='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 const characters=[{id:a},{id:b},{id:'c'},{id:'removed',deleted_at:'now'}],relationships=[{id:'r',source_id:a,target_id:b,status:'approved'},{id:'back',source_id:b,target_id:a,status:'approved'},{id:'pending',source_id:a,target_id:b,status:'pending'}];
 const posts=[{id:'tags',category:'art',character_ids:[a,b]},{id:'author',category:'story',character_id:a,character_ids:[b]},{id:'mention',category:'story',character_id:b,body:'@[A]('+a+')'},{id:'single',category:'art',character_ids:[a]},{id:'notice',category:'notice',character_ids:[a,b]},{id:'gone',category:'art',character_ids:[a,b],deleted_at:'now'}];
 const archive=relationshipArchive('r',characters,relationships,posts);assert.deepEqual(archive.settings.map(row=>row.id),['r','back']);assert.deepEqual(archive.stories.map(row=>row.id),['mention','author']);assert.deepEqual(archive.logs.map(row=>row.id),['tags']);
 assert.equal(relationshipArchive('pending',characters,relationships,posts),null);assert.equal(relationshipArchive('missing',characters,relationships,posts),null);
 assert.equal(relationshipArchive('r',characters.map(row=>row.id===b?{...row,deleted_at:'now'}:row),relationships,posts),null);
});

test('recruitment editor preserves settings and question form supports asking, owner-only answering and filtering',async()=>{
 const window=new Window({url:'http://localhost:8090'}),names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot','history','location'];
 const previous=new Map(names.map(name=>[name,globalThis[name]]));for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const {createApp,h,ref,nextTick}=await import('vue');const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});const files=[];let app;
 try{
  for(const source of ['RecruitmentEditor','RecruitmentStatus','CharacterQuestions']){
   const {descriptor}=parse(await readFile(new URL('../src/'+source+'.vue',import.meta.url),'utf8'));
   const code=compileScript(descriptor,{id:source,inlineTemplate:true}).content.replace(/['"]\.\/(character-theme|recruitment)\.mjs['"]/g,"'../../src/$1.mjs'");const file=new URL('social-'+source+'-'+process.pid+'.mjs',folder);await writeFile(file,code);files.push(file);
  }
  const [Editor,Status,Questions]=await Promise.all(files.map(async file=>(await import(file.href)).default));
  const extra=ref({theme_color:'#397e81',other:'Keep'}),me=ref({id:'asker',role:'member'}),questions=ref([]),requests=[];
  const character=()=>({id:'target',owner_id:'owner',name:'에이라',extra:extra.value});
  const host=document.createElement('div');document.body.appendChild(host);
  app=createApp({render:()=>h('div',{},[h(Editor,{modelValue:extra.value,'onUpdate:modelValue':value=>extra.value=value}),h(Status,{character:character(),details:true}),h(Questions,{character:character(),questions:questions.value,members:[{id:'asker',nickname:'질문자'},{id:'owner',nickname:'캐오너'}],me:me.value,onSave:(value,done)=>{requests.push(value);done(true);}})])});app.mount(host);
  const change=async(selector,value,event='change')=>{const el=host.querySelector(selector);el.value=value;el.dispatchEvent(new window.Event(event,{bubbles:true}));await nextTick();};
  await change('[aria-label="자관 모집 상태"]','specific');await change('[aria-label="자관 모집 안내"]','라이벌 모집','input');assert.equal(extra.value.other,'Keep');assert.equal(extra.value.theme_color,'#397e81');assert.match(host.querySelector('.recruitment-status').textContent,/특정 관계 모집.*라이벌 모집/);
  await change('[aria-label="캐릭터에게 남길 질문"]','비가 온다면?','input');host.querySelector('.question-compose').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await nextTick();assert.deepEqual(requests[0],{character_id:'target',body:'비가 온다면?'});assert.equal(host.querySelector('[aria-label="캐릭터에게 남길 질문"]').value,'');
  questions.value=[{id:'q',character_id:'target',owner_id:'asker',body:'비가 온다면?',answer:'',revision:1,created_at:'2026-11-17T01:00:00Z'}];me.value={id:'owner',role:'member'};await nextTick();assert.equal(host.querySelector('.question-compose'),null);
  [...host.querySelectorAll('.question-record button')].find(el=>el.textContent==='답변하기').click();await nextTick();await change('[aria-label="질문 답변"]','서고에 머문다.','input');host.querySelector('.question-record form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await nextTick();assert.deepEqual(requests[1],{id:'q',revision:1,answer:'서고에 머문다.'});
  questions.value=[{...questions.value[0],answer:'서고에 머문다.',answered_by:'owner',answered_at:'2026-11-17T02:00:00Z',revision:2}];await nextTick();assert.match(host.querySelector('.question-answer').textContent,/서고에 머문다/);
  await change('[aria-label="질문 상태 필터"]','waiting');assert.equal(host.querySelectorAll('.question-record').length,0);await change('[aria-label="질문 상태 필터"]','answered');assert.equal(host.querySelectorAll('.question-record').length,1);
  me.value={id:'outsider',role:'member'};await nextTick();assert.equal(host.querySelectorAll('.question-record button').length,0);
 }finally{app?.unmount();for(const file of files)await unlink(file);await window.happyDOM.abort();window.close();for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
