ALTER TABLE contacts ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE research_results ADD COLUMN IF NOT EXISTS business_role text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS transport_demand_role text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS has_own_fleet text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS outsources_transport text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS outsourcing_signals jsonb NOT NULL DEFAULT '[]';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS delivery_operation text NOT NULL DEFAULT 'unknown';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'unknown';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS distribution_pattern text NOT NULL DEFAULT 'unknown';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS transport_opportunity integer NOT NULL DEFAULT 0 CHECK (transport_opportunity BETWEEN 0 AND 30);
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS transport_opportunity_reason text NOT NULL DEFAULT '';
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS regulatory_uncertainties jsonb NOT NULL DEFAULT '[]';

ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS transport_operation_fit integer NOT NULL DEFAULT 0 CHECK (transport_operation_fit BETWEEN 0 AND 30);
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS external_transport_demand integer NOT NULL DEFAULT 0 CHECK (external_transport_demand BETWEEN 0 AND 30);
