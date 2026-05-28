# Report Artifact Analysis

This file classifies the Kaggle/Colab/report artifacts under `report/` after the
folder cleanup.

## Deployment Rule

Do not deploy notebooks directly as the production gateway. Use notebooks as
provenance and reference code. Use `deploy/cloud_gateway/` as the deployable
FastAPI package and point `KRIDE_MEDIA_DIR` at the media artifact directory.

The compatibility files below intentionally remain at `report/` top level because
`deploy/media_preview_app.py`, `deploy/README.md`, and the default media-motion
commands expect them there:

```text
report/finally-deploy-yerin.ipynb
report/meta_combined_6.mp4
report/meta_combined_6_Musicgen.mp4
report/meta_combined_6_Musicgen_tts_success.mp4
report/tts_torchaudito_1.wav
report/tts_torchaudito_2.wav
report/tts_torchaudito_3.wav
report/tts_torchaudito_4.wav
report/tts_torchaudito_5.wav
report/gangneung_beach.jpg
report/gwanghwamun.jpg
report/gyeongbokgung.jpg
```

## Current Layout

| Path | Role | Deploy Decision |
| --- | --- | --- |
| `report/analysis/` | Artifact notes and provenance docs. | Documentation only. |
| `report/deliverables/` | Final PPTX, packaged report bundle, and chapter PDFs/DOCX. | Not served by gateway unless explicitly packaged for download. |
| `report/notebooks/` | Colab/Kaggle reference notebooks for AnimatedDrawings, GPT-SoVITS, MusicGen, CogVideoX, and fallback branches. | Reference only. Do not run in preview gateway. |
| `report/media/reference_videos/` | Optional or comparison MP4 artifacts such as 3D Photo Inpainting, CogVideoX sample, TTS-only, and failed/imbalanced mixes. | Keep for comparison and provenance. Label carefully. |
| `report/media/metadata/` | JSON summaries from media generation runs. | Deployable metadata if useful. |
| `report/capture/` | Screenshots and UI captures. | Documentation assets. |
| `report/charts/`, `report/figures/` | Generated report charts and figures. | Keep paths stable because report scripts write here. |
| `report/dataset_report/`, `report/llm_chatbot_rag/`, `report/page-audit-logs/` | Adjacent project reports/logs. | Not part of Track B media gateway. |
| `report/scratch/` | Zero-byte downloads and temporary AnimatedDrawings config leftovers. | Keep out of deploy packages. |

## Source Data Moved From Root

Tracked root-level source data now lives in:

```text
dataset/source/kculture_media/
dataset/source/reference_reports/
docs/project-tree.md
```

`src/db/load_kcisa_kpop_data.py` reads
`dataset/source/kculture_media/kcisa_media_locations_2023.csv`.

## Cloud-Ready Package

Use:

```text
deploy/cloud_gateway/
```

Key files:

```text
deploy/cloud_gateway/app.py
deploy/cloud_gateway/requirements.txt
deploy/cloud_gateway/Dockerfile
deploy/cloud_gateway/log_gateway_to_mlflow.py
deploy/cloud_gateway/README.md
```

## Media-Motion Worker Package

Generation-side code is separate from the gateway:

```text
deploy/media_motion/
```

Key files:

```text
deploy/media_motion/run_cases.py
deploy/media_motion/three_d_photo_light.py
deploy/media_motion/cogvideo_fallback.py
deploy/media_motion/meta_animation.py
deploy/media_motion/ffmpeg_utils.py
deploy/media_motion/tts.py
deploy/media_motion/bgm.py
deploy/media_motion/routers.py
deploy/media_motion/README.md
```

## Labeling Rules

- `CogVideoX branch fallback` is not the same as `CogVideoX model output`.
- `3D Photo Light` is a lightweight static-photo pan/zoom/dolly branch.
- `AnimatedDrawings` is the character/animation branch, not the 3D Photo
  Inpainting branch.
- Gateway deployment should say `model_generation_enabled=false` until workers
  are attached.
