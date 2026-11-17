<template>
  <section v-if="active" class="image-slider" :class="{'image-slider-compact':compact}" role="region" aria-roledescription="이미지 슬라이드" :aria-label="label" @keydown.left.prevent.stop="move(-1)" @keydown.right.prevent.stop="move(1)">
    <div class="image-slider-stage">
      <a v-if="active.image && !failed" class="image-slider-main" :href="to ? '#' + to : active.image" :target="to ? undefined : '_blank'" :rel="to ? undefined : 'noopener'" :aria-label="to ? label + ' 글 열기' : '현재 이미지 원본 열기'">
        <img :key="active.image" :src="active.image" :alt="active.caption || label" :loading="compact ? 'lazy' : 'eager'" @error="failed=true" />
      </a>
      <span v-else class="art-preview-unavailable">이미지를 불러올 수 없습니다.</span>
      <template v-if="items.length > 1">
        <button type="button" class="image-slider-arrow image-slider-prev" aria-label="이전 이미지" @click="move(-1)">‹</button>
        <button type="button" class="image-slider-arrow image-slider-next" aria-label="다음 이미지" @click="move(1)">›</button>
        <span class="image-slider-count" aria-live="polite" aria-atomic="true">{{ index + 1 }} / {{ items.length }}</span>
      </template>
    </div>
    <div v-if="items.length > 1" ref="rail" class="image-slider-thumbs" role="group" aria-label="이미지 미리보기">
      <button v-for="(item,i) in items" :key="item.id" type="button" class="image-slider-thumb" :class="{'is-selected':i===index}" :aria-label="(i+1)+'번 이미지 보기'" :aria-pressed="i===index" @click="select(i)">
        <img v-if="item.image" :src="item.image" alt="" loading="lazy" />
        <span>{{ i+1 }}</span>
      </button>
    </div>
    <div v-if="!compact && (active.caption || canDelete(active))" class="image-slider-caption">
      <p v-if="active.caption">{{ active.caption }}</p>
      <button v-if="canDelete(active)" type="button" class="secondary-button" aria-label="현재 이미지 삭제" @click="$emit('remove',active.id)">이미지 삭제</button>
    </div>
  </section>
</template>
<script setup>
import {ref,computed,watch,nextTick} from 'vue';
const props=defineProps({items:{type:Array,default:()=>[]},label:{type:String,default:'첨부 이미지'},compact:Boolean,to:{type:String,default:''},canDelete:{type:Function,default:()=>false}});
defineEmits(['remove']);
const selectedId=ref(null),rail=ref(null),failed=ref(false);
const index=computed(()=>Math.max(0,props.items.findIndex(item=>item.id===selectedId.value)));
const active=computed(()=>props.items[index.value]||null);
watch(()=>props.items.map(item=>item.id),()=>{if(!props.items.some(item=>item.id===selectedId.value))selectedId.value=props.items[0]?.id||null;},{immediate:true});
watch(()=>active.value?.image,()=>{failed.value=false;});
async function select(i){
 if(!props.items.length)return;
 const next=(i+props.items.length)%props.items.length;selectedId.value=props.items[next].id;
 await nextTick();
 const thumb=rail.value?.children[next];
 if(thumb&&rail.value){const left=thumb.offsetLeft-(rail.value.clientWidth-thumb.clientWidth)/2;rail.value.scrollTo({left:Math.max(0,left),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
}
function move(direction){return select(index.value+direction);}
</script>
