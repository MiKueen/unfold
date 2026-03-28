import { useState } from "react";
import type { DriveFile, FolderNode } from "../types";

function mimeIcon(mimeType: string): string {
  if (mimeType.includes("document"))     return "📝";
  if (mimeType.includes("spreadsheet"))  return "📊";
  if (mimeType.includes("presentation")) return "📽️";
  if (mimeType === "application/pdf")    return "📕";
  if (mimeType.startsWith("image/"))     return "🖼️";
  if (mimeType.includes("text/"))        return "📄";
  return "📄";
}

function FileRow({ file }: { file: DriveFile }) {
  return (
    <div
      className="flex items-center group cursor-default hover:bg-[#1e1e22] transition-colors"
      style={{
        gap: '8px',
        padding: '4px 8px',
        borderRadius: '6px',
      }}
    >
      <span className="shrink-0" style={{ fontSize: '12px', lineHeight: 1 }}>
        {mimeIcon(file.mimeType)}
      </span>
      <span
        className="text-[#8b8b99] group-hover:text-[#c8c8d4] truncate flex-1 transition-colors"
        style={{ fontSize: '12px' }}
      >
        {file.name}
      </span>
      {file.webViewLink && (
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 text-[#5c5c6e] hover:text-[#6d5efc] transition-all shrink-0"
          style={{ fontSize: '11px' }}
        >
          ↗
        </a>
      )}
    </div>
  );
}

function FolderRow({ node, depth }: { node: FolderNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const total = node.files.length + node.subfolders.reduce((acc, s) => acc + s.files.length, 0);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left hover:bg-[#1e1e22] transition-colors cursor-pointer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          borderRadius: '6px',
          background: 'none',
          border: 'none',
        }}
      >
        <span
          className="text-[#5c5c6e] shrink-0 transition-transform duration-150"
          style={{
            fontSize: '10px',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
        <span className="shrink-0" style={{ fontSize: '12px' }}>
          {open ? "📂" : "📁"}
        </span>
        <span
          className="font-medium text-[#c8c8d4] truncate flex-1"
          style={{ fontSize: '12px' }}
        >
          {node.name}
        </span>
        <span className="text-[#5c5c6e] shrink-0 tabular-nums" style={{ fontSize: '10px' }}>
          {total}
        </span>
      </button>
      {open && (
        <div
          style={{
            marginLeft: '12px',
            borderLeft: '1px solid #252528',
            paddingLeft: '6px',
            marginTop: '2px',
          }}
        >
          {node.subfolders.map(s => <FolderRow key={s.id} node={s} depth={depth + 1} />)}
          {node.files.map(f => <FileRow key={f.id} file={f} />)}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ node }: { node: FolderNode }) {
  return <FolderRow node={node} depth={0} />;
}
