from pathlib import Path
from types import SimpleNamespace

from deploy.media_motion import ffmpeg_utils, tora_cogvideox_real
from deploy.media_motion.schemas import TravelCase


def test_overlay_gif_uses_transparency_and_relative_scale(tmp_path, monkeypatch):
    captured = {}

    def fake_ffmpeg(arguments):
        captured["arguments"] = arguments
        Path(arguments[-1]).write_bytes(b"video")

    monkeypatch.setattr(ffmpeg_utils, "run_ffmpeg", fake_ffmpeg)

    output = ffmpeg_utils.overlay_gif_on_video(
        tmp_path / "base.mp4",
        tmp_path / "doodle.gif",
        tmp_path / "result.mp4",
        position="10:10",
        scale=None,
        scale_ratio=0.2,
        remove_white_background=True,
    )

    filter_complex = captured["arguments"][
        captured["arguments"].index("-filter_complex") + 1
    ]
    assert "colorkey=0xFFFFFF" in filter_complex
    assert "scale2ref=w=main_w*0.2" in filter_complex
    assert "overlay=10:10" in filter_complex
    assert output.exists()


def test_tora_overlay_reports_tora_as_actual_model(tmp_path, monkeypatch):
    photo = tmp_path / "photo.jpg"
    doodle = tmp_path / "doodle.png"
    bgm = tmp_path / "bgm.wav"
    photo.write_bytes(b"photo")
    doodle.write_bytes(b"doodle")
    bgm.write_bytes(b"bgm")

    def create_tora(_case, output, _cfg):
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"tora")
        return output

    def create_doodle(case, output_dir, _cfg):
        work_dir = output_dir / f"{case.case_id}_animated_drawings_work"
        work_dir.mkdir(parents=True, exist_ok=True)
        (work_dir / "video.gif").write_bytes(b"gif")
        output = output_dir / f"{case.case_id}.mp4"
        output.write_bytes(b"doodle-video")
        return output

    def overlay(_video, _gif, output, **_kwargs):
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"overlay")
        return output

    def narration(_text, output, _cfg):
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"tts")
        return output, "gtts"

    def resolve_bgm(_case, sine_bgm, _bgm_dir, _cfg):
        return sine_bgm, "sine"

    def mix(_video, _tts, _bgm, output):
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"final")
        return output

    monkeypatch.setattr(
        tora_cogvideox_real, "create_tora_cogvideox_video", create_tora,
    )
    monkeypatch.setattr(
        tora_cogvideox_real, "run_animated_drawings_pipeline", create_doodle,
    )
    monkeypatch.setattr(tora_cogvideox_real, "overlay_gif_on_video", overlay)
    monkeypatch.setattr(tora_cogvideox_real, "_synthesize_narration", narration)
    monkeypatch.setattr(tora_cogvideox_real, "_resolve_bgm", resolve_bgm)
    monkeypatch.setattr(tora_cogvideox_real, "mix_video_tts_bgm", mix)

    result = tora_cogvideox_real.run_tora_doodle_overlay_case(
        TravelCase(
            case_id="post41",
            place="Community Post",
            image_path=photo,
            tts_text="test",
            trajectory_preset="object_pan_right",
        ),
        doodle,
        tmp_path / "output",
        bgm,
        cfg=SimpleNamespace(cogvideox_model_id="zai-org/CogVideoX-5b-I2V"),
    )

    assert result.status == "success"
    assert result.metadata["actual_model"] == "alibaba/Tora (CogVideoX-5B-I2V)"
    assert result.metadata["base_model_id"] == "zai-org/CogVideoX-5b-I2V"
    assert result.metadata["doodle_overlay_executed"] is True
    assert result.metadata["overlay_scale_ratio"] == 0.2
