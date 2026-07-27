-- Additive migration: preserve every historical guess while introducing managed names.
CREATE TABLE public.guess_names (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT guess_names_name_not_blank CHECK (char_length(btrim(name)) BETWEEN 2 AND 60)
);

CREATE UNIQUE INDEX guess_names_name_key_unique
  ON public.guess_names (name_key) WHERE deleted_at IS NULL;
GRANT ALL ON public.guess_names TO service_role;
ALTER TABLE public.guess_names ENABLE ROW LEVEL SECURITY;

INSERT INTO public.guess_names (name)
SELECT min(btrim(guess_name))
FROM public.guesses
WHERE char_length(btrim(guess_name)) BETWEEN 2 AND 60
GROUP BY lower(btrim(guess_name))
ON CONFLICT DO NOTHING;

ALTER TABLE public.guesses
  ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'adult',
  ADD COLUMN mobile TEXT,
  ADD COLUMN guardian_name TEXT,
  ADD COLUMN guess_name_id UUID REFERENCES public.guess_names(id) ON DELETE SET NULL;

ALTER TABLE public.guesses ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.guesses
  ADD CONSTRAINT guesses_entry_type_check CHECK (entry_type IN ('adult', 'kid'));

UPDATE public.guesses g
SET guess_name_id = n.id
FROM public.guess_names n
WHERE n.name_key = g.guess_key;

DROP INDEX IF EXISTS public.guesses_email_unique;
CREATE UNIQUE INDEX guesses_adult_mobile_unique
  ON public.guesses (mobile)
  WHERE entry_type = 'adult' AND mobile IS NOT NULL;

