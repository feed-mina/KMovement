# SDUI — DB에서 변경 가능한 화면 구성 가이드 (이슈 #89)

> K-Ride SDUI에서 **프런트엔드 재빌드 없이** `ui_metadata` 등 DB 설정만으로 변경 가능한 범위와
> 적용 절차를 정리한다. 모든 컬럼·캐시 키·컴포넌트 타입은 2026-07-11 기준 코드에서 직접 확인했다.
>
> - 엔티티: `SDUI/SDUI-server/src/main/java/com/domain/demo_backend/domain/ui/domain/UiMetadata.java`
> - 캐시: `.../domain/ui/service/UiMetadataService.java` — 키 `ui:metadata:{screenId}`, TTL 1시간
> - 컴포넌트 레지스트리: `SDUI/metadata-project/components/constants/componentMap.tsx`

---

## 1. 변경 가능 컬럼과 역할 (UiMetadata 엔티티 전체)

| 컬럼 | 역할 | 비고 |
|---|---|---|
| `screen_id` | 화면 식별자 — 한 화면의 모든 컴포넌트를 묶음 | 예: `MAIN_PAGE`, `TOUR_EXPLORE` |
| `component_id` | 화면 내 컴포넌트 식별자 | UPDATE의 WHERE 기준 |
| `label_text` | 제목·부제목·버튼 문구 | 텍스트 변경의 기본 |
| `label_text_overrides` | 역할/조건별 문구 오버라이드 | |
| `component_type` | 렌더링할 React 컴포넌트 선택 | §4 등록 타입만 유효 |
| `sort_order` | 화면 내 표시 순서 | 숫자 낮을수록 먼저 |
| `is_visible` | 표시/숨김 | `'true'`/`'false'` 문자열 |
| `allowed_roles` | 역할별 노출 | 예: `ROLE_USER`, `ROLE_ADMIN` |
| `css_class` | 기존 CSS 클래스 적용 | 프런트에 이미 존재하는 클래스만 |
| `css_class_overrides` | 조건별 클래스 오버라이드 | |
| `inline_style` | 인라인 스타일 | 소량 미세조정용 |
| `action_type` | 클릭 시 동작 종류 | 예: `ROUTE`, `LOGIN_SUBMIT` — usePageHook 라우팅 |
| `action_url` | 이동 경로 / 호출 대상 | 예: `/view/FOCUS` |
| `data_api_url` | 데이터 공급 API 변경 | 실제 존재하는 API여야 함 |
| `data_sql_key` | `query_master`의 SQL 키로 데이터 공급 | Redis `SQL:{sqlKey}` 캐시 |
| `data_params` | 데이터 요청 파라미터 | |
| `ref_data_id` | pageData 바인딩 키 (그룹이면 Repeater) | |
| `group_id` / `parent_group_id` | 트리 구조(부모-자식) — 컴포넌트 조합 | 그룹은 `<div>` 래퍼 |
| `group_direction` | `ROW`(가로) / `COLUMN`(세로) 배치 | |
| `submit_group_id` / `_order` / `_separator` | 제출 시 값 묶음 규칙 | |
| `component_props` | 컴포넌트별 속성(JSON) — 차트 축·범례, TimeSelect 범위 등 | 예: `{"startHour":0,"endHour":24,"legendActive":"sleep"}` |
| `placeholder` / `default_value` | 입력 힌트 / 초기값 | |
| `is_required` / `is_readonly` | 필수/읽기전용 | |
| `system_prompt_template` | AI 컴포넌트 시스템 프롬프트 | AI_CHAT 등 |

## 2. 실제 예시 (Flyway 마이그레이션으로 작성 권장)

### 제목 변경
```sql
UPDATE ui_metadata
SET label_text = '어떤 여행을 떠나고 싶나요?'
WHERE screen_id = 'KRIDE_INTRO4' AND component_id = 'intro4_title';
```

### 표시 순서 변경 (K-Culture 카드를 앞으로)
```sql
UPDATE ui_metadata
SET sort_order = 4
WHERE screen_id = 'KRIDE_INTRO4' AND component_id = 'intro4_p_kculture';
```

### 숨김 처리 (쇼핑 카드)
```sql
UPDATE ui_metadata
SET is_visible = 'false'
WHERE screen_id = 'KRIDE_INTRO4' AND component_id = 'intro4_p_shopping';
```

### 역할별 노출 (관리자 전용으로 전환)
```sql
UPDATE ui_metadata
SET allowed_roles = 'ROLE_ADMIN'
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_stats_card';
```

### 버튼 이동 경로 변경
```sql
UPDATE ui_metadata
SET action_url = '/view/FOCUS'
WHERE screen_id = 'MAIN_PAGE'
  AND component_id = 'main_bento_kride_btn'
  AND allowed_roles = 'ROLE_USER';
```

### 데이터 공급처 변경 (API → SQL 키)
```sql
UPDATE ui_metadata
SET data_api_url = NULL, data_sql_key = 'route_history_trends'
WHERE screen_id = 'MY_PAGE' AND component_id = 'mypage_trend_chart';
-- query_master에 sql_key='route_history_trends' 행이 있어야 함
```

