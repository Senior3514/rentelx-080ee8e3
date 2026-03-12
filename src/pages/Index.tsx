import { OnboardingWizard, type SearchProfileDraft } from "@/components/onboarding/OnboardingWizard";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const Index = () => {
  const { t } = useLanguage();

  const handleComplete = (profile: SearchProfileDraft) => {
    console.log("Profile created:", profile);
    toast.success(t("app.name"), {
      description: `Profile "${profile.name || "Untitled"}" created with ${profile.cities.length} cities`,
    });
  };

  return (
    <div className="relative">
      {/* Top bar with toggles */}
      <div className="fixed top-4 end-4 z-50 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <OnboardingWizard onComplete={handleComplete} />
    </div>
  );
};

export default Index;
