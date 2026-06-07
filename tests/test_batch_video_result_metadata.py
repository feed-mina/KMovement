from pathlib import Path
from types import SimpleNamespace

from deploy.media_motion import batch_video_worker
from deploy.media_motion.schemas import BatchImageItem, BatchTravelCase


def test_batch_result_reports_partial_failure(tmp_path, monkeypatch):
    def generate_photo(item, case_id, output_dir, photo_route, cfg):
        if item.index == 1:
            raise RuntimeError("model failed")
        output = output_dir / f"{case_id}_{item.index}.mp4"
        output.write_bytes(b"video")
        return output, "cogvideox_real"

    def normalize(arguments):
        Path(arguments[-1]).write_bytes(b"normalized")

    def concatenate(_segments, output):
        output.write_bytes(b"concat")

    def fallback_bgm(output_dir, _bgm_key):
        output_dir.mkdir(parents=True, exist_ok=True)
        output = output_dir / "bgm.wav"
        output.write_bytes(b"audio")
        return output

    def apply_bgm(_video, _bgm, output):
        output.write_bytes(b"final")

    monkeypatch.setattr(
        batch_video_worker,
        "_generate_photo_segment",
        generate_photo,
    )
    monkeypatch.setattr(batch_video_worker, "run_ffmpeg", normalize)
    monkeypatch.setattr(batch_video_worker, "concat_videos", concatenate)
    monkeypatch.setattr(batch_video_worker, "ensure_fallback_bgm", fallback_bgm)
    monkeypatch.setattr(batch_video_worker, "apply_bgm_to_video", apply_bgm)

    batch_case = BatchTravelCase(
        case_id="partial",
        place="Community Post",
        items=[
            BatchImageItem(
                index=0,
                image_path=tmp_path / "first.jpg",
                tts_text="",
                image_type="photo",
            ),
            BatchImageItem(
                index=1,
                image_path=tmp_path / "second.jpg",
                tts_text="",
                image_type="photo",
            ),
        ],
        photo_route="cogvideox_real",
    )

    result = batch_video_worker.run_batch_video_case(
        batch_case,
        tmp_path,
        cfg=SimpleNamespace(blip2_enabled=False),
    )

    assert result.status == "success"
    assert result.metadata["processed_images"] == 1
    assert result.metadata["failed_image_indexes"] == [1]
    assert result.metadata["actual_model"] == "cogvideox_real"
