import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

interface DashboardChartsProps {
  listings: any[];
  pipelineData: { stage: string; count: number; label: string }[];
  weeklyActivity: { day: string; count: number }[];
}

const SCORE_COLORS = [
  "hsl(0, 65%, 50%)",
  "hsl(38, 85%, 55%)",
  "hsl(80, 50%, 45%)",
  "hsl(142, 60%, 40%)",
];

const SCORE_LABELS = ["0–39", "40–59", "60–79", "80–100"];

const PIE_COLORS = [
  "hsl(16, 65%, 52%)",
  "hsl(200, 60%, 48%)",
  "hsl(38, 85%, 55%)",
  "hsl(142, 60%, 40%)",
  "hsl(280, 50%, 55%)",
  "hsl(340, 60%, 50%)",
  "hsl(0, 0%, 60%)",
];

const chartItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 24 } },
};

export const DashboardCharts = ({ listings, pipelineData, weeklyActivity }: DashboardChartsProps) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  // Score distribution
  const scoreBuckets = [0, 0, 0, 0];
  listings.forEach((l) => {
    const topScore = l.listing_scores?.reduce((m: number, s: any) => Math.max(m, s.score), 0) ?? 0;
    if (topScore >= 80) scoreBuckets[3]++;
    else if (topScore >= 60) scoreBuckets[2]++;
    else if (topScore >= 40) scoreBuckets[1]++;
    else scoreBuckets[0]++;
  });

  const scoreData = scoreBuckets.map((count, i) => ({
    range: SCORE_LABELS[i],
    count,
    fill: SCORE_COLORS[i],
  }));

  const pieData = pipelineData.filter((p) => p.count > 0);

  // City breakdown
  const cityBreakdown = listings.reduce((acc: Record<string, number>, l: any) => {
    const city = l.city || (language === "he" ? "לא ידוע" : "Unknown");
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {});
  const cityData = Object.entries(cityBreakdown)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Price distribution
  const priceBuckets: { range: string; count: number }[] = [];
  const priceRanges = [
    { min: 0, max: 3000, label: "0-3K" },
    { min: 3000, max: 5000, label: "3-5K" },
    { min: 5000, max: 7000, label: "5-7K" },
    { min: 7000, max: 10000, label: "7-10K" },
    { min: 10000, max: Infinity, label: "10K+" },
  ];
  priceRanges.forEach(({ min, max, label }) => {
    const count = listings.filter((l: any) => l.price >= min && l.price < max).length;
    priceBuckets.push({ range: label, count });
  });

  const CITY_COLORS = [
    "hsl(200, 60%, 48%)",
    "hsl(16, 65%, 52%)",
    "hsl(142, 60%, 40%)",
    "hsl(280, 50%, 55%)",
    "hsl(38, 85%, 55%)",
    "hsl(340, 60%, 50%)",
  ];

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {/* Score Distribution → Compare */}
      <motion.div variants={chartItem}>
        <Card
          className="p-4 border-border/60 cursor-pointer card-hover transition-all hover:border-primary/40"
          onClick={() => navigate("/compare")}
        >
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            {t("dashboard.scoreDistribution")}
          </h3>
          {listings.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">{t("dashboard.noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={scoreData}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {scoreData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>

      {/* Pipeline Funnel → Pipeline */}
      <motion.div variants={chartItem}>
        <Card
          className="p-4 border-border/60 cursor-pointer card-hover transition-all hover:border-primary/40"
          onClick={() => navigate("/pipeline")}
        >
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-score-medium" />
            {t("dashboard.pipelineFunnel")}
          </h3>
          {pieData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">{t("dashboard.noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={35}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          {pieData.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {pieData.map((p, i) => (
                <span key={p.stage} className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {p.label} ({p.count})
                </span>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Weekly Activity → Inbox */}
      <motion.div variants={chartItem}>
        <Card
          className="p-4 border-border/60 cursor-pointer card-hover transition-all hover:border-primary/40"
          onClick={() => navigate("/inbox")}
        >
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-score-high" />
            {t("dashboard.weeklyActivity")}
          </h3>
          {weeklyActivity.every((d) => d.count === 0) ? (
            <p className="text-xs text-muted-foreground text-center py-8">{t("dashboard.noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weeklyActivity}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(16, 65%, 52%)"
                  fill="hsl(16, 65%, 52%)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>

      {/* Price Distribution → Inbox */}
      <motion.div variants={chartItem}>
        <Card
          className="p-4 border-border/60 cursor-pointer card-hover transition-all hover:border-primary/40"
          onClick={() => navigate("/inbox")}
        >
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            {language === "he" ? "התפלגות מחירים" : "Price Distribution"}
          </h3>
          {listings.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">{t("dashboard.noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priceBuckets}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(280, 50%, 55%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>

      {/* City Breakdown → Profiles */}
      <motion.div variants={chartItem}>
        <Card
          className="p-4 border-border/60 cursor-pointer card-hover transition-all hover:border-primary/40"
          onClick={() => navigate("/profiles")}
        >
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            {language === "he" ? "פילוח לפי עיר" : "By City"}
          </h3>
          {cityData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">{t("dashboard.noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={cityData}
                  dataKey="count"
                  nameKey="city"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={30}
                  paddingAngle={3}
                >
                  {cityData.map((_, i) => (
                    <Cell key={i} fill={CITY_COLORS[i % CITY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          {cityData.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {cityData.map((c, i) => (
                <span key={c.city} className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ background: CITY_COLORS[i % CITY_COLORS.length] }} />
                  {c.city} ({c.count})
                </span>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Rooms Distribution → Scan */}
      <motion.div variants={chartItem}>
        <Card
          className="p-4 border-border/60 cursor-pointer card-hover transition-all hover:border-primary/40"
          onClick={() => navigate("/scan")}
        >
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            {language === "he" ? "לפי מספר חדרים" : "By Rooms"}
          </h3>
          {listings.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">{t("dashboard.noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={(() => {
                  const rooms: Record<string, number> = {};
                  listings.forEach((l: any) => {
                    if (l.rooms) {
                      const key = String(l.rooms);
                      rooms[key] = (rooms[key] || 0) + 1;
                    }
                  });
                  return Object.entries(rooms)
                    .map(([r, c]) => ({ rooms: r, count: c }))
                    .sort((a, b) => parseFloat(a.rooms) - parseFloat(b.rooms));
                })()}
              >
                <XAxis dataKey="rooms" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(190, 60%, 45%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
};
