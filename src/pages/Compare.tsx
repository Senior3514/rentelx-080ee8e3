import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, BedDouble, Maximize, Building2, CheckCircle2, XCircle,
  BarChart3, Scale, Sparkles
} from "lucide-react";
import { useLanguage as useLang } from "@/i18n/LanguageContext";

const MAX_COMPARE = 3;

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 80 ? "bg-score-high" : pct >= 50 ? "bg-score-medium" : "bg-score-low";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
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

const Compare = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);

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

  const compareListing = listings.filter((l) => selected.includes(l.id));

  const topScore = (l: any) =>
    l.listing_scores?.reduce((m: number, s: any) => Math.max(m, s.score), 0) ?? 0;

  const bestScoreId = compareListing.length > 0
    ? compareListing.reduce((best, l) => topScore(l) > topScore(best) ? l : best, compareListing[0])?.id
    : null;

  const addToCompare = (id: string) => {
    if (selected.includes(id)) {
      setSelected((prev) => prev.filter((s) => s !== id));
    } else if (selected.length < MAX_COMPARE) {
      setSelected((prev) => [...prev, id]);
    }
  };

  const rows = [
    { label: language === "he" ? "מחיר" : "Price", key: "price", render: (l: any) => l.price ? `₪${l.price.toLocaleString()}/mo` : "—" },
    { label: language === "he" ? "חדרים" : "Rooms", key: "rooms", render: (l: any) => l.rooms ? `${l.rooms} ${t("common.rooms")}` : "—" },
    { label: language === "he" ? "גודל" : "Size", key: "sqm", render: (l: any) => l.sqm ? `${l.sqm} ${t("common.sqm")}` : "—" },
    { label: language === "he" ? "קומה" : "Floor", key: "floor", render: (l: any) => l.floor != null ? `${l.floor}${l.total_floors ? `/${l.total_floors}` : ""}` : "—" },
    { label: language === "he" ? "עיר" : "City", key: "city", render: (l: any) => l.city ?? "—" },
  ];

  const amenityKeys = [
    { en: "Parking", he: "חניה" },
    { en: "Elevator", he: "מעלית" },
    { en: "Balcony", he: "מרפסת" },
    { en: "A/C", he: "מיזוג" },
    { en: "Furnished", he: "מרוהט" },
    { en: "Safe Room", he: "ממ\"ד" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          {language === "he" ? "השוואת דירות" : "Compare Listings"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {language === "he" ? `בחרו עד ${MAX_COMPARE} דירות להשוואה` : `Select up to ${MAX_COMPARE} listings to compare`}
        </p>
      </div>

      {/* Picker */}
      <Card className="p-4 border-border/60">
        <p className="text-sm font-semibold mb-3">{language === "he" ? "בחרו דירות" : "Select listings"}</p>
        <div className="flex flex-wrap gap-2">
          {listings.map((l) => {
            const isSelected = selected.includes(l.id);
            const disabled = !isSelected && selected.length >= MAX_COMPARE;
            return (
              <button
                key={l.id}
                disabled={disabled}
                onClick={() => addToCompare(l.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : disabled
                    ? "opacity-30 cursor-not-allowed bg-muted border-border/40"
                    : "bg-muted/50 border-border/60 hover:border-primary/40 text-foreground"
                }`}
              >
                {l.address || l.city || "Listing"}
                {l.price ? ` · ₪${l.price.toLocaleString()}` : ""}
              </button>
            );
          })}
        </div>
        {listings.length === 0 && (
          <p className="text-sm text-muted-foreground">{language === "he" ? "אין דירות עדיין" : "No listings yet"}</p>
        )}
      </Card>

      {/* Comparison table */}
      <AnimatePresence>
        {compareListing.length >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="overflow-x-auto"
          >
            <div className={`grid gap-4 min-w-0`} style={{ gridTemplateColumns: `140px repeat(${compareListing.length}, 1fr)` }}>

              {/* Column headers */}
              <div /> {/* empty label cell */}
              {compareListing.map((l) => (
                <motion.div key={l.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card className={`p-3 text-center border-2 ${l.id === bestScoreId ? "border-primary glow-primary" : "border-border/60"}`}>
                    {l.id === bestScoreId && (
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span className="text-xs text-primary font-semibold">{language === "he" ? "מומלץ" : "Best Match"}</span>
                      </div>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-1">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-semibold truncate">{l.address || l.city}</p>
                    {l.city && l.address && <p className="text-xs text-muted-foreground">{l.city}</p>}
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
              {compareListing.map((l) => (
                <Card key={l.id} className="p-3 border-border/60">
                  <ScoreBar value={topScore(l)} />
                </Card>
              ))}

              {/* Data rows */}
              {rows.map((row) => (
                <>
                  <div key={`label-${row.key}`} className="flex items-center">
                    <span className="text-xs font-semibold text-muted-foreground">{row.label}</span>
                  </div>
                  {compareListing.map((l) => {
                    // Highlight best value
                    let best = false;
                    if (row.key === "price") {
                      const minPrice = Math.min(...compareListing.filter((x) => x.price).map((x) => x.price));
                      best = l.price === minPrice;
                    } else if (row.key === "sqm") {
                      const maxSqm = Math.max(...compareListing.filter((x) => x.sqm).map((x) => x.sqm));
                      best = l.sqm === maxSqm;
                    } else if (row.key === "rooms") {
                      const maxRooms = Math.max(...compareListing.filter((x) => x.rooms).map((x) => x.rooms));
                      best = l.rooms === maxRooms;
                    }
                    return (
                      <Card key={`${l.id}-${row.key}`} className={`p-3 border-border/60 text-sm text-center ${best ? "text-score-high font-bold" : ""}`}>
                        {row.render(l)}
                      </Card>
                    );
                  })}
                </>
              ))}

              {/* Amenities */}
              <div className="flex items-start pt-2">
                <span className="text-xs font-semibold text-muted-foreground">{language === "he" ? "מאפיינים" : "Amenities"}</span>
              </div>
              {compareListing.map((l) => (
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
    </div>
  );
};

export default Compare;
