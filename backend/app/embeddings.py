"""Sentence embeddings for the vector store.

What this replaces: `hash_embedding()` bucketed words into 64 dimensions by
hash. That finds *lexical* near-duplicates — the same words reused — which is
enough for spotting copy-paste reposts and nothing else. Two posts saying the
same thing in different words scored zero against each other, and a Hindi post
and its English equivalent scored zero by construction.

This uses the multilingual sentence encoder already on disk for topic
discovery, so cross-language similarity actually works: the whole point of the
project is not dropping code-mix, and a lexical vector store drops it at the
retrieval layer even when the annotator handled it.

Falls back to the hash vectors when sentence-transformers is not installed, so
the service still runs without the heavy extras — /api/health says which is in
use.
"""
from __future__ import annotations

import logging
import threading
from typing import Any

log = logging.getLogger("visionx.embeddings")

# Same model as discovery, so it is already cached after the first run.
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
MODEL_DIM = 384
HASH_DIM = 64


class Embedder:
    """Lazy, thread-safe. Loading takes seconds, so it never blocks import."""

    def __init__(self, model_name: str = MODEL_NAME) -> None:
        self.model_name = model_name
        self._model: Any | None = None
        self._lock = threading.Lock()
        self.load_error: str | None = None
        self.warming = False

    @property
    def ready(self) -> bool:
        return self._model is not None

    @property
    def dim(self) -> int:
        return MODEL_DIM if self.ready else HASH_DIM

    @property
    def backend(self) -> str:
        if self.ready:
            return "sentence-transformers"
        return "hash (models unavailable)" if self.load_error else "hash (not loaded)"

    def warm(self) -> bool:
        """Blocking. Call from a thread."""
        if self._model is not None:
            return True
        with self._lock:
            if self._model is not None:
                return True
            self.warming = True
            try:
                from sentence_transformers import SentenceTransformer  # noqa: PLC0415

                self._model = SentenceTransformer(self.model_name)
                log.info("embeddings: loaded %s (%d dims)", self.model_name, MODEL_DIM)
                return True
            except Exception as exc:
                self.load_error = f"{type(exc).__name__}: {exc}"
                log.warning("embeddings unavailable, using hash vectors: %s", exc)
                return False
            finally:
                self.warming = False

    def encode(self, text: str) -> list[float]:
        """Never blocks on loading: falls back to hash vectors until ready."""
        if self._model is None:
            from .stores.base import hash_embedding  # noqa: PLC0415

            return hash_embedding(text, HASH_DIM)
        vec = self._model.encode(text, normalize_embeddings=True, show_progress_bar=False)
        return [float(v) for v in vec]

    def encode_many(self, texts: list[str]) -> list[list[float]]:
        if self._model is None:
            from .stores.base import hash_embedding  # noqa: PLC0415

            return [hash_embedding(t, HASH_DIM) for t in texts]
        vecs = self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [[float(v) for v in row] for row in vecs]

    def status(self) -> dict:
        return {
            "backend": self.backend,
            "model": self.model_name if self.ready else None,
            "dim": self.dim,
            "ready": self.ready,
            "warming": self.warming,
            "load_error": self.load_error,
        }


embedder = Embedder()
