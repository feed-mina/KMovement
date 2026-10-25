# 사진·영상 참조 무결성 보강과 내부 배포

이 배포는 사진 API·영상 워커와 전용 SQLite를 준비한다. 웹 기능 활성화와 실제 Spring 로그인부터 재생까지의 검수는 다음 단계다. 기존 PostgreSQL과 `saved_item` 제약을 바꾸지 않는다.

## 코드에서 지키는 관계

- API 초기화·쓰기·조회, 워커 작업 선택·완료 기록 모두 `database.connect()`를 쓴다. 트랜잭션 전에 `foreign_keys=ON`을 실행하고 값 1을 확인하며 종료 시 연결을 닫는다.
- 사진과 작업은 사진 번호와 소유자 번호를 함께 참조한다.
- 재시도는 원작업 번호·소유자·사진이 같아야 하며 원작업은 FAILED여야 한다. `trip_json` 이력도 같아야 한다.
- 같은 원작업의 QUEUED/RUNNING/COMPLETED 재시도는 하나만 허용한다. 실패한 재시도 뒤의 새 요청은 기존 사용자별 한도를 통과해야 한다.
- 생성 후 사진·작업의 연결 키를 바꾸지 못하고, 재시도가 있는 FAILED 원작업을 다시 활성화하지 못한다.
- 사진·원작업을 참조하는 작업이 있으면 삭제를 거절한다. JPG·MP4 파일 존재는 외래키의 검사 범위가 아니다.

## 최초 생성과 기존 파일 이전

API 시작 시 스키마 버전 2를 생성한다. 버전 0의 기존 photos/jobs가 있으면 쓰기 잠금 → SQLite backup API로 `workflow.sqlite3.pre-v2-*.bak` 생성 → 부모부터 새 제약에 맞춰 복사 → 행 수 대조 → 외래키·파일 구조 검사 → 한 트랜잭션으로 완료한다. 개인 JPG·MP4는 수정하지 않는다.

없는 사진, 다른 소유자, 잘못된 재시도·코스, 순환 관계, 알 수 없는 테이블·열·트리거, 지원하지 않는 스키마 버전이 있으면 시작을 중단한다. 위반 행을 자동 삭제하지 않는다. 실패하면 원래 DB의 스키마와 행을 유지하고 백업을 남긴다.

이전 작업 때는 API·워커를 중지하고 DB와 JPG·MP4 볼륨을 함께 추가 백업한다. 이전 코드의 워커를 먼저 다시 켜지 않는다.

## 운영 호스트에서 실행

아래는 저장소 루트 기준 Linux 명령이다. 실제 내부 키를 문서·Git·터미널 출력에 적지 않는다. `release.env`는 접근 권한 600의 운영 전용 파일로 준비한다. `PHOTO_VIDEO_REVISION`은 검토·시험을 통과한 Git 커밋, `PHOTO_VIDEO_INTERNAL_KEY`는 무작위 비밀값이다.

```bash
docker volume create kmovement-photo-video-data
docker compose --env-file release.env -p kmovement-photo-video \
  -f deploy/photo_video/compose.yml -f deploy/photo_video/hostinger.compose.yml config --quiet
docker compose --env-file release.env -p kmovement-photo-video \
  -f deploy/photo_video/compose.yml -f deploy/photo_video/hostinger.compose.yml build
docker compose --env-file release.env -p kmovement-photo-video \
  -f deploy/photo_video/compose.yml -f deploy/photo_video/hostinger.compose.yml up -d --wait
docker compose --env-file release.env -p kmovement-photo-video \
  -f deploy/photo_video/compose.yml -f deploy/photo_video/hostinger.compose.yml exec -T photo-video \
  python -m deploy.photo_video.database
```

API는 기존 웹 네트워크와 전용 내부 네트워크, 워커는 전용 내부 네트워크만 사용한다. 외부 공개 포트는 만들지 않는다. API 0.5 CPU·512MiB, 워커 2 CPU·1GiB는 초기 제한이며 측정 후 조정한다. 두 서비스는 같은 이름의 영속 볼륨을 /data/photo-video에 연결한다.

읽기 전용 점검은 버전 2, foreignKeys=1, foreignKeyViolations=0, integrity=ok와 행 수만 출력한다. 없는 DB를 만들어 점검에 성공한 것처럼 표시하지 않는다.

## 복구

신규 서비스 문제가 있으면 이 Compose의 API·워커만 중지한다. `down -v`를 쓰지 않는다. 기존 웹·Spring·PostgreSQL은 중지하지 않는다. 스키마 2 DB에 이전의 외래키 비활성 코드를 연결하는 방식으로 원복하지 않는다. 기존 파일 이전을 취소하려면 서비스를 중지하고 DB·미디어 전체 백업으로 복원한 뒤 코드 버전까지 맞춘다.

## 검증

```bash
python -m pytest tests/test_photo_video.py tests/test_photo_video_database.py tests/test_photo_video_context.py tests/test_course_context.py -q
```

단위·API 시험은 정상 업로드·영상 렌더링·206 응답, 소유자 차단, 연결별 외래키와 종료, 동시 재시도, 기존 스키마 두 종류의 보존 이전, 위반 데이터 이전 실패 시 원상 유지 등을 확인한다. 합성 사진을 사용하며 운영 사용자 기록과 유료 모델을 사용하지 않는다.
