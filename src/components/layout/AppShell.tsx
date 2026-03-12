import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useLanguage } from "@/i18n/LanguageContext";

export const AppShell = () => {
  const location = useLocation();
  const { direction } = useLanguage();

  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full ${direction === "rtl" ? "flex-row-reverse" : "flex-row"}`}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border px-2 shrink-0">
            <SidebarTrigger className="ms-1" />
          </header>
          <main
            key={location.pathname}
            className="flex-1 overflow-auto p-4 md:p-6 animate-fade-up"
            style={{ animationDuration: "0.25s" }}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
