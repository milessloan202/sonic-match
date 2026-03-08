import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AudioProvider } from "@/contexts/AudioContext";
import Index from "./pages/Index";
import SongPage from "./pages/SongPage";
import ArtistPage from "./pages/ArtistPage";
import ProducerPage from "./pages/ProducerPage";
import VibePage from "./pages/VibePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AudioProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/songs-like/:slug" element={<SongPage />} />
              <Route path="/artists-like/:slug" element={<ArtistPage />} />
              <Route path="/vibes/:slug" element={<VibePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AudioProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
