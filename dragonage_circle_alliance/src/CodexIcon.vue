<template><svg class="codex-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path :d="paths[name] || paths.book" /></svg></template>
<script setup>
defineProps({name:String});
const paths={
  chat: 'M4 4h16v12H9l-5 4V4Zm4 5h8m-8 3h5',tower:'M5 21V8l7-6 7 6v13M3 21h18M9 21v-6a3 3 0 0 1 6 0v6M9 8h6M12 5v5',people:'M4 21V9l8-6 8 6v12M8 21v-7a4 4 0 0 1 8 0v7M12 6v3',relation:'M4 4h5v5H4zM15 4h5v5h-5zM9 15h6v6H9zM6.5 9v3H12v3m5.5-6v3H12',affection:'M12 21 3 11V6l4-3 5 4 5-4 4 3v5l-9 10Z',quill:'m6 18 2-8L19 2l3 3-8 11-8 2Zm0 0-4 4m6-7 3 2M2 22h12',book:'M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15M6 8l3 1m6 0 3-1M6 12l3 1m6 0 3-1',image:'M3 3h18v18H3zM3 17l6-6 5 5 3-3 4 5M14 7h2v2h-2z',edict:'M6 2h12v14l-6 6-6-6V2Zm3 4h6m-6 4h6m-6 4h6m-3 2v6',profile:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-3a8 8 0 0 1 16 0v3H4Z',seal:'m12 2 3 4 5 1-1 6 2 4-5 2-4 3-4-3-5-2 2-4-1-6 5-1 3-4Zm0 6v7m0 2h.01',bell:'M5 16V9a7 7 0 0 1 14 0v7l2 2H3l2-2Zm4 5h6M12 2V1',index:'M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1',arrow:'M3 12h18m-6-6 6 6-6 6'};
</script>
