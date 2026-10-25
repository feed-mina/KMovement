"""Behavior checks for the shared connections, database guards and legacy upgrade."""
import sqlite3
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager

import pytest

from deploy.photo_video import worker
from deploy.photo_video.app import create_app
from deploy.photo_video.database import check_database, connect, initialize_schema


@pytest.fixture
def database(tmp_path):
    path = tmp_path / 'workflow.sqlite3'
    initialize_schema(path)
    with connect(path) as con:
        con.execute("INSERT INTO photos(id,owner) VALUES ('p1',1),('p2',2),('p3',1)")
        con.execute("INSERT INTO jobs(id,owner,photo_id,request_id,status,trip_json) VALUES ('parent',1,'p1','r1','FAILED','course')")
    return path


def insert_job(con, **changes):
    values = {'id': str(uuid.uuid4()), 'owner': 1, 'photo_id': 'p1',
              'request_id': str(uuid.uuid4()), 'retry_of': None, 'trip_json': 'course'}
    values.update(changes)
    names = ','.join(values)
    con.execute(f"INSERT INTO jobs({names}) VALUES ({','.join('?' for _ in values)})", tuple(values.values()))


@pytest.mark.parametrize('changes', [
    {'photo_id': 'missing'},
    {'photo_id': 'p2'},
    {'retry_of': 'missing'},
    {'retry_of': 'parent', 'photo_id': 'p3'},
    {'retry_of': 'parent', 'trip_json': 'changed'},
    {'retry_of': 'parent', 'trip_json': None},
    {'id': 'self', 'retry_of': 'self'},
    {'status': 'UNKNOWN'},
    {'render_ms': -1},
    {'owner': 0},
    {'id': None},
])
def test_reject_invalid_links_and_values(database, changes):
    with connect(database) as con, pytest.raises(sqlite3.IntegrityError):
        insert_job(con, **changes)
    assert check_database(database)['jobs'] == 1


@pytest.mark.parametrize('sql', [
    "UPDATE jobs SET owner=2 WHERE id='parent'",
    "UPDATE jobs SET photo_id='p3' WHERE id='parent'",
    "UPDATE jobs SET trip_json='changed' WHERE id='parent'",
    "UPDATE jobs SET retry_of='parent' WHERE id='parent'",
    "UPDATE photos SET owner=2 WHERE id='p3'",
    "DELETE FROM photos WHERE id='p1'",
])
def test_reject_reference_mutation(database, sql):
    with connect(database) as con, pytest.raises(sqlite3.IntegrityError):
        con.execute(sql)


def test_retry_guards_keep_history_and_allow_retry_after_failure(database):
    with connect(database) as con:
        insert_job(con, id='retry1', retry_of='parent')
    with connect(database) as con, pytest.raises(sqlite3.IntegrityError):
        insert_job(con, retry_of='parent')
    with connect(database) as con, pytest.raises(sqlite3.IntegrityError):
        con.execute("UPDATE jobs SET status='QUEUED' WHERE id='parent'")
    with connect(database) as con, pytest.raises(sqlite3.IntegrityError):
        con.execute("DELETE FROM jobs WHERE id='parent'")
    with connect(database) as con:
        con.execute("UPDATE jobs SET status='FAILED',render_ms=12 WHERE id='retry1'")
        insert_job(con, id='retry2', retry_of='parent')
    with connect(database) as con, pytest.raises(sqlite3.IntegrityError):
        insert_job(con, retry_of='retry2')
    assert check_database(database)['jobs'] == 3


def test_concurrent_retries_accept_only_one(database):
    def attempt(_):
        try:
            with connect(database) as con:
                con.execute('BEGIN IMMEDIATE')
                insert_job(con, retry_of='parent')
            return True
        except sqlite3.IntegrityError:
            return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(attempt, range(2))) == [False, True]


def test_api_and_worker_enable_and_close_each_connection(tmp_path, monkeypatch):
    monkeypatch.setenv('PHOTO_VIDEO_INTERNAL_KEY', 'test-key-' * 8)
    app = create_app(tmp_path)
    with app.state.connect() as con:
        assert con.execute('PRAGMA foreign_keys').fetchone()[0] == 1
        con.execute("INSERT INTO photos(id,owner) VALUES ('p1',1)")
        insert_job(con, id='j1')
    with pytest.raises(sqlite3.ProgrammingError):
        con.execute('SELECT 1')
    observed = []
    real_connect = worker.connect

    @contextmanager
    def checked(path):
        with real_connect(path) as connection:
            observed.append(connection)
            assert connection.execute('PRAGMA foreign_keys').fetchone()[0] == 1
            yield connection

    monkeypatch.setattr(worker, 'connect', checked)
    monkeypatch.setattr(worker, 'render_photo', lambda *args: None)
    assert worker.run_once(tmp_path)
    assert len(observed) == 2
    for connection in observed:
        with pytest.raises(sqlite3.ProgrammingError):
            connection.execute('SELECT 1')
    with app.state.connect() as con:
        assert con.execute("SELECT status FROM jobs WHERE id='j1'").fetchone()[0] == 'COMPLETED'


