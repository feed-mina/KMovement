# BTS 광화문 이벤트 지도 — 기획 문서

> 작성일: 2026-03-20
> 브랜치: `feature/bts-event`
> 이벤트 기간: 2026-03-21 ~ (계속 운영, K-Pop 이벤트마다 재활용)

---

## 1. 프로젝트 개요

BTS 광화문 이벤트 현장 팬들을 위한 실시간 정보 지도 페이지.
- 현장에서 필요한 위치 정보(카페, 충전, 구급, 지하철)를 지도로 제공 (완료 ✅)
- AI 영어/일본어 채팅으로 외국인 팬과의 소통 연습 (완료 ✅ - 5회 제한 및 리다이렉트 포함)
- 팬 소통 게시판 (익명, 다국어) (진행 중 🏗️ - V35 대기)
- 카카오페이 후원 버튼으로 수익화 (완료 ✅)
- SNS 공유 최적화 및 OG 이미지 적용 (완료 ✅)

---

## 2. 아키텍처 결정사항 (Q&A 16개 기반)

| # | 항목 | 결정 |
|---|------|------|
| 1 | 지도 API | 카카오맵 API (JavaScript SDK) |
| 2 | 배포 | Vercel — `bts-gwanghwamun.vercel.app` |
| 3 | 수익화 | 카카오페이 개인 송금 QR 링크 |
| 4 | 데이터 방식 | 카페=카카오 실시간 검색, 충전/구급=AI JSON, CCTV=정적 링크 |
| 5 | 타겟 유저 | BTS 팬 (국내+외국인) — 한/EN 언어 전환 필수 |
| 6 | 지하철 정보 | 정적 추천 루트 3개 + 카카오맵 딥링크 |
| 7 | 디자인 | BTS 보라 계열 (`#7B2D8B`, `#0D0D1A` 다크 배경) |
| 8 | SNS 공유 | 내 위치 공유 + 클립보드 복사 + 트위터/X |
| 9 | URL | Vercel 자동 도메인 |
| 10 | 장소 데이터 | 카카오 API 실시간 + AI 생성 JSON |
| 11 | 프론트 위치 | SDUI 리포 `feature/bts-event` 브랜치, `bts-event/` 폴더 |
| 12 | AI 채팅 | 게스트 5회 무료 → SDUI 회원가입 유도 |
| 13 | 게시판 DB | 신규 `fan_post` 테이블 (V35 마이그레이션) |
| 14 | 게시판 작성 | 익명 (닉네임만 입력) |
| 15 | 게시판 기능 | 글 작성 + 이모지 리액션 + 나라 태그 + 댓글 |
| 16 | 이벤트 종료 후 | 계속 운영 (다음 K-Pop 이벤트 재활용) |
| 17 | 메시징앱 연결 | 카카오톡 공유하기 (SDK 카드형) + LINE 공유 (URL scheme) + 카카오 오픈채팅방 버튼 |

---

## 3. 폴더 구조

```
SDUI/
├── SDUI-server/                   ← 기존 EC2 백엔드 (그대로 사용)
│   └── src/main/java/.../domain/
│       ├── ai/guest/              ← NEW: 게스트 채팅 API
│       └── fanboard/              ← NEW: 팬 게시판 API
├── metadata-project/              ← 기존 SDUI 프론트 (건드리지 않음)
└── bts-event/                     ← NEW: BTS 이벤트 전용 Next.js 앱
    ├── app/
    │   ├── page.tsx               ← 메인 (지도 탭 | AI채팅 탭 | 게시판 탭)
    │   ├── layout.tsx             ← OG 태그, 폰트, BTS 테마
    │   └── globals.css
    ├── components/
    │   ├── Map/
    │   │   ├── KakaoMap.tsx       ← 지도 컴포넌트 (dynamic import, SSR off)
    │   │   └── LayerFilter.tsx    ← ☕🔋🏥🚇 마커 레이어 토글
    │   ├── Chat/
    │   │   └── GuestChat.tsx      ← AI 채팅 (5회 제한, localStorage)
    │   ├── Board/
    │   │   ├── FanBoard.tsx       ← 게시판 목록
    │   │   ├── PostCard.tsx       ← 글 카드 (나라 태그, 리액션, 댓글)
    │   │   ├── WriteModal.tsx     ← 글 작성 모달
    │   │   └── CommentSection.tsx ← 댓글
    │   ├── InfoPanel.tsx          ← 하단 패널 (CCTV, SNS 공유, 후원)
    │   └── LangToggle.tsx         ← 한/EN 전환
    ├── lib/
    │   ├── api.ts                 ← EC2 백엔드 API 호출
    │   └── guestLimit.ts          ← localStorage 5회 카운트
    ├── data/
    │   └── locations.json         ← 충전소, 구급 텐트, 지하철 루트 정적 데이터
    ├── public/
    │   └── og-image.png           ← 카카오/트위터 공유 미리보기
    ├── next.config.ts
    ├── package.json
    └── .env.local
        ├── NEXT_PUBLIC_KAKAO_APP_KEY=
        └── NEXT_PUBLIC_API_BASE=https://[EC2 호스트]
```

