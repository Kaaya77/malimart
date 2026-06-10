-- Full-text product search
-- Apply via Supabase SQL editor or CLI once the project is unrestricted.
-- Replaces client-side .includes() filtering with real Postgres FTS.

-- 1. Generated tsvector column (auto-maintained, weighted: name > category/tags > description)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) STORED;

-- 2. GIN index — makes search O(log n) regardless of catalog size
CREATE INDEX IF NOT EXISTS idx_products_search
  ON public.products USING GIN (search_vector);

-- Trigram fallback for partial-word matches ("kit" finds "kitenge")
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING GIN (name gin_trgm_ops);

-- 3. Search RPC — single round trip, small payload, ranked results
CREATE OR REPLACE FUNCTION public.search_products(
  p_query text,
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0
)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.products p
  WHERE p.status = 'active'
    AND (
      p.search_vector @@ websearch_to_tsquery('simple', p_query)
      OR p.name ILIKE '%' || p_query || '%'
    )
  ORDER BY
    ts_rank(p.search_vector, websearch_to_tsquery('simple', p_query)) DESC,
    p.created_at DESC
  LIMIT LEAST(p_limit, 50)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, int, int) TO anon, authenticated;
