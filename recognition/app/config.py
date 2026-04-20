"""Configuration via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    recognition_api_key: str = "dev-recognition-key-change-me"
    openai_api_key: str = ""
    log_level: str = "INFO"
    max_file_size_mb: int = 50
    parse_timeout_seconds: int = 300
    llm_model: str = "gpt-4o-mini"
    dpi: int = 200
    max_page_retries: int = 2
    port: int = 8003

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
