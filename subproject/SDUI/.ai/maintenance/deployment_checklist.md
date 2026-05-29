# SDUI 배포 체크리스트 및 주의사항

**작성일**: 2026-03-03
**대상**: 배포 담당자
**목적**: 안전한 배포를 위한 단계별 체크리스트 및 에러 대응 방법 제공

---

## 📋 배포 전 체크리스트

### 1. 브랜치 확인

```bash
# 현재 브랜치 확인
git branch --show-current

# 예상 결과: lab/claude-dev 또는 main
```

**확인 사항**:
- [ ] 올바른 브랜치에 있는가? (lab/claude-dev → main 순서)
- [ ] 최신 커밋이 의도한 변경사항을 포함하는가?
- [ ] 커밋 메시지가 명확한가?

### 2. 코드 변경사항 검토

```bash
# 변경된 파일 목록
git status

# 마지막 커밋 이후 변경사항
git diff HEAD

# 최근 커밋 로그 확인
git log --oneline -5
```

**확인 사항**:
- [ ] 변경된 파일이 의도한 파일인가?
- [ ] `.env`, `application-secret.yml` 등 시크릿 파일이 포함되지 않았는가?
- [ ] 불필요한 디버그 코드나 console.log가 제거되었는가?

### 3. 테스트 실행

**프론트엔드** (metadata-project/):
```bash
cd metadata-project
npm run test
npm run lint
```

**백엔드** (SDUI-server/):
```bash
cd SDUI-server
./gradlew test
./gradlew build -x test  # 빌드 테스트
```

**확인 사항**:
- [ ] 모든 테스트가 통과했는가?
- [ ] 빌드 에러가 없는가?
- [ ] Lint 경고가 허용 범위 내인가?

### 4. Flyway 마이그레이션 스크립트 검증 (있는 경우)

```bash
cd SDUI-server

# Flyway 정보 확인
./gradlew flywayInfo

# 마이그레이션 스크립트 파일명 규칙 확인
ls -lh src/main/resources/db/migration/
```

**확인 사항**:
- [ ] 파일명이 `V{순차번호}__{설명}.sql` 형식인가?
- [ ] 버전 번호가 중복되지 않는가?
- [ ] SQL 문법이 올바른가? (BEGIN/COMMIT, IF NOT EXISTS 등)
- [ ] 기존 스크립트를 수정하지 않았는가? (checksum 불일치 방지)

**스크립트 검증 예시**:
```sql
-- ✅ 올바른 예시
-- 파일명: V8__add_notifications_table.sql
BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_sqno BIGINT NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;

-- ❌ 잘못된 예시
-- 파일명: v8_add_notifications.sql  (V 대문자 필요, __ 두 개 필요)
-- BEGIN/COMMIT 없음
-- IF NOT EXISTS 없음 (멱등성 보장 안 됨)
```

### 5. Docker 이미지 빌드 테스트 (선택 사항)

```bash
cd SDUI-server

# Dockerfile로 빌드 테스트
docker build -t sdui-app:test .

# 로컬에서 컨테이너 실행 테스트
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5433/testdb \
  -e SPRING_DATASOURCE_USERNAME=postgres \
  -e SPRING_DATASOURCE_PASSWORD=1234 \
  sdui-app:test
```

**확인 사항**:
- [ ] Docker 이미지가 정상적으로 빌드되는가?
- [ ] 컨테이너가 시작되는가?
- [ ] 에러 로그가 없는가?

### 6. 환경변수 시크릿 확인

GitHub → Settings → Secrets and variables → Actions

**확인 사항**:
- [ ] 모든 필수 시크릿이 설정되어 있는가?
  - AWS_HOST, AWS_USERNAME, AWS_KEY
  - DOCKER_USERNAME, DOCKER_PASSWORD
  - DB_USERNAME, DB_PASSWORD
  - JWT_SECRET_KEY, MAIL_PASSWORD
- [ ] 시크릿 값이 최신인가? (암호 변경 후 업데이트 확인)

