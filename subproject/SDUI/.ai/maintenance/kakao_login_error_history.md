# 카카오 로그인 에러 해결 기록

> 카카오 OAuth 로그인 관련 발생한 이슈들과 해결 과정을 시간순으로 정리한 문서.

---

## 전체 흐름 개요

```
[사용자] 카카오 로그인 버튼 클릭
    ↓
[Kakao OAuth] kauth.kakao.com/oauth/authorize?...&redirect_uri=...
    ↓  (인증 후 redirect_uri로 code 전달)
[Next.js] /api/kakao/callback?code=... (route.ts)
    ↓  (code를 백엔드로 프록시)
[Spring Boot] /api/kakao/callback?code=...&state=...
    ↓  (Kakao API로 AccessToken 교환 → 사용자 정보 조회 → JWT 발급)
[Spring Boot → Next.js] Set-Cookie + JSON 응답
    ↓  (쿠키를 클라이언트로 전달)
[Next.js → 브라우저] 쿠키 설정 + role에 따라 리다이렉트
    ↓
[MAIN_PAGE or ADDITIONAL_INFO_PAGE]
```

---

## 이슈 1: 카카오 로그인 성공 후 JSON이 화면에 그대로 표시됨

### 발생 시점
초기 개발 단계 (2026-03 이전)

### 현상
카카오 로그인 성공 후 브라우저에 `{"accessToken":"...","refreshToken":"...","role":"ROLE_USER"}` 같은 JSON 텍스트가 그대로 렌더링됨.

### 원인
`KakaoController.java`의 `/api/kakao/callback`이 `state` 파라미터 없이 호출되면 JSON을 반환하고, 브라우저가 이를 그대로 표시함.

### 해결
`state` 파라미터를 기준으로 분기 처리:
- `state=mobile` → JSON 반환 (Next.js 프록시용)
- `state` 없음 (web) → 302 리다이렉트 (브라우저 직접 접근용)

**파일:** `SDUI-server/src/main/java/.../KakaoController.java`
```java
String platform = (state != null) ? state : "web";
if ("mobile".equals(platform)) {
    // JSON 응답 반환 (Next.js API Route 호환)
    return ResponseEntity.ok(responseBody);
}
// web: 302 리다이렉트
HttpHeaders redirectHeaders = new HttpHeaders();
redirectHeaders.setLocation(URI.create(webUrl));
return new ResponseEntity<>(redirectHeaders, HttpStatus.FOUND);
```

---

## 이슈 2: 카카오 로그인 후 로그인이 안 된 채로 메인페이지로 이동

### 발생 시점
2026-03-07 배포 후 발견

### 현상
카카오 로그인 버튼 클릭 → Kakao 인증 완료 → 메인페이지로 이동하지만 `isLoggedIn: false` 상태. `/api/auth/me` 응답이 `{"role":"GUEST","isLoggedIn":false}`.

### 원인: 쿠키 도메인 불일치

```
[기존 문제 흐름]
Kakao → redirect_uri: yerin.duckdns.org/api/kakao/callback  (백엔드 직접)
    ↓
Spring Boot가 쿠키를 yerin.duckdns.org 도메인에 Set-Cookie
    ↓
Spring Boot가 yerin.duckdns.org으로 302 리다이렉트
    ↓
브라우저가 Vercel(yerin.duckdns.org)에 도착
    → yerin.duckdns.org 쿠키는 전송 안 됨 (다른 도메인)
    → accessToken 없음 → 로그인 안된 상태
```

**근본 원인:** `KAKAO_REDIRECT_URI`가 백엔드 EC2 도메인으로 직접 설정되어 있었음.
백엔드가 쿠키를 자신의 도메인에 설정한 후 Vercel로 리다이렉트하면, 브라우저는 쿠키를 잃어버림.

### 해결 방법

#### 2-1. Next.js를 프록시로 경유하도록 `KAKAO_REDIRECT_URI` 변경

**파일:** `.github/workflows/deploy.yml`
```yaml
# 변경 전
-e KAKAO_REDIRECT_URI=https://yerin.duckdns.org/api/kakao/callback

# 변경 후
-e KAKAO_REDIRECT_URI=https://yerin.duckdns.org/api/kakao/callback
-e WEB_URL=https://yerin.duckdns.org
```

**파일:** `SDUI-server/src/main/resources/application-prod.yml`
```yaml
kakao:
  redirect-uri: ${KAKAO_REDIRECT_URI}

app:
  url:
    web: ${WEB_URL:https://yerin.duckdns.org}
```

#### 2-2. DB의 카카오 버튼 `action_url`도 동기화 (V11 마이그레이션)

**파일:** `SDUI-server/src/main/resources/db/migration/V11__fix_kakao_redirect_uri.sql`
```sql
UPDATE ui_metadata
SET action_url = REGEXP_REPLACE(
    action_url,
    'redirect_uri=[^&]+',
    'redirect_uri=https://yerin.duckdns.org/api/kakao/callback'
)
WHERE action_url LIKE '%kauth.kakao.com%'
  AND action_url LIKE '%redirect_uri=%';
```

#### 2-3. 카카오 개발자 콘솔 설정 (수동 작업 필요)

