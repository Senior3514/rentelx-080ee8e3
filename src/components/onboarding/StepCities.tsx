import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { israelCities, type City } from "@/data/israelCities";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import type { SearchProfileDraft } from "./OnboardingWizard";

interface StepCitiesProps {
  profile: SearchProfileDraft;
  onChange: (p: SearchProfileDraft) => void;
}

export const StepCities = ({ profile, onChange }: StepCitiesProps) => {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");

  const filtered = israelCities.filter((c) => {
    const name = language === "he" ? c.nameHe : c.nameEn;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const toggle = (cityId: string) => {
    const cities = profile.cities.includes(cityId)
      ? profile.cities.filter((c) => c !== cityId)
      : [...profile.cities, cityId];
    onChange({ ...profile, cities });
  };

  const getName = (c: City) => (language === "he" ? c.nameHe : c.nameEn);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">{t("onboarding.step1.title")}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t("onboarding.step1.subtitle")}</p>

      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("onboarding.step1.searchPlaceholder")}
          className="ps-9"
        />
      </div>

      {/* Selected chips */}
      {profile.cities.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {profile.cities.map((id) => {
            const city = israelCities.find((c) => c.id === id);
            if (!city) return null;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium transition-transform hover:scale-105"
              >
                {getName(city)}
                <X className="h-3 w-3" />
              </button>
            );
          })}
        </div>
      )}

      {/* City grid */}
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {filtered.map((city) => {
          const selected = profile.cities.includes(city.id);
          return (
            <button
              key={city.id}
              onClick={() => toggle(city.id)}
              className={`px-4 py-3 rounded-lg text-sm font-medium text-start transition-all border ${
                selected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              }`}
            >
              {getName(city)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
