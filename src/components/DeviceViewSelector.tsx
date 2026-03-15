import { useState, useEffect, createContext, useContext } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/i18n/LanguageContext";

export type DeviceView = "desktop" | "tablet" | "phone";

interface DeviceViewContextType {
  deviceView: DeviceView;
  setDeviceView: (view: DeviceView) => void;
}

const DeviceViewContext = createContext<DeviceViewContextType>({
  deviceView: "desktop",
  setDeviceView: () => {},
});

export function useDeviceView() {
  return useContext(DeviceViewContext);
}

export function DeviceViewProvider({ children }: { children: React.ReactNode }) {
  const [deviceView, setDeviceView] = useState<DeviceView>(() => {
    return (localStorage.getItem("rentelx-device-view") as DeviceView) || "desktop";
  });

  useEffect(() => {
    localStorage.setItem("rentelx-device-view", deviceView);
  }, [deviceView]);

  return (
    <DeviceViewContext.Provider value={{ deviceView, setDeviceView }}>
      {children}
    </DeviceViewContext.Provider>
  );
}

const VIEWS: { value: DeviceView; icon: typeof Monitor; labelEn: string; labelHe: string; width: string }[] = [
  { value: "desktop", icon: Monitor, labelEn: "Desktop", labelHe: "מחשב", width: "100%" },
  { value: "tablet", icon: Tablet, labelEn: "Tablet", labelHe: "טאבלט", width: "768px" },
  { value: "phone", icon: Smartphone, labelEn: "Phone", labelHe: "טלפון", width: "375px" },
];

export const DeviceViewSelector = () => {
  const { deviceView, setDeviceView } = useDeviceView();
  const { language } = useLanguage();
  const current = VIEWS.find((v) => v.value === deviceView) ?? VIEWS[0];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title={language === "he" ? "תצוגת מכשיר" : "Device View"}
        >
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {VIEWS.map((view) => (
          <DropdownMenuItem
            key={view.value}
            onClick={() => setDeviceView(view.value)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <view.icon className={`h-4 w-4 ${deviceView === view.value ? "text-primary" : ""}`} />
            <span className={`text-sm ${deviceView === view.value ? "font-semibold text-primary" : ""}`}>
              {language === "he" ? view.labelHe : view.labelEn}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
