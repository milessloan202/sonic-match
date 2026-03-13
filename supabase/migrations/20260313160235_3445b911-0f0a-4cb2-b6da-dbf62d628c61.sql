
ALTER TABLE descriptor_registry DROP CONSTRAINT descriptor_registry_category_check;
ALTER TABLE descriptor_registry ADD CONSTRAINT descriptor_registry_category_check 
  CHECK (category = ANY (ARRAY[
    'tempo_feel', 'groove', 'groove_character', 'drum_character', 'bass_character',
    'harmonic_color', 'melodic_character', 'vocal_character', 'texture',
    'arrangement_energy_arc', 'emotional_tone', 'energy_posture', 'spatial_feel',
    'era_lineage', 'era_period', 'era_movement',
    'environment_imagery', 'listener_use_case',
    'intensity_level', 'danceability_feel'
  ]));
