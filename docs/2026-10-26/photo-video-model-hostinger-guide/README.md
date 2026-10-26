# 사진에서 영상까지: Hostinger 전환과 모델 조합 가이드

**권장 방향: Hostinger가 인증·작업·파일을 관리하고, 기존 CogVideoX 연결을 먼저 복구한 다음 댄스 모델을 별도 GPU 작업자로 추가한다.** 여러 저장소를 함께 사용할 수 있다. 모델별 실행 환경을 나누고 사진·포즈·영상 파일을 정해진 형식으로 주고받는다.

[HTML 보고서](guide.html) · [저장 경로 조사](../saved-item-media-storage-audit.md) · [개인 보관함 설계](../personal-library-video-guide/README.md) · [P1~P5 구현 기록](https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/docs/2026-10-26/personal-library-video-guide/implementation.md)

## 1. 목적과 확인 범위

| 구분 | 기준 |
|---|---|
| 목적 | EC2 중심으로 남은 영상 요청 구성을 Hostinger로 옮길 변경 지점과 여러 공개 모델의 적용 순서를 정한다. |
| 분석 소스 | 원격 KMovement main ce257f437fd7f91aff4a80badb10f1b3917ac6f8. PR #300 병합 이후 소스를 GitHub에서 직접 읽었다. 로컬 폴더는 이전 main과 미커밋 변경이 섞여 있어 기준으로 삼지 않았다. |
| 작성 기준일 | 2026-10-26 한국 시간. 외부 저장소의 현재 README·일부 라이선스와 공식 문서 확인. |
| 이번 산출물 | HTML·Markdown 가이드와 재생성 스크립트. 코드 분석·저장소 비교·수정 계획·시험·복구 기준. |
| 실행 범위 | 문서 작성·검수·게시. 운영 이전·설정 변경·GPU 구매·유료 생성·학습·사용자 사진 전송은 실행하지 않았다. |
| 읽는 순서 | 현재 경로 → Hostinger 전환 → 모델 선택 → 여러 저장소 조합 → 개인 영상 연결 → 구현 순서·시험. |

API(Application Programming Interface)는 프로그램의 요청·응답 창구다. CPU(Central Processing Unit)는 일반 계산 장치, GPU(Graphics Processing Unit)는 영상 모델의 큰 계산에 쓰는 장치다. VRAM(Video Random Access Memory)은 GPU 전용 메모리다. I2V(Image-to-Video)는 사진으로 영상을 생성하는 방식, DB(Database)는 데이터베이스다.

## 2. 현재 상태: 개인 영상과 기존 AI 영상은 별개다

“사진→영상 전체가 EC2에서 실행된다”는 결론까지는 확인되지 않았다. **EC2 배포 코드의 존재와 현재 운영 요청의 실제 목적지는 구분해야 한다.**

| 경로 | 확인한 입력·처리·출력 | 저장과 판단 |
|---|---|---|
| 개인 영상 /travel/video | 로그인 사용자 사진 → 개인 API → CPU 작업자의 render_photo() → 확대·이동 MP4 | SQLite photos/jobs와 같은 영속 볼륨의 JPEG·MP4. 1280×720, 초당 25프레임, 총 125프레임의 약 5초 영상. 생성형 AI·Runpod 호출 없음. |
| 커뮤니티 AI 영상 | Spring AnimationService → FastAPI 게이트웨이 → Runpod → 결과 처리 | PostgreSQL community_animation_jobs.result_url. finalize_result()가 Cloudinary 업로드 시도. |
| Celery 영상·음성 | Spring 작업 API → Celery API·작업자 → 결과 조회 | PostgreSQL celery_jobs.result_json. Runpod와 제출·복구 계약이 다름. |
| 내 목록 | 아티스트·일정·상품 후보 저장·조회 | saved_item 등 팬덤 정보 저장. 개인 영상 작업이나 영상 파일을 넣는 테이블이 아님. |

근거: [개인 워커][s-worker], [개인 API][s-private], [Next 중계][s-next], [Spring 영상 서비스][s-animation], [결과 업로드][s-delivery].

### Hostinger에서 빠져 있는 연결

- [Hostinger Spring 프로필][s-profile]의 fastapi.url과 kride.fastapi.url 기본값은 disabled-fastapi 주소다. EC2 주소로 고정된 것과도 다르다. 운영 환경변수로 덮어썼는지는 미확인이다.
- [Hostinger CPU 앱][s-cpu]은 코스·채팅·조회 경로만 고른다. /jobs/runpod, /jobs/runpod/batch, /jobs/runpod/{job_id}는 없다. **CPU 앱 주소로 바꾸기만 하면 영상 요청은 해결되지 않는다.**
- [EC2 워크플로][s-ec2]에는 키·엔드포인트 주입 구성이 남아 있지만 최신 실행 조건은 수동 실행 또는 KMOVEMENT_DEPLOY_TARGET == 'ec2'다. main 병합마다 무조건 EC2가 배포된다고 설명하면 부정확하다.
- 개인 영상에는 이미 [Hostinger Compose][s-private-compose]가 있다. API·CPU 작업자가 외부 볼륨 kmovement-photo-video-data를 공유한다. 파일의 존재만으로 운영 기동·마운트 성공을 판단하지 않는다.
- PR #300에서 내 목록·내 영상 P1~P5 연결이 main에 병합됐다. 앞선 가이드의 “미구현” 설명을 최신 구현 전체의 현재 상태로 재사용하지 않는다. 화면 연결과 GPU 모델 연결은 별개다.

### 앞선 보고서의 운영 관찰

personal-library-video-guide는 Runpod 미디어 엔드포인트의 저장소·Dockerfile 연결과 **최대 작업자 0** 설정을 관찰했다고 기록한다. 이는 앞선 조사 시점의 기록이며 이번에 콘솔을 재확인한 결과가 아니다. 별도 141GB 엔드포인트는 Tora 후보였고 상세 확인은 끝나지 않았다. 지금 생성이 성공하거나 Tora 운영이 입증됐다고 판단하지 않는다.

