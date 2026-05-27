from __future__ import annotations


def route_media_motion(caption: str, *, is_doodle: bool = False, is_static_photo: bool = True) -> str:
    """Route one input into the intended media-motion branch."""
    text = caption.lower()

    if is_doodle or any(word in text for word in ["doodle", "cartoon", "drawing", "sketch", "character"]):
        return "animated_drawings"

    dynamic_keywords = [
        "person",
        "people",
        "man",
        "woman",
        "girl",
        "boy",
        "child",
        "dog",
        "cat",
        "animal",
        "dance",
        "walking",
        "running",
        "moving",
        "crowd",
    ]
    if any(word in text for word in dynamic_keywords):
        return "cogvideox"

    if is_static_photo:
        return "3d_photo_inpainting_light"

    return "photo_motion"

