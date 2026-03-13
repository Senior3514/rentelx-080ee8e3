import { LayoutDashboard, Inbox, Columns3, UserSearch, Settings, LogOut, Sparkles, BookHeart, Scale, Truck, Book } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { titleKey: "nav.dashboard", url: "/dashboard", icon: LayoutDashboard },
  { titleKey: "nav.inbox", url: "/inbox", icon: Inbox },
  { titleKey: "nav.pipeline", url: "/pipeline", icon: Columns3 },
  { titleKey: "nav.watchlist", url: "/watchlist", icon: BookHeart },
  { titleKey: "nav.compare", url: "/compare", icon: Scale },
  { titleKey: "nav.relocation", url: "/relocation", icon: Truck },
  { titleKey: "nav.knowledgeBase", url: "/knowledge-base", icon: Book },
  { titleKey: "nav.profiles", url: "/profiles", icon: UserSearch },
  { titleKey: "nav.settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { t, direction } = useLanguage();
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" side={direction === "rtl" ? "right" : "left"}>
      <SidebarContent>
        {!collapsed && (
          <div className="px-4 py-4">
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: direction === "rtl" ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
              </div>
              <h2 className="font-display font-bold text-lg text-sidebar-foreground">{t("app.name")}</h2>
            </motion.div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center py-3">
            <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>{collapsed ? "" : t("app.name")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="relative hover:bg-sidebar-accent/50 transition-colors duration-150"
                        activeClassName="text-sidebar-primary font-medium"
                      >
                        {isActive && (
                          <motion.div
                            layoutId="active-nav"
                            className="absolute inset-0 bg-sidebar-accent rounded-md"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                          />
                        )}
                        <item.icon className="relative z-10 me-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span className="relative z-10">{t(item.titleKey)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-1 px-2 pb-2">
          <LanguageToggle />
          <ThemeToggle />
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="ms-auto text-muted-foreground hover:text-destructive gap-1 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t("nav.logout")}
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
