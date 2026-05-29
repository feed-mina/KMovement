# Flyway 기반 DB 마이그레이션 및 배포 가이드

## 개요

이 가이드는 SDUI 프로젝트에서 Flyway를 사용하여 데이터베이스 스키마를 버전 관리하고, lab/claude-dev → main 순서로 안전하게 배포하는 방법을 설명합니다.

---

## 구현 완료 사항

### ✅ 1. Flyway 설정
- **application.yml**: `ddl-auto: validate`, Flyway 설정 추가
- **application-prod.yml**: Flyway 설정 추가

### ✅ 2. 마이그레이션 스크립트 (7개)
- **V1__baseline_schema.sql**: 기존 diary 테이블 기록 (문서용)
- **V2__create_content_table.sql**: content 테이블 생성, diary_backup 생성
- **V3__migrate_diary_to_content.sql**: diary → content 데이터 이관
- **V4__update_ui_metadata_rbac.sql**: ui_metadata RBAC 컬럼 추가
- **V5__update_query_master_redis.sql**: query_master Redis 컬럼 추가
- **V6__update_metadata_content_refs.sql**: 메타데이터에서 diary → content 변경
- **V7__drop_diary_table.sql**: diary 테이블 삭제

### ✅ 3. GitHub Actions 개선
- 브랜치별 컨테이너명/포트/DB명 자동 설정
- Flyway 검증 단계 추가
- 브랜치별 이미지 태그 (main, lab-claude-dev)
- 배포 후 헬스 체크 및 Flyway 상태 확인
- Redis 캐시 자동 무효화

---

## 로컬 테스트 (Phase 1)

### 1단계: 브랜치 확인
```bash
git checkout lab/claude-dev
git status
```

### 2단계: Docker Compose 재시작
```bash
# 프로젝트 루트에서
docker-compose down
docker-compose up -d

# PostgreSQL 및 Redis 상태 확인
docker ps | grep sdui
```

### 3단계: Flyway 마이그레이션 실행
```bash
cd SDUI-server

# Flyway 정보 확인 (실행 전)
./gradlew flywayInfo

# 마이그레이션 실행
./gradlew flywayMigrate

# 마이그레이션 결과 확인
./gradlew flywayInfo
```

### 4단계: DB 검증
```bash
# PostgreSQL 접속 (port 5433)
psql -U postgres -d testdb -h localhost -p 5433

# Flyway 히스토리 확인
SELECT version, description, type, installed_on, success
FROM flyway_schema_history
ORDER BY installed_rank;

# content 테이블 확인
\d content

# diary_backup 확인
SELECT COUNT(*) FROM diary_backup;
SELECT COUNT(*) FROM content;

# ui_metadata 변경 확인
SELECT screen_id, COUNT(*) FROM ui_metadata
GROUP BY screen_id
HAVING screen_id LIKE 'CONTENT%';

# query_master 변경 확인
SELECT sql_key FROM query_master WHERE sql_key LIKE 'GET_CONTENT%';
```

### 5단계: 애플리케이션 시작
```bash
# SDUI-server 디렉토리에서
./gradlew bootRun
```

### 6단계: API 테스트
```bash
# 콘텐츠 목록 조회
curl http://localhost:8080/api/content/list

# UI 메타데이터 조회
curl http://localhost:8080/api/ui/CONTENT_LIST

# 콘텐츠 작성 (인증 필요)
curl -X POST http://localhost:8080/api/content/write \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title":"테스트","content":"테스트 내용","date":"2026-03-03"}'
```

---

## AWS 배포 (Phase 2 & 3)

### Phase 2: lab/claude-dev 브랜치 배포

#### 1단계: Git Push
```bash
git checkout lab/claude-dev
git add .
git commit -m "feat: Flyway 마이그레이션 시스템 구축"
git push origin lab/claude-dev
```

#### 2단계: GitHub Actions 모니터링
- GitHub 저장소 → Actions 탭으로 이동
- 워크플로우 진행 상황 확인
- 각 단계별 로그 확인:
  - ✅ Build with Gradle
  - ✅ Validate Flyway Migrations
  - ✅ Docker build and push (lab-claude-dev 태그)
  - ✅ Deploy to AWS (sdui-backend-lab, port 8081, SDUI_LAB)

