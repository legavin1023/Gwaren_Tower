import test from 'node:test';
import assert from 'node:assert/strict';
import {themeColor,characterTheme,contrast} from '../src/character-theme.mjs';
import {graphElements} from '../src/domain.mjs';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {parse,compileScript} from '@vue/compiler-sfc';
import {Window} from 'happy-dom';

test('theme colors are strict hex values, keep distinct graph accents, and remain readable on both themes',()=>{
 for(const value of ['',null,'red','#fff','url(evil)','#123456;color:red',42]){assert.equal(themeColor({extra:{theme_color:value}}),'');assert.deepEqual(characterTheme({extra:{theme_color:value}}),{});}
 for(const color of ['#ffffff','#000000','#ffff00','#00ff00','#0000ff','#AA6384','#647d87']){
  const style=characterTheme({extra:{theme_color:color}});assert.equal(style['--character-color'],color.toLowerCase());
  assert.ok(contrast(style['--character-ink-light'],'#c1c4c3')>=4.5);
  assert.ok(contrast(style['--character-ink-dark'],'#4d514f')>=4.5);
 }
 const elements=graphElements([{id:'a',name:'A',extra:{theme_color:'#123456'}},{id:'b',name:'B'}],[]);
 assert.equal(elements[0].data.themeColor,'#123456');assert.equal(elements[1].data.themeColor,'');
});

test('color picker edits, previews and resets color, while mentions resolve the actual character color',async()=>{
 const window=new Window({url:'http://localhost:8090'}),names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot','history','location'];
 const previous=new Map(names.map(name=>[name,globalThis[name]]));for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const {createApp,h,ref,nextTick}=await import('vue');const {createRouter,createMemoryHistory}=await import('vue-router');
 const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});const files=[];let app;
 try{
  for(const source of ['CharacterThemePicker','MentionText','Portrait']){
   const {descriptor}=parse(await readFile(new URL('../src/'+source+'.vue',import.meta.url),'utf8'));
   const code=compileScript(descriptor,{id:source,inlineTemplate:true}).content.replaceAll('"./character-theme.mjs"', '"../../src/character-theme.mjs"').replaceAll("'./character-theme.mjs'","'../../src/character-theme.mjs'").replaceAll("'./domain.mjs'","'../../src/domain.mjs'");
   const file=new URL('theme-'+source+'-'+process.pid+'.mjs',folder);await writeFile(file,code);files.push(file);
  }
  const [Picker,Mention,Portrait]=await Promise.all(files.map(async file=>(await import(file.href)).default));
  const color=ref('#AA6384'),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',character=()=>({id,name:'에이라',extra:{theme_color:color.value}});
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});await router.push('/');
  const host=document.createElement('div');document.body.appendChild(host);
  app=createApp({render:()=>h('div',{},[h(Picker,{modelValue:color.value,name:'에이라','onUpdate:modelValue':value=>color.value=value}),h(Mention,{text:'태그 @['+'예전 이름'+']('+id+')',characters:[character()]}),h(Portrait,{character:character()})])});app.use(router);app.mount(host);
  assert.match(host.querySelector('.character-mention').textContent,/@에이라/);assert.equal(host.querySelector('.character-mention').style.getPropertyValue('--character-color'),'#aa6384');
  const input=host.querySelector('input[type=color]');input.value='#397e81';input.dispatchEvent(new window.Event('input',{bubbles:true}));await nextTick();
  assert.equal(color.value,'#397e81');assert.equal(host.querySelector('.portrait').style.getPropertyValue('--character-color'),'#397e81');assert.equal(host.querySelector('.character-theme-preview').style.getPropertyValue('--character-color'),'#397e81');
  assert.equal(host.querySelector('[aria-label="추천 테마색"]'),null);
  const text=host.querySelector('input[type=text]');text.value='#123456';text.dispatchEvent(new window.Event('input',{bubbles:true}));await nextTick();assert.equal(color.value,'#123456');
  assert.equal(host.querySelector('.secondary-button'),null);
  text.value='';text.dispatchEvent(new window.Event('input',{bubbles:true}));await nextTick();assert.equal(color.value,'');assert.equal(host.querySelector('.character-mention').style.getPropertyValue('--character-color'),'');assert.equal(host.querySelector('.portrait').classList.contains('character-themed'),false);
 }finally{app?.unmount();for(const file of files)await unlink(file);await window.happyDOM.abort();window.close();for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
