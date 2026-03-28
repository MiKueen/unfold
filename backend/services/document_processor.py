from dataclasses import dataclass, field
import re
from services.token_estimator import estimate_tokens

CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200


@dataclass
class DocumentChunk:
    id: str
    file_id: str
    file_name: str
    file_path: str
    mime_type: str
    content: str
    chunk_index: int
    total_chunks: int
    web_view_link: str = ""


@dataclass
class ProcessedDocument:
    file_id: str
    file_name: str
    file_path: str
    mime_type: str
    full_text: str
    chunks: list[DocumentChunk] = field(default_factory=list)
    token_estimate: int = 0
    web_view_link: str = ""
    is_truncated: bool = False


def _split_into_chunks(text: str) -> list[str]:
    if len(text) <= CHUNK_SIZE:
        return [text]

    chunks = []
    start = 0

    while start < len(text):
        end = start + CHUNK_SIZE

        if end < len(text):
            # Try paragraph boundary
            pb = text.rfind("\n\n", start, end)
            if pb > start + CHUNK_SIZE // 2:
                end = pb + 2
            else:
                # Try sentence boundary
                sb = text.rfind(". ", start, end)
                if sb > start + CHUNK_SIZE // 2:
                    end = sb + 2

        end = min(end, len(text))
        chunks.append(text[start:end])
        start = end - CHUNK_OVERLAP
        if end >= len(text):
            break

    return chunks


def process_document(
    file_id: str,
    file_name: str,
    file_path: str,
    mime_type: str,
    raw_text: str,
    is_truncated: bool = False,
    web_view_link: str = "",
) -> ProcessedDocument:
    # Production Quality: Robust sanitization for LLM context
    clean = raw_text.replace("\x00", "").replace("\r\n", "\n").strip()
    
    # Remove non-printable characters that can confuse some tokenizers
    clean = "".join(char for char in clean if char.isprintable() or char in "\n\t")

    # Collapse excessive blank lines to save context window space
    clean = re.sub(r"\n{4,}", "\n\n\n", clean)
    
    text_chunks = _split_into_chunks(clean)
    chunks = [
        DocumentChunk(
            id=f"{file_id}-chunk-{i}",
            file_id=file_id,
            file_name=file_name,
            file_path=file_path,
            mime_type=mime_type,
            content=content,
            chunk_index=i,
            total_chunks=len(text_chunks),
            web_view_link=web_view_link,
        )
        for i, content in enumerate(text_chunks)
    ]

    return ProcessedDocument(
        file_id=file_id,
        file_name=file_name,
        file_path=file_path,
        mime_type=mime_type,
        full_text=clean,
        chunks=chunks,
        token_estimate=estimate_tokens(clean),
        web_view_link=web_view_link,
        is_truncated=is_truncated,
    )
