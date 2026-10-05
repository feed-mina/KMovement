# 탐색 UI 검증 기록

기준: origin/main 1c40459045bd9b8c02a85db73902f8b895e7a821.
브랜치: feat/tour-explore-map-ui.
브라우저 비교는 동일한 예시 데이터로 수행하며 운영 공개 API 검증은 별도로 기록한다.

## 구현 및 검증 결과

- 시간 카드, 검색·필터, 카드↔핀 연결, 오류 복구를 독립 커밋했다.
- Jest 5개 묶음 / 47개 테스트 통과.
- 현재 소스 타입 검사 통과: `tsc --noEmit --incremental false --project tests/e2e/tsconfig.review.json`.
- 일반 tsconfig는 과거 `.next/types`에 남은 삭제된 seoul-food/seoul-kpop 경로 때문에 실패했다. 검증 설정은 생성된 캐시만 제외하고 현재 소스·테스트를 검사한다. production build는 이번에 실행하지 않았다.
- 360/390/768/960/1440px: 가로 넘침 없음, 브라우저 pageerror 없음, 검색·필터 초기화·지도 오류 안내 검증.
- 같은 5개 폭에서 카드→지도 선택, 핀→카드 강조·초점 이동 검증. 지도 SDK는 테스트 대역이며 실제 카카오 타일 확인과 구분한다.
- 공개 API GET: 맛집·관광지·성지·지역 응답 확인. 맛집 첫 조회는 25초 시간 초과 후 재조회 200이었다.
- main 병합·원격 push·운영 배포 미실행. ChromaDB/pgvector와 DB 쓰기 변경 없음.

## 캡처 출처

`baseline/`: 현재 운영 UI + 브라우저에서만 주입한 장소 예시 데이터. 정확한 배포 이미지 SHA는 미확인.
`after/`: 로컬 수정 UI + 같은 예시 데이터. 지도 SDK 요청을 차단해 독립 실패·복구 UI 검증.
`map-interaction/`: 로컬 수정 UI + 같은 예시 데이터 + 화면에 명시한 SDK 이벤트 테스트 대역.

Windows의 D→C 의존성 연결 오류 때문에 브라우저 서버는 C드라이브 검증 작업공간에서 실행했다. 앱 변경 7개 파일을 줄바꿈 정규화 후 비교해 D드라이브 커밋 소스와 모두 동일함을 확인했다. D드라이브 의존성 원본 및 부분 복사본은 루트의 Git 제외 `node_modules/` 아래 보존했다.

## 재실행

웹 프로젝트에서 정상 설치된 의존성으로 로컬 서버를 실행한 다음:

```text
node tests/e2e/tour-explore-review.cjs after
REVIEW_MAP_FIXTURE=1 node tests/e2e/tour-explore-review.cjs map-interaction
```

두 번째 명령은 셸에 맞게 환경변수를 설정한다. SDK 이벤트 테스트 대역은 로컬 서버에 비밀값이 아닌 `NEXT_PUBLIC_KAKAO_MAP_APP_KEY=local-review-placeholder`를 사용한다. 실제 카카오맵 승인을 의미하지 않는다.

다음 행동: 브랜치 변경·보고서 검토 → 사용자 승인 → main 병합·배포 → 승인 도메인에서 실제 SDK 및 실제 데이터 검증.
