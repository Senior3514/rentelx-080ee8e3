import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { AiSectionHelper } from "@/components/ui/ai-section-helper";
import {
  MapPin, BedDouble, Maximize, Building2, CheckCircle2, XCircle,
  BarChart3, Scale, Sparkles, Search, SlidersHorizontal, ArrowUpDown,
  TrendingDown, Crown, DollarSign, Star, Filter, X,
  Loader2, Save, FolderOpen, Trash2, Clock
} from "lucide-react";

/* ── Saved Comparisons ── */
interface SavedComparison {
  id: string;
  name: string;
  listingIds: string[];
  aiSummary: string;
  savedAt: string;
}

const SAVED_COMPARISONS_KEY = "rentelx_saved_comparisons";

function loadSavedComparisons(): SavedComparison[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_COMPARISONS_KEY) || "[]");
  } catch { return []; }
}

function persistSavedComparisons(items: SavedComparison[]) {
  localStorage.setItem(SAVED_COMPARISONS_KEY, JSON.stringify(items));
}

type CompareSort = "score" | "price_asc" | "price_desc" | "rooms" | "sqm";

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 80 ? "bg-score-high" : pct >= 50 ? "bg-score-medium" : "bg-score-low";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-bold w-7 text-end">{value}</span>
    </div>
  );
}

function PricePerSqm({ price, sqm, language }: { price: number | null; sqm: number | null; language: string }) {
  if (!price || !sqm) return <span className="text-muted-foreground">—</span>;
  const pps = Math.round(price / sqm);
  return (
    <span className="text-xs font-medium">
      ₪{pps.toLocaleString()}/{language === "he" ? "מ״ר" : "sqm"}
    </span>
  );
}

