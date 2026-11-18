import test from 'node:test';
import assert from 'node:assert/strict';
import {accountRole,canUseAdminMode,readAdminMode,rememberAdminMode,memberForMode,accessModeKey,setRequestMode,getRequestMode,accessHeaders} from '../src/access-mode.mjs';

test('access mode defaults to member, persists per account and never changes the actual account role',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const admin={id:'root',role:'member',account_role:'superadmin'},other={id:'other',role:'admin'},member={id:'member',role:'member'};
 assert.equal(accountRole(admin),'superadmin');assert.equal(canUseAdminMode(admin),true);
 assert.equal(readAdminMode(admin,storage),false);
 rememberAdminMode(admin,true,storage);assert.equal(readAdminMode(admin,storage),true);assert.equal(readAdminMode(other,storage),false);
 assert.equal(memberForMode(admin,false).role,'member');assert.equal(memberForMode(admin,true).role,'superadmin');assert.equal(admin.account_role,'superadmin');assert.equal(admin.role,'member');
 rememberAdminMode(member,true,storage);assert.equal(readAdminMode(member,storage),false);assert.equal(memberForMode(member,true).role,'member');
 storage.setItem(accessModeKey(member),'admin');assert.equal(readAdminMode(member,storage),false);
 rememberAdminMode(admin,false,storage);assert.equal(readAdminMode(admin,storage),false);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(readAdminMode(admin,blocked),false);assert.doesNotThrow(()=>rememberAdminMode(admin,true,blocked));
});

test('mode changes are attached to ordinary API and private image requests',async()=>{
 const previous=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});};
 try{
  const {request,imageBlob}=await import('../src/api.js');
  setRequestMode('member');assert.equal(getRequestMode(),'member');assert.equal(accessHeaders()['X-Circle-Mode'],'member');
  await request('/me');assert.equal(calls.at(-1).options.headers['X-Circle-Mode'],'member');
  setRequestMode('admin');await request('/history');assert.equal(calls.at(-1).options.headers['X-Circle-Mode'],'admin');
  setRequestMode('member');const image=await imageBlob('private/test.webp');assert.equal(calls.at(-1).options.headers['X-Circle-Mode'],'member');URL.revokeObjectURL(image);
  setRequestMode('invalid');assert.equal(getRequestMode(),'member');
 }finally{globalThis.fetch=previous;setRequestMode('member');}
});
