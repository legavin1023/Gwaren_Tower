<template>
  <section
    class="codex-hero"
    :class="{ 'codex-hero--gate': gate }"
    aria-label="그웨런 마탑 기록 보관소"
  >
    <img
      v-if="artwork"
      class="codex-hero-art"
      :src="artwork"
      alt=""
      fetchpriority="high"
    />
    <div v-if="artwork" class="codex-hero-shade"></div>
    <div class="codex-hero-copy">
      <div class="codex-rule" aria-hidden="true"><span></span></div>
      <!-- <p class="codex-kicker">THE CIRCLE OF MAGI · PRIVATE ARCHIVE</p> -->
      <component :is="gate ? 'h1' : 'h2'">Gwaren </br> Tower</component>
      <p class="codex-hero-subtitle">그웨런 마탑 기록 보관소</p>
      <div class="codex-rule" aria-hidden="true"><span></span></div>
      <!-- <p class="codex-hero-description">
        돌벽 안에 봉인된 이름과 이야기.<br />허가된 이에게만 열리는 마탑의 기록.
      </p> -->
      <div v-if="!gate" class="codex-hero-links">
        <router-link to="/characters" class="primary-button"
          >인명 기록부 <CodexIcon name="arrow" /></router-link
        ><router-link to="/board/notice" class="outline-button"
          >마탑의 공지</router-link
        >
      </div>
      <!-- <p class="codex-hero-folio">KNOWLEDGE · VIGILANCE · SILENCE</p> -->
    </div>
    <span class="codex-hero-number" aria-hidden="true">I / THE ARCHIVE</span>
  </section>
</template>
<script setup>
import CodexIcon from "./CodexIcon.vue";
defineProps({ gate: Boolean, artwork: { type: String, default: "" } });
</script>
