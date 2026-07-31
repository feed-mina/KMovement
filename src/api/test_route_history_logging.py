"""여행 이력 저장·조회 진단 로그.

호출부가 save_user_route_history 의 반환값을 쓰지 않기 때문에, 저장이 실패해도
API 응답은 정상으로 나간다. MY_PAGE 통계가 비어 있을 때 원인을 가를 단서는
로그밖에 없다.
"""
import src.api.route_history as m


class _Req:
    """save_user_route_history 가 받는 요청 모델 흉내."""

    def __init__(self, **payload):
        self._payload = payload

    def model_dump(self, mode=None):
        return dict(self._payload)


def _save(capsys, monkeypatch, req, response=None, **env):
    for key in ("KRIDE_ROUTE_HISTORY_STORE", "KRIDE_ROUTE_HISTORY_LOCAL_PATH",
                "SUPABASE_URL", "SUPABASE_KEY", "KRIDE_ROUTE_HISTORY_CAPTURE_ANONYMOUS"):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    result = m.save_user_route_history("route_planning", req, response or {})
    return result, capsys.readouterr().out


def test_disabled_store_is_logged_with_reason(capsys, monkeypatch):
    result, out = _save(capsys, monkeypatch, _Req(user_id="7"), KRIDE_ROUTE_HISTORY_STORE="off")

    assert result["stored"] is False
    assert "save.skipped" in out
    assert "reason=disabled" in out


def test_missing_user_is_logged_with_reason(capsys, monkeypatch):
    result, out = _save(capsys, monkeypatch, _Req())

    assert result["stored"] is False
    assert "reason=missing_user" in out


def test_no_store_configured_is_logged(capsys, monkeypatch):
    _, out = _save(capsys, monkeypatch, _Req(user_id="7"))

    assert "reason=no_store_configured" in out


def test_counts_tell_empty_artists_apart_from_failed_save(capsys, monkeypatch, tmp_path):
    """저장은 됐는데 아티스트가 0인 경우를 구분할 수 있어야 한다."""
    target = tmp_path / "history.jsonl"
    result, out = _save(
        capsys,
        monkeypatch,
        _Req(user_id="7", regions=["서울"]),
        {"pois": [{"name": "홍대 걷고싶은거리"}]},
        KRIDE_ROUTE_HISTORY_STORE="local",
        KRIDE_ROUTE_HISTORY_LOCAL_PATH=str(target),
    )

    assert result["stored"] is True
    assert "save.stored" in out
    # 0 은 빠뜨리면 안 되는 값이다. "저장은 됐는데 아티스트가 안 잡혔다"가
    # "저장 자체가 안 됐다"와 구분되는 지점이다.
    assert "artists=0" in out
    assert "regions=1" in out
    assert "pois=1" in out


def test_artists_are_counted_when_present(capsys, monkeypatch, tmp_path):
    target = tmp_path / "history.jsonl"
    _, out = _save(
        capsys,
        monkeypatch,
        _Req(user_id="7", artists=["BTS", "IVE"]),
        {},
        KRIDE_ROUTE_HISTORY_STORE="local",
        KRIDE_ROUTE_HISTORY_LOCAL_PATH=str(target),
    )

    assert "artists=2" in out


def test_summary_reports_row_and_artist_counts(capsys, monkeypatch):
    monkeypatch.setattr(m, "_read_history_rows_for_user", lambda *a, **k: [
        {"request_payload": {"artists": ["BTS"]}, "response_payload": {}, "visited_regions": ["서울"]},
    ])

    m.fetch_user_route_summary("7")
    out = capsys.readouterr().out

    assert "summary rows=1" in out
    assert "artists=1" in out


def test_read_skip_reason_is_logged(capsys, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)

    assert m._read_history_rows_for_user("7", limit=10, offset=0) == []
    assert "reason=supabase_not_configured" in capsys.readouterr().out

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "test-key")
    assert m._read_history_rows_for_user("guest", limit=10, offset=0) == []
    assert "reason=blank_user" in capsys.readouterr().out


def test_config_snapshot_hides_secrets(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "super-secret-key")

    config = m.describe_history_config()

    assert config["supabase_configured"] is True
    # 스냅샷에 비밀값이 새어 나가면 안 된다.
    assert "super-secret-key" not in str(config)
    assert "example.supabase.co" not in str(config)


def test_log_line_is_greppable_and_drops_empty_fields(capsys):
    m._log("save.stored", store="local", reason=None, artists=3)
    out = capsys.readouterr().out

    assert out.startswith("[K-Ride:history] save.stored")
    assert "store=local" in out
    assert "artists=3" in out
    assert "reason=" not in out
