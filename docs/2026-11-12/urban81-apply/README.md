# 운영 DB에 V125 적용 + URBAN81을 SEVENTEEN·민규 양쪽에 연결 (2026-11-12)

민아님 승인(2026-11-12): ① URBAN81을 SEVENTEEN·민규 둘 다에 연결 ② SEVENTEEN → BTS 순서로 검수 ③ V125 운영 DB 즉시 적용.

V125는 Flyway 마이그레이션이라 **Spring 컨테이너가 V125를 포함한 이미지로 다시 시작될 때** 자동 적용됩니다.
운영 Spring 배포는 VPS에서 수동으로 합니다(`deploy/hostinger/G1-SPRING-PLATFORM-RUNBOOK-KO.md`).

## 순서 (VPS `root@kmovement.srv1869569.hstgr.cloud`)

1. 읽기 전용 확인: 현재 Spring 이미지 digest, `flyway_schema_history`의 최신 version.
   - 125가 이미 있으면 2·3단계는 건너뜁니다.
2. 백업: `pg_dump -Fc` 로 운영 DB 덤프를 `/docker/kmovement-g1/backups/`에 남기고 크기가 0이 아님을 확인합니다.
3. Spring 교체: `.env`의 `KMOVEMENT_SPRING_IMAGE`를 V125 포함 이미지 digest로 바꾸고(이전 값은 롤백용으로 기록)
   `docker compose pull spring && docker compose up -d spring` → health 확인 → `flyway_schema_history`에 125 success 확인.
   - 실패 시 런북 8장대로 이전 digest로 롤백합니다. DB volume은 지우지 않습니다.
4. 데이터: `psql -v ON_ERROR_STOP=1 -1 -f apply_urban81_seventeen_mingyu.sql`
   - 근거 2행(seventeen, seventeen-mingyu)과 방문 정책 1행이 모두 PENDING 이어야 합니다.
   - 민규 행은 `approved_yn='N'`이라 온보딩 목록·추천 코스에는 아직 나오지 않습니다. URBAN81을 VERIFIED로 올릴 때 함께 'Y'로 바꿉니다.

비밀값은 출력·기록하지 않습니다.
