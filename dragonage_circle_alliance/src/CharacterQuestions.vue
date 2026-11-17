<template>
 <section class="character-questions" aria-label="캐릭터 질문함">
  <div class="section-heading"><h3>캐릭터 질문함</h3><label>보기<select v-model="filter" class="form-input" aria-label="질문 상태 필터"><option value="all">전체 질문</option><option value="answered">답변 완료</option><option value="waiting">답변 대기</option></select></label></div>
  <p class="muted">질문과 답변은 로그인한 오너들에게 공개되고 이 프로필에 보관됩니다.</p>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <form v-if="character.owner_id!==me.id" class="card question-compose" @submit.prevent="ask"><label>{{ character.name }}에게 질문<textarea v-model="body" class="form-textarea" required maxlength="2000" rows="3" aria-label="캐릭터에게 남길 질문" placeholder="이 상황에서 캐릭터는 어떻게 반응하나요?" :disabled="pending||busy"></textarea></label><button class="primary-button" :disabled="pending||busy">질문 남기기</button></form>
  <article v-for="question in rows" :key="question.id" class="card question-record">
   <header class="question-meta"><strong>{{ owner(question.owner_id) }}의 질문</strong><time :datetime="question.created_at">{{ date(question.created_at) }}</time><span class="badge">{{ question.answer?'답변 완료':'답변 대기' }}</span></header>
   <p class="prose">{{ question.body }}</p>
   <div v-if="question.answer" class="question-answer"><h4 class="character-themed character-name" :style="characterTheme(character)">{{ character.name }}의 답변</h4><p class="prose">{{ question.answer }}</p><small class="muted">{{ owner(question.answered_by) }} · {{ date(question.answered_at) }}</small></div>
   <form v-if="editing===question.id" @submit.prevent="submitEdit(question)"><label>{{ answering?'답변':'질문 수정' }}<textarea v-model="editBody" class="form-textarea" required :maxlength="answering?20000:2000" rows="5" :aria-label="answering?'질문 답변':'질문 수정 내용'" :disabled="pending||busy"></textarea></label><div class="toolbar"><button class="primary-button" :disabled="pending||busy">{{ answering?'답변 저장':'질문 수정 저장' }}</button><button type="button" class="secondary-button" :disabled="pending" @click="editing=null">취소</button></div></form>
   <div v-else class="toolbar"><button v-if="character.owner_id===me.id" class="outline-button" :disabled="pending||busy" @click="edit(question,true)">{{ question.answer?'답변 수정':'답변하기' }}</button><button v-if="question.owner_id===me.id && !question.answer" class="outline-button" :disabled="pending||busy" @click="edit(question,false)">질문 수정</button><button v-if="canDelete(question)" class="secondary-button" :disabled="pending||busy" @click="$emit('remove',question.id)">질문 삭제</button></div>
  </article>
  <p v-if="!rows.length" class="empty-state">{{ filter==='all'?'아직 남겨진 질문이 없습니다.':'해당 상태의 질문이 없습니다.' }}</p>
 </section>
</template>
<script setup>
import {ref,computed,watch} from 'vue';import {characterTheme} from './character-theme.mjs';
const props=defineProps({character:Object,questions:Array,members:Array,me:Object,busy:Boolean});const emit=defineEmits(['save','remove']);
const body=ref(''),editing=ref(null),editBody=ref(''),answering=ref(false),pending=ref(false),error=ref(''),filter=ref('all');
const rows=computed(()=>props.questions.filter(question=>!question.deleted_at&&question.character_id===props.character.id&&(filter.value==='all'||(filter.value==='answered'?!!question.answer:!question.answer))).slice().reverse());
function owner(id){return props.members.find(member=>member.id===id)?.nickname||'오너';}function date(value){return value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'';}
function canDelete(question){return [question.owner_id,props.character.owner_id].includes(props.me.id)||['admin','superadmin'].includes(props.me.role);}
function send(value,onSuccess){if(pending.value||props.busy)return;pending.value=true;error.value='';emit('save',value,(ok,message)=>{pending.value=false;if(ok)onSuccess();else error.value=message||'저장하지 못했습니다. 다시 시도해 주세요.';});}
function ask(){send({character_id:props.character.id,body:body.value},()=>body.value='');}
function edit(question,isAnswer){editing.value=question.id;answering.value=isAnswer;editBody.value=isAnswer?question.answer:question.body;error.value='';}
function submitEdit(question){send({id:question.id,revision:question.revision,[answering.value?'answer':'body']:editBody.value},()=>editing.value=null);}
watch(()=>props.character.id,()=>{body.value='';editing.value=null;error.value='';filter.value='all';});
</script>
