# FastAPI 테스트 및 실행 오류 분석 및 해결 가이드

현재 FastAPI 서버를 실행하고 `pytest`를 돌렸을 때 발생한 **에러(502)** 와 **서버 경고(Neo4j Warning)** 에 대한 원인과 해결 방법을 정리한 가이드입니다.

---

## 1. `/api/artists` 502 Bad Gateway 에러 (테스트 실패 원인)

### 🚨 현상
터미널에서 `pytest` 실행 시 아래 두 개의 테스트가 실패(FAILED)했습니다.
* `test_artists_schema`
* `test_onboarding_movies_flow`

이 실패의 직접적인 원인은 FastAPI의 `/api/artists` 주소로 요청을 보냈을 때 서버가 정상 응답(200) 대신 **502 Bad Gateway** 에러를 반환했기 때문입니다.

### 🔍 원인 파악
`/api/artists` 엔드포인트는 `src/api/supabase_client.py`를 통해 **Supabase** 데이터베이스에 접근하여 아티스트 목록을 가져옵니다. 
하지만 현재 프로젝트 최상단의 `.env` 파일을 확인해보면, Supabase 접속 정보가 실제 값이 아닌 **기본 플레이스홀더(초기 세팅 값)** 로 남아있습니다.

```env
# 현재 .env 상태
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-public-key>
```
이로 인해 FastAPI 서버가 Supabase에 연결하지 못하고 예외(Exception)를 뱉어내어 502 에러가 발생한 것입니다.

### 💡 해결 방법
1. 운영 중이신(혹은 개발용) **Supabase 대시보드**에 로그인합니다.
2. Project Settings -> API 메뉴에서 `Project URL`과 `anon public API key`를 복사합니다.
3. 프로젝트 내 `.env` 파일의 해당 항목을 **실제 복사한 값으로 교체**합니다.
4. 실행 중인 FastAPI 서버(`uvicorn`)를 **Ctrl+C**로 종료 후 다시 실행합니다.
5. 다시 `pytest`를 돌려보시면 정상적으로 통과할 것입니다.

---

## 2. Neo4j (Aura DB) 경고 로그 (Warning)

### 🚨 현상
FastAPI 서버 구동 터미널 로그를 보면 아래와 같은 메시지들이 출력되고 있습니다.
* `warn: property key does not exist. The property image_url does not exist...`
* `warn: relationship type does not exist. The relationship type IN_REGION does not exist...`
* `warn: property key does not exist. The property sido does not exist...`

### 🔍 원인 파악
이 메시지들은 FastAPI 쪽의 오류가 아니라 **Neo4j DB 서버에서 보내온 경고(Warning) 메시지**입니다.
현재 `.env`에 등록된 Neo4j DB(`e6e5a79c`)에 연결은 정상적으로 이루어졌으나, FastAPI 서버가 날린 Cypher 쿼리에서 찾는 항목들(예: `IN_REGION` 관계선, `image_url` 속성, `sido` 속성)이 **현재 데이터베이스 내에 단 하나도 존재하지 않기 때문에** 주의하라는 의미로 띄우는 것입니다.

다행히 Neo4j는 찾는 데이터 구조가 없더라도 에러를 내뿜고 죽는 대신 **빈 값(Empty)** 을 반환하며 응답 코드는 `200 OK`로 내려줍니다. 따라서 `/api/regions` 같은 API는 테스트를 통과(PASSED)할 수 있었습니다.

### 💡 해결 방법
* **단순 통신/구조 테스트가 목적이라면:** 
  현재 상태(빈 리스트 반환)로 두셔도 당장 서버가 죽거나 프론트엔드 연동에 치명적인 시스템 에러(500)가 발생하지는 않습니다. (무시하셔도 무방합니다.)
* **실제 데이터를 화면에 띄우고 싶다면:**
  Neo4j 데이터베이스에 초기 데이터를 밀어넣는(Import) 스크립트를 실행하여, `Region` 노드와 `POI` 노드를 생성하고 그 사이를 `IN_REGION` 관계로 이어주어야 합니다. 데이터가 적재되면 자연스럽게 이 경고 메시지도 사라집니다.

---

## 3. metadata-project Turbopack 경고 (next-pwa 충돌)

### 🚨 현상
`npm run dev` 실행 시 Turbopack 관련 경고/에러 메시지 출력.

### 🔍 원인
Next.js 15+ 는 Turbopack을 기본 번들러로 사용하지만,
`next-pwa`는 내부적으로 webpack 설정을 주입하기 때문에 충돌이 발생한다.
개발 환경에서는 `next-pwa`가 `disable: true` 상태이므로 기능 영향은 없다.

### 💡 해결 방법
`subproject/SDUI/metadata-project/next.config.ts`의 `nextConfig` 객체에
`turbopack: {}` 추가:

```ts
const nextConfig: NextConfig = {
    turbopack: {},   // Turbopack 명시 선언으로 경고 제거
    async redirects() { ... }
    ...
};
```

---

## 4. SDUI-server compileJava 빌드 에러 (Gradle 버전 충돌)

### 🚨 현상
`./gradlew bootRun` 실행 시 Lombok `ExceptionInInitializerError` 발생
→ `AnnotationProcessingCompileTask` 초기화 실패로 컴파일 불가.

### 🔍 원인
`rm -rf gradlew && gradle wrapper` 로 wrapper를 재생성하면
시스템에 설치된 Gradle(9.5.1)이 적용된다.
Spring Boot 3.1.4는 Gradle 9.x를 공식 지원하지 않는다.

| 항목 | 문제 버전 | 호환 버전 |
|------|----------|-----------|
| Gradle | 9.5.1 ❌ | 8.x |
| Spring Boot | 3.1.4 | Gradle 7.x ~ 8.x |

### 💡 해결 방법
`subproject/SDUI/SDUI-server/gradle/wrapper/gradle-wrapper.properties` 수정:

```properties
# 변경 전
distributionUrl=https\://services.gradle.org/distributions/gradle-9.5.1-bin.zip

# 변경 후
distributionUrl=https\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
```

수정 후 configuration cache 초기화를 위해 순서대로 실행:
```bash
./gradlew clean
./gradlew bootRun
```

> ⚠️ `gradle wrapper` 명령을 다시 실행하면 시스템 Gradle 버전으로 덮어써짐.
> wrapper를 재생성할 때는 반드시 `--gradle-version 8.10.2` 옵션을 지정할 것.
> `gradle wrapper --gradle-version 8.10.2`
