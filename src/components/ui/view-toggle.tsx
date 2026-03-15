import { LayoutGrid, List } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  className?: string;
}

export const ViewToggle = ({ viewMode, onViewModeChange, className }: ViewToggleProps) => {
  const { language } = useLanguage();

  return (
    <div className={cn(
      "inline-flex items-center bg-muted/60 border border-border/50 rounded-lg p-[3px] gap-0.5",
      className,
    )}>
      <button
        onClick={() => onViewModeChange("list")}
        className={cn(
          "p-1.5 rounded-md transition-all duration-200",
          viewMode === "list"
            ? "bg-background shadow-sm text-primary border border-border/40"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
        )}
        title={language === "he" ? "תצוגת רשימה" : "List view"}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onViewModeChange("grid")}
        className={cn(
          "p-1.5 rounded-md transition-all duration-200",
          viewMode === "grid"
            ? "bg-background shadow-sm text-primary border border-border/40"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
        )}
        title={language === "he" ? "תצוגת כרטיסים" : "Grid view"}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
