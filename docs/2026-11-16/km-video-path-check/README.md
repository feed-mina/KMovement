# km-video 경로 점검 보고서 (사진 → 재생)

## 1. 한 줄 요약
로드맵의 "사진 1장 → 짧은 영상 1개"는 **AI가 아니라 CPU(FFmpeg)로 사진을 5초 동안 확대·이동시키는 별도 경로**(`/travel/video` → Next 중계 → photo-video API → SQLite → CPU 워커 → MP4 재생)입니다. 코드상으로는 처음부터 끝까지 연결돼 있고, 웹 자동 배포도 이 경로가 준비됐는지 확인하게 되어 있습니다. 다만 **실제 로그인 사용자가 운영 서버에서 끝까지 재생해 본 기록은 저장소에 없습니다.** 실패 원인, 전체 소요시간, 비용, 재생 성공 여부도 기록이 비어 있거나 거칠게만 남습니다.

## 2. 지금 연결된 경로

| 단계 | 담당 코드 파일:줄 | 상태 |
|---|---|---|
| ① 코스 결과에서 "영상 만들기" 버튼 | `components/fields/kride/ItineraryPanel.tsx:277`, `PhotoVideoCourseLink.tsx:16`(공개 플래그 꺼지면 숨김), `:26-27`(sessionStorage 저장 후 `/travel/video`로 이동) | 연결됨 |
| ② 사진 선택·형식/10MB 검사·업로드 | `app/travel/video/page.tsx:91-97`(검사), `:62-65`(`POST photos`) | 연결됨 |
| ③ Next 중계: 기능 플래그·Origin 검사·Spring 로그인 확인·10MB 제한 | `app/api/travel-video/[...path]/route.ts:12`(`PHOTO_VIDEO_ENABLED`), `:21-22`(Origin), `:27-33`(Spring `/api/auth/me`), `:4,:42`(10MB) | 연결됨 |
| ④ 코스 장소 검증(서버가 다시 조회) | `route.ts:61-65` → `src/api/public_itinerary.py:154`, `src/api/cpu_app.py:14`(허용 경로에 포함) | 연결됨(코스 연결 없이 만들기도 가능) |
| ⑤ photo-video API: 내부 키·소유자 확인, 사진 저장 | `deploy/photo_video/app.py:64-75`(내부 키·소유자), `:88-96`(업로드) | 연결됨 |
| ⑥ 작업 등록(동시 2개·하루 10개 한도) | `app.py:148-180`(한도 429는 `:172-173`), 프런트 `page.tsx:66-70` | 연결됨 |
| ⑦ CPU 워커가 작업을 가져가 FFmpeg로 렌더 후 ffprobe로 검사 | `deploy/photo_video/worker.py:37-63`, `:17-23`(FFmpeg: 1280×720, 125프레임), `:24-30`(ffprobe: h264, 4.8~5.2초 확인) | 연결됨 |
| ⑧ 상태 전달(브라우저가 3초마다 조회, 최대 10분) | `lib/hooks/usePrivateVideoHistory.ts:56-78`(`:63` 10분, `:72` 3초) | 연결됨. WebSocket을 쓰지 않으므로 PR #316 영향 없음 |
| ⑨ 재생·다운로드(Range 요청 전달, inline MP4) | `app.py:208-217`, `route.ts:77`(Range), `page.tsx:176-179`(`<video>`) | 연결됨 |
| ⑩ 배포: 웹 배포 때 photo-video 준비 상태 확인과 합성 사진 렌더 시험 | `.github/workflows/hostinger-web-deploy.yml:187`(`NEXT_PUBLIC_PHOTO_VIDEO_ENABLED=true` 빌드 값), `:199`(`--enable-private-video`), `deploy/hostinger/deploy_web.py:207-240` | 일부. API·워커 컨테이너는 수동 배포이고 운영 결과 기록이 저장소에 없음 |
| (별도) 커뮤니티 AI 영상: Spring → 게이트웨이 → RunPod → Cloudinary | `AnimationService.java:71,127,222`, `cloud_gateway/app.py:398,430`, `media_motion/result_delivery.py:32,48` | 실험용. km-video 경로와 연결되지 않음 |
| (별도) Celery 영상·음성 | `CeleryJobController.java:28,60`, `docker-compose.gpu.yml:135`, `useCeleryJobStream.ts:174`(SSE) | 실험용. GPU·로컬 compose에만 있음 |

참고: PR #316(`ce749816c`)은 이전 프로젝트의 스케줄러와 STOMP WebSocket만 꺼짐을 기본값으로 바꿨습니다. 개인 영상은 HTTP 폴링을 씁니다. `AnimationJobPollingScheduler.java:29`(60초 주기)에는 이 꺼짐 스위치가 붙어 있지 않습니다.

