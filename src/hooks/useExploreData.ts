import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RegistryDescriptor {
  slug: string;
  label: string;
  category: string;
  is_public: boolean;
}

export interface DescriptorSong {
  song_title: string;
  artist_name: string;
  spotify_track_id: string;
}

/** Fetch all public descriptors from the registry, grouped by category. */
export function useDescriptorRegistry() {
  const [descriptors, setDescriptors] = useState<RegistryDescriptor[]>([]);
  const [grouped, setGrouped] = useState<Record<string, RegistryDescriptor[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("descriptor_registry")
      .select("slug, label, category, is_public")
      .eq("is_public", true)
      .order("label")
      .then(({ data }) => {
        const items = (data ?? []) as RegistryDescriptor[];
        setDescriptors(items);

        const groups: Record<string, RegistryDescriptor[]> = {};
        for (const d of items) {
          if (!groups[d.category]) groups[d.category] = [];
          groups[d.category].push(d);
        }
        setGrouped(groups);
        setLoading(false);
      });
  }, []);

  return { descriptors, grouped, loading };
}

/** Fetch songs matching a given descriptor slug. */
export function useSongsByDescriptor(slug: string, limit = 10) {
  const [songs, setSongs] = useState<DescriptorSong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("song_sonic_profiles")
      .select("song_title, artist_name, spotify_track_id")
      .contains("descriptor_slugs", [slug])
      .limit(limit)
      .then(({ data }) => {
        setSongs((data ?? []) as DescriptorSong[]);
        setLoading(false);
      });
  }, [slug, limit]);

  return { songs, loading };
}
