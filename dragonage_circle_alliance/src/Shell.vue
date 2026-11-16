<template>
  <div v-if="!me" class="login-wrap">
    <section class="card login-card">
      <span class="eyebrow">DRAGON AGE · PRIVATE CIRCLE</span>
      <h1>Gwaren Tower</h1>
      <p>마법사와 템플러, 그 사이의 이야기.</p>
      <p class="muted">
        활동 의무 없이, 서로의 캐릭터와 이야기를 나누는 작은 공간입니다. 등록된
        Google 계정으로 들어오세요.
      </p>
      <a href="/api/auth/login" class="primary-button login-link"
        >Google 계정으로 입장</a
      >
      <p v-if="loading">로그인 확인 중…</p>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="authError" role="alert" class="error">
        로그인을 완료하지 못했습니다. 등록된 이메일인지 확인하세요.
      </p>
    </section>
  </div>
  <div v-else class="app-shell" :class="{ 'dark-mode': dark }">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">DA</span
        ><span><b>Gwaren Tower</b><small>자캐 동맹</small></span>
      </div>
      <nav class="side-nav" aria-label="주요 메뉴">
        <router-link
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          >{{ item.icon }}　{{ item.label }}</router-link
        ><router-link v-if="admin" to="/admin" class="nav-item"
          >⚙　운영 관리</router-link
        >
      </nav>
      <div class="sidebar-bottom">
        <p>{{ me.nickname || me.email }}</p>
        <button class="outline-button" @click="dark = !dark">
          {{ dark ? "밝게 보기" : "어둡게 보기" }}</button
        ><button class="outline-button" @click="act(logout)">로그아웃</button>
      </div>
    </aside>
    <div class="content-shell">
      <header class="topbar">
        <div>
          <span class="breadcrumb">DRAGON AGE / Gwaren Tower</span>
          <h1 class="topbar-title">{{ pageTitle }}</h1>
        </div>
        <div class="toolbar">
          <span class="badge">{{ admin ? "운영자" : "회원" }}</span
          ><button
            class="secondary-button"
            :disabled="busy"
            @click="act(refresh)"
          >
            새로고침
          </button>
        </div>
      </header>
      <main class="main-content">
        <p v-if="error" class="error alert" role="alert">
          {{ error }}
          <button @click="error = ''" aria-label="오류 닫기">×</button>
        </p>
        <p v-if="message" class="success alert" role="status">{{ message }}</p>
        <p v-if="loading">기록을 불러오는 중…</p>
        <template v-if="route.path === '/' || route.path === '/home'"
          ><section class="card welcome">
            <span class="eyebrow">THE CIRCLE · OUR STORIES</span>
            <h2>인연을 기록하는 곳</h2>
            <p>마탑의 창 너머, 아직 쓰이지 않은 이야기들.</p>
            <p class="muted">
              캐릭터를 만나고, 느슨하게 이어지는 이야기를 남겨주세요.<br />언제든
              합류하고, 각자의 속도로 머물러도 좋습니다.
            </p>
            <router-link to="/characters" class="outline-button"
              >캐릭터 둘러보기 ↗</router-link
            >
          </section>
          <div class="summary-grid">
            <router-link to="/characters" class="card"
              ><span class="eyebrow">CHARACTERS</span>
              <h2>{{ characters.length }}</h2>
              <span>마탑의 사람들</span></router-link
            ><router-link to="/relationships" class="card"
              ><span class="eyebrow">CONNECTIONS</span>
              <h2>{{ approved.length }}</h2>
              <span>이어진 인연</span></router-link
            ><router-link to="/board/story" class="card"
              ><span class="eyebrow">STORIES</span>
              <h2>{{ posts.filter((p) => p.category === "story").length }}</h2>
              <span>함께 쓴 이야기</span></router-link
            >
          </div>
          <h3>최근 공지</h3>
          <router-link
            v-for="post in posts
              .filter((p) => p.category === 'notice')
              .slice(-3)
              .reverse()"
            :key="post.id"
            class="card post-row"
            :to="'/board/notice/' + post.id"
            >{{ post.title }}
            <span class="muted">{{ date(post.created_at) }}</span></router-link
          >
          <p v-if="!posts.some((p) => p.category === 'notice')" class="muted">
            등록된 공지가 없습니다.
          </p></template
        >
        <template v-else-if="route.path === '/characters'"
          ><div class="section-heading">
            <div>
              <span class="eyebrow">CHARACTERS</span>
              <h2>마탑의 사람들</h2>
            </div>
            <button class="primary-button" @click="editCharacter()">
              ＋ 캐릭터 등록
            </button>
          </div>
          <div class="toolbar">
            <input
              v-model="search"
              class="form-input"
              placeholder="이름·별명 검색"
              aria-label="캐릭터 검색"
            /><select
              v-model="faction"
              class="form-input"
              aria-label="진영 필터"
            >
              <option value="">모든 진영</option>
              <option value="mage">마법사</option>
              <option value="templar">템플러</option>
            </select>
          </div>
          <div class="characters-grid">
            <router-link
              v-for="c in filteredCharacters"
              :key="c.id"
              :to="'/characters/' + c.id"
              class="card character-card"
              ><Portrait :character="c" />
              <div>
                <span class="faction-badge" :class="c.faction">{{
                  label(c.faction)
                }}</span>
                <h3>{{ c.name }}</h3>
                <p class="muted">
                  {{ c.position || c.alias || "마탑의 일원" }}
                </p>
                <small class="muted">오너 · {{ owner(c.owner_id) }}</small>
              </div>
              <span class="card-arrow">↗</span></router-link
            >
          </div>
          <p v-if="!filteredCharacters.length" class="empty-state">
            아직 등록된 캐릭터가 없습니다.
          </p></template
        >
        <template v-else-if="route.path.startsWith('/characters/')"
          ><template v-if="character"
            ><section class="card profile-hero">
              <Portrait :character="character" />
              <div>
                <span class="faction-badge" :class="character.faction">{{
                  label(character.faction)
                }}</span>
                <h2>
                  {{ character.name }}
                  <small class="muted">{{ character.alias }}</small>
                </h2>
                <p>{{ character.position }}</p>
                <small class="muted"
                  >오너 · {{ owner(character.owner_id) }}</small
                >
              </div>
              <div v-if="own(character)" class="toolbar">
                <button
                  class="outline-button"
                  @click="editCharacter(character)"
                >
                  프로필 편집</button
                ><button
                  class="secondary-button"
                  @click="
                    deleteTarget = { table: 'characters', id: character.id }
                  "
                >
                  삭제
                </button>
              </div>
            </section>
            <div class="profile-columns">
              <section class="card">
                <h3>기본 설정</h3>
                <dl class="detail-grid">
                  <template v-for="f in shortFields" :key="f.key"
                    ><dt>{{ f.label }}</dt>
                    <dd>{{ character[f.key] || "미입력" }}</dd></template
                  >
                </dl>
                <template v-for="f in longFields" :key="f.key"
                  ><h4>{{ f.label }}</h4>
                  <p class="prose">
                    {{ character[f.key] || "아직 기록되지 않았습니다." }}
                  </p></template
                ><template v-for="(value, key) in character.extra" :key="key"
                  ><h4>{{ key }}</h4>
                  <p class="prose">{{ value }}</p></template
                >
              </section>
              <section class="card">
                <h3>♥ 호감도</h3>
                <p class="muted">
                  내 캐릭터가 {{ character.name }}에게 느끼는 감정
                </p>
                <select
                  v-model="affSource"
                  class="form-input"
                  aria-label="호감도를 작성할 내 캐릭터"
                >
                  <option value="">내 캐릭터 선택</option>
                  <option
                    v-for="c in mine.filter((c) => c.id !== character.id)"
                    :key="c.id"
                    :value="c.id"
                  >
                    {{ c.name }}
                  </option></select
                ><template v-if="affSource"
                  ><p>{{ name(affSource) }} → {{ character.name }}</p>
                  <p class="aff-value">♥ {{ affValue }} <small>/ 100</small></p>
                  <input
                    v-model.number="affValue"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    class="aff-range"
                    aria-label="호감도"
                  /><textarea
                    v-model="affNote"
                    class="form-textarea"
                    placeholder="짧은 감정 설명 (선택)"
                    aria-label="감정 설명"
                  ></textarea
                  ><button
                    class="primary-button"
                    :disabled="busy"
                    @click="act(saveAffection)"
                  >
                    호감도 저장
                  </button></template
                >
                <h3>등록된 관계</h3>
                <button
                  v-if="mine.some((c) => c.id !== character.id)"
                  class="outline-button"
                  @click="editRelation(null, character.id)"
                >
                  ＋ 관계 추가
                </button>
                <article
                  v-for="r in characterRelations"
                  :key="r.id"
                  class="relation-row"
                >
                  <router-link
                    :to="
                      '/characters/' +
                      (r.source_id === character.id ? r.target_id : r.source_id)
                    "
                    >{{
                      name(
                        r.source_id === character.id
                          ? r.target_id
                          : r.source_id,
                      )
                    }}</router-link
                  ><b>{{ r.name }}</b
                  ><span class="badge">{{ statusLabel(r.status) }}</span>
                  <p class="prose">{{ r.description }}</p>
                </article>
                <h3>이미지 갤러리</h3>
                <button
                  v-if="own(character)"
                  class="outline-button"
                  @click="openMedia(character.id)"
                >
                  ＋ 이미지 추가
                </button>
                <div class="media-grid">
                  <figure
                    v-for="m in media.filter(
                      (m) => m.character_id === character.id,
                    )"
                    :key="m.id"
                  >
                    <a :href="m.image" target="_blank" rel="noopener"
                      ><img :src="m.image" :alt="m.caption || '캐릭터 이미지'"
                    /></a>
                    <figcaption>{{ m.caption }}</figcaption>
                    <button
                      v-if="own(m)"
                      @click="deleteTarget = { table: 'media', id: m.id }"
                    >
                      삭제
                    </button>
                  </figure>
                </div>
              </section>
            </div>
            <h3>연결된 이야기와 작품</h3>
            <router-link
              v-for="p in posts.filter(
                (p) =>
                  p.character_id === character.id ||
                  p.character_ids.includes(character.id),
              )"
              :key="p.id"
              class="card post-row"
              :to="'/board/' + p.category + '/' + p.id"
              >{{ p.title }}</router-link
            >
            <h3>교류 기록</h3>
            <CommentsPanel
              :comments="comments.filter((c) => c.target_id === character.id)"
              :characters="characters"
              :members="members"
              :mine="mine"
              :me="me"
              @submit="
                (data, done) =>
                  submitComment(data, { target_id: character.id }, done)
              "
              @remove="(id) => (deleteTarget = { table: 'comments', id })"
          /></template>
          <p v-else class="empty-state">
            삭제되었거나 존재하지 않는 캐릭터입니다.
          </p></template
        >
        <template v-else-if="route.path === '/relationships'"
          ><div class="section-heading">
            <div>
              <span class="eyebrow">THREADS OF FATE</span>
              <h2>인연의 실</h2>
              <p class="muted">서로 확인한 관계만 관계도에 표시됩니다.</p>
            </div>
            <button
              v-if="mine.length"
              class="primary-button"
              @click="editRelation()"
            >
              ＋ 관계 제안
            </button>
          </div>
          <div class="toolbar">
            <select v-model="faction" class="form-input" aria-label="진영">
              <option value="">모든 진영</option>
              <option value="mage">마법사</option>
              <option value="templar">템플러</option></select
            ><select v-model="kind" class="form-input" aria-label="관계 종류">
              <option value="">모든 관계</option>
              <option
                v-for="k in [...new Set(relationships.map((r) => r.kind))]"
                :key="k"
              >
                {{ k }}
              </option></select
            ><select
              v-model="focus"
              class="form-input"
              aria-label="중심 캐릭터"
            >
              <option value="">전체 캐릭터</option>
              <option v-for="c in characters" :value="c.id" :key="c.id">
                {{ c.name }}
              </option></select
            ><button class="outline-button" @click="graph = !graph">
              {{ graph ? "목록 보기" : "관계도 보기" }}
            </button>
          </div>
          <RelationshipGraph
            v-if="graph"
            :characters="characters"
            :relationships="relationships"
            :faction="faction"
            :kind="kind"
            :focus="focus"
          />
          <div v-else>
            <article
              v-for="r in filteredRelations"
              :key="r.id"
              class="card relation-row"
            >
              <router-link :to="'/characters/' + r.source_id">{{
                name(r.source_id)
              }}</router-link>
              {{ r.directed ? "→" : "↔" }}
              <router-link :to="'/characters/' + r.target_id">{{
                name(r.target_id)
              }}</router-link>
              <h3>{{ r.name }}</h3>
              <p class="prose">{{ r.description }}</p>
            </article>
            <p v-if="!filteredRelations.length" class="empty-state">
              표시할 승인된 관계가 없습니다.
            </p>
          </div>
          <h3>내 관계 제안 및 관리</h3>
          <article
            v-for="r in myRelations"
            :key="r.id"
            class="card relation-row"
          >
            <b
              >{{ name(r.source_id) }} {{ r.directed ? "→" : "↔" }}
              {{ name(r.target_id) }} · {{ r.name }}</b
            >
            <span class="badge">{{ statusLabel(r.status) }}</span>
            <p class="prose">{{ r.description }}</p>
            <div class="toolbar">
              <template v-if="r.status === 'pending' && ownsId(r.target_id)"
                ><button
                  class="primary-button"
                  :disabled="busy"
                  @click="act(() => updateStatus(r, 'approved'))"
                >
                  승인</button
                ><button
                  class="secondary-button"
                  :disabled="busy"
                  @click="act(() => updateStatus(r, 'rejected'))"
                >
                  거절
                </button></template
              ><button class="outline-button" @click="editRelation(r)">
                관계 수정</button
              ><button
                v-if="r.status === 'rejected' && ownsId(r.source_id)"
                class="outline-button"
                @click="act(() => updateStatus(r, 'pending'))"
              >
                다시 제안</button
              ><button
                class="secondary-button"
                @click="deleteTarget = { table: 'relationships', id: r.id }"
              >
                관계 취소·삭제
              </button>
            </div>
          </article></template
        >
        <template v-else-if="route.path.startsWith('/board/')"
          ><template v-if="post"
            ><article class="card">
              <span class="eyebrow">{{ categoryLabel(post.category) }}</span>
              <h2>{{ post.title }}</h2>
              <p class="muted">
                <router-link
                  v-if="post.character_id && byId(post.character_id)"
                  :to="'/characters/' + post.character_id"
                  >{{ name(post.character_id) }}</router-link
                ><span v-else>{{ owner(post.owner_id) }}</span> ·
                {{ date(post.created_at) }}
              </p>
              <MentionText :text="post.body" :characters="characters" />
              <p>
                <router-link
                  v-for="id in post.character_ids"
                  :key="id"
                  :to="'/characters/' + id"
                  class="badge"
                  >{{ name(id) }}</router-link
                >
              </p>
              <div class="media-grid">
                <figure
                  v-for="m in media.filter((m) => m.post_id === post.id)"
                  :key="m.id"
                >
                  <a :href="m.image" target="_blank" rel="noopener"
                    ><img :src="m.image" :alt="m.caption || post.title"
                  /></a>
                  <figcaption>{{ m.caption }}</figcaption>
                  <button
                    v-if="own(m)"
                    @click="deleteTarget = { table: 'media', id: m.id }"
                  >
                    삭제
                  </button>
                </figure>
              </div>
              <div v-if="own(post)" class="toolbar">
                <button class="outline-button" @click="editPost(post)">
                  글 수정</button
                ><button class="outline-button" @click="openMedia('', post.id)">
                  이미지 첨부</button
                ><button
                  class="secondary-button"
                  @click="deleteTarget = { table: 'posts', id: post.id }"
                >
                  삭제
                </button>
              </div>
            </article>
            <h3>댓글</h3>
            <CommentsPanel
              :comments="comments.filter((c) => c.post_id === post.id)"
              :characters="characters"
              :members="members"
              :mine="mine"
              :me="me"
              @submit="
                (data, done) => submitComment(data, { post_id: post.id }, done)
              "
              @remove="
                (id) => (deleteTarget = { table: 'comments', id })
              " /></template
          ><template v-else-if="route.path.split('/').length === 3"
            ><div class="section-heading">
              <h2>{{ categoryLabel(category) }}</h2>
              <button
                v-if="category !== 'notice' || admin"
                class="primary-button"
                @click="editPost()"
              >
                ＋ 글 작성
              </button>
            </div>
            <router-link
              v-for="p in posts
                .filter((p) => p.category === category)
                .slice()
                .reverse()"
              :key="p.id"
              class="card post-row"
              :to="'/board/' + category + '/' + p.id"
              ><div>
                <h3>{{ p.title }}</h3>
                <span class="muted"
                  >{{ name(p.character_id) || owner(p.owner_id) }} ·
                  {{ date(p.created_at) }}</span
                >
              </div>
              <span>↗</span></router-link
            >
            <p
              v-if="!posts.some((p) => p.category === category)"
              class="empty-state"
            >
              첫 번째 이야기를 남겨주세요.
            </p></template
          >
          <p v-else class="empty-state">
            삭제되었거나 존재하지 않는 게시글입니다.
          </p></template
        >
        <template v-else-if="route.path === '/gallery'"
          ><div class="section-heading">
            <h2>그림과 기록</h2>
            <button class="primary-button" @click="openMedia()">
              ＋ 이미지 등록
            </button>
          </div>
          <div class="media-grid full">
            <figure v-for="m in media" :key="m.id" class="card">
              <a :href="m.image" target="_blank" rel="noopener"
                ><img :src="m.image" :alt="m.caption || '보관 이미지'"
              /></a>
              <figcaption>
                {{ m.caption }}
                <router-link
                  v-if="m.character_id"
                  :to="'/characters/' + m.character_id"
                  >{{ name(m.character_id) }}</router-link
                ><router-link
                  v-if="m.post_id && posts.find((p) => p.id === m.post_id)"
                  :to="
                    '/board/' +
                    posts.find((p) => p.id === m.post_id).category +
                    '/' +
                    m.post_id
                  "
                  >연결된 글 ↗</router-link
                >
              </figcaption>
              <button
                v-if="own(m)"
                @click="deleteTarget = { table: 'media', id: m.id }"
              >
                삭제
              </button>
            </figure>
          </div>
          <p v-if="!media.length" class="empty-state">
            아직 보관된 이미지가 없습니다.
          </p></template
        >
        <template v-else-if="route.path === '/profile'"
          ><section class="card">
            <h2>내 프로필</h2>
            <form @submit.prevent="act(saveNickname)">
              <label
                >닉네임<input
                  v-model="nickname"
                  class="form-input"
                  required
                  maxlength="80"
              /></label>
              <p class="muted">{{ me.email }}</p>
              <button class="primary-button" :disabled="busy">저장</button>
            </form>
          </section></template
        >
        <template v-else-if="route.path === '/admin' && admin"
          ><section class="card">
            <h2>회원 초대·접근 관리</h2>
            <p class="muted">
              Google 이메일을 등록하면 해당 계정으로 로그인할 수 있습니다.
            </p>
            <form class="toolbar" @submit.prevent="act(invite)">
              <input
                v-model="inviteEmail"
                type="email"
                class="form-input"
                required
                placeholder="초대할 이메일"
                aria-label="초대 이메일"
              /><input
                v-model="inviteName"
                class="form-input"
                required
                placeholder="닉네임"
                aria-label="닉네임"
              /><button class="primary-button" :disabled="busy">
                회원 등록
              </button>
            </form>
            <article
              v-for="member in members"
              :key="member.id"
              class="post-row"
            >
              <span
                >{{ member.nickname }} · {{ member.email }}
                <span class="badge">{{ member.role }}</span></span
              ><button
                v-if="member.id !== me.id"
                class="secondary-button"
                :disabled="busy"
                @click="
                  act(() =>
                    save('members', { ...member, active: !member.active }),
                  )
                "
              >
                {{ member.active ? "접근 차단" : "차단 해제" }}
              </button>
            </article>
          </section>
          <section class="card">
            <h2>백업과 사용량</h2>
            <p>
              등록 이미지 {{ media.length }}개 ·
              {{
                (media.reduce((n, m) => n + m.bytes, 0) / 1048576).toFixed(2)
              }}
              MiB
            </p>
            <p class="muted">
              실제 R2 전체 객체·D1 용량은 Cloudflare 대시보드에서 확인하세요.
              삭제된 자료도 보존됩니다.
            </p>
            <button
              class="primary-button"
              :disabled="busy"
              @click="act(downloadExport)"
            >
              전체 DB 내보내기
            </button>
            <p class="muted">
              이미지 원본은 Google Drive 정기 백업에 별도로 포함됩니다. 설정
              방법은 docs/배포와-백업.md를 참고하세요.
            </p>
          </section>
          <section class="card">
            <h2>최근 변경 및 삭제 복구</h2>
            <button class="outline-button" @click="act(loadHistory)">
              변경 기록 확인
            </button>
            <article
              v-for="h in history.slice(0, 30)"
              :key="h.id"
              class="relation-row"
            >
              <p>
                {{ date(h.created_at) }} · {{ h.table_name }} · {{ h.action }}
              </p>
              <button
                v-if="h.before_json"
                class="secondary-button"
                :disabled="busy"
                @click="act(() => restoreRevision(h.id))"
              >
                이 변경 이전으로 복원
              </button>
            </article>
          </section></template
        >
        <p v-else class="empty-state">페이지를 찾을 수 없습니다.</p>
      </main>
    </div>
  </div>
  <div v-if="modal" class="modal-overlay" @click.self="modal = ''">
    <section
      class="modal editor"
      role="dialog"
      aria-modal="true"
      :aria-label="modalTitle"
    >
      <div class="modal-head">
        <h2>{{ modalTitle }}</h2>
        <button class="secondary-button" @click="modal = ''" aria-label="닫기">
          ×
        </button>
      </div>
      <form @submit.prevent="act(submitDraft)">
        <template v-if="modal === 'character'"
          ><label
            >이름<input
              v-model="draft.name"
              class="form-input"
              required
              maxlength="120" /></label
          ><label>별명<input v-model="draft.alias" class="form-input" /></label
          ><label
            >진영<select v-model="draft.faction" class="form-input">
              <option value="mage">마법사</option>
              <option value="templar">템플러</option>
            </select></label
          ><label v-for="f in shortFields" :key="f.key"
            >{{ f.label
            }}<input v-model="draft[f.key]" class="form-input" /></label
          ><label v-for="f in longFields" :key="f.key"
            >{{ f.label
            }}<textarea
              v-model="draft[f.key]"
              class="form-textarea"
              rows="4"
            ></textarea></label
          ><label
            >자유 설정 항목 (JSON)<textarea
              v-model="extraText"
              class="form-textarea"
              placeholder='{"습관":"자주 창밖을 본다"}'
            ></textarea></label
          ><label
            >프로필 이미지<input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              @change="file = $event.target.files[0]" /></label
        ></template>
        <template v-if="modal === 'relationship'"
          ><label
            >내 캐릭터<select
              v-model="draft.source_id"
              :disabled="!!draft.id"
              class="form-input"
              required
            >
              <option value="">선택</option>
              <option
                v-for="c in draft.id ? characters : mine"
                :key="c.id"
                :value="c.id"
              >
                {{ c.name }}
              </option>
            </select></label
          ><label
            >상대 캐릭터<select
              v-model="draft.target_id"
              :disabled="!!draft.id"
              class="form-input"
              required
            >
              <option value="">선택</option>
              <option
                v-for="c in characters.filter((c) => c.id !== draft.source_id)"
                :key="c.id"
                :value="c.id"
              >
                {{ c.name }}
              </option>
            </select></label
          ><label
            >관계 이름<input
              v-model="draft.name"
              class="form-input"
              required
              maxlength="160" /></label
          ><label
            >관계 유형<input
              v-model="draft.kind"
              class="form-input"
              list="kinds"
              required
            /><datalist id="kinds">
              <option
                v-for="k in [
                  '친구',
                  '연인',
                  '가족',
                  '동료',
                  '사제',
                  '라이벌',
                  '적대',
                  '일방적 감정',
                  '사용자 지정',
                ]"
                :key="k"
              >
                {{ k }}
              </option>
            </datalist></label
          ><label
            >관계 설명<textarea
              v-model="draft.description"
              class="form-textarea"
              rows="5"
            ></textarea></label
          ><label
            ><input v-model="draft.directed" type="checkbox" /> 방향이 있는
            일방적 관계</label
          >
          <p class="muted">
            다른 오너의 캐릭터와 맺는 관계는 상대 승인 후 성립합니다. 내용을
            수정하면 다시 승인을 받습니다.
          </p></template
        >
        <template v-if="modal === 'post'"
          ><label
            >제목<input
              v-model="draft.title"
              class="form-input"
              required
              maxlength="200" /></label
          ><label
            >작성 캐릭터<select v-model="draft.character_id" class="form-input">
              <option :value="null">오너로 작성</option>
              <option v-for="c in mine" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select></label
          ><label
            >내용<textarea
              v-model="draft.body"
              class="form-textarea"
              rows="10"
            ></textarea></label
          ><label
            >연결할 캐릭터<select
              v-model="draft.character_ids"
              multiple
              class="form-input"
            >
              <option v-for="c in characters" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select></label
          ></template
        >
        <template v-if="modal === 'media'"
          ><label
            >이미지<input
              type="file"
              required
              accept="image/png,image/jpeg,image/webp,image/gif"
              @change="file = $event.target.files[0]" /></label
          ><label
            >설명<input v-model="draft.caption" class="form-input" /></label
          ><label
            >연결할 내 캐릭터<select
              v-model="draft.character_id"
              class="form-input"
            >
              <option :value="null">없음</option>
              <option v-for="c in mine" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select></label
          ></template
        >
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <div class="toolbar">
          <button class="primary-button" :disabled="busy">
            {{ busy ? "저장 중…" : "저장" }}</button
          ><button type="button" class="secondary-button" @click="modal = ''">
            취소
          </button>
        </div>
      </form>
    </section>
  </div>
  <div v-if="deleteTarget" class="modal-overlay">
    <section
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label="삭제 확인"
    >
      <h3>이 기록을 삭제할까요?</h3>
      <p>목록에서 숨겨지며, 운영자가 변경 기록에서 복구할 수 있습니다.</p>
      <div class="toolbar">
        <button
          class="primary-button"
          :disabled="busy"
          @click="act(deleteRecord)"
        >
          삭제</button
        ><button class="secondary-button" @click="deleteTarget = null">
          취소
        </button>
      </div>
    </section>
  </div>
