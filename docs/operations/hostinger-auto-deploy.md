# Hostinger 웹 자동 배포: 최초 연결 한 번, 이후 main 반영으로 배포

작성일: 2026-10-25

**main에 합친 코드의 검사가 성공하면 새 웹 이미지를 발행하고, Hostinger 웹 컨테이너를 교체한 뒤 실제 버전까지 확인합니다.** 연결에 필요한 SSH 키 등록은 최초 한 번 필요합니다.

## 무엇이 자동으로 되나요?

1. main의 CI - Build Verification이 성공합니다.
2. Auto deploy Hostinger web이 같은 코드 버전을 선택합니다.
3. 현재 main이 맞는지, 검사에 통과했는지, 서버에 연결되는지 확인합니다.
4. GHCR(GitHub Container Registry, 컨테이너 이미지 보관소)에 새 이미지를 발행합니다.
5. Hostinger에서 기존 설정과 복구 정보를 보관하고 **web 하나만** 교체합니다.
6. 내부 페이지, 공개 홈·탐색·코스 페이지, 공개 버전 주소를 검사합니다.
7. 새 버전 검사에 실패하면 이전 이미지로 복구하고 복구 결과도 검사합니다.

~~~mermaid
flowchart TD
 A["main 검사 성공"] --> B["현재 main·서버 연결 확인"]
 B --> C["같은 버전의 웹 이미지 발행"]
 C --> D["기존 설정 보관·웹 교체"]
 D --> E{"공개 버전까지 일치?"}
 E -->|예| F["배포 완료 기록"]
 E -->|아니요| G["이전 이미지 복구·재검사"]
~~~

PR 검사와 다른 저장소의 코드는 운영 배포에 사용하지 않습니다. 이전 버전의 검사가 늦게 끝나도 최신 main과 다르면 교체하지 않습니다. 배포 중 다음 변경이 도착했다고 기존 배포를 강제로 취소하지 않습니다.

## 지금 남은 최초 연결

이번 작업 환경에서는 Hostinger SSH 접속과 GitHub CLI의 비밀값 등록을 사용할 수 없었습니다. **자동 배포 코드 준비와 첫 운영 배포 성공은 다릅니다.** 아래 연결을 끝내야 실제 서버 교체까지 진행할 수 있습니다.

| GitHub Secret 이름 | 들어갈 내용 |
|---|---|
| HOSTINGER_SSH_PRIVATE_KEY | 이 서비스 자동 배포용 SSH 개인키 |
| HOSTINGER_SSH_KNOWN_HOSTS | 신뢰한 서버 콘솔에서 확인한 SSH 서버 공개키 한 줄 |
| NEXT_PUBLIC_KAKAO_MAP_APP_KEY | 기존 이미지 발행에도 사용한 카카오 JavaScript 키 |

개인키는 서버 배포 권한을 가지므로 채팅·문서·Git 커밋에 붙여 넣지 않습니다. 아래 절차는 개인키 내용을 화면에 출력하지 않고 GitHub에 직접 전달합니다.

기본 접속은 kmovement.srv1869569.hstgr.cloud, 포트 22, root입니다. 다르면 Repository Variables의 HOSTINGER_SSH_HOST / HOSTINGER_SSH_PORT / HOSTINGER_SSH_USER를 설정합니다. 포트가 다르면 known_hosts에도 [호스트]:포트 형식을 사용해야 합니다.

## 1. Hostinger 서버 터미널에서 전용 키 준비

Hostinger VPS의 root 터미널에서 실행합니다. 자동 배포 수정이 main에 들어간 뒤 실행해야 합니다.

~~~bash
set -euo pipefail
umask 077
test "$(hostname)" = 'srv1869569'
curl --fail --silent --show-error --location \
  https://raw.githubusercontent.com/feed-mina/KMovement/main/deploy/hostinger/setup_ci_ssh.sh \
  -o /root/kmovement-setup-ci-ssh.sh
bash /root/kmovement-setup-ci-ssh.sh
~~~

/docker/kmovement-web/ci-access/에 전용 키를 만들고 기존 authorized_keys에 공개키를 추가합니다. 기존 SSH 키·앱 환경 파일을 삭제하거나 SSH 서버를 재시작하지 않습니다.

끝에 표시되는 서버 지문을 보관합니다. 다음 단계에서 처음 SSH로 연결할 때 같은 지문인지 대조합니다. 지문은 서버 신원을 확인하는 공개 정보입니다.

## 2. Windows PowerShell에서 GitHub에 비밀값 등록

이 단계는 **노트북 PowerShell**에서 실행합니다. GitHub CLI(명령줄 프로그램)와 feed-mina/KMovement의 비밀값 등록 권한이 필요합니다.

~~~powershell
gh auth status
~~~

인증되지 않았다면 gh auth login으로 로그인합니다. SSH 첫 연결이면 아래 명령으로 1단계 지문과 대조하고 로그인한 뒤 exit로 나옵니다.

~~~powershell
ssh root@kmovement.srv1869569.hstgr.cloud
~~~

아래 등록 명령은 SSH 실패 시 빈 값으로 기존 비밀값을 덮지 않도록 중단합니다. 키 내용은 출력하지 않습니다.

~~~powershell
$ErrorActionPreference = 'Stop'
$kmRepo = 'feed-mina/KMovement'
$kmServer = 'root@kmovement.srv1869569.hstgr.cloud'