#### 3단계: AWS 서버 확인
```bash
# SSH 접속
ssh ubuntu@43.201.237.68

# 컨테이너 상태 확인
docker ps | grep sdui-backend-lab

# 로그 확인
docker logs -f sdui-backend-lab

# Flyway 히스토리 확인
docker exec sdui-db psql -U postgres -d SDUI_LAB \
  -c "SELECT version, description, installed_on FROM flyway_schema_history ORDER BY installed_rank;"

# content 테이블 데이터 확인
docker exec sdui-db psql -U postgres -d SDUI_LAB \
  -c "SELECT COUNT(*) FROM content; SELECT COUNT(*) FROM diary_backup;"
```

#### 4단계: API 테스트
```bash
# 콘텐츠 목록 조회 (SDUI_LAB, port 8081)
curl http://43.201.237.68:8081/api/content/list

# UI 메타데이터 조회
curl http://43.201.237.68:8081/api/ui/CONTENT_LIST
```

---

### Phase 3: main 브랜치 배포 (프로덕션)

#### 1단계: 브랜치 병합
```bash
# main 브랜치로 전환
git checkout main

# lab/claude-dev 병합
git merge lab/claude-dev

# 또는 rebase (깔끔한 히스토리)
# git rebase lab/claude-dev
```

#### 2단계: 최종 확인
```bash
# 변경사항 확인
git log --oneline -10

# Content.java 엔티티 확인
cat SDUI-server/src/main/java/com/domain/demo_backend/domain/content/domain/Content.java

# 마이그레이션 스크립트 재검토
ls -lh SDUI-server/src/main/resources/db/migration/
```

#### 3단계: Git Push
```bash
git push origin main
```

#### 4단계: GitHub Actions 모니터링
- GitHub Actions에서 main 브랜치 워크플로우 확인
- 배포 단계 확인:
  - ✅ Docker build and push (main 태그)
  - ✅ Deploy to AWS (sdui-backend, port 8080, SDUI_TD)

#### 5단계: 프로덕션 검증
```bash
# SSH 접속
ssh ubuntu@43.201.237.68

# 컨테이너 상태 확인
docker ps | grep sdui-backend

# 로그 확인
docker logs -f sdui-backend

# Flyway 히스토리 확인 (SDUI_TD)
docker exec sdui-db psql -U postgres -d SDUI_TD \
  -c "SELECT version, description, installed_on FROM flyway_schema_history ORDER BY installed_rank;"

# 데이터 확인
docker exec sdui-db psql -U postgres -d SDUI_TD \
  -c "SELECT COUNT(*) AS content_count FROM content; SELECT COUNT(*) AS backup_count FROM diary_backup;"
```

#### 6단계: API 테스트
```bash
# 콘텐츠 목록 조회 (SDUI_TD, port 8080)
curl http://43.201.237.68:8080/api/content/list

# UI 메타데이터 조회
curl http://43.201.237.68:8080/api/ui/CONTENT_LIST

# 프론트엔드에서 테스트
# - http://yerin.duckdns.org/view/CONTENT_LIST
# - 콘텐츠 작성/수정/삭제 테스트
```

---

## 롤백 가이드

### 시나리오 1: Flyway 마이그레이션 실패

```bash
# SSH 접속
ssh ubuntu@43.201.237.68

# Flyway 상태 확인
docker exec sdui-db psql -U postgres -d SDUI_LAB \
  -c "SELECT * FROM flyway_schema_history WHERE success = false;"

# 실패한 마이그레이션 복구
docker exec sdui-backend-lab ./gradlew flywayRepair

# 또는 수동으로 flyway_schema_history 수정
docker exec sdui-db psql -U postgres -d SDUI_LAB \
  -c "DELETE FROM flyway_schema_history WHERE success = false;"

# 마이그레이션 재실행
docker exec sdui-backend-lab ./gradlew flywayMigrate
```

### 시나리오 2: 애플리케이션 기동 실패

