ALTER TABLE research_results ADD COLUMN IF NOT EXISTS model_used text;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS escalation_reason text;
