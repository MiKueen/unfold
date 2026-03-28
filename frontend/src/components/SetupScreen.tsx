import type { FolderNode, IngestionProgress, Phase } from "../types";
import FileTree from "./FileTree";

interface Props {
  phase: Phase;
  folderUrl: string;
  onFolderUrlChange: (url: string) => void;
  onIngest: () => void;
  progress: IngestionProgress;
  folderTree: FolderNode | null;
  error: string;
  userEmail: string;
  userPicture: string;
  onSignOut: () => void;
}

export default function SetupScreen({
  phase, folderUrl, onFolderUrlChange, onIngest,
  progress, folderTree, error, userEmail, userPicture, onSignOut,
}: Props) {
  const pct = progress.total ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0b0b0d] flex flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-between shrink-0"
        style={{
          borderBottom: '1px solid #252528',
          backgroundColor: '#0e0e11',
          padding: '12px 20px',
        }}
      >
        <div className="flex items-center" style={{ gap: '10px' }}>
          <div
            className="rounded-lg bg-gradient-to-br from-[#6d5efc] to-[#4f46e5] flex items-center justify-center"
            style={{ width: '28px', height: '28px', fontSize: '14px' }}
          >
            🧠
          </div>
          <span className="font-semibold text-[#e8e8ed]" style={{ fontSize: '14px' }}>
            Unfold
          </span>
        </div>
        <div className="flex items-center" style={{ gap: '12px' }}>
          {userPicture ? (
            <img
              src={userPicture}
              alt=""
              className="rounded-full"
              style={{
                width: '28px',
                height: '28px',
                border: '1px solid #2d2d32',
              }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center font-medium text-[#a78bfa]"
              style={{
                width: '28px',
                height: '28px',
                backgroundColor: 'rgba(109,94,252,0.15)',
                border: '1px solid rgba(109,94,252,0.25)',
                fontSize: '12px',
              }}
            >
              {userEmail[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-[#8b8b99] hidden sm:block" style={{ fontSize: '13px' }}>
            {userEmail}
          </span>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#2d2d32' }} />
          <button
            onClick={onSignOut}
            className="text-[#5c5c6e] hover:text-[#8b8b99] transition-colors cursor-pointer"
            style={{ fontSize: '12px', background: 'none', border: 'none' }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center" style={{ padding: '32px' }}>
        {/* Idle — URL input */}
        {phase === "idle" && (
          <div className="w-full animate-fade-in-up" style={{ maxWidth: '640px' }}>
            {/* Section heading */}
            <div className="text-center" style={{ marginBottom: '40px' }}>
              <h2
                className="font-semibold text-[#f4f4f8] tracking-tight"
                style={{ fontSize: '24px', lineHeight: '1.3' }}
              >
                What would you like to explore?
              </h2>
              <p className="text-[#8b8b99]" style={{ marginTop: '10px', fontSize: '15px' }}>
                Paste any Google Drive link — folder, document, spreadsheet, or PDF
              </p>
            </div>

            {/* Input card */}
            <div
              className="rounded-2xl"
              style={{
                backgroundColor: '#141417',
                border: '1px solid #2d2d32',
                padding: '6px',
              }}
            >
              <div className="flex items-center" style={{ gap: '8px', padding: '12px 16px' }}>
                <span className="shrink-0" style={{ color: '#5c5c6e', fontSize: '16px' }}>🔗</span>
                <input
                  value={folderUrl}
                  onChange={e => onFolderUrlChange(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && onIngest()}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="flex-1 bg-transparent text-[#e8e8ed] placeholder:text-[#4a4a54] focus:outline-none"
                  style={{ fontSize: '15px', border: 'none' }}
                  autoFocus
                />
                <button
                  onClick={onIngest}
                  disabled={!folderUrl.trim()}
                  className="shrink-0 bg-[#6d5efc] hover:bg-[#5b4eec] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all active:scale-[0.98] cursor-pointer"
                  style={{
                    borderRadius: '12px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    border: 'none',
                  }}
                >
                  Analyze →
                </button>
              </div>
            </div>

            {error && (
              <div
                className="text-red-400 rounded-xl"
                style={{
                  marginTop: '16px',
                  backgroundColor: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  padding: '12px 16px',
                  fontSize: '14px',
                }}
              >
                {error}
              </div>
            )}

            {/* Supported types hint */}
            <div
              className="flex items-center justify-center text-[#4a4a54]"
              style={{ gap: '24px', marginTop: '32px', fontSize: '12px' }}
            >
              {[
                { icon: "📁", label: "Folders" },
                { icon: "📝", label: "Docs" },
                { icon: "📊", label: "Sheets" },
                { icon: "📽️", label: "Slides" },
                { icon: "📕", label: "PDFs" },
              ].map(({ icon, label }) => (
                <span key={label} className="flex items-center" style={{ gap: '6px' }}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Listing */}
        {phase === "listing" && (
          <div className="flex flex-col items-center animate-fade-in" style={{ gap: '20px' }}>
            <div className="flex" style={{ gap: '6px' }}>
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="rounded-full bg-[#6d5efc]"
                  style={{
                    width: '10px',
                    height: '10px',
                    animation: `pulse-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
            <div className="text-center">
              <p className="text-[#e8e8ed] font-medium" style={{ fontSize: '15px' }}>
                Scanning Drive...
              </p>
              <p className="text-[#5c5c6e]" style={{ fontSize: '13px', marginTop: '6px' }}>
                Reading folder structure and file list
              </p>
            </div>
          </div>
        )}

        {/* Ingesting */}
        {phase === "ingesting" && (
          <div className="w-full animate-fade-in" style={{ maxWidth: '480px' }}>
            {/* Header */}
            <div className="text-center" style={{ marginBottom: '32px' }}>
              <h2 className="font-semibold text-[#f4f4f8]" style={{ fontSize: '20px' }}>
                Ingesting files
              </h2>
              <p className="text-[#8b8b99]" style={{ marginTop: '8px', fontSize: '14px' }}>
                Downloading, parsing and embedding file content
              </p>
            </div>

            {/* Progress */}
            <div
              className="rounded-2xl"
              style={{
                backgroundColor: '#141417',
                border: '1px solid #2d2d32',
                padding: '20px',
              }}
            >
              <div className="flex items-center justify-between" style={{ fontSize: '14px' }}>
                <span className="text-[#c8c8d4] font-medium">
                  {progress.current} of {progress.total} files
                </span>
                <span className="text-[#6d5efc] font-semibold tabular-nums">
                  {Math.round(pct)}%
                </span>
              </div>

              <div
                className="rounded-full overflow-hidden"
                style={{
                  height: '6px',
                  backgroundColor: '#252528',
                  marginTop: '16px',
                }}
              >
                <div
                  className="h-full bg-gradient-to-r from-[#6d5efc] to-[#818cf8] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {progress.file && (
                <div
                  className="flex items-center text-[#5c5c6e]"
                  style={{ gap: '10px', fontSize: '13px', marginTop: '16px' }}
                >
                  <div
                    className="rounded-full bg-[#6d5efc] shrink-0"
                    style={{
                      width: '6px',
                      height: '6px',
                      animation: 'pulse-dot 1s ease-in-out infinite',
                    }}
                  />
                  <span className="truncate">{progress.file}</span>
                </div>
              )}
            </div>

            {/* File tree preview */}
            {folderTree && (
              <div
                className="rounded-2xl overflow-auto"
                style={{
                  marginTop: '16px',
                  backgroundColor: '#141417',
                  border: '1px solid #2d2d32',
                  padding: '16px',
                  maxHeight: '224px',
                }}
              >
                <p
                  className="font-semibold text-[#4a4a54] uppercase"
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    marginBottom: '12px',
                  }}
                >
                  Folder structure
                </p>
                <FileTree node={folderTree} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
