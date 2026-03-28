interface Props {
  onLogin: () => void;
  error: string;
}

export default function LoginScreen({ onLogin, error }: Props) {
  return (
    <div className="min-h-screen bg-[#0b0b0d] flex flex-col items-center justify-center relative overflow-hidden"
      style={{ padding: '24px' }}
    >
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#6d5efc]/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full animate-fade-in-up"
        style={{ maxWidth: '420px', gap: '48px' }}
      >
        {/* Logo + Title */}
        <div className="flex flex-col items-center" style={{ gap: '16px' }}>
          <div
            className="rounded-2xl bg-gradient-to-br from-[#6d5efc] to-[#4f46e5] flex items-center justify-center shadow-2xl shadow-[#6d5efc]/30"
            style={{ width: '64px', height: '64px', fontSize: '28px' }}
          >
            🧠
          </div>
          <div className="text-center">
            <h1
              className="font-bold text-[#f4f4f8] tracking-tight"
              style={{ fontSize: '32px', lineHeight: '1.2' }}
            >
              Unfold
            </h1>
            <p className="text-[#8b8b99]" style={{ marginTop: '8px', fontSize: '15px' }}>
              Have a conversation with any Google Drive folder
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div
          className="w-full rounded-2xl"
          style={{
            backgroundColor: '#161619',
            border: '1px solid #2a2a30',
            padding: '32px 28px',
          }}
        >
          <div className="flex flex-col items-center" style={{ gap: '20px' }}>
            <div className="text-center" style={{ marginBottom: '4px' }}>
              <p className="text-[#e8e8ed] font-semibold" style={{ fontSize: '16px' }}>
                Get started
              </p>
              <p className="text-[#5c5c6e]" style={{ fontSize: '13px', marginTop: '4px' }}>
                Sign in to access your Google Drive
              </p>
            </div>

            <button
              onClick={onLogin}
              className="flex items-center justify-center bg-white text-gray-800 rounded-xl font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              style={{
                width: '100%',
                gap: '10px',
                padding: '14px 20px',
                fontSize: '14px',
                border: 'none',
              }}
            >
              <GoogleSVG />
              Continue with Google
            </button>

            {error && (
              <p
                className="text-red-400 text-center rounded-lg"
                style={{
                  fontSize: '12px',
                  backgroundColor: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  padding: '10px 14px',
                  width: '100%',
                }}
              >
                {error}
              </p>
            )}

            <p className="text-[#44444f] text-center" style={{ fontSize: '11px' }}>
              Requests read-only Google Drive access
            </p>
          </div>
        </div>

        {/* Feature grid */}
        <div className="w-full" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {FEATURES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="text-center rounded-xl hover:border-[#6d5efc]/40 transition-all duration-200"
              style={{
                backgroundColor: '#161619',
                border: '1px solid #2a2a30',
                padding: '20px 12px',
              }}
            >
              <div style={{ fontSize: '22px', marginBottom: '10px' }}>{icon}</div>
              <div className="text-[#e8e8ed] font-semibold" style={{ fontSize: '12px', marginBottom: '4px' }}>
                {title}
              </div>
              <div className="text-[#5c5c6e] leading-snug" style={{ fontSize: '11px' }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: "📁", title: "Any Folder", desc: "Docs, Sheets, Slides & PDFs" },
  { icon: "⚡", title: "1M Context", desc: "Full-context or RAG fallback" },
  { icon: "📌", title: "Citations", desc: "Every answer cites sources" },
];

function GoogleSVG() {
  return (
    <svg style={{ height: '18px', width: '18px', flexShrink: 0 }} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
