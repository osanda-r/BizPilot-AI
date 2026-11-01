from pathlib import Path

import pytest
from app.settings import Settings


def test_defaults_work_without_environment(monkeypatch):
    for key in ["GROQ_API_KEY", "GROQ_MODEL", "GROQ_TIMEOUT_SECONDS", "DATABASE_PATH", "CORS_ORIGINS"]:
        monkeypatch.delenv(key, raising=False)
    settings = Settings.from_env()
    assert settings.groq_api_key == ""
    assert settings.groq_timeout == 20
    assert settings.database_path.is_absolute()


def test_environment_is_trimmed_and_parsed(monkeypatch, tmp_path):
    monkeypatch.setenv("GROQ_API_KEY", " test-key ")
    monkeypatch.setenv("GROQ_MODEL", " test-model ")
    monkeypatch.setenv("GROQ_TIMEOUT_SECONDS", "5")
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "tasks.db"))
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173, http://localhost:4173,")
    settings = Settings.from_env()
    assert settings.groq_api_key == "test-key"
    assert settings.groq_model == "test-model"
    assert settings.groq_timeout == 5
    assert settings.database_path == Path(tmp_path / "tasks.db")
    assert settings.cors_origins == ("http://localhost:5173", "http://localhost:4173")


@pytest.mark.parametrize("value", ["0", "-1", "121", "not-a-number", "nan"])
def test_invalid_timeout_has_clear_error(monkeypatch, value):
    monkeypatch.setenv("GROQ_TIMEOUT_SECONDS", value)
    with pytest.raises(ValueError):
        Settings.from_env()


def test_empty_model_rejected(monkeypatch):
    monkeypatch.setenv("GROQ_MODEL", "   ")
    with pytest.raises(ValueError, match="GROQ_MODEL"):
        Settings.from_env()
