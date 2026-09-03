import os
import tempfile

import pytest

# Point at a fresh temp SQLite file *before* app.db.database is imported
# anywhere, so tests never touch the developer's real research.db and each
# test run starts from a clean database.
_tmp_db_fd, _tmp_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db_path}"
# Make sure tests never accidentally hit real paid APIs even if the
# developer has a real .env file sitting around.
os.environ.pop("LLM_API_KEY", None)
os.environ.pop("SEARCH_API_KEY", None)
os.environ.pop("SEARCH_ENGINE_ID", None)
# Skip the artificial UX pacing delay between SSE sections so tests run fast.
os.environ["SSE_SECTION_PACING_SECONDS"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

from app.db.database import Base, engine, get_db, SessionLocal  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    os.close(_tmp_db_fd)
    os.remove(_tmp_db_path)


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    return TestClient(app)
