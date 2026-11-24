import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import {Window} from 'happy-dom';

test('account controls link identity, toggle theme icons, emit logout, and retain accessible mobile labels',async()=>{
 const window=new Window({url:'http://localhost:8090'});
 const names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot','history','location'];const previous=new Map(names.map(name=>[name,globalThis[name]]));for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const {createApp,h,ref,nextTick}=await import('vue');const {createRouter,createMemoryHistory}=await import('vue-router');
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});const files=[];let app;
 try{
  for(const [name,sourceName] of [['account-portrait-'+process.pid,'Portrait'],['account-'+process.pid,'AccountControls']]){
   const {descriptor}=parse(await readFile(new URL('../src/'+sourceName+'.vue',import.meta.url),'utf8'));
   const code=compileScript(descriptor,{id:name,inlineTemplate:true}).content.replaceAll('"./character-theme.mjs"', '"../../src/character-theme.mjs"').replaceAll("'./character-theme.mjs'","'../../src/character-theme.mjs'").replace("'./Portrait.vue'","'./account-portrait-"+process.pid+".mjs'");const file=new URL(name+'.mjs',folder);await writeFile(file,code);files.push(file);
  }
  const showMode=ref(true),showSession=ref(true);
  const Controls=(await import(files[1].href)).default,dark=ref(false),busy=ref(false),compact=ref(false),canAdmin=ref(false),adminMode=ref(false),representative=ref({id:'char-1',name:'에이라',faction:'mage'});let logout=0;
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});await router.push('/home');
  const host=document.createElement('div');document.body.appendChild(host);app=createApp({render:()=>h(Controls,{me:{nickname:'Oxy',email:'demo@example.test'},representative:representative.value,dark:dark.value,busy:busy.value,compact:compact.value,showMode:showMode.value,showSession:showSession.value,canAdmin:canAdmin.value,adminMode:adminMode.value,onChangeMode:value=>{adminMode.value=value;},onToggleTheme:()=>{dark.value=!dark.value;},onLogout:()=>{logout++;}})});app.use(router);app.mount(host);
  assert.ok(host.querySelector('.account-avatar').getAttribute('href').endsWith('/characters/char-1'));
  assert.equal(host.querySelector('.account-nickname').textContent,'Oxy');assert.ok(host.querySelector('.account-theme svg path'));
  assert.equal(host.querySelector('.account-mode'),null);canAdmin.value=true;await nextTick();
  host.querySelector('[aria-label="관리자 모드로 전환"]').click();await nextTick();assert.equal(adminMode.value,true);assert.equal(host.querySelector('.account-mode').getAttribute('aria-pressed'),'true');
  host.querySelector('[aria-label="일반 회원 모드로 전환"]').click();await nextTick();assert.equal(adminMode.value,false);
  host.querySelector('[aria-label="어둡게 보기"]').click();await nextTick();assert.equal(host.querySelector('.account-theme').getAttribute('aria-label'),'밝게 보기');assert.ok(host.querySelector('.account-theme svg circle'));
  compact.value=true;await nextTick();assert.ok(host.querySelector('.account-controls--compact'));assert.equal(host.querySelector('.account-theme').getAttribute('aria-pressed'),'true');
  host.querySelector('[aria-label="로그아웃"]').click();assert.equal(logout,1);busy.value=true;await nextTick();assert.equal(host.querySelector('.account-logout').disabled,true);
  assert.equal(host.querySelector('.account-mode').disabled,true);canAdmin.value=false;await nextTick();assert.equal(host.querySelector('.account-mode'),null);
  canAdmin.value=true;showSession.value=false;await nextTick();assert.ok(host.querySelector('.account-mode'));assert.equal(host.querySelector('.account-theme'),null);assert.equal(host.querySelector('.account-logout'),null);assert.ok(host.querySelector('.account-nickname'));
  showSession.value=true;showMode.value=false;await nextTick();assert.equal(host.querySelector('.account-mode'),null);assert.ok(host.querySelector('.account-theme'));assert.ok(host.querySelector('.account-logout'));
  representative.value=null;await nextTick();assert.ok(host.querySelector('.account-avatar').getAttribute('href').endsWith('/profile'));assert.equal(host.querySelector('.account-avatar-fallback').textContent,'O');
 }finally{app?.unmount();for(const file of files)await unlink(file);await window.happyDOM.abort();window.close();for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
