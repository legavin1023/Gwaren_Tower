<template>
  <section class="character-theme-picker" aria-label="캐릭터 테마색 설정">
    <h4>테마색</h4>
    <div class="character-theme-inputs">
      <label
        ><input
          type="color"
          :value="validColor || '#647d87'"
          aria-label="캐릭터 테마색 선택"
          @input="update($event.target.value)"
      /></label>
      <label
        ><input
          class="form-input"
          type="text"
          :value="modelValue || ''"
          maxlength="7"
          pattern="#[0-9a-fA-F]{6}"
          placeholder="#647d87"
          aria-label="캐릭터 테마색 코드"
          @input="update($event.target.value.trim())"
      /></label>
    </div>
    <p
      class="character-theme-preview character-themed character-name"
      :style="characterTheme(sample)"
    >
      @{{ name || "캐릭터 이름" }}
    </p>
  </section>
</template>
<script setup>
import { computed } from "vue";
import { themeColor, characterTheme } from "./character-theme.mjs";
const props = defineProps({ modelValue: String, name: String });
const emit = defineEmits(["update:modelValue"]);
const sample = computed(() => ({ extra: { theme_color: props.modelValue } }));
const validColor = computed(() => themeColor(sample.value));
function update(value) {
  emit("update:modelValue", value);
}
</script>
