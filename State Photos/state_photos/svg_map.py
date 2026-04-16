"""Build interactive map SVG with optional cover image patterns."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

from .cover_spec import CoverSpec
from .framing import pattern_image_transform
from .states import ALL_CODES

SVG_NS = "http://www.w3.org/2000/svg"

ET.register_namespace("", SVG_NS)


def _local_tag(tag: str) -> str:
    if tag.startswith("{"):
        return tag.split("}", 1)[-1]
    return tag


def _state_code_from_class(class_attr: str | None) -> str | None:
    if not class_attr:
        return None
    codes = {c.lower() for c in ALL_CODES}
    for token in class_attr.split():
        t = token.lower()
        if len(t) == 2 and t.isalpha() and t in codes:
            return t.upper()
    return None


def build_map_svg(
    svg_path: Path, covers: dict[str, CoverSpec], *, path_prefix: str = ""
) -> str:
    """
    covers: state_code -> cover spec (image URL + framing for pattern <image> transform)
    path_prefix: mount path when served under the main site (e.g. /statephotos).
    """
    base = (path_prefix or "").strip().rstrip("/")
    state_base = f"{base}/state" if base else "/state"
    tree = ET.parse(svg_path)
    root = tree.getroot()

    defs = root.find(f"{{{SVG_NS}}}defs")
    if defs is None:
        defs = ET.SubElement(root, f"{{{SVG_NS}}}defs")

    existing_pattern_ids = {
        el.get("id")
        for el in defs.iter()
        if _local_tag(el.tag) == "pattern" and el.get("id")
    }

    for code, spec in covers.items():
        pid = f"photo-pat-{code}"
        if pid in existing_pattern_ids:
            continue
        pattern = ET.SubElement(defs, f"{{{SVG_NS}}}pattern")
        pattern.set("id", pid)
        pattern.set("patternContentUnits", "objectBoundingBox")
        pattern.set("width", "1")
        pattern.set("height", "1")
        img = ET.SubElement(pattern, f"{{{SVG_NS}}}image")
        img.set("href", spec.href)
        img.set("width", "1")
        img.set("height", "1")
        img.set("preserveAspectRatio", "xMidYMid slice")
        img.set("transform", pattern_image_transform(spec.focus_x, spec.focus_y, spec.zoom))

    for el in root.iter():
        tag = _local_tag(el.tag)
        if tag == "path":
            code = _state_code_from_class(el.get("class"))
            if not code:
                continue
            if code == "DC":
                el.set("style", "display:none;")
                continue
            el.set("id", f"state-path-{code}")
            el.set("data-state", code)
            onclick = f"window.location.href='{state_base}/{code}';"
            if code in covers:
                el.set("fill", f"url(#photo-pat-{code})")
                el.set("style", f"cursor:pointer;{el.get('style') or ''}")
            else:
                el.set("style", "cursor:pointer;")
            el.set("onclick", onclick)
        elif tag == "circle":
            code = _state_code_from_class(el.get("class"))
            if code != "DC":
                continue
            el.set("id", "state-path-DC")
            el.set("data-state", "DC")
            onclick = f"window.location.href='{state_base}/DC';"
            if "DC" in covers:
                el.set("fill", "url(#photo-pat-DC)")
            el.set("style", "cursor:pointer;")
            el.set("onclick", onclick)

    return ET.tostring(root, encoding="unicode")
