import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, X, Send, Sparkles, Loader2,
  ChevronDown, Trash2, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLocation } from "react-router-dom";

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
const SUGGESTIONS_ES = [
  "Qué buscar en un apartamento en Tel Aviv?",
  "Cómo negociar el alquiler en Israel?",
  "Qué es una buena puntuación?",
  "Compara Givatayim vs Ramat Gan",
];

/* ─── Page context for smarter AI ─── */
const PAGE_CONTEXT: Record<string, { en: string; he: string; es: string }> = {
  "/dashboard": {
    en: "User is viewing their dashboard with stats and recent listings overview.",
    he: "המשתמש צופה בלוח הבקרה עם סטטיסטיקות וסקירת דירות אחרונות.",
    es: "El usuario está viendo su panel con estadísticas y listados recientes.",
  },
  "/inbox": {
    en: "User is browsing their saved listings inbox. Help them filter, sort, and evaluate listings.",
    he: "המשתמש גולש בתיבת הדירות השמורות. עזור להם לסנן, למיין ולהעריך דירות.",
    es: "El usuario navega por su bandeja de listados. Ayúdalo a filtrar y evaluar.",
  },
  "/pipeline": {
    en: "User is managing their listing pipeline (Kanban board). Help with stage management.",
    he: "המשתמש מנהל את תהליך הדירות (לוח קנבן). עזור עם ניהול שלבים.",
    es: "El usuario gestiona su pipeline de listados (tablero Kanban).",
  },
  "/watchlist": {
    en: "User is scanning Yad2 for new listings. Help with scan settings and evaluating results.",
    he: "המשתמש סורק את יד2 לדירות חדשות. עזור עם הגדרות סריקה והערכת תוצאות.",
    es: "El usuario escanea Yad2 para nuevos listados.",
  },
  "/relocation": {
    en: "User is planning their move. Help with moving tasks, packing, and logistics.",
    he: "המשתמש מתכנן את המעבר. עזור עם משימות מעבר, אריזה ולוגיסטיקה.",
    es: "El usuario planifica su mudanza. Ayuda con tareas y logística.",
  },
  "/profiles": {
    en: "User is managing search profiles. Help them optimize their preferences.",
    he: "המשתמש מנהל פרופילי חיפוש. עזור לו לייעל את ההעדפות.",
    es: "El usuario gestiona perfiles de búsqueda.",
  },
  "/settings": {
    en: "User is in settings. Help with configuration and preferences.",
    he: "המשתמש בהגדרות. עזור עם תצורה והעדפות.",
    es: "El usuario está en configuración.",
  },
};

export function AIChatBubble() {
  const { t, language, direction } = useLanguage();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = language === "he" ? SUGGESTIONS_HE : language === "es" ? SUGGESTIONS_ES : SUGGESTIONS_EN;

  // Get current page context
  const currentPage = Object.keys(PAGE_CONTEXT).find(p =>
    location.pathname === p || location.pathname.startsWith(p + "/")
  );
  const pageContext = currentPage ? PAGE_CONTEXT[currentPage] : null;

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        ts: Date.now(),
        content: language === "he"
          ? "שלום! אני RentelX AI. אשמח לעזור לך למצוא את הדירה המושלמת 🏡"
          : language === "es"
          ? "Hola! Soy RentelX AI. Puedo ayudarte a encontrar el apartamento perfecto 🏡"
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
      const langName = language === "he" ? "Hebrew" : language === "es" ? "Spanish" : "English";
      const contextMsg = pageContext
        ? `\n[Context: ${pageContext[language as keyof typeof pageContext] || pageContext.en}]`
        : "";

      const systemMessages = [
        {
          role: "system" as const,
          content: `You are RentelX AI, a smart apartment rental assistant for the Israeli market (Tel Aviv, Givatayim, Ramat Gan). Respond in ${langName}. Be concise, practical, and friendly. You help users find, evaluate, and manage rental apartments.${contextMsg}`,
        },
        ...updated.map((m) => ({ role: m.role, content: m.content })),
      ];

      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: {
          messages: systemMessages,
          type: "chat",
        },
      });
      if (error) throw error;
      const reply =
        data?.choices?.[0]?.message?.content ??
        data?.content ??
        (language === "he" ? "מצטער, נסו שוב." : language === "es" ? "Lo siento, intenta de nuevo." : "Sorry, try again.");
      setMessages((prev) => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          ts: Date.now(),
          content: language === "he" ? "מצטער, אירעה שגיאה. נסו שוב." : language === "es" ? "Lo siento, ocurrió un error. Intenta de nuevo." : "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, minimized, language, pageContext]);

  const clearChat = () => {
    setMessages([]);
    setTimeout(() => {
      setMessages([{
        role: "assistant",
        ts: Date.now(),
        content: language === "he" ? "הצ׳אט נוקה. במה אוכל לעזור?" : language === "es" ? "Chat limpiado. ¿En qué puedo ayudarte?" : "Chat cleared. How can I help you?",
      }]);
    }, 80);
  };

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const hasUnread = !open && messages.length > 0;

  return (
    <>
      {/* ── Floating FAB ── */}
      <motion.button
        className="fixed bottom-4 end-4 z-50 rounded-full bg-primary text-primary-foreground shadow-xl glow-primary flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (open) { setOpen(false); setMinimized(false); }
          else { setOpen(true); setMinimized(false); }
        }}
        aria-label="AI Assistant"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open && !minimized ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            </motion.span>
          )}
        </AnimatePresence>
        {hasUnread && (
          <span className="absolute -top-0.5 -end-0.5 w-3.5 h-3.5 rounded-full bg-score-high border-2 border-background flex items-center justify-center">
            <span className="text-[7px] font-bold text-white">{messages.filter(m => m.role === "assistant").length}</span>
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
            className="fixed bottom-16 end-4 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-96 rounded-2xl glass border border-border/60 shadow-2xl flex flex-col overflow-hidden"
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
                    ? (language === "he" ? "חושב..." : language === "es" ? "Pensando..." : "Thinking...")
                    : minimized && lastAssistantMsg
                    ? lastAssistantMsg.content.slice(0, 32) + "…"
                    : (language === "he" ? "חכם · קונטקסטואלי · AI" : language === "es" ? "Inteligente · Contextual · IA" : "Smart · Contextual · AI")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${loading ? "bg-yellow-400 animate-pulse" : "bg-green-500 animate-bounce-subtle"}`} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); clearChat(); }}
                  title={language === "he" ? "נקה" : language === "es" ? "Limpiar" : "Clear"}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <div className="text-muted-foreground transition-transform duration-200" style={{ transform: minimized ? "rotate(180deg)" : "rotate(0deg)" }}>
                  <ChevronDown className="h-4 w-4" />
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
                      placeholder={language === "he" ? "שאל שאלה..." : language === "es" ? "Haz una pregunta..." : "Ask anything..."}
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