## 3. Hostinger 전환은 두 가지 안으로 나눈다

Hostinger는 현재 [별도 GPU 인스턴스][hostinger-gpu]를 안내한다. 일반 VPS(Virtual Private Server, 가상 사설 서버) 보유가 GPU 보유를 뜻하지 않는다. 사용자의 현재 계약·GPU 보유량은 미확인이다.

| 선택 | Hostinger 관리 계층 | GPU 실행 계층 | 적용 판단 |
|---|---|---|---|
| A. Hostinger VPS + 기존 Runpod | 웹·로그인·파일·작업 기록·중계 API | 기존 Runpod 제출·상태 조회 계약 재사용 | **첫 단계 권장.** EC2의 중계 역할을 옮기며 기존 작업자를 가장 많이 살린다. |
| B. Hostinger VPS + Hostinger GPU | A와 같은 관리 계층 | 별도 GPU 인스턴스에 모델 컨테이너·작업 큐 구성 | 공급자를 Hostinger로 모으려면 후속 검토. URL 교체만으로는 작동하지 않는다. 자체 제출·상태·복구 처리가 필요하다. |

둘 다 큰 영상 모델을 일반 VPS에서 실행할 필요가 없다. GPU 선택은 모델·해상도·프레임을 정한 뒤 실제 메모리와 지연을 측정해서 결정한다. Hostinger 공식 안내는 크레딧 소진 시 GPU 인스턴스와 데이터가 삭제된다고 설명한다. 결과·이력의 유일한 사본을 GPU 디스크에 두지 않는다. 가격·재고는 계정·지역의 현재 화면에서 확인한다.

~~~mermaid
flowchart TD
    Web["Hostinger 웹: 사진과 기능 선택"] --> Auth["로그인과 사진 소유자 확인"]
    Auth --> Choice{"생성 방식"}
    Choice -->|사진 모션| CPU["기존 FFmpeg 작업자"]
    Choice -->|AI 생성 동의| Gateway["Hostinger 영상 중계 API"]
    Gateway --> Runpod["Runpod GPU 작업자"]
    Gateway -. 대안 공급자 .-> HGPU["Hostinger GPU 작업자"]
    CPU --> Files["개인 영속 저장소"]
    Runpod --> Files
    HGPU --> Files
    Files --> Playback["소유자 확인 후 재생"]
~~~

이 그림은 **목표 설계**다. 현재 Runpod 결과는 기존 Cloudinary 경로로 전달된다. 개인 저장소로 회수하는 연결은 새로 구현해야 한다.

## 4. EC2 중계 역할을 옮길 파일과 설정

### 4.1 영상 주소를 코스 API 주소와 분리한다

현재 AnimationService 생성자는 kride.fastapi.url을 읽어 WebClient를 만든다. 이 설정을 영상 중계 주소로 통째로 바꾸면 다른 소비 기능도 영향을 받는다. **영상 전용 설정을 추가하고 해당 서비스만 바꾸는 방식**을 권장한다.

~~~java
// 제안: AnimationService 생성자의 주소 주입을 분리한다.
@Value("${kride.media.url:${kride.fastapi.url:http://localhost:8000}}")
String mediaGatewayUrl
// WebClient.builder().baseUrl(...)의 인자도 mediaGatewayUrl로 바꾼다.
~~~

kride.media.url·KRIDE_MEDIA_URL은 **새 제안 설정**이며 현재 코드에 없다. fastapi.internal-api-key는 기존 인증 키다. Spring과 게이트웨이에 같은 강한 비밀값을 주입하고 예제 기본 키를 운영에서 사용하지 않는다.

| 위치 | 수정 내용 | 함께 확인할 기능 |
|---|---|---|
| AnimationService.java | 전용 kride.media.url 사용. 단일·배치·상태 조회에 동일 적용 | 게시글 소유자·한도·기존 결과 파싱 유지 |
| Hostinger Spring 실행 설정 | KRIDE_MEDIA_URL=http://media-gateway:7860 및 내부 키 주입 | 기존 코스·채팅 설정을 별도로 유지 |
| 새 Hostinger 미디어 Compose | deploy/cloud_gateway/Dockerfile로 중계 컨테이너 구성 | GPU·TorchServe·전체 AI 서버를 VPS에 함께 설치하지 않음 |
| deploy/cloud_gateway/app.py | 최초에는 기존 Runpod 계약 재사용. 후속에는 모델 허용 목록·정확한 endpoint 조회 보강 | CPU 앱의 공개 허용 경로를 무작정 확장하지 않음 |
| Hostinger 배포 자동화 | 웹과 별도로 중계 이미지·설정 배포·내부 상태 확인 추가 | 웹 배포 성공과 모델 작업 성공을 각각 기록 |
| 개인 영상 Compose·Next | PHOTO_VIDEO_URL·볼륨·인증 서버·origin 확인 | 개인 영상 기본 경로는 별도 연결 |

다음은 **추가 구성의 예시**다. 기존 파일에 덮어쓰는 완성 배포 파일이 아니다. 이미지 digest·비밀 관리 방식·실제 네트워크를 확정한 뒤 별도 Compose로 작성한다. 서비스 이름이 같아도 Docker 네트워크가 다르면 통신되지 않는다.

~~~yaml
services:
  media-gateway:
    image: ${KMOVEMENT_MEDIA_GATEWAY_IMAGE:?Use a reviewed digest-pinned image}
    environment:
      PORT: "7860"
      FASTAPI_INTERNAL_API_KEY: ${FASTAPI_INTERNAL_API_KEY:?Set a private key}
      RUNPOD_API_KEY: ${RUNPOD_API_KEY:?Set a Runpod key}
      RUNPOD_MEDIA_ENDPOINT_ID: ${RUNPOD_MEDIA_ENDPOINT_ID:?Set the media endpoint}
      RUNPOD_TORA_ENDPOINT_ID: ${RUNPOD_TORA_ENDPOINT_ID:?Set the Tora endpoint}
      KRIDE_MODEL_GENERATION_ENABLED: "false"
    expose: ["7860"]
    networks: [spring-egress]
    restart: unless-stopped
