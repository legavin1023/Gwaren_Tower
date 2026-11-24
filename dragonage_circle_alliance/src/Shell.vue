<template>
  <div v-if="!me" class="login-wrap">
    <CodexHero gate />
    <section class="card login-card">
      <span class="eyebrow">SEALED RECORDS · AUTHORIZED OWNERS</span>
      <h2>기록 열람 허가</h2>
      <p class="muted">등록된 오너의 계정으로 마탑의 기록을 열람합니다.</p>
      <a href="/api/auth/login" class="primary-button login-link">{{
        localDevelopment ? "로컬 개발 모드로 입장" : "Google 계정으로 입장"
      }}</a>
      <p v-if="localDevelopment" class="muted">
        로컬 DB를 사용하는 개발 화면입니다. Google 로그인 없이 입장할 수
        있습니다.
      </p>
      <p v-if="loading">로그인 확인 중…</p>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="authError" role="alert" class="error">
        로그인을 완료하지 못했습니다. 등록된 이메일인지 확인하세요.
      </p>
    </section>
  </div>
  <div v-else class="app-shell" :class="{ 'dark-mode': dark }">
    <aside class="sidebar" :class="{ 'index-open': navigationOpen }">
      <div class="brand">
        <span><b>Gwaren Tower</b><small>THE CIRCLE · ARCHIVES</small></span>
        <button
          type="button"
          class="mobile-index-toggle"
          :aria-expanded="navigationOpen"
          aria-controls="archive-index"
          :aria-label="navigationOpen ? '목차 닫기' : '목차 열기'"
          @click="navigationOpen = !navigationOpen"
        >
          <CodexIcon name="index" /><span>목차</span>
        </button>
      </div>
      <p class="index-caption">
        <span>INDEX OF RECORDS</span><span>I — IX</span>
      </p>
      <nav id="archive-index" class="side-nav" aria-label="주요 메뉴">
        <router-link
          v-for="(item, index) in navigation"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          @click="navigationOpen = false"
          ><CodexIcon :name="item.icon" /><span>{{ item.label }}</span
          ><small class="nav-index" aria-hidden="true">{{
            ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][index]
          }}</small></router-link
        >
        <router-link
          v-if="admin"
          to="/admin"
          class="nav-item"
          @click="navigationOpen = false"
          ><CodexIcon name="seal" /><span>운영 관리</span
          ><small class="nav-index" aria-hidden="true">X</small></router-link
        >
      </nav>
      <AccountControls
        class="sidebar-bottom account-controls--sidebar"
        :show-mode="false"
        :show-session="false"
        :me="viewMe"
        :can-admin="canAdmin"
        :admin-mode="administratorMode"
        @change-mode="switchAccessMode"
        :representative="representative"
        :dark="dark"
        :busy="busy"
        @toggle-theme="dark = !dark"
        @logout="act(logout)"
      />
    </aside>
    <div class="content-shell">
      <header class="topbar">
        <div class="topbar-heading" :title="pageTitle">
          <!-- <span class="breadcrumb">GWAREN TOWER / THE CODEX</span> -->
          <h1 class="topbar-title">{{ pageTitle }}</h1>
        </div>
        <div class="toolbar topbar-actions">
          <NotificationCenter
            :version="notificationVersion"
            :status="liveStatus"
          />
          <button
            class="secondary-button"
            :disabled="busy"
            aria-label="새로고침"
            title="새로고침"
            @click="act(refresh)"
          >
            <svg
              class="topbar-refresh-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9"
              /></svg
            ><span class="topbar-refresh-text">새로고침</span>
          </button>
          <AccountControls
            class="account-controls--topbar"
            :show-mode="true"
            :me="viewMe"
            :can-admin="canAdmin"
            :admin-mode="administratorMode"
            @change-mode="switchAccessMode"
            :representative="representative"
            :dark="dark"
            :busy="busy"
            compact
            @toggle-theme="dark = !dark"
            @logout="act(logout)"
          />
        </div>
      </header>
      <main :key="me.id + ':' + administratorMode" class="main-content">
        <p v-if="error" class="error alert" role="alert">
          {{ error }}
          <button @click="error = ''" aria-label="오류 닫기">×</button>
        </p>
        <p v-if="message" class="success alert" role="status">{{ message }}</p>
        <p v-if="loading">기록을 불러오는 중…</p>
        <template v-if="route.path === '/' || route.path === '/home'"
          ><CodexHero />
          <div class="summary-grid">
            <router-link to="/characters" class="card"
              ><span class="eyebrow">CHARACTERS</span>
              <h2>{{ characters.length }}</h2>
              <span>인명 기록부</span></router-link
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
          <section class="codex-announcements">
            <div class="section-heading">
              <h3>마탑의 공지</h3>
              <router-link to="/board/notice">전체 공지 보기 →</router-link>
            </div>
            <router-link
              v-for="post in posts
                .filter((p) => p.category === 'notice')
                .slice(-3)
                .reverse()"
              :key="post.id"
              class="card post-row"
              :to="'/board/notice/' + post.id"
              >{{ post.title }}
              <span class="muted">{{
                date(post.created_at)
              }}</span></router-link
            >
            <p v-if="!posts.some((p) => p.category === 'notice')" class="muted">
              등록된 공지가 없습니다.
            </p>
          </section></template
        >
        <template v-else-if="route.path === '/characters'"
          ><div
            class="character-directory-toolbar"
            role="group"
            aria-label="캐릭터 목록 검색 및 필터"
          >
            <div class="character-directory-title">
              <span class="eyebrow">CHARACTERS</span>
              <h2>마탑의 사람들</h2>
            </div>
            <div class="character-directory-actions">
            <input
              v-model="search"
              class="form-input character-directory-search"
              placeholder="이름 검색"
              aria-label="캐릭터 검색"
            />
            <select
              v-model="faction"
              class="form-input character-directory-affiliation"
              aria-label="소속"
            >
              <option value="">모든 소속</option>
              <option
                v-for="option in affiliationOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <button
              class="primary-button character-directory-create"
              @click="editCharacter()"
            >
              ＋ 캐릭터 등록
            </button>
            </div>
          </div>
          <div class="characters-grid">
            <CharacterCard
              v-for="c in filteredCharacters"
              :key="c.id"
              :character="c"
              :owner="owner(c.owner_id)"
            />
          </div>
          <p v-if="!filteredCharacters.length" class="empty-state">
            아직 등록된 캐릭터가 없습니다.
          </p></template
        >
        <template v-else-if="route.path.startsWith('/characters/')"
          ><template v-if="character"
            ><section
              class="card profile-hero character-themed"
              :style="characterTheme(character)"
            >
              <button
                v-if="own(character)"
                type="button"
                class="profile-portrait-edit"
                aria-label="캐릭터 프로필 편집"
                title="프로필 편집"
                @click="editCharacter(character)"
              >
                <Portrait :character="character" />
                <span class="profile-portrait-pencil" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="m16 3 5 5M4 15 16 3a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L9 20l-6 1 1-6Z"
                    />
                  </svg>
                </span>
              </button>
              <Portrait v-else :character="character" />
              <div class="profile-hero-info">
                <p class="dossier-reference">
                  PERSONAL FILE · {{ character.id.slice(0, 8).toUpperCase() }}
                </p>
                <h2 class="character-name" :title="character.name">
                  {{ character.name }}
                </h2>
                <span class="faction-badge" :class="character.faction">{{
                  affiliationLabel(character)
                }}</span>
                <p v-if="character.position" :title="character.position">
                  {{ character.position }}
                </p>
                <small
                  class="muted"
                  :title="'오너 · ' + owner(character.owner_id)"
                  >오너 · {{ owner(character.owner_id) }}</small
                >
                <RecruitmentStatus
                  :character="character"
                  :title="character.extra?.recruitment_note"
                  details
                />
                <button
                  v-if="admin"
                  class="secondary-button profile-delete-button"
                  @click="
                    deleteTarget = { table: 'characters', id: character.id }
                  "
                >
                  삭제
                </button>
              </div>
              <CharacterMiniGallery
                v-if="characterGallery(character.id).length"
                :items="characterGallery(character.id)"
              />
            </section>
            <div class="profile-columns">
              <section class="card">
                <nav class="rp-tabs" aria-label="캐릭터 프로필 메뉴">
                  <button
                    class="outline-button"
                    :aria-pressed="profileTab === 'profile'"
                    @click="profileTab = 'profile'"
                  >
                    캐릭터 프로필
                  </button>
                  <button
                    class="outline-button"
                    :aria-pressed="profileTab === 'roleplay'"
                    @click="profileTab = 'roleplay'"
                  >
                    역극 기록
                  </button>
                </nav>
                <template v-if="profileTab === 'profile'">
                  <div class="character-profile-summary">
                    <div
                      v-for="f in profileFields"
                      :key="f.key"
                      class="character-profile-summary-field"
                      :style="{ '--profile-field-span': f.span || 12 }"
                      :class="{
                        'character-profile-field-wide':
                          f.long || f.key === 'quote',
                        'character-profile-faction': f.key === 'circle_faction',
                      }"
                    >
                      <h4>{{ f.label }}</h4>
                      <p class="prose">
                        {{
                          fieldDisplayValue(character, f) ||
                          "아직 기록되지 않았습니다."
                        }}
                      </p>
                    </div>
                  </div>
                  <template v-for="(value, key) in character.extra" :key="key">
                    <template
                      v-if="
                        ![
                          'theme_color',
                          'portrait_history',
                          'recruitment_status',
                          'recruitment_note',
                        ].includes(key) &&
                        !extraFields.some((f) => f.key === key)
                      "
                      ><h4>{{ key }}</h4>
                      <p class="prose">{{ value }}</p></template
                    >
                  </template>
                  <h3>오너란</h3>
                  <template v-for="f in ownerFields" :key="f.key">
                    <h4>{{ f.label }}</h4>
                    <p class="prose">
                      {{
                        fieldValue(character, f) || "아직 기록되지 않았습니다."
                      }}
                    </p>
                  </template>
                </template>
                <RoleplayRecords
                  v-else
                  :key="character.id"
                  :character-ids="[character.id]"
                  :characters="characters"
                  :version="roleplayVersion"
                />
              </section>
              <section class="card">
                <div class="affection-profile-heading">
                  <h3>♥ 호감도</h3>
                  <router-link to="/affection" class="outline-button"
                    >전체 목록</router-link
                  >
                </div>
                <AffectionList
                  :characters="characters"
                  :affection="affection"
                  :members="members"
                  :me="viewMe"
                  :target-character-id="character.id"
                  compact
                />
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
                  <router-link
                    v-if="r.status === 'approved'"
                    :to="'/relationships/' + r.id"
                    class="outline-button"
                    >두 캐릭터의 관계 페이지 ↗</router-link
                  >
                  <div
                    v-if="r.status === 'pending' && ownsId(r.target_id)"
                    class="toolbar"
                  >
                    <button
                      class="primary-button"
                      :disabled="busy"
                      @click="act(() => updateStatus(r, 'approved'))"
                    >
                      관계 수락
                    </button>
                    <button
                      class="secondary-button"
                      :disabled="busy"
                      @click="act(() => updateStatus(r, 'rejected'))"
                    >
                      거절
                    </button>
                  </div>
                </article>
                <h3>이미지 갤러리</h3>
                <button
                  v-if="own(character)"
                  class="outline-button"
                  @click="openMedia(character.id)"
                >
                  ＋ 이미지 추가
                </button>
                <ImageSlider
                  :items="media.filter((m) => m.character_id === character.id)"
                  :label="character.name + ' 이미지'"
                  :can-delete="own"
                  @remove="(id) => (deleteTarget = { table: 'media', id })"
                />
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
            <CharacterQuestions
              :character="character"
              :questions="questions"
              :members="members"
              :me="viewMe"
              :busy="busy"
              @save="submitQuestion"
              @remove="(id) => (deleteTarget = { table: 'questions', id })" />
            <h3>교류 기록</h3>
            <CommentsPanel
              :comments="comments.filter((c) => c.target_id === character.id)"
              :characters="characters"
              :members="members"
              :mine="mine"
              :me="viewMe"
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
        <RoleplayView
          v-else-if="route.path.startsWith('/roleplay')"
          :me="viewMe"
          :characters="characters"
          :members="members"
          :version="roleplayVersion"
          :live-status="liveStatus"
        />
        <template v-else-if="route.path === '/affection'">
          <AffectionList
            :characters="characters"
            :affection="affection"
            :members="members"
            :me="viewMe"
          />
        </template>
        <RelationshipArchive
          v-else-if="route.path.startsWith('/relationships/')"
          :relationship-id="route.path.split('/')[2]"
          :roleplay-version="roleplayVersion"
          :characters="characters"
          :relationships="relationships"
          :posts="posts"
          :media="media"
          :members="members"
          @create="createPairPost"
        />
        <template v-else-if="route.path === '/relationships'"
          >
          <div class="toolbar relationship-controls">
            <select v-model="focus" class="form-input" aria-label="중심 캐릭터">
              <option value="">전체 캐릭터</option>
              <option v-for="c in characters" :value="c.id" :key="c.id">
                {{ c.name }}
              </option></select
            ><button class="outline-button" @click="graph = !graph">
              {{ graph ? "목록 보기" : "관계도 보기" }}
            </button>
            <template v-if="graph">
              <button
                class="secondary-button"
                aria-label="전체 보기"
                title="전체 보기"
                @click="relationshipGraph?.fit()"
              >
                <span class="relationship-action-icon" aria-hidden="true"
                  >⛶</span
                ><span class="relationship-action-label">전체 보기</span>
              </button>
              <button
                class="secondary-button"
                aria-label="자동 배치"
                title="자동 배치"
                @click="relationshipGraph?.layout()"
              >
                <span class="relationship-action-icon" aria-hidden="true"
                  >⇄</span
                ><span class="relationship-action-label">자동 배치</span>
              </button>
              <button
                class="secondary-button relationship-zoom"
                aria-label="확대"
                title="확대"
                @click="relationshipGraph?.zoomIn()"
              >
                ＋
              </button>
              <button
                class="secondary-button relationship-zoom"
                aria-label="축소"
                title="축소"
                @click="relationshipGraph?.zoomOut()"
              >
                −
              </button>
            </template>
            <button
              v-if="mine.length"
              class="primary-button relationship-propose"
              @click="editRelation()"
            >
              ＋ 관계 제안
            </button>
          </div>
          <RelationshipGraph
            v-if="graph"
            ref="relationshipGraph"
            :characters="characters"
            :relationships="relationships"
            :dark="dark"
            :focus="focus"
          />
          <div v-else>
            <article
              v-for="r in filteredRelations"
              :key="r.id"
              class="card relation-row"
            >
              <router-link
                :to="'/characters/' + r.source_id"
                class="character-themed character-name"
                :style="characterTheme(byId(r.source_id))"
                >{{ name(r.source_id) }}</router-link
              >
              {{ r.directed ? "→" : "↔" }}
              <router-link
                :to="'/characters/' + r.target_id"
                class="character-themed character-name"
                :style="characterTheme(byId(r.target_id))"
                >{{ name(r.target_id) }}</router-link
              >
              <h3>{{ r.name }}</h3>
              <p class="prose">{{ r.description }}</p>
              <router-link
                v-if="r.status === 'approved'"
                :to="'/relationships/' + r.id"
                class="outline-button"
                >두 캐릭터의 관계 페이지 ↗</router-link
              >
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
                  관계 수락</button
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
              <header
                v-if="['art', 'story'].includes(post.category)"
                class="art-detail-meta"
              >
                <h2>{{ post.title }}</h2>
                <span class="art-meta-divider" aria-hidden="true">/</span>
                <p class="art-detail-byline">
                  {{ owner(post.owner_id) }} ·
                  <time :datetime="post.created_at">{{
                    date(post.created_at)
                  }}</time>
                </p>
                <template v-if="post.character_ids.length">
                  <span class="art-meta-divider" aria-hidden="true">/</span>
                  <div
                    class="art-detail-tags"
                    role="group"
                    aria-label="태그한 캐릭터"
                  >
                    <router-link
                      v-for="id in post.character_ids"
                      :key="id"
                      :to="'/characters/' + id"
                      class="badge character-themed character-name"
                      :style="characterTheme(byId(id))"
                      >{{ name(id) }}</router-link
                    >
                  </div>
                </template>
              </header>
              <template v-else>
                <span class="eyebrow">{{ categoryLabel(post.category) }}</span>
                <h2>{{ post.title }}</h2>
                <p class="muted">
                  <router-link
                    v-if="post.character_id && byId(post.character_id)"
                    :to="'/characters/' + post.character_id"
                    class="character-themed character-name"
                    :style="characterTheme(byId(post.character_id))"
                    >{{ name(post.character_id) }}</router-link
                  ><span v-else>{{ owner(post.owner_id) }}</span> ·
                  {{ date(post.created_at) }}
                </p>
              </template>
              <MentionText :text="post.body" :characters="characters" />
              <p
                v-if="
                  !['art', 'story'].includes(post.category) &&
                  post.character_ids.length
                "
              >
                <router-link
                  v-for="id in post.character_ids"
                  :key="id"
                  :to="'/characters/' + id"
                  class="badge character-themed character-name"
                  :style="characterTheme(byId(id))"
                  >{{ name(id) }}</router-link
                >
              </p>
              <ImageSlider
                :items="postMedia(post.id)"
                :label="post.title"
                :can-delete="own"
                @remove="(id) => (deleteTarget = { table: 'media', id })"
              />
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
              :me="viewMe"
              @submit="
                (data, done) => submitComment(data, { post_id: post.id }, done)
              "
              @remove="
                (id) => (deleteTarget = { table: 'comments', id })
              " /></template
          ><template v-else-if="route.path.split('/').length === 3"
            ><div
              v-if="category !== 'art'"
              class="section-heading board-actions"
            >
              <button
                v-if="category !== 'notice' || admin"
                class="primary-button"
                @click="editPost()"
              >
                ＋ 글 작성
              </button>
            </div>
            <LogBoard
              v-if="category === 'art'"
              :posts="posts"
              :media="media"
              :characters="characters"
              :members="members"
              @create="editPost()"
            />
            <div v-else>
              <router-link
                v-for="p in posts
                  .filter((p) => p.category === category)
                  .slice()
                  .reverse()"
                :key="p.id"
                class="card post-row"
                :to="'/board/' + category + '/' + p.id"
              >
                <div class="post-list-summary">
                  <div>
                    <h3>{{ p.title }}</h3>
                    <span class="muted"
                      >{{ name(p.character_id) || owner(p.owner_id) }} ·
                      {{ date(p.created_at) }}</span
                    >
                  </div>
                  <span aria-hidden="true">↗</span>
                </div>
              </router-link>
            </div>
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
        <template v-else-if="route.path === '/profile'">
          <section class="card profile-settings" aria-label="내 프로필 설정">
            <header class="profile-settings-heading">
              <p class="profile-account">
                <span>로그인 계정</span><span>{{ me.email }}</span>
              </p>
            </header>
            <div
              v-if="canAdmin"
              class="profile-access-mode"
              role="group"
              aria-label="이용 모드 선택"
            >
              <span>이용 모드</span>
              <button
                type="button"
                class="outline-button"
                :aria-pressed="!administratorMode"
                :disabled="busy"
                @click="switchAccessMode(false)"
              >
                일반 회원 모드
              </button>
              <button
                type="button"
                class="outline-button"
                :aria-pressed="administratorMode"
                :disabled="busy"
                @click="switchAccessMode(true)"
              >
                관리자 모드
              </button>
            </div>
            <form
              class="profile-settings-form"
              @submit.prevent="act(saveNickname)"
            >
              <div class="profile-settings-fields">
                <label class="profile-field" for="profile-nickname">
                  <span>오너 닉네임</span>
                  <input
                    id="profile-nickname"
                    v-model="nickname"
                    class="form-input"
                    required
                    maxlength="80"
                    autocomplete="nickname"
                    :disabled="busy"
                  />
                </label>
                <div class="profile-field">
                  <label for="profile-representative">대표 캐릭터</label>
                  <div class="profile-select">
                    <select
                      id="profile-representative"
                      v-model="representativeId"
                      class="form-input"
                      aria-describedby="profile-representative-help"
                      :disabled="busy"
                    >
                      <option :value="null">선택하지 않음</option>
                      <option v-for="c in mine" :key="c.id" :value="c.id">
                        {{ c.name }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
              <router-link
                v-if="byId(representativeId)"
                :to="'/characters/' + representativeId"
                class="profile-representative"
                aria-label="선택한 대표 캐릭터 소개 보기"
              >
                <Portrait :character="byId(representativeId)" />
                <span
                  ><small>대표 캐릭터 미리보기</small
                  ><strong>{{ name(representativeId) }}</strong
                  ><small>캐릭터 소개 보기 ↗</small></span
                >
              </router-link>
              <p id="profile-representative-help" class="profile-help">
                오너 이름으로 남긴 댓글에는 대표 캐릭터 프사가 표시됩니다.
                프사를 누르면 캐릭터 소개로 이동합니다.
              </p>
              <p v-if="!mine.length" class="profile-help">
                캐릭터를 등록하면 대표 캐릭터를 선택할 수 있습니다.
              </p>
              <div class="profile-settings-actions">
                <button class="primary-button" :disabled="busy">
                  {{ busy ? "저장 중…" : "프로필 저장" }}
                </button>
              </div>
            </form>
          </section>
          <section class="card menu-guide" aria-labelledby="menu-guide-title">
            <h2 id="menu-guide-title">사이트 메뉴 안내</h2>
            <dl>
              <dt><router-link to="/home">⌂ 메인</router-link></dt>
              <dd>최근 공지와 캐릭터·관계·이야기 현황을 확인합니다.</dd>
              <dt><router-link to="/characters">♙ 캐릭터</router-link></dt>
              <dd>
                캐릭터를 등록하고 프로필과 설정을 작성합니다. 다른 캐릭터의
                소개를 보고 호감도·관계·교류 기록을 남길 수 있습니다.
              </dd>
              <dt><router-link to="/affection">♥ 호감도</router-link></dt>
              <dd>
                캐릭터 사이의 호감도 점수와 감정 설명을 한곳에서 확인합니다. 내
                캐릭터가 보낸·받은 기록, 캐릭터별 필터와 점수순·최근 수정순
                정렬을 사용할 수 있습니다.
              </dd>
              <dt><router-link to="/relationships">◇ 관계도</router-link></dt>
              <dd>
                캐릭터 사이의 관계를 제안하고 수락합니다. 서로 확인한 관계는
                관계도와 목록에 표시됩니다.
              </dd>
              <dt><router-link to="/board/story">▤ 썰 게시판</router-link></dt>
              <dd>
                캐릭터의 이야기와 썰을 나눕니다. 여러 캐릭터를 태그하고 댓글로
                교류할 수 있습니다.
              </dd>
              <dt><router-link to="/board/art">▧ 로그</router-link></dt>
              <dd>
                그림과 교류 로그를 올립니다. 글 목록·이미지 보기로 전환할 수
                있으며, 글마다 이미지를 최대 10장 첨부할 수 있으며, 일반
                이미지는 WebP로 압축하고 GIF는 원본 애니메이션을 유지합니다.
              </dd>
              <dt><router-link to="/board/notice">▣ 공지</router-link></dt>
              <dd>
                사이트 이용과 운영에 관한 공지를 확인합니다. 관리자가
                작성합니다.
              </dd>
              <dt><router-link to="/profile">○ 내 프로필</router-link></dt>
              <dd>
                오너 닉네임과 대표 캐릭터를 설정합니다. 오너 이름으로 쓴
                댓글에는 대표 캐릭터 프사가 표시되며, 프사를 누르면 캐릭터
                소개로 이동합니다.
              </dd>
              <dt>🔔 상단 알림</dt>
              <dd>
                새 글·댓글, 내 캐릭터 태그와 내 글의 반응을 확인합니다.
                알림창에서 브라우저 알림을 허용하고 이 기기에서 받을 알림 종류를
                선택할 수 있습니다.
              </dd>
              <template v-if="admin">
                <dt><router-link to="/admin">⚙ 운영 관리</router-link></dt>
                <dd>
                  회원을 초대하고 일반 회원의 접근을 관리합니다.<template
                    v-if="superAdmin"
                  >
                    최고 관리자는 관리자 지정·해제와 DB 내보내기·변경 기록
                    조회·복구도 할 수 있습니다.</template
                  >
                </dd>
              </template>
            </dl>
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
                <span class="badge">{{ roleLabel(member.role) }}</span></span
              ><button
                v-if="canManageMember(member)"
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
              <button
                v-if="
                  superAdmin &&
                  member.id !== me.id &&
                  member.role !== 'superadmin'
                "
                class="outline-button"
                :disabled="busy"
                @click="act(() => changeMemberRole(member))"
              >
                {{
                  member.role === "admin"
                    ? "일반 회원으로 변경"
                    : "관리자로 지정"
                }}
              </button>
            </article>
          </section>
          <section v-if="superAdmin" class="card">
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
          <section v-if="superAdmin" class="card">
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
  <div v-if="modal" class="modal-overlay">
    <section
      class="modal editor"
      role="dialog"
      aria-modal="true"
      :aria-label="modalTitle"
    >
      <div class="modal-head">
        <h2>{{ modalTitle }}</h2>
        <button
          class="secondary-button"
          :disabled="busy"
          @click="modal = ''"
          aria-label="닫기"
        >
          ×
        </button>
      </div>
      <form @submit.prevent="act(submitDraft)">
        <fieldset :disabled="busy" class="editor-fields">
          <template v-if="modal === 'character'">
            <CharacterPortraitEditor
              v-model="draft.extra.portrait_history"
              v-model:image-path="draft.image_path"
              :name="draft.name"
              :color="portraitColor(draft)"
              :file="file"
              @select="file = $event"
            >
              <template #gallery>
                <CharacterMiniGallery
                  :items="draftGalleryImages"
                  editable
                  @select="selectGalleryImages"
                  @remove="removeGalleryImage"
                />
              </template>
              <CharacterThemePicker
                v-model="draft.extra.theme_color"
                :name="draft.name"
              />
            </CharacterPortraitEditor>
            <RecruitmentEditor v-model="draft.extra" />
            <div class="character-profile-fields">
              <label
                v-for="f in profileFields"
                :key="f.key"
                :style="{ '--profile-field-span': f.span || 12 }"
                :class="{
                  'character-profile-field-wide': f.long || f.key === 'quote',
                }"
                >{{ f.label }}
                <select
                  v-if="f.options"
                  :value="fieldValue(draft, f)"
                  @change="setField(f, $event.target.value)"
                  class="form-input"
                >
                  <option value="" :disabled="f.key === 'affiliation_type'">
                    선택
                  </option>
                  <option
                    v-for="option in f.options"
                    :key="option"
                    :value="option"
                  >
                    {{ f.optionLabels?.[option] || option }}
                  </option>
                  <option
                    v-if="
                      fieldValue(draft, f) &&
                      !f.options.includes(fieldValue(draft, f))
                    "
                    :value="fieldValue(draft, f)"
                  >
                    {{ fieldValue(draft, f) }} (기존 입력)
                  </option>
                </select>
                <textarea
                  v-else-if="f.long"
                  :value="fieldValue(draft, f)"
                  @input="setField(f, $event.target.value)"
                  class="form-textarea"
                  rows="4"
                ></textarea>
                <input
                  v-else
                  :value="fieldValue(draft, f)"
                  @input="setField(f, $event.target.value)"
                  class="form-input"
                  :required="f.key === 'name'"
                  :maxlength="f.key === 'name' ? 120 : undefined"
                />
              </label>
            </div>
            <p class="muted">비밀 설정도 로그인한 오너들에게 공유됩니다.</p>
            <h3>오너란</h3>
            <label v-for="f in ownerFields" :key="f.key"
              >{{ f.label }}
              <textarea
                v-if="f.long"
                :value="fieldValue(draft, f)"
                @input="setField(f, $event.target.value)"
                class="form-textarea"
                rows="4"
              ></textarea>
              <input
                v-else
                :value="fieldValue(draft, f)"
                @input="setField(f, $event.target.value)"
                class="form-input"
              />
            </label>
          </template>
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
                  v-for="c in characters.filter(
                    (c) => c.id !== draft.source_id,
                  )"
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
          <template v-if="modal === 'post'">
            <section
              v-if="draft.category === 'art'"
              class="post-attachments"
              aria-label="이미지 첨부"
            >
              <h3>
                이미지 첨부 <small>{{ postImageCount }} / 10</small>
              </h3>
              <input
                id="post-images"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif"
                :disabled="postImageCount >= 10"
                @change="selectPostImages"
              />
              <div class="post-image-slots">
                <div
                  v-for="(slot, index) in postImageSlots"
                  :key="index"
                  class="post-image-slot"
                >
                  <template v-if="slot">
                    <img
                      :src="slot.preview || slot.image"
                      :alt="
                        slot.name ||
                        slot.caption ||
                        '첨부 이미지 ' + (index + 1)
                      "
                    />
                    <span>{{ index + 1 }}</span>
                    <button
                      type="button"
                      :aria-label="index + 1 + '번 이미지 제외'"
                      @click="removePostImage(slot)"
                    >
                      ×
                    </button>
                  </template>
                  <label
                    v-else
                    for="post-images"
                    :aria-label="index + 1 + '번 이미지 첨부'"
                    >＋<small>{{ index + 1 }}</small></label
                  >
                </div>
              </div>
              <p class="muted">
                최대 10장 · 일반 이미지는 WebP 압축 · GIF는 원본 애니메이션 유지
                (10MB 이하)
              </p>
            </section>
            <label
              >제목<input
                v-model="draft.title"
                class="form-input"
                required
                maxlength="200" /></label
            ><label
              >작성 캐릭터<select
                v-model="draft.character_id"
                class="form-input"
              >
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
            ><label>태그할 캐릭터 (여러 명 선택 가능)</label>
            <div class="character-tags" role="group" aria-label="태그할 캐릭터">
              <label
                v-for="c in characters"
                :key="c.id"
                class="character-themed character-name"
                :style="characterTheme(c)"
                ><input
                  type="checkbox"
                  v-model="draft.character_ids"
                  :value="c.id"
                />
                {{ c.name }} <small>· {{ owner(c.owner_id) }}</small></label
              >
            </div>
          </template>
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
            ><button
              type="button"
              class="secondary-button"
              :disabled="busy"
              @click="modal = ''"
            >
              × 닫기
            </button>
          </div>
        </fieldset>
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
      <div class="modal-head">
        <h3>이 기록을 삭제할까요?</h3>
        <button
          class="secondary-button"
          :disabled="busy"
          @click="deleteTarget = null"
          aria-label="삭제 확인 닫기"
        >
          ×
        </button>
      </div>
      <div class="modal-body">
        <p>
          목록에서 숨겨지며, 최고 관리자가 변경 기록에서 복구할 수 있습니다.
        </p>
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
import {
  accountRole,
  canUseAdminMode,
  readAdminMode,
  rememberAdminMode,
  setRequestMode,
  getRequestMode,
  memberForMode,
} from "./access-mode.mjs";
import { createLiveUpdates } from "./live-updates.mjs";
import { createImageCache } from "./image-cache.mjs";
import Portrait from "./Portrait.vue";
import CodexHero from "./CodexHero.vue";
import CodexIcon from "./CodexIcon.vue";
import CharacterCard from "./CharacterCard.vue";
import CharacterThemePicker from "./CharacterThemePicker.vue";
import CharacterMiniGallery from "./CharacterMiniGallery.vue";
import CharacterPortraitEditor from "./CharacterPortraitEditor.vue";
import RecruitmentStatus from "./RecruitmentStatus.vue";
import RecruitmentEditor from "./RecruitmentEditor.vue";
import CharacterQuestions from "./CharacterQuestions.vue";
import RelationshipArchive from "./RelationshipArchive.vue";
const RoleplayView = defineAsyncComponent(() => import("./RoleplayView.vue"));
const RoleplayRecords = defineAsyncComponent(() =>
  import("./RoleplayRecords.vue"),
);
import {
  affiliationOptions,
  affiliationType,
  affiliationLabel,
} from "./affiliation.mjs";
import { recruitmentOptions } from "./recruitment.mjs";
import { characterTheme, portraitColor } from "./character-theme.mjs";
import AccountControls from "./AccountControls.vue";
import ImageSlider from "./ImageSlider.vue";
import LogBoard from "./LogBoard.vue";
import AffectionList from "./AffectionList.vue";
import NotificationCenter from "./NotificationCenter.vue";
import { notificationPath } from "./notificationRoutes.mjs";
import { validateAttachments } from "./image.mjs";
import MentionText from "./MentionText.vue";
const RelationshipGraph = defineAsyncComponent(() =>
  import("./RelationshipGraph.vue"),
);
import CommentsPanel from "./CommentsPanel.vue";
const navigationOpen = ref(false);
const route = useRoute(),
  router = useRouter();
