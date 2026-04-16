from __future__ import annotations

import uuid
from pathlib import Path

from flask import (
    Blueprint,
    abort,
    current_app,
    flash,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)
from werkzeug.utils import secure_filename

from .cover_spec import CoverSpec
from .framing import clamp_focus, clamp_zoom, photo_framing_values
from .models import Photo, db
from .state_geometry import shape_for_state
from .states import STATE_NAMES, normalize_state_code
from .svg_map import build_map_svg

bp = Blueprint("main", __name__)


def _allowed_file(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext in current_app.config["ALLOWED_EXTENSIONS"]


def _framing_from_form() -> tuple[float, float, float]:
    fx = request.form.get("focus_x", type=float)
    fy = request.form.get("focus_y", type=float)
    z = request.form.get("zoom", type=float)
    if fx is None:
        fx = 50.0
    if fy is None:
        fy = 50.0
    if z is None:
        z = 1.0
    return clamp_focus(fx), clamp_focus(fy), clamp_zoom(z)


def _cover_specs() -> dict[str, CoverSpec]:
    out: dict[str, CoverSpec] = {}
    for row in Photo.query.filter_by(is_cover=True).all():
        fx, fy, z = photo_framing_values(row)
        out[row.state_code] = CoverSpec(
            href=url_for("main.uploaded_file", name=row.stored_name),
            focus_x=fx,
            focus_y=fy,
            zoom=z,
        )
    return out


@bp.get("/")
def index():
    prefix = str(current_app.config.get("STATE_PHOTOS_URL_PREFIX") or "").strip().rstrip("/")
    svg = build_map_svg(
        Path(current_app.config["SVG_MAP_PATH"]),
        _cover_specs(),
        path_prefix=prefix,
    )
    return render_template("index.html", svg_map=svg)


@bp.get("/state/<code>")
def state_view(code: str):
    c = normalize_state_code(code)
    if not c:
        abort(404)
    photos = (
        Photo.query.filter_by(state_code=c).order_by(Photo.is_cover.desc(), Photo.created_at.desc()).all()
    )
    cover = next((p for p in photos if p.is_cover), None)
    shape = shape_for_state(Path(current_app.config["SVG_MAP_PATH"]), c)
    if not shape:
        abort(404)
    framing_fx, framing_fy, framing_zoom = (
        photo_framing_values(cover) if cover else (50.0, 50.0, 1.0)
    )
    return render_template(
        "state.html",
        code=c,
        name=STATE_NAMES[c],
        photos=photos,
        cover=cover,
        shape=shape,
        framing_fx=framing_fx,
        framing_fy=framing_fy,
        framing_zoom=framing_zoom,
    )


@bp.post("/state/<code>/upload")
def state_upload(code: str):
    c = normalize_state_code(code)
    if not c:
        abort(404)
    f = request.files.get("photo")
    if not f or not f.filename:
        flash("Choose a photo to upload.", "error")
        return redirect(url_for("main.state_view", code=c))
    if not _allowed_file(f.filename):
        flash("Allowed types: PNG, JPG, JPEG, WebP, GIF.", "error")
        return redirect(url_for("main.state_view", code=c))

    fx, fy, z = _framing_from_form()

    ext = secure_filename(f.filename.rsplit(".", 1)[-1].lower())
    stored = f"{uuid.uuid4().hex}.{ext}"
    dest = Path(current_app.config["UPLOAD_FOLDER"]) / stored
    f.save(dest)

    has_cover = Photo.query.filter_by(state_code=c, is_cover=True).first() is not None
    photo = Photo(
        state_code=c,
        stored_name=stored,
        original_name=f.filename,
        is_cover=not has_cover,
        focus_x=fx,
        focus_y=fy,
        frame_zoom=z,
    )
    db.session.add(photo)
    db.session.commit()
    flash("Photo uploaded.", "ok")
    return redirect(url_for("main.state_view", code=c))


@bp.post("/photo/<int:photo_id>/cover")
def set_cover(photo_id: int):
    photo = Photo.query.filter_by(id=photo_id).first_or_404()
    c = photo.state_code
    Photo.query.filter_by(state_code=c, is_cover=True).update({"is_cover": False})
    photo.is_cover = True
    db.session.commit()
    flash("Cover updated.", "ok")
    return redirect(url_for("main.state_view", code=c))


@bp.post("/photo/<int:photo_id>/frame")
def update_frame(photo_id: int):
    photo = Photo.query.filter_by(id=photo_id).first_or_404()
    c = photo.state_code
    fx, fy, z = _framing_from_form()
    photo.focus_x = fx
    photo.focus_y = fy
    photo.frame_zoom = z
    db.session.commit()
    flash("Framing saved.", "ok")
    return redirect(url_for("main.state_view", code=c))


@bp.post("/photo/<int:photo_id>/delete")
def delete_photo(photo_id: int):
    photo = Photo.query.filter_by(id=photo_id).first_or_404()
    c = photo.state_code
    was_cover = photo.is_cover
    path = Path(current_app.config["UPLOAD_FOLDER"]) / photo.stored_name
    db.session.delete(photo)
    db.session.commit()
    if path.is_file():
        path.unlink(missing_ok=True)

    if was_cover:
        next_p = (
            Photo.query.filter_by(state_code=c).order_by(Photo.created_at.desc()).first()
        )
        if next_p:
            next_p.is_cover = True
            db.session.commit()

    flash("Photo removed.", "ok")
    return redirect(url_for("main.state_view", code=c))


@bp.get("/uploads/<name>")
def uploaded_file(name: str):
    safe = secure_filename(name)
    if safe != name or ".." in name:
        abort(404)
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], name)
