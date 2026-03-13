import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Package,
  Phone, Mail, Plus, Trash2, Search, Zap, Shield,
  Building2, Wifi, Bolt, Droplets, Truck, BookMarked,
  ChevronDown, ChevronRight, Target, Activity
} from "lucide-react";

/* ─── Types ─── */
type Priority = "P0" | "P1" | "P2";
type TaskStatus = "pending" | "in_progress" | "completed";
type Week = "4_weeks" | "2_weeks" | "moving_day" | "after_move";
type ProviderType = "movers" | "internet" | "electricity" | "gas" | "water" | "other";

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
}

interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  phone: string;
  email: string;
  status: "not_contacted" | "contacted" | "confirmed";
}

/* ─── Storage helpers ─── */
const STORAGE_KEY = "rentelx_relocation_v1";

function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveState<T>(key: string, val: T) {
  localStorage.setItem(`${STORAGE_KEY}_${key}`, JSON.stringify(val));
}

/* ─── Default data (Hebrew) ─── */
const DEFAULT_TASKS: Task[] = [
  // ─── 4 Weeks Before ───
  { id: "t1",  week: "4_weeks",    title: "הזמן חברת הובלה ואשר תאריך",         priority: "P0", status: "pending" },
  { id: "t2",  week: "4_weeks",    title: "הודע לבעל הדירה ותאם עזיבה רשמית",   priority: "P0", status: "pending" },
  { id: "t3",  week: "4_weeks",    title: "הזמן חומרי אריזה (קרטונים, סרט, ניילון מבעבע)", priority: "P1", status: "pending" },
  { id: "t4",  week: "4_weeks",    title: "ערוך רשימת פריטים לתרומה/מכירה",     priority: "P2", status: "pending" },
  { id: "t5",  week: "4_weeks",    title: "צלם תיעוד מצב הדירה הישנה (לפני)",   priority: "P0", status: "pending" },
  { id: "t6",  week: "4_weeks",    title: "עדכן כתובת בבנק וכרטיסי אשראי",      priority: "P0", status: "pending" },
  { id: "t7",  week: "4_weeks",    title: "עדכן כתובת בחברות ביטוח",            priority: "P1", status: "pending" },
  // ─── 2 Weeks Before ───
  { id: "t8",  week: "2_weeks",    title: "הזמן אינטרנט לדירה החדשה",           priority: "P0", status: "pending" },
  { id: "t9",  week: "2_weeks",    title: "ארוז פריטים שאינם בשימוש יומי",      priority: "P0", status: "pending" },
  { id: "t10", week: "2_weeks",    title: "ארוז ספרים, תמונות, עיצוב ודקורציה", priority: "P1", status: "pending" },
  { id: "t11", week: "2_weeks",    title: "עדכן כתובת — דואר ישראל / הפניית דואר", priority: "P1", status: "pending" },
  { id: "t12", week: "2_weeks",    title: "עדכן כתובת — ביטוח לאומי / קופות חולים", priority: "P1", status: "pending" },
  { id: "t13", week: "2_weeks",    title: "עדכן שירותי סטרימינג ומשלוחים",      priority: "P2", status: "pending" },
  { id: "t14", week: "2_weeks",    title: "הודע למעסיק/בי\"ס/גנים על שינוי כתובת", priority: "P2", status: "pending" },
  // ─── Moving Day ───
  { id: "t15", week: "moving_day", title: "בדוק את הדירה הישנה לפני עזיבה סופית", priority: "P0", status: "pending" },
  { id: "t16", week: "moving_day", title: "שמור ערכת הישרדות 48 שעות בהישג יד",  priority: "P0", status: "pending" },
  { id: "t17", week: "moving_day", title: "מסור מפתחות לבעל הדירה הישנה",        priority: "P0", status: "pending" },
  { id: "t18", week: "moving_day", title: "חפש בטבלת ארגזים לפי מילת מפתח",      priority: "P1", status: "pending" },
  { id: "t19", week: "moving_day", title: "צלם תיעוד מצב הדירה החדשה (בכניסה)",  priority: "P0", status: "pending" },
  // ─── After Move — Post-Move Audit ───
  { id: "t20", week: "after_move", title: "חבר חשמל, מים, גז בדירה החדשה",      priority: "P0", status: "pending" },
  { id: "t21", week: "after_move", title: "בדוק Wi-Fi ואינטרנט — חבר נתב",       priority: "P0", status: "pending" },
  { id: "t22", week: "after_move", title: "פרוק ערכת הישרדות וארגז ראשוני",       priority: "P0", status: "pending" },
  { id: "t23", week: "after_move", title: "פרוק קופסאות לפי חדרים (חפש לפי מספר)", priority: "P1", status: "pending" },
  { id: "t24", week: "after_move", title: "עדכן כתובת — משרד הפנים / רשות האוכלוסין", priority: "P1", status: "pending" },
  { id: "t25", week: "after_move", title: "עדכן מנויים: חדר כושר, חוגים, תוכנות",  priority: "P2", status: "pending" },
  { id: "t26", week: "after_move", title: "בצע System Check: כל החשבונות/מנויים עודכנו?", priority: "P1", status: "pending" },
];

