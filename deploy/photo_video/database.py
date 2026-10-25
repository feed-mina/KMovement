"""Shared SQLite connections and atomic, backed-up reference migration."""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = 2
JOB_COLUMNS = (
    'id', 'owner', 'photo_id', 'request_id', 'status', 'created_at',
    'started_at', 'finished_at', 'error_code', 'retry_of', 'render_ms', 'trip_json',
)


@contextmanager
def connect(database: Path, *, readonly: bool = False):
    target = database.resolve().as_uri() + '?mode=ro' if readonly else database
    con = sqlite3.connect(target, timeout=15, uri=readonly)
    con.row_factory = sqlite3.Row
    try:
        con.execute('PRAGMA foreign_keys=ON')
        if con.execute('PRAGMA foreign_keys').fetchone()[0] != 1:
            raise RuntimeError('PHOTO_VIDEO_FOREIGN_KEYS_DISABLED')
        if readonly:
            con.execute('PRAGMA query_only=ON')
        with con:
            yield con
    finally:
        con.close()


def require_current_schema(con):
    if con.execute('PRAGMA user_version').fetchone()[0] != SCHEMA_VERSION:
        raise RuntimeError('PHOTO_VIDEO_SCHEMA_NOT_READY')


def _create_schema(con):
    # execute separately: executescript would commit the migration prematurely.
    statements = [
        """CREATE TABLE photos (
            id TEXT NOT NULL PRIMARY KEY,
            owner INTEGER NOT NULL CHECK(owner > 0),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(id,owner))""",
        """CREATE TABLE jobs (
            id TEXT NOT NULL PRIMARY KEY,
            owner INTEGER NOT NULL CHECK(owner > 0),
            photo_id TEXT NOT NULL, request_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'QUEUED'
                CHECK(status IN ('QUEUED','RUNNING','COMPLETED','FAILED')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            started_at TEXT, finished_at TEXT, error_code TEXT,
            retry_of TEXT, render_ms INTEGER CHECK(render_ms >= 0), trip_json TEXT,
            UNIQUE(owner,request_id), UNIQUE(id,owner,photo_id),
            FOREIGN KEY(photo_id,owner) REFERENCES photos(id,owner) ON DELETE RESTRICT,
            FOREIGN KEY(retry_of,owner,photo_id) REFERENCES jobs(id,owner,photo_id) ON DELETE RESTRICT,
            CHECK(retry_of IS NULL OR retry_of <> id))""",
        'CREATE INDEX jobs_owner_created ON jobs(owner,created_at)',
        """CREATE UNIQUE INDEX jobs_one_live_retry ON jobs(retry_of)
            WHERE retry_of IS NOT NULL AND status IN ('QUEUED','RUNNING','COMPLETED')""",
        """CREATE TRIGGER jobs_retry_guard BEFORE INSERT ON jobs
            WHEN NEW.retry_of IS NOT NULL
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM jobs parent WHERE parent.id=NEW.retry_of
                    AND parent.owner=NEW.owner AND parent.photo_id=NEW.photo_id
                    AND parent.status='FAILED' AND parent.trip_json IS NEW.trip_json
                ) THEN RAISE(ABORT,'INVALID_RETRY_REFERENCE') END;
            END""",
        """CREATE TRIGGER jobs_immutable_reference
            BEFORE UPDATE OF id,owner,photo_id,request_id,retry_of,trip_json ON jobs
            WHEN NEW.id IS NOT OLD.id OR NEW.owner IS NOT OLD.owner
                OR NEW.photo_id IS NOT OLD.photo_id OR NEW.request_id IS NOT OLD.request_id
                OR NEW.retry_of IS NOT OLD.retry_of OR NEW.trip_json IS NOT OLD.trip_json
            BEGIN SELECT RAISE(ABORT,'IMMUTABLE_JOB_REFERENCE'); END""",
        """CREATE TRIGGER photos_immutable_reference BEFORE UPDATE OF id,owner ON photos
            WHEN NEW.id IS NOT OLD.id OR NEW.owner IS NOT OLD.owner
            BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PHOTO_REFERENCE'); END""",
        """CREATE TRIGGER jobs_failed_retry_parent BEFORE UPDATE OF status ON jobs
            WHEN OLD.status='FAILED' AND NEW.status<>'FAILED'
                AND EXISTS(SELECT 1 FROM jobs child WHERE child.retry_of=OLD.id)
            BEGIN SELECT RAISE(ABORT,'RETRY_PARENT_MUST_STAY_FAILED'); END""",
    ]
    for statement in statements:
        con.execute(statement)


def _validate(con):
    if con.execute('PRAGMA foreign_key_check').fetchone() is not None:
        raise RuntimeError('PHOTO_VIDEO_FOREIGN_KEY_VIOLATIONS')
    if con.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise RuntimeError('PHOTO_VIDEO_INTEGRITY_CHECK_FAILED')


