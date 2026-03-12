import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, MapPin } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

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
}

const NEIGHBORHOODS: NeighborhoodStat[] = [
  { name: "Rothschild / Neve Tzedek", nameHe: "רוטשילד / נווה צדק", city: "Tel Aviv", cityHe: "תל אביב", medianPrice: 7200, trend: 3.2, avgRooms: 3, topAmenity: "Balcony", topAmenityHe: "מרפסת", color: "from-blue-500 to-blue-600" },
  { name: "Florentin / Jaffa", nameHe: "פלורנטין / יפו", city: "Tel Aviv", cityHe: "תל אביב", medianPrice: 5800, trend: 1.8, avgRooms: 2.5, topAmenity: "Parking", topAmenityHe: "חניה", color: "from-violet-500 to-violet-600" },
  { name: "Givat Rambam", nameHe: "גבעת רמב\"ם", city: "Givatayim", cityHe: "גבעתיים", medianPrice: 4900, trend: 4.1, avgRooms: 3, topAmenity: "Elevator", topAmenityHe: "מעלית", color: "from-teal-500 to-teal-600" },
  { name: "Givat Aliya", nameHe: "גבעת עליה", city: "Ramat Gan", cityHe: "רמת גן", medianPrice: 5200, trend: 2.5, avgRooms: 3, topAmenity: "Safe Room", topAmenityHe: "ממ\"ד", color: "from-orange-500 to-amber-500" },
];

export function NeighborhoodInsights() {
  const { language } = useLanguage();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        {language === "he" ? "מחירי שוק — גוש דן" : "Market Prices — Gush Dan"}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {NEIGHBORHOODS.map((n, i) => (
          <motion.div
            key={n.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, type: "spring", stiffness: 280, damping: 24 }}
          >
            <Card className="p-3 border-border/60 card-hover overflow-hidden relative">
              <div className={`absolute top-0 start-0 w-1 h-full bg-gradient-to-b ${n.color} rounded-s-xl`} />
              <div className="ps-2">
                <p className="text-xs font-semibold truncate">
                  {language === "he" ? n.nameHe : n.name}
                </p>
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
