# KMovement F2 모바일 주소검색 Fix Guide

> 기준: 2026-10-04 · `origin/main` `963b8d479daea0eb2ec5d1c7f3576a0a87c7c591` · 분석만 수행

정적 HTML 검사는 통과했다. 내장 브라우저의 로컬 런타임 자산 경로 오류로 클릭·키보드·좁은 화면 검증은 수행하지 못했다.

## 최종 목표

모바일 주소검색 한 경로만 Hostinger에 안전하게 공개하고, 정상·빈 결과·공급자 오류·네트워크 오류·직접 입력을 자동 테스트와 Android 실기기 증거로 검증한다.

## 핵심 결론

앱·Spring 계약은 이미 존재한다. 그러나 G1 운영 profile의 Kakao REST key는 비활성값이고, Compose에는 Kakao secret과 주소 전용 Traefik router, 확인된 공용 proxy network 연결이 없다. 현재 기본 CI도 mobile 주소검색 Jest와 Spring 주소 테스트를 실행하지 않는다.

## 3줄 줄거리

1. 모바일은 `OPEN_POSTCODE`를 받으면 `AddressSearchModal`을 열고 두 글자 이상을 Spring으로 보낸다.
2. Spring은 REST key를 서버에 숨긴 채 Kakao Local 주소 검색을 호출하고 최대 10건을 앱 계약으로 바꾼다.
3. F2 완료에는 Hostinger secret·정확한 GET route·공용 proxy network·다섯 경우의 자동/실기기 증거가 필요하다.

지금 나는 [기능별 Hostinger 배포] 중 [F2 모바일 주소검색]의 [정적 코드 계약 확인 완료, 운영 연결 설계 전]에 있다.

## 확인된 현재 흐름

1. `subproject/SDUI/kride/packages/core/src/hooks/useBusinessActions.ts:258-266`
   - `OPEN_POSTCODE` callback이 선택 결과를 `zipCode`, `roadAddress`에 기록한다.
2. `subproject/SDUI/kride/apps/mobile/app/[screenId].tsx:56-60,91-93,175-183`
   - callback 존재 여부로 모달을 열고 runtime API base를 전달한다.
3. `subproject/SDUI/kride/apps/mobile/src/components/AddressSearchModal.tsx:76-101`
   - 2자 미만 차단, GET 호출, non-2xx와 fetch 오류 안내를 처리한다.
4. `AddressSearchModal.tsx:141-201`
   - empty, 결과 선택, 직접 입력 fallback을 제공한다.
5. `AddressSearchController.java:30-40`
   - 정상은 `{items}` 200, 예외는 빈 items와 메시지를 담은 502다.
6. `AddressSearchService.java:24-59,63-102`
   - Kakao 주소 API에 `Authorization: KakaoAK ...`, `size=10`, `analyze_type=similar`로 요청한다.
   - 우편번호와 도로명 주소가 없는 결과는 제외한다.
7. `SecurityConfig.java:125-126`
   - GET 주소검색 경로를 비로그인 공개한다.

## 현재 차단점

### 1. Kakao REST key

`application-hostinger-g1.yml:45-48`은 `kakao.client-id: disabled-g1`이다. `g1.compose.yml`의 file secrets는 DB, Redis, JWT뿐이다. 실제 REST key를 모바일 bundle이나 Git에 넣지 말고 Spring용 file secret으로 추가해야 한다.

### 2. 외부 route

`g1.compose.yml:112-123`은 `/api/platform/health`만 Traefik에 공개한다. F2에서는 `Host + Method(GET) + Path(/api/v1/address/search)`를 정확히 추가하고 `/api/**` 전체 공개를 금지해야 한다.

### 3. proxy network

Spring은 내부 `g1` network에만 연결된다. 실제 VPS의 기존 Traefik network 이름은 저장소만으로 확정할 수 없다. 배포 전 읽기 전용 preflight로 실제 이름을 확인하고, Spring만 내부 DB망과 proxy망에 이중 연결해야 한다. PostgreSQL과 Redis는 내부망에만 남긴다.

### 4. timeout과 오류 상한

`AddressSearchService`는 `retrieve().bodyToMono(...).block()`을 사용하며 F2 전용 connect/response timeout이 코드에 보이지 않는다. upstream base URL과 timeout을 설정으로 분리해 mock upstream 테스트와 장애 시간 상한을 고정하는 편이 안전하다.

### 5. CI 공백

- 모바일 테스트 파일에는 정상 선택, non-2xx 후 직접 입력, 2자 제한이 있다.
- Spring 테스트에는 응답 매핑, 지번 전용 제외, malformed body가 있다.
- 하지만 기본 Spring CI는 build에서 test를 제외하고 Celery 테스트만 실행한다.
- G1 통합 CI도 주소 외부 호출과 mobile Jest를 실행하지 않는다.

