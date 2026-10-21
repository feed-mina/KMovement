# KMovement 참고 저장소 적용 설계와 후속 작업

분석 기준: `111988aedf613aef1355db647931ebdf66e2a0d9` (main 고정 커밋).

- [쉬운 적용 안내](./kmovement-easy-guide-20261021-1013.md)
- [소스 연결·검증 계획](./kmovement-fix-guide-20261021-1013.md)
- [HTML 보고서 위치](https://github.com/feed-mina/ME/tree/main/docs/2026-10-21/kmovement-github-references)

## 확인한 것

관련 파일 31개와 현재 CPU 코스·채팅 호출 경로를 확인했다. 일반 검색과 검수된 다국어 검색을 구분했다. RouteScreen은 비어 있지 않은 budget을 보내면서 acknowledgeUnverifiedConditions를 보내지 않고, 서버는 기본 false에서 422를 반환하는 분기가 있다. 이는 정적 분석 결과이며 실제 배포 재현은 미실행이다.

## 다음 담당 작업

1. 요청 모델·동의 값·지원 범위를 진입점별로 대조하는 계약 검증.
2. 지역·장소·유형의 포함/제외 모델과 일반·검수 검색 공통 적격 후보 규칙.
3. 기존 ground_plan·출처 재조회·서명된 코스 문맥을 보존한 답변 평가.
4. max_retries=0·비용 예약·슬롯 제한을 유지한 오류 관측과 취소 검증.
5. 실제 프록시 계약·사용자 흐름·새 holdout 평가.

제품 코드·운영 데이터·배포 설정은 변경하지 않았다. 기존 시험은 읽었지만 전체 제품 시험은 실행하지 않았다. HTML 구조·SVG·내부 링크·스크립트 문법은 확인했고 브라우저 실제 렌더링은 미확인이다. 별도 인계 메시지는 발송하지 않았다.
