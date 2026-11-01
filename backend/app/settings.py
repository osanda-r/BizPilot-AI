import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_timeout: float = 20.0
    database_path: Path = BACKEND_DIR / "data" / "bizpilot.db"
    cors_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")

    @classmethod
    def from_env(cls) -> "Settings":
        timeout = float(os.getenv("GROQ_TIMEOUT_SECONDS", "20"))
        if not 1 <= timeout <= 120:
            raise ValueError("GROQ_TIMEOUT_SECONDS must be between 1 and 120")
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
        if not model:
            raise ValueError("GROQ_MODEL must not be empty")
        return cls(
            groq_api_key=os.getenv("GROQ_API_KEY", "").strip(),
            groq_model=model,
            groq_timeout=timeout,
            database_path=Path(
                os.getenv("DATABASE_PATH", str(BACKEND_DIR / "data" / "bizpilot.db"))
            ).expanduser(),
            cors_origins=tuple(
                origin.strip()
                for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(
                    ","
                )
                if origin.strip()
            ),
        )
