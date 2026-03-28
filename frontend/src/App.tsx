import { useState, useCallback, useRef } from "react";
import { useGoogleLogin, googleLogout } from "@react-oauth/google";
import LoginScreen from "./components/LoginScreen";
import SetupScreen from "./components/SetupScreen";
import ChatScreen from "./components/ChatScreen";
import { listFolder, ingestBatch, chatStream } from "./api";
import type { DriveFile, FolderNode, Message, Phase, IngestionProgress, Strategy } from "./types";

const BATCH_SIZE = 5;
const SESSION_KEY = "fm_session";

interface SessionData {
  token: string;
  email: string;
  picture: string;
  expiresAt: number;
}

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (Date.now() > data.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export default function App() {
  const saved = loadSession();
  const [token, setToken] = useState<string | null>(saved?.token ?? null);
  const [userEmail, setUserEmail] = useState(saved?.email ?? "");
  const [userPicture, setUserPicture] = useState(saved?.picture ?? "");
  const [phase, setPhase] = useState<Phase>(saved ? "idle" : "login");
  const [error, setError] = useState("");
  const [folderUrl, setFolderUrl] = useState("");
  const [folderTrees, setFolderTrees] = useState<FolderNode[]>([]);
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [folderNames, setFolderNames] = useState<string[]>([]);
  const [addFolderLoading, setAddFolderLoading] = useState(false);
  const [addFolderError, setAddFolderError] = useState("");
  const [truncatedFiles, setTruncatedFiles] = useState<string[]>([]);
  const [progress, setProgress] = useState<IngestionProgress>({ current: 0, total: 0, file: "" });
  const [strategy, setStrategy] = useState<Strategy>("full-context");
  const [totalTokens, setTotalTokens] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const login = useGoogleLogin({
    onSuccess: async (res) => {
      setToken(res.access_token);
      let email = "";
      let picture = "";
      try {
        const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${res.access_token}` },
        }).then(r => r.json()) as { email?: string; picture?: string };
        email = info.email ?? "";
        picture = info.picture ?? "";
        setUserEmail(email);
        setUserPicture(picture);
      } catch {
        // Non-critical
      }
      const expiresIn = (res as unknown as { expires_in?: number }).expires_in ?? 3600;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        token: res.access_token,
        email,
        picture,
        expiresAt: Date.now() + expiresIn * 1000,
      } satisfies SessionData));
      setPhase("idle");
    },
    onError: () => setError("Google sign-in failed. Please try again."),
    scope: "openid email profile https://www.googleapis.com/auth/drive.readonly",
  });

  const generateSuggestions = useCallback(async (tok: string, fids: string[]) => {
    setSuggestionsLoading(true);
    try {
      let raw = "";
      await chatStream(
        tok, fids, [],
        'Generate exactly 4 specific, insightful questions a user would want to ask about the contents of this folder. Return ONLY a valid JSON array of strings — no markdown, no explanation, no code fences. Example: ["What are the main topics?", "Which files mention X?", "Summarize key findings", "What action items exist?"]',
        (chunk) => { raw += chunk; },
      );
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown[];
        const questions = parsed.filter((q): q is string => typeof q === "string").slice(0, 4);
        if (questions.length > 0) setSuggestedQuestions(questions);
      }
    } catch {
      // Silently fail — suggestions are a bonus
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  const handleIngest = useCallback(async () => {
    if (!token || !folderUrl.trim()) return;
    setError("");
    setPhase("listing");
    try {
      const data = await listFolder(token, folderUrl.trim());
      if (data.supportedFiles === 0) {
        setError("No supported files found in this folder.");
        setPhase("idle");
        return;
      }
      const fid = data.folder.id as string;
      setFolderTrees([data.folder]);
      setFolderIds([fid]);
      setFolderNames([data.folder.name]);
      setPhase("ingesting");
      const files = data.flatFiles as DriveFile[];
      let tokenCount = 0;
      let finalStrategy: Strategy = "full-context";
      let finalTokens = 0;
      const allTruncated: string[] = [];
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const isLast = i + BATCH_SIZE >= files.length;
        setProgress({
          current: Math.min(i + BATCH_SIZE, files.length),
          total: files.length,
          file: batch[0]?.name ?? "",
        });
        const result = await ingestBatch(token, {
          folderId: fid,
          folderName: data.folder.name,
          files: batch,
          isLastBatch: isLast,
          existingTokenCount: tokenCount,
          batchIndex: Math.floor(i / BATCH_SIZE),
        });
        tokenCount += result.batchTokens ?? 0;
        if (result.truncatedFiles) allTruncated.push(...result.truncatedFiles);
        if (result.done) {
          finalStrategy = result.strategy;
          finalTokens = result.totalTokens;
        }
      }
      setStrategy(finalStrategy);
      setTotalTokens(finalTokens);
      setTruncatedFiles(allTruncated);
      setPhase("ready");
      void generateSuggestions(token, [fid]);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Something went wrong.");
      setPhase("idle");
    }
  }, [token, folderUrl, generateSuggestions]);

  // Add a second (or third) folder while already in chat mode.
  const handleAddFolder = useCallback(async (url: string) => {
    if (!token || !url.trim()) return;
    setAddFolderError("");
    setAddFolderLoading(true);
    try {
      const data = await listFolder(token, url.trim());
      if (data.supportedFiles === 0) {
        setAddFolderError("No supported files found in this folder.");
        return;
      }
      const fid = data.folder.id as string;
      if (folderIds.includes(fid)) {
        setAddFolderError("This folder is already loaded.");
        return;
      }
      const files = data.flatFiles as DriveFile[];
      let tokenCount = 0;
      const addedTruncated: string[] = [];
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const isLast = i + BATCH_SIZE >= files.length;
        const result = await ingestBatch(token, {
          folderId: fid,
          folderName: data.folder.name,
          files: batch,
          isLastBatch: isLast,
          existingTokenCount: tokenCount,
          batchIndex: Math.floor(i / BATCH_SIZE),
        });
        tokenCount += result.batchTokens ?? 0;
        if (result.truncatedFiles) addedTruncated.push(...result.truncatedFiles);
      }
      if (addedTruncated.length > 0) {
        setTruncatedFiles(prev => [...prev, ...addedTruncated]);
      }
      setFolderTrees(prev => [...prev, data.folder]);
      setFolderIds(prev => {
        const next = [...prev, fid];
        // Refresh suggestions across all folders now that we have more context
        void generateSuggestions(token, next);
        return next;
      });
      setFolderNames(prev => [...prev, data.folder.name]);
      setSuggestedQuestions([]);
    } catch (e: unknown) {
      setAddFolderError((e as Error).message ?? "Failed to add folder.");
    } finally {
      setAddFolderLoading(false);
    }
  }, [token, generateSuggestions]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSend = useCallback(async (query: string) => {
    if (!token || !query.trim() || chatLoading) return;
    setSuggestedQuestions([]);
    setSuggestionsLoading(false);
    const asstId = `a-${Date.now()}`;
    const snapshot = messages;
    setMessages(prev => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: query },
      { id: asstId, role: "assistant", content: "", error: false },
    ]);
    setChatLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await chatStream(
        token, folderIds,
        snapshot.map(m => ({ role: m.role, content: m.content })),
        query,
        (chunk) => setMessages(prev =>
          prev.map(m => m.id === asstId ? { ...m, content: m.content + chunk } : m)
        ),
        controller.signal,
        (hydeAnswer) => setMessages(prev =>
          prev.map(m => m.id === asstId ? { ...m, hydeAnswer } : m)
        ),
      );
      setMessages(prev => prev.map(m =>
        m.id === asstId && m.content.startsWith("Error:") ? { ...m, error: true } : m
      ));
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setMessages(prev =>
        prev.map(m => m.id === asstId ? { ...m, content: `Error: ${(e as Error).message}`, error: true } : m)
      );
    } finally {
      setChatLoading(false);
      abortRef.current = null;
    }
  }, [token, chatLoading, folderIds, messages]);

  const handleRetry = useCallback(async (failedMsgId: string) => {
    if (chatLoading) return;
    const idx = messages.findIndex(m => m.id === failedMsgId);
    if (idx === -1) return;
    const userMsg = messages[idx - 1];
    if (!userMsg || userMsg.role !== "user") return;
    const history = messages.slice(0, idx - 1).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => prev.map(m => m.id === failedMsgId ? { ...m, content: "", error: false } : m));
    setChatLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await chatStream(
        token!, folderIds, history, userMsg.content,
        (chunk) => setMessages(prev =>
          prev.map(m => m.id === failedMsgId ? { ...m, content: m.content + chunk } : m)
        ),
        controller.signal,
        (hydeAnswer) => setMessages(prev =>
          prev.map(m => m.id === failedMsgId ? { ...m, hydeAnswer } : m)
        ),
      );
      setMessages(prev => prev.map(m =>
        m.id === failedMsgId && m.content.startsWith("Error:") ? { ...m, error: true } : m
      ));
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setMessages(prev =>
        prev.map(m => m.id === failedMsgId ? { ...m, content: `Error: ${(e as Error).message}`, error: true } : m)
      );
    } finally {
      setChatLoading(false);
      abortRef.current = null;
    }
  }, [chatLoading, token, folderIds, messages]);

  const handleSignOut = useCallback(() => {
    googleLogout();
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
    setPhase("login");
    setMessages([]);
    setFolderUrl("");
    setFolderIds([]);
    setFolderNames([]);
    setFolderTrees([]);
    setSuggestedQuestions([]);
    setTruncatedFiles([]);
    setError("");
  }, []);

  const handleNewFolder = useCallback(() => {
    setPhase("idle");
    setMessages([]);
    setFolderUrl("");
    setFolderIds([]);
    setFolderNames([]);
    setFolderTrees([]);
    setSuggestedQuestions([]);
    setTruncatedFiles([]);
    setAddFolderError("");
    setError("");
  }, []);

  if (phase === "login") {
    return <LoginScreen onLogin={() => login()} error={error} />;
  }

  if (phase !== "ready") {
    return (
      <SetupScreen
        phase={phase}
        folderUrl={folderUrl}
        onFolderUrlChange={setFolderUrl}
        onIngest={handleIngest}
        progress={progress}
        folderTree={folderTrees[0] ?? null}
        error={error}
        userEmail={userEmail}
        userPicture={userPicture}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <ChatScreen
      folderTrees={folderTrees}
      folderNames={folderNames}
      strategy={strategy}
      totalTokens={totalTokens}
      messages={messages}
      suggestedQuestions={suggestedQuestions}
      suggestionsLoading={suggestionsLoading}
      chatLoading={chatLoading}
      userEmail={userEmail}
      userPicture={userPicture}
      addFolderLoading={addFolderLoading}
      addFolderError={addFolderError}
      truncatedFiles={truncatedFiles}
      onSend={handleSend}
      onStop={handleStop}
      onRetry={handleRetry}
      onSignOut={handleSignOut}
      onNewFolder={handleNewFolder}
      onAddFolder={handleAddFolder}
    />
  );
}
