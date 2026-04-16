"""Load per-state outline geometry from the blank US map SVG (path `d` or DC circle)."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path

from .states import ALL_CODES

SVG_NS = "http://www.w3.org/2000/svg"


def _local_tag(tag: str) -> str:
    if tag.startswith("{"):
        return tag.split("}", 1)[-1]
    return tag


def _code_from_class(class_attr: str | None) -> str | None:
    if not class_attr:
        return None
    codes = {c.lower() for c in ALL_CODES}
    for token in class_attr.split():
        t = token.lower()
        if len(t) == 2 and t.isalpha() and t in codes:
            return t.upper()
    return None


@lru_cache(maxsize=4)
def load_state_shapes(svg_path: str) -> dict[str, dict]:
    """
    Returns e.g. {"CA": {"kind": "path", "d": "m ..."}, "DC": {"kind": "circle", "cx": "...", ...}}
    """
    root = ET.parse(svg_path).getroot()
    out: dict[str, dict] = {}
    for el in root.iter():
        tag = _local_tag(el.tag)
        if tag == "path":
            code = _code_from_class(el.get("class"))
            if not code:
                continue
            d = el.get("d")
            if not d:
                continue
            if code == "DC":
                out["DC"] = {"kind": "path", "d": d}
                continue
            out[code] = {"kind": "path", "d": d}
        elif tag == "circle":
            code = _code_from_class(el.get("class"))
            if code != "DC":
                continue
            out["DC"] = {
                "kind": "circle",
                "cx": el.get("cx", "0"),
                "cy": el.get("cy", "0"),
                "r": el.get("r", "5"),
            }
    return out


def shape_for_state(svg_path: Path, state_code: str) -> dict | None:
    shapes = load_state_shapes(str(svg_path.resolve()))
    return shapes.get(state_code)
