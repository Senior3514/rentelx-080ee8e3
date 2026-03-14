import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTheme } from "@/i18n/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Globe, Sun, Moon, Monitor, Flame, Waves, Minimize2, FileDown } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: prefs } = useQuery({
    queryKey: ["notification_prefs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [scoreThreshold, setScoreThreshold] = useState(50);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem("rentelx-compact") === "true");
  const [preferredCity, setPreferredCity] = useState(() => localStorage.getItem("rentelx-preferred-city") || "");

  useEffect(() => {
    if (prefs) {
      setScoreThreshold(prefs.min_score_threshold);
      setEmailEnabled(prefs.email_enabled);
    }
  }, [prefs]);

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("rentelx-compact", String(compactMode));
    document.documentElement.classList.toggle("compact-mode", compactMode);
  }, [compactMode]);

  useEffect(() => {
    localStorage.setItem("rentelx-preferred-city", preferredCity);
  }, [preferredCity]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim().slice(0, 100) })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("settings.profileSaved"));
    },
  });

  const savePrefsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notification_preferences").upsert({
        user_id: user!.id,
        min_score_threshold: scoreThreshold,
        email_enabled: emailEnabled,
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notification_prefs"] }); toast.success(t("settings.saved")); },
  });

  const handleExportData = async () => {
    try {
      const { data: listings } = await supabase
        .from("listings")
        .select("address, city, price, rooms, sqm, floor, status, created_at")
        .eq("user_id", user!.id)
        .eq("status", "active");

      if (!listings?.length) {
        toast.info(t("settingsExtra.noDataToExport"));
        return;
      }

      const header = "Address,City,Price,Rooms,SQM,Floor,Status,Created";
      const rows = listings.map(l =>
        `"${l.address || ""}","${l.city || ""}",${l.price || ""},${l.rooms || ""},${l.sqm || ""},${l.floor ?? ""},${l.status},${l.created_at}`
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rentelx-all-data-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("settingsExtra.exportSuccess"));
    } catch {
      toast.error("Export failed");
    }
  };

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: t("settings.themeLight") },
    { value: "dark" as const, icon: Moon, label: t("settings.themeDark") },
    { value: "system" as const, icon: Monitor, label: t("settings.themeSystem") },
  ];

  const languages = [
    { code: "en" as const, label: "English", flag: "🇬🇧" },
    { code: "he" as const, label: "עברית", flag: "🇮🇱" },
    { code: "es" as const, label: "Español", flag: "🇪🇸" },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold">{t("nav.settings")}</h1>

      {/* Account */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">{t("settings.account")}</h3>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <div>
          <label className="text-sm font-medium mb-1.5 block">{t("settings.displayName")}</label>
          <div className="flex gap-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("settings.displayNamePlaceholder")}
              maxLength={100}
              className="flex-1"
            />
            <Button size="sm" onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">{t("settings.preferredCity")}</label>
          <Input
            value={preferredCity}
            onChange={(e) => setPreferredCity(e.target.value)}
            placeholder={t("settings.preferredCityPlaceholder")}
            maxLength={100}
          />
        </div>
      </Card>

      {/* Language */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-1.5"><Globe className="h-4 w-4" /> {t("settings.language")}</h3>
        <div className="flex gap-2 flex-wrap">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`relative px-3 py-1.5 text-sm rounded-md border transition-colors ${
                language === lang.code
                  ? "border-primary text-foreground font-medium"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {language === lang.code && (
                <motion.div
                  layoutId="lang-indicator"
                  className="absolute inset-0 bg-primary/10 rounded-md"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10">{lang.flag} {lang.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Theme */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">{t("settings.theme")}</h3>
        <div className="flex gap-2 flex-wrap">
          {themeOptions.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                theme === value
                  ? "border-primary text-foreground font-medium"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {theme === value && (
                <motion.div
                  layoutId="theme-indicator"
                  className="absolute inset-0 bg-primary/10 rounded-md"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Display */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-1.5">
          <Minimize2 className="h-4 w-4" /> {t("settings.display")}
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm">{t("settings.compactMode")}</span>
            <p className="text-xs text-muted-foreground">{t("settings.compactModeDesc")}</p>
          </div>
          <Switch checked={compactMode} onCheckedChange={setCompactMode} />
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">{t("settings.notifications")}</h3>
        <div>
          <p className="text-sm mb-2">{t("settings.minScoreThreshold")}: {scoreThreshold}</p>
          <Slider value={[scoreThreshold]} min={0} max={100} step={5} onValueChange={([v]) => setScoreThreshold(v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">{t("settings.emailNotifications")}</span>
          <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
        </div>
        <Button onClick={() => savePrefsMutation.mutate()} size="sm">{t("common.save")}</Button>
      </Card>

      {/* Export */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-1.5">
          <FileDown className="h-4 w-4" /> {t("common.export")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("settingsExtra.exportDesc")}
        </p>
        <Button variant="outline" size="sm" onClick={handleExportData} className="gap-1.5">
          <FileDown className="h-3.5 w-3.5" /> CSV
        </Button>
      </Card>

      <Button variant="destructive" onClick={signOut} className="w-full gap-1.5">
        <LogOut className="h-4 w-4" /> {t("nav.logout")}
      </Button>
    </div>
  );
};

export default Settings;
