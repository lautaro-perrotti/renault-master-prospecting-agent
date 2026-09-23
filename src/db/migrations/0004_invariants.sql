ALTER TABLE qualifications ALTER COLUMN reasoning TYPE jsonb USING CASE WHEN reasoning IS NULL OR reasoning='' THEN '{}'::jsonb ELSE reasoning::jsonb END;
CREATE UNIQUE INDEX IF NOT EXISTS message_sequences_company_campaign_full_uq ON message_sequences(company_id,campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS qualifications_company_created_uq ON qualifications(company_id,created_at);
