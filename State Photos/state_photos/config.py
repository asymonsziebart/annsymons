import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    """URL prefix for this app when mounted under the main site (e.g. /statephotos)."""

    STATE_PHOTOS_URL_PREFIX = os.environ.get("STATE_PHOTOS_URL_PREFIX", "/statephotos").strip().rstrip("/")

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    # MSSQL in production: set DATABASE_URL. If unset, SQLite file is used for local testing only.
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or (
        f"sqlite:///{(BASE_DIR / 'local_dev.db').as_posix()}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = BASE_DIR / "static" / "uploads"
    SVG_MAP_PATH = BASE_DIR / "static" / "svg" / "us_states.svg"
    MAX_CONTENT_LENGTH = 20 * 1024 * 1024
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
