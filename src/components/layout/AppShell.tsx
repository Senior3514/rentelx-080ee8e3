import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { AIChatBubble } from "@/components/AIChatBubble";

export const AppShell = () => {
  const location = useLocation();
  const { direction } = useLanguage();

  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full bg-background ${direction === "rtl" ? "flex-row-reverse" : "flex-row"}`}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border/60 px-2 shrink-0 glass">
            <SidebarTrigger className="ms-1" />
          </header>
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
