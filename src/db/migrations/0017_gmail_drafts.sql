ALTER TABLE messages ADD COLUMN IF NOT EXISTS gmail_draft_id text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS gmail_draft_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS messages_gmail_draft_id_uq
  ON messages(gmail_draft_id)
  WHERE gmail_draft_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messages_gmail_draft_message_id_uq
  ON messages(gmail_draft_message_id)
  WHERE gmail_draft_message_id IS NOT NULL;