## 3. 끊긴 곳과 위험
1. **운영에서 끝까지 해 본 증거가 없습니다.** README는 "운영 배포 완료를 뜻하지 않는다"(`deploy/photo_video/README.md:3`), "현재 작업에서는 이 배포를 실행하지 않았다"(`:46`)고 적고 있습니다. INTEGRITY.md도 실제 Spring 로그인부터 재생까지의 검수는 "다음 단계"라고 합니다(`INTEGRITY.md:3`). HTTP 연결 검사는 가짜 로그인 모형을 씁니다(`README.md:98`).
2. **API·워커가 준비되지 않으면 웹 배포 전체가 멈춥니다.** 웹 배포는 항상 `--enable-private-video`로 실행됩니다(`hostinger-web-deploy.yml:199`). 다음 경우 DeployError가 납니다.
   - API·워커 컨테이너가 정확히 1개씩 있지 않을 때(`deploy_web.py:214-215`)
   - API가 running·healthy가 아니거나 워커가 running이 아닐 때(`deploy_web.py:71-76`)
   - DB 점검이 실패하거나 합성 렌더 시험이 실패할 때(`:220-221`, `:236-237`)

   photo_video 코드가 바뀌어도 자동 배포 대상이 아니라 수동 배포 표시만 붙습니다(`deploy_scope.py:30-31`).
3. **실패 원인이 사라집니다.** FFmpeg 출력은 `capture_output`으로 받지만(`worker.py:23`) 저장하지 않습니다. 시간 초과가 아닌 예외는 모두 `RENDER_FAILED` 하나로 묶입니다(`worker.py:57-58`). photo_video에는 logging 호출이 없습니다(`database.py:179`의 print만 있음).
4. **업로드 실패와 생성 실패를 구분해 기록하지 않습니다.** 업로드가 거절되면(413·415·401) 응답만 하고 행을 남기지 않습니다(`app.py:90-96`, `route.ts:31-33`). 로드맵은 "생성 성공과 업로드 성공을 나누라"고 요구합니다.
5. **재생 성공·실패가 서버에 남지 않습니다.** `<video onError>`는 화면 상태만 바꿉니다(`page.tsx:177,181`).
6. **워커가 멈춘 작업은 시간이 지나야 정리됩니다.** 중단된 RUNNING 작업은 10분 뒤 워커가 다시 돌 때만 FAILED로 바뀝니다(`worker.py:45`). 화면 폴링은 10분 뒤 멈춥니다(`usePrivateVideoHistory.ts:63,71`).
7. **비용은 기록이 아니라 고정 문구입니다.** `providerCharge: 0`, `infrastructureCost: None`이 응답에 하드코딩돼 있습니다(`app.py:143-144`).
8. **커뮤니티 AI 경로는 Hostinger에서 끊겨 있을 가능성이 큽니다.** Hostinger CPU 앱에는 `/jobs/runpod`가 없습니다(`cpu_app.py:14`의 허용 목록). 10-26 문서는 fastapi.url 기본값이 disabled 주소라고 기록했습니다(`docs/2026-10-26/photo-video-model-hostinger-guide/README.md:35-36`). RunPod 최대 작업자 0은 이전 문서의 관찰을 옮긴 것이고 콘솔에서 다시 확인한 결과는 아닙니다(`:43`). 이번 km-video의 첫 단계에는 쓰지 않는 것이 맞습니다.

## 4. 작업 상태·소요시간·비용·실패 기록이 지금 남는지

| 항목 | 남는가 | 어디에 / 근거 |
|---|---|---|
| 작업 상태 | 남음 | SQLite `workflow.sqlite3`의 `jobs.status`(QUEUED/RUNNING/COMPLETED/FAILED): `database.py:50-55`, `worker.py:38` |
| 업로드 시각 | 남음(초 단위) | `photos.created_at`: `database.py:48` |
| 대기·처리 시각 | 남음 | `jobs.created_at`, `started_at`, `finished_at`: `database.py:56-57`, `worker.py:49,61` |
| 렌더 소요시간 | 남음(렌더만) | `jobs.render_ms`: `worker.py:61-62`, 화면 표시 `page.tsx:174` |
| 요청부터 재생까지 전체 소요시간 | 없음 | 재생 시점이 기록되지 않음(3-5번) |
| 실패 코드 | 거칠게 남음 | `jobs.error_code`(RENDER_TIMEOUT/RENDER_FAILED/WORKER_INTERRUPTED): `worker.py:45,56-58` |
| 실패 상세 원인 | 없음 | stderr를 버림(3-3번) |
| 업로드 실패 | 없음 | 3-4번 |
| 비용 | 없음(고정 문구) | `app.py:143-144` |
| 배포 준비 상태 | 서버에만 남음 | `/docker/kmovement-web/releases/<sha>-auto-*`의 `private_video_readiness`: `deploy_web.py:27,238` |
| (참고) AI 경로 | PostgreSQL | `community_animation_jobs`(status, result_url, error_message, actual_model, fallback_*): `V55`, `V67`, `V74` 마이그레이션 |

