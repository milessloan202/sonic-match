import { corsHeaders } from '../_shared/cors.ts';

const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
}

async function getSpotifyAccessToken(): Promise<string> {
  const auth = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get Spotify access token');
  }

  const data = await response.json();
  return data.access_token;
}

async function searchSpotifyTrack(query: string, accessToken: string): Promise<SpotifyTrack | null> {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to search Spotify');
  }

  const data = await response.json();
  const tracks = data.tracks?.items || [];
  return tracks.length > 0 ? tracks[0] : null;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Spotify access token
    const accessToken = await getSpotifyAccessToken();

    // Search for the track
    const track = await searchSpotifyTrack(query, accessToken);

    if (!track) {
      // Fallback to basic slugification if no track found
      return new Response(
        JSON.stringify({
          slug: slugify(query),
          song_title: query,
          artist_name: null,
          spotify_track_id: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const songTitle = track.name;
    const artistName = track.artists[0]?.name || '';
    const spotifyTrackId = track.id;

    // Create slug: song-artist
    const songSlug = slugify(songTitle);
    const artistSlug = slugify(artistName);
    const combinedSlug = `${songSlug}-${artistSlug}`;

    return new Response(
      JSON.stringify({
        slug: combinedSlug,
        song_title: songTitle,
        artist_name: artistName,
        spotify_track_id: spotifyTrackId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in resolve-song:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
