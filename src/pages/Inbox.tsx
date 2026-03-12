import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Inbox as InboxIcon } from "lucide-react";
import { ListingCard } from "@/components/listings/ListingCard";
import { AddListingModal } from "@/components/listings/AddListingModal";

const InboxPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("listings")
        .select("*, listing_scores(*)")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const filtered = listings.filter((l: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.address?.toLowerCase().includes(s) || l.city?.toLowerCase().includes(s);
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">{t("inbox.title")}</h1>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("inbox.addListing")}
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("inbox.filter") + "..."} className="ps-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <InboxIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="text-lg font-medium">{t("inbox.empty")}</h3>
          <p className="text-sm text-muted-foreground">{t("inbox.emptySubtitle")}</p>
          <Button variant="outline" onClick={() => setShowAdd(true)} className="gap-1.5 mt-2">
            <Plus className="h-4 w-4" /> {t("inbox.addListing")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((listing: any) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <AddListingModal open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
};

export default InboxPage;
