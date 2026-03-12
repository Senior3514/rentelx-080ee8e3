import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTheme } from "@/i18n/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  const { data: prefs } = useQuery({
    queryKey: ["notification_prefs", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
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

  useEffect(() => {
    if (prefs) {
      setScoreThreshold(prefs.min_score_threshold);
      setEmailEnabled(prefs.email_enabled);
    }
  }, [prefs]);

  const savePrefsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("notification_preferences").upsert({
        user_id: user!.id,
        min_score_threshold: scoreThreshold,
        email_enabled: emailEnabled,
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notification_prefs"] }); toast.success("Settings saved"); },
  });

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold">{t("nav.settings")}</h1>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">Account</h3>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-1.5"><Globe className="h-4 w-4" /> Language</h3>
        <div className="flex gap-2">
          <Button variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")}>English</Button>
          <Button variant={language === "he" ? "default" : "outline"} size="sm" onClick={() => setLanguage("he")}>עברית</Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Theme</h3>
        <div className="flex gap-2">
          {themeOptions.map(({ value, icon: Icon, label }) => (
            <Button key={value} variant={theme === value ? "default" : "outline"} size="sm" onClick={() => setTheme(value)} className="gap-1.5">
              <Icon className="h-4 w-4" /> {label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Notifications</h3>
        <div>
          <p className="text-sm mb-2">Min score threshold: {scoreThreshold}</p>
          <Slider value={[scoreThreshold]} min={0} max={100} step={5} onValueChange={([v]) => setScoreThreshold(v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Email notifications</span>
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
