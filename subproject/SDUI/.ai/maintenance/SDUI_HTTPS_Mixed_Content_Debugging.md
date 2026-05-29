# SDUI HTTPS (Mixed Content) Debugging

## TodoList

- [X] Create step-by-step diagnostic plan
- [X] Check AWS EC2 connectivity (User confirmed: `ERR_CONNECTION_TIMED_OUT` and Instance Status Check Failed)
- [X] Recover the AWS EC2 instance (Reboot/Stop & Start)
- [X] Verify Docker container status after recovery (Confirmed port 8081 is active)
- [X] Fix Out-Of-Memory (OOM) vulnerability (Applied 2GB Swap File)

## Research

- **[진단 완료]** AWS EC2 인프라 장애 (인스턴스 상태 검사 1/2 통과 실패)
- 백엔드 서버가 완전히 죽어서 발생했던 1차 원인은 해결됨. (Swap 2GB 추가 완료)
- **[진단 완료]** Vercel 프론트엔드 포트 설정: [next.config.ts](file:///c:/Users/Samsung/Documents/Personal/Resume/2026/job_antigravity/SDUI/metadata-project/next.config.ts)는 HTTP 80(또는 도메인)을 바라보게 한 뒤, AWS에서 Nginx(80 -> 8081)로 넘기는 구조 또는 Nginx HTTPS 프록시 적용이 필요.
- AWS에서 직접 Test한 결과: `curl -I http://43.201.237.68:8081/api/ui/MAIN_PAGE` (200 OK 성공!)

## Solution

- [X] Apply the necessary fix (Nginx + SSL proxy on AWS)
    - [X] 무료 도메인(DuckDNS: `yerin.duckdns.org`) 발급 및 AWS IP(`43.201.237.68`) 연결 완료
    - [X] Nginx 설치/설정 및 `8081` 백엔드 프록시 매핑 완료
    - [X] Certbot(Let's Encrypt)으로 무료 HTTPS 인증서 발급 완료 (`https://yerin.duckdns.org`)
- [X] AWS 데이터베이스 직접 검증 및 [backup.sql](file:///c:/Users/Samsung/Documents/Personal/Resume/2026/job_antigravity/SDUI/backup.sql) 현행화 완료
    - AWS `ui_metadata` 테이블 내 카카오 `action_url`이 최신 운영 URL(`https://yerin.duckdns.org`)로 정상 반영되어 있음을 쿼리로 확인 (추가 DB 업데이트 불필요)
    - `backup_new.sql` 최신 스냅샷 우분투에서 생성 후, 로컬 윈도우 환경으로 다운로드(`scp`) 완료
- [X] Vercel 프론트엔드([next.config.ts](file:///c:/Users/Samsung/Documents/Personal/Resume/2026/job_antigravity/SDUI/metadata-project/next.config.ts) 및 환경변수)를 새 HTTPS 백엔드 주소로 변경하여 재배포 완료
    - 로컬 코드 변경(HTTPS 도메인 반영) 및 신규 [backup.sql](file:///c:/Users/Samsung/Documents/Personal/Resume/2026/job_antigravity/SDUI/backup.sql) 병합
    - 로컬과 원격(README.md) 충돌 발생을 `git commit --no-edit`으로 해결 후 최종 Push 완료