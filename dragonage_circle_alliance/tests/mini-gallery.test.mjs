import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import {Window} from 'happy-dom';

test('mini gallery displays full images separately, emits multiple attachments and deletion, and is read only on profiles',async()=>{
 const window=new Window({url:'http://localhost:8090'}),names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot'];
 const previous=new Map(names.map(name=>[name,globalThis[name]]));
 for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});
 const output=new URL('mini-gallery-'+process.pid+'.mjs',folder);let app;
 try{
  const {descriptor}=parse(await readFile(new URL('../src/CharacterMiniGallery.vue',import.meta.url),'utf8'));
  await writeFile(output,compileScript(descriptor,{id:'mini-gallery',inlineTemplate:true}).content);
  const Gallery=(await import(output.href)).default,{createApp,h,ref,nextTick}=await import('vue');
  const editable=ref(true),items=ref([{id:'fullbody',image:'blob:fullbody',caption:'전신'}]),selected=[],removed=[];
  const host=document.createElement('div');document.body.appendChild(host);
  app=createApp({render:()=>h(Gallery,{items:items.value,editable:editable.value,onSelect:files=>selected.push(files),onRemove:image=>removed.push(image)})});app.mount(host);
  assert.equal(host.querySelector('img').alt,'전신');assert.equal(host.querySelector('a').getAttribute('href'),'blob:fullbody');
  assert.equal(host.querySelector('a').getAttribute('target'),'_blank');
  const input=host.querySelector('input');assert.equal(input.hidden,true);assert.equal(input.multiple,true);
  let opened=0;input.click=()=>opened++;host.querySelector('[aria-label="전신·외관 이미지 첨부"]').click();assert.equal(opened,1);
  const files=[{name:'full.png'},{name:'side.png'}];Object.defineProperty(input,'files',{value:files});input.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.deepEqual(selected,[files]);
  host.querySelector('[aria-label="갤러리 이미지 삭제"]').click();assert.equal(removed[0].id,'fullbody');
  editable.value=false;await nextTick();assert.equal(host.querySelector('input'),null);assert.equal(host.querySelector('button'),null);assert.ok(host.querySelector('a'));
  items.value=[];await nextTick();assert.equal(host.querySelector('img'),null);assert.match(host.textContent,/사진을 따로 보관/);
 }finally{
  app?.unmount();await unlink(output);await window.happyDOM.abort();window.close();
  for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;
 }
});
