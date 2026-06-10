#!/usr/bin/env bash
set -euo pipefail

echo "[tora_entrypoint] validating Tora RunPod environment..."

default_checkpoint="/runpod-volume/tora/i2v/mp_rank_00_model_states.pt"
vaedir="/runpod-volume/tora-ckpts/vae"
t5dir="/runpod-volume/tora-ckpts/t5-v1_1-xxl"

if [[ ! -d /app/Tora ]]; then
  echo "[tora_entrypoint][ERROR] /app/Tora not found."
  echo "This container does not appear to be the Tora worker image."
  echo "Please ensure the image is built from deploy/media_motion/Dockerfile.tora and not a generic development image."
  exit 1
fi

if [[ ! -e /app/Tora/sat/sample_video.py ]]; then
  echo "[tora_entrypoint][ERROR] /app/Tora/sat/sample_video.py not found."
  echo "Tora repository checkout appears incomplete or missing."
  exit 1
fi

if [[ ! -e /runpod-volume ]]; then
  echo "[tora_entrypoint][ERROR] /runpod-volume is missing."
  echo "Ensure the RunPod network volume is mounted to /runpod-volume."
  exit 1
fi

if [[ ! -e "$default_checkpoint" ]]; then
  echo "[tora_entrypoint][ERROR] Tora checkpoint not found at $default_checkpoint."
  echo "Mounted volume may be incorrect or the checkpoint path is missing."
  exit 1
fi

if [[ ! -d "$vaedir" ]]; then
  echo "[tora_entrypoint][ERROR] VAE directory not found at $vaedir."
  echo "Ensure /runpod-volume/tora-ckpts/vae exists and is mounted."
  exit 1
fi

if [[ ! -d "$t5dir" ]]; then
  echo "[tora_entrypoint][ERROR] T5 checkpoint directory not found at $t5dir."
  echo "Ensure /runpod-volume/tora-ckpts/t5-v1_1-xxl exists and is mounted."
  exit 1
fi

if [[ ! -L /app/Tora/ckpts && ! -d /app/Tora/ckpts ]]; then
  echo "[tora_entrypoint][ERROR] /app/Tora/ckpts is missing."
  echo "The image should create a symlink at /app/Tora/ckpts -> /runpod-volume/tora-ckpts."
  exit 1
fi

if [[ -L /app/Tora/ckpts && ! -e /app/Tora/ckpts ]]; then
  echo "[tora_entrypoint][ERROR] /app/Tora/ckpts symlink is broken."
  echo "Check that /runpod-volume/tora-ckpts is mounted and valid."
  exit 1
fi

# Optional validation of configured env vars
if [[ -n "${KRIDE_TORA_CHECKPOINT_PATH:-}" && ! -e "${KRIDE_TORA_CHECKPOINT_PATH}" ]]; then
  echo "[tora_entrypoint][ERROR] KRIDE_TORA_CHECKPOINT_PATH is set to ${KRIDE_TORA_CHECKPOINT_PATH}, but the file does not exist."
  exit 1
fi

if [[ -n "${KRIDE_TORA_DIR:-}" && ! -d "${KRIDE_TORA_DIR}" ]]; then
  echo "[tora_entrypoint][ERROR] KRIDE_TORA_DIR is set to ${KRIDE_TORA_DIR}, but the directory does not exist."
  exit 1
fi

echo "[tora_entrypoint] validation successful. Starting Tora worker..."
exec python -u -m deploy.media_motion.runpod_handler
