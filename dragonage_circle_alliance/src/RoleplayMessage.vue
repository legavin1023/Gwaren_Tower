<template>
  <article :id="'rp-message-'+message.id" class="rp-message" :class="{'rp-ooc':!message.character_id,'rp-deleted':message.deleted_at}">
    <router-link v-if="character" :to="'/characters/'+character.id" class="rp-avatar-link"><Portrait :character="character" /></router-link>
    <Portrait v-else :character="{name:message.author_name,faction:message.faction}" />
    <div class="rp-message-content">
      <header class="rp-message-meta">
        <div class="rp-message-author">
        <router-link v-if="character" :to="'/characters/'+character.id" class="character-name character-themed" :style="characterTheme(character)">{{ character.name }}</router-link>
        <strong v-else>{{ message.author_name }}</strong>
        <span v-if="!message.character_id" class="badge">OOC / 오너</span>
        <span v-else class="faction-badge" :class="message.faction">{{ message.faction === 'mage' ? '마법사' : '템플러' }}</span>
        </div>
        <div class="rp-message-timing">
          <time :datetime="message.created_at" :title="fullDate(message.created_at)">{{ date(message.created_at) }}</time>
          <small v-if="message.revision > 1 && !message.deleted_at">수정됨</small>
        </div>
      </header>
      <button v-if="parent" type="button" class="rp-reply-reference" :aria-label="parentName+'에게 쓴 답글의 원문 보기'" @click="$emit('parent',parent)">
        <span class="rp-reply-label">↳ {{ parentName }}에게 답글</span>
        <span class="rp-reply-preview">{{ parent.deleted_at ? '삭제된 메시지' : roleplayPlainText(parent.body,characters,100) || '첨부 이미지' }}</span>
      </button>
      <p v-if="message.deleted_at" class="muted">삭제된 메시지입니다. 연결된 답글은 보존됩니다.</p>
      <template v-else>
        <RoleplayText :text="preview ? roleplayPlainText(message.body,characters,450) : message.body" :characters="characters" />
        <div class="rp-attachments">
          <a v-for="path in message.attachments" :key="path" :href="images[path]" target="_blank" rel="noopener"><img v-if="images[path]" :src="images[path]" alt="역극 첨부 이미지" loading="lazy" /></a>
        </div>
        <footer class="rp-message-actions">
          <button v-if="canReply" class="text-button" @click="$emit('reply',message)">답글 {{ replies || '' }}</button>
          <small v-else-if="replies">답글 {{ replies }}</small>
          <button v-if="message.owner_id === me.id" class="text-button" @click="$emit('edit',message)">수정</button>
          <button v-if="message.owner_id === me.id || ['admin','superadmin'].includes(me.role)" class="text-button" @click="$emit('remove',message)">삭제</button>
        </footer>
      </template>
    </div>
  </article>
</template>
<script setup>
import {computed} from 'vue';
import Portrait from './Portrait.vue';
import RoleplayText from './RoleplayText.vue';
import {characterTheme} from './character-theme.mjs';
import {roleplayPlainText} from './roleplay-domain.mjs';
const props=defineProps({message:Object,characters:Array,me:Object,images:Object,messages:Array,canReply:Boolean,preview:Boolean});
defineEmits(['reply','edit','remove','parent']);
const character=computed(()=>props.characters.find(row=>row.id===props.message.character_id));
const parent=computed(()=>props.messages.find(row=>row.id===props.message.parent_id));
const parentName=computed(()=>props.characters.find(row=>row.id===parent.value?.character_id)?.name||parent.value?.author_name||'오너');
const replies=computed(()=>props.messages.filter(row=>row.parent_id===props.message.id&&!row.deleted_at).length);
function date(value){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));
 return parts.month+'.'+parts.day+' '+parts.hour+':'+parts.minute;
}
function fullDate(value){return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}
</script>
