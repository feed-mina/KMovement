# KMovement 배포 비용 최적화 운영 계약

> 추적 이슈: [#177 중복 배포 폐기 및 운영비 최적화](https://github.com/feed-mina/KMovement/issues/177)
>
> 기준일: 2026-07-23. 저장소 설정은 외부 클라우드의 실제 실행·과금 상태를
> 증명하지 않는다. 아래 외부 확인 게이트를 통과한 자원만 중지하거나 삭제한다.

## 1. 배포 source of truth

KMovement 서버 배포의 canonical 경로는 `main`의
`.github/workflows/deploy-ec2.yml`이다. 이 경로가 Spring Boot,
metadata-project Next.js, FastAPI, Celery worker/beat을 같은 EC2 운영
경계에 배포한다.

| 대상 | 역할 | 저장소 기준 |
|---|---|---|
| EC2 | 서버/API/worker canonical 운영 경로 | `deploy-ec2.yml`, `main`만 자동 배포 |
| Vercel | 현재 사용 중인 웹 Production 보조 경로 | `subproject/SDUI/kride/vercel.json`, Git 자동 배포는 `main`만 |
| RunPod | Media/Tora GPU 작업 | 두 전용 이미지 workflow, endpoint 사용량은 외부 확인 |
| Expo EAS | Android binary와 JS-only OTA | 동일 빌드 중복 금지, native 변경만 Build |

Vercel Production, EAS project, RunPod endpoint, EC2의 active
container/image/volume은 사용 증거 없이 삭제하지 않는다. 워크플로를
삭제했다는 사실만으로 외부 자원 또는 과금이 중단됐다고 판단하지 않는다.

## 2. 저장소에서 폐기하는 중복 워크플로

다음 레거시 워크플로는 EC2 canonical 경로와 중복되거나 이름과 실제 동작이
달라 폐기한다:

- `.github/workflows/deploy-cloud-run.yml`
- `.github/workflows/deploy-gcp.yml`
- `.github/workflows/ec2-fix-frontend.yml`
- `.github/workflows/ec2-fix-ssl.yml`
- `.github/workflows/ec2-diagnose.yml`
- `.github/workflows/ec2-apply-migration.yml`

유지하는 자동 경로는 `main`만 트리거한다. `ci.yml`과 `deploy-ec2.yml`에서
존재하지 않는 `refactor/krider_backup` 트리거를 복구하지 않는다. RunPod
이미지 workflow는 동시 실행을 취소하고 Docker Hub `latest` inline cache를
재사용한다. EC2 상태 확인은 변경 명령이 없는 수동 `ec2-audit.yml`로만
수행하며, 실제 배포 컨테이너에는 Docker JSON 로그 회전을 적용한다.

## 3. 외부 공급자 확인 게이트

### GCP

2026-07-23에 `quartz-kiba` 콘솔을 직접 확인한 현재 증거는 다음과 같다.

- 2026-07-01~2026-07-22 예상 요금: **₩0.00**
- Compute Engine VM: **0개**
- Compute Engine disk: **0개**
- Cloud Run `kmovement`: **사용 가능**, 최근 7일 instance-count 차트에 값 표시

따라서 현재 삭제·정지할 GCP VM/disk 고정비 자원은 없다. 존재하지 않는 VM의
snapshot/stop 절차를 실행하지 않는다. Cloud Run은 현재 무비용으로 보이지만
라이브 상태와 최근 instance 지표가 있으므로 **유지**하며, 30일 request와
traffic source를 확인하기 전에는 삭제하지 않는다.

권한이 있는 정확한 계정·project·region에서 다음 증거를 남기기 전에는 VM,
Cloud Run, disk, 고정 IP, Artifact Registry를 삭제하지 않는다.

1. VM/disk 수와 청구 범위를 다시 확인해 현재 `0개`/`₩0.00` 상태가
   유지되는지 확인한다. VM이 새로 발견된 경우에만 machine type, disk,
   고정 IP, 최근 30일 CPU/network 및 청구액을 조사한다.
2. Cloud Run `kmovement`의 최근 30일 request, billable instance time,
   traffic split과 현재 URL 참조를 확인한다.
3. EC2 환경, GitHub 변수/시크릿, 모바일·웹 bundle에 해당 URL 참조가 없음을
   확인한다.
4. 향후 VM이 발견되면 `snapshot → stop → 7일 관찰 → delete` 순서를
   지킨다.
5. Cloud Run은 트래픽과 참조가 없다는 증거 후 삭제하고, 보존할 image
   digest를 확정한 뒤에만 Artifact Registry를 정리한다.

OCR/Firebase처럼 EC2에서 계속 쓰는 GCP credential과 레거시 배포
credential을 이름만 보고 함께 삭제하지 않는다.

### RunPod

정확한 Media/Tora endpoint ID마다 worker type(Flex/Active), min/max worker,
idle timeout, network volume, 최근 30일 job·GPU 사용량·청구액을 확인한다.
간헐 사용 endpoint는 우선 Active/min worker를 `0`으로 만들고 관찰한다.
최근 job 또는 volume 소비자를 확인하지 않은 endpoint와 network volume은
삭제하지 않는다.

이미지 workflow 성공은 endpoint가 새 image를 사용 중이라는 증거가 아니다.
endpoint의 실제 image tag/digest와 마지막 성공 job을 별도로 기록한다.

### Vercel

Vercel dashboard에서 연결 repository, project root, Production Branch가
예상과 일치하는지 확인한다. `git.deploymentEnabled`는 Git 자동 배포만
제어하므로 Deploy Hook, CLI 배포, 재배포 이력도 별도로 확인한다.

- Production Branch는 `main`이어야 한다.
- Ignored Build Step은 선택된 K-Ride Root Directory에서 실행되므로
  `git diff HEAD^ HEAD --quiet -- .`로 현재 앱 전체의 변경을 판정한다.
- 최근 Production/Preview 수와 사용량을 변경 전후로 기록한다.
- `main=true`, `"*=false"`가 적용된 다음 non-main push가 새 Preview를
  만들지 않는지 확인한다.
- public domain이 현재 Production deployment를 가리키는지 확인한다.
- 사용 중인 Vercel project와 Production deployment는 삭제하지 않는다.

### Expo EAS

빌드 전 [모바일 배포 runbook](../subproject/SDUI/kride/apps/mobile/DEPLOYMENT.md)의
동일 SHA/runtimeVersion/versionCode 조회와 한 작업자 원칙을 적용한다.

- `eas whoami`, `eas project:info`로 account/project를 확인한다.
- `eas build:list`에서 동일 식별자의 queued/in-progress/finished build를
  확인하고 기존 build를 기다리거나 재사용한다.
- `eas channel:view preview`와 Update 목록으로 runtime/channel을 확인한다.
- JS-only 변경은 검증된 같은 runtime에 preview OTA로 보낸다.
- native module/config/SDK/runtime 변경만 새 binary를 만든다.
- EAS project 또는 credential 삭제는 production/preview 소비자를 모두
  확인한 별도 변경으로만 수행한다.

## 4. 변경 순서와 증거

1. 공급자, account/project/region, resource ID를 확정한다.
2. 최근 30일 사용량·청구액과 현재 소비 위치를 저장한다.
3. 되돌릴 snapshot, image digest, build/update ID, Git SHA를 기록한다.
4. 저장소의 중복 자동 경로부터 제거하고 canonical 경로를 검증한다.
5. 외부 자원은 `disable/stop → 관찰 → delete` 순서로 별도 수행한다.
6. 변경 후 같은 기간 또는 provider usage 지표를 비교해 절감 여부를
   [#177](https://github.com/feed-mina/KMovement/issues/177)에 기록한다.

증거에는 시크릿 값, access token, credential JSON을 넣지 않는다. 시크릿은
이름과 소비 위치만 기록한다.

## 5. 롤백

- **저장소:** 문제를 만든 변경을 revert하고 `main` CI 후 canonical
  `deploy-ec2.yml`만 실행한다. 폐기한 mutation workflow를 임시로 되살려
  우회 배포하지 않는다.
- **EC2:** 직전 검증 image tag/digest로 순차 복구하고 DB/Redis volume을
  보존한다. 공간 확보를 이유로 active image나 volume을 삭제하지 않는다.
- **GCP:** 7일 관찰 중 문제가 생기면 stopped VM을 재시작한다. 삭제 후에는
  기록한 snapshot, disk, IP 정보를 사용해 복구한다.
- **RunPod:** 이전 image digest와 worker/min-worker 설정을 복원하고 test
  job을 통과시킨다. volume 삭제 후 복구 가능하다고 가정하지 않는다.
- **Vercel:** `git.deploymentEnabled`를 되돌리거나 dashboard에서 직전
  known-good Production deployment로 rollback한 뒤 public domain을 확인한다.
- **EAS:** 중복 binary를 새로 만들지 말고 known-good build를 재사용한다.
  잘못된 OTA는 update group rollback/republish를 preview에서 먼저 검증한다.

## 6. 완료 조건

- 저장소 문서와 workflow가 EC2 canonical source of truth에 합의한다.
- 6개 레거시 mutation workflow가 제거되고 read-only EC2 audit만 남는다.
- Vercel non-main 자동 Preview와 동일 EAS build가 재발하지 않는다.
- RunPod build cache/concurrency와 endpoint worker 비용 정책이 기록된다.
- GCP/RunPod/Vercel/EAS 외부 상태와 월 청구 또는 usage 근거가 #177에
  남는다.
- EC2 로그 증가가 제한되고 안전 여유공간·배포·health evidence가 별도로
  검증된다.
