ALTER TABLE contacts ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'PUBLICLY_OBSERVED';
CREATE UNIQUE INDEX IF NOT EXISTS companies_place_uq ON companies(google_place_id) WHERE google_place_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sources_company_url_uq ON sources(company_id,url);
