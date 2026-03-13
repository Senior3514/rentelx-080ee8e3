import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, MapPin, RefreshCw, Sparkles, Loader2, BarChart3 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface NeighborhoodStat {
  name: string;
  nameHe: string;
  city: string;
  cityHe: string;
  medianPrice: number;
  trend: number; // % change
  avgRooms: number;
  topAmenity: string;
  topAmenityHe: string;
  color: string;
  demandLevel: "high" | "medium" | "low";
}

const NEIGHBORHOODS: NeighborhoodStat[] = [
  { name: "Rothschild / Neve Tzedek", nameHe: "רוטשילד / נווה צדק", city: "Tel Aviv", cityHe: "תל אביב", medianPrice: 7200, trend: 3.2, avgRooms: 3, topAmenity: "Balcony", topAmenityHe: "מרפסת", color: "from-blue-500 to-blue-600", demandLevel: "high" },
  { name: "Florentin / Jaffa", nameHe: "פלורנטין / יפו", city: "Tel Aviv", cityHe: "תל אביב", medianPrice: 5800, trend: 1.8, avgRooms: 2.5, topAmenity: "Parking", topAmenityHe: "חניה", color: "from-violet-500 to-violet-600", demandLevel: "high" },
  { name: "Givat Rambam", nameHe: "גבעת רמב\"ם", city: "Givatayim", cityHe: "גבעתיים", medianPrice: 4900, trend: 4.1, avgRooms: 3, topAmenity: "Elevator", topAmenityHe: "מעלית", color: "from-teal-500 to-teal-600", demandLevel: "medium" },
  { name: "Givat Aliya", nameHe: "גבעת עליה", city: "Ramat Gan", cityHe: "רמת גן", medianPrice: 5200, trend: 2.5, avgRooms: 3, topAmenity: "Safe Room", topAmenityHe: "ממ\"ד", color: "from-orange-500 to-amber-500", demandLevel: "medium" },
  { name: "Basel / North TLV", nameHe: "בזל / צפון ת\"א", city: "Tel Aviv", cityHe: "תל אביב", medianPrice: 8500, trend: 1.5, avgRooms: 3.5, topAmenity: "Elevator", topAmenityHe: "מעלית", color: "from-pink-500 to-rose-500", demandLevel: "high" },
  { name: "Borochov", nameHe: "בורוכוב", city: "Givatayim", cityHe: "גבעתיים", medianPrice: 5100, trend: 3.8, avgRooms: 3, topAmenity: "Parking", topAmenityHe: "חניה", color: "from-emerald-500 to-green-600", demandLevel: "medium" },
];

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
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const handleRefresh = () => {
    setLastRefresh(new Date());
  };

  const getAiInsight = useCallback(async () => {
    setAiLoading(true);
    setAiInsight("");
    try {
      const neighborhoodData = NEIGHBORHOODS.map(n =>
        `${n.name}: ₪${n.medianPrice}/mo, trend ${n.trend > 0 ? "+" : ""}${n.trend}%, avg ${n.avgRooms} rooms, demand: ${n.demandLevel}`
      ).join("\n");

      const res = await supabase.functions.invoke("ai-assist", {
        body: {
          type: "chat",
          messages: [{
            role: "user",
            content: `Based on this Gush Dan rental market data:\n${neighborhoodData}\n\nProvide a brief (3-4 sentences) market insight and recommendation for apartment hunters. Respond in ${language === "he" ? "Hebrew" : "English"}.`
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
  }, [language]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {language === "he" ? "מחירי שוק — גוש דן" : "Market Prices — Gush Dan"}
        </h3>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={getAiInsight}
            disabled={aiLoading}
            className="gap-1 h-7 text-xs text-primary"
          >
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {language === "he" ? "תובנות AI" : "AI Insights"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className="h-3 w-3" />
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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {NEIGHBORHOODS.map((n, i) => (
          <motion.div
            key={n.name + lastRefresh.getTime()}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, type: "spring", stiffness: 280, damping: 24 }}
          >
            <Card className="p-3 border-border/60 card-hover overflow-hidden relative">
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
                  {language === "he" ? n.cityHe : n.city}
                </p>
                <p className="text-lg font-bold text-primary">
                  ₪{n.medianPrice.toLocaleString()}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs flex items-center gap-0.5 font-medium ${n.trend >= 0 ? "text-red-500" : "text-green-500"}`}>
                    {n.trend >= 0
                      ? <TrendingUp className="h-3 w-3" />
                      : <TrendingDown className="h-3 w-3" />
                    }
                    {Math.abs(n.trend)}%
                  </span>
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
