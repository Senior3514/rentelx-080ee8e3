import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, isPast } from "date-fns";
import { he } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function RemindersWidget() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders_upcoming", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("listing_reminders")
        .select("*, listings(address, city)")
        .eq("user_id", user!.id)
        .eq("is_done", false)
        .order("remind_at", { ascending: true })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const doneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("listing_reminders")
        .update({ is_done: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders_upcoming"] });
      toast.success(language === "he" ? "תזכורת סומנה כבוצעה" : "Reminder marked done");
    },
  });

  if (reminders.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Bell className="h-3.5 w-3.5 text-primary" />
        {language === "he" ? "תזכורות" : "Reminders"}
      </h3>
      <AnimatePresence>
        {reminders.map((r: any, i: number) => {
          const overdue = isPast(new Date(r.remind_at));
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className={`p-3 flex items-center gap-3 border-border/60 ${overdue ? "border-destructive/40 bg-destructive/5" : ""}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${overdue ? "bg-destructive animate-bounce-subtle" : "bg-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {r.listings?.address || r.listings?.city || "—"}
                  </p>
                  {r.message && <p className="text-xs text-muted-foreground truncate">{r.message}</p>}
                  <p className={`text-xs mt-0.5 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(r.remind_at), {
                      addSuffix: true,
                      locale: language === "he" ? he : undefined,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => navigate(`/listings/${r.listing_id}`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-score-high"
                    onClick={() => doneMutation.mutate(r.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
