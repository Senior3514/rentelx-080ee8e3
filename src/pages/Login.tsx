import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { LogIn, Sparkles, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { checkRateLimit, formatBlockTime } from "@/lib/rateLimit";
import { safeRedirectPath } from "@/lib/sanitize";

const Login = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [blockMsg, setBlockMsg] = useState("");

  const safeFrom = safeRedirectPath(
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? "",
    "/dashboard"
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockMsg("");
    const { allowed, remainingMs } = checkRateLimit(`login:${email}`);
    if (!allowed) {
      setBlockMsg(`Too many attempts. Try again in ${formatBlockTime(remainingMs)}.`);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(t("auth.invalidCredentials") || "Invalid email or password");
    } else {
      navigate(safeFrom, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh pointer-events-none" />
      <div className="absolute top-1/3 start-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none animate-pulse-soft" />

      <div className="fixed top-4 end-4 z-50 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <motion.div
        className="w-full max-w-sm space-y-6 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-gradient">{t("app.name")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("app.tagline")}</p>
        </div>

        {blockMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {blockMsg}
          </div>
        )}

        <div className="glass rounded-2xl p-6 space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("auth.email")}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                required
                autoComplete="email"
                maxLength={254}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("auth.password")}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                maxLength={128}
              />
            </div>
            <Button type="submit" className="w-full gap-2 glow-primary" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "..." : t("auth.login")}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-muted-foreground">{t("auth.or")}</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={async () => {
              const { allowed, remainingMs } = checkRateLimit("guest-login");
              if (!allowed) {
                setBlockMsg(`Too many attempts. Try again in ${formatBlockTime(remainingMs)}.`);
                return;
              }
              setLoading(true);
              const { error } = await supabase.auth.signInAnonymously();
              setLoading(false);
              if (error) toast.error(error.message);
              else navigate("/onboarding");
            }}
          >
            {t("auth.guestLogin")}
          </Button>
        </div>

        <div className="text-center text-sm space-y-2">
          <Link to="/reset-password" className="text-primary hover:underline block">
            {t("auth.forgotPassword")}
          </Link>
          <p className="text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link to="/signup" className="text-primary hover:underline">{t("auth.signup")}</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
