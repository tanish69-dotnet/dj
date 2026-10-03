"""Test bootstrap.

Runs the whole suite against a throwaway SQLite file so tests that trigger
allocations, road blocks and reallocation cannot mutate the real demo database.
The env var must be set before any backend module imports app.db.
"""

import os
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

_TEST_DB = Path(tempfile.gettempdir()) / f"disaster-tests-{os.getpid()}.db"
for suffix in ("", "-wal", "-shm"):
    candidate = Path(str(_TEST_DB) + suffix)
    if candidate.exists():
        candidate.unlink()

os.environ["DISASTER_DB_PATH"] = str(_TEST_DB)

import pytest  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_db():
    yield
    for suffix in ("", "-wal", "-shm"):
        candidate = Path(str(_TEST_DB) + suffix)
        try:
            if candidate.exists():
                candidate.unlink()
        except OSError:
            # A SQLite handle may still be open on Windows; the file lives in
            # the temp directory, so leaving it behind is harmless.
            pass