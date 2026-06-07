from __future__ import annotations


def route_media_motion(
    caption: str,
    *,
    is_doodle: bool = False,
    is_static_photo: bool = True,
    has_trajectory: bool = False,
) -> str:
    """Route one input into the intended media-motion branch.

    Returns one of the actual RunPod route / worker names:
      - "animated_drawings_worker"
      - "tora_cogvideox_i2v"  (trajectory-controlled CogVideoX)
      - "cogvideox_real"
      - "3d_photo_light"  (depth parallax → zoompan fallback)
    """
    # If trajectory is provided, always use Tora
    if has_trajectory:
        return "tora_cogvideox_i2v"

    text = caption.lower()

    if is_doodle or any(
        word in text
        for word in ["doodle", "cartoon", "drawing", "sketch", "character"]
    ):
        return "animated_drawings_worker"

    dynamic_keywords = [
        "person", "people", "man", "woman", "girl", "boy", "child",
        "dog", "cat", "animal", "car", "vehicle", "bus", "truck",
        "dance", "walking", "running", "moving", "crowd",
    ]
    if any(word in text for word in dynamic_keywords):
        return "cogvideox_real"

    if is_static_photo:
        return "3d_photo_light"

    return "cogvideox_real"
