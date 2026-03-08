import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { slug, page_type } = await req.json();
    if (!slug || !page_type) {
      return new Response(JSON.stringify({ error: "slug and page_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if page already exists
    const { data: existing } = await supabase
      .from("seo_pages")
      .select("id")
      .eq("slug", slug)
      .eq("page_type", page_type)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ status: "exists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate content with Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    const typeLabels: Record<string, string> = {
      song: "song",
      artist: "artist",
      vibe: "vibe/mood",
    };

    const prompt = `Generate music recommendation data for a programmatic SEO page about ${typeLabels[page_type]}: "${displayName}".

Return a JSON object with these fields:
- title: SEO page title (under 60 chars)
- meta_description: SEO meta description (under 160 chars)
- heading: The page H1 heading
- summary: 1-2 sentence description of this ${typeLabels[page_type]}
- closest_matches: array of 3 objects with {title, subtitle, tag} where tag is a percentage match
- same_energy: array of 3 objects with {title, subtitle}
- related_artists: array of 3 objects with {title, subtitle}
- why_these_work: array of 2 objects with {title, subtitle}
- related_songs: array of 4 objects with {name, slug} - related songs to link to
- related_vibes: array of 3 objects with {name, slug} - related vibes to link to
- related_artist_links: array of 3 objects with {name, slug} - related artists to link to

Use REAL music data - real artist names, real song names, real genres and vibes. Make the recommendations genuinely useful and accurate. Slugs should be lowercase-hyphenated versions of the names.

Return ONLY valid JSON, no markdown.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a music expert. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("No AI response content");

    // Parse JSON (handle potential markdown wrapping)
    let content;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      content = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    // Save to database
    const { error: insertError } = await supabase.from("seo_pages").insert({
      slug,
      page_type,
      title: content.title,
      meta_description: content.meta_description,
      heading: content.heading,
      summary: content.summary,
      closest_matches: content.closest_matches,
      same_energy: content.same_energy,
      related_artists: content.related_artists,
      why_these_work: content.why_these_work,
      related_songs: content.related_songs,
      related_vibes: content.related_vibes,
      related_artist_links: content.related_artist_links,
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ status: "created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-seo-page error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
