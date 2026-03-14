import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import { AiSectionHelper } from "@/components/ui/ai-section-helper";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Package,
  Phone, Mail, Plus, Trash2, Search, Zap, Shield,
  Building2, Wifi, Bolt, Droplets, Truck, BookMarked,
  ChevronDown, ChevronRight, Target, Activity, FileDown,
  LayoutDashboard, ListTodo, BookOpen, Users
} from "lucide-react";

/* ─── Types ─── */
type Priority = "P0" | "P1" | "P2";
type TaskStatus = "pending" | "in_progress" | "completed";
type Week = "4_weeks" | "2_weeks" | "moving_day" | "after_move";
type ProviderType = "movers" | "internet" | "electricity" | "gas" | "water" | "other";
type View = "dashboard" | "tasks" | "boxes" | "providers" | "audit";

interface Task {
  id: string;
  week: Week;
  title: string;
  priority: Priority;
  status: TaskStatus;
}

interface Box {
  id: string;
  number: number;
  room: string;
  contents: string;
  fragile: boolean;
  scanned: boolean;
  priority?: boolean;
}

interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  phone: string;
  email: string;
  status: "not_contacted" | "contacted" | "confirmed";
}

interface AuditItem {
  id: string;
  title: string;
  done: boolean;
}

/* ─── Moving Center Profile ─── */
interface MovingProfile {
  id: string;
  name: string;
  moveDate: string;
  createdAt: string;
}

const MAX_PROFILES = 3;
const PROFILES_STORAGE_KEY = "rentelx_relocation_profiles_v1";

