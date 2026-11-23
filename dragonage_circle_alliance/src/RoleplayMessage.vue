<template>
  <article :id="'rp-message-'+message.id" class="rp-message" :class="{'rp-ooc':!message.character_id,'rp-deleted':message.deleted_at,'rp-is-reply':nested,'rp-original':original}">
    <router-link v-if="character" :to="'/characters/'+character.id" class="rp-avatar-link"><Portrait :character="character" /></router-link>
    <Portrait v-else :character="{name:message.author_name,faction:message.faction}" />
    <div class="rp-message-content">
      <header class="rp-message-meta">
        <div class="rp-message-author">
        <router-link v-if="character" :to="'/characters/'+character.id" class="character-name character-themed" :style="characterTheme(character)">{{ character.name }}</router-link>
        <strong v-else>{{ message.author_name }}</strong>
        <span v-if="!message.character_id" class="badge">OOC / 오너</span>
        <span v-if="isOriginalAuthor" class="rp-author-badge">작성자</span>
        </div>
        <div class="rp-message-timing">
          <time :datetime="message.created_at" :title="fullDate(message.created_at)">{{ date(message.created_at) }}</time>
          <small v-if="message.revision > 1 && !message.deleted_at">수정됨</small>
        </div>
        <div v-if="!message.deleted_at" class="rp-message-actions">
          <button v-if="canReply && !preview" class="text-button" @click="$emit('reply',message)">↳ 답글</button>
          <button v-if="message.owner_id === me.id" class="text-button" @click="$emit('edit',message)">수정</button>
          <button v-if="message.owner_id === me.id || ['admin','superadmin'].includes(me.role)" class="text-button" @click="$emit('remove',message)">삭제</button>
        </div>
      </header>
      <p v-if="message.deleted_at" class="muted">삭제된 메시지입니다. 연결된 답글은 보존됩니다.</p>
      <template v-else>
        <button v-if="parent && nested" type="button" class="rp-reply-reference" :aria-label="parentName+'에게 쓴 답글의 원문 보기'" @click="$emit('parent',parent)">{{ parentName }}에게</button>
        <RoleplayText :text="preview ? roleplayPlainText(message.body,characters,450) : message.body" :characters="characters" />
        <div class="rp-attachments">
          <a v-for="path in message.attachments" :key="path" :href="images[path]" target="_blank" rel="noopener"><img v-if="images[path]" :src="images[path]" alt="역극 첨부 이미지" loading="lazy" /></a>
        </div>
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
const props=defineProps({message:Object,characters:Array,me:Object,images:Object,messages:Array,canReply:Boolean,preview:Boolean,original:Boolean,nested:Boolean,threadRoot:Object});
defineEmits(['reply','edit','remove','parent']);
const character=computed(()=>props.characters.find(row=>row.id===props.message.character_id));
const parent=computed(()=>props.messages.find(row=>row.id===props.message.parent_id));
const parentName=computed(()=>props.characters.find(row=>row.id===parent.value?.character_id)?.name||parent.value?.author_name||'오너');
const isOriginalAuthor=computed(()=>props.threadRoot && props.threadRoot.id!==props.message.id && (props.message.character_id ? props.threadRoot.character_id===props.message.character_id : !props.threadRoot.character_id && props.threadRoot.owner_id===props.message.owner_id));
function date(value){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));
 return parts.month+'.'+parts.day+' '+parts.hour+':'+parts.minute;
}
function fullDate(value){return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}
</script>
