import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, MapPin, RefreshCw, Sparkles, Loader2, BarChart3, Wifi } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface NeighborhoodStat {
  name: string;
  nameHe: string;
  city: string;
  cityHe: string;
  medianPrice: number;
  listingCount: number;
  avgRooms: number;
  topAmenity: string;
  topAmenityHe: string;
  color: string;
  demandLevel: "high" | "medium" | "low";
  isLive: boolean;
}

/* City config for live scan */
const CITY_CONFIGS: { key: string; name: string; nameHe: string; color: string }[] = [
  { key: "tel-aviv", name: "Tel Aviv", nameHe: "תל אביב", color: "from-blue-500 to-blue-600" },
  { key: "givatayim", name: "Givatayim", nameHe: "גבעתיים", color: "from-teal-500 to-teal-600" },
  { key: "ramat-gan", name: "Ramat Gan", nameHe: "רמת גן", color: "from-orange-500 to-amber-500" },
  { key: "holon", name: "Holon", nameHe: "חולון", color: "from-violet-500 to-violet-600" },
  { key: "herzliya", name: "Herzliya", nameHe: "הרצליה", color: "from-pink-500 to-rose-500" },
  { key: "rishon", name: "Rishon LeZion", nameHe: "ראשון לציון", color: "from-emerald-500 to-green-600" },
];

const CACHE_KEY = "rentelx_market_data_v2";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCachedData(): { data: NeighborhoodStat[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts < CACHE_TTL) return parsed;
  } catch { /* ignore */ }
  return null;
}

