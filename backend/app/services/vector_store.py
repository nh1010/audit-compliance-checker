import os
import logging
import time
from pathlib import Path

import chromadb
from chromadb import EmbeddingFunction, Embeddings, Documents
from google import genai
from httpx import ConnectError, RemoteProtocolError, ReadTimeout, TransportError

logger = logging.getLogger(__name__)

CHROMA_DIR = os.environ.get(
    "CHROMA_DIR",
    str(Path(__file__).resolve().parents[2] / "data" / "chroma"),
)
COLLECTION_NAME = "policies"
EMBEDDING_MODEL = "gemini-embedding-001"
TOP_K = 8


EMBED_BATCH_SIZE = 100


class GoogleEmbeddingFunction(EmbeddingFunction[Documents]):
    def __init__(self) -> None:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        self._client = genai.Client(api_key=api_key)

    def __call__(self, input: Documents) -> Embeddings:
        all_embeddings: Embeddings = []
        for i in range(0, len(input), EMBED_BATCH_SIZE):
            batch = input[i : i + EMBED_BATCH_SIZE]
            response = self._embed_batch_with_retry(batch)
            all_embeddings.extend(e.values for e in response.embeddings)
        return all_embeddings

    def _embed_batch_with_retry(self, texts: list[str], max_retries: int = 5):
        for attempt in range(max_retries):
            try:
                return self._client.models.embed_content(
                    model=EMBEDDING_MODEL,
                    contents=texts,
                )
            except (TransportError, ConnectionError, OSError) as e:
                if attempt == max_retries - 1:
                    raise
                wait = 2 ** attempt
                logger.warning("Embedding API error (attempt %d/%d), retrying in %ds: %s",
                               attempt + 1, max_retries, wait, e)
                time.sleep(wait)


_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=CHROMA_DIR)
    return _client


def get_collection() -> chromadb.Collection:
    global _collection
    if _collection is None:
        client = _get_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=GoogleEmbeddingFunction(),
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def search(query: str, n_results: int = TOP_K) -> list[dict]:
    """Embed the query and return the top-k most relevant policy chunks."""
    collection = get_collection()

    if collection.count() == 0:
        logger.warning("Policy collection is empty — run the ingestion script first")
        return []

    results = collection.query(query_texts=[query], n_results=n_results)

    chunks: list[dict] = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        chunks.append({
            "text": doc,
            "policy_id": meta.get("policy_id", ""),
            "title": meta.get("title", ""),
            "page": meta.get("page", ""),
            "source_file": meta.get("source_file", ""),
        })
    return chunks
