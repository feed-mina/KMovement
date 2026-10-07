"""Two-process-safe admission for services sharing a local Linux lock directory."""
import asyncio
import os
from pathlib import Path

class SharedSlots:
    def __init__(self, limit=2):
        self.limit=limit
        self.local=asyncio.Semaphore(limit)
        self.held=[]

    async def acquire(self):
        await self.local.acquire()
        fd=None
        try:
            directory=os.environ.get('KRIDE_ADMISSION_LOCK_DIR','')
            if not directory:
                self.held.append(None)
                return True
            import fcntl
            Path(directory).mkdir(parents=True,exist_ok=True)
            while True:
                for i in range(self.limit):
                    fd=os.open(str(Path(directory)/f'admission-{i}.lock'),os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
                    try:
                        fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
                    except BlockingIOError:
                        os.close(fd);fd=None
                        continue
                    self.held.append(fd)
                    return True
                await asyncio.sleep(.01)
        except BaseException:
            if fd is not None:os.close(fd)
            self.local.release()
            raise

    def release(self):
        if not self.held:raise RuntimeError('admission_release_without_acquire')
        fd=self.held.pop()
        if fd is not None:os.close(fd)
        self.local.release()
