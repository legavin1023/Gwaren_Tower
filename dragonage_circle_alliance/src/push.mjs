import { request } from './api';
export const defaultPreferences=()=>({new_post:true,new_comment:true,tag:true,own_comment:true});
let registrationPromise;
export function environmentMessage() {
 if(!window.isSecureContext)return '브라우저 알림은 HTTPS 사이트에서 사용할 수 있습니다.';
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(ios&&!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone)return 'iPhone/iPad는 Safari에서 홈 화면에 추가한 뒤, 홈 화면의 앱을 열어 알림을 신청하세요.';
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return '이 브라우저는 푸시 알림을 지원하지 않습니다. 상단 알림 목록은 사용할 수 있습니다.';
 return '';
}
export function registerPushWorker() {
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return Promise.resolve(null);
 if(!registrationPromise)registrationPromise=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(async registration=>{
  if(!registration.active)await new Promise((resolve,reject)=>{
   const worker=registration.installing||registration.waiting;
   if(!worker){reject(new Error('알림 서비스가 준비되지 않았습니다.'));return;}
   const timer=setTimeout(()=>{worker.removeEventListener('statechange',check);reject(new Error('알림 서비스 준비 시간이 초과되었습니다.'));},15000);
   function check(){if(['activated','redundant'].includes(worker.state)){clearTimeout(timer);worker.removeEventListener('statechange',check);worker.state==='activated'?resolve():reject(new Error('알림 서비스 설치에 실패했습니다.'));}}
   worker.addEventListener('statechange',check);check();
  });
  return registration;
 }).catch(error=>{registrationPromise=null;throw error;});
 return registrationPromise;
}
function applicationKey(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export async function currentPushState() {
 const registration=await registerPushWorker(),subscription=await registration?.pushManager.getSubscription();
 if(!subscription)return {subscribed:false,preferences:defaultPreferences()};
 const state=await request('/push/state',{method:'POST',body:JSON.stringify({endpoint:subscription.endpoint})});
 return {...state,subscription};
}
// requestPermission happens before the first await, directly from a user click.
export async function enablePush(publicKey,prefs) {
 const unsupported=environmentMessage();if(unsupported)throw new Error(unsupported);
 if(!publicKey)throw new Error('운영자가 푸시 알림 서버 키를 먼저 설정해야 합니다.');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw new Error(permission==='denied'?'알림이 차단되었습니다. 브라우저의 사이트 설정에서 알림을 허용해 주세요.':'알림 허용을 선택해야 신청할 수 있습니다.');
 const registration=await registerPushWorker(),key=applicationKey(publicKey);
 let subscription=await registration.pushManager.getSubscription();
 if(subscription){
  const state=await request('/push/state',{method:'POST',body:JSON.stringify({endpoint:subscription.endpoint})});
  if(!state.subscribed||String(new Uint8Array(subscription.options.applicationServerKey||[]))!==String(key)){
   await request('/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:subscription.endpoint})});
   await subscription.unsubscribe();subscription=null;
  }
 }
 subscription ||= await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 try{await savePushPreferences(subscription,prefs);}catch(error){await subscription.unsubscribe();throw error;}
 return subscription;
}
export async function savePushPreferences(subscription,prefs) {await request('/push/subscribe',{method:'POST',body:JSON.stringify({subscription:subscription.toJSON(),preferences:prefs})});}
export async function disablePush() {
 const registration=await registerPushWorker(),subscription=await registration?.pushManager.getSubscription();
 if(subscription){await request('/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:subscription.endpoint})});await subscription.unsubscribe();}
}