const me = ref(null),
  members = ref([]),
  characters = ref([]),
  relationships = ref([]),
  affection = ref([]),
  posts = ref([]),
  comments = ref([]),
  questions = ref([]),
  media = ref([]),
  history = ref([]);
const notificationVersion = ref(0),
  roleplayVersion = ref(0),
  profileTab = ref("profile"),
  liveStatus = ref("connecting");
const busy = ref(false),
  loading = ref(true),
  error = ref(""),
  message = ref(""),
  dark = ref(false),
  administratorMode = ref(false),
  modal = ref(""),
  draft = ref({}),
  file = ref(null),
  postFiles = ref([]),
  galleryFiles = ref([]),
  removedGalleryImages = ref([]),
  removedPostImages = ref([]),
  deleteTarget = ref(null),
  search = ref(""),
  recruitmentFilter = ref(""),
  faction = ref(""),
  relationshipGraph = ref(null),
  focus = ref(""),
  graph = ref(true),
  affSource = ref(""),
  affValue = ref(0),
  affNote = ref(""),
  nickname = ref(""),
  representativeId = ref(null),
  inviteEmail = ref(""),
  inviteName = ref("");
let urls = [],
  liveUpdates = null,
  refreshTask = null,
  refreshAgain = false,
  livePending = false,
  liveSyncing = false,
  pageClosed = false;
