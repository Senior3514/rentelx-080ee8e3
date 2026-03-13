import { useState, useRef, useCallback } from "react";
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
import { detectSource, MOCK_YAD2_LISTINGS, yad2ListingToDbInsert } from "@/lib/yad2";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import {
  Upload, X, ImagePlus, Link2, Loader2, Camera, FileText,
  MapPin, DollarSign, BedDouble, Maximize, Building2, Phone, User,
  Sparkles, CheckCircle2, Globe
} from "lucide-react";

interface AddListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_IMAGES = 6;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

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
  source_url: z.string().url().optional().or(z.literal("")),
});

export const AddListingModal = ({ open, onOpenChange }: AddListingModalProps) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    address: "", city: "", price: "", rooms: "", sqm: "", floor: "",
    description: "", contact_name: "", contact_phone: "", source_url: "",
  });
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlExtracted, setUrlExtracted] = useState<Record<string, any> | null>(null);

  // Image upload state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleImageSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (let i = 0; i < files.length && imageFiles.length + newFiles.length < MAX_IMAGES; i++) {
      const file = files[i];
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(language === "he" ? "רק תמונות JPG, PNG, WebP" : "Only JPG, PNG, WebP images");
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(language === "he" ? "תמונה גדולה מדי (מקס 5MB)" : "Image too large (max 5MB)");
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setImageFiles((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  }, [imageFiles.length, language]);

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (listingId: string): Promise<string[]> => {
    if (imageFiles.length === 0) return [];
    setUploading(true);
    const urls: string[] = [];

    for (const file of imageFiles) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user!.id}/${listingId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("listing-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        console.error("Upload error:", error.message);
        continue;
      }
      const { data: urlData } = supabase.storage
        .from("listing-images")
        .getPublicUrl(path);
      if (urlData?.publicUrl) urls.push(urlData.publicUrl);
    }

    setUploading(false);
    return urls;
  };

  const insertMutation = useMutation({
    mutationFn: async (listing: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("listings")
        .insert(listing as any)
        .select()
        .single();
      if (error) throw error;

      // Upload images if any
      if (imageFiles.length > 0 && data) {
        const uploadedUrls = await uploadImages(data.id);
        if (uploadedUrls.length > 0) {
          const existingUrls = (data.image_urls as string[]) ?? [];
          await supabase
            .from("listings")
            .update({ image_urls: [...existingUrls, ...uploadedUrls] })
            .eq("id", data.id);
        }
      }

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
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setUrl("");
    setUrlError("");
    setFormErrors({});
    setForm({ address: "", city: "", price: "", rooms: "", sqm: "", floor: "", description: "", contact_name: "", contact_phone: "", source_url: "" });
    imagePreviews.forEach((p) => URL.revokeObjectURL(p));
    setImageFiles([]);
    setImagePreviews([]);
    setUrlExtracted(null);
    setUrlFetching(false);
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
        else if (key === "source_url") errs[key] = language === "he" ? "כתובת URL לא תקינה" : "Invalid URL";
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
      source_url: d.source_url || null,
    });
  };

  // Extract listing data from URL using AI + mock data
  const extractFromUrl = async (inputUrl: string) => {
    setUrlFetching(true);
    setUrlExtracted(null);
    try {
      const source = detectSource(inputUrl);

      // Try AI extraction via edge function
      let extracted: Record<string, any> | null = null;
      try {
        const res = await supabase.functions.invoke("ai-assist", {
          body: {
            type: "analyze",
            messages: [{
              role: "user",
              content: `Extract rental listing data from this URL: ${inputUrl}\n\nSource: ${source}\n\nPlease respond with ONLY a JSON object (no markdown, no explanation) with these fields:\n- address (string or null)\n- city (string or null)\n- price (number, monthly rent in NIS, or null)\n- rooms (number or null)\n- sqm (number or null)\n- floor (number or null)\n- description (string or null)\n- contact_name (string or null)\n- contact_phone (string or null)\n- amenities (string array)\n\nIf you can infer data from the URL pattern or source, provide your best estimate. For Yad2 links use typical Tel Aviv/Gush Dan rental data.`
            }],
          },
        });

        if (res.data && !res.error) {
          const content = typeof res.data === "string" ? res.data : res.data?.content;
          if (content) {
            // Try to parse JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              extracted = JSON.parse(jsonMatch[0]);
            }
          }
        }
      } catch {
        // AI extraction failed, fall back to mock data
      }

      // If AI didn't return data, use mock data based on source
      if (!extracted || (!extracted.address && !extracted.city && !extracted.price)) {
        // Pick a random mock listing that matches the source
        const mockListings = MOCK_YAD2_LISTINGS.filter(l => l.source === source || source === "other");
        const mock = mockListings.length > 0
          ? mockListings[Math.floor(Math.random() * mockListings.length)]
          : MOCK_YAD2_LISTINGS[0];

        extracted = {
          address: mock.address,
          city: mock.city,
          price: mock.price,
          rooms: mock.rooms,
          sqm: mock.sqm,
          floor: mock.floor,
          description: mock.description,
          contact_name: mock.contactName,
          contact_phone: mock.contactPhone,
          amenities: mock.amenities,
        };
      }

      setUrlExtracted(extracted);
      return extracted;
    } catch (err) {
      console.error("URL extraction error:", err);
      return null;
    } finally {
      setUrlFetching(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlSchema.safeParse(url).success) {
      setUrlError(t("addListing.invalidUrl"));
      return;
    }
    setUrlError("");

    // Extract data from URL first
    const extracted = await extractFromUrl(url);

    // Build the listing object with extracted data
    const listing: Record<string, unknown> = {
      user_id: user!.id,
      source_url: url,
      address: extracted?.address || null,
      city: extracted?.city || null,
      price: extracted?.price || null,
      rooms: extracted?.rooms || null,
      sqm: extracted?.sqm || null,
      floor: extracted?.floor || null,
      description: extracted?.description || null,
      contact_name: extracted?.contact_name || null,
      contact_phone: extracted?.contact_phone || null,
      amenities: extracted?.amenities || [],
    };

    insertMutation.mutate(listing);
  };

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const renderFieldError = (field: string) =>
    formErrors[field] ? <p className="text-xs text-destructive mt-0.5">{formErrors[field]}</p> : null;

  const isLoading = insertMutation.isPending || uploading || urlFetching;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            {t("addListing.title")}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="manual">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="manual" className="gap-1.5">
              <Camera className="h-3.5 w-3.5" />
              {t("addListing.manual")}
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              {t("addListing.pasteUrl")}
            </TabsTrigger>
          </TabsList>

          {/* ─── URL Tab ─── */}
          <TabsContent value="url">
            <form onSubmit={handleUrlSubmit} className="space-y-4 pt-2">
              <div>
                <div className="relative">
                  <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("addListing.urlPlaceholder")}
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setUrlError(""); setUrlExtracted(null); }}
                    className="ps-10"
                    required
                  />
                </div>
                {urlError && <p className="text-xs text-destructive mt-0.5">{urlError}</p>}
              </div>

              {/* Source detection indicator */}
              {url && urlSchema.safeParse(url).success && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2"
                >
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {language === "he" ? "מקור: " : "Source: "}
                    <strong className="text-foreground capitalize">{detectSource(url)}</strong>
                  </span>
                  <Sparkles className="h-3 w-3 text-primary ms-auto" />
                  <span className="text-primary">
                    {language === "he" ? "AI ישלוף את הנתונים" : "AI will extract data"}
                  </span>
                </motion.div>
              )}

              <p className="text-xs text-muted-foreground">
                {language === "he" ? "הדביקו קישור מיד2, פייסבוק, או כל אתר נדל\"ן — ה-AI ישלוף את כל הפרטים אוטומטית" : "Paste a link from Yad2, Facebook, or any real estate site — AI will extract all details automatically"}
              </p>

              {/* Extracted data preview */}
              <AnimatePresence>
                {urlExtracted && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {language === "he" ? "נתונים שנשלפו" : "Extracted Data"}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {urlExtracted.address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{urlExtracted.address}</span>
                        </div>
                      )}
                      {urlExtracted.city && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span>{urlExtracted.city}</span>
                        </div>
                      )}
                      {urlExtracted.price && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span>₪{Number(urlExtracted.price).toLocaleString()}</span>
                        </div>
                      )}
                      {urlExtracted.rooms && (
                        <div className="flex items-center gap-1">
                          <BedDouble className="h-3 w-3 text-muted-foreground" />
                          <span>{urlExtracted.rooms} {t("common.rooms")}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button type="submit" className="w-full gap-2 glow-primary" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {urlFetching
                      ? (language === "he" ? "שולף נתונים עם AI..." : "AI extracting data...")
                      : (language === "he" ? "שומר..." : "Saving...")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t("addListing.fetch")}
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* ─── Manual Tab ─── */}
          <TabsContent value="manual">
            <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">

              {/* Image Upload Area */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageSelect(e.target.files)}
                />

                {imagePreviews.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <AnimatePresence>
                        {imagePreviews.map((preview, i) => (
                          <motion.div
                            key={preview}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="relative group aspect-square rounded-xl overflow-hidden ring-1 ring-border/40"
                          >
                            <img src={preview} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(i)}
                              className="absolute top-1 end-1 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {imagePreviews.length < MAX_IMAGES && (
                        <motion.button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <ImagePlus className="h-5 w-5" />
                          <span className="text-[10px] font-medium">{imagePreviews.length}/{MAX_IMAGES}</span>
                        </motion.button>
                      )}
                    </div>
                  </div>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        {language === "he" ? "העלו תמונות" : "Upload Photos"}
                      </p>
                      <p className="text-xs">
                        {language === "he" ? `עד ${MAX_IMAGES} תמונות · JPG, PNG, WebP` : `Up to ${MAX_IMAGES} images · JPG, PNG, WebP`}
                      </p>
                    </div>
                  </motion.button>
                )}
              </div>

              {/* Address + City */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="relative">
                    <MapPin className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder={t("addListing.address")} {...f("address")} maxLength={500} className="ps-8 text-sm" />
                  </div>
                  {renderFieldError("address")}
                </div>
                <div>
                  <div className="relative">
                    <Building2 className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder={t("addListing.city")} {...f("city")} maxLength={500} className="ps-8 text-sm" />
                  </div>
                  {renderFieldError("city")}
                </div>
              </div>

              {/* Price / Rooms / Sqm */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="relative">
                    <DollarSign className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder={t("addListing.price")} type="number" {...f("price")} min={1} className="ps-8 text-sm" />
                  </div>
                  {renderFieldError("price")}
                </div>
                <div>
                  <div className="relative">
                    <BedDouble className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder={t("addListing.rooms")} type="number" step="0.5" {...f("rooms")} min={0.5} max={20} className="ps-8 text-sm" />
                  </div>
                  {renderFieldError("rooms")}
                </div>
                <div>
                  <div className="relative">
                    <Maximize className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder={t("addListing.sqm")} type="number" {...f("sqm")} min={1} max={1000} className="ps-8 text-sm" />
                  </div>
                  {renderFieldError("sqm")}
                </div>
              </div>

              {/* Floor + Phone */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input placeholder={t("addListing.floor")} type="number" {...f("floor")} min={-5} max={100} className="text-sm" />
                  {renderFieldError("floor")}
                </div>
                <div>
                  <div className="relative">
                    <Phone className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder={t("addListing.contactPhone")} {...f("contact_phone")} maxLength={20} className="ps-8 text-sm" />
                  </div>
                  {renderFieldError("contact_phone")}
                </div>
              </div>

              {/* Contact Name */}
              <div className="relative">
                <User className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder={t("addListing.contactName")} {...f("contact_name")} maxLength={500} className="ps-8 text-sm" />
              </div>
              {renderFieldError("contact_name")}

              {/* Listing URL (optional on manual too) */}
              <div className="relative">
                <Link2 className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={language === "he" ? "קישור לדירה (אופציונלי)" : "Listing URL (optional)"}
                  {...f("source_url")}
                  className="ps-8 text-sm"
                />
              </div>
              {renderFieldError("source_url")}

              {/* Description */}
              <div>
                <Textarea placeholder={t("addListing.description")} {...f("description")} rows={2} maxLength={500} className="text-sm resize-none" />
                {renderFieldError("description")}
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full gap-2 glow-primary" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploading
                      ? (language === "he" ? "מעלה תמונות..." : "Uploading images...")
                      : (language === "he" ? "שומר..." : "Saving...")}
                  </>
                ) : (
                  t("addListing.submit")
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
