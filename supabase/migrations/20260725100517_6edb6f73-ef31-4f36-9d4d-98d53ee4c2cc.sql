
CREATE POLICY "produtos_photos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'produtos');
CREATE POLICY "produtos_photos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'produtos');
CREATE POLICY "produtos_photos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'produtos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente')));
CREATE POLICY "produtos_photos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'produtos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente')));