</template>
<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  defineAsyncComponent,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { request, save, remove, upload, imageBlob, exportAll } from "./api";
import Portrait from "./Portrait.vue";
import MentionText from "./MentionText.vue";
const RelationshipGraph = defineAsyncComponent(() =>
  import("./RelationshipGraph.vue"),
);
import CommentsPanel from "./CommentsPanel.vue";
const route = useRoute(),
  router = useRouter();
const me = ref(null),
  members = ref([]),
  characters = ref([]),
  relationships = ref([]),
  affection = ref([]),
  posts = ref([]),
  comments = ref([]),
  media = ref([]),
  history = ref([]);
const busy = ref(false),
  loading = ref(true),
  error = ref(""),
  message = ref(""),
  dark = ref(false),
  modal = ref(""),
  draft = ref({}),
  file = ref(null),
  extraText = ref("{}"),
  deleteTarget = ref(null),
  search = ref(""),
  faction = ref(""),
  kind = ref(""),
  focus = ref(""),
  graph = ref(true),
  affSource = ref(""),
  affValue = ref(0),
  affNote = ref(""),
  nickname = ref(""),
  inviteEmail = ref(""),
  inviteName = ref("");
let urls = [],
  timer;
const authError = new URLSearchParams(location.search).get("auth_error");
const navigation = [
  { path: "/home", icon: "⌂", label: "메인" },
  { path: "/characters", icon: "♙", label: "캐릭터" },
  { path: "/relationships", icon: "◇", label: "관계도" },
  { path: "/board/story", icon: "▤", label: "썰 게시판" },
  { path: "/board/art", icon: "▧", label: "그림·로그" },
  { path: "/gallery", icon: "▦", label: "이미지 보관함" },
  { path: "/board/notice", icon: "▣", label: "공지" },
  { path: "/profile", icon: "○", label: "내 프로필" },
];
const shortFields = [
  { key: "age", label: "나이" },
  { key: "gender", label: "성별" },
  { key: "race", label: "종족" },
  { key: "origin", label: "출신지" },
  { key: "position", label: "직책·마탑 내 역할" },
];
const longFields = [
  { key: "personality", label: "성격" },
  { key: "background", label: "배경 이야기" },
  { key: "goals", label: "목표와 가치관" },
  { key: "secrets", label: "비밀 설정" },
];
const admin = computed(() => me.value?.role === "admin"),
  mine = computed(() =>
    characters.value.filter((c) => c.owner_id === me.value?.id),
  ),
  approved = computed(() =>
    relationships.value.filter(
      (r) => r.status === "approved" && byId(r.source_id) && byId(r.target_id),
    ),
  ),
  character = computed(() => byId(route.path.split("/")[2])),
  category = computed(() => route.path.split("/")[2] || "story"),
  post = computed(() =>
    posts.value.find((p) => p.id === route.path.split("/")[3]),
  ),
  filteredCharacters = computed(() =>
    characters.value.filter(
      (c) =>
        (!faction.value || c.faction === faction.value) &&
        (!search.value ||
          (c.name + " " + c.alias)
            .toLowerCase()
            .includes(search.value.toLowerCase())),
    ),
  ),
  characterRelations = computed(() =>
    relationships.value.filter((r) =>
      [r.source_id, r.target_id].includes(character.value?.id),
    ),
  ),
  myRelations = computed(() =>
    relationships.value.filter(
      (r) => admin.value || ownsId(r.source_id) || ownsId(r.target_id),
    ),
  ),
  filteredRelations = computed(() =>
    approved.value.filter(
      (r) =>
        (!kind.value || r.kind === kind.value) &&
        (!focus.value || [r.source_id, r.target_id].includes(focus.value)) &&
        (!faction.value ||
          [byId(r.source_id), byId(r.target_id)].every(
            (c) => c?.faction === faction.value,
          )),
    ),
  ),
  pageTitle = computed(
    () =>
      navigation.find((i) => route.path.startsWith(i.path))?.label ||
      (route.path === "/admin" ? "운영 관리" : "Gwaren Tower"),
  ),
  modalTitle = computed(
    () =>
      ({
        character: "캐릭터 설정",
        relationship: "관계 제안·수정",
        post: "이야기 작성",
        media: "이미지 보관",
      }[modal.value]),
  );
