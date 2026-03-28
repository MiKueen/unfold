import json
import os
import numpy as np
from services.embeddings import EmbeddedChunk
from services.document_processor import DocumentChunk
from dataclasses import dataclass, field
import threading

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", ".cache")


def _safe_key(key: str) -> str:
    return key.replace("/", "_").replace(":", "_")


def _context_path(key: str) -> str:
    return os.path.join(CACHE_DIR, f"{_safe_key(key)}.context.json")


def _store_path(key: str) -> str:
    return os.path.join(CACHE_DIR, f"{_safe_key(key)}.store.json")


def _ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)


class VectorStore:
    def __init__(self):
        self._chunks: list[EmbeddedChunk] = []

    def add_chunks(self, chunks: list[EmbeddedChunk]):
        self._chunks.extend(chunks)

    def search(self, query_embedding: list[float], top_k: int = 15) -> list[DocumentChunk]:
        if not self._chunks:
            return []

        q = np.array(query_embedding)
        embeddings = np.array([c.embedding for c in self._chunks])

        # Cosine similarity
        norms = np.linalg.norm(embeddings, axis=1) * np.linalg.norm(q)
        norms = np.where(norms == 0, 1e-10, norms)
        scores = embeddings @ q / norms

        top_indices = np.argsort(scores)[::-1][:top_k]
        return [self._chunks[i].chunk for i in top_indices]

    @property
    def size(self) -> int:
        return len(self._chunks)

    def to_dict(self) -> dict:
        return {
            "chunks": [
                {
                    "embedding": c.embedding,
                    "chunk": {
                        "id": c.chunk.id,
                        "file_id": c.chunk.file_id,
                        "file_name": c.chunk.file_name,
                        "file_path": c.chunk.file_path,
                        "mime_type": c.chunk.mime_type,
                        "content": c.chunk.content,
                        "chunk_index": c.chunk.chunk_index,
                        "total_chunks": c.chunk.total_chunks,
                        "web_view_link": c.chunk.web_view_link,
                    },
                }
                for c in self._chunks
            ]
        }

    @classmethod
    def from_dict(cls, data: dict) -> "VectorStore":
        store = cls()
        for item in data.get("chunks", []):
            chunk = DocumentChunk(**item["chunk"])
            store._chunks.append(EmbeddedChunk(chunk=chunk, embedding=item["embedding"]))
        return store


# Module-level registries — persist within a single process
_stores: dict[str, VectorStore] = {}
_contexts: dict[str, dict] = {}
_lock = threading.Lock()


def get_store(key: str) -> VectorStore | None:
    with _lock:
        if key in _stores:
            return _stores[key]
        path = _store_path(key)
        if os.path.exists(path):
            with open(path) as f:
                store = VectorStore.from_dict(json.load(f))
            _stores[key] = store
            return store
        return None


def set_store(key: str, store: VectorStore):
    with _lock:
        _stores[key] = store
        _ensure_cache_dir()
        # Use atomic-ish write by dumping to string first
        data = json.dumps(store.to_dict())
        with open(_store_path(key), "w") as f:
            f.write(data)


def get_context(key: str) -> dict | None:
    with _lock:
        if key in _contexts:
            return _contexts[key]
        path = _context_path(key)
        if os.path.exists(path):
            with open(path) as f:
                ctx = json.load(f)
            _contexts[key] = ctx
            return ctx
        return None


def set_context(key: str, ctx: dict):
    with _lock:
        _contexts[key] = ctx
        _ensure_cache_dir()
        data = json.dumps(ctx)
        with open(_context_path(key), "w") as f:
            f.write(data)