```bash
# 이전 이미지로 롤백
docker stop sdui-backend-lab
docker rm sdui-backend-lab

# 이전 태그로 컨테이너 재시작
docker run -d --name sdui-backend-lab \
  -p 8081:8080 \
  --network sdui-network \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://sdui-db:5432/SDUI_LAB \
  -e SPRING_DATASOURCE_USERNAME=postgres \
  -e SPRING_DATASOURCE_PASSWORD=YOUR_PASSWORD \
  -e SPRING_DATA_REDIS_HOST=sdui-redis \
  -e SPRING_MAIL_PASSWORD=YOUR_MAIL_PASSWORD \
  -e JWT_SECRET_KEY=YOUR_JWT_SECRET \
  {DOCKER_USERNAME}/sdui-app:previous-tag
```

### 시나리오 3: 데이터 손실 (diary → content 마이그레이션 실패)

```bash
# diary_backup에서 복원
docker exec sdui-db psql -U postgres -d SDUI_LAB <<EOF
BEGIN;

-- content 테이블 비우기
TRUNCATE content CASCADE;

-- diary_backup에서 복원
INSERT INTO content (
    content_id, content, date, del_dt, del_yn,
    content_status, content_type, email, emotion,
    frst_reg_ip, last_updt_dt, last_updt_ip,
    reg_dt, role_nm, selected_times, title,
    updt_dt, user_id, user_sqno, daily_slots,
    day_tag1, day_tag2, day_tag3, frst_dt,
    frst_rgst_usps_sqno, last_updt_usps_sqno, role_cd
)
SELECT
    diary_id, content, date, del_dt, del_yn,
    diary_status, diary_type, email, emotion,
    frst_reg_ip, last_updt_dt, last_updt_ip,
    reg_dt, role_nm, selected_times, title,
    updt_dt, user_id, user_sqno, daily_slots,
    day_tag1, day_tag2, day_tag3, frst_dt,
    frst_rgst_usps_sqno, last_updt_usps_sqno, role_cd
FROM diary_backup;

-- 시퀀스 동기화
SELECT setval('content_content_id_seq', (SELECT COALESCE(MAX(content_id), 0) + 1 FROM content), false);

COMMIT;
EOF
```

### 시나리오 4: Git 브랜치 롤백

```bash
# main 브랜치에서 이전 커밋으로 롤백
git checkout main

# 안전한 방법: revert
git revert HEAD
git push origin main

# 또는 force push (주의!)
git reset --hard {commit-hash}
git push origin main --force
```

---

## 트러블슈팅

### 문제 1: "Flyway baseline not found" 오류

**원인**: 기존 DB에 flyway_schema_history 테이블이 없음

**해결**:
```bash
./gradlew flywayBaseline
./gradlew flywayMigrate
```

### 문제 2: "Schema validation failed" 오류

**원인**: Content.java 엔티티와 DB 스키마 불일치

**해결**:
1. Content.java 엔티티 확인
2. DB 스키마 확인 (`\d content`)
3. 불일치하는 컬럼 수정 (마이그레이션 스크립트 추가)

### 문제 3: Redis 캐시에 이전 데이터 표시

**원인**: diary → content 변경 후 Redis 캐시가 남아있음

**해결**:
```bash
# Redis 캐시 전체 삭제
docker exec sdui-redis redis-cli FLUSHDB

# 또는 특정 키만 삭제
docker exec sdui-redis redis-cli DEL "USER_DIARY_LIST"
docker exec sdui-redis redis-cli DEL "SQL:GET_DIARY_LIST"
```

### 문제 4: Docker 컨테이너가 시작되지 않음

**원인**: 환경 변수 누락 또는 DB 연결 실패

**해결**:
```bash
# 로그 확인
docker logs sdui-backend-lab

# 환경 변수 확인
docker exec sdui-backend-lab env | grep SPRING

# DB 연결 테스트
docker exec sdui-db psql -U postgres -d SDUI_LAB -c "SELECT 1;"
```

---

## 배포 체크리스트

### 로컬 테스트 (Phase 1)
- [ ] `git checkout lab/claude-dev` 확인
- [ ] `docker-compose up -d` 실행
- [ ] `./gradlew flywayMigrate` 성공
- [ ] `./gradlew flywayInfo` 확인 (V1~V7 모두 Success)
- [ ] `./gradlew bootRun` 정상 기동
- [ ] API 테스트 성공 (`curl http://localhost:8080/api/content/list`)

