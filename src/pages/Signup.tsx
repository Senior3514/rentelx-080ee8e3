import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { UserPlus, Sparkles, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { motion } from "framer-motion";
import { checkRateLimit, formatBlockTime } from "@/lib/rateLimit";

const passwordSchema = z.string().min(8, "Min 8 characters").regex(/\d/, "Must contain at least one number");

const Signup = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [blockMsg, setBlockMsg] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockMsg("");

    const { allowed, remainingMs } = checkRateLimit(`signup:${email}`);
    if (!allowed) {
      setBlockMsg(`Too many attempts. Try again in ${formatBlockTime(remainingMs)}.`);
      return;
    }

    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      setPasswordError(result.error.errors[0].message);
      return;
    }
    setPasswordError("");

    if (password !== confirmPassword) {
      toast.error(t("auth.passwordsMismatch"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.checkEmail"));
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh pointer-events-none" />

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
          <p className="text-muted-foreground mt-1 text-sm">{t("auth.signup")}</p>
        </div>

        {blockMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {blockMsg}
          </div>
        )}

        <div className="glass rounded-2xl p-6">
          <form onSubmit={handleSignup} className="space-y-4">
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
                onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
              {passwordError && <p className="text-xs text-destructive mt-1">{passwordError}</p>}
              <p className="text-xs text-muted-foreground mt-1">{t("auth.passwordRequirements")}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("auth.confirmPassword")}</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full gap-2 glow-primary" disabled={loading}>
              <UserPlus className="h-4 w-4" />
              {loading ? "..." : t("auth.signup")}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.hasAccount")}{" "}
          <Link to="/login" className="text-primary hover:underline">{t("auth.login")}</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Signup;
