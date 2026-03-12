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

interface AddListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddListingModal = ({ open, onOpenChange }: AddListingModalProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [url, setUrl] = useState("");
  const [form, setForm] = useState({
    address: "", city: "", price: "", rooms: "", sqm: "", floor: "",
    description: "", contact_name: "", contact_phone: "",
  });

  const insertMutation = useMutation({
    mutationFn: async (listing: any) => {
      const { data, error } = await (supabase as any)
        .from("listings")
        .insert(listing)
        .select()
        .single();
      if (error) throw error;

      // Score against all active profiles
      const { data: profiles } = await (supabase as any)
        .from("search_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true);

      if (profiles && profiles.length > 0 && data) {
        const scores = profiles.map((p: any) => {
          const breakdown = scoreListing(
            { city: data.city, price: data.price, rooms: data.rooms, amenities: data.amenities },
            { cities: p.cities, min_price: p.min_price, max_price: p.max_price, min_rooms: p.min_rooms, max_rooms: p.max_rooms, must_haves: p.must_haves, nice_to_haves: p.nice_to_haves }
          );
          return { listing_id: data.id, search_profile_id: p.id, score: breakdown.total, breakdown };
        });
        await (supabase as any).from("listing_scores").insert(scores);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      onOpenChange(false);
      resetForm();
      toast.success("Listing added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setUrl("");
    setForm({ address: "", city: "", price: "", rooms: "", sqm: "", floor: "", description: "", contact_name: "", contact_phone: "" });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    insertMutation.mutate({
      user_id: user!.id,
      address: form.address || null, city: form.city || null,
      price: form.price ? Number(form.price) : null,
      rooms: form.rooms ? Number(form.rooms) : null,
      sqm: form.sqm ? Number(form.sqm) : null,
      floor: form.floor ? Number(form.floor) : null,
      description: form.description || null,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
    });
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    insertMutation.mutate({ user_id: user!.id, source_url: url });
  };

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("inbox.addListing")}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="manual">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">Paste URL</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">Manual Entry</TabsTrigger>
          </TabsList>
          <TabsContent value="url">
            <form onSubmit={handleUrlSubmit} className="space-y-4 pt-2">
              <Input placeholder="https://yad2.co.il/..." value={url} onChange={(e) => setUrl(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={insertMutation.isPending}>{t("common.save")}</Button>
            </form>
          </TabsContent>
          <TabsContent value="manual">
            <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
              <Input placeholder="Address" {...f("address")} />
              <Input placeholder="City" {...f("city")} />
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Price (₪)" type="number" {...f("price")} />
                <Input placeholder="Rooms" type="number" step="0.5" {...f("rooms")} />
                <Input placeholder="Sqm" type="number" {...f("sqm")} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Floor" type="number" {...f("floor")} />
                <Input placeholder="Contact phone" {...f("contact_phone")} />
              </div>
              <Input placeholder="Contact name" {...f("contact_name")} />
              <Textarea placeholder="Description..." {...f("description")} rows={3} />
              <Button type="submit" className="w-full" disabled={insertMutation.isPending}>{t("common.save")}</Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
