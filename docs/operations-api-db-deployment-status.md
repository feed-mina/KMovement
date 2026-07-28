# 운영 API·DB 서버 배포 현황

> **2026-07-23 이후 이 문서는 과거 현황 기록입니다.** 현재 운영 계약과
> 비용·폐기 기준은
> [`deployment-cost-optimization.md`](./deployment-cost-optimization.md)를
> 따릅니다. 아래의 `deploy-cloud-run.yml`·`deploy-gcp.yml` 안내는 재실행하지
> 않습니다.
>
> 기준일: 2026-07-14 (Asia/Seoul)
>
> 근거: 저장소의 GitHub Actions·Docker 배포 설정 및 이 작업 공간에서 확인한 로컬 프로세스.
> 주의: GitHub Actions 실행 이력, EC2/Cloud Run 콘솔, 원격 DB에는 접속하지 않았으므로 **현재 실제 가동 여부·배포 리비전·데이터 값은 확인되지 않음**.

## 한눈에 보기

| 영역 | 구성상 배포 대상 | 현재 확인 수준 | 운영 데이터 저장소 |
|---|---|---|---|
| SDUI 웹/백엔드 | AWS EC2 Docker | 설정 확인 | PostgreSQL `SDUI_TD` (main) |
| K-Ride FastAPI | EC2 Docker 또는 GCP Cloud Run | 설정 확인 | Neo4j, Supabase 연동 설정 |
| AI 배치/워커 | GCP VM 또는 RunPod | 설정 확인 | Redis·Neo4j·Supabase 연동 설정 |
| SDUI 캐시 | EC2 Docker Redis | 설정 확인 | Redis 컨테이너 `sdui-redis` |
| 로컬 개발 DB | Docker Compose PostGIS | 설정 확인, Docker 미가동 | `kride_safety` |

## 1. SDUI 서비스: AWS EC2

`main` 브랜치의 EC2 배포 설정은 아래 컨테이너 구성을 정의합니다.

| 컴포넌트 | 컨테이너/포트 | 역할 |
|---|---|---|
| Next.js 프런트엔드 | `sdui-frontend`, `3000:3000` | 웹 UI 제공 |
| Spring Boot API | `sdui-backend`, `8080:8080` | 인증, SDUI, 관리자 API |
| Redis | `sdui-redis` | 세션·UI/쿼리 캐시, FastAPI 큐 브로커 |
| K-Ride FastAPI | `kride-fastapi`, `8000:8000` | RAG·추천·미디어 API, `/api/health` 헬스 체크 |
| PostgreSQL | `sdui-db:5432` | Spring Boot의 SDUI 데이터 저장소 |

### DB 선택 규칙

| 배포 브랜치 | Spring 컨테이너 | PostgreSQL DB | 용도 |
|---|---|---|---|
| `main` | `sdui-backend` | `SDUI_TD` | 메인/운영 후보 |
| 그 외 배포 브랜치 | `sdui-backend-lab` | `SDUI_LAB` | 실험·랩 환경 |

Spring Boot는 `jdbc:postgresql://sdui-db:5432/<DB_NAME>`로 연결하도록 설정됩니다. DB 사용자명과 비밀번호는 GitHub Secrets에서 주입되며 이 문서에는 기록하지 않습니다.

### 관리자 계정 조회 대상

SDUI 관리자 화면(`/view/admin/ADMIN_DASHBOARD`)은 `ROLE_ADMIN` 권한을 요구합니다. 메인 서비스의 계정을 확인할 때는 원칙적으로 EC2의 **`SDUI_TD`** DB에서 아래처럼 조회합니다.

```sql
SELECT user_id, email, username, nickname, role
FROM users
WHERE role = 'ROLE_ADMIN'
ORDER BY user_id;
```

비밀번호, 해시, JWT·OAuth·외부 API 키는 조회·문서화하지 않습니다.

## 2. K-Ride FastAPI 배포 경로

FastAPI는 두 경로가 공존합니다. 실제 운영 경로는 배포 실행 이력 또는 서비스 콘솔에서 확정해야 합니다.

| 경로 | 트리거 | 런타임 | 상태 판정 방법 |
|---|---|---|---|
| EC2 Docker | `deploy-ec2.yml` | `kride-fastapi` 컨테이너, 8000 포트 | EC2에서 `docker ps`, `curl http://localhost:8000/api/health` |
| GCP Cloud Run | `deploy-cloud-run.yml` 수동 실행 | 기본 서비스명 `kmovement`, `europe-west1` | Cloud Run 리비전·`/api/health` 확인 |
| GCP VM AI 서비스 | `deploy-gcp.yml` 수동 실행 | FastAPI·Celery worker·선택적 TorchServe | GCP VM의 컨테이너/서비스 상태 확인 |

Cloud Run 배포 워크플로는 구 프로젝트 `quartz-kiba`를 명시적으로 거부하며, 새 GCP 프로젝트 ID와 `GCP_SA_KEY`가 있어야 실행됩니다. Cloud Run은 Neo4j·Supabase·Groq 설정을 Secrets에서 주입합니다.

## 3. GPU/미디어 워커

| 워커 | 배포 방식 | 트리거 |
|---|---|---|
| Media motion | RunPod용 Docker 이미지 `kride-media-gpu` | `main`에 `deploy/media_motion/**` 변경 시 |
| Tora | RunPod용 Docker 이미지 `kride-tora-gpu` | `main`에 Tora 배포 관련 변경 시 |
| TorchServe/Celery | GCP VM AI 배포 구성 | 수동 워크플로 실행 |

