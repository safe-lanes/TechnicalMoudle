-- Certificate natural ordering: Node's en-US numeric, base-sensitivity comparator.
-- Nondeterminism is intentional: case/accent/leading-zero equivalents must
-- remain ties, resolved by the existing vessel/sequence/source order.
CREATE COLLATION IF NOT EXISTS public.certificates_natural_en_us (
  provider = icu,
  locale = 'en-US-u-kn-true-ks-level1',
  deterministic = false
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_collation c
    JOIN pg_namespace n ON n.oid = c.collnamespace
    WHERE n.nspname = 'public' AND c.collname = 'certificates_natural_en_us'
      AND c.collprovider = 'i' AND c.collisdeterministic = false
      -- ICU may canonicalize boolean "kn-true" to its equivalent "kn".
      AND coalesce(to_jsonb(c)->>'colllocale', to_jsonb(c)->>'colliculocale')
        IN ('en-US-u-kn-true-ks-level1', 'en-US-u-kn-ks-level1')
  ) THEN
    RAISE EXCEPTION 'Certificate natural sorting collation has incompatible settings';
  END IF;
END $$;
