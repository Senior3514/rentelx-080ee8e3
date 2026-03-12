import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
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
  "hsl(0, 65%, 50%)",    // 0-39
  "hsl(38, 85%, 55%)",   // 40-59
  "hsl(80, 50%, 45%)",   // 60-79
  "hsl(142, 60%, 40%)",  // 80-100
];

const SCORE_LABELS_EN = ["0–39", "40–59", "60–79", "80–100"];
const SCORE_LABELS_HE = ["0–39", "40–59", "60–79", "80–100"];

export const DashboardCharts = ({ listings, pipelineData, weeklyActivity }: DashboardChartsProps) => {
  const { t, language } = useLanguage();

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
    range: (language === "he" ? SCORE_LABELS_HE : SCORE_LABELS_EN)[i],
    count,
    fill: SCORE_COLORS[i],
  }));

  const pieData = pipelineData.filter((p) => p.count > 0);
  const PIE_COLORS = [
    "hsl(16, 65%, 52%)",
    "hsl(200, 60%, 48%)",
    "hsl(38, 85%, 55%)",
    "hsl(142, 60%, 40%)",
    "hsl(280, 50%, 55%)",
    "hsl(340, 60%, 50%)",
    "hsl(0, 0%, 60%)",
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Score Distribution */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">{t("dashboard.scoreDistribution")}</h3>
        {listings.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">{t("dashboard.noData")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scoreData}>
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {scoreData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Pipeline Funnel */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">{t("dashboard.pipelineFunnel")}</h3>
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

      {/* Weekly Activity */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">{t("dashboard.weeklyActivity")}</h3>
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
    </div>
  );
};