const SURVIVAL_KIT_DEFAULT = [
  "מטענים: לפטופים, טלפונים, שעונים, סוללות + מפצל/כבל מאריך",
  "Wi-Fi: נתב, ספק כוח, כבלי Ethernet, פרטי התחברות, Hotspot",
  "מסמכים: חוזה/מפתח, ת\"ז/דרכונים, ביטוח, מסמכי ילדים",
  "כלי עבודה: מברג, סכין יפני, סרט הדבקה, טושים, אזיקונים",
  "מטבח מהיר: קומקום, כוסות, צלחות, סכו\"ם, מגבות נייר",
  "לילה ראשון: מצעים, שמיכות, פיג'מות, מטעני לילה, אטמי אוזניים",
  "היגיינה: מברשות שיניים, סבון, שמפו, נייר טואלט, מגבונים",
  "ילדים: בקבוק/מוצץ/צעצוע מעבר, בגדי החלפה, חטיפים",
  "תרופות: קבועות + משככי כאבים + ערכת עזרה ראשונה",
  "ניקיון מהיר: ספריי, ספוג, שקיות זבל",
];

const WEEK_META: Record<Week, { label: string; color: string; icon: React.ElementType }> = {
  "4_weeks":    { label: "4 שבועות לפני", color: "from-blue-500 to-blue-600",     icon: Target },
  "2_weeks":    { label: "2 שבועות לפני", color: "from-amber-500 to-orange-500",  icon: Clock },
  "moving_day": { label: "יום המעבר",      color: "from-red-500 to-rose-600",      icon: Zap },
  "after_move": { label: "אחרי המעבר",     color: "from-green-500 to-emerald-500", icon: CheckCircle2 },
};

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  P0: { label: "P0 · קריטי", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  P1: { label: "P1 · גבוה",   color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  P2: { label: "P2 · רגיל",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

const PROVIDER_META: Record<ProviderType, { label: string; icon: React.ElementType; color: string }> = {
  movers:      { label: "חברת הובלה", icon: Truck,       color: "from-violet-500 to-violet-600" },
  internet:    { label: "אינטרנט",    icon: Wifi,        color: "from-blue-500 to-blue-600" },
  electricity: { label: "חשמל",       icon: Bolt,        color: "from-yellow-500 to-amber-500" },
  gas:         { label: "גז",         icon: Activity,    color: "from-orange-500 to-red-500" },
  water:       { label: "מים",        icon: Droplets,    color: "from-cyan-500 to-blue-500" },
  other:       { label: "אחר",        icon: Building2,   color: "from-gray-500 to-gray-600" },
};

const STATUS_META: Record<Provider["status"], { label: string; color: string }> = {
  not_contacted: { label: "לא נוצר קשר", color: "bg-muted text-muted-foreground" },
  contacted:     { label: "נוצר קשר",    color: "bg-amber-500/20 text-amber-400" },
  confirmed:     { label: "מאושר ✓",     color: "bg-green-500/20 text-green-400" },
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

/* ─── Main Component ─── */
const Relocation = () => {
  const { direction } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>(() => loadState("tasks", DEFAULT_TASKS));
  const [boxes, setBoxes] = useState<Box[]>(() => loadState("boxes", [] as Box[]));
  const [providers, setProviders] = useState<Provider[]>(() => loadState("providers", [] as Provider[]));
  const [survivalKit, setSurvivalKit] = useState<string[]>(() => loadState("survival", SURVIVAL_KIT_DEFAULT));
  const [boxSearch, setBoxSearch] = useState("");
  const [newBoxRoom, setNewBoxRoom] = useState("");
  const [newBoxContents, setNewBoxContents] = useState("");
  const [newBoxFragile, setNewBoxFragile] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newTaskWeek, setNewTaskWeek] = useState<Week>("4_weeks");
  const [newTaskPri, setNewTaskPri] = useState<Priority>("P1");
  const [newKitItem, setNewKitItem] = useState("");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<Week>>(new Set(["4_weeks", "2_weeks", "moving_day", "after_move"]));
  const [moveDate, setMoveDate] = useState(() => loadState("move_date", ""));

  // Persist all state
  useEffect(() => { saveState("tasks", tasks); }, [tasks]);
  useEffect(() => { saveState("boxes", boxes); }, [boxes]);
  useEffect(() => { saveState("providers", providers); }, [providers]);
  useEffect(() => { saveState("survival", survivalKit); }, [survivalKit]);
  useEffect(() => { saveState("move_date", moveDate); }, [moveDate]);

  const countdown = useCountdown(moveDate || new Date(Date.now() + 30 * 86400000).toISOString());

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalBoxes = boxes.length;
  const scannedBoxes = boxes.filter((b) => b.scanned).length;
  const readiness = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
    next.has(w) ? next.delete(w) : next.add(w);
    return next;
  });

  const filteredBoxes = boxes.filter((b) => {
    if (!boxSearch) return true;
    const s = boxSearch.toLowerCase();
    return b.room.toLowerCase().includes(s) || b.contents.toLowerCase().includes(s) || String(b.number).includes(s);
  });

  const WEEKS: Week[] = ["4_weeks", "2_weeks", "moving_day", "after_move"];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-up">

      {/* ─── Header / Mission Control ─── */}
      <div className="glass rounded-2xl p-5 border border-border/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh pointer-events-none opacity-30" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce-subtle" />
                <span className="text-xs font-mono text-green-500 uppercase tracking-widest">SYSTEM OPERATIONAL</span>
              </div>
              <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                מרכז פיקוד — מעבר דירה
              </h1>
              <p className="text-sm text-muted-foreground mt-1">ניהול מבצעי · תכנון ב-30 יום · ביצוע מושלם</p>
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
                    { val: countdown.days, label: "ימים" },
                    { val: countdown.hours, label: "שעות" },
                    { val: countdown.mins, label: "דקות" },
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
              <span className="text-muted-foreground font-mono">OPERATIONAL READINESS</span>
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
              <span>{completedTasks}/{totalTasks} משימות</span>
              <span>{scannedBoxes}/{totalBoxes} קופסאות</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* ─── Timeline / Deployment Tasks ─── */}
          <div>
            <h2 className="text-base font-display font-bold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              לוח זמנים — פריסת המשימות
            </h2>

            <div className="space-y-3">
              {WEEKS.map((week) => {
                const meta = WEEK_META[week];
                const weekTasks = tasks.filter((t) => t.week === week);
                const weekDone = weekTasks.filter((t) => t.status === "completed").length;
                const isOpen = expandedWeeks.has(week);

                return (
                  <Card key={week} className="border-border/60 overflow-hidden">
                    <button
                      className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                      onClick={() => toggleWeek(week)}
                    >
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0`}>
                        <meta.icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 text-start">
                        <p className="text-sm font-semibold">{meta.label}</p>
                        <p className="text-xs text-muted-foreground">{weekDone}/{weekTasks.length} הושלמו</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full bg-gradient-to-r ${meta.color}`}
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
                                  <button
                                    onClick={() => cycleTaskStatus(task.id)}
                                    className="shrink-0"
                                  >
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
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full border font-mono ${PRIORITY_META[task.priority].color}`}>
                                    {task.priority}
                                  </span>
                                  <button
                                    onClick={() => deleteTask(task.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
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
            </div>

            {/* Add task */}
            <Card className="p-3 mt-3 border-border/60 border-dashed">
              <p className="text-xs text-muted-foreground font-semibold mb-2">+ הוסף משימה</p>
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder="תיאור המשימה..."
                  className="flex-1 min-w-[160px] h-8 text-sm"
                />
                <select
                  value={newTaskWeek}
                  onChange={(e) => setNewTaskWeek(e.target.value as Week)}
                  className="h-8 bg-muted/50 border border-border/60 rounded-md text-xs px-2"
                >
                  {WEEKS.map((w) => <option key={w} value={w}>{WEEK_META[w].label}</option>)}
                </select>
                <select
                  value={newTaskPri}
                  onChange={(e) => setNewTaskPri(e.target.value as Priority)}
                  className="h-8 bg-muted/50 border border-border/60 rounded-md text-xs px-2"
                >
                  <option value="P0">P0 קריטי</option>
                  <option value="P1">P1 גבוה</option>
                  <option value="P2">P2 רגיל</option>
                </select>
                <Button size="sm" onClick={addTask} className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" /> הוסף
                </Button>
              </div>
            </Card>
          </div>

          {/* ─── Box Inventory ─── */}
          <div>
            <h2 className="text-base font-display font-bold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              מלאי קופסאות
            </h2>

            <div className="relative mb-3">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={boxSearch}
                onChange={(e) => setBoxSearch(e.target.value)}
                placeholder="חפש לפי חדר, תוכן..."
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
                          {box.fragile && (
                            <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-500">⚠ שביר</Badge>
                          )}
                          {box.scanned && (
                            <Badge variant="outline" className="text-xs border-green-500/40 text-green-500">✓ נסרק</Badge>
                          )}
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
                <p className="text-sm text-muted-foreground text-center py-6">אין קופסאות עדיין. הוסף את הראשונה!</p>
              )}
            </div>

            {/* Add box */}
            <Card className="p-3 mt-3 border-border/60 border-dashed">
              <p className="text-xs text-muted-foreground font-semibold mb-2">+ הוסף קופסה</p>
              <div className="flex gap-2 flex-wrap">
                <Input value={newBoxRoom} onChange={(e) => setNewBoxRoom(e.target.value)} placeholder="חדר (ל דוגמה: מטבח)" className="flex-1 min-w-[120px] h-8 text-sm" />
                <Input value={newBoxContents} onChange={(e) => setNewBoxContents(e.target.value)} placeholder="תוכן" className="flex-1 min-w-[120px] h-8 text-sm" />
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={newBoxFragile} onChange={(e) => setNewBoxFragile(e.target.checked)} className="rounded" />
                  שביר
                </label>
                <Button size="sm" onClick={addBox} className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" /> הוסף
                </Button>
              </div>
            </Card>
          </div>

          {/* ─── Critical Infrastructure ─── */}
          <div>
            <h2 className="text-base font-display font-bold mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              ספקי שירות קריטיים
            </h2>

            <div className="space-y-3">
              <AnimatePresence>
                {providers.map((p) => {
                  const meta = PROVIDER_META[p.type];
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Card className="p-3 border-border/60 group">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0`}>
                            <meta.icon className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm font-semibold">{meta.label}</span>
                          <button
                            onClick={() => cycleProviderStatus(p.id)}
                            className={`ms-auto text-xs px-2 py-0.5 rounded-full ${STATUS_META[p.status].color}`}
                          >
                            {STATUS_META[p.status].label}
                          </button>
                          <button onClick={() => deleteProvider(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input value={p.name} onChange={(e) => updateProvider(p.id, "name", e.target.value)} placeholder="שם ספק" className="h-7 text-xs" />
                          <Input value={p.phone} onChange={(e) => updateProvider(p.id, "phone", e.target.value)} placeholder="טלפון" className="h-7 text-xs" dir="ltr" />
                          <Input value={p.email} onChange={(e) => updateProvider(p.id, "email", e.target.value)} placeholder="אימייל" className="h-7 text-xs" dir="ltr" />
                        </div>
                        {(p.phone || p.email) && (
                          <div className="flex gap-2 mt-2">
                            {p.phone && (
                              <a href={`tel:${p.phone}`}>
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                                  <Phone className="h-3 w-3" /> התקשר
                                </Button>
                              </a>
                            )}
                            {p.email && (
                              <a href={`mailto:${p.email}`}>
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                                  <Mail className="h-3 w-3" /> שלח מייל
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
                {(Object.keys(PROVIDER_META) as ProviderType[]).map((type) => {
                  const meta = PROVIDER_META[type];
                  const alreadyAdded = providers.some((p) => p.type === type);
                  if (alreadyAdded) return null;
                  return (
                    <Button key={type} size="sm" variant="outline" onClick={() => addProvider(type)} className="gap-1.5 text-xs h-8">
                      <meta.icon className="h-3.5 w-3.5" />
                      + {meta.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Survival Kit Sidebar ─── */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-4 space-y-4">
            <Card className="p-4 border-primary/40 bg-primary/5">
              <h2 className="text-sm font-display font-bold mb-3 flex items-center gap-2 text-primary">
                <BookMarked className="h-4 w-4" />
                ערכת ישרדות — 48 שעות ראשונות
              </h2>
              <p className="text-xs text-muted-foreground mb-3">שמרו קופסה זו בהישג יד ביום המעבר</p>
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
                  placeholder="פריט חדש..."
                  className="h-7 text-xs flex-1"
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={addKitItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            {/* Stats mini panel */}
            <Card className="p-4 border-border/60 space-y-3">
              <h3 className="text-sm font-display font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                סטטוס מבצע
              </h3>
              {[
                { label: "משימות P0 שהושלמו", value: tasks.filter((t) => t.priority === "P0" && t.status === "completed").length, total: tasks.filter((t) => t.priority === "P0").length, color: "bg-red-500" },
                { label: "קופסאות ארוזות", value: totalBoxes, total: totalBoxes || 1, color: "bg-blue-500" },
                { label: "ספקים מאושרים", value: providers.filter((p) => p.status === "confirmed").length, total: providers.length || 1, color: "bg-green-500" },
              ].map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{stat.label}</span>
                    <span className="font-bold text-foreground">{stat.value}/{stat.total}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${stat.color}`}
                      animate={{ width: stat.total > 0 ? `${(stat.value / stat.total) * 100}%` : "0%" }}
                      transition={{ duration: 0.7 }}
                    />
                  </div>
                </div>
              ))}
            </Card>

            {/* Alert for overdue P0 */}
            {tasks.some((t) => t.priority === "P0" && t.status === "pending" && t.week === "moving_day") && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="p-3 border-destructive/40 bg-destructive/5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive font-medium">משימות P0 ביום המעבר ממתינות</p>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Relocation;
