import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

const CLOUD_RUN_URL = import.meta.env.VITE_AI_SERVER_URL;

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
};

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
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
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadingSteps = [
    "Mengambil data inventaris...",
    "Menganalisis data aset...",
    "Menyusun laporan...",
  ];

  useEffect(() => {
    if (!isTyping) { setLoadingStep(0); return; }
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % loadingSteps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const question = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    setError(null);

    try {
      const response = await fetch(`${CLOUD_RUN_URL}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, history }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Server error");
      }

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: data.answer,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, aiMessage]);
      setHistory((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: data.answer },
      ]);
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server AI.");
    } finally {
      setIsTyping(false);
    }
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let tableLines: string[] = [];

    const parseLine = (line: string): React.ReactNode[] => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part as React.ReactNode
      );
    };

    const parseTableCells = (line: string) =>
      line.split("|").map(c => c.trim()).filter((_, i, arr) => i !== 0 && i !== arr.length - 1);

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="my-1 ml-4 list-disc space-y-0.5">
            {listItems.map((item, i) => <li key={i}>{parseLine(item)}</li>)}
          </ul>
        );
        listItems = [];
      }
    };

    const flushTable = () => {
      if (tableLines.length >= 2) {
        const headers = parseTableCells(tableLines[0]);
        const rows = tableLines.slice(2).map(parseTableCells);
        elements.push(
          <div key={elements.length} className="my-2 overflow-x-auto rounded-lg border border-outline-variant/50">
            <table className="w-full text-xs">
              <thead className="bg-surface-container-high">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-on-surface">{parseLine(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-outline-variant/30 even:bg-surface-container-lowest/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-on-surface">{parseLine(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableLines = [];
    };

    const isTableLine = (line: string) => line.trim().startsWith("|") && line.trim().endsWith("|");
    const isSeparatorLine = (line: string) => /^\|[\s|:-]+\|$/.test(line.trim());

    lines.forEach((line, idx) => {
      if (isTableLine(line)) {
        flushList();
        if (!isSeparatorLine(line)) tableLines.push(line);
        else tableLines.push(line);
      } else {
        flushTable();
        if (line.startsWith("- ") || line.startsWith("* ")) {
          listItems.push(line.slice(2));
        } else {
          flushList();
          if (line.startsWith("### ")) {
            elements.push(<p key={idx} className="font-semibold mt-2">{parseLine(line.slice(4))}</p>);
          } else if (line.startsWith("## ")) {
            elements.push(<p key={idx} className="font-bold mt-2">{parseLine(line.slice(3))}</p>);
          } else if (line.trim() === "") {
            elements.push(<div key={idx} className="h-1" />);
          } else {
            elements.push(<p key={idx} className="leading-relaxed">{parseLine(line)}</p>);
          }
        }
      }
    });
    flushList();
    flushTable();
    return <div className="space-y-0.5">{elements}</div>;
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
