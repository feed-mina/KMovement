# Research Notes

## 0529_TorchServer&community.md 메모 조사 결과

### [메모 L6] CPU fallback 동작 방식 — [완료]
- `src/api/torchserve_client.py`에 2단계 제어:
  - `TORCHSERVE_ENABLED=false` → TorchServe 건너뛰고 즉시 로컬 CPU 모델 사용
  - `TORCHSERVE_FALLBACK=true` → TorchServe 장애 시 자동으로 CPU 전환 (silent)
- 4개 모델 모두 dual path 구현: embedder, reranker, weather_lstm, event_ner
- 현재 배포 상태: `TORCHSERVE_ENABLED=false`, `TORCHSERVE_FALLBACK=true` (항상 CPU)
- TorchServe 장애 시: HTTP 타임아웃(5~10초) → 예외 catch → 로컬 모델로 silent fallback
- 로컬 모델은 lazy-load (첫 요청에서 다운로드+초기화, 이후 재사용)
- 주의: fallback 발생 시 로깅 없음 (silent failure)

### [메모 L16] user 테이블과 animation 조인 — [완료]
- `community_post` 테이블에 이미 `author_sqno BIGINT REFERENCES users(user_sqno)` 존재
- 따라서 `community_animation_jobs`에 별도 `user_id` 불필요
- 조인 경로: `animation_jobs.post_id → community_post.post_id → community_post.author_sqno → users.user_sqno`
- 권장: `post_id`에 `ON DELETE CASCADE` + 인덱스 추가
- 참고: V40 마이그레이션의 실제 테이블명은 `community_post` (복수형 아님)

### [메모 L47] 크론잡/배치서버로 핵심 DB 보호 — [미착수]
- 향후 과제: pg_dump 크론잡 또는 Supabase 자동 백업 설정 검토 필요
- 핵심 테이블: users, community_post, post_image 등

### [메모 L65] 영상 완성 시 알림(카카오톡/슬랙/디스코드) — [미착수]
- 향후 과제: AnimationService에서 완료 콜백 시 알림 연동
- 후보: Kakao 알림톡 API, Slack Webhook, Discord Webhook

### [메모 L86] TorchServe GCP 배포 새 워크플로우 — [미착수]
- 기존 `deploy-gcp.yml`에 인라인 추가 또는 별도 `deploy-torchserve.yml` 생성 필요
- Artifact Registry: `asia-northeast3-docker.pkg.dev/{PROJECT}/kride-ai/torchserve-gpu:latest`