function loadProfiles(): MovingProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProfiles(profiles: MovingProfile[]) {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

function loadActiveProfileId(): string | null {
  return localStorage.getItem("rentelx_relocation_active_profile") || null;
}

function saveActiveProfileId(id: string) {
  localStorage.setItem("rentelx_relocation_active_profile", id);
}

/* ─── Storage helpers ─── */
function getStorageKey(profileId: string) {
  return `rentelx_relocation_v2_${profileId}`;
}

function loadState<T>(profileId: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${getStorageKey(profileId)}_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveState<T>(profileId: string, key: string, val: T) {
  localStorage.setItem(`${getStorageKey(profileId)}_${key}`, JSON.stringify(val));
}

/* ─── Default data (language-keyed) ─── */
const DEFAULT_TASKS_DATA: Record<string, { id: string; week: Week; he: string; en: string; priority: Priority }[]> = {
  "4_weeks": [
    { id: "t1",  week: "4_weeks", he: "הזמן חברת הובלה ואשר תאריך", en: "Book moving company & confirm date", priority: "P0" },
    { id: "t2",  week: "4_weeks", he: "הודע לבעל הדירה ותאם עזיבה רשמית", en: "Notify landlord & schedule move-out", priority: "P0" },
    { id: "t3",  week: "4_weeks", he: "הזמן חומרי אריזה (קרטונים, סרט, ניילון מבעבע)", en: "Order packing materials (boxes, tape, bubble wrap)", priority: "P1" },
    { id: "t4",  week: "4_weeks", he: "ערוך רשימת פריטים לתרומה/מכירה", en: "List items to donate/sell", priority: "P2" },
    { id: "t5",  week: "4_weeks", he: "צלם תיעוד מצב הדירה הישנה (לפני)", en: "Photo-document old apartment condition (before)", priority: "P0" },
    { id: "t6",  week: "4_weeks", he: "עדכן כתובת בבנק וכרטיסי אשראי", en: "Update address at bank & credit cards", priority: "P0" },
    { id: "t7",  week: "4_weeks", he: "עדכן כתובת בחברות ביטוח", en: "Update address with insurance companies", priority: "P1" },
  ],
  "2_weeks": [
    { id: "t8",  week: "2_weeks", he: "הזמן אינטרנט לדירה החדשה", en: "Order internet for new apartment", priority: "P0" },
    { id: "t9",  week: "2_weeks", he: "ארוז פריטים שאינם בשימוש יומי", en: "Pack items not used daily", priority: "P0" },
    { id: "t10", week: "2_weeks", he: "ארוז ספרים, תמונות, עיצוב ודקורציה", en: "Pack books, photos, decor", priority: "P1" },
    { id: "t11", week: "2_weeks", he: "עדכן כתובת — דואר ישראל / הפניית דואר", en: "Update address — postal service / mail forwarding", priority: "P1" },
    { id: "t12", week: "2_weeks", he: "עדכן כתובת — ביטוח לאומי / קופות חולים", en: "Update address — national insurance / health fund", priority: "P1" },
    { id: "t13", week: "2_weeks", he: "עדכן שירותי סטרימינג ומשלוחים", en: "Update streaming & delivery services", priority: "P2" },
    { id: "t14", week: "2_weeks", he: "הודע למעסיק/בי\"ס/גנים על שינוי כתובת", en: "Notify employer/school about address change", priority: "P2" },
  ],
  "moving_day": [
    { id: "t15", week: "moving_day", he: "בדוק את הדירה הישנה לפני עזיבה סופית", en: "Check old apartment before final departure", priority: "P0" },
    { id: "t16", week: "moving_day", he: "שמור ערכת הישרדות 48 שעות בהישג יד", en: "Keep 48-hour survival kit within reach", priority: "P0" },
    { id: "t17", week: "moving_day", he: "מסור מפתחות לבעל הדירה הישנה", en: "Hand over keys to old landlord", priority: "P0" },
    { id: "t18", week: "moving_day", he: "פרוק ארגזים לפי חדרים (חפש לפי מספר)", en: "Unpack boxes by room (search by number)", priority: "P1" },
    { id: "t19", week: "moving_day", he: "צלם תיעוד מצב הדירה החדשה (בכניסה)", en: "Photo-document new apartment condition (entry)", priority: "P0" },
  ],
  "after_move": [
    { id: "t20", week: "after_move", he: "חבר חשמל, מים, גז בדירה החדשה", en: "Connect electricity, water, gas in new apartment", priority: "P0" },
    { id: "t21", week: "after_move", he: "בדוק Wi-Fi ואינטרנט — חבר נתב", en: "Check Wi-Fi & internet — connect router", priority: "P0" },
    { id: "t22", week: "after_move", he: "פרוק ערכת הישרדות וארגז ראשוני", en: "Unpack survival kit & first box", priority: "P0" },
    { id: "t23", week: "after_move", he: "פרוק קופסאות לפי חדרים (חפש לפי מספר)", en: "Unpack boxes by room (search by number)", priority: "P1" },
    { id: "t24", week: "after_move", he: "עדכן כתובת — משרד הפנים / רשות האוכלוסין", en: "Update address — interior ministry / population authority", priority: "P1" },
    { id: "t25", week: "after_move", he: "עדכן מנויים: חדר כושר, חוגים, תוכנות", en: "Update subscriptions: gym, classes, software", priority: "P2" },
    { id: "t26", week: "after_move", he: "בצע System Check: כל החשבונות/מנויים עודכנו?", en: "System Check: all accounts/subscriptions updated?", priority: "P1" },
  ],
};

function buildDefaultTasks(lang: string): Task[] {
  return Object.values(DEFAULT_TASKS_DATA).flat().map(t => ({
    id: t.id, week: t.week, title: lang === "he" ? t.he : t.en, priority: t.priority, status: "pending" as TaskStatus,
  }));
}

// Keep backward-compatible default for initial load
const DEFAULT_TASKS = buildDefaultTasks("he");

const AUDIT_DATA = [
  { id: "a1",  he: "עדכון כתובת בבנק/ים",                           en: "Update address at bank(s)" },
  { id: "a2",  he: "עדכון כתובת בכרטיסי אשראי",                    en: "Update address on credit cards" },
  { id: "a3",  he: "עדכון כתובת בחברות ביטוח",                     en: "Update address with insurance companies" },
  { id: "a4",  he: "עדכון כתובת בדואר ישראל / הפניית דואר",        en: "Update postal service / mail forwarding" },
  { id: "a5",  he: "עדכון כתובת — סלולר ואינטרנט",                 en: "Update address — mobile & internet" },
  { id: "a6",  he: "עדכון כתובת — בתי ספר/גנים וחוגים",           en: "Update address — schools & activities" },
  { id: "a7",  he: "עדכון כתובת — ביטוח לאומי / קופת חולים",      en: "Update address — national insurance / health fund" },
  { id: "a8",  he: "עדכון כתובת — רשות המסים / שלטון מקומי",       en: "Update address — tax authority / local government" },
  { id: "a9",  he: "עדכון כתובת — משרד הפנים / רשות האוכלוסין",   en: "Update address — interior ministry" },
  { id: "a10", he: "בדיקת כל המנויים — נטפליקס, ספוטיפיי, אמזון",  en: "Check all subscriptions — Netflix, Spotify, Amazon" },
];

function buildDefaultAudit(lang: string): AuditItem[] {
  return AUDIT_DATA.map(a => ({ id: a.id, title: lang === "he" ? a.he : a.en, done: false }));
}

const DEFAULT_AUDIT = buildDefaultAudit("he");

const SURVIVAL_KIT_DATA = [
  { he: "מטענים: לפטופים, טלפונים, שעונים, סוללות + מפצל/כבל מאריך", en: "Chargers: laptops, phones, watches, batteries + power strip" },
  { he: "Wi-Fi: נתב, ספק כוח, כבלי Ethernet, פרטי התחברות, Hotspot", en: "Wi-Fi: router, power supply, Ethernet cables, login details, Hotspot" },
  { he: "מסמכים: חוזה/מפתח, ת\"ז/דרכונים, ביטוח, מסמכי ילדים", en: "Documents: lease/keys, IDs/passports, insurance, kids' docs" },
  { he: "כלי עבודה: מברג, סכין יפני, סרט הדבקה, טושים, אזיקונים", en: "Tools: screwdriver, utility knife, tape, markers, zip ties" },
  { he: "מטבח מהיר: קומקום, כוסות, צלחות, סכו\"ם, מגבות נייר", en: "Quick kitchen: kettle, cups, plates, cutlery, paper towels" },
  { he: "לילה ראשון: מצעים, שמיכות, פיג'מות, מטעני לילה, אטמי אוזניים", en: "First night: sheets, blankets, pajamas, night chargers, earplugs" },
  { he: "היגיינה: מברשות שיניים, סבון, שמפו, נייר טואלט, מגבונים", en: "Hygiene: toothbrushes, soap, shampoo, toilet paper, wipes" },
  { he: "ילדים: בקבוק/מוצץ/צעצוע מעבר, בגדי החלפה, חטיפים", en: "Kids: bottle/pacifier/comfort toy, change of clothes, snacks" },
  { he: "תרופות: קבועות + משככי כאבים + ערכת עזרה ראשונה", en: "Medicine: regular meds + painkillers + first aid kit" },
  { he: "ניקיון מהיר: ספריי, ספוג, שקיות זבל", en: "Quick clean: spray, sponge, garbage bags" },
];

function buildSurvivalKit(lang: string): string[] {
  return SURVIVAL_KIT_DATA.map(s => lang === "he" ? s.he : s.en);
}

const SURVIVAL_KIT_DEFAULT = buildSurvivalKit("he");

const WEEK_COLORS: Record<Week, { color: string; icon: React.ElementType }> = {
  "4_weeks":    { color: "from-blue-500 to-blue-600",     icon: Target },
  "2_weeks":    { color: "from-amber-500 to-orange-500",  icon: Clock },
  "moving_day": { color: "from-red-500 to-rose-600",      icon: Zap },
  "after_move": { color: "from-green-500 to-emerald-500", icon: CheckCircle2 },
};

const PRIORITY_COLORS: Record<Priority, string> = {
  P0: "bg-red-500/20 text-red-400 border-red-500/30",
  P1: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  P2: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const PROVIDER_ICONS: Record<ProviderType, { icon: React.ElementType; color: string }> = {
  movers:      { icon: Truck,       color: "from-violet-500 to-violet-600" },
  internet:    { icon: Wifi,        color: "from-blue-500 to-blue-600" },
  electricity: { icon: Bolt,        color: "from-yellow-500 to-amber-500" },
  gas:         { icon: Activity,    color: "from-orange-500 to-red-500" },
  water:       { icon: Droplets,    color: "from-cyan-500 to-blue-500" },
  other:       { icon: Building2,   color: "from-gray-500 to-gray-600" },
};

const STATUS_COLORS: Record<Provider["status"], string> = {
  not_contacted: "bg-muted text-muted-foreground",
  contacted:     "bg-amber-500/20 text-amber-400",
  confirmed:     "bg-green-500/20 text-green-400",
};

const VIEW_ICONS: Record<View, React.ElementType> = {
  dashboard: LayoutDashboard,
  tasks:     ListTodo,
  boxes:     Package,
  providers: Users,
  audit:     BookOpen,
};

function uid() { return Math.random().toString(36).slice(2); }

/* ─── Countdown clock ─── */
function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0 });
  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, mins: 0 }); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setTimeLeft({ days, hours, mins });
    };
    calc();
    const i = setInterval(calc, 30000);
    return () => clearInterval(i);
  }, [targetDate]);
  return timeLeft;
}

