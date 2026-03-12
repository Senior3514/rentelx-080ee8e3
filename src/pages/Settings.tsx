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
import { LogOut, Globe, Sun, Moon, Monitor } from "lucide-react";
import { useState, useEffect } from "react";

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

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: t("settings.themeLight") },
    { value: "dark" as const, icon: Moon, label: t("settings.themeDark") },
    { value: "system" as const, icon: Monitor, label: t("settings.themeSystem") },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold">{t("nav.settings")}</h1>

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
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-1.5"><Globe className="h-4 w-4" /> {t("settings.language")}</h3>
        <div className="flex gap-2">
          <Button variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")}>English</Button>
          <Button variant={language === "he" ? "default" : "outline"} size="sm" onClick={() => setLanguage("he")}>עברית</Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">{t("settings.theme")}</h3>
        <div className="flex gap-2">
          {themeOptions.map(({ value, icon: Icon, label }) => (
            <Button key={value} variant={theme === value ? "default" : "outline"} size="sm" onClick={() => setTheme(value)} className="gap-1.5">
              <Icon className="h-4 w-4" /> {label}
            </Button>
          ))}
        </div>
      </Card>

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

      <Button variant="destructive" onClick={signOut} className="w-full gap-1.5">
        <LogOut className="h-4 w-4" /> {t("nav.logout")}
      </Button>
    </div>
  );
};

export default Settings;
