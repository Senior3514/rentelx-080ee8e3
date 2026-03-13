import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCheck, MapPin, Sparkles, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";

interface NotifItem {
  id: string;
  title: string;
  body: string;
  score: number;
  ts: number;
  read: boolean;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  /* ── Supabase realtime: listen for new high-score listings ── */
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("new-listings-notif")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "listing_scores",
          filter: `score=gte.75`,
        },
        async (payload) => {
          const scoreRow = payload.new as { listing_id: string; score: number };
          const { data: listing } = await supabase
            .from("listings")
            .select("address, city, rooms, price, user_id")
            .eq("id", scoreRow.listing_id)
            .single();
          if (!listing || listing.user_id !== user.id) return;

          const notif: NotifItem = {
            id: crypto.randomUUID(),
            title: language === "he" ? "דירה חדשה בציון גבוה!" : "New high-score listing!",
            body: `${listing.address ?? listing.city} — ${scoreRow.score}/100`,
            score: scoreRow.score,
            ts: Date.now(),
            read: false,
          };
          setNotifs((prev) => [notif, ...prev.slice(0, 19)]);
          qc.invalidateQueries({ queryKey: ["listings"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, language, qc]);

  /* ── Close on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = notifs.filter((n) => !n.read).length;

  const markAllRead = () => setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));

  const remove = (id: string) => setNotifs((prev) => prev.filter((n) => n.id !== id));

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => { setOpen((v) => !v); if (!open) markAllRead(); }}
        aria-label="Notifications"
      >
        <Bell className={`h-4 w-4 ${unread > 0 ? "text-primary animate-bounce-subtle" : "text-muted-foreground"}`} />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -end-0.5 w-4 h-4 rounded-full bg-score-high text-white text-[9px] font-bold flex items-center justify-center"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-panel"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="absolute top-full end-0 mt-2 w-80 glass rounded-2xl border border-border/60 shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-primary/5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold">
                  {language === "he" ? "התראות" : "Notifications"}
                </span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{unread}</span>
                )}
              </div>
              {notifs.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={markAllRead}>
                  <CheckCheck className="h-3 w-3" />
                  {language === "he" ? "סמן הכל" : "Mark all read"}
                </Button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {language === "he" ? "אין התראות עדיין" : "No notifications yet"}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {language === "he" ? "נודיע כשיתווספו דירות בציון גבוה" : "We'll notify you when high-score listings appear"}
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {notifs.map((n) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors ${!n.read ? "bg-primary/3" : ""}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${n.score >= 90 ? "bg-score-high/15" : "bg-score-medium/15"}`}>
                        <MapPin className={`h-3.5 w-3.5 ${n.score >= 90 ? "text-score-high" : "text-score-medium"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${n.score >= 90 ? "bg-score-high" : "bg-score-medium"}`}>
                            {n.score}/100
                          </div>
                          {!n.read && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(n.id)}
                        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