---

## ⚙️ 배포 중 주의사항

### ❌ 절대 하지 말아야 할 것

1. **main 브랜치에 직접 푸시**
   ```bash
   # ❌ 잘못된 방법
   git checkout main
   git add .
   git commit -m "긴급 수정"
   git push origin main
   ```
   **올바른 방법**: 항상 lab/claude-dev → main 순서로 배포

2. **Flyway 스크립트 수정/삭제**
   ```bash
   # ❌ 절대 금지
   # 기존 V5__update_query_master.sql 파일 수정
   # → checksum 불일치 발생, 배포 실패
   ```
   **올바른 방법**: 새 버전 스크립트 추가 (V6, V7 등)

3. **프로덕션 DB에 직접 SQL 실행**
   ```bash
   # ❌ 절대 금지 (SDUI_TD에 직접 실행)
   docker exec sdui-db psql -U mina -d SDUI_TD -c "DROP TABLE users;"
   ```
   **올바른 방법**: Flyway 마이그레이션 스크립트 작성 후 배포

4. **실패하는 테스트 제거**
   ```bash
   # ❌ 잘못된 방법
   # 테스트가 실패해서 테스트 파일 삭제 또는 주석 처리
   ```
   **올바른 방법**: 테스트 실패 원인 파악 및 수정

5. **시크릿 하드코딩**
   ```java
   // ❌ 절대 금지
   String jwtSecret = "mySecretKey123";

   // ✅ 올바른 방법
   @Value("${jwt.secret-key}")
   private String jwtSecret;
   ```

### ⚠️ 주의 깊게 확인할 것

1. **GitHub Actions 로그에서 Flyway 검증 단계**
   - Workflow 실행 중 "Validate Flyway Migrations" 단계 확인
   - `flywayInfo` 출력에서 모든 마이그레이션이 "Success" 상태인지 확인

2. **Docker 이미지 태그가 브랜치명과 일치하는지**
   - main 브랜치 → `{DOCKER_USERNAME}/sdui-app:main`
   - lab/claude-dev 브랜치 → `{DOCKER_USERNAME}/sdui-app:lab-claude-dev`

3. **컨테이너 재시작 후 로그 확인**
   - GitHub Actions의 "Deploy to AWS" 단계에서 로그 출력 확인
   - `Started DemoBackendApplication` 메시지 확인
   - Exception, Error 키워드 검색

4. **Redis 캐시 무효화 확인**
   - GitHub Actions 마지막 단계에서 `FLUSHDB` 실행 확인
   - 배포 후 프론트엔드에서 이전 데이터가 표시되지 않는지 확인

---

## ✅ 배포 후 검증 단계

### 1. GitHub Actions 워크플로우 완료 확인

GitHub → Actions 탭 이동

**확인 사항**:
- [ ] 워크플로우 상태가 녹색 체크 표시인가?
- [ ] 모든 단계가 성공했는가?
- [ ] 배포 시간이 정상 범위인가? (5-10분)

**로그 확인 포인트**:
```
✅ Build with Gradle (clean build -x test)
✅ Validate Flyway Migrations
✅ Docker build and push
✅ Deploy to AWS
   ✅ docker pull
   ✅ docker stop/rm
   ✅ docker run
   ✅ Waiting for application to start... (30초)
   ✅ docker logs --tail 50
   ✅ Flyway migration status check
   ✅ Redis FLUSHDB
```

### 2. SSH 접속하여 컨테이너 상태 확인

```bash
# SSH 접속
ssh ubuntu@43.201.237.68

# 컨테이너 상태 확인 (lab 환경)
docker ps | grep sdui-backend-lab

# 예상 출력:
# CONTAINER ID   IMAGE                                  STATUS         PORTS
# abc123def456   username/sdui-app:lab-claude-dev       Up 2 minutes   0.0.0.0:8081->8080/tcp

# 로그 확인 (최근 100줄)
docker logs --tail 100 sdui-backend-lab

# 에러 로그만 필터링
docker logs sdui-backend-lab 2>&1 | grep -i "error\|exception"
```

