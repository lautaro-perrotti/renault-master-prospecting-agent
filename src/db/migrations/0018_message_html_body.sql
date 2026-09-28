ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS html_body text;
