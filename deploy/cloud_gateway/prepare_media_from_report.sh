#!/usr/bin/env bash
set -euo pipefail

# STEP 1. Resolve paths from repository root.
SOURCE="${1:-report}"
DESTINATION="${2:-deploy/cloud_gateway/media}"

if [ ! -d "$SOURCE" ]; then
  echo "Source folder not found: $SOURCE" >&2
  exit 1
fi

# STEP 2. Create deployment media folder.
mkdir -p "$DESTINATION"

# STEP 3. Copy top-level preview assets.
find "$SOURCE" -maxdepth 1 -type f \( \
  -name '*.mp4' -o \
  -name '*.wav' -o \
  -name '*.mp3' -o \
  -name '*.json' -o \
  -name '*.ipynb' \
\) -print -exec cp -f {} "$DESTINATION/" \;

# STEP 4. Copy known generated branch folders if present.
for folder in \
  3d_photo_light_final \
  3d_photo_light_outputs \
  3d_photo_light_tts \
  cogvideo_photo_final \
  cogvideo_photo_outputs \
  cogvideo_photo_tts
do
  if [ -d "$SOURCE/$folder" ]; then
    rm -rf "$DESTINATION/$folder"
    cp -R "$SOURCE/$folder" "$DESTINATION/$folder"
    echo "copied folder: $folder"
  fi
done

# STEP 5. Print verification summary.
echo
echo "Media folder ready: $DESTINATION"
find "$DESTINATION" -maxdepth 3 -type f -print
