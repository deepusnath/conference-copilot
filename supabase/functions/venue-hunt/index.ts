// Integrated venue hunting: Claude (web search) finds venues for one paper
// and returns them in the copilot-scout-digest schema. Auth: Supabase JWT.
// Rate limit: 10 hunts/user/day via hunt_log (service role only).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return json({ error: "backend not configured: ANTHROPIC_API_KEY secret missing" }, 503);
    }

    // Who is calling? (must be a signed-in user)
    const auth = req.headers.get("Authorization") ?? "";
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: auth },
    });
    if (!userRes.ok) return json({ error: "sign in required" }, 401);
    const user = await userRes.json();

    // Rate limit: 10 hunts per rolling 24h
    const since = new Date(Date.now() - 864e5).toISOString();
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/hunt_log?user_id=eq.${user.id}&created_at=gte.${since}&select=id`,
      {
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      },
    );
    const total = Number((countRes.headers.get("content-range") ?? "*/0").split("/")[1] || 0);
    if (total >= 10) return json({ error: "daily hunt limit reached (10 per day)" }, 429);

    const { mode = "basic", paper = {}, profile = {}, prior = [] } = await req.json();
    const kw = Array.isArray(paper.keywords) ? paper.keywords.join(", ") : "";
    const today = new Date().toISOString().slice(0, 10);

    const schema = `{"type":"copilot-scout-digest","version":1,"date":"${today}","venues":[{"id":"kebab-slug-year","acr":"ACRO 2027","name":"full name","city":"City, Country","event":"YYYY-MM-DD or null","dl":"YYYY-MM-DD or null","approx":true,"tier":2,"url":"https://official","why":"one-line fit rationale","fits":[${paper.w ?? 1}],"sub":"verify","subUrl":null,"src":"venue hunt ${today}"}]}`;

    const base = `You are a research-venue scout. Today is ${today}.
PAPER: ${paper.title || "(untitled)"} — stage: ${paper.stage || "early"} — keywords: ${kw}
RESEARCHER: ${profile.name || ""}, ${profile.stage || ""}, based in ${profile.country || "unknown"}.
${prior.length ? `ALREADY KNOWN (do not repeat): ${prior.join("; ")}` : ""}
RULES: real venues only — never invent names, URLs, or dates (use null when unverified); mark "approx":true unless the deadline was read on the official page; set "sub":"verify" unless the submission portal was confirmed; exclude predatory venues (guaranteed acceptance, pay-to-publish tone, unverifiable indexing, multi-city same-week series) and list them in one "screened out" line; prefer venues whose deadlines are at least 3 weeks away; tier: 1 field-flagship, 2 solid indexed venue, 4 journal.
OUTPUT: a one-paragraph summary, then a single fenced \`\`\`json block exactly matching this shape: ${schema}`;

    const prompt =
      mode === "extended"
        ? `${base}\n\nMODE: EXTENDED. Verify each candidate on its OFFICIAL site: exact deadline (with timezone), submission portal URL, indexing evidence, registration fees. Go deeper than a search-results pass — open the official pages. Add further strong venues beyond the known list. Return up to 25 fully verified venues (approx:false only where you truly read the official page).`
        : `${base}\n\nMODE: BASIC. Fast pass: find up to 25 credible candidate venues from searches. Shallow verification is fine (approx:true, sub:"verify"); the user can run an extended hunt afterwards.`;

    // Anthropic call with pause_turn resumption (server-side web search loop)
    let messages: unknown[] = [{ role: "user", content: prompt }];
    let msg: any = null;
    for (let i = 0; i < 4; i++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-5",
          max_tokens: mode === "extended" ? 12000 : 8000,
          output_config: { effort: mode === "extended" ? "high" : "low" },
          tools: [
            {
              type: "web_search_20260209",
              name: "web_search",
              max_uses: mode === "extended" ? 20 : 8,
            },
          ],
          messages,
        }),
      });
      if (!r.ok) {
        return json({ error: `model call failed (${r.status}): ${(await r.text()).slice(0, 200)}` }, 502);
      }
      msg = await r.json();
      if (msg.stop_reason === "refusal") return json({ error: "request was declined — rephrase the paper details" }, 422);
      if (msg.stop_reason !== "pause_turn") break;
      messages = [{ role: "user", content: prompt }, { role: "assistant", content: msg.content }];
    }

    const text = (msg?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    const match = text.match(/```json\s*([\s\S]*?)```/);
    let digest: any = null;
    if (match) {
      try {
        digest = JSON.parse(match[1]);
      } catch (_) { /* fall through */ }
    }
    if (!digest || !Array.isArray(digest.venues)) {
      return json({ error: "the hunt returned no parseable venue list — try again", summary: text.slice(0, 1500) }, 502);
    }
    digest.venues = digest.venues
      .filter((v: any) => v && typeof v.id === "string" && typeof v.acr === "string")
      .slice(0, 25)
      .map((v: any) => ({ approx: true, sub: "verify", ...v, src: `venue hunt ${today}` }));

    // Log the hunt (fire-and-forget)
    await fetch(`${SUPABASE_URL}/rest/v1/hunt_log`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ user_id: user.id, mode }),
    }).catch(() => {});

    return json({
      digest,
      summary: text.replace(/```json[\s\S]*?```/, "").trim().slice(0, 2000),
      mode,
      usage: msg.usage ?? null,
    });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
