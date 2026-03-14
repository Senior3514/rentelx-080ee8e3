import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  MapPin, BedDouble, Maximize, Building2, ArrowLeft, Plus, StickyNote,
  Columns3, Sparkles, Ban, ExternalLink, Phone, User, Pencil, Save,
  X, FileDown, Info
} from "lucide-react";
import { ImageGallery } from "@/components/listings/ImageGallery";
import { motion, AnimatePresence } from "framer-motion";
import { AiSectionHelper } from "@/components/ui/ai-section-helper";

/* ─── Score Legend ─── */
const SCORE_LEGEND = {
  en: { high: "Excellent match", medium: "Good match", low: "Low match", city: "City", price: "Price", rooms: "Rooms", amenities: "Amenities", location: "Location" },
  he: { high: "התאמה מעולה", medium: "התאמה טובה", low: "התאמה נמוכה", city: "עיר", price: "מחיר", rooms: "חדרים", amenities: "מאפיינים", location: "מיקום" },
  es: { high: "Excelente coincidencia", medium: "Buena coincidencia", low: "Baja coincidencia", city: "Ciudad", price: "Precio", rooms: "Habitaciones", amenities: "Comodidades", location: "Ubicación" },
};

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const { data: listing, isLoading, error } = useQuery({
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
    enabled: !!id && !!user,
  });

  const updateListingMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("listings").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing", id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      setEditing(false);
      toast.success(language === "he" ? "הדירה עודכנה" : language === "es" ? "Listado actualizado" : "Listing updated");
    },
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
        listing.price && `Monthly Rent: ₪${listing.price.toLocaleString()}`,
        listing.rooms && `Rooms: ${listing.rooms}`,
        listing.sqm && `Size: ${listing.sqm} sqm`,
        listing.floor != null && listing.total_floors
          ? `Floor: ${listing.floor}/${listing.total_floors}`
          : listing.floor != null ? `Floor: ${listing.floor}` : null,
        listing.amenities?.length && `Amenities: ${listing.amenities.join(", ")}`,
        listing.description && `Description: ${listing.description}`,
        listing.contact_name && `Contact: ${listing.contact_name}`,
      ].filter(Boolean).join("\n");

      const analysisLang = language === "he" ? "Hebrew" : language === "es" ? "Spanish" : "English";

      const res = await supabase.functions.invoke("ai-assist", {
        body: {
          type: "analyze",
          messages: [{
            role: "user",
            content: `You are an expert Israeli rental market analyst. Analyze this apartment listing thoroughly and provide actionable insights. Respond in ${analysisLang}.

Listing Details:
${listingInfo}

Please provide:
1. Overall Assessment - Is this a good deal?
2. Price Analysis - How does the price compare to the area?
3. Key Pros & Cons
4. Red Flags to check during viewing
5. Negotiation tips for this listing
6. Final Recommendation (1-2 sentences)

Be specific, concise, and practical.`
          }],
        },
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
      } else if (res.data?.content) {
        setAiResult(res.data.content);
      } else if (res.data?.choices?.[0]?.message?.content) {
        setAiResult(res.data.choices[0].message.content);
      } else if (res.data?.error) {
        throw new Error(res.data.error);
      } else {
        setAiResult(language === "he" ? "לא ניתן לנתח כרגע. נסו שוב." : "Unable to analyze right now. Please try again.");
      }
    } catch (e: any) {
      toast.error(e.message || "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }, [listing, language]);

  const handleExportPdf = () => {
    if (!listing) return;
    const content = [
      `${listing.address || ""} - ${listing.city || ""}`,
      `${t("listing.price")}: ₪${listing.price?.toLocaleString() || "—"}`,
      `${t("listing.rooms")}: ${listing.rooms || "—"}`,
      `${t("listing.size")}: ${listing.sqm || "—"} ${t("common.sqm")}`,
      `${t("common.floor")}: ${listing.floor ?? "—"}${listing.total_floors ? `/${listing.total_floors}` : ""}`,
      listing.amenities?.length ? `${t("listing.amenities")}: ${listing.amenities.join(", ")}` : "",
      listing.description ? `\n${t("listing.description")}:\n${listing.description}` : "",
      aiResult ? `\n${t("listing.aiAnalysis")}:\n${aiResult}` : "",
    ].filter(Boolean).join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rentelx-listing-${listing.address || id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(language === "he" ? "הקובץ הורד" : "File downloaded");
  };

  const startEditing = () => {
    if (!listing) return;
    setEditForm({
      address: listing.address || "",
      city: listing.city || "",
      price: listing.price || "",
      rooms: listing.rooms || "",
      sqm: listing.sqm || "",
      floor: listing.floor ?? "",
      description: listing.description || "",
      contact_name: listing.contact_name || "",
      contact_phone: listing.contact_phone || "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    const updates: Record<string, any> = {};
    if (editForm.address) updates.address = editForm.address.trim().slice(0, 500);
    if (editForm.city) updates.city = editForm.city.trim().slice(0, 100);
    if (editForm.price) updates.price = Number(editForm.price) || null;
    if (editForm.rooms) updates.rooms = Number(editForm.rooms) || null;
    if (editForm.sqm) updates.sqm = Number(editForm.sqm) || null;
    if (editForm.floor !== "") updates.floor = Number(editForm.floor);
    if (editForm.description !== undefined) updates.description = editForm.description.trim().slice(0, 5000);
    if (editForm.contact_name !== undefined) updates.contact_name = editForm.contact_name.trim().slice(0, 200);
    if (editForm.contact_phone !== undefined) updates.contact_phone = editForm.contact_phone.trim().slice(0, 20);
    updateListingMutation.mutate(updates);
  };

  // ─── Loading state ───
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-muted-foreground">{t("listing.notFound")}</p>
        <Button variant="outline" onClick={() => navigate("/inbox")} className="mt-3 gap-1.5">
          <ArrowLeft className="h-4 w-4 flip-rtl" /> {t("common.back")}
        </Button>
      </div>
    );
  }

  // ─── Not found ───
  if (!listing) return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <p className="text-muted-foreground">{t("listing.notFound")}</p>
      <Button variant="outline" onClick={() => navigate("/inbox")} className="mt-3 gap-1.5">
        <ArrowLeft className="h-4 w-4 flip-rtl" /> {t("common.back")}
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

  const lang = (language === "he" || language === "es") ? language : "en";
  const legend = SCORE_LEGEND[lang as keyof typeof SCORE_LEGEND] || SCORE_LEGEND.en;

  const scoreColorFn = (v: number) =>
    v >= 80 ? "bg-score-high" : v >= 50 ? "bg-score-medium" : "bg-score-low";

  return (
    <motion.div
      className="max-w-2xl mx-auto space-y-6 pb-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4 flip-rtl" /> {t("common.back")}
        </Button>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={saveEdit} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> {t("common.save")}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Title + Score badge */}
      <div className="flex items-start justify-between gap-3">
        <div>
          {editing ? (
            <div className="space-y-2">
              <Input value={editForm.address} onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))} placeholder={t("addListing.address")} className="text-lg font-bold" />
              <Input value={editForm.city} onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))} placeholder={t("addListing.city")} />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-display font-bold">{listing.address || listing.city || t("listing.details")}</h1>
              {listing.city && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4" /> {listing.city}
                </p>
              )}
            </>
          )}
        </div>
        {topScore > 0 && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className={`px-3 py-1.5 rounded-full text-sm font-bold text-white shrink-0 ${scoreColorFn(topScore)} ${topScore >= 80 ? "animate-glow" : ""}`}
          >
            {t("inbox.score")}: {topScore}
          </motion.div>
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
        {editing ? (
          <>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("listing.price")}</p>
              <Input value={editForm.price} onChange={(e) => setEditForm(f => ({ ...f, price: e.target.value }))} type="number" className="h-8" />
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("listing.rooms")}</p>
              <Input value={editForm.rooms} onChange={(e) => setEditForm(f => ({ ...f, rooms: e.target.value }))} type="number" step="0.5" className="h-8" />
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("listing.size")}</p>
              <Input value={editForm.sqm} onChange={(e) => setEditForm(f => ({ ...f, sqm: e.target.value }))} type="number" className="h-8" />
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("common.floor")}</p>
              <Input value={editForm.floor} onChange={(e) => setEditForm(f => ({ ...f, floor: e.target.value }))} type="number" className="h-8" />
            </Card>
          </>
        ) : (
          <>
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
          </>
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

      {/* Score Breakdown with Legend */}
      {breakdown && Object.keys(breakdown).length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t("listing.scoreBreakdown")}</h3>
            {/* Score Legend */}
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-score-high" />{legend.high}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-score-medium" />{legend.medium}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-score-low" />{legend.low}</span>
            </div>
          </div>
          {Object.entries(breakdown).filter(([k]) => k !== "total").map(([key, value], idx) => {
            const numVal = typeof value === "number" ? value : 0;
            const labelKey = key as keyof typeof legend;
            const displayLabel = legend[labelKey] || key.replace(/_/g, " ");
            return (
              <motion.div
                key={key}
                className="space-y-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.08 }}
              >
                <div className="flex justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{displayLabel}</span>
                  <span className="font-bold">{numVal}</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${scoreColorFn(numVal)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${numVal}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + idx * 0.1, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            );
          })}
          {/* Total score */}
          <div className="pt-2 border-t border-border/40">
            <div className="flex justify-between text-sm font-bold">
              <span>{language === "he" ? "ציון כולל" : language === "es" ? "Puntuación total" : "Total Score"}</span>
              <motion.span
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className={`px-2 py-0.5 rounded-full text-white text-xs ${scoreColorFn(topScore)}`}
              >
                {topScore}/100
              </motion.span>
            </div>
          </div>
        </Card>
      )}

      {/* Description */}
      {editing ? (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("listing.description")}</h3>
          <Textarea value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} rows={4} />
        </Card>
      ) : listing.description ? (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("listing.description")}</h3>
          <p className="text-sm whitespace-pre-wrap">{listing.description}</p>
        </Card>
      ) : null}

      {/* Amenities */}
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

      {/* Contact */}
      {editing ? (
        <Card className="p-4 space-y-2">
          <h3 className="font-semibold text-sm mb-1">{t("listing.contact")}</h3>
          <Input value={editForm.contact_name} onChange={(e) => setEditForm(f => ({ ...f, contact_name: e.target.value }))} placeholder={t("addListing.contactName")} />
          <Input value={editForm.contact_phone} onChange={(e) => setEditForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder={t("addListing.contactPhone")} dir="ltr" />
        </Card>
      ) : (listing.contact_name || listing.contact_phone) ? (
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
      ) : null}

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
        {!aiResult && !aiLoading && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            {language === "he" ? "לחץ 'נתח עם AI' לקבלת ניתוח מקצועי מלא" : language === "es" ? "Haz clic en 'Analizar con IA' para un análisis profesional completo" : "Click 'Analyze with AI' for a full professional analysis"}
          </p>
        )}
        <AnimatePresence>
          {aiLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 py-3"
            >
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">{t("listing.analyzing")}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {aiResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3"
          >
            {aiResult}
          </motion.div>
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
          : language === "es"
          ? ["¿Es justo el precio?", "¿Qué verificar en la visita?", "Pros y contras", "Tips de negociación"]
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
    </motion.div>
  );
};

export default ListingDetail;
