import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Trash2, Database, MessageCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { renderMarkdown } from "../lib/markdown";
import { useAiChat, loadingSteps } from "../hooks/useAiChat";

export default function AIAssistant() {
  const [input, setInput] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isTyping, error, loadingStep, wasTrimmed, mode, setMode, sendMessage, clearChat } = useAiChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleClearChat = () => {
    clearChat();
    setShowConfirmClear(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    const question = input.trim();
    setInput("");
    await sendMessage(question);
  };

  const quickSuggestions = [
    "Berapa total aset yang sedang rusak?",
    "Tampilkan jadwal maintenance minggu ini",
    "Aset mana yang biaya maintenance-nya paling tinggi?",
    "Berapa jumlah laptop yang tersedia di gudang?"
  ];

  return (
    <div className="relative flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-outline-variant bg-surface overflow-hidden">
      {/* Confirm Clear Dialog */}
      {showConfirmClear && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-2xl">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lg border border-outline-variant">
            <h3 className="font-semibold text-on-surface mb-1">Hapus semua percakapan?</h3>
            <p className="text-sm text-on-surface-variant mb-6">Aksi ini tidak bisa dibatalkan. Seluruh riwayat chat akan dihapus.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="rounded-full border border-outline-variant px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleClearChat}
                className="rounded-full bg-error px-4 py-2 text-sm text-on-error hover:opacity-90 transition-opacity"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant bg-surface-container-lowest p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-on-surface">Data Assistant</h2>
          <p className="text-xs text-on-surface-variant">
            {mode === "data" ? "Tanya seputar data inventaris & maintenance" : "Ngobrol santai, tanpa akses data aset"}
          </p>
        </div>
        <div className="flex items-center rounded-full border border-outline-variant bg-surface p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("data")}
            disabled={isTyping}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              mode === "data" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Database className="h-3.5 w-3.5" />
            Data
          </button>
          <button
            type="button"
            onClick={() => setMode("chat")}
            disabled={isTyping}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              mode === "chat" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
          </button>
        </div>
        <button
          onClick={() => setShowConfirmClear(true)}
          disabled={messages.length <= 1}
          className="flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant hover:bg-error/10 hover:text-error hover:border-error/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant disabled:hover:border-outline-variant"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Hapus Chat
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-surface-container-lowest/30">
        {messages.map((msg, idx) => (
          <React.Fragment key={msg.id}>
            {wasTrimmed && idx === 1 && (
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-outline-variant/50" />
                <span className="text-[11px] text-on-surface-variant/60 select-none">Pesan lebih lama tidak ditampilkan</span>
                <div className="h-px flex-1 bg-outline-variant/50" />
              </div>
            )}
          <div
            className={cn(
              "flex gap-4 max-w-[85%]",
              msg.role === "user" ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                msg.role === "user"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface"
              )}
            >
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
              className={cn(
                "rounded-2xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "bg-primary text-on-primary rounded-tr-sm"
                  : "bg-surface-container-low text-on-surface rounded-tl-sm border border-outline-variant/50"
              )}
            >
              {msg.role === "ai" ? renderMarkdown(msg.content) : <p className="leading-relaxed">{msg.content}</p>}
              <span
                className={cn(
                  "mt-1 block text-[10px] opacity-70",
                  msg.role === "user" ? "text-right" : "text-left"
                )}
              >
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          </React.Fragment>
        ))}

        {isTyping && (
          <div className="flex gap-4 max-w-[85%]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-surface-container-low px-4 py-3 border border-outline-variant/50 flex items-center gap-3">
              <div className="flex gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span key={loadingStep} className="text-xs text-on-surface-variant animate-pulse">
                {loadingSteps[loadingStep]}
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="mx-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-outline-variant bg-surface-container-lowest p-4">
        {messages.length === 1 && !isTyping && (
          <div className="mb-4 flex flex-wrap gap-2">
            {quickSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setInput(suggestion)}
                className="rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan sesuatu tentang data aset..."
            className="w-full rounded-full border border-outline-variant bg-surface px-4 py-3 pr-12 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
