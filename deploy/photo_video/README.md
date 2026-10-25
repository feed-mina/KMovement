# 여행 사진 → 개인 영상: 실행·원복 안내

work-cycle `km-video`의 최소 경로를 별도 기능으로 추가한다. 운영 배포 완료를 뜻하지 않는다.

## 제공하는 기능

사진 1장 선택 → 본인 전용 업로드 → 작업 요청 → 대기/진행/완료/실패 → 5초 MP4 재생·다운로드. 이전 작업, 명시적 재시도, 처리 시간·실패 기록을 제공한다. JPEG/PNG/WebP만 실제 디코딩 후 JPEG로 정규화하고 EXIF 위치 등 부가정보는 제거한다. 원본 파일과 파일명은 보존하지 않는다. 사용자 사진을 공개 커뮤니티 글이나 Cloudinary에 자동 게시하지 않는다.

기본 생성 방식은 **FFmpeg 사진 확대·이동 영상**이다. 생성형 AI 모델 실행, TTS 음성, 배경음악, 여러 사진 합성은 이 기능에 연결하지 않았다. 기존 `deploy/media_motion` 및 RunPod 흐름은 보존했다. 유료 모델 선택·계정 인증·예산 한도·개인 사진 외부 전달 방식은 사용자 복귀 후 결정한다. 외부 모델 요청 비용은 없지만 CPU·저장·전송 비용은 미산정이다.

## 구성

- Next `/travel/video`: 사진 입력·코스 장소 선택·개인 기록·재생 화면
- Next `/api/travel-video/*`: 기존 Spring `/api/auth/me`로 신원 확인, 쓰기 Origin 검사, 원본 요청 10MB 제한, 내부 인증으로 전달
- Next 웹의 재작성 규칙에서 새 경로를 제외하고 서비스 워커의 개인 사진·영상 캐시를 금지
- 별도 FastAPI 서비스: 본인 사진·작업만 조회, SQLite 영속 보관, 파일 권한 제한
- 별도 CPU 워커: SQLite 작업을 원자적으로 가져와 FFmpeg 실행, 5초 H.264·1280×720 출력 확인
- 기존 FastAPI `/api/public/itinerary/video-context`: 서명·소유자·만료·최신 장소 자료 변경을 검증. 비용이 드는 새 코스를 생성하지 않음

운영 PostgreSQL 스키마는 바꾸지 않는다. SQLite 파일과 사진·영상은 같은 영속 볼륨에 저장한다. 서버 한 대와 로컬 영속 디스크 기준이며 여러 호스트의 네트워크 공유 파일시스템은 지원 범위 밖이다.

## 설정

서버 전용 값은 브라우저 공개 환경변수로 만들지 않는다. 실제 비밀 값은 커밋하지 않는다.

| 위치 | 환경변수 | 설정 |
|---|---|---|
| Next 실행 환경 | `PHOTO_VIDEO_ENABLED` | 활성화할 때만 `true` |
| Next 빌드 환경 | `NEXT_PUBLIC_PHOTO_VIDEO_ENABLED` | 코스의 영상 만들기 버튼을 표시할 때만 `true` |
| Next 실행 환경 | `PHOTO_VIDEO_URL` | 같은 Docker 네트워크의 `http://photo-video:8085` |
| Next 및 사진 API | `PHOTO_VIDEO_INTERNAL_KEY` | 비밀 관리 도구로 만든 32자 이상 무작위 문자열, 양쪽 동일 |
| Next 실행 환경 | `PHOTO_VIDEO_PUBLIC_ORIGIN` | 실제 웹 주소의 origin, 끝 슬래시 없음 |
| Next 실행 환경 | `AUTH_BACKEND_URL` 또는 `BACKEND_URL` | 기존 Spring 내부 주소 |
| Next 실행 환경 | `FASTAPI_URL` 또는 `KRIDE_FASTAPI_URL` | 기존 코스 API 주소 |
| Next 실행 환경 | `KRIDE_INTERNAL_TOKEN` | 기존 코스 API 인증 설정 |
| 기존 코스 API | 기존 서명 키·테스트 사용자 설정 | 발급 당시와 같은 설정 유지 |
| 사진 API 및 워커 | `PHOTO_VIDEO_DATA_DIR` | `/data/photo-video` (같은 영속 볼륨) |

기존 웹 서비스와 두 새 서비스를 같은 Docker 네트워크에 연결해야 한다. 아래 독립 Compose 파일만 실행하면 기존 웹의 네트워크가 자동으로 연결되지는 않는다. 운영 Compose에 서비스를 병합하거나 기존 웹을 이 Compose의 네트워크에 명시적으로 연결한다. 사진 API를 공개 포트로 직접 노출하지 않는다.

```bash
docker compose -f deploy/photo_video/compose.yml build
docker compose -f deploy/photo_video/compose.yml up -d
```

웹을 위 설정으로 빌드·실행하고 기존 코스 API도 새 버전으로 반영한 뒤 활성화한다. 현재 작업에서는 이 배포를 실행하지 않았다.

