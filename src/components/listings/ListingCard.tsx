import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { MapPin, BedDouble, Maximize, Building2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
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
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/listings/${listing.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{listing.address || listing.city || "Unknown"}</span>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {listing.price && (
              <span className="font-semibold text-foreground">
                {t("common.shekel")}{listing.price.toLocaleString()}{t("common.perMonth")}
              </span>
            )}
            {listing.rooms && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5" />
                {listing.rooms} {t("common.rooms")}
              </span>
            )}
            {listing.sqm && (
              <span className="flex items-center gap-1">
                <Maximize className="h-3.5 w-3.5" />
                {listing.sqm} {t("common.sqm")}
              </span>
            )}
            {listing.floor != null && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {t("common.floor")} {listing.floor}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs">
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

        {topScore > 0 && (
          <div className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${scoreColor}`}>
            {topScore}
          </div>
        )}
      </div>
    </Card>
  );
};
