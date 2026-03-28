import { useState, useRef, useEffect } from "react";
import type { FolderNode, Message, Strategy } from "../types";
import FileTree from "./FileTree";
import MessageBubble, { parseCitations } from "./MessageBubble";

interface Props {
  folderTrees: FolderNode[];
  folderNames: string[];
  strategy: Strategy;
  totalTokens: number;
  messages: Message[];
  suggestedQuestions: string[];
  suggestionsLoading: boolean;
  chatLoading: boolean;
  userEmail: string;
  userPicture: string;
  addFolderLoading: boolean;
  addFolderError: string;
  truncatedFiles: string[];
  onSend: (query: string) => void;
  onStop: () => void;
  onRetry: (messageId: string) => void;
  onSignOut: () => void;
  onNewFolder: () => void;
  onAddFolder: (url: string) => void;
}

export default function ChatScreen({
  folderTrees, folderNames, strategy, totalTokens,
  messages, suggestedQuestions, suggestionsLoading, chatLoading,
  userEmail, userPicture, addFolderLoading, addFolderError, truncatedFiles,
  onSend, onStop, onRetry, onSignOut, onNewFolder, onAddFolder,
}: Props) {
  const [input, setInput] = useState("");
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [addFolderUrl, setAddFolderUrl] = useState("");
  const [truncationDismissed, setTruncationDismissed] = useState(false);

  // Re-show the banner whenever a new set of truncated files arrives
  useEffect(() => {
    if (truncatedFiles.length > 0) setTruncationDismissed(false);
  }, [truncatedFiles]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close the add-folder panel once loading finishes successfully
  useEffect(() => {
    if (!addFolderLoading && addFolderOpen && !addFolderError && addFolderUrl) {
      setAddFolderOpen(false);
      setAddFolderUrl("");
    }
  }, [addFolderLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSend() {
    const q = input.trim();
    if (!q || chatLoading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "24px";
    onSend(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  function handleSuggestion(q: string) {
    onSend(q);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleAddFolderSubmit() {
    if (!addFolderUrl.trim() || addFolderLoading) return;
    onAddFolder(addFolderUrl.trim());
  }

  function handleAddFolderKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAddFolderSubmit();
    if (e.key === "Escape") { setAddFolderOpen(false); setAddFolderUrl(""); }
  }

  const primaryName = folderNames[0] ?? "";
  const extraCount = folderNames.length - 1;
  const headerTitle = extraCount > 0 ? `${primaryName} +${extraCount}` : primaryName;
  const fullTitle = folderNames.join(" · ");

  const tokenDisplay = totalTokens >= 1000
    ? `${Math.round(totalTokens / 1000)}K tokens`
    : `${totalTokens} tokens`;

  const totalFileCount = folderTrees.reduce(
    (sum, t) => sum + t.files.length + t.subfolders.length, 0
  );

  function handleExport() {
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const strategyLabel = strategy === "full-context" ? "Full Context" : "RAG";
    const lines: string[] = [
      `# Unfold Export — ${fullTitle}`,
      `*${date} · ${strategyLabel} · ${tokenDisplay}*`,
      "",
      "---",
      "",
    ];
    for (const msg of messages) {
      if (msg.role === "user") {
        lines.push("**You**");
        lines.push(msg.content);
        lines.push("");
      } else {
        const { text, citations } = parseCitations(msg.content);
        lines.push("**Unfold**");
        lines.push(text);
        if (citations.length > 0) {
          lines.push("");
          lines.push("*Sources:*");
          for (const c of citations) {
            const link = c.webViewLink ? ` — [Open in Drive](${c.webViewLink})` : "";
            lines.push(`${c.index}. **${c.fileName}**${link}`);
            if (c.excerpt) lines.push(`   > ${c.excerpt}`);
          }
        }
        lines.push("");
        lines.push("---");
        lines.push("");
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unfold-${primaryName.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const lastMsg = messages[messages.length - 1];
  const isStreamingLast = chatLoading && !!lastMsg && lastMsg.role === "assistant";

  return (
    <div className="h-screen bg-[#0b0b0d] flex flex-col overflow-hidden">
      {/* Header */}
      <header
        className="shrink-0"
        style={{ borderBottom: '1px solid #252528', backgroundColor: '#0e0e11' }}
      >
        <div className="flex items-center justify-between" style={{ padding: '12px 20px' }}>
          <div className="flex items-center min-w-0" style={{ gap: '12px' }}>
            <div
              className="rounded-lg bg-gradient-to-br from-[#6d5efc] to-[#4f46e5] flex items-center justify-center shrink-0"
              style={{ width: '28px', height: '28px', fontSize: '14px' }}
            >
              🧠
            </div>
            <span className="font-semibold text-[#e8e8ed] shrink-0" style={{ fontSize: '14px' }}>
              Unfold
            </span>
            <span className="text-[#3a3a3e] shrink-0" style={{ fontSize: '18px', fontWeight: 200 }}>/</span>
            <span
              className="text-[#8b8b99] truncate"
              style={{ fontSize: '14px', maxWidth: '220px' }}
              title={fullTitle}
            >
              {headerTitle}
            </span>
          </div>

          <div className="flex items-center shrink-0" style={{ gap: '10px' }}>
            {/* Strategy badge */}
            <div
              className={`hidden sm:flex items-center font-medium ${strategy === "full-context" ? "text-[#a78bfa]" : "text-amber-400"}`}
              style={{
                gap: '6px', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px',
                backgroundColor: strategy === "full-context" ? 'rgba(109,94,252,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${strategy === "full-context" ? 'rgba(109,94,252,0.2)' : 'rgba(245,158,11,0.2)'}`,
              }}
            >
              <span>{strategy === "full-context" ? "⚡" : "🔍"}</span>
              <span>{strategy === "full-context" ? "Full Context" : "RAG"}</span>
              <span style={{ opacity: 0.5, fontSize: '11px' }}>· {tokenDisplay}</span>
            </div>

            {/* Add folder */}
            <button
              onClick={() => {
                setAddFolderOpen(o => !o);
                setTimeout(() => addFolderInputRef.current?.focus(), 50);
              }}
              className={`transition-all cursor-pointer ${addFolderOpen ? 'text-[#a78bfa]' : 'text-[#5c5c6e] hover:text-[#a78bfa]'}`}
              style={{
                fontSize: '12px', padding: '6px 12px', borderRadius: '8px',
                border: '1px solid transparent', background: 'none',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
              title="Add another folder to the conversation"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
              Add folder
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleExport}
                title="Export conversation as Markdown"
                className="text-[#5c5c6e] hover:text-[#a78bfa] transition-all cursor-pointer"
                style={{
                  fontSize: '12px', padding: '6px 12px', borderRadius: '8px',
                  border: '1px solid transparent', background: 'none',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </button>
            )}

            <button
              onClick={onNewFolder}
              className="text-[#5c5c6e] hover:text-[#c8c8d4] hover:bg-[#1e1e22] transition-all cursor-pointer"
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid transparent', background: 'none' }}
            >
              + New folder
            </button>

            <div style={{ width: '1px', height: '16px', backgroundColor: '#2d2d32' }} />

            {userPicture ? (
              <img src={userPicture} alt="" className="rounded-full" style={{ width: '28px', height: '28px', border: '1px solid #2d2d32' }} />
            ) : (
              <div
                className="rounded-full flex items-center justify-center font-medium text-[#a78bfa]"
                style={{ width: '28px', height: '28px', backgroundColor: 'rgba(109,94,252,0.15)', border: '1px solid rgba(109,94,252,0.25)', fontSize: '12px' }}
              >
                {userEmail[0]?.toUpperCase()}
              </div>
            )}

            <button
              onClick={onSignOut}
              className="text-[#5c5c6e] hover:text-[#8b8b99] transition-colors cursor-pointer"
              style={{ fontSize: '12px', background: 'none', border: 'none' }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Add folder panel */}
        {addFolderOpen && (
          <div style={{ padding: '0 20px 12px', borderTop: '1px solid #1e1e22' }}>
            <div className="flex items-center" style={{ gap: '8px', paddingTop: '12px' }}>
              <input
                ref={addFolderInputRef}
                value={addFolderUrl}
                onChange={e => setAddFolderUrl(e.target.value)}
                onKeyDown={handleAddFolderKeyDown}
                placeholder="Paste another Google Drive folder link..."
                disabled={addFolderLoading}
                className="flex-1 bg-[#141417] text-[#e8e8ed] placeholder:text-[#4a4a54] focus:outline-none disabled:opacity-40"
                style={{
                  padding: '8px 12px', borderRadius: '10px', fontSize: '13px',
                  border: '1px solid #2d2d32',
                }}
              />
              <button
                onClick={handleAddFolderSubmit}
                disabled={!addFolderUrl.trim() || addFolderLoading}
                className="shrink-0 bg-[#6d5efc] hover:bg-[#5b4eec] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all cursor-pointer"
                style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 500 }}
              >
                {addFolderLoading ? "Adding…" : "Add"}
              </button>
              <button
                onClick={() => { setAddFolderOpen(false); setAddFolderUrl(""); }}
                className="text-[#5c5c6e] hover:text-[#8b8b99] transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none', fontSize: '18px', lineHeight: 1, padding: '4px' }}
              >
                ×
              </button>
            </div>
            {addFolderError && (
              <p className="text-red-400" style={{ fontSize: '12px', marginTop: '6px' }}>
                {addFolderError}
              </p>
            )}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="hidden md:flex flex-col shrink-0"
          style={{ width: '224px', borderRight: '1px solid #252528', backgroundColor: '#0e0e11' }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 16px', borderBottom: '1px solid #252528' }}
          >
            <span className="font-semibold text-[#6d5efc] uppercase" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
              Files
            </span>
            <span className="text-[#5c5c6e] tabular-nums" style={{ fontSize: '11px' }}>
              {totalFileCount}
            </span>
          </div>
          <div className="flex-1 overflow-auto" style={{ padding: '8px' }}>
            {folderTrees.map((tree, i) => (
              <div key={tree.id}>
                {folderTrees.length > 1 && (
                  <p
                    className="text-[#4a4a54] font-medium truncate"
                    style={{ fontSize: '10px', padding: '8px 8px 4px', letterSpacing: '0.05em' }}
                    title={folderNames[i]}
                  >
                    {folderNames[i]}
                  </p>
                )}
                <FileTree node={tree} />
              </div>
            ))}
          </div>
        </aside>

        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0">
          {truncatedFiles.length > 0 && !truncationDismissed && (
            <div
              className="shrink-0 flex items-start justify-between"
              style={{
                backgroundColor: 'rgba(245,158,11,0.08)',
                borderBottom: '1px solid rgba(245,158,11,0.2)',
                padding: '8px 20px',
                gap: '12px',
              }}
            >
              <p className="text-amber-400" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                <span style={{ fontWeight: 600 }}>⚠ Truncated:</span>{' '}
                {truncatedFiles.length === 1
                  ? <><span className="text-amber-300">{truncatedFiles[0]}</span> was truncated at 100K chars.</>
                  : <>{truncatedFiles.length} files were truncated at 100K chars:{' '}
                    <span className="text-amber-300">{truncatedFiles.join(', ')}</span>.</>
                }{' '}
                Answers about these files may be incomplete.
              </p>
              <button
                onClick={() => setTruncationDismissed(true)}
                className="shrink-0 text-amber-600 hover:text-amber-400 transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none', fontSize: '16px', lineHeight: 1, padding: '2px' }}
                title="Dismiss"
              >
                ×
              </button>
            </div>
          )}
          <div className="flex-1 overflow-auto">
            <div style={{ maxWidth: '768px', margin: '0 auto', padding: '32px 24px' }}>
              {messages.length === 0 ? (
                <EmptyState
                  folderName={fullTitle}
                  suggestedQuestions={suggestedQuestions}
                  suggestionsLoading={suggestionsLoading}
                  onSuggestion={handleSuggestion}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {messages.map((msg, i) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isStreaming={isStreamingLast && i === messages.length - 1}
                      onRetry={onRetry}
                    />
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input area */}
          <div
            className="shrink-0"
            style={{ borderTop: '1px solid #252528', backgroundColor: '#0e0e11', padding: '16px 24px' }}
          >
            <div style={{ maxWidth: '768px', margin: '0 auto' }}>
              <div
                className={`flex items-end transition-all duration-150 ${chatLoading ? "" : "focus-within:border-[#6d5efc]/60 focus-within:ring-2 focus-within:ring-[#6d5efc]/10"}`}
                style={{
                  gap: '12px', backgroundColor: '#141417',
                  border: `1px solid ${chatLoading ? '#252528' : '#2d2d32'}`,
                  borderRadius: '16px', padding: '12px 16px',
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={folderTrees.length > 1 ? `Ask anything across ${folderTrees.length} folders...` : "Ask anything about this folder..."}
                  disabled={chatLoading}
                  rows={1}
                  className="flex-1 bg-transparent text-[#e8e8ed] placeholder:text-[#4a4a54] focus:outline-none resize-none leading-relaxed disabled:opacity-40"
                  style={{ fontSize: '15px', minHeight: '24px', maxHeight: '160px', border: 'none' }}
                />
                {chatLoading ? (
                  <button
                    onClick={onStop}
                    className="shrink-0 flex items-center justify-center transition-all active:scale-95 cursor-pointer hover:bg-red-600"
                    style={{ width: '36px', height: '36px', borderRadius: '12px', border: 'none', backgroundColor: '#ef4444' }}
                    title="Stop generating"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                      <rect x="1" y="1" width="10" height="10" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="shrink-0 bg-[#6d5efc] hover:bg-[#5b4eec] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                    style={{ width: '36px', height: '36px', borderRadius: '12px', border: 'none' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-[#3a3a3e] text-center" style={{ fontSize: '11px', marginTop: '8px' }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  folderName, suggestedQuestions, suggestionsLoading, onSuggestion,
}: {
  folderName: string;
  suggestedQuestions: string[];
  suggestionsLoading: boolean;
  onSuggestion: (q: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '40px' }}>
      <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div
          className="flex items-center justify-center"
          style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: 'rgba(109,94,252,0.1)', border: '1px solid rgba(109,94,252,0.2)', fontSize: '20px' }}
        >
          ✨
        </div>
        <div>
          <h3 className="font-semibold text-[#f4f4f8]" style={{ fontSize: '18px' }}>Ready to explore</h3>
          <p className="text-[#5c5c6e]" style={{ fontSize: '14px', marginTop: '6px' }}>
            Ask anything about <span className="text-[#a78bfa] font-medium">{folderName}</span>
          </p>
        </div>
      </div>

      <div className="w-full" style={{ maxWidth: '560px' }}>
        {suggestionsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <p className="font-semibold text-[#4a4a54] uppercase text-center" style={{ fontSize: '11px', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Generating suggestions...
            </p>
            {[85, 70, 80, 65].map((w, i) => (
              <div key={i} className="animate-pulse" style={{ height: '48px', backgroundColor: '#141417', border: '1px solid #252528', borderRadius: '12px', width: `${w}%` }} />
            ))}
          </div>
        ) : suggestedQuestions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p className="font-semibold text-[#4a4a54] uppercase text-center" style={{ fontSize: '11px', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Suggested questions
            </p>
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onSuggestion(q)}
                className="w-full text-left hover:border-[#6d5efc]/40 hover:bg-[#16161c] transition-all duration-200 group animate-fade-in-up cursor-pointer"
                style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', borderRadius: '12px', border: '1px solid #252528', backgroundColor: '#141417', animationDelay: `${i * 70}ms`, animationFillMode: 'both' }}
              >
                <span className="shrink-0 font-medium group-hover:translate-x-0.5 transition-transform" style={{ color: '#6d5efc', marginTop: '1px' }}>→</span>
                <span className="group-hover:text-[#e8e8ed] transition-colors" style={{ fontSize: '14px', color: '#c8c8d4', lineHeight: '1.6' }}>{q}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center" style={{ gap: '8px' }}>
            {STARTER_HINTS.map(hint => (
              <button
                key={hint}
                onClick={() => onSuggestion(hint)}
                className="text-[#5c5c6e] hover:border-[#3d3d42] hover:text-[#8b8b99] hover:bg-[#1a1a1e] transition-all cursor-pointer"
                style={{ padding: '8px 16px', borderRadius: '9999px', border: '1px solid #252528', backgroundColor: '#141417', fontSize: '14px' }}
              >
                {hint}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const STARTER_HINTS = [
  "Summarize the key topics",
  "What files are in this folder?",
  "Extract any action items",
];
