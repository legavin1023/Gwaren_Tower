<template>
  <section ref="pageElement" class="rp-page" :class="{'rp-page--detail':detail,'rp-page--bounded':detail || tab === 'timeline'}" :style="{'--rp-height':viewportHeight+'px'}">
    <div class="rp-mobile-bar">
      <button class="outline-button" :aria-expanded="listOpen" aria-controls="rp-scene-list" @click="listOpen = !listOpen">☰ 역극 목록</button>
      <button v-if="detail" class="text-button" :aria-pressed="peopleOpen" @click="peopleOpen = !peopleOpen">참여 캐릭터 {{ participantCharacters.length }}</button>
    </div>
    <div class="rp-workspace" :class="{'rp-workspace--people':detail && peopleOpen,'rp-workspace--list-open':listOpen}">
    <aside id="rp-scene-list" class="rp-list-panel" aria-label="역극 목록">
    <div class="rp-list-heading"><h3>역극 목록</h3><button class="text-button" @click="newScene">＋ 새 장면</button></div>
    <nav class="rp-tabs" aria-label="역극 메뉴">
      <button v-for="item in tabs" :key="item.key" class="outline-button" :aria-pressed="!detail && tab === item.key" @click="navigate(item.key)">{{ item.label }}</button>
    </nav>
    <label class="rp-list-search"><span class="sr-only">역극 검색</span><input v-model="query" class="form-input" placeholder="역극 검색" /></label>
    <details class="rp-list-options"><summary>필터 · 알림 설정</summary>
    <div class="rp-filter-grid">
      <label>등장 캐릭터<select v-model="filterCharacter" class="form-input"><option value="">전체</option><option v-for="character in characters" :key="character.id" :value="character.id">{{ character.name }}</option></select></label>
      <label>진영<select v-model="filterFaction" class="form-input"><option value="">전체</option><option value="mage">마법사</option><option value="templar">템플러</option></select></label>
      <label>시작일<input v-model="fromDate" type="date" class="form-input" /></label>
      <label>종료일<input v-model="toDate" type="date" class="form-input" /></label>
      <label>정렬<select v-model="sort" class="form-input"><option value="activity">최근 활동순</option><option value="created">최신 작성순</option></select></label>
    </div>
    <div class="rp-preferences">
      <label>역극 알림 <select v-model="preference" class="form-input" @change="savePreference"><option value="all">전체 알림</option><option value="replies">내 글의 답글만</option><option value="mentions">멘션·초대만</option><option value="off">끄기</option></select></label>
      <button class="text-button" :disabled="loading" @click="sync">새로고침</button>
    </div>
    </details>
    <nav class="rp-scene-links" aria-label="장면과 자유 역극">
      <router-link v-for="entry in sidebarEntries" :key="entry.path" :to="entry.path" class="rp-list-entry" :aria-current="route.path === entry.path ? 'page' : undefined" @click="listOpen = false">
        <strong>{{ entry.title }}</strong><span>{{ entry.subtitle }}</span><small>{{ entry.people }}</small>
      </router-link>
      <p v-if="!sidebarEntries.length && !loading" class="muted">조건에 맞는 역극이 없습니다.</p>
    </nav>
    </aside>
    <div class="rp-conversation">
    <div ref="transcriptElement" class="rp-transcript">
    <p v-if="error || actionError" class="error" role="alert">{{ actionError || error }}</p>
    <p v-if="notice" class="rp-new-notice" role="status">{{ notice }}</p>
    <form v-if="sceneDraft" class="card rp-scene-form" @submit.prevent="saveScene">
      <h3>{{ sceneDraft.id ? '장면 설정' : '새 장면 만들기' }}</h3>
      <label>제목<input v-model="sceneDraft.title" class="form-input" required maxlength="200" /></label>
      <label>장소<input v-model="sceneDraft.location" class="form-input" maxlength="200" /></label>
      <label>배경과 상황<textarea v-model="sceneDraft.description" class="form-textarea" rows="4" maxlength="20000" /></label>
      <div class="rp-filter-grid">
        <label>열람 범위<select v-model="sceneDraft.visibility" class="form-input"><option value="members">동맹 전체 공개</option><option value="participants">참여자 전용</option></select></label>
        <label>참여 방식<select v-model="sceneDraft.join_policy" class="form-input"><option value="open">공개 참여</option><option value="invite">초대 참여</option></select></label>
        <label>상태<select v-model="sceneDraft.status" class="form-input"><option v-for="(label,key) in statuses" :key="key" :value="key">{{ label }}</option></select></label>
      </div>
      <fieldset><legend>참여 캐릭터</legend><div class="rp-character-choices"><label v-for="character in characters" :key="character.id"><input v-model="sceneDraft.participant_ids" type="checkbox" :value="character.id" />{{ character.name }}</label></div></fieldset>
      <fieldset><legend>참여자 전용 장면에 열람을 허가할 운영자</legend><label v-for="member in admins" :key="member.id"><input v-model="sceneDraft.admin_ids" type="checkbox" :value="member.id" />{{ member.nickname }}</label></fieldset>
      <label>대표 이미지 (선택)<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="coverFile = $event.target.files[0] || null" /></label>
      <label v-if="sceneDraft.image_path"><input v-model="removeCover" type="checkbox" />기존 대표 이미지 제거</label>
      <div class="toolbar"><button class="primary-button" :disabled="busy">{{ busy ? '저장 중…' : '장면 저장' }}</button><button type="button" class="secondary-button" :disabled="busy" @click="sceneDraft = null">취소</button></div>
    </form>

    <template v-if="!detail">
      <h3>{{ tabs.find(item => item.key === tab)?.label }}</h3>
      <template v-if="tab === 'timeline'">
        <article v-for="root in pagedRoots" :key="root.id" class="card rp-thread-card">
          <RoleplayMessage :message="root" :characters="characters" :messages="messages" :me="me" :images="images" preview @edit="openThread(root,true)" @remove="askDelete('messages',root)" />
          <router-link :to="'/roleplay/thread/'+root.id">대화 보기 · 답글 {{ threadMessages(root.id).filter(item => item.id !== root.id && !item.deleted_at).length }}개</router-link>
        </article>
        <p v-if="!filteredRoots.length && !loading" class="empty-state">아직 역극이 없습니다. 새 이야기를 시작해 보세요.</p>
        <div v-if="rootPages > 1" class="rp-pagination"><button class="outline-button" :disabled="page <= 1" @click="page--">이전</button><span>{{ page }} / {{ rootPages }}</span><button class="outline-button" :disabled="page >= rootPages" @click="page++">다음</button></div>
      </template>
      <template v-else>
        <router-link v-for="item in filteredScenes" :key="item.id" :to="'/roleplay/scene/'+item.id" class="card rp-scene-card">
          <img v-if="images[item.image_path]" :src="images[item.image_path]" alt="장면 대표 이미지" class="rp-cover-thumb" />
          <div><h3>{{ item.title }}</h3><p>{{ item.location || '장소 미정' }} · {{ statuses[item.status] }}</p><p class="muted">{{ item.visibility === 'participants' ? '참여자 전용' : '동맹 전체 공개' }} · {{ item.join_policy === 'open' ? '공개 참여' : '초대 참여' }}</p>
          <div class="rp-scene-people"><Portrait v-for="id in item.participant_ids" :key="id" :character="byId(id)" /><small>{{ item.participant_ids.length }} 캐릭터 · 최근 활동 {{ date(activity(item)) }}</small></div></div>
          <span v-if="unread(item)" class="badge">새 글</span>
        </router-link>
        <p v-if="!filteredScenes.length && !loading" class="empty-state">조건에 맞는 장면이 없습니다.</p>
        <template v-if="tab === 'mine'">
          <h3>참여한 자유 역극</h3>
          <router-link v-for="root in myRoots" :key="root.id" :to="'/roleplay/thread/'+root.id" class="card rp-record-row"><span>{{ root.deleted_at ? '삭제된 원글의 대화' : roleplayPlainText(root.body,characters,120) || '이미지 역극' }}</span><small>{{ date(activity(root)) }}</small></router-link>
          <p v-if="!myRoots.length && !loading" class="muted">참여한 자유 역극이 없습니다.</p>
        </template>
      </template>
    </template>

    <template v-else-if="currentScene || currentThread">
      <header v-if="currentScene" class="card rp-scene-header">
        <div class="rp-scene-heading"><div><span class="rp-eyebrow">ROLEPLAY · {{ currentScene.location || '자유 장면' }}</span><h2>{{ currentScene.title }}</h2><p class="muted">참여 캐릭터 {{ participantCharacters.length }}명 · {{ statuses[currentScene.status] }}</p></div><button class="outline-button rp-people-toggle" :aria-pressed="peopleOpen" @click="peopleOpen = !peopleOpen">참여 캐릭터</button></div>
        <img v-if="images[currentScene.image_path]" :src="images[currentScene.image_path]" alt="장면 대표 이미지" class="rp-scene-cover" />
        <p class="prose">{{ currentScene.description }}</p>
        <details class="rp-scene-options"><summary>장면 정보 · 참여 · 설정</summary>
        <p class="muted">{{ currentScene.visibility === 'participants' ? '참여자 전용' : '동맹 전체 공개' }} · {{ currentScene.join_policy === 'open' ? '공개 참여' : '초대 참여' }}</p>
        <div class="toolbar">
          <button v-if="canManage" class="outline-button" @click="editScene">장면 설정·종료·재개</button>
          <button v-if="canManage" class="secondary-button" @click="askDelete('scenes',currentScene)">장면 삭제</button>
        </div>
        <form v-if="currentScene.join_policy === 'open'" class="rp-inline-form" @submit.prevent="join">
          <select v-model="joinCharacter" class="form-input" aria-label="장면 참여 캐릭터"><option value="">OOC / 오너로 참여</option><option v-for="character in mine" :key="character.id" :value="character.id">{{ character.name }}</option></select><button class="outline-button" :disabled="busy">참여하기</button>
        </form>
        <form v-if="isParticipant || canManage" class="rp-inline-form" @submit.prevent="invite">
          <select v-model="inviteCharacter" class="form-input" required aria-label="초대할 캐릭터"><option value="">캐릭터 초대</option><option v-for="character in characters.filter(item => !currentScene.participant_ids.includes(item.id))" :key="character.id" :value="character.id">{{ character.name }}</option></select><button class="outline-button" :disabled="busy">초대</button>
        </form>
        </details>
      </header>
      <header v-else class="rp-scene-header"><div class="rp-scene-heading"><div><span class="rp-eyebrow">ROLEPLAY · 자유 역극</span><h2>{{ currentThread.author_name }}의 이야기</h2><p class="muted">참여 캐릭터 {{ participantCharacters.length }}명</p></div><button class="outline-button rp-people-toggle" :aria-pressed="peopleOpen" @click="peopleOpen = !peopleOpen">참여 캐릭터</button></div></header>
      <details class="rp-log-options"><summary>대화 보기 · 기록 저장</summary><div class="toolbar rp-log-tools">
        <label><input v-model="hideOoc" type="checkbox" />오너 발언 숨기기</label>
        <button class="outline-button" @click="markRead">여기까지 읽음</button>
        <a class="outline-button" :href="exportUrl('text')">텍스트 저장</a><a class="outline-button" :href="exportUrl('html')">HTML 저장</a>
      </div></details>
      <section class="card rp-log" aria-label="역극 대화">
        <template v-for="(message,index) in pagedMessages" :key="message.id">
          <p v-if="index === 0 || day(message.created_at) !== day(pagedMessages[index-1].created_at)" class="rp-day-divider">{{ day(message.created_at) }}</p>
          <RoleplayMessage :message="message" :characters="characters" :messages="messages" :me="me" :images="images" :can-reply="canWrite" @reply="setReply" @edit="setEdit" @remove="askDelete('messages',$event)" @parent="showParent" />
        </template>
        <p v-if="!visibleMessages.length" class="muted">아직 메시지가 없습니다.</p>
      </section>
      <div v-if="messagePages > 1" class="rp-pagination"><button class="outline-button" :disabled="page <= 1" @click="page--">이전</button><span>{{ page }} / {{ messagePages }}</span><button class="outline-button" :disabled="page >= messagePages" @click="page++">다음</button></div>
      <p v-if="!canWrite && !editing" class="muted">{{ currentScene?.status !== 'active' ? '진행 중인 장면으로 재개하면 이어 쓸 수 있습니다.' : '장면에 참여하거나 초대를 받으면 글을 작성할 수 있습니다.' }}</p>
    </template>
    <p v-else-if="!loading" class="empty-state">역극이 삭제되었거나 열람 권한이 없습니다.</p>
    <p v-if="loading" class="muted">역극 기록을 불러오는 중…</p>
    <section v-if="deleteTarget" class="card rp-delete-confirm" role="alertdialog" aria-label="역극 삭제 확인"><p>이 {{ deleteTarget.type === 'scenes' ? '장면' : '메시지' }}을 삭제할까요? 기록은 복구를 위해 보관됩니다.</p><button class="secondary-button" :disabled="busy" @click="performDelete">삭제</button> <button class="outline-button" :disabled="busy" @click="deleteTarget = null">취소</button></section>
    </div>
    <div v-if="detail ? (currentScene || currentThread) && (canWrite || editing) : tab === 'timeline'" class="rp-composer-dock">
      <RoleplayEditor v-if="detail" ref="composer" :key="editorContext" :context="editorContext" :me="me" :actors="sceneActors" :characters="characters" :scene-id="currentScene?.id" :reply="reply" :editing="editing" compact @cancel="cancelEditor" @saved="afterSave" />
      <template v-else><span class="rp-composer-title">새 자유 역극</span><RoleplayEditor ref="composer" key="timeline-new" context="timeline-new" :me="me" :actors="mine" :characters="characters" compact @saved="afterSave" /></template>
    </div>
    </div>
    <aside v-if="detail && peopleOpen" class="rp-people-panel" aria-label="참여 캐릭터 정보">
      <div class="rp-list-heading"><h3>참여 캐릭터</h3><button class="text-button" aria-label="참여 캐릭터 닫기" @click="peopleOpen = false">×</button></div>
      <router-link v-for="character in participantCharacters" :key="character.id" :to="'/characters/'+character.id" class="rp-person"><Portrait :character="character" /><div><strong>{{ character.name }}</strong><small>{{ [character.faction === 'mage' ? '마법사' : '템플러',character.race,character.age].filter(Boolean).join(' · ') }}</small><p v-if="character.affiliation">{{ character.affiliation }}</p></div></router-link>
      <p v-if="!participantCharacters.length" class="muted">오너 대화입니다.</p>
    </aside>
    </div>
  </section>
