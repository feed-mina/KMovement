from __future__ import annotations

import argparse
import json
from pathlib import Path

from .animated_drawings_worker import run_animated_drawings_worker_case
from .bgm import ensure_fallback_bgm
from .cogvideo_fallback import run_cogvideo_fallback_case
from .cogvideox_real import run_cogvideox_real_case
from .gpt_sovits_worker import run_gpt_sovits_tts_case
from .meta_animation import register_existing_meta_animation
from .schemas import TravelCase
from .three_d_photo_light import run_3d_photo_light_case
from .three_d_photo_real import run_3d_photo_inpainting_real_case
from .worker_config import load_worker_config


ROUTES = [
    "3d_photo_light",
    "3d_photo_inpainting_real",
    "cogvideo_fallback",
    "cogvideox_real",
    "gpt_sovits_tts",
    "animated_drawings_worker",
    "meta_animation",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run K-Ride media-motion model/fallback workers.")
    parser.add_argument("--input-dir", default="report", help="Folder containing travel photos and existing media.")
    parser.add_argument("--output-dir", default="outputs/media_motion", help="Folder to write generated artifacts.")
    parser.add_argument("--route", choices=ROUTES, required=True)
    parser.add_argument("--case-id", default="gangneung_beach")
    parser.add_argument("--place", default="Gangneung Beach")
    parser.add_argument("--image", default="gangneung_beach.jpg")
    parser.add_argument("--tts", default="A bright travel narration for Gangneung Beach.")
    parser.add_argument("--bgm-key", default="bright_travel")
    parser.add_argument("--motion", default="slow_zoom_in")
    parser.add_argument("--prompt", default="")
    parser.add_argument("--source-mp4", default="meta_combined_6.mp4")
    parser.add_argument("--allow-fallback", action=argparse.BooleanOptionalAction, default=True)
    return parser.parse_args()


def build_case(args: argparse.Namespace, input_dir: Path) -> TravelCase:
    return TravelCase(
        case_id=args.case_id,
        place=args.place,
        image_path=input_dir / args.image,
        tts_text=args.tts,
        bgm_key=args.bgm_key,
        prompt=args.prompt,
        motion=args.motion,
    )


def main() -> None:
    # STEP 1. Resolve runtime inputs and worker configuration.
    args = parse_args()
    input_dir = Path(args.input_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    cfg = load_worker_config(allow_fallback=args.allow_fallback)

    # STEP 2. Prepare shared BGM for video-producing workers.
    needs_bgm = args.route not in {"meta_animation", "gpt_sovits_tts"}
    bgm_wav = ensure_fallback_bgm(output_dir / "bgm", args.bgm_key) if needs_bgm else None

    # STEP 3. Dispatch to selected model/fallback worker.
    if args.route == "meta_animation":
        result = register_existing_meta_animation(input_dir / args.source_mp4, output_dir, case_id=args.case_id)
    elif args.route == "gpt_sovits_tts":
        result = run_gpt_sovits_tts_case(case_id=args.case_id, text=args.tts, output_root=output_dir, cfg=cfg)
    else:
        case = build_case(args, input_dir)
        if args.route == "3d_photo_light":
            assert bgm_wav is not None
            result = run_3d_photo_light_case(case, output_dir, bgm_wav)
        elif args.route == "3d_photo_inpainting_real":
            assert bgm_wav is not None
            result = run_3d_photo_inpainting_real_case(case, output_dir, bgm_wav, cfg=cfg)
        elif args.route == "cogvideo_fallback":
            assert bgm_wav is not None
            result = run_cogvideo_fallback_case(case, output_dir, bgm_wav)
        elif args.route == "cogvideox_real":
            assert bgm_wav is not None
            result = run_cogvideox_real_case(case, output_dir, bgm_wav, cfg=cfg)
        elif args.route == "animated_drawings_worker":
            assert bgm_wav is not None
            result = run_animated_drawings_worker_case(case, output_dir, bgm_wav, cfg=cfg)
        else:
            raise ValueError(f"unsupported route: {args.route}")

    # STEP 4. Persist machine-readable result for gateway/DagsHub logging.
    result_path = output_dir / f"{args.case_id}_{args.route}_result.json"
    result_path.write_text(json.dumps(result.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    print("result_json:", result_path)


if __name__ == "__main__":
    main()
