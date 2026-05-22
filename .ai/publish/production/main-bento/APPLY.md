# MAIN_PAGE — KRIDE Entry Card 적용 가이드

`publish/KRIDE Main Bento.html` 의 프로토타입을 production 에 반영하기 위한 최소 패치.

## 변경 범위

| 항목 | 변경 | 비고 |
|---|---|---|
| `ui_metadata` 테이블 | 10개 row INSERT (USER 5 + GUEST 5) | DDL 없음 |
| `pages.css` | `.bento-card-kride*` 클래스 5개 append | 기존 `.bento-card` / `.bento-card-dark` 무수정 |
| `screenMap.ts` | **무수정** | `/INTRO1` → `KRIDE_INTRO1` 매핑 이미 존재 |
| `next.config.ts` | **무수정** | |
| `globals.css` | **무수정** | |
| `componentMap.tsx` | **무수정** | 기존 `TEXT`, `BUTTON`, `GROUP` 만 사용 |
| `MAIN_PAGE.css` | **무수정** | `.MAIN_SECTION`, `.diary-btn-*` 등 그대로 |
| DynamicEngine 코어 | **무수정** | |

## 파일

- `V51__main_page_kride_card.sql` — Flyway 마이그레이션
- `MAIN_PAGE.css.append.css` — pages.css 에 append

## 동작 흐름

```
사용자 → /view/MAIN_PAGE
  ↓
ui_metadata 조회 (USER/GUEST role 에 따라)
  ↓
DynamicEngine 렌더:
  ┌─────────────────────────────────────────┐
  │ main_bento_kride_grp  (col-span-3) ⬅ 신규│
  │  K-RIDE 시작하기 ▶                      │
  ├─────────────────────────────────────────┤
  │ appointment widget  │  diary card       │  (기존)
  ├─────────────────────┴───────────────────┤
  │ content card (col-span-3)               │  (기존)
  └─────────────────────────────────────────┘
  ↓
KRIDE 카드 내 BUTTON 클릭 (action_type=LINK)
  ↓
/view/INTRO1 → screenMap.ts → KRIDE_INTRO1 로딩
```

## 적용 절차

### 1. CSS 패치
```bash
cat publish/production/main-bento/MAIN_PAGE.css.append.css \
  >> subproject/SDUI/metadata-project/app/styles/pages.css
```

또는 별도 파일로 분리하고 `globals.css` 에 `@import` 하나만 추가 (권장).

### 2. DB 마이그레이션
```bash
cp publish/production/main-bento/V51__main_page_kride_card.sql \
   subproject/SDUI/SDUI-server/src/main/resources/db/migration/
```

Flyway 자동 적용. 검증:
```bash
docker exec sdui-postgres psql -U postgres -d SDUI_TD -c \
  "SELECT version, description FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;"
```

### 3. Redis 캐시 flush
```bash
docker exec sdui-redis redis-cli FLUSHDB
```

### 4. 검증 체크리스트

GUEST (로그아웃 상태):
- [ ] `/view/MAIN_PAGE` 최상단에 KRIDE 시네마틱 카드 노출
- [ ] 카드 클릭 → `/view/INTRO1` 진입
- [ ] 기존 GUEST 카드들(시간 위젯, 로그인 카드, 튜토리얼) 그대로 노출

USER (로그인 상태):
- [ ] 최상단 KRIDE 카드 + 기존 약속 위젯/콘텐츠 카드들 정상
- [ ] 카드 호버 시 translateY 애니메이션
- [ ] 카드 클릭 → INTRO1

## 디자인 옵션 (선택)

프로토타입에 3가지 비주얼 variant 가 있습니다:
- **Cinematic (default)** — V51 SQL 이 적용하는 시네마틱 다크 그라데이션
- **Red bold** — 풀-블리드 빨강 (CTA 가 더 명시적)
- **Side (1-column)** — 컴팩트 카드, 약속 위젯 옆에 배치

기본은 **Cinematic + Top hero (col-span-3)** 입니다. 다른 variant 적용 시:
- Red bold: CSS 의 `.bento-card-kride` background 만 `background: #E50914;` 로 교체
- Side: V51 SQL 에서 `col-span-3` 제거 + sort_order 조정 (예: 11 — diary 다음)

## 롤백

```sql
BEGIN;
DELETE FROM ui_metadata
WHERE screen_id = 'MAIN_PAGE' AND component_id LIKE 'main_bento_kride%';
COMMIT;
```

그리고 `pages.css` 의 append 블록 제거 → Redis FLUSHDB.

## 주의사항

- **`label_text` 는 NOT NULL** — V8 SQL 주석 참조 (GROUP 행도 `''` 빈 문자열 사용).
- **`allowed_roles` 는 NULL 금지** — V8 SQL 주석 참조 (NULL 이면 USER 가 GUEST 카드까지 봄). USER/GUEST 각각 별도 INSERT.
- **`/view/INTRO1` URL** — frontend `screenMap.ts` 의 `"/INTRO1": "KRIDE_INTRO1"` 매핑이 전제. 매핑이 없다면 추가 필요.
