import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Radar, RefreshCw, MapPin, BedDouble, Maximize,
  Clock, ExternalLink, Sparkles, Zap, PlusCircle,
  Check, Radio, Filter, WifiOff, RotateCcw, TrendingUp,
  Building2, Star, ChevronRight, ChevronLeft, Phone, User
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { scanYad2, scoreScannedListing, SCAN_KEY, ScannedListing, ScanCity } from "@/lib/scanService";
import { AiSectionHelper } from "@/components/ui/ai-section-helper";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

const CITIES: Array<{ key: ScanCity; labelEn: string; labelHe: string; color: string }> = [
  { key: "tel-aviv",    labelEn: "Tel Aviv",      labelHe: "תל אביב",      color: "blue"   },
  { key: "givatayim",   labelEn: "Givatayim",     labelHe: "גבעתיים",      color: "violet" },
  { key: "ramat-gan",   labelEn: "Ramat Gan",     labelHe: "רמת גן",       color: "teal"   },
  { key: "holon",       labelEn: "Holon",         labelHe: "חולון",         color: "indigo" },
  { key: "bat-yam",     labelEn: "Bat Yam",       labelHe: "בת ים",         color: "sky"    },
  { key: "bnei-brak",   labelEn: "Bnei Brak",     labelHe: "בני ברק",      color: "emerald"},
  { key: "petah-tikva", labelEn: "Petah Tikva",   labelHe: "פתח תקווה",    color: "orange" },
  { key: "herzliya",    labelEn: "Herzliya",      labelHe: "הרצליה",        color: "pink"   },
  { key: "rishon",      labelEn: "Rishon LeZion", labelHe: "ראשון לציון",   color: "amber"  },
];

const CITY_COLOR: Record<string, string> = {
  blue:    "bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400",
  violet:  "bg-violet-500/10 border-violet-500/40 text-violet-600 dark:text-violet-400",
  teal:    "bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-400",
  indigo:  "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400",
  sky:     "bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400",
  emerald: "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  orange:  "bg-orange-500/10 border-orange-500/40 text-orange-600 dark:text-orange-400",
  pink:    "bg-pink-500/10 border-pink-500/40 text-pink-600 dark:text-pink-400",
  amber:   "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400",
};

