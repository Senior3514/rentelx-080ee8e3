import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from "@/components/ui/command";
import {
  LayoutDashboard, Inbox, Columns3, BookHeart, GitCompare,
  Truck, UserCircle, BookOpen, Settings, Plus, Zap, FileDown,
  Search
} from "lucide-react";

const PAGES = [
  { path: "/dashboard", icon: LayoutDashboard, labelEn: "Dashboard", labelHe: "לוח בקרה", keywordsHe: "ראשי בית", keywordsEn: "home main" },
  { path: "/inbox", icon: Inbox, labelEn: "Listings Library", labelHe: "ספריית דירות", keywordsHe: "דירות רשימה", keywordsEn: "apartments list" },
  { path: "/pipeline", icon: Columns3, labelEn: "Pipeline", labelHe: "תהליך", keywordsHe: "קנבן שלבים", keywordsEn: "kanban stages" },
  { path: "/watchlist", icon: BookHeart, labelEn: "Watchlist", labelHe: "מעקב", keywordsHe: "סריקה יד2 חיפוש", keywordsEn: "scan yad2 search" },
  { path: "/compare", icon: GitCompare, labelEn: "Compare", labelHe: "השוואה", keywordsHe: "השוואת דירות", keywordsEn: "compare listings" },
  { path: "/relocation", icon: Truck, labelEn: "Relocation", labelHe: "מעבר דירה", keywordsHe: "מעבר ארגזים", keywordsEn: "move boxes" },
  { path: "/profiles", icon: UserCircle, labelEn: "Search Profiles", labelHe: "פרופילים", keywordsHe: "פרופיל חיפוש", keywordsEn: "profile search" },
  { path: "/knowledge-base", icon: BookOpen, labelEn: "Knowledge Base", labelHe: "מאגר ידע", keywordsHe: "מדריך עזרה", keywordsEn: "guide help" },
  { path: "/settings", icon: Settings, labelEn: "Settings", labelHe: "הגדרות", keywordsHe: "הגדרות שפה ערכת נושא", keywordsEn: "settings language theme" },
];

const ACTIONS = [
  { id: "add-listing", icon: Plus, labelEn: "Add Listing", labelHe: "הוסף דירה", keywordsHe: "חדש קישור", keywordsEn: "new link url" },
  { id: "scan-yad2", icon: Zap, labelEn: "Scan Yad2", labelHe: "סרוק יד2", keywordsHe: "סריקה חיפוש", keywordsEn: "scan search" },
  { id: "export-csv", icon: FileDown, labelEn: "Export CSV", labelHe: "ייצוא CSV", keywordsHe: "ייצוא הורדה", keywordsEn: "export download" },
];

// Shortcut hints for pages (G+key chord)
const PAGE_SHORTCUTS: Record<string, string> = {
  "/dashboard": "G → D",
  "/inbox": "G → I",
  "/watchlist": "G → W",
  "/pipeline": "G → P",
  "/settings": "G → S",
  "/compare": "G → C",
  "/relocation": "G → R",
};

/** Detect if running on macOS for keyboard shortcut display */
function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

interface GlobalSearchProps {
  onAction?: (actionId: string) => void;
}

export const GlobalSearch = ({ onAction }: GlobalSearchProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { language } = useLanguage();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback((value: string) => {
    setOpen(false);
    if (value.startsWith("/")) {
      navigate(value);
    } else {
      onAction?.(value);
    }
  }, [navigate, onAction]);

  const isHe = language === "he";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-xs">
          {isHe ? "חיפוש..." : "Search..."}
        </span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          {isMac() ? "⌘K" : "Ctrl+K"}
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={isHe ? "חפש דפים, פעולות..." : "Search pages, actions..."} />
        <CommandList>
          <CommandEmpty>
            {isHe ? "לא נמצאו תוצאות" : "No results found."}
          </CommandEmpty>
          <CommandGroup heading={isHe ? "דפים" : "Pages"}>
            {PAGES.map((page) => (
              <CommandItem
                key={page.path}
                value={`${page.labelEn} ${page.labelHe} ${page.keywordsEn} ${page.keywordsHe}`}
                onSelect={() => handleSelect(page.path)}
                className="gap-2"
              >
                <page.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{isHe ? page.labelHe : page.labelEn}</span>
                {PAGE_SHORTCUTS[page.path] && (
                  <kbd className="text-[10px] text-muted-foreground/60 font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                    {PAGE_SHORTCUTS[page.path]}
                  </kbd>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={isHe ? "פעולות מהירות" : "Quick Actions"}>
            {ACTIONS.map((action) => (
              <CommandItem
                key={action.id}
                value={`${action.labelEn} ${action.labelHe} ${action.keywordsEn} ${action.keywordsHe}`}
                onSelect={() => handleSelect(action.id)}
                className="gap-2"
              >
                <action.icon className="h-4 w-4 text-primary" />
                <span>{isHe ? action.labelHe : action.labelEn}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};
