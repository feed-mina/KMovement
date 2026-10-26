"""Real Next -> authenticated private API -> worker -> Range playback smoke test.

Run after npm run build with PHOTO_VIDEO_HTTP_E2E=1. Uses only local fixtures.
"""
import io
import json
import os
import socket
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx
import pytest
from PIL import Image


@pytest.mark.skipif(os.environ.get('PHOTO_VIDEO_HTTP_E2E') != '1', reason='requires built Next frontend')
def test_real_next_to_private_video(tmp_path):
    root = Path(__file__).resolve().parents[1]
    web = root / 'subproject/SDUI/metadata-project'

    class Identity(BaseHTTPRequestHandler):
        def do_GET(self):
            cookie = self.headers.get('Cookie', '')
            user = 1 if 'fixture-user=1' in cookie else 2 if 'fixture-user=2' in cookie else None
            body = json.dumps({'isLoggedIn': bool(user), 'userSqno': user}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    def port():
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            return sock.getsockname()[1]

    auth = ThreadingHTTPServer(('127.0.0.1', 0), Identity)
    thread = threading.Thread(target=auth.serve_forever, daemon=True)
    thread.start()
    api_port, web_port = port(), port()
    origin = f'http://127.0.0.1:{web_port}'
    env = {**os.environ, 'PHOTO_VIDEO_DATA_DIR': str(tmp_path / 'private'),
           'PHOTO_VIDEO_INTERNAL_KEY': 'local-fixture-key-' * 4, 'PHOTO_VIDEO_ENABLED': 'true',
           'PHOTO_VIDEO_URL': f'http://127.0.0.1:{api_port}', 'PHOTO_VIDEO_PUBLIC_ORIGIN': origin,
           'AUTH_BACKEND_URL': f'http://127.0.0.1:{auth.server_port}', 'FASTAPI_URL': 'http://127.0.0.1:8000'}
    processes = []
    logs = []
    try:
        for command, cwd in [
            ([sys.executable, '-m', 'uvicorn', 'deploy.photo_video.app:create_app', '--factory', '--host', '127.0.0.1', '--port', str(api_port)], root),
            ([sys.executable, '-m', 'deploy.photo_video.worker'], root),
            (['node', 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', str(web_port)], web),
        ]:
            log = (tmp_path / f'process-{len(processes)}.log').open('w+')
            logs.append(log)
            processes.append(subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT))
        with httpx.Client(timeout=15, trust_env=False) as client:
            deadline = time.monotonic() + 40
            while True:
                try:
                    ready = client.get(origin + '/travel/video')
                    if ready.status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                assert time.monotonic() < deadline, 'local frontend did not start'
                time.sleep(.2)
            assert '내 영상' in ready.text
            endpoint = origin + '/api/travel-video'
            assert client.get(endpoint + '/jobs').status_code == 401
            headers = {'Cookie': 'fixture-user=1', 'Origin': origin}
            image = io.BytesIO()
            Image.new('RGB', (320, 240), '#7099cc').save(image, 'PNG')
            photo = client.post(endpoint + '/photos', content=image.getvalue(), headers={**headers, 'Content-Type': 'image/png'})
            assert photo.status_code == 201, photo.text
            photo_id = photo.json()['photoId']
            assert client.get(endpoint + '/photos/' + photo_id, headers={'Cookie': 'fixture-user=2'}).status_code == 404
            request = {'photoId': photo_id, 'requestId': str(uuid.uuid4())}
            response = client.post(endpoint + '/jobs', json=request, headers=headers)
            assert response.status_code == 202, response.text
            job = response.json()['jobId']
            assert client.post(endpoint + '/jobs', json=request, headers=headers).json()['jobId'] == job
            deadline = time.monotonic() + 35
            while True:
                state = client.get(endpoint + '/jobs/' + job, headers=headers).json()
                assert state['status'] != 'FAILED', state
                if state['status'] == 'COMPLETED':
                    break
                assert time.monotonic() < deadline, state
                time.sleep(.2)
            result = client.get(origin + state['videoUrl'], headers={**headers, 'Range': 'bytes=0-63'})
            assert result.status_code == 206, result.text
            assert len(result.content) == 64 and b'ftyp' in result.content
            assert result.headers['cache-control'] == 'private, no-store'
            assert client.get(origin + state['videoUrl'], headers={'Cookie': 'fixture-user=2'}).status_code == 404
    finally:
        for process in reversed(processes):
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        for log in logs:
            log.close()
        auth.shutdown()
        auth.server_close()
