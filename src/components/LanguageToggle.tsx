import { useLanguage, Language } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const LANG_CYCLE: Language[] = ["en", "he", "es"];
const LANG_LABEL: Record<Language, string> = { en: "EN", he: "עב", es: "ES" };

export const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();

  const nextLang = () => {
    const idx = LANG_CYCLE.indexOf(language);
    return LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(nextLang())}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <Globe className="h-4 w-4" />
      {LANG_LABEL[language]}
    </Button>
  );
};
