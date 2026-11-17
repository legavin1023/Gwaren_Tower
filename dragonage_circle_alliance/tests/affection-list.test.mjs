import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import {Window} from 'happy-dom';

test('affection list keeps directional and zero scores, filters owned endpoints, searches and sorts',async()=>{
 const window=new Window({url:'http://localhost:8090'});
 const names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot','history','location'];const previous=new Map(names.map(name=>[name,globalThis[name]]));for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const {createApp,h,ref,nextTick}=await import('vue');const {createRouter,createMemoryHistory}=await import('vue-router');
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});const files=[];let app;
 try{
  for(const [name,sourceName] of [['portrait-'+process.pid,'Portrait'],['affection-'+process.pid,'AffectionList']]){
   const {descriptor}=parse(await readFile(new URL('../src/'+sourceName+'.vue',import.meta.url),'utf8'));
   const code=compileScript(descriptor,{id:name,inlineTemplate:true}).content.replaceAll('"./character-theme.mjs"', '"../../src/character-theme.mjs"').replaceAll("'./character-theme.mjs'","'../../src/character-theme.mjs'").replace("'./Portrait.vue'","'./portrait-"+process.pid+".mjs'");
   const file=new URL(name+'.mjs',folder);await writeFile(file,code);files.push(file);
  }
  const List=(await import(files[1].href)).default,characters=[{id:'a',name:'에이라',owner_id:'me'},{id:'b',name:'네리스',owner_id:'other'},{id:'c',name:'로웬',owner_id:'me'}];
  const affection=ref([{id:'1',source_id:'a',target_id:'b',value:75,note:'서고에서 쌓인 신뢰',updated_at:'2026-11-17T01:00:00Z'},{id:'2',source_id:'b',target_id:'a',value:45,note:'조금씩 친해짐',updated_at:'2026-11-17T02:00:00Z'},{id:'3',source_id:'a',target_id:'c',value:0,note:'아직 모르는 사이',updated_at:'2026-11-17T03:00:00Z'},{id:'4',source_id:'removed',target_id:'a',value:100},{id:'5',source_id:'a',target_id:'b',value:100,deleted_at:'now'}]);
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});await router.push('/affection');
  const compact=ref(false),targetCharacterId=ref('');
  const host=document.createElement('div');document.body.appendChild(host);app=createApp({render:()=>h(List,{characters,affection:affection.value,members:[],me:{id:'me'},compact:compact.value,targetCharacterId:targetCharacterId.value})});app.use(router);app.mount(host);
  const scores=()=>[...host.querySelectorAll('[role="meter"]')].map(el=>Number(el.getAttribute('aria-valuenow')));
  const change=async(label,value)=>{const select=host.querySelector('[aria-label="'+label+'"]');select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));await nextTick();};
  assert.deepEqual(scores(),[75,45,0]);assert.ok(host.querySelector('a').getAttribute('href').endsWith('/characters/a'));
  await change('호감도 기록 범위','sent');assert.deepEqual(scores(),[75,0]);
  await change('호감도 기록 범위','received');assert.deepEqual(scores(),[45,0]);
  await change('호감도 기록 범위','all');await change('호감도 정렬','low');assert.deepEqual(scores(),[0,45,75]);
  await change('호감도 정렬','recent');assert.deepEqual(scores(),[0,45,75]);
  await change('보내는 캐릭터 필터','b');assert.deepEqual(scores(),[45]);await change('보내는 캐릭터 필터','');
  const search=host.querySelector('[aria-label="호감도 검색"]');search.value='서고';search.dispatchEvent(new window.Event('input',{bubbles:true}));await nextTick();assert.deepEqual(scores(),[75]);
  search.value='없는 기록';search.dispatchEvent(new window.Event('input',{bubbles:true}));await nextTick();assert.equal(host.querySelectorAll('.affection-record').length,0);assert.match(host.textContent,/조건에 맞는/);
  host.querySelector('.affection-results-heading button').click();await nextTick();
  compact.value=true;targetCharacterId.value='a';await nextTick();assert.deepEqual(scores(),[45]);
  assert.equal(host.querySelector('.affection-filters'),null);assert.equal(host.querySelector('.affection-direction'),null);assert.equal(host.querySelector('.affection-character strong').textContent,'네리스');
  targetCharacterId.value='c';await nextTick();assert.deepEqual(scores(),[0]);
  targetCharacterId.value='b';await nextTick();assert.deepEqual(scores(),[75]);
  targetCharacterId.value='none';await nextTick();assert.deepEqual(scores(),[]);assert.match(host.textContent,/이 캐릭터를 향한 호감도 기록이 없습니다/);
  compact.value=false;targetCharacterId.value='';affection.value=[];await nextTick();assert.match(host.textContent,/아직 등록된 호감도가 없습니다/);
 }finally{app?.unmount();for(const file of files)await unlink(file);await window.happyDOM.abort();window.close();for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