**확인 사항**:
- [ ] 컨테이너가 "Up" 상태인가?
- [ ] 포트 매핑이 올바른가? (lab: 8081, prod: 8080)
- [ ] 에러 로그가 없는가?

### 3. API 엔드포인트 테스트

**EC2 내부에서 테스트** (SSH 접속 후):
```bash
# 헬스 체크
curl http://localhost:8081/api/content/list

# UI 메타데이터
curl http://localhost:8081/api/ui/CONTENT_LIST
```

**외부에서 테스트** (로컬 머신):
```bash
# API 호출
curl http://43.201.237.68:8081/api/content/list

# JSON 파싱 (jq 설치 필요)
curl -s http://43.201.237.68:8081/api/content/list | jq .
```

**확인 사항**:
- [ ] HTTP 200 응답을 받는가?
- [ ] 응답 데이터가 올바른가?
- [ ] 타임아웃이나 Connection refused 에러가 없는가?

### 4. Flyway 마이그레이션 히스토리 확인

```bash
# SSH 접속 후
docker exec sdui-db psql -U mina -d SDUI_LAB -c "
SELECT installed_rank, version, description, installed_on, success
FROM flyway_schema_history
ORDER BY installed_rank;
"
```

**확인 사항**:
- [ ] 모든 마이그레이션이 "t" (true) 상태인가?
- [ ] 최신 버전이 적용되었는가?
- [ ] installed_on 타임스탬프가 배포 시간과 일치하는가?

### 5. Redis 캐시 상태 확인

```bash
# SSH 접속 후

# Redis 연결 테스트
docker exec sdui-redis redis-cli PING
# 예상 출력: PONG

# 캐시 키 개수 확인 (배포 직후는 0 또는 매우 적어야 함)
docker exec sdui-redis redis-cli DBSIZE

# 특정 키 존재 여부 확인
docker exec sdui-redis redis-cli EXISTS "USER_CONTENT_LIST"
```

**확인 사항**:
- [ ] Redis가 정상 응답하는가?
- [ ] 배포 직후 캐시가 비워졌는가? (FLUSHDB 실행 확인)

### 6. 프론트엔드에서 기능 테스트

**Vercel 프론트엔드 접속**:
- URL: https://yerin.duckdns.org

**테스트 시나리오**:
1. **로그인 테스트**
   - [ ] 로그인 페이지 접근
   - [ ] 정상 로그인 가능
   - [ ] JWT 토큰 발급 확인 (DevTools → Application → Cookies)

2. **콘텐츠 목록 조회**
   - [ ] `/view/CONTENT_LIST` 접근
   - [ ] 데이터 렌더링 확인
   - [ ] DevTools Network 탭에서 API 호출 확인

3. **콘텐츠 작성**
   - [ ] `/view/CONTENT_WRITE` 접근
   - [ ] 새 콘텐츠 작성 및 저장
   - [ ] DB에 데이터 저장 확인

4. **UI 메타데이터 렌더링**
   - [ ] DynamicEngine이 정상 작동하는가?
   - [ ] 컴포넌트가 올바르게 렌더링되는가?

---

## 🚨 배포 실패 시 대응 방법

### 시나리오 1: Docker 이미지 빌드 실패

**증상**:
```
Error: FAILURE: Build failed with an exception.
* What went wrong:
Execution failed for task ':compileJava'.
```

**원인**:
- Java 컴파일 오류
- 의존성 해결 실패
- Gradle 설정 오류

**해결 방법**:
1. GitHub Actions 로그에서 에러 메시지 확인
2. 로컬에서 동일한 명령어 실행하여 재현:
   ```bash
   ./gradlew clean build -x test
   ```
3. 에러 수정 후 다시 커밋 및 푸시

### 시나리오 2: 컨테이너 시작 실패

**증상**:
```bash
docker ps | grep sdui-backend-lab
# 컨테이너가 목록에 없거나 "Exited" 상태
```

