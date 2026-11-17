<template>
  <section class="recruitment-editor">
    <h4>자관 모집</h4>
    <label
      >모집 상태<select
        class="form-input"
        :value="modelValue.recruitment_status || ''"
        @change="update('recruitment_status', $event.target.value)"
        aria-label="자관 모집 상태"
      >
        <option value="">표시 안 함</option>
        <option
          v-for="option in recruitmentOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select></label
    ><label
      >모집하는 관계 / 안내<textarea
        class="form-textarea"
        :value="modelValue.recruitment_note || ''"
        @input="update('recruitment_note', $event.target.value)"
        maxlength="500"
        rows="3"
        :required="modelValue.recruitment_status === 'specific'"
        placeholder="예: 함께 금서를 연구할 동료, 오래된 라이벌"
        aria-label="자관 모집 안내"
      ></textarea>
    </label>
  </section>
</template>
<script setup>
import { recruitmentOptions } from "./recruitment.mjs";
const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits(["update:modelValue"]);
function update(key, value) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}
</script>
