CREATE TABLE IF NOT EXISTS migration_history(
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_search_results(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES runs(id),
  provider text NOT NULL,
  query text NOT NULL,
  result_url text NOT NULL,
  title text NOT NULL,
  description text,
  classification text NOT NULL DEFAULT 'OTHER',
  classification_confidence integer NOT NULL DEFAULT 0 CHECK (classification_confidence BETWEEN 0 AND 100),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, query, result_url)
);

CREATE TABLE IF NOT EXISTS entity_candidates(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_result_id uuid NOT NULL REFERENCES raw_search_results(id),
  name text NOT NULL,
  normalized_name text NOT NULL,
  corporate_domain text,
  source_url text NOT NULL,
  confidence integer NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(raw_result_id)
);

CREATE TABLE IF NOT EXISTS provider_executions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES runs(id),
  provider text NOT NULL,
  query text NOT NULL,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  result_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_results(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  model text NOT NULL,
  business_model text NOT NULL,
  refrigeration_relevance integer NOT NULL CHECK (refrigeration_relevance BETWEEN 0 AND 100),
  distribution_model text NOT NULL,
  geography text NOT NULL,
  potential_transport_need text NOT NULL,
  signals jsonb NOT NULL DEFAULT '[]',
  uncertainties jsonb NOT NULL DEFAULT '[]',
  summary text NOT NULL,
  confidence integer NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operational_state(
  id boolean PRIMARY KEY DEFAULT true,
  state text NOT NULL DEFAULT 'RUNNING' CHECK (state IN ('RUNNING','PAUSED','STOPPED')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
INSERT INTO operational_state(id,state) VALUES(true,'RUNNING') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS outreach_send_reservations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id),
  period text NOT NULL,
  scope text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, period, scope)
);

ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS strategy text;
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS fingerprint text;
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS stop_reason text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS prepared_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reconciliation_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS failure_code text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sequence_step text;
ALTER TABLE message_sequences ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lease_owner text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES runs(id);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency_uq ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS message_sequences_company_campaign_uq ON message_sequences(company_id,campaign_id) WHERE status IN ('READY','ACTIVE','PAUSED');
CREATE UNIQUE INDEX IF NOT EXISTS messages_sequence_step_uq ON messages(sequence_id,sequence_step) WHERE sequence_step IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_gmail_id_uq ON messages(gmail_message_id) WHERE gmail_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS raw_search_result_run_idx ON raw_search_results(run_id);
CREATE INDEX IF NOT EXISTS raw_search_result_class_idx ON raw_search_results(classification);
CREATE INDEX IF NOT EXISTS provider_execution_run_idx ON provider_executions(run_id);
CREATE INDEX IF NOT EXISTS jobs_lease_idx ON jobs(status,lease_expires_at);
CREATE INDEX IF NOT EXISTS suppression_company_idx ON suppressions(company_id);
CREATE INDEX IF NOT EXISTS suppression_domain_idx ON suppressions(domain);
CREATE INDEX IF NOT EXISTS suppression_email_idx ON suppressions(email);
