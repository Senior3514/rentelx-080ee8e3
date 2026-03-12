import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Search, Zap, Columns3, Brain, Shield, Globe,
  ArrowRight, CheckCircle2, Star, MapPin
} from "lucide-react";

const Landing = () => {
  const { t } = useLanguage();

  const features = [
    { icon: Search, titleKey: "landing.features.aggregate.title", descKey: "landing.features.aggregate.desc" },
    { icon: Brain, titleKey: "landing.features.score.title", descKey: "landing.features.score.desc" },
    { icon: Columns3, titleKey: "landing.features.pipeline.title", descKey: "landing.features.pipeline.desc" },
    { icon: Zap, titleKey: "landing.features.alerts.title", descKey: "landing.features.alerts.desc" },
    { icon: Globe, titleKey: "landing.features.bilingual.title", descKey: "landing.features.bilingual.desc" },
    { icon: Shield, titleKey: "landing.features.privacy.title", descKey: "landing.features.privacy.desc" },
  ];

  const steps = [
    { num: "1", key: "landing.steps.profile" },
    { num: "2", key: "landing.steps.add" },
    { num: "3", key: "landing.steps.score" },
    { num: "4", key: "landing.steps.manage" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="font-display font-bold text-xl text-primary">
            {t("app.name")}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm">{t("auth.login")}</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">{t("auth.signup")}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-6">
              <Star className="h-3 w-3" /> {t("landing.badge")}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-tight">
              {t("landing.hero.title")}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto">
              {t("landing.hero.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <Link to="/signup">
                <Button size="lg" className="gap-2 text-base px-8">
                  {t("landing.hero.cta")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="text-base px-8">
                  {t("auth.login")}
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Floating stats */}
          <motion.div
            className="grid grid-cols-3 gap-4 mt-16 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {[
              { value: "7", label: t("landing.stats.stages") },
              { value: "100", label: t("landing.stats.score") },
              { value: "2", label: t("landing.stats.languages") },
            ].map((stat) => (
              <Card key={stat.label} className="p-4 text-center bg-card/50 backdrop-blur-sm border-border/50">
                <p className="text-2xl font-display font-bold text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold">{t("landing.features.title")}</h2>
            <p className="text-muted-foreground mt-2">{t("landing.features.subtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.titleKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 h-full hover:shadow-lg transition-shadow border-border/50">
                  <f.icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-2">{t(f.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground">{t(f.descKey)}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold">{t("landing.howItWorks")}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.key}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto font-display font-bold text-xl mb-4">
                  {step.num}
                </div>
                <p className="font-medium text-sm">{t(step.key)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-display font-bold mb-4">{t("landing.cta.title")}</h2>
          <p className="text-muted-foreground mb-8">{t("landing.cta.subtitle")}</p>
          <Link to="/signup">
            <Button size="lg" className="gap-2 text-base px-8">
              {t("landing.hero.cta")} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-display font-semibold text-foreground">{t("app.name")}</span>
          <span>© {new Date().getFullYear()} RentelX</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
