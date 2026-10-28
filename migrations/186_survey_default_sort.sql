-- Survey's plain en-US localeCompare: numeric=false, sensitivity=variant.
-- Unlike the Certificate natural collation, case and accents remain significant.
-- Nondeterminism preserves ICU-equal strings as ties (e.g. composed/decomposed
-- accents or ignored format characters), resolved by prior source/sequence order.
CREATE COLLATION IF NOT EXISTS public.surveys_default_en_us (
  provider = icu,
  locale = 'en-US',
  deterministic = false
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_collation c
    JOIN pg_namespace n ON n.oid = c.collnamespace
    WHERE n.nspname = 'public' AND c.collname = 'surveys_default_en_us'
      AND c.collprovider = 'i' AND c.collisdeterministic = false
      AND coalesce(to_jsonb(c)->>'colllocale', to_jsonb(c)->>'colliculocale') = 'en-US'
  ) THEN
    RAISE EXCEPTION 'Survey default sorting collation has incompatible settings';
  END IF;
END $$;
