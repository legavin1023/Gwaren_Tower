import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';import {parse,compileScript,compileTemplate} from '@vue/compiler-sfc';import {Window} from 'happy-dom';import {contrast} from '../src/character-theme.mjs';
test('codex paper, dark surfaces and controls preserve readable contrast',async()=>{
 const css=await readFile(new URL('../src/codex.css',import.meta.url),'utf8');
 const root=css.slice(css.indexOf(':root {'),css.indexOf(':root:has')),dark=css.slice(css.indexOf(':root:has'),css.indexOf('body,'));
 const tokens=text=>Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(match=>[match[1],match[2]]));
 assert.ok(contrast(tokens(root)['--ink'],tokens(root)['--paper'])>=4.5);
 assert.ok(contrast(tokens(root)['--muted'],tokens(root)['--paper'])>=4.5);
 for(const theme of [tokens(root),{...tokens(root),...tokens(dark)}]){
  assert.ok(contrast(theme['--surface-ink'],theme['--panel'])>=4.5);assert.ok(contrast(theme['--surface-muted'],theme['--panel'])>=4.5);assert.ok(contrast(theme['--field-ink'],theme['--field'])>=4.5);assert.ok(contrast(theme['--surface-line'],theme['--field'])>=3);
 }
 assert.ok(contrast('#f8f9fa','#8d2929')>=4.5);
});
test('tarot card preserves profile navigation, owner, affiliation and recruitment, and recovers from a broken portrait',async()=>{
 const window=new Window({url:'http://localhost:8090'}),names=['window','document','Element','HTMLElement','SVGElement','Node','Document','ShadowRoot','history','location'];const previous=new Map(names.map(name=>[name,globalThis[name]]));for(const name of names)globalThis[name]=name==='window'?window:window[name];
 const {createApp,h,ref,nextTick}=await import('vue'),{createRouter,createMemoryHistory}=await import('vue-router');const folder=new URL('../.wrangler/component-tests/',import.meta.url);await mkdir(folder,{recursive:true});const files=[];let app;
 try{
  for(const source of ['CodexIcon','RecruitmentStatus','CodexHero','CharacterCard']){
   const {descriptor}=parse(await readFile(new URL('../src/'+source+'.vue',import.meta.url),'utf8'));let code;
   if(descriptor.scriptSetup||descriptor.script)code=compileScript(descriptor,{id:source,inlineTemplate:true}).content;
   else code=compileTemplate({source:descriptor.template.content,id:source,filename:source+'.vue'}).code+'\nexport default {render};';
   code=code.replace(/from ['"]\.\/([^'"]+)\.vue['"]/g,(_,name)=>"from './codex-"+name+'-'+process.pid+".mjs'").replace(/from ['"]\.\/([^'"]+\.mjs)['"]/g,(all,name)=>name.startsWith('codex-')?all:"from '../../src/"+name+"'");
   const file=new URL('codex-'+source+'-'+process.pid+'.mjs',folder);await writeFile(file,code);files.push(file);
  }
  const Card=(await import(files[3].href)).default,Hero=(await import(files[2].href)).default,character=ref({id:'test-character',name:'에이라',owner_id:'me',faction:'mage',position:'서고 기록관',image:'/portrait.webp',extra:{theme_color:'#397e81',affiliation_type:'chantry',recruitment_status:'open'}});
  const artwork=ref('');
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});await router.push('/characters');const host=document.createElement('div');document.body.appendChild(host);app=createApp({render:()=>h('div',{},[h(Card,{character:character.value,owner:'Oxy'}),h(Hero,{artwork:artwork.value})])});app.use(router);app.mount(host);
  const card=()=>host.querySelector('.tarot-card'),portrait=()=>card().querySelector('.tarot-image-frame>img');
  assert.equal(card().getAttribute('href'),'/characters/test-character');assert.equal(card().style.getPropertyValue('--character-color'),'#397e81');assert.match(card().textContent,/성가회/);assert.match(card().textContent,/관계 모집 중/);assert.match(card().textContent,/Oxy/);assert.equal(card().querySelector('.tarot-record'),null);
  portrait().dispatchEvent(new window.Event('error'));await nextTick();assert.equal(portrait(),null);assert.equal(card().querySelector('.tarot-color-placeholder').style.background,'#397e81');assert.equal(card().querySelector('.tarot-color-placeholder').textContent,'');
  character.value={...character.value,image:'/new-portrait.webp'};await nextTick();await nextTick();assert.equal(portrait().getAttribute('src'),'/new-portrait.webp');
  character.value={...character.value,image:'',extra:{...character.value.extra,theme_color:'#123456'}};await nextTick();await nextTick();assert.equal(card().querySelector('.tarot-color-placeholder').style.background,'#123456');assert.equal(host.querySelector('.codex-crest'),null);assert.equal(host.querySelector('.codex-hero h2').textContent,'Gwaren Tower');assert.equal(host.querySelector('.codex-hero-links a').getAttribute('href'),'/characters');assert.equal(host.querySelector('.codex-hero-art'),null);assert.equal(host.querySelector('.codex-hero-shade'),null);artwork.value='/codex/custom-illustration.webp';await nextTick();assert.equal(host.querySelector('.codex-hero-art').getAttribute('src'),artwork.value);
 }finally{app?.unmount();for(const file of files)await unlink(file);await window.happyDOM.abort();window.close();for(const[name,value]of previous)if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