def initialize_schema(database: Path):
    """Keep rows and files unchanged on invalid legacy input; never repair by deletion."""
    database.parent.mkdir(parents=True, exist_ok=True)
    with connect(database) as con:
        con.execute('BEGIN IMMEDIATE')
        version = con.execute('PRAGMA user_version').fetchone()[0]
        if version == SCHEMA_VERSION:
            _validate(con)
            return
        if version != 0:
            raise RuntimeError('PHOTO_VIDEO_UNSUPPORTED_SCHEMA_VERSION')
        tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
        if tables:
            if tables != {'photos', 'jobs'}:
                raise RuntimeError('PHOTO_VIDEO_UNEXPECTED_LEGACY_TABLES')
            columns = {r[1] for r in con.execute('PRAGMA table_info(jobs)')}
            if columns - set(JOB_COLUMNS) or not set(JOB_COLUMNS[:9]) <= columns:
                raise RuntimeError('PHOTO_VIDEO_UNEXPECTED_LEGACY_COLUMNS')
            photo_columns = {r[1] for r in con.execute('PRAGMA table_info(photos)')}
            if photo_columns != {'id', 'owner', 'created_at'}:
                raise RuntimeError('PHOTO_VIDEO_UNEXPECTED_LEGACY_COLUMNS')
            if con.execute("SELECT 1 FROM sqlite_master WHERE type='trigger'").fetchone():
                raise RuntimeError('PHOTO_VIDEO_UNEXPECTED_LEGACY_TRIGGERS')
            backup = database.with_name(database.name + '.pre-v2-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex[:8] + '.bak')
            # A reserved write lock prevents concurrent writers; the separate read
            # connection backs up the complete committed pre-migration state.
            with connect(database, readonly=True) as source:
                destination = sqlite3.connect(backup)
                try:
                    source.backup(destination)
                finally:
                    destination.close()
            backup.chmod(0o600)
            con.execute('ALTER TABLE jobs RENAME TO jobs_legacy')
            con.execute('ALTER TABLE photos RENAME TO photos_legacy')
            con.execute('DROP INDEX IF EXISTS jobs_owner_created')
            _create_schema(con)
            con.execute('INSERT INTO photos(id,owner,created_at) SELECT id,owner,created_at FROM photos_legacy')
            # Copy parents before children: retry guards and FKs also apply here.
            retry_expression = 'retry_of' if 'retry_of' in columns else 'NULL'
            select_columns = ','.join('legacy.' + c if c in columns else 'NULL' for c in JOB_COLUMNS)
            con.execute(f"""WITH RECURSIVE ordered(id,depth) AS (
                SELECT id,0 FROM jobs_legacy WHERE {retry_expression} IS NULL
                UNION ALL SELECT child.id,parent.depth+1 FROM jobs_legacy child
                JOIN ordered parent ON child.{'retry_of' if 'retry_of' in columns else 'id'}=parent.id
                WHERE {'1' if 'retry_of' in columns else '0'}
            ) INSERT INTO jobs({','.join(JOB_COLUMNS)})
                SELECT {select_columns} FROM jobs_legacy legacy JOIN ordered ON ordered.id=legacy.id
                ORDER BY ordered.depth,legacy.id""")
            if con.execute('SELECT COUNT(*) FROM jobs').fetchone()[0] != con.execute('SELECT COUNT(*) FROM jobs_legacy').fetchone()[0]:
                raise RuntimeError('PHOTO_VIDEO_INVALID_LEGACY_RETRY_CHAIN')
            con.execute('DROP TABLE jobs_legacy')
            con.execute('DROP TABLE photos_legacy')
        else:
            _create_schema(con)
        _validate(con)
        con.execute(f'PRAGMA user_version={SCHEMA_VERSION}')
    database.chmod(0o600)


def check_database(database: Path):
    with connect(database, readonly=True) as con:
        require_current_schema(con)
        _validate(con)
        return {
            'schemaVersion': SCHEMA_VERSION, 'foreignKeys': 1,
            'foreignKeyViolations': 0, 'integrity': 'ok',
            'photos': con.execute('SELECT COUNT(*) FROM photos').fetchone()[0],
            'jobs': con.execute('SELECT COUNT(*) FROM jobs').fetchone()[0],
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--initialize', action='store_true')
    args = parser.parse_args()
    database = Path(os.environ.get('PHOTO_VIDEO_DATA_DIR', '/data/photo-video')) / 'workflow.sqlite3'
    if args.initialize:
        initialize_schema(database)
    print(json.dumps(check_database(database)))


if __name__ == '__main__':
    main()
