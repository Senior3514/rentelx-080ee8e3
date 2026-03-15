import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, Inbox, UserSearch, Columns3, LayoutDashboard, MapPin, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { motion } from "framer-motion";
import { AddListingModal } from "@/components/listings/AddListingModal";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { NeighborhoodInsights } from "@/components/dashboard/NeighborhoodInsights";
import { RemindersWidget } from "@/components/dashboard/RemindersWidget";
import { AiSectionHelper } from "@/components/ui/ai-section-helper";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const STAGE_LABELS: Record<string, Record<string, string>> = {
  new: { en: "New", he: "חדש", es: "Nuevo", ru: "Новое" },
  contacted: { en: "Contacted", he: "נוצר קשר", es: "Contactado", ru: "Связались" },
  viewing_scheduled: { en: "Viewing", he: "ביקור", es: "Visita", ru: "Просмотр" },
  viewed: { en: "Viewed", he: "נצפה", es: "Visto", ru: "Осмотрено" },
  negotiating: { en: "Negotiating", he: 'מו"מ', es: "Negociando", ru: "Торг" },
  signed: { en: "Signed", he: "חתום", es: "Firmado", ru: "Подписано" },
  lost: { en: "Lost", he: "אבוד", es: "Perdido", ru: "Потеряно" },
};

