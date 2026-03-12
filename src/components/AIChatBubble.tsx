import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS_EN = [
  "What should I look for in a Tel Aviv apartment?",
  "How do I negotiate rent in Israel?",
  "What's a good score for a listing?",
];
const SUGGESTIONS_HE = [
  "מה לחפש בדירה בתל אביב?",
  "איך מנהלים מו\"מ על שכירות?",
  "מה ציון טוב לדירה?",
];

export function AIChatBubble() {
  const { t, language, direction } = useLanguage();
  const [open, setOpen] = useState(false);
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
        content: language === "he"
          ? "שלום! אני העוזר החכם של RentelX. אשמח לעזור לך למצוא את הדירה המושלמת 🏡"
          : "Hi! I'm RentelX AI assistant. I can help you find the perfect apartment, analyze listings, or answer any rental questions 🏡",
      }]);
    }
  }, [open, language, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const updated: Message[] = [...messages, { role: "user", content }];
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
      const reply = data?.choices?.[0]?.message?.content ?? data?.content ?? "…";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: language === "he" ? "מצטער, אירעה שגיאה. נסו שוב." : "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating bubble */}
      <motion.button
        className="fixed bottom-5 end-5 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl glow-primary flex items-center justify-center"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="AI Assistant"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageSquare className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            dir={direction}
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-24 end-5 z-50 w-80 sm:w-96 rounded-2xl glass border border-border/60 shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: "65vh" }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 border-b border-border/40 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground animate-sparkle" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{t("app.name")} AI</p>
                <p className="text-xs text-muted-foreground">{language === "he" ? "מונע על ידי AI" : "Powered by AI"}</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce-subtle" />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-se-sm"
                      : "bg-muted text-foreground rounded-ss-sm"
                  }`}>
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-ss-sm px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
              <div className="px-3 pb-1 flex flex-wrap gap-1.5 shrink-0">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-muted/50 hover:bg-primary/10 hover:border-primary/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border/40 shrink-0">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={language === "he" ? "שאל שאלה..." : "Ask anything..."}
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none py-1"
                maxLength={500}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="h-8 w-8 shrink-0 hover:bg-primary/10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
