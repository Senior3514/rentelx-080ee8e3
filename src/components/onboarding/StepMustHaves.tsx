import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import type { SearchProfileDraft } from "./OnboardingWizard";
import {
  Car, ArrowUpFromLine, Sun, PawPrint,
  Wind, Package, Sofa, Accessibility,
} from "lucide-react";

interface StepMustHavesProps {
  profile: SearchProfileDraft;
  onChange: (p: SearchProfileDraft) => void;
}

const amenities = [
  { id: "parking", icon: Car, key: "onboarding.step3.parking" },
  { id: "elevator", icon: ArrowUpFromLine, key: "onboarding.step3.elevator" },
  { id: "balcony", icon: Sun, key: "onboarding.step3.balcony" },
  { id: "pets", icon: PawPrint, key: "onboarding.step3.petsAllowed" },
  { id: "ac", icon: Wind, key: "onboarding.step3.airConditioning" },
  { id: "storage", icon: Package, key: "onboarding.step3.storage" },
  { id: "furnished", icon: Sofa, key: "onboarding.step3.furnished" },
  { id: "accessible", icon: Accessibility, key: "onboarding.step3.accessible" },
];

type AmenityState = "none" | "must" | "nice";

export const StepMustHaves = ({ profile, onChange }: StepMustHavesProps) => {
  const { t } = useLanguage();

  const getState = (id: string): AmenityState => {
    if (profile.mustHaves.includes(id)) return "must";
    if (profile.niceToHaves.includes(id)) return "nice";
    return "none";
  };

  const cycle = (id: string) => {
    const state = getState(id);
    let mustHaves = profile.mustHaves.filter((x) => x !== id);
    let niceToHaves = profile.niceToHaves.filter((x) => x !== id);

    if (state === "none") mustHaves = [...mustHaves, id];
    else if (state === "must") niceToHaves = [...niceToHaves, id];
    // "nice" → "none" (already filtered out)

    onChange({ ...profile, mustHaves, niceToHaves });
  };

  const stateStyles: Record<AmenityState, string> = {
    none: "border-border bg-card text-muted-foreground hover:border-primary/40",
    must: "border-primary bg-primary/15 text-foreground ring-1 ring-primary/20",
    nice: "border-accent bg-accent/15 text-foreground ring-1 ring-accent/20",
  };

  const stateLabel: Record<AmenityState, string> = {
    none: "",
    must: t("onboarding.step3.mustHave"),
    nice: t("onboarding.step3.niceToHave"),
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">{t("onboarding.step3.title")}</h2>
      <p className="text-sm text-muted-foreground mb-2">{t("onboarding.step3.subtitle")}</p>
      <p className="text-xs text-muted-foreground mb-6">
        Tap once = {t("onboarding.step3.mustHave")} · Tap again = {t("onboarding.step3.niceToHave")} · Tap again = off
      </p>

      {/* Profile name */}
      <div className="mb-6">
        <label className="text-sm font-medium mb-1.5 block">{t("onboarding.profileName")}</label>
        <Input
          value={profile.name}
          onChange={(e) => onChange({ ...profile, name: e.target.value })}
          placeholder={t("onboarding.profileNamePlaceholder")}
        />
      </div>

      {/* Amenity grid */}
      <div className="grid grid-cols-2 gap-3">
        {amenities.map(({ id, icon: Icon, key }) => {
          const state = getState(id);
          return (
            <button
              key={id}
              onClick={() => cycle(id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${stateStyles[state]}`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-sm font-medium">{t(key)}</span>
              {state !== "none" && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  state === "must" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                }`}>
                  {stateLabel[state]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