const imageCache = createImageCache(imageBlob);
const localDevelopment = process.env.NODE_ENV === "development";
const authError = new URLSearchParams(location.search).get("auth_error");
const navigation = [
  { path: "/home", icon: "tower", label: "메인" },
  { path: "/characters", icon: "people", label: "캐릭터" },
  { path: "/relationships", icon: "relation", label: "관계도" },
  { path: "/affection", icon: "affection", label: "호감도" },
  { path: "/roleplay", icon: "quill", label: "역극" },
  { path: "/board/story", icon: "book", label: "썰 게시판" },
  { path: "/board/art", icon: "image", label: "로그" },
  { path: "/board/notice", icon: "edict", label: "공지" },
  { path: "/profile", icon: "profile", label: "내 프로필" },
];
const races = ["인간", "엘프", "드워프", "쿠나리"];
const extraFields = [
  { key: "quote", label: "한 마디" },
  { key: "affiliation", label: "소속" },
  { key: "affiliation_type", label: "소속" },
  {
    key: "circle_faction",
    label: "파벌",
    options: ["마탑 수호파", "중립", "자유파"],
  },
  { key: "motivation", label: "마탑에 들어온 동기 / 결핍·콤플렉스" },
  { key: "appearance", label: "외관" },
  { key: "other", label: "기타 설정" },
  { key: "relationship_direction", label: "희망하는 자관 방향" },
];
const profileFields = [
  { key: "name", label: "이름", span: 4 },
  { key: "race", label: "종족", options: races, span: 2 },
  { key: "age", label: "나이", span: 2 },
  { key: "origin", label: "출신지", span: 4 },
  {
    key: "affiliation_type",
    label: "소속",
    extra: true,
    span: 3,
    options: affiliationOptions.map((option) => option.value),
    optionLabels: Object.fromEntries(
      affiliationOptions.map((option) => [option.value, option.label]),
    ),
  },
  { key: "position", label: "직책", span: 3 },
  {
    ...extraFields.find((f) => f.key === "circle_faction"),
    extra: true,
    span: 3,
  },
  { key: "quote", label: "한 마디", extra: true },
  {
    ...extraFields.find((f) => f.key === "appearance"),
    extra: true,
    long: true,
  },
  { key: "personality", label: "성격 · 키워드 서술", long: true },
  { key: "background", label: "배경 이야기", long: true },
  {
    ...extraFields.find((f) => f.key === "motivation"),
    extra: true,
    long: true,
  },
  { key: "goals", label: "목표와 가치관", long: true },
  { key: "other", label: "기타 설정", extra: true, long: true },
  {
    key: "secrets",
    label: "비밀 설정 (캐릭터에게 비밀 · 오너끼리는 공유)",
    long: true,
  },
];
const ownerFields = [
  {
    ...extraFields.find((f) => f.key === "relationship_direction"),
    extra: true,
    long: true,
  },
];
function fieldValue(row, field) {
  if (field.key === "affiliation_type") return affiliationType(row);
  return field.extra ? row.extra?.[field.key] || "" : row[field.key] || "";
}
function fieldDisplayValue(row, field) {
  const value = fieldValue(row, field);
  return field.optionLabels?.[value] || value;
}
function setField(field, value) {
  if (field.extra) draft.value.extra[field.key] = value;
  else draft.value[field.key] = value;
}
const representative = computed(() =>
  byId(me.value?.representative_character_id),
);
const canAdmin = computed(() => canUseAdminMode(me.value));
const superAdmin = computed(
  () => administratorMode.value && accountRole(me.value) === "superadmin",
);
const viewMe = computed(() => memberForMode(me.value, administratorMode.value));
const admin = computed(() => canAdmin.value && administratorMode.value),
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
        (!faction.value || affiliationType(c) === faction.value) &&
        (!recruitmentFilter.value ||
          c.extra?.recruitment_status === recruitmentFilter.value) &&
        (!search.value ||
          c.name.toLowerCase().includes(search.value.toLowerCase())),
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
      (r) => !focus.value || [r.source_id, r.target_id].includes(focus.value),
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
function roleLabel(role) {
  return (
    { superadmin: "최고 관리자", admin: "관리자", member: "회원" }[role] ||
    "회원"
  );
}
function canManageMember(member) {
  return (
    member.id !== me.value?.id &&
    member.role !== "superadmin" &&
    (superAdmin.value || member.role === "member")
  );
}
async function changeMemberRole(member) {
  await save("members", {
    ...member,
    role: member.role === "admin" ? "member" : "admin",
  });
  await refresh();
}
function statusLabel(s) {
  return { pending: "제안 중", approved: "승인됨", rejected: "거절됨" }[s];
}
function date(s) {
  return new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}
