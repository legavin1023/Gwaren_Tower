<template>
 <section v-if="archive" class="relationship-archive">
  <router-link to="/relationships" class="outline-button">← 관계도로</router-link>
  <header class="card pair-hero"><router-link v-for="person in [archive.source,archive.target]" :key="person.id" :to="'/characters/'+person.id" class="pair-character character-themed character-name" :style="characterTheme(person)"><Portrait :character="person"/><strong>{{ person.name }}</strong></router-link></header>
  <h3>두 캐릭터의 관계 설정</h3>
  <article v-for="setting in archive.settings" :key="setting.id" class="card pair-setting"><p class="muted">{{ name(setting.source_id) }} {{ setting.directed?'→':'↔' }} {{ name(setting.target_id) }} · {{ setting.kind }}</p><h4>{{ setting.name }}</h4><p class="prose">{{ setting.description || '아직 관계 설명이 없습니다.' }}</p></article>
  <RoleplayRecords :character-ids="[archive.source.id,archive.target.id]" :characters="characters" :version="roleplayVersion" />
  <div class="section-heading"><h3>함께 쓴 썰 <small>{{ archive.stories.length }}</small></h3><button class="outline-button" @click="create('story')">＋ 함께 쓴 썰 작성</button></div>
  <router-link v-for="post in archive.stories" :key="post.id" :to="'/board/story/'+post.id" class="card post-row"><span>{{ post.title }}</span><small class="muted">{{ owner(post.owner_id) }} · {{ date(post.created_at) }}</small></router-link>
  <p v-if="!archive.stories.length" class="empty-state">두 캐릭터가 함께 등장한 썰이 없습니다.</p>
  <h3>함께 등장한 그림과 로그 <small>{{ archive.logs.length }}</small></h3>
  <LogBoard :posts="archive.logs" :media="media" :characters="characters" :members="members" @create="create('art')" />
  <p v-if="!archive.logs.length" class="empty-state">두 캐릭터가 함께 등장한 로그가 없습니다.</p>
  <p class="muted">두 캐릭터의 태그·멘션과 작성 캐릭터를 기준으로 자동으로 모읍니다.</p>
 </section>
 <p v-else class="empty-state">승인된 관계와 두 캐릭터를 찾을 수 없습니다. <router-link to="/relationships">관계도로 돌아가기</router-link></p>
</template>
<script setup>
import {computed} from 'vue';import {relationshipArchive} from './relationship-archive.mjs';import {characterTheme} from './character-theme.mjs';import Portrait from './Portrait.vue';import LogBoard from './LogBoard.vue';
import RoleplayRecords from './RoleplayRecords.vue';
const props=defineProps({relationshipId:String,characters:Array,relationships:Array,posts:Array,media:Array,members:Array,roleplayVersion:Number});const emit=defineEmits(['create']);
const archive=computed(()=>relationshipArchive(props.relationshipId,props.characters,props.relationships,props.posts));
function name(id){return props.characters.find(character=>character.id===id)?.name||'캐릭터';}function owner(id){return props.members.find(member=>member.id===id)?.nickname||'오너';}function date(value){return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}
function create(category){emit('create',{category,character_ids:[archive.value.source.id,archive.value.target.id]});}
</script>
