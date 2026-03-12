import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { StepCities } from "./StepCities";
import { StepBudget } from "./StepBudget";
import { StepMustHaves } from "./StepMustHaves";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export interface SearchProfileDraft {
  name: string;
  cities: string[];
  minPrice: number;
  maxPrice: number;
  minRooms: number;
  maxRooms: number;
  mustHaves: string[];
  niceToHaves: string[];
}

const initialProfile: SearchProfileDraft = {
  name: "",
  cities: [],
  minPrice: 3000,
  maxPrice: 8000,
  minRooms: 1,
  maxRooms: 4,
  mustHaves: [],
  niceToHaves: [],
};

export interface OnboardingWizardProps {
  onComplete: (profile: SearchProfileDraft) => void;
  initialData?: Partial<SearchProfileDraft>;
}

export const OnboardingWizard = ({ onComplete, initialData }: OnboardingWizardProps) => {
  const { t, direction } = useLanguage();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<SearchProfileDraft>({ ...initialProfile, ...initialData });

  const isRtl = direction === "rtl";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const NextIcon = isRtl ? ArrowLeft : ArrowRight;

  const steps = [
    <StepCities key="cities" profile={profile} onChange={setProfile} />,
    <StepBudget key="budget" profile={profile} onChange={setProfile} />,
    <StepMustHaves key="musthaves" profile={profile} onChange={setProfile} />,
  ];

  const canNext = step === 0 ? profile.cities.length > 0 : true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {t("onboarding.welcome")}
          </h1>
          <p className="text-muted-foreground">{t("onboarding.subtitle")}</p>
        </motion.div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: isRtl ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 30 : -30 }}
            transition={{ duration: 0.25 }}
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-1.5"
          >
            <BackIcon className="h-4 w-4" />
            {t("onboarding.back")}
          </Button>

          {step < 2 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="gap-1.5"
            >
              {t("onboarding.next")}
              <NextIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => onComplete(profile)}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {t("onboarding.finish")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
