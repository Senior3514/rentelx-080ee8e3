import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, Inbox, UserSearch, Columns3, LayoutDashboard, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { useState } from "react";
import { AddListingModal } from "@/components/listings/AddListingModal";

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
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: pipelineCount = 0 } = useQuery({
    queryKey: ["pipeline_count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("pipeline_entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
    enabled: !!user,
  });

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

  const { data: totalListings = 0 } = useQuery({
    queryKey: ["total_listings", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "active");
      return count ?? 0;
    },
    enabled: !!user,
  });

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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">
          {t("dashboard.welcome")}, {displayName} 👋
        </h1>
        <p className="text-muted-foreground mt-1">{t("app.tagline")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 flex flex-col items-center text-center gap-1">
            <s.icon className="h-5 w-5 text-primary mb-1" />
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-display font-semibold mb-3">{t("dashboard.quickActions")}</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> {t("inbox.addListing")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/inbox")} className="gap-1.5">
            <Inbox className="h-4 w-4" /> {t("nav.inbox")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/profiles")} className="gap-1.5">
            <UserSearch className="h-4 w-4" /> {t("nav.profiles")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/pipeline")} className="gap-1.5">
            <Columns3 className="h-4 w-4" /> {t("nav.pipeline")}
          </Button>
        </div>
      </div>

      {/* Recent Listings */}
      <div>
        <h2 className="text-lg font-display font-semibold mb-3">{t("dashboard.recentListings")}</h2>
        {listings.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground text-sm">{t("dashboard.noRecent")}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {listings.map((l) => {
              const topScore = l.listing_scores?.reduce((m: number, s: any) => Math.max(m, s.score), 0) ?? 0;
              const scoreColor =
                topScore >= 80 ? "bg-score-high text-white" :
                topScore >= 50 ? "bg-score-medium text-white" :
                "bg-score-low text-white";

              return (
                <Card
                  key={l.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/listings/${l.id}`)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{l.address || l.city || "—"}</span>
                      {l.price && (
                        <span className="text-sm text-muted-foreground shrink-0">
                          {t("common.shekel")}{l.price.toLocaleString()}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(l.created_at), {
                          addSuffix: false,
                          locale: language === "he" ? he : undefined,
                        })}
                      </span>
                    </div>
                    {topScore > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${scoreColor}`}>
                        {topScore}
                      </span>
                    )}
                  </div>
                </Card>
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
