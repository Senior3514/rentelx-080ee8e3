import { useState, useRef, useCallback, useEffect } from "react";
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
import { detectSource, getSourceDisplayName } from "@/lib/yad2";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import {
  Upload, X, ImagePlus, Link2, Loader2, Camera, FileText,
  MapPin, DollarSign, BedDouble, Maximize, Building2, Phone, User,
  Sparkles, CheckCircle2, Globe, AlertTriangle, Image as ImageIcon
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
  const { t, language, direction } = useLanguage();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    address: "", city: "", price: "", rooms: "", sqm: "", floor: "", total_floors: "",
    description: "", contact_name: "", contact_phone: "", source_url: "",
  });
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlExtracted, setUrlExtracted] = useState<Record<string, any> | null>(null);
  const [extractionPartial, setExtractionPartial] = useState(false);
  const [pastedContent, setPastedContent] = useState("");
  const [pasteExtracting, setPasteExtracting] = useState(false);
  const autoExtractRef = useRef(false);

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
        toast.error(t("addListingExtra.imageTypeError"));
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t("addListingExtra.imageSizeError"));
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
            { cities: p.cities, min_price: p.min_price, max_price: p.max_price, min_rooms: p.min_rooms, max_rooms: p.max_rooms, must_haves: p.must_haves, nice_to_haves: p.nice_to_haves, workplace_address: (p as any).workplace_address, current_address: (p as any).current_address, desired_area: (p as any).desired_area }
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
    setForm({ address: "", city: "", price: "", rooms: "", sqm: "", floor: "", total_floors: "", description: "", contact_name: "", contact_phone: "", source_url: "" });
    imagePreviews.forEach((p) => URL.revokeObjectURL(p));
    setImageFiles([]);
    setImagePreviews([]);
    setUrlExtracted(null);
    setUrlFetching(false);
    setExtractionPartial(false);
    setDuplicateInfo(null);
    setPastedContent("");
    setPasteExtracting(false);
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
        else if (key === "source_url") errs[key] = t("addListingExtra.invalidSourceUrl");
        else errs[key] = t("addListing.textTooLong");
      });
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    const d = result.data;
    const totalFloors = form.total_floors ? Number(form.total_floors) || null : null;
    insertMutation.mutate({
      user_id: user!.id,
      address: d.address || null,
      city: d.city || null,
      price: d.price,
      rooms: d.rooms,
      sqm: d.sqm,
      floor: d.floor,
      total_floors: totalFloors,
      description: d.description || null,
      contact_name: d.contact_name || null,
      contact_phone: d.contact_phone || null,
      source_url: d.source_url || null,
    });
  };

  // Parse AI response JSON
  const parseExtractedJson = (content: string): Record<string, any> | null => {
    try {
      const cleaned = content.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        address: parsed.address || null,
        neighborhood: parsed.neighborhood || null,
        city: parsed.city || null,
        price: parsed.price != null ? Number(parsed.price) || null : null,
        rooms: parsed.rooms != null ? Number(parsed.rooms) || null : null,
        sqm: parsed.sqm != null ? Number(parsed.sqm) || null : null,
        floor: parsed.floor != null ? Number(parsed.floor) : null,
        total_floors: parsed.total_floors != null ? Number(parsed.total_floors) : null,
        description: parsed.description || null,
        amenities: Array.isArray(parsed.amenities) ? parsed.amenities.filter(Boolean) : [],
        contact_name: parsed.contact_name || null,
        contact_phone: parsed.contact_phone || null,
        image_urls: Array.isArray(parsed.image_urls) ? parsed.image_urls.filter(Boolean) : [],
      };
    } catch {
      return null;
    }
  };

  // Extract listing data from URL using AI (with real page content + retry)
  const extractFromUrl = async (inputUrl: string) => {
    setUrlFetching(true);
    setUrlExtracted(null);
    setExtractionPartial(false);
    try {
      // Clean URL: strip tracking params so the edge function fetches the right page
      const cleanUrl = normalizeUrl(inputUrl);
      const source = detectSource(cleanUrl);

      let extracted: Record<string, any> | null = null;
      const MAX_RETRIES = 3;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const res = await supabase.functions.invoke("ai-assist", {
            body: {
              type: "extract",
              messages: [{
                role: "user",
                content: `Extract rental listing data from this ${source} listing URL: ${cleanUrl}
${attempt > 0 ? `\nThis is attempt ${attempt + 1}. Previous attempt returned incomplete data. Try HARDER to extract ALL fields. Look more carefully at structured data (JSON-LD, __NEXT_DATA__), OG meta tags, aria-labels, and free text.` : ""}

Return a JSON object with these exact fields (use null if not found):
{
  "address": "full street address or null",
  "neighborhood": "neighborhood name or null",
  "city": "city name or null",
  "price": number or null,
  "rooms": number or null,
  "sqm": number or null,
  "floor": number or null,
  "total_floors": number or null,
  "description": "listing description text or null",
  "amenities": ["only amenities ACTUALLY found on the page"],
  "contact_name": "name or null",
  "contact_phone": "phone or null",
  "image_urls": ["url1", "url2", ...]
}

CRITICAL RULES — MUST FOLLOW:
1. Extract ONLY data that ACTUALLY appears in the fetched page content. Do NOT invent, guess, or assume any data.
2. For amenities: ONLY include amenities that are EXPLICITLY LISTED on the page. An empty array [] is correct if none found.
3. IMPORTANT: Check ALL data sources in the content — JSON structured data, OG meta tags, page title, description text, aria labels.
4. For Madlan: the OG title often contains the full address. NEXT_DATA JSON contains rooms/price/sqm/floor/amenities.
5. For Facebook: parse the description text carefully for price (₪/ש"ח), rooms (חדרים), sqm (מ"ר), floor (קומה), phone numbers.
6. Keep original Hebrew terms. Return ONLY valid JSON.`,
              }],
            },
          });

          if (res.data && !res.error) {
            const content = typeof res.data === "string" ? res.data : res.data?.content;
            if (content) {
              extracted = parseExtractedJson(content);
              // If we got meaningful data, break the retry loop
              if (extracted && (extracted.address || extracted.city || extracted.price || extracted.rooms)) {
                break;
              }
            }
          }
        } catch (err) {
          console.error(`AI extraction attempt ${attempt + 1} error:`, err);
        }
        // Brief delay between retries
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      // Even partial data is useful — show it and let user complete manually
      if (extracted && (extracted.address || extracted.city || extracted.price || extracted.rooms || extracted.description)) {
        const hasAllFields = extracted.address && extracted.price && extracted.rooms;
        if (!hasAllFields) {
          setExtractionPartial(true);
        }
        setUrlExtracted(extracted);
        toast.success(t("addListingExtra.extractSuccess"));
        return extracted;
      }

      // If AI truly returned nothing, provide helpful message but don't block
      const isFb = inputUrl.includes("facebook.com") || inputUrl.includes("fb.com");
      toast.warning(
        isFb
          ? (language === "he"
              ? "פייסבוק חוסם גישה אוטומטית. מלאו את הפרטים ידנית ושמרו — הקישור יישמר."
              : "Facebook blocks automated access. Fill in the details manually and save — the link will be saved.")
          : t("addListingExtra.extractPartial")
      );
      // Set minimal extracted data so user can still save with the URL
      const minimal = {
        address: null, neighborhood: null, city: null,
        price: null, rooms: null, sqm: null, floor: null, total_floors: null,
        description: null, amenities: [], contact_name: null, contact_phone: null,
        image_urls: [],
      };
      setUrlExtracted(minimal);
      setExtractionPartial(true);
      return minimal;
    } catch (err) {
      console.error("URL extraction error:", err);
      toast.error(t("addListingExtra.extractError"));
      return null;
    } finally {
      setUrlFetching(false);
    }
  };

  // Auto-extract when a valid URL is pasted
  useEffect(() => {
    if (!autoExtractRef.current) return;
    autoExtractRef.current = false;
    if (!url || urlFetching || urlExtracted) return;
    if (!urlSchema.safeParse(url).success) return;
    // Small delay to let the UI update
    const timer = setTimeout(() => {
      setUrlError("");
      setDuplicateInfo(null);
      const extractPromise = extractFromUrl(url);
      if (url) checkDuplicateHint(url);
      extractPromise.catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle URL paste event - auto-clean tracking params and trigger extraction
  const handleUrlPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted) return;
    // Check if it looks like a URL
    if (urlSchema.safeParse(pasted).success) {
      e.preventDefault();
      const cleaned = normalizeUrl(pasted);
      setUrl(cleaned);
      setUrlError("");
      setUrlExtracted(null);
      setExtractionPartial(false);
      setDuplicateInfo(null);
      autoExtractRef.current = true;
    }
  }, []);

  // Extract listing data from pasted text content (Facebook post copy-paste)
  const extractFromPastedContent = async () => {
    if (!pastedContent.trim()) return;
    setPasteExtracting(true);
    try {
      const res = await supabase.functions.invoke("ai-assist", {
        body: {
          type: "extract",
          messages: [{
            role: "user",
            content: `Extract rental listing data from this Facebook post text that the user copied and pasted:\n\n--- POST CONTENT START ---\n${pastedContent.trim()}\n--- POST CONTENT END ---\n\nReturn JSON with all extracted fields. This is raw text copied from a Facebook listing post.`,
          }],
        },
      });

      if (res.data && !res.error) {
        const content = typeof res.data === "string" ? res.data : res.data?.content;
        if (content) {
          const extracted = parseExtractedJson(content);
          if (extracted && (extracted.address || extracted.city || extracted.price || extracted.rooms || extracted.description)) {
            setUrlExtracted(extracted);
            const hasAllFields = extracted.address && extracted.price && extracted.rooms;
            setExtractionPartial(!hasAllFields);
            toast.success(t("addListingExtra.extractSuccess"));
            setPastedContent("");
          } else {
            toast.warning(language === "he" ? "לא הצלחנו לחלץ נתונים מהטקסט. נסו להדביק יותר טקסט." : "Could not extract data from text. Try pasting more text.");
          }
        }
      }
    } catch (err) {
      console.error("Paste extraction error:", err);
      toast.error(language === "he" ? "שגיאה בחילוץ נתונים" : "Error extracting data");
    } finally {
      setPasteExtracting(false);
    }
  };

  // Step 1: Extract data preview from URL
  const handleUrlExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlSchema.safeParse(url).success) {
      setUrlError(t("addListing.invalidUrl"));
      return;
    }
    setUrlError("");
    setDuplicateInfo(null);
    // Extract first, check duplicate in background (non-blocking hint only)
    const extractPromise = extractFromUrl(url);
    if (url) checkDuplicateHint(url);
    await extractPromise;
  };

  // Soft duplicate info — NEVER blocks saving, purely informational
  const [duplicateInfo, setDuplicateInfo] = useState<string | null>(null);

  /** Strip tracking/share params from URLs for consistent comparison and clean fetching */
  const normalizeUrl = (rawUrl: string): string => {
    try {
      const u = new URL(rawUrl);
      const stripParams = [
        "fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
        "ref", "mibextid", "sfnsn", "s", "fs", "app", "gclid", "dclid",
        "tracking_event", "tracking_source", "tracking_medium", "tracking_campaign",
        "mc_cid", "mc_eid", "source", "medium", "campaign",
        "_branch_match_id", "_branch_referrer",
      ];
      stripParams.forEach((p) => u.searchParams.delete(p));
      // For Madlan: strip ALL query params — clean path is the listing ID
      if (u.hostname.includes("madlan.co.il") && u.pathname.startsWith("/listings/")) {
        u.search = "";
      }
      return u.toString().replace(/\/+$/, "");
    } catch {
      return rawUrl;
    }
  };

  /** Non-blocking duplicate hint — never prevents saving */
  const checkDuplicateHint = async (sourceUrl: string) => {
    if (!user || !sourceUrl) return;
    try {
      const normalized = normalizeUrl(sourceUrl);
      const { data } = await supabase
        .from("listings")
        .select("id, address, city, source_url")
        .eq("user_id", user.id)
        .eq("status", "active")
        .not("source_url", "is", null)
        .limit(100);
      if (data) {
        const match = data.find((row) => {
          if (!row.source_url) return false;
          return row.source_url === sourceUrl || normalizeUrl(row.source_url) === normalized;
        });
        if (match && (match.address || match.city)) {
          const label = match.address || match.city;
          setDuplicateInfo(
            language === "he"
              ? `שים לב: דירה דומה אולי כבר קיימת ("${label}"). ניתן לשמור בכל מקרה.`
              : `Note: A similar listing may exist ("${label}"). You can still save.`
          );
          return;
        }
      }
    } catch { /* ignore */ }
    setDuplicateInfo(null);
  };

  // Step 2: Confirm and save extracted data
  const handleUrlSave = async () => {
    if (!urlExtracted) return;
    const listing: Record<string, unknown> = {
      user_id: user!.id,
      source_url: normalizeUrl(url),
      address: urlExtracted.address || null,
      city: urlExtracted.city || null,
      price: urlExtracted.price || null,
      rooms: urlExtracted.rooms || null,
      sqm: urlExtracted.sqm || null,
      floor: urlExtracted.floor || null,
      total_floors: urlExtracted.total_floors || null,
      description: urlExtracted.description || null,
      contact_name: urlExtracted.contact_name || null,
      contact_phone: urlExtracted.contact_phone || null,
      amenities: urlExtracted.amenities || [],
      image_urls: urlExtracted.image_urls || [],
    };
    insertMutation.mutate(listing);
  };

  // Update extracted field inline
  const updateExtracted = (field: string, value: any) => {
    setUrlExtracted((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const renderFieldError = (field: string) =>
    formErrors[field] ? <p className="text-xs text-destructive mt-0.5">{formErrors[field]}</p> : null;

  const isLoading = insertMutation.isPending || uploading || urlFetching || pasteExtracting;

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
            <form onSubmit={handleUrlExtract} className="space-y-4 pt-2">
              <div>
                <div className="relative">
                  <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("addListing.urlPlaceholder")}
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setUrlError(""); setUrlExtracted(null); setExtractionPartial(false); setDuplicateInfo(null); }}
                    onPaste={handleUrlPaste}
                    className="ps-10"
                    required
                  />
                </div>
                {urlError && <p className="text-xs text-destructive mt-0.5">{urlError}</p>}
              </div>

              {/* Source detection indicator */}
              {url && urlSchema.safeParse(url).success && !urlExtracted && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2"
                >
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {t("addListingExtra.sourceLabel")}:
                    <strong className="text-foreground">{getSourceDisplayName(url)}</strong>
                  </span>
                  <Sparkles className="h-3 w-3 text-primary ms-auto" />
                  <span className="text-primary">
                    {t("addListingExtra.aiWillExtract")}
                  </span>
                </motion.div>
              )}

              {!urlExtracted && !urlFetching && (
                <p className="text-xs text-muted-foreground">
                  {t("addListingExtra.urlHint")}
                </p>
              )}

              {/* Loading state with animated progress */}
              <AnimatePresence>
                {urlFetching && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 p-5 space-y-4 relative overflow-hidden"
                  >
                    {/* Dual animated scan lines */}
                    <motion.div
                      className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/70 to-transparent"
                      initial={{ top: 0 }}
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute inset-y-0 w-[2px] bg-gradient-to-b from-transparent via-accent/40 to-transparent"
                      initial={{ left: 0 }}
                      animate={{ left: ["0%", "100%", "0%"] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Source badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-sm text-primary font-semibold">
                        <motion.div
                          className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center"
                          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Sparkles className="h-4 w-4" />
                        </motion.div>
                        {t("addListingExtra.fetchingData")}
                      </div>
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                      >
                        {getSourceDisplayName(url)}
                      </motion.span>
                    </div>

                    {/* Steps with stagger */}
                    <div className="space-y-2">
                      {[
                        { step: language === "he" ? "מתחבר לדף..." : "Connecting to page...", delay: 0 },
                        { step: language === "he" ? "קורא תוכן ונתונים מובנים..." : "Reading content & structured data...", delay: 1.5 },
                        { step: language === "he" ? "מזהה תמונות ופרטי דירה..." : "Identifying images & listing details...", delay: 3 },
                        { step: language === "he" ? "AI מנתח ומפיק נתונים..." : "AI analyzing & extracting data...", delay: 5 },
                      ].map(({ step, delay }, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: direction === "rtl" ? 16 : -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
                          className="flex items-center gap-2 text-xs"
                        >
                          <motion.div
                            className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0"
                            animate={{ backgroundColor: ["hsl(var(--primary) / 0.1)", "hsl(var(--primary) / 0.25)", "hsl(var(--primary) / 0.1)"] }}
                            transition={{ delay: delay + 0.5, duration: 1.5, repeat: Infinity }}
                          >
                            <motion.div
                              className="w-1.5 h-1.5 rounded-full bg-primary"
                              animate={{ scale: [1, 1.5, 1] }}
                              transition={{ delay: delay + 0.3, duration: 0.8, repeat: Infinity }}
                            />
                          </motion.div>
                          <span className="text-muted-foreground">{step}</span>
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: delay + 2 }}
                            className="ms-auto"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary/60" />
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary"
                        initial={{ width: "0%" }}
                        animate={{ width: "92%" }}
                        transition={{ duration: 12, ease: "easeOut" }}
                        style={{ backgroundSize: "200% 100%" }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 text-center">
                      {language === "he" ? "מנתח נתונים מהדף — אנא המתינו..." : "Analyzing page data — please wait..."}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Extracted data preview - full details */}
              <AnimatePresence>
                {urlExtracted && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("addListingExtra.dataExtracted")}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {getSourceDisplayName(url)}
                      </span>
                    </div>

                    {/* Partial extraction warning with specific missing fields */}
                    {extractionPartial && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 space-y-1.5"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span className="font-medium">{t("addListingExtra.dataMissing")}</span>
                        </div>
                        {(() => {
                          const missing: string[] = [];
                          if (!urlExtracted?.address) missing.push(t("addListing.address"));
                          if (!urlExtracted?.city) missing.push(t("addListing.city"));
                          if (!urlExtracted?.price) missing.push(t("addListing.price"));
                          if (!urlExtracted?.rooms) missing.push(t("addListing.rooms"));
                          if (!urlExtracted?.sqm) missing.push(t("addListing.sqm"));
                          if (urlExtracted?.floor == null) missing.push(t("addListing.floor"));
                          if (!urlExtracted?.contact_name) missing.push(t("addListing.contactName"));
                          if (!urlExtracted?.contact_phone) missing.push(t("addListing.contactPhone"));
                          if (missing.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1 ps-5">
                              {missing.map((field) => (
                                <span key={field} className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/25 text-[10px] font-medium">
                                  {field}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}

                    {/* Paste content fallback for Facebook when extraction is partial/empty */}
                    {extractionPartial && (url.includes("facebook.com") || url.includes("fb.com")) && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {language === "he"
                            ? "💡 פייסבוק חוסם גישה אוטומטית. הדביקו את טקסט הפוסט כאן והAI יחלץ את הנתונים:"
                            : "💡 Facebook blocks automated access. Paste the post text here and AI will extract the data:"}
                        </p>
                        <Textarea
                          value={pastedContent}
                          onChange={(e) => setPastedContent(e.target.value)}
                          placeholder={language === "he"
                            ? "הדביקו כאן את הטקסט מהפוסט בפייסבוק (העתיקו את כל הפוסט)..."
                            : "Paste the Facebook post text here (copy the entire post)..."}
                          className="text-xs min-h-[80px] resize-none"
                          dir="auto"
                        />
                        {pastedContent.trim() && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={extractFromPastedContent}
                            disabled={pasteExtracting}
                            className="w-full gap-1.5"
                          >
                            {pasteExtracting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            {language === "he" ? "שלוף מהטקסט" : "Extract from text"}
                          </Button>
                        )}
                      </motion.div>
                    )}

                    {/* Extracted images */}
                    {urlExtracted.image_urls?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <ImageIcon className="h-3 w-3" />
                          {urlExtracted.image_urls.length} {t("addListingExtra.imagesFound")}
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                          {urlExtracted.image_urls.slice(0, 5).map((imgUrl: string, i: number) => (
                            <motion.img
                              key={i}
                              src={imgUrl}
                              alt=""
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.1 }}
                              className="w-16 h-16 rounded-lg object-cover ring-1 ring-border/40 shrink-0 hover:ring-primary/60 transition-all"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ))}
                          {urlExtracted.image_urls.length > 5 && (
                            <div className="w-16 h-16 rounded-lg bg-muted/80 flex items-center justify-center text-xs text-muted-foreground shrink-0 font-medium">
                              +{urlExtracted.image_urls.length - 5}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Soft duplicate hint — informational only, never blocks */}
                    {duplicateInfo && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 flex items-start gap-2"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{duplicateInfo}</span>
                        <button
                          type="button"
                          onClick={() => setDuplicateInfo(null)}
                          className="ms-auto shrink-0"
                        >
                          <X className="h-3.5 w-3.5 text-blue-400 hover:text-foreground transition-colors" />
                        </button>
                      </motion.div>
                    )}

                    {/* Editable fields */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="col-span-2">
                        <label className="text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary" /> {t("addListing.address")}
                        </label>
                        <Input
                          value={urlExtracted.address ?? ""}
                          onChange={(e) => updateExtracted("address", e.target.value || null)}
                          placeholder={t("addListing.address")}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-primary" /> {t("addListing.city")}
                        </label>
                        <Input
                          value={urlExtracted.city ?? ""}
                          onChange={(e) => updateExtracted("city", e.target.value || null)}
                          placeholder={t("addListing.city")}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-primary" /> {t("addListing.price")}
                        </label>
                        <Input
                          type="number"
                          value={urlExtracted.price ?? ""}
                          onChange={(e) => updateExtracted("price", e.target.value ? Number(e.target.value) : null)}
                          placeholder="₪"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
                          <BedDouble className="h-3 w-3 text-primary" /> {t("addListing.rooms")}
                        </label>
                        <Input
                          type="number"
                          step="0.5"
                          value={urlExtracted.rooms ?? ""}
                          onChange={(e) => updateExtracted("rooms", e.target.value ? Number(e.target.value) : null)}
                          placeholder={t("addListing.rooms")}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
                          <Maximize className="h-3 w-3 text-primary" /> {t("addListing.sqm")}
                        </label>
                        <Input
                          type="number"
                          value={urlExtracted.sqm ?? ""}
                          onChange={(e) => updateExtracted("sqm", e.target.value ? Number(e.target.value) : null)}
                          placeholder="m²"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-primary" /> {t("addListing.floor")}
                        </label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={urlExtracted.floor ?? ""}
                            onChange={(e) => updateExtracted("floor", e.target.value ? Number(e.target.value) : null)}
                            placeholder={t("addListing.floor")}
                            className="h-8 text-xs flex-1"
                          />
                          <Input
                            type="number"
                            value={urlExtracted.total_floors ?? ""}
                            onChange={(e) => updateExtracted("total_floors", e.target.value ? Number(e.target.value) : null)}
                            placeholder="/"
                            className="h-8 text-xs w-14"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
                          <User className="h-3 w-3 text-primary" /> {t("addListing.contactName")}
                        </label>
                        <Input
                          value={urlExtracted.contact_name ?? ""}
                          onChange={(e) => updateExtracted("contact_name", e.target.value || null)}
                          placeholder={t("addListing.contactName")}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-primary" /> {t("addListing.contactPhone")}
                        </label>
                        <Input
                          value={urlExtracted.contact_phone ?? ""}
                          onChange={(e) => updateExtracted("contact_phone", e.target.value || null)}
                          placeholder={t("addListing.contactPhone")}
                          className="h-8 text-xs"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* Amenities */}
                    {urlExtracted.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {urlExtracted.amenities.map((a: string) => (
                          <span key={a} className="text-[10px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full text-primary font-medium">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Description preview */}
                    {urlExtracted.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed bg-muted/30 rounded-lg px-2.5 py-2">
                        {urlExtracted.description}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons */}
              {!urlExtracted && !urlFetching ? (
                <Button type="submit" className="w-full gap-2 glow-primary" disabled={isLoading}>
                  <Sparkles className="h-4 w-4" />
                  {t("addListing.fetch")}
                </Button>
              ) : urlExtracted ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => { setUrlExtracted(null); setExtractionPartial(false); }}
                    disabled={isLoading}
                  >
                    {t("addListingExtra.reExtract")}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-1.5 glow-primary"
                    onClick={handleUrlSave}
                    disabled={isLoading}
                  >
                    {insertMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("addListingExtra.saving")}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {t("addListingExtra.saveToInbox")}
                      </>
                    )}
                  </Button>
                </div>
              ) : null}
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
                        {t("addListingExtra.uploadPhotos")}
                      </p>
                      <p className="text-xs">
                        {t("addListingExtra.uploadPhotosDesc").replace("{max}", String(MAX_IMAGES))}
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

              {/* Floor / Total Floors + Phone */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Input placeholder={t("addListing.floor")} type="number" {...f("floor")} min={-5} max={100} className="text-sm" />
                  {renderFieldError("floor")}
                </div>
                <div>
                  <Input placeholder={language === "he" ? "מתוך קומות" : "Total floors"} type="number" {...f("total_floors")} min={1} max={100} className="text-sm" />
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
                  placeholder={t("addListingExtra.listingUrl")}
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
                      ? t("addListingExtra.uploadingImages")
                      : t("addListingExtra.saving")}
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