def legacy_database(path, *, old_columns=False):
    with sqlite3.connect(path) as con:
        con.execute("CREATE TABLE photos(id TEXT PRIMARY KEY,owner INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
        con.execute("""CREATE TABLE jobs(id TEXT PRIMARY KEY,owner INTEGER NOT NULL,photo_id TEXT NOT NULL,
            request_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'QUEUED',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,started_at TEXT,finished_at TEXT,error_code TEXT,
            UNIQUE(owner,request_id),FOREIGN KEY(photo_id) REFERENCES photos(id))""")
        con.execute('CREATE INDEX jobs_owner_created ON jobs(owner,created_at)')
        if not old_columns:
            for name, kind in [('retry_of','TEXT'), ('render_ms','INTEGER'), ('trip_json','TEXT')]:
                con.execute(f'ALTER TABLE jobs ADD COLUMN {name} {kind}')
        con.execute("INSERT INTO photos(id,owner) VALUES ('p1',1)")
        con.execute("INSERT INTO jobs(id,owner,photo_id,request_id,status) VALUES ('z-parent',1,'p1','r1','FAILED')")
        if not old_columns:
            con.execute("INSERT INTO jobs(id,owner,photo_id,request_id,status,retry_of,render_ms,trip_json) VALUES ('a-child',1,'p1','r2','FAILED','z-parent',15,NULL)")
            con.execute("INSERT INTO jobs(id,owner,photo_id,request_id,retry_of) VALUES ('a-grandchild',1,'p1','r3','a-child')")


@pytest.mark.parametrize('old_columns', [False, True])
def test_legacy_upgrade_preserves_rows_files_and_backup(tmp_path, old_columns):
    path = tmp_path / 'workflow.sqlite3'
    legacy_database(path, old_columns=old_columns)
    photo = tmp_path / 'p1.jpg'
    photo.write_bytes(b'fixture-file')
    initialize_schema(path)
    assert check_database(path)['jobs'] == (1 if old_columns else 3)
    assert photo.read_bytes() == b'fixture-file'
    backups = list(tmp_path.glob('*.bak'))
    assert len(backups) == 1
    with sqlite3.connect(backups[0]) as con:
        assert con.execute('PRAGMA user_version').fetchone()[0] == 0
        assert con.execute('SELECT COUNT(*) FROM jobs').fetchone()[0] == (1 if old_columns else 3)
    initialize_schema(path)
    assert len(list(tmp_path.glob('*.bak'))) == 1


@pytest.mark.parametrize('corruption', [
    "UPDATE jobs SET photo_id='missing' WHERE id='z-parent'",
    "UPDATE jobs SET owner=2 WHERE id='z-parent'",
    "UPDATE jobs SET trip_json='changed' WHERE id='a-child'",
    "UPDATE jobs SET retry_of='a-child' WHERE id='z-parent'",
    "UPDATE jobs SET status='QUEUED' WHERE id='z-parent'",
])
def test_bad_legacy_upgrade_rolls_back_without_deleting_rows(tmp_path, corruption):
    path = tmp_path / 'workflow.sqlite3'
    legacy_database(path)
    with sqlite3.connect(path) as con:
        con.execute(corruption)
        before = con.execute('SELECT * FROM jobs ORDER BY id').fetchall()
    with pytest.raises((sqlite3.IntegrityError, RuntimeError)):
        initialize_schema(path)
    with sqlite3.connect(path) as con:
        assert con.execute('PRAGMA user_version').fetchone()[0] == 0
        assert con.execute('SELECT * FROM jobs ORDER BY id').fetchall() == before
        assert con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall() == [('jobs',), ('photos',)]
    assert len(list(tmp_path.glob('*.bak'))) == 1


def test_readonly_check_does_not_create_missing_database(tmp_path):
    path = tmp_path / 'missing.sqlite3'
    with pytest.raises(sqlite3.OperationalError):
        check_database(path)
    assert not path.exists()


def test_future_schema_and_worker_legacy_are_rejected(tmp_path):
    path = tmp_path / 'workflow.sqlite3'
    legacy_database(path)
    with pytest.raises(RuntimeError, match='SCHEMA_NOT_READY'):
        worker.run_once(tmp_path)
    with sqlite3.connect(path) as con:
        con.execute('PRAGMA user_version=99')
    with pytest.raises(RuntimeError, match='UNSUPPORTED_SCHEMA_VERSION'):
        initialize_schema(path)
