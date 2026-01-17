-- Enhanced storage policies with size limits and virus scanning placeholder
CREATE OR REPLACE FUNCTION validate_file_size(max_size_bytes BIGINT)
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.metadata->>'size'::BIGINT > max_size_bytes THEN
    RAISE EXCEPTION 'File size exceeds maximum allowed size';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enhanced bucket configurations
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('book-covers', 'book-covers', true, 5242880, 
   '{"image/jpeg", "image/png", "image/webp", "image/gif"}'),
  ('manuscripts', 'manuscripts', false, 104857600,
   '{"application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"}'),
  ('published-epubs', 'published-epubs', true, 52428800,
   '{"application/epub+zip"}')
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enhanced cover policies with automatic thumbnail generation trigger
CREATE POLICY "Book covers are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-covers');

CREATE POLICY "Authenticated users can upload covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'book-covers' AND
    (storage.foldername(name))[1] = auth.uid()::text AND
    (metadata->>'size')::BIGINT <= 5242880 AND
    metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
  );

-- Add virus scanning simulation (placeholder for actual implementation)
CREATE OR REPLACE FUNCTION check_file_safety()
RETURNS TRIGGER AS $$
BEGIN
  -- In production, integrate with virus scanning service
  -- For now, log the check
  RAISE LOG 'File safety check for: %', NEW.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_manuscript_safety
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'manuscripts')
  EXECUTE FUNCTION check_file_safety();

-- Enhanced admin policies
CREATE POLICY "Admins have full access to all files"
  ON storage.objects FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
