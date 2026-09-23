ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS transport_need integer NOT NULL DEFAULT 0 CHECK (transport_need BETWEEN 0 AND 30);
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS vehicle_fit integer NOT NULL DEFAULT 0 CHECK (vehicle_fit BETWEEN 0 AND 25);
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS recurrence integer NOT NULL DEFAULT 0 CHECK (recurrence BETWEEN 0 AND 15);
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS transport_fit integer NOT NULL DEFAULT 0 CHECK (transport_fit BETWEEN 0 AND 100);
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS use_case text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS refrigeration_fit text NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE research_results ADD COLUMN IF NOT EXISTS moves_physical_goods boolean;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS transport_operation text NOT NULL DEFAULT 'unknown';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS transport_fit_signals jsonb NOT NULL DEFAULT '[]';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS use_case text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS refrigeration_fit text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS recurrence_signals jsonb NOT NULL DEFAULT '[]';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS buying_signals jsonb NOT NULL DEFAULT '[]';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS contact_assessment text NOT NULL DEFAULT 'unknown';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS evidence_ids jsonb NOT NULL DEFAULT '[]';
