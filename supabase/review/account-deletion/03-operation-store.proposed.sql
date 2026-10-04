-- REVIEW ONLY / NOT EXECUTED. Required before enabling the app; never apply on startup.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public.account_deletion_operations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE, -- Deliberately no Auth FK: survives deletion for result reconciliation.
  session_id uuid NOT NULL,
  receipt_hash text NOT NULL UNIQUE CHECK (receipt_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('pending','verifying','ready','processing','unknown','succeeded')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  receipt_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (receipt_expires_at >= expires_at)
);
ALTER TABLE public.account_deletion_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_deletion_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_deletion_operations TO service_role;
-- No anon/authenticated policy. This table stores no email, password, OTP, JWT or record text.
COMMIT;
