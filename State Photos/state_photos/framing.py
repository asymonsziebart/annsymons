"""Shared math for how a cover image is placed inside a state shape (map + preview)."""

from __future__ import annotations


def clamp_focus(v: float) -> float:
    return max(0.0, min(100.0, float(v)))


def clamp_zoom(v: float) -> float:
    return max(1.0, min(2.5, float(v)))


def photo_framing_values(photo) -> tuple[float, float, float]:
    """Read framing from a Photo model (handles legacy NULLs)."""
    fx = float(photo.focus_x) if photo.focus_x is not None else 50.0
    fy = float(photo.focus_y) if photo.focus_y is not None else 50.0
    z = float(photo.frame_zoom) if photo.frame_zoom is not None else 1.0
    return clamp_focus(fx), clamp_focus(fy), clamp_zoom(z)


def pattern_image_transform(focus_x: float, focus_y: float, zoom: float) -> str:
    """
    Transform for the <image> inside a pattern with patternContentUnits=objectBoundingBox,
    width/height 1, preserveAspectRatio xMidYMid slice. focus_* are 0–100 like CSS object-position;
    50,50 is centered. zoom 1 = default fill; higher = zoom in (tighter crop).
    """
    fx = clamp_focus(focus_x)
    fy = clamp_focus(focus_y)
    z = clamp_zoom(zoom)
    # Pan range tuned so sliders feel useful on irregular state shapes
    k = 0.35
    dx = (50.0 - fx) / 100.0 * k
    dy = (50.0 - fy) / 100.0 * k
    return f"translate(0.5 0.5) scale({z}) translate(-0.5 -0.5) translate({dx:.5f} {dy:.5f})"
