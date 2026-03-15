import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import React, { useState, useMemo, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Inbox, MapPin, BedDouble, MoreHorizontal, ArrowRight, Trash2, ExternalLink, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AiSectionHelper } from "@/components/ui/ai-section-helper";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const STAGES = ["new", "contacted", "viewing_scheduled", "viewed", "negotiating", "signed", "lost"] as const;
type Stage = (typeof STAGES)[number];

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
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Touch drag state
  const touchRef = useRef<{
    entryId: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      toast.success(language === "he" ? "השלב עודכן" : "Stage updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("pipeline_entries")
        .delete()
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(language === "he" ? "הדירה הוסרה מהתהליך וחזרה לספרייה" : "Listing removed from pipeline");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    e.dataTransfer.setData("entryId", entryId);
    e.dataTransfer.effectAllowed = "move";
    setDragging(entryId);
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    const entryId = e.dataTransfer.getData("entryId");
    if (entryId) {
      const currentEntry = entries.find((en: any) => en.id === entryId);
      if (currentEntry && currentEntry.stage !== stage) {
        moveMutation.mutate({ entryId, stage });
      }
    }
    setDragging(null);
    setDragOverStage(null);
  };

  const totalCount = entries.length;

  const maxStage = useMemo(() => {
    let maxCount = 0;
    let maxStageName = "";
    STAGES.forEach((stage) => {
      const count = entries.filter((e: any) => e.stage === stage).length;
      if (count > maxCount) { maxCount = count; maxStageName = stage; }
    });
    return maxCount > 0 ? maxStageName : "";
  }, [entries]);

  /** Stage action menu for a pipeline card */
  const StageMenu = ({ entry, currentStage }: { entry: any; currentStage: string }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {language === "he" ? "העבר לשלב" : "Move to stage"}
          </DropdownMenuLabel>
          {STAGES.filter((s) => s !== currentStage).map((stage) => (
            <DropdownMenuItem
              key={stage}
              onClick={(e) => {
                e.stopPropagation();
                moveMutation.mutate({ entryId: entry.id, stage });
              }}
              className="gap-2 text-xs cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${STAGE_COLORS[stage]}`} />
              {STAGE_LABELS[stage]?.[language] || stage}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/listings/${entry.listing_id}`);
            }}
            className="gap-2 text-xs cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {language === "he" ? "פתח דירה" : "View listing"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              removeMutation.mutate(entry.id);
            }}
            className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {language === "he" ? "הסר מהתהליך" : "Remove from pipeline"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderEntryCard = (entry: any, currentStage: string) => {
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
          onDragEnd={handleDragEnd}
          className={`p-2.5 cursor-pointer card-hover shine-overlay border-border/60 group transition-all duration-200 ${
            dragging === entry.id ? "opacity-40 scale-95 ring-2 ring-primary/40" : ""
          } ${!isMobile ? "cursor-grab active:cursor-grabbing" : ""}`}
          onClick={() => navigate(`/listings/${entry.listing_id}`)}
        >
          <div className="flex items-start gap-1.5">
            {/* Drag handle (desktop) */}
            {!isMobile && (
              <div className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors mt-0.5 shrink-0">
                <GripVertical className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {entry.listings?.address || entry.listings?.city || "Listing"}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {entry.listings?.price && (
                  <span className="text-xs font-medium text-primary">
                    ₪{entry.listings.price.toLocaleString()}
                  </span>
                )}
                {entry.listings?.rooms && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <BedDouble className="h-3 w-3" /> {entry.listings.rooms}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/60 ms-auto">{daysInStage}d</span>
              </div>
            </div>
            {/* Action menu */}
            <StageMenu entry={entry} currentStage={currentStage} />
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
        /* ── Mobile: grouped list with stage menus ── */
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
                    <AnimatePresence>{stageEntries.map((e: any) => renderEntryCard(e, stage))}</AnimatePresence>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Desktop: kanban board with drag & drop ── */
        <div className="grid grid-cols-7 gap-3 pb-4">
          {STAGES.map((stage, stageIdx) => {
            const stageEntries = entries.filter((e: any) => e.stage === stage);
            const isMax = stage === maxStage;
            const isDragOver = dragOverStage === stage;
            return (
              <motion.div
                key={stage}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: stageIdx * 0.06, type: "spring", stiffness: 260, damping: 22 }}
                className={`min-w-0 bg-muted/50 rounded-xl p-3 min-h-[300px] border transition-all duration-300 ${
                  isDragOver
                    ? "border-primary/60 bg-primary/5 shadow-[0_0_16px_hsl(var(--primary)/0.2)]"
                    : isMax
                      ? "border-primary/30 ring-1 ring-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.1)]"
                      : "border-border/40"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverStage(stage);
                }}
                onDragLeave={() => setDragOverStage(null)}
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
                        className={`flex flex-col items-center gap-1 text-xs py-6 transition-colors ${
                          isDragOver ? "text-primary/60" : "text-muted-foreground/50"
                        }`}
                      >
                        <Inbox className="h-4 w-4" />
                        <span>{isDragOver ? (language === "he" ? "שחרר כאן" : "Drop here") : t("pipeline.empty")}</span>
                      </motion.div>
                    ) : (
                      stageEntries.map((e: any) => renderEntryCard(e, stage))
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
