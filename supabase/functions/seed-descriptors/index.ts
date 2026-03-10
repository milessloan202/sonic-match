// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// seed-descriptors
// One-time (idempotent) function to populate descriptor_registry.
// Safe to run multiple times — uses upsert on slug.
// Call via POST with service role key.
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tier definitions:
//   1 = public clickable (SEO-indexed, /dna/{slug} route exists)
//   2 = UI only (shown as tags but not navigable)
//   3 = internal (used for scoring/explanation, never shown in UI)

interface Descriptor {
  slug: string;
  label: string;
  category: string;
  description: string;
  tier: 1 | 2 | 3;
}

const DESCRIPTORS: Descriptor[] = [

  // ── Tempo Feel ────────────────────────────────────────────────────────────
  { slug: "slow-burn",   label: "Slow Burn",   category: "tempo_feel", tier: 1,
    description: "Gradual, unhurried pacing that builds tension without rushing" },
  { slug: "laid-back",   label: "Laid Back",   category: "tempo_feel", tier: 1,
    description: "Relaxed, behind-the-beat groove that feels effortless" },
  { slug: "midtempo",    label: "Midtempo",    category: "tempo_feel", tier: 2,
    description: "Moderate pace — not slow, not urgent, steady and purposeful" },
  { slug: "driving",     label: "Driving",     category: "tempo_feel", tier: 1,
    description: "Forward momentum that propels the listener continuously" },
  { slug: "urgent",      label: "Urgent",      category: "tempo_feel", tier: 2,
    description: "High energy pace that conveys immediacy and intensity" },
  { slug: "propulsive",  label: "Propulsive",  category: "tempo_feel", tier: 2,
    description: "Rhythmic momentum that continuously pushes forward" },
  { slug: "floating",    label: "Floating",    category: "tempo_feel", tier: 1,
    description: "Untethered, weightless tempo feel with loose rhythmic gravity" },
  { slug: "steady",      label: "Steady",      category: "tempo_feel", tier: 2,
    description: "Consistent, reliable pulse without acceleration or hesitation" },

  // ── Groove ────────────────────────────────────────────────────────────────
  { slug: "straight",      label: "Straight",      category: "groove", tier: 2,
    description: "Even, on-the-grid rhythmic feel without swing or syncopation" },
  { slug: "swung",         label: "Swung",         category: "groove", tier: 2,
    description: "Jazz-influenced triplet feel that gives rhythm a lilting quality" },
  { slug: "syncopated",    label: "Syncopated",    category: "groove", tier: 2,
    description: "Accents fall off the main beat, creating rhythmic surprise" },
  { slug: "shuffling",     label: "Shuffling",     category: "groove", tier: 2,
    description: "Loose, slightly swung groove reminiscent of blues or classic soul" },
  { slug: "pulsing",       label: "Pulsing",       category: "groove", tier: 1,
    description: "Repetitive, heartbeat-like rhythmic drive that feels hypnotic" },
  { slug: "hypnotic",      label: "Hypnotic",      category: "groove", tier: 1,
    description: "Repetitive rhythmic pattern designed to induce a trance-like state" },
  { slug: "bouncy",        label: "Bouncy",        category: "groove", tier: 1,
    description: "Playful, spring-loaded groove with an upward rhythmic feel" },
  { slug: "stuttering",    label: "Stuttering",    category: "groove", tier: 2,
    description: "Interrupted or fragmented rhythmic pattern with deliberate breaks" },
  { slug: "gliding",       label: "Gliding",       category: "groove", tier: 2,
    description: "Smooth, frictionless rhythmic movement that feels effortless" },
  { slug: "marching",      label: "Marching",      category: "groove", tier: 2,
    description: "Militaristic, deliberate pulse with an insistent forward drive" },
  { slug: "rolling",       label: "Rolling",       category: "groove", tier: 2,
    description: "Continuous, wave-like rhythmic motion that builds organically" },
  { slug: "locked-in",     label: "Locked In",     category: "groove", tier: 2,
    description: "Extremely tight rhythmic pocket where all elements align precisely" },

  // ── Drum Character ────────────────────────────────────────────────────────
  { slug: "crisp",             label: "Crisp",           category: "drum_character", tier: 2,
    description: "Clean, defined drum sounds with sharp transient attack" },
  { slug: "dusty",             label: "Dusty",           category: "drum_character", tier: 1,
    description: "Slightly degraded, vintage-sounding drums with analog warmth" },
  { slug: "punchy",            label: "Punchy",          category: "drum_character", tier: 2,
    description: "Impactful drums with strong low-mid presence and immediate attack" },
  { slug: "clipped",           label: "Clipped",         category: "drum_character", tier: 3,
    description: "Intentionally shortened drum sounds, tight and dry" },
  { slug: "roomy",             label: "Roomy",           category: "drum_character", tier: 2,
    description: "Drums with natural reverb suggesting a large physical space" },
  { slug: "electronic",        label: "Electronic",      category: "drum_character", tier: 2,
    description: "Synthesized or programmed drum sounds with digital precision" },
  { slug: "live-kit",          label: "Live Kit",        category: "drum_character", tier: 2,
    description: "Acoustic drum sounds recorded with natural room response" },
  { slug: "808-heavy",         label: "808 Heavy",       category: "drum_character", tier: 1,
    description: "TR-808 bass drum dominates with booming sub-frequency kicks" },
  { slug: "breakbeat-driven",  label: "Breakbeat",       category: "drum_character", tier: 1,
    description: "Sampled drum breaks form the rhythmic foundation" },
  { slug: "clap-forward",      label: "Clap Forward",    category: "drum_character", tier: 3,
    description: "Snare clap mix sits prominently in the high-mid frequency range" },
  { slug: "gated",             label: "Gated",           category: "drum_character", tier: 2,
    description: "Gated reverb effect on snares, characteristic of 80s production" },
  { slug: "skeletal",          label: "Skeletal",        category: "drum_character", tier: 2,
    description: "Minimal drum arrangement with deliberate space between hits" },

  // ── Bass Character ────────────────────────────────────────────────────────
  { slug: "sub-heavy",   label: "Sub Heavy",   category: "bass_character", tier: 1,
    description: "Dominant low-frequency bass that you feel more than hear" },
  { slug: "melodic-bass",label: "Melodic Bass",category: "bass_character", tier: 2,
    description: "Bass line that carries harmonic interest and melodic motion" },
  { slug: "rubbery",     label: "Rubbery",     category: "bass_character", tier: 2,
    description: "Elastic, bouncing bass with a playful, slightly loose quality" },
  { slug: "droning",     label: "Droning",     category: "bass_character", tier: 2,
    description: "Sustained bass note or pedal tone creating harmonic tension" },
  { slug: "warm-bass",   label: "Warm Bass",   category: "bass_character", tier: 2,
    description: "Bass with rounded low-mid presence, smooth and full-bodied" },
  { slug: "distorted",   label: "Distorted",   category: "bass_character", tier: 2,
    description: "Overdriven bass with harmonic saturation and gritty texture" },
  { slug: "restrained",  label: "Restrained",  category: "bass_character", tier: 2,
    description: "Bass sits back in the mix, providing support without dominating" },
  { slug: "funky",       label: "Funky",       category: "bass_character", tier: 1,
    description: "Syncopated, groove-forward bass with soul and R&B character" },
  { slug: "syrupy",      label: "Syrupy",      category: "bass_character", tier: 2,
    description: "Thick, slow-moving bass with a viscous, heavy quality" },
  { slug: "synth-bass",  label: "Synth Bass",  category: "bass_character", tier: 2,
    description: "Electronically synthesized bass with sharp, precise attack" },

  // ── Harmonic Color ────────────────────────────────────────────────────────
  { slug: "minor-key",    label: "Minor Key",    category: "harmonic_color", tier: 2,
    description: "Tonal center built on a minor scale, often conveying melancholy" },
  { slug: "major-key",    label: "Major Key",    category: "harmonic_color", tier: 2,
    description: "Tonal center built on a major scale, often bright or hopeful" },
  { slug: "jazzy",        label: "Jazzy",        category: "harmonic_color", tier: 1,
    description: "Extended chord voicings with jazz harmony influence" },
  { slug: "lush",         label: "Lush",         category: "harmonic_color", tier: 1,
    description: "Dense, rich harmonic layers that feel immersive and full" },
  { slug: "suspended",    label: "Suspended",    category: "harmonic_color", tier: 2,
    description: "Unresolved harmonic tension from suspended chord voicings" },
  { slug: "gospel-rich",  label: "Gospel Rich",  category: "harmonic_color", tier: 1,
    description: "Warm choral harmonies and call-and-response influenced by gospel" },
  { slug: "melancholic",  label: "Melancholic",  category: "harmonic_color", tier: 1,
    description: "Chord progressions that evoke sadness or longing" },
  { slug: "bright",       label: "Bright",       category: "harmonic_color", tier: 2,
    description: "High-frequency harmonic content that feels open and airy" },
  { slug: "cinematic",    label: "Cinematic",    category: "harmonic_color", tier: 1,
    description: "Orchestral or filmic harmonic language suggesting visual narrative" },
  { slug: "static-vamp",  label: "Static Vamp",  category: "harmonic_color", tier: 3,
    description: "One or two chords repeated cyclically with minimal movement" },
  { slug: "nostalgic",    label: "Nostalgic",    category: "harmonic_color", tier: 1,
    description: "Chord progressions evoking memory and a longing for the past" },

  // ── Melodic Character ─────────────────────────────────────────────────────
  { slug: "chant-like",     label: "Chant-Like",    category: "melodic_character", tier: 2,
    description: "Repetitive melodic cells with a ritual or incantatory quality" },
  { slug: "airy",           label: "Airy",          category: "melodic_character", tier: 1,
    description: "Light, open melodic phrases with space and breathing room" },
  { slug: "conversational", label: "Conversational",category: "melodic_character", tier: 2,
    description: "Melodic phrasing that mimics natural speech cadences" },
  { slug: "hook-forward",   label: "Hook Forward",  category: "melodic_character", tier: 2,
    description: "Immediately memorable melodic hook is the central feature" },
  { slug: "leap-heavy",     label: "Leap Heavy",    category: "melodic_character", tier: 3,
    description: "Melody moves frequently in large intervals rather than stepwise motion" },
  { slug: "repetitive",     label: "Repetitive",    category: "melodic_character", tier: 2,
    description: "Melodic phrases loop or return with minimal variation" },
  { slug: "silky",          label: "Silky",         category: "melodic_character", tier: 1,
    description: "Smooth, legato melodic movement with seamless phrase connections" },
  { slug: "angular",        label: "Angular",       category: "melodic_character", tier: 2,
    description: "Jagged, unpredictable melodic contour that avoids smooth curves" },
  { slug: "anthemic",       label: "Anthemic",      category: "melodic_character", tier: 1,
    description: "Large-scale melodic gesture designed for collective singing" },
  { slug: "intimate",       label: "Intimate",      category: "melodic_character", tier: 1,
    description: "Close, personal melodic delivery that feels confessional" },

  // ── Vocal Character ───────────────────────────────────────────────────────
  { slug: "breathy",          label: "Breathy",         category: "vocal_character", tier: 1,
    description: "Audible breath in vocal delivery creating closeness and vulnerability" },
  { slug: "commanding",       label: "Commanding",      category: "vocal_character", tier: 2,
    description: "Authoritative vocal presence that demands full attention" },
  { slug: "restrained-vocal", label: "Restrained",      category: "vocal_character", tier: 2,
    description: "Held-back delivery that conveys emotion through understatement" },
  { slug: "falsetto-led",     label: "Falsetto Led",    category: "vocal_character", tier: 1,
    description: "Primary vocal range in falsetto register, light and ethereal" },
  { slug: "layered",          label: "Layered",         category: "vocal_character", tier: 2,
    description: "Multiple vocal tracks stacked to create dense harmonic texture" },
  { slug: "talk-sung",        label: "Talk-Sung",       category: "vocal_character", tier: 2,
    description: "Vocal delivery between speaking and singing, melodic but speech-like" },
  { slug: "rhythmic",         label: "Rhythmic",        category: "vocal_character", tier: 2,
    description: "Vocal phrasing that emphasizes rhythmic precision over pitch" },
  { slug: "emotionally-direct",label:"Emotionally Direct",category:"vocal_character",tier: 2,
    description: "Vocal performance that makes no attempt to conceal its emotional content" },
  { slug: "cool-toned",       label: "Cool Toned",      category: "vocal_character", tier: 3,
    description: "Detached, slightly aloof vocal quality that suggests emotional distance" },
  { slug: "raw",              label: "Raw",             category: "vocal_character", tier: 1,
    description: "Unpolished, exposed vocal performance prioritizing feeling over technique" },
  { slug: "yearning",         label: "Yearning",        category: "vocal_character", tier: 1,
    description: "Vocal tone saturated with longing, desire or emotional reaching" },

  // ── Texture ───────────────────────────────────────────────────────────────
  { slug: "glossy",    label: "Glossy",    category: "texture", tier: 1,
    description: "Highly polished production surface with smooth, reflective quality" },
  { slug: "grainy",    label: "Grainy",    category: "texture", tier: 1,
    description: "Textured production with visible noise and analog imperfection" },
  { slug: "neon",      label: "Neon",      category: "texture", tier: 1,
    description: "Bright, synthetic texture with electric color and high contrast" },
  { slug: "analog",    label: "Analog",    category: "texture", tier: 1,
    description: "Warm, slightly imperfect quality of recorded-to-tape sound" },
  { slug: "lo-fi",     label: "Lo-Fi",     category: "texture", tier: 1,
    description: "Deliberately low-fidelity production with warmth and nostalgia" },
  { slug: "polished",  label: "Polished",  category: "texture", tier: 2,
    description: "Highly produced, clean mix with professional finish" },
  { slug: "hazy",      label: "Hazy",      category: "texture", tier: 1,
    description: "Blurred, soft-focus sonic texture suggesting dreamlike states" },
  { slug: "saturated", label: "Saturated", category: "texture", tier: 2,
    description: "Heavily compressed or driven texture with maximum sonic density" },
  { slug: "sparse",    label: "Sparse",    category: "texture", tier: 1,
    description: "Minimal arrangement where silence and space carry as much weight as sound" },
  { slug: "lush-texture",label:"Lush",     category: "texture", tier: 1,
    description: "Dense, layered production that feels rich and enveloping" },
  { slug: "metallic",  label: "Metallic",  category: "texture", tier: 2,
    description: "Bright, hard-edged texture with a cold, industrial character" },
  { slug: "warm",      label: "Warm",      category: "texture", tier: 1,
    description: "Round, full-bodied sonic texture with comfortable low-mid presence" },

  // ── Arrangement Energy Arc ────────────────────────────────────────────────
  { slug: "immediate-impact",  label: "Immediate Impact",  category: "arrangement_energy_arc", tier: 2,
    description: "Full energy delivered from the opening bars with no build-up required" },
  { slug: "slow-build",        label: "Slow Build",        category: "arrangement_energy_arc", tier: 1,
    description: "Gradual accumulation of elements building toward a peak moment" },
  { slug: "sustained-drive",   label: "Sustained Drive",   category: "arrangement_energy_arc", tier: 2,
    description: "Consistent energy level maintained throughout without major peaks" },
  { slug: "explosive-chorus",  label: "Explosive Chorus",  category: "arrangement_energy_arc", tier: 2,
    description: "Dramatic energy increase at chorus creates cathartic impact" },
  { slug: "hypnotic-loop",     label: "Hypnotic Loop",     category: "arrangement_energy_arc", tier: 1,
    description: "Repeating structural pattern designed to induce meditative states" },
  { slug: "late-night-cruise", label: "Late Night Cruise",  category: "arrangement_energy_arc", tier: 1,
    description: "Steady, unhurried energy arc suited to nocturnal listening" },
  { slug: "euphoric-lift",     label: "Euphoric Lift",     category: "arrangement_energy_arc", tier: 1,
    description: "Production elements converge to create a feeling of elevation" },
  { slug: "tension-release",   label: "Tension Release",   category: "arrangement_energy_arc", tier: 2,
    description: "Deliberate harmonic or dynamic tension resolved at key moments" },
  { slug: "simmering",         label: "Simmering",         category: "arrangement_energy_arc", tier: 2,
    description: "Low-level energy that suggests intensity without fully releasing it" },
  { slug: "full-bloom",        label: "Full Bloom",        category: "arrangement_energy_arc", tier: 2,
    description: "All arrangement elements present simultaneously at maximum richness" },

  // ── Emotional Tone ────────────────────────────────────────────────────────
  { slug: "wistful",     label: "Wistful",     category: "emotional_tone", tier: 1,
    description: "Tender longing for something past or out of reach" },
  { slug: "triumphant",  label: "Triumphant",  category: "emotional_tone", tier: 1,
    description: "Celebratory emotional quality suggesting victory or overcoming" },
  { slug: "lonely",      label: "Lonely",      category: "emotional_tone", tier: 1,
    description: "Emotional isolation rendered through sonic choices and lyrical themes" },
  { slug: "seductive",   label: "Seductive",   category: "emotional_tone", tier: 1,
    description: "Alluring, sensual emotional register designed to attract" },
  { slug: "swaggering",  label: "Swaggering",  category: "emotional_tone", tier: 1,
    description: "Confident, self-assured energy that borders on arrogance" },
  { slug: "devotional",  label: "Devotional",  category: "emotional_tone", tier: 1,
    description: "Deep reverence and dedication conveyed through musical delivery" },
  { slug: "restless",    label: "Restless",    category: "emotional_tone", tier: 1,
    description: "Anxious forward motion, unable to settle or find stillness" },
  { slug: "playful",     label: "Playful",     category: "emotional_tone", tier: 1,
    description: "Light, fun emotional register without weight or self-seriousness" },
  { slug: "cold",        label: "Cold",        category: "emotional_tone", tier: 1,
    description: "Emotional detachment rendered through sparse, clinical production" },
  { slug: "glamorous",   label: "Glamorous",   category: "emotional_tone", tier: 1,
    description: "Aspirational, elevated emotional quality associated with luxury" },
  { slug: "tender",      label: "Tender",      category: "emotional_tone", tier: 1,
    description: "Gentle, careful emotional handling of vulnerable subject matter" },
  { slug: "nocturnal",   label: "Nocturnal",   category: "emotional_tone", tier: 1,
    description: "Late-night, introspective atmosphere suited to darkness and solitude" },
  { slug: "euphoric",    label: "Euphoric",    category: "emotional_tone", tier: 1,
    description: "Overwhelming positive emotional intensity approaching transcendence" },

  // ── Era Lineage ───────────────────────────────────────────────────────────
  { slug: "blog-era-rap",  label: "Blog Era Rap",  category: "era_lineage", tier: 1,
    description: "Indie rap and alternative hip-hop aesthetic of 2007–2012" },
  { slug: "80s-revival",   label: "80s Revival",   category: "era_lineage", tier: 1,
    description: "Production that consciously references 1980s synth and drum machine aesthetics" },
  { slug: "90s-r-and-b",   label: "90s R&B",       category: "era_lineage", tier: 1,
    description: "Production lineage rooted in 1990s R&B production techniques" },
  { slug: "y2k-club",      label: "Y2K Club",      category: "era_lineage", tier: 1,
    description: "Early 2000s club music aesthetic with maximalist digital production" },
  { slug: "neo-soul",      label: "Neo-Soul",      category: "era_lineage", tier: 1,
    description: "Late 90s/early 2000s soul revival with jazz and hip-hop elements" },
  { slug: "indie-sleaze",  label: "Indie Sleaze",  category: "era_lineage", tier: 1,
    description: "Early 2010s indie rock aesthetic with a raw, hedonistic character" },
  { slug: "trap-soul",     label: "Trap Soul",     category: "era_lineage", tier: 1,
    description: "Fusion of trap production and R&B emotional depth" },
  { slug: "synth-pop",     label: "Synth-Pop",     category: "era_lineage", tier: 1,
    description: "Synthesizer-led pop with clean, electronic production values" },
  { slug: "quiet-storm",   label: "Quiet Storm",   category: "era_lineage", tier: 1,
    description: "Smooth, late-night R&B format rooted in 1970s–80s soft soul" },
  { slug: "electro-pop",   label: "Electro-Pop",   category: "era_lineage", tier: 1,
    description: "Dance-oriented electronic pop with programmed rhythms and synth leads" },

  // ── Environment Imagery ───────────────────────────────────────────────────
  { slug: "night-drive",      label: "Night Drive",      category: "environment_imagery", tier: 1,
    description: "Music suited to driving alone at night through lit city streets" },
  { slug: "club-floor",       label: "Club Floor",       category: "environment_imagery", tier: 1,
    description: "Music designed for the energy and movement of a dance floor" },
  { slug: "headphones-alone", label: "Headphones Alone", category: "environment_imagery", tier: 1,
    description: "Intimate music best experienced in private with focused listening" },
  { slug: "rooftop-city",     label: "Rooftop City",     category: "environment_imagery", tier: 1,
    description: "Elevated, urban atmosphere with skyline energy and open air" },
  { slug: "summer-daylight",  label: "Summer Daylight",  category: "environment_imagery", tier: 1,
    description: "Warm, bright outdoor setting with summer heat and long hours" },
  { slug: "rainy-street",     label: "Rainy Street",     category: "environment_imagery", tier: 1,
    description: "Wet pavement, grey light, introspective urban atmosphere" },
  { slug: "after-hours",      label: "After Hours",      category: "environment_imagery", tier: 1,
    description: "Post-midnight energy, blurred edges, intimate and slightly reckless" },
  { slug: "house-party",      label: "House Party",      category: "environment_imagery", tier: 1,
    description: "Social, celebratory domestic environment with informal energy" },

  // ── Listener Use Case ─────────────────────────────────────────────────────
  { slug: "pregame",            label: "Pregame",           category: "listener_use_case", tier: 1,
    description: "Music that builds anticipation and energy before going out" },
  { slug: "late-night-walk",    label: "Late Night Walk",   category: "listener_use_case", tier: 1,
    description: "Reflective music suited to solitary walking after dark" },
  { slug: "dancefloor",         label: "Dancefloor",        category: "listener_use_case", tier: 1,
    description: "Music optimized for physical movement and collective dancing" },
  { slug: "windows-down",       label: "Windows Down",      category: "listener_use_case", tier: 1,
    description: "Music for driving fast with the windows open and volume up" },
  { slug: "flirtation",         label: "Flirtation",        category: "listener_use_case", tier: 1,
    description: "Music with sensual or playful energy suited to attraction" },
  { slug: "reflective-commute", label: "Reflective Commute",category: "listener_use_case", tier: 1,
    description: "Music for inward thinking during transit between places" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase    = createClient(supabaseUrl, supabaseKey);

  try {
    // Map tier → boolean flags
    const rows = DESCRIPTORS.map(d => ({
      slug:           d.slug,
      label:          d.label,
      category:       d.category,
      description:    d.description,
      tier:           d.tier,
      is_public:      d.tier <= 2,
      is_clickable:   d.tier === 1,
      is_seo_enabled: d.tier === 1,
    }));

    const { error } = await supabase
      .from("descriptor_registry")
      .upsert(rows, { onConflict: "slug" });

    if (error) throw error;

    const counts = {
      total:    rows.length,
      tier1:    rows.filter(r => r.tier === 1).length,
      tier2:    rows.filter(r => r.tier === 2).length,
      tier3:    rows.filter(r => r.tier === 3).length,
    };

    console.log(`[seed-descriptors] Done: ${JSON.stringify(counts)}`);

    return new Response(
      JSON.stringify({ success: true, ...counts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("[seed-descriptors] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
