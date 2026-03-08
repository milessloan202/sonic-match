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

    // Generate content with Claude API
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: "You are a music expert. Return only valid JSON.",
        messages: [
          { role: "user", content: prompt },
        ],
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
      throw new Error(`Claude API error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.content?.[0]?.text;
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
