import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { scoreListing } from "@/lib/scoring";
import { z } from "zod";

interface AddListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const urlSchema = z.string().url();

const manualSchema = z.object({
  address: z.string().max(500).optional(),
  city: z.string().max(500).optional(),
  price: z.union([z.literal(""), z.string()]).transform((v) => v === "" ? null : Number(v)).pipe(z.number().positive().max(1000000).nullable()),
  rooms: z.union([z.literal(""), z.string()]).transform((v) => v === "" ? null : Number(v)).pipe(z.number().min(0.5).max(20).nullable()),
  sqm: z.union([z.literal(""), z.string()]).transform((v) => v === "" ? null : Number(v)).pipe(z.number().min(1).max(1000).nullable()),
  floor: z.union([z.literal(""), z.string()]).transform((v) => v === "" ? null : Number(v)).pipe(z.number().int().min(-5).max(100).nullable()),
  description: z.string().max(500).optional(),
  contact_name: z.string().max(500).optional(),
  contact_phone: z.string().max(20).regex(/^[\d\s+\-()]*$/, "Invalid phone").optional().or(z.literal("")),
});

export const AddListingModal = ({ open, onOpenChange }: AddListingModalProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    address: "", city: "", price: "", rooms: "", sqm: "", floor: "",
    description: "", contact_name: "", contact_phone: "",
  });

  const insertMutation = useMutation({
    mutationFn: async (listing: any) => {
      const { data, error } = await supabase
        .from("listings")
        .insert(listing)
        .select()
        .single();
      if (error) throw error;

      // Score against all active profiles
      const { data: profiles } = await supabase
        .from("search_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true);

      if (profiles && profiles.length > 0 && data) {
        const scores = profiles.map((p) => {
          const breakdown = scoreListing(
            { city: data.city, price: data.price, rooms: data.rooms, amenities: data.amenities },
            { cities: p.cities, min_price: p.min_price, max_price: p.max_price, min_rooms: p.min_rooms, max_rooms: p.max_rooms, must_haves: p.must_haves, nice_to_haves: p.nice_to_haves }
          );
          return { listing_id: data.id, search_profile_id: p.id, score: breakdown.total, breakdown: JSON.parse(JSON.stringify(breakdown)) };
        });
        await supabase.from("listing_scores").insert(scores);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      onOpenChange(false);
      resetForm();
      toast.success(t("addListing.added"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setUrl("");
    setUrlError("");
    setFormErrors({});
    setForm({ address: "", city: "", price: "", rooms: "", sqm: "", floor: "", description: "", contact_name: "", contact_phone: "" });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = manualSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const key = err.path[0] as string;
        if (key === "price") errs[key] = t("addListing.priceMustBePositive");
        else if (key === "rooms") errs[key] = t("addListing.roomsRange");
        else if (key === "sqm") errs[key] = t("addListing.sqmRange");
        else if (key === "floor") errs[key] = t("addListing.floorRange");
        else if (key === "contact_phone") errs[key] = t("addListing.phoneInvalid");
        else errs[key] = t("addListing.textTooLong");
      });
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    const d = result.data;
    insertMutation.mutate({
      user_id: user!.id,
      address: d.address || null,
      city: d.city || null,
      price: d.price,
      rooms: d.rooms,
      sqm: d.sqm,
      floor: d.floor,
      description: d.description || null,
      contact_name: d.contact_name || null,
      contact_phone: d.contact_phone || null,
    });
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlSchema.safeParse(url).success) {
      setUrlError(t("addListing.invalidUrl"));
      return;
    }
    setUrlError("");
    insertMutation.mutate({ user_id: user!.id, source_url: url });
  };

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const FieldError = ({ field }: { field: string }) => 
    formErrors[field] ? <p className="text-xs text-destructive mt-0.5">{formErrors[field]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addListing.title")}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="manual">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">{t("addListing.pasteUrl")}</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">{t("addListing.manual")}</TabsTrigger>
          </TabsList>
          <TabsContent value="url">
            <form onSubmit={handleUrlSubmit} className="space-y-4 pt-2">
              <div>
                <Input placeholder={t("addListing.urlPlaceholder")} value={url} onChange={(e) => { setUrl(e.target.value); setUrlError(""); }} required />
                {urlError && <p className="text-xs text-destructive mt-0.5">{urlError}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={insertMutation.isPending}>{t("addListing.fetch")}</Button>
            </form>
          </TabsContent>
          <TabsContent value="manual">
            <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
              <div>
                <Input placeholder={t("addListing.address")} {...f("address")} maxLength={500} />
                <FieldError field="address" />
              </div>
              <div>
                <Input placeholder={t("addListing.city")} {...f("city")} maxLength={500} />
                <FieldError field="city" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Input placeholder={t("addListing.price")} type="number" {...f("price")} min={1} />
                  <FieldError field="price" />
                </div>
                <div>
                  <Input placeholder={t("addListing.rooms")} type="number" step="0.5" {...f("rooms")} min={0.5} max={20} />
                  <FieldError field="rooms" />
                </div>
                <div>
                  <Input placeholder={t("addListing.sqm")} type="number" {...f("sqm")} min={1} max={1000} />
                  <FieldError field="sqm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input placeholder={t("addListing.floor")} type="number" {...f("floor")} min={-5} max={100} />
                  <FieldError field="floor" />
                </div>
                <div>
                  <Input placeholder={t("addListing.contactPhone")} {...f("contact_phone")} maxLength={20} />
                  <FieldError field="contact_phone" />
                </div>
              </div>
              <div>
                <Input placeholder={t("addListing.contactName")} {...f("contact_name")} maxLength={500} />
                <FieldError field="contact_name" />
              </div>
              <div>
                <Textarea placeholder={t("addListing.description")} {...f("description")} rows={3} maxLength={500} />
                <FieldError field="description" />
              </div>
              <Button type="submit" className="w-full" disabled={insertMutation.isPending}>{t("addListing.submit")}</Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
