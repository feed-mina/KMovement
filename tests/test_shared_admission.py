import asyncio
import os
import subprocess
import sys
import pytest
from src.api.shared_admission import SharedSlots

def test_local_default_keeps_two_and_releases(monkeypatch):
    monkeypatch.delenv('KRIDE_ADMISSION_LOCK_DIR',raising=False)
    monkeypatch.delenv('ITINERARY_TEST_LIMIT_USERS',raising=False)
    async def scenario():
        s=SharedSlots();await s.acquire();await s.acquire()
        with pytest.raises(asyncio.TimeoutError):await asyncio.wait_for(s.acquire(),.03)
        s.release();await s.acquire();s.release();s.release()
        assert s.local._value==2
    asyncio.run(scenario())

def test_test_profile_requires_shared_directory(monkeypatch):
    monkeypatch.delenv('KRIDE_ADMISSION_LOCK_DIR',raising=False)
    monkeypatch.setenv('ITINERARY_TEST_LIMIT_USERS','7')
    async def scenario():
        s=SharedSlots()
        with pytest.raises(RuntimeError,match='shared_admission_unconfigured'):await s.acquire()
        assert s.local._value==2 and not s.held
    asyncio.run(scenario())

@pytest.mark.skipif(sys.platform=='win32',reason='Linux flock deployment contract')
def test_shared_process_slots_and_cancel_do_not_leak(monkeypatch,tmp_path):
    monkeypatch.setenv('KRIDE_ADMISSION_LOCK_DIR',str(tmp_path))
    code='import asyncio,sys;from src.api.shared_admission import SharedSlots;s=SharedSlots();asyncio.run(s.acquire());asyncio.run(s.acquire());print("ready",flush=True);sys.stdin.readline()'
    child=subprocess.Popen([sys.executable,'-c',code],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,env=os.environ.copy())
    try:
        assert child.stdout.readline().strip()=='ready'
        async def scenario():
            s=SharedSlots()
            with pytest.raises(asyncio.TimeoutError):await asyncio.wait_for(s.acquire(),.04)
            assert s.local._value==2 and not s.held
            child.stdin.write('\n');child.stdin.flush();child.wait(timeout=5)
            await asyncio.wait_for(s.acquire(),1);await asyncio.wait_for(s.acquire(),1)
            s.release();s.release()
        asyncio.run(scenario())
    finally:
        if child.poll() is None:child.kill();child.wait()
