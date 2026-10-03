import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Canonical database location — always backend/disaster.db, regardless of the
# working directory the process was started from. Previously this was the
# relative "sqlite:///./disaster.db", which silently created two different
# databases (repo root + backend/) and produced split-brain operational data.
# DISASTER_DB_PATH lets the test suite run against a throwaway file.
BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("DISASTER_DB_PATH") or (BACKEND_DIR / "disaster.db")).resolve()

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()