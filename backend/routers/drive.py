import logging
from fastapi import APIRouter, Header, HTTPException, Request

logger = logging.getLogger(__name__)
from services.google_drive import (
    create_drive_service, extract_drive_id,
    list_folder_recursive, get_single_file_as_folder, download_file_content,
)
from services.document_processor import process_document
from services.embeddings import embed_chunks
from services.vector_store import VectorStore, set_store, set_context, get_context
from services.token_estimator import FULL_CONTEXT_THRESHOLD
from services.limiter import limiter
from models import IngestRequest
from dataclasses import asdict

router = APIRouter()


def get_token(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    return authorization.removeprefix("Bearer ")


@router.get("/list")
async def list_drive_item(url: str, authorization: str = Header(...)):
    token = get_token(authorization)
    drive_id, item_type = extract_drive_id(url)
    if not drive_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid Google Drive URL. Paste a folder, file, Doc, Sheet, or Slides link.",
        )
    try:
        service = create_drive_service(token)

        # Resolve ambiguous IDs (e.g. drive.google.com/open?id=...) via the API
        if item_type == "unknown":
            meta = service.files().get(
                fileId=drive_id, fields="mimeType", supportsAllDrives=True
            ).execute()
            item_type = "folder" if meta.get("mimeType") == "application/vnd.google-apps.folder" else "file"

        if item_type == "folder":
            result = list_folder_recursive(service, drive_id)
        else:
            result = get_single_file_as_folder(service, drive_id)

        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        msg = str(e)
        if "404" in msg:
            raise HTTPException(status_code=404, detail="Item not found. Check the URL and sharing permissions.")
        if "403" in msg:
            raise HTTPException(status_code=403, detail="Access denied. Make sure you have permission to view this item.")
        raise HTTPException(status_code=500, detail=msg)


@router.post("/ingest")
@limiter.limit("5/minute")
async def ingest_files(request: Request, body: IngestRequest, authorization: str = Header(...)):
    token = get_token(authorization)
    context_key = f"{body.folderId}"

    try:
        service = create_drive_service(token)
        documents = []
        errors = []
        truncated_files: list[str] = []

        for file in body.files:
            try:
                logger.info(f"Downloading: {file.name} ({file.mimeType})")
                text, is_truncated = download_file_content(service, file.model_dump())
                if not text or not text.strip():
                    logger.warning(f"Empty content for {file.name} ({file.mimeType})")
                    errors.append(f"{file.name}: empty or unreadable")
                    continue
                logger.info(f"Extracted {len(text)} chars from {file.name}")
                doc = process_document(
                    file.id, file.name, file.path or "", file.mimeType, text, is_truncated, file.webViewLink or ""
                )
                if is_truncated:
                    truncated_files.append(file.name)
                documents.append(doc)
            except Exception as e:
                errors.append(f"{file.name}: {str(e)}")

        batch_tokens = sum(d.token_estimate for d in documents)

        if body.isLastBatch:
            total_tokens = body.existingTokenCount + batch_tokens
            existing = get_context(context_key)
            logger.info(f"Existing context for {context_key}: {existing}")
            existing_docs_raw = existing.get("documents", []) if existing else []

            from services.document_processor import ProcessedDocument, DocumentChunk
            existing_docs = []
            for d in existing_docs_raw:
                if isinstance(d, dict):
                    chunks = [DocumentChunk(**c) for c in d.get("chunks", [])]
                    existing_docs.append(ProcessedDocument(
                        file_id=d["file_id"], file_name=d["file_name"],
                        file_path=d["file_path"], mime_type=d["mime_type"],
                        full_text=d["full_text"], chunks=chunks,
                        token_estimate=d["token_estimate"], web_view_link=d.get("web_view_link", ""),
                        is_truncated=d.get("is_truncated", False)
                    ))

            all_docs = existing_docs + documents
            strategy = "full-context" if total_tokens <= FULL_CONTEXT_THRESHOLD else "rag"

            if strategy == "rag":
                all_chunks = [c for d in all_docs for c in d.chunks]
                embedded = embed_chunks(all_chunks)
                store = VectorStore()
                store.add_chunks(embedded)
                set_store(context_key, store)

            set_context(context_key, {
                "folderId": body.folderId,
                "folderName": body.folderName,
                "strategy": strategy,
                "totalTokens": total_tokens,
                "totalFiles": len(all_docs),
                "documents": [asdict(d) for d in all_docs],
            })

            return {
                "batchTokens": batch_tokens, "batchDocuments": len(documents),
                "errors": errors, "done": True, "strategy": strategy,
                "totalTokens": total_tokens, "totalFiles": len(all_docs),
                "truncatedFiles": truncated_files,
            }

        existing = get_context(context_key)
        prev_docs = existing.get("documents", []) if existing else []
        set_context(context_key, {
            "folderId": body.folderId,
            "folderName": body.folderName,
            "strategy": "full-context",
            "totalTokens": body.existingTokenCount + batch_tokens,
            "totalFiles": len(prev_docs) + len(documents),
            "documents": prev_docs + [asdict(d) for d in documents],
        })

        return {"batchTokens": batch_tokens, "batchDocuments": len(documents), "errors": errors, "done": False, "truncatedFiles": truncated_files}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
