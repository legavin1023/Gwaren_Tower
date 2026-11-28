const responseError=(status,error)=>new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':'60'}});
async function limited(env,name,key){
 const binding=env[name];
 if(!binding?.limit)throw responseError(503,'요청 제한 설정을 확인 중입니다. 잠시 후 다시 시도해 주세요.');
 let result;
 try{result=await binding.limit({key});}catch{throw responseError(503,'요청을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');}
 if(!result?.success)throw responseError(429,'요청이 너무 많습니다. 1분 후 다시 시도해 주세요.');
}
async function keyHash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
export async function limitAuthentication(req,env,path){
 if(req.method!=='GET'||!['/auth/login','/auth/callback'].includes(path))return;
 // CF-Connecting-IP is supplied by Cloudflare, never use a client-chosen forwarded header.
 const ip=req.headers.get('CF-Connecting-IP')||'local-or-unknown';
 await limited(env,'AUTH_RATE_LIMITER',path+':'+await keyHash(ip));
}
export async function limitMemberWrite(req,env,path,me){
 if(['GET','HEAD','OPTIONS'].includes(req.method)||path==='/auth/logout')return;
 const upload=path==='/upload'||path==='/roleplay/upload';
 await limited(env,upload?'UPLOAD_RATE_LIMITER':'WRITE_RATE_LIMITER','member:'+await keyHash(me.id));
}
export function secureApiResponse(response){
 if(response.status===101)return response; // Preserve the WebSocket upgrade and socket.
 const headers=new Headers(response.headers);
 const csp=headers.get('Content-Security-Policy')||"default-src 'none'";
 headers.set('Content-Security-Policy',csp+"; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
 headers.set('X-Frame-Options','DENY');
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('Referrer-Policy','no-referrer');
 headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
 headers.set('Cache-Control','no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
