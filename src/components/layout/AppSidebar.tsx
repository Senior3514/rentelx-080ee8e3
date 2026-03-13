import {
  LayoutDashboard, Inbox, Columns3, UserSearch, Settings,
  LogOut, Sparkles, BookHeart, Scale, Truck, ChevronLeft, ChevronRight, BookOpen
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  { titleKey: "nav.dashboard", url: "/dashboard", icon: LayoutDashboard, color: "text-blue-500" },
  { titleKey: "nav.inbox", url: "/inbox", icon: Inbox, color: "text-primary" },
  { titleKey: "nav.pipeline", url: "/pipeline", icon: Columns3, color: "text-violet-500" },
  { titleKey: "nav.watchlist", url: "/watchlist", icon: BookHeart, color: "text-rose-500" },
  { titleKey: "nav.compare", url: "/compare", icon: Scale, color: "text-teal-500" },
  { titleKey: "nav.relocation", url: "/relocation", icon: Truck, color: "text-orange-500" },
  { titleKey: "nav.profiles", url: "/profiles", icon: UserSearch, color: "text-indigo-500" },
  { titleKey: "nav.knowledgeBase", url: "/knowledge-base", icon: BookOpen, color: "text-amber-500" },
  { titleKey: "nav.settings", url: "/settings", icon: Settings, color: "text-muted-foreground" },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { t, direction } = useLanguage();
  const { signOut } = useAuth();

  /* ── RTL-aware collapse chevron ── */
  const CollapseIcon = collapsed
    ? (direction === "rtl" ? ChevronLeft : ChevronRight)
    : (direction === "rtl" ? ChevronRight : ChevronLeft);

  return (
    <TooltipProvider delayDuration={200}>
      <Sidebar collapsible="icon" side={direction === "rtl" ? "right" : "left"}>
        <SidebarContent>
          {/* ── Brand header ── */}
          <div className={`flex items-center gap-2 py-4 ${collapsed ? "justify-center px-2" : "px-4"}`}>
            <motion.div
              className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 glow-primary"
              whileHover={{ scale: 1.08, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Sparkles className="h-4 w-4 text-primary-foreground animate-sparkle" />
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.h2
                  className="font-display font-bold text-lg text-sidebar-foreground overflow-hidden whitespace-nowrap"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {t("app.name")}
                </motion.h2>
              )}
            </AnimatePresence>
          </div>

          {/* ── Navigation ── */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end
                              className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-150 ${
                                isActive
                                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                  : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                              }`}
                              activeClassName=""
                            >
                              {isActive && (
                                <motion.div
                                  layoutId="active-nav-pill"
                                  className="absolute inset-0 rounded-xl bg-sidebar-accent"
                                  transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                                />
                              )}
                              <item.icon className={`relative z-10 h-4 w-4 shrink-0 ${isActive ? item.color : ""}`} />
                              {!collapsed && (
                                <span className="relative z-10 text-sm">{t(item.titleKey)}</span>
                              )}
                              {isActive && !collapsed && (
                                <motion.div
                                  className={`relative z-10 ms-auto w-1.5 h-1.5 rounded-full ${item.color.replace("text-", "bg-")}`}
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500 }}
                                />
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {collapsed && (
                          <TooltipContent side={direction === "rtl" ? "left" : "right"}>
                            {t(item.titleKey)}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Footer ── */}
        <SidebarFooter>
          <div className={`flex flex-col gap-1 px-2 pb-3 ${collapsed ? "items-center" : ""}`}>
            {/* Collapse toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className={`gap-1.5 text-muted-foreground hover:text-foreground transition-colors ${collapsed ? "w-8 h-8 p-0 justify-center" : "w-full justify-start"}`}
              title={collapsed
                ? (t("app.name") + " " + "expand")
                : "Collapse sidebar"}
            >
              <CollapseIcon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <span className="text-xs font-medium">
                  {direction === "he" ? "כווץ" : "Collapse"}
                </span>
              )}
            </Button>

            {/* Logout */}
            {!collapsed ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="w-full justify-start gap-1.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="text-sm">{t("nav.logout")}</span>
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={signOut}
                    className="w-8 h-8 text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={direction === "rtl" ? "left" : "right"}>
                  {t("nav.logout")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
