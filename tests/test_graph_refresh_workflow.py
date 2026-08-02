"""저장소에 커밋하는 워크플로의 범위 제약 검증.

refresh-graph-from-supabase.yml 은 contents: write 를 갖는다. 이 저장소의 다른
워크플로는 전부 읽기 전용이므로, 이 하나가 어디까지 쓸 수 있는지는 코드로
고정해 둔다. 범위가 넓어지면 리뷰 없이 저장소가 바뀌는 경로가 생긴다.
"""
from __future__ import annotations

from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
REFRESH = WORKFLOWS / "refresh-graph-from-supabase.yml"


def _refresh() -> dict:
    # PyYAML 은 `on:` 을 불리언 True 로 읽는다.
    return yaml.safe_load(REFRESH.read_text(encoding="utf-8"))


def test_only_this_workflow_may_write_to_the_repository() -> None:
    """쓰기 권한을 가진 워크플로가 늘어나는 것을 눈에 띄게 한다."""
    writers = []
    for path in sorted(WORKFLOWS.glob("*.yml")):
        permissions = yaml.safe_load(path.read_text(encoding="utf-8")).get("permissions")
        if isinstance(permissions, dict) and permissions.get("contents") == "write":
            writers.append(path.name)

    assert writers == [REFRESH.name], writers


def test_it_never_runs_on_its_own() -> None:
    """푸시나 일정으로 저절로 돌면 아무도 보지 않는 커밋이 쌓인다."""
    triggers = _refresh()[True]

    assert set(triggers) == {"workflow_dispatch"}
    assert "branch" in triggers["workflow_dispatch"]["inputs"]


def test_it_refuses_to_commit_to_main() -> None:
    """결과는 PR 로 검토한다. 그래프는 배포 이미지에 들어가는 산출물이다."""
    text = REFRESH.read_text(encoding="utf-8")
    steps = _refresh()["jobs"]["refresh"]["steps"]

    # 거부가 첫 단계여야 한다. 뒤에 있으면 그전에 체크아웃과 병합이 이미 돈다.
    assert steps[0]["name"] == "Reject main"
    assert '= "main" ]' in text
    assert "exit 1" in steps[0]["run"]


def test_it_commits_only_the_graph_file() -> None:
    """스크립트가 다른 것을 건드렸더라도 커밋에 들어가면 안 된다."""
    text = REFRESH.read_text(encoding="utf-8")

    assert "git add -- models/kride_graph.json" in text
    # 통째로 담는 형태는 쓰지 않는다.
    for wildcard in ("git add .", "git add -A", "git commit -a"):
        assert wildcard not in text, wildcard

    # 병합 스크립트가 남기는 11MB 백업은 커밋 대상이 아니다.
    assert "rm -f models/kride_graph.json.bak" in text

    # 바뀐 것이 없으면 빈 커밋을 만들지 않는다.
    assert "git diff --quiet -- models/kride_graph.json" in text


def test_it_fails_loudly_when_the_key_is_missing() -> None:
    """키가 없으면 supabase 가 0건을 돌려주고 병합이 조용히 아무것도 안 한다.

    RLS 때문에 권한 없는 키도 에러가 아니라 빈 결과를 준다(#226). 그 상태로
    성공 처리되면 "갱신했는데 안 바뀌었다" 로 보인다.
    """
    text = REFRESH.read_text(encoding="utf-8")

    assert 'if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]' in text
    assert "::error::SUPABASE_URL and SUPABASE_KEY must be configured." in text

    # 스크립트 쪽에도 0건 감지가 있어야 한다.
    script = (ROOT / "scripts" / "merge_media_pois_into_graph.py").read_text(
        encoding="utf-8"
    )
    assert "publishable 키는 RLS 에 막혀 0건을 돌려준다" in script


def test_it_reports_whether_the_ui_artists_resolve() -> None:
    """숫자만 보고는 갱신이 목적을 달성했는지 알 수 없다.

    UI 목록에 있으나 그래프에 없는 아티스트가 남아 있으면, 그 이름을 고른
    요청은 아티스트 확장이 0건이 되어 지역 대체로 떨어진다.
    """
    text = REFRESH.read_text(encoding="utf-8")

    assert "UI 12종 매칭" in text
    assert "::warning::그래프에 없는 UI 아티스트" in text
    for artist in ("인피니트", "강다니엘", "GOT7"):
        assert artist in text, artist
