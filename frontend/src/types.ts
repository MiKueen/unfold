export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  path?: string;
  webViewLink?: string;
}

export interface FolderNode {
  id: string;
  name: string;
  files: DriveFile[];
  subfolders: FolderNode[];
}

export interface Citation {
  index: number;
  fileName: string;
  filePath: string;
  excerpt: string;
  webViewLink?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  hydeAnswer?: string;
}

export interface IngestionProgress {
  current: number;
  total: number;
  file: string;
}

export type Phase = "login" | "idle" | "listing" | "ingesting" | "ready";
export type Strategy = "full-context" | "rag";