function byId(id) {
  return characters.value.find((c) => c.id === id);
}
function name(id) {
  return id ? byId(id)?.name || "삭제된 캐릭터" : "";
}
function owner(id) {
  return members.value.find((m) => m.id === id)?.nickname || "오너";
}
function own(row) {
  return row && (admin.value || row.owner_id === me.value?.id);
}
function ownsId(id) {
  return byId(id)?.owner_id === me.value?.id;
}
function label(value) {
  return value === "mage" ? "마법사" : "템플러";
}
function statusLabel(s) {
  return { pending: "제안 중", approved: "승인됨", rejected: "거절됨" }[s];
}
function date(s) {
  return new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}
function categoryLabel(s) {
  return (
    { story: "썰 게시판", art: "그림·로그 보관함", notice: "공지" }[s] ||
    "게시판"
  );
}
async function act(fn) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    await fn();
    message.value = "반영했습니다.";
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
function clearUrls() {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
}
async function refresh() {
  const data = await request("/data");
  const paths = [
    ...new Set(
      [
        ...data.characters.map((c) => c.image_path),
        ...data.media.map((m) => m.path),
      ].filter(Boolean),
    ),
  ];
  const images = {};
  await Promise.all(
    paths.map(async (p) => {
      try {
        images[p] = await imageBlob(p);
      } catch {
        images[p] = "";
      }
    }),
  );
  clearUrls();
  urls = Object.values(images).filter(Boolean);
  characters.value = data.characters.map((c) => ({
    ...c,
    image: images[c.image_path] || "",
  }));
  media.value = data.media.map((m) => ({ ...m, image: images[m.path] || "" }));
  members.value = data.members;
  relationships.value = data.relationships;
  affection.value = data.affection;
  posts.value = data.posts;
  comments.value = data.comments;
}
async function logout() {
  await request("/auth/logout", { method: "POST" });
  me.value = null;
  clearUrls();
  characters.value = [];
  posts.value = [];
  comments.value = [];
  relationships.value = [];
  media.value = [];
}
function editCharacter(c) {
  draft.value = c
    ? { ...c }
    : { name: "", alias: "", faction: "mage", extra: {} };
  extraText.value = JSON.stringify(c?.extra || {}, null, 2);
  file.value = null;
  error.value = "";
  modal.value = "character";
}
function editRelation(r, target = "") {
  draft.value = r
    ? { ...r }
    : {
        source_id: mine.value.find((c) => c.id !== target)?.id || "",
        target_id: target,
        name: "",
        kind: "사용자 지정",
        description: "",
        directed: false,
      };
  error.value = "";
  modal.value = "relationship";
}
function editPost(p) {
  draft.value = p
    ? { ...p, character_ids: [...p.character_ids] }
    : {
        category: category.value,
        title: "",
        body: "",
        character_id: null,
        character_ids: [],
      };
  modal.value = "post";
  error.value = "";
}
function openMedia(characterId = "", postId = "") {
  draft.value = {
    character_id: characterId || null,
    post_id: postId || null,
    caption: "",
  };
  file.value = null;
  modal.value = "media";
  error.value = "";
}
async function submitDraft() {
  let table = {
    character: "characters",
    relationship: "relationships",
    post: "posts",
    media: "media",
  }[modal.value];
  const value = { ...draft.value };
  if (modal.value === "character") {
    value.extra = JSON.parse(extraText.value);
    if (
      !value.extra ||
      Array.isArray(value.extra) ||
      typeof value.extra !== "object"
    )
      throw new Error("자유 설정은 JSON 객체로 입력하세요.");
    if (file.value) value.image_path = await upload(file.value);
  }
  if (modal.value === "media") {
    if (!file.value) throw new Error("이미지를 선택하세요.");
    value.path = await upload(file.value);
    value.bytes = file.value.size;
    value.mime = file.value.type;
  }
  const saved = await save(table, value);
  modal.value = "";
  await refresh();
  if (table === "characters") router.push("/characters/" + saved.id);
  if (table === "posts")
    router.push("/board/" + saved.category + "/" + saved.id);
}
async function saveAffection() {
  const existing = affection.value.find(
    (a) =>
      a.source_id === affSource.value && a.target_id === character.value.id,
  );
  await save("affection", {
    id: existing?.id,
    source_id: affSource.value,
    target_id: character.value.id,
    value: affValue.value,
    note: affNote.value,
  });
  await refresh();
}
function syncAff() {
  const value = affection.value.find(
    (a) =>
      a.source_id === affSource.value && a.target_id === character.value?.id,
  );
  affValue.value = value?.value || 0;
  affNote.value = value?.note || "";
}
watch([affSource, () => character.value?.id], syncAff);
watch(
  () => route.path,
  () => {
    message.value = "";
    error.value = "";
    affSource.value = "";
  },
);
async function updateStatus(r, status) {
  await save("relationships", { ...r, status });
  await refresh();
}
async function submitComment(data, target, done) {
  await act(async () => {
    try {
      await saveComment(data, target);
      done(true);
    } catch (e) {
      done(false);
      throw e;
    }
  });
}
async function saveComment(data, target) {
  await save("comments", { ...data, ...target });
  await refresh();
}
async function deleteRecord() {
  await remove(deleteTarget.value.table, deleteTarget.value.id);
  deleteTarget.value = null;
  await refresh();
}
async function invite() {
  await save("members", {
    email: inviteEmail.value,
    nickname: inviteName.value,
  });
  inviteEmail.value = "";
  inviteName.value = "";
  await refresh();
}
async function saveNickname() {
  me.value = await request("/profile", {
    method: "POST",
    body: JSON.stringify({ nickname: nickname.value }),
  });
  await refresh();
}
async function downloadExport() {
  const data = await exportAll();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download =
    "circle-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loadHistory() {
  history.value = await request("/history");
}
async function restoreRevision(id) {
  await request("/history/" + id + "/restore", { method: "POST" });
  await refresh();
  await loadHistory();
}
onMounted(async () => {
  try {
    me.value = await request("/me");
    nickname.value = me.value.nickname;
    await refresh();
    timer = setInterval(async () => {
      if (
        document.visibilityState === "visible" &&
        !busy.value &&
        !modal.value
      ) {
        try {
          await refresh();
        } catch (e) {
          if (e.message.includes("로그인")) {
            clearUrls();
            me.value = null;
          }
          error.value = e.message;
        }
      }
    }, 60000);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => {
  clearInterval(timer);
  clearUrls();
});
</script>
