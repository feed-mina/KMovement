# 아티스트 18명 장소 근거 일괄 PENDING 등록 (2026-11-14)

민아님 승인(2026-11-14): "1번(18명 일괄 '확인 필요' 업로드) 진행해줘".
SEVENTEEN(`docs/2026-11-12/seventeen-review/`)과 같은 방식으로, 장소는 연결됐지만 근거가 없던 아티스트 18명의
후보 장소를 `artist_place_evidence` 에 `PENDING` 으로 넣었다. 근거는 2023 공공데이터(data.go.kr 15111405) 기재뿐이고,
공식 출처 대조 전이라 추천 코스에는 들어가지 않으며 지도·목록에 '확인 필요'로만 표시된다.

## 운영 반영 기록

- 실행 전 백업: `/docker/kmovement-g1/backups/kmovement-20261114-pre-artist-batch.dump` (1,118,803 bytes)
- 시험 실행: 운영 DB에서 `BEGIN … ROLLBACK` 으로 먼저 실행해 566행·누락 0행 확인
- 실제 실행: `psql -v ON_ERROR_STOP=1 -1` 단일 트랜잭션, 566행 추가 (전체 PENDING 63 → 629)
- 근거 없는 연결 장소: 0행
- 공개 API `/api/v1/tour/holy?contentSqno=…` 19개 콘텐츠 모두 `verificationStatus = "PENDING"`

| 아티스트 | 장소 | 아티스트 | 장소 |
|---|---|---|---|
| BTS | 150 | 아이유(IU) | 27 |
| BLACKPINK | 108 | TOMORROW X TOGETHER | 26 |
| TWICE | 52 | G-DRAGON | 21 |
| EXO | 38 | (여자)아이들 | 17 |
| NCT | 34 | DAY6 | 14 |
| Red Velvet | 33 | ATEEZ | 12 |
| 임영웅 | 11 | ITZY | 10 |
| Stray Kids | 5 | 악뮤(AKMU) | 5 |
| 성시경 | 2 | IVE | 1 |

종류별: CONTENT_VISIT 521 · SNS 30 · MV 11 · ALBUM_PHOTO 4

## 되돌리기

이번에 넣은 행만 지우려면(단일 트랜잭션):

```sql
DELETE FROM artist_place_evidence
WHERE status = 'PENDING'
  AND artist_id IN (1,2,4,11,12,13,14,15,17,19,21,22,23,26,28,29,31,36)
  AND source_url = 'https://www.data.go.kr/data/15111405/fileData.do';
```

또는 위 백업으로 복원한다.
