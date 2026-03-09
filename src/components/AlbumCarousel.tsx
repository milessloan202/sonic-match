import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface CarouselItem {
  name: string;
  slug: string;
  imageUrl: string;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function curateSelection(pool: CarouselItem[], count: number): CarouselItem[] {
  const shuffled = shuffle(pool);
  const seen = new Set<string>();
  const result: CarouselItem[] = [];

  for (const item of shuffled) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    result.push(item);
    if (result.length >= count) break;
  }

  return result;
}

const CAROUSEL_SIZE = 18;

const AlbumCarousel = () => {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const offsetRef = useRef(0);
  const lastTimeRef = useRef<number>(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchCovers = async () => {
      // Prefer song_image_cache for album cover artwork (not artist photos)
      const { data: songData } = await supabase
        .from("song_image_cache")
        .select("name, artist, image_url")
        .not("image_url", "is", null)
        .limit(300);

      if (songData && songData.length > 0) {
        // Deduplicate by artist, keeping one album cover per artist
        const artistMap = new Map<string, CarouselItem>();
        for (const s of songData) {
          if (!artistMap.has(s.artist)) {
            artistMap.set(s.artist, {
              name: s.artist,
              slug: slugify(s.artist),
              imageUrl: s.image_url!,
            });
          }
        }
        const pool = Array.from(artistMap.values());
        if (pool.length >= 6) {
          setItems(curateSelection(pool, CAROUSEL_SIZE));
          return;
        }
      }

      // Fallback to artist_image_cache if song covers are sparse
      const { data: artistData } = await supabase
        .from("artist_image_cache")
        .select("name, image_url")
        .not("image_url", "is", null)
        .limit(200);

      if (artistData && artistData.length > 0) {
        const pool = artistData.map((a) => ({
          name: a.name,
          slug: slugify(a.name),
          imageUrl: a.image_url!,
        }));
        setItems(curateSelection(pool, CAROUSEL_SIZE));
      }
    };
    fetchCovers();
  }, []);

  // rAF scroll animation
  useEffect(() => {
    if (items.length === 0) return;

    const SPEED = 50;
    const itemWidth = 294; // 282 + 12 gap
    const totalWidth = items.length * itemWidth;

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
  }, [items, isPaused]);

  if (items.length === 0) return null;

  const duplicated = [...items, ...items, ...items];

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
        {duplicated.map((item, index) => (
          <Link
            key={`${item.slug}-${index}`}
            to={`/artists-like/${item.slug}`}
            className="shrink-0 group relative"
          >
            <div
              className="w-[282px] h-[282px] rounded-md overflow-hidden border border-border/50 transition-all duration-200 ease-out group-hover:-translate-y-1.5 group-hover:scale-[1.04] group-hover:shadow-xl group-hover:shadow-black/30 group-hover:border-primary/40 group-active:scale-[1.02] group-active:-translate-y-1"
            >
              <img
                src={item.imageUrl}
                alt={`Album cover – ${item.name}`}
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
              {/* Desktop: hover overlay with artist name */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out pointer-events-none p-3 pt-8 hidden sm:flex items-end z-10">
                <p className="text-white font-medium text-sm truncate translate-y-1 group-hover:translate-y-0 transition-transform duration-200 ease-out">
                  {item.name}
                </p>
              </div>
            </div>
            {/* Mobile: always-visible name below */}
            {isMobile && (
              <p className="text-xs text-muted-foreground mt-1.5 truncate text-center w-[282px]">
                {item.name}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AlbumCarousel;
