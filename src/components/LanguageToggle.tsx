import { useLanguage, Language } from "@/i18n/LanguageContext";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGUAGES: { code: Language; label: string; flag: string; nativeLabel: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧", nativeLabel: "EN" },
  { code: "he", label: "עברית", flag: "🇮🇱", nativeLabel: "עב" },
  { code: "es", label: "Español", flag: "🇪🇸", nativeLabel: "ES" },
  { code: "ru", label: "Русский", flag: "🇷🇺", nativeLabel: "РУ" },
];

export const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground min-w-[60px]"
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{current.flag} {current.nativeLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{lang.flag}</span>
              <span className="text-sm">{lang.label}</span>
            </span>
            {language === lang.code && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
