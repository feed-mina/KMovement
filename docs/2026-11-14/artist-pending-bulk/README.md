# 18명 아티스트 장소 '확인 필요(PENDING)' 일괄 등록 (2026-11-14)

민아님 승인(2026-11-14 11:12 KST): "1번(18명 일괄 '확인 필요' 업로드) 진행해줘".

SEVENTEEN(2026-11-12, `docs/2026-11-12/seventeen-review/`)과 같은 방식으로, V125가 2026-10-25 감사 기준으로 연결해 둔
아티스트-콘텐츠의 장소마다 `artist_place_evidence` 를 **PENDING** 으로 한 행씩 만든다.
VERIFIED가 아니라서 추천 코스(`verified_visit_catalog`)에는 들어가지 않고, 지도·목록에 '확인 필요' 배지로만 보인다.
Spring 재배포는 필요 없다(PR #312 이미지가 이미 운영 중).

## 결과(로컬 운영 사본 기준)

400행 추가, 재실행 시 0행. SEVENTEEN·민규(숨김) 행은 건드리지 않는다.

| 아티스트 | 장소 | 후보 |
|---|---|---|
| BTS | 109 | 150 |
| BLACKPINK | 75 | 108 |
| TWICE | 30 | 52 |
| NCT | 30 | 34 |
| EXO | 25 | 38 |
| Red Velvet | 24 | 33 |
| 아이유(IU) | 21 | 27 |
| TOMORROW X TOGETHER | 19 | 26 |
| DAY6 | 14 | 14 |
| ATEEZ | 11 | 12 |
| (여자)아이들 | 10 | 17 |
| 임영웅 | 10 | 11 |
| ITZY | 9 | 10 |
| G-DRAGON | 9 | 21 |
| 성시경 | 2 | 2 |
| IVE | 1 | 1 |
| 악뮤(AKMU) | 1 | 5 |
| Stray Kids | 0 | 5 |

종류는 SEVENTEEN 규칙에 '뮤비·MV·티저', '재킷·컨셉포토', '트위터·위버스'를 더해 판정했다.

## 왜 후보보다 적은가

`holy_content_poi` 연결에는 그 아티스트가 아닌 장소가 약 150곳 섞여 있다. 데이터셋(`tour_poi.artist`)에는
다른 가수(BTOB, 다비치, 보아 …)나 드라마·예능(대장금, 도깨비, 런닝맨 …)으로 적혀 있다.
그래서 **데이터셋에 그 아티스트 이름으로 적힌 장소만** 올린다(`tmp_dataset_name`).
이름은 맞지만 설명이 드라마 장면이거나 다른 사람 이야기인 9곳은 번호+이름으로 뺀다(`tmp_excluded`).
번호·이름이 운영과 다르면 스크립트가 중단된다.

데이터셋 이름은 다르지만 실제로는 그 아티스트 이야기인 곳이 15곳 정도 있다
(예: BTS 정국·97즈, BLACKPINK 블핑하우스). 결과 2 목록에서 사람이 확인한 뒤 따로 올린다.

## 운영 상태와 정리 SQL (2026-11-14 11:20 KST)

운영에는 이 SQL의 **이전 판(데이터셋 표기 확인 없음)** 으로 566곳이 이미 PENDING으로 올라갔다(백업
`/docker/kmovement-g1/backups/kmovement-20261114-pre-artist-batch.dump`).
`fix_artists_pending_attribution.sql` 이 그 566곳 중 다른 가수·드라마·예능으로 적힌 166곳을 REVOKED로 내리고
남은 400곳의 종류를 다시 매긴다. 운영과 같은 상태를 로컬에서 재현해 돌린 결과가 현재 판 apply SQL을
빈 상태에서 돌린 결과와 행·종류까지 같았다. 재실행하면 수가 맞지 않아 중단된다(이미 적용됨).

## SEVENTEEN 정리(별도 승인 필요)

같은 문제가 11-12에 올린 SEVENTEEN 62곳에도 있다. `revoke_seventeen_other_artist_rows.sql` 은
그중 16곳(이승기, 겨울연가, 도깨비, 런닝맨, 로꼬, 로제 뮤비 등)을 삭제하지 않고 REVOKED로 바꾼다.
고잉세븐틴·세븐틴 리얼리티·97즈 모임 4곳은 남긴다. 로컬에서 PENDING 46 / REVOKED 16 확인.

## 검수 때 볼 것

- 멤버 개인 방문이 많다: BTS는 RM 트위터 30건 안팎, BLACKPINK는 제니·로제 개인 방문·인스타가 대부분, EXO는 시우민.
  SEVENTEEN-민규처럼 멤버 행을 따로 만들지는 확정 검수 때 정한다.
- 영업 정보는 모두 2023년 값이다.

## 운영 반영 순서

1. 읽기 전용: `flyway_schema_history` 125 성공, 대상 18명 연결 확인(스크립트 첫 DO 블록이 다르면 중단).
2. 백업: `pg_dump -Fc` → `/docker/kmovement-g1/backups/kmovement-20261114-pre-artists-pending.dump`
3. 실행: `psql -U kmovement -d kmovement -v ON_ERROR_STOP=1 -1 -f apply_artists_pending_evidence.sql`
3-1. (민아님 승인 시) `psql ... -1 -f revoke_seventeen_other_artist_rows.sql` — 되돌리기는 같은 16곳을 `status='PENDING', revoked_at=NULL, revoked_by=NULL` 로.
4. 확인: `GET /api/v1/tour/holy?contentSqno=415`(BTS) 등에서 `verificationStatus":"PENDING"`.
5. 되돌리기: 이번에 넣은 행만 지우면 된다.
   `DELETE FROM artist_place_evidence WHERE status='PENDING' AND source_url='https://www.data.go.kr/data/15111405/fileData.do' AND artist_id IN (SELECT artist_id FROM artist WHERE approved_yn='Y' AND slug<>'seventeen');`
