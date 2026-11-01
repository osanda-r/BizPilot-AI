from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from app.ai import AIService
from app.main import create_app
from app.settings import Settings
from fastapi.testclient import TestClient


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(database_path=tmp_path / "test.db")


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def fake_ai():
    service = AsyncMock(spec=AIService)
    service.configured = True
    return service


@pytest.fixture
def ai_client(settings: Settings, fake_ai: AIService):
    with TestClient(create_app(settings, ai_service=fake_ai)) as test_client:
        yield test_client
