# GitHub Copilot / GitHub CLI 작업 안내

이 문서는 `gh` CLI를 사용해 이슈를 만들고, GitHub 프로젝트에 연결하는 방법을 정리합니다.

## 1. 이슈 생성

### 명령어
```bash
cd /workspaces/KMovement

gh issue create \
  --title "낙서 애니메이션 파이프라인 우선 구현" \
  --body "우선순위: 커뮤니티 낙서 입력 -> AnimatedDrawings 애니메이션 -> TTS/BGM 합성 -> 최종 MP4 생성 플로우를 먼저 구현합니다.\n\n작업 항목:\n- 커뮤니티 스케치 캔버스/저장 → PNG 핸드오프\n- `animated_drawings_worker` 호출 API 구현\n- 낙서 전용 route/라우팅 고정\n- TTS/BGM 결합 및 결과 MP4 출력\n- `job_id` 기반 상태/완료 반환\n\n추후 확장:\n- GIF 오버레이 위치/투명도/재생속도 UI 제어\n- `meta_animation` 후합성 경로 추가\n\n프로젝트 보드는 현재 repo에 없음. 이 이슈를 우선 기록하고 개발을 시작합니다." \
  --label "enhancement"
```

### 실행 결과
- 새로운 이슈가 생성되면 URL이 출력됩니다.
- 현재 생성된 이슈는 `https://github.com/feed-mina/KMovement/issues/1` 입니다.

## 2. 프로젝트 생성

현재 저장소에는 GitHub 프로젝트가 없습니다.
`gh project create` 명령은 다음과 같이 사용할 수 있습니다.

```bash
cd /workspaces/KMovement

gh project create --owner feed-mina --title "K-ride"
```

### 권한 문제 처리

만약 다음과 같은 오류가 나오면:
- `Resource not accessible by integration (createProjectV2)`

`gh` 인증에 `project` 권한을 추가해야 합니다.

```bash
gh auth refresh -s project
```

하지만 아래와 같은 메시지가 나타나면, 현재 `GITHUB_TOKEN` 환경 변수가 `gh` CLI 인증에 사용되고 있는 것입니다.

```text
The value of the GITHUB_TOKEN environment variable is being used for authentication.
To refresh credentials stored in GitHub CLI, first clear the value from the environment.
```

이 경우에는 쉘에서 `GITHUB_TOKEN`을 비우고 `gh auth login` 또는 `gh auth refresh`를 다시 실행해야 합니다.

```bash
unset GITHUB_TOKEN
gh auth login
# 또는
gh auth refresh -s project
```

그 다음 다시 프로젝트를 생성합니다.

## 3. 이슈를 프로젝트에 연결하기

프로젝트가 생성된 뒤, 이슈를 연결하려면 아래 명령을 사용합니다.

```bash
cd /workspaces/KMovement

gh issue edit 1 --add-project "K-ride"
```

## 4. 현재 상황 요약

- 이슈: `#1` (낙서 애니메이션 파이프라인 우선 구현)
- 프로젝트: 현재 없음
- 권한이 부족하면 `gh auth refresh -s project`를 실행한 뒤 다시 시도하세요.

## 5. 추가 팁

- 이미 생성된 프로젝트가 있다면 `--add-project`에 프로젝트 제목을 넣으면 됩니다.
- 프로젝트 생성이 안 되는 경우, GitHub 웹 UI에서 직접 `K-ride` 프로젝트를 만든 뒤 이슈를 연결하세요.
- `gh issue edit`로 이슈 제목, 본문, 레이블, 프로젝트를 나중에 수정할 수 있습니다.