**원인**:
- 환경변수 누락
- DB 연결 실패
- Flyway 마이그레이션 실패

**해결 방법**:

**Step 1: 로그 확인**
```bash
docker logs sdui-backend-lab
```

**Step 2: 환경변수 확인**
```bash
docker exec sdui-backend-lab env | grep SPRING
```

**Step 3: DB 연결 테스트**
```bash
docker exec sdui-db psql -U mina -d SDUI_LAB -c "SELECT 1;"
```

**Step 4: 컨테이너 재시작**
```bash
docker restart sdui-backend-lab
docker logs -f sdui-backend-lab
```

### 시나리오 3: Flyway 마이그레이션 실패

**증상**:
```
ERROR: relation "users" does not exist
Migration V5__add_notifications.sql failed
```

**원인**:
- 스크립트 SQL 오류
- 참조하는 테이블이 존재하지 않음
- checksum 불일치

**해결 방법**:

**Option 1: flywayRepair (개발 환경만)**
```bash
# SSH 접속 후
docker exec sdui-backend-lab sh -c "cd /app && ./gradlew flywayRepair"
docker restart sdui-backend-lab
```

**Option 2: 수동으로 flyway_schema_history 수정**
```bash
docker exec sdui-db psql -U mina -d SDUI_LAB -c "
DELETE FROM flyway_schema_history WHERE success = false;
"
docker restart sdui-backend-lab
```

**Option 3: 새 마이그레이션 스크립트 작성**
```sql
-- V6__fix_previous_migration.sql
BEGIN;

-- V5에서 실패한 작업 수정
-- 예: CREATE TABLE 대신 ALTER TABLE 사용

COMMIT;
```

### 시나리오 4: Redis 연결 실패

**증상**:
```
Unable to connect to Redis
Connection refused: sdui-redis:6379
```

**원인**:
- Redis 컨테이너 미실행
- Docker 네트워크 연결 문제

**해결 방법**:
```bash
# Redis 컨테이너 상태 확인
docker ps | grep sdui-redis

# Redis 시작 (중지된 경우)
docker start sdui-redis

# 네트워크 연결 확인
docker network inspect sdui-network

# 백엔드 컨테이너 재시작
docker restart sdui-backend-lab
```

### 시나리오 5: API 응답 없음 (Connection Timeout)

**증상**:
```bash
curl http://43.201.237.68:8081/api/content/list
# ERR_CONNECTION_TIMED_OUT 또는 무응답
```

**원인**:
- AWS 보안 그룹에 포트 미개방
- 컨테이너 미실행
- 애플리케이션 기동 실패

**해결 방법**:

**Step 1: 컨테이너 상태 확인**
```bash
docker ps | grep sdui-backend-lab
```

**Step 2: EC2 내부에서 테스트**
```bash
curl http://localhost:8081/api/content/list
```

**Step 3: 포트 리스닝 확인**
```bash
sudo ss -tuln | grep 8081
```

**Step 4: AWS 보안 그룹 확인**
- AWS Console → EC2 → Security Groups
- 인바운드 규칙에 포트 8081 추가 (0.0.0.0/0)

---

## 🔄 롤백 방법

### Git 브랜치 롤백

**안전한 방법** (권장):
```bash
# main 브랜치에서 이전 커밋으로 되돌리기
git checkout main
git revert HEAD
git push origin main
```

**강제 롤백** (주의 필요):
```bash
# 특정 커밋으로 되돌리기
git reset --hard {commit-hash}
git push origin main --force
```

### Docker 이미지 롤백

