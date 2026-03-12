import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Plus, Search, Inbox as InboxIcon } from "lucide-react";
import { ListingCard } from "@/components/listings/ListingCard";
import { AddListingModal } from "@/components/listings/AddListingModal";

type SortOption = "newest" | "score_desc" | "price_asc" | "price_desc";

const InboxPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
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
    let result = listings.filter((l) => {
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">{t("inbox.title")}</h1>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("inbox.addListing")}
        </Button>
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
          {filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <AddListingModal open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
};

export default InboxPage;