networks:
  spring-egress:
    external: true
    name: kmovement-g1_egress
~~~

KRIDE_MODEL_GENERATION_ENABLED=false는 게이트웨이의 로컬 생성 경로 설정이다. **/jobs/runpod 제출을 막는 전체 차단 스위치가 아니다.** 외부 제출 차단은 별도 허용 정책·예산·접근 제어로 구현한다. 예시 컨테이너에는 호스트 공개 포트·공개 Traefik 라벨이 없다.

### 4.2 개인 영상 Hostinger 연결값은 따로 확인한다

| 기존 설정 | 설정 위치·역할 |
|---|---|
| NEXT_PUBLIC_PHOTO_VIDEO_ENABLED | Next 빌드 시 메뉴·화면 노출. 변경하면 재빌드 필요 |
| PHOTO_VIDEO_ENABLED | Next 실행 시 개인 API 사용 허용 |
| PHOTO_VIDEO_URL | Next 서버가 접근할 http://photo-video:8085 |
| PHOTO_VIDEO_INTERNAL_KEY | Next·개인 API의 동일한 32자 이상 내부 키 |
| PHOTO_VIDEO_PUBLIC_ORIGIN | 실제 사이트 origin. 쓰기 요청 출처 확인 |
| AUTH_BACKEND_URL 또는 BACKEND_URL | /api/auth/me로 Spring 로그인 확인 |
| PHOTO_VIDEO_DATA_DIR | API·작업자의 같은 영속 저장 경로 |

코스 검증에는 FASTAPI_URL 또는 KRIDE_FASTAPI_URL, KRIDE_INTERNAL_TOKEN도 사용한다. 이는 코스 CPU 서비스 주소이며 영상 중계 주소와 같을 필요가 없다. [proxy()][s-next]는 로그인 확인 → 필요한 경우 코스 검증 → 개인 API 전달 순서로 처리한다.

## 5. 기존 Tora·일반 미디어·배치를 살리는 방법

| 요청 | 현재 선택 | 보존·보강할 점 |
|---|---|---|
| 단일 route=tora_cogvideox_i2v | RUNPOD_TORA_ENDPOINT_ID | 궤적으로 움직임을 제어하는 CogVideoX 경로. 전신 관절 안무를 입력하는 댄스 모델과 다름 |
| 단일 cogvideox_real·낙서·3D 등 | RUNPOD_MEDIA_ENDPOINT_ID | 실제 이미지가 해당 route·모델을 지원하는지 확인 |
| /jobs/runpod/batch | 항상 RUNPOD_MEDIA_ENDPOINT_ID | photo_route=tora_cogvideox_i2v여도 Tora 전용 endpoint로 재전송하지 않음 |
| 전용 변수가 빈 경우 | RUNPOD_ENDPOINT_ID로 대체 가능 | 완전 분리 시 두 전용 값 필수 확인. fallback 성공을 분리 완료로 보지 않음 |
| 상태 조회 | 현재 설정된 여러 endpoint를 순서대로 탐색 | 새 기록에 provider·endpoint_id·external_job_id를 함께 남겨 정확한 대상 조회 |

Runpod 제출은 POST /v2/{endpoint}/run, 상태 조회는 GET /v2/{endpoint}/status/{job_id}다. 완료까지 웹 요청을 붙잡지 않고 작업 번호를 먼저 반환한다. [공식 문서][runpod-api]와 [현재 게이트웨이][s-gateway]를 함께 본다.

