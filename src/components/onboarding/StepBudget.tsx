import { useLanguage } from "@/i18n/LanguageContext";
import { Slider } from "@/components/ui/slider";
import type { SearchProfileDraft } from "./OnboardingWizard";
import { Input } from "@/components/ui/input";

interface StepBudgetProps {
  profile: SearchProfileDraft;
  onChange: (p: SearchProfileDraft) => void;
}

export const StepBudget = ({ profile, onChange }: StepBudgetProps) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">{t("onboarding.step2.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("onboarding.step2.subtitle")}</p>
      </div>

      {/* Price range */}
      <div>
        <label className="text-sm font-medium mb-3 block">{t("onboarding.step2.priceRange")}</label>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <span className="text-xs text-muted-foreground">{t("onboarding.step2.minPrice")}</span>
            <Input
              type="number"
              value={profile.minPrice}
              onChange={(e) => onChange({ ...profile, minPrice: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
          <span className="text-muted-foreground mt-5">–</span>
          <div className="flex-1">
            <span className="text-xs text-muted-foreground">{t("onboarding.step2.maxPrice")}</span>
            <Input
              type="number"
              value={profile.maxPrice}
              onChange={(e) => onChange({ ...profile, maxPrice: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
        </div>
        <Slider
          value={[profile.minPrice, profile.maxPrice]}
          min={1000}
          max={20000}
          step={500}
          onValueChange={([min, max]) => onChange({ ...profile, minPrice: min, maxPrice: max })}
          className="mt-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>₪1,000</span>
          <span>₪20,000</span>
        </div>
      </div>

      {/* Rooms */}
      <div>
        <label className="text-sm font-medium mb-3 block">{t("onboarding.step2.rooms")}</label>
        <div className="flex gap-2">
          {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6].map((r) => {
            const inRange = r >= profile.minRooms && r <= profile.maxRooms;
            return (
              <button
                key={r}
                onClick={() => {
                  if (inRange && profile.minRooms === r && profile.maxRooms === r) return;
                  if (r < profile.minRooms) onChange({ ...profile, minRooms: r });
                  else if (r > profile.maxRooms) onChange({ ...profile, maxRooms: r });
                  else if (r === profile.minRooms) onChange({ ...profile, minRooms: r + 0.5 > profile.maxRooms ? r : r });
                  else onChange({ ...profile, minRooms: r, maxRooms: r });
                }}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all border ${
                  inRange
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {profile.minRooms === profile.maxRooms
            ? `${profile.minRooms} ${t("common.rooms")}`
            : `${profile.minRooms}–${profile.maxRooms} ${t("common.rooms")}`}
        </p>
      </div>
    </div>
  );
};