const Compare = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<CompareSort>("score");
  const [cityFilter, setCityFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>(() => loadSavedComparisons());
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState("");

  useEffect(() => { persistSavedComparisons(savedComparisons); }, [savedComparisons]);

  const saveComparison = () => {
    if (selected.length === 0) return;
    const name = saveName.trim() || `${language === "he" ? "השוואה" : "Comparison"} ${savedComparisons.length + 1}`;
    const saved: SavedComparison = {
      id: Math.random().toString(36).slice(2),
      name,
      listingIds: [...selected],
      aiSummary,
      savedAt: new Date().toISOString(),
    };
    setSavedComparisons(prev => [saved, ...prev]);
    setSaveName("");
  };

  const loadComparison = (comp: SavedComparison) => {
    setSelected(comp.listingIds);
    setAiSummary(comp.aiSummary || "");
    setShowSaved(false);
  };

  const deleteComparison = (id: string) => {
    setSavedComparisons(prev => prev.filter(c => c.id !== id));
  };

  const { data: listings = [] } = useQuery({
    queryKey: ["listings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("*, listing_scores(*)")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const topScore = (l: any) =>
    l.listing_scores?.reduce((m: number, s: any) => Math.max(m, s.score), 0) ?? 0;

  // Get unique cities
  const cities = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => { if (l.city) set.add(l.city); });
    return Array.from(set).sort();
  }, [listings]);

  // Filter listings for the picker
  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (searchText) {
        const s = searchText.toLowerCase();
        if (!l.address?.toLowerCase().includes(s) && !l.city?.toLowerCase().includes(s)) return false;
      }
      if (cityFilter !== "all" && l.city !== cityFilter) return false;
      if (topScore(l) < minScore) return false;
      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case "score": return topScore(b) - topScore(a);
        case "price_asc": return (a.price ?? 0) - (b.price ?? 0);
        case "price_desc": return (b.price ?? 0) - (a.price ?? 0);
        case "rooms": return (b.rooms ?? 0) - (a.rooms ?? 0);
        case "sqm": return (b.sqm ?? 0) - (a.sqm ?? 0);
        default: return 0;
      }
    });
  }, [listings, searchText, cityFilter, minScore, sortBy]);

  const compareListing = listings.filter((l) => selected.includes(l.id));

  const bestScoreId = compareListing.length > 0
    ? compareListing.reduce((best, l) => topScore(l) > topScore(best) ? l : best, compareListing[0])?.id
    : null;

  const cheapestId = compareListing.length > 0
    ? compareListing.filter(l => l.price).reduce((best, l) => (l.price ?? Infinity) < (best.price ?? Infinity) ? l : best, compareListing[0])?.id
    : null;

  const addToCompare = (id: string) => {
    if (selected.includes(id)) {
      setSelected((prev) => prev.filter((s) => s !== id));
    } else {
      setSelected((prev) => [...prev, id]);
    }
  };

  const selectAll = () => {
    setSelected(filteredListings.map(l => l.id));
  };

  const clearAll = () => {
    setSelected([]);
    setAiSummary("");
  };

  // Generate AI comparison summary
  const generateAiSummary = useCallback(async () => {
    if (compareListing.length < 2) return;
    setAiLoading(true);
    setAiSummary("");
    try {
      const listingsInfo = compareListing.map((l, i) => {
        const s = topScore(l);
        return `Listing ${i + 1}: ${l.address || l.city || "Unknown"} - ₪${l.price?.toLocaleString() || "N/A"}/mo, ${l.rooms || "?"} rooms, ${l.sqm || "?"} sqm, Floor ${l.floor ?? "?"}, Score: ${s}/100, City: ${l.city || "?"}, Amenities: ${l.amenities?.join(", ") || "none"}`;
      }).join("\n");

      const res = await supabase.functions.invoke("ai-assist", {
        body: {
          type: "analyze",
          messages: [{
            role: "user",
            content: `Compare these ${compareListing.length} rental listings side by side and provide a recommendation:\n\n${listingsInfo}\n\nProvide:\n1. A clear winner recommendation with reasoning\n2. Pros and cons of each\n3. Value for money analysis\n4. Final verdict\n\nRespond in ${language === "he" ? "Hebrew" : "English"}. Be concise but thorough.`
          }],
        },
      });

      if (res.error) throw res.error;
      if (typeof res.data === "string") {
        setAiSummary(res.data);
      } else if (res.data?.content) {
        setAiSummary(res.data.content);
      } else if (res.data instanceof ReadableStream) {
        const reader = res.data.getReader();
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
                if (content) setAiSummary((prev) => prev + content);
              } catch { /* skip */ }
            }
          }
        }
      }
    } catch {
      setAiSummary(language === "he"
        ? "לא ניתן לייצר השוואה כרגע. נסו שוב."
        : "Could not generate comparison right now. Please try again."
      );
    } finally {
      setAiLoading(false);
    }
  }, [compareListing, language]);

  const rows = [
    { label: language === "he" ? "מחיר" : "Price", key: "price", icon: DollarSign, render: (l: any) => l.price ? `₪${l.price.toLocaleString()}/mo` : "—" },
    { label: language === "he" ? "מחיר למ״ר" : "Price/sqm", key: "pps", icon: TrendingDown, render: (l: any) => <PricePerSqm price={l.price} sqm={l.sqm} language={language} /> },
    { label: language === "he" ? "חדרים" : "Rooms", key: "rooms", icon: BedDouble, render: (l: any) => l.rooms ? `${l.rooms} ${t("common.rooms")}` : "—" },
    { label: language === "he" ? "גודל" : "Size", key: "sqm", icon: Maximize, render: (l: any) => l.sqm ? `${l.sqm} ${t("common.sqm")}` : "—" },
    { label: language === "he" ? "קומה" : "Floor", key: "floor", icon: Building2, render: (l: any) => l.floor != null ? `${l.floor}${l.total_floors ? `/${l.total_floors}` : ""}` : "—" },
    { label: language === "he" ? "עיר" : "City", key: "city", icon: MapPin, render: (l: any) => l.city ?? "—" },
  ];

  const amenityKeys = [
    { en: "Parking", he: "חניה" },
    { en: "Elevator", he: "מעלית" },
    { en: "Balcony", he: "מרפסת" },
    { en: "A/C", he: "מיזוג" },
    { en: "Furnished", he: "מרוהט" },
    { en: "Safe Room", he: "ממ\"ד" },
    { en: "Storage", he: "מחסן" },
    { en: "Garden", he: "גינה" },
  ];

  // Build AI context for the helper
  const aiContext = compareListing.length > 0
    ? `Comparing ${compareListing.length} listings: ${compareListing.map(l => `${l.address || l.city} (₪${l.price?.toLocaleString()})`).join(", ")}`
    : `User has ${listings.length} listings total. No listings selected for comparison yet.`;

  return (
    <div className="w-full space-y-6 animate-fade-up pb-20 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            {language === "he" ? "השוואת דירות" : "Compare Listings"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "he"
              ? `בחרו דירות להשוואה מתוך ${listings.length} דירות`
              : `Select listings to compare from ${listings.length} total`}
            {selected.length > 0 && (
              <span className="text-primary font-semibold ms-1">
                ({selected.length} {language === "he" ? "נבחרו" : "selected"})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                {language === "he" ? "נקה" : "Clear"}
              </Button>
              <Button variant="outline" size="sm" onClick={saveComparison} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {language === "he" ? "שמור השוואה" : "Save"}
              </Button>
            </>
          )}
          {savedComparisons.length > 0 && (
            <Button
              variant={showSaved ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSaved(!showSaved)}
              className="gap-1.5"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {language === "he" ? `שמורות (${savedComparisons.length})` : `Saved (${savedComparisons.length})`}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={filteredListings.length === 0}
            className="gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {language === "he" ? "בחר הכל" : "Select All"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters
              ? (language === "he" ? "הסתר פילטרים" : "Hide Filters")
              : (language === "he" ? "פילטרים" : "Filters")}
          </Button>
        </div>
      </div>

      {/* Saved Comparisons Panel */}
      <AnimatePresence>
        {showSaved && savedComparisons.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4 border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  {language === "he" ? "השוואות שמורות" : "Saved Comparisons"}
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSaved(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {savedComparisons.map((comp) => {
                  const validCount = comp.listingIds.filter(id => listings.some(l => l.id === id)).length;
                  return (
                    <Card
                      key={comp.id}
                      className="p-3 border-border/60 cursor-pointer hover:border-primary/40 transition-colors group"
                      onClick={() => loadComparison(comp)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{comp.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {new Date(comp.savedAt).toLocaleDateString(language === "he" ? "he-IL" : "en-US")}
                            <span className="mx-1">·</span>
                            {validCount} {language === "he" ? "דירות" : "listings"}
                          </p>
                          {comp.aiSummary && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-1">
                              {comp.aiSummary.slice(0, 80)}...
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={(e) => { e.stopPropagation(); deleteComparison(comp.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4 border-border/60 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Filter className="h-4 w-4 text-primary" />
                {language === "he" ? "סינון ומיון" : "Filter & Sort"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder={language === "he" ? "חפש כתובת / עיר..." : "Search address / city..."}
                    className="ps-8 text-sm"
                  />
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as CompareSort)}>
                  <SelectTrigger className="text-sm">
                    <ArrowUpDown className="h-3.5 w-3.5 me-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">{language === "he" ? "ציון AI גבוה" : "Highest AI Score"}</SelectItem>
                    <SelectItem value="price_asc">{language === "he" ? "מחיר: נמוך → גבוה" : "Price: Low → High"}</SelectItem>
                    <SelectItem value="price_desc">{language === "he" ? "מחיר: גבוה → נמוך" : "Price: High → Low"}</SelectItem>
                    <SelectItem value="rooms">{language === "he" ? "הכי הרבה חדרים" : "Most Rooms"}</SelectItem>
                    <SelectItem value="sqm">{language === "he" ? "הכי גדול" : "Largest Size"}</SelectItem>
                  </SelectContent>
                </Select>

                {/* City Filter */}
                {cities.length > 0 && (
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="text-sm">
                      <MapPin className="h-3.5 w-3.5 me-1.5" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "he" ? "כל הערים" : "All Cities"}</SelectItem>
                      {cities.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Min Score */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {language === "he" ? "ציון מינ'" : "Min score"}: {minScore}
                  </span>
                  <Slider value={[minScore]} min={0} max={100} step={5} onValueChange={([v]) => setMinScore(v)} className="flex-1" />
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Picker */}
      <Card className="p-4 border-border/60">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {language === "he" ? "בחרו דירות להשוואה" : "Select listings to compare"}
            <span className="text-xs text-muted-foreground font-normal">
              ({filteredListings.length} {language === "he" ? "זמינות" : "available"})
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 max-h-64 overflow-y-auto p-1">
          {filteredListings.map((l) => {
            const isSelected = selected.includes(l.id);
            const score = topScore(l);
            const scoreClass = score >= 80 ? "ring-score-high/50" : score >= 50 ? "ring-score-medium/50" : "";
            return (
              <motion.button
                key={l.id}
                onClick={() => addToCompare(l.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 text-start ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : `bg-muted/50 border-border/60 hover:border-primary/40 text-foreground ${scoreClass ? `ring-1 ${scoreClass}` : ""}`
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[150px]">
                    {l.address || l.city || "Listing"}
                  </span>
                  {l.price && (
                    <span className={`shrink-0 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      ₪{l.price.toLocaleString()}
                    </span>
                  )}
                  {score > 0 && (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : score >= 80 ? "bg-score-high/15 text-score-high" : score >= 50 ? "bg-score-medium/15 text-score-medium" : "bg-muted text-muted-foreground"
                    }`}>
                      {score}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
        {filteredListings.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">{language === "he" ? "אין דירות עדיין" : "No listings yet"}</p>
        )}
      </Card>

      {/* AI Comparison Button */}
      <AnimatePresence>
        {compareListing.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="p-4 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {language === "he" ? "ניתוח AI מלא" : "Full AI Analysis"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "he"
                        ? `השווה ${compareListing.length} דירות עם תובנות AI`
                        : `Compare ${compareListing.length} listings with AI insights`}
                    </p>
                  </div>
                </div>
                <Button onClick={generateAiSummary} disabled={aiLoading} className="gap-1.5 glow-primary">
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiLoading
                    ? (language === "he" ? "מנתח..." : "Analyzing...")
                    : (language === "he" ? "נתח עם AI" : "Analyze with AI")}
                </Button>
              </div>

              <AnimatePresence>
                {aiSummary && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-primary/20"
                  >
                    <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-4 max-h-80 overflow-y-auto">
                      {aiSummary}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison table */}
      <AnimatePresence>
        {compareListing.length >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="overflow-x-auto -mx-3 px-3 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 pb-4 -mb-4 scrollbar-thin"
          >
            <div className={`grid gap-3`} style={{ gridTemplateColumns: `160px repeat(${compareListing.length}, minmax(200px, 1fr))`, minWidth: `${160 + compareListing.length * 200}px` }}>

              {/* Column headers */}
              <div /> {/* empty label cell */}
              {compareListing.map((l) => (
                <motion.div key={l.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card className={`p-3 text-center border-2 relative ${l.id === bestScoreId ? "border-primary glow-primary" : "border-border/60"}`}>
                    {l.id === bestScoreId && (
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Crown className="h-3 w-3 text-primary" />
                        <span className="text-xs text-primary font-semibold">{language === "he" ? "מומלץ" : "Best Match"}</span>
                      </div>
                    )}
                    {l.id === cheapestId && l.id !== bestScoreId && (
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <DollarSign className="h-3 w-3 text-score-high" />
                        <span className="text-xs text-score-high font-semibold">{language === "he" ? "הכי זול" : "Best Price"}</span>
                      </div>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-1">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-semibold truncate">{l.address || l.city}</p>
                    {l.city && l.address && <p className="text-xs text-muted-foreground">{l.city}</p>}
                    <button
                      onClick={() => addToCompare(l.id)}
                      className="absolute top-1.5 end-1.5 w-5 h-5 rounded-full bg-muted hover:bg-destructive/20 flex items-center justify-center transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Card>
                </motion.div>
              ))}

              {/* AI Score row */}
              <div className="flex items-center">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {language === "he" ? "ציון AI" : "AI Score"}
                </span>
              </div>
              {compareListing.map((l) => {
                const score = topScore(l);
                return (
                  <Card key={`${l.id}-score`} className={`p-3 border-border/60 ${l.id === bestScoreId ? "bg-primary/5" : ""}`}>
                    <ScoreBar value={score} />
                  </Card>
                );
              })}

              {/* Data rows */}
              {rows.map((row) => (
                <React.Fragment key={row.key}>
                  <div className="flex items-center">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <row.icon className="h-3.5 w-3.5" />
                      {row.label}
                    </span>
                  </div>
                  {compareListing.map((l) => {
                    // Highlight best value
                    let best = false;
                    if (row.key === "price") {
                      const minPrice = Math.min(...compareListing.filter((x) => x.price).map((x) => x.price));
                      best = l.price === minPrice && compareListing.filter(x => x.price).length > 1;
                    } else if (row.key === "sqm") {
                      const maxSqm = Math.max(...compareListing.filter((x) => x.sqm).map((x) => x.sqm));
                      best = l.sqm === maxSqm && compareListing.filter(x => x.sqm).length > 1;
                    } else if (row.key === "rooms") {
                      const maxRooms = Math.max(...compareListing.filter((x) => x.rooms).map((x) => x.rooms));
                      best = l.rooms === maxRooms && compareListing.filter(x => x.rooms).length > 1;
                    } else if (row.key === "pps") {
                      if (l.price && l.sqm) {
                        const ppsList = compareListing.filter(x => x.price && x.sqm).map(x => x.price / x.sqm);
                        const minPps = Math.min(...ppsList);
                        best = (l.price / l.sqm) === minPps && ppsList.length > 1;
                      }
                    }
                    return (
                      <Card key={`${l.id}-${row.key}`} className={`p-3 border-border/60 text-sm text-center ${best ? "text-score-high font-bold bg-score-high/5" : ""}`}>
                        {row.render(l)}
                        {best && <Star className="h-3 w-3 text-score-high inline-block ms-1" />}
                      </Card>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* Amenities */}
              <div className="flex items-start pt-2">
                <span className="text-xs font-semibold text-muted-foreground">{language === "he" ? "מאפיינים" : "Amenities"}</span>
              </div>
              {compareListing.map((l) => {
                const amenityCount = amenityKeys.filter(a =>
                  l.amenities?.some((am: string) =>
                    am.toLowerCase().includes(a.en.toLowerCase()) || am.includes(a.he)
                  )
                ).length;
                return (
                  <Card key={`${l.id}-amenities`} className="p-3 border-border/60 space-y-1.5">
                    {amenityKeys.map((a) => {
                      const has = l.amenities?.some((am: string) =>
                        am.toLowerCase().includes(a.en.toLowerCase()) ||
                        am.includes(a.he)
                      );
                      return (
                        <div key={a.en} className="flex items-center gap-1.5 text-xs">
                          {has
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-score-high shrink-0" />
                            : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                          }
                          <span className={has ? "text-foreground" : "text-muted-foreground/50"}>
                            {language === "he" ? a.he : a.en}
                          </span>
                        </div>
                      );
                    })}
                    <div className="pt-1 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground">
                        {amenityCount}/{amenityKeys.length} {language === "he" ? "מאפיינים" : "features"}
                      </span>
                    </div>
                  </Card>
                );
              })}

              {/* Description row */}
              <div className="flex items-start pt-2">
                <span className="text-xs font-semibold text-muted-foreground">{language === "he" ? "תיאור" : "Description"}</span>
              </div>
              {compareListing.map((l) => (
                <Card key={`${l.id}-desc`} className="p-3 border-border/60">
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {l.description || (language === "he" ? "אין תיאור" : "No description")}
                  </p>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {compareListing.length === 0 && (
        <Card className="p-10 text-center border-dashed border-border/60">
          <Scale className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {language === "he" ? "בחרו לפחות דירה אחת להשוואה" : "Select at least one listing above to compare"}
          </p>
        </Card>
      )}

      {/* AI Section Helper */}
      <AiSectionHelper
        context={aiContext}
        section="Compare"
        suggestions={language === "he"
          ? ["מה הדירה הכי משתלמת?", "השווה מחיר למ״ר", "מה חשוב בבחירת דירה?", "תסכם את ההשוואה"]
          : ["Which is the best deal?", "Compare price per sqm", "What matters when choosing?", "Summarize comparison"]
        }
      />
    </div>
  );
};

export default Compare;
