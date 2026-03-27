"""
Ingest policy PDFs into the ChromaDB vector store.

Usage:
    cd backend
    python -m scripts.ingest_policies              # ingest new PDFs only
    python -m scripts.ingest_policies --force       # re-ingest all PDFs
    python -m scripts.ingest_policies path/to.pdf   # ingest specific files

Set R2_BUCKET to sync PDFs from Cloudflare R2 before ingestion.
"""

import os
import sys
import time
import logging
from pathlib import Path

from app.services.pdf_parser import extract_text_with_pages, parse_policy_metadata
from app.services.vector_store import get_collection

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

CHUNK_SIZE = 800
CHUNK_OVERLAP = 200
POLICIES_DIR = Path(__file__).resolve().parents[1] / "policies"


def sync_from_r2() -> None:
    """Download any new PDFs from Cloudflare R2 that aren't already in POLICIES_DIR."""
    bucket_name = os.environ.get("R2_BUCKET")
    if not bucket_name:
        return

    import boto3

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )

    prefix = os.environ.get("R2_PREFIX", "")
    POLICIES_DIR.mkdir(parents=True, exist_ok=True)
    local_files = {f.name for f in POLICIES_DIR.glob("*.pdf")}

    paginator = s3.get_paginator("list_objects_v2")
    downloaded = 0
    for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.lower().endswith(".pdf"):
                continue
            filename = Path(key).name
            if filename in local_files:
                continue
            dest = POLICIES_DIR / filename
            s3.download_file(bucket_name, key, str(dest))
            downloaded += 1

    logger.info("R2 sync: %d new PDFs downloaded from %s/%s",
                downloaded, bucket_name, prefix)


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks by character count."""
    if len(text) <= size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start += size - overlap
    return chunks


def ingest_file(pdf_path: Path, collection) -> int:
    """Ingest a single PDF into the collection. Returns the number of chunks added."""
    meta = parse_policy_metadata(str(pdf_path))
    policy_id = meta.get("policy_id", "") or pdf_path.stem
    title = meta.get("title", "")
    pages = extract_text_with_pages(str(pdf_path))

    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict] = []

    for page_num, page_text in pages:
        chunks = chunk_text(page_text)
        for ci, chunk in enumerate(chunks):
            doc_id = f"{policy_id}_p{page_num}_c{ci}"
            ids.append(doc_id)
            documents.append(chunk)
            metadatas.append({
                "policy_id": policy_id,
                "title": title,
                "page": f"Page {page_num}",
                "source_file": pdf_path.name,
            })

    if not documents:
        logger.warning("No text extracted from %s", pdf_path.name)
        return 0

    batch_size = 50
    for i in range(0, len(documents), batch_size):
        collection.upsert(
            ids=ids[i : i + batch_size],
            documents=documents[i : i + batch_size],
            metadatas=metadatas[i : i + batch_size],
        )
        if i + batch_size < len(documents):
            time.sleep(1)

    return len(documents)


def _ingested_source_files(collection) -> set[str]:
    """Return the set of source_file values already present in the collection."""
    if collection.count() == 0:
        return set()
    all_meta = collection.get(include=["metadatas"])["metadatas"]
    return {m["source_file"] for m in all_meta if m.get("source_file")}


def main(pdf_paths: list[Path] | None = None, force: bool = False):
    sync_from_r2()

    if pdf_paths is None:
        pdf_paths = sorted(POLICIES_DIR.rglob("*.pdf"))

    if not pdf_paths:
        logger.error("No PDF files found. Place policy PDFs in %s", POLICIES_DIR)
        return

    collection = get_collection()
    existing_files = set() if force else _ingested_source_files(collection)
    total = 0
    skipped = 0

    to_ingest = []
    for pdf_path in pdf_paths:
        if not pdf_path.exists():
            logger.error("File not found: %s", pdf_path)
            continue
        if pdf_path.name in existing_files:
            skipped += 1
            continue
        to_ingest.append(pdf_path)

    if skipped:
        logger.info("Skipping %d already-ingested files", skipped)
    logger.info("%d files to ingest", len(to_ingest))

    for idx, pdf_path in enumerate(to_ingest, 1):
        logger.info("[%d/%d] Ingesting %s ...", idx, len(to_ingest), pdf_path.name)
        count = ingest_file(pdf_path, collection)
        logger.info("[%d/%d]   -> %d chunks indexed", idx, len(to_ingest), count)
        total += count

    logger.info("Done. %d new chunks indexed, %d files skipped (%d total in collection).",
                total, skipped, collection.count())


if __name__ == "__main__":
    args = sys.argv[1:]
    force = "--force" in args
    paths_args = [a for a in args if a != "--force"]
    paths = [Path(p) for p in paths_args] if paths_args else None
    main(paths, force=force)
