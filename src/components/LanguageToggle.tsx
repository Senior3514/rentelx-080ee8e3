import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === "en" ? "he" : "en")}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <Globe className="h-4 w-4" />
      {language === "en" ? "עב" : "EN"}
    </Button>
  );
};
