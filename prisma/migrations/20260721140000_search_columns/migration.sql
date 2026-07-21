-- Hebrew search foundation (SPEC §8).
--
-- Postgres ships no Hebrew stemmer, so this is deliberately a NORMALIZE +
-- 'simple' + trigram strategy rather than a linguistic one, and SPEC §8 sets a
-- measured exit criterion to decide whether it is good enough.
--
-- `unaccent()` is STABLE (verified: pg_proc.provolatile = 's'), so it CANNOT
-- appear in a GENERATED column — hence our own IMMUTABLE function.
--
-- !! CHANGING bm_normalize LATER IS A TRAP !!
-- `CREATE OR REPLACE` does NOT recompute STORED generated columns: existing
-- rows keep the OLD folding while queries use the NEW one, so search silently
-- stops finding them (verified — an existing row still read the old value
-- while a fresh row computed the new one). The only safe edit is, in ONE
-- migration: DROP both columns and their indexes, REPLACE the function, then
-- re-ADD columns and indexes. That is a full table rewrite; budget for it.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION bm_normalize(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT lower(
    -- 5. fold FINAL letters, so a search for שלום reaches שלומים. Hebrew has
    --    no stemmer here; without this every plural is a separate token. This
    --    is the most opinionated step and the one §8's measurement can most
    --    sensibly reverse — see the trap warning above before changing it.
    translate(
      -- 4. drop geresh/gershayim (U+05F3/05F4), used for abbreviations and
      --    acronyms (ר״ת), so they match however the writer typed them.
      regexp_replace(
        -- 3. strip nikud and cantillation, but NOT the characters in that
        --    block which are punctuation: maqaf U+05BE (a hyphen — removing
        --    it welds two words together), paseq U+05C0, sof pasuq U+05C3,
        --    nun hafukha U+05C6.
        regexp_replace(
          -- 2. drop bidi/zero-width marks and fold NBSP. Text pasted from a
          --    PDF or Word carries RLM/LRM/BOM/NBSP invisibly; without this a
          --    pasted title normalizes differently from a typed one and
          --    matches nothing, with no error anywhere.
          translate(
            regexp_replace(
              -- 1. NFKD first: decomposes the Alphabetic Presentation Forms
              --    (U+FB1D–FB4F — precomposed שׁ שׂ וֹ וּ יִ and the אל
              --    ligature) into base letters plus marks, which step 3 then
              --    removes. Without it those characters survive as distinct
              --    tokens. normalize() is IMMUTABLE (verified), so it is
              --    legal inside a generated column.
              normalize(input, NFKD),
              '[‎‏​﻿]', '', 'g'
            ),
            E' ', ' '
          ),
          -- Explicit codepoints, NOT literal combining characters: the
          -- literal range 0591-05C7 silently swallows maqaf (05BE, a
          -- HYPHEN), paseq 05C0, sof pasuq 05C3 and nun hafukha 05C6 —
          -- which welds בית־המדרש into one token. Marks only:
          E'[֑-ׇֽֿׁׂׅׄ]', '', 'g'
        ),
        E'[׳״]', '', 'g'
      ),
      E'ךםןףץ', E'כמנפצ'
    )
  );
$$;

-- Weighted vector: title outranks description. NOTE this A/B weighting is a
-- LOCAL decision, not something SPEC §8 states — recorded in docs/STACK.md so
-- the seven tables that copy this pattern copy a decision, not an accident.
-- setweight and the two-argument to_tsvector are IMMUTABLE; the one-argument
-- to_tsvector is not, which is why 'simple' is named explicitly.
ALTER TABLE "Topic"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple'::regconfig, bm_normalize(coalesce("title", ''))), 'A') ||
    setweight(to_tsvector('simple'::regconfig, bm_normalize(coalesce("description", ''))), 'B')
  ) STORED;

-- Plain normalized text for trigram matching: this answers partial and
-- misspelled Hebrew queries, which tsvector alone cannot. NOTE it is folded
-- and therefore NOT displayable — a future snippet/highlight feature must
-- ts_headline the raw title/description, not this column.
ALTER TABLE "Topic"
  ADD COLUMN "searchText" text
  GENERATED ALWAYS AS (
    bm_normalize(coalesce("title", '') || ' ' || coalesce("description", ''))
  ) STORED;

-- PARTIAL, like every other index in this schema: a soft-deleted topic is
-- hidden everywhere else, and it must not come back through search.
CREATE INDEX "Topic_searchVector_idx" ON "Topic" USING GIN ("searchVector")
  WHERE "deletedAt" IS NULL;
CREATE INDEX "Topic_searchText_idx" ON "Topic" USING GIN ("searchText" gin_trgm_ops)
  WHERE "deletedAt" IS NULL;
