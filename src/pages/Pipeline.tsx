import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import React, { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Inbox, MapPin, BedDouble } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AiSectionHelper } from "@/components/ui/ai-section-helper";

const STAGES = ["new", "contacted", "viewing_scheduled", "viewed", "negotiating", "signed", "lost"] as const;

const STAGE_LABELS: Record<string, Record<string, string>> = {
  new: { en: "New", he: "חדש" },
  contacted: { en: "Contacted", he: "נוצר קשר" },
  viewing_scheduled: { en: "Viewing", he: "ביקור" },
  viewed: { en: "Viewed", he: "נצפה" },
  negotiating: { en: "Negotiating", he: 'מו"מ' },
  signed: { en: "Signed", he: "חתום" },
  lost: { en: "Lost", he: "אבוד" },
};

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-500",
  contacted: "bg-violet-500",
  viewing_scheduled: "bg-amber-500",
  viewed: "bg-orange-500",
  negotiating: "bg-primary",
  signed: "bg-score-high",
  lost: "bg-muted-foreground",
};

const Pipeline = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["pipeline", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_entries")
        .select("*, listings(*)")
        .eq("user_id", user!.id)
        .order("entered_stage_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ entryId, stage }: { entryId: string; stage: string }) => {
      const { error } = await supabase
        .from("pipeline_entries")
        .update({ stage: stage as any, entered_stage_at: new Date().toISOString() })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    e.dataTransfer.setData("entryId", entryId);
    setDragging(entryId);
  };

  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    const entryId = e.dataTransfer.getData("entryId");
    if (entryId) moveMutation.mutate({ entryId, stage });
    setDragging(null);
  };

  const totalCount = entries.length;

  // Find stage with most cards for glow highlight
  const maxStage = useMemo(() => {
    let maxCount = 0;
    let maxStageName = "";
    STAGES.forEach((stage) => {
      const count = entries.filter((e: any) => e.stage === stage).length;
      if (count > maxCount) { maxCount = count; maxStageName = stage; }
    });
    return maxCount > 0 ? maxStageName : "";
  }, [entries]);

  const renderEntryCard = (entry: any) => {
    const daysInStage = Math.floor((Date.now() - new Date(entry.entered_stage_at).getTime()) / 86400000);
    return (
      <motion.div
        key={entry.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <Card
          draggable={!isMobile}
          onDragStart={(e) => handleDragStart(e, entry.id)}
          className={`p-3 cursor-pointer card-hover shine-overlay border-border/60 ${
            dragging === entry.id ? "opacity-40 scale-95" : ""
          } ${!isMobile ? "cursor-grab active:cursor-grabbing" : ""}`}
          onClick={() => navigate(`/listings/${entry.listing_id}`)}
        >
          <p className="text-sm font-semibold truncate mb-1">
            {entry.listings?.address || entry.listings?.city || "Listing"}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {entry.listings?.price && (
              <span className="text-xs font-medium text-primary">
                <MapPin className="inline h-3 w-3 me-0.5" />
                ₪{entry.listings.price.toLocaleString()}
              </span>
            )}
            {entry.listings?.rooms && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <BedDouble className="h-3 w-3" /> {entry.listings.rooms}
              </span>
            )}
            <span className="text-xs text-muted-foreground ms-auto">{daysInStage}d</span>
          </div>
        </Card>
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Stage progress indicator
  const totalWithEntries = STAGES.filter((s) => entries.some((e: any) => e.stage === s)).length;
  const progressPercent = STAGES.length > 0 ? (totalWithEntries / STAGES.length) * 100 : 0;

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{t("pipeline.title")}</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="stage-indicator w-32">
              <motion.div
                className="stage-indicator-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{totalCount} {t("pipeline.totalListings")}</span>
          </div>
        </div>
      </div>

      {isMobile ? (
        // Mobile: grouped list view
        <div className="space-y-4">
          {STAGES.map((stage) => {
            const stageEntries = entries.filter((e: any) => e.stage === stage);
            return (
              <div key={stage}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${STAGE_COLORS[stage]}`} />
                  {STAGE_LABELS[stage]?.[language] || stage}
                  <span className="text-xs bg-muted rounded-full px-1.5 py-0.5">{stageEntries.length}</span>
                </h3>
                {stageEntries.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60 py-3 px-3 bg-muted/30 rounded-lg">
                    <Inbox className="h-3.5 w-3.5" />
                    {t("pipeline.empty")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>{stageEntries.map(renderEntryCard)}</AnimatePresence>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Desktop: kanban board
        <div className="grid grid-cols-7 gap-3 pb-4">
          {STAGES.map((stage, stageIdx) => {
            const stageEntries = entries.filter((e: any) => e.stage === stage);
            const isMax = stage === maxStage;
            return (
              <motion.div
                key={stage}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: stageIdx * 0.06, type: "spring", stiffness: 260, damping: 22 }}
                className={`min-w-0 bg-muted/50 rounded-xl p-3 min-h-[300px] border border-border/40 transition-all duration-300 ${
                  isMax ? "ring-2 ring-primary/40 shadow-[0_0_16px_hsl(var(--primary)/0.15)]" : ""
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${STAGE_COLORS[stage]}`} />
                  <span className="text-muted-foreground">{STAGE_LABELS[stage]?.[language] || stage}</span>
                  <span className="ms-auto text-xs bg-muted rounded-full px-1.5 py-0.5">{stageEntries.length}</span>
                </h3>
                <div className="space-y-2">
                  <AnimatePresence>
                    {stageEntries.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex flex-col items-center gap-1 text-xs text-muted-foreground/50 py-6"
                      >
                        <Inbox className="h-4 w-4" />
                        <span>{t("pipeline.empty")}</span>
                      </motion.div>
                    ) : (
                      stageEntries.map(renderEntryCard)
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* AI Pipeline Helper */}
      <AiSectionHelper
        context={`Pipeline has ${totalCount} listings across ${STAGES.length} stages. ${STAGES.map(s => `${STAGE_LABELS[s]?.[language] || s}: ${entries.filter((e: any) => e.stage === s).length}`).join(", ")}`}
        section="Pipeline"
        suggestions={language === "he"
          ? ["מה השלב הבא?", "תן טיפים למשא ומתן", "איך לתזמן ביקורים?", "מתי כדאי לחתום?"]
          : ["What's the next step?", "Negotiation tips", "How to schedule viewings?", "When to sign?"]
        }
      />
    </div>
  );
};

export default Pipeline;
