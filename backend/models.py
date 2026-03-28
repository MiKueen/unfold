from pydantic import BaseModel
from typing import Optional


class DriveFile(BaseModel):
    id: str
    name: str
    mimeType: str
    size: Optional[str] = None
    modifiedTime: Optional[str] = None
    webViewLink: Optional[str] = None
    path: Optional[str] = None


class DriveFolder(BaseModel):
    id: str
    name: str
    files: list["DriveFolder | DriveFile"] = []
    subfolders: list["DriveFolder"] = []


class FolderListResponse(BaseModel):
    folder: dict
    totalFiles: int
    supportedFiles: int
    flatFiles: list[DriveFile]
    unsupportedCount: int


class IngestRequest(BaseModel):
    folderId: str
    folderName: str
    files: list[DriveFile]
    isLastBatch: bool
    existingTokenCount: int
    batchIndex: int


class IngestResponse(BaseModel):
    batchTokens: int
    batchDocuments: int
    errors: list[str]
    done: bool
    strategy: Optional[str] = None
    totalTokens: Optional[int] = None
    totalFiles: Optional[int] = None
    truncatedFiles: list[str] = []


class ChatRequest(BaseModel):
    folderIds: list[str]
    messages: list[dict]
    query: str


class Citation(BaseModel):
    index: int
    fileName: str
    filePath: str
    excerpt: str
    webViewLink: Optional[str] = None
