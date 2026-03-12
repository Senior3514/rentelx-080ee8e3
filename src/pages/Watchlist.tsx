import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, BellOff, RefreshCw, MapPin, BedDouble, Maximize,
  Clock, ExternalLink, Sparkles, BookHeart, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { scanYad2, scoreScannedListing, SCAN_KEY, ScannedListing } from "@/lib/scanService";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

const CITIES: Array<{ key: "tel-aviv" | "givatayim" | "ramat-gan"; labelEn: string; labelHe: string }> = [
  { key: "tel-aviv", labelEn: "Tel Aviv", labelHe: "תל אביב" },
  { key: "givatayim", labelEn: "Givatayim", labelHe: "גבעתיים" },
  { key: "ramat-gan", labelEn: "Ramat Gan", labelHe: "רמת גן" },
];

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const Watchlist = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const qc = useQueryClient();

  const [selectedCities, setSelectedCities] = useState<Array<"tel-aviv" | "givatayim" | "ramat-gan">>(
    ["tel-aviv", "givatayim", "ramat-gan"]
  );
  const [autoScan, setAutoScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScannedListing[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load active search profile for scoring
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
    try {
      const result = await scanYad2({
        cities: selectedCities,
        minPrice: activeProfile?.min_price ?? undefined,
        maxPrice: activeProfile?.max_price ?? undefined,
        minRooms: activeProfile?.min_rooms ?? undefined,
        maxRooms: activeProfile?.max_rooms ?? undefined,
      });

      if (result.error) {
        setError(result.error);
        toast.error(language === "he" ? "שגיאה בסריקה" : "Scan error");
      } else {
        // Score & sort
        const scored = result.listings
          .map((l) => ({
            ...l,
            _score: activeProfile ? scoreScannedListing(l, activeProfile) : null,
          }))
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
            ? `נמצאו ${scored.length} דירות`
            : `Found ${scored.length} listings`
        );
        qc.invalidateQueries({ queryKey: ["listings"] });
      }
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
      toast.error(language === "he" ? "שגיאה בסריקה" : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [selectedCities, activeProfile, language, user, qc]);

  // Auto-scan polling
  useEffect(() => {
    if (!autoScan) return;
    doScan();
    const interval = setInterval(doScan, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [autoScan, doScan]);

  const toggleCity = (city: "tel-aviv" | "givatayim" | "ramat-gan") => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const cityLabel = (city: typeof CITIES[number]) =>
    language === "he" ? city.labelHe : city.labelEn;

  const scoreOf = (l: any): number | null => l._score ?? null;

  const scoreColor = (s: number | null) => {
    if (s === null) return "bg-muted text-muted-foreground";
    if (s >= 80) return "bg-score-high text-white";
    if (s >= 50) return "bg-score-medium text-white";
    return "bg-score-low text-white";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BookHeart className="h-6 w-6 text-primary" />
            {t("watchlist.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("watchlist.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoScan ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoScan((v) => !v)}
            className="gap-1.5"
          >
            {autoScan ? <Bell className="h-4 w-4 animate-bounce-subtle" /> : <BellOff className="h-4 w-4" />}
            {autoScan ? t("watchlist.autoOn") : t("watchlist.autoOff")}
          </Button>
          <Button size="sm" onClick={doScan} disabled={scanning} className="gap-1.5 glow-primary">
            <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? t("watchlist.scanning") : t("watchlist.scan")}
          </Button>
        </div>
      </div>

      {/* City filters */}
      <Card className="p-4 border-border/60">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          {t("watchlist.cities")}
        </p>
        <div className="flex flex-wrap gap-2">
          {CITIES.map((city) => (
            <button
              key={city.key}
              onClick={() => toggleCity(city.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                selectedCities.includes(city.key)
                  ? "bg-primary text-primary-foreground border-primary glow-primary"
                  : "bg-muted/50 text-muted-foreground border-border/60 hover:border-primary/40"
              }`}
            >
              {cityLabel(city)}
            </button>
          ))}
        </div>

        {activeProfile && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              {t("watchlist.scoringBy")}: <strong className="text-foreground">{activeProfile.name}</strong>
            </span>
            {activeProfile.max_price && (
              <Badge variant="outline" className="text-xs">
                ₪{activeProfile.max_price.toLocaleString()}
              </Badge>
            )}
            {activeProfile.min_rooms && (
              <Badge variant="outline" className="text-xs">
                {activeProfile.min_rooms}+ {t("common.rooms")}
              </Badge>
            )}
          </div>
        )}
      </Card>

      {/* Status bar */}
      {(fetchedAt || scanning || error) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {scanning && (
            <>
              <Zap className="h-3.5 w-3.5 text-primary animate-sparkle" />
              <span>{t("watchlist.scanning")}...</span>
            </>
          )}
          {!scanning && fetchedAt && (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>
                {t("watchlist.lastScan")}:{" "}
                {formatDistanceToNow(new Date(fetchedAt), {
                  addSuffix: true,
                  locale: language === "he" ? he : undefined,
                })}
              </span>
              {autoScan && (
                <span className="ms-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {t("watchlist.autoOn")}
                </span>
              )}
            </>
          )}
          {error && <span className="text-destructive">{error}</span>}
        </div>
      )}

      {/* Results */}
      {results.length === 0 && !scanning ? (
        <Card className="p-12 text-center border-dashed border-border/60">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <BookHeart className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{t("watchlist.empty")}</p>
              <p className="text-muted-foreground text-sm mt-1">{t("watchlist.emptyHint")}</p>
            </div>
            <Button onClick={doScan} disabled={scanning} className="gap-1.5 glow-primary">
              <Zap className="h-4 w-4" />
              {t("watchlist.scan")}
            </Button>
          </motion.div>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">
            {results.length} {t("watchlist.results")}
          </p>
          <AnimatePresence>
            {results.map((listing, i) => {
              const s = scoreOf(listing);
              return (
                <motion.div
                  key={listing.source_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 280, damping: 24 }}
                  whileHover={{ y: -2 }}
                >
                  <Card className="p-4 border-border/60 card-hover shine-overlay group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {listing.cover_image ? (
                          <img
                            src={listing.cover_image}
                            alt={listing.address ?? ""}
                            className="w-16 h-16 rounded-xl object-cover shrink-0 ring-1 ring-border/40"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="h-6 w-6 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">
                              {listing.address ?? listing.city}
                            </span>
                            <span className="text-xs text-muted-foreground">{listing.city}</span>
                            {listing.neighborhood && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                                {listing.neighborhood}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {listing.price && (
                              <span className="font-bold text-primary">
                                ₪{listing.price.toLocaleString()}
                                <span className="text-xs font-normal text-muted-foreground">/mo</span>
                              </span>
                            )}
                            {listing.rooms && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <BedDouble className="h-3.5 w-3.5" />
                                {listing.rooms}
                              </span>
                            )}
                            {listing.sqm && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Maximize className="h-3.5 w-3.5" />
                                {listing.sqm}m²
                              </span>
                            )}
                            {listing.floor != null && (
                              <span className="text-xs text-muted-foreground">
                                {t("common.floor")} {listing.floor}
                                {listing.total_floors ? `/${listing.total_floors}` : ""}
                              </span>
                            )}
                          </div>
                          {listing.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {listing.amenities.slice(0, 4).map((a) => (
                                <span key={a} className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{a}</span>
                              ))}
                              {listing.amenities.length > 4 && (
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                                  +{listing.amenities.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                          {listing.listed_at && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/70">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(listing.listed_at), {
                                addSuffix: true,
                                locale: language === "he" ? he : undefined,
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {s !== null && (
                          <div className={`px-2.5 py-1.5 rounded-full text-xs font-bold ${scoreColor(s)} ${s >= 80 ? "animate-glow" : ""}`}>
                            {s}
                          </div>
                        )}
                        <ExternalLink className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Watchlist;
