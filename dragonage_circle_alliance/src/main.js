import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import Shell from './Shell.vue';
import './legacy.css';
import './circle.css';
import './tower.css';
const router = createRouter({history:createWebHashHistory(),routes:[{path:'/:pathMatch(.*)*',component:Shell}],scrollBehavior:()=>({top:0})});
createApp(App).use(router).mount('#app');
