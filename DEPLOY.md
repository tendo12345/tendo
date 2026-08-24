# Deploying Basis

Static SPA. No server, no build secrets — accounts are the only thing needing configuration,
and they are optional.

## Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project**, import the repo. `vercel.json` already sets the build
   command, output directory and framework, so the defaults it offers are correct.
3. Deploy.

That is the whole thing for the tool itself. Generation, the workspace, exports and share
links all work with no environment variables at all.

### Why `vercel.json` matters

The `rewrites` block is not optional decoration. Basis is a single-page app, so the server
only ever has `index.html` — there is no `/system/overview` file on disk. Without the rewrite,
every URL except `/` returns 404 when opened directly or refreshed, which breaks:

- **every share link** (`/s?p=fintech&k=mobile`), the one thing meant to be pasted to others
- every workspace section, on refresh or when opened from history
- anything a search engine indexes

The rewrite excludes `/assets/` so hashed bundles still 404 properly when missing, instead of
silently returning HTML that the browser then fails to parse as JavaScript.

The long `Cache-Control` on `/assets/` is safe because those filenames are content-hashed:
a new build produces new names. This is what makes the split `design-data` chunk worth having
— returning visitors keep ~100 kB of dataset cached across deploys that only touch app code.

## Accounts (optional)

Skip this entirely and Basis runs as a local-only tool: systems save to the browser, share
links work, nothing is sent anywhere.

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL editor. It creates the table, enables row-level
   security and adds one policy per operation.
3. **Project Settings → API**: copy the Project URL and the `anon` `public` key.
4. In Vercel, add two environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Authentication → URL Configuration**: set Site URL to your deployed origin, and add
   `<origin>/account` to Redirect URLs. Magic links land nowhere useful without this.
6. Redeploy — `VITE_` variables are compiled in at build time, so an existing deployment will
   not pick them up.

Only the **anon** key belongs in these variables. It is public by design and safe in the
bundle; row-level security is what actually protects the data. The `service_role` key bypasses
RLS entirely, and anything with a `VITE_` prefix is compiled into the client where every
visitor can read it.

To verify the deployment before wiring accounts up, open `/account` — it should say accounts
are unavailable rather than showing a sign-in that cannot work.

## Blog comments (optional, requires Accounts)

Comments are layered on top of the accounts setup above — if Supabase is not configured, the
comment section on a blog post shows a plain notice instead of a form that could not work,
the same way the rest of the accounts UI hides itself.

1. Complete the Accounts setup above first.
2. Re-run `supabase/schema.sql` — it is additive and safe to run again. This adds `profiles`,
   `comments`, `comment_reports`, the moderation trigger, and the RLS policies around them.
   **One line is not idempotent**: `alter publication supabase_realtime add table
   public.comments;` raises "already a member of publication" on a second run. That error is
   expected and can be ignored — it means the table is already wired for realtime, not that
   anything failed.
3. **Make the first admin.** There is no in-app UI for this, deliberately — an admin-granting
   UI would itself need to be admin-gated, which is a bootstrapping problem better avoided
   than solved. After someone signs in once (which creates their `profiles` row), promote them
   from the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where id = '<their auth.users uuid>';
   ```
   Find the uuid under **Authentication → Users**. The Moderation nav link and `/admin/comments`
   route only appear for this account.
4. Realtime comes from the same Supabase project — no extra environment variables. If comments
   post successfully but never update live in a second browser window, check **Database →
   Replication** in the dashboard and confirm `comments` is included in the `supabase_realtime`
   publication (step 2 should have already done this).

To verify: open a blog post while signed out — the comment section should prompt to sign in,
not show a broken form. Post a comment from two signed-in accounts in two windows on the same
post and confirm each appears in the other without a refresh.

## Other hosts

Any static host works. The only requirement is the SPA fallback: serve `index.html` for any
path that is not a real file.

- **Netlify**: `/* /index.html 200` in a `_redirects` file
- **Cloudflare Pages**: SPA mode, or the same `_redirects`
- **nginx**: `try_files $uri $uri/ /index.html;`