[이슈 #57](https://github.com/feed-mina/KMovement/issues/57)은 엔드포인트 분리의 배경이다. 본문의 “EC2 재배포” 기준은 Hostinger 전환에 맞춰 갱신할 후속 항목이다. [이슈 #177](https://github.com/feed-mina/KMovement/issues/177)의 EC2 단일화 목표도 과거 계획이며 새 Hostinger 계획의 완료 증거가 아니다. 이번에는 이슈를 변경하지 않았다.

## 6. 후보 저장소와 적용 우선순위

아래는 KMovement 적용 판단이며 모델의 품질 순위나 실제 시험 성적이 아니다. 코드·가중치·부속 모델의 사용 조건은 각각 확인한다.

### 6.1 사진과 동작 영상으로 춤 생성

| 저장소 | 입력·출력과 참고 부분 | 적용 판단 |
|---|---|---|
| [UniAnimate-DiT](https://github.com/ali-vilab/UniAnimate-DiT) | 기준 인물 사진 + 포즈 영상 → 인물 애니메이션. examples/unianimate_wan/ 추론·전처리·LoRA 코드 | **댄스 우선 후보.** 공식 480p 약 23GB·720p 약 36GB는 특정 오프로딩 설정 기준. 실제 여유·시간과 코드·가중치 조건은 별도 확정 |
| [MimicMotion](https://github.com/Tencent/MimicMotion) | 사진 + 동작 영상 → 사람 영상. inference.py·configs/test.yaml·신뢰도 기반 포즈 처리 | UniAnimate의 대안 비교. 공식 35초 예제의 4090 약 20분 사례가 있어 실시간을 약속하지 않음. Apache 코드 외 기반 SVD 가중치 조건 확인 |
| [MusePose](https://github.com/TMElyralab/MusePose) | pose_align.py로 신체 비율 정렬, test_stage_2.py로 생성 | 정렬 연구에 유용. **코드는 MIT지만 공개 학습 가중치는 비상업 연구용**이라고 명시. 서비스 기본 모델로 바로 채택하지 않음 |
| [Champ](https://github.com/fudan-generative-vision/champ) | SMPL 기반 깊이·법선 등 다중 가이드 → 영상. inference.py·configs/inference/ | 회전·겹침이 중요한 후속 연구. 2D 포즈만 바로 넣는 모델이 아니므로 전처리·렌더링 비용도 평가 |
| [Moore-AnimateAnyone](https://github.com/MooreThreads/Moore-AnimateAnyone) | 기준 이미지·포즈 가이드 결합 구조와 학습 | ReferenceNet·Pose Guider 학습용. “가장 깔끔함·최고 품질”로 단정하지 않고 비교 기준으로 활용 |

LoRA(Low-Rank Adaptation)는 큰 모델 전체 대신 작은 추가 가중치를 학습하는 방법이다. 다른 기반 모델의 LoRA 파일은 보통 교환할 수 없다. DiT(Diffusion Transformer)는 확산 기반 생성에 Transformer 구조를 사용하는 모델 계열이다.

### 6.2 여행 풍경·상품·인물의 일반 I2V

| 저장소 | 참고 부분 | 적용 판단 |
|---|---|---|
| [CogVideo / CogVideoX](https://github.com/zai-org/CogVideo) | inference/cli_demo.py·sat/·finetune/ | **기존 cogvideox_real 연결부터 재사용.** THUDM/CogVideo는 현재 zai-org/CogVideo로 이동. 2B·5B·I2V 체크포인트의 라이선스를 동일하게 취급하지 않음 |
| [Wan2.1](https://github.com/Wan-Video/Wan2.1) | generate.py·wan/의 생성 파이프라인 | 일반 I2V 품질 비교. 기본 I2V는 14B. **T2V-1.3B의 8.19GB를 I2V 메모리로 인용하면 안 됨.** 공개 모델 Apache 2.0 안내 확인 |
| [LTX-Video](https://github.com/Lightricks/LTX-Video) / [LTX-2](https://github.com/Lightricks/LTX-2) | 빠른 미리보기·영상 압축·조건부 생성 | 속도 비교. 현재 LTX-Video README는 LTX-2를 주 개발 저장소로 안내. 구버전 속도·라이선스·노드를 신모델에 그대로 적용하지 않음 |
| [HunyuanVideo-I2V](https://github.com/Tencent-Hunyuan/HunyuanVideo-I2V) | 공식 추론·특수 효과 LoRA 학습 | 후순위 고해상도 실험. 공식 720p 기본 구성은 최소 60GB·권장 80GB. 별도 경량화 시험 없이 24GB 가능으로 안내하지 않음 |

두 모델로 같은 장면을 연속 생성하면 품질이 자동으로 좋아지는 것은 아니다. CogVideoX 결과를 Wan에 다시 통과시키면 인물·장소가 더 바뀔 수 있다. 우선 같은 입력에서 각각 생성하고 결과를 비교·선택한다.

### 6.3 얼굴 표현과 말하는 안내 영상

| 저장소 | 참고 부분 | 적용 판단 |
|---|---|---|
| [LivePortrait](https://github.com/KlingAIResearch/LivePortrait) | inference.py·얼굴 자르기/합성·stitching·눈/입 retargeting | 선택형 후처리 실험. KwaiVGI에서 현재 공식 주소로 이동. 작은 얼굴·가림을 항상 복원하는 보정기가 아님. InsightFace 검출 가중치의 비상업 조건·상용 교체 조건 확인 |
| [Hallo3](https://github.com/fudan-generative-vision/hallo3) | 얼굴 사진 + 오디오 → 토킹 영상. CogVideo 기반 구성 | 여행 안내 캐릭터 등 독립 기능에 적합. 댄스 기본 단계에는 넣지 않음. 기반 CogVideo-5B 조건도 확인 |
| [Hallo2](https://github.com/fudan-generative-vision/hallo2) | 긴 오디오·고해상도 토킹 파이프라인 | 긴 안내 영상 후속 비교. CodeFormer 등 부품 조건 별도 확인. 임의의 전신 댄스 영상을 4K로 고치는 기능으로 해석하지 않음 |

LivePortrait의 영상 기반 표정 전이와 오디오만 받는 토킹헤드는 다른 입력 계약이다. 후처리 전·후를 보존하고 흔들림·목 경계·입 모양이 나빠지면 원본을 선택한다.

### 6.4 포즈·코칭·3D 모션

| 저장소 | 참고 부분 | 적용 판단 |
|---|---|---|
| [MMPose](https://github.com/open-mmlab/mmpose) | RTMPose 등 추정기·서버 데모·포즈 데이터 처리 | 승인된 안무를 서버에서 미리 분석·저장. 포즈 추출 자체가 채점 알고리즘은 아님 |
| [MediaPipe](https://github.com/google-ai-edge/mediapipe) | [웹 Pose Landmarker][mediapipe-web]·@mediapipe/tasks-vision | 실시간 코칭 별도 기능 우선 후보. detectForVideo()는 동기 처리이므로 Web Worker 분리. 월드 좌표를 정확한 바닥·카메라 복원으로 간주하지 않음 |
| [GVHMR](https://github.com/zju3dv/GVHMR) | 중력·세계 좌표 기반 인체 모션 복원 | 3D 후속 연구. LICENSE는 교육·연구·비영리 이용 제한 명시. 발 미끄러짐 완전 제거·BVH/FBX 즉시 출력으로 약속하지 않음 |
| [WHAM](https://github.com/yohanshin/WHAM) | 움직이는 카메라의 전역 인체 모션·메시 | GVHMR 대안. 코드 MIT와 별도로 SMPL·가중치·데이터 조건 확인. 리깅·좌표 변환·내보내기는 추가 구현 |

SMPL(Skinned Multi-Person Linear Model)은 사람의 몸 모양과 관절을 매개변수로 표현한다. 다른 모델이나 캐릭터 파일로 쓰려면 관절·좌표·카메라·렌더링 또는 리타겟팅을 맞춰야 한다.

## 7. 여러 저장소를 조합하는 세 가지 방법

| 사용자 목적 | 처음 만들 조합 | 선택 확장 |
|---|---|---|
| 여행 사진 숏클립 | 기존 보관함 + CogVideoX 또는 Wan/LTX 중 하나 + FFmpeg | 장소 자막·여러 클립 편집 |
| 내 사진으로 댄스 | 승인된 동작 → 모델 전용 포즈 전처리 → UniAnimate **또는** MimicMotion → FFmpeg | 얼굴이 충분히 보일 때 LivePortrait 비교 실험 |
| 카메라 댄스 코칭 | MediaPipe → 좌표 정규화·시간 정렬 → 직접 작성한 유사도 → 화면 피드백 | 기준 안무 MMPose 사전 분석. 정밀 3D는 별도 연구 |

~~~mermaid
flowchart TD
    Goal{"기능 선택"} -->|여행 사진| I2V["CogVideoX 또는 Wan 또는 LTX"]
    Goal -->|댄스 생성| Pose["모델 전용 포즈 추출과 정렬"]
    Pose --> Dance["UniAnimate 또는 MimicMotion"]
    Dance --> Face{"얼굴 후처리 선택"}
    Face -->|조건 충족과 사용자 선택| Portrait["LivePortrait 실험"]
    Face -->|생략| Edit["FFmpeg 편집"]
    Portrait --> Edit
    I2V --> Edit
    Goal -->|실시간 코칭| Browser["MediaPipe와 직접 작성한 채점"]
~~~

### 연결할 데이터는 모델마다 다르다

| 경계 | 맞출 값 | 피할 가정 |
|---|---|---|
| 사진 → 생성 | 크기·비율·색상·정규화·전신/얼굴 검출 | 얼굴 사진으로 가려진 전신 동작까지 정확히 생성 |
| 포즈 → 댄스 | 관절 순서·연결선·손/얼굴·신뢰도·캔버스·프레임률 | MediaPipe 33개 관절을 DWPose 입력과 동일하게 취급 |
| 3D → Champ | SMPL 계열·좌표·카메라·깊이·법선·부위 렌더링 | GVHMR 파일 이름만 바꿔 즉시 입력 |
| 생성 → 얼굴 | 얼굴 추적·가림·프레임 수·배경 합성·목 경계 | LivePortrait가 항상 품질을 개선 |
| 클립 → 최종 영상 | 해상도·프레임률·코덱·길이·오디오·색 공간 | 다른 형식을 단순 연결해도 싱크 유지 |

DWPose는 전신·손·얼굴 포즈를 추출하는 계열이다. 모델마다 필요한 포즈 그림·배열이 다르므로 **처음에는 해당 저장소의 공식 전처리를 그대로 사용한다.** MusePose 정렬 결과를 다른 모델에 쓰려면 별도 변환 검증이 필요하다.

### 실행 환경은 분리한다

하나의 Python 환경에 모두 설치하지 않는다. 모델별 Docker 이미지·의존 버전·체크포인트를 고정하고, Hostinger 관리 API가 작업을 만든다. GPU 어댑터가 표준 요청을 각 모델 입력으로 변환하고 파일·작업 번호로 결과를 넘긴다. PyTorch·CUDA·Diffusers 충돌을 줄이고 모델 하나만 교체·복구하기 쉽다.

CUDA는 NVIDIA GPU 계산 환경이다. 공식 GPU 구성을 기준으로 계획했으며 사용자 노트북에서 같은 추론이 가능하다고 판단한 것은 아니다.

## 8. ComfyUI는 실험 도구로 사용한다

[ComfyUI](https://github.com/Comfy-Org/ComfyUI)는 노드로 실행 단계를 연결해 시험하기 좋다. 현재 공식 저장소는 Comfy-Org/ComfyUI다. 다만 **UniAnimate·MimicMotion·LivePortrait가 한 공식 호환 묶음이라는 근거는 없다.** 커뮤니티 노드의 지원 버전·가중치·조건·메모리를 각각 확인한다.

공식 명령으로 모델 하나 성공 → 같은 입력을 ComfyUI에서 재현 → 노드 커밋과 API용 workflow JSON 고정 → 모델 어댑터 연결 순서로 진행한다. 노드 지원이 불확실하면 공식 Python 진입점을 감싼다. ComfyUI 관리 화면·임의 workflow 실행은 일반 사용자에게 공개하지 않는다.

아래는 공식 README에서 확인한 **실행 출발점**이다. 이번에 GPU에서 실행하지 않았다. 격리된 Linux GPU 환경에서 각 저장소의 설치·모델 다운로드를 먼저 완료한다.

~~~bash
# MimicMotion 저장소 루트
python inference.py --inference_config configs/test.yaml

# UniAnimate-DiT 저장소 루트: 480p 공식 예제
python examples/unianimate_wan/inference_unianimate_wan_480p.py

# MusePose 저장소 루트: 공개 가중치는 비상업 연구용
python pose_align.py --imgfn_refer ./assets/images/ref.png --vidfn ./assets/videos/dance.mp4
python test_stage_2.py --config ./configs/test_stage_2.yaml
~~~

## 9. 개인 영상에 AI를 붙일 때 새로 필요한 연결

### 화면부터 서버 계약까지 함께 바꾼다

현재 JobRequest는 photoId·requestId·trip만 허용하고 추가 필드는 거부한다. Next 중계도 허용 필드가 정해져 있다. 화면에 model만 추가하면 작동하지 않는다. 모델 선택 → Next 입력 검사 → 개인 API 스키마 → 기록 → GPU 어댑터를 함께 바꾼다.

job_response()는 현재 외부 생성 비용 0·method=photo_motion을 반환한다. AI 추가 시 실제 생성 방식·측정 비용에 맞게 수정하고 미확정 비용을 0으로 표시하지 않는다.

| 파일·함수 | 현재 입력·처리·반환 | 새 책임 |
|---|---|---|
| TravelVideoPage | 사진·작업·이력 → 진행 상태·완료 영상 화면 | 모션/여행 AI/댄스 선택, 입력 조건·외부 전송 동의 |
| Next proxy() | 쿠키·요청 → 신원 확인·정규화 → 내부 API 응답 스트림 | 허용된 기능·모델만 채택. owner·endpoint는 서버 결정 |
| 개인 enqueue() | 사진·요청·코스 → 소유자·한도·중복 검사 → 작업 응답 및 SQLite 저장 | 생성 방식·모델·동의·입력 해시 고정과 충돌 검사 |
| 개인 run_once() | 대기 작업 → FFmpeg → 상태·파일 변경, 처리 여부 반환 | CPU 작업만 처리하거나 종류별 분리. 현재 10분 중단 판정을 GPU에 그대로 적용하지 않음 |
| 새 GPU 어댑터 | 현재 없음 | 제출·정확한 상태 조회·취소 가능 여부·결과 회수 |
| 개인 video() | 작업 번호·owner → 소유자·완료·파일 확인 → 영상 바이트 | 같은 보호된 재생 경로 유지. 회수·검증·저장 후 완료 처리 |

### 새 실행 기록을 기존 개인 작업에 연결한다

처음에는 단일 Hostinger 호스트의 SQLite를 유지하고 별도 model_runs를 추가하는 안이 적합하다. 아래는 **제안 필드**다. Runpod에 SQLite 파일을 공유하지 않는다. 여러 호스트가 직접 작업 DB를 수정할 규모라면 전용 PostgreSQL을 검토한다.

| 제안 기록 | 필드 예시 | 목적 |
|---|---|---|
| 개인 작업 연결 | job_id, owner, attempt_no | jobs(id,owner)에 복합 외래키로 연결 |
| 재현 정보 | task, model_id, repo_commit, weights_revision, image_digest, workflow_hash | 코드·가중치·실행 설정 추적 |
| 외부 제출 | provider, endpoint_id, external_job_id, submission_state, request_hash | 공급자 변경 뒤에도 정확한 기존 작업 조회 |
| 입력·동의 | consent_version, consented_at, source_asset_id, motion_asset_id, seed, params_json | 사진·동작·설정·전송 범위 고정 |
| 결과·측정 | storage_key, result_sha256, provider_status, queue_ms, inference_ms, delivery_ms, charge_amount, charge_currency | 생성·저장 성공 분리. 비용 미확정은 NULL |

기존 (owner,request_id) 중복 검사는 모델·동작·설정까지 포함해야 한다. 같은 요청 번호에서 모델이 달라지면 409로 거절한다. 기존 재시도 트리거·상태 인덱스와 새 계약을 맞추고 SQLite 복합 외래키를 약화시키지 않는다.

### 사진 전달과 결과 회수가 필요하다

현재 GPU 작업자는 image_url을 내려받으며 HTTPS·허용 호스트·공개 IP·리다이렉트를 검사한다. 보호된 개인 사진 주소는 로그인 쿠키가 필요하므로 **그 URL을 그대로 Runpod에 보내면 읽을 수 없다.**

1. 서버가 소유자·외부 전송 동의를 확인한다.
2. 사진 하나만 읽을 수 있는 짧은 유효기간의 서명 주소를 발급한다. 새 다운로드 API 또는 비공개 객체 저장소 연결이 필요하다.
3. 큐 대기 중 만료될 수 있으므로 만료·갱신 정책을 정한다. 서명 URL 전체를 로그에 남기지 않는다.
4. GPU의 허용 호스트에 정확한 전달 호스트를 추가하고 기존 주소 검사를 유지한다. 공개 게시글 업로드로 우회하지 않는다.
5. 결과를 비공개 임시 객체로 전달하고 Hostinger가 허용 저장소·타입·크기·코덱·해시를 확인한 뒤 원자적으로 저장한다.
6. 파일과 기록이 모두 준비돼야 개인 작업을 완료로 바꾼다. 기존 소유자 확인 API로 재생한다.

현재 finalize_result()는 Cloudinary URL 중심이다. 개인 영상 결과 전달 어댑터는 별도 구현이 필요하다. saved_item.item_ref에 UUID나 영상 URL을 넣지 않는다. 긴 URL을 갖는 것만으로 소유권 검사가 생기지 않는다.

### 제출 타임아웃과 생성 실패를 구분한다

~~~mermaid
stateDiagram-v2
    [*] --> PREPARED
    PREPARED --> SUBMITTING
    SUBMITTING --> SUBMITTED: 외부 작업 번호 저장
    SUBMITTING --> SUBMIT_UNKNOWN: 응답 단절
    SUBMIT_UNKNOWN --> RECONCILING: 기존 제출 확인
    RECONCILING --> SUBMITTED: 작업 번호 확인
    RECONCILING --> REVIEW_REQUIRED: 확인 불가
    SUBMITTED --> RUNNING: GPU 실행
    RUNNING --> DELIVERING: 생성 성공
    RUNNING --> FAILED: 생성 실패
    DELIVERING --> COMPLETED: 파일 검증과 저장
    DELIVERING --> DELIVERY_RETRY: 회수 실패
    DELIVERY_RETRY --> DELIVERING: 같은 결과 회수
~~~

이는 새 model_runs의 제안 상태다. 기존 jobs의 네 상태와 매핑하고 중간 상태는 별도 필드로 전달한다. 제출 응답 단절 시 외부 생성이 이미 시작됐을 수 있어 무조건 /run을 다시 보내지 않는다. 내부 중복 키만으로 외부의 단 한 번 실행을 보장할 수 없다. 공급자가 사용자 요청 키 조회를 지원하지 않으면 확인 불가로 남겨 검토한다. 다운로드·내부 저장 실패 시에는 같은 결과만 회수하고 생성을 다시 하지 않는다.

## 10. trip_json을 모델에 활용할 범위

trip_json은 검증된 코스의 **선택 장소 설명을 보관한 JSON 문자열**이다. 현재 모델 프롬프트·포즈·촬영 위치 판별에 쓰이지 않는다. 전체 코스 복원 파일도 아니다.

| 기존 필드 | 활용 아이디어 | 한계 |
|---|---|---|
| placeName, placeAddress | 선택 장소 자막·완료 카드·설명 초안 | 실제 촬영 장소 검증값이 아님 |
| itineraryId, poiId, catalogRevision | 같은 코스의 영상 묶음·자료 버전 추적 | 사진·영상 모델 번호·saved_item.item_ref와 다름 |
| contextIssuedAt, notice | 자료 확인 시각·안내 표시 | 방문·아티스트 방문·생성 완료 시각이 아님 |

첫 활용은 “선택 장소명 자막 + 사진에 실제 보이는 내용의 짧은 프롬프트 + 사용자가 선택한 카메라 움직임”이다. 코스에 아티스트 이름이 있다고 사진에 그 사람이 있거나 방문했다고 설명하지 않는다. 새 AI 요청 시 코스 재검증 여부를 명시한다. 기존 재시도는 저장된 trip_json을 복사하며 최신 코스를 자동 재검증하지 않는다.

## 11. 모델링은 연결·비교부터 시작한다

처음부터 기반 영상 모델을 직접 학습할 필요는 없다.

| 단계 | 할 일 | 남길 결과 |
|---|---|---|
| M1. 추론 연결 | 공개 가중치·공식 전처리로 한 건 재현 | 입력·모델 버전·seed·조건·시간·실패 |
| M2. 조합·선택 | 풍경·전신·얼굴·낙서에 맞는 모델 선택·편집·비교 | 성공률·인물/장소 보존·동작 추종·지연·비용 |
| M3. LoRA 미세학습 | 반복 오류와 이용 가능한 데이터가 있을 때만 진행 | 학습·검증·시험 분리, 기반 모델 대비 개선·악화 |

**첫 비교 실험 제안:** 풍경·건물·전신·얼굴·낙서에서 각 4개, 총 20개 허락된 입력을 준비한다. 표본 수는 제안이다. 모델별 지원 입력만 시험하고 가능한 공통 길이·해상도로 비교하되 각 프레임 제약을 기록한다. 같은 seed 숫자가 다른 모델에서 같은 난수를 뜻하지 않으므로 재현용으로만 사용한다.

- 품질: 인물·옷·장소 보존, 손·발·얼굴 왜곡, 깜빡임, 지시 동작, 배경 변형을 같은 기준으로 평가한다.
- 시간: 모델 다운로드·첫 기동, 큐 대기, 추론, 전송, 재생 준비를 나눈다. p95는 상위 5%를 제외한 지연 경계이며 충분한 표본에서 해석한다.
- 비용: 공급자·유휴 GPU·저장·전송·재시도를 분리한다. 단순 추정은 시간당 단가 × 사용시간/3600이며 실제 최소 과금 등은 별도다.
- 댄스: 생성 영상의 포즈를 다시 추출해 기준과 비교하되 가림·검출 실패를 모두 생성 오류로 해석하지 않는다.

실시간 코칭은 몸 중심·크기·거울 방향·카메라 각도를 보정한 뒤 각도 유사도와 DTW(Dynamic Time Warping, 속도가 다른 동작의 시간 맞춤)를 조합하는 별도 알고리즘으로 시작한다. 결과는 동작 유사도 지표이며 전문 춤 실력·안전성 평가로 소개하지 않는다.

학습은 허락된 데이터로만 진행한다. 같은 사람·원본 영상의 인접 프레임이 학습과 시험에 동시에 섞이지 않게 인물·장소·동작 단위로 나눈다. UniAnimate와 CogVideo의 미세학습은 각 기반 모델에서 참고한다. 추론 메모리와 학습 메모리는 다르므로 23GB 추론 수치로 학습 GPU를 정하지 않는다.

## 12. 추천 구현 순서와 완료 기준

아래는 **신규 개발 계획**이다. 이번 문서 게시로 완료 처리하지 않는다.

| 순서 | 작은 구현 단위 | 완료 기준 | 원복 |
|---|---|---|---|
| P0 | 운영 읽기 전용 점검 | Spring 실효 주소·이미지, 개인 볼륨, endpoint별 이미지·최대 작업자·최근 성공 작업 확인 | 변경 없음 |
| P1 | Hostinger 중계와 Spring 전용 주소 | 인증된 단일 제출·상태 연결, 코스·채팅 영향 없음 | 전용 주소·이미지 복구. EC2 자동 재활성화는 하지 않음 |
| P2 | 기존 CogVideoX 한 건 복구 | 동의한 시험 사진의 생성·저장·재생 완료 | 신규 생성 메뉴 차단, 기존 상태 조회 보존 |
| P3 | 개인 AI 계약·기록·결과 회수 | owner·중복·비용·재시도·재시작 복구 확인 | 신규 제출 차단, 기존 행·파일 보존 |
| P4 | 댄스 모델 한 개·승인된 안무 | UniAnimate 또는 MimicMotion 고정 입력 재현·품질 기록 | 해당 route만 비활성화 |
| P5 | Wan/LTX 대안·선택형 얼굴 처리 | 생성·후처리 전후 평가, 악화 시 원본 선택 | 해당 대안·후처리만 끔 |
| P6 | 실시간 코칭 별도 화면 | 브라우저 포즈·시간 정렬·설명 가능한 피드백 | 코칭 화면 비활성화 |
| P7 | 필요할 때 LoRA·Hostinger GPU 이관 | 품질 개선 또는 새 공급자 제출·조회·복구 계약 통과 | 새 작업만 이전 경로, 진행 작업은 원래 공급자 조회 |

가장 작은 시작은 **P0 → P1 → P2**다. 기존 여행 사진 AI 경로를 되살린 뒤 댄스·코칭을 추가한다. 여러 모델 동시 학습·모든 저장소 설치부터 시작하지 않는다.

## 13. 시험·진단·복구

| 상황 | 기대 결과 |
|---|---|
| 남의 사진·작업 번호 요청 | 조회·생성·재생 차단, 기존 소유자 검사 유지 |
| 같은 요청 반복·다른 모델 재사용 | 같은 작업 반환 또는 409. 중복 GPU 제출 방지 |
| 제출 응답 단절 | SUBMIT_UNKNOWN 기록·기존 제출 확인, 자동 재생성 금지 |
| 생성 성공·결과 저장 실패 | 생성과 전달 실패 분리, 같은 결과 회수만 재시도 |
| 서명 만료·금지 호스트·리다이렉트 | 입력 전달 실패 표시, 임의 공개 업로드·제한 해제 금지 |
| Tora 단일·일반 단일·배치 | 실제 endpoint·이미지 기능 일치. Tora 배치 별도 확인 |
| 중계/GPU 재시작·endpoint 변경 | 저장된 작업 번호·원래 endpoint로 복구 |
| 기능 끔 | 신규 제출 차단과 기존 이력·완료 재생 정책 구분 |
| 모바일·키보드·계정 전환 | 입력·동의·상태 확인 가능, 이전 계정 자료 제거 |

기존 회귀 시험 후보는 tests/test_photo_video.py, tests/test_photo_video_database.py, tests/test_photo_video_context.py, tests/test_course_context.py와 프런트 travelVideoProxy.test.ts·travelVideo.test.tsx다. 새 GPU 어댑터는 모형 서버에서 제출·응답 단절·복구를 먼저 확인하고 별도 허용된 GPU 시험으로 진행한다. **이번 작성에서 제품 시험·유료 생성 시험은 실행하지 않았다.**

| 증상 | 확인 위치 | 조치 방향 |
|---|---|---|
| 영상 요청 404 | 대상이 cpu_app인지·중계 route 존재 | 전용 중계 주소·네트워크 확인 |
| 중계 401 | 양쪽 내부 키 | 값 출력 없이 일치·길이·주입 확인 |
| 중계 501 | Runpod 키·선택 endpoint 변수 | 설정 누락 확인, fallback과 분리 완료 구분 |
| 계속 대기 | 최대 작업자·가용 GPU·기동·다운로드 | 큐·실행 로그 구분, 중복 /run 금지 |
| 외부 완료·개인 재생 실패 | 회수·코덱·파일·owner | 외부 완료와 내부 완료 분리 복구 |
| 손·발·얼굴 깨짐 | 전신 노출·가림·포즈 신뢰도·정렬 | 입력 조건·모델 비교, 얼굴 후처리를 자동 정답으로 보지 않음 |

SQLite와 JPEG·MP4를 같은 시점 기준으로 함께 백업한다. 기존 이력을 보존하는 추가 스키마로 진행하고 기록을 삭제하는 역마이그레이션을 피한다. docker compose down -v를 원복 명령으로 사용하지 않는다. 진행 중인 외부 작업은 원래 공급자·endpoint로 추적한다.

## 14. 확인 상태와 남은 결정

| 항목 | 상태 |
|---|---|
| 최신 main·기존 보고서 대조 | 완료. 개인 FFmpeg·커뮤니티 Runpod·Hostinger CPU 경계 확인 |
| 저장소·공식 문서 조사 | 완료. 현재 이동 주소·일부 사용 조건·공식 메모리 사례 반영 |
| 문서 검수 | HTML 데스크톱·모바일, 내부 링크·도식·한글·설명용 선택 도구 확인. 상세 결과는 verification.json 참고 |
| 운영 실제 EC2 목적지·Hostinger 실효 설정 | 이번 조사 미확인 |
| Runpod 현재 상태·실제 GPU 생성 | 이번 조사 미확인·미실행 |
| 결정 시점 | P0 이후 실제 GPU 이용 전 공급자·예산·전송 동의·모델 조건 확정. 가이드 게시의 선행 조건은 아님 |

이번 문서는 조사와 개발 계획이다. 운영 서버 이전·모델 구현 완료를 뜻하지 않는다.

## 공식 근거와 관련 소스

KMovement 링크는 분석 커밋에 고정했다. 외부 저장소는 현재 문서 링크이므로 구현 시 커밋·가중치 버전을 추가 고정한다.

- [Hostinger GPU 공식 안내][hostinger-gpu]: 일반 VPS와 별도 상품·과금·데이터 수명.
- [Runpod 비동기 제출·조회][runpod-api]: /run·/status 계약.
- [MediaPipe 웹 가이드][mediapipe-web]: 좌표·동기 처리·Web Worker.
- [MusePose 조건](https://github.com/TMElyralab/MusePose#disclaimerlicense), [LivePortrait 조건](https://github.com/KlingAIResearch/LivePortrait/blob/main/LICENSE), [GVHMR 조건](https://github.com/zju3dv/GVHMR/blob/main/LICENSE).
- [UniAnimate 메모리·추론](https://github.com/ali-vilab/UniAnimate-DiT), [MimicMotion 추론](https://github.com/Tencent/MimicMotion), [Hunyuan 하드웨어](https://github.com/Tencent-Hunyuan/HunyuanVideo-I2V).

[s-worker]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/deploy/photo_video/worker.py
[s-private]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/deploy/photo_video/app.py
[s-next]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/subproject/SDUI/metadata-project/app/api/travel-video/%5B...path%5D/route.ts
[s-animation]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/subproject/SDUI/SDUI-server/src/main/java/com/domain/demo_backend/domain/community/service/AnimationService.java
[s-delivery]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/deploy/media_motion/result_delivery.py
[s-profile]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/subproject/SDUI/SDUI-server/src/main/resources/application-hostinger-g1.yml
[s-cpu]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/src/api/cpu_app.py
[s-ec2]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/.github/workflows/deploy-ec2.yml
[s-private-compose]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/deploy/photo_video/hostinger.compose.yml
[s-gateway]: https://github.com/feed-mina/KMovement/blob/ce257f437fd7f91aff4a80badb10f1b3917ac6f8/deploy/cloud_gateway/app.py
[hostinger-gpu]: https://www.hostinger.com/support/how-to-set-up-a-gpu-instance-at-hostinger/
[runpod-api]: https://docs.runpod.io/serverless/endpoints/send-requests
[mediapipe-web]: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
