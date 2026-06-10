# Deploying MaliMart to Vercel

This guide walks you through publishing MaliMart from your laptop to a live
Vercel URL by way of GitHub. You only need to do steps 1–3 once; step 4
(redeploys) happens automatically every time you push to GitHub.

---

## What changed for Vercel

A few small refactors landed alongside this guide so the app can run on a
serverless host:

| Change | Why |
| --- | --- |
| Replaced **Socket.IO** with **Supabase Realtime** (`src/context/SocketContext.tsx`) | Vercel can't run a long-lived WebSocket server. Supabase Realtime works as a drop-in replacement and you already have a Supabase project. |
| Moved `express`, `socket.io`, `tsx` to `devDependencies` | They're only used by `server.ts` for local dev. They're no longer shipped in the production install. |
| Added **`vercel.json`** | Tells Vercel how to build (Vite), where the output lives (`dist`), routes all paths to `index.html` (SPA), and sets cache headers + light security headers. |
| Added **`.vercelignore`** | Keeps SQL migration files and the local Express server out of the deployment bundle. |
| Hardened **`vite.config.ts`** | Reads both `VITE_*` and unprefixed env vars, splits the bundle into smaller chunks. |
| Hardened **`.gitignore`** | Ensures `.env` files and `.vercel/` never get committed. |

---

## 1) Push the project to GitHub

> If you've never used Git on this machine, install it from
> https://git-scm.com/downloads first.

### a) Create an empty repo on GitHub

1. Go to https://github.com/new
2. Repository name: `malimart` (or anything you like)
3. Set it to **Private** (recommended — it contains your Supabase URL).
4. Do **NOT** tick "Add a README", "Add .gitignore", or "Add license".
   The folder already has these.
5. Click **Create repository**. Leave that page open — you'll need the URL.

### b) Initialise git in the project folder

Open a terminal (PowerShell on Windows is fine) and `cd` into the project
folder:

```powershell
cd "C:\Users\USER\Downloads\malimart-1.8 (5)"
```

Then run, one block at a time:

```bash
git init
git add .
git commit -m "Initial commit: MaliMart prepared for Vercel"
git branch -M main
```

### c) Connect to GitHub and push

Copy the **HTTPS URL** GitHub showed you on the empty-repo page (it looks
like `https://github.com/your-username/malimart.git`), then run:

```bash
git remote add origin https://github.com/your-username/malimart.git
git push -u origin main
```

GitHub will ask for credentials. If you have 2FA on, use a
**Personal Access Token** (https://github.com/settings/tokens) in place of
your password — give it the `repo` scope, copy the token, and paste it
when prompted.

Refresh the GitHub repo page — you should see all your files.

---

## 2) Create the Vercel project

1. Go to https://vercel.com/new — sign in with GitHub when prompted.
2. The first time, Vercel asks you to **Install the Vercel GitHub App**.
   Grant it access to the `malimart` repo (or "All repositories").
3. Find `malimart` in the list and click **Import**.
4. Vercel will auto-detect **Framework Preset: Vite**. Leave it as is.
5. **Build & Output Settings** — leave everything on defaults. The
   `vercel.json` in the repo already pins them:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
6. **Environment Variables** — expand this section and add the three
   variables below. Set **all three** for *Production*, *Preview*, and
   *Development* (the three checkboxes). Values come from:
   - Supabase: **Project Settings → API** (you want the `Project URL`
     and the `anon` `public` key — NOT the service role key).
   - Gemini: https://aistudio.google.com/apikey

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` |
   | `SUPABASE_ANON_KEY` | `eyJhbGciOi...` (the long anon JWT) |
   | `GEMINI_API_KEY` | your Gemini key |

7. Click **Deploy**.

The first build takes 2–4 minutes. When it finishes you'll get a URL like
`malimart-abc123.vercel.app`. Open it and verify the app loads.

---

## 3) Post-deploy checklist

After the first deploy, run through this list — these are the things most
likely to bite you:

- [ ] **Open the site, open DevTools → Network** — confirm requests go to
      `*.supabase.co` and that auth works.
- [ ] **Try signing in / signing up.** If you get a redirect-URI error in
      Supabase, go to **Authentication → URL Configuration** in your
      Supabase dashboard and add your Vercel URL (e.g.
      `https://malimart-abc123.vercel.app`) to **Site URL** and
      **Redirect URLs**.
- [ ] **Restrict your Gemini API key** at
      https://aistudio.google.com/apikey — set HTTP referrer restrictions
      to your Vercel domain and a low per-day quota. Reminder: the key is
      in the public JS bundle, so anyone visiting your site can extract it.
      You agreed to this trade-off for now — plan to proxy it through a
      Vercel function later if Gemini usage grows.
- [ ] **Run all the Supabase SQL files** in your Supabase dashboard SQL
      editor if you haven't already (the `supabase_*.sql` files at the
      repo root). They're excluded from the Vercel build by
      `.vercelignore` because they live in Supabase, not in the app.
- [ ] **Test Supabase Realtime** — open two browser tabs. One change made
      in tab A should propagate to tab B (this replaces the old
      Socket.IO bargaining bus). If it doesn't, check
      **Supabase → Database → Replication** is enabled.
- [ ] **PWA install** — on mobile/desktop, the install banner should
      appear after a few visits. Service worker is set to `autoUpdate`.

---

## 4) Subsequent deploys

You don't have to do anything new. Just push to `main`:

```bash
git add .
git commit -m "your change"
git push
```

Vercel will build and deploy automatically. Every push to a non-`main`
branch gets a **Preview Deployment** with its own URL — great for testing
changes before merging.

---

## 5) Custom domain (optional)

When you're ready:

1. In the Vercel dashboard, open your project → **Settings → Domains**.
2. Add `malimart.tz` (or whatever you own).
3. Vercel will show you the DNS records to add at your registrar.
4. SSL is automatic — give it a few minutes after DNS resolves.
5. Don't forget to update **Supabase → Authentication → URL Configuration**
   with the new custom domain.

---

## Troubleshooting

**Build fails with `Cannot find module 'vite-plugin-pwa'`**
The plugin moved to devDependencies. That's intentional. If Vercel
chokes, set the env var `NPM_CONFIG_PRODUCTION=false` in the Vercel
project so devDependencies install during the build. (By default Vercel
already installs them — only override if you see this error.)

**Blank page after deploy**
99% of the time this is a router issue. We use `MemoryRouter` so SPA
routing works fine. If you switch to `BrowserRouter` later, the
`vercel.json` rewrite already routes everything to `index.html`.

**Supabase auth redirects to localhost**
Update the Supabase **Site URL** and **Redirect URLs** to your Vercel
domain (see post-deploy checklist).

**"socket disconnected" in console**
Old leftover — should be gone after this refactor. If you see it, hard
refresh (Cmd/Ctrl + Shift + R) to pick up the new service worker.

**Want to revert a deploy?**
Vercel keeps every deploy. In the dashboard, find the previous one and
click **Promote to Production**.
