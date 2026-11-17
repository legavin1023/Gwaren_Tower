<template>
  <section aria-label="전체 호감도 기록">
    <p class="affection-intro">캐릭터가 누구에게 어떤 감정을 느끼는지 한곳에서 확인합니다. A → B와 B → A는 별개의 기록입니다.</p>
    <div class="card affection-filters">
      <label>기록 범위<select v-model="scope" class="form-input" aria-label="호감도 기록 범위"><option value="all">전체 기록</option><option value="sent">내 캐릭터가 보낸 호감도</option><option value="received">내 캐릭터가 받은 호감도</option></select></label>
      <label>보내는 캐릭터<select v-model="sourceId" class="form-input" aria-label="보내는 캐릭터 필터"><option value="">전체 캐릭터</option><option v-for="c in liveCharacters" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
      <label>받는 캐릭터<select v-model="targetId" class="form-input" aria-label="받는 캐릭터 필터"><option value="">전체 캐릭터</option><option v-for="c in liveCharacters" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
      <label>정렬<select v-model="sort" class="form-input" aria-label="호감도 정렬"><option value="high">높은 점수순</option><option value="low">낮은 점수순</option><option value="recent">최근 수정순</option></select></label>
      <label class="affection-search">검색<input v-model="search" type="search" class="form-input" aria-label="호감도 검색" placeholder="캐릭터 이름·감정 설명 검색" /></label>
    </div>
    <div class="affection-results-heading"><p class="muted" role="status">{{ filtered.length }}개 기록 <span v-if="filtered.length !== rows.length">/ 전체 {{ rows.length }}개</span></p><button v-if="scope!=='all'||sourceId||targetId||search" class="outline-button" @click="reset">필터 초기화</button></div>
    <div class="affection-list">
      <article v-for="row in filtered" :key="row.id" class="card affection-record">
        <div class="affection-pair">
          <router-link :to="'/characters/'+row.source.id" class="affection-character"><Portrait :character="row.source" /><span><strong>{{ row.source.name }}</strong><small>{{ owner(row.source.owner_id) }} · 보내는 캐릭터</small></span></router-link>
          <span class="affection-direction" aria-label="에게">→</span>
          <router-link :to="'/characters/'+row.target.id" class="affection-character"><Portrait :character="row.target" /><span><strong>{{ row.target.name }}</strong><small>{{ owner(row.target.owner_id) }} · 받는 캐릭터</small></span></router-link>
          <div class="affection-score"><strong>♥ {{ row.value }} <small>/ 100</small></strong><div class="affection-meter" role="meter" :aria-label="row.source.name+' → '+row.target.name+' 호감도'" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="row.value"><span :style="{width:row.value+'%'}"></span></div></div>
        </div>
        <p class="affection-note" :class="{muted:!row.note}">{{ row.note || '감정 설명이 없습니다.' }}</p>
        <small v-if="row.updated_at" class="affection-updated">{{ date(row.updated_at) }} 수정</small>
      </article>
    </div>
    <p v-if="!filtered.length" class="empty-state">{{ rows.length ? '조건에 맞는 호감도 기록이 없습니다.' : '아직 등록된 호감도가 없습니다. 캐릭터 소개에서 호감도를 기록해 주세요.' }}</p>
  </section>
</template>
<script setup>
import {ref,computed} from 'vue';
import Portrait from './Portrait.vue';
const props=defineProps({characters:{type:Array,default:()=>[]},affection:{type:Array,default:()=>[]},members:{type:Array,default:()=>[]},me:{type:Object,required:true}});
const scope=ref('all'),sourceId=ref(''),targetId=ref(''),sort=ref('high'),search=ref('');
const liveCharacters=computed(()=>props.characters.filter(c=>!c.deleted_at));
const rows=computed(()=>{
 const byId=new Map(liveCharacters.value.map(c=>[c.id,c]));
 return props.affection.filter(row=>!row.deleted_at&&byId.has(row.source_id)&&byId.has(row.target_id)).map(row=>({...row,source:byId.get(row.source_id),target:byId.get(row.target_id)}));
});
const filtered=computed(()=>{
 const keyword=search.value.trim().toLocaleLowerCase('ko');
 return rows.value.filter(row=>(!sourceId.value||row.source_id===sourceId.value)&&(!targetId.value||row.target_id===targetId.value)&&(scope.value!=='sent'||row.source.owner_id===props.me.id)&&(scope.value!=='received'||row.target.owner_id===props.me.id)&&(!keyword||[row.source.name,row.target.name,row.note||''].join(' ').toLocaleLowerCase('ko').includes(keyword))).sort((a,b)=>{
  const time=(Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0);
  return (sort.value==='high'?b.value-a.value:sort.value==='low'?a.value-b.value:time)||time||a.id.localeCompare(b.id);
 });
});
function owner(id){return props.members.find(member=>member.id===id)?.nickname||'오너';}
function date(value){return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}
function reset(){scope.value='all';sourceId.value='';targetId.value='';search.value='';}
</script>