function getGreeting(language: string): string {
  const hour = new Date().getHours();
  if (language === "he") {
    if (hour < 6) return "לילה טוב";
    if (hour < 12) return "בוקר טוב";
    if (hour < 17) return "צהריים טובים";
    if (hour < 21) return "ערב טוב";
    return "לילה טוב";
  }
  if (language === "ru") {
    if (hour < 6) return "Доброй ночи";
    if (hour < 12) return "Доброе утро";
    if (hour < 17) return "Добрый день";
    if (hour < 21) return "Добрый вечер";
    return "Доброй ночи";
  }
  if (language === "es") {
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const Dashboard = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

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

  const recentListings = listings.slice(0, 5);

  const { data: pipelineEntries = [] } = useQuery({
    queryKey: ["pipeline", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_entries")
        .select("stage, entered_stage_at")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const pipelineCount = pipelineEntries.length;

  const { data: profileCount = 0 } = useQuery({
    queryKey: ["profile_count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("search_profiles")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_active", true);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const totalListings = listings.length;

  const avgScore = useMemo(() => listings.length
    ? Math.round(
        listings.reduce((sum, l) => {
          const top = l.listing_scores?.reduce((m: number, s: any) => Math.max(m, s.score), 0) ?? 0;
          return sum + top;
        }, 0) / listings.length
      )
    : 0, [listings]);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "";

  const stats = [
    { label: t("dashboard.totalListings"), value: totalListings, icon: Inbox, path: "/inbox" },
    { label: t("dashboard.avgScore"), value: avgScore, icon: LayoutDashboard, path: "/compare" },
    { label: t("dashboard.inPipeline"), value: pipelineCount, icon: Columns3, path: "/pipeline" },
    { label: t("dashboard.activeProfiles"), value: profileCount, icon: UserSearch, path: "/profiles" },
  ];

  // Pipeline funnel data for charts
  const pipelineChartData = useMemo(() => {
    const stages = ["new", "contacted", "viewing_scheduled", "viewed", "negotiating", "signed", "lost"];
    return stages.map((stage) => ({
      stage,
      count: pipelineEntries.filter((e: any) => e.stage === stage).length,
      label: STAGE_LABELS[stage]?.[language] || stage,
    }));
  }, [pipelineEntries, language]);

  // Weekly activity data
  const weeklyActivity = useMemo(() => {
    const dayNames = language === "he"
      ? ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = listings.filter((l) => {
        const created = new Date(l.created_at);
        return created >= dayStart && created < dayEnd;
      }).length;
      days.push({ day: dayNames[d.getDay()], count });
    }
    return days;
  }, [listings, language]);

  return (
    <div className="w-full space-y-8 animate-fade-up pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <motion.p
            className="text-sm text-muted-foreground font-medium"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {getGreeting(language)}
          </motion.p>
          <h1 className="text-3xl font-display font-bold tracking-tight mt-0.5">
            {displayName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("app.tagline")}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5 glow-primary shrink-0">
          <Plus className="h-4 w-4" /> {t("inbox.addListing")}
        </Button>
      </div>

      {/* Animated Stats */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4" variants={container} initial="hidden" animate="show">
        {stats.map((s, i) => (
          <motion.div key={s.label} variants={item}>
            <Card
              className="p-4 flex items-center gap-3 card-hover shine-overlay border-border/60 cursor-pointer group relative overflow-hidden"
              onClick={() => navigate(s.path)}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors">
                <s.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold stat-number leading-none">
                  <AnimatedCounter value={s.value} />
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.label}</p>
              </div>
              {/* Subtle gradient accent */}
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-display font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t("dashboard.analytics")}
          </h2>
        </div>
        <DashboardCharts
          listings={listings}
          pipelineData={pipelineChartData}
          weeklyActivity={weeklyActivity}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-display font-semibold mb-3">{t("dashboard.quickActions")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("nav.inbox"), icon: Inbox, action: () => navigate("/inbox"), variant: "outline" as const },
            { label: t("nav.profiles"), icon: UserSearch, action: () => navigate("/profiles"), variant: "outline" as const },
            { label: t("nav.pipeline"), icon: Columns3, action: () => navigate("/pipeline"), variant: "outline" as const },
            { label: t("nav.settings"), icon: Sparkles, action: () => navigate("/settings"), variant: "outline" as const },
          ].map((qItem, i) => (
            <motion.div
              key={qItem.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.05 }}
            >
              <Button
                variant={qItem.variant}
                onClick={qItem.action}
                className="w-full gap-1.5 h-12 card-hover border-border/60"
              >
                <qItem.icon className="h-4 w-4" />
                <span className="text-sm">{qItem.label}</span>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Listings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-display font-semibold">{t("dashboard.recentListings")}</h2>
          {recentListings.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/inbox")} className="gap-1 text-primary">
              {t("nav.inbox")} <ArrowRight className="h-3.5 w-3.5 flip-rtl" />
            </Button>
          )}
        </div>
        {recentListings.length === 0 ? (
          <Card className="p-8 text-center space-y-3 border-dashed border-border/60">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">{t("dashboard.noRecent")}</p>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {t("inbox.addListing")}
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentListings.map((l, i) => {
              const topScore = l.listing_scores?.reduce((m: number, s: any) => Math.max(m, s.score), 0) ?? 0;
              const scoreColor =
                topScore >= 80 ? "bg-score-high text-white" :
                topScore >= 50 ? "bg-score-medium text-white" :
                "bg-score-low text-white";

              return (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card
                    className="p-3 cursor-pointer card-hover border-border/60 group"
                    onClick={() => navigate(`/listings/${l.id}`)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium truncate block">{l.address || l.city || "—"}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {l.price && <span>{t("common.shekel")}{l.price.toLocaleString()}</span>}
                            <span>
                              {formatDistanceToNow(new Date(l.created_at), {
                                addSuffix: true,
                                locale: language === "he" ? he : undefined,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {topScore > 0 && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${scoreColor} ${topScore >= 80 ? "animate-glow" : ""}`}>
                          {topScore}
                        </span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reminders */}
      <RemindersWidget />

      {/* Neighborhood Market Intelligence */}
      <NeighborhoodInsights />

      {/* AI Dashboard Assistant */}
      <AiSectionHelper
        context={`Dashboard overview: ${totalListings} total listings, average score ${avgScore}, ${pipelineCount} in pipeline, ${profileCount} active profiles. Recent listings: ${recentListings.map(l => `${l.address || l.city} (₪${l.price?.toLocaleString()})`).join(", ")}`}
        section="Dashboard"
        suggestions={language === "he"
          ? ["תן סיכום מצב החיפוש", "מה הצעד הבא שלי?", "איפה כדאי לחפש?", "תן טיפים לשיפור"]
          : ["Summarize my search status", "What's my next step?", "Where should I look?", "Tips to improve"]
        }
      />

      <AddListingModal open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
};

export default Dashboard;
