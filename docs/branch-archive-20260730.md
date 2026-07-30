# 브랜치 정리 기록 (2026-07-30)

작업 브랜치가 23개까지 늘어나 목록 가독성이 떨어져, main에 이미 반영됐거나 폐기된
브랜치를 정리하기로 했다. 이 문서는 **정리 대상 브랜치의 판단 근거와 복구 경로**를 남긴다.

정리 작업은 원격 브랜치 삭제만 남아 있다. 자동화 세션에서 쓰는 git 릴레이가 브랜치 ref의
생성·갱신만 허용하고 **삭제와 태그 push를 403으로 거부**해, 삭제는 저장소 권한이 있는
로컬 환경이나 GitHub UI에서 수행해야 한다. 명령은 아래 "삭제 실행" 절에 정리해 뒀다.

## 백업

| 항목 | 값 |
|---|---|
| main 백업 브랜치 | `backup/main-20260730` |
| 백업 시점 main SHA | `7a5504d4850b9853de25f5c7767cc56b7e54fc7d` |

원래는 정리 대상 브랜치마다 `archive/<브랜치명>` 태그를 원격에 남기려 했으나 같은 이유로
태그를 올릴 수 없었다. 대신 아래 표에 tip SHA를 기록해 둔다. GitHub는 브랜치가 삭제돼도 커밋 객체를 SHA로 계속 참조할 수 있게 유지하며,
닫힌 PR 페이지의 **Restore branch** 버튼도 그대로 동작한다.

## 복구 방법

```bash
# SHA로 직접 복구
git fetch origin <tip-SHA>
git branch <복구할-브랜치명> <tip-SHA>

# 또는 GitHub의 해당 PR 페이지에서 "Restore branch" 클릭
```

## 정리 대상 브랜치 목록

`고유 커밋` = 2026-07-30 기준 main에 없던 커밋 수 (`git rev-list --count origin/main..<branch>`).
0이면 커밋이 전부 main에 포함돼 있어 손실이 없다.

| 브랜치 | tip SHA | 고유 커밋 | 관련 PR | 정리 사유 |
|---|---|---|---|---|
| `claude/debug-android-app-install-issue` | `1f95b4f78f8860ba137ab05605c72959f2a4ca75` | 0 | — | main에 병합 완료 |
| `claude/issue-152-9d713a` | `94b1e5632fd19c4b5e7fe1f4f28ee0d671819041` | 0 | #153 | main에 병합 완료 |
| `claude/issues-169-173-verification-f53102` | `eec2f1fa5e95adcdfe838143f6772b7fc6d1fde7` | 0 | #190 | main에 병합 완료 |
| `claude/kpop-fan-platform-phase-0-01b108` | `ff87d21e56b3b68adb40c6d34009a00b9fc65a08` | 0 | #174 | main에 병합 완료 |
| `claude/mobile-app-build-file-7ec232` | `7c8ba50946ef1a7d9cc0cdfc89d530348b95029c` | 0 | #158 | main에 병합 완료 |
| `claude/mobile-signup-address-kakao-4a97d8` | `5ba66778fe3e190e37b84159d1feb6916bd954cf` | 0 | #183 | main에 병합 완료 |
| `codex/issue-146-qa-blockers` | `f2a699cbb7f64d10dac0070d544ffb9b029ac677` | 0 | #147 | main에 병합 완료 |
| `codex/issue-159-165-sequential` | `9a0e4f993c74a739de6da2479fda57e99dd77f5a` | 0 | #167 | main에 병합 완료 |
| `codex/runpod-audit-runtime-fix` | `9859c6736c860e9de6515ae78166ae703551aaf0` | 0 | #180 | main에 병합 완료 |
| `codex/vercel-nested-branch-cost-fix` | `313b05c9440f45353432a7228d182f7f1ecb98ef` | 0 | #181 | main에 병합 완료 |
| `copilot/check-git-issues-and-update` | `33e9d762cb7b4e5256981b87fefd4063b64e9794` | 0 | — | main에 병합 완료 |
| `copilot/fix-chroma-db-path-issue` | `b2fdff35ecf9f0aaf94f5989f975d3d2c55ef1dd` | 0 | #189 | main에 병합 완료 |
| `copilot/fix-tests-to-pass` | `efb6b15d921817569a30180ce3c5a00f240c913e` | 0 | #191 | main에 병합 완료 |
| `copilot/investigate-server-deployment-issue` | `59c983d247aed570f6dc031a0f98e7d14d044abd` | 3 | #194 (close) | 아래 "고유 커밋이 있던 브랜치" 참고 |
| `copilot/k-pop-restore-sdui-flow` | `5411e3bd31a8edf783d5c07f03c8508714106f03` | 2 | #193 (close) | 아래 참고 |
| `copilot/kride-sdui-react-native-core-extraction` | `f95b47394e978e84bdaaeb1db54231cd88b659e3` | 0 | #188 | main에 병합 완료 |
| `copilot/update-existing-issues-check` | `0103c81dee7aaf502595343b19125dac56cb1975` | 0 | — | main에 병합 완료 |
| `docs-web-urls-pnpm` | `223af5949fda11edeefeed1f2f4de5b1ad826ae0` | 1 | #185 (close) | 아래 참고 |
| `feed-mina-fix-expo-startup-crash` | `6157dab20725ce93fb56da53ac883b2a95b62ef1` | 0 | #151 | main에 병합 완료 |
| `fix/kpop-web-render-loop` | `279eb0859bd05861cafdce7c7db38bd864383235` | 0 | — | main에 병합 완료 |
| `fix/kride-mobile-main-card-login-ux` | `6167ceef0fdb2a488c788c61125cff0f1c3a66e4` | 13 | #166/#175/#176 (close) | 아래 참고 |
| `fix/kride-root-redirect-vercel-domain` | `36721c03da5e25b4071785851ccb689e4dffa218` | 0 | #186 | main에 병합 완료 |
| `pnpm-kride` | `1b6f0c42fb510a5b05fbd2b46e65d41a90694cac` | 0 | #184 | main에 병합 완료 |