이미지 푸시는 워커가 실제로 실행 중이라는 증거가 아닙니다. RunPod endpoint 상태 및 최근 작업 로그를 별도로 확인해야 합니다.

## 4. 데이터 저장소 구분

| 저장소 | 구성상 역할 | 접속 위치/식별자 | 운영 여부 |
|---|---|---|---|
| PostgreSQL | SDUI 사용자·콘텐츠·메타데이터 | EC2 네트워크의 `sdui-db:5432`, `SDUI_TD` 또는 `SDUI_LAB` | 원격 미검증 |
| Redis | SDUI 캐시, FastAPI Celery broker/result | `sdui-redis:6379` | 원격 미검증 |
| Neo4j | GraphRAG 지식 그래프 | `NEO4J_*` Secrets | 원격 미검증 |
| Supabase | K-Ride 연동 데이터 | `SUPABASE_*` Secrets | 원격 미검증 |
| ChromaDB | FastAPI 벡터 검색 | 컨테이너 내부 `/app/chroma_db` | 컨테이너별 영속성 검증 필요 |
| PostGIS | 로컬 안전/공간 데이터 개발 구성 | Docker Compose `kride_safety` | 로컬 Docker 미가동 |

## 5. 이번 점검에서 확인한 로컬 상태

- Docker Desktop 엔진에 연결할 수 없어 로컬 컨테이너 및 EC2 컨테이너 상태는 확인하지 못했다.
- 로컬 PostgreSQL은 5432, 5433, 5434 포트에서 수신 중인 프로세스가 있었다.
- 로컬에 `.env`, `subproject/SDUI/.env`, `subproject/SDUI/SDUI-server/.env`, `subproject/SDUI/metadata-project/.env.local` 파일은 없었다.
- 따라서 로컬 PostgreSQL 프로세스를 `SDUI_TD` 운영 DB로 간주해서는 안 된다. 운영 DB의 호스트·접속 권한 또는 EC2 SSH 권한이 필요하다.

## 6. 운영 상태 확정 체크리스트

- [x] GitHub Actions에서 최근 성공한 `deploy-ec2.yml` 실행을 확인한다. (2026-07-26 확인: 마지막 성공은 2026-07-16 `331217277`, 이후 10회 연속 실패)
- [x] EC2에서 `sdui-frontend`, `sdui-backend`, `sdui-redis`, `kride-fastapi`의 실행 상태와 이미지 태그를 확인한다.
- [ ] EC2 `sdui-db`의 `SDUI_TD`에 읽기 전용으로 연결해 Flyway 버전과 `ROLE_ADMIN` 계정을 확인한다.
- [ ] Cloud Run `kmovement`의 최신 리비전·트래픽 비율·`/api/health` 응답을 확인한다.
- [ ] RunPod의 Media/Tora endpoint가 현재 이미지 태그로 실행 중인지와 최근 작업 성공 여부를 확인한다.
- [ ] Neo4j·Supabase 연결 상태 및 운영/개발 프로젝트 분리를 확인한다.

## 참고한 설정

> 이 문서가 작성된 2026-07-14 기준 목록입니다. `deploy-cloud-run.yml`,
> `deploy-gcp.yml`, `ec2-fix-frontend.yml`, `ec2-fix-ssl.yml`,
> `ec2-diagnose.yml`, `ec2-apply-migration.yml` 은 #177에 따라 저장소에서
> 제거되었습니다. 현재 워크플로 목록은 아래와 같습니다.

작성 당시 참고한 설정:

- `.github/workflows/deploy-ec2.yml`
- `.github/workflows/deploy-cloud-run.yml` (제거됨)
- `.github/workflows/deploy-gcp.yml` (제거됨)
- `.github/workflows/deploy-runpod.yml`
- `.github/workflows/deploy-runpod-tora.yml`
- `docker-compose.yml`
- `docs/cloud_run_kmovement_deploy.md`

2026-07-26 기준 실제 워크플로:

| 워크플로 | 트리거 | 역할 |
|---|---|---|
| `ci.yml` | push/PR | 빌드 검증 |
| `deploy-ec2.yml` | `main` push (해당 경로) + 수동 | **유일한 배포 경로**. Spring/Next.js/FastAPI/Celery |
| `ec2-deploy-frontend.yml` | 수동 | 프런트엔드 단독 재배포. `deploy-ec2` 와 같은 concurrency group |
| `deploy-runpod.yml` | `main` push (media 경로) | RunPod Media 워커 이미지 |
| `deploy-runpod-tora.yml` | `main` push (media 경로) | RunPod Tora 워커 이미지 |
| `ec2-audit.yml` | 수동 | EC2 읽기 전용 감사 |
| `gcp-cost-audit.yml` | 수동 | GCP 읽기 전용 비용 감사 |
| `runpod-cost-audit.yml` | 수동 | RunPod 읽기 전용 비용 감사 |

> 레거시 Cloud Run 서비스(`kmovement-46122739597.europe-west1.run.app`)는
> 배포 워크플로가 제거된 뒤에도 계속 실행 중입니다. 워크플로 삭제는 외부
> 클라우드 과금 중단의 근거가 아닙니다.
