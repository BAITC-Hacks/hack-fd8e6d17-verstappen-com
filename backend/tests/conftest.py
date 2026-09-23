import os
import tempfile
from pathlib import Path

import pytest

_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}"
# Автотесты не ходят в OpenAI: детерминированно, бесплатно, работают без сети.
# Пустое значение не даёт load_dotenv подставить ключ из .env.
os.environ["OPENAI_API_KEY"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import reset  # noqa: E402


@pytest.fixture()
def client():
    reset()
    with TestClient(app) as c:
        yield c