## 구현 순서

1. 실제 Traefik network 이름과 현재 KMovement Spring 배포 여부를 읽기 전용으로 확인한다.
2. Kakao REST API key용 file secret을 추가하고 secret 값 출력 금지 검사를 둔다.
3. Spring을 `g1 + 확인된 proxy network`에 연결한다.
4. 주소 GET exact router만 추가하고 기존 health, DB, Redis 경계를 보존한다.
5. Kakao base URL과 timeout을 테스트 가능하게 분리한다.
6. mobile, Spring, security, Compose F2 테스트를 추가한다.
7. PR에서 자동 테스트를 통과시킨다.
8. main 병합·이미지 게시·VPS secret 생성·실제 배포는 별도 사용자 확인 뒤 수행한다.
9. Android에서 다섯 경우를 확인하고 같은 배포 기록에 main SHA와 digest를 남긴다.

## 완료 기준

| 영역 | 통과 기준 |
|---|---|
| 정상 | 실제 주소 최대 10건, `zipCode`와 `roadAddress`, 선택 후 폼 반영 |
| 빈 결과 | 200과 빈 items, 앱은 검색어 변경·직접 입력 안내 |
| 공급자 오류 | Spring 502, 앱은 중단 없이 직접 입력 제공 |
| 네트워크/timeout | 제한 시간 안에 실패 안내, 직접 입력 제공 |
| 직접 입력 | 5자리 우편번호와 주소가 callback을 통해 폼에 반영 |
| 보안 | REST key가 모바일 bundle·응답·Git·로그에 없음 |
| 공개 범위 | exact GET 한 경로만 추가, DB/Redis published port 0개 |
| 기록 | main SHA, Spring image digest, config revision, target, rollback digest |

## 제안 검증 명령

이번 보고서에서는 실행하지 않았다.

모바일 위치: `subproject/SDUI/kride`

```bash
pnpm --filter @kride/mobile test -- --runInBand src/__tests__/AddressSearchModal.test.tsx
```

예상 결과: 정상·empty·502·fetch reject·manual 테스트 PASS.

Spring 위치: `subproject/SDUI/SDUI-server`

```bash
./gradlew test --tests "*AddressSearchServiceTest" --tests "*AddressSearchControllerTest"
```

예상 결과: 입력·매핑·upstream 오류·timeout·security 계약 PASS.

## 에이전트에게 전달할 요청문

```text
목표: feed-mina/KMovement origin/main 963b8d4 기준으로 F2 모바일 주소검색만 Hostinger에 안전하게 공개하고 실제 Android에서 검증한다.

확인된 사실:
- 모바일 AddressSearchModal은 2자 검색, 결과 선택, empty/error 안내, 직접 입력을 구현한다.
- Spring GET /api/v1/address/search는 Kakao Local REST API를 서버에서 호출하고 예외를 502로 반환한다.
- G1 profile의 Kakao client-id는 disabled-g1이고 Compose secret에는 Kakao REST key가 없다.
- G1 Traefik label은 health만 공개하며 Spring은 내부 g1 network에만 있다.
- 현재 기본 CI는 mobile 주소 Jest와 Spring 주소 테스트를 실행하지 않는다.

맡길 범위:
1. 실제 Traefik 공용 network 이름을 읽기 전용 preflight로 확인하고 Spring만 g1+proxy network에 연결한다.
2. Kakao REST API key를 Git/로그에 노출하지 않는 file secret으로 주입한다.
3. Host+GET+정확한 /api/v1/address/search router만 추가한다. 전체 /api 공개는 금지한다.
4. WebClient timeout과 공급자 오류의 502 계약을 테스트 가능하게 만든다.
5. mobile과 Spring에서 정상, empty, 공급자 오류, network/timeout, manual fallback 테스트를 CI에 추가한다.

완료 기준:
- compose config 통과, DB/Redis 외부 포트 0개, secret 값 미노출
- 무인증 GET만 통과하고 다른 method·경로는 기존 정책 유지
- 실제 주소 최대 10건, zipCode/roadAddress, empty 200, 공급자 실패 502
- Android에서 선택값이 폼에 반영되고 네트워크 실패 후 직접 입력 가능
- main SHA, image digest, config revision, target, rollback digest 기록

권한 경계:
- PR까지 수행하고 main 병합, image publish, VPS secret 생성, 실제 배포는 별도 사용자 확인 전 실행하지 않는다.
```

## 공식 문서

- [카카오맵 REST API — 주소로 좌표 변환](https://developers.kakao.com/docs/ko/kakaomap/rest-api)
- [카카오 보안 권장 사항](https://developers.kakao.com/docs/ko/getting-started/security-guideline)