[카카오 개발자 콘솔](https://developers.kakao.com) → 내 애플리케이션 → 카카오 로그인 → Redirect URI에 추가:
```
https://yerin.duckdns.org/api/kakao/callback
```

**동작 원리 (수정 후):**
```
Kakao → redirect_uri: yerin.duckdns.org/api/kakao/callback  (Vercel)
    ↓
Next.js /api/kakao/callback (route.ts)가 백엔드로 프록시
    ↓
Spring Boot가 Set-Cookie 응답 → Next.js가 이를 브라우저로 전달
    ↓
브라우저에 yerin.duckdns.org 도메인으로 쿠키 설정됨 ✓
```

---

## 이슈 3: `/view/LOGIN_PAGE?error=parse_error` 로 리다이렉트

### 발생 시점
2026-03-07 이슈 2 해결 후 발견

### 현상
카카오 로그인 → `?error=parse_error`와 함께 로그인 페이지로 돌아옴.
네트워크 탭에서 `/api/auth/me` 응답이 `{"role":"GUEST","isLoggedIn":false}`.

### 원인: `fetch`가 302 리다이렉트를 따라가서 HTML을 받아옴

```
[문제 흐름]
Next.js route.ts → fetch(`백엔드/api/kakao/callback?code=...`)
    ↓
백엔드: state 없음 → "web" 분기 → 302 리다이렉트 to WEB_URL (yerin.duckdns.org)
    ↓
fetch()가 302를 자동으로 따라감 (기본 동작)
    ↓
yerin.duckdns.org에서 HTML 페이지 응답
    ↓
route.ts: responseText = <HTML>...</HTML>
    ↓
JSON.parse(HTML) → SyntaxError → parse_error 리다이렉트
```

**핵심:** `fetch()`는 기본적으로 리다이렉트를 자동으로 따라간다. 백엔드의 302 응답을 그대로 받아야 하는데, 그 대신 최종 목적지의 HTML을 받게 됨.

### 해결

`route.ts`에서 백엔드 호출 시 `state=mobile`을 추가하여, 백엔드가 302 대신 JSON을 반환하도록 강제.

**파일:** `metadata-project/app/api/kakao/callback/route.ts`
```typescript
// 변경 전
const response = await fetch(`${BACKEND_URL}/api/kakao/callback?code=${code}`, {
  method: 'GET',
  ...
});

// 변경 후
// state=mobile: 백엔드가 302 대신 JSON 반환 (KakaoController의 mobile 분기 활용)
const response = await fetch(`${BACKEND_URL}/api/kakao/callback?code=${code}&state=mobile`, {
  method: 'GET',
  ...
});
```

**왜 `state=mobile`인가?**
`KakaoController.java`의 mobile 분기는 이미 "Next.js API Route 호환"이라는 주석이 있을 만큼, 프록시 호출을 위해 설계된 경로임.
```java
// KakaoController.java
if ("mobile".equals(platform)) {
    // JSON 응답 반환 (Next.js API Route 호환)
    return ResponseEntity.ok(Map.of(
        "accessToken", ...,
        "refreshToken", ...,
        "role", ...
    ));
}
```

---

## 이슈 4: V11 Flyway checksum 불일치

### 발생 시점
2026-03-07 이슈 2 해결책 배포 후 EC2에서 발견

### 현상
EC2 Docker 로그에서 Flyway 시작 실패:
```
FlywayValidateException: Validate failed: Migrations have failed validation!
Migration checksum mismatch for migration version 11
-> Applied to database : 0
-> Resolved locally    : -1403213850
```

### 원인
V11 SQL 파일을 처음 빈 파일로 커밋하여 배포(체크섬 0으로 기록)된 후, 실제 SQL을 추가하여 재배포(체크섬 변경).
Flyway는 이미 적용된 마이그레이션 파일의 내용이 바뀌면 validation 에러를 발생시킴.

### 해결
EC2에서 수동으로 V11 히스토리 레코드를 삭제한 후 재시작:
```bash
docker exec -it sdui-db psql -U mina -d SDUI_LAB \
  -c "DELETE FROM flyway_schema_history WHERE version = '11';"

docker restart sdui-backend-lab
# → Flyway가 V11을 처음인 것처럼 다시 실행
```

---

## 관련 파일 목록

| 파일 | 관련 이슈 | 역할 |
|------|----------|------|
| `metadata-project/app/api/kakao/callback/route.ts` | 이슈 2, 3 | Next.js OAuth 콜백 프록시 |
| `SDUI-server/.../KakaoController.java` | 이슈 1, 2, 3 | Spring Boot OAuth 처리 |
| `.github/workflows/deploy.yml` | 이슈 2 | 환경변수 주입 (KAKAO_REDIRECT_URI, WEB_URL) |
| `SDUI-server/src/main/resources/application-prod.yml` | 이슈 2 | 환경변수 바인딩 |
| `SDUI-server/.../db/migration/V11__fix_kakao_redirect_uri.sql` | 이슈 2, 4 | DB action_url 동기화 |
| 카카오 개발자 콘솔 (외부) | 이슈 2 | Redirect URI 허용 목록 등록 |

---

## 향후 주의사항

1. **redirect_uri 변경 시 3곳 동기화 필수:**
   - `deploy.yml` 환경변수 `KAKAO_REDIRECT_URI`
   - 카카오 개발자 콘솔 Redirect URI 허용 목록
   - DB `ui_metadata.action_url` (Flyway 마이그레이션으로 처리)

2. **Flyway 파일은 한 번 배포되면 내용 수정 금지:**
   - 수정이 필요하면 새 버전 파일(V12, V13...)로 추가
   - 이미 배포된 파일 수정 시 반드시 `DELETE FROM flyway_schema_history WHERE version = 'N';` 선행

3. **Next.js 프록시에서 백엔드 호출 시 `state=mobile` 필수:**
   - 백엔드 `state` 없음 → 302 리다이렉트 (브라우저 직접 접근용)
   - 백엔드 `state=mobile` → JSON 응답 (Next.js 프록시용)
   - `route.ts`에서 백엔드 URL에 항상 `&state=mobile` 포함

---

*작성: 2026-03-07*
