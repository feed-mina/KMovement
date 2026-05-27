# 코드 리뷰 결과 — 2026-05-27

## 범위
프론트엔드 + 백엔드 + AI 모델 코드 전체 (커뮤니티 + 영상 모델링 연계)

---

## 프론트엔드 이슈 (metadata-project)

### HIGH
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| F1 | 이미지 업로드 크기/타입 미검증 | `CommunityPage.tsx` (414행) | 500MB+ 파일 업로드 가능, OOM 위험 |
| F2 | SSE 스트림 타임아웃 없음 | `useSSEStreamV2.ts` (25행) | 서버 응답 없으면 무한 대기 |
| F3 | 스케치 캔버스 640x480 고정 | `CommunityPage.tsx` | 모바일에서 잘림 |
| F4 | 마이크 권한 거부 무반응 | `AudioRecorder.tsx` | 사용자에게 피드백 없음 |

### MEDIUM
| # | 이슈 | 파일 |
|---|------|------|
| F5 | 한국어 감지 정규식 부정확 | `useAIChatLogic.ts` (140행) — 혼합 텍스트에서 오작동 |
| F6 | 멤버십 체크 에러 무시 | `AIChatComponentV2.tsx` (64행) — `.catch(() => {})` |
| F7 | axios 요청 타임아웃 미설정 | `communityService.ts` — 느린 네트워크에서 무한 대기 |

---

## 백엔드 이슈 (SDUI-server)

### CRITICAL
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| B1 | DTO 입력 검증 없음 | `PostCreateRequest.java` 등 | `@NotBlank`/`@Size` 누락 → XSS/리소스 고갈 |
| B2 | 파일 업로드 크기 제한 없음 | `SupabaseStorageService.java` (28행) | DoS 가능 |
| B3 | application.yml 하드코딩 비밀번호 | `application.yml` (12, 42, 61, 71행) | DB/메일/JWT/카카오 키 |
| B4 | 파일 타입 MIME 미검증 | `S3Service.java` (97행) | 확장자만 체크, .exe 등 허용 |

### HIGH
| # | 이슈 | 파일 |
|---|------|------|
| B5 | 커뮤니티 권한 체크 미흡 | Controllers — 관리자 오버라이드 없음, 차단 시스템 없음 |
| B6 | OpenAI 비용 임계값 경고만 | `OpenAiClient.java` (46행) — 서킷 브레이커 없음 |
| B7 | 에러 메시지 정보 노출 | Services — 상세 에러를 클라이언트에 반환 |

---

## AI 모델 이슈 (deploy/media_motion)

### 배포 준비 상태
| 모델 | 상태 | 블로커 |
|------|------|--------|
| AnimatedDrawings | ✅ Ready | Joint 검증 레이어 필요 (사용자 드로잉) |
| GPT-SoVITS TTS | ✅ Ready | 의존성 버전 핀닝 필수 (huggingface_hub==0.23.5 등) |
| CogVideoX | ⚠️ Partial | GPU 필수 (~4GB VRAM), CUDA 사전 빌드 필요 |
| 3D Photo Inpainting | ⚠️ Partial | 외부 명령 설정 필요, 별도 설치 |
| TorchServe | ❌ Blocked | GPU 이미지 레지스트리 미등록 |

### 핵심 이슈
| # | 이슈 | 설명 |
|---|------|------|
| M1 | TorchServe GPU 이미지 미빌드 | Artifact Registry에 없음 → in-process fallback 사용 중 |
| M2 | GPT-SoVITS 의존성 충돌 | Python 3.12 패치 + 6개 패키지 핀닝 필요 |
| M3 | AnimatedDrawings Joint 오류 | 사용자 드로잉에서 `right_shoulder` 등 누락 시 AssertionError |
| M4 | Kaggle OOM | 4개 모델 동시 로딩 시 커널 재시작 (CogVideoX 4GB + AD 2GB + TTS 2GB) |

### 미구현 (Phase 4)
- 커뮤니티 스케치 → AnimatedDrawings 엔드포인트
- 커뮤니티 사진 → 영상 생성 큐
- Job 상태 폴링 + 결과 다운로드

---

## 권장 우선순위

### P0 — 즉시 수정
1. B1: DTO 검증 어노테이션 추가
2. B2/F1: 파일 업로드 크기 제한 (클라이언트 10MB + 서버 50MB)
3. B3: application.yml 하드코딩 비밀번호 → 환경변수 only

### P1 — 배포 전
4. F2: SSE 타임아웃 30초 추가
5. B4: MIME 타입 검증 추가
6. F3: 스케치 캔버스 반응형

### P2 — 기능 추가 시
7. M3: AnimatedDrawings Joint 검증 + fallback 매트릭스
8. M2: GPT-SoVITS 격리 환경 (Docker/conda)
9. 커뮤니티 ↔ 모델 연동 엔드포인트
