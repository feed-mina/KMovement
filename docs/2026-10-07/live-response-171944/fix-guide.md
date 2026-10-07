# 테스트 한도 배포와 실제 응답 검증 근거

## 수정 위치와 이유

src/api/itinerary_budget.py는 서버 allowlist에 한해 100회 예외를 적용하고 합산 5달러·일반 그룹 1달러를 SQLite 트랜잭션으로 제한합니다. src/api/shared_admission.py와 ai_runtime.py는 두 Linux flock을 공유해 운영/검증 프로세스를 합쳐 동시 2건으로 제한합니다. 사용자 요청으로 계정 등급을 지정할 수 없습니다.

## 병합·배포 증거

PR #281, merge 7d123d93746584fac5bdc200a81ac44c7a7b86d2. 실행된 PR 검사 7개 성공, Preview 1개 건너뜀. 발행 run 37589791795의 131개 검사 성공(실패·오류·skip 0). main CI도 성공, EC2 배포 run은 skipped입니다. CPU image digest ac97e4f35adcf8a0d7053f14b4d78ac1e62c709b0818f70d98a0105999dfead5. 실제 OCI revision과 RepoDigest를 확인했습니다.

## 시험 경계와 실제 확인

별도 loopback HTTP 시험 서비스, readonly root, cap drop ALL, no-new-privileges, CPU1·메모리4GiB·swap 추가0·pids256, 임시 Chroma를 사용했습니다. 원본 Chroma는 연결하지 않았습니다. 실제 제공자 호출용 키와 공통 비용/동시성 장부만 서버 내부에서 제한적으로 연결한 서비스 시험입니다. 외부 네트워크를 완전히 차단했던 이전 격리 검색과는 다른 단계입니다. SQLite inode/UID와 같은 두 flock의 경합을 양쪽 서비스에서 확인했습니다. 잠금 probe 동안 신규 AI 요청의 admission이 잠시 대기할 수 있습니다.

## 기동 실패와 복구

첫 bootstrap은 고정 벡터 SHA가 달라 실제 요청 전에 중단했습니다. 이전 시험의 전체 문서 encode(batch_size=8)와 외부 8/3 분할 방식이 달랐습니다. 전체 문서 단일 encode와 torch thread1로 맞춘 뒤 기존 문서/벡터 SHA에 일치했습니다. 질문·문서·정답·프롬프트·통과 임계값은 변경하지 않았습니다. 이 일치는 배치 차이 가설을 지지하지만 다른 환경의 비트 단위 재현을 보장하지 않습니다.

## 실제 응답 시험

실제 loopback HTTP 요청4/완료3/HTTP502 1/미시도47, frozen denominator51. collector status=stopped_incomplete이고 종료코드0을 통과로 해석하지 않습니다. public_chat.py:148–156은 공급자 예외를 일반502로 숨기므로 rate-limit/timeout/auth 등을 특정하지 못합니다. 예약4건 $0.0091257, usage기록3건 추정 $0.00145725, 계정잔여96회. 이는 제공자 청구서와 대조한 금액이 아닙니다. 응답파일 SHA301e0c75beb42689616326b40e11da7514641bba3662ad97874c0bf4b80c9a70. 독립 AI 검수: 관찰된 한국어 양성3개에서 언어·대상·지원 사실·출처 일치, 과거절0. 한국어 양성 분모11 중3만평가했으므로 gate 통과가 아닙니다. 영어/일본어 및 근거없는 속성 거절 문항은 미평가. 첫 content 수신시간은 의미있는 첫답변 p95 또는 실제 로그인 성능을 대신하지 않습니다.

## 시험 해석과 미완료 gate

51문항은 양성33+근거없음18, 언어별 양성11+근거없음6이며 독립 관측51개가 아닌 번역군17개입니다. HTTP collector는 signed courseContext를 주입한 답변 생성 시험입니다. 실제 코스 생성, 검색 종합 성능, 브라우저 로그인·화면 첫 응답·중단·재시도를 대신하지 않습니다. 비공개 원시 질문/답변/정답은 보고서에 넣지 않았습니다. 독립 검수는 별도 AI 에이전트의 검수이며 사람 검수로 표현하지 않습니다.

## 고정한 증거

runtime/source 50,356파일 manifest SHA ee127c2c2b0bdfab8b5a287c09b33ad96fc0b7680205998fa49fbadbea697d3a; 모델10파일 별도 동결. execution lock 65d6b74d7be87aaf984ec8c149ceeee60827194982006b90d15fe39b304c99ae; collector 563abb532a5ac26f534a051b8ea7abd0a5b7888e867671c49184aceed6226a95. 제공자 모델 openai/gpt-oss-120b, temperature0, max_completion_tokens2048. 제공자 모델 가중치의 역사적 동일성은 확인할 수 없습니다.

## 후속 작업과 실패 대응

공급자 오류를 비밀정보 없이 분류할 수 있도록 관측 근거를 보완하고, 새 시험 계획과 로그인 검사 경로를 준비합니다. 기존 시험 결과를 보고 프롬프트나 임계값을 고쳐 같은 holdout의 통과 결과로 제시하지 않습니다. 답변 정책 변경이 필요하면 개발용 실패 분류와 새 독립 holdout을 분리합니다. 운영 공개는 검색·출처·거절/과거절·성능·로그인 gate 완료 후 exact image/collection/catalog/config를 함께 고정합니다.

## 다음 수정 명세 — 아직 미구현

public_chat.py의 공급자 연결 예외에서 예외 종류·상태코드·허용된 retry-after·연결 요청 식별자만 서버 내부 기록으로 남기는 방안을 먼저 검토합니다. 프롬프트·원시 응답·키·쿠키·계정 식별자는 기록하지 않습니다. rate-limit/auth/timeout/upstream 오류를 합성 응답으로 구분 검증하고, 실제 공급자 원인 확인 후 새 실행 명세에 호출 간격과 중단 기준을 고정합니다. 이번 실패를 속도 제한이라고 가정해 임의로 재시도하지 않습니다. 사용자에게 필요한 행동은 지금 없으며, 완료 증거는 비민감 오류 분류·새 명세 해시·실제 로그인 검사입니다.

## 복구와 보존

이전 CPU digest d7579ff8502166b6d9a74fecd5ef5221fa96e56b2d43a36d352654a7dcffb767, 이전 compose와 비공개 환경 백업을 보존했습니다. 배포 실패 시 이전 이미지/설정을 복구하고 health를 확인하는 경로가 있습니다. 이번 배포는 성공해 실제 rollback은 실행하지 않았습니다. 원본·기존 컬렉션 수정/재색인 없음. 시험 컨테이너 종료와 운영CPU healthy를 확인했습니다. 임시 검색 컬렉션은 tmpfs였으며 운영에 연결하지 않았습니다. 비공개 응답·검수 증거는 보존했습니다.