$kmPrivateKey = & ssh -o StrictHostKeyChecking=yes $kmServer 'cat /docker/kmovement-web/ci-access/id_ed25519'
if ($LASTEXITCODE -ne 0 -or -not ($kmPrivateKey -join '').Contains('BEGIN OPENSSH PRIVATE KEY')) {
    throw '서버 전용 키를 가져오지 못했습니다. GitHub 비밀값은 변경하지 않았습니다.'
}
($kmPrivateKey -join [Environment]::NewLine) | gh secret set HOSTINGER_SSH_PRIVATE_KEY --repo $kmRepo
if ($LASTEXITCODE -ne 0) { throw 'GitHub 개인키 등록 실패' }
Remove-Variable kmPrivateKey

$kmKnownHosts = & ssh -o StrictHostKeyChecking=yes $kmServer 'cat /docker/kmovement-web/ci-access/known_hosts'
if ($LASTEXITCODE -ne 0 -or -not ($kmKnownHosts -join '').Contains('ssh-ed25519')) {
    throw '서버 확인 키를 가져오지 못했습니다.'
}
($kmKnownHosts -join [Environment]::NewLine) | gh secret set HOSTINGER_SSH_KNOWN_HOSTS --repo $kmRepo
if ($LASTEXITCODE -ne 0) { throw 'GitHub 서버 확인 키 등록 실패' }
Remove-Variable kmKnownHosts

gh secret list --repo $kmRepo
~~~

등록 후 [GitHub Actions Secrets 설정](https://github.com/feed-mina/KMovement/settings/secrets/actions)에서 이름을 확인합니다. 비밀값을 채팅으로 전달할 필요는 없습니다.

## 3. 첫 배포 실행

1. [main 검사](https://github.com/feed-mina/KMovement/actions/workflows/ci.yml)가 성공했는지 확인합니다.
2. [Auto deploy Hostinger web](https://github.com/feed-mina/KMovement/actions/workflows/hostinger-web-deploy.yml)을 엽니다.
3. Run workflow → main → Run workflow를 선택합니다.
4. 성공 Summary의 코드 SHA(코드 버전), 이미지 digest(이미지 식별값), 공개 버전 주소를 확인합니다.
5. 이후 main 변경부터는 검사가 성공하면 자동으로 이어집니다.

GitHub Environment hostinger-production에 필수 검토자 규칙이 있으면 승인 단계에서 대기합니다. 승인 없는 자동 배포를 원하면 필수 검토자 대기가 없어야 합니다. 공개 PR의 코드를 바로 배포하도록 바꾸지는 않습니다.

## 4. 실제로 바뀌었는지 확인

~~~bash
curl --fail --silent --show-error \
  https://kmovement.srv1869569.hstgr.cloud/health/release
~~~

새 버전은 status=ok와 revision=실제 40자리 main SHA를 JSON으로 응답합니다. 버전 없는 옛 이미지는 이 주소가 없거나 503을 반환할 수 있습니다.

HTTP 200만으로 새 버전이라고 판단하지 않습니다. 공개 revision과 배포 Summary의 SHA가 같아야 합니다. 위치 권한·지도 검색·AI 동의·저장 같은 실제 화면 시험은 별도로 확인합니다.

## 5. 실패했을 때의 의미

| 표시 | 의미·할 일 |
|---|---|
| Register HOSTINGER_SSH_PRIVATE_KEY | 개인키가 제공되지 않음. 1~2단계 실행 |
| Register HOSTINGER_SSH_KNOWN_HOSTS | 신뢰한 서버 콘솔의 확인 키 등록 필요 |
| SSH host key verification failed | 서버 지문 대조 필요. 검사를 끄지 않음 |
| main changed / superseded | 준비 중 main 변경. 새 버전 배포 결과 확인 |
| failed_before_replace | 교체 전 검사에서 멈춤. 이 작업에서는 웹 교체하지 않음 |
| rolled_back | 이전 버전 복구와 검사 성공. 새 이미지/라우팅 원인 조사 |
| rollback_failed | 복구 검사도 실패. 운영자 상태 확인 필요 |
| verified | 새 이미지·내부/공개 페이지·공개 버전 확인 성공 |

공개 연결은 최대 12번, 5초 간격으로 재확인합니다. 서버 응답 시간 때문에 전체 확인 시간은 더 길 수 있습니다.

기록은 /docker/kmovement-web/releases/<SHA>-auto-<식별자>/release.json에 남습니다. before.compose.json과 before.container.json에는 비밀값이 있을 수 있어 서버 비공개 폴더에서만 보관하고 GitHub에 첨부하지 않습니다.

## 6. 배포 범위와 복구

- 기존 Compose·환경 파일·네트워크·Traefik 설정과 실행 중 환경을 먼저 비교합니다.
- web.image 외 설정이 바뀌면 중단합니다.
- 같은 역할의 과거 이미지 override만 정리해 설정 목록의 누적을 막습니다.
- DB·Spring·FastAPI·Redis·다른 프로젝트는 교체하지 않습니다.
- env 수정·DB 마이그레이션·이미지/볼륨 삭제는 하지 않습니다.
- 단일 웹 교체이므로 짧은 연결 중단 가능성은 있습니다.
- GHCR 이미지의 공개 읽기가 전제입니다. 비공개 전환 시 서버에 별도 읽기 인증이 필요합니다.

수동 복구 명령은 해당 release 폴더의 rollback.sh입니다. 이전 설정과 이미지 ID를 사용합니다. 실행 뒤 페이지와 공개 버전은 운영자가 다시 확인해야 합니다.

## 파일과 공식 참고

- [자동 배포 워크플로](../../.github/workflows/hostinger-web-deploy.yml)
- [웹 교체·복구 코드](../../deploy/hostinger/deploy_web.py)
- [최초 SSH 연결 준비](../../deploy/hostinger/setup_ci_ssh.sh)
- [기존 수동 복구 가이드](hostinger-main-deploy.md)
- [GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
- [Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up/)
