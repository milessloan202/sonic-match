import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://sonic-match-six.vercel.app";

const prefixes: Record<string, string> = {
  song: "/songs-like",
  artist: "/artists-like",
  producer: "/producers-like",
  vibe: "/vibes",
};

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pages, error } = await supabase
      .from("seo_pages")
      .select("slug, page_type, updated_at")
      .eq("is_indexable", true);

    if (error) throw error;

    const urls = (pages || [])
      .filter((p) => prefixes[p.page_type])
      .map((p) => {
        const loc = `${SITE_URL}${prefixes[p.page_type]}/${p.slug}`;
        const lastmod = p.updated_at?.split("T")[0] || new Date().toISOString().split("T")[0];
        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
      });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
  </url>
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (e) {
    console.error("sitemap error:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
});
