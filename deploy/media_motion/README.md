# K-Ride Media-Motion Workers

This package contains the generation-side worker code for K-Ride Track B.

It is intentionally separate from `deploy/cloud_gateway/`:

- `cloud_gateway` serves files and optionally launches a worker subprocess.
- `media_motion` generates or registers media artifacts.
- Heavy model imports stay inside route-specific worker modules.

## Routes

| Route | Purpose | Real Model Status |
| --- | --- | --- |
| `cogvideox_real` | Real photo -> CogVideoX image-to-video -> TTS/BGM mix | Uses `diffusers.CogVideoXImageToVideoPipeline` when installed. Falls back if allowed. |
| `3d_photo_inpainting_real` | Real photo -> external full 3D Photo Inpainting/depth command -> TTS/BGM mix | Calls a configured command through env vars. Falls back if allowed. |
| `gpt_sovits_tts` | Text -> GPT-SoVITS Korean TTS WAV | Runs GPT-SoVITS in an isolated subprocess. Falls back to `gTTS` if allowed. |
| `animated_drawings_worker` | Drawing/photo -> AnimatedDrawings/TorchServe pipeline -> TTS/BGM mix | Calls an existing AnimatedDrawings runtime. |
| `3d_photo_light` | Real static photo -> lightweight pan/zoom/dolly -> TTS/BGM mix | Stable fallback/static-photo branch. |
| `cogvideo_fallback` | Real photo CogVideoX branch fallback | Explicitly records `actual_model_executed=false`. |
| `meta_animation` | Register/copy an existing meta-animation MP4 | For already generated animation artifacts. |

## Base Install

```bash
pip install -r deploy/media_motion/requirements.txt
```

System dependency:

```bash
ffmpeg
```

For DagsHub logging:

```bash
pip install -r deploy/media_motion/requirements-logging.txt
```

## CogVideoX Real Worker

Install PyTorch for the target CUDA image first, then:

```bash
pip install -r deploy/media_motion/requirements-cogvideox.txt
```

Run:

```bash
python -m deploy.media_motion.run_cases \
  --route cogvideox_real \
  --input-dir report \
  --output-dir outputs/media_motion \
  --case-id gwanghwamun \
  --place "Gwanghwamun" \
  --image gwanghwamun.jpg \
  --tts "A cinematic travel narration for Gwanghwamun." \
  --bgm-key cinematic_memory \
  --prompt "A cinematic AI-generated travel video from a real photo of Gwanghwamun."
```

Useful env vars:

```bash
export KRIDE_COGVIDEOX_MODEL_ID="THUDM/CogVideoX-2b"
export KRIDE_COGVIDEOX_STEPS=30
export KRIDE_COGVIDEOX_NUM_FRAMES=49
export KRIDE_COGVIDEOX_CPU_OFFLOAD=true
export KRIDE_WORKER_ALLOW_FALLBACK=true
```

## 3D Photo Inpainting Real Worker

This adapter calls your full 3D Photo Inpainting/depth/mesh command. Provide either a JSON command template or a shell-style command template.

Recommended JSON template:

```bash
export KRIDE_3D_PHOTO_COMMAND_JSON='[
  "python",
  "/opt/3d-photo-inpainting/main.py",
  "--input",
  "{image}",
  "--output_dir",
  "{output_dir}",
  "--output",
  "{output_mp4}"
]'
```

Run:

```bash
python -m deploy.media_motion.run_cases \
  --route 3d_photo_inpainting_real \
  --input-dir report \
  --output-dir outputs/media_motion \
  --case-id gangneung_beach \
  --place "Gangneung Beach" \
  --image gangneung_beach.jpg \
  --tts "A bright travel narration for Gangneung Beach." \
  --bgm-key bright_travel
```

If the command fails and fallback is enabled, the worker records the real-model error and returns `3d_photo_light`.

## GPT-SoVITS TTS Worker

The worker runs GPT-SoVITS in a subprocess so fragile dependencies do not pollute the gateway process.

