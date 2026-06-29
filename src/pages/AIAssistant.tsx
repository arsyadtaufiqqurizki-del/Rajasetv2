import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
};

export default function AIAssistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "ai",
      content: "Halo! Saya adalah Asisten AI Anda. Anda bisa menanyakan apa saja seputar data aset, jadwal maintenance, atau laporan kondisi barang di Perusahaan Raja.",
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response for the frontend layout
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "Ini adalah simulasi jawaban dari AI. Di tahap selanjutnya, bagian ini akan dihubungkan ke backend (contohnya Gemini API) agar dapat menjawab berdasarkan data inventaris secara real-time.",
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const quickSuggestions = [
    "Berapa total aset yang sedang rusak?",
    "Tampilkan jadwal maintenance minggu ini",
    "Aset mana yang biaya maintenance-nya paling tinggi?",
    "Berapa jumlah laptop yang tersedia di gudang?"
  ];

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-outline-variant bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant bg-surface-container-lowest p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-on-surface">Data Assistant</h2>
          <p className="text-xs text-on-surface-variant">Tanya seputar data inventaris & maintenance</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-surface-container-lowest/30">
        {messages.map((msg) => (
          <div
            key={msg.id}
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
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
        ))}

        {isTyping && (
          <div className="flex gap-4 max-w-[85%]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-surface-container-low px-4 py-4 border border-outline-variant/50 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
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
