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
import { LogOut, Globe, Sun, Moon, Monitor, Minimize2, FileDown, Palette } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, colorScheme, setColorScheme } = useTheme();
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

  const handleExportPDF = async () => {
    try {
      const { data: listings } = await supabase
        .from("listings")
        .select("address, city, price, rooms, sqm, floor, status, created_at, amenities")
        .eq("user_id", user!.id)
        .eq("status", "active");

      if (!listings?.length) {
        toast.info(t("settingsExtra.noDataToExport"));
        return;
      }

      const isRtl = language === "he";
      const rows = listings.map(l => {
        const amenities = Array.isArray(l.amenities) ? (l.amenities as string[]).join(", ") : "";
        return `<tr>
          <td>${l.address ?? "—"}</td>
          <td>${l.city ?? "—"}</td>
          <td>₪${l.price?.toLocaleString() ?? "—"}</td>
          <td>${l.rooms ?? "—"}</td>
          <td>${l.sqm ?? "—"}</td>
          <td style="font-size:11px">${amenities}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html dir="${isRtl ? "rtl" : "ltr"}" lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <title>RentelX Export</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;600&display=swap');
    body { font-family: 'Rubik', Arial, sans-serif; margin: 20px; color: #1a1a2e; direction: ${isRtl ? "rtl" : "ltr"}; }
    h1 { color: #e07b45; font-size: 22px; margin-bottom: 4px; }
    p { color: #666; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #e07b45; color: #fff; padding: 8px 10px; text-align: ${isRtl ? "right" : "left"}; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafaf8; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${isRtl ? "ספריית דירות — RentelX" : "Apartment Library — RentelX"}</h1>
  <p>${isRtl ? `סה"כ ${listings.length} דירות · ${new Date().toLocaleDateString("he-IL")}` : `${listings.length} listings · ${new Date().toLocaleDateString()}`}</p>
  <table>
    <thead>
      <tr>
        <th>${isRtl ? "כתובת" : "Address"}</th>
        <th>${isRtl ? "עיר" : "City"}</th>
        <th>${isRtl ? "מחיר" : "Price"}</th>
        <th>${isRtl ? "חדרים" : "Rooms"}</th>
        <th>${isRtl ? "מ\"ר" : "SQM"}</th>
        <th>${isRtl ? "מאפיינים" : "Amenities"}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 500);
        toast.success(t("settingsExtra.exportSuccess"));
      }
    } catch {
      toast.error("Export failed");
    }
  };

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
    { code: "ru" as const, label: "Русский", flag: "🇷🇺" },
  ];

  return (
    <div className="w-full space-y-6 pb-20 animate-fade-up">
      <h1 className="text-2xl font-display font-bold">{t("nav.settings")}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`relative px-3 py-2 text-sm rounded-lg border transition-all text-center ${
                language === lang.code
                  ? "border-primary bg-primary/10 text-foreground font-medium shadow-sm"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <span className="relative z-10 whitespace-nowrap">{lang.flag} {lang.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Theme */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">{t("settings.theme")}</h3>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all ${
                theme === value
                  ? "border-primary bg-primary/10 text-foreground font-medium shadow-sm"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Color Scheme */}
      <Card className="p-4 space-y-3 lg:col-span-2">
        <h3 className="font-semibold flex items-center gap-1.5">
          <Palette className="h-4 w-4" /> {t("settings.colorScheme")}
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {([
            { value: "default" as const, label: t("settings.schemeDefault"), colors: ["hsl(16,65%,52%)", "hsl(38,75%,55%)"] },
            { value: "ocean" as const, label: t("settings.schemeOcean"), colors: ["hsl(200,65%,48%)", "hsl(180,55%,42%)"] },
            { value: "sunset" as const, label: t("settings.schemeSunset"), colors: ["hsl(340,65%,52%)", "hsl(25,80%,55%)"] },
            { value: "emerald" as const, label: t("settings.schemeEmerald"), colors: ["hsl(160,55%,38%)", "hsl(140,50%,45%)"] },
            { value: "midnight" as const, label: t("settings.schemeMidnight"), colors: ["hsl(260,55%,52%)", "hsl(280,50%,48%)"] },
            { value: "coral" as const, label: t("settings.schemeCoral"), colors: ["hsl(12,80%,55%)", "hsl(350,70%,60%)"] },
            { value: "grape" as const, label: t("settings.schemeGrape"), colors: ["hsl(300,50%,50%)", "hsl(320,55%,55%)"] },
            { value: "forest" as const, label: t("settings.schemeForest"), colors: ["hsl(120,45%,38%)", "hsl(90,40%,42%)"] },
          ]).map((scheme) => (
            <button
              key={scheme.value}
              onClick={() => setColorScheme(scheme.value)}
              className={`relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                colorScheme === scheme.value
                  ? "border-primary ring-2 ring-primary/30 shadow-sm"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div
                className="w-8 h-8 rounded-full"
                style={{ background: `linear-gradient(135deg, ${scheme.colors[0]}, ${scheme.colors[1]})` }}
              />
              <span className="text-[10px] font-medium text-center leading-tight">{scheme.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Display */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-1.5">
          <Minimize2 className="h-4 w-4" /> {t("settings.display")}
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{t("settings.compactMode")}</span>
            <p className="text-xs text-muted-foreground">{t("settings.compactModeDesc")}</p>
          </div>
          <Switch checked={compactMode} onCheckedChange={setCompactMode} className="shrink-0" />
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">{t("settings.notifications")}</h3>
        <div>
          <p className="text-sm mb-2">{t("settings.minScoreThreshold")}: {scoreThreshold}</p>
          <Slider value={[scoreThreshold]} min={0} max={100} step={5} onValueChange={([v]) => setScoreThreshold(v)} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm flex-1">{t("settings.emailNotifications")}</span>
          <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} className="shrink-0" />
        </div>
        <Button onClick={() => savePrefsMutation.mutate()} size="sm">{t("common.save")}</Button>
      </Card>

      {/* Export */}
      <Card className="p-4 space-y-3 lg:col-span-2">
        <h3 className="font-semibold flex items-center gap-1.5">
          <FileDown className="h-4 w-4" /> {t("common.export")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("settingsExtra.exportDesc")}
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportData} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </Card>

      </div>{/* end grid */}

      {/* Keyboard Shortcuts */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-1.5">
          <span className="text-base">⌨️</span>
          {language === "he" ? "קיצורי מקלדת" : "Keyboard Shortcuts"}
        </h3>
        <div className="grid gap-2 text-sm">
          {[
            { keys: "⌘K / Ctrl+K", labelHe: "חיפוש מהיר וניווט", labelEn: "Quick search & navigation" },
            { keys: "⌘B / Ctrl+B", labelHe: "פתח/סגור סרגל צד", labelEn: "Toggle sidebar" },
            { keys: "Shift+D", labelHe: "עבור ללוח בקרה", labelEn: "Go to Dashboard" },
            { keys: "Shift+I", labelHe: "עבור לספריית דירות", labelEn: "Go to Inbox" },
            { keys: "Shift+W", labelHe: "עבור למעקב", labelEn: "Go to Watchlist" },
            { keys: "Shift+P", labelHe: "עבור לתהליך", labelEn: "Go to Pipeline" },
            { keys: "Shift+S", labelHe: "עבור להגדרות", labelEn: "Go to Settings" },
            { keys: "Shift+C", labelHe: "עבור להשוואה", labelEn: "Go to Compare" },
            { keys: "Shift+R", labelHe: "עבור למעבר דירה", labelEn: "Go to Relocation" },
          ].map(({ keys, labelHe, labelEn }) => (
            <div key={keys} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <span className="text-muted-foreground text-xs">{language === "he" ? labelHe : labelEn}</span>
              <kbd className="inline-flex h-6 items-center rounded border bg-muted px-2 text-[10px] font-mono text-muted-foreground">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </Card>

      <Button variant="destructive" onClick={signOut} className="w-full gap-1.5">
        <LogOut className="h-4 w-4" /> {t("nav.logout")}
      </Button>
    </div>
  );
};

export default Settings;
