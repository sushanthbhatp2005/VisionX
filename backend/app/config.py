"""Service configuration.

Everything here has a working default. The service starts with no .env file,
no databases and no models: each subsystem degrades to an in-process
equivalent and reports what it actually used on /api/health.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- service ------------------------------------------------------------
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,https://sushanthbhatp2005.github.io"
    tick_seconds: float = 2.6
    forecast_refit_seconds: int = 120   # a seasonal fit is ~1s per topic

    # --- persistence ---------------------------------------------------------
    # SQLite is the default store tier: no service to run, survives a restart.
    # Set sqlite_enabled=false to go back to pure in-memory.
    sqlite_enabled: bool = True
    sqlite_path: str = ""              # blank = app/data/visionx.db
    metrics_retain_hours: int = 48

    # --- stores -------------------------------------------------------------
    # Empty means "use the in-memory implementation". Set these to point at the
    # containers in docker-compose.yml.
    timescale_dsn: str = ""       # postgresql://visionx:visionx@localhost:5432/visionx
    neo4j_uri: str = ""           # bolt://localhost:7687
    neo4j_user: str = "neo4j"
    neo4j_password: str = "visionx123"
    qdrant_url: str = ""          # http://localhost:6333
    redis_url: str = ""           # redis://localhost:6379/0

    # --- NLP ----------------------------------------------------------------
    # "auto"   -> use transformers if importable, else the rule-based annotator
    # "rules"  -> always rule-based (fast, no downloads)
    # "models" -> require transformers; fail loudly if unavailable
    nlp_backend: str = "auto"
    nlp_sentiment_model: str = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
    nlp_emotion_model: str = "j-hartmann/emotion-english-distilroberta-base"
    nlp_device: str = "cpu"
    nlp_max_chars: int = 512

    # --- ingestion ----------------------------------------------------------
    ingest_enabled: bool = False          # off by default: the demo must be deterministic
    ingest_interval_seconds: int = 300
    ingest_subreddits: str = "bangalore,india,karnataka"
    ingest_rss_feeds: str = (
        "https://feeds.feedburner.com/ndtvnews-india-news,"
        "https://www.thehindu.com/news/national/karnataka/feeder/default.rss"
    )
    youtube_api_key: str = ""             # required for the YouTube collector
    x_bearer_token: str = ""              # required for the X collector

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def subreddit_list(self) -> list[str]:
        return [s.strip() for s in self.ingest_subreddits.split(",") if s.strip()]

    @property
    def rss_list(self) -> list[str]:
        return [s.strip() for s in self.ingest_rss_feeds.split(",") if s.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
