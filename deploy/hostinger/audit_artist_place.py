"""Run on trusted Hostinger via SSH. Prints approved artist metadata and counts only."""
import json
import socket
import subprocess
import sys

SQL = """
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT json_build_object(
  'snapshotOrigin', 'hostinger_postgresql_read_only',
  'capturedAt', CURRENT_TIMESTAMP,
  'allArtistCount', (SELECT COUNT(*) FROM artist),
  'tableCounts', json_build_object(
     'tour_poi', (SELECT COUNT(*) FROM tour_poi),
     'holy_content', (SELECT COUNT(*) FROM holy_content),
     'holy_content_poi', (SELECT COUNT(*) FROM holy_content_poi)),
  'data', json_build_object(
     'totalCount', (SELECT COUNT(*) FROM artist WHERE approved_yn = 'Y'),
     'items', (SELECT COALESCE(json_agg(a ORDER BY a.id), '[]'::json)
        FROM (SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn"
              FROM artist WHERE approved_yn = 'Y') a)));
ROLLBACK;
"""


def snapshot(run=subprocess.run, hostname=socket.gethostname):
    if hostname() != "srv1869569":
        raise RuntimeError("unexpected_host")
    command = ["docker", "exec", "-i", "kmovement-g1-postgres-1", "sh", "-lc",
               'exec psql -X -q -t -A -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"']
    result = run(command, input=SQL, text=True, capture_output=True, timeout=40)
    if result.returncode:
        # Do not expose environment, connection strings or arbitrary database errors.
        raise RuntimeError("read_only_snapshot_failed_check_schema_and_container")
    data = json.loads(result.stdout.strip())
    if data.get("snapshotOrigin") != "hostinger_postgresql_read_only":
        raise RuntimeError("invalid_snapshot")
    return data


if __name__ == "__main__":
    try:
        print(json.dumps(snapshot(), ensure_ascii=True))
    except Exception as error:
        print("Read-only snapshot failed: " + type(error).__name__, file=sys.stderr)
        sys.exit(1)
