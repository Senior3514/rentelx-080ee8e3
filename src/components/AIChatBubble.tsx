import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, X, Send, Sparkles, Loader2,
  ChevronDown, ChevronUp, Trash2, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const SUGGESTIONS_EN = [
  "What to look for in a Tel Aviv apartment?",
  "How to negotiate rent in Israel?",
  "What's a good score for a listing?",
  "Compare Givatayim vs Ramat Gan",
];
const SUGGESTIONS_HE = [
  "מה לחפש בדירה בתל אביב?",
  "איך מנהלים מו\"מ על שכירות?",
  "מה ציון טוב לדירה?",
  "השווה גבעתיים מול רמת גן",
];

export function AIChatBubble() {
  const { t, language, direction } = useLanguage();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = language === "he" ? SUGGESTIONS_HE : SUGGESTIONS_EN;

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        ts: Date.now(),
        content: language === "he"
          ? "שלום! אני RentelX AI. אשמח לעזור לך למצוא את הדירה המושלמת 🏡"
          : "Hi! I'm RentelX AI. I can help you find the perfect apartment, analyze listings, or answer rental questions 🏡",
      }]);
    }
  }, [open, language, messages.length]);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, minimized]);

  useEffect(() => {
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, minimized]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    if (minimized) setMinimized(false);

    const updated: Message[] = [...messages, { role: "user", content, ts: Date.now() }];
    setMessages(updated);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: {
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          type: "chat",
        },
      });
      if (error) throw error;
      const reply =
        data?.choices?.[0]?.message?.content ??
        data?.content ??
        (language === "he" ? "מצטער, נסו שוב." : "Sorry, try again.");
      setMessages((prev) => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          ts: Date.now(),
          content: language === "he" ? "מצטער, אירעה שגיאה. נסו שוב." : "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, minimized, language]);

  const clearChat = () => {
    setMessages([]);
    setTimeout(() => {
      setMessages([{
        role: "assistant",
        ts: Date.now(),
        content: language === "he" ? "הצ׳אט נוקה. במה אוכל לעזור?" : "Chat cleared. How can I help you?",
      }]);
    }, 80);
  };

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const hasUnread = !open && messages.length > 0;

  return (
    <>
      {/* ── Floating FAB ── */}
      <motion.button
        className="fixed bottom-5 end-5 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl glow-primary flex items-center justify-center"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (open && !minimized) { setOpen(false); setMinimized(false); }
          else { setOpen(true); setMinimized(false); }
        }}
        aria-label="AI Assistant"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open && !minimized ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageSquare className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
        {hasUnread && (
          <span className="absolute -top-0.5 -end-0.5 w-4 h-4 rounded-full bg-score-high border-2 border-background flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">{messages.filter(m => m.role === "assistant").length}</span>
          </span>
        )}
      </motion.button>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            dir={direction}
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed bottom-24 end-5 z-50 w-80 sm:w-96 rounded-2xl glass border border-border/60 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* ── Header — click to minimize/expand ── */}
            <div
              className="flex items-center gap-2 px-4 py-3 bg-primary/10 border-b border-border/40 shrink-0 cursor-pointer select-none hover:bg-primary/15 transition-colors"
              onClick={() => setMinimized((v) => !v)}
            >
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground animate-sparkle" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t("app.name")} AI</p>
                <p className="text-xs text-muted-foreground truncate">
                  {loading
                    ? (language === "he" ? "חושב..." : "Thinking...")
                    : minimized && lastAssistantMsg
                    ? lastAssistantMsg.content.slice(0, 32) + "…"
                    : (language === "he" ? "מונע על ידי AI" : "Powered by AI")}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${loading ? "bg-yellow-400 animate-pulse" : "bg-green-500 animate-bounce-subtle"}`} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); clearChat(); }}
                  title={language === "he" ? "נקה" : "Clear"}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <div className="text-muted-foreground">
                  {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </div>

            {/* ── Collapsible body ── */}
            <AnimatePresence initial={false}>
              {!minimized && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="flex flex-col overflow-hidden"
                  style={{ maxHeight: "calc(65vh - 56px)" }}
                >
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
                    {messages.map((m, i) => (
                      <motion.div
                        key={m.ts + i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {m.role === "assistant" && (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 me-1.5">
                            <Bot className="h-3 w-3 text-primary" />
                          </div>
                        )}
                        <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-primary text-primary-foreground rounded-se-sm shadow-md"
                            : "bg-muted text-foreground rounded-ss-sm shadow-sm"
                        }`}>
                          {m.content}
                        </div>
                      </motion.div>
                    ))}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 me-1.5">
                          <Bot className="h-3 w-3 text-primary" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-ss-sm px-4 py-3 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Suggestions */}
                  {messages.length <= 1 && (
                    <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-muted/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border/40 shrink-0 bg-background/60 backdrop-blur-sm">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                      placeholder={language === "he" ? "שאל שאלה..." : "Ask anything..."}
                      className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none py-1"
                      maxLength={500}
                    />
                    <Button
                      size="icon"
                      onClick={() => send()}
                      disabled={!input.trim() || loading}
                      className="h-8 w-8 shrink-0 rounded-xl"
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
