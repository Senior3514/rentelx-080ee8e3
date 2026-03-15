import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OnboardingWizard, SearchProfileDraft } from "@/components/onboarding/OnboardingWizard";
import { Plus, Trash2, MapPin, Pencil, Search, Briefcase, Sparkles, Navigation, Home, CheckCircle2, Circle } from "lucide-react";
import { cityDisplayName, amenityDisplayName } from "@/lib/cityMap";
import { toast } from "sonner";
import { scoreListing } from "@/lib/scoring";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MAX_PROFILES = 6;

const Profiles = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["search_profiles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) {
        // If the error is about missing columns, try selecting only known columns
        if (error.message?.includes("schema cache")) {
          const { data: fallback, error: fallbackErr } = await supabase
            .from("search_profiles")
            .select("id, user_id, name, cities, min_price, max_price, min_rooms, max_rooms, must_haves, nice_to_haves, is_active, created_at, updated_at")
            .eq("user_id", user!.id)
            .order("is_active", { ascending: false })
            .order("created_at", { ascending: false });
          if (fallbackErr) throw fallbackErr;
          return fallback ?? [];
        }
        throw error;
      }
      return data ?? [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("search_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search_profiles"] });
      qc.invalidateQueries({ queryKey: ["active_profile"] });
      toast.success(t("profiles.profileDeleted"));
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      // Deactivate all profiles first
      const { error: deactivateErr } = await supabase
        .from("search_profiles")
        .update({ is_active: false })
        .eq("user_id", user!.id);
      if (deactivateErr) throw deactivateErr;

      // Activate the selected one
      const { error: activateErr } = await supabase
        .from("search_profiles")
        .update({ is_active: true })
        .eq("id", id);
      if (activateErr) throw activateErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search_profiles"] });
      qc.invalidateQueries({ queryKey: ["active_profile"] });
      toast.success(language === "he" ? "הפרופיל הופעל" : "Profile activated");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (draft: SearchProfileDraft) => {
      if (profiles.length >= MAX_PROFILES) {
        throw new Error(language === "he" ? `מקסימום ${MAX_PROFILES} פרופילים` : `Maximum ${MAX_PROFILES} profiles`);
      }

      // If this is the first profile, make it active
      const isFirst = profiles.length === 0;

      const fullPayload = {
        user_id: user!.id,
        name: draft.name || (language === "he" ? "פרופיל חדש" : "New Profile"),
        cities: draft.cities,
        min_price: draft.minPrice,
        max_price: draft.maxPrice,
        min_rooms: draft.minRooms,
        max_rooms: draft.maxRooms,
        must_haves: draft.mustHaves,
        nice_to_haves: draft.niceToHaves,
        workplace_address: draft.workplaceAddress || null,
        current_address: draft.currentAddress || null,
        desired_area: draft.desiredArea || null,
        is_active: isFirst,
      };

      const { error } = await supabase.from("search_profiles").insert(fullPayload);
      if (error) {
        // If the error is about missing columns (schema cache), retry without the new fields
        if (error.message?.includes("schema cache") || error.message?.includes("current_address") || error.message?.includes("desired_area") || error.message?.includes("workplace_address")) {
          const { user_id, name, cities, min_price, max_price, min_rooms, max_rooms, must_haves, nice_to_haves, is_active } = fullPayload;
          const { error: retryErr } = await supabase.from("search_profiles").insert({
            user_id, name, cities, min_price, max_price, min_rooms, max_rooms, must_haves, nice_to_haves, is_active,
          } as any);
          if (retryErr) throw retryErr;
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search_profiles"] });
      qc.invalidateQueries({ queryKey: ["active_profile"] });
      setShowCreate(false);
      toast.success(t("profiles.profileCreated"));
    },
    onError: (err: Error) => {
      toast.error(language === "he" ? `שגיאה: ${err.message}` : `Error: ${err.message}`);
    },
  });

  const rescoreMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const { data: listings } = await supabase
        .from("listings")
        .select("id, city, price, rooms, amenities")
        .eq("user_id", user!.id)
        .eq("status", "active");

      if (!listings?.length) return;

      const profile = {
        cities: profileData.cities || [],
        min_price: profileData.min_price || 0,
        max_price: profileData.max_price || 99999,
        min_rooms: profileData.min_rooms || 0,
        max_rooms: profileData.max_rooms || 99,
        must_haves: profileData.must_haves || [],
        nice_to_haves: profileData.nice_to_haves || [],
        workplace_address: profileData.workplace_address || null,
        current_address: profileData.current_address || null,
        desired_area: profileData.desired_area || null,
      };

      for (const listing of listings) {
        const score = scoreListing(
          { city: listing.city, price: listing.price, rooms: listing.rooms, amenities: listing.amenities },
          profile
        );
        await supabase.from("listing_scores").upsert({
          listing_id: listing.id,
          search_profile_id: profileData.id,
          score: score.total,
          breakdown: score as any,
        } as any, { onConflict: "listing_id,search_profile_id" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(language === "he" ? "הציונים עודכנו" : "Scores updated");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: SearchProfileDraft }) => {
      const updates = {
        name: draft.name || (language === "he" ? "פרופיל" : "Profile"),
        cities: draft.cities,
        min_price: draft.minPrice,
        max_price: draft.maxPrice,
        min_rooms: draft.minRooms,
        max_rooms: draft.maxRooms,
        must_haves: draft.mustHaves,
        nice_to_haves: draft.niceToHaves,
        workplace_address: draft.workplaceAddress || null,
        current_address: draft.currentAddress || null,
        desired_area: draft.desiredArea || null,
      };
      const { error } = await supabase.from("search_profiles").update(updates).eq("id", id);
      if (error) {
        // Retry without new columns if schema cache issue
        if (error.message?.includes("schema cache") || error.message?.includes("current_address") || error.message?.includes("desired_area") || error.message?.includes("workplace_address")) {
          const { name, cities, min_price, max_price, min_rooms, max_rooms, must_haves, nice_to_haves } = updates;
          const { error: retryErr } = await supabase.from("search_profiles").update({
            name, cities, min_price, max_price, min_rooms, max_rooms, must_haves, nice_to_haves,
          } as any).eq("id", id);
          if (retryErr) throw retryErr;
        } else {
          throw error;
        }
      }
      return { id, ...updates };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["search_profiles"] });
      qc.invalidateQueries({ queryKey: ["active_profile"] });
      setEditingProfile(null);
      toast.success(t("profiles.profileUpdated"));
      if (data) rescoreMutation.mutate({ id: data.id, ...data });
    },
    onError: (err: Error) => {
      toast.error(language === "he" ? `שגיאה: ${err.message}` : `Error: ${err.message}`);
    },
  });

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
  };

  return (
    <div className="w-full space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{t("profiles.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profiles.length}/{MAX_PROFILES} {language === "he" ? "פרופילים" : "profiles"}
          </p>
        </div>
        <Button
          onClick={() => {
            if (profiles.length >= MAX_PROFILES) {
              toast.error(language === "he" ? `מקסימום ${MAX_PROFILES} פרופילים` : `Maximum ${MAX_PROFILES} profiles`);
              return;
            }
            setShowCreate(true);
          }}
          className="gap-1.5"
          disabled={profiles.length >= MAX_PROFILES || createMutation.isPending}
        >
          <Plus className="h-4 w-4" /> {t("profiles.create")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Search className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">{t("profiles.empty")}</p>
          <p className="text-sm text-muted-foreground">{t("profiles.emptySubtitle")}</p>
          <Button variant="outline" onClick={() => setShowCreate(true)} className="mt-3 gap-1.5">
            <Plus className="h-4 w-4" /> {t("profiles.create")}
          </Button>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {profiles.map((p) => (
            <motion.div key={p.id} variants={itemVariants} layout>
              <Card className={`p-4 transition-all ${p.is_active ? "ring-2 ring-primary/50 border-primary/30" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => activateMutation.mutate(p.id)}
                        className="shrink-0 transition-transform hover:scale-110"
                        title={language === "he" ? (p.is_active ? "פרופיל פעיל" : "הפעל פרופיל") : (p.is_active ? "Active profile" : "Set as active")}
                        disabled={activateMutation.isPending}
                      >
                        {p.is_active ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/50 hover:text-primary/60" />
                        )}
                      </button>
                      <h3 className="font-semibold">{p.name || (language === "he" ? "ללא שם" : "Untitled")}</h3>
                      {p.is_active && (
                        <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                          {language === "he" ? "פעיל" : "Active"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1 ms-7">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.cities?.map((c: string) => cityDisplayName(c, language)).join(", ") || "—"}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 ms-7">
                      ₪{p.min_price?.toLocaleString()}–₪{p.max_price?.toLocaleString()} · {p.min_rooms}–{p.max_rooms} {t("common.rooms")}
                    </p>
                    {p.current_address && (
                      <p className="text-sm text-muted-foreground mt-1 ms-7 flex items-center gap-1">
                        <Home className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{p.current_address}</span>
                      </p>
                    )}
                    {p.desired_area && (
                      <p className="text-sm text-muted-foreground mt-1 ms-7 flex items-center gap-1">
                        <Navigation className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{p.desired_area}</span>
                      </p>
                    )}
                    {p.workplace_address && (
                      <p className="text-sm text-muted-foreground mt-1 ms-7 flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{p.workplace_address}</span>
                      </p>
                    )}
                    {p.must_haves?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 ms-7">
                        {p.must_haves.map((mh: string) => (
                          <span key={mh} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{amenityDisplayName(mh, language)}</span>
                        ))}
                      </div>
                    )}
                    {p.nice_to_haves?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 ms-7">
                        {p.nice_to_haves.map((nh: string) => (
                          <span key={nh} className="text-xs bg-accent/10 text-accent-foreground px-2 py-0.5 rounded-full">{amenityDisplayName(nh, language)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => rescoreMutation.mutate({
                        id: p.id,
                        cities: p.cities,
                        min_price: p.min_price,
                        max_price: p.max_price,
                        min_rooms: p.min_rooms,
                        max_rooms: p.max_rooms,
                        must_haves: p.must_haves,
                        nice_to_haves: p.nice_to_haves,
                        workplace_address: p.workplace_address,
                        current_address: p.current_address,
                        desired_area: p.desired_area,
                      })}
                      title={language === "he" ? "חשב ציונים מחדש" : "Re-score listings"}
                      className="text-primary"
                      disabled={rescoreMutation.isPending}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingProfile(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("profiles.confirmDelete")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("profiles.delete")}?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>{t("common.delete")}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("profiles.create")}</DialogTitle></DialogHeader>
          <OnboardingWizard onComplete={(draft) => createMutation.mutate(draft)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(v) => { if (!v) setEditingProfile(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("profiles.edit")}</DialogTitle></DialogHeader>
          {editingProfile && (
            <OnboardingWizard
              onComplete={(draft) => updateMutation.mutate({ id: editingProfile.id, draft })}
              isPending={updateMutation.isPending}
              initialData={{
                name: editingProfile.name,
                cities: editingProfile.cities,
                minPrice: editingProfile.min_price,
                maxPrice: editingProfile.max_price,
                minRooms: editingProfile.min_rooms,
                maxRooms: editingProfile.max_rooms,
                mustHaves: editingProfile.must_haves,
                niceToHaves: editingProfile.nice_to_haves,
                workplaceAddress: editingProfile.workplace_address || "",
                currentAddress: editingProfile.current_address || "",
                desiredArea: editingProfile.desired_area || "",
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profiles;
