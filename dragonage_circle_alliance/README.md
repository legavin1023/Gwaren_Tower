# 마탑의 기록 · Dragon Age Circle Alliance

기존 GM 아카이빙 사이트를 보존하면서 별도 폴더에 만든 비공개 캐릭터 동맹입니다.
Vue 3 / Vue Router / Cytoscape.js + Cloudflare Pages / Workers / D1 / 비공개 R2를 사용합니다.

원본의 리디바탕, 테마 변수, 카드·버튼·사이드바·반응형 CSS와 App.vue를 재사용합니다.
`upstream/`은 작업 시작 시점의 원본 소스 복사본이며 운영 접속 키·데이터는 포함하지 않습니다.
기존 운영 폴더 및 Supabase 프로젝트는 수정하지 않았습니다.

## 실행

Node.js 22 이상에서 `npm install` 후 `npm run db:local`, `npm run worker:dev`, 다른 터미널에서 `npm run serve`.
사이트: http://localhost:8090 / API: http://localhost:8787.
Google 로그인은 `.dev.vars.example`을 `worker/.dev.vars`로 복사하고 Google OAuth 설정을 마쳐야 합니다.
빈 DB에서 첫 관리자는 `BOOTSTRAP_ADMIN_EMAIL`에 지정한 Google 계정으로 로그인할 때 생성됩니다.

`npm test`로 권한·관계·멘션·백업 무결성 검사를 실행하고 `npm run build`로 정적 파일을 만듭니다.
배포, Google Sheets/Drive 자동 백업, 복구 방법은 [배포와 백업](docs/배포와-백업.md)을 참고하세요.
분석 및 기존 기능 분류는 [원본 분석](docs/원본-분석.md)을 참고하세요.

## 구현 범위와 실제 연결 상태

- 캐릭터별 진영, 여러 캐릭터 소유, 고유 프로필, 비밀·자유 설정, 이미지 갤러리
- 소유 캐릭터 간 방향별 0~100 호감도, 5 단위 저장
- 관계 제안·승인·거절·재제안, 수정 시 재승인, 동일 오너 즉시 승인
- 승인된 관계 기반 자동 배치·확대·이동 관계도와 목록·진영·종류·중심 필터
- 썰·그림/로그·운영자 공지, 캐릭터 태그, 댓글·대댓글·ID 멘션·프로필 링크
- Google 계정 이메일 등록제, HttpOnly 세션, 서버 권한·Origin 검사, 비공개 이미지
- 소프트 삭제·수정 기록·관리자 복구, DB JSON 내보내기
- Drive 정기 백업·Sheets 실행 기록·SHA-256 검증·분할 이어받기·복구 CLI

Cloudflare 리소스 생성과 Google OAuth·Apps Script 설정은 계정 연결이 필요합니다.
설정 전에는 운영 로그인·실제 원격 저장·정기 백업·공개 배포가 활성화되지 않습니다.
서버 자료는 최초 로딩과 저장 직후 갱신되며, 다른 회원의 변경은 60초 폴링 또는 새로고침으로 반영됩니다.
