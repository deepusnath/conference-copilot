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
