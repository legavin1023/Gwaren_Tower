import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {parse,compileScript} from '@vue/compiler-sfc';
import {Window} from 'happy-dom';

test('image slider thumbnails, arrows, keyboard, permissions, refresh and deletion work without navigating the card',async()=>{
 const window=new Window({url:'http://localhost:8090',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
 const names=['window','document','Element','HTMLElement','SVGElement','Node'];const previous=new Map(names.map(name=>[name,globalThis[name]]));
 for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const {createApp,h,ref,nextTick}=await import('vue');
 const source=await readFile(new URL('../src/ImageSlider.vue',import.meta.url),'utf8');
 const {descriptor}=parse(source);const compiled=compileScript(descriptor,{id:'slider-test',inlineTemplate:true}).content;
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});
 const file=new URL('slider-'+process.pid+'.mjs',folder);await writeFile(file,compiled);
 let app;
 try{
  const Slider=(await import(pathToFileURL(fileURLToPath(file)).href)).default;
  const images=ref([{id:'1',image:'/one.png',caption:'첫 이미지',owner_id:'me'},{id:'2',image:'/two.gif',caption:'다른 오너',owner_id:'other'},{id:'3',image:'/three.webp',caption:'세 번째',owner_id:'me'}]);
  const compact=ref(false),removed=[];const host=document.createElement('div');document.body.appendChild(host);
  app=createApp({render:()=>h(Slider,{items:images.value,compact:compact.value,to:compact.value?'/board/art/demo':'',canDelete:item=>item.owner_id==='me',onRemove:id=>removed.push(id)})});app.mount(host);
  const main=()=>host.querySelector('.image-slider-main img');
  const click=async selector=>{host.querySelector(selector).click();await nextTick();await nextTick();};
  assert.equal(main().getAttribute('src'),'/one.png');assert.equal(host.querySelectorAll('.image-slider-thumb').length,3);
  await click('[aria-label="다음 이미지"]');assert.equal(main().getAttribute('src'),'/two.gif');assert.equal(host.querySelector('[aria-label="현재 이미지 삭제"]'),null);
  await click('[aria-label="3번 이미지 보기"]');assert.equal(main().getAttribute('src'),'/three.webp');
  host.querySelector('.image-slider').dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await nextTick();await nextTick();assert.equal(main().getAttribute('src'),'/one.png');
  await click('[aria-label="현재 이미지 삭제"]');assert.deepEqual(removed,['1']);
  images.value=images.value.filter(item=>item.id!=='1');await nextTick();await nextTick();assert.equal(main().getAttribute('src'),'/two.gif');
  images.value=images.value.map(item=>({...item,image:item.image+'?refreshed'}));await nextTick();assert.equal(main().getAttribute('src'),'/two.gif?refreshed');
  compact.value=true;await nextTick();assert.equal(host.querySelector('.image-slider-main').getAttribute('href'),'#/board/art/demo');
  assert.equal(host.querySelectorAll('a button').length,0);assert.equal(host.querySelector('.image-slider-caption'),null);
  images.value=[images.value[0]];await nextTick();assert.equal(host.querySelector('.image-slider-thumbs'),null);assert.equal(host.querySelector('.image-slider-arrow'),null);
  images.value=[];await nextTick();assert.equal(host.querySelector('.image-slider'),null);
 }finally{
  app?.unmount();await unlink(file);await window.happyDOM.abort();window.close();
  for(const [name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;
 }
});
