import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {limitAuthentication,limitMemberWrite,secureApiResponse} from '../worker/security.mjs';
function meter(limit){let time=0;const counts=new Map();return {keys:[],advance(){time++;},async limit({key}){this.keys.push(key);const full=time+':'+key,n=(counts.get(full)||0)+1;counts.set(full,n);return {success:n<=limit};}};}
test('login limits use hashed edge IPs, separate callbacks, and recover after a quota window',async()=>{
 const limiter=meter(1),env={AUTH_RATE_LIMITER:limiter};
 const req=ip=>new Request('https://site.test/api/auth/login',{headers:{'CF-Connecting-IP':ip}});
 await limitAuthentication(req('192.0.2.1'),env,'/auth/login');
 await assert.rejects(()=>limitAuthentication(req('192.0.2.1'),env,'/auth/login'),r=>r.status===429&&r.headers.get('Retry-After')==='60');
 await limitAuthentication(req('192.0.2.1'),env,'/auth/callback');
 await limitAuthentication(req('192.0.2.2'),env,'/auth/login');
 assert.ok(limiter.keys.every(key=>!key.includes('192.0.2.')));
 limiter.advance();await limitAuthentication(req('192.0.2.1'),env,'/auth/login');
});
test('write quotas are member-based, uploads share a separate quota, and logout/reads remain available',async()=>{
 const write=meter(1),upload=meter(1),env={WRITE_RATE_LIMITER:write,UPLOAD_RATE_LIMITER:upload},request=method=>new Request('https://site.test/api/test',{method});
 await limitMemberWrite(request('POST'),env,'/posts',{id:'one'});
 await assert.rejects(()=>limitMemberWrite(request('DELETE'),env,'/comments/id',{id:'one'}),r=>r.status===429);
 await limitMemberWrite(request('POST'),env,'/posts',{id:'two'});
 await limitMemberWrite(request('POST'),env,'/upload',{id:'one'});
 await assert.rejects(()=>limitMemberWrite(request('POST'),env,'/roleplay/upload',{id:'one'}),r=>r.status===429);
 const before=write.keys.length;
 await limitMemberWrite(request('GET'),env,'/data',{id:'one'});
 await limitMemberWrite(request('POST'),env,'/auth/logout',{id:'one'});
 assert.equal(write.keys.length,before);
 assert.equal(write.keys[0],upload.keys[0]);
});
test('missing or failing limiter bindings do not silently disable protection',async()=>{
 const request=new Request('https://site.test/api/auth/login');
 await assert.rejects(()=>limitAuthentication(request,{},'/auth/login'),r=>r.status===503);
 await assert.rejects(()=>limitAuthentication(request,{AUTH_RATE_LIMITER:{async limit(){throw Error('outage');}}},'/auth/login'),r=>r.status===503);
});
test('API errors, redirects and downloads retain their content and gain framing protection; sockets pass through',async()=>{
 for(const response of [new Response('denied',{status:403}),new Response(null,{status:302,headers:{Location:'https://accounts.google.com/'}}),new Response('html',{headers:{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",'Content-Disposition':'attachment; filename="roleplay.html"'}})]){
  const secured=secureApiResponse(response);
  assert.equal(secured.status,response.status);assert.equal(secured.headers.get('X-Frame-Options'),'DENY');assert.equal(secured.headers.get('Cache-Control'),'no-store');
  assert.match(secured.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  if(response.headers.has('Location'))assert.equal(secured.headers.get('Location'),response.headers.get('Location'));
  if(response.headers.has('Content-Disposition')){assert.match(secured.headers.get('Content-Security-Policy'),/sandbox/);assert.equal(await secured.text(),'html');}
 }
 const socket={status:101,webSocket:{}};assert.equal(secureApiResponse(socket),socket);
});
test('Pages CSP allows required assets without inline scripts, eval, arbitrary scripts or framing',async()=>{
 const headers=await readFile(new URL('../public/_headers',import.meta.url),'utf8');
 const csp=headers.match(/Content-Security-Policy: (.+)/)[1];
 assert.match(csp,/script-src 'self';/);assert.doesNotMatch(csp,/unsafe-eval/);assert.match(csp,/script-src-attr 'none'/);
 assert.match(csp,/img-src 'self' blob: data:/);assert.match(csp,/font-src 'self' https:\/\/cdn.jsdelivr.net/);assert.match(csp,/wss:\/\/gwaren-tower.pages.dev/);
 assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/object-src 'none'/);assert.match(headers,/X-Frame-Options: DENY/);
});
