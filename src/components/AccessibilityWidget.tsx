import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Accessibility,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  MousePointer2,
  Type,
  Contrast,
  Pause,
} from "lucide-react";

const STORAGE_KEY = "rentelx-a11y";

interface A11ySettings {
  fontSize: number; // 0 = normal, 1 = large, 2 = x-large
  highContrast: boolean;
  focusHighlight: boolean;
  reducedMotion: boolean;
  largePointer: boolean;
  lineHeight: boolean;
}

const DEFAULTS: A11ySettings = {
  fontSize: 0,
  highContrast: false,
  focusHighlight: false,
  reducedMotion: false,
  largePointer: false,
  lineHeight: false,
};

function loadSettings(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

function saveSettings(s: A11ySettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export const AccessibilityWidget = () => {
  const { language } = useLanguage();
  const isHe = language === "he";
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(loadSettings);

  const apply = useCallback((s: A11ySettings) => {
    const root = document.documentElement;

    // Font size
    root.classList.remove("a11y-font-lg", "a11y-font-xl");
    if (s.fontSize === 1) root.classList.add("a11y-font-lg");
    if (s.fontSize === 2) root.classList.add("a11y-font-xl");

    // High contrast
    root.classList.toggle("a11y-high-contrast", s.highContrast);

    // Focus highlight
    root.classList.toggle("a11y-focus-highlight", s.focusHighlight);

    // Reduced motion
    root.classList.toggle("a11y-reduced-motion", s.reducedMotion);

    // Large pointer
    root.classList.toggle("a11y-large-pointer", s.largePointer);

    // Line height
    root.classList.toggle("a11y-line-height", s.lineHeight);
  }, []);

  useEffect(() => {
    apply(settings);
    saveSettings(settings);
  }, [settings, apply]);

  // Apply on mount
  useEffect(() => {
    apply(loadSettings());
  }, [apply]);

  const update = (patch: Partial<A11ySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const reset = () => {
    setSettings({ ...DEFAULTS });
  };

  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULTS);

  const features = [
    {
      icon: <ZoomIn className="h-4 w-4" />,
      label: isHe ? "הגדל טקסט" : "Increase Text",
      active: settings.fontSize > 0,
      action: () => update({ fontSize: Math.min(2, settings.fontSize + 1) }),
    },
    {
      icon: <ZoomOut className="h-4 w-4" />,
      label: isHe ? "הקטן טקסט" : "Decrease Text",
      active: false,
      action: () => update({ fontSize: Math.max(0, settings.fontSize - 1) }),
    },
    {
      icon: <Contrast className="h-4 w-4" />,
      label: isHe ? "ניגודיות גבוהה" : "High Contrast",
      active: settings.highContrast,
      action: () => update({ highContrast: !settings.highContrast }),
    },
    {
      icon: <Eye className="h-4 w-4" />,
      label: isHe ? "הדגשת מיקוד" : "Focus Highlight",
      active: settings.focusHighlight,
      action: () => update({ focusHighlight: !settings.focusHighlight }),
    },
    {
      icon: <Pause className="h-4 w-4" />,
      label: isHe ? "הפחת אנימציה" : "Reduce Motion",
      active: settings.reducedMotion,
      action: () => update({ reducedMotion: !settings.reducedMotion }),
    },
    {
      icon: <MousePointer2 className="h-4 w-4" />,
      label: isHe ? "סמן גדול" : "Large Cursor",
      active: settings.largePointer,
      action: () => update({ largePointer: !settings.largePointer }),
    },
    {
      icon: <Type className="h-4 w-4" />,
      label: isHe ? "ריווח שורות" : "Line Spacing",
      active: settings.lineHeight,
      action: () => update({ lineHeight: !settings.lineHeight }),
    },
  ];

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-24 end-4 z-50 w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isHe ? "נגישות" : "Accessibility"}
        title={isHe ? "נגישות" : "Accessibility"}
      >
        <Accessibility className="h-6 w-6" />
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 sm:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-24 end-4 z-50 w-72 sm:w-80 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
              role="dialog"
              aria-label={isHe ? "הגדרות נגישות" : "Accessibility Settings"}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Accessibility className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-sm">
                    {isHe ? "נגישות" : "Accessibility"}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  {!isDefault && (
                    <button
                      onClick={reset}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors flex items-center gap-1"
                      title={isHe ? "אפס הכל" : "Reset All"}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {isHe ? "אפס" : "Reset"}
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                    aria-label={isHe ? "סגור" : "Close"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Feature buttons */}
              <div className="p-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
                {features.map((feat, i) => (
                  <button
                    key={i}
                    onClick={feat.action}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                      feat.active
                        ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium"
                        : "hover:bg-muted/80 border border-transparent"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        feat.active
                          ? "bg-blue-600 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {feat.icon}
                    </div>
                    <span>{feat.label}</span>
                    {feat.active && (
                      <span className="ms-auto w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </button>
                ))}
              </div>

              {/* Font size indicator */}
              {settings.fontSize > 0 && (
                <div className="px-4 py-2 border-t border-border/60 bg-muted/20">
                  <p className="text-xs text-muted-foreground text-center">
                    {isHe ? "גודל טקסט" : "Text size"}: {settings.fontSize === 1 ? (isHe ? "גדול" : "Large") : (isHe ? "גדול מאוד" : "X-Large")}
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
