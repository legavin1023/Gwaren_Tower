import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import {Window} from 'happy-dom';

test('portrait editor previews attachments, reuses saved images, removes current image and releases previews',async()=>{
 const window=new Window({url:'http://localhost:8090'});
 const names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot'];
 const previous=new Map(names.map(name=>[name,globalThis[name]]));
 for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,revoked=[];
 URL.createObjectURL=file=>'blob:preview-'+file.name;URL.revokeObjectURL=url=>revoked.push(url);
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});
 const output=new URL('portrait-editor-'+process.pid+'.mjs',folder);let app;
 try{
  const {descriptor}=parse(await readFile(new URL('../src/CharacterPortraitEditor.vue',import.meta.url),'utf8'));
  const code=compileScript(descriptor,{id:'portrait-editor',inlineTemplate:true}).content.replace(/import \{ imageBlob \} from ['"]\.\/api['"];?/g,"const imageBlob = async path => 'blob:saved-'+path;");
  await writeFile(output,code);
  const Editor=(await import(output.href)).default;
  const {createApp,h,ref,nextTick}=await import('vue');
  const history=ref([{path:'first',created_at:'2026-11-16T00:00:00Z'},{path:'second',created_at:'2026-11-17T00:00:00Z'}]),path=ref('second'),file=ref(null);
  const host=document.createElement('div');document.body.appendChild(host);
  app=createApp({render:()=>h(Editor,{modelValue:history.value,imagePath:path.value,file:file.value,name:'A','onUpdate:modelValue':value=>history.value=value,'onUpdate:imagePath':value=>path.value=value,onSelect:value=>file.value=value})});app.mount(host);
  await nextTick();await nextTick();
  assert.equal(host.querySelectorAll('.character-portrait-history li').length,2);
  assert.equal(host.querySelector('details'),null);
  assert.match(host.querySelector('.character-portrait-history-head').textContent,/1\/2/);
  host.querySelector('[aria-label="다음 이미지"]').click();await nextTick();
  assert.match(host.querySelector('.character-portrait-history-head').textContent,/2\/2/);
  host.querySelector('[aria-label="다음 이미지"]').click();await nextTick();
  assert.match(host.querySelector('.character-portrait-history-head').textContent,/1\/2/);
  host.querySelector('[aria-label="이전 이미지"]').click();await nextTick();
  assert.match(host.querySelector('.character-portrait-history-head').textContent,/2\/2/);
  host.querySelector('[aria-label="이전 이미지"]').click();await nextTick();
  assert.equal(host.querySelector('.character-portrait-preview img').getAttribute('src'),'blob:saved-second');
  const input=host.querySelector('input[type=file]');
  assert.equal(input.hidden,true);
  let pickerOpened=0;input.click=()=>{pickerOpened++;};
  host.querySelector('[aria-label="프로필 이미지 첨부"]').click();assert.equal(pickerOpened,1);
  Object.defineProperty(input,'files',{configurable:true,value:[{name:'new.png',type:'image/png',size:200}]});
  input.dispatchEvent(new window.Event('change',{bubbles:true}));await nextTick();
  assert.equal(file.value.name,'new.png');assert.equal(host.querySelector('.character-portrait-preview img').getAttribute('src'),'blob:preview-new.png');
  host.querySelector('.character-portrait-choice').click();await nextTick();
  assert.equal(path.value,'first');assert.equal(file.value,null);assert.ok(revoked.includes('blob:preview-new.png'));
  assert.equal(host.querySelector('.character-portrait-choice').getAttribute('aria-pressed'),'true');
  host.querySelector('[aria-label="저장한 이미지 삭제"]').click();await nextTick();
  assert.equal(path.value,null);assert.deepEqual(history.value.map(image=>image.path),['second']);
  assert.equal(host.querySelector('[aria-label="다음 이미지"]').disabled,true);
  assert.equal(host.querySelector('.character-portrait-preview img'),null);
  app.unmount();app=null;assert.ok(revoked.includes('blob:saved-first'));assert.ok(revoked.includes('blob:saved-second'));
 }finally{
  app?.unmount();await unlink(output);URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;
  await window.happyDOM.abort();window.close();for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;
 }
});
