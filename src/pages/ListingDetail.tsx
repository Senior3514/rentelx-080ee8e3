import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, BedDouble, Maximize, Building2, ArrowLeft, Plus, StickyNote, Columns3, Sparkles, X, Ban, ExternalLink, Phone, User } from "lucide-react";
import { ImageGallery } from "@/components/listings/ImageGallery";
import { motion } from "framer-motion";
import { AiSectionHelper } from "@/components/ui/ai-section-helper";

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
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
      const sanitized = content.trim().slice(0, 2000);
      if (!sanitized) throw new Error("Empty note");
      const { error } = await supabase.from("listing_notes").insert({
        listing_id: id!, user_id: user!.id, content: sanitized,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing", id] });
      setNoteText("");
      toast.success(t("listing.noteAdded"));
    },
  });

  const addToPipelineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pipeline_entries").insert({
        listing_id: id!, user_id: user!.id, stage: "new",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("listing.movedToPipeline")); navigate("/pipeline"); },
    onError: (e: any) => {
      if (e.message?.includes("duplicate")) toast.info("Already in pipeline");
      else toast.error(e.message);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("listings")
        .update({ status: "dismissed" })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("listing.dismissed"));
      navigate("/inbox");
    },
  });

  const handleAiAnalysis = useCallback(async () => {
    if (!listing) return;
    setAiLoading(true);
    setAiResult("");
    try {
      const listingInfo = [
        listing.address && `Address: ${listing.address}`,
        listing.city && `City: ${listing.city}`,
        listing.price && `Price: ₪${listing.price}/mo`,
        listing.rooms && `Rooms: ${listing.rooms}`,
        listing.sqm && `Size: ${listing.sqm} sqm`,
        listing.floor != null && `Floor: ${listing.floor}`,
        listing.amenities?.length && `Amenities: ${listing.amenities.join(", ")}`,
        listing.description && `Description: ${listing.description}`,
      ].filter(Boolean).join("\n");

      const res = await supabase.functions.invoke("ai-assist", {
        body: { type: "analyze", messages: [{ role: "user", content: `Analyze this rental listing:\n${listingInfo}` }] },
      });

      if (res.error) throw res.error;

      const reader = res.data instanceof ReadableStream
        ? res.data.getReader()
        : null;

      if (reader) {
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
                if (content) setAiResult((prev) => prev + content);
              } catch { /* skip non-JSON lines */ }
            }
          }
        }
      } else if (typeof res.data === "string") {
        setAiResult(res.data);
      } else if (res.data?.error) {
        throw new Error(res.data.error);
      }
    } catch (e: any) {
      toast.error(e.message || "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }, [listing]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!listing) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">{t("listing.notFound")}</p>
      <Button variant="outline" onClick={() => navigate("/inbox")} className="mt-3 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Button>
    </div>
  );

  const topScore = listing.listing_scores?.reduce(
    (max: number, s: any) => Math.max(max, s.score), 0
  ) ?? 0;

  const bestScoreEntry = listing.listing_scores?.length
    ? listing.listing_scores.reduce((best: any, s: any) => s.score > (best?.score ?? 0) ? s : best, null)
    : null;
  const breakdown = bestScoreEntry?.breakdown as Record<string, number> | null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-1.5">
        <ArrowLeft className="h-4 w-4 flip-rtl" /> {t("common.back")}
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{listing.address || listing.city || t("listing.details")}</h1>
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

      {/* Image Gallery */}
      {listing.image_urls && listing.image_urls.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-2">{t("listing.photos")}</h3>
          <ImageGallery images={listing.image_urls} />
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {listing.price && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("listing.price")}</p>
            <p className="font-bold text-lg">{t("common.shekel")}{listing.price.toLocaleString()}</p>
          </Card>
        )}
        {listing.rooms && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("listing.rooms")}</p>
            <p className="font-bold text-lg">{listing.rooms}</p>
          </Card>
        )}
        {listing.sqm && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("listing.size")}</p>
            <p className="font-bold text-lg">{listing.sqm} {t("common.sqm")}</p>
          </Card>
        )}
        {listing.floor != null && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("common.floor")}</p>
            <p className="font-bold text-lg">
              {listing.floor}
              {listing.total_floors ? `/${listing.total_floors}` : ""}
            </p>
          </Card>
        )}
      </div>

      {/* Source URL */}
      {listing.source_url && (
        <a
          href={listing.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors font-medium"
        >
          <ExternalLink className="h-4 w-4" /> {t("listing.viewOriginal")}
        </a>
      )}

      {/* Score Breakdown */}
      {breakdown && Object.keys(breakdown).length > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">{t("listing.scoreBreakdown")}</h3>
          {Object.entries(breakdown).filter(([k]) => k !== "total").map(([key, value], idx) => {
            const numVal = typeof value === "number" ? value : 0;
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{key.replace(/_/g, " ")}</span>
                  <span className="font-medium">{numVal}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${numVal}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + idx * 0.1, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {listing.description && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("listing.description")}</h3>
          <p className="text-sm whitespace-pre-wrap">{listing.description}</p>
        </Card>
      )}

      {listing.amenities?.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("listing.amenities")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {listing.amenities.map((a: string) => (
              <span key={a} className="text-xs bg-muted px-2 py-1 rounded-full">{a}</span>
            ))}
          </div>
        </Card>
      )}

      {(listing.contact_name || listing.contact_phone) && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("listing.contact")}</h3>
          <div className="space-y-1">
            {listing.contact_name && (
              <p className="text-sm flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" /> {listing.contact_name}
              </p>
            )}
            {listing.contact_phone && (
              <a href={`tel:${listing.contact_phone}`} className="text-sm flex items-center gap-1.5 text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" /> {listing.contact_phone}
              </a>
            )}
          </div>
        </Card>
      )}

      {/* AI Analysis */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> {t("listing.aiAnalysis")}
          </h3>
          <Button size="sm" variant="outline" onClick={handleAiAnalysis} disabled={aiLoading} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {aiLoading ? t("listing.analyzing") : t("listing.analyze")}
          </Button>
        </div>
        {aiResult && (
          <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{aiResult}</div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={() => addToPipelineMutation.mutate()} className="gap-1.5 flex-1">
          <Columns3 className="h-4 w-4" /> {t("listing.moveToPipeline")}
        </Button>
        <Button variant="destructive" onClick={() => dismissMutation.mutate()} className="gap-1.5 flex-1">
          <Ban className="h-4 w-4" /> {t("listing.dismiss")}
        </Button>
      </div>

      {/* AI Section Helper */}
      <AiSectionHelper
        context={`Listing: ${listing.address || ""} ${listing.city || ""}, ₪${listing.price?.toLocaleString() || "?"}/mo, ${listing.rooms || "?"} rooms, ${listing.sqm || "?"} sqm, Floor ${listing.floor ?? "?"}, Amenities: ${listing.amenities?.join(", ") || "none"}, Score: ${topScore}/100`}
        section="Listing Detail"
        suggestions={language === "he"
          ? ["האם המחיר הוגן?", "מה לבדוק בביקור?", "יתרונות וחסרונות", "טיפים למו\"מ"]
          : ["Is the price fair?", "What to check in a viewing?", "Pros and cons", "Negotiation tips"]
        }
      />

      {/* Notes */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-1.5">
          <StickyNote className="h-4 w-4" /> {t("listing.notes")}
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
          <div className="flex-1 relative">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value.slice(0, 2000))}
              placeholder={t("listing.addNote")}
              rows={2}
              maxLength={2000}
            />
            {noteText.length > 1800 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {noteText.length}/2000
              </p>
            )}
          </div>
          <Button size="sm" onClick={() => noteText.trim() && addNoteMutation.mutate(noteText)} disabled={!noteText.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
