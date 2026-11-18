<template>
  <form class="rp-editor" :class="{'rp-editor--compact':compact}" @submit.prevent="submit" @keydown.ctrl.enter.prevent="submit">
    <div class="rp-editor-heading">
      <Portrait v-if="selected" :character="selected" />
      <label><span :class="{'sr-only':compact}">작성 캐릭터</span>
        <select v-model="actor" class="form-input" :disabled="!!editing || busy">
          <option value="">OOC / 오너</option>
          <option v-for="character in actors" :key="character.id" :value="character.id">{{ character.name }} — {{ character.faction === 'mage' ? '마법사' : '템플러' }}</option>
        </select>
      </label>
      <span v-if="!actor" class="badge">OOC · {{ me.nickname }}</span>
    </div>
    <p v-if="reply" class="rp-reply-reference">↳ {{ reply.author_name }}에게 답글 <button type="button" class="text-button" @click="$emit('cancel')">취소</button></p>
    <label :for="inputId" :class="{'sr-only':compact}">{{ editing ? '메시지 수정' : '대사와 행동' }}</label>
    <textarea :id="inputId" v-model="body" class="form-textarea" :rows="compact ? 3 : 6" maxlength="20000" :disabled="busy" placeholder="대사를 적어주세요. 행동 묘사는 *이렇게* 쓸 수 있어요." />
    <details class="rp-editor-extras"><summary>이미지 · 멘션 · 미리보기<span v-if="attachments.length"> · 첨부 {{ attachments.length }}</span></summary>
    <select class="form-input rp-mention-select" aria-label="캐릭터 멘션 추가" :disabled="busy" @change="mention">
      <option value="">캐릭터 멘션 추가</option>
      <option v-for="character in characters" :key="character.id" :value="character.id">{{ character.name }}</option>
    </select>
    <div class="rp-attachments">
      <div v-for="path in attachments" :key="path">
        <a v-if="previews[path]" :href="previews[path]" target="_blank" rel="noopener"><img :src="previews[path]" alt="역극 첨부 이미지" /></a>
        <button type="button" class="text-button" :disabled="busy" @click="attachments = attachments.filter(item => item !== path)">첨부 삭제</button>
      </div>
    </div>
    <label class="rp-attach-label">이미지 첨부 (최대 10장)
      <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" :disabled="busy" @change="attach" />
    </label>
    <details class="rp-preview"><summary>작성 미리보기</summary><RoleplayText :text="body" :characters="characters" /></details>
    </details>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div class="toolbar">
      <small class="muted rp-draft-status">{{ draftStatus }}<span class="rp-send-hint"> · Ctrl+Enter</span></small>
      <button class="primary-button" :disabled="busy || (!body.trim() && !attachments.length)">{{ busy ? '저장 중…' : editing ? '수정 저장' : '전송' }}</button>
      <button v-if="editing" type="button" class="secondary-button" :disabled="busy" @click="$emit('cancel')">수정 취소</button>
    </div>
  </form>
</template>
<script setup>
import {ref,computed,watch,onBeforeUnmount} from 'vue';
import {request,imageBlob} from './api';
import {validateAttachments} from './image.mjs';
import {uploadRoleplay} from './roleplay-client.mjs';
import {roleplayDraftKey} from './roleplay-domain.mjs';
import Portrait from './Portrait.vue';
import RoleplayText from './RoleplayText.vue';
const props=defineProps({me:Object,actors:Array,characters:Array,sceneId:String,reply:Object,editing:Object,context:String,images:Object,compact:Boolean});
const emit=defineEmits(['saved','cancel']);
const actor=ref(props.editing ? props.editing.character_id || '' : props.actors[0]?.id || ''),body=ref(''),attachments=ref([]),previews=ref({}),busy=ref(false),error=ref(''),draftStatus=ref('이 기기에 자동 저장됩니다'),requestId=ref(crypto.randomUUID());
const inputId='rp-body-'+crypto.randomUUID(),selected=computed(()=>props.characters.find(character=>character.id===actor.value));
defineExpose({focus:()=>document.getElementById(inputId)?.focus({preventScroll:true})});
let disposed=false,restoring=false;
function mention(event) {
 const character=props.characters.find(row=>row.id===event.target.value);
 if(character)body.value+=' @['+character.name+']('+character.id+')';
 event.target.value='';
}
const key=who=>roleplayDraftKey(props.me.id,props.context,who);
function persist(who=actor.value) {
 if(restoring)return;
 try{localStorage.setItem(key(who),JSON.stringify({body:body.value,attachments:attachments.value,request_id:requestId.value}));draftStatus.value='이 기기에 임시 저장됨';}catch{draftStatus.value='임시 저장을 사용할 수 없습니다';}
}
function restore() {
 restoring=true;
 let saved;try{saved=JSON.parse(localStorage.getItem(key(actor.value))||'null');}catch{}
 body.value=typeof saved?.body==='string'?saved.body:(props.editing?.body||'');
 requestId.value=saved?.request_id||crypto.randomUUID();
 attachments.value=Array.isArray(saved?.attachments)?saved.attachments.filter(path=>typeof path==='string'):[...(props.editing?.attachments||[])];
 restoring=false;draftStatus.value=saved?'임시 저장한 글을 불러왔습니다':'이 기기에 자동 저장됩니다';
}
watch(actor,(_,previous)=>{persist(previous);restore();},{flush:'sync'});
watch([body,attachments],()=>persist(),{deep:true,flush:'sync'});
restore();
watch(attachments,async paths=>{
 for(const path of paths)if(!previews.value[path]){
  const url=await imageBlob(path).catch(()=>'');if(!url)continue;
  if(disposed)URL.revokeObjectURL(url);else previews.value[path]=url;
 }
},{immediate:true});
async function attach(event) {
 const files=Array.from(event.target.files||[]);event.target.value='';
 if(busy.value)return;busy.value=true;error.value='';
 try{validateAttachments(files,attachments.value.length);for(const file of files)attachments.value=[...attachments.value,await uploadRoleplay(file,props.sceneId)];}
 catch(e){error.value=e.message;}finally{busy.value=false;}
}
async function submit() {
 if(busy.value||(!body.value.trim()&&!attachments.value.length))return;
 busy.value=true;error.value='';
 try{
  const value={...(props.editing?{id:props.editing.id,revision:props.editing.revision}:{}),request_id:requestId.value,character_id:props.editing?.character_id??(actor.value||null),scene_id:props.sceneId||null,parent_id:props.editing?.parent_id||props.reply?.id||null,body:body.value,attachments:attachments.value};
  await request('/roleplay/messages',{method:'POST',body:JSON.stringify(value)});
  restoring=true;body.value='';attachments.value=[];requestId.value=crypto.randomUUID();try{localStorage.removeItem(key(actor.value));}catch{}restoring=false;draftStatus.value='이 기기에 자동 저장됩니다';
  emit('saved');
 }catch(e){error.value=e.message;}finally{busy.value=false;}
}
onBeforeUnmount(()=>{disposed=true;Object.values(previews.value).forEach(url=>URL.revokeObjectURL(url));});
</script>
