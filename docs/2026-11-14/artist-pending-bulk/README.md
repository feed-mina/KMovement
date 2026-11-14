# 18명 아티스트 장소 '확인 필요(PENDING)' 일괄 등록 (2026-11-14)

민아님 승인(2026-11-14 11:12 KST): "1번(18명 일괄 '확인 필요' 업로드) 진행해줘".

SEVENTEEN(2026-11-12, `docs/2026-11-12/seventeen-review/`)과 같은 방식으로, V125가 2026-10-25 감사 기준으로 연결해 둔
아티스트-콘텐츠의 장소마다 `artist_place_evidence` 를 **PENDING** 으로 한 행씩 만든다.
VERIFIED가 아니라서 추천 코스(`verified_visit_catalog`)에는 들어가지 않고, 지도·목록에 '확인 필요' 배지로만 보인다.
Spring 재배포는 필요 없다(PR #312 이미지가 이미 운영 중).

## 결과(로컬 운영 사본 기준)

561행 추가, 재실행 시 0행. SEVENTEEN·민규(숨김) 행은 건드리지 않는다.

| 아티스트 | 장소 |
|---|---|
| BTS | 150 |
| BLACKPINK | 108 |
| TWICE | 52 |
| EXO | 37 |
| NCT | 33 |
| Red Velvet | 33 |
| 아이유(IU) | 27 |
| TOMORROW X TOGETHER | 26 |
| G-DRAGON | 21 |
| (여자)아이들 | 17 |
| DAY6 | 14 |
| ATEEZ | 11 |
| 임영웅 | 11 |
| ITZY | 9 |
| 악뮤(AKMU) | 5 |
| Stray Kids | 4 |
| 성시경 | 2 |
| IVE | 1 |

종류: 방문(CONTENT_VISIT) 약 470, SNS 약 60, 뮤비(MV) 24, 앨범·화보(ALBUM_PHOTO) 7.
종류 판정은 SEVENTEEN 규칙에 '뮤비·MV·티저', '재킷·컨셉포토', '트위터·위버스'를 더했다(이 데이터에 이 표기가 많음).

## 일부러 뺀 5건

데이터셋 설명이 그 아티스트가 아닌 사람을 가리켜서, '확인 필요'로도 띄우지 않았다.

| 아티스트 | 장소 | 데이터셋 설명 | 판단 |
|---|---|---|---|
| NCT | 볼하우스 한남 | 제니와 리사가 방문한 볼링장 | BLACKPINK 장소(BLACKPINK 쪽에는 등록됨) |
| EXO | 성읍랜드 | 로꼬의 Summer Go Loco 뮤비 촬영지 | 로꼬 |
| ITZY | 파사주 | 제니퍼(예지원)가 셰프를 하고 있는 식당 | 드라마 배역 |
| ATEEZ | 광안리해수욕장 | 현재의 수현과 태호의 변치 않는 우정이 담긴 장소 | 드라마 장면 |
| Stray Kids | 광안리해수욕장 | 위와 같음 | 드라마 장면 |

## 검수 때 볼 것

- 멤버 개인 방문이 많다: BTS는 RM 트위터 30건 안팎, BLACKPINK는 제니·로제 개인 방문·인스타가 대부분, EXO는 시우민.
  SEVENTEEN-민규처럼 멤버 행을 따로 만들지는 확정 검수 때 정한다.
- 영업 정보는 모두 2023년 값이다.

## 운영 반영 순서

1. 읽기 전용: `flyway_schema_history` 125 성공, 대상 18명 연결 확인(스크립트 첫 DO 블록이 다르면 중단).
2. 백업: `pg_dump -Fc` → `/docker/kmovement-g1/backups/kmovement-20261114-pre-artists-pending.dump`
3. 실행: `psql -U kmovement -d kmovement -v ON_ERROR_STOP=1 -1 -f apply_artists_pending_evidence.sql`
4. 확인: `GET /api/v1/tour/holy?contentSqno=415`(BTS) 등에서 `verificationStatus":"PENDING"`.
5. 되돌리기: 이번에 넣은 행만 지우면 된다.
   `DELETE FROM artist_place_evidence WHERE status='PENDING' AND source_url='https://www.data.go.kr/data/15111405/fileData.do' AND artist_id IN (SELECT artist_id FROM artist WHERE approved_yn='Y' AND slug<>'seventeen');`
