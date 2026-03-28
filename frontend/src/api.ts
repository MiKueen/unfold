import type { DriveFile, FolderNode, Strategy } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface ListFolderResult {
  folder: FolderNode;
  flatFiles: DriveFile[];
  supportedFiles: number;
}

export interface IngestBatchPayload {
  folderId: string;
  folderName: string;
  files: DriveFile[];
  isLastBatch: boolean;
  existingTokenCount: number;
  batchIndex: number;
}

export interface IngestBatchResult {
  batchTokens?: number;
  done: boolean;
  strategy: Strategy;
  totalTokens: number;
  truncatedFiles?: string[];
}

export async function listFolder(token: string, url: string): Promise<ListFolderResult> {
  const res = await fetch(`${API_URL}/api/drive/list?url=${encodeURIComponent(url)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.detail as string) || "Failed to list folder");
  return data as ListFolderResult;
}

export async function ingestBatch(token: string, payload: IngestBatchPayload): Promise<IngestBatchResult> {
  const res = await fetch(`${API_URL}/api/drive/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.detail as string) || "Ingestion failed");
  return data as IngestBatchResult;
}

const HYDE_START = "\x00HYDE\x00";
const HYDE_END = "\x00ENDH\x00";
// Max size of the HyDE preamble — if buffer grows beyond this with no marker,
// it means we're in full-context mode and should flush normally.
const HYDE_MAX_BUF = 1200;

export async function chatStream(
  token: string,
  folderIds: string[],
  messages: { role: string; content: string }[],
  query: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onHyde?: (answer: string) => void,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ folderIds, messages, query }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error((data.detail as string) || "Chat failed");
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  let hydeBuf = "";
  let hydeResolved = false;

  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });

    if (!hydeResolved) {
      hydeBuf += chunk;
      const endIdx = hydeBuf.indexOf(HYDE_END);
      if (endIdx !== -1) {
        // Found the full HyDE marker — extract and fire callback
        const startIdx = hydeBuf.indexOf(HYDE_START);
        if (startIdx !== -1 && onHyde) {
          onHyde(hydeBuf.slice(startIdx + HYDE_START.length, endIdx));
        }
        // Everything after the marker is real content
        const remainder = hydeBuf.slice(endIdx + HYDE_END.length);
        if (remainder) onChunk(remainder);
        hydeResolved = true;
      } else if (hydeBuf.length > HYDE_MAX_BUF) {
        // Buffer too large — no HyDE marker present (full-context mode), flush
        onChunk(hydeBuf);
        hydeBuf = "";
        hydeResolved = true;
      }
      continue;
    }

    onChunk(chunk);
  }

  // Stream ended before HyDE marker was found — flush buffer (full-context mode)
  if (!hydeResolved && hydeBuf) onChunk(hydeBuf);
}
