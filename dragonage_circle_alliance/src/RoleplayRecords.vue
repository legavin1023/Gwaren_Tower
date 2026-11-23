<template>
  <section class="rp-records" aria-label="캐릭터 역극 기록">
    <h3>{{ characterIds.length > 1 ? '공통 역극 기록' : '역극 기록' }} <small>{{ records.length }}개</small></h3>
    <div class="rp-filter-grid">
      <label>기록 유형<select v-model="kind" class="form-input"><option value="">전체</option><option value="active">진행 중인 장면</option><option value="ended">종료·보관한 장면</option><option value="timeline">작성한 자유 역극</option><option value="reply">작성한 답글</option></select></label>
      <label>함께한 캐릭터<select v-model="other" class="form-input"><option value="">전체</option><option v-for="character in characters.filter(row => !characterIds.includes(row.id))" :key="character.id" :value="character.id">{{ character.name }}</option></select></label>
      <label>상대 소속<select v-model="faction" class="form-input"><option value="">전체</option><option v-for="option in affiliationOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <router-link v-for="record in filtered" :key="record.type+record.id" :to="record.url" class="rp-record-row">
      <span>{{ record.title || '이미지 역극' }} <small class="muted">{{ record.type === 'scene' ? statuses[record.status] : '자유 역극' }}</small></span>
      <small>{{ date(record.updated_at) }}</small>
    </router-link>
    <p v-if="!filtered.length && !loading" class="muted">열람 가능한 역극 기록이 없습니다.</p>
    <p v-if="loading" class="muted">역극 기록을 불러오는 중…</p>
  </section>
</template>
<script setup>
import {affiliationOptions,affiliationType,affiliationLabel} from './affiliation.mjs';
import {ref,computed,watch,onMounted} from 'vue';
import {useRoleplayFeed} from './roleplay-client.mjs';
import {roleplayRecords} from './roleplay-domain.mjs';
const props=defineProps({characterIds:{type:Array,default:()=>[]},characters:Array,version:Number});
const {scenes,messages,error,loading,sync}=useRoleplayFeed();
const kind=ref(''),other=ref(''),faction=ref(''),statuses={active:'진행 중',paused:'일시 중단',ended:'종료',archived:'보관'};
const records=computed(()=>roleplayRecords(scenes.value,messages.value,props.characterIds,props.characters));
const filtered=computed(()=>records.value.filter(record=>{
 const kindMatches=!kind.value||(kind.value==='active'&&record.type==='scene'&&['active','paused'].includes(record.status))||(kind.value==='ended'&&['ended','archived'].includes(record.status))||(kind.value==='timeline'&&record.type==='timeline'&&record.rows.some(row=>!row.parent_id&&props.characterIds.includes(row.character_id)))||(kind.value==='reply'&&record.rows.some(row=>row.parent_id&&props.characterIds.includes(row.character_id)));
 return kindMatches&&(!other.value||record.character_ids.includes(other.value))&&(!faction.value||record.character_ids.some(id=>!props.characterIds.includes(id)&&affiliationType(props.characters.find(character=>character.id===id))===faction.value));
}));
function date(value){return new Date(value).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'});}
onMounted(sync);watch(()=>props.version,sync);
</script>
