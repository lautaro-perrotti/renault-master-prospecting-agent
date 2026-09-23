ALTER TABLE evidence DROP CONSTRAINT IF EXISTS evidence_company_id_source_url_excerpt_key;
DROP INDEX IF EXISTS evidence_company_url_excerpt_uq;
CREATE UNIQUE INDEX IF NOT EXISTS evidence_company_url_excerpt_hash_uq
  ON evidence(company_id,source_url,md5(excerpt));
