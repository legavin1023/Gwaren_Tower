<template>
  <section
    ref="root"
    class="chat-room card"
    :class="{ 'chat-room--compact': height < 320 }"
    :style="{ '--chat-height': height + 'px' }"
    aria-label="모두의 잡담방"
  >
    <header class="chat-heading">
      <div>
        <h2>잡담</h2>
        <p class="muted">모든 회원이 함께 사용하는 대화방</p>
      </div>
      <div class="chat-connection">
        <span role="status">{{ statusLabel }}</span
        ><button
          v-if="status !== 'live'"
          class="outline-button"
          type="button"
          @click="connection?.reconnect()"
        >
          다시 연결
        </button>
      </div>
    </header>
    <details class="chat-online" :open="height >= 360">
      <summary>
        채팅방 접속 <strong>{{ online.length }}명</strong>
      </summary>
      <ul>
        <li v-for="person in online" :key="person.id">
          <Portrait
            v-if="representative(person.id)"
            :character="representative(person.id)"
          /><span v-else class="chat-avatar-fallback" aria-hidden="true">{{
            person.nickname?.slice(0, 1)
          }}</span
          ><span>{{ person.nickname }}</span>
        </li>
        <li v-if="!online.length" class="muted">연결을 확인하고 있습니다.</li>
      </ul>
    </details>
    <p v-if="error" class="error chat-error" role="alert">{{ error }}</p>
    <div class="chat-conversation">
      <div
        ref="list"
        class="chat-messages"
        role="log"
        aria-label="잡담 메시지"
        :aria-busy="loadingOlder"
        @scroll="scrolled"
      >
        <button
          v-if="hasMore"
          class="text-button chat-older"
          type="button"
          :disabled="loadingOlder"
          @click="loadOlder"
        >
          {{ loadingOlder ? "이전 대화 불러오는 중…" : "이전 대화 더 보기" }}
        </button>
        <p v-if="loading" class="muted chat-empty">
          최근 대화를 불러오고 있습니다.
        </p>
        <p v-else-if="!messages.length" class="muted chat-empty">
          첫 이야기를 남겨보세요.
        </p>
        <article
          v-for="message in messages"
          :key="message.id"
          :data-chat-id="message.id"
          class="chat-message"
          :class="{ 'chat-message--mine': message.member_id === me.id }"
        >
          <router-link
            v-if="representative(message.member_id)"
            :to="'/characters/' + representative(message.member_id).id"
            class="chat-avatar"
            :aria-label="memberName(message) + '의 대표 캐릭터'"
            ><Portrait :character="representative(message.member_id)"
          /></router-link>
          <span v-else class="chat-avatar-fallback" aria-hidden="true">{{
            memberName(message).slice(0, 1)
          }}</span>
          <div class="chat-message-content">
            <header>
              <strong>{{ memberName(message) }}</strong
              ><time
                :datetime="message.created_at"
                :title="date(message.created_at)"
                >{{ date(message.created_at) }}</time
              >
            </header>
            <p>{{ message.body }}</p>
          </div>
        </article>
      </div>
      <button
        v-if="newCount"
        class="secondary-button chat-new-messages"
        type="button"
        @click="jumpLatest"
      >
        새 메시지 {{ newCount }}개 ↓
      </button>
    </div>
    <div class="chat-typing" role="status">{{ typingText }}</div>
    <form class="chat-composer" @submit.prevent="send">
      <!-- <label class="sr-only" for="shared-chat-body">잡담 메시지</label> -->
      <textarea
        id="shared-chat-body"
        ref="input"
        v-model="draft"
        class="form-textarea"
        rows="2"
        maxlength="2000"
        placeholder="이야기를 남겨주세요…"
        :readonly="sending"
        :disabled="status === 'unauthorized'"
        @input="edited"
        @keydown="keydown"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      />
      <button
        class="primary-button"
        :disabled="
          sending ||
          !draft.trim() ||
          draft.length > 2000 ||
          status === 'unauthorized'
        "
      >
        {{ sending ? "전송 중…" : failed ? "다시 전송" : "전송" }}
      </button>
      <div class="chat-composer-help">
        <span>Enter 전송 · Shift+Enter 줄바꿈</span
        ><span>{{ draft.length }} / 2000</span>
      </div>
    </form>
  </section>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { request } from "./api";
import {
  createChatConnection,
  mergeChatMessages,
  chatEnterSends,
} from "./chat-client.mjs";
import Portrait from "./Portrait.vue";
const props = defineProps({ me: Object, members: Array, characters: Array });
const root = ref(null),
  list = ref(null),
  input = ref(null),
  height = ref(600),
  messages = ref([]),
  online = ref([]),
  typers = ref([]),
  status = ref("connecting"),
  draft = ref(""),
  loading = ref(true),
  loadingOlder = ref(false),
  hasMore = ref(false),
  sending = ref(false),
  failed = ref(false),
  error = ref(""),
  newCount = ref(0);
let connection = null,
  pinned = true,
  composing = false,
  disposed = false,
  pendingId = "",
  pendingBody = "";
