<template>
  <div class="rp-body">
    <template v-for="(line,index) in text.split('\n')" :key="index">
      <hr v-if="line.trim() === '---'" />
      <component :is="line.startsWith('> ') ? 'blockquote' : 'p'" v-else>
        <template v-for="(part,i) in inlineRoleplay(line.startsWith('> ') ? line.slice(2) : line)" :key="i">
          <strong v-if="part.kind === 'strong'">{{ part.text }}</strong>
          <em v-else-if="part.kind === 'em'">{{ part.text }}</em>
          <MentionText v-else :text="part.text" :characters="characters" />
        </template>
        <br v-if="!line" />
      </component>
    </template>
  </div>
</template>
<script setup>
import {inlineRoleplay} from './roleplay-domain.mjs';
import MentionText from './MentionText.vue';
defineProps({text:{type:String,default:''},characters:{type:Array,default:()=>[]}});
</script>
