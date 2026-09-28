WITH bad_contacts AS (
  SELECT id, company_id
  FROM contacts
  WHERE phone IS NOT NULL
    AND invalid = false
    AND (
      length(regexp_replace(phone, '[^0-9]', '', 'g')) > 15
      OR regexp_replace(phone, '[^0-9]', '', 'g') ~ '^(0+|1+|2+|3+|4+|5+|6+|7+|8+|9+)$'
      OR (length(regexp_replace(phone, '[^0-9]', '', 'g')) = 8 AND regexp_replace(phone, '[^0-9]', '', 'g') ~ '^(19|20)[0-9]{6}$')
    )
), marked AS (
  UPDATE contacts AS c
  SET invalid = true
  FROM bad_contacts AS b
  WHERE c.id = b.id
  RETURNING c.company_id
)
INSERT INTO audit_events(action, company_id, details)
SELECT 'CONTACT_DATA_INVALIDATED', company_id, jsonb_build_object('reason', 'PHONE_ARTIFACT_FILTER', 'count', count(*))
FROM marked
GROUP BY company_id;