function postMedia(postId) {
  return media.value.filter((item) => item.post_id === postId);
}
function categoryLabel(s) {
  return { story: "썰 게시판", art: "로그", notice: "공지" }[s] || "게시판";
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
async function switchAccessMode(enabled) {
  if (!canAdmin.value || busy.value || administratorMode.value === enabled)
    return;
  await act(async () => {
    administratorMode.value = enabled;
    setRequestMode(enabled ? "admin" : "member");
    rememberAdminMode(me.value, enabled);
    modal.value = "";
    deleteTarget.value = null;
    members.value = [];
    history.value = [];
    clearUrls();
    me.value = await request("/me");
    if (!enabled && route.path === "/admin") await router.replace("/home");
    await refresh();
  });
}
watch(canAdmin, (allowed) => {
  if (!allowed) {
    administratorMode.value = false;
    setRequestMode("member");
  }
});
function clearUrls() {
  imageCache.clear();
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
}
function refresh() {
  if (refreshTask) {
    refreshAgain = true;
    return refreshTask;
  }
  refreshTask = (async () => {
    do {
      refreshAgain = false;
      await refreshOnce();
    } while (refreshAgain && me.value && !pageClosed);
  })().finally(() => {
    refreshTask = null;
  });
  return refreshTask;
}
async function refreshOnce() {
  const memberId = me.value?.id;
  const mode = getRequestMode();
  const data = await request("/data");
  if (mode !== getRequestMode()) {
    refreshAgain = true;
    return;
  }
  if (pageClosed || !memberId || me.value?.id !== memberId) return;
  const paths = [
    ...new Set(
      [
        ...data.characters.map((c) => c.image_path),
        ...data.media.map((m) => m.path),
      ].filter(Boolean),
    ),
  ];
  const images = await imageCache.resolve(paths);
  if (mode !== getRequestMode()) {
    refreshAgain = true;
    return;
  }
  if (pageClosed || me.value?.id !== memberId) return;
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls = [];
  characters.value = data.characters.map((c) => ({
    ...c,
    image: images[c.image_path] || "",
  }));
  media.value = data.media.map((m) => ({ ...m, image: images[m.path] || "" }));
  members.value = data.members;
  const currentMember = data.members.find((member) => member.id === memberId);
  if (currentMember)
    me.value = {
      ...me.value,
      ...currentMember,
      account_role: currentMember.role,
    };
  relationships.value = data.relationships;
  affection.value = data.affection;
  posts.value = data.posts;
  comments.value = data.comments;
  questions.value = data.questions || [];
}
async function logout() {
  await request("/auth/logout", { method: "POST" });
  me.value = null;
  clearUrls();
  characters.value = [];
  posts.value = [];
  comments.value = [];
  questions.value = [];
  relationships.value = [];
  media.value = [];
}
function editCharacter(c) {
  clearGalleryPreviews();
  removedGalleryImages.value = [];
  draft.value = c
    ? { ...c }
    : { name: "", alias: "", faction: "mage", extra: {} };
  draft.value.extra = { ...(c?.extra || {}) };
  draft.value.extra.portrait_history = [...(c?.extra?.portrait_history || [])];
  if (
    c?.image_path &&
    !draft.value.extra.portrait_history.some(
      (image) => image.path === c.image_path,
    )
  ) {
    draft.value.extra.portrait_history.push({
      path: c.image_path,
      created_at: c.updated_at || c.created_at,
    });
  }
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
  file.value = null;
  clearPostPreviews();
  removedPostImages.value = [];
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
const existingPostImages = computed(() =>
  media.value.filter(
    (m) =>
      m.post_id === draft.value.id && !removedPostImages.value.includes(m.id),
  ),
);
const postImageCount = computed(
  () => existingPostImages.value.length + postFiles.value.length,
);
const postImageSlots = computed(() =>
  Array.from(
    { length: 10 },
    (_, index) =>
      [...existingPostImages.value, ...postFiles.value][index] || null,
  ),
);
function characterGallery(characterId) {
  return characterId
    ? media.value.filter(
        (image) => image.character_id === characterId && !image.post_id,
      )
    : [];
}
const draftGalleryImages = computed(() => [
  ...characterGallery(draft.value.id).filter(
    (image) => !removedGalleryImages.value.includes(image.id),
  ),
  ...galleryFiles.value,
]);
function clearGalleryPreviews() {
  galleryFiles.value.forEach((image) => URL.revokeObjectURL(image.image));
  galleryFiles.value = [];
}
function selectGalleryImages(files) {
  try {
    validateAttachments(files, draftGalleryImages.value.length);
    galleryFiles.value.push(
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        caption: file.name,
        image: URL.createObjectURL(file),
      })),
    );
    error.value = "";
  } catch (e) {
    error.value = e.message;
  }
}
function removeGalleryImage(image) {
  if (image.file) {
    URL.revokeObjectURL(image.image);
    galleryFiles.value = galleryFiles.value.filter(
      (item) => item.id !== image.id,
    );
  } else removedGalleryImages.value.push(image.id);
}
function clearPostPreviews() {
  postFiles.value.forEach((item) => URL.revokeObjectURL(item.preview));
  postFiles.value = [];
}
function removePostImage(slot) {
  if (slot.file) {
    const index = postFiles.value.indexOf(slot);
    if (index >= 0) {
      URL.revokeObjectURL(slot.preview);
      postFiles.value.splice(index, 1);
    }
  } else {
    removedPostImages.value.push(slot.id);
  }
}
function selectPostImages(event) {
  try {
    const files = Array.from(event.target.files || []);
    validateAttachments(files, postImageCount.value);
    postFiles.value.push(
      ...files.map((file) => ({
        file,
        name: file.name,
        preview: URL.createObjectURL(file),
      })),
    );
    error.value = "";
  } catch (e) {
    error.value = e.message;
  }
  event.target.value = "";
}
watch(modal, (value, previous) => {
  if (previous === "post" && value !== "post") clearPostPreviews();
  if (previous === "character" && value !== "character") clearGalleryPreviews();
});
async function submitDraft() {
  let table = {
    character: "characters",
    relationship: "relationships",
    post: "posts",
    media: "media",
  }[modal.value];
  const value = { ...draft.value };
  if (modal.value === "character") {
    value.extra = { ...draft.value.extra };
    if (file.value) {
      value.image_path = await upload(file.value);
      draft.value.image_path = value.image_path;
      file.value = null;
    }
  }
  if (modal.value === "media") {
    if (!file.value) throw new Error("이미지를 선택하세요.");
    value.path = await upload(file.value);
    value.bytes = file.value.size;
    value.mime = file.value.type;
  }
  if (table === "posts" && value.category === "art")
    validateAttachments([], postImageCount.value);
  const saved = await save(table, value);
  if (table === "characters") {
    // Retain the saved revision and remaining attachments if a later upload fails.
    draft.value = { ...saved, extra: { ...saved.extra } };
    for (const imageId of [...removedGalleryImages.value]) {
      await remove("media", imageId);
      media.value = media.value.filter((image) => image.id !== imageId);
      removedGalleryImages.value = removedGalleryImages.value.filter(
        (id) => id !== imageId,
      );
    }
    while (galleryFiles.value.length) {
      const image = galleryFiles.value[0];
      image.path ||= await upload(image.file);
      const attached = await save("media", {
        character_id: saved.id,
        path: image.path,
        caption: image.caption,
      });
      const preview = await imageBlob(attached.path).catch(() => "");
      if (preview) urls.push(preview);
      media.value.push({ ...attached, image: preview });
      URL.revokeObjectURL(image.image);
      galleryFiles.value.shift();
    }
  }
  if (table === "posts") {
    draft.value = { ...saved, character_ids: [...saved.character_ids] };
    for (const imageId of [...removedPostImages.value]) {
      await remove("media", imageId);
      media.value = media.value.filter((m) => m.id !== imageId);
      removedPostImages.value = removedPostImages.value.filter(
        (id) => id !== imageId,
      );
    }
    while (postFiles.value.length) {
      const attachment = postFiles.value[0];
      attachment.path ||= await upload(attachment.file);
      const attached = await save("media", {
        post_id: saved.id,
        path: attachment.path,
        caption: attachment.name,
      });
      const preview = await imageBlob(attached.path).catch(() => "");
      if (preview) urls.push(preview);
      media.value.push({ ...attached, image: preview });
      URL.revokeObjectURL(attachment.preview);
      postFiles.value.shift();
    }
  }
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
function createPairPost({ category: postCategory, character_ids }) {
  editPost();
  draft.value.category = postCategory;
  draft.value.character_ids = [...character_ids];
}
async function submitQuestion(value, done) {
  if (busy.value) {
    done(false, "다른 작업이 끝난 뒤 다시 시도해 주세요.");
    return;
  }
  await act(async () => {
    try {
      await save("questions", value);
      await refresh();
      done(true);
    } catch (error) {
      done(false, error.message);
      throw error;
    }
  });
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
    body: JSON.stringify({
      nickname: nickname.value,
      representative_character_id: representativeId.value,
    }),
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
async function syncLiveData() {
  if (!me.value || pageClosed) return;
  if (busy.value || modal.value || liveSyncing) {
    livePending = true;
    return;
  }
  livePending = false;
  liveSyncing = true;
  try {
    await refresh();
  } catch (e) {
    if (e.message.includes("로그인")) {
      me.value = null;
      clearUrls();
    }
    error.value = e.message;
  } finally {
    liveSyncing = false;
    if (livePending && !busy.value && !modal.value && me.value)
      queueMicrotask(syncLiveData);
  }
}
watch([busy, modal], () => {
  if (livePending && !busy.value && !modal.value) syncLiveData();
});
watch(
  () => me.value?.id,
  (value) => {
    if (!value) {
      liveUpdates?.stop();
      liveUpdates = null;
      livePending = false;
    }
  },
);
onMounted(async () => {
  try {
    const account = await request("/me");
    administratorMode.value = readAdminMode(account);
    setRequestMode(administratorMode.value ? "admin" : "member");
    me.value = account;
    nickname.value = me.value.nickname;
    representativeId.value = me.value.representative_character_id || null;
    await refresh();
    if (route.path === "/admin" && !admin.value) await router.replace("/home");
    try {
      const destination = notificationPath(
        sessionStorage.getItem("circle-notification-destination"),
      );
      sessionStorage.removeItem("circle-notification-destination");
      if (destination) await router.replace(destination);
    } catch {
      /* Session storage can be disabled in private browsing. */
    }
    liveUpdates = createLiveUpdates({
      onRoleplay: () => {
        roleplayVersion.value++;
      },
      onData: syncLiveData,
      onNotifications: () => {
        notificationVersion.value++;
      },
      onStatus: (value) => {
        liveStatus.value = value;
      },
      onUnauthorized: () => {
        me.value = null;
        clearUrls();
        error.value = "로그인이 만료되었거나 접근이 차단되었습니다.";
      },
    });
  } catch (e) {
    error.value = e.message;
    if (!me.value) {
      try {
        const destination = notificationPath(route.path);
        if (destination)
          sessionStorage.setItem(
            "circle-notification-destination",
            destination,
          );
      } catch {
        /* Keep the login screen usable if storage is disabled. */
      }
    }
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => {
  pageClosed = true;
  liveUpdates?.stop();
  clearPostPreviews();
  clearGalleryPreviews();
  clearUrls();
});
</script>
