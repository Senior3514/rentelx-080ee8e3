import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { AIChatBubble } from "@/components/AIChatBubble";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DeviceViewSelector, useDeviceView } from "@/components/DeviceViewSelector";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";

/* Map pathnames to page title keys */
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "nav.dashboard",
  "/inbox": "nav.inbox",
  "/pipeline": "nav.pipeline",
  "/scan": "nav.scan",
  "/watchlist": "nav.watchlist",
  "/compare": "nav.compare",
  "/relocation": "nav.relocation",
  "/profiles": "nav.profiles",
  "/knowledge-base": "nav.knowledgeBase",
  "/settings": "nav.settings",
};

const DEVICE_WIDTHS: Record<string, string> = {
  desktop: "100%",
  tablet: "768px",
  phone: "375px",
};

export const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { deviceView } = useDeviceView();

  // Keyboard shortcuts: Shift+D (dashboard), Shift+I (inbox), Shift+W (watchlist), Shift+P (pipeline), Shift+S (settings), Shift+C (compare), Shift+R (relocation)
  useEffect(() => {
    const SHORTCUTS: Record<string, string> = {
      D: "/dashboard",
      I: "/inbox",
      W: "/watchlist",
      P: "/pipeline",
      S: "/settings",
      C: "/compare",
      R: "/relocation",
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      // Only handle Shift+Key (without Ctrl/Meta)
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const route = SHORTCUTS[e.key];
        if (route) {
          e.preventDefault();
          navigate(route);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); };
  }, [navigate]);

  const titleKey = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + "/")
  )?.[1];

  const isDevicePreview = deviceView !== "desktop";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* ── App Header ── */}
          <header className="h-13 min-h-[52px] flex items-center justify-between border-b border-border/60 px-3 shrink-0 glass sticky top-0 z-30">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="shrink-0" />
              {titleKey && (
                <AnimatePresence mode="wait">
                  <motion.span
                    key={location.pathname}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.18 }}
                    className="text-sm font-semibold text-foreground/70 hidden sm:block truncate"
                  >
                    {t(titleKey)}
                  </motion.span>
                </AnimatePresence>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <GlobalSearch />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                title={t("nav.home")}
              >
                <Home className="h-4 w-4" />
              </Button>
              <LanguageToggle />
              <DeviceViewSelector />
              <ThemeToggle />
              <NotificationBell />
            </div>
          </header>

          {/* ── Page Content ── */}
          <main className="flex-1 overflow-auto overflow-x-hidden">
            <div
              className={`mx-auto transition-all duration-300 ease-in-out p-3 sm:p-4 md:p-6 ${isDevicePreview ? "border-x border-border/40 shadow-inner min-h-full" : ""}`}
              style={{
                maxWidth: isDevicePreview ? DEVICE_WIDTHS[deviceView] : undefined,
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
      <AIChatBubble />
    </SidebarProvider>
  );
};