const statusLabel = computed(
  () =>
    ({
      connecting: "연결 중…",
      live: "실시간 연결됨",
      reconnecting: "다시 연결 중…",
      offline: "오프라인 · 재연결 대기",
      unavailable: "실시간 연결을 지원하지 않는 환경",
      unauthorized: "로그인이 만료되었습니다",
    }[status.value] || ""),
);
const typingText = computed(() => {
  const names = online.value
    .filter(
      (person) => person.id !== props.me.id && typers.value.includes(person.id),
    )
    .map((person) => person.nickname);
  return names.length
    ? names.slice(0, 3).join(", ") +
        (names.length > 3 ? " 외 " + (names.length - 3) + "명" : "") +
        "님이 입력 중…"
    : "";
});
function representative(id) {
  const member = props.members.find((member) => member.id === id);
  return (
    props.characters.find(
      (character) =>
        character.id === member?.representative_character_id &&
        character.owner_id === id,
    ) || null
  );
}
function memberName(message) {
  return (
    props.members.find((member) => member.id === message.member_id)?.nickname ||
    message.nickname ||
    "회원"
  );
}
function date(value) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function nearBottom() {
  return (
    !list.value ||
    list.value.scrollHeight - list.value.clientHeight - list.value.scrollTop <
      64
  );
}
function jumpLatest() {
  if (list.value) list.value.scrollTop = list.value.scrollHeight;
  pinned = true;
  newCount.value = 0;
}
async function receive(rows, meta = {}) {
  if (disposed) return;
  const old = new Set(messages.value.map((message) => message.id)),
    added = rows.filter((row) => !old.has(row.id)),
    shouldPin = meta.kind === "initial" || pinned;
  messages.value = mergeChatMessages(messages.value, rows);
  if (meta.kind === "initial") {
    loading.value = false;
    hasMore.value = meta.hasMore;
  }
  if (!shouldPin && ["live", "recover"].includes(meta.kind))
    newCount.value += added.filter(
      (row) => row.member_id !== props.me.id,
    ).length;
  await nextTick();
  if (disposed) return;
  if (shouldPin) jumpLatest();
}
async function loadOlder() {
  if (
    !connection ||
    !hasMore.value ||
    loadingOlder.value ||
    !messages.value.length
  )
    return;
  loadingOlder.value = true;
  error.value = "";
  const box = list.value,
    top = box.getBoundingClientRect().top,
    anchor = [...box.querySelectorAll("[data-chat-id]")].find(
      (el) => el.getBoundingClientRect().bottom > top,
    ),
    id = anchor?.dataset.chatId,
    offset = anchor?.getBoundingClientRect().top;
  try {
    const data = await connection.older(messages.value[0].id);
    if (disposed) return;
    messages.value = mergeChatMessages(messages.value, data.messages);
    hasMore.value = data.has_more;
    await nextTick();
    const found = id && box.querySelector('[data-chat-id="' + id + '"]');
    if (found) box.scrollTop += found.getBoundingClientRect().top - offset;
  } catch (e) {
    if (!disposed) error.value = e.message;
  } finally {
    loadingOlder.value = false;
  }
}
function scrolled() {
  pinned = nearBottom();
  if (pinned) newCount.value = 0;
  if (list.value.scrollTop < 40) loadOlder();
}
function edited() {
  failed.value = false;
  if (draft.value !== pendingBody) pendingId = "";
  connection?.typing(!!draft.value.trim());
}
function keydown(event) {
  if (chatEnterSends(event, composing)) {
    event.preventDefault();
    send();
  }
}
async function send() {
  if (
    sending.value ||
    composing ||
    !draft.value.trim() ||
    draft.value.length > 2000
  )
    return;
  const body = draft.value.trim();
  if (!pendingId || pendingBody !== body) {
    pendingId = crypto.randomUUID();
    pendingBody = body;
  }
  sending.value = true;
  error.value = "";
  failed.value = false;
  connection?.typing(false);
  try {
    const saved = await request("/chat/messages", {
      method: "POST",
      body: JSON.stringify({ body, client_message_id: pendingId }),
    });
    if (disposed) return;
    await receive([saved], { kind: "send" });
    draft.value = "";
    pendingId = "";
    pendingBody = "";
    await nextTick();
    jumpLatest();
    input.value?.focus();
  } catch (e) {
    if (!disposed) {
      error.value = e.message;
      failed.value = true;
    }
  } finally {
    sending.value = false;
  }
}
function measure() {
  if (!root.value) return;
  const viewport = window.visualViewport;
  height.value = Math.max(
    180,
    (viewport?.height || window.innerHeight) +
      (viewport?.offsetTop || 0) -
      root.value.getBoundingClientRect().top -
      12,
  );
  if (pinned) nextTick(jumpLatest);
}
onMounted(() => {
  measure();
  window.addEventListener("resize", measure);
  window.visualViewport?.addEventListener("resize", measure);
  window.visualViewport?.addEventListener("scroll", measure);
  connection = createChatConnection({
    request,
    onMessages: receive,
    onStatus: (value) => {
      status.value = value;
    },
    onPresence: (data) => {
      online.value = data.members;
      typers.value = data.typing;
    },
    onError: (message) => {
      error.value = message;
      loading.value = false;
    },
    onUnauthorized: () => {
      error.value = "로그인이 만료되었습니다. 다시 로그인해 주세요.";
    },
  });
});
onBeforeUnmount(() => {
  disposed = true;
  connection?.stop();
  window.removeEventListener("resize", measure);
  window.visualViewport?.removeEventListener("resize", measure);
  window.visualViewport?.removeEventListener("scroll", measure);
});
</script>