/* ─── Export helper ─── */
function exportTasksCsv(tasks: Task[], filename: string) {
  const header = "Week,Title,Priority,Status";
  const rows = tasks.map(t =>
    `"${t.week}","${t.title}","${t.priority}","${t.status}"`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Component ─── */
const Relocation = () => {
  const { direction, t, language } = useLanguage();

  // Profile management state
  const [profiles, setProfilesState] = useState<MovingProfile[]>(() => loadProfiles());
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(() => {
    const saved = loadActiveProfileId();
    const profs = loadProfiles();
    return saved && profs.some(p => p.id === saved) ? saved : (profs[0]?.id ?? null);
  });
  const [showProfileSetup, setShowProfileSetup] = useState(() => loadProfiles().length === 0);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDate, setNewProfileDate] = useState("");

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null;
  const pid = activeProfileId ?? "default";

  const createProfile = useCallback((name: string, date: string) => {
    if (profiles.length >= MAX_PROFILES) return;
    const id = uid();
    const defaultName = `${t("relocation.moveName")} ${profiles.length + 1}`;
    const profile: MovingProfile = { id, name: name.trim() || defaultName, moveDate: date, createdAt: new Date().toISOString() };
    const updated = [...profiles, profile];
    setProfilesState(updated);
    saveProfiles(updated);
    setActiveProfileIdState(id);
    saveActiveProfileId(id);
    setShowProfileSetup(false);
    setNewProfileName("");
    setNewProfileDate("");
    // Initialize default data for new profile
    saveState(id, "tasks", buildDefaultTasks(language));
    saveState(id, "survival", buildSurvivalKit(language));
    saveState(id, "audit", buildDefaultAudit(language));
    saveState(id, "move_date", date);
  }, [profiles, language, t]);

  const switchProfile = useCallback((id: string) => {
    setActiveProfileIdState(id);
    saveActiveProfileId(id);
    // Force reload state for new profile
    setTasks(loadState(id, "tasks", DEFAULT_TASKS));
    setBoxes(loadState(id, "boxes", [] as Box[]));
    setProviders(loadState(id, "providers", [] as Provider[]));
    setSurvivalKit(loadState(id, "survival", SURVIVAL_KIT_DEFAULT));
    setAudit(loadState(id, "audit", DEFAULT_AUDIT));
    setMoveDate(loadState(id, "move_date", ""));
  }, []);

  const deleteProfile = useCallback((id: string) => {
    const updated = profiles.filter(p => p.id !== id);
    setProfilesState(updated);
    saveProfiles(updated);
    // Clean up storage
    ["tasks", "boxes", "providers", "survival", "audit", "move_date"].forEach(key => {
      localStorage.removeItem(`${getStorageKey(id)}_${key}`);
    });
    if (activeProfileId === id) {
      if (updated.length > 0) {
        switchProfile(updated[0].id);
      } else {
        setActiveProfileIdState(null);
        setShowProfileSetup(true);
      }
    }
  }, [profiles, activeProfileId, switchProfile]);

  const [activeView, setActiveView] = useState<View>("dashboard");
  const [tasks, setTasks] = useState<Task[]>(() => loadState(pid, "tasks", DEFAULT_TASKS));
  const [boxes, setBoxes] = useState<Box[]>(() => loadState(pid, "boxes", [] as Box[]));
  const [providers, setProviders] = useState<Provider[]>(() => loadState(pid, "providers", [] as Provider[]));
  const [survivalKit, setSurvivalKit] = useState<string[]>(() => loadState(pid, "survival", SURVIVAL_KIT_DEFAULT));
  const [audit, setAudit] = useState<AuditItem[]>(() => loadState(pid, "audit", DEFAULT_AUDIT));
  const [boxSearch, setBoxSearch] = useState("");
  const [newBoxRoom, setNewBoxRoom] = useState("");
  const [newBoxContents, setNewBoxContents] = useState("");
  const [newBoxFragile, setNewBoxFragile] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newTaskWeek, setNewTaskWeek] = useState<Week>("4_weeks");
  const [newTaskPri, setNewTaskPri] = useState<Priority>("P1");
  const [newKitItem, setNewKitItem] = useState("");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<Week>>(new Set(["4_weeks", "2_weeks", "moving_day", "after_move"]));
  const [moveDate, setMoveDate] = useState(() => loadState(pid, "move_date", ""));

  // Persist all state (scoped to profile)
  useEffect(() => { if (activeProfileId) saveState(activeProfileId, "tasks", tasks); }, [tasks, activeProfileId]);
  useEffect(() => { if (activeProfileId) saveState(activeProfileId, "boxes", boxes); }, [boxes, activeProfileId]);
  useEffect(() => { if (activeProfileId) saveState(activeProfileId, "providers", providers); }, [providers, activeProfileId]);
  useEffect(() => { if (activeProfileId) saveState(activeProfileId, "survival", survivalKit); }, [survivalKit, activeProfileId]);
  useEffect(() => { if (activeProfileId) saveState(activeProfileId, "move_date", moveDate); }, [moveDate, activeProfileId]);
  useEffect(() => { if (activeProfileId) saveState(activeProfileId, "audit", audit); }, [audit, activeProfileId]);

  const countdown = useCountdown(moveDate || new Date(Date.now() + 30 * 86400000).toISOString());

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalBoxes = boxes.length;
  const scannedBoxes = boxes.filter((b) => b.scanned).length;
  const readiness = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Dashboard computed data
  const p0OpenTasks = tasks.filter((t) => t.priority === "P0" && t.status !== "completed");
  const urgentBoxes = boxes.filter((b) => !b.scanned).slice(0, 5);
  const urgentProviders = providers.filter((p) => p.status !== "confirmed");
  const auditDone = audit.filter((a) => a.done).length;

  const cycleTaskStatus = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const next: Record<TaskStatus, TaskStatus> = { pending: "in_progress", in_progress: "completed", completed: "pending" };
      return { ...t, status: next[t.status] };
    }));
  }, []);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks((prev) => [...prev, { id: uid(), week: newTaskWeek, title: newTask.trim(), priority: newTaskPri, status: "pending" }]);
    setNewTask("");
  };

  const deleteTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const addBox = () => {
    if (!newBoxRoom.trim()) return;
    const num = boxes.length > 0 ? Math.max(...boxes.map((b) => b.number)) + 1 : 1;
    setBoxes((prev) => [...prev, { id: uid(), number: num, room: newBoxRoom.trim(), contents: newBoxContents.trim(), fragile: newBoxFragile, scanned: false }]);
    setNewBoxRoom(""); setNewBoxContents(""); setNewBoxFragile(false);
  };

  const toggleBoxScanned = (id: string) => setBoxes((prev) => prev.map((b) => b.id === id ? { ...b, scanned: !b.scanned } : b));
  const deleteBox = (id: string) => setBoxes((prev) => prev.filter((b) => b.id !== id));

  const addProvider = (type: ProviderType) => {
    setProviders((prev) => [...prev, { id: uid(), type, name: "", phone: "", email: "", status: "not_contacted" }]);
  };
  const updateProvider = (id: string, field: keyof Provider, val: string) => {
    setProviders((prev) => prev.map((p) => p.id === id ? { ...p, [field]: val } : p));
  };
  const cycleProviderStatus = (id: string) => {
    setProviders((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const next: Record<Provider["status"], Provider["status"]> = {
        not_contacted: "contacted", contacted: "confirmed", confirmed: "not_contacted",
      };
      return { ...p, status: next[p.status] };
    }));
  };
  const deleteProvider = (id: string) => setProviders((prev) => prev.filter((p) => p.id !== id));

  const addKitItem = () => {
    if (!newKitItem.trim()) return;
    setSurvivalKit((prev) => [...prev, newKitItem.trim()]);
    setNewKitItem("");
  };

  const toggleWeek = (w: Week) => setExpandedWeeks((prev) => {
    const next = new Set(prev);
    if (next.has(w)) { next.delete(w); } else { next.add(w); }
    return next;
  });

  const filteredBoxes = boxes.filter((b) => {
    if (!boxSearch) return true;
    const s = boxSearch.toLowerCase();
    return b.room.toLowerCase().includes(s) || b.contents.toLowerCase().includes(s) || String(b.number).includes(s);
  });

  const WEEKS: Week[] = ["4_weeks", "2_weeks", "moving_day", "after_move"];

  /* ── Tab nav ── */
  const VIEWS: View[] = ["dashboard", "tasks", "boxes", "providers", "audit"];

  // Profile setup screen
  if (showProfileSetup && profiles.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 animate-fade-up">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Truck className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold">{t("relocation.title")}</h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t("relocation.profileSetupDesc")}
            </p>
          </div>
          <Card className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {t("relocation.moveName")}
              </label>
              <Input
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder={t("relocation.moveNamePlaceholder")}
                maxLength={50}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {t("relocation.estimatedDate")}
              </label>
              <input
                type="date"
                value={newProfileDate}
                onChange={(e) => setNewProfileDate(e.target.value)}
                className="w-full h-10 bg-muted/50 border border-border/60 rounded-lg px-3 text-sm"
              />
            </div>
            <Button
              onClick={() => createProfile(newProfileName, newProfileDate)}
              className="w-full gap-2 glow-primary"
            >
              <Zap className="h-4 w-4" />
              {t("relocation.createCenter")}
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-up">

      {/* ─── Profile Selector ─── */}
      <div className="flex items-center gap-2 flex-wrap">
        {profiles.map((p) => (
          <motion.button
            key={p.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => switchProfile(p.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              activeProfileId === p.id
                ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
                : "bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>{p.name}</span>
            {p.moveDate && (
              <span className="text-[10px] opacity-70">
                {new Date(p.moveDate).toLocaleDateString(language === "he" ? "he-IL" : "en-US", { day: "numeric", month: "short" })}
              </span>
            )}
            {activeProfileId === p.id && (
              <motion.div layoutId="active-profile" className="absolute inset-0 bg-primary/5 rounded-xl border border-primary/30" />
            )}
          </motion.button>
        ))}
        {profiles.length < MAX_PROFILES && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-9 rounded-xl border-dashed"
            onClick={() => setShowProfileSetup(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("relocation.newCenter")}
          </Button>
        )}
        {activeProfile && profiles.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive ms-auto"
            onClick={() => deleteProfile(activeProfile.id)}
            title={t("relocation.deleteCenter")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Profile creation mini-form (inline when adding more profiles) */}
      <AnimatePresence>
        {showProfileSetup && profiles.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="p-4 border-primary/30 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{t("relocation.newMovingCenter")}</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowProfileSetup(false)}>
                  <span className="text-lg leading-none">&times;</span>
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder={t("relocation.moveName")}
                  className="flex-1 min-w-[140px] h-9 text-sm"
                  maxLength={50}
                />
                <input
                  type="date"
                  value={newProfileDate}
                  onChange={(e) => setNewProfileDate(e.target.value)}
                  className="h-9 bg-background border border-border/60 rounded-lg px-3 text-sm"
                />
                <Button size="sm" onClick={() => createProfile(newProfileName, newProfileDate)} className="h-9 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  {t("relocation.create")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {MAX_PROFILES - profiles.length} {t("relocation.centersAvailable")}
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Header / Mission Control ─── */}
      <div className="glass rounded-2xl p-5 border border-border/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh pointer-events-none opacity-30" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce-subtle" />
                <span className="text-xs font-mono text-green-500 uppercase tracking-widest">{t("relocation.operational")}</span>
              </div>
              <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                {t("relocation.title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{t("relocation.subtitle")}</p>
            </div>

            {/* Countdown + date input */}
            <div className="flex flex-col items-end gap-2">
              <input
                type="date"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
                className="text-xs bg-muted/50 border border-border/60 rounded-lg px-2 py-1 text-muted-foreground"
              />
              {moveDate && (
                <div className="flex items-center gap-3">
                  {[
                    { val: countdown.days, label: t("relocation.days") },
                    { val: countdown.hours, label: t("relocation.hours") },
                    { val: countdown.mins, label: t("relocation.minutes") },
                  ].map((c) => (
                    <div key={c.label} className="text-center">
                      <motion.p
                        key={c.val}
                        initial={{ scale: 1.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-2xl font-display font-bold text-primary"
                      >
                        {String(c.val).padStart(2, "0")}
                      </motion.p>
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Overall readiness bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-mono">{t("relocation.readiness")}</span>
              <span className="font-bold text-primary">{readiness}%</span>
            </div>
            <div className="h-3 bg-muted/60 rounded-full overflow-hidden relative">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-green-500 relative"
                initial={{ width: 0 }}
                animate={{ width: `${readiness}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                <div className="absolute inset-0 bg-white/20 animate-shimmer" />
              </motion.div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>{completedTasks}/{totalTasks} {t("relocation.tasks")}</span>
              <span>{scannedBoxes}/{totalBoxes} {t("relocation.boxes")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-border/40 overflow-x-auto">
        {VIEWS.map((v) => {
          const Icon = VIEW_ICONS[v];
          const viewLabel = t(`relocation.views.${v}`);
          const isActive = activeView === v;
          // Badge counts
          let badge = 0;
          if (v === "tasks") badge = p0OpenTasks.length;
          if (v === "boxes") badge = urgentBoxes.length;
          if (v === "providers") badge = urgentProviders.filter(p => p.name).length;
          if (v === "audit") badge = audit.filter(a => !a.done).length;
          return (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap relative ${
                isActive
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {viewLabel}
              {badge > 0 && !isActive && (
                <span className="absolute -top-0.5 -end-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════ */}
        {/* ─── DASHBOARD VIEW ─── */}
        {/* ══════════════════════════════════════════ */}
        {activeView === "dashboard" && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* 3 Command Screens */}
            <div className="grid md:grid-cols-3 gap-4">

              {/* Screen 1: P0 פתוח */}
              <Card className="p-4 border-red-500/30 bg-red-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t("relocation.p0Open")}</p>
                    <p className="text-xs text-muted-foreground">{t("relocation.p0OpenDesc")}</p>
                  </div>
                  {p0OpenTasks.length > 0 && (
                    <span className="ms-auto text-xs font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">
                      {p0OpenTasks.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {p0OpenTasks.length === 0 ? (
                    <div className="text-center py-4">
                      <CheckCircle2 className="h-8 w-8 text-score-high mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">{t("relocation.allP0Done")}</p>
                    </div>
                  ) : (
                    p0OpenTasks.slice(0, 5).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => cycleTaskStatus(task.id)}
                        className="w-full flex items-center gap-2 text-start group"
                      >
                        {task.status === "in_progress" ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                            <Activity className="h-4 w-4 text-amber-500 shrink-0" />
                          </motion.div>
                        ) : (
                          <Circle className="h-4 w-4 text-red-400/60 shrink-0" />
                        )}
                        <span className="text-xs flex-1 group-hover:text-primary transition-colors leading-snug">
                          {task.title}
                        </span>
                        <span className="text-[9px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0">
                          {t(`relocation.weeks.${task.week}`)}
                        </span>
                      </button>
                    ))
                  )}
                  {p0OpenTasks.length > 5 && (
                    <button onClick={() => setActiveView("tasks")} className="text-xs text-primary hover:underline w-full text-center pt-1">
                      + {p0OpenTasks.length - 5} {t("relocation.moreTasks")} →
                    </button>
                  )}
                </div>
              </Card>

              {/* Screen 2: ארגזים לפתיחה מיידית */}
              <Card className="p-4 border-blue-500/30 bg-blue-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Package className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t("relocation.boxesToOpen")}</p>
                    <p className="text-xs text-muted-foreground">{t("relocation.boxesToOpenDesc")}</p>
                  </div>
                  {boxes.filter(b => !b.scanned).length > 0 && (
                    <span className="ms-auto text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">
                      {boxes.filter(b => !b.scanned).length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {boxes.length === 0 ? (
                    <div className="text-center py-4">
                      <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">{t("relocation.noBoxesYet")}</p>
                      <button onClick={() => setActiveView("boxes")} className="text-xs text-primary hover:underline mt-1">
                        + {t("relocation.addBoxes")}
                      </button>
                    </div>
                  ) : (
                    urgentBoxes.map((box) => (
                      <button
                        key={box.id}
                        onClick={() => toggleBoxScanned(box.id)}
                        className="w-full flex items-center gap-2 text-start"
                      >
                        <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                          #{box.number}
                        </div>
                        <span className="text-xs flex-1 leading-snug">{box.room}</span>
                        {box.fragile && <span className="text-[9px] text-amber-400">⚠</span>}
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                      </button>
                    ))
                  )}
                  {boxes.filter(b => !b.scanned).length > 5 && (
                    <button onClick={() => setActiveView("boxes")} className="text-xs text-primary hover:underline w-full text-center pt-1">
                      + {boxes.filter(b => !b.scanned).length - 5} {t("relocation.moreBoxes")} →
                    </button>
                  )}
                </div>
              </Card>

              {/* Screen 3: ספקים לטיפול עכשיו */}
              <Card className="p-4 border-violet-500/30 bg-violet-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t("relocation.providersToHandle")}</p>
                    <p className="text-xs text-muted-foreground">{t("relocation.providersToHandleDesc")}</p>
                  </div>
                  {urgentProviders.filter(p => p.name).length > 0 && (
                    <span className="ms-auto text-xs font-bold text-violet-400 bg-violet-500/20 px-2 py-0.5 rounded-full">
                      {urgentProviders.filter(p => p.name).length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {providers.length === 0 ? (
                    <div className="text-center py-4">
                      <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">{t("relocation.noProvidersYet")}</p>
                      <button onClick={() => setActiveView("providers")} className="text-xs text-primary hover:underline mt-1">
                        + {t("relocation.addProviders")}
                      </button>
                    </div>
                  ) : (
                    urgentProviders.filter(p => p.name).slice(0, 5).map((p) => {
                      const dashProvMeta = PROVIDER_ICONS[p.type];
                      const DashProvIcon = dashProvMeta.icon;
                      return (
                        <button
                          key={p.id}
                          onClick={() => cycleProviderStatus(p.id)}
                          className="w-full flex items-center gap-2 text-start"
                        >
                          <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${dashProvMeta.color} flex items-center justify-center shrink-0`}>
                            <DashProvIcon className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-xs flex-1 leading-snug">{p.name || t(`relocation.providerTypes.${p.type}`)}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                            {t(`relocation.providerStatus.${p.status}`)}
                          </span>
                        </button>
                      );
                    })
                  )}
                  {!providers.some(p => !p.name) && providers.length < Object.keys(PROVIDER_ICONS).length && (
                    <button onClick={() => setActiveView("providers")} className="text-xs text-primary hover:underline w-full text-center pt-1">
                      + {t("relocation.addNewProvider")}
                    </button>
                  )}
                </div>
              </Card>
            </div>

            {/* Survival Kit + Stats in 2 columns */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Survival Kit */}
              <Card className="p-4 border-primary/40 bg-primary/5">
                <h2 className="text-sm font-display font-bold mb-3 flex items-center gap-2 text-primary">
                  <BookMarked className="h-4 w-4" />
                  {t("relocation.survivalKit")}
                </h2>
                <p className="text-xs text-muted-foreground mb-3">{t("relocation.survivalHint")}</p>
                <div className="space-y-1">
                  {survivalKit.slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-xs">{item}</span>
                    </div>
                  ))}
                  {survivalKit.length > 6 && (
                    <p className="text-xs text-muted-foreground ps-5">+ {survivalKit.length - 6} {t("relocation.moreItems")}...</p>
                  )}
                </div>
              </Card>

              {/* Operation Status */}
              <Card className="p-4 border-border/60 space-y-3">
                <h3 className="text-sm font-display font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  {t("relocation.operationStatus")}
                </h3>
                {[
                  { label: t("relocation.p0Completed"), value: tasks.filter((t) => t.priority === "P0" && t.status === "completed").length, total: tasks.filter((t) => t.priority === "P0").length || 1, color: "bg-red-500" },
                  { label: t("relocation.openedBoxes"), value: scannedBoxes, total: totalBoxes || 1, color: "bg-blue-500" },
                  { label: t("relocation.providersConfirmed"), value: providers.filter((p) => p.status === "confirmed").length, total: providers.length || 1, color: "bg-green-500" },
                  { label: t("relocation.postAudit"), value: auditDone, total: audit.length || 1, color: "bg-violet-500" },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{stat.label}</span>
                      <span className="font-bold text-foreground">{stat.value}/{stat.total}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${stat.color}`}
                        animate={{ width: `${(stat.value / stat.total) * 100}%` }}
                        transition={{ duration: 0.7 }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-1 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportTasksCsv(tasks, `rentelx-relocation-tasks-${new Date().toISOString().slice(0, 10)}.csv`)}
                    className="flex-1 gap-1.5 h-8 text-xs"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    {t("relocation.exportCsv")}
                  </Button>
                </div>
              </Card>
            </div>

            {/* P0 Moving Day Alert */}
            {tasks.some((t) => t.priority === "P0" && t.status === "pending" && t.week === "moving_day") && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="p-3 border-destructive/40 bg-destructive/5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive font-medium">{t("relocation.p0MovingDayWarning")}</p>
                    <Button size="sm" variant="ghost" className="ms-auto h-7 text-xs" onClick={() => setActiveView("tasks")}>
                      {t("relocation.viewAction")} →
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ─── TASKS VIEW ─── */}
        {/* ══════════════════════════════════════════ */}
        {activeView === "tasks" && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                <h2 className="text-base font-display font-bold flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  {t("relocation.timeline")}
                </h2>
                {WEEKS.map((week) => {
                  const weekMeta = WEEK_COLORS[week];
                  const WeekIcon = weekMeta.icon;
                  const weekTasks = tasks.filter((t) => t.week === week);
                  const weekDone = weekTasks.filter((t) => t.status === "completed").length;
                  const isOpen = expandedWeeks.has(week);
                  return (
                    <Card key={week} className="border-border/60 overflow-hidden">
                      <button
                        className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                        onClick={() => toggleWeek(week)}
                      >
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${weekMeta.color} flex items-center justify-center shrink-0`}>
                          <WeekIcon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 text-start">
                          <p className="text-sm font-semibold">{t(`relocation.weeks.${week}`)}</p>
                          <p className="text-xs text-muted-foreground">{weekDone}/{weekTasks.length} {t("relocation.completed")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full bg-gradient-to-r ${weekMeta.color}`}
                              animate={{ width: weekTasks.length ? `${(weekDone / weekTasks.length) * 100}%` : "0%" }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flip-rtl" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-1.5 border-t border-border/40 pt-2">
                              <AnimatePresence>
                                {weekTasks.map((task, i) => (
                                  <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="flex items-center gap-2 group"
                                  >
                                    <button onClick={() => cycleTaskStatus(task.id)} className="shrink-0">
                                      {task.status === "completed" ? (
                                        <CheckCircle2 className="h-5 w-5 text-score-high" />
                                      ) : task.status === "in_progress" ? (
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                                          <Activity className="h-5 w-5 text-amber-500" />
                                        </motion.div>
                                      ) : (
                                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                                      )}
                                    </button>
                                    <span className={`flex-1 text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                                      {task.title}
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-mono ${PRIORITY_COLORS[task.priority]}`}>
                                      {task.priority}
                                    </span>
                                    <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </button>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  );
                })}

                {/* Add task */}
                <Card className="p-3 border-border/60 border-dashed">
                  <p className="text-xs text-muted-foreground font-semibold mb-2">+ {t("relocation.addTask")}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Input
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTask()}
                      placeholder={t("relocation.taskPlaceholder")}
                      className="flex-1 min-w-[160px] h-8 text-sm"
                    />
                    <select
                      value={newTaskWeek}
                      onChange={(e) => setNewTaskWeek(e.target.value as Week)}
                      className="h-8 bg-muted/50 border border-border/60 rounded-md text-xs px-2"
                    >
                      {WEEKS.map((w) => <option key={w} value={w}>{t(`relocation.weeks.${w}`)}</option>)}
                    </select>
                    <select
                      value={newTaskPri}
                      onChange={(e) => setNewTaskPri(e.target.value as Priority)}
                      className="h-8 bg-muted/50 border border-border/60 rounded-md text-xs px-2"
                    >
                      <option value="P0">{t("relocation.priority.P0")}</option>
                      <option value="P1">{t("relocation.priority.P1")}</option>
                      <option value="P2">{t("relocation.priority.P2")}</option>
                    </select>
                    <Button size="sm" onClick={addTask} className="h-8 gap-1">
                      <Plus className="h-3.5 w-3.5" /> {t("relocation.add")}
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Sidebar: Survival Kit */}
              <div>
                <Card className="p-4 border-primary/40 bg-primary/5 sticky top-4">
                  <h2 className="text-sm font-display font-bold mb-3 flex items-center gap-2 text-primary">
                    <BookMarked className="h-4 w-4" />
                    {t("relocation.survivalKit")}
                  </h2>
                  <div className="space-y-1.5">
                    <AnimatePresence>
                      {survivalKit.map((item, i) => (
                        <motion.div
                          key={item + i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-center gap-2 group"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs flex-1">{item}</span>
                          <button
                            onClick={() => setSurvivalKit((prev) => prev.filter((_, idx) => idx !== i))}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Input
                      value={newKitItem}
                      onChange={(e) => setNewKitItem(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addKitItem()}
                      placeholder={t("relocation.newItem")}
                      className="h-7 text-xs flex-1"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={addKitItem}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ─── BOXES VIEW ─── */}
        {/* ══════════════════════════════════════════ */}
        {activeView === "boxes" && (
          <motion.div
            key="boxes"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <h2 className="text-base font-display font-bold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {t("relocation.boxInventory")}
            </h2>

            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={boxSearch}
                onChange={(e) => setBoxSearch(e.target.value)}
                placeholder={t("relocation.searchBoxes")}
                className="ps-9"
              />
            </div>

            <div className="space-y-2">
              <AnimatePresence>
                {filteredBoxes.map((box, i) => (
                  <motion.div
                    key={box.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className={`p-3 border-border/60 flex items-center gap-3 group ${box.scanned ? "opacity-70" : ""}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${box.scanned ? "bg-score-high/20 text-score-high" : "bg-primary/10 text-primary"}`}>
                        #{box.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{box.room}</span>
                          {box.fragile && <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-500">⚠ {t("relocation.fragile")}</Badge>}
                          {box.scanned && <Badge variant="outline" className="text-xs border-green-500/40 text-green-500">✓ {t("relocation.scanned")}</Badge>}
                        </div>
                        {box.contents && <p className="text-xs text-muted-foreground mt-0.5 truncate">{box.contents}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleBoxScanned(box.id)}>
                          <CheckCircle2 className={`h-3.5 w-3.5 ${box.scanned ? "text-score-high" : "text-muted-foreground"}`} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteBox(box.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredBoxes.length === 0 && !boxSearch && (
                <p className="text-sm text-muted-foreground text-center py-6">{t("relocation.noBoxes")}</p>
              )}
            </div>

            {/* Add box */}
            <Card className="p-3 border-border/60 border-dashed">
              <p className="text-xs text-muted-foreground font-semibold mb-2">+ {t("relocation.addBox")}</p>
              <div className="flex gap-2 flex-wrap">
                <Input value={newBoxRoom} onChange={(e) => setNewBoxRoom(e.target.value)} placeholder={t("relocation.boxRoom")} className="flex-1 min-w-[120px] h-8 text-sm" />
                <Input value={newBoxContents} onChange={(e) => setNewBoxContents(e.target.value)} placeholder={t("relocation.contents")} className="flex-1 min-w-[120px] h-8 text-sm" />
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={newBoxFragile} onChange={(e) => setNewBoxFragile(e.target.checked)} className="rounded" />
                  {t("relocation.fragile")}
                </label>
                <Button size="sm" onClick={addBox} className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" /> {t("relocation.add")}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ─── PROVIDERS VIEW ─── */}
        {/* ══════════════════════════════════════════ */}
        {activeView === "providers" && (
          <motion.div
            key="providers"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <h2 className="text-base font-display font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {t("relocation.providers")}
            </h2>

            <div className="space-y-3">
              <AnimatePresence>
                {providers.map((p) => {
                  const provMeta = PROVIDER_ICONS[p.type];
                  const ProvIcon = provMeta.icon;
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Card className="p-3 border-border/60 group">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${provMeta.color} flex items-center justify-center shrink-0`}>
                            <ProvIcon className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm font-semibold">{t(`relocation.providerTypes.${p.type}`)}</span>
                          <button
                            onClick={() => cycleProviderStatus(p.id)}
                            className={`ms-auto text-xs px-2 py-0.5 rounded-full cursor-pointer ${STATUS_COLORS[p.status]}`}
                          >
                            {t(`relocation.providerStatus.${p.status}`)}
                          </button>
                          <button onClick={() => deleteProvider(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input value={p.name} onChange={(e) => updateProvider(p.id, "name", e.target.value)} placeholder={t("relocation.providerName")} className="h-7 text-xs" />
                          <Input value={p.phone} onChange={(e) => updateProvider(p.id, "phone", e.target.value)} placeholder={t("relocation.phone")} className="h-7 text-xs" dir="ltr" />
                          <Input value={p.email} onChange={(e) => updateProvider(p.id, "email", e.target.value)} placeholder={t("auth.email")} className="h-7 text-xs" dir="ltr" />
                        </div>
                        {(p.phone || p.email) && (
                          <div className="flex gap-2 mt-2">
                            {p.phone && (
                              <a href={`tel:${p.phone}`}>
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                                  <Phone className="h-3 w-3" /> {t("relocation.call")}
                                </Button>
                              </a>
                            )}
                            {p.email && (
                              <a href={`mailto:${p.email}`}>
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                                  <Mail className="h-3 w-3" /> {t("relocation.sendEmail")}
                                </Button>
                              </a>
                            )}
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(PROVIDER_ICONS) as ProviderType[]).map((type) => {
                  const provBtnMeta = PROVIDER_ICONS[type];
                  const ProvBtnIcon = provBtnMeta.icon;
                  const alreadyAdded = providers.some((p) => p.type === type);
                  if (alreadyAdded) return null;
                  return (
                    <Button key={type} size="sm" variant="outline" onClick={() => addProvider(type)} className="gap-1.5 text-xs h-8">
                      <ProvBtnIcon className="h-3.5 w-3.5" />
                      + {t(`relocation.providerTypes.${type}`)}
                    </Button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ─── POST-MOVE AUDIT VIEW ─── */}
        {/* ══════════════════════════════════════════ */}
        {activeView === "audit" && (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                {t("relocation.postMoveAudit")}
              </h2>
              <span className="text-sm font-bold text-primary">{auditDone}/{audit.length}</span>
            </div>

            <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-green-500"
                animate={{ width: audit.length > 0 ? `${(auditDone / audit.length) * 100}%` : "0%" }}
                transition={{ duration: 0.7 }}
              />
            </div>

            <div className="space-y-2">
              <AnimatePresence>
                {audit.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card
                      className={`p-3 border-border/60 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors group ${item.done ? "opacity-60" : ""}`}
                      onClick={() => setAudit(prev => prev.map(a => a.id === item.id ? { ...a, done: !a.done } : a))}
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-5 w-5 text-score-high shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>
                        {item.title}
                      </span>
                      {item.done && (
                        <Badge variant="outline" className="text-xs border-green-500/40 text-green-500 shrink-0">✓ {t("relocation.updated")}</Badge>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {auditDone === audit.length && audit.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-2"
              >
                <div className="text-4xl">🎉</div>
                <p className="font-display font-bold text-lg text-score-high">{t("relocation.allUpdatesComplete")}</p>
                <p className="text-sm text-muted-foreground">{t("relocation.welcomeNewHome")}</p>
              </motion.div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* AI Assistant for Relocation */}
      <AiSectionHelper
        context={`Moving center: ${completedTasks}/${totalTasks} tasks completed (${readiness}% readiness), ${totalBoxes} boxes, ${providers.length} providers, ${auditDone}/${audit.length} post-audit done. Move date: ${moveDate || "not set"}.`}
        section="Relocation"
        suggestions={language === "he"
          ? ["מה עוד שכחתי?", "טיפים ליום המעבר", "איך לחסוך בהובלה?", "רשימת בדיקה אחרונה"]
          : ["What am I missing?", "Moving day tips", "How to save on movers?", "Final checklist"]
        }
      />
    </div>
  );
};

export default Relocation;