### 차트 속성 변경 (component_props JSON)
```sql
UPDATE ui_metadata
SET component_props = '{"chartType":"line","legend":true,"yMax":100}'
WHERE screen_id = 'ADMIN_DASHBOARD' AND component_id = 'dash_weekly_chart';
```

### 컴포넌트 추가 (기존 타입 조합)
```sql
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text,
   parent_group_id, sort_order, is_visible, allowed_roles)
VALUES
  ('MY_PAGE', 'mypage_notice_text', 'TEXT', '7월 이벤트 안내',
   'MYPAGE_TOP_GROUP', 5, 'true', 'ROLE_USER');
```

## 3. Redis 캐시 반영 절차 (필수)

메타데이터는 화면 단위로 **1시간** 캐시된다
(`UiMetadataService.getMetadataWithCache` — 키 `ui:metadata:{screenId}`).
DB만 바꾸면 최대 1시간 동안 이전 화면이 보이므로, 변경 직후 해당 키를 삭제한다.

```bash
# EC2에서 (docker compose 기준)
docker exec -it <redis-container> redis-cli DEL "ui:metadata:KRIDE_INTRO4"

# 여러 화면을 바꿨다면
docker exec -it <redis-container> redis-cli --scan --pattern "ui:metadata:*" | \
  xargs -r docker exec -i <redis-container> redis-cli DEL
```

`data_sql_key`(query_master)를 바꿨다면 SQL 캐시도 함께 삭제한다:

```bash
docker exec -it <redis-container> redis-cli DEL "SQL:route_history_trends"
```

## 4. 프런트에 등록된 component_type (2026-07-11 기준 27종)

`MODAL INPUT TEXT PASSWORD BUTTON SNS_BUTTON LINK_BUTTON IMAGE EMAIL_SELECT EMOTION_SELECT
SELECT TEXTAREA TIME_RECORD_WIDGET DATETIME_PICKER TIME_SELECT TIME_SLOT_RECORD
ADDRESS_SEARCH_GROUP GROUP ADMIN_USER_TABLE AI_CHAT AI_CHAT_V2 AI_INTERVIEW CHECKBOX
THEME_EDITOR STAT_CARD CHART GALLERY_GRID HISTORY_LIST`

이외에 여행 플러그인이 런타임 등록하는 화면 컨트롤러(`TOUR_EXPLORE`, `ROUTE_PLANNER` 등)는
`components/plugins/travel/register.ts` 참고. **여기에 없는 타입을 DB에 넣으면 렌더되지 않는다**
(새 타입은 프런트 배포 필요 — §6).

## 5. 변경 전후 화면 검증 절차

1. **변경 전 캡처**: 대상 화면(`/view/{SCREEN_ID}`) 스크린샷 또는 `GET /api/ui/{screenId}` 응답 저장
2. **Flyway 마이그레이션 작성**: `SDUI-server/src/main/resources/db/migration/V{next}__{설명}.sql`
   (2026-07-11 기준 최신 V75 — 번호 충돌 확인 후 채번)
3. **적용**: 백엔드 재기동 시 자동 적용(운영), 로컬은 `./gradlew bootRun`
4. **캐시 무효화**: §3 절차로 `ui:metadata:{screenId}` 삭제
5. **API 확인**: `curl https://<host>/api/ui/{screenId}` 에서 변경 값(label_text 등) 반영 확인
6. **화면 확인**: 브라우저에서 `/view/{SCREEN_ID}` 새로고침
   (PWA 캐시가 남으면 강력새로고침 — 신규 배포부터는 ServiceWorkerUpdater가 자동 갱신)
7. **역할 검증**: `allowed_roles` 변경 시 USER/ADMIN 계정 각각 확인
   (React Query 키가 `{rolePrefix}_{screenId}`로 역할별 분리 캐시됨)

## 6. DB만으로 안 되는 것 (프런트 배포 필요)

- **새 component_type 추가** — React 컴포넌트 신규 작성 + componentMap 등록 필요
- **새 CSS 클래스 정의** — `css_class`는 기존 클래스 재사용만 가능
- **새 정적 URL 경로** — `screenMap.ts`의 SCREEN_MAP 또는 플러그인 `registerScreenPaths` 등록 필요
- **액션 로직 변경** — `action_type` 핸들러(useUserActions/useBusinessActions)의 동작 자체

## 7. 관련 Flyway 마이그레이션 (실전 예시)

| 파일 | 내용 |
|---|---|
| `V53__kride_intro_focus_screens.sql` | KRIDE 인트로/포커스 화면 정의 |
| `V65__main_ai_chat_cards.sql` | 메인 AI 채팅 카드 |
| `V68__design_tokens.sql` / `V69__theme_settings_screen.sql` | 디자인 토큰 테이블 + THEME_SETTINGS 화면 |
| `V73__route_history_trends_sdui.sql` | 동선 이력 트렌드 화면 |
| `V75__tour_poi.sql` | 관광 POI (최신) |

## 8. 주의사항

- 운영 DB 직접 UPDATE 대신 **Flyway 마이그레이션**으로 이력을 남긴다
- `action_url` 대상 화면·`data_api_url` API가 실제 존재하는지 먼저 확인
- `is_visible`은 문자열 `'true'`/`'false'` (Boolean 아님)
- 캐시 무효화(§3)를 빠뜨리면 "변경이 안 된 것처럼" 보인다 — 가장 흔한 실수
