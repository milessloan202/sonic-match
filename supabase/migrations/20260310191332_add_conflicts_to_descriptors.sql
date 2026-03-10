-- Add conflicts_with column to descriptor_registry
ALTER TABLE public.descriptor_registry
  ADD COLUMN conflicts_with text[] NOT NULL DEFAULT '{}';

-- Populate known conflicts
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['midtempo','driving','urgent','propulsive','floating','steady']      WHERE slug = 'slow-burn';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['urgent','driving','propulsive','marching']                          WHERE slug = 'laid-back';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['slow-burn','laid-back','floating','midtempo']                       WHERE slug = 'driving';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['slow-burn','laid-back','floating','midtempo']                       WHERE slug = 'urgent';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['triumphant','euphoric','glamorous','playful']                       WHERE slug = 'nocturnal';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['lo-fi','grainy','analog']                                           WHERE slug = 'glossy';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['glossy','polished','neon']                                          WHERE slug = 'lo-fi';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['major-key','bright']                                                WHERE slug = 'minor-key';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['minor-key','melancholic']                                           WHERE slug = 'major-key';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['triumphant','euphoric','playful','glamorous']                       WHERE slug = 'lonely';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['summer-daylight','house-party','club-floor']                        WHERE slug = 'after-hours';
UPDATE public.descriptor_registry SET conflicts_with = ARRAY['after-hours','night-drive','rainy-street','headphones-alone']       WHERE slug = 'summer-daylight';

CREATE INDEX idx_descriptor_registry_conflicts ON public.descriptor_registry USING GIN (conflicts_with);
