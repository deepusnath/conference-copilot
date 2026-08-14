// Daily deadline nudges: T-21 / T-7 / T-3 emails per tracked venue.
// Idempotent (nudge_log unique constraint), so public triggering is harmless —
// each nudge can only ever send once. Sender: Resend (RESEND_API_KEY secret).

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const ACTIVE = new Set(["watching", "shortlisted", "drafting"]);
const thresholdFor = (d: number) =>
  d >= 0 && d <= 3 ? 3 : d <= 7 ? 7 : d <= 21 ? 21 : null;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("NUDGE_FROM") || "Conference CoPilot <onboarding@resend.dev>";
    if (!RESEND) return json({ error: "RESEND_API_KEY secret not set" }, 503);
    const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

    const pipelines = await (await fetch(
      `${SUPABASE_URL}/rest/v1/user_pipelines?select=user_id,data`,
      { headers: svc },
    )).json();
    if (!Array.isArray(pipelines)) return json({ error: "pipeline read failed" }, 500);

    const sent = await (await fetch(
      `${SUPABASE_URL}/rest/v1/nudge_log?select=user_id,venue_id,threshold`,
      { headers: svc },
    )).json();
    const already = new Set(
      (Array.isArray(sent) ? sent : []).map((r: any) => `${r.user_id}|${r.venue_id}|${r.threshold}`),
    );

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let emails = 0, nudges = 0;

    for (const row of pipelines) {
      const entries = Array.isArray(row.data) ? row.data : [];
      const due: any[] = [];
      for (const c of entries) {
        if (!c || !c.dl || !ACTIVE.has(c.status)) continue;
        const days = Math.round((new Date(c.dl + "T00:00:00Z").getTime() - today.getTime()) / 864e5);
        const t = thresholdFor(days);
        if (t === null) continue;
        if (already.has(`${row.user_id}|${c.id}|${t}`)) continue;
        due.push({ ...c, days, threshold: t });
      }
      if (!due.length) continue;

      const u = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${row.user_id}`, { headers: svc })).json();
      const email = u && u.email;
      if (!email) continue;

      due.sort((a, b) => a.days - b.days);
      const items = due.map((c) =>
        `<li style="margin:6px 0"><b>${c.acr}</b> — ${c.name || ""}<br>
         deadline <b>${c.dl}</b> (${c.days} day${c.days === 1 ? "" : "s"} left) · status: ${c.status}${c.url ? ` · <a href="${c.url}">official site</a>` : ""}</li>`
      ).join("");
      const subject = `⏰ ${due.length} deadline${due.length === 1 ? "" : "s"} approaching — closest: ${due[0].acr} in ${due[0].days}d`;
      const html = `<div style="font-family:sans-serif;max-width:560px">
        <h2 style="margin:0 0 8px">Deadlines approaching</h2>
        <ul style="padding-left:18px">${items}</ul>
        <p><a href="https://deepusnath.github.io/conference-copilot/">Open your pipeline</a> to act or update statuses (marking a venue submitted/skipped stops its nudges).</p>
        <p style="color:#888;font-size:12px">Conference CoPilot · deadlines are research aids — always verify on the official site.</p></div>`;

      const send = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [email], subject, html }),
      });
      if (!send.ok) {
        console.error(`resend failed for ${email}: ${send.status} ${(await send.text()).slice(0, 200)}`);
        continue;
      }
      emails++;
      for (const c of due) {
        nudges++;
        await fetch(`${SUPABASE_URL}/rest/v1/nudge_log`, {
          method: "POST",
          headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: row.user_id, venue_id: c.id, threshold: c.threshold }),
        }).catch(() => {});
      }
    }
    return json({ ok: true, emails, nudges });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
