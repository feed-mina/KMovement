# CI 실패 원인·수정·병합·운영 공개 조건

## 확인과 결과
실패한 commit은 `f7705ad92ecd8bf09676d412c810ef0e4d618b58`이다. Next.js의 KrideFocusScreen 테스트 6개가 새 생성 전 확인 화면을 반영하지 않아 실패했다. 제품 코드의 확인 단계를 제거하지 않고 테스트 진입 절차를 실제 계약에 맞췄다.

수정 commit: `29c4c30405ee5e8705bb7cf4305ca0fdc4104dd4`.
main merge commit: `92e3d271a3aa4199a03c5fb668249963a43ecb25`.
2026-10-07 13:14:50 KST 병합. PR #277에 #278·#279·#280의 변경이 포함된다.

## 변경 파일과 검증
`subproject/SDUI/metadata-project/tests/components/KrideFocusScreen.test.tsx`에서 다음을 검사한다.

- 확인 체크와 생성 버튼을 거친 뒤 오류·채팅 동작 검사.
- 처음부터 열리지 않는 모달을 실제 열기 버튼으로 열고 dialog 내부로 쿼리 범위를 한정.
- Escape, Tab 순환, 열기 버튼으로 초점 복귀 검사 유지.
- 확인 전 generation enabled=false, 버튼 비활성화, 일본어 선택 후 locale·acknowledgement·enabled 전달 검사 추가.
- 로그인 오류는 로그인으로, 후보 없음은 무의미한 재시도 대신 안내로 연결하는 검사 유지.

PR 최종 HEAD에서 CI 실행 검사 10개 성공: nextjs, sdui-server, fastapi, cpu-image, spring-platform, mobile-address, web-image, compose 2개, traefik-compose. Supabase Preview는 skipped이며 성공으로 세지 않는다. Next.js 전체 테스트와 빌드 단계가 성공했다. 원시 로그의 모든 항목 통과 요약 100줄에서 587개 테스트가 집계되며, 이 수치는 실제 모델 품질 점수가 아니다.

GitHub의 깨끗한 의존성 설치·전체 테스트·빌드 결과를 근거로 삼았다. 같은 검사를 준비하던 Windows 로컬 npm 설치는 CI 통과 후 불필요해져 이 작업의 해당 프로세스만 중단했다. 로컬 전체 테스트 완료를 주장하지 않는다.

## main 병합 영향 확인
정확한 head SHA를 지정해 merge했다. RunPod 경로 변경이 없고 EC2 자동 배포 조건은 opt-in이다. Hostinger 이미지 발행은 workflow_dispatch이며 이 작업에서 정확한 main merge SHA로 웹·CPU 발행을 요청했다. 이미지 레지스트리 발행과 운영 컨테이너 교체는 별개다.

웹 발행 run: https://github.com/feed-mina/KMovement/actions/runs/37570577442
CPU 발행 run: https://github.com/feed-mina/KMovement/actions/runs/37570569992

## 보존과 rollback 준비
운영 컨테이너를 읽기 전용으로 조회해 기존 web/spring/CPU image digest, compose 파일 SHA256, mount 정보를 기록했다. 비밀 환경 값은 출력하지 않았다. 관찰 당시 세 컨테이너 healthy는 현재 상태 참고이며 새 기능 수용 성공을 뜻하지 않는다. 운영 서비스·원본·기존 collection을 교체하거나 재색인하지 않았다.

## 아직 통과하지 않은 공개 조건
| 항목 | 현재 상태 | 통과 근거 |
|---|---|---|
| 후보·세 언어 명칭 | 20곳·60표기 근거 초안 | 작성자와 분리된 장소·좌표·명칭 검수 및 승인 파일 해시 필요 |
| 새 정답·holdout | 미고정 | 언어별 양성30+근거없음10, 총120문항. 개발·시험 템플릿/의도 분리 |
| 검색 품질 | 미실행 | R@5≥0.80, nDCG@10≥0.70, baseline 하락≤0.02 제안. 실행 전 확정 |
| ANN | 미실행 | exact 대비 Recall@10≥0.99 제안; 문서 변경 C와 고정 벡터 A/B 분리 |
| 출처·거절·과거절 | 미실행 | 공개 필수 근거 검수100%, 근거없는 주장 수락0/분모, 양성 과거절≤5% 제안 |
| 응답·성능 | 미실행 | 언어·장소·순서·지도·출처 일치. 첫 유효 응답 p95≤10초, 코스완료 p95≤30초 제안 |
| 로그인 수용 | 미실행 | 실제 로그인·언어3종·중단·재시도·로그아웃·계정전환·429·공급자 오류 |

숫자는 새 시험 통과 결과가 아니다. 독립 검수 담당 선택을 기다린다. 새 시험을 본 뒤 수정하면 다음 버전은 새 시험을 사용한다. 모델 가중치·tokenizer·config·Linux 의존성 개별 해시와 실행 경계 재검증도 필요하다. 생성 호출은 합산 $1/일·사용자10회/일·동시2건을 유지한다.

모든 gate 통과 후 exact image digest·새 collection·catalog/review SHA·설정 revision을 하나의 release로 고정한다. 이전 image/collection/config를 rollback 대상으로 유지하고 승인되지 않은 초안이나 계약명만으로 guard를 통과시키지 않는다.


## 이미지 준비 시점 기록
main 병합 후 CI run 37570542162도 성공했고 EC2 배포 run 37570542183은 skipped다. 웹 이미지 발행은 성공했다. CPU 이미지 run 37570569992는 보고서 기록 시점 빌드 중이다. `images.json`과 실행 링크로 후속 결과를 재확인해야 한다. 웹 이미지 발행은 운영 배포 완료가 아니다.
