import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { MapPin, BedDouble, Maximize, Building2, Clock, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { he } from "date-fns/locale";

interface ListingCardProps {
  listing: any;
}

export const ListingCard = ({ listing }: ListingCardProps) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const topScore = listing.listing_scores?.reduce(
    (max: number, s: any) => Math.max(max, s.score),
    0
  ) ?? 0;

  const scoreColor =
    topScore >= 80 ? "bg-score-high text-white" :
    topScore >= 50 ? "bg-score-medium text-white" :
    "bg-score-low text-white";

  const timeAgo = formatDistanceToNow(new Date(listing.created_at), {
    addSuffix: false,
    locale: language === "he" ? he : undefined,
  });

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
    <Card
      className="p-4 cursor-pointer card-hover shine-overlay border-border/60 group"
      onClick={() => navigate(`/listings/${listing.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <MapPin className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-semibold truncate block">{listing.address || listing.city || "Unknown"}</span>
              {listing.city && listing.address && (
                <span className="text-xs text-muted-foreground">{listing.city}</span>
              )}
            </div>
            {listing.source_url && (
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            {listing.price && (
              <span className="font-bold text-primary text-base">
                {t("common.shekel")}{listing.price.toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground">{t("common.perMonth")}</span>
              </span>
            )}
            {listing.rooms && (
              <span className="flex items-center gap-1 text-xs">
                <BedDouble className="h-3.5 w-3.5" />
                {listing.rooms} {t("common.rooms")}
              </span>
            )}
            {listing.sqm && (
              <span className="flex items-center gap-1 text-xs">
                <Maximize className="h-3.5 w-3.5" />
                {listing.sqm} {t("common.sqm")}
              </span>
            )}
            {listing.floor != null && (
              <span className="flex items-center gap-1 text-xs">
                <Building2 className="h-3.5 w-3.5" />
                {t("common.floor")} {listing.floor}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs ms-auto">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
          </div>

          {listing.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {listing.amenities.slice(0, 3).map((a: string) => (
                <span key={a} className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{a}</span>
              ))}
              {listing.amenities.length > 3 && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  +{listing.amenities.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {topScore > 0 && (
            <div className={`px-2.5 py-1.5 rounded-full text-xs font-bold ${scoreColor} ${topScore >= 80 ? "animate-glow" : ""} stat-number`}>
              {topScore}
            </div>
          )}
          {listing.listing_scores?.length > 0 && (() => {
            const best = listing.listing_scores.reduce((b: any, s: any) => s.score > (b?.score ?? 0) ? s : b, null);
            const bd = best?.breakdown as Record<string, number> | null;
            if (!bd) return null;
            const dims = Object.entries(bd).filter(([k]) => k !== "total").slice(0, 4);
            if (dims.length === 0) return null;
            return (
              <div className="flex gap-0.5 w-16">
                {dims.map(([k, v]) => {
                  const val = typeof v === "number" ? v : 0;
                  const segColor = val >= 80 ? "bg-score-high" : val >= 50 ? "bg-score-medium" : "bg-score-low";
                  return (
                    <div key={k} className={`flex-1 h-1.5 rounded-sm ${segColor} opacity-80`} title={`${k}: ${val}`} />
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </Card>
    </motion.div>
  );
};
