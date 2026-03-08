CREATE POLICY "Service role can update song_image_cache"
ON public.song_image_cache
FOR UPDATE
USING (true)
WITH CHECK (true);