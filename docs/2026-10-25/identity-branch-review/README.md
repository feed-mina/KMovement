# 대상·지점 실제 대조 기록

기준: 2026-10-25 15:15:20 한국시간. 운영 PostgreSQL을 읽기 전용 트랜잭션으로 조사했다.
성공 기록: https://github.com/feed-mina/KMovement/actions/runs/40168383015

- 운영 artist 전체 48개(모두 승인 Y), 콘텐츠 117개, 연결 1,968건, 비사용자 공개 장소 1,621개.
- 기존 ID 모두 보존: 아이유 17, 차은우 38. 새 92개는 이름/명시된 별칭 대조상 중복 0, 신규 후보 92, 충돌 보류 0.
- 원본 1,962행에서 보류 5개 이름의 26행을 제외한 1,936행을 검사했다.
- 1,600개 이름·주소 묶음 중 exact_text 1,587 / same_name_address_differs 7 / unresolved_name 6.
- exact_text는 방문 근거·현재 영업·동일 점포 확정이 아니다. 좌표 50m는 후보 표시용이며 병합 조건이 아니다.
- 117개 콘텐츠 이름 중 112개는 111개 대상 후보로 연결, 5개는 보류. EXO와 엑소는 같은 명시적 별칭이다.
- 같은 이름 지점 9개 수동 검토 결과는 manual-place-decisions.json. 공식 주소에 기초한 추론이며 아티스트 방문 검증이 아니다.
- 같은 주소·다른 이름 16묶음은 병합하지 않는다. 동일 시설 내 다른 점포·촬영 위치·별관을 구분한다.
- 그룹·개인 관계 상속 0, 신규 등록 0, ID 재배정 0, 운영 데이터 변경 0.
- 새 92개 공식 신원 링크 전수 조사, 방문 원문, 현재 운영시간 검증은 미완료다.

스냅샷은 공개 장소/대상 메타데이터만 포함한다. 사용자·계정·연락처 필드는 포함하지 않는다.
production-public-snapshot.json.gz를 압축 해제한 JSON의 SHA256:
29e47dcb67d14734f441db9202a894b52d7991a38681bacacb81ff6ae22085d6

재현:
```sh
python -c "import gzip,pathlib; pathlib.Path('work').mkdir(exist_ok=True); pathlib.Path('work/identity-snapshot.json').write_bytes(gzip.decompress(pathlib.Path('docs/2026-10-25/identity-branch-review/production-public-snapshot.json.gz').read_bytes()))"
python scripts/reconcile_artist_catalog.py --master-json work/identity-snapshot.json --output docs/2026-10-25/identity-branch-review/live-catalog
python scripts/review_artist_place_identity.py --snapshot work/identity-snapshot.json --output docs/2026-10-25/identity-branch-review
python -m unittest tests.test_artist_place_identity_review tests.test_artist_catalog_reconciliation
```

이번 실측 범위와 한계는 이 문서 및 summary.json을 기준으로 한다.
