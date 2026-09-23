ALTER TABLE research_results ADD COLUMN IF NOT EXISTS usage jsonb;
DROP INDEX IF EXISTS contacts_company_phone_uq;
DELETE FROM contacts WHERE phone IS NOT NULL AND phone ~ '^[0-9]{1,3}([.][0-9]{1,3}){3}$';
UPDATE contacts SET phone=regexp_replace(phone,'[^0-9+]','','g') WHERE phone IS NOT NULL;
DELETE FROM contacts WHERE id IN (
  SELECT id FROM (
    SELECT id,row_number() OVER (PARTITION BY company_id,phone ORDER BY id) AS duplicate_number
    FROM contacts WHERE phone IS NOT NULL
  ) duplicates WHERE duplicate_number>1
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_company_phone_uq ON contacts(company_id,phone) WHERE phone IS NOT NULL;
