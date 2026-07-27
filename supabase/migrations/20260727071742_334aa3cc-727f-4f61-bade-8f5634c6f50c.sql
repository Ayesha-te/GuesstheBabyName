CREATE TABLE public.guesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name TEXT NOT NULL,
  email TEXT NOT NULL,
  guess_name TEXT NOT NULL,
  guess_key TEXT GENERATED ALWAYS AS (lower(btrim(guess_name))) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX guesses_email_unique ON public.guesses (lower(btrim(email)));

GRANT ALL ON public.guesses TO service_role;

ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.event_state (
  id INT NOT NULL PRIMARY KEY DEFAULT 1,
  baby_name TEXT,
  revealed BOOLEAN NOT NULL DEFAULT false,
  winner_id UUID REFERENCES public.guesses(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT event_state_singleton CHECK (id = 1)
);

GRANT ALL ON public.event_state TO service_role;

ALTER TABLE public.event_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.event_state (id, baby_name, revealed) VALUES (1, NULL, false);