## 고유 커밋이 있던 브랜치 4개의 판단 근거

### `copilot/investigate-server-deployment-issue` (PR #194 → close)

원 목적인 V100 Flyway 마이그레이션 수정(`ON CONFLICT` → `DELETE` + `INSERT`)은 이미 main의
`caf118f`(`fix: make kpop migration idempotent without conflict target`)에 동일한 방식으로
반영돼 있다. 브랜치에 남은 고유 변경은 세 가지였고 모두 그대로 가져올 수 없었다.

- 6MB `actionlint` 실행 바이너리가 저장소 루트에 실수로 커밋됨
- `.github/workflows/deploy-ec2.yml`을 워크플로 `paths` 트리거에 추가 —
  `tests/test_deployment_cost_controls.py`가 명시적으로 **없어야 한다**고 검증하던 항목
- 배포 정리 단계에 `docker image prune -f` 추가 — 같은 테스트가 금지 목록에 두던 명령

뒤 두 개는 배포 비용 정책을 뒤집는 변경이라 브랜치에 딸려 들어갈 게 아니라 별도로 논의할
사안으로 보고 PR을 닫았다. 워크플로 트리거 변경이 실제로 필요하면 바이너리 없는 새 브랜치에서
정책 변경 근거와 함께 다시 올린다.

### `copilot/k-pop-restore-sdui-flow` (PR #193 → close)

secret 값에 `|`, `&`, `\`가 들어갔을 때 `sed` 치환이 깨지는 문제를 다뤘으나, main은 이미
`deploy-ec2.yml`의 `escape_sed_replacement()` 헬퍼로 같은 문제를 해결했다. 이 브랜치는
해당 문자가 들어오면 배포를 실패시키는 방식이라 main 쪽 해법보다 제약이 크다.

### `docs-web-urls-pnpm` (PR #185 → close)

README 서비스 주소표와 pnpm 워크플로 문서를 추가했는데, cherry-pick 후 충돌을 main 기준으로
정리하니 **남는 diff가 0**이었다. 같은 내용이 이미 main에 있고, Vercel 도메인 행은 main 쪽이
플레이스홀더 대신 실제 도메인(`https://k-movement.vercel.app/kpop`)을 담고 있어 더 최신이다.

### `fix/kride-mobile-main-card-login-ux` (PR #166/#175/#176 → close)

13커밋 규모였지만 결과물이 이미 main에 들어와 있다. 브랜치가 추가하던 주요 파일
(`kride/src/components/kride/KpopAnalysis.tsx`, `KpopCards.tsx`, `KpopEvidenceBadge.tsx`,
`KpopProducts.tsx`, `metadata-project/app/admin/community/page.tsx`,
`services/communityModerationService.ts` 등)이 모두 현재 main에 존재한다.

## 삭제 실행

로컬에서 아래를 실행하면 위 23개 브랜치가 한 번에 정리된다. `main`,
`backup/main-20260730`, 그리고 이 문서를 올린 작업 브랜치는 제외된다.

```bash
git fetch --all --prune
git branch -r --format='%(refname:short)' \
  | grep -v 'origin/HEAD' \
  | grep -vE 'origin/(main|backup/main-20260730|claude/branch-cleanup-backup-rezs6b)$' \
  | sed 's|^origin/||' \
  | xargs -n 1 git push origin --delete
```

GitHub UI에서 하려면 저장소의 **Branches** 페이지에서 각 브랜치의 휴지통 아이콘을 누르거나,
닫힌 PR 페이지 하단의 **Delete branch** 버튼을 쓰면 된다.

## 정리 후 남는 브랜치

| 브랜치 | 용도 |
|---|---|
| `main` | 기본 브랜치 |
| `backup/main-20260730` | 이번 정리 시점 main 스냅샷 |
