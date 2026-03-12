import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

const Login = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="fixed top-4 end-4 z-50 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold tracking-tight">{t("app.name")}</h1>
          <p className="text-muted-foreground mt-1">{t("app.tagline")}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t("auth.email")}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t("auth.password")}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {t("auth.login")}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">{t("auth.or")}</span></div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            const { error } = await supabase.auth.signInAnonymously();
            setLoading(false);
            if (error) {
              toast.error(error.message);
            } else {
              navigate("/");
            }
          }}
        >
          {t("auth.guestLogin")}
        </Button>

        <div className="text-center text-sm space-y-2">
          <Link to="/reset-password" className="text-primary hover:underline block">
            {t("auth.forgotPassword")}
          </Link>
          <p className="text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link to="/signup" className="text-primary hover:underline">{t("auth.signup")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