### AWS lab/claude-dev 배포 (Phase 2)
- [ ] `git push origin lab/claude-dev` 실행
- [ ] GitHub Actions 성공
- [ ] `docker ps | grep sdui-backend-lab` 확인 (port 8081)
- [ ] `docker logs sdui-backend-lab` 확인 (에러 없음)
- [ ] Flyway 히스토리 확인 (SDUI_LAB, V1~V7)
- [ ] API 테스트 성공 (`curl http://43.201.237.68:8081/api/content/list`)

### AWS main 배포 (Phase 3)
- [ ] `git checkout main` → `git merge lab/claude-dev` 실행
- [ ] Content.java 엔티티 확인
- [ ] 마이그레이션 스크립트 재검토
- [ ] `git push origin main` 실행
- [ ] GitHub Actions 성공
- [ ] `docker ps | grep sdui-backend` 확인 (port 8080)
- [ ] `docker logs sdui-backend` 확인 (에러 없음)
- [ ] Flyway 히스토리 확인 (SDUI_TD, V1~V7)
- [ ] API 테스트 성공 (`curl http://43.201.237.68:8080/api/content/list`)
- [ ] 프론트엔드 테스트 성공 (CONTENT_LIST, CONTENT_WRITE, CONTENT_DETAIL)

---

## 참고 사항

### Flyway 명령어
```bash
# 마이그레이션 정보 확인
./gradlew flywayInfo

# 마이그레이션 실행
./gradlew flywayMigrate

# 마이그레이션 검증
./gradlew flywayValidate

# baseline 생성 (기존 DB용)
./gradlew flywayBaseline

# 실패한 마이그레이션 복구
./gradlew flywayRepair

# 모든 마이그레이션 취소 (주의!)
./gradlew flywayClean
```

### 환경별 설정

| 환경 | 브랜치 | 컨테이너명 | 포트 | DB명 |
|------|--------|-----------|------|------|
| 로컬 | lab/claude-dev | N/A | 8080 | testdb |
| AWS LAB | lab/claude-dev | sdui-backend-lab | 8081 | SDUI_LAB |
| AWS PROD | main | sdui-backend | 8080 | SDUI_TD |

### 주요 파일 경로

**마이그레이션 스크립트**:
- `SDUI-server/src/main/resources/db/migration/V*.sql`

**Flyway 설정**:
- `SDUI-server/src/main/resources/application.yml`
- `SDUI-server/src/main/resources/application-prod.yml`

**GitHub Actions**:
- `.github/workflows/deploy.yml`

**엔티티**:
- `SDUI-server/src/main/java/com/domain/demo_backend/domain/content/domain/Content.java`

---

## 예상 타임라인

| Phase | 작업 | 소요 시간 |
|-------|------|----------|
| Phase 1 | 로컬 환경 준비 및 테스트 | 30분 |
| Phase 2 | lab/claude-dev 배포 및 검증 | 20분 |
| Phase 3 | main 브랜치 병합 및 배포 | 20분 |
| **총 예상 시간** |  | **70분** |

---

## 배포 후 모니터링

### 1주일간 모니터링 항목
- [ ] 애플리케이션 로그 (docker logs)
- [ ] DB 쿼리 성능 (slow query log)
- [ ] Redis 캐시 히트율
- [ ] API 응답 시간 (프론트엔드 네트워크 탭)
- [ ] 에러 발생 빈도 (Sentry 또는 로그)

### 문제 발생 시 연락처
- **백엔드 이슈**: GitHub Issues 또는 Slack
- **DB 이슈**: DBA 팀
- **인프라 이슈**: DevOps 팀

---

## 마무리

이 가이드를 따라 Flyway 마이그레이션 시스템을 구축하고 안전하게 배포하시기 바랍니다.

궁금한 점이 있으면 이 문서의 트러블슈팅 섹션을 참고하거나, `.ai/backend_engineer/` 디렉토리의 다른 문서를 확인하세요.

**Happy Deploying! 🚀**
