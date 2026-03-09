import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const offsetRef = useRef(0);
  const lastTimeRef = useRef<number>(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchArtists = async () => {
      const { data: artistData } = await supabase
        .from("artist_image_cache")
        .select("name, image_url")
        .not("image_url", "is", null)
        .limit(20);

      if (artistData && artistData.length > 0) {
        setArtists(artistData.map((a) => ({
          name: a.name,
          slug: slugify(a.name),
          imageUrl: a.image_url!,
        })));
        return;
      }

      const { data: songData } = await supabase
        .from("song_image_cache")
        .select("artist, image_url")
        .not("image_url", "is", null)
        .limit(20);

      if (songData) {
        const artistMap = new Map<string, string>();
        songData.forEach((s) => {
          if (!artistMap.has(s.artist)) artistMap.set(s.artist, s.image_url!);
        });
        setArtists(Array.from(artistMap.entries()).map(([name, imageUrl]) => ({
          name,
          slug: slugify(name),
          imageUrl,
        })));
      }
    };
    fetchArtists();
  }, []);

  // CSS-based scroll animation
  useEffect(() => {
    if (artists.length === 0) return;

    const SPEED = 50; // pixels per second
    const itemWidth = 294; // 282 + 12 gap
    const totalWidth = artists.length * itemWidth;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (!isPaused) {
        offsetRef.current -= (SPEED * delta) / 1000;
        if (Math.abs(offsetRef.current) >= totalWidth) {
          offsetRef.current += totalWidth;
        }
        if (scrollRef.current) {
          scrollRef.current.style.transform = `translateX(${offsetRef.current}px)`;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [artists, isPaused]);

  if (artists.length === 0) return null;

  const duplicatedArtists = [...artists, ...artists, ...artists];

  return (
    <div
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={scrollRef}
        className="flex gap-3 will-change-transform"
      >
        {duplicatedArtists.map((artist, index) => (
          <Link
            key={`${artist.slug}-${index}`}
            to={`/artists-like/${artist.slug}`}
            className="shrink-0 group relative"
          >
            <div className="w-[282px] h-[282px] rounded-md overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300 hover:scale-105">
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
              {/* Desktop: hover overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none p-3 pt-8 hidden sm:flex items-end z-10">
                <p className="text-white font-medium text-sm truncate">{artist.name}</p>
              </div>
            </div>
            {/* Mobile: always-visible name below */}
            {isMobile && (
              <p className="text-xs text-muted-foreground mt-1.5 truncate text-center w-[282px]">
                {artist.name}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AlbumCarousel;
