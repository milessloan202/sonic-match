import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Artist {
  name: string;
  slug: string;
  imageUrl: string;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const AlbumCarousel = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchArtists = async () => {
      // Fetch artist images from cache
      const { data: artistData } = await supabase
        .from("artist_image_cache")
        .select("name, image_url")
        .not("image_url", "is", null)
        .limit(20);

      if (artistData && artistData.length > 0) {
        const formattedArtists = artistData.map((artist) => ({
          name: artist.name,
          slug: slugify(artist.name),
          imageUrl: artist.image_url!,
        }));
        setArtists(formattedArtists);
        return;
      }

      // Fallback: get album covers from song cache
      const { data: songData } = await supabase
        .from("song_image_cache")
        .select("artist, image_url")
        .not("image_url", "is", null)
        .limit(20);

      if (songData) {
        // Group by artist and take first image
        const artistMap = new Map<string, string>();
        songData.forEach((song) => {
          if (!artistMap.has(song.artist)) {
            artistMap.set(song.artist, song.image_url!);
          }
        });

        const formattedArtists = Array.from(artistMap.entries()).map(([name, imageUrl]) => ({
          name,
          slug: slugify(name),
          imageUrl,
        }));
        setArtists(formattedArtists);
      }
    };

    fetchArtists();
  }, []);

  if (artists.length === 0) return null;

  // Duplicate artists array to create seamless loop
  const duplicatedArtists = [...artists, ...artists, ...artists];

  return (
    <TooltipProvider>
      <div className="relative w-full overflow-hidden">
        <div
          className="flex gap-3"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <motion.div
            className="flex gap-3"
            animate={{
              x: [0, -artists.length * 294], // 282px width + 12px gap
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: artists.length * 3,
                ease: "linear",
              },
            }}
            style={{
              animationPlayState: isPaused ? "paused" : "running",
            }}
          >
            {duplicatedArtists.map((artist, index) => (
              <Tooltip key={`${artist.slug}-${index}`} delayDuration={200}>
                <TooltipTrigger asChild>
                  <Link
                    to={`/artists-like/${artist.slug}`}
                    className="shrink-0 group"
                  >
                    <div className="w-[282px] h-[282px] rounded-md overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:glow-primary">
                      <img
                        src={artist.imageUrl}
                        alt={artist.name}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{artist.name}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </motion.div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AlbumCarousel;
