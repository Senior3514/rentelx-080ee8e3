import { LayoutDashboard, Inbox, Columns3, UserSearch, Settings, LogOut, Sparkles } from "lucide-react";
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
  { titleKey: "nav.profiles", url: "/profiles", icon: UserSearch },
  { titleKey: "nav.settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { t } = useLanguage();
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {!collapsed && (
          <div className="px-4 py-4">
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
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
              {navItems.map((item, i) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/60 transition-colors duration-150"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="me-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
