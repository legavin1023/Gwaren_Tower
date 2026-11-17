<template>
  <section class="character-mini-gallery" aria-label="전신·외관 미니 갤러리">
    <div class="character-mini-gallery-head">
      <h4>전신·외관</h4>
    </div>
    <input v-if="editable" ref="input" type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif" @change="select" />
    <ul v-if="items.length || editable" class="character-mini-gallery-images">
      <li v-for="item in items" :key="item.id">
        <a :href="item.image" target="_blank" rel="noopener" :aria-label="(item.caption || '전신·외관 사진') + ' 원본 보기'">
          <img v-if="item.image" :src="item.image" :alt="item.caption || '전신·외관 사진'" loading="lazy" />
          <span v-else>이미지</span>
        </a>
        <button v-if="editable" type="button" class="character-mini-gallery-remove" aria-label="갤러리 이미지 삭제" @click="$emit('remove', item)">×</button>
      </li>
      <li v-if="editable">
        <button type="button" class="character-mini-gallery-add" aria-label="전신·외관 이미지 첨부" @click="input.click()">
          <span aria-hidden="true">＋</span>
          <span>사진 추가</span>
        </button>
      </li>
    </ul>
    <p v-if="!items.length" class="muted">전신·외관 사진을 따로 보관하세요.</p>
    <small v-if="editable" class="muted">프로필 저장 시 반영됩니다.</small>
  </section>
</template>
<script setup>
import { ref } from 'vue';
defineProps({ items: { type: Array, default: () => [] }, editable: Boolean });
const emit = defineEmits(['select', 'remove']);
const input = ref(null);
function select(event) {
  emit('select', Array.from(event.target.files || []));
  event.target.value = '';
}
</script>
