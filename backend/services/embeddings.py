import os
import requests
from services.document_processor import DocumentChunk
from dataclasses import dataclass

EMBEDDING_MODEL = "models/gemini-embedding-001"
_BASE = "https://generativelanguage.googleapis.com/v1beta"
BATCH_SIZE = 100


@dataclass
class EmbeddedChunk:
    chunk: DocumentChunk
    embedding: list[float]


def _api_key() -> str:
    return os.environ["GOOGLE_GENERATIVE_AI_API_KEY"]


def _safe_raise(resp: requests.Response) -> None:
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        raise requests.HTTPError(str(e).replace(_api_key(), "***"), response=resp) from None


def embed_chunks(chunks: list[DocumentChunk]) -> list[EmbeddedChunk]:
    results = []
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        payload = {
            "requests": [
                {
                    "model": EMBEDDING_MODEL,
                    "content": {"parts": [{"text": c.content}]},
                    "taskType": "RETRIEVAL_DOCUMENT",
                }
                for c in batch
            ]
        }
        url = f"{_BASE}/{EMBEDDING_MODEL}:batchEmbedContents?key={_api_key()}"
        resp = requests.post(url, json=payload, timeout=60)
        _safe_raise(resp)
        embeddings = resp.json()["embeddings"]
        for chunk, emb in zip(batch, embeddings):
            results.append(EmbeddedChunk(chunk=chunk, embedding=emb["values"]))
    return results


def embed_query(query: str) -> list[float]:
    payload = {
        "model": EMBEDDING_MODEL,
        "content": {"parts": [{"text": query}]},
        "taskType": "RETRIEVAL_QUERY",
    }
    url = f"{_BASE}/{EMBEDDING_MODEL}:embedContent?key={_api_key()}"
    resp = requests.post(url, json=payload, timeout=30)
    _safe_raise(resp)
    return resp.json()["embedding"]["values"]
