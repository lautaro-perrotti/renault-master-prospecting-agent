ALTER TABLE message_sequences ADD COLUMN IF NOT EXISTS human_response boolean NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS outbound_state text NOT NULL DEFAULT 'DRAFT';
ALTER TABLE replies ADD COLUMN IF NOT EXISTS gmail_message_id text;
CREATE UNIQUE INDEX IF NOT EXISTS messages_idempotency_uq ON messages(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS replies_gmail_message_uq ON replies(gmail_message_id) WHERE gmail_message_id IS NOT NULL;
