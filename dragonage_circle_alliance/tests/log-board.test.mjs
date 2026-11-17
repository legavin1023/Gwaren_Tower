import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import {Window} from 'happy-dom';

test('log views show the same posts, text mode has no images, tags retain color and choice persists',async()=>{
 const window=new Window({url:'http://localhost:8090'}),names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot','history','location','localStorage'];
 const previous=new Map(names.map(name=>[name,globalThis[name]]));for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const {createApp,h,ref,nextTick}=await import('vue');const {createRouter,createMemoryHistory}=await import('vue-router');
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});const files=[];let app;
 try{
  for(const source of ['ImageSlider','LogBoard']){
   const {descriptor}=parse(await readFile(new URL('../src/'+source+'.vue',import.meta.url),'utf8'));
   const code=compileScript(descriptor,{id:source,inlineTemplate:true}).content.replaceAll("'./character-theme.mjs'","'../../src/character-theme.mjs'").replaceAll("'./ImageSlider.vue'","'./log-ImageSlider-"+process.pid+".mjs'");
   const file=new URL('log-'+source+'-'+process.pid+'.mjs',folder);await writeFile(file,code);files.push(file);
  }
  const Board=(await import(files[1].href)).default;
  const posts=ref([{id:'a',category:'art',title:'First log',owner_id:'owner',character_ids:['c'],created_at:'2026-11-17T01:00:00Z'},{id:'story',category:'story',title:'Exclude story'},{id:'b',category:'art',title:'Second log',owner_id:'owner',character_ids:[],created_at:'2026-11-17T02:00:00Z'},{id:'removed',category:'art',deleted_at:'now'}]);
  const media=[{id:'m1',post_id:'a',image:'blob:first'},{id:'m2',post_id:'a',image:'blob:second'}];let creates=0;
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});await router.push('/board/art');
  const host=document.createElement('div');document.body.appendChild(host);
  const mount=()=>{app=createApp({render:()=>h(Board,{posts:posts.value,media,characters:[{id:'c',name:'에이라',extra:{theme_color:'#397e81'}}],members:[{id:'owner',nickname:'Oxy'}],onCreate:()=>creates++})});app.use(router);app.mount(host);};mount();
  const titles=()=>[...host.querySelectorAll('.log-row-title')].map(node=>node.textContent);
  assert.deepEqual(titles(),['Second log ','First log [2장]']);assert.equal(host.querySelectorAll('.image-slider').length,1);assert.equal(host.querySelectorAll('.image-slider-thumb').length,2);
  const buttons=host.querySelectorAll('.log-view-switch button');buttons[0].click();await nextTick();
  assert.equal(host.querySelectorAll('img').length,0);assert.equal(host.querySelectorAll('.image-slider').length,0);assert.equal(host.querySelectorAll('.log-text-row').length,2);assert.deepEqual(titles(),['Second log ','First log [2장]']);
  assert.equal(buttons[0].getAttribute('aria-pressed'),'true');assert.equal(localStorage.getItem('circle-log-view'),'text');
  assert.equal(host.querySelector('.log-row-tags .character-name').style.getPropertyValue('--character-color'),'#397e81');
  assert.equal(host.querySelector('.log-row-author').textContent,'Oxy');assert.equal(host.querySelector('.log-text-link').getAttribute('href'),'/board/art/b');
  host.querySelector('.primary-button').click();await nextTick();assert.equal(creates,1);
  posts.value=[...posts.value,{id:'new',category:'art',title:'Live log',character_ids:[],created_at:'2026-11-17T03:00:00Z'}];await nextTick();assert.equal(host.querySelectorAll('.log-text-row').length,3);assert.match(titles()[0],/Live log/);
  app.unmount();mount();assert.equal(host.querySelectorAll('img').length,0);assert.equal(host.querySelector('.log-view-switch button').getAttribute('aria-pressed'),'true');
  host.querySelectorAll('.log-view-switch button')[1].click();await nextTick();assert.equal(host.querySelectorAll('.image-slider').length,1);assert.equal(localStorage.getItem('circle-log-view'),'images');
  posts.value=[];await nextTick();assert.equal(host.querySelectorAll('article').length,0);
 }finally{app?.unmount();for(const file of files)await unlink(file);await window.happyDOM.abort();window.close();for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