## 5. "사진 1장·짧은 영상 1개" 첫 점검 순서
1. **운영 서버 상태 확인(읽기 전용):** GitHub Actions에서 "Inspect private photo video runtime"을 수동 실행합니다. `photo-video`·`photo-video-worker`가 running/healthy인지 봅니다. `photo_video_enabled`, `internal_key_matches`, `shared_networks`도 확인합니다(`hostinger-photo-video-inspect.yml:52-80`).
2. **최근 웹 배포 기록 확인:** 최근 Hostinger 웹 배포 실행 로그에 "Private photo API, shared volume, database and synthetic CPU render verified."가 찍혔는지 봅니다(`deploy_web.py:239`). 실패했다면 DeployError 문구를 보면 어느 조건에서 막혔는지 알 수 있습니다.
3. **DB 무결성 확인(서버 명령이 필요한 경우):** `python -m deploy.photo_video.database` 결과가 `schemaVersion=2`, `foreignKeyViolations=0`, `integrity=ok`인지 봅니다(`INTEGRITY.md:34-41`).
4. **브라우저에서 로그인 → 코스 만들기 → "영상 만들기" 버튼이 보이는지 확인:** 안 보이면 웹 빌드의 `NEXT_PUBLIC_PHOTO_VIDEO_ENABLED` 값을 확인합니다.
5. **합성 사진 또는 공개해도 되는 사진 1장(10MB 이하 JPEG)을 업로드하고 "사진을 저장했습니다"를 확인:** 401/503/413이 나오면 3단계(Spring 로그인)나 1단계(내부 키)를 다시 봅니다.
6. **"영상 만들기"를 누르고 상태가 생성 대기 → 생성 중 → 완료로 바뀌는지, 걸린 시간을 기록:** 화면에 "영상 처리 시간 N초"가 표시됩니다.
7. **재생과 다운로드:** 재생 막대를 중간으로 옮겨 Range 응답 206을 확인하고, MP4가 약 5초인지 확인합니다.
8. **실패도 한 번 확인:** 다른 계정으로 같은 영상 주소에 접근하면 404가 나는지 확인합니다. 결과(시각, 처리 시간, 오류 코드)는 표 1장에 기록합니다.

## 6. 추천 다음 작업 3개
1. **운영 상태 점검만 실행하고 결과를 기록(코드 수정 없음):** 5번의 1~3단계를 한 번 돌리고 결과를 `docs/2026-11-*`에 남깁니다. 실제로 켜져 있는지부터 확정하는 일입니다.
2. **실패 원인을 짧게 저장:** 워커가 FFmpeg stderr 마지막 몇 줄(개인정보 없이)을 `jobs`에 저장하고 서버 로그에 한 줄씩 남기게 합니다(`worker.py:55-62` 부근). 업로드가 거절될 때도 사유 코드를 로그에 한 줄 남깁니다.
3. **"요청부터 재생까지" 시간 기록:** 재생이 처음 시작되거나 실패할 때 서버에 이벤트 1건을 보내 `jobs`에 기록합니다(`page.tsx:177`, `app.py`에 엔드포인트 1개 추가). 그러면 업로드부터 재생까지 전체 시간과 재생 실패율을 계산할 수 있습니다. 비용은 같은 방식으로 `render_ms × CPU 단가` 추정값 필드를 붙이는 것부터 시작합니다.

주요 파일:
- deploy/photo_video/app.py
- deploy/photo_video/worker.py
- deploy/photo_video/database.py
- subproject/SDUI/metadata-project/app/travel/video/page.tsx
- subproject/SDUI/metadata-project/app/api/travel-video/[...path]/route.ts
- subproject/SDUI/metadata-project/lib/hooks/usePrivateVideoHistory.ts
- deploy/hostinger/deploy_web.py
- .github/workflows/hostinger-photo-video-inspect.yml

검증: 45개 인용 확인, 7개 수정
## 7. 운영 상태 점검 결과 (2026-11-16 17:00 KST, 5번의 1단계)
읽기 전용 점검 워크플로 "Inspect private photo video runtime"을 수동으로 한 번 돌렸습니다([실행 기록](https://github.com/feed-mina/KMovement/actions/runs/43827782236)). 설정은 바꾸지 않았습니다.

| 항목 | 결과 |
|---|---|
| 웹(`kmovement-web-web-1`) | running·healthy, `PHOTO_VIDEO_ENABLED=true`, 사진 API 주소·공개 주소·Spring 로그인 주소 모두 기대값 |
| 사진 API(`photo-video-1`) | running·healthy, 이미지 리비전 `8f472c6` |
| 워커(`photo-video-worker-1`) | running(헬스체크 없음), 같은 리비전 `8f472c6` |
| 웹 ↔ API 내부 키 | 일치(32자 이상) |
| 공유 네트워크 | `kmovement-web_kmovement` |
| 웹에서 API `/health` | 200 |
| `/docker` 남은 디스크 | 70.7 GiB |

결론: 운영 서버에는 사진→영상 경로가 켜져 있고 서로 연결돼 있습니다. 남은 확인은 실제 로그인 사용자로 사진 1장을 올려 영상 1개를 재생하는 것(5번의 4~8단계)입니다. 이 단계는 실제 계정과 브라우저가 필요해 민아님이 직접 해 보셔야 합니다. 워커에는 헬스체크가 없어서 멈춰도 `running`으로 보일 수 있다는 점(3-6번)은 그대로 남아 있습니다.
