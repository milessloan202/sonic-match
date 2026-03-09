// api/drain-queue.js
// Called by Vercel cron every 2 minutes (see vercel.json).
// Forwards the request to the Supabase process-resolution-jobs edge function.
// No user-facing traffic ever hits this route.

export default async function handler(req, res) {
  // Vercel cron sends a GET with an Authorization header containing
  // CRON_SECRET. Reject anything else to prevent public abuse.
  const cronSecret    = process.env.CRON_SECRET;
  const authorization = req.headers["authorization"];

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[drain-queue] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Missing environment variables" });
  }

  try {
    const workerUrl = `${supabaseUrl}/functions/v1/process-resolution-jobs`;

    const response = await fetch(workerUrl, {
      method:  "POST",
      headers: {
        "Authorization":  `Bearer ${supabaseKey}`,
        "Content-Type":   "application/json",
      },
      body: JSON.stringify({ batch_size: 10 }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[drain-queue] Worker error:", data);
      return res.status(502).json({ error: "Worker returned error", detail: data });
    }

    console.log("[drain-queue] Worker result:", JSON.stringify(data));
    return res.status(200).json(data);

  } catch (err) {
    console.error("[drain-queue] Fetch failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
