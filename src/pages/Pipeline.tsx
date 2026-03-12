import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import React, { useState } from "react";

const STAGES = [
  "new", "contacted", "viewing_scheduled", "viewed", "negotiating", "signed", "lost",
] as const;

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
  const { language } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);

  const { data: entries = [] } = useQuery({
    queryKey: ["pipeline", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_entries")
        .select("*, listings(*)")
        .eq("user_id", user!.id)
        .order("entered_stage_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ entryId, stage }: { entryId: string; stage: string }) => {
      const { error } = await supabase
        .from("pipeline_entries")
        .update({ stage, entered_stage_at: new Date().toISOString() })
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display font-bold">{STAGE_LABELS.new[language] ? "Pipeline" : "Pipeline"}</h1>

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
                <span className="ms-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                  {stageEntries.length}
                </span>
              </h3>

              <div className="space-y-2">
                {stageEntries.map((entry: any) => (
                  <Card
                    key={entry.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, entry.id)}
                    className={`p-3 cursor-grab active:cursor-grabbing transition-opacity ${
                      dragging === entry.id ? "opacity-50" : ""
                    }`}
                    onClick={() => navigate(`/listings/${entry.listing_id}`)}
                  >
                    <p className="text-sm font-medium truncate">
                      {entry.listings?.address || entry.listings?.city || "Listing"}
                    </p>
                    {entry.listings?.price && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ₪{entry.listings.price.toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.floor((Date.now() - new Date(entry.entered_stage_at).getTime()) / 86400000)}d
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Pipeline;
