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
import DnaPage from "./pages/DnaPage";
import DnaRedirect from "./components/DnaRedirect";
import SearchPage from "./pages/SearchPage";
import ExplorePage from "./pages/ExplorePage";
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
              <Route path="/producers-like/:slug" element={<ProducerPage />} />
              <Route path="/vibes/:slug" element={<VibePage />} />
              <Route path="/sounds/:slug" element={<DnaPage />} />
              <Route path="/sounds/:slug/:slug2" element={<DnaPage />} />
              <Route path="/dna/:slug" element={<DnaRedirect />} />
              <Route path="/dna/:slug/:slug2" element={<DnaRedirect />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AudioProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
