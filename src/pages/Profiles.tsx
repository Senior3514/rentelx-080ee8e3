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

const MAX_PROFILES = 3;

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

  // Slots: always show MAX_PROFILES slots
  const profileSlots = Array.from({ length: MAX_PROFILES }, (_, i) => profiles[i] || null);

  return (
    <div className="w-full space-y-6 pb-20 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{t("profiles.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profiles.length}/{MAX_PROFILES} {language === "he" ? "פרופילים" : language === "ru" ? "профилей" : language === "es" ? "perfiles" : "profiles"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {profileSlots.map((p, slotIdx) => (
            <motion.div key={p?.id || `empty-${slotIdx}`} variants={itemVariants} layout>
              {p ? (
                /* ── Filled Profile Card ── */
                <Card className={`relative overflow-hidden transition-all h-full flex flex-col ${
                  p.is_active
                    ? "ring-2 ring-primary/50 border-primary/30 shadow-[0_0_20px_hsl(var(--primary)/0.12)]"
                    : "border-border/60 hover:border-primary/30"
                }`}>
                  {/* Active indicator bar */}
                  {p.is_active && (
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-primary/60" />
                  )}

                  <div className="p-4 flex-1 flex flex-col">
                    {/* Top row: activate + name + badge */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <button
                        onClick={() => activateMutation.mutate(p.id)}
                        className="shrink-0 transition-all hover:scale-110"
                        title={language === "he" ? (p.is_active ? "פרופיל פעיל" : "הפעל פרופיל") : (p.is_active ? "Active profile" : "Set as active")}
                        disabled={activateMutation.isPending}
                      >
                        {p.is_active ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-primary/60" />
                        )}
                      </button>
                      <h3 className="font-semibold text-base truncate flex-1">{p.name || (language === "he" ? "ללא שם" : "Untitled")}</h3>
                      {p.is_active && (
                        <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold shrink-0">
                          {language === "he" ? "פעיל" : language === "ru" ? "Актив" : "Active"}
                        </span>
                      )}
                    </div>

                    {/* Cities */}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                      <span className="truncate">{p.cities?.map((c: string) => cityDisplayName(c, language)).join(", ") || "—"}</span>
                    </div>

                    {/* Budget + Rooms as compact badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="text-xs bg-muted/80 px-2 py-1 rounded-md font-medium">
                        ₪{p.min_price?.toLocaleString()}–₪{p.max_price?.toLocaleString()}
                      </span>
                      <span className="text-xs bg-muted/80 px-2 py-1 rounded-md font-medium">
                        {p.min_rooms}–{p.max_rooms} {t("common.rooms")}
                      </span>
                    </div>

                    {/* Address info (compact) */}
                    <div className="space-y-1 mb-3">
                      {p.current_address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                          <Home className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                          {p.current_address}
                        </p>
                      )}
                      {p.desired_area && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                          <Navigation className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                          {p.desired_area}
                        </p>
                      )}
                      {p.workplace_address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                          <Briefcase className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                          {p.workplace_address}
                        </p>
                      )}
                    </div>

                    {/* Amenities */}
                    {(p.must_haves?.length > 0 || p.nice_to_haves?.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-border/30">
                        {p.must_haves?.map((mh: string) => (
                          <span key={mh} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{amenityDisplayName(mh, language)}</span>
                        ))}
                        {p.nice_to_haves?.map((nh: string) => (
                          <span key={nh} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{amenityDisplayName(nh, language)}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center justify-end gap-0.5 px-3 py-2 border-t border-border/30 bg-muted/20">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => rescoreMutation.mutate({
                        id: p.id, cities: p.cities,
                        min_price: p.min_price, max_price: p.max_price,
                        min_rooms: p.min_rooms, max_rooms: p.max_rooms,
                        must_haves: p.must_haves, nice_to_haves: p.nice_to_haves,
                        workplace_address: p.workplace_address,
                        current_address: p.current_address,
                        desired_area: p.desired_area,
                      })}
                      className="h-7 text-xs gap-1 text-primary hover:text-primary"
                      disabled={rescoreMutation.isPending}
                    >
                      <Sparkles className="h-3 w-3" />
                      {language === "he" ? "ציון מחדש" : "Re-score"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingProfile(p)} className="h-7 text-xs gap-1">
                      <Pencil className="h-3 w-3" /> {t("common.edit")}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
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
                </Card>
              ) : (
                /* ── Empty Slot Card ── */
                <Card
                  className="border-dashed border-border/50 h-full min-h-[200px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  onClick={() => setShowCreate(true)}
                >
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <Plus className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {t("profiles.create")}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {language === "he" ? `משבצת ${slotIdx + 1} מתוך ${MAX_PROFILES}` : `Slot ${slotIdx + 1} of ${MAX_PROFILES}`}
                    </p>
                  </div>
                </Card>
              )}
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
