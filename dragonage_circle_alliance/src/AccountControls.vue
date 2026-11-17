<template>
  <div class="account-controls" :class="{'account-controls--compact':compact}">
    <div class="account-identity">
      <router-link :to="representative ? '/characters/'+representative.id : '/profile'" class="account-avatar" :aria-label="representative ? representative.name+' 캐릭터 소개 보기' : '내 프로필 보기'">
        <Portrait v-if="representative" :character="representative" />
        <span v-else class="portrait account-avatar-fallback">{{ (me.nickname || '오너').slice(0,1) }}</span>
      </router-link>
      <router-link to="/profile" class="account-nickname" :title="me.nickname || me.email">{{ me.nickname || me.email }}</router-link>
    </div>
    <div class="account-buttons">
      <button type="button" class="outline-button account-theme" :aria-label="dark ? '밝게 보기' : '어둡게 보기'" :title="dark ? '밝게 보기' : '어둡게 보기'" :aria-pressed="dark" @click="$emit('toggle-theme')">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="dark"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></template>
          <path v-else d="M20.4 14.3A8.8 8.8 0 0 1 9.7 3.6a8.8 8.8 0 1 0 10.7 10.7Z"/>
        </svg>
        <span class="account-theme-label">{{ dark ? '밝게 보기' : '어둡게 보기' }}</span>
      </button>
      <button type="button" class="outline-button account-logout" :disabled="busy" aria-label="로그아웃" title="로그아웃" @click="$emit('logout')">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v16h5m6-13 5 5-5 5m-7-5h12"/></svg>
        <span>로그아웃</span>
      </button>
    </div>
  </div>
</template>
<script setup>
import Portrait from './Portrait.vue';
defineProps({me:{type:Object,required:true},representative:{type:Object,default:null},dark:Boolean,busy:Boolean,compact:Boolean});
defineEmits(['toggle-theme','logout']);
</script>
