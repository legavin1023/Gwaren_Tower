import {publishRealtime} from './realtime.mjs';
export {RealtimeHub} from './realtime.mjs';
// This entry point is used only by wrangler.dev.toml, never the production worker.
import api from './index.mjs';
import {seedLocalDemo} from './demo-data.mjs';
const origin='http://localhost:8090';
const email='developer@circle.local';
const denied=(status=403)=>new Response(JSON.stringify({error:'로컬 개발 서버에서만 사용할 수 있습니다.'}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export default {async fetch(req,env,ctx){
 const url=new URL(req.url);
 if(env.LOCAL_DEVELOPMENT!=='1'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))return denied();
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==origin)return denied();
 if(req.headers.get('Sec-Fetch-Site')==='cross-site')return denied();
 const localEnv={...env,SITE_ORIGIN:origin,BOOTSTRAP_ADMIN_EMAIL:email,GOOGLE_CLIENT_ID:undefined,GOOGLE_CLIENT_SECRET:undefined,BACKUP_TOKEN:undefined,RESTORE_TOKEN:undefined,PUSH_VAPID_PUBLIC_KEY:undefined,PUSH_VAPID_PRIVATE_KEY:undefined,PUSH_VAPID_SUBJECT:undefined};
 if(url.pathname==='/api/auth/callback')return denied(404);
 if(url.pathname==='/api/auth/login'){
  if(req.method!=='GET')return denied(405);
  const stamp=new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO members(id,email,nickname,role,active,created_at,updated_at) VALUES(?,?,?,'admin',1,?,?)").bind('local-developer',email,'로컬 관리자',stamp,stamp).run();
  const member=await env.DB.prepare('SELECT id FROM members WHERE email=? AND active=1').bind(email).first();
  if(!member)return denied();
  const token=crypto.randomUUID()+crypto.randomUUID();
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('INSERT INTO sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(digest,member.id,Date.now()+86400000)]);
  return new Response(null,{status:302,headers:{Location:origin+'/#/home','Set-Cookie':`circle_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,'Cache-Control':'no-store'}});
 }
 if(url.pathname==='/api/dev/seed'){
  if(req.method!=='POST'||req.headers.get('Origin')!==origin)return denied();
  const auth=await api.fetch(new Request(origin+'/api/me',{headers:{Cookie:req.headers.get('Cookie')||''}}),localEnv,ctx);
  if(auth.status!==200)return denied();
  const me=await auth.json();if(me.id!=='local-developer'||me.role!=='superadmin')return denied();
  const result=await seedLocalDemo(env);if(result.seeded)await publishRealtime(localEnv,{data:true,notificationMembers:['local-developer']},ctx);
  return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Circle-Local-Development':'1'}});
 }
 const response=await api.fetch(req,localEnv,ctx);
 if(response.status===101)return response;
 const headers=new Headers(response.headers);headers.set('X-Circle-Local-Development','1');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}};
