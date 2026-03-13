import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Loader2, MessageCircle, Lightbulb } from "lucide-react";

interface AiSectionHelperProps {
  context: string;
  section: string;
  suggestions?: string[];
  compact?: boolean;
}

export function AiSectionHelper({ context, section, suggestions, compact }: AiSectionHelperProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const defaultSuggestions = suggestions ?? (language === "he"
    ? ["תן לי טיפ מהיר", "מה כדאי לשים לב?", "תסכם בקצרה"]
    : ["Give me a quick tip", "What should I watch for?", "Summarize briefly"]
  );

  const askAi = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await supabase.functions.invoke("ai-assist", {
        body: {
          type: "chat",
          messages: [{
            role: "user",
            content: `You are an AI assistant for RentelX, an apartment hunting platform in Israel (Tel Aviv, Givatayim, Ramat Gan). The user is currently on the "${section}" section.\n\nContext: ${context}\n\nUser question: ${q}\n\nProvide a helpful, concise answer in ${language === "he" ? "Hebrew" : "English"}. Be specific and actionable.`
          }],
        },
      });

      if (res.error) throw res.error;

      if (typeof res.data === "string") {
        setAnswer(res.data);
      } else if (res.data?.content) {
        setAnswer(res.data.content);
      } else if (res.data instanceof ReadableStream) {
        const reader = res.data.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) setAnswer((prev) => prev + content);
              } catch { /* skip non-JSON */ }
            }
          }
        }
      }
    } catch {
      setAnswer(language === "he"
        ? "מצטער, לא הצלחתי לענות כרגע. נסו שוב."
        : "Sorry, I couldn't answer right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [context, section, language]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askAi(question);
    setQuestion("");
  };

  if (compact) {
    return (
      <div className="relative">
        <AnimatePresence>
          {!open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {language === "he" ? "עזרת AI" : "AI Help"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="absolute top-0 end-0 z-50 w-80"
            >
              <Card className="p-3 border-primary/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    {language === "he" ? "עוזר AI" : "AI Assistant"}
                  </span>
                  <button onClick={() => { setOpen(false); setAnswer(""); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {answer && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs bg-muted/50 rounded-lg p-2 whitespace-pre-wrap max-h-40 overflow-y-auto"
                  >
                    {answer}
                  </motion.div>
                )}

                <div className="flex flex-wrap gap-1">
                  {defaultSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => askAi(s)}
                      disabled={loading}
                      className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="flex gap-1.5">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={language === "he" ? "שאל את ה-AI..." : "Ask AI..."}
                    className="flex-1 text-xs bg-muted/50 rounded-lg px-2 py-1.5 border-0 outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <Button type="submit" size="sm" disabled={loading || !question.trim()} className="h-7 w-7 p-0">
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          {language === "he" ? "עוזר AI" : "AI Assistant"}
        </h3>
        {answer && (
          <button onClick={() => setAnswer("")} className="text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {answer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap"
          >
            {answer}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-1.5">
        {defaultSuggestions.map((s) => (
          <Button
            key={s}
            variant="outline"
            size="sm"
            onClick={() => askAi(s)}
            disabled={loading}
            className="text-xs h-7 gap-1 border-primary/20 hover:bg-primary/10"
          >
            <Lightbulb className="h-3 w-3" />
            {s}
          </Button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={language === "he" ? "שאלו את ה-AI כל שאלה..." : "Ask AI anything..."}
          rows={1}
          className="text-sm resize-none flex-1"
        />
        <Button type="submit" size="sm" disabled={loading || !question.trim()} className="gap-1.5 shrink-0">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {loading
            ? (language === "he" ? "חושב..." : "Thinking...")
            : (language === "he" ? "שלח" : "Send")}
        </Button>
      </form>
    </Card>
  );
}
