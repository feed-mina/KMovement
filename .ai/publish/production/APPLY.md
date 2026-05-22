# KRIDE_INTRO1 화면 비율 수정 — Production 적용 가이드

이 폴더에는 KRIDE_INTRO1 의 화면 비율 / 한글 텍스트 오버플로 문제를 production 환경에 안전하게 반영하기 위한 최소 패치가 들어있습니다.

## 변경 범위

| 항목 | 변경 | 비고 |
|---|---|---|
| `ui_metadata` 테이블 | 5개 row 의 `css_class` 컬럼 UPDATE | DDL 없음 |
| `app/styles/KRIDE.css` | 신규 클래스 5개 append | 기존 규칙 미수정 |
| `next.config.ts` | **무수정** | rewrites/CSP 영향 없음 |
| `app/globals.css` | **무수정** | Tailwind `@source inline` safelist 그대로 |
| `componentMap.tsx` | **무수정** | 신규 컴포넌트 타입 없음 |
| DynamicEngine 코어 | **무수정** | `flex`, `flex-col` 등 라우팅 키워드 유지 |

## 파일

- `V49__kride_intro1_fit_fix.sql` — Flyway 마이그레이션 (`SDUI-server/src/main/resources/db/migration/` 에 배치)
- `KRIDE.css.append.css` — 기존 `KRIDE.css` 파일 맨 아래에 append

## 적용 절차

### 1. CSS 패치
```bash
cat publish/production/KRIDE.css.append.css \
  >> subproject/SDUI/metadata-project/app/styles/KRIDE.css
```

### 2. DB 마이그레이션
```bash
cp publish/production/V49__kride_intro1_fit_fix.sql \
   subproject/SDUI/SDUI-server/src/main/resources/db/migration/
```

Flyway 가 자동 적용됩니다. 수동 검증:
```bash
docker exec sdui-postgres psql -U postgres -d SDUI_TD -c \
  "SELECT version, description FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;"
# V49 | kride intro1 fit fix 가 보여야 함
```

### 3. Redis 캐시 무효화
SDUI 는 ui_metadata 를 Redis 에 캐싱하므로 반드시 flush:
```bash
docker exec sdui-redis redis-cli FLUSHDB
```

### 4. 검증
```bash
# 백엔드 응답 확인
curl -s http://localhost:8080/api/ui/KRIDE_INTRO1 | jq '.[] | {id: .componentId, css: .cssClass}'

# 프론트엔드
# Chrome DevTools → Device toolbar → iPhone SE (375×667) 에뮬레이션
# /view/KRIDE_INTRO1 진입
```

체크리스트:
- ✓ 히어로 이미지가 16:10 비율 유지 (`max-w-xs h-56` 흰 여백 없음)
- ✓ 타이틀 "어떤 여행을 떠나실 건가요?" 가 어절 단위로 줄바꿈 (음절 끊김 X)
- ✓ 버튼 3개가 화면 하단 고정 (`mt-auto`)
- ✓ Pretendard 폰트 적용 (`globals.css` 의 폰트 import 이미 존재)

## 롤백

문제 발생 시:
```sql
-- ui_metadata 만 V48 상태로 되돌림 (Flyway repair 가 필요한 경우 별도 처리)
BEGIN;
UPDATE ui_metadata SET css_class = 'min-h-screen bg-black flex flex-col items-center px-6 pt-12 pb-8 gap-6'
  WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_root';
UPDATE ui_metadata SET css_class = 'w-full max-w-xs h-56 object-contain mx-auto'
  WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_hero';
UPDATE ui_metadata SET css_class = 'text-3xl font-black text-white text-center leading-snug'
  WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_title';
UPDATE ui_metadata SET css_class = 'text-gray-400 text-base text-center mb-4'
  WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_sub';
UPDATE ui_metadata SET css_class = 'flex flex-col gap-4 w-full max-w-sm mt-6'
  WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_buttons';
COMMIT;
```
그리고 KRIDE.css 의 append 블록 제거 → Redis FLUSHDB.

## 영향받는 다른 화면

없음. 신규 클래스는 모두 `.kride-intro1-*` prefix 이며 INTRO2/3/4/5/MY_LIST/FOCUS 에서 사용하는 `.kride-artist-grid`, `.kride-region-grid`, `.kride-next-btn-br` 등은 무수정.

## 더 확장하고 싶을 때 (선택)

프로토타입(`publish/KRIDE Intro.html`)에는 4가지 레이아웃이 포함되어 있습니다:
- **Classic** ← 현재 V49 가 적용하는 레이아웃
- Cinematic split — hero 가 상단 46% 차지, 타이틀 오버랩
- Letterboxed — 16:9 시네마 바
- Typographic — hero 없이 타이포그래피만

Classic 외 레이아웃을 적용하려면 `intro1_hero` 의 css_class 와 `intro1_title` 의 negative margin 처리 등을 추가로 변경해야 하며, 그 경우 별도 V50 마이그레이션을 분리 작성하는 것이 안전합니다. 필요해지면 말씀해주세요.