로컬 확인 시 API와 워커를 각각 실행한다. 먼저 데이터 폴더와 내부 키를 안전한 환경 설정으로 지정한다.

```bash
python -m pip install -r deploy/photo_video/requirements.txt
python -m uvicorn deploy.photo_video.app:create_app --factory --host 127.0.0.1 --port 8085
# 다른 터미널: 같은 PHOTO_VIDEO_DATA_DIR 설정
python -m deploy.photo_video.worker
```

FFmpeg와 ffprobe가 필요하다. Docker 이미지에는 포함한다. `docker compose down -v`는 개인 사진·영상·기록을 지우므로 원복 명령으로 사용하지 않는다.

## 코스 연결

코스 결과의 `이 코스의 여행 사진으로 영상 만들기` → 영상 화면에서 장소 직접 선택 → 사진 업로드 → 영상 요청. 브라우저는 `courseContext`와 `poiId`만 전달하고, 서버가 공식 번호·이름·주소·코스 자료 버전을 다시 조회한다. 브라우저가 임의로 보낸 `trip`은 거절한다. 토큰은 URL이나 로그에 넣지 않는다.

코스 연결은 **사용자가 선택한 장소를 사진·작업·영상에 연결한 기록**이다. 실제 촬영 위치나 아티스트 방문 사실을 새로 검증한 결과가 아니다. 코스는 기존 만료 시간 1시간을 따른다. 만료·다른 사용자·근거 변경은 409로 중단한다. 연결 없이 만들기는 사용자가 직접 누를 때만 허용한다. 재시도는 최초 연결 당시의 이력 자료를 유지하며 현재 추천 승인으로 승격하지 않는다.

## 제한과 운영 확인

- 사진 10MB, 디코딩 2,400만 픽셀, 사용자 보관 20장. 장기 보관·삭제 화면은 후속 범위다.
- 사용자 동시 작업 2개, 한국 날짜 기준 하루 10개. 기본 영상 5초, 무음이다.
- 새로고침 전에 업로드만 하고 작업 요청을 하지 않은 사진의 선택 복원은 아직 제공하지 않는다. 서버에는 사진이 남는다.
- 재시작으로 중단된 RUNNING 작업은 시작 후 10분이 지나면 FAILED로 바뀐다. 사용자가 재시도해야 새 작업이 생긴다.
- 화면 상태 조회는 3초 간격, 최대 10분. 조회 실패나 만료 후 사용자가 다시 확인할 수 있다.
- 서버 내부 키 회전, 볼륨 백업·보존 기간·용량 감시, 운영 로그인과 실제 사용자 사진 확인은 배포 전 운영 항목이다.

## 외래키·재시도 보강

[외래키·재시도 보강 및 내부 배포 절차](INTEGRITY.md)를 따른다. API와 워커는 같은 연결 함수를 사용하며 최초 생성 또는 기존 DB의 백업·원자적 이전으로 스키마 버전 2를 적용한다.

## 원복

1. Next에서 `PHOTO_VIDEO_ENABLED=false`로 요청을 차단한다.
2. `NEXT_PUBLIC_PHOTO_VIDEO_ENABLED=false`로 재빌드해 코스 버튼을 숨긴다.
3. 진행 작업을 확인한 뒤 API·워커를 중지한다. 볼륨은 유지한다.
4. 필요하면 해당 PR의 코드만 되돌린다. 기존 코스 생성 동의나 아티스트·지점 번호는 바꾸지 않는다.

원복해도 이미 저장된 사진·영상이 자동 삭제되지는 않는다. 본 기능에서 유료 모델을 호출하지 않았으므로 유료 작업 취소는 발생하지 않는다.

## 검증 명령

```bash
python -m pytest tests/test_photo_video.py tests/test_photo_video_context.py tests/test_course_context.py -q
cd subproject/SDUI/metadata-project
npx jest tests/api/travelVideoProxy.test.ts tests/app/travelVideo.test.tsx tests/components/PhotoVideoCourseLink.test.tsx --runInBand
npx tsc --noEmit --incremental false
```

실제 FFmpeg 렌더링·206 부분 재생·영속 보관·다른 사용자 차단·중복/재시도·실패 기록·EXIF 제거·코스 위조/철회 검사를 포함한다. 합성 사진을 사용하며 사용자의 실제 개인 사진이나 유료 계정을 사용하지 않는다.

빌드 후 실제 HTTP 연결 검사는 저장소 루트에서 `PHOTO_VIDEO_HTTP_E2E=1 python -m pytest tests/test_photo_video_http.py -q`로 실행한다. 이 검사는 로컬 신원 확인 모형과 실제 Next·사진 API·워커를 띄우며 실제 Spring 로그인 검사를 대신하지 않는다. 화면 자동 검사는 React 환경에서 수행했다. 이 작업 환경에서는 Chrome 다운로드가 실패해 브라우저 시각 검수는 수행하지 못했다.