function setCachedData(data: NeighborhoodStat[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

const DEMAND_COLORS = {
  high: "bg-red-500/10 text-red-500 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  low: "bg-green-500/10 text-green-500 border-green-500/30",
};

const DEMAND_LABELS = {
  high: { en: "High Demand", he: "ביקוש גבוה" },
  medium: { en: "Medium", he: "ביקוש בינוני" },
  low: { en: "Low Demand", he: "ביקוש נמוך" },
};

export function NeighborhoodInsights() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [liveData, setLiveData] = useState<NeighborhoodStat[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  // Load cached data on mount
  useEffect(() => {
    const cached = getCachedData();
    if (cached) {
      setLiveData(cached.data);
      setLastScanTime(new Date(cached.ts));
    } else {
      // Auto-scan on first load
      fetchLiveData();
    }
  }, []);

  const fetchLiveData = useCallback(async () => {
    setScanning(true);
    try {
      const cities = CITY_CONFIGS.map(c => c.key);
      const res = await supabase.functions.invoke("scan-yad2", {
        body: { cities, minRooms: 2, maxRooms: 4 },
      });

      if (res.error) throw res.error;
      const listings: any[] = res.data?.listings ?? [];

      if (listings.length === 0) {
        setScanning(false);
        return;
      }

      // Group listings by city and compute stats
      const cityGroups: Record<string, any[]> = {};
      for (const l of listings) {
        const city = l.city || "Unknown";
        if (!cityGroups[city]) cityGroups[city] = [];
        cityGroups[city].push(l);
      }

      const stats: NeighborhoodStat[] = [];
      for (const cfg of CITY_CONFIGS) {
        // Match city by Hebrew name
        const cityListings = cityGroups[cfg.nameHe] ?? [];
        if (cityListings.length === 0) continue;

        // Compute median price
        const prices = cityListings
          .map((l: any) => typeof l.price === "number" ? l.price : parseInt(l.price))
          .filter((p: number) => p > 1000 && p < 50000)
          .sort((a: number, b: number) => a - b);

        if (prices.length === 0) continue;

        const medianPrice = prices.length % 2 === 0
          ? Math.round((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2)
          : prices[Math.floor(prices.length / 2)];

        // Average rooms
        const rooms = cityListings
          .map((l: any) => typeof l.rooms === "number" ? l.rooms : parseFloat(l.rooms))
          .filter((r: number) => r > 0 && r < 10);
        const avgRooms = rooms.length > 0
          ? Math.round(rooms.reduce((s: number, r: number) => s + r, 0) / rooms.length * 2) / 2
          : 3;

        // Top amenity
        const amenityCounts: Record<string, number> = {};
        for (const l of cityListings) {
          if (Array.isArray(l.amenities)) {
            for (const a of l.amenities) {
              amenityCounts[a] = (amenityCounts[a] || 0) + 1;
            }
          }
        }
        const sortedAmenities = Object.entries(amenityCounts).sort(([, a], [, b]) => b - a);
        const topAmenityHe = sortedAmenities[0]?.[0] || "—";
        const amenityMap: Record<string, string> = {
          "מעלית": "Elevator", "חניה": "Parking", "מרפסת": "Balcony",
          "מיזוג": "A/C", 'ממ"ד': "Safe Room", "מחסן": "Storage",
          "דוד שמש": "Solar Heater", "מרוהטת": "Furnished",
          "סורגים": "Window Bars",
        };
        const topAmenity = amenityMap[topAmenityHe] || topAmenityHe;

        // Demand level based on listing count
        const demandLevel: "high" | "medium" | "low" =
          cityListings.length >= 15 ? "high" :
          cityListings.length >= 5 ? "medium" : "low";

        stats.push({
          name: cfg.name,
          nameHe: cfg.nameHe,
          city: cfg.name,
          cityHe: cfg.nameHe,
          medianPrice,
          listingCount: cityListings.length,
          avgRooms,
          topAmenity,
          topAmenityHe,
          color: cfg.color,
          demandLevel,
          isLive: true,
        });
      }

      // Sort by median price descending
      stats.sort((a, b) => b.medianPrice - a.medianPrice);

      if (stats.length > 0) {
        setLiveData(stats);
        setCachedData(stats);
        setLastScanTime(new Date());
      }
    } catch (err) {
      console.error("Market scan error:", err);
    } finally {
      setScanning(false);
    }
  }, []);

  const neighborhoods = liveData;

  const getAiInsight = useCallback(async () => {
    if (neighborhoods.length === 0) return;
    setAiLoading(true);
    setAiInsight("");
    try {
      const neighborhoodData = neighborhoods.map(n =>
        `${n.name} (${n.nameHe}): median ₪${n.medianPrice}/mo, ${n.listingCount} listings, avg ${n.avgRooms} rooms, demand: ${n.demandLevel}`
      ).join("\n");

      const res = await supabase.functions.invoke("ai-assist", {
        body: {
          type: "chat",
          messages: [{
            role: "user",
            content: `Based on this LIVE Gush Dan rental market scan data (from Yad2, just fetched):\n${neighborhoodData}\n\nProvide a brief (3-4 sentences) market insight and recommendation for apartment hunters. Mention specific cities and prices. Respond in ${language === "he" ? "Hebrew" : "English"}.`
          }],
        },
      });

      if (res.error) throw res.error;
      if (typeof res.data === "string") setAiInsight(res.data);
      else if (res.data?.content) setAiInsight(res.data.content);
    } catch {
      setAiInsight(language === "he"
        ? "לא ניתן לטעון תובנות כרגע."
        : "Unable to load insights right now."
      );
    } finally {
      setAiLoading(false);
    }
  }, [language, neighborhoods]);

  const lastScanLabel = useMemo(() => {
    if (!lastScanTime) return null;
    const mins = Math.round((Date.now() - lastScanTime.getTime()) / 60000);
    if (mins < 1) return language === "he" ? "עכשיו" : "just now";
    if (mins < 60) return language === "he" ? `לפני ${mins} דק'` : `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return language === "he" ? `לפני ${hrs} שע'` : `${hrs}h ago`;
  }, [lastScanTime, language]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {language === "he" ? "מחירי שוק בזמן אמת — גוש דן" : "Live Market Prices — Gush Dan"}
          {neighborhoods.length > 0 && neighborhoods[0].isLive && (
            <span className="inline-flex items-center gap-1 text-[9px] text-green-500 font-normal normal-case">
              <Wifi className="h-2.5 w-2.5" />
              LIVE
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          {lastScanLabel && (
            <span className="text-[10px] text-muted-foreground/60">{lastScanLabel}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={getAiInsight}
            disabled={aiLoading || neighborhoods.length === 0}
            className="gap-1 h-7 text-xs text-primary"
          >
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {language === "he" ? "תובנות AI" : "AI Insights"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLiveData}
            disabled={scanning}
            className="h-7 w-7 p-0"
            title={language === "he" ? "סרוק מחירים מיד2" : "Scan live prices from Yad2"}
          >
            <RefreshCw className={`h-3 w-3 ${scanning ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* AI Insight */}
      {aiInsight && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-3 border-primary/20 bg-primary/5">
            <div className="flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-relaxed">{aiInsight}</p>
            </div>
          </Card>
        </motion.div>
      )}

      {scanning && neighborhoods.length === 0 && (
        <Card className="p-6 text-center border-border/60">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-xs text-muted-foreground">
            {language === "he" ? "סורק מחירים מיד2..." : "Scanning live prices from Yad2..."}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {neighborhoods.map((n, i) => (
          <motion.div
            key={n.name + (lastScanTime?.getTime() ?? 0)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, type: "spring", stiffness: 280, damping: 24 }}
          >
            <Card
              className="p-3 border-border/60 card-hover overflow-hidden relative cursor-pointer"
              onClick={() => navigate("/watchlist")}
            >
              <div className={`absolute top-0 start-0 w-1 h-full bg-gradient-to-b ${n.color} rounded-s-xl`} />
              <div className="ps-2">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-xs font-semibold truncate">
                    {language === "he" ? n.nameHe : n.name}
                  </p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 ${DEMAND_COLORS[n.demandLevel]}`}>
                    {DEMAND_LABELS[n.demandLevel][language === "he" ? "he" : "en"]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {n.listingCount} {language === "he" ? "דירות" : "listings"}
                </p>
                <p className="text-lg font-bold text-primary tabular-nums">
                  ₪{n.medianPrice.toLocaleString()}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{language === "he" ? "חודש" : "mo"}
                  </span>
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-2.5 w-2.5" />
                    {n.avgRooms} {language === "he" ? "חד'" : "rm"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {language === "he" ? n.topAmenityHe : n.topAmenity}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
