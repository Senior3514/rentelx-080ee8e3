import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { AIChatBubble } from "@/components/AIChatBubble";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/* Map pathnames to page title keys */
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "nav.dashboard",
  "/inbox": "nav.inbox",
  "/pipeline": "nav.pipeline",
  "/watchlist": "nav.watchlist",
  "/compare": "nav.compare",
  "/relocation": "nav.relocation",
  "/profiles": "nav.profiles",
  "/knowledge-base": "nav.knowledgeBase",
  "/settings": "nav.settings",
};

export const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { direction, t } = useLanguage();

  const titleKey = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + "/")
  )?.[1];

  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full bg-background ${direction === "rtl" ? "flex-row-reverse" : "flex-row"}`}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* ── App Header ── */}
          <header className="h-13 min-h-[52px] flex items-center justify-between border-b border-border/60 px-3 shrink-0 glass sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="shrink-0" />
              {titleKey && (
                <AnimatePresence mode="wait">
                  <motion.span
                    key={location.pathname}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.18 }}
                    className="text-sm font-semibold text-foreground/70 hidden sm:block"
                  >
                    {t(titleKey)}
                  </motion.span>
                </AnimatePresence>
              )}
            </div>
            <div className="flex items-center gap-1">
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
              <ThemeToggle />
              <NotificationBell />
            </div>
          </header>

          {/* ── Page Content ── */}
          <main className="flex-1 overflow-auto p-4 md:p-6">
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
          </main>
        </div>
      </div>
      <AIChatBubble />
    </SidebarProvider>
  );
};