</template>
<script setup>
import {ref,computed,watch,onMounted,onBeforeUnmount,nextTick} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {request} from './api';
import {useRoleplayFeed,uploadRoleplay} from './roleplay-client.mjs';
import {roleplayPlainText} from './roleplay-domain.mjs';
import Portrait from './Portrait.vue';
import RoleplayEditor from './RoleplayEditor.vue';
import RoleplayMessage from './RoleplayMessage.vue';
const props=defineProps({me:Object,characters:Array,members:Array,version:Number,liveStatus:String});
const route=useRoute(),router=useRouter(),{scenes,messages,images,reads,error,loading,sync,ensureImages}=useRoleplayFeed();
const tabs=[{key:'timeline',label:'전체 타임라인'},{key:'active',label:'진행 중'},{key:'mine',label:'내가 참여한 역극'},{key:'archive',label:'역극 보관소'}];
const statuses={active:'진행 중',paused:'일시 중단',ended:'종료',archived:'보관'};
const pageElement=ref(null),transcriptElement=ref(null),composer=ref(null),viewportHeight=ref(680),listOpen=ref(false),peopleOpen=ref(false);
const tab=ref('timeline'),query=ref(''),filterCharacter=ref(''),filterFaction=ref(''),fromDate=ref(''),toDate=ref(''),sort=ref('activity'),page=ref(1),hideOoc=ref(false),reply=ref(null),editing=ref(null),sceneDraft=ref(null),coverFile=ref(null),removeCover=ref(false),busy=ref(false),actionError=ref(''),notice=ref(''),preference=ref('all'),joinCharacter=ref(''),inviteCharacter=ref(''),deleteTarget=ref(null);
let pendingEdit=null;
const mine=computed(()=>props.characters.filter(character=>character.owner_id===props.me.id));
const admins=computed(()=>props.members.filter(member=>['admin','superadmin'].includes(member.role)));
const detail=computed(()=>/^\/roleplay\/(scene|thread)\//.test(route.path));
const currentScene=computed(()=>route.path.includes('/scene/')?scenes.value.find(scene=>scene.id===route.path.split('/')[3]):null);
const currentThread=computed(()=>route.path.includes('/thread/')?messages.value.find(message=>message.id===route.path.split('/')[3]&&!message.scene_id):null);
const isParticipant=computed(()=>currentScene.value&&(currentScene.value.owner_id===props.me.id||currentScene.value.member_ids.includes(props.me.id)||currentScene.value.participant_ids.some(id=>byId(id)?.owner_id===props.me.id)));
const canManage=computed(()=>currentScene.value&&(currentScene.value.owner_id===props.me.id||['admin','superadmin'].includes(props.me.role)));
const canWrite=computed(()=>currentScene.value?currentScene.value.status==='active'&&isParticipant.value:!!currentThread.value);
const sceneActors=computed(()=>currentScene.value?mine.value.filter(character=>currentScene.value.participant_ids.includes(character.id)):mine.value);
const editorContext=computed(()=>['scene',currentScene.value?.id||'thread',currentThread.value?.id||'',editing.value?'edit:'+editing.value.id:reply.value?'reply:'+reply.value.id:'new'].join(':'));
const allCurrentMessages=computed(()=>messages.value.filter(message=>currentScene.value?message.scene_id===currentScene.value.id:currentThread.value?message.thread_id===currentThread.value.id: false).sort(chronological));
const participantCharacters=computed(()=>[...new Set([...(currentScene.value?.participant_ids||[]),...allCurrentMessages.value.map(row=>row.character_id)].filter(Boolean))].map(byId).filter(Boolean));
const visibleMessages=computed(()=>allCurrentMessages.value.filter(message=>!hideOoc.value||message.character_id));
const messagePages=computed(()=>Math.max(1,Math.ceil(visibleMessages.value.length/50)));
const pagedMessages=computed(()=>visibleMessages.value.slice((page.value-1)*50,page.value*50));
function byId(id){return props.characters.find(character=>character.id===id);}
function chronological(a,b){return a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id);}
function date(value){return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}
function day(value){return new Date(value).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'});}
function threadMessages(id){return messages.value.filter(message=>message.thread_id===id);}
function activity(item){return messages.value.filter(message=>item.thread_id?message.thread_id===item.id:message.scene_id===item.id).reduce((at,message)=>message.updated_at>at?message.updated_at:at,item.updated_at);}
function matches(item,rows) {
 const ids=new Set([...(item.participant_ids||[]),...rows.map(message=>message.character_id)].filter(Boolean));
 const words=[item.title,item.location,item.description,...rows.filter(message=>!message.deleted_at).map(message=>message.body)].join(' ').toLowerCase();
 const dateRows=rows.length?rows:[item];
 return (!query.value||words.includes(query.value.toLowerCase()))&&(!filterCharacter.value||ids.has(filterCharacter.value))&&(!filterFaction.value||[...ids].some(id=>byId(id)?.faction===filterFaction.value))&&(!fromDate.value||dateRows.some(row=>row.created_at.slice(0,10)>=fromDate.value))&&(!toDate.value||dateRows.some(row=>row.created_at.slice(0,10)<=toDate.value));
}
const filteredRoots=computed(()=>messages.value.filter(message=>!message.scene_id&&!message.parent_id&&(!message.deleted_at||threadMessages(message.id).some(row=>!row.deleted_at))&&matches(message,threadMessages(message.id))).sort((a,b)=>(sort.value==='created'?b.created_at:activity(b)).localeCompare(sort.value==='created'?a.created_at:activity(a))));
const rootPages=computed(()=>Math.max(1,Math.ceil(filteredRoots.value.length/20))),pagedRoots=computed(()=>filteredRoots.value.slice((page.value-1)*20,page.value*20));
const myRoots=computed(()=>filteredRoots.value.filter(root=>threadMessages(root.id).some(message=>message.owner_id===props.me.id)));
const filteredScenes=computed(()=>scenes.value.filter(scene=>{
 const rows=messages.value.filter(message=>message.scene_id===scene.id);
 const included=tab.value==='active'?['active','paused'].includes(scene.status):tab.value==='archive'?['ended','archived'].includes(scene.status):scene.owner_id===props.me.id||scene.member_ids.includes(props.me.id)||scene.participant_ids.some(id=>byId(id)?.owner_id===props.me.id)||rows.some(message=>message.owner_id===props.me.id);
 return included&&matches(scene,rows);
}).sort((a,b)=>(sort.value==='created'?b.created_at:activity(b)).localeCompare(sort.value==='created'?a.created_at:activity(a))));
const sidebarEntries=computed(()=>{
 const sceneRows=detail.value||tab.value==='timeline'?scenes.value.filter(scene=>matches(scene,messages.value.filter(row=>row.scene_id===scene.id))):filteredScenes.value;
 const roots=tab.value==='mine'?myRoots.value:filteredRoots.value;
 const entries=sceneRows.map(scene=>({path:'/roleplay/scene/'+scene.id,title:scene.title,subtitle:[scene.location,statuses[scene.status]].filter(Boolean).join(' · '),people:scene.participant_ids.map(id=>byId(id)?.name).filter(Boolean).join(' · '),at:activity(scene)}));
 if(detail.value||['timeline','mine'].includes(tab.value))entries.push(...roots.map(root=>({path:'/roleplay/thread/'+root.id,title:root.deleted_at?'삭제된 원글의 대화':roleplayPlainText(root.body,props.characters,50)||'이미지 역극',subtitle:'자유 역극',people:[...new Set(threadMessages(root.id).map(row=>byId(row.character_id)?.name||row.author_name))].filter(Boolean).join(' · '),at:activity(root)})));
 return entries.sort((a,b)=>b.at.localeCompare(a.at));
});
const visibleImagePaths=computed(()=>detail.value?[currentScene.value?.image_path,...pagedMessages.value.flatMap(row=>row.attachments)]:tab.value==='timeline'?pagedRoots.value.flatMap(row=>row.attachments):filteredScenes.value.map(scene=>scene.image_path));
watch(visibleImagePaths,paths=>ensureImages(paths),{immediate:true});
function unread(scene){const read=reads.value.find(read=>read.scope==='scene:'+scene.id);return messages.value.some(message=>message.scene_id===scene.id&&message.owner_id!==props.me.id&&!message.deleted_at&&(!read||message.created_at>read.updated_at));}
function navigate(key){tab.value=key;page.value=1;listOpen.value=false;router.push('/roleplay');}
function cancelEditor(){reply.value=null;editing.value=null;}
async function focusComposer(){await nextTick();composer.value?.focus();}
function setReply(message){editing.value=null;reply.value=message;focusComposer();}
function setEdit(message){reply.value=null;editing.value=message;focusComposer();}
function openThread(message,edit=false){pendingEdit=edit?message:null;router.push('/roleplay/thread/'+message.thread_id);}
async function afterSave(){cancelEditor();await sync();if(detail.value){page.value=messagePages.value;await nextTick();const element=transcriptElement.value;if(element)element.scrollTop=element.scrollHeight;}else notice.value='역극을 저장했습니다.';}
async function act(fn){if(busy.value)return;busy.value=true;actionError.value='';try{await fn();await sync();}catch(e){actionError.value=e.message;}finally{busy.value=false;}}
function newScene(){listOpen.value=false;sceneDraft.value={title:'',description:'',location:'',visibility:'members',join_policy:'open',status:'active',participant_ids:mine.value[0]?[mine.value[0].id]:[],admin_ids:[],image_path:null};coverFile.value=null;removeCover.value=false;nextTick(()=>transcriptElement.value?.scrollTo({top:0}));}
function editScene(){sceneDraft.value={...currentScene.value,participant_ids:[...currentScene.value.participant_ids],admin_ids:[...currentScene.value.admin_ids]};coverFile.value=null;removeCover.value=false;}
async function saveScene(){await act(async()=>{
 let saved=await request('/roleplay/scenes',{method:'POST',body:JSON.stringify({...sceneDraft.value,...(removeCover.value?{image_path:null}:{})})});
 sceneDraft.value={...saved};
 if(coverFile.value){const path=await uploadRoleplay(coverFile.value,saved.id);saved=await request('/roleplay/scenes',{method:'POST',body:JSON.stringify({...saved,image_path:path})});coverFile.value=null;}
 sceneDraft.value=null;await router.push('/roleplay/scene/'+saved.id);
});}
async function join(){await act(()=>request('/roleplay/scenes/'+currentScene.value.id+'/join',{method:'POST',body:JSON.stringify({id:currentScene.value.id,revision:currentScene.value.revision,character_id:joinCharacter.value||null})}));}
async function invite(){if(!inviteCharacter.value)return;await act(()=>request('/roleplay/scenes/'+currentScene.value.id+'/invite',{method:'POST',body:JSON.stringify({id:currentScene.value.id,revision:currentScene.value.revision,participant_ids:[inviteCharacter.value]})}));inviteCharacter.value='';}
function askDelete(type,row){deleteTarget.value={type,row};}
async function performDelete(){await act(async()=>{const {type,row}=deleteTarget.value;await request('/roleplay/'+type+'/'+row.id,{method:'DELETE',headers:{'X-Revision':String(row.revision)}});deleteTarget.value=null;cancelEditor();if(type==='scenes')await router.push('/roleplay');});}
async function savePreference(){await act(()=>request('/roleplay/preferences',{method:'POST',body:JSON.stringify({mode:preference.value})}));}
async function markRead(){const last=allCurrentMessages.value.at(-1);if(last)await act(()=>request('/roleplay/read',{method:'POST',body:JSON.stringify({message_id:last.id})}));}
function exportUrl(format){return '/api/roleplay/export?'+(currentScene.value?'scene='+currentScene.value.id:'thread='+currentThread.value.id)+'&format='+format+(hideOoc.value?'&ooc=hide':'');}
async function showParent(message){if(hideOoc.value&&!message.character_id){hideOoc.value=false;await nextTick();}const index=visibleMessages.value.findIndex(row=>row.id===message.id);if(index>=0)page.value=Math.floor(index/50)+1;await nextTick();document.getElementById('rp-message-'+message.id)?.scrollIntoView({block:'center'});}
watch(()=>route.path,async()=>{page.value=1;reply.value=null;editing.value=pendingEdit;pendingEdit=null;notice.value='';listOpen.value=false;await nextTick();measureViewport();if(transcriptElement.value)transcriptElement.value.scrollTop=0;});
watch(tab,async()=>{await nextTick();measureViewport();});
watch([query,filterCharacter,filterFaction,fromDate,toDate,sort,hideOoc],()=>{page.value=1;});
watch(()=>props.version,async()=>{const before=new Set(messages.value.map(message=>message.id));await sync();const count=messages.value.filter(message=>!before.has(message.id)&&message.owner_id!==props.me.id).length;if(count)notice.value='새 메시지 '+count+'개가 도착했습니다. 읽던 위치는 그대로 유지됩니다.';});
watch([messagePages,rootPages],()=>{page.value=Math.min(page.value,detail.value?messagePages.value:rootPages.value);});
let fallback,mounted=true;
function measureViewport(){if(!pageElement.value)return;const viewport=window.visualViewport;viewportHeight.value=Math.max(120,(viewport?.height||window.innerHeight)+(viewport?.offsetTop||0)-pageElement.value.getBoundingClientRect().top-12);}
onMounted(async()=>{measureViewport();window.addEventListener('resize',measureViewport);window.visualViewport?.addEventListener('resize',measureViewport);await sync();if(!mounted)return;try{preference.value=(await request('/roleplay/preferences')).mode;}catch{}if(!mounted)return;fallback=setInterval(()=>{if(document.visibilityState!=='hidden'&&props.liveStatus!=='live')sync();},15000);});
onBeforeUnmount(()=>{mounted=false;clearInterval(fallback);window.removeEventListener('resize',measureViewport);window.visualViewport?.removeEventListener('resize',measureViewport);});
</script>
