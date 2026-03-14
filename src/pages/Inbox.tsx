import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Plus, Search, Inbox as InboxIcon, Download, Scale, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ListingCard } from "@/components/listings/ListingCard";
import { AddListingModal } from "@/components/listings/AddListingModal";
import { motion } from "framer-motion";
import { AiSectionHelper } from "@/components/ui/ai-section-helper";

type SortOption = "newest" | "score_desc" | "price_asc" | "price_desc";

const InboxPage = () => {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [minScore, setMinScore] = useState(0);
  const [cityFilter, setCityFilter] = useState("all");

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, listing_scores(*)")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const cities = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => { if (l.city) set.add(l.city); });
    return Array.from(set).sort();
  }, [listings]);

  const filtered = useMemo(() => {
    const result = listings.filter((l) => {
      if (search) {
        const s = search.toLowerCase();
        if (!l.address?.toLowerCase().includes(s) && !l.city?.toLowerCase().includes(s)) return false;
      }
      if (cityFilter !== "all" && l.city !== cityFilter) return false;
      const topScore = l.listing_scores?.length
        ? Math.max(...l.listing_scores.map((s) => s.score))
        : 0;
      if (topScore < minScore) return false;
      return true;
    });

    result.sort((a, b) => {
      const scoreA = a.listing_scores?.length ? Math.max(...a.listing_scores.map((s) => s.score)) : 0;
      const scoreB = b.listing_scores?.length ? Math.max(...b.listing_scores.map((s) => s.score)) : 0;
      switch (sortBy) {
        case "score_desc": return scoreB - scoreA;
        case "price_asc": return (a.price ?? 0) - (b.price ?? 0);
        case "price_desc": return (b.price ?? 0) - (a.price ?? 0);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [listings, search, sortBy, minScore, cityFilter]);

  const exportPDF = () => {
    const isRtl = language === "he";
    const rows = filtered.map((l) => {
      const score = l.listing_scores?.length ? Math.max(...l.listing_scores.map((s: any) => s.score)) : "—";
      const amenities = Array.isArray(l.amenities) ? (l.amenities as string[]).join(", ") : "";
      return `
        <tr>
          <td>${l.address ?? "—"}</td>
          <td>${l.city ?? "—"}</td>
          <td>₪${l.price?.toLocaleString() ?? "—"}</td>
          <td>${l.rooms ?? "—"}</td>
          <td>${l.sqm ?? "—"}</td>
          <td>${score}</td>
          <td style="font-size:11px">${amenities}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html dir="${isRtl ? "rtl" : "ltr"}" lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <title>${isRtl ? "ספריית דירות" : "Apartment Library"}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;600&display=swap');
    body { font-family: 'Rubik', Arial, sans-serif; margin: 20px; color: #1a1a2e; direction: ${isRtl ? "rtl" : "ltr"}; }
    h1 { color: #e07b45; font-size: 22px; margin-bottom: 4px; }
    p { color: #666; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #e07b45; color: #fff; padding: 8px 10px; text-align: ${isRtl ? "right" : "left"}; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafaf8; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${isRtl ? "ספריית דירות — RentelX" : "Apartment Library — RentelX"}</h1>
  <p>${isRtl ? `סה"כ ${filtered.length} דירות · ${new Date().toLocaleDateString("he-IL")}` : `${filtered.length} listings · ${new Date().toLocaleDateString()}`}</p>
  <table>
    <thead>
      <tr>
        <th>${isRtl ? "כתובת" : "Address"}</th>
        <th>${isRtl ? "עיר" : "City"}</th>
        <th>${isRtl ? "מחיר" : "Price"}</th>
        <th>${isRtl ? "חדרים" : "Rooms"}</th>
        <th>${isRtl ? "מ\"ר" : "SQM"}</th>
        <th>${isRtl ? "ציון" : "Score"}</th>
        <th>${isRtl ? "מאפיינים" : "Amenities"}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.print(); }, 500);
    }
  };

  const exportCSV = () => {
    const header = ["Address", "City", "Price", "Rooms", "SQM", "Floor", "Score", "Created"];
    const rows = filtered.map((l) => {
      const score = l.listing_scores?.length ? Math.max(...l.listing_scores.map((s: any) => s.score)) : "";
      return [
        l.address ?? "",
        l.city ?? "",
        l.price ?? "",
        l.rooms ?? "",
        l.sqm ?? "",
        l.floor ?? "",
        score,
        new Date(l.created_at).toLocaleDateString(),
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rentelx-listings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">{t("inbox.title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/compare")} className="gap-1.5 hidden sm:flex">
            <Scale className="h-4 w-4" />
            {language === "he" ? "השוואה" : "Compare"}
          </Button>
          {filtered.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            </>
          )}
          <Button onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("inbox.addListing")}
          </Button>
        </div>
      </div>

      {/* Search + Sort + Filter controls */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("inbox.filter") + "..."} className="ps-9" />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("inbox.sort")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("inbox.sortNewest")}</SelectItem>
              <SelectItem value="score_desc">{t("inbox.sortScoreDesc")}</SelectItem>
              <SelectItem value="price_asc">{t("inbox.sortPriceAsc")}</SelectItem>
              <SelectItem value="price_desc">{t("inbox.sortPriceDesc")}</SelectItem>
            </SelectContent>
          </Select>

          {cities.length > 0 && (
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("inbox.allCities")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inbox.allCities")}</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2 min-w-[200px]">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t("inbox.minScore")}: {minScore}</span>
            <Slider value={[minScore]} min={0} max={100} step={5} onValueChange={([v]) => setMinScore(v)} className="flex-1" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <InboxIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="text-lg font-medium">{t("inbox.empty")}</h3>
          <p className="text-sm text-muted-foreground">{t("inbox.emptySubtitle")}</p>
          <Button variant="outline" onClick={() => setShowAdd(true)} className="gap-1.5 mt-2">
            <Plus className="h-4 w-4" /> {t("inbox.addListing")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((listing, index) => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, x: direction === "rtl" ? 16 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
            >
              <ListingCard listing={listing} />
            </motion.div>
          ))}
        </div>
      )}

      {/* AI Inbox Helper */}
      {filtered.length > 0 && (
        <AiSectionHelper
          context={`Inbox has ${filtered.length} listings. Top cities: ${cities.join(", ")}. Price range: ₪${Math.min(...filtered.filter(l => l.price).map(l => l.price)).toLocaleString()} - ₪${Math.max(...filtered.filter(l => l.price).map(l => l.price)).toLocaleString()}. Average score: ${Math.round(filtered.reduce((sum, l) => sum + (l.listing_scores?.reduce((m: number, s: any) => Math.max(m, s.score), 0) ?? 0), 0) / filtered.length)}.`}
          section="Inbox"
          suggestions={language === "he"
            ? ["מה הדירה הכי טובה?", "סכם את כל הדירות", "השווה מחירים", "מה כדאי לבדוק?"]
            : ["What's the best listing?", "Summarize all listings", "Compare prices", "What should I check?"]
          }
        />
      )}

      <AddListingModal open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
};

export default InboxPage;
