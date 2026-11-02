import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
APP_DIR = BASE_DIR / "app"
DATA_DIR = APP_DIR / "data"
DB_PATH = Path(os.environ.get("DATABASE_PATH", BASE_DIR / "data" / "skill_gap.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
