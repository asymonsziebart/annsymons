from pathlib import Path

from flask import Flask

from .config import Config
from .models import db


def create_app(config_class: type = Config) -> Flask:
    # Derive static URL path from the mount prefix before creating the Flask app.
    prefix = str(getattr(config_class, "STATE_PHOTOS_URL_PREFIX", "/statephotos") or "").strip().rstrip("/")
    static_url_path = f"{prefix}/static" if prefix else "/static"

    app = Flask(
        __name__,
        template_folder=str(Path(__file__).resolve().parent.parent / "templates"),
        static_folder=str(Path(__file__).resolve().parent.parent / "static"),
        static_url_path=static_url_path,
    )
    app.config.from_object(config_class)

    uri = app.config.get("SQLALCHEMY_DATABASE_URI") or ""
    if uri.startswith("sqlite:"):
        import warnings

        warnings.warn(
            "Using SQLite (local_dev.db). Set DATABASE_URL to your MSSQL URI when you connect to SQL Server.",
            stacklevel=1,
        )

    db.init_app(app)
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)

    with app.app_context():
        db.create_all()
        from .models import ensure_photo_framing_columns

        ensure_photo_framing_columns(db.engine)

    from . import routes

    bp_prefix = prefix or None
    app.register_blueprint(routes.bp, url_prefix=bp_prefix)

    return app
