<template>
 <section class="character-theme-picker" aria-label="캐릭터 테마색 설정">
  <h4>캐릭터 테마색</h4>
  <div class="character-theme-inputs">
   <label>색상 선택<input type="color" :value="validColor || '#647d87'" aria-label="캐릭터 테마색 선택" @input="update($event.target.value)" /></label>
   <label>색상 코드<input class="form-input" type="text" :value="modelValue || ''" maxlength="7" pattern="#[0-9a-fA-F]{6}" placeholder="#647d87" aria-label="캐릭터 테마색 코드" @input="update($event.target.value.trim())" /></label>
   <button type="button" class="secondary-button" @click="update('')">기본색으로 초기화</button>
  </div>
  <div class="character-color-presets" role="group" aria-label="추천 테마색">
   <button v-for="preset in presets" :key="preset.color" type="button" :style="{'--swatch':preset.color}" :aria-label="preset.name+' 테마색'" :aria-pressed="validColor===preset.color" @click="update(preset.color)"></button>
  </div>
  <p class="character-theme-preview character-themed character-name" :style="characterTheme(sample)">@{{ name || '캐릭터 이름' }} <small>태그·멘션 미리보기</small></p>
  <p class="muted">태그와 이름, 프로필·프사 테두리, 관계도에 적용됩니다. 글자색은 화면 밝기에 맞춰 조정됩니다.</p>
 </section>
</template>
<script setup>
import {computed} from 'vue';
import {themeColor,characterTheme} from './character-theme.mjs';
const props=defineProps({modelValue:String,name:String});const emit=defineEmits(['update:modelValue']);
const sample=computed(()=>({extra:{theme_color:props.modelValue}}));const validColor=computed(()=>themeColor(sample.value));
const presets=[{name:'벽돌',color:'#a85353'},{name:'호박',color:'#b47939'},{name:'숲',color:'#54785b'},{name:'청록',color:'#397e81'},{name:'강철',color:'#647d87'},{name:'남빛',color:'#596aa0'},{name:'자수정',color:'#8a609b'},{name:'장미',color:'#aa6384'}];
function update(value){emit('update:modelValue',value);}
</script>
