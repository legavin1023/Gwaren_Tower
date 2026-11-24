<template>
 <section class="log-board" aria-label="로그 게시판">
  <div class="section-heading board-actions log-board-actions">

   <div class="log-view-switch" role="group" aria-label="로그 보기 방식">
    <button type="button" class="secondary-button" :aria-pressed="view==='text'" @click="setView('text')"><span aria-hidden="true">☷</span> 글 목록</button>
    <button type="button" class="secondary-button" :aria-pressed="view==='images'" @click="setView('images')"><span aria-hidden="true">▧</span> 이미지 보기</button>
   </div>
   <button class="primary-button" @click="$emit('create')">＋ 글 작성</button>
  </div>
  <div :class="view==='images' ? 'art-post-grid' : 'log-text-list'">
   <article v-for="post in rows" :key="post.id" :class="view==='images' ? 'card post-row art-post-card' : 'log-text-row'">
    <ImageSlider v-if="view==='images'" :items="attachments(post.id)" :label="post.title" compact :to="'/board/art/'+post.id" />
    <router-link :to="'/board/art/'+post.id" :class="view==='images' ? 'post-list-summary log-image-summary' : 'log-text-link'">
     <h3 class="log-row-title">{{ post.title }} <small v-if="attachments(post.id).length" class="log-attachment-count" :aria-label="'첨부 이미지 '+attachments(post.id).length+'장'">[{{ attachments(post.id).length }}장]</small></h3>
     <span class="log-row-author character-themed character-name" :style="characterTheme(byId(post.character_id))">{{ byId(post.character_id)?.name || owner(post.owner_id) }}</span>
     <time class="log-row-date" :datetime="post.created_at">{{ date(post.created_at) }}</time>
     <span v-if="post.character_ids?.length" class="log-row-tags" aria-label="태그한 캐릭터"><span v-for="id in post.character_ids" :key="id" class="character-themed character-name" :style="characterTheme(byId(id))">@{{ byId(id)?.name || '삭제된 캐릭터' }}</span></span>
    </router-link>
   </article>
  </div>
 </section>
</template>
<script setup>
import {ref,computed} from 'vue';
import ImageSlider from './ImageSlider.vue';
import {characterTheme} from './character-theme.mjs';
const props=defineProps({posts:{type:Array,default:()=>[]},media:{type:Array,default:()=>[]},characters:{type:Array,default:()=>[]},members:{type:Array,default:()=>[]}});
defineEmits(['create']);
const key='circle-log-view';
function initialView(){try{return localStorage.getItem(key)==='text'?'text':'images';}catch{return 'images';}}
const view=ref(initialView());
function setView(value){view.value=value;try{localStorage.setItem(key,value);}catch{/* Viewing works when browser storage is disabled. */}}
const rows=computed(()=>props.posts.filter(post=>post.category==='art'&&!post.deleted_at).slice().reverse());
function attachments(id){return props.media.filter(item=>item.post_id===id&&!item.deleted_at);}
function byId(id){return props.characters.find(character=>character.id===id);}
function owner(id){return props.members.find(member=>member.id===id)?.nickname||'오너';}
function date(value){return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}
</script>
