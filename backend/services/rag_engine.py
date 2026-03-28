import os
from google import genai
from google.genai import types
from services.vector_store import get_context, get_store
from services.embeddings import embed_query
from services.prompts import SYSTEM_PROMPT, build_full_context_prompt, build_rag_prompt, build_comparison_prompt
from services.document_processor import ProcessedDocument, DocumentChunk
from services.token_estimator import FULL_CONTEXT_THRESHOLD
from typing import Generator
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from google.genai.errors import ClientError


def _client() -> genai.Client:
    return genai.Client(api_key=os.environ["GOOGLE_GENERATIVE_AI_API_KEY"])


@retry(
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(ClientError),
)
def _generate_content_stream_with_retry(client, model, contents, config):
    return client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=config,
    )


def _load_doc(d: dict) -> ProcessedDocument:
    chunks = [DocumentChunk(**c) for c in d.get("chunks", [])]
    return ProcessedDocument(
        file_id=d["file_id"], file_name=d["file_name"],
        file_path=d["file_path"], mime_type=d["mime_type"],
        full_text=d["full_text"], chunks=chunks,
        token_estimate=d["token_estimate"], web_view_link=d.get("web_view_link", ""),
        is_truncated=d.get("is_truncated", False),
    )


def _generate_hypothetical_answer(client: genai.Client, query: str) -> str:
    """HyDE — Hypothetical Document Embeddings.

    Questions and document chunks occupy different regions of embedding space.
    By generating a plausible short answer first and embedding *that*, retrieval
    precision improves significantly because answer-embeddings align much closer
    to real document chunks than question-embeddings do.
    """
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=(
                "Write a concise, factual 2-3 sentence answer to the following question "
                "as if you were an expert with access to the relevant documents. "
                "Do not include citations, hedging, or expressions of uncertainty. "
                f"Question: {query}"
            ),
            config=types.GenerateContentConfig(max_output_tokens=200, temperature=0.1),
        )
        return response.text or query
    except Exception:
        return query  # fall back to raw query if generation fails


def create_chat_stream(
    context_keys: list[str],
    messages: list[dict],
    user_query: str,
) -> Generator[str, None, None]:
    # Load all folder contexts — supports single and multi-folder seamlessly.
    contexts = []
    for key in context_keys:
        ctx = get_context(key)
        if not ctx:
            raise ValueError("CONTEXT_NOT_FOUND")
        contexts.append(ctx)

    client = _client()

    is_comparison = any(
        kw in user_query.lower()
        for kw in ["compare", "difference", "contrast", "versus", " vs "]
    )

    # Merged strategy: use full-context only when ALL folders fit individually
    # AND their combined token count still stays within the threshold.
    all_full_context = all(ctx["strategy"] == "full-context" for ctx in contexts)
    combined_tokens = sum(ctx["totalTokens"] for ctx in contexts)

    if all_full_context and combined_tokens <= FULL_CONTEXT_THRESHOLD:
        if is_comparison:
            folders = [
                (ctx["folderName"], [_load_doc(d) for d in ctx["documents"]])
                for ctx in contexts
            ]
            context_content = build_comparison_prompt(folders)
        else:
            all_docs = [_load_doc(d) for ctx in contexts for d in ctx["documents"]]
            context_content = build_full_context_prompt(all_docs)
    else:
        # RAG mode with HyDE: embed a hypothetical answer instead of the raw
        # query to improve retrieval alignment across all folder vector stores.
        hypo_answer = _generate_hypothetical_answer(client, user_query)
        # Emit the hypothetical answer as a special first chunk so the UI can
        # surface it — makes HyDE visible without needing to inspect logs.
        yield f"\x00HYDE\x00{hypo_answer}\x00ENDH\x00"
        query_embedding = embed_query(hypo_answer)

        seen_ids: set[str] = set()
        all_chunks = []
        for key in context_keys:
            store = get_store(key)
            if store:
                for chunk in store.search(query_embedding, top_k=10):
                    if chunk.id not in seen_ids:
                        seen_ids.add(chunk.id)
                        all_chunks.append(chunk)

        context_content = build_rag_prompt(all_chunks[:20])

    # Build conversation history
    contents: list[types.Content] = [
        types.Content(role="user", parts=[types.Part(text=context_content)]),
        types.Content(
            role="model",
            parts=[types.Part(text="I've reviewed the folder contents and I'm ready to answer your questions. What would you like to know?")],
        ),
    ]

    for msg in messages[-6:]:
        role = "model" if msg.get("role") == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg.get("content", ""))]))

    contents.append(types.Content(role="user", parts=[types.Part(text=user_query)]))

    response = _generate_content_stream_with_retry(
        client,
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=4096,
        ),
    )
    for chunk in response:
        if chunk.text:
            yield chunk.text
