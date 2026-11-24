<template>
  <section class="character-portrait-editor" aria-label="프로필 이미지 설정">
    <div class="character-portrait-settings">
    <div class="character-portrait-main">
    <h4>프로필 이미지</h4>
      <button
        type="button"
        class="character-portrait-preview"
        aria-label="프로필 이미지 첨부"
        title="이미지를 눌러 첨부·변경"
        @click="fileInput.click()"
      >
        <img
          v-if="preview || images[imagePath]"
          :src="preview || images[imagePath]"
          alt="선택한 프로필 이미지"
        />
        <span v-else class="character-portrait-color" role="img" :aria-label="(name || '캐릭터')+'의 초상화 없음'" :style="{background:color}"></span>
      </button>
      <section class="character-saved-portraits" aria-label="저장한 이미지">
        <div class="character-portrait-history-head">
          <span class="muted" aria-live="polite">이전 이미지 {{ modelValue.length ? cursor + 1 : 0 }}/{{ modelValue.length }}</span>
          <div class="character-portrait-history-controls">
            <button type="button" class="outline-button" aria-label="이전 이미지" :disabled="modelValue.length < 2" @click="move(-1)">‹</button>
            <button type="button" class="outline-button" aria-label="다음 이미지" :disabled="modelValue.length < 2" @click="move(1)">›</button>
          </div>
        </div>
        <p v-if="!modelValue.length" class="muted character-portrait-empty">저장한 이미지가 없습니다.</p>
        <ul class="character-portrait-history">
          <li v-for="(image, index) in modelValue" v-show="index === cursor" :key="image.path">
            <button
              type="button"
              class="character-portrait-choice"
              :aria-pressed="!file && imagePath === image.path"
              aria-label="이 이미지를 프로필에 사용"
              :title="(image.created_at ? new Date(image.created_at).toLocaleDateString('ko-KR') : '기존 이미지') + (!file && imagePath === image.path ? ' · 현재 이미지' : '')"
              @click="choose(image.path)"
            >
              <img
                v-if="images[image.path]"
                :src="images[image.path]"
                alt="저장한 프로필 이미지"
              />
              <span v-else class="character-portrait-history-fallback" :style="{background:color}" aria-hidden="true"></span>
              <span>선택</span>
            </button>
            <button
              type="button"
              class="character-portrait-remove"
              aria-label="저장한 이미지 삭제"
              @click="removeImage(image.path)"
            >
              삭제
            </button>
          </li>
        </ul>
      </section>
    </div>
    <slot name="gallery" />
    <div class="character-portrait-theme"><slot /></div>
    </div>
    <input
      ref="fileInput"
      type="file"
      hidden
      accept="image/png,image/jpeg,image/webp,image/gif"
      @change="selectFile"
    />
    <p v-if="file" class="muted">
      {{ file.name }} · 저장하면 이미지 목록에 추가됩니다.
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from "vue";
import { imageBlob } from "./api";
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  imagePath: String,
  name: String,
  color: {type:String,default:'#647d87'},
  file: Object,
});
const emit = defineEmits(["update:modelValue", "update:imagePath", "select"]);
const fileInput = ref(null);
const cursor = ref(0);
watch(() => props.modelValue.length, length => {
  cursor.value = Math.min(cursor.value, Math.max(0, length - 1));
});
function move(direction) {
  const length = props.modelValue.length;
  if (length) cursor.value = (cursor.value + direction + length) % length;
}
const images = ref({}),
  preview = ref(""),
  error = ref("");
let generation = 0;
watch(
  () => props.file,
  (file) => {
    if (preview.value) URL.revokeObjectURL(preview.value);
    preview.value = file ? URL.createObjectURL(file) : "";
  },
  { immediate: true },
);
watch(
  () =>
    [...props.modelValue.map((image) => image.path), props.imagePath].filter(
      Boolean,
    ),
  async (paths) => {
    const current = ++generation;
    error.value = "";
    await Promise.all(
      [...new Set(paths)]
        .filter((path) => !images.value[path])
        .map(async (path) => {
          try {
            const url = await imageBlob(path);
            if (generation !== current) URL.revokeObjectURL(url);
            else images.value[path] = url;
          } catch {
            if (generation === current)
              error.value = "일부 이미지를 불러오지 못했습니다.";
          }
        }),
    );
  },
  { immediate: true },
);
function selectFile(event) {
  const selected = event.target.files?.[0];
  if (selected) emit("select", selected);
  event.target.value = "";
}
function choose(path) {
  emit("select", null);
  emit("update:imagePath", path);
}
function removeImage(path) {
  emit(
    "update:modelValue",
    props.modelValue.filter((image) => image.path !== path),
  );
  if (props.imagePath === path) emit("update:imagePath", null);
}
onBeforeUnmount(() => {
  generation++;
  if (preview.value) URL.revokeObjectURL(preview.value);
  Object.values(images.value).forEach((url) => URL.revokeObjectURL(url));
});
</script>
