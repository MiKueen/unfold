import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, Citation } from "../types";

export function parseCitations(content: string): { text: string; citations: Citation[] } {
  const start = content.indexOf("<!--CITATIONS_START-->");
  if (start === -1) return { text: content, citations: [] };
  const end = content.indexOf("<!--CITATIONS_END-->");
  const text = content.slice(0, start).trim();
  try {
    const raw = content.slice(start + 22, end === -1 ? undefined : end).trim();
    const citations = JSON.parse(raw);
    return { text, citations: Array.isArray(citations) ? (citations as Citation[]) : [] };
  } catch {
    return { text, citations: [] };
  }
}

function CitationCard({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="hover:border-[#3a3a40] transition-colors"
      style={{
        border: '1px solid #252528',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: '#111114',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left cursor-pointer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          background: 'none',
          border: 'none',
        }}
      >
        <span
          className="font-mono font-bold shrink-0 tabular-nums"
          style={{
            backgroundColor: 'rgba(109,94,252,0.15)',
            color: '#a78bfa',
            borderRadius: '6px',
            padding: '2px 6px',
            fontSize: '10px',
          }}
        >
          {citation.index}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[#c8c8d4] truncate" style={{ fontSize: '12px' }}>
            {citation.fileName}
          </p>
          {citation.filePath && citation.filePath !== citation.fileName && (
            <p className="text-[#4a4a54] truncate" style={{ fontSize: '10px', marginTop: '2px' }}>
              {citation.filePath}
            </p>
          )}
        </div>
        {citation.webViewLink && (
          <a
            href={citation.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[#5c5c6e] hover:text-[#6d5efc] shrink-0 transition-colors"
            style={{ fontSize: '13px', padding: '0 4px' }}
            title="Open in Drive"
          >
            ↗
          </a>
        )}
        <span
          className="text-[#4a4a54] shrink-0 transition-transform duration-200"
          style={{
            fontSize: '9px',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </button>
      {open && citation.excerpt && (
        <div
          style={{
            padding: '0 12px 12px 12px',
            borderTop: '1px solid #1e1e22',
          }}
        >
          <p
            className="text-[#7a7a8a] leading-relaxed italic"
            style={{
              fontSize: '11px',
              paddingTop: '10px',
              paddingLeft: '8px',
              borderLeft: '2px solid #3d3d48',
            }}
          >
            &ldquo;{citation.excerpt}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center" style={{ gap: '6px', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="rounded-full bg-[#6d5efc]"
          style={{
            width: '6px',
            height: '6px',
            animation: `pulse-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

interface Props {
  message: Message;
  isStreaming?: boolean;
  onRetry?: (messageId: string) => void;
}

function HydeCard({ answer }: { answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: 'rgba(245,158,11,0.05)',
        marginBottom: '4px',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left cursor-pointer hover:bg-amber-500/5 transition-colors"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 12px',
          background: 'none',
          border: 'none',
        }}
      >
        <span style={{ fontSize: '11px' }}>🔍</span>
        <span className="font-medium text-amber-500/80 flex-1" style={{ fontSize: '11px', letterSpacing: '0.03em' }}>
          RAG · Retrieved using hypothetical answer
        </span>
        <span
          className="text-amber-600/60 transition-transform duration-200"
          style={{ fontSize: '9px', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 10px', borderTop: '1px solid rgba(245,158,11,0.1)' }}>
          <p
            className="text-amber-200/50 italic leading-relaxed"
            style={{ fontSize: '12px', paddingTop: '8px', paddingLeft: '8px', borderLeft: '2px solid rgba(245,158,11,0.25)' }}
          >
            &ldquo;{answer}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message, isStreaming = false, onRetry }: Props) {
  const { text, citations } = parseCitations(message.content);
  const isEmpty = message.role === "assistant" && !text;

  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div
          className="text-white break-words"
          style={{
            maxWidth: '78%',
            backgroundColor: '#6d5efc',
            borderRadius: '18px',
            borderTopRightRadius: '4px',
            padding: '10px 16px',
            fontSize: '14px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-in-up" style={{ gap: '12px' }}>
      <div
        className="rounded-full bg-gradient-to-br from-[#6d5efc] to-[#4f46e5] flex items-center justify-center font-bold text-white shrink-0"
        style={{
          width: '28px',
          height: '28px',
          fontSize: '10px',
          marginTop: '2px',
        }}
      >
        UF
      </div>
      <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {message.hydeAnswer && <HydeCard answer={message.hydeAnswer} />}
        <div style={{ fontSize: '14px', lineHeight: '1.7' }}>
          {isEmpty ? (
            <TypingDots />
          ) : message.error ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                className="text-red-400"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                }}
              >
                {text || "Something went wrong. Please try again."}
              </div>
              {onRetry && (
                <button
                  onClick={() => onRetry(message.id)}
                  className="text-[#8b8b99] hover:text-[#e8e8ed] hover:bg-[#1e1e22] transition-all cursor-pointer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #2d2d32',
                    backgroundColor: 'transparent',
                    fontSize: '12px',
                    alignSelf: 'flex-start',
                  }}
                >
                  ↺ Retry
                </button>
              )}
            </div>
          ) : (
            <div className={`dark-prose ${isStreaming && citations.length === 0 ? "streaming-cursor" : ""}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
          )}
        </div>
        {citations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
            <div className="flex items-center" style={{ gap: '8px' }}>
              <span
                className="font-semibold text-[#4a4a54] uppercase"
                style={{ fontSize: '10px', letterSpacing: '0.08em' }}
              >
                Sources
              </span>
              <span className="text-[#3a3a3e] tabular-nums" style={{ fontSize: '10px' }}>
                {citations.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {citations.map((c, i) => <CitationCard key={i} citation={c} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
