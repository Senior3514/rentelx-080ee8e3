import { useMemo } from "react";
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
import { useState } from "react";
import { motion } from "framer-motion";
import { AddListingModal } from "@/components/listings/AddListingModal";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { AnimatedCounter } from "@/components/ui/animated-counter";

const STAGE_LABELS: Record<string, Record<string, string>> = {
  new: { en: "New", he: "חדש" },
  contacted: { en: "Contacted", he: "נוצר קשר" },
  viewing_scheduled: { en: "Viewing", he: "ביקור" },
  viewed: { en: "Viewed", he: "נצפה" },
  negotiating: { en: "Negotiating", he: 'מו"מ' },
  signed: { en: "Signed", he: "חתום" },
  lost: { en: "Lost", he: "אבוד" },
};

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

  const avgScore = listings.length
    ? Math.round(
        listings.reduce((sum, l) => {
          const top = l.listing_scores?.reduce((m: number, s: any) => Math.max(m, s.score), 0) ?? 0;
          return sum + top;
        }, 0) / listings.length
      )
    : 0;

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "";

  const stats = [
    { label: t("dashboard.totalListings"), value: totalListings, icon: Inbox },
    { label: t("dashboard.avgScore"), value: avgScore, icon: LayoutDashboard },
    { label: t("dashboard.inPipeline"), value: pipelineCount, icon: Columns3 },
    { label: t("dashboard.activeProfiles"), value: profileCount, icon: UserSearch },
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
    const days = [];
    const dayNames = language === "he"
      ? ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
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
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">
            {t("dashboard.welcome")}, {displayName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">{t("app.tagline")}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5 glow-primary shrink-0">
          <Plus className="h-4 w-4" /> {t("inbox.addListing")}
        </Button>
      </div>

      {/* Animated Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 25 }}
          >
            <Card className="p-4 flex flex-col items-center text-center gap-1 card-hover shine-overlay border-border/60">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-1">
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold stat-number text-gradient">
                <AnimatedCounter value={s.value} />
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

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
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.05 }}
            >
              <Button
                variant={item.variant}
                onClick={item.action}
                className="w-full gap-1.5 h-12 card-hover border-border/60"
              >
                <item.icon className="h-4 w-4" />
                <span className="text-sm">{item.label}</span>
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

      <AddListingModal open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
};

export default Dashboard;
