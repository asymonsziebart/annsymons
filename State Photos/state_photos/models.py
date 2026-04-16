from __future__ import annotations

from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Boolean, DateTime, Float, Integer, String, text
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Mapped, mapped_column

db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc)


class Photo(db.Model):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    stored_name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_cover: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Framing for map/preview (0–100 ≈ focal point; zoom >= 1)
    focus_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    focus_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    frame_zoom: Mapped[float | None] = mapped_column("frame_zoom", Float, nullable=True)

    @staticmethod
    def clear_cover_flag_for_state(state_code: str) -> None:
        Photo.query.filter_by(state_code=state_code, is_cover=True).update({"is_cover": False})


def ensure_photo_framing_columns(engine: Engine) -> None:
    """Add framing columns to existing databases (SQLite / SQL Server)."""
    insp = sa_inspect(engine)
    if not insp.has_table("photos"):
        return
    names = {c["name"] for c in insp.get_columns("photos")}
    adds: list[str] = []
    if "focus_x" not in names:
        adds.append("focus_x")
    if "focus_y" not in names:
        adds.append("focus_y")
    if "frame_zoom" not in names:
        adds.append("frame_zoom")
    if not adds:
        return
    with engine.begin() as conn:
        for col in adds:
            if engine.dialect.name == "sqlite":
                conn.execute(text(f"ALTER TABLE photos ADD COLUMN {col} FLOAT"))
            else:
                conn.execute(text(f"ALTER TABLE photos ADD {col} FLOAT NULL"))