---

## 4. 화면 구성

### 4-1. 메인 탭 — 지도

```
┌──────────────────────────────────────────┐
│  💜 BTS 광화문  [지도] [채팅] [게시판]  [EN]  │
├──────────────────────────────────────────┤
│  [☕24h카페] [🔋충전] [🏥구급] [🚇지하철]       │
├──────────────────────────────────────────┤
│                                          │
│              카카오맵                     │
│   (광화문 중심 37.5759, 126.9769)          │
│                                          │
├──────────────────────────────────────────┤
│  [📹CCTV] [🗺️TOPIS] [📍위치공유]               │
│  [𝕏 X공유] [📋링크복사]  [☕후원 💜]            │
│  [💬카카오톡 공유] [🟢LINE 공유]                │
└──────────────────────────────────────────┘
```

**마커 레이어:**

| 아이콘 | 레이어 | 데이터 소스 |
|--------|--------|-----------|
| ☕ | 24시간 카페 | 카카오 키워드 검색 API 실시간 (`광화문 24시간 카페`, radius 1km) |
| 🔋 | 핸드폰 충전 가능 | `data/locations.json` AI 생성 (카카오 검색으로 검증) |
| 🏥 | 구급 텐트 | `data/locations.json` 정적 (이순신 동상 앞 등 고정 위치) |
| 🚇 | 지하철 귀가 루트 | `data/locations.json` 정적 추천 3개 + 카카오맵 딥링크 |

**CCTV 링크 패널:**
- 서울시 영상포털: `https://cctv.seoul.go.kr`
- TOPIS 교통정보: `http://topis.seoul.go.kr`
- 스마트서울맵: `https://map.seoul.go.kr/smgis2/short/5Wa1h`

### 4-2. AI 채팅 탭

```
┌──────────────────────────────────────────┐
│  [🇰🇷한국어] [🇺🇸English] [🇯🇵日本語]          │
│  ┌────────────────────────────────────┐  │
│  │ 💜 AI: Hi! I'm so excited for     │  │
│  │        BTS today! Which member    │  │
│  │        are you here for?          │  │
│  │ 나: I'm here for Jungkook!         │  │
│  └────────────────────────────────────┘  │
│  [입력창 ...]              [5/5회] [전송] │
│  ─── 더 대화하려면 → SDUI 무료 가입 ────  │
└──────────────────────────────────────────┘
```

- localStorage 키: `bts_guest_chat_count` (최대 5) (완료 ✅)
- 5회 소진 시 `yerin.duckdns.org` 로그인 페이지로 리다이렉트 (완료 ✅)
- 언어별 시스템 프롬프트 분기 (en/ja) (완료 ✅)

**BTS 이벤트 특화 프롬프트 (영어):**
> "You are a friendly AI chat partner helping international BTS fans at the Gwanghwamun event. Have a casual, warm conversation about BTS. Help them communicate with Korean fans. Keep responses short (2-3 sentences). Use BTS references naturally."

**일본어 버전:**
> "あなたはBTSファンのための日本語チャット練習AIです。光化門イベントに来た外国人ファンと自然に会話してください。BTSの話題を中心に、短い文で返答してください。"

### 4-3. 팬 게시판 탭