```bash
export KRIDE_GPT_SOVITS_DIR="/content/kride_work/GPT-SoVITS"
export KRIDE_GPT_SOVITS_PYTHON="python"
export KRIDE_GPT_SOVITS_REF_WAV="/content/kride_work/GPT-SoVITS/ref_v6_fixed.wav"
```

Run:

```bash
python -m deploy.media_motion.run_cases \
  --route gpt_sovits_tts \
  --output-dir outputs/media_motion \
  --case-id intro_ko \
  --tts "Annyeonghaseyo. This is a deployment smoke test."
```

For Korean narration, pass the Korean text directly from a UTF-8 terminal or notebook.

## AnimatedDrawings Worker

Point the worker at an already prepared AnimatedDrawings runtime.

```bash
export KRIDE_ANIMATED_DRAWINGS_DIR="/kaggle/working/AnimatedDrawings"
export KRIDE_ANIMATED_DRAWINGS_PYTHON="/kaggle/working/miniconda/envs/ad_env/bin/python"
export KRIDE_ANIMATED_DRAWINGS_MOTION="/kaggle/working/AnimatedDrawings/examples/config/motion/dab.yaml"
export KRIDE_ANIMATED_DRAWINGS_RETARGET="/kaggle/working/AnimatedDrawings/examples/config/retarget/fair1_ppf.yaml"
```

Run:

```bash
python -m deploy.media_motion.run_cases \
  --route animated_drawings_worker \
  --input-dir report \
  --output-dir outputs/media_motion \
  --case-id doodle_dab \
  --image doodle.png \
  --tts "The character starts the travel animation with a cheerful move."
```

## Gateway Integration

Enable worker launch in the cloud gateway only on a worker-capable host:

```bash
export KRIDE_MODEL_GENERATION_ENABLED=true
export KRIDE_MEDIA_DIR=/app/media
export KRIDE_WORKER_OUTPUT_DIR=/app/media/generated
uvicorn deploy.cloud_gateway.app:app --host 0.0.0.0 --port 7860
```

Then POST to:

```text
POST /jobs/generate
```

Example body:

```json
{
  "route": "cogvideox_real",
  "case_id": "gwanghwamun",
  "place": "Gwanghwamun",
  "image": "gwanghwamun.jpg",
  "tts": "A cinematic travel narration for Gwanghwamun.",
  "bgm_key": "cinematic_memory",
  "prompt": "A cinematic AI-generated travel video from a real photo of Gwanghwamun.",
  "allow_fallback": true
}
```

For Docker worker images, mount media rather than baking `report/` into the image:

```bash
docker build -f deploy/media_motion/Dockerfile.worker -t kride-media-motion-worker .
docker run --rm \
  -v /absolute/media:/app/media \
  -v /absolute/outputs:/app/outputs/media_motion \
  kride-media-motion-worker \
  python -m deploy.media_motion.run_cases --help
```

## DagsHub Logging

After a worker writes its result JSON:

```bash
python -m deploy.media_motion.log_result_to_mlflow \
  --result-json outputs/media_motion/gwanghwamun_cogvideox_real_result.json \
  --experiment track-b-media-motion-workers
```

Set these first:

```bash
export MLFLOW_TRACKING_USERNAME=myelin24m
export MLFLOW_TRACKING_PASSWORD=<DAGSHUB_TOKEN>
export MLFLOW_TRACKING_URI=https://dagshub.com/myelin24m/Kride.mlflow
```

## Progress Notes

- STEP 1: Route request through `run_cases.py`.
- STEP 2: Prepare fallback BGM with `bgm.py`.
- STEP 3: Run the selected real model adapter or fallback branch.
- STEP 4: Generate narration with GPT-SoVITS or fallback TTS.
- STEP 5: Mix video + TTS + BGM with `ffmpeg_utils.py`.
- STEP 6: Write result JSON and log it with `log_result_to_mlflow.py`.
