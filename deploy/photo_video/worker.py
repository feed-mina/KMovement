"""Durable local CPU worker. No paid model or remote image publication."""
from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import time
from pathlib import Path


def render_photo(source: Path, target: Path) -> None:
    temporary = target.with_suffix('.partial.mp4')
    try:
        subprocess.run([
            'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
            '-loop', '1', '-i', str(source),
            '-vf', "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0008,1.12)':d=125:s=1280x720:fps=25,format=yuv420p",
            '-frames:v', '125', '-an', '-c:v', 'libx264', '-threads', '2',
            '-preset', 'veryfast', '-movflags', '+faststart', str(temporary),
        ], check=True, capture_output=True, timeout=180)
        info = subprocess.run([
            'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
            'stream=codec_name,width,height:format=duration', '-of', 'json', str(temporary),
        ], check=True, capture_output=True, timeout=15)
        data = json.loads(info.stdout)
        if not data.get('streams') or data['streams'][0].get('codec_name') != 'h264' or not 4.8 <= float(data['format']['duration']) <= 5.2:
            raise ValueError('INVALID_VIDEO')
        temporary.chmod(0o600)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def run_once(root: Path) -> bool:
    database = root / 'workflow.sqlite3'
    if not database.exists():
        return False
    with sqlite3.connect(database, timeout=15) as con:
        con.row_factory = sqlite3.Row
        con.execute('BEGIN IMMEDIATE')
        # Recover abandoned work without silently submitting an external paid job.
        con.execute("UPDATE jobs SET status='FAILED',error_code='WORKER_INTERRUPTED',finished_at=CURRENT_TIMESTAMP WHERE status='RUNNING' AND started_at<datetime('now','-10 minutes')")
        row = con.execute("SELECT * FROM jobs WHERE status='QUEUED' ORDER BY created_at,id LIMIT 1").fetchone()
        if not row:
            return False
        con.execute("UPDATE jobs SET status='RUNNING',started_at=CURRENT_TIMESTAMP WHERE id=?", (row['id'],))
    output = root / f"{row['id']}.mp4"
    started = time.perf_counter()
    try:
        render_photo(root / f"{row['photo_id']}.jpg", output)
        status, error = 'COMPLETED', None
    except subprocess.TimeoutExpired:
        status, error = 'FAILED', 'RENDER_TIMEOUT'
    except Exception:
        status, error = 'FAILED', 'RENDER_FAILED'
    with sqlite3.connect(database, timeout=15) as con:
        con.execute("UPDATE jobs SET status=?,error_code=?,render_ms=?,finished_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND status=?",
                    (status, error, round((time.perf_counter() - started) * 1000), row['id'], 'RUNNING'))
    return True


def main():
    root = Path(os.environ.get('PHOTO_VIDEO_DATA_DIR', '/data/photo-video'))
    while True:
        try:
            worked = run_once(root)
        except sqlite3.OperationalError:
            worked = False
        if not worked:
            time.sleep(2)


if __name__ == '__main__':
    main()
