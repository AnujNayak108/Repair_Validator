from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Collision Repair Validator"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    DATABASE_URL: str = "sqlite:///./sql_app.db"

    class Config:
        env_file = ".env"

settings = Settings()