```
┌──────────────────────────────────────────┐
│  [전체] [🇰🇷KR] [🇺🇸EN] [🇯🇵JP]  [✏️글쓰기] │
│  ┌────────────────────────────────────┐  │
│  │ 🇯🇵 yamachan  · 방금                │  │
│  │ 광화문 최고!! BTS 사랑해요 💜        │  │
│  │ 💜 12   🔥 8   ✨ 5   [댓글 3개]   │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 🇺🇸 ARMY_USA  · 2분 전              │  │
│  │ The energy here is AMAZING!! 😭💜  │  │
│  │ 💜 24   🔥 15  ✨ 9   [댓글 7개]   │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## 4-4. 메시징앱 연동 (카카오톡 / LINE)

### 카카오톡 공유하기 (SDK 카드형)

카카오맵과 동일한 JS SDK(`kakao.js`) 사용 — 별도 번들 불필요.

```typescript
// components/Share/KakaoShare.tsx
declare const Kakao: any;

export function KakaoShare() {
  const share = () => {
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '💜 BTS 광화문 현장 지도',
        description: '24시간 카페 · 충전 · 구급 · 지하철 탈출 루트',
        imageUrl: 'https://bts-gwanghwamun.vercel.app/og-image.png',
        link: {
          mobileWebUrl: 'https://bts-gwanghwamun.vercel.app',
          webUrl: 'https://bts-gwanghwamun.vercel.app',
        },
      },
      buttons: [
        {
          title: '지도 열기',
          link: {
            mobileWebUrl: 'https://bts-gwanghwamun.vercel.app',
            webUrl: 'https://bts-gwanghwamun.vercel.app',
          },
        },
      ],
    });
  };
  return <button onClick={share}>💬 카카오톡 공유</button>;
}
```

**설정 요건:**
- 카카오 디벨로퍼스 → 해당 앱 → 플랫폼 → Web → 도메인 등록
- `Kakao.init(appKey)` 은 이미 카카오맵 초기화에서 처리 → 중복 호출 없이 재사용
- `카카오 로그인` 없이 공유만 가능 (Share API는 비로그인 사용 가능)

---

### LINE 공유하기 (URL scheme)

```typescript
// components/Share/LineShare.tsx
export function LineShare() {
  const url = encodeURIComponent('https://bts-gwanghwamun.vercel.app');
  const text = encodeURIComponent('💜 BTS 광화문 현장 지도 — 카페·충전·구급·지하철');
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${url}&text=${text}`;
  return <a href={lineUrl} target="_blank" rel="noopener">🟢 LINE 공유</a>;
}
```

- 별도 SDK 불필요, URL scheme 한 줄
- 일본 팬 주 사용 채널
- 모바일: LINE 앱 자동 실행 / PC: LINE 공유 팝업

---

### 카카오톡 오픈채팅방 버튼

```typescript
// InfoPanel.tsx 내 버튼
const OPEN_CHAT_URL = process.env.NEXT_PUBLIC_KAKAO_OPENCHAT_URL;

<a href={OPEN_CHAT_URL} target="_blank" rel="noopener"
   className="openchat-btn">
  💬 실시간 팬 채팅방 입장 →
</a>
```

- 운영자가 카카오톡 앱에서 오픈채팅방 생성 → URL 복사 → `.env.local`에 등록
- 비회원 참여 가능한 오픈채팅 추천 (링크 입장형)
- 팬들이 현장에서 모이는 소통 허브 역할 → 게시판과 시너지

---

### InfoPanel 공유 버튼 배치 (업데이트)

| 버튼 | 동작 |
|------|------|
| 💬 카카오톡 공유 | `Kakao.Share.sendDefault()` SDK 카드형 메시지 |
| 🟢 LINE 공유 | `social-plugins.line.me` URL scheme |
| 🐦 X 공유 | `twitter.com/intent/tweet` |
| 📋 링크 복사 | `navigator.clipboard.writeText()` |
| 📍 내 위치 공유 | Web Share API (`navigator.share`) |
| 💬 오픈채팅방 | 정적 링크 버튼 (env 변수) |
| ☕ 후원 | 카카오페이 QR 링크 |

---

## 5. 백엔드 API 명세 (SDUI-server 추가)

### 5-1. 게스트 AI 채팅

```
POST /api/ai/guest/chat
Content-Type: application/json
(인증 불필요)

Request:
{
  "message": "Which member are you here for?",
  "lang": "en",                     // en | ja | ko
  "sessionId": "uuid-from-client"   // 대화 컨텍스트용
}

Response:
{
  "reply": "I'm here for all of them! But Jungkook is my bias. 💜"
}
```

- Spring Security `permitAll()` 예외 처리 필요
- 기존 `OpenAiClient` 재사용
- 세션별 대화 히스토리는 Redis or 메모리 (짧은 이벤트 기간)

### 5-2. 팬 게시판 API

```
GET  /api/fan-posts?lang=en&page=0&size=20
POST /api/fan-posts                           (no auth)
POST /api/fan-posts/{id}/reactions
POST /api/fan-posts/{id}/comments             (no auth)
GET  /api/fan-posts/{id}/comments
```

**POST /api/fan-posts body:**
```json
{
  "nickname": "yamachan",
  "content": "광화문 최고!",
  "lang": "ja",
  "countryTag": "JP",
  "eventTag": "BTS_GWANGHWAMUN_2026"
}
```

**POST /api/fan-posts/{id}/reactions body:**
```json
{ "reactionType": "heart" }   // heart | fire | spark
```

---

## 6. DB 마이그레이션 계획 (V35)

> ⚠️ 실행 전 최종 확인 필요 (CLAUDE.md 규칙)

**파일**: `SDUI-server/src/main/resources/db/migration/V35__add_fan_board.sql`

```sql
-- 팬 게시글
CREATE TABLE fan_post (
    id          BIGSERIAL PRIMARY KEY,
    nickname    VARCHAR(50)  NOT NULL,
    content     TEXT         NOT NULL,
    lang        VARCHAR(5)   NOT NULL DEFAULT 'ko',   -- ko, en, ja
    country_tag VARCHAR(10),                           -- KR, JP, US, CN, ...
    event_tag   VARCHAR(50)  DEFAULT 'BTS_GWANGHWAMUN_2026',
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    is_deleted  BOOLEAN      DEFAULT FALSE
);

-- 이모지 리액션 (💜🔥✨)
CREATE TABLE fan_post_reaction (
    id            BIGSERIAL PRIMARY KEY,
    post_id       BIGINT REFERENCES fan_post(id) ON DELETE CASCADE,
    reaction_type VARCHAR(10) NOT NULL,               -- heart, fire, spark
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 댓글
CREATE TABLE fan_post_comment (
    id         BIGSERIAL PRIMARY KEY,
    post_id    BIGINT REFERENCES fan_post(id) ON DELETE CASCADE,
    nickname   VARCHAR(50) NOT NULL,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN     DEFAULT FALSE
);

-- 인덱스
CREATE INDEX idx_fan_post_event_lang ON fan_post(event_tag, lang);
CREATE INDEX idx_fan_post_created    ON fan_post(created_at DESC);
CREATE INDEX idx_fan_comment_post    ON fan_post_comment(post_id);
```

---

## 7. 정적 데이터 예시 (data/locations.json)

```json
{
  "charging": [
    {
      "name": "광화문 스타벅스 교보빌딩점",
      "name_en": "Starbucks Kyobo Bldg",
      "lat": 37.5701, "lng": 126.9769,
      "memo_ko": "콘센트 다수, 24시간",
      "memo_en": "Many outlets, open 24hr"
    }
  ],
  "emergency_tents": [
    {
      "name": "구급 텐트 A (이순신 동상 앞)",
      "name_en": "First Aid Tent A (Yi Sun-sin statue)",
      "lat": 37.5709, "lng": 126.9769,
      "memo_ko": "의무대 상시 운영",
      "memo_en": "Medical team on standby"
    }
  ],
  "subway_routes": [
    {
      "name": "3호선 경복궁역 → 혼잡 낮음",
      "name_en": "Line 3 Gyeongbokgung — less crowded",
      "desc_ko": "광화문역 대신 경복궁역 이용 추천. 5분 도보.",
      "desc_en": "Use Gyeongbokgung instead of Gwanghwamun. 5 min walk.",
      "lat": 37.5796, "lng": 126.9743,
      "kakaomap_url": "https://map.kakao.com/?q=경복궁역"
    },
    {
      "name": "5호선 광화문역 5번 출구",
      "name_en": "Line 5 Gwanghwamun Exit 5",
      "desc_ko": "메인 출구. 혼잡 예상. 광화문역 2번 출구 우회 추천.",
      "desc_en": "Main exit, expect crowds. Try exit 2 instead.",
      "lat": 37.5714, "lng": 126.9770,
      "kakaomap_url": "https://map.kakao.com/?q=광화문역"
    }
  ]
}
```

---

## 8. 디자인 토큰 (BTS 보라 테마)

```css
:root {
  --bts-purple-dark:  #4A0E8F;
  --bts-purple:       #7B2D8B;
  --bts-purple-light: #E1C9FF;
  --bg-dark:          #0D0D1A;
  --bg-card:          #1A1A2E;
  --text-primary:     #F0E6FF;
  --text-secondary:   #9B8DBD;
  --accent:           #C084FC;
}
```

---

## 9. Vercel 배포 설정

**vercel.json** (`bts-event/` 루트):
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://[EC2_HOST]/api/:path*" }
  ]
}
```

**환경변수 (Vercel Dashboard):**
```
NEXT_PUBLIC_KAKAO_APP_KEY      = [카카오 디벨로퍼스 JS 키]
NEXT_PUBLIC_API_BASE           = https://[EC2 호스트]
NEXT_PUBLIC_KAKAOPAY_URL       = https://qr.kakaopay.com/[개인QR]
NEXT_PUBLIC_KAKAO_OPENCHAT_URL = https://open.kakao.com/o/[오픈채팅방ID]
```

**카카오 디벨로퍼스 허용 도메인 추가 필요:**
- `bts-gwanghwamun.vercel.app`
- `localhost:3001` (개발 중)

---

## 10. 개발 타임라인

| 순서 | 작업 | 예상 시간 | 상태 |
|------|------|---------|------|
| 1 | `bts-event/` Next.js 프로젝트 생성 | 15분 | 완료 ✅ |
| 2 | 카카오맵 + 4개 마커 레이어 | 2시간 | 완료 ✅ |
| 3 | InfoPanel (CCTV, SNS 공유, 후원 버튼) + 카카오톡/LINE/X | 1.5시간 | 완료 ✅ |
| 4 | Vercel 배포 + 도메인 연결 + 환경변수 설정 | 30분 | 완료 ✅ |
| 5 | BE: 게스트 채팅 API (`/api/ai/guest/chat`) | 1.5시간 | 확인 필요 🔍 |
| 6 | FE: GuestChat 컴포넌트 + 5회 제한 + 리다이렉트 | 1 hour | 완료 ✅ |
| 7 | V35 마이그레이션 실행 (확인 후) | 30분 | 대기 중 ⏳ |
| 8 | BE: 팬 게시판 API (FanPost 도메인) | 2시간 | 대기 중 ⏳ |
| 9 | FE: 게시판 UI (목록, 작성, 리액션, 댓글) | 2시간 | 대기 중 ⏳ |

**진행 상황:** 지도 및 AI 채팅(게스트용) 구현 완료. 게시판 연동 준비 중.

---

## 11. 이벤트 종료 후 운영 전략

이벤트가 끝나도 **계속 운영**. 다음 K-Pop 이벤트 시 재활용:

1. `data/locations.json` 장소 데이터만 교체
2. `event_tag` 값만 변경 (`BTS_GWANGHWAMUN_2026` → `BTS_CONCERT_2026` 등)
3. OG 이미지 + 헤더 텍스트만 수정
4. 게시판 데이터는 이벤트별 태그로 분리 유지

---

## 12. 체크리스트 (코딩 시작 전)

- [ ] 카카오 디벨로퍼스 JS 앱 키 발급 + Web 플랫폼 도메인 등록
- [ ] 카카오페이 개인 송금 QR 링크 생성
- [ ] 카카오톡 오픈채팅방 생성 → URL 확인
- [ ] EC2 호스트 URL 확인
- [ ] V35 마이그레이션 DB 변경 최종 승인
- [ ] SDUI-server Spring Security `/api/ai/guest/**` permitAll 승인
