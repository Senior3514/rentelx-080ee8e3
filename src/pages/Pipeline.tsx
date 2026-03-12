import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import React, { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Inbox } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STAGES = ["new", "contacted", "viewing_scheduled", "viewed", "negotiating", "signed", "lost"] as const;

const STAGE_LABELS: Record<string, Record<string, string>> = {
  new: { en: "New", he: "חדש" },
  contacted: { en: "Contacted", he: "נוצר קשר" },
  viewing_scheduled: { en: "Viewing", he: "ביקור" },
  viewed: { en: "Viewed", he: "נצפה" },
  negotiating: { en: "Negotiating", he: "מו\"מ" },
  signed: { en: "Signed", he: "חתום" },
  lost: { en: "Lost", he: "אבוד" },
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

  const renderEntryCard = (entry: any) => (
    <motion.div
      key={entry.id}
      layoutId={entry.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        draggable={!isMobile}
        onDragStart={(e) => handleDragStart(e, entry.id)}
        className={`p-3 cursor-pointer transition-opacity ${dragging === entry.id ? "opacity-50" : ""} ${!isMobile ? "cursor-grab active:cursor-grabbing" : ""}`}
        onClick={() => navigate(`/listings/${entry.listing_id}`)}
      >
        <p className="text-sm font-medium truncate">{entry.listings?.address || entry.listings?.city || "Listing"}</p>
        {entry.listings?.price && (
          <p className="text-xs text-muted-foreground mt-1">₪{entry.listings.price.toLocaleString()}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {Math.floor((Date.now() - new Date(entry.entered_stage_at).getTime()) / 86400000)}d
        </p>
      </Card>
    </motion.div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">{t("pipeline.title")}</h1>
        <span className="text-sm text-muted-foreground">{t("pipeline.totalListings")}: {totalCount}</span>
      </div>

      {isMobile ? (
        // Mobile: grouped list view
        <div className="space-y-4">
          {STAGES.map((stage) => {
            const stageEntries = entries.filter((e: any) => e.stage === stage);
            return (
              <div key={stage}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
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
                    {stageEntries.map(renderEntryCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Desktop: kanban board
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageEntries = entries.filter((e: any) => e.stage === stage);
            return (
              <div
                key={stage}
                className="flex-shrink-0 w-56 bg-muted/50 rounded-xl p-3 min-h-[300px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  {STAGE_LABELS[stage]?.[language] || stage}
                  <span className="ms-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{stageEntries.length}</span>
                </h3>
                <div className="space-y-2">
                  {stageEntries.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground/50 py-6">
                      <Inbox className="h-4 w-4" />
                      <span>{t("pipeline.empty")}</span>
                    </div>
                  ) : (
                    stageEntries.map(renderEntryCard)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Pipeline;
