import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, BedDouble, Maximize, Building2, ArrowLeft, Plus, StickyNote, Columns3 } from "lucide-react";

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("listings")
        .select("*, listing_scores(*), listing_notes(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await (supabase as any).from("listing_notes").insert({
        listing_id: id!, user_id: user!.id, content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing", id] });
      setNoteText("");
      toast.success("Note added");
    },
  });

  const addToPipelineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("pipeline_entries").insert({
        listing_id: id!, user_id: user!.id, stage: "new",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Added to pipeline!"); navigate("/pipeline"); },
    onError: (e: any) => {
      if (e.message?.includes("duplicate")) toast.info("Already in pipeline");
      else toast.error(e.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!listing) return <p>Not found</p>;

  const topScore = listing.listing_scores?.reduce(
    (max: number, s: any) => Math.max(max, s.score), 0
  ) ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" /> {t("onboarding.back")}
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{listing.address || listing.city || "Listing"}</h1>
          {listing.city && (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" /> {listing.city}
            </p>
          )}
        </div>
        {topScore > 0 && (
          <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${
            topScore >= 80 ? "bg-score-high text-white" : topScore >= 50 ? "bg-score-medium text-white" : "bg-score-low text-white"
          }`}>
            {t("inbox.score")}: {topScore}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {listing.price && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("onboarding.step2.priceRange")}</p>
            <p className="font-bold text-lg">{t("common.shekel")}{listing.price.toLocaleString()}</p>
          </Card>
        )}
        {listing.rooms && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("common.rooms")}</p>
            <p className="font-bold text-lg">{listing.rooms}</p>
          </Card>
        )}
        {listing.sqm && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("common.sqm")}</p>
            <p className="font-bold text-lg">{listing.sqm}</p>
          </Card>
        )}
        {listing.floor != null && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("common.floor")}</p>
            <p className="font-bold text-lg">{listing.floor}</p>
          </Card>
        )}
      </div>

      {listing.description && (
        <Card className="p-4"><p className="text-sm whitespace-pre-wrap">{listing.description}</p></Card>
      )}

      <div className="flex gap-2">
        <Button onClick={() => addToPipelineMutation.mutate()} className="gap-1.5">
          <Columns3 className="h-4 w-4" /> Move to Pipeline
        </Button>
      </div>

      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-1.5">
          <StickyNote className="h-4 w-4" /> Notes
        </h3>
        <div className="space-y-2 mb-3">
          {listing.listing_notes?.map((note: any) => (
            <Card key={note.id} className="p-3">
              <p className="text-sm">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(note.created_at).toLocaleDateString()}</p>
            </Card>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." rows={2} className="flex-1" />
          <Button size="sm" onClick={() => noteText.trim() && addNoteMutation.mutate(noteText)} disabled={!noteText.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
