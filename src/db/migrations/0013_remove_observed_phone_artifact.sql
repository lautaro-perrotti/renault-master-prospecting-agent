-- Remove a phone-like value produced by a Cloudflare email-protection page.
-- It was observed in the persisted contact data as an IPv4 address after
-- the previous normalization migration had stripped its separators.
DELETE FROM contacts
WHERE phone = '181171121112'
   OR phone ~ '^[0-9]{1,3}([.][0-9]{1,3}){3}$';
