CREATE TABLE public.descriptor_registry (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        NOT NULL UNIQUE,
  label        text        NOT NULL,
  category     text        NOT NULL CHECK (category IN (
                             'tempo_feel', 'groove', 'drum_character',
                             'bass_character', 'harmonic_color', 'melodic_character',
                             'vocal_character', 'texture', 'arrangement_energy_arc',
                             'emotional_tone', 'era_lineage', 'environment_imagery',
                             'listener_use_case'
                           )),
  description  text        NOT NULL,
  tier         integer     NOT NULL DEFAULT 2 CHECK (tier IN (1, 2, 3)),
  is_public    boolean     NOT NULL DEFAULT true,
  is_clickable boolean     NOT NULL DEFAULT false,
  is_seo_enabled boolean   NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.descriptor_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read descriptor_registry"
  ON public.descriptor_registry FOR SELECT USING (true);

CREATE POLICY "Service role can insert descriptor_registry"
  ON public.descriptor_registry FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update descriptor_registry"
  ON public.descriptor_registry FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX idx_descriptor_registry_category ON public.descriptor_registry (category);
CREATE INDEX idx_descriptor_registry_tier      ON public.descriptor_registry (tier);
CREATE INDEX idx_descriptor_registry_clickable ON public.descriptor_registry (is_clickable) WHERE is_clickable = true;