const CITY_ACTIVE: Record<string, string> = {
  blue:    "bg-blue-500 border-blue-500 text-white shadow-blue-500/30",
  violet:  "bg-violet-500 border-violet-500 text-white shadow-violet-500/30",
  teal:    "bg-teal-500 border-teal-500 text-white shadow-teal-500/30",
  indigo:  "bg-indigo-500 border-indigo-500 text-white shadow-indigo-500/30",
  sky:     "bg-sky-500 border-sky-500 text-white shadow-sky-500/30",
  emerald: "bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/30",
  orange:  "bg-orange-500 border-orange-500 text-white shadow-orange-500/30",
  pink:    "bg-pink-500 border-pink-500 text-white shadow-pink-500/30",
  amber:   "bg-amber-500 border-amber-500 text-white shadow-amber-500/30",
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

const Scan = () => {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const qc = useQueryClient();

  const [selectedCities, setSelectedCities] = useState<ScanCity[]>(
    ["tel-aviv", "givatayim", "ramat-gan"]
  );
  const [scanning, setScanning]   = useState(false);
  const [results, setResults]     = useState<ScannedListing[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saved, setSaved]         = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  const { data: activeProfile } = useQuery({
    queryKey: ["active_profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("search_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const doScan = useCallback(async () => {
    if (selectedCities.length === 0) {
      toast.error(language === "he" ? "בחרו לפחות עיר אחת" : "Select at least one city");
      return;
    }
    setScanning(true);
    setError(null);
    setUnavailable(false);
    setCurrentPage(1);
    try {
      const scanParams = {
        cities: selectedCities,
        minPrice: activeProfile?.min_price ?? undefined,
        maxPrice: activeProfile?.max_price ?? undefined,
        minRooms: activeProfile?.min_rooms ?? undefined,
        maxRooms: activeProfile?.max_rooms ?? undefined,
      };

      let result = await scanYad2(scanParams);

      if (result.unavailable || result.listings.length === 0) {
        for (let attempt = 0; attempt < 2 && result.listings.length === 0; attempt++) {
          await new Promise((r) => setTimeout(r, 2000 + attempt * 1500));
          const retryResult = await scanYad2(scanParams);
          if (retryResult.listings.length > 0) {
            result = retryResult;
            break;
          }
        }
        if (result.listings.length === 0) {
          setUnavailable(true);
          setResults([]);
          setFetchedAt(result.fetchedAt);
          toast.info(
            language === "he"
              ? "הסריקה לא מצאה תוצאות כרגע — נסו שוב בעוד מספר דקות"
              : "Scan found no results — try again shortly"
          );
          return;
        }
      }

      const scored = result.listings
        .map((l) => ({ ...l, _score: activeProfile ? scoreScannedListing(l, activeProfile) : null }))
        .sort((a, b) => {
          if (a._score !== null && b._score !== null) return b._score - a._score;
          if (a.price && b.price) return a.price - b.price;
          return 0;
        });

      setResults(scored as ScannedListing[]);
      setFetchedAt(result.fetchedAt);
      if (user) localStorage.setItem(SCAN_KEY(user.id), result.fetchedAt);
      toast.success(
        language === "he"
          ? `נמצאו ${scored.length} דירות בזמן אמת`
          : `Found ${scored.length} live listings`
      );
      qc.invalidateQueries({ queryKey: ["listings"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(language === "he" ? "שגיאה בסריקה" : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [selectedCities, activeProfile, language, user, qc]);

  const toggleCity = (city: ScanCity) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const saveToInbox = async (listing: ScannedListing) => {
    if (!user || saved.has(listing.source_id)) return;
    try {
      const { error: insertErr } = await supabase.from("listings").insert({
        user_id: user.id,
        address: listing.address,
        city: listing.city,
        price: listing.price,
        rooms: listing.rooms,
        sqm: listing.sqm,
        floor: listing.floor,
        total_floors: listing.total_floors,
        description: listing.description,
        amenities: listing.amenities,
        contact_name: listing.contact_name,
        contact_phone: listing.contact_phone,
        source_url: listing.source_url,
        image_urls: listing.image_urls?.length ? listing.image_urls : (listing.cover_image ? [listing.cover_image] : []),
        status: "active",
      });
      if (insertErr) throw insertErr;
      setSaved((prev) => new Set([...prev, listing.source_id]));
      toast.success(language === "he" ? "הדירה נשמרה לתיבה" : "Saved to Inbox!");
      qc.invalidateQueries({ queryKey: ["listings"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    }
  };

  const cityLabel = (city: typeof CITIES[number]) => language === "he" ? city.labelHe : city.labelEn;
  const scoreOf = (l: ScannedListing & { _score?: number | null }): number | null => (l as any)._score ?? null;
  const scoreColor = (s: number | null) => {
    if (s === null) return "bg-muted text-muted-foreground";
    if (s >= 80)   return "bg-score-high text-white";
    if (s >= 50)   return "bg-score-medium text-white";
    return "bg-score-low text-white";
  };

  const highScoreCount = results.filter((l) => (scoreOf(l) ?? 0) >= 80).length;
  const avgPrice = results.length
    ? Math.round(results.filter((l) => l.price).reduce((s, l) => s + (l.price ?? 0), 0) / results.filter((l) => l.price).length)
    : null;

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full space-y-6 animate-fade-up pb-20" dir={direction}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Radar className="h-4.5 w-4.5 text-cyan-500" />
            </div>
            {t("scan.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("scan.subtitle")}</p>
        </div>
        <Button
          size="sm"
          onClick={doScan}
          disabled={scanning}
          className="gap-1.5 glow-primary relative overflow-hidden"
        >
          {scanning
            ? <RefreshCw className="h-4 w-4 animate-spin" />
            : <Zap className="h-4 w-4" />}
          {scanning ? t("scan.scanning") : t("scan.scanNow")}
          {scanning && (
            <span className="absolute inset-0 bg-white/10 animate-shimmer" />
          )}
        </Button>
      </div>

      {/* Stats strip */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              {
                icon: <Building2 className="h-4 w-4 text-primary" />,
                value: results.length,
                label: language === "he" ? "דירות חיות" : "Live listings",
              },
              {
                icon: <Star className="h-4 w-4 text-score-high" />,
                value: highScoreCount,
                label: language === "he" ? "ציון גבוה (80+)" : "High score (80+)",
              },
              {
                icon: <TrendingUp className="h-4 w-4 text-score-medium" />,
                value: avgPrice ? `₪${avgPrice.toLocaleString()}` : "—",
                label: language === "he" ? "מחיר ממוצע" : "Avg. price",
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 300, damping: 24 }}
              >
                <Card className="p-3 border-border/60 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {stat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight tabular-nums">{stat.value}</p>
                    <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* City filters */}
      <Card className="p-4 border-border/60">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {t("scan.filters")}
          </p>
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
            {language === "he" ? `${selectedCities.length} ערים נבחרו` : `${selectedCities.length} cities selected`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {CITIES.map((city) => {
            const active = selectedCities.includes(city.key);
            return (
              <motion.button
                key={city.key}
                onClick={() => toggleCity(city.key)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 shadow-sm ${
                  active ? CITY_ACTIVE[city.color] + " shadow-md" : CITY_COLOR[city.color]
                }`}
              >
                {cityLabel(city)}
              </motion.button>
            );
          })}
        </div>

        {/* Active profile info */}
        {activeProfile && (
          <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>{t("scan.scoringBy")}:</span>
              <strong className="text-foreground font-semibold">{activeProfile.name}</strong>
            </span>
            {activeProfile?.max_price && (
              <Badge variant="outline" className="text-xs">
                ≤ ₪{activeProfile.max_price.toLocaleString()}
              </Badge>
            )}
            {activeProfile?.min_rooms && (
              <Badge variant="outline" className="text-xs">
                {activeProfile.min_rooms}+ {t("common.rooms")}
              </Badge>
            )}
          </div>
        )}
      </Card>

      {/* Status bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap"
      >
        <AnimatePresence mode="popLayout">
          {scanning && (
            <motion.div
              key="scanning-pill"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30"
            >
              <Radio className="h-3.5 w-3.5 text-cyan-500 animate-pulse" />
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                {language === "he" ? "סורק יד2..." : "Scanning Yad2..."}
              </span>
            </motion.div>
          )}
          {!scanning && fetchedAt && !unavailable && (
            <motion.div
              key="lastscan-pill"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border border-border/60"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce-subtle" />
              <span>
                {t("scan.lastScan")}:{" "}
                {formatDistanceToNow(new Date(fetchedAt), {
                  addSuffix: true,
                  locale: language === "he" ? he : undefined,
                })}
              </span>
            </motion.div>
          )}
          {results.length > 0 && !scanning && (
            <motion.div
              key="count-pill"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border border-border/60 ms-auto"
            >
              <Filter className="h-3 w-3" />
              <span>{results.length} {t("scan.results")}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Unavailable state */}
      <AnimatePresence>
        {unavailable && !scanning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-8 border-border/60 border-dashed">
              <div className="flex flex-col items-center text-center gap-4">
                <motion.div
                  className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center"
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <WifiOff className="h-7 w-7 text-muted-foreground" />
                </motion.div>
                <div>
                  <p className="font-semibold text-lg">
                    {language === "he" ? "אין תוצאות כרגע" : "No Results Right Now"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {language === "he"
                      ? "הסריקה לא מצאה דירות תואמות כרגע. נסו שוב בעוד מספר דקות או שנו את הפילטרים."
                      : "Scan found no matching listings right now. Try again shortly or adjust your filters."}
                  </p>
                </div>
                <Button onClick={doScan} variant="outline" className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  {language === "he" ? "נסה שוב" : "Retry"}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && !unavailable && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-center gap-2"
        >
          <span className="font-medium">{error}</span>
          <Button size="sm" variant="ghost" onClick={doScan} className="ms-auto gap-1 h-7 text-xs">
            <RotateCcw className="h-3 w-3" />
            {language === "he" ? "נסה שוב" : "Retry"}
          </Button>
        </motion.div>
      )}

      {/* Empty state */}
      {results.length === 0 && !scanning && !unavailable && !error && (
        <Card className="p-12 text-center border-dashed border-border/60">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="space-y-5"
          >
            <motion.div
              className="w-20 h-20 rounded-3xl bg-cyan-500/10 flex items-center justify-center mx-auto"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Radar className="h-9 w-9 text-cyan-500" />
            </motion.div>
            <div>
              <p className="font-semibold text-xl">{t("scan.empty")}</p>
              <p className="text-muted-foreground text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">
                {t("scan.emptyHint")}
              </p>
            </div>
            <Button onClick={doScan} disabled={scanning} className="gap-2 glow-primary">
              <Zap className="h-4 w-4" />
              {t("scan.scanNow")}
            </Button>
          </motion.div>
        </Card>
      )}

      {/* Results grid */}
      <AnimatePresence>
        {results.length > 0 && !scanning && (
          <motion.div
            key={`results-page-${currentPage}`}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
          >
            {paginatedResults.map((listing) => {
              const s = scoreOf(listing);
              const CITY_HE_MAP: Record<string, ScanCity> = {
                "תל אביב": "tel-aviv",
                "גבעתיים": "givatayim",
                "רמת גן": "ramat-gan",
                "חולון": "holon",
                "בת ים": "bat-yam",
                "בני ברק": "bnei-brak",
                "פתח תקווה": "petah-tikva",
                "הרצליה": "herzliya",
                "ראשון לציון": "rishon",
              };
              const cityKey = Object.entries(CITY_HE_MAP).find(([heName]) => listing.city.includes(heName))?.[1];
              const cityInfo = CITIES.find((c) => c.key === cityKey);

              return (
                <motion.div
                  key={listing.source_id}
                  variants={itemVariants}
                  whileHover={{ y: -2, transition: { duration: 0.18 } }}
                  layout
                >
                  <Card className="border-border/60 card-hover group overflow-hidden h-full">
                    {/* Cover image */}
                    <div className="relative w-full h-40 overflow-hidden">
                      {listing.cover_image ? (
                        <img
                          src={listing.cover_image}
                          alt={listing.address ?? listing.city}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 via-primary/10 to-transparent flex items-center justify-center">
                          <Building2 className="h-10 w-10 text-primary/30" />
                        </div>
                      )}
                      {s !== null && (
                        <div className={`absolute top-2 start-2 px-2.5 py-1 rounded-xl text-xs font-bold shadow-md backdrop-blur-sm ${scoreColor(s)} ${s >= 80 ? "animate-glow" : ""}`}>
                          {s}
                        </div>
                      )}
                      {/* Actions overlay */}
                      <div className="absolute top-2 end-2 flex items-center gap-1">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); saveToInbox(listing); }}
                          title={language === "he" ? "שמור לתיבה" : "Save to Inbox"}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all ${
                            saved.has(listing.source_id)
                              ? "bg-score-high/80 text-white"
                              : "bg-black/40 text-white hover:bg-primary/80"
                          }`}
                        >
                          {saved.has(listing.source_id)
                            ? <Check className="h-4 w-4" />
                            : <PlusCircle className="h-4 w-4" />}
                        </motion.button>
                        {listing.source_url && (
                          <motion.a
                            href={listing.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={language === "he" ? "פתח ביד2" : "Open on Yad2"}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/80 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4 text-white" />
                          </motion.a>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-snug truncate">
                            {listing.address ?? listing.city}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {cityInfo && (
                              <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${CITY_COLOR[cityInfo.color]}`}>
                                {listing.city}
                              </span>
                            )}
                            {listing.neighborhood && (
                              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                {listing.neighborhood}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Price + stats */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {listing.price && (
                          <span className="font-bold text-lg text-primary leading-none">
                            ₪{listing.price.toLocaleString()}
                            <span className="text-xs font-normal text-muted-foreground">/mo</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        {listing.rooms && (
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-3.5 w-3.5" />
                            {listing.rooms}
                          </span>
                        )}
                        {listing.sqm && (
                          <span className="flex items-center gap-1">
                            <Maximize className="h-3.5 w-3.5" />
                            {listing.sqm}m²
                          </span>
                        )}
                        {listing.floor != null && (
                          <span className="flex items-center gap-1">
                            <ChevronRight className="h-3 w-3 flip-rtl" />
                            {language === "he" ? "קומה" : "Fl."} {listing.floor}
                            {listing.total_floors ? `/${listing.total_floors}` : ""}
                          </span>
                        )}
                      </div>

                      {/* Amenity chips */}
                      {listing.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {listing.amenities.slice(0, 4).map((a) => (
                            <span key={a} className="text-[10px] bg-muted/80 border border-border/50 px-2 py-0.5 rounded-full text-muted-foreground">
                              {a}
                            </span>
                          ))}
                          {listing.amenities.length > 4 && (
                            <span className="text-[10px] bg-muted/80 border border-border/50 px-2 py-0.5 rounded-full text-muted-foreground">
                              +{listing.amenities.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Contact */}
                      {(listing.contact_name || listing.contact_phone) && (
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1.5 border-t border-border/30">
                          {listing.contact_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[120px]">{listing.contact_name}</span>
                            </span>
                          )}
                          {listing.contact_phone && (
                            <a
                              href={`tel:${listing.contact_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              <span dir="ltr">{listing.contact_phone}</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Time */}
                      {listing.listed_at && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(listing.listed_at), {
                            addSuffix: true,
                            locale: language === "he" ? he : undefined,
                          })}
                          <div className="ms-auto w-1.5 h-1.5 rounded-full bg-green-500" title="Live" />
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && !scanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4 flip-rtl" />
            {language === "he" ? "הקודם" : "Previous"}
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((page, idx, arr) => {
                const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                return (
                  <span key={page} className="contents">
                    {showEllipsis && <span className="px-1 text-muted-foreground">...</span>}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                        currentPage === page
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {page}
                    </button>
                  </span>
                );
              })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="gap-1"
          >
            {language === "he" ? "הבא" : "Next"}
            <ChevronRight className="h-4 w-4 flip-rtl" />
          </Button>
          <span className="text-xs text-muted-foreground ms-2">
            {language === "he"
              ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, results.length)} מתוך ${results.length}`
              : `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, results.length)} of ${results.length}`}
          </span>
        </motion.div>
      )}

      {/* AI Helper */}
      {results.length > 0 && (
        <AiSectionHelper
          context={`Scan found ${results.length} listings. ${highScoreCount} with high score (80+). Average price: ${avgPrice ? `₪${avgPrice.toLocaleString()}` : "N/A"}. Cities scanned: ${selectedCities.join(", ")}.`}
          section="Scan"
          suggestions={language === "he"
            ? ["מה הדירה הכי טובה?", "תסכם את הממצאים", "מגמות מחירים", "איזו שכונה הכי שווה?"]
            : ["Best listing found?", "Summarize findings", "Price trends", "Which neighborhood?"]
          }
        />
      )}

      {/* Scanning skeleton */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            key="skeletons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="border-border/60 overflow-hidden">
                  <div className="w-full h-40 bg-muted animate-pulse" />
                  <div className="p-3.5 space-y-2.5">
                    <div className="h-4 bg-muted rounded-md animate-pulse w-3/4" />
                    <div className="h-3 bg-muted rounded-md animate-pulse w-1/2" />
                    <div className="h-5 bg-muted rounded-md animate-pulse w-1/3" />
                    <div className="flex gap-1.5">
                      {[40, 55, 48].map((w, j) => (
                        <div key={j} className="h-4 bg-muted rounded-full animate-pulse" style={{ width: w }} />
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Scan;
