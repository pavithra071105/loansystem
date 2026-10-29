import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-secret-change-me-before-deploying-1234")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'loanlens.db'}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_HOURS = 12

    MODEL_DIR = os.environ.get("MODEL_DIR", str(BASE_DIR / "models"))
    TRAIN_SAMPLES = int(os.environ.get("TRAIN_SAMPLES", 9000))
    RF_TREES = int(os.environ.get("RF_TREES", 250))

    # Seeded on first start. Change these (or set env vars) before any real use.
    ADMIN_NAME = os.environ.get("ADMIN_NAME", "Admin")
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@loanlens.ai")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
