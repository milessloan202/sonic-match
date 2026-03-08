import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface AudioState {
  currentTrack: string | null;
  isPlaying: boolean;
  progress: number;
  play: (trackId: string, url: string) => void;
  pause: () => void;
  toggle: (trackId: string, url: string) => void;
}

const AudioCtx = createContext<AudioState>({
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  play: () => {},
  pause: () => {},
  toggle: () => {},
});

export const useAudio = () => useContext(AudioCtx);

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const location = useLocation();

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
    setCurrentTrack(null);
    setIsPlaying(false);
    setProgress(0);
  }, []);

  // Stop on route change
  useEffect(() => {
    stopAll();
  }, [location.pathname, stopAll]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.duration) {
      setProgress((audio.currentTime / audio.duration) * 100);
    }
    if (audioRef.current && !audioRef.current.paused) {
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const play = useCallback(
    (trackId: string, url: string) => {
      // Stop previous
      if (audioRef.current) {
        audioRef.current.pause();
        cancelAnimationFrame(rafRef.current);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      setCurrentTrack(trackId);
      setProgress(0);

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setProgress(100);
        setCurrentTrack(null);
      });

      audio.play().then(() => {
        setIsPlaying(true);
        rafRef.current = requestAnimationFrame(updateProgress);
      }).catch(() => {
        setIsPlaying(false);
      });
    },
    [updateProgress]
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      cancelAnimationFrame(rafRef.current);
    }
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(
    (trackId: string, url: string) => {
      if (currentTrack === trackId && isPlaying) {
        pause();
      } else if (currentTrack === trackId && !isPlaying) {
        audioRef.current?.play().then(() => {
          setIsPlaying(true);
          rafRef.current = requestAnimationFrame(updateProgress);
        });
      } else {
        play(trackId, url);
      }
    },
    [currentTrack, isPlaying, pause, play, updateProgress]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <AudioCtx.Provider value={{ currentTrack, isPlaying, progress, play, pause, toggle }}>
      {children}
    </AudioCtx.Provider>
  );
};
