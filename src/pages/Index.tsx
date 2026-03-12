import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingWizard, type SearchProfileDraft } from "@/components/onboarding/OnboardingWizard";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.onboarded) navigate("/inbox");
      });
  }, [user, navigate]);

  const handleComplete = async (profile: SearchProfileDraft) => {
    if (!user) return;
    try {
      await supabase.from("search_profiles").insert({
        user_id: user.id,
        name: profile.name || "My First Profile",
        cities: profile.cities,
        min_price: profile.minPrice,
        max_price: profile.maxPrice,
        min_rooms: profile.minRooms,
        max_rooms: profile.maxRooms,
        must_haves: profile.mustHaves,
        nice_to_haves: profile.niceToHaves,
      });

      await supabase
        .from("profiles")
        .update({ onboarded: true })
        .eq("id", user.id);

      toast.success("Profile created! Let's find your home.");
      navigate("/inbox");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="fixed top-4 end-4 z-50 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <OnboardingWizard onComplete={handleComplete} />
    </div>
  );
};

export default Index;
