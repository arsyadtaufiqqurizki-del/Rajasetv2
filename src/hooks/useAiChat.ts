import { useState, useRef, useEffect, useCallback } from 'react';

const CLOUD_RUN_URL = import.meta.env.VITE_AI_SERVER_URL;
const STORAGE_KEY_MESSAGES = 'ai_assistant_messages';
const STORAGE_KEY_HISTORY = 'ai_assistant_history';
const STORAGE_KEY_TRIMMED = 'ai_assistant_trimmed';
const STORAGE_KEY_MODE = 'ai_assistant_mode';
const MAX_MESSAGES = 21; // 1 welcome + 20 chat
const MAX_HISTORY = 20; // 10 pasang user-AI (disimpan untuk tampilan/localStorage)
const HISTORY_SEND_LIMIT = 8; // 4 pasang terakhir yang benar-benar dikirim ke model

export type ChatMode = 'data' | 'chat';

export type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
};

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const loadingSteps = [
  'Mengambil data inventaris...',
  'Menganalisis data aset...',
  'Menyusun laporan...',
  'Masih diproses, mohon tunggu sebentar...',
];

const GREETING = 'Halo! Saya adalah Asisten AI Anda. Anda bisa menanyakan apa saja seputar data aset, jadwal maintenance, atau laporan kondisi barang di Perusahaan Raja. Gunakan mode Data untuk pertanyaan seputar data aset, atau mode Chat untuk ngobrol santai tanpa akses data — bisa diganti lewat tombol di kanan atas.';

const defaultMessages: Message[] = [
  { id: '1', role: 'ai', content: GREETING, timestamp: new Date() },
];

function loadMessages(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!stored) return defaultMessages;
    const parsed = JSON.parse(stored);
    return parsed.map((m: Omit<Message, 'timestamp'> & { timestamp: string }) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return defaultMessages;
  }
}

function loadHistory(): HistoryMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function useAiChat() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [history, setHistory] = useState<HistoryMessage[]>(loadHistory);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [wasTrimmed, setWasTrimmed] = useState(() => localStorage.getItem(STORAGE_KEY_TRIMMED) === 'true');
  const [mode, setMode] = useState<ChatMode>(() => (localStorage.getItem(STORAGE_KEY_MODE) === 'chat' ? 'chat' : 'data'));
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!isTyping) { setLoadingStep(0); return; }
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % loadingSteps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isTyping]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TRIMMED, String(wasTrimmed));
  }, [wasTrimmed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }, [mode]);

  const clearChat = useCallback(() => {
    setMessages([{ id: Date.now().toString(), role: 'ai', content: GREETING, timestamp: new Date() }]);
    setHistory([]);
    setWasTrimmed(false);
  }, []);

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    setError(null);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let aiMessageId: string | null = null;
    let fullText = '';

    try {
      const response = await fetch(`${CLOUD_RUN_URL}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, history: history.slice(-HISTORY_SEND_LIMIT), mode }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        let errMsg = 'Server error';
        try { errMsg = JSON.parse(text).error || errMsg; } catch { /* not JSON, keep default */ }
        throw new Error(errMsg);
      }

      if (!response.body) throw new Error('Streaming tidak didukung oleh browser ini.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        if (!chunkText) continue;
        fullText += chunkText;

        if (aiMessageId === null) {
          aiMessageId = (Date.now() + 1).toString();
          setIsTyping(false);
          const newId = aiMessageId;
          const snapshot = fullText;
          setMessages((prev) => [...prev, { id: newId, role: 'ai', content: snapshot, timestamp: new Date() }]);
        } else {
          const currentId = aiMessageId;
          const snapshot = fullText;
          setMessages((prev) => prev.map((m) => (m.id === currentId ? { ...m, content: snapshot } : m)));
        }
      }

      if (!fullText) {
        throw new Error('Server tidak mengembalikan jawaban.');
      }

      setMessages((prev) => {
        if (prev.length <= MAX_MESSAGES) return prev;
        setWasTrimmed(true);
        return [prev[0], ...prev.slice(-(MAX_MESSAGES - 1))];
      });
      setHistory((prev) => {
        const updated = [...prev, { role: 'user' as const, content: question }, { role: 'assistant' as const, content: fullText }];
        return updated.slice(-MAX_HISTORY);
      });
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Gagal menghubungi server AI.');
        if (aiMessageId) {
          const failedId = aiMessageId;
          setMessages((prev) => prev.filter((m) => m.id !== failedId));
        }
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsTyping(false);
    }
  }, [isTyping, history, mode]);

  return {
    messages,
    isTyping,
    error,
    loadingStep,
    wasTrimmed,
    mode,
    setMode,
    sendMessage,
    clearChat,
  };
}
