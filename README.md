# HarvestSync

A church scheduling / song-library / team-chat app, backed by Supabase.

## 1. Run it locally first (optional but recommended)

```bash
npm install
npm run dev
```

This opens the app at `http://localhost:5173`. Confirm it loads and connects
to Supabase before deploying.

## 2. Push it to GitHub

Vercel deploys straight from a Git repo, so create one:

```bash
git init
git add .
git commit -m "Initial commit"
```

Then create a new repository on GitHub (via github.com/new) and push:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## 3. Deploy on Vercel

**Option A — Vercel dashboard (easiest):**
1. Go to https://vercel.com and sign in (you can use your GitHub account).
2. Click **Add New → Project**.
3. Select the GitHub repo you just pushed.
4. Vercel auto-detects Vite. Leave the defaults:
   - Build Command: `npm run build` (auto-filled)
   - Output Directory: `dist` (auto-filled)
5. Click **Deploy**. You'll get a live URL like `harvestsync.vercel.app`
   within a minute or two.

**Option B — Vercel CLI:**
```bash
npm install -g vercel
vercel login
vercel        # deploys a preview
vercel --prod # deploys to your production URL
```

## 4. Custom domain (optional)

In the Vercel dashboard: **Project → Settings → Domains** → add your domain
and follow the DNS instructions it gives you (usually a CNAME or A record
at your domain registrar).

## Notes on this app's setup

- **Supabase key**: `SUPABASE_KEY` in `src/App.jsx` is a *publishable*
  key, which is meant to be exposed in client-side code — that part is
  fine as-is. Just make sure your Supabase table's Row Level Security
  policies are set up the way you want (right now, based on the code,
  anyone with the URL can read/write the `app_data` table).
- **Admin password**: `ADMIN_PASSWORD` is hardcoded in the same file.
  Since this is a client-side app, that string ships inside the JavaScript
  bundle and can be read by anyone who opens dev tools — it works as a
  light deterrent, not real security. If that matters to you, the check
  needs to move server-side (e.g. a Supabase Edge Function) rather than
  living in the React component.
- Every subsequent `git push` to your `main` branch will trigger an
  automatic redeploy once the Vercel project is connected.
