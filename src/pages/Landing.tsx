import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import {
  Search, Zap, Columns3, Brain, Shield, Globe,
  ArrowRight, MapPin, Sparkles,
  BedDouble, Maximize, ChevronRight,
  BarChart3, Cpu, Database, Network, Bell
} from "lucide-react";

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: 1500, bounce: 0 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (isInView) motionVal.set(value);
  }, [isInView, value, motionVal]);

  useEffect(() => {
    return spring.on("change", (v) => setDisplay(Math.round(v)));
  }, [spring]);

  return <span ref={ref}>{display}{suffix}</span>;
}

/* ─── AI Workflow Node ─── */
function WorkflowNode({
  icon: Icon, label, color, delay = 0, active = false,
}: { icon: React.ElementType; label: string; color: string; delay?: number; active?: boolean }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.7 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg relative"
        style={{ background: color }}
      >
        <Icon className="h-6 w-6 text-white" />
        {active && (
          <span className="absolute -top-1 -end-1 w-3 h-3 rounded-full bg-green-400 ring-2 ring-background animate-bounce-subtle" />
        )}
      </div>
      <span className="text-xs font-medium text-center text-muted-foreground max-w-[70px] leading-tight">{label}</span>
    </motion.div>
  );
}

/* ─── Flowing Data Dot ─── */
function FlowDot({ delay = 0, color = "hsl(var(--primary))" }: { delay?: number; color?: string }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full top-1/2 -translate-y-1/2"
      style={{ background: color }}
      initial={{ left: "0%", opacity: 0 }}
      animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ─── Demo listings for Tel Aviv / Givatayim / Ramat Gan ─── */
const DEMO_LISTINGS = [
  { address: "רוטשילד 45", city: "תל אביב", price: 6800, rooms: 3, sqm: 85, score: 94, neighborhood: "לב העיר" },
  { address: "הרצל 12", city: "גבעתיים", price: 4800, rooms: 2.5, sqm: 68, score: 89, neighborhood: "גבעת רמב\"ם" },
  { address: "ביאליק 7", city: "רמת גן", price: 5200, rooms: 3, sqm: 78, score: 82, neighborhood: "גבעת עליה" },
  { address: "דיזנגוף 88", city: "תל אביב", price: 7400, rooms: 3.5, sqm: 95, score: 77, neighborhood: "דיזנגוף" },
];

const Landing = () => {
  const { t } = useLanguage();
  const [activeListingIdx, setActiveListingIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActiveListingIdx((i) => (i + 1) % DEMO_LISTINGS.length), 2500);
    return () => clearInterval(timer);
  }, []);

  const features = [
    { icon: Search, titleKey: "landing.features.aggregate.title", descKey: "landing.features.aggregate.desc", color: "from-blue-500 to-blue-600" },
    { icon: Brain, titleKey: "landing.features.score.title", descKey: "landing.features.score.desc", color: "from-violet-500 to-violet-600" },
    { icon: Columns3, titleKey: "landing.features.pipeline.title", descKey: "landing.features.pipeline.desc", color: "from-primary to-orange-400" },
    { icon: Bell, titleKey: "landing.features.watchlist.title", descKey: "landing.features.watchlist.desc", color: "from-teal-500 to-cyan-400" },
    { icon: Globe, titleKey: "landing.features.bilingual.title", descKey: "landing.features.bilingual.desc", color: "from-pink-500 to-rose-400" },
    { icon: Shield, titleKey: "landing.features.privacy.title", descKey: "landing.features.privacy.desc", color: "from-green-500 to-emerald-500" },
  ];

  const steps = [
    { num: "1", key: "landing.steps.profile" },
    { num: "2", key: "landing.steps.add" },
    { num: "3", key: "landing.steps.score" },
    { num: "4", key: "landing.steps.manage" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ─── Navbar ─── */}
      <header className="fixed top-0 inset-x-0 z-50 glass border-b border-border/40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-gradient">{t("app.name")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm">{t("auth.login")}</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="glow-primary">{t("auth.signup")}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative pt-28 pb-16 px-4 overflow-hidden">
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-16 start-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], x: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-32 end-1/4 w-72 h-72 rounded-full bg-accent/10 blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-6 border border-primary/20">
                <Sparkles className="h-3 w-3 animate-sparkle" />
                {t("landing.badge")}
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1]">
                <span className="text-gradient-animated">{t("landing.hero.title")}</span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
                {t("landing.hero.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
                <Link to="/signup">
                  <Button size="lg" className="gap-2 text-base px-8 glow-primary animate-bounce-subtle">
                    {t("landing.hero.cta")} <ArrowRight className="h-4 w-4 flip-rtl" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="text-base px-8">
                    {t("auth.login")}
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* ─── AI Workflow Visualization ─── */}
          <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <div className="glass rounded-3xl p-6 sm:p-8 border border-border/50 shadow-2xl">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-6 text-center">
                AI Pipeline — Live
              </p>

              {/* Nodes row */}
              <div className="flex items-start justify-between gap-2 mb-6">
                <WorkflowNode icon={Database} label="Yad2 / URL" color="hsl(220, 65%, 55%)" delay={0} />
                <div className="flex-1 relative h-14 flex items-center mt-0">
                  <div className="w-full h-0.5 bg-border/60 rounded relative overflow-hidden">
                    <FlowDot delay={0} color="hsl(var(--primary))" />
                    <FlowDot delay={0.8} color="hsl(var(--accent))" />
                  </div>
                </div>
                <WorkflowNode icon={Cpu} label="AI Parse" color="hsl(260, 60%, 55%)" delay={0.15} active />
                <div className="flex-1 relative h-14 flex items-center mt-0">
                  <div className="w-full h-0.5 bg-border/60 rounded relative overflow-hidden">
                    <FlowDot delay={0.4} color="hsl(var(--primary))" />
                    <FlowDot delay={1.2} color="hsl(38, 85%, 55%)" />
                  </div>
                </div>
                <WorkflowNode icon={BarChart3} label="Score" color="hsl(16, 65%, 52%)" delay={0.3} />
                <div className="flex-1 relative h-14 flex items-center mt-0">
                  <div className="w-full h-0.5 bg-border/60 rounded relative overflow-hidden">
                    <FlowDot delay={0.6} color="hsl(142, 60%, 45%)" />
                  </div>
                </div>
                <WorkflowNode icon={Network} label="Pipeline" color="hsl(142, 55%, 42%)" delay={0.45} />
              </div>

              {/* Live listing preview */}
              <div className="bg-muted/50 rounded-2xl p-4 ai-scan">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce-subtle" />
                  <span className="text-xs text-muted-foreground font-medium">{t("landing.scanning")}</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeListingIdx}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.35 }}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {DEMO_LISTINGS[activeListingIdx].address}
                          <span className="text-muted-foreground font-normal"> · {DEMO_LISTINGS[activeListingIdx].city}</span>
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-3 w-3" /> {DEMO_LISTINGS[activeListingIdx].rooms}
                          </span>
                          <span className="flex items-center gap-1">
                            <Maximize className="h-3 w-3" /> {DEMO_LISTINGS[activeListingIdx].sqm}m²
                          </span>
                          <span className="font-semibold text-foreground">
                            ₪{DEMO_LISTINGS[activeListingIdx].price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 text-white ${
                      DEMO_LISTINGS[activeListingIdx].score >= 90 ? "bg-score-high animate-glow" : "bg-score-medium"
                    }`}>
                      {DEMO_LISTINGS[activeListingIdx].score}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-3 gap-4 mt-8 max-w-sm mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {[
              { value: 7, suffix: "", label: t("landing.stats.stages") },
              { value: 100, suffix: "", label: t("landing.stats.score") },
              { value: 2, suffix: "", label: t("landing.stats.languages") },
            ].map((stat) => (
              <Card key={stat.label} className="p-3 text-center glass border-border/40">
                <p className="text-2xl font-display font-bold text-primary stat-number">
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-display font-bold">{t("landing.features.title")}</h2>
            <p className="text-muted-foreground mt-2">{t("landing.features.subtitle")}</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.titleKey}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 260, damping: 22 }}
              >
                <Card className="p-6 h-full card-hover shine-overlay border-border/50 group">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <f.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2">{t(f.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-display font-bold">{t("landing.howItWorks")}</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.key}
                className="text-center"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, type: "spring", stiffness: 260, damping: 22 }}
              >
                <div className="relative mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto font-display font-bold text-2xl glow-primary">
                    {step.num}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-7 start-full w-full h-0.5 bg-gradient-to-r from-primary/40 to-transparent" />
                  )}
                </div>
                <p className="font-medium text-sm leading-relaxed text-muted-foreground">{t(step.key)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 px-4 bg-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh pointer-events-none" />
        <motion.div
          className="max-w-2xl mx-auto text-center relative z-10"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="glass rounded-3xl p-10 border border-border/50 shadow-2xl">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-4 animate-bounce-subtle" />
            <h2 className="text-3xl font-display font-bold mb-4">{t("landing.cta.title")}</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">{t("landing.cta.subtitle")}</p>
            <Link to="/signup">
              <Button size="lg" className="gap-2 text-base px-10 glow-primary-lg">
                {t("landing.hero.cta")} <ChevronRight className="h-5 w-5 flip-rtl" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-foreground">{t("app.name")}</span>
          </div>
          <span>© {new Date().getFullYear()} RentelX. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
