# 공식 번호·관계 근거·방문 조건 구현

이 변경은 PR #293에 있으며 운영 DB 마이그레이션·실제 검증 자료 입력·CPU/Spring 배포는 아직 수행하지 않았다.

## 저장 구조

- V125는 기존 artist/holy_content/tour_poi 번호와 holy_content_poi를 보존한다.
- holy_content_artist: 콘텐츠 번호와 공식 가수 번호의 복합 키/FK. 읽기 전용 실측에서 확인한 19개 대상의 20개 연결만 ID/source_ref/slug 세 값이 맞을 때 넣는다. 이름 JOIN이 없으며 새 92개 번호를 발급하지 않는다.
- artist_place_evidence: content/artist/poi/action별 증거. URL 외에 가수·지점·행동 확인 내용, 장면/문단 위치, 검수자, 확인일, 재검토 기한을 요구한다. 기존 APPROVED는 관계 VERIFIED가 아니다.
- poi_visit_policy: 월요일=0~일요일=6의 영업 구간(분, 0~1440)과 날짜별 예외. []는 휴무, 날짜 예외가 우선한다. 자정 넘김은 각 요일로 분할한다. 비용은 검수된 1인 장소 방문비다.
- 근거/방문 정책에는 검수 당시 상호·주소·좌표도 기록한다. 원본 장소의 상호·주소·좌표가 바뀌면 낡은 검수로 추천하지 않는다.
- 검수 근거는 새 행으로 남긴다. 철회는 원래 검수자를 보존하고 철회자를 별도로 기록한다.
- 공개 뷰는 승인된 CRAWL/TOURAPI/SEED 자료만 읽는다. UGC는 제외한다.

## 서버 기능

기존 ADMIN 권한 아래:
- POST /api/admin/tour/artist-evidence/identity
- POST /api/admin/tour/artist-evidence
- POST /api/admin/tour/artist-evidence/visit-policy
- POST /api/admin/tour/artist-evidence/{evidenceId}/revoke
- POST /api/admin/tour/artist-evidence/visit-policy/{poiId}/revoke

GET /api/v1/tour/recommendation-catalog는 현재 검수된 관계·휴무일·시간·비용만 공개한다. no-store 응답이며 실제 poi_sqno를 poi:{number}로 전달한다. ADMIN 입력 화면은 추가하지 않았다.

관계 유형은 MV / ALBUM_PHOTO / CONTENT_VISIT / SNS / POPUP / COLLABORATION_EVENT를 구분한다. 협업 공지를 현장 방문으로 바꾸거나 그룹 근거를 멤버에게 상속하지 않는다.
relationship-evidence-review.json은 공식 자료 2건을 가수·지점·행동별로 기록한 검수 대기 자료다. 상위 장소와 세부 공간을 같다고 확정하지 않아 추천 승인하지 않았다.

## 코스 조건

- artistIds는 공식 숫자 번호다. artists는 표시용이며 매칭에 사용하지 않는다.
- visitDate는 사용자가 고른 YYYY-MM-DD 날짜다. 날짜 누락·잘못된 예산·이전 임시 번호만 남은 선택은 422로 거절한다.
- 4번 방문 가능 판정은 휴무일·영업시간만 사용한다. 예약·주문 마감·행사 종료·이동시간은 추가 방문 조건으로 쓰지 않는다.
- 오전 09:00~09:30, 오후 13:00~13:30, 저녁 18:00~18:30 중 열린 구간에 구간당 최대 1개 장소다. 여러 가수 선택은 각 장소에 선택한 가수 중 한 명 이상의 검증 근거를 요구한다.
- 지역·아티스트·시간·최대 방문비를 전체 현재 후보에 먼저 적용한 후 최대 15개 후보를 전달한다.
- 결과 직전 DB를 다시 읽는다. 근거 철회, 주소·시간·비용 변경, 잘못된 시간대, 생성된 가짜 ID를 제외한다. 전체 코스 방문비가 min/max를 벗어나면 결과 전체를 반환하지 않는다.
- budget은 1인 장소 방문비 합계다. 교통/숙박을 포함한 전체 여행비를 보장하지 않는다. UI와 응답 scopeNotice에 이 범위를 표시한다.
- 검증된 가수 코스에는 일반 전환 동의가 필요 없다. 가수 후보가 없고 일반 후보가 있을 때만 consent_required. 직접 true인 경우만 가수 조건을 풀며 시간/비용은 계속 검사한다.
- 일반 전환 동의는 UI false 및 API StrictBool false 기본값이다. 동의 자동 설정/자동 재시도를 하지 않는다.
- 현재는 서울 당일치기만 지원한다. 운영 검증 데이터가 없으면 빈 후보/동의 안내를 반환하며 LLM 요금을 사용하지 않는다.
- 코스는 최신 DB 후보를 직접 읽는다. 기존 다국어 Chroma 계약에는 새 DB 항목을 끼워 넣지 않는다. 전체 그래프/다른 검색 인덱스 재생성은 후속 작업이다.
- 서명된 코스 참조의 버전에도 관계·시간·비용을 포함하므로 변경된 자료로 이전 참조를 계속 쓰지 않는다.

## 검증과 적용

새 정책 unittest 25개, PostgreSQL 제약 시험 7개, 전체 Spring 보안/마이그레이션/검수 API 시험, 프론트/CPU 회귀 검사를 GitHub에서 수행한다. 로컬 프론트는 불완전한 Next.js 타입과 jsdom 누락으로 실행하지 못했으며 깨끗한 CI 결과를 확인한다. 운영 유료 생성은 수행하지 않는다.

적용 순서는 Spring V125와 검수 API → 실제 가수·지점·행동 및 시간·비용 검수 → CPU → 웹이다. 검수 자료가 비어 있으면 맞춤 코스가 비어 나오는 것이 의도된 차단 동작이다. 기존 원본을 지우거나 검수 값을 자동 채우지 않는다. 코드만 배포하고 실제 맞춤 추천이 준비되었다고 표시하지 않는다.
