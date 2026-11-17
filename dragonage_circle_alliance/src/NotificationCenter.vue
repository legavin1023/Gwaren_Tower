<template>
  <div class="notification-center">
    <button class="secondary-button" :aria-expanded="open" aria-controls="notification-panel" @click="toggle">🔔 알림 <span v-if="unread" class="notification-count">{{ unread > 99 ? '99+' : unread }}</span></button>
    <section v-if="open" id="notification-panel" class="notification-panel" role="dialog" aria-label="알림 목록">
      <header class="modal-head"><h3>알림</h3><button class="secondary-button" aria-label="알림 닫기" @click="open=false">×</button></header>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="message" class="success" role="status">{{ message }}</p>
      <details class="push-settings">
        <summary>이 기기의 브라우저 알림 설정</summary>
        <p class="muted">허용하면 사이트를 닫아도 알림을 받습니다. 로그아웃하면 이 기기의 알림 구독이 해제됩니다.</p>
        <label v-for="setting in settings" :key="setting.key"><input v-model="prefs[setting.key]" type="checkbox" :disabled="working" /> {{ setting.label }}</label>
        <p v-if="environment" class="muted">{{ environment }}</p>
        <p v-else-if="!config.configured" class="muted">운영자가 푸시 알림 서버 설정을 준비 중입니다. 아래 알림 목록은 사용할 수 있습니다.</p>
        <p v-if="permissionDenied" class="muted">알림이 차단되어 있습니다. 브라우저 사이트 설정에서 알림을 허용해 주세요.</p>
        <div class="toolbar">
          <button v-if="!subscribed" class="primary-button" :disabled="working || !!environment || !config.configured || !hasSelection" @click="enable">브라우저 알림 허용</button>
          <template v-else><button class="primary-button" :disabled="working || !hasSelection" @click="updatePreferences">알림 설정 저장</button><button class="secondary-button" :disabled="working" @click="disable">이 기기 알림 해제</button></template>
        </div>
      </details>
      <div class="toolbar"><select v-model="filter" class="form-input" aria-label="알림 종류"><option value="all">전체 알림</option><option value="related">내 태그·내 글 반응</option></select><button class="outline-button" :disabled="working || !unread" @click="markAll">모두 읽음</button></div>
      <p v-if="loading" class="muted">알림을 불러오는 중…</p>
      <p v-else-if="!filtered.length" class="muted">새로운 알림이 없습니다.</p>
      <div class="notification-items"><button v-for="item in filtered" :key="item.id" class="notification-item" :class="{unread:!item.read_at}" @click="visit(item)"><strong>{{ item.title }}</strong><span>{{ item.body }}</span><small>{{ date(item.created_at) }}{{ item.read_at ? '' : ' · 안 읽음' }}</small></button></div>
    </section>
  </div>
</template>
<script setup>
import {ref,computed,onMounted,onBeforeUnmount,watch} from 'vue';
import {useRouter} from 'vue-router';
import {request} from './api';
import {defaultPreferences,environmentMessage,currentPushState,enablePush,disablePush,savePushPreferences} from './push.mjs';
const props=defineProps({version:Number});
const router=useRouter(),open=ref(false),items=ref([]),unread=ref(0),loading=ref(false),working=ref(false),error=ref(''),message=ref(''),filter=ref('all'),prefs=ref(defaultPreferences()),subscribed=ref(false),subscription=ref(null),config=ref({configured:false,publicKey:''});
const environment=environmentMessage();
const permissionDenied=ref('Notification' in window && Notification.permission==='denied');
const settings=[{key:'new_post',label:'새 글'},{key:'new_comment',label:'새 댓글'},{key:'tag',label:'내 캐릭터가 태그됨'},{key:'own_comment',label:'내 글·캐릭터 소개의 댓글, 내 댓글의 답글'}];
const hasSelection=computed(()=>Object.values(prefs.value).some(Boolean));
const filtered=computed(()=>items.value.filter(item=>filter.value==='all'||item.reasons.some(reason=>['tag','own_comment'].includes(reason))));
let timer,inflight=false,disposed=false;
const date=value=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
async function load(){if(inflight)return;inflight=true;loading.value=true;try{const data=await request('/notifications');if(!disposed){items.value=data.items;unread.value=data.unread;}}catch(e){if(open.value)error.value=e.message;}finally{inflight=false;loading.value=false;}}
async function deviceState(){config.value=await request('/push/config');if(environment)return;const state=await currentPushState();subscribed.value=state.subscribed;subscription.value=state.subscription;prefs.value=state.preferences; if(state.subscribed&&config.value.configured)await savePushPreferences(state.subscription,state.preferences);}
function toggle(){open.value=!open.value;if(open.value){error.value='';message.value='';permissionDenied.value='Notification' in window&&Notification.permission==='denied';load();deviceState().catch(e=>{error.value=e.message;});}}
async function perform(action){if(working.value)return;working.value=true;error.value='';message.value='';try{await action();}catch(e){error.value=e.message;}finally{working.value=false;}}
function enable(){return perform(async()=>{subscription.value=await enablePush(config.value.publicKey,prefs.value);subscribed.value=true;message.value='이 기기의 알림을 신청했습니다.';});}
function updatePreferences(){return perform(async()=>{await savePushPreferences(subscription.value,prefs.value);message.value='알림 설정을 저장했습니다.';});}
function disable(){return perform(async()=>{await disablePush();subscribed.value=false;subscription.value=null;message.value='이 기기의 알림을 해제했습니다.';});}
function markAll(){return perform(async()=>{await request('/notifications/read',{method:'POST',body:JSON.stringify({all:true})});await load();});}
async function visit(item){try{await request('/notifications/read',{method:'POST',body:JSON.stringify({ids:[item.id]})});if(!item.read_at){item.read_at=new Date().toISOString();unread.value=Math.max(0,unread.value-1);}open.value=false;await router.push(item.url.startsWith('#/')?item.url.slice(1):'/home');}catch(e){error.value=e.message;}}
function visible(){if(document.visibilityState==='visible')load();}
watch(()=>props.version,()=>load());
onMounted(()=>{load();deviceState().catch(()=>{});timer=setInterval(visible,30000);document.addEventListener('visibilitychange',visible);});
onBeforeUnmount(()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);});
</script>
