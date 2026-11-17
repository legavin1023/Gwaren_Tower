/* Network-only: authenticated content and images are never cached here. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification(String(payload.title||'Gwaren Tower 새 알림').slice(0,160),{body:String(payload.body||'새 소식이 있습니다. 로그인 후 확인하세요.').slice(0,240),tag:payload.eventId||'circle-notification',data:{url:payload.url||'#/home'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const base=new URL(self.registration.scope);let url;
  try{url=new URL(event.notification.data?.url||'#/home',base);}catch{url=new URL('#/home',base);}
  if(url.origin!==base.origin||url.pathname!==base.pathname||!/^#\/(board\/(story|art|notice)\/[^/]+|characters\/[^/]+|home)$/.test(url.hash))url=new URL('#/home',base);
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
   if(new URL(client.url).origin===base.origin){try{const target=await client.navigate(url.href);if(target){await target.focus();return;}}catch{}}
  }
  await self.clients.openWindow(url.href);
 })());
});
