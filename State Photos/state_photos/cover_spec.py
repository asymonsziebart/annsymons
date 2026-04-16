from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CoverSpec:
    href: str
    focus_x: float = 50.0
    focus_y: float = 50.0
    zoom: float = 1.0
