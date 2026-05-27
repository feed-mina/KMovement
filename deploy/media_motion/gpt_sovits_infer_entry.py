from __future__ import annotations

import argparse
import importlib.machinery
import os
import pkgutil
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Isolated GPT-SoVITS inference entrypoint.")
    parser.add_argument("--gpt-dir", required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--prompt-text", required=True)
    parser.add_argument("--ref-wav", default="")
    parser.add_argument("--gpt-weights", default="GPT_SoVITS/pretrained_models/s1v3.ckpt")
    parser.add_argument("--sovits-weights", default="GPT_SoVITS/pretrained_models/s2Gv3.pth")
    return parser.parse_args()


def patch_python_312_compat() -> None:
    if not hasattr(pkgutil, "ImpImporter"):
        pkgutil.ImpImporter = type("ImpImporter", (), {})

    if not hasattr(importlib.machinery.FileFinder, "find_module"):
        def _find_module(self, fullname, path=None):
            spec = self.find_spec(fullname)
            return spec.loader if spec else None

        importlib.machinery.FileFinder.find_module = _find_module


def patch_torchaudio_with_soundfile() -> None:
    import types
    import importlib.util
    import soundfile as sf
    import torch

    def safe_load(filename, *args, **kwargs):
        audio, sr = sf.read(filename, always_2d=True)
        audio = torch.from_numpy(audio.T).float()
        return audio, sr

    class SafeResample:
        def __init__(self, orig_freq, new_freq, *args, **kwargs):
            self.orig_freq = int(orig_freq)
            self.new_freq = int(new_freq)

        def __call__(self, audio):
            if self.orig_freq == self.new_freq:
                return audio
            import torch.nn.functional as F

            new_len = max(1, int(audio.shape[-1] * self.new_freq / self.orig_freq))
            return F.interpolate(
                audio.unsqueeze(0),
                size=new_len,
                mode="linear",
                align_corners=False,
            ).squeeze(0)

    fake = types.ModuleType("torchaudio")
    fake.__spec__ = importlib.util.spec_from_loader("torchaudio", loader=None)
    fake.load = safe_load
    fake.transforms = types.SimpleNamespace(Resample=SafeResample)
    sys.modules["torchaudio"] = fake


def ensure_ref_wav(ref_wav: Path, prompt_text: str) -> Path:
    if ref_wav.exists():
        return ref_wav

    from gtts import gTTS

    ref_wav.parent.mkdir(parents=True, exist_ok=True)
    ref_mp3 = ref_wav.with_suffix(".mp3")
    gTTS(prompt_text, lang="ko").save(str(ref_mp3))
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(ref_mp3),
            "-ar",
            "16000",
            "-ac",
            "1",
            str(ref_wav),
            "-loglevel",
            "quiet",
        ],
        check=True,
    )
    return ref_wav


def main() -> None:
    args = parse_args()
    gpt_dir = Path(args.gpt_dir).resolve()
    output = Path(args.output).resolve()
    ref_wav = Path(args.ref_wav).resolve() if args.ref_wav else gpt_dir / "ref_v6_fixed.wav"

    os.environ.setdefault("TRANSFORMERS_NO_TORCHVISION", "1")
    os.environ.setdefault("TRANSFORMERS_NO_IMAGE_PROCESSING", "1")
    patch_python_312_compat()
    patch_torchaudio_with_soundfile()

    os.chdir(gpt_dir)
    for path in [gpt_dir, gpt_dir / "GPT_SoVITS"]:
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)

    try:
        from BigVGAN import bigvgan
    except ImportError:
        import bigvgan

    if hasattr(bigvgan.BigVGAN, "_from_pretrained") and not getattr(bigvgan.BigVGAN, "_is_patched", False):
        original = bigvgan.BigVGAN._from_pretrained.__func__

        @classmethod
        def patched_from_pretrained(cls, *patch_args, **kwargs):
            kwargs.setdefault("proxies", None)
            kwargs.setdefault("resume_download", False)
            return original(cls, *patch_args, **kwargs)

        bigvgan.BigVGAN._from_pretrained = patched_from_pretrained
        bigvgan.BigVGAN._is_patched = True

    import inference_webui
    from inference_webui import change_gpt_weights, change_sovits_weights, dict_language, get_tts_wav

    # Re-apply after importing GPT-SoVITS.
    import torchaudio

    inference_webui.torchaudio.load = torchaudio.load
    inference_webui.torchaudio.transforms.Resample = torchaudio.transforms.Resample

    dict_language["ko"] = "all_ko"
    dict_language["한국어"] = "all_ko"

    class DummyData:
        sampling_rate = 32000

    class DummyHPS:
        data = DummyData()

    inference_webui.hps = DummyHPS()

    import text.korean
    from mecab import MeCab
    import mecab_ko_dic

    try:
        dic_path = mecab_ko_dic.dictionary_path
    except AttributeError:
        dic_path = "/usr/local/lib/python3.12/dist-packages/mecab_ko_dic/dicdir"
    text.korean._g2p.mecab = MeCab(dictionary_path=dic_path)

    gpt_loader = change_gpt_weights(args.gpt_weights)
    if hasattr(gpt_loader, "__iter__") and not isinstance(gpt_loader, str):
        for _ in gpt_loader:
            pass

    sovits_loader = change_sovits_weights(args.sovits_weights, "ko", "ko")
    if hasattr(sovits_loader, "__iter__") and not isinstance(sovits_loader, str):
        for _ in sovits_loader:
            pass

    ensure_ref_wav(ref_wav, args.prompt_text)

    generator = get_tts_wav(
        ref_wav_path=str(ref_wav),
        prompt_text=args.prompt_text,
        prompt_language="ko",
        text=args.text,
        text_language="ko",
    )

    sr, audio_data = next(generator)

    import soundfile as sf

    output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output), audio_data, sr)
    print(f"wrote:{output}")


if __name__ == "__main__":
    main()
