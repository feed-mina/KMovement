from __future__ import annotations

import hmac
import io
import os
import sqlite3
import uuid
import warnings
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD = 10 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 24_000_000


def create_app(root: Path | None = None) -> FastAPI:
    storage = root or Path(os.environ.get("PHOTO_VIDEO_DATA_DIR", "/data/photo-video"))
    storage.mkdir(parents=True, exist_ok=True)
    storage.chmod(0o700)
    database = storage / "workflow.sqlite3"

    def connect():
        con = sqlite3.connect(database, timeout=15)
        con.row_factory = sqlite3.Row
        return con

    with connect() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS photos (
            id TEXT PRIMARY KEY, owner INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")

    app = FastAPI(title="KMovement private photo video", docs_url=None, redoc_url=None)
    app.state.storage = storage
    app.state.connect = connect

    def owner(
        key: str = Header(default="", alias="X-Photo-Video-Key"),
        user: str = Header(default="", alias="X-Photo-Video-Owner"),
    ) -> int:
        expected = os.environ.get("PHOTO_VIDEO_INTERNAL_KEY", "")
        if len(expected) < 32:
            raise HTTPException(503, "사진 영상 서버 설정이 필요합니다.")
        if not hmac.compare_digest(key, expected):
            raise HTTPException(401, "로그인이 필요합니다.")
        if not user.isascii() or not user.isdigit() or not 0 < int(user) < 2**53:
            raise HTTPException(401, "로그인이 필요합니다.")
        return int(user)

    @app.middleware("http")
    async def private_response(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.post("/photos", status_code=201)
    async def upload(request: Request, user: int = Depends(owner)):
        if request.headers.get("content-type", "").split(";")[0] not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(415, "JPEG·PNG·WebP 사진만 사용할 수 있습니다.")
        data = bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > MAX_UPLOAD:
                raise HTTPException(413, "사진은 10MB 이하로 선택해주세요.")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as image:
                    if image.format not in {"JPEG", "PNG", "WEBP"}:
                        raise ValueError("unsupported")
                    image.load()
                    clean = ImageOps.exif_transpose(image).convert("RGB")
                    clean.thumbnail((1920, 1920))
                    normalized = io.BytesIO()
                    clean.save(normalized, format="JPEG", quality=90)
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise HTTPException(422, "읽을 수 있는 사진 파일인지 확인해주세요.")
        photo_id = str(uuid.uuid4())
        path = storage / f"{photo_id}.jpg"
        try:
            with connect() as con:
                con.execute("BEGIN IMMEDIATE")
                count = con.execute("SELECT COUNT(*) FROM photos WHERE owner=?", (user,)).fetchone()[0]
                if count >= 20:
                    raise HTTPException(429, "현재 사진 보관 한도는 20장입니다.")
                with path.open("xb") as output:
                    output.write(normalized.getvalue())
                path.chmod(0o600)
                con.execute("INSERT INTO photos(id,owner) VALUES (?,?)", (photo_id, user))
        except Exception:
            path.unlink(missing_ok=True)
            raise
        return {"photoId": photo_id}

    @app.get("/photos/{photo_id}")
    def photo(photo_id: uuid.UUID, user: int = Depends(owner)):
        with connect() as con:
            row = con.execute("SELECT id FROM photos WHERE id=? AND owner=?", (str(photo_id), user)).fetchone()
        if not row:
            raise HTTPException(404, "사진을 찾을 수 없습니다.")
        return FileResponse(storage / f"{photo_id}.jpg", media_type="image/jpeg")

    return app
