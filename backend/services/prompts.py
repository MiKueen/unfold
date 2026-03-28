from services.document_processor import ProcessedDocument, DocumentChunk

SYSTEM_PROMPT = """You are Unfold, an AI assistant that helps users understand and explore their Google Drive folder contents.

RULES:
1. Answer ONLY based on the provided folder contents. If information is not in the documents, say so clearly.
2. ALWAYS cite your sources using [1], [2], etc. markers inline with your response.
3. After your response, output a JSON citations block in this exact format:
   <!--CITATIONS_START-->
   [{"index":1,"fileName":"example.docx","filePath":"Reports/example.docx","excerpt":"relevant quote from the source"}]
   <!--CITATIONS_END-->
4. Be concise but thorough. Use markdown formatting for readability.
5. When quoting data or specific claims, include the exact excerpt in the citation."""


def build_full_context_prompt(documents: list[ProcessedDocument]) -> str:
    parts = ["=== FOLDER CONTENTS (ALL FILES) ===\n"]
    for doc in documents:
        parts.append(f"--- FILE: {doc.file_path}/{doc.file_name} ---")
        parts.append(doc.full_text)
        parts.append("")
    return "\n".join(parts)


def build_rag_prompt(chunks: list[DocumentChunk]) -> str:
    parts = ["=== RELEVANT EXCERPTS FROM FOLDER ===\n"]
    for i, chunk in enumerate(chunks):
        parts.append(f"--- [Source {i + 1}] {chunk.file_path}/{chunk.file_name} ---")
        parts.append(chunk.content)
        parts.append("")
    return "\n".join(parts)


def build_comparison_prompt(
    folders: list[tuple[str, list[ProcessedDocument]]],
) -> str:
    """folders is a list of (folder_name, documents) tuples — one per loaded folder."""
    parts = ["=== FOLDER CONTENTS FOR COMPARISON ===\n"]
    for folder_name, docs in folders:
        parts.append(f"{'='*60}")
        parts.append(f"FOLDER: {folder_name}")
        parts.append(f"{'='*60}")
        for doc in docs:
            parts.append(f"--- FILE: {doc.file_path}/{doc.file_name} ---")
            parts.append(doc.full_text)
            parts.append("")
    parts.append(
        "\nInstructions: The user wants a comparison. "
        "Compare the folders listed above BY NAME. "
        "Do NOT regroup or reclassify documents — treat each FOLDER section as a single unit. "
        "Highlight what is unique to each folder and any meaningful overlaps."
    )
    return "\n".join(parts)
