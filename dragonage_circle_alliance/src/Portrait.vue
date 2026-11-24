<template>
  <span
    class="portrait"
    :class="[character?.faction, { 'character-themed': themeColor(character) }]"
    :style="[characterTheme(character), !character?.image || failed ? { background: portraitColor(character) } : {}]"
    ><img
      v-if="character?.image && !failed"
      :src="character.image"
      :alt="character.name"
      @error="failed = true"
    /><span v-else class="portrait-color-placeholder" role="img" :aria-label="(character?.name || '캐릭터') + '의 초상화 없음'"></span></span
  >
</template>
<script setup>
import { ref, watch } from "vue";
import { characterTheme, themeColor, portraitColor } from "./character-theme.mjs";
const props = defineProps({ character: Object });
const failed = ref(false);
watch(
  () => props.character?.image,
  () => (failed.value = false),
);
</script>
