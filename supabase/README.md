# Backend setup (one-time, ~10 minutes)

1. Create a free project at https://supabase.com (org: your account).
2. In the SQL editor, run `migrations/001_init.sql`.
3. Auth → Providers: leave Email enabled (magic link is the default flow).
   Auth → URL configuration: add `https://deepusnath.github.io/conference-copilot/`
   to the redirect allow-list.
4. Project Settings → API: copy the Project URL and the `anon` public key into
   `config.js` at the repo root:

   ```js
   window.COPILOT_SUPABASE = {
     url: "https://YOURPROJECT.supabase.co",
     anonKey: "YOUR_ANON_PUBLIC_KEY"
   };
   ```

5. Commit and push. The anon key is public by design — row-level security is
   the boundary; never commit the `service_role` key.

The app auto-detects the config: a "Sign in to sync" button appears in the
header. Without config it stays in localStorage-only mode.

## Venue-hunt function (one-time, ~10 minutes)

Powers the in-app "Hunt venues" button (basic + extended hunting).

1. Run `migrations/003_hunt_log.sql` in the SQL editor (rate-limit table).
2. Create an Anthropic API key at https://console.anthropic.com (Settings → API keys).
3. In the Supabase dashboard: **Edge Functions → Deploy a new function**, name it
   `venue-hunt`, paste the contents of `functions/venue-hunt/index.ts`, deploy.
4. **Edge Functions → venue-hunt → Secrets**: add `ANTHROPIC_API_KEY` with your key.
   (Never put this key in the repo or the browser — it lives only as a function secret.)
5. Reload the app: the copy-paste prompt in the venue-match page is replaced by
   Hunt buttons with a progress bar.

Cost control: hunts run on `claude-opus-5` with web search — roughly $0.10–0.50
per basic hunt, more for extended. The function enforces 10 hunts/user/day; edit
the constant in index.ts to change model or limits.
