from __future__ import annotations

import hmac
import io
import os
import sqlite3
import uuid
import warnings
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field

from deploy.photo_video.database import connect as database_connect, initialize_schema


class TripContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    itineraryId: str = Field(pattern=r'^[0-9a-f]{32}$')
    catalogRevision: str = Field(pattern=r'^[0-9a-f]{64}$')
    poiId: str = Field(min_length=1, max_length=150)
    placeName: str = Field(min_length=1, max_length=500)
    placeAddress: str = Field(max_length=1000)
    contextIssuedAt: str = Field(max_length=50)
    notice: str = Field(max_length=500)


class JobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    photoId: uuid.UUID
    requestId: uuid.UUID
    trip: TripContext | None = None


class RetryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requestId: uuid.UUID

MAX_UPLOAD = 10 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 24_000_000


def create_app(root: Path | None = None) -> FastAPI:
    storage = root or Path(os.environ.get("PHOTO_VIDEO_DATA_DIR", "/data/photo-video"))
    storage.mkdir(parents=True, exist_ok=True)
    storage.chmod(0o700)
    database = storage / "workflow.sqlite3"

    def connect():
        return database_connect(database)

    initialize_schema(database)

    app = FastAPI(title="KMovement private photo video", docs_url=None, redoc_url=None)
    app.state.storage = storage
    app.state.connect = connect

    @app.exception_handler(sqlite3.IntegrityError)
    async def invalid_reference(request: Request, exc: sqlite3.IntegrityError):
        return JSONResponse(status_code=409, content={"detail": "사진·작업 연결을 확인해주세요."})

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

    def job_response(row):
        import json
        duration = row["render_ms"]
        return {"jobId": row["id"], "photoId": row["photo_id"], "status": row["status"],
                "createdAt": row["created_at"], "startedAt": row["started_at"],
                "finishedAt": row["finished_at"], "errorCode": row["error_code"],
                "renderMilliseconds": duration, "retryOf": row["retry_of"],
                "trip": json.loads(row["trip_json"]) if row["trip_json"] else None,
                "cost": {"providerCharge": 0, "currency": "USD", "infrastructureCost": None,
                         "note": "외부 생성 모델 비용 없음. 서버·저장소·전송 비용은 미산정."},
                "videoUrl": f"/api/travel-video/jobs/{row['id']}/video" if row["status"] == "COMPLETED" else None,
                "method": "photo_motion", "methodLabel": "사진 확대·이동 영상 (생성형 AI 아님)"}

    def enqueue(body: JobRequest, user: int, retry_of: str | None = None):
        import json
        trip_json = json.dumps(body.trip.model_dump(), ensure_ascii=False, sort_keys=True) if body.trip else None
        with connect() as con:
            con.execute("BEGIN IMMEDIATE")
            old = con.execute("SELECT * FROM jobs WHERE owner=? AND request_id=?", (user, str(body.requestId))).fetchone()
            if old:
                if old["photo_id"] != str(body.photoId) or old["retry_of"] != retry_of or old["trip_json"] != trip_json:
                    raise HTTPException(409, "같은 요청 번호에 다른 사진을 사용할 수 없습니다.")
                return job_response(old)
            if retry_of:
                original = con.execute("SELECT status FROM jobs WHERE id=? AND owner=?", (retry_of, user)).fetchone()
                if not original:
                    raise HTTPException(404, "작업을 찾을 수 없습니다.")
                if original["status"] != "FAILED":
                    raise HTTPException(409, "실패한 작업만 새 작업으로 다시 시도할 수 있습니다.")
                newer = con.execute("SELECT id FROM jobs WHERE retry_of=? AND status IN ('QUEUED','RUNNING','COMPLETED')", (retry_of,)).fetchone()
                if newer:
                    raise HTTPException(409, "이미 다시 시도한 작업이 있습니다. 이전 작업 목록에서 확인해주세요.")
            photo = con.execute("SELECT id FROM photos WHERE id=? AND owner=?", (str(body.photoId), user)).fetchone()
            if not photo:
                raise HTTPException(404, "사진을 찾을 수 없습니다.")
            active = con.execute("SELECT COUNT(*) FROM jobs WHERE owner=? AND status IN ('QUEUED','RUNNING')", (user,)).fetchone()[0]
            daily = con.execute("SELECT COUNT(*) FROM jobs WHERE owner=? AND created_at>=datetime('now','+9 hours','start of day','-9 hours')", (user,)).fetchone()[0]
            if active >= 2 or daily >= 10:
                raise HTTPException(429, "동시 2개·하루 10개 생성 한도를 확인해주세요.")
            job_id = str(uuid.uuid4())
            con.execute("INSERT INTO jobs(id,owner,photo_id,request_id,retry_of,trip_json) VALUES (?,?,?,?,?,?)", (job_id, user, str(body.photoId), str(body.requestId), retry_of, trip_json))
            return job_response(con.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())

    @app.post("/jobs", status_code=202)
    def submit(body: JobRequest, user: int = Depends(owner)):
        return enqueue(body, user)

    @app.post("/jobs/{job_id}/retry", status_code=202)
    def retry(job_id: uuid.UUID, body: RetryRequest, user: int = Depends(owner)):
        import json
        with connect() as con:
            row = con.execute("SELECT photo_id,trip_json FROM jobs WHERE id=? AND owner=?", (str(job_id), user)).fetchone()
        if not row:
            raise HTTPException(404, "작업을 찾을 수 없습니다.")
        return enqueue(JobRequest(photoId=row["photo_id"], requestId=body.requestId,
                                  trip=json.loads(row["trip_json"]) if row["trip_json"] else None), user, str(job_id))

    @app.get("/jobs/{job_id}")
    def status(job_id: uuid.UUID, user: int = Depends(owner)):
        with connect() as con:
            row = con.execute("SELECT * FROM jobs WHERE id=? AND owner=?", (str(job_id), user)).fetchone()
        if not row:
            raise HTTPException(404, "작업을 찾을 수 없습니다.")
        return job_response(row)

    @app.get("/jobs")
    def history(user: int = Depends(owner), page: int = 1):
        if not 1 <= page <= 10000:
            raise HTTPException(422, "페이지 번호를 확인해주세요.")
        with connect() as con:
            rows = con.execute("SELECT * FROM jobs WHERE owner=? ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?", (user, (page - 1) * 20)).fetchall()
        return {"items": [job_response(row) for row in rows], "page": page}

    @app.get("/jobs/{job_id}/video")
    def video(job_id: uuid.UUID, user: int = Depends(owner)):
        with connect() as con:
            row = con.execute("SELECT status FROM jobs WHERE id=? AND owner=?", (str(job_id), user)).fetchone()
        if not row:
            raise HTTPException(404, "영상을 찾을 수 없습니다.")
        path = storage / f"{job_id}.mp4"
        if row["status"] != "COMPLETED" or not path.is_file():
            raise HTTPException(409, "아직 재생할 수 있는 영상이 없습니다.")
        return FileResponse(path, media_type="video/mp4", filename=f"travel-{job_id}.mp4", content_disposition_type="inline")

    return app
