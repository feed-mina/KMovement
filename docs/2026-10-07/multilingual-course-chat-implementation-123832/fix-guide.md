# 다국어 코스·챗봇 — 구현 근거와 남은 배포 조건

## 결론과 경계
구현 초안과 20개 후보의 검수 패킷을 준비했다. 새 공개 적격 후보는 **0개**이며 독립 검수·gold·holdout·실제 수용 검사 전이다. 운영 전환을 요청받았지만 사용자가 정한 all-pass 조건은 아직 충족하지 못했다. 자동 승인 거절이나 새 배포 승인 요구가 아니다. 독립 검수 담당 선택이 남았다.

코드 commit `e617f7aaf4d88e25f2810d962d03224e55603e44`, Draft PR [#280](https://github.com/feed-mina/KMovement/pull/280), 기반 `feat/artist-profile-followup` / `c63aafd6fea140ad5426aed8c8c5224b38e5e2a9`. 기존 UI 변경을 포함한 분리 작업트리에서 작업했다.

## 1. 후보 계약
`review-catalog-draft.json`은 `kride-reviewed-multilingual-v2` 초안이다. 각 장소의 ID·원문명·ko/en/ja 명칭·공식 URL·출처 SHA256·근거 구간·좌표·지역을 묶었다. 가격과 아티스트 관계는 unknown이다. 모든 상태는 pending이며 검수자가 독립적으로 판단해야 한다.

`review-status.json`의 catalogSha256은 정확한 초안 파일을 가리킨다. 청계천 외국어 명칭 두 건은 직접 HTTP 라이브러리의 TLS 실패 뒤 웹 열람으로 확인한 짧은 발췌의 해시다. 전체 HTML 해시로 해석하지 않는다. PDF의 오래된 행사 소개는 이름 근거로만 사용했으며 현재 공연·가격 근거가 아니다. 이름·좌표가 페이지에서 발견된 것과 독립 검수는 구분했다.

사전 교체: 경복궁→대한민국역사박물관, 창덕궁→서울돈화문국악당, 덕수궁→서울남산국악당, 종묘→청계천박물관. 시설 검색이 전체 장소 대신 일부 건물을 반환하거나 정확한 시설이 없어서 시험 전에 교체했다. 성적을 보고 후보를 제거한 것이 아니다.

## 2. 구현 파일과 동작
| 파일 | 변경과 검증 범위 |
|---|---|
| src/api/course_context.py | 1시간 유효한 사용자별 서명에 장소 ID·순서·목록 revision을 묶음. 서명·사용자·만료·현재 출처 변경 시 거절. 서버 저장 레코드 대신 서명된 문맥과 현재 공개 목록 재조회를 사용 |
| src/api/multilingual_catalog.py | 작성자/검수자 분리 및 정확한 승인 파일 해시, 항목별 공식 근거 검사. 새 collection create-only. 차원384·유한 float32·norm 오차≤1e-5 검사. 원본 upsert/delete 없음 |
| src/api/public_search.py | 명시적 새 목록 환경 설정이 있을 때만 검수 목록 사용. 색인 metadata·모델 revision·문서 해시·개수 불일치 차단. 기존 경로는 유지 |
| src/api/torchserve_client.py | 새 목록 사용 시 모델 revision 필수, 로컬 캐시만 로딩. unversioned TorchServe 경유 차단. 모델 실제 가중치·tokenizer·라이브러리 해시 고정은 실행 준비에 남음 |
| src/api/public_itinerary.py | 미검증 가격/아티스트 조건 안내에 대한 확인, 검토된 이름으로 지도·일정 재구성, 문맥 발급 |
| src/api/public_chat.py | 코스 문맥은 실제 사용자와 현재 목록으로 확인. 언어 선택과 학습 채팅 모드 분리. 코스 질문에서 기존 순서·장소 사용 |
| KrideFocusScreen / useKrideItinerary | 생성 전 지원 범위와 언어 선택, 코스 아래 대화. 서버 오류의 detail 전달 |
| KrideChatComponent / useKrideChatStream / API proxy | locale와 서명 문맥 전달, 언어 변경 시 대화 초기화. 코스 설명 요청을 자동 재생성으로 처리하지 않음 |

이름 매칭은 개발 변경이며 query 접두사 A/B 실험과 다르다. 고정 벡터 A/B와 문서 형식 C, 이름 매칭을 섞어 개선 원인을 주장하지 않는다. 부정문·모호한 지점·근거 없는 질문은 새 평가 대상이다. 요청 ID 기반 중복 청구 방지와 코스 교체 UX는 이번 코드만으로 완료를 주장하지 않는다.

## 3. 실행한 검사
| 검사 | 결과 | 한계 |
|---|---|---|
| CPU 계약 회귀 | 54 passed, 2026-10-07 12:34 실행 기록 | 모의 모델·DB. 검색 품질/실제 생성 미검사 |
| 프론트 핵심 3개 파일 | 21 passed | API 전달·상태 수명주기 중심; 실제 로그인 아님 |
| TypeScript | 통과 | 제품 화면·접근성 수용 검사를 대신하지 않음 |
| 새로운 공개 목록 | 20개·60개 언어 표기 근거 초안 | 독립 검수 완료 0개 |
| 새 holdout 120문항 | 미고정·미실행 | 정답·담당·접근 분리 필요 |
| 실제 검색/LLM/성능/로그인 | 미실행 | 배포 gate 미통과 |

CPU 단위 검사는 exact image `ghcr.io/feed-mina/kmovement-cpu@sha256:d7579ff8502166b6d9a74fecd5ef5221fa96e56b2d43a36d352654a7dcffb767`에서 실행했다. 네트워크 없음, read-only root, 비root, cap-drop ALL, no-new-privileges, 1CPU·2GiB·pids128, tmpfs256MiB. 새 입력 파일만 readonly 연결하고 archive 및 파일 해시를 확인했다. 운영 volume·인증정보·socket은 연결하지 않았다. 이것은 새로운 검색 파일럿 실행이나 최종 운영 이미지 빌드가 아니다.

## 4. 독립 검수 후 필요한 시험
1. 다른 검수자가 동일 장소/지점·명칭·좌표를 검토한다. 정답 검수자 간 불일치도 기록한다. 초안 변경 시 새 파일과 승인 해시로 고정한다.
2. 각 언어 양성30·근거없음10, 총120문항을 새로 고정한다. 개발 질문과 의도·템플릿 묶음을 분리한다. 시험 원문은 보고서에 공개하지 않는다.
3. 코드·모델 revision 및 가중치/tokenizer/config·Linux 라이브러리·입력·문서·출력경로를 해시로 고정하고 자원/네트워크 경계를 재검증한다.
4. 기존 제안 기준을 실행 전에 확정한다: 언어별 Recall@5≥0.80, nDCG@10≥0.70, baseline 하락≤0.02, ANN Recall@10≥0.99. 근거없는 주장 수락0/분모, 양성 과거절≤5%(30개 중 최대1). 이 숫자는 이번 통과 결과가 아니다.
5. 응답 언어·코스 순서·지도·출처 일치, 실제 로그인·취소·재시도·로그아웃·계정 전환·429·공급자 오류를 검사한다. 첫 유효 응답 p95≤10초, 코스 완료 p95≤30초 제안, cold10/warm30 구분. 전체 검사를 한도 안에서 수행하며 모의 결과를 유료 실측으로 대체하지 않는다.
6. holdout을 본 뒤 변경하면 다음 버전은 새 시험으로 평가한다. 작은 서울 공개 목록 통과를 1,000개 또는 원본40,664개 검색 품질로 확대하지 않는다.

## 5. 배포와 rollback
모든 gate 통과 후 새 exact CPU/web image digest와 별도 collection·catalog/review SHA·설정 revision을 하나의 release manifest로 묶는다. 현재 운영 digest/collection/config를 rollback 대상으로 먼저 기록한다. 이번에 새 image를 publish하거나 운영 설정을 적용하지 않았다.

테스트 계정으로 제한된 실제 수용 검사 → 전환 → 응답/출처/오류 관찰 → 실패 시 이전 exact release로 복귀한다. 이전 collection과 원본 DB는 보존한다. 일일 $1·사용자10회·동시2건을 유지한다. 데이터·출처 검수가 실패한 상태에서 guard나 계약 이름만 바꿔 공개하지 않는다.

## 다음 행동
독립 검수 담당 선택 답변을 받은 뒤 검수·새 gold/holdout 고정을 진행한다. 터미널 재실행이나 새로운 배포 권한 승인을 요청하는 단계가 아니다. 검수 패킷과 PR을 보존해 이어서 실행할 수 있게 했다.