**이전 이미지로 재배포**:
```bash
# SSH 접속 후

# 현재 컨테이너 중지 및 제거
docker stop sdui-backend-lab
docker rm sdui-backend-lab

# Docker Hub에서 이전 태그 확인
docker images | grep sdui-app

# 이전 이미지로 컨테이너 시작
docker run -d --name sdui-backend-lab \
  -p 8081:8080 \
  --network sdui-network \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://sdui-db:5432/SDUI_LAB \
  -e SPRING_DATASOURCE_USERNAME=mina \
  -e SPRING_DATASOURCE_PASSWORD={PASSWORD} \
  -e SPRING_DATA_REDIS_HOST=sdui-redis \
  -e SPRING_MAIL_PASSWORD={MAIL_PASSWORD} \
  -e JWT_SECRET_KEY={JWT_SECRET} \
  {DOCKER_USERNAME}/sdui-app:previous-tag
```

---

## 📊 일반적인 에러 및 해결책

| 에러 메시지 | 원인 | 해결책 |
|-----------|------|--------|
| `Connection refused` | 보안 그룹 포트 미개방 | AWS Console에서 인바운드 규칙 추가 |
| `Flyway checksum mismatch` | 기존 스크립트 수정 | 스크립트 원복 또는 flywayRepair |
| `Database does not exist` | DB 미생성 | `CREATE DATABASE` 실행 |
| `Out of memory` | Docker 메모리 부족 | 컨테이너 재시작 또는 EC2 인스턴스 업그레이드 |
| `Port already in use` | 포트 충돌 | 기존 컨테이너 중지: `docker stop sdui-backend-lab` |
| `relation does not exist` | 테이블 미생성 또는 Flyway 실패 | Flyway 히스토리 확인 및 스크립트 수정 |
| `unauthorized: authentication required` | Docker Hub 로그인 실패 | GitHub Secrets 확인 |

---

## 📝 배포 후 기록 사항

배포 완료 후 다음 정보를 기록하세요:

```markdown
## 배포 기록: YYYY-MM-DD

**브랜치**: lab/claude-dev
**커밋 해시**: abc123def456
**배포 시간**: 2026-03-03 14:30 KST
**배포자**: {사용자명}

**변경사항**:
- Flyway V8 마이그레이션 추가 (notifications 테이블)
- Content API 성능 개선
- Redis 캐시 키 변경

**검증 결과**:
- ✅ GitHub Actions 성공
- ✅ Flyway 마이그레이션 성공 (V1~V8)
- ✅ API 테스트 통과
- ✅ 프론트엔드 동작 확인

**이슈**:
- 없음

**다음 작업**:
- main 브랜치 병합 예정 (2026-03-04)
```

---

## PWA 배포 체크리스트 (2026-03-17 추가)

### 배포 전 확인
- [ ] `package.json` build 스크립트에 `--webpack` 플래그 있는가? (`next build --webpack`)
- [ ] `public/icons/icon-192x192.png`, `public/icons/icon-512x512.png` git 추적 상태인가?
- [ ] 루트 `.gitignore`에 `!metadata-project/public/icons/*.png` 예외 있는가?

### 배포 후 PWA 확인 (Vercel)
1. Chrome으로 `https://yerin.duckdns.org/view/MAIN_PAGE` 접속
2. DevTools → Application → Manifest 탭에서 에러 없는지 확인
3. 주소창 오른쪽 설치 아이콘 또는 "앱 설치" 다이얼로그 확인
4. DevTools → Application → Service Workers에서 `sw.js` Activated 상태 확인

### 알려진 PWA 경고 (수용 가능)
- **스크린샷 없음**: `public/screenshots/mobile.png`, `public/screenshots/desktop.png` 파일 추가 시 해소 (풍부한 설치 UI 활성화)
- **로컬 dev**: 서비스 워커 비활성화 상태 — 정상 (의도된 설정)

---

## 참고 자료

- **AWS 환경 가이드**: `.ai/maintenance/aws_environment_guide.md`
- **DB 변경 가이드**: `.ai/maintenance/database_change_guide.md`
- **트러블슈팅**: `.ai/maintenance/troubleshooting_guide.md`
- **GitHub Actions 워크플로우**: `.github/workflows/deploy.yml`

---

**문서 관리**:
 
- 최종 업데이트: 2026-03-17
- 다음 리뷰 예정일: 2026-04-17
