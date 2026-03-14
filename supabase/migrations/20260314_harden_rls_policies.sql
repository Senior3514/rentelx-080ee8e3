-- ============================================================
-- RentelX RLS Hardening: Block anonymous users from all tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- ========= PUBLIC TABLES =========

-- listing_notes
DROP POLICY IF EXISTS "ln_all" ON public.listing_notes;
CREATE POLICY "ln_all" ON public.listing_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

-- listing_reminders
DROP POLICY IF EXISTS "lr_all" ON public.listing_reminders;
CREATE POLICY "lr_all" ON public.listing_reminders FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

-- listings
DROP POLICY IF EXISTS "l_all" ON public.listings;
CREATE POLICY "l_all" ON public.listings FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

-- listing_scores
DROP POLICY IF EXISTS "ls_sel" ON public.listing_scores;
DROP POLICY IF EXISTS "ls_ins" ON public.listing_scores;
DROP POLICY IF EXISTS "ls_upd" ON public.listing_scores;
DROP POLICY IF EXISTS "ls_del" ON public.listing_scores;

CREATE POLICY "ls_sel" ON public.listing_scores FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE AND EXISTS (SELECT 1 FROM listings WHERE listings.id = listing_scores.listing_id AND listings.user_id = auth.uid()));
CREATE POLICY "ls_ins" ON public.listing_scores FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE AND EXISTS (SELECT 1 FROM listings WHERE listings.id = listing_scores.listing_id AND listings.user_id = auth.uid()));
CREATE POLICY "ls_upd" ON public.listing_scores FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE AND EXISTS (SELECT 1 FROM listings WHERE listings.id = listing_scores.listing_id AND listings.user_id = auth.uid()))
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE AND EXISTS (SELECT 1 FROM listings WHERE listings.id = listing_scores.listing_id AND listings.user_id = auth.uid()));
CREATE POLICY "ls_del" ON public.listing_scores FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE AND EXISTS (SELECT 1 FROM listings WHERE listings.id = listing_scores.listing_id AND listings.user_id = auth.uid()));

-- notification_preferences
DROP POLICY IF EXISTS "np_all" ON public.notification_preferences;
CREATE POLICY "np_all" ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

-- pipeline_entries
DROP POLICY IF EXISTS "pe_all" ON public.pipeline_entries;
CREATE POLICY "pe_all" ON public.pipeline_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

-- profiles
DROP POLICY IF EXISTS "p_ins" ON public.profiles;
DROP POLICY IF EXISTS "p_sel" ON public.profiles;
DROP POLICY IF EXISTS "p_upd" ON public.profiles;

CREATE POLICY "p_ins" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);
CREATE POLICY "p_sel" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);
CREATE POLICY "p_upd" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

-- search_profiles
DROP POLICY IF EXISTS "sp_all" ON public.search_profiles;
CREATE POLICY "sp_all" ON public.search_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

-- ========= STORAGE =========

DROP POLICY IF EXISTS "Users delete own images" ON storage.objects;
CREATE POLICY "Users delete own images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

DROP POLICY IF EXISTS "Users upload own images" ON storage.objects;
CREATE POLICY "Users upload own images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

-- Public read stays as-is (intentionally public for listing images)
