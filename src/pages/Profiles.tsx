import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OnboardingWizard, SearchProfileDraft } from "@/components/onboarding/OnboardingWizard";
import { Plus, Trash2, MapPin, Pencil, Search, Briefcase, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { scoreListing } from "@/lib/scoring";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("search_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["search_profiles"] }); toast.success(t("profiles.profileDeleted")); },
  });

  const createMutation = useMutation({
    mutationFn: async (draft: SearchProfileDraft) => {
      const { error } = await supabase.from("search_profiles").insert({
        user_id: user!.id,
        name: draft.name || "Untitled",
        cities: draft.cities,
        min_price: draft.minPrice,
        max_price: draft.maxPrice,
        min_rooms: draft.minRooms,
        max_rooms: draft.maxRooms,
        must_haves: draft.mustHaves,
        nice_to_haves: draft.niceToHaves,
        workplace_address: draft.workplaceAddress || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search_profiles"] });
      setShowCreate(false);
      toast.success(t("profiles.profileCreated"));
    },
  });

  const rescoreMutation = useMutation({
    mutationFn: async (profileData: any) => {
      // Fetch all active listings and re-score them against the updated profile
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
      };

      // Re-score each listing
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
      toast.success(language === "he" ? "הציונים עודכנו" : language === "es" ? "Puntuaciones actualizadas" : "Scores updated");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: SearchProfileDraft }) => {
      const updates = {
        name: draft.name || "Untitled",
        cities: draft.cities,
        min_price: draft.minPrice,
        max_price: draft.maxPrice,
        min_rooms: draft.minRooms,
        max_rooms: draft.maxRooms,
        must_haves: draft.mustHaves,
        nice_to_haves: draft.niceToHaves,
        workplace_address: draft.workplaceAddress || null,
      };
      const { error } = await supabase.from("search_profiles").update(updates).eq("id", id);
      if (error) throw error;
      return { id, ...updates };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["search_profiles"] });
      setEditingProfile(null);
      toast.success(t("profiles.profileUpdated"));
      // Re-score all listings against the updated profile
      if (data) rescoreMutation.mutate({ id: data.id, ...data });
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">{t("profiles.title")}</h1>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
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
        <div className="space-y-3">
          {profiles.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{p.name || "Untitled"}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.cities?.join(", ") || "—"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    ₪{p.min_price?.toLocaleString()}–₪{p.max_price?.toLocaleString()} · {p.min_rooms}–{p.max_rooms} {t("common.rooms")}
                  </p>
                  {(p as any).workplace_address && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{(p as any).workplace_address}</span>
                    </p>
                  )}
                  {p.must_haves?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.must_haves.map((mh: string) => (
                        <span key={mh} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{mh}</span>
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
                    })}
                    title={language === "he" ? "חשב ציונים מחדש" : "Re-score listings"}
                    className="text-primary"
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
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("profiles.create")}</DialogTitle></DialogHeader>
          <OnboardingWizard onComplete={(draft) => createMutation.mutate(draft)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(v) => { if (!v) setEditingProfile(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("profiles.edit")}</DialogTitle></DialogHeader>
          {editingProfile && (
            <OnboardingWizard
              onComplete={(draft) => updateMutation.mutate({ id: editingProfile.id, draft })}
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
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profiles;
