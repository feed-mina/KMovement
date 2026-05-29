# SDUI 문제 해결 가이드 (Troubleshooting)

**작성일**: 2026-03-03
**대상**: 개발자, 운영자
**목적**: 자주 발생하는 문제와 해결 방법 제공

---

## 📚 목차

1. [GitHub Actions 배포 관련 문제](#1-github-actions-배포-관련-문제)
2. [Docker 컨테이너 관련 문제](#2-docker-컨테이너-관련-문제)
3. [데이터베이스 관련 문제](#3-데이터베이스-관련-문제)
4. [Flyway 마이그레이션 관련 문제](#4-flyway-마이그레이션-관련-문제)
5. [API 응답 관련 문제](#5-api-응답-관련-문제)
6. [프론트엔드 관련 문제](#6-프론트엔드-관련-문제)
7. [Redis 캐시 관련 문제](#7-redis-캐시-관련-문제)
8. [네트워크 및 보안 관련 문제](#8-네트워크-및-보안-관련-문제)

---

## 1. GitHub Actions 배포 관련 문제

### 문제 1-1: Gradle 빌드 실패

**증상**:
```
> Task :compileJava FAILED

FAILURE: Build failed with an exception.

* What went wrong:
Execution failed for task ':compileJava'.
> Compilation failed; see the compiler error output for details.
```

**원인**:
- Java 컴파일 오류 (문법 에러, 타입 불일치 등)
- 의존성 해결 실패
- Gradle 캐시 문제

**진단 방법**:
1. GitHub Actions 로그에서 에러 메시지 확인
2. 로컬에서 동일한 빌드 실행:
   ```bash
   cd SDUI-server
   ./gradlew clean build
   ```

**해결 방법**:

**케이스 1: 컴파일 에러**
```bash
# 에러 메시지 확인
./gradlew compileJava --stacktrace

# 문제가 되는 파일 수정
# 예: NotificationController.java:25: error: cannot find symbol
```

**케이스 2: 의존성 문제**
```bash
# Gradle 캐시 삭제
./gradlew clean --refresh-dependencies

# 재빌드
./gradlew build
```

**케이스 3: 버전 충돌**
```gradle
// build.gradle에서 의존성 버전 확인
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    // 특정 버전 명시 (필요 시)
    implementation 'com.example:library:1.2.3'
}
```

---

### 문제 1-2: Docker Hub 로그인 실패

**증상**:
```
Error: unauthorized: authentication required
```

**원인**:
- GitHub Secrets의 DOCKER_USERNAME 또는 DOCKER_PASSWORD가 잘못됨
- Docker Hub 계정 문제

**해결 방법**:

**Step 1: GitHub Secrets 확인**
```
GitHub → Settings → Secrets and variables → Actions
- DOCKER_USERNAME: 올바른 Docker Hub 사용자명인지 확인
- DOCKER_PASSWORD: Docker Hub 비밀번호 또는 Access Token
```

**Step 2: Docker Hub에서 Access Token 생성**
```
1. Docker Hub 로그인 (https://hub.docker.com)
2. Account Settings → Security → New Access Token
3. Token 이름: "github-actions"
4. Token 생성 후 복사
5. GitHub Secrets의 DOCKER_PASSWORD에 붙여넣기
```

---

### 문제 1-3: SSH 연결 실패

**증상**:
```
Error: ssh: connect to host 43.201.237.68 port 22: Connection timed out
```

**원인**:
- EC2 인스턴스 중지됨
- AWS 보안 그룹에 SSH(22) 포트 미개방
- SSH 키가 잘못됨

**해결 방법**:

**Step 1: EC2 인스턴스 상태 확인**
```
AWS Console → EC2 → Instances
- 인스턴스 상태: "running"인지 확인
- Public IP: 43.201.237.68 맞는지 확인
```

**Step 2: 보안 그룹 확인**
```
EC2 → Security Groups → Inbound rules
- Type: SSH, Port: 22, Source: 0.0.0.0/0 (또는 GitHub Actions IP)
```

**Step 3: SSH 키 확인**
```bash
# 로컬에서 SSH 테스트
ssh -i ~/.ssh/your-key.pem ubuntu@43.201.237.68

# GitHub Secrets의 AWS_KEY 확인
# 키 내용이 완전한지 (BEGIN ~ END 포함)
```

---

### 문제 1-4: Flyway 검증 단계 실패

**증상**:
```
> Task :flywayInfo FAILED

ERROR: Flyway validation failed
Migration checksum mismatch for version 5
```

**원인**:
- 기존 마이그레이션 스크립트가 수정됨

**해결 방법**:

**Option 1: 스크립트 원복**
```bash
# Git에서 원본 파일 복원
git checkout HEAD~1 -- SDUI-server/src/main/resources/db/migration/V5__*.sql

# 변경사항은 새 버전으로 작성
# V11__update_v5_changes.sql
```

**Option 2: GitHub Actions에서 검증 건너뛰기** (임시 조치)
```yaml
# deploy.yml 수정 (주의!)
- name: Validate Flyway Migrations
  run: ./gradlew flywayInfo || echo "Flyway check skipped"
  continue-on-error: true  # 이미 설정되어 있음
```

---

## 2. Docker 컨테이너 관련 문제

### 문제 2-1: 컨테이너가 시작되지 않음

**증상**:
```bash
docker ps | grep sdui-backend-lab
# 결과 없음 또는 "Exited" 상태
```

**원인**:
- 애플리케이션 기동 실패
- 환경변수 누락
- DB 연결 실패

**진단 방법**:
```bash
# SSH 접속 후
docker logs sdui-backend-lab

# 로그 끝부분 확인
docker logs --tail 50 sdui-backend-lab

# 에러 로그만 필터링
docker logs sdui-backend-lab 2>&1 | grep -i "error\|exception\|failed"
```

**해결 방법**:

**케이스 1: 환경변수 누락**
```bash
# 환경변수 확인
docker exec sdui-backend-lab env | grep SPRING

# 예상 출력:
# SPRING_PROFILES_ACTIVE=prod
# SPRING_DATASOURCE_URL=jdbc:postgresql://sdui-db:5432/SDUI_LAB
# SPRING_DATASOURCE_USERNAME=mina
# SPRING_DATASOURCE_PASSWORD=****

# 누락된 경우: GitHub Actions 재실행 또는 수동 컨테이너 재시작
docker stop sdui-backend-lab
docker rm sdui-backend-lab

# docker run 명령어로 재시작 (deploy.yml 참조)
```

**케이스 2: DB 연결 실패**
```bash
# DB 컨테이너 상태 확인
docker ps | grep sdui-db

# DB 연결 테스트
docker exec sdui-db psql -U mina -d SDUI_LAB -c "SELECT 1;"

# DB가 없는 경우: 생성
docker exec -it sdui-db psql -U mina -d postgres -c "CREATE DATABASE \"SDUI_LAB\";"
```

**케이스 3: 포트 충돌**
```bash
# 포트 사용 확인
sudo ss -tuln | grep 8081

# 다른 프로세스가 사용 중인 경우: 중지
docker ps | grep 8081
docker stop {충돌하는 컨테이너}
```

---

### 문제 2-2: 컨테이너 메모리 부족

**증상**:
```
java.lang.OutOfMemoryError: Java heap space
```

**원인**:
- JVM 힙 메모리 설정이 부족
- EC2 인스턴스 메모리 부족

**진단 방법**:
```bash
# 컨테이너 리소스 사용량 확인
docker stats --no-stream | grep sdui

# EC2 메모리 확인
free -h
```

**해결 방법**:

**Option 1: JVM 힙 메모리 증가**
```bash
# docker run 시 환경변수 추가
docker run -d --name sdui-backend-lab \
  -e JAVA_OPTS="-Xmx1024m -Xms512m" \
  ...
```

**Option 2: EC2 인스턴스 업그레이드**
```
AWS Console → EC2 → Instances
- Instance Type 변경 (예: t3.small → t3.medium)
```

---

### 문제 2-3: 컨테이너 로그가 너무 큼

**증상**:
```bash
docker logs sdui-backend-lab
# 수백 MB의 로그 출력
```

**원인**:
- 로그 로테이션 미설정
- 디버그 로그가 너무 많이 출력됨

**해결 방법**:

**Option 1: 로그 제한 설정**
```bash
# docker run 시 로그 드라이버 옵션 추가
docker run -d --name sdui-backend-lab \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  ...
```

**Option 2: 로그 레벨 조정**
```yaml
# application-prod.yml
logging:
  level:
    root: INFO
    com.domain.demo_backend: INFO  # DEBUG → INFO로 변경
```

---

### 문제 2-4: EC2 디스크 공간 부족 (no space left on device)

**증상**:
```
failed to register layer: write /app/app.jar: no space left on device
Process exited with status 1
Error: Process completed with exit code 1.
```
GitHub Actions 배포 시 Docker 이미지 pull 단계에서 발생.

**실제 발생 사례 (2026-03-07)**:
- `fix: css/ssr hydration 불일치 해결` 커밋 배포 후 발생
- `docker system prune -af` 실행 → 752.7MB 확보 → 재배포 성공

**원인**:
- 누적된 Docker 이미지 레이어, dangling 이미지, 빌드 캐시가 디스크를 점유

**1단계: 디스크 현황 확인**
```bash
df -h
# /dev/root    (또는 /dev/xvda1) 의 Use% 확인 → 90%+ 이면 위험
```

**2단계: DB 볼륨 타입 확인 (정리 전 필수)**
```bash
# 볼륨 목록 확인
docker volume ls

# DB 컨테이너 마운트 정보 확인
docker inspect sdui-db | grep -A 10 "Mounts"
```

**⚠️ EC2 sdui-db 볼륨 정보 (2026-03-07 확인)**:
```
"Type": "volume",
"Name": "fa61ab46cac2510a942d758f53837d8c8851f145e6e4cd29f049a86ce87363fa",
"Destination": "/var/lib/postgresql/data"
```
DB가 **익명 볼륨(Anonymous Volume, 해시 이름)** 을 사용 중.
→ 이름이 없기 때문에 `docker volume prune` 시 삭제될 위험이 있음.

**3단계: 안전한 공간 확보 (볼륨 제외)**
```bash
# 이미지/컨테이너/네트워크/빌드 캐시만 정리 (볼륨 제외 = 기본값)
docker system prune -af
```
`--volumes` 플래그를 붙이지 않으면 볼륨은 삭제되지 않음 → **DB 데이터 안전**.

**절대 실행 금지**:
```bash
# ❌ DB 익명 볼륨이 삭제될 수 있음
docker system prune -af --volumes
docker volume prune
```

**4단계: 정리 후 확인 및 재배포**
```bash
df -h  # 공간 확보 확인
# GitHub Actions → Re-run failed jobs
```

**근본적 해결 (디스크 계속 부족한 경우)**:
- AWS Console → EC2 → EBS 볼륨 수정으로 용량 증설
- 또는 Docker 로그 용량 제한 설정 (문제 2-3 참조)
- **권장**: 현재 DB 볼륨은 익명 볼륨(해시값)입니다. 향후 `docker-compose.yml`에서 Named Volume으로 전환하면 `docker volume prune` 실수로부터 데이터를 보호하고 관리가 용이해집니다. (단, 이 작업은 기존 데이터를 새 볼륨으로 옮기는 마이그레이션 과정이 필요합니다.)

---

## 3. 데이터베이스 관련 문제

### 문제 3-1: 데이터베이스가 존재하지 않음

**증상**:
```
ERROR: database "SDUI_LAB" does not exist
```

**원인**:
- 데이터베이스가 생성되지 않음

**해결 방법**:
```bash
# SSH 접속 후
docker exec -it sdui-db psql -U mina -d postgres

# 데이터베이스 생성
CREATE DATABASE "SDUI_LAB";

# 권한 부여
GRANT ALL PRIVILEGES ON DATABASE "SDUI_LAB" TO mina;

# 확인
\l

# 종료
\q

# 컨테이너 재시작
docker restart sdui-backend-lab
```

---

### 문제 3-2: 테이블이 존재하지 않음

**증상**:
```
ERROR: relation "users" does not exist
```

**원인**:
- Flyway 마이그레이션이 실행되지 않음
- 빈 데이터베이스에 테이블이 없음

**진단 방법**:
```bash
# Flyway 히스토리 확인
docker exec sdui-db psql -U mina -d SDUI_LAB -c "
SELECT * FROM flyway_schema_history ORDER BY installed_rank;
"

# 테이블 목록 확인
docker exec sdui-db psql -U mina -d SDUI_LAB -c "\dt"
```

**해결 방법**:

**Option 1: Flyway 마이그레이션 재실행**
```bash
# 컨테이너 재시작 (Flyway 자동 실행)
docker restart sdui-backend-lab
docker logs -f sdui-backend-lab
```

**Option 2: 스키마 복사** (SDUI_LAB가 완전히 빈 경우)
```bash
# SDUI_TD의 스키마를 SDUI_LAB로 복사
docker exec sdui-db pg_dump -U mina -d SDUI_TD --schema-only | \
docker exec -i sdui-db psql -U mina -d SDUI_LAB

# 컨테이너 재시작
docker restart sdui-backend-lab
```

---

### 문제 3-3: Foreign Key 제약 위반

**증상**:
```
ERROR: insert or update on table "content" violates foreign key constraint "fk_content_user"
Detail: Key (user_sqno)=(999) is not present in table "users".
```

**원인**:
- 참조하는 레코드가 존재하지 않음

**해결 방법**:

**Option 1: 참조 데이터 먼저 삽입**
```sql
-- users 테이블에 먼저 데이터 삽입
INSERT INTO users (user_sqno, email, password, role_cd)
VALUES (999, 'test@example.com', 'password', 'USER');

-- 그 다음 content 삽입
INSERT INTO content (user_sqno, title, content)
VALUES (999, '제목', '내용');
```

**Option 2: Foreign Key 임시 비활성화** (개발 환경만)
```sql
-- Foreign Key 비활성화 (주의!)
ALTER TABLE content DISABLE TRIGGER ALL;

-- 데이터 삽입
INSERT INTO content (...) VALUES (...);

-- Foreign Key 재활성화
ALTER TABLE content ENABLE TRIGGER ALL;
```

---

### 문제 3-4: 데이터베이스 연결 풀 고갈

**증상**:
```
HikariPool-1 - Connection is not available, request timed out after 30000ms.
```

**원인**:
- DB 연결이 닫히지 않고 누적됨
- 연결 풀 크기가 부족함

**진단 방법**:
```bash
# 활성 연결 수 확인
docker exec sdui-db psql -U mina -d SDUI_LAB -c "
SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'SDUI_LAB';
"
```

**해결 방법**:

**Option 1: 연결 풀 설정 조정**
```yaml
# application-prod.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20  # 기본값 10 → 20으로 증가
      minimum-idle: 5
      connection-timeout: 30000
```

**Option 2: 유휴 연결 종료**
```sql
-- 유휴 연결 확인
SELECT pid, usename, application_name, state, state_change
FROM pg_stat_activity
WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';

-- 유휴 연결 종료
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';
```

---

## 4. Flyway 마이그레이션 관련 문제

### 문제 4-1: Flyway checksum mismatch

**증상**:
```
Migration checksum mismatch for migration version 5
Expected: 123456789
Actual:   987654321
```

**원인**:
- 기존 마이그레이션 스크립트를 수정함

**해결 방법**:

**Option 1: flywayRepair** (개발 환경만)
```bash
# 로컬
cd SDUI-server
./gradlew flywayRepair
./gradlew flywayMigrate

# AWS (SSH 접속 후)
docker exec sdui-backend-lab sh -c "cd /app && ./gradlew flywayRepair"
docker restart sdui-backend-lab
```

**Option 2: 스크립트 원복**
```bash
git checkout HEAD~1 -- SDUI-server/src/main/resources/db/migration/V5__*.sql
git commit -m "fix: Revert V5 migration script to original"
```

---

### 문제 4-2: Flyway 마이그레이션 실패 (SQL 오류)

**증상**:
```
Migration V8__add_notifications_table.sql failed
ERROR: syntax error at or near "CRETE"
```

**원인**:
- SQL 문법 오류

**해결 방법**:

**Step 1: 실패한 마이그레이션 확인**
```bash
docker exec sdui-db psql -U mina -d SDUI_LAB -c "
SELECT * FROM flyway_schema_history WHERE success = false;
"
```

**Step 2: flyway_schema_history에서 실패 기록 삭제**
```bash
docker exec sdui-db psql -U mina -d SDUI_LAB -c "
DELETE FROM flyway_schema_history WHERE version = '8' AND success = false;
"
```

**Step 3: 스크립트 수정**
```sql
-- V8__add_notifications_table.sql 수정
-- CRETE → CREATE
```

**Step 4: 재배포**
```bash
git add SDUI-server/src/main/resources/db/migration/V8__*.sql
git commit -m "fix: Correct SQL syntax in V8 migration"
git push origin lab/claude-dev
```

---

### 문제 4-3: Flyway baseline 설정 필요

**증상**:
```
Found non-empty schema(s) "public" but no schema history table.
Use baseline() or set baselineOnMigrate to true to initialize the schema history table.
```

**원인**:
- 기존 DB에 Flyway를 처음 적용함

**해결 방법**:
```bash
# 로컬
./gradlew flywayBaseline
./gradlew flywayMigrate

# 또는 application.yml에 설정 (이미 설정되어 있음)
# spring.flyway.baseline-on-migrate: true
```

---

## 5. API 응답 관련 문제

### 문제 5-1: Connection Timeout (ERR_CONNECTION_TIMED_OUT)

**증상**:
```bash
curl http://43.201.237.68:8081/api/content/list
# curl: (28) Connection timed out
```

**원인**:
1. AWS 보안 그룹에 포트 미개방
2. 컨테이너 미실행
3. 애플리케이션 기동 실패

**진단 방법**:

**Step 1: 컨테이너 상태 확인**
```bash
docker ps | grep sdui-backend-lab
```

**Step 2: EC2 내부에서 테스트**
```bash
# SSH 접속 후
curl http://localhost:8081/api/content/list
```

**Step 3: 포트 리스닝 확인**
```bash
sudo ss -tuln | grep 8081
```

**해결 방법**:

**케이스 1: 보안 그룹 포트 미개방**
```
AWS Console → EC2 → Security Groups
- Inbound rules 추가:
  - Type: Custom TCP
  - Port: 8081
  - Source: 0.0.0.0/0
```

**케이스 2: 컨테이너 미실행**
```bash
docker start sdui-backend-lab
docker logs -f sdui-backend-lab
```

**케이스 3: 애플리케이션 실패**
```bash
# 로그 확인
docker logs sdui-backend-lab

# 컨테이너 재시작
docker restart sdui-backend-lab
```

---

### 문제 5-2: 502 Bad Gateway

**증상**:
```
HTTP 502 Bad Gateway
```

**원인**:
- 백엔드 서버가 응답하지 않음
- Nginx/리버스 프록시 설정 문제

**해결 방법**:

**Step 1: 백엔드 상태 확인**
```bash
# 컨테이너 상태
docker ps | grep sdui-backend

# 로그 확인
docker logs --tail 100 sdui-backend
```

**Step 2: 직접 API 호출**
```bash
# EC2 내부에서
curl http://localhost:8080/api/content/list

# 응답 있으면 리버스 프록시 문제, 없으면 백엔드 문제
```

---

### 문제 5-3: 403 Forbidden

**증상**:
```json
{
  "status": 403,
  "error": "Forbidden",
  "message": "Access Denied"
}
```

**원인**:
- JWT 토큰 누락 또는 만료
- CORS 설정 문제
- Spring Security 권한 부족

**해결 방법**:

**케이스 1: JWT 토큰 문제**
```bash
# 로그인하여 새 토큰 발급
curl -X POST http://43.201.237.68:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 응답에서 토큰 추출 후 요청에 포함
curl http://43.201.237.68:8081/api/content/list \
  -H "Authorization: Bearer eyJhbGci..."
```

**케이스 2: CORS 문제**
```java
// WebConfig.java 확인
@Override
public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**")
            .allowedOrigins("http://localhost:3000", "https://yerin.duckdns.org")
            .allowedMethods("GET", "POST", "PUT", "DELETE")
            .allowCredentials(true);
}
```

---

### 문제 5-4: 500 Internal Server Error

**증상**:
```json
{
  "status": 500,
  "error": "Internal Server Error"
}
```

**원인**:
- 서버 내부 오류 (NullPointerException, SQL 오류 등)

**진단 방법**:
```bash
# 로그 확인 (에러 스택 추적)
docker logs sdui-backend-lab 2>&1 | grep -A 20 "Exception"

# 최근 에러만 확인
docker logs --since 5m sdui-backend-lab | grep -i error
```

**해결 방법**:
- 로그에서 스택 추적 확인
- 문제가 되는 코드 수정
- 재배포

---

## 6. 프론트엔드 관련 문제

### 문제 6-1: 화면이 렌더링되지 않음

**증상**:
- 브라우저에서 빈 화면 또는 로딩 무한 반복

**원인**:
1. API 호출 실패
2. 메타데이터 누락
3. DynamicEngine 오류

**진단 방법**:

**Step 1: 브라우저 콘솔 확인**
```
F12 → Console 탭
- 에러 메시지 확인
- API 호출 실패 여부
```

**Step 2: Network 탭 확인**
```
F12 → Network 탭
- /api/ui/{screenId} 호출 확인
- 응답 상태 코드 (200, 404, 500 등)
- 응답 데이터 확인
```

**해결 방법**:

**케이스 1: API 호출 실패**
```typescript
// MetadataProvider.tsx에서 에러 처리 확인
const { data, isLoading, error } = useQuery({
  queryKey: ['metadata', screenId],
  queryFn: () => fetchMetadata(screenId),
});

if (error) {
  console.error('Metadata fetch failed:', error);
}
```

**케이스 2: 메타데이터 누락**
```bash
# SSH 접속 후
docker exec sdui-db psql -U mina -d SDUI_LAB -c "
SELECT COUNT(*) FROM ui_metadata WHERE screen_id = 'CONTENT_LIST';
"

# 0이면 메타데이터 추가 필요
```

---

### 문제 6-2: 이미지가 표시되지 않음 (Vercel)

**증상**:
- Vercel에서 이미지가 깨지거나 표시되지 않음
- 로컬에서는 정상 작동

**원인**:
1. CSP (Content Security Policy) 제약
2. 이미지 경로 오류
3. 빌드 시 이미지 미포함

**진단 방법**:

**Step 1: 브라우저 콘솔 확인**
```
F12 → Console
- CSP 에러 메시지 확인:
  "Refused to load the image ... because it violates the following Content Security Policy directive: 'img-src ...'"
```

**Step 2: Network 탭 확인**
```
F12 → Network → Img 필터
- 이미지 요청 상태: 404, 403 등
- 요청 URL 확인
```

**해결 방법**:

**케이스 1: CSP 설정 문제**
```typescript
// next.config.ts 확인
{
  key: 'Content-Security-Policy',
  value: [
    "img-src 'self' data: blob: https:",  // ✅ 외부 이미지 허용
    // ...
  ].join('; '),
}
```

**케이스 2: 이미지 경로 오류**
```typescript
// ❌ 잘못된 경로
<img src="./img/logo.svg" />
<img src="/public/img/logo.svg" />

// ✅ 올바른 경로 (public 폴더 기준)
<img src="/img/logo.svg" alt="Logo" />

// ✅ Next.js Image 컴포넌트 사용 (권장)
import Image from 'next/image';

<Image
  src="/img/logo.svg"
  alt="Logo"
  width={200}
  height={50}
/>
```

**케이스 3: 빌드 시 이미지 미포함**
```bash
# Vercel 빌드 로그 확인
# public/img/ 폴더가 포함되었는지 확인

# .gitignore에서 이미지 폴더 제외 확인
# ❌ /public/img/  (이미지가 커밋되지 않음)
# ✅ (이미지 폴더는 .gitignore에 없어야 함)
```

---

### 문제 6-3: DynamicEngine 컴포넌트 렌더링 실패

**증상**:
```
Error: Component type "CUSTOM_BUTTON" not found in componentMap
```

**원인**:
- componentMap에 컴포넌트 타입이 등록되지 않음

**해결 방법**:
```typescript
// components/constants/componentMap.tsx
import CustomButton from '@/components/fields/CustomButton';

export const componentMap: ComponentMap = {
  // ... 기존 매핑
  CUSTOM_BUTTON: CustomButton,  // 추가
};
```

---

## 7. Redis 캐시 관련 문제

### 문제 7-1: 이전 데이터가 계속 표시됨

**증상**:
- DB를 업데이트했는데 프론트엔드에서 이전 데이터가 표시됨

**원인**:
- Redis 캐시에 이전 데이터가 남아있음

**해결 방법**:

**Option 1: 전체 캐시 삭제**
```bash
# SSH 접속 후
docker exec sdui-redis redis-cli FLUSHDB

# 확인
docker exec sdui-redis redis-cli DBSIZE
# (integer) 0
```

**Option 2: 특정 키만 삭제**
```bash
# 캐시 키 목록 확인
docker exec sdui-redis redis-cli KEYS "*"

# 특정 키 삭제
docker exec sdui-redis redis-cli DEL "USER_CONTENT_LIST"
docker exec sdui-redis redis-cli DEL "SQL:GET_CONTENT_LIST"
```

---

### 문제 7-2: Redis 연결 실패

**증상**:
```
Unable to connect to Redis at sdui-redis:6379
Connection refused
```

**원인**:
- Redis 컨테이너 미실행
- Docker 네트워크 문제

**해결 방법**:

**Step 1: Redis 컨테이너 상태 확인**
```bash
docker ps | grep sdui-redis
```

**Step 2: Redis 시작**
```bash
docker start sdui-redis

# 연결 테스트
docker exec sdui-redis redis-cli PING
# PONG
```

**Step 3: 네트워크 연결 확인**
```bash
# sdui-network에 Redis가 연결되어 있는지 확인
docker network inspect sdui-network | grep -A 10 sdui-redis
```

---

## 8. 네트워크 및 보안 관련 문제

### 문제 8-1: CORS 에러

**증상**:
```
Access to fetch at 'http://43.201.237.68:8081/api/content/list'
from origin 'https://yerin.duckdns.org' has been blocked by CORS policy
```

**원인**:
- 백엔드에서 CORS 설정이 누락됨

**해결 방법**:
```java
// WebConfig.java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(
                    "http://localhost:3000",
                    "https://yerin.duckdns.org"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
```

---

### 문제 8-2: CSP 위반 (Content Security Policy)

**증상**:
```
Refused to execute inline script because it violates the following
Content Security Policy directive: "script-src 'self'"
```

**원인**:
- next.config.ts의 CSP 설정이 너무 엄격함

**해결 방법**:
```typescript
// next.config.ts
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://t1.daumcdn.net https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' http://localhost:8080 http://43.201.237.68:8081 https://vercel.live wss://ws-us3.pusher.com",
    "font-src 'self' data:",
    "frame-src http://postcode.map.daum.net https://postcode.map.daum.net",
  ].join('; '),
}
```

---

### 문제 8-3: JWT 토큰 만료

**증상**:
```json
{
  "status": 401,
  "error": "Unauthorized",
  "message": "JWT token is expired"
}
```

**원인**:
- JWT 토큰이 만료됨 (기본 1시간)

**해결 방법**:

**Option 1: 재로그인**
```bash
curl -X POST http://43.201.237.68:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Option 2: Refresh Token 사용** (구현된 경우)
```bash
curl -X POST http://43.201.237.68:8081/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"your_refresh_token"}'
```

---

## 📋 빠른 참조: 에러 코드별 해결 방법

| HTTP 상태 | 의미 | 일반적인 원인 | 해결 방법 |
|-----------|------|--------------|----------|
| 400 | Bad Request | 잘못된 요청 데이터 | 요청 파라미터 확인 |
| 401 | Unauthorized | 인증 실패 | JWT 토큰 재발급 |
| 403 | Forbidden | 권한 부족 | 사용자 권한 확인, CORS 설정 |
| 404 | Not Found | 리소스 없음 | URL 경로 확인, 데이터 존재 여부 |
| 500 | Internal Server Error | 서버 내부 오류 | 백엔드 로그 확인 |
| 502 | Bad Gateway | 백엔드 응답 없음 | 컨테이너 상태 확인 |
| 503 | Service Unavailable | 서비스 불가 | DB/Redis 연결 확인 |

---

## 📞 추가 도움이 필요한 경우

### 로그 수집 방법

**전체 진단 정보 수집**:
```bash
#!/bin/bash
# diagnostic.sh - SDUI 진단 스크립트

echo "=== Docker 컨테이너 상태 ===" > diagnostic_report.txt
docker ps -a | grep sdui >> diagnostic_report.txt

echo "\n=== 컨테이너 로그 (sdui-backend-lab) ===" >> diagnostic_report.txt
docker logs --tail 100 sdui-backend-lab >> diagnostic_report.txt

echo "\n=== Flyway 히스토리 ===" >> diagnostic_report.txt
docker exec sdui-db psql -U mina -d SDUI_LAB -c "SELECT * FROM flyway_schema_history;" >> diagnostic_report.txt

echo "\n=== Redis 상태 ===" >> diagnostic_report.txt
docker exec sdui-redis redis-cli INFO >> diagnostic_report.txt

echo "\n=== 디스크 사용량 ===" >> diagnostic_report.txt
df -h >> diagnostic_report.txt

echo "\n=== 메모리 사용량 ===" >> diagnostic_report.txt
free -h >> diagnostic_report.txt

echo "진단 완료: diagnostic_report.txt"
```

---

## 참고 자료

- **AWS 환경 가이드**: `.ai/maintenance/aws_environment_guide.md`
- **배포 체크리스트**: `.ai/maintenance/deployment_checklist.md`
- **DB 변경 가이드**: `.ai/maintenance/database_change_guide.md`
- **Flyway 공식 문서**: https://flywaydb.org/documentation
- **Spring Boot 트러블슈팅**: https://docs.spring.io/spring-boot/docs/current/reference/html/

---

**문서 관리**:
 
- 최종 업데이트: 2026-03-03
- 다음 리뷰 예정일: 2026-04-03
