<template>
  <span
    class="portrait"
    :class="[character?.faction, { 'character-themed': themeColor(character) }]"
    :style="characterTheme(character)"
    ><img
      v-if="character?.image && !failed"
      :src="character.image"
      :alt="character.name"
      @error="failed = true"
    /><span v-else>{{ character?.name?.[0] || "?" }}</span></span
  >
</template>
<script setup>
import { ref, watch } from "vue";
import { characterTheme, themeColor } from "./character-theme.mjs";
const props = defineProps({ character: Object });
const failed = ref(false);
watch(
  () => props.character?.image,
  () => (failed.value = false),
);
</script>
