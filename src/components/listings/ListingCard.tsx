import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { MapPin, BedDouble, Maximize, Building2, Clock, ExternalLink, Phone, User, Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { he } from "date-fns/locale";
import { useState } from "react";

interface ListingCardProps {
  listing: any;
}

export const ListingCard = ({ listing }: ListingCardProps) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

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

  const coverImage = listing.image_urls?.[0];
  const hasImages = coverImage && !imgError;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
    <Card
      className="overflow-hidden cursor-pointer card-hover shine-overlay border-border/60 group"
      onClick={() => navigate(`/listings/${listing.id}`)}
    >
      {/* Cover image */}
      {coverImage && (
        <div className={`relative w-full h-40 bg-muted overflow-hidden ${imgError ? "hidden" : ""}`}>
          <img
            src={coverImage}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          {/* Score badge overlay on image */}
          {topScore > 0 && (
            <div className={`absolute top-2.5 end-2.5 px-2.5 py-1.5 rounded-xl text-xs font-bold ${scoreColor} ${topScore >= 80 ? "animate-glow" : ""} stat-number shadow-lg backdrop-blur-sm`}>
              {topScore}
            </div>
          )}
          {/* Image count badge */}
          {listing.image_urls?.length > 1 && (
            <div className="absolute bottom-2.5 end-2.5 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-black/50 text-white backdrop-blur-sm flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {listing.image_urls.length}
            </div>
          )}
          {/* Price overlay on image */}
          {listing.price && (
            <div className="absolute bottom-2.5 start-2.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white">
              <span className="font-bold text-sm">{t("common.shekel")}{listing.price.toLocaleString()}</span>
              <span className="text-[10px] opacity-80">{t("common.perMonth")}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-4">
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
              {listing.price && !hasImages && (
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
                  {listing.total_floors ? `/${listing.total_floors}` : ""}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs ms-auto">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            </div>

            {listing.amenities?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {listing.amenities.slice(0, 5).map((a: string) => (
                  <span key={a} className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium">{a}</span>
                ))}
                {listing.amenities.length > 5 && (
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                    +{listing.amenities.length - 5}
                  </span>
                )}
              </div>
            )}

            {/* Contact info */}
            {(listing.contact_name || listing.contact_phone) && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                {listing.contact_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {listing.contact_name}
                  </span>
                )}
                {listing.contact_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {listing.contact_phone}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Score - only show here if no cover image */}
          {!hasImages && (
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
          )}
        </div>

        {/* Score bars - show below content when cover image is present */}
        {hasImages && listing.listing_scores?.length > 0 && (() => {
          const best = listing.listing_scores.reduce((b: any, s: any) => s.score > (b?.score ?? 0) ? s : b, null);
          const bd = best?.breakdown as Record<string, number> | null;
          if (!bd) return null;
          const dims = Object.entries(bd).filter(([k]) => k !== "total").slice(0, 4);
          if (dims.length === 0) return null;
          return (
            <div className="flex gap-0.5 mt-2">
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
    </Card>
    </motion.div>
  );
